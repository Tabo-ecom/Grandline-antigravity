import React from 'react';
import { formatCurrency } from '@/lib/utils/currency';

interface PlatformBarProps {
    platform: string;
    value: number;
    total: number;
    color: string;
}

export default React.memo(function PlatformBar({ platform, value, total, color }: PlatformBarProps) {
    const pct = total > 0 ? (value / total) * 100 : 0;
    return (
        <div>
            <div className="flex justify-between text-sm mb-2">
                <span className="text-foreground/80 font-medium">{platform}</span>
                <div className="flex items-center gap-3">
                    <span className="text-muted font-mono text-xs">{formatCurrency(value)}</span>
                    <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">{pct.toFixed(1)}%</span>
                </div>
            </div>
            <div className="h-2 bg-card-border rounded-full overflow-hidden">
                <div style={{ width: `${pct}%` }} className={`h-full bg-gradient-to-r ${color} rounded-full`} />
            </div>
        </div>
    );
});
