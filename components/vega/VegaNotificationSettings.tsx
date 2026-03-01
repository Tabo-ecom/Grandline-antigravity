'use client';

import React, { useState, useEffect } from 'react';
import { Send, Check, X, Loader2, Mail } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';
import type { VegaNotificationConfig } from '@/lib/types/vega';

export const VegaNotificationSettings: React.FC = () => {
    const { user } = useAuth();
    const [config, setConfig] = useState<VegaNotificationConfig>({
        telegramBotToken: '',
        telegramChatId: '',
        slackWebhookUrl: '',
    });
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [saved, setSaved] = useState(false);
    const [testing, setTesting] = useState(false);
    const [testResults, setTestResults] = useState<Record<string, boolean> | null>(null);

    useEffect(() => {
        async function load() {
            try {
                const res = await authFetch(`/api/vega/notifications`);
                const data = await res.json();
                if (data.config) setConfig(data.config);
            } catch (err) {
                console.error('Error loading config:', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    const handleSave = async () => {
        setSaving(true);
        setSaved(false);
        try {
            const res = await authFetch('/api/vega/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config }),
            });
            if (res.ok) {
                setSaved(true);
                setTimeout(() => setSaved(false), 3000);
            } else {
                const data = await res.json().catch(() => ({}));
                console.error('Error saving config:', data.error || res.status);
                alert(`Error al guardar: ${data.error || 'Error desconocido'}`);
            }
        } catch (err) {
            console.error('Error saving config:', err);
            alert('Error de conexión al guardar');
        } finally {
            setSaving(false);
        }
    };

    const handleTest = async () => {
        setTesting(true);
        setTestResults(null);
        try {
            const res = await authFetch('/api/vega/notifications', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ config, test: true }),
            });
            const data = await res.json();
            setTestResults(data.results || {});
        } catch (err) {
            console.error('Error testing:', err);
        } finally {
            setTesting(false);
        }
    };

    if (loading) return null;

    return (
        <div className="space-y-5">
            {/* Telegram */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Telegram</span>
                        {testResults?.telegram !== undefined && (
                            testResults.telegram
                                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                : <X className="w-3.5 h-3.5 text-red-400" />
                        )}
                    </div>
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={config.telegramBotToken}
                            onChange={(e) => setConfig(prev => ({ ...prev, telegramBotToken: e.target.value }))}
                            placeholder="Bot Token"
                            className="w-full px-3 py-2 bg-card border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted outline-none focus:border-accent/30 transition-all"
                        />
                        <input
                            type="text"
                            value={config.telegramChatId}
                            onChange={(e) => setConfig(prev => ({ ...prev, telegramChatId: e.target.value }))}
                            placeholder="Chat ID"
                            className="w-full px-3 py-2 bg-card border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted outline-none focus:border-accent/30 transition-all"
                        />
                    </div>
                </div>

                {/* Slack */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-black text-purple-400 uppercase tracking-widest">Slack</span>
                        {testResults?.slack !== undefined && (
                            testResults.slack
                                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                : <X className="w-3.5 h-3.5 text-red-400" />
                        )}
                    </div>
                    <input
                        type="text"
                        value={config.slackWebhookUrl}
                        onChange={(e) => setConfig(prev => ({ ...prev, slackWebhookUrl: e.target.value }))}
                        placeholder="Webhook URL"
                        className="w-full px-3 py-2 bg-card border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted outline-none focus:border-accent/30 transition-all"
                    />
                </div>

                {/* Slack Bot (Campaign Control) */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-black text-orange-400 uppercase tracking-widest">Slack Bot (Control de Campañas)</span>
                    </div>
                    <p className="text-[10px] text-muted mb-3">Controla campañas desde Slack: sube/baja presupuestos, pausa o activa campañas.</p>
                    <div className="space-y-2">
                        <input
                            type="text"
                            value={config.slackBotToken || ''}
                            onChange={(e) => setConfig(prev => ({ ...prev, slackBotToken: e.target.value }))}
                            placeholder="Bot Token (xoxb-...)"
                            className="w-full px-3 py-2 bg-card border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted outline-none focus:border-accent/30 transition-all"
                        />
                        <input
                            type="text"
                            value={config.slackSigningSecret || ''}
                            onChange={(e) => setConfig(prev => ({ ...prev, slackSigningSecret: e.target.value }))}
                            placeholder="Signing Secret"
                            className="w-full px-3 py-2 bg-card border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted outline-none focus:border-accent/30 transition-all"
                        />
                        <input
                            type="text"
                            value={config.slackChannelId || ''}
                            onChange={(e) => setConfig(prev => ({ ...prev, slackChannelId: e.target.value }))}
                            placeholder="Channel ID (C0123456789)"
                            className="w-full px-3 py-2 bg-card border border-card-border rounded-xl text-xs text-foreground placeholder:text-muted outline-none focus:border-accent/30 transition-all"
                        />
                    </div>
                </div>

                {/* Email */}
                <div className="p-4 bg-hover-bg rounded-xl border border-card-border">
                    <div className="flex items-center gap-2 mb-3">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Email</span>
                        {testResults?.email !== undefined && (
                            testResults.email
                                ? <Check className="w-3.5 h-3.5 text-emerald-400" />
                                : <X className="w-3.5 h-3.5 text-red-400" />
                        )}
                    </div>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <div
                            onClick={() => setConfig(prev => ({ ...prev, emailEnabled: !prev.emailEnabled }))}
                            className={`relative w-9 h-5 rounded-full transition-colors ${config.emailEnabled ? 'bg-emerald-500' : 'bg-card-border'}`}
                        >
                            <div className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white transition-transform ${config.emailEnabled ? 'translate-x-4' : ''}`} />
                        </div>
                        <span className="text-xs text-foreground">Enviar reportes por email</span>
                    </label>
                    {config.emailEnabled && user?.email && (
                        <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-card border border-card-border rounded-xl">
                            <Mail className="w-3.5 h-3.5 text-muted" />
                            <span className="text-xs text-muted">Se enviarán a</span>
                            <span className="text-xs text-foreground font-semibold">{user.email}</span>
                        </div>
                    )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-3">
                    <button
                        onClick={handleSave}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black text-white uppercase tracking-widest bg-accent hover:bg-accent/90 transition-all disabled:opacity-40"
                    >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : saved ? <><Check className="w-3 h-3" /> Guardado</> : 'Guardar'}
                    </button>
                    <button
                        onClick={handleTest}
                        disabled={testing}
                        className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-[10px] font-black text-muted uppercase tracking-widest bg-hover-bg border border-card-border hover:border-accent/30 transition-all disabled:opacity-40"
                    >
                        {testing ? <Loader2 className="w-3 h-3 animate-spin" /> : <><Send className="w-3 h-3" /> Test</>}
                    </button>
                </div>
        </div>
    );
};
