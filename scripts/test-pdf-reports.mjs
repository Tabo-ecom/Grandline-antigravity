/**
 * Test: Generate VEGA PDFs + send via email
 * Usage: node scripts/test-pdf-reports.mjs
 */
import { readFileSync, writeFileSync } from 'fs';
import { createTransport } from 'nodemailer';
import jsPDFModule from 'jspdf';
const { jsPDF } = jsPDFModule;
import autoTable from 'jspdf-autotable';

// Parse .env.local
const envRaw = readFileSync(new URL('../.env.local', import.meta.url), 'utf-8');
const env = {};
for (const line of envRaw.split('\n')) {
    const m = line.match(/^([A-Z_]+)=["']?(.*?)["']?\s*$/);
    if (m) env[m[1]] = m[2];
}

const transporter = createTransport({
    host: env.SMTP_HOST, port: Number(env.SMTP_PORT), secure: true,
    auth: { user: env.SMTP_USER, pass: env.SMTP_PASS },
});
const TO = 'ceo@taboecom.com';
const FROM = env.SMTP_FROM || env.SMTP_USER;

// ── Colors ──
const C = {
    bg: '#0a0f1a', card: '#141b2d', border: '#1e293b',
    text: '#ffffff', muted: '#8892a4',
    good: '#10b981', warn: '#f59e0b', bad: '#ef4444',
    blue: '#3b82f6', purple: '#8b5cf6',
};

const REPORTS = [
    { type: 'daily', title: 'El Latido del Negocio', label: 'REPORTE DIARIO', color: '#d75c33', period: '17 Abril 2026' },
    { type: 'weekly', title: 'La Brújula Táctica', label: 'REPORTE SEMANAL', color: '#d75c33', period: '11-17 Abril 2026' },
    { type: 'logistics', title: 'Bitácora Logística', label: 'BITÁCORA LOGÍSTICA', color: '#3b82f6', period: '17 Abril 2026' },
    { type: 'financial', title: 'Estado de Resultados', label: 'ESTADO DE RESULTADOS', color: '#10b981', period: '11-17 Abril 2026' },
    { type: 'supplier', title: 'Reporte Proveedor', label: 'REPORTE PROVEEDOR', color: '#8b5cf6', period: '11-17 Abril 2026' },
    { type: 'month_close', title: 'Cierre de Mes', label: 'CIERRE DE MES', color: '#f59e0b', period: 'Marzo 2026' },
    { type: 'monthly', title: 'La Visión del Almirante', label: 'REPORTE MENSUAL', color: '#f59e0b', period: '1-17 Abril 2026' },
];

function fmt(n) { return `$${Math.round(n).toLocaleString('es-CO')}`; }
function fmtK(n) { return Math.abs(n) >= 1e6 ? `$${(n/1e6).toFixed(1)}M` : Math.abs(n) >= 1e3 ? `$${(n/1e3).toFixed(0)}K` : `$${n}`; }

function drawBg(doc) { doc.setFillColor(C.bg); doc.rect(0, 0, 210, 297, 'F'); }

function ensureSpace(doc, y, needed) {
    if (y + needed > 277) { doc.addPage(); drawBg(doc); return 15; }
    return y;
}

function sectionHeader(doc, title, y, accent) {
    y = ensureSpace(doc, y, 15);
    doc.setFillColor(accent || C.muted);
    doc.rect(15, y, 3, 8, 'F');
    doc.setFontSize(9); doc.setTextColor(C.text);
    doc.text(title.toUpperCase(), 22, y + 5.5);
    doc.setDrawColor(C.border); doc.setLineWidth(0.3);
    const tw = doc.getTextWidth(title.toUpperCase());
    doc.line(22 + tw + 3, y + 4, 195, y + 4);
    return y + 12;
}

function generatePDF(r) {
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const w = 210, centerX = w / 2;

    // ── Cover Page ──
    drawBg(doc);
    doc.setFillColor(r.color); doc.rect(0, 0, w, 3, 'F');
    doc.setFontSize(10); doc.setTextColor(C.muted); doc.text('GRAND LINE', centerX, 30, { align: 'center' });
    doc.setFontSize(7); doc.setTextColor(r.color); doc.text(r.label, centerX, 45, { align: 'center' });
    doc.setFontSize(22); doc.setTextColor(C.text); doc.text(r.title, centerX, 60, { align: 'center' });
    doc.setFontSize(9); doc.setTextColor(C.muted); doc.text(r.period, centerX, 72, { align: 'center' });

    // Health badge
    doc.setFillColor('#111827'); doc.roundedRect(centerX - 25, 80, 50, 10, 5, 5, 'F');
    doc.setFillColor(C.good); doc.circle(centerX - 18, 85, 1.2, 'F');
    doc.setFontSize(7); doc.setTextColor(C.good); doc.text('MUY BUENO — 78/100', centerX, 86.5, { align: 'center' });

    // Executive Summary
    doc.setFontSize(8); doc.setTextColor(C.muted);
    const summaryText = `Operación estable con métricas dentro de rangos objetivo. El negocio mantiene un ROAS real de 2.3x y margen neto del 16.8%, lo cual indica eficiencia en la estructura de costos y gestión publicitaria.`;
    doc.text(summaryText, 20, 105, { maxWidth: 170 });

    // ── Page 2: KPI Dashboard ──
    doc.addPage(); drawBg(doc);
    let y = sectionHeader(doc, 'Dashboard de KPIs', 15, r.color);

    const kpis = [
        { label: 'ÓRDENES', value: '342', sub: '+12% vs sem. ant.', color: C.blue },
        { label: 'INGRESO REAL', value: '$18.5M', sub: '248 entregadas', color: C.good },
        { label: 'UTILIDAD REAL', value: '$5.2M', sub: 'Margen 28.1%', color: C.good },
        { label: 'ROAS REAL', value: '2.3x', sub: 'Meta: 2.0x', color: C.warn },
        { label: 'TASA ENTREGA', value: '64.8%', sub: '221 de 342', color: C.good },
    ];
    const cardW = 34, cardH = 28, gap = 2.5, startX = 15;
    kpis.forEach((k, i) => {
        const cx = startX + i * (cardW + gap);
        doc.setFillColor(C.card); doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'F');
        doc.setDrawColor(C.border); doc.setLineWidth(0.2); doc.roundedRect(cx, y, cardW, cardH, 2, 2, 'S');
        doc.setFontSize(5.5); doc.setTextColor(C.muted); doc.text(k.label, cx + cardW/2, y + 7, { align: 'center' });
        doc.setFontSize(12); doc.setTextColor(k.color); doc.text(k.value, cx + cardW/2, y + 17, { align: 'center' });
        doc.setFontSize(5); doc.setTextColor(C.muted); doc.text(k.sub, cx + cardW/2, y + 23, { align: 'center' });
    });
    y += cardH + 10;

    // ── P&L Cascade ──
    y = sectionHeader(doc, 'Estado de Resultados', y, r.color);
    const pnlRows = [
        ['  Ing. Proveedor', '$5.4M', '29.2%', C.good],
        ['  Ing. Dropshipping', '$13.1M', '70.8%', C.good],
        ['INGRESOS TOTALES', '$18.5M', '100%', C.good],
        ['(-) Costos Producto', '$10.3M', '55.7%', C.bad],
        ['= GANANCIA BRUTA', '$8.2M', '44.3%', C.blue],
        ['(-) Fletes (Ventas)', '$2.1M', '11.4%', '#f97316'],
        ['(-) Publicidad', '$1.5M', '8.1%', C.purple],
        ['(-) Gastos Operativos', '$1.2M', '6.5%', C.bad],
        ['(-) Gastos Admin.', '$600K', '3.2%', C.bad],
        ['= UTILIDAD NETA', '$2.8M', '15.1%', C.good],
    ];
    autoTable(doc, {
        startY: y,
        head: [['Concepto', 'Monto', '% Ing.']],
        body: pnlRows.map(r => [r[0], r[1], r[2]]),
        theme: 'grid',
        styles: { fillColor: C.card, textColor: C.text, lineColor: C.border, lineWidth: 0.2, fontSize: 8, cellPadding: 3 },
        headStyles: { fillColor: '#1a2332', textColor: C.muted, fontSize: 7, fontStyle: 'bold' },
        columnStyles: { 0: { cellWidth: 90 }, 1: { halign: 'right', cellWidth: 40 }, 2: { halign: 'right', cellWidth: 30 } },
        didParseCell: function(data) {
            if (data.section === 'body') {
                const row = pnlRows[data.row.index];
                if (row && data.column.index === 1) data.cell.styles.textColor = row[3];
                if (row && (row[0].startsWith('=') || row[0] === 'INGRESOS TOTALES')) {
                    data.cell.styles.fontStyle = 'bold';
                    data.cell.styles.fillColor = '#1a2332';
                }
            }
        },
        margin: { left: 15, right: 15 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── Country Breakdown ──
    y = sectionHeader(doc, 'Desglose por País', y, r.color);
    autoTable(doc, {
        startY: y,
        head: [['País', 'Órdenes', 'Entregadas', '% Entrega', 'Ads', 'Utilidad', 'Margen']],
        body: [
            ['Colombia', '245', '162', '66.1%', '$1.1M', '$3.8M', '17.5%'],
            ['Guatemala', '72', '43', '59.7%', '$320K', '$980K', '18.3%'],
            ['Ecuador', '25', '16', '64.0%', '$80K', '$280K', '10.0%'],
        ],
        theme: 'grid',
        styles: { fillColor: C.card, textColor: C.text, lineColor: C.border, lineWidth: 0.2, fontSize: 7.5, cellPadding: 2.5 },
        headStyles: { fillColor: '#1a2332', textColor: C.muted, fontSize: 6.5, fontStyle: 'bold' },
        margin: { left: 15, right: 15 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── Top Products ──
    y = sectionHeader(doc, 'Top Productos por Margen', y, r.color);
    autoTable(doc, {
        startY: y,
        head: [['Producto', 'Órdenes', 'Entregadas', 'CPA', 'Utilidad', 'Margen']],
        body: [
            ['Audífonos Bluetooth Pro', '85', '58', '$12,900', '$480K', '32.1%'],
            ['Sérum Vitamina C', '62', '41', '$15,200', '$320K', '28.5%'],
            ['Organizador Cocina XL', '45', '31', '$18,400', '$185K', '25.8%'],
            ['Cable USB-C Premium 3m', '38', '25', '$8,700', '$142K', '24.2%'],
            ['Masajeador Cervical', '32', '20', '$22,100', '$95K', '18.6%'],
        ],
        theme: 'grid',
        styles: { fillColor: C.card, textColor: C.text, lineColor: C.border, lineWidth: 0.2, fontSize: 7, cellPadding: 2 },
        headStyles: { fillColor: '#1a2332', textColor: C.muted, fontSize: 6.5, fontStyle: 'bold' },
        margin: { left: 15, right: 15 },
    });
    y = doc.lastAutoTable.finalY + 8;

    // ── Logistics (for logistics/month_close) ──
    if (r.type === 'logistics' || r.type === 'month_close') {
        y = ensureSpace(doc, y, 60);
        y = sectionHeader(doc, 'Motivos de Cancelación', y, r.color);
        autoTable(doc, {
            startY: y,
            head: [['Motivo', 'Cantidad', '%']],
            body: [
                ['No contesta / Fuera de cobertura', '7', '38.9%'],
                ['Cliente cancela', '5', '27.8%'],
                ['Dirección incorrecta', '3', '16.7%'],
                ['No desea el producto', '3', '16.7%'],
            ],
            theme: 'grid',
            styles: { fillColor: C.card, textColor: C.text, lineColor: C.border, lineWidth: 0.2, fontSize: 7.5, cellPadding: 2.5 },
            headStyles: { fillColor: '#1a2332', textColor: C.muted, fontSize: 6.5 },
            margin: { left: 15, right: 15 },
        });
        y = doc.lastAutoTable.finalY + 8;

        y = sectionHeader(doc, 'Desglose por Transportadora', y, r.color);
        autoTable(doc, {
            startY: y,
            head: [['Transportadora', 'Órdenes', 'Entregadas', '% Entrega']],
            body: [
                ['Servientrega', '28', '20', '71.4%'],
                ['Coordinadora', '15', '9', '60.0%'],
                ['Inter Rapidísimo', '9', '4', '44.4%'],
            ],
            theme: 'grid',
            styles: { fillColor: C.card, textColor: C.text, lineColor: C.border, lineWidth: 0.2, fontSize: 7.5, cellPadding: 2.5 },
            headStyles: { fillColor: '#1a2332', textColor: C.muted, fontSize: 6.5 },
            margin: { left: 15, right: 15 },
        });
        y = doc.lastAutoTable.finalY + 8;
    }

    // ── Supplier (for supplier/month_close) ──
    if (r.type === 'supplier' || r.type === 'month_close') {
        y = ensureSpace(doc, y, 50);
        y = sectionHeader(doc, 'Proveedor — Sin Fletes', y, r.color);
        autoTable(doc, {
            startY: y,
            head: [['Métrica', 'Valor']],
            body: [
                ['Ingreso Proveedor', '$5.4M'],
                ['Costo Mercancía', '$3.3M'],
                ['Ganancia Proveedor', '$2.1M'],
                ['Margen', '38.2%'],
            ],
            theme: 'grid',
            styles: { fillColor: C.card, textColor: C.text, lineColor: C.border, lineWidth: 0.2, fontSize: 8, cellPadding: 3 },
            headStyles: { fillColor: '#1a2332', textColor: C.muted, fontSize: 7 },
            columnStyles: { 1: { halign: 'right' } },
            margin: { left: 15, right: 15 },
        });
        y = doc.lastAutoTable.finalY + 8;
    }

    // ── Berry Expenses ──
    if (r.type === 'financial' || r.type === 'month_close') {
        y = ensureSpace(doc, y, 60);
        y = sectionHeader(doc, 'Gastos por Categoría', y, r.color);
        autoTable(doc, {
            startY: y,
            head: [['Categoría', 'Monto', '% del Total']],
            body: [
                ['Marketing', '$1,500,000', '42.3%'],
                ['Nómina', '$850,000', '24.0%'],
                ['Aplicaciones', '$380,000', '10.7%'],
                ['Servicios', '$250,000', '7.1%'],
                ['Fullfilment', '$180,000', '5.1%'],
                ['Gastos Bancarios', '$120,000', '3.4%'],
                ['Impuestos', '$95,000', '2.7%'],
                ['Otros', '$170,000', '4.8%'],
            ],
            theme: 'grid',
            styles: { fillColor: C.card, textColor: C.text, lineColor: C.border, lineWidth: 0.2, fontSize: 7.5, cellPadding: 2.5 },
            headStyles: { fillColor: '#1a2332', textColor: C.muted, fontSize: 6.5 },
            columnStyles: { 1: { halign: 'right' }, 2: { halign: 'right' } },
            foot: [['TOTAL', '$3,545,000', '100%']],
            footStyles: { fillColor: '#1a2332', textColor: r.color, fontStyle: 'bold' },
            margin: { left: 15, right: 15 },
        });
        y = doc.lastAutoTable.finalY + 8;
    }

    // ── VEGA AI Analysis ──
    y = ensureSpace(doc, y, 40);
    y = sectionHeader(doc, 'Análisis VEGA AI', y, r.color);

    const analysis = [
        { tag: 'ESCALAR', color: C.good, text: 'Audífonos Bluetooth Pro mantiene ROAS 3.8x por 5 días consecutivos. Incrementar presupuesto 25% para maximizar ventana de rendimiento.' },
        { tag: 'OPTIMIZAR', color: C.warn, text: 'Guatemala muestra CPA creciente ($28K → $35K esta semana). Revisar segmentación y creativos antes de escalar.' },
        { tag: 'MONITOREAR', color: C.blue, text: 'Tasa de entrega en Ecuador cayó de 68% a 64%. Si continúa, evaluar cambio de transportadora.' },
        { tag: 'PAUSAR', color: C.bad, text: 'Campaña "Masajeador Q2" tiene ROAS 0.7x por 3 días. Pausar y reasignar $120K/día a campañas rentables.' },
    ];

    for (const a of analysis) {
        y = ensureSpace(doc, y, 18);
        doc.setFillColor(a.color + '15'); doc.roundedRect(15, y, 180, 14, 2, 2, 'F');
        doc.setFillColor(a.color); doc.rect(15, y, 2, 14, 'F');
        doc.setFontSize(6); doc.setTextColor(a.color); doc.text(`[${a.tag}]`, 20, y + 4.5);
        doc.setFontSize(7); doc.setTextColor(C.text);
        doc.text(a.text, 20, y + 9.5, { maxWidth: 170 });
        y += 17;
    }

    // ── Footer ──
    const pages = doc.getNumberOfPages();
    for (let i = 1; i <= pages; i++) {
        doc.setPage(i);
        doc.setFontSize(6); doc.setTextColor(C.muted);
        doc.text(`VEGA AI · Grand Line v8 · ${r.period}`, centerX, 290, { align: 'center' });
        doc.text(`${i} / ${pages}`, 195, 290, { align: 'right' });
    }

    return Buffer.from(doc.output('arraybuffer'));
}

// ── Email HTML (summary only) ──
function buildSummaryEmail(r) {
    const ac = r.color;
    return `<!DOCTYPE html><html><head><meta charset="utf-8"></head>
<body style="margin:0;padding:0;background:#0A0A0F;font-family:Arial,sans-serif;">
<div style="max-width:600px;margin:0 auto;padding:24px;">
    <div style="background:linear-gradient(135deg,${ac}22,#141821);border:1px solid ${ac}33;border-radius:16px;padding:24px;text-align:center;margin-bottom:20px;">
        <div style="display:inline-block;background:${ac}20;border:1px solid ${ac}44;border-radius:6px;padding:3px 12px;margin-bottom:8px;">
            <span style="color:${ac};font-size:9px;font-weight:900;letter-spacing:2px;">${r.label}</span>
        </div>
        <h1 style="color:#fff;font-size:20px;margin:6px 0 2px;font-weight:900;">${r.title}</h1>
        <p style="color:#666;font-size:12px;margin:0;">${r.period}</p>
    </div>
    <div style="background:#141821;border:1px solid #1e2330;border-left:3px solid ${ac};border-radius:10px;padding:16px;margin-bottom:16px;">
        <p style="color:#ccc;font-size:13px;line-height:1.6;margin:0;">
            Operación estable. Revisa el <strong style="color:#fff;">PDF adjunto</strong> para el reporte completo con tablas detalladas, desglose por país/producto, y análisis de VEGA AI.
        </p>
    </div>
    <div style="text-align:center;padding:16px 0;border-top:1px solid #1e2330;">
        <p style="color:${ac};font-size:10px;font-weight:900;letter-spacing:2px;margin:0 0 4px;">⚡ VEGA AI</p>
        <p style="color:#444;font-size:9px;margin:0;">Grand Line v8 · vega@grandline.com.co · PDF adjunto</p>
    </div>
</div></body></html>`;
}

// ── Send all ──
console.log(`Generando PDFs y enviando ${REPORTS.length} reportes a ${TO}...\n`);

for (const r of REPORTS) {
    try {
        const pdfBuffer = generatePDF(r);
        const html = buildSummaryEmail(r);
        const safePeriod = r.period.replace(/[^a-zA-Z0-9\-]/g, '_');

        await transporter.sendMail({
            from: FROM,
            to: TO,
            subject: `⚡ VEGA — ${r.title} (${r.period})`,
            html,
            attachments: [{
                filename: `VEGA_${r.type}_${safePeriod}.pdf`,
                content: pdfBuffer,
                contentType: 'application/pdf',
            }],
        });
        console.log(`✅ ${r.label} → PDF (${(pdfBuffer.length / 1024).toFixed(0)}KB) enviado`);
    } catch (err) {
        console.error(`❌ ${r.label}: ${err.message}`);
    }
    await new Promise(resolve => setTimeout(resolve, 1500));
}

console.log('\n🎉 Todos los reportes con PDF adjunto enviados.');
