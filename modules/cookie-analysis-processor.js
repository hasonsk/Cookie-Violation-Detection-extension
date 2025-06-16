import { ViolationSeverity, ViolationType } from './violation-definitions.js';
import { violationMessages } from './violation-messages.js';

// Cookie Analysis Data Processor
class CookieAnalysisProcessor {
  static processAnalysisData(rawData) {
    try {
      // Validate và normalize data
      const normalizedData = this.normalizeData(rawData);

      // Phân loại issues
      const categorizedIssues = this.categorizeIssues(normalizedData.issues || []);

      // Tính toán statistics
      const statistics = this.calculateStatistics(normalizedData, categorizedIssues);

      // Generate violations
      const violations = this.generateViolations(normalizedData, categorizedIssues);

      return {
        ...normalizedData,
        categorizedIssues,
        statistics,
        violations,
        processedAt: new Date().toISOString()
      };
    } catch (error) {
      console.error('Error processing cookie analysis data:', error);
      return this.createErrorResponse(rawData, error);
    }
  }

  static normalizeData(rawData) {
    return {
      actual_cookies_count: rawData.actual_cookies_count || 0,
      policy_cookies_count: rawData.policy_cookies_count || 0,
      compliance_score: rawData.compliance_score || 0,
      total_issues: rawData.total_issues || 0,
      issues: Array.isArray(rawData.issues) ? rawData.issues : [],
      policy_url: rawData.policy_url || null,
      website_url: rawData.website_url || window.location.href,
      analysis_date: rawData.analysis_date || new Date().toISOString(),
      details: rawData.details || {},
      summary: rawData.summary || {}
    };
  }

  static categorizeIssues(issues) {
    const categorized = {
      [ViolationSeverity.CRITICAL]: [],
      [ViolationSeverity.MODERATE]: [],
      [ViolationSeverity.MINOR]: []
    };

    issues.forEach(issue => {
      // Determine severity based on issue type or content
      const severity = this.determineSeverity(issue);
      categorized[severity].push({
        ...issue,
        severity,
        id: this.generateIssueId(issue)
      });
    });

    return categorized;
  }

  static determineSeverity(issue) {
    // Logic to determine severity based on issue content
    const issueText = (issue.message || issue.description || '').toLowerCase();

    // Critical violations
    if (issueText.includes('no cookie policy') ||
        issueText.includes('sensitive data') ||
        issueText.includes('unauthorized tracking')) {
      return ViolationSeverity.CRITICAL;
    }

    // Moderate violations
    if (issueText.includes('missing consent') ||
        issueText.includes('incomplete policy') ||
        issueText.includes('third party')) {
      return ViolationSeverity.MODERATE;
    }

    // Minor violations
    return ViolationSeverity.MINOR;
  }

  static calculateStatistics(data, categorizedIssues) {
    const totalIssues = Object.values(categorizedIssues).flat().length;
    const severityCounts = Object.fromEntries(
      Object.entries(categorizedIssues).map(([severity, issues]) => [severity, issues.length])
    );

    return {
      totalIssues,
      severityCounts,
      complianceScore: data.compliance_score,
      hasCookiePolicy: !!data.policy_url,
      cookieDiscrepancy: Math.abs(data.actual_cookies_count - data.policy_cookies_count),
      riskLevel: this.calculateRiskLevel(data.compliance_score, totalIssues)
    };
  }

  static calculateRiskLevel(complianceScore, totalIssues) {
    if (complianceScore < 30 || totalIssues >= 5) return 'high';
    if (complianceScore < 60 || totalIssues >= 3) return 'medium';
    return 'low';
  }

  static generateViolations(data, categorizedIssues) {
    const violations = [];

    // Check for no cookie policy
    if (!data.policy_url) {
      violations.push({
        id: 'no-policy',
        type: ViolationType.NO_COOKIE_POLICY,
        severity: ViolationSeverity.CRITICAL,
        message: violationMessages.violationDetails[ViolationType.NO_COOKIE_POLICY].title,
        description: violationMessages.violationDetails[ViolationType.NO_COOKIE_POLICY].description,
        recommendation: violationMessages.violationDetails[ViolationType.NO_COOKIE_POLICY].recommendation
      });
    }

    // Convert categorized issues to violations
    Object.entries(categorizedIssues).forEach(([severity, issues]) => {
      issues.forEach(issue => {
        violations.push({
          id: issue.id,
          type: issue.type || 'unknown',
          severity,
          message: issue.message || issue.description,
          description: issue.description || issue.message,
          recommendation: issue.recommendation || 'Please review and fix this issue'
        });
      });
    });

    return violations;
  }

  static generateIssueId(issue) {
    return `issue-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }

  static createErrorResponse(rawData, error) {
    return {
      error: true,
      errorMessage: error.message,
      rawData,
      processedAt: new Date().toISOString()
    };
  }
}

export { CookieAnalysisProcessor };
