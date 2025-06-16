console.log("Cookie Session Validator content script loaded");

let cookieWarningSystemInstance;

class CookieWarningSystem {
  constructor() {
    this.overlay = document.getElementById('cookie-warning-overlay');
    this.closeButton = document.getElementById('close-warning');
    this.viewDetailsBtn = document.getElementById('view-details-btn');
    this.dismissBtn = document.getElementById('dismiss-btn');
    this.settingsBtn = document.getElementById('settings-btn');
    this.warningMessageElem = document.getElementById('warning-message');
    this.scoreFillElem = document.getElementById('score-fill');
    this.scoreTextElem = document.getElementById('score-text');
    this.violationSummaryElem = document.getElementById('violation-summary');
    this.warningDetailsElem = document.getElementById('warning-details');
    this.detailsContentElem = document.getElementById('details-content');

    this.currentAnalysisData = null;
    this.userPreferences = {}; // This will be loaded from storage

    this.setupEventListeners();
    this.loadUserPreferences();
  }

  setupEventListeners() {
    this.closeButton.addEventListener('click', () => this.hideWarning());
    this.dismissBtn.addEventListener('click', () => this.dismissWarning());
    this.viewDetailsBtn.addEventListener('click', () => this.showDetails());
    this.settingsBtn.addEventListener('click', () => this.openSettings());
  }

  async loadUserPreferences() {
    // In a real extension, this would communicate with background script to load preferences
    // For now, use a placeholder
    this.userPreferences = {
      severityThreshold: 'moderate',
      minComplianceScore: 50,
      showForNoPolicy: true,
      showForLowScore: true,
      dismissedSites: [],
      alwaysShow: false,
    };
    console.log('User preferences loaded:', this.userPreferences);
  }

  processAnalysis(analysisData) {
    this.currentAnalysisData = analysisData;
    console.log('Received analysis data in content script:', analysisData);
    if (!analysisData || !Array.isArray(analysisData.issues)) {
      console.error("Invalid analysisData received: issues array is missing or not an array.", analysisData);
      this.hideWarning(); // Hide if data is invalid
      return; // Stop processing if data is invalid
    }
    // The decision to show the warning is made by the background script.
    // If we receive analysisData, we should display the warning.
    this.updateWarningDialog(analysisData);
    this.showWarning();
  }

  updateWarningDialog(analysisData) {
    // Ensure analysisData and issues are valid before proceeding
    if (!analysisData || !Array.isArray(analysisData.issues)) {
      console.error("updateWarningDialog received invalid analysisData:", analysisData);
      this.detailsContentElem.innerHTML = '<p>Không có dữ liệu vi phạm để hiển thị.</p>';
      return;
    }

    const { total_issues, compliance_score, issues } = analysisData;

    // Update main message
    this.warningMessageElem.textContent = generateWarningMessage(analysisData);

    // Update compliance score
    this.scoreTextElem.textContent = `${compliance_score}/100`;
    this.scoreFillElem.style.width = `${compliance_score}%`;
    if (compliance_score < 50) {
      this.scoreFillElem.style.background = 'linear-gradient(90deg, #ef4444 0%, #f59e0b 100%)';
    } else if (compliance_score < 70) {
      this.scoreFillElem.style.background = 'linear-gradient(90deg, #f59e0b 0%, #10b981 100%)';
    } else {
      this.scoreFillElem.style.background = 'linear-gradient(90deg, #10b981 0%, #059669 100%)';
    }

    // Update violation summary badges
    this.violationSummaryElem.innerHTML = '';
    const severityCounts = categorizeBySeverity(issues);
    for (const severity in severityCounts) {
      if (severityCounts[severity] > 0) {
        const badge = document.createElement('span');
        badge.className = `violation-badge ${severity}`;
        badge.textContent = `${severityCounts[severity]} ${violationMessages.severityLabels[severity]}`;
        this.violationSummaryElem.appendChild(badge);
      }
    }

    // Populate detailed violations
    this.detailsContentElem.innerHTML = '';
    if (issues && issues.length > 0) {
      issues.forEach(violation => {
        const detailItem = document.createElement('div');
        detailItem.className = 'detail-item';
        detailItem.style.borderColor = this.getSeverityColor(violation.severity);
        detailItem.innerHTML = `
          <div class="detail-header">
            <h4 class="detail-title">${violation.message}</h4>
            <span class="violation-severity ${violation.severity}">${violationMessages.severityLabels[violation.severity]}</span>
          </div>
          <p class="detail-description">${violation.description}</p>
          <p class="detail-recommendation"><strong>Khuyến nghị:</strong> ${violation.recommendation}</p>
        `;
        this.detailsContentElem.appendChild(detailItem);
      });
    } else {
      this.detailsContentElem.innerHTML = '<p>Không có vi phạm chi tiết.</p>';
    }
  }

  getSeverityColor(severity) {
    switch (severity) {
      case 'critical': return '#dc2626';
      case 'moderate': return '#d97706';
      case 'minor': return '#7c3aed';
      default: return '#6b7280';
    }
  }

  showWarning() {
    if (this.overlay) {
      this.overlay.style.display = 'flex';
      console.log('Cookie warning dialog shown.');
    }
  }

  hideWarning() {
    if (this.overlay) {
      this.overlay.style.display = 'none';
      this.warningDetailsElem.style.display = 'none'; // Hide details when dialog is dismissed
      console.log('Cookie warning dialog hidden.');
    }
  }

  showDetails() {
    // Send message to background script to open the popup
    chrome.runtime.sendMessage({ action: 'openPopup', tab: 'details', analysisData: this.currentAnalysisData });
    // Hide the current warning dialog
    this.hideWarning();
  }

  dismissWarning() {
    // In a real extension, this would save the dismissed site to user preferences
    // and communicate with background script to update storage
    console.log('Warning dismissed for:', window.location.href);
    this.hideWarning();
    // Send message to background script to save dismissed site
    chrome.runtime.sendMessage({ action: 'dismissSite', url: window.location.href });
  }

  openSettings() {
    // Open the extension popup to the settings tab
    chrome.runtime.sendMessage({ action: 'openPopup', tab: 'settings' });
    this.hideWarning();
  }
}

// --- Constants and Utility Functions (Moved from bottom) ---
const ViolationSeverity = {
  CRITICAL: 'critical',
  MODERATE: 'moderate',
  MINOR: 'minor'
};

const ViolationType = {
  NO_COOKIE_POLICY: 'no_cookie_policy',
  MISSING_CONSENT: 'missing_consent',
  SENSITIVE_DATA_COLLECTION: 'sensitive_data_collection',
  INCOMPLETE_POLICY: 'incomplete_policy',
  UNCLEAR_INFORMATION: 'unclear_information',
  MISSING_DETAILS: 'missing_details',
  EXCESSIVE_COOKIES: 'excessive_cookies',
  THIRD_PARTY_TRACKING: 'third_party_tracking'
};

const violationSeverityMap = {
  [ViolationType.NO_COOKIE_POLICY]: ViolationSeverity.CRITICAL,
  [ViolationType.SENSITIVE_DATA_COLLECTION]: ViolationSeverity.CRITICAL,
  [ViolationType.MISSING_CONSENT]: ViolationSeverity.MODERATE,
  [ViolationType.INCOMPLETE_POLICY]: ViolationSeverity.MODERATE,
  [ViolationType.EXCESSIVE_COOKIES]: ViolationSeverity.MODERATE,
  [ViolationType.THIRD_PARTY_TRACKING]: ViolationSeverity.MODERATE,
  [ViolationType.UNCLEAR_INFORMATION]: ViolationSeverity.MINOR,
  [ViolationType.MISSING_DETAILS]: ViolationSeverity.MINOR
};

const violationMessages = {
  mainWarning: {
    noCookiePolicy: "Trang này không có chính sách cookie",
    hasViolations: "Phát hiện {count} vi phạm liên quan đến cookie",
    complianceScore: "Điểm tuân thủ: {score}/100"
  },
  severityLabels: {
    [ViolationSeverity.CRITICAL]: "cực kỳ nghiêm trọng",
    [ViolationSeverity.MODERATE]: "trung bình",
    [ViolationSeverity.MINOR]: "nhẹ"
  },
  violationDetails: {
    [ViolationType.NO_COOKIE_POLICY]: {
      title: "Không có chính sách cookie",
      description: "Website không cung cấp chính sách cookie rõ ràng",
      recommendation: "Tạo và hiển thị chính sách cookie chi tiết"
    },
    [ViolationType.MISSING_CONSENT]: {
      title: "Thiếu đồng ý của người dùng",
      description: "Cookies được đặt mà không có sự đồng ý của người dùng",
      recommendation: "Implement cookie consent banner"
    },
    [ViolationType.SENSITIVE_DATA_COLLECTION]: {
      title: "Thu thập dữ liệu nhạy cảm",
      description: "Phát hiện thu thập dữ liệu cá nhân nhạy cảm qua cookies",
      recommendation: "Xem xét lại việc thu thập dữ liệu và đảm bảo tuân thủ GDPR"
    },
    [ViolationType.INCOMPLETE_POLICY]: {
      title: "Chính sách không đầy đủ",
      description: "Chính sách cookie thiếu thông tin quan trọng",
      recommendation: "Bổ sung thông tin về mục đích sử dụng và thời gian lưu trữ"
    },
    [ViolationType.EXCESSIVE_COOKIES]: {
      title: "Quá nhiều cookies",
      description: "Website sử dụng số lượng cookies vượt mức khuyến nghị",
      recommendation: "Tối ưu hóa và giảm số lượng cookies không cần thiết"
    },
    [ViolationType.THIRD_PARTY_TRACKING]: {
      title: "Tracking bên thứ ba",
      description: "Phát hiện cookies tracking từ các bên thứ ba",
      recommendation: "Thông báo rõ ràng về việc chia sẻ dữ liệu với bên thứ ba"
    },
    [ViolationType.UNCLEAR_INFORMATION]: {
      title: "Thông tin không rõ ràng",
      description: "Chính sách cookie khó hiểu hoặc mơ hồ",
      recommendation: "Viết lại chính sách bằng ngôn ngữ dễ hiểu"
    },
    [ViolationType.MISSING_DETAILS]: {
      title: "Thiếu chi tiết",
      description: "Chính sách thiếu thông tin chi tiết về từng loại cookie",
      recommendation: "Bổ sung bảng mô tả chi tiết cho từng cookie"
    }
  },
  dialogTemplate: {
    title: "🚨 Cảnh báo bảo mật Cookie",
    subtitle: "Phát hiện các vấn đề về quyền riêng tư",
    buttons: {
      viewDetails: "Xem chi tiết",
      dismiss: "Bỏ qua",
      settings: "Cài đặt",
      continue: "Tiếp tục"
    }
  }
};

function generateWarningMessage(analysisData) {
  const { total_issues, compliance_score, issues, policy_url } = analysisData;

  let message = "";

  if (!policy_url) {
    message += violationMessages.mainWarning.noCookiePolicy;
  }

  if (total_issues > 0) {
    if (message) message += ", và ";
    message += violationMessages.mainWarning.hasViolations.replace('{count}', total_issues);

    const severityCounts = categorizeBySeverity(issues);
    const severityParts = [];

    Object.entries(severityCounts).forEach(([severity, count]) => {
      if (count > 0) {
        severityParts.push(`${count} ${violationMessages.severityLabels[severity]}`);
      }
    });

    if (severityParts.length > 0) {
      message += `, bao gồm ${severityParts.join(', ')}`;
    }
  }

  return message;
}

function categorizeBySeverity(issues) {
  const counts = {
    [ViolationSeverity.CRITICAL]: 0,
    [ViolationSeverity.MODERATE]: 0,
    [ViolationSeverity.MINOR]: 0
  };

  if (!Array.isArray(issues)) {
    console.error("categorizeBySeverity received non-array issues:", issues);
    return counts;
  }

  issues.forEach(issue => {
    let normalizedSeverity;
    switch (issue.severity.toLowerCase()) {
      case 'critical':
      case 'high':
        normalizedSeverity = ViolationSeverity.CRITICAL;
        break;
      case 'medium':
        normalizedSeverity = ViolationSeverity.MODERATE;
        break;
      case 'low':
        normalizedSeverity = ViolationSeverity.MINOR;
        break;
      default:
        normalizedSeverity = ViolationSeverity.MINOR;
    }
    counts[normalizedSeverity]++;
  });

  return counts;
}

// --- Start of Warning Dialog HTML and CSS ---
const warningDialogHTML = `
    <div id="cookie-warning-overlay" class="cookie-warning-overlay" style="display: none;">
      <div class="cookie-warning-dialog">
        <!-- Header -->
        <div class="cookie-warning-header">
          <div class="warning-icon">
            <svg class="warning-svg" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 2L1 21h22L12 2zm0 3.99L19.53 19H4.47L12 5.99zM11 16h2v2h-2v-2zm0-6h2v4h-2v-4z"/>
            </svg>
          </div>
          <div class="warning-title">
            <h3 id="warning-title">🚨 Cảnh báo bảo mật Cookie</h3>
            <p id="warning-subtitle">Phát hiện các vấn đề về quyền riêng tư</p>
          </div>
          <button class="close-button" id="close-warning">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
            </svg>
          </button>
        </div>

        <!-- Body -->
        <div class="cookie-warning-body">
          <div class="warning-summary">
            <p id="warning-message" class="main-message"></p>
          </div>

          <div class="compliance-info">
            <div class="compliance-score">
              <label>Điểm tuân thủ:</label>
              <div class="score-bar">
                <div class="score-fill" id="score-fill"></div>
                <span class="score-text" id="score-text">0/100</span>
              </div>
            </div>

            <div class="violation-summary" id="violation-summary">
              <!-- Dynamic content will be inserted here -->
            </div>
          </div>

          <div class="warning-details" id="warning-details" style="display: none;">
            <div class="details-content" id="details-content">
              <!-- Detailed violation information -->
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="cookie-warning-footer">
          <button class="btn btn-secondary" id="view-details-btn">
            Xem chi tiết
          </button>
          <button class="btn btn-primary" id="dismiss-btn">
            Bỏ qua
          </button>
          <button class="btn btn-outline" id="settings-btn">
            Cài đặt
          </button>
        </div>
      </div>
    </div>
`;

const warningDialogCSS = `
/* Cookie Warning Dialog Styles */
.cookie-warning-overlay {
  position: fixed;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  background: rgba(0, 0, 0, 0.5);
  backdrop-filter: blur(4px);
  z-index: 10000;
  display: flex;
  align-items: center;
  justify-content: center;
  animation: fadeIn 0.3s ease-out;
}

.cookie-warning-dialog {
  background: white;
  border-radius: 12px;
  box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
  max-width: 500px;
  width: 90%;
  max-height: 80vh;
  overflow: hidden;
  transform: scale(0.9);
  animation: slideIn 0.3s ease-out forwards;
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideIn {
  from {
    transform: scale(0.9) translateY(20px);
    opacity: 0;
  }
  to {
    transform: scale(1) translateY(0);
    opacity: 1;
  }
}

/* Header Styles */
.cookie-warning-header {
  display: flex;
  align-items: flex-start;
  padding: 20px;
  border-bottom: 1px solid #e5e7eb;
  background: linear-gradient(135deg, #fef3c7 0%, #fde68a 100%);
}

.warning-icon {
  flex-shrink: 0;
  margin-right: 12px;
}

.warning-svg {
  width: 24px;
  height: 24px;
  color: #d97706;
}

.warning-title {
  flex: 1;
}

.warning-title h3 {
  margin: 0 0 4px 0;
  font-size: 18px;
  font-weight: 600;
  color: #92400e;
}

.warning-title p {
  margin: 0;
  font-size: 14px;
  color: #a16207;
}

.close-button {
  background: none;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: #6b7280;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-button:hover {
  background: rgba(0, 0, 0, 0.1);
  color: #374151;
}

.close-button svg {
  width: 20px;
  height: 20px;
}

/* Body Styles */
.cookie-warning-body {
  padding: 20px;
  max-height: 400px;
  overflow-y: auto;
}

.main-message {
  font-size: 16px;
  line-height: 1.5;
  color: #374151;
  margin-bottom: 16px;
}

.compliance-info {
  margin-bottom: 16px;
}

.compliance-score {
  margin-bottom: 12px;
}

.compliance-score label {
  display: block;
  font-size: 14px;
  font-weight: 500;
  color: #4b5563;
  margin-bottom: 6px;
}

.score-bar {
  position: relative;
  height: 20px;
  background: #e5e7eb;
  border-radius: 10px;
  overflow: hidden;
}

.score-fill {
  height: 100%;
  background: linear-gradient(90deg, #ef4444 0%, #f59e0b 50%, #10b981 100%);
  border-radius: 10px;
  transition: width 0.5s ease-out;
  position: relative;
}

.score-text {
  position: absolute;
  top: 50%;
  right: 8px;
  transform: translateY(-50%);
  font-size: 12px;
  font-weight: 600;
  color: #374151;
}

.violation-summary {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.violation-badge {
  display: inline-flex;
  align-items: center;
  padding: 4px 8px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 500;
}

.violation-badge.critical {
  background: #fee2e2;
  color: #dc2626;
}

.violation-badge.moderate {
  background: #fef3c7;
  color: #d97706;
}

.violation-badge.minor {
  background: #ddd6fe;
  color: #7c3aed;
}

.warning-details {
  margin-top: 16px;
  padding-top: 16px;
  border-top: 1px solid #e5e7eb;
}

.detail-item {
  margin-bottom: 12px;
  padding: 12px;
  background: #f9fafb;
  border-radius: 8px;
  border-left: 4px solid;
}
`;

// Function to inject HTML and CSS and initialize the system
function initializeContentScript() {
  // Inject CSS
  const styleElement = document.createElement('style');
  styleElement.textContent = warningDialogCSS;
  document.head.appendChild(styleElement);

  // Inject HTML
  document.body.insertAdjacentHTML('beforeend', warningDialogHTML);

  // Initialize the warning system AFTER elements are in the DOM
  cookieWarningSystemInstance = new CookieWarningSystem();
}

// Call the injection and initialization function when the DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeContentScript);
} else {
  initializeContentScript();
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  console.log('Message received in content script:', message);
  if (message.action === 'showCookieWarning' && message.analysisData) {
    if (cookieWarningSystemInstance) {
      // cookieWarningSystemInstance.processAnalysis(message.analysisData);
    } else {
      console.warn('CookieWarningSystem not initialized when message received.');
    }
  }
});
