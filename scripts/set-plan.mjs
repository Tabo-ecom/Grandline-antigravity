import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { getAuth } from 'firebase-admin/auth';
import { readFileSync } from 'fs';

// Load .env.local manually
const envContent = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envContent.split('\n')) {
    const match = line.match(/^([^=]+)=(.*)$/);
    if (match) {
        env[match[1].trim()] = match[2].trim().replace(/^"|"$/g, '');
    }
}

if (!getApps().length) {
    initializeApp({
        credential: cert({
            projectId: env.FIREBASE_ADMIN_PROJECT_ID,
            clientEmail: env.FIREBASE_ADMIN_CLIENT_EMAIL,
            privateKey: env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
    });
}

const db = getFirestore();
const adminAuth = getAuth();

const email = process.argv[2] || 'ceo@taboecom.com';
const plan = process.argv[3] || 'supernova';

async function setPlan() {
    const user = await adminAuth.getUserByEmail(email);
    console.log(`Found user: ${user.uid} (${user.email})`);

    const updateData = {
        plan,
        subscriptionStatus: plan === 'free' ? 'canceled' : 'active',
        currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        updatedAt: new Date(),
    };

    await db.collection('user_profiles').doc(user.uid).set(updateData, { merge: true });
    console.log(`Plan set to '${plan}' for ${user.email}`);

    const doc = await db.collection('user_profiles').doc(user.uid).get();
    console.log('Profile:', JSON.stringify(doc.data(), null, 2));
}

setPlan().catch(console.error);
