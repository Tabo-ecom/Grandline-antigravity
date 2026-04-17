import React from 'react';
import { TrendingUp, TrendingDown } from 'lucide-react';

const COLOR_MAP: Record<string, { hex: string; gradient: string }> = {
    emerald: { hex: '#10b981', gradient: 'from-emerald-500 to-teal-500' },
    blue: { hex: '#3b82f6', gradient: 'from-blue-500 to-indigo-500' },
    indigo: { hex: '#6366f1', gradient: 'from-indigo-500 to-purple-500' },
    amber: { hex: '#f59e0b', gradient: 'from-amber-500 to-orange-500' },
    rose: { hex: '#f43f5e', gradient: 'from-rose-500 to-pink-500' },
    purple: { hex: '#a855f7', gradient: 'from-purple-500 to-violet-500' },
    cyan: { hex: '#06b6d4', gradient: 'from-cyan-500 to-blue-500' },
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
    const colorConfig = COLOR_MAP[color] || { hex: '#d75c33', gradient: 'from-[#d75c33] to-orange-500' };
    const growthPct = growth?.prev && growth.prev > 0 ? ((growth.current - growth.prev) / Math.abs(growth.prev)) * 100 : null;
    const isPositive = growthPct !== null && (invert ? growthPct < 0 : growthPct > 0);

    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 hover:border-card-border/80 transition-all group shadow-sm">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-black text-muted uppercase tracking-widest">{title}</span>
                <div className={`w-9 h-9 rounded-xl bg-gradient-to-br ${colorConfig.gradient} flex items-center justify-center shadow-lg`} style={{ boxShadow: `0 4px 14px ${colorConfig.hex}20` }}>
                    <Icon className="w-4 h-4 text-white" />
                </div>
            </div>
            <p className="text-2xl font-black tracking-tight" style={{ color: colorConfig.hex }}>{value}</p>
            {subvalue && <p className="text-xs text-muted mt-1">{subvalue}</p>}
            {growthPct !== null && Math.abs(growthPct) >= 0.1 && (
                <div className={`flex items-center gap-1 mt-2 text-[10px] font-bold ${isPositive ? 'text-emerald-400' : 'text-red-400'}`}>
                    {growthPct > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                    {Math.abs(growthPct).toFixed(1)}% vs periodo anterior
                </div>
            )}
        </div>
    );
});
