/**
 * Vega AI - Server-Side Data Gatherer
 * Uses Firebase Admin SDK for server-side cron jobs (no React hooks, bypasses security rules)
 */

import { adminGetAllOrderFiles, adminGetAppData, adminGetAllDocs } from '@/lib/firebase/admin-helpers';
import { fetchExchangeRates, toCOP, isMatchingCountry, getCurrencyForCountry, getOfficialCountryName, normalizeCountry } from '@/lib/utils/currency';
import { deduplicateAdSpends, fixAdSpendCurrencies, type AdSpend, type AdSettings, type CampaignMapping } from '@/lib/services/marketing';
import { DropiOrder, calculateKPIs, calculateProjection } from '@/lib/calculations/kpis';
import { parseDropiDate, getLocalDateKey } from '@/lib/utils/date-parsers';
import { isCancelado, isEntregado, isTransit, isDevolucion } from '@/lib/utils/status';
import { getEffectiveProductId, getProductGroup, type ProductGroup } from '@/lib/services/productGroups';
import { totalByCategory, type Expense } from '@/lib/services/expenses';
import { buildDataContext, type VegaDataContext } from './context-builder';
import { applyPriceCorrections, type PriceCorrection } from '@/lib/services/priceCorrections';
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

export interface ReportData {
    context: string;
    period: string;
    kpis: any;
    metricsByCountry: any[];
}

export async function gatherDataForReport(type: 'daily' | 'weekly' | 'monthly', userId: string): Promise<ReportData> {
    if (!userId) throw new Error("userId is required for gatherDataForReport");
    const range = getDateRangeForReport(type);

    // Parallel fetch all data via Admin SDK (server-side, bypasses security rules)
    const [ordersData, rates, adsRaw, adSettings, mappingsRaw, groups, expensesRaw, projectionSettings, priceCorrections] = await Promise.all([
        adminGetAllOrderFiles(userId),
        fetchExchangeRates(),
        adminGetAllDocs('marketing_history', userId) as Promise<any[]>,
        adminGetAppData<AdSettings>('ad_settings', userId),
        adminGetAppData<any>('campaign_mappings', userId),
        adminGetAppData<ProductGroup[]>('product_groups', userId).then(d => Array.isArray(d) ? d : []),
        adminGetAppData<Expense[]>('expenses', userId).then(d => Array.isArray(d) ? d : []),
        adminGetAppData<any>('projection_settings', userId),
        adminGetAppData<PriceCorrection[]>('price_corrections', userId).then(d => Array.isArray(d) ? d : []),
    ]);

    // Process raw ads through same pipeline as client-side
    const ads: AdSpend[] = fixAdSpendCurrencies(
        (adsRaw || []).map((d: any) => ({ ...d } as AdSpend)).sort((a: AdSpend, b: AdSpend) => (b.date || '').localeCompare(a.date || '')),
        adSettings
    );

    // Process campaign mappings (support legacy dictionary format)
    let mappings: CampaignMapping[] = [];
    if (mappingsRaw) {
        if (Array.isArray(mappingsRaw)) {
            mappings = mappingsRaw;
        } else if (typeof mappingsRaw === 'object') {
            Object.entries(mappingsRaw).forEach(([productId, campaigns]) => {
                if (Array.isArray(campaigns)) {
                    (campaigns as string[]).forEach(campaignName => {
                        mappings.push({ campaignName, productId, platform: 'facebook', updatedAt: Date.now() });
                    });
                }
            });
        }
    }

    const expenses: Expense[] = expensesRaw || [];

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

    // Apply price corrections (matching dashboard useDashboardData.ts line 183)
    applyPriceCorrections(allOrders, priceCorrections);

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
    // utilidad_proyectada will be set after metricsByCountry is computed (needs calculateProjection)

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

    // Build adsByCountryProduct (matching dashboard useDashboardData.ts lines 339-417 exactly)
    const adsByCountryProduct: Record<string, Record<string, number>> = {};
    let sharedGlobalSpend = 0;
    const countryGlobalSpends: Record<string, number> = {};

    filteredAds.forEach(h => {
        const amountCOP = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, rates);
        if (!h.productId || h.productId === 'unmapped' || h.productId === '' || h.productId === 'unknown') return;

        const isGlobalPid = h.productId === 'global';
        const isSharedCountry = normalizeCountry(h.country) === 'desconocido' || normalizeCountry(h.country) === 'todos';

        if (isGlobalPid && isSharedCountry) {
            sharedGlobalSpend += amountCOP;
            return;
        }

        if (isSharedCountry && !isGlobalPid) {
            const targetCountries = countries.filter(c => {
                return allOrders.some(o => o.country === c && (o.PRODUCTO_ID?.toString() === h.productId || getEffectiveProductId(o.PRODUCTO_ID?.toString() || '', groups) === h.productId));
            });
            const targets = targetCountries.length > 0 ? targetCountries : countries;
            const splitAmount = amountCOP / targets.length;
            targets.forEach(c => {
                if (!adsByCountryProduct[c]) adsByCountryProduct[c] = {};
                adsByCountryProduct[c][h.productId] = (adsByCountryProduct[c][h.productId] || 0) + splitAmount;
            });
            return;
        }

        const matchedCountry = countries.find(c => isMatchingCountry(h.country, c));
        if (!matchedCountry) return;

        if (isGlobalPid) {
            countryGlobalSpends[matchedCountry] = (countryGlobalSpends[matchedCountry] || 0) + amountCOP;
            return;
        }

        // Map NAME-based ad spend to existing ORDER-based IDs
        let effectivePid = h.productId;
        if (effectivePid && isNaN(Number(effectivePid))) {
            const matchingOrder = allOrders.find(o =>
                o.country === matchedCountry &&
                (o.PRODUCTO || '').toString().toLowerCase().trim() === effectivePid.toLowerCase().trim() && o.PRODUCTO_ID
            );
            if (matchingOrder && matchingOrder.PRODUCTO_ID) {
                effectivePid = matchingOrder.PRODUCTO_ID.toString();
            }
        }

        if (!adsByCountryProduct[matchedCountry]) adsByCountryProduct[matchedCountry] = {};
        adsByCountryProduct[matchedCountry][effectivePid] = (adsByCountryProduct[matchedCountry][effectivePid] || 0) + amountCOP;
    });

    // Distribute shared global spend across all countries
    if (countries.length > 0 && sharedGlobalSpend > 0) {
        const split = sharedGlobalSpend / countries.length;
        countries.forEach(c => {
            countryGlobalSpends[c] = (countryGlobalSpends[c] || 0) + split;
        });
    }

    // Distribute country-level global spend proportionally across products that already have direct ad spend
    countries.forEach(cntry => {
        const globalSpend = countryGlobalSpends[cntry] || 0;
        if (globalSpend > 0) {
            const existingPids = Object.keys(adsByCountryProduct[cntry] || {});
            if (existingPids.length > 0) {
                const cntryOrders = filteredOrders.filter(o => o.country === cntry);
                const mappedOrders = cntryOrders.filter(o => existingPids.includes(o.PRODUCTO_ID?.toString() || ''));
                const totalMapped = mappedOrders.length || 1;
                existingPids.forEach(pid => {
                    const pOrdersCount = mappedOrders.filter(o => o.PRODUCTO_ID?.toString() === pid).length || 1;
                    adsByCountryProduct[cntry][pid] = (adsByCountryProduct[cntry][pid] || 0) + (globalSpend * (pOrdersCount / totalMapped));
                });
            }
        }
    });

    // Metrics by country with per-product breakdown (matching dashboard exactly)
    const metricsByCountry = countries.map(cntry => {
        const cOrders = filteredOrders.filter(o => o.country === cntry);
        const cntryAds = adsByCountryProduct[cntry] || {};
        const cAds = Object.values(cntryAds).reduce((sum, val) => sum + val, 0);
        const cKpis = calculateKPIs(cOrders, cAds);

        // Get projection settings for this country (same as dashboard)
        const cSettings = projectionSettings?.countries?.[cntry];
        const pOverrides: Record<string, number> = projectionSettings?.products?.[cntry] || {};
        const defaultDeliveryPercent = cSettings?.delivery_percent ?? 80;
        const buffer = cSettings?.buffer ?? 1.4;

        // Iterate over product IDs from both orders AND ads (matching dashboard line 587)
        const pids = new Set([
            ...cOrders.map(o => o.PRODUCTO_ID?.toString() || 'unknown'),
            ...Object.keys(cntryAds),
        ]);

        const products = Array.from(pids).map(pid => {
            const pOrders = cOrders.filter(o => (o.PRODUCTO_ID?.toString() || 'unknown') === pid);
            const pAds = cntryAds[pid] || 0;
            const pKpis = calculateKPIs(pOrders, pAds);

            const ids = new Set(pOrders.map(o => o.ID));
            const n_ord = ids.size;
            const n_ent = new Set(pOrders.filter(o => isEntregado(o.ESTATUS)).map(o => o.ID)).size;
            const n_can = new Set(pOrders.filter(o => isCancelado(o.ESTATUS)).map(o => o.ID)).size;
            const n_dev = new Set(pOrders.filter(o => isDevolucion(o.ESTATUS)).map(o => o.ID)).size;
            const n_tra = new Set(pOrders.filter(o => isTransit(o.ESTATUS)).map(o => o.ID)).size;
            const n_nc = n_ord - n_can;
            const n_dispatched = n_ent + n_dev;

            // CPA = Ads / Non-canceled (same as dashboard GlobalSummary.tsx line 24)
            const cpa = n_nc > 0 ? pAds / n_nc : 0;
            // CPA Despachado = Ads / (Entregados + Devoluciones)
            const cpaDesp = n_dispatched > 0 ? pAds / n_dispatched : 0;

            // Calculate projection per-product individually (matching dashboard useDashboardData.ts line 599)
            const pDeliveryRate = pOverrides[pid] !== undefined ? pOverrides[pid] : defaultDeliveryPercent;
            const pproj = calculateProjection(pOrders, 'PRODUCTO_ID', { [pid]: pDeliveryRate }, buffer, { [pid]: pAds });
            const baseProj = pproj.reduce((s, p) => s + p.utilidad, 0);
            // If no orders but has ads, projected profit is negative (pure loss)
            const utilProy = pOrders.length === 0 ? -pAds : baseProj;

            const name = pOrders[0]?.PRODUCTO?.toString() || pid;
            return {
                id: pid, name, n_ord, n_ent, n_can, n_dev, n_tra, n_nc,
                tasa_ent: pKpis.tasa_ent, ing: pKpis.ing_real, cpr: pKpis.cpr, ads: pAds,
                cpa, cpaDesp, utilReal: pKpis.u_real, utilProy,
            };
        }).filter(p => p.n_ord > 0 || p.ads > 0).sort((a, b) => b.n_ord - a.n_ord);

        return { countryName: cntry, kpis: cKpis, products };
    });

    // Set global utilidad proyectada = sum of all product projections across countries
    kpis.utilidad_proyectada = metricsByCountry.reduce((sum, c) =>
        sum + c.products.reduce((s: number, p: any) => s + (p.utilProy || 0), 0), 0);

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
        kpis,
        metricsByCountry,
    };
}
