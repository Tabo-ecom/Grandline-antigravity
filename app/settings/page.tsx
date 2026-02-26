'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { Shield, RefreshCw, Save, Loader2, CheckCircle2, Brain, Sparkles, FlaskConical, Trash2, Link2, Unlink } from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import { fetchMetaAdAccounts } from '@/lib/services/meta';
import { fetchTikTokAdAccounts } from '@/lib/services/tiktok';
import { getAdSettings, saveAdSettings } from '@/lib/services/marketing';
import { authFetch } from '@/lib/api/client';
import { useSearchParams } from 'next/navigation';
import { auth as firebaseAuth } from '@/lib/firebase/config';

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
}

function SettingsPageContent() {
    const { user, effectiveUid } = useAuth();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);
    const [fbConnectMsg, setFbConnectMsg] = useState('');
    const [settings, setSettings] = useState<AdSettings>({
        fb_token: '',
        fb_account_ids: [],
        tt_token: '',
        tt_account_ids: [],
        ai_provider: 'none',
        ai_api_key: '',
        ai_auto_map: false,
    });

    const [fbAccounts, setFbAccounts] = useState<any[]>([]);
    const [ttAccounts, setTtAccounts] = useState<any[]>([]);
    const [fetchingFb, setFetchingFb] = useState(false);
    const [fetchingTt, setFetchingTt] = useState(false);

    // Demo seed state
    const [seeding, setSeeding] = useState(false);
    const [seedResult, setSeedResult] = useState<{ email: string; password: string; stats: any } | null>(null);
    const [seedError, setSeedError] = useState('');
    const [deleting, setDeleting] = useState(false);

    const loadSettings = async () => {
        try {
            const data = await getAdSettings(effectiveUid || '');
            if (data) setSettings(data);
        } catch (error) {
            console.error('Error loading settings:', error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        loadSettings();
    }, []);

    // Detect Facebook OAuth redirect result
    useEffect(() => {
        const fbStatus = searchParams.get('fb');
        if (fbStatus === 'connected') {
            setFbConnectMsg('Facebook conectado exitosamente');
            loadSettings(); // Reload to get new token/accounts
            setTimeout(() => setFbConnectMsg(''), 5000);
            // Clean URL
            window.history.replaceState({}, '', '/settings');
        } else if (fbStatus === 'denied') {
            setFbConnectMsg('Permisos de Facebook denegados');
            setTimeout(() => setFbConnectMsg(''), 5000);
            window.history.replaceState({}, '', '/settings');
        } else if (fbStatus === 'error') {
            const reason = searchParams.get('reason') || 'unknown';
            setFbConnectMsg(`Error al conectar Facebook: ${reason}`);
            setTimeout(() => setFbConnectMsg(''), 8000);
            window.history.replaceState({}, '', '/settings');
        }
    }, [searchParams]);

    const handleFetchFb = async () => {
        if (!settings.fb_token) return;
        setFetchingFb(true);
        try {
            const accounts = await fetchMetaAdAccounts(settings.fb_token);
            setFbAccounts(accounts);
        } catch (error) {
            alert('Error fetching Meta accounts: ' + (error as any).message);
        } finally {
            setFetchingFb(false);
        }
    };

    const handleFetchTt = async () => {
        if (!settings.tt_token) return;
        setFetchingTt(true);
        try {
            const accounts = await fetchTikTokAdAccounts(settings.tt_token);
            setTtAccounts(accounts);
        } catch (error) {
            alert('Error fetching TikTok accounts: ' + (error as any).message);
        } finally {
            setFetchingTt(false);
        }
    };

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!user) return;

        setSaving(true);
        setSuccess(false);
        try {
            await saveAdSettings(settings as any, effectiveUid || '');
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error saving settings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleConnectFacebook = async () => {
        // We need to pass the Firebase ID token via the redirect so the API can verify the user
        const token = await firebaseAuth.currentUser?.getIdToken();
        if (!token) {
            alert('Debes iniciar sesión primero');
            return;
        }
        // Navigate to the OAuth start endpoint with token in header via a form POST-like approach
        // Since we can't set headers on a redirect, we pass the token temporarily via a cookie
        document.cookie = `fb_auth_token=${token}; path=/; max-age=300; SameSite=Lax`;
        window.location.href = '/api/auth/facebook';
    };

    const handleDisconnectFacebook = () => {
        setSettings({ ...settings, fb_token: '', fb_account_ids: [] });
    };

    const fbConnected = !!(settings.fb_token && settings.fb_account_ids.length > 0);

    const handleSeedDemo = async () => {
        setSeeding(true);
        setSeedError('');
        setSeedResult(null);
        try {
            const res = await authFetch('/api/seed', { method: 'POST' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error creando cuenta demo');
            setSeedResult({ email: data.demo.email, password: data.demo.password, stats: data.demo.stats });
        } catch (err: any) {
            setSeedError(err.message || 'Error desconocido');
        } finally {
            setSeeding(false);
        }
    };

    const handleDeleteDemo = async () => {
        if (!confirm('¿Eliminar la cuenta demo y todos sus datos?')) return;
        setDeleting(true);
        setSeedError('');
        try {
            const res = await authFetch('/api/seed', { method: 'DELETE' });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || 'Error eliminando');
            setSeedResult(null);
            alert('Cuenta demo eliminada correctamente');
        } catch (err: any) {
            setSeedError(err.message || 'Error desconocido');
        } finally {
            setDeleting(false);
        }
    };

    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-muted font-mono text-xs uppercase tracking-widest">Sincronizando Brújula...</p>
            </div>
        );
    }

    return (
        <div className="space-y-8 max-w-4xl mx-auto">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight font-['Space_Grotesk']">Configuración</h1>
                    <p className="text-muted mt-1">Administra tus API Keys, roles de usuario y parámetros globales.</p>
                </div>
                {success && (
                    <div className="flex items-center gap-2 text-green-400 animate-in fade-in slide-in-from-right-4">
                        <CheckCircle2 className="w-5 h-5" />
                        <span className="text-xs font-bold uppercase tracking-widest">Cambios Guardados</span>
                    </div>
                )}
            </div>

            <form onSubmit={handleSave} className="space-y-8">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                    {/* Advertising settings */}
                    <div className="bg-card border border-card-border p-8 rounded-3xl space-y-6 relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-32 h-32 bg-accent/5 blur-3xl -mr-16 -mt-16 group-hover:bg-accent/10 transition-colors"></div>

                        <div className="flex items-center gap-3 text-accent">
                            <RefreshCw className="w-5 h-5" />
                            <h3 className="font-bold uppercase tracking-widest text-sm italic">Marketing APIs</h3>
                        </div>

                        <div className="space-y-4">
                            {/* Facebook Connection */}
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Meta (Facebook)</label>
                                {fbConnected ? (
                                    <div className="p-4 bg-green-500/5 border border-green-500/15 rounded-xl space-y-3">
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full bg-green-400 animate-pulse" />
                                                <span className="text-xs font-bold text-green-400 uppercase tracking-widest">Conectado</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <button
                                                    type="button"
                                                    onClick={handleConnectFacebook}
                                                    className="text-[10px] text-accent font-bold uppercase hover:underline"
                                                >
                                                    Reconectar
                                                </button>
                                                <button
                                                    type="button"
                                                    onClick={handleDisconnectFacebook}
                                                    className="text-[10px] text-red-400 font-bold uppercase hover:underline"
                                                >
                                                    Desconectar
                                                </button>
                                            </div>
                                        </div>
                                        <div className="text-[10px] text-muted">
                                            {settings.fb_account_ids.length} cuenta{settings.fb_account_ids.length !== 1 ? 's' : ''} publicitaria{settings.fb_account_ids.length !== 1 ? 's' : ''} vinculada{settings.fb_account_ids.length !== 1 ? 's' : ''}
                                        </div>
                                    </div>
                                ) : (
                                    <button
                                        type="button"
                                        onClick={handleConnectFacebook}
                                        className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-[#1877F2]/10 border border-[#1877F2]/20 rounded-xl text-[#1877F2] font-bold text-xs uppercase tracking-widest hover:bg-[#1877F2]/20 transition-all"
                                    >
                                        <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                                        Conectar con Facebook
                                    </button>
                                )}
                                {fbConnectMsg && (
                                    <div className={`mt-2 p-3 rounded-xl text-xs font-bold ${fbConnectMsg.includes('exitosamente') ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                                        {fbConnectMsg}
                                    </div>
                                )}
                            </div>

                            {/* Facebook Currency (only if connected) */}
                            {fbConnected && (
                                <div>
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Moneda Cuenta Meta</label>
                                    <select
                                        value={settings.fb_currency || 'USD'}
                                        onChange={(e) => setSettings({ ...settings, fb_currency: e.target.value })}
                                        className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-2 text-xs focus:border-accent outline-none transition-colors"
                                    >
                                        <option value="USD">Dólar (USD)</option>
                                        <option value="COP">Peso Colombiano (COP)</option>
                                    </select>
                                </div>
                            )}

                            {/* Facebook Account Selection (only if connected) */}
                            {fbConnected && (
                                <div>
                                    <div className="flex items-center justify-between mb-2">
                                        <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">Cuentas Publicitarias</label>
                                        <button
                                            type="button"
                                            onClick={handleFetchFb}
                                            disabled={!settings.fb_token || fetchingFb}
                                            className="text-[10px] text-accent font-bold uppercase hover:underline disabled:opacity-30"
                                        >
                                            {fetchingFb ? 'Buscando...' : 'Refrescar Cuentas'}
                                        </button>
                                    </div>
                                    <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-3 bg-hover-bg border border-card-border rounded-xl custom-scrollbar">
                                        {(() => {
                                            const accountMap = new Map();
                                            settings.fb_account_ids.forEach(a => accountMap.set(a.id, a));
                                            fbAccounts.forEach(acc => {
                                                const id = `act_${acc.account_id}`;
                                                accountMap.set(id, { id, name: acc.name });
                                            });
                                            return Array.from(accountMap.values()).map(acc => {
                                                const isSelected = settings.fb_account_ids.some(a => a.id === acc.id);
                                                return (
                                                    <label key={acc.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-orange-500/10 border border-orange-500/30' : 'hover:bg-hover-bg border border-transparent'}`}>
                                                        <input
                                                            type="checkbox"
                                                            checked={isSelected}
                                                            onChange={(e) => {
                                                                const newAccounts = e.target.checked
                                                                    ? [...settings.fb_account_ids, acc]
                                                                    : settings.fb_account_ids.filter(a => a.id !== acc.id);
                                                                setSettings({ ...settings, fb_account_ids: newAccounts });
                                                            }}
                                                            className="w-4 h-4 accent-orange-500"
                                                        />
                                                        <div className="flex flex-col">
                                                            <span className="text-[11px] font-bold text-foreground">{acc.name}</span>
                                                            <span className="text-[9px] text-muted font-mono">{acc.id}</span>
                                                        </div>
                                                    </label>
                                                );
                                            });
                                        })()}
                                        {fbAccounts.length === 0 && settings.fb_account_ids.length === 0 && (
                                            <div className="text-[10px] text-muted italic px-2 py-1">No se encontraron cuentas.</div>
                                        )}
                                    </div>
                                </div>
                            )}

                            <div className="h-px bg-card-border my-4"></div>

                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">TikTok Token</label>
                                <input
                                    type="password"
                                    value={settings.tt_token}
                                    onChange={(e) => setSettings({ ...settings, tt_token: e.target.value })}
                                    className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-3 text-sm focus:border-blue-500 outline-none transition-colors font-mono"
                                    placeholder="act..."
                                />
                            </div>
                            <div>
                                <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Moneda Cuenta TikTok</label>
                                <select
                                    value={settings.tt_currency || 'USD'}
                                    onChange={(e) => setSettings({ ...settings, tt_currency: e.target.value })}
                                    className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-2 text-xs focus:border-blue-500 outline-none transition-colors"
                                >
                                    <option value="USD">Dólar (USD)</option>
                                    <option value="COP">Peso Colombiano (COP)</option>
                                </select>
                            </div>

                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest block">TikTok Account ID</label>
                                    <button
                                        type="button"
                                        onClick={handleFetchTt}
                                        disabled={!settings.tt_token || fetchingTt}
                                        className="text-[10px] text-blue-400 font-bold uppercase hover:underline disabled:opacity-30"
                                    >
                                        {fetchingTt ? 'Buscando...' : 'Obtener Cuentas'}
                                    </button>
                                </div>
                                <div className="grid grid-cols-1 gap-2 max-h-40 overflow-y-auto p-3 bg-hover-bg border border-card-border rounded-xl custom-scrollbar">
                                    {(() => {
                                        const accountMap = new Map();
                                        settings.tt_account_ids.forEach(a => accountMap.set(a.id, a));
                                        ttAccounts.forEach(acc => {
                                            accountMap.set(acc.advertiser_id, { id: acc.advertiser_id, name: acc.advertiser_name });
                                        });
                                        return Array.from(accountMap.values()).map(acc => {
                                            const isSelected = settings.tt_account_ids.some(a => a.id === acc.id);
                                            return (
                                                <label key={acc.id} className={`flex items-center gap-3 p-2 rounded-lg cursor-pointer transition-colors ${isSelected ? 'bg-blue-500/10 border border-blue-500/30' : 'hover:bg-hover-bg border border-transparent'}`}>
                                                    <input
                                                        type="checkbox"
                                                        checked={isSelected}
                                                        onChange={(e) => {
                                                            const newAccounts = e.target.checked
                                                                ? [...settings.tt_account_ids, acc]
                                                                : settings.tt_account_ids.filter(a => a.id !== acc.id);
                                                            setSettings({ ...settings, tt_account_ids: newAccounts });
                                                        }}
                                                        className="w-4 h-4 accent-blue-500"
                                                    />
                                                    <div className="flex flex-col">
                                                        <span className="text-[11px] font-bold text-foreground">{acc.name}</span>
                                                        <span className="text-[9px] text-muted font-mono">{acc.id}</span>
                                                    </div>
                                                </label>
                                            );
                                        });
                                    })()}
                                    {ttAccounts.length === 0 && settings.tt_account_ids.length === 0 && (
                                        <div className="text-[10px] text-muted italic px-2 py-1">No se han cargado cuentas. Usa el botón &quot;Obtener Cuentas&quot;.</div>
                                    )}
                                </div>
                            </div>

                            <div className="h-px bg-card-border my-6"></div>

                            {/* AI Configuration Section */}
                            <div className="space-y-4">
                                <div className="flex items-center gap-3 text-purple-400">
                                    <Sparkles className="w-5 h-5" />
                                    <h3 className="font-bold uppercase tracking-widest text-sm italic">Mapeo Inteligente con IA</h3>
                                </div>

                                <div>
                                    <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">Proveedor de IA</label>
                                    <select
                                        value={settings.ai_provider || 'none'}
                                        onChange={(e) => setSettings({ ...settings, ai_provider: e.target.value as any })}
                                        className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none transition-colors"
                                    >
                                        <option value="none">Ninguno (Deshabilitado)</option>
                                        <option value="gemini">Google Gemini AI</option>
                                        <option value="openai">OpenAI ChatGPT</option>
                                    </select>
                                    <p className="text-[9px] text-muted mt-1 leading-relaxed">
                                        La IA analizará los nombres de campañas y sugerirá el producto más apropiado automáticamente.
                                    </p>
                                </div>

                                {settings.ai_provider && settings.ai_provider !== 'none' && (
                                    <>
                                        <div>
                                            <label className="text-[10px] font-bold text-muted uppercase tracking-widest mb-2 block">
                                                {settings.ai_provider === 'gemini' ? 'Gemini API Key' : 'OpenAI API Key'}
                                            </label>
                                            <input
                                                type="password"
                                                value={settings.ai_api_key || ''}
                                                onChange={(e) => setSettings({ ...settings, ai_api_key: e.target.value })}
                                                className="w-full bg-hover-bg border border-card-border rounded-xl px-4 py-3 text-sm focus:border-purple-500 outline-none transition-colors font-mono"
                                                placeholder={settings.ai_provider === 'gemini' ? 'AIzaSy...' : 'sk-...'}
                                            />
                                            <p className="text-[9px] text-muted mt-1 leading-relaxed">
                                                {settings.ai_provider === 'gemini'
                                                    ? 'Obtén tu API key en: https://makersuite.google.com/app/apikey'
                                                    : 'Obtén tu API key en: https://platform.openai.com/api-keys'
                                                }
                                            </p>
                                        </div>

                                        <div className="flex items-center justify-between p-4 bg-purple-500/5 border border-purple-500/10 rounded-xl">
                                            <div className="flex items-center gap-3">
                                                <Brain className="w-5 h-5 text-purple-400" />
                                                <div>
                                                    <span className="text-xs font-bold text-foreground/80 block">Mapeo Automático</span>
                                                    <span className="text-[9px] text-muted">Guardar automáticamente mapeos con alta confianza (&gt;80%)</span>
                                                </div>
                                            </div>
                                            <label className="relative inline-flex items-center cursor-pointer">
                                                <input
                                                    type="checkbox"
                                                    checked={settings.ai_auto_map || false}
                                                    onChange={(e) => setSettings({ ...settings, ai_auto_map: e.target.checked })}
                                                    className="sr-only peer"
                                                />
                                                <div className="w-11 h-6 bg-card-border peer-focus:outline-none peer-focus:ring-2 peer-focus:ring-purple-500 rounded-full peer peer-checked:after:translate-x-full rtl:peer-checked:after:-translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-purple-500"></div>
                                            </label>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column: Security & Save */}
                    <div className="space-y-8">
                        <div className="bg-card border border-card-border p-8 rounded-3xl space-y-6">
                            <div className="flex items-center gap-3 text-blue-400">
                                <Shield className="w-5 h-5" />
                                <h3 className="font-bold uppercase tracking-widest text-sm italic">Seguridad y Acceso</h3>
                            </div>
                            <p className="text-xs text-muted leading-relaxed">
                                Los tokens de acceso se almacenan de forma segura en Firestore. Solo los administradores de la flota tienen permiso para editar estas claves.
                            </p>
                            <div className="p-4 bg-blue-500/5 border border-blue-500/10 rounded-2xl">
                                <div className="flex items-center justify-between">
                                    <span className="text-xs font-bold text-foreground/80">Nivel de Almirante</span>
                                    <span className="px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded text-[10px] font-bold uppercase">Habilitado</span>
                                </div>
                            </div>
                        </div>

                        <div className="bg-accent p-8 rounded-3xl shadow-xl shadow-accent/10 flex flex-col items-center text-center justify-center gap-4">
                            <div className="w-16 h-16 rounded-full bg-white/20 flex items-center justify-center text-3xl">🎛️</div>
                            <h3 className="text-xl font-bold text-white">Consolidar Cambios</h3>
                            <p className="text-white/80 text-xs">Asegúrate de que los tokens sean válidos antes de guardar.</p>
                            <button
                                type="submit"
                                disabled={saving}
                                className="w-full bg-white text-accent font-bold py-3 rounded-xl hover:bg-gray-100 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                Guardar Configuración
                            </button>
                        </div>
                    </div>
                </div>
            </form>

            {/* Demo Account Section */}
            <div className="bg-card border border-card-border p-8 rounded-3xl space-y-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-cyan-500/5 blur-3xl -mr-16 -mt-16"></div>
                <div className="flex items-center gap-3 text-cyan-400">
                    <FlaskConical className="w-5 h-5" />
                    <h3 className="font-bold uppercase tracking-widest text-sm italic">Cuenta Demo</h3>
                </div>
                <p className="text-xs text-muted leading-relaxed">
                    Crea una cuenta de ejemplo con datos ficticios para tutoriales y demostraciones.
                    Genera 30 días de órdenes, publicidad, gastos y configuración completa.
                </p>

                <div className="flex items-center gap-3">
                    <button
                        type="button"
                        onClick={handleSeedDemo}
                        disabled={seeding}
                        className="px-6 py-3 bg-cyan-500/10 border border-cyan-500/20 text-cyan-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-cyan-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {seeding ? <Loader2 className="w-4 h-4 animate-spin" /> : <FlaskConical className="w-4 h-4" />}
                        {seeding ? 'Generando...' : 'Crear Cuenta Demo'}
                    </button>
                    <button
                        type="button"
                        onClick={handleDeleteDemo}
                        disabled={deleting}
                        className="px-6 py-3 bg-red-500/10 border border-red-500/20 text-red-400 font-bold text-xs uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all disabled:opacity-50 flex items-center gap-2"
                    >
                        {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
                        {deleting ? 'Eliminando...' : 'Eliminar Demo'}
                    </button>
                </div>

                {seedError && (
                    <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-xs text-red-400">
                        {seedError}
                    </div>
                )}

                {seedResult && (
                    <div className="p-4 bg-cyan-500/10 border border-cyan-500/20 rounded-xl space-y-3">
                        <div className="flex items-center gap-2 text-cyan-400">
                            <CheckCircle2 className="w-4 h-4" />
                            <span className="text-xs font-bold uppercase tracking-widest">Cuenta Demo Creada</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4 text-xs">
                            <div>
                                <span className="text-muted block text-[10px] uppercase tracking-widest mb-1">Email</span>
                                <span className="text-foreground font-mono">{seedResult.email}</span>
                            </div>
                            <div>
                                <span className="text-muted block text-[10px] uppercase tracking-widest mb-1">Password</span>
                                <span className="text-foreground font-mono">{seedResult.password}</span>
                            </div>
                        </div>
                        <div className="grid grid-cols-3 gap-3 mt-2">
                            <div className="p-2 bg-hover-bg rounded-lg text-center">
                                <span className="text-foreground font-bold text-sm block">{seedResult.stats.orders}</span>
                                <span className="text-muted text-[9px] uppercase tracking-widest">Órdenes</span>
                            </div>
                            <div className="p-2 bg-hover-bg rounded-lg text-center">
                                <span className="text-foreground font-bold text-sm block">{seedResult.stats.adEntries}</span>
                                <span className="text-muted text-[9px] uppercase tracking-widest">Ads</span>
                            </div>
                            <div className="p-2 bg-hover-bg rounded-lg text-center">
                                <span className="text-foreground font-bold text-sm block">{seedResult.stats.campaigns}</span>
                                <span className="text-muted text-[9px] uppercase tracking-widest">Campañas</span>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function SettingsPage() {
    return (
        <Suspense fallback={
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-accent animate-spin mb-4" />
                <p className="text-muted font-mono text-xs uppercase tracking-widest">Cargando...</p>
            </div>
        }>
            <SettingsPageContent />
        </Suspense>
    );
}
