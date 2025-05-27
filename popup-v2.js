document.addEventListener('DOMContentLoaded', function() {
  // Initialize Lucide icons if the library is available
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ===== NAVIGATION =====
  initializeNavigation();

  // ===== DASHBOARD =====
  initializeDashboard();
  updateDashboardStats();

  // ===== COOKIE MANAGEMENT =====
  initializeCookieMonitor();

  // ===== SETTINGS =====
  initializeSettings();

  // ===== DOMAIN BLOCKING =====
  initializeDomainBlocking();

  // Load current tab data
  getCurrentTabId().then(tabId => {
    if (tabId) {
      loadCookieDataForTab(tabId);
      loadBlockedDomains();
      updateCurrentTabInfo(tabId);
    } else {
      showNoTabMessage();
    }
  });

  // Event listeners for actions
  document.getElementById('add-block-domain')?.addEventListener('click', addBlockedDomain);
});

// ===== TAB MANAGEMENT =====
async function getCurrentTabId() {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    return tabs.length > 0 ? tabs[0].id : null;
  } catch (error) {
    console.error("Error getting active tab:", error);
    return null;
  }
}

async function updateCurrentTabInfo(tabId) {
  try {
    const tab = await chrome.tabs.get(tabId);
    const currentUrlElement = document.getElementById('current-url');
    const currentTabInfoElement = document.getElementById('current-tab-info');

    if (currentUrlElement && tab) {
      currentUrlElement.textContent = tab.url;
      if (currentTabInfoElement) {
        currentTabInfoElement.style.display = 'block';
      }
    }
  } catch (error) {
    console.error("Error getting tab info:", error);
  }
}

function showNoTabMessage() {
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

// ===== COOKIE DATA MANAGEMENT =====
function loadCookieDataForTab(tabId) {
  chrome.storage.local.get('cookiesByTab', function(data) {
    const cookiesMonitored = document.querySelector('.summary-cards .card:nth-child(1) .value');
    const violationsDetected = document.querySelector('.summary-cards .card:nth-child(2) .value');
    const thirdPartyElement = document.querySelector('.summary-cards .card:nth-child(3) .value');
    const firstPartyElement = document.querySelector('.summary-cards .card:nth-child(4) .value');

    // Initialize stats
    let totalCookies = 0;
    let firstPartyCount = 0;
    let thirdPartyCount = 0;
    let violationsCount = 0;

    if (data.cookiesByTab && data.cookiesByTab[tabId] && data.cookiesByTab[tabId].length > 0) {
      const tabCookies = data.cookiesByTab[tabId];

      // Calculate statistics
      const uniqueDomains = new Set();

      tabCookies.forEach(cookie => {
        totalCookies++;
        uniqueDomains.add(cookie.domain);

        if (cookie.isThirdParty) {
          thirdPartyCount++;
        } else {
          firstPartyCount++;
        }

        // Check for violations (simplified)
        if (checkCookieViolations(cookie)) {
          violationsCount++;
        }
      });

      // Update dashboard stats
      if (cookiesMonitored) cookiesMonitored.textContent = totalCookies;
      if (violationsDetected) violationsDetected.textContent = violationsCount;
      if (thirdPartyElement) thirdPartyElement.textContent = thirdPartyCount;
      if (firstPartyElement) firstPartyElement.textContent = firstPartyCount;

      // Update domain stats
      updateDomainStats(tabCookies);

      // Update cookie list display
      updateCookieListDisplay(tabCookies);

    } else {
      // No cookies found
      if (cookiesMonitored) cookiesMonitored.textContent = '0';
      if (violationsDetected) violationsDetected.textContent = '0';
      if (thirdPartyElement) thirdPartyElement.textContent = '0';
      if (firstPartyElement) firstPartyElement.textContent = '0';
    }
  });
}

function updateCookieListDisplay(cookies) {
  // Clear existing cookie items
  const cookiePanel = document.querySelector('#cookies-screen .panel');
  if (!cookiePanel) return;

  // Keep only the first child (if it exists) and remove the rest
  const children = Array.from(cookiePanel.children);
  children.slice(1).forEach(child => child.remove());

  // Sort cookies by timestamp (newest first)
  const sortedCookies = [...cookies].sort((a, b) => {
    return new Date(b.timestamp) - new Date(a.timestamp);
  });

  // Create cookie items
  sortedCookies.forEach((cookie, index) => {
    const cookieId = `cookie-${index}`;
    const hasViolation = checkCookieViolations(cookie);

    const cookieDiv = document.createElement('div');
    cookieDiv.className = 'list-divider';
    cookieDiv.innerHTML = `
      <div class="cookie-item ${hasViolation ? 'violation' : ''}" data-id="${cookieId}">
        <div class="icon">
          <i data-lucide="${hasViolation ? 'alert-triangle' : 'check-circle'}" size="16" class="${hasViolation ? 'text-red-600' : 'green'}"></i>
        </div>
        <div class="content">
          <div class="title">${cookie.cookieName}</div>
          <div class="subtitle">
            ${cookie.domain} · ${formatCookieExpiry(cookie.expires)} ${hasViolation ? '(Violation detected)' : ''}
          </div>
        </div>
        <i data-lucide="chevron-right" size="16" class="chevron"></i>
      </div>
      <div class="cookie-details" id="${cookieId}-details">
        <div class="details-grid">
          <div>
            <div class="detail-label">Domain</div>
            <div>${cookie.domain}</div>
          </div>
          <div>
            <div class="detail-label">Path</div>
            <div>${cookie.path || '/'}</div>
          </div>
          <div>
            <div class="detail-label">Type</div>
            <div>${cookie.isThirdParty ? 'Third-party' : 'First-party'}</div>
          </div>
          <div>
            <div class="detail-label">Security</div>
            <div>${cookie.secure ? 'Secure' : 'Not Secure'} ${cookie.httpOnly ? '| HttpOnly' : ''}</div>
          </div>
          <div>
            <div class="detail-label">SameSite</div>
            <div>${cookie.sameSite || 'None'}</div>
          </div>
          <div>
            <div class="detail-label">Created</div>
            <div>${formatTimestamp(cookie.timestamp)}</div>
          </div>
        </div>
        ${hasViolation ? `
          <div class="violation-alert">
            <div class="title">Violations:</div>
            <ul class="violation-list">
              ${getViolationMessages(cookie).map(msg => `<li>${msg}</li>`).join('')}
            </ul>
          </div>
        ` : ''}
      </div>
    `;

    cookiePanel.appendChild(cookieDiv);
  });

  // Re-initialize icons for new elements
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Re-attach click handlers for new cookie items
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
}

// ===== DOMAIN STATISTICS =====
function updateDomainStats(cookies) {
  const domainCounts = {};

  // Count cookies from each domain
  cookies.forEach(cookie => {
    const domain = cookie.domain;
    if (!domainCounts[domain]) {
      domainCounts[domain] = {
        total: 0,
        firstParty: 0,
        thirdParty: 0
      };
    }

    domainCounts[domain].total++;
    if (cookie.isThirdParty) {
      domainCounts[domain].thirdParty++;
    } else {
      domainCounts[domain].firstParty++;
    }
  });

  // Convert to array and sort by total count
  const domainArray = Object.entries(domainCounts)
    .map(([domain, counts]) => ({ domain, ...counts }))
    .sort((a, b) => b.total - a.total);

  // Update top domains list
  const topDomainsList = document.getElementById('top-domains');
  if (topDomainsList) {
    topDomainsList.innerHTML = '';

    const topDomains = domainArray.slice(0, 10);
    topDomains.forEach(item => {
      const li = document.createElement('li');
      li.innerHTML = `<strong>${item.domain}</strong>: ${item.total} cookies (${item.firstParty} first-party, ${item.thirdParty} third-party)`;
      topDomainsList.appendChild(li);
    });
  }
}

// ===== DOMAIN BLOCKING =====
function initializeDomainBlocking() {
  const addBlockButton = document.getElementById('add-block-domain');
  if (addBlockButton) {
    addBlockButton.addEventListener('click', addBlockedDomain);
  }
}

function loadBlockedDomains() {
  chrome.storage.local.get('blockedDomains', function(data) {
    const blockedList = document.getElementById('blocked-domains-list');
    if (!blockedList) return;

    blockedList.innerHTML = '';

    if (data.blockedDomains && data.blockedDomains.length > 0) {
      data.blockedDomains.forEach(domain => {
        const li = document.createElement('li');
        li.innerHTML = `
          ${domain}
          <button class="remove-domain" data-domain="${domain}" style="background-color: #f44336; margin-left: 10px; padding: 2px 5px; color: white; border: none; border-radius: 3px; cursor: pointer;">Xóa</button>
        `;
        blockedList.appendChild(li);
      });

      // Add event listeners for remove buttons
      document.querySelectorAll('.remove-domain').forEach(button => {
        button.addEventListener('click', function() {
          removeBlockedDomain(this.getAttribute('data-domain'));
        });
      });
    } else {
      blockedList.innerHTML = '<li>Không có domain nào bị chặn</li>';
    }
  });
}

function addBlockedDomain() {
  const domainInput = document.getElementById('domain-to-block');
  if (!domainInput) return;

  const domain = domainInput.value.trim();

  if (!domain) {
    alert('Vui lòng nhập domain hợp lệ');
    return;
  }

  chrome.storage.local.get('blockedDomains', function(data) {
    const blockedDomains = data.blockedDomains || [];

    // Check if domain already exists
    if (blockedDomains.includes(domain)) {
      alert('Domain này đã có trong danh sách chặn');
      return;
    }

    // Add domain to list
    blockedDomains.push(domain);

    // Save to storage and update UI
    chrome.storage.local.set({ 'blockedDomains': blockedDomains }, function() {
      // Send message to update blocking rules
      chrome.runtime.sendMessage(
        { action: "updateBlockedDomains", domains: blockedDomains },
        function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error updating blocking rules:', chrome.runtime.lastError);
          } else {
            domainInput.value = ''; // Clear input
            loadBlockedDomains(); // Reload list
          }
        }
      );
    });
  });
}

function removeBlockedDomain(domain) {
  chrome.storage.local.get('blockedDomains', function(data) {
    if (!data.blockedDomains) return;

    // Remove domain from list
    const updatedList = data.blockedDomains.filter(d => d !== domain);

    // Save to storage and update UI
    chrome.storage.local.set({ 'blockedDomains': updatedList }, function() {
      // Send message to update blocking rules
      chrome.runtime.sendMessage(
        { action: "updateBlockedDomains", domains: updatedList },
        function(response) {
          if (chrome.runtime.lastError) {
            console.error('Error updating blocking rules:', chrome.runtime.lastError);
          } else {
            loadBlockedDomains(); // Reload list
          }
        }
      );
    });
  });
}

// ===== DATA EXPORT =====
async function exportToCsv() {
  const tabId = await getCurrentTabId();
  if (!tabId) return;

  chrome.storage.local.get('cookiesByTab', function(data) {
    if (!data.cookiesByTab || !data.cookiesByTab[tabId] || data.cookiesByTab[tabId].length === 0) {
      alert('Không có dữ liệu để xuất');
      return;
    }

    const tabCookies = data.cookiesByTab[tabId];

    // Create CSV header
    let csvContent = 'Domain,Cookie Name,Value,Expires,Path,HttpOnly,Secure,SameSite,Type,Timestamp,URL\n';

    // Add data rows
    tabCookies.forEach(cookie => {
      const row = [
        cookie.domain,
        cookie.cookieName,
        cookie.cookieValue,
        cookie.expires,
        cookie.path,
        cookie.httpOnly,
        cookie.secure,
        cookie.sameSite,
        cookie.isThirdParty ? 'Third-party' : 'First-party',
        cookie.timestamp,
        cookie.url || ''
      ].map(item => `"${String(item || '').replace(/"/g, '""')}"`).join(',');

      csvContent += row + '\n';
    });

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    chrome.tabs.get(tabId, function(tab) {
      const domain = new URL(tab.url).hostname;

      link.setAttribute('href', url);
      link.setAttribute('download', `cookie_report_${domain}_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });
}

async function clearCookieData() {
  const tabId = await getCurrentTabId();
  if (!tabId) return;

  chrome.storage.local.get('cookiesByTab', function(data) {
    if (data.cookiesByTab) {
      // Only clear cookies for current tab
      delete data.cookiesByTab[tabId];
      chrome.storage.local.set({ 'cookiesByTab': data.cookiesByTab }, function() {
        chrome.action.setBadgeText({ text: '' });
        loadCookieDataForTab(tabId);
      });
    }
  });
}

// ===== NAVIGATION FUNCTIONALITY =====
function initializeNavigation() {
  const screens = {
    'dashboard': document.getElementById('dashboard-screen'),
    'cookies': document.getElementById('cookies-screen'),
    'domains': document.getElementById('domain-screen'),
    'settings': document.getElementById('settings-screen'),
  };

  const navButtons = {
    'dashboard': document.getElementById('nav-dashboard'),
    'cookies': document.getElementById('nav-cookies'),
    'domains': document.getElementById('nav-domains'),
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
      applyFilter('all');
    } else if (screenName === 'domains') {
      loadBlockedDomains();
    }
  }

  // Add click handlers to nav buttons
  if (navButtons.dashboard) navButtons.dashboard.addEventListener('click', () => showScreen('dashboard'));
  if (navButtons.cookies) navButtons.cookies.addEventListener('click', () => showScreen('cookies'));
  if (navButtons.domains) navButtons.domains.addEventListener('click', () => showScreen('domains'));
  if (navButtons.settings) navButtons.settings.addEventListener('click', () => showScreen('settings'));

  // Header settings button
  const headerSettings = document.getElementById('header-settings');
  if (headerSettings) {
    headerSettings.addEventListener('click', () => showScreen('settings'));
  }

  // View all violations button on dashboard
  const viewAllViolationsButton = document.querySelector('.panel-footer button');
  if (viewAllViolationsButton) {
    viewAllViolationsButton.addEventListener('click', () => {
      showScreen('cookies');
      applyFilter('violations');
      const violationsFilterButton = document.querySelector('.filter-button[data-filter="violations"]');
      if (violationsFilterButton) {
        document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
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

// ===== SETTINGS FUNCTIONALITY =====
function initializeSettings() {
  // Toggle switches in settings
  document.querySelectorAll('#settings-screen .toggle-switch').forEach(toggle => {
    toggle.addEventListener('click', function() {
      this.classList.toggle('on');
      this.classList.toggle('off');
    });
  });

  // Clear all data button
  document.querySelector('#settings-screen .danger-button')?.addEventListener('click', function() {
    if (confirm('Are you sure you want to clear all data? This action cannot be undone.')) {
      chrome.storage.local.clear(function() {
        alert('All data has been cleared');
        // Refresh the popup
        location.reload();
      });
    }
  });

  // Settings dropdowns
  document.querySelectorAll('#settings-screen select').forEach(select => {
    select.addEventListener('change', function() {
      console.log(`Setting changed: ${select.previousElementSibling?.textContent} to ${select.value}`);
    });
  });
}

// ===== DASHBOARD FUNCTIONALITY =====
function initializeDashboard() {
  // Dashboard initialization
}

function updateDashboardStats() {
  // Get current tab and update stats
  getCurrentTabId().then(tabId => {
    if (tabId) {
      loadCookieDataForTab(tabId);
    }
  });
}

// ===== UTILITY FUNCTIONS =====
function formatTimestamp(timestamp) {
  const date = new Date(timestamp);
  return `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}:${date.getSeconds().toString().padStart(2, '0')}`;
}

function formatCookieExpiry(expires) {
  if (!expires) return 'Session';

  const expiryDate = new Date(expires);
  const now = new Date();
  const diffDays = Math.ceil((expiryDate - now) / (1000 * 60 * 60 * 24));

  if (diffDays <= 0) return 'Expired';
  if (diffDays === 1) return '1 day';
  if (diffDays < 30) return `${diffDays} days`;
  if (diffDays < 365) return `${Math.ceil(diffDays / 30)} months`;
  return `${Math.ceil(diffDays / 365)} years`;
}

function checkCookieViolations(cookie) {
  // Simple violation checks
  const violations = [];

  // Check for session cookies that persist too long
  if (!cookie.expires) {
    // Session cookie - check if it has suspicious characteristics
    if (cookie.cookieName.includes('_ga') || cookie.cookieName.includes('_gid')) {
      violations.push('Analytics cookie without proper expiration');
    }
  } else {
    const expiryDate = new Date(cookie.expires);
    const now = new Date();
    const diffYears = (expiryDate - now) / (1000 * 60 * 60 * 24 * 365);

    // Check for overly long expiration
    if (diffYears > 2) {
      violations.push('Cookie expires more than 2 years in the future');
    }
  }

  // Check for third-party tracking cookies
  if (cookie.isThirdParty && (
    cookie.cookieName.includes('_ga') ||
    cookie.cookieName.includes('_gid') ||
    cookie.cookieName.includes('__gads') ||
    cookie.cookieName.includes('_fbp')
  )) {
    violations.push('Third-party tracking cookie detected');
  }

  // Check for insecure cookies
  if (!cookie.secure && cookie.domain.includes('https')) {
    violations.push('Cookie should be marked as Secure');
  }

  return violations.length > 0;
}

function getViolationMessages(cookie) {
  const violations = [];

  if (!cookie.expires) {
    if (cookie.cookieName.includes('_ga') || cookie.cookieName.includes('_gid')) {
      violations.push('Analytics cookie without proper expiration declaration');
    }
  } else {
    const expiryDate = new Date(cookie.expires);
    const now = new Date();
    const diffYears = (expiryDate - now) / (1000 * 60 * 60 * 24 * 365);

    if (diffYears > 2) {
      violations.push('Cookie expiration exceeds recommended duration');
    }
  }

  if (cookie.isThirdParty && (
    cookie.cookieName.includes('_ga') ||
    cookie.cookieName.includes('_gid') ||
    cookie.cookieName.includes('__gads') ||
    cookie.cookieName.includes('_fbp')
  )) {
    violations.push('Third-party tracking without explicit user consent');
  }

  if (!cookie.secure) {
    violations.push('Cookie transmitted over insecure connection');
  }

  return violations.length > 0 ? violations : ['No violations detected'];
}
