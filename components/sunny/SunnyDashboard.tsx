"use client";

import React from 'react';
import {
    Activity,
    TrendingUp,
    Target,
    Zap,
    ShieldCheck,
    BarChart3,
    MapPinOff
} from 'lucide-react';
import InfoTooltip from '@/components/common/InfoTooltip';

export const SunnyDashboard: React.FC = () => {
    return (
        <div className="p-8 space-y-8 animate-in fade-in duration-700">
            {/* Real-time Status Row */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                {[
                    { label: 'Cuentas Activas', value: '12', icon: ShieldCheck, color: 'text-emerald-400', tooltip: 'Número de cuentas publicitarias activas conectadas a Sunny.' },
                    { label: 'Campañas Hoy', value: '48', icon: Zap, color: 'text-accent', tooltip: 'Total de campañas que tuvieron gasto publicitario en el día de hoy.' },
                    { label: 'Gasto Consolidado', value: '$1.2M', icon: TrendingUp, color: 'text-blue-400', tooltip: 'Gasto total acumulado en publicidad de todas las cuentas conectadas.' },
                    { label: 'ROAS Global', value: '4.2x', icon: Target, color: 'text-purple-400', tooltip: 'Retorno sobre inversión en ads consolidado de todas las cuentas.' },
                ].map((stat, i) => (
                    <div key={i} className="bg-card border border-card-border p-6 rounded-3xl group hover:border-accent/20 transition-all">
                        <div className="flex justify-between items-start mb-4">
                            <stat.icon className={`w-5 h-5 ${stat.color}`} />
                            <div className="px-2 py-1 bg-accent/10 rounded text-[8px] font-black uppercase text-accent">Live</div>
                        </div>
                        <div className="space-y-1">
                            <h3 className="text-3xl font-black italic tracking-tighter font-mono">{stat.value}</h3>
                            <p className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-1">{stat.label} <InfoTooltip text={stat.tooltip} /></p>
                        </div>
                    </div>
                ))}
            </div>

            {/* Main Stats Area */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                <div className="lg:col-span-2 bg-card border border-card-border rounded-[2.5rem] p-8 space-y-6 relative overflow-hidden">
                    <div className="flex justify-between items-end relative z-10">
                        <div>
                            <h2 className="text-2xl font-black italic uppercase tracking-tighter">Performance Matrix</h2>
                            <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Aggregated platform metrics (CO / EC / PA)</p>
                        </div>
                        <div className="flex gap-2">
                            <div className="px-3 py-1 bg-blue-500/10 border border-blue-500/30 rounded-full flex items-center gap-2 text-[10px] font-black text-blue-400">
                                <div className="w-1 h-1 bg-blue-400 rounded-full animate-pulse" />
                                Meta Ads
                            </div>
                            <div className="px-3 py-1 bg-card border border-card-border rounded-full flex items-center gap-2 text-[10px] font-black text-muted">
                                TikTok Ads
                            </div>
                        </div>
                    </div>

                    <div className="h-[300px] w-full flex items-end gap-2 relative z-10">
                        {[40, 70, 45, 90, 65, 80, 50, 60, 85, 40, 95, 75].map((h, i) => (
                            <div key={i} className="flex-1 flex flex-col items-center gap-2 group">
                                <div className="w-full bg-accent/10 rounded-t-lg relative overflow-hidden group-hover:bg-accent/20 transition-all" style={{ height: `${h}%` }}>
                                    <div className="absolute top-0 left-0 w-full h-1 bg-accent" />
                                </div>
                                <span className="text-[8px] font-mono text-muted">0{i}:00</span>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-6">
                    <div className="p-8 bg-accent/5 border border-accent/20 rounded-[2.5rem] space-y-4">
                        <div className="flex items-center gap-3">
                            <Activity className="w-6 h-6 text-accent" />
                            <h3 className="text-xl font-black italic uppercase tracking-tighter">Power Consumption</h3>
                        </div>
                        <p className="text-muted text-xs font-medium leading-relaxed uppercase tracking-widest">
                            El sistema está operando al 85% de su capacidad. 12 campañas en cola de lanzamiento.
                        </p>
                        <div className="space-y-2">
                            <div className="flex justify-between text-[10px] font-mono">
                                <span className="text-muted">SYSTEM HEALTH</span>
                                <span className="text-accent uppercase">Stable</span>
                            </div>
                            <div className="h-1.5 bg-background rounded-full overflow-hidden border border-card-border">
                                <div className="h-full bg-accent w-[85%]" />
                            </div>
                        </div>
                    </div>

                    <div className="p-8 bg-card border border-card-border rounded-[2.5rem] space-y-6">
                        <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Notificaciones de Sistemas</h4>
                        <div className="space-y-4">
                            {[
                                { msg: 'Campaña "HER LOSS" lanzada con éxito en 3 cuentas.', time: 'Hace 2 min', type: 'success' },
                                { msg: 'Presupuesto de Ecuador llegando al límite diario.', time: 'Hace 15 min', type: 'warning' },
                                { msg: 'Nueva cuenta de TikTok Ads vinculada.', time: 'Hace 1 hora', type: 'info' }
                            ].map((n, i) => (
                                <div key={i} className="flex gap-4 items-start">
                                    <div className={`mt-1 w-1.5 h-1.5 rounded-full shrink-0 ${n.type === 'success' ? 'bg-emerald-500' :
                                            n.type === 'warning' ? 'bg-accent' :
                                                'bg-blue-500'
                                        }`} />
                                    <div className="space-y-0.5">
                                        <p className="text-[10px] font-bold text-foreground/80 leading-tight uppercase tracking-tight">{n.msg}</p>
                                        <span className="text-[8px] font-mono text-muted block">{n.time}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
