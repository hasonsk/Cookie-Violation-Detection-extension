class App {
    constructor(currentPage = 'results') {
        this.currentPage = currentPage;
        this.contentArea = document.getElementById('content-area');
        this.init();
    }

    init() {
        this.setupNavigation();
        this.loadPage(this.currentPage);
    }

    setupNavigation() {
        const navItems = document.querySelectorAll('.nav-item');

        navItems.forEach(item => {
            const page = item.dataset.page;

            // Set active state based on currentPage
            if (page === this.currentPage) {
                item.classList.add('active');
            } else {
                item.classList.remove('active');
            }

            item.addEventListener('click', (e) => {
                e.preventDefault();

                // Update active state
                navItems.forEach(nav => nav.classList.remove('active'));
                item.classList.add('active');

                // Load page
                this.loadPage(page);
            });
        });
    }

    async loadPage(pageName) {
        this.contentArea.innerHTML = '<div class="loading">Đang tải...</div>';

        try {
            // Load HTML content
            const htmlResponse = await fetch(`html/${pageName}.html`);
            const htmlContent = await htmlResponse.text();

            // Load CSS if exists
            this.loadCSS(pageName);

            // Update content
            this.contentArea.innerHTML = htmlContent;

            // Load and execute JavaScript
            await this.loadJS(pageName);

            this.currentPage = pageName;

        } catch (error) {
            console.error('Error loading page:', error);
            this.contentArea.innerHTML = `
                <div class="error-message">
                    <h2>Lỗi tải trang</h2>
                    <p>Không thể tải nội dung trang ${pageName}. Vui lòng thử lại.</p>
                </div>
            `;
        }
    }

    loadCSS(pageName) {
        // Remove existing page-specific CSS
        const existingCSS = document.querySelector(`link[data-page]`);
        if (existingCSS) {
            existingCSS.remove();
        }

        // Add new CSS
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = `styles/${pageName}.css`;
        link.dataset.page = pageName;
        link.onerror = () => {
            console.warn(`CSS file for ${pageName} not found`);
        };
        document.head.appendChild(link);
    }

    async loadJS(pageName) {
        try {
            console.log(`Loading JS for page: ${pageName}`);
            // Remove existing page script
            const existingScript = document.querySelector(`script[data-page]`);
            if (existingScript) {
                existingScript.remove();
            }

            // Load new script
            const script = document.createElement('script');
            script.src = `javascript/${pageName}.js`;
            script.dataset.page = pageName;
            script.onerror = () => {
                console.warn(`JS file for ${pageName} not found`);
            };

            return new Promise((resolve) => {
                script.onload = resolve;
                script.onerror = resolve; // Resolve even on error to continue
                document.body.appendChild(script);
            });

        } catch (error) {
            console.warn(`Error loading JS for ${pageName}:`, error);
        }
    }
}

// Initialize app when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    new App();
});
