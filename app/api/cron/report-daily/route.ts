import { NextRequest, NextResponse } from 'next/server';
import { gatherDataForReport } from '@/lib/services/vega/server-data-gatherer';
import { vegaGenerateReport } from '@/lib/services/vega/gemini';
import { adminGetAppData, adminSetAppData } from '@/lib/firebase/admin-helpers';
import { sendTelegramMessage, sendSlackMessage } from '@/lib/services/vega/notifications';
import type { VegaReport, VegaNotificationConfig } from '@/lib/types/vega';

function fmt(n: number): string {
    return `$${Math.round(n).toLocaleString('en-US')}`;
}

function buildSlackMessage(period: string, kpis: any, metricsByCountry: any[], aiRecommendations: string): string {
    const lines: string[] = [];

    // Header
    lines.push(`🧭 *VEGA — Reporte Diario* (${period})`);
    lines.push('');

    // Resumen
    const cpaDesp = kpis.n_nc > 0 ? kpis.g_ads / kpis.n_nc : 0;
    lines.push('📊 *Resumen*');
    lines.push(`Órdenes: ${kpis.n_ord} | Entregadas: ${kpis.n_ent} (${kpis.tasa_ent.toFixed(1)}%) | Tránsito: ${kpis.n_tra}`);
    lines.push(`Ads: ${fmt(kpis.g_ads)} | ROAS: ${kpis.roas_real.toFixed(2)}x | CPA Desp: ${fmt(cpaDesp)}`);
    lines.push(`Util. Real: ${fmt(kpis.u_real)} | Util. Proy: ${fmt(kpis.utilidad_proyectada || 0)}`);
    lines.push('');

    // Collect all products across countries
    const allProducts: any[] = [];
    metricsByCountry.forEach(c => {
        (c.products || []).forEach((p: any) => {
            allProducts.push({ ...p, country: c.countryName });
        });
    });

    // Top 5 by utilProy (highest first)
    const sorted = [...allProducts].filter(p => p.n_ord > 0).sort((a, b) => (b.utilProy || 0) - (a.utilProy || 0));
    const top5 = sorted.slice(0, 5);
    const bottom5 = sorted.slice(-5).reverse(); // worst first

    lines.push('🟢 *Top 5 Productos (mejor proyección)*');
    top5.forEach(p => {
        const emoji = (p.utilProy || 0) > 0 ? '✅' : '⚠️';
        lines.push(`• ${p.name}: ${p.n_ord} órd | CPA: ${fmt(p.cpa)} | U.Proy: ${fmt(p.utilProy || 0)} ${emoji}`);
    });
    lines.push('');

    lines.push('🔴 *Bottom 5 Productos (peor proyección)*');
    bottom5.forEach(p => {
        lines.push(`• ${p.name}: ${p.n_ord} órd | CPA: ${fmt(p.cpa)} | U.Proy: ${fmt(p.utilProy || 0)} 🔴`);
    });
    lines.push('');

    // Países
    lines.push('🌎 *Países*');
    metricsByCountry.forEach(c => {
        const ck = c.kpis;
        const cUtilProy = (c.products || []).reduce((s: number, p: any) => s + (p.utilProy || 0), 0);
        lines.push(`• ${c.countryName}: ${ck.n_ord} órd | Ent ${ck.tasa_ent.toFixed(1)}% | Ads ${fmt(ck.g_ads)} | U.Proy: ${fmt(cUtilProy)}`);
    });
    lines.push('');

    // AI recommendations
    lines.push('💡 *Recomendaciones*');
    lines.push(aiRecommendations);

    return lines.join('\n');
}

export async function GET(req: NextRequest) {
    // Verify cron secret
    const authHeader = req.headers.get('authorization');
    if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const userId = process.env.CRON_USER_ID;
        if (!userId) {
            return NextResponse.json({ error: 'CRON_USER_ID not configured' }, { status: 500 });
        }

        const { context, period, kpis, metricsByCountry } = await gatherDataForReport('daily', userId);

        // Generate full report for Firestore + Telegram
        const content = await vegaGenerateReport('daily', context, period);

        const report: VegaReport = {
            id: `cron_daily_${Date.now()}`,
            type: 'daily',
            title: `El Latido del Negocio — ${period}`,
            content,
            generatedAt: Date.now(),
            period,
            automated: true,
            schedule: 'daily',
        };

        // Save report via Admin SDK (under user's own account)
        const existing = await adminGetAppData<VegaReport[]>('vega_reports', userId) || [];
        existing.unshift(report);
        await adminSetAppData('vega_reports', existing.slice(0, 50), userId);

        // Get notification config via Admin SDK
        const config = await adminGetAppData<VegaNotificationConfig>('vega_notification_config', userId) || {
            telegramBotToken: '', telegramChatId: '', slackWebhookUrl: '',
        };

        const channels: string[] = [];

        // Telegram gets the full report
        if (config.telegramBotToken && config.telegramChatId) {
            channels.push('telegram');
            await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, content);
        }

        // Slack: build structured message in code + AI recommendations only
        if (config.slackWebhookUrl) {
            channels.push('slack');
            let aiRecs = '1. Revisar productos con utilidad negativa\n2. Optimizar CPA en productos de mayor gasto\n3. Evaluar escalamiento de productos rentables';
            try {
                aiRecs = await vegaGenerateReport('slack_recommendations', context, period);
            } catch { /* fallback to default recs */ }
            const slackContent = buildSlackMessage(period, kpis, metricsByCountry, aiRecs);
            await sendSlackMessage(config.slackWebhookUrl, slackContent);
        }

        report.sentVia = channels as ('telegram' | 'slack')[];

        return NextResponse.json({ success: true, reportId: report.id, sentVia: channels });
    } catch (error: any) {
        console.error('Cron daily report error:', error);
        return NextResponse.json({ error: error?.message || 'Error generating daily report' }, { status: 500 });
    }
}
