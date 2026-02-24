'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
    FileText, ChevronDown, ChevronUp, Loader2, Calendar,
    ChevronLeft, ChevronRight
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { buildDataContext } from '@/lib/services/vega/context-builder';
import { useKPITargets } from '@/lib/hooks/useKPITargets';
import { PDFExportButton } from '@/components/common/PDFExportButton';
import { VegaReportRenderer } from './VegaReportRenderer';
import type { PDFReportData } from '@/lib/services/pdf/types';
import type { VegaReport, ReportType } from '@/lib/types/vega';
import {
    format, addMonths, subMonths, startOfMonth, endOfMonth,
    startOfWeek, endOfWeek, isSameMonth, isSameDay, addDays,
    isWithinInterval, parseISO, subDays
} from 'date-fns';
import { es } from 'date-fns/locale';

const DATE_PRESETS = [
    { label: 'Hoy', getRange: () => { const d = new Date(); return { start: d, end: d }; } },
    { label: 'Ayer', getRange: () => { const d = subDays(new Date(), 1); return { start: d, end: d }; } },
    { label: '7 dias', getRange: () => ({ start: subDays(new Date(), 7), end: subDays(new Date(), 1) }) },
    { label: 'Este mes', getRange: () => ({ start: startOfMonth(new Date()), end: subDays(new Date(), 1) }) },
    { label: 'Mes anterior', getRange: () => { const prev = subMonths(new Date(), 1); return { start: startOfMonth(prev), end: endOfMonth(prev) }; } },
];

export const VegaRecentReports: React.FC = () => {
    const { effectiveUid } = useAuth();
    const dashData = useDashboardData();
    const { targets: kpiTargets } = useKPITargets();
    const [reports, setReports] = useState<VegaReport[]>([]);
    const [loading, setLoading] = useState(true);
    const [generating, setGenerating] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    // Date picker state
    const [showDatePicker, setShowDatePicker] = useState(false);
    const [reportStartDate, setReportStartDate] = useState<string>(format(subDays(new Date(), 7), 'yyyy-MM-dd'));
    const [reportEndDate, setReportEndDate] = useState<string>(format(subDays(new Date(), 1), 'yyyy-MM-dd'));
    const [viewDate, setViewDate] = useState(new Date());
    const [selectingEnd, setSelectingEnd] = useState(false);
    const calendarRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setShowDatePicker(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const fetchReports = async () => {
        try {
            const res = await authFetch(`/api/vega/reports`);
            const data = await res.json();
            setReports(data.reports || []);
        } catch (err) {
            console.error('Error fetching reports:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchReports(); }, []);

    const handleDateSelect = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');
        if (!selectingEnd) {
            setReportStartDate(dateStr);
            setReportEndDate('');
            setSelectingEnd(true);
        } else {
            const start = parseISO(reportStartDate);
            if (date < start) {
                setReportEndDate(reportStartDate);
                setReportStartDate(dateStr);
            } else {
                setReportEndDate(dateStr);
            }
            setSelectingEnd(false);
        }
    };

    const handlePreset = (preset: typeof DATE_PRESETS[0]) => {
        const range = preset.getRange();
        setReportStartDate(format(range.start, 'yyyy-MM-dd'));
        setReportEndDate(format(range.end, 'yyyy-MM-dd'));
        setSelectingEnd(false);
        setShowDatePicker(false);
    };

    const getDateLabel = () => {
        if (!reportStartDate) return 'Seleccionar fecha';
        const start = format(parseISO(reportStartDate), 'd MMM', { locale: es });
        if (!reportEndDate || reportStartDate === reportEndDate) return start;
        const end = format(parseISO(reportEndDate), 'd MMM yyyy', { locale: es });
        return `${start} - ${end}`;
    };

    const handleGenerate = async (type: ReportType) => {
        setGenerating(true);
        try {
            let berryExpenses: { category: string; amount: number }[] = [];
            let berryExpenseTotal = 0;
            try {
                const { getExpenses, totalByCategory } = await import('@/lib/services/expenses');
                const expenses = await getExpenses(effectiveUid || '');
                const now = new Date();
                const monthExp = expenses.filter((e: any) => e.month === (now.getMonth() + 1) && e.year === now.getFullYear());
                const byCategory = totalByCategory(monthExp);
                berryExpenses = Object.entries(byCategory).map(([category, amount]) => ({ category, amount }));
                berryExpenseTotal = berryExpenses.reduce((s, e) => s + e.amount, 0);
            } catch { /* Berry expenses optional */ }

            const startLabel = reportStartDate ? format(parseISO(reportStartDate), 'd MMM yyyy', { locale: es }) : '';
            const endLabel = reportEndDate ? format(parseISO(reportEndDate), 'd MMM yyyy', { locale: es }) : startLabel;
            const periodLabel = startLabel === endLabel ? startLabel : `${startLabel} - ${endLabel}`;

            const campaignNames = [...new Set(dashData.filteredAds.map(h => h.campaignName).filter((n): n is string => !!n))];

            const dataContext = buildDataContext({
                kpis: dashData.kpis,
                prevKpis: dashData.prevKpis,
                orderCount: dashData.filteredOrders.length,
                countries: dashData.availableCountries,
                adPlatformMetrics: dashData.adPlatformMetrics,
                projectedProfit: dashData.projectedProfit,
                metricsByCountry: dashData.metricsByCountry,
                dateRange: periodLabel,
                dailySalesData: dashData.dailySalesData,
                filteredOrders: dashData.filteredOrders,
                availableProducts: dashData.availableProducts,
                filteredAds: dashData.filteredAds,
                logisticStats: dashData.logisticStats,
                berryExpenses,
                berryExpenseTotal,
                campaignNames,
            });

            const res = await authFetch('/api/vega/reports', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    type,
                    dataContext,
                    period: periodLabel,
                    kpiTargets,
                }),
            });
            const data = await res.json();
            if (data.report) {
                setReports(prev => [data.report, ...prev]);
                setExpandedId(data.report.id);
            }
        } catch (err) {
            console.error('Error generating report:', err);
        } finally {
            setGenerating(false);
        }
    };

    const typeBadge = (type: string) => {
        const colors: Record<string, string> = {
            daily: 'text-blue-400 bg-blue-500/10',
            weekly: 'text-purple-400 bg-purple-500/10',
            monthly: 'text-emerald-400 bg-emerald-500/10',
            audit: 'text-orange-400 bg-orange-500/10',
            custom: 'text-muted bg-muted/10',
        };
        return colors[type] || colors.custom;
    };

    const renderCalendar = () => {
        const monthStart = startOfMonth(viewDate);
        const monthEnd = endOfMonth(monthStart);
        const calStart = startOfWeek(monthStart);
        const calEnd = endOfWeek(monthEnd);

        const rows: React.ReactNode[] = [];
        let days: React.ReactNode[] = [];
        let day = calStart;

        while (day <= calEnd) {
            for (let i = 0; i < 7; i++) {
                const currentDay = new Date(day);
                const isSelected = (reportStartDate && isSameDay(currentDay, parseISO(reportStartDate))) ||
                    (reportEndDate && isSameDay(currentDay, parseISO(reportEndDate)));

                const isInRange = reportStartDate && reportEndDate &&
                    isWithinInterval(currentDay, {
                        start: parseISO(reportStartDate),
                        end: parseISO(reportEndDate),
                    });

                const isToday = isSameDay(currentDay, new Date());
                const isCurrentMonth = isSameMonth(currentDay, monthStart);

                days.push(
                    <div
                        key={day.toISOString()}
                        onClick={() => handleDateSelect(currentDay)}
                        className={`
                            relative h-8 w-8 flex items-center justify-center text-[10px] font-bold cursor-pointer rounded-lg transition-all
                            ${!isCurrentMonth ? 'text-gray-700 opacity-20' : 'text-gray-300'}
                            ${isSelected ? 'bg-accent text-white shadow-lg shadow-accent/40 z-10' : 'hover:bg-white/5'}
                            ${isInRange && !isSelected ? 'bg-accent/10 text-accent' : ''}
                            ${isToday && !isSelected ? 'border border-accent/30' : ''}
                        `}
                    >
                        {format(currentDay, 'd')}
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div key={day.toISOString()} className="grid grid-cols-7 gap-0.5">
                    {days}
                </div>
            );
            days = [];
        }

        return rows;
    };

    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            {/* Header */}
            <div className="flex flex-col gap-4 mb-5">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Reportes</h3>
                        <p className="text-xs text-muted mt-1">Genera y consulta reportes con analisis visual.</p>
                    </div>
                </div>

                {/* Date Picker + Generate Buttons */}
                <div className="flex flex-wrap items-center gap-2">
                    <div className="relative" ref={calendarRef}>
                        <button
                            onClick={() => setShowDatePicker(!showDatePicker)}
                            className="flex items-center gap-2 px-3 py-2 rounded-xl text-[10px] font-bold text-muted bg-hover-bg border border-card-border hover:border-accent/30 hover:text-foreground transition-all"
                        >
                            <Calendar className="w-3.5 h-3.5" />
                            <span className="uppercase tracking-widest">{getDateLabel()}</span>
                            <ChevronDown className="w-3 h-3" />
                        </button>

                        {showDatePicker && (
                            <div className="absolute top-full mt-2 left-0 z-50 bg-[#0d1117] border border-card-border rounded-2xl shadow-2xl shadow-black/60 w-[280px]">
                                <div className="flex flex-wrap gap-1 p-3 border-b border-card-border">
                                    {DATE_PRESETS.map(preset => (
                                        <button
                                            key={preset.label}
                                            onClick={() => handlePreset(preset)}
                                            className="px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted hover:text-foreground hover:bg-accent/10 transition-all"
                                        >
                                            {preset.label}
                                        </button>
                                    ))}
                                </div>
                                <div className="p-3 space-y-2">
                                    <div className="flex items-center justify-between px-1">
                                        <h4 className="text-[10px] font-black text-white uppercase tracking-widest">
                                            {format(viewDate, 'MMMM yyyy', { locale: es })}
                                        </h4>
                                        <div className="flex gap-0.5">
                                            <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                                                <ChevronLeft className="w-3.5 h-3.5" />
                                            </button>
                                            <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                                                <ChevronRight className="w-3.5 h-3.5" />
                                            </button>
                                        </div>
                                    </div>
                                    <div className="grid grid-cols-7 gap-0.5">
                                        {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                                            <div key={i} className="h-6 w-8 flex items-center justify-center text-[8px] font-black text-gray-600 uppercase">
                                                {d}
                                            </div>
                                        ))}
                                    </div>
                                    <div className="space-y-0.5">
                                        {renderCalendar()}
                                    </div>
                                </div>
                                <div className="px-3 pb-3 text-center">
                                    <p className="text-[8px] text-muted uppercase tracking-widest">
                                        {selectingEnd ? 'Selecciona fecha final' : 'Selecciona fecha inicial'}
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="flex gap-1.5 ml-auto">
                        {(['daily', 'weekly', 'monthly'] as ReportType[]).map(type => (
                            <button
                                key={type}
                                onClick={() => handleGenerate(type)}
                                disabled={generating}
                                className="px-3 py-2 rounded-xl text-[9px] font-bold uppercase tracking-widest text-muted bg-hover-bg border border-card-border hover:border-accent/30 hover:text-foreground transition-all disabled:opacity-40"
                            >
                                {generating ? <Loader2 className="w-3 h-3 animate-spin" /> : type === 'daily' ? 'Diario' : type === 'weekly' ? 'Semanal' : 'Mensual'}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Reports List */}
            {loading ? (
                <div className="text-center py-8">
                    <p className="text-[10px] text-muted font-mono uppercase tracking-widest animate-pulse">Cargando reportes...</p>
                </div>
            ) : reports.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-card-border rounded-2xl">
                    <FileText className="w-8 h-8 text-muted mx-auto mb-3" />
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">No hay reportes generados</p>
                    <p className="text-[10px] text-muted mt-1">Selecciona una fecha y genera tu primer reporte</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[700px] overflow-y-auto">
                    {reports.slice(0, 15).map(report => (
                        <div key={report.id} className="border border-card-border rounded-xl overflow-hidden">
                            <button
                                onClick={() => setExpandedId(expandedId === report.id ? null : report.id)}
                                className="w-full flex items-center justify-between p-3.5 hover:bg-hover-bg transition-all"
                            >
                                <div className="flex items-center gap-3">
                                    <FileText className="w-4 h-4 text-muted shrink-0" />
                                    <div className="text-left">
                                        <p className="text-[11px] font-black text-foreground uppercase truncate">{report.title}</p>
                                        <p className="text-[9px] text-muted font-mono mt-0.5">
                                            {new Date(report.generatedAt).toLocaleString('es-CO')} &middot; {report.period}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                    <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${typeBadge(report.type)}`}>
                                        {report.type}
                                    </span>
                                    {expandedId === report.id ? <ChevronUp className="w-3.5 h-3.5 text-muted" /> : <ChevronDown className="w-3.5 h-3.5 text-muted" />}
                                </div>
                            </button>
                            {expandedId === report.id && (
                                <div className="px-4 pb-4 pt-1 border-t border-card-border">
                                    <div className="flex justify-end mb-3">
                                        <PDFExportButton
                                            compact
                                            label="Exportar PDF"
                                            getData={() => ({
                                                title: report.title,
                                                period: report.period,
                                                generatedAt: report.generatedAt,
                                                kpis: dashData.kpis,
                                                kpiTargets,
                                                metricsByCountry: dashData.metricsByCountry,
                                                logisticStats: dashData.logisticStats,
                                                vegaAnalysis: report.content,
                                            } as PDFReportData)}
                                        />
                                    </div>
                                    <VegaReportRenderer content={report.content} />
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
