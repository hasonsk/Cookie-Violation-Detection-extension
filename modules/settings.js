export class Settings {
  constructor() {
    this.settings = {};
    this.defaultSettings = {
      // Privacy settings
      enableCookieBlocking: true,
      enableThirdPartyBlocking: false,
      enableAnalyticsBlocking: true,

      // Notification settings
      showViolationNotifications: true,
      showBlockingNotifications: false,
      notificationDuration: 3000,

      // Dashboard settings
      autoRefreshStats: true,
      refreshInterval: 5000,
      maxCookiesDisplay: 100,

      // Export settings
      exportFormat: 'csv',
      includeSessionCookies: true,
      includeCookieValues: false,

      // Advanced settings
      debugMode: false,
      logLevel: 'info',
      clearDataOnBrowserClose: false,

      // UI settings
      theme: 'light',
      language: 'vi',
      compactMode: false
    };
    this.isInitialized = false;
  }

  /**
   * Initialize the settings module
   */
  async init() {
    if (this.isInitialized) return;

    try {
      await this.loadSettings();
      await this.setupEventListeners();
      await this.renderSettingsUI();
      this.isInitialized = true;
      console.log('Settings module initialized');
    } catch (error) {
      console.error('Error initializing Settings module:', error);
    }
  }

  /**
   * Load settings from storage
   */
  async loadSettings() {
    return new Promise((resolve) => {
      chrome.storage.local.get('appSettings', (data) => {
        this.settings = {
          ...this.defaultSettings,
          ...(data.appSettings || {})
        };
        resolve();
      });
    });
  }

  /**
   * Save settings to storage
   */
  async saveSettings() {
    return new Promise((resolve, reject) => {
      chrome.storage.local.set({ 'appSettings': this.settings }, () => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve();
        }
      });
    });
  }

  /**
   * Setup event listeners for settings UI
   */
  async setupEventListeners() {
    // Toggle switches
    document.querySelectorAll('#settings-screen .toggle-switch').forEach(toggle => {
      toggle.addEventListener('click', (e) => this.handleToggleSwitch(e));
    });

    // Dropdown selects
    document.querySelectorAll('#settings-screen select').forEach(select => {
      select.addEventListener('change', (e) => this.handleSelectChange(e));
    });

    // Range inputs
    document.querySelectorAll('#settings-screen input[type="range"]').forEach(range => {
      range.addEventListener('input', (e) => this.handleRangeChange(e));
    });

    // Clear all data button
    const clearDataButton = document.querySelector('#settings-screen .danger-button');
    if (clearDataButton) {
      clearDataButton.addEventListener('click', () => this.handleClearAllData());
    }

    // Export settings button
    const exportButton = document.getElementById('export-settings');
    if (exportButton) {
      exportButton.addEventListener('click', () => this.exportSettings());
    }

    // Import settings button
    const importButton = document.getElementById('import-settings');
    const importFile = document.getElementById('import-settings-file');
    if (importButton && importFile) {
      importButton.addEventListener('click', () => importFile.click());
      importFile.addEventListener('change', (e) => this.handleImportSettings(e));
    }

    // Reset to defaults button
    const resetButton = document.getElementById('reset-settings');
    if (resetButton) {
      resetButton.addEventListener('click', () => this.resetToDefaults());
    }
  }

  /**
   * Render the settings UI based on current settings
   */
  async renderSettingsUI() {
    // Update toggle switches
    Object.entries(this.settings).forEach(([key, value]) => {
      const toggle = document.querySelector(`[data-setting="${key}"]`);
      if (toggle && toggle.classList.contains('toggle-switch')) {
        if (value) {
          toggle.classList.add('on');
          toggle.classList.remove('off');
        } else {
          toggle.classList.add('off');
          toggle.classList.remove('on');
        }
      }
    });

    // Update select dropdowns
    Object.entries(this.settings).forEach(([key, value]) => {
      const select = document.querySelector(`select[data-setting="${key}"]`);
      if (select) {
        select.value = value;
      }
    });

    // Update range inputs
    Object.entries(this.settings).forEach(([key, value]) => {
      const range = document.querySelector(`input[type="range"][data-setting="${key}"]`);
      if (range) {
        range.value = value;
        // Update display value if exists
        const display = document.querySelector(`[data-display="${key}"]`);
        if (display) {
          display.textContent = this.formatRangeValue(key, value);
        }
      }
    });

    // Update other UI elements based on settings
    this.applyTheme();
    this.updateLanguage();
  }

  /**
   * Handle toggle switch changes
   */
  async handleToggleSwitch(event) {
    const toggle = event.currentTarget;
    const settingKey = toggle.getAttribute('data-setting');

    if (!settingKey) return;

    // Toggle the switch state
    const isOn = toggle.classList.contains('on');
    if (isOn) {
      toggle.classList.remove('on');
      toggle.classList.add('off');
      this.settings[settingKey] = false;
    } else {
      toggle.classList.remove('off');
      toggle.classList.add('on');
      this.settings[settingKey] = true;
    }

    // Save settings and apply changes
    await this.saveSettings();
    await this.applySettingChange(settingKey, this.settings[settingKey]);
  }

  /**
   * Handle select dropdown changes
   */
  async handleSelectChange(event) {
    const select = event.target;
    const settingKey = select.getAttribute('data-setting');

    if (!settingKey) return;

    this.settings[settingKey] = select.value;
    await this.saveSettings();
    await this.applySettingChange(settingKey, select.value);
  }

  /**
   * Handle range input changes
   */
  async handleRangeChange(event) {
    const range = event.target;
    const settingKey = range.getAttribute('data-setting');

    if (!settingKey) return;

    const value = parseInt(range.value);
    this.settings[settingKey] = value;

    // Update display value
    const display = document.querySelector(`[data-display="${settingKey}"]`);
    if (display) {
      display.textContent = this.formatRangeValue(settingKey, value);
    }

    await this.saveSettings();
    await this.applySettingChange(settingKey, value);
  }

  /**
   * Format range values for display
   */
  formatRangeValue(key, value) {
    switch (key) {
      case 'refreshInterval':
        return `${value / 1000}s`;
      case 'notificationDuration':
        return `${value / 1000}s`;
      case 'maxCookiesDisplay':
        return `${value} cookies`;
      default:
        return value.toString();
    }
  }

  /**
   * Apply setting changes to the application
   */
  async applySettingChange(settingKey, value) {
    switch (settingKey) {
      case 'theme':
        this.applyTheme();
        break;

      case 'language':
        this.updateLanguage();
        break;

      case 'enableCookieBlocking':
      case 'enableThirdPartyBlocking':
      case 'enableAnalyticsBlocking':
        await this.updateBlockingRules();
        break;

      case 'autoRefreshStats':
      case 'refreshInterval':
        this.updateAutoRefresh();
        break;

      case 'debugMode':
        this.updateDebugMode();
        break;
    }
  }

  /**
   * Apply theme changes
   */
  applyTheme() {
    const theme = this.settings.theme;
    document.documentElement.setAttribute('data-theme', theme);

    // Update theme toggle if exists
    const themeToggle = document.querySelector('[data-setting="theme"]');
    if (themeToggle) {
      themeToggle.textContent = theme === 'dark' ? '🌙' : '☀️';
    }
  }

  /**
   * Update language
   */
  updateLanguage() {
    const language = this.settings.language;
    document.documentElement.setAttribute('lang', language);

    // You can add language translation logic here
    console.log(`Language changed to: ${language}`);
  }

  /**
   * Update blocking rules based on settings
   */
  async updateBlockingRules() {
    try {
      const blockingSettings = {
        enableCookieBlocking: this.settings.enableCookieBlocking,
        enableThirdPartyBlocking: this.settings.enableThirdPartyBlocking,
        enableAnalyticsBlocking: this.settings.enableAnalyticsBlocking
      };

      // Send message to background script
      chrome.runtime.sendMessage({
        action: 'updateBlockingSettings',
        settings: blockingSettings
      });
    } catch (error) {
      console.error('Error updating blocking rules:', error);
    }
  }

  /**
   * Update auto refresh settings
   */
  updateAutoRefresh() {
    // This would be implemented in the dashboard module
    const event = new CustomEvent('settingsChanged', {
      detail: {
        autoRefreshStats: this.settings.autoRefreshStats,
        refreshInterval: this.settings.refreshInterval
      }
    });
    document.dispatchEvent(event);
  }

  /**
   * Update debug mode
   */
  updateDebugMode() {
    if (this.settings.debugMode) {
      console.log('Debug mode enabled');
      window.cookieMonitorDebug = true;
    } else {
      console.log('Debug mode disabled');
      window.cookieMonitorDebug = false;
    }
  }

  /**
   * Handle clear all data
   */
  async handleClearAllData() {
    const confirmMessage = 'Bạn có chắc chắn muốn xóa tất cả dữ liệu? Hành động này không thể hoàn tác.';

    if (!confirm(confirmMessage)) return;

    try {
      // Clear all storage data
      await new Promise((resolve) => {
        chrome.storage.local.clear(() => {
          resolve();
        });
      });

      // Reset settings to defaults
      this.settings = { ...this.defaultSettings };
      await this.saveSettings();

      // Show success message
      this.showNotification('Đã xóa tất cả dữ liệu thành công', 'success');

      // Reload the popup after a short delay
      setTimeout(() => {
        location.reload();
      }, 1500);

    } catch (error) {
      console.error('Error clearing data:', error);
      this.showNotification('Không thể xóa dữ liệu', 'error');
    }
  }

  /**
   * Export settings to file
   */
  exportSettings() {
    const exportData = {
      exportDate: new Date().toISOString(),
      version: '1.0',
      settings: this.settings
    };

    const blob = new Blob([JSON.stringify(exportData, null, 2)], {
      type: 'application/json'
    });

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `cookie-monitor-settings-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();

    URL.revokeObjectURL(url);
    this.showNotification('Đã xuất cài đặt thành công', 'success');
  }

  /**
   * Handle import settings from file
   */
  async handleImportSettings(event) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const text = await file.text();
      const data = JSON.parse(text);

      if (data.settings && typeof data.settings === 'object') {
        // Merge with default settings to ensure all keys exist
        this.settings = {
          ...this.defaultSettings,
          ...data.settings
        };

        await this.saveSettings();
        await this.renderSettingsUI();

        // Apply all setting changes
        for (const [key, value] of Object.entries(this.settings)) {
          await this.applySettingChange(key, value);
        }

        this.showNotification('Đã import cài đặt thành công', 'success');
      } else {
        this.showNotification('File cài đặt không đúng định dạng', 'error');
      }
    } catch (error) {
      console.error('Error importing settings:', error);
      this.showNotification('Không thể import file cài đặt', 'error');
    }

    // Clear file input
    event.target.value = '';
  }

  /**
   * Reset settings to defaults
   */
  async resetToDefaults() {
    if (!confirm('Bạn có chắc chắn muốn khôi phục cài đặt mặc định?')) return;

    try {
      this.settings = { ...this.defaultSettings };
      await this.saveSettings();
      await this.renderSettingsUI();

      // Apply all setting changes
      for (const [key, value] of Object.entries(this.settings)) {
        await this.applySettingChange(key, value);
      }

      this.showNotification('Đã khôi phục cài đặt mặc định', 'success');
    } catch (error) {
      console.error('Error resetting settings:', error);
      this.showNotification('Không thể khôi phục cài đặt', 'error');
    }
  }

  /**
   * Get a specific setting value
   */
  getSetting(key) {
    return this.settings[key] !== undefined ? this.settings[key] : this.defaultSettings[key];
  }

  /**
   * Set a specific setting value
   */
  async setSetting(key, value) {
    this.settings[key] = value;
    await this.saveSettings();
    await this.applySettingChange(key, value);
  }

  /**
   * Get all settings
   */
  getAllSettings() {
    return { ...this.settings };
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

    // Auto remove after duration specified in settings
    const duration = this.settings.notificationDuration || 3000;
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
    }, duration);
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
   * Validate settings object
   */
  validateSettings(settings) {
    const errors = [];

    // Check refresh interval
    if (settings.refreshInterval < 1000 || settings.refreshInterval > 60000) {
      errors.push('Refresh interval must be between 1-60 seconds');
    }

    // Check notification duration
    if (settings.notificationDuration < 1000 || settings.notificationDuration > 10000) {
      errors.push('Notification duration must be between 1-10 seconds');
    }

    // Check max cookies display
    if (settings.maxCookiesDisplay < 10 || settings.maxCookiesDisplay > 1000) {
      errors.push('Max cookies display must be between 10-1000');
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }
}

// Export default instance
export default new Settings();
