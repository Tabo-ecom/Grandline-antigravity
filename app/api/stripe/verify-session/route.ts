import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase/admin';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const PRICE_TO_PLAN: Record<string, string> = {
    [process.env.NEXT_PUBLIC_STRIPE_ROOKIE_PRICE_ID || '']: 'rookie',
    [process.env.NEXT_PUBLIC_STRIPE_SUPERNOVA_PRICE_ID || '']: 'supernova',
    [process.env.NEXT_PUBLIC_STRIPE_YONKO_PRICE_ID || '']: 'yonko',
};

/**
 * POST /api/stripe/verify-session
 * Called after Stripe checkout redirect to sync the subscription
 * before the webhook arrives (race condition fix).
 */
export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) {
            console.error('[verify-session] Auth failed - no valid token');
            return unauthorizedResponse();
        }

        const { sessionId } = await req.json();
        if (!sessionId) {
            console.error('[verify-session] Missing sessionId');
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        console.log(`[verify-session] Verifying session ${sessionId} for user ${auth.teamId}`);

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Verify the session belongs to this user
        if (session.client_reference_id !== auth.teamId) {
            console.error(`[verify-session] Mismatch: session.client_reference_id=${session.client_reference_id} vs auth.teamId=${auth.teamId}`);
            return NextResponse.json({ error: 'Session mismatch' }, { status: 403 });
        }

        if (!session.subscription) {
            console.error(`[verify-session] No subscription on session. Status: ${session.status}, payment_status: ${session.payment_status}`);
            return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId || ''] || 'rookie';

        console.log(`[verify-session] Plan: ${plan}, Status: ${subscription.status}, User: ${auth.teamId}`);

        // Update Firestore profile immediately
        const userRef = adminDb!.collection('user_profiles').doc(auth.teamId);
        await userRef.set({
            stripeCustomerId: session.customer,
            subscriptionId: subscription.id,
            plan,
            subscriptionStatus: subscription.status,
            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
            updatedAt: new Date(),
        }, { merge: true });

        console.log(`[verify-session] Profile updated successfully for ${auth.teamId}`);
        return NextResponse.json({ success: true, plan, status: subscription.status });
    } catch (error: any) {
        console.error('[verify-session] Error:', error.message, error.stack);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
