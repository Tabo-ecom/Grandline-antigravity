import { NextRequest, NextResponse } from 'next/server';
import { vegaAnalyze } from '@/lib/services/vega/gemini';
import { saveReport } from '@/lib/services/vega/reports';
import { verifyAuth, unauthorizedResponse } from '@/lib/api/auth';
import { checkRateLimit, rateLimitResponse } from '@/lib/api/rate-limit';
import { calculateOverallHealth } from '@/lib/utils/health';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';
import type { VegaReport, VegaReportMetadata } from '@/lib/types/vega';

const ANALYSIS_TITLES: Record<string, string> = {
    audit: 'Auditoría Completa',
    efficiency: 'Eficiencia Operativa',
    ads: 'Rendimiento en Ads',
    profitability: 'Análisis de Rentabilidad',
    forecast: 'Pronóstico',
};

export async function POST(req: NextRequest) {
    try {
        const auth = await verifyAuth(req);
        if (!auth) return unauthorizedResponse();

        const rl = checkRateLimit(`${auth.uid}:vega-analyze`, { max: 10 });
        if (!rl.success) return rateLimitResponse();

        const { type, dataContext, kpiTargets, kpis, metricsByCountry, adPlatformMetrics, prevKpis, period, berryExpenses } = await req.json();

        if (!type) {
            return NextResponse.json({ error: 'Tipo de análisis requerido' }, { status: 400 });
        }

        const response = await vegaAnalyze(type, dataContext || '', kpiTargets);

        // Build metadata and save to Firestore
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

        const titleBase = ANALYSIS_TITLES[type] || `Análisis ${type}`;
        const periodLabel = period || new Date().toLocaleDateString('es-CO');
        const report: VegaReport = {
            id: `analysis_${Date.now()}`,
            type: type as VegaReport['type'],
            title: `${titleBase} — ${periodLabel}`,
            content: response,
            generatedAt: Date.now(),
            period: periodLabel,
            metadata,
        };

        await saveReport(report, auth.teamId);

        return NextResponse.json({ report });
    } catch (error) {
        console.error('Vega analyze error:', error);
        return NextResponse.json(
            { error: error instanceof Error ? error.message : 'Error interno' },
            { status: 500 }
        );
    }
}
