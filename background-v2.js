// =====================================================
// 1. CONFIGURATION & CONSTANTS
// =====================================================
const CONFIG = {
  STORAGE_KEYS: {
    COOKIES: "collected_cookies",
    COOKIES_BY_TAB: "cookiesByTab",
    COMPLIANCE_RESULT: "complianceResult",
    SETTINGS: "user_settings",
    BLOCKED_DOMAINS: "blocked_domains",
    CURRENT_TAB_RESULT: "currentTabDomain",
  },
  DEFAULTS: {
    SETTINGS: {
      autoScan: true,
      scanFrequency: "pageload",
      notifications: true,
    },
    SCAN_INTERVAL: 1 * 1000 * 6,
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

// Load blocked domains from storage at startup
chrome.storage.local.get(['cookiesByTab', 'blocked_domains'], function(result) {
  if (result.cookiesByTab) {
    detectedCookies = result.cookiesByTab;
  }
  if (result.blocked_domains) {
    blockedDomains = result.blocked_domains;
  }
});

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

  // Update badge for active tab
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

  // Manual scan functionality
  async performManualScan(tabId) {}
}

// =====================================================
// 5. ENHANCED BLOCKING MANAGER
// =====================================================
class BlockingManager {
  constructor() {
    this.ruleIdOffset = 100; // Starting ID for dynamic rules
  }

  async blockDomain(domain) {
    try {
      const blockedDomains =
        (await StorageManager.get(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS)) || [];

      if (!blockedDomains.includes(domain)) {
        blockedDomains.push(domain);
        await StorageManager.set(
          CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS,
          blockedDomains
        );

        // Update global variable
        this.blockedDomains = blockedDomains;
      }

      await this.updateBlockingRules(blockedDomains);
      return true;
    } catch (error) {
      Utils.log("Block domain error:", error);
      return false;
    }
  }

  async unblockDomain(domain) {
    try {
      const blockedDomains =
        (await StorageManager.get(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS)) || [];
      const updated = blockedDomains.filter((d) => d !== domain);

      await StorageManager.set(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS, updated);

      // Update global variable
      this.blockedDomains = updated;

      await this.updateBlockingRules(updated);
      return true;
    } catch (error) {
      Utils.log("Unblock domain error:", error);
      return false;
    }
  }

  async updateBlockingRules(domains = null) {
    try {
      const blockedDomains = domains ||
        (await StorageManager.get(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS)) || [];

      // Get current dynamic rules
      const currentRules = await chrome.declarativeNetRequest.getDynamicRules();
      const ruleIds = currentRules.map(rule => rule.id);

      // Create new blocking rules
      const newRules = blockedDomains.map((domain, index) => ({
        id: this.ruleIdOffset + index,
        priority: 2, // Higher priority to override default rules
        action: {
          type: "block"
        },
        condition: {
          requestDomains: [domain],
          resourceTypes: [
            "main_frame",
            "sub_frame",
            "stylesheet",
            "script",
            "image",
            "font",
            "object",
            "xmlhttprequest",
            "ping",
            "csp_report",
            "media",
            "websocket",
            "other"
          ]
        }
      }));

      // Update rules only if there are changes
      if (ruleIds.length > 0 || newRules.length > 0) {
        await chrome.declarativeNetRequest.updateDynamicRules({
          removeRuleIds: ruleIds,
          addRules: newRules
        });

        Utils.log("Blocking rules updated successfully", {
          blocked: blockedDomains,
          rulesCount: newRules.length
        });
      }

      return true;
    } catch (error) {
      Utils.log("Error updating blocking rules:", error);
      return false;
    }
  }

  // Get list of blocked domains
  async getBlockedDomains() {
    return (await StorageManager.get(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS)) || [];
  }

  // Check if domain is blocked
  async isDomainBlocked(domain) {
    const blockedDomains = await this.getBlockedDomains();
    return blockedDomains.includes(domain);
  }

  // Clear all blocked domains
  async clearAllBlockedDomains() {
    try {
      await StorageManager.set(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS, []);
      await this.updateBlockingRules([]);
      this.blockedDomains = [];
      return true;
    } catch (error) {
      Utils.log("Error clearing blocked domains:", error);
      return false;
    }
  }
}

// =====================================================
// 6. MAIN CONTROLLER
// =====================================================
class ExtensionController {
  constructor() {
    this.cookieManager = new CookieManager();
    this.blockingManager = new BlockingManager();
  }

  async handleInstallation() {
    Utils.log("Extension installed");
    await StorageManager.set(
      CONFIG.STORAGE_KEYS.SETTINGS,
      CONFIG.DEFAULTS.SETTINGS
    );

    // Initialize blocking rules
    await this.blockingManager.updateBlockingRules();

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

        case "BLOCK_DOMAIN":
          const blocked = await this.blockingManager.blockDomain(
            request.domain
          );
          return { success: blocked };

        case "UNBLOCK_DOMAIN":
          const unblocked = await this.blockingManager.unblockDomain(
            request.domain
          );
          return { success: unblocked };

        case "GET_BLOCKED_DOMAINS":
          const blockedDomains = await this.blockingManager.getBlockedDomains();
          return { success: true, data: blockedDomains };

        case "IS_DOMAIN_BLOCKED":
          const isBlocked = await this.blockingManager.isDomainBlocked(
            request.domain
          );
          return { success: true, data: isBlocked };

        case "CLEAR_ALL_BLOCKED_DOMAINS":
          const cleared = await this.blockingManager.clearAllBlockedDomains();
          return { success: cleared };

        case "UPDATE_BLOCKED_DOMAINS":
          // For compatibility with popup
          await StorageManager.set(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS, request.domains);
          await this.blockingManager.updateBlockingRules(request.domains);
          blockedDomains = request.domains; // Update global variable
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
  await controller.cookieManager.updateBadgeForActiveTab();
});

// Tab updated listener
chrome.tabs.onUpdated.addListener(function(tabId, changeInfo, tab) {
  if (changeInfo.status === 'complete') {
    // Save current tabId if it's the active tab
    if (tab.active) {
      activeTabId = tabId;
    }
    // Update badge
    if (tabId === activeTabId) {
      controller.cookieManager.updateBadgeForActiveTab();
    }

    // Perform compliance check
    if (tabId === activeTabId) {
      performComplianceCheck(tabId);
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

    await controller.cookieManager.updateBadgeForActiveTab();
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

// Clean up data when tab is closed
chrome.tabs.onRemoved.addListener((tabId) => {
  if (detectedCookies[tabId]) {
    delete detectedCookies[tabId];
    StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB, detectedCookies);
  }
});

// Notification click handling
chrome.notifications.onClicked.addListener((notificationId) => {
  chrome.action.openPopup();
});

// =====================================================
// 9. PERIODIC CLEANUP
// =====================================================
chrome.alarms.create("cleanup", { periodInMinutes: 60 });

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
  }
});

// =====================================================
// 10. DOMAIN PROCESSING & COOKIE COLLECTION FUNCTIONS
// =====================================================

/**
 * Lấy danh sách tất cả domains từ cookies đã thu thập
 * @param {number|null} tabId - ID của tab cụ thể (null để lấy tất cả)
 * @returns {Array} Mảng các domain unique
 */
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

// Phân loại domains thành first-party và third-party
async function categorizeDomainsByParty(tabId) {
  try {
    const cookiesByTab =
      (await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB)) || {};
    const tabCookies = cookiesByTab[tabId] || [];

    const firstPartyDomains = new Set();
    const thirdPartyDomains = new Set();

    tabCookies.forEach((cookie) => {
      if (cookie.isThirdParty) {
        thirdPartyDomains.add(cookie.domain);
        thirdPartyDomains.add(cookie.mainDomain);
      } else {
        firstPartyDomains.add(cookie.domain);
        firstPartyDomains.add(cookie.mainDomain);
      }
    });

    return {
      firstParty: Array.from(firstPartyDomains).filter((domain) => domain),
      thirdParty: Array.from(thirdPartyDomains).filter((domain) => domain),
    };
  } catch (error) {
    Utils.log("Error categorizing domains:", error);
    return { firstParty: [], thirdParty: [] };
  }
}

// Lấy thống kê chi tiết về cookies theo domain
async function getDomainCookieStats(domain) {
  try {
    const cookiesByTab =
      (await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES_BY_TAB)) || {};
    const stats = {
      domain: domain,
      totalCookies: 0,
      sessionCookies: 0,
      persistentCookies: 0,
      secureCookies: 0,
      httpOnlyCookies: 0,
      sameSiteNone: 0,
      sameSiteStrict: 0,
      sameSiteLax: 0,
      tabsWithCookies: 0,
      cookieNames: new Set(),
      lastSeen: null,
    };

    Object.values(cookiesByTab).forEach((tabCookies) => {
      let hasThisDomain = false;

      tabCookies.forEach((cookie) => {
        if (cookie.domain === domain || cookie.mainDomain === domain) {
          if (!hasThisDomain) {
            stats.tabsWithCookies++;
            hasThisDomain = true;
          }

          stats.totalCookies++;
          stats.cookieNames.add(cookie.cookieName);

          // Phân loại theo loại cookie
          if (cookie.expires === "Session") {
            stats.sessionCookies++;
          } else {
            stats.persistentCookies++;
          }

          if (cookie.secure) stats.secureCookies++;
          if (cookie.httpOnly) stats.httpOnlyCookies++;

          // Phân loại theo SameSite
          switch (cookie.sameSite?.toLowerCase()) {
            case "none":
              stats.sameSiteNone++;
              break;
            case "strict":
              stats.sameSiteStrict++;
              break;
            case "lax":
              stats.sameSiteLax++;
              break;
          }

          // Cập nhật thời gian cuối cùng nhìn thấy
          const cookieTime = new Date(cookie.timestamp);
          if (!stats.lastSeen || cookieTime > stats.lastSeen) {
            stats.lastSeen = cookieTime;
          }
        }
      });
    });

    stats.cookieNames = Array.from(stats.cookieNames);
    return stats;
  } catch (error) {
    Utils.log("Error getting domain cookie stats:", error);
    return null;
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

async function getAllCookiesFromActiveTab(activeTabId) {
  const url = await chrome.tabs.get(activeTabId).then((tab) => tab.url);
  const domain = new URL(url).hostname;
  const domains = (await getAllDomainsFromCookies(activeTabId)) || [domain];
  const allCookies = await getAllCookiesFromDomainsList(domains, url);
  return allCookies;
}
