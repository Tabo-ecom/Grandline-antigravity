import { NextRequest, NextResponse } from 'next/server';
import { vegaGenerateReport } from '@/lib/services/vega/gemini';
import { getReportHistory, saveReport } from '@/lib/services/vega/reports';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import type { VegaReport } from '@/lib/types/vega';

export async function GET(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const reports = await getReportHistory(auth.teamId);
        return NextResponse.json({ reports });
    } catch (error) {
        console.error('Error fetching reports:', error);
        return NextResponse.json({ error: 'Error al obtener reportes' }, { status: 500 });
    }
}

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { type, dataContext, period, kpiTargets } = await req.json();

        if (!type) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        const content = await vegaGenerateReport(type, dataContext || '', period || 'Actual', kpiTargets);

        const report: VegaReport = {
            id: `report_${Date.now()}`,
            type,
            title: `Reporte ${type === 'daily' ? 'Diario' : type === 'weekly' ? 'Semanal' : type === 'monthly' ? 'Mensual' : type} - ${period || new Date().toLocaleDateString('es-CO')}`,
            content,
            generatedAt: Date.now(),
            period: period || new Date().toLocaleDateString('es-CO'),
        };

        await saveReport(report, auth.teamId);

        return NextResponse.json({ report });
    } catch (error) {
        console.error('Error generating report:', error);
        return NextResponse.json({ error: 'Error al generar reporte' }, { status: 500 });
    }
}
