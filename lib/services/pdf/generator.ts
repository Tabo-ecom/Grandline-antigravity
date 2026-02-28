import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PDFReportData, PDFAlert } from './types';
import { PDF_COLORS } from './types';
import { evaluateHealth, findTarget } from '@/lib/utils/health';
import type { HealthStatus } from '@/lib/utils/health';
import { renderMarkdownToPDF } from './markdown-renderer';
import type { VegaReportMetadata } from '@/lib/types/vega';

// --- Helpers ---

function statusColor(status: HealthStatus): string {
    return status === 'good' ? PDF_COLORS.good : status === 'warning' ? PDF_COLORS.warning : PDF_COLORS.bad;
}

function formatCurrency(value: number): string {
    return `$${Math.round(value).toLocaleString('es-CO')}`;
}

function fmt(n: number): string {
    if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function drawPageBackground(doc: jsPDF) {
    doc.setFillColor(PDF_COLORS.background);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number, borderRadius = 3) {
    doc.setFillColor(PDF_COLORS.cardBg);
    doc.roundedRect(x, y, w, h, borderRadius, borderRadius, 'F');
    doc.setDrawColor(PDF_COLORS.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, borderRadius, borderRadius, 'S');
}

async function loadImage(src: string): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => resolve(img);
        img.onerror = reject;
        img.src = src;
    });
}

const REPORT_TITLES: Record<string, { type: string; title: string; subtitle: string; healthLabel: string }> = {
    daily: { type: 'REPORTE DIARIO', title: 'El Latido del Negocio', subtitle: 'Resumen operativo y financiero del dia', healthLabel: 'Estado del Dia' },
    weekly: { type: 'REPORTE SEMANAL', title: 'La Brujula Tactica', subtitle: 'Analisis tactico y rendimiento de la semana', healthLabel: 'Estado de la Semana' },
    monthly: { type: 'REPORTE MENSUAL', title: 'La Vision del Almirante', subtitle: 'Panorama completo, P&L y proyecciones estrategicas', healthLabel: 'Estado del Mes' },
};

const HEALTH_BADGE_COLORS: Record<string, string> = {
    'EXCELENTE': PDF_COLORS.good,
    'MUY BUENO': PDF_COLORS.blue,
    'BUENO': PDF_COLORS.blue,
    'ALERTA': PDF_COLORS.warning,
    'CRITICO': PDF_COLORS.bad,
};

const ACTION_TAG_COLORS: Record<string, string> = {
    'ESCALAR': PDF_COLORS.good,
    'PAUSAR': PDF_COLORS.bad,
    'OPTIMIZAR': PDF_COLORS.warning,
    'MONITOREAR': PDF_COLORS.blue,
};

// Check if we need a new page, and add one if so
function ensureSpace(doc: jsPDF, y: number, needed: number, margin = 20): { y: number; newPage: boolean } {
    const pageH = doc.internal.pageSize.getHeight();
    if (y + needed > pageH - margin) {
        doc.addPage();
        drawPageBackground(doc);
        return { y: 15, newPage: true };
    }
    return { y, newPage: false };
}

// --- Section header used across pages ---

function drawSectionHeader(doc: jsPDF, title: string, y: number, icon?: string): number {
    const w = doc.internal.pageSize.getWidth();
    const result = ensureSpace(doc, y, 20);
    y = result.y;

    // Icon box
    doc.setFillColor('#1a2332');
    doc.roundedRect(15, y, 8, 8, 2, 2, 'F');
    if (icon) {
        doc.setFontSize(6);
        doc.setTextColor(PDF_COLORS.text);
        doc.text(icon, 19, y + 5.5, { align: 'center' });
    }

    // Title
    doc.setFontSize(8);
    doc.setTextColor(PDF_COLORS.text);
    doc.text(title.toUpperCase(), 27, y + 5.5);

    // Decorative line
    const textW = doc.getTextWidth(title.toUpperCase());
    doc.setDrawColor(PDF_COLORS.cardBorder);
    doc.setLineWidth(0.3);
    doc.line(27 + textW + 4, y + 4, w - 15, y + 4);

    return y + 12;
}

// --- PORTADA (Cover Page) ---

function drawCoverPage(doc: jsPDF, data: PDFReportData, logoImg?: HTMLImageElement) {
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    const centerX = w / 2;

    // Subtle gradient overlay (approximated with semi-transparent rects)
    doc.setFillColor('#120e09');
    doc.rect(0, 0, w * 0.4, h * 0.4, 'F');
    doc.setFillColor(PDF_COLORS.background);
    doc.rect(w * 0.4, 0, w * 0.6, h * 0.4, 'F');

    // Reset background
    drawPageBackground(doc);

    // Top accent line
    doc.setFillColor(PDF_COLORS.accent);
    doc.rect(0, 0, w, 3, 'F');

    // Logos
    if (logoImg) {
        const logoH = 14;
        const logoW = (logoImg.width / logoImg.height) * logoH;
        doc.addImage(logoImg, 'PNG', centerX - logoW / 2, 25, logoW, logoH);
    } else {
        doc.setFontSize(11);
        doc.setTextColor(PDF_COLORS.textMuted);
        doc.text('GRAND LINE', centerX, 35, { align: 'center' });
    }

    // Report type label
    const type = data.reportType || 'daily';
    const info = REPORT_TITLES[type] || REPORT_TITLES.daily;

    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.accent);
    doc.text(info.type, centerX, 48, { align: 'center' });

    // Title
    doc.setFontSize(22);
    doc.setTextColor(PDF_COLORS.text);
    doc.text(info.title, centerX, 62, { align: 'center' });

    // Subtitle
    doc.setFontSize(9);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text(info.subtitle, centerX, 72, { align: 'center' });

    // Period badge
    const periodY = 82;
    const periodW = Math.max(doc.getTextWidth(data.period) + 16, 60);
    doc.setFillColor('#111827');
    doc.roundedRect(centerX - periodW / 2, periodY, periodW, 10, 5, 5, 'F');
    doc.setDrawColor(PDF_COLORS.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(centerX - periodW / 2, periodY, periodW, 10, 5, 5, 'S');

    // Green pulsing dot (solid circle)
    doc.setFillColor(PDF_COLORS.good);
    doc.circle(centerX - periodW / 2 + 7, periodY + 5, 1.2, 'F');

    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text(data.period, centerX + 3, periodY + 6, { align: 'center' });

    // Health Score Badge
    let badgeEndY = periodY + 16;
    if (data.reportMetadata?.healthScore) {
        const hs = data.reportMetadata.healthScore;
        const badgeColor = HEALTH_BADGE_COLORS[hs.level] || PDF_COLORS.blue;
        const badgeText = `${info.healthLabel}: ${hs.level}`;
        const badgeW = Math.max(doc.getTextWidth(badgeText) * 1.8 + 20, 60);
        const badgeH = 12;
        const badgeX = centerX - badgeW / 2;
        const badgeY = periodY + 16;

        // Badge border + background
        doc.setDrawColor(badgeColor);
        doc.setLineWidth(0.8);
        doc.roundedRect(badgeX, badgeY, badgeW, badgeH, 4, 4, 'S');

        // Glow dot
        doc.setFillColor(badgeColor);
        doc.circle(badgeX + 8, badgeY + badgeH / 2, 2, 'F');
        // Outer glow (slightly larger, lighter)
        doc.setDrawColor(badgeColor);
        doc.setLineWidth(0.2);
        doc.circle(badgeX + 8, badgeY + badgeH / 2, 3.5, 'S');

        // Badge text
        doc.setFontSize(8);
        doc.setTextColor(badgeColor);
        doc.text(badgeText, centerX + 3, badgeY + 7.5, { align: 'center' });

        badgeEndY = badgeY + badgeH + 6;
    }

    // Executive Summary
    if (data.executiveSummary) {
        const summaryY = badgeEndY + 4;
        const summaryW = w - 40;
        const summaryLines = doc.splitTextToSize(data.executiveSummary.replace(/\*\*(.*?)\*\*/g, '$1'), summaryW - 16);
        const summaryH = Math.max(summaryLines.length * 4.5 + 14, 22);

        drawCard(doc, 20, summaryY, summaryW, summaryH);

        // Left accent border
        doc.setFillColor(PDF_COLORS.accent);
        doc.rect(20, summaryY, 2.5, summaryH, 'F');

        doc.setFontSize(6);
        doc.setTextColor(PDF_COLORS.accent);
        doc.text('RESUMEN EJECUTIVO', 28, summaryY + 7);

        doc.setFontSize(8);
        doc.setTextColor(PDF_COLORS.text);
        doc.text(summaryLines.slice(0, 4), 28, summaryY + 13);
    }

    // Hero KPI cards
    const heroStartY = data.executiveSummary ? badgeEndY + 55 : badgeEndY + 10;
    drawHeroKPIs(doc, data, heroStartY);

    // Powered by footer on cover
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('Powered by VEGA AI', centerX, h - 15, { align: 'center' });

    // Generation date
    doc.setFontSize(6);
    doc.text(
        `Generado: ${new Date(data.generatedAt).toLocaleString('es-CO')}`,
        centerX, h - 10,
        { align: 'center' }
    );
}

function drawHeroKPIs(doc: jsPDF, data: PDFReportData, startY: number) {
    if (!data.kpis) return;
    const w = doc.internal.pageSize.getWidth();
    const kpis = data.kpis;
    const isDaily = data.reportType === 'daily';
    const meta = data.reportMetadata;

    const heroKpis = isDaily
        ? [
            { label: 'UTIL. PROYECTADA', value: fmt(kpis.utilidad_proyectada || 0), key: 'u_proy', raw: kpis.utilidad_proyectada || 0, iconLabel: '$' },
            { label: 'ROAS REAL', value: `${kpis.roas_real.toFixed(2)}x`, key: 'roas_real', raw: kpis.roas_real, iconLabel: 'R' },
            { label: 'CPA', value: formatCurrency(kpis.cpa), key: 'cpa', raw: kpis.cpa, iconLabel: 'C' },
        ]
        : [
            { label: 'UTILIDAD REAL', value: fmt(kpis.u_real), key: 'u_real', raw: kpis.u_real, iconLabel: '$' },
            { label: 'ROAS REAL', value: `${kpis.roas_real.toFixed(2)}x`, key: 'roas_real', raw: kpis.roas_real, iconLabel: 'R' },
            { label: 'TASA ENTREGA', value: `${kpis.tasa_ent.toFixed(1)}%`, key: 'tasa_ent', raw: kpis.tasa_ent, iconLabel: '%' },
            { label: 'CPA', value: formatCurrency(kpis.cpa), key: 'cpa', raw: kpis.cpa, iconLabel: 'C' },
        ];

    const numCards = heroKpis.length;
    const cardW = isDaily ? 52 : 40;
    const gap = 5;
    const totalW = cardW * numCards + gap * (numCards - 1);
    const startX = (w - totalW) / 2;
    const cardH = 40;

    heroKpis.forEach((kpi, i) => {
        const x = startX + i * (cardW + gap);

        // Health coloring
        let color: string = PDF_COLORS.text;
        if (kpi.key === 'u_real' || kpi.key === 'u_proy') {
            color = kpi.raw >= 0 ? PDF_COLORS.good : PDF_COLORS.bad;
        } else {
            const target = findTarget(data.kpiTargets, kpi.key);
            if (target) color = statusColor(evaluateHealth(kpi.raw, target));
        }

        drawCard(doc, x, startY, cardW, cardH);

        // Colored top accent (3px)
        doc.setFillColor(color);
        doc.rect(x + 1, startY, cardW - 2, 2, 'F');

        // Icon label box (top right)
        doc.setFillColor('#1a2332');
        doc.roundedRect(x + cardW - 12, startY + 5, 8, 8, 2, 2, 'F');
        doc.setFontSize(6);
        doc.setTextColor(color);
        doc.text(kpi.iconLabel, x + cardW - 8, startY + 10.5, { align: 'center' });

        // Label
        doc.setFontSize(5);
        doc.setTextColor(PDF_COLORS.textMuted);
        doc.text(kpi.label, x + 5, startY + 11);

        // Value
        doc.setFontSize(16);
        doc.setTextColor(color);
        doc.text(kpi.value, x + 5, startY + 24);

        // Change vs previous (if available)
        if (meta?.prevKpis) {
            const prevKey = kpi.key === 'u_proy' ? 'utilidad_proyectada' : kpi.key;
            const prevVal = meta.prevKpis[prevKey];
            if (prevVal !== undefined && prevVal !== 0) {
                const delta = ((kpi.raw - prevVal) / Math.abs(prevVal)) * 100;
                const arrow = delta > 0 ? '+' : '';
                const changeColor = delta > 0 ? PDF_COLORS.good : PDF_COLORS.bad;
                doc.setFontSize(5.5);
                doc.setTextColor(changeColor);
                doc.text(`${arrow}${delta.toFixed(1)}% vs anterior`, x + 5, startY + 31);
            }
        }

        // Target (if available)
        const target = findTarget(data.kpiTargets, kpi.key);
        if (target) {
            const targetText = kpi.key === 'cpa' ? `Meta: < $${(target.good || 0).toLocaleString('es-CO')}` :
                kpi.key === 'roas_real' ? `Meta: > ${target.good}x` :
                    kpi.key === 'tasa_ent' ? `Meta: > ${target.good}%` :
                        `Meta: > ${target.good}`;
            doc.setFontSize(5);
            doc.setTextColor(PDF_COLORS.textMuted);
            doc.text(targetText, x + 5, startY + 36);
        }
    });
}

// --- ADS SUMMARY PAGE ---

function drawAdsSummary(doc: jsPDF, data: PDFReportData) {
    const meta = data.reportMetadata;
    if (!meta?.adPlatformMetrics || !data.kpis) return;

    const k = data.kpis;
    const platforms = meta.adPlatformMetrics;
    const totalAds = k.g_ads || 0;
    if (totalAds === 0) return;

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    let y = drawSectionHeader(doc, 'Gasto Publicitario', 15, 'AD');

    // Main ads card
    const cardW = w - 30;
    drawCard(doc, 15, y, cardW, 30);

    // Total spend
    doc.setFontSize(5);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('GASTO TOTAL', 22, y + 8);
    doc.setFontSize(16);
    doc.setTextColor(PDF_COLORS.text);
    doc.text(formatCurrency(totalAds), 22, y + 18);
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('COP', 22 + doc.getTextWidth(formatCurrency(totalAds)) + 3, y + 18);

    // % Ads vs Revenue
    const adsRevPct = k.perc_ads_revenue || 0;
    const adsTarget = findTarget(data.kpiTargets, 'perc_ads_revenue');
    const adsStatus = adsTarget ? evaluateHealth(adsRevPct, adsTarget) : 'warning';
    const adsColor = statusColor(adsStatus as HealthStatus);

    doc.setFontSize(5);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('% ADS VS REVENUE', w - 75, y + 8);
    doc.setFontSize(16);
    doc.setTextColor(adsColor);
    doc.text(`${adsRevPct.toFixed(1)}%`, w - 75, y + 18);

    y += 38;

    // Platform cards
    const ingReal = k.ing_real || 0;
    const platData = [
        { name: 'Facebook', spend: platforms.fb, color: '#1877F2', roas: ingReal > 0 && platforms.fb > 0 ? (ingReal * (platforms.fb / totalAds)) / platforms.fb : 0 },
        { name: 'TikTok', spend: platforms.tiktok, color: '#00f2ea', roas: ingReal > 0 && platforms.tiktok > 0 ? (ingReal * (platforms.tiktok / totalAds)) / platforms.tiktok : 0 },
        { name: 'Google', spend: platforms.google, color: '#4285F4', roas: ingReal > 0 && platforms.google > 0 ? (ingReal * (platforms.google / totalAds)) / platforms.google : 0 },
    ].filter(p => p.spend > 0);

    if (platData.length > 0) {
        const platCardW = (cardW - (platData.length - 1) * 4) / platData.length;
        const platCardH = 35;

        platData.forEach((p, i) => {
            const x = 15 + i * (platCardW + 4);
            drawCard(doc, x, y, platCardW, platCardH);

            // Brand color top accent
            doc.setFillColor(p.color);
            doc.rect(x + 1, y, platCardW - 2, 2.5, 'F');

            // Platform name
            doc.setFontSize(6);
            doc.setTextColor(PDF_COLORS.textMuted);
            doc.text(p.name.toUpperCase(), x + platCardW / 2, y + 11, { align: 'center' });

            // Spend
            doc.setFontSize(14);
            doc.setTextColor(PDF_COLORS.text);
            doc.text(fmt(p.spend), x + platCardW / 2, y + 21, { align: 'center' });

            // ROAS
            if (p.roas > 0) {
                const roasColor = p.roas >= 2.5 ? PDF_COLORS.good : p.roas >= 1.5 ? PDF_COLORS.warning : PDF_COLORS.bad;
                doc.setFontSize(8);
                doc.setTextColor(roasColor);
                doc.text(`ROAS ${p.roas.toFixed(1)}x`, x + platCardW / 2, y + 30, { align: 'center' });
            }
        });

        y += platCardH + 8;

        // Distribution bar
        doc.setFontSize(6);
        doc.setTextColor(PDF_COLORS.textMuted);
        doc.text('Distribucion del gasto', 15, y);

        const distLabel = platData.map(p => `${p.name.slice(0, 2)} ${Math.round((p.spend / totalAds) * 100)}%`).join('  |  ');
        doc.text(distLabel, w - 15, y, { align: 'right' });

        y += 4;
        const barH = 4;
        const barW = w - 30;
        let barX = 15;

        platData.forEach((p, i) => {
            const segW = (p.spend / totalAds) * barW;
            doc.setFillColor(p.color);
            if (i === 0) {
                doc.roundedRect(barX, y, segW - 0.5, barH, 2, 2, 'F');
            } else if (i === platData.length - 1) {
                doc.roundedRect(barX + 0.5, y, segW - 0.5, barH, 2, 2, 'F');
            } else {
                doc.rect(barX + 0.5, y, segW - 1, barH, 'F');
            }
            barX += segW;
        });
    }
}

// --- ALERTS PAGE ---

function drawAlertsPage(doc: jsPDF, data: PDFReportData) {
    if (!data.alerts || data.alerts.length === 0) return;

    doc.addPage();
    drawPageBackground(doc);

    let y = drawSectionHeader(doc, 'Alertas y Acciones', 15, '!');

    doc.setFontSize(6);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('Situaciones que requieren atencion inmediata', 15, y);
    y += 8;

    const w = doc.internal.pageSize.getWidth();

    const alertColors: Record<string, { bg: string; accent: string; label: string }> = {
        CRITICA: { bg: '#1c1215', accent: PDF_COLORS.bad, label: 'CRITICA' },
        ATENCION: { bg: '#1c1812', accent: PDF_COLORS.warning, label: 'ATENCION' },
        INFO: { bg: '#121825', accent: PDF_COLORS.blue, label: 'INFO' },
    };

    data.alerts.forEach(alert => {
        const config = alertColors[alert.level] || alertColors.INFO;
        const alertH = 14;

        const space = ensureSpace(doc, y, alertH + 4);
        y = space.y;

        // Alert card
        doc.setFillColor(config.bg);
        doc.roundedRect(15, y, w - 30, alertH, 2, 2, 'F');

        // Left accent bar
        doc.setFillColor(config.accent);
        doc.roundedRect(15, y, 3, alertH, 1, 1, 'F');

        // Badge
        const badgeW = doc.getTextWidth(config.label) + 6;
        doc.setFillColor(config.bg);
        doc.setDrawColor(config.accent);
        doc.setLineWidth(0.3);
        doc.roundedRect(22, y + 2, badgeW + 2, 6, 1.5, 1.5, 'S');
        doc.setFontSize(5);
        doc.setTextColor(config.accent);
        doc.text(config.label, 24, y + 6);

        // Message
        doc.setFontSize(7.5);
        doc.setTextColor(PDF_COLORS.text);
        const msgLines = doc.splitTextToSize(alert.message, w - 55);
        doc.text(msgLines.slice(0, 1), 22, y + 11.5);

        y += alertH + 3;
    });

    return y;
}

// --- TWO-COLUMN PRODUCTS PAGE ---

function drawTwoColumnProducts(doc: jsPDF, data: PDFReportData) {
    const meta = data.reportMetadata;
    if (!meta?.metricsByCountry || meta.metricsByCountry.length === 0) return;

    // Collect all products
    const allProducts: any[] = [];
    meta.metricsByCountry.forEach(c => {
        c.products.forEach(p => allProducts.push({ ...p, country: c.countryName }));
    });
    if (allProducts.length === 0) return;

    const profitable = allProducts.filter(p => p.utilProy > 0).sort((a, b) => b.utilProy - a.utilProy);
    const losing = allProducts.filter(p => p.utilProy <= 0).sort((a, b) => a.utilProy - b.utilProy);

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    let y = drawSectionHeader(doc, 'Rentabilidad por Producto', 15, 'P');

    const isMonthly = data.reportType === 'monthly';
    const utilLabel = isMonthly ? 'UTIL. REAL' : 'UTIL. PROY.';
    const utilField = isMonthly ? 'utilReal' : 'utilProy';

    // Two columns side by side
    const colW = (w - 34) / 2;
    const leftX = 15;
    const rightX = 15 + colW + 4;

    // -- Column headers --
    // Profit column header
    doc.setFillColor('#0d1f17');
    doc.roundedRect(leftX, y, colW, 9, 2, 2, 'F');
    doc.setFontSize(5.5);
    doc.setTextColor(PDF_COLORS.good);
    doc.text(`✓ GENERANDO GANANCIA (${profitable.length})`, leftX + 5, y + 6);

    // Loss column header
    doc.setFillColor('#1f0d0d');
    doc.roundedRect(rightX, y, colW, 9, 2, 2, 'F');
    doc.setTextColor(PDF_COLORS.bad);
    doc.text(`✗ GENERANDO PERDIDA (${losing.length})`, rightX + 5, y + 6);

    y += 12;
    const rowH = 14;
    const maxRows = Math.max(profitable.length, losing.length, 1);
    const displayRows = Math.min(maxRows, 12);

    for (let i = 0; i < displayRows; i++) {
        const space = ensureSpace(doc, y, rowH + 2);
        y = space.y;

        // Profit product row
        if (i < profitable.length) {
            const p = profitable[i];
            const utilValue = p[utilField] || p.utilProy || 0;
            const roas = p.ads > 0 ? ((p.utilReal || 0) + (p.ads || 0)) / p.ads : 0;

            doc.setFillColor(i % 2 === 0 ? PDF_COLORS.cardBg : '#111827');
            doc.rect(leftX, y, colW, rowH, 'F');

            // Product name + country
            doc.setFontSize(7);
            doc.setTextColor(PDF_COLORS.text);
            const nameText = p.name.length > 22 ? p.name.slice(0, 22) + '...' : p.name;
            doc.text(nameText, leftX + 3, y + 5);
            doc.setFontSize(5);
            doc.setTextColor(PDF_COLORS.textMuted);
            doc.text(`${p.n_ord} ord · ${p.country}`, leftX + 3, y + 10);

            // Util value
            doc.setFontSize(8);
            doc.setTextColor(PDF_COLORS.good);
            doc.text(fmt(utilValue), leftX + colW - 3, y + 5.5, { align: 'right' });

            // ROAS
            if (roas > 0) {
                const roasColor = roas >= 2 ? PDF_COLORS.good : roas >= 1.5 ? PDF_COLORS.warning : PDF_COLORS.bad;
                doc.setFontSize(5.5);
                doc.setTextColor(roasColor);
                doc.text(`ROAS ${roas.toFixed(1)}x`, leftX + colW - 3, y + 10, { align: 'right' });
            }
        }

        // Loss product row
        if (i < losing.length) {
            const p = losing[i];
            const utilValue = p[utilField] || p.utilProy || 0;
            const roas = p.ads > 0 ? ((p.utilReal || 0) + (p.ads || 0)) / p.ads : 0;

            doc.setFillColor(i % 2 === 0 ? PDF_COLORS.cardBg : '#111827');
            doc.rect(rightX, y, colW, rowH, 'F');

            // Product name + country + loss streak
            doc.setFontSize(7);
            doc.setTextColor(PDF_COLORS.text);
            const nameText = p.name.length > 18 ? p.name.slice(0, 18) + '...' : p.name;
            doc.text(nameText, rightX + 3, y + 5);

            doc.setFontSize(5);
            doc.setTextColor(PDF_COLORS.textMuted);
            let subText = `${p.n_ord} ord · ${p.country}`;
            doc.text(subText, rightX + 3, y + 10);

            // Loss streak badge
            if (p.lossStreak && p.lossStreak >= 2) {
                const streakText = `${p.lossStreak}d perdida`;
                const streakX = rightX + 3 + doc.getTextWidth(subText) + 3;
                doc.setFillColor('#1f0d0d');
                const streakW = doc.getTextWidth(streakText) + 6;
                doc.roundedRect(streakX, y + 7, streakW, 4.5, 1.5, 1.5, 'F');
                doc.setFontSize(4.5);
                doc.setTextColor(PDF_COLORS.bad);
                doc.text(streakText, streakX + 3, y + 10.3);
            }

            // Util value
            doc.setFontSize(8);
            doc.setTextColor(PDF_COLORS.bad);
            doc.text(fmt(utilValue), rightX + colW - 3, y + 5.5, { align: 'right' });

            // ROAS
            if (roas > 0) {
                const roasColor = roas >= 2 ? PDF_COLORS.good : roas >= 1.5 ? PDF_COLORS.warning : PDF_COLORS.bad;
                doc.setFontSize(5.5);
                doc.setTextColor(roasColor);
                doc.text(`ROAS ${roas.toFixed(1)}x`, rightX + colW - 3, y + 10, { align: 'right' });
            }
        }

        y += rowH + 1;
    }
}

// --- COUNTRY BREAKDOWN PAGE ---

function drawCountryBreakdown(doc: jsPDF, data: PDFReportData) {
    const meta = data.reportMetadata;
    if (!meta?.metricsByCountry || meta.metricsByCountry.length === 0) {
        // Fallback to old table format if no metadata
        drawCountryBreakdownLegacy(doc, data);
        return;
    }

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    let y = drawSectionHeader(doc, 'Desglose por Pais', 15, 'G');

    const countries = meta.metricsByCountry;
    const COUNTRY_FLAGS: Record<string, string> = {
        'Colombia': 'CO', 'Ecuador': 'EC', 'Panama': 'PA', 'Panamá': 'PA', 'Guatemala': 'GT',
    };

    // 2-column grid for country cards
    const colW = (w - 34) / 2;
    const cardH = 55;

    countries.forEach((c, i) => {
        const col = i % 2;
        if (col === 0) {
            const space = ensureSpace(doc, y, cardH + 8);
            y = space.y;
        }

        const x = 15 + col * (colW + 4);
        const ck = c.kpis as any;
        const flag = COUNTRY_FLAGS[c.countryName] || 'WW';
        const cUtilProy = c.products.reduce((s: number, p: any) => s + (p.utilProy || 0), 0);
        const roas = ck?.g_ads > 0 ? (ck?.ing_real || 0) / ck.g_ads : 0;

        // Card
        drawCard(doc, x, y, colW, cardH);

        // Country flag + name
        doc.setFontSize(9);
        doc.setTextColor(PDF_COLORS.text);
        doc.text(`[${flag}]`, x + 5, y + 9);
        doc.setFontSize(8);
        doc.text(c.countryName.toUpperCase(), x + 18, y + 9);

        // 4-metric grid (2x2)
        const metricW = (colW - 12) / 2;
        const metricH = 14;
        const metrics = [
            { label: 'ORDENES', value: `${ck?.n_ord || 0}` },
            { label: 'FACTURACION', value: fmt(ck?.fact_neto || 0) },
            { label: 'UTIL. PROY.', value: fmt(cUtilProy), color: cUtilProy >= 0 ? PDF_COLORS.good : PDF_COLORS.bad },
            { label: 'ROAS', value: roas > 0 ? `${roas.toFixed(1)}x` : 'N/A', color: roas >= 2.5 ? PDF_COLORS.good : roas >= 1.5 ? PDF_COLORS.warning : roas > 0 ? PDF_COLORS.bad : PDF_COLORS.text },
        ];

        metrics.forEach((m, mi) => {
            const mCol = mi % 2;
            const mRow = Math.floor(mi / 2);
            const mx = x + 4 + mCol * (metricW + 2);
            const my = y + 14 + mRow * (metricH + 2);

            doc.setFillColor('#111827');
            doc.roundedRect(mx, my, metricW, metricH, 2, 2, 'F');

            doc.setFontSize(4.5);
            doc.setTextColor(PDF_COLORS.textMuted);
            doc.text(m.label, mx + 3, my + 5);

            doc.setFontSize(10);
            doc.setTextColor(m.color || PDF_COLORS.text);
            doc.text(m.value, mx + 3, my + 11.5);
        });

        // Star/Risk highlights
        const best = [...c.products].sort((a: any, b: any) => b.utilProy - a.utilProy)[0];
        const worst = [...c.products].sort((a: any, b: any) => a.utilProy - b.utilProy)[0];

        let highlightY = y + 14 + 2 * (metricH + 2) + 1;

        if (best && best.utilProy > 0) {
            const bestRoas = best.ads > 0 ? (((best.utilReal || 0) + (best.ads || 0)) / best.ads).toFixed(1) : '?';
            doc.setFillColor('#0d1f17');
            doc.roundedRect(x + 4, highlightY, colW - 8, 6, 1.5, 1.5, 'F');
            doc.setFontSize(5);
            doc.setTextColor(PDF_COLORS.good);
            const starText = `★ ${best.name.slice(0, 20)} (ROAS ${bestRoas}x)`;
            doc.text(starText, x + 7, highlightY + 4);
            highlightY += 7;
        }

        if (worst && worst.utilProy < 0) {
            doc.setFillColor('#1f0d0d');
            doc.roundedRect(x + 4, highlightY, colW - 8, 6, 1.5, 1.5, 'F');
            doc.setFontSize(5);
            doc.setTextColor(PDF_COLORS.bad);
            const riskText = `▲ ${worst.name.slice(0, 20)} (U.Proy ${fmt(worst.utilProy)})`;
            doc.text(riskText, x + 7, highlightY + 4);
        }

        // Move to next row after 2 columns
        if (col === 1 || i === countries.length - 1) {
            y += cardH + 4;
        }
    });
}

// Legacy fallback for when metadata is missing
function drawCountryBreakdownLegacy(doc: jsPDF, data: PDFReportData) {
    if (!data.metricsByCountry || data.metricsByCountry.length === 0) return;

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    let y = drawSectionHeader(doc, 'Desglose por Pais', 15, 'G');

    const tableData = data.metricsByCountry.map(c => [
        c.name,
        c.orderCount.toString(),
        `${c.deliveryRate.toFixed(1)}%`,
        `${c.cancelRate.toFixed(1)}%`,
        formatCurrency(c.sales),
        formatCurrency(c.adSpend),
        formatCurrency(c.profit),
    ]);

    autoTable(doc, {
        startY: y,
        head: [['Pais', 'Ordenes', 'Entrega', 'Cancel.', 'Ventas', 'Ads', 'Utilidad']],
        body: tableData,
        theme: 'plain',
        styles: {
            fillColor: PDF_COLORS.cardBg,
            textColor: PDF_COLORS.text,
            fontSize: 8,
            cellPadding: 4,
            lineColor: PDF_COLORS.cardBorder,
            lineWidth: 0.3,
        },
        headStyles: {
            fillColor: '#1a2332',
            textColor: PDF_COLORS.accent,
            fontStyle: 'bold',
            fontSize: 7,
        },
        alternateRowStyles: {
            fillColor: '#111827',
        },
        didParseCell: (hookData) => {
            if (hookData.section === 'body' && hookData.column.index === 6) {
                const val = parseInt((hookData.cell.raw as string).replace(/[$.,]/g, ''));
                hookData.cell.styles.textColor = val >= 0 ? PDF_COLORS.good : PDF_COLORS.bad;
            }
        },
    });
}

// --- FINANCIAL P&L PAGE ---

function drawFinancialPL(doc: jsPDF, data: PDFReportData) {
    if (!data.kpis) return;
    // Skip P&L for daily reports
    if (data.reportType === 'daily') return;

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();
    const kpis = data.kpis;

    let y = drawSectionHeader(doc, 'Estado de Resultados (P&L)', 15, 'PL');

    // Grouped P&L with colored section headers
    const sections = [
        {
            header: 'INGRESOS',
            headerColor: PDF_COLORS.good,
            headerBg: '#0d1f17',
            rows: [
                { label: 'Facturacion Neta', value: kpis.fact_neto, pct: undefined as number | undefined },
                { label: 'Ingreso Real (Entregados)', value: kpis.ing_real, pct: 100 },
            ],
        },
        {
            header: 'COSTOS VARIABLES',
            headerColor: PDF_COLORS.bad,
            headerBg: '#1f0d0d',
            rows: [
                { label: 'Costo de Producto', value: -kpis.cpr, pct: kpis.ing_real > 0 ? (kpis.cpr / kpis.ing_real) * 100 : 0 },
                { label: 'Fletes Entrega', value: -kpis.fl_ent, pct: undefined as number | undefined },
                { label: 'Fletes Devolucion', value: -kpis.fl_dev, pct: undefined as number | undefined },
                { label: 'Fletes Transito', value: -kpis.fl_tra, pct: undefined as number | undefined, muted: true },
                { label: 'Gasto Publicitario', value: -kpis.g_ads, pct: kpis.fact_neto > 0 ? (kpis.g_ads / kpis.fact_neto) * 100 : 0 },
            ],
        },
        {
            header: 'RESULTADO',
            headerColor: PDF_COLORS.accent,
            headerBg: '#1a1210',
            rows: [
                { label: 'Utilidad Real (Entregados)', value: kpis.u_real, pct: undefined as number | undefined },
                { label: 'Utilidad Proyectada (inc. Transito)', value: kpis.utilidad_proyectada || 0, pct: undefined as number | undefined, highlight: true },
                { label: 'Margen Neto', value: kpis.ing_real > 0 ? (kpis.u_real / kpis.ing_real) * 100 : 0, pct: undefined as number | undefined, isPercent: true },
            ],
        },
    ];

    const tableW = w - 30;

    sections.forEach(section => {
        const space = ensureSpace(doc, y, 12);
        y = space.y;

        // Section header bar
        doc.setFillColor(section.headerBg);
        doc.roundedRect(15, y, tableW, 8, 1.5, 1.5, 'F');
        doc.setFontSize(5.5);
        doc.setTextColor(section.headerColor);
        doc.text(section.header, 20, y + 5.5);
        y += 10;

        section.rows.forEach((row: any) => {
            const space = ensureSpace(doc, y, 10);
            y = space.y;

            const rowBg = row.highlight ? '#1a1210' : PDF_COLORS.cardBg;
            doc.setFillColor(rowBg);
            doc.rect(15, y, tableW, 9, 'F');

            // Bottom border
            doc.setDrawColor(PDF_COLORS.cardBorder);
            doc.setLineWidth(0.15);
            doc.line(15, y + 9, 15 + tableW, y + 9);

            // Label
            doc.setFontSize(row.highlight ? 8 : 7.5);
            doc.setTextColor(row.highlight ? PDF_COLORS.accent : row.muted ? PDF_COLORS.textMuted : PDF_COLORS.text);
            doc.text(row.label, 20, y + 6);

            // Value
            const displayValue = row.isPercent
                ? `${row.value.toFixed(1)}%`
                : formatCurrency(row.value);

            let valueColor: string;
            if (row.highlight) {
                valueColor = row.value >= 0 ? PDF_COLORS.accent : PDF_COLORS.bad;
            } else if (row.muted) {
                valueColor = PDF_COLORS.textMuted;
            } else if (row.value < 0) {
                valueColor = PDF_COLORS.bad;
            } else if (section.header === 'RESULTADO') {
                valueColor = PDF_COLORS.good;
            } else {
                valueColor = PDF_COLORS.text;
            }

            doc.setFontSize(row.highlight ? 10 : 8);
            doc.setTextColor(valueColor);
            doc.text(displayValue, 15 + tableW - 5, y + 6, { align: 'right' });

            // Percentage
            if (row.pct !== undefined && row.pct > 0) {
                doc.setFontSize(5.5);
                doc.setTextColor(PDF_COLORS.textMuted);
                doc.text(`(${row.pct.toFixed(1)}%)`, 15 + tableW - 5 - doc.getTextWidth(displayValue) - 4, y + 6, { align: 'right' });
            }

            y += 10;
        });

        y += 3;
    });
}

// --- KPI DASHBOARD PAGE (detailed metrics) ---

function drawKPIDashboard(doc: jsPDF, data: PDFReportData) {
    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    let y = drawSectionHeader(doc, 'Dashboard de KPIs', 15, 'KPI');

    doc.setFontSize(6);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text(data.period, 15, y);
    y += 6;

    if (!data.kpis) return;
    const kpis = data.kpis;

    const metrics = [
        { label: 'Total Ordenes', value: kpis.n_ord.toString(), key: '' },
        { label: 'Entregadas', value: kpis.n_ent.toString(), key: '' },
        { label: 'Canceladas', value: kpis.n_can.toString(), key: '' },
        { label: 'En Transito', value: kpis.n_tra.toString(), key: '' },
        { label: 'Devoluciones', value: kpis.n_dev.toString(), key: '' },
        { label: 'ROAS Real', value: `${kpis.roas_real.toFixed(2)}x`, key: 'roas_real', raw: kpis.roas_real },
        { label: 'ROAS Bruto', value: `${kpis.roas_bruto.toFixed(2)}x`, key: '', raw: kpis.roas_bruto },
        { label: 'CPA', value: formatCurrency(kpis.cpa), key: 'cpa', raw: kpis.cpa },
        { label: 'CPE', value: formatCurrency(kpis.cpe), key: '' },
        { label: 'Tasa Entrega', value: `${kpis.tasa_ent.toFixed(1)}%`, key: 'tasa_ent', raw: kpis.tasa_ent },
        { label: 'Tasa Cancelacion', value: `${kpis.tasa_can.toFixed(1)}%`, key: 'tasa_can', raw: kpis.tasa_can },
        { label: 'Tasa Devolucion', value: `${kpis.tasa_dev.toFixed(1)}%`, key: 'tasa_dev', raw: kpis.tasa_dev },
        { label: '% Ads/Revenue', value: `${kpis.perc_ads_revenue.toFixed(1)}%`, key: 'perc_ads_revenue', raw: kpis.perc_ads_revenue },
        { label: 'Facturacion Neta', value: formatCurrency(kpis.fact_neto), key: '' },
        { label: 'Ingreso Real', value: formatCurrency(kpis.ing_real), key: '' },
        { label: 'Costo Producto', value: formatCurrency(kpis.cpr), key: '' },
        { label: 'Gasto Ads', value: formatCurrency(kpis.g_ads), key: '' },
        { label: 'Utilidad Real', value: formatCurrency(kpis.u_real), key: 'u_real', raw: kpis.u_real },
        { label: 'Util. Proyectada', value: formatCurrency(kpis.utilidad_proyectada || 0), key: 'u_proy', raw: kpis.utilidad_proyectada || 0 },
    ];

    // Grid layout: 3 columns
    const cols = 3;
    const cardW = 55;
    const cardH = 22;
    const gapX = 7;
    const gapY = 5;
    const totalW = cardW * cols + gapX * (cols - 1);
    const startX = (w - totalW) / 2;

    metrics.forEach((m, idx) => {
        const col = idx % cols;
        const row = Math.floor(idx / cols);
        const x = startX + col * (cardW + gapX);
        const cardY = y + row * (cardH + gapY);

        // Check page space every row
        if (col === 0) {
            const space = ensureSpace(doc, cardY, cardH + 5);
            if (space.newPage) {
                y = space.y - row * (cardH + gapY);
            }
        }

        const finalY = y + row * (cardH + gapY);
        drawCard(doc, x, finalY, cardW, cardH);

        // Label
        doc.setFontSize(5.5);
        doc.setTextColor(PDF_COLORS.textMuted);
        doc.text(m.label.toUpperCase(), x + 5, finalY + 8);

        // Value with health coloring
        let color: string = PDF_COLORS.text;
        if (m.key && m.key !== 'u_real' && m.key !== 'u_proy') {
            const target = findTarget(data.kpiTargets, m.key);
            if (target && 'raw' in m) {
                color = statusColor(evaluateHealth(m.raw as number, target));
            }
        } else if ((m.key === 'u_real' || m.key === 'u_proy') && 'raw' in m) {
            color = (m.raw as number) >= 0 ? PDF_COLORS.good : PDF_COLORS.bad;
        }

        doc.setFontSize(12);
        doc.setTextColor(color);
        doc.text(m.value, x + 5, finalY + 17);
    });
}

// --- VEGA AI ANALYSIS (narrative sections with action tags) ---

function drawVegaAnalysis(doc: jsPDF, data: PDFReportData) {
    if (!data.vegaAnalysis) return;

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    let y = drawSectionHeader(doc, 'Analisis VEGA AI', 15, 'AI');

    doc.setFontSize(6);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('Generado por inteligencia artificial', 15, y);
    y += 6;

    // Use enhanced markdown renderer that handles action tags
    renderMarkdownWithActionTags(doc, data.vegaAnalysis, y, {
        maxWidth: w - 30,
        startX: 15,
        pageHeight: doc.internal.pageSize.getHeight(),
        onNewPage: () => {
            drawPageBackground(doc);
        },
    });
}

function renderMarkdownWithActionTags(
    doc: jsPDF,
    markdown: string,
    startY: number,
    options: { maxWidth: number; startX: number; pageHeight: number; onNewPage: () => void }
): number {
    const { maxWidth, startX, pageHeight, onNewPage } = options;
    let y = startY;
    const bottomMargin = 20;
    const lineHeight = 5;

    function checkNewPage(neededHeight: number = lineHeight * 2) {
        if (y + neededHeight > pageHeight - bottomMargin) {
            doc.addPage();
            onNewPage();
            y = 15;
        }
    }

    // Strip blocks we handle elsewhere
    let content = markdown;
    content = content.replace(/<!-- EXECUTIVE_SUMMARY -->[\s\S]*?(?=<!-- |## )/g, '');
    content = content.replace(/<!-- HERO_KPIS -->[\s\S]*?<!-- \/HERO_KPIS -->/g, '');
    content = content.replace(/<!-- ALERTS -->[\s\S]*?<!-- \/ALERTS -->/g, '');
    content = content.replace(/<!-- \/?EXECUTIVE_SUMMARY -->/g, '');

    const lines = content.split('\n');
    let i = 0;
    let isRecommendationSection = false;

    while (i < lines.length) {
        const line = lines[i].trim();

        if (line === '') {
            y += 3;
            i++;
            continue;
        }

        // H2 headers — section headers with icon
        if (line.startsWith('## ')) {
            checkNewPage(18);
            y += 4;
            const headerText = cleanText(line.slice(3));

            isRecommendationSection = /recomend|plan|acci[oó]n|t[aá]ctico/i.test(headerText);

            // If recommendation section, draw special background
            if (isRecommendationSection) {
                doc.setFillColor('#1a1210');
                doc.roundedRect(startX, y - 3, maxWidth, 12, 2, 2, 'F');
                doc.setDrawColor(PDF_COLORS.accent);
                doc.setLineWidth(0.3);
                doc.roundedRect(startX, y - 3, maxWidth, 12, 2, 2, 'S');

                doc.setFontSize(7);
                doc.setTextColor(PDF_COLORS.accent);
                doc.text('VEGA', startX + 4, y + 4);
                doc.setFontSize(8);
                doc.text(headerText.toUpperCase(), startX + 19, y + 4);
                y += 14;
            } else {
                // Normal section header
                doc.setFontSize(10);
                doc.setTextColor(PDF_COLORS.accent);
                doc.text(headerText, startX, y + 3);
                y += 4;
                doc.setDrawColor(PDF_COLORS.accent);
                doc.setLineWidth(0.3);
                doc.line(startX, y, startX + maxWidth * 0.5, y);
                y += 5;
            }

            i++;
            continue;
        }

        // H3 headers
        if (line.startsWith('### ')) {
            checkNewPage(12);
            y += 3;
            doc.setFontSize(8);
            doc.setTextColor(PDF_COLORS.text);
            doc.text(cleanText(line.slice(4)).toUpperCase(), startX, y + 3);
            y += 7;
            i++;
            continue;
        }

        // Numbered list items (with action tags support)
        if (/^\d+\.\s/.test(line)) {
            const items: string[] = [];
            while (i < lines.length && /^\d+\.\s/.test(lines[i].trim())) {
                items.push(lines[i].trim().replace(/^\d+\.\s+/, ''));
                i++;
            }

            items.forEach((item, idx) => {
                checkNewPage(14);

                // Number badge
                doc.setFillColor(PDF_COLORS.accent);
                doc.roundedRect(startX, y, 6, 6, 1.5, 1.5, 'F');
                doc.setFontSize(5);
                doc.setTextColor('#ffffff');
                doc.text(`${idx + 1}`, startX + 3, y + 4.2, { align: 'center' });

                // Check for action tag
                const actionMatch = item.match(/^\[(ESCALAR|PAUSAR|OPTIMIZAR|MONITOREAR)\]\s*/);
                let textX = startX + 9;
                if (actionMatch) {
                    const tagColor = ACTION_TAG_COLORS[actionMatch[1]] || PDF_COLORS.blue;
                    const tagText = actionMatch[1];
                    const tagW = doc.getTextWidth(tagText) * 1.2 + 5;

                    doc.setFillColor(tagColor);
                    doc.roundedRect(textX, y, tagW, 5.5, 1.5, 1.5, 'F');
                    doc.setFontSize(4.5);
                    doc.setTextColor('#ffffff');
                    doc.text(tagText, textX + tagW / 2, y + 3.8, { align: 'center' });

                    textX += tagW + 3;
                    item = item.slice(actionMatch[0].length);
                }

                // Item text
                doc.setFontSize(7.5);
                doc.setTextColor(PDF_COLORS.text);
                const wrappedLines = doc.splitTextToSize(cleanText(item), maxWidth - (textX - startX));
                wrappedLines.forEach((wl: string, wi: number) => {
                    checkNewPage();
                    if (wi > 0) textX = startX + 9;
                    doc.text(wl, textX, y + 4);
                    y += lineHeight;
                });

                y += 2;
            });
            continue;
        }

        // Bullet points with action tags
        if (line.startsWith('- ') || line.startsWith('* ')) {
            checkNewPage();

            let item = line.replace(/^[-*]\s+/, '');

            // Check for action tag
            const actionMatch = item.match(/^\[(ESCALAR|PAUSAR|OPTIMIZAR|MONITOREAR)\]\s*/);

            // Bullet dot
            doc.setFillColor(actionMatch ? (ACTION_TAG_COLORS[actionMatch[1]] || PDF_COLORS.accent) : PDF_COLORS.accent);
            doc.circle(startX + 2.5, y + 1.5, 1, 'F');

            let textX = startX + 7;

            if (actionMatch) {
                const tagColor = ACTION_TAG_COLORS[actionMatch[1]] || PDF_COLORS.blue;
                const tagText = actionMatch[1];
                const tagW = doc.getTextWidth(tagText) * 1.2 + 5;

                doc.setFillColor(tagColor);
                doc.roundedRect(textX, y - 1, tagW, 5.5, 1.5, 1.5, 'F');
                doc.setFontSize(4.5);
                doc.setTextColor('#ffffff');
                doc.text(tagText, textX + tagW / 2, y + 2.2, { align: 'center' });

                textX += tagW + 3;
                item = item.slice(actionMatch[0].length);
            }

            doc.setFontSize(7.5);
            doc.setTextColor(PDF_COLORS.text);
            const wrappedLines = doc.splitTextToSize(cleanText(item), maxWidth - (textX - startX));
            wrappedLines.forEach((wl: string, wi: number) => {
                checkNewPage();
                if (wi > 0) textX = startX + 7;
                doc.text(wl, textX, y + 2.5);
                y += lineHeight;
            });

            i++;
            continue;
        }

        // Tables
        if (line.startsWith('|')) {
            const tableLines: string[] = [];
            while (i < lines.length && lines[i].trim().startsWith('|')) {
                tableLines.push(lines[i].trim());
                i++;
            }
            y = renderTableInPDF(doc, tableLines, startX, y, maxWidth, pageHeight, bottomMargin, onNewPage);
            y += 3;
            continue;
        }

        // Bold standalone lines (sub-headers)
        if (line.startsWith('**') && line.endsWith('**')) {
            checkNewPage();
            y += 2;
            doc.setFontSize(7);
            doc.setTextColor(PDF_COLORS.accent);
            doc.text(cleanText(line).toUpperCase(), startX, y + 2);
            y += 6;
            i++;
            continue;
        }

        // Regular paragraph
        checkNewPage();
        doc.setFontSize(7.5);
        doc.setTextColor(PDF_COLORS.text);
        const wrappedLines = doc.splitTextToSize(cleanText(line), maxWidth);
        wrappedLines.forEach((wl: string) => {
            checkNewPage();
            doc.text(wl, startX, y + 2);
            y += lineHeight;
        });
        i++;
    }

    return y;
}

function renderTableInPDF(
    doc: jsPDF,
    tableLines: string[],
    startX: number,
    y: number,
    maxWidth: number,
    pageHeight: number,
    bottomMargin: number,
    onNewPage: () => void
): number {
    const rows = tableLines
        .filter(line => !line.match(/^\|[\s-:|]+\|$/))
        .map(line => line.split('|').slice(1, -1).map(cell => cleanText(cell.trim())));

    if (rows.length === 0) return y;

    const isHeader = tableLines.length > 1 && tableLines[1]?.match(/^\|[\s-:|]+\|$/);
    const headerRow = isHeader ? rows[0] : undefined;
    const bodyRows = isHeader ? rows.slice(1) : rows;

    if (y + (bodyRows.length + 2) * 6 > pageHeight - bottomMargin) {
        doc.addPage();
        onNewPage();
        y = 15;
    }

    autoTable(doc, {
        startY: y,
        head: headerRow ? [headerRow] : undefined,
        body: bodyRows,
        theme: 'plain',
        styles: {
            fillColor: PDF_COLORS.cardBg,
            textColor: PDF_COLORS.text,
            fontSize: 7,
            cellPadding: 2.5,
            lineColor: PDF_COLORS.cardBorder,
            lineWidth: 0.2,
        },
        headStyles: {
            fillColor: '#1a2332',
            textColor: PDF_COLORS.accent,
            fontStyle: 'bold',
            fontSize: 7,
        },
        margin: { left: startX, right: startX },
    });

    return (doc as any).lastAutoTable?.finalY || y + 20;
}

function cleanText(text: string): string {
    let cleaned = text.replace(/\*\*(.*?)\*\*/g, '$1');
    cleaned = cleaned.replace(/\*(.*?)\*/g, '$1');
    cleaned = cleaned.replace(/`(.*?)`/g, '$1');
    cleaned = cleaned.replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '');
    cleaned = cleaned.replace(/\s+/g, ' ').trim();
    return cleaned;
}

// --- FOOTER ---

function drawFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();

        // Footer line
        doc.setDrawColor(PDF_COLORS.cardBorder);
        doc.setLineWidth(0.3);
        doc.line(15, h - 14, w - 15, h - 14);

        doc.setFontSize(5.5);
        doc.setTextColor(PDF_COLORS.textMuted);
        doc.text('Grand Line — Command Center', 15, h - 9);
        doc.text('Generado por VEGA IA', 15, h - 5);
        doc.text(`Pagina ${i} de ${pageCount}`, w - 15, h - 9, { align: 'right' });
    }
}

// --- PARSERS ---

function parseAlertsFromContent(content: string): PDFAlert[] {
    const alerts: PDFAlert[] = [];
    const alertsMatch = content.match(/<!-- ALERTS -->([\s\S]*?)<!-- \/ALERTS -->/);
    if (alertsMatch) {
        const alertLines = alertsMatch[1].trim().split('\n').filter(l => l.trim());
        alertLines.forEach(line => {
            const match = line.match(/\[(CRITICA|ATENCION|INFO)\]\s*(.*)/);
            if (match) {
                alerts.push({
                    level: match[1] as PDFAlert['level'],
                    message: match[2].trim(),
                });
            }
        });
    }
    return alerts;
}

function parseExecutiveSummary(content: string): string | undefined {
    const match = content.match(/<!-- EXECUTIVE_SUMMARY -->([\s\S]*?)(?=<!-- (?:HERO_KPIS|ALERTS|\/EXECUTIVE_SUMMARY) -->|## )/);
    return match ? match[1].trim() : undefined;
}

// --- MAIN EXPORT ---

export async function generatePDFReport(data: PDFReportData): Promise<jsPDF> {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Load logo
    let logoImg: HTMLImageElement | undefined;
    try {
        logoImg = await loadImage('/logos/grandline-logo.png');
    } catch {
        // Fallback to text if logo fails to load
    }

    // Auto-extract alerts and summary from AI content if not provided explicitly
    if (!data.alerts && data.vegaAnalysis) {
        data.alerts = parseAlertsFromContent(data.vegaAnalysis);
    }
    if (!data.executiveSummary && data.vegaAnalysis) {
        data.executiveSummary = parseExecutiveSummary(data.vegaAnalysis);
    }

    // Pages in order matching web renderer:
    // 1. Cover page (portada + executive summary + hero KPIs)
    drawCoverPage(doc, data, logoImg);

    // 2. Ads Summary (if platform data available)
    drawAdsSummary(doc, data);

    // 3. Alerts (if any)
    drawAlertsPage(doc, data);

    // 4. Two-column Products (from metadata)
    drawTwoColumnProducts(doc, data);

    // 5. Country Breakdown (cards or table)
    drawCountryBreakdown(doc, data);

    // 6. P&L (weekly/monthly only)
    drawFinancialPL(doc, data);

    // 7. KPI Dashboard (detailed metrics grid)
    drawKPIDashboard(doc, data);

    // 8. VEGA AI Analysis (narrative sections with action tags)
    drawVegaAnalysis(doc, data);

    // Footer on all pages
    drawFooter(doc);

    return doc;
}

export async function downloadPDFReport(data: PDFReportData) {
    const doc = await generatePDFReport(data);
    const filename = `Grand_Line_${data.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
}
