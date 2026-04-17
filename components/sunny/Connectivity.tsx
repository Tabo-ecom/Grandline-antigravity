"use client";

import React, { useState, useEffect } from 'react';
import {
    Plus,
    Globe,
    Cpu,
    Trash2,
    DollarSign,
    RefreshCw,
    MapPinOff,
    X,
    Loader2,
    Link2,
    Unlink,
    Upload,
    CheckCircle,
    AlertCircle,
    Video
} from 'lucide-react';
import { useSunny, StoreProfile, ExclusionList } from '@/lib/context/SunnyContext';
import { getAdSettings } from '@/lib/services/marketing';
import { fetchMetaAdAccounts, fetchMetaPixels, fetchMetaPages, MetaTokenExpiredError } from '@/lib/services/meta';
import { getTikTokStatus, disconnectTikTok, initTikTokVideoUpload, checkTikTokPublishStatus } from '@/lib/services/tiktok';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';

export const Connectivity: React.FC = () => {
    const {
        storeProfiles,
        selectedStoreId,
        setSelectedStoreId,
        addStoreProfile,
        deleteStoreProfile,
        exclusionLists,
        addExclusionList,
        deleteExclusionList
    } = useSunny();
    const { effectiveUid } = useAuth();

    const [isAddingProfile, setIsAddingProfile] = useState(false);
    const [newProfile, setNewProfile] = useState<Partial<StoreProfile>>({
        name: '',
        country: 'Colombia',
        pixelId: '',
        pageId: '',
        ttPixelId: '',
        currency: 'COP',
        defaultAccountId: ''
    });

    // Facebook Assets State
    const [fbAdAccounts, setFbAdAccounts] = useState<any[]>([]);
    const [fbPixels, setFbPixels] = useState<any[]>([]);
    const [fbPages, setFbPages] = useState<any[]>([]);
    const [isLoadingMeta, setIsLoadingMeta] = useState(false);
    const [selectedAdAccountId, setSelectedAdAccountId] = useState('');

    // TikTok OAuth State
    const [tiktokStatus, setTiktokStatus] = useState<{
        connected: boolean; expired?: boolean; display_name?: string; avatar_url?: string;
    }>({ connected: false });
    const [tiktokLoading, setTiktokLoading] = useState(true);
    const [disconnecting, setDisconnecting] = useState(false);

    // TikTok Video Upload State
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [uploadStatus, setUploadStatus] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
    const [uploadMessage, setUploadMessage] = useState('');

    // Load TikTok status on mount
    useEffect(() => {
        loadTikTokStatus();
    }, []);

    // Check URL params for TikTok connection result
    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        if (params.get('tiktok_connected') === 'true') {
            loadTikTokStatus();
            // Clean URL
            window.history.replaceState({}, '', window.location.pathname);
        }
        if (params.get('tiktok_error')) {
            setUploadMessage(`Error de conexión: ${params.get('tiktok_error')}`);
            setUploadStatus('error');
            window.history.replaceState({}, '', window.location.pathname);
        }
    }, []);

    const loadTikTokStatus = async () => {
        setTiktokLoading(true);
        const status = await getTikTokStatus(authFetch);
        setTiktokStatus(status);
        setTiktokLoading(false);
    };

    const handleConnectTikTok = async () => {
        try {
            const res = await authFetch('/api/auth/tiktok/url');
            const data = await res.json();
            if (data.url) window.location.href = data.url;
        } catch (e) { console.error('Error getting TikTok OAuth URL:', e); }
    };

    const handleDisconnectTikTok = async () => {
        if (!confirm('¿Desconectar tu cuenta de TikTok?')) return;
        setDisconnecting(true);
        await disconnectTikTok(authFetch);
        setTiktokStatus({ connected: false });
        setDisconnecting(false);
        setVideoFile(null);
        setUploadStatus('idle');
    };

    const handleVideoUpload = async () => {
        if (!videoFile) return;
        setUploading(true);
        setUploadStatus('uploading');
        setUploadMessage('Iniciando subida a TikTok...');

        try {
            // Step 1: Init upload — get upload URL
            const initResult = await initTikTokVideoUpload(authFetch, videoFile.size);
            if (!initResult?.upload_url) {
                throw new Error('No se pudo iniciar la subida');
            }

            setUploadMessage('Subiendo video...');

            // Step 2: Upload file directly to TikTok's upload URL
            const uploadRes = await fetch(initResult.upload_url, {
                method: 'PUT',
                headers: {
                    'Content-Type': 'video/mp4',
                    'Content-Range': `bytes 0-${videoFile.size - 1}/${videoFile.size}`,
                },
                body: videoFile,
            });

            if (!uploadRes.ok) throw new Error('Error subiendo video');

            setUploadMessage('Video enviado como borrador. Revísalo en TikTok para publicar.');
            setUploadStatus('success');
            setVideoFile(null);
        } catch (err: any) {
            setUploadMessage(err.message || 'Error en la subida');
            setUploadStatus('error');
        } finally {
            setUploading(false);
        }
    };

    // Exclusion Lists State
    const [isAddingExclusion, setIsAddingExclusion] = useState(false);
    const [newExclusion, setNewExclusion] = useState<Partial<ExclusionList>>({
        name: '',
        locations: '',
        country: 'Colombia'
    });

    const loadMetaAssets = async () => {
        setIsLoadingMeta(true);
        try {
            const settings = await getAdSettings(effectiveUid || '');
            if (settings?.fb_token) {
                const [accounts, pages] = await Promise.all([
                    fetchMetaAdAccounts(settings.fb_token),
                    fetchMetaPages(settings.fb_token)
                ]);
                setFbAdAccounts(accounts);
                setFbPages(pages);
            }
        } catch (error) {
            if (error instanceof MetaTokenExpiredError) {
                alert(error.message);
            } else {
                console.error('Error loading Meta assets:', error);
            }
        } finally {
            setIsLoadingMeta(false);
        }
    };

    const loadPixels = async (accountId: string) => {
        const settings = await getAdSettings(effectiveUid || '');
        if (settings?.fb_token && accountId) {
            const pixels = await fetchMetaPixels(settings.fb_token, accountId);
            setFbPixels(pixels);
        }
    };

    React.useEffect(() => {
        if (isAddingProfile) {
            loadMetaAssets();
        }
    }, [isAddingProfile]);

    React.useEffect(() => {
        if (selectedAdAccountId) {
            loadPixels(selectedAdAccountId);
        }
    }, [selectedAdAccountId]);

    const handleAddStore = async () => {
        if (!newProfile.name) return;
        await addStoreProfile({
            ...newProfile,
            defaultAccountId: selectedAdAccountId
        } as Omit<StoreProfile, 'id'>);
        setIsAddingProfile(false);
        setNewProfile({ name: '', country: 'Colombia', pixelId: '', pageId: '', ttPixelId: '', currency: 'COP', defaultAccountId: '' });
        setSelectedAdAccountId('');
        setFbPixels([]);
    };

    return (
        <div className="p-6 md:p-8 space-y-12 relative animate-in fade-in slide-in-from-bottom-4 duration-700">
            {/* Zone 1: Store Profiles */}
            <section className="space-y-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-foreground flex items-center gap-2">
                            <Cpu className="w-6 h-6 text-accent" />
                            Perfiles de Tienda <span className="text-muted font-mono text-sm not-italic ml-2">(Store Logic)</span>
                        </h2>
                        <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Configuración pre-guardada por país y marca</p>
                    </div>
                    <button
                        onClick={() => setIsAddingProfile(true)}
                        className="px-4 py-2 bg-accent/10 border border-accent/30 hover:bg-accent hover:text-white transition-all rounded-xl flex items-center gap-2 text-xs font-black uppercase italic tracking-tighter text-accent"
                    >
                        <Plus className="w-4 h-4" />
                        Nuevo Perfil
                    </button>
                </div>

                <div className="flex gap-4 overflow-x-auto pb-4 scrollbar-hide">
                    {storeProfiles.map((profile) => (
                        <div
                            key={profile.id}
                            onClick={() => setSelectedStoreId(profile.id)}
                            className={`min-w-[300px] p-5 rounded-2xl border transition-all cursor-pointer group relative overflow-hidden ${selectedStoreId === profile.id
                                ? 'bg-accent/10 border-accent/50'
                                : 'bg-card border-card-border hover:border-accent/20'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-4 relative z-10">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-accent block mb-1">{profile.country}</span>
                                    <h3 className="text-lg font-black uppercase text-foreground tracking-tighter italic">{profile.name}</h3>
                                </div>
                                <button
                                    onClick={(e) => { e.stopPropagation(); deleteStoreProfile(profile.id); }}
                                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-3 relative z-10">
                                <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-muted uppercase">Pixel ID</span>
                                    <span className="text-foreground font-bold">{profile.pixelId || '—'}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-muted uppercase">Page ID</span>
                                    <span className="text-foreground font-bold">{profile.pageId || '—'}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-muted uppercase">TT Pixel</span>
                                    <span className="text-pink-400 font-bold">{profile.ttPixelId || '—'}</span>
                                </div>
                                <div className="flex justify-between text-[10px] font-mono">
                                    <span className="text-muted uppercase">Default Acc</span>
                                    <span className="text-blue-400 font-bold">{profile.defaultAccountId || 'NO LINKED'}</span>
                                </div>
                            </div>
                        </div>
                    ))}

                </div>

                {/* Modal: Nuevo Perfil de Tienda */}
                {isAddingProfile && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm animate-in fade-in duration-200" onClick={() => setIsAddingProfile(false)}>
                        <div className="w-full max-w-md mx-4 p-6 rounded-2xl border border-accent/30 bg-card shadow-2xl animate-in zoom-in-95 duration-200" onClick={e => e.stopPropagation()}>
                            <div className="flex justify-between items-center mb-5">
                                <h4 className="text-sm font-black uppercase italic text-accent tracking-tighter">Configurar Nuevo Perfil</h4>
                                <button onClick={() => setIsAddingProfile(false)} className="p-1.5 hover:bg-background rounded-lg transition-colors text-muted hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                            <div className="space-y-3">
                                <input
                                    placeholder="Nombre de Tienda/Marca"
                                    className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:border-accent/50 outline-none"
                                    value={newProfile.name}
                                    onChange={e => setNewProfile({ ...newProfile, name: e.target.value })}
                                />
                                <div className="grid grid-cols-2 gap-2">
                                    <select
                                        className="bg-background border border-card-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:border-accent/50 outline-none"
                                        value={newProfile.country}
                                        onChange={e => setNewProfile({ ...newProfile, country: e.target.value })}
                                    >
                                        <option value="Colombia">Colombia</option>
                                        <option value="Ecuador">Ecuador</option>
                                        <option value="Panamá">Panamá</option>
                                        <option value="Guatemala">Guatemala</option>
                                    </select>
                                    <select
                                        className="bg-background border border-card-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:border-accent/50 outline-none"
                                        value={newProfile.currency}
                                        onChange={e => setNewProfile({ ...newProfile, currency: e.target.value })}
                                    >
                                        <option value="COP">COP</option>
                                        <option value="USD">USD</option>
                                        <option value="GTQ">GTQ</option>
                                    </select>
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Meta Ad Account</label>
                                    <div className="relative">
                                        <select
                                            className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:border-accent/50 outline-none"
                                            value={selectedAdAccountId}
                                            onChange={e => setSelectedAdAccountId(e.target.value)}
                                            disabled={isLoadingMeta}
                                        >
                                            <option value="">Seleccionar Cuenta...</option>
                                            {fbAdAccounts.map(acc => (
                                                <option key={acc.id} value={acc.id}>{acc.name}</option>
                                            ))}
                                        </select>
                                        {isLoadingMeta && <Loader2 className="absolute right-8 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-accent animate-spin" />}
                                    </div>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Meta Pixel</label>
                                    <select
                                        className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:border-accent/50 outline-none"
                                        value={newProfile.pixelId}
                                        onChange={e => setNewProfile({ ...newProfile, pixelId: e.target.value })}
                                        disabled={!selectedAdAccountId}
                                    >
                                        <option value="">{selectedAdAccountId ? 'Seleccionar Pixel...' : 'Primero elige cuenta'}</option>
                                        {fbPixels.map(pixel => (
                                            <option key={pixel.id} value={pixel.id}>{pixel.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Meta Page</label>
                                    <select
                                        className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:border-accent/50 outline-none"
                                        value={newProfile.pageId}
                                        onChange={e => setNewProfile({ ...newProfile, pageId: e.target.value })}
                                        disabled={isLoadingMeta}
                                    >
                                        <option value="">Seleccionar Página...</option>
                                        {fbPages.map(page => (
                                            <option key={page.id} value={page.id}>{page.name}</option>
                                        ))}
                                    </select>
                                </div>

                                <div className="border-t border-card-border pt-3 mt-3">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-pink-400 ml-1 mb-2 block">TikTok Pixel ID</label>
                                    <input
                                        placeholder="TikTok Pixel ID (opcional)"
                                        className="w-full bg-background border border-card-border rounded-lg px-3 py-2.5 text-xs text-foreground focus:border-pink-500/50 outline-none"
                                        value={newProfile.ttPixelId || ''}
                                        onChange={e => setNewProfile({ ...newProfile, ttPixelId: e.target.value })}
                                    />
                                </div>

                                <div className="flex gap-2 pt-3">
                                    <button
                                        onClick={handleAddStore}
                                        className="flex-1 py-2.5 bg-accent text-white font-black uppercase text-[10px] rounded-lg hover:bg-accent/90 transition-colors"
                                    >
                                        Guardar Perfil
                                    </button>
                                    <button
                                        onClick={() => setIsAddingProfile(false)}
                                        className="px-4 py-2.5 bg-card text-muted font-bold uppercase text-[10px] rounded-lg border border-card-border hover:border-muted/30 transition-colors"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </section>

            {/* Zone 2: TikTok Integration */}
            <section className="space-y-6">
                <div>
                    <h2 className="text-2xl font-black italic uppercase tracking-tighter text-foreground flex items-center gap-2">
                        <svg className="w-6 h-6" viewBox="0 0 24 24" fill="currentColor">
                            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-2.88 2.5 2.89 2.89 0 01-2.88-2.88 2.89 2.89 0 012.88-2.88c.28 0 .56.04.82.11v-3.49a6.37 6.37 0 00-.82-.05A6.34 6.34 0 003.15 15.2a6.34 6.34 0 006.34 6.34 6.34 6.34 0 006.34-6.34V9.13a8.16 8.16 0 004.76 1.52v-3.4a4.85 4.85 0 01-1-.56z"/>
                        </svg>
                        TikTok Connect <span className="text-muted font-mono text-sm not-italic ml-2">(Content Posting)</span>
                    </h2>
                    <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Conecta tu cuenta para subir borradores de video</p>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                    {/* Connection Card */}
                    <div className="p-6 bg-card border border-card-border rounded-[2rem] space-y-5 relative overflow-hidden">
                        <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Estado de Conexión</span>
                            {tiktokLoading ? (
                                <Loader2 className="w-4 h-4 text-muted animate-spin" />
                            ) : tiktokStatus.connected ? (
                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-emerald-400">
                                    <CheckCircle className="w-3.5 h-3.5" /> Conectado
                                </span>
                            ) : (
                                <span className="flex items-center gap-1.5 text-[10px] font-black uppercase text-muted">
                                    <AlertCircle className="w-3.5 h-3.5" /> No conectado
                                </span>
                            )}
                        </div>

                        {tiktokStatus.connected ? (
                            <>
                                <div className="flex items-center gap-4 p-4 bg-background rounded-2xl border border-card-border">
                                    {tiktokStatus.avatar_url ? (
                                        <img src={tiktokStatus.avatar_url} alt="TikTok" className="w-12 h-12 rounded-full border-2 border-accent/30" />
                                    ) : (
                                        <div className="w-12 h-12 rounded-full bg-accent/20 border-2 border-accent/30 flex items-center justify-center">
                                            <span className="text-lg font-black text-accent">TT</span>
                                        </div>
                                    )}
                                    <div>
                                        <p className="text-sm font-black text-foreground">{tiktokStatus.display_name || 'Usuario TikTok'}</p>
                                        <p className="text-[10px] font-mono text-muted uppercase tracking-wider">Cuenta conectada</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handleDisconnectTikTok}
                                    disabled={disconnecting}
                                    className="w-full py-3 bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-red-500 flex items-center justify-center gap-2"
                                >
                                    {disconnecting ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlink className="w-3.5 h-3.5" />}
                                    Desconectar TikTok
                                </button>
                            </>
                        ) : (
                            <button
                                onClick={handleConnectTikTok}
                                disabled={tiktokLoading}
                                className="w-full py-4 bg-foreground text-background font-black uppercase text-xs rounded-2xl hover:opacity-90 transition-all flex items-center justify-center gap-2 tracking-wider"
                            >
                                <Link2 className="w-4 h-4" />
                                Conectar TikTok
                            </button>
                        )}

                        {tiktokStatus.expired && (
                            <div className="p-3 bg-amber-500/10 border border-amber-500/30 rounded-xl">
                                <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Token expirado — reconecta tu cuenta</p>
                            </div>
                        )}
                    </div>

                    {/* Video Upload Card */}
                    <div className={`p-6 bg-card border border-card-border rounded-[2rem] space-y-5 relative overflow-hidden ${!tiktokStatus.connected ? 'opacity-50 pointer-events-none' : ''}`}>
                        <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Subir Video como Borrador</span>

                        <div
                            className="relative p-8 border-2 border-dashed border-card-border rounded-2xl text-center hover:border-accent/40 transition-all cursor-pointer group"
                            onClick={() => document.getElementById('tiktok-video-input')?.click()}
                        >
                            <input
                                id="tiktok-video-input"
                                type="file"
                                accept="video/mp4,video/quicktime"
                                className="hidden"
                                onChange={(e) => {
                                    const file = e.target.files?.[0];
                                    if (file) {
                                        setVideoFile(file);
                                        setUploadStatus('idle');
                                        setUploadMessage('');
                                    }
                                }}
                            />
                            {videoFile ? (
                                <div className="space-y-2">
                                    <Video className="w-8 h-8 text-accent mx-auto" />
                                    <p className="text-xs font-bold text-foreground">{videoFile.name}</p>
                                    <p className="text-[10px] text-muted font-mono">{(videoFile.size / (1024 * 1024)).toFixed(1)} MB</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    <Upload className="w-8 h-8 text-muted mx-auto group-hover:text-accent transition-colors" />
                                    <p className="text-xs font-bold text-muted group-hover:text-foreground transition-colors">Seleccionar Video</p>
                                    <p className="text-[10px] text-muted">MP4 o MOV</p>
                                </div>
                            )}
                        </div>

                        <button
                            onClick={handleVideoUpload}
                            disabled={!videoFile || uploading}
                            className="w-full py-3 bg-accent text-white font-black uppercase text-[10px] rounded-2xl hover:bg-accent/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2 tracking-wider"
                        >
                            {uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                            {uploading ? 'Subiendo...' : 'Subir como Borrador a TikTok'}
                        </button>

                        {uploadMessage && (
                            <div className={`p-3 rounded-xl border ${
                                uploadStatus === 'success' ? 'bg-emerald-500/10 border-emerald-500/30' :
                                uploadStatus === 'error' ? 'bg-red-500/10 border-red-500/30' :
                                'bg-accent/10 border-accent/30'
                            }`}>
                                <p className={`text-[10px] font-bold uppercase tracking-wider ${
                                    uploadStatus === 'success' ? 'text-emerald-400' :
                                    uploadStatus === 'error' ? 'text-red-500' :
                                    'text-accent'
                                }`}>
                                    {uploadMessage}
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </section>

            {/* Zone 3: Currency & TRM */}
            <section className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                <div className="space-y-6">
                    <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-foreground flex items-center gap-2">
                            <DollarSign className="w-6 h-6 text-emerald-400" />
                            TRM Engine
                        </h2>
                        <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Global Currency Normalization</p>
                    </div>

                    <div className="p-6 bg-card border border-card-border rounded-[2rem] space-y-6 relative overflow-hidden group">
                        <div className="space-y-1">
                            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-muted">Tasa del Día (USD/COP)</p>
                            <div className="flex items-baseline gap-2">
                                <span className="text-4xl font-black italic tracking-tighter text-foreground font-mono">$4,200</span>
                                <span className="text-xs font-bold text-muted uppercase">Fixed</span>
                            </div>
                        </div>

                        <div className="p-4 bg-background rounded-2xl border border-card-border group-hover:border-emerald-500/30 transition-all">
                            <div className="flex justify-between items-center mb-4">
                                <span className="text-[10px] font-black uppercase tracking-widest text-emerald-500 flex items-center gap-2">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                    Conversión Automática
                                </span>
                                <div className="w-8 h-4 bg-emerald-500 rounded-full flex items-center justify-end px-1">
                                    <div className="w-2.5 h-2.5 bg-white rounded-full shadow-lg" />
                                </div>
                            </div>
                            <p className="text-[10px] leading-relaxed text-muted font-medium">
                                El sistema normalizará automáticamente el gasto de publicidad en USD a COP usando la TRM actual para todos los reportes de profit.
                            </p>
                        </div>

                        <button className="w-full py-3 bg-background border border-card-border hover:border-emerald-500/50 hover:bg-emerald-500/10 transition-all rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] text-foreground">
                            Actualizar TRM Manual
                        </button>
                    </div>
                </div>
            </section>

            {/* Zone 4: Exclusion Lists */}
            <section className="space-y-6">
                <div className="flex justify-between items-end">
                    <div>
                        <h2 className="text-2xl font-black italic uppercase tracking-tighter text-foreground flex items-center gap-2">
                            <MapPinOff className="w-6 h-6 text-red-500" />
                            Listas de Exclusión <span className="text-muted font-mono text-sm not-italic ml-2">(Zonas Rojas)</span>
                        </h2>
                        <p className="text-muted text-xs font-bold uppercase tracking-widest mt-1">Crea listas de ciudades o códigos postales para excluir del Lanzador</p>
                    </div>
                    <button
                        onClick={() => setIsAddingExclusion(true)}
                        className="px-4 py-2 bg-red-500/10 border border-red-500/30 hover:bg-red-500 hover:text-white transition-all rounded-xl flex items-center gap-2 text-xs font-black uppercase italic tracking-tighter text-red-500"
                    >
                        <Plus className="w-4 h-4" />
                        Nueva Lista
                    </button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {exclusionLists.map((list) => (
                        <div
                            key={list.id}
                            className="p-6 bg-card border border-card-border rounded-3xl group relative overflow-hidden hover:border-red-500/30 transition-all"
                        >
                            <div className="flex justify-between items-start mb-4">
                                <div>
                                    <span className="text-[10px] font-black uppercase tracking-widest text-red-500 block mb-1">{list.country}</span>
                                    <h3 className="text-lg font-black uppercase text-foreground tracking-tighter italic">{list.name}</h3>
                                </div>
                                <button
                                    onClick={() => deleteExclusionList(list.id)}
                                    className="p-2 opacity-0 group-hover:opacity-100 hover:bg-red-500/20 text-red-500 rounded-lg transition-all"
                                >
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                            <p className="text-[10px] font-medium text-muted line-clamp-2 uppercase tracking-tight">
                                {list.locations || 'Sin ubicaciones definidas'}
                            </p>
                            <div className="mt-4 flex items-center gap-2 text-[10px] font-mono text-muted">
                                <MapPinOff className="w-3 h-3" />
                                <span>{list.locations.split(',').filter(l => l.trim()).length} Ubicaciones</span>
                            </div>
                        </div>
                    ))}

                    {isAddingExclusion && (
                        <div className="p-6 bg-card border border-red-500/30 rounded-3xl animate-in zoom-in-95 duration-200">
                            <h4 className="text-xs font-black uppercase italic text-red-500 mb-4">Nueva Lista de Exclusión</h4>
                            <div className="space-y-4">
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Nombre de la Lista</label>
                                    <input
                                        placeholder="Ej: Zonas Rojas Medellín"
                                        className="w-full bg-background border border-card-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-red-500/50 outline-none"
                                        value={newExclusion.name}
                                        onChange={e => setNewExclusion({ ...newExclusion, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-1">
                                    <label className="text-[10px] font-black uppercase tracking-widest text-muted ml-1">Ubicaciones (Separadas por coma)</label>
                                    <textarea
                                        placeholder="Ej: 050001, 050002, Bello, Itagüí..."
                                        className="w-full bg-background border border-card-border rounded-xl px-3 py-2 text-xs text-foreground focus:border-red-500/50 outline-none min-h-[100px] resize-none"
                                        value={newExclusion.locations}
                                        onChange={e => setNewExclusion({ ...newExclusion, locations: e.target.value })}
                                    />
                                </div>
                                <div className="flex gap-2 pt-2">
                                    <button
                                        onClick={async () => {
                                            if (!newExclusion.name) return;
                                            await addExclusionList(newExclusion as Omit<ExclusionList, 'id'>);
                                            setIsAddingExclusion(false);
                                            setNewExclusion({ name: '', locations: '', country: 'Colombia' });
                                        }}
                                        className="flex-1 py-2 bg-red-500 text-white font-black uppercase text-[10px] rounded-lg"
                                    >
                                        Guardar Lista
                                    </button>
                                    <button
                                        onClick={() => setIsAddingExclusion(false)}
                                        className="px-3 py-2 bg-card text-muted font-bold uppercase text-[10px] rounded-lg border border-card-border"
                                    >
                                        Cancelar
                                    </button>
                                </div>
                            </div>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
};
