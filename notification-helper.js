// notification-helper.js
// Helper functions to create notifications

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

    try {
        const { data: result, error } = await supabase
            .from('notifications')
            .insert([{
                user_id: userId,
                user_role: userRole,
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
        title: `📦 New Order: ${order.order_id}`,
        message: `Patient ${order.patient_name} has submitted a new order for ${order.prescribed_dose}`,
        type: 'order',
        priority: 'high',
        link: `/orders.html?order=${order.id}`,
        metadata: { order_id: order.id }
    });
}

async function notifyOrderStatusUpdate(order, userId, userRole = 'rep') {
    return createNotification({
        userId: userId,
        userRole: userRole,
        title: `📦 Order ${order.order_id} Update`,
        message: `Status changed to: ${order.status}`,
        type: 'order',
        priority: 'medium',
        link: `/orders.html?order=${order.id}`,
        metadata: { order_id: order.id }
    });
}

async function notifyFeedbackReceived(feedback, userId, userRole = 'rep') {
    return createNotification({
        userId: userId,
        userRole: userRole,
        title: `⭐ New Feedback: ${feedback.order_id}`,
        message: `Patient rated their experience ${feedback.overall_rating} stars`,
        type: 'feedback',
        priority: 'medium',
        link: `/feedback.html?order=${feedback.order_id}`,
        metadata: { order_id: feedback.order_id, rating: feedback.overall_rating }
    });
}

async function notifyBroadcast(broadcast, userId, userRole = 'rep') {
    return createNotification({
        userId: userId,
        userRole: userRole,
        title: `📢 ${broadcast.title}`,
        message: broadcast.message.substring(0, 100) + (broadcast.message.length > 100 ? '...' : ''),
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
            userRole: user.role
        });
        results.push(result);
    }
    return results;
}

window.notifyNewOrder = notifyNewOrder;
window.notifyOrderStatusUpdate = notifyOrderStatusUpdate;
window.notifyFeedbackReceived = notifyFeedbackReceived;
window.notifyBroadcast = notifyBroadcast;
window.notifySystemAlert = notifySystemAlert;
window.notifyAllUsers = notifyAllUsers;
window.createNotification = createNotification;
