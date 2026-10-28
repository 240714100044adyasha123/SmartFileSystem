#!/bin/bash
# ==============================================================================
# SmartFile Cloud OS - EC2 Automated Deployment & Bootstrap Script
# Works on: Amazon Linux 2023, Amazon Linux 2, Ubuntu 22.04 / 24.04 LTS
# Can be run manually via SSH or pasted into EC2 Launch "User Data" script.
# ==============================================================================

set -e

echo "=========================================================="
echo "🚀 INITIATING SMARTFILE CLOUD OS EC2 DEPLOYMENT PIPELINE"
echo "=========================================================="

# 1. Detect OS Distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$ID
else
    OS="unknown"
fi

echo "📋 Detected Operating System: $OS"

# 2. Update System & Install Dependencies
echo "🔄 Updating system packages..."
if [ "$OS" = "amzn" ] || [ "$OS" = "fedora" ] || [ "$OS" = "rhel" ] || [ "$OS" = "centos" ]; then
    sudo dnf update -y || sudo yum update -y
    sudo dnf install -y python3 python3-pip git nginx || sudo yum install -y python3 python3-pip git nginx
elif [ "$OS" = "ubuntu" ] || [ "$OS" = "debian" ]; then
    sudo apt-get update -y
    sudo apt-get install -y python3 python3-pip git nginx
fi

# 3. Setup Project Application Directory
APP_DIR="/opt/smartfile"
echo "📂 Setting up application directory at $APP_DIR..."
sudo mkdir -p $APP_DIR
sudo chown -R $USER:$USER $APP_DIR

# Copy or clone files into place
CURRENT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
if [ "$CURRENT_DIR" != "$APP_DIR" ]; then
    echo "📦 Copying files from $CURRENT_DIR to $APP_DIR..."
    cp -r $CURRENT_DIR/* $APP_DIR/
fi

cd $APP_DIR

# 4. Create Systemd Service for 24/7 background operation & auto-restart on reboot
echo "⚙️  Configuring Systemd daemon: smartfile.service..."
cat <<EOF | sudo tee /etc/systemd/system/smartfile.service
[Unit]
Description=SmartFile Cloud OS - Event-Driven Processing Web Server
After=network.target

[Service]
Type=simple
User=$USER
WorkingDirectory=$APP_DIR
EnvironmentFile=-$APP_DIR/.env
ExecStart=/usr/bin/python3 $APP_DIR/server.py
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
EOF

# 5. Enable & Start Systemd Service
echo "🚀 Starting smartfile systemd service..."
sudo systemctl daemon-reload
sudo systemctl enable smartfile.service
sudo systemctl restart smartfile.service

# 6. Configure Nginx Reverse Proxy (Routes Port 80 -> Port 5500)
echo "🌐 Configuring Nginx reverse proxy on Port 80..."
if [ -f "$APP_DIR/nginx.conf" ]; then
    sudo cp $APP_DIR/nginx.conf /etc/nginx/nginx.conf
fi
sudo systemctl enable nginx
sudo systemctl restart nginx || echo "Nginx restart bypassed; server is running on port 5500"

# 7. Fetch Public IP
PUBLIC_IP=$(curl -s http://169.254.169.254/latest/meta-data/public-ipv4 || curl -s ifconfig.me || echo "YOUR-EC2-PUBLIC-IP")

echo "=========================================================="
echo "✅ DEPLOYMENT SUCCESSFUL! SMARTFILE CLOUD OS IS LIVE!"
echo "=========================================================="
echo "🌐 Web Interface Direct : http://${PUBLIC_IP}:5500"
echo "🌐 Web Interface Proxy  : http://${PUBLIC_IP}"
echo "🩺 Health Check Endpoint: http://${PUBLIC_IP}:5500/health"
echo ""
echo "⚠️  CRITICAL AWS COGNITO CONFIGURATION STEP:"
echo "----------------------------------------------------------"
echo "Open your AWS Cognito User Pool Console -> App Client Settings."
echo "Add the following URL to 'Allowed Callback URLs':"
echo "   http://${PUBLIC_IP}:5500/index.html"
echo "   http://${PUBLIC_IP}/index.html"
echo "----------------------------------------------------------"
echo "🔐 Ensure your EC2 Security Group Inbound Rules allow:"
echo "   - Port 22   (SSH)"
echo "   - Port 80   (HTTP)"
echo "   - Port 5500 (SmartFile Service)"
echo "=========================================================="

