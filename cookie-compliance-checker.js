// Cookie Compliance Checker JavaScript

function showSection(sectionId) {
    // Hide all sections
    const sections = document.querySelectorAll('.content-section');
    sections.forEach(section => {
        section.classList.remove('active');
    });

    // Remove active class from all nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.classList.remove('active');
    });

    // Show selected section
    const targetSection = document.getElementById(sectionId);
    if (targetSection) {
        targetSection.classList.add('active');
    }

    // Add active class to corresponding nav item
    const navItem = document.querySelector(`[data-section="${sectionId}"]`);
    if (navItem) {
        navItem.classList.add('active');
    }
}

function getSectionIndex(sectionId) {
    switch (sectionId) {
        case 'welcome': return 1;
        case 'results': return 2;
        case 'settings': return 3;
        case 'privacy': return 4;
        default: return 1;
    }
}

function toggleSetting(element) {
    element.classList.toggle('active');

    // Add a small vibration effect when toggling
    element.style.transform = 'scale(0.95)';
    setTimeout(() => {
        element.style.transform = 'scale(1)';
    }, 100);
}

// Smooth scroll function for better UX
function smoothScrollToSection(sectionId) {
    const section = document.getElementById(sectionId);
    if (section) {
        section.scrollIntoView({
            behavior: 'smooth',
            block: 'start'
        });
    }
}

// Initialize the page
document.addEventListener('DOMContentLoaded', function() {
    console.log('Cookie Compliance Checker loaded');

    // Attach event listeners to nav items
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const sectionId = this.getAttribute('data-section');
            if (sectionId) {
                showSection(sectionId);
                smoothScrollToSection(sectionId);
            }
        });
    });

    // Add hover effects to result cards
    const resultCards = document.querySelectorAll('.result-card');
    resultCards.forEach(card => {
        card.addEventListener('mouseenter', function() {
            this.style.transform = 'translateY(-2px)';
        });

        card.addEventListener('mouseleave', function() {
            this.style.transform = 'translateY(0)';
        });
    });

    // Add click animation to buttons
    const buttons = document.querySelectorAll('.btn-primary');
    buttons.forEach(button => {
        button.addEventListener('click', function() {
            this.style.transform = 'scale(0.98)';
            setTimeout(() => {
                this.style.transform = 'scale(1)';
            }, 150);
        });
    });

    // Check if this is from extension installation
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get('installed') === 'true') {
        showSection('welcome');
    } else {
        showSection('welcome'); // Show welcome section by default
    }

    // Add keyboard navigation
    document.addEventListener('keydown', function(e) {
        if (e.ctrlKey || e.metaKey) {
            switch(e.key) {
                case '1':
                    e.preventDefault();
                    showSection('welcome');
                    break;
                case '2':
                    e.preventDefault();
                    showSection('results');
                    break;
                case '3':
                    e.preventDefault();
                    showSection('settings');
                    break;
                case '4':
                    e.preventDefault();
                    showSection('privacy');
                    break;
            }
        }
    });

    // Animate status badges on load
    setTimeout(() => {
        const statusBadges = document.querySelectorAll('.status-badge');
        statusBadges.forEach((badge, index) => {
            setTimeout(() => {
                badge.style.opacity = '0';
                badge.style.transform = 'translateY(10px)';
                badge.style.transition = 'all 0.3s ease';

                setTimeout(() => {
                    badge.style.opacity = '1';
                    badge.style.transform = 'translateY(0)';
                }, 50);
            }, index * 100);
        });
    }, 500);

    // Add progress indicator for settings
    const toggleSwitches = document.querySelectorAll('.toggle-switch');
    toggleSwitches.forEach(toggle => {
        toggle.addEventListener('click', function() {
            // Add ripple effect
            const ripple = document.createElement('span');
            ripple.style.position = 'absolute';
            ripple.style.borderRadius = '50%';
            ripple.style.background = 'rgba(255, 255, 255, 0.6)';
            ripple.style.transform = 'scale(0)';
            ripple.style.animation = 'ripple 0.6s linear';
            ripple.style.left = '50%';
            ripple.style.top = '50%';
            ripple.style.width = '20px';
            ripple.style.height = '20px';
            ripple.style.marginLeft = '-10px';
            ripple.style.marginTop = '-10px';

            this.style.position = 'relative';
            this.appendChild(ripple);

            setTimeout(() => {
                ripple.remove();
            }, 600);
        });
    });

    // Add CSS for ripple animation
    const style = document.createElement('style');
    style.textContent = `
        @keyframes ripple {
            to {
                transform: scale(2);
                opacity: 0;
            }
        }
    `;
    document.head.appendChild(style);
});

// Export functions for external use
window.CookieChecker = {
    showSection,
    toggleSetting,
    getSectionIndex
};
