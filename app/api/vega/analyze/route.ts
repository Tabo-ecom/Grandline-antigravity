import { NextRequest, NextResponse } from 'next/server';
import { vegaAnalyze } from '@/lib/services/vega/gemini';

export async function POST(req: NextRequest) {
    try {
        const { type, dataContext, kpiTargets } = await req.json();

        if (!type) {
            return NextResponse.json({ error: 'Tipo de análisis requerido' }, { status: 400 });
        }

        const response = await vegaAnalyze(type, dataContext || '', kpiTargets);

        return NextResponse.json({ response });
    } catch (error) {
        console.error('Vega analyze error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error interno' },
            { status: 500 }
        );
    }
}
