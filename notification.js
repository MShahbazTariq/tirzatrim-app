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

    if (channelType) {
      const channelPref = localStorage.getItem(`tt_notif_${channelType}`);
      if (channelPref === 'false') return;
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

  // Detect hierarchy tier and initiate listeners
  window.initTirzaTrimRealtime = function() {
    const sb = getSupabaseClient();
    if (!sb) return;

    const path = window.location.pathname.toLowerCase();

    // 1. Determine Tier Identity from Local Sessions
    const isHeadOffice = path.includes('headoffice');
    const isHOS = path.includes('hos');
    const isZSM = path.includes('admin');
    const isRep = path.includes('team');
    const isDistributor = path.includes('distributor');
    const isPatient = path.includes('order') || path.includes('feedback');

    const currentRep = JSON.parse(sessionStorage.getItem('tt_current_rep') || 'null');
    const currentManager = JSON.parse(sessionStorage.getItem('tt_current_manager') || 'null');
    const currentHOS = JSON.parse(sessionStorage.getItem('tt_current_hos') || 'null');

    sb.channel('tt_global_realtime')
      // A. Order Status Updates
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'orders' }, payload => {
        const o = payload.new;
        const old = payload.old;
        if (o.status !== old.status) {
          const isDispatchAction = ['Dispatched', 'Out for Delivery', 'Delivered'].includes(o.status);
          const channel = isDispatchAction ? 'dispatch' : 'orders';

          if (isDistributor) {
            triggerPushNotification('🛵 Dispatch Updated', `Order #${o.order_id || ''} ➔ ${o.status}`, '/distributor.html', 'dispatch');
          } else if (isPatient) {
            triggerPushNotification('📦 Order Status Update', `Your TirzaTrim order is now: ${o.status}`, '/order.html', channel);
          } else if (isRep && currentRep && currentRep.territory_code === o.rep_code) {
            triggerPushNotification('📈 Territory Update', `${o.patient_name} (${o.rep_code}) ➔ ${o.status}`, '/team.html', channel);
          }
        }
      })
      // B. New Orders (Hierarchical Scoping)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
        const o = payload.new;

        // 1. Field Rep Tier: Exact territory match only
        if (isRep && currentRep) {
          if (currentRep.territory_code === o.rep_code) {
            triggerPushNotification(
              '✨ New Patient Order Enrolled',
              `${o.patient_name || 'Patient'} (${o.prescribed_dose || '5mg'}) enrolled in territory ${o.rep_code}`,
              '/team.html',
              'orders'
            );
          }
          return;
        }

        // 2. ZSM Tier: Match reps registered under this Manager SAP ID
        if (isZSM && currentManager) {
          try {
            const { data: repCheck } = await sb
              .from('reps')
              .select('id')
              .eq('manager_sap_id', currentManager.manager_sap_id)
              .eq('territory_code', o.rep_code)
              .limit(1);

            if (repCheck && repCheck.length > 0) {
              triggerPushNotification(
                '✨ New Zone Order',
                `${o.patient_name || 'Patient'} (${o.rep_code}) - ${o.prescribed_dose || '5mg'} in ${currentManager.zone_region}`,
                '/admin.html',
                'orders'
              );
            }
          } catch (e) {
            console.error('ZSM scope check failed', e);
          }
          return;
        }

        // 3. HOS Tier: Match managers/reps within HOS Assigned Region
        if (isHOS && currentHOS) {
          try {
            const { data: regionCheck } = await sb
              .from('reps')
              .select('manager_sap_id, managers!inner(region)')
              .eq('territory_code', o.rep_code)
              .limit(1);

            const orderRegion = regionCheck && regionCheck[0]?.managers?.region;
            if (orderRegion && orderRegion.toLowerCase() === (currentHOS.region || '').toLowerCase()) {
              triggerPushNotification(
                `✨ New ${currentHOS.region} Order`,
                `${o.patient_name || 'Patient'} (${o.rep_code}) - ${o.prescribed_dose || '5mg'}`,
                '/hos.html',
                'orders'
              );
            }
          } catch (e) {
            console.error('HOS scope check failed', e);
          }
          return;
        }

        // 4. Head Office Tier: Nationwide visibility
        if (isHeadOffice) {
          triggerPushNotification(
            '✨ National Order Enrolled',
            `${o.patient_name || 'Patient'} (${o.rep_code || 'Direct'}) - ${o.city || 'Pakistan'}`,
            '/headoffice.html',
            'orders'
          );
          return;
        }

        // 5. Distributor Tier: New orders for fulfillment
        if (isDistributor) {
          triggerPushNotification(
            '🛵 New Delivery Order',
            `Order #${o.order_id || ''} - ${o.city || 'Fulfillment'}`,
            '/distributor.html',
            'dispatch'
          );
        }
      })
      // C. Feedback Submissions
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'feedback' }, payload => {
        if (isHeadOffice || isHOS || isZSM || isRep) {
          triggerPushNotification('⭐ New Doctor Feedback', `Rating: ${payload.new.overall_rating || 5} Stars received!`, window.location.pathname, 'feedback');
        }
      })
      // D. Broadcast Announcements
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
