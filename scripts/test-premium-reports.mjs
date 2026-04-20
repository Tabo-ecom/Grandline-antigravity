/**
 * VEGA Premium Report Templates — Rich HTML emails + PDF-ready
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

function kpiCard(label, value, sub, color, colorBg, icon = '') {
    return `<td style="width:20%;padding:6px;">
        <div style="background:${DS.card};border:1px solid ${DS.border};border-radius:14px;padding:18px 14px;text-align:center;">
            <div style="font-size:9px;font-weight:800;color:${DS.muted};text-transform:uppercase;letter-spacing:2px;margin-bottom:10px;">${icon} ${label}</div>
            <div style="font-size:26px;font-weight:900;color:${color};font-family:${DS.mono};line-height:1;">${value}</div>
            <div style="font-size:10px;color:${DS.textSec};margin-top:6px;">${sub}</div>
        </div>
    </td>`;
}

function pnlRow(concept, value, pct, color, isBold = false, isHighlight = false) {
    const bg = isHighlight ? DS.cardAlt : 'transparent';
    const weight = isBold ? '900' : '500';
    const size = isBold ? '13px' : '12px';
    const indent = concept.startsWith('(') ? 'padding-left:24px;' : '';
    return `<tr style="background:${bg};border-bottom:1px solid ${DS.border};">
        <td style="padding:10px 14px;font-size:${size};font-weight:${weight};color:${isBold ? DS.text : DS.textSec};${indent}">${concept}</td>
        <td style="padding:10px 14px;font-size:${size};font-weight:900;color:${color};text-align:right;font-family:${DS.mono};">${value}</td>
        <td style="padding:10px 14px;font-size:10px;color:${DS.muted};text-align:right;">${pct}</td>
    </tr>`;
}

function waterfall(items, maxVal) {
    return items.map(item => {
        const pct = Math.min(100, (Math.abs(item.value) / maxVal) * 100);
        const isPositive = item.value >= 0;
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:6px;">
            <div style="width:100px;text-align:right;font-size:10px;font-weight:700;color:${DS.textSec};flex-shrink:0;">${item.label}</div>
            <div style="flex:1;height:24px;background:${DS.cardAlt};border-radius:6px;overflow:hidden;position:relative;">
                <div style="height:100%;width:${pct}%;background:${item.color};border-radius:6px;opacity:0.8;"></div>
            </div>
            <div style="width:80px;text-align:right;font-size:11px;font-weight:900;color:${item.color};font-family:${DS.mono};flex-shrink:0;">${isPositive ? '' : '-'}${item.display}</div>
        </div>`;
    }).join('');
}

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

function actionTag(tag, color, text) {
    return `<div style="padding:14px 16px;background:${color}08;border-left:3px solid ${color};border-radius:0 10px 10px 0;margin-bottom:8px;">
        <div style="display:inline-block;background:${color}20;border:1px solid ${color}40;border-radius:4px;padding:2px 8px;margin-bottom:6px;">
            <span style="font-size:9px;font-weight:900;color:${color};letter-spacing:1px;">${tag}</span>
        </div>
        <div style="font-size:12px;color:${DS.textSec};line-height:1.6;">${text}</div>
    </div>`;
}

function buildReport(r) {
    const ac = r.color;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1.0">
<style>@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@400;500;600;700;800;900&display=swap');</style>
</head><body style="margin:0;padding:0;background:${DS.bg};font-family:${DS.font};-webkit-font-smoothing:antialiased;">
<div style="max-width:680px;margin:0 auto;padding:20px;">

    <!-- ═══ HEADER ═══ -->
    <div style="background:linear-gradient(145deg,${ac}12,${DS.card},${DS.bg});border:1px solid ${ac}30;border-radius:20px;padding:36px 28px;text-align:center;margin-bottom:24px;position:relative;overflow:hidden;">
        <div style="position:absolute;top:0;left:0;right:0;height:3px;background:linear-gradient(90deg,transparent,${ac},transparent);"></div>
        <div style="font-size:11px;font-weight:800;color:${DS.muted};letter-spacing:4px;margin-bottom:6px;">GRAND LINE</div>
        <div style="display:inline-block;background:${ac}18;border:1px solid ${ac}35;border-radius:6px;padding:3px 14px;margin-bottom:12px;">
            <span style="font-size:9px;font-weight:900;color:${ac};letter-spacing:2.5px;">${r.label}</span>
        </div>
        <div style="font-size:26px;font-weight:900;color:${DS.text};margin:8px 0 4px;line-height:1.2;">${r.title}</div>
        <div style="font-size:13px;color:${DS.muted};">${r.period}</div>
        <div style="margin-top:16px;display:inline-block;background:${DS.cardAlt};border:1px solid ${DS.border};border-radius:20px;padding:5px 18px;">
            <span style="display:inline-block;width:7px;height:7px;background:${DS.good};border-radius:50%;margin-right:6px;vertical-align:middle;"></span>
            <span style="font-size:10px;font-weight:800;color:${DS.good};letter-spacing:1px;">MUY BUENO — 78/100</span>
        </div>
    </div>

    <!-- ═══ EXECUTIVE SUMMARY ═══ -->
    <div style="background:${DS.card};border:1px solid ${DS.border};border-left:3px solid ${ac};border-radius:0 14px 14px 0;padding:20px 22px;margin-bottom:24px;">
        <div style="font-size:9px;font-weight:900;color:${ac};text-transform:uppercase;letter-spacing:2px;margin-bottom:8px;">Resumen Ejecutivo</div>
        <div style="font-size:13px;color:${DS.textSec};line-height:1.8;">${r.summary}</div>
    </div>

    <!-- ═══ KPI DASHBOARD ═══ -->
    <table cellpadding="0" cellspacing="0" border="0" style="width:100%;margin-bottom:24px;">
        <tr>${r.kpis.map(k => kpiCard(k.label, k.value, k.sub, k.color, k.colorBg, k.icon)).join('')}</tr>
    </table>

    <!-- ═══ MAIN CONTENT ═══ -->
    <div style="background:${DS.card};border:1px solid ${DS.border};border-radius:16px;padding:24px;margin-bottom:24px;">
        ${r.content}
    </div>

    <!-- ═══ VEGA AI ANALYSIS ═══ -->
    <div style="background:${DS.card};border:1px solid ${DS.border};border-radius:16px;padding:24px;margin-bottom:24px;">
        ${section('Análisis VEGA AI', '⚡', ac, `
            ${actionTag('ESCALAR', DS.good, '<strong style="color:'+DS.text+'">Audífonos Bluetooth Pro</strong> mantiene ROAS 3.8x por 5 días consecutivos. Incrementar presupuesto 25% para capitalizar la ventana de alto rendimiento.')}
            ${actionTag('OPTIMIZAR', DS.warn, 'Guatemala muestra CPA creciente ($28K → $35K). Revisar segmentación y creativos de las últimas 48h antes de decidir escalar.')}
            ${actionTag('MONITOREAR', DS.blue, 'Tasa de entrega en Ecuador cayó de 68% a 64%. Si continúa 2 días más, evaluar cambio de transportadora en la zona.')}
            ${actionTag('PAUSAR', DS.bad, 'Campaña <strong style="color:'+DS.text+'">"Masajeador Q2"</strong> lleva 3 días con ROAS 0.7x. Pausar inmediatamente y reasignar $120K/día.')}
        `)}
    </div>

    <!-- ═══ FOOTER ═══ -->
    <div style="text-align:center;padding:24px 0;border-top:1px solid ${DS.border};">
        <div style="font-size:12px;font-weight:900;color:${ac};letter-spacing:3px;margin-bottom:4px;">⚡ VEGA AI</div>
        <div style="font-size:10px;color:${DS.muted};">Grand Line v8 · vega@grandline.com.co</div>
        <div style="font-size:9px;color:${DS.muted};margin-top:8px;opacity:0.5;">Reporte generado automáticamente. PDF adjunto con detalle completo.</div>
    </div>
</div></body></html>`;
}

// ── Report definitions ──
const reports = [
    {
        type: 'daily', title: 'El Latido del Negocio', label: 'REPORTE DIARIO', color: '#d75c33', period: '17 Abril 2026',
        summary: 'Jornada con <strong style="color:#F0F0F5">52 órdenes</strong> procesadas y tasa de entrega del <strong style="color:#22C55E">64.8%</strong>. ROAS real cerró en <strong style="color:#F59E0B">2.3x</strong> (meta: 2.0x). CPA despachado de <strong style="color:#F0F0F5">$28,500</strong>, dentro del rango objetivo. Audífonos Bluetooth Pro lidera con margen del 32%.',
        kpis: [
            { label: 'Órdenes', value: '52', sub: '+8 vs ayer', color: DS.blue, icon: '📦' },
            { label: 'Ingreso Real', value: '$3.2M', sub: '34 entregadas', color: DS.good, icon: '💰' },
            { label: 'ROAS Real', value: '2.3x', sub: 'Meta: 2.0x ✓', color: DS.warn, icon: '📈' },
            { label: 'Util. Proy.', value: '$1.8M', sub: '18 en tránsito', color: DS.good, icon: '🎯' },
            { label: '% Entrega', value: '64.8%', sub: '+2.1pp vs ayer', color: DS.good, icon: '🚚' },
        ],
        content: `
            ${section('Top Productos', '🏆', '#22C55E', `
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                    ${tableRow([{text:'Producto'}, {text:'Órd.'}, {text:'Ent.'}, {text:'CPA'}, {text:'Utilidad'}, {text:'Margen'}], true)}
                    ${tableRow([{text:'Audífonos Bluetooth Pro'}, {text:'15'}, {text:'10'}, {text:'$12.9K',color:DS.good}, {text:'$480K',color:DS.good}, {text:'32.1%',color:DS.good}])}
                    ${tableRow([{text:'Sérum Vitamina C'}, {text:'12'}, {text:'8'}, {text:'$15.2K',color:DS.good}, {text:'$320K',color:DS.good}, {text:'28.5%',color:DS.good}])}
                    ${tableRow([{text:'Organizador Cocina XL'}, {text:'9'}, {text:'6'}, {text:'$18.4K',color:DS.warn}, {text:'$185K',color:DS.good}, {text:'25.8%',color:DS.good}])}
                    ${tableRow([{text:'Cable USB-C Premium'}, {text:'8'}, {text:'5'}, {text:'$8.7K',color:DS.good}, {text:'$142K',color:DS.good}, {text:'24.2%',color:DS.good}])}
                </table>
            `)}
            ${section('Cascada P&L del Día', '📊', '#d75c33', waterfall([
                { label: 'Ingreso', value: 3200000, display: '$3.2M', color: DS.good },
                { label: 'COGS', value: -1800000, display: '$1.8M', color: DS.bad },
                { label: 'Flete Ent.', value: -380000, display: '$380K', color: DS.blue },
                { label: 'Flete Dev.', value: -95000, display: '$95K', color: '#f97316' },
                { label: 'Ads', value: -520000, display: '$520K', color: DS.purple },
                { label: 'Utilidad', value: 405000, display: '$405K', color: DS.good },
            ], 3200000))}
        `,
    },
    {
        type: 'logistics', title: 'Bitácora Logística', label: 'BITÁCORA LOGÍSTICA', color: '#3b82f6', period: '17 Abril 2026',
        summary: 'Tasa de entrega del <strong style="color:#22C55E">64.8%</strong> con <strong style="color:#EF4444">18 cancelaciones</strong>. Principal motivo: "No contesta" (38.9%). Servientrega lidera con <strong style="color:#F0F0F5">71.4%</strong> de entrega. <strong style="color:#F59E0B">127 órdenes</strong> en tránsito pendientes de resolución.',
        kpis: [
            { label: '% Entrega', value: '64.8%', sub: '+2.1pp vs ayer', color: DS.good, icon: '✅' },
            { label: 'Cancelaciones', value: '18', sub: '34.6% del total', color: DS.bad, icon: '🚫' },
            { label: 'Devoluciones', value: '3', sub: '5.8% de desp.', color: '#f97316', icon: '↩️' },
            { label: 'En Tránsito', value: '127', sub: '$8.2M en juego', color: DS.warn, icon: '🚚' },
            { label: 'Tiempo Prom.', value: '3.2d', sub: 'Entrega promedio', color: DS.blue, icon: '⏱️' },
        ],
        content: `
            ${section('Motivos de Cancelación', '🚫', DS.bad, `
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                    ${tableRow([{text:'Motivo'}, {text:'Cant.'}, {text:'%'}, {text:'Tendencia'}], true)}
                    ${tableRow([{text:'No contesta / Fuera de cobertura'}, {text:'7',color:DS.bad}, {text:'38.9%',color:DS.bad}, {text:'↑ +2',color:DS.bad}])}
                    ${tableRow([{text:'Cliente cancela'}, {text:'5',color:DS.bad}, {text:'27.8%',color:DS.bad}, {text:'= 0',color:DS.muted}])}
                    ${tableRow([{text:'Dirección incorrecta'}, {text:'3',color:DS.warn}, {text:'16.7%',color:DS.warn}, {text:'↓ -1',color:DS.good}])}
                    ${tableRow([{text:'No desea el producto'}, {text:'3',color:DS.warn}, {text:'16.7%',color:DS.warn}, {text:'↑ +1',color:DS.bad}])}
                </table>
            `)}
            ${section('Rendimiento por Transportadora', '🚚', DS.blue, `
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                    ${tableRow([{text:'Transportadora'}, {text:'Órdenes'}, {text:'Entregadas'}, {text:'% Entrega'}, {text:'Prom. Días'}], true)}
                    ${tableRow([{text:'Servientrega'}, {text:'28'}, {text:'20'}, {text:'71.4%',color:DS.good}, {text:'2.8d',color:DS.good}])}
                    ${tableRow([{text:'Coordinadora'}, {text:'15'}, {text:'9'}, {text:'60.0%',color:DS.warn}, {text:'3.5d',color:DS.warn}])}
                    ${tableRow([{text:'Inter Rapidísimo'}, {text:'9'}, {text:'4'}, {text:'44.4%',color:DS.bad}, {text:'4.1d',color:DS.bad}])}
                </table>
                <div style="margin-top:12px;padding:10px 14px;background:${DS.badBg};border-radius:8px;border:1px solid ${DS.bad}20;">
                    <span style="font-size:11px;color:${DS.bad};font-weight:700;">⚠️ Inter Rapidísimo está por debajo del 50% de entrega. Considerar reasignar volumen.</span>
                </div>
            `)}
            ${section('Órdenes en Tránsito por Antigüedad', '⏱️', DS.warn, `
                <div style="display:flex;gap:8px;flex-wrap:wrap;">
                    <div style="flex:1;min-width:120px;background:${DS.cardAlt};border-radius:10px;padding:14px;text-align:center;border:1px solid ${DS.border};">
                        <div style="font-size:9px;color:${DS.muted};font-weight:800;text-transform:uppercase;letter-spacing:1px;">0-3 DÍAS</div>
                        <div style="font-size:22px;font-weight:900;color:${DS.good};margin-top:4px;">82</div>
                    </div>
                    <div style="flex:1;min-width:120px;background:${DS.cardAlt};border-radius:10px;padding:14px;text-align:center;border:1px solid ${DS.border};">
                        <div style="font-size:9px;color:${DS.muted};font-weight:800;text-transform:uppercase;letter-spacing:1px;">4-7 DÍAS</div>
                        <div style="font-size:22px;font-weight:900;color:${DS.warn};margin-top:4px;">35</div>
                    </div>
                    <div style="flex:1;min-width:120px;background:${DS.cardAlt};border-radius:10px;padding:14px;text-align:center;border:1px solid ${DS.border};">
                        <div style="font-size:9px;color:${DS.muted};font-weight:800;text-transform:uppercase;letter-spacing:1px;">8+ DÍAS</div>
                        <div style="font-size:22px;font-weight:900;color:${DS.bad};margin-top:4px;">10</div>
                    </div>
                </div>
            `)}
        `,
    },
    {
        type: 'financial', title: 'Estado de Resultados', label: 'ESTADO DE RESULTADOS', color: '#10b981', period: '11 — 17 Abril 2026',
        summary: 'Utilidad neta de <strong style="color:#22C55E">$2.8M</strong> con margen del <strong style="color:#22C55E">15.1%</strong>. Ganancia bruta del 44.3% indica estructura de costos saludable. Publicidad representa el 8.1% de ingresos — dentro del rango óptimo.',
        kpis: [
            { label: 'Ingresos', value: '$18.5M', sub: 'Prov. + Drop.', color: DS.good, icon: '💰' },
            { label: 'Gan. Bruta', value: '$8.2M', sub: '44.3% margen', color: DS.blue, icon: '📊' },
            { label: 'Util. Neta', value: '$2.8M', sub: 'Después de todo', color: DS.good, icon: '🎯' },
            { label: 'Margen Neto', value: '15.1%', sub: 'Meta: 15% ✓', color: DS.good, icon: '📈' },
            { label: 'ROAS', value: '2.3x', sub: 'Meta: 2.0x ✓', color: DS.warn, icon: '🔄' },
        ],
        content: `
            ${section('Estado de Resultados', '📊', DS.good, `
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                    <tr style="background:${DS.cardAlt};border-bottom:1px solid ${DS.border};"><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-transform:uppercase;letter-spacing:1.5px;">Concepto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">Monto</td><td style="padding:8px 14px;font-size:9px;font-weight:800;color:${DS.muted};text-align:right;text-transform:uppercase;letter-spacing:1.5px;">% Ing.</td></tr>
                    ${pnlRow('&nbsp;&nbsp;Ing. Proveedor', '$5,400,000', '29.2%', DS.good)}
                    ${pnlRow('&nbsp;&nbsp;Ing. Dropshipping', '$13,100,000', '70.8%', DS.good)}
                    ${pnlRow('INGRESOS TOTALES', '$18,500,000', '100%', DS.good, true, true)}
                    ${pnlRow('(-) Costo Mercancía Proveedor', '$3,300,000', '17.8%', DS.bad)}
                    ${pnlRow('(-) Costo Producto Dropshipping', '$7,000,000', '37.8%', DS.bad)}
                    ${pnlRow('= GANANCIA BRUTA', '$8,200,000', '44.3%', DS.blue, true, true)}
                    ${pnlRow('(-) Fletes (Solo Ventas)', '$2,100,000', '11.4%', '#f97316')}
                    ${pnlRow('(-) Publicidad', '$1,500,000', '8.1%', DS.purple)}
                    ${pnlRow('(-) Gastos Operativos', '$1,200,000', '6.5%', DS.bad)}
                    ${pnlRow('= UTILIDAD OPERACIONAL', '$3,400,000', '18.4%', DS.good, true, true)}
                    ${pnlRow('(-) Gastos Administrativos', '$600,000', '3.2%', DS.bad)}
                    ${pnlRow('= UTILIDAD NETA', '$2,800,000', '15.1%', DS.good, true, true)}
                </table>
            `)}
            ${section('Cascada P&L', '📉', DS.good, waterfall([
                { label: 'Ingresos', value: 18500000, display: '$18.5M', color: DS.good },
                { label: 'COGS', value: -10300000, display: '$10.3M', color: DS.bad },
                { label: '= Gan. Bruta', value: 8200000, display: '$8.2M', color: DS.blue },
                { label: 'Fletes', value: -2100000, display: '$2.1M', color: '#f97316' },
                { label: 'Publicidad', value: -1500000, display: '$1.5M', color: DS.purple },
                { label: 'Gastos Op.', value: -1200000, display: '$1.2M', color: DS.bad },
                { label: 'Gastos Admin.', value: -600000, display: '$600K', color: DS.bad },
                { label: '= Util. Neta', value: 2800000, display: '$2.8M', color: DS.good },
            ], 18500000))}
            ${section('Gastos por Categoría', '💳', DS.bad, `
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                    ${tableRow([{text:'Categoría'}, {text:'Monto'}, {text:'% Total'}], true)}
                    ${tableRow([{text:'Marketing'}, {text:'$1,500,000',color:DS.purple}, {text:'42.3%'}])}
                    ${tableRow([{text:'Nómina'}, {text:'$850,000',color:DS.bad}, {text:'24.0%'}])}
                    ${tableRow([{text:'Aplicaciones'}, {text:'$380,000',color:DS.warn}, {text:'10.7%'}])}
                    ${tableRow([{text:'Servicios'}, {text:'$250,000'}, {text:'7.1%'}])}
                    ${tableRow([{text:'Fullfilment'}, {text:'$180,000'}, {text:'5.1%'}])}
                    ${tableRow([{text:'Gastos Bancarios'}, {text:'$120,000'}, {text:'3.4%'}])}
                    ${tableRow([{text:'Impuestos + Otros'}, {text:'$265,000'}, {text:'7.5%'}])}
                    <tr style="background:${DS.cardAlt};border-top:2px solid ${DS.border};"><td style="padding:10px 14px;font-size:12px;font-weight:900;color:${DS.text};">TOTAL</td><td style="padding:10px 14px;font-size:12px;font-weight:900;color:${DS.good};text-align:right;font-family:${DS.mono};">$3,545,000</td><td style="padding:10px 14px;font-size:10px;color:${DS.muted};text-align:right;">100%</td></tr>
                </table>
            `)}
        `,
    },
    {
        type: 'supplier', title: 'Reporte Proveedor', label: 'REPORTE PROVEEDOR', color: '#8b5cf6', period: '11 — 17 Abril 2026',
        summary: 'Ingreso proveedor de <strong style="color:#22C55E">$5.4M</strong> con margen del <strong style="color:#8B5CF6">38.2%</strong>. Proveedor <strong>NO paga fletes</strong>. Audífonos Bluetooth lidera con 42.1% de margen. <strong style="color:#F59E0B">2 productos</strong> con stock crítico.',
        kpis: [
            { label: 'Ingreso Prov.', value: '$5.4M', sub: '188 unidades', color: DS.good, icon: '📦' },
            { label: 'Costo Merc.', value: '$3.3M', sub: '61.8% del ing.', color: DS.bad, icon: '💸' },
            { label: 'Ganancia', value: '$2.1M', sub: 'Sin fletes', color: DS.good, icon: '💰' },
            { label: 'Margen', value: '38.2%', sub: 'Meta: 35% ✓', color: DS.purple, icon: '📈' },
            { label: 'Stock Alerts', value: '2', sub: 'Productos bajos', color: DS.warn, icon: '⚠️' },
        ],
        content: `
            ${section('Top Productos por Margen', '🏆', DS.purple, `
                <table cellpadding="0" cellspacing="0" border="0" style="width:100%;border-radius:10px;overflow:hidden;border:1px solid ${DS.border};">
                    ${tableRow([{text:'Producto'}, {text:'Uds.'}, {text:'Ingreso'}, {text:'Ganancia'}, {text:'Margen'}], true)}
                    ${tableRow([{text:'Audífonos Bluetooth Pro'}, {text:'85'}, {text:'$2.1M'}, {text:'$890K',color:DS.good}, {text:'42.1%',color:DS.good}])}
                    ${tableRow([{text:'Sérum Vitamina C'}, {text:'62'}, {text:'$1.35M'}, {text:'$520K',color:DS.good}, {text:'38.5%',color:DS.good}])}
                    ${tableRow([{text:'Organizador Cocina XL'}, {text:'41'}, {text:'$880K'}, {text:'$310K',color:DS.good}, {text:'35.2%',color:DS.good}])}
                </table>
            `)}
            ${section('Alertas de Inventario', '⚠️', DS.warn, `
                <div style="padding:14px;background:${DS.badBg};border-left:3px solid ${DS.bad};border-radius:0 10px 10px 0;margin-bottom:8px;">
                    <div style="font-size:12px;color:${DS.bad};font-weight:700;">Cable USB-C 3m — <span style="font-family:${DS.mono};">3 unidades</span> restantes (~1 día)</div>
                    <div style="font-size:10px;color:${DS.muted};margin-top:2px;">Velocidad de venta: 2.8 uds/día</div>
                </div>
                <div style="padding:14px;background:${DS.warnBg};border-left:3px solid ${DS.warn};border-radius:0 10px 10px 0;">
                    <div style="font-size:12px;color:${DS.warn};font-weight:700;">Sérum Vitamina C — <span style="font-family:${DS.mono};">12 unidades</span> restantes (~4 días)</div>
                    <div style="font-size:10px;color:${DS.muted};margin-top:2px;">Velocidad de venta: 2.9 uds/día</div>
                </div>
            `)}
        `,
    },
];

// ── Send ──
console.log(`Enviando ${reports.length} reportes premium a ${TO}...\n`);

for (const r of reports) {
    try {
        const html = buildReport(r);
        await transporter.sendMail({ from: FROM, to: TO, subject: `⚡ VEGA — ${r.title} (${r.period})`, html });
        console.log(`✅ ${r.label} enviado`);
    } catch (err) {
        console.error(`❌ ${r.label}: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1200));
}

console.log('\n🎉 Reportes premium enviados. Revisa tu bandeja.');
