'use client';

import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
    Loader2, Upload, Image as ImageIcon, FileText, Rocket, Download,
    CheckCircle2, XCircle, AlertCircle, ExternalLink, Sparkles, Copy, X
} from 'lucide-react';
import { useAuth } from '@/lib/context/AuthContext';
import {
    PipelineStore, Niche, Provider, CreativeFormat, JobPoll, CopyResult,
    NICHES, PROVIDERS,
    getStores, startCreatives, startPipeline, startCopy, startImages,
    pollJob, getFileUrl, fileToBase64,
} from '@/lib/services/pipeline';
import { VegaResearch, getVegaResearchList } from '@/lib/services/vega';

// ── Job Polling Hook ────────────────────────────────────────────────────────
function useJobPolling(jobId: string | null) {
    const [job, setJob] = useState<JobPoll | null>(null);
    const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

    useEffect(() => {
        if (!jobId) { setJob(null); return; }
        setJob({ job_id: jobId, status: 'pending', job_type: '', progress: 'Iniciando...', result: null, error: null, files: null, created_at: '', completed_at: null });

        intervalRef.current = setInterval(async () => {
            try {
                const data = await pollJob(jobId);
                setJob(data);
                if (data.status === 'completed' || data.status === 'failed') {
                    if (intervalRef.current) clearInterval(intervalRef.current);
                }
            } catch { /* ignore polling errors */ }
        }, 4000);

        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [jobId]);

    return job;
}

// ── Image Uploader ──────────────────────────────────────────────────────────
function ImageUploader({ onUpload, preview, onClear }: {
    onUpload: (base64: string, filename: string) => void;
    preview: string | null;
    onClear: () => void;
}) {
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = async (file: File) => {
        const base64 = await fileToBase64(file);
        onUpload(base64, file.name);
    };

    return (
        <div className="relative">
            {preview ? (
                <div className="relative rounded-xl overflow-hidden border border-card-border">
                    <img src={`data:image/png;base64,${preview}`} alt="Preview" className="w-full h-48 object-contain bg-background" />
                    <button onClick={onClear} className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-background/80 backdrop-blur-sm border border-card-border flex items-center justify-center text-muted hover:text-red-400 transition-all">
                        <X className="w-4 h-4" />
                    </button>
                </div>
            ) : (
                <div
                    className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-accent/50 bg-accent/5' : 'border-card-border hover:border-accent/30'}`}
                    onClick={() => inputRef.current?.click()}
                    onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                >
                    <Upload className="w-8 h-8 mx-auto mb-2 text-muted/30" />
                    <p className="text-sm text-muted">Arrastra una imagen o <span className="text-accent">haz click</span></p>
                    <p className="text-[10px] text-muted/40 mt-1">PNG, JPG, WEBP</p>
                </div>
            )}
            <input ref={inputRef} type="file" accept="image/*" className="hidden" onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />
        </div>
    );
}

// ── Niche Selector ──────────────────────────────────────────────────────────
function NicheSelector({ value, onChange }: { value: Niche; onChange: (n: Niche) => void }) {
    return (
        <div className="grid grid-cols-2 gap-2">
            {NICHES.map(n => (
                <button key={n.value} onClick={() => onChange(n.value)}
                    className={`p-3 rounded-xl border text-left transition-all ${value === n.value ? 'bg-accent/10 border-accent/30 text-accent' : 'border-card-border text-muted hover:border-accent/20'}`}>
                    <div className="text-[12px] font-bold">{n.label}</div>
                    <div className="text-[10px] opacity-60">{n.desc}</div>
                </button>
            ))}
        </div>
    );
}

// ── Job Progress ────────────────────────────────────────────────────────────
function JobProgress({ job }: { job: JobPoll | null }) {
    if (!job) return null;
    const isRunning = job.status === 'pending' || job.status === 'running';
    const isDone = job.status === 'completed';
    const isFailed = job.status === 'failed';

    // Parse progress like "5/20 creativos generados" or "Paso 1/10: ..."
    let pct = 0;
    const progressLabel = job.progress || '';
    const match = progressLabel.match(/(\d+)\/(\d+)/);
    if (match) {
        const current = parseInt(match[1]);
        const total = parseInt(match[2]);
        pct = total > 0 ? Math.round((current / total) * 100) : 0;
    } else if (isRunning && job.status === 'running') {
        pct = 5;
    }
    if (isDone) pct = 100;

    // Elapsed time
    const [elapsed, setElapsed] = useState(0);
    useEffect(() => {
        if (!isRunning) return;
        const start = Date.now();
        const timer = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000);
        return () => clearInterval(timer);
    }, [isRunning]);

    const elapsedStr = elapsed > 0 && isRunning ? `${Math.floor(elapsed / 60)}:${String(elapsed % 60).padStart(2, '0')}` : '';

    return (
        <div className={`rounded-xl border p-4 ${isDone ? 'border-emerald-500/20 bg-emerald-500/5' : isFailed ? 'border-red-500/20 bg-red-500/5' : 'border-accent/20 bg-accent/5'}`}>
            <div className="flex items-center gap-3 mb-2">
                {isRunning && <Loader2 className="w-5 h-5 animate-spin text-accent shrink-0" />}
                {isDone && <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0" />}
                {isFailed && <XCircle className="w-5 h-5 text-red-400 shrink-0" />}
                <div className="flex-1">
                    <div className="flex items-center justify-between">
                        <span className="text-sm font-semibold">
                            {isRunning ? 'Procesando...' : isDone ? 'Completado' : 'Error'}
                        </span>
                        <div className="flex items-center gap-2">
                            {elapsedStr && <span className="font-mono text-[10px] text-muted">{elapsedStr}</span>}
                            {(isRunning || isDone) && <span className="font-mono text-[11px] font-bold" style={{ color: isDone ? '#00FF88' : '#d75c33' }}>{pct}%</span>}
                        </div>
                    </div>
                    <div className="text-[11px] text-muted mt-0.5">{job.progress || job.error || 'Esperando en cola...'}</div>
                </div>
            </div>
            {/* Progress bar */}
            {(isRunning || isDone) && (
                <div className="h-2 bg-card-border/30 rounded-full overflow-hidden">
                    <div
                        className="h-full rounded-full transition-all duration-700 ease-out"
                        style={{
                            width: `${pct}%`,
                            background: isDone ? '#00FF88' : 'linear-gradient(90deg, #d75c33, #ff8855)',
                            boxShadow: isDone ? '0 0 8px rgba(0,255,136,0.4)' : '0 0 8px rgba(215,92,51,0.4)',
                        }}
                    />
                </div>
            )}
            {/* Result summary */}
            {isDone && job.result && (
                <div className="mt-3 flex items-center gap-4 text-[11px]">
                    {job.result.successful !== undefined && (
                        <span className="text-emerald-400 font-semibold">{job.result.successful} exitosos</span>
                    )}
                    {job.result.failed > 0 && (
                        <span className="text-red-400 font-semibold">{job.result.failed} fallidos</span>
                    )}
                    {job.completed_at && job.created_at && (
                        <span className="text-muted font-mono">
                            {Math.round((new Date(job.completed_at).getTime() - new Date(job.created_at).getTime()) / 1000)}s total
                        </span>
                    )}
                </div>
            )}
        </div>
    );
}

// ── Asset Grid ──────────────────────────────────────────────────────────────
function AssetGrid({ jobId, files }: { jobId: string; files: string[] }) {
    if (!files || files.length === 0) return null;
    const imageFiles = files.filter(f => /\.(png|jpg|jpeg|webp)$/i.test(f));
    const [downloading, setDownloading] = useState(false);

    const downloadFile = async (file: string) => {
        const url = getFileUrl(jobId, file);
        const res = await fetch(url);
        const blob = await res.blob();
        const a = document.createElement('a');
        a.href = URL.createObjectURL(blob);
        a.download = file.split('/').pop() || 'image.png';
        a.click();
        URL.revokeObjectURL(a.href);
    };

    const downloadAll = async () => {
        setDownloading(true);
        for (const file of imageFiles) {
            await downloadFile(file);
            await new Promise(r => setTimeout(r, 300)); // Small delay between downloads
        }
        setDownloading(false);
    };

    return (
        <div className="mt-4">
            <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-bold uppercase tracking-widest text-muted">{imageFiles.length} imágenes generadas</span>
                <button onClick={downloadAll} disabled={downloading}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-accent hover:bg-orange-600 disabled:bg-muted/10 disabled:text-muted/40 text-white rounded-lg text-[11px] font-bold transition-all">
                    {downloading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Download className="w-3.5 h-3.5" />}
                    {downloading ? 'Descargando...' : 'Descargar Todos'}
                </button>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {imageFiles.map((file, i) => (
                    <div key={i} className="group relative rounded-xl overflow-hidden border border-card-border bg-background">
                        <img src={getFileUrl(jobId, file)} alt={file.split('/').pop() || ''} className="w-full h-40 object-contain" loading="lazy" />
                        <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                            <button onClick={() => downloadFile(file)}
                                className="w-8 h-8 rounded-lg bg-white/10 backdrop-blur-sm flex items-center justify-center text-white hover:bg-white/20 transition-all">
                                <Download className="w-4 h-4" />
                            </button>
                        </div>
                        <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-2">
                            <div className="text-[9px] text-white/60 truncate">{file.split('/').pop()}</div>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── Copy Viewer ─────────────────────────────────────────────────────────────
function CopyViewer({ copy }: { copy: CopyResult }) {
    return (
        <div className="space-y-4 mt-4">
            <div className="bg-card border border-card-border rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Título</div>
                <div className="text-lg font-bold">{copy.title}</div>
                {copy.tagline && <div className="text-sm text-accent mt-1">{copy.tagline}</div>}
            </div>
            <div className="bg-card border border-card-border rounded-xl p-4">
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Descripción Corta</div>
                <div className="text-sm text-muted leading-relaxed">{copy.short_description}</div>
            </div>
            {copy.key_benefits && copy.key_benefits.length > 0 && (
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">Beneficios Clave</div>
                    <ul className="space-y-1">
                        {copy.key_benefits.map((b, i) => <li key={i} className="text-sm text-muted flex items-start gap-2"><CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />{b}</li>)}
                    </ul>
                </div>
            )}
            {copy.faq && copy.faq.length > 0 && (
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-2">FAQ</div>
                    <div className="space-y-3">
                        {copy.faq.map((f, i) => (
                            <div key={i}>
                                <div className="text-sm font-semibold">{f.question}</div>
                                <div className="text-sm text-muted">{f.answer}</div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
            <div className="grid grid-cols-2 gap-3">
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Meta Title</div>
                    <div className="text-sm">{copy.meta_title}</div>
                </div>
                <div className="bg-card border border-card-border rounded-xl p-4">
                    <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-1">Meta Description</div>
                    <div className="text-sm text-muted">{copy.meta_description}</div>
                </div>
            </div>
        </div>
    );
}

// ── Edison Tab — Creative Designer ──────────────────────────────────────────
export default function EdisonTab({ initialUrl, initialNiche, initialResearchData }: { initialUrl?: string; initialNiche?: string; initialResearchData?: any }) {
    const { effectiveUid } = useAuth();
    const [activeTab, setActiveTab] = useState<'creatives' | 'landing' | 'copy' | 'images'>('creatives');
    const [stores, setStores] = useState<PipelineStore[]>([]);
    const [loadingStores, setLoadingStores] = useState(true);
    const [error, setError] = useState('');

    // Creatives state
    const [crImgB64, setCrImgB64] = useState<string | null>(null);
    const [crFilename, setCrFilename] = useState('');
    const [crNiche, setCrNiche] = useState<Niche>('skincare');
    const [crProvider, setCrProvider] = useState<Provider>('gemini');
    const [crLimit, setCrLimit] = useState(20);
    const [crFormat, setCrFormat] = useState<'feed_4x5' | 'story_9x16' | 'both'>('story_9x16');
    const [crJobId, setCrJobId] = useState<string | null>(null);
    const crJob = useJobPolling(crJobId);

    // Landing state
    const [lnUrl, setLnUrl] = useState(initialUrl || '');
    const [lnStore, setLnStore] = useState('');
    const [lnNiche, setLnNiche] = useState<Niche>((initialNiche as Niche) || 'generic');
    const [lnStatus, setLnStatus] = useState<'draft' | 'active'>('draft');
    const [lnJobId, setLnJobId] = useState<string | null>(null);
    const [lnImgB64, setLnImgB64] = useState('');
    const [lnImgFilename, setLnImgFilename] = useState('');
    const [lnImgPreview, setLnImgPreview] = useState('');
    const lnJob = useJobPolling(lnJobId);

    // Copy state
    const [cpUrl, setCpUrl] = useState('');
    const [cpNiche, setCpNiche] = useState<Niche>('skincare');
    const [cpJobId, setCpJobId] = useState<string | null>(null);
    const cpJob = useJobPolling(cpJobId);

    // Images state
    const [imImgB64, setImImgB64] = useState<string | null>(null);
    const [imFilename, setImFilename] = useState('');
    const [imNiche, setImNiche] = useState<Niche>('skincare');
    const [imJobId, setImJobId] = useState<string | null>(null);
    const imJob = useJobPolling(imJobId);

    // Research context (from VEGA Research)
    const [researchContext, setResearchContext] = useState<any>(null);
    const [savedResearches, setSavedResearches] = useState<VegaResearch[]>([]);
    const [selectedResearchId, setSelectedResearchId] = useState('');

    // Auto-switch to landing tab when coming from Pythagoras with URL
    useEffect(() => {
        if (initialUrl) {
            setLnUrl(initialUrl);
            if (initialNiche) setLnNiche(initialNiche as Niche);
            setActiveTab('landing');
        }
    }, [initialUrl, initialNiche]);

    // Load stores + check for research data
    useEffect(() => {
        (async () => {
            try {
                const s = await getStores();
                setStores(s);
                if (s.length > 0) setLnStore(s[0].key);
            } catch (e) {
                setError('No se pudo conectar con la Pipeline API');
            } finally {
                setLoadingStores(false);
            }
        })();

        // Load saved researches
        if (effectiveUid) {
            getVegaResearchList(effectiveUid).then(r => setSavedResearches(r.filter(x => x.status === 'completed'))).catch(() => {});
        }

        // Check if coming from Research with pre-loaded data
        try {
            const raw = sessionStorage.getItem('pipeline_research');
            if (raw) {
                const data = JSON.parse(raw);
                setResearchContext(data);
                if (data.niche) {
                    setCrNiche(data.niche as Niche);
                    setCpNiche(data.niche as Niche);
                    setImNiche(data.niche as Niche);
                    setLnNiche(data.niche as Niche);
                }
                if (data.referenceUrl) {
                    setLnUrl(data.referenceUrl);
                    setCpUrl(data.referenceUrl);
                }
                sessionStorage.removeItem('pipeline_research');
            }
        } catch {}
    }, [effectiveUid]);

    // Handlers
    const handleCreatives = async () => {
        if (!crImgB64) return;
        setError('');
        try {
            const formats = crFormat === 'both' ? null : [crFormat];
            const res = await startCreatives({ image_base64: crImgB64, image_filename: crFilename, niche: crNiche, provider: crProvider, limit: crLimit, formats, workers: 5 });
            setCrJobId(res.job_id);
        } catch (e: any) { setError(e.message); }
    };

    const handleLanding = async () => {
        if (!lnUrl) return;
        setError('');
        try {
            const res = await startPipeline({
                url: lnUrl,
                store: lnStore,
                niche: lnNiche,
                status: lnStatus,
                image_base64: lnImgB64 || null,
                image_filename: lnImgFilename || null,
                research_data: initialResearchData || undefined,
            });
            setLnJobId(res.job_id);
        } catch (e: any) { setError(e.message); }
    };

    const handleCopy = async () => {
        if (!cpUrl) return;
        setError('');
        try {
            const res = await startCopy({ url: cpUrl, niche: cpNiche });
            setCpJobId(res.job_id);
        } catch (e: any) { setError(e.message); }
    };

    const handleImages = async () => {
        if (!imImgB64) return;
        setError('');
        try {
            const res = await startImages({ image_base64: imImgB64, image_filename: imFilename, niche: imNiche });
            setImJobId(res.job_id);
        } catch (e: any) { setError(e.message); }
    };

    const tabs = [
        { key: 'creatives' as const, label: 'Creativos', icon: Sparkles },
        { key: 'landing' as const, label: 'Landing Page', icon: Rocket },
        { key: 'copy' as const, label: 'Solo Copy', icon: FileText },
        { key: 'images' as const, label: 'Solo Imágenes', icon: ImageIcon },
    ];

    return (
        <div className="min-h-screen bg-background text-foreground p-3 md:p-5 font-sans">
            <div className="max-w-5xl mx-auto space-y-4">

                {/* Header */}
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-accent flex items-center justify-center text-white shadow-lg shadow-accent/25">
                            <Rocket className="w-5 h-5" />
                        </div>
                        <div>
                            <h1 className="text-sm font-bold tracking-widest uppercase">Pipeline</h1>
                            <p className="text-[9px] text-muted font-mono tracking-wider uppercase">Shopify Product Pipeline</p>
                        </div>
                    </div>
                    {loadingStores && <Loader2 className="w-4 h-4 animate-spin text-muted" />}
                </div>

                {/* Research context banner */}
                {researchContext && (
                    <div className="flex items-center gap-3 p-3 bg-[#AA77FF]/10 border border-[#AA77FF]/20 rounded-xl">
                        <div className="w-8 h-8 rounded-lg bg-[#AA77FF]/20 flex items-center justify-center text-[#AA77FF] text-xs font-bold">PY</div>
                        <div className="flex-1">
                            <div className="text-sm font-semibold">Desde Research: {researchContext.productName}</div>
                            <div className="text-[10px] text-muted">Nicho: {researchContext.niche} · Audiencia: {researchContext.targetAudience?.slice(0, 60)}...</div>
                        </div>
                        <button onClick={() => setResearchContext(null)} className="text-muted hover:text-foreground"><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Error */}
                {error && (
                    <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                        <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                        <button onClick={() => setError('')} className="ml-auto"><X className="w-4 h-4" /></button>
                    </div>
                )}

                {/* Tabs */}
                <div className="flex gap-1">
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        return (
                            <button key={tab.key} onClick={() => setActiveTab(tab.key)}
                                className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === tab.key
                                    ? 'bg-[#d75c33]/10 text-[#d75c33] border border-[#d75c33]/20'
                                    : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                                    }`}>
                                <Icon className="w-4 h-4" /> {tab.label}
                            </button>
                        );
                    })}
                </div>

                {/* ═══ TAB: CREATIVOS ═══ */}
                {activeTab === 'creatives' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Imagen de Referencia</div>
                                <ImageUploader
                                    preview={crImgB64}
                                    onUpload={(b64, fn) => { setCrImgB64(b64); setCrFilename(fn); }}
                                    onClear={() => { setCrImgB64(null); setCrFilename(''); }}
                                />

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Nicho</div>
                                <NicheSelector value={crNiche} onChange={setCrNiche} />

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Provider</div>
                                <div className="grid grid-cols-2 gap-2">
                                    {PROVIDERS.map(p => (
                                        <button key={p.value} onClick={() => setCrProvider(p.value)}
                                            className={`p-2.5 rounded-xl border text-left transition-all ${crProvider === p.value ? 'bg-accent/10 border-accent/30 text-accent' : 'border-card-border text-muted hover:border-accent/20'}`}>
                                            <div className="text-[11px] font-bold">{p.label}</div>
                                            <div className="text-[9px] opacity-60">{p.desc}</div>
                                        </button>
                                    ))}
                                </div>

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Cantidad: {crLimit}</div>
                                <input type="range" min={1} max={20} value={crLimit} onChange={e => setCrLimit(Number(e.target.value))}
                                    className="w-full accent-[#d75c33]" />

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Formato</div>
                                <div className="grid grid-cols-3 gap-2">
                                    {([['feed_4x5', 'Feed 4:5'], ['story_9x16', 'Story 9:16'], ['both', 'Ambos']] as const).map(([v, l]) => (
                                        <button key={v} onClick={() => setCrFormat(v as any)}
                                            className={`py-2 rounded-lg border text-[11px] font-semibold transition-all ${crFormat === v ? 'bg-accent/10 border-accent/30 text-accent' : 'border-card-border text-muted'}`}>
                                            {l}
                                        </button>
                                    ))}
                                </div>

                                <button onClick={handleCreatives} disabled={!crImgB64 || (crJob?.status === 'pending' || crJob?.status === 'running')}
                                    className="w-full py-3 bg-accent hover:bg-orange-600 disabled:bg-muted/10 disabled:text-muted/40 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
                                    {(crJob?.status === 'pending' || crJob?.status === 'running') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                                    Generar Creativos
                                </button>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <JobProgress job={crJob} />
                            {crJob?.status === 'completed' && crJob.files && (
                                <AssetGrid jobId={crJob.job_id} files={crJob.files} />
                            )}
                            {!crJob && (
                                <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
                                    <Sparkles className="w-10 h-10 mx-auto mb-3 text-muted/15" />
                                    <p className="text-sm text-muted/40">Sube una imagen y genera creativos para redes sociales</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ TAB: LANDING PAGE ═══ */}
                {activeTab === 'landing' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-card border border-card-border rounded-2xl p-4 space-y-4">

                                {/* Research selector */}
                                {savedResearches.length > 0 && (
                                    <>
                                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Desde Investigación</div>
                                        <select value={selectedResearchId}
                                            onChange={e => {
                                                const id = e.target.value;
                                                setSelectedResearchId(id);
                                                const r = savedResearches.find(x => x.id === id);
                                                if (r) {
                                                    setLnUrl(r.referenceUrl);
                                                    setLnNiche((r.niche || 'generic') as Niche);
                                                }
                                            }}
                                            className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none appearance-none">
                                            <option value="">— Seleccionar estudio —</option>
                                            {savedResearches.map(r => (
                                                <option key={r.id} value={r.id}>
                                                    {r.productName} ({r.niche}) — {r.report?.recommendation || '?'}
                                                </option>
                                            ))}
                                        </select>
                                        {selectedResearchId && (() => {
                                            const sr = savedResearches.find(x => x.id === selectedResearchId);
                                            return sr?.report ? (
                                                <div className="p-3 bg-[#AA77FF]/5 border border-[#AA77FF]/15 rounded-xl text-[10px] space-y-1">
                                                    <div className="font-bold text-[#AA77FF]">{sr.productName}</div>
                                                    <div className="text-muted">Score: {sr.report.scorecard.total}/10 · {sr.report.recommendation}</div>
                                                    <div className="text-muted">Audiencia: {sr.report.targetAudience?.slice(0, 80)}...</div>
                                                </div>
                                            ) : null;
                                        })()}
                                        <div className="border-b border-card-border" />
                                    </>
                                )}

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">URL de Referencia</div>
                                <input type="url" value={lnUrl} onChange={e => setLnUrl(e.target.value)}
                                    placeholder="https://amazon.com/producto..."
                                    className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/30 focus:border-accent/50 focus:outline-none" />

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Imagen del Producto (opcional)</div>
                                {lnImgPreview ? (
                                    <div className="relative">
                                        <img src={lnImgPreview} alt="preview" className="w-full h-32 object-contain rounded-xl border border-card-border bg-background" />
                                        <button onClick={() => { setLnImgB64(''); setLnImgFilename(''); setLnImgPreview(''); }}
                                            className="absolute top-1 right-1 p-1 bg-red-500/80 hover:bg-red-500 text-white rounded-lg text-[10px]">✕</button>
                                    </div>
                                ) : (
                                    <label className="flex items-center justify-center gap-2 py-3 border-2 border-dashed border-card-border rounded-xl cursor-pointer hover:border-accent/30 transition-colors">
                                        <ImageIcon className="w-4 h-4 text-muted" />
                                        <span className="text-[11px] text-muted font-semibold">Subir imagen para generar creativos IA</span>
                                        <input type="file" accept="image/*" className="hidden" onChange={async (e) => {
                                            const file = e.target.files?.[0];
                                            if (!file) return;
                                            setLnImgFilename(file.name);
                                            setLnImgPreview(URL.createObjectURL(file));
                                            const b64 = await fileToBase64(file);
                                            setLnImgB64(b64);
                                        }} />
                                    </label>
                                )}

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Tienda Shopify</div>
                                <select value={lnStore} onChange={e => setLnStore(e.target.value)}
                                    className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:outline-none appearance-none">
                                    {stores.map(s => <option key={s.key} value={s.key}>{s.name} — {s.url}</option>)}
                                </select>

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Nicho</div>
                                <NicheSelector value={lnNiche} onChange={setLnNiche} />

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Estado al publicar</div>
                                <div className="grid grid-cols-2 gap-2">
                                    <button onClick={() => setLnStatus('draft')} className={`py-2 rounded-lg border text-[11px] font-semibold transition-all ${lnStatus === 'draft' ? 'bg-accent/10 border-accent/30 text-accent' : 'border-card-border text-muted'}`}>Borrador</button>
                                    <button onClick={() => setLnStatus('active')} className={`py-2 rounded-lg border text-[11px] font-semibold transition-all ${lnStatus === 'active' ? 'bg-emerald-400/10 border-emerald-400/30 text-emerald-400' : 'border-card-border text-muted'}`}>Activo</button>
                                </div>

                                <button onClick={handleLanding} disabled={!lnUrl || (lnJob?.status === 'pending' || lnJob?.status === 'running')}
                                    className="w-full py-3 bg-accent hover:bg-orange-600 disabled:bg-muted/10 disabled:text-muted/40 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
                                    {(lnJob?.status === 'pending' || lnJob?.status === 'running') ? <Loader2 className="w-4 h-4 animate-spin" /> : <Rocket className="w-4 h-4" />}
                                    Crear Producto en Shopify
                                </button>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <JobProgress job={lnJob} />
                            {lnJob?.status === 'completed' && lnJob.result && (
                                <div className="mt-4 space-y-3">
                                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-4 flex items-center gap-3">
                                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                                        <div>
                                            <div className="text-sm font-bold text-emerald-400">Producto creado en Shopify</div>
                                            {lnJob.result.shopify_url && (
                                                <a href={lnJob.result.shopify_url} target="_blank" rel="noopener" className="text-[11px] text-accent flex items-center gap-1 mt-1">
                                                    <ExternalLink className="w-3 h-3" /> Ver en Shopify
                                                </a>
                                            )}
                                        </div>
                                    </div>
                                    {lnJob.result.copy && <CopyViewer copy={lnJob.result.copy} />}
                                    {lnJob.files && <AssetGrid jobId={lnJob.job_id} files={lnJob.files} />}
                                </div>
                            )}
                            {!lnJob && (
                                <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
                                    <Rocket className="w-10 h-10 mx-auto mb-3 text-muted/15" />
                                    <p className="text-sm text-muted/40">Pega una URL y crea un producto completo en Shopify</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ TAB: SOLO COPY ═══ */}
                {activeTab === 'copy' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">URL del Producto</div>
                                <input type="url" value={cpUrl} onChange={e => setCpUrl(e.target.value)}
                                    placeholder="https://amazon.com/producto..."
                                    className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted/30 focus:border-accent/50 focus:outline-none" />

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Nicho</div>
                                <NicheSelector value={cpNiche} onChange={setCpNiche} />

                                <button onClick={handleCopy} disabled={!cpUrl || (cpJob?.status === 'pending' || cpJob?.status === 'running')}
                                    className="w-full py-3 bg-accent hover:bg-orange-600 disabled:bg-muted/10 disabled:text-muted/40 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
                                    {(cpJob?.status === 'pending' || cpJob?.status === 'running') ? <Loader2 className="w-4 h-4 animate-spin" /> : <FileText className="w-4 h-4" />}
                                    Generar Copy
                                </button>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <JobProgress job={cpJob} />
                            {cpJob?.status === 'completed' && cpJob.result && <CopyViewer copy={cpJob.result} />}
                            {!cpJob && (
                                <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
                                    <FileText className="w-10 h-10 mx-auto mb-3 text-muted/15" />
                                    <p className="text-sm text-muted/40">Genera copy CRO en español a partir de una URL</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}

                {/* ═══ TAB: SOLO IMÁGENES ═══ */}
                {activeTab === 'images' && (
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        <div className="lg:col-span-1 space-y-4">
                            <div className="bg-card border border-card-border rounded-2xl p-4 space-y-4">
                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Imagen de Referencia</div>
                                <ImageUploader
                                    preview={imImgB64}
                                    onUpload={(b64, fn) => { setImImgB64(b64); setImFilename(fn); }}
                                    onClear={() => { setImImgB64(null); setImFilename(''); }}
                                />

                                <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Nicho</div>
                                <NicheSelector value={imNiche} onChange={setImNiche} />

                                <button onClick={handleImages} disabled={!imImgB64 || (imJob?.status === 'pending' || imJob?.status === 'running')}
                                    className="w-full py-3 bg-accent hover:bg-orange-600 disabled:bg-muted/10 disabled:text-muted/40 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-accent/20 flex items-center justify-center gap-2">
                                    {(imJob?.status === 'pending' || imJob?.status === 'running') ? <Loader2 className="w-4 h-4 animate-spin" /> : <ImageIcon className="w-4 h-4" />}
                                    Generar Imágenes
                                </button>
                            </div>
                        </div>
                        <div className="lg:col-span-2">
                            <JobProgress job={imJob} />
                            {imJob?.status === 'completed' && imJob.files && (
                                <AssetGrid jobId={imJob.job_id} files={imJob.files} />
                            )}
                            {!imJob && (
                                <div className="bg-card border border-card-border rounded-2xl p-12 text-center">
                                    <ImageIcon className="w-10 h-10 mx-auto mb-3 text-muted/15" />
                                    <p className="text-sm text-muted/40">Sube una imagen y genera variaciones con IA</p>
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
