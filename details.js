class CookieDashboard {
  constructor() {
    this.processedCookies = [];
    this.filteredCookies = [];
    this.currentFilter = "all";
    this.searchTerm = "";
    this.charts = {};
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
    chrome.runtime.sendMessage(
      {
        action: "GET_RESULT_DETAILS",
      },
      (response) => {
        if (response) {
          console.log("Results details received:", response);
          this.handleDataReceived(response.data);
        } else {
          console.error("No RESULT details received.");
          this.showError("Không thể tải dữ liệu cookie.");
        }
      }
    );
  }

  handleDataReceived(cookieData) {
    try {
      this.data = cookieData;
      this.processedCookies = this.processData(cookieData);
      this.filteredCookies = [...this.processedCookies];

      this.updateStatistics();
      this.updateHeader(cookieData);
      this.createCharts();
      this.renderCookies();
    } catch (error) {
      console.error("Error processing cookie data:", error);
      this.showError("Lỗi khi xử lý dữ liệu cookie.");
    }
  }

  // processData(data) {
  //     console.log("Processing cookie data...", data);
  //     const cookieMap = new Map();

  //     // Process declared cookies (từ declared_cookie_details)
  //     if (data.details && data.details.declared_cookie_details) {
  //         data.details.declared_cookie_details.forEach(cookie => {
  //             cookieMap.set(cookie.name, {
  //                 name: cookie.name,
  //                 type: 'declared',
  //                 declared: cookie,
  //                 realtime: null,
  //                 violations: []
  //             });
  //         });
  //     }

  //     console.log("Declared cookies processed:", cookieMap);
  //     // Process realtime cookies (từ realtime_cookie_details)
  //     if (data.details && data.details.realtime_cookie_details) {
  //         data.details.realtime_cookie_details.forEach(cookie => {
  //             if (cookieMap.has(cookie.name)) {
  //                 // Cookie tồn tại cả trong declared và realtime
  //                 const existing = cookieMap.get(cookie.name);
  //                 existing.type = 'both';
  //                 existing.realtime = cookie;
  //             } else {
  //                 // Cookie chỉ có trong realtime (undeclared cookie)
  //                 cookieMap.set(cookie.name, {
  //                     name: cookie.name,
  //                     type: 'realtime',
  //                     declared: null,
  //                     realtime: cookie,
  //                     violations: []
  //                 });
  //             }
  //         });
  //     }

  //     // Process violations từ issues array
  //     if (data.issues && Array.isArray(data.issues)) {
  //         data.issues.forEach(issue => {
  //             const cookieName = issue.cookie_name;
  //             if (cookieMap.has(cookieName)) {
  //                 const cookie = cookieMap.get(cookieName);
  //                 cookie.violations.push({
  //                     issue_id: issue.issue_id,
  //                     type: issue.type,
  //                     category: issue.category,
  //                     severity: issue.severity,
  //                     description: issue.description,
  //                     details: issue.details
  //                 });
  //             }
  //         });
  //     }

  //     // Sắp xếp theo tên cookie
  //     const result = Array.from(cookieMap.values()).sort((a, b) => a.name.localeCompare(b.name));

  //     console.log("Processed cookies:", result);
  //     return result;
  // }

  processData(data) {
    console.log("Processing cookie data...", data);

    // Tạo Set để lưu tên các cookie từ từng nguồn
    const declaredCookieNames = new Set();
    const realtimeCookieNames = new Set();

    // Map để lưu chi tiết cookie theo tên
    const declaredCookiesMap = new Map();
    const realtimeCookiesMap = new Map();

    // Thu thập declared cookies
    if (data.details && data.details.declared_cookie_details) {
      data.details.declared_cookie_details.forEach((cookie) => {
        declaredCookieNames.add(cookie.cookie_name);
        declaredCookiesMap.set(cookie.cookie_name, cookie);
      });
    }

    // Thu thập realtime cookies
    if (data.details && data.details.realtime_cookie_details) {
      data.details.realtime_cookie_details.forEach((cookie) => {
        realtimeCookieNames.add(cookie.name);
        realtimeCookiesMap.set(cookie.name, cookie);
      });
    }

    console.log("Declared cookie names:", declaredCookieNames);
    console.log("Realtime cookie names:", realtimeCookieNames);

    // Tìm các tập hợp con
    const bothCookieNames = new Set(
      [...declaredCookieNames].filter((name) => realtimeCookieNames.has(name))
    );
    const onlyDeclaredNames = new Set(
      [...declaredCookieNames].filter((name) => !realtimeCookieNames.has(name))
    );
    const onlyRealtimeNames = new Set(
      [...realtimeCookieNames].filter((name) => !declaredCookieNames.has(name))
    );

    console.log("Both cookies:", bothCookieNames);
    console.log("Only declared:", onlyDeclaredNames);
    console.log("Only realtime:", onlyRealtimeNames);

    const cookieMap = new Map();

    // Xử lý cookies có cả declared và realtime
    bothCookieNames.forEach((name) => {
      cookieMap.set(name, {
        name: name,
        type: "both",
        declared: declaredCookiesMap.get(name),
        realtime: realtimeCookiesMap.get(name),
        violations: [],
      });
    });

    // Xử lý cookies chỉ có declared
    onlyDeclaredNames.forEach((name) => {
      cookieMap.set(name, {
        name: name,
        type: "declared",
        declared: declaredCookiesMap.get(name),
        realtime: null,
        violations: [],
      });
    });

    // Xử lý cookies chỉ có realtime (undeclared)
    onlyRealtimeNames.forEach((name) => {
      cookieMap.set(name, {
        name: name,
        type: "realtime",
        declared: null,
        realtime: realtimeCookiesMap.get(name),
        violations: [],
      });
    });

    // Process violations từ issues array
    if (data.issues && Array.isArray(data.issues)) {
      data.issues.forEach((issue) => {
        const cookieName = issue.cookie_name;
        if (cookieMap.has(cookieName)) {
          const cookie = cookieMap.get(cookieName);
          cookie.violations.push({
            issue_id: issue.issue_id,
            type: issue.type,
            category: issue.category,
            severity: issue.severity,
            description: issue.description,
            details: issue.details,
          });
        }
      });
    }

    const result = Array.from(cookieMap.values()).sort((a, b) => {
      const aHasViolations = a.violations.length > 0;
      const bHasViolations = b.violations.length > 0;

      if (aHasViolations && !bHasViolations) return -1;
      if (!aHasViolations && bHasViolations) return 1;

      return a.name.localeCompare(b.name);
    });

    console.log("Processed cookies:", result);
    return result;
  }

  updateStatistics() {
    const stats = this.calculateStatistics();

    document.getElementById("total-violations").textContent =
      this.data.total_issues || 0;
    document.getElementById("compliance-score-stat").textContent = `${
      this.data.compliance_score || 0
    }/100`;
    document.getElementById("declared-cookies").textContent =
      this.data.policy_cookies_count || 0;
    document.getElementById("realtime-cookies").textContent =
      this.data.actual_cookies_count || 0;
  }

  calculateStatistics() {
    const totalViolations = this.processedCookies.reduce(
      (sum, cookie) => sum + cookie.violations.length,
      0
    );
    const declaredCount = this.processedCookies.filter(
      (c) => c.type === "declared" || c.type === "both"
    ).length;
    const realtimeCount = this.processedCookies.filter(
      (c) => c.type === "realtime" || c.type === "both"
    ).length;
    const bothCount = this.processedCookies.filter(
      (c) => c.type === "both"
    ).length;

    return {
      totalViolations,
      declaredCount,
      realtimeCount,
      bothCount,
    };
  }

  updateHeader(data) {
    // Update website domain if available
    if (data.website_url) {
      try {
        const url = new URL(data.website_url);
        const policy_url = data.policy_url;
        if (policy_url) {
          document.getElementById(
            "policy-url"
          ).innerHTML = `<a href="${policy_url}" target="_blank">Click to View</a>`;
        } else {
          document.getElementById("policy-url").textContent =
            "Không có chính sách cookie được khai báo";
        }
        document.getElementById("website-domain").textContent = url.hostname;
      } catch (e) {
        document.getElementById("website-domain").textContent =
          data.website_url || "Unknown Domain";
      }
    }

    // Update compliance badge
    const totalViolations = data.total_issues || 0;
    const complianceBadge = document.getElementById("compliance-badge");
    const complianceScore = document.getElementById("compliance-score");

    if (totalViolations === 0) {
      complianceBadge.className = "compliance-badge compliance-good";
      complianceScore.textContent = "Tuân thủ tốt";
    } else if (totalViolations <= 5) {
      complianceBadge.className = "compliance-badge compliance-warning";
      complianceScore.textContent = "Cần cải thiện";
    } else {
      complianceBadge.className = "compliance-badge compliance-danger";
      complianceScore.textContent = "Nhiều vi phạm";
    }

    // Update analysis date
    if (data.analysis_date) {
      const date = new Date(data.analysis_date);
      document.getElementById(
        "analysis-date"
      ).textContent = `Phân tích lúc: ${date.toLocaleString("vi-VN")}`;
    }
  }

  createCharts() {
    this.createSeverityChart();
    this.createTypeChart();
    this.createDeclaredCookiesByThirdPartyChart();
  }

  createSeverityChart() {
    const ctx = document.getElementById("severityChart").getContext("2d");
    const data = this.data.statistics.by_severity;

    document.getElementById("severity-chart-loading").classList.add("hidden");
    document.getElementById("severityChart").classList.remove("hidden");

    this.charts.severity = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(data),
        datasets: [
          {
            label: "Violations",
            data: Object.values(data),
            backgroundColor: [
              "#e74c3c", // Critical - Red
              "#f39c12", // High - Orange
              "#f1c40f", // Medium - Yellow
              "#27ae60", // Low - Green
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });
  }

  createTypeChart() {
    const ctx = document.getElementById("typeChart").getContext("2d");
    const data = this.data.statistics.by_category;

    document.getElementById("type-chart-loading").classList.add("hidden");
    document.getElementById("typeChart").classList.remove("hidden");

    this.charts.type = new Chart(ctx, {
      type: "bar",
      data: {
        labels: Object.keys(data),
        datasets: [
          {
            label: "Violations",
            data: Object.values(data),
            backgroundColor: [
              "#3498db", // Specific - Blue
              "#9b59b6", // General - Purple
              "#e67e22", // Undefined - Orange
            ],
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });
  }

  createDeclaredCookiesByThirdPartyChart() {
    const ctx = document
      .getElementById("declaredCookiesByThirdPartyChart")
      .getContext("2d");
    const declaredByThirdParty = this.data.details.declared_by_third_party;

    const labels = Object.keys(declaredByThirdParty);
    const data = labels.map(
      (thirdParty) => declaredByThirdParty[thirdParty].length
    );

    document
      .getElementById("third-party-declared-chart-loading")
      .classList.add("hidden");
    document
      .getElementById("declaredCookiesByThirdPartyChart")
      .classList.remove("hidden");

    this.charts.declaredCookiesByThirdParty = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [
          {
            label: "Declared Cookies",
            data: data,
            backgroundColor: "#2ecc71", // Green
            borderWidth: 1,
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            display: false,
          },
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1,
            },
          },
        },
      },
    });
  }

  renderCookies() {
    const container = document.getElementById("cookieList");

    if (this.filteredCookies.length === 0) {
      container.innerHTML =
        '<div class="no-data">Không tìm thấy cookie nào phù hợp với bộ lọc.</div>';
      return;
    }

    // Tạo bảng với header
    container.innerHTML = `
            <div class="cookie-table">
                <div class="cookie-header">
                    <div class="header-cell name-col">Tên Cookie</div>
                    <div class="header-cell purpose-col">Mục đích khai báo</div>
                    <div class="header-cell third-party-col">Thu thập bởi</div>
                    <div class="header-cell retention-col">Thời gian lưu trữ</div>
                    <div class="header-cell violation-col">Trạng thái vi phạm</div>
                    <div class="header-cell expand-col"></div>
                </div>
                <div class="cookie-body"></div>
            </div>
        `;

    const tbody = container.querySelector(".cookie-body");

    this.filteredCookies.forEach((cookie, index) => {
      const row = this.createCookieRow(cookie, index);
      tbody.appendChild(row);
    });
  }

  createCookieRow(cookie, index) {
    const row = document.createElement("div");
    row.className = "cookie-row";

    row.innerHTML = `
            <div class="cookie-main">
            <div class="cell name-col">
                <div class="cookie-name">
                ${this.escapeHtml(cookie.name)}
                <span class="cookie-type-badge ${
                  cookie.type
                }">${this.getTypeLabel(cookie.type)}</span>
                </div>
            </div>
            <div class="cell purpose-col">${
              cookie.declared
                ? this.escapeHtml(cookie.declared.declared_purpose || "-")
                : "-"
            }</div>
            <div class="cell third-party-col">${
              cookie.declared
                ? this.escapeHtml(
                    cookie.declared.declared_third_parties?.join(", ") || "-"
                  )
                : this.escapeHtml(cookie.realtime?.domain || "-")
            }</div>
            <div class="cell retention-col">${
              cookie.declared
                ? this.escapeHtml(cookie.declared.declared_retention || "-")
                : this.formatExpiration(cookie.realtime)
            }</div>
            <div class="cell violation-col">
                <span class="violation-count ${
                  cookie.violations.length > 0
                    ? "has-violations"
                    : "no-violations"
                }">
                ${
                  cookie.violations.length > 0
                    ? "⚠️ " + cookie.violations.length + " vi phạm"
                    : "✅ Tuân thủ"
                }
                </span>
            </div>
            <div class="cell expand-col">
                <div class="expand-icon">▶</div>
            </div>
            </div>
            <div class="cookie-details">
            ${this.createDetailsContent(cookie)}
            </div>
        `;

    row.querySelector(".cookie-main").addEventListener("click", () => {
      this.toggleDetails(index);
    });

    return row;
  }

  createDetailsContent(cookie) {
    return `
            <div class="details-content">
                <div class="details-grid">
                    <div class="detail-section">
                        <h4>Thông tin khai báo</h4>
                        ${
                          cookie.declared
                            ? this.createDeclaredDetails(cookie.declared)
                            : '<p style="color: #6b7280;">Không có thông tin khai báo</p>'
                        }
                    </div>
                    <div class="detail-section">
                        <h4>Thông tin realtime</h4>
                        ${
                          cookie.realtime
                            ? this.createRealtimeDetails(cookie.realtime)
                            : '<p style="color: #6b7280;">Không phát hiện cookie realtime</p>'
                        }
                    </div>
                </div>
                ${
                  cookie.violations.length > 0
                    ? this.createViolationsSection(cookie.violations)
                    : ""
                }
            </div>
        `;
  }

  createDeclaredDetails(declared) {
    return `
            <div class="detail-item">
                <span class="detail-label">Mục đích:</span>
                <span class="detail-value">${this.escapeHtml(
                  declared.declared_purpose || "-"
                )}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Thời gian lưu:</span>
                <span class="detail-value">${this.escapeHtml(
                  declared.declared_retention || "-"
                )}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Bên thứ ba:</span>
                <span class="detail-value">${this.escapeHtml(
                  declared.declared_third_parties?.join(", ") || "-"
                )}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Mô tả:</span>
                <span class="detail-value">${this.escapeHtml(
                  declared.declared_description || "-"
                )}</span>
            </div>
        `;
  }

  createRealtimeDetails(realtime) {
    return `
            <div class="detail-item">
                <span class="detail-label">Domain:</span>
                <span class="detail-value">${this.escapeHtml(
                  realtime.domain || "-"
                )}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Hết hạn:</span>
                <span class="detail-value">${this.formatExpiration(
                  realtime
                )}</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">Secure:</span>
                <span class="detail-value">${
                  realtime.secure ? "Có" : "Không"
                }</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">HttpOnly:</span>
                <span class="detail-value">${
                  realtime.httpOnly ? "Có" : "Không"
                }</span>
            </div>
            <div class="detail-item">
                <span class="detail-label">SameSite:</span>
                <span class="detail-value">${this.escapeHtml(
                  realtime.sameSite || "-"
                )}</span>
            </div>
        `;
  }

  createViolationsSection(violations) {
    const violationItems = violations
      .map(
        (violation) => `
            <div class="violation-item">
                <div class="violation-header">
                    <span class="severity-badge severity-${
                      violation.severity?.toLowerCase() || "unknown"
                    }">${this.escapeHtml(
          violation.severity || "Unknown"
        )}</span>
                    <span style="color: #6b7280; font-size: 12px;">${this.escapeHtml(
                      (violation.category || "Unknown") +
                        " - " +
                        (violation.type || "Unknown")
                    )}</span>
                </div>
                <div class="violation-title">Vi phạm quy tắc ${this.escapeHtml(
                  violation.issue_id || "N/A"
                )}</div>
                <div class="violation-description">${this.escapeHtml(
                  violation.description || "Không có mô tả"
                )}</div>
            </div>
        `
      )
      .join("");

    return `
            <div class="violations-section">
                <h4 style="color: #dc2626; margin-bottom: 16px;">Vi phạm phát hiện</h4>
                ${violationItems}
            </div>
        `;
  }

  setupEventListeners() {
    // Filter buttons
    document.querySelectorAll(".filter-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        this.handleFilterChange(e.target.dataset.filter);
      });
    });

    // Search input
    const searchInput = document.getElementById("searchInput");
    if (searchInput) {
      searchInput.addEventListener("input", (e) => {
        this.handleSearch(e.target.value);
      });
    }
  }

  handleFilterChange(filter) {
    // Update active filter button
    document
      .querySelectorAll(".filter-btn")
      .forEach((btn) => btn.classList.remove("active"));
    document.querySelector(`[data-filter="${filter}"]`).classList.add("active");

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
    switch (this.currentFilter) {
      case "declared":
        filtered = filtered.filter(
          (c) => c.type === "declared" || c.type === "both"
        );
        break;
      case "realtime":
        filtered = filtered.filter(
          (c) => c.type === "realtime" || c.type === "both"
        );
        break;
      case "both":
        filtered = filtered.filter((c) => c.type === "both");
        break;
      case "violations":
        filtered = filtered.filter((c) => c.violations.length > 0);
        break;
      case "no-violations":
        filtered = filtered.filter((c) => c.violations.length === 0);
        break;
      // 'all' case - no filtering needed
    }

    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(
        (cookie) =>
          cookie.name.toLowerCase().includes(this.searchTerm) ||
          cookie.declared?.declared_purpose
            ?.toLowerCase()
            .includes(this.searchTerm) ||
          cookie.declared?.declared_description
            ?.toLowerCase()
            .includes(this.searchTerm)
      );
    }

    this.filteredCookies = filtered;
    this.renderCookies();
  }

  toggleDetails(index) {
    const rows = document.querySelectorAll(".cookie-row");
    if (rows[index]) {
      rows[index].classList.toggle("expanded");
    }
  }

  getTypeLabel(type) {
    const labels = {
      declared: "Đã khai báo",
      realtime: "Realtime",
      both: "Cookie thu thập được khai báo",
    };
    return labels[type] || "Không xác định";
  }

  formatExpiration(cookie) {
    if (!cookie?.expirationDate) return "-";
    try {
      const date = new Date(cookie.expirationDate);
      return (
        date.toLocaleDateString("vi-VN") +
        " " +
        date.toLocaleTimeString("vi-VN")
      );
    } catch (e) {
      return "-";
    }
  }

  escapeHtml(text) {
    if (typeof text !== "string") return text;
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  showError(message) {
    const container = document.getElementById("cookieList");
    container.innerHTML = `<div class="error-message">${this.escapeHtml(
      message
    )}</div>`;
  }
}

// Initialize the dashboard
const cookieDashboard = new CookieDashboard();
console.log(cookieDashboard.processedCookies);
