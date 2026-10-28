# ==============================================================================
# SmartFile Cloud OS - EC2 Container Dockerfile
# Optimized for AWS EC2 t2.micro / t3.micro Free-Tier Instances (Ultra-Lightweight)
# ==============================================================================
FROM python:3.13-alpine

LABEL maintainer="Academic Project Team"
LABEL project="SmartFile Event-Driven Cloud File Processing"

WORKDIR /app

# Copy application files
COPY . /app

# Environment variables
ENV PORT=5500 \
    HOST=0.0.0.0 \
    PYTHONUNBUFFERED=1 \
    ENV=aws-ec2-production

# Expose standard application port
EXPOSE 5500

# Container health probe
HEALTHCHECK --interval=30s --timeout=5s --start-period=5s --retries=3 \
  CMD python -c "import urllib.request; sys_code = urllib.request.urlopen('http://localhost:5500/health').getcode(); exit(0 if sys_code == 200 else 1)"

# Start server
CMD ["python", "server.py"]

