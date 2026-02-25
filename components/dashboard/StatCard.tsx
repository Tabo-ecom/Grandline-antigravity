import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const COLOR_MAP: Record<string, string> = {
    emerald: '#10b981',
    blue: '#3b82f6',
    indigo: '#6366f1',
    amber: '#f59e0b',
    rose: '#f43f5e',
    purple: '#a855f7',
};

interface StatCardProps {
    title: string;
    value: string;
    subvalue?: string;
    icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
    color: string;
    growth?: { current: number; prev: number };
    invert?: boolean;
}

export default React.memo(function StatCard({ title, value, subvalue, icon: Icon, color, growth, invert }: StatCardProps) {
    const hexColor = COLOR_MAP[color] || '#d75c33';
    const growthPct = growth?.prev && growth.prev > 0 ? ((growth.current - growth.prev) / Math.abs(growth.prev)) * 100 : null;
    const isPositive = growthPct !== null && (invert ? growthPct < 0 : growthPct > 0);

    return (
        <div className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all group shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">{title}</span>
                <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${hexColor}15` }}>
                    <Icon className="w-4 h-4" style={{ color: hexColor }} />
                </div>
            </div>
            <p className="text-xl font-black tracking-tight" style={{ color: hexColor }}>{value}</p>
            {subvalue && <p className="text-xs text-muted mt-1">{subvalue}</p>}
            {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {growthPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                </div>
            )}
        </div>
    );
});
