# ☁️ SmartFile Cloud OS — Intelligent Event-Driven File Processing on AWS

> **Academic Capstone Project & Production Cloud Pipeline**  
> An Awwwards-grade, high-throughput cloud file ingestion and serverless processing architecture built on Amazon Web Services (AWS) and deployed on Amazon EC2.

---

## 🌟 Architecture Highlights

SmartFile Cloud OS eliminates the classic cloud bottleneck: **server bandwidth saturation**. Instead of routing heavy file uploads through the application server (EC2), it leverages a **decoupled, serverless event-driven architecture**:

```
[ Client Browser ] 
       │ 
       ├─► (1) Authenticate via PKCE ────────► [ Amazon Cognito User Pool ]
       │                                              │ (Returns JWT ID Token)
       ├─► (2) POST /upload-url ─────────────► [ Amazon API Gateway ]
       │        (Bearer JWT)                          │ (Generates IAM Pre-Signed URL)
       │                                              ▼
       └─► (3) Direct Binary PUT ────────────► [ Amazon S3 Bucket ]
                                                      │
                                                      │ (4) s3:ObjectCreated:Put Trigger
                                                      ▼
                                             [ AWS Lambda Worker ]
                                                      │
                                      ┌───────────────┴───────────────┐
                                      ▼                               ▼
                             [ Amazon DynamoDB ]             [ Amazon SNS Topic ]
                             (Metadata & Status)             (Pub/Sub Alerts)
```

1. **Amazon Cognito User Pool**: Secure client authentication using OAuth 2.0 with PKCE (Proof Key for Code Exchange, RFC 7636) without exposing client secrets.
2. **Amazon API Gateway (REST API)**: Authenticated gateway endpoint that verifies the JWT token and creates short-lived, cryptographically signed **Amazon S3 Pre-Signed URLs**.
3. **Amazon S3 (Simple Storage Service)**: Direct browser-to-bucket ingestion, bypassing EC2 and reducing server CPU/network load by **100%**.
4. **AWS Lambda**: Asynchronous event-driven serverless worker triggered instantly when a file lands in S3. Computes checksums, parses MIME types, and extracts metadata.
5. **Amazon DynamoDB**: Low-latency NoSQL database persisting file records, security scan status, and audit trails.
6. **Amazon SNS (Simple Notification Service)**: Multi-channel pub/sub notification service broadcasting processing completion alerts to subscribers.
7. **Amazon EC2 (Elastic Compute Cloud)**: High-performance production host running Nginx reverse proxy, automated systemd service, and health monitoring endpoints (`/health`).

---

## 🚀 Quick Start (Local Development)

The application runs seamlessly with **zero external dependencies** using Python 3:

```bash
# 1. Navigate to the project directory
cd "c:\Users\adyas\OneDrive\Desktop\Smart file system"

# 2. Start the local server on Port 5500
python server.py
```

Open your browser at:  
👉 **`http://localhost:5500`**

*(Port 5500 matches the pre-configured AWS Cognito Callback Redirect URL).*

---

## 🚢 Deploying to AWS EC2

### Option A: Automated One-Click Bootstrap (`deploy-ec2.sh`)

1. **Launch an EC2 Instance**:
   - AMI: **Amazon Linux 2023** or **Ubuntu 24.04 LTS**
   - Instance Type: **t2.micro** or **t3.micro** (Free-tier eligible)
   - Security Group: Allow inbound traffic on **Port 22** (SSH), **Port 80** (HTTP), and **Port 5500**.
2. **SSH into your EC2 Instance**:
   ```bash
   ssh -i your-key.pem ec2-user@<YOUR-EC2-PUBLIC-IP>
   ```
3. **Copy project files or clone repository to EC2**:
   ```bash
   git clone <YOUR-REPO-URL> /opt/smartfile
   cd /opt/smartfile
   ```
4. **Run the Automated Deploy Script**:
   ```bash
   chmod +x deploy-ec2.sh
   ./deploy-ec2.sh
   ```
5. **Access the live app**:
   - Direct: `http://<YOUR-EC2-PUBLIC-IP>:5500`
   - Nginx Proxy: `http://<YOUR-EC2-PUBLIC-IP>`
   - Health Probe: `http://<YOUR-EC2-PUBLIC-IP>/health`

---

### Option B: Docker & Docker Compose on EC2

```bash
# Build and run the production container in the background
docker-compose up -d --build

# View container status and health probe
docker ps
docker-compose logs -f
```

---

## ⚙️ Critical AWS Cognito Configuration Step

To allow OAuth2 authentication to succeed on EC2:
1. Open the **AWS Cognito Console** → Select your User Pool.
2. Under **App Integration** → **App Clients** → Select `5i2dr38vicq331gb8gjcnjrgcl`.
3. Under **Hosted UI Settings** → **Allowed Callback URLs**, add:
   - `http://<YOUR-EC2-PUBLIC-IP>:5500/index.html`
   - `http://<YOUR-EC2-PUBLIC-IP>/index.html`
4. Save changes.

> **💡 Offline / Viva Presentation Mode:**  
> If demonstrating offline or without active AWS internet access, click the **Settings icon (⚙️)** in the top right of the UI and enable **Hybrid Demo / Simulation Mode**. The app will run the full 5-stage pipeline with realistic latencies, CloudWatch telemetry streams, and DynamoDB mock indexing!

---

## 📁 Repository Structure

```
Smart file system/
├── index.html                  # Awwwards-Level Modern Cyber Glass UI Single-Page Application
├── login.html                  # Dedicated AWS Cognito login portal
├── css/
│   └── main.css                # Obsidian glassmorphism styling, animations & theme
├── js/
│   ├── app.js                  # Master application controller, drag & drop, file registry
│   ├── aws-service.js          # Cognito PKCE, API Gateway, S3 pre-signed upload, SHA-256
│   ├── pipeline-visualizer.js  # Dynamic 5-stage AWS pipeline stepper & animations
│   ├── particle-background.js  # Sleek interactive particle network on HTML5 canvas
│   └── telemetry-console.js    # Real-time CloudWatch terminal HUD emulator
├── lambda/
│   ├── s3_processor.py         # Production AWS Lambda backend (S3 -> DynamoDB -> SNS)
│   └── requirements.txt        # Boto3 SDK requirement
├── server.py                   # Production & local Python web server (Port 5500)
├── Dockerfile                  # Production container configuration
├── docker-compose.yml          # Container orchestration with health check
├── nginx.conf                  # Production EC2 Nginx reverse proxy configuration
├── deploy-ec2.sh               # One-click automated EC2 bootstrap script
├── VIVA_CHEATSHEET.md          # Complete Academic Viva Voce Question & Answer Guide
├── ARCHITECTURE.md             # Detailed AWS Cloud Architecture Specification
└── README.md                   # This documentation guide
```

---

## 🎓 Academic Viva & Evaluation Reference
See [`VIVA_CHEATSHEET.md`](VIVA_CHEATSHEET.md) for 10+ core examiner questions covering architectural trade-offs, security, scalability, and AWS pricing models.

