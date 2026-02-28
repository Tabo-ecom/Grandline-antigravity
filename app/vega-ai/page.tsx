'use client';

import React, { useState } from 'react';
import { Activity, Bell, Settings } from 'lucide-react';
import dynamic from 'next/dynamic';

// Lazy-loaded tab components (only one visible at a time)
const VegaCoreMonitoring = dynamic(() => import('@/components/vega/VegaCoreMonitoring').then(m => ({ default: m.VegaCoreMonitoring })));
const VegaActiveAlerts = dynamic(() => import('@/components/vega/VegaActiveAlerts').then(m => ({ default: m.VegaActiveAlerts })));
const VegaAlertConfigPanel = dynamic(() => import('@/components/vega/VegaAlertConfigPanel').then(m => ({ default: m.VegaAlertConfigPanel })));
const VegaNotificationSettings = dynamic(() => import('@/components/vega/VegaNotificationSettings').then(m => ({ default: m.VegaNotificationSettings })));
const KPICalibration = dynamic(() => import('@/components/settings/KPICalibration').then(m => ({ default: m.KPICalibration })));

const TABS = [
    { key: 'monitoring', label: 'Monitoreo', icon: Activity },
    { key: 'alerts', label: 'Alertas', icon: Bell },
    { key: 'config', label: 'Configuración', icon: Settings },
];

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

            {activeTab === 'alerts' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    <VegaActiveAlerts />
                    <VegaAlertConfigPanel />
                </div>
            )}

            {activeTab === 'config' && (
                <div className="space-y-6">
                    <KPICalibration />
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        <VegaNotificationSettings />
                        <VegaAlertConfigPanel />
                    </div>
                </div>
            )}
        </div>
    );
}
