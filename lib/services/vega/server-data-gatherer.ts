/**
 * Vega AI - Server-Side Data Gatherer
 * Uses Firebase Admin SDK for server-side cron jobs (no React hooks, bypasses security rules)
 */

import { adminGetAllOrderFiles, adminGetAppData, adminGetAllDocs } from '@/lib/firebase/admin-helpers';
import { fetchExchangeRates, toCOP, isMatchingCountry, getCurrencyForCountry, getOfficialCountryName, normalizeCountry } from '@/lib/utils/currency';
import { deduplicateAdSpends, fixAdSpendCurrencies, type AdSpend, type AdSettings, type CampaignMapping } from '@/lib/services/marketing';
import { DropiOrder, calculateKPIs, calculateProjection } from '@/lib/calculations/kpis';
import { calculateSupplierKPIs, type SupplierKPIResults } from '@/lib/calculations/supplierKpis';
import { parseDropiDate, getLocalDateKey } from '@/lib/utils/date-parsers';
import { isCancelado, isEntregado, isTransit, isDevolucion } from '@/lib/utils/status';
import { getEffectiveProductId, getProductGroup, type ProductGroup } from '@/lib/services/productGroups';
import { totalByCategory, type Expense } from '@/lib/services/expenses';
import { buildDataContext, type VegaDataContext } from './context-builder';
import { applyPriceCorrections, type PriceCorrection } from '@/lib/services/priceCorrections';
import type { ExtendedDropiOrder } from '@/lib/hooks/useDashboardData';
import type { SupplierOrder } from '@/lib/utils/supplierParser';
import type { InventoryProduct } from '@/lib/services/supplierInventory';
import type { ReportType } from '@/lib/types/vega';

interface DateRange {
    startDate: Date;
    endDate: Date;
    label: string;
}

function getDateRangeForReport(type: ReportType): DateRange {
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    if (type === 'daily' || type === 'logistics') {
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

    if (type === 'weekly' || type === 'financial' || type === 'supplier') {
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

    if (type === 'month_close') {
        // Full PREVIOUS month (day 1 to last day)
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        const start = new Date(prevYear, prevMonth, 1);
        const end = new Date(prevYear, prevMonth + 1, 0, 23, 59, 59, 999); // last day of prev month
        const monthNames = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
        return {
            startDate: start,
            endDate: end,
            label: `${monthNames[prevMonth]} ${prevYear}`
        };
    }

    // Monthly (and fallback for other types): current month up to yesterday
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

export interface CarrierStats {
    carrier: string;
    orders: number;
    delivered: number;
    deliveryRate: number;
}

export interface PnLCascade {
    ingProveedor: number;
    ingDropshipping: number;
    ingTotal: number;
    costoTotal: number;
    gananciaBruta: number;
    fletesTotal: number;
    ads: number;
    gastosOperativos: number;
    gastosAdmin: number;
    utilidadBruta: number;
    utilidadOp: number;
    utilidadNeta: number;
    margenBruto: number;
    margenOp: number;
    margenNeto: number;
}

export interface ReportData {
    context: string;
    period: string;
    kpis: any;
    metricsByCountry: any[];
    adPlatformMetrics: { fb: number; tiktok: number; google: number };
    prevKpis: any;
    cancelReasons?: { tag: string; count: number; pct: number }[];
    supplierKpis?: SupplierKPIResults | null;
    carrierBreakdown?: CarrierStats[];
    berryExpenses?: { category: string; amount: number }[];
    berryExpenseTotal?: number;
    pnl?: PnLCascade | null;
}

function computeCarrierBreakdown(orders: ExtendedDropiOrder[]): CarrierStats[] {
    const carrierMap = new Map<string, { orders: Set<string>; delivered: Set<string> }>();
    orders.forEach(o => {
        const carrier = (o.TRANSPORTADORA as string || 'Sin transportadora').trim();
        if (!carrierMap.has(carrier)) carrierMap.set(carrier, { orders: new Set(), delivered: new Set() });
        const entry = carrierMap.get(carrier)!;
        entry.orders.add(o.ID?.toString() || '');
        if (isEntregado(o.ESTATUS)) entry.delivered.add(o.ID?.toString() || '');
    });
    return Array.from(carrierMap.entries())
        .map(([carrier, data]) => ({
            carrier,
            orders: data.orders.size,
            delivered: data.delivered.size,
            deliveryRate: data.orders.size > 0 ? (data.delivered.size / data.orders.size) * 100 : 0,
        }))
        .sort((a, b) => b.orders - a.orders);
}

export async function gatherDataForReport(type: ReportType, userId: string): Promise<ReportData> {
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
                    normalized.ORIGINAL_PRODUCTO_ID = order.PRODUCTO_ID?.toString() || '';
                    const groupByName = getProductGroup(order.PRODUCTO || '', groups);
                    const groupById = order.PRODUCTO_ID ? getProductGroup(order.PRODUCTO_ID.toString(), groups) : null;
                    normalized.PRODUCTO_ID = groupByName?.id || groupById?.id || order.PRODUCTO_ID?.toString() || order.PRODUCTO || 'unknown';
                    allOrders.push(normalized);
                });
            }
        });
    }

    // Consolidate product IDs: some Dropi rows have empty PRODUCTO_ID,
    // causing fallback to the product NAME as ID. If another order with
    // the same product name has a real numeric ID, use that instead.
    const nameToRealId = new Map<string, string>();
    allOrders.forEach(o => {
        const name = (o.PRODUCTO as string || '').toLowerCase().trim();
        const id = o.PRODUCTO_ID?.toString() || '';
        const key = `${o.country}|${name}`;
        if (name && id && id.toLowerCase().trim() !== name) {
            nameToRealId.set(key, id);
        }
    });
    allOrders.forEach(o => {
        const id = o.PRODUCTO_ID?.toString() || '';
        const name = (o.PRODUCTO as string || '').toLowerCase().trim();
        const key = `${o.country}|${name}`;
        if (name && id && id.toLowerCase().trim() === name) {
            const realId = nameToRealId.get(key);
            if (realId) {
                o.PRODUCTO_ID = realId;
            }
        }
    });

    // Apply price corrections (matching dashboard useDashboardData.ts line 183)
    applyPriceCorrections(allOrders, priceCorrections);

    // Resolve ads (dedup + campaign mapping + name-ID conversion)
    const dedupedAds = deduplicateAdSpends(ads);
    const campaignToProductMap: Record<string, string> = {};
    mappings.forEach(m => {
        campaignToProductMap[`${m.campaignName}|${m.platform}`.toLowerCase()] = m.productId;
    });
    // Build lookup: any product reference (name, original ID, normalized ID) → normalized PRODUCTO_ID
    const productIdLookup: Record<string, string> = {};
    allOrders.forEach(o => {
        const normalizedId = o.PRODUCTO_ID?.toString() || '';
        if (!normalizedId) return;
        const cntry = o.country;
        if (o.PRODUCTO) {
            productIdLookup[`${cntry}|${(o.PRODUCTO as string).toLowerCase().trim()}`] = normalizedId;
        }
        const origId = o.ORIGINAL_PRODUCTO_ID;
        if (origId && origId !== normalizedId) {
            productIdLookup[`${cntry}|${origId.toLowerCase().trim()}`] = normalizedId;
        }
        productIdLookup[`${cntry}|${normalizedId.toLowerCase().trim()}`] = normalizedId;
    });
    const resolvedAds = dedupedAds.map(h => {
        let prodId = h.productId;
        if (h.source === 'api' || !prodId || prodId === 'global' || prodId === '') {
            prodId = campaignToProductMap[`${h.campaignName}|${h.platform}`.toLowerCase()] || '';
        }
        if (prodId && prodId !== 'global' && prodId !== 'unknown') {
            const normalizedCountry = getOfficialCountryName(h.country);
            const mapped = productIdLookup[`${normalizedCountry}|${prodId.toLowerCase().trim()}`];
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
    const google = 0; // Google Ads not yet integrated

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
    const seenOrderIds: Record<string, Set<string>> = {};
    filteredOrders.forEach(o => {
        const k = getLocalDateKey(o.FECHA);
        if (dailyData[k]) {
            const orderId = o.ID?.toString() || '';
            if (!seenOrderIds[k]) seenOrderIds[k] = new Set();
            // Order count: deduplicate by ID
            if (orderId && !seenOrderIds[k].has(orderId)) {
                seenOrderIds[k].add(orderId);
                dailyData[k].orders++;
            }
            // Sales: sum all lines (TOTAL DE LA ORDEN is subtotal per product line)
            if (!isCancelado(o.ESTATUS)) {
                dailyData[k].sales += (o["TOTAL DE LA ORDEN"] || 0);
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

    // Loss streak calculation (daily reports only)
    if (type === 'daily') {
        // Look at last 7 days to find consecutive loss days per product
        const streakDays = 7;
        const today = new Date();
        const streakDates: string[] = [];
        for (let d = 1; d <= streakDays; d++) {
            const dt = new Date(today);
            dt.setDate(dt.getDate() - d);
            streakDates.push(getLocalDateKey(dt));
        }
        // streakDates[0] = yesterday, [1] = day before, etc.

        metricsByCountry.forEach(c => {
            const cSettings = projectionSettings?.countries?.[c.countryName];
            const pOverrides: Record<string, number> = projectionSettings?.products?.[c.countryName] || {};
            const defaultDP = cSettings?.delivery_percent ?? 80;
            const buffer = cSettings?.buffer ?? 1.4;

            c.products.forEach((p: any) => {
                let streak = 0;
                for (const dateKey of streakDates) {
                    const dayOrders = allOrders.filter(o =>
                        o.country === c.countryName &&
                        (o.PRODUCTO_ID?.toString() || 'unknown') === p.id &&
                        getLocalDateKey(o.FECHA) === dateKey
                    );
                    const dayAds = resolvedAds.filter(h =>
                        getLocalDateKey(h.date) === dateKey &&
                        h.productId === p.id
                    ).reduce((s, h) => s + (h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, rates)), 0);

                    if (dayOrders.length === 0 && dayAds === 0) break; // No activity = end streak check
                    const pDP = pOverrides[p.id] !== undefined ? pOverrides[p.id] : defaultDP;
                    const proj = calculateProjection(dayOrders, 'PRODUCTO_ID', { [p.id]: pDP }, buffer, { [p.id]: dayAds });
                    const dayUtil = dayOrders.length === 0 ? -dayAds : proj.reduce((s, x) => s + x.utilidad, 0);
                    if (dayUtil < 0) streak++;
                    else break; // Streak broken
                }
                p.lossStreak = streak;
            });
        });
    }

    // ── Supplier data (for supplier/financial/month_close reports) ──
    let supplierKpis: SupplierKPIResults | null = null;
    if (['supplier', 'month_close', 'financial'].includes(type)) {
        try {
            const [supplierFilesRaw, supplierInventory] = await Promise.all([
                adminGetAllDocs('supplier_order_files', userId),
                adminGetAppData<InventoryProduct[]>('supplier_inventory', userId).then(d => Array.isArray(d) ? d : []),
            ]);

            // Flatten supplier orders and filter by date range
            const allSupplierOrders: SupplierOrder[] = [];
            if (Array.isArray(supplierFilesRaw)) {
                supplierFilesRaw.forEach((file: any) => {
                    if (file.orders && Array.isArray(file.orders)) {
                        file.orders.forEach((order: any) => {
                            allSupplierOrders.push(order as SupplierOrder);
                        });
                    }
                });
            }
            const filteredSupplierOrders = allSupplierOrders.filter(o => {
                const d = parseDropiDate(o.FECHA);
                if (!d || d.getTime() === 0) return false;
                return d >= range.startDate && d <= range.endDate;
            });

            supplierKpis = calculateSupplierKPIs(filteredSupplierOrders, supplierInventory);
        } catch (err) {
            console.error('Error fetching supplier data:', err);
        }
    }

    // ── Carrier breakdown (for logistics/month_close reports) ──
    let carrierBreakdown: CarrierStats[] | undefined;
    if (['logistics', 'month_close'].includes(type)) {
        carrierBreakdown = computeCarrierBreakdown(filteredOrders);
    }

    // ── Cancel reasons (from kpis) ──
    const cancelReasons = kpis.cancelReasons;

    // ── P&L cascade (for financial/month_close reports) ──
    let pnl: PnLCascade | null = null;
    if (['financial', 'month_close'].includes(type)) {
        const sIng = supplierKpis?.ingreso_proveedor ?? 0;
        const vIng = kpis.ing_real ?? 0;
        const ingTotal = sIng + vIng;

        const sCosto = supplierKpis?.costo_interno ?? 0;
        const vCpr = kpis.cpr ?? 0;
        const costoTotal = sCosto + vCpr;
        const gananciaBruta = ingTotal - costoTotal;

        // Fletes (only from sales/dropshipping)
        const vFlEnt = kpis.fl_ent ?? 0;
        const vFlDev = kpis.fl_dev ?? 0;
        const vFlTra = kpis.fl_tra ?? 0;
        const fletesTotal = vFlEnt + vFlDev + vFlTra;

        const vAds = kpis.g_ads ?? 0;

        // Expenses by category
        const OPERATIONAL_CATS = ['Nómina', 'Fullfilment', 'Envíos', 'Aplicaciones', 'Costos Bodega', 'Garantías'];
        const ADMIN_CATS = ['Servicios', 'Gastos Bancarios', 'Impuestos', 'Inversiones', 'Otros Gastos', 'Pendiente'];
        const berryByCat = totalByCategory(
            expenses.filter(e => {
                // For month_close: use previous month; for financial: current month
                if (type === 'month_close') {
                    const prevMonth = new Date().getMonth() === 0 ? 12 : new Date().getMonth();
                    const prevYear = new Date().getMonth() === 0 ? new Date().getFullYear() - 1 : new Date().getFullYear();
                    return e.month === prevMonth && e.year === prevYear;
                }
                return e.month === (new Date().getMonth() + 1) && e.year === new Date().getFullYear();
            })
        );
        const gastosOperativos = OPERATIONAL_CATS.reduce((s, c) => s + (berryByCat[c] || 0), 0);
        const knownCats = new Set([...OPERATIONAL_CATS, ...ADMIN_CATS, 'Marketing']);
        const gastosAdmin = ADMIN_CATS.reduce((s, c) => s + (berryByCat[c] || 0), 0)
            + Object.entries(berryByCat).filter(([cat]) => !knownCats.has(cat)).reduce((s, [, v]) => s + v, 0);

        const utilidadBruta = gananciaBruta - fletesTotal - vAds;
        const utilidadOp = utilidadBruta - gastosOperativos;
        const utilidadNeta = utilidadOp - gastosAdmin;
        const margenBruto = ingTotal > 0 ? (gananciaBruta / ingTotal) * 100 : 0;
        const margenOp = ingTotal > 0 ? (utilidadOp / ingTotal) * 100 : 0;
        const margenNeto = ingTotal > 0 ? (utilidadNeta / ingTotal) * 100 : 0;

        pnl = {
            ingProveedor: sIng, ingDropshipping: vIng, ingTotal,
            costoTotal, gananciaBruta, fletesTotal, ads: vAds,
            gastosOperativos, gastosAdmin,
            utilidadBruta, utilidadOp, utilidadNeta,
            margenBruto, margenOp, margenNeto,
        };
    }

    // Build context
    const vegaData: VegaDataContext = {
        kpis,
        prevKpis,
        orderCount: filteredOrders.length,
        countries,
        adPlatformMetrics: { fb, tiktok, google },
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
        adPlatformMetrics: { fb, tiktok, google },
        prevKpis,
        cancelReasons,
        supplierKpis,
        carrierBreakdown,
        berryExpenses,
        berryExpenseTotal,
        pnl,
    };
}
