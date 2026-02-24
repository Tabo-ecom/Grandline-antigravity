"use client";

import React, { createContext, useContext, useState, useCallback } from 'react';
import { authFetch } from '@/lib/api/client';
import type { VegaChatMessage, VegaTriggeredAlert } from '@/lib/types/vega';
import type { KPITarget } from '@/lib/types/kpi-targets';

interface VegaContextType {
    // Chat state
    chatOpen: boolean;
    setChatOpen: (open: boolean) => void;
    expanded: boolean;
    setExpanded: (expanded: boolean) => void;
    messages: VegaChatMessage[];
    sendMessage: (message: string, dataContext: string, kpiTargets?: KPITarget[]) => Promise<void>;
    chatLoading: boolean;
    clearChat: () => void;

    // Alerts
    unacknowledgedCount: number;
    setUnacknowledgedCount: (count: number) => void;
}

const VegaContext = createContext<VegaContextType | undefined>(undefined);

export function VegaProvider({ children }: { children: React.ReactNode }) {
    const [chatOpen, setChatOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    const [messages, setMessages] = useState<VegaChatMessage[]>([]);
    const [chatLoading, setChatLoading] = useState(false);
    const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);

    const clearChat = useCallback(() => {
        setMessages([]);
    }, []);

    const sendMessage = useCallback(async (message: string, dataContext: string, kpiTargets?: KPITarget[]) => {
        const userMsg: VegaChatMessage = {
            id: `msg_${Date.now()}_user`,
            role: 'user',
            content: message,
            timestamp: Date.now(),
        };

        setMessages(prev => [...prev, userMsg]);
        setChatLoading(true);

        try {
            const res = await authFetch('/api/vega/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    message,
                    dataContext,
                    chatHistory: messages.slice(-6).map(m => ({ role: m.role, content: m.content })),
                    kpiTargets,
                }),
            });

            const data = await res.json();

            if (data.error) throw new Error(data.error);

            const assistantMsg: VegaChatMessage = {
                id: `msg_${Date.now()}_assistant`,
                role: 'assistant',
                content: data.response,
                timestamp: Date.now(),
            };

            setMessages(prev => [...prev, assistantMsg]);
        } catch (error) {
            const errorMsg: VegaChatMessage = {
                id: `msg_${Date.now()}_error`,
                role: 'assistant',
                content: `Error: ${error instanceof Error ? error.message : 'No se pudo conectar con Vega AI'}`,
                timestamp: Date.now(),
            };
            setMessages(prev => [...prev, errorMsg]);
        } finally {
            setChatLoading(false);
        }
    }, [messages]);

    return (
        <VegaContext.Provider value={{
            chatOpen,
            setChatOpen,
            expanded,
            setExpanded,
            messages,
            sendMessage,
            chatLoading,
            clearChat,
            unacknowledgedCount,
            setUnacknowledgedCount,
        }}>
            {children}
        </VegaContext.Provider>
    );
}

export function useVega() {
    const context = useContext(VegaContext);
    if (context === undefined) {
        throw new Error('useVega must be used within a VegaProvider');
    }
    return context;
}
