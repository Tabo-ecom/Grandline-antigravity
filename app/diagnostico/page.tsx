'use client';

import React, { useState, useMemo, useEffect } from 'react';
import Link from 'next/link';
import {
    FileSpreadsheet, ArrowRight, ArrowLeft, BarChart3,
    TrendingDown, DollarSign, Truck,
    AlertTriangle, CheckCircle2, XCircle, Loader2,
    Target, Globe, Clock, Megaphone, Trophy,
    ShieldAlert, Zap, X, Gift, Users,
    ShieldCheck, Timer,
} from 'lucide-react';
import { parseDropiFile, type ParseResult } from '@/lib/utils/parser';
import { calculateKPIs, type DropiOrder, type KPIResults } from '@/lib/calculations/kpis';
import { parseDropiDate } from '@/lib/utils/date-parsers';
import { evaluateHealth, getHealthColor, getHealthBgClass, getHealthLabel, findTarget } from '@/lib/utils/health';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';

// ─── Types ───────────────────────────────────────────────────────────────────

interface ProductSummary {
    name: string;
    orderCount: number;
    orders: DropiOrder[];
}

interface SurveyQuestion {
    id: string;
    question: string;
    options: string[];
    icon: React.ReactNode;
}

// ─── Survey Questions ────────────────────────────────────────────────────────

const SURVEY_QUESTIONS: SurveyQuestion[] = [
    {
        id: 'time_in_business',
        question: '¿Cuánto tiempo llevas en e-commerce?',
        options: ['Menos de 3 meses', '3 - 6 meses', '6 - 12 meses', 'Más de 1 año'],
        icon: <Clock className="w-5 h-5" />,
    },
    {
        id: 'monthly_revenue',
        question: '¿Cuál es tu facturación mensual promedio?',
        options: ['Menos de USD $10K', 'USD $10K - $50K', 'USD $50K - $100K', 'Más de USD $100K'],
        icon: <DollarSign className="w-5 h-5" />,
    },
    {
        id: 'ad_platform',
        question: '¿Qué plataformas de publicidad usas?',
        options: ['Facebook / Meta Ads', 'TikTok Ads', 'Ambas (Facebook + TikTok)', 'Otra'],
        icon: <Megaphone className="w-5 h-5" />,
    },
    {
        id: 'challenge',
        question: '¿Cuál es tu mayor desafío actualmente?',
        options: ['Rentabilidad', 'Escalar ventas', 'Alta tasa de devoluciones', 'Gestión de publicidad'],
        icon: <Target className="w-5 h-5" />,
    },
    {
        id: 'countries',
        question: '¿En cuántos países operas?',
        options: ['Solo 1 país', '2 - 3 países', '4+ países'],
        icon: <Globe className="w-5 h-5" />,
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatCurrency(value: number): string {
    if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
    if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
    return `$${value.toFixed(0)}`;
}

function getDateRange(orders: DropiOrder[]): { from: string; to: string } {
    const dates = orders
        .map(o => parseDropiDate(o.FECHA))
        .filter(d => d.getTime() > 0)
        .sort((a, b) => a.getTime() - b.getTime());

    if (dates.length === 0) return { from: 'N/A', to: 'N/A' };
    const fmt = (d: Date) => d.toLocaleDateString('es-CO', { day: '2-digit', month: 'short', year: 'numeric' });
    return { from: fmt(dates[0]), to: fmt(dates[dates.length - 1]) };
}

function generateInsights(
    kpis: KPIResults,
    productData?: { name: string; kpis: KPIResults; orderCount: number }[],
): { text: string; type: 'bad' | 'warning' | 'good'; icon: React.ReactNode }[] {
    const insights: { text: string; type: 'bad' | 'warning' | 'good'; icon: React.ReactNode }[] = [];

    // ── Global KPI insights ──

    if (kpis.u_real < 0) {
        insights.push({
            text: `Tu operación está generando pérdidas netas de ${formatCurrency(Math.abs(kpis.u_real))}. Necesitas revisar costos, publicidad y tasas de entrega urgentemente.`,
            type: 'bad',
            icon: <XCircle className="w-5 h-5 shrink-0" />,
        });
    } else if (kpis.u_real > 0) {
        insights.push({
            text: `Tu operación genera una utilidad de ${formatCurrency(kpis.u_real)}. Con optimización podrías mejorar significativamente este margen.`,
            type: 'good',
            icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
        });
    }

    if (kpis.g_ads > 0 && kpis.roas_real < 1.5) {
        insights.push({
            text: `Tu ROAS real es ${kpis.roas_real.toFixed(2)}x. Por cada peso invertido en publicidad, solo recuperas $${kpis.roas_real.toFixed(2)}. Lo ideal es estar por encima de 2x.`,
            type: 'bad',
            icon: <TrendingDown className="w-5 h-5 shrink-0" />,
        });
    }

    if (kpis.tasa_ent < 50) {
        insights.push({
            text: `Tu tasa de entrega es ${kpis.tasa_ent.toFixed(1)}%, muy por debajo del promedio (65%). Esto impacta directamente tu rentabilidad.`,
            type: 'bad',
            icon: <Truck className="w-5 h-5 shrink-0" />,
        });
    } else if (kpis.tasa_ent >= 65) {
        insights.push({
            text: `Tu tasa de entrega de ${kpis.tasa_ent.toFixed(1)}% es saludable. Mantén esta tendencia optimizando la confirmación de pedidos.`,
            type: 'good',
            icon: <Truck className="w-5 h-5 shrink-0" />,
        });
    }

    if (kpis.tasa_dev > 20) {
        insights.push({
            text: `Tus devoluciones del ${kpis.tasa_dev.toFixed(1)}% están afectando tu margen. Cada devolución tiene un costo de flete que reduces de tu utilidad.`,
            type: 'warning',
            icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
        });
    }

    if (kpis.g_ads > 0 && kpis.perc_ads_revenue > 35) {
        insights.push({
            text: `El ${kpis.perc_ads_revenue.toFixed(1)}% de tu facturación se va en publicidad. Lo recomendado es mantenerlo por debajo del 25%.`,
            type: 'warning',
            icon: <Megaphone className="w-5 h-5 shrink-0" />,
        });
    }

    if (kpis.tasa_can > 40) {
        insights.push({
            text: `Tu tasa de cancelación del ${kpis.tasa_can.toFixed(1)}% es crítica. Revisa tu proceso de confirmación y la calidad del tráfico.`,
            type: 'bad',
            icon: <XCircle className="w-5 h-5 shrink-0" />,
        });
    }

    // ── Product-level insights ──

    if (productData && productData.length > 0) {
        const totalOrders = kpis.n_ord;

        // Product concentration risk
        const sorted = [...productData].sort((a, b) => b.orderCount - a.orderCount);
        const topProduct = sorted[0];
        const topPct = totalOrders > 0 ? (topProduct.orderCount / totalOrders) * 100 : 0;
        if (topPct > 50) {
            insights.push({
                text: `"${topProduct.name}" concentra el ${topPct.toFixed(0)}% de tus órdenes. Alta dependencia de un solo producto aumenta el riesgo.`,
                type: 'warning',
                icon: <Target className="w-5 h-5 shrink-0" />,
            });
        }

        // Worst product alert
        const losingProducts = productData.filter(p => p.kpis.u_real < 0 && p.orderCount >= 5);
        if (losingProducts.length > 0) {
            const worst = losingProducts.reduce((w, p) => p.kpis.u_real < w.kpis.u_real ? p : w, losingProducts[0]);
            insights.push({
                text: `"${worst.name}" acumula ${formatCurrency(Math.abs(worst.kpis.u_real))} en pérdidas con ${worst.orderCount} órdenes. Evalúa pausar su publicidad.`,
                type: 'bad',
                icon: <AlertTriangle className="w-5 h-5 shrink-0" />,
            });
        }

        // Best product recognition
        const best = [...productData].sort((a, b) => b.kpis.u_real - a.kpis.u_real)[0];
        if (best && best.kpis.u_real > 0) {
            insights.push({
                text: `"${best.name}" es tu producto estrella: ${formatCurrency(best.kpis.u_real)} de utilidad con ${best.kpis.tasa_ent.toFixed(1)}% de entrega. Considera escalar su inversión.`,
                type: 'good',
                icon: <Trophy className="w-5 h-5 shrink-0" />,
            });
        }

        // CPA vs average order value
        if (kpis.g_ads > 0 && kpis.n_ord > 0) {
            const avgOrderValue = kpis.fact_neto / kpis.n_ord;
            if (kpis.cpa > avgOrderValue * 0.5) {
                insights.push({
                    text: `Tu CPA (${formatCurrency(kpis.cpa)}) representa más del 50% del ticket promedio (${formatCurrency(avgOrderValue)}). Optimiza segmentación o mejora el ticket.`,
                    type: 'warning',
                    icon: <DollarSign className="w-5 h-5 shrink-0" />,
                });
            }
        }

        // Net margin check
        if (kpis.fact_neto > 0) {
            const marginPct = (kpis.u_real / kpis.fact_neto) * 100;
            if (marginPct > 0 && marginPct < 10) {
                insights.push({
                    text: `Tu margen neto es solo ${marginPct.toFixed(1)}%. Un margen saludable en e-commerce COD es superior al 15%.`,
                    type: 'warning',
                    icon: <DollarSign className="w-5 h-5 shrink-0" />,
                });
            } else if (marginPct >= 20) {
                insights.push({
                    text: `Tu margen neto de ${marginPct.toFixed(1)}% es excelente. Estás en condiciones de escalar con confianza.`,
                    type: 'good',
                    icon: <CheckCircle2 className="w-5 h-5 shrink-0" />,
                });
            }
        }

        // Products with high cancellation
        const highCancProducts = productData.filter(p => p.kpis.tasa_can > 50 && p.orderCount >= 5);
        if (highCancProducts.length > 0) {
            const names = highCancProducts.slice(0, 2).map(p => `"${p.name}"`).join(' y ');
            insights.push({
                text: `${names} ${highCancProducts.length === 1 ? 'tiene' : 'tienen'} más del 50% de cancelación. Revisa la calidad del tráfico de esos productos.`,
                type: 'bad',
                icon: <XCircle className="w-5 h-5 shrink-0" />,
            });
        }
    }

    return insights;
}

// ─── Step Indicator ──────────────────────────────────────────────────────────

const STEPS = [
    { key: 'upload', label: 'Subir Reporte' },
    { key: 'products', label: 'Publicidad' },
    { key: 'survey', label: 'Encuesta' },
    { key: 'contact', label: 'Datos' },
    { key: 'results', label: 'Resultados' },
] as const;

type Step = (typeof STEPS)[number]['key'];

function StepIndicator({ current }: { current: Step }) {
    const currentIdx = STEPS.findIndex(s => s.key === current);
    return (
        <div className="flex items-center justify-center gap-2 mb-10">
            {STEPS.map((step, idx) => {
                const isActive = idx === currentIdx;
                const isDone = idx < currentIdx;
                return (
                    <React.Fragment key={step.key}>
                        {idx > 0 && (
                            <div className={`h-px w-6 md:w-10 transition-colors ${isDone ? 'bg-[#d75c33]' : 'bg-white/10'}`} />
                        )}
                        <div className="flex flex-col items-center gap-1">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold transition-all ${isActive ? 'bg-[#d75c33] text-white scale-110' : isDone ? 'bg-[#d75c33]/20 text-[#d75c33]' : 'bg-white/5 text-white/30'}`}>
                                {isDone ? <CheckCircle2 className="w-4 h-4" /> : idx + 1}
                            </div>
                            <span className={`text-[9px] uppercase tracking-widest font-bold hidden md:block ${isActive ? 'text-[#d75c33]' : isDone ? 'text-white/50' : 'text-white/20'}`}>
                                {step.label}
                            </span>
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}

// ─── Main Component ──────────────────────────────────────────────────────────

export default function DiagnosticoPage() {
    // Step state
    const [step, setStep] = useState<Step>('upload');

    // Data states
    const [parsedData, setParsedData] = useState<ParseResult | null>(null);
    const [productAdSpend, setProductAdSpend] = useState<Record<string, number>>({});
    const [surveyAnswers, setSurveyAnswers] = useState<Record<string, string>>({});
    const [contact, setContact] = useState({ name: '', email: '', whatsapp: '' });

    // UI states
    const [isDragging, setIsDragging] = useState(false);
    const [parsing, setParsing] = useState(false);
    const [parseError, setParseError] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [showAllProfitable, setShowAllProfitable] = useState(false);
    const [showAllLosing, setShowAllLosing] = useState(false);

    // Popup / slots state
    const [showPopup, setShowPopup] = useState(false);
    const [slotsInfo, setSlotsInfo] = useState({ slotsUsed: 0, totalSlots: 5 });
    const [popupName, setPopupName] = useState('');
    const [popupEmail, setPopupEmail] = useState('');
    const [popupWhatsapp, setPopupWhatsapp] = useState('');
    const [popupEditable, setPopupEditable] = useState(false);
    const [popupSource, setPopupSource] = useState<'diagnostico' | 'beta'>('diagnostico');
    const [popupSubmitting, setPopupSubmitting] = useState(false);
    const [popupDone, setPopupDone] = useState<'access' | 'waitlist' | null>(null);

    // ─── Derived Data ────────────────────────────────────────────────────────

    const products: ProductSummary[] = useMemo(() => {
        if (!parsedData) return [];
        const map = new Map<string, DropiOrder[]>();
        parsedData.orders.forEach(o => {
            const name = o.PRODUCTO || 'Sin nombre';
            if (!map.has(name)) map.set(name, []);
            map.get(name)!.push(o);
        });
        return Array.from(map.entries())
            .map(([name, orders]) => ({ name, orderCount: new Set(orders.map(o => o.ID)).size, orders }))
            .sort((a, b) => b.orderCount - a.orderCount);
    }, [parsedData]);

    const dateRange = useMemo(() => {
        if (!parsedData) return { from: '', to: '' };
        return getDateRange(parsedData.orders);
    }, [parsedData]);

    const { globalKPIs, productKPIs } = useMemo(() => {
        if (!parsedData || step !== 'results') return { globalKPIs: null, productKPIs: [] };

        const totalAds = Object.values(productAdSpend).reduce((s, v) => s + v, 0);
        const global = calculateKPIs(parsedData.orders, totalAds);

        const perProduct = products.map(p => {
            const ads = productAdSpend[p.name] || 0;
            const kpis = calculateKPIs(p.orders, ads);
            return { name: p.name, kpis, orderCount: p.orderCount };
        }).sort((a, b) => a.kpis.u_real - b.kpis.u_real);

        return { globalKPIs: global, productKPIs: perProduct };
    }, [parsedData, productAdSpend, products, step]);

    const insights = useMemo(() => {
        if (!globalKPIs) return [];
        return generateInsights(globalKPIs, productKPIs);
    }, [globalKPIs, productKPIs]);

    const slotsRemaining = slotsInfo.totalSlots - slotsInfo.slotsUsed;

    // ─── Handlers ────────────────────────────────────────────────────────────

    const handleFile = async (file: File) => {
        setParsing(true);
        setParseError('');
        try {
            const result = await parseDropiFile(file);
            if (result.orders.length === 0) {
                setParseError('El archivo no contiene órdenes válidas. Asegúrate de subir un reporte de Dropi.');
                return;
            }
            setParsedData(result);
            setStep('products');
        } catch (err: any) {
            setParseError(err.message || 'Error al procesar el archivo.');
        } finally {
            setParsing(false);
        }
    };

    const handleDrop = (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const file = e.dataTransfer.files[0];
        if (file) handleFile(file);
    };

    const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) handleFile(file);
    };

    const handleSubmitContact = async () => {
        if (!contact.name || !contact.email) return;
        setSubmitting(true);
        try {
            const totalAds = Object.values(productAdSpend).reduce((s, v) => s + v, 0);
            const kpis = calculateKPIs(parsedData!.orders, totalAds);
            await fetch('/api/diagnostico', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: contact.name,
                    email: contact.email,
                    whatsapp: contact.whatsapp,
                    survey: surveyAnswers,
                    metrics: {
                        total_orders: kpis.n_ord,
                        delivered: kpis.n_ent,
                        roas_real: kpis.roas_real,
                        profit: kpis.u_real,
                        delivery_rate: kpis.tasa_ent,
                    },
                    country: parsedData?.country || '',
                    productCount: products.length,
                    dateRange: `${dateRange.from} - ${dateRange.to}`,
                }),
            });
        } catch {
            // Silent fail - don't block the user
        } finally {
            setSubmitting(false);
            setStep('results');
        }
    };

    const allSurveyAnswered = SURVEY_QUESTIONS.every(q => surveyAnswers[q.id]);

    // Check available slots when reaching results
    useEffect(() => {
        if (step === 'results') {
            fetch('/api/diagnostico/slots')
                .then(r => r.json())
                .then(data => setSlotsInfo(data))
                .catch(() => {});
        }
    }, [step]);

    const handleOpenPopup = async (editable: boolean, source: 'diagnostico' | 'beta') => {
        setPopupEditable(editable);
        setPopupSource(source);
        setPopupDone(null);
        if (editable) {
            setPopupName('');
            setPopupEmail('');
            setPopupWhatsapp('');
        } else {
            setPopupName(contact.name);
            setPopupEmail(contact.email);
            setPopupWhatsapp(contact.whatsapp || '');
        }
        try {
            const res = await fetch('/api/diagnostico/slots');
            const data = await res.json();
            setSlotsInfo(data);
        } catch {}
        setShowPopup(true);
    };

    const handleClaimSlot = async () => {
        setPopupSubmitting(true);
        try {
            const res = await fetch('/api/diagnostico/slots', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: popupName,
                    email: popupEmail,
                    whatsapp: popupWhatsapp,
                    source: popupSource,
                }),
            });
            if (res.ok) {
                const result = await res.json();
                setPopupDone(result.type);
                setSlotsInfo(prev => ({ ...prev, slotsUsed: prev.slotsUsed + 1 }));
            }
        } catch {
            // Silent fail
        } finally {
            setPopupSubmitting(false);
        }
    };

    // ─── Render ──────────────────────────────────────────────────────────────

    return (
        <div className="min-h-screen bg-[#0A0A0F] text-white">
            {/* Nav */}
            <nav className="fixed top-0 left-0 right-0 z-50 backdrop-blur-xl bg-[#0A0A0F]/80 border-b border-white/5">
                <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <img src="/logos/grandline-isotipo.png" alt="Grand Line" className="w-7 h-7" />
                        <span className="font-black text-xl tracking-tighter font-['Space_Grotesk']">
                            GRAND <span className="text-[#d75c33]">LINE</span>
                        </span>
                    </div>
                </div>
            </nav>

            <div className={`pt-28 pb-20 px-4 md:px-6 mx-auto ${step === 'results' ? 'max-w-5xl' : 'max-w-4xl'}`}>
                <StepIndicator current={step} />

                {/* ═══ STEP 1: UPLOAD ═══ */}
                {step === 'upload' && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-12">
                            <h1 className="text-4xl md:text-5xl font-black tracking-tight leading-tight font-['Space_Grotesk']">
                                ¿Tu negocio de dropshipping<br />
                                <span className="text-[#d75c33]">es realmente rentable?</span>
                            </h1>
                            <p className="text-white/50 mt-4 text-lg max-w-2xl mx-auto">
                                Sube tu reporte de Dropi y descubre en minutos si estás ganando o perdiendo dinero. <span className="text-[#d75c33] font-bold">100% gratis.</span>
                            </p>
                        </div>

                        <div className="flex gap-4 items-stretch">
                            {/* Upload zone - protagonist */}
                            <label
                                onDragOver={(e) => { e.preventDefault(); setIsDragging(true); }}
                                onDragLeave={() => setIsDragging(false)}
                                onDrop={handleDrop}
                                className={`flex-1 flex items-center justify-center cursor-pointer border-2 border-dashed rounded-3xl p-12 md:p-16 text-center transition-all ${isDragging ? 'border-[#d75c33] bg-[#d75c33]/5 scale-[1.01]' : 'border-white/10 bg-white/[0.02] hover:border-white/20 hover:bg-white/[0.04]'}`}
                            >
                                <input type="file" accept=".xlsx,.csv" className="hidden" onChange={handleFileInput} />
                                {parsing ? (
                                    <div className="flex flex-col items-center gap-4">
                                        <Loader2 className="w-12 h-12 text-[#d75c33] animate-spin" />
                                        <p className="text-white/60 text-sm">Analizando tu reporte...</p>
                                    </div>
                                ) : (
                                    <div className="flex flex-col items-center gap-4">
                                        <div className="w-20 h-20 rounded-2xl bg-[#d75c33]/10 flex items-center justify-center">
                                            <FileSpreadsheet className="w-10 h-10 text-[#d75c33]" />
                                        </div>
                                        <div>
                                            <p className="text-lg font-bold text-white/80">Arrastra tu reporte de Dropi aquí</p>
                                            <p className="text-white/40 text-sm mt-1">o haz clic para seleccionar (.xlsx o .csv)</p>
                                        </div>
                                    </div>
                                )}
                            </label>

                            {/* Key points - sidebar, same height as upload */}
                            <div className="hidden md:flex flex-col gap-3 w-52 shrink-0">
                                {[
                                    { icon: <DollarSign className="w-5 h-5" />, label: 'Gratis', desc: 'Sin costo alguno' },
                                    { icon: <ShieldCheck className="w-5 h-5" />, label: 'Privado', desc: 'No guardamos tus datos' },
                                    { icon: <Timer className="w-5 h-5" />, label: 'Instantáneo', desc: 'Resultados en minutos' },
                                ].map(item => (
                                    <div key={item.label} className="flex-1 flex items-center gap-3 p-4 bg-white/[0.03] border border-white/5 rounded-2xl">
                                        <div className="w-10 h-10 rounded-xl bg-[#d75c33]/10 flex items-center justify-center shrink-0">
                                            <div className="text-[#d75c33]">{item.icon}</div>
                                        </div>
                                        <div>
                                            <p className="text-sm font-bold text-white/80">{item.label}</p>
                                            <p className="text-[11px] text-white/40 leading-tight">{item.desc}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Key points - mobile (below upload) */}
                        <div className="flex md:hidden gap-2 mt-4">
                            {[
                                { icon: <DollarSign className="w-3.5 h-3.5" />, label: 'Gratis' },
                                { icon: <ShieldCheck className="w-3.5 h-3.5" />, label: 'Privado' },
                                { icon: <Timer className="w-3.5 h-3.5" />, label: 'Instantáneo' },
                            ].map(item => (
                                <div key={item.label} className="flex-1 flex items-center justify-center gap-1.5 p-2.5 bg-white/[0.03] border border-white/5 rounded-xl">
                                    <div className="text-[#d75c33]">{item.icon}</div>
                                    <p className="text-[10px] font-bold text-white/60">{item.label}</p>
                                </div>
                            ))}
                        </div>

                        {parseError && (
                            <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm flex items-center gap-2">
                                <AlertTriangle className="w-4 h-4 shrink-0" /> {parseError}
                            </div>
                        )}

                        {/* Beta registration */}
                        <div className="mt-10 text-center">
                            <p className="text-white/30 text-sm mb-2">No tienes un reporte a la mano?</p>
                            <button
                                onClick={() => handleOpenPopup(true, 'beta')}
                                className="text-[#d75c33] hover:text-[#e06a43] text-sm font-bold underline underline-offset-4 transition-colors"
                            >
                                Registrate a la lista BETA
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ STEP 2: PRODUCTS & AD SPEND ═══ */}
                {step === 'products' && parsedData && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight font-['Space_Grotesk']">
                                Detectamos <span className="text-[#d75c33]">{products.length} productos</span>
                            </h2>
                            <p className="text-white/40 mt-2 text-base">
                                {parsedData.orders.length} órdenes encontradas &middot; {dateRange.from} al {dateRange.to} &middot; {parsedData.country}
                            </p>
                        </div>

                        <p className="text-sm text-white/50 mb-4 text-center">
                            Ingresa cuánto invertiste en publicidad por cada producto durante este periodo.
                        </p>

                        <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-2">
                            {products.map(p => (
                                <div key={p.name} className="flex items-center gap-4 p-5 bg-white/[0.03] border border-white/5 rounded-2xl">
                                    <div className="flex-1 min-w-0">
                                        <p className="text-base font-bold text-white/80 truncate">{p.name}</p>
                                        <p className="text-xs text-white/30">{p.orderCount} órdenes</p>
                                    </div>
                                    <div className="flex items-center gap-2 shrink-0">
                                        <span className="text-xs text-white/30">$</span>
                                        <input
                                            type="number"
                                            min={0}
                                            placeholder="0"
                                            value={productAdSpend[p.name] || ''}
                                            onChange={(e) => setProductAdSpend(prev => ({ ...prev, [p.name]: Number(e.target.value) || 0 }))}
                                            className="w-32 bg-white/5 border border-white/10 rounded-xl px-3 py-3 text-base text-right font-mono focus:border-[#d75c33] outline-none transition-colors"
                                        />
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between mt-8">
                            <button
                                onClick={() => setStep('upload')}
                                className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Volver
                            </button>
                            <button
                                onClick={() => setStep('survey')}
                                className="flex items-center gap-2 px-8 py-3 bg-[#d75c33] text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-[#c04e2b] transition-colors"
                            >
                                Continuar <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ STEP 3: SURVEY ═══ */}
                {step === 'survey' && (
                    <div className="animate-fade-in-up">
                        <div className="text-center mb-8">
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight font-['Space_Grotesk']">
                                Cuéntanos sobre <span className="text-[#d75c33]">tu negocio</span>
                            </h2>
                            <p className="text-white/40 mt-2 text-base">
                                Responde estas preguntas rápidas para personalizar tu diagnóstico.
                            </p>
                        </div>

                        <div className="space-y-6">
                            {SURVEY_QUESTIONS.map((q, idx) => (
                                <div
                                    key={q.id}
                                    className="p-6 bg-white/[0.03] border border-white/5 rounded-2xl"
                                    style={{ animationDelay: `${idx * 80}ms` }}
                                >
                                    <div className="flex items-center gap-3 mb-4">
                                        <div className="text-[#d75c33]">{q.icon}</div>
                                        <p className="text-base font-bold text-white/80">{q.question}</p>
                                    </div>
                                    <div className="grid grid-cols-2 gap-3">
                                        {q.options.map(option => {
                                            const isSelected = surveyAnswers[q.id] === option;
                                            return (
                                                <button
                                                    key={option}
                                                    onClick={() => setSurveyAnswers(prev => ({ ...prev, [q.id]: option }))}
                                                    className={`px-4 py-3.5 text-sm font-bold rounded-xl border transition-all text-left ${isSelected
                                                        ? 'bg-[#d75c33]/15 border-[#d75c33]/40 text-[#d75c33]'
                                                        : 'bg-white/[0.02] border-white/5 text-white/50 hover:border-white/15 hover:text-white/70'
                                                        }`}
                                                >
                                                    {option}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="flex items-center justify-between mt-8">
                            <button
                                onClick={() => setStep('products')}
                                className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Volver
                            </button>
                            <button
                                onClick={() => setStep('contact')}
                                disabled={!allSurveyAnswered}
                                className="flex items-center gap-2 px-8 py-3 bg-[#d75c33] text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-[#c04e2b] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                Continuar <ArrowRight className="w-4 h-4" />
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ STEP 4: CONTACT ═══ */}
                {step === 'contact' && (
                    <div className="animate-fade-in-up max-w-md mx-auto">
                        <div className="text-center mb-8">
                            <div className="w-16 h-16 rounded-2xl bg-[#d75c33]/10 flex items-center justify-center mx-auto mb-4">
                                <BarChart3 className="w-8 h-8 text-[#d75c33]" />
                            </div>
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight font-['Space_Grotesk']">
                                Tu diagnóstico está <span className="text-[#d75c33]">listo</span>
                            </h2>
                            <p className="text-white/40 mt-2 text-base">
                                Ingresa tus datos para ver el análisis completo de tu rentabilidad.
                            </p>
                        </div>

                        <div className="space-y-5">
                            <div>
                                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Nombre *</label>
                                <input
                                    type="text"
                                    value={contact.name}
                                    onChange={(e) => setContact(prev => ({ ...prev, name: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-base focus:border-[#d75c33] outline-none transition-colors"
                                    placeholder="Tu nombre"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">Email *</label>
                                <input
                                    type="email"
                                    value={contact.email}
                                    onChange={(e) => setContact(prev => ({ ...prev, email: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-base focus:border-[#d75c33] outline-none transition-colors"
                                    placeholder="tu@email.com"
                                />
                            </div>
                            <div>
                                <label className="text-xs font-bold text-white/40 uppercase tracking-widest mb-2 block">WhatsApp <span className="text-white/20">(opcional)</span></label>
                                <input
                                    type="tel"
                                    value={contact.whatsapp}
                                    onChange={(e) => setContact(prev => ({ ...prev, whatsapp: e.target.value }))}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-base focus:border-[#d75c33] outline-none transition-colors"
                                    placeholder="+57 300 123 4567"
                                />
                            </div>
                        </div>

                        <div className="flex items-center justify-between mt-8">
                            <button
                                onClick={() => setStep('survey')}
                                className="flex items-center gap-2 text-white/40 hover:text-white/70 text-sm transition-colors"
                            >
                                <ArrowLeft className="w-4 h-4" /> Volver
                            </button>
                            <button
                                onClick={handleSubmitContact}
                                disabled={!contact.name || !contact.email || submitting}
                                className="flex items-center gap-2 px-8 py-3 bg-[#d75c33] text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-[#c04e2b] transition-colors disabled:opacity-30 disabled:cursor-not-allowed"
                            >
                                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                Ver mi Diagnóstico
                            </button>
                        </div>
                    </div>
                )}

                {/* ═══ STEP 5: RESULTS ═══ */}
                {step === 'results' && globalKPIs && (
                    <div className="animate-fade-in-up space-y-8">
                        <div className="text-center">
                            <h2 className="text-2xl md:text-3xl font-black tracking-tight font-['Space_Grotesk']">
                                Diagnóstico de <span className="text-[#d75c33]">Rentabilidad</span>
                            </h2>
                            <p className="text-white/40 mt-2 text-sm">
                                {parsedData?.country} &middot; {dateRange.from} al {dateRange.to} &middot; {globalKPIs.n_ord} órdenes
                            </p>
                        </div>

                        {/* Insights */}
                        {insights.length > 0 && (
                            <div className="space-y-3">
                                <h3 className="text-xs font-bold text-white/50 uppercase tracking-widest flex items-center gap-2">
                                    <ShieldAlert className="w-4 h-4" /> Hallazgos Clave
                                </h3>
                                {insights.map((insight, i) => {
                                    const badge = { bad: { label: 'CRITICO', bg: 'bg-red-500/20' }, warning: { label: 'ATENCION', bg: 'bg-orange-500/20' }, good: { label: 'BIEN', bg: 'bg-emerald-500/20' } }[insight.type];
                                    return (
                                        <div
                                            key={i}
                                            className={`p-4 rounded-2xl border flex items-start gap-3 ${insight.type === 'bad' ? 'bg-red-500/5 border-red-500/15 text-red-400'
                                                : insight.type === 'warning' ? 'bg-orange-500/5 border-orange-500/15 text-orange-400'
                                                    : 'bg-emerald-500/5 border-emerald-500/15 text-emerald-400'
                                                }`}
                                        >
                                            <span className={`text-[9px] font-black tracking-widest uppercase px-2 py-1 rounded-md shrink-0 ${badge.bg}`}>
                                                {badge.label}
                                            </span>
                                            {insight.icon}
                                            <p className="text-sm leading-relaxed">{insight.text}</p>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {/* ── Prominent Utilidad Real Card ── */}
                        <div className={`p-6 md:p-8 rounded-3xl border-2 text-center ${globalKPIs.u_real >= 0
                            ? 'bg-emerald-500/5 border-emerald-500/20'
                            : 'bg-red-500/5 border-red-500/20'
                            }`}>
                            <p className="text-xs text-white/40 uppercase tracking-widest font-bold mb-1">Utilidad Real del Periodo</p>
                            <p className={`text-5xl md:text-6xl font-black tracking-tight font-['Space_Grotesk'] ${globalKPIs.u_real >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>
                                {formatCurrency(globalKPIs.u_real)}
                            </p>
                            <p className={`text-sm mt-2 ${globalKPIs.u_real >= 0 ? 'text-emerald-400/60' : 'text-red-400/60'}`}>
                                {globalKPIs.u_real >= 0 ? 'Tu operación es rentable' : 'Tu operación está generando pérdidas'}
                            </p>
                            <div className="flex items-center justify-center gap-6 mt-4 text-[11px]">
                                <div>
                                    <span className="text-white/30">Facturación</span>
                                    <span className="ml-1.5 font-bold text-white/70">{formatCurrency(globalKPIs.fact_neto)}</span>
                                </div>
                                <div className="w-px h-4 bg-white/10" />
                                <div>
                                    <span className="text-white/30">Ingreso Real</span>
                                    <span className="ml-1.5 font-bold text-white/70">{formatCurrency(globalKPIs.ing_real)}</span>
                                </div>
                                <div className="w-px h-4 bg-white/10" />
                                <div>
                                    <span className="text-white/30">Gasto Ads</span>
                                    <span className="ml-1.5 font-bold text-white/70">{formatCurrency(globalKPIs.g_ads)}</span>
                                </div>
                            </div>
                        </div>

                        {/* ── Secondary KPIs Grid ── */}
                        <div className="grid grid-cols-3 md:grid-cols-6 gap-2">
                            {[
                                { label: 'ROAS Real', value: `${globalKPIs.roas_real.toFixed(2)}x`, kpiKey: 'roas_real' },
                                { label: 'CPA', value: formatCurrency(globalKPIs.cpa), kpiKey: 'cpa' },
                                { label: 'Tasa Entrega', value: `${globalKPIs.tasa_ent.toFixed(1)}%`, kpiKey: 'tasa_ent' },
                                { label: 'Tasa Canc.', value: `${globalKPIs.tasa_can.toFixed(1)}%`, kpiKey: 'tasa_can' },
                                { label: 'Tasa Dev.', value: `${globalKPIs.tasa_dev.toFixed(1)}%`, kpiKey: 'tasa_dev' },
                                { label: '% Ads/Rev', value: `${globalKPIs.perc_ads_revenue.toFixed(1)}%`, kpiKey: 'perc_ads_revenue' },
                            ].map(metric => {
                                const target = findTarget(DEFAULT_KPI_TARGETS, metric.kpiKey);
                                const rawValue = (globalKPIs as any)[metric.kpiKey];
                                const health = target ? evaluateHealth(rawValue, target) : null;
                                return (
                                    <div key={metric.label} className={`p-3 rounded-xl border ${health ? getHealthBgClass(health) : 'bg-white/[0.03] border-white/5'}`}>
                                        <p className="text-[9px] text-white/40 uppercase tracking-widest font-bold truncate">{metric.label}</p>
                                        <p className={`text-base font-black mt-0.5 ${health ? getHealthColor(health) : 'text-white/80'}`}>{metric.value}</p>
                                        {health && (
                                            <p className={`text-[8px] font-bold uppercase tracking-widest ${getHealthColor(health)}`}>
                                                {getHealthLabel(health, metric.kpiKey)}
                                            </p>
                                        )}
                                    </div>
                                );
                            })}
                        </div>

                        {/* ── Product Tables: Stacked Full-Width ── */}
                        {(() => {
                            const totalOrders = globalKPIs.n_ord;
                            const totalAds = globalKPIs.g_ads;
                            const profitable = productKPIs.filter(p => p.kpis.u_real >= 0).sort((a, b) => b.kpis.u_real - a.kpis.u_real);
                            const losing = productKPIs.filter(p => p.kpis.u_real < 0).sort((a, b) => a.kpis.u_real - b.kpis.u_real);

                            const renderTable = (
                                items: typeof productKPIs,
                                type: 'profit' | 'loss',
                                showAll: boolean,
                                toggleShowAll: () => void,
                            ) => {
                                const isProfit = type === 'profit';
                                const displayed = showAll ? items : items.slice(0, 5);
                                return (
                                    <div className="bg-white/[0.02] border border-white/5 rounded-2xl overflow-hidden">
                                        <div className="flex items-center justify-between px-5 py-3.5 border-b border-white/5">
                                            <div className="flex items-center gap-2.5">
                                                <div className={`w-7 h-7 rounded-lg ${isProfit ? 'bg-emerald-500/10' : 'bg-red-500/10'} flex items-center justify-center`}>
                                                    {isProfit ? <Trophy className="w-3.5 h-3.5 text-emerald-400" /> : <AlertTriangle className="w-3.5 h-3.5 text-red-400" />}
                                                </div>
                                                <h3 className="text-[11px] font-black uppercase tracking-widest text-white/80">
                                                    {isProfit ? 'Productos Rentables' : 'Productos en Perdida'}
                                                </h3>
                                                <span className={`text-[10px] font-mono ${isProfit ? 'text-emerald-400 bg-emerald-500/10' : 'text-red-400 bg-red-500/10'} px-2 py-0.5 rounded-full`}>
                                                    {items.length}
                                                </span>
                                            </div>
                                            {items.length > 5 && (
                                                <button onClick={toggleShowAll} className="text-[10px] font-bold text-white/40 hover:text-white/70 transition-colors">
                                                    {showAll ? 'Ver menos' : `Ver todos (${items.length})`}
                                                </button>
                                            )}
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-[11px]">
                                                <thead>
                                                    <tr className="text-white/30 font-black uppercase tracking-wider border-b border-white/5">
                                                        <th className="px-4 py-2.5 text-left">Producto</th>
                                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">Ordenes</th>
                                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">% Part.</th>
                                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">Gasto Ads</th>
                                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">% Ads</th>
                                                        <th className="px-3 py-2.5 text-center whitespace-nowrap">% Canc.</th>
                                                        <th className="px-3 py-2.5 text-center whitespace-nowrap">% Entrega</th>
                                                        <th className="px-3 py-2.5 text-right whitespace-nowrap">{isProfit ? 'Utilidad' : 'Perdida'}</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-white/5">
                                                    {displayed.map((p, i) => {
                                                        const pctPart = totalOrders > 0 ? (p.orderCount / totalOrders * 100) : 0;
                                                        const pctAds = totalAds > 0 ? (p.kpis.g_ads / totalAds * 100) : 0;
                                                        return (
                                                            <tr key={p.name} className="hover:bg-white/[0.02] transition-colors">
                                                                <td className="px-4 py-2.5 font-medium text-white/80">
                                                                    <div className="flex items-center gap-2">
                                                                        <span className={`text-[10px] font-black ${isProfit ? 'text-emerald-400' : 'text-red-400'} w-4`}>{i + 1}</span>
                                                                        <span className="truncate max-w-[160px]">{p.name}</span>
                                                                    </div>
                                                                </td>
                                                                <td className="px-3 py-2.5 text-right font-mono text-white/60">{p.orderCount}</td>
                                                                <td className="px-3 py-2.5 text-right font-mono text-blue-400">{pctPart.toFixed(1)}%</td>
                                                                <td className="px-3 py-2.5 text-right font-mono text-white/50">{p.kpis.g_ads > 0 ? formatCurrency(p.kpis.g_ads) : '\u2014'}</td>
                                                                <td className="px-3 py-2.5 text-right font-mono text-purple-400">{totalAds > 0 && p.kpis.g_ads > 0 ? `${pctAds.toFixed(1)}%` : '\u2014'}</td>
                                                                <td className={`px-3 py-2.5 text-center font-mono ${p.kpis.tasa_can > 40 ? 'text-orange-400' : 'text-white/50'}`}>{p.kpis.tasa_can.toFixed(1)}%</td>
                                                                <td className={`px-3 py-2.5 text-center font-mono ${p.kpis.tasa_ent < 50 ? 'text-red-400' : p.kpis.tasa_ent >= 65 ? 'text-emerald-400' : 'text-white/60'}`}>{p.kpis.tasa_ent.toFixed(1)}%</td>
                                                                <td className={`px-3 py-2.5 text-right font-mono font-bold ${isProfit ? 'text-emerald-400' : 'text-red-400'}`}>{formatCurrency(p.kpis.u_real)}</td>
                                                            </tr>
                                                        );
                                                    })}
                                                    {items.length === 0 && (
                                                        <tr><td colSpan={8} className="px-4 py-6 text-center text-white/20 italic text-[10px]">{isProfit ? 'Sin productos rentables en este periodo' : 'Todos tus productos son rentables'}</td></tr>
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            };

                            return (
                                <div className="space-y-6">
                                    {renderTable(profitable, 'profit', showAllProfitable, () => setShowAllProfitable(!showAllProfitable))}
                                    {renderTable(losing, 'loss', showAllLosing, () => setShowAllLosing(!showAllLosing))}
                                </div>
                            );
                        })()}

                        {/* CTA */}
                        <div className="bg-gradient-to-br from-[#d75c33]/20 to-[#d75c33]/5 border border-[#d75c33]/20 rounded-3xl p-8 md:p-12 text-center">
                            <h3 className="text-2xl md:text-3xl font-black tracking-tight font-['Space_Grotesk']">
                                ¿Quieres monitorear esto<br /><span className="text-[#d75c33]">en tiempo real?</span>
                            </h3>
                            <p className="text-white/50 mt-3 text-sm max-w-lg mx-auto">
                                Con Grand Line puedes importar tus datos automaticamente, ver tu rentabilidad dia a dia, y optimizar tu publicidad con inteligencia artificial.
                            </p>

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-8 mb-8">
                                {[
                                    { isotipo: '/logos/wheel-isotipo.png', title: 'Wheel Dashboard', desc: 'KPIs actualizados cada dia con tu data real' },
                                    { isotipo: '/logos/vega-isotipo.png', title: 'Vega IA', desc: 'Asistente de IA que analiza tu negocio y sugiere mejoras' },
                                    { isotipo: '/logos/sunny-isotipo.png', title: 'Sunny Launcher', desc: 'Lanza campanas de Meta Ads directo desde Grand Line' },
                                ].map(f => (
                                    <div key={f.title} className="p-4 bg-white/[0.03] border border-white/5 rounded-2xl text-left">
                                        <img src={f.isotipo} alt={f.title} className="w-8 h-8 mb-2" />
                                        <p className="text-sm font-bold text-white/80">{f.title}</p>
                                        <p className="text-[10px] text-white/40 mt-1">{f.desc}</p>
                                    </div>
                                ))}
                            </div>

                            {/* Slot availability indicator */}
                            <div className="mb-6">
                                <div className="inline-flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 rounded-full">
                                    <div className={`w-2 h-2 rounded-full ${slotsRemaining > 0 ? 'bg-emerald-400 animate-pulse' : 'bg-orange-400'}`} />
                                    <span className="text-sm font-bold text-white/70">
                                        {slotsRemaining > 0
                                            ? `Solo quedan ${slotsRemaining} de 5 lugares con 1 MES GRATIS`
                                            : 'Unete a la lista de espera \u2014 15 dias gratis'}
                                    </span>
                                </div>
                            </div>

                            <button
                                onClick={() => handleOpenPopup(false, 'diagnostico')}
                                className="inline-flex items-center gap-3 px-10 py-4 bg-[#d75c33] text-white font-black uppercase text-sm tracking-widest rounded-xl hover:bg-[#c04e2b] transition-all hover:scale-105"
                            >
                                {slotsRemaining > 0 ? <Gift className="w-5 h-5" /> : <Users className="w-5 h-5" />}
                                {slotsRemaining > 0 ? 'Quiero mi acceso GRATIS' : 'Unirme a la lista de espera'}
                            </button>
                        </div>

                    </div>
                )}
            </div>

            {/* ── Popup Modal (available from any step) ── */}
            {showPopup && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => !popupSubmitting && setShowPopup(false)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
                    <div className="relative bg-[#0f0f17] border border-white/10 rounded-3xl p-8 w-full max-w-md animate-fade-in-up" onClick={e => e.stopPropagation()}>
                        <button onClick={() => setShowPopup(false)} className="absolute top-4 right-4 text-white/30 hover:text-white/70 transition-colors">
                            <X className="w-5 h-5" />
                        </button>

                        {popupDone ? (
                            <div className="text-center py-8">
                                <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto mb-4">
                                    <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                                </div>
                                <h4 className="text-xl font-black text-white mb-2">
                                    {popupDone === 'access' ? '\u00a1Acceso reservado!' : '\u00a1Registrado!'}
                                </h4>
                                <p className="text-white/50 text-sm">
                                    {popupDone === 'access'
                                        ? 'Te contactaremos por WhatsApp para activar tu cuenta con 1 mes gratis.'
                                        : 'Te enviaremos un email cuando tu acceso este listo. Tendras 15 dias gratis.'}
                                </p>
                            </div>
                        ) : (
                            <>
                                <div className="text-center mb-6">
                                    <div className="w-14 h-14 rounded-2xl bg-[#d75c33]/10 flex items-center justify-center mx-auto mb-3">
                                        {slotsRemaining > 0 ? <Gift className="w-7 h-7 text-[#d75c33]" /> : <Users className="w-7 h-7 text-[#d75c33]" />}
                                    </div>
                                    <h4 className="text-xl font-black text-white mb-1">
                                        {slotsRemaining > 0 ? '1 MES GRATIS de Grand Line' : 'Lista de Espera'}
                                    </h4>
                                    <p className="text-white/50 text-sm">
                                        {slotsRemaining > 0
                                            ? `Solo quedan ${slotsRemaining} lugares. Ingresa tu WhatsApp para contactarte.`
                                            : 'Los 5 lugares fueron reclamados. Registrate y te daremos 15 dias gratis.'}
                                    </p>
                                </div>

                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">Nombre *</label>
                                        <input
                                            type="text"
                                            value={popupName}
                                            onChange={(e) => setPopupName(e.target.value)}
                                            readOnly={!popupEditable}
                                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm ${popupEditable ? 'focus:border-[#d75c33] outline-none transition-colors' : 'text-white/60'}`}
                                            placeholder="Tu nombre"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">Email *</label>
                                        <input
                                            type="email"
                                            value={popupEmail}
                                            onChange={(e) => setPopupEmail(e.target.value)}
                                            readOnly={!popupEditable}
                                            className={`w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm ${popupEditable ? 'focus:border-[#d75c33] outline-none transition-colors' : 'text-white/60'}`}
                                            placeholder="tu@email.com"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-bold text-white/40 uppercase tracking-widest mb-1.5 block">WhatsApp *</label>
                                        <input
                                            type="tel"
                                            value={popupWhatsapp}
                                            onChange={(e) => setPopupWhatsapp(e.target.value)}
                                            className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-sm focus:border-[#d75c33] outline-none transition-colors"
                                            placeholder="+57 300 123 4567"
                                        />
                                    </div>
                                </div>

                                <button
                                    onClick={handleClaimSlot}
                                    disabled={popupSubmitting || !popupName || !popupEmail || !popupWhatsapp}
                                    className="w-full mt-6 px-6 py-4 bg-[#d75c33] text-white font-black uppercase text-xs tracking-widest rounded-xl hover:bg-[#c04e2b] transition-colors disabled:opacity-30 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                                >
                                    {popupSubmitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Zap className="w-4 h-4" />}
                                    {slotsRemaining > 0 ? 'Reclamar mi acceso' : 'Unirme a la lista'}
                                </button>
                            </>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
