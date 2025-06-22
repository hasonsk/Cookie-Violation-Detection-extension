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
    SERVER_API: "http://127.0.0.1:8000",
    COOKIES_ANALYZE: "http://127.0.0.1:8000/violations/analyze",
  },
};

// Global variables for tracking
let detectedCookies = {};
let activeTabId = null;
let isDetectedCookiesInPolicy = false;

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

    const parts = setCookieHeader.split(";").map((part) => part.trim());
    const [nameValue] = parts;
    const [name, value] = nameValue.split("=");

    const cookie = {
      name: name?.trim(),
      value: value?.trim() || "",
      attributes: {},
    };

    parts.slice(1).forEach((part) => {
      const [key, val] = part.split("=");
      const attrKey = key?.trim().toLowerCase();

      if (attrKey === "expires") {
        cookie.expires = val?.trim();
      } else if (attrKey === "max-age") {
        cookie.maxAge = parseInt(val?.trim());
      } else if (attrKey === "path") {
        cookie.path = val?.trim();
      } else if (attrKey === "domain") {
        cookie.domain = val?.trim();
      } else if (attrKey === "samesite") {
        cookie.sameSite = val?.trim();
      } else if (attrKey === "httponly") {
        cookie.httpOnly = true;
      } else if (attrKey === "secure") {
        cookie.secure = true;
      }
    });

    return cookie;
  },

  // Extract main domain from subdomain
  extractMainDomain(domain) {
    const parts = domain.split(".");
    if (parts.length >= 2) {
      return parts.slice(-2).join(".");
    }
    return domain;
  },

  // Check if domain is subdomain or same domain
  isDomainOrSubdomain(cookieDomain, tabDomain) {
    if (cookieDomain === tabDomain) return true;

    // Remove leading dot from cookie domain if present
    const cleanCookieDomain = cookieDomain.startsWith(".")
      ? cookieDomain.substring(1)
      : cookieDomain;

    return (
      tabDomain.endsWith("." + cleanCookieDomain) ||
      tabDomain === cleanCookieDomain
    );
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
      cookiesByTab = cookiesByTab[tabId];

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
// 6. BLOCKING MANAGER
// =====================================================
class BlockingManager {
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
      await this.updateBlockingRules(updated);
      return true;
    } catch (error) {
      Utils.log("Unblock domain error:", error);
      return false;
    }
  }
}

// =====================================================
// 8. MAIN CONTROLLER
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
    await chrome.tabs.create({
      url: chrome.runtime.getURL("cookie-compliance-checker.html"),
    });
  }

  async handleMessage(request, sender, sendResponse) {
    // Utils.log("Received message:", request);
    // Lấy thông tin tab hiện tại

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

        case "CLEAR_COOKIES":
          const cleared = await this.cookieManager.clearCookiesForDomain(
            request.domain
          );
          return { success: cleared };

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
// 9. EVENT LISTENERS & INITIALIZATION
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
  //  lắng nghe sự kiện người dùng chuyển đổi giữa các tab trong trình duyệt
  activeTabId = activeInfo.tabId;
  await controller.cookieManager.updateBadgeForActiveTab();
});

// TODO: Xử lý khi tab được load xong --> GỬI URL --> SERVER -->
// chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
//   if (changeInfo.status === "complete" && tabId === activeTabId) {
//     if (
//       !tab.url ||
//       (!tab.url.startsWith("http://") && !tab.url.startsWith("https://"))
//     ) {
//       Utils.log(`Skipping scan for non-web URL: ${tab.url}`);
//       return;
//     }

//     const excludedDomains = ["chrome://newtab", "chrome://extensions"];
//     if (excludedDomains.some((excluded) => tab.url.includes(excluded))) {
//       Utils.log(`Skipping scan for excluded domain: ${tab.url}`);
//       return;
//     }

//     await controller.cookieManager.updateBadgeForActiveTab();
//     const allCookiesFromDomainsList = await getAllCookiesFromActiveTab(
//       activeTabId
//     );
//     const body = {
//       website_url: tab.url,
//       cookies: allCookiesFromDomainsList,
//     };
//     Utils.log("Sending cookies to server for analysis:", body);

//     const response = await fetch(CONFIG.API_ENDPOINTS.COOKIES_ANALYZE, {
//       method: "POST",
//       headers: {
//         "Content-Type": "application/json",
//       },
//       body: JSON.stringify(body),
//     });

//     const result = await response.json();
//     Utils.log("Compliance Result:", result);

//     const url = new URL(tab.url);
//     const rootUrl = `${url.protocol}//${url.hostname}`;

//     const existingData = await StorageManager.get(CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT) || {};

//     const updatedData = {
//       ...existingData,
//       [rootUrl]: result
//     };

//     await StorageManager.set(CONFIG.STORAGE_KEYS.COMPLIANCE_RESULT, updatedData);
//     Utils.log("Compliance result saved to localStorage", updatedData);
//   }
// });

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

chrome.tabs.onUpdated.addListener(async (tabId, changeInfo, tab) => {
  if (changeInfo.status === "complete" && tabId === activeTabId) {
    await performComplianceCheck(tabId);
  }
});

// setInterval(() => {
// }, CONFIG.DEFAULTS.SCAN_INTERVAL || 600000);

// Message handling
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  controller
    .handleMessage(request, sender, sendResponse)
    .then((response) => sendResponse(response))
    .catch((error) => sendResponse({ success: false, error: error.message }));

  return true; // Keep message channel open for async response
});

// =====================================================
// 10. WEB REQUEST COOKIE COLLECTION
// =====================================================
chrome.webRequest.onHeadersReceived.addListener(
  function (details) {
    // Chỉ xử lý cho tab có ID hợp lệ
    // if (!details.tabId || details.tabId < 0) {
    //   return; // Bỏ qua request không thuộc về tab nào
    // }
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
// 11. PERIODIC CLEANUP
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

// =====================================================
// DOMAIN PROCESSING & COOKIE COLLECTION FUNCTIONS
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
