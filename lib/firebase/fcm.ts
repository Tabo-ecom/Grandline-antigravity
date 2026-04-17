import { getMessaging, getToken, onMessage, type Messaging } from 'firebase/messaging';
import app from './config';
import { doc, setDoc } from 'firebase/firestore';
import { db } from './config';

let messaging: Messaging | null = null;

function getMessagingInstance() {
    if (!messaging && typeof window !== 'undefined' && 'serviceWorker' in navigator) {
        try {
            messaging = getMessaging(app);
        } catch {}
    }
    return messaging;
}

/**
 * Request notification permission and save FCM token to Firestore
 */
export async function initFCM(userId: string): Promise<string | null> {
    const msg = getMessagingInstance();
    if (!msg) return null;

    try {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') return null;

        // Get registration for our SW
        const registration = await navigator.serviceWorker.getRegistration('/sw.js');

        const token = await getToken(msg, {
            vapidKey: process.env.NEXT_PUBLIC_FIREBASE_VAPID_KEY || '',
            serviceWorkerRegistration: registration,
        });

        if (token) {
            // Save token to Firestore for this user
            await setDoc(doc(db, 'fcm_tokens', userId), {
                token,
                updated_at: Date.now(),
                user_agent: navigator.userAgent,
            }, { merge: true });
        }

        return token;
    } catch (error) {
        console.error('FCM init error:', error);
        return null;
    }
}

/**
 * Listen for foreground messages
 */
export function onForegroundMessage(callback: (payload: any) => void) {
    const msg = getMessagingInstance();
    if (!msg) return () => {};
    return onMessage(msg, callback);
}
