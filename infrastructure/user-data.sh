#!/bin/bash

# EC2 User Data Script for Node.js Application Setup
# This script runs on instance startup to configure the environment

set -e

# Update system packages
apt-get update -y
apt-get upgrade -y

# Install essential packages
apt-get install -y curl wget git unzip awscli

# Install Node.js 18.x (LTS)
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt-get install -y nodejs

# Install PM2 for process management
npm install -g pm2

# Install CloudWatch agent
wget https://s3.amazonaws.com/amazoncloudwatch-agent/ubuntu/amd64/latest/amazon-cloudwatch-agent.deb
dpkg -i amazon-cloudwatch-agent.deb
rm amazon-cloudwatch-agent.deb

# Create application directory
mkdir -p /opt/git-commit-ai
cd /opt/git-commit-ai

# Create a basic Express.js health check server
cat > server.js << 'EOF'
const express = require('express');
const app = express();
const port = 3000;

app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

app.get('/', (req, res) => {
  res.status(200).json({ 
    message: 'Git Commit AI - Infrastructure Ready',
    version: '1.0.0',
    timestamp: new Date().toISOString()
  });
});

app.listen(port, '0.0.0.0', () => {
  console.log(`Server running on port ${port}`);
});
EOF

# Create package.json
cat > package.json << 'EOF'
{
  "name": "git-commit-ai-infrastructure",
  "version": "1.0.0",
  "description": "Infrastructure health check server",
  "main": "server.js",
  "scripts": {
    "start": "node server.js"
  },
  "dependencies": {
    "express": "^4.18.2"
  }
}
EOF

# Install dependencies
npm install

# Create PM2 ecosystem file
cat > ecosystem.config.js << 'EOF'
module.exports = {
  apps: [{
    name: 'git-commit-ai',
    script: 'server.js',
    instances: 1,
    exec_mode: 'cluster',
    env: {
      NODE_ENV: 'production',
      PORT: 3000
    },
    log_file: '/var/log/git-commit-ai/app.log',
    out_file: '/var/log/git-commit-ai/out.log',
    error_file: '/var/log/git-commit-ai/error.log',
    pid_file: '/var/run/git-commit-ai.pid'
  }]
};
EOF

# Create log directory
mkdir -p /var/log/git-commit-ai

# Set proper permissions
chown -R ubuntu:ubuntu /opt/git-commit-ai
chown -R ubuntu:ubuntu /var/log/git-commit-ai

# Start the application with PM2
sudo -u ubuntu pm2 start ecosystem.config.js

# Save PM2 configuration
sudo -u ubuntu pm2 save

# Setup PM2 startup script
sudo -u ubuntu pm2 startup systemd -u ubuntu --hp /home/ubuntu

# Configure CloudWatch agent
cat > /opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json << 'EOF'
{
  "agent": {
    "metrics_collection_interval": 60,
    "run_as_user": "cwagent"
  },
  "logs": {
    "logs_collected": {
      "files": {
        "collect_list": [
          {
            "file_path": "/var/log/git-commit-ai/app.log",
            "log_group_name": "/aws/ec2/git-commit-ai",
            "log_stream_name": "{instance_id}/app.log",
            "timezone": "UTC"
          },
          {
            "file_path": "/var/log/git-commit-ai/error.log",
            "log_group_name": "/aws/ec2/git-commit-ai",
            "log_stream_name": "{instance_id}/error.log",
            "timezone": "UTC"
          }
        ]
      }
    }
  },
  "metrics": {
    "namespace": "CWAgent",
    "metrics_collected": {
      "cpu": {
        "measurement": [
          "cpu_usage_idle",
          "cpu_usage_iowait",
          "cpu_usage_user",
          "cpu_usage_system"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ],
        "totalcpu": false
      },
      "disk": {
        "measurement": [
          "used_percent"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "diskio": {
        "measurement": [
          "io_time",
          "read_bytes",
          "write_bytes",
          "reads",
          "writes"
        ],
        "metrics_collection_interval": 60,
        "resources": [
          "*"
        ]
      },
      "mem": {
        "measurement": [
          "mem_used_percent"
        ],
        "metrics_collection_interval": 60
      },
      "netstat": {
        "measurement": [
          "tcp_established",
          "tcp_time_wait"
        ],
        "metrics_collection_interval": 60
      },
      "swap": {
        "measurement": [
          "swap_used_percent"
        ],
        "metrics_collection_interval": 60
      }
    }
  }
}
EOF

# Start CloudWatch agent
/opt/aws/amazon-cloudwatch-agent/bin/amazon-cloudwatch-agent-ctl \
  -a fetch-config -m ec2 -s \
  -c file:/opt/aws/amazon-cloudwatch-agent/etc/amazon-cloudwatch-agent.json

# Enable and start services
systemctl enable amazon-cloudwatch-agent
systemctl start amazon-cloudwatch-agent

# Create a simple deployment script for future use
cat > /opt/git-commit-ai/deploy.sh << 'EOF'
#!/bin/bash
# Simple deployment script for git-commit-ai application
# This can be used to deploy the actual application code

set -e

echo "Stopping application..."
pm2 stop git-commit-ai || true

echo "Backing up current application..."
if [ -d "/opt/git-commit-ai-backup" ]; then
    rm -rf /opt/git-commit-ai-backup
fi
cp -r /opt/git-commit-ai /opt/git-commit-ai-backup

echo "Deployment script ready. Replace this with actual deployment logic."
echo "Remember to:"
echo "1. Pull/copy new application code"
echo "2. Install dependencies (npm install)"
echo "3. Run any build steps"
echo "4. Update PM2 configuration if needed"
echo "5. Restart application (pm2 restart git-commit-ai)"

pm2 start git-commit-ai
EOF

chmod +x /opt/git-commit-ai/deploy.sh

# Log completion
echo "$(date): EC2 user data script completed successfully" >> /var/log/user-data.log

# Signal completion (optional - for CloudFormation or other orchestration)
echo "Infrastructure setup complete!"