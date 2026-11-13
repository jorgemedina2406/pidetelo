#!/usr/bin/env bash
# ========================================================
# PÍDETELO - SCRIPT MAESTRO DE DESPLIEGUE A PRODUCCIÓN
# ========================================================
set -e

echo "🚀 Iniciando despliegue de Pídetelo en Producción..."

# 1. Comprobar e instalar Docker y Docker Compose si no existen
if ! command -v docker &> /dev/null; then
    echo "📦 Instalando Docker..."
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
    systemctl enable docker
    systemctl start docker
    rm -f get-docker.sh
fi

# 2. Instalar herramientas auxiliares
if ! command -v openssl &> /dev/null; then
    echo "📦 Instalando openssl..."
    apt-get update -y && apt-get install -y openssl
fi

# 3. Crear directorios necesarios
mkdir -p certbot/conf certbot/www nginx/conf.d nginx/ssl

# 4. Compilar Web App (Angular) usando Node.js 22 dentro de Docker
if [ -d "web-app" ]; then
    echo "🔨 Compilando Web App (Angular para producción)..."
    docker run --rm \
        -v "$(pwd)/web-app:/app" \
        -w /app \
        node:22-alpine sh -c "npm ci && npm run build:prod"
fi

# 5. Generar certificado SSL provisional si aún no existen los definitivos
# (Permite que Nginx inicie sin errores de sintaxis en el puerto 443)
CERT_DIR="certbot/conf/live/pidetelo.app"
if [ ! -f "$CERT_DIR/fullchain.pem" ]; then
    echo "🔐 Preparando certificados iniciales para pidetelo.app..."
    mkdir -p "$CERT_DIR"
    openssl req -x509 -nodes -newkey rsa:2048 -days 1 \
        -keyout "$CERT_DIR/privkey.pem" \
        -out "$CERT_DIR/fullchain.pem" \
        -subj "/CN=pidetelo.app"
fi

# 6. Verificar archivo de variables de entorno del backend
if [ ! -f "backend/.env" ]; then
    echo "⚙️ Configurando variables de entorno de producción..."
    cp backend/.env.example backend/.env
fi

# 7. Construir y levantar contenedores con Docker Compose
echo "🐳 Levantando servicios (Backend NestJS + Nginx)..."
docker compose down || true
docker compose build --pull
docker compose up -d --remove-orphans

# 8. Solicitar certificados SSL reales y gratuitos de Let's Encrypt
echo "🌐 Solicitando certificados SSL oficiales Let's Encrypt..."
docker run --rm \
    -v "$(pwd)/certbot/conf:/etc/letsencrypt" \
    -v "$(pwd)/certbot/www:/var/www/certbot" \
    certbot/certbot certonly --webroot -w /var/www/certbot \
    -d pidetelo.app -d www.pidetelo.app -d app.pidetelo.app -d api.pidetelo.app \
    --email pideteloadomicilio@gmail.com --agree-tos --non-interactive || {
        echo "⚠️ Nota: Si los DNS aún se están propagando, Certbot reintentará más tarde. Nginx sigue activo."
    }

# 9. Recargar Nginx con los certificados actualizados
docker compose exec -T nginx nginx -s reload || true

echo ""
echo "=========================================================="
echo "🎉 ¡PÍDETELO HA SIDO DESPLEGADO EXITOSAMENTE EN LA NUBE! 🎉"
echo "=========================================================="
echo "🌐 Landing Page Oficial : https://pidetelo.app"
echo "🌐 Web App Comercios    : https://app.pidetelo.app"
echo "🌐 API REST Backend     : https://api.pidetelo.app/api/docs"
echo "=========================================================="
echo ""
echo "Estado de los contenedores:"
docker compose ps
