import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

const PIPELINE_URL = process.env.PIPELINE_API_URL || '';

export async function GET(req: NextRequest, { params }: { params: Promise<{ jobId: string }> }) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();
        const rl = checkRateLimit(`${auth.uid}:pipeline-jobs`, { max: 120 });
        if (!rl.success) return rateLimitResponse();

        const { jobId } = await params;
        const res = await fetch(`${PIPELINE_URL}/jobs/${jobId}`, {
            headers: { 'Authorization': req.headers.get('Authorization') || '' },
        });
        const data = await res.text();
        return new NextResponse(data, { status: res.status, headers: { 'Content-Type': 'application/json' } });
    } catch (error) {
        return NextResponse.json({ error: 'Error consultando job' }, { status: 500 });
    }
}
