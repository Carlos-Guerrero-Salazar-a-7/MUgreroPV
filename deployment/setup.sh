#!/bin/bash

# Colores para output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}=== Iniciando instalación de SF3PWM en DigitalOcean ===${NC}"

# Verificar root
if [ "$EUID" -ne 0 ]; then 
  echo "❌ Por favor ejecuta este script como root (sudo)"
  exit
fi

# 1. Actualizar sistema e instalar dependencias
echo -e "${GREEN}📦 1. Actualizando sistema e instalando dependencias...${NC}"
apt update
# Instalar dependencias básicas y repositorio PHP
apt install -y software-properties-common
add-apt-repository ppa:ondrej/php -y
apt update

# Instalar PHP y extensiones
apt install -y nginx mysql-server php8.2 php8.2-fpm php8.2-mysql php8.2-xml php8.2-mbstring php8.2-curl php8.2-zip unzip git curl

# Instalar Node.js (versión 20.x LTS)
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi

# Instalar Composer
if ! command -v composer &> /dev/null; then
    curl -sS https://getcomposer.org/installer | php
    mv composer.phar /usr/local/bin/composer
fi

# Instalar PM2
npm install -g pm2

# 2. Configurar Base de Datos
echo -e "${GREEN}🗄️ 2. Configurando Base de Datos MySQL...${NC}"
DB_NAME="sf3pwm_db"
DB_USER="sf3pwm_user"
DB_PASS=$(openssl rand -base64 12)

# Crear DB y Usuario (Silenciosamente)
mysql -e "CREATE DATABASE IF NOT EXISTS ${DB_NAME};"
mysql -e "CREATE USER IF NOT EXISTS '${DB_USER}'@'localhost' IDENTIFIED BY '${DB_PASS}';"
mysql -e "GRANT ALL PRIVILEGES ON ${DB_NAME}.* TO '${DB_USER}'@'localhost';"
mysql -e "FLUSH PRIVILEGES;"

echo "✅ Base de datos configurada."

# 3. Configurar Proyecto
echo -e "${GREEN}📂 3. Configurando archivos del proyecto...${NC}"
PROJECT_DIR="/var/www/sf3pwm"
CURRENT_DIR=$(pwd)

# Mover archivos si no estamos ya en el directorio destino
if [ "$CURRENT_DIR" != "$PROJECT_DIR" ]; then
    echo "Moviendo archivos a $PROJECT_DIR..."
    mkdir -p $PROJECT_DIR
    cp -r ./* $PROJECT_DIR/
    cp .env.example $PROJECT_DIR/.env.example 2>/dev/null || true
    cp package.json $PROJECT_DIR/ 2>/dev/null || true
    cd $PROJECT_DIR
fi

# Configurar .env
if [ ! -f .env ]; then
    cp .env.example .env
fi

# Obtener IP pública
PUBLIC_IP=$(curl -s ifconfig.me)

# Actualizar .env usando sed
# Usamos | como delimitador para evitar problemas con / en URLs
sed -i "s|DB_DATABASE=.*|DB_DATABASE=${DB_NAME}|" .env
sed -i "s|DB_USERNAME=.*|DB_USERNAME=${DB_USER}|" .env
sed -i "s|DB_PASSWORD=.*|DB_PASSWORD='${DB_PASS}'|" .env
sed -i "s|APP_URL=.*|APP_URL=http://${PUBLIC_IP}|" .env
sed -i "s|APP_ENV=.*|APP_ENV=production|" .env
sed -i "s|APP_DEBUG=.*|APP_DEBUG=false|" .env

# Instalar dependencias PHP
echo "Instalando dependencias de PHP..."
composer install --no-dev --optimize-autoloader

# Generar Key
php artisan key:generate

# Migraciones
echo "Ejecutando migraciones..."
php artisan migrate --force

# Instalar dependencias Node y construir assets
echo "Instalando dependencias de Node y construyendo assets..."
npm install
npm run build

# 4. Configurar Permisos
echo -e "${GREEN}🔒 4. Ajustando permisos...${NC}"
chown -R www-data:www-data $PROJECT_DIR
chmod -R 775 $PROJECT_DIR/storage $PROJECT_DIR/bootstrap/cache

# 5. Configurar Nginx
echo -e "${GREEN}🌐 5. Configurando Nginx...${NC}"
cp deployment/nginx.conf /etc/nginx/sites-available/sf3pwm
# Actualizar server_name en nginx config
sed -i "s/server_name _;/server_name ${PUBLIC_IP};/" /etc/nginx/sites-available/sf3pwm

ln -sf /etc/nginx/sites-available/sf3pwm /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default

# Configurar Firewall (UFW)
echo "Configurando Firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

nginx -t
if [ $? -eq 0 ]; then
    systemctl restart nginx
else
    echo "❌ Error en la configuración de Nginx."
fi

# 6. Iniciar Servidor de Juego con PM2
echo -e "${GREEN}🚀 6. Iniciando servidor de juego...${NC}"
pm2 start deployment/ecosystem.config.js
pm2 save
pm2 startup | grep "sudo" | bash # Ejecutar el comando que sugiere PM2

echo -e "${BLUE}=== ¡Instalación Completada! ===${NC}"
echo -e "✅ Web: http://${PUBLIC_IP}"
echo -e "✅ Base de Datos: ${DB_NAME} / Usuario: ${DB_USER} / Pass: ${DB_PASS}"
echo -e "⚠️  Guarda la contraseña de la base de datos en un lugar seguro."
