export class DomainBlocking {
  constructor() {
    this.blockedDomains = [];
    this.isInitialized = false;
  }

  /**
   * Initialize the domain blocking functionality
   */
  async init() {
    if (this.isInitialized) return;

    try {
      await this.setupEventListeners();
      await this.loadBlockedDomains();
      this.isInitialized = true;
      console.log('Domain Blocking module initialized');
    } catch (error) {
      console.error('Error initializing Domain Blocking module:', error);
    }
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
      chrome.storage.local.get('blockedDomains', (data) => {
        const blockedList = document.getElementById('blocked-domains-list');
        if (!blockedList) {
          resolve();
          return;
        }

        // Clear existing list
        blockedList.innerHTML = '';
        this.blockedDomains = data.blockedDomains || [];

        if (this.blockedDomains.length > 0) {
          this.renderBlockedDomainsList(blockedList);
        } else {
          this.renderEmptyState(blockedList);
        }

        resolve();
      });
    });
  }

  /**
   * Render the list of blocked domains
   */
  renderBlockedDomainsList(container) {
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
      container.appendChild(li);
    });

    // Re-initialize Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }

    // Add event listeners for remove buttons
    this.attachRemoveListeners();
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
      // Add domain to list
      this.blockedDomains.push(domain);

      // Save to storage
      await this.saveBlockedDomains();

      // Update blocking rules
      await this.updateBlockingRules();

      // Clear input and reload UI
      domainInput.value = '';
      await this.loadBlockedDomains();

      this.showSuccess(`Đã thêm ${domain} vào danh sách chặn`);

    } catch (error) {
      console.error('Error adding blocked domain:', error);
      this.showError('Không thể thêm domain vào danh sách chặn');

      // Remove from local array if save failed
      this.blockedDomains = this.blockedDomains.filter(d => d !== domain);
    }
  }

  /**
   * Remove a domain from the blocked list
   */
  async removeBlockedDomain(domain) {
    if (!domain || !this.blockedDomains.includes(domain)) return;

    try {
      // Remove domain from list
      this.blockedDomains = this.blockedDomains.filter(d => d !== domain);

      // Save to storage
      await this.saveBlockedDomains();

      // Update blocking rules
      await this.updateBlockingRules();

      // Reload UI
      await this.loadBlockedDomains();

      this.showSuccess(`Đã xóa ${domain} khỏi danh sách chặn`);

    } catch (error) {
      console.error('Error removing blocked domain:', error);
      this.showError('Không thể xóa domain khỏi danh sách chặn');
    }
  }

  /**
   * Save blocked domains to storage
   */
  async saveBlockedDomains() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'blockedDomains': this.blockedDomains }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Update blocking rules in background script
   */
  async updateBlockingRules() {
    return new Promise((resolve, reject) => {
      chrome.runtime.sendMessage(
        {
          action: "updateBlockedDomains",
          domains: this.blockedDomains
        },
        (response) => {
          if (chrome.runtime.lastError) {
            reject(chrome.runtime.lastError);
          } else {
            resolve(response);
          }
        }
      );
    });
  }

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
      this.blockedDomains = [];
      await this.saveBlockedDomains();
      await this.updateBlockingRules();
      await this.loadBlockedDomains();
      this.showSuccess('Đã xóa tất cả domain khỏi danh sách chặn');
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

  /**
   * Import blocked domains list
   */
  async importBlockedDomains(file) {
    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.blockedDomains && Array.isArray(data.blockedDomains)) {
        this.blockedDomains = [...new Set([...this.blockedDomains, ...data.blockedDomains])];
        await this.saveBlockedDomains();
        await this.updateBlockingRules();
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
