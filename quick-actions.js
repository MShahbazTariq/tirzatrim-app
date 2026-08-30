// quick-actions.js
// Floating quick action bar

class QuickActions {
    constructor(options = {}) {
        this.actions = options.actions || this.getDefaultActions();
        this.position = options.position || 'bottom-right';
        this.containerId = options.containerId || 'quickActions';
        this.init();
    }

    getDefaultActions() {
        return [
            {
                icon: '📦',
                label: 'New Order',
                action: () => window.location.href = '/order.html'
            },
            {
                icon: '🩺',
                label: 'Add Doctor',
                action: () => document.getElementById('addDoctorModal')?.classList.remove('hidden')
            },
            {
                icon: '📊',
                label: 'Analytics',
                action: () => window.switchTab?.('analytics')
            },
            {
                icon: '📢',
                label: 'Broadcast',
                action: () => window.switchTab?.('broadcasts')
            }
        ];
    }

    init() {
        const container = document.createElement('div');
        container.id = this.containerId;
        container.className = 'fixed z-40 flex flex-col gap-2';
        
        // Position
        if (this.position === 'bottom-right') {
            container.className += ' bottom-24 right-4';
        } else if (this.position === 'bottom-left') {
            container.className += ' bottom-24 left-4';
        } else if (this.position === 'top-right') {
            container.className += ' top-24 right-4';
        } else {
            container.className += ' bottom-24 right-4';
        }

        // Create floating button
        const mainBtn = document.createElement('button');
        mainBtn.className = 'w-14 h-14 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white text-2xl shadow-lg shadow-emerald-600/30 transition-all flex items-center justify-center';
        mainBtn.innerHTML = '⚡';
        mainBtn.onclick = () => this.toggleMenu();
        container.appendChild(mainBtn);

        // Create actions menu (hidden initially)
        const menu = document.createElement('div');
        menu.id = 'quickActionsMenu';
        menu.className = 'hidden absolute bottom-16 right-0 flex flex-col gap-2';
        
        this.actions.forEach(action => {
            const btn = document.createElement('button');
            btn.className = 'px-4 py-2.5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl shadow-lg text-sm font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-50 dark:hover:bg-slate-800 transition-all flex items-center gap-2 whitespace-nowrap';
            btn.innerHTML = `${action.icon} ${action.label}`;
            btn.onclick = action.action;
            menu.appendChild(btn);
        });

        container.appendChild(menu);
        document.body.appendChild(container);

        // Close menu when clicking outside
        document.addEventListener('click', (e) => {
            if (!container.contains(e.target)) {
                this.closeMenu();
            }
        });
    }

    toggleMenu() {
        const menu = document.getElementById('quickActionsMenu');
        if (menu) {
            menu.classList.toggle('hidden');
        }
    }

    closeMenu() {
        const menu = document.getElementById('quickActionsMenu');
        if (menu) {
            menu.classList.add('hidden');
        }
    }
}

window.QuickActions = QuickActions;
