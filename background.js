
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
