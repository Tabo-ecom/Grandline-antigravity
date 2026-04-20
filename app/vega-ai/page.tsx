'use client';

import React, { useState, useCallback } from 'react';
import { Microscope, Palette, BarChart3, ChevronDown, ChevronRight, Clock, Bell as BellIcon, Send, Eye, Activity, Crosshair, Settings, Mic } from 'lucide-react';
import dynamic from 'next/dynamic';

// Satellite tabs — lazy loaded
const GeneralTab = dynamic(() => import('@/components/vega/GeneralTab'));
const PythagorasTab = dynamic(() => import('@/components/vega/PythagorasTab'));
const EdisonTab = dynamic(() => import('@/components/vega/EdisonTab'));
const TranscriberTab = dynamic(() => import('@/components/vega/TranscriberTab'));

// Shaka sub-components (existing)
const VegaCoreMonitoring = dynamic(() => import('@/components/vega/VegaCoreMonitoring').then(m => ({ default: m.VegaCoreMonitoring })));
const VegaScheduleSettings = dynamic(() => import('@/components/vega/VegaScheduleSettings').then(m => ({ default: m.VegaScheduleSettings })));
const VegaNotificationSettings = dynamic(() => import('@/components/vega/VegaNotificationSettings').then(m => ({ default: m.VegaNotificationSettings })));
const VegaAlertConfigPanel = dynamic(() => import('@/components/vega/VegaAlertConfigPanel').then(m => ({ default: m.VegaAlertConfigPanel })));
const VegaNotificationPreview = dynamic(() => import('@/components/vega/VegaNotificationPreview').then(m => ({ default: m.VegaNotificationPreview })));
const KPICalibration = dynamic(() => import('@/components/settings/KPICalibration').then(m => ({ default: m.KPICalibration })));

// ── Satellite Definitions ──────────────────────────────────────────────────
const SATELLITES = [
    { key: 'general', label: 'General', subtitle: 'Agentes & Flujos', icon: Activity, color: '#d75c33' },
    { key: 'pythagoras', label: 'Pythagoras', subtitle: 'Market Research', icon: Microscope, color: '#AA77FF' },
    { key: 'edison', label: 'Edison', subtitle: 'Creative Designer', icon: Palette, color: '#FF8844' },
    { key: 'shaka', label: 'Shaka', subtitle: 'Data Analytics', icon: BarChart3, color: '#00CFFF' },
    { key: 'transcriber', label: 'Transcriptor', subtitle: 'Video → Texto', icon: Mic, color: '#EC4899' },
] as const;

type SatelliteKey = typeof SATELLITES[number]['key'];

// ── Collapsible Section (for Shaka) ────────────────────────────────────────
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
            <button onClick={() => setOpen(!open)} className="w-full flex items-center justify-between px-5 py-4 hover:bg-hover-bg transition-colors">
                <div className="flex items-center gap-2.5">
                    <Icon className="w-4 h-4 text-muted" />
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">{title}</h3>
                </div>
                {open ? <ChevronDown className="w-4 h-4 text-muted" /> : <ChevronRight className="w-4 h-4 text-muted" />}
            </button>
            {open && <div className="px-5 pb-5 border-t border-card-border pt-4">{children}</div>}
        </div>
    );
}

// ── Shaka Sub-tabs ─────────────────────────────────────────────────────────
const SHAKA_TABS = [
    { key: 'monitoring', label: 'Monitoreo', icon: Activity },
    { key: 'kpis', label: 'Brújula', icon: Crosshair },
    { key: 'config', label: 'Configuración', icon: Settings },
];

function ShakaTab() {
    const [shakaTab, setShakaTab] = useState('monitoring');
    return (
        <div className="space-y-6">
            <div className="flex gap-1 bg-card border border-card-border rounded-2xl p-1.5 shadow-sm">
                {SHAKA_TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = shakaTab === tab.key;
                    return (
                        <button key={tab.key} onClick={() => setShakaTab(tab.key)}
                            className={`flex items-center gap-2 px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex-1 justify-center ${isActive ? 'bg-accent/10 text-accent border border-accent/20' : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'}`}
                        >
                            <Icon className="w-3.5 h-3.5" />{tab.label}
                        </button>
                    );
                })}
            </div>

            {shakaTab === 'monitoring' && <VegaCoreMonitoring />}
            {shakaTab === 'kpis' && <KPICalibration />}
            {shakaTab === 'config' && (
                <div className="grid grid-cols-1 lg:grid-cols-[1fr_380px] gap-6">
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

// ── Main Page ──────────────────────────────────────────────────────────────
export default function VegaAIPage() {
    const [activeSatellite, setActiveSatellite] = useState<SatelliteKey>('pythagoras');

    // Edison pre-fill state (when Pythagoras passes URL + research data)
    const [edisonUrl, setEdisonUrl] = useState('');
    const [edisonNiche, setEdisonNiche] = useState('');
    const [edisonResearchData, setEdisonResearchData] = useState<any>(null);

    const handleCreateLanding = useCallback((url: string, niche: string, researchData?: any) => {
        setEdisonUrl(url);
        setEdisonNiche(niche);
        setEdisonResearchData(researchData || null);
        setActiveSatellite('edison');
    }, []);

    return (
        <div className="space-y-6 max-w-[1400px] mx-auto">
            {/* Header */}
            <div className="flex items-center gap-4">
                <img src="/logos/vega-logo.png" alt="Vega AI" className="h-12 w-auto object-contain hidden dark:block" />
                <img src="/logos/vega-logo-dark.png" alt="Vega AI" className="h-12 w-auto object-contain block dark:hidden" />
            </div>

            {/* Satellite Navigation */}
            <div className="flex gap-1.5 bg-card border border-card-border rounded-2xl p-1.5 shadow-sm">
                {SATELLITES.map(sat => {
                    const Icon = sat.icon;
                    const isActive = activeSatellite === sat.key;
                    return (
                        <button
                            key={sat.key}
                            onClick={() => setActiveSatellite(sat.key)}
                            className={`flex items-center gap-2.5 px-5 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex-1 justify-center ${isActive
                                ? 'border shadow-sm'
                                : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                            }`}
                            style={isActive ? {
                                background: `${sat.color}10`,
                                borderColor: `${sat.color}30`,
                                color: sat.color,
                            } : undefined}
                        >
                            <Icon className="w-4 h-4" />
                            <div className="hidden sm:flex flex-col items-start">
                                <span>{sat.label}</span>
                                <span className="text-[8px] font-semibold tracking-wider opacity-60 normal-case">{sat.subtitle}</span>
                            </div>
                            <span className="sm:hidden">{sat.label}</span>
                        </button>
                    );
                })}
            </div>

            {/* Tab Content */}
            {activeSatellite === 'general' && (
                <GeneralTab />
            )}

            {activeSatellite === 'pythagoras' && (
                <PythagorasTab onCreateLanding={handleCreateLanding} />
            )}

            {activeSatellite === 'edison' && (
                <EdisonTab
                    key={edisonUrl || 'default'}
                    initialUrl={edisonUrl}
                    initialNiche={edisonNiche}
                    initialResearchData={edisonResearchData}
                />
            )}

            {activeSatellite === 'shaka' && (
                <ShakaTab />
            )}

            {activeSatellite === 'transcriber' && (
                <TranscriberTab />
            )}
        </div>
    );
}
