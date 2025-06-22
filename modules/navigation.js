// modules/navigation.js
export class Navigation {
  constructor() {
    this.screens = {
      'dashboard': document.getElementById('dashboard-screen'),
      'domains': document.getElementById('domain-screen'),
      'settings': document.getElementById('settings-screen'),
    };

    this.navButtons = {
      'dashboard': document.getElementById('nav-dashboard'),
      'domains': document.getElementById('nav-domains'),
      'settings': document.getElementById('nav-settings'),
    };

    this.currentScreen = 'dashboard';
  }

  init() {
    this.setupNavigationHandlers();
    this.showScreen('dashboard');
  }

  setupNavigationHandlers() {
    // Add click handlers to nav buttons
    Object.entries(this.navButtons).forEach(([screenName, button]) => {
      if (button) {
        button.addEventListener('click', () => this.showScreen(screenName));
      }
    });
  }

  showScreen(screenName) {
    // Hide all screens
    Object.values(this.screens).forEach(screen => {
      if (screen) screen.style.display = 'none';
    });

    // Show the selected screen
    const targetScreen = this.screens[screenName];
    if (targetScreen) {
      targetScreen.style.display = 'block';
      this.currentScreen = screenName;
    }

    // Update nav buttons
    Object.entries(this.navButtons).forEach(([name, button]) => {
      if (button) {
        if (name === screenName) {
          button.classList.add('active');
        } else {
          button.classList.remove('active');
        }
      }
    });

    // Emit navigation change event
    if (window.appEventBus) {
      window.appEventBus.emit('navigationChange', screenName);
    }
  }

  getCurrentScreen() {
    return this.currentScreen;
  }
}
