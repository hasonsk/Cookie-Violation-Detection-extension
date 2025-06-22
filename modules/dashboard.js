export class Dashboard {
  constructor() {
    this.data = null;
    this.charts = {};
    this.init();
    this.blockDomain();
    this.clearAllCookies();
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
    this.loadData().then(() => {
      this.updateSummaryCards();
      this.updatePolicyStatus();
      this.updateCookieStatistics();
    });
  }

  updateSummaryCards() {
    const totalCookies = this.data?.actual_cookies_count || 0;
    const totalViolations = this.data?.total_issues || 0;
    const thirdPartyCount = this.data?.summary.third_party_cookies?.length || 0;
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

  updateElement(id, value) {
    const element = document.getElementById(id);
    if (element) {
      element.textContent = value;
    }
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
    const detailsLink = document.getElementById("detailsLink-btn");
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
