import React from 'react';

const COLORS = {
    good: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20',
    warning: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    bad: 'bg-red-500/10 text-red-400 border-red-500/20',
};

const DOT_COLORS = {
    good: 'bg-emerald-500',
    warning: 'bg-amber-500',
    bad: 'bg-red-500',
};

interface HealthBadgeProps {
    label: string;
    value: string;
    status: 'good' | 'warning' | 'bad';
}

export default React.memo(function HealthBadge({ label, value, status }: HealthBadgeProps) {
    return (
        <div className={`flex items-center gap-2 px-3 py-1.5 rounded-lg border text-xs font-bold ${COLORS[status]}`}>
            <div className={`w-2 h-2 rounded-full ${DOT_COLORS[status]} ${status === 'bad' ? 'animate-pulse' : ''}`} />
            <span className="text-muted font-normal">{label}:</span>
            <span className="font-mono">{value}</span>
        </div>
    );
});
