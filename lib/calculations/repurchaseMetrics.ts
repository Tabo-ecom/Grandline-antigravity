/**
 * Repurchase (Recompra) Metrics Calculator
 * Analyzes repeat buyer behavior from Dropi orders using phone number as customer identifier.
 */

import type { DropiOrder } from './kpis';
import { isEntregado, isCancelado } from '../utils/status';
import { parseDropiDate } from '../utils/date-parsers';

// ── Types ───────────────────────────────────────────────────────────────────

export interface ProductRepurchaseMetrics {
    productId: string;
    productName: string;
    uniqueCustomers: number;
    repeatCustomers: number;
    totalOrders: number;
    totalDelivered: number;
    repurchaseRate: number;          // (repeatCustomers / uniqueCustomers) * 100
    avgOrdersPerCustomer: number;    // totalOrders / uniqueCustomers
    avgDaysBetweenPurchases: number; // Average days between 1st and 2nd purchase
    repeatRevenue: number;           // Revenue from repeat customers
    newRevenue: number;              // Revenue from first-time customers
    repeatRevenuePercent: number;    // % of revenue from repeat customers
    healthLevel: 'excellent' | 'good' | 'average' | 'low'; // Based on repurchase rate
    topRepeatCustomers: { phone: string; name: string; orders: number; totalSpent: number }[];
}

export interface GlobalRepurchaseMetrics {
    totalUniqueCustomers: number;
    totalRepeatCustomers: number;
    globalRepurchaseRate: number;
    avgOrdersPerCustomer: number;
    avgDaysBetweenPurchases: number;
    repeatRevenuePercent: number;
    crossSellRate: number;           // % of repeat customers who bought different products
    byProduct: ProductRepurchaseMetrics[];
}

// ── Health Thresholds ───────────────────────────────────────────────────────

function getHealthLevel(rate: number): 'excellent' | 'good' | 'average' | 'low' {
    if (rate >= 25) return 'excellent';
    if (rate >= 15) return 'good';
    if (rate >= 8) return 'average';
    return 'low';
}

// ── Normalize phone number ──────────────────────────────────────────────────

function normalizePhone(phone: string | undefined): string {
    if (!phone) return '';
    // Remove spaces, dashes, dots, parentheses, plus sign
    let clean = phone.replace(/[\s\-\.\(\)\+]/g, '');
    // Remove country code prefixes (57 for Colombia, 593 for Ecuador, etc.)
    if (clean.length > 10) {
        if (clean.startsWith('57')) clean = clean.slice(2);
        else if (clean.startsWith('593')) clean = clean.slice(3);
        else if (clean.startsWith('52')) clean = clean.slice(2);
        else if (clean.startsWith('502')) clean = clean.slice(3);
        else if (clean.startsWith('51')) clean = clean.slice(2);
        else if (clean.startsWith('56')) clean = clean.slice(2);
    }
    return clean;
}

// ── Main Calculator ─────────────────────────────────────────────────────────

export function calculateRepurchaseMetrics(orders: DropiOrder[]): GlobalRepurchaseMetrics {
    // Filter valid orders (non-cancelled, with phone)
    const validOrders = orders.filter(o =>
        !isCancelado(o.ESTATUS) &&
        normalizePhone(o.TELEFONO_CLIENTE)
    );

    if (validOrders.length === 0) {
        return {
            totalUniqueCustomers: 0, totalRepeatCustomers: 0,
            globalRepurchaseRate: 0, avgOrdersPerCustomer: 0,
            avgDaysBetweenPurchases: 0, repeatRevenuePercent: 0,
            crossSellRate: 0, byProduct: [],
        };
    }

    // ── Global customer map ──
    // phone -> { orders, products, dates, revenue }
    const customerMap = new Map<string, {
        name: string;
        orders: { orderId: string; productId: string; productName: string; date: Date | null; revenue: number; status: string }[];
    }>();

    for (const o of validOrders) {
        const phone = normalizePhone(o.TELEFONO_CLIENTE);
        if (!phone) continue;

        const productId = String(o.PRODUCTO_ID || o.PRODUCTO || '');
        const productName = o.PRODUCTO || '';
        const date = parseDropiDate(o.FECHA);
        const revenue = o["TOTAL DE LA ORDEN"] || 0;

        if (!customerMap.has(phone)) {
            customerMap.set(phone, {
                name: o.NOMBRE_CLIENTE || '',
                orders: [],
            });
        }
        customerMap.get(phone)!.orders.push({
            orderId: o.ID,
            productId,
            productName,
            date,
            revenue,
            status: o.ESTATUS,
        });
    }

    // ── Global metrics ──
    const totalUniqueCustomers = customerMap.size;
    let totalRepeatCustomers = 0;
    let crossSellCustomers = 0;
    let allGaps: number[] = [];
    let repeatRevenue = 0;
    let totalRevenue = 0;

    for (const [, customer] of customerMap) {
        const orderCount = customer.orders.length;
        const rev = customer.orders.reduce((s, o) => s + o.revenue, 0);
        totalRevenue += rev;

        if (orderCount >= 2) {
            totalRepeatCustomers++;
            repeatRevenue += rev;

            // Check cross-sell (different products)
            const uniqueProducts = new Set(customer.orders.map(o => o.productId));
            if (uniqueProducts.size > 1) crossSellCustomers++;

            // Calculate time between purchases
            const dates = customer.orders
                .map(o => o.date)
                .filter((d): d is Date => d !== null && d.getTime() > 0)
                .sort((a, b) => a.getTime() - b.getTime());

            if (dates.length >= 2) {
                const gap = (dates[dates.length - 1].getTime() - dates[0].getTime()) / (1000 * 60 * 60 * 24);
                const avgGap = gap / (dates.length - 1);
                if (avgGap > 0 && avgGap < 365) allGaps.push(avgGap);
            }
        }
    }

    // ── Per-product metrics ──
    const productMap = new Map<string, {
        name: string;
        customerOrders: Map<string, { name: string; orders: number; totalSpent: number; dates: Date[] }>;
    }>();

    for (const [phone, customer] of customerMap) {
        for (const order of customer.orders) {
            const pid = order.productId;
            if (!pid) continue;

            if (!productMap.has(pid)) {
                productMap.set(pid, { name: order.productName, customerOrders: new Map() });
            }
            const pm = productMap.get(pid)!;
            if (!pm.customerOrders.has(phone)) {
                pm.customerOrders.set(phone, { name: customer.name, orders: 0, totalSpent: 0, dates: [] });
            }
            const co = pm.customerOrders.get(phone)!;
            co.orders++;
            co.totalSpent += order.revenue;
            if (order.date && order.date.getTime() > 0) co.dates.push(order.date);
        }
    }

    const byProduct: ProductRepurchaseMetrics[] = [];

    for (const [pid, pm] of productMap) {
        const uniqueCustomers = pm.customerOrders.size;
        if (uniqueCustomers === 0) continue;

        let repeatCustomers = 0;
        let totalOrders = 0;
        let pRepeatRevenue = 0;
        let pNewRevenue = 0;
        let pGaps: number[] = [];
        const topRepeats: { phone: string; name: string; orders: number; totalSpent: number }[] = [];

        for (const [phone, co] of pm.customerOrders) {
            totalOrders += co.orders;
            if (co.orders >= 2) {
                repeatCustomers++;
                pRepeatRevenue += co.totalSpent;
                topRepeats.push({ phone: phone.slice(-4).padStart(phone.length, '*'), name: co.name, orders: co.orders, totalSpent: co.totalSpent });

                const sorted = co.dates.sort((a, b) => a.getTime() - b.getTime());
                if (sorted.length >= 2) {
                    const gap = (sorted[sorted.length - 1].getTime() - sorted[0].getTime()) / (1000 * 60 * 60 * 24);
                    const avgGap = gap / (sorted.length - 1);
                    if (avgGap > 0 && avgGap < 365) pGaps.push(avgGap);
                }
            } else {
                pNewRevenue += co.totalSpent;
            }
        }

        const pTotalRevenue = pRepeatRevenue + pNewRevenue;
        const repurchaseRate = uniqueCustomers > 0 ? (repeatCustomers / uniqueCustomers) * 100 : 0;

        // Count delivered orders for this product
        const deliveredOrders = validOrders.filter(o =>
            String(o.PRODUCTO_ID || o.PRODUCTO || '') === pid && isEntregado(o.ESTATUS)
        ).length;

        byProduct.push({
            productId: pid,
            productName: pm.name,
            uniqueCustomers,
            repeatCustomers,
            totalOrders,
            totalDelivered: deliveredOrders,
            repurchaseRate: Math.round(repurchaseRate * 10) / 10,
            avgOrdersPerCustomer: Math.round((totalOrders / uniqueCustomers) * 10) / 10,
            avgDaysBetweenPurchases: pGaps.length > 0 ? Math.round(pGaps.reduce((a, b) => a + b, 0) / pGaps.length) : 0,
            repeatRevenue: pRepeatRevenue,
            newRevenue: pNewRevenue,
            repeatRevenuePercent: pTotalRevenue > 0 ? Math.round((pRepeatRevenue / pTotalRevenue) * 1000) / 10 : 0,
            healthLevel: getHealthLevel(repurchaseRate),
            topRepeatCustomers: topRepeats.sort((a, b) => b.orders - a.orders).slice(0, 5),
        });
    }

    // Sort by repurchase rate descending
    byProduct.sort((a, b) => b.repurchaseRate - a.repurchaseRate);

    const globalRate = totalUniqueCustomers > 0 ? (totalRepeatCustomers / totalUniqueCustomers) * 100 : 0;
    const avgGlobal = allGaps.length > 0 ? allGaps.reduce((a, b) => a + b, 0) / allGaps.length : 0;

    return {
        totalUniqueCustomers,
        totalRepeatCustomers,
        globalRepurchaseRate: Math.round(globalRate * 10) / 10,
        avgOrdersPerCustomer: totalUniqueCustomers > 0 ? Math.round((validOrders.length / totalUniqueCustomers) * 10) / 10 : 0,
        avgDaysBetweenPurchases: Math.round(avgGlobal),
        repeatRevenuePercent: totalRevenue > 0 ? Math.round((repeatRevenue / totalRevenue) * 1000) / 10 : 0,
        crossSellRate: totalRepeatCustomers > 0 ? Math.round((crossSellCustomers / totalRepeatCustomers) * 1000) / 10 : 0,
        byProduct,
    };
}
