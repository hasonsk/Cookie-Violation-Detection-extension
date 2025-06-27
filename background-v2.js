// =====================================================
// 1. CONFIGURATION & CONSTANTS
// =====================================================
const CONFIG = {
  STORAGE_KEYS: {
    COOKIES_BY_TAB: "cookiesByTab",
    COMPLIANCE_RESULT: "complianceResult",
    SETTINGS: "user_settings",
    CURRENT_TAB_RESULT: "currentTabDomain",
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

// Global variables for tracking
let detectedCookies = {};
let activeTabId = null;
let isDetectedCookiesInPolicy = false;
let blockedDomains = []; // Danh sách domain bị chặn

// =====================================================
// 2. UTILITY FUNCTIONS
// =====================================================
const Utils = {
  debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
      const later = () => {
        clearTimeout(timeout);
        func(...args);
      };
      clearTimeout(timeout);
      timeout = setTimeout(later, wait);
    };
  },

  // Parse cookie từ Set-Cookie header
  parseCookie(setCookieHeader) {
    if (!setCookieHeader) return null;

    const result = {};
    const parts = setCookieHeader.split(";").map((part) => part.trim());

    // Phần đầu tiên là name=value
    const nameValue = parts[0].split('=');
    result.name = nameValue[0];
    result.value = nameValue.slice(1).join('=');

    // Phân tích các phần khác
    for (let i = 1; i < parts.length; i++) {
      const part = parts[i].trim();
      const partLower = part.toLowerCase();

      if (partLower === 'httponly') {
        result.httpOnly = true;
      } else if (partLower === 'secure') {
        result.secure = true;
      } else if (partLower.startsWith('expires=')) {
        result.expires = part.substring('expires='.length);
      } else if (partLower.startsWith('max-age=')) {
        const maxAge = parseInt(part.substring('max-age='.length));
        if (!isNaN(maxAge)) {
          const expiryDate = new Date();
          expiryDate.setSeconds(expiryDate.getSeconds() + maxAge);
          result.expires = expiryDate.toUTCString();
        }
      } else if (partLower.startsWith('path=')) {
        result.path = part.substring('path='.length);
      } else if (partLower.startsWith('domain=')) {
        result.domain = part.substring('domain='.length);
      } else if (partLower.startsWith('samesite=')) {
        result.sameSite = part.substring('samesite='.length);
      }
    }

    return result;
  },

  // Extract main domain from subdomain
  extractMainDomain(domain) {
    const parts = domain.split(".");
    if (parts.length <= 2) return domain;

    // Xử lý đặc biệt cho một số TLD phổ biến
    const specialTLDs = ['co.uk', 'com.au', 'com.vn', 'org.uk'];
    const lastTwoParts = parts.slice(-2).join('.');

    if (specialTLDs.includes(lastTwoParts)) {
      return parts.slice(-3).join('.');
    }
    return parts.slice(-2).join('.');
  },

  // Check if domain is subdomain or same domain
  isDomainOrSubdomain(domain, parentDomain) {
    return domain === parentDomain || domain.endsWith('.' + parentDomain);
  },

  // Generate unique ID
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Log with timestamp
  log(message, data = null) {
    console.log(`[CookieExt ${new Date().toISOString()}] ${message}`, data);
  },
};

// =====================================================
// 3. STORAGE MANAGER
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
// 4. COOKIE MANAGER (Updated for WebRequest)
// =====================================================
class CookieManager {
  constructor() {
    this.scanInProgress = new Set();
    this.tabBadgeCache = new Map(); // Cache badge data for each tab
  }

  // Get cookies for specific tab
  async getCookiesForTab(tabId) {
    const cookiesByTab =
      (await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB)) || {};
    return cookiesByTab[tabId] || [];
  }

  // Get cookies for specific domain from tab data
  async getCookiesForDomain(domain) {
    const cookiesByTab =
      (await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB)) || {};
    const allCookies = [];

    Object.values(cookiesByTab).forEach((tabCookies) => {
      tabCookies.forEach((cookie) => {
        if (cookie.domain === domain || cookie.mainDomain === domain) {
          allCookies.push(cookie);
        }
      });
    });

    return allCookies;
  }

  // Clear cookies for domain
  async clearCookiesForDomain(domain) {
    try {
      const cookies = await chrome.cookies.getAll({ domain });

      for (const cookie of cookies) {
        await chrome.cookies.remove({
          url: `http${cookie.secure ? "s" : ""}://${cookie.domain}${
            cookie.path
          }`,
          name: cookie.name,
        });
      }

      // Clear from storage
      const cookiesByTab =
        (await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB)) || {};

      Object.keys(cookiesByTab).forEach((tabId) => {
        cookiesByTab[tabId] = cookiesByTab[tabId].filter(
          (cookie) => cookie.domain !== domain && cookie.mainDomain !== domain
        );
      });

      await StorageManager.set(
        CONFIG.STORAGE_KEYS.COOKIES_BY_TAB,
        cookiesByTab
      );
      return true;
    } catch (error) {
      Utils.log("Clear cookies error:", error);
      return false;
    }
  }

  // Get compliance result for specific tab
  async getComplianceResultForTab(tabId) {
    try {
      const tab = await chrome.tabs.get(tabId);
      if (!tab || !tab.url) {
        return null;
      }

      // Kiểm tra URL hợp lệ
      if (!tab.url.startsWith("http://") && !tab.url.startsWith("https://")) {
        return null;
      }

      const url = new URL(tab.url);
      const rootUrl = `${url.protocol}//${url.hostname}`;

      const allComplianceResults = await StorageManager.get(
        CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT
      );

      return allComplianceResults?.[rootUrl] || null;
    } catch (error) {
      Utils.log("Error getting compliance result for tab:", error);
      return null;
    }
  }

  // Update badge for specific tab
  async updateBadgeForTab(tabId) {
    try {
      if (!tabId || tabId < 0) {
        return;
      }

      const complianceResult = await this.getComplianceResultForTab(tabId);

      let badgeText = "";
      let badgeColor = "#4ECDC4"; // Default green for no issues

      if (complianceResult && complianceResult.total_issues !== undefined) {
        const issueCount = complianceResult.total_issues || 0;

        if (issueCount > 0) {
          badgeText = issueCount.toString();
          badgeColor = "#FF6B6B"; // Red for issues
        }

        // Cache the badge data for this tab
        this.tabBadgeCache.set(tabId, {
          text: badgeText,
          color: badgeColor,
          timestamp: Date.now()
        });

        Utils.log(`Updated badge for tab ${tabId}: ${badgeText} issues`);
      } else {
        // No compliance result yet, check if we have cached data
        const cachedBadge = this.tabBadgeCache.get(tabId);
        if (cachedBadge) {
          badgeText = cachedBadge.text;
          badgeColor = cachedBadge.color;
        }
      }

      // Update badge display
      await chrome.action.setBadgeText({
        text: badgeText,
        tabId: tabId,
      });

      await chrome.action.setBadgeBackgroundColor({
        color: badgeColor,
        tabId: tabId,
      });

    } catch (error) {
      Utils.log("Error updating badge for tab:", error);
    }
  }

  // Update badge for currently active tab
  async updateBadgeForActiveTab() {
    if (!activeTabId || activeTabId < 0) {
      // Try to get active tab if activeTabId is not set
      try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab) {
          activeTabId = tab.id;
        } else {
          return;
        }
      } catch (error) {
        Utils.log("Error getting active tab:", error);
        return;
      }
    }

    await this.updateBadgeForTab(activeTabId);
  }

  // Update badges for all tabs (useful for bulk updates)
  async updateBadgeForAllTabs() {
    try {
      const tabs = await chrome.tabs.query({});

      for (const tab of tabs) {
        if (tab.id && tab.id >= 0) {
          await this.updateBadgeForTab(tab.id);
        }
      }
    } catch (error) {
      Utils.log("Error updating badges for all tabs:", error);
    }
  }

  // Clear badge cache for specific tab
  clearBadgeCacheForTab(tabId) {
    this.tabBadgeCache.delete(tabId);
  }

  // Clear badge cache for closed tabs
  cleanupBadgeCache() {
    chrome.tabs.query({}, (tabs) => {
      const activeTabIds = new Set(tabs.map(tab => tab.id));

      // Remove cache entries for tabs that no longer exist
      for (const [tabId] of this.tabBadgeCache) {
        if (!activeTabIds.has(tabId)) {
          this.tabBadgeCache.delete(tabId);
        }
      }
    });
  }

  // Manual scan functionality
  async performManualScan(tabId) {
    // Implementation for manual scan if needed
  }
}

// =====================================================
// 6. MAIN CONTROLLER
// =====================================================
class ExtensionController {
  constructor() {
    this.cookieManager = new CookieManager();
  }

  async handleInstallation() {
    Utils.log("Extension installed");
    await StorageManager.set(
      CONFIG.STORAGE_KEYS.SETTINGS,
      CONFIG.DEFAULTS.SETTINGS
    );

    await chrome.tabs.create({
      url: chrome.runtime.getURL("cookie-compliance-checker.html"),
    });
  }

  async handleMessage(request, sender, sendResponse) {
    try {
      switch (request.action) {
        case "GET_COMPLIANCE_RESULT":
          const [activeTab] = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });

          if (!activeTab || !activeTab.url) {
            return { success: false, error: "No active tab found" };
          }

          const url = new URL(activeTab.url);
          const rootUrl = `${url.protocol}//${url.hostname}`;
          Utils.log("Active tab URL:", rootUrl);

          const allComplianceResults = await StorageManager.get(
            CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT
          );
          const currentTabResult = allComplianceResults?.[rootUrl] || null;
          Utils.log("Compliance result for current tab:", currentTabResult);

          return {
            success: true,
            data: currentTabResult,
          };

        case "GET_RESULT_DETAILS":
          const domain = await StorageManager.get(
            CONFIG.STORAGE_KEYS.CURRENT_TAB_RESULT
          );
          console.log("Current tab domain:", domain);
          const allResults = await StorageManager.get(
            CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT
          );
          const resultDetails = allResults?.[domain] || null;
          Utils.log("Result details for domain:", resultDetails);

          return {
            success: true,
            data: resultDetails,
          };

        case "UPDATE_SETTINGS":
          await StorageManager.updateSettings(request.settings);
          return { success: true };

        case "CLEAR_COOKIES":
          const cookiesCleared = await this.cookieManager.clearCookiesForDomain(
            request.domain
          );
          return { success: cookiesCleared };

        case "DELETE_COOKIES":
          async function deleteAllCookiesForDomain(domain) {
            const cookies = await chrome.cookies.getAll({ domain: domain });
            for (let cookie of cookies) {
              const url = (cookie.secure ? "https://" : "http://") + cookie.domain + cookie.path;
              await chrome.cookies.remove({
                url: url,
                name: cookie.name,
                storeId: cookie.storeId
              });
            }
          }

          if (request.domain) {
            await deleteAllCookiesForDomain(request.domain);
            sendResponse({ status: "started" });
            return true;
          } else {
            return { success: false, error: "Domain is required" };
          }

        case "CHECK_AGAIN":
        case "MANUAL_SCAN":
          try {
            const [activeTab] = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });

            if (!activeTab) {
              return { success: false, error: "No active tab found" };
            }

            Utils.log("Starting CHECK_AGAIN for tab:", activeTab.id);

            const result = await performComplianceCheck(activeTab.id);

            if (result) {
              return {
                success: true,
                data: result,
                message: "Compliance check completed",
              };
            } else {
              return {
                success: false,
                error: "Unable to perform compliance check",
              };
            }
          } catch (error) {
            Utils.log("Error in CHECK_AGAIN:", error);
            return { success: false, error: error.message };
          }
      }
    } catch (error) {
      Utils.log("Message handling error:", error);
      return { success: false, error: error.message };
    }
  }
}

// =====================================================
// 7. EVENT LISTENERS & INITIALIZATION
// =====================================================
const controller = new ExtensionController();

// Installation event
chrome.runtime.onInstalled.addListener((details) => {
  if (details.reason === "install") {
    controller.handleInstallation();
  }
});

// Track active tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  Utils.log(`Tab activated: ${activeTabId}`);

  // Update badge for the newly active tab
  await controller.cookieManager.updateBadgeForActiveTab();
});

// Tab updated listener - enhanced
chrome.tabs.onUpdated.addListener(async function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    // Save current tabId if it's the active tab
    if (tab.active) {
      activeTabId = tabId;
    }

    // Always update badge for completed tab loads
    await controller.cookieManager.updateBadgeForTab(tabId);

    // Perform compliance check for active tab
    if (tabId === activeTabId) {
      try {
        await performComplianceCheck(tabId);
        // Update badge again after compliance check
        await controller.cookieManager.updateBadgeForTab(tabId);
      } catch (error) {
        Utils.log("Error in compliance check:", error);
      }
    }
  }
});

// Hàm riêng để xử lý compliance check
async function performComplianceCheck(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);

    // Kiểm tra URL hợp lệ
    if (
      !tab.url ||
      (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))
    ) {
      Utils.log(`Skipping scan for non-web URL: ${tab.url}`);
      return null;
    }

    const excludedDomains = ["chrome://newtab", "chrome://extensions"];
    if (excludedDomains.some((excluded) => tab.url.includes(excluded))) {
      Utils.log(`Skipping scan for excluded domain: ${tab.url}`);
      return null;
    }

    const allCookiesFromDomainsList = await getAllCookiesFromActiveTab(tabId);

    const body = {
      website_url: tab.url,
      cookies: allCookiesFromDomainsList,
    };

    Utils.log("Sending cookies to server for analysis:", body);

    const response = await fetch(CONFIG.API_ENDPOINTS.COOKIES_ANALYZE, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const result = await response.json();
    Utils.log("Compliance Result:", result);

    // Lưu kết quả
    await saveComplianceResult(tab.url, result);

    // Update badge for this specific tab
    await controller.cookieManager.updateBadgeForTab(tabId);

    return result;
  } catch (error) {
    Utils.log("Error in performComplianceCheck:", error);
    throw error;
  }
}

// Hàm riêng để lưu kết quả
async function saveComplianceResult(tabUrl, result) {
  // Lấy root URL (domain + protocol)
  const url = new URL(tabUrl);
  const rootUrl = `${url.protocol}//${url.hostname}`;

  // Lấy dữ liệu hiện tại từ storage
  const existingData =
    (await StorageManager.get(CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT)) || {};

  // Cập nhật dữ liệu với format mới
  const updatedData = {
    ...existingData,
    [rootUrl]: result,
  };

  // Lưu dữ liệu đã cập nhật
  await StorageManager.set(CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT, updatedData);
  Utils.log("Compliance result saved to localStorage", updatedData);
}

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  controller
    .handleMessage(request, sender, sendResponse)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true; // Keep message channel open for async response
});

// =====================================================
// 8. WEB REQUEST COOKIE COLLECTION (Enhanced)
// =====================================================
chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    // Chỉ xử lý cho tab có ID hợp lệ
    if (!details.tabId || details.tabId < 0) {
      return; // Bỏ qua request không thuộc về tab nào
    }

    // Tìm kiếm tất cả các header Set-Cookie
    const setCookieHeaders = details.responseHeaders?.filter(
      (header) => header.name.toLowerCase() === "set-cookie"
    );

    if (setCookieHeaders && setCookieHeaders.length > 0) {
      // Trích xuất thông tin từ URL
      const url = new URL(details.url);
      const domain = url.hostname;
      const mainDomain = Utils.extractMainDomain(domain);

      // Xác định main URL của tab đang xem
      if (details.tabId >= 0) {
        chrome.tabs.get(details.tabId, async function (tab) {
          if (!tab || !tab.url) return;

          const tabUrl = new URL(tab.url);
          const tabDomain = tabUrl.hostname;
          const isThirdParty = !Utils.isDomainOrSubdomain(domain, tabDomain);

          // Khởi tạo mảng cho tab này nếu chưa có
          if (!detectedCookies[details.tabId]) {
            detectedCookies[details.tabId] = [];
          }

          // Lưu thông tin về mỗi cookie được đặt
          setCookieHeaders.forEach((header) => {
            const cookieInfo = Utils.parseCookie(header.value);
            if (!cookieInfo || !cookieInfo.name) return;

            const timestamp = new Date().toISOString();

            // Lưu thêm thông tin về nguồn gốc (first-party/third-party)
            detectedCookies[details.tabId].push({
              domain: domain,
              mainDomain: mainDomain,
              url: details.url,
              cookieName: cookieInfo.name,
              cookieValue: cookieInfo.value,
              expires: cookieInfo.expires || "Session",
              path: cookieInfo.path || "/",
              httpOnly: cookieInfo.httpOnly || false,
              secure: cookieInfo.secure || false,
              sameSite: cookieInfo.sameSite || "None",
              timestamp: timestamp,
              isThirdParty: isThirdParty,
              initiator: details.initiator || null,
              tabUrl: tab.url,
              source: "webRequest",
            });
          });

          // Lưu trữ vào chrome.storage
          StorageManager.set(
            CONFIG.STORAGE_KEYS.COOKIES_BY_TAB,
            detectedCookies
          );

          // Cập nhật badge nếu đây là tab đang active
          if (details.tabId === activeTabId) {
            controller.cookieManager.updateBadgeForActiveTab();
          }
        });
      }
    }
  },
  { urls: ["<all_urls>"] },
  ["responseHeaders", "extraHeaders"]
);

chrome.tabs.onRemoved.addListener((tabId) => {
  // Clean up detected cookies
  if (detectedCookies[tabId]) {
    delete detectedCookies[tabId];
    StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB, detectedCookies);
  }

  controller.cookieManager.clearBadgeCacheForTab(tabId);

  Utils.log(`Cleaned up data for closed tab: ${tabId}`);
});


// =====================================================
// 9. PERIODIC CLEANUP
// =====================================================
chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name === "cleanup") {
    Utils.log("Running periodic cleanup");

    // Clean up old cookie data (older than 7 days)
    const cookiesByTab =
      (await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB)) || {};
    const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;

    Object.keys(cookiesByTab).forEach((tabId) => {
      cookiesByTab[tabId] = cookiesByTab[tabId].filter((cookie) => {
        const cookieTime = new Date(cookie.timestamp).getTime();
        return cookieTime > sevenDaysAgo;
      });

      // Remove empty tab entries
      if (cookiesByTab[tabId].length === 0) {
        delete cookiesByTab[tabId];
        if (detectedCookies[tabId]) {
          delete detectedCookies[tabId];
        }
      }
    });

    await StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB, cookiesByTab);

    // Clean up badge cache
    controller.cookieManager.cleanupBadgeCache();
  }
});

// =====================================================
// 10. DOMAIN PROCESSING & COOKIE COLLECTION FUNCTIONS
// =====================================================
async function getAllDomainsFromCookies(tabId = null) {
  try {
    const cookiesByTab =
      (await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB)) || {};
    const domains = new Set();

    if (tabId !== null) {
      // Lấy domains từ tab cụ thể
      const tabCookies = cookiesByTab[tabId] || [];
      tabCookies.forEach((cookie) => {
        domains.add(cookie.domain);
        domains.add(cookie.mainDomain);
      });
    } else {
      // Lấy domains từ tất cả tabs
      Object.values(cookiesByTab).forEach((tabCookies) => {
        tabCookies.forEach((cookie) => {
          domains.add(cookie.domain);
          domains.add(cookie.mainDomain);
        });
      });
    }
    console.log("Danh sach domain: ", domains);
    return Array.from(domains).filter((domain) => domain); // Loại bỏ null/undefined
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
      allCookies.push(
        ...cookies.map((cookie) => ({
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
        }))
      );
    }

    return allCookies;
  } catch (error) {
    Utils.log("Error getting cookies from domains list:", error);
    return [];
  }
}

chrome.runtime.onStartup.addListener(() => {
  chrome.alarms.create("cleanup", { delayInMinutes: 60, periodInMinutes: 60 });
});

async function getAllCookiesFromActiveTab(activeTabId) {
  const url = await chrome.tabs.get(activeTabId).then((tab) => tab.url);
  const domain = new URL(url).hostname;
  const domains = (await getAllDomainsFromCookies(activeTabId)) || [domain];
  const allCookies = await getAllCookiesFromDomainsList(domains, url);
  return allCookies;
}
