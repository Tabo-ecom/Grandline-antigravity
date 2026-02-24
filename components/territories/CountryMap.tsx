'use client';

import React, { useState, memo } from 'react';
import { MAP_DATA } from '@/lib/data/geo/svg';
import type { DepartmentMetrics } from '@/lib/calculations/geo';
import { formatCurrency } from '@/lib/utils/currency';

type MetricType = 'tasaEntrega' | 'fletePromedio' | 'tasaDevolucion';

interface CountryMapProps {
    countryCode: string;
    departments: DepartmentMetrics[];
    activeMetric: MetricType;
    selectedDepartment: string | null;
    onSelectDepartment: (code: string | null) => void;
}

function getColor(value: number, metric: MetricType): string {
    if (metric === 'tasaEntrega') {
        if (value >= 80) return '#22c55e';       // green-500
        if (value >= 60) return '#eab308';       // yellow-500
        if (value >= 40) return '#f97316';       // orange-500
        return '#ef4444';                         // red-500
    }
    if (metric === 'tasaDevolucion') {
        if (value <= 5) return '#22c55e';
        if (value <= 15) return '#eab308';
        if (value <= 25) return '#f97316';
        return '#ef4444';
    }
    // fletePromedio — lower is better, use relative scale
    if (value <= 5000) return '#22c55e';
    if (value <= 10000) return '#eab308';
    if (value <= 15000) return '#f97316';
    return '#ef4444';
}

function getMetricValue(dept: DepartmentMetrics | undefined, metric: MetricType): number {
    if (!dept) return 0;
    return dept[metric];
}

function formatMetricValue(value: number, metric: MetricType): string {
    if (metric === 'fletePromedio') return formatCurrency(value, 'COP');
    return `${value.toFixed(1)}%`;
}

const METRIC_LABELS: Record<MetricType, string> = {
    tasaEntrega: 'Tasa Entrega',
    fletePromedio: 'Flete Promedio',
    tasaDevolucion: 'Tasa Devolución',
};

function CountryMapComponent({
    countryCode,
    departments,
    activeMetric,
    selectedDepartment,
    onSelectDepartment,
}: CountryMapProps) {
    const [hoveredDept, setHoveredDept] = useState<string | null>(null);
    const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 });

    const mapData = MAP_DATA[countryCode];
    if (!mapData) {
        return <div className="text-muted text-sm p-8 text-center">Mapa no disponible para este país</div>;
    }

    const deptMetricsMap = new Map(departments.map(d => [d.code, d]));

    const hoveredMetrics = hoveredDept ? deptMetricsMap.get(hoveredDept) : null;
    const hoveredPath = hoveredDept ? mapData.paths.find(p => p.code === hoveredDept) : null;

    return (
        <div className="relative">
            <svg
                viewBox={mapData.viewBox}
                className="w-full h-auto"
                onMouseLeave={() => setHoveredDept(null)}
            >
                {mapData.paths.map(path => {
                    const metrics = deptMetricsMap.get(path.code);
                    const value = getMetricValue(metrics, activeMetric);
                    const isSelected = selectedDepartment === path.code;
                    const isHovered = hoveredDept === path.code;
                    const hasData = !!metrics && metrics.totalOrders > 0;

                    const fillColor = hasData ? getColor(value, activeMetric) : 'var(--hover-bg)';
                    const fillOpacity = hasData ? (isSelected ? 0.9 : isHovered ? 0.8 : 0.6) : 0.3;

                    return (
                        <path
                            key={path.code}
                            d={path.d}
                            fill={fillColor}
                            fillOpacity={fillOpacity}
                            stroke={isSelected ? 'var(--foreground)' : 'var(--card-border)'}
                            strokeWidth={isSelected ? 2 : 1}
                            className="cursor-pointer transition-all duration-200"
                            onClick={() => onSelectDepartment(isSelected ? null : path.code)}
                            onMouseEnter={(e) => {
                                setHoveredDept(path.code);
                                const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
                                setTooltipPos({
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top,
                                });
                            }}
                            onMouseMove={(e) => {
                                const rect = (e.target as SVGElement).closest('svg')!.getBoundingClientRect();
                                setTooltipPos({
                                    x: e.clientX - rect.left,
                                    y: e.clientY - rect.top,
                                });
                            }}
                        />
                    );
                })}
            </svg>

            {/* Tooltip */}
            {hoveredDept && hoveredPath && (
                <div
                    className="absolute pointer-events-none bg-card border border-card-border rounded-xl px-4 py-3 shadow-xl z-50 min-w-[180px]"
                    style={{
                        left: `${tooltipPos.x + 12}px`,
                        top: `${tooltipPos.y - 60}px`,
                    }}
                >
                    <p className="text-xs font-black text-foreground uppercase tracking-wider mb-2">{hoveredPath.name}</p>
                    {hoveredMetrics ? (
                        <div className="space-y-1">
                            <div className="flex justify-between text-[10px]">
                                <span className="text-muted">Órdenes</span>
                                <span className="font-mono font-bold text-foreground">{hoveredMetrics.totalOrders}</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-muted">Entregados</span>
                                <span className="font-mono font-bold text-emerald-400">{hoveredMetrics.tasaEntrega.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-muted">Devoluciones</span>
                                <span className="font-mono font-bold text-orange-400">{hoveredMetrics.tasaDevolucion.toFixed(1)}%</span>
                            </div>
                            <div className="flex justify-between text-[10px]">
                                <span className="text-muted">Flete Prom</span>
                                <span className="font-mono font-bold text-blue-400">{formatCurrency(hoveredMetrics.fletePromedio, 'COP')}</span>
                            </div>
                        </div>
                    ) : (
                        <p className="text-[10px] text-muted italic">Sin datos</p>
                    )}
                </div>
            )}

            {/* Legend */}
            <div className="flex items-center justify-center gap-6 mt-4">
                <span className="text-[9px] font-bold text-muted uppercase tracking-widest">{METRIC_LABELS[activeMetric]}:</span>
                {activeMetric === 'tasaEntrega' ? (
                    <>
                        <LegendItem color="#ef4444" label="< 40%" />
                        <LegendItem color="#f97316" label="40-60%" />
                        <LegendItem color="#eab308" label="60-80%" />
                        <LegendItem color="#22c55e" label="> 80%" />
                    </>
                ) : activeMetric === 'tasaDevolucion' ? (
                    <>
                        <LegendItem color="#22c55e" label="< 5%" />
                        <LegendItem color="#eab308" label="5-15%" />
                        <LegendItem color="#f97316" label="15-25%" />
                        <LegendItem color="#ef4444" label="> 25%" />
                    </>
                ) : (
                    <>
                        <LegendItem color="#22c55e" label="< $5K" />
                        <LegendItem color="#eab308" label="$5-10K" />
                        <LegendItem color="#f97316" label="$10-15K" />
                        <LegendItem color="#ef4444" label="> $15K" />
                    </>
                )}
            </div>
        </div>
    );
}

function LegendItem({ color, label }: { color: string; label: string }) {
    return (
        <div className="flex items-center gap-1.5">
            <div className="w-3 h-3 rounded-sm" style={{ backgroundColor: color, opacity: 0.7 }} />
            <span className="text-[9px] font-mono text-muted">{label}</span>
        </div>
    );
}

export const CountryMap = memo(CountryMapComponent);
export type { MetricType };
