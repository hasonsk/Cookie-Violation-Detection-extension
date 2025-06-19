class Settings {
  constructor() {
      this.settings = {};
      this.defaultSettings = {
          // Monitoring settings
          enableCookieBlocking: true,
          showViolationNotifications: true,
          scanFrequency: 'pageload',

          // UI settings
          theme: 'light',
          language: 'vi'
      };
      this.init();
  }

  async init() {
      await this.loadSettings();
      this.setupEventListeners();
      this.renderSettingsUI();
  }

  async loadSettings() {
      try {
          const stored = localStorage.getItem('cookieMonitorSettings');
          if (stored) {
              this.settings = {
                  ...this.defaultSettings,
                  ...JSON.parse(stored)
              };
          } else {
              this.settings = { ...this.defaultSettings };
          }
      } catch (e) {
          console.error('Error loading settings:', e);
          this.settings = { ...this.defaultSettings };
      }
  }

  async saveSettings() {
      try {
          localStorage.setItem('cookieMonitorSettings', JSON.stringify(this.settings));
          this.hasUnsavedChanges = false;
          this.showNotification('Đã lưu cài đặt thành công', 'success');
          console.log('Settings saved:', this.settings);
      } catch (e) {
          console.error('Error saving settings:', e);
          this.showNotification('Lỗi khi lưu cài đặt', 'error');
      }
  }

  setupEventListeners() {
      // Toggle switches
      document.querySelectorAll('.toggle-switch').forEach(toggle => {
          toggle.addEventListener('click', (e) => this.handleToggleSwitch(e));
      });

      // Select dropdowns
      document.querySelectorAll('select[data-setting]').forEach(select => {
          select.addEventListener('change', (e) => this.handleSelectChange(e));
      });

      // Auto-save on changes
      document.addEventListener('settingChanged', () => {
          this.saveSettings();
      });
  }

  renderSettingsUI() {
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
  }

  handleToggleSwitch(event) {
      const toggle = event.currentTarget;
      const settingKey = toggle.getAttribute('data-setting');
      if (!settingKey) return;

      const isOn = toggle.classList.contains('on');
      this.settings[settingKey] = !isOn;

      // Update UI
      if (!isOn) {
          toggle.classList.add('on');
          toggle.classList.remove('off');
      } else {
          toggle.classList.add('off');
          toggle.classList.remove('on');
      }

      this.triggerSettingChanged();
  }

  handleSelectChange(event) {
      const select = event.target;
      const settingKey = select.getAttribute('data-setting');
      if (!settingKey) return;

      this.settings[settingKey] = select.value;

      // Apply theme immediately
      if (settingKey === 'theme') {
          this.applyTheme(select.value);
      }

      // Apply language immediately
      if (settingKey === 'language') {
          this.applyLanguage(select.value);
      }

      this.triggerSettingChanged();
  }

  triggerSettingChanged() {
      this.hasUnsavedChanges = true;

      // Dispatch custom event
      const event = new CustomEvent('settingChanged', {
          detail: { settings: this.settings }
      });
      document.dispatchEvent(event);
  }

  applyTheme(theme) {
      if (theme === 'auto') {
          // Use system preference
          const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
          document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');

          // Listen for system theme changes
          const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
          mediaQuery.addEventListener('change', (e) => {
              if (this.settings.theme === 'auto') {
                  document.documentElement.setAttribute('data-theme', e.matches ? 'dark' : 'light');
              }
          });
      } else {
          document.documentElement.setAttribute('data-theme', theme);
      }
  }

  applyLanguage(language) {
      document.documentElement.setAttribute('lang', language);

      // Trigger i18n update if available
      if (window.i18n && typeof window.i18n.updateLanguage === 'function') {
          window.i18n.updateLanguage(language);
      }
  }

  escapeHtml(text) {
      const div = document.createElement('div');
      div.textContent = text;
      return div.innerHTML;
  }

  // Public API for other modules
  getSetting(key) {
      return this.settings[key] !== undefined ? this.settings[key] : this.defaultSettings[key];
  }

  getAllSettings() {
      return { ...this.settings };
  }

  updateSetting(key, value) {
      if (this.defaultSettings.hasOwnProperty(key)) {
          this.settings[key] = value;
          this.renderSettingsUI();
          this.triggerSettingChanged();
      }
  }

  // Check if auto-scan is enabled
  isAutoScanEnabled() {
      return this.getSetting('enableCookieBlocking');
  }

  // Check if notifications are enabled
  areNotificationsEnabled() {
      return this.getSetting('showViolationNotifications');
  }

  // Get scan frequency
  getScanFrequency() {
      return this.getSetting('scanFrequency');
  }

  // Get current theme
  getCurrentTheme() {
      return this.getSetting('theme');
  }

  // Get current language
  getCurrentLanguage() {
      return this.getSetting('language');
  }
}

// Initialize settings when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
  window.settingsManager = new Settings();
});

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
  module.exports = Settings;
}
