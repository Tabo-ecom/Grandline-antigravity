/**
 * VEGA Premium Report Templates — Rich HTML emails (all 7 types)
 * Usage: node scripts/test-premium-reports.mjs
 */
import { readFileSync } from 'fs';
import { createTransport } from 'nodemailer';

const envRaw = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envRaw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=["']?(.*?)["']?\s*$/);
    if (m) env[m[1]] = m[2];
}
const transporter = createTransport({ host: env.SMTP_HOST, port: Number(env.SMTP_PORT), secure: true, auth: { user: env.SMTP_USER, pass: env.SMTP_PASS } });
const TO = 'ceo@taboecom.com';
const FROM = env.SMTP_FROM || env.SMTP_USER;

// ── Design System ──
const DS = {
    bg: '#0A0A0F',
    card: '#111318',
    cardAlt: '#161920',
    border: '#1C1F2A',
    borderLight: '#262A38',
    text: '#F0F0F5',
    textSec: '#A0A5B8',
    muted: '#6B7085',
    good: '#22C55E',
    goodBg: 'rgba(34,197,94,0.08)',
    warn: '#F59E0B',
    warnBg: 'rgba(245,158,11,0.08)',
    bad: '#EF4444',
    badBg: 'rgba(239,68,68,0.08)',
    blue: '#3B82F6',
    blueBg: 'rgba(59,130,246,0.08)',
    purple: '#8B5CF6',
    purpleBg: 'rgba(139,92,246,0.08)',
    font: "'Space Grotesk', 'SF Pro Display', -apple-system, Arial, sans-serif",
    mono: "'SF Mono', 'JetBrains Mono', 'Fira Code', monospace",
};

// ── Helper: Semaforo dot ──
function semaforo(status) {
    const colors = { green: DS.good, yellow: DS.warn, red: DS.bad };
    const c = colors[status] || DS.muted;
    return `<span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${c};margin-right:6px;vertical-align:middle;"></span>`;
}

// ── Helper: Change indicator ──
function cambio(value, suffix = '', invertido = false) {
    const isPositive = value > 0;
    const isGood = invertido ? !isPositive : isPositive;
    const color = isGood ? DS.good : DS.bad;
    const arrow = isPositive ? '↑' : '↓';
    return `<span style="font-size:10px;color:${color};font-weight:700;">${arrow} ${isPositive ? '+' : ''}${value}${suffix}</span>`;
}

// ── Helper: Progress bar ──
function progressBar(pct, color, height = '8px', width = '100%') {
    return `<div style="width:${width};height:${height};background:${DS.cardAlt};border-radius:4px;overflow:hidden;display:inline-block;vertical-align:middle;">
        <div style="width:${Math.min(100, Math.max(0, pct))}%;height:100%;background:${color};border-radius:4px;"></div>
    </div>`;
}

// ── Helper: Margin bar (for tables) ──
function marginBar(pct, color) {
    return `<div style="display:flex;align-items:center;gap:6px;">
        <span style="font-size:11px;font-weight:700;color:${color};font-family:${DS.mono};min-width:42px;">${pct}%</span>
        ${progressBar(pct, color, '6px', '60px')}
    </div>`;
}

// ── Helper: KPI Card with comparison ──
function kpiCard(label, value, sub, color, icon = '') {
    return `<td style="width:20%;padding:6px;">
        <div style="background:${DS.card};border:1px solid ${DS.border};border-radius:14px;padding:18px 14px;text-align:center;">
            <div style="font-size:9px;font-weight:800;color:${DS.muted};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">${icon} ${label}</div>
            <div style="font-size:26px;font-weight:900;color:${color};font-family:${DS.mono};line-height:1;">${value}</div>
            <div style="font-size:10px;color:${DS.textSec};margin-top:6px;">${sub}</div>
        </div>
    </td>`;
}

// ── Helper: P&L Row ──
function pnlRow(concept, value, pct, color, isBold = false, isHighlight = false) {
    const bg = isHighlight ? DS.cardAlt : 'transparent';
    const weight = isBold ? '900' : '500';
    const size = isBold ? '13px' : '12px';
    const indent = concept.startsWith('(') || concept.startsWith('&nbsp;') ? 'padding-left:24px;' : '';
    return `<tr style="background:${bg};border-bottom:1px solid ${DS.border};">
        <td style="padding:10px 14px;font-size:${size};font-weight:${weight};color:${isBold ? DS.text : DS.textSec};${indent}">${concept}</td>
        <td style="padding:10px 14px;font-size:${size};font-weight:900;color:${color};text-align:right;font-family:${DS.mono};">${value}</td>
        <td style="padding:10px 14px;font-size:10px;color:${DS.muted};text-align:right;">${pct}</td>
    </tr>`;
}

// ── Helper: Waterfall ──
function waterfall(items, maxVal) {
    return items.map(item => {
        const pct = Math.min(100, (Math.abs(item.value) / maxVal) * 100);
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <div style="width:100px;text-align:right;font-size:10px;font-weight:700;color:${DS.textSec};flex-shrink:0;">${item.label}</div>
            <div style="flex:1;height:24px;background:${DS.cardAlt};border-radius:6px;overflow:hidden;position:relative;">
                <div style="height:100%;width:${pct}%;background:${item.color};border-radius:6px;opacity:0.8;"></div>
            </div>
            <div style="width:80px;text-align:right;font-size:11px;font-weight:900;color:${item.color};font-family:${DS.mono};flex-shrink:0;">${item.value < 0 ? '-' : ''}${item.display}</div>
        </div>`;
    }).join('');
}

// ── Helper: Table row ──
function tableRow(cells, isHeader = false) {
    const bg = isHeader ? DS.cardAlt : DS.card;
    const color = isHeader ? DS.muted : DS.text;
    const size = isHeader ? '9px' : '11px';
    const weight = isHeader ? '800' : '600';
    const ls = isHeader ? 'letter-spacing:1.5px;text-transform:uppercase;' : '';
    return `<tr style="background:${bg};border-bottom:1px solid ${DS.border};">
        ${cells.map((c, i) => `<td style="padding:${isHeader ? '8px' : '10px'} 12px;font-size:${size};font-weight:${weight};color:${c.color || color};text-align:${i === 0 ? 'left' : 'right'};font-family:${i > 0 ? DS.mono : DS.font};${ls}">${c.text || c}</td>`).join('')}
    </tr>`;
}

// ── Helper: Section ──
function section(title, icon, accent, content) {
    return `<div style="margin-bottom:24px;">
        <div style="display:flex;align-items:center;gap:10px;margin-bottom:14px;">
            <div style="width:28px;height:28px;background:${accent}15;border-radius:8px;display:flex;align-items:center;justify-content:center;font-size:14px;">${icon}</div>
            <div style="font-size:11px;font-weight:900;color:${DS.text};text-transform:uppercase;letter-spacing:2px;">${title}</div>
            <div style="flex:1;height:1px;background:${DS.border};"></div>
        </div>
        ${content}
    </div>`;
}

// ── Helper: Action tag ──
function actionTag(tag, color, text) {
    return `<div style="padding:14px 16px;background:${color}08;border-left:3px solid ${color};border-radius:0 10px 10px 0;margin-bottom:8px;">
        <div style="display:inline-block;background:${color}20;border:1px solid ${color}40;border-radius:4px;padding:2px 8px;margin-bottom:6px;">
            <span style="font-size:9px;font-weight:900;color:${color};letter-spacing:1px;">${tag}</span>
        </div>
        <div style="font-size:12px;color:${DS.textSec};line-height:1.6;">${text}</div>
    </div>`;
}

// ── Helper: Metric card (for grids) ──
function metricCard(label, value, status, change) {
    return `<div style="background:${DS.cardAlt};border:1px solid ${DS.border};border-radius:10px;padding:14px;text-align:center;">
        <div style="font-size:9px;color:${DS.muted};font-weight:800;text-transform:uppercase;letter-spacing:1px;margin-bottom:6px;">${semaforo(status)}${label}</div>
        <div style="font-size:18px;font-weight:900;color:${DS.text};font-family:${DS.mono};">${value}</div>
        <div style="margin-top:4px;">${change}</div>
    </div>`;
}

// ── Helper: Full-width rate bar ──
function rateBar(label, pct, color) {
    return `<div style="margin-bottom:12px;">
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;">
            <span style="font-size:11px;font-weight:700;color:${DS.textSec};">${label}</span>
            <span style="font-size:11px;font-weight:900;color:${color};font-family:${DS.mono};">${pct}%</span>
        </div>
        <div style="width:100%;height:14px;background:${DS.cardAlt};border-radius:7px;overflow:hidden;">
            <div style="width:${pct}%;height:100%;background:${color};border-radius:7px;"></div>
        </div>
    </div>`;
}

// ── Build Report wrapper ──
function buildReport(r) {
    const ac = r.color;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&display=swap');</style>
</head><body style="margin:0;padding:0;background:${DS.bg};font-family:${DS.font};-webkit-font-smoothing:antialiased;">
<div style="max-width:660px;margin:0 auto;padding:20px;">

    <!-- HEADER -->
    <div style="background:linear-gradient(145deg,${ac}12,${DS.card},${DS.bg});border:1px solid ${ac}30;border-radius:20px;padding:36px 28px;text-align:center;margin-bottom:24px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${ac},transparent);"></div>
        <div style="font-size:11px;font-weight:800;color:${DS.muted};letter-spacing:4px;margin-bottom:6px;">GRAND LINE</div>
        <div style="display:inline-block;background:${ac}18;border:1px solid ${ac}35;border-radius:6px;padding:3px 14px;margin-bottom:12px;">
            <span style="font-size:9px;font-weight:900;color:${ac};letter-spacing:2.5px;">${r.label}</span>
        </div>
        <div style="font-size:26px;font-weight:900;color:${DS.text};margin:8px 0 4px;line-height:1.2;">${r.title}</div>
        <div style="font-size:13px;color:${DS.muted};">${r.period}</div>
        ${r.score ? `<div style="margin-top:16px;display:inline-block;background:${DS.cardAlt};border:1px solid ${DS.border};border-radius:20px;padding:5px 18px;">
            <span style="display:inline-block;width:7px;height:7px;background:${r.score.color};border-radius:50%;margin-right:6px;vertical-align:middle;"></span>
            <span style="font-size:10px;font-weight:800;color:${r.score.color};letter-spacing:1px;">${r.score.text}</span>
        </div>` : ''}
    </div>

    <!-- EXECUTIVE SUMMARY -->
    <div style="background:${DS.card};border:1px solid ${DS.border};border-left:3px solid ${ac};border-radius:0 14px 14px 0;padding:20px 22px;margin-bottom:24px;">
        <div style="font-size:9px;font-weight:900;color:${ac};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Resumen Ejecutivo</div>
        <div style="font-size:13px;color:${DS.textSec};line-height:1.8;">${r.summary}</div>
    </div>

    <!-- KPI DASHBOARD -->
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;">
        <tr>${r.kpis.map(k => kpiCard(k.label, k.value, k.sub, k.color, k.icon)).join('')}</tr>
    </table>

    <!-- MAIN CONTENT -->
    <div style="background:${DS.card};border:1px solid ${DS.border};border-radius:16px;padding:24px;margin-bottom:24px;">
        ${r.content}
    </div>

    <!-- VEGA AI ANALYSIS -->
    <div style="background:${DS.card};border:1px solid ${DS.border};border-radius:16px;padding:24px;margin-bottom:24px;">
        ${section('Analisis VEGA AI', '&#9889;', ac, r.vegaAI)}
    </div>

    <!-- FOOTER -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid ${DS.border};">
        <div style="font-size:12px;font-weight:900;color:${ac};letter-spacing:3px;margin-bottom:4px;">&#9889; VEGA AI</div>
        <div style="font-size:10px;color:${DS.muted};">Grand Line v8 &middot; vega@grandline.com.co</div>
        <div style="font-size:9px;color:${DS.muted};margin-top:8px;opacity:0.5;">Reporte generado automaticamente.</div>
    </div>
</div></body></html>`;
}

// ════════════════════════════════════════════════════════════════
// REPORT 1: EL LATIDO (Daily) — #d75c33
// ════════════════════════════════════════════════════════════════
const report1_latido = {
    type: 'daily',
    title: 'El Latido del Negocio',
    label: 'REPORTE DIARIO',
    color: '#d75c33',
    period: '16 Abril 2026',
    score: { color: DS.good, text: 'MUY BUENO — 82/100' },
    summary: 'Jornada solida con <strong style="color:#F0F0F5">52 ordenes</strong> (+8 vs ayer). ROAS real de <strong style="color:#22C55E">2.3x</strong> supera la meta. Tasa de entrega <strong style="color:#22C55E">64.8%</strong> (+2.1pp). Utilidad proyectada de <strong style="color:#F0F0F5">$1.8M</strong> incluyendo ordenes en transito.',
    kpis: [
        { label: 'Ordenes', value: '52', sub: `${cambio(8, ' vs ayer')}`, color: DS.blue, icon: '&#128230;' },
        { label: 'Ingreso Real', value: '$3.2M', sub: `${cambio(15.2, '% vs ayer')}`, color: DS.good, icon: '&#128176;' },
        { label: 'ROAS Real', value: '2.3x', sub: `${semaforo('green')}Meta: 2.0x`, color: DS.good, icon: '&#128200;' },
        { label: 'Util. Proy.', value: '$1.8M', sub: `${cambio(22.1, '% vs ayer')}`, color: DS.good, icon: '&#127919;' },
        { label: '% Entrega', value: '64.8%', sub: `${progressBar(64.8, DS.good, '6px', '80px')}`, color: DS.good, icon: '&#128666;' },
    ],
    content: `
        ${section('Performance Metrics', '&#128202;', '#d75c33', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                    <td style="width:33%;padding:4px;">${metricCard('CPA', '$28.5K', 'green', cambio(-8.2, '%', true))}</td>
                    <td style="width:33%;padding:4px;">${metricCard('CPE', '$44.1K', 'yellow', cambio(3.1, '%', true))}</td>
                    <td style="width:33%;padding:4px;">${metricCard('AOV', '$94.2K', 'green', cambio(5.4, '%'))}</td>
                </tr>
                <tr>
                    <td style="width:33%;padding:4px;">${metricCard('Util/Entrega', '$52.8K', 'green', cambio(12.3, '%'))}</td>
                    <td style="width:33%;padding:4px;">${metricCard('% Ads/Rev', '16.3%', 'green', cambio(-2.1, 'pp', true))}</td>
                    <td style="width:33%;padding:4px;">${metricCard('Costo Dev/Ord', '$5.4K', 'green', cambio(-15.8, '%', true))}</td>
                </tr>
            </table>
        `)}
        ${section('Top 5 Productos Rentables', '&#127942;', DS.good, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Ord'},{text:'Ent'},{text:'Ing'},{text:'Costo'},{text:'Ads'},{text:'Util'},{text:'Margen'}], true)}
                ${tableRow([{text:'Audifonos BT Pro'},{text:'15'},{text:'10'},{text:'$940K'},{text:'$380K'},{text:'$120K'},{text:'$440K',color:DS.good},{text: marginBar(46.8, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Serum Vitamina C'},{text:'12'},{text:'8'},{text:'$720K'},{text:'$310K'},{text:'$95K'},{text:'$315K',color:DS.good},{text: marginBar(43.7, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Organizador Cocina'},{text:'9'},{text:'6'},{text:'$510K'},{text:'$240K'},{text:'$80K'},{text:'$190K',color:DS.good},{text: marginBar(37.2, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Cable USB-C 3m'},{text:'8'},{text:'6'},{text:'$420K'},{text:'$195K'},{text:'$72K'},{text:'$153K',color:DS.good},{text: marginBar(36.4, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Lampara LED Smart'},{text:'8'},{text:'4'},{text:'$380K'},{text:'$185K'},{text:'$68K'},{text:'$127K',color:DS.good},{text: marginBar(33.4, DS.good).replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('5 Productos en Perdida', '&#128308;', DS.bad, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Ord'},{text:'Ent'},{text:'Ing'},{text:'Costo'},{text:'Ads'},{text:'Util'},{text:'Margen'}], true)}
                ${tableRow([{text:'Masajeador Cuello'},{text:'6'},{text:'1'},{text:'$89K'},{text:'$120K'},{text:'$95K'},{text:'-$126K',color:DS.bad},{text: marginBar(-141, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Faja Reductora XL'},{text:'5'},{text:'2'},{text:'$158K'},{text:'$130K'},{text:'$88K'},{text:'-$60K',color:DS.bad},{text: marginBar(-38, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Reloj Deportivo V2'},{text:'4'},{text:'1'},{text:'$72K'},{text:'$85K'},{text:'$52K'},{text:'-$65K',color:DS.bad},{text: marginBar(-90, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Cargador Solar'},{text:'3'},{text:'1'},{text:'$65K'},{text:'$70K'},{text:'$45K'},{text:'-$50K',color:DS.bad},{text: marginBar(-77, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Mochila Antirrobo'},{text:'5'},{text:'2'},{text:'$180K'},{text:'$160K'},{text:'$62K'},{text:'-$42K',color:DS.bad},{text: marginBar(-23, DS.bad).replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('Cascada P&L del Dia', '&#128200;', '#d75c33', waterfall([
            { label: 'Ingreso', value: 3200000, display: '$3.2M', color: DS.good },
            { label: 'COGS', value: -1800000, display: '$1.8M', color: DS.bad },
            { label: 'Flete Ent.', value: -380000, display: '$380K', color: DS.blue },
            { label: 'Flete Dev.', value: -95000, display: '$95K', color: '#f97316' },
            { label: 'Ads', value: -520000, display: '$520K', color: DS.purple },
            { label: 'Utilidad', value: 405000, display: '$405K', color: DS.good },
        ], 3200000))}
        ${section('Por Pais', '&#127758;', '#d75c33', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Pais'},{text:'Ordenes'},{text:'% Entrega'},{text:'Ads'},{text:'Utilidad'},{text:'Margen'}], true)}
                ${tableRow([{text:'&#127464;&#127476; Colombia'},{text:'28'},{text: progressBar(68, DS.good, '6px', '50px').replace(/"/g,'"') + ' 68%'},{text:'$290K'},{text:'$245K',color:DS.good},{text:'18.2%',color:DS.good}])}
                ${tableRow([{text:'&#127468;&#127481; Guatemala'},{text:'12'},{text: progressBar(58, DS.warn, '6px', '50px').replace(/"/g,'"') + ' 58%'},{text:'$135K'},{text:'$92K',color:DS.good},{text:'14.1%',color:DS.warn}])}
                ${tableRow([{text:'&#127466;&#127464; Ecuador'},{text:'8'},{text: progressBar(64, DS.warn, '6px', '50px').replace(/"/g,'"') + ' 64%'},{text:'$68K'},{text:'$48K',color:DS.good},{text:'12.8%',color:DS.warn}])}
                ${tableRow([{text:'&#127477;&#127466; Peru'},{text:'4'},{text: progressBar(55, DS.bad, '6px', '50px').replace(/"/g,'"') + ' 55%'},{text:'$27K'},{text:'$20K',color:DS.good},{text:'10.5%',color:DS.warn}])}
            </table>
        `)}
    `,
    vegaAI: `
        ${actionTag('ESCALAR', DS.good, '<strong style="color:'+DS.text+'">Audifonos Bluetooth Pro</strong> mantiene ROAS 3.8x por 5 dias consecutivos. Incrementar presupuesto 25% para capitalizar la ventana de alto rendimiento.')}
        ${actionTag('OPTIMIZAR', DS.warn, 'Guatemala muestra CPA creciente ($28K a $35K). Revisar segmentacion y creativos de las ultimas 48h antes de decidir escalar.')}
        ${actionTag('MONITOREAR', DS.blue, 'Tasa de entrega en Ecuador cayo de 68% a 64%. Si continua 2 dias mas, evaluar cambio de transportadora en la zona.')}
        ${actionTag('PAUSAR', DS.bad, 'Campana <strong style="color:'+DS.text+'">"Masajeador Cuello"</strong> lleva 3 dias con ROAS 0.7x. Pausar inmediatamente y reasignar $120K/dia.')}
    `,
};

// ════════════════════════════════════════════════════════════════
// REPORT 2: LA BRUJULA (Weekly) — #d75c33
// ════════════════════════════════════════════════════════════════
const report2_brujula = {
    type: 'weekly',
    title: 'La Brujula',
    label: 'REPORTE SEMANAL',
    color: '#d75c33',
    period: '7 — 13 Abril 2026',
    score: { color: DS.good, text: 'POSITIVO — 76/100' },
    summary: 'Semana con <strong style="color:#F0F0F5">312 ordenes</strong> (+18% vs semana anterior). ROAS semanal de <strong style="color:#22C55E">2.4x</strong>. Margen neto del <strong style="color:#22C55E">16.8%</strong>. Colombia sigue liderando con 62% del volumen.',
    kpis: [
        { label: 'Ordenes Sem.', value: '312', sub: `${cambio(18, '% vs ant.')}`, color: DS.blue, icon: '&#128230;' },
        { label: 'Ingreso Real', value: '$21.4M', sub: `${cambio(22.3, '% vs ant.')}`, color: DS.good, icon: '&#128176;' },
        { label: 'Utilidad Real', value: '$3.6M', sub: `${cambio(28.5, '% vs ant.')}`, color: DS.good, icon: '&#127919;' },
        { label: 'ROAS', value: '2.4x', sub: `${semaforo('green')}Meta: 2.0x`, color: DS.good, icon: '&#128200;' },
        { label: 'Margen', value: '16.8%', sub: `${cambio(1.2, 'pp vs ant.')}`, color: DS.good, icon: '&#128201;' },
    ],
    content: `
        ${section('Comparativa Semanal', '&#128202;', '#d75c33', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Metrica'},{text:'Sem. Anterior'},{text:'Esta Semana'},{text:'Cambio'}], true)}
                ${tableRow([{text:'Ordenes'},{text:'264'},{text:'312',color:DS.good},{text:'+18.2%',color:DS.good}])}
                ${tableRow([{text:'Entregadas'},{text:'165'},{text:'204',color:DS.good},{text:'+23.6%',color:DS.good}])}
                ${tableRow([{text:'Tasa Entrega'},{text:'62.5%'},{text:'65.4%',color:DS.good},{text:'+2.9pp',color:DS.good}])}
                ${tableRow([{text:'Ingreso Real'},{text:'$17.5M'},{text:'$21.4M',color:DS.good},{text:'+22.3%',color:DS.good}])}
                ${tableRow([{text:'ROAS'},{text:'2.1x'},{text:'2.4x',color:DS.good},{text:'+14.3%',color:DS.good}])}
                ${tableRow([{text:'CPA'},{text:'$32.1K'},{text:'$28.5K',color:DS.good},{text:'-11.2%',color:DS.good}])}
                ${tableRow([{text:'Utilidad'},{text:'$2.8M'},{text:'$3.6M',color:DS.good},{text:'+28.5%',color:DS.good}])}
                ${tableRow([{text:'Margen Neto'},{text:'15.6%'},{text:'16.8%',color:DS.good},{text:'+1.2pp',color:DS.good}])}
            </table>
        `)}
        ${section('Tendencia Diaria', '&#128197;', '#d75c33', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Dia'},{text:'Ord'},{text:'Ent'},{text:'Ads'},{text:'Utilidad'},{text:''}], true)}
                ${tableRow([{text:'Lun 7'},{text:'38'},{text:'24'},{text:'$420K'},{text:'$385K',color:DS.good},{text: progressBar(62, DS.good, '6px', '50px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Mar 8'},{text:'42'},{text:'28'},{text:'$450K'},{text:'$510K',color:DS.good},{text: progressBar(82, DS.good, '6px', '50px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Mie 9'},{text:'48'},{text:'32'},{text:'$480K'},{text:'$620K',color:DS.good},{text: progressBar(100, DS.good, '6px', '50px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Jue 10'},{text:'52'},{text:'34'},{text:'$520K'},{text:'$580K',color:DS.good},{text: progressBar(93, DS.good, '6px', '50px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Vie 11'},{text:'50'},{text:'30'},{text:'$490K'},{text:'$520K',color:DS.good},{text: progressBar(84, DS.good, '6px', '50px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Sab 12'},{text:'45'},{text:'28'},{text:'$380K'},{text:'$490K',color:DS.good},{text: progressBar(79, DS.good, '6px', '50px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Dom 13'},{text:'37'},{text:'28'},{text:'$350K'},{text:'$495K',color:DS.good},{text: progressBar(80, DS.good, '6px', '50px').replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('Top 5 Productos', '&#127942;', DS.good, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Ord'},{text:'Ent'},{text:'Utilidad'},{text:'Margen'}], true)}
                ${tableRow([{text:'Audifonos BT Pro'},{text:'92'},{text:'62'},{text:'$2.8M',color:DS.good},{text: marginBar(45.2, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Serum Vitamina C'},{text:'68'},{text:'44'},{text:'$1.9M',color:DS.good},{text: marginBar(41.8, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Organizador Cocina'},{text:'52'},{text:'35'},{text:'$1.2M',color:DS.good},{text: marginBar(36.5, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Cable USB-C 3m'},{text:'48'},{text:'32'},{text:'$980K',color:DS.good},{text: marginBar(34.8, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Lampara LED Smart'},{text:'38'},{text:'22'},{text:'$720K',color:DS.good},{text: marginBar(32.1, DS.good).replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('Bottom 5 Productos', '&#128308;', DS.bad, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Ord'},{text:'Ent'},{text:'Utilidad'},{text:'Margen'}], true)}
                ${tableRow([{text:'Masajeador Cuello'},{text:'28'},{text:'6'},{text:'-$580K',color:DS.bad},{text: marginBar(-85, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Faja Reductora XL'},{text:'22'},{text:'8'},{text:'-$320K',color:DS.bad},{text: marginBar(-42, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Reloj Deportivo V2'},{text:'18'},{text:'5'},{text:'-$280K',color:DS.bad},{text: marginBar(-55, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Cargador Solar'},{text:'14'},{text:'4'},{text:'-$195K',color:DS.bad},{text: marginBar(-48, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Mochila Antirrobo'},{text:'12'},{text:'5'},{text:'-$110K',color:DS.bad},{text: marginBar(-22, DS.bad).replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('Por Pais (Comparativa)', '&#127758;', '#d75c33', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Pais'},{text:'Ord Ant.'},{text:'Ord Act.'},{text:'Cambio'},{text:'Utilidad'},{text:'Margen'}], true)}
                ${tableRow([{text:'&#127464;&#127476; Colombia'},{text:'168'},{text:'194',color:DS.good},{text:'+15.5%',color:DS.good},{text:'$2.2M',color:DS.good},{text:'18.4%',color:DS.good}])}
                ${tableRow([{text:'&#127468;&#127481; Guatemala'},{text:'52'},{text:'62',color:DS.good},{text:'+19.2%',color:DS.good},{text:'$680K',color:DS.good},{text:'14.8%',color:DS.warn}])}
                ${tableRow([{text:'&#127466;&#127464; Ecuador'},{text:'28'},{text:'35',color:DS.good},{text:'+25.0%',color:DS.good},{text:'$420K',color:DS.good},{text:'13.2%',color:DS.warn}])}
                ${tableRow([{text:'&#127477;&#127466; Peru'},{text:'16'},{text:'21',color:DS.good},{text:'+31.2%',color:DS.good},{text:'$300K',color:DS.good},{text:'11.8%',color:DS.warn}])}
            </table>
        `)}
    `,
    vegaAI: `
        ${actionTag('ESCALAR', DS.good, '<strong style="color:'+DS.text+'">Colombia</strong> muestra mejora consistente en tasa de entrega (62% a 68% en la semana). Incrementar volumen de ordenes en un 20%.')}
        ${actionTag('OPTIMIZAR', DS.warn, 'CPA en Peru bajo de $42K a $35K pero margen sigue por debajo de 12%. Optimizar mix de productos antes de escalar.')}
        ${actionTag('PAUSAR', DS.bad, '<strong style="color:'+DS.text+'">Masajeador Cuello</strong> acumula -$580K en la semana. Pausar inmediatamente todas las campanas activas.')}
        ${actionTag('OPORTUNIDAD', DS.blue, 'Ecuador crece 25% en ordenes con ROAS 2.6x. Evaluar duplicar presupuesto la proxima semana.')}
    `,
};

// ════════════════════════════════════════════════════════════════
// REPORT 3: BITACORA LOGISTICA (Daily) — #3b82f6
// ════════════════════════════════════════════════════════════════
const report3_logistica = {
    type: 'logistics',
    title: 'Bitacora Logistica',
    label: 'BITACORA LOGISTICA',
    color: '#3b82f6',
    period: '16 Abril 2026',
    score: { color: DS.warn, text: 'ACEPTABLE — 68/100' },
    summary: 'Tasa de entrega del <strong style="color:#22C55E">64.8%</strong> con <strong style="color:#EF4444">18 cancelaciones</strong>. Principal motivo: "No contesta" (38.9%). Servientrega lidera con <strong style="color:#F0F0F5">71.4%</strong> de entrega. <strong style="color:#F59E0B">127 ordenes</strong> en transito pendientes.',
    kpis: [
        { label: '% Entrega', value: '64.8%', sub: `${progressBar(64.8, DS.good, '6px', '80px')}`, color: DS.good, icon: '&#9989;' },
        { label: 'Cancelaciones', value: '18', sub: `${cambio(3, ' vs ayer', true)}`, color: DS.bad, icon: '&#128683;' },
        { label: 'Devoluciones', value: '3', sub: `${cambio(-1, ' vs ayer', true)}`, color: '#f97316', icon: '&#8617;' },
        { label: 'En Transito', value: '127', sub: '$8.2M en juego', color: DS.warn, icon: '&#128666;' },
        { label: 'Tiempo Prom.', value: '3.2d', sub: `${cambio(-0.3, 'd vs ayer')}`, color: DS.blue, icon: '&#9201;' },
    ],
    content: `
        ${section('Tasas de Conversion Logistica', '&#128202;', DS.blue, `
            ${rateBar('Tasa de Entrega', 64.8, DS.good)}
            ${rateBar('Tasa de Cancelacion', 34.6, DS.bad)}
            ${rateBar('Tasa de Devolucion', 5.8, '#f97316')}
            ${rateBar('En Transito (% del total)', 42.3, DS.warn)}
        `)}
        ${section('Motivos de Cancelacion', '&#128683;', DS.bad, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Motivo'},{text:'Cant.'},{text:'%'},{text:'Tendencia'}], true)}
                ${tableRow([{text:'No contesta / Fuera de cobertura'},{text:'7',color:DS.bad},{text:'38.9%',color:DS.bad},{text:'&#8593; +2',color:DS.bad}])}
                ${tableRow([{text:'Cliente cancela'},{text:'5',color:DS.bad},{text:'27.8%',color:DS.bad},{text:'= 0',color:DS.muted}])}
                ${tableRow([{text:'Direccion incorrecta'},{text:'3',color:DS.warn},{text:'16.7%',color:DS.warn},{text:'&#8595; -1',color:DS.good}])}
                ${tableRow([{text:'No desea el producto'},{text:'2',color:DS.warn},{text:'11.1%',color:DS.warn},{text:'&#8593; +1',color:DS.bad}])}
                ${tableRow([{text:'Duplicado / Error sistema'},{text:'1',color:DS.muted},{text:'5.6%',color:DS.muted},{text:'= 0',color:DS.muted}])}
            </table>
        `)}
        ${section('Rendimiento por Transportadora', '&#128666;', DS.blue, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Transportadora'},{text:'Ord'},{text:'Ent'},{text:'% Entrega'},{text:'Prom. Dias'},{text:'Score'}], true)}
                ${tableRow([{text:'Servientrega'},{text:'28'},{text:'20'},{text: progressBar(71.4, DS.good, '6px', '40px').replace(/"/g,'"') + ' 71.4%'},{text:'2.8d',color:DS.good},{text: semaforo('green') + '9.2'}])}
                ${tableRow([{text:'Coordinadora'},{text:'15'},{text:'9'},{text: progressBar(60, DS.warn, '6px', '40px').replace(/"/g,'"') + ' 60.0%'},{text:'3.5d',color:DS.warn},{text: semaforo('yellow') + '7.1'}])}
                ${tableRow([{text:'Inter Rapidisimo'},{text:'9'},{text:'4'},{text: progressBar(44.4, DS.bad, '6px', '40px').replace(/"/g,'"') + ' 44.4%'},{text:'4.1d',color:DS.bad},{text: semaforo('red') + '4.8'}])}
                ${tableRow([{text:'Envia'},{text:'6'},{text:'4'},{text: progressBar(66.7, DS.good, '6px', '40px').replace(/"/g,'"') + ' 66.7%'},{text:'3.1d',color:DS.warn},{text: semaforo('yellow') + '7.5'}])}
            </table>
            <div style="margin-top:12px;padding:10px 14px;background:${DS.badBg};border-radius:8px;border:1px solid ${DS.bad}20;">
                <span style="font-size:11px;color:${DS.bad};font-weight:700;">&#9888; Inter Rapidisimo por debajo del 50% de entrega. Considerar reasignar volumen.</span>
            </div>
        `)}
        ${section('Antiguedad de Transito', '&#9201;', DS.warn, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                    <td style="width:33%;padding:6px;">
                        <div style="background:${DS.cardAlt};border-radius:10px;padding:14px;text-align:center;border:1px solid ${DS.good}30;">
                            <div style="font-size:9px;color:${DS.muted};font-weight:800;text-transform:uppercase;letter-spacing:1px;">0-3 DIAS</div>
                            <div style="font-size:22px;font-weight:900;color:${DS.good};margin-top:4px;">82</div>
                            <div style="font-size:10px;color:${DS.good};margin-top:2px;">64.6% del total</div>
                        </div>
                    </td>
                    <td style="width:33%;padding:6px;">
                        <div style="background:${DS.cardAlt};border-radius:10px;padding:14px;text-align:center;border:1px solid ${DS.warn}30;">
                            <div style="font-size:9px;color:${DS.muted};font-weight:800;text-transform:uppercase;letter-spacing:1px;">4-7 DIAS</div>
                            <div style="font-size:22px;font-weight:900;color:${DS.warn};margin-top:4px;">35</div>
                            <div style="font-size:10px;color:${DS.warn};margin-top:2px;">27.6% del total</div>
                        </div>
                    </td>
                    <td style="width:33%;padding:6px;">
                        <div style="background:${DS.cardAlt};border-radius:10px;padding:14px;text-align:center;border:1px solid ${DS.bad}30;">
                            <div style="font-size:9px;color:${DS.muted};font-weight:800;text-transform:uppercase;letter-spacing:1px;">8+ DIAS</div>
                            <div style="font-size:22px;font-weight:900;color:${DS.bad};margin-top:4px;">10</div>
                            <div style="font-size:10px;color:${DS.bad};margin-top:2px;">7.9% del total</div>
                        </div>
                    </td>
                </tr>
            </table>
        `)}
        ${section('Devoluciones Detalle', '&#8617;', '#f97316', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Motivo'},{text:'Transportadora'},{text:'Dias'}], true)}
                ${tableRow([{text:'Serum Vitamina C'},{text:'Empaque danado'},{text:'Coordinadora'},{text:'5d',color:DS.warn}])}
                ${tableRow([{text:'Audifonos BT Pro'},{text:'Producto incorrecto'},{text:'Servientrega'},{text:'3d',color:DS.good}])}
                ${tableRow([{text:'Cable USB-C 3m'},{text:'No funciona'},{text:'Inter Rapidisimo'},{text:'7d',color:DS.bad}])}
            </table>
        `)}
    `,
    vegaAI: `
        ${actionTag('URGENTE', DS.bad, '10 ordenes con 8+ dias en transito representan <strong style="color:'+DS.text+'">$650K en riesgo</strong>. Contactar transportadora inmediatamente para resolucion.')}
        ${actionTag('OPTIMIZAR', DS.warn, '"No contesta" es el 38.9% de cancelaciones. Implementar doble intento de contacto previo al despacho.')}
        ${actionTag('REASIGNAR', DS.blue, 'Inter Rapidisimo con solo 44.4% de entrega. Mover volumen a Servientrega que mantiene 71.4%.')}
        ${actionTag('MONITOREAR', DS.good, 'Servientrega mejoro de 68% a 71.4% esta semana. Evaluar asignar mayor volumen como incentivo.')}
    `,
};

// ════════════════════════════════════════════════════════════════
// REPORT 4: ESTADO DE RESULTADOS (Weekly) — #10b981
// ════════════════════════════════════════════════════════════════
const report4_financiero = {
    type: 'financial',
    title: 'Estado de Resultados',
    label: 'ESTADO DE RESULTADOS',
    color: '#10b981',
    period: '7 — 13 Abril 2026',
    score: { color: DS.good, text: 'SALUDABLE — 81/100' },
    summary: 'Utilidad neta de <strong style="color:#22C55E">$2.8M</strong> con margen del <strong style="color:#22C55E">15.1%</strong>. Ganancia bruta del 44.3% indica estructura de costos saludable. Publicidad en 8.1% de ingresos. Break-even en 168 entregas (alcanzado con 204).',
    kpis: [
        { label: 'Ingresos Tot.', value: '$18.5M', sub: `${cambio(22.3, '% vs ant.')}`, color: DS.good, icon: '&#128176;' },
        { label: 'Gan. Bruta', value: '$8.2M', sub: `${semaforo('green')}44.3% margen`, color: DS.blue, icon: '&#128202;' },
        { label: 'Util. Neta', value: '$2.8M', sub: `${semaforo('green')}15.1% margen`, color: DS.good, icon: '&#127919;' },
        { label: 'ROAS', value: '2.3x', sub: `${semaforo('green')}Meta: 2.0x`, color: DS.good, icon: '&#128200;' },
        { label: 'Break-even', value: '168', sub: 'entregas (alcanzado)', color: DS.good, icon: '&#9989;' },
    ],
    content: `
        ${section('P&L Cascade Completo', '&#128202;', DS.good, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                <tr style="background:${DS.cardAlt};border-bottom:1px solid ${DS.border};"><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-transform:uppercase;letter-spacing:1.5px;">Concepto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">Monto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">% Ing.</td></tr>
                ${pnlRow('&nbsp;&nbsp;Ing. Proveedor', '$5,400,000', '29.2%', DS.good)}
                ${pnlRow('&nbsp;&nbsp;Ing. Dropshipping', '$13,100,000', '70.8%', DS.good)}
                ${pnlRow('= INGRESOS TOTALES', '$18,500,000', '100%', DS.good, true, true)}
                ${pnlRow('(-) COGS Proveedor', '-$3,300,000', '17.8%', DS.bad)}
                ${pnlRow('(-) COGS Dropshipping', '-$7,000,000', '37.8%', DS.bad)}
                ${pnlRow('= GANANCIA BRUTA', '$8,200,000', '44.3%', DS.blue, true, true)}
                ${pnlRow('&nbsp;&nbsp;Margen Bruto %', '', '44.3%', DS.blue)}
                ${pnlRow('(-) Fletes (Solo Ventas)', '-$2,100,000', '11.4%', '#f97316')}
                ${pnlRow('(-) Publicidad', '-$1,500,000', '8.1%', DS.purple)}
                ${pnlRow('(-) Gastos Operativos', '-$1,200,000', '6.5%', DS.bad)}
                ${pnlRow('= UTILIDAD OPERACIONAL', '$3,400,000', '18.4%', DS.good, true, true)}
                ${pnlRow('(-) Gastos Administrativos', '-$600,000', '3.2%', DS.bad)}
                ${pnlRow('= UTILIDAD NETA', '$2,800,000', '15.1%', DS.good, true, true)}
                ${pnlRow('&nbsp;&nbsp;Margen Neto %', '', '15.1%', DS.good)}
            </table>
        `)}
        ${section('Cascada Visual', '&#128200;', DS.good, waterfall([
            { label: 'Ingresos', value: 18500000, display: '$18.5M', color: DS.good },
            { label: 'COGS', value: -10300000, display: '$10.3M', color: DS.bad },
            { label: '= Gan. Bruta', value: 8200000, display: '$8.2M', color: DS.blue },
            { label: 'Fletes Venta', value: -2100000, display: '$2.1M', color: '#f97316' },
            { label: 'Publicidad', value: -1500000, display: '$1.5M', color: DS.purple },
            { label: 'Gastos Op.', value: -1200000, display: '$1.2M', color: DS.bad },
            { label: 'Gastos Admin.', value: -600000, display: '$600K', color: DS.bad },
            { label: '= Util. Neta', value: 2800000, display: '$2.8M', color: DS.good },
        ], 18500000))}
        ${section('Unit Economics', '&#127919;', DS.good, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;">
                <tr>
                    <td style="width:33%;padding:4px;">${metricCard('AOV', '$90.7K', 'green', cambio(5.2, '%'))}</td>
                    <td style="width:33%;padding:4px;">${metricCard('Costo/Entrega', '$50.5K', 'yellow', cambio(-3.1, '%', true))}</td>
                    <td style="width:33%;padding:4px;">${metricCard('Flete/Entrega', '$10.3K', 'green', cambio(-1.8, '%', true))}</td>
                </tr>
                <tr>
                    <td style="width:33%;padding:4px;">${metricCard('Util/Entrega', '$13.7K', 'green', cambio(8.4, '%'))}</td>
                    <td style="width:33%;padding:4px;">${metricCard('Break-even', '168 ent.', 'green', cambio(-12, ' ent.', true))}</td>
                    <td style="width:33%;padding:4px;">${metricCard('MER', '8.1%', 'green', cambio(-0.8, 'pp', true))}</td>
                </tr>
            </table>
        `)}
        ${section('Gastos por Categoria', '&#128179;', DS.bad, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Categoria'},{text:'Monto'},{text:'%'},{text:''}], true)}
                ${tableRow([{text:'Marketing / Ads'},{text:'$1,500,000',color:DS.purple},{text:'42.3%'},{text: progressBar(42.3, DS.purple, '6px', '60px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Nomina'},{text:'$850,000',color:DS.bad},{text:'24.0%'},{text: progressBar(24, DS.bad, '6px', '60px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Aplicaciones / SaaS'},{text:'$380,000',color:DS.warn},{text:'10.7%'},{text: progressBar(10.7, DS.warn, '6px', '60px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Servicios'},{text:'$250,000'},{text:'7.1%'},{text: progressBar(7.1, DS.blue, '6px', '60px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Fulfillment'},{text:'$180,000'},{text:'5.1%'},{text: progressBar(5.1, DS.blue, '6px', '60px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Gastos Bancarios'},{text:'$120,000'},{text:'3.4%'},{text: progressBar(3.4, DS.muted, '6px', '60px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Impuestos + Otros'},{text:'$265,000'},{text:'7.5%'},{text: progressBar(7.5, DS.muted, '6px', '60px').replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('Comparativa vs Semana Anterior', '&#128260;', DS.good, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Concepto'},{text:'Sem. Anterior'},{text:'Esta Semana'},{text:'Cambio'}], true)}
                ${tableRow([{text:'Ingresos'},{text:'$15.2M'},{text:'$18.5M',color:DS.good},{text:'+21.7%',color:DS.good}])}
                ${tableRow([{text:'Gan. Bruta'},{text:'$6.5M'},{text:'$8.2M',color:DS.good},{text:'+26.2%',color:DS.good}])}
                ${tableRow([{text:'Margen Bruto'},{text:'42.8%'},{text:'44.3%',color:DS.good},{text:'+1.5pp',color:DS.good}])}
                ${tableRow([{text:'Util. Neta'},{text:'$2.1M'},{text:'$2.8M',color:DS.good},{text:'+33.3%',color:DS.good}])}
                ${tableRow([{text:'Margen Neto'},{text:'13.8%'},{text:'15.1%',color:DS.good},{text:'+1.3pp',color:DS.good}])}
                ${tableRow([{text:'ROAS'},{text:'2.0x'},{text:'2.3x',color:DS.good},{text:'+15.0%',color:DS.good}])}
            </table>
        `)}
    `,
    vegaAI: `
        ${actionTag('POSITIVO', DS.good, 'Margen neto mejoro de 13.8% a 15.1%. La optimizacion de COGS dropshipping esta funcionando. Mantener estrategia actual.')}
        ${actionTag('OPTIMIZAR', DS.warn, 'Fletes representan 11.4% de ingresos. Meta es <10%. Negociar tarifas con Servientrega por volumen alcanzado.')}
        ${actionTag('ESCALAR', DS.good, 'Break-even en 168 entregas (alcanzado dia 5). Hay espacio para incrementar gasto en ads manteniendo rentabilidad.')}
        ${actionTag('MONITOREAR', DS.blue, 'Gastos administrativos crecieron 8% sin aumento proporcional en ingresos. Revisar si hay optimizaciones posibles.')}
    `,
};

// ════════════════════════════════════════════════════════════════
// REPORT 5: REPORTE PROVEEDOR (Weekly) — #8b5cf6
// ════════════════════════════════════════════════════════════════
const report5_proveedor = {
    type: 'supplier',
    title: 'Reporte Proveedor',
    label: 'REPORTE PROVEEDOR',
    color: '#8b5cf6',
    period: '7 — 13 Abril 2026',
    score: { color: DS.good, text: 'RENTABLE — 79/100' },
    summary: 'Ingreso proveedor de <strong style="color:#22C55E">$5.4M</strong> con margen del <strong style="color:#8B5CF6">38.2%</strong>. Proveedor <strong>NO paga fletes ni ads</strong> — solo P&L simplificado. <strong style="color:#F59E0B">2 productos</strong> con stock critico necesitan reorden.',
    kpis: [
        { label: 'Ingreso Prov.', value: '$5.4M', sub: `${cambio(18.5, '% vs ant.')}`, color: DS.good, icon: '&#128230;' },
        { label: 'Costo Merc.', value: '$3.3M', sub: '61.8% del ing.', color: DS.bad, icon: '&#128184;' },
        { label: 'Ganancia', value: '$2.06M', sub: `${semaforo('green')}SIN fletes`, color: DS.good, icon: '&#128176;' },
        { label: 'Margen', value: '38.2%', sub: `${cambio(2.1, 'pp vs ant.')}`, color: DS.purple, icon: '&#128200;' },
    ],
    content: `
        ${section('P&L Proveedor (Simplificado)', '&#128202;', DS.purple, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                <tr style="background:${DS.cardAlt};border-bottom:1px solid ${DS.border};"><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-transform:uppercase;letter-spacing:1.5px;">Concepto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">Monto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">%</td></tr>
                ${pnlRow('Ingresos por Venta', '$5,400,000', '100%', DS.good, true)}
                ${pnlRow('(-) Costo de Mercancia', '-$3,340,000', '61.8%', DS.bad)}
                ${pnlRow('= GANANCIA PROVEEDOR', '$2,060,000', '38.2%', DS.good, true, true)}
            </table>
            <div style="margin-top:12px;padding:10px 14px;background:${DS.purpleBg};border-radius:8px;border:1px solid ${DS.purple}20;">
                <span style="font-size:10px;color:${DS.purple};font-weight:700;">&#9432; Este P&L NO incluye fletes ni publicidad. Estos costos son responsabilidad del operador.</span>
            </div>
        `)}
        ${section('Top Productos por Margen', '&#127942;', DS.purple, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Uds'},{text:'Ingreso'},{text:'Costo'},{text:'Ganancia'},{text:'Margen'}], true)}
                ${tableRow([{text:'Audifonos BT Pro'},{text:'85'},{text:'$2.1M'},{text:'$1.22M'},{text:'$890K',color:DS.good},{text: marginBar(42.1, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Serum Vitamina C'},{text:'62'},{text:'$1.35M'},{text:'$830K'},{text:'$520K',color:DS.good},{text: marginBar(38.5, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Organizador Cocina'},{text:'41'},{text:'$880K'},{text:'$570K'},{text:'$310K',color:DS.good},{text: marginBar(35.2, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Cable USB-C 3m'},{text:'35'},{text:'$560K'},{text:'$375K'},{text:'$185K',color:DS.good},{text: marginBar(33.0, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Lampara LED Smart'},{text:'28'},{text:'$510K'},{text:'$345K'},{text:'$165K',color:DS.good},{text: marginBar(32.4, DS.good).replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('Productos en Perdida', '&#128308;', DS.bad, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Uds'},{text:'Ingreso'},{text:'Costo'},{text:'Ganancia'},{text:'Margen'}], true)}
                ${tableRow([{text:'Cargador Solar'},{text:'12'},{text:'$168K'},{text:'$192K'},{text:'-$24K',color:DS.bad},{text: marginBar(-14.3, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Faja Reductora XL'},{text:'8'},{text:'$240K'},{text:'$256K'},{text:'-$16K',color:DS.bad},{text: marginBar(-6.7, DS.bad).replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('Por Tienda', '&#127978;', DS.purple, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Tienda'},{text:'Ordenes'},{text:'Uds'},{text:'Ingreso'},{text:'Ganancia'}], true)}
                ${tableRow([{text:'Tienda CO Principal'},{text:'142'},{text:'188'},{text:'$3.8M',color:DS.good},{text:'$1.45M',color:DS.good}])}
                ${tableRow([{text:'Tienda GT'},{text:'38'},{text:'52'},{text:'$980K',color:DS.good},{text:'$375K',color:DS.good}])}
                ${tableRow([{text:'Tienda EC'},{text:'22'},{text:'28'},{text:'$420K',color:DS.good},{text:'$155K',color:DS.good}])}
                ${tableRow([{text:'Tienda PE'},{text:'12'},{text:'15'},{text:'$200K',color:DS.warn},{text:'$75K',color:DS.good}])}
            </table>
        `)}
        ${section('Alertas de Inventario', '&#9888;', DS.warn, `
            <div style="padding:14px;background:${DS.badBg};border-left:3px solid ${DS.bad};border-radius:0 10px 10px 0;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:12px;color:${DS.bad};font-weight:700;">Cable USB-C 3m</div>
                        <div style="font-size:10px;color:${DS.muted};margin-top:2px;">Velocidad: 2.8 uds/dia | Stock: 3 uds</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:14px;font-weight:900;color:${DS.bad};font-family:${DS.mono};">~1 dia</div>
                        <div style="font-size:9px;color:${DS.muted};">restante</div>
                    </div>
                </div>
                ${progressBar(8, DS.bad, '4px', '100%')}
            </div>
            <div style="padding:14px;background:${DS.warnBg};border-left:3px solid ${DS.warn};border-radius:0 10px 10px 0;margin-bottom:8px;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:12px;color:${DS.warn};font-weight:700;">Serum Vitamina C</div>
                        <div style="font-size:10px;color:${DS.muted};margin-top:2px;">Velocidad: 2.9 uds/dia | Stock: 12 uds</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:14px;font-weight:900;color:${DS.warn};font-family:${DS.mono};">~4 dias</div>
                        <div style="font-size:9px;color:${DS.muted};">restante</div>
                    </div>
                </div>
                ${progressBar(25, DS.warn, '4px', '100%')}
            </div>
            <div style="padding:14px;background:${DS.goodBg};border-left:3px solid ${DS.good};border-radius:0 10px 10px 0;">
                <div style="display:flex;justify-content:space-between;align-items:center;">
                    <div>
                        <div style="font-size:12px;color:${DS.good};font-weight:700;">Audifonos BT Pro</div>
                        <div style="font-size:10px;color:${DS.muted};margin-top:2px;">Velocidad: 4.2 uds/dia | Stock: 85 uds</div>
                    </div>
                    <div style="text-align:right;">
                        <div style="font-size:14px;font-weight:900;color:${DS.good};font-family:${DS.mono};">~20 dias</div>
                        <div style="font-size:9px;color:${DS.muted};">restante</div>
                    </div>
                </div>
                ${progressBar(80, DS.good, '4px', '100%')}
            </div>
        `)}
    `,
    vegaAI: `
        ${actionTag('URGENTE', DS.bad, '<strong style="color:'+DS.text+'">Cable USB-C 3m</strong> se agota en ~1 dia. Realizar pedido de reorden INMEDIATO (min. 100 uds).')}
        ${actionTag('ALERTA', DS.warn, '<strong style="color:'+DS.text+'">Serum Vitamina C</strong> tiene 4 dias de stock. Pedir al menos 80 unidades esta semana.')}
        ${actionTag('DESCONTINUAR', DS.bad, 'Cargador Solar y Faja Reductora tienen margen negativo. Evaluar subir precio o descontinuar.')}
        ${actionTag('ESCALAR', DS.good, 'Audifonos BT Pro lidera con 42.1% de margen y stock para 20 dias. Producto estrella del proveedor.')}
    `,
};

// ════════════════════════════════════════════════════════════════
// REPORT 6: CIERRE DE MES (Monthly) — #f59e0b
// ════════════════════════════════════════════════════════════════
const report6_cierre = {
    type: 'monthly',
    title: 'Cierre de Mes',
    label: 'CIERRE MENSUAL',
    color: '#f59e0b',
    period: 'Marzo 2026',
    score: { color: DS.good, text: 'EXCELENTE — 85/100' },
    summary: 'Mes record con <strong style="color:#F0F0F5">$72.4M en ingresos</strong> (+28% vs Feb). Utilidad neta de <strong style="color:#22C55E">$11.2M</strong> (15.5% margen). 1,248 ordenes procesadas con tasa de entrega promedio del <strong style="color:#22C55E">66.2%</strong>.',
    kpis: [
        { label: 'Ingresos Mes', value: '$72.4M', sub: `${cambio(28.3, '% vs Feb')}`, color: DS.good, icon: '&#128176;' },
        { label: 'Util. Neta', value: '$11.2M', sub: `${cambio(35.2, '% vs Feb')}`, color: DS.good, icon: '&#127919;' },
        { label: 'Margen Neto', value: '15.5%', sub: `${semaforo('green')}Meta: 15%`, color: DS.good, icon: '&#128200;' },
        { label: 'vs Mes Ant.', value: '+28%', sub: 'Crecimiento MoM', color: DS.good, icon: '&#128640;' },
        { label: 'Total Ordenes', value: '1,248', sub: `${cambio(22.1, '% vs Feb')}`, color: DS.blue, icon: '&#128230;' },
    ],
    content: `
        ${section('P&L Mensual Completo', '&#128202;', '#f59e0b', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                <tr style="background:${DS.cardAlt};border-bottom:1px solid ${DS.border};"><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-transform:uppercase;letter-spacing:1.5px;">Concepto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">Monto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">% Ing.</td></tr>
                ${pnlRow('&nbsp;&nbsp;Ing. Proveedor', '$21,200,000', '29.3%', DS.good)}
                ${pnlRow('&nbsp;&nbsp;Ing. Dropshipping', '$51,200,000', '70.7%', DS.good)}
                ${pnlRow('= INGRESOS TOTALES', '$72,400,000', '100%', DS.good, true, true)}
                ${pnlRow('(-) COGS Total', '-$40,200,000', '55.5%', DS.bad)}
                ${pnlRow('= GANANCIA BRUTA', '$32,200,000', '44.5%', DS.blue, true, true)}
                ${pnlRow('(-) Fletes (Solo Ventas)', '-$8,200,000', '11.3%', '#f97316')}
                ${pnlRow('(-) Publicidad', '-$5,800,000', '8.0%', DS.purple)}
                ${pnlRow('(-) Gastos Operativos', '-$4,600,000', '6.4%', DS.bad)}
                ${pnlRow('= UTILIDAD OPERACIONAL', '$13,600,000', '18.8%', DS.good, true, true)}
                ${pnlRow('(-) Gastos Administrativos', '-$2,400,000', '3.3%', DS.bad)}
                ${pnlRow('= UTILIDAD NETA', '$11,200,000', '15.5%', DS.good, true, true)}
            </table>
        `)}
        ${section('Comparativa vs Mes Anterior', '&#128260;', '#f59e0b', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Concepto'},{text:'Febrero'},{text:'Marzo'},{text:'Cambio'}], true)}
                ${tableRow([{text:'Ingresos'},{text:'$56.4M'},{text:'$72.4M',color:DS.good},{text:'+28.4%',color:DS.good}])}
                ${tableRow([{text:'Gan. Bruta'},{text:'$24.8M'},{text:'$32.2M',color:DS.good},{text:'+29.8%',color:DS.good}])}
                ${tableRow([{text:'Margen Bruto'},{text:'44.0%'},{text:'44.5%',color:DS.good},{text:'+0.5pp',color:DS.good}])}
                ${tableRow([{text:'Publicidad'},{text:'$4.8M'},{text:'$5.8M',color:DS.bad},{text:'+20.8%',color:DS.warn}])}
                ${tableRow([{text:'ROAS'},{text:'2.1x'},{text:'2.4x',color:DS.good},{text:'+14.3%',color:DS.good}])}
                ${tableRow([{text:'Util. Neta'},{text:'$8.3M'},{text:'$11.2M',color:DS.good},{text:'+34.9%',color:DS.good}])}
                ${tableRow([{text:'Margen Neto'},{text:'14.7%'},{text:'15.5%',color:DS.good},{text:'+0.8pp',color:DS.good}])}
                ${tableRow([{text:'Ordenes'},{text:'1,022'},{text:'1,248',color:DS.good},{text:'+22.1%',color:DS.good}])}
                ${tableRow([{text:'Tasa Entrega'},{text:'63.8%'},{text:'66.2%',color:DS.good},{text:'+2.4pp',color:DS.good}])}
            </table>
        `)}
        ${section('Resumen Proveedor del Mes', '&#128230;', DS.purple, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                <tr style="background:${DS.cardAlt};border-bottom:1px solid ${DS.border};"><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-transform:uppercase;letter-spacing:1.5px;">Concepto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">Monto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">%</td></tr>
                ${pnlRow('Ingresos Proveedor', '$21,200,000', '100%', DS.good, true)}
                ${pnlRow('(-) Costo Mercancia', '-$13,100,000', '61.8%', DS.bad)}
                ${pnlRow('= Ganancia Proveedor', '$8,100,000', '38.2%', DS.good, true, true)}
            </table>
        `)}
        ${section('Por Pais', '&#127758;', '#f59e0b', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Pais'},{text:'Ordenes'},{text:'Ingresos'},{text:'% Entrega'},{text:'Utilidad'},{text:'Margen'}], true)}
                ${tableRow([{text:'&#127464;&#127476; Colombia'},{text:'762'},{text:'$44.8M',color:DS.good},{text:'68.5%',color:DS.good},{text:'$7.2M',color:DS.good},{text:'16.1%',color:DS.good}])}
                ${tableRow([{text:'&#127468;&#127481; Guatemala'},{text:'248'},{text:'$14.2M',color:DS.good},{text:'62.1%',color:DS.warn},{text:'$2.1M',color:DS.good},{text:'14.8%',color:DS.warn}])}
                ${tableRow([{text:'&#127466;&#127464; Ecuador'},{text:'148'},{text:'$8.5M',color:DS.good},{text:'64.8%',color:DS.warn},{text:'$1.3M',color:DS.good},{text:'15.3%',color:DS.good}])}
                ${tableRow([{text:'&#127477;&#127466; Peru'},{text:'90'},{text:'$4.9M',color:DS.good},{text:'58.9%',color:DS.bad},{text:'$600K',color:DS.good},{text:'12.2%',color:DS.warn}])}
            </table>
        `)}
        ${section('Gastos Berry Detallados', '&#128179;', DS.bad, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Categoria'},{text:'Febrero'},{text:'Marzo'},{text:'Cambio'},{text:'%'}], true)}
                ${tableRow([{text:'Marketing / Ads'},{text:'$4.8M'},{text:'$5.8M',color:DS.purple},{text:'+20.8%',color:DS.warn},{text: progressBar(41.4, DS.purple, '6px', '40px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Nomina'},{text:'$3.2M'},{text:'$3.4M',color:DS.bad},{text:'+6.3%',color:DS.muted},{text: progressBar(24.3, DS.bad, '6px', '40px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Aplicaciones'},{text:'$1.4M'},{text:'$1.5M',color:DS.warn},{text:'+7.1%',color:DS.muted},{text: progressBar(10.7, DS.warn, '6px', '40px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Servicios'},{text:'$920K'},{text:'$980K'},{text:'+6.5%',color:DS.muted},{text: progressBar(7.0, DS.blue, '6px', '40px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Fulfillment'},{text:'$680K'},{text:'$720K'},{text:'+5.9%',color:DS.muted},{text: progressBar(5.1, DS.blue, '6px', '40px').replace(/"/g,'"')}])}
                ${tableRow([{text:'Otros'},{text:'$1.4M'},{text:'$1.6M'},{text:'+14.3%',color:DS.warn},{text: progressBar(11.4, DS.muted, '6px', '40px').replace(/"/g,'"')}])}
            </table>
        `)}
        ${section('Top/Bottom Productos del Mes', '&#127942;', DS.good, `
            <div style="font-size:10px;font-weight:800;color:${DS.good};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">&#9650; TOP 3 RENTABLES</div>
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};margin-bottom:16px;">
                ${tableRow([{text:'Producto'},{text:'Uds'},{text:'Utilidad'},{text:'Margen'}], true)}
                ${tableRow([{text:'Audifonos BT Pro'},{text:'340'},{text:'$3.6M',color:DS.good},{text: marginBar(44.8, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Serum Vitamina C'},{text:'248'},{text:'$2.4M',color:DS.good},{text: marginBar(40.2, DS.good).replace(/"/g,'"')}])}
                ${tableRow([{text:'Organizador Cocina'},{text:'185'},{text:'$1.5M',color:DS.good},{text: marginBar(36.1, DS.good).replace(/"/g,'"')}])}
            </table>
            <div style="font-size:10px;font-weight:800;color:${DS.bad};text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">&#9660; BOTTOM 3 EN PERDIDA</div>
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Uds'},{text:'Utilidad'},{text:'Margen'}], true)}
                ${tableRow([{text:'Masajeador Cuello'},{text:'112'},{text:'-$2.1M',color:DS.bad},{text: marginBar(-68, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Faja Reductora XL'},{text:'88'},{text:'-$1.2M',color:DS.bad},{text: marginBar(-38, DS.bad).replace(/"/g,'"')}])}
                ${tableRow([{text:'Cargador Solar'},{text:'52'},{text:'-$680K',color:DS.bad},{text: marginBar(-45, DS.bad).replace(/"/g,'"')}])}
            </table>
        `)}
    `,
    vegaAI: `
        ${actionTag('CELEBRAR', DS.good, 'Mes record. Ingresos +28%, utilidad +35%. La estrategia de escalar Colombia + optimizar CPA esta funcionando.')}
        ${actionTag('DESCONTINUAR', DS.bad, 'Masajeador Cuello acumulo -$2.1M en el mes. DESCONTINUAR inmediatamente. No hay señal de mejora.')}
        ${actionTag('EXPANDIR', DS.blue, 'Peru crece 31% en ordenes pero tasa de entrega (58.9%) limita rentabilidad. Mejorar logistica antes de escalar.')}
        ${actionTag('META ABRIL', DS.warn, 'Para Abril: Meta $85M ingresos (+17%). Requiere mejorar tasa entrega a 68% y mantener ROAS >2.2x.')}
    `,
};

// ════════════════════════════════════════════════════════════════
// REPORT 7: LA VISION (Monthly mid-month) — #f59e0b
// ════════════════════════════════════════════════════════════════
const report7_vision = {
    type: 'vision',
    title: 'La Vision',
    label: 'PROYECCION MID-MONTH',
    color: '#f59e0b',
    period: '1 — 16 Abril 2026 (Proyeccion)',
    score: { color: DS.good, text: 'EN CAMINO — 74/100' },
    summary: 'A mitad de mes llevamos <strong style="color:#F0F0F5">$38.2M de ingresos</strong> (52.8% de la meta). Proyeccion de cierre: <strong style="color:#22C55E">$78.5M</strong> (+8.4% vs Marzo). Utilidad proyectada <strong style="color:#22C55E">$12.4M</strong>. 4 paises activos con Colombia dominando al 61%.',
    kpis: [
        { label: 'Ingresos MTD', value: '$38.2M', sub: `${progressBar(52.8, DS.warn, '6px', '80px')}`, color: DS.good, icon: '&#128176;' },
        { label: 'Proy. Mes', value: '$78.5M', sub: `${cambio(8.4, '% vs Mar')}`, color: DS.good, icon: '&#128302;' },
        { label: 'Util. Proy.', value: '$12.4M', sub: `${semaforo('green')}15.8% margen`, color: DS.good, icon: '&#127919;' },
        { label: 'Paises Activos', value: '4', sub: 'CO, GT, EC, PE', color: DS.blue, icon: '&#127758;' },
        { label: 'Tendencia', value: '&#8593;&#8593;', sub: `${semaforo('green')}Acelerando`, color: DS.good, icon: '&#128640;' },
    ],
    content: `
        ${section('Proyeccion del Mes', '&#128302;', '#f59e0b', `
            <div style="margin-bottom:16px;">
                <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
                    <span style="font-size:11px;font-weight:700;color:${DS.textSec};">Progreso hacia meta ($85M)</span>
                    <span style="font-size:11px;font-weight:900;color:${DS.warn};font-family:${DS.mono};">$38.2M / $85M (44.9%)</span>
                </div>
                <div style="width:100%;height:20px;background:${DS.cardAlt};border-radius:10px;overflow:hidden;position:relative;">
                    <div style="width:44.9%;height:100%;background:linear-gradient(90deg,${DS.warn},#f59e0b);border-radius:10px;"></div>
                    <div style="position:absolute;top:0;left:52.8%;width:2px;height:100%;background:${DS.good};opacity:0.8;"></div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:4px;">
                    <span style="font-size:9px;color:${DS.muted};">Dia 1</span>
                    <span style="font-size:9px;color:${DS.good};">&#9650; Ritmo actual: $78.5M</span>
                    <span style="font-size:9px;color:${DS.muted};">Dia 30</span>
                </div>
            </div>
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Metrica'},{text:'Actual (d16)'},{text:'Proyeccion d30'},{text:'Meta'},{text:'Status'}], true)}
                ${tableRow([{text:'Ingresos'},{text:'$38.2M'},{text:'$78.5M',color:DS.good},{text:'$85M'},{text: semaforo('yellow') + '92.4%'}])}
                ${tableRow([{text:'Ordenes'},{text:'672'},{text:'1,380',color:DS.good},{text:'1,400'},{text: semaforo('green') + '98.6%'}])}
                ${tableRow([{text:'Utilidad'},{text:'$5.9M'},{text:'$12.4M',color:DS.good},{text:'$13M'},{text: semaforo('yellow') + '95.4%'}])}
                ${tableRow([{text:'Tasa Entrega'},{text:'66.8%'},{text:'67.5%',color:DS.good},{text:'68%'},{text: semaforo('green') + '99.3%'}])}
                ${tableRow([{text:'ROAS'},{text:'2.4x'},{text:'2.3x',color:DS.good},{text:'2.2x'},{text: semaforo('green') + '104.5%'}])}
            </table>
        `)}
        ${section('Por Pais (con Proyeccion)', '&#127758;', '#f59e0b', `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Pais'},{text:'MTD'},{text:'Proy. Mes'},{text:'vs Mar'},{text:'% Total'}], true)}
                ${tableRow([{text:'&#127464;&#127476; Colombia'},{text:'$23.4M'},{text:'$48.1M',color:DS.good},{text:'+7.4%',color:DS.good},{text:'61.3%'}])}
                ${tableRow([{text:'&#127468;&#127481; Guatemala'},{text:'$7.8M'},{text:'$16.0M',color:DS.good},{text:'+12.7%',color:DS.good},{text:'20.4%'}])}
                ${tableRow([{text:'&#127466;&#127464; Ecuador'},{text:'$4.5M'},{text:'$9.2M',color:DS.good},{text:'+8.2%',color:DS.good},{text:'11.7%'}])}
                ${tableRow([{text:'&#127477;&#127466; Peru'},{text:'$2.5M'},{text:'$5.2M',color:DS.good},{text:'+6.1%',color:DS.good},{text:'6.6%'}])}
            </table>
        `)}
        ${section('Productos Estrella (por Utilidad Proyectada)', '&#11088;', DS.good, `
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                ${tableRow([{text:'Producto'},{text:'Util MTD'},{text:'Proy. Mes'},{text:'Margen'},{text:'Tendencia'}], true)}
                ${tableRow([{text:'Audifonos BT Pro'},{text:'$1.9M'},{text:'$3.9M',color:DS.good},{text: marginBar(45.1, DS.good).replace(/"/g,'"')},{text:'&#8593;&#8593;',color:DS.good}])}
                ${tableRow([{text:'Serum Vitamina C'},{text:'$1.2M'},{text:'$2.5M',color:DS.good},{text: marginBar(40.8, DS.good).replace(/"/g,'"')},{text:'&#8593;',color:DS.good}])}
                ${tableRow([{text:'Organizador Cocina'},{text:'$780K'},{text:'$1.6M',color:DS.good},{text: marginBar(36.2, DS.good).replace(/"/g,'"')},{text:'&#8594;',color:DS.warn}])}
                ${tableRow([{text:'Cable USB-C 3m'},{text:'$520K'},{text:'$1.1M',color:DS.good},{text: marginBar(33.8, DS.good).replace(/"/g,'"')},{text:'&#8593;',color:DS.good}])}
                ${tableRow([{text:'Lampara LED Smart'},{text:'$380K'},{text:'$780K',color:DS.good},{text: marginBar(31.5, DS.good).replace(/"/g,'"')},{text:'&#8594;',color:DS.warn}])}
            </table>
        `)}
    `,
    vegaAI: `
        ${actionTag('ACELERAR', DS.good, 'Ritmo actual proyecta $78.5M (92.4% de meta). Para alcanzar $85M necesitamos +15% en ordenes diarias los ultimos 14 dias.')}
        ${actionTag('OPORTUNIDAD', DS.blue, 'Guatemala crece 12.7% vs Marzo. Incrementar presupuesto ads 20% para capitalizar el momentum.')}
        ${actionTag('RIESGO', DS.warn, 'Si Cable USB-C se agota (1 dia de stock), perdemos ~$35K/dia en utilidad. Reorden urgente.')}
        ${actionTag('ESTRATEGIA', DS.purple, 'Semana 3-4: Push fuerte en Colombia (61% del ingreso). Duplicar presupuesto en audifonos y serum que tienen ROAS >3x.')}
    `,
};

// ── All reports ──
const reports = [
    report1_latido,
    report2_brujula,
    report3_logistica,
    report4_financiero,
    report5_proveedor,
    report6_cierre,
    report7_vision,
];

// ── Send ──
console.log(`Enviando ${reports.length} reportes premium a ${TO}...\n`);

for (const r of reports) {
    try {
        const html = buildReport(r);
        await transporter.sendMail({ from: FROM, to: TO, subject: `VEGA — ${r.title} (${r.period})`, html });
        console.log(`OK ${r.label} enviado`);
    } catch (err) {
        console.error(`ERROR ${r.label}: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
}

console.log('\nReportes premium enviados. Revisa tu bandeja.');
