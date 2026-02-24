import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY as string);

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { stripeCustomerId } = await req.json();

        if (!stripeCustomerId) {
            return NextResponse.json({ error: 'Missing stripeCustomerId' }, { status: 400 });
        }

        const session = await stripe.billingPortal.sessions.create({
            customer: stripeCustomerId,
            return_url: `${req.headers.get('origin')}/perfil`,
        });

        if (!session.url) {
            return NextResponse.json({ error: 'Failed to create Stripe Portal Session' }, { status: 500 });
        }

        return NextResponse.json({ url: session.url });
    } catch (error: any) {
        console.error('Stripe Portal Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
