// modules/navigation.js
export class Navigation {
  constructor() {
    this.screens = {
      'dashboard': document.getElementById('dashboard-screen'),
      'cookies': document.getElementById('cookies-screen'),
      'domains': document.getElementById('domain-screen'),
      'settings': document.getElementById('settings-screen'),
    };

    this.navButtons = {
      'dashboard': document.getElementById('nav-dashboard'),
      'cookies': document.getElementById('nav-cookies'),
      'domains': document.getElementById('nav-domains'),
      'settings': document.getElementById('nav-settings'),
    };

    this.currentScreen = 'dashboard';
  }

  init() {
    this.setupNavigationHandlers();
    this.showScreen('dashboard'); // Show default screen
  }

  setupNavigationHandlers() {
    // Add click handlers to nav buttons
    Object.entries(this.navButtons).forEach(([screenName, button]) => {
      if (button) {
        button.addEventListener('click', () => this.showScreen(screenName));
      }
    });

    // Header settings button
    const headerSettings = document.getElementById('header-settings');
    if (headerSettings) {
      headerSettings.addEventListener('click', () => this.showScreen('settings'));
    }

    // View all violations button on dashboard
    const viewAllViolationsButton = document.querySelector('.panel-footer button');
    if (viewAllViolationsButton) {
      viewAllViolationsButton.addEventListener('click', () => {
        this.showScreen('cookies');
        this.applyViolationsFilter();
      });
    }
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

  applyViolationsFilter() {
    // Helper method to apply violations filter when navigating to cookies screen
    setTimeout(() => {
      const violationsFilterButton = document.querySelector('.filter-button[data-filter="violations"]');
      if (violationsFilterButton) {
        document.querySelectorAll('.filter-button').forEach(btn => btn.classList.remove('active'));
        violationsFilterButton.classList.add('active');

        // Trigger the filter
        if (window.appEventBus) {
          window.appEventBus.emit('applyFilter', 'violations');
        }
      }
    }, 100);
  }

  getCurrentScreen() {
    return this.currentScreen;
  }
}
