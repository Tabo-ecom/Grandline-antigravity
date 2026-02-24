import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { PDFReportData, PDFAlert } from './types';
import { PDF_COLORS } from './types';
import { evaluateHealth, findTarget } from '@/lib/utils/health';
import type { HealthStatus } from '@/lib/utils/health';
import { renderMarkdownToPDF } from './markdown-renderer';

function statusColor(status: HealthStatus): string {
    return status === 'good' ? PDF_COLORS.good : status === 'warning' ? PDF_COLORS.warning : PDF_COLORS.bad;
}

function formatCurrency(value: number): string {
    return `$${Math.round(value).toLocaleString('es-CO')}`;
}

function drawPageBackground(doc: jsPDF) {
    doc.setFillColor(PDF_COLORS.background);
    doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number) {
    doc.setFillColor(PDF_COLORS.cardBg);
    doc.roundedRect(x, y, w, h, 3, 3, 'F');
    doc.setDrawColor(PDF_COLORS.cardBorder);
    doc.setLineWidth(0.3);
    doc.roundedRect(x, y, w, h, 3, 3, 'S');
}

function drawCoverPage(doc: jsPDF, data: PDFReportData) {
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();
    const centerX = w / 2;

    // Accent line at top
    doc.setFillColor(PDF_COLORS.accent);
    doc.rect(0, 0, w, 4, 'F');

    // Brand
    doc.setFontSize(10);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('GRAND LINE', centerX, 30, { align: 'center' });

    doc.setFontSize(8);
    doc.text('INTELLIGENCE REPORT', centerX, 37, { align: 'center' });

    // Title
    doc.setFontSize(24);
    doc.setTextColor(PDF_COLORS.text);
    doc.text(data.title, centerX, 60, { align: 'center' });

    // Period
    doc.setFontSize(11);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text(data.period, centerX, 72, { align: 'center' });

    // Date
    doc.setFontSize(8);
    doc.text(
        `Generado: ${new Date(data.generatedAt).toLocaleString('es-CO')}`,
        centerX,
        80,
        { align: 'center' }
    );

    // Executive Summary (if available)
    if (data.executiveSummary) {
        const summaryY = 92;
        drawCard(doc, 15, summaryY, w - 30, 22);
        doc.setFontSize(6);
        doc.setTextColor(PDF_COLORS.purple);
        doc.text('RESUMEN EJECUTIVO', 20, summaryY + 7);
        doc.setFontSize(9);
        doc.setTextColor(PDF_COLORS.text);
        const summaryLines = doc.splitTextToSize(data.executiveSummary, w - 40);
        doc.text(summaryLines.slice(0, 2), 20, summaryY + 14);
    }

    // Hero KPI cards (4 cards in a row) — larger
    const heroStartY = data.executiveSummary ? 120 : 95;
    if (data.kpis) {
        const kpis = data.kpis;
        const cardW = 42;
        const gap = 5;
        const totalW = cardW * 4 + gap * 3;
        const startX = (w - totalW) / 2;
        const cardH = 44;

        const heroKpis = [
            { label: 'ROAS REAL', value: `${kpis.roas_real.toFixed(2)}x`, key: 'roas_real', raw: kpis.roas_real },
            { label: 'TASA ENTREGA', value: `${kpis.tasa_ent.toFixed(1)}%`, key: 'tasa_ent', raw: kpis.tasa_ent },
            { label: '% ADS/REVENUE', value: `${kpis.perc_ads_revenue.toFixed(1)}%`, key: 'perc_ads_revenue', raw: kpis.perc_ads_revenue },
            { label: 'UTILIDAD REAL', value: formatCurrency(kpis.u_real), key: 'u_real', raw: kpis.u_real },
        ];

        heroKpis.forEach((kpi, i) => {
            const x = startX + i * (cardW + gap);

            // Health-colored border
            let color: string = PDF_COLORS.text;
            if (kpi.key === 'u_real') {
                color = kpi.raw >= 0 ? PDF_COLORS.good : PDF_COLORS.bad;
            } else {
                const target = findTarget(data.kpiTargets, kpi.key);
                if (target) {
                    color = statusColor(evaluateHealth(kpi.raw, target));
                }
            }

            drawCard(doc, x, heroStartY, cardW, cardH);
            // Colored top accent on each card
            doc.setFillColor(color);
            doc.rect(x + 1, heroStartY, cardW - 2, 2, 'F');

            // Label
            doc.setFontSize(6);
            doc.setTextColor(PDF_COLORS.textMuted);
            doc.text(kpi.label, x + cardW / 2, heroStartY + 14, { align: 'center' });

            // Value — bigger font
            doc.setFontSize(18);
            doc.setTextColor(color);
            doc.text(kpi.value, x + cardW / 2, heroStartY + 30, { align: 'center' });
        });
    }

    // Powered by
    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('Powered by VEGA AI', centerX, heroStartY + 60, { align: 'center' });
}

function drawAlertsPage(doc: jsPDF, data: PDFReportData) {
    if (!data.alerts || data.alerts.length === 0) return;

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    doc.setFillColor(PDF_COLORS.accent);
    doc.rect(0, 0, w, 3, 'F');

    doc.setFontSize(14);
    doc.setTextColor(PDF_COLORS.text);
    doc.text('Alertas y Acciones', 15, 20);

    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('Situaciones que requieren atencion inmediata', 15, 27);

    let y = 38;
    const alertColors: Record<string, { bg: string; accent: string; label: string }> = {
        CRITICA: { bg: '#1c1215', accent: PDF_COLORS.bad, label: 'CRITICA' },
        ATENCION: { bg: '#1c1812', accent: PDF_COLORS.warning, label: 'ATENCION' },
        INFO: { bg: '#121825', accent: PDF_COLORS.blue, label: 'INFO' },
    };

    data.alerts.forEach(alert => {
        const config = alertColors[alert.level] || alertColors.INFO;
        const alertH = 18;

        if (y + alertH > doc.internal.pageSize.getHeight() - 20) {
            doc.addPage();
            drawPageBackground(doc);
            y = 15;
        }

        // Alert card background
        doc.setFillColor(config.bg);
        doc.roundedRect(15, y, w - 30, alertH, 2, 2, 'F');

        // Left accent bar
        doc.setFillColor(config.accent);
        doc.rect(15, y, 3, alertH, 'F');

        // Level label
        doc.setFontSize(6);
        doc.setTextColor(config.accent);
        doc.text(config.label, 23, y + 6);

        // Message
        doc.setFontSize(8);
        doc.setTextColor(PDF_COLORS.text);
        const messageLines = doc.splitTextToSize(alert.message, w - 50);
        doc.text(messageLines.slice(0, 2), 23, y + 12);

        y += alertH + 4;
    });
}

function drawKPIDashboard(doc: jsPDF, data: PDFReportData) {
    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    // Section header
    doc.setFillColor(PDF_COLORS.accent);
    doc.rect(0, 0, w, 3, 'F');

    doc.setFontSize(14);
    doc.setTextColor(PDF_COLORS.text);
    doc.text('Dashboard de KPIs', 15, 20);

    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text(data.period, 15, 27);

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
    ];

    // Grid layout: 3 columns
    const cols = 3;
    const cardW = 55;
    const cardH = 22;
    const gapX = 7;
    const gapY = 5;
    const totalW = cardW * cols + gapX * (cols - 1);
    const startX = (w - totalW) / 2;
    let startY = 35;

    metrics.forEach((m, i) => {
        const col = i % cols;
        const row = Math.floor(i / cols);
        const x = startX + col * (cardW + gapX);
        const y = startY + row * (cardH + gapY);

        drawCard(doc, x, y, cardW, cardH);

        // Label
        doc.setFontSize(6);
        doc.setTextColor(PDF_COLORS.textMuted);
        doc.text(m.label.toUpperCase(), x + 5, y + 8);

        // Value
        let color: string = PDF_COLORS.text;
        if (m.key && m.key !== 'u_real') {
            const target = findTarget(data.kpiTargets, m.key);
            if (target && 'raw' in m) {
                color = statusColor(evaluateHealth(m.raw as number, target));
            }
        } else if (m.key === 'u_real' && 'raw' in m) {
            color = (m.raw as number) >= 0 ? PDF_COLORS.good : PDF_COLORS.bad;
        }

        doc.setFontSize(12);
        doc.setTextColor(color);
        doc.text(m.value, x + 5, y + 17);
    });
}

function drawCountryBreakdown(doc: jsPDF, data: PDFReportData) {
    if (!data.metricsByCountry || data.metricsByCountry.length === 0) return;

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    doc.setFillColor(PDF_COLORS.accent);
    doc.rect(0, 0, w, 3, 'F');

    doc.setFontSize(14);
    doc.setTextColor(PDF_COLORS.text);
    doc.text('Desglose por Pais', 15, 20);

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
        startY: 30,
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
            // Color delivery rate column
            if (hookData.section === 'body' && hookData.column.index === 2) {
                const val = parseFloat(hookData.cell.raw as string);
                const target = findTarget(data.kpiTargets, 'tasa_ent');
                if (target) {
                    hookData.cell.styles.textColor = statusColor(evaluateHealth(val, target));
                }
            }
            // Color cancel rate column
            if (hookData.section === 'body' && hookData.column.index === 3) {
                const val = parseFloat(hookData.cell.raw as string);
                const target = findTarget(data.kpiTargets, 'tasa_can');
                if (target) {
                    hookData.cell.styles.textColor = statusColor(evaluateHealth(val, target));
                }
            }
            // Color profit column
            if (hookData.section === 'body' && hookData.column.index === 6) {
                const val = parseInt((hookData.cell.raw as string).replace(/[$.,]/g, ''));
                hookData.cell.styles.textColor = val >= 0 ? PDF_COLORS.good : PDF_COLORS.bad;
            }
        },
    });

    // Logistic summary
    if (data.logisticStats) {
        const ls = data.logisticStats;
        const total = ls.entregados + ls.transito + ls.cancelados + ls.devoluciones;
        const finalY = (doc as any).lastAutoTable?.finalY || 100;

        doc.setFontSize(12);
        doc.setTextColor(PDF_COLORS.text);
        doc.text('Resumen Logistico', 15, finalY + 20);

        const logData = [
            ['Entregados', ls.entregados.toString(), total > 0 ? `${((ls.entregados / total) * 100).toFixed(1)}%` : '0%'],
            ['En Transito', ls.transito.toString(), total > 0 ? `${((ls.transito / total) * 100).toFixed(1)}%` : '0%'],
            ['Cancelados', ls.cancelados.toString(), total > 0 ? `${((ls.cancelados / total) * 100).toFixed(1)}%` : '0%'],
            ['Devoluciones', ls.devoluciones.toString(), total > 0 ? `${((ls.devoluciones / total) * 100).toFixed(1)}%` : '0%'],
        ];

        autoTable(doc, {
            startY: finalY + 25,
            head: [['Estado', 'Cantidad', '% del Total']],
            body: logData,
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
            columnStyles: {
                0: { cellWidth: 40 },
            },
        });
    }
}

function drawFinancialPL(doc: jsPDF, data: PDFReportData) {
    if (!data.kpis) return;

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();
    const kpis = data.kpis;

    doc.setFillColor(PDF_COLORS.accent);
    doc.rect(0, 0, w, 3, 'F');

    doc.setFontSize(14);
    doc.setTextColor(PDF_COLORS.text);
    doc.text('Estado de Resultados (P&L)', 15, 20);

    const rows = [
        ['INGRESOS', '', ''],
        ['Facturacion Neta', formatCurrency(kpis.fact_neto), ''],
        ['Ingreso Real (Entregados)', formatCurrency(kpis.ing_real), '100%'],
        ['', '', ''],
        ['COSTOS VARIABLES', '', ''],
        ['(-) Costo de Producto', formatCurrency(kpis.cpr), kpis.ing_real > 0 ? `${((kpis.cpr / kpis.ing_real) * 100).toFixed(1)}%` : '0%'],
        ['(-) Fletes Entrega', formatCurrency(kpis.fl_ent), kpis.ing_real > 0 ? `${((kpis.fl_ent / kpis.ing_real) * 100).toFixed(1)}%` : '0%'],
        ['(-) Fletes Devolucion', formatCurrency(kpis.fl_dev), kpis.ing_real > 0 ? `${((kpis.fl_dev / kpis.ing_real) * 100).toFixed(1)}%` : '0%'],
        ['(-) Fletes Transito', formatCurrency(kpis.fl_tra), kpis.ing_real > 0 ? `${((kpis.fl_tra / kpis.ing_real) * 100).toFixed(1)}%` : '0%'],
        ['(-) Gasto Publicitario', formatCurrency(kpis.g_ads), kpis.ing_real > 0 ? `${((kpis.g_ads / kpis.ing_real) * 100).toFixed(1)}%` : '0%'],
        ['', '', ''],
        ['RESULTADO', '', ''],
        ['= Utilidad Real', formatCurrency(kpis.u_real), kpis.ing_real > 0 ? `${((kpis.u_real / kpis.ing_real) * 100).toFixed(1)}%` : '0%'],
    ];

    autoTable(doc, {
        startY: 30,
        body: rows,
        theme: 'plain',
        styles: {
            fillColor: PDF_COLORS.cardBg,
            textColor: PDF_COLORS.text,
            fontSize: 9,
            cellPadding: 4,
            lineColor: PDF_COLORS.cardBorder,
            lineWidth: 0.2,
        },
        columnStyles: {
            0: { cellWidth: 80 },
            1: { halign: 'right', cellWidth: 50 },
            2: { halign: 'right', cellWidth: 30, textColor: PDF_COLORS.textMuted, fontSize: 7 },
        },
        didParseCell: (hookData) => {
            const text = hookData.cell.raw as string;
            // Section headers
            if (['INGRESOS', 'COSTOS VARIABLES', 'RESULTADO'].includes(text)) {
                hookData.cell.styles.textColor = PDF_COLORS.accent;
                hookData.cell.styles.fontStyle = 'bold';
                hookData.cell.styles.fontSize = 8;
            }
            // Utilidad row
            if (text === '= Utilidad Real') {
                hookData.cell.styles.fontStyle = 'bold';
                hookData.cell.styles.fontSize = 11;
            }
            // Utilidad value coloring
            if (hookData.row.index === rows.length - 1 && hookData.column.index === 1) {
                hookData.cell.styles.textColor = kpis.u_real >= 0 ? PDF_COLORS.good : PDF_COLORS.bad;
                hookData.cell.styles.fontStyle = 'bold';
                hookData.cell.styles.fontSize = 11;
            }
            // Empty separator rows
            if (text === '' && hookData.column.index === 0 && hookData.row.cells[1]?.raw === '') {
                hookData.cell.styles.minCellHeight = 4;
            }
        },
    });
}

function drawVegaAnalysis(doc: jsPDF, data: PDFReportData) {
    if (!data.vegaAnalysis) return;

    doc.addPage();
    drawPageBackground(doc);
    const w = doc.internal.pageSize.getWidth();

    doc.setFillColor(PDF_COLORS.accent);
    doc.rect(0, 0, w, 3, 'F');

    doc.setFontSize(14);
    doc.setTextColor(PDF_COLORS.text);
    doc.text('Analisis VEGA AI', 15, 20);

    doc.setFontSize(7);
    doc.setTextColor(PDF_COLORS.textMuted);
    doc.text('Generado por inteligencia artificial', 15, 27);

    renderMarkdownToPDF(doc, data.vegaAnalysis, 35, {
        maxWidth: w - 30,
        startX: 15,
        pageHeight: doc.internal.pageSize.getHeight(),
        onNewPage: () => {
            drawPageBackground(doc);
            doc.setFillColor(PDF_COLORS.cardBorder);
            doc.rect(0, 0, w, 1, 'F');
        },
    });
}

function drawFooter(doc: jsPDF) {
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        const w = doc.internal.pageSize.getWidth();
        const h = doc.internal.pageSize.getHeight();

        doc.setFontSize(6);
        doc.setTextColor(PDF_COLORS.textMuted);
        doc.text(`Grand Line Intelligence — Pagina ${i} de ${pageCount}`, w / 2, h - 8, { align: 'center' });
    }
}

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

export function generatePDFReport(data: PDFReportData): jsPDF {
    const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

    // Auto-extract alerts and summary from AI content if not provided explicitly
    if (!data.alerts && data.vegaAnalysis) {
        data.alerts = parseAlertsFromContent(data.vegaAnalysis);
    }
    if (!data.executiveSummary && data.vegaAnalysis) {
        data.executiveSummary = parseExecutiveSummary(data.vegaAnalysis);
    }

    drawCoverPage(doc, data);
    drawAlertsPage(doc, data);
    drawKPIDashboard(doc, data);
    drawCountryBreakdown(doc, data);
    drawFinancialPL(doc, data);
    drawVegaAnalysis(doc, data);
    drawFooter(doc);

    return doc;
}

export function downloadPDFReport(data: PDFReportData) {
    const doc = generatePDFReport(data);
    const filename = `Grand_Line_${data.title.replace(/\s+/g, '_')}_${new Date().toISOString().slice(0, 10)}.pdf`;
    doc.save(filename);
}
