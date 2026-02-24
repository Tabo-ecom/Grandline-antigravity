'use client';

import React, { useState, useEffect } from 'react';
import { AlertTriangle, AlertCircle, Info, Check } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { useVega } from '@/lib/context/VegaContext';
import type { VegaTriggeredAlert } from '@/lib/types/vega';
import { getTriggeredAlerts, acknowledgeAlert } from '@/lib/services/vega/alerts';

export const VegaActiveAlerts: React.FC = () => {
    const { effectiveUid } = useAuth();
    const { setUnacknowledgedCount } = useVega();
    const [alerts, setAlerts] = useState<VegaTriggeredAlert[]>([]);
    const [loading, setLoading] = useState(true);
    const [filter, setFilter] = useState<'all' | 'critical' | 'warning' | 'info'>('all');

    const fetchAlerts = async () => {
        try {
            const data = await getTriggeredAlerts(effectiveUid || '');
            setAlerts(data);
            setUnacknowledgedCount(data.filter(a => !a.acknowledged).length);
        } catch (err) {
            console.error('Error fetching alerts:', err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => { fetchAlerts(); }, []);

    const handleAcknowledge = async (alertId: string) => {
        try {
            await acknowledgeAlert(alertId, effectiveUid || '');
            fetchAlerts();
        } catch (err) {
            console.error('Error acknowledging alert:', err);
        }
    };

    const filtered = filter === 'all' ? alerts : alerts.filter(a => a.severity === filter);

    const severityConfig = {
        critical: { icon: AlertTriangle, color: 'text-red-400', bg: 'bg-red-500/10', border: 'border-red-500/20' },
        warning: { icon: AlertCircle, color: 'text-orange-400', bg: 'bg-orange-500/10', border: 'border-orange-500/20' },
        info: { icon: Info, color: 'text-blue-400', bg: 'bg-blue-500/10', border: 'border-blue-500/20' },
    };

    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
            <div className="flex items-center justify-between mb-5">
                <div>
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Alertas Activas</h3>
                    <p className="text-xs text-muted mt-1">
                        {alerts.filter(a => !a.acknowledged).length} sin reconocer de {alerts.length} total
                    </p>
                </div>
                <div className="flex gap-1">
                    {(['all', 'critical', 'warning', 'info'] as const).map(f => (
                        <button
                            key={f}
                            onClick={() => setFilter(f)}
                            className={`px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest transition-all border ${filter === f
                                ? 'bg-accent/10 text-accent border-accent/20'
                                : 'text-muted border-transparent hover:bg-hover-bg'
                                }`}
                        >
                            {f === 'all' ? 'Todas' : f === 'critical' ? 'Críticas' : f === 'warning' ? 'Alerta' : 'Info'}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="text-center py-8">
                    <p className="text-[10px] text-muted font-mono uppercase tracking-widest animate-pulse">Cargando alertas...</p>
                </div>
            ) : filtered.length === 0 ? (
                <div className="text-center py-8 border border-dashed border-card-border rounded-2xl">
                    <Check className="w-8 h-8 text-emerald-400 mx-auto mb-2" />
                    <p className="text-[10px] font-black text-muted uppercase tracking-widest">Todo en orden</p>
                    <p className="text-[10px] text-muted mt-1">No hay alertas activas</p>
                </div>
            ) : (
                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                    {filtered.slice(0, 20).map(alert => {
                        const cfg = severityConfig[alert.severity];
                        const Icon = cfg.icon;
                        return (
                            <div key={alert.id} className={`flex items-start gap-3 p-3.5 rounded-xl border transition-all ${alert.acknowledged ? 'opacity-50' : ''} ${cfg.bg} ${cfg.border}`}>
                                <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${cfg.bg}`}>
                                    <Icon className={`w-3.5 h-3.5 ${cfg.color}`} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-black text-foreground">{alert.ruleName}</p>
                                    <p className="text-[10px] text-muted mt-0.5">{alert.message}</p>
                                    <p className="text-[9px] text-muted font-mono mt-1">
                                        {new Date(alert.timestamp).toLocaleString('es-CO')}
                                    </p>
                                </div>
                                {!alert.acknowledged && (
                                    <button
                                        onClick={() => handleAcknowledge(alert.id)}
                                        className="shrink-0 px-2.5 py-1 rounded-lg text-[9px] font-bold uppercase tracking-widest text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 hover:bg-emerald-500/20 transition-all"
                                    >
                                        ACK
                                    </button>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};
