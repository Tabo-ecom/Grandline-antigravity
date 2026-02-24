import React from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { ResponsiveContainer, PieChart, Pie, Cell, Tooltip as ReTooltip } from 'recharts';

interface ProductSpendProps {
    data: any[];
    tableData: any[];
}

export const ProductSpend: React.FC<ProductSpendProps> = ({ data, tableData }) => {
    const COLORS = ['#ea580c', '#3b82f6', '#10b981', '#8b5cf6', '#f59e0b', '#ec4899'];
    const totalSpend = tableData.reduce((sum, row) => sum + (row.spend || 0), 0);

    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 h-full flex flex-col shadow-sm">
            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-4">Gasto por Producto</h3>

            <div className="flex-1 min-h-[300px]">
                <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                        <Pie
                            data={data}
                            innerRadius={60}
                            outerRadius={80}
                            paddingAngle={5}
                            dataKey="value"
                        >
                            {data.map((_, index) => (
                                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} stroke="none" />
                            ))}
                        </Pie>
                        <ReTooltip
                            contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}
                            itemStyle={{ color: 'var(--foreground)' }}
                            formatter={(val: any) => formatCurrency(Number(val || 0))}
                        />
                    </PieChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-4 space-y-2">
                {tableData.slice(0, 5).map((row, idx) => {
                    // Extract name without ID if formatted as "ID - Name"
                    const cleanName = row.productName.includes(' - ') ? row.productName.split(' - ').slice(1).join(' - ') : row.productName;
                    return (
                        <div key={idx} className="flex justify-between items-center text-[11px]">
                            <span className="text-muted uppercase truncate w-32 font-bold">{cleanName}</span>
                            <div className="flex items-center gap-2">
                                {totalSpend > 0 && (
                                    <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">
                                        {((row.spend / totalSpend) * 100).toFixed(1)}%
                                    </span>
                                )}
                                <span className="text-foreground font-mono">{formatCurrency(row.spend)}</span>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};
