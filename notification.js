// Universal TirzaTrim Live Push & In-App Notification System (Realtime + 24/7 Web Push)
(function() {
  const TT_SB_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
  const TT_SB_KEY = "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";
  const PUBLIC_VAPID_KEY = "BFhZtq8G_Z9L5uTqBv3M7X0oO1pQsK2n6r4W9v8yX7zP2kLmNoPqRsTuVwXyZ1aBcDeFgHiJkLmNoPqRsTuVwX8";

  let rtClient = null;

  // Auto-register Service Worker & Message Bridge
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch(e => console.warn('SW notice:', e));
    
    navigator.serviceWorker.addEventListener('message', (event) => {
      if (event.data?.type === 'TT_DATABASE_MUTATED') {
        if (typeof window.fetchRepOrders === 'function') window.fetchRepOrders();
        if (typeof window.fetchManagerOrders === 'function') window.fetchManagerOrders();
        if (typeof window.fetchEverything === 'function') window.fetchEverything();
        if (typeof window.fetchDistributorOrders === 'function') window.fetchDistributorOrders();
        if (typeof window.fetchDoctorOrders === 'function') window.fetchDoctorOrders();
      }
    });
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

  function urlBase64ToUint8Array(base64String) {
    const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
    const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
    const rawData = window.atob(base64);
    const outputArray = new Uint8Array(rawData.length);
    for (let i = 0; i < rawData.length; ++i) {
      outputArray[i] = rawData.charCodeAt(i);
    }
    return outputArray;
  }

  window.subscribeDeviceToPush = async function(sapId = null, role = null, territoryCode = null) {
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;

    try {
      if (Notification.permission !== 'granted') {
        await Notification.requestPermission();
      }

      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });
      }

      const subJson = sub.toJSON();

      ensureSupabaseClient(async (sb) => {
        await sb.from('push_subscriptions').upsert({
          sap_id: sapId ? String(sapId) : 'guest',
          role: role || 'admin',
          territory_code: (territoryCode || '').toUpperCase(),
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth
        }, { onConflict: 'endpoint' });
      });
    } catch (err) {
      console.warn('Push registration skipped:', err);
    }
  };

  // Guaranteed In-App DOM Toast (Bypasses Browser Notification Blocks)
  function showInAppToast(title, body) {
    let container = document.getElementById('tt-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tt-toast-container';
      container.className = 'fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[99999] space-y-2 pointer-events-none';
      document.body.appendChild(container);
    }

    const toast = document.createElement('div');
    toast.className = 'p-4 rounded-2xl bg-slate-900 text-white border border-emerald-500/50 shadow-2xl backdrop-blur-md flex items-start gap-3 pointer-events-auto transition-all transform translate-y-[-20px] opacity-0';
    toast.innerHTML = `
      <div class="text-2xl animate-bounce">🔔</div>
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
    }, 7000);
  }

  window.triggerPushNotification = async function(title, body, url = '/', channelType = null) {
    // Always fire visual DOM toast banner so it's guaranteed to be seen
    showInAppToast(title, body);

    if ('vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200]); } catch (e) {}
    }

    if (!('Notification' in window)) return;

    if (Notification.permission !== 'granted') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        return;
      }
    }

    if (Notification.permission === 'granted') {
      const options = {
        body: body,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200],
        tag: 'tt-alert-' + Date.now(),
        renotify: true,
        data: { url: url }
      };

      try {
        if ('serviceWorker' in navigator) {
          const readyReg = await navigator.serviceWorker.ready;
          if (readyReg && readyReg.showNotification) {
            await readyReg.showNotification(title, options);
            return;
          }
        }
        new Notification(title, options);
      } catch (e) {}
    }
  };

  window.initTirzaTrimRealtime = function() {
    ensureSupabaseClient((sb) => {
      const path = window.location.pathname.toLowerCase();
      const isZSM = path.includes('admin');
      const isRep = path.includes('team');
      const isHO = path.includes('headoffice') || path.includes('hos');
      const isDistributor = path.includes('distributor');

      const currentRep = JSON.parse(sessionStorage.getItem('tt_current_rep') || 'null');
      const currentManager = JSON.parse(localStorage.getItem('tt_current_manager') || sessionStorage.getItem('tt_current_manager') || 'null');

      // Auto request permission on first user interaction if default
      if (Notification.permission === 'default') {
        document.body.addEventListener('click', () => {
          Notification.requestPermission().catch(() => {});
        }, { once: true });
      }

      // Single Global Listener for Instant UI and Notification syncing
      sb.channel('public:system_wide_sync')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
          const o = payload.new || payload.old || {};
          console.log('⚡ [Global Sync Notification Event]', payload.eventType, o);

          if (typeof window.fetchRepOrders === 'function') window.fetchRepOrders(true);
          if (typeof window.fetchManagerOrders === 'function') window.fetchManagerOrders(true);
          if (typeof window.fetchEverything === 'function') window.fetchEverything(true);
          if (typeof window.fetchDistributorOrders === 'function') window.fetchDistributorOrders(true);
          if (typeof window.fetchDoctorOrders === 'function') window.fetchDoctorOrders(true);

          if (payload.eventType === 'INSERT') {
            const patientText = o.patient_name || 'Patient';
            const doseText = o.prescribed_dose || '5mg';
            const repText = o.rep_code || 'Direct';

            if (isRep) {
              window.triggerPushNotification('✨ New Territory Order', `${patientText} (${doseText}) assigned to ${repText}`, '/team.html', 'orders');
            } else if (isZSM) {
              window.triggerPushNotification('✨ New Zone Order', `${patientText} (${repText}) - ${doseText}`, '/admin.html', 'orders');
            } else if (isHO) {
              window.triggerPushNotification('✨ New National Order', `${patientText} in ${o.city || 'Pakistan'}`, '/headoffice.html', 'orders');
            } else if (isDistributor) {
              window.triggerPushNotification('📦 New Packing Required', `${patientText} - ${doseText} (${o.city || 'Local'})`, '/distributor.html', 'orders');
            } else {
              window.triggerPushNotification('✨ TirzaTrim Update', `${patientText} order registered successfully!`, window.location.pathname, 'orders');
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, () => {
          if (typeof window.fetchRepOrders === 'function') window.fetchRepOrders(true);
          if (typeof window.fetchManagerOrders === 'function') window.fetchManagerOrders(true);
          if (typeof window.fetchEverything === 'function') window.fetchEverything(true);
          if (typeof window.fetchDistributorOrders === 'function') window.fetchDistributorOrders(true);
          if (typeof window.fetchDoctorOrders === 'function') window.fetchDoctorOrders(true);
        })
        .subscribe();
    });
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initTirzaTrimRealtime);
  } else {
    window.initTirzaTrimRealtime();
  }
})();
