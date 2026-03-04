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
        if (!auth) return unauthorizedResponse();

        const { sessionId } = await req.json();
        if (!sessionId) {
            return NextResponse.json({ error: 'Missing sessionId' }, { status: 400 });
        }

        const session = await stripe.checkout.sessions.retrieve(sessionId);

        // Verify the session belongs to this user
        if (session.client_reference_id !== auth.teamId) {
            return NextResponse.json({ error: 'Session mismatch' }, { status: 403 });
        }

        if (!session.subscription) {
            return NextResponse.json({ error: 'No subscription found' }, { status: 400 });
        }

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0]?.price?.id;
        const plan = PRICE_TO_PLAN[priceId || ''] || 'rookie';

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

        return NextResponse.json({ success: true, plan, status: subscription.status });
    } catch (error: any) {
        console.error('Verify Session Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
