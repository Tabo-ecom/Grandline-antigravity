import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

const PIPELINE_URL = process.env.PIPELINE_API_URL || '';

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        const rl = checkRateLimit(`${auth.uid}:pipeline-images`, { max: 10, windowMs: 300_000 });
        if (!rl.success) return rateLimitResponse();

        const body = await req.json();
        const res = await fetch(`${PIPELINE_URL}/images`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': req.headers.get('Authorization') || '' },
            body: JSON.stringify(body),
        });
        const data = await res.text();
        return new NextResponse(data, { status: res.status, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return NextResponse.json({ error: 'Error conectando con Pipeline API' }, { status: 500 });
    }
}
