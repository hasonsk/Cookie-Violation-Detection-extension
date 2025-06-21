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

          // Monitoring settings
          scanFrequency: 'pageload',

          // UI settings
          theme: 'light',
          language: 'en',
          debugMode: false
      };
      this.hasUnsavedChanges = false;
      this.init();
  }

  async init() {
      await this.loadSettings();
      this.setupEventListeners();
      this.renderSettingsUI();
      this.updateSaveStatus(false);
  }

  async loadSettings() {
      // Simulate loading from storage
      const stored = localStorage.getItem('cookieMonitorSettings');
      if (stored) {
          try {
              this.settings = {
                  ...this.defaultSettings,
                  ...JSON.parse(stored)
              };
          } catch (e) {
              console.error('Error loading settings:', e);
              this.settings = { ...this.defaultSettings };
          }
      } else {
          this.settings = { ...this.defaultSettings };
      }
  }

  async saveSettings() {
      try {
          localStorage.setItem('cookieMonitorSettings', JSON.stringify(this.settings));
          this.hasUnsavedChanges = false;
          this.updateSaveStatus(false);
          this.showNotification('Settings saved successfully', 'success');

          // Apply settings across the application
          this.applyGlobalSettings();
      } catch (error) {
          console.error('Error saving settings:', error);
          this.showNotification('Failed to save settings', 'error');
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

      // Range inputs
      document.querySelectorAll('input[type="range"][data-setting]').forEach(range => {
          range.addEventListener('input', (e) => this.handleRangeChange(e));
      });

      // Save button
      document.getElementById('save-settings').addEventListener('click', () => {
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

      // Update range inputs
      Object.entries(this.settings).forEach(([key, value]) => {
          const range = document.querySelector(`input[type="range"][data-setting="${key}"]`);
          if (range) {
              range.value = value;
              const display = document.querySelector(`[data-display="${key}"]`);
              if (display) {
                  display.textContent = this.formatRangeValue(key, value);
              }
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

      this.markAsUnsaved();
  }

  handleSelectChange(event) {
      const select = event.target;
      const settingKey = select.getAttribute('data-setting');
      if (!settingKey) return;

      this.settings[settingKey] = select.value;
      this.markAsUnsaved();
  }

  handleRangeChange(event) {
      const range = event.target;
      const settingKey = range.getAttribute('data-setting');
      if (!settingKey) return;

      const value = parseInt(range.value);
      this.settings[settingKey] = value;

      // Update display
      const display = document.querySelector(`[data-display="${settingKey}"]`);
      if (display) {
          display.textContent = this.formatRangeValue(settingKey, value);
      }

      this.markAsUnsaved();
  }

  markAsUnsaved() {
      this.hasUnsavedChanges = true;
      this.updateSaveStatus(true);
  }

  updateSaveStatus(hasUnsaved) {
      const indicator = document.getElementById('save-status');
      const text = document.getElementById('save-status-text');
      const saveButton = document.getElementById('save-settings');

      if (hasUnsaved) {
          indicator.classList.add('unsaved');
          text.textContent = 'Unsaved changes';
          // saveButton.style.backgroundColor = '#dc2626';
      } else {
          indicator.classList.remove('unsaved');
          text.textContent = 'Settings saved';
          saveButton.style.backgroundColor = '#2563eb';
      }
  }

  applyGlobalSettings() {
      // Apply theme
      document.documentElement.setAttribute('data-theme', this.settings.theme);

      // Apply language
      document.documentElement.setAttribute('lang', this.settings.language);

      // Dispatch settings change event for other modules
      const event = new CustomEvent('settingsChanged', {
          detail: this.settings
      });
      document.dispatchEvent(event);

      console.log('Global settings applied:', this.settings);
  }

  showNotification(message, type = 'info') {
      const notification = document.createElement('div');
      notification.className = `notification notification-${type}`;
      notification.innerHTML = `
          <span>${this.escapeHtml(message)}</span>
      `;

      document.body.appendChild(notification);

      setTimeout(() => {
          if (notification.parentNode) {
              notification.parentNode.removeChild(notification);
          }
      }, 3000);
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
}
