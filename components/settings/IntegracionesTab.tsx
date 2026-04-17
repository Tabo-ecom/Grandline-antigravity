'use client';

import React, { useState, useEffect } from 'react';
import { Save, Loader2, CheckCircle2, RefreshCw, Brain, Sparkles, ExternalLink, Link2, Store } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { fetchMetaAdAccounts } from '@/lib/services/meta';
import { fetchTikTokAdAccounts, getTikTokStatus, disconnectTikTok } from '@/lib/services/tiktok';
import { getAdSettings, saveAdSettings } from '@/lib/services/marketing';
import { authFetch } from '@/lib/api/client';

interface AdAccount {
    id: string;
    name: string;
}

interface AdSettings {
    fb_token: string;
    fb_account_ids: AdAccount[];
    tt_token: string;
    tt_account_ids: AdAccount[];
    fb_currency?: string;
    tt_currency?: string;
    ai_provider?: 'gemini' | 'openai' | 'none';
    ai_api_key?: string;
    ai_auto_map?: boolean;
    // Individual AI keys
    openai_api_key?: string;
    gemini_api_key?: string;
    claude_api_key?: string;
}

// Collapsible integration card
function IntegrationCard({ title, icon, color, status, statusLabel, children, defaultOpen = false }: {
    title: string;
    icon: string;
    color: string;
    status: 'connected' | 'disconnected' | 'optional';
    statusLabel: string;
    children: React.ReactNode;
    defaultOpen?: boolean;
}) {
    const [open, setOpen] = useState(defaultOpen);
    const statusColors = {
        connected: { bg: 'bg-emerald-500/10', text: 'text-emerald-400', border: 'border-emerald-500/20' },
        disconnected: { bg: 'bg-red-500/10', text: 'text-red-400', border: 'border-red-500/20' },
        optional: { bg: 'bg-amber-500/10', text: 'text-amber-400', border: 'border-amber-500/20' },
    };
    const sc = statusColors[status];

    return (
        <div className="bg-card border border-card-border rounded-2xl overflow-hidden transition-all hover:border-card-border/80">
            <button onClick={() => setOpen(!open)} className="w-full flex items-center gap-4 p-5 text-left">
                <div className="w-11 h-11 rounded-xl flex items-center justify-center text-lg font-bold shrink-0" style={{ background: `${color}15`, color }}>
                    {icon}
                </div>
                <div className="flex-1 min-w-0">
                    <h4 className="text-sm font-bold">{title}</h4>
                </div>
                <span className={`text-[9px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-lg border ${sc.bg} ${sc.text} ${sc.border}`}>
                    {statusLabel}
                </span>
            </button>
            {open && (
                <div className="px-5 pb-5 pt-0 border-t border-card-border/50 mt-0 pt-4 space-y-4">
                    {children}
                </div>
            )}
        </div>
    );
}

export default function IntegracionesTab() {
    const { user, effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [settings, setSettings] = useState<AdSettings>({
        fb_token: '', fb_account_ids: [], tt_token: '', tt_account_ids: [],
        ai_provider: 'none', ai_api_key: '', ai_auto_map: false,
        openai_api_key: '', gemini_api_key: '', claude_api_key: '',
    });

    const [fbAccounts, setFbAccounts] = useState<any[]>([]);
    const [ttAccounts, setTtAccounts] = useState<any[]>([]);
    const [fetchingFb, setFetchingFb] = useState(false);
    const [fetchingTt, setFetchingTt] = useState(false);
    const [meliConnected, setMeliConnected] = useState(false);
    const [meliNickname, setMeliNickname] = useState('');
    const [ttOAuthStatus, setTtOAuthStatus] = useState<{ connected: boolean; display_name?: string }>({ connected: false });
    const [disconnectingTt, setDisconnectingTt] = useState(false);

    useEffect(() => {
        (async () => {
            try {
                const data = await getAdSettings(effectiveUid || '');
                if (data) setSettings(prev => ({ ...prev, ...data }));
                // Check TikTok OAuth connection
                try {
                    const ttStatus = await getTikTokStatus(authFetch);
                    setTtOAuthStatus(ttStatus);
                } catch (e) { console.warn('TT status check failed:', e); }
                // Check MeLi connection
                const meliRes = await authFetch('/api/meli/status');
                if (meliRes.ok) {
                    const meliData = await meliRes.json();
                    setMeliConnected(meliData.connected);
                    if (meliData.connections?.length) setMeliNickname(meliData.connections[0].nickname);
                }
            } catch (e) { console.error('Error loading settings:', e); }
            finally { setLoading(false); }
        })();
    }, [effectiveUid]);

    const handleFetchFb = async () => {
        if (!settings.fb_token) return;
        setFetchingFb(true);
        try {
            const accounts = await fetchMetaAdAccounts(settings.fb_token);
            setFbAccounts(accounts);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setFetchingFb(false); }
    };

    const handleFetchTt = async () => {
        if (!settings.tt_token) return;
        setFetchingTt(true);
        try {
            const accounts = await fetchTikTokAdAccounts(settings.tt_token);
            setTtAccounts(accounts);
        } catch (e: any) { alert('Error: ' + e.message); }
        finally { setFetchingTt(false); }
    };

    const handleSave = async () => {
        if (!user) return;
        setSaving(true);
        setSuccess(false);
        try {
            await saveAdSettings(settings as any, effectiveUid || '');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (e) { console.error('Error saving:', e); }
        finally { setSaving(false); }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-muted font-mono text-xs uppercase tracking-widest">Cargando integraciones...</p>
            </div>
        );
    }

    const handleConnectTikTok = async () => {
        try {
            const res = await authFetch('/api/auth/tiktok/url');
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch (e) { console.error('Error getting TikTok OAuth URL:', e); }
    };

    const handleDisconnectTikTok = async () => {
        if (!confirm('¿Desconectar tu cuenta de TikTok?')) return;
        setDisconnectingTt(true);
        try {
            await disconnectTikTok(authFetch);
            setTtOAuthStatus({ connected: false });
            setSettings(prev => ({ ...prev, tt_token: '', tt_account_ids: [] }));
            setTtAccounts([]);
        } catch (e) { console.error('Error disconnecting:', e); }
        setDisconnectingTt(false);
    };

    const fbConnected = !!settings.fb_token && settings.fb_account_ids.length > 0;
    const ttConnected = !!settings.tt_token && settings.tt_account_ids.length > 0;

    return (
        <div className="space-y-6 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black tracking-tight">Integraciones</h1>
                    <p className="text-muted mt-1 text-sm">Conecta tus servicios de IA, plataformas de ads y tiendas.</p>
                </div>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 px-5 py-2.5 bg-accent hover:bg-accent/90 text-white font-bold text-xs uppercase tracking-widest rounded-xl transition-all disabled:opacity-50"
                >
                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : success ? <CheckCircle2 className="w-3.5 h-3.5" /> : <Save className="w-3.5 h-3.5" />}
                    {success ? 'Guardado' : saving ? 'Guardando...' : 'Guardar Todo'}
                </button>
            </div>

            {/* ── MODELOS DE IA ── */}
            <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 ml-1 flex items-center gap-2">
                    <Sparkles className="w-3.5 h-3.5" />
                    Modelos de IA
                </div>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    {/* OpenAI / ChatGPT */}
                    <IntegrationCard
                        title="ChatGPT (OpenAI)"
                        icon="G"
                        color="#10a37f"
                        status={settings.openai_api_key ? 'connected' : 'optional'}
                        statusLabel={settings.openai_api_key ? 'Conectado' : 'No configurado'}
                        defaultOpen={!settings.openai_api_key}
                    >
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">API Key</label>
                        <input
                            type="password"
                            value={settings.openai_api_key || ''}
                            onChange={(e) => setSettings({ ...settings, openai_api_key: e.target.value })}
                            className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs focus:border-[#10a37f] outline-none transition-colors font-mono"
                            placeholder="sk-proj-..."
                        />
                        <p className="text-[9px] text-muted">Imagenes IA, copy avanzado, VEGA</p>
                    </IntegrationCard>

                    {/* Google Gemini */}
                    <IntegrationCard
                        title="Google Gemini"
                        icon="G"
                        color="#4285F4"
                        status={settings.gemini_api_key ? 'connected' : 'optional'}
                        statusLabel={settings.gemini_api_key ? 'Conectado' : 'No configurado'}
                        defaultOpen={!settings.gemini_api_key}
                    >
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">API Key</label>
                        <input
                            type="password"
                            value={settings.gemini_api_key || ''}
                            onChange={(e) => setSettings({ ...settings, gemini_api_key: e.target.value })}
                            className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs focus:border-[#4285F4] outline-none transition-colors font-mono"
                            placeholder="AIzaSy..."
                        />
                        <p className="text-[9px] text-muted">Reportes VEGA, mapeo inteligente, creativos gratis</p>
                    </IntegrationCard>

                    {/* Claude / Anthropic */}
                    <IntegrationCard
                        title="Claude (Anthropic)"
                        icon="C"
                        color="#d97b46"
                        status={settings.claude_api_key ? 'connected' : 'optional'}
                        statusLabel={settings.claude_api_key ? 'Conectado' : 'Opcional'}
                        defaultOpen={!settings.claude_api_key}
                    >
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">API Key</label>
                        <input
                            type="password"
                            value={settings.claude_api_key || ''}
                            onChange={(e) => setSettings({ ...settings, claude_api_key: e.target.value })}
                            className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs focus:border-[#d97b46] outline-none transition-colors font-mono"
                            placeholder="sk-ant-..."
                        />
                        <p className="text-[9px] text-muted">Copy CRO avanzado, analisis de producto</p>
                    </IntegrationCard>
                </div>
            </div>

            {/* ── PLATAFORMAS DE ADS ── */}
            <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 ml-1 flex items-center gap-2">
                    <RefreshCw className="w-3.5 h-3.5" />
                    Plataformas de Ads
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Facebook / Meta */}
                    <IntegrationCard
                        title="Facebook / Meta API"
                        icon="f"
                        color="#1877F2"
                        status={fbConnected ? 'connected' : settings.fb_token ? 'optional' : 'disconnected'}
                        statusLabel={fbConnected ? `${settings.fb_account_ids.length} cuentas` : settings.fb_token ? 'Token sin cuentas' : 'No conectado'}
                        defaultOpen={!fbConnected}
                    >
                        <div>
                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Access Token</label>
                            <input
                                type="password"
                                value={settings.fb_token}
                                onChange={(e) => setSettings({ ...settings, fb_token: e.target.value })}
                                className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs focus:border-[#1877F2] outline-none transition-colors font-mono"
                                placeholder="EAAB..."
                            />
                        </div>
                        <div className="flex gap-2">
                            <select
                                value={settings.fb_currency || 'USD'}
                                onChange={(e) => setSettings({ ...settings, fb_currency: e.target.value })}
                                className="flex-1 bg-hover-bg border border-card-border rounded-xl px-3 py-2 text-xs focus:border-[#1877F2] outline-none"
                            >
                                <option value="USD">USD</option>
                                <option value="COP">COP</option>
                            </select>
                            <button
                                type="button" onClick={handleFetchFb} disabled={!settings.fb_token || fetchingFb}
                                className="px-3 py-2 bg-[#1877F2]/10 text-[#1877F2] text-[10px] font-bold uppercase rounded-xl hover:bg-[#1877F2]/20 disabled:opacity-30 transition-all"
                            >
                                {fetchingFb ? 'Buscando...' : 'Obtener Cuentas'}
                            </button>
                        </div>
                        {/* Account list */}
                        <div className="max-h-32 overflow-y-auto space-y-1">
                            {(() => {
                                const accountMap = new Map<string, AdAccount>();
                                settings.fb_account_ids.forEach(a => accountMap.set(a.id, a));
                                fbAccounts.forEach(acc => { const id = `act_${acc.account_id}`; accountMap.set(id, { id, name: acc.name }); });
                                return Array.from(accountMap.values()).map(acc => {
                                    const isSelected = settings.fb_account_ids.some(a => a.id === acc.id);
                                    return (
                                        <label key={acc.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs ${isSelected ? 'bg-[#1877F2]/10 border border-[#1877F2]/20' : 'hover:bg-hover-bg border border-transparent'}`}>
                                            <input type="checkbox" checked={isSelected} onChange={(e) => {
                                                const next = e.target.checked ? [...settings.fb_account_ids, acc] : settings.fb_account_ids.filter(a => a.id !== acc.id);
                                                setSettings({ ...settings, fb_account_ids: next });
                                            }} className="w-3.5 h-3.5 accent-[#1877F2]" />
                                            <span className="font-bold">{acc.name}</span>
                                            <span className="text-muted font-mono text-[9px] ml-auto">{acc.id}</span>
                                        </label>
                                    );
                                });
                            })()}
                        </div>
                    </IntegrationCard>

                    {/* TikTok */}
                    <IntegrationCard
                        title="TikTok Ads API"
                        icon="T"
                        color="#ff0044"
                        status={ttConnected ? 'connected' : ttOAuthStatus.connected ? 'optional' : 'disconnected'}
                        statusLabel={ttConnected ? `${settings.tt_account_ids.length} cuentas` : ttOAuthStatus.connected ? 'Conectado sin cuentas' : 'No conectado'}
                        defaultOpen={!ttConnected}
                    >
                        {ttOAuthStatus.connected || settings.tt_token ? (
                            <>
                                <div className="flex items-center gap-3 p-3 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
                                    <div className="w-8 h-8 rounded-lg bg-[#ff0044]/20 flex items-center justify-center">
                                        <span className="text-xs font-black text-[#ff0044]">TT</span>
                                    </div>
                                    <div className="flex-1">
                                        <p className="text-xs font-bold">Cuenta conectada via OAuth</p>
                                        <p className="text-[9px] text-muted">Token activo</p>
                                    </div>
                                    <button
                                        onClick={handleDisconnectTikTok}
                                        disabled={disconnectingTt}
                                        className="text-[9px] font-bold text-red-400 hover:text-red-300 uppercase tracking-wider"
                                    >
                                        {disconnectingTt ? 'Desconectando...' : 'Desconectar'}
                                    </button>
                                </div>
                                <div className="flex gap-2">
                                    <select
                                        value={settings.tt_currency || 'USD'}
                                        onChange={(e) => setSettings({ ...settings, tt_currency: e.target.value })}
                                        className="flex-1 bg-hover-bg border border-card-border rounded-xl px-3 py-2 text-xs focus:border-[#ff0044] outline-none"
                                    >
                                        <option value="USD">USD</option>
                                        <option value="COP">COP</option>
                                    </select>
                                    <button
                                        type="button" onClick={handleFetchTt} disabled={fetchingTt}
                                        className="px-3 py-2 bg-[#ff0044]/10 text-[#ff0044] text-[10px] font-bold uppercase rounded-xl hover:bg-[#ff0044]/20 disabled:opacity-30 transition-all"
                                    >
                                        {fetchingTt ? 'Buscando...' : 'Obtener Cuentas'}
                                    </button>
                                </div>
                                {/* Account list */}
                                <div className="max-h-32 overflow-y-auto space-y-1">
                                    {(() => {
                                        const accountMap = new Map<string, AdAccount>();
                                        settings.tt_account_ids.forEach(a => accountMap.set(a.id, a));
                                        ttAccounts.forEach(acc => { accountMap.set(acc.advertiser_id, { id: acc.advertiser_id, name: acc.advertiser_name }); });
                                        return Array.from(accountMap.values()).map(acc => {
                                            const isSelected = settings.tt_account_ids.some(a => a.id === acc.id);
                                            return (
                                                <label key={acc.id} className={`flex items-center gap-2 p-2 rounded-lg cursor-pointer text-xs ${isSelected ? 'bg-[#ff0044]/10 border border-[#ff0044]/20' : 'hover:bg-hover-bg border border-transparent'}`}>
                                                    <input type="checkbox" checked={isSelected} onChange={(e) => {
                                                        const next = e.target.checked ? [...settings.tt_account_ids, acc] : settings.tt_account_ids.filter(a => a.id !== acc.id);
                                                        setSettings({ ...settings, tt_account_ids: next });
                                                    }} className="w-3.5 h-3.5 accent-[#ff0044]" />
                                                    <span className="font-bold">{acc.name}</span>
                                                    <span className="text-muted font-mono text-[9px] ml-auto">{acc.id}</span>
                                                </label>
                                            );
                                        });
                                    })()}
                                </div>
                            </>
                        ) : (
                            <>
                                <p className="text-xs text-muted leading-relaxed">
                                    Conecta tu cuenta de TikTok Ads para crear campañas y analizar rendimiento desde Grand Line.
                                </p>
                                <button
                                    onClick={handleConnectTikTok}
                                    className="w-full py-3 bg-[#ff0044] text-white font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-[#ff0044]/90 transition-all flex items-center justify-center gap-2"
                                >
                                    <Link2 className="w-4 h-4" />
                                    Conectar TikTok Ads
                                </button>
                            </>
                        )}
                    </IntegrationCard>
                </div>
            </div>

            {/* ── E-COMMERCE ── */}
            <div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3 ml-1 flex items-center gap-2">
                    <Store className="w-3.5 h-3.5" />
                    E-Commerce
                </div>
                <div className="grid grid-cols-1 gap-3">
                    <IntegrationCard
                        title="Shopify Stores"
                        icon="S"
                        color="#96bf48"
                        status="connected"
                        statusLabel="Configurado en Pipeline"
                    >
                        <p className="text-xs text-muted leading-relaxed">
                            Las tiendas Shopify se configuran en el Pipeline de VEGA (Edison).
                            Las credenciales se gestionan via variables de entorno en Railway.
                        </p>
                        <a href="https://railway.com" target="_blank" rel="noopener"
                            className="inline-flex items-center gap-1.5 text-[10px] text-[#96bf48] font-bold uppercase hover:underline">
                            <ExternalLink className="w-3 h-3" /> Abrir Railway
                        </a>
                    </IntegrationCard>

                    <IntegrationCard
                        title="ClickUp"
                        icon="C"
                        color="#7B68EE"
                        status="connected"
                        statusLabel="Conectado"
                    >
                        <p className="text-xs text-muted leading-relaxed">
                            Workspace: <strong className="text-foreground">GL GROUP</strong> · 3 miembros · 5 spaces (TABO accesorios, Lucent, Dropshipping, Creadores UGC, GUSTAVO).
                        </p>
                        <p className="text-xs text-muted leading-relaxed mt-1">
                            Las tareas de ClickUp se ven en el modulo <strong className="text-foreground">Tareas → ClickUp</strong>.
                            API key configurada via variables de entorno.
                        </p>
                    </IntegrationCard>

                    <IntegrationCard
                        title="MercadoLibre"
                        icon="M"
                        color="#FFE600"
                        status={meliConnected ? 'connected' : 'disconnected'}
                        statusLabel={meliConnected ? 'Conectado' : 'No conectado'}
                        defaultOpen={!meliConnected}
                    >
                        {meliConnected ? (
                            <p className="text-xs text-muted leading-relaxed">
                                Cuenta conectada: <strong className="text-foreground">{meliNickname}</strong>. Las ordenes se sincronizan automaticamente como tienda MercadoLibre en el Dashboard.
                            </p>
                        ) : (
                            <>
                                <p className="text-xs text-muted leading-relaxed mb-3">
                                    Conecta tu cuenta de MercadoLibre para importar ordenes, productos y ventas automaticamente.
                                </p>
                                <a href="/api/meli/auth"
                                    className="inline-flex items-center gap-2 px-4 py-2 bg-[#FFE600] text-black text-xs font-bold rounded-lg hover:bg-[#FFD600] transition-all">
                                    <ExternalLink className="w-3.5 h-3.5" /> Conectar MercadoLibre
                                </a>
                            </>
                        )}
                    </IntegrationCard>
                </div>
            </div>

            {/* ── AI MAPPING CONFIG (existing) ── */}
            <div className="bg-card border border-card-border rounded-2xl p-6">
                <div className="flex items-center gap-3 mb-4">
                    <Brain className="w-5 h-5 text-purple-400" />
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Mapeo Inteligente con IA</h3>
                </div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div>
                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-1.5 block">Proveedor para Mapeo</label>
                        <select
                            value={settings.ai_provider || 'none'}
                            onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value as any })}
                            className="w-full bg-hover-bg border border-card-border rounded-xl px-3 py-2.5 text-xs focus:border-purple-500 outline-none"
                        >
                            <option value="none">Deshabilitado</option>
                            <option value="gemini">Google Gemini</option>
                            <option value="openai">OpenAI ChatGPT</option>
                        </select>
                        <p className="text-[9px] text-muted mt-1">Analiza nombres de campanas y sugiere el producto automaticamente.</p>
                    </div>
                    <div className="flex items-center justify-between p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                        <div>
                            <span className="text-xs font-bold block">Mapeo Automatico</span>
                            <span className="text-[9px] text-muted">Guardar mapeos con confianza &gt;80%</span>
                        </div>
                        <label className="relative inline-flex items-center cursor-pointer">
                            <input type="checkbox" checked={settings.ai_auto_map || false}
                                onChange={(e) => setSettings({ ...settings, ai_auto_map: e.target.checked })}
                                className="sr-only peer" />
                            <div className="w-10 h-5 bg-card-border rounded-full peer peer-checked:bg-purple-500 after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-5"></div>
                        </label>
                    </div>
                </div>
            </div>
        </div>
    );
}
