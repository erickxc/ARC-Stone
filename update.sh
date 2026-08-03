#!/bin/bash
set -e

cd /opt/dilegno

echo ">>> Puxando alterações do GitHub..."
git pull origin main

echo ">>> Reconstruindo containers..."
docker compose build --no-cache

echo ">>> Reiniciando containers..."
docker compose up -d

echo ">>> Limpando imagens antigas..."
docker image prune -f

echo "✅ Atualização concluída!"
