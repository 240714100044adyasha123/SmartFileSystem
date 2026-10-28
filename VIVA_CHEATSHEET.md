# 🎓 SmartFile Cloud OS — Academic Viva Voce Cheatsheet

This cheatsheet prepares you to answer every technical question during project evaluation, external viva examinations, and project demos.

---

## 📌 1. Project Synopsis in 60 Seconds
> *"SmartFile Cloud OS is an enterprise-grade, event-driven cloud file processing architecture built on AWS and deployed on Amazon EC2. The project's primary engineering objective is solving the classic cloud file upload bottleneck: server bandwidth saturation and blocking I/O. Instead of funneling multi-megabyte payloads through our EC2 compute instance, the client authenticates via Amazon Cognito OAuth2 with PKCE, requests a short-lived IAM Pre-Signed URL from Amazon API Gateway, and uploads binary data directly into Amazon S3. Upon object arrival, Amazon S3 asynchronously fires an event trigger into an AWS Lambda worker, which extracts file metadata, validates cryptographic integrity via SHA-256, persists the audit record into Amazon DynamoDB, and broadcasts notifications via Amazon SNS. The entire management UI is served from an optimized EC2 instance with an Nginx reverse proxy."*

---

## 📌 2. Top 10 Core Viva Questions & Expert Answers

### Q1: Why not upload files directly through the EC2 instance?
**Examiner's Angle:** Testing your understanding of cloud architecture scalability and resource bottlenecks.  
**Answer:**  
If clients upload directly to EC2:
1. **Network Saturation:** File streams consume the EC2 instance's network interface bandwidth, degrading throughput for other HTTP clients.
2. **Compute Thread Starvation:** The EC2 web server process must hold an active TCP connection and I/O buffer open for the entire duration of the upload, exhausting thread pools.
3. **Double Hop Overhead:** EC2 would need to re-upload the received file to S3 anyway, doubling latency and network egress costs.  
*Solution:* Direct-to-S3 pre-signed uploads bypass EC2 completely, giving us **infinite horizontal upload scalability** with zero EC2 performance degradation.

---

### Q2: What is a Pre-Signed S3 URL and how is it secure?
**Examiner's Angle:** Testing your security and IAM knowledge.  
**Answer:**  
An Amazon S3 Pre-Signed URL grants temporary write permission to a client without requiring AWS credentials in the frontend code.
- **How it works:** Our backend/API Gateway uses an IAM role with `s3:PutObject` permission to sign a cryptographically hashed URL using AWS Signature Version 4 (SigV4).
- **Security controls:**
  - Strict Time-To-Live (TTL): Expires in 15 minutes (900 seconds).
  - Specific Object Key: Only valid for the specific file name requested.
  - Strict Content-Type enforcement: The upload fails if the payload MIME type doesn't match the signature.

---

### Q3: What is PKCE and why is it used with Amazon Cognito?
**Examiner's Angle:** Testing OAuth2/IAM knowledge.  
**Answer:**  
PKCE stands for **Proof Key for Code Exchange (RFC 7636)**.
- In traditional authorization code flow, a server exchanges the code using a `client_secret`.
- In Single Page Applications (SPAs) running in the browser, a `client_secret` cannot be kept secret because frontend code is publicly inspectable.
- With PKCE:
  1. The browser generates a cryptographically random `code_verifier` (32 bytes).
  2. The browser computes `SHA-256(verifier)` called `code_challenge` and sends it to Cognito.
  3. When Cognito returns the authorization code, the browser sends the original `code_verifier` to exchange for the JWT `id_token`.
  4. Cognito hashes the verifier and compares it against the stored challenge. This prevents authorization code interception attacks.

---

### Q4: Why choose AWS Lambda over a long-running EC2 background worker?
**Examiner's Angle:** Serverless vs. Provisioned Compute.  
**Answer:**  
1. **Cost Optimization:** EC2 instances bill per hour 24/7 regardless of whether files are uploading. Lambda charges only for the exact execution duration (measured in milliseconds) with 1 million free requests/month.
2. **Auto-Scaling:** If 1,000 files are uploaded simultaneously, S3 triggers 1,000 isolated Lambda container microVMs concurrently. An EC2 instance would require complex queueing, auto-scaling groups, and load balancers.
3. **Decoupled Architecture:** Processing logic is completely separated from web serving.

---

### Q5: Why is Amazon DynamoDB chosen instead of a relational database (e.g. MySQL/RDS)?
**Examiner's Angle:** Database design patterns.  
**Answer:**  
1. **Single-digit millisecond latency:** DynamoDB is a fully managed NoSQL key-value store optimized for ultra-fast document retrieval.
2. **Schema Flexibility:** Different file formats (PDFs, images, archives) generate diverse metadata schemas (e.g., image dimensions vs. PDF page counts). DynamoDB handles flexible JSON documents effortlessly.
3. **Serverless Scaling:** DynamoDB auto-scales read and write capacity on demand to match Lambda execution bursts without connection pooling limits.

---

### Q6: How does Amazon SNS work in this system?
**Examiner's Angle:** Pub/Sub messaging paradigms.  
**Answer:**  
Amazon SNS (Simple Notification Service) acts as a **Publish/Subscribe (Pub/Sub) broadcast hub**:
- Lambda acts as the **Publisher**, pushing an event notification to the `SmartFile_Notifications` topic.
- Multiple **Subscribers** (e.g., student email addresses, SMS endpoints, or other Lambda microservices) receive the message simultaneously without coupling to each other.

---

### Q7: What is the purpose of Amazon EC2 in this project if S3 and Lambda are serverless?
**Examiner's Angle:** Role of infrastructure components.  
**Answer:**  
Amazon EC2 serves as the **central dedicated application host**:
1. Serves the web application assets via a production-grade **Nginx reverse proxy** with HTTP caching, security headers, and compression.
2. Houses automated **systemd daemons** ensuring 99.99% uptime and automatic restart upon reboot.
3. Provides a dedicated health probe (`/health`) for AWS Application Load Balancers (ALBs) and monitoring tools.
4. Provides an administrative boundary where organization-level policies, VPC gateways, and firewalls can be enforced.

---

### Q8: What happens if a file upload fails midway?
**Answer:**  
- Because pre-signed URLs are time-limited, incomplete requests are discarded.
- In Amazon S3, **S3 Lifecycle Rules** can be configured with `AbortIncompleteMultipartUpload`, automatically deleting lingering chunks after 7 days to eliminate storage costs.
- The client receives an HTTP error code (e.g., 403 Forbidden or network timeout) and logs the failure in our CloudWatch HUD.

---

### Q9: How does the system verify file integrity before and after upload?
**Answer:**  
1. **Client-side:** The browser uses the Web Crypto API (`window.crypto.subtle.digest`) to calculate an SHA-256 hash of the binary file before transmission.
2. **S3 verification:** Amazon S3 computes an **ETag** (MD5 checksum or multi-part hash) upon ingestion.
3. **Lambda verification:** The Lambda processor inspects the S3 ETag and hashes the object to confirm no data corruption occurred in transit.

---

### Q10: How do you handle AWS free-tier cost management?
**Answer:**  
- S3: Standard storage tier within 5 GB free limit.
- Lambda: Well within 1,000,000 free invocations and 3.2 million seconds of compute time per month.
- Cognito: 50,000 Monthly Active Users (MAUs) free tier.
- DynamoDB: 25 GB free storage and 25 Write/Read capacity units.
- EC2: t2.micro / t3.micro within the 750 hours/month free tier allowance.
- **Simulation Mode:** Our app includes a built-in Hybrid Demo Mode so evaluation can run offline without consuming a single AWS credit!

