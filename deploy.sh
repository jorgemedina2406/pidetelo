#!/bin/bash
set -e

echo "=========================================="
echo "🚀 Actualizando Pídetelo en Producción..."
echo "=========================================="

cd "$(dirname "$0")"

echo "📥 1. Bajando últimos cambios de GitHub..."
git pull origin main

# Si npm está instalado en el host, compila localmente; si no, usa el dist ya compilado en git
if command -v npm &> /dev/null; then
  echo "📦 2. Reconstruyendo Frontend Web-App con npm local..."
  npm --prefix web-app run build
else
  echo "📦 2. Usando Frontend Web-App precompilado de Git..."
fi

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
