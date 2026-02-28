import { NextRequest, NextResponse } from 'next/server';
import { vegaGenerateReport } from '@/lib/services/vega/gemini';
import { getReportHistory, saveReport, deleteReport } from '@/lib/services/vega/reports';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';
import { calculateOverallHealth } from '@/lib/utils/health';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';
import type { VegaReport, VegaReportMetadata } from '@/lib/types/vega';

const REPORT_TITLES: Record<string, string> = {
    daily: 'El Latido del Negocio',
    weekly: 'La Brújula Táctica',
    monthly: 'La Visión del Almirante',
};

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

        const rl = checkRateLimit(`${auth.uid}:vega-reports`, { max: 5 });
        if (!rl.success) return rateLimitResponse();

        const { type, dataContext, period, kpiTargets, kpis, metricsByCountry, adPlatformMetrics, prevKpis, berryExpenses } = await req.json();

        if (!type) {
            return NextResponse.json({ error: 'Datos incompletos' }, { status: 400 });
        }

        const contextStr = dataContext || '';
        console.log(`[Vega Reports] Generating ${type} report. Context size: ${contextStr.length} chars`);

        const content = await vegaGenerateReport(type, contextStr, period || 'Actual', kpiTargets);
        console.log(`[Vega Reports] Report generated. Content size: ${content.length} chars`);

        // Build metadata for visual rendering (map dashboard field names to VegaReportMetadata format)
        let metadata: VegaReportMetadata | undefined;
        if (kpis) {
            const healthScore = calculateOverallHealth(kpis, kpiTargets || DEFAULT_KPI_TARGETS);
            const mappedCountries = (metricsByCountry || []).map((c: any) => ({
                countryName: c.name || c.countryName,
                kpis: c.kpis || {
                    n_ord: c.orderCount || 0,
                    tasa_ent: c.deliveryRate || 0,
                    tasa_can: c.cancelRate || 0,
                    g_ads: c.adSpend || 0,
                    u_real: c.profit || 0,
                    fact_neto: c.sales || 0,
                },
                products: (c.products || []).map((p: any) => ({
                    id: p.id,
                    name: p.name,
                    n_ord: p.orderCount ?? p.n_ord ?? 0,
                    n_ent: p.n_ent ?? Math.round((p.deliveryRate || 0) * (p.orderCount || 0) / 100),
                    n_can: p.n_can ?? Math.round((p.cancelRate || 0) * (p.orderCount || 0) / 100),
                    n_dev: p.n_dev ?? 0,
                    n_tra: p.n_tra ?? Math.round((p.transitRate || 0) * (p.orderCount || 0) / 100),
                    tasa_ent: p.tasa_ent ?? p.deliveryRate ?? 0,
                    ads: p.ads ?? p.adSpend ?? 0,
                    cpa: p.cpa ?? 0,
                    cpaDesp: p.cpaDesp ?? p.cpa ?? 0,
                    utilReal: p.utilReal ?? p.profit ?? 0,
                    utilProy: p.utilProy ?? p.projectedProfit ?? 0,
                })),
            }));
            metadata = {
                healthScore,
                kpis,
                metricsByCountry: mappedCountries,
                adPlatformMetrics,
                prevKpis,
                berryExpenses: berryExpenses || undefined,
            };
        }

        const titleBase = REPORT_TITLES[type] || `Reporte ${type}`;
        const report: VegaReport = {
            id: `report_${Date.now()}`,
            type,
            title: `${titleBase} — ${period || new Date().toLocaleDateString('es-CO')}`,
            content,
            generatedAt: Date.now(),
            period: period || new Date().toLocaleDateString('es-CO'),
            metadata,
        };

        await saveReport(report, auth.teamId);

        return NextResponse.json({ report });
    } catch (error: any) {
        console.error('Error generating report:', error);
        const message = error?.message || 'Error desconocido al generar reporte';
        return NextResponse.json({ error: message }, { status: 500 });
    }
}

export async function DELETE(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const { reportId } = await req.json();
        if (!reportId) {
            return NextResponse.json({ error: 'reportId requerido' }, { status: 400 });
        }

        await deleteReport(reportId, auth.teamId);
        return NextResponse.json({ success: true });
    } catch (error) {
        console.error('Error deleting report:', error);
        return NextResponse.json({ error: 'Error al eliminar reporte' }, { status: 500 });
    }
}
