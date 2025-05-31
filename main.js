document.addEventListener('DOMContentLoaded', async function() {
  // Initialize Lucide icons if the library is available
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  try {
    // Dynamic imports for all modules
    const [
      { TabManager },
      { Navigation },
      { Dashboard },
      { CookieManager },
      { DomainBlocking },
      { Settings }
    ] = await Promise.all([
      import('./modules/tab-manager.js'),
      import('./modules/navigation.js'),
      import('./modules/dashboard.js'),
      import('./modules/cookie-manager.js'),
      import('./modules/domain-blocking.js'),
      import('./modules/settings.js')
    ]);

    // Initialize all modules
    const tabManager = new TabManager();
    const navigation = new Navigation();
    const dashboard = new Dashboard();
    const cookieManager = new CookieManager();
    const domainBlocking = new DomainBlocking();
    const settings = new Settings();

    // Initialize navigation first
    navigation.init();
    dashboard.init();
    cookieManager.init();
    domainBlocking.init();
    settings.init();

    // Load current tab data
    const tabId = await tabManager.getCurrentTabId();
    if (tabId) {
      await cookieManager.loadCookieDataForTab(tabId);
      await domainBlocking.loadBlockedDomains();
      await tabManager.updateCurrentTabInfo(tabId);
      // dashboard.updateStats();
    } else {
      tabManager.showNoTabMessage();
    }

    // Setup inter-module communication
    setupModuleCommunication({
      tabManager,
      navigation,
      dashboard,
      cookieManager,
      domainBlocking,
      settings
    });

  } catch (error) {
    console.error('Error loading modules:', error);
  }
});

function setupModuleCommunication(modules) {
  // Create a simple event system for module communication
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
    modules.dashboard.updateStats();
  });

  eventBus.on('dataCleared', () => {
    modules.dashboard.updateStats();
    modules.cookieManager.clearDisplay();
  });

  eventBus.on('navigationChange', (screen) => {
    if (screen === 'dashboard') {
      modules.dashboard.updateStats();
    } else if (screen === 'cookies') {
      modules.cookieManager.applyFilter('all');
    } else if (screen === 'domains') {
      modules.domainBlocking.loadBlockedDomains();
    }
  });
}
