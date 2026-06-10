# Deploying Arcade to a VPS with HTTPS

## Prerequisites

- A VPS running Ubuntu 22.04+ (Hetzner, OVH, DigitalOcean, etc.)
- A domain name pointed at your VPS IP (A record: `yourdomain.com` → VPS IP)
- Docker and Docker Compose installed on the VPS

## 1. Install Docker on VPS

```bash
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER
newgrp docker
```

## 2. Clone the repository

```bash
git clone <your-repo-url> /opt/arcade
cd /opt/arcade
```

## 3. Configure environment

```bash
cp apps/server/.env.example apps/server/.env
# Edit with your values:
nano apps/server/.env
```

Required values for production:
- `ADMIN_TOKEN` — a long random string: `openssl rand -hex 32`
- `CLIENT_ORIGIN` — your domain: `https://yourdomain.com`
- `REDIS_URL` — `redis://redis:6379` (as in docker-compose)

## 4. Configure the web build URL

Create a `.env` file at the repo root:
```
VITE_SERVER_URL=https://yourdomain.com
```

## 5. Start the stack

```bash
docker compose up -d --build
```

## 6. Install nginx and certbot (on the VPS host, outside Docker)

```bash
sudo apt install nginx certbot python3-certbot-nginx -y
```

## 7. Configure nginx as reverse proxy

Create `/etc/nginx/sites-available/arcade`:
```nginx
server {
    listen 80;
    server_name yourdomain.com;

    location /socket.io/ {
        proxy_pass http://localhost:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_cache_bypass $http_upgrade;
    }

    location /api/ {
        proxy_pass http://localhost:4000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
    }

    location / {
        proxy_pass http://localhost:80;
        proxy_set_header Host $host;
    }
}
```

```bash
sudo ln -s /etc/nginx/sites-available/arcade /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
```

## 8. Get SSL certificate

```bash
sudo certbot --nginx -d yourdomain.com
```

Certbot will automatically modify the nginx config to add HTTPS and redirect HTTP → HTTPS.

## 9. Socket.IO with HTTPS

Socket.IO works over HTTPS/WSS automatically when the client connects to `https://yourdomain.com`. The `CLIENT_ORIGIN` on the server must match exactly: `https://yourdomain.com`.

## 10. Auto-renewal

Certbot installs a systemd timer that renews certificates automatically. Verify:

```bash
sudo systemctl status certbot.timer
```

## 11. Update deployment

```bash
cd /opt/arcade
git pull
docker compose up -d --build
```

## Port summary

| Port | Service | Exposed to |
|------|---------|------------|
| 4000 | Node.js server | nginx proxy only (not public) |
| 80 | nginx / web app | public (redirected to 443) |
| 443 | nginx HTTPS | public |
| 6379 | Redis | internal Docker network only |
