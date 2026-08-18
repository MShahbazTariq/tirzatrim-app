import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = "https://yygmkqzbbnpyikvlqibw.supabase.co";
// Uses your service role / secret key for backend tasks
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";
const client = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  try {
    // 1. Fetch all delivered/completed patient orders
    const { data: orders, error } = await client
      .from('orders')
      .select('*')
      .in('status', ['Delivered', 'Patient Confirmed', 'Usage Guidance Completed', 'Feedback Submitted', 'Completed']);

    if (error) throw error;

    const now = new Date();
    const dispatched = [];

    for (const order of (orders || [])) {
      const orderDate = new Date(order.created_at);
      const daysElapsed = Math.floor((now - orderDate) / (1000 * 60 * 60 * 24));

      let reminderType = null;
      let reminderMsg = "";

      // Weekly schedule logic
      if (daysElapsed === 7) {
        reminderType = "DOSE_2";
        reminderMsg = `Assalam-o-Alaikum ${order.patient_name}, this is TirzaTrim Patient Support. Today marks Week 2 (Dose 2) of your ${order.prescribed_dose || 'treatment'}. Remember to rotate your injection site and stay hydrated!`;
      } else if (daysElapsed === 14) {
        reminderType = "DOSE_3";
        reminderMsg = `Assalam-o-Alaikum ${order.patient_name}, TirzaTrim Patient Support reminder: Today is your Week 3 (Dose 3). Hope your treatment is progressing smoothly!`;
      } else if (daysElapsed === 21) {
        reminderType = "DOSE_4_REFILL";
        reminderMsg = `Assalam-o-Alaikum ${order.patient_name}, TirzaTrim Patient Support reminder: Your Week 4 (Final Pen Dose) is due. Please contact Dr. ${order.doctor_name || 'your physician'} to schedule your next month prescription & dosage refill.`;
      }

      if (reminderType) {
        // 2. Check if already dispatched today to avoid duplicates
        const { data: existing } = await client
          .from('reminders_log')
          .select('id')
          .eq('order_id', order.id)
          .eq('reminder_type', reminderType);

        if (!existing || existing.length === 0) {
          // 3. Dispatch Automated WhatsApp via Gateway Provider
          await sendWhatsAppGateway(order.mobile, reminderMsg);

          // 4. Log sent reminder
          await client.from('reminders_log').insert([{
            order_id: order.id,
            patient_name: order.patient_name,
            mobile: order.mobile,
            reminder_type: reminderType
          }]);

          dispatched.push({ order_id: order.id, type: reminderType, patient: order.patient_name });
        }
      }
    }

    return res.status(200).json({ success: true, count: dispatched.length, dispatched });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}

// Function to call your WhatsApp Gateway provider (e.g. UltraMsg / Twilio / Meta Cloud API)
async function sendWhatsAppGateway(mobile, text) {
  let cleaned = ('' + mobile).replace(/\D/g, '');
  if (cleaned.startsWith('0')) cleaned = '92' + cleaned.substring(1);
  else if (!cleaned.startsWith('92')) cleaned = '92' + cleaned;

  // Example placeholder for Meta / UltraMsg / Twilio webhook:
  console.log(`[Auto-Reminder Dispatched to +${cleaned}]: ${text}`);
  
  /* If using UltraMsg:
  await fetch(`https://api.ultramsg.com/${INSTANCE_ID}/messages/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ token: API_TOKEN, to: cleaned, body: text })
  });
  */
}
