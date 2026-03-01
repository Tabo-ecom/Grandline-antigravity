'use client';

import React, { useState, useEffect } from 'react';
import { Loader2, Clock, Globe, Calendar, BarChart3, Bell } from 'lucide-react';
import { authFetch } from '@/lib/api/client';
import type { VegaScheduleConfig } from '@/lib/types/vega';

const LATAM_TIMEZONES = [
    { value: 'America/Bogota', label: 'Colombia (UTC-5)' },
    { value: 'America/Lima', label: 'Peru (UTC-5)' },
    { value: 'America/Guayaquil', label: 'Ecuador (UTC-5)' },
    { value: 'America/Panama', label: 'Panama (UTC-5)' },
    { value: 'America/Guatemala', label: 'Guatemala (UTC-6)' },
    { value: 'America/Mexico_City', label: 'Mexico (UTC-6)' },
    { value: 'America/Santiago', label: 'Chile (UTC-3)' },
    { value: 'America/Argentina/Buenos_Aires', label: 'Argentina (UTC-3)' },
    { value: 'America/Sao_Paulo', label: 'Brasil (UTC-3)' },
    { value: 'America/Caracas', label: 'Venezuela (UTC-4)' },
    { value: 'America/New_York', label: 'US Eastern (UTC-5)' },
];

const DAYS_OF_WEEK = [
    { value: 0, label: 'Domingo' },
    { value: 1, label: 'Lunes' },
    { value: 2, label: 'Martes' },
    { value: 3, label: 'Miércoles' },
    { value: 4, label: 'Jueves' },
    { value: 5, label: 'Viernes' },
    { value: 6, label: 'Sábado' },
];

const HOURS = Array.from({ length: 24 }, (_, i) => ({
    value: i,
    label: `${i.toString().padStart(2, '0')}:00`,
}));

const DEFAULT_CONFIG: VegaScheduleConfig = {
    timezone: 'America/Bogota',
    dailyReport: { enabled: false, hour: 8 },
    weeklyReport: { enabled: false, dayOfWeek: 1, hour: 8 },
    monthlyReport: { enabled: false, daysOfMonth: [1, 15], hour: 8 },
    adPerformanceReport: { enabled: false, intervalHours: 2, startHour: 8, endHour: 22 },
    alertHours: { enabled: false, startHour: 7, endHour: 21 },
};

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (v: boolean) => void }) {
    return (
        <div
            onClick={() => onChange(!enabled)}
            className={`relative w-9 h-5 rounded-full transition-colors cursor-pointer ${enabled ? 'bg-emerald-500' : 'bg-card-border'}`}
        >
            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${enabled ? 'translate-x-4' : ''}`} />
        </div>
    );
}

export const VegaScheduleSettings: React.FC = () => {
    const [config, setConfig] = useState<VegaScheduleConfig>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        async function load() {
            try {
                const res = await authFetch('/api/vega/schedule');
                const data = await res.json();
                if (data && !data.error) setConfig({ ...DEFAULT_CONFIG, ...data });
            } catch {
                // use defaults
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            await authFetch('/api/vega/schedule', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(config),
            });
            setSaved(true);
            setTimeout(() => setSaved(false), 2000);
        } catch (err) {
            console.error('Error saving schedule:', err);
        } finally {
            setSaving(false);
        }
    };

    const toggleMonthDay = (day: number) => {
        setConfig(prev => {
            const days = prev.monthlyReport.daysOfMonth.includes(day)
                ? prev.monthlyReport.daysOfMonth.filter(d => d !== day)
                : [...prev.monthlyReport.daysOfMonth, day].sort((a, b) => a - b);
            return { ...prev, monthlyReport: { ...prev.monthlyReport, daysOfMonth: days.length > 0 ? days : [1] } };
        });
    };

    if (loading) return null;

    const selectClass = 'px-3 py-2 bg-card border border-card-border rounded-xl text-xs text-foreground outline-none focus:border-accent/30 transition-all appearance-none cursor-pointer';

    return (
        <div className="space-y-5">
            {/* Timezone */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-3.5 h-3.5 text-cyan-400" />
                        <span className="text-[10px] font-black text-cyan-400 uppercase tracking-widest">Zona Horaria</span>
                    </div>
                    <select
                        value={config.timezone}
                        onChange={(e) => setConfig(prev => ({ ...prev, timezone: e.target.value }))}
                        className={`w-full ${selectClass}`}
                    >
                        {LATAM_TIMEZONES.map(tz => (
                            <option key={tz.value} value={tz.value}>{tz.label}</option>
                        ))}
                    </select>
                </div>

                {/* Daily Report */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Clock className="w-3.5 h-3.5 text-blue-400" />
                            <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Reporte Diario</span>
                        </div>
                        <Toggle
                            enabled={config.dailyReport.enabled}
                            onChange={(v) => setConfig(prev => ({ ...prev, dailyReport: { ...prev.dailyReport, enabled: v } }))}
                        />
                    </div>
                    {config.dailyReport.enabled && (
                        <div className="flex items-center gap-3">
                            <span className="text-xs text-muted">Enviar a las</span>
                            <select
                                value={config.dailyReport.hour}
                                onChange={(e) => setConfig(prev => ({ ...prev, dailyReport: { ...prev.dailyReport, hour: parseInt(e.target.value) } }))}
                                className={selectClass}
                            >
                                {HOURS.map(h => (
                                    <option key={h.value} value={h.value}>{h.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Weekly Report */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-purple-400" />
                            <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Reporte Semanal</span>
                        </div>
                        <Toggle
                            enabled={config.weeklyReport.enabled}
                            onChange={(v) => setConfig(prev => ({ ...prev, weeklyReport: { ...prev.weeklyReport, enabled: v } }))}
                        />
                    </div>
                    {config.weeklyReport.enabled && (
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-muted">Cada</span>
                            <select
                                value={config.weeklyReport.dayOfWeek}
                                onChange={(e) => setConfig(prev => ({ ...prev, weeklyReport: { ...prev.weeklyReport, dayOfWeek: parseInt(e.target.value) } }))}
                                className={selectClass}
                            >
                                {DAYS_OF_WEEK.map(d => (
                                    <option key={d.value} value={d.value}>{d.label}</option>
                                ))}
                            </select>
                            <span className="text-xs text-muted">a las</span>
                            <select
                                value={config.weeklyReport.hour}
                                onChange={(e) => setConfig(prev => ({ ...prev, weeklyReport: { ...prev.weeklyReport, hour: parseInt(e.target.value) } }))}
                                className={selectClass}
                            >
                                {HOURS.map(h => (
                                    <option key={h.value} value={h.value}>{h.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Monthly Report */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Calendar className="w-3.5 h-3.5 text-emerald-400" />
                            <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Reporte Mensual</span>
                        </div>
                        <Toggle
                            enabled={config.monthlyReport.enabled}
                            onChange={(v) => setConfig(prev => ({ ...prev, monthlyReport: { ...prev.monthlyReport, enabled: v } }))}
                        />
                    </div>
                    {config.monthlyReport.enabled && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs text-muted">Enviar a las</span>
                                <select
                                    value={config.monthlyReport.hour}
                                    onChange={(e) => setConfig(prev => ({ ...prev, monthlyReport: { ...prev.monthlyReport, hour: parseInt(e.target.value) } }))}
                                    className={selectClass}
                                >
                                    {HOURS.map(h => (
                                        <option key={h.value} value={h.value}>{h.label}</option>
                                    ))}
                                </select>
                            </div>
                            <div>
                                <span className="text-xs text-muted block mb-2">Días del mes</span>
                                <div className="flex flex-wrap gap-1.5">
                                    {[1, 5, 10, 15, 20, 25, 28].map(day => (
                                        <button
                                            key={day}
                                            onClick={() => toggleMonthDay(day)}
                                            className={`w-8 h-8 rounded-lg text-xs font-bold transition-colors ${
                                                config.monthlyReport.daysOfMonth.includes(day)
                                                    ? 'bg-emerald-500 text-white'
                                                    : 'bg-card border border-card-border text-muted hover:border-emerald-500/30'
                                            }`}
                                        >
                                            {day}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}
                </div>

                {/* Ad Performance Report */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <BarChart3 className="w-3.5 h-3.5 text-orange-400" />
                            <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Reporte de Ads</span>
                        </div>
                        <Toggle
                            enabled={config.adPerformanceReport.enabled}
                            onChange={(v) => setConfig(prev => ({ ...prev, adPerformanceReport: { ...prev.adPerformanceReport, enabled: v } }))}
                        />
                    </div>
                    {config.adPerformanceReport.enabled && (
                        <div className="space-y-3">
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs text-muted">Cada</span>
                                <select
                                    value={config.adPerformanceReport.intervalHours}
                                    onChange={(e) => setConfig(prev => ({ ...prev, adPerformanceReport: { ...prev.adPerformanceReport, intervalHours: parseInt(e.target.value) } }))}
                                    className={selectClass}
                                >
                                    {[1, 2, 3, 4, 6].map(h => (
                                        <option key={h} value={h}>{h} hora{h > 1 ? 's' : ''}</option>
                                    ))}
                                </select>
                            </div>
                            <div className="flex items-center gap-3 flex-wrap">
                                <span className="text-xs text-muted">De</span>
                                <select
                                    value={config.adPerformanceReport.startHour}
                                    onChange={(e) => setConfig(prev => ({ ...prev, adPerformanceReport: { ...prev.adPerformanceReport, startHour: parseInt(e.target.value) } }))}
                                    className={selectClass}
                                >
                                    {HOURS.map(h => (
                                        <option key={h.value} value={h.value}>{h.label}</option>
                                    ))}
                                </select>
                                <span className="text-xs text-muted">a</span>
                                <select
                                    value={config.adPerformanceReport.endHour}
                                    onChange={(e) => setConfig(prev => ({ ...prev, adPerformanceReport: { ...prev.adPerformanceReport, endHour: parseInt(e.target.value) } }))}
                                    className={selectClass}
                                >
                                    {HOURS.map(h => (
                                        <option key={h.value} value={h.value}>{h.label}</option>
                                    ))}
                                </select>
                            </div>
                        </div>
                    )}
                </div>

                {/* Alert Hours */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                            <Bell className="w-3.5 h-3.5 text-amber-400" />
                            <span className="text-[10px] font-black text-amber-400 uppercase tracking-widest">Horario de Alertas</span>
                        </div>
                        <Toggle
                            enabled={config.alertHours.enabled}
                            onChange={(v) => setConfig(prev => ({ ...prev, alertHours: { ...prev.alertHours, enabled: v } }))}
                        />
                    </div>
                    {!config.alertHours.enabled && (
                        <p className="text-[10px] text-muted">Las alertas se enviarán en cualquier momento</p>
                    )}
                    {config.alertHours.enabled && (
                        <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs text-muted">Solo de</span>
                            <select
                                value={config.alertHours.startHour}
                                onChange={(e) => setConfig(prev => ({ ...prev, alertHours: { ...prev.alertHours, startHour: parseInt(e.target.value) } }))}
                                className={selectClass}
                            >
                                {HOURS.map(h => (
                                    <option key={h.value} value={h.value}>{h.label}</option>
                                ))}
                            </select>
                            <span className="text-xs text-muted">a</span>
                            <select
                                value={config.alertHours.endHour}
                                onChange={(e) => setConfig(prev => ({ ...prev, alertHours: { ...prev.alertHours, endHour: parseInt(e.target.value) } }))}
                                className={selectClass}
                            >
                                {HOURS.map(h => (
                                    <option key={h.value} value={h.value}>{h.label}</option>
                                ))}
                            </select>
                        </div>
                    )}
                </div>

                {/* Save */}
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-widest bg-accent hover:bg-accent/90 transition-all disabled:opacity-40"
                >
                    {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? 'Guardado' : 'Guardar Horarios'}
            </button>
        </div>
    );
};
