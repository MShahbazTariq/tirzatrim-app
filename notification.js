// Universal TirzaTrim Live Push & In-App Notification System
(function() {
  const TT_SB_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
  const TT_SB_KEY = "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";

  let rtClient = null;

  function loadSupabaseScript(callback) {
    if (window.supabase) {
      callback();
      return;
    }
    const s = document.createElement('script');
    s.src = 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2';
    s.onload = callback;
    document.head.appendChild(s);
  }

  function getSupabaseClient() {
    if (window.supabase && typeof window.supabase.createClient === 'function') {
      if (!rtClient) rtClient = window.supabase.createClient(TT_SB_URL, TT_SB_KEY);
      return rtClient;
    }
    return null;
  }

  // Trigger Native / PWA Notification with channel filter
  window.triggerPushNotification = function(title, body, url = '/', channelType = null) {
    const isMasterEnabled = localStorage.getItem('tt_notif_enabled') === 'true';
    if (!isMasterEnabled || !('Notification' in window) || Notification.permission !== 'granted') {
      return;
    }

    // Check individual sub-channel preferences
    if (channelType) {
      const channelPref = localStorage.getItem(`tt_notif_${channelType}`);
      if (channelPref === 'false') return; // User muted this specific category
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
      // 1. Order Status Updates (Dispatched, Delivered, In Process)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const o = payload.new;
        const old = payload.old;
        if (o.status !== old.status) {
          const isDispatchAction = ['Dispatched', 'Out for Delivery', 'Delivered'].includes(o.status);
          const channel = isDispatchAction ? 'dispatch' : 'orders';

          if (role === 'distributor') {
            triggerPushNotification('🛵 Dispatch Updated', `Order #${o.order_id || ''} ➔ ${o.status}`, '/distributor.html', 'dispatch');
          } else if (role === 'patient') {
            triggerPushNotification('📦 Order Status Update', `Your TirzaTrim order is now: ${o.status}`, '/order.html', channel);
          } else if (role === 'team' || role === 'management') {
            triggerPushNotification('📈 Territory Update', `${o.patient_name || 'Patient'} (${o.rep_code || ''}) ➔ ${o.status}`, window.location.pathname, channel);
          }
        }
      })
      // 2. New Orders Enrolled
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, payload => {
        const o = payload.new;
        if (role === 'management' || role === 'distributor' || role === 'team') {
          triggerPushNotification('✨ New Order Enrolled', `${o.patient_name || 'New Patient'} (${o.city || 'Pakistan'}) - ${o.prescribed_dose || ''}`, window.location.pathname, 'orders');
        }
      })
      // 3. New Feedbacks Submitted
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, payload => {
        if (role === 'management' || role === 'team') {
          triggerPushNotification('⭐ New Doctor Feedback', `Rating: ${payload.new.overall_rating || 5} Stars received!`, window.location.pathname, 'feedback');
        }
      })
      // 4. New Broadcast Announcements Published
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'broadcasts' }, payload => {
        const bc = payload.new;
        if (!bc.is_active) return;
        triggerPushNotification(`📢 ${bc.category || 'Announcement'}`, bc.title, window.location.pathname, 'broadcasts');
      })
      .subscribe();
  };

  document.addEventListener('DOMContentLoaded', () => {
    loadSupabaseScript(() => {
      initTirzaTrimRealtime();
    });
  });
})();
