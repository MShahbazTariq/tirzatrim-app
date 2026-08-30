// notification-center.js
// Reusable notification system for all portals

class NotificationCenter {
    constructor(options = {}) {
        this.userId = options.userId || 'guest';
        this.userRole = options.userRole || 'rep';
        this.pollInterval = options.pollInterval || 30000;
        this.containerId = options.containerId || 'notificationCenter';
        this.badgeId = options.badgeId || 'notificationBadge';
        this.dropdownId = options.dropdownId || 'notificationDropdown';
        this.notifications = [];
        this.unreadCount = 0;
        this.isOpen = false;
        this.channel = null;
        this.currentFilter = 'all';
        this.init();
    }

    async init() {
        this.createNotificationUI();
        await this.fetchNotifications();
        this.subscribeToRealtime();
        this.startPolling();
    }

    createNotificationUI() {
        let container = document.getElementById(this.containerId);
        if (!container) {
            container = document.createElement('div');
            container.id = this.containerId;
            container.className = 'relative inline-block';
            const header = document.querySelector('header') || document.body;
            header.appendChild(container);
        }

        container.innerHTML = `
            <button onclick="window.notificationCenter.toggleDropdown()" 
                    class="relative p-2 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all" 
                    id="notificationBellBtn"
                    title="Notifications">
                <span class="text-xl">🔔</span>
                <span id="${this.badgeId}" 
                      class="absolute -top-1 -right-1 min-w-[20px] h-5 px-1.5 rounded-full bg-rose-500 text-white text-[10px] font-bold flex items-center justify-center hidden">
                    0
                </span>
            </button>
            
            <div id="${this.dropdownId}" 
                 class="hidden absolute right-0 mt-2 w-[420px] max-h-[500px] bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-2xl overflow-hidden z-50">
                
                <div class="flex items-center justify-between px-4 py-3 border-b border-slate-200 dark:border-slate-800">
                    <span class="font-bold text-sm text-slate-900 dark:text-white">Notifications</span>
                    <div class="flex items-center gap-2">
                        <button onclick="window.notificationCenter.markAllAsRead()" 
                                class="text-xs text-slate-500 hover:text-slate-700 dark:hover:text-slate-300 transition-colors">
                            Mark all read
                        </button>
                        <button onclick="window.notificationCenter.clearAll()" 
                                class="text-xs text-rose-500 hover:text-rose-600 transition-colors">
                            Clear all
                        </button>
                    </div>
                </div>
                
                <div class="flex gap-1 px-4 py-2 border-b border-slate-200 dark:border-slate-800 text-xs overflow-x-auto">
                    <button onclick="window.notificationCenter.filterNotifications('all')" 
                            data-filter="all" 
                            class="filter-btn px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold transition-all whitespace-nowrap">
                        All
                    </button>
                    <button onclick="window.notificationCenter.filterNotifications('order')" 
                            data-filter="order" 
                            class="filter-btn px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all whitespace-nowrap">
                        📦 Orders
                    </button>
                    <button onclick="window.notificationCenter.filterNotifications('feedback')" 
                            data-filter="feedback" 
                            class="filter-btn px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all whitespace-nowrap">
                        ⭐ Feedback
                    </button>
                    <button onclick="window.notificationCenter.filterNotifications('broadcast')" 
                            data-filter="broadcast" 
                            class="filter-btn px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all whitespace-nowrap">
                        📢 Broadcast
                    </button>
                    <button onclick="window.notificationCenter.filterNotifications('system')" 
                            data-filter="system" 
                            class="filter-btn px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all whitespace-nowrap">
                        ⚙️ System
                    </button>
                </div>
                
                <div id="notificationList" class="overflow-y-auto max-h-[340px] divide-y divide-slate-100 dark:divide-slate-800">
                    <div class="px-4 py-8 text-center text-slate-400 text-sm">
                        No notifications yet
                    </div>
                </div>
            </div>
        `;
    }

    async fetchNotifications() {
        if (!this.userId) return;

        try {
            const { data, error } = await supabase
                .from('notifications')
                .select('*')
                .eq('user_id', this.userId)
                .order('created_at', { ascending: false })
                .limit(50);

            if (error) throw error;

            this.notifications = data || [];
            this.unreadCount = this.notifications.filter(n => !n.is_read).length;
            this.updateBadge();
            this.renderNotifications();
            
            return this.notifications;
        } catch (err) {
            console.error('Error fetching notifications:', err);
            return [];
        }
    }

    subscribeToRealtime() {
        if (!this.userId) return;

        this.channel = supabase
            .channel('public:notifications')
            .on(
                'postgres_changes',
                {
                    event: 'INSERT',
                    schema: 'public',
                    table: 'notifications',
                    filter: `user_id=eq.${this.userId}`
                },
                (payload) => {
                    this.notifications.unshift(payload.new);
                    if (!payload.new.is_read) {
                        this.unreadCount++;
                        this.updateBadge();
                        this.playNotificationSound();
                        this.showToast(payload.new);
                    }
                    this.renderNotifications();
                }
            )
            .subscribe();
    }

    startPolling() {
        setInterval(() => {
            this.fetchNotifications();
        }, this.pollInterval);
    }

    toggleDropdown() {
        this.isOpen = !this.isOpen;
        const dropdown = document.getElementById(this.dropdownId);
        if (dropdown) {
            dropdown.classList.toggle('hidden');
        }
    }

    renderNotifications(filter = null) {
        const list = document.getElementById('notificationList');
        if (!list) return;

        const activeFilter = filter || this.currentFilter;
        let filtered = this.notifications;
        if (activeFilter !== 'all') {
            filtered = filtered.filter(n => n.type === activeFilter);
        }

        if (filtered.length === 0) {
            list.innerHTML = `
                <div class="px-4 py-8 text-center">
                    <div class="text-3xl mb-2">📭</div>
                    <div class="text-slate-400 text-sm">No ${activeFilter === 'all' ? '' : activeFilter} notifications</div>
                </div>
            `;
            return;
        }

        list.innerHTML = filtered.map(notification => `
            <div class="notification-item px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors cursor-pointer ${!notification.is_read ? 'bg-emerald-50 dark:bg-emerald-950/20 border-l-4 border-emerald-500' : ''}"
                 onclick="window.notificationCenter.markAsRead('${notification.id}')"
                 data-id="${notification.id}">
                
                <div class="flex items-start gap-3">
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                            <span class="font-semibold text-sm text-slate-900 dark:text-white truncate">
                                ${this.escapeHtml(notification.title)}
                            </span>
                            ${notification.priority === 'high' ? 
                                `<span class="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 text-[10px] font-bold">URGENT</span>` : 
                                ''}
                        </div>
                        <p class="text-sm text-slate-600 dark:text-slate-300 mt-0.5 line-clamp-2">
                            ${this.escapeHtml(notification.message)}
                        </p>
                        <div class="flex items-center gap-3 mt-1.5">
                            <span class="text-[10px] text-slate-400">
                                ${this.formatTime(notification.created_at)}
                            </span>
                            <span class="text-[10px] px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400">
                                ${notification.type}
                            </span>
                        </div>
                        ${notification.link ? 
                            `<a href="${notification.link}" class="text-xs text-emerald-600 dark:text-emerald-400 hover:underline mt-1 inline-block">
                                View Details →
                            </a>` : 
                            ''}
                    </div>
                    ${!notification.is_read ? 
                        `<span class="w-2 h-2 rounded-full bg-emerald-500 flex-shrink-0 mt-2"></span>` : 
                        ''}
                </div>
            </div>
        `).join('');
    }

    async markAsRead(id) {
        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .eq('id', id)
                .eq('user_id', this.userId);

            if (error) throw error;

            const notification = this.notifications.find(n => n.id === id);
            if (notification && !notification.is_read) {
                notification.is_read = true;
                this.unreadCount--;
                this.updateBadge();
                this.renderNotifications();
            }
        } catch (err) {
            console.error('Error marking as read:', err);
        }
    }

    async markAllAsRead() {
        const unreadIds = this.notifications.filter(n => !n.is_read).map(n => n.id);
        if (unreadIds.length === 0) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .update({ is_read: true })
                .in('id', unreadIds)
                .eq('user_id', this.userId);

            if (error) throw error;

            this.notifications.forEach(n => n.is_read = true);
            this.unreadCount = 0;
            this.updateBadge();
            this.renderNotifications();
        } catch (err) {
            console.error('Error marking all as read:', err);
        }
    }

    async clearAll() {
        if (this.notifications.length === 0) return;
        if (!confirm('Clear all notifications?')) return;

        try {
            const { error } = await supabase
                .from('notifications')
                .delete()
                .eq('user_id', this.userId);

            if (error) throw error;

            this.notifications = [];
            this.unreadCount = 0;
            this.updateBadge();
            this.renderNotifications();
        } catch (err) {
            console.error('Error clearing notifications:', err);
        }
    }

    filterNotifications(filter) {
        this.currentFilter = filter;
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.className = 'filter-btn px-3 py-1 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 hover:bg-slate-200 dark:hover:bg-slate-700 transition-all whitespace-nowrap';
            if (btn.dataset.filter === filter) {
                btn.className = 'filter-btn px-3 py-1 rounded-lg bg-emerald-600 text-white font-semibold transition-all whitespace-nowrap';
            }
        });
        this.renderNotifications(filter);
    }

    updateBadge() {
        const badge = document.getElementById(this.badgeId);
        if (!badge) return;

        if (this.unreadCount > 0) {
            badge.classList.remove('hidden');
            badge.textContent = this.unreadCount > 99 ? '99+' : this.unreadCount;
        } else {
            badge.classList.add('hidden');
        }
    }

    showToast(notification) {
        const toastContainer = document.getElementById('toastContainer') || this.createToastContainer();
        
        const toast = document.createElement('div');
        toast.className = `flex items-center gap-3 px-4 py-3 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-lg animate-slide-in max-w-sm`;
        toast.innerHTML = `
            <span class="text-2xl">
                ${notification.type === 'order' ? '📦' : 
                  notification.type === 'feedback' ? '⭐' : 
                  notification.type === 'broadcast' ? '📢' : '🔔'}
            </span>
            <div class="flex-1 min-w-0">
                <div class="font-semibold text-sm text-slate-900 dark:text-white truncate">${this.escapeHtml(notification.title)}</div>
                <div class="text-xs text-slate-600 dark:text-slate-400 truncate">${this.escapeHtml(notification.message)}</div>
            </div>
            <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600">✕</button>
        `;
        
        toastContainer.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, 5000);
    }

    createToastContainer() {
        const container = document.createElement('div');
        container.id = 'toastContainer';
        container.className = 'fixed bottom-20 right-4 z-50 space-y-2 max-w-sm';
        document.body.appendChild(container);
        return container;
    }

    playNotificationSound() {
        try {
            const audio = new Audio('data:audio/wav;base64,UklGRnoAAABXQVZFZm10IBAAAAABAAEAQB8AAEAfAAABAAgAZGF0YQoAAACBhYqFhYaFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhYWFhQ==');
            audio.volume = 0.3;
            audio.play().catch(() => {});
        } catch (err) {}
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(timestamp) {
        const date = new Date(timestamp);
        const now = new Date();
        const diff = Math.floor((now - date) / 1000);
        
        if (diff < 60) return 'Just now';
        if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
        if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
        if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
        
        return date.toLocaleDateString();
    }

    destroy() {
        if (this.channel) {
            supabase.removeChannel(this.channel);
        }
    }
}

// Make globally available
window.NotificationCenter = NotificationCenter;

// Add CSS for animations
const style = document.createElement('style');
style.textContent = `
    @keyframes slideIn {
        from { transform: translateX(100%); opacity: 0; }
        to { transform: translateX(0); opacity: 1; }
    }
    .animate-slide-in {
        animation: slideIn 0.3s ease-out;
    }
    .line-clamp-2 {
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
        overflow: hidden;
    }
`;
document.head.appendChild(style);
