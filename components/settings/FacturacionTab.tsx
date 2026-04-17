'use client';

import React, { useState, useEffect } from 'react';
import { CreditCard, Loader2, ExternalLink, CheckCircle2, AlertCircle } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';

interface BillingInfo {
    plan: string;
    status: string;
    currentPeriodEnd: string;
    stripeCustomerId: string;
}

const PLAN_NAMES: Record<string, string> = {
    rookie: 'Rookie',
    supernova: 'Supernova',
    yonko: 'Yonko',
    free: 'Free',
};

const PLAN_PRICES: Record<string, string> = {
    rookie: '$27 USD',
    supernova: '$49 USD',
    yonko: '$97 USD',
    free: '$0',
};

export default function FacturacionTab() {
    const { profile } = useAuth();
    const [loading, setLoading] = useState(false);
    const [portalLoading, setPortalLoading] = useState(false);

    const plan = profile?.plan || 'free';
    const status = profile?.subscriptionStatus || 'inactive';
    const periodEnd = profile?.currentPeriodEnd;

    const formatDate = (d: any) => {
        if (!d) return '-';
        const date = d.toDate ? d.toDate() : new Date(d);
        return date.toLocaleDateString('es-CO', { day: 'numeric', month: 'long', year: 'numeric' });
    };

    const handleManageBilling = async () => {
        setPortalLoading(true);
        try {
            const res = await authFetch('/api/stripe/portal', { method: 'POST' });
            const data = await res.json();
            if (data.url) {
                window.open(data.url, '_blank');
            }
        } catch (e) {
            console.error('Error opening billing portal:', e);
        } finally {
            setPortalLoading(false);
        }
    };

    const handleChangePlan = () => {
        window.location.href = '/planes';
    };

    const statusColor = status === 'active' || status === 'trialing' ? '#10b981' : status === 'past_due' ? '#f59e0b' : '#ef4444';
    const statusLabel = status === 'active' ? 'Activo' : status === 'trialing' ? 'Periodo de Prueba' : status === 'past_due' ? 'Pago Pendiente' : 'Inactivo';

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div>
                <h1 className="text-3xl font-black tracking-tight">Facturacion</h1>
                <p className="text-muted mt-1 text-sm">Administra tu plan, metodo de pago e historial de cobros.</p>
            </div>

            {/* Plan + Status + Next billing */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div className="bg-card border border-card-border rounded-2xl p-6">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Plan Actual</div>
                    <div className="text-2xl font-black" style={{ color: '#d75c33' }}>
                        {PLAN_NAMES[plan] || plan}
                    </div>
                    <div className="text-sm text-muted mt-1">{PLAN_PRICES[plan] || ''} / mes</div>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-6">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Proxima Facturacion</div>
                    <div className="text-2xl font-black font-mono">
                        {periodEnd ? formatDate(periodEnd) : '-'}
                    </div>
                    <div className="text-sm text-muted mt-1">Renovacion automatica</div>
                </div>

                <div className="bg-card border border-card-border rounded-2xl p-6">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Estado</div>
                    <div className="text-2xl font-black" style={{ color: statusColor }}>
                        {statusLabel}
                    </div>
                    <div className="text-sm text-muted mt-1 flex items-center gap-1.5">
                        <div className="w-2 h-2 rounded-full" style={{ background: statusColor }} />
                        {status === 'active' || status === 'trialing' ? 'Suscripcion vigente' : 'Requiere atencion'}
                    </div>
                </div>
            </div>

            {/* Actions */}
            <div className="flex gap-3">
                <button
                    onClick={handleChangePlan}
                    className="px-6 py-3 bg-accent hover:bg-accent/90 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all"
                >
                    Cambiar Plan
                </button>
                <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="px-6 py-3 bg-card border border-card-border text-foreground font-bold text-xs uppercase tracking-widest rounded-xl hover:border-accent/30 transition-all flex items-center gap-2 disabled:opacity-50"
                >
                    {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ExternalLink className="w-3.5 h-3.5" />}
                    Gestionar en Stripe
                </button>
            </div>

            {/* Payment method + billing history — via Stripe Portal */}
            <div className="bg-card border border-card-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <CreditCard className="w-5 h-5 text-muted" />
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Metodo de Pago e Historial</h3>
                </div>
                <p className="text-sm text-muted leading-relaxed mb-4">
                    Para ver tu metodo de pago, historial de facturas y descargar recibos, usa el portal de Stripe.
                    Ahi puedes actualizar tu tarjeta, ver cobros anteriores y descargar facturas en PDF.
                </p>
                <button
                    onClick={handleManageBilling}
                    disabled={portalLoading}
                    className="flex items-center gap-2 px-5 py-2.5 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-emerald-500/20 transition-all disabled:opacity-50"
                >
                    {portalLoading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CreditCard className="w-3.5 h-3.5" />}
                    Abrir Portal de Facturacion
                </button>
            </div>
        </div>
    );
}
