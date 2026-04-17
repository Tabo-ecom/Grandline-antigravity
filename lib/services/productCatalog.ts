/**
 * Product Catalog Service
 * Manages products, brands, and expense categories.
 * Stored in Firestore app_data collection.
 */

import { getAppData, setAppData } from '../firebase/firestore';

// ─── Types ───────────────────────────────────────────────────────────

export interface CatalogProduct {
    id: string;
    name: string;
    brand_id: string;          // ref to CatalogBrand.id
    category: string;          // "Skincare", "Accesorios", etc.
    type: 'dropi' | 'propio';
    costPrice: number;         // costo proveedor
    salePrice: number;         // precio venta
    supplier?: string;
    imageUrl?: string;
    dropiProductIds: string[]; // mapeo a PRODUCTO_ID de reportes Dropi
    dropiNames: string[];      // mapeo a nombres en reportes (para matching)
    active: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface CatalogBrand {
    id: string;
    name: string;
    store?: string;            // primary store name (legacy, kept for compat)
    stores: string[];          // ALL store names linked to this brand
    color: string;
    active: boolean;
    createdAt: number;
    updatedAt: number;
}

export interface ExpenseCategory {
    id: string;
    name: string;              // "Shopify", "UGC", "Operación", etc.
    type: 'fixed' | 'variable';
    icon?: string;
    color?: string;
}

export interface ProductCatalogData {
    products: CatalogProduct[];
    brands: CatalogBrand[];
    expenseCategories: ExpenseCategory[];
}

// ─── Defaults ────────────────────────────────────────────────────────

const DEFAULT_EXPENSE_CATEGORIES: ExpenseCategory[] = [
    { id: 'cat_shopify', name: 'Shopify', type: 'fixed', icon: 'shopping-cart', color: '#96bf48' },
    { id: 'cat_ugc', name: 'UGC / Videos', type: 'variable', icon: 'video', color: '#e879f9' },
    { id: 'cat_ads_meta', name: 'Publicidad Meta', type: 'variable', icon: 'facebook', color: '#3b82f6' },
    { id: 'cat_ads_tiktok', name: 'Publicidad TikTok', type: 'variable', icon: 'music', color: '#000000' },
    { id: 'cat_operacion', name: 'Operación', type: 'fixed', icon: 'settings', color: '#f59e0b' },
    { id: 'cat_bodega', name: 'Bodega', type: 'fixed', icon: 'warehouse', color: '#8b5cf6' },
    { id: 'cat_equipo', name: 'Equipo / Nómina', type: 'fixed', icon: 'users', color: '#06b6d4' },
    { id: 'cat_otros', name: 'Otros', type: 'variable', icon: 'more-horizontal', color: '#6b7280' },
];

const DEFAULT_BRAND_COLORS = [
    '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6',
    '#06b6d4', '#ec4899', '#84cc16', '#f97316', '#14b8a6',
];

// ─── ID Generators ───────────────────────────────────────────────────

export function generateProductId(): string {
    return `prod_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateBrandId(): string {
    return `brand_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function generateExpenseCategoryId(): string {
    return `cat_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// ─── CRUD Operations ─────────────────────────────────────────────────

const CATALOG_KEY = 'product_catalog';

export async function getCatalog(userId: string): Promise<ProductCatalogData> {
    if (!userId) return { products: [], brands: [], expenseCategories: DEFAULT_EXPENSE_CATEGORIES };
    const data = await getAppData<ProductCatalogData>(CATALOG_KEY, userId);
    if (!data) return { products: [], brands: [], expenseCategories: DEFAULT_EXPENSE_CATEGORIES };
    return {
        products: data.products || [],
        brands: data.brands || [],
        expenseCategories: data.expenseCategories?.length > 0 ? data.expenseCategories : DEFAULT_EXPENSE_CATEGORIES,
    };
}

export async function saveCatalog(catalog: ProductCatalogData, userId: string): Promise<void> {
    if (!userId) return;
    await setAppData(CATALOG_KEY, catalog, userId);
}

// ─── Product Operations ──────────────────────────────────────────────

export async function saveProduct(product: CatalogProduct, userId: string): Promise<void> {
    const catalog = await getCatalog(userId);
    const idx = catalog.products.findIndex(p => p.id === product.id);
    if (idx >= 0) {
        catalog.products[idx] = { ...product, updatedAt: Date.now() };
    } else {
        catalog.products.push({ ...product, createdAt: Date.now(), updatedAt: Date.now() });
    }
    await saveCatalog(catalog, userId);
}

export async function deleteProduct(productId: string, userId: string): Promise<void> {
    const catalog = await getCatalog(userId);
    catalog.products = catalog.products.filter(p => p.id !== productId);
    await saveCatalog(catalog, userId);
}

// ─── Brand Operations ────────────────────────────────────────────────

export async function saveBrand(brand: CatalogBrand, userId: string): Promise<void> {
    const catalog = await getCatalog(userId);
    const idx = catalog.brands.findIndex(b => b.id === brand.id);
    if (idx >= 0) {
        catalog.brands[idx] = { ...brand, updatedAt: Date.now() };
    } else {
        catalog.brands.push({ ...brand, createdAt: Date.now(), updatedAt: Date.now() });
    }
    await saveCatalog(catalog, userId);
}

export async function deleteBrand(brandId: string, userId: string): Promise<void> {
    const catalog = await getCatalog(userId);
    catalog.brands = catalog.brands.filter(b => b.id !== brandId);
    // Unlink products from this brand
    catalog.products.forEach(p => { if (p.brand_id === brandId) p.brand_id = ''; });
    await saveCatalog(catalog, userId);
}

// ─── Expense Category Operations ─────────────────────────────────────

export async function saveExpenseCategory(cat: ExpenseCategory, userId: string): Promise<void> {
    const catalog = await getCatalog(userId);
    const idx = catalog.expenseCategories.findIndex(c => c.id === cat.id);
    if (idx >= 0) {
        catalog.expenseCategories[idx] = cat;
    } else {
        catalog.expenseCategories.push(cat);
    }
    await saveCatalog(catalog, userId);
}

export async function deleteExpenseCategory(catId: string, userId: string): Promise<void> {
    const catalog = await getCatalog(userId);
    catalog.expenseCategories = catalog.expenseCategories.filter(c => c.id !== catId);
    await saveCatalog(catalog, userId);
}

// ─── Helpers ─────────────────────────────────────────────────────────

/** Pick next available brand color */
export function nextBrandColor(existingBrands: CatalogBrand[]): string {
    const used = new Set(existingBrands.map(b => b.color));
    return DEFAULT_BRAND_COLORS.find(c => !used.has(c)) || DEFAULT_BRAND_COLORS[existingBrands.length % DEFAULT_BRAND_COLORS.length];
}

/** Find brand by store name (case-insensitive, checks all linked stores) */
export function findBrandByStore(store: string, brands: CatalogBrand[]): CatalogBrand | null {
    if (!store) return null;
    const norm = store.toLowerCase().trim();
    return brands.find(b =>
        (b.stores || []).some(s => s.toLowerCase().trim() === norm) ||
        b.store?.toLowerCase().trim() === norm
    ) || null;
}

/** Find catalog product by Dropi product ID */
export function findCatalogProduct(dropiProductId: string, products: CatalogProduct[]): CatalogProduct | null {
    if (!dropiProductId) return null;
    return products.find(p => p.dropiProductIds.includes(dropiProductId)) || null;
}

/** Find catalog product by Dropi product name (fuzzy) */
export function findCatalogProductByName(dropiName: string, products: CatalogProduct[]): CatalogProduct | null {
    if (!dropiName) return null;
    const norm = dropiName.toLowerCase().trim();
    return products.find(p =>
        p.dropiNames.some(n => n.toLowerCase().trim() === norm) ||
        p.name.toLowerCase().trim() === norm
    ) || null;
}

/** Detect unique store names from orders that don't have a brand yet */
export function detectUnmappedStores(orders: any[], brands: CatalogBrand[]): string[] {
    const stores = new Set<string>();
    orders.forEach(o => {
        const store = (o.TIENDA || o._raw?.TIENDA || '').trim();
        if (store && !findBrandByStore(store, brands)) {
            stores.add(store);
        }
    });
    return Array.from(stores).sort();
}
