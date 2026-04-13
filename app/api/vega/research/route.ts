import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';
import { runResearch } from '@/lib/services/vega/research';
import { createId } from '@/lib/services/vega';

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const rl = checkRateLimit(`${auth.uid}:vega-research`, { max: 5, windowMs: 300_000 });
        if (!rl.success) return rateLimitResponse();

        const { productName, referenceUrl, productUrl, country } = await req.json();

        if (!productName || (!referenceUrl && !productUrl)) {
            return NextResponse.json({ error: 'Nombre del producto y al menos una URL son requeridos' }, { status: 400 });
        }

        // Run the research (scrape + AI analysis)
        const result = await runResearch(productName, referenceUrl || '', productUrl || '', country || 'Colombia');

        // Build research object (frontend saves to Firestore)
        const research = {
            id: createId(),
            productName,
            referenceUrl,
            productUrl,
            country: country || 'Colombia',
            status: 'completed' as const,
            progress: 'Investigación completada',
            niche: result.niche,
            store: '',
            productImages: result.productImages,
            scrapedData: result.scrapedData,
            report: result.report,
            error: null,
            createdAt: Date.now(),
            updatedAt: Date.now(),
        };

        return NextResponse.json({ research });
    } catch (error: any) {
        console.error('Research error:', error);
        return NextResponse.json(
            { error: error.message || 'Error en la investigación' },
            { status: 500 }
        );
    }
}
