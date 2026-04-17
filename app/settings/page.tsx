'use client';

import React, { useState } from 'react';
import { Link2, CreditCard, Users, ArrowLeft, Settings } from 'lucide-react';
import dynamic from 'next/dynamic';

const IntegracionesTab = dynamic(() => import('@/components/settings/IntegracionesTab'));
const UsuariosPage = dynamic(() => import('@/app/usuarios/page'));

// Facturacion will use Stripe portal + local UI
const FacturacionTab = dynamic(() => import('@/components/settings/FacturacionTab'));

type SettingsSection = 'mosaic' | 'integraciones' | 'facturacion' | 'usuarios';

const SECTIONS = [
    {
        key: 'integraciones' as const,
        label: 'Integraciones',
        desc: 'Conecta ChatGPT, Gemini, Claude, Facebook, TikTok y Shopify',
        icon: Link2,
        color: '#d75c33',
        badge: '6 servicios',
    },
    {
        key: 'facturacion' as const,
        label: 'Facturacion',
        desc: 'Plan actual, historial de cobros y metodo de pago',
        icon: CreditCard,
        color: '#10b981',
        badge: null, // will be dynamic
    },
    {
        key: 'usuarios' as const,
        label: 'Usuarios',
        desc: 'Gestiona tu equipo, roles y permisos de acceso',
        icon: Users,
        color: '#3b82f6',
        badge: null,
    },
];

export default function SettingsPage() {
    const [activeSection, setActiveSection] = useState<SettingsSection>('mosaic');

    // Auto-open integraciones if redirected from TikTok OAuth
    React.useEffect(() => {
        if (window.location.search.includes('tiktok_connected')) {
            setActiveSection('integraciones');
        }
    }, []);

    if (activeSection !== 'mosaic') {
        return (
            <div className="max-w-5xl mx-auto space-y-6">
                <button
                    onClick={() => setActiveSection('mosaic')}
                    className="flex items-center gap-2 text-sm text-muted hover:text-foreground transition-colors font-semibold"
                >
                    <ArrowLeft className="w-4 h-4" />
                    Configuracion
                </button>

                {activeSection === 'integraciones' && <IntegracionesTab />}
                {activeSection === 'facturacion' && <FacturacionTab />}
                {activeSection === 'usuarios' && <UsuariosPage />}
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            <div className="flex items-center gap-3">
                <Settings className="w-7 h-7 text-muted" />
                <h1 className="text-3xl font-black tracking-tight">Configuracion</h1>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                {SECTIONS.map(sec => {
                    const Icon = sec.icon;
                    return (
                        <button
                            key={sec.key}
                            onClick={() => setActiveSection(sec.key)}
                            className="bg-card border border-card-border rounded-2xl p-8 text-left hover:border-accent/30 transition-all group relative overflow-hidden"
                        >
                            <div className="absolute top-0 right-0 w-32 h-32 blur-3xl -mr-16 -mt-16 transition-colors opacity-0 group-hover:opacity-100" style={{ background: `${sec.color}15` }} />

                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5"
                                style={{ background: `${sec.color}10` }}
                            >
                                <Icon className="w-6 h-6" style={{ color: sec.color }} />
                            </div>

                            <h3 className="text-lg font-black uppercase tracking-tight mb-2">{sec.label}</h3>
                            <p className="text-xs text-muted leading-relaxed">{sec.desc}</p>

                            {sec.badge && (
                                <span
                                    className="absolute top-5 right-5 text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border"
                                    style={{
                                        background: `${sec.color}10`,
                                        color: sec.color,
                                        borderColor: `${sec.color}20`,
                                    }}
                                >
                                    {sec.badge}
                                </span>
                            )}
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
