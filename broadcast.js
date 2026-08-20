// Universal Popup Announcement Handler for TirzaTrim
(function() {
  const TT_SB_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
  const TT_SB_KEY = "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";

  function renderBroadcastModal(bc, seenKey) {
    let badgeColor = "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20";
    let icon = "📢";

    if (bc.category === 'Attention') {
      badgeColor = "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/20";
      icon = "⚠️";
    } else if (bc.category === 'Important Information') {
      badgeColor = "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20";
      icon = "ℹ️";
    }

    const modalHtml = `
      <div id="broadcastModal" class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4 animate-fade-in">
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative">
          <div class="flex items-center justify-between">
            <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeColor} flex items-center gap-1.5">
              <span>${icon}</span> ${bc.category || 'Announcement'}
            </span>
            <button onclick="dismissBroadcast('${seenKey}')" class="text-slate-400 hover:text-slate-900 dark:hover:text-white text-base w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center transition-colors">✕</button>
          </div>
          
          <div class="space-y-2">
            <h3 class="text-lg sm:text-xl font-black text-slate-900 dark:text-white leading-tight">${bc.title}</h3>
            <div class="text-xs sm:text-sm text-slate-600 dark:text-slate-300 leading-relaxed max-h-60 overflow-y-auto whitespace-pre-wrap">${bc.message}</div>
          </div>

          <div class="pt-2">
            <button onclick="dismissBroadcast('${seenKey}')" class="w-full py-3 bg-slate-900 hover:bg-slate-800 dark:bg-emerald-600 dark:hover:bg-emerald-500 text-white text-xs font-bold rounded-xl shadow-lg transition-all">
              Understood & Proceed
            </button>
          </div>
        </div>
      </div>
    `;

    const existing = document.getElementById('broadcastModal');
    if (existing) existing.remove();
    document.body.insertAdjacentHTML('beforeend', modalHtml);
  }

  window.dismissBroadcast = function(seenKey) {
    if (seenKey) sessionStorage.setItem(seenKey, 'true');
    const modal = document.getElementById('broadcastModal');
    if (modal) modal.remove();
  };

  window.checkGlobalBroadcast = async function(targetRole) {
    const path = window.location.pathname.toLowerCase();

    // 1. NEVER show popups inside Admin / Management portals
    if (path.includes('admin') || path.includes('head') || path.includes('hos')) {
      return;
    }

    // 2. Accurate Portal Role Mapping
    let role = targetRole;
    if (!role) {
      if (path.includes('doctor')) {
        role = 'doctor';
      } else if (path.includes('distributor')) {
        role = 'distributor';
      } else if (path.includes('team')) {
        role = 'team';
      } else if (path.includes('order') || path.includes('feedback') || path.includes('patient') || path === '/' || path.includes('index')) {
        role = 'patient';
      }
    }

    if (!role) return;

    try {
      const response = await fetch(`${TT_SB_URL}/rest/v1/broadcasts?is_active=eq.true&order=created_at.desc`, {
        headers: {
          'apikey': TT_SB_KEY,
          'Authorization': `Bearer ${TT_SB_KEY}`
        }
      });

      if (!response.ok) return;
      const broadcasts = await response.json();
      if (!broadcasts || broadcasts.length === 0) return;

      const now = new Date();

      const activeBroadcast = broadcasts.find(b => {
        let audience = b.target_audience;
        if (typeof audience === 'string') {
          try { audience = JSON.parse(audience); } catch(e) { audience = [audience]; }
        }
        if (!Array.isArray(audience)) audience = [audience];

        // Check if current role matches
        const matchesRole = audience.includes(role) || audience.includes('all');
        if (!matchesRole) return false;

        // Start time check
        if (b.start_time && new Date(b.start_time) > now) return false;

        // Expiry check
        if (b.expires_at && new Date(b.expires_at) <= now) return false;

        return true;
      });

      if (!activeBroadcast) return;

      const seenKey = `tt_seen_broadcast_${activeBroadcast.id}`;
      if (sessionStorage.getItem(seenKey)) return;

      if (document.body) {
        renderBroadcastModal(activeBroadcast, seenKey);
      } else {
        window.addEventListener('DOMContentLoaded', () => renderBroadcastModal(activeBroadcast, seenKey));
      }
    } catch (err) {
      console.error("Broadcast check error:", err);
    }
  };

  // Run automatically when the DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => window.checkGlobalBroadcast());
  } else {
    window.checkGlobalBroadcast();
  }
})();
