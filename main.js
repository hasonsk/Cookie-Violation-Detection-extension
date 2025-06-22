document.addEventListener('DOMContentLoaded', async function() {
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  try {
    // Dynamic imports for all modules
    const [
      { TabManager },
      { Navigation },
      { Dashboard },
      // { CookieManager },
      { DomainBlocking },
      { Settings },
      { CookieDisplay },
      { initializeLocalization, changeLanguage }
    ] = await Promise.all([
      import('./modules/tab-manager.js'),
      import('./modules/navigation.js'),
      import('./modules/dashboard.js'),
      // import('./modules/cookie-manager.js'),
      import('./modules/domain-blocking.js'),
      import('./modules/settings.js'),
      import('./modules/cookie-display.js'),
      import('./modules/localization.js')
    ]);

    // Initialize all modules
    const tabManager = new TabManager();
    const navigation = new Navigation();
    const dashboard = new Dashboard();
    // const cookieManager = new CookieManager();
    const domainBlocking = new DomainBlocking();
    const settings = new Settings();
    const cookieDisplay = new CookieDisplay(); // Instantiate CookieDisplay

    // Initialize navigation first
    navigation.init();
    dashboard.init();
    // cookieManager.init();
    domainBlocking.init();
    settings.init();
    initializeLocalization(); // Initialize localization after other modules

    // Load current tab data
    const tabId = await tabManager.getCurrentTabId();
    if (tabId) {
      // await cookieManager.loadCookieDataForTab(tabId);
      await domainBlocking.loadBlockedDomains();
      await tabManager.updateCurrentTabInfo(tabId);
      // dashboard.updateDashboard();
    } else {
      tabManager.showNoTabMessage();
    }

    // Setup inter-module communication
    setupModuleCommunication({
      tabManager,
      navigation,
      dashboard,
      // cookieManager,
      domainBlocking,
      settings,
      cookieDisplay, // Add cookieDisplay
      initializeLocalization,
      changeLanguage
    });

  } catch (error) {
    console.error('Error loading modules:', error);
  }
});

function setupModuleCommunication(modules) {
  const eventBus = {
    events: {},

    on(event, callback) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(callback);
    },

    emit(event, data) {
      if (this.events[event]) {
        this.events[event].forEach(callback => callback(data));
      }
    }
  };

  // Make event bus available to all modules
  window.appEventBus = eventBus;

  // Setup cross-module event listeners
  eventBus.on('tabChange', async (tabId) => {
    await modules.cookieManager.loadCookieDataForTab(tabId);
    await modules.tabManager.updateCurrentTabInfo(tabId);
    modules.dashboard.updateDashboard();
  });

  eventBus.on('dataCleared', () => {
      modules.dashboard.updateDashboard();
  });

  eventBus.on('navigationChange', (screen) => {
    if (screen === 'dashboard') {
      modules.dashboard.updateDashboard();
    } else if (screen === 'cookies') {
      // Ensure dashboard data is loaded before initializing cookie display
      if (modules.dashboard.data) {
        modules.cookieDisplay.init(modules.dashboard.data);
      } else {
        // If data is not yet loaded, wait for it
        modules.dashboard.loadData().then(() => {
          modules.cookieDisplay.init(modules.dashboard.data);
        });
      }
    } else if (screen === 'domains') {
      modules.domainBlocking.loadBlockedDomains();
    }
  });

  const languageSelect = document.querySelector('select[data-setting="language"]');
  if (languageSelect) {
    languageSelect.addEventListener('change', async (event) => {
      await modules.changeLanguage(event.target.value);
      modules.initializeLocalization(); // Re-initialize localization to update all data-i18n elements
    });
  }
}
