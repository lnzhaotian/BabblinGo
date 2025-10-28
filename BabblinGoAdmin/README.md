# BabblinGo Admin (Payload CMS)

This directory hosts the Payload CMS instance that replaces the legacy NestJS backend. It exposes both the admin UI and APIs consumed by the BabblinGo frontend.

## Requirements

- Node.js 20.9+ if you plan to run the app directly
- Docker Desktop with Docker Compose v2 (recommended for local development)
- MongoDB 5.0+ (for production deployment)

## Table of Contents

- [Local Development](#local-development)
- [Production Deployment](#production-deployment)
  - [Option 1: Docker Deployment (Recommended)](#option-1-docker-deployment-recommended)
  - [Option 2: Manual Deployment](#option-2-manual-deployment)
- [Useful Scripts](#useful-scripts)
- [Project Notes](#project-notes)

---

## Local Development

### Environment Setup

1. Copy the sample environment file:
   ```bash
   cp .env.example .env
   ```
2. Adjust `PAYLOAD_SECRET` and any integration credentials as needed.
3. The default `DATABASE_URI` points to the MongoDB service defined in `docker-compose.yml` (`mongodb://mongo/BabblinGoAdmin`). Update it only if you use an external database.

### Running with Docker (Recommended)

```bash
docker compose up payload
```

The `payload` service depends on the `mongo` service, so the command above starts both containers. When the stack is up, visit `http://localhost:3000/admin` and follow the prompts to create the first admin user.

Stop the services with:

```bash
docker compose down
```

### Running without Docker

1. Ensure you have MongoDB running locally and update `DATABASE_URI` accordingly (for example `mongodb://127.0.0.1/BabblinGoAdmin`).
2. Install dependencies: `npm install`
3. Start the dev server: `npm run dev`

---

## Production Deployment

### Prerequisites

Before deploying to production, ensure:

1. **Domain & DNS**: Point your domain to your server's IP address
2. **Server Access**: SSH access with sudo privileges
3. **Firewall**: Ports 80, 443 (HTTP/HTTPS) and optionally 22 (SSH) open
4. **SSL Certificate**: Use Let's Encrypt (via Certbot) or your certificate provider

---

### Option 1: Docker Deployment (Recommended)

This approach uses Docker Compose with production-optimized images and persistent volumes.

#### 1. Prepare Your Server

```bash
# Update system packages
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Add your user to docker group (optional, to run without sudo)
sudo usermod -aG docker $USER
newgrp docker

# Install Docker Compose plugin
sudo apt install docker-compose-plugin -y
```

#### 2. Clone and Configure

```bash
# Clone your repository
git clone https://github.com/yourusername/BabblinGo.git
cd BabblinGo/BabblinGoAdmin

# Create production environment file
cp .env.example .env
nano .env
```

Edit `.env` with production values:

```bash
DATABASE_URI=mongodb://mongo/BabblinGoAdmin
PAYLOAD_SECRET=your_strong_random_secret_here_min_32_chars
NODE_ENV=production

# Optional: Add S3 or cloud storage credentials if not using local media
# AWS_ACCESS_KEY_ID=...
# AWS_SECRET_ACCESS_KEY=...
# AWS_BUCKET_NAME=...
```

**Important**: Generate a strong `PAYLOAD_SECRET`:
```bash
openssl rand -base64 32
```

#### 3. Update next.config.mjs for Production

Ensure `output: 'standalone'` is set in your `next.config.mjs`:

```javascript
import { withPayload } from '@payloadcms/next/withPayload'

const nextConfig = {
  output: 'standalone', // Required for Docker production builds
  webpack: (webpackConfig) => {
    webpackConfig.resolve.extensionAlias = {
      '.cjs': ['.cts', '.cjs'],
      '.js': ['.ts', '.tsx', '.js', '.jsx'],
      '.mjs': ['.mts', '.mjs'],
    }
    return webpackConfig
  },
}

export default withPayload(nextConfig, { devBundleServerPackages: false })
```

#### 4. Create Production docker-compose.yml

Create `docker-compose.prod.yml`:

```yaml
services:
  payload:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: babblingoadmin-app
    restart: unless-stopped
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=production
    env_file:
      - .env
    depends_on:
      - mongo
    volumes:
      - ./media:/app/media
    networks:
      - babblingoadmin

  mongo:
    image: mongo:latest
    container_name: babblingoadmin-mongo
    restart: unless-stopped
    ports:
      - "127.0.0.1:27017:27017"  # Bind to localhost only
    command:
      - --storageEngine=wiredTiger
    volumes:
      - mongo_data:/data/db
    networks:
      - babblingoadmin

networks:
  babblingoadmin:
    driver: bridge

volumes:
  mongo_data:
```

#### 5. Build and Run

```bash
# Build the Docker image
docker compose -f docker-compose.prod.yml build

# Start services in detached mode
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f payload

# Visit http://your-server-ip:3000/admin to create admin user
```

#### 6. Setup Nginx Reverse Proxy

Install and configure Nginx:

```bash
sudo apt install nginx -y

# Create Nginx configuration
sudo nano /etc/nginx/sites-available/babblingoadmin
```

Add this configuration:

```nginx
server {
    listen 80;
    server_name admin.yourdomain.com;

    client_max_body_size 100M;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 300s;
        proxy_connect_timeout 75s;
    }
}
```

Enable the site:

```bash
# Create symlink
sudo ln -s /etc/nginx/sites-available/babblingoadmin /etc/nginx/sites-enabled/

# Test configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

#### 7. Setup SSL with Let's Encrypt

```bash
# Install Certbot
sudo apt install certbot python3-certbot-nginx -y

# Obtain and install certificate
sudo certbot --nginx -d admin.yourdomain.com

# Auto-renewal is configured by default; test it with:
sudo certbot renew --dry-run
```

#### 8. Maintenance Commands

```bash
# View logs
docker compose -f docker-compose.prod.yml logs -f

# Restart services
docker compose -f docker-compose.prod.yml restart

# Stop services
docker compose -f docker-compose.prod.yml down

# Update application (after git pull)
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# Backup MongoDB
docker exec babblingoadmin-mongo mongodump --out=/data/backup
docker cp babblingoadmin-mongo:/data/backup ./backup-$(date +%Y%m%d)

# Restore MongoDB
docker cp ./backup-20250101 babblingoadmin-mongo:/data/restore
docker exec babblingoadmin-mongo mongorestore /data/restore
```

---

### Option 2: Manual Deployment

This approach runs the app directly with Node.js and MongoDB installed on your server.

#### 1. Install Dependencies

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 20.x
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs

# Install build tools
sudo apt install -y build-essential

# Install pnpm globally
sudo npm install -g pnpm

# Install MongoDB (Ubuntu/Debian)
wget -qO - https://www.mongodb.org/static/pgp/server-7.0.asc | sudo apt-key add -
echo "deb [ arch=amd64,arm64 ] https://repo.mongodb.org/apt/ubuntu $(lsb_release -cs)/mongodb-org/7.0 multiverse" | sudo tee /etc/apt/sources.list.d/mongodb-org-7.0.list
sudo apt update
sudo apt install -y mongodb-org

# Start and enable MongoDB
sudo systemctl start mongod
sudo systemctl enable mongod
```

#### 2. Clone and Build Application

```bash
# Create app directory
sudo mkdir -p /var/www/babblingoadmin
sudo chown $USER:$USER /var/www/babblingoadmin

# Clone repository
cd /var/www
git clone https://github.com/yourusername/BabblinGo.git babblingoadmin
cd babblingoadmin/BabblinGoAdmin

# Install dependencies
pnpm install

# Create production environment
cp .env.example .env
nano .env
```

Set production environment variables in `.env`:

```bash
DATABASE_URI=mongodb://localhost:27017/BabblinGoAdmin
PAYLOAD_SECRET=your_strong_random_secret_here
NODE_ENV=production
PORT=3000
```

Ensure `next.config.mjs` has `output: 'standalone'` (see Docker section above).

```bash
# Build the application
pnpm run build
```

#### 3. Setup Process Manager with PM2

```bash
# Install PM2
sudo npm install -g pm2

# Create PM2 ecosystem file
nano ecosystem.config.cjs
```

Add this configuration:

```javascript
module.exports = {
  apps: [{
    name: 'babblingoadmin',
    script: 'node',
    args: 'server.js',
    cwd: '/var/www/babblingoadmin/BabblinGoAdmin/.next/standalone',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    error_file: '/var/log/babblingoadmin/error.log',
    out_file: '/var/log/babblingoadmin/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
  }]
}
```

```bash
# Create log directory
sudo mkdir -p /var/log/babblingoadmin
sudo chown $USER:$USER /var/log/babblingoadmin

# Start application with PM2
pm2 start ecosystem.config.cjs

# Setup PM2 to start on boot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs babblingoadmin
```

#### 4. Setup Nginx (Same as Docker Option)

Follow step 6 from the Docker deployment section above.

#### 5. Setup SSL (Same as Docker Option)

Follow step 7 from the Docker deployment section above.

#### 6. Maintenance Commands

```bash
# Application updates
cd /var/www/babblingoadmin/BabblinGoAdmin
git pull
pnpm install
pnpm run build
pm2 restart babblingoadmin

# View logs
pm2 logs babblingoadmin
pm2 logs babblingoadmin --lines 100

# Restart application
pm2 restart babblingoadmin

# Stop application
pm2 stop babblingoadmin

# Backup MongoDB
mongodump --db BabblinGoAdmin --out ~/backups/mongo-$(date +%Y%m%d)

# Restore MongoDB
mongorestore --db BabblinGoAdmin ~/backups/mongo-20250101/BabblinGoAdmin
```

---

## Useful Scripts

- `pnpm run dev` – Start the Next.js dev server
- `pnpm run build` – Create a production build
- `pnpm run start` – Run the production build (standalone mode)
- `pnpm run lint` – Lint the project with ESLint
- `pnpm run test` – Execute unit and end-to-end tests
- `pnpm run generate:types` – Regenerate Payload TypeScript definitions

---

## Project Notes

- The main Payload configuration lives in `src/payload.config.ts`.
- Generated TypeScript types are written to `src/payload-types.ts`.
- Media uploads are stored locally under `media/` during development. 

### Media Storage in Production

**Local Storage (Default)**:
- Files stored in `media/` directory
- Ensure proper permissions: `chmod 755 media/`
- Setup regular backups of this directory
- For Docker: volume mount ensures persistence

**Cloud Storage (Recommended for Production)**:
- Configure S3, Google Cloud Storage, or similar
- Update Payload config to use cloud storage adapter
- Benefits: scalability, redundancy, CDN integration

### Database Backups

**Automated Backup Script** (add to cron):

```bash
#!/bin/bash
# /usr/local/bin/backup-mongo.sh

BACKUP_DIR="/backup/mongo"
DATE=$(date +%Y%m%d-%H%M%S)

mkdir -p $BACKUP_DIR

# For Docker deployment
docker exec babblingoadmin-mongo mongodump --out=/data/backup
docker cp babblingoadmin-mongo:/data/backup $BACKUP_DIR/backup-$DATE

# For manual deployment
# mongodump --db BabblinGoAdmin --out $BACKUP_DIR/backup-$DATE

# Keep only last 7 days
find $BACKUP_DIR -type d -mtime +7 -exec rm -rf {} \;

echo "Backup completed: $BACKUP_DIR/backup-$DATE"
```

Add to crontab:
```bash
sudo crontab -e
# Add: 0 2 * * * /usr/local/bin/backup-mongo.sh
```

### Monitoring and Logs

**For Docker**:
```bash
docker compose -f docker-compose.prod.yml logs -f payload
docker stats
```

**For PM2**:
```bash
pm2 monit
pm2 logs babblingoadmin --lines 100
```

### Troubleshooting

**Port already in use**:
```bash
# Find process using port 3000
sudo lsof -i :3000
# Kill process
sudo kill -9 <PID>
```

**MongoDB connection issues**:
```bash
# Check MongoDB status
sudo systemctl status mongod
# Check MongoDB logs
sudo tail -f /var/log/mongodb/mongod.log
```

**Nginx issues**:
```bash
# Test configuration
sudo nginx -t
# Check logs
sudo tail -f /var/log/nginx/error.log
```

**Out of memory during build**:
```bash
# Increase Node memory limit (already set in package.json)
# Or add swap space:
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
```

### Security Recommendations

1. **Firewall**: Use `ufw` to restrict access
   ```bash
   sudo ufw allow 22/tcp
   sudo ufw allow 80/tcp
   sudo ufw allow 443/tcp
   sudo ufw enable
   ```

2. **MongoDB**: Bind to localhost only (already configured in prod compose file)

3. **Environment Variables**: Never commit `.env` to git

4. **Regular Updates**: Keep system packages, Node.js, and dependencies updated

5. **Strong Secrets**: Use strong random values for `PAYLOAD_SECRET`

6. **CORS**: Configure allowed origins in Payload config for API access

7. **Rate Limiting**: Consider adding rate limiting middleware
