'use client';

import React, { useState } from 'react';
import { Activity, Crosshair, Settings, ChevronDown, ChevronRight, Clock, Bell as BellIcon, Send, Eye } from 'lucide-react';
import dynamic from 'next/dynamic';

const VegaCoreMonitoring = dynamic(() => import('@/components/vega/VegaCoreMonitoring').then(m => ({ default: m.VegaCoreMonitoring })));
const VegaScheduleSettings = dynamic(() => import('@/components/vega/VegaScheduleSettings').then(m => ({ default: m.VegaScheduleSettings })));
const VegaNotificationSettings = dynamic(() => import('@/components/vega/VegaNotificationSettings').then(m => ({ default: m.VegaNotificationSettings })));
const VegaAlertConfigPanel = dynamic(() => import('@/components/vega/VegaAlertConfigPanel').then(m => ({ default: m.VegaAlertConfigPanel })));
const VegaNotificationPreview = dynamic(() => import('@/components/vega/VegaNotificationPreview').then(m => ({ default: m.VegaNotificationPreview })));
const KPICalibration = dynamic(() => import('@/components/settings/KPICalibration').then(m => ({ default: m.KPICalibration })));

const TABS = [
    { key: 'monitoring', label: 'Monitoreo', icon: Activity },
    { key: 'kpis', label: 'Brújula', icon: Crosshair },
    { key: 'config', label: 'Configuración', icon: Settings },
];

function CollapsibleSection({
    title,
    icon: Icon,
    defaultOpen = false,
    children,
}: {
    title: string;
    icon: React.ElementType;
    defaultOpen?: boolean;
    children: React.ReactNode;
}) {
    const [open, setOpen] = useState(defaultOpen);

    return (
        <div className="bg-card border border-card-border rounded-2xl shadow-sm overflow-hidden">
            <button
                onClick={() => setOpen(!open)}
                className="w-full flex items-center justify-between px-5 py-4 hover:bg-hover-bg transition-colors"
            >
                <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-muted" />
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">{title}</h3>
                </div>
                {open
                    ? <ChevronDown className="w-4 h-4 text-muted" />
                    : <ChevronRight className="w-4 h-4 text-muted" />
                }
            </button>
            {open && (
                <div className="px-5 pb-5 border-t border-card-border pt-4">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function VegaAIPage() {
    const [activeTab, setActiveTab] = useState('monitoring');

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <img src="/logos/vega-logo.png" alt="Vega AI" className="h-12 w-auto object-contain hidden dark:block" />
                    <img src="/logos/vega-logo-dark.png" alt="Vega AI" className="h-12 w-auto object-contain block dark:hidden" />
                </div>
            </div>

            {/* Tab Navigation */}
            <div className="flex gap-1 bg-card border border-card-border rounded-2xl p-1.5 shadow-sm">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.key;
                    return (
                        <button
                            key={tab.key}
                            onClick={() => setActiveTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex-1 justify-center ${isActive
                                ? 'bg-accent/10 text-accent border border-accent/20'
                                : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                                }`}
                        >
                            <Icon className="w-3.5 h-3.5" />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeTab === 'monitoring' && <VegaCoreMonitoring />}

            {activeTab === 'kpis' && <KPICalibration />}

            {activeTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
                    {/* Left: Collapsible config sections */}
                    <div className="space-y-4">
                        <CollapsibleSection title="Horarios de Reportes" icon={Clock} defaultOpen>
                            <VegaScheduleSettings />
                        </CollapsibleSection>

                        <CollapsibleSection title="Canales de Notificación" icon={Send}>
                            <VegaNotificationSettings />
                        </CollapsibleSection>

                        <CollapsibleSection title="Reglas de Alertas" icon={BellIcon}>
                            <VegaAlertConfigPanel />
                        </CollapsibleSection>
                    </div>

                    {/* Right: Preview (sticky) */}
                    <div className="hidden lg:block">
                        <div className="sticky top-6">
                            <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                                <div className="flex items-center gap-2.5 mb-4">
                                    <Eye className="w-4 h-4 text-muted" />
                                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Preview</h3>
                                </div>
                                <VegaNotificationPreview />
                            </div>
                        </div>
                    </div>

                    {/* Mobile preview (below sections) */}
                    <div className="lg:hidden">
                        <CollapsibleSection title="Preview de Notificaciones" icon={Eye}>
                            <VegaNotificationPreview />
                        </CollapsibleSection>
                    </div>
                </div>
            )}
        </div>
    );
}
