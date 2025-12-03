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

#### 4. Create .dockerignore

Create a `.dockerignore` file to optimize build context and speed:

```
# Dependencies
node_modules
.pnp
.pnp.js

# Testing
coverage

# Next.js
.next/
out/
build

# Production
dist

# Misc
.DS_Store
*.pem

# Debug
npm-debug.log*
yarn-debug.log*
yarn-error.log*
pnpm-debug.log*

# Local env files
.env
.env*.local
.env.production

# Vercel
.vercel

# Typescript
*.tsbuildinfo
next-env.d.ts

# Git
.git
.gitignore

# Docker
Dockerfile*
docker-compose*

# IDE
.vscode
.idea

# Uploads
uploads/

# Package manager locks (we use pnpm)
package-lock.json
yarn.lock

# Cache directories
.cache
.turbo
```

This reduces the Docker build context from gigabytes to megabytes, significantly speeding up builds.

#### 5. Ensure public Directory Exists

Docker build expects a `public` directory. Create it if it doesn't exist:

```bash
mkdir -p public
```

#### 6. Create Production docker-compose.yml

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

#### 7. Build and Run

```bash
# Build the Docker image
docker compose -f docker-compose.prod.yml build

# Start services in detached mode
docker compose -f docker-compose.prod.yml up -d

# Check logs
docker compose -f docker-compose.prod.yml logs -f payload

# Visit http://your-server-ip:3000/admin to create admin user
```

**Important Notes:**
- The `.dockerignore` file significantly reduces build time by excluding unnecessary files
- The `public` directory must exist (can be empty)
- After adding plugins with client components, run `pnpm payload generate:importmap` before building
- The `output: 'standalone'` setting in `next.config.mjs` is required for Docker

#### 8. Setup Reverse Proxy

##### Option A: Nginx (Recommended)

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

##### Option B: Apache

Install and configure Apache:

```bash
sudo apt install apache2 -y

# Enable required modules
sudo a2enmod proxy proxy_http proxy_wstunnel rewrite ssl headers

# Create Apache configuration
sudo nano /etc/apache2/sites-available/babblingoadmin.conf
```

Add this configuration:

```apache
<VirtualHost *:80>
    ServerName admin.yourdomain.com
    
    # Increase upload limit
    LimitRequestBody 104857600
    
    # Proxy settings
    ProxyPreserveHost On
    ProxyRequests Off
    
    # WebSocket support
    RewriteEngine On
    RewriteCond %{HTTP:Upgrade} =websocket [NC]
    RewriteRule /(.*)           ws://localhost:3000/$1 [P,L]
    RewriteCond %{HTTP:Upgrade} !=websocket [NC]
    RewriteRule /(.*)           http://localhost:3000/$1 [P,L]
    
    # Proxy pass
    ProxyPass / http://localhost:3000/
    ProxyPassReverse / http://localhost:3000/
    
    # Headers
    RequestHeader set X-Forwarded-Proto "http"
    RequestHeader set X-Forwarded-Port "80"
    
    # Timeout settings
    ProxyTimeout 300
    
    # Logs
    ErrorLog ${APACHE_LOG_DIR}/babblingoadmin-error.log
    CustomLog ${APACHE_LOG_DIR}/babblingoadmin-access.log combined
</VirtualHost>
```

Enable the site:

```bash
# Enable site
sudo a2ensite babblingoadmin.conf

# Test configuration
sudo apache2ctl configtest

# Restart Apache
sudo systemctl restart apache2
```

#### 9. Setup SSL with Let's Encrypt

##### For Nginx:

```bash
# Install Certbot for Nginx
sudo apt install certbot python3-certbot-nginx -y

# Obtain and install certificate
sudo certbot --nginx -d admin.yourdomain.com

# Auto-renewal is configured by default; test it with:
sudo certbot renew --dry-run
```

##### For Apache:

```bash
# Install Certbot for Apache
sudo apt install certbot python3-certbot-apache -y

# Obtain and install certificate
sudo certbot --apache -d admin.yourdomain.com

# Auto-renewal is configured by default; test it with:
sudo certbot renew --dry-run
```

After SSL is configured, your Apache config will be automatically updated to include HTTPS on port 443.

#### 10. Maintenance Commands

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

#### 4. Setup Reverse Proxy (Same as Docker Option)

Follow step 8 from the Docker deployment section above. You can choose either Nginx (Option A) or Apache (Option B).

#### 5. Setup SSL (Same as Docker Option)

Follow step 9 from the Docker deployment section above (choose Nginx or Apache based on your reverse proxy choice).

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
- `pnpm run generate:importmap` – Generate importMap for client components (required after adding plugins)

---

## Project Notes

- The main Payload configuration lives in `src/payload.config.ts`.
- Generated TypeScript types are written to `src/payload-types.ts`.
- Media uploads are stored locally under `media/` during development. 

### Automated Transcription

The system supports automated transcription for Audio and Video modules using either OpenAI (Whisper) or Aliyun (Intelligent Speech Interaction). This allows for "Listen & Repeat" functionality where users can practice pronunciation against time-synced segments.

#### Configuration

1.  **Select Service**: Set `TRANSCRIPTION_SERVICE` in your `.env` file to either `openai` or `aliyun`.

#### Option A: OpenAI (Whisper)

Best for global deployments or where OpenAI is accessible.

1.  Get an API Key from [OpenAI Platform](https://platform.openai.com/).
2.  Set the environment variable:
    ```dotenv
    TRANSCRIPTION_SERVICE=openai
    OPENAI_API_KEY=sk-your-api-key
    ```

#### Option B: Aliyun (Intelligent Speech Interaction)

Required for deployments in Mainland China. Uses the "Recording File Recognition" service.

1.  **Activate Service**: Go to the [Aliyun Intelligent Speech Interaction Console](https://nls-portal.console.aliyun.com/).
2.  **Create Project**: Create a new project to get an **App Key**.
3.  **Get Credentials**: Ensure you have an AccessKey ID and Secret with permissions for Intelligent Speech Interaction (`AliyunNLSFullAccess` or custom policy).
4.  Set the environment variables:
    ```dotenv
    TRANSCRIPTION_SERVICE=aliyun
    # Use the same AccessKey as OSS or a different one
    ALIYUN_ACCESS_KEY_ID=your_access_key_id
    ALIYUN_ACCESS_KEY_SECRET=your_access_key_secret
    ALIYUN_APP_KEY=your_app_key_from_nls_console
    ```

### Media Storage in Production

**Local Storage (Default)**:
- Files stored in `media/` directory
- Ensure proper permissions: `chmod 755 media/`
- Setup regular backups of this directory
- For Docker: volume mount ensures persistence

**Cloud Storage (Recommended for Production)**:
- Configure S3-compatible storage (AWS S3, Alibaba Cloud OSS, Google Cloud Storage, etc.)
- Update Payload config to use cloud storage adapter
- Benefits: scalability, redundancy, CDN integration

#### Setting up Alibaba Cloud OSS (Aliyun)

Alibaba Cloud OSS is S3-compatible and widely used in China. Here's how to integrate it:

##### 1. Install Required Packages

```bash
cd /var/www/babblingoadmin/BabblinGoAdmin  # Or your project path
pnpm add @payloadcms/storage-s3
pnpm add @aws-sdk/client-s3 @aws-sdk/lib-storage
```

##### 2. Setup Aliyun OSS

1. **Create OSS Bucket**:
   - Log into [Aliyun Console](https://oss.console.aliyun.com/)
   - Create a new bucket (e.g., `babblingoadmin-media`)
   - Set ACL to "Private" or "Public Read" depending on your needs
   - Enable Cross-Origin Resource Sharing (CORS) if needed:
     ```json
     {
       "allowedOrigins": ["https://yourdomain.com"],
       "allowedMethods": ["GET", "POST", "PUT", "DELETE", "HEAD"],
       "allowedHeaders": ["*"],
       "exposeHeaders": [],
       "maxAgeSeconds": 3600
     }
     ```

2. **Create RAM User** (recommended for security):
   - Go to RAM console → Users → Create User
   - Enable "Programmatic Access"
   - Save the AccessKey ID and AccessKey Secret
   - Attach policy with OSS permissions:
     ```json
     {
       "Version": "1",
       "Statement": [
         {
           "Effect": "Allow",
           "Action": [
             "oss:PutObject",
             "oss:GetObject",
             "oss:DeleteObject",
             "oss:ListObjects"
           ],
           "Resource": [
             "acs:oss:*:*:babblingoadmin-media",
             "acs:oss:*:*:babblingoadmin-media/*"
           ]
         }
       ]
     }
     ```

3. **Get OSS Endpoint**:
   - Find your bucket endpoint in the OSS console (e.g., `oss-cn-hangzhou.aliyuncs.com`)
   - For public endpoint: `https://babblingoadmin-media.oss-cn-hangzhou.aliyuncs.com`
   - For internal endpoint (if app on Aliyun ECS): `https://babblingoadmin-media.oss-cn-hangzhou-internal.aliyuncs.com`

##### 3. Update Environment Variables

Add to your `.env`:

```bash
# Alibaba Cloud OSS Configuration
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=babblingoadmin-media
OSS_REGION=oss-cn-hangzhou
OSS_ENDPOINT=https://oss-cn-hangzhou.aliyuncs.com
# Public URL for accessing files
OSS_PUBLIC_URL=https://babblingoadmin-media.oss-cn-hangzhou.aliyuncs.com
# Or use CDN domain if configured
# OSS_PUBLIC_URL=https://cdn.yourdomain.com

# Optional: For custom domain with CDN
# OSS_CUSTOM_DOMAIN=cdn.yourdomain.com
```

##### 4. Update Payload Configuration

Edit `src/payload.config.ts`:

```typescript
import { buildConfig } from 'payload'
import { mongooseAdapter } from '@payloadcms/db-mongodb'
import { lexicalEditor } from '@payloadcms/richtext-lexical'
import { s3Storage } from '@payloadcms/storage-s3'

export default buildConfig({
  // ... your existing config

  plugins: [
    s3Storage({
      collections: {
        media: {
          generateFileURL: ({ filename }: { filename: string }) => {
            return `${process.env.OSS_PUBLIC_URL}/${filename}`
          },
        },
      },
      bucket: process.env.OSS_BUCKET!,
      config: {
        endpoint: process.env.OSS_ENDPOINT,
        region: process.env.OSS_REGION || 'oss-cn-hangzhou',
        credentials: {
          accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
          secretAccessKey: process.env.OSS_ACCESS_KEY_SECRET!,
        },
        forcePathStyle: false, // Use virtual-hosted-style URLs for OSS
      },
      acl: 'public-read', // or 'private' if using signed URLs
    }),
  ],

  // ... rest of your config
})
```

##### 5. Generate ImportMap

After adding the storage plugin, generate the importMap for client components:

```bash
pnpm payload generate:importmap
```

This creates `src/app/(payload)/admin/importMap.js` which maps client-side components from the storage plugin. This step is required for the S3 storage adapter to work properly.

**Important**: 
- Run this command whenever you add/remove plugins with client components
- Commit the generated `importMap.js` file to your repository
- If using Docker, restart the container after generating: `docker compose restart payload`

##### 6. Alternative: Using OSS SDK Directly

If you need more control or want to use native Aliyun OSS SDK:

```bash
pnpm add ali-oss
```

Create custom adapter in `src/lib/oss-adapter.ts`:

```typescript
import OSS from 'ali-oss'

const client = new OSS({
  region: process.env.OSS_REGION!,
  accessKeyId: process.env.OSS_ACCESS_KEY_ID!,
  accessKeySecret: process.env.OSS_ACCESS_KEY_SECRET!,
  bucket: process.env.OSS_BUCKET!,
})

export const ossAdapter = {
  async handleUpload({ file, filename }) {
    try {
      const result = await client.put(filename, file.buffer)
      return {
        filename,
        url: result.url,
        mimeType: file.mimetype,
        filesize: file.size,
      }
    } catch (error) {
      console.error('OSS upload error:', error)
      throw error
    }
  },

  async handleDelete({ filename }) {
    try {
      await client.delete(filename)
    } catch (error) {
      console.error('OSS delete error:', error)
      throw error
    }
  },

  staticURL: process.env.OSS_PUBLIC_URL,
}
```

##### 7. CDN Configuration (Optional but Recommended)

For better performance, especially for global users:

1. **Enable Aliyun CDN**:
   - Go to CDN console
   - Add domain name (e.g., `cdn.yourdomain.com`)
   - Set origin to your OSS bucket
   - Configure cache rules (recommended: cache images for 7-30 days)
   - Enable compression

2. **Update DNS**:
   - Add CNAME record: `cdn.yourdomain.com` → your CDN CNAME

3. **Update `.env`**:
   ```bash
   OSS_PUBLIC_URL=https://cdn.yourdomain.com
   ```

##### 8. Migration from Local to OSS

If you have existing local media files:

```bash
# Install ossutil (Aliyun's CLI tool)
wget http://gosspublic.alicdn.com/ossutil/1.7.15/ossutil64
chmod 755 ossutil64
sudo mv ossutil64 /usr/local/bin/ossutil

# Configure ossutil
ossutil config

# Sync local media to OSS
ossutil cp -r ./media/ oss://babblingoadmin-media/ --update

# Verify upload
ossutil ls oss://babblingoadmin-media/
```

Then update your database to point to new URLs:

```javascript
// migrate-media-urls.js
import { MongoClient } from 'mongodb'

const client = await MongoClient.connect(process.env.DATABASE_URI)
const db = client.db()
const mediaCollection = db.collection('media')

const ossPublicUrl = process.env.OSS_PUBLIC_URL

// Update all media documents
const result = await mediaCollection.updateMany(
  {},
  {
    $set: {
      url: {
        $concat: [ossPublicUrl, '/', '$filename']
      }
    }
  }
)

console.log(`Updated ${result.modifiedCount} media documents`)
await client.close()
```

##### 9. Testing OSS Integration

```bash
# Rebuild and restart
pnpm run build

# For Docker
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d

# For PM2
pm2 restart babblingoadmin

# Test upload via admin panel
# Go to http://yourdomain.com/admin/collections/media
# Upload a test file and verify it appears in OSS console
```

##### 10. OSS Backup Strategy

```bash
#!/bin/bash
# /usr/local/bin/backup-oss.sh

BACKUP_DIR="/backup/oss"
DATE=$(date +%Y%m%d)
BUCKET="babblingoadmin-media"

mkdir -p $BACKUP_DIR

# Download all files from OSS
ossutil cp -r oss://$BUCKET/ $BACKUP_DIR/backup-$DATE/ --update

# Keep only last 30 days
find $BACKUP_DIR -type d -mtime +30 -exec rm -rf {} \;

echo "OSS backup completed: $BACKUP_DIR/backup-$DATE"
```

Add to crontab:
```bash
sudo crontab -e
# Add: 0 3 * * 0 /usr/local/bin/backup-oss.sh  # Weekly on Sunday at 3 AM
```

##### 11. Cost Optimization Tips

- **Enable lifecycle rules**: Auto-delete old/unused files
- **Use infrequent access storage**: For files accessed < 1 time/month
- **Enable image processing**: Resize images on-the-fly to save bandwidth
  ```
  https://yourbucket.oss-cn-hangzhou.aliyuncs.com/image.jpg?x-oss-process=image/resize,w_800
  ```
- **Monitor usage**: Set billing alerts in Aliyun console
- **CDN caching**: Reduce OSS requests and egress costs

##### 12. Troubleshooting OSS

**Upload fails with "Access Denied"**:
- Check RAM user permissions
- Verify AccessKey ID and Secret
- Ensure bucket ACL allows writes

**Files not accessible publicly**:
- Check bucket ACL (should be "Public Read" for public files)
- Or use signed URLs if bucket is private:
  ```typescript
  const signedUrl = client.signatureUrl('filename.jpg', { expires: 3600 })
  ```

**Slow uploads from outside China**:
- Use OSS Transfer Acceleration (extra cost)
- Or deploy app server in same region as OSS

**CORS errors in browser**:
- Configure CORS in OSS console
- Add your domain to allowed origins

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
