// notification-helper.js
// Helper functions to create notifications

const supabaseUrl = "https://yygmkqzbbnpyikvlqibw.supabase.co";
const supabaseKey = "sb_publishable_wN0uOuHt57_4A5Ufs2vo8g_8ImKIuKJ";
const supabaseClient = supabase.createClient(supabaseUrl, supabaseKey);

async function createNotification(data) {
    const {
        userId,
        userRole,
        title,
        message,
        type = 'system',
        priority = 'medium',
        link = null,
        metadata = {},
        expiresAt = null
    } = data;

    if (!userId) {
        console.warn('No userId provided for notification');
        return null;
    }

    try {
        const { data: result, error } = await supabaseClient
            .from('notifications')
            .insert([{
                user_id: userId,
                user_role: userRole || 'rep',
                title: title,
                message: message,
                type: type,
                priority: priority,
                link: link,
                metadata: metadata,
                expires_at: expiresAt,
                is_read: false
            }])
            .select();

        if (error) throw error;
        
        // Also trigger push notification
        if (window.triggerPushNotification) {
            window.triggerPushNotification(title, message, link || '/');
        }
        
        return result[0];
    } catch (err) {
        console.error('Error creating notification:', err);
        return null;
    }
}

// Pre-built notification templates

async function notifyNewOrder(order, userId, userRole = 'rep') {
    return createNotification({
        userId: userId,
        userRole: userRole,
        title: `📦 New Order: ${order.order_id || 'Order'}`,
        message: `Patient ${order.patient_name || 'Unknown'} has submitted a new order for ${order.prescribed_dose || '5mg'}`,
        type: 'order',
        priority: 'high',
        link: `/team.html?order=${order.id}`,
        metadata: { order_id: order.id }
    });
}

async function notifyOrderStatusUpdate(order, userId, userRole = 'rep') {
    return createNotification({
        userId: userId,
        userRole: userRole,
        title: `📦 Order ${order.order_id || 'Order'} Update`,
        message: `Status changed to: ${order.status || 'Updated'}`,
        type: 'order',
        priority: 'medium',
        link: `/team.html?order=${order.id}`,
        metadata: { order_id: order.id }
    });
}

async function notifyFeedbackReceived(feedback, userId, userRole = 'rep') {
    return createNotification({
        userId: userId,
        userRole: userRole,
        title: `⭐ New Feedback: ${feedback.order_id || 'Order'}`,
        message: `Patient rated their experience ${feedback.overall_rating || '0'} stars`,
        type: 'feedback',
        priority: 'medium',
        link: `/feedback.html?order=${feedback.order_id}`,
        metadata: { order_id: feedback.order_id, rating: feedback.overall_rating }
    });
}

async function notifyBroadcast(broadcast, userId, userRole = 'rep') {
    const shortMsg = broadcast.message ? broadcast.message.substring(0, 100) + (broadcast.message.length > 100 ? '...' : '') : '';
    return createNotification({
        userId: userId,
        userRole: userRole,
        title: `📢 ${broadcast.title || 'Announcement'}`,
        message: shortMsg,
        type: 'broadcast',
        priority: 'medium',
        link: `/broadcasts.html?id=${broadcast.id}`,
        metadata: { broadcast_id: broadcast.id }
    });
}

async function notifySystemAlert(userId, userRole, title, message, priority = 'high') {
    return createNotification({
        userId: userId,
        userRole: userRole,
        title: title,
        message: message,
        type: 'system',
        priority: priority
    });
}

// Batch create notifications for multiple users
async function notifyAllUsers(users, notificationData) {
    const results = [];
    for (const user of users) {
        const result = await createNotification({
            ...notificationData,
            userId: user.id,
            userRole: user.role || 'rep'
        });
        if (result) results.push(result);
    }
    return results;
}

// Make functions globally available
window.notifyNewOrder = notifyNewOrder;
window.notifyOrderStatusUpdate = notifyOrderStatusUpdate;
window.notifyFeedbackReceived = notifyFeedbackReceived;
window.notifyBroadcast = notifyBroadcast;
window.notifySystemAlert = notifySystemAlert;
window.notifyAllUsers = notifyAllUsers;
window.createNotification = createNotification;
