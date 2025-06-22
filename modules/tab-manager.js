export class TabManager {
  constructor() {
    this.currentTabId = null;
  }

  async getCurrentTabId() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      this.currentTabId = tabs.length > 0 ? tabs[0].id : null;
      return this.currentTabId;
    } catch (error) {
      console.error("Error getting active tab:", error);
      return null;
    }
  }

  isValidUrlForAnalysis(url) {
    if (!url) return false;

    const isHttpUrl = url.startsWith('http://') || url.startsWith('https://');

    const invalidProtocols = [
      'chrome://',
      'chrome-extension://',
      'moz-extension://',
      'about:',
      'file://',
      'data:',
      'javascript:',
      'edge://',
      'opera://',
      'brave://'
    ];

    const hasInvalidProtocol = invalidProtocols.some(protocol =>
      url.toLowerCase().startsWith(protocol)
    );

    return isHttpUrl && !hasInvalidProtocol;
  }

  async updateCurrentTabInfo(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      const currentUrlElement = document.getElementById('current-url');
      const currentTabInfoElement = document.getElementById('current-tab-info');

      if (currentUrlElement && tab) {
        let displayUrl = tab.url;
        try {
          const url = new URL(tab.url);
          displayUrl = url.hostname;
        } catch (urlError) {
          console.warn("Invalid URL format:", tab.url);
        }

        currentUrlElement.textContent = displayUrl;
        if (currentTabInfoElement) {
          currentTabInfoElement.style.display = 'block';
        }
      }
    } catch (error) {
      console.error("Error getting tab info:", error);
    }
  }
  showNoTabMessage() {
    const emptyMessage = document.getElementById('empty-message');
    if (emptyMessage) {
      emptyMessage.textContent = "Không thể xác định tab hiện tại.";
      emptyMessage.style.display = 'block';
    }

    const cookieContainer = document.getElementById('cookie-table-container');
    if (cookieContainer) {
      cookieContainer.style.display = 'none';
    }
  }

  async getCurrentTab() {
    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      return tabs.length > 0 ? tabs[0] : null;
    } catch (error) {
      console.error("Error getting current tab:", error);
      return null;
    }
  }
}
