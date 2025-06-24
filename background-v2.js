// =====================================================
// CONFIGURATION & CONSTANTS
// =====================================================
const CONFIG = {
  STORAGE_KEYS: {
    COOKIES_BY_TAB: "cookiesByTab",
    COMPLIANCE_RESULT: "complianceResult",
    SETTINGS: "user_settings",
    BLOCKED_DOMAINS: "blocked_domains",
  },
  DEFAULTS: {
    SETTINGS: {
      autoScan: true,
      scanFrequency: "pageload",
      notifications: true,
    },
  },
  API_ENDPOINTS: {
    COOKIES_ANALYZE: "http://127.0.0.1:8000/violations/analyze",
  },
};

// Global state
let detectedCookies = {};
let activeTabId = null;

// =====================================================
// UTILITY FUNCTIONS
// =====================================================
const Utils = {
  parseCookie(setCookieHeader) {
    if (!setCookieHeader) return null;

    const parts = setCookieHeader.split(";").map(part => part.trim());
    const [nameValue] = parts;
    const [name, value] = nameValue.split("=");

    const cookie = {
      name: name?.trim(),
      value: value?.trim() || "",
      httpOnly: false,
      secure: false,
    };

    parts.slice(1).forEach(part => {
      const [key, val] = part.split("=");
      const attrKey = key?.trim().toLowerCase();

      switch (attrKey) {
        case "expires":
          cookie.expires = val?.trim();
          break;
        case "max-age":
          cookie.maxAge = parseInt(val?.trim());
          break;
        case "path":
          cookie.path = val?.trim();
          break;
        case "domain":
          cookie.domain = val?.trim();
          break;
        case "samesite":
          cookie.sameSite = val?.trim();
          break;
        case "httponly":
          cookie.httpOnly = true;
          break;
        case "secure":
          cookie.secure = true;
          break;
      }
    });

    return cookie;
  },

  extractMainDomain(domain) {
    const parts = domain.split(".");
    return parts.length >= 2 ? parts.slice(-2).join(".") : domain;
  },

  isDomainOrSubdomain(cookieDomain, tabDomain) {
    if (cookieDomain === tabDomain) return true;
    const cleanDomain = cookieDomain.startsWith(".") ? cookieDomain.substring(1) : cookieDomain;
    return tabDomain.endsWith("." + cleanDomain) || tabDomain === cleanDomain;
  },

  log(message, data = null) {
    console.log(`[CookieExt ${new Date().toISOString()}] ${message}`, data);
  },
};

// =====================================================
// STORAGE MANAGER
// =====================================================
class StorageManager {
  static async get(key) {
    try {
      const result = await chrome.storage.local.get(key);
      return result[key];
    } catch (error) {
      Utils.log("Storage get error:", error);
      return null;
    }
  }

  static async set(key, value) {
    try {
      await chrome.storage.local.set({ [key]: value });
      return true;
    } catch (error) {
      Utils.log("Storage set error:", error);
      return false;
    }
  }

  static async getSettings() {
    const settings = await this.get(CONFIG.STORAGE_KEYS.SETTINGS);
    return { ...CONFIG.DEFAULTS.SETTINGS, ...settings };
  }

  static async updateSettings(newSettings) {
    const currentSettings = await this.getSettings();
    return await this.set(CONFIG.STORAGE_KEYS.SETTINGS, {
      ...currentSettings,
      ...newSettings,
    });
  }
}

// =====================================================
// COOKIE MANAGER
// =====================================================
class CookieManager {
  async getCookiesForTab(tabId) {
    const cookiesByTab = await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB) || {};
    return cookiesByTab[tabId] || [];
  }

  async clearCookiesForDomain(domain) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });

      for (const cookie of cookies) {
        await chrome.cookies.remove({
          url: `http${cookie.secure ? "s" : ""}://${cookie.domain}${cookie.path}`,
          name: cookie.name,
        });
      }

      // Clear from storage
      const cookiesByTab = await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB) || {};
      Object.keys(cookiesByTab).forEach(tabId => {
        cookiesByTab[tabId] = cookiesByTab[tabId].filter(
          cookie => cookie.domain !== domain && cookie.mainDomain !== domain
        );
      });

      await StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB, cookiesByTab);
      return true;
    } catch (error) {
      Utils.log("Clear cookies error:", error);
      return false;
    }
  }

  async updateBadgeForActiveTab() {
    if (!activeTabId) return;

    const cookies = await this.getCookiesForTab(activeTabId);
    const count = cookies.length;

    await chrome.action.setBadgeText({
      text: count > 0 ? count.toString() : "",
      tabId: activeTabId,
    });

    await chrome.action.setBadgeBackgroundColor({
      color: count > 0 ? "#FF6B6B" : "#4ECDC4",
    });
  }
}

// =====================================================
// BLOCKING MANAGER
// =====================================================
class BlockingManager {
  async blockDomain(domain) {
    try {
      const blockedDomains = await StorageManager.get(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS) || [];

      if (!blockedDomains.includes(domain)) {
        blockedDomains.push(domain);
        await StorageManager.set(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS, blockedDomains);
      }
      return true;
    } catch (error) {
      Utils.log("Block domain error:", error);
      return false;
    }
  }

  async unblockDomain(domain) {
    try {
      const blockedDomains = await StorageManager.get(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS) || [];
      const updated = blockedDomains.filter(d => d !== domain);
      await StorageManager.set(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS, updated);
      return true;
    } catch (error) {
      Utils.log("Unblock domain error:", error);
      return false;
    }
  }
}

// =====================================================
// MAIN CONTROLLER
// =====================================================
class ExtensionController {
  constructor() {
    this.cookieManager = new CookieManager();
    this.blockingManager = new BlockingManager();
  }

  async handleInstallation() {
    Utils.log("Extension installed");
    await StorageManager.set(CONFIG.STORAGE_KEYS.SETTINGS, CONFIG.DEFAULTS.SETTINGS);
    await chrome.tabs.create({
      url: chrome.runtime.getURL("cookie-compliance-checker.html"),
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case "GET_COMPLIANCE_RESULT":
          return await this.getComplianceResult();
        case "GET_RESULT_DETAILS":
          return await this.getResultDetails();
        case "UPDATE_SETTINGS":
          await StorageManager.updateSettings(request.settings);
          return { success: true };
        case "BLOCK_DOMAIN":
          const blocked = await this.blockingManager.blockDomain(request.domain);
          return { success: blocked };
        case "CLEAR_COOKIES":
          const cleared = await this.cookieManager.clearCookiesForDomain(request.domain);
          return { success: cleared };
        case "CHECK_AGAIN":
        case "MANUAL_SCAN":
          return await this.performManualScan();
        default:
          return { success: false, error: "Unknown action" };
      }
    } catch (error) {
      Utils.log("Message handling error:", error);
      return { success: false, error: error.message };
    }
  }

  async getComplianceResult() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.url) {
      return { success: false, error: "No active tab found" };
    }

    const url = new URL(activeTab.url);
    const rootUrl = `${url.protocol}//${url.hostname}`;
    const allResults = await StorageManager.get(CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT);
    const currentTabResult = allResults?.[rootUrl] || null;

    return { success: true, data: currentTabResult };
  }

  async getResultDetails() {
    const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!activeTab?.url) {
      return { success: false, error: "No active tab found" };
    }

    const url = new URL(activeTab.url);
    const rootUrl = `${url.protocol}//${url.hostname}`;
    const allResults = await StorageManager.get(CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT);
    const resultDetails = allResults?.[rootUrl] || null;

    return { success: true, data: resultDetails };
  }

  async performManualScan() {
    try {
      const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!activeTab) {
        return { success: false, error: "No active tab found" };
      }

      const result = await performComplianceCheck(activeTab.id);
      return result
        ? { success: true, data: result, message: "Compliance check completed" }
        : { success: false, error: "Unable to perform compliance check" };
    } catch (error) {
      Utils.log("Error in manual scan:", error);
      return { success: false, error: error.message };
    }
  }
}

// =====================================================
// COMPLIANCE CHECK FUNCTIONS
// =====================================================
async function performComplianceCheck(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);

    if (!isValidWebUrl(tab.url)) {
      Utils.log(`Skipping scan for invalid URL: ${tab.url}`);
      return null;
    }

    await controller.cookieManager.updateBadgeForActiveTab();
    const allCookies = await getAllCookiesFromActiveTab(tabId);

    const body = {
      website_url: tab.url,
      cookies: allCookies,
    };

    Utils.log("Sending cookies to server for analysis:", body);

    const response = await fetch(CONFIG.API_ENDPOINTS.COOKIES_ANALYZE, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    Utils.log("Compliance Result:", result);

    await saveComplianceResult(tab.url, result);
    return result;
  } catch (error) {
    Utils.log("Error in performComplianceCheck:", error);
    throw error;
  }
}

async function saveComplianceResult(tabUrl, result) {
  const url = new URL(tabUrl);
  const rootUrl = `${url.protocol}//${url.hostname}`;

  const existingData = await StorageManager.get(CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT) || {};
  const updatedData = { ...existingData, [rootUrl]: result };

  await StorageManager.set(CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT, updatedData);
  Utils.log("Compliance result saved", updatedData);
}

function isValidWebUrl(url) {
  if (!url || (!url.startsWith("http://") && !url.startsWith("https://"))) {
    return false;
  }

  const excludedDomains = ["chrome://newtab", "chrome://extensions"];
  return !excludedDomains.some(excluded => url.includes(excluded));
}

// =====================================================
// COOKIE COLLECTION FUNCTIONS
// =====================================================
async function getAllDomainsFromCookies(tabId = null) {
  try {
    const cookiesByTab = await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB) || {};
    const domains = new Set();

    if (tabId !== null) {
      const tabCookies = cookiesByTab[tabId] || [];
      tabCookies.forEach(cookie => {
        domains.add(cookie.domain);
        domains.add(cookie.mainDomain);
      });
    } else {
      Object.values(cookiesByTab).forEach(tabCookies => {
        tabCookies.forEach(cookie => {
          domains.add(cookie.domain);
          domains.add(cookie.mainDomain);
        });
      });
    }

    return Array.from(domains).filter(domain => domain);
  } catch (error) {
    Utils.log("Error getting domains from cookies:", error);
    return [];
  }
}

async function getAllCookiesFromDomainsList(domains, url) {
  try {
    const allCookies = [];

    for (const domain of domains) {
      const cookies = await chrome.cookies.getAll({ domain, url });
      allCookies.push(...cookies.map(cookie => ({
        name: cookie.name,
        value: cookie.value,
        domain: cookie.domain,
        path: cookie.path,
        secure: cookie.secure,
        httpOnly: cookie.httpOnly,
        sameSite: cookie.sameSite,
        expirationDate: cookie.expirationDate
          ? new Date(cookie.expirationDate * 1000).toISOString()
          : "Session",
      })));
    }

    return allCookies;
  } catch (error) {
    Utils.log("Error getting cookies from domains list:", error);
    return [];
  }
}

async function getAllCookiesFromActiveTab(activeTabId) {
  const url = await chrome.tabs.get(activeTabId).then(tab => tab.url);
  const domain = new URL(url).hostname;
  const domains = await getAllDomainsFromCookies(activeTabId) || [domain];
  return await getAllCookiesFromDomainsList(domains, url);
}

// =====================================================
// EVENT LISTENERS & INITIALIZATION
// =====================================================
const controller = new ExtensionController();

// Installation event
chrome.runtime.onInstalled.addListener(details => {
  if (details.reason === "install") {
    controller.handleInstallation();
  }
});

chrome.tabs.onActivated.addListener(async activeInfo => {
  activeTabId = activeInfo.tabId;
  await controller.cookieManager.updateBadgeForActiveTab();
});

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tabId === activeTabId) {
    await performComplianceCheck(tabId);
  }
});

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  controller
    .handleMessage(request, sender, sendResponse)
    .then(response => sendResponse(response))
    .catch(error => sendResponse({ success: false, error: error.message }));
  return true;
});

// =====================================================
// WEB REQUEST COOKIE COLLECTION
// =====================================================
chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    if (!details.tabId || details.tabId < 0) return;

    const setCookieHeaders = details.responseHeaders?.filter(
      header => header.name.toLowerCase() === "set-cookie"
    );

    if (setCookieHeaders?.length > 0) {
      const url = new URL(details.url);
      const domain = url.hostname;
      const mainDomain = Utils.extractMainDomain(domain);

      chrome.tabs.get(details.tabId, async function (tab) {
        if (!tab?.url) return;

        const tabUrl = new URL(tab.url);
        const tabDomain = tabUrl.hostname;
        const isThirdParty = !Utils.isDomainOrSubdomain(domain, tabDomain);

        if (!detectedCookies[details.tabId]) {
          detectedCookies[details.tabId] = [];
        }

        setCookieHeaders.forEach(header => {
          const cookieInfo = Utils.parseCookie(header.value);
          if (!cookieInfo?.name) return;

          detectedCookies[details.tabId].push({
            domain,
            mainDomain,
            url: details.url,
            cookieName: cookieInfo.name,
            cookieValue: cookieInfo.value,
            expires: cookieInfo.expires || "Session",
            path: cookieInfo.path || "/",
            httpOnly: cookieInfo.httpOnly,
            secure: cookieInfo.secure,
            sameSite: cookieInfo.sameSite || "None",
            timestamp: new Date().toISOString(),
            isThirdParty,
            initiator: details.initiator || null,
            tabUrl: tab.url,
            source: "webRequest",
          });
        });

        StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB, detectedCookies);

        if (details.tabId === activeTabId) {
          controller.cookieManager.updateBadgeForActiveTab();
        }
      });
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

// Clean up data when tab is closed
chrome.tabs.onRemoved.addListener(tabId => {
  if (detectedCookies[tabId]) {
    delete detectedCookies[tabId];
    StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB, detectedCookies);
  }
});

// Periodic cleanup
chrome.alarms.create("cleanup", { periodInMinutes: 60 });

chrome.alarms.onAlarm.addListener(async alarm => {
  if (alarm.name === "cleanup") {
    Utils.log("Running periodic cleanup");

    const cookiesByTab = await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB) || {};
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    Object.keys(cookiesByTab).forEach(tabId => {
      cookiesByTab[tabId] = cookiesByTab[tabId].filter(cookie => {
        const cookieTime = new Date(cookie.timestamp).getTime();
        return cookieTime > sevenDaysAgo;
      });

      if (cookiesByTab[tabId].length === 0) {
        delete cookiesByTab[tabId];
        if (detectedCookies[tabId]) {
          delete detectedCookies[tabId];
        }
      }
    });

    await StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB, cookiesByTab);
  }
});
