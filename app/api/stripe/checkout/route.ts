import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { priceId } = await req.json();

        if (!priceId) {
            return NextResponse.json({ error: 'Missing required parameters' }, { status: 400 });
        }

        const session = await stripe.checkout.sessions.create({
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
            success_url: `${req.headers.get('origin')}/dashboard?session_id={CHECKOUT_SESSION_ID}`,
            cancel_url: `${req.headers.get('origin')}/planes`,
            metadata: {
                userId: auth.teamId,
            },
        });

        if (!session.url) {
            return NextResponse.json({ error: 'Failed to create Stripe Checkout Session' }, { status: 500 });
        }

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe Checkout Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
