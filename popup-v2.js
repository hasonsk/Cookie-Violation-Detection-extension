/**
 * Cookie Compliance Monitor
 * Main JavaScript file handling all interactive functionality
 */

document.addEventListener('DOMContentLoaded', function() {
  // Tải dữ liệu cookie cho tab hiện tại
  getCurrentTabId().then(tabId => {
    if (tabId) {
      loadCookieDataForTab(tabId);
    } else {
      showNoTabMessage();
    }
  });

  // Đăng ký sự kiện cho các nút
});

// Lấy ID của tab hiện tại
async function getCurrentTabId() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs.length > 0 ? tabs[0].id : null;
  } catch (error) {
    console.error("Error getting active tab:", error);
    return null;
  }
}

// Tải dữ liệu cookie từ storage cho tab cụ thể
function loadCookieDataForTab(tabId) {
  chrome.storage.local.get('cookiesByTab', function(data) {
    const cookieList = document.getElementById('cookie-list');
    const emptyMessage = document.getElementById('empty-message');
    const totalCookiesElement = document.getElementById('total-cookies');
    const firstPartyCookiesElement = document.getElementById('first-party-cookies');
    const thirdPartyCookiesElement = document.getElementById('third-party-cookies');
    const totalDomainsElement = document.getElementById('total-domains');

    // Kiểm tra xem có dữ liệu cho tab hiện tại không
    if (data.cookiesByTab && data.cookiesByTab[tabId] && data.cookiesByTab[tabId].length > 0) {
      const tabCookies = data.cookiesByTab[tabId];
      emptyMessage.style.display = 'none';
      cookieList.innerHTML = '';

      // Tính toán thống kê
      const uniqueDomains = new Set();
      let firstPartyCount = 0;
      let thirdPartyCount = 0;

      tabCookies.forEach(cookie => {
        uniqueDomains.add(cookie.domain);
        if (cookie.isThirdParty) {
          thirdPartyCount++;
        } else {
          firstPartyCount++;
        }
      });

      // Cập nhật số liệu thống kê
      totalCookiesElement.textContent = tabCookies.length;
      firstPartyCookiesElement.textContent = firstPartyCount;
      thirdPartyCookiesElement.textContent = thirdPartyCount;
      totalDomainsElement.textContent = uniqueDomains.size;

      // Lấy thông tin URL của tab hiện tại để hiển thị
      chrome.tabs.get(tabId, function(tab) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }

        document.getElementById('current-url').textContent = tab.url;
        document.getElementById('current-tab-info').style.display = 'block';

        // Tạo thống kê theo domain
        updateDomainStats(tabCookies);
      });

      // Sắp xếp theo thời gian giảm dần (mới nhất lên đầu)
      const sortedCookies = [...tabCookies].sort((a, b) => {
        return new Date(b.timestamp) - new Date(a.timestamp);
      });

      // Hiển thị dữ liệu cookie
      sortedCookies.forEach(cookie => {
        const row = document.createElement('tr');
        if (cookie.isThirdParty) {
          row.classList.add('third-party');
        }

        // Định dạng thời gian
        const cookieTime = new Date(cookie.timestamp);
        const timeString = `${cookieTime.getHours()}:${String(cookieTime.getMinutes()).padStart(2, '0')}:${String(cookieTime.getSeconds()).padStart(2, '0')}`;

        row.innerHTML = `
          <td title="${cookie.url}">${cookie.domain}</td>
          <td title="${cookie.cookieValue ? cookie.cookieValue.substring(0, 50) : ''}">${cookie.cookieName}</td>
          <td>${timeString}</td>
          <td>${cookie.httpOnly ? '✓' : '✗'}</td>
          <td>${cookie.secure ? '✓' : '✗'}</td>
          <td>${cookie.sameSite}</td>
          <td>${cookie.isThirdParty ? 'Third-party' : 'First-party'}</td>
        `;

        cookieList.appendChild(row);
      });
    } else {
      // emptyMessage.style.display = 'block';
      // emptyMessage.textContent = "Chưa phát hiện cookie nào trên trang web hiện tại.";
      // cookieList.innerHTML = '';
      // totalCookiesElement.textContent = '0';
      // firstPartyCookiesElement.textContent = '0';
      // thirdPartyCookiesElement.textContent = '0';
      // totalDomainsElement.textContent = '0';

      // Vẫn hiển thị thông tin URL của trang hiện tại
      chrome.tabs.get(tabId, function(tab) {
        if (chrome.runtime.lastError) {
          console.error(chrome.runtime.lastError);
          return;
        }

        document.getElementById('current-url').textContent = tab.url;
        document.getElementById('current-tab-info').style.display = 'block';
      });
    }
  });
}


document.addEventListener('DOMContentLoaded', function() {
  // Initialize Lucide icons if the library is available
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ===== NAVIGATION =====
  initializeNavigation();

  // ===== COOKIE MANAGEMENT =====
  initializeCookieMonitor();

  // ===== RULES MANAGEMENT =====
  initializeRulesManager();

  // ===== SETTINGS =====
  initializeSettings();

  // ===== DASHBOARD =====
  initializeDashboard();

  // Load initial mock data
  loadMockData();
});

// ===== NAVIGATION FUNCTIONALITY =====
function initializeNavigation() {
  const screens = {
    'dashboard': document.getElementById('dashboard-screen'),
    'cookies': document.getElementById('cookies-screen'),
    'rules': document.getElementById('rules-screen'),
    'settings': document.getElementById('settings-screen'),
  };

  const navButtons = {
    'dashboard': document.getElementById('nav-dashboard'),
    'cookies': document.getElementById('nav-cookies'),
    'rules': document.getElementById('nav-rules'),
    'settings': document.getElementById('nav-settings'),
  };

  function showScreen(screenName) {
    // Hide all screens
    Object.values(screens).forEach(screen => {
      if (screen) screen.style.display = 'none';
    });

    // Show the selected screen
    const targetScreen = screens[screenName];
    if (targetScreen) targetScreen.style.display = 'block';

    // Update nav buttons
    Object.entries(navButtons).forEach(([name, button]) => {
      if (button) {
        if (name === screenName) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      }
    });

    // Special actions for specific screens
    if (screenName === 'dashboard') {
      updateDashboardStats();
    } else if (screenName === 'cookies') {
      applyFilter('all'); // Default view shows all cookies
    }
  }

  // Add click handlers to nav buttons
  if (navButtons.dashboard) navButtons.dashboard.addEventListener('click', () => showScreen('dashboard'));
  if (navButtons.cookies) navButtons.cookies.addEventListener('click', () => showScreen('cookies'));
  if (navButtons.rules) navButtons.rules.addEventListener('click', () => showScreen('rules'));
  if (navButtons.settings) navButtons.settings.addEventListener('click', () => showScreen('settings'));

  // Header settings button also goes to settings screen
  const headerSettings = document.getElementById('header-settings');
  if (headerSettings) {
    headerSettings.addEventListener('click', () => {
      showScreen('settings');
    });
  }

  // View all violations button on dashboard
  const viewAllViolationsButton = document.querySelector('.panel-footer button');
  if (viewAllViolationsButton) {
    viewAllViolationsButton.addEventListener('click', () => {
      showScreen('cookies');
      applyFilter('violations');
      // Find and activate the violations filter button
      const violationsFilterButton = document.querySelector('.filter-button[data-filter="violations"]');
      if (violationsFilterButton) {
        document.querySelectorAll('.filter-button').forEach(btn => {
          btn.classList.remove('active');
        });
        violationsFilterButton.classList.add('active');
      }
    });
  }
}

// ===== COOKIE MONITOR FUNCTIONALITY =====
function initializeCookieMonitor() {
  // Toggle cookie details when clicking on cookie items
  document.querySelectorAll('.cookie-item').forEach(item => {
    item.addEventListener('click', function() {
      const id = this.getAttribute('data-id');
      const details = document.getElementById(`${id}-details`);
      const chevron = this.querySelector('.chevron');

      if (details) {
        if (details.style.display === 'block') {
          details.style.display = 'none';
          if (chevron) chevron.classList.remove('expanded');
        } else {
          details.style.display = 'block';
          if (chevron) chevron.classList.add('expanded');
        }
      }
    });
  });

  // Filter cookie list
  document.querySelectorAll('.filters .filter-button').forEach(button => {
    button.addEventListener('click', function() {
      const filter = this.getAttribute('data-filter');
      if (filter) {
        // Update active state of filter buttons
        this.parentNode.querySelectorAll('.filter-button').forEach(btn => {
          btn.classList.remove('active');
        });
        this.classList.add('active');

        // Apply the filter to the cookie list
        applyFilter(filter);
      }
    });
  });

  // Search functionality for cookies
  const searchInput = document.querySelector('#cookies-screen .search-box input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      filterCookiesBySearch(searchTerm);
    });
  }
}

// Apply filter to cookie list
function applyFilter(filterType) {
  const cookieItems = document.querySelectorAll('.cookie-item');

  cookieItems.forEach(item => {
    const parentDiv = item.parentNode;

    // Reset display for all items first
    if (parentDiv) parentDiv.style.display = 'block';

    switch (filterType) {
      case 'all':
        // Show all cookies
        break;

      case 'violations':
        // Show only cookies with violations
        if (!item.classList.contains('violation')) {
          if (parentDiv) parentDiv.style.display = 'none';
        }
        break;

      case 'no-issues':
        // Show only cookies without violations
        if (item.classList.contains('violation')) {
          if (parentDiv) parentDiv.style.display = 'none';
        }
        break;

      case 'performance':
        // Show only performance cookies
        const isPerformance = item.querySelector('.subtitle')?.textContent.toLowerCase().includes('performance');
        if (!isPerformance) {
          if (parentDiv) parentDiv.style.display = 'none';
        }
        break;

      case 'tracking':
        // Show only tracking cookies
        const isTracking = item.querySelector('.content')?.textContent.toLowerCase().includes('track');
        if (!isTracking) {
          if (parentDiv) parentDiv.style.display = 'none';
        }
        break;
    }
  });
}

// Filter cookies by search term
function filterCookiesBySearch(searchTerm) {
  const cookieItems = document.querySelectorAll('.cookie-item');

  cookieItems.forEach(item => {
    const parentDiv = item.parentNode;
    const content = item.querySelector('.content')?.textContent.toLowerCase() || '';

    if (content.includes(searchTerm)) {
      if (parentDiv) parentDiv.style.display = 'block';
    } else {
      if (parentDiv) parentDiv.style.display = 'none';
    }
  });
}

// ===== RULES MANAGER FUNCTIONALITY =====
function initializeRulesManager() {
  // Filter rule list
  document.querySelectorAll('#rules-screen .filters .filter-button').forEach(button => {
    button.addEventListener('click', function() {
      // Update active state of rule filter buttons
      this.parentNode.querySelectorAll('.filter-button').forEach(btn => {
        btn.classList.remove('active');
      });
      this.classList.add('active');

      // Get filter type from button text or data attribute
      const filterType = this.textContent.trim().toLowerCase();
      filterRules(filterType);
    });
  });

  // Add toggle functionality for rule switches
  document.querySelectorAll('.toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', function(event) {
      event.stopPropagation(); // Prevent triggering the parent item click event

      // Toggle the switch state
      this.classList.toggle('on');
      this.classList.toggle('off');

      // Update related UI elements
      const ruleItem = this.closest('.cookie-item');
      if (ruleItem) {
        const detailsId = ruleItem.getAttribute('data-id');
        const detailsDiv = document.getElementById(`${detailsId}-details`);

        if (detailsDiv) {
          const statusDiv = detailsDiv.querySelector('.detail-label + div');
          const actionButton = detailsDiv.querySelector('.disable-button');

          if (this.classList.contains('on')) {
            if (statusDiv) statusDiv.textContent = 'Active';
            if (actionButton) {
              actionButton.textContent = 'Disable';
              actionButton.classList.remove('secondary-button');
            }
          } else {
            if (statusDiv) statusDiv.textContent = 'Inactive';
            if (actionButton) {
              actionButton.textContent = 'Enable';
              actionButton.classList.add('secondary-button');
            }
          }
        }
      }
    });
  });

  // Rule action buttons
  document.querySelectorAll('.edit-button, .disable-button').forEach(button => {
    button.addEventListener('click', function(event) {
      event.stopPropagation(); // Prevent triggering parent click events

      const actionType = this.classList.contains('edit-button') ? 'edit' : 'toggle';
      const ruleDetails = this.closest('.rule-details');
      const ruleId = ruleDetails?.id.replace('-details', '');

      if (actionType === 'edit') {
        showRuleEditor(ruleId);
      } else {
        // Toggle rule status
        const ruleItem = document.querySelector(`.cookie-item[data-id="${ruleId}"]`);
        const toggleSwitch = ruleItem?.querySelector('.toggle-switch');

        if (toggleSwitch) {
          // Simulate a click on the toggle switch
          const clickEvent = new MouseEvent('click', {
            bubbles: true,
            cancelable: true,
            view: window
          });
          toggleSwitch.dispatchEvent(clickEvent);

          // Update button text
          if (this.textContent === 'Disable') {
            this.textContent = 'Enable';
          } else {
            this.textContent = 'Disable';
          }
        }
      }
    });
  });

  // Add Rule button
  const addRuleButton = document.querySelector('.add-button');
  if (addRuleButton) {
    addRuleButton.addEventListener('click', () => {
      showRuleEditor('new');
    });
  }
}

// Filter rules by type
function filterRules(filterType) {
  const ruleItems = document.querySelectorAll('#rules-screen .cookie-item');

  ruleItems.forEach(item => {
    const parentDiv = item.parentNode;
    const tagElement = item.querySelector('.rule-tag');
    const tagType = tagElement?.textContent.toLowerCase() || '';

    if (filterType === 'all' || tagType === filterType) {
      if (parentDiv) parentDiv.style.display = 'block';
    } else {
      if (parentDiv) parentDiv.style.display = 'none';
    }
  });
}

// Show rule editor (mock implementation)
function showRuleEditor(ruleId) {
  alert(`Rule editor would open for rule ID: ${ruleId}`);
  // In a real implementation, this would open a modal with a form to edit the rule
}

// ===== SETTINGS FUNCTIONALITY =====
function initializeSettings() {
  // Toggle switches in settings
  document.querySelectorAll('#settings-screen .toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', function() {
      this.classList.toggle('on');
      this.classList.toggle('off');
    });
  });

  // Import/Export buttons
  document.querySelector('#settings-screen .primary-button')?.addEventListener('click', function() {
    alert('Import Rules functionality would open a file picker dialog');
  });

  document.querySelector('#settings-screen .secondary-button')?.addEventListener('click', function() {
    alert('Export Results functionality would save the current data');
  });

  // Clear all data button
  document.querySelector('#settings-screen .danger-button')?.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      alert('All data has been cleared');
      // In a real implementation, this would clear the stored data
    }
  });

  // Settings dropdowns
  document.querySelectorAll('#settings-screen select').forEach(select => {
    select.addEventListener('change', function() {
      console.log(`Setting changed: ${select.previousElementSibling?.textContent} to ${select.value}`);
    });
  });

  // Policy JSON textarea
  const policyTextarea = document.querySelector('#settings-screen textarea');
  if (policyTextarea) {
    policyTextarea.addEventListener('input', function() {
      console.log('Policy JSON updated');
      // In a real implementation, this would validate the JSON
    });
  }
}

// ===== DASHBOARD FUNCTIONALITY =====
function initializeDashboard() {
  // Nothing specific to initialize for dashboard for now
  // The dashboard is static and just displays data
}

// Update dashboard statistics
function updateDashboardStats() {
  // In a real implementation, this would fetch current statistics
  // For now, we'll just update the DOM with mock data
  const cookiesMonitored = document.querySelector('.summary-cards .card:nth-child(1) .value');
  const violationsDetected = document.querySelector('.summary-cards .card:nth-child(2) .value');
  const websitesScanned = document.querySelector('.summary-cards .card:nth-child(3) .value');
  const rulesActive = document.querySelector('.summary-cards .card:nth-child(4) .value');

  if (cookiesMonitored) cookiesMonitored.textContent = '132';
  if (violationsDetected) violationsDetected.textContent = '17';
  if (websitesScanned) websitesScanned.textContent = '24';
  if (rulesActive) rulesActive.textContent = '14';
}

// ===== MOCK DATA FUNCTIONALITY =====
function loadMockData() {
  // Mock data is already in the HTML
  // In a real implementation, this would load data from storage or API
}

// ===== RULE CHECK IMPLEMENTATION =====
/**
 * Implementation of cookie compliance rule checking based on the specifications
 * Each rule has a specific verification method described in the paste-2.txt file
 */
class CookieRule {
  constructor(id, level, attribute, description, checkMethod) {
    this.id = id;
    this.level = level;
    this.attribute = attribute;
    this.description = description;
    this.checkMethod = checkMethod;
    this.isActive = true;
  }

  // Check a cookie against this rule
  checkCookie(cookie, policy) {
    switch (this.id) {
      case 1: // Session cookie persists > 24h
        return this.checkSessionRetention(cookie, policy);
      case 2: // Expiration exceeds declared duration by > 30%
        return this.checkExpirationOverage(cookie, policy);
      case 3: // Short-term retention but long expiration
        return this.checkRetentionMismatch(cookie, policy);
      case 4: // Third-party domain not listed
        return this.checkThirdPartyDomain(cookie, policy);
      // Add more rule checks as needed...
      default:
        return false;
    }
  }

  // Rule 1: Session cookie persistence
  checkSessionRetention(cookie, policy) {
    if (!cookie || !policy) return false;

    const declaredRetention = policy.retention;
    if (declaredRetention === 'session') {
      const expires = cookie.expires;
      // Check if cookie expiration is more than 24 hours
      if (expires) {
        const expiryDate = new Date(expires);
        const now = new Date();
        const diffHours = (expiryDate - now) / (1000 * 60 * 60);
        return diffHours > 24;
      }
    }
    return false;
  }

  // Rule 2: Expiration exceeds declared duration
  checkExpirationOverage(cookie, policy) {
    if (!cookie || !policy) return false;

    const declaredRetention = policy.retention;
    if (declaredRetention && declaredRetention !== 'session') {
      // Parse the declared retention (e.g., "13 months")
      const [value, unit] = declaredRetention.split(' ');
      let declaredDays = 0;

      switch (unit) {
        case 'days':
          declaredDays = parseInt(value);
          break;
        case 'months':
          declaredDays = parseInt(value) * 30; // Approximate
          break;
        case 'years':
          declaredDays = parseInt(value) * 365; // Approximate
          break;
      }

      // Get actual expiration in days
      const expires = cookie.expires;
      if (expires) {
        const expiryDate = new Date(expires);
        const now = new Date();
        const actualDays = (expiryDate - now) / (1000 * 60 * 60 * 24);

        // Check if actual exceeds declared by > 30%
        return actualDays > (declaredDays * 1.3);
      }
    }
    return false;
  }

  // Rule 3: Short-term policy but long-term cookie
  checkRetentionMismatch(cookie, policy) {
    if (!cookie || !policy) return false;

    const declaredRetention = policy.retention;
    if (declaredRetention) {
      // Parse the declared retention (e.g., "30 days")
      const match = declaredRetention.match(/(\d+)\s+(day|days)/);
      if (match && parseInt(match[1]) <= 30) {
        // Policy states short-term retention (30 days or less)
        const expires = cookie.expires;
        if (expires) {
          const expiryDate = new Date(expires);
          const now = new Date();
          const actualDays = (expiryDate - now) / (1000 * 60 * 60 * 24);

          // Check if expiration is more than a year
          return actualDays > 365;
        }
      }
    }
    return false;
  }

  // Rule 4: Third-party domain not listed
  checkThirdPartyDomain(cookie, policy) {
    if (!cookie || !policy) return false;

    const declaredThirdParties = policy.third_party;
    if (declaredThirdParties) {
      // Get the cookie domain
      const domain = cookie.domain;
      if (domain) {
        // Check if the domain is third-party and not in the declared list
        const isThirdParty = !domain.includes(window.location.hostname);
        if (isThirdParty) {
          // Check if this domain is listed in declared third parties
          const thirdPartyList = Array.isArray(declaredThirdParties)
            ? declaredThirdParties
            : [declaredThirdParties];

          return !thirdPartyList.some(tp =>
            domain.includes(tp.toLowerCase()) ||
            tp.toLowerCase().includes(extractDomainName(domain))
          );
        }
      }
    }
    return false;
  }
}

// Helper function to extract domain name
function extractDomainName(domain) {
  return domain.replace(/^(?:https?:\/\/)?(?:www\.)?/i, "").split('/')[0];
}

// Create instances of all rules from paste-2.txt
const rules = [
  new CookieRule(1, "Specific", "Retention", "Cookie is declared as a \"session\" cookie but persists longer than 24 hours after browser close.", "Compare retention value in JSON with website cookie expires field using timestamp subtraction."),
  new CookieRule(2, "Specific", "Retention", "Actual expiration exceeds declared duration by more than 30%.", "Compare retention value in JSON with website cookie expires field by calculating percentage difference."),
  new CookieRule(3, "Specific", "Retention", "Policy states short-term retention (e.g., \"30 days\"), but observed cookie is set to expire after 1 year.", "Compare retention value in JSON with website cookie expiration using date parsing."),
  new CookieRule(4, "Specific", "Third-party", "Cookie is sent to a third-party domain not listed in the third_party attribute.", "Match third_party value in JSON with domain in website cookie request headers."),
  new CookieRule(5, "Specific", "Third-party", "Policy claims data is only collected by the site owner, but cookie is sent to external tracker.", "Compare third_party value in JSON with website cookie destination."),
  new CookieRule(6, "Specific", "Purpose", "Cookie is declared as \"strictly necessary\" but used for advertising or cross-site tracking.", "Compare purpose value in JSON with website cookie behavior using content analysis."),
  new CookieRule(7, "Specific", "Behavior", "Cookie performs cross-site tracking, session replay, or persistent identification without being described in the policy.", "Analyze website cookie traffic and compare with behavior in JSON."),
  new CookieRule(8, "General", "Purpose", "Observed cookie name shows no semantic similarity with any general-purpose label declared in the policy.", "Vectorize name from website and compare with purpose labels in JSON using cosine similarity."),
  new CookieRule(9, "General", "Third-party", "Policy vaguely mentions \"third-party sharing\" but cookies are sent to known advertising trackers without clarification.", "Compare third_party in JSON with website cookie destinations."),
  new CookieRule(10, "General", "Retention", "Policy states \"cookies may be stored for a reasonable time\" but observed expiration exceeds 1 year.", "Compare retention in JSON with website cookie expiration using date comparison."),
  new CookieRule(11, "Undefined", "Purpose", "No declared purpose in policy, yet the cookie collects or transmits user data across sessions or domains.", "Check website cookie data against purpose in JSON using content analysis."),
  new CookieRule(12, "Undefined", "Behavior", "Cookie is silently deployed without user consent and with no mention in the policy.", "Monitor website cookie deployment and compare with behavior in JSON."),
  new CookieRule(13, "Undefined", "Third-party", "Cookie belongs to an external domain, and the policy contains no information about third-party involvement.", "Compare website cookie domain with third_party in JSON using request header analysis."),
  new CookieRule(14, "Undefined", "Retention", "Policy omits any reference to retention duration, but cookies persist for extended periods.", "Compare website cookie expiration with retention in JSON using timestamp analysis.")
];

// Function to check a cookie against all rules
function checkCookieCompliance(cookie, policy) {
  const violations = [];

  rules.forEach(rule => {
    if (rule.isActive && rule.checkCookie(cookie, policy)) {
      violations.push({
        ruleId: rule.id,
        description: rule.description,
        level: rule.level,
        attribute: rule.attribute
      });
    }
  });

  return violations;
}
