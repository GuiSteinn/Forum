#!/bin/bash
set -euo pipefail
exec > /var/log/forum-setup.log 2>&1

echo "=== [1/4] Atualizando pacotes ==="
apt-get update -y
apt-get install -y curl unzip jq

echo "=== [2/4] Instalando AWS CLI v2 ==="
if ! command -v aws &>/dev/null; then
  curl -fsSL "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o /tmp/awscliv2.zip
  unzip -qo /tmp/awscliv2.zip -d /tmp
  /tmp/aws/install
  rm -rf /tmp/aws /tmp/awscliv2.zip
fi

echo "=== [3/4] Aguardando token k3s no SSM ==="
until TOKEN=$(aws ssm get-parameter \
  --name "/forum/k3s-token" \
  --with-decryption \
  --region ${region} \
  --query "Parameter.Value" \
  --output text 2>/dev/null) && [ "$TOKEN" != "placeholder" ] && [ -n "$TOKEN" ]; do
  echo "Token ainda nao disponivel, tentando novamente em 15s..."
  sleep 15
done
echo "Token obtido!"

echo "=== [4/4] Instalando k3s agent ==="
curl -sfL https://get.k3s.io | K3S_URL="https://${server_private_ip}:6443" \
  K3S_TOKEN="$TOKEN" \
  INSTALL_K3S_EXEC="agent --node-label topology.kubernetes.io/zone=${az}" \
  sh -

echo "=== Agent k3s instalado e conectado ao server ==="
