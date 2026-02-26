'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { getAllOrderFiles, getAppData, setAppData } from '@/lib/firebase/firestore';
import { fetchExchangeRates, ExchangeRates, toCOP, isMatchingCountry, getCurrencyForCountry, normalizeCountry, getOfficialCountryName } from '@/lib/utils/currency';
import { getAdSettings, AdSpend, listAllAdSpends, getCampaignMappings, CampaignMapping, deduplicateAdSpends } from '@/lib/services/marketing';
import { DropiOrder, calculateKPIs, KPIResults, calculateProjection, ProjectionResult } from '@/lib/calculations/kpis';
import { parseDropiDate, getLocalDateKey, getStartDateForRange, getEndDateForRange } from '@/lib/utils/date-parsers';
import { isEntregado, isCancelado, isTransit, isDevolucion } from '@/lib/utils/status';
import { getProductGroups, ProductGroup, getEffectiveProductId, getProductGroup } from '@/lib/services/productGroups';
import { getPriceCorrections, savePriceCorrection as savePriceCorrectionService, deletePriceCorrection as deletePriceCorrectionService, applyPriceCorrections, PriceCorrection } from '@/lib/services/priceCorrections';
import { useGlobalFilters } from '@/lib/context/FilterContext';
import { useAuth } from '@/lib/context/AuthContext';
import { resolveProductName } from '@/lib/services/productResolution';

// Extend DropiOrder to include country, which is lost after flattening the firestore response
export interface ExtendedDropiOrder extends DropiOrder {
    country: string;
}

// ─── Session-level data cache (survives navigation, cleared on reload) ───
interface DashboardCache {
    uid: string;
    timestamp: number;
    orders: ExtendedDropiOrder[];
    rates: ExchangeRates;
    ads: AdSpend[];
    mappings: CampaignMapping[];
    groups: ProductGroup[];
    projectionSettings: any;
    priceCorrections: PriceCorrection[];
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let dashboardCache: DashboardCache | null = null;

/** Call after importing data or making changes that should refresh the dashboard */
export function invalidateDashboardCache() {
    dashboardCache = null;
}

/** Access the session-level dashboard cache (shared with useCountryData for consistency) */
export function getDashboardCache(): DashboardCache | null {
    if (dashboardCache && Date.now() - dashboardCache.timestamp < CACHE_TTL) {
        return dashboardCache;
    }
    return null;
}

export interface DashboardDataHook {
    loading: boolean;
    error: string | null;
    rawOrders: ExtendedDropiOrder[];
    rawOrdersCount: number;
    invalidDatesCount: number;

    // Filters
    dateRange: string;
    setDateRange: (r: string) => void;
    country: string;
    setCountry: (c: string) => void;
    product: string;
    setProduct: (p: string) => void;
    startDateCustom: string;
    setStartDateCustom: (s: string) => void;
    endDateCustom: string;
    setEndDateCustom: (s: string) => void;

    // Data Options
    availableCountries: string[];
    availableProducts: { id: string; label: string }[];

    // Computed Data
    filteredOrders: ExtendedDropiOrder[];
    kpis: (KPIResults & { cpaFacebook?: number }) | null;
    prevKpis: KPIResults | null;
    logisticStats: { entregados: number; transito: number; cancelados: number; devoluciones: number };
    adPlatformMetrics: { fb: number; tiktok: number; google: number };
    dailySalesData: any[]; // Trends chart data
    productPerformanceData: any[]; // Product comparison chart data
    projectedProfit: number;
    metricsByCountry: any[];
    unmappedAdSpend: number;
    rawDatesSample: string[];

    // Shared data
    exchangeRates: ExchangeRates;
    filteredAds: AdSpend[];
    campaignMappings: CampaignMapping[];
    // Projections
    projectionSettings: any;
    saveProjectionSettings: (newSettings: any, userEmail: string) => Promise<void>;
    // Price Corrections
    priceCorrections: PriceCorrection[];
    savePriceCorrection: (correction: PriceCorrection) => Promise<void>;
    deletePriceCorrection: (id: string) => Promise<void>;
}

export function useDashboardData(): DashboardDataHook {
    const { effectiveUid } = useAuth();
    // State
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [rawOrders, setRawOrders] = useState<ExtendedDropiOrder[]>([]);
    const [exchangeRates, setExchangeRates] = useState<ExchangeRates>({ COP_USD: 4200, COP_GTQ: 540, timestamp: 0 });
    const [adSpends, setAdSpends] = useState<AdSpend[]>([]);
    const [campaignMappings, setCampaignMappings] = useState<CampaignMapping[]>([]);
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [projectionSettings, setProjectionSettings] = useState<any>(null);
    const [savingProjection, setSavingProjection] = useState(false);
    const [priceCorrections, setPriceCorrections] = useState<PriceCorrection[]>([]);

    // Global Filter State
    const {
        dateRange, setDateRange,
        startDateCustom, setStartDateCustom,
        endDateCustom, setEndDateCustom,
        selectedCountry: country, setSelectedCountry: setCountry,
        selectedProduct: product, setSelectedProduct: setProduct
    } = useGlobalFilters();

    // Load Initial Data (with session cache)
    useEffect(() => {
        if (!effectiveUid) return;

        async function loadData() {
            const uid = effectiveUid!;

            // Check session cache
            if (dashboardCache && dashboardCache.uid === uid && Date.now() - dashboardCache.timestamp < CACHE_TTL) {
                setRawOrders(dashboardCache.orders);
                setExchangeRates(dashboardCache.rates);
                setAdSpends(dashboardCache.ads);
                setCampaignMappings(dashboardCache.mappings);
                setProductGroups(dashboardCache.groups);
                setProjectionSettings(dashboardCache.projectionSettings);
                setPriceCorrections(dashboardCache.priceCorrections);
                setLoading(false);
                return;
            }

            setLoading(true);
            try {
                // Parallel fetch — uses effectiveUid (team_id) so team members share data
                const [ordersData, rates, ads, mappings, groups, savedSettings, corrections] = await Promise.all([
                    getAllOrderFiles(uid),
                    fetchExchangeRates(),
                    listAllAdSpends(uid),
                    getCampaignMappings(uid),
                    getProductGroups(uid),
                    getAppData('projection_settings', uid),
                    getPriceCorrections(uid)
                ]);

                // Flatten orders and attach country from each file
                const flattenedOrders: ExtendedDropiOrder[] = [];

                if (Array.isArray(ordersData)) {
                    ordersData.forEach((file: any) => {
                        if (file.orders && Array.isArray(file.orders)) {
                            const cntry = getOfficialCountryName(file.country || 'Desconocido');
                            const currency = getCurrencyForCountry(cntry);
                            file.orders.forEach((order: DropiOrder) => {
                                const normalized = { ...order, country: cntry } as ExtendedDropiOrder;
                                // Convert all financial fields to COP (matching Log Pose)
                                normalized["TOTAL DE LA ORDEN"] = toCOP(order["TOTAL DE LA ORDEN"], currency, rates);
                                if (order["PRECIO PROVEEDOR"]) normalized["PRECIO PROVEEDOR"] = toCOP(order["PRECIO PROVEEDOR"], currency, rates);
                                if (order["PRECIO PROVEEDOR X CANTIDAD"]) normalized["PRECIO PROVEEDOR X CANTIDAD"] = toCOP(order["PRECIO PROVEEDOR X CANTIDAD"], currency, rates);
                                if (order["PRECIO FLETE"]) normalized["PRECIO FLETE"] = toCOP(order["PRECIO FLETE"], currency, rates);
                                if (order["COSTO DEVOLUCION FLETE"]) normalized["COSTO DEVOLUCION FLETE"] = toCOP(order["COSTO DEVOLUCION FLETE"], currency, rates);
                                if (order.GANANCIA) normalized.GANANCIA = toCOP(order.GANANCIA, currency, rates);
                                // Resolve product group (matching Log Pose)
                                const groupByName = getProductGroup(order.PRODUCTO || '', groups);
                                const groupById = order.PRODUCTO_ID ? getProductGroup(order.PRODUCTO_ID.toString(), groups) : null;
                                normalized.PRODUCTO_ID = groupByName?.id || groupById?.id || order.PRODUCTO_ID?.toString() || order.PRODUCTO || 'unknown';
                                flattenedOrders.push(normalized);
                            });
                        }
                    });
                }

                // Apply price corrections after currency conversion
                applyPriceCorrections(flattenedOrders, corrections);

                // Save to session cache
                dashboardCache = {
                    uid,
                    timestamp: Date.now(),
                    orders: flattenedOrders,
                    rates,
                    ads,
                    mappings,
                    groups,
                    projectionSettings: savedSettings,
                    priceCorrections: corrections,
                };

                setRawOrders(flattenedOrders);
                setExchangeRates(rates);
                setAdSpends(ads);
                setCampaignMappings(mappings);
                setProductGroups(groups);
                setProjectionSettings(savedSettings);
                setPriceCorrections(corrections);
            } catch (err: any) {
                console.error("Error loading dashboard data:", err);
                setError(err.message || 'Error loading dashboard data');
            } finally {
                setLoading(false);
            }
        }

        loadData();
    }, [effectiveUid]);

    // 1. Date Limits & Filtering Logic
    const dateLimits = useMemo(() => {
        let start = getStartDateForRange(dateRange);
        let end = getEndDateForRange(dateRange);
        if (dateRange === 'Personalizado' && startDateCustom && endDateCustom) {
            start = new Date(startDateCustom + 'T00:00:00');
            end = new Date(endDateCustom + 'T23:59:59');
        }
        return { startDate: start, endDate: end };
    }, [dateRange, startDateCustom, endDateCustom]);

    // 2. Filter Orders
    const { filteredOrders, invalidDatesCount } = useMemo(() => {
        let invalid = 0;
        const filtered = rawOrders.filter(o => {
            // Country Filter
            if (country !== 'Todos' && !isMatchingCountry(o.country, country)) return false;

            // Product Filter
            if (product !== 'Todos') {
                const effectiveId = o.PRODUCTO_ID?.toString() || 'unknown';
                const productGroup = getProductGroup(o.PRODUCTO || '', productGroups);
                if (effectiveId !== product && productGroup?.id !== product && o.PRODUCTO !== product) return false;
            }

            // Date Filter
            const d = parseDropiDate(o.FECHA);
            if (!d) {
                invalid++;
                return false;
            }

            return d >= dateLimits.startDate && d <= dateLimits.endDate;
        });

        return { filteredOrders: filtered, invalidDatesCount: invalid };
    }, [rawOrders, country, product, dateLimits, productGroups]);

    // 3. Resolve Ads (dedup + campaign mapping + ID conversion - matching Log Pose)
    const resolvedAds = useMemo(() => {
        const dedupedByService = deduplicateAdSpends(adSpends);

        // Build campaign → product mapping
        const campaignToProductMap: Record<string, string> = {};
        campaignMappings.forEach(m => {
            campaignToProductMap[`${m.campaignName}|${m.platform}`.toLowerCase()] = m.productId;
        });

        // Build Name → ID map from orders
        const countryNameToIdMap: Record<string, string> = {};
        rawOrders.forEach(o => {
            if (o.PRODUCTO && o.PRODUCTO_ID) {
                const key = `${o.country}|${(o.PRODUCTO as string).toLowerCase().trim()}`;
                countryNameToIdMap[key] = o.PRODUCTO_ID.toString();
            }
        });

        return dedupedByService.map(h => {
            let prodId = h.productId;
            if (h.source === 'api' || !prodId || prodId === 'global' || prodId === '') {
                prodId = campaignToProductMap[`${h.campaignName}|${h.platform}`.toLowerCase()] || '';
            }
            // Convert name-based IDs to numeric IDs
            if (prodId && isNaN(Number(prodId)) && prodId !== 'global' && prodId !== 'unknown') {
                const normalizedCountry = getOfficialCountryName(h.country);
                const key = `${normalizedCountry}|${prodId.toLowerCase().trim()}`;
                const mapped = countryNameToIdMap[key];
                if (mapped) prodId = mapped;
            }
            return {
                ...h,
                productId: getEffectiveProductId(prodId || 'unknown', productGroups)
            };
        });
    }, [adSpends, campaignMappings, productGroups, rawOrders]);

    // 3b. Filter resolved ads by date
    const filteredAds = useMemo(() => {
        return resolvedAds.filter(h => {
            // Date Filter
            const d = parseDropiDate(h.date);
            if (!d) return false;
            if (d < dateLimits.startDate || d > dateLimits.endDate) return false;

            // Country Filter
            if (country !== 'Todos' && !isMatchingCountry(h.country, country)) return false;

            // Product Filter
            if (product !== 'Todos' && h.productId !== product) return false;

            return true;
        });
    }, [resolvedAds, dateLimits, country, product]);

    // 4. Available Countries & Products
    const availableCountries = useMemo(() => {
        const countries = new Set<string>();
        rawOrders.forEach(o => countries.add(o.country));
        return ['Todos', ...Array.from(countries).sort()];
    }, [rawOrders]);

    const availableProducts = useMemo(() => {
        const productMap = new Map<string, string>();
        // Filter source orders by selected country so product list is country-aware
        const sourceOrders = country !== 'Todos'
            ? rawOrders.filter(o => isMatchingCountry(o.country, country))
            : rawOrders;
        sourceOrders.forEach(o => {
            const id = o.PRODUCTO_ID?.toString() || 'unknown';
            if (id !== 'unknown' && o.PRODUCTO) {
                // PRODUCTO_ID is already resolved to group ID during normalization,
                // so check directly if the ID matches a group
                const groupById = productGroups.find(g => g.id === id);
                if (groupById) {
                    productMap.set(groupById.id, groupById.name);
                } else {
                    productMap.set(id, o.PRODUCTO);
                }
            }
        });
        const products = Array.from(productMap.entries()).map(([id, label]) => ({ id, label })).sort((a, b) => a.label.localeCompare(b.label));
        return [{ id: 'Todos', label: 'Todos' }, ...products];
    }, [rawOrders, productGroups, country]);

    // 5. Aggregate Ads by Country and Product - ALIGNED WITH LOG POSE
    const adsByCountryProduct = useMemo(() => {
        const result: Record<string, Record<string, number>> = {};
        let sharedGlobalSpend = 0;
        const countryGlobalSpends: Record<string, number> = {};

        filteredAds.forEach(h => {
            const amountCOP = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, exchangeRates);
            if (!h.productId || h.productId === 'unmapped' || h.productId === '' || h.productId === 'unknown') return;

            const isGlobalPid = h.productId === 'global';
            const isSharedCountry = normalizeCountry(h.country) === 'desconocido' || normalizeCountry(h.country) === 'todos';

            if (isGlobalPid && isSharedCountry) {
                sharedGlobalSpend += amountCOP;
                return;
            }

            if (isSharedCountry && !isGlobalPid) {
                const allCntries = availableCountries.filter(c => c !== 'Todos');
                const targetCountries = allCntries.filter(c => {
                    return rawOrders.some(o => o.country === c && (o.PRODUCTO_ID?.toString() === h.productId || getEffectiveProductId(o.PRODUCTO_ID?.toString() || '', productGroups) === h.productId));
                });
                const targets = targetCountries.length > 0 ? targetCountries : allCntries;
                const splitAmount = amountCOP / targets.length;
                targets.forEach(c => {
                    if (!result[c]) result[c] = {};
                    result[c][h.productId] = (result[c][h.productId] || 0) + splitAmount;
                });
                return;
            }

            const matchedCountry = availableCountries.find(c => isMatchingCountry(h.country, c));
            if (!matchedCountry) return;

            if (isGlobalPid) {
                countryGlobalSpends[matchedCountry] = (countryGlobalSpends[matchedCountry] || 0) + amountCOP;
                return;
            }

            // Map NAME-based ad spend to existing ORDER-based IDs (matching Log Pose)
            let effectivePid = h.productId;
            if (effectivePid && isNaN(Number(effectivePid))) {
                const matchingOrder = rawOrders.find(o =>
                    o.country === matchedCountry &&
                    (o.PRODUCTO || '').toLowerCase().trim() === effectivePid.toLowerCase().trim() && o.PRODUCTO_ID
                );
                if (matchingOrder && matchingOrder.PRODUCTO_ID) {
                    effectivePid = matchingOrder.PRODUCTO_ID.toString();
                }
            }

            if (!result[matchedCountry]) result[matchedCountry] = {};
            result[matchedCountry][effectivePid] = (result[matchedCountry][effectivePid] || 0) + amountCOP;
        });

        const activeCountries = availableCountries.filter(c => c !== 'Todos');
        if (activeCountries.length > 0 && sharedGlobalSpend > 0) {
            const split = sharedGlobalSpend / activeCountries.length;
            activeCountries.forEach(c => {
                countryGlobalSpends[c] = (countryGlobalSpends[c] || 0) + split;
            });
        }

        activeCountries.forEach(country => {
            const globalSpend = countryGlobalSpends[country] || 0;
            if (globalSpend > 0) {
                // Only distribute global spend to products that ALREADY have direct ad spend
                // Products with no mapped campaigns should NOT receive global spend
                const existingPids = Object.keys(result[country] || {});
                if (existingPids.length > 0) {
                    const cntryOrders = filteredOrders.filter(o => o.country === country);
                    const mappedOrders = cntryOrders.filter(o => existingPids.includes(o.PRODUCTO_ID?.toString() || ''));
                    const totalMapped = mappedOrders.length || 1;
                    if (!result[country]) result[country] = {};
                    existingPids.forEach(pid => {
                        const pOrdersCount = mappedOrders.filter(o => o.PRODUCTO_ID?.toString() === pid).length || 1;
                        result[country][pid] = (result[country][pid] || 0) + (globalSpend * (pOrdersCount / totalMapped));
                    });
                }
            }
        });

        return result;
    }, [filteredAds, filteredOrders, availableCountries, rawOrders, productGroups, exchangeRates]);

    // 6. Global KPIs (depends on filteredOrders, adsByCountryProduct)
    const kpis = useMemo(() => {
        if (loading) return null;
        let totalMappedAds = 0;
        Object.entries(adsByCountryProduct).forEach(([c, prods]) => {
            if (country === 'Todos' || isMatchingCountry(c, country)) {
                Object.entries(prods).forEach(([pid, amt]) => {
                    if (product === 'Todos' || pid === product) {
                        totalMappedAds += amt;
                    }
                });
            }
        });
        return calculateKPIs(filteredOrders, totalMappedAds);
    }, [filteredOrders, adsByCountryProduct, country, product, loading]);

    // 6b. Previous Period KPIs
    const prevKpis = useMemo(() => {
        if (loading || !dateLimits.startDate || !dateLimits.endDate) return null;

        const diff = dateLimits.endDate.getTime() - dateLimits.startDate.getTime();
        const prevEndDate = new Date(dateLimits.startDate.getTime() - (24 * 60 * 60 * 1000));
        const prevStartDate = new Date(prevEndDate.getTime() - diff);

        // Filter orders for previous period
        const pOrders = rawOrders.filter(o => {
            const d = parseDropiDate(o.FECHA);
            if (!d) return false;
            if (d < prevStartDate || d > prevEndDate) return false;
            // Country & Product Filter
            if (country !== 'Todos' && !isMatchingCountry(o.country, country)) return false;
            if (product !== 'Todos' && getEffectiveProductId(o.PRODUCTO_ID?.toString() || '', productGroups) !== product) return false;
            return true;
        });

        // Filter ads for previous period
        const pAdsTotal = resolvedAds.filter(h => {
            const d = parseDropiDate(h.date);
            if (!d) return false;
            if (d < prevStartDate || d > prevEndDate) return false;
            if (country !== 'Todos' && !isMatchingCountry(h.country, country)) return false;
            if (product !== 'Todos' && h.productId !== product) return false;
            return true;
        }).reduce((sum, h) => {
            const cop = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, exchangeRates);
            return sum + cop;
        }, 0);

        return calculateKPIs(pOrders, pAdsTotal);
    }, [loading, dateLimits, rawOrders, resolvedAds, country, product, exchangeRates, productGroups]);

    // 7. Logistic Stats
    const logisticStats = useMemo(() => {
        if (loading) return { entregados: 0, transito: 0, cancelados: 0, devoluciones: 0 };
        return {
            entregados: new Set(filteredOrders.filter(o => isEntregado(o.ESTATUS)).map(o => o.ID)).size,
            transito: new Set(filteredOrders.filter(o => isTransit(o.ESTATUS)).map(o => o.ID)).size,
            cancelados: new Set(filteredOrders.filter(o => isCancelado(o.ESTATUS)).map(o => o.ID)).size,
            devoluciones: new Set(filteredOrders.filter(o => isDevolucion(o.ESTATUS)).map(o => o.ID)).size
        };
    }, [filteredOrders, loading]);

    // 8. Trends Data
    const { dailySalesData } = useMemo(() => {
        if (loading) return { dailySalesData: [] };
        const { startDate, endDate } = dateLimits;
        const dailyData: Record<string, any> = {};

        // Initialize Days
        let curr = new Date(startDate);
        while (curr <= endDate) {
            const k = getLocalDateKey(curr);
            dailyData[k] = { sales: 0, sales_despachada: 0, orders: 0, ads: 0, profit: 0, projected_profit: 0 };
            curr.setDate(curr.getDate() + 1);
        }

        // Fill Ads Data - Aggregate by date
        filteredAds.forEach(h => {
            const k = getLocalDateKey(h.date);
            if (dailyData[k]) {
                const cop = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, exchangeRates);
                dailyData[k].ads += cop;
            }
        });

        // Fill Orders & Profit Data - deduplicate by order ID to avoid double-counting multi-item orders
        const seenSalesIds: Record<string, Set<string>> = {};
        const dailyOrders: Record<string, ExtendedDropiOrder[]> = {};

        filteredOrders.forEach(o => {
            const k = getLocalDateKey(o.FECHA);
            if (dailyData[k]) {
                if (!dailyOrders[k]) dailyOrders[k] = [];
                dailyOrders[k].push(o);

                const orderId = o.ID?.toString() || '';
                if (!seenSalesIds[k]) seenSalesIds[k] = new Set();

                // Only count TOTAL DE LA ORDEN once per unique order ID
                if (orderId && !seenSalesIds[k].has(orderId)) {
                    seenSalesIds[k].add(orderId);
                    if (!isCancelado(o.ESTATUS)) {
                        dailyData[k].sales += (o["TOTAL DE LA ORDEN"] || 0);
                        // Dispatched = Entregado + Devolucion + Transito
                        if (isEntregado(o.ESTATUS) || isDevolucion(o.ESTATUS) || isTransit(o.ESTATUS)) {
                            dailyData[k].sales_despachada += (o["TOTAL DE LA ORDEN"] || 0);
                        }
                        if (isEntregado(o.ESTATUS)) {
                            dailyData[k].profit += (o["TOTAL DE LA ORDEN"] || 0) - (o["PRECIO FLETE"] || 0);
                        } else {
                            dailyData[k].profit -= (o["PRECIO FLETE"] || 0);
                        }
                    }
                }

                // Product cost is per line item
                if (orderId && seenSalesIds[k].has(orderId) && isEntregado(o.ESTATUS)) {
                    dailyData[k].profit -= (o["PRECIO PROVEEDOR X CANTIDAD"] || o["PRECIO PROVEEDOR"] || 0);
                }
            }
        });

        // Calculate daily projected profit
        Object.keys(dailyData).forEach(k => {
            const dayOrders = dailyOrders[k] || [];
            const dayAds = dailyData[k].ads;
            if (dayOrders.length > 0 || dayAds > 0) {
                // Simplified projection per day for the chart
                const pids = new Set(dayOrders.map(o => o.PRODUCTO_ID?.toString() || 'unknown'));
                let totalDayProj = 0;
                pids.forEach(pid => {
                    const pOrders = dayOrders.filter(o => o.PRODUCTO_ID?.toString() === pid);
                    const cntry = pOrders[0]?.country;
                    const cSettings = projectionSettings?.countries?.[cntry];
                    const pOverrides = projectionSettings?.products?.[cntry] || {};
                    const pDeliveryRate = pOverrides[pid] !== undefined ? pOverrides[pid] : (cSettings?.delivery_percent ?? 80);
                    const pBuffer = cSettings?.buffer ?? 1.4;

                    const pproj = calculateProjection(pOrders, 'PRODUCTO_ID', { [pid]: pDeliveryRate }, pBuffer, { [pid]: 0 }); // Ads handled at day level or split
                    totalDayProj += pproj.reduce((s, p) => s + p.utilidad, 0);
                });
                // Subtract total day ads from the sum of product projections
                dailyData[k].projected_profit = totalDayProj - dayAds;
                dailyData[k].orders = new Set(dayOrders.map(o => o.ID)).size;
            }
        });

        const trends = Object.entries(dailyData).map(([date, data]) => {
            const [y, m, d] = date.split('-');
            return { date, label: `${d}/${m}`, name: `${d}/${m}`, ...data };
        }).sort((a, b) => a.date.localeCompare(b.date));

        return { dailySalesData: trends };
    }, [filteredOrders, filteredAds, dateLimits, loading, exchangeRates, projectionSettings]);

    // 9. Metrics By Country (kept as is for the table)
    const { metricsByCountry, totalProjectedProfit } = useMemo(() => {
        if (loading) return { metricsByCountry: [], totalProjectedProfit: 0 };

        const countriesList = availableCountries.filter(c => c !== 'Todos');

        const metricsCountries = countriesList.map(cntryName => {
            const cntryOrders = filteredOrders.filter(o => o.country === cntryName);
            const cntryAds = adsByCountryProduct[cntryName] || {};
            const totalCntryAds = Object.values(cntryAds).reduce((sum, val) => sum + val, 0);
            const cKpis = calculateKPIs(cntryOrders, totalCntryAds);

            const pids = new Set([...cntryOrders.map(o => o.PRODUCTO_ID?.toString() || 'unknown'), ...Object.keys(cntryAds)]);

            const productMetrics = Array.from(pids).map(pid => {
                const pOrders = cntryOrders.filter(o => (o.PRODUCTO_ID?.toString() || 'unknown') === pid);
                const pAds = cntryAds[pid] || 0;
                const pkpi = calculateKPIs(pOrders, pAds);

                const cSettings = projectionSettings?.countries?.[cntryName];
                const pOverrides = projectionSettings?.products?.[cntryName] || {};
                const pDeliveryRate = pOverrides[pid] !== undefined ? pOverrides[pid] : (cSettings?.delivery_percent ?? 80);
                const pBuffer = cSettings?.buffer ?? 1.4;

                const pproj = calculateProjection(pOrders, 'PRODUCTO_ID', { [pid]: pDeliveryRate }, pBuffer, { [pid]: pAds });
                const baseProj = pproj.reduce((s, p) => s + p.utilidad, 0);
                // If no orders but has ads, projected profit is negative (pure loss)
                const finalProj = pOrders.length === 0 ? -pAds : baseProj;

                return {
                    id: pid,
                    name: resolveProductName(pid, rawOrders, campaignMappings, productGroups),
                    orderCount: pkpi.n_ord,
                    deliveryRate: pkpi.tasa_ent,
                    cancelRate: pkpi.tasa_can,
                    transitRate: pkpi.n_nc > 0 ? (new Set(pOrders.filter(o => isTransit(o.ESTATUS)).map(o => o.ID)).size / pkpi.n_nc) * 100 : 0,
                    returnRate: pkpi.n_nc > 0 ? (new Set(pOrders.filter(o => isDevolucion(o.ESTATUS)).map(o => o.ID)).size / pkpi.n_nc) * 100 : 0,
                    profit: pkpi.u_real,
                    adSpend: pkpi.g_ads,
                    netSales: pkpi.fact_neto,
                    roas: pkpi.roas,
                    cpa: pkpi.n_nc > 0 ? pkpi.g_ads / pkpi.n_nc : 0,
                    projectedProfit: finalProj,
                    projectionConfig: pDeliveryRate
                };
            }).filter(p => p.orderCount > 0 || p.adSpend > 0)
                .sort((a, b) => b.orderCount - a.orderCount);

            return {
                name: cntryName,
                currency: getCurrencyForCountry(cntryName),
                orderCount: cKpis.n_ord,
                deliveryRate: cKpis.tasa_ent,
                cancelRate: cKpis.tasa_can,
                transitRate: cKpis.n_tra > 0 ? (cKpis.n_tra / cKpis.n_nc) * 100 : 0,
                returnRate: cKpis.n_dev > 0 ? (cKpis.n_dev / cKpis.n_nc) * 100 : 0,
                cancelCount: cKpis.n_can,
                sales: cKpis.fact_neto,
                adSpend: cKpis.g_ads,
                profit: cKpis.u_real,
                projectedProfit: productMetrics.reduce((s, p) => s + p.projectedProfit, 0),
                projectionConfig: projectionSettings?.countries?.[cntryName]?.delivery_percent ?? 80,
                products: productMetrics
            };
        }).sort((a, b) => b.orderCount - a.orderCount);

        const totalProj = metricsCountries.reduce((sum, c) => {
            if (country !== 'Todos' && !isMatchingCountry(c.name, country)) return sum;
            if (product !== 'Todos') {
                const found = c.products.find(p => p.id === product || p.name === product || getEffectiveProductId(p.id, productGroups) === product);
                return sum + (found?.projectedProfit || 0);
            }
            return sum + c.projectedProfit;
        }, 0);

        return { metricsByCountry: metricsCountries, totalProjectedProfit: totalProj };
    }, [filteredOrders, rawOrders, adsByCountryProduct, country, product, projectionSettings, loading, availableCountries, campaignMappings, productGroups]);

    // 10. Product Performance Data (Consolidated from metricsByCountry)
    const productPerformanceData = useMemo(() => {
        if (loading) return [];
        const productMap = new Map<string, any>();

        metricsByCountry.forEach(ctry => {
            ctry.products.forEach((p: any) => {
                const existing = productMap.get(p.name) || {
                    name: p.name,
                    label: p.name,
                    sales: 0,
                    profit: 0,
                    ads: 0,
                    projected_profit: 0,
                    orderCount: 0
                };

                productMap.set(p.name, {
                    ...existing,
                    sales: existing.sales + p.netSales,
                    profit: existing.profit + p.profit,
                    ads: existing.ads + p.adSpend,
                    projected_profit: existing.projected_profit + p.projectedProfit,
                    orderCount: existing.orderCount + p.orderCount
                });
            });
        });

        return Array.from(productMap.values())
            .sort((a, b) => b.orderCount - a.orderCount)
            .slice(0, 10); // Top 10 globally or as per selection
    }, [metricsByCountry, loading]);

    // 10. Platform Metrics & CPA Facebook
    const { adPlatformMetrics, cpaFacebook } = useMemo(() => {
        let fb = 0, tt = 0;
        let fbConversions = 0;
        filteredAds.forEach(h => {
            const cop = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, exchangeRates);
            if (h.platform === 'facebook') {
                fb += cop;
                fbConversions += (h.conversions || 0);
            }
            if (h.platform === 'tiktok') tt += cop;
        });
        return {
            adPlatformMetrics: { fb, tiktok: tt, google: 0 },
            cpaFacebook: fbConversions > 0 ? fb / fbConversions : 0
        };
    }, [filteredAds, exchangeRates]);

    return {
        loading,
        error,
        rawOrders,
        rawOrdersCount: rawOrders.length,
        invalidDatesCount,
        dateRange, setDateRange,
        country, setCountry,
        product, setProduct,
        availableCountries,
        availableProducts,
        filteredOrders,
        kpis: kpis ? { ...kpis, utilidad_proyectada: totalProjectedProfit, cpaFacebook } : null,
        prevKpis,
        logisticStats,
        adPlatformMetrics,
        dailySalesData,
        productPerformanceData,
        projectedProfit: totalProjectedProfit,
        metricsByCountry,
        unmappedAdSpend: 0,
        rawDatesSample: [],
        startDateCustom, setStartDateCustom,
        endDateCustom, setEndDateCustom,
        exchangeRates,
        filteredAds,
        campaignMappings,
        projectionSettings,
        saveProjectionSettings: async (newSettings, userEmail) => {
            setSavingProjection(true);
            try {
                await setAppData('projection_settings', newSettings, userEmail);
                setProjectionSettings(newSettings);
                // Update cache with new settings
                if (dashboardCache) {
                    dashboardCache.projectionSettings = newSettings;
                }
            } catch (err) {
                console.error("Error saving projection settings:", err);
                throw err;
            } finally {
                setSavingProjection(false);
            }
        },
        priceCorrections,
        savePriceCorrection: async (correction: PriceCorrection) => {
            if (!effectiveUid) return;
            await savePriceCorrectionService(correction, effectiveUid);
            invalidateDashboardCache();
            // Re-trigger data load
            const updated = await getPriceCorrections(effectiveUid);
            setPriceCorrections(updated);
        },
        deletePriceCorrection: async (id: string) => {
            if (!effectiveUid) return;
            await deletePriceCorrectionService(id, effectiveUid);
            invalidateDashboardCache();
            const updated = await getPriceCorrections(effectiveUid);
            setPriceCorrections(updated);
        }
    };
}
