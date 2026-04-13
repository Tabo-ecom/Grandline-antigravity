'use client';

import React, { useState } from 'react';
import {
    BarChart3, Compass, Megaphone, Bot,
    ChevronDown, ChevronUp, ArrowRight, Check, Zap, Shield,
    Globe, TrendingUp, Package, Star,
    Brain, Rocket, Target,
    Calculator, FileText, Bell, MapPin, Mail, Loader2, CheckCircle, Phone, User
} from 'lucide-react';

/* ─── FAQ Data ─────────────────────────────────────────────── */
const faqs = [
    {
        q: '¿Qué datos necesito para empezar?',
        a: 'Solo necesitas exportar tus reportes de Dropi en formato Excel o CSV. Grand Line detecta automáticamente el país, las transportadoras, el recaudo y todos los campos necesarios. No se requiere integración técnica.'
    },
    {
        q: '¿Funciona para mi país?',
        a: 'Grand Line soporta los 11 países donde opera Dropi: Colombia, México, Ecuador, Perú, Chile, Argentina, Paraguay, Guatemala, Panamá, España y Costa Rica. Con detección automática de país, moneda local y mapas interactivos por territorio.'
    },
    {
        q: '¿Cómo funciona Vega IA?',
        a: 'Vega es tu oficial al mando. Analiza tu operación en tiempo real, genera alertas automáticas cuando detecta problemas, responde preguntas sobre tus datos y genera reportes diarios. Piensa en Vega como tu segundo al mando que nunca duerme.'
    },
    {
        q: '¿Cómo funcionan los módulos de publicidad?',
        a: 'Puedes mapear tus campañas de Facebook Ads y TikTok Ads a productos específicos. El sistema calcula ROAS real, CPA y sugiere optimizaciones con IA. Con Sunny, puedes lanzar campañas directamente desde la plataforma.'
    },
    {
        q: '¿Mis datos están seguros?',
        a: 'Toda la información se almacena con encriptación multi-tenant. Cada usuario solo puede ver y modificar sus propios datos. La autenticación usa protocolos de seguridad de nivel empresarial.'
    },
    {
        q: '¿Puedo cancelar en cualquier momento?',
        a: 'Sí. Todos los planes son mensuales sin compromiso. Puedes cancelar, cambiar de plan o pausar tu suscripción cuando quieras. El plan Rookie incluye 7 días gratis sin necesidad de tarjeta de crédito.'
    },
];

/* ─── Module Data ──────────────────────────────────────────── */
const modules = [
    {
        icon: Compass,
        isotipo: '/logos/wheel-isotipo.png',
        name: 'WHEEL',
        subtitle: 'Dashboard de Operación',
        tagline: 'Los números no mienten.',
        color: 'from-blue-500 to-cyan-400',
        borderColor: 'border-blue-500/30',
        glowColor: 'shadow-blue-500/10',
        description: 'Centro de mando con KPIs en tiempo real. Tasa de entrega, utilidad real, ROAS, estado de operación por país — todo en una sola vista.',
        features: ['KPIs consolidados multi-país', 'Filtros por rango de fecha y ciudad', 'Conversión automática de moneda', 'Distribución visual de estados'],
        highlight: true,
    },
    {
        icon: BarChart3,
        isotipo: '/logos/berry-isotipo.png',
        name: 'BERRY',
        subtitle: 'Control Financiero',
        tagline: 'Controla tus gastos.',
        color: 'from-purple-500 to-violet-400',
        borderColor: 'border-purple-500/30',
        glowColor: 'shadow-purple-500/10',
        description: 'Estado de resultados waterfall completo. Ingresos, costos de producto, fletes, devoluciones, comisiones y publicidad desglosados al centavo.',
        features: ['Waterfall P&L de 7 componentes', 'Doble moneda (local + USD)', 'Eficiencia y margen por producto', 'Margen neto real'],
        highlight: true,
    },
    {
        icon: MapPin,
        isotipo: '/logos/ship-isotipo.png',
        name: 'SHIP',
        subtitle: 'Control Logístico',
        tagline: 'Controla tu logística.',
        color: 'from-emerald-500 to-green-400',
        borderColor: 'border-emerald-500/30',
        glowColor: 'shadow-emerald-500/10',
        description: 'Mapa de calor interactivo por departamento. Transportadoras auto-detectadas, % de recaudo, ranking de ciudades y análisis territorial completo.',
        features: ['Mapa SVG interactivo por país', 'Detección automática de transportadoras', '% Con/Sin recaudo por zona', 'Ranking de departamentos y ciudades'],
        highlight: true,
    },
    {
        icon: Brain,
        isotipo: '/logos/vega-isotipo.png',
        name: 'VEGA IA',
        subtitle: 'Tu Oficial al Mando',
        tagline: 'Tu segundo al mando. Siempre alerta.',
        color: 'from-indigo-400 to-blue-500',
        borderColor: 'border-indigo-400/30',
        glowColor: 'shadow-indigo-400/10',
        description: 'Inteligencia artificial que vigila tu operación 24/7. Genera alertas, responde preguntas sobre tus datos, crea reportes automáticos y anticipa problemas antes de que sucedan.',
        features: ['Chat conversacional con IA', 'Alertas proactivas diarias', 'Reportes automáticos semanales', 'Análisis predictivo de tendencias'],
        highlight: true,
        isVega: true,
    },
    {
        icon: Rocket,
        isotipo: '/logos/sunny-isotipo.png',
        name: 'SUNNY',
        subtitle: 'Ads Launcher',
        tagline: 'Lanza y escala tus anuncios.',
        color: 'from-yellow-500 to-orange-400',
        borderColor: 'border-yellow-500/30',
        glowColor: 'shadow-yellow-500/10',
        description: 'Lanza campañas de Meta Ads directamente desde Grand Line. Genera copys con IA, gestiona audiencias y escala lo que funciona con un solo click.',
        features: ['Conexión directa Meta API', 'Generación de copy con IA', 'Gestión de audiencias', 'Lanzamiento y escalado one-click'],
        highlight: true,
    },
];

const secondaryModules = [
    {
        icon: Megaphone,
        name: 'Publicidad',
        description: 'Mapeo de campañas Facebook + TikTok Ads por producto. ROAS real, CPA y sugerencias IA.',
    },
    {
        icon: Calculator,
        name: 'Proyección',
        description: 'Simulador what-if para proyectar crecimiento. Ajusta variables y ve el impacto financiero.',
    },
    {
        icon: FileText,
        name: 'Log Pose',
        description: 'Importación inteligente de reportes Dropi con detección de duplicados y overlap.',
    },
];

/* ─── Pricing Data ─────────────────────────────────────────── */
const plans = [
    {
        name: 'Rookie',
        price: 27,
        period: '/mes',
        trial: '7 días gratis — sin tarjeta',
        description: 'Empieza a controlar tu operación.',
        features: [
            '1 país activo',
            '3 cuentas publicitarias',
            'WHEEL — Dashboard de Operación',
            'SHIP — Control Logístico',
            'LOG POSE — Gestión de Territorios',
            'Proyección general',
            'Importación de reportes Dropi',
        ],
        excluded: ['Berry P&L', 'Sunny', 'Vega IA'],
        cta: 'Probar Gratis — Sin Tarjeta',
        popular: false,
        gradient: 'from-gray-600 to-gray-500',
        accentColor: 'text-gray-400',
        checkColor: 'text-green-500',
        comingSoon: false,
    },
    {
        name: 'Supernova',
        price: 49,
        period: '/mes',
        trial: null,
        description: 'Todo para escalar sin límites.',
        features: [
            'Hasta 3 países',
            'Cuentas publicitarias ilimitadas',
            'WHEEL — Dashboard de Operación',
            'SHIP — Control Logístico',
            'LOG POSE — Gestión de Territorios',
            'BERRY — Control Financiero completo',
            'SUNNY — Hasta 40 campañas/mes',
            'VEGA IA — Tu oficial al mando',
            'Reportes automáticos (diario/semanal)',
            'Proyecciones avanzadas',
            'Multi-usuarios (equipo)',
        ],
        excluded: [],
        cta: 'Empezar Ahora',
        popular: true,
        gradient: 'from-[#d75c33] to-orange-500',
        accentColor: 'text-[#d75c33]',
        checkColor: 'text-[#d75c33]',
        comingSoon: false,
    },
    {
        name: 'Yonko',
        price: 97,
        period: '/mes',
        trial: null,
        description: 'Para imperios multi-país.',
        features: [
            'Territorios ilimitados',
            'Todo en Supernova, más:',
            'SUNNY — Campañas ilimitadas',
            'VEGA IA avanzado + predictivo',
            'Alertas diarias automáticas',
            'Multi-usuario ilimitado',
            'Exportación de reportes',
            'Onboarding personalizado',
            'Soporte VIP prioritario',
        ],
        excluded: [],
        cta: 'Próximamente',
        popular: false,
        gradient: 'from-violet-600 to-purple-500',
        accentColor: 'text-violet-400',
        checkColor: 'text-violet-400',
        comingSoon: true,
    },
];

/* ─── FAQ Item Component ───────────────────────────────────── */
function FAQItem({ q, a }: { q: string; a: string }) {
    const [open, setOpen] = useState(false);
    return (
        <div className="border border-white/10 rounded-xl overflow-hidden transition-colors hover:border-white/20">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-6 py-5 text-left"
            >
                <span className="text-base font-medium text-white pr-4">{q}</span>
                {open ? <ChevronUp className="w-5 h-5 text-gray-400 shrink-0" /> : <ChevronDown className="w-5 h-5 text-gray-400 shrink-0" />}
            </button>
            {open && (
                <div className="px-6 pb-5 text-sm text-gray-400 leading-relaxed">{a}</div>
            )}
        </div>
    );
}

/* ─── Waitlist Form Component ─────────────────────────────── */
function WaitlistForm({ variant = 'default' }: { variant?: 'default' | 'hero' | 'final' }) {
    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [phone, setPhone] = useState('');
    const [status, setStatus] = useState<'idle' | 'loading' | 'success' | 'already' | 'error'>('idle');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!email.trim() || !name.trim() || status === 'loading') return;

        setStatus('loading');
        try {
            const res = await fetch('/api/waitlist', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email.trim(), name: name.trim(), phone: phone.trim() }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            setStatus(data.message === 'already_registered' ? 'already' : 'success');
        } catch {
            setStatus('error');
        }
    };

    if (status === 'success' || status === 'already') {
        return (
            <div className={`flex items-center gap-3 ${variant === 'final' ? 'justify-center' : ''}`}>
                <div className="flex items-center gap-2 px-5 py-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-400">
                    <CheckCircle className="w-5 h-5" />
                    <span className="text-sm font-semibold">
                        {status === 'already' ? 'Ya estás en la lista. Te contactaremos pronto.' : 'Registrado. Te avisaremos cuando lancemos.'}
                    </span>
                </div>
            </div>
        );
    }

    const isHeroOrFinal = variant === 'hero' || variant === 'final';
    const inputClass = `w-full pl-10 pr-4 bg-white/5 border border-white/10 text-white placeholder-gray-500 rounded-xl focus:outline-none focus:border-[#d75c33]/50 focus:ring-1 focus:ring-[#d75c33]/30 transition-colors ${isHeroOrFinal ? 'py-3.5 text-base' : 'py-2.5 text-sm'}`;

    return (
        <form onSubmit={handleSubmit} className={`flex flex-col gap-3 ${variant === 'final' ? 'max-w-lg mx-auto' : ''}`}>
            <div className={`grid ${isHeroOrFinal ? 'grid-cols-1 sm:grid-cols-2' : 'grid-cols-2'} gap-3`}>
                <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="text"
                        required
                        placeholder="Tu nombre"
                        value={name}
                        onChange={e => setName(e.target.value)}
                        className={inputClass}
                    />
                </div>
                <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="tel"
                        placeholder="Tu teléfono (opcional)"
                        value={phone}
                        onChange={e => setPhone(e.target.value)}
                        className={inputClass}
                    />
                </div>
            </div>
            <div className={`flex ${isHeroOrFinal ? 'flex-col sm:flex-row' : 'flex-row'} items-center gap-3`}>
                <div className="relative flex-1 w-full">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                    <input
                        type="email"
                        required
                        placeholder="Tu correo electrónico"
                        value={email}
                        onChange={e => setEmail(e.target.value)}
                        className={inputClass}
                    />
                </div>
                <button
                    type="submit"
                    disabled={status === 'loading'}
                    className={`group flex items-center justify-center gap-2 bg-gradient-to-r from-[#d75c33] to-orange-500 text-white font-semibold rounded-xl hover:opacity-90 transition-opacity shadow-lg shadow-[#d75c33]/25 disabled:opacity-60 whitespace-nowrap ${isHeroOrFinal ? 'px-8 py-3.5 text-base w-full sm:w-auto' : 'px-5 py-2.5 text-sm'}`}
                >
                    {status === 'loading' ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                        <>
                            Unirme a la Beta
                            <ArrowRight className="w-4 h-4 group-hover:translate-x-1 transition-transform" />
                        </>
                    )}
                </button>
            </div>
            {status === 'error' && (
                <p className="text-xs text-rose-400">Error al registrar. Intenta de nuevo.</p>
            )}
        </form>
    );
}

/* ─── Main Landing Page ────────────────────────────────────── */
export default function LandingPage() {
    return (
        <div className="min-h-screen bg-[#0A0A0F] text-white overflow-x-hidden">
            {/* ─── Navigation ─────────────────────────────── */}
            <nav className="fixed top-0 w-full z-50 bg-[#0A0A0F]/80 backdrop-blur-xl border-b border-white/5">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                        <img src="/logos/grandline-isotipo.png" alt="Grand Line" className="w-8 h-8" />
                        <span className="text-lg font-bold tracking-tight">GRAND LINE</span>
                    </div>
                    <div className="hidden md:flex items-center gap-8 text-sm text-gray-400">
                        <a href="#modulos" className="hover:text-white transition-colors">Módulos</a>
                        <a href="#precios" className="hover:text-white transition-colors">Precios</a>
                        <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                    </div>
                    <div className="flex items-center gap-3">
                        <span className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/20 text-xs font-semibold text-amber-400">
                            <Zap className="w-3 h-3" /> Beta Privada
                        </span>
                        <a
                            href="#waitlist"
                            className="text-sm font-medium bg-gradient-to-r from-[#d75c33] to-orange-500 text-white px-5 py-2 rounded-lg hover:opacity-90 transition-opacity"
                        >
                            Lista de Espera
                        </a>
                    </div>
                </div>
            </nav>

            {/* ─── Hero ───────────────────────────────────── */}
            <section className="relative pt-32 pb-20 px-6">
                {/* Background glows */}
                <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] bg-gradient-to-b from-[#d75c33]/15 to-transparent rounded-full blur-[120px] pointer-events-none" />
                <div className="absolute top-40 right-0 w-[400px] h-[400px] bg-blue-500/10 rounded-full blur-[100px] pointer-events-none" />

                <div className="max-w-5xl mx-auto text-center relative z-10">
                    <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-8 rounded-full border border-white/10 bg-white/5 text-sm text-gray-300">
                        <Zap className="w-4 h-4 text-[#d75c33]" />
                        Plataforma #1 de Analytics para Dropshipping en LATAM
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold leading-[1.1] tracking-tight mb-6">
                        <span className="text-white">Deja de perder dinero.</span>
                        <br />
                        <span className="bg-gradient-to-r from-[#d75c33] via-orange-400 to-amber-400 bg-clip-text text-transparent">
                            Proyecciones en tiempo real
                        </span>
                    </h1>

                    <p className="text-lg md:text-xl text-gray-400 max-w-2xl mx-auto mb-10 leading-relaxed">
                        Importa tu reporte de Dropi y en segundos visualiza exactamente dónde estás perdiendo dinero,
                        qué transportadoras fallan, qué productos rinden y hacia dónde escalar.
                    </p>

                    <div id="waitlist" className="max-w-xl mx-auto w-full">
                        <p className="text-sm text-amber-400 font-medium mb-3 flex items-center justify-center gap-2">
                            <Zap className="w-4 h-4" /> Beta Privada — Cupos limitados
                        </p>
                        <WaitlistForm variant="hero" />
                        <p className="text-xs text-gray-500 mt-3">Te avisaremos cuando tu acceso esté listo. Sin spam.</p>
                    </div>

                    {/* VSL Video */}
                    <div className="mt-12 max-w-3xl mx-auto">
                        <div className="relative w-full rounded-2xl overflow-hidden border border-white/10 shadow-2xl shadow-[#d75c33]/10" style={{ paddingBottom: '56.25%' }}>
                            <iframe
                                className="absolute inset-0 w-full h-full"
                                src="https://www.youtube.com/embed/K_6ROx7IZYw?rel=0"
                                title="Grand Line - Video de Presentación"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                            />
                        </div>
                    </div>

                    {/* Trust badges */}
                    <div className="flex flex-wrap items-center justify-center gap-6 mt-14 text-sm text-gray-500">
                        <div className="flex items-center gap-2">
                            <Globe className="w-4 h-4" />
                            <span>Toda Latinoamérica</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Shield className="w-4 h-4" />
                            <span>Datos encriptados</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <TrendingUp className="w-4 h-4" />
                            <span>KPIs en tiempo real</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <Brain className="w-4 h-4" />
                            <span>IA integrada</span>
                        </div>
                    </div>
                </div>
            </section>

            {/* ─── Social Proof / Stats ────────────────────── */}
            <section className="py-16 px-6 border-y border-white/5">
                <div className="max-w-5xl mx-auto">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        {[
                            { value: 'LATAM', label: 'Cobertura completa', icon: Globe, isotipo: null },
                            { value: '8+', label: 'Módulos integrados', icon: Package, isotipo: '/logos/grandline-isotipo.png' },
                            { value: '100K+', label: 'Órdenes procesadas', icon: TrendingUp, isotipo: '/logos/wheel-isotipo.png' },
                            { value: '24/7', label: 'Vega IA — Tu oficial al mando', icon: Brain, isotipo: '/logos/vega-isotipo.png' },
                        ].map(({ value, label, icon: Icon, isotipo }) => (
                            <div key={label} className="space-y-2">
                                {isotipo ? (
                                    <img src={isotipo} alt={label} className="w-5 h-5 mx-auto mb-1 object-contain" />
                                ) : (
                                    <Icon className="w-5 h-5 mx-auto mb-1 text-[#d75c33]" />
                                )}
                                <div className="text-3xl md:text-4xl font-bold">{value}</div>
                                <div className={`text-sm ${label.includes('Vega') ? 'text-indigo-300 font-medium' : 'text-gray-500'}`}>{label}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Main Modules ────────────────────────────── */}
            <section id="modulos" className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">
                            5 módulos.{' '}
                            <span className="bg-gradient-to-r from-[#d75c33] to-orange-400 bg-clip-text text-transparent">
                                Control total.
                            </span>
                        </h2>
                        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
                            Cada módulo resuelve un problema real de tu operación dropshipping.
                        </p>
                    </div>

                    {/* Top row: 3 main modules */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
                        {modules.slice(0, 3).map(({ isotipo, name, subtitle, tagline, color, borderColor, glowColor, description, features }) => (
                            <div
                                key={name}
                                className={`group relative bg-white/[0.03] border ${borderColor} rounded-2xl p-7 hover:bg-white/[0.06] transition-all duration-300 shadow-lg ${glowColor}`}
                            >
                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg`}>
                                    <img src={isotipo} alt={name} className="w-6 h-6 object-contain brightness-0 invert" />
                                </div>

                                <h3 className="text-xl font-bold text-white mb-0.5">{name}</h3>
                                <p className="text-sm text-gray-500 mb-1">{subtitle}</p>
                                <p className="text-sm font-semibold bg-gradient-to-r from-white/80 to-white/50 bg-clip-text text-transparent mb-3 italic">
                                    &ldquo;{tagline}&rdquo;
                                </p>

                                <p className="text-sm text-gray-400 mb-5 leading-relaxed">{description}</p>

                                <ul className="space-y-2">
                                    {features.map(f => (
                                        <li key={f} className="flex items-start gap-2 text-xs text-gray-500">
                                            <Check className="w-3.5 h-3.5 text-green-500 mt-0.5 shrink-0" />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Bottom row: Vega (featured) + Sunny */}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {modules.slice(3).map(({ isotipo, name, subtitle, tagline, color, borderColor, glowColor, description, features, isVega }) => (
                            <div
                                key={name}
                                className={`group relative rounded-2xl p-7 transition-all duration-300 ${
                                    isVega
                                        ? 'bg-gradient-to-br from-indigo-500/[0.08] to-blue-500/[0.04] border border-indigo-400/30 shadow-xl shadow-indigo-500/10'
                                        : `bg-white/[0.03] border ${borderColor} shadow-lg ${glowColor}`
                                } hover:bg-white/[0.06]`}
                            >
                                {isVega && (
                                    <div className="absolute -top-3 right-6">
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-indigo-500/20 border border-indigo-400/30 text-xs font-semibold text-indigo-300">
                                            <img src="/logos/vega-isotipo.png" alt="Vega" className="w-3 h-3 object-contain" /> IA Integrada
                                        </span>
                                    </div>
                                )}

                                <div className={`w-11 h-11 rounded-xl bg-gradient-to-br ${color} flex items-center justify-center mb-4 shadow-lg`}>
                                    <img src={isotipo} alt={name} className="w-6 h-6 object-contain brightness-0 invert" />
                                </div>

                                <h3 className="text-xl font-bold text-white mb-0.5">{name}</h3>
                                <p className="text-sm text-gray-500 mb-1">{subtitle}</p>
                                <p className={`text-sm font-semibold mb-3 italic ${isVega ? 'text-indigo-300' : 'bg-gradient-to-r from-white/80 to-white/50 bg-clip-text text-transparent'}`}>
                                    &ldquo;{tagline}&rdquo;
                                </p>

                                <p className="text-sm text-gray-400 mb-5 leading-relaxed">{description}</p>

                                <ul className="space-y-2">
                                    {features.map(f => (
                                        <li key={f} className="flex items-start gap-2 text-xs text-gray-500">
                                            <Check className={`w-3.5 h-3.5 mt-0.5 shrink-0 ${isVega ? 'text-indigo-400' : 'text-green-500'}`} />
                                            <span>{f}</span>
                                        </li>
                                    ))}
                                </ul>
                            </div>
                        ))}
                    </div>

                    {/* Secondary modules */}
                    <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-5">
                        {secondaryModules.map(({ icon: Icon, name, description }) => (
                            <div
                                key={name}
                                className="flex items-start gap-4 p-5 rounded-xl border border-white/[0.06] bg-white/[0.02] hover:border-white/15 transition-colors"
                            >
                                <div className="w-9 h-9 rounded-lg bg-white/5 flex items-center justify-center shrink-0">
                                    <Icon className="w-4 h-4 text-gray-400" />
                                </div>
                                <div>
                                    <h4 className="text-sm font-semibold text-white mb-1">{name}</h4>
                                    <p className="text-xs text-gray-500 leading-relaxed">{description}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── How It Works ────────────────────────────── */}
            <section className="py-24 px-6 bg-white/[0.02]">
                <div className="max-w-5xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Empieza en 3 pasos
                        </h2>
                        <p className="text-gray-400 text-lg">Sin integraciones complicadas. Sin código. Sin esperas.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {[
                            {
                                step: '01',
                                title: 'Exporta de Dropi',
                                description: 'Descarga tu reporte de órdenes desde Dropi en formato Excel. Cualquier formato funciona.',
                                icon: FileText,
                            },
                            {
                                step: '02',
                                title: 'Sube a Grand Line',
                                description: 'Arrastra el archivo. El sistema detecta país, transportadoras y recaudo automáticamente.',
                                icon: Package,
                            },
                            {
                                step: '03',
                                title: 'Analiza y Escala',
                                description: 'Visualiza KPIs, mapas de calor, P&L y proyecciones. Toma decisiones con datos reales.',
                                icon: TrendingUp,
                            },
                        ].map(({ step, title, description, icon: Icon }) => (
                            <div key={step} className="relative text-center p-8 rounded-2xl border border-white/[0.06] bg-white/[0.02]">
                                <div className="text-5xl font-bold text-white/[0.06] absolute top-4 right-6">{step}</div>
                                <div className="w-12 h-12 rounded-xl bg-[#d75c33]/10 flex items-center justify-center mx-auto mb-4">
                                    <Icon className="w-6 h-6 text-[#d75c33]" />
                                </div>
                                <h3 className="text-lg font-semibold mb-2">{title}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">{description}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Countries ───────────────────────────────── */}
            <section className="py-20 px-6">
                <div className="max-w-6xl mx-auto text-center">
                    <h2 className="text-3xl md:text-4xl font-bold mb-4">Diseñado para toda Latinoamérica</h2>
                    <p className="text-gray-400 text-lg mb-12">Los 11 países de Dropi. Detección automática de país. Moneda local y USD en paralelo.</p>

                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4">
                        {[
                            { flag: '🇨🇴', name: 'Colombia', currency: 'COP' },
                            { flag: '🇲🇽', name: 'México', currency: 'MXN' },
                            { flag: '🇪🇨', name: 'Ecuador', currency: 'USD' },
                            { flag: '🇵🇪', name: 'Perú', currency: 'PEN' },
                            { flag: '🇨🇱', name: 'Chile', currency: 'CLP' },
                            { flag: '🇦🇷', name: 'Argentina', currency: 'ARS' },
                            { flag: '🇵🇾', name: 'Paraguay', currency: 'PYG' },
                            { flag: '🇬🇹', name: 'Guatemala', currency: 'GTQ' },
                            { flag: '🇵🇦', name: 'Panamá', currency: 'USD' },
                            { flag: '🇪🇸', name: 'España', currency: 'EUR' },
                            { flag: '🇨🇷', name: 'Costa Rica', currency: 'CRC' },
                        ].map(({ flag, name, currency }) => (
                            <div key={name} className="p-4 rounded-xl border border-white/[0.06] bg-white/[0.03] hover:border-white/15 transition-colors">
                                <div className="text-2xl mb-2">{flag}</div>
                                <div className="font-medium text-sm mb-0.5">{name}</div>
                                <div className="text-[11px] text-gray-500">{currency}</div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Vega IA Highlight ───────────────────────── */}
            <section className="py-24 px-6 relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-b from-indigo-500/[0.04] to-transparent pointer-events-none" />
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-indigo-500/[0.08] rounded-full blur-[120px] pointer-events-none" />

                <div className="max-w-4xl mx-auto relative z-10">
                    <div className="text-center mb-12">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full border border-indigo-400/20 bg-indigo-500/10 text-sm text-indigo-300">
                            <img src="/logos/vega-isotipo.png" alt="Vega" className="w-4 h-4 object-contain" />
                            Inteligencia Artificial
                        </div>
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">
                            Conoce a <span className="text-indigo-400">VEGA</span>
                        </h2>
                        <p className="text-xl text-gray-400 max-w-2xl mx-auto">
                            Tu oficial al mando. Siempre alerta. Analiza, anticipa y te avisa antes de que sea tarde.
                        </p>
                    </div>

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
                        {[
                            {
                                icon: Bot,
                                title: 'Chat Inteligente',
                                desc: 'Pregúntale cualquier cosa sobre tu operación. Vega analiza tus datos y responde con insights accionables.',
                            },
                            {
                                icon: Bell,
                                title: 'Alertas Proactivas',
                                desc: 'Detecta caídas en tasa de entrega, picos de devolución y anomalías antes de que impacten tu negocio.',
                            },
                            {
                                icon: FileText,
                                title: 'Reportes Automáticos',
                                desc: 'Genera reportes diarios, semanales y mensuales. Recibe un resumen ejecutivo sin mover un dedo.',
                            },
                            {
                                icon: Target,
                                title: 'Análisis Predictivo',
                                desc: 'Proyecta tendencias, identifica productos ganadores y sugiere dónde enfocar tu inversión publicitaria.',
                            },
                        ].map(({ icon: Icon, title, desc }) => (
                            <div key={title} className="p-6 rounded-xl border border-indigo-400/10 bg-white/[0.02] hover:border-indigo-400/25 transition-colors">
                                <Icon className="w-6 h-6 text-indigo-400 mb-3" />
                                <h3 className="text-base font-semibold text-white mb-2">{title}</h3>
                                <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── Pricing ─────────────────────────────────── */}
            <section id="precios" className="py-24 px-6 bg-white/[0.02]">
                <div className="max-w-6xl mx-auto">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl md:text-5xl font-bold mb-4">
                            Planes para cada etapa
                        </h2>
                        <p className="text-gray-400 text-lg">Únete a la lista de espera y accede a precios exclusivos de lanzamiento.</p>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                        {plans.map(({ name, price, period, trial, description, features, excluded, cta, popular, gradient, checkColor, comingSoon }) => (
                            <div
                                key={name}
                                className={`relative rounded-2xl p-[1px] ${popular ? `bg-gradient-to-b ${gradient}` : ''}`}
                            >
                                <div className={`h-full rounded-2xl p-8 flex flex-col ${popular ? 'bg-[#0E0E15]' : 'bg-white/[0.03] border border-white/[0.06]'}`}>
                                    {popular && (
                                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                            <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-[#d75c33] to-orange-500 text-xs font-semibold text-white shadow-lg">
                                                <Star className="w-3 h-3" /> Más Popular
                                            </span>
                                        </div>
                                    )}

                                    <h3 className="text-xl font-bold mb-1">{name}</h3>
                                    <p className="text-sm text-gray-400 mb-6">{description}</p>

                                    <div className="mb-2">
                                        <span className="text-4xl font-bold">${price}</span>
                                        <span className="text-gray-400 text-sm ml-1">USD{period}</span>
                                    </div>
                                    {trial && (
                                        <p className="text-sm font-medium text-green-400 mb-6">{trial}</p>
                                    )}
                                    {!trial && <div className="mb-6" />}

                                    <a
                                        href="#waitlist"
                                        className={`block w-full text-center py-3 rounded-xl text-sm font-semibold transition-all ${
                                            comingSoon
                                                ? 'bg-violet-500/10 text-violet-400 border border-violet-500/20'
                                                : popular
                                                    ? 'bg-gradient-to-r from-[#d75c33] to-orange-500 text-white hover:opacity-90 shadow-lg shadow-[#d75c33]/20'
                                                    : 'border border-white/10 text-white hover:bg-white/5'
                                        }`}
                                    >
                                        Unirme a la Lista de Espera
                                    </a>

                                    <ul className="mt-8 space-y-3 flex-1">
                                        {features.map(f => {
                                            const isVega = f.includes('VEGA');
                                            const isSunny = f.includes('SUNNY');
                                            return (
                                                <li key={f} className={`flex items-start gap-2.5 text-sm ${
                                                    isVega ? 'bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2.5 -mx-1'
                                                    : isSunny ? 'bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 -mx-1'
                                                    : 'text-gray-400'
                                                }`}>
                                                    {isVega ? (
                                                        <Bot className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" />
                                                    ) : isSunny ? (
                                                        <Rocket className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                                                    ) : (
                                                        <Check className={`w-4 h-4 mt-0.5 shrink-0 ${checkColor}`} />
                                                    )}
                                                    <span className={
                                                        isVega ? 'font-semibold text-indigo-300'
                                                        : isSunny ? 'font-semibold text-emerald-300'
                                                        : ''
                                                    }>{f}</span>
                                                </li>
                                            );
                                        })}
                                    </ul>

                                    {excluded.length > 0 && (
                                        <ul className="mt-4 pt-4 border-t border-white/5 space-y-2">
                                            {excluded.map(f => (
                                                <li key={f} className="flex items-start gap-2.5 text-sm text-gray-600">
                                                    <span className="w-4 h-4 mt-0.5 shrink-0 text-center text-xs">—</span>
                                                    <span>{f}</span>
                                                </li>
                                            ))}
                                        </ul>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── FAQ ─────────────────────────────────────── */}
            <section id="faq" className="py-24 px-6">
                <div className="max-w-3xl mx-auto">
                    <div className="text-center mb-12">
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">Preguntas Frecuentes</h2>
                    </div>

                    <div className="space-y-3">
                        {faqs.map(({ q, a }) => (
                            <FAQItem key={q} q={q} a={a} />
                        ))}
                    </div>
                </div>
            </section>

            {/* ─── CTA Final ───────────────────────────────── */}
            <section className="py-24 px-6">
                <div className="max-w-4xl mx-auto text-center relative">
                    <div className="absolute inset-0 bg-gradient-to-r from-[#d75c33]/10 via-purple-500/10 to-blue-500/10 rounded-3xl blur-[60px] pointer-events-none" />
                    <div className="relative bg-white/[0.03] border border-white/[0.08] rounded-3xl p-12 md:p-16">
                        <div className="inline-flex items-center gap-2 px-4 py-1.5 mb-6 rounded-full bg-amber-500/10 border border-amber-500/20 text-sm text-amber-400 font-semibold">
                            <Zap className="w-4 h-4" /> Beta Privada
                        </div>
                        <h2 className="text-3xl md:text-4xl font-bold mb-4">
                            Cada día sin datos es dinero que pierdes
                        </h2>
                        <p className="text-gray-400 text-lg mb-8 max-w-xl mx-auto">
                            Regístrate en la lista de espera y sé de los primeros en acceder a Grand Line.
                        </p>
                        <WaitlistForm variant="final" />
                    </div>
                </div>
            </section>

            {/* ─── Footer ──────────────────────────────────── */}
            <footer className="border-t border-white/5 py-12 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-2.5">
                            <img src="/logos/grandline-isotipo.png" alt="Grand Line" className="w-7 h-7" />
                            <span className="text-sm font-semibold">GRAND LINE v8.0</span>
                        </div>

                        <div className="flex items-center gap-6 text-sm text-gray-500">
                            <a href="#modulos" className="hover:text-white transition-colors">Módulos</a>
                            <a href="#precios" className="hover:text-white transition-colors">Precios</a>
                            <a href="#faq" className="hover:text-white transition-colors">FAQ</a>
                        </div>

                        <div className="flex items-center gap-4 text-xs text-gray-600">
                            <a href="/terms" className="hover:text-gray-400 transition-colors">Términos</a>
                            <a href="/privacy" className="hover:text-gray-400 transition-colors">Privacidad</a>
                            <span>Built with Antigravity AI</span>
                            <a href="/login" className="hover:text-gray-400 transition-colors">Iniciar Sesión</a>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}
