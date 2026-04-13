'use client';

import { useState, useEffect, useCallback, useRef } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { getAllSupplierOrderFiles } from '@/lib/firebase/firestore';
import { getInventory, getMovements, computeAllStocks, calculateStockAlerts } from '@/lib/services/supplierInventory';
import { getReturns, getUnreportedReturns } from '@/lib/services/supplierReturns';
import { getPriceCorrections } from '@/lib/services/priceCorrections';
import { getProductGroups, getEffectiveProductId } from '@/lib/services/productGroups';
import { calculateSupplierKPIs } from '@/lib/calculations/supplierKpis';
import type { SupplierOrder } from '@/lib/utils/supplierParser';
import type { InventoryProduct, InventoryMovement, StockAlert } from '@/lib/services/supplierInventory';
import type { SupplierReturn, UnreportedReturn } from '@/lib/services/supplierReturns';
import type { SupplierKPIResults } from '@/lib/calculations/supplierKpis';
import type { PriceCorrection } from '@/lib/services/priceCorrections';

// ── Cache ───────────────────────────────────────────────────────────────────

interface SupplierCache {
    uid: string;
    timestamp: number;
    orders: SupplierOrder[];
    inventory: InventoryProduct[];
    movements: InventoryMovement[];
    returns: SupplierReturn[];
    corrections: PriceCorrection[];
}

const CACHE_TTL = 5 * 60 * 1000; // 5 minutes
let supplierCache: SupplierCache | null = null;
let onSupplierCacheInvalidated: (() => void) | null = null;

export function invalidateSupplierCache() {
    supplierCache = null;
    onSupplierCacheInvalidated?.();
}

// ── Date filtering ──────────────────────────────────────────────────────────

function parseOrderDate(fecha: string): Date | null {
    if (!fecha) return null;
    // Try DD-MM-YYYY format (Dropi default)
    const ddmmyyyy = fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
    if (ddmmyyyy) return new Date(Number(ddmmyyyy[3]), Number(ddmmyyyy[2]) - 1, Number(ddmmyyyy[1]));
    // Try YYYY-MM-DD
    const yyyymmdd = fecha.match(/^(\d{4})[/-](\d{1,2})[/-](\d{1,2})/);
    if (yyyymmdd) return new Date(Number(yyyymmdd[1]), Number(yyyymmdd[2]) - 1, Number(yyyymmdd[3]));
    // Fallback
    const d = new Date(fecha);
    return isNaN(d.getTime()) ? null : d;
}

// ── Hook ────────────────────────────────────────────────────────────────────

export interface SupplierDataResult {
    loading: boolean;
    error: string | null;
    orders: SupplierOrder[];
    filteredOrders: SupplierOrder[];
    kpis: SupplierKPIResults | null;
    inventory: InventoryProduct[];
    movements: InventoryMovement[];
    returns: SupplierReturn[];
    unreportedReturns: UnreportedReturn[];
    stockAlerts: StockAlert[];
    corrections: PriceCorrection[];
    // Helpers
    availableProducts: { id: string; name: string; variacionId: string; variacion: string; precioProveedor: number }[];
    availableStores: string[];
    // Actions
    refresh: () => void;
}

export function useSupplierData(
    dateRange?: { start: Date; end: Date },
    selectedProduct?: string,
    selectedStore?: string,
    deliveryPercent?: number,
    productDeliveryOverrides?: Record<string, number>,
): SupplierDataResult {
    const { effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    const [orders, setOrders] = useState<SupplierOrder[]>([]);
    const [inventory, setInventory] = useState<InventoryProduct[]>([]);
    const [movements, setMovements] = useState<InventoryMovement[]>([]);
    const [returns, setReturns] = useState<SupplierReturn[]>([]);
    const [corrections, setCorrections] = useState<PriceCorrection[]>([]);

    const loadedRef = useRef(false);

    const loadData = useCallback(async () => {
        if (!effectiveUid) return;

        // Check cache
        if (
            supplierCache &&
            supplierCache.uid === effectiveUid &&
            Date.now() - supplierCache.timestamp < CACHE_TTL
        ) {
            setOrders(supplierCache.orders);
            setInventory(supplierCache.inventory);
            setMovements(supplierCache.movements);
            setReturns(supplierCache.returns);
            setCorrections(supplierCache.corrections);
            setLoading(false);
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const [orderFiles, inv, movs, rets, corrs, groups] = await Promise.all([
                getAllSupplierOrderFiles(effectiveUid),
                getInventory(effectiveUid),
                getMovements(effectiveUid),
                getReturns(effectiveUid),
                getPriceCorrections(effectiveUid),
                getProductGroups(effectiveUid),
            ]);

            // Flatten all order files
            const allOrders: SupplierOrder[] = [];
            for (const file of orderFiles) {
                if (Array.isArray(file.orders)) {
                    for (const order of file.orders) {
                        allOrders.push(order as SupplierOrder);
                    }
                }
            }

            // Apply price corrections to supplier orders (scope: supplier or both)
            // Corrections use group-resolved productIds (from dropshipper side),
            // so resolve supplier PRODUCTO_ID through product groups to match.
            const supplierCorrections = corrs.filter(c => !c.scope || c.scope !== 'dropshipper');
            for (const order of allOrders) {
                const pid = order.PRODUCTO_ID || '';
                const effectivePid = getEffectiveProductId(pid, groups);
                for (const corr of supplierCorrections) {
                    if (corr.productId !== pid && corr.productId !== effectivePid) continue;
                    const unitPrice = order.PRECIO_PROVEEDOR_X_CANTIDAD > 0
                        ? Math.round(order.PRECIO_PROVEEDOR_X_CANTIDAD / (order.CANTIDAD || 1))
                        : Math.round(order.PRECIO_PROVEEDOR || 0);
                    if (Math.abs(unitPrice - corr.originalUnitPrice) <= 1) {
                        order.PRECIO_PROVEEDOR = corr.correctedUnitPrice;
                        order.PRECIO_PROVEEDOR_X_CANTIDAD = corr.correctedUnitPrice * (order.CANTIDAD || 1);
                        break;
                    }
                }
            }

            // Compute inventory stocks
            const inventoryWithStock = computeAllStocks(inv, movs);

            // Cache
            supplierCache = {
                uid: effectiveUid,
                timestamp: Date.now(),
                orders: allOrders,
                inventory: inventoryWithStock,
                movements: movs,
                returns: rets,
                corrections: corrs,
            };

            setOrders(allOrders);
            setInventory(inventoryWithStock);
            setMovements(movs);
            setReturns(rets);
            setCorrections(corrs);
        } catch (err: any) {
            setError(err.message || 'Error al cargar datos de proveedor');
        } finally {
            setLoading(false);
        }
    }, [effectiveUid]);

    useEffect(() => {
        if (!loadedRef.current) {
            loadedRef.current = true;
            loadData();
        }
    }, [loadData]);

    // Register callback so external invalidateSupplierCache() triggers re-fetch
    useEffect(() => {
        onSupplierCacheInvalidated = () => {
            loadedRef.current = false;
            loadData();
        };
        return () => { onSupplierCacheInvalidated = null; };
    }, [loadData]);

    // Filter orders by date, product, store
    const filteredOrders = orders.filter(order => {
        if (dateRange) {
            const d = parseOrderDate(order.FECHA);
            if (d) {
                if (d < dateRange.start || d > dateRange.end) return false;
            }
        }
        if (selectedProduct && selectedProduct !== 'Todos') {
            if (order.PRODUCTO_ID !== selectedProduct) return false;
        }
        if (selectedStore && selectedStore !== 'Todos') {
            if (order.TIENDA !== selectedStore) return false;
        }
        return true;
    });

    // KPIs from filtered orders
    const kpis = filteredOrders.length > 0
        ? calculateSupplierKPIs(filteredOrders, inventory, deliveryPercent || 70, productDeliveryOverrides || {})
        : null;

    // Unreported returns
    const unreportedReturns = getUnreportedReturns(orders, returns);

    // Stock alerts
    const stockAlerts = calculateStockAlerts(inventory, movements);

    // Available products and stores (from all orders)
    // Key by PRODUCTO_ID + VARIACION_ID to capture all variations
    const productSet = new Map<string, { id: string; name: string; variacionId: string; variacion: string; precioProveedor: number }>();
    const storeSet = new Set<string>();
    for (const order of orders) {
        const key = `${order.PRODUCTO_ID}_${order.VARIACION_ID || ''}`;
        if (order.PRODUCTO_ID && !productSet.has(key)) {
            productSet.set(key, {
                id: order.PRODUCTO_ID,
                name: order.PRODUCTO,
                variacionId: order.VARIACION_ID || '',
                variacion: order.VARIACION || '',
                precioProveedor: order.PRECIO_PROVEEDOR || 0,
            });
        }
        if (order.TIENDA) storeSet.add(order.TIENDA);
    }

    return {
        loading,
        error,
        orders,
        filteredOrders,
        kpis,
        inventory,
        movements,
        returns,
        unreportedReturns,
        stockAlerts,
        corrections,
        availableProducts: Array.from(productSet.values()).sort((a, b) => a.name.localeCompare(b.name)),
        availableStores: Array.from(storeSet).sort(),
        refresh: () => {
            invalidateSupplierCache();
            loadedRef.current = false;
            loadData();
        },
    };
}
