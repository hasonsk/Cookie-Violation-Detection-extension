export class CookieManager {
  constructor() {
    this.currentCookies = [];
  }

  init() {
    this.setupCookieFilters();
    this.setupSearchFunctionality();
    this.setupExportButtons();
  }

  async loadCookieDataForTab(tabId) {
    return new Promise((resolve) => {
      chrome.storage.local.get('cookiesByTab', (data) => {
        if (data.cookiesByTab && data.cookiesByTab[tabId] && data.cookiesByTab[tabId].length > 0) {
          this.currentCookies = data.cookiesByTab[tabId];
          this.updateCookieListDisplay(this.currentCookies);
        } else {
          this.currentCookies = [];
          this.clearDisplay();
        }
        resolve();
      });
    });
  }

  updateCookieListDisplay(cookies) {
    // Clear existing cookie items
    const cookiePanel = document.querySelector('#cookies-screen .panel');
    if (!cookiePanel) return;

    // Keep only the first child (if it exists) and remove the rest
    const children = Array.from(cookiePanel.children);
    children.slice(1).forEach(child => child.remove());

    // Sort cookies by timestamp (newest first)
    const sortedCookies = [...cookies].sort((a, b) => {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    // Create cookie items
    sortedCookies.forEach((cookie, index) => {
      const cookieElement = this.createCookieElement(cookie, index);
      cookiePanel.appendChild(cookieElement);
    });

    // Re-initialize icons for new elements
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Re-attach click handlers for new cookie items
    this.attachCookieEventHandlers();
  }

  createCookieElement(cookie, index) {
    const cookieId = `cookie-${index}`;
    const hasViolation = this.checkCookieViolations(cookie);

    const cookieDiv = document.createElement('div');
    cookieDiv.className = 'list-divider';
    cookieDiv.innerHTML = `
      <div class="cookie-item ${hasViolation ? 'violation' : ''}" data-id="${cookieId}">
        <div class="icon">
          <i data-lucide="${hasViolation ? 'alert-triangle' : 'check-circle'}" size="16" class="${hasViolation ? 'text-red-600' : 'green'}"></i>
        </div>
        <div class="content">
          <div class="title">${cookie.cookieName}</div>
          <div class="subtitle">
            ${cookie.domain} · ${this.formatCookieExpiry(cookie.expires)} ${hasViolation ? '(Violation detected)' : ''}
          </div>
        </div>
        <i data-lucide="chevron-right" size="16" class="chevron"></i>
      </div>
      <div class="cookie-details" id="${cookieId}-details">
        <div class="details-grid">
          <div>
            <div class="detail-label">Domain</div>
            <div>${cookie.domain}</div>
          </div>
          <div>
            <div class="detail-label">Path</div>
            <div>${cookie.path || '/'}</div>
          </div>
          <div>
            <div class="detail-label">Type</div>
            <div>${cookie.isThirdParty ? 'Third-party' : 'First-party'}</div>
          </div>
          <div>
            <div class="detail-label">Security</div>
            <div>${cookie.secure ? 'Secure' : 'Not Secure'} ${cookie.httpOnly ? '| HttpOnly' : ''}</div>
          </div>
          <div>
            <div class="detail-label">SameSite</div>
            <div>${cookie.sameSite || 'None'}</div>
          </div>
          <div>
            <div class="detail-label">Created</div>
            <div>${this.formatTimestamp(cookie.timestamp)}</div>
          </div>
        </div>
        ${hasViolation ? `
          <div class="violation-alert">
            <div class="title">Violations:</div>
            <ul class="violation-list">
              ${this.getViolationMessages(cookie).map(msg => `<li>${msg}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    return cookieDiv;
  }

  attachCookieEventHandlers() {
    document.querySelectorAll('.cookie-item').forEach(item => {
      item.addEventListener('click', function() {
        const id = this.getAttribute('data-id');
        const details = document.getElementById(`${id}-details`);
        const chevron = this.querySelector('.chevron');

        if (details) {
          if (details.style.display === 'block') {
            details.style.display = 'none';
            if (chevron) chevron.classList.remove('expanded');
          } else {
            details.style.display = 'block';
            if (chevron) chevron.classList.add('expanded');
          }
        }
      });
    });
  }

  setupCookieFilters() {
    document.querySelectorAll('.filters .filter-button').forEach(button => {
      button.addEventListener('click', () => {
        const filter = button.getAttribute('data-filter');
        if (filter) {
          // Update active state of filter buttons
          button.parentNode.querySelectorAll('.filter-button').forEach(btn => {
            btn.classList.remove('active');
          });
          button.classList.add('active');

          // Apply the filter to the cookie list
          this.applyFilter(filter);
        }
      });
    });

    // Listen for filter events from other modules
    if (window.appEventBus) {
      window.appEventBus.on('applyFilter', (filter) => {
        this.applyFilter(filter);
      });
    }
  }

  setupSearchFunctionality() {
    const searchInput = document.querySelector('#cookies-screen .search-box input');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        this.filterCookiesBySearch(searchTerm);
      });
    }
  }

  setupExportButtons() {
    // Add event listeners for export and clear functions
    const exportButton = document.getElementById('export-csv');
    const clearButton = document.getElementById('clear-data');

    if (exportButton) {
      exportButton.addEventListener('click', () => this.exportToCsv());
    }

    if (clearButton) {
      clearButton.addEventListener('click', () => this.clearCookieData());
    }
  }

  applyFilter(filterType) {
    const cookieItems = document.querySelectorAll('.cookie-item');

    cookieItems.forEach(item => {
      const parentDiv = item.parentNode;

      // Reset display for all items first
      if (parentDiv) parentDiv.style.display = 'block';

      switch (filterType) {
        case 'all':
          // Show all cookies
          break;

        case 'violations':
          // Show only cookies with violations
          if (!item.classList.contains('violation')) {
            if (parentDiv) parentDiv.style.display = 'none';
          }
          break;

        case 'no-issues':
          // Show only cookies without violations
          if (item.classList.contains('violation')) {
            if (parentDiv) parentDiv.style.display = 'none';
          }
          break;

        case 'performance':
          // Show only performance cookies
          const isPerformance = item.querySelector('.subtitle')?.textContent.toLowerCase().includes('performance');
          if (!isPerformance) {
            if (parentDiv) parentDiv.style.display = 'none';
          }
          break;

        case 'tracking':
          // Show only tracking cookies
          const isTracking = item.querySelector('.content')?.textContent.toLowerCase().includes('track');
          if (!isTracking) {
            if (parentDiv) parentDiv.style.display = 'none';
          }
          break;
      }
    });
  }

  filterCookiesBySearch(searchTerm) {
    const cookieItems = document.querySelectorAll('.cookie-item');

    cookieItems.forEach(item => {
      const parentDiv = item.parentNode;
      const content = item.querySelector('.content')?.textContent.toLowerCase() || '';

      if (content.includes(searchTerm)) {
        if (parentDiv) parentDiv.style.display = 'block';
      } else {
        if (parentDiv) parentDiv.style.display = 'none';
      }
    });
  }

  async exportToCsv() {
    try {
      const { TabManager } = await import('./tab-manager.js');
      const tabManager = new TabManager();
      const tabId = await tabManager.getCurrentTabId();

      if (!tabId) return;

      chrome.storage.local.get('cookiesByTab', (data) => {
        if (!data.cookiesByTab || !data.cookiesByTab[tabId] || data.cookiesByTab[tabId].length === 0) {
          alert('Không có dữ liệu để xuất');
          return;
        }

        const tabCookies = data.cookiesByTab[tabId];
        this.generateCsvFile(tabCookies, tabId);
      });
    } catch (error) {
      console.error('Error exporting CSV:', error);
    }
  }

  generateCsvFile(cookies, tabId) {
    // Create CSV header
    let csvContent = 'Domain,Cookie Name,Value,Expires,Path,HttpOnly,Secure,SameSite,Type,Timestamp,URL\n';

    // Add data rows
    cookies.forEach(cookie => {
      const row = [
        cookie.domain,
        cookie.cookieName,
        cookie.cookieValue,
        cookie.expires,
        cookie.path,
        cookie.httpOnly,
        cookie.secure,
        cookie.sameSite,
        cookie.isThirdParty ? 'Third-party' : 'First-party',
        cookie.timestamp,
        cookie.url || ''
      ].map(item => `"${String(item || '').replace(/"/g, '""')}"`).join(',');

      csvContent += row + '\n';
    });

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    chrome.tabs.get(tabId, (tab) => {
      const domain = new URL(tab.url).hostname;

      link.setAttribute('href', url);
      link.setAttribute('download', `cookie_report_${domain}_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);

      URL.revokeObjectURL(url);
    });
  }

  async clearCookieData() {
    try {
      const { TabManager } = await import('./tab-manager.js');
      const tabManager = new TabManager();
      const tabId = await tabManager.getCurrentTabId();

      if (!tabId) return;

      chrome.storage.local.get('cookiesByTab', (data) => {
        if (data.cookiesByTab) {
          // Only clear cookies for current tab
          delete data.cookiesByTab[tabId];
          chrome.storage.local.set({ 'cookiesByTab': data.cookiesByTab }, () => {
            chrome.action.setBadgeText({ text: '' });
            this.currentCookies = [];
            this.clearDisplay();

            // Emit data cleared event
            if (window.appEventBus) {
              window.appEventBus.emit('dataCleared');
            }
          });
        }
      });
    } catch (error) {
      console.error('Error clearing cookie data:', error);
    }
  }

  clearDisplay() {
    const cookiePanel = document.querySelector('#cookies-screen .panel');
    if (cookiePanel) {
      const children = Array.from(cookiePanel.children);
      children.slice(1).forEach(child => child.remove());
    }
  }

  // Utility methods
  formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
  }

  formatCookieExpiry(expires) {
    if (!expires) return 'Session';

    const expiryDate = new Date(expires);
    const now = new Date();
    const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

    if (diffDays <= 0) return 'Expired';
    if (diffDays === 1) return '1 day';
    if (diffDays < 30) return `${diffDays} days`;
    if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months`;
    return `${Math.ceil(diffDays / 365)} years`;
  }

  checkCookieViolations(cookie) {
    const violations = [];

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

    if (cookie.isThirdParty && (
      cookie.cookieName.includes('_ga') ||
      cookie.cookieName.includes('_gid') ||
      cookie.cookieName.includes('__gads') ||
      cookie.cookieName.includes('_fbp')
    )) {
      violations.push('Third-party tracking cookie detected');
    }

    if (!cookie.secure && cookie.domain.includes('https')) {
      violations.push('Cookie should be marked as Secure');
    }

    return violations.length > 0;
  }

  getViolationMessages(cookie) {
    const violations = [];

    if (!cookie.expires) {
      if (cookie.cookieName.includes('_ga') || cookie.cookieName.includes('_gid')) {
        violations.push('Analytics cookie without proper expiration declaration');
      }
    } else {
      const expiryDate = new Date(cookie.expires);
      const now = new Date();
      const diffYears = (expiryDate - now) / (1000 * 60 * 60 * 24 * 365);

      if (diffYears > 2) {
        violations.push('Cookie expiration exceeds recommended duration');
      }
    }

    if (cookie.isThirdParty && (
      cookie.cookieName.includes('_ga') ||
      cookie.cookieName.includes('_gid') ||
      cookie.cookieName.includes('__gads') ||
      cookie.cookieName.includes('_fbp')
    )) {
      violations.push('Third-party tracking without explicit user consent');
    }

    if (!cookie.secure) {
      violations.push('Cookie transmitted over insecure connection');
    }

    return violations.length > 0 ? violations : ['No violations detected'];
  }
}
