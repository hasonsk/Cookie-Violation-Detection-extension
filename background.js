// // =====================================================
// // 1. CONFIGURATION & CONSTANTS
// // =====================================================
// const CONFIG = {
//   STORAGE_KEYS: {
//     COOKIES: 'collected_cookies',
//     SETTINGS: 'user_settings',
//     BLOCKED_DOMAINS: 'blocked_domains',
//     SCAN_HISTORY: 'scan_history'
//   },
//   DEFAULTS: {
//     SETTINGS: {
//       autoScan: true,
//       scanFrequency: 'pageload',
//       notifications: true
//     },
//     SCAN_INTERVAL: 5 * 60 * 1000 // 5 minutes
//   },
//   API_ENDPOINTS: {
//     POLICY_ANALYSIS: 'https://api.cookiecheck.com/analyze'
//   }
// };

// // =====================================================
// // 2. UTILITY FUNCTIONS
// // =====================================================
// const Utils = {
//   // Debounce function để tránh spam
//   debounce(func, wait) {
//     let timeout;
//     return function executedFunction(...args) {
//       const later = () => {
//         clearTimeout(timeout);
//         func(...args);
//       };
//       clearTimeout(timeout);
//       timeout = setTimeout(later, wait);
//     };
//   },

//   // Parse cookie từ HTTP header
//   parseCookieHeader(cookieHeader) {
//     if (!cookieHeader) return null;

//     const parts = cookieHeader.split(';').map(part => part.trim());
//     const [nameValue] = parts;
//     const [name, value] = nameValue.split('=');

//     const cookie = { name, value, attributes: {} };

//     parts.slice(1).forEach(part => {
//       const [key, val] = part.split('=');
//       cookie.attributes[key.toLowerCase()] = val || true;
//     });

//     return cookie;
//   },

//   // Generate unique ID
//   generateId() {
//     return Date.now().toString(36) + Math.random().toString(36).substr(2);
//   },

//   // Log with timestamp
//   log(message, data = null) {
//     console.log(`[CookieExt ${new Date().toISOString()}] ${message}`, data);
//   }
// };

// // =====================================================
// // 3. STORAGE MANAGER
// // =====================================================
// class StorageManager {
//   static async get(key) {
//     try {
//       const result = await chrome.storage.local.get(key);
//       return result[key];
//     } catch (error) {
//       Utils.log('Storage get error:', error);
//       return null;
//     }
//   }

//   static async set(key, value) {
//     try {
//       await chrome.storage.local.set({ [key]: value });
//       return true;
//     } catch (error) {
//       Utils.log('Storage set error:', error);
//       return false;
//     }
//   }

//   static async getSettings() {
//     const settings = await this.get(CONFIG.STORAGE_KEYS.SETTINGS);
//     return { ...CONFIG.DEFAULTS.SETTINGS, ...settings };
//   }

//   static async updateSettings(newSettings) {
//     const currentSettings = await this.getSettings();
//     return await this.set(CONFIG.STORAGE_KEYS.SETTINGS, {
//       ...currentSettings,
//       ...newSettings
//     });
//   }
// }

// // =====================================================
// // 4. COOKIE MANAGER
// // =====================================================
// class CookieManager {
//   constructor() {
//     this.scanInProgress = new Set();
//   }

//   // UC-02: Basic Cookie Data Collection
//   async collectCookiesFromTab(tabId) {
//     if (this.scanInProgress.has(tabId)) return;

//     this.scanInProgress.add(tabId);

//     try {
//       const tab = await chrome.tabs.get(tabId);
//       const url = new URL(tab.url);

//       // Get cookies for current domain
//       const cookies = await chrome.cookies.getAll({ domain: url.hostname });

//       // Process and store cookies
//       const processedCookies = cookies.map(cookie => ({
//         ...cookie,
//         id: Utils.generateId(),
//         collectedAt: Date.now(),
//         tabId: tabId,
//         violations: [] // Will be populated in Phase 3
//       }));

//       await this.storeCookies(url.hostname, processedCookies);
//       await this.updateBadge(tabId, processedCookies.length);

//       Utils.log(`Collected ${processedCookies.length} cookies from ${url.hostname}`);

//     } catch (error) {
//       Utils.log('Cookie collection error:', error);
//     } finally {
//       this.scanInProgress.delete(tabId);
//     }
//   }

//   async storeCookies(domain, cookies) {
//     const existingData = await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES) || {};
//     existingData[domain] = {
//       cookies,
//       lastUpdated: Date.now()
//     };

//     await StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES, existingData);
//   }

//   async getCookiesForDomain(domain) {
//     const data = await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES) || {};
//     return data[domain]?.cookies || [];
//   }

//   // UC-09: Clear Cookies Functionality
//   async clearCookiesForDomain(domain) {
//     try {
//       const cookies = await chrome.cookies.getAll({ domain });

//       for (const cookie of cookies) {
//         await chrome.cookies.remove({
//           url: `http${cookie.secure ? 's' : ''}://${cookie.domain}${cookie.path}`,
//           name: cookie.name
//         });
//       }

//       // Clear from storage
//       const data = await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES) || {};
//       delete data[domain];
//       await StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES, data);

//       return true;
//     } catch (error) {
//       Utils.log('Clear cookies error:', error);
//       return false;
//     }
//   }

//   async updateBadge(tabId, count) {
//     await chrome.action.setBadgeText({
//       text: count > 0 ? count.toString() : '',
//       tabId
//     });

//     await chrome.action.setBadgeBackgroundColor({
//       color: count > 0 ? '#FF6B6B' : '#4ECDC4'
//     });
//   }
// }

// // =====================================================
// // 5. POLICY ANALYZER (Phase 3)
// // =====================================================
// class PolicyAnalyzer {
//   // UC-10: Cookie Policy Analysis Integration
//   async analyzePolicy(domain, cookies) {
//     try {
//       const response = await fetch(CONFIG.API_ENDPOINTS.POLICY_ANALYSIS, {
//         method: 'POST',
//         headers: { 'Content-Type': 'application/json' },
//         body: JSON.stringify({ domain, cookies })
//       });

//       if (!response.ok) throw new Error('API request failed');

//       const analysis = await response.json();
//       return analysis;

//     } catch (error) {
//       Utils.log('Policy analysis error:', error);
//       return { violations: [], score: 0 };
//     }
//   }

//   // UC-11: Violation Details Display
//   processViolations(analysis) {
//     return analysis.violations.map(violation => ({
//       id: Utils.generateId(),
//       type: violation.type,
//       severity: violation.severity,
//       description: violation.description,
//       recommendation: violation.recommendation,
//       affectedCookies: violation.affectedCookies
//     }));
//   }
// }

// // =====================================================
// // 6. BLOCKING MANAGER
// // =====================================================
// class BlockingManager {
//   // UC-08: Basic Cookie Blocking
//   async blockDomain(domain) {
//     try {
//       const blockedDomains = await StorageManager.get(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS) || [];

//       if (!blockedDomains.includes(domain)) {
//         blockedDomains.push(domain);
//         await StorageManager.set(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS, blockedDomains);
//       }

//       // Update declarativeNetRequest rules
//       await this.updateBlockingRules(blockedDomains);
//       return true;

//     } catch (error) {
//       Utils.log('Block domain error:', error);
//       return false;
//     }
//   }

//   async unblockDomain(domain) {
//     try {
//       const blockedDomains = await StorageManager.get(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS) || [];
//       const updated = blockedDomains.filter(d => d !== domain);

//       await StorageManager.set(CONFIG.STORAGE_KEYS.BLOCKED_DOMAINS, updated);
//       await this.updateBlockingRules(updated);
//       return true;

//     } catch (error) {
//       Utils.log('Unblock domain error:', error);
//       return false;
//     }
//   }

//   async updateBlockingRules(domains) {
//     const rules = domains.map((domain, index) => ({
//       id: index + 1,
//       priority: 1,
//       action: { type: 'block' },
//       condition: {
//         urlFilter: `*://*.${domain}/*`,
//         resourceTypes: ['main_frame', 'sub_frame']
//       }
//     }));

//     await chrome.declarativeNetRequest.updateDynamicRules({
//       removeRuleIds: rules.map(r => r.id),
//       addRules: rules
//     });
//   }
// }

// // =====================================================
// // 7. NOTIFICATION MANAGER
// // =====================================================
// class NotificationManager {
//   // UC-13: Advanced Notifications
//   async showNotification(type, data) {
//     const settings = await StorageManager.getSettings();
//     if (!settings.notifications) return;

//     const notifications = {
//       violation: {
//         title: 'Cookie Policy Violation Detected',
//         message: `Found ${data.count} violations on ${data.domain}`,
//         iconUrl: 'icons/warning.png'
//       },
//       scan_complete: {
//         title: 'Scan Complete',
//         message: `Analyzed ${data.cookieCount} cookies on ${data.domain}`,
//         iconUrl: 'icons/success.png'
//       }
//     };

//     const notification = notifications[type];
//     if (notification) {
//       await chrome.notifications.create({
//         type: 'basic',
//         ...notification
//       });
//     }
//   }
// }

// // =====================================================
// // 8. MAIN CONTROLLER
// // =====================================================
// class ExtensionController {
//   constructor() {
//     this.cookieManager = new CookieManager();
//     this.blockingManager = new BlockingManager();
//     this.policyAnalyzer = new PolicyAnalyzer();
//     this.notificationManager = new NotificationManager();

//     // Debounced scan function
//     this.debouncedScan = Utils.debounce(this.handleTabUpdate.bind(this), 1000);
//   }

//   // UC-01: Extension Installation & Setup
//   async handleInstallation() {
//     Utils.log('Extension installed');

//     // Set default settings
//     await StorageManager.set(CONFIG.STORAGE_KEYS.SETTINGS, CONFIG.DEFAULTS.SETTINGS);

//     // Open welcome page
//     await chrome.tabs.create({
//       url: chrome.runtime.getURL('welcome.html')
//     });
//   }

//   // UC-02: Auto scan on navigation
//   async handleTabUpdate(tabId, changeInfo, tab) {
//     if (changeInfo.status !== 'complete' || !tab.url?.startsWith('http')) return;

//     const settings = await StorageManager.getSettings();
//     if (!settings.autoScan) return;

//     await this.cookieManager.collectCookiesFromTab(tabId);
//   }

//   // UC-07: Manual Rescan Functionality
//   async handleManualScan(tabId) {
//     Utils.log('Manual scan triggered', { tabId });
//     await this.cookieManager.collectCookiesFromTab(tabId);
//   }

//   // Message handling for popup communication
//   async handleMessage(request, sender, sendResponse) {
//     try {
//       switch (request.action) {
//         case 'GET_COOKIES':
//           const cookies = await this.cookieManager.getCookiesForDomain(request.domain);
//           return { success: true, data: cookies };

//         case 'UPDATE_SETTINGS':
//           await StorageManager.updateSettings(request.settings);
//           return { success: true };

//         case 'BLOCK_DOMAIN':
//           const blocked = await this.blockingManager.blockDomain(request.domain);
//           return { success: blocked };

//         case 'CLEAR_COOKIES':
//           const cleared = await this.cookieManager.clearCookiesForDomain(request.domain);
//           return { success: cleared };

//         case 'MANUAL_SCAN':
//           await this.handleManualScan(request.tabId);
//           return { success: true };

//         default:
//           return { success: false, error: 'Unknown action' };
//       }
//     } catch (error) {
//       Utils.log('Message handling error:', error);
//       return { success: false, error: error.message };
//     }
//   }
// }

// // =====================================================
// // 9. EVENT LISTENERS & INITIALIZATION
// // =====================================================
// const controller = new ExtensionController();

// // Installation event
// chrome.runtime.onInstalled.addListener((details) => {
//   if (details.reason === 'install') {
//     controller.handleInstallation();
//   }
// });

// // Tab update events
// chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
//   controller.debouncedScan(tabId, changeInfo, tab);
// });

// // Message handling
// chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
//   controller.handleMessage(request, sender, sendResponse)
//     .then(response => sendResponse(response))
//     .catch(error => sendResponse({ success: false, error: error.message }));

//   return true; // Keep message channel open for async response
// });

// // Web request monitoring (for cookie collection)
// chrome.webRequest.onHeadersReceived.addListener(
//   (details) => {
//     // Process Set-Cookie headers if needed
//     const setCookieHeaders = details.responseHeaders?.filter(
//       header => header.name.toLowerCase() === 'set-cookie'
//     );

//     if (setCookieHeaders?.length > 0) {
//       Utils.log('Set-Cookie headers detected', {
//         url: details.url,
//         count: setCookieHeaders.length
//       });
//     }
//   },
//   { urls: ["<all_urls>"] },
//   ["responseHeaders"]
// );

// // Notification click handling
// chrome.notifications.onClicked.addListener((notificationId) => {
//   chrome.action.openPopup();
// });

// // =====================================================
// // 10. PERIODIC TASKS & CLEANUP
// // =====================================================
// // Periodic cleanup of old data
// chrome.alarms.create('cleanup', { periodInMinutes: 60 });

// chrome.alarms.onAlarm.addListener(async (alarm) => {
//   if (alarm.name === 'cleanup') {
//     Utils.log('Running periodic cleanup');

//     // Clean up old cookie data (older than 7 days)
//     const data = await StorageManager.get(CONFIG.STORAGE_KEYS.COOKIES) || {};
//     const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);

//     Object.keys(data).forEach(domain => {
//       if (data[domain].lastUpdated < sevenDaysAgo) {
//         delete data[domain];
//       }
//     });

//     await StorageManager.set(CONFIG.STORAGE_KEYS.COOKIES, data);
//   }
// });

// Utils.log('Cookie Extension Background Script Loaded');








async function loadCookieSpecs() {
  try {
    const response = await fetch('cookie_specs.json');
    if (!response.ok) {
      throw new Error('Failed to load cookie specifications');
    }
    return await response.json();
  } catch (error) {
    console.error('Error loading cookie specifications:', error);
    return null;
  }
}

// Function to get all cookies for the current domain
async function getAllCookies(domain) {
  return new Promise((resolve) => {
    chrome.cookies.getAll({ domain }, (cookies) => {
      resolve(cookies);
    });
  });
}

// Check if a cookie is declared as a session cookie
function isSessionCookie(cookieName, cookieSpecs) {
  // Check in specific declarations
  const specificCookie = cookieSpecs.specific.find(
    spec => spec.name === cookieName &&
    spec.attribute === "retention" &&
    spec.value.toLowerCase() === "session"
  );

  if (specificCookie) return true;

  // If not found in specific, check if it belongs to a general category
  // that's considered a session cookie
  for (const generalSpec of cookieSpecs.general) {
    // This is a simplification - in a real implementation, you would need
    // logic to determine if a cookie belongs to a category
    if (cookieName.includes(generalSpec.name) &&
        generalSpec.attribute === "retention" &&
        generalSpec.value.toLowerCase() === "session") {
      return true;
    }
  }

  return false;
}

// Check if a cookie persists longer than 24 hours
function persistsLongerThan24Hours(cookie) {
  // If it's a browser session cookie (expirationDate is not set),
  // it doesn't persist longer than 24 hours
  if (!cookie.expirationDate) {
    return false;
  }

  const expirationDate = new Date(cookie.expirationDate * 1000);
  const now = new Date();

  // Calculate the difference in hours
  const diffInHours = (expirationDate - now) / (1000 * 60 * 60);

  return diffInHours > 24;
}

// Main function to validate cookies
async function validateSessionCookies(domain) {
  const cookieSpecs = await loadCookieSpecs();
  if (!cookieSpecs) return [];

  const cookies = await getAllCookies(domain);
  const violations = [];

  for (const cookie of cookies) {
    if (isSessionCookie(cookie.name, cookieSpecs) &&
        persistsLongerThan24Hours(cookie)) {
      violations.push({
        name: cookie.name,
        domain: cookie.domain,
        expirationDate: new Date(cookie.expirationDate * 1000).toISOString(),
        message: "Cookie is declared as a 'session' cookie but persists longer than 24 hours"
      });
    }
  }

  return violations;
}

// Listen for messages from the popup
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "validate") {
    chrome.tabs.query({active: true, currentWindow: true}, async (tabs) => {
      if (tabs.length === 0) {
        sendResponse({error: "No active tab found"});
        return;
      }

      const url = new URL(tabs[0].url);
      const domain = url.hostname;

      try {
        const violations = await validateSessionCookies(domain);
        sendResponse({violations});
      } catch (error) {
        sendResponse({error: error.message});
      }
    });

    // Return true to indicate that we will send a response asynchronously
    return true;
  }
});

// Initialize: Load cookie specs on extension startup
chrome.runtime.onInstalled.addListener(() => {
  console.log("Cookie Session Validator Extension installed");
});
