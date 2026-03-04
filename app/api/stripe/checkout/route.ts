import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { priceId, planId } = await req.json();

        if (!priceId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        // Use origin header with fallback to ensure correct app domain
        const origin = req.headers.get('origin') || process.env.NEXT_PUBLIC_APP_URL || 'https://app.grandline.com.co';

        const sessionParams: Stripe.Checkout.SessionCreateParams = {
            payment_method_types: ['card'],
            customer_email: auth.email,
            client_reference_id: auth.teamId,
            line_items: [
                {
                    price: priceId,
                    quantity: 1,
                },
            ],
            mode: 'subscription',
            success_url: `${origin}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${origin}/planes`,
            metadata: {
                userId: auth.teamId,
            },
        };

        // Rookie plan gets a 7-day free trial without requiring a credit card
        if (planId === 'rookie') {
            sessionParams.subscription_data = {
                trial_period_days: 7,
            };
            sessionParams.payment_method_collection = 'if_required';
        }

        const session = await stripe.checkout.sessions.create(sessionParams);

        if (!session.url) {
            return NextResponse.json({ error: 'Failed to create Stripe Checkout Session' }, { status: 500 });
        }

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
