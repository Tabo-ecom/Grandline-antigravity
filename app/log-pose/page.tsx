'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { getAllOrderFiles } from '@/lib/firebase/firestore';
import { listProjections, saveProjection, deleteProjection, SavedProjection } from '@/lib/firebase/firestore';
import { DropiOrder } from '@/lib/calculations/kpis';
import { fetchExchangeRates, toCOP, getCurrencyForCountry, formatCurrency, getOfficialCountryName } from '@/lib/utils/currency';
import { getProductGroups, getProductGroup, extraerBase } from '@/lib/services/marketing';
import {
    Compass, TrendingUp, ShieldAlert, Package, Zap, Target, DollarSign,
    BarChart3, Percent, Shield, AlertTriangle, Check, Save, Trash2, Clock, History, ChevronDown, ChevronUp
} from 'lucide-react';
import { isEntregado, isCancelado } from '@/lib/utils/status';

export default function LogPosePage() {
    const { effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);

    const [productCatalog, setProductCatalog] = useState<Record<string, {
        name: string, avgPrice: number, avgCost: number, avgShipping: number,
        typicalDelivery: number, avgCpa: number, country: string
    }>>({});

    // Simulator State
    const [simState, setSimState] = useState({
        selectedProductId: '',
        targetSales: 100,
        targetCpa: 0,
        customPrice: 0,
        customCost: 0,
        customShipping: 0,
        customDelivery: 80,
        customCancelRate: 15,
    });

    // Calculator State
    const [calcState, setCalcState] = useState({
        costo: 0,
        flete: 0,
        otros: 0,
        cpaProyectado: 0,
        margenDeseado: 30,
        seguroDevolucion: 10,
    });

    const [activeSection, setActiveSection] = useState<'simulator' | 'calculator'>('simulator');

    // History State
    const [savedProjections, setSavedProjections] = useState<SavedProjection[]>([]);
    const [showHistory, setShowHistory] = useState(false);
    const [saveName, setSaveName] = useState('');
    const [showSaveInput, setShowSaveInput] = useState(false);
    const [saving, setSaving] = useState(false);
    const [showRevenueBreakdown, setShowRevenueBreakdown] = useState(false);

    useEffect(() => {
        async function loadData() {
            try {
                const [files, exchangeRates, groups] = await Promise.all([
                    getAllOrderFiles(effectiveUid || ''),
                    fetchExchangeRates(),
                    getProductGroups(effectiveUid || '')
                ]);
                const catalog: any = {};
                const stats: Record<string, {
                    prices: number[], costs: number[], shippings: number[], statuses: string[]
                }> = {};

                files.forEach((file: any) => {
                    if (file.orders) {
                        const country = getOfficialCountryName(file.country || 'Unknown');
                        const currency = getCurrencyForCountry(country);

                        file.orders.forEach((o: DropiOrder) => {
                            const rawName = o.PRODUCTO || '';
                            if (!rawName || /^\d+$/.test(rawName.trim())) return;

                            const normalizedName = extraerBase(rawName);
                            if (!normalizedName || /^\d+$/.test(normalizedName) || normalizedName.length < 2) return;

                            const pid = normalizedName;
                            if (!stats[pid]) stats[pid] = { prices: [], costs: [], shippings: [], statuses: [] };

                            const price = toCOP(o["TOTAL DE LA ORDEN"], currency, exchangeRates);
                            const cost = toCOP(o["PRECIO PROVEEDOR X CANTIDAD"] || o["PRECIO PROVEEDOR"] || 0, currency, exchangeRates);
                            const ship = toCOP(o["PRECIO FLETE"] || 0, currency, exchangeRates);

                            if (price > 0) stats[pid].prices.push(price);
                            if (cost > 0) stats[pid].costs.push(cost);
                            if (ship > 0) stats[pid].shippings.push(ship);
                            stats[pid].statuses.push(o.ESTATUS || '');
                        });
                    }
                });

                Object.entries(stats).forEach(([pid, data]) => {
                    const avgPrice = data.prices.length > 0 ? data.prices.reduce((a, b) => a + b, 0) / data.prices.length : 0;
                    const avgCost = data.costs.length > 0 ? data.costs.reduce((a, b) => a + b, 0) / data.costs.length : 0;
                    const avgShip = data.shippings.length > 0 ? data.shippings.reduce((a, b) => a + b, 0) / data.shippings.length : 0;
                    const delivered = data.statuses.filter(s => isEntregado(s)).length;
                    const canceled = data.statuses.filter(s => isCancelado(s)).length;
                    const total = data.statuses.length;
                    const nonCanceled = total - canceled;
                    const deliveryRate = nonCanceled > 0 ? (delivered / nonCanceled) * 100 : 80;

                    catalog[pid] = {
                        name: getProductGroup(pid, groups)?.name || pid,
                        avgPrice, avgCost, avgShipping: avgShip,
                        typicalDelivery: Math.round(deliveryRate),
                        avgCpa: 0, country: ''
                    };
                });

                setProductCatalog(catalog);
            } catch (error) {
                console.error('Error loading Log Pose data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, []);

    // Load saved projections
    const loadHistory = useCallback(async () => {
        if (!effectiveUid) return;
        try {
            const projections = await listProjections(effectiveUid);
            setSavedProjections(projections);
        } catch (err) { console.error('Error loading projections:', err); }
    }, [effectiveUid]);

    useEffect(() => { loadHistory(); }, [loadHistory]);

    // ─── Simulator Projection ────────────────────────────────
    const projection = useMemo(() => {
        const { targetSales, targetCpa, customPrice, customCost, customShipping, customDelivery, customCancelRate } = simState;

        const ventasTotales = targetSales;
        const canceladas = Math.round(ventasTotales * (customCancelRate / 100));
        const despachadas = ventasTotales - canceladas;
        const entregadas = Math.round(despachadas * (customDelivery / 100));
        const noEntregadas = despachadas - entregadas;

        const facturacionTotal = ventasTotales * customPrice;
        const facturacionDespachada = despachadas * customPrice;
        const ingresoEntregado = entregadas * customPrice;

        const costoProducto = entregadas * customCost;
        const fleteEntregados = entregadas * customShipping;
        const fleteDevoluciones = noEntregadas * customShipping * 1.4;
        const inversionAds = ventasTotales * targetCpa;

        const utilidadNeta = ingresoEntregado - costoProducto - fleteEntregados - fleteDevoluciones - inversionAds;

        const roas = inversionAds > 0 ? ingresoEntregado / inversionAds : 0;
        const margenNeto = ingresoEntregado > 0 ? (utilidadNeta / ingresoEntregado) * 100 : 0;
        const costoTotal = costoProducto + fleteEntregados + fleteDevoluciones + inversionAds;
        const percAdsDesp = facturacionDespachada > 0 ? (inversionAds / facturacionDespachada) * 100 : 0;

        return {
            ventasTotales, canceladas, despachadas, entregadas, noEntregadas,
            facturacionTotal, facturacionDespachada, ingresoEntregado,
            costoProducto, fleteEntregados, fleteDevoluciones, inversionAds,
            utilidadNeta, roas, margenNeto, costoTotal, percAdsDesp
        };
    }, [simState]);

    // ─── Calculator ──────────────────────────────────────────
    const calculatorResults = useMemo(() => {
        const { costo, flete, otros, cpaProyectado, margenDeseado, seguroDevolucion } = calcState;

        const costoBase = costo + flete + otros;
        const montoSeguro = costoBase * (seguroDevolucion / 100);
        const costoTotalUnidad = costoBase + montoSeguro + cpaProyectado;

        const precioSugerido = margenDeseado < 100 ? costoTotalUnidad / (1 - (margenDeseado / 100)) : 0;
        const utilidadPorUnidad = precioSugerido - costoTotalUnidad;
        const breakevenRoas = precioSugerido > 0 ? precioSugerido / costoTotalUnidad : 0;
        const cpaBreakeven = precioSugerido - (costoBase + montoSeguro);

        const precioFinal = Math.ceil(precioSugerido / 1000) * 1000;

        return {
            costoBase, montoSeguro, costoTotalUnidad,
            precioSugerido, precioFinal, utilidadPorUnidad, breakevenRoas, cpaBreakeven
        };
    }, [calcState]);

    const handleSelectProduct = (pid: string) => {
        const product = productCatalog[pid];
        if (!product) return;

        setSimState(prev => ({
            ...prev,
            selectedProductId: pid,
            customPrice: Math.round(product.avgPrice),
            customCost: Math.round(product.avgCost),
            customShipping: Math.round(product.avgShipping),
            customDelivery: product.typicalDelivery,
            customCancelRate: 15,
            targetCpa: product.avgCpa || Math.round(product.avgPrice * 0.2)
        }));

        setCalcState(prev => ({
            ...prev,
            costo: Math.round(product.avgCost),
            flete: Math.round(product.avgShipping),
            cpaProyectado: Math.round(product.avgPrice * 0.2)
        }));
    };

    const handleSaveProjection = async () => {
        if (!effectiveUid || !saveName.trim()) return;
        setSaving(true);
        try {
            if (activeSection === 'simulator') {
                await saveProjection({
                    userId: effectiveUid,
                    name: saveName.trim(),
                    type: 'simulator',
                    params: { ...simState },
                    results: { ...projection },
                });
            } else {
                await saveProjection({
                    userId: effectiveUid,
                    name: saveName.trim(),
                    type: 'calculator',
                    params: { ...calcState },
                    results: { ...calculatorResults },
                });
            }
            setSaveName('');
            setShowSaveInput(false);
            await loadHistory();
        } catch (err) { console.error('Error saving projection:', err); } finally {
            setSaving(false);
        }
    };

    const handleDeleteProjection = async (id: string) => {
        try {
            await deleteProjection(id);
            setSavedProjections(prev => prev.filter(p => p.id !== id));
        } catch { /* ignore */ }
    };

    const handleLoadProjection = (proj: SavedProjection) => {
        if (proj.type === 'simulator') {
            setSimState(proj.params as any);
            setActiveSection('simulator');
        } else {
            setCalcState(proj.params as any);
            setActiveSection('calculator');
        }
        setShowHistory(false);
    };

    const getRecommendations = () => {
        const recs: { type: 'success' | 'warning' | 'danger'; text: string }[] = [];
        const { roas, utilidadNeta, margenNeto, percAdsDesp } = projection;

        if (roas >= 2 && utilidadNeta > 0) recs.push({ type: 'success', text: 'Escenario saludable. ROAS y utilidad en rango optimo.' });
        if (roas < 2 && roas > 0) recs.push({ type: 'warning', text: `ROAS proyectado de ${roas.toFixed(2)}x es bajo. Considera optimizar creativos o subir el precio.` });
        if (simState.targetCpa > simState.customPrice * 0.3) recs.push({ type: 'danger', text: 'Tu CPA supera el 30% del precio. Esto presiona gravemente tus margenes.' });
        if (utilidadNeta < 0) recs.push({ type: 'danger', text: 'Este escenario genera perdidas. Revisa costos o aumenta el % de entrega.' });
        if (simState.customDelivery < 60) recs.push({ type: 'warning', text: 'Con entrega menor al 60%, los fletes de devolucion consumiran tu margen.' });
        if (margenNeto > 0 && margenNeto < 15) recs.push({ type: 'warning', text: `Margen neto de ${margenNeto.toFixed(1)}% es ajustado. El objetivo minimo es 15%.` });
        if (percAdsDesp > 30) recs.push({ type: 'danger', text: `Ads representa ${percAdsDesp.toFixed(1)}% de lo despachado. Objetivo: <25%.` });

        return recs;
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6">
                <div className="relative">
                    <div className="w-16 h-16 rounded-3xl border-2 border-accent/20 animate-[spin_3s_linear_infinite]" />
                    <div className="absolute inset-0 flex items-center justify-center">
                        <Compass className="w-8 h-8 text-accent animate-pulse" />
                    </div>
                </div>
                <p className="text-muted font-black text-[10px] animate-pulse tracking-[0.3em] uppercase">Sincronizando Brujula...</p>
            </div>
        );
    }

    return (
        <div className="p-4 md:p-6 selection:bg-accent/30">
            <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-700">
                {/* Header & Tabs */}
                <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                    <div>
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-10 h-10 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20">
                                <Compass className="w-5 h-5 text-accent" />
                            </div>
                            <h1 className="text-2xl font-black tracking-tight uppercase italic text-foreground">Log Pose</h1>
                        </div>
                        <p className="text-xs text-muted font-bold uppercase tracking-widest pl-13">Simulador de Escenarios y Calculadora de Precios</p>
                    </div>

                    <div className="flex items-center gap-3">
                        {/* History toggle */}
                        <button
                            onClick={() => setShowHistory(!showHistory)}
                            className={`px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border ${showHistory ? 'bg-accent/10 border-accent/20 text-accent' : 'bg-card border-card-border text-muted hover:text-foreground'}`}
                        >
                            <div className="flex items-center gap-2">
                                <History className="w-3.5 h-3.5" />
                                Historial
                                {savedProjections.length > 0 && (
                                    <span className="bg-accent/20 text-accent text-[9px] px-1.5 py-0.5 rounded-full font-black">{savedProjections.length}</span>
                                )}
                            </div>
                        </button>

                        {/* Save button */}
                        {!showSaveInput ? (
                            <button
                                onClick={() => setShowSaveInput(true)}
                                className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all bg-accent/10 border border-accent/20 text-accent hover:bg-accent/20"
                            >
                                <div className="flex items-center gap-2">
                                    <Save className="w-3.5 h-3.5" />
                                    Guardar
                                </div>
                            </button>
                        ) : (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={saveName}
                                    onChange={(e) => setSaveName(e.target.value)}
                                    placeholder="Nombre..."
                                    className="bg-card border border-card-border rounded-xl px-3 py-2 text-xs font-bold focus:outline-none focus:border-accent transition-colors text-foreground w-40"
                                    onKeyDown={(e) => e.key === 'Enter' && handleSaveProjection()}
                                    autoFocus
                                />
                                <button
                                    onClick={handleSaveProjection}
                                    disabled={!saveName.trim() || saving}
                                    className="px-3 py-2 rounded-xl bg-accent text-white text-[10px] font-black uppercase disabled:opacity-50"
                                >
                                    {saving ? '...' : 'OK'}
                                </button>
                                <button
                                    onClick={() => { setShowSaveInput(false); setSaveName(''); }}
                                    className="text-muted hover:text-foreground text-xs"
                                >
                                    ✕
                                </button>
                            </div>
                        )}

                        {/* Tab switcher */}
                        <div className="flex p-1 bg-hover-bg rounded-2xl border border-card-border">
                            <button
                                onClick={() => setActiveSection('simulator')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSection === 'simulator' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-foreground'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <Target className="w-3.5 h-3.5" />
                                    Simulador
                                </div>
                            </button>
                            <button
                                onClick={() => setActiveSection('calculator')}
                                className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeSection === 'calculator' ? 'bg-accent text-white shadow-lg shadow-accent/20' : 'text-muted hover:text-foreground'}`}
                            >
                                <div className="flex items-center gap-2">
                                    <DollarSign className="w-3.5 h-3.5" />
                                    Calculadora
                                </div>
                            </button>
                        </div>
                    </div>
                </div>

                {/* ─── History Panel ──────────────────────────── */}
                {showHistory && (
                    <div className="bg-card border border-card-border rounded-3xl p-5 shadow-sm">
                        <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-4 flex items-center gap-2">
                            <Clock className="w-4 h-4 text-accent" /> Proyecciones Guardadas
                        </h3>
                        {savedProjections.length === 0 ? (
                            <p className="text-xs text-muted text-center py-6">No hay proyecciones guardadas aun.</p>
                        ) : (
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                                {savedProjections.map((proj) => (
                                    <div key={proj.id} className="bg-hover-bg border border-card-border rounded-2xl p-4 hover:border-accent/20 transition-all group">
                                        <div className="flex items-start justify-between mb-3">
                                            <div>
                                                <p className="text-sm font-bold text-foreground">{proj.name}</p>
                                                <p className="text-[10px] text-muted flex items-center gap-1.5 mt-0.5">
                                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-black uppercase ${proj.type === 'simulator' ? 'bg-indigo-500/10 text-indigo-400' : 'bg-emerald-500/10 text-emerald-400'}`}>
                                                        {proj.type === 'simulator' ? 'Simulador' : 'Calculadora'}
                                                    </span>
                                                    {proj.createdAt && new Date(proj.createdAt.seconds * 1000).toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' })}
                                                </p>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteProjection(proj.id!)}
                                                className="text-muted hover:text-rose-400 transition-colors opacity-0 group-hover:opacity-100"
                                            >
                                                <Trash2 className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                        <div className="text-[10px] text-muted space-y-1 mb-3">
                                            {proj.type === 'simulator' ? (
                                                <>
                                                    <p>Ventas: <span className="text-foreground font-bold">{proj.params.targetSales}</span> uds</p>
                                                    <p>Utilidad: <span className={`font-bold ${(proj.results.utilidadNeta || 0) >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}>{formatCurrency(proj.results.utilidadNeta || 0)}</span></p>
                                                </>
                                            ) : (
                                                <>
                                                    <p>Precio: <span className="text-foreground font-bold">{formatCurrency(proj.results.precioFinal || 0)}</span></p>
                                                    <p>Margen: <span className="text-emerald-400 font-bold">{proj.params.margenDeseado}%</span></p>
                                                </>
                                            )}
                                        </div>
                                        <button
                                            onClick={() => handleLoadProjection(proj)}
                                            className="w-full text-center text-[10px] font-black uppercase tracking-widest text-accent hover:text-white hover:bg-accent/20 py-2 rounded-xl transition-colors border border-accent/10"
                                        >
                                            Cargar
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                {activeSection === 'simulator' ? (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        {/* ─── Controls ────────────── */}
                        <div className="lg:col-span-4 space-y-4">
                            <div className="bg-card backdrop-blur-xl border border-card-border p-6 rounded-3xl space-y-5 shadow-sm">
                                <div className="space-y-3">
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest block">Plantilla de Producto</label>
                                    <select
                                        value={simState.selectedProductId}
                                        onChange={(e) => handleSelectProduct(e.target.value)}
                                        className="w-full bg-hover-bg border border-card-border rounded-2xl px-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-accent transition-colors"
                                    >
                                        <option value="">Selecciona un producto...</option>
                                        {Object.entries(productCatalog).map(([id, p]) => (
                                            <option key={id} value={id}>{p.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <SliderInput
                                    label="Meta de Ventas"
                                    value={simState.targetSales}
                                    min={10} max={1000} step={10}
                                    icon={Package} iconColor="text-accent"
                                    onChange={(v) => setSimState({ ...simState, targetSales: v })}
                                    suffix=" uds"
                                />

                                <NumberInput
                                    label="Precio de Venta"
                                    value={simState.customPrice}
                                    icon={DollarSign} iconColor="text-accent"
                                    onChange={(v) => setSimState({ ...simState, customPrice: v })}
                                />

                                <NumberInput
                                    label="Costo Producto"
                                    value={simState.customCost}
                                    icon={Package} iconColor="text-amber-400"
                                    onChange={(v) => setSimState({ ...simState, customCost: v })}
                                />

                                <NumberInput
                                    label="Flete Promedio"
                                    value={simState.customShipping}
                                    icon={Compass} iconColor="text-cyan-400"
                                    onChange={(v) => setSimState({ ...simState, customShipping: v })}
                                />

                                <NumberInput
                                    label="CPA Objetivo (Ads)"
                                    value={simState.targetCpa}
                                    icon={Zap} iconColor="text-rose-400"
                                    onChange={(v) => setSimState({ ...simState, targetCpa: v })}
                                />

                                <SliderInput
                                    label="% Cancelacion Proyectada"
                                    value={simState.customCancelRate}
                                    min={0} max={50} step={1}
                                    icon={AlertTriangle} iconColor="text-amber-400"
                                    onChange={(v) => setSimState({ ...simState, customCancelRate: v })}
                                    suffix="%"
                                    accentColor="accent-amber-500"
                                    valueColor="text-amber-400"
                                />

                                <SliderInput
                                    label="% Entrega Proyectada"
                                    value={simState.customDelivery}
                                    min={30} max={100} step={1}
                                    icon={TrendingUp} iconColor="text-emerald-400"
                                    onChange={(v) => setSimState({ ...simState, customDelivery: v })}
                                    suffix="%"
                                    accentColor="accent-emerald-500"
                                    valueColor="text-emerald-400"
                                />
                            </div>
                        </div>

                        {/* ─── Results ─────────────── */}
                        <div className="lg:col-span-8 space-y-5">
                            {/* KPI Cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <StatCard title="ROAS Proyectado" value={`${projection.roas.toFixed(2)}x`} icon={TrendingUp} color={projection.roas >= 2 ? 'emerald' : projection.roas >= 1 ? 'amber' : 'rose'} />
                                <StatCard title="Margen Neto" value={`${projection.margenNeto.toFixed(1)}%`} icon={Percent} color={projection.margenNeto >= 15 ? 'emerald' : projection.margenNeto > 0 ? 'amber' : 'rose'} />
                                <StatCard title="Inversion Ads" value={formatCurrency(projection.inversionAds)} subtitle={`${projection.percAdsDesp.toFixed(1)}% s/ despachado`} icon={Zap} color={projection.percAdsDesp <= 20 ? 'emerald' : projection.percAdsDesp <= 30 ? 'amber' : 'rose'} />
                                <StatCard title="Utilidad Neta" value={formatCurrency(projection.utilidadNeta)} icon={BarChart3} color={projection.utilidadNeta >= 0 ? 'emerald' : 'rose'} />
                            </div>

                            {/* P&L Waterfall Breakdown */}
                            <div className="bg-card border border-card-border rounded-3xl p-6 shadow-sm">
                                <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-accent" /> Desglose de Proyeccion P&L
                                </h3>

                                {/* Orders funnel */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-6">
                                    <FunnelStep label="Ventas Totales" value={projection.ventasTotales} unit="uds" color="text-foreground" />
                                    <FunnelStep label="Canceladas" value={projection.canceladas} unit="uds" color="text-amber-400" prefix="-" />
                                    <FunnelStep label="Despachadas" value={projection.despachadas} unit="uds" color="text-blue-400" />
                                    <FunnelStep label="Entregadas" value={projection.entregadas} unit="uds" color="text-emerald-400" />
                                    <FunnelStep label="No Entregadas" value={projection.noEntregadas} unit="uds" color="text-rose-400" />
                                </div>

                                {/* Financial waterfall */}
                                <div className="space-y-0 border border-card-border rounded-2xl overflow-hidden">
                                    {/* Collapsible revenue group */}
                                    <button
                                        onClick={() => setShowRevenueBreakdown(!showRevenueBreakdown)}
                                        className="w-full flex items-center justify-between px-4 py-3 bg-foreground/[0.04] hover:bg-foreground/[0.06] transition-colors cursor-pointer"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <p className="text-xs font-black text-foreground">Ingreso Entregado</p>
                                            <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-400">{projection.entregadas} uds</span>
                                            {showRevenueBreakdown
                                                ? <ChevronUp className="w-3.5 h-3.5 text-muted" />
                                                : <ChevronDown className="w-3.5 h-3.5 text-muted" />
                                            }
                                        </div>
                                        <p className="text-sm font-black font-mono shrink-0 ml-4 text-emerald-400">{formatCurrency(projection.ingresoEntregado)}</p>
                                    </button>
                                    {showRevenueBreakdown && (
                                        <div className="border-t border-card-border bg-foreground/[0.02]">
                                            <WaterfallRow label="Facturacion Total" sublabel={`${projection.ventasTotales} uds x ${formatCurrency(simState.customPrice)}`} value={projection.facturacionTotal} type="neutral" />
                                            <WaterfallRow label="Facturacion Despachada" sublabel={`${projection.despachadas} uds despachadas`} value={projection.facturacionDespachada} type="neutral" />
                                            <WaterfallRow label="Ingreso Entregado" sublabel={`${projection.entregadas} uds entregadas`} value={projection.ingresoEntregado} type="income" />
                                        </div>
                                    )}

                                    <div className="h-px bg-card-border" />

                                    <WaterfallRow label="Costo de Producto" sublabel={`${projection.entregadas} uds x ${formatCurrency(simState.customCost)}`} value={-projection.costoProducto} type="expense" />
                                    <WaterfallRow label="Flete Entregados" sublabel={`${projection.entregadas} uds x ${formatCurrency(simState.customShipping)}`} value={-projection.fleteEntregados} type="expense" />
                                    <WaterfallRow label="Flete Devoluciones" sublabel={`${projection.noEntregadas} uds x ${formatCurrency(simState.customShipping)} x 1.4`} value={-projection.fleteDevoluciones} type="expense" />
                                    <WaterfallRow
                                        label="Inversion en Ads"
                                        sublabel={`${projection.ventasTotales} uds x ${formatCurrency(simState.targetCpa)} CPA`}
                                        value={-projection.inversionAds}
                                        type="expense"
                                        badge={`${projection.percAdsDesp.toFixed(1)}% s/ despachado`}
                                    />

                                    <div className="h-px bg-card-border" />

                                    <WaterfallRow label="UTILIDAD NETA PROYECTADA" value={projection.utilidadNeta} type={projection.utilidadNeta >= 0 ? 'profit' : 'loss'} highlight />
                                </div>
                            </div>

                            {/* Recommendations */}
                            {getRecommendations().length > 0 && (
                                <div className="bg-card border border-card-border p-5 rounded-3xl space-y-3 shadow-sm">
                                    <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] flex items-center gap-2">
                                        <Zap className="w-4 h-4 text-amber-500" /> Recomendaciones
                                    </h3>
                                    <div className="space-y-2">
                                        {getRecommendations().map((rec, i) => (
                                            <div key={i} className={`flex items-start gap-3 p-3 rounded-xl border text-xs font-medium leading-relaxed ${
                                                rec.type === 'success' ? 'bg-emerald-500/5 border-emerald-500/10 text-emerald-400' :
                                                rec.type === 'warning' ? 'bg-amber-500/5 border-amber-500/10 text-amber-400' :
                                                'bg-rose-500/5 border-rose-500/10 text-rose-400'
                                            }`}>
                                                {rec.type === 'success' ? <Check className="w-4 h-4 shrink-0 mt-0.5" /> :
                                                 rec.type === 'warning' ? <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" /> :
                                                 <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />}
                                                <span>{rec.text}</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    </div>
                ) : (
                    /* ─── CALCULATOR TAB ──────────────────────── */
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        <div className="lg:col-span-4 space-y-4">
                            <div className="bg-card border border-card-border p-6 rounded-3xl space-y-5 shadow-sm">
                                <NumberInput
                                    label="Costo del Producto"
                                    value={calcState.costo}
                                    icon={Package} iconColor="text-accent"
                                    onChange={(v) => setCalcState({ ...calcState, costo: v })}
                                />

                                <NumberInput
                                    label="Promedio Flete (Dropi)"
                                    value={calcState.flete}
                                    icon={Compass} iconColor="text-cyan-400"
                                    onChange={(v) => setCalcState({ ...calcState, flete: v })}
                                />

                                <NumberInput
                                    label="Otros Gastos p/ Unidad"
                                    value={calcState.otros}
                                    icon={DollarSign} iconColor="text-muted"
                                    onChange={(v) => setCalcState({ ...calcState, otros: v })}
                                />

                                <NumberInput
                                    label="CPA Proyectado (Ads)"
                                    value={calcState.cpaProyectado}
                                    icon={Zap} iconColor="text-rose-400"
                                    onChange={(v) => setCalcState({ ...calcState, cpaProyectado: v })}
                                />

                                <SliderInput
                                    label="% Seguro de Devolucion"
                                    value={calcState.seguroDevolucion}
                                    min={0} max={30} step={1}
                                    icon={Shield} iconColor="text-amber-400"
                                    onChange={(v) => setCalcState({ ...calcState, seguroDevolucion: v })}
                                    suffix="%"
                                    accentColor="accent-amber-500"
                                    valueColor="text-amber-400"
                                />

                                <SliderInput
                                    label="Margen de Utilidad Deseado"
                                    value={calcState.margenDeseado}
                                    min={5} max={70} step={5}
                                    icon={TrendingUp} iconColor="text-emerald-400"
                                    onChange={(v) => setCalcState({ ...calcState, margenDeseado: v })}
                                    suffix="%"
                                    accentColor="accent-emerald-500"
                                    valueColor="text-emerald-400"
                                />
                            </div>
                        </div>

                        <div className="lg:col-span-8 space-y-5">
                            {/* Result cards */}
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                                <StatCard title="Precio Sugerido" value={formatCurrency(calculatorResults.precioSugerido)} icon={DollarSign} color="indigo" />
                                <StatCard title="Utilidad p/ Unidad" value={formatCurrency(calculatorResults.utilidadPorUnidad)} icon={TrendingUp} color="emerald" />
                                <StatCard title="CPA Breakeven" value={formatCurrency(calculatorResults.cpaBreakeven)} icon={Zap} color="rose" />
                                <StatCard title="ROAS Breakeven" value={`${calculatorResults.breakevenRoas.toFixed(2)}x`} icon={Target} color="amber" />
                            </div>

                            {/* Price breakdown waterfall */}
                            <div className="bg-card border border-card-border rounded-3xl p-6 shadow-sm">
                                <h3 className="text-[10px] font-black text-muted uppercase tracking-[0.3em] mb-5 flex items-center gap-2">
                                    <BarChart3 className="w-4 h-4 text-accent" /> Desglose del Precio
                                </h3>

                                <div className="space-y-0 border border-card-border rounded-2xl overflow-hidden">
                                    <WaterfallRow label="Costo de Producto" value={calcState.costo} type="expense" />
                                    <WaterfallRow label="Flete Promedio" value={calcState.flete} type="expense" />
                                    <WaterfallRow label="Otros Gastos" value={calcState.otros} type="expense" />
                                    <div className="h-px bg-card-border" />
                                    <WaterfallRow label="Costo Base" value={calculatorResults.costoBase} type="neutral" highlight />
                                    <div className="h-px bg-card-border" />
                                    <WaterfallRow label={`Seguro Devolucion (${calcState.seguroDevolucion}%)`} sublabel="Colchon para cubrir perdidas por devoluciones" value={calculatorResults.montoSeguro} type="expense" />
                                    <WaterfallRow label="CPA Proyectado (Ads)" sublabel="Costo de adquisicion por unidad" value={calcState.cpaProyectado} type="expense" />
                                    <div className="h-px bg-card-border" />
                                    <WaterfallRow label="Costo Total por Unidad" value={calculatorResults.costoTotalUnidad} type="neutral" highlight />
                                    <WaterfallRow label={`Margen Deseado (${calcState.margenDeseado}%)`} value={calculatorResults.utilidadPorUnidad} type="income" />
                                    <div className="h-px bg-card-border" />
                                    <WaterfallRow label="PRECIO SUGERIDO" value={calculatorResults.precioSugerido} type="profit" highlight />
                                </div>
                            </div>

                            {/* Final Price */}
                            <div className="relative bg-gradient-to-br from-accent/5 to-purple-500/5 rounded-3xl p-8 border border-accent/10 flex flex-col items-center justify-center text-center space-y-4 overflow-hidden">
                                <div className="absolute inset-0 bg-gradient-to-r from-accent/5 to-transparent pointer-events-none" />
                                <div className="relative">
                                    <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center border border-accent/20 mb-3 mx-auto">
                                        <DollarSign className="w-7 h-7 text-accent" />
                                    </div>
                                    <h4 className="text-sm font-black uppercase tracking-widest text-muted mb-2">Precio Final Recomendado</h4>
                                    <p className="text-5xl font-black text-foreground tracking-tighter">{formatCurrency(calculatorResults.precioFinal)}</p>
                                    <p className="text-[10px] text-muted font-bold uppercase tracking-widest mt-3">
                                        Incluye seguro de devolucion ({calcState.seguroDevolucion}%) + CPA ({formatCurrency(calcState.cpaProyectado)}) + margen ({calcState.margenDeseado}%)
                                    </p>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

/* ─── Reusable Components ──────────────────────────────────── */

function SliderInput({ label, value, min, max, step, icon: Icon, iconColor, onChange, suffix = '', accentColor = 'accent-accent', valueColor = 'text-foreground' }: {
    label: string; value: number; min: number; max: number; step: number;
    icon: any; iconColor: string; onChange: (v: number) => void;
    suffix?: string; accentColor?: string; valueColor?: string;
}) {
    return (
        <div className="space-y-3">
            <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-2">
                    <Icon className={`w-3.5 h-3.5 ${iconColor}`} /> {label}
                </span>
                <span className={`text-sm font-black font-mono ${valueColor}`}>{value}{suffix}</span>
            </div>
            <input
                type="range" min={min} max={max} step={step}
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value))}
                className={`w-full h-1 bg-foreground/5 rounded-full appearance-none cursor-pointer ${accentColor}`}
            />
        </div>
    );
}

function NumberInput({ label, value, icon: Icon, iconColor, onChange }: {
    label: string; value: number; icon: any; iconColor: string; onChange: (v: number) => void;
}) {
    return (
        <div className="space-y-2">
            <label className="text-[10px] font-black text-muted uppercase tracking-widest block flex items-center gap-2">
                <Icon className={`w-3.5 h-3.5 ${iconColor}`} /> {label}
            </label>
            <input
                type="number"
                value={value}
                onChange={(e) => onChange(parseInt(e.target.value) || 0)}
                className="w-full bg-hover-bg border border-card-border rounded-2xl px-4 py-3 text-sm font-bold text-foreground focus:outline-none focus:border-accent transition-colors"
            />
        </div>
    );
}

function FunnelStep({ label, value, unit, color, prefix = '' }: {
    label: string; value: number; unit: string; color: string; prefix?: string;
}) {
    return (
        <div className="bg-hover-bg border border-card-border rounded-xl p-3 text-center">
            <p className="text-[9px] font-bold text-muted uppercase tracking-wider mb-1">{label}</p>
            <p className={`text-lg font-black ${color}`}>{prefix}{value.toLocaleString()}</p>
            <p className="text-[9px] text-muted/60">{unit}</p>
        </div>
    );
}

function WaterfallRow({ label, sublabel, value, type, highlight, badge }: {
    label: string; sublabel?: string; value: number; type: 'income' | 'expense' | 'neutral' | 'profit' | 'loss'; highlight?: boolean; badge?: string;
}) {
    const isNeg = value < 0;
    const absValue = Math.abs(value);

    let valueColor = 'text-foreground/70';
    if (type === 'income' || type === 'profit') valueColor = 'text-emerald-400';
    if (type === 'expense') valueColor = 'text-rose-400';
    if (type === 'loss') valueColor = 'text-rose-400';

    return (
        <div className={`flex items-center justify-between px-4 py-3 ${highlight ? 'bg-foreground/[0.04]' : 'hover:bg-foreground/[0.02]'} transition-colors`}>
            <div className="min-w-0">
                <div className="flex items-center gap-2">
                    <p className={`text-xs ${highlight ? 'font-black text-foreground' : 'font-semibold text-muted'}`}>{label}</p>
                    {badge && (
                        <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-400">{badge}</span>
                    )}
                </div>
                {sublabel && <p className="text-[10px] text-muted/60 mt-0.5">{sublabel}</p>}
            </div>
            <p className={`text-sm font-black font-mono shrink-0 ml-4 ${valueColor}`}>
                {isNeg ? '-' : type === 'expense' ? '-' : ''}{formatCurrency(absValue)}
            </p>
        </div>
    );
}

function StatCard({ title, value, subtitle, icon: Icon, color }: { title: string; value: string; subtitle?: string; icon: any; color: string }) {
    const themeColors: Record<string, string> = {
        emerald: '#10b981', blue: '#3182ce', indigo: '#6366f1',
        amber: '#f59e0b', rose: '#f43f5e', purple: '#a855f7', cyan: '#06b6d4'
    };
    const textColor = themeColors[color] || '#6366f1';

    return (
        <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-foreground/10 transition-all group shadow-sm relative overflow-hidden">
            <div className="absolute top-0 right-0 w-24 h-24 blur-[60px] opacity-[0.05] group-hover:opacity-[0.1] transition-opacity pointer-events-none" style={{ backgroundColor: textColor }} />
            <div className="flex items-center justify-between mb-3">
                <span className="text-[9px] font-black text-muted uppercase tracking-[0.2em]">{title}</span>
                <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${textColor}15` }}>
                    <Icon className="w-3.5 h-3.5" style={{ color: textColor }} />
                </div>
            </div>
            <p className="text-xl font-black tracking-tight" style={{ color: textColor }}>{value}</p>
            {subtitle && <p className="text-[10px] font-bold text-muted mt-1">{subtitle}</p>}
        </div>
    );
}
