// Universal Popup Announcement Handler for TirzaTrim
async function checkGlobalBroadcast(targetRole) {
  if (!window.supabaseClient && typeof client === 'undefined') return;
  const sb = window.supabaseClient || client;

  try {
    const { data: broadcasts, error } = await sb
      .from('broadcasts')
      .select('*')
      .eq('is_active', true)
      .order('created_at', { ascending: false });

    if (error || !broadcasts || broadcasts.length === 0) return;

    // Match role (patient, doctor, distributor, team) or 'all'
    const activeBroadcast = broadcasts.find(b => 
      b.target_audience.includes(targetRole) || b.target_audience.includes('all')
    );

    if (!activeBroadcast) return;

    // Check if the user already dismissed this specific announcement ID
    const seenKey = `tt_seen_broadcast_${activeBroadcast.id}`;
    if (sessionStorage.getItem(seenKey)) return;

    renderBroadcastModal(activeBroadcast, seenKey);
  } catch (err) {
    console.error("Broadcast check error:", err);
  }
}

function renderBroadcastModal(bc, seenKey) {
  let badgeColor = "bg-blue-500/10 text-blue-500 border-blue-500/20";
  let icon = "📢";

  if (bc.category === 'Attention') {
    badgeColor = "bg-rose-500/10 text-rose-500 border-rose-500/20";
    icon = "⚠️";
  } else if (bc.category === 'Important Information') {
    badgeColor = "bg-amber-500/10 text-amber-500 border-amber-500/20";
    icon = "ℹ️";
  }

  const modalHtml = `
    <div id="broadcastModal" class="fixed inset-0 z-[9999] bg-slate-950/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-8 max-w-md w-full shadow-2xl space-y-4 relative animate-fade-in">
        <div class="flex items-center justify-between">
          <span class="px-3 py-1 rounded-full text-xs font-bold border ${badgeColor} flex items-center gap-1.5">
            <span>${icon}</span> ${bc.category}
          </span>
          <button onclick="dismissBroadcast('${seenKey}')" class="text-slate-400 hover:text-slate-900 dark:hover:text-white text-base w-7 h-7 rounded-full bg-slate-100 dark:bg-slate-800 flex items-center justify-center">✕</button>
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

  document.body.insertAdjacentHTML('beforeend', modalHtml);
}

function dismissBroadcast(seenKey) {
  sessionStorage.setItem(seenKey, 'true');
  const modal = document.getElementById('broadcastModal');
  if (modal) modal.remove();
}
