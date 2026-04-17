import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getMessaging } from 'firebase-admin/messaging';

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { title, body, senderUid } = await req.json();

        // Check admin is initialized
        if (!getApps().length) {
            return NextResponse.json({ error: 'Firebase Admin not initialized' }, { status: 500 });
        }

        const db = getFirestore();
        const messaging = getMessaging();

        // Get all FCM tokens (excluding sender)
        const tokensSnap = await db.collection('fcm_tokens').get();
        const tokens: { docId: string; token: string }[] = [];

        for (const doc of tokensSnap.docs) {
            if (doc.id !== senderUid && doc.data().token) {
                tokens.push({ docId: doc.id, token: doc.data().token });
            }
        }

        if (tokens.length === 0) {
            return NextResponse.json({ sent: 0, tokens: 0 });
        }

        let sent = 0;
        const failed: string[] = [];

        // Send to each token
        for (const { docId, token } of tokens) {
            try {
                await messaging.send({
                    token,
                    notification: {
                        title: title || 'Grand Line',
                        body: body || 'Nuevo mensaje',
                    },
                    data: {
                        url: '/chat',
                        click_action: '/chat',
                    },
                    webpush: {
                        notification: {
                            icon: '/logos/grandline-isotipo.png',
                            badge: '/logos/grandline-isotipo.png',
                            requireInteraction: false as any,
                        },
                        fcmOptions: {
                            link: '/chat',
                        },
                    },
                });
                sent++;
            } catch (err: any) {
                console.error(`FCM send failed for ${docId}:`, err?.code || err?.message);
                // Remove invalid tokens
                if (err?.code === 'messaging/registration-token-not-registered' ||
                    err?.code === 'messaging/invalid-registration-token' ||
                    err?.code === 'messaging/invalid-argument') {
                    failed.push(docId);
                }
            }
        }

        // Clean up invalid tokens
        for (const docId of failed) {
            await db.collection('fcm_tokens').doc(docId).delete().catch(() => {});
        }

        return NextResponse.json({ sent, total: tokens.length, cleaned: failed.length });
    } catch (error: any) {
        console.error('FCM API error:', error?.message || error);
        return NextResponse.json({ error: error?.message || 'Error enviando push' }, { status: 500 });
    }
}
