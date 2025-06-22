// modules/dashboard.js
export class Dashboard {
  constructor() {
    this.data = null;
    this.charts = {};
    this.init();
    this.viewAllViolations();
    this.blockDomain();
    this.clearAllCookies();
    this.exportReport();
    this.viewPolicy();
    this.checkAgain();
    this.addDetailsLinkEvent();
  }

  init() {
    setTimeout(() => {
      this.loadData().then(() => {
        this.updateDashboard();
      });
    }, 1000);
  }

  async loadData() {
    try {
      const response = await chrome.runtime.sendMessage({ action: "GET_COMPLIANCE_RESULT" });
      if (response && response.data) {
        this.data = response.data;
        console.log("Data loaded from background script:", this.data);
      } else {
        alert("No data received from background script.");
      }
    } catch (error) {
      alert("Error fetching data from background script:", error);
    }
  }

  updateDashboard() {
    this.loadData();
    this.updateSummaryCards();
    this.updatePolicyStatus();
    this.updateCookieStatistics();
    this.createCharts();
    this.updateViolationsList();
  }

  updateSummaryCards() {
    const totalCookies = this.data.actual_cookies_count;
    const totalViolations = this.data.total_issues;
    const thirdPartyCount = this.data.summary.third_party_cookies?.length || 0;
    const firstPartyCount = totalCookies - thirdPartyCount;

    this.updateElement("cookies-monitored", totalCookies);
    this.updateElement("violations-detected", totalViolations);
    this.updateElement("third-party", thirdPartyCount);
    this.updateElement("first-party", firstPartyCount);
  }

  updatePolicyStatus() {
    const policyElement = document.getElementById("policy-status");

    if (this.data.policy_url) {
      policyElement.innerHTML = `
              <a href="${this.data.policy_url}" class="policy-link" target="_blank">
                  Cookie Policy Found - Click to View
              </a>
          `;
    } else {
      policyElement.innerHTML = `
              <div class="policy-warning">
                  ⚠️ Không tìm thấy chính sách cookie được khai báo
              </div>
          `;
    }
  }

  updateCookieStatistics() {
    this.updateElement("declared-cookies", this.data.policy_cookies_count);
    this.updateElement("actual-cookies", this.data.actual_cookies_count);
    this.updateElement("compliance-score", `${this.data.compliance_score}/100`);
  }

  createCharts() {
    this.destroyExistingCharts();
    if(this.data.statistics.by_severity)
      this.createSeverityChart();
    if(this.data.statistics.by_category)
      this.createTypeChart();
    if(this.data.statistics.declared_cookies_by_third_party)
      this.createDeclaredCookiesByThirdPartyChart();
  }

  destroyExistingCharts() {
    // Destroy existing charts if they exist
    if (this.charts.severity) {
      this.charts.severity.destroy();
      this.charts.severity = null;
    }
    if (this.charts.type) {
      this.charts.type.destroy();
      this.charts.type = null;
    }
    if (this.charts.declaredCookiesByThirdParty) {
      this.charts.declaredCookiesByThirdParty.destroy();
      this.charts.declaredCookiesByThirdParty = null;
    }
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
    const ctx = document.getElementById("declaredCookiesByThirdPartyChart").getContext("2d");
    const declaredByThirdParty = this.data.details.declared_by_third_party;

    const labels = Object.keys(declaredByThirdParty);
    const data = labels.map(thirdParty => declaredByThirdParty[thirdParty].length);

    document.getElementById("third-party-declared-chart-loading").classList.add("hidden");
    document.getElementById("declaredCookiesByThirdPartyChart").classList.remove("hidden");

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

  updateViolationsList() {
    const listElement = document.getElementById("violations-list");

    const severityOrder = {
      "Critical": 4,
      "High": 3,
      "Medium": 2,
      "Low": 1
    };

    // Sort issues by severity in descending order
    const sortedViolations = [...this.data.issues].sort((a, b) => {
      return severityOrder[b.severity] - severityOrder[a.severity];
    });

    const topViolations = sortedViolations.slice(0, 5);

    const html = topViolations
      .map(
        (violation) => `
          <div class="violation-item">
              <div class="violation-icon ${violation.severity.toLowerCase()}">
                  !
              </div>
              <div class="violation-content">
                  <div class="violation-title">${violation.cookie_name}</div>
                  <div class="violation-subtitle">${violation.description}</div>
              </div>
              <div class="violation-severity ${violation.severity.toLowerCase()}">
                  ${violation.severity}
              </div>
          </div>
      `
      )
      .join("");

    listElement.innerHTML = html;
  }

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
  }

  // Action Methods
  viewAllViolations() {
    const viewAllBtn = document.getElementById("view-all-violations-btn");
    if (viewAllBtn) {
      viewAllBtn.addEventListener("click", function () {
      });
    }
    // Implement navigation to detailed violations page
  }

  blockDomain() {
    const blockDomainBtn = document.getElementById("block-domain-btn");
    if (blockDomainBtn) {
      blockDomainBtn.addEventListener("click", function () {
        const domain = new URL(this.data.website_url).hostname;
        if (confirm(`Block domain ${domain}?`)) {
          alert(`Domain ${domain} has been blocked.`);
        }
      });
    }
  }

  clearAllCookies() {
    const clearAllCookiesBtn = document.getElementById("clear-all-cookies-btn");
    if (clearAllCookiesBtn) {
      clearAllCookiesBtn.addEventListener("click", function () {
        if (
          confirm(
            "Are you sure you want to clear all cookies? This action cannot be undone."
          )
        ) {
          alert("All cookies have been cleared.");
        }
      });
    }
  }

  exportReport() {
    const exportReportBtn = document.getElementById("export-report-btn");
    if (exportReportBtn) {
      exportReportBtn.addEventListener("click", function () {
        alert("Exporting compliance report...");
        // Implement report export functionality
      });
    }
  }

  viewPolicy() {
    const viewPolicyBtn = document.getElementById("view-policy-btn");
    if (viewPolicyBtn) {
      viewPolicyBtn.addEventListener("click", function () {
        if (this.data.website_url) {
          window.open(this.data.website_url, "_blank");
        } else {
          alert("No cookie policy found for this website.");
        }
      });
    }
  }

  addDetailsLinkEvent() {
    const detailsLink = document.getElementById("detailsLink");
    if (detailsLink) {
      detailsLink.addEventListener("click", async (event) => {
        event.preventDefault(); // Prevent default link behavior

        try {
          const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
          const currentTab = tabs[0];

            if (currentTab && currentTab.url) {
              const domain = new URL(currentTab.url).origin;
              localStorage.setItem("currentTabDomain", domain);
              const key = "currentTabDomain";
              const value = domain;
              chrome.storage.local.set({ [key]: value });
              window.open("details.html?domain=" + encodeURIComponent(domain), "_blank");
            }

        } catch (error) {
          alert("Error getting current tab URL. See console for details.");
        }
      });
    }
  }

  checkAgain() {
    const checkAgainBtn = document.getElementById("check-again-btn");
    if (checkAgainBtn) {
      checkAgainBtn.addEventListener("click", async () => {
        try {
          // Hiển thị loading
          document.querySelectorAll(".value").forEach((el) => {
            el.innerHTML = '<div class="loading"><i data-lucide="loader-2"></i></div>';
          });

          // Gửi request CHECK_AGAIN
          const response = await chrome.runtime.sendMessage({ action: "CHECK_AGAIN" });

          if (response.success) {
            // Cập nhật dashboard với dữ liệu mới
            this.updateDashboard();
            console.log("Compliance check refreshed successfully");
          } else {
            console.error("Check again failed:", response.error);
            // Hiển thị lỗi cho user
            this.showError(response.error || "Failed to refresh compliance check");
          }
        } catch (error) {
          console.error("Error in check again:", error);
          this.showError("Failed to refresh compliance check");
        }
      });
    }
  }

}
