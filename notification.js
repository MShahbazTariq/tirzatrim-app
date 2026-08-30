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
        if (typeof window.fetchTerritoryDoctors === 'function') window.fetchTerritoryDoctors();
        if (typeof window.fetchTeamDoctors === 'function') window.fetchTeamDoctors();
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
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
      console.warn('Push not supported');
      return;
    }

    try {
      // Check if we already have a subscription for this device
      const reg = await navigator.serviceWorker.ready;
      let sub = await reg.pushManager.getSubscription();

      if (!sub) {
        // Request permission if not granted
        if (Notification.permission !== 'granted') {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') {
            console.warn('Notification permission denied');
            return;
          }
        }

        sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(PUBLIC_VAPID_KEY)
        });
      }

      const subJson = sub.toJSON();

      ensureSupabaseClient(async (sb) => {
        const { error } = await sb.from('push_subscriptions').upsert({
          sap_id: sapId ? String(sapId) : 'guest',
          role: role || 'admin',
          territory_code: (territoryCode || '').toUpperCase(),
          endpoint: subJson.endpoint,
          p256dh: subJson.keys.p256dh,
          auth: subJson.keys.auth,
          updated_at: new Date().toISOString()
        }, { onConflict: 'endpoint' });

        if (error) {
          console.warn('Push subscription save error:', error);
        } else {
          console.log('✅ Push subscription saved for:', sapId, role, territoryCode);
        }
      });
    } catch (err) {
      console.warn('Push registration skipped:', err);
    }
  };

  // Guaranteed In-App DOM Toast (Bypasses Browser Notification Blocks)
  function showInAppToast(title, body, type = 'info') {
    let container = document.getElementById('tt-toast-container');
    if (!container) {
      container = document.createElement('div');
      container.id = 'tt-toast-container';
      container.className = 'fixed top-4 right-4 left-4 sm:left-auto sm:w-96 z-[99999] space-y-2 pointer-events-none';
      document.body.appendChild(container);
    }

    // Icon based on type
    const icons = {
      'order': '📦',
      'feedback': '⭐',
      'broadcast': '📢',
      'alert': '⚠️',
      'success': '✅',
      'info': '🔔'
    };
    const icon = icons[type] || icons.info;

    const toast = document.createElement('div');
    const isDark = document.documentElement.classList.contains('dark');
    toast.className = `p-4 rounded-2xl ${isDark ? 'bg-slate-900' : 'bg-white'} text-slate-900 dark:text-white border ${type === 'order' ? 'border-emerald-500/50' : type === 'alert' ? 'border-rose-500/50' : 'border-emerald-500/50'} shadow-2xl backdrop-blur-md flex items-start gap-3 pointer-events-auto transition-all transform translate-y-[-20px] opacity-0`;
    toast.innerHTML = `
      <div class="text-2xl animate-bounce flex-shrink-0">${icon}</div>
      <div class="flex-1 min-w-0">
        <div class="text-xs font-black ${type === 'alert' ? 'text-rose-400' : 'text-emerald-400'} uppercase tracking-wide">${title}</div>
        <div class="text-xs text-slate-700 dark:text-slate-200 mt-0.5 leading-snug">${body}</div>
      </div>
      <button onclick="this.parentElement.remove()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white text-xs font-bold px-1 flex-shrink-0">✕</button>
    `;

    container.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.classList.remove('translate-y-[-20px]', 'opacity-0');
      toast.classList.add('translate-y-0', 'opacity-100');
    });

    // Auto-remove after 7 seconds
    setTimeout(() => {
      toast.classList.add('opacity-0', 'translate-y-[-20px]');
      setTimeout(() => {
        if (toast.parentElement) {
          toast.remove();
        }
      }, 300);
    }, 7000);
  }

  window.triggerPushNotification = async function(title, body, url = '/', channelType = null) {
    // Always fire visual DOM toast banner so it's guaranteed to be seen
    showInAppToast(title, body, channelType || 'info');

    // Vibrate for mobile devices
    if ('vibrate' in navigator) {
      try { navigator.vibrate([200, 100, 200]); } catch (e) {}
    }

    // Check if browser notifications are supported
    if (!('Notification' in window)) return;

    // Request permission if not yet determined
    if (Notification.permission === 'default') {
      try {
        await Notification.requestPermission();
      } catch (e) {
        return;
      }
    }

    // Show browser notification if permitted
    if (Notification.permission === 'granted') {
      const options = {
        body: body,
        icon: '/logo.png',
        badge: '/logo.png',
        vibrate: [200, 100, 200],
        tag: 'tt-alert-' + Date.now(),
        renotify: true,
        data: { url: url, timestamp: Date.now() }
      };

      try {
        // Try service worker notification first
        if ('serviceWorker' in navigator) {
          const readyReg = await navigator.serviceWorker.ready;
          if (readyReg && readyReg.showNotification) {
            await readyReg.showNotification(title, options);
            return;
          }
        }
        // Fallback to regular notification
        new Notification(title, options);
      } catch (e) {
        console.warn('Notification display error:', e);
      }
    }
  };

  window.initTirzaTrimRealtime = function() {
    ensureSupabaseClient((sb) => {
      const path = window.location.pathname.toLowerCase();
      const isZSM = path.includes('admin');
      const isRep = path.includes('team');
      const isHO = path.includes('headoffice') || path.includes('hos');
      const isDistributor = path.includes('mds') || path.includes('mmp');
      const isDoctor = path.includes('doctor');
      const isPatient = path.includes('order') || path.includes('feedback');

      const currentRep = JSON.parse(sessionStorage.getItem('tt_current_rep') || 'null');
      const currentManager = JSON.parse(localStorage.getItem('tt_current_manager') || sessionStorage.getItem('tt_current_manager') || 'null');
      const currentHOS = JSON.parse(sessionStorage.getItem('tt_hos_data') || '{}');

      // Auto request permission on first user interaction if default
      if (Notification.permission === 'default') {
        const requestPermission = () => {
          Notification.requestPermission().catch(() => {});
          document.removeEventListener('click', requestPermission);
        };
        document.addEventListener('click', requestPermission, { once: true });
      }

      // Store current user info for notification routing
      let userInfo = null;
      if (currentRep && currentRep.territory_code) {
        userInfo = { id: currentRep.sap_id, role: 'rep', territory: currentRep.territory_code, name: currentRep.full_name };
      } else if (currentManager && currentManager.manager_sap_id) {
        userInfo = { id: currentManager.manager_sap_id, role: 'zsm', territory: currentManager.zone_region, name: currentManager.full_name };
      } else if (currentHOS && currentHOS.sap_id) {
        userInfo = { id: currentHOS.sap_id, role: 'hos', region: currentHOS.region, name: currentHOS.full_name };
      }

      // Single Global Listener for Instant UI and Notification syncing
      const channel = sb.channel('public:system_wide_sync');
      
      channel
        .on('postgres_changes', { event: '*', schema: 'public', table: 'orders' }, payload => {
          const o = payload.new || payload.old || {};
          console.log('⚡ [Global Sync Notification Event]', payload.eventType, o);

          // Refresh all data fetching functions
          if (typeof window.fetchRepOrders === 'function') window.fetchRepOrders(true);
          if (typeof window.fetchManagerOrders === 'function') window.fetchManagerOrders(true);
          if (typeof window.fetchEverything === 'function') window.fetchEverything(true);
          if (typeof window.fetchDistributorOrders === 'function') window.fetchDistributorOrders(true);
          if (typeof window.fetchDoctorOrders === 'function') window.fetchDoctorOrders(true);
          if (typeof window.fetchTerritoryDoctors === 'function') window.fetchTerritoryDoctors();
          if (typeof window.fetchTeamDoctors === 'function') window.fetchTeamDoctors();

          // Trigger notifications based on event type and user role
          if (payload.eventType === 'INSERT') {
            const patientText = o.patient_name || 'Patient';
            const doseText = o.prescribed_dose || '5mg';
            const repText = o.rep_code || 'Direct';
            const cityText = o.city || 'Pakistan';

            // Role-based notifications
            if (isRep && o.rep_code === currentRep?.territory_code) {
              window.triggerPushNotification('📦 New Territory Order', `${patientText} (${doseText}) - ${cityText}`, '/team.html', 'order');
            } else if (isZSM) {
              // Check if this order belongs to this ZSM's territory
              const belongsToZSM = currentManager && o.rep_code && 
                window.registeredReps && window.registeredReps.some(r => r.territory_code === o.rep_code);
              if (belongsToZSM || !currentManager) {
                window.triggerPushNotification('📦 New Zone Order', `${patientText} (${repText}) - ${doseText}`, '/admin.html', 'order');
              }
            } else if (isHO) {
              window.triggerPushNotification('📦 New National Order', `${patientText} in ${cityText}`, '/headoffice.html', 'order');
            } else if (isDistributor) {
              window.triggerPushNotification('📦 New Packing Required', `${patientText} - ${doseText} (${cityText})`, '/mds.html', 'order');
            } else if (isDoctor) {
              // Check if this order belongs to this doctor
              const doctorName = sessionStorage.getItem('tt_doctor_name') || '';
              if (doctorName && o.doctor_name && o.doctor_name.toLowerCase().includes(doctorName.toLowerCase())) {
                window.triggerPushNotification('🩺 New Patient Referral', `${patientText} - ${doseText}`, '/doctor.html', 'order');
              }
            } else if (isPatient) {
              // Patient sees their own order notifications
              const patientMobile = sessionStorage.getItem('tt_patient_mobile') || '';
              if (patientMobile && o.mobile === patientMobile) {
                window.triggerPushNotification('✅ Order Confirmed', `Your order ${o.order_id || ''} has been received`, '/order.html', 'success');
              }
            } else {
              window.triggerPushNotification('📦 TirzaTrim Update', `${patientText} order registered successfully!`, window.location.pathname, 'order');
            }
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'feedback' }, payload => {
          const f = payload.new || payload.old || {};
          console.log('⚡ [Feedback Event]', payload.eventType, f);

          // Refresh data
          if (typeof window.fetchRepOrders === 'function') window.fetchRepOrders(true);
          if (typeof window.fetchManagerOrders === 'function') window.fetchManagerOrders(true);
          if (typeof window.fetchEverything === 'function') window.fetchEverything(true);
          if (typeof window.fetchDistributorOrders === 'function') window.fetchDistributorOrders(true);
          if (typeof window.fetchDoctorOrders === 'function') window.fetchDoctorOrders(true);

          if (payload.eventType === 'INSERT') {
            const rating = f.overall_rating || '⭐';
            const stars = '⭐'.repeat(Math.min(rating, 5));
            window.triggerPushNotification('⭐ New Feedback Received', `${stars} ${f.comments || 'Patient left feedback'}`, '/feedback.html', 'feedback');
          }
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'broadcasts' }, payload => {
          const b = payload.new || payload.old || {};
          if (payload.eventType === 'INSERT' && b.is_active !== false) {
            console.log('📢 [New Broadcast]', b.title);
            window.triggerPushNotification(`📢 ${b.title || 'New Announcement'}`, b.message ? b.message.substring(0, 100) + '...' : '', '/', 'broadcast');
          }
        })
        .subscribe((status) => {
          if (status === 'SUBSCRIBED') {
            console.log('✅ Realtime sync connected');
          } else if (status === 'CHANNEL_ERROR') {
            console.warn('⚠️ Realtime sync error, will retry...');
          }
        });
    });
  };

  // Auto-init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', window.initTirzaTrimRealtime);
  } else {
    window.initTirzaTrimRealtime();
  }

  // Export functions for use in other scripts
  window.showInAppToast = showInAppToast;
  window.ensureSupabaseClient = ensureSupabaseClient;
})();
