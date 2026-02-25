import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { adminDb } from '@/lib/firebase/admin';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET as string;

// Map Stripe price IDs to plan names
const PRICE_TO_PLAN: Record<string, string> = {
    [process.env.NEXT_PUBLIC_STRIPE_ROOKIE_PRICE_ID || '']: 'rookie',
    [process.env.NEXT_PUBLIC_STRIPE_SUPERNOVA_PRICE_ID || '']: 'supernova',
    [process.env.NEXT_PUBLIC_STRIPE_YONKO_PRICE_ID || '']: 'yonko',
};

function getPlanFromSubscription(subscription: Stripe.Subscription): string {
    const priceId = subscription.items.data[0]?.price?.id;
    return PRICE_TO_PLAN[priceId || ''] || 'rookie';
}

export async function POST(req: NextRequest) {
    const body = await req.text();
    const sig = req.headers.get('stripe-signature');

    let event: Stripe.Event;

    try {
        if (!sig || !endpointSecret) {
            console.error('Webhook secret or signature missing. Rejecting unverified event.');
            return NextResponse.json({ error: 'Webhook signature required' }, { status: 400 });
        }
        event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
    } catch (err: any) {
        console.error(`Webhook Error: ${err.message}`);
        return NextResponse.json({ error: `Webhook Error: ${err.message}` }, { status: 400 });
    }

    try {
        switch (event.type) {
            case 'checkout.session.completed': {
                const session = event.data.object as Stripe.Checkout.Session;

                if (session.subscription) {
                    const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
                    const userId = session.client_reference_id || session.metadata?.userId;
                    const plan = getPlanFromSubscription(subscription);

                    if (userId) {
                        const userRef = adminDb!.collection('user_profiles').doc(userId);
                        await userRef.set({
                            stripeCustomerId: session.customer,
                            subscriptionId: subscription.id,
                            plan,
                            subscriptionStatus: subscription.status,
                            currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
                            updatedAt: new Date(),
                        }, { merge: true });
                        console.log(`User ${userId} subscribed to ${plan} successfully.`);
                    } else {
                        console.error('User ID not found in session for checkout.session.completed');
                    }
                }
                break;
            }
            case 'customer.subscription.updated':
            case 'customer.subscription.deleted': {
                const subscription = event.data.object as Stripe.Subscription;
                const plan = getPlanFromSubscription(subscription);

                const usersSnapshot = await adminDb!.collection('user_profiles')
                    .where('stripeCustomerId', '==', subscription.customer)
                    .limit(1)
                    .get();

                if (!usersSnapshot.empty) {
                    const userDoc = usersSnapshot.docs[0];
                    await userDoc.ref.set({
                        subscriptionStatus: subscription.status,
                        plan: subscription.status === 'active' ? plan : 'free',
                        currentPeriodEnd: new Date((subscription as any).current_period_end * 1000),
                        updatedAt: new Date(),
                    }, { merge: true });
                    console.log(`User ${userDoc.id} subscription updated to ${plan} (${subscription.status}).`);
                } else {
                    console.error(`User not found with Stripe Customer ID: ${subscription.customer}`);
                }
                break;
            }
            default:
                console.log(`Unhandled event type ${event.type}`);
        }

        return NextResponse.json({ received: true });
    } catch (error) {
        console.error('Error processing webhook:', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
