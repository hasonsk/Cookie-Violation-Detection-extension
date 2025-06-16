import { ViolationSeverity } from './violation-definitions.js';
import { violationMessages } from './violation-messages.js';

// Warning Decision Engine
class WarningDecisionEngine {
  constructor(userPreferences = {}) {
    this.preferences = {
      severityThreshold: ViolationSeverity.MODERATE,
      minComplianceScore: 50,
      showForNoPolicy: true,
      showForLowScore: true,
      dismissedSites: [],
      alwaysShow: false,
      ...userPreferences
    };
  }

  shouldShowWarning(analysisData, currentUrl) {
    try {
      // Check if site is dismissed
      if (this.isSiteDismissed(currentUrl) && !this.preferences.alwaysShow) {
        return false;
      }

      // Check error state
      if (analysisData.error) {
        return false; // Don't show warning for analysis errors
      }

      // Main validation logic
      return this.evaluateWarningCriteria(analysisData);
    } catch (error) {
      console.error('Error in warning decision logic:', error);
      return false;
    }
  }

  evaluateWarningCriteria(data) {
    const checks = [
      this.checkNoCookiePolicy(data),
      this.checkLowComplianceScore(data),
      this.checkCriticalViolations(data),
      this.checkViolationThreshold(data)
    ];

    // Return true if any check passes
    return checks.some(check => check === true);
  }

  checkNoCookiePolicy(data) {
    return this.preferences.showForNoPolicy && !data.policy_url;
  }

  checkLowComplianceScore(data) {
    return this.preferences.showForLowScore &&
           data.compliance_score < this.preferences.minComplianceScore;
  }

  checkCriticalViolations(data) {
    if (!data.violations) return false;

    return data.violations.some(violation =>
      violation.severity === ViolationSeverity.CRITICAL
    );
  }

  checkViolationThreshold(data) {
    if (!data.violations) return false;

    const severityOrder = [ViolationSeverity.CRITICAL, ViolationSeverity.MODERATE, ViolationSeverity.MINOR];
    const thresholdIndex = severityOrder.indexOf(this.preferences.severityThreshold);

    return data.violations.some(violation => {
      const violationIndex = severityOrder.indexOf(violation.severity);
      return violationIndex <= thresholdIndex;
    });
  }

  isSiteDismissed(url) {
    const domain = this.extractDomain(url);
    return this.preferences.dismissedSites.includes(domain);
  }

  extractDomain(url) {
    try {
      return new URL(url).hostname;
    } catch {
      return url;
    }
  }

  dismissSite(url) {
    const domain = this.extractDomain(url);
    if (!this.preferences.dismissedSites.includes(domain)) {
      this.preferences.dismissedSites.push(domain);
      this.savePreferences();
    }
  }

  savePreferences() {
    // Save to browser storage (implementation depends on context)
    if (typeof chrome !== 'undefined' && chrome.storage) {
      chrome.storage.local.set({ cookieWarningPreferences: this.preferences });
    } else {
      // Fallback to in-memory storage for now
      window.cookieWarningPreferences = this.preferences;
    }
  }

  loadPreferences() {
    // Load from browser storage
    if (typeof chrome !== 'undefined' && chrome.storage) {
      return new Promise(resolve => {
        chrome.storage.local.get(['cookieWarningPreferences'], result => {
          if (result.cookieWarningPreferences) {
            this.preferences = { ...this.preferences, ...result.cookieWarningPreferences };
          }
          resolve(this.preferences);
        });
      });
    } else {
      // Fallback
      if (window.cookieWarningPreferences) {
        this.preferences = { ...this.preferences, ...window.cookieWarningPreferences };
      }
      return Promise.resolve(this.preferences);
    }
  }
}

// Enhanced validation function
function shouldShowWarning(analysisData, userPreferences = {}) {
  const engine = new WarningDecisionEngine(userPreferences);
  return engine.shouldShowWarning(analysisData, window.location.href);
}

// Additional validation utilities
const ValidationUtils = {
  isValidAnalysisData(data) {
    return data &&
           typeof data === 'object' &&
           !data.error &&
           (typeof data.compliance_score === 'number' ||
            typeof data.total_issues === 'number' ||
            Array.isArray(data.issues));
  },

  hasSignificantIssues(data) {
    return data.total_issues > 0 ||
           data.compliance_score < 70 ||
           !data.policy_url;
  },

  calculateRiskScore(data) {
    let score = 0;

    // No policy = high risk
    if (!data.policy_url) score += 40;

    // Low compliance score
    if (data.compliance_score < 50) score += 30;
    else if (data.compliance_score < 70) score += 15;

    // Number of issues
    score += Math.min(data.total_issues * 5, 30);

    return Math.min(score, 100);
  }
};

export { WarningDecisionEngine, shouldShowWarning, ValidationUtils };
