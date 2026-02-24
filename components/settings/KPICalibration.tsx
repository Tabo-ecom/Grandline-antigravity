'use client';

import React, { useState } from 'react';
import { Crosshair, Save, Loader2, CheckCircle2, RotateCcw } from 'lucide-react';
import { useKPITargets } from '@/lib/hooks/useKPITargets';
import type { KPITarget } from '@/lib/types/kpi-targets';
import { DEFAULT_KPI_TARGETS } from '@/lib/types/kpi-targets';
import { evaluateHealth, getHealthColor, getHealthBgClass } from '@/lib/utils/health';

export const KPICalibration: React.FC = () => {
    const { targets, loading, save } = useKPITargets();
    const [local, setLocal] = useState<KPITarget[] | null>(null);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    const current = local || targets;

    const handleChange = (key: string, field: 'good' | 'warning', value: number) => {
        const updated = current.map(t =>
            t.key === key ? { ...t, [field]: value } : t
        );
        setLocal(updated);
    };

    const handleReset = (key: string) => {
        const defaultTarget = DEFAULT_KPI_TARGETS.find(t => t.key === key);
        if (!defaultTarget) return;
        const updated = current.map(t =>
            t.key === key ? { ...defaultTarget } : t
        );
        setLocal(updated);
    };

    const handleResetAll = () => {
        setLocal([...DEFAULT_KPI_TARGETS]);
    };

    const handleSave = async () => {
        setSaving(true);
        try {
            await save(current);
            setLocal(null);
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (err) {
            console.error('Error saving KPI targets:', err);
        } finally {
            setSaving(false);
        }
    };

    const getStep = (unit: string) => {
        if (unit === 'x') return 0.1;
        if (unit === '$') return 1000;
        return 1;
    };

    const formatValue = (value: number, unit: string) => {
        if (unit === '$') return `$${value.toLocaleString('es-CO')}`;
        if (unit === '%') return `${value}%`;
        return `${value}x`;
    };

    // Generate sample values for preview (between good and bad range)
    const getSampleValues = (target: KPITarget): number[] => {
        const min = target.inverse
            ? Math.min(target.good * 0.5, target.warning * 0.5)
            : Math.min(target.warning * 0.5, target.good * 0.5);
        const max = target.inverse
            ? target.warning * 1.5
            : target.good * 1.5;
        const step = (max - min) / 4;
        return [min, min + step, min + step * 2, min + step * 3, max];
    };

    if (loading) {
        return (
            <div className="bg-card border border-card-border rounded-2xl p-8">
                <p className="text-[10px] text-muted font-mono uppercase tracking-widest animate-pulse text-center">
                    Cargando brujula...
                </p>
            </div>
        );
    }

    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            {/* Header */}
            <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-accent/10 flex items-center justify-center">
                        <Crosshair className="w-4 h-4 text-accent" />
                    </div>
                    <div>
                        <h3 className="text-xs font-bold text-foreground uppercase tracking-widest">Brujula de KPIs</h3>
                        <p className="text-[10px] text-muted mt-0.5">Calibra los umbrales para tu operacion</p>
                    </div>
                </div>
                <button
                    onClick={handleResetAll}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[9px] font-bold uppercase tracking-widest text-muted hover:text-foreground hover:bg-hover-bg border border-transparent hover:border-card-border transition-all"
                >
                    <RotateCcw className="w-3 h-3" />
                    Restaurar Todo
                </button>
            </div>

            {/* KPI Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
                {current.map(target => {
                    const sampleValues = getSampleValues(target);

                    return (
                        <div key={target.key} className="border border-card-border rounded-xl p-4 bg-hover-bg/30">
                            {/* KPI Header */}
                            <div className="flex items-center justify-between mb-3">
                                <div>
                                    <p className="text-[11px] font-bold text-foreground">{target.label}</p>
                                    <p className="text-[9px] text-muted mt-0.5">{target.description}</p>
                                </div>
                                <button
                                    onClick={() => handleReset(target.key)}
                                    className="w-6 h-6 rounded-md flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all"
                                    title="Restaurar defecto"
                                >
                                    <RotateCcw className="w-3 h-3" />
                                </button>
                            </div>

                            {/* Visual Range Bar */}
                            <div className="mb-4">
                                <div className="flex h-2 rounded-full overflow-hidden">
                                    {target.inverse ? (
                                        <>
                                            <div className="flex-1 bg-emerald-500/40" />
                                            <div className="flex-1 bg-orange-500/40" />
                                            <div className="flex-1 bg-red-500/40" />
                                        </>
                                    ) : (
                                        <>
                                            <div className="flex-1 bg-red-500/40" />
                                            <div className="flex-1 bg-orange-500/40" />
                                            <div className="flex-1 bg-emerald-500/40" />
                                        </>
                                    )}
                                </div>
                                {/* Sample values preview */}
                                <div className="flex justify-between mt-1.5">
                                    {sampleValues.map((val, i) => {
                                        const status = evaluateHealth(val, target);
                                        return (
                                            <span key={i} className={`text-[8px] font-mono ${getHealthColor(status)}`}>
                                                {formatValue(Math.round(val * 10) / 10, target.unit)}
                                            </span>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Inputs */}
                            <div className="grid grid-cols-2 gap-3">
                                <div>
                                    <label className="text-[9px] font-bold text-emerald-400 uppercase tracking-widest block mb-1">
                                        Bueno {target.inverse ? '<=' : '>='}
                                    </label>
                                    <div className="flex items-center gap-1">
                                        {target.unit === '$' && <span className="text-[10px] text-muted">$</span>}
                                        <input
                                            type="number"
                                            value={target.good}
                                            onChange={(e) => handleChange(target.key, 'good', parseFloat(e.target.value) || 0)}
                                            step={getStep(target.unit)}
                                            className="w-full bg-hover-bg border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-emerald-500/40 transition-colors"
                                        />
                                        {target.unit !== '$' && <span className="text-[10px] text-muted">{target.unit}</span>}
                                    </div>
                                </div>
                                <div>
                                    <label className="text-[9px] font-bold text-red-400 uppercase tracking-widest block mb-1">
                                        Alerta {target.inverse ? '>=' : '<='}
                                    </label>
                                    <div className="flex items-center gap-1">
                                        {target.unit === '$' && <span className="text-[10px] text-muted">$</span>}
                                        <input
                                            type="number"
                                            value={target.warning}
                                            onChange={(e) => handleChange(target.key, 'warning', parseFloat(e.target.value) || 0)}
                                            step={getStep(target.unit)}
                                            className="w-full bg-hover-bg border border-card-border rounded-lg px-2.5 py-1.5 text-xs text-foreground outline-none focus:border-red-500/40 transition-colors"
                                        />
                                        {target.unit !== '$' && <span className="text-[10px] text-muted">{target.unit}</span>}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>

            {/* Save Button */}
            <div className="flex items-center justify-end gap-3">
                {success && (
                    <div className="flex items-center gap-1.5 text-emerald-400">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        <span className="text-[10px] font-bold uppercase tracking-widest">Guardado</span>
                    </div>
                )}
                <button
                    onClick={handleSave}
                    disabled={saving || !local}
                    className="flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-bold text-white bg-accent hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                    Guardar Brujula
                </button>
            </div>
        </div>
    );
};
