#!/bin/bash
set -euo pipefail
exec > /var/log/forum-setup.log 2>&1

echo "=== [1/6] Atualizando pacotes ==="
apt-get update -y
apt-get install -y curl unzip jq

echo "=== [2/6] Instalando AWS CLI v2 ==="
if ! command -v aws &>/dev/null; then
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -qo /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install
  rm -rf /tmp/aws /tmp/awscliv2.zip
fi

echo "=== [3/6] Instalando k3s server ==="
curl -sfL https://get.k3s.io | INSTALL_K3S_EXEC="server \
  --tls-san $(curl -s http://169.254.169.254/latest/meta-data/public-ipv4) \
  --node-label topology.kubernetes.io/zone=${az} \
  --write-kubeconfig-mode 644" sh -

echo "Aguardando k3s ficar pronto..."
until kubectl get nodes &>/dev/null; do sleep 5; done
echo "k3s server pronto!"

echo "=== [4/6] Salvando token no SSM ==="
K3S_TOKEN=$(cat /var/lib/rancher/k3s/server/node-token)
aws ssm put-parameter \
  --name "/forum/k3s-token" \
  --value "$K3S_TOKEN" \
  --type SecureString \
  --overwrite \
  --region ${region}

echo "=== [5/6] Escrevendo manifests ==="
mkdir -p /opt/forum-k8s

cat > /opt/forum-k8s/01-namespace.yaml <<'MANIFEST'
apiVersion: v1
kind: Namespace
metadata:
  name: forum
MANIFEST

cat > /opt/forum-k8s/02-postgres.yaml <<'MANIFEST'
apiVersion: v1
kind: Secret
metadata:
  name: postgres-secret
  namespace: forum
type: Opaque
stringData:
  POSTGRES_DB: forum
  POSTGRES_USER: forum
  POSTGRES_PASSWORD: forum
  DATABASE_URL: postgres://forum:forum@postgres.forum.svc.cluster.local:5432/forum
---
apiVersion: v1
kind: Service
metadata:
  name: postgres
  namespace: forum
spec:
  clusterIP: None
  selector:
    app: postgres
  ports:
    - port: 5432
      targetPort: 5432
---
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
  namespace: forum
spec:
  serviceName: postgres
  replicas: 1
  selector:
    matchLabels:
      app: postgres
  template:
    metadata:
      labels:
        app: postgres
    spec:
      affinity:
        nodeAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              preference:
                matchExpressions:
                  - key: node-role.kubernetes.io/control-plane
                    operator: Exists
      tolerations:
        - key: node-role.kubernetes.io/control-plane
          operator: Exists
          effect: NoSchedule
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          envFrom:
            - secretRef:
                name: postgres-secret
          env:
            - name: PGDATA
              value: /var/lib/postgresql/data/pgdata
          volumeMounts:
            - name: data
              mountPath: /var/lib/postgresql/data
          readinessProbe:
            exec:
              command: ["pg_isready", "-U", "forum", "-d", "forum"]
            initialDelaySeconds: 10
            periodSeconds: 10
          livenessProbe:
            exec:
              command: ["pg_isready", "-U", "forum", "-d", "forum"]
            initialDelaySeconds: 30
            periodSeconds: 20
  volumeClaimTemplates:
    - metadata:
        name: data
      spec:
        accessModes: ["ReadWriteOnce"]
        storageClassName: local-path
        resources:
          requests:
            storage: 5Gi
MANIFEST

cat > /opt/forum-k8s/03-backend.yaml <<MANIFEST
apiVersion: apps/v1
kind: Deployment
metadata:
  name: backend
  namespace: forum
spec:
  replicas: 3
  selector:
    matchLabels:
      app: backend
  template:
    metadata:
      labels:
        app: backend
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: backend
      containers:
        - name: backend
          image: ${dockerhub_username}/forum-backend:1.0.0
          imagePullPolicy: Always
          ports:
            - containerPort: 3001
          env:
            - name: PORT
              value: "3001"
            - name: CORS_ORIGIN
              value: "*"
            - name: DB_HOST
              value: "postgres.forum.svc.cluster.local"
            - name: DB_PORT
              value: "5432"
            - name: DB_NAME
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_DB
            - name: DB_USER
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_USER
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: POSTGRES_PASSWORD
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: postgres-secret
                  key: DATABASE_URL
          readinessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 8
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /health
              port: 3001
            initialDelaySeconds: 20
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: backend
  namespace: forum
spec:
  type: NodePort
  selector:
    app: backend
  ports:
    - name: http
      port: 3001
      targetPort: 3001
      nodePort: 30081
MANIFEST

cat > /opt/forum-k8s/04-frontend.yaml <<MANIFEST
apiVersion: apps/v1
kind: Deployment
metadata:
  name: frontend
  namespace: forum
spec:
  replicas: 3
  selector:
    matchLabels:
      app: frontend
  template:
    metadata:
      labels:
        app: frontend
    spec:
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: ScheduleAnyway
          labelSelector:
            matchLabels:
              app: frontend
      containers:
        - name: frontend
          image: ${dockerhub_username}/forum-frontend:1.0.0
          imagePullPolicy: Always
          ports:
            - containerPort: 80
          readinessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 5
            periodSeconds: 10
          livenessProbe:
            httpGet:
              path: /
              port: 80
            initialDelaySeconds: 15
            periodSeconds: 20
---
apiVersion: v1
kind: Service
metadata:
  name: frontend
  namespace: forum
spec:
  type: NodePort
  selector:
    app: frontend
  ports:
    - name: http
      port: 80
      targetPort: 80
      nodePort: 30080
MANIFEST

cat > /opt/forum-k8s/05-hpa.yaml <<'MANIFEST'
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: backend-hpa
  namespace: forum
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: backend
  minReplicas: 3
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: frontend-hpa
  namespace: forum
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: frontend
  minReplicas: 3
  maxReplicas: 6
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
MANIFEST

echo "=== [6/6] Aplicando manifests ==="
for f in /opt/forum-k8s/*.yaml; do
  echo "Aplicando $f..."
  kubectl apply -f "$f"
done

echo "=== Setup concluido! ==="
echo "Aguardando pods ficarem prontos..."
kubectl -n forum rollout status deployment/backend --timeout=300s || true
kubectl -n forum rollout status deployment/frontend --timeout=300s || true
kubectl -n forum get pods -o wide
