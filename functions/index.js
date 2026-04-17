const { onDocumentCreated } = require("firebase-functions/v2/firestore");
const { initializeApp } = require("firebase-admin/app");
const { getFirestore } = require("firebase-admin/firestore");
const { getMessaging } = require("firebase-admin/messaging");

initializeApp();

/**
 * Triggered when a new chat message is created.
 * Sends FCM push to all registered devices except the sender.
 */
exports.onNewChatMessage = onDocumentCreated("chat_messages/{messageId}", async (event) => {
    const message = event.data?.data();
    if (!message) return;

    const db = getFirestore();
    const messaging = getMessaging();

    const senderUid = message.author_uid;
    const senderName = message.author_name || "Alguien";
    const text = (message.text || "Nuevo mensaje").slice(0, 120);
    const channelId = message.channel_id || "";

    // Get channel name
    let channelName = "chat";
    try {
        const channelDoc = await db.collection("chat_channels").doc(channelId).get();
        if (channelDoc.exists) {
            const chData = channelDoc.data();
            channelName = chData.type === "dm" ? "Mensaje directo" : `#${chData.name}`;
        }
    } catch {}

    // Get all FCM tokens except sender
    const tokensSnap = await db.collection("fcm_tokens").get();
    if (tokensSnap.empty) return;

    const invalidTokens = [];
    let sent = 0;

    for (const doc of tokensSnap.docs) {
        if (doc.id === senderUid) continue;

        const token = doc.data().token;
        if (!token) continue;

        try {
            await messaging.send({
                token,
                notification: {
                    title: `💬 ${senderName}`,
                    body: text,
                },
                data: {
                    url: "/chat",
                    channelId,
                    senderName,
                    channelName,
                },
                webpush: {
                    notification: {
                        icon: "/logos/grandline-isotipo.png",
                        badge: "/logos/grandline-isotipo.png",
                        tag: `chat-${Date.now()}`,
                    },
                    fcmOptions: {
                        link: "https://app.grandline.com.co/chat",
                    },
                },
                android: {
                    priority: "high",
                    notification: {
                        icon: "ic_notification",
                        color: "#d75c33",
                        sound: "default",
                        channelId: "chat_messages",
                    },
                },
                apns: {
                    payload: {
                        aps: {
                            sound: "default",
                            badge: 1,
                            "content-available": 1,
                        },
                    },
                },
            });
            sent++;
        } catch (err) {
            console.error(`FCM failed for ${doc.id}:`, err.code || err.message);
            if (
                err.code === "messaging/registration-token-not-registered" ||
                err.code === "messaging/invalid-registration-token"
            ) {
                invalidTokens.push(doc.id);
            }
        }
    }

    // Clean invalid tokens
    for (const docId of invalidTokens) {
        await db.collection("fcm_tokens").doc(docId).delete().catch(() => {});
    }

    console.log(`Push sent to ${sent} devices, cleaned ${invalidTokens.length} tokens`);
});
