import { initializeApp, getApps, cert } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK (server-side only)
const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY;

const isConfigured = projectId && clientEmail && privateKey;

if (isConfigured && !getApps().length) {
    initializeApp({
        credential: cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
    });
}

export const adminAuth = isConfigured ? getAuth() : null;
export const adminDb = isConfigured ? getFirestore() : null;
