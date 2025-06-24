export class DomainBlocking {
  constructor() {
    this.blockedDomains = [];
    this.isInitialized = false;
    this.availableDomains = []; // Danh sách domains từ cookies
  }

  async init() {
    if (this.isInitialized) return;

    try {
      await this.setupEventListeners();
      await this.loadBlockedDomains();
      await this.loadAvailableDomains(); // Thêm dòng này
      this.isInitialized = true;
      console.log('Domain Blocking module initialized');
    } catch (error) {
      console.error('Error initializing Domain Blocking module:', error);
    }
  }

  /**
   * Load available domains from cookies data
   */
  async loadAvailableDomains() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "GET_ALL_DOMAINS" }, (response) => {
        if (response && response.success) {
          this.availableDomains = response.data || [];
          this.setupDomainSuggestions();
        }
        resolve();
      });
    });
  }

  /**
   * Setup domain suggestions dropdown
   */
  setupDomainSuggestions() {
    const domainInput = document.getElementById('domain-to-block');
    const suggestionsDropdown = document.getElementById('suggestions-dropdown');

    if (!domainInput || !suggestionsDropdown) return;

    domainInput.addEventListener('input', (e) => {
      const query = e.target.value.trim().toLowerCase();

      if (query.length === 0) {
        suggestionsDropdown.style.display = 'none';
        return;
      }

      // Filter domains based on input
      const suggestions = this.availableDomains
        .filter(domain =>
          domain.toLowerCase().includes(query) &&
          !this.blockedDomains.includes(domain)
        )
        .slice(0, 5); // Limit to 5 suggestions

      if (suggestions.length === 0) {
        suggestionsDropdown.style.display = 'none';
        return;
      }

      // Render suggestions
      suggestionsDropdown.innerHTML = suggestions
        .map(domain => `
          <div class="suggestion-item" data-domain="${this.escapeHtml(domain)}">
            ${this.escapeHtml(domain)}
          </div>
        `).join('');

      // Add click handlers
      suggestionsDropdown.querySelectorAll('.suggestion-item').forEach(item => {
        item.addEventListener('click', () => {
          domainInput.value = item.getAttribute('data-domain');
          suggestionsDropdown.style.display = 'none';
        });
      });

      suggestionsDropdown.style.display = 'block';
    });

    // Hide suggestions when clicking outside
    document.addEventListener('click', (e) => {
      if (!domainInput.contains(e.target) && !suggestionsDropdown.contains(e.target)) {
        suggestionsDropdown.style.display = 'none';
      }
    });
  }

  /**
   * Setup event listeners for domain blocking UI
   */
  async setupEventListeners() {
    const addBlockButton = document.getElementById('add-block-domain');
    if (addBlockButton) {
      addBlockButton.addEventListener('click', () => this.addBlockedDomain());
    }

    // Setup domain input enter key handler
    const domainInput = document.getElementById('domain-to-block');
    if (domainInput) {
      domainInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          this.addBlockedDomain();
        }
      });
    }
  }

  /**
   * Load and display blocked domains from storage
   */
  async loadBlockedDomains() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "GET_BLOCKED_DOMAINS" }, (response) => {
        if (response && response.success) {
          this.blockedDomains = response.data || [];
          this.renderBlockedDomainsList();
          this.loadDomainStats(); // Thêm dòng này
        }
        resolve();
      });
    });
  }

  /**
   * Load and display domain statistics
   */
  async loadDomainStats() {
    return new Promise((resolve) => {
      chrome.runtime.sendMessage({ action: "GET_DOMAIN_STATS" }, (response) => {
        if (response && response.success) {
          this.renderDomainStats(response.data);
        }
        resolve();
      });
    });
  }

  /**
   * Render domain statistics
   */
  renderDomainStats(domainsData) {
    const topDomainsList = document.getElementById('top-domains');
    if (!topDomainsList || !domainsData) return;

    // Sort domains by cookie count
    const sortedDomains = domainsData
      .sort((a, b) => b.cookieCount - a.cookieCount)
      .slice(0, 10); // Top 10 domains

    topDomainsList.innerHTML = sortedDomains
      .map(domain => `
        <li class="domain-stat-item">
          <div class="domain-info">
            <span class="domain-name">${this.escapeHtml(domain.domain)}</span>
            <span class="cookie-count">${domain.cookieCount} cookies</span>
          </div>
          <div class="domain-actions">
            ${!this.blockedDomains.includes(domain.domain) ?
              `<button class="block-domain-btn" data-domain="${this.escapeHtml(domain.domain)}">
                <i data-lucide="shield" size="14"></i>
                Block
              </button>` :
              '<span class="blocked-label">Blocked</span>'
            }
          </div>
        </li>
      `).join('');

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Add event listeners for block buttons
    topDomainsList.querySelectorAll('.block-domain-btn').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const domain = button.getAttribute('data-domain');
        this.blockDomainFromStats(domain);
      });
    });
  }

  /**
   * Block domain from stats section
   */
  async blockDomainFromStats(domain) {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: "BLOCK_DOMAIN",
          domain: domain
        }, resolve);
      });

      if (response && response.success) {
        this.blockedDomains.push(domain);
        this.showSuccess(`Đã chặn ${domain}`);
        await this.loadBlockedDomains(); // Refresh the list
      } else {
        this.showError('Không thể chặn domain');
      }
    } catch (error) {
      console.error('Error blocking domain:', error);
      this.showError('Không thể chặn domain');
    }
  }

  /**
   * Render the list of blocked domains
   */
  renderBlockedDomainsList() {
    const blockedList = document.getElementById('blocked-domains-list');
    if (!blockedList) return;

    // Clear existing list
    blockedList.innerHTML = '';

    if (this.blockedDomains.length > 0) {
      this.blockedDomains.forEach(domain => {
        const li = document.createElement('li');
        li.className = 'blocked-domain-item';
        li.innerHTML = `
          <span class="domain-name">${this.escapeHtml(domain)}</span>
          <button class="remove-domain btn-danger"
                  data-domain="${this.escapeHtml(domain)}"
                  title="Remove ${this.escapeHtml(domain)}">
            <i data-lucide="x" size="14"></i>
            Xóa
          </button>
        `;
        blockedList.appendChild(li);
      });

      // Re-initialize Lucide icons
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }

      // Add event listeners for remove buttons
      this.attachRemoveListeners();
    } else {
      this.renderEmptyState(blockedList);
    }
  }

  /**
   * Render empty state when no domains are blocked
   */
  renderEmptyState(container) {
    container.innerHTML = `
      <li class="empty-state">
        <i data-lucide="shield-check" size="24"></i>
        <span>Không có domain nào bị chặn</span>
      </li>
    `;

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  /**
   * Attach event listeners to remove buttons
   */
  attachRemoveListeners() {
    document.querySelectorAll('.remove-domain').forEach(button => {
      button.addEventListener('click', (e) => {
        e.preventDefault();
        const domain = button.getAttribute('data-domain');
        this.removeBlockedDomain(domain);
      });
    });
  }

  /**
   * Add a new domain to the blocked list
   */
  async addBlockedDomain() {
    const domainInput = document.getElementById('domain-to-block');
    if (!domainInput) return;

    const domain = domainInput.value.trim().toLowerCase();

    // Validate domain input
    const validationResult = this.validateDomain(domain);
    if (!validationResult.isValid) {
      this.showError(validationResult.message);
      return;
    }

    // Check if domain already exists
    if (this.blockedDomains.includes(domain)) {
      this.showError('Domain này đã có trong danh sách chặn');
      return;
    }

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: "BLOCK_DOMAIN",
          domain: domain
        }, resolve);
      });

      if (response && response.success) {
        this.blockedDomains.push(domain);
        domainInput.value = '';
        this.showSuccess(`Đã thêm ${domain} vào danh sách chặn`);
        await this.loadBlockedDomains();

        // Hide suggestions
        const suggestionsDropdown = document.getElementById('suggestions-dropdown');
        if (suggestionsDropdown) {
          suggestionsDropdown.style.display = 'none';
        }
      } else {
        this.showError('Không thể thêm domain vào danh sách chặn');
      }
    } catch (error) {
      console.error('Error adding blocked domain:', error);
      this.showError('Không thể thêm domain vào danh sách chặn');
    }
  }

  /**
   * Remove a domain from the blocked list
   */
  async removeBlockedDomain(domain) {
    if (!domain || !this.blockedDomains.includes(domain)) return;

    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({
          action: "UNBLOCK_DOMAIN",
          domain: domain
        }, resolve);
      });

      if (response && response.success) {
        this.blockedDomains = this.blockedDomains.filter(d => d !== domain);
        this.showSuccess(`Đã xóa ${domain} khỏi danh sách chặn`);
        await this.loadBlockedDomains();
      } else {
        this.showError('Không thể xóa domain khỏi danh sách chặn');
      }
    } catch (error) {
      console.error('Error removing blocked domain:', error);
      this.showError('Không thể xóa domain khỏi danh sách chặn');
    }
  }

  // Các phương thức khác giữ nguyên như validateDomain, showSuccess, showError,
  // showNotification, escapeHtml, getBlockedDomains, isDomainBlocked,
  // clearAllBlockedDomains, exportBlockedDomains, importBlockedDomains

  /**
   * Validate domain format
   */
  validateDomain(domain) {
    if (!domain) {
      return { isValid: false, message: 'Vui lòng nhập domain hợp lệ' };
    }

    // Basic domain validation regex
    const domainRegex = /^[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

    if (!domainRegex.test(domain)) {
      return { isValid: false, message: 'Format domain không hợp lệ' };
    }

    if (domain.length > 253) {
      return { isValid: false, message: 'Domain quá dài' };
    }

    return { isValid: true };
  }

  /**
   * Show success message
   */
  showSuccess(message) {
    this.showNotification(message, 'success');
  }

  /**
   * Show error message
   */
  showError(message) {
    this.showNotification(message, 'error');
  }

  /**
   * Show notification message
   */
  showNotification(message, type = 'info') {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = `notification notification-${type}`;
    notification.innerHTML = `
      <i data-lucide="${type === 'success' ? 'check-circle' : 'alert-circle'}" size="16"></i>
      <span>${this.escapeHtml(message)}</span>
    `;

    // Add to page
    document.body.appendChild(notification);

    // Initialize icon
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Auto remove after 3 seconds
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, 3000);
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Get blocked domains list
   */
  getBlockedDomains() {
    return [...this.blockedDomains];
  }

  /**
   * Check if a domain is blocked
   */
  isDomainBlocked(domain) {
    return this.blockedDomains.includes(domain.toLowerCase());
  }

  /**
   * Clear all blocked domains
   */
  async clearAllBlockedDomains() {
    try {
      const response = await new Promise((resolve) => {
        chrome.runtime.sendMessage({ action: "CLEAR_ALL_BLOCKED_DOMAINS" }, resolve);
      });

      if (response && response.success) {
        this.blockedDomains = [];
        this.showSuccess('Đã xóa tất cả domain khỏi danh sách chặn');
        await this.loadBlockedDomains();
      } else {
        this.showError('Không thể xóa danh sách domain');
      }
    } catch (error) {
      console.error('Error clearing blocked domains:', error);
      this.showError('Không thể xóa danh sách domain');
    }
  }

  /**
   * Export blocked domains list
   */
  exportBlockedDomains() {
    const data = {
      exportDate: new Date().toISOString(),
      blockedDomains: this.blockedDomains
    };

    const blob = new Blob([JSON.stringify(data, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `blocked-domains-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(url);
  }

  async importBlockedDomains(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.blockedDomains && Array.isArray(data.blockedDomains)) {
        // Import domains through background script
        for (const domain of data.blockedDomains) {
          if (!this.blockedDomains.includes(domain)) {
            const response = await new Promise((resolve) => {
              chrome.runtime.sendMessage({
                action: "BLOCK_DOMAIN",
                domain: domain
              }, resolve);
            });

            if (response && response.success) {
              this.blockedDomains.push(domain);
            }
          }
        }

        await this.loadBlockedDomains();
        this.showSuccess(`Đã import ${data.blockedDomains.length} domain`);
      } else {
        this.showError('File không đúng định dạng');
      }
    } catch (error) {
      console.error('Error importing blocked domains:', error);
      this.showError('Không thể import file');
    }
  }
}

// Export default instance
export default new DomainBlocking();
