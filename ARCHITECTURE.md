# 📐 SmartFile Cloud OS — System Architecture Specification

## 1. Architectural Overview

SmartFile Cloud OS is designed on the principles of **Decoupled Event-Driven Microservices** and **Zero-Trust Client Ingestion**.

```
+-----------------------------------------------------------------------------------+
|                           CLIENT ENVIRONMENT (Browser)                            |
|                                                                                   |
|   1. Computes SHA-256 Checksum via Web Crypto API                                 |
|   2. Obtains OAuth2 Bearer Token via Amazon Cognito PKCE                          |
|   3. Requests Presigned PUT URL via Amazon API Gateway                            |
|   4. Streams binary data directly to Amazon S3                                   |
+-----------------------------------------+-----------------------------------------+
                                          |
                      Direct Binary PUT   | Pre-Signed URL Request
                                          v
+-----------------------+   +-------------------------------------------------------+
|   AMAZON S3 BUCKET    |   |                  AMAZON API GATEWAY                   |
|                       |   |                                                       |
| • Bucket Policy       |   | • POST /upload-url                                    |
| • CORS Rules          |   | • Cognito Authorizer Validation                       |
| • Event Notification  |   | • Generates IAM Signed S3 URL with SigV4             |
+-----------+-----------+   +-------------------------------------------------------+
            |
            | Asynchronous s3:ObjectCreated:Put Trigger
            v
+-----------------------------------------------------------------------------------+
|                        AWS LAMBDA SERVERLESS PROCESSOR                            |
|                                                                                   |
| • Parses S3 Bucket and Object Key                                                 |
| • Fetches Object Metadata (s3.head_object)                                        |
| • Classifies File Category (Document, Image, Code, Archive, Data)                 |
| • Inserts Audit Record into Amazon DynamoDB                                       |
| • Dispatches Event Notification to Amazon SNS Topic                               |
| • Emits Execution Telemetry to Amazon CloudWatch Logs                             |
+-----------------------------------------+-----------------------------------------+
                                          |
                        +-----------------+-----------------+
                        |                                   |
                        v                                   v
+---------------------------------------+   +---------------------------------------+
|          AMAZON DYNAMODB              |   |              AMAZON SNS               |
|                                       |   |                                       |
| • Table: SmartFile_Metadata           |   | • Topic: SmartFile_Alerts             |
| • Partition Key: file_id              |   | • Protocol: Email, SMS, Webhook       |
| • Attributes: size, mime, etag, hash  |   | • Multi-subscriber broadcast          |
+---------------------------------------+   +---------------------------------------+

+-----------------------------------------------------------------------------------+
|                         AMAZON EC2 HOSTING ENVIRONMENT                            |
|                                                                                   |
| • Systemd Service: smartfile.service (Python 3 Web Server on Port 5500)            |
| • Reverse Proxy: Nginx on Port 80 with Gzip compression and security headers     |
| • Health Probe: /health returning 200 OK for Load Balancer Target Groups         |
| • Serves modern Obsidian Glass UI & interactive telemetry console                 |
+-----------------------------------------------------------------------------------+
```

---

## 2. AWS Services Matrix

| Service | Architecture Role | Key Benefit |
| :--- | :--- | :--- |
| **Amazon Cognito** | Identity & Access Management | Eliminates backend user database; OAuth2 with PKCE ensures secure SPA login. |
| **Amazon API Gateway** | API Facade & Authorizer | Controls access to URL signing lambda; terminates HTTPS and manages throttling. |
| **Amazon S3** | Object Storage Repository | 99.999999999% durability; handles massive concurrent file ingestion with zero server load. |
| **AWS Lambda** | Asynchronous Event Processor | Serverless execution on demand; charges only for active runtime in milliseconds. |
| **Amazon DynamoDB** | Persistent Metadata Registry | Ultra-fast single-digit millisecond NoSQL storage with schema flexibility. |
| **Amazon SNS** | Push Notification Service | Decoupled fanout messaging alerting downstream consumers and email subscribers. |
| **Amazon EC2** | Application Host & Nginx Proxy | Dedicated compute host with systemd reliability and health check probes. |
| **Amazon CloudWatch** | Centralized Telemetry & Logging | Aggregates execution metrics, latencies, and system logs into one audit trail. |

---

## 3. End-to-End Sequence Diagram

```
Browser               Cognito         API Gateway           S3              Lambda           DynamoDB / SNS
   │                     │                 │                 │                 │                   │
   │── 1. OAuth2 PKCE ──►│                 │                 │                 │                   │
   │◄── 2. ID Token ─────│                 │                 │                 │                   │
   │                                       │                 │                 │                   │
   │── 3. POST /upload-url (Bearer Token) ─►                 │                 │                   │
   │◄── 4. Pre-Signed PUT URL ─────────────│                 │                 │                   │
   │                                                         │                 │                   │
   │── 5. PUT Binary Payload directly to S3 ────────────────►│                 │                   │
   │◄── 6. HTTP 200 OK (ETag confirmation) ──────────────────│                 │                   │
   │                                                         │                 │                   │
   │                                                         │── 7. Trigger ──►│                   │
   │                                                         │   (s3:Created)  │                   │
   │                                                         │                 │── 8. PutItem ────►│
   │                                                         │                 │── 9. Publish ────►│
```

