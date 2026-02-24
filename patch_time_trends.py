import re

new_content = """import React, { useState } from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import {
    LineChart,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip as ReTooltip,
    ResponsiveContainer,
    AreaChart,
    Area,
    Legend
} from 'recharts';


interface TimeData {
    date: string;
    roas: number;
    spend: number;
    revenue: number;
    cpa: number;
    projectedProfit: number;
}

interface TimeTrendsProps {
    data: TimeData[];
}

export const TimeTrends: React.FC<TimeTrendsProps> = ({ data }) => {
    const [view, setView] = useState<'profit' | 'cpa'>('profit');

    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">
                        {view === 'profit' ? 'Inversión vs Utilidad Proyectada' : 'Tendencia de CPA MKT'}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                        {view === 'profit' ? 'Comparativa de gasto, ingresos y rentabilidad estimada.' : 'Evolución del costo por compra en el tiempo.'}
                    </p>
                </div>
                
                <div className="flex bg-hover-bg border border-card-border p-1 rounded-xl shrink-0">
                    <button 
                        onClick={() => setView('profit')} 
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'profit' ? 'bg-[#d75c33] text-white' : 'text-muted hover:text-foreground'}`}
                    >
                        Utilidad
                    </button>
                    <button 
                        onClick={() => setView('cpa')} 
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'cpa' ? 'bg-emerald-500 text-white' : 'text-muted hover:text-foreground'}`}
                    >
                        CPA Trend
                    </button>
                </div>
            </div>
            
            <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    {view === 'profit' ? (
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorSpend" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#d75c33" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#d75c33" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: 'var(--muted)', fontSize: 10, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(str) => new Date(str).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                            />
                            <YAxis
                                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
                            />
                            <ReTooltip
                                contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}
                                itemStyle={{ fontSize: '10px', fontWeight: 'bold', color: 'var(--foreground)' }}
                                labelStyle={{ color: 'var(--muted)' }}
                                formatter={(val: any) => formatCurrency(val)}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                            <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={0} name="Ingresos" strokeWidth={2} />
                            <Area type="monotone" dataKey="spend" stroke="#d75c33" fillOpacity={1} fill="url(#colorSpend)" name="Inversión (Gasto)" strokeWidth={2} />
                            <Area type="monotone" dataKey="projectedProfit" stroke="#10b981" fillOpacity={0.6} fill="url(#colorProfit)" name="Utilidad Proyectada" strokeWidth={3} />
                        </AreaChart>
                    ) : (
                        <LineChart data={data}>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" vertical={false} />
                            <XAxis
                                dataKey="date"
                                tick={{ fill: 'var(--muted)', fontSize: 10, fontWeight: 700 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(str) => new Date(str).toLocaleDateString('es-CO', { day: '2-digit', month: 'short' })}
                            />
                            {/* Left Y Axis for CPA (usually smaller numbers) */}
                            <YAxis
                                yAxisId="left"
                                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                            />
                            {/* Right Y Axis for Spend / Revenue (usually larger numbers) */}
                            <YAxis
                                yAxisId="right"
                                orientation="right"
                                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `$${(val / 1000000).toFixed(1)}M`}
                            />
                            <ReTooltip
                                contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}
                                itemStyle={{ fontSize: '10px', fontWeight: 'bold' }}
                                labelStyle={{ color: 'var(--muted)' }}
                                formatter={(val: any) => formatCurrency(val)}
                            />
                            <Legend wrapperStyle={{ fontSize: '10px', paddingTop: '20px' }} />
                            <Line yAxisId="left" type="monotone" dataKey="cpa" stroke="#10b981" strokeWidth={3} dot={{ r: 4, strokeWidth: 2 }} activeDot={{ r: 6 }} name="CPA Real" />
                            <Line yAxisId="right" type="monotone" dataKey="spend" stroke="#d75c33" strokeDasharray="5 5" strokeWidth={2} dot={false} name="Gasto MKT" />
                        </LineChart>
                    )}
                </ResponsiveContainer>
            </div>
        </div>
    );
};
"""

with open('components/publicidad/TimeTrends.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Redesigned TimeTrends successfully")

