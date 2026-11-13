#!/usr/bin/env bash
# ========================================================
# PÍDETELO - SCRIPT MAESTRO DE DESPLIEGUE A PRODUCCIÓN
# ========================================================
set -e

echo "🚀 Iniciando despliegue de Pídetelo en Producción..."

# 1. Comprobar Docker y Docker Compose
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
fi

# 2. Crear directorios para Certbot y certificados SSL
mkdir -p certbot/conf certbot/www nginx/conf.d nginx/ssl

# 3. Compilar Web App de Angular para producción
if [ -d "web-app" ]; then
    echo "🔨 Compilando Web App (Angular)..."
    cd web-app
    npm ci
    npm run build:prod
    cd ..
fi

# 4. Verificar archivo de variables de entorno del backend
if [ ! -f "backend/.env" ]; then
    echo "⚠️ Archivo backend/.env no encontrado. Creando a partir de .env.example..."
    cp backend/.env.example backend/.env
    echo "❗ Por favor revisa backend/.env antes de continuar si necesitas modificar claves."
fi

# 5. Levantar contenedores con Docker Compose
echo "🐳 Construyendo y levantando contenedores (Backend + Nginx)..."
docker compose down || true
docker compose build --pull
docker compose up -d --remove-orphans

echo ""
echo "✅ ¡PÍDETELO HA SIDO DESPLEGADO EXITOSAMENTE!"
echo "🌐 API Backend: https://api.pidetelo.com/api/docs"
echo "🌐 Web App: https://app.pidetelo.com"
echo "🌐 Landing: https://pidetelo.com"
echo ""
echo "Estado de los contenedores:"
docker compose ps
