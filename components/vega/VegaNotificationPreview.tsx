'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Mail, Loader2, Send, Check } from 'lucide-react';
import { authFetch } from '@/lib/api/client';

type Channel = 'slack' | 'telegram' | 'email';
type PreviewType = 'daily' | 'ads' | 'alert';

const CHANNELS: { key: Channel; label: string; color: string }[] = [
    { key: 'telegram', label: 'Telegram', color: 'text-blue-400' },
    { key: 'slack', label: 'Slack', color: 'text-purple-400' },
    { key: 'email', label: 'Email', color: 'text-emerald-400' },
];

const PREVIEW_TYPES: { key: PreviewType; label: string }[] = [
    { key: 'daily', label: 'Diario' },
    { key: 'ads', label: 'Ads' },
    { key: 'alert', label: 'Alerta' },
];

interface Previews {
    slack: Record<string, string>;
    telegram: Record<string, string>;
    email: { subject: string; preview: string };
}

export const VegaNotificationPreview: React.FC = () => {
    const [channel, setChannel] = useState<Channel>('slack');
    const [previewType, setPreviewType] = useState<PreviewType>('daily');
    const [previews, setPreviews] = useState<Previews | null>(null);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [sent, setSent] = useState(false);
    const [sendError, setSendError] = useState('');

    useEffect(() => {
        async function load() {
            try {
                const res = await authFetch('/api/vega/preview');
                const data = await res.json();
                if (data.previews) setPreviews(data.previews);
            } catch {
                // fallback
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const currentPreview = previews
        ? channel === 'email'
            ? `📧 ${previews.email.subject}\n\n${previews.email.preview}`
            : (previews[channel]?.[previewType] || 'Vista previa no disponible')
        : '';

    const handleSendTest = async () => {
        setSending(true);
        setSent(false);
        setSendError('');
        try {
            const res = await authFetch('/api/vega/preview', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ channel, previewType }),
            });
            const data = await res.json();
            if (res.ok && data.success) {
                setSent(true);
                setTimeout(() => setSent(false), 3000);
            } else {
                setSendError(data.error || 'Error al enviar');
                setTimeout(() => setSendError(''), 4000);
            }
        } catch {
            setSendError('Error de conexión');
            setTimeout(() => setSendError(''), 4000);
        } finally {
            setSending(false);
        }
    };

    // Format preview text with basic markdown-like rendering
    const renderPreviewLines = (text: string) => {
        return text.split('\n').map((line, i) => {
            // Bold: *text*
            const parts = line.split(/\*([^*]+)\*/g);
            return (
                <div key={i} className={line === '' ? 'h-2' : ''}>
                    {parts.map((part, j) =>
                        j % 2 === 1
                            ? <span key={j} className="font-bold">{part}</span>
                            : <span key={j}>{part}</span>
                    )}
                </div>
            );
        });
    };

    return (
        <div>
            {/* Channel selector */}
            <div className="flex gap-2 mb-4">
                {CHANNELS.map(ch => (
                    <button
                        key={ch.key}
                        onClick={() => setChannel(ch.key)}
                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                            channel === ch.key
                                ? `bg-accent/10 text-accent border border-accent/20`
                                : 'text-muted hover:text-foreground bg-hover-bg border border-transparent'
                        }`}
                    >
                        {ch.key === 'email' ? <Mail className="w-3 h-3" /> : <MessageSquare className="w-3 h-3" />}
                        {ch.label}
                    </button>
                ))}
            </div>

            {/* Type selector */}
            {channel !== 'email' && (
                <div className="flex gap-1.5 mb-4">
                    {PREVIEW_TYPES.map(pt => (
                        <button
                            key={pt.key}
                            onClick={() => setPreviewType(pt.key)}
                            className={`px-3 py-1 rounded-lg text-[10px] font-bold uppercase tracking-widest transition-colors ${
                                previewType === pt.key
                                    ? 'bg-foreground/10 text-foreground'
                                    : 'text-muted hover:text-foreground'
                            }`}
                        >
                            {pt.label}
                        </button>
                    ))}
                </div>
            )}

            {/* Phone mockup */}
            <div className="flex justify-center">
                <div className="w-full max-w-[340px] bg-[#0d1117] rounded-[28px] border-2 border-[#30363d] shadow-2xl overflow-hidden">
                    {/* Status bar */}
                    <div className="flex items-center justify-between px-6 pt-3 pb-1">
                        <span className="text-[10px] text-white/60 font-semibold">
                            {new Date().toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}
                        </span>
                        <div className="w-20 h-5 bg-black rounded-full" />
                        <div className="flex gap-1">
                            <div className="w-4 h-2 bg-white/40 rounded-sm" />
                            <div className="w-4 h-2 bg-white/40 rounded-sm" />
                        </div>
                    </div>

                    {/* App header */}
                    <div className="px-4 py-2 flex items-center gap-2 border-b border-white/10">
                        <div className="w-7 h-7 rounded-full bg-gradient-to-br from-[#d75c33] to-[#e8724b] flex items-center justify-center">
                            <span className="text-[10px] font-black text-white">V</span>
                        </div>
                        <div>
                            <p className="text-[11px] font-bold text-white">VEGA</p>
                            <p className="text-[9px] text-white/40">
                                {channel === 'telegram' ? 'Telegram Bot' : channel === 'slack' ? 'Slack App' : 'Email'}
                            </p>
                        </div>
                    </div>

                    {/* Message content */}
                    <div className="px-4 py-3 max-h-[320px] overflow-y-auto">
                        {loading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-5 h-5 text-white/40 animate-spin" />
                            </div>
                        ) : (
                            <div className="bg-[#161b22] rounded-xl p-3 border border-white/5">
                                <div className="text-[11px] text-white/80 leading-relaxed font-mono whitespace-pre-wrap">
                                    {renderPreviewLines(currentPreview)}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input bar */}
                    <div className="px-4 py-3 border-t border-white/10">
                        <div className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-full">
                            <span className="text-[11px] text-white/30">Escribe un mensaje...</span>
                        </div>
                    </div>

                    {/* Home indicator */}
                    <div className="flex justify-center pb-2">
                        <div className="w-28 h-1 bg-white/20 rounded-full" />
                    </div>
                </div>
            </div>

            {/* Send Test Button */}
            <div className="mt-4 flex flex-col items-center gap-2">
                <button
                    onClick={handleSendTest}
                    disabled={sending || loading || !previews}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all disabled:opacity-40 bg-accent/10 text-accent border border-accent/20 hover:bg-accent/20"
                >
                    {sending ? <Loader2 className="w-3 h-3 animate-spin" /> : sent ? <><Check className="w-3 h-3" /> Enviado</> : <><Send className="w-3 h-3" /> Enviar Test</>}
                </button>
                {sendError && (
                    <p className="text-[10px] text-red-400 font-semibold">{sendError}</p>
                )}
            </div>
        </div>
    );
};
