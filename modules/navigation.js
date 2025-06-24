export class Navigation {
    constructor() {
      this.currentScreen = "dashboard";
      this.headerButton = document.getElementById("header-settings");
      this.settingsIcon = document.getElementById("settings-icon");
      this.closeIcon = document.getElementById("close-icon");
      this.dashboardScreen = document.getElementById("dashboard-screen");
      this.settingsScreen = document.getElementById("settings-screen");
        // Debug: Kiểm tra xem các element có tồn tại không
      alert(`Header button: ${this.headerButton}`);
      alert(`Settings icon: ${this.settingsIcon}`);
      alert(`Close icon: ${this.closeIcon}`);
      alert(`Dashboard screen: ${this.dashboardScreen}`);
      alert(`Settings screen: ${this.settingsScreen}`);
      this.init();
    }

    init() {
      this.setupEventListeners();
      this.showDashboard();
    }

    setupEventListeners() {
      this.headerButton.addEventListener("click", () => {
        this.toggleScreen();
      });
    }

    toggleScreen() {
      if (this.currentScreen === "dashboard") {
        this.showSettings();
      } else {
        this.showDashboard();
      }
    }

    showSettings() {
      this.currentScreen = "settings";
      this.dashboardScreen.classList.remove('active');
      this.settingsScreen.classList.add('active');

      this.settingsIcon.style.display = "none";
      this.closeIcon.style.display = "block";
    }

    showDashboard() {
      this.currentScreen = "dashboard";
      this.settingsScreen.classList.remove('active');
      this.dashboardScreen.classList.add('active');

      this.closeIcon.style.display = "none";
      this.settingsIcon.style.display = "block";
    }
}
