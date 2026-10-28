#!/usr/bin/env python3
"""
SmartFile Cloud OS - Event-Driven File Processing System
Local Development & EC2 Production Lightweight Web Server
Zero external dependencies required (Pure Python 3 standard library).
Automatically loads configuration from .env file.
"""

import http.server
import socketserver
import os
import sys
import json
import mimetypes
from datetime import datetime

WEB_DIR = os.path.dirname(os.path.abspath(__file__))

def load_dotenv(env_path=os.path.join(WEB_DIR, ".env")):
    """Pure standard library .env parser and environment loader."""
    if os.path.isfile(env_path):
        try:
            with open(env_path, "r", encoding="utf-8") as f:
                for line in f:
                    line = line.strip()
                    if not line or line.startswith("#") or "=" not in line:
                        continue
                    key, val = line.split("=", 1)
                    key = key.strip()
                    val = val.strip().strip('"').strip("'")
                    if key and key not in os.environ:
                        os.environ[key] = val
            print(f"[SmartFile] Loaded environment configuration from: {env_path}")
        except Exception as e:
            print(f"[SmartFile] Warning: Could not parse .env file: {e}")

# Load .env variables immediately
load_dotenv()

PORT = int(os.environ.get("PORT", 5500))
HOST = os.environ.get("HOST", "0.0.0.0")

# Ensure proper mime types
mimetypes.add_type("application/javascript", ".js")
mimetypes.add_type("text/css", ".css")
mimetypes.add_type("image/svg+xml", ".svg")
mimetypes.add_type("application/json", ".json")

class SmartFileHTTPHandler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB_DIR, **kwargs)

    def end_headers(self):
        # Enable CORS and standard security headers
        self.send_header("Access-Control-Allow-Origin", "*")
        self.send_header("Access-Control-Allow-Methods", "GET, POST, OPTIONS, PUT, DELETE")
        self.send_header("Access-Control-Allow-Headers", "Content-Type, Authorization")
        self.send_header("Cache-Control", "no-cache, no-store, must-revalidate")
        super().end_headers()

    def do_OPTIONS(self):
        self.send_response(200)
        self.end_headers()

    def do_GET(self):
        # Health check endpoint for AWS EC2 ALB / Target Groups
        if self.path == "/health" or self.path == "/api/health":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            payload = {
                "status": "healthy",
                "service": "SmartFile Cloud OS",
                "environment": os.environ.get("ENVIRONMENT", "production"),
                "region": os.environ.get("AWS_REGION", "ap-south-1"),
                "timestamp": datetime.utcnow().isoformat() + "Z",
                "version": "2.5.0",
                "python_runtime": sys.version.split()[0],
                "aws_services_connected": {
                    "cognito": bool(os.environ.get("COGNITO_DOMAIN")),
                    "api_gateway": bool(os.environ.get("API_GATEWAY_URL")),
                    "s3": bool(os.environ.get("S3_BUCKET_NAME")),
                    "dynamodb": bool(os.environ.get("DYNAMODB_TABLE")),
                    "sns": bool(os.environ.get("SNS_TOPIC_ARN"))
                }
            }
            self.wfile.write(json.dumps(payload, indent=2).encode("utf-8"))
            return

        # Global AWS Config endpoint exposing .env configurations to frontend
        if self.path == "/api/config":
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.end_headers()
            config_payload = {
                "apiGatewayUrl": os.environ.get("API_GATEWAY_URL", "https://cmvqsknql8.execute-api.ap-south-1.amazonaws.com/upload-url"),
                "apiGatewayBaseUrl": os.environ.get("API_GATEWAY_BASE_URL", "https://cmvqsknql8.execute-api.ap-south-1.amazonaws.com"),
                "cognitoDomain": os.environ.get("COGNITO_DOMAIN", "https://ap-south-1tseppf54o.auth.ap-south-1.amazoncognito.com"),
                "cognitoClientId": os.environ.get("COGNITO_CLIENT_ID", "5i2dr38vicq331gb8gjcnjrgcl"),
                "cognitoUserPoolId": os.environ.get("COGNITO_USER_POOL_ID", "ap-south-1_tseppf54o"),
                "awsRegion": os.environ.get("AWS_REGION", "ap-south-1"),
                "s3BucketName": os.environ.get("S3_BUCKET_NAME", "smartfile-event-driven-bucket"),
                "s3UploadPrefix": os.environ.get("S3_UPLOAD_PREFIX", "uploads/"),
                "redirectUri": os.environ.get("REDIRECT_URI", f"http://localhost:{PORT}/index.html"),
                "dynamodbTable": os.environ.get("DYNAMODB_TABLE", "SmartFile_Metadata"),
                "snsTopicArn": os.environ.get("SNS_TOPIC_ARN", ""),
                "maxFileSizeBytes": int(os.environ.get("MAX_FILE_SIZE_BYTES", 524288000)),
                "demoMode": os.environ.get("SMARTFILE_DEMO_MODE", "false").lower() == "true"
            }
            self.wfile.write(json.dumps(config_payload, indent=2).encode("utf-8"))
            return

        # Root redirect to index.html
        if self.path == "/":
            self.path = "/index.html"

        return super().do_GET()

def run_server():
    os.chdir(WEB_DIR)
    socketserver.TCPServer.allow_reuse_address = True
    with socketserver.TCPServer((HOST, PORT), SmartFileHTTPHandler) as httpd:
        print("=" * 68)
        print("⚡ SMARTFILE CLOUD OS — AWS EVENT-DRIVEN FILE PROCESSING")
        print("=" * 68)
        print(f"📡 Server Status       : RUNNING")
        print(f"🌐 Local URL            : http://localhost:{PORT}")
        print(f"🌍 Host Binding        : http://{HOST}:{PORT}")
        print(f"🩺 Health Probe        : http://localhost:{PORT}/health")
        print(f"⚙️  AWS Config Endpoint : http://localhost:{PORT}/api/config")
        print(f"☁️  Target AWS Region   : {os.environ.get('AWS_REGION', 'ap-south-1')}")
        print(f"📦 Target S3 Bucket    : {os.environ.get('S3_BUCKET_NAME', 'smartfile-event-driven-bucket')}")
        print(f"🔐 Cognito Domain      : {os.environ.get('COGNITO_DOMAIN')}")
        print("=" * 68)
        print("Press Ctrl+C to terminate the server.\n")
        try:
            httpd.serve_forever()
        except KeyboardInterrupt:
            print("\nShutting down server cleanly...")
            httpd.server_close()

if __name__ == "__main__":
    run_server()
