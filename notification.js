// Universal TirzaTrim Live Push & In-App Notification System
(function() {
  const TT_SB_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
  const TT_SB_KEY = "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";

  let rtClient = null;

  // Auto-register Service Worker
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(e => console.warn('SW notice:', e));
  }

  function ensureSupabaseClient(callback) {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      if (!rtClient) {
        rtClient = window.supabase.createClient(TT_SB_URL, TT_SB_KEY, {
          realtime: { params: { eventsPerSecond: 10 } }
        });
      }
      callback(rtClient);
      return;
    }

    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = () => {
      rtClient = window.supabase.createClient(TT_SB_URL, TT_SB_KEY, {
        realtime: { params: { eventsPerSecond: 10 } }
      });
      callback(rtClient);
    };
    document.head.appendChild(s);
  }

  // In-App Toast Banner
  function showInAppToast(title, body) {
    let container = document.getElementById('tt-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tt-toast-container';
      container.className = 'fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[9999] space-y-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'p-4 rounded-2xl bg-slate-900/95 text-white border border-emerald-500/30 shadow-2xl backdrop-blur-md flex items-start gap-3 pointer-events-auto transition-all transform translate-y-[-20px] opacity-0';
    toast.innerHTML = `
      <div class="text-2xl">🔔</div>
      <div class="flex-1">
        <div class="text-xs font-black text-emerald-400 uppercase tracking-wide">${title}</div>
        <div class="text-xs text-slate-200 mt-0.5 leading-snug">${body}</div>
      </div>
      <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-white text-xs font-bold px-1">✕</button>
    `;

    container.appendChild(toast);

    setTimeout(() => {
      toast.classList.remove('translate-y-[-20px]', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    }, 10);

    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-[-20px]');
      setTimeout(() => toast.remove(), 300);
    }, 6000);
  }

  // Trigger Native Push Notification + Toast
  window.triggerPushNotification = async function(title, body, url = '/', channelType = null) {
    showInAppToast(title, body);

    const isMasterEnabled = localStorage.getItem('tt_notif_enabled') === 'true';
    if (!isMasterEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    if (channelType) {
      const channelPref = localStorage.getItem(`tt_notif_${channelType}`);
      if (channelPref === 'false') return;
    }

    const options = {
      body: body,
      icon: '/logo.png',
      badge: '/logo.png',
      vibrate: [200, 100, 200],
      tag: 'tt-alert-' + Date.now(),
      renotify: true,
      data: { url: url }
    };

    if ('serviceWorker' in navigator) {
      try {
        const reg = await navigator.serviceWorker.ready;
        if (reg && reg.showNotification) {
          await reg.showNotification(title, options);
          return;
        }
      } catch (e) {}
    }

    try {
      new Notification(title, options);
    } catch (e) {}
  };

  // Main Realtime Setup
  window.initTirzaTrimRealtime = function() {
    ensureSupabaseClient((sb) => {
      const path = window.location.pathname.toLowerCase();
      const isZSM = path.includes('admin');
      const isRep = path.includes('team');
      const currentRep = JSON.parse(sessionStorage.getItem('tt_current_rep') || 'null');

      const channelName = 'public-orders-' + Math.floor(Math.random() * 1000);
      
      sb.channel(channelName)
        .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
          const o = payload.new;
          console.log('⚡ Live order event received:', o);

          if (isRep && currentRep) {
            if (!o.rep_code || o.rep_code === currentRep.territory_code) {
              triggerPushNotification(
                '✨ New Patient Order Enrolled',
                `${o.patient_name || 'Patient'} (${o.prescribed_dose || '5mg'}) enrolled in territory ${o.rep_code || 'Direct'}`,
                '/team.html',
                'orders'
              );
            }
          } else if (isZSM) {
            triggerPushNotification(
              '✨ New Zone Order',
              `${o.patient_name || 'Patient'} (${o.rep_code || 'Direct'}) - ${o.prescribed_dose || '5mg'}`,
              '/admin.html',
              'orders'
            );
          } else {
            triggerPushNotification(
              '✨ New Order Enrolled',
              `${o.patient_name || 'Patient'} (${o.city || 'Pakistan'}) - ${o.prescribed_dose || '5mg'}`,
              window.location.pathname,
              'orders'
            );
          }
        })
        .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
          const o = payload.new;
          triggerPushNotification('📦 Order Updated', `${o.patient_name || 'Order #' + o.order_id} ➔ ${o.status}`, window.location.pathname, 'orders');
        })
        .subscribe((status) => {
          console.log('🟢 Supabase Realtime Status:', status);
        });
    });
  };

  // Immediate Start
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initTirzaTrimRealtime);
  } else {
    window.initTirzaTrimRealtime();
  }
})();
