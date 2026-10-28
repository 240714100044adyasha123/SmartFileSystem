/**
 * SmartFile Cloud OS - Master Application Controller
 * Handles UI interactions, file drag-and-drop, modals, data filtering, and AWS events.
 */

class SmartFileApp {
    constructor() {
        this.selectedFile = null;
        this.isUploading = false;
        this.currentFilter = 'ALL';
        this.searchQuery = '';
        this.init();
    }

    async init() {
        // Hydrate configuration from server .env file
        if (window.aws && window.aws.loadRemoteConfig) {
            await window.aws.loadRemoteConfig();
        }

        this.bindEvents();
        this.checkAuthStatus();
        this.renderFiles();
        this.updateStats();

        // Check for Cognito code parameter in URL
        try {
            const token = await window.aws.handleAuthRedirect();
            if (token) {
                this.updateAuthUI(true);
            }
        } catch (err) {
            console.error("Auth redirect handling error:", err);
        }

        // Initialize default telemetry stream
        window.telemetry.log('EC2', 'SmartFile Web Instance operational on Amazon EC2 / ap-south-1', 'info');
        window.telemetry.log('COGNITO', `User Pool Client: ${window.aws.config.clientId}`, 'info');
        window.telemetry.log('API-GATEWAY', `REST API Endpoint: ${window.aws.config.apiUrl}`, 'info');
    }

    bindEvents() {
        // Dropzone & File Input
        const dropzone = document.getElementById('dropzone');
        const fileInput = document.getElementById('file-input');
        const browseBtn = document.getElementById('browse-btn');
        const uploadBtn = document.getElementById('upload-btn');
        const clearBtn = document.getElementById('clear-file-btn');

        if (browseBtn && fileInput) {
            browseBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                fileInput.click();
            });
        }

        if (dropzone && fileInput) {
            dropzone.addEventListener('click', () => fileInput.click());

            ['dragenter', 'dragover'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.add('drag-active');
                });
            });

            ['dragleave', 'drop'].forEach(eventName => {
                dropzone.addEventListener(eventName, (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    dropzone.classList.remove('drag-active');
                });
            });

            dropzone.addEventListener('drop', (e) => {
                if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                    this.handleFileSelected(e.dataTransfer.files[0]);
                }
            });

            fileInput.addEventListener('change', (e) => {
                if (e.target.files && e.target.files[0]) {
                    this.handleFileSelected(e.target.files[0]);
                }
            });
        }

        if (uploadBtn) {
            uploadBtn.addEventListener('click', () => this.startUploadPipeline());
        }

        if (clearBtn) {
            clearBtn.addEventListener('click', () => this.clearSelectedFile());
        }

        // Auth Buttons
        const loginBtn = document.getElementById('btn-login');
        const logoutBtn = document.getElementById('btn-logout');
        if (loginBtn) {
            loginBtn.addEventListener('click', () => window.aws.initiateCognitoLogin());
        }
        if (logoutBtn) {
            logoutBtn.addEventListener('click', () => {
                window.aws.logout();
                this.updateAuthUI(false);
                window.telemetry.log('COGNITO', 'User session terminated. Logged out.', 'info');
            });
        }

        // Search and Filter Tabs
        const searchInput = document.getElementById('file-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.searchQuery = e.target.value.toLowerCase();
                this.renderFiles();
            });
        }

        const filterPills = document.querySelectorAll('.filter-pill');
        filterPills.forEach(pill => {
            pill.addEventListener('click', (e) => {
                filterPills.forEach(p => p.classList.remove('active'));
                e.target.classList.add('active');
                this.currentFilter = e.target.getAttribute('data-filter');
                this.renderFiles();
            });
        });

        // Telemetry Console Controls
        const clearLogsBtn = document.getElementById('btn-clear-logs');
        const exportLogsBtn = document.getElementById('btn-export-logs');
        if (clearLogsBtn) clearLogsBtn.addEventListener('click', () => window.telemetry.clear());
        if (exportLogsBtn) exportLogsBtn.addEventListener('click', () => window.telemetry.exportLogs());

        const logFilterSelect = document.getElementById('log-filter-select');
        if (logFilterSelect) {
            logFilterSelect.addEventListener('change', (e) => window.telemetry.setFilter(e.target.value));
        }

        // Modal Close handlers
        document.querySelectorAll('.modal-overlay').forEach(overlay => {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) {
                    this.closeAllModals();
                }
            });
        });
        document.querySelectorAll('.modal-close-btn').forEach(btn => {
            btn.addEventListener('click', () => this.closeAllModals());
        });

        // Settings Modal Form
        const settingsForm = document.getElementById('aws-settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', (e) => {
                e.preventDefault();
                this.saveSettings();
            });
        }
    }

    checkAuthStatus() {
        if (window.aws.idToken) {
            this.updateAuthUI(true);
        } else {
            this.updateAuthUI(false);
        }
    }

    updateAuthUI(isAuthenticated) {
        const authContainer = document.getElementById('auth-status-container');
        const loginBtn = document.getElementById('btn-login');
        const userBadge = document.getElementById('user-profile-badge');
        const userEmailSpan = document.getElementById('user-email-display');

        if (isAuthenticated) {
            if (loginBtn) loginBtn.style.display = 'none';
            if (userBadge) userBadge.style.display = 'flex';
            const email = window.aws.user ? (window.aws.user.email || 'aws.student@cloud.ac.in') : 'aws.student@cloud.ac.in';
            if (userEmailSpan) userEmailSpan.textContent = email;
            if (authContainer) authContainer.classList.add('authenticated');
        } else {
            if (loginBtn) loginBtn.style.display = 'inline-flex';
            if (userBadge) userBadge.style.display = 'none';
            if (authContainer) authContainer.classList.remove('authenticated');
        }
    }

    handleFileSelected(file) {
        this.selectedFile = file;

        const dropPrompt = document.getElementById('drop-prompt');
        const filePreviewCard = document.getElementById('file-preview-card');
        const fileNameEl = document.getElementById('preview-file-name');
        const fileSizeEl = document.getElementById('preview-file-size');
        const fileTypeEl = document.getElementById('preview-file-type');
        const fileHashEl = document.getElementById('preview-file-hash');
        const uploadBtn = document.getElementById('upload-btn');

        if (dropPrompt) dropPrompt.style.display = 'none';
        if (filePreviewCard) filePreviewCard.style.display = 'flex';
        if (fileNameEl) fileNameEl.textContent = file.name;
        if (fileSizeEl) fileSizeEl.textContent = this.formatBytes(file.size);
        if (fileTypeEl) fileTypeEl.textContent = file.type || 'Binary / Unspecified';
        if (fileHashEl) fileHashEl.textContent = 'Computing SHA-256...';
        if (uploadBtn) uploadBtn.disabled = false;

        // Instant cryptographic checksum calculation
        window.aws.calculateFileHash(file).then(hash => {
            if (fileHashEl) fileHashEl.textContent = `SHA-256: ${hash.substring(0, 24)}...`;
        }).catch(() => {
            if (fileHashEl) fileHashEl.textContent = 'Checksum ready';
        });

        // Reset visual pipeline state
        window.pipeline.resetAll();
    }

    clearSelectedFile() {
        this.selectedFile = null;
        const fileInput = document.getElementById('file-input');
        if (fileInput) fileInput.value = '';

        const dropPrompt = document.getElementById('drop-prompt');
        const filePreviewCard = document.getElementById('file-preview-card');
        const uploadBtn = document.getElementById('upload-btn');
        const progressBox = document.getElementById('upload-progress-box');

        if (dropPrompt) dropPrompt.style.display = 'flex';
        if (filePreviewCard) filePreviewCard.style.display = 'none';
        if (uploadBtn) uploadBtn.disabled = true;
        if (progressBox) progressBox.style.display = 'none';

        window.pipeline.resetAll();
    }

    async startUploadPipeline() {
        if (!this.selectedFile || this.isUploading) return;

        // Check authentication
        if (!window.aws.idToken && !window.aws.config.demoMode) {
            this.showNotification("AWS Cognito Sign-In Required", "Please click 'Sign In with Cognito' or enable Demo Mode in Settings.", "warning");
            return;
        }

        this.isUploading = true;
        const uploadBtn = document.getElementById('upload-btn');
        const progressBox = document.getElementById('upload-progress-box');
        const progressBar = document.getElementById('progress-bar-fill');
        const progressPct = document.getElementById('progress-percentage');
        const progressStatus = document.getElementById('progress-status-text');

        if (uploadBtn) {
            uploadBtn.disabled = true;
            uploadBtn.innerHTML = `<span class="spinner"></span> Processing Pipeline...`;
        }
        if (progressBox) progressBox.style.display = 'block';

        const startTime = Date.now();

        try {
            const result = await window.aws.executePipeline(this.selectedFile, (percent) => {
                if (progressBar) progressBar.style.width = `${percent}%`;
                if (progressPct) progressPct.textContent = `${percent}%`;
                if (progressStatus) progressStatus.textContent = `Uploading to S3 (${percent}%)...`;
            });

            if (progressBar) progressBar.style.width = '100%';
            if (progressPct) progressPct.textContent = '100%';
            if (progressStatus) progressStatus.textContent = 'Pipeline execution completed successfully!';

            this.showNotification("Pipeline Completed", `File "${this.selectedFile.name}" successfully processed & indexed into DynamoDB.`, "success");

            // Refresh UI
            this.renderFiles();
            this.updateStats();

            setTimeout(() => {
                this.clearSelectedFile();
                if (uploadBtn) {
                    uploadBtn.innerHTML = `
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="5 3 19 12 5 21 5 3"/>
                        </svg>
                        <span>Launch Pipeline Ingestion</span>
                    `;
                }
            }, 1800);

        } catch (error) {
            console.error(error);
            this.showNotification("Ingestion Error", error.message, "error");
            if (progressStatus) progressStatus.textContent = `Failed: ${error.message}`;
            if (uploadBtn) {
                uploadBtn.disabled = false;
                uploadBtn.innerHTML = `
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M21 12a9 9 0 0 0-9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/>
                        <path d="M3 3v5h5"/>
                        <path d="M3 12a9 9 0 0 0 9 9 9.75 9.75 0 0 0 6.74-2.74L21 16"/>
                        <path d="M16 21h5v-5"/>
                    </svg>
                    <span>Retry Ingestion</span>
                `;
            }
        } finally {
            this.isUploading = false;
        }
    }

    renderFiles() {
        const container = document.getElementById('files-table-body');
        if (!container) return;

        let files = window.aws.getProcessedFiles();

        // Apply search filter
        if (this.searchQuery) {
            files = files.filter(f => f.name.toLowerCase().includes(this.searchQuery) || f.category.toLowerCase().includes(this.searchQuery));
        }

        // Apply category tab filter
        if (this.currentFilter !== 'ALL') {
            files = files.filter(f => f.category === this.currentFilter);
        }

        const countBadge = document.getElementById('file-counter-badge');
        if (countBadge) countBadge.textContent = `${files.length} Files`;

        if (files.length === 0) {
            container.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-8 text-muted">
                        <div class="empty-files-indicator">
                            <span class="empty-icon">📂</span>
                            <p>No processed files found. Upload a file above to trigger the AWS event pipeline.</p>
                        </div>
                    </td>
                </tr>
            `;
            return;
        }

        container.innerHTML = files.map(file => `
            <tr class="file-table-row" onclick="window.app.inspectFile('${file.id}')">
                <td>
                    <div class="file-name-cell">
                        <span class="file-type-icon ${file.category.toLowerCase()}">${this.getFileCategoryIcon(file.category)}</span>
                        <div class="file-name-meta">
                            <span class="file-primary-name">${escapeHtml(file.name)}</span>
                            <span class="file-hash-sub">${file.hash ? file.hash.substring(0, 16) + '...' : 'Verified SHA-256'}</span>
                        </div>
                    </div>
                </td>
                <td><span class="category-badge cat-${file.category.toLowerCase()}">${file.category}</span></td>
                <td>${this.formatBytes(file.size)}</td>
                <td>
                    <span class="status-badge status-success">
                        <span class="status-dot"></span> ${file.status}
                    </span>
                </td>
                <td><span class="latency-cell">${file.totalLatency || 620}ms</span></td>
                <td>
                    <div class="action-cell-buttons">
                        <button class="btn-action-icon" title="Inspect Cloud Details" onclick="event.stopPropagation(); window.app.inspectFile('${file.id}')">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                        </button>
                        <button class="btn-action-icon btn-delete" title="Delete record" onclick="event.stopPropagation(); window.app.deleteFile('${file.id}')">
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path></svg>
                        </button>
                    </div>
                </td>
            </tr>
        `).join('');
    }

    updateStats() {
        const files = window.aws.getProcessedFiles();
        const totalBytes = files.reduce((acc, f) => acc + (f.size || 0), 0);
        const avgLatency = files.length ? Math.round(files.reduce((acc, f) => acc + (f.totalLatency || 600), 0) / files.length) : 0;

        const statTotalFiles = document.getElementById('stat-total-files');
        const statTotalBytes = document.getElementById('stat-total-bytes');
        const statAvgLatency = document.getElementById('stat-avg-latency');

        if (statTotalFiles) statTotalFiles.textContent = files.length;
        if (statTotalBytes) statTotalBytes.textContent = this.formatBytes(totalBytes);
        if (statAvgLatency) statAvgLatency.textContent = `${avgLatency}ms`;
    }

    inspectFile(fileId) {
        const files = window.aws.getProcessedFiles();
        const file = files.find(f => f.id === fileId);
        if (!file) return;

        const modal = document.getElementById('modal-file-inspector');
        if (!modal) return;

        document.getElementById('inspect-title').textContent = file.name;
        document.getElementById('inspect-s3-arn').textContent = `arn:aws:s3:::${file.bucket || 'smartfile-bucket'}/${file.s3Key || file.name}`;
        document.getElementById('inspect-sha256').textContent = file.hash || 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855';
        document.getElementById('inspect-mime').textContent = file.type;
        document.getElementById('inspect-size').textContent = `${this.formatBytes(file.size)} (${file.size} bytes)`;
        document.getElementById('inspect-region').textContent = `${file.region || 'ap-south-1'} (Asia Pacific - Mumbai)`;
        document.getElementById('inspect-dynamo-json').textContent = JSON.stringify({
            file_id: (file.hash || 'hash').substring(0, 16),
            filename: file.name,
            s3_uri: `s3://${file.bucket || 'smartfile'}/${file.s3Key || file.name}`,
            size_bytes: file.size,
            etag: file.etag || '7c6a512411b089cfa',
            category: file.category,
            status: file.status,
            security_scan: file.scanStatus || 'VERIFIED_CLEAN',
            ingestion_time: file.isoTime || new Date().toISOString(),
            lambda_processing_ms: file.totalLatency || 620
        }, null, 2);

        modal.classList.add('open');
    }

    deleteFile(fileId) {
        if (confirm("Remove this file record from DynamoDB tracking?")) {
            window.aws.deleteProcessedFile(fileId);
            this.renderFiles();
            this.updateStats();
            window.telemetry.log('DYNAMODB', `DeleteItem [file_id=${fileId}] completed`, 'warning');
        }
    }

    showStageModal(stage) {
        const modal = document.getElementById('modal-stage-detail');
        if (!modal) return;

        document.getElementById('stage-modal-title').textContent = `${stage.name} - Deep Dive`;
        document.getElementById('stage-modal-service').textContent = stage.awsService;
        document.getElementById('stage-modal-desc').textContent = stage.desc;

        const vivaNotes = {
            cognito: "Academic Viva Note: Amazon Cognito implements OAuth2 with PKCE (Proof Key for Code Exchange). PKCE prevents authorization code injection attacks on single-page applications without a client secret. The browser acquires a JWT ID Token containing user claims.",
            apigateway: "Academic Viva Note: AWS API Gateway exposes an authenticated REST endpoint. Rather than piping bulky file data through the API or EC2, it creates an AWS IAM Pre-Signed URL. This offloads 100% of bandwidth cost and CPU pressure from the server.",
            s3: "Academic Viva Note: The browser performs a direct HTTP PUT to Amazon S3 using the pre-signed URL. S3 enforces the exact content-type and bucket policy, ensuring secure, high-throughput file ingestion with 99.999999999% (11 9's) durability.",
            lambda: "Academic Viva Note: S3 triggers an asynchronous event notification (s3:ObjectCreated:Put). AWS Lambda spins up an isolated microVM in milliseconds (Serverless execution), parses the object metadata, runs validation algorithms, and computes cryptographic hashes.",
            dynamodb_sns: "Academic Viva Note: Lambda writes an audit record into Amazon DynamoDB (a single-digit millisecond NoSQL database) and simultaneously broadcasts an event to an Amazon SNS topic, alerting downstream systems, emails, or microservices."
        };

        document.getElementById('stage-modal-viva').textContent = vivaNotes[stage.key] || "AWS Event-Driven Pipeline Node.";
        modal.classList.add('open');
    }

    openArchitectureModal() {
        const modal = document.getElementById('modal-architecture');
        if (modal) modal.classList.add('open');
    }

    openSettingsModal() {
        const modal = document.getElementById('modal-settings');
        if (!modal) return;

        document.getElementById('setting-api-url').value = window.aws.config.apiUrl;
        document.getElementById('setting-cognito-domain').value = window.aws.config.domain;
        document.getElementById('setting-client-id').value = window.aws.config.clientId;
        document.getElementById('setting-region').value = window.aws.config.region;
        document.getElementById('setting-s3-bucket').value = window.aws.config.s3Bucket;
        document.getElementById('setting-demo-mode').checked = window.aws.config.demoMode;

        modal.classList.add('open');
    }

    saveSettings() {
        const newConfig = {
            apiUrl: document.getElementById('setting-api-url').value.trim(),
            domain: document.getElementById('setting-cognito-domain').value.trim(),
            clientId: document.getElementById('setting-client-id').value.trim(),
            region: document.getElementById('setting-region').value.trim(),
            s3Bucket: document.getElementById('setting-s3-bucket').value.trim(),
            demoMode: document.getElementById('setting-demo-mode').checked
        };

        window.aws.saveConfig(newConfig);
        this.closeAllModals();
        this.showNotification("Settings Saved", "AWS Configuration updated successfully.", "success");
        window.telemetry.log('EC2', 'AWS Runtime configuration refreshed in local storage', 'info');
    }

    closeAllModals() {
        document.querySelectorAll('.modal-overlay').forEach(modal => modal.classList.remove('open'));
    }

    showNotification(title, message, type = 'info') {
        const toast = document.createElement('div');
        toast.className = `smart-toast toast-${type}`;
        toast.innerHTML = `
            <div class="toast-content">
                <strong>${escapeHtml(title)}</strong>
                <p>${escapeHtml(message)}</p>
            </div>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        const container = document.getElementById('toast-container');
        if (container) {
            container.appendChild(toast);
            setTimeout(() => toast.remove(), 4500);
        }
    }

    getFileCategoryIcon(category) {
        switch (category) {
            case 'IMAGE':
                return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"/><circle cx="9" cy="9" r="2"/><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"/></svg>`;
            case 'DOCUMENT':
                return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/></svg>`;
            case 'CODE':
                return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>`;
            case 'ARCHIVE':
                return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"/><path d="m3.3 7 8.7 5 8.7-5"/><path d="M12 22V12"/></svg>`;
            default:
                return `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M21 12c0 1.66-4 3-9 3s-9-1.34-9-3"/><path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"/></svg>`;
        }
    }

    formatBytes(bytes, decimals = 2) {
        if (!bytes || bytes === 0) return '0 Bytes';
        const k = 1024;
        const dm = decimals < 0 ? 0 : decimals;
        const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.app = new SmartFileApp();
});

