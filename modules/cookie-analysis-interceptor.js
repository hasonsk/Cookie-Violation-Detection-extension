// Response Interceptor Class
class CookieAnalysisInterceptor {
  constructor() {
    this.interceptors = [];
    this.setupInterceptors();
  }

  setupInterceptors() {
    // Intercept XMLHttpRequest
    this.interceptXHR();

    // Intercept Fetch API
    this.interceptFetch();
  }

  interceptXHR() {
    const originalOpen = XMLHttpRequest.prototype.open;
    const originalSend = XMLHttpRequest.prototype.send;

    XMLHttpRequest.prototype.open = function(method, url, async, user, password) {
      this._url = url;
      this._method = method;
      originalOpen.apply(this, arguments);
    };

    XMLHttpRequest.prototype.send = function(data) {
      this.addEventListener('load', () => {
        this.handleResponse(this);
      });

      originalSend.apply(this, arguments);
    };
  }

  interceptFetch() {
    const originalFetch = window.fetch;

    window.fetch = async function(...args) {
      const response = await originalFetch.apply(this, args);

      // Clone response để không ảnh hưởng đến request gốc
      const clonedResponse = response.clone();
      this.handleFetchResponse(clonedResponse, args[0]);

      return response;
    };
  }

  async handleFetchResponse(response, url) {
    try {
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        const data = await response.json();
        this.processResponse(data, url);
      }
    } catch (error) {
      console.warn('Cookie analysis interceptor error:', error);
    }
  }

  handleResponse(xhr) {
    try {
      if (xhr.getResponseHeader('content-type')?.includes('application/json')) {
        const data = JSON.parse(xhr.responseText);
        this.processResponse(data, xhr._url);
      }
    } catch (error) {
      console.warn('Cookie analysis interceptor error:', error);
    }
  }

  processResponse(data, url) {
    // Kiểm tra xem response có phải là cookie analysis data không
    if (this.isCookieAnalysisData(data)) {
      this.handleCookieAnalysis(data, url);
    }
  }

  isCookieAnalysisData(data) {
    // Kiểm tra structure của cookie analysis response
    return data &&
           typeof data === 'object' &&
           ('compliance_score' in data ||
            'total_issues' in data ||
            'policy_cookies_count' in data ||
            'actual_cookies_count' in data);
  }

  handleCookieAnalysis(analysisData, url) {
    // Trigger warning system
    // CookieWarningSystem will be defined later
    // For now, just log the analysis data
    console.log('Cookie analysis data received:', analysisData, url);
  }
}

// Initialize interceptor
const cookieInterceptor = new CookieAnalysisInterceptor();

export { cookieInterceptor, CookieAnalysisInterceptor };
