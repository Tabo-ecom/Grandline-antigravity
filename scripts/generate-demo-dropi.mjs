/**
 * Generates a fictitious Dropi report (.xlsx) for demo/recording purposes.
 * Run: node scripts/generate-demo-dropi.mjs
 * Output: ~/Desktop/Reporte_Dropi_Colombia_Enero2026.xlsx
 */
import XLSX from 'xlsx';
import { resolve } from 'path';
import { homedir } from 'os';

// ─── CONFIG ──────────────────────────────────────────────────
const COUNTRY = 'Colombia';
const MONTH = '2026-01';
const NUM_ORDERS = 350;
const OUTPUT_FILE = resolve(homedir(), 'Desktop', 'Reporte_Dropi_Colombia_Enero2026.xlsx');

// ─── DATA ────────────────────────────────────────────────────
const PRODUCTS = [
    { name: 'Sérum Vitamina C Glow', id: 'P-4501', sku: 'SER-VC-001', supplier: 18000, sale: 69900 },
    { name: 'Crema Anti-Arrugas Gold', id: 'P-4502', sku: 'CRM-AG-002', supplier: 22000, sale: 89900 },
    { name: 'Aceite de Rosa Mosqueta', id: 'P-4503', sku: 'ACE-RM-003', supplier: 12000, sale: 49900 },
    { name: 'Kit Skincare 5 Pasos', id: 'P-4504', sku: 'KIT-SK-004', supplier: 45000, sale: 159900 },
    { name: 'Mascarilla Facial LED', id: 'P-4505', sku: 'MSK-LED-005', supplier: 35000, sale: 129900 },
    { name: 'Colágeno Bebible Premium', id: 'P-4506', sku: 'COL-BEB-006', supplier: 28000, sale: 99900 },
    { name: 'Protector Solar SPF50', id: 'P-4507', sku: 'PSO-50-007', supplier: 15000, sale: 59900 },
    { name: 'Contorno de Ojos Gold', id: 'P-4508', sku: 'CON-OJ-008', supplier: 20000, sale: 79900 },
];

const CITIES = [
    'Bogotá', 'Medellín', 'Cali', 'Barranquilla', 'Cartagena',
    'Bucaramanga', 'Pereira', 'Manizales', 'Ibagué', 'Cúcuta',
    'Villavicencio', 'Santa Marta', 'Neiva', 'Armenia', 'Pasto',
    'Montería', 'Sincelejo', 'Popayán', 'Tunja', 'Valledupar',
];

const CARRIERS = ['Servientrega', 'Coordinadora', 'Inter Rapidísimo', 'TCC', 'Envía'];

const STATUSES = ['ENTREGADO', 'CANCELADO', 'GUIA GENERADA', 'EN CAMINO', 'DEVOLUCIÓN', 'IMPRESO', 'EN TRÁNSITO'];
const STATUS_WEIGHTS = [0.58, 0.18, 0.08, 0.06, 0.04, 0.03, 0.03];

// ─── HELPERS ─────────────────────────────────────────────────
function randomInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function randomChoice(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function weightedChoice(arr, weights) {
    const total = weights.reduce((s, w) => s + w, 0);
    let r = Math.random() * total;
    for (let i = 0; i < arr.length; i++) { r -= weights[i]; if (r <= 0) return arr[i]; }
    return arr[arr.length - 1];
}

// ─── GENERATE ORDERS ─────────────────────────────────────────
const rows = [];

for (let i = 1; i <= NUM_ORDERS; i++) {
    const product = randomChoice(PRODUCTS);
    const status = weightedChoice(STATUSES, STATUS_WEIGHTS);
    const qty = Math.random() < 0.88 ? 1 : randomInt(2, 3);
    const totalOrder = product.sale * qty;
    const supplierTotal = product.supplier * qty;
    const shipping = randomInt(8000, 15000);
    const commission = Math.round(totalOrder * 0.05);
    const ganancia = totalOrder - supplierTotal - shipping - commission;
    const returnShipping = status === 'DEVOLUCIÓN' ? Math.round(shipping * 0.7) : 0;
    const city = randomChoice(CITIES);
    const carrier = randomChoice(CARRIERS);
    const day = randomInt(1, 31);
    const fecha = `${MONTH}-${String(day).padStart(2, '0')}`;

    rows.push({
        'ID': `ORD-${String(10000 + i)}`,
        'ESTATUS': status,
        'TOTAL DE LA ORDEN': totalOrder,
        'PRODUCTO': product.name,
        'SKU': product.sku,
        'PRODUCTO ID': product.id,
        'CANTIDAD': qty,
        'PRECIO PROVEEDOR': product.supplier,
        'PRECIO PROVEEDOR X CANTIDAD': supplierTotal,
        'PRECIO FLETE': shipping,
        'COSTO DEVOLUCION FLETE': returnShipping,
        'GANANCIA': ganancia,
        'FECHA': fecha,
        'CIUDAD': city,
        'CIUDAD DESTINO': city,
        'COMISION': commission,
        'PAIS': 'CO',
        'TRANSPORTADORA': carrier,
        'RECAUDO': status === 'ENTREGADO' ? 'RECAUDADO' : 'PENDIENTE',
    });
}

// Sort by date
rows.sort((a, b) => a['FECHA'].localeCompare(b['FECHA']));

// ─── WRITE XLSX ──────────────────────────────────────────────
const ws = XLSX.utils.json_to_sheet(rows);
const wb = XLSX.utils.book_new();
XLSX.utils.book_append_sheet(wb, ws, 'Órdenes');
XLSX.writeFile(wb, OUTPUT_FILE);

// Stats
const delivered = rows.filter(r => r.ESTATUS === 'ENTREGADO').length;
const cancelled = rows.filter(r => r.ESTATUS === 'CANCELADO').length;
const returns = rows.filter(r => r.ESTATUS === 'DEVOLUCIÓN').length;
const totalRevenue = rows.reduce((s, r) => s + r['TOTAL DE LA ORDEN'], 0);

console.log(`\n✅ Reporte generado: ${OUTPUT_FILE}`);
console.log(`\n📊 Estadísticas:`);
console.log(`   Órdenes totales: ${NUM_ORDERS}`);
console.log(`   Entregados: ${delivered} (${((delivered/NUM_ORDERS)*100).toFixed(1)}%)`);
console.log(`   Cancelados: ${cancelled} (${((cancelled/NUM_ORDERS)*100).toFixed(1)}%)`);
console.log(`   Devoluciones: ${returns} (${((returns/NUM_ORDERS)*100).toFixed(1)}%)`);
console.log(`   Facturación: $${totalRevenue.toLocaleString()} COP`);
console.log(`   Productos: ${PRODUCTS.length}`);
console.log(`   País: ${COUNTRY}`);
console.log(`   Período: Enero 2026\n`);
