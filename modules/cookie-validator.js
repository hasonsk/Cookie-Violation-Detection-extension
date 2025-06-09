export class CookieValidator {
  checkCookieViolations(cookie) {
    const violations = this.getViolationMessages(cookie);
    return violations.length > 0 && !violations.includes('No violations detected');
  }

  getViolationMessages(cookie) {
    const violations = [];

    // Check for session cookies with suspicious characteristics
    if (!cookie.expires) {
      if (this.isAnalyticsCookie(cookie.cookieName)) {
        violations.push('Analytics cookie without proper expiration declaration');
      }
    } else {
      const expiryDate = new Date(cookie.expires);
      const now = new Date();
      const diffYears = (expiryDate - now) / (1000 * 60 * 60 * 24 * 365);

      // Check for overly long expiration
      if (diffYears > 2) {
        violations.push('Cookie expiration exceeds recommended duration');
      }
    }

    // Check for third-party tracking cookies
    if (cookie.isThirdParty && this.isTrackingCookie(cookie.cookieName)) {
      violations.push('Third-party tracking without explicit user consent');
    }

    // Check for insecure cookies
    if (!cookie.secure) {
      violations.push('Cookie transmitted over insecure connection');
    }

    // Check for missing HttpOnly flag on sensitive cookies
    if (!cookie.httpOnly && this.isSensitiveCookie(cookie.cookieName)) {
      violations.push('Sensitive cookie should be marked as HttpOnly');
    }

    // Check SameSite attribute
    if (!cookie.sameSite || cookie.sameSite === 'None') {
      if (cookie.isThirdParty) {
        violations.push('Third-party cookie missing proper SameSite attribute');
      }
    }

    return violations.length > 0 ? violations : ['No violations detected'];
  }

  isAnalyticsCookie(cookieName) {
    const analyticsPatterns = ['_ga', '_gid', '_gat', '__utma', '__utmb', '__utmc', '__utmz'];
    return analyticsPatterns.some(pattern => cookieName.includes(pattern));
  }

  isTrackingCookie(cookieName) {
    const trackingPatterns = [
      '_ga', '_gid', '_gat', '__gads', '_fbp', '_fbc',
      'DoubleClick', 'IDE', 'test_cookie', '__utma', '__utmb'
    ];
    return trackingPatterns.some(pattern => cookieName.includes(pattern));
  }

  isSensitiveCookie(cookieName) {
    const sensitivePatterns = [
      'session', 'auth', 'token', 'login', 'csrf', 'xsrf',
      'password', 'user', 'account', 'secure'
    ];
    const lowerName = cookieName.toLowerCase();
    return sensitivePatterns.some(pattern => lowerName.includes(pattern));
  }

  getCookieRiskLevel(cookie) {
    const violations = this.getViolationMessages(cookie);
    const violationCount = violations.filter(v => v !== 'No violations detected').length;

    if (violationCount === 0) return 'low';
    if (violationCount <= 2) return 'medium';
    return 'high';
  }

  getCookieCategory(cookie) {
    if (this.isAnalyticsCookie(cookie.cookieName)) return 'analytics';
    if (this.isTrackingCookie(cookie.cookieName)) return 'tracking';
    if (this.isSensitiveCookie(cookie.cookieName)) return 'authentication';
    if (cookie.cookieName.includes('pref') || cookie.cookieName.includes('setting')) return 'preferences';
    return 'functional';
  }
}
