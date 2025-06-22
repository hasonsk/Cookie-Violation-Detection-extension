const cookieData = {
    "declared_cookies": [
        {
            "cookie_name": "overleaf_session2",
            "declared_purpose": "Authentication",
            "declared_retention": "5 days",
            "declared_third_parties": ["First Party"],
            "declared_description": "Authentication",
            "violations": [
                {
                    "issue_id": 8,
                    "category": "General",
                    "type": "Purpose",
                    "description": "Observed cookie name shows no semantic similarity with any declared purpose label (max similarity < 0.5).",
                    "severity": "Medium"
                }
            ]
        },
        {
            "cookie_name": "deviceHistory",
            "declared_purpose": "Security",
            "declared_retention": "90 days",
            "declared_third_parties": ["First Party"],
            "declared_description": "Security",
            "violations": []
        },
        {
            "cookie_name": "doc.*,editor.*,layout.*,pdf.*",
            "declared_purpose": "Functionality",
            "declared_retention": "local storage",
            "declared_third_parties": ["First Party"],
            "declared_description": "Preferences (remember editor settings)",
            "violations": []
        },
        {
            "cookie_name": "_grecaptcha",
            "declared_purpose": "Security",
            "declared_retention": "local storage",
            "declared_third_parties": ["Google"],
            "declared_description": "Security (Google reCAPTCHA)",
            "violations": []
        },
        {
            "cookie_name": "GCLB",
            "declared_purpose": "Performance",
            "declared_retention": "session",
            "declared_third_parties": ["Google"],
            "declared_description": "Performance (Google Cloud Load Balancer for websocket fallback)",
            "violations": []
        },
        {
            "cookie_name": "__recurly__.deviceId",
            "declared_purpose": "Security",
            "declared_retention": "local storage",
            "declared_third_parties": ["Recurly"],
            "declared_description": "Security (Recurly payment processing)",
            "violations": []
        },
        {
            "cookie_name": "algoliasearch-client-js",
            "declared_purpose": "Functionality",
            "declared_retention": "local storage",
            "declared_third_parties": ["First Party"],
            "declared_description": "Preferences (Algolia documentation search)",
            "violations": []
        },
        {
            "cookie_name": "_ga*",
            "declared_purpose": "Analytical",
            "declared_retention": "13 months",
            "declared_third_parties": ["Google"],
            "declared_description": "Analytics used to distinguish users (Google Analytics)",
            "violations": []
        },
        {
            "cookie_name": "_gid",
            "declared_purpose": "Analytical",
            "declared_retention": "24 hours",
            "declared_third_parties": ["Google"],
            "declared_description": "Analytics used to distinguish users (Google Analytics)",
            "violations": []
        },
        {
            "cookie_name": "_gat",
            "declared_purpose": "Analytical",
            "declared_retention": "1 minute",
            "declared_third_parties": ["Google"],
            "declared_description": "Analytics used to throttle request rate (Google Analytics)",
            "violations": []
        }
    ],
    "realtime_cookies": [
        {
            "name": "__stripe_mid",
            "value": "107c8da0-9c1c-4b42-932d-238096e87feb896b6b",
            "domain": ".www.overleaf.com",
            "expirationDate": "2026-06-18T11:05:08.000Z",
            "secure": true,
            "httpOnly": false,
            "sameSite": "strict",
            "path": "/",
            "violations": [
                {
                    "issue_id": 12,
                    "category": "Undefined",
                    "type": "Behavior",
                    "description": "Cookie is deployed without being mentioned in the policy, potentially without user consent.",
                    "severity": "Medium"
                }
            ]
        },
        {
            "name": "overleaf_session2",
            "value": "s%3AgULdMeURB54tjEjN4jhTiZ01CMYTljf4.CXYValjEIj76Xkg0YcOCaqSCPsBaOcGmJYwZp7jRNZs",
            "domain": ".overleaf.com",
            "expirationDate": "2025-06-24T07:15:46.215Z",
            "secure": true,
            "httpOnly": true,
            "sameSite": "lax",
            "path": "/",
            "violations": []
        }
    ]
};

// Combine and process data
function processData() {
    const processedCookies = [];
    const cookieMap = new Map();

    // Add declared cookies
    cookieData.declared_cookies.forEach(cookie => {
        cookieMap.set(cookie.cookie_name, {
            name: cookie.cookie_name,
            type: 'declared',
            declared: cookie,
            realtime: null,
            violations: cookie.violations || []
        });
    });

    // Add realtime cookies
    cookieData.realtime_cookies.forEach(cookie => {
        if (cookieMap.has(cookie.name)) {
            // This cookie exists in both
            const existing = cookieMap.get(cookie.name);
            existing.type = 'both';
            existing.realtime = cookie;
            // Merge violations
            if (cookie.violations) {
                existing.violations = [...existing.violations, ...cookie.violations];
            }
        } else {
            // This is realtime only
            cookieMap.set(cookie.name, {
                name: cookie.name,
                type: 'realtime',
                declared: null,
                realtime: cookie,
                violations: cookie.violations || []
            });
        }
    });

    return Array.from(cookieMap.values());
}

const processedCookies = processData();
let filteredCookies = processedCookies;

function renderCookies() {
    const container = document.getElementById('cookieList');
    container.innerHTML = '';

    filteredCookies.forEach((cookie, index) => {
        const row = document.createElement('div');
        row.className = 'cookie-row';
        row.innerHTML = `
            <div class="cookie-main" data-index="${index}">
                <div class="cookie-name">
                    ${cookie.name}
                    <span class="cookie-type-badge ${cookie.type}">${getTypeLabel(cookie.type)}</span>
                </div>
                <div>${cookie.declared ? cookie.declared.declared_purpose || '-' : '-'}</div>
                <div>${cookie.declared ? cookie.declared.declared_third_parties.join(', ') : '-'}</div>
                <div>${cookie.declared ? cookie.declared.declared_retention || '-' : formatExpiration(cookie.realtime)}</div>
                <div class="violation-count ${cookie.violations.length > 0 ? 'has-violations' : 'no-violations'}">
                    ${cookie.violations.length > 0 ? '⚠️ ' + cookie.violations.length + ' vi phạm' : '✅ Tuân thủ'}
                </div>
                <div class="expand-icon">▶</div>
            </div>
            <div class="cookie-details">
                <div class="details-content">
                    <div class="details-grid">
                        <div class="detail-section">
                            <h4>Thông tin khai báo</h4>
                            ${cookie.declared ? `
                                <div class="detail-item">
                                    <span class="detail-label">Mục đích:</span>
                                    <span class="detail-value">${cookie.declared.declared_purpose}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Thời gian lưu:</span>
                                    <span class="detail-value">${cookie.declared.declared_retention}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Bên thứ ba:</span>
                                    <span class="detail-value">${cookie.declared.declared_third_parties.join(', ')}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Mô tả:</span>
                                    <span class="detail-value">${cookie.declared.declared_description}</span>
                                </div>
                            ` : '<p style="color: #6b7280;">Không có thông tin khai báo</p>'}
                        </div>
                        <div class="detail-section">
                            <h4>Thông tin realtime</h4>
                            ${cookie.realtime ? `
                                <div class="detail-item">
                                    <span class="detail-label">Domain:</span>
                                    <span class="detail-value">${cookie.realtime.domain}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Hết hạn:</span>
                                    <span class="detail-value">${formatExpiration(cookie.realtime)}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">Secure:</span>
                                    <span class="detail-value">${cookie.realtime.secure ? 'Có' : 'Không'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">HttpOnly:</span>
                                    <span class="detail-value">${cookie.realtime.httpOnly ? 'Có' : 'Không'}</span>
                                </div>
                                <div class="detail-item">
                                    <span class="detail-label">SameSite:</span>
                                    <span class="detail-value">${cookie.realtime.sameSite}</span>
                                </div>
                            ` : '<p style="color: #6b7280;">Không phát hiện cookie realtime</p>'}
                        </div>
                    </div>
                    ${cookie.violations.length > 0 ? `
                        <div class="violations-section">
                            <h4 style="color: #dc2626; margin-bottom: 16px;">Vi phạm phát hiện</h4>
                            ${cookie.violations.map(violation => `
                                <div class="violation-item">
                                    <div class="violation-header">
                                        <span class="severity-badge severity-${violation.severity.toLowerCase()}">${violation.severity}</span>
                                        <span style="color: #6b7280; font-size: 12px;">${violation.category} - ${violation.type}</span>
                                    </div>
                                    <div class="violation-title">Vi phạm #${violation.issue_id}</div>
                                    <div class="violation-description">${violation.description}</div>
                                </div>
                            `).join('')}
                        </div>
                    ` : ''}
                </div>
            </div>
        `;
        container.appendChild(row);
        const mainSection = row.querySelector('.cookie-main');
        mainSection.addEventListener('click', () => toggleDetails(index));
    });
}

function getTypeLabel(type) {
    switch(type) {
        case 'declared': return 'Đã khai báo';
        case 'realtime': return 'Realtime';
        case 'both': return 'Cả hai';
        default: return 'Không xác định';
    }
}

function formatExpiration(cookie) {
    if (!cookie || !cookie.expirationDate) return '-';
    const date = new Date(cookie.expirationDate);
    return date.toLocaleDateString('vi-VN') + ' ' + date.toLocaleTimeString('vi-VN');
}

function toggleDetails(index) {
    const rows = document.querySelectorAll('.cookie-row');
    const row = rows[index];
    row.classList.toggle('expanded');
}

// Filter functionality
document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');

        const filter = btn.dataset.filter;
        filterCookies(filter);
    });
});

function filterCookies(filter) {
    switch(filter) {
        case 'all':
            filteredCookies = processedCookies;
            break;
        case 'declared':
            filteredCookies = processedCookies.filter(c => c.type === 'declared' || c.type === 'both');
            break;
        case 'realtime':
            filteredCookies = processedCookies.filter(c => c.type === 'realtime' || c.type === 'both');
            break;
        case 'both':
            filteredCookies = processedCookies.filter(c => c.type === 'both');
            break;
        case 'violations':
            filteredCookies = processedCookies.filter(c => c.violations.length > 0);
            break;
        case 'no-violations':
            filteredCookies = processedCookies.filter(c => c.violations.length === 0);
            break;
    }
    renderCookies();
}

// Search functionality
document.getElementById('searchInput').addEventListener('input', (e) => {
    const searchTerm = e.target.value.toLowerCase();
    filteredCookies = processedCookies.filter(cookie =>
        cookie.name.toLowerCase().includes(searchTerm) ||
        (cookie.declared && cookie.declared.declared_purpose.toLowerCase().includes(searchTerm)) ||
        (cookie.declared && cookie.declared.declared_description.toLowerCase().includes(searchTerm))
    );
    renderCookies();
});

renderCookies();
