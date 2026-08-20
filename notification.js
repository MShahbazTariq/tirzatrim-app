// Universal TirzaTrim Live Push & In-App Notification System (Mobile & Desktop Production)
(function() {
  const TT_SB_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
  const TT_SB_KEY = "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";

  let rtClient = null;

  // 1. Automatically register Service Worker for mobile PWA push handling
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('/sw.js').catch(err => {
      console.warn('SW registration note:', err);
    });
  }

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

  // Trigger Native Push Notification (Mobile PWA + Desktop Safe)
  window.triggerPushNotification = async function(title, body, url = '/', channelType = null) {
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
      tag: 'tt-notif-' + Date.now(),
      renotify: true,
      data: { url: url }
    };

    // Primary Execution Path: Service Worker (Required on Android / iOS)
    if ('serviceWorker' in navigator) {
      try {
        const registration = await navigator.serviceWorker.ready;
        if (registration && typeof registration.showNotification === 'function') {
          await registration.showNotification(title, options);
          return;
        }
      } catch (e) {
        console.warn('Service Worker notification failed, attempting desktop fallback:', e);
      }
    }

    // Secondary Execution Path: Desktop Browser Fallback
    try {
      new Notification(title, options);
    } catch (e) {
      console.warn('Direct notification constructor bypassed:', e);
    }
  };

  // Detect hierarchy tier and initiate realtime subscriptions
  window.initTirzaTrimRealtime = async function() {
    const sb = getSupabaseClient();
    if (!sb) return;

    const path = window.location.pathname.toLowerCase();

    const isHeadOffice = path.includes('headoffice');
    const isHOS = path.includes('hos');
    const isZSM = path.includes('admin');
    const isRep = path.includes('team');
    const isDistributor = path.includes('distributor');
    const isPatient = path.includes('order') || path.includes('feedback');

    const currentRep = JSON.parse(sessionStorage.getItem('tt_current_rep') || 'null');
    const currentManager = JSON.parse(sessionStorage.getItem('tt_current_manager') || 'null');
    const currentHOS = JSON.parse(sessionStorage.getItem('tt_current_hos') || 'null');

    // Pre-cache Manager's Subordinate Territory Codes into memory for instant matching
    let zsmTerritoryCodes = [];
    if (isZSM && currentManager && currentManager.manager_sap_id) {
      try {
        const { data: reps } = await sb
          .from('reps')
          .select('territory_code')
          .eq('manager_sap_id', currentManager.manager_sap_id);
        zsmTerritoryCodes = (reps || []).map(r => r.territory_code);
      } catch (err) {
        console.warn('ZSM rep cache error:', err);
      }
    }

    sb.channel('tt_global_realtime_' + Math.floor(Math.random() * 10000))
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
          } else if (isZSM && (zsmTerritoryCodes.includes(o.rep_code) || zsmTerritoryCodes.length === 0)) {
            triggerPushNotification('📈 Zone Order Update', `${o.patient_name} (${o.rep_code}) ➔ ${o.status}`, '/admin.html', channel);
          }
        }
      })
      // B. New Orders (Hierarchy-Scaped Routing)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'orders' }, async (payload) => {
        const o = payload.new;

        // 1. Field Rep Tier (Exact Territory Code Match)
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

        // 2. ZSM Tier (Instant Pre-cached Territory Check)
        if (isZSM && currentManager) {
          if (zsmTerritoryCodes.length === 0 || zsmTerritoryCodes.includes(o.rep_code)) {
            triggerPushNotification(
              '✨ New Zone Order',
              `${o.patient_name || 'Patient'} (${o.rep_code}) - ${o.prescribed_dose || '5mg'} in ${currentManager.zone_region || 'Zone'}`,
              '/admin.html',
              'orders'
            );
          }
          return;
        }

        // 3. HOS Tier (Region Scoped)
        if (isHOS && currentHOS) {
          try {
            const { data: regionCheck } = await sb
              .from('reps')
              .select('manager_sap_id, managers!inner(region)')
              .eq('territory_code', o.rep_code)
              .limit(1);

            const orderRegion = regionCheck && regionCheck[0]?.managers?.region;
            if (!orderRegion || orderRegion.toLowerCase() === (currentHOS.region || '').toLowerCase()) {
              triggerPushNotification(
                `✨ New ${currentHOS.region || ''} Order`,
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

        // 4. Head Office Tier (Nationwide)
        if (isHeadOffice) {
          triggerPushNotification(
            '✨ National Order Enrolled',
            `${o.patient_name || 'Patient'} (${o.rep_code || 'Direct'}) - ${o.city || 'Pakistan'}`,
            '/headoffice.html',
            'orders'
          );
          return;
        }

        // 5. Distributor Tier (Rider Alert)
        if (isDistributor) {
          triggerPushNotification(
            '🛵 New Delivery Order',
            `Order #${o.order_id || ''} - ${o.city || 'Fulfillment'}`,
            '/distributor.html',
            'dispatch'
          );
        }
      })
      // C. Doctor Feedback Submissions
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
