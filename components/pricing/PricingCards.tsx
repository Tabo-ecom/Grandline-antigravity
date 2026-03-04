'use client';

import React, { useState } from 'react';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';
import { Check, Loader2, Star, X, Bot, Rocket } from 'lucide-react';

const PLANS = [
    {
        id: 'rookie',
        name: 'Rookie',
        price: 27,
        period: '/mes',
        trial: '7 días gratis — sin tarjeta',
        description: 'Empieza a controlar tu operación.',
        priceEnvKey: 'NEXT_PUBLIC_STRIPE_ROOKIE_PRICE_ID',
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
        gradient: 'border-card-border',
        checkColor: 'text-green-500',
        popular: false,
        comingSoon: false,
    },
    {
        id: 'supernova',
        name: 'Supernova',
        price: 49,
        period: '/mes',
        trial: null,
        description: 'Todo para escalar sin límites.',
        priceEnvKey: 'NEXT_PUBLIC_STRIPE_SUPERNOVA_PRICE_ID',
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
        gradient: 'border-accent',
        checkColor: 'text-accent',
        popular: true,
        comingSoon: false,
    },
    {
        id: 'yonko',
        name: 'Yonko',
        price: 97,
        period: '/mes',
        trial: null,
        description: 'Para imperios multi-país.',
        priceEnvKey: 'NEXT_PUBLIC_STRIPE_YONKO_PRICE_ID',
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
        gradient: 'border-violet-500',
        checkColor: 'text-violet-400',
        popular: false,
        comingSoon: true,
    },
];

const PRICE_IDS: Record<string, string | undefined> = {
    rookie: process.env.NEXT_PUBLIC_STRIPE_ROOKIE_PRICE_ID,
    supernova: process.env.NEXT_PUBLIC_STRIPE_SUPERNOVA_PRICE_ID,
    yonko: process.env.NEXT_PUBLIC_STRIPE_YONKO_PRICE_ID,
};

export const PricingCards: React.FC = () => {
    const { user, profile } = useAuth();
    const [loading, setLoading] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    const currentPlan = profile?.plan || 'free';
    const isActive = profile?.subscriptionStatus === 'active';

    const handleCheckout = async (planId: string) => {
        const priceId = PRICE_IDS[planId];
        if (!user) {
            setError('Debes iniciar sesión para suscribirte.');
            return;
        }
        if (!priceId) {
            setError('Precio no configurado. Contacta soporte.');
            return;
        }

        setLoading(planId);
        setError(null);

        try {
            const res = await authFetch('/api/stripe/checkout', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ priceId, planId }),
            });

            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error al procesar el pago');
            window.location.href = data.url;
        } catch (err: any) {
            console.error(err);
            setError(err.message);
            setLoading(null);
        }
    };

    const handleManageBilling = async () => {
        if (!profile?.stripeCustomerId) {
            setError('No tienes una suscripción activa de Stripe. Si acabas de registrarte, primero selecciona un plan.');
            return;
        }
        setLoading('portal');
        try {
            const res = await authFetch('/api/stripe/portal', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ stripeCustomerId: profile.stripeCustomerId }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error);
            window.location.href = data.url;
        } catch (err: any) {
            console.error(err);
            setError('No se pudo abrir el portal de facturación.');
            setLoading(null);
        }
    };

    return (
        <div className="max-w-6xl mx-auto py-12 px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
                <h2 className="text-3xl font-extrabold text-foreground sm:text-4xl">
                    Planes para cada etapa
                </h2>
                <p className="mt-4 text-lg text-muted">
                    Controla, analiza y escala tu operación Dropshipping desde un solo lugar.
                </p>
                {error && (
                    <div className="mt-4 p-4 bg-red-500/10 border border-red-500/20 rounded-lg text-red-500 text-sm">
                        {error}
                    </div>
                )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto">
                {PLANS.map((plan) => {
                    const isCurrentPlan = isActive && currentPlan === plan.id;
                    const isUpgrade = isActive && !isCurrentPlan;

                    return (
                        <div
                            key={plan.id}
                            className={`relative rounded-2xl p-[1px] ${plan.popular ? 'bg-gradient-to-b from-accent to-orange-500' : ''}`}
                        >
                            <div className={`h-full rounded-2xl p-8 flex flex-col ${plan.popular ? 'bg-card' : `bg-card border ${plan.gradient}`}`}>
                                {plan.popular && (
                                    <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                                        <span className="inline-flex items-center gap-1 px-3 py-1 rounded-full bg-gradient-to-r from-accent to-orange-500 text-xs font-semibold text-white shadow-lg">
                                            <Star className="w-3 h-3" /> Más Popular
                                        </span>
                                    </div>
                                )}

                                <h3 className="text-xl font-bold text-foreground mb-1">{plan.name}</h3>
                                <p className="text-sm text-muted mb-6">{plan.description}</p>

                                <div className="mb-2">
                                    <span className="text-4xl font-extrabold text-foreground">${plan.price}</span>
                                    <span className="text-muted text-sm ml-1">USD{plan.period}</span>
                                </div>
                                {plan.trial && (
                                    <p className="text-sm font-medium text-green-400 mb-6">{plan.trial}</p>
                                )}
                                {!plan.trial && <div className="mb-6" />}

                                {plan.comingSoon ? (
                                    <button
                                        disabled
                                        className="w-full py-3 rounded-xl text-sm font-semibold bg-violet-500/10 text-violet-400 border border-violet-500/20 cursor-not-allowed"
                                    >
                                        Próximamente
                                    </button>
                                ) : isCurrentPlan ? (
                                    <button
                                        onClick={handleManageBilling}
                                        disabled={loading === 'portal'}
                                        className="w-full py-3 rounded-xl text-sm font-semibold bg-hover-bg text-foreground hover:bg-card-border transition-colors"
                                    >
                                        {loading === 'portal' ? (
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                        ) : (
                                            'Administrar Suscripción'
                                        )}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => handleCheckout(plan.id)}
                                        disabled={loading === plan.id}
                                        className={`w-full py-3 rounded-xl text-sm font-semibold transition-all disabled:opacity-50 ${
                                            plan.popular
                                                ? 'bg-gradient-to-r from-accent to-orange-500 text-white hover:opacity-90 shadow-lg shadow-accent/20'
                                                : 'border border-card-border text-foreground hover:bg-hover-bg'
                                        }`}
                                    >
                                        {loading === plan.id ? (
                                            <Loader2 className="w-5 h-5 animate-spin mx-auto" />
                                        ) : isUpgrade ? (
                                            `Cambiar a ${plan.name}`
                                        ) : (
                                            plan.id === 'rookie' ? 'Probar Gratis — Sin Tarjeta' : `Suscribirse a ${plan.name}`
                                        )}
                                    </button>
                                )}

                                <ul className="mt-8 space-y-3 flex-1">
                                    {plan.features.map((f) => {
                                        const isVega = f.includes('VEGA');
                                        const isSunny = f.includes('SUNNY');
                                        return (
                                            <li key={f} className={`flex items-start gap-2.5 text-sm ${
                                                isVega ? 'bg-indigo-500/10 border border-indigo-500/20 rounded-xl px-3 py-2.5 -mx-1'
                                                : isSunny ? 'bg-emerald-500/10 border border-emerald-500/20 rounded-xl px-3 py-2.5 -mx-1'
                                                : 'text-muted'
                                            }`}>
                                                {isVega ? (
                                                    <Bot className="w-4 h-4 mt-0.5 shrink-0 text-indigo-400" />
                                                ) : isSunny ? (
                                                    <Rocket className="w-4 h-4 mt-0.5 shrink-0 text-emerald-400" />
                                                ) : (
                                                    <Check className={`w-4 h-4 mt-0.5 shrink-0 ${plan.checkColor}`} />
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

                                {plan.excluded.length > 0 && (
                                    <ul className="mt-4 pt-4 border-t border-card-border space-y-2">
                                        {plan.excluded.map((f) => (
                                            <li key={f} className="flex items-start gap-2.5 text-sm text-muted/50">
                                                <X className="w-4 h-4 mt-0.5 shrink-0 text-muted/40" />
                                                <span>{f}</span>
                                            </li>
                                        ))}
                                    </ul>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
