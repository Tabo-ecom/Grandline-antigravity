'use client';

import React, { useState, useMemo } from 'react';
import {
    Plus, Trash2, Edit3, Search, Package, Tag, Store, X, Check,
    RefreshCw, Zap, AlertTriangle, ChevronDown,
} from 'lucide-react';
import { calculateRepurchaseMetrics, type ProductRepurchaseMetrics } from '@/lib/calculations/repurchaseMetrics';
import {
    CatalogProduct, CatalogBrand, ProductCatalogData,
    generateProductId, saveProduct, deleteProduct,
    saveBrand, deleteBrand, generateBrandId, nextBrandColor,
    saveCatalog,
} from '@/lib/services/productCatalog';

const fmtCOP = (v: number) => `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

// ─── Types ───────────────────────────────────────────────────────────

interface DropisProduct {
    productId: string;
    name: string;
    avgCost: number;
    avgPrice: number;
    totalOrders: number;
    stores: string[];
    inCatalog: boolean;
}

interface DropisStore {
    name: string;
    products: { id: string; name: string; avgCost: number; avgPrice: number; orders: number }[];
    orderCount: number;
    inBrands: boolean;
    brandName?: string;
}

// ─── Extract from Dropi orders ───────────────────────────────────────

function extractDropiProducts(orders: any[], catalog: ProductCatalogData): DropisProduct[] {
    const map = new Map<string, { name: string; costs: number[]; prices: number[]; count: number; stores: Set<string> }>();
    orders.forEach(o => {
        const pid = o.PRODUCTO_ID?.toString() || '';
        const name = o.PRODUCTO || '';
        if (!pid && !name) return;
        const key = pid || name;
        if (!map.has(key)) map.set(key, { name, costs: [], prices: [], count: 0, stores: new Set() });
        const entry = map.get(key)!;
        if (name && !entry.name) entry.name = name;
        const cost = Number(o['PRECIO PROVEEDOR X CANTIDAD'] || o['PRECIO PROVEEDOR'] || 0);
        const price = Number(o['TOTAL DE LA ORDEN'] || 0);
        if (cost > 0) entry.costs.push(cost);
        if (price > 0) entry.prices.push(price);
        entry.count++;
        const store = (o._store || o.TIENDA || o._raw?.TIENDA || '').trim();
        if (store) entry.stores.add(store);
    });
    const catalogIds = new Set(catalog.products.flatMap(p => p.dropiProductIds));
    const catalogNames = new Set(catalog.products.flatMap(p => p.dropiNames.map(n => n.toLowerCase().trim())));
    return Array.from(map.entries()).map(([key, v]) => ({
        productId: key, name: v.name || key,
        avgCost: v.costs.length > 0 ? v.costs.reduce((a, b) => a + b, 0) / v.costs.length : 0,
        avgPrice: v.prices.length > 0 ? v.prices.reduce((a, b) => a + b, 0) / v.prices.length : 0,
        totalOrders: v.count, stores: Array.from(v.stores),
        inCatalog: catalogIds.has(key) || catalogNames.has((v.name || '').toLowerCase().trim()),
    })).sort((a, b) => b.totalOrders - a.totalOrders);
}

function extractDropiStores(orders: any[], brands: CatalogBrand[]): DropisStore[] {
    const storeProducts = new Map<string, Map<string, { name: string; costs: number[]; prices: number[]; count: number }>>();
    orders.forEach(o => {
        const store = (o._store || o.TIENDA || o._raw?.TIENDA || '').trim();
        if (!store) return;
        if (!storeProducts.has(store)) storeProducts.set(store, new Map());
        const products = storeProducts.get(store)!;
        const pid = o.PRODUCTO_ID?.toString() || o.PRODUCTO || '';
        if (!pid) return;
        if (!products.has(pid)) products.set(pid, { name: o.PRODUCTO || pid, costs: [], prices: [], count: 0 });
        const p = products.get(pid)!;
        const cost = Number(o['PRECIO PROVEEDOR X CANTIDAD'] || o['PRECIO PROVEEDOR'] || 0);
        const price = Number(o['TOTAL DE LA ORDEN'] || 0);
        if (cost > 0) p.costs.push(cost);
        if (price > 0) p.prices.push(price);
        p.count++;
    });
    // Build a map of all store names → brand name (checking both .store and .stores[])
    const storeToB = new Map<string, string>();
    brands.forEach(b => {
        if (b.store) storeToB.set(b.store.toLowerCase().trim(), b.name);
        (b.stores || []).forEach(s => storeToB.set(s.toLowerCase().trim(), b.name));
    });
    return Array.from(storeProducts.entries()).map(([name, productsMap]) => {
        const products = Array.from(productsMap.entries()).map(([id, v]) => ({
            id, name: v.name,
            avgCost: v.costs.length > 0 ? Math.round(v.costs.reduce((a, b) => a + b, 0) / v.costs.length) : 0,
            avgPrice: v.prices.length > 0 ? Math.round(v.prices.reduce((a, b) => a + b, 0) / v.prices.length) : 0,
            orders: v.count,
        })).sort((a, b) => b.orders - a.orders);
        const normName = name.toLowerCase().trim();
        return {
            name, products,
            orderCount: products.reduce((s, p) => s + p.orders, 0),
            inBrands: storeToB.has(normName),
            brandName: storeToB.get(normName),
        };
    }).sort((a, b) => b.orderCount - a.orderCount);
}

// ─── Brand Manager ───────────────────────────────────────────────────

function BrandManager({ catalog, userId, onUpdate, dropiStores }: {
    catalog: ProductCatalogData; userId: string; onUpdate: (c: ProductCatalogData) => void; dropiStores: DropisStore[];
}) {
    const [newName, setNewName] = useState('');
    const [selectedStores, setSelectedStores] = useState<string[]>([]);
    const [editId, setEditId] = useState<string | null>(null);
    const [editName, setEditName] = useState('');
    const [syncing, setSyncing] = useState<string | null>(null);

    // Collect all products from selected stores
    const getStoreProducts = (storeNames: string[]) => {
        const allProducts: DropisStore['products'] = [];
        storeNames.forEach(sn => {
            const store = dropiStores.find(s => s.name === sn);
            if (store) allProducts.push(...store.products);
        });
        return allProducts;
    };

    const syncProductsToBrand = (brandId: string, storeNames: string[], existingProducts: CatalogProduct[]) => {
        const storeProds = getStoreProducts(storeNames);
        const storeProductIds = new Set(storeProds.map(p => p.id));
        const storeProductNames = new Set(storeProds.map(p => p.name.toLowerCase().trim()));

        // 1. Assign brand to existing catalog products
        const updatedExisting = existingProducts.map(p => {
            const matchById = p.dropiProductIds.some(id => storeProductIds.has(id));
            const matchByName = p.dropiNames.some(n => storeProductNames.has(n.toLowerCase().trim()));
            if ((matchById || matchByName) && (!p.brand_id || p.brand_id === brandId)) {
                return { ...p, brand_id: brandId, updatedAt: Date.now() };
            }
            return p;
        });

        // 2. Create new products
        const existingIds = new Set(updatedExisting.flatMap(p => p.dropiProductIds));
        const existingNames = new Set(updatedExisting.flatMap(p => p.dropiNames.map(n => n.toLowerCase().trim())));
        const newProducts = storeProds
            .filter(p => !existingIds.has(p.id) && !existingNames.has(p.name.toLowerCase().trim()))
            .map(p => ({
                id: generateProductId(), name: p.name, brand_id: brandId, category: '', type: 'dropi' as const,
                costPrice: p.avgCost, salePrice: p.avgPrice, supplier: '', imageUrl: '',
                dropiProductIds: [p.id], dropiNames: [p.name], active: true, createdAt: Date.now(), updatedAt: Date.now(),
            }));

        return { updatedExisting, newProducts };
    };

    const handleCreateBrand = async (name: string, storeNames: string[]) => {
        if (!name.trim()) return;
        setSyncing(name);
        const brand: CatalogBrand = {
            id: generateBrandId(), name: name.trim(),
            store: storeNames[0] || undefined, stores: storeNames,
            color: nextBrandColor(catalog.brands), active: true, createdAt: Date.now(), updatedAt: Date.now(),
        };

        const { updatedExisting, newProducts } = storeNames.length > 0
            ? syncProductsToBrand(brand.id, storeNames, catalog.products)
            : { updatedExisting: catalog.products, newProducts: [] as CatalogProduct[] };

        const updated = { ...catalog, brands: [...catalog.brands, brand], products: [...updatedExisting, ...newProducts] };
        await saveCatalog(updated, userId);
        onUpdate(updated);
        setNewName(''); setSelectedStores([]);
        setSyncing(null);
    };

    // Add a store to an existing brand
    const handleLinkStore = async (brandId: string, storeName: string) => {
        setSyncing(storeName);
        const brand = catalog.brands.find(b => b.id === brandId);
        if (!brand) return;
        const updatedStores = [...new Set([...(brand.stores || []), brand.store || '', storeName].filter(Boolean))];
        const updatedBrand = { ...brand, stores: updatedStores, store: updatedStores[0], updatedAt: Date.now() };

        const { updatedExisting, newProducts } = syncProductsToBrand(brandId, [storeName], catalog.products);

        const updated = {
            ...catalog,
            brands: catalog.brands.map(b => b.id === brandId ? updatedBrand : b),
            products: [...updatedExisting, ...newProducts],
        };
        await saveCatalog(updated, userId);
        onUpdate(updated);
        setSyncing(null);
    };

    const handleDelete = async (id: string) => {
        await deleteBrand(id, userId);
        onUpdate({ ...catalog, brands: catalog.brands.filter(b => b.id !== id), products: catalog.products.map(p => p.brand_id === id ? { ...p, brand_id: '' } : p) });
    };

    const handleSaveEdit = async (brand: CatalogBrand) => {
        const updated = { ...brand, name: editName.trim(), updatedAt: Date.now() };
        await saveBrand(updated, userId);
        onUpdate({ ...catalog, brands: catalog.brands.map(b => b.id === brand.id ? updated : b) });
        setEditId(null);
    };

    // Unlink a store from a brand
    const handleUnlinkStore = async (brandId: string, storeName: string) => {
        const brand = catalog.brands.find(b => b.id === brandId);
        if (!brand) return;
        const newStores = (brand.stores || []).filter(s => s !== storeName);
        const updated = { ...brand, stores: newStores, store: newStores[0] || undefined, updatedAt: Date.now() };
        await saveBrand(updated, userId);
        onUpdate({ ...catalog, brands: catalog.brands.map(b => b.id === brandId ? updated : b) });
    };

    const unmapped = dropiStores.filter(s => !s.inBrands);

    const toggleStoreSelection = (name: string) => {
        setSelectedStores(prev => prev.includes(name) ? prev.filter(s => s !== name) : [...prev, name]);
    };

    return (
        <div className="space-y-5">
            {/* Unmapped stores */}
            {unmapped.length > 0 && (
                <div className="p-4 rounded-xl bg-amber-500/5 border border-amber-500/10">
                    <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400 mb-3 flex items-center gap-1.5">
                        <AlertTriangle className="w-3.5 h-3.5" /> Tiendas sin marca ({unmapped.length}) — selecciona para juntar
                    </h4>
                    <div className="space-y-2">
                        {unmapped.map(s => (
                            <div key={s.name} className="p-3 bg-card rounded-xl border border-card-border">
                                <div className="flex items-center gap-3">
                                    <input type="checkbox" checked={selectedStores.includes(s.name)}
                                        onChange={() => toggleStoreSelection(s.name)}
                                        className="w-4 h-4 rounded accent-amber-500 shrink-0" />
                                    <Store className="w-4 h-4 text-amber-400 shrink-0" />
                                    <span className="text-sm font-bold text-foreground flex-1">{s.name}</span>
                                    <span className="text-[10px] text-muted">{s.products.length} prod. · {s.orderCount} órd.</span>
                                    {/* Quick: create as its own brand */}
                                    <button onClick={() => handleCreateBrand(s.name, [s.name])} disabled={!!syncing}
                                        className="px-2 py-1 text-[9px] font-bold uppercase text-amber-400 hover:bg-amber-500/10 rounded border border-amber-500/20">
                                        Crear sola
                                    </button>
                                    {/* Link to existing brand */}
                                    {catalog.brands.length > 0 && (
                                        <select onChange={(e) => { if (e.target.value) handleLinkStore(e.target.value, s.name); e.target.value = ''; }}
                                            className="bg-hover-bg border border-card-border rounded-lg px-2 py-1 text-[10px] outline-none"
                                            defaultValue="">
                                            <option value="">Unir a marca...</option>
                                            {catalog.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                                        </select>
                                    )}
                                </div>
                                {/* Product list expandable */}
                                <details className="mt-2">
                                    <summary className="text-[10px] text-muted cursor-pointer hover:text-foreground">
                                        Ver {s.products.length} productos
                                    </summary>
                                    <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto">
                                        {s.products.map(p => (
                                            <div key={p.id} className="flex items-center justify-between text-[11px] px-2 py-1 bg-hover-bg rounded">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    <span className="font-mono text-blue-400/60 text-[9px] shrink-0">ID:{p.id}</span>
                                                    <span className="text-foreground/70 truncate">{p.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0 text-muted">
                                                    <span className="font-mono">{fmtCOP(p.avgCost)}</span>
                                                    <span className="font-mono">{fmtCOP(p.avgPrice)}</span>
                                                    <span>{p.orders} órd.</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            </div>
                        ))}
                    </div>
                    {/* Bulk action: create brand from selected stores */}
                    {selectedStores.length >= 2 && (
                        <div className="mt-3 p-3 bg-indigo-500/10 border border-indigo-500/20 rounded-xl flex items-center gap-3">
                            <span className="text-xs font-bold text-indigo-400">{selectedStores.length} tiendas seleccionadas</span>
                            <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nombre de la nueva marca..."
                                className="flex-1 bg-hover-bg border border-card-border rounded-lg px-3 py-1.5 text-sm outline-none focus:border-indigo-500" />
                            <button onClick={() => handleCreateBrand(newName || selectedStores[0], selectedStores)} disabled={!newName.trim() || !!syncing}
                                className="px-4 py-1.5 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-[10px] font-bold uppercase disabled:opacity-30 flex items-center gap-1.5">
                                {syncing ? <RefreshCw className="w-3 h-3 animate-spin" /> : <Zap className="w-3 h-3" />}
                                Juntar como Marca
                            </button>
                        </div>
                    )}
                </div>
            )}

            {/* Manual add */}
            <div className="flex items-center gap-2">
                <input value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="Nueva marca..."
                    className="flex-1 bg-hover-bg border border-card-border rounded-lg px-3 py-2 text-sm outline-none focus:border-indigo-500" />
                <button onClick={() => handleCreateBrand(newName, [])} disabled={!newName.trim()}
                    className="px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white rounded-lg text-sm font-bold disabled:opacity-30">
                    <Plus className="w-4 h-4" />
                </button>
            </div>

            {/* Existing brands with linked stores */}
            <div className="space-y-3">
                {catalog.brands.length === 0 && <p className="text-sm text-muted text-center py-6">No hay marcas configuradas.</p>}
                {catalog.brands.map(b => {
                    const prodCount = catalog.products.filter(p => p.brand_id === b.id).length;
                    const allStores = [...new Set([...(b.stores || []), b.store || ''].filter(Boolean))];
                    return (
                        <div key={b.id} className="p-3 bg-hover-bg rounded-xl border border-card-border">
                            <div className="flex items-center justify-between gap-3">
                                {editId === b.id ? (
                                    <>
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                                        <input value={editName} onChange={(e) => setEditName(e.target.value)} className="flex-1 bg-transparent border-b border-muted focus:border-indigo-500 outline-none text-sm" />
                                        <button onClick={() => handleSaveEdit(b)} className="p-1 text-emerald-400 hover:bg-emerald-500/10 rounded"><Check className="w-4 h-4" /></button>
                                        <button onClick={() => setEditId(null)} className="p-1 text-muted hover:bg-white/5 rounded"><X className="w-4 h-4" /></button>
                                    </>
                                ) : (
                                    <>
                                        <div className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: b.color }} />
                                        <span className="text-sm font-bold text-foreground flex-1">{b.name}</span>
                                        <span className="text-xs text-muted">{prodCount} prod.</span>
                                        <button onClick={() => { setEditId(b.id); setEditName(b.name); }} className="p-1 text-muted hover:text-foreground rounded"><Edit3 className="w-3.5 h-3.5" /></button>
                                        <button onClick={() => handleDelete(b.id)} className="p-1 text-muted hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                    </>
                                )}
                            </div>
                            {/* Linked stores */}
                            {allStores.length > 0 && (
                                <div className="mt-2 flex flex-wrap gap-1.5">
                                    {allStores.map(s => (
                                        <span key={s} className="inline-flex items-center gap-1 px-2 py-1 bg-card rounded-lg text-[10px] text-muted border border-card-border">
                                            <Store className="w-3 h-3" /> {s}
                                            <button onClick={() => handleUnlinkStore(b.id, s)} className="hover:text-red-400 ml-0.5"><X className="w-3 h-3" /></button>
                                        </span>
                                    ))}
                                </div>
                            )}
                            {/* Products in this brand */}
                            {prodCount > 0 && (
                                <details className="mt-2">
                                    <summary className="text-[10px] text-muted cursor-pointer hover:text-foreground">
                                        Ver {prodCount} productos
                                    </summary>
                                    <div className="mt-1.5 space-y-1 max-h-48 overflow-y-auto">
                                        {catalog.products.filter(p => p.brand_id === b.id).map(p => (
                                            <div key={p.id} className="flex items-center justify-between text-[11px] px-2 py-1 bg-card rounded">
                                                <div className="flex items-center gap-2 flex-1 min-w-0">
                                                    {p.dropiProductIds[0] && <span className="font-mono text-blue-400/60 text-[9px] shrink-0">ID:{p.dropiProductIds[0]}</span>}
                                                    <span className="text-foreground/70 truncate">{p.name}</span>
                                                </div>
                                                <div className="flex items-center gap-3 shrink-0 text-muted">
                                                    <span className="font-mono">{fmtCOP(p.costPrice)}</span>
                                                    <span className="font-mono">{fmtCOP(p.salePrice)}</span>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                </details>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

// ─── Product Form Modal ──────────────────────────────────────────────

function ProductForm({ product, brands, onSave, onCancel }: {
    product: Partial<CatalogProduct> | null; brands: CatalogBrand[];
    onSave: (p: CatalogProduct) => void; onCancel: () => void;
}) {
    const [form, setForm] = useState<Partial<CatalogProduct>>({
        name: '', brand_id: '', category: '', type: 'dropi', costPrice: 0, salePrice: 0,
        supplier: '', dropiProductIds: [], dropiNames: [], active: true, ...product,
    });
    const [tagInput, setTagInput] = useState('');

    const handleSave = () => {
        if (!form.name?.trim()) return;
        onSave({
            id: form.id || generateProductId(), name: form.name!.trim(), brand_id: form.brand_id || '',
            category: form.category || '', type: form.type || 'dropi', costPrice: form.costPrice || 0,
            salePrice: form.salePrice || 0, supplier: form.supplier || '', imageUrl: '',
            dropiProductIds: form.dropiProductIds || [], dropiNames: form.dropiNames || [],
            active: form.active !== false, createdAt: form.createdAt || Date.now(), updatedAt: Date.now(),
        });
    };

    const margin = form.salePrice && form.costPrice ? ((form.salePrice - form.costPrice) / form.salePrice * 100) : 0;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm" onClick={onCancel}>
            <div className="bg-card border border-card-border rounded-2xl shadow-2xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
                <div className="p-5 border-b border-card-border flex items-center justify-between">
                    <h3 className="text-lg font-black uppercase tracking-tight">{product?.id ? 'Editar' : 'Nuevo Producto'}</h3>
                    <button onClick={onCancel} className="p-1 hover:bg-white/5 rounded"><X className="w-5 h-5 text-muted" /></button>
                </div>
                <div className="p-5 space-y-3">
                    <input value={form.name || ''} onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))} placeholder="Nombre"
                        className="w-full bg-hover-bg border border-card-border rounded-lg px-3 py-2.5 text-sm outline-none focus:border-accent" />
                    <div className="grid grid-cols-2 gap-3">
                        <select value={form.brand_id || ''} onChange={(e) => setForm(f => ({ ...f, brand_id: e.target.value }))}
                            className="bg-hover-bg border border-card-border rounded-lg px-3 py-2.5 text-sm outline-none">
                            <option value="">Sin marca</option>
                            {brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                        </select>
                        <input value={form.category || ''} onChange={(e) => setForm(f => ({ ...f, category: e.target.value }))} placeholder="Categoría"
                            className="bg-hover-bg border border-card-border rounded-lg px-3 py-2.5 text-sm outline-none" />
                    </div>
                    <div className="flex gap-2">
                        {(['dropi', 'propio'] as const).map(t => (
                            <button key={t} onClick={() => setForm(f => ({ ...f, type: t }))}
                                className={`flex-1 py-2 rounded-lg text-sm font-bold uppercase border ${form.type === t ? 'bg-accent/10 border-accent/30 text-accent' : 'bg-hover-bg border-card-border text-muted'}`}>{t}</button>
                        ))}
                    </div>
                    <div className="grid grid-cols-3 gap-3">
                        <div><label className="text-[10px] font-black uppercase text-muted block mb-1">Costo</label>
                            <input type="number" value={form.costPrice || ''} onChange={(e) => setForm(f => ({ ...f, costPrice: Number(e.target.value) }))}
                                className="w-full bg-hover-bg border border-card-border rounded-lg px-3 py-2 text-sm font-mono outline-none" /></div>
                        <div><label className="text-[10px] font-black uppercase text-muted block mb-1">Precio</label>
                            <input type="number" value={form.salePrice || ''} onChange={(e) => setForm(f => ({ ...f, salePrice: Number(e.target.value) }))}
                                className="w-full bg-hover-bg border border-card-border rounded-lg px-3 py-2 text-sm font-mono outline-none" /></div>
                        <div><label className="text-[10px] font-black uppercase text-muted block mb-1">Margen</label>
                            <div className={`w-full bg-hover-bg border border-card-border rounded-lg px-3 py-2 text-sm font-mono font-bold ${margin >= 40 ? 'text-emerald-400' : margin >= 20 ? 'text-amber-400' : 'text-red-400'}`}>{margin.toFixed(1)}%</div></div>
                    </div>
                    {/* IDs + Names */}
                    <div>
                        <label className="text-[10px] font-black uppercase text-muted block mb-1">IDs y Nombres Dropi</label>
                        <div className="flex flex-wrap gap-1 mb-1">
                            {(form.dropiProductIds || []).map((id, i) => (
                                <span key={`id-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] font-mono">
                                    ID: {id}<button onClick={() => setForm(f => ({ ...f, dropiProductIds: f.dropiProductIds?.filter((_, j) => j !== i) }))}><X className="w-3 h-3" /></button>
                                </span>
                            ))}
                            {(form.dropiNames || []).map((n, i) => (
                                <span key={`n-${i}`} className="inline-flex items-center gap-1 px-2 py-0.5 bg-amber-500/10 text-amber-400 rounded text-[10px]">
                                    {n}<button onClick={() => setForm(f => ({ ...f, dropiNames: f.dropiNames?.filter((_, j) => j !== i) }))}><X className="w-3 h-3" /></button>
                                </span>
                            ))}
                        </div>
                        <div className="flex gap-2">
                            <input value={tagInput} onChange={(e) => setTagInput(e.target.value)} placeholder="Agregar ID o nombre..."
                                className="flex-1 bg-hover-bg border border-card-border rounded-lg px-3 py-2 text-sm outline-none"
                                onKeyDown={(e) => {
                                    if (e.key !== 'Enter' || !tagInput.trim()) return;
                                    const val = tagInput.trim();
                                    if (/^\d+$/.test(val)) setForm(f => ({ ...f, dropiProductIds: [...(f.dropiProductIds || []), val] }));
                                    else setForm(f => ({ ...f, dropiNames: [...(f.dropiNames || []), val] }));
                                    setTagInput('');
                                }} />
                        </div>
                    </div>
                </div>
                <div className="p-5 border-t border-card-border flex justify-end gap-3">
                    <button onClick={onCancel} className="px-4 py-2 text-sm font-bold text-muted">Cancelar</button>
                    <button onClick={handleSave} disabled={!form.name?.trim()}
                        className="px-6 py-2 bg-accent hover:bg-accent/80 text-white rounded-xl text-sm font-black uppercase disabled:opacity-30">{product?.id ? 'Guardar' : 'Crear'}</button>
                </div>
            </div>
        </div>
    );
}

// ─── Main Catalog Tab ────────────────────────────────────────────────

export default function CatalogTab({ catalog, userId, onUpdate, dropiOrders = [] }: {
    catalog: ProductCatalogData; userId: string; onUpdate: (c: ProductCatalogData) => void; dropiOrders?: any[];
}) {
    const [search, setSearch] = useState('');
    const [brandFilter, setBrandFilter] = useState('all');
    const [showForm, setShowForm] = useState(false);
    const [editProduct, setEditProduct] = useState<CatalogProduct | null>(null);
    const [section, setSection] = useState<'products' | 'brands'>('products');
    const [syncing, setSyncing] = useState(false);

    const dropiProducts = useMemo(() => extractDropiProducts(dropiOrders, catalog), [dropiOrders, catalog]);
    const dropiStores = useMemo(() => extractDropiStores(dropiOrders, catalog.brands), [dropiOrders, catalog.brands]);

    // Repurchase metrics per product
    const repurchaseData = useMemo(() => {
        if (!dropiOrders || dropiOrders.length === 0) return null;
        return calculateRepurchaseMetrics(dropiOrders);
    }, [dropiOrders]);

    const getRepurchase = (product: CatalogProduct): ProductRepurchaseMetrics | null => {
        if (!repurchaseData) return null;
        // Match by Dropi product IDs
        for (const dropiId of product.dropiProductIds) {
            const found = repurchaseData.byProduct.find(r =>
                r.productId === String(dropiId) || r.productName.toLowerCase().includes(product.name.toLowerCase().slice(0, 15))
            );
            if (found) return found;
        }
        // Fallback: match by name
        return repurchaseData.byProduct.find(r =>
            r.productName.toLowerCase().includes(product.name.toLowerCase().slice(0, 15)) ||
            product.name.toLowerCase().includes(r.productName.toLowerCase().slice(0, 15))
        ) || null;
    };
    const notInCatalog = dropiProducts.filter(p => !p.inCatalog);

    const findBrandForStore = (storeName: string) => {
        const norm = storeName.toLowerCase().trim();
        return catalog.brands.find(b =>
            (b.stores || []).some(s => s.toLowerCase().trim() === norm) ||
            b.store?.toLowerCase().trim() === norm
        );
    };

    const handleSyncAll = async () => {
        setSyncing(true);
        // 1. Assign brands to existing products that don't have one
        const updatedExisting = catalog.products.map(p => {
            if (p.brand_id) return p;
            const dp = dropiProducts.find(d => p.dropiProductIds.includes(d.productId) || p.dropiNames.some(n => n.toLowerCase().trim() === d.name.toLowerCase().trim()));
            if (!dp) return p;
            const brand = dp.stores.map(s => findBrandForStore(s)).find(Boolean);
            if (!brand) return p;
            return { ...p, brand_id: brand.id, updatedAt: Date.now() };
        });
        // 2. Create new products
        const newProducts: CatalogProduct[] = notInCatalog.map(dp => {
            const brand = dp.stores.map(s => findBrandForStore(s)).find(Boolean);
            return {
                id: generateProductId(), name: dp.name, brand_id: brand?.id || '', category: '', type: 'dropi' as const,
                costPrice: Math.round(dp.avgCost), salePrice: Math.round(dp.avgPrice), supplier: '', imageUrl: '',
                dropiProductIds: [dp.productId], dropiNames: [dp.name], active: true, createdAt: Date.now(), updatedAt: Date.now(),
            };
        });
        const updated = { ...catalog, products: [...updatedExisting, ...newProducts] };
        await saveCatalog(updated, userId);
        onUpdate(updated);
        setSyncing(false);
    };

    const handleAddDropiProduct = (dp: DropisProduct) => {
        const store = dp.stores[0] || '';
        const brand = catalog.brands.find(b => b.store?.toLowerCase().trim() === store.toLowerCase().trim());
        setEditProduct({
            id: generateProductId(), name: dp.name, brand_id: brand?.id || '', category: '', type: 'dropi',
            costPrice: Math.round(dp.avgCost), salePrice: Math.round(dp.avgPrice), supplier: '', imageUrl: '',
            dropiProductIds: [dp.productId], dropiNames: [dp.name], active: true, createdAt: Date.now(), updatedAt: Date.now(),
        } as CatalogProduct);
        setShowForm(true);
    };

    const filteredProducts = useMemo(() => {
        return catalog.products.filter(p => {
            const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
                p.dropiNames.some(n => n.toLowerCase().includes(search.toLowerCase())) ||
                p.dropiProductIds.some(id => id.includes(search));
            const matchBrand = brandFilter === 'all' || (brandFilter === '' ? !p.brand_id : p.brand_id === brandFilter);
            return matchSearch && matchBrand;
        });
    }, [catalog.products, search, brandFilter]);

    const handleSaveProduct = async (product: CatalogProduct) => {
        await saveProduct(product, userId);
        const idx = catalog.products.findIndex(p => p.id === product.id);
        const updated = { ...catalog };
        if (idx >= 0) updated.products = catalog.products.map(p => p.id === product.id ? product : p);
        else updated.products = [...catalog.products, product];
        onUpdate(updated);
        setShowForm(false); setEditProduct(null);
    };

    const handleDeleteProduct = async (id: string) => {
        await deleteProduct(id, userId);
        onUpdate({ ...catalog, products: catalog.products.filter(p => p.id !== id) });
    };

    const getBrand = (bid: string) => catalog.brands.find(b => b.id === bid);

    return (
        <div className="space-y-6">
            <div className="flex items-center gap-2 flex-wrap">
                <button onClick={() => setSection('products')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${section === 'products' ? 'bg-accent/10 text-accent border border-accent/20' : 'text-muted border border-transparent'}`}>
                    <Package className="w-4 h-4 inline mr-1.5" />Productos ({catalog.products.length})
                </button>
                <button onClick={() => setSection('brands')}
                    className={`px-4 py-2 rounded-xl text-sm font-bold transition-all ${section === 'brands' ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'text-muted border border-transparent'}`}>
                    <Tag className="w-4 h-4 inline mr-1.5" />Marcas ({catalog.brands.length})
                </button>
                {dropiStores.filter(s => !s.inBrands).length > 0 && (
                    <button onClick={() => setSection('brands')} className="px-2 py-1 bg-amber-500/10 text-amber-400 rounded-lg text-[10px] font-bold animate-pulse">
                        {dropiStores.filter(s => !s.inBrands).length} tiendas sin marca
                    </button>
                )}
            </div>

            {section === 'brands' ? (
                <BrandManager catalog={catalog} userId={userId} onUpdate={onUpdate} dropiStores={dropiStores} />
            ) : (
                <>
                    {notInCatalog.length > 0 && (
                        <div className="p-4 rounded-xl bg-blue-500/5 border border-blue-500/10 flex items-center justify-between gap-4">
                            <div>
                                <h4 className="text-sm font-bold text-blue-400 flex items-center gap-2"><Zap className="w-4 h-4" />{notInCatalog.length} productos Dropi sin catalogar</h4>
                                <p className="text-xs text-muted mt-1">Sincroniza para agregar con precios promedio y marca auto-asignada.</p>
                            </div>
                            <button onClick={handleSyncAll} disabled={syncing}
                                className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-black uppercase disabled:opacity-50 flex items-center gap-2 shrink-0">
                                {syncing ? <RefreshCw className="w-3.5 h-3.5 animate-spin" /> : <RefreshCw className="w-3.5 h-3.5" />} Sincronizar
                            </button>
                        </div>
                    )}

                    <div className="flex items-center gap-3 flex-wrap">
                        <div className="flex items-center gap-2 bg-hover-bg border border-card-border rounded-xl px-3 py-2 flex-1 min-w-[200px]">
                            <Search className="w-4 h-4 text-muted" />
                            <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Buscar producto o ID Dropi..."
                                className="bg-transparent text-sm outline-none flex-1" />
                        </div>
                        <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)}
                            className="bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-sm outline-none">
                            <option value="all">Todas las marcas</option>
                            {catalog.brands.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                            <option value="">Sin marca</option>
                        </select>
                        <button onClick={() => { setEditProduct(null); setShowForm(true); }}
                            className="flex items-center gap-2 px-4 py-2.5 bg-accent hover:bg-accent/80 text-white rounded-xl text-sm font-bold">
                            <Plus className="w-4 h-4" /> Nuevo
                        </button>
                    </div>

                    {/* Dropi products not cataloged */}
                    {notInCatalog.length > 0 && !search && brandFilter === 'all' && (
                        <details>
                            <summary className="cursor-pointer text-xs font-bold uppercase tracking-widest text-amber-400 flex items-center gap-2 py-2">
                                <AlertTriangle className="w-3.5 h-3.5" /> Sin catalogar ({notInCatalog.length})
                            </summary>
                            <div className="mt-2 bg-card border border-card-border rounded-2xl overflow-hidden">
                                <table className="w-full text-left">
                                    <thead><tr className="bg-hover-bg/50 text-[10px] font-black text-muted uppercase tracking-widest border-b border-card-border">
                                        <th className="px-4 py-2">ID Dropi</th><th className="px-4 py-2">Producto</th><th className="px-4 py-2">Tienda</th>
                                        <th className="px-4 py-2 text-right">Costo</th><th className="px-4 py-2 text-right">Precio</th><th className="px-4 py-2 text-right">Órd.</th><th className="px-4 py-2 w-12"></th>
                                    </tr></thead>
                                    <tbody className="divide-y divide-card-border">
                                        {notInCatalog.slice(0, 50).map(dp => (
                                            <tr key={dp.productId} className="hover:bg-hover-bg/30">
                                                <td className="px-4 py-2 font-mono text-xs text-blue-400">{dp.productId}</td>
                                                <td className="px-4 py-2 text-sm font-bold truncate max-w-[200px]">{dp.name}</td>
                                                <td className="px-4 py-2 text-xs text-muted">{dp.stores[0] || '—'}</td>
                                                <td className="px-4 py-2 text-right font-mono text-xs text-muted">{fmtCOP(dp.avgCost)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-xs">{fmtCOP(dp.avgPrice)}</td>
                                                <td className="px-4 py-2 text-right font-mono text-xs text-muted">{dp.totalOrders}</td>
                                                <td className="px-4 py-2"><button onClick={() => handleAddDropiProduct(dp)} className="p-1 text-blue-400 hover:bg-blue-500/10 rounded"><Plus className="w-3.5 h-3.5" /></button></td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </details>
                    )}

                    {/* Catalog table */}
                    <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                        <table className="w-full text-left">
                            <thead><tr className="bg-hover-bg/50 text-[10px] font-black text-muted uppercase tracking-widest border-b border-card-border">
                                <th className="px-4 py-3">Producto</th><th className="px-4 py-3">Marca</th><th className="px-4 py-3">Tipo</th>
                                <th className="px-4 py-3 text-right">Costo</th><th className="px-4 py-3 text-right">Precio</th><th className="px-4 py-3 text-right">Margen</th>
                                <th className="px-4 py-3 text-right">Recompra</th><th className="px-4 py-3 text-right">Repeat</th><th className="px-4 py-3 text-right">Días</th>
                                <th className="px-4 py-3 text-center">ID Dropi</th><th className="px-4 py-3 w-20"></th>
                            </tr></thead>
                            <tbody className="divide-y divide-card-border">
                                {filteredProducts.length === 0 ? (
                                    <tr><td colSpan={11} className="px-4 py-12 text-center text-sm text-muted">
                                        {catalog.products.length === 0 ? 'Catálogo vacío. Sincroniza desde Dropi o crea marcas primero.' : 'Sin resultados.'}
                                    </td></tr>
                                ) : filteredProducts.map(p => {
                                    const margin = p.salePrice > 0 ? ((p.salePrice - p.costPrice) / p.salePrice * 100) : 0;
                                    const brand = getBrand(p.brand_id);
                                    return (
                                        <tr key={p.id} className="hover:bg-hover-bg/30">
                                            <td className="px-4 py-3"><span className="text-sm font-bold">{p.name}</span>{p.category && <span className="text-[10px] text-muted ml-2">{p.category}</span>}</td>
                                            <td className="px-4 py-3">{brand ? (
                                                <span className="inline-flex items-center gap-1.5 text-xs font-bold px-2 py-1 rounded-lg" style={{ backgroundColor: brand.color + '15', color: brand.color }}>
                                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: brand.color }} />{brand.name}
                                                </span>
                                            ) : <span className="text-xs text-muted">—</span>}</td>
                                            <td className="px-4 py-3"><span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${p.type === 'dropi' ? 'bg-blue-500/10 text-blue-400' : 'bg-emerald-500/10 text-emerald-400'}`}>{p.type}</span></td>
                                            <td className="px-4 py-3 text-right font-mono text-sm text-muted">{fmtCOP(p.costPrice)}</td>
                                            <td className="px-4 py-3 text-right font-mono text-sm">{fmtCOP(p.salePrice)}</td>
                                            <td className="px-4 py-3 text-right"><span className={`font-mono text-sm font-bold ${margin >= 40 ? 'text-emerald-400' : margin >= 20 ? 'text-amber-400' : 'text-red-400'}`}>{margin.toFixed(1)}%</span></td>
                                            {(() => {
                                                const rep = getRepurchase(p);
                                                if (!rep) return (<><td className="px-4 py-3 text-right text-muted text-xs">—</td><td className="px-4 py-3 text-right text-muted text-xs">—</td><td className="px-4 py-3 text-right text-muted text-xs">—</td></>);
                                                const rColor = rep.healthLevel === 'excellent' ? 'text-emerald-400' : rep.healthLevel === 'good' ? 'text-blue-400' : rep.healthLevel === 'average' ? 'text-amber-400' : 'text-red-400';
                                                return (<>
                                                    <td className="px-4 py-3 text-right">
                                                        <div className="flex items-center justify-end gap-1.5">
                                                            <span className={`font-mono text-sm font-bold ${rColor}`}>{rep.repurchaseRate}%</span>
                                                            <span className={`text-[8px] font-bold px-1 py-0.5 rounded uppercase ${rep.healthLevel === 'excellent' ? 'bg-emerald-400/15 text-emerald-400' : rep.healthLevel === 'good' ? 'bg-blue-400/15 text-blue-400' : rep.healthLevel === 'average' ? 'bg-amber-400/15 text-amber-400' : 'bg-red-400/15 text-red-400'}`}>
                                                                {rep.healthLevel === 'excellent' ? '★' : rep.healthLevel === 'good' ? '●' : rep.healthLevel === 'average' ? '◐' : '○'}
                                                            </span>
                                                        </div>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-mono text-xs text-muted">{rep.repeatCustomers}/{rep.uniqueCustomers}</span>
                                                    </td>
                                                    <td className="px-4 py-3 text-right">
                                                        <span className="font-mono text-xs text-muted">{rep.avgDaysBetweenPurchases > 0 ? `${rep.avgDaysBetweenPurchases}d` : '—'}</span>
                                                    </td>
                                                </>);
                                            })()}
                                            <td className="px-4 py-3 text-center"><div className="flex flex-wrap gap-1 justify-center">{p.dropiProductIds.map((id, i) => (
                                                <span key={i} className="px-1.5 py-0.5 bg-blue-500/10 text-blue-400 rounded text-[10px] font-mono">{id}</span>
                                            ))}</div></td>
                                            <td className="px-4 py-3"><div className="flex items-center gap-1 justify-end">
                                                <button onClick={() => { setEditProduct(p); setShowForm(true); }} className="p-1.5 text-muted hover:text-foreground rounded"><Edit3 className="w-3.5 h-3.5" /></button>
                                                <button onClick={() => handleDeleteProduct(p.id)} className="p-1.5 text-muted hover:text-red-400 rounded"><Trash2 className="w-3.5 h-3.5" /></button>
                                            </div></td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            {showForm && <ProductForm product={editProduct} brands={catalog.brands} onSave={handleSaveProduct} onCancel={() => { setShowForm(false); setEditProduct(null); }} />}
        </div>
    );
}
