#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Actualizando Pídetelo en Producción..."
echo "=========================================="

cd "$(dirname "$0")"

echo "📥 1. Bajando últimos cambios de GitHub..."
git pull origin main

echo "📦 2. Reconstruyendo Frontend Web-App (Angular)..."
npm --prefix web-app run build

echo "🔄 3. Reconstruyendo Backend NestJS en Docker..."
docker compose build backend

echo "🚀 4. Reiniciando contenedores (Backend y Nginx)..."
docker compose up -d --force-recreate backend nginx

echo "=========================================="
echo "✅ ¡Despliegue completado con éxito!"
echo "🌐 Panel:   https://panel.pidetelo.app"
echo "🌐 Admin:   https://admin.pidetelo.app"
echo "🌐 API:     https://api.pidetelo.app"
echo "=========================================="
