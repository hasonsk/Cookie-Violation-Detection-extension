class CookieDashboard {
    constructor() {
        this.processedCookies = [];
        this.filteredCookies = [];
        this.currentFilter = 'all';
        this.searchTerm = '';

        this.init();
    }

    init() {
        document.addEventListener("DOMContentLoaded", () => {
            this.loadData();
            this.setupEventListeners();
        });
    }

    loadData() {
        // Send message to background script to get result details
        chrome.runtime.sendMessage({
            action: "GET_RESULT_DETAILS",
        }, (response) => {
            if (response) {
                console.log("Results details received:", response);
                this.handleDataReceived(response.data);
            } else {
                console.error("No RESULT details received.");
                this.showError("Không thể tải dữ liệu cookie.");
            }
        });
    }

    handleDataReceived(cookieData) {
        try {
            this.processedCookies = this.processData(cookieData);
            this.filteredCookies = [...this.processedCookies];

            this.updateStatistics();
            this.updateHeader(cookieData);
            this.renderCookies();
        } catch (error) {
            console.error("Error processing cookie data:", error);
            this.showError("Lỗi khi xử lý dữ liệu cookie.");
        }
    }

    processData(data) {
        const cookieMap = new Map();

        // Process declared cookies
        if (data.details && data.details.declared_cookie_details) {
            data.details.declared_cookie_details.forEach(cookie => {
                cookieMap.set(cookie.cookie_name, {
                    name: cookie.cookie_name,
                    type: 'declared',
                    declared: cookie,
                    realtime: null,
                    violations: cookie.violations || []
                });
            });
        }

        // Process realtime cookies
        if (data.details && data.details.realtime_cookie_details) {
            data.details.realtime_cookie_details.forEach(cookie => {
                if (cookieMap.has(cookie.name)) {
                    // Cookie exists in both declared and realtime
                    const existing = cookieMap.get(cookie.name);
                    existing.type = 'both';
                    existing.realtime = cookie;
                    // Merge violations
                    if (cookie.violations) {
                        existing.violations = [...existing.violations, ...cookie.violations];
                    }
                } else {
                    // Realtime only cookie
                    cookieMap.set(cookie.name, {
                        name: cookie.name,
                        type: 'realtime',
                        declared: null,
                        realtime: cookie,
                        violations: cookie.violations || []
                    });
                }
            });
        }

        return Array.from(cookieMap.values());
    }

    updateStatistics() {
        const stats = this.calculateStatistics();

        document.getElementById('total-violations').textContent = stats.totalViolations;
        document.getElementById('declared-cookies').textContent = stats.declaredCount;
        document.getElementById('realtime-cookies').textContent = stats.realtimeCount;
        document.getElementById('both-cookies').textContent = stats.bothCount;
    }

    calculateStatistics() {
        const totalViolations = this.processedCookies.reduce((sum, cookie) => sum + cookie.violations.length, 0);
        const declaredCount = this.processedCookies.filter(c => c.type === 'declared' || c.type === 'both').length;
        const realtimeCount = this.processedCookies.filter(c => c.type === 'realtime' || c.type === 'both').length;
        const bothCount = this.processedCookies.filter(c => c.type === 'both').length;

        return {
            totalViolations,
            declaredCount,
            realtimeCount,
            bothCount
        };
    }

    updateHeader(data) {
        // Update website domain if available
        if (data.website_url) {
            try {
                const url = new URL(data.website_url);
                document.getElementById('website-domain').textContent = url.hostname;
            } catch (e) {
                document.getElementById('website-domain').textContent = data.website_url || 'Unknown Domain';
            }
        }

        // Update compliance badge
        const totalViolations = this.processedCookies.reduce((sum, cookie) => sum + cookie.violations.length, 0);
        const complianceBadge = document.getElementById('compliance-badge');
        const complianceScore = document.getElementById('compliance-score');

        if (totalViolations === 0) {
            complianceBadge.className = 'compliance-badge compliance-good';
            complianceScore.textContent = 'Tuân thủ tốt';
        } else if (totalViolations <= 5) {
            complianceBadge.className = 'compliance-badge compliance-warning';
            complianceScore.textContent = 'Cần cải thiện';
        } else {
            complianceBadge.className = 'compliance-badge compliance-danger';
            complianceScore.textContent = 'Nhiều vi phạm';
        }

        // Update analysis date
        document.getElementById('analysis-date').textContent = `Phân tích lúc: ${new Date().toLocaleString('vi-VN')}`;
    }

    renderCookies() {
        const container = document.getElementById('cookieList');

        if (this.filteredCookies.length === 0) {
            container.innerHTML = '<div class="no-data">Không tìm thấy cookie nào phù hợp với bộ lọc.</div>';
            return;
        }

        container.innerHTML = '';

        this.filteredCookies.forEach((cookie, index) => {
            const row = this.createCookieRow(cookie, index);
            container.appendChild(row);
        });
    }

    createCookieRow(cookie, index) {
        const row = document.createElement('div');
        row.className = 'cookie-row';

        row.innerHTML = `
            <div class="cookie-main" onclick="cookieDashboard.toggleDetails(${index})">
                <div class="cookie-name">
                    ${this.escapeHtml(cookie.name)}
                    <span class="cookie-type-badge ${cookie.type}">${this.getTypeLabel(cookie.type)}</span>
                </div>
                <div>${cookie.declared ? this.escapeHtml(cookie.declared.declared_purpose || '-') : '-'}</div>
                <div>${cookie.declared ? this.escapeHtml(cookie.declared.declared_third_parties?.join(', ') || '-') : '-'}</div>
                <div>${cookie.declared ? this.escapeHtml(cookie.declared.declared_retention || '-') : this.formatExpiration(cookie.realtime)}</div>
                <div class="violation-count ${cookie.violations.length > 0 ? 'has-violations' : 'no-violations'}">
                    ${cookie.violations.length > 0 ? '⚠️ ' + cookie.violations.length + ' vi phạm' : '✅ Không vi phạm'}
                </div>
                <div class="expand-icon">▶</div>
            </div>
            <div class="cookie-details">
                ${this.createDetailsContent(cookie)}
            </div>
        `;

        return row;
    }

    createDetailsContent(cookie) {
        return `
            <div class="details-content">
                <div class="details-grid">
                    <div class="detail-section">
                        <h4>Thông tin khai báo</h4>
                        ${cookie.declared ? this.createDeclaredDetails(cookie.declared) : '<p style="color: #6b7280;">Không có thông tin khai báo</p>'}
                    </div>
                    <div class="detail-section">
                        <h4>Thông tin realtime</h4>
                        ${cookie.realtime ? this.createRealtimeDetails(cookie.realtime) : '<p style="color: #6b7280;">Không phát hiện cookie realtime</p>'}
                    </div>
                </div>
                ${cookie.violations.length > 0 ? this.createViolationsSection(cookie.violations) : ''}
            </div>
        `;
    }

    createDeclaredDetails(declared) {
        return `
            <div class="detail-item">
                <span class="detail-label">Mục đích:</span>
                <span class="detail-value">${this.escapeHtml(declared.declared_purpose || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Thời gian lưu:</span>
                <span class="detail-value">${this.escapeHtml(declared.declared_retention || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Bên thứ ba:</span>
                <span class="detail-value">${this.escapeHtml(declared.declared_third_parties?.join(', ') || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Mô tả:</span>
                <span class="detail-value">${this.escapeHtml(declared.declared_description || '-')}</span>
            </div>
        `;
    }

    createRealtimeDetails(realtime) {
        return `
            <div class="detail-item">
                <span class="detail-label">Domain:</span>
                <span class="detail-value">${this.escapeHtml(realtime.domain || '-')}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Hết hạn:</span>
                <span class="detail-value">${this.formatExpiration(realtime)}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Secure:</span>
                <span class="detail-value">${realtime.secure ? 'Có' : 'Không'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">HttpOnly:</span>
                <span class="detail-value">${realtime.httpOnly ? 'Có' : 'Không'}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">SameSite:</span>
                <span class="detail-value">${this.escapeHtml(realtime.sameSite || '-')}</span>
            </div>
        `;
    }

    createViolationsSection(violations) {
        const violationItems = violations.map(violation => `
            <div class="violation-item">
                <div class="violation-header">
                    <span class="severity-badge severity-${violation.severity?.toLowerCase() || 'unknown'}">${this.escapeHtml(violation.severity || 'Unknown')}</span>
                    <span style="color: #6b7280; font-size: 12px;">${this.escapeHtml((violation.category || 'Unknown') + ' - ' + (violation.type || 'Unknown'))}</span>
                </div>
                <div class="violation-title">Vi phạm #${this.escapeHtml(violation.issue_id || 'N/A')}</div>
                <div class="violation-description">${this.escapeHtml(violation.description || 'Không có mô tả')}</div>
            </div>
        `).join('');

        return `
            <div class="violations-section">
                <h4 style="color: #dc2626; margin-bottom: 16px;">Vi phạm phát hiện</h4>
                ${violationItems}
            </div>
        `;
    }

    setupEventListeners() {
        // Filter buttons
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.handleFilterChange(e.target.dataset.filter);
            });
        });

        // Search input
        const searchInput = document.getElementById('searchInput');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.handleSearch(e.target.value);
            });
        }
    }

    handleFilterChange(filter) {
        // Update active filter button
        document.querySelectorAll('.filter-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-filter="${filter}"]`).classList.add('active');

        this.currentFilter = filter;
        this.applyFilters();
    }

    handleSearch(searchTerm) {
        this.searchTerm = searchTerm.toLowerCase();
        this.applyFilters();
    }

    applyFilters() {
        let filtered = [...this.processedCookies];

        // Apply type filter
        switch(this.currentFilter) {
            case 'declared':
                filtered = filtered.filter(c => c.type === 'declared' || c.type === 'both');
                break;
            case 'realtime':
                filtered = filtered.filter(c => c.type === 'realtime' || c.type === 'both');
                break;
            case 'both':
                filtered = filtered.filter(c => c.type === 'both');
                break;
            case 'violations':
                filtered = filtered.filter(c => c.violations.length > 0);
                break;
            case 'no-violations':
                filtered = filtered.filter(c => c.violations.length === 0);
                break;
            // 'all' case - no filtering needed
        }

        // Apply search filter
        if (this.searchTerm) {
            filtered = filtered.filter(cookie =>
                cookie.name.toLowerCase().includes(this.searchTerm) ||
                (cookie.declared?.declared_purpose?.toLowerCase().includes(this.searchTerm)) ||
                (cookie.declared?.declared_description?.toLowerCase().includes(this.searchTerm))
            );
        }

        this.filteredCookies = filtered;
        this.renderCookies();
    }

    toggleDetails(index) {
        const rows = document.querySelectorAll('.cookie-row');
        if (rows[index]) {
            rows[index].classList.toggle('expanded');
        }
    }

    getTypeLabel(type) {
        const labels = {
            'declared': 'Đã khai báo',
            'realtime': 'Realtime',
            'both': 'Cả hai',
        };
        return labels[type] || 'Không xác định';
    }

    formatExpiration(cookie) {
        if (!cookie?.expirationDate) return '-';
        try {
            const date = new Date(cookie.expirationDate);
            return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
        } catch (e) {
            return '-';
        }
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    showError(message) {
        const container = document.getElementById('cookieList');
        container.innerHTML = `<div class="error-message">${this.escapeHtml(message)}</div>`;
    }
}

// Initialize the dashboard
const cookieDashboard = new CookieDashboard();
