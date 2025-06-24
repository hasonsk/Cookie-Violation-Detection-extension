document.addEventListener("DOMContentLoaded", async function () {
  if (typeof lucide !== "undefined") {
    lucide.createIcons();
  }

  const { initializeLocalization } = await import("./modules/localization.js");
  await initializeLocalization();

  try {
    // Dynamic imports for all modules
    chrome.tabs.query({ active: true, currentWindow: true }, function (tabs) {
      var currentTab = tabs[0];
      var isValidUrl =
        currentTab.url.startsWith("http://") ||
        currentTab.url.startsWith("https://");
      var validUrlContent = document.getElementById("valid-url-content");
      var invalidUrlContent = document.getElementById("invalid-url-content");

      if (!isValidUrl) {
        validUrlContent.style.display = "none";
        invalidUrlContent.style.display = "block";
      } else {
        validUrlContent.style.display = "block";
        invalidUrlContent.style.display = "none";

        (async () => {
          const [
            { TabManager },
            { Dashboard },
            { Settings },
            { initializeLocalization, changeLanguage },
          ] = await Promise.all([
            import("./modules/tab-manager.js"),
            import("./modules/dashboard.js"),
            import("./modules/settings.js"),
            import("./modules/localization.js"),
          ]);

          // Initialize all modules
          const tabManager = new TabManager();
          const dashboard = new Dashboard();
          const settings = new Settings();

          // Initialize all modules
          dashboard.init();
          settings.init();
          initializeLocalization();

          // Load current tab data
          const tabId = await tabManager.getCurrentTabId();
          if (tabId) {
            await tabManager.updateCurrentTabInfo(tabId);
            // dashboard.updateDashboard();
          } else {
            tabManager.showNoTabMessage();
          }

          // Setup full inter-module communication
          setupModuleCommunication({
            tabManager,
            // navigation,
            dashboard,
            settings,
            initializeLocalization,
            changeLanguage,
          });
        })();
      }
    });
  } catch (error) {
    console.error("Error loading modules:", error);
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
        this.events[event].forEach((callback) => callback(data));
      }
    },
  };

  // Make event bus available to all modules
  window.appEventBus = eventBus;

  // Setup cross-module event listeners
  eventBus.on("tabChange", async (tabId) => {
    const tabInfo = await modules.tabManager.getCurrentTab();
    const isValidUrl = modules.tabManager.isValidUrlForAnalysis(tabInfo?.url);

    if (isValidUrl) {
      await modules.tabManager.updateCurrentTabInfo(tabId);
      modules.dashboard.updateDashboard();
    } else {
      modules.tabManager.showInvalidUrlMessage(tabInfo?.url);
    }
  });

  eventBus.on("dataCleared", () => {
    modules.dashboard.updateDashboard();
  });

  const languageSelect = document.querySelector(
    'select[data-setting="language"]'
  );
  if (languageSelect) {
    languageSelect.addEventListener("change", async (event) => {
      await modules.changeLanguage(event.target.value);
      modules.initializeLocalization();
    });
  }
}

document.getElementById('header-settings').addEventListener('click', function() {
  const dashboard = document.getElementById('dashboard-screen');
  const settings = document.getElementById('settings-screen');
  const settingsIcon = document.getElementById("settings-icon");
  const closeIcon = document.getElementById("close-icon");

  if (dashboard.style.display !== 'none') {
    dashboard.style.display = 'none';
    settings.style.display = 'block';

    closeIcon.style.display = "block";
    settingsIcon.style.display = "none";
  } else {
    dashboard.style.display = 'block';
    settings.style.display = 'none';
    closeIcon.style.display = "none";
    settingsIcon.style.display = "block";
  }
});
