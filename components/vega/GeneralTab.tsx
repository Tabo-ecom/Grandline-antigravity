'use client';

import React, { useState, useEffect } from 'react';
import { Cpu, Loader2, Play, Pause, Clock, Repeat, FileText } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import {
    VegaTemplate,
    VEGA_AGENTS, DEFAULT_TEMPLATES,
    getVegaTemplates, saveVegaTemplates,
    getAgent,
} from '@/lib/services/vega';

function AgentCard({ agent }: { agent: typeof VEGA_AGENTS[number] }) {
    return (
        <div className="bg-card border border-card-border rounded-2xl p-5 hover:border-accent/20 transition-all">
            <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center text-sm font-bold text-white"
                    style={{ background: `linear-gradient(135deg, ${agent.color}, ${agent.color}99)` }}>
                    {agent.initials}
                </div>
                <div>
                    <h4 className="text-sm font-bold">{agent.name}</h4>
                    <p className="text-[10px] text-muted uppercase tracking-wider">{agent.role}</p>
                </div>
            </div>
            <p className="text-xs text-muted leading-relaxed">Agente especializado en {agent.role.toLowerCase()}</p>
        </div>
    );
}

export default function GeneralTab() {
    const { effectiveUid } = useAuth();
    const [templates, setTemplates] = useState<VegaTemplate[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!effectiveUid) return;
        (async () => {
            const tpl = await getVegaTemplates(effectiveUid);
            setTemplates(tpl.length > 0 ? tpl : DEFAULT_TEMPLATES);
            setLoading(false);
        })();
    }, [effectiveUid]);

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 text-accent animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* Agents Grid */}
            <div>
                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Cpu className="w-4 h-4" />
                    Satelites Activos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {VEGA_AGENTS.map(agent => (
                        <AgentCard key={agent.id} agent={agent} />
                    ))}
                </div>
            </div>

            {/* Templates */}
            <div>
                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <FileText className="w-4 h-4" />
                    Templates de Flujos
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                    {templates.map(tpl => (
                        <div key={tpl.id} className="bg-card border border-card-border rounded-xl p-4 hover:border-accent/20 transition-all">
                            <h4 className="text-sm font-bold mb-1">{tpl.name}</h4>
                            <p className="text-[10px] text-muted mb-2">{tpl.description || 'Template de flujo de trabajo'}</p>
                            <div className="flex items-center gap-2">
                                <span className="text-[9px] font-bold px-2 py-0.5 rounded bg-accent/10 text-accent border border-accent/15 uppercase">
                                    {tpl.steps?.length || 0} pasos
                                </span>
                            </div>
                        </div>
                    ))}
                </div>
            </div>

            {/* Recurring Tasks Info */}
            <div>
                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-2">
                    <Repeat className="w-4 h-4" />
                    Tareas Recurrentes
                </h3>
                <div className="bg-card border border-card-border rounded-2xl p-6 text-center">
                    <Clock className="w-8 h-8 text-muted/30 mx-auto mb-2" />
                    <p className="text-sm text-muted">Las tareas recurrentes se configuran desde el modulo de Tareas.</p>
                    <p className="text-[10px] text-muted/60 mt-1">Los agentes ejecutan automaticamente las tareas programadas.</p>
                </div>
            </div>
        </div>
    );
}
