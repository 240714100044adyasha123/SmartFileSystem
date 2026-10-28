/**
 * SmartFile Cloud OS - Event-Driven AWS Architecture Pipeline Visualizer
 * Real-time 5-stage stepper with animated energy streams & latency trackers.
 */

class PipelineVisualizer {
    constructor(containerId) {
        this.container = document.getElementById(containerId);
        this.stages = [
            {
                id: 'stage-auth',
                key: 'cognito',
                name: 'Amazon Cognito',
                label: 'OAuth2 / PKCE Auth',
                icon: 'lock',
                awsService: 'Cognito User Pool',
                desc: 'Client-side PKCE S256 verification generating OAuth2 ID Token with openid/email claims.'
            },
            {
                id: 'stage-gateway',
                key: 'apigateway',
                name: 'API Gateway',
                label: 'Pre-Signed URL Gen',
                icon: 'zap',
                awsService: 'Amazon API Gateway REST',
                desc: 'Secure endpoint issuing short-lived IAM-signed S3 PUT URLs with strict Content-Type policy.'
            },
            {
                id: 'stage-s3',
                key: 's3',
                name: 'Amazon S3',
                label: 'Direct Bucket Ingestion',
                icon: 'database',
                awsService: 'Amazon Simple Storage Service',
                desc: 'Zero-bandwidth EC2 bypass: direct browser-to-bucket multi-part binary stream upload.'
            },
            {
                id: 'stage-lambda',
                key: 'lambda',
                name: 'AWS Lambda',
                label: 'Event Worker Processor',
                icon: 'cpu',
                awsService: 'Serverless Compute (Python 3.12)',
                desc: 'Asynchronous event trigger on s3:ObjectCreated to extract MIME, hash integrity, and tags.'
            },
            {
                id: 'stage-notify',
                key: 'dynamodb_sns',
                name: 'DynamoDB & SNS',
                label: 'Storage & Notification',
                icon: 'bell',
                awsService: 'DynamoDB + Simple Notification Service',
                desc: 'NoSQL audit persistence in SmartFile_Metadata table & broadcast alert dispatched to subscribers.'
            }
        ];

        this.init();
    }

    init() {
        if (!this.container) return;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <div class="pipeline-track">
                ${this.stages.map((stage, idx) => `
                    <div class="pipeline-node idle" id="${stage.id}" data-idx="${idx}" onclick="window.pipeline.inspectStage('${stage.key}')">
                        <div class="node-icon-wrapper">
                            <span class="node-status-glow"></span>
                            <div class="node-icon">${this.getIconSvg(stage.icon)}</div>
                        </div>
                        <div class="node-content">
                            <div class="node-tag">${stage.awsService}</div>
                            <h4 class="node-title">${stage.name}</h4>
                            <span class="node-status">Standby</span>
                            <span class="node-latency" id="latency-${stage.key}">-- ms</span>
                        </div>
                    </div>
                    ${idx < this.stages.length - 1 ? `
                        <div class="pipeline-connector" id="connector-${idx}">
                            <div class="connector-line"></div>
                            <div class="connector-pulse"></div>
                        </div>
                    ` : ''}
                `).join('')}
            </div>
        `;
    }

    getIconSvg(icon) {
        switch (icon) {
            case 'lock':
                return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"></rect><path d="M7 11V7a5 5 0 0 1 10 0v4"></path></svg>`;
            case 'zap':
                return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"></polygon></svg>`;
            case 'database':
                return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><ellipse cx="12" cy="5" rx="9" ry="3"></ellipse><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"></path><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"></path></svg>`;
            case 'cpu':
                return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="4" y="4" width="16" height="16" rx="2" ry="2"></rect><rect x="9" y="9" width="6" height="6"></rect><line x1="9" y1="1" x2="9" y2="4"></line><line x1="15" y1="1" x2="15" y2="4"></line><line x1="9" y1="20" x2="9" y2="23"></line><line x1="15" y1="20" x2="15" y2="23"></line><line x1="20" y1="9" x2="23" y2="9"></line><line x1="20" y1="14" x2="23" y2="14"></line><line x1="1" y1="9" x2="4" y1="9"></line><line x1="1" y1="14" x2="4" y1="14"></line></svg>`;
            case 'bell':
                return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>`;
            default:
                return `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle></svg>`;
        }
    }

    setStageState(stageKey, state, latencyMs = null, customText = null) {
        const stageIndex = this.stages.findIndex(s => s.key === stageKey);
        if (stageIndex === -1) return;

        const stage = this.stages[stageIndex];
        const el = document.getElementById(stage.id);
        if (!el) return;

        // Reset state classes
        el.className = `pipeline-node ${state}`;
        const statusSpan = el.querySelector('.node-status');
        const latencySpan = el.querySelector(`#latency-${stage.key}`);

        if (state === 'active') {
            statusSpan.textContent = customText || 'Processing...';
            // Activate previous connector
            if (stageIndex > 0) {
                const conn = document.getElementById(`connector-${stageIndex - 1}`);
                if (conn) conn.classList.add('flowing');
            }
        } else if (state === 'success') {
            statusSpan.textContent = customText || 'Complete';
            if (latencyMs !== null) {
                latencySpan.textContent = `${latencyMs}ms`;
                latencySpan.style.display = 'inline-block';
            }
            if (stageIndex > 0) {
                const conn = document.getElementById(`connector-${stageIndex - 1}`);
                if (conn) {
                    conn.classList.remove('flowing');
                    conn.classList.add('completed');
                }
            }
        } else if (state === 'error') {
            statusSpan.textContent = customText || 'Failed';
            if (stageIndex > 0) {
                const conn = document.getElementById(`connector-${stageIndex - 1}`);
                if (conn) conn.classList.add('error');
            }
        } else if (state === 'idle') {
            statusSpan.textContent = 'Standby';
            latencySpan.textContent = '-- ms';
        }
    }

    resetAll() {
        this.stages.forEach((s, idx) => {
            this.setStageState(s.key, 'idle');
            const conn = document.getElementById(`connector-${idx}`);
            if (conn) conn.className = 'pipeline-connector';
        });
    }

    inspectStage(key) {
        const stage = this.stages.find(s => s.key === key);
        if (!stage) return;
        if (window.app && window.app.showStageModal) {
            window.app.showStageModal(stage);
        }
    }
}

window.pipeline = new PipelineVisualizer('pipeline-container');

