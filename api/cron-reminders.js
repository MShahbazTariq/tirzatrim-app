import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";

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
        const { data: existingLog } = await supabase
          .from('reminders_log')
          .select('id')
          .eq('order_id', order.id)
          .eq('reminder_type', 'refill_due')
          .limit(1);

        if (!existingLog || existingLog.length === 0) {
          const doseKey = normalizeDoseKey(order.prescribed_dose);
          const nextRecommendedDose = NEXT_DOSE_MAP[doseKey] || '7.5mg';

          remindersQueue.push({
            order_id: order.id,
            patient_name: order.patient_name,
            patient_mobile: order.mobile,
            current_dose: order.prescribed_dose || '5mg',
            next_dose: nextRecommendedDose,
            rep_code: order.rep_code,
            days_elapsed: daysElapsed
          });

          await supabase.from('reminders_log').insert([{
            order_id: order.id,
            patient_mobile: order.mobile,
            reminder_type: 'refill_due',
            target_dose: nextRecommendedDose,
            status: 'PENDING_DISPATCH'
          }]);
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
    return res.status(500).json({ success: false, error: err.message });
  }
}
