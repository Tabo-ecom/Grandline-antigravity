'use client';

import React, { useState, useRef, useEffect } from 'react';
import { X, Maximize2, Minimize2, Send, Trash2, Bot, Sparkles } from 'lucide-react';
import { useVega } from '@/lib/context/VegaContext';
import { VegaChatMessage } from './VegaChatMessage';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { buildDataContext } from '@/lib/services/vega/context-builder';
import { getExpenses, totalByCategory } from '@/lib/services/expenses';
import { useAuth } from '@/lib/context/AuthContext';
import { useKPITargets } from '@/lib/hooks/useKPITargets';

const QUICK_ACTIONS = [
    { label: 'Resumen del día', prompt: '¿Cómo va la operación hoy? Dame un resumen ejecutivo.' },
    { label: 'Auditar gastos', prompt: 'Audita el gasto publicitario actual y dime si estamos siendo eficientes.' },
    { label: 'ROAS por país', prompt: 'Analiza el ROAS por cada país y dime cuáles están rindiendo mejor.' },
    { label: 'Oportunidades', prompt: '¿Qué oportunidades de mejora detectas en la operación actual?' },
];

export const VegaChatPanel: React.FC = () => {
    const { chatOpen, setChatOpen, expanded, setExpanded, messages, sendMessage, chatLoading, clearChat } = useVega();
    const { effectiveUid } = useAuth();
    const { targets: kpiTargets } = useKPITargets();
    const [input, setInput] = useState('');

    const messagesEndRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const dashData = useDashboardData();
    const [berryExpenses, setBerryExpenses] = useState<{ category: string; amount: number }[]>([]);
    const [berryTotal, setBerryTotal] = useState(0);

    useEffect(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages]);

    useEffect(() => {
        if (chatOpen) inputRef.current?.focus();
    }, [chatOpen]);

    // Load Berry expenses
    useEffect(() => {
        async function loadBerry() {
            try {
                const expenses = await getExpenses(effectiveUid || '');
                const now = new Date();
                const monthExpenses = expenses.filter(e => e.month === (now.getMonth() + 1) && e.year === now.getFullYear());
                const byCategory = totalByCategory(monthExpenses);
                const entries = Object.entries(byCategory).map(([category, amount]) => ({ category, amount }));
                setBerryExpenses(entries);
                setBerryTotal(entries.reduce((s, e) => s + e.amount, 0));
            } catch (err) {
                console.error('Error loading Berry expenses for Vega:', err);
            }
        }
        loadBerry();
    }, []);

    if (!chatOpen) return null;

    // Extract unique campaign names from filtered ads
    const campaignNames = [...new Set(dashData.filteredAds.map(h => h.campaignName).filter((n): n is string => !!n))];

    const dataContext = buildDataContext({
        kpis: dashData.kpis,
        prevKpis: dashData.prevKpis,
        orderCount: dashData.filteredOrders.length,
        countries: dashData.availableCountries,
        adPlatformMetrics: dashData.adPlatformMetrics,
        projectedProfit: dashData.projectedProfit,
        metricsByCountry: dashData.metricsByCountry,
        dateRange: dashData.dateRange,
        dailySalesData: dashData.dailySalesData,
        filteredOrders: dashData.filteredOrders,
        availableProducts: dashData.availableProducts,
        filteredAds: dashData.filteredAds,
        logisticStats: dashData.logisticStats,
        berryExpenses,
        berryExpenseTotal: berryTotal,
        campaignNames,
    });

    const handleSend = () => {
        if (!input.trim() || chatLoading) return;
        sendMessage(input.trim(), dataContext, kpiTargets);
        setInput('');
    };

    const handleQuickAction = (prompt: string) => {
        sendMessage(prompt, dataContext, kpiTargets);
    };

    const panelWidth = expanded ? 'w-[500px]' : 'w-[380px]';
    const panelHeight = expanded ? 'h-[85vh]' : 'h-[550px]';

    return (
        <div className={`fixed bottom-20 right-5 ${panelWidth} ${panelHeight} bg-card border border-card-border rounded-2xl shadow-2xl flex flex-col z-[60] transition-all duration-300 overflow-hidden`}>
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-3 border-b border-card-border bg-card shrink-0">
                <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-xl bg-purple-500/10 flex items-center justify-center">
                        <img src="/logos/vega-isotipo.png" alt="Vega" className="w-5 h-5 object-contain" />
                    </div>
                    <div>
                        <h3 className="text-[11px] font-black text-foreground uppercase tracking-widest">Vega AI</h3>
                        <p className="text-[9px] text-muted font-mono">Inteligencia Operativa</p>
                    </div>
                </div>
                <div className="flex items-center gap-1">
                    <button
                        onClick={clearChat}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all"
                        title="Limpiar chat"
                    >
                        <Trash2 className="w-3.5 h-3.5" />
                    </button>
                    <button
                        onClick={() => setExpanded(!expanded)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all"
                        title={expanded ? 'Minimizar' : 'Expandir'}
                    >
                        {expanded ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
                    </button>
                    <button
                        onClick={() => setChatOpen(false)}
                        className="w-7 h-7 rounded-lg flex items-center justify-center text-muted hover:text-foreground hover:bg-hover-bg transition-all"
                    >
                        <X className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>

            {/* Messages */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 min-h-0">
                {messages.length === 0 && (
                    <div className="flex flex-col items-center justify-center h-full gap-4 py-8">
                        <div className="w-14 h-14 rounded-2xl bg-purple-500/10 flex items-center justify-center">
                            <Sparkles className="w-7 h-7 text-purple-400" />
                        </div>
                        <div className="text-center">
                            <p className="text-[11px] font-black text-foreground uppercase tracking-widest mb-1">Vega AI</p>
                            <p className="text-[10px] text-muted max-w-[250px]">
                                Tu auditor inteligente. Pregúntame sobre la operación, ventas, publicidad o cualquier dato.
                            </p>
                        </div>
                        <div className="flex flex-wrap gap-2 justify-center mt-2">
                            {QUICK_ACTIONS.map((action, idx) => (
                                <button
                                    key={idx}
                                    onClick={() => handleQuickAction(action.prompt)}
                                    className="px-3 py-1.5 bg-hover-bg border border-card-border rounded-xl text-[10px] font-bold text-muted hover:text-foreground hover:border-accent/30 transition-all"
                                >
                                    {action.label}
                                </button>
                            ))}
                        </div>
                    </div>
                )}
                {messages.map(msg => (
                    <VegaChatMessage key={msg.id} message={msg} />
                ))}
                {chatLoading && (
                    <div className="flex gap-3">
                        <div className="w-7 h-7 rounded-xl bg-purple-500/10 flex items-center justify-center shrink-0">
                            <Bot className="w-3.5 h-3.5 text-purple-400 animate-pulse" />
                        </div>
                        <div className="bg-card border border-card-border rounded-2xl px-4 py-3">
                            <div className="flex gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '0ms' }} />
                                <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '150ms' }} />
                                <div className="w-2 h-2 rounded-full bg-muted animate-bounce" style={{ animationDelay: '300ms' }} />
                            </div>
                        </div>
                    </div>
                )}
                <div ref={messagesEndRef} />
            </div>

            {/* Input */}
            <div className="p-3 border-t border-card-border shrink-0">
                <div className="flex items-center gap-2 bg-hover-bg rounded-xl px-3 py-2 border border-card-border focus-within:border-accent/30 transition-all">
                    <input
                        ref={inputRef}
                        type="text"
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                        placeholder="Pregúntale algo a Vega..."
                        className="flex-1 bg-transparent text-xs text-foreground placeholder:text-muted outline-none"
                        disabled={chatLoading}
                    />
                    <button
                        onClick={handleSend}
                        disabled={!input.trim() || chatLoading}
                        className="w-7 h-7 rounded-lg bg-accent/10 flex items-center justify-center text-accent hover:bg-accent/20 transition-all disabled:opacity-30 disabled:cursor-not-allowed"
                    >
                        <Send className="w-3.5 h-3.5" />
                    </button>
                </div>
            </div>
        </div>
    );
};
