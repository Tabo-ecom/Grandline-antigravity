import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

const PIPELINE_URL = process.env.PIPELINE_API_URL || '';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        const rl = checkRateLimit(`${auth.uid}:pipeline-stores`, { max: 30 });
        if (!rl.success) return rateLimitResponse();

        const res = await fetch(`${PIPELINE_URL}/stores`, {
            headers: { 'Authorization': req.headers.get('Authorization') || '' },
        });
        const data = await res.text();
        return new NextResponse(data, { status: res.status, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return NextResponse.json({ error: 'Error conectando con Pipeline API' }, { status: 500 });
    }
}
