'use client';

import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import type { VegaAlertRule, AlertCondition, AlertFrequency, NotificationChannel } from '@/lib/types/vega';
import { VEGA_METRICS, ALERT_CONDITIONS } from '@/lib/types/vega';

interface VegaAlertRuleModalProps {
    rule?: VegaAlertRule | null;
    onSave: (rule: VegaAlertRule) => void;
    onClose: () => void;
}

export const VegaAlertRuleModal: React.FC<VegaAlertRuleModalProps> = ({ rule, onSave, onClose }) => {
    const [name, setName] = useState(rule?.name || '');
    const [metric, setMetric] = useState(rule?.metric || VEGA_METRICS[0].key);
    const [condition, setCondition] = useState<AlertCondition>(rule?.condition || 'less_than');
    const [threshold, setThreshold] = useState(rule?.threshold || 0);
    const [frequency, setFrequency] = useState<AlertFrequency>(rule?.frequency || 'realtime');
    const [channels, setChannels] = useState<NotificationChannel[]>(rule?.channels || ['in_app']);

    const toggleChannel = (ch: NotificationChannel) => {
        setChannels(prev => prev.includes(ch) ? prev.filter(c => c !== ch) : [...prev, ch]);
    };

    const handleSave = () => {
        if (!name.trim()) return;
        onSave({
            id: rule?.id || `rule_${Date.now()}`,
            name: name.trim(),
            metric,
            condition,
            threshold,
            frequency,
            channels,
            enabled: rule?.enabled ?? true,
            createdAt: rule?.createdAt || Date.now(),
            updatedAt: Date.now(),
        });
    };

    const selectedMetric = VEGA_METRICS.find(m => m.key === metric);

    // Build preview text
    const condLabel = ALERT_CONDITIONS.find(c => c.key === condition)?.label || condition;
    const preview = `Si ${selectedMetric?.label || metric} es ${condLabel.toLowerCase()} ${threshold}${selectedMetric?.unit || ''}`;

    return (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[70] flex items-center justify-center p-4">
            <div className="bg-card border border-card-border rounded-2xl w-full max-w-lg shadow-2xl">
                {/* Header */}
                <div className="flex items-center justify-between px-5 py-4 border-b border-card-border">
                    <h3 className="text-[11px] font-black text-foreground uppercase tracking-widest">
                        {rule ? 'Editar Alerta' : 'Nueva Alerta'}
                    </h3>
                    <button onClick={onClose} className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>

                <div className="p-5 space-y-5">
                    {/* Name */}
                    <div>
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Nombre de la Alerta</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Ej: ROAS bajo nivel crítico"
                            className="w-full px-3 py-2.5 bg-hover-bg border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted outline-none focus:border-accent/30 transition-all"
                        />
                    </div>

                    {/* Metric + Condition */}
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Métrica</label>
                            <select
                                value={metric}
                                onChange={(e) => setMetric(e.target.value)}
                                className="w-full px-3 py-2.5 bg-hover-bg border border-card-border rounded-xl text-xs text-foreground outline-none focus:border-accent/30 transition-all"
                            >
                                {VEGA_METRICS.map(m => (
                                    <option key={m.key} value={m.key}>{m.label} ({m.unit})</option>
                                ))}
                            </select>
                        </div>
                        <div>
                            <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Condición</label>
                            <select
                                value={condition}
                                onChange={(e) => setCondition(e.target.value as AlertCondition)}
                                className="w-full px-3 py-2.5 bg-hover-bg border border-card-border rounded-xl text-xs text-foreground outline-none focus:border-accent/30 transition-all"
                            >
                                {ALERT_CONDITIONS.map(c => (
                                    <option key={c.key} value={c.key}>{c.label}</option>
                                ))}
                            </select>
                        </div>
                    </div>

                    {/* Threshold */}
                    <div>
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Umbral ({selectedMetric?.unit})</label>
                        <input
                            type="number"
                            value={threshold}
                            onChange={(e) => setThreshold(Number(e.target.value))}
                            step="0.01"
                            className="w-full px-3 py-2.5 bg-hover-bg border border-card-border rounded-xl text-xs text-foreground outline-none focus:border-accent/30 transition-all"
                        />
                    </div>

                    {/* Frequency */}
                    <div>
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Frecuencia</label>
                        <div className="flex gap-2">
                            {(['realtime', 'daily', 'weekly', 'monthly'] as AlertFrequency[]).map(f => (
                                <button
                                    key={f}
                                    onClick={() => setFrequency(f)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${frequency === f
                                        ? 'bg-accent/10 text-accent border-accent/20'
                                        : 'bg-hover-bg text-muted border-card-border hover:border-accent/20'
                                        }`}
                                >
                                    {f === 'realtime' ? 'Tiempo Real' : f === 'daily' ? 'Diaria' : f === 'weekly' ? 'Semanal' : 'Mensual'}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Channels */}
                    <div>
                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-2 block">Canales de Notificación</label>
                        <div className="flex gap-2">
                            {([
                                { key: 'in_app' as NotificationChannel, label: 'En App' },
                                { key: 'telegram' as NotificationChannel, label: 'Telegram' },
                                { key: 'slack' as NotificationChannel, label: 'Slack' },
                            ]).map(ch => (
                                <button
                                    key={ch.key}
                                    onClick={() => toggleChannel(ch.key)}
                                    className={`px-3 py-1.5 rounded-xl text-[10px] font-bold uppercase tracking-widest transition-all border ${channels.includes(ch.key)
                                        ? 'bg-purple-500/10 text-purple-400 border-purple-500/20'
                                        : 'bg-hover-bg text-muted border-card-border hover:border-purple-500/20'
                                        }`}
                                >
                                    {ch.label}
                                </button>
                            ))}
                        </div>
                    </div>

                    {/* Preview */}
                    <div className="bg-hover-bg border border-card-border rounded-xl p-3">
                        <p className="text-[9px] font-black text-muted uppercase tracking-widest mb-1">Vista Previa</p>
                        <p className="text-xs text-foreground">{preview}</p>
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-end gap-3 px-5 py-4 border-t border-card-border">
                    <button
                        onClick={onClose}
                        className="px-4 py-2 rounded-xl text-[10px] font-black text-muted uppercase tracking-widest hover:bg-hover-bg transition-all border border-card-border"
                    >
                        Cancelar
                    </button>
                    <button
                        onClick={handleSave}
                        disabled={!name.trim()}
                        className="px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-widest bg-accent hover:bg-accent/90 transition-all disabled:opacity-40"
                    >
                        {rule ? 'Guardar Cambios' : 'Crear Alerta'}
                    </button>
                </div>
            </div>
        </div>
    );
};
