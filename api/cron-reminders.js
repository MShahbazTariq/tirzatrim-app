import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const NEXT_DOSE_MAP = {
  '2.5mg': '5mg',
  '5mg': '10mg',
  '10mg': '15mg',
  '15mg': '15mg (Maintenance)'
};

export default async function handler(req, res) {
  try {
    const today = new Date();
    
    // 1. Fetch active delivered patient records
    const { data: orders, error: ordersErr } = await supabase
      .from('orders')
      .select('*')
      .in('status', ['Delivered', 'Patient Confirmed', 'Usage Guidance Completed', 'Feedback Submitted']);

    if (ordersErr) throw ordersErr;

    const remindersQueue = [];

    for (const order of (orders || [])) {
      const orderDate = new Date(order.created_at);
      const daysElapsed = Math.floor((today - orderDate) / (1000 * 60 * 60 * 24));

      // Day 21-28 check (Week 4 of the multi-dose pen cycle)
      if (daysElapsed >= 21 && daysElapsed <= 28) {
        const { data: existingLog } = await supabase
          .from('reminders_log')
          .select('id')
          .eq('order_id', order.id)
          .eq('reminder_type', 'refill_due')
          .limit(1);

        if (!existingLog || existingLog.length === 0) {
          const currentDose = order.prescribed_dose || '5mg';
          const nextRecommendedDose = NEXT_DOSE_MAP[currentDose] || '10mg';

          remindersQueue.push({
            order_id: order.id,
            patient_name: order.patient_name,
            patient_mobile: order.mobile,
            current_dose: currentDose,
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
