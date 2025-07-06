# Deployment Guide

This guide covers deploying the AI Git Commit Generator to various platforms, with a focus on AWS EC2.

## AWS EC2 Deployment

### Prerequisites

- AWS account with EC2 access
- SSH key pair for EC2 access
- Domain name (optional, for custom domain)
- SSL certificate (optional, for HTTPS)

### Step 1: Launch EC2 Instance

1. **Launch a new EC2 instance**
   - AMI: Ubuntu 22.04 LTS
   - Instance type: t3.micro (or larger for production)
   - Security group: Allow SSH (22), HTTP (80), HTTPS (443), and custom port (3000)
   - Key pair: Select your SSH key pair

2. **Configure security group rules**
   ```
   SSH (22)     - Your IP only
   HTTP (80)    - 0.0.0.0/0 (if using reverse proxy)
   HTTPS (443)  - 0.0.0.0/0 (if using reverse proxy)
   Custom (3000) - 0.0.0.0/0 (direct access) or 127.0.0.1/32 (reverse proxy only)
   ```

### Step 2: Server Setup

1. **Connect to your instance**
   ```bash
   ssh -i your-key.pem ubuntu@your-ec2-ip
   ```

2. **Update system packages**
   ```bash
   sudo apt update
   sudo apt upgrade -y
   ```

3. **Install Node.js and npm**
   ```bash
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs
   
   # Verify installation
   node --version
   npm --version
   ```

4. **Install PM2 for process management**
   ```bash
   sudo npm install -g pm2
   ```

5. **Install Git**
   ```bash
   sudo apt install -y git
   ```

### Step 3: Application Deployment

1. **Clone the repository**
   ```bash
   git clone <your-repository-url>
   cd git-commit-ai
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.example .env
   nano .env
   ```
   
   Configure your environment:
   ```env
   OPENAI_API_KEY=your_openai_api_key_here
   PORT=3000
   NODE_ENV=production
   ```

4. **Build the application**
   ```bash
   npm run build
   ```

5. **Start with PM2**
   ```bash
   pm2 start ecosystem.config.js
   pm2 startup
   pm2 save
   ```

   Create `ecosystem.config.js`:
   ```javascript
   module.exports = {
     apps: [{
       name: 'git-commit-ai',
       script: 'backend/dist/index.js',
       cwd: '/home/ubuntu/git-commit-ai',
       env: {
         NODE_ENV: 'production',
         PORT: 3000
       },
       instances: 1,
       exec_mode: 'cluster',
       watch: false,
       max_memory_restart: '1G',
       error_file: './logs/err.log',
       out_file: './logs/out.log',
       log_file: './logs/combined.log',
       time: true
     }]
   };
   ```

### Step 4: Nginx Setup (Optional)

1. **Install Nginx**
   ```bash
   sudo apt install -y nginx
   ```

2. **Configure Nginx**
   ```bash
   sudo nano /etc/nginx/sites-available/git-commit-ai
   ```
   
   Add configuration:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;  # Replace with your domain
       
       # Serve static files
       location / {
           root /home/ubuntu/git-commit-ai/frontend/dist;
           try_files $uri $uri/ /index.html;
       }
       
       # API proxy
       location /api {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
           proxy_cache_bypass $http_upgrade;
       }
       
       # Health check
       location /health {
           proxy_pass http://localhost:3000;
           proxy_set_header Host $host;
           proxy_set_header X-Real-IP $remote_addr;
           proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
           proxy_set_header X-Forwarded-Proto $scheme;
       }
   }
   ```

3. **Enable the site**
   ```bash
   sudo ln -s /etc/nginx/sites-available/git-commit-ai /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl restart nginx
   ```

### Step 5: SSL Certificate (Optional)

1. **Install Certbot**
   ```bash
   sudo apt install -y certbot python3-certbot-nginx
   ```

2. **Obtain SSL certificate**
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

3. **Set up auto-renewal**
   ```bash
   sudo crontab -e
   # Add this line:
   0 12 * * * /usr/bin/certbot renew --quiet
   ```

### Step 6: Monitoring and Logging

1. **View application logs**
   ```bash
   pm2 logs git-commit-ai
   ```

2. **Monitor application status**
   ```bash
   pm2 status
   pm2 monit
   ```

3. **Set up log rotation**
   ```bash
   pm2 install pm2-logrotate
   ```

## Docker Deployment

### Prerequisites

- Docker and Docker Compose installed
- OpenAI API key

### Step 1: Create Docker Files

1. **Backend Dockerfile**
   ```dockerfile
   FROM node:18-alpine
   
   WORKDIR /app
   
   COPY backend/package*.json ./
   RUN npm ci --only=production
   
   COPY backend/dist ./dist
   
   EXPOSE 3000
   
   CMD ["node", "dist/index.js"]
   ```

2. **Frontend Dockerfile**
   ```dockerfile
   FROM node:18-alpine as builder
   
   WORKDIR /app
   COPY frontend/package*.json ./
   RUN npm ci
   
   COPY frontend/ ./
   RUN npm run build
   
   FROM nginx:alpine
   COPY --from=builder /app/dist /usr/share/nginx/html
   COPY nginx.conf /etc/nginx/nginx.conf
   
   EXPOSE 80
   ```

3. **Docker Compose**
   ```yaml
   version: '3.8'
   
   services:
     backend:
       build:
         context: .
         dockerfile: backend/Dockerfile
       environment:
         - NODE_ENV=production
         - OPENAI_API_KEY=${OPENAI_API_KEY}
         - PORT=3000
       ports:
         - "3000:3000"
       restart: unless-stopped
   
     frontend:
       build:
         context: .
         dockerfile: frontend/Dockerfile
       ports:
         - "80:80"
       depends_on:
         - backend
       restart: unless-stopped
   ```

### Step 2: Deploy with Docker

```bash
# Build and start services
docker-compose up -d

# View logs
docker-compose logs -f

# Stop services
docker-compose down
```

## Environment Variables

### Production Environment Variables

```env
# Required
OPENAI_API_KEY=your_openai_api_key_here

# Optional
NODE_ENV=production
PORT=3000
```

### Security Considerations

1. **API Key Security**
   - Never commit API keys to version control
   - Use environment variables or secure secret management
   - Rotate keys regularly

2. **Server Security**
   - Keep system packages updated
   - Use firewall rules to limit access
   - Implement fail2ban for SSH protection
   - Use strong SSH keys, disable password authentication

3. **Application Security**
   - Enable HTTPS in production
   - Set up proper CORS policies
   - Monitor for suspicious activity
   - Implement proper rate limiting

## Troubleshooting

### Common Issues

1. **Port Already in Use**
   ```bash
   sudo lsof -i :3000
   sudo kill -9 <PID>
   ```

2. **PM2 Process Not Starting**
   ```bash
   pm2 logs
   pm2 restart all
   ```

3. **Nginx Configuration Issues**
   ```bash
   sudo nginx -t
   sudo systemctl status nginx
   sudo tail -f /var/log/nginx/error.log
   ```

4. **SSL Certificate Issues**
   ```bash
   sudo certbot certificates
   sudo certbot renew --dry-run
   ```

5. **Out of Memory**
   - Increase EC2 instance size
   - Add swap space
   - Optimize application memory usage

### Health Checks

1. **Application Health**
   ```bash
   curl http://localhost:3000/health
   ```

2. **Frontend Serving**
   ```bash
   curl http://localhost/
   ```

3. **API Endpoint**
   ```bash
   curl -X POST http://localhost:3000/api/generate-commit \
     -H "Content-Type: application/json" \
     -d '{"diff": "sample diff content"}'
   ```

### Monitoring

1. **System Resources**
   ```bash
   htop
   df -h
   free -h
   ```

2. **Application Metrics**
   ```bash
   pm2 monit
   pm2 status
   ```

3. **Logs**
   ```bash
   pm2 logs --lines 100
   sudo tail -f /var/log/nginx/access.log
   ```

## Backup and Recovery

### Application Backup

```bash
# Backup application files
tar -czf backup-$(date +%Y%m%d).tar.gz /home/ubuntu/git-commit-ai

# Backup environment configuration
cp .env .env.backup
```

### Database Backup (if applicable)

```bash
# If using a database, add backup commands here
```

### Recovery Process

1. **Restore application files**
   ```bash
   tar -xzf backup-YYYYMMDD.tar.gz
   ```

2. **Restore environment**
   ```bash
   cp .env.backup .env
   ```

3. **Restart services**
   ```bash
   pm2 restart all
   sudo systemctl restart nginx
   ```

## Scaling Considerations

### Horizontal Scaling

1. **Load Balancer Setup**
   - Use AWS Application Load Balancer
   - Configure health checks
   - Set up auto-scaling groups

2. **Multiple Instances**
   - Deploy to multiple EC2 instances
   - Use shared storage for static files
   - Configure session management

### Vertical Scaling

1. **Instance Sizing**
   - Monitor CPU and memory usage
   - Upgrade instance type as needed
   - Add more RAM for better performance

2. **Application Optimization**
   - Implement response caching
   - Optimize database queries
   - Use CDN for static assets

## Cost Optimization

1. **AWS Cost Management**
   - Use AWS Cost Explorer
   - Set up billing alerts
   - Consider Reserved Instances

2. **OpenAI API Costs**
   - Monitor token usage
   - Implement request caching
   - Set usage limits

3. **Resource Optimization**
   - Use appropriate instance sizes
   - Implement auto-shutdown for dev environments
   - Regular cost reviews