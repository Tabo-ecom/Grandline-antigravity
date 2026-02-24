import React, { useState } from 'react';
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

type LineKey = 'revenue' | 'spend' | 'projectedProfit';

const LINE_CONFIG: Record<LineKey, { label: string; color: string; gradient: string }> = {
    revenue: { label: 'Facturado', color: '#3b82f6', gradient: 'colorRevenue' },
    spend: { label: 'Inversión Ads', color: '#d75c33', gradient: 'colorSpend' },
    projectedProfit: { label: 'Utilidad Proy.', color: '#10b981', gradient: 'colorProfit' },
};

export const TimeTrends: React.FC<TimeTrendsProps> = ({ data }) => {
    const [view, setView] = useState<'profit' | 'cpa'>('profit');
    const [visibleLines, setVisibleLines] = useState<Record<LineKey, boolean>>({
        revenue: true,
        spend: true,
        projectedProfit: true,
    });

    const toggleLine = (key: LineKey) => {
        setVisibleLines(prev => {
            const next = { ...prev, [key]: !prev[key] };
            // Ensure at least one line is always visible
            if (!Object.values(next).some(Boolean)) return prev;
            return next;
        });
    };

    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between mb-4 gap-4">
                <div>
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">
                        {view === 'profit' ? 'Facturado vs Ads vs Utilidad' : 'Tendencia de CPA MKT'}
                    </h3>
                    <p className="text-xs text-muted mt-1">
                        {view === 'profit' ? 'Comparativa de facturación, inversión y rentabilidad.' : 'Evolución del costo por compra en el tiempo.'}
                    </p>
                </div>

                <div className="flex bg-hover-bg border border-card-border p-1 rounded-xl shrink-0">
                    <button
                        onClick={() => setView('profit')}
                        className={`px-4 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${view === 'profit' ? 'bg-accent text-white' : 'text-muted hover:text-foreground'}`}
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

            {view === 'profit' && (
                <div className="flex items-center gap-2 mb-4">
                    {(Object.entries(LINE_CONFIG) as [LineKey, typeof LINE_CONFIG[LineKey]][]).map(([key, cfg]) => (
                        <button
                            key={key}
                            onClick={() => toggleLine(key)}
                            className={`flex items-center gap-1.5 px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all border ${
                                visibleLines[key]
                                    ? 'border-card-border bg-card-bg'
                                    : 'border-transparent bg-hover-bg text-muted opacity-50'
                            }`}
                        >
                            <span
                                className="w-2.5 h-2.5 rounded-full shrink-0"
                                style={{ backgroundColor: visibleLines[key] ? cfg.color : 'var(--muted)' }}
                            />
                            {cfg.label}
                        </button>
                    ))}
                </div>
            )}

            <div className="h-[350px]">
                <ResponsiveContainer width="100%" height="100%">
                    {view === 'profit' ? (
                        <AreaChart data={data}>
                            <defs>
                                <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                                </linearGradient>
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
                            {visibleLines.revenue && (
                                <Area type="monotone" dataKey="revenue" stroke="#3b82f6" fillOpacity={1} fill="url(#colorRevenue)" name="Facturado" strokeWidth={2} />
                            )}
                            {visibleLines.spend && (
                                <Area type="monotone" dataKey="spend" stroke="#d75c33" fillOpacity={1} fill="url(#colorSpend)" name="Inversión Ads" strokeWidth={2} />
                            )}
                            {visibleLines.projectedProfit && (
                                <Area type="monotone" dataKey="projectedProfit" stroke="#10b981" fillOpacity={0.6} fill="url(#colorProfit)" name="Utilidad Proyectada" strokeWidth={3} />
                            )}
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
                            <YAxis
                                yAxisId="left"
                                tick={{ fill: 'var(--muted)', fontSize: 10 }}
                                axisLine={false}
                                tickLine={false}
                                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
                            />
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
