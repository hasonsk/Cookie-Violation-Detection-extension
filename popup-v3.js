document.addEventListener('DOMContentLoaded', function() {
  // Initialize Lucide icons if the library is available
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // ===== NAVIGATION =====
  initializeNavigation();

  // ===== DASHBOARD =====
  initializeDashboard();

  // ===== SETTINGS =====
  initializeSettings();

  // ===== DOMAIN BLOCKING =====
  initializeDomainBlocking();

  // Load current tab data
  getCurrentTabId().then(tabId => {
    if (tabId) {
      loadAnalysisDataForTab(tabId);
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

// ===== ANALYSIS DATA MANAGEMENT =====
function loadAnalysisDataForTab(tabId) {
  chrome.storage.local.get('analysisData', function(data) {
    if (data.analysisData && data.analysisData[tabId]) {
      const analysisData = data.analysisData[tabId];
      updateDashboardWithAnalysis(analysisData);
      updateCookieListWithIssues(analysisData);
    } else {
      // No analysis data found - show default values
      updateDashboardWithDefaults();
    }
  });
}

function updateDashboardWithAnalysis(analysisData) {
  // Update dashboard stats
  const complianceScore = document.querySelector('.summary-cards .card:nth-child(1) .value');
  const totalIssues = document.querySelector('.summary-cards .card:nth-child(2) .value');
  const criticalIssues = document.querySelector('.summary-cards .card:nth-child(3) .value');
  const cookiesAnalyzed = document.querySelector('.summary-cards .card:nth-child(4) .value');

  if (complianceScore) complianceScore.textContent = `${analysisData.compliance_score}%`;
  if (totalIssues) totalIssues.textContent = analysisData.total_issues;
  if (criticalIssues) criticalIssues.textContent = analysisData.statistics.by_severity.Critical || 0;
  if (cookiesAnalyzed) cookiesAnalyzed.textContent = analysisData.actual_cookies_count;

  // Update issues breakdown
  updateIssuesBreakdown(analysisData.statistics);

  // Update undeclared cookies list
  updateUndeclaredCookiesList(analysisData.summary.undeclared_cookies);
}

function updateDashboardWithDefaults() {
  const complianceScore = document.querySelector('.summary-cards .card:nth-child(1) .value');
  const totalIssues = document.querySelector('.summary-cards .card:nth-child(2) .value');
  const criticalIssues = document.querySelector('.summary-cards .card:nth-child(3) .value');
  const cookiesAnalyzed = document.querySelector('.summary-cards .card:nth-child(4) .value');

  if (complianceScore) complianceScore.textContent = '0%';
  if (totalIssues) totalIssues.textContent = '0';
  if (criticalIssues) criticalIssues.textContent = '0';
  if (cookiesAnalyzed) cookiesAnalyzed.textContent = '0';
}

function updateIssuesBreakdown(statistics) {
  const severityBreakdown = document.getElementById('severity-breakdown');
  if (severityBreakdown) {
    severityBreakdown.innerHTML = `
      <div class="severity-item">
        <span class="severity-label critical">Critical:</span>
        <span class="severity-count">${statistics.by_severity.Critical || 0}</span>
      </div>
      <div class="severity-item">
        <span class="severity-label high">High:</span>
        <span class="severity-count">${statistics.by_severity.High || 0}</span>
      </div>
      <div class="severity-item">
        <span class="severity-label medium">Medium:</span>
        <span class="severity-count">${statistics.by_severity.Medium || 0}</span>
      </div>
      <div class="severity-item">
        <span class="severity-label low">Low:</span>
        <span class="severity-count">${statistics.by_severity.Low || 0}</span>
      </div>
    `;
  }
}

function updateUndeclaredCookiesList(undeclaredCookies) {
  const cookiesList = document.getElementById('undeclared-cookies-list');
  if (cookiesList) {
    cookiesList.innerHTML = '';

    if (undeclaredCookies && undeclaredCookies.length > 0) {
      undeclaredCookies.forEach(cookieName => {
        const li = document.createElement('li');
        li.textContent = cookieName;
        cookiesList.appendChild(li);
      });
    } else {
      const li = document.createElement('li');
      li.textContent = 'Không có cookie chưa khai báo';
      cookiesList.appendChild(li);
    }
  }
}

function updateCookieListWithIssues(analysisData) {
  const cookiePanel = document.querySelector('#cookies-screen .panel');
  if (!cookiePanel) return;

  // Clear existing cookie items
  const children = Array.from(cookiePanel.children);
  children.slice(1).forEach(child => child.remove());

  // Create issue items
  if (analysisData.issues && analysisData.issues.length > 0) {
    analysisData.issues.forEach((issue, index) => {
      const issueId = `issue-${index}`;
      const severityClass = issue.severity.toLowerCase();

      const issueDiv = document.createElement('div');
      issueDiv.className = 'list-divider';
      issueDiv.innerHTML = `
        <div class="cookie-item violation ${severityClass}" data-id="${issueId}">
          <div class="icon">
            <i data-lucide="${getSeverityIcon(issue.severity)}" size="16" class="text-${getSeverityColor(issue.severity)}"></i>
          </div>
          <div class="content">
            <div class="title">${issue.cookie_name}</div>
            <div class="subtitle">
              ${issue.category} · ${issue.severity} · ${issue.type}
            </div>
          </div>
          <i data-lucide="chevron-right" size="16" class="chevron"></i>
        </div>
        <div class="cookie-details" id="${issueId}-details">
          <div class="details-grid">
            <div>
              <div class="detail-label">Cookie Name</div>
              <div>${issue.cookie_name}</div>
            </div>
            <div>
              <div class="detail-label">Category</div>
              <div>${issue.category}</div>
            </div>
            <div>
              <div class="detail-label">Type</div>
              <div>${issue.type}</div>
            </div>
            <div>
              <div class="detail-label">Severity</div>
              <div class="severity-badge ${severityClass}">${issue.severity}</div>
            </div>
            <div>
              <div class="detail-label">Description</div>
              <div>${issue.description}</div>
            </div>
            ${issue.details ? `
              <div>
                <div class="detail-label">Additional Details</div>
                <div>${formatIssueDetails(issue.details)}</div>
              </div>
            ` : ''}
          </div>
        </div>
      `;

      cookiePanel.appendChild(issueDiv);
    });
  } else {
    // No issues found
    const noIssuesDiv = document.createElement('div');
    noIssuesDiv.className = 'list-divider';
    noIssuesDiv.innerHTML = `
      <div class="cookie-item success">
        <div class="icon">
          <i data-lucide="check-circle" size="16" class="text-green-600"></i>
        </div>
        <div class="content">
          <div class="title">Không có vấn đề được phát hiện</div>
          <div class="subtitle">Tất cả cookies đều tuân thủ quy định</div>
        </div>
      </div>
    `;
    cookiePanel.appendChild(noIssuesDiv);
  }

  // Re-initialize icons for new elements
  if (typeof lucide !== 'undefined') {
    lucide.createIcons();
  }

  // Re-attach click handlers for new cookie items
  document.querySelectorAll('.cookie-item').forEach(item => {
    item.addEventListener('click', function() {
      const id = this.getAttribute('data-id');
      if (!id) return;

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

// ===== HELPER FUNCTIONS FOR DISPLAY =====
function getSeverityIcon(severity) {
  switch (severity.toLowerCase()) {
    case 'critical': return 'alert-circle';
    case 'high': return 'alert-triangle';
    case 'medium': return 'alert-triangle';
    case 'low': return 'info';
    default: return 'info';
  }
}

function getSeverityColor(severity) {
  switch (severity.toLowerCase()) {
    case 'critical': return 'red-600';
    case 'high': return 'red-500';
    case 'medium': return 'yellow-500';
    case 'low': return 'blue-500';
    default: return 'gray-500';
  }
}

function formatIssueDetails(details) {
  if (!details) return '';

  const detailsArray = [];

  if (details.inferred_purpose) {
    detailsArray.push(`Mục đích suy luận: ${details.inferred_purpose}`);
  }

  if (details.retention_days) {
    detailsArray.push(`Thời gian lưu trữ: ${details.retention_days} ngày`);
  }

  if (details.collects_user_data !== undefined) {
    detailsArray.push(`Thu thập dữ liệu người dùng: ${details.collects_user_data ? 'Có' : 'Không'}`);
  }

  if (details.is_third_party !== undefined) {
    detailsArray.push(`Bên thứ ba: ${details.is_third_party ? 'Có' : 'Không'}`);
  }

  if (details.similarity_score !== undefined) {
    detailsArray.push(`Điểm tương đồng: ${(details.similarity_score * 100).toFixed(1)}%`);
  }

  return detailsArray.join('<br>');
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
async function exportAnalysisReport() {
  const tabId = await getCurrentTabId();
  if (!tabId) return;

  chrome.storage.local.get('analysisData', function(data) {
    if (!data.analysisData || !data.analysisData[tabId]) {
      alert('Không có dữ liệu phân tích để xuất');
      return;
    }

    const analysisData = data.analysisData[tabId];

    // Create CSV header
    let csvContent = 'Issue ID,Cookie Name,Category,Type,Severity,Description,Details\n';

    // Add data rows
    if (analysisData.issues && analysisData.issues.length > 0) {
      analysisData.issues.forEach(issue => {
        const detailsText = issue.details ? JSON.stringify(issue.details).replace(/"/g, '""') : '';
        const row = [
          issue.issue_id,
          issue.cookie_name,
          issue.category,
          issue.type,
          issue.severity,
          issue.description.replace(/"/g, '""'),
          detailsText
        ].map(item => `"${String(item || '')}"`).join(',');

        csvContent += row + '\n';
      });
    }

    // Create and download CSV file
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    chrome.tabs.get(tabId, function(tab) {
      const domain = new URL(tab.url).hostname;

      link.setAttribute('href', url);
      link.setAttribute('download', `cookie_analysis_${domain}_${new Date().toISOString().slice(0,10)}.csv`);
      link.style.visibility = 'hidden';

      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    });
  });
}

async function clearAnalysisData() {
  const tabId = await getCurrentTabId();
  if (!tabId) return;

  chrome.storage.local.get('analysisData', function(data) {
    if (data.analysisData) {
      // Only clear analysis data for current tab
      delete data.analysisData[tabId];
      chrome.storage.local.set({ 'analysisData': data.analysisData }, function() {
        chrome.action.setBadgeText({ text: '' });
        loadAnalysisDataForTab(tabId);
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

  // Search functionality for issues
  const searchInput = document.querySelector('#cookies-screen .search-box input');
  if (searchInput) {
    searchInput.addEventListener('input', function() {
      const searchTerm = this.value.toLowerCase();
      filterIssuesBySearch(searchTerm);
    });
  }
}

// Apply filter to issue list
function applyFilter(filterType) {
  const cookieItems = document.querySelectorAll('.cookie-item');

  cookieItems.forEach(item => {
    const parentDiv = item.parentNode;

    // Reset display for all items first
    if (parentDiv) parentDiv.style.display = 'block';

    switch (filterType) {
      case 'all':
        // Show all issues
        break;

      case 'violations':
        // Show only items with violations (already filtered in display)
        if (!item.classList.contains('violation') && !item.classList.contains('success')) {
          if (parentDiv) parentDiv.style.display = 'none';
        }
        break;

      case 'critical':
        // Show only critical issues
        if (!item.classList.contains('critical')) {
          if (parentDiv) parentDiv.style.display = 'none';
        }
        break;

      case 'high':
        // Show only high severity issues
        if (!item.classList.contains('high')) {
          if (parentDiv) parentDiv.style.display = 'none';
        }
        break;
    }
  });
}

// Filter issues by search term
function filterIssuesBySearch(searchTerm) {
  const cookieItems = document.querySelectorAll('.cookie-item');

  cookieItems.forEach(item => {
    const parentDiv = item.parentNode;
    const content = item.textContent.toLowerCase();

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
      loadAnalysisDataForTab(tabId);
    }
  });
}
