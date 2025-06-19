// modules/cookie-display.js
export class CookieDisplay {
  constructor() {
    this.data = null;
    this.currentFilter = 'all';
    this.searchTerm = '';
  }

  async init(data) {
    this.data = data;
    this.renderAllCookies();
    this.setupEventListeners();
  }

  setupEventListeners() {
    // Filter buttons
    const filterButtons = document.querySelectorAll('.filter-button');
    filterButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        // Update active filter button
        filterButtons.forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');

        this.currentFilter = e.target.dataset.filter;
        this.renderFilteredCookies();
      });
    });

    // Search input
    const searchInput = document.getElementById('cookie-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchTerm = e.target.value.toLowerCase();
        this.renderFilteredCookies();
      });
    }
  }

  renderAllCookies() {
    if (!this.data) return;
    this.renderFilteredCookies();
  }

  renderFilteredCookies() {
    const container = document.getElementById("cookie-list-container");
    if (!container) return;

    container.innerHTML = "";

    const allCookies = this.processAllCookies();
    const filteredCookies = this.filterCookies(allCookies);

    if (filteredCookies.length === 0) {
      container.innerHTML = `<div class="empty-list" data-i18n="noCookiesFound">No cookies found</div>`;
      return;
    }

    filteredCookies.forEach(cookie => {
      container.appendChild(this.createCookieItem(cookie));
    });

    // Re-create Lucide icons
    if (typeof lucide !== 'undefined') {
      lucide.createIcons();
    }
  }

  processAllCookies() {
    const allCookies = [];

    // Process policy cookies (declared cookies)
    if (this.data.details?.declared_cookie_details) {
      this.data.details.declared_cookie_details.forEach(cookie => {
        const processedCookie = {
          ...cookie,
          type: "policy",
          source: "policy",
          isFirstParty: this.isFirstPartyCookie(cookie.domain),
          violations: this.getCookieViolations(cookie.cookie_name || cookie.name)
        };
        allCookies.push(processedCookie);
      });
    }

    // Process realtime cookies (realtime cookies)
    if (this.data.details?.realtime_cookie_details) {
      this.data.details.realtime_cookie_details.forEach(cookie => {
        const processedCookie = {
          ...cookie,
          type: "realtime",
          source: "realtime",
          isFirstParty: this.isFirstPartyCookie(cookie.domain),
          violations: this.getCookieViolations(cookie.name || cookie.cookie_name),
          // Check if this cookie also exists in policy
          inPolicy: this.isCookieInPolicy(cookie.name || cookie.cookie_name)
        };
        allCookies.push(processedCookie);
      });
    }

    // Handle violating cookies
    if (this.data.details?.declared_violating_cookies) {
      this.data.details.declared_violating_cookies.forEach(cookie => {
        const existingCookie = allCookies.find(c =>
          (c.cookie_name === cookie.cookie_name || c.name === cookie.cookie_name) &&
          c.type === "policy"
        );

        if (existingCookie) {
          existingCookie.violations = [...(existingCookie.violations || []), ...(cookie.issues || [])];
        } else {
          // Add as realtime violating cookie if not found in policy
          const processedCookie = {
            ...cookie,
            type: "realtime",
            source: "realtime",
            isFirstParty: this.isFirstPartyCookie(cookie.domain),
            violations: cookie.issues || [],
            inPolicy: false
          };
          allCookies.push(processedCookie);
        }
      });
    }

    return allCookies;
  }

  filterCookies(cookies) {
    let filtered = cookies;

    // Apply search filter
    if (this.searchTerm) {
      filtered = filtered.filter(cookie => {
        const name = (cookie.cookie_name || cookie.name || '').toLowerCase();
        const domain = (cookie.domain || '').toLowerCase();
        const purpose = (cookie.declared_purpose || '').toLowerCase();
        return name.includes(this.searchTerm) ||
               domain.includes(this.searchTerm) ||
               purpose.includes(this.searchTerm);
      });
    }

    // Apply category filter
    switch (this.currentFilter) {
      case 'policy':
        filtered = filtered.filter(cookie => cookie.type === 'policy');
        break;
      case 'realtime':
        filtered = filtered.filter(cookie => cookie.type === 'realtime');
        break;
      case 'violations':
        filtered = filtered.filter(cookie => cookie.violations && cookie.violations.length > 0);
        break;
      case 'no-issues':
        filtered = filtered.filter(cookie => !cookie.violations || cookie.violations.length === 0);
        break;
      case 'third-party':
        filtered = filtered.filter(cookie => !cookie.isFirstParty);
        break;
      case 'all':
      default:
        // No additional filtering
        break;
    }

    return filtered;
  }

  isFirstPartyCookie(cookieDomain) {
    if (!cookieDomain) return true;

    // Get current tab domain (you might need to pass this in the data)
    const url = new URL(this.data.website_url);
    const currentDomain = url.hostname;

    // Remove leading dots and compare
    const cleanCookieDomain = cookieDomain.replace(/^\./, '');
    const cleanCurrentDomain = currentDomain.replace(/^\./, '');

    // alert(`Checking first-party for cookie domain: ${cleanCookieDomain}, current domain: ${this.data.website_url}`);
    return cleanCurrentDomain ||
           cleanCurrentDomain.endsWith('.' + cleanCookieDomain) ||
           cleanCookieDomain.endsWith('.' + cleanCurrentDomain);
  }

  isCookieInPolicy(cookieName) {
    if (!this.data.details?.declared_cookie_details) return false;

    return this.data.details.declared_cookie_details.some(
      cookie => cookie.cookie_name === cookieName
    );
  }

  getCookieViolations(cookieName) {
    if (!this.data.issues || !cookieName) return [];

    return this.data.issues.filter(issue => issue.cookie_name === cookieName);
  }

  createCookieItem(cookie) {
    const itemDiv = document.createElement("div");
    itemDiv.classList.add("list-divider");

    const hasViolations = cookie.violations && cookie.violations.length > 0;
    const statusIcon = hasViolations ?
      `<i data-lucide="alert-triangle" size="16" class="text-red-600"></i>` :
      `<i data-lucide="check-circle" size="16" class="green"></i>`;
    const statusClass = hasViolations ? "violation" : "";

    const cookieName = cookie.cookie_name || cookie.name || 'N/A';
    const cookieDomain = cookie.domain || cookie.declared_third_parties || 'N/A';

    // Build subtitle with tags
    let subtitle = `${cookieDomain}`;

    // Add retention info
    const retention = this.getRetentionInfo(cookie);
    if (retention !== 'N/A') {
      subtitle += ` · ${retention}`;
    }

    // Add type tags
    const tags = [];
    if (cookie.type === "policy") {
      tags.push(`<span class="tag tag-policy" data-i18n="tagPolicy">Policy</span>`);
    } else if (cookie.type === "realtime") {
      tags.push(`<span class="tag tag-realtime" data-i18n="tagRealtime">Realtime</span>`);
      if (cookie.inPolicy) {
        tags.push(`<span class="tag tag-in-policy" data-i18n="tagInPolicy">In Policy</span>`);
      }
    }

    if (!cookie.isFirstParty || cookie.declared_third_parties != "First Party") {

      tags.push(`<span class="tag tag-third-party" data-i18n="tagThirdParty">3rd Party</span>`);
    }

    if (tags.length > 0) {
      subtitle += ` · ${tags.join(' ')}`;
    }

    const detailsHtml = this.createDetailsHtml(cookie);
    const issuesHtml = this.createIssuesHtml(cookie);

    itemDiv.innerHTML = `
      <div class="cookie-item ${statusClass}" data-id="${cookieName}">
        <div class="icon">${statusIcon}</div>
        <div class="content">
          <div class="title">${cookieName}</div>
          <div class="subtitle">${subtitle}</div>
        </div>
        <i data-lucide="chevron-right" size="16" class="chevron"></i>
      </div>
      <div class="cookie-details hidden" id="${cookieName}-details">
        <div class="details-grid">
          ${detailsHtml}
        </div>
        ${issuesHtml}
      </div>
    `;

    // Add click handler for expand/collapse
    const cookieItemHeader = itemDiv.querySelector(".cookie-item");
    cookieItemHeader.addEventListener("click", () => {
      const details = itemDiv.querySelector(".cookie-details");
      details.classList.toggle("expanded");
      const chevron = cookieItemHeader.querySelector(".chevron");
      if (details.classList.contains("expanded")) {
        chevron.style.transform = "rotate(90deg)";
      } else {
        chevron.style.transform = "rotate(0deg)";
      }
      // Re-create Lucide icons for newly visible elements
      if (typeof lucide !== 'undefined') {
        lucide.createIcons();
      }
    });

    return itemDiv;
  }

  getRetentionInfo(cookie) {
    if (cookie.declared_retention) {
      return cookie.declared_retention;
    }
    if (cookie.expirationDate) {
      return cookie.expirationDate;
    }
    return 'N/A';
  }

  createDetailsHtml(cookie) {
    if (cookie.type === "policy") {
      return `
        <div>
          <div class="detail-label" data-i18n="purpose">Purpose</div>
          <div>${cookie.declared_purpose || 'N/A'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="retention">Retention</div>
          <div>${cookie.declared_retention || 'N/A'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="thirdParty">Third Party</div>
          <div>${cookie.declared_third_parties ? cookie.declared_third_parties.join(", ") : 'N/A'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="description">Description</div>
          <div>${cookie.declared_description || 'N/A'}</div>
        </div>
      `;
    } else {
      return `
        <div>
          <div class="detail-label" data-i18n="name">Name</div>
          <div>${cookie.name || 'N/A'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="value">Value</div>
          <div class="cookie-value">${this.truncateValue(cookie.value || 'N/A')}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="domain">Domain</div>
          <div>${cookie.domain || 'N/A'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="path">Path</div>
          <div>${cookie.path || 'N/A'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="expirationDate">Expiration</div>
          <div>${cookie.expirationDate ? new Date(cookie.expirationDate * 1000).toLocaleDateString() : 'Session'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="secure">Secure</div>
          <div>${cookie.secure ? 'Yes' : 'No'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="httpOnly">HttpOnly</div>
          <div>${cookie.httpOnly ? 'Yes' : 'No'}</div>
        </div>
        <div>
          <div class="detail-label" data-i18n="sameSite">SameSite</div>
          <div>${cookie.sameSite || 'None'}</div>
        </div>
      `;
    }
  }

  createIssuesHtml(cookie) {
    if (!cookie.violations || cookie.violations.length === 0) {
      return "";
    }

    return `
      <div class="violation-alert">
        <div class="title" data-i18n="violationsTitle">Violations</div>
        <ul class="violation-list">
          ${cookie.violations.map(issue => `
            <li>${issue.description} ${issue.link ? `(<a href="${issue.link}" target="_blank" data-i18n="viewIssue">View Issue</a>)` : ''}</li>
          `).join("")}
        </ul>
      </div>
    `;
  }

  truncateValue(value, maxLength = 50) {
    if (!value || value.length <= maxLength) return value;
    return value.substring(0, maxLength) + '...';
  }
}
