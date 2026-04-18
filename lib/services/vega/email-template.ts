/**
 * Vega AI - HTML Email Template Builder
 * Generates email-safe HTML with inline CSS matching the VEGA report design.
 */

import type { VegaReport, VegaReportMetadata } from '@/lib/types/vega';
import { REPORT_LABEL_MAP } from '@/lib/types/vega';

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

function buildHeader(report: VegaReport, meta: VegaReportMetadata, accent: string): string {
    const color = healthColor(meta.healthScore.level);
    const reportLabel = REPORT_LABEL_MAP[report.type] || 'REPORTE';

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: linear-gradient(135deg, ${accent}14 0%, transparent 100%); border: 1px solid ${C.border}; border-radius: 16px; margin-bottom: 24px;">
        <tr><td style="padding: 40px 32px; text-align: center;">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.3em; text-transform: uppercase; color: ${accent}; margin-bottom: 8px;">${reportLabel}</div>
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
                <div style="font-size: 11px; color: ${C.muted};">${p.n_ord} ord · CPA ${fmt(p.cpa || 0)} · U.Proy <span style="color: ${isProfit ? C.green : C.red}; font-weight: 700;">${fmt(p.utilProy || 0)}</span></div>
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
                        <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.red};">GENERANDO PERDIDA (${loss.length})</span>
                    </td></tr>
                    ${productRows(loss, false)}
                </table>
            </td>
        </tr>
    </table>`;
}

function buildAdsSummary(meta: VegaReportMetadata, accent: string): string {
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
            <div style="font-size: 11px; color: ${C.muted}; margin-bottom: 16px;">Gasto Total · ${pctAds}% de facturacion</div>
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
                        <span style="display: inline-block; width: 10px; height: 10px; border-radius: 3px; background: ${accent}; margin-right: 8px; vertical-align: middle;"></span>
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
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.blue};">PAISES</span>
        </td></tr>
        <tr style="background: rgba(255,255,255,0.02);">
            <td style="padding: 8px 16px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em;">PAIS</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">ORDENES</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">ENTREGA</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">ADS</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">U.PROY</td>
        </tr>
        ${rows}
    </table>`;
}

function buildNarrative(content: string, accent: string): string {
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
        <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-left: 3px solid ${accent}; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
            <tr><td style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
                <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${accent}; text-transform: uppercase;">${s.title}</span>
            </td></tr>
            <tr><td style="padding: 16px; font-size: 13px; color: ${C.text}; line-height: 1.7;">
                ${body}
            </td></tr>
        </table>`;
    }).join('');
}

function buildExecutiveSummary(content: string, accent: string): string {
    const match = content.match(/<!--\s*EXECUTIVE_SUMMARY\s*-->\s*([\s\S]*?)(?=\n##|\n<!--|\[CRITICA\]|\[ATENCION\]|\[INFO\]|$)/);
    if (!match) return '';

    const summary = match[1].trim();
    if (!summary) return '';

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-left: 3px solid ${accent}; border-radius: 12px; margin-bottom: 24px;">
        <tr><td style="padding: 20px 24px;">
            <div style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${accent}; margin-bottom: 8px;">RESUMEN EJECUTIVO</div>
            <div style="font-size: 14px; color: ${C.text}; line-height: 1.7;">${summary}</div>
        </td></tr>
    </table>`;
}

function buildSupplierSection(meta: VegaReportMetadata, accent: string): string {
    const sk = meta.supplierKpis;
    if (!sk) return '';

    const kpiRows = [
        { label: 'Ingreso', value: fmt(sk.ingreso), color: C.green },
        { label: 'Costo', value: fmt(sk.costo), color: C.red },
        { label: 'Ganancia', value: fmt(sk.ganancia), color: sk.ganancia > 0 ? C.green : C.red },
        { label: 'Margen', value: pct(sk.margen), color: sk.margen >= 20 ? C.green : sk.margen >= 10 ? C.orange : C.red },
    ].map(r => `<tr>
        <td style="padding: 10px 16px; border-bottom: 1px solid ${C.border}; font-size: 13px; color: ${C.text};">${r.label}</td>
        <td style="padding: 10px 16px; border-bottom: 1px solid ${C.border}; font-size: 14px; font-weight: 700; color: ${r.color}; text-align: right;">${r.value}</td>
    </tr>`).join('');

    let topProducts = '';
    if (sk.topProducts && sk.topProducts.length > 0) {
        const rows = sk.topProducts.map(p => `<tr>
            <td style="padding: 8px 16px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text};">${p.nombre}</td>
            <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: center;">${p.unidades}</td>
            <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; font-weight: 700; color: ${p.ganancia > 0 ? C.green : C.red}; text-align: right;">${fmt(p.ganancia)}</td>
            <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: right;">${pct(p.margen)}</td>
        </tr>`).join('');

        topProducts = `
        <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
            <tr><td colspan="4" style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
                <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${accent};">TOP PRODUCTOS</span>
            </td></tr>
            <tr style="background: rgba(255,255,255,0.02);">
                <td style="padding: 8px 16px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em;">PRODUCTO</td>
                <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">UNIDADES</td>
                <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">GANANCIA</td>
                <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">MARGEN</td>
            </tr>
            ${rows}
        </table>`;
    }

    let stockAlerts = '';
    if (sk.stockAlerts && sk.stockAlerts.length > 0) {
        const rows = sk.stockAlerts.map(s => {
            const urgency = s.diasRestantes <= 3 ? C.red : s.diasRestantes <= 7 ? C.orange : C.muted;
            return `<tr>
                <td style="padding: 8px 16px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text};">${s.nombre}</td>
                <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: center;">${s.stockActual}</td>
                <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; font-weight: 700; color: ${urgency}; text-align: right;">${s.diasRestantes}d</td>
            </tr>`;
        }).join('');

        stockAlerts = `
        <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; margin-bottom: 16px; overflow: hidden;">
            <tr><td colspan="3" style="padding: 12px 16px; background: ${C.red}08; border-bottom: 1px solid ${C.border};">
                <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${C.red};">ALERTAS DE STOCK</span>
            </td></tr>
            <tr style="background: rgba(255,255,255,0.02);">
                <td style="padding: 8px 16px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em;">PRODUCTO</td>
                <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">STOCK</td>
                <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">DIAS REST.</td>
            </tr>
            ${rows}
        </table>`;
    }

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-left: 3px solid ${accent}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
        <tr><td colspan="2" style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${accent};">KPIs PROVEEDOR</span>
        </td></tr>
        ${kpiRows}
    </table>
    ${topProducts}
    ${stockAlerts}`;
}

function buildLogisticsSection(meta: VegaReportMetadata, accent: string): string {
    const reasons = meta.cancelReasons;
    if (!reasons || reasons.length === 0) return '';

    const reasonRows = reasons.map(r => `<tr>
        <td style="padding: 8px 16px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text};">${r.tag}</td>
        <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: center;">${r.count}</td>
        <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: right;">${pct(r.pct)}</td>
    </tr>`).join('');

    let carrierHtml = '';
    const carriers = meta.carrierBreakdown;
    if (carriers && carriers.length > 0) {
        const cRows = carriers.map(c => `<tr>
            <td style="padding: 8px 16px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text};">${c.carrier}</td>
            <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: center;">${c.orders}</td>
            <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.text}; text-align: center;">${c.delivered}</td>
            <td style="padding: 8px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; font-weight: 700; color: ${c.deliveryRate >= 70 ? C.green : c.deliveryRate >= 50 ? C.orange : C.red}; text-align: right;">${pct(c.deliveryRate)}</td>
        </tr>`).join('');

        carrierHtml = `
        <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
            <tr><td colspan="4" style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
                <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${accent};">TRANSPORTADORAS</span>
            </td></tr>
            <tr style="background: rgba(255,255,255,0.02);">
                <td style="padding: 8px 16px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em;">CARRIER</td>
                <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">ORDENES</td>
                <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">ENTREGADOS</td>
                <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">% ENTREGA</td>
            </tr>
            ${cRows}
        </table>`;
    }

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-left: 3px solid ${accent}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
        <tr><td colspan="3" style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${accent};">MOTIVOS DE CANCELACION</span>
        </td></tr>
        <tr style="background: rgba(255,255,255,0.02);">
            <td style="padding: 8px 16px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em;">MOTIVO</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: center;">CANTIDAD</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">%</td>
        </tr>
        ${reasonRows}
    </table>
    ${carrierHtml}`;
}

function buildPnLCascade(meta: VegaReportMetadata, accent: string): string {
    const pnl = meta.pnlCascade;
    if (!pnl) return '';

    const revenue = pnl.ingTotal || 1;
    const rows: { label: string; value: number; pctRev: number; color: string; bold?: boolean }[] = [
        { label: 'Ingresos Proveedor', value: pnl.ingProveedor, pctRev: (pnl.ingProveedor / revenue) * 100, color: C.green },
        { label: 'Ingresos Dropshipping', value: pnl.ingDropshipping, pctRev: (pnl.ingDropshipping / revenue) * 100, color: C.green },
        { label: 'Ingresos Totales', value: pnl.ingTotal, pctRev: 100, color: C.green, bold: true },
        { label: 'Costos Totales', value: -pnl.costoTotal, pctRev: (pnl.costoTotal / revenue) * 100, color: C.red },
        { label: 'Ganancia Bruta', value: pnl.gananciaBruta, pctRev: pnl.margenBruto, color: pnl.gananciaBruta > 0 ? C.green : C.red, bold: true },
        { label: 'Fletes', value: -pnl.fletes, pctRev: (pnl.fletes / revenue) * 100, color: C.red },
        { label: 'Ads', value: -pnl.ads, pctRev: (pnl.ads / revenue) * 100, color: C.red },
        { label: 'Gastos Operativos', value: -pnl.gastosOp, pctRev: (pnl.gastosOp / revenue) * 100, color: C.red },
        { label: 'Gastos Administrativos', value: -pnl.gastosAdmin, pctRev: (pnl.gastosAdmin / revenue) * 100, color: C.red },
        { label: 'Utilidad Neta', value: pnl.utilidadNeta, pctRev: pnl.margenNeto, color: pnl.utilidadNeta > 0 ? C.green : C.red, bold: true },
    ];

    const rowsHtml = rows.map(r => {
        const fontWeight = r.bold ? '800' : '400';
        const bgStyle = r.bold ? `background: ${r.color}08;` : '';
        const displayValue = r.value < 0 ? `-${fmt(Math.abs(r.value))}` : fmt(r.value);
        return `<tr style="${bgStyle}">
            <td style="padding: 10px 16px; border-bottom: 1px solid ${C.border}; font-size: 13px; font-weight: ${fontWeight}; color: ${C.text};">${r.label}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid ${C.border}; font-size: 13px; font-weight: 700; color: ${r.color}; text-align: right;">${displayValue}</td>
            <td style="padding: 10px 8px; border-bottom: 1px solid ${C.border}; font-size: 12px; color: ${C.muted}; text-align: right;">${pct(r.pctRev)}</td>
        </tr>`;
    }).join('');

    return `
    <table width="100%" cellpadding="0" cellspacing="0" style="background: ${C.cardBg}; border: 1px solid ${C.border}; border-left: 3px solid ${accent}; border-radius: 12px; margin-bottom: 24px; overflow: hidden;">
        <tr><td colspan="3" style="padding: 12px 16px; border-bottom: 1px solid ${C.border};">
            <span style="font-size: 10px; font-weight: 800; letter-spacing: 0.2em; color: ${accent};">ESTADO DE RESULTADOS (P&L)</span>
        </td></tr>
        <tr style="background: rgba(255,255,255,0.02);">
            <td style="padding: 8px 16px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em;">CONCEPTO</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">VALOR</td>
            <td style="padding: 8px; font-size: 10px; font-weight: 700; color: ${C.muted}; letter-spacing: 0.1em; text-align: right;">% ING.</td>
        </tr>
        ${rowsHtml}
    </table>`;
}

export function buildReportEmailHTML(report: VegaReport, accentColor?: string): string {
    const ac = accentColor || '#d75c33';
    const meta = report.metadata;
    if (!meta) {
        // Fallback for reports without metadata — just wrap content in basic HTML
        return `<!DOCTYPE html><html><head><meta charset="UTF-8"></head><body style="background: ${C.bg}; padding: 20px; font-family: Arial, sans-serif;">
            <div style="max-width: 640px; margin: 0 auto; color: ${C.text}; font-size: 14px; line-height: 1.7; white-space: pre-wrap;">${report.content}</div>
        </body></html>`;
    }

    const header = buildHeader(report, meta, ac);
    const execSummary = buildExecutiveSummary(report.content, ac);
    const heroKPIs = buildHeroKPIs(report, meta);
    const alerts = buildAlerts(report.content);
    const adsSummary = buildAdsSummary(meta, ac);
    const products = buildProducts(meta);
    const countries = buildCountries(meta);

    // Conditional sections based on report type and metadata
    const supplierSection = meta.supplierKpis ? buildSupplierSection(meta, ac) : '';
    const logisticsSection = meta.cancelReasons ? buildLogisticsSection(meta, ac) : '';
    const pnlCascade = meta.pnlCascade ? buildPnLCascade(meta, ac) : '';

    const narrative = buildNarrative(report.content, ac);

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
                    ${supplierSection}
                    ${logisticsSection}
                    ${pnlCascade}
                    ${narrative}

                    <!-- Footer -->
                    <table width="100%" cellpadding="0" cellspacing="0" style="margin-top: 32px; border-top: 1px solid ${C.border};">
                        <tr><td style="padding: 24px 0; text-align: center;">
                            <div style="font-size: 11px; color: ${C.muted};">Generado por <span style="color: ${ac}; font-weight: 700;">VEGA AI</span> · Grand Line</div>
                            <div style="font-size: 10px; color: ${C.muted}; margin-top: 4px;">Este reporte fue enviado automaticamente a tu correo de registro.</div>
                        </td></tr>
                    </table>
                </td></tr>
            </table>
        </td></tr>
    </table>
</body>
</html>`;
}
