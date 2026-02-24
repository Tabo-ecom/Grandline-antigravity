
import * as fs from 'fs';
import * as xlsx from 'xlsx';
import { calculateProjection, DropiOrder, calculateKPIs, ProjectionResult } from '../lib/calculations/kpis';

// Path to the provided Excel file
const FILE_PATH = '/Users/tabo/Downloads/ordenes_productos_20260216_153241.xlsx';
const OUTPUT_REPORT = 'simulation_report.md';

function parseExcel(filePath: string): DropiOrder[] {
    const fileBuffer = fs.readFileSync(filePath);
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];
    const rawData = xlsx.utils.sheet_to_json<any>(sheet);

    return rawData.map(row => {
        // Map keys to DropiOrder interface, handling variations
        // Keys in Excel might be upper or lower case, or have slight variations
        const get = (key: string) => row[key] || row[key.toUpperCase()] || row[key.toLowerCase()] || 0;
        const getStr = (key: string) => String(row[key] || row[key.toUpperCase()] || row[key.toLowerCase()] || '').trim().toUpperCase();

        // Helper to clean currency strings if they come as strings
        const cleanNum = (val: any) => {
            if (typeof val === 'number') return val;
            if (typeof val === 'string') {
                return parseFloat(val.replace(/[^\d.-]/g, '')) || 0;
            }
            return 0;
        };

        return {
            ID: getStr('ID'),
            ESTATUS: getStr('ESTATUS'),
            "TOTAL DE LA ORDEN": cleanNum(get('TOTAL DE LA ORDEN') || get('TOTAL_DE_LA_ORDEN')),
            PRODUCTO: getStr('PRODUCTO'),
            CANTIDAD: cleanNum(get('CANTIDAD')),
            "PRECIO PROVEEDOR": cleanNum(get('PRECIO PROVEEDOR')),
            "PRECIO PROVEEDOR X CANTIDAD": cleanNum(get('PRECIO PROVEEDOR X CANTIDAD')),
            "PRECIO FLETE": cleanNum(get('PRECIO FLETE')),
            "COSTO DEVOLUCION FLETE": cleanNum(get('COSTO DEVOLUCION FLETE')),
            GANANCIA: cleanNum(get('GANANCIA')),
            FECHA: get('FECHA'),
            CIUDAD: getStr('CIUDAD DESTINO'),
            "CIUDAD DESTINO": getStr('CIUDAD DESTINO')
        } as DropiOrder;
    });
}

function runSimulations() {
    console.log(`Reading file: ${FILE_PATH}`);
    const orders = parseExcel(FILE_PATH);
    console.log(`Parsed ${orders.length} orders.`);

    // 1. Calculate Real KPIs
    const realKPIs = calculateKPIs(orders);

    // Calculate Real % Delivery per product to use in Scenario 1
    const deliveryRatesReal: Record<string, number> = {};
    const productStats: Record<string, { delivered: number, nonCanceled: number }> = {};

    orders.forEach(o => {
        const p = o.PRODUCTO;
        if (!p) return;
        if (!productStats[p]) productStats[p] = { delivered: 0, nonCanceled: 0 };

        if (o.ESTATUS.includes('ENTREGADO')) productStats[p].delivered++;
        if (!o.ESTATUS.includes('CANCELADO') && !o.ESTATUS.includes('RECHAZADO')) productStats[p].nonCanceled++;
    });

    Object.keys(productStats).forEach(p => {
        const stats = productStats[p];
        if (stats.nonCanceled > 0) {
            deliveryRatesReal[p] = (stats.delivered / stats.nonCanceled) * 100;
        } else {
            deliveryRatesReal[p] = 0;
        }
    });

    // Scenarios
    const scenarios = [
        { name: 'Scenario 1: Real % (Validation)', rates: deliveryRatesReal },
        { name: 'Scenario 2: 70% Delivery', rates: {}, fixedRate: 70 },
        { name: 'Scenario 3: 75% Delivery', rates: {}, fixedRate: 75 },
        { name: 'Scenario 4: 80% Delivery', rates: {}, fixedRate: 80 },
        { name: 'Scenario 5: 85% Delivery', rates: {}, fixedRate: 85 },
    ];

    let report = `# Simulation Report
**File**: \`${FILE_PATH}\`
**Date**: ${new Date().toLocaleString()}
**Orders**: ${orders.length}

## Real Data (Baseline)
- **Total Orders**: ${realKPIs.n_ord}
- **Facturado Neto**: $${realKPIs.fact_neto.toLocaleString()}
- **Real Profit (U_Real)**: $${realKPIs.u_real.toLocaleString()}
- **Delivered**: ${realKPIs.n_ent}
- **Returns**: ${realKPIs.n_dev}
- **Transit**: ${realKPIs.n_tra}

---

## Simulations
`;

    scenarios.forEach(sc => {
        const rates: Record<string, number> = { ...sc.rates };
        // If fixed rate scenario, apply to all products
        if (sc.fixedRate !== undefined) {
            Object.keys(productStats).forEach(p => {
                rates[p] = sc.fixedRate!;
            });
        }

        // Run projection
        // Assuming 0 Ads for now as we are validating logic from file only
        const projection = calculateProjection(orders, 'PRODUCTO', rates, 1.4, {});

        const totalProjProfit = projection.reduce((sum, p) => sum + p.utilidad, 0);
        const totalProjIncome = projection.reduce((sum, p) => sum + p.ingreso, 0);
        const totalProjOrders = projection.reduce((sum, p) => sum + p.ordenes, 0);

        report += `### ${sc.name}
- **Projected Profit**: $${totalProjProfit.toLocaleString()}
- **Projected Income**: $${totalProjIncome.toLocaleString()}
- **Projected Orders**: ${totalProjOrders}
`;

        if (sc.name.includes("Validation")) {
            const diff = totalProjProfit - realKPIs.u_real;
            report += `- **Diff from Real**: $${diff.toLocaleString()} (Should be close to 0)
`;
        }

        report += `\n**Breakdown by Product (Top 5)**:\n`;
        report += `| Product | Orders | % Ent | Projected Profit |\n|---|---|---|---|\n`;

        projection.sort((a, b) => b.utilidad - a.utilidad).slice(0, 5).forEach(p => {
            report += `| ${p.producto} | ${p.ordenes} | ${p.percent_ent.toFixed(1)}% | $${p.utilidad.toLocaleString()} |\n`;
        });
        report += `\n`;
    });

    fs.writeFileSync(OUTPUT_REPORT, report);
    console.log(`Report generated: ${OUTPUT_REPORT}`);
}

runSimulations();
