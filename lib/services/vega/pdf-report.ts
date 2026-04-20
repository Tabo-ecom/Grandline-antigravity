import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import type { VegaReport, VegaReportMetadata } from '@/lib/types/vega';
import { REPORT_COLOR_MAP, REPORT_TITLE_MAP, REPORT_LABEL_MAP } from '@/lib/types/vega';

const C = {
  bg: '#0a0f1a', cardBg: '#141b2d', border: '#1e293b', accent: '#d75c33',
  text: '#ffffff', muted: '#8892a4', good: '#10b981', warn: '#f59e0b',
  bad: '#ef4444', blue: '#3b82f6', purple: '#8b5cf6',
} as const;

const HEALTH_COLORS: Record<string, string> = {
  EXCELENTE: C.good, 'MUY BUENO': C.blue, BUENO: C.blue, ALERTA: C.warn, CRITICO: C.bad,
};

const ACTION_COLORS: Record<string, string> = {
  ESCALAR: C.good, PAUSAR: C.bad, OPTIMIZAR: C.warn, MONITOREAR: C.blue,
};

// --- Helpers ---

function fmt(n: number): string {
  if (Math.abs(n) >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (Math.abs(n) >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function fmtCur(n: number): string {
  return `$${Math.round(n).toLocaleString('es-CO')}`;
}

function pct(n: number): string { return `${n.toFixed(1)}%`; }

function drawBg(doc: jsPDF) {
  doc.setFillColor(C.bg);
  doc.rect(0, 0, doc.internal.pageSize.getWidth(), doc.internal.pageSize.getHeight(), 'F');
}

function ensureSpace(doc: jsPDF, y: number, needed: number): number {
  if (y + needed > doc.internal.pageSize.getHeight() - 20) {
    doc.addPage();
    drawBg(doc);
    return 15;
  }
  return y;
}

function sectionHeader(doc: jsPDF, title: string, y: number, accent: string): number {
  y = ensureSpace(doc, y, 18);
  const w = doc.internal.pageSize.getWidth();
  doc.setFillColor(accent);
  doc.rect(15, y, 4, 8, 'F');
  doc.setFontSize(9);
  doc.setTextColor(C.text);
  doc.text(title.toUpperCase(), 23, y + 5.5);
  const tw = doc.getTextWidth(title.toUpperCase());
  doc.setDrawColor(C.border);
  doc.setLineWidth(0.3);
  doc.line(23 + tw + 4, y + 4, w - 15, y + 4);
  return y + 12;
}

function drawCard(doc: jsPDF, x: number, y: number, w: number, h: number) {
  doc.setFillColor(C.cardBg);
  doc.roundedRect(x, y, w, h, 3, 3, 'F');
  doc.setDrawColor(C.border);
  doc.setLineWidth(0.3);
  doc.roundedRect(x, y, w, h, 3, 3, 'S');
}

function darkAutoTable(doc: jsPDF, startY: number, head: string[][], body: string[][], opts?: object) {
  autoTable(doc, {
    startY,
    head,
    body,
    theme: 'grid' as const,
    styles: { fillColor: C.cardBg, textColor: C.text, lineColor: C.border, fontSize: 7, cellPadding: 3 },
    headStyles: { fillColor: '#1a2332', textColor: C.muted, fontStyle: 'bold', fontSize: 6.5 },
    alternateRowStyles: { fillColor: '#111827' },
    margin: { left: 15, right: 15 },
    ...opts,
  });
  return (doc as any).lastAutoTable?.finalY || startY + 20;
}

function cleanText(t: string): string {
  return t.replace(/\*\*(.*?)\*\*/g, '$1').replace(/\*(.*?)\*/g, '$1')
    .replace(/`(.*?)`/g, '$1').replace(/[\u{1F300}-\u{1F9FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu, '')
    .replace(/\s+/g, ' ').trim();
}

// --- Pages ---

function drawCover(doc: jsPDF, report: VegaReport, accent: string) {
  drawBg(doc);
  const w = doc.internal.pageSize.getWidth();
  const h = doc.internal.pageSize.getHeight();
  const cx = w / 2;

  // Top accent line
  doc.setFillColor(accent);
  doc.rect(0, 0, w, 3, 'F');

  // Logo text
  doc.setFontSize(11);
  doc.setTextColor(C.muted);
  doc.text('GRAND LINE', cx, 30, { align: 'center' });

  // Report label
  const label = REPORT_LABEL_MAP[report.type] || 'REPORTE';
  doc.setFontSize(7);
  doc.setTextColor(accent);
  doc.text(label, cx, 42, { align: 'center' });

  // Title
  const title = REPORT_TITLE_MAP[report.type] || report.title;
  doc.setFontSize(22);
  doc.setTextColor(C.text);
  doc.text(title, cx, 56, { align: 'center' });

  // Period badge
  const periodW = Math.max(doc.getTextWidth(report.period) + 16, 60);
  doc.setFillColor('#111827');
  doc.roundedRect(cx - periodW / 2, 66, periodW, 10, 5, 5, 'F');
  doc.setDrawColor(C.border);
  doc.roundedRect(cx - periodW / 2, 66, periodW, 10, 5, 5, 'S');
  doc.setFillColor(C.good);
  doc.circle(cx - periodW / 2 + 7, 71, 1.2, 'F');
  doc.setFontSize(7);
  doc.setTextColor(C.muted);
  doc.text(report.period, cx + 3, 72, { align: 'center' });

  // Health score badge
  let badgeEndY = 82;
  const hs = report.metadata?.healthScore;
  if (hs) {
    const color = HEALTH_COLORS[hs.level] || C.blue;
    const text = `Salud: ${hs.level} (${hs.score}/100)`;
    const bw = Math.max(doc.getTextWidth(text) * 1.5 + 20, 70);
    doc.setDrawColor(color);
    doc.setLineWidth(0.8);
    doc.roundedRect(cx - bw / 2, 82, bw, 12, 4, 4, 'S');
    doc.setFillColor(color);
    doc.circle(cx - bw / 2 + 8, 88, 2, 'F');
    doc.setFontSize(8);
    doc.setTextColor(color);
    doc.text(text, cx + 3, 89.5, { align: 'center' });
    badgeEndY = 100;
  }

  // Footer
  doc.setFontSize(7);
  doc.setTextColor(C.muted);
  doc.text('Powered by VEGA AI', cx, h - 15, { align: 'center' });
  doc.setFontSize(6);
  doc.text(`Generado: ${new Date(report.generatedAt).toLocaleString('es-CO')}`, cx, h - 10, { align: 'center' });
}

function drawExecutiveSummary(doc: jsPDF, report: VegaReport, accent: string) {
  doc.addPage();
  drawBg(doc);
  let y = sectionHeader(doc, 'Resumen Ejecutivo', 15, accent);

  // Extract summary from content
  const match = report.content.match(/<!-- EXECUTIVE_SUMMARY -->([\s\S]*?)(?=<!-- |## )/);
  const summary = match ? match[1].trim() : report.content.slice(0, 500);
  const clean = cleanText(summary);
  const w = doc.internal.pageSize.getWidth();

  doc.setFontSize(8);
  doc.setTextColor(C.text);
  const lines = doc.splitTextToSize(clean, w - 40);
  const cardH = Math.max(lines.length * 4.5 + 14, 22);

  drawCard(doc, 18, y, w - 36, cardH);
  doc.setFillColor(accent);
  doc.rect(18, y, 2.5, cardH, 'F');
  doc.text(lines, 26, y + 10);
  return y + cardH + 8;
}

function drawKPIDashboard(doc: jsPDF, report: VegaReport, accent: string) {
  const kpis = report.metadata?.kpis;
  if (!kpis) return;

  doc.addPage();
  drawBg(doc);
  const w = doc.internal.pageSize.getWidth();
  let y = sectionHeader(doc, 'Dashboard de KPIs', 15, accent);

  const heroKpis = [
    { label: 'ORDENES', value: `${kpis.n_ord || 0}`, color: C.text },
    { label: 'INGRESO REAL', value: fmt(kpis.ing_real || 0), color: (kpis.ing_real || 0) > 0 ? C.good : C.bad },
    { label: 'UTILIDAD REAL', value: fmt(kpis.u_real || 0), color: (kpis.u_real || 0) >= 0 ? C.good : C.bad },
    { label: 'ROAS REAL', value: `${(kpis.roas_real || 0).toFixed(2)}x`, color: (kpis.roas_real || 0) >= 2.5 ? C.good : (kpis.roas_real || 0) >= 1.5 ? C.warn : C.bad },
    { label: 'TASA ENTREGA', value: pct(kpis.tasa_ent || 0), color: (kpis.tasa_ent || 0) >= 70 ? C.good : (kpis.tasa_ent || 0) >= 50 ? C.warn : C.bad },
  ];

  const cardW = 33;
  const gap = 3;
  const totalW = cardW * heroKpis.length + gap * (heroKpis.length - 1);
  const startX = (w - totalW) / 2;

  heroKpis.forEach((k, i) => {
    const x = startX + i * (cardW + gap);
    drawCard(doc, x, y, cardW, 32);
    doc.setFillColor(k.color);
    doc.rect(x + 1, y, cardW - 2, 2, 'F');
    doc.setFontSize(5);
    doc.setTextColor(C.muted);
    doc.text(k.label, x + 4, y + 10);
    doc.setFontSize(12);
    doc.setTextColor(k.color);
    doc.text(k.value, x + 4, y + 22);
  });

  // Previous period comparison
  y += 40;
  const prev = report.metadata?.prevKpis;
  if (prev) {
    doc.setFontSize(6);
    doc.setTextColor(C.muted);
    doc.text('vs. Periodo Anterior', 15, y);
    y += 6;
    const compareKeys = ['n_ord', 'ing_real', 'u_real', 'roas_real', 'tasa_ent'];
    const labels = ['Ordenes', 'Ingreso Real', 'Util. Real', 'ROAS Real', 'Tasa Entrega'];
    compareKeys.forEach((key, i) => {
      const cur = kpis[key] || 0;
      const prv = prev[key] || 0;
      if (prv === 0) return;
      const delta = ((cur - prv) / Math.abs(prv)) * 100;
      const arrow = delta > 0 ? '+' : '';
      const color = delta > 0 ? C.good : C.bad;
      doc.setFontSize(6);
      doc.setTextColor(C.muted);
      doc.text(`${labels[i]}:`, 15, y);
      doc.setTextColor(color);
      doc.text(`${arrow}${delta.toFixed(1)}%`, 55, y);
      y += 5;
    });
  }
}

function drawPnLCascade(doc: jsPDF, report: VegaReport, accent: string) {
  const pnl = report.metadata?.pnlCascade;
  if (!pnl) return;

  doc.addPage();
  drawBg(doc);
  let y = sectionHeader(doc, 'Estado de Resultados (P&L)', 15, accent);

  const ingTotal = pnl.ingTotal || 1;
  const rows: { label: string; value: number; pctRev: number; color: string; bold?: boolean }[] = [
    { label: 'Ing. Proveedor', value: pnl.ingProveedor, pctRev: (pnl.ingProveedor / ingTotal) * 100, color: C.text },
    { label: 'Ing. Dropshipping', value: pnl.ingDropshipping, pctRev: (pnl.ingDropshipping / ingTotal) * 100, color: C.text },
    { label: '= Ingresos Totales', value: pnl.ingTotal, pctRev: 100, color: C.good, bold: true },
    { label: '(-) Costos', value: -pnl.costoTotal, pctRev: (pnl.costoTotal / ingTotal) * 100, color: C.bad },
    { label: '= Ganancia Bruta', value: pnl.gananciaBruta, pctRev: pnl.margenBruto, color: pnl.gananciaBruta >= 0 ? C.good : C.bad, bold: true },
    { label: '(-) Fletes', value: -pnl.fletes, pctRev: (pnl.fletes / ingTotal) * 100, color: C.bad },
    { label: '(-) Ads', value: -pnl.ads, pctRev: (pnl.ads / ingTotal) * 100, color: C.bad },
    { label: '(-) Gastos Operativos', value: -pnl.gastosOp, pctRev: (pnl.gastosOp / ingTotal) * 100, color: C.warn },
    { label: '(-) Gastos Admin', value: -pnl.gastosAdmin, pctRev: (pnl.gastosAdmin / ingTotal) * 100, color: C.warn },
    { label: '= Utilidad Neta', value: pnl.utilidadNeta, pctRev: pnl.margenNeto, color: pnl.utilidadNeta >= 0 ? C.good : C.bad, bold: true },
  ];

  const tableW = doc.internal.pageSize.getWidth() - 30;
  rows.forEach(row => {
    y = ensureSpace(doc, y, 10);
    const bg = row.bold ? '#1a1210' : C.cardBg;
    doc.setFillColor(bg);
    doc.rect(15, y, tableW, 9, 'F');
    doc.setDrawColor(C.border);
    doc.setLineWidth(0.15);
    doc.line(15, y + 9, 15 + tableW, y + 9);

    doc.setFontSize(row.bold ? 8 : 7.5);
    doc.setTextColor(row.bold ? accent : C.text);
    doc.text(row.label, 20, y + 6);

    doc.setFontSize(row.bold ? 9 : 8);
    doc.setTextColor(row.color);
    doc.text(fmtCur(row.value), 15 + tableW - 30, y + 6, { align: 'right' });

    doc.setFontSize(6);
    doc.setTextColor(C.muted);
    doc.text(`${row.pctRev.toFixed(1)}%`, 15 + tableW - 5, y + 6, { align: 'right' });
    y += 10;
  });
}

function drawCountryBreakdown(doc: jsPDF, report: VegaReport, accent: string) {
  const countries = report.metadata?.metricsByCountry;
  if (!countries || countries.length === 0) return;

  doc.addPage();
  drawBg(doc);
  let y = sectionHeader(doc, 'Desglose por Pais', 15, accent);

  const head = [['Pais', 'Ordenes', 'Entregadas', '% Entrega', 'Ads', 'Utilidad', 'Margen']];
  const body = countries.map(c => {
    const k = c.kpis as Record<string, number>;
    const ingReal = k?.ing_real || 0;
    const utilReal = k?.u_real || c.products.reduce((s, p) => s + (p.utilReal || 0), 0);
    const margin = ingReal > 0 ? (utilReal / ingReal) * 100 : 0;
    return [
      c.countryName,
      `${k?.n_ord || 0}`,
      `${k?.n_ent || 0}`,
      pct(k?.tasa_ent || 0),
      fmt(k?.g_ads || 0),
      fmt(utilReal),
      pct(margin),
    ];
  });

  y = darkAutoTable(doc, y, head, body, {
    didParseCell: (hookData: any) => {
      if (hookData.section === 'body' && hookData.column.index === 5) {
        const raw = hookData.cell.raw as string;
        const neg = raw.startsWith('-') || raw.startsWith('$-');
        hookData.cell.styles.textColor = neg ? C.bad : C.good;
      }
    },
  });
}

function drawTopProducts(doc: jsPDF, report: VegaReport, accent: string) {
  const countries = report.metadata?.metricsByCountry;
  if (!countries || countries.length === 0) return;

  const allProducts = countries.flatMap(c =>
    c.products.map(p => ({ ...p, country: c.countryName }))
  );
  if (allProducts.length === 0) return;

  const profitable = allProducts.filter(p => (p.utilReal || 0) > 0).sort((a, b) => (b.utilReal || 0) - (a.utilReal || 0));
  const losing = allProducts.filter(p => (p.utilReal || 0) <= 0).sort((a, b) => (a.utilReal || 0) - (b.utilReal || 0));

  doc.addPage();
  drawBg(doc);
  let y = sectionHeader(doc, 'Rentabilidad por Producto', 15, accent);

  if (profitable.length > 0) {
    doc.setFontSize(7);
    doc.setTextColor(C.good);
    doc.text(`GENERANDO GANANCIA (${profitable.length})`, 15, y + 3);
    y += 6;

    const head = [['Producto', 'Ordenes', 'Entreg.', 'CPA', 'Utilidad', 'Margen']];
    const body = profitable.slice(0, 15).map(p => {
      const ingReal = (p.utilReal || 0) + (p.ads || 0) + (p.cpa * p.n_ent || 0);
      const margin = ingReal > 0 ? ((p.utilReal || 0) / ingReal) * 100 : 0;
      return [
        p.name.length > 28 ? p.name.slice(0, 28) + '...' : p.name,
        `${p.n_ord}`, `${p.n_ent}`, fmtCur(p.cpa), fmt(p.utilReal || 0), pct(margin),
      ];
    });
    y = darkAutoTable(doc, y, head, body);
    y += 6;
  }

  if (losing.length > 0) {
    y = ensureSpace(doc, y, 30);
    doc.setFontSize(7);
    doc.setTextColor(C.bad);
    doc.text(`GENERANDO PERDIDA (${losing.length})`, 15, y + 3);
    y += 6;

    const head = [['Producto', 'Ordenes', 'Entreg.', 'CPA', 'Utilidad', 'Margen']];
    const body = losing.slice(0, 10).map(p => {
      const ingReal = (p.utilReal || 0) + (p.ads || 0) + (p.cpa * p.n_ent || 0);
      const margin = ingReal > 0 ? ((p.utilReal || 0) / ingReal) * 100 : 0;
      return [
        p.name.length > 28 ? p.name.slice(0, 28) + '...' : p.name,
        `${p.n_ord}`, `${p.n_ent}`, fmtCur(p.cpa), fmt(p.utilReal || 0), pct(margin),
      ];
    });
    y = darkAutoTable(doc, y, head, body, {
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && hookData.column.index === 4) {
          hookData.cell.styles.textColor = C.bad;
        }
      },
    });
  }
}

function drawLogistics(doc: jsPDF, report: VegaReport, accent: string) {
  const meta = report.metadata;
  if (!meta?.cancelReasons && !meta?.carrierBreakdown) return;

  doc.addPage();
  drawBg(doc);
  let y = sectionHeader(doc, 'Logistica', 15, accent);

  if (meta.cancelReasons && meta.cancelReasons.length > 0) {
    doc.setFontSize(7);
    doc.setTextColor(C.warn);
    doc.text('RAZONES DE CANCELACION', 15, y + 3);
    y += 6;

    const head = [['Razon', 'Cantidad', '%']];
    const body = meta.cancelReasons.map(r => [r.tag, `${r.count}`, pct(r.pct)]);
    y = darkAutoTable(doc, y, head, body);
    y += 8;
  }

  if (meta.carrierBreakdown && meta.carrierBreakdown.length > 0) {
    y = ensureSpace(doc, y, 30);
    doc.setFontSize(7);
    doc.setTextColor(C.blue);
    doc.text('TRANSPORTADORAS', 15, y + 3);
    y += 6;

    const head = [['Transportadora', 'Ordenes', 'Entregadas', '% Entrega']];
    const body = meta.carrierBreakdown.map(c => [
      c.carrier, `${c.orders}`, `${c.delivered}`, pct(c.deliveryRate),
    ]);
    y = darkAutoTable(doc, y, head, body, {
      didParseCell: (hookData: any) => {
        if (hookData.section === 'body' && hookData.column.index === 3) {
          const val = parseFloat((hookData.cell.raw as string).replace('%', ''));
          hookData.cell.styles.textColor = val >= 70 ? C.good : val >= 50 ? C.warn : C.bad;
        }
      },
    });
  }
}

function drawSupplier(doc: jsPDF, report: VegaReport, accent: string) {
  const sup = report.metadata?.supplierKpis;
  if (!sup) return;

  doc.addPage();
  drawBg(doc);
  const w = doc.internal.pageSize.getWidth();
  let y = sectionHeader(doc, 'Reporte Proveedor', 15, accent);

  // Hero cards
  const cards = [
    { label: 'INGRESO', value: fmt(sup.ingreso), color: C.text },
    { label: 'COSTO', value: fmt(sup.costo), color: C.bad },
    { label: 'GANANCIA', value: fmt(sup.ganancia), color: sup.ganancia >= 0 ? C.good : C.bad },
    { label: 'MARGEN', value: pct(sup.margen), color: sup.margen >= 30 ? C.good : sup.margen >= 15 ? C.warn : C.bad },
  ];

  const cardW = 40;
  const gap = 4;
  const totalW = cardW * 4 + gap * 3;
  const startX = (w - totalW) / 2;

  cards.forEach((c, i) => {
    const x = startX + i * (cardW + gap);
    drawCard(doc, x, y, cardW, 28);
    doc.setFillColor(c.color);
    doc.rect(x + 1, y, cardW - 2, 2, 'F');
    doc.setFontSize(5);
    doc.setTextColor(C.muted);
    doc.text(c.label, x + 4, y + 10);
    doc.setFontSize(12);
    doc.setTextColor(c.color);
    doc.text(c.value, x + 4, y + 21);
  });

  y += 36;

  // Top products
  if (sup.topProducts && sup.topProducts.length > 0) {
    doc.setFontSize(7);
    doc.setTextColor(C.muted);
    doc.text('TOP PRODUCTOS PROVEEDOR', 15, y + 3);
    y += 6;

    const head = [['Producto', 'Unidades', 'Ganancia', 'Margen']];
    const body = sup.topProducts.map(p => [
      p.nombre.length > 30 ? p.nombre.slice(0, 30) + '...' : p.nombre,
      `${p.unidades}`, fmt(p.ganancia), pct(p.margen),
    ]);
    y = darkAutoTable(doc, y, head, body);
  }
}

function drawExpenses(doc: jsPDF, report: VegaReport, accent: string) {
  const expenses = report.metadata?.berryExpenses;
  if (!expenses || expenses.length === 0) return;

  doc.addPage();
  drawBg(doc);
  let y = sectionHeader(doc, 'Desglose de Gastos', 15, accent);

  const total = expenses.reduce((s, e) => s + e.amount, 0);
  const head = [['Categoria', 'Monto', '% del Total']];
  const body = expenses.map(e => [
    e.category, fmtCur(e.amount), pct(total > 0 ? (e.amount / total) * 100 : 0),
  ]);

  y = darkAutoTable(doc, y, head, body);

  // Total row
  y += 2;
  doc.setFillColor('#1a2332');
  doc.rect(15, y, doc.internal.pageSize.getWidth() - 30, 9, 'F');
  doc.setFontSize(8);
  doc.setTextColor(accent);
  doc.text('TOTAL', 20, y + 6);
  doc.text(fmtCur(total), doc.internal.pageSize.getWidth() - 20, y + 6, { align: 'right' });
}

function drawVegaAnalysis(doc: jsPDF, report: VegaReport, accent: string) {
  if (!report.content) return;

  doc.addPage();
  drawBg(doc);
  const w = doc.internal.pageSize.getWidth();
  const pageH = doc.internal.pageSize.getHeight();
  let y = sectionHeader(doc, 'Analisis VEGA AI', 15, accent);
  const maxW = w - 30;

  // Strip blocks handled elsewhere
  let content = report.content;
  content = content.replace(/<!-- EXECUTIVE_SUMMARY -->[\s\S]*?(?=<!-- |## )/g, '');
  content = content.replace(/<!-- HERO_KPIS -->[\s\S]*?<!-- \/HERO_KPIS -->/g, '');
  content = content.replace(/<!-- ALERTS -->[\s\S]*?<!-- \/ALERTS -->/g, '');
  content = content.replace(/<!-- \/?[A-Z_]+ -->/g, '');

  const lines = content.split('\n');

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) { y += 3; continue; }

    // H2 headers
    if (line.startsWith('## ')) {
      y = ensureSpace(doc, y, 16);
      y += 4;
      doc.setFontSize(10);
      doc.setTextColor(accent);
      doc.text(cleanText(line.slice(3)), 15, y + 3);
      y += 4;
      doc.setDrawColor(accent);
      doc.setLineWidth(0.3);
      doc.line(15, y, 15 + maxW * 0.5, y);
      y += 5;
      continue;
    }

    // H3 headers
    if (line.startsWith('### ')) {
      y = ensureSpace(doc, y, 12);
      y += 2;
      doc.setFontSize(8);
      doc.setTextColor(C.text);
      doc.text(cleanText(line.slice(4)).toUpperCase(), 15, y + 3);
      y += 7;
      continue;
    }

    // Bullet points
    if (line.startsWith('- ') || line.startsWith('* ')) {
      y = ensureSpace(doc, y, 8);
      let item = line.replace(/^[-*]\s+/, '');

      // Action tag check
      const actionMatch = item.match(/^\[(ESCALAR|PAUSAR|OPTIMIZAR|MONITOREAR)\]\s*/);
      let textX = 22;

      doc.setFillColor(actionMatch ? (ACTION_COLORS[actionMatch[1]] || accent) : accent);
      doc.circle(17.5, y + 1.5, 1, 'F');

      if (actionMatch) {
        const tagColor = ACTION_COLORS[actionMatch[1]] || C.blue;
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
      doc.setTextColor(C.text);
      const wrapped = doc.splitTextToSize(cleanText(item), maxW - (textX - 15));
      wrapped.forEach((wl: string, wi: number) => {
        y = ensureSpace(doc, y, 5);
        doc.text(wl, wi === 0 ? textX : 22, y + 2.5);
        y += 5;
      });
      continue;
    }

    // Numbered list
    if (/^\d+\.\s/.test(line)) {
      y = ensureSpace(doc, y, 8);
      const num = line.match(/^(\d+)\./)?.[1] || '1';
      let item = line.replace(/^\d+\.\s+/, '');

      doc.setFillColor(accent);
      doc.roundedRect(15, y, 6, 6, 1.5, 1.5, 'F');
      doc.setFontSize(5);
      doc.setTextColor('#ffffff');
      doc.text(num, 18, y + 4.2, { align: 'center' });

      const actionMatch = item.match(/^\[(ESCALAR|PAUSAR|OPTIMIZAR|MONITOREAR)\]\s*/);
      let textX = 24;

      if (actionMatch) {
        const tagColor = ACTION_COLORS[actionMatch[1]] || C.blue;
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

      doc.setFontSize(7.5);
      doc.setTextColor(C.text);
      const wrapped = doc.splitTextToSize(cleanText(item), maxW - (textX - 15));
      wrapped.forEach((wl: string, wi: number) => {
        y = ensureSpace(doc, y, 5);
        doc.text(wl, wi === 0 ? textX : 24, y + 4);
        y += 5;
      });
      y += 2;
      continue;
    }

    // Bold standalone
    if (line.startsWith('**') && line.endsWith('**')) {
      y = ensureSpace(doc, y, 8);
      y += 2;
      doc.setFontSize(7);
      doc.setTextColor(accent);
      doc.text(cleanText(line).toUpperCase(), 15, y + 2);
      y += 6;
      continue;
    }

    // Markdown tables
    if (line.startsWith('|')) {
      const tableLines: string[] = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tableLines.push(lines[i].trim());
        i++;
      }
      i--; // loop will increment

      const rows = tableLines
        .filter(l => !l.match(/^\|[\s-:|]+\|$/))
        .map(l => l.split('|').slice(1, -1).map(cell => cleanText(cell.trim())));
      if (rows.length > 0) {
        const hasHeader = tableLines.length > 1 && tableLines[1]?.match(/^\|[\s-:|]+\|$/);
        const headRow = hasHeader ? [rows[0]] : undefined;
        const bodyRows = hasHeader ? rows.slice(1) : rows;
        y = ensureSpace(doc, y, 20);
        y = darkAutoTable(doc, y, headRow || [], bodyRows);
        y += 3;
      }
      continue;
    }

    // Regular paragraph
    y = ensureSpace(doc, y, 6);
    doc.setFontSize(7.5);
    doc.setTextColor(C.text);
    const wrapped = doc.splitTextToSize(cleanText(line), maxW);
    wrapped.forEach((wl: string) => {
      y = ensureSpace(doc, y, 5);
      doc.text(wl, 15, y + 2);
      y += 5;
    });
  }
}

function drawFooter(doc: jsPDF) {
  const pageCount = doc.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    const w = doc.internal.pageSize.getWidth();
    const h = doc.internal.pageSize.getHeight();
    doc.setDrawColor(C.border);
    doc.setLineWidth(0.3);
    doc.line(15, h - 14, w - 15, h - 14);
    doc.setFontSize(5.5);
    doc.setTextColor(C.muted);
    doc.text('Grand Line — Command Center', 15, h - 9);
    doc.text('Generado por VEGA IA', 15, h - 5);
    doc.text(`Pagina ${i} de ${pageCount}`, w - 15, h - 9, { align: 'right' });
  }
}

// --- Main Export ---

export async function generateVegaReportPDF(report: VegaReport): Promise<Buffer> {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const accent = REPORT_COLOR_MAP[report.type] || C.accent;

  // 1. Cover
  drawCover(doc, report, accent);

  // 2. Executive Summary
  drawExecutiveSummary(doc, report, accent);

  // 3. KPI Dashboard
  drawKPIDashboard(doc, report, accent);

  // 4. P&L Cascade
  drawPnLCascade(doc, report, accent);

  // 5. Country Breakdown
  drawCountryBreakdown(doc, report, accent);

  // 6. Top Products
  drawTopProducts(doc, report, accent);

  // 7. Logistics
  drawLogistics(doc, report, accent);

  // 8. Supplier
  drawSupplier(doc, report, accent);

  // 9. Expenses
  drawExpenses(doc, report, accent);

  // 10. VEGA AI Analysis
  drawVegaAnalysis(doc, report, accent);

  // Footer on all pages
  drawFooter(doc);

  return Buffer.from(doc.output('arraybuffer'));
}
