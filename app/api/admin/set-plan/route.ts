import { NextRequest, NextResponse } from 'next/server';
import { adminDb, adminAuth } from '@/lib/firebase/admin';

/**
 * POST /api/admin/set-plan
 * Manually set a user's plan in Firestore (bypasses Stripe).
 * Useful for testing and admin overrides.
 *
 * Body: { email: string, plan: 'rookie' | 'supernova' | 'yonko' | 'free' }
 * Auth: Bearer token must belong to an admin user (ceo@taboecom.com)
 */
export async function POST(req: NextRequest) {
    if (!adminDb || !adminAuth) {
        return NextResponse.json({ error: 'Firebase Admin not configured' }, { status: 500 });
    }

    // Verify the caller is an admin
    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);

        // Only allow admin emails
        const adminEmails = ['ceo@taboecom.com'];
        if (!adminEmails.includes(decoded.email || '')) {
            return NextResponse.json({ error: 'Only admins can set plans' }, { status: 403 });
        }

        const { email, plan } = await req.json();

        if (!email || !plan) {
            return NextResponse.json({ error: 'Missing email or plan' }, { status: 400 });
        }

        const validPlans = ['free', 'rookie', 'supernova', 'yonko'];
        if (!validPlans.includes(plan)) {
            return NextResponse.json({ error: `Invalid plan. Valid: ${validPlans.join(', ')}` }, { status: 400 });
        }

        // Find the user by email in Firebase Auth
        let targetUser;
        try {
            targetUser = await adminAuth.getUserByEmail(email);
        } catch {
            return NextResponse.json({ error: `User not found: ${email}` }, { status: 404 });
        }

        const userRef = adminDb.collection('user_profiles').doc(targetUser.uid);
        const updateData: Record<string, any> = {
            plan,
            subscriptionStatus: plan === 'free' ? 'canceled' : 'active',
            updatedAt: new Date(),
        };

        if (plan !== 'free') {
            // Set a future expiration (30 days from now)
            updateData.currentPeriodEnd = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
        }

        await userRef.set(updateData, { merge: true });

        return NextResponse.json({
            success: true,
            user: email,
            uid: targetUser.uid,
            plan,
            status: updateData.subscriptionStatus,
        });
    } catch (error: any) {
        console.error('[set-plan] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
