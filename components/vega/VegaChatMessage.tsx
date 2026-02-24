'use client';

import React from 'react';
import { Bot, User } from 'lucide-react';
import type { VegaChatMessage as ChatMessageType } from '@/lib/types/vega';
import { VegaMarkdown } from './VegaMarkdown';

interface VegaChatMessageProps {
    message: ChatMessageType;
}

export const VegaChatMessage: React.FC<VegaChatMessageProps> = ({ message }) => {
    const isUser = message.role === 'user';

    return (
        <div className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}>
            <div className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 ${isUser ? 'bg-accent/10' : 'bg-purple-500/10'}`}>
                {isUser ? (
                    <User className="w-3.5 h-3.5 text-accent" />
                ) : (
                    <Bot className="w-3.5 h-3.5 text-purple-400" />
                )}
            </div>
            <div className={`max-w-[85%] px-3.5 py-2.5 rounded-2xl leading-relaxed ${isUser
                ? 'bg-accent/10 text-foreground border border-accent/20'
                : 'bg-card border border-card-border text-foreground'
                }`}>
                {isUser ? (
                    <p className="text-xs whitespace-pre-wrap break-words">{message.content}</p>
                ) : (
                    <VegaMarkdown content={message.content} className="text-xs [&_p]:text-xs [&_li]:text-xs [&_h2]:text-sm [&_h3]:text-xs [&_h4]:text-xs [&_th]:text-[9px] [&_td]:text-[10px]" />
                )}
                <p className="text-[9px] text-muted mt-1.5 font-mono">
                    {new Date(message.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                </p>
            </div>
        </div>
    );
};
