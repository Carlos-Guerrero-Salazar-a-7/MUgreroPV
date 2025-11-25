# Guía de Despliegue en DigitalOcean Droplet

Sigue estos pasos para desplegar tu proyecto **SF3PWM** en un Droplet de DigitalOcean.

## 1. Crear el Droplet
1. Entra a tu cuenta de DigitalOcean.
2. Crea un nuevo Droplet.
3. Elige la imagen **Ubuntu 22.04 (LTS)** o **24.04 (LTS)**.
4. Elige el plan (Basic, Regular SSD, $6/mes es suficiente para empezar).
5. Selecciona tu región más cercana.
6. Configura tu autenticación (SSH Key recomendada o Password).
7. Crea el Droplet y copia su **Dirección IP**.

## 2. Preparar y Subir los Archivos
Desde tu computadora local (donde tienes el código fuente), abre una terminal en la carpeta del proyecto.

### Opción A: Usando SCP (Recomendado)
Primero, comprime los archivos de tu proyecto (excluyendo carpetas pesadas que se reinstalarán):

```bash
# En tu terminal local (Linux/Mac/Git Bash)
tar --exclude='node_modules' --exclude='vendor' --exclude='.git' -czf sf3pwm.tar.gz .
```

Luego, sube el archivo comprimido al servidor:

```bash
# Reemplaza 123.45.67.89 con la IP de tu Droplet
scp sf3pwm.tar.gz root@123.45.67.89:~
```

### Opción B: Usando Git
Si tienes tu código en GitHub/GitLab:
1. Conéctate al servidor (`ssh root@IP`).
2. Clona tu repositorio: `git clone https://github.com/tu-usuario/tu-repo.git sf3pwm`.

## 3. Instalación en el Servidor
1. Conéctate a tu Droplet por SSH:
   ```bash
   ssh root@123.45.67.89
   ```

2. Si usaste la **Opción A (SCP)**, descomprime el proyecto:
   ```bash
   mkdir sf3pwm
   tar -xzf sf3pwm.tar.gz -C sf3pwm
   cd sf3pwm
   ```

3. Ejecuta el script de instalación automática:
   ```bash
   chmod +x deployment/setup.sh
   ./deployment/setup.sh
   ```

Este script se encargará de:
- Instalar Nginx, PHP 8.2, MySQL, Node.js y NPM.
- Configurar la base de datos y usuarios.
- Instalar dependencias del proyecto (Composer y NPM).
- Configurar el servidor web y el proxy para el juego.
- Iniciar el servidor de juego con PM2.

## 4. Finalización
Al terminar, el script te mostrará la URL de tu juego.
- **Web:** `http://TU_IP_PUBLICA`
- **Juego:** El WebSocket estará activo automáticamente.

### Comandos Útiles
- **Ver logs del juego:** `pm2 logs`
- **Reiniciar servidor de juego:** `pm2 restart all`
- **Ver estado de Nginx:** `systemctl status nginx`
