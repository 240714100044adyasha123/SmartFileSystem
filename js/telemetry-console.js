/**
 * SmartFile Cloud OS - Real-Time AWS Telemetry & CloudWatch Stream HUD
 */

class TelemetryConsole {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.logStream = [];
        this.autoScroll = true;
        this.filter = 'ALL';
    }

    log(service, message, type = 'info', metadata = null) {
        const timestamp = new Date().toISOString().split('T')[1].replace('Z', '');
        const entry = {
            id: 'evt-' + Math.random().toString(36).substring(2, 9),
            timestamp,
            service: service.toUpperCase(),
            message,
            type, // info, success, warning, error, aws
            metadata
        };

        this.logStream.push(entry);
        if (this.logStream.length > 300) {
            this.logStream.shift();
        }

        this.renderEntry(entry);
    }

    renderEntry(entry) {
        if (!this.container) return;
        if (this.filter !== 'ALL' && entry.service !== this.filter) return;

        const row = document.createElement('div');
        row.className = `log-row log-${entry.type}`;
        row.setAttribute('data-service', entry.service);

        let serviceBadgeClass = 'badge-general';
        if (entry.service.includes('COGNITO')) serviceBadgeClass = 'badge-cognito';
        else if (entry.service.includes('GATEWAY')) serviceBadgeClass = 'badge-gateway';
        else if (entry.service.includes('S3')) serviceBadgeClass = 'badge-s3';
        else if (entry.service.includes('LAMBDA')) serviceBadgeClass = 'badge-lambda';
        else if (entry.service.includes('DYNAMO')) serviceBadgeClass = 'badge-dynamo';
        else if (entry.service.includes('SNS')) serviceBadgeClass = 'badge-sns';
        else if (entry.service.includes('EC2')) serviceBadgeClass = 'badge-ec2';

        let metaHtml = '';
        if (entry.metadata) {
            metaHtml = `<pre class="log-meta">${escapeHtml(JSON.stringify(entry.metadata, null, 2))}</pre>`;
        }

        row.innerHTML = `
            <span class="log-time">${entry.timestamp}</span>
            <span class="log-badge ${serviceBadgeClass}">${entry.service}</span>
            <span class="log-msg">${escapeHtml(entry.message)}</span>
            ${metaHtml}
        `;

        this.container.appendChild(row);

        if (this.autoScroll) {
            this.container.scrollTop = this.container.scrollHeight;
        }
    }

    clear() {
        this.logStream = [];
        if (this.container) {
            this.container.innerHTML = `
                <div class="log-empty-state">
                    <span class="pulse-indicator"></span> CloudWatch event stream active. Listening for AWS Pipeline telemetry...
                </div>
            `;
        }
    }

    setFilter(service) {
        this.filter = service;
        if (!this.container) return;
        this.container.innerHTML = '';
        const filtered = this.filter === 'ALL' 
            ? this.logStream 
            : this.logStream.filter(e => e.service === this.filter);

        if (filtered.length === 0) {
            this.container.innerHTML = `<div class="log-empty-state">No events matching filter: ${service}</div>`;
        } else {
            filtered.forEach(entry => this.renderEntry(entry));
        }
    }

    exportLogs() {
        const text = this.logStream.map(e => `[${e.timestamp}] [${e.service}] [${e.type.toUpperCase()}] ${e.message}`).join('\n');
        const blob = new Blob([text], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `smartfile-cloudwatch-logs-${Date.now()}.log`;
        a.click();
        URL.revokeObjectURL(url);
    }
}

function escapeHtml(str) {
    if (typeof str !== 'string') return String(str);
    return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

window.telemetry = new TelemetryConsole('telemetry-terminal');

