/**
 * Vega AI - HTML Email Template Builder
 * Generates email-safe HTML with inline CSS matching the VEGA report design.
 */

import type { VegaReport, VegaReportMetadata } from '@/lib/types/vega';

// Colors matching the app theme
const C = {
    bg: '#0A0A0F',
    cardBg: '#141821',
    border: '#1e293b',
    accent: '#d75c33',
    text: '#ededed',
    muted: '#6b7280',
    green: '#10b981',
    orange: '#f59e0b',
    red: '#ef4444',
    blue: '#3b82f6',
    purple: '#8b5cf6',
};

function fmt(n: number): string {
    if (Math.abs(n) >= 1000) return `$${Math.round(n).toLocaleString('en-US')}`;
    return `$${Math.round(n)}`;
}

function pct(n: number): string {
    return `${n.toFixed(1)}%`;
}

function healthColor(level: string): string {
    switch (level) {
        case 'EXCELENTE': case 'MUY BUENO': return C.green;
        case 'BUENO': return C.blue;
        case 'ALERTA': return C.orange;
        case 'CRITICO': return C.red;
        default: return C.muted;
    }
}

function kpiColor(value: number, isGoodWhenHigh: boolean): string {
    if (isGoodWhenHigh) return value > 0 ? C.green : C.red;
    return C.blue;
}

function buildHeader(report: VegaReport, meta: VegaReportMetadata): string {
    const color = healthColor(meta.healthScore.level);
    const reportLabel = report.type === 'daily' ? 'REPORTE DIARIO' : report.type === 'weekly' ? 'REPORTE SEMANAL' : 'REPORTE MENSUAL';

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, rgba(215,92,51,0.08) 0%, transparent 100%); border: 1px solid ${C.border}; border-radius: 16px; margin-bottom: 24px;">
        <tr><td style="padding: 40px 32px; text-align: center;">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; color: ${C.accent}; margin-bottom: 8px;">${reportLabel}</div>
            <div style="font-size: 28px; font-weight: 800; color: ${C.text}; margin-bottom: 6px;">${report.title}</div>
            <div style="font-size: 14px; color: ${C.muted}; margin-bottom: 16px;">${report.period}</div>
            <table cellpadding="0" cellspacing="0" style="margin: 0 auto;"><tr><td style="padding: 8px 20px; border: 2px solid ${color}40; border-radius: 12px; background: ${color}15;">
                <span style="display: inline-block; width: 10px; height: 10px; border-radius: 50%; background: ${color}; margin-right: 8px; vertical-align: middle;"></span>
                <span style="font-size: 13px; font-weight: 800; letter-spacing: 0.1em; color: ${color}; vertical-align: middle;">${meta.healthScore.level}</span>
            </td></tr></table>
        </td></tr>
    </table>`;
}

function buildHeroKPIs(report: VegaReport, meta: VegaReportMetadata): string {
    const k = meta.kpis;
    const isDaily = report.type === 'daily';

    const cards: { label: string; value: string; color: string }[] = isDaily
        ? [
            { label: 'UTIL. PROYECTADA', value: fmt(k.utilidad_proyectada || 0), color: (k.utilidad_proyectada || 0) > 0 ? C.green : C.red },
            { label: 'ROAS REAL', value: `${(k.roas_real || 0).toFixed(2)}x`, color: (k.roas_real || 0) >= 2 ? C.green : (k.roas_real || 0) >= 1.5 ? C.orange : C.red },
            { label: 'CPA', value: fmt(k.cpa || 0), color: C.blue },
        ]
        : [
            { label: 'UTILIDAD REAL', value: fmt(k.u_real || 0), color: (k.u_real || 0) > 0 ? C.green : C.red },
            { label: 'ROAS REAL', value: `${(k.roas_real || 0).toFixed(2)}x`, color: (k.roas_real || 0) >= 2 ? C.green : (k.roas_real || 0) >= 1.5 ? C.orange : C.red },
            { label: 'TASA ENTREGA', value: pct(k.tasa_ent || 0), color: (k.tasa_ent || 0) >= 70 ? C.green : (k.tasa_ent || 0) >= 50 ? C.orange : C.red },
            { label: 'CPA', value: fmt(k.cpa || 0), color: C.blue },
        ];

    const width = isDaily ? '33%' : '25%';
    const cardHtml = cards.map(c => `
        <td width="${width}" style="padding: 4px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; border-top: 3px solid ${c.color};">
                <tr><td style="padding: 20px; text-align: center;">
                    <div style="font-size: 10px; font-weight: 700; letter-spacing: 0.15em; color: ${C.muted}; margin-bottom: 8px;">${c.label}</div>
                    <div style="font-size: 24px; font-weight: 800; color: ${C.text};">${c.value}</div>
                </td></tr>
            </table>
        </td>`).join('');

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>${cardHtml}</tr>
    </table>`;
}

function buildAlerts(content: string): string {
    const alertRegex = /\[(CRITICA|ATENCION|INFO)\]\s*(.+)/g;
    const alerts: { level: string; message: string }[] = [];
    let match;
    while ((match = alertRegex.exec(content)) !== null) {
        alerts.push({ level: match[1], message: match[2] });
    }
    if (alerts.length === 0) return '';

    const rows = alerts.map(a => {
        const color = a.level === 'CRITICA' ? C.red : a.level === 'ATENCION' ? C.orange : C.blue;
        const emoji = a.level === 'CRITICA' ? '🔴' : a.level === 'ATENCION' ? '🟡' : '🔵';
        return `<tr><td style="padding: 10px 16px; border-bottom: 1px solid ${C.border};">
            <span style="font-size: 12px;">${emoji}</span>
            <span style="font-size: 11px; font-weight: 700; color: ${color}; letter-spacing: 0.1em; margin-right: 8px;">${a.level}</span>
            <span style="font-size: 13px; color: ${C.text};">${a.message}</span>
        </td></tr>`;
    }).join('');

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
        <tr><td style="padding: 12px 16px; background: rgba(239,68,68,0.08); border-bottom: 1px solid ${C.border};">
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.red};">ALERTAS</span>
        </td></tr>
        ${rows}
    </table>`;
}

function buildProducts(meta: VegaReportMetadata): string {
    const allProducts: any[] = [];
    (meta.metricsByCountry || []).forEach(c => {
        (c.products || []).forEach((p: any) => {
            allProducts.push({ ...p, country: c.countryName });
        });
    });

    const profit = allProducts.filter(p => (p.utilProy || 0) > 0).sort((a, b) => (b.utilProy || 0) - (a.utilProy || 0));
    const loss = allProducts.filter(p => (p.utilProy || 0) <= 0).sort((a, b) => (a.utilProy || 0) - (b.utilProy || 0));

    function productRows(products: any[], isProfit: boolean): string {
        if (products.length === 0) return `<tr><td style="padding: 12px 16px; color: ${C.muted}; font-size: 12px;">Sin productos</td></tr>`;
        return products.slice(0, 8).map(p => {
            const streak = !isProfit && p.lossStreak && p.lossStreak >= 2
                ? `<span style="font-size: 10px; padding: 2px 6px; background: ${C.red}20; border: 1px solid ${C.red}40; border-radius: 6px; color: ${C.red}; margin-left: 4px;">🔥 ${p.lossStreak}d</span>`
                : '';
            return `<tr><td style="padding: 8px 16px; border-bottom: 1px solid ${C.border};">
                <div style="font-size: 12px; font-weight: 600; color: ${C.text}; margin-bottom: 2px;">${p.name} ${streak}</div>
                <div style="font-size: 11px; color: ${C.muted};">${p.n_ord} órd · CPA ${fmt(p.cpa || 0)} · U.Proy <span style="color: ${isProfit ? C.green : C.red}; font-weight: 700;">${fmt(p.utilProy || 0)}</span></div>
            </td></tr>`;
        }).join('');
    }

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="margin-bottom: 24px;">
        <tr>
            <td width="50%" style="padding-right: 8px; vertical-align: top;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden;">
                    <tr><td style="padding: 12px 16px; background: ${C.green}10; border-bottom: 1px solid ${C.border};">
                        <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.green};">GENERANDO GANANCIA (${profit.length})</span>
                    </td></tr>
                    ${productRows(profit, true)}
                </table>
            </td>
            <td width="50%" style="padding-left: 8px; vertical-align: top;">
                <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; overflow: hidden;">
                    <tr><td style="padding: 12px 16px; background: ${C.red}10; border-bottom: 1px solid ${C.border};">
                        <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.red};">GENERANDO PÉRDIDA (${loss.length})</span>
                    </td></tr>
                    ${productRows(loss, false)}
                </table>
            </td>
        </tr>
    </table>`;
}

function buildAdsSummary(meta: VegaReportMetadata): string {
    const ads = meta.adPlatformMetrics;
    if (!ads) return '';

    const total = (ads.fb || 0) + (ads.tiktok || 0) + (ads.google || 0);
    if (total === 0) return '';

    const revenue = meta.kpis.fact_neto || meta.kpis.ing_real || 1;
    const pctAds = ((total / revenue) * 100).toFixed(1);
    const fbPct = ((ads.fb / total) * 100).toFixed(0);
    const tkPct = ((ads.tiktok / total) * 100).toFixed(0);

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
        <tr><td style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.purple};">RESUMEN PUBLICITARIO</span>
        </td></tr>
        <tr><td style="padding: 16px;">
            <div style="font-size: 22px; font-weight: 800; color: ${C.text}; margin-bottom: 4px;">${fmt(total)}</div>
            <div style="font-size: 11px; color: ${C.muted}; margin-bottom: 16px;">Gasto Total · ${pctAds}% de facturación</div>
            <table width="100%" cellpadding="0" cellspacing="0">
                <tr>
                    <td style="padding: 8px 0;">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 3px; background: ${C.blue}; margin-right: 8px; vertical-align: middle;"></span>
                        <span style="font-size: 12px; color: ${C.text}; vertical-align: middle;">Facebook</span>
                        <span style="font-size: 12px; font-weight: 700; color: ${C.text}; float: right;">${fmt(ads.fb)} (${fbPct}%)</span>
                    </td>
                </tr>
                <tr>
                    <td style="padding: 8px 0; border-top: 1px solid ${C.border};">
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 3px; background: ${C.accent}; margin-right: 8px; vertical-align: middle;"></span>
                        <span style="font-size: 12px; color: ${C.text}; vertical-align: middle;">TikTok</span>
                        <span style="font-size: 12px; font-weight: 700; color: ${C.text}; float: right;">${fmt(ads.tiktok)} (${tkPct}%)</span>
                    </td>
                </tr>
            </table>
        </td></tr>
    </table>`;
}

function buildCountries(meta: VegaReportMetadata): string {
    const countries = meta.metricsByCountry || [];
    if (countries.length === 0) return '';

    const rows = countries.map(c => {
        const ck = c.kpis;
        const utilProy = (c.products || []).reduce((s: number, p: any) => s + (p.utilProy || 0), 0);
        return `<tr>
            <td style="padding: 10px 16px; border-bottom: 1px solid ${C.border}; font-size: 13px; font-weight: 600; color: ${C.text};">${c.countryName}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: center;">${ck.n_ord || 0}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: center;">${pct(ck.tasa_ent || 0)}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: center;">${fmt(ck.g_ads || 0)}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; font-weight: 700; color: ${utilProy > 0 ? C.green : C.red}; text-align: right;">${fmt(utilProy)}</td>
        </tr>`;
    }).join('');

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
        <tr><td colspan="5" style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.blue};">PAÍSES</span>
        </td></tr>
        <tr style="background: rgba(255,255,255,0.02);">
            <td style="padding: 8px 16px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em;">PAÍS</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">ÓRDENES</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">ENTREGA</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">ADS</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">U.PROY</td>
        </tr>
        ${rows}
    </table>`;
}

function buildNarrative(content: string): string {
    // Extract sections from AI content (skip EXECUTIVE_SUMMARY and ALERTS which are handled separately)
    const lines = content.split('\n');
    const sections: { title: string; body: string }[] = [];
    let currentTitle = '';
    let currentBody: string[] = [];

    for (const line of lines) {
        if (line.startsWith('## ')) {
            if (currentTitle && currentBody.length > 0) {
                sections.push({ title: currentTitle, body: currentBody.join('\n') });
            }
            currentTitle = line.replace('## ', '').trim();
            currentBody = [];
        } else if (!line.startsWith('<!--') && !line.startsWith('[CRITICA]') && !line.startsWith('[ATENCION]') && !line.startsWith('[INFO]')) {
            currentBody.push(line);
        }
    }
    if (currentTitle && currentBody.length > 0) {
        sections.push({ title: currentTitle, body: currentBody.join('\n') });
    }

    if (sections.length === 0) return '';

    return sections.map(s => {
        // Convert action tags to styled spans
        let body = s.body
            .replace(/\[ESCALAR\]/g, `<span style="display: inline-block; padding: 2px 8px; background: ${C.green}20; border: 1px solid ${C.green}40; border-radius: 6px; font-size: 10px; font-weight: 800; color: ${C.green}; letter-spacing: 0.05em; margin-right: 4px;">ESCALAR</span>`)
            .replace(/\[PAUSAR\]/g, `<span style="display: inline-block; padding: 2px 8px; background: ${C.red}20; border: 1px solid ${C.red}40; border-radius: 6px; font-size: 10px; font-weight: 800; color: ${C.red}; letter-spacing: 0.05em; margin-right: 4px;">PAUSAR</span>`)
            .replace(/\[OPTIMIZAR\]/g, `<span style="display: inline-block; padding: 2px 8px; background: ${C.orange}20; border: 1px solid ${C.orange}40; border-radius: 6px; font-size: 10px; font-weight: 800; color: ${C.orange}; letter-spacing: 0.05em; margin-right: 4px;">OPTIMIZAR</span>`)
            .replace(/\[MONITOREAR\]/g, `<span style="display: inline-block; padding: 2px 8px; background: ${C.blue}20; border: 1px solid ${C.blue}40; border-radius: 6px; font-size: 10px; font-weight: 800; color: ${C.blue}; letter-spacing: 0.05em; margin-right: 4px;">MONITOREAR</span>`);

        // Convert markdown bold
        body = body.replace(/\*\*(.+?)\*\*/g, `<strong style="color: ${C.text};">$1</strong>`);
        // Convert numbered lists
        body = body.replace(/^\d+\.\s+/gm, '• ');
        // Convert line breaks to <br>
        body = body.split('\n').filter(l => l.trim()).join('<br>');

        return `
        <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-left: 3px solid ${C.accent}; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
            <tr><td style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
                <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.accent}; text-transform: uppercase;">${s.title}</span>
            </td></tr>
            <tr><td style="padding: 16px; font-size: 13px; color: ${C.text}; line-height: 1.7;">
                ${body}
            </td></tr>
        </table>`;
    }).join('');
}

function buildExecutiveSummary(content: string): string {
    const match = content.match(/<!--\s*EXECUTIVE_SUMMARY\s*-->\s*([\s\S]*?)(?=\n##|\n<!--|\[CRITICA\]|\[ATENCION\]|\[INFO\]|$)/);
    if (!match) return '';

    const summary = match[1].trim();
    if (!summary) return '';

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-left: 3px solid ${C.accent}; border-radius: 12px; margin-bottom: 24px;">
        <tr><td style="padding: 20px 24px;">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.accent}; margin-bottom: 8px;">RESUMEN EJECUTIVO</div>
            <div style="font-size: 14px; color: ${C.text}; line-height: 1.7;">${summary}</div>
        </td></tr>
    </table>`;
}

export function buildReportEmailHTML(report: VegaReport): string {
    const meta = report.metadata;
    if (!meta) {
        // Fallback for reports without metadata — just wrap content in basic HTML
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background: ${C.bg}; padding: 20px; font-family: Arial, sans-serif;">
            <div style="max-width: 640px; margin: 0 auto; color: ${C.text}; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${report.content}</div>
        </body></html>`;
    }

    const header = buildHeader(report, meta);
    const execSummary = buildExecutiveSummary(report.content);
    const heroKPIs = buildHeroKPIs(report, meta);
    const alerts = buildAlerts(report.content);
    const adsSummary = buildAdsSummary(meta);
    const products = buildProducts(meta);
    const countries = buildCountries(meta);
    const narrative = buildNarrative(report.content);

    return `<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${report.title}</title>
</head>
<body style="margin: 0; padding: 0; background: ${C.bg}; font-family: 'Segoe UI', Arial, sans-serif; -webkit-font-smoothing: antialiased;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.bg};">
        <tr><td style="padding: 24px;">
            <table width="100%" cellpadding="0" cellspacing="0" style="max-width: 640px; margin: 0 auto;">
                <tr><td>
                    ${header}
                    ${execSummary}
                    ${heroKPIs}
                    ${alerts}
                    ${adsSummary}
                    ${products}
                    ${countries}
                    ${narrative}

                    <!-- Footer -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid ${C.border};">
                        <tr><td style="padding: 24px 0; text-align: center;">
                            <div style="font-size: 11px; color: ${C.muted};">Generado por <span style="color: ${C.accent}; font-weight: 700;">VEGA AI</span> · Grand Line</div>
                            <div style="font-size: 10px; color: ${C.muted}; margin-top: 4px;">Este reporte fue enviado automáticamente a tu correo de registro.</div>
                        </td></tr>
                    </table>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}
