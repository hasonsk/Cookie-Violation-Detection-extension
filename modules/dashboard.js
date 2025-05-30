// modules/dashboard.js
export class Dashboard {
  constructor() {
    this.statsElements = {
      cookiesMonitored: document.querySelector('.summary-cards .card:nth-child(1) .value'),
      violationsDetected: document.querySelector('.summary-cards .card:nth-child(2) .value'),
      thirdParty: document.querySelector('.summary-cards .card:nth-child(3) .value'),
      firstParty: document.querySelector('.summary-cards .card:nth-child(4) .value')
    };
  }

  init() {
    this.updateStats();
  }

  async updateStats() {
    try {
      const { TabManager } = await import('./tab-manager.js');
      const tabManager = new TabManager();
      const tabId = await tabManager.getCurrentTabId();

      if (tabId) {
        this.loadStatsForTab(tabId);
      }
    } catch (error) {
      console.error('Error updating dashboard stats:', error);
    }
  }

  loadStatsForTab(tabId) {
    chrome.runtime.sendMessage({ action: 'GET_COOKIES' }, (response) => {

      if (response && response.success) {
      const data = {
        cookiesByTab: {
        [tabId]: response.data
        }
      };

      // Initialize stats
      let totalCookies = 0;
      let firstPartyCount = 0;
      let thirdPartyCount = 0;
      let violationsCount = 0;

      if (data.cookiesByTab && data.cookiesByTab[tabId] && data.cookiesByTab[tabId].length > 0) {
        const tabCookies = data.cookiesByTab[tabId];

        // Calculate statistics
        const uniqueDomains = new Set();

        tabCookies.forEach(cookie => {
          totalCookies++;
          uniqueDomains.add(cookie.domain);

          if (cookie.isThirdParty) {
            thirdPartyCount++;
          } else {
            firstPartyCount++;
          }

          // Check for violations
          // if (this.checkCookieViolations(cookie)) {
          //   violationsCount++;
          // }
        });

        // Update domain stats
        this.updateDomainStats(tabCookies);
      }

      // Update dashboard stats
      this.updateStatsDisplay({
        totalCookies,
        violationsCount,
        thirdPartyCount,
        firstPartyCount
      });
      };
    });
  }

  updateStatsDisplay(stats) {
    if (this.statsElements.cookiesMonitored) {
      this.statsElements.cookiesMonitored.textContent = stats.totalCookies;
    }
    if (this.statsElements.violationsDetected) {
      this.statsElements.violationsDetected.textContent = stats.violationsCount;
    }
    if (this.statsElements.thirdParty) {
      this.statsElements.thirdParty.textContent = stats.thirdPartyCount;
    }
    if (this.statsElements.firstParty) {
      this.statsElements.firstParty.textContent = stats.firstPartyCount;
    }
  }

  updateDomainStats(cookies) {
    const domainCounts = {};

    // Count cookies from each domain
    cookies.forEach(cookie => {
      const domain = cookie.domain;
      if (!domainCounts[domain]) {
        domainCounts[domain] = {
          total: 0,
          firstParty: 0,
          thirdParty: 0
        };
      }

      domainCounts[domain].total++;
      if (cookie.isThirdParty) {
        domainCounts[domain].thirdParty++;
      } else {
        domainCounts[domain].firstParty++;
      }
    });

    // Convert to array and sort by total count
    const domainArray = Object.entries(domainCounts)
      .map(([domain, counts]) => ({ domain, ...counts }))
      .sort((a, b) => b.total - a.total);

    // Update top domains list
    const topDomainsList = document.getElementById('top-domains');
    if (topDomainsList) {
      topDomainsList.innerHTML = '';

      const topDomains = domainArray.slice(0, 10);
      topDomains.forEach(item => {
        const li = document.createElement('li');
        li.innerHTML = `<strong>${item.domain}</strong>: ${item.total} cookies (${item.firstParty} first-party, ${item.thirdParty} third-party)`;
        topDomainsList.appendChild(li);
      });
    }
  }

  checkCookieViolations(cookie) {
    // Simple violation checks
    const violations = [];

    // Check for session cookies that persist too long
    if (!cookie.expires) {
      if (cookie.cookieName.includes('_ga') || cookie.cookieName.includes('_gid')) {
        violations.push('Analytics cookie without proper expiration');
      }
    } else {
      const expiryDate = new Date(cookie.expires);
      const now = new Date();
      const diffYears = (expiryDate - now) / (1000 * 60 * 60 * 24 * 365);

      if (diffYears > 2) {
        violations.push('Cookie expires more than 2 years in the future');
      }
    }

    // Check for third-party tracking cookies
    if (cookie.isThirdParty && (
      cookie.cookieName.includes('_ga') ||
      cookie.cookieName.includes('_gid') ||
      cookie.cookieName.includes('__gads') ||
      cookie.cookieName.includes('_fbp')
    )) {
      violations.push('Third-party tracking cookie detected');
    }

    // Check for insecure cookies
    if (!cookie.secure && cookie.domain.includes('https')) {
      violations.push('Cookie should be marked as Secure');
    }

    return violations.length > 0;
  }

  resetStats() {
    this.updateStatsDisplay({
      totalCookies: 0,
      violationsCount: 0,
      thirdPartyCount: 0,
      firstPartyCount: 0
    });
  }
}
