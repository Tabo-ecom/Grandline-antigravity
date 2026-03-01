'use client';

import React, { useState, useEffect } from 'react';
import { Plus, Pencil, Trash2, Bell, BellOff } from 'lucide-react';
import { authFetch } from '@/lib/api/client';
import { VegaAlertRuleModal } from './VegaAlertRuleModal';
import type { VegaAlertRule } from '@/lib/types/vega';
import { VEGA_METRICS } from '@/lib/types/vega';

export const VegaAlertConfigPanel: React.FC = () => {
    const [rules, setRules] = useState<VegaAlertRule[]>([]);
    const [loading, setLoading] = useState(true);
    const [modalOpen, setModalOpen] = useState(false);
    const [editingRule, setEditingRule] = useState<VegaAlertRule | null>(null);

    const fetchRules = async () => {
        try {
            const res = await authFetch(`/api/vega/alerts`);
            const data = await res.json();
            setRules(data.rules || []);
        } catch (err) {
            console.error('Error fetching rules:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchRules(); }, []);

    const handleSave = async (rule: VegaAlertRule) => {
        try {
            await authFetch('/api/vega/alerts', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ rule }),
            });
            setModalOpen(false);
            setEditingRule(null);
            fetchRules();
        } catch (err) {
            console.error('Error saving rule:', err);
        }
    };

    const handleDelete = async (ruleId: string) => {
        try {
            await authFetch('/api/vega/alerts', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ruleId }),
            });
            fetchRules();
        } catch (err) {
            console.error('Error deleting rule:', err);
        }
    };

    const handleToggle = async (ruleId: string, enabled: boolean) => {
        try {
            await authFetch('/api/vega/alerts', {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ ruleId, enabled }),
            });
            fetchRules();
        } catch (err) {
            console.error('Error toggling rule:', err);
        }
    };

    return (
        <div>
            <div className="flex items-center justify-between mb-5">
                <p className="text-xs text-muted">Define reglas personalizadas para monitoreo automático.</p>
                <button
                    onClick={() => { setEditingRule(null); setModalOpen(true); }}
                    className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-accent/10 text-accent text-[10px] font-black uppercase tracking-widest hover:bg-accent/20 transition-all border border-accent/20"
                >
                    <Plus className="w-3.5 h-3.5" />
                    Nueva Alerta
                </button>
            </div>

            {loading ? (
                <div className="text-center py-8">
                    <p className="text-[10px] text-muted font-mono uppercase tracking-widest animate-pulse">Cargando reglas...</p>
                </div>
            ) : rules.length === 0 ? (
                <div className="text-center py-12 border border-dashed border-card-border rounded-2xl">
                    <Bell className="w-8 h-8 text-muted mx-auto mb-3" />
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">No hay alertas configuradas</p>
                    <p className="text-[10px] text-muted mt-1">Crea tu primera alerta para comenzar el monitoreo</p>
                </div>
            ) : (
                <div className="space-y-2">
                    {rules.map(rule => {
                        const metricLabel = VEGA_METRICS.find(m => m.key === rule.metric)?.label || rule.metric;
                        return (
                            <div key={rule.id} className={`flex items-center justify-between p-3.5 rounded-xl border transition-all ${rule.enabled
                                ? 'bg-card border-card-border hover:border-accent/30'
                                : 'bg-hover-bg border-card-border opacity-60'
                                }`}>
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <button
                                        onClick={() => handleToggle(rule.id, !rule.enabled)}
                                        className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-all ${rule.enabled
                                            ? 'bg-emerald-500/10 text-emerald-400'
                                            : 'bg-muted/10 text-muted'
                                            }`}
                                    >
                                        {rule.enabled ? <Bell className="w-3.5 h-3.5" /> : <BellOff className="w-3.5 h-3.5" />}
                                    </button>
                                    <div className="min-w-0">
                                        <p className="text-[11px] font-black text-foreground uppercase truncate">{rule.name}</p>
                                        <p className="text-[10px] text-muted mt-0.5">
                                            {metricLabel} &middot; {rule.frequency === 'realtime' ? 'Tiempo Real' : rule.frequency === 'daily' ? 'Diaria' : rule.frequency === 'weekly' ? 'Semanal' : 'Mensual'}
                                        </p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-3 shrink-0">
                                    <div className="flex gap-0.5">
                                        {rule.channels.map(ch => (
                                            <span key={ch} className="text-[8px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded uppercase">
                                                {ch === 'in_app' ? 'App' : ch}
                                            </span>
                                        ))}
                                    </div>
                                    <button
                                        onClick={() => { setEditingRule(rule); setModalOpen(true); }}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all"
                                    >
                                        <Pencil className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(rule.id)}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-red-400 hover:bg-red-400/5 transition-all"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {modalOpen && (
                <VegaAlertRuleModal
                    rule={editingRule}
                    onSave={handleSave}
                    onClose={() => { setModalOpen(false); setEditingRule(null); }}
                />
            )}
        </div>
    );
};
