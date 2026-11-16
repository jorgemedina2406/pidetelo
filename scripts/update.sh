#!/usr/bin/env bash
# ========================================================
# PÍDETELO - SCRIPT DE ACTUALIZACIÓN EN PRODUCCIÓN
# ========================================================
set -e

echo "🔄 Iniciando actualización de Pídetelo..."
cd /root/pidetelo || cd "$(dirname "$0")/.."

# 1. Traer los cambios más recientes de GitHub
echo "📥 Descargando cambios desde GitHub (main)..."
git pull origin main

# 2. Si hubo cambios en Web-App, recompilar Angular
echo "🔨 Compilando Web App (Angular para producción)..."
docker run --rm \
    -v "$(pwd)/web-app:/app" \
    -w /app \
    node:22-alpine sh -c "npm ci && npm run build:prod"

# 3. Si hubo cambios en Backend, reconstruir y reiniciar sin caída
echo "🐳 Reconstruyendo y actualizando contenedor Backend..."
docker compose build backend
docker compose up -d --no-deps backend

# 4. Recargar Nginx por si cambiaron archivos de Landing o Nginx
echo "🌐 Recargando servidor web Nginx..."
docker compose exec -T nginx nginx -s reload || true

echo ""
echo "=========================================================="
echo "✅ ¡PÍDETELO HA SIDO ACTUALIZADO EXITOSAMENTE! 🚀"
echo "=========================================================="
docker compose ps

