function simulateCookies() {
  // Example cookies for testing purposes
  return [
    {
      name: "_ga",
      domain: "example.com",
      expirationDate: (Date.now() + 30 * 24 * 60 * 60 * 1000) / 1000, // 30 days in the future
      path: "/"
    },
    {
      name: "JSESSIONID",
      domain: "example.com",
      // No expirationDate means it's a true session cookie
      path: "/"
    },
    {
      name: "test_session_cookie",
      domain: "example.com",
      expirationDate: (Date.now() + 2 * 60 * 60 * 1000) / 1000, // 2 hours in the future
      path: "/"
    }
  ];
}

// Mock the chrome API for testing
function setupMockChromeAPI() {
  window.chrome = {
    cookies: {
      getAll: (options, callback) => {
        callback(simulateCookies());
      }
    },
    tabs: {
      query: (queryInfo, callback) => {
        callback([{
          url: "https://example.com/page"
        }]);
      }
    },
    runtime: {
      onMessage: {
        addListener: () => {},
      },
      onInstalled: {
        addListener: () => {},
      },
      sendMessage: (message, callback) => {
        // Simulate the message handling logic here
        if (message.action === "validate") {
          // Call the validation logic directly for testing
          const mockCookies = simulateCookies();
          const mockCookieSpecs = JSON.parse(cookieSpecsJson);

          const violations = mockCookies
            .filter(cookie => {
              const isSession = mockCookieSpecs.specific.some(
                spec => spec.name === cookie.name &&
                spec.attribute === "retention" &&
                spec.value.toLowerCase() === "session"
              );

              const persists = cookie.expirationDate &&
                ((cookie.expirationDate * 1000 - Date.now()) / (1000 * 60 * 60) > 24);

              return isSession && persists;
            })
            .map(cookie => ({
              name: cookie.name,
              domain: cookie.domain,
              expirationDate: new Date(cookie.expirationDate * 1000).toISOString(),
              message: "Cookie is declared as a 'session' cookie but persists longer than 24 hours"
            }));

          callback({violations});
        }
      }
    }
  };
}
