import { NextRequest, NextResponse } from 'next/server';
import { vegaChat } from '@/lib/services/vega/gemini';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const rl = checkRateLimit(`${auth.uid}:vega-chat`, { max: 30 });
        if (!rl.success) return rateLimitResponse();

        const { message, dataContext, chatHistory, kpiTargets } = await req.json();

        if (!message) {
            return NextResponse.json({ error: 'Mensaje requerido' }, { status: 400 });
        }

        const response = await vegaChat(message, dataContext || '', chatHistory || [], kpiTargets);

        return NextResponse.json({ response });
    } catch (error) {
        console.error('Vega chat error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error interno' },
            { status: 500 }
        );
    }
}
