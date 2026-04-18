/**
 * Vega AI - Shared Report Generator
 * Extracted from cron routes to support multi-user dispatcher
 */

import { gatherDataForReport } from '@/lib/services/vega/server-data-gatherer';
import { vegaGenerateReport } from '@/lib/services/vega/gemini';
import { adminGetAppData, adminSetAppData } from '@/lib/firebase/admin-helpers';
import { sendTelegramMessage, sendSlackMessage } from '@/lib/services/vega/notifications';
import { sendReportEmail } from '@/lib/services/vega/email';
import { buildReportEmailHTML } from '@/lib/services/vega/email-template';
import { calculateOverallHealth } from '@/lib/utils/health';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';
import { adminAuth } from '@/lib/firebase/admin';
import type { VegaReport, VegaNotificationConfig, VegaReportMetadata, ReportType } from '@/lib/types/vega';
import { REPORT_COLOR_MAP } from '@/lib/types/vega';

const REPORT_TITLES: Record<string, string> = {
    daily: 'El Latido del Negocio',
    weekly: 'La Brújula Táctica',
    monthly: 'La Visión del Almirante',
    logistics: 'Bitácora Logística',
    financial: 'Estado de Resultados',
    supplier: 'Reporte Proveedor',
    month_close: 'Cierre de Mes',
};

function fmt(n: number): string {
    return `$${Math.round(n).toLocaleString('en-US')}`;
}

function buildDailySlackMessage(period: string, kpis: any, metricsByCountry: any[], aiRecs: string): string {
    const lines: string[] = [];

    lines.push(`🧭 *VEGA — Reporte Diario* (${period})`);
    lines.push('');

    const cpaDesp = kpis.n_nc > 0 ? kpis.g_ads / kpis.n_nc : 0;
    lines.push('📊 *Resumen*');
    lines.push(`Órdenes: ${kpis.n_ord} | Entregadas: ${kpis.n_ent} (${kpis.tasa_ent.toFixed(1)}%) | Tránsito: ${kpis.n_tra}`);
    lines.push(`Ads: ${fmt(kpis.g_ads)} | ROAS: ${kpis.roas_real.toFixed(2)}x | CPA Desp: ${fmt(cpaDesp)}`);
    lines.push(`Util. Real: ${fmt(kpis.u_real)} | Util. Proy: ${fmt(kpis.utilidad_proyectada || 0)}`);
    lines.push('');

    const allProducts: any[] = [];
    metricsByCountry.forEach(c => {
        (c.products || []).forEach((p: any) => {
            allProducts.push({ ...p, country: c.countryName });
        });
    });

    const sorted = [...allProducts].filter(p => p.n_ord > 0).sort((a, b) => (b.utilProy || 0) - (a.utilProy || 0));
    const top5 = sorted.slice(0, 5);
    const bottom5 = sorted.slice(-5).reverse();

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

    lines.push('🌎 *Países*');
    metricsByCountry.forEach(c => {
        const ck = c.kpis;
        const cUtilProy = (c.products || []).reduce((s: number, p: any) => s + (p.utilProy || 0), 0);
        lines.push(`• ${c.countryName}: ${ck.n_ord} órd | Ent ${ck.tasa_ent.toFixed(1)}% | Ads ${fmt(ck.g_ads)} | U.Proy: ${fmt(cUtilProy)}`);
    });
    lines.push('');

    lines.push('💡 *Recomendaciones*');
    lines.push(aiRecs);

    return lines.join('\n');
}

export async function generateAndSendReport(
    userId: string,
    reportType: ReportType,
): Promise<{ reportId: string; sentVia: string[] }> {
    const { context, period, kpis, metricsByCountry, adPlatformMetrics, prevKpis, supplierKpis, cancelReasons, carrierBreakdown, pnl } = await gatherDataForReport(reportType, userId);
    const content = await vegaGenerateReport(reportType, context, period);

    const healthScore = calculateOverallHealth(kpis, DEFAULT_KPI_TARGETS);
    const metadata: VegaReportMetadata = {
        healthScore, kpis, metricsByCountry, adPlatformMetrics, prevKpis,
        supplierKpis: supplierKpis as any || undefined,
        cancelReasons: cancelReasons as any || undefined,
        carrierBreakdown: carrierBreakdown as any || undefined,
        pnlCascade: pnl as any || undefined,
    };

    const scheduleMap: Record<string, VegaReport['schedule']> = {
        daily: 'daily',
        weekly: 'weekly_monday',
        monthly: `monthly_${new Date().getDate()}` as any,
        logistics: 'daily',
        financial: 'weekly_friday',
        supplier: 'weekly_monday',
        month_close: 'monthly_1',
    };

    const report: VegaReport = {
        id: `cron_${reportType}_${Date.now()}`,
        type: reportType,
        title: `${REPORT_TITLES[reportType] || reportType} — ${period}`,
        content,
        generatedAt: Date.now(),
        period,
        automated: true,
        schedule: scheduleMap[reportType],
        metadata,
    };

    // Save report
    const existing = await adminGetAppData<VegaReport[]>('vega_reports', userId) || [];
    existing.unshift(report);
    await adminSetAppData('vega_reports', existing.slice(0, 50), userId);

    // Get notification config
    const config = await adminGetAppData<VegaNotificationConfig>('vega_notification_config', userId) || {
        telegramBotToken: '', telegramChatId: '', slackWebhookUrl: '',
    };

    const channels: string[] = [];

    // Telegram: full report
    if (config.telegramBotToken && config.telegramChatId) {
        channels.push('telegram');
        await sendTelegramMessage(config.telegramBotToken, config.telegramChatId, content);
    }

    // Slack: daily gets structured message, weekly/monthly get full content
    if (config.slackWebhookUrl) {
        channels.push('slack');
        if (reportType === 'daily') {
            let aiRecs = '1. Revisar productos con utilidad negativa\n2. Optimizar CPA en productos de mayor gasto\n3. Evaluar escalamiento de productos rentables';
            try {
                aiRecs = await vegaGenerateReport('slack_recommendations', context, period);
            } catch { /* fallback */ }
            const slackContent = buildDailySlackMessage(period, kpis, metricsByCountry, aiRecs);
            await sendSlackMessage(config.slackWebhookUrl, slackContent);
        } else {
            await sendSlackMessage(config.slackWebhookUrl, content);
        }
    }

    // Email
    if (config.emailEnabled && adminAuth) {
        try {
            const accentColor = REPORT_COLOR_MAP[reportType] || '#d75c33';
            const html = buildReportEmailHTML(report, accentColor);
            const subject = `VEGA — ${report.title}`;

            // Multi-recipient: use config.emailRecipients if available, fallback to user email
            const recipients: string[] = [];
            if (config.emailRecipients && config.emailRecipients.length > 0) {
                recipients.push(...config.emailRecipients);
            } else {
                const userRecord = await adminAuth.getUser(userId);
                if (userRecord.email) recipients.push(userRecord.email);
            }

            if (recipients.length > 0) {
                channels.push('email');
                for (const email of recipients) {
                    await sendReportEmail(email, subject, html);
                }
            }
        } catch { /* email error */ }
    }

    report.sentVia = channels as ('telegram' | 'slack' | 'email')[];

    return { reportId: report.id, sentVia: channels };
}
