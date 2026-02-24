import { describe, it, expect } from 'vitest';
import { calculateKPIs, calculateProjection, type DropiOrder } from '../kpis';

// Helper to create test orders
function makeOrder(overrides: Partial<DropiOrder> = {}): DropiOrder {
    return {
        ID: `ORD-${Math.random().toString(36).slice(2, 8)}`,
        ESTATUS: 'ENTREGADO',
        'TOTAL DE LA ORDEN': 50000,
        'PRECIO PROVEEDOR': 15000,
        'PRECIO PROVEEDOR X CANTIDAD': 15000,
        'PRECIO FLETE': 8000,
        'COSTO DEVOLUCION FLETE': 6000,
        ...overrides,
    };
}

describe('calculateKPIs', () => {
    it('handles mixed statuses correctly', () => {
        const orders: DropiOrder[] = [
            makeOrder({ ID: '1', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 60000, 'PRECIO PROVEEDOR X CANTIDAD': 18000, 'PRECIO FLETE': 8000 }),
            makeOrder({ ID: '2', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 50000, 'PRECIO PROVEEDOR X CANTIDAD': 15000, 'PRECIO FLETE': 7000 }),
            makeOrder({ ID: '3', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 70000, 'PRECIO PROVEEDOR X CANTIDAD': 21000, 'PRECIO FLETE': 9000 }),
            makeOrder({ ID: '4', ESTATUS: 'CANCELADO', 'TOTAL DE LA ORDEN': 40000 }),
            makeOrder({ ID: '5', ESTATUS: 'CANCELADO', 'TOTAL DE LA ORDEN': 55000 }),
            makeOrder({ ID: '6', ESTATUS: 'DEVOLUCION', 'TOTAL DE LA ORDEN': 45000, 'COSTO DEVOLUCION FLETE': 6000 }),
            makeOrder({ ID: '7', ESTATUS: 'EN DEVOLUCIÓN', 'TOTAL DE LA ORDEN': 48000, 'COSTO DEVOLUCION FLETE': 7000 }),
            makeOrder({ ID: '8', ESTATUS: 'GUIA GENERADA', 'TOTAL DE LA ORDEN': 52000, 'PRECIO FLETE': 8000 }),
            makeOrder({ ID: '9', ESTATUS: 'EN CAMINO', 'TOTAL DE LA ORDEN': 47000, 'PRECIO FLETE': 7500 }),
            makeOrder({ ID: '10', ESTATUS: 'IMPRESO', 'TOTAL DE LA ORDEN': 43000, 'PRECIO FLETE': 7000 }),
        ];

        const result = calculateKPIs(orders, 100000);

        // Counts
        expect(result.n_ord).toBe(10);
        expect(result.n_ent).toBe(3);
        expect(result.n_can).toBe(2);
        expect(result.n_dev).toBe(2);
        expect(result.n_tra).toBe(3);
        expect(result.n_nc).toBe(8); // 10 - 2 canceled

        // Rates
        expect(result.tasa_ent).toBeCloseTo((3 / 8) * 100, 1); // 37.5%
        expect(result.tasa_can).toBeCloseTo((2 / 10) * 100, 1); // 20%
        // tasa_dev = n_dev / (n_ent + n_dev) = 2/5 = 40%
        expect(result.tasa_dev).toBeCloseTo((2 / 5) * 100, 1);

        // Financials - delivered
        expect(result.ing_real).toBe(60000 + 50000 + 70000); // 180000
        expect(result.cpr).toBe(18000 + 15000 + 21000); // 54000
        expect(result.fl_ent).toBe(8000 + 7000 + 9000); // 24000

        // Return shipping
        expect(result.fl_dev).toBe(6000 + 7000); // 13000

        // Transit shipping
        expect(result.fl_tra).toBe(8000 + 7500 + 7000); // 22500

        // Ads
        expect(result.g_ads).toBe(100000);

        // Profit = 180000 - 54000 - 100000 - 24000 - 13000 - 22500 = -33500
        expect(result.u_real).toBe(180000 - 54000 - 100000 - 24000 - 13000 - 22500);

        // ROAS Real = 180000 / 100000 = 1.8
        expect(result.roas_real).toBeCloseTo(1.8, 2);

        // CPA = 100000 / 10 = 10000
        expect(result.cpa).toBe(10000);
    });

    it('handles all delivered orders', () => {
        const orders = [
            makeOrder({ ID: '1', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 50000 }),
            makeOrder({ ID: '2', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 60000 }),
            makeOrder({ ID: '3', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 40000 }),
        ];

        const result = calculateKPIs(orders, 50000);

        expect(result.tasa_ent).toBe(100);
        expect(result.tasa_can).toBe(0);
        expect(result.n_nc).toBe(3);
    });

    it('handles all canceled orders', () => {
        const orders = [
            makeOrder({ ID: '1', ESTATUS: 'CANCELADO', 'TOTAL DE LA ORDEN': 50000 }),
            makeOrder({ ID: '2', ESTATUS: 'RECHAZADO', 'TOTAL DE LA ORDEN': 60000 }),
        ];

        const result = calculateKPIs(orders, 30000);

        expect(result.tasa_can).toBe(100);
        expect(result.tasa_ent).toBe(0); // n_nc = 0, so 0
        expect(result.fact_neto).toBe(0);
        expect(result.ing_real).toBe(0);
        expect(result.u_real).toBe(-30000); // Only ads spent
    });

    it('handles zero orders without division-by-zero', () => {
        const result = calculateKPIs([], 0);

        expect(result.n_ord).toBe(0);
        expect(result.tasa_ent).toBe(0);
        expect(result.tasa_can).toBe(0);
        expect(result.tasa_dev).toBe(0);
        expect(result.roas_real).toBe(0);
        expect(result.roas_bruto).toBe(0);
        expect(result.cpa).toBe(0);
        expect(result.cpe).toBe(0);
        expect(result.perc_ads_revenue).toBe(0);
        expect(result.u_real).toBe(0);
        expect(Number.isNaN(result.u_real)).toBe(false);
    });

    it('handles zero ads without NaN', () => {
        const orders = [
            makeOrder({ ID: '1', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 50000 }),
        ];

        const result = calculateKPIs(orders, 0);

        expect(result.roas_real).toBe(0);
        expect(result.roas_bruto).toBe(0);
        expect(result.cpa).toBe(0);
        expect(result.cpe).toBe(0);
        expect(result.perc_ads_revenue).toBe(0);
        expect(Number.isNaN(result.roas_real)).toBe(false);
        expect(Number.isNaN(result.cpa)).toBe(false);
    });

    it('deduplicates multi-line orders by ID for counts', () => {
        // Same order ID appears twice (multi-line: 2 products in same order)
        const orders = [
            makeOrder({ ID: '1', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 80000, 'PRECIO PROVEEDOR X CANTIDAD': 10000, 'PRECIO FLETE': 8000 }),
            makeOrder({ ID: '1', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 80000, 'PRECIO PROVEEDOR X CANTIDAD': 12000, 'PRECIO FLETE': 8000 }),
            makeOrder({ ID: '2', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 60000, 'PRECIO PROVEEDOR X CANTIDAD': 15000, 'PRECIO FLETE': 7000 }),
        ];

        const result = calculateKPIs(orders, 20000);

        // Only 2 unique order IDs
        expect(result.n_ord).toBe(2);
        expect(result.n_ent).toBe(2);

        // Revenue deduplicates by ID (80000 + 60000)
        expect(result.ing_real).toBe(140000);

        // CPR sums ALL lines (10000 + 12000 + 15000)
        expect(result.cpr).toBe(37000);

        // Flete deduplicates by ID (8000 + 7000)
        expect(result.fl_ent).toBe(15000);
    });

    it('calculates profit formula correctly', () => {
        const orders = [
            makeOrder({
                ID: '1',
                ESTATUS: 'ENTREGADO',
                'TOTAL DE LA ORDEN': 100000,
                'PRECIO PROVEEDOR X CANTIDAD': 30000,
                'PRECIO FLETE': 10000,
            }),
            makeOrder({
                ID: '2',
                ESTATUS: 'DEVOLUCION',
                'TOTAL DE LA ORDEN': 50000,
                'COSTO DEVOLUCION FLETE': 8000,
            }),
            makeOrder({
                ID: '3',
                ESTATUS: 'EN CAMINO',
                'TOTAL DE LA ORDEN': 60000,
                'PRECIO FLETE': 9000,
            }),
        ];

        const g_ads = 20000;
        const result = calculateKPIs(orders, g_ads);

        // u_real = ing_real - cpr - g_ads - fl_ent - fl_dev - fl_tra
        // u_real = 100000 - 30000 - 20000 - 10000 - 8000 - 9000 = 23000
        expect(result.u_real).toBe(100000 - 30000 - 20000 - 10000 - 8000 - 9000);
        expect(result.u_real).toBe(23000);
    });

    it('handles negative profit with high ads', () => {
        const orders = [
            makeOrder({
                ID: '1',
                ESTATUS: 'ENTREGADO',
                'TOTAL DE LA ORDEN': 50000,
                'PRECIO PROVEEDOR X CANTIDAD': 15000,
                'PRECIO FLETE': 8000,
            }),
        ];

        const result = calculateKPIs(orders, 200000); // Very high ads

        expect(result.u_real).toBeLessThan(0);
        // u_real = 50000 - 15000 - 200000 - 8000 = -173000
        expect(result.u_real).toBe(-173000);
    });

    it('calculates perc_ads_revenue correctly', () => {
        const orders = [
            makeOrder({ ID: '1', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 100000 }),
            makeOrder({ ID: '2', ESTATUS: 'EN CAMINO', 'TOTAL DE LA ORDEN': 50000 }),
        ];

        const result = calculateKPIs(orders, 30000);

        // fact_neto = 150000 (both non-canceled)
        // perc_ads_revenue = (30000 / 150000) * 100 = 20%
        expect(result.perc_ads_revenue).toBeCloseTo(20, 1);
    });
});

describe('calculateProjection', () => {
    it('calculates basic projection with delivery rate', () => {
        const orders: DropiOrder[] = [
            makeOrder({ ID: '1', PRODUCTO_ID: 'P1', PRODUCTO: 'Product A', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 50000, 'PRECIO PROVEEDOR X CANTIDAD': 15000, 'PRECIO FLETE': 8000 }),
            makeOrder({ ID: '2', PRODUCTO_ID: 'P1', PRODUCTO: 'Product A', ESTATUS: 'EN CAMINO', 'TOTAL DE LA ORDEN': 50000, 'PRECIO PROVEEDOR X CANTIDAD': 15000, 'PRECIO FLETE': 8000 }),
            makeOrder({ ID: '3', PRODUCTO_ID: 'P1', PRODUCTO: 'Product A', ESTATUS: 'EN CAMINO', 'TOTAL DE LA ORDEN': 50000, 'PRECIO PROVEEDOR X CANTIDAD': 15000, 'PRECIO FLETE': 8000 }),
        ];

        const results = calculateProjection(
            orders,
            'PRODUCTO_ID',
            { P1: 80 },
            1.0,
            { P1: 20000 }
        );

        expect(results).toHaveLength(1);
        const p = results[0];
        expect(p.productoId).toBe('P1');
        expect(p.ordenes).toBe(3); // All 3 are non-canceled
        expect(p.percent_ent).toBe(80);
    });

    it('handles 100% delivery rate', () => {
        const orders: DropiOrder[] = [
            makeOrder({ ID: '1', PRODUCTO_ID: 'P1', PRODUCTO: 'Product A', ESTATUS: 'ENTREGADO', 'TOTAL DE LA ORDEN': 50000, 'PRECIO PROVEEDOR X CANTIDAD': 15000, 'PRECIO FLETE': 8000 }),
        ];

        const results = calculateProjection(
            orders,
            'PRODUCTO_ID',
            { P1: 100 },
            1.0,
            { P1: 10000 }
        );

        expect(results).toHaveLength(1);
        const p = results[0];
        expect(p.fl_resto).toBe(0); // 100% delivery → no return shipping
    });

    it('handles 0% delivery rate (falls back to 80% default due to || operator)', () => {
        // Note: percentDelivery[key] || 80 treats 0 as falsy, defaulting to 80%.
        // This is intentional — 0% delivery isn't a valid business scenario.
        const orders: DropiOrder[] = [
            makeOrder({ ID: '1', PRODUCTO_ID: 'P1', PRODUCTO: 'Product A', ESTATUS: 'EN CAMINO', 'TOTAL DE LA ORDEN': 50000, 'PRECIO PROVEEDOR X CANTIDAD': 15000, 'PRECIO FLETE': 8000 }),
        ];

        const results = calculateProjection(
            orders,
            'PRODUCTO_ID',
            { P1: 0 },
            1.0,
            { P1: 10000 }
        );

        expect(results).toHaveLength(1);
        const p = results[0];
        // 0 is falsy so falls back to default 80%
        expect(p.percent_ent).toBe(80);
        expect(p.ingreso).toBeGreaterThan(0);
    });

    it('applies buffer multiplier to fl_resto', () => {
        const orders: DropiOrder[] = [
            makeOrder({ ID: '1', PRODUCTO_ID: 'P1', PRODUCTO: 'Product A', ESTATUS: 'EN CAMINO', 'TOTAL DE LA ORDEN': 50000, 'PRECIO PROVEEDOR X CANTIDAD': 15000, 'PRECIO FLETE': 8000 }),
        ];

        const resultsNoBuffer = calculateProjection(orders, 'PRODUCTO_ID', { P1: 50 }, 1.0, { P1: 0 });
        const resultsWithBuffer = calculateProjection(orders, 'PRODUCTO_ID', { P1: 50 }, 1.5, { P1: 0 });

        // Buffer multiplier affects fl_resto
        expect(resultsWithBuffer[0].fl_resto).toBeCloseTo(resultsNoBuffer[0].fl_resto * 1.5, 0);
    });

    it('includes products with ads but no orders', () => {
        const orders: DropiOrder[] = [
            makeOrder({ ID: '1', PRODUCTO_ID: 'P1', PRODUCTO: 'Product A', ESTATUS: 'ENTREGADO' }),
        ];

        const results = calculateProjection(
            orders,
            'PRODUCTO_ID',
            { P1: 80, P2: 80 },
            1.0,
            { P1: 10000, P2: 5000 } // P2 has ads but no orders
        );

        // Should include P2 even though it has no orders
        const p2 = results.find(r => r.productoId === 'P2');
        expect(p2).toBeDefined();
        expect(p2!.ads).toBe(5000);
        expect(p2!.utilidad).toBe(-5000); // Only loss from ads
    });
});
