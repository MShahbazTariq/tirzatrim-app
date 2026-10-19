import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
// ⚠️ CRITICAL: Ensure SUPABASE_SERVICE_ROLE_KEY is set in Vercel. 
// Do NOT rely on the anon key here, or RLS will block it.
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY; 

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

// Complete clinical titration curve for Tirzepatide
const NEXT_DOSE_MAP = {
  '2.5mg': '5mg',
  '5mg': '7.5mg',
  '7.5mg': '10mg',
  '10mg': '12.5mg',
  '12.5mg': '15mg',
  '15mg': '15mg (Maintenance)'
};

function normalizeDoseKey(rawDose) {
  if (!rawDose) return '5mg';
  const clean = rawDose.toLowerCase().replace(/\s+/g, '');
  if (clean.includes('2.5')) return '2.5mg';
  if (clean.includes('7.5')) return '7.5mg';
  if (clean.includes('12.5')) return '12.5mg';
  if (clean.includes('15')) return '15mg';
  if (clean.includes('10')) return '10mg';
  if (clean.includes('5')) return '5mg';
  return '5mg';
}

export default async function handler(req, res) {
  try {
    const today = new Date();
    
    // 1. Fetch fulfilled patient orders
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['Delivered', 'Patient Confirmed', 'Usage Guidance Completed', 'Feedback Submitted']);

    if (ordersErr) throw ordersErr;

    const remindersQueue = [];

    for (const order of (orders || [])) {
      const orderDate = new Date(order.created_at);
      const daysElapsed = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

      // Day 21-28 check (Week 4 of the 4-week pen cycle)
      if (daysElapsed >= 21 && daysElapsed <= 28) {
        
        // Check if we already logged this reminder
        const { data: existingLog } = await supabase
          .from('reminders_log')
          .select('id')
          .eq('order_id', order.id)
          .eq('reminder_type', 'refill_due')
          .limit(1);

        if (!existingLog || existingLog.length === 0) {
          const doseKey = normalizeDoseKey(order.prescribed_dose);
          const nextRecommendedDose = NEXT_DOSE_MAP[doseKey] || '7.5mg';

          // Push to our local array for the response
          remindersQueue.push({
            order_id: order.id,
            patient_name: order.patient_name,
            patient_mobile: order.mobile,
            current_dose: order.prescribed_dose || '5mg',
            next_dose: nextRecommendedDose,
            rep_code: order.rep_code,
            days_elapsed: daysElapsed
          });

          // 2. Log the reminder to prevent spamming
          await supabase.from('reminders_log').insert([{
            order_id: order.id,
            patient_mobile: order.mobile,
            reminder_type: 'refill_due',
            target_dose: nextRecommendedDose,
            status: 'PENDING_DISPATCH'
          }]);

          // 3. Find the Rep's SAP ID so we can notify them on the portal
          if (order.rep_code && order.rep_code !== 'DIRECT') {
            const { data: repData } = await supabase
              .from('reps')
              .select('sap_id')
              .ilike('territory_code', order.rep_code)
              .maybeSingle();

            if (repData && repData.sap_id) {
              // 4. Insert an in-app notification for the Rep (This makes their 🔔 ring!)
              await supabase.from('notifications').insert([{
                user_id: String(repData.sap_id),
                user_role: 'rep',
                title: `🔄 Refill Due: ${order.patient_name}`,
                message: `Patient ${order.patient_name} is on Week 4 (Day ${daysElapsed}) of ${order.prescribed_dose}. Please contact them for their next step-up dose (${nextRecommendedDose}).`,
                type: 'order',
                priority: 'high',
                link: '/team.html'
              }]);
            }
          }
        }
      }
    }

    return res.status(200).json({
      success: true,
      timestamp: today.toISOString(),
      pending_reminders_count: remindersQueue.length,
      queue: remindersQueue
    });

  } catch (err) {
    console.error("Cron Error:", err);
    return res.status(500).json({ success: false, error: err.message });
  }
}
