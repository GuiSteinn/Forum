# Forum Distribuido

Projeto simples de forum online feito com React, Node.js, Express e PostgreSQL. A ideia e demonstrar uma arquitetura distribuida com frontend, backend, banco de dados, replicas em Kubernetes e balanceadores de carga separados.

## Funcionalidades

- Listagem de posts em estilo forum.
- Criacao de novos posts.
- Votos positivos e negativos.
- Comentarios por post.
- Persistencia em PostgreSQL.
- Endpoint de saude em `/health`.
- Frontend e backend empacotados com Docker.
- Manifests Kubernetes com replicas, probes, HPA e dois `LoadBalancer`.

## Arquitetura do Trabalho

```text
Usuario
  |
  v
Load Balancer do Frontend
  |
  v
Pods do Frontend React/Nginx em multiplas replicas
  |
  v
Load Balancer do Backend
  |
  v
Pods do Backend Node/Express em multiplas replicas
  |
  v
Service interno do PostgreSQL
  |
  v
Volume persistente do banco
```

Na AWS, o cluster pode ser criado com Amazon EKS em pelo menos duas zonas de disponibilidade. Os Services do tipo `LoadBalancer` criam balanceadores externos para frontend e backend. O PostgreSQL deste projeto roda no cluster para fins didaticos; em uma arquitetura de producao, seria melhor usar Amazon RDS Multi-AZ.

Ha um exemplo de cluster em `aws/eksctl-cluster.yaml` usando duas zonas de disponibilidade. Ajuste a regiao e as zonas conforme a conta AWS do grupo.

## Como Rodar Localmente com Docker

Requisitos:

- Docker Desktop.
- Node.js apenas se quiser rodar sem Docker.

Subir tudo:

```bash
docker compose up --build
```

Acessos:

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

Parar:

```bash
docker compose down
```

Parar e apagar dados do banco local:

```bash
docker compose down -v
```

## Como Rodar em Desenvolvimento

Crie os arquivos de ambiente:

```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

Instale as dependencias:

```bash
npm install
```

Suba um PostgreSQL local:

```bash
docker compose up postgres
```

Rode frontend e backend:

```bash
npm run dev
```

Se voce estiver no Windows e o PowerShell bloquear o comando `npm`, use `npm.cmd`:

```bash
npm.cmd install
npm.cmd run dev
```

Para testar sem Docker e sem PostgreSQL local, deixe `DATABASE_URL=memory` em `backend/.env`. Esse modo guarda os dados apenas enquanto o backend estiver ligado. Para a apresentacao na AWS, use PostgreSQL conforme o Docker/Kubernetes.

## Deploy em Kubernetes

Antes de aplicar no cluster, gere e publique as imagens Docker em um registry, como Amazon ECR, Docker Hub ou GitHub Container Registry.

Exemplo com tags:

```bash
docker build -t SEU_REGISTRY/forum-backend:1.0.0 ./backend
docker build -t SEU_REGISTRY/forum-frontend:1.0.0 ./frontend
docker push SEU_REGISTRY/forum-backend:1.0.0
docker push SEU_REGISTRY/forum-frontend:1.0.0
```

Depois, altere os campos `image` em:

- `k8s/backend.yaml`
- `k8s/frontend.yaml`

Aplicar no cluster:

```bash
kubectl apply -k k8s
```

Verificar os recursos:

```bash
kubectl get pods -n forum
kubectl get svc -n forum
kubectl get hpa -n forum
```

Os Services `frontend-lb` e `backend-lb` devem receber um `EXTERNAL-IP` ou hostname externo na AWS.

## Pontos Para Explicar no Video

1. Mostrar o sistema funcionando: criar post, votar e comentar.
2. Mostrar o banco persistindo os dados.
3. Mostrar os pods do frontend e backend com `kubectl get pods -n forum`.
4. Explicar que cada aplicacao tem 3 replicas no Deployment.
5. Mostrar os Services com `kubectl get svc -n forum`.
6. Explicar que `frontend-lb` e `backend-lb` sao balanceadores de carga separados.
7. Explicar que o PostgreSQL usa `PersistentVolumeClaim`.
8. Mostrar o endpoint `/health` do backend.
9. Explicar as probes de liveness e readiness.
10. Encerrar comentando como isso atende aos requisitos: cluster, banco, balanceadores e aplicacoes separadas.

## Divisao Sugerida Para o Grupo

- Pessoa 1: apresenta o frontend, funcionalidades e experiencia do usuario.
- Pessoa 2: apresenta backend, API, endpoints e banco.
- Pessoa 3: apresenta Kubernetes, replicas, Services, balanceadores e AWS.

## Endpoints da API

- `GET /health`: verifica se backend e banco estao saudaveis.
- `GET /api/posts`: lista posts.
- `GET /api/posts/:id`: busca post com comentarios.
- `POST /api/posts`: cria post.
- `POST /api/posts/:id/comments`: cria comentario.
- `POST /api/posts/:id/vote`: vota em um post.

Exemplo de criacao de post:

```json
{
  "title": "Meu primeiro post",
  "author": "Aluno",
  "content": "Conteudo do post"
}
```
