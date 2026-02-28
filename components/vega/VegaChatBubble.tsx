'use client';

import React from 'react';
import { useVega } from '@/lib/context/VegaContext';
import { VegaChatPanel } from './VegaChatPanel';

export const VegaChatBubble: React.FC = () => {
    const { chatOpen, setChatOpen, unacknowledgedCount } = useVega();

    return (
        <>
            <VegaChatPanel />
            <button
                onClick={() => setChatOpen(!chatOpen)}
                className="fixed bottom-5 right-5 w-12 h-12 rounded-2xl bg-gradient-to-br from-purple-500 to-purple-700 shadow-lg shadow-purple-500/20 flex items-center justify-center z-[60] hover:scale-105 transition-all group"
                title="Vega AI - Chat"
            >
                <img src="/logos/vega-isotipo.png" alt="Vega" className="w-6 h-6 object-contain brightness-0 invert group-hover:scale-110 transition-transform" />
                {unacknowledgedCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-[9px] font-black text-white flex items-center justify-center">
                        {unacknowledgedCount > 9 ? '9+' : unacknowledgedCount}
                    </span>
                )}
                <span className="absolute inset-0 rounded-2xl bg-purple-400/20 animate-ping opacity-75" />
            </button>
        </>
    );
};
