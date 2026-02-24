"use client";

import React, { useState } from 'react';
import dynamic from 'next/dynamic';
import {
    Zap,
    Cpu,
    Globe,
    Rocket,
    Loader2
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useSunny } from '@/lib/context/SunnyContext';

const Lanzador = dynamic(() => import('@/components/sunny/Lanzador').then(m => ({ default: m.Lanzador })), {
    loading: () => <div className="flex h-[600px] items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>,
});
const Connectivity = dynamic(() => import('@/components/sunny/Connectivity').then(m => ({ default: m.Connectivity })), {
    loading: () => <div className="flex h-[600px] items-center justify-center"><Loader2 className="w-8 h-8 text-accent animate-spin" /></div>,
});

export default function SunnyPage() {
    const { user } = useAuth();
    const { loading } = useSunny();
    const [activeTab, setActiveTab] = useState('lanzador');

    if (!user) return null;

    return (
        <div className="min-h-screen bg-background text-foreground font-sans selection:bg-accent/30">
            <div className="relative z-10 p-4 md:p-8 max-w-[1600px] mx-auto space-y-6">
                {/* Header Section */}
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 border-b border-card-border pb-6">
                    <div>
                        <div className="flex items-center gap-2 mb-1">
                            <div className="p-1 px-2 bg-accent/10 rounded border border-accent/20">
                                <span className="text-[10px] font-black tracking-widest text-accent uppercase">System Active</span>
                            </div>
                        </div>
                        <h1 className="text-4xl font-black italic uppercase tracking-tighter flex items-center gap-3">
                            Módulo <span className="text-accent">Sunny</span>
                            <Rocket className="w-8 h-8 text-accent animate-pulse" />
                        </h1>
                        <p className="text-muted text-sm font-medium mt-1 uppercase tracking-widest">El Cañón de Campañas Masivas</p>
                    </div>

                    <div className="flex items-center gap-4 bg-card backdrop-blur-xl p-2 rounded-2xl border border-card-border">
                        <div className="flex items-center gap-2 px-4 py-2 bg-card rounded-xl border border-card-border">
                            <Globe className="w-4 h-4 text-blue-400" />
                            <span className="text-xs font-bold font-mono">USD/COP: 4,200</span>
                        </div>
                        <div className="w-px h-8 bg-card-border" />
                        <div className="flex gap-2">
                            <div className="w-8 h-8 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                                <span className="text-[10px] font-black text-blue-400">FB</span>
                            </div>
                            <div className="w-8 h-8 rounded-lg bg-card border border-card-border flex items-center justify-center">
                                <span className="text-[10px] font-black text-foreground">TT</span>
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex p-1 bg-card backdrop-blur-md rounded-2xl border border-card-border w-fit">
                    {[
                        { id: 'lanzador', label: 'El Lanzador', icon: Zap },
                        { id: 'conectividad', label: 'El Motor', icon: Cpu },
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl transition-all duration-300 ${activeTab === tab.id
                                ? 'bg-accent/10 text-accent font-black italic uppercase tracking-tighter border border-accent/20'
                                : 'text-muted hover:bg-hover-bg font-bold uppercase tracking-widest text-xs'
                                }`}
                        >
                            <tab.icon className={`w-4 h-4 ${activeTab === tab.id ? 'stroke-[3px]' : ''}`} />
                            {tab.label}
                        </button>
                    ))}
                </div>

                {/* Main Content Area */}
                <div className="min-h-[600px] bg-card rounded-[2.5rem] border border-card-border relative overflow-hidden">
                    {loading ? (
                        <div className="flex h-[600px] items-center justify-center">
                            <div className="flex flex-col items-center gap-4">
                                <Loader2 className="w-12 h-12 text-accent animate-spin" />
                                <p className="text-accent font-black uppercase tracking-widest text-xs italic animate-pulse">Sincronizando Sistema Sunny...</p>
                            </div>
                        </div>
                    ) : (
                        <>
                            {activeTab === 'lanzador' && <Lanzador />}
                            {activeTab === 'conectividad' && <Connectivity />}
                        </>
                    )}
                </div>
            </div>
        </div>
    );
}
