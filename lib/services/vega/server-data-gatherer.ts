/**
 * Vega AI - Server-Side Data Gatherer
 * Replicates useDashboardData logic for server-side cron jobs (no React hooks)
 */

import { getAllOrderFiles, getAppData } from '@/lib/firebase/firestore';
import { fetchExchangeRates, toCOP, isMatchingCountry, getCurrencyForCountry, getOfficialCountryName } from '@/lib/utils/currency';
import { listAllAdSpends, getCampaignMappings, deduplicateAdSpends } from '@/lib/services/marketing';
import { DropiOrder, calculateKPIs } from '@/lib/calculations/kpis';
import { parseDropiDate, getLocalDateKey } from '@/lib/utils/date-parsers';
import { isCancelado, isEntregado, isTransit, isDevolucion } from '@/lib/utils/status';
import { getProductGroups, getEffectiveProductId, getProductGroup } from '@/lib/services/productGroups';
import { getExpenses, totalByCategory, type Expense } from '@/lib/services/expenses';
import { buildDataContext, type VegaDataContext } from './context-builder';
import type { ExtendedDropiOrder } from '@/lib/hooks/useDashboardData';

interface DateRange {
    startDate: Date;
    endDate: Date;
    label: string;
}

function getDateRangeForReport(type: 'daily' | 'weekly' | 'monthly'): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (type === 'daily') {
        // Yesterday's full day
        const yesterday = new Date(today);
        yesterday.setDate(yesterday.getDate() - 1);
        const end = new Date(yesterday);
        end.setHours(23, 59, 59, 999);
        return {
            startDate: yesterday,
            endDate: end,
            label: yesterday.toLocaleDateString('es-CO', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
        };
    }

    if (type === 'weekly') {
        // Last 7 days (not including today)
        const end = new Date(today);
        end.setDate(end.getDate() - 1);
        end.setHours(23, 59, 59, 999);
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return {
            startDate: start,
            endDate: end,
            label: `${start.toLocaleDateString('es-CO', { day: 'numeric', month: 'short' })} - ${end.toLocaleDateString('es-CO', { day: 'numeric', month: 'short', year: 'numeric' })}`
        };
    }

    // Monthly: current month up to yesterday
    const start = new Date(now.getFullYear(), now.getMonth(), 1);
    const end = new Date(today);
    end.setDate(end.getDate() - 1);
    end.setHours(23, 59, 59, 999);
    const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
    return {
        startDate: start,
        endDate: end,
        label: `${monthNames[now.getMonth()]} ${now.getFullYear()}`
    };
}

export async function gatherDataForReport(type: 'daily' | 'weekly' | 'monthly', userId: string): Promise<{ context: string; period: string }> {
    if (!userId) throw new Error("userId is required for gatherDataForReport");
    const range = getDateRangeForReport(type);

    // Parallel fetch all data
    const [ordersData, rates, ads, mappings, groups, expenses] = await Promise.all([
        getAllOrderFiles(userId),
        fetchExchangeRates(),
        listAllAdSpends(userId),
        getCampaignMappings(userId),
        getProductGroups(userId),
        getExpenses(userId),
    ]);

    // Flatten orders with currency conversion + product group resolution
    const allOrders: ExtendedDropiOrder[] = [];
    if (Array.isArray(ordersData)) {
        ordersData.forEach((file: any) => {
            if (file.orders && Array.isArray(file.orders)) {
                const cntry = getOfficialCountryName(file.country || 'Desconocido');
                const currency = getCurrencyForCountry(cntry);
                file.orders.forEach((order: DropiOrder) => {
                    const normalized = { ...order, country: cntry } as ExtendedDropiOrder;
                    normalized["TOTAL DE LA ORDEN"] = toCOP(order["TOTAL DE LA ORDEN"], currency, rates);
                    if (order["PRECIO PROVEEDOR"]) normalized["PRECIO PROVEEDOR"] = toCOP(order["PRECIO PROVEEDOR"], currency, rates);
                    if (order["PRECIO PROVEEDOR X CANTIDAD"]) normalized["PRECIO PROVEEDOR X CANTIDAD"] = toCOP(order["PRECIO PROVEEDOR X CANTIDAD"], currency, rates);
                    if (order["PRECIO FLETE"]) normalized["PRECIO FLETE"] = toCOP(order["PRECIO FLETE"], currency, rates);
                    if (order["COSTO DEVOLUCION FLETE"]) normalized["COSTO DEVOLUCION FLETE"] = toCOP(order["COSTO DEVOLUCION FLETE"], currency, rates);
                    if (order.GANANCIA) normalized.GANANCIA = toCOP(order.GANANCIA, currency, rates);
                    const groupByName = getProductGroup(order.PRODUCTO || '', groups);
                    const groupById = order.PRODUCTO_ID ? getProductGroup(order.PRODUCTO_ID.toString(), groups) : null;
                    normalized.PRODUCTO_ID = groupByName?.id || groupById?.id || order.PRODUCTO_ID?.toString() || order.PRODUCTO || 'unknown';
                    allOrders.push(normalized);
                });
            }
        });
    }

    // Resolve ads (dedup + campaign mapping + name-ID conversion)
    const dedupedAds = deduplicateAdSpends(ads);
    const campaignToProductMap: Record<string, string> = {};
    mappings.forEach(m => {
        campaignToProductMap[`${m.campaignName}|${m.platform}`.toLowerCase()] = m.productId;
    });
    const countryNameToIdMap: Record<string, string> = {};
    allOrders.forEach(o => {
        if (o.PRODUCTO && o.PRODUCTO_ID) {
            const key = `${o.country}|${(o.PRODUCTO as string).toLowerCase().trim()}`;
            countryNameToIdMap[key] = o.PRODUCTO_ID.toString();
        }
    });
    const resolvedAds = dedupedAds.map(h => {
        let prodId = h.productId;
        if (h.source === 'api' || !prodId || prodId === 'global' || prodId === '') {
            prodId = campaignToProductMap[`${h.campaignName}|${h.platform}`.toLowerCase()] || '';
        }
        if (prodId && isNaN(Number(prodId)) && prodId !== 'global' && prodId !== 'unknown') {
            const normalizedCountry = getOfficialCountryName(h.country);
            const key = `${normalizedCountry}|${prodId.toLowerCase().trim()}`;
            const mapped = countryNameToIdMap[key];
            if (mapped) prodId = mapped;
        }
        return { ...h, productId: getEffectiveProductId(prodId || 'unknown', groups) };
    });

    // Filter orders by date range
    const filteredOrders = allOrders.filter(o => {
        const d = parseDropiDate(o.FECHA);
        if (!d || d.getTime() === 0) return false;
        return d >= range.startDate && d <= range.endDate;
    });

    // Filter ads by date range
    const filteredAds = resolvedAds.filter(h => {
        const d = parseDropiDate(h.date);
        if (!d || d.getTime() === 0) return false;
        return d >= range.startDate && d <= range.endDate;
    });

    // Calculate total mapped ads
    let totalMappedAds = 0;
    filteredAds.forEach(h => {
        const cop = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, rates);
        totalMappedAds += cop;
    });

    // Current period KPIs
    const kpis = calculateKPIs(filteredOrders, totalMappedAds);

    // Previous period KPIs
    const diff = range.endDate.getTime() - range.startDate.getTime();
    const prevEndDate = new Date(range.startDate.getTime() - (24 * 60 * 60 * 1000));
    const prevStartDate = new Date(prevEndDate.getTime() - diff);

    const prevOrders = allOrders.filter(o => {
        const d = parseDropiDate(o.FECHA);
        if (!d || d.getTime() === 0) return false;
        return d >= prevStartDate && d <= prevEndDate;
    });
    const prevAdsTotal = resolvedAds.filter(h => {
        const d = parseDropiDate(h.date);
        if (!d || d.getTime() === 0) return false;
        return d >= prevStartDate && d <= prevEndDate;
    }).reduce((sum, h) => {
        const cop = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, rates);
        return sum + cop;
    }, 0);
    const prevKpis = calculateKPIs(prevOrders, prevAdsTotal);

    // Countries
    const countries = [...new Set(filteredOrders.map(o => o.country))].sort();

    // Ad platform metrics
    let fb = 0, tiktok = 0;
    filteredAds.forEach(h => {
        const cop = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, rates);
        if (h.platform === 'facebook') fb += cop;
        if (h.platform === 'tiktok') tiktok += cop;
    });

    // Metrics by country (simplified for reports)
    const metricsByCountry = countries.map(cntry => {
        const cOrders = filteredOrders.filter(o => o.country === cntry);
        const cAds = filteredAds.filter(h => isMatchingCountry(h.country, cntry))
            .reduce((s, h) => s + (h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, rates)), 0);
        const cKpis = calculateKPIs(cOrders, cAds);
        return { countryName: cntry, kpis: cKpis, products: [] };
    });

    // Daily sales data
    const dailySalesData: any[] = [];
    const dailyData: Record<string, { sales: number; orders: number; ads: number; profit: number }> = {};
    let curr = new Date(range.startDate);
    while (curr <= range.endDate) {
        const k = getLocalDateKey(curr);
        dailyData[k] = { sales: 0, orders: 0, ads: 0, profit: 0 };
        curr.setDate(curr.getDate() + 1);
    }
    const seenSalesIds: Record<string, Set<string>> = {};
    filteredOrders.forEach(o => {
        const k = getLocalDateKey(o.FECHA);
        if (dailyData[k]) {
            const orderId = o.ID?.toString() || '';
            if (!seenSalesIds[k]) seenSalesIds[k] = new Set();
            if (orderId && !seenSalesIds[k].has(orderId)) {
                seenSalesIds[k].add(orderId);
                dailyData[k].orders++;
                if (!isCancelado(o.ESTATUS)) {
                    dailyData[k].sales += (o["TOTAL DE LA ORDEN"] || 0);
                }
            }
        }
    });
    filteredAds.forEach(h => {
        const k = getLocalDateKey(h.date);
        if (dailyData[k]) {
            dailyData[k].ads += (h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, rates));
        }
    });
    Object.entries(dailyData).forEach(([date, data]) => {
        const [y, m, d] = date.split('-');
        dailySalesData.push({ date, name: `${d}/${m}`, ...data });
    });
    dailySalesData.sort((a, b) => a.date.localeCompare(b.date));

    // Berry expenses for current month
    const now = new Date();
    const monthExpenses = expenses.filter(e => e.month === (now.getMonth() + 1) && e.year === now.getFullYear());
    const berryByCategory = totalByCategory(monthExpenses);
    const berryExpenses = Object.entries(berryByCategory).map(([category, amount]) => ({ category, amount }));
    const berryExpenseTotal = berryExpenses.reduce((s, e) => s + e.amount, 0);

    // Campaign names
    const campaignNames = [...new Set(filteredAds.map(h => h.campaignName).filter((n): n is string => !!n))];

    // Products
    const productMap = new Map<string, string>();
    filteredOrders.forEach(o => {
        const id = o.PRODUCTO_ID?.toString() || 'unknown';
        if (id !== 'unknown' && o.PRODUCTO) {
            productMap.set(id, o.PRODUCTO as string);
        }
    });
    const availableProducts = Array.from(productMap.entries()).map(([id, label]) => ({ id, label }));

    // Build context
    const vegaData: VegaDataContext = {
        kpis,
        prevKpis,
        orderCount: filteredOrders.length,
        countries,
        adPlatformMetrics: { fb, tiktok, google: 0 },
        projectedProfit: 0,
        metricsByCountry,
        dateRange: range.label,
        dailySalesData,
        filteredOrders,
        availableProducts,
        filteredAds,
        logisticStats: {
            entregados: new Set(filteredOrders.filter(o => isEntregado(o.ESTATUS)).map(o => o.ID)).size,
            transito: new Set(filteredOrders.filter(o => isTransit(o.ESTATUS)).map(o => o.ID)).size,
            cancelados: new Set(filteredOrders.filter(o => isCancelado(o.ESTATUS)).map(o => o.ID)).size,
            devoluciones: new Set(filteredOrders.filter(o => isDevolucion(o.ESTATUS)).map(o => o.ID)).size,
        },
        berryExpenses,
        berryExpenseTotal,
        campaignNames,
    };

    return {
        context: buildDataContext(vegaData),
        period: range.label,
    };
}
