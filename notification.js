// Universal TirzaTrim Live Push & In-App Notification System
(function() {
  const TT_SB_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
  const TT_SB_KEY = "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";

  let rtClient = null;

  function getSupabaseClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      if (!rtClient) rtClient = window.supabase.createClient(TT_SB_URL, TT_SB_KEY);
      return rtClient;
    }
    return null;
  }

  // Trigger Native / PWA Notification
  window.triggerPushNotification = function(title, body, url = '/') {
    const isEnabled = localStorage.getItem('tt_notif_enabled') === 'true';
    if (!isEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    if (navigator.serviceWorker && navigator.serviceWorker.controller) {
      navigator.serviceWorker.ready.then(reg => {
        reg.showNotification(title, {
          body: body,
          icon: '/logo.png',
          badge: '/logo.png',
          vibrate: [200, 100, 200],
          data: { url: url }
        });
      });
    } else {
      new Notification(title, {
        body: body,
        icon: '/logo.png'
      });
    }
  };

  // Toggle notification permissions
  window.toggleAppNotifications = async function() {
    if (!('Notification' in window)) {
      alert('Your browser / device does not support native push notifications.');
      return false;
    }

    const currentStatus = localStorage.getItem('tt_notif_enabled') === 'true';

    if (!currentStatus) {
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        localStorage.setItem('tt_notif_enabled', 'true');
        triggerPushNotification('🔔 Notifications Active', 'You will receive real-time order updates and platform alerts.');
        updateNotificationUI(true);
        return true;
      } else {
        localStorage.setItem('tt_notif_enabled', 'false');
        alert('Notification access was blocked. Please enable permissions in your device/browser site settings.');
        updateNotificationUI(false);
        return false;
      }
    } else {
      localStorage.setItem('tt_notif_enabled', 'false');
      updateNotificationUI(false);
      return false;
    }
  };

  function updateNotificationUI(active) {
    const toggles = document.querySelectorAll('.tt-notif-toggle');
    toggles.forEach(t => {
      if (t.type === 'checkbox') t.checked = active;
    });
  }

  // Detect current role and initiate listeners
  window.initTirzaTrimRealtime = function() {
    const sb = getSupabaseClient();
    if (!sb) return;

    const path = window.location.pathname.toLowerCase();
    let role = 'guest';

    if (path.includes('admin') || path.includes('head') || path.includes('hos')) role = 'management';
    else if (path.includes('distributor')) role = 'distributor';
    else if (path.includes('doctor')) role = 'doctor';
    else if (path.includes('team')) role = 'team';
    else if (path.includes('order') || path.includes('feedback')) role = 'patient';

    sb.channel('tt_global_realtime')
      // 1. Order updates
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const o = payload.new;
        const old = payload.old;
        if (o.status !== old.status) {
          if (role === 'distributor') {
            triggerPushNotification('🛵 Dispatch Updated', `Order #${o.order_id || ''} status: ${o.status}`, '/distributor.html');
          } else if (role === 'patient') {
            triggerPushNotification('📦 Order Status Update', `Your TirzaTrim order is now: ${o.status}`, '/order.html');
          } else if (role === 'team' || role === 'management') {
            triggerPushNotification('📈 Territory Update', `${o.patient_name || 'Patient'} (${o.rep_code || ''}) ➔ ${o.status}`, window.location.pathname);
          }
        }
      })
      // 2. New Orders Placed
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        const o = payload.new;
        if (role === 'management' || role === 'distributor' || role === 'team') {
          triggerPushNotification('✨ New Order Enrolled', `${o.patient_name || 'New Patient'} (${o.city || 'Pakistan'}) - ${o.prescribed_dose || ''}`, window.location.pathname);
        }
      })
      // 3. New Feedbacks
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, payload => {
        if (role === 'management' || role === 'team') {
          triggerPushNotification('⭐ New Patient Feedback', `Rating: ${payload.new.overall_rating || 5} Stars received!`, window.location.pathname);
        }
      })
      .subscribe();
  };

  document.addEventListener('DOMContentLoaded', () => {
    const isEnabled = localStorage.getItem('tt_notif_enabled') === 'true' && Notification.permission === 'granted';
    updateNotificationUI(isEnabled);
    initTirzaTrimRealtime();
  });
})();
