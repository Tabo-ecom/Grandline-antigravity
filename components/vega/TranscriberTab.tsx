'use client';

import React, { useState, useRef } from 'react';
import { Upload, Loader2, Copy, Check, FileText, X, Download, Mic, Video, AlertCircle, Trash2 } from 'lucide-react';
import { authFetch } from '@/lib/api/client';

interface Transcription {
    id: string;
    filename: string;
    transcript: string;
    language: string;
    words: number;
    chars: number;
    timestamp: number;
}

export default function TranscriberTab() {
    const [file, setFile] = useState<File | null>(null);
    const [preview, setPreview] = useState('');
    const [language, setLanguage] = useState('es');
    const [transcribing, setTranscribing] = useState(false);
    const [error, setError] = useState('');
    const [copied, setCopied] = useState(false);
    const [history, setHistory] = useState<Transcription[]>([]);
    const [activeTranscript, setActiveTranscript] = useState<Transcription | null>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const [dragOver, setDragOver] = useState(false);

    const handleFile = (f: File) => {
        const validTypes = ['video/mp4', 'video/webm', 'video/quicktime', 'video/x-msvideo',
            'audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/m4a', 'audio/x-m4a', 'audio/ogg',
            'audio/mp4', 'video/x-matroska'];
        if (!f.type && !f.name.match(/\.(mp4|mp3|wav|webm|m4a|mov|avi|mkv|ogg)$/i)) {
            setError('Formato no soportado. Usa MP4, MP3, WAV, WEBM, M4A, MOV.');
            return;
        }
        setFile(f);
        setPreview(f.name);
        setError('');
    };

    const handleTranscribe = async () => {
        if (!file) return;
        setTranscribing(true);
        setError('');
        try {
            const formData = new FormData();
            formData.append('file', file);
            formData.append('language', language);

            const res = await authFetch('/api/vega/transcribe', {
                method: 'POST',
                body: formData,
            });

            if (!res.ok) {
                const err = await res.json().catch(() => ({}));
                throw new Error(err.error || 'Error en la transcripción');
            }

            const data = await res.json();
            const transcription: Transcription = {
                id: `${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                filename: data.filename || file.name,
                transcript: data.transcript,
                language: data.language,
                words: data.words,
                chars: data.chars,
                timestamp: Date.now(),
            };
            setActiveTranscript(transcription);
            setHistory(prev => [transcription, ...prev]);
            setFile(null);
            setPreview('');
        } catch (e: any) {
            setError(e.message);
        } finally {
            setTranscribing(false);
        }
    };

    const handleCopy = () => {
        if (!activeTranscript) return;
        navigator.clipboard.writeText(activeTranscript.transcript);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    const handleDownload = () => {
        if (!activeTranscript) return;
        const blob = new Blob([activeTranscript.transcript], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${activeTranscript.filename.replace(/\.[^.]+$/, '')}_transcripcion.txt`;
        a.click();
        URL.revokeObjectURL(url);
    };

    const fileSizeMB = file ? (file.size / (1024 * 1024)).toFixed(1) : '0';

    return (
        <div className="space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Left: Upload + Config */}
                <div className="space-y-4">
                    <div className="bg-card border border-card-border rounded-2xl p-5 space-y-4">
                        <div className="flex items-center gap-2">
                            <div className="w-8 h-8 rounded-xl bg-pink-500/15 flex items-center justify-center">
                                <Mic className="w-4 h-4 text-pink-400" />
                            </div>
                            <div>
                                <div className="text-sm font-bold">Transcriptor</div>
                                <div className="text-[10px] text-muted">Video/Audio → Texto</div>
                            </div>
                        </div>

                        {/* Upload zone */}
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Archivo</div>
                        {file ? (
                            <div className="flex items-center gap-3 p-3 bg-background border border-card-border rounded-xl">
                                <div className="w-10 h-10 rounded-lg bg-pink-500/10 flex items-center justify-center">
                                    {file.type?.startsWith('video') ? <Video className="w-5 h-5 text-pink-400" /> : <Mic className="w-5 h-5 text-pink-400" />}
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="text-sm font-semibold truncate">{file.name}</div>
                                    <div className="text-[10px] text-muted">{fileSizeMB} MB</div>
                                </div>
                                <button onClick={() => { setFile(null); setPreview(''); }} className="text-muted hover:text-red-400">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div
                                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-all ${dragOver ? 'border-pink-400/50 bg-pink-400/5' : 'border-card-border hover:border-pink-400/30'}`}
                                onClick={() => inputRef.current?.click()}
                                onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                                onDragLeave={() => setDragOver(false)}
                                onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f); }}
                            >
                                <Upload className="w-8 h-8 mx-auto mb-2 text-muted/30" />
                                <p className="text-sm text-muted">Arrastra un video o audio</p>
                                <p className="text-[10px] text-muted/40 mt-1">MP4, MP3, WAV, WEBM, M4A, MOV</p>
                            </div>
                        )}
                        <input ref={inputRef} type="file" accept="video/*,audio/*,.mp4,.mp3,.wav,.webm,.m4a,.mov,.avi,.mkv,.ogg" className="hidden"
                            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }} />

                        {/* Language */}
                        <div className="text-[10px] font-bold uppercase tracking-widest text-muted">Idioma</div>
                        <div className="grid grid-cols-3 gap-2">
                            {[
                                { value: 'es', label: 'Español' },
                                { value: 'en', label: 'English' },
                                { value: 'auto', label: 'Auto' },
                            ].map(l => (
                                <button key={l.value} onClick={() => setLanguage(l.value)}
                                    className={`py-2 rounded-lg border text-[11px] font-semibold transition-all ${language === l.value ? 'bg-pink-400/10 border-pink-400/30 text-pink-400' : 'border-card-border text-muted'}`}>
                                    {l.label}
                                </button>
                            ))}
                        </div>

                        {/* Error */}
                        {error && (
                            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-sm text-red-400">
                                <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                            </div>
                        )}

                        {/* Transcribe button */}
                        <button onClick={handleTranscribe}
                            disabled={!file || transcribing}
                            className="w-full py-3 bg-pink-500 hover:bg-pink-600 disabled:bg-muted/10 disabled:text-muted/40 text-white rounded-xl font-bold text-[11px] uppercase tracking-wider transition-all shadow-lg shadow-pink-500/25 flex items-center justify-center gap-2">
                            {transcribing ? <><Loader2 className="w-4 h-4 animate-spin" /> Transcribiendo...</> : <><Mic className="w-4 h-4" /> Transcribir</>}
                        </button>
                    </div>

                    {/* History */}
                    {history.length > 0 && (
                        <div className="bg-card border border-card-border rounded-2xl p-4">
                            <div className="text-[10px] font-bold uppercase tracking-widest text-muted mb-3">Historial</div>
                            <div className="space-y-1.5">
                                {history.map(t => (
                                    <button key={t.id} onClick={() => setActiveTranscript(t)}
                                        className={`w-full text-left p-2.5 rounded-xl border transition-all ${activeTranscript?.id === t.id ? 'bg-pink-400/10 border-pink-400/30' : 'border-card-border hover:bg-hover-bg'}`}>
                                        <div className="text-[11px] font-semibold truncate">{t.filename}</div>
                                        <div className="text-[9px] text-muted mt-0.5">{t.words} palabras · {new Date(t.timestamp).toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit' })}</div>
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* Right: Transcript result */}
                <div className="lg:col-span-2">
                    {activeTranscript ? (
                        <div className="bg-card border border-card-border rounded-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-5 py-3 border-b border-card-border">
                                <div>
                                    <div className="text-sm font-bold">{activeTranscript.filename}</div>
                                    <div className="text-[10px] text-muted">{activeTranscript.words} palabras · {activeTranscript.chars} caracteres</div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button onClick={handleCopy}
                                        className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-bold transition-all ${copied ? 'bg-emerald-400/15 text-emerald-400' : 'bg-pink-500/10 text-pink-400 hover:bg-pink-500/20'}`}>
                                        {copied ? <><Check className="w-3.5 h-3.5" /> Copiado</> : <><Copy className="w-3.5 h-3.5" /> Copiar</>}
                                    </button>
                                    <button onClick={handleDownload}
                                        className="flex items-center gap-1.5 px-3 py-1.5 bg-card border border-card-border rounded-lg text-[11px] font-bold text-muted hover:text-foreground transition-all">
                                        <Download className="w-3.5 h-3.5" /> .txt
                                    </button>
                                    <button onClick={() => { setHistory(prev => prev.filter(h => h.id !== activeTranscript.id)); setActiveTranscript(null); }}
                                        className="p-1.5 text-muted hover:text-red-400 transition-all">
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>
                            </div>
                            {/* Transcript text */}
                            <div className="p-5">
                                <div className="bg-background border border-card-border rounded-xl p-5 max-h-[65vh] overflow-y-auto">
                                    <div className="text-sm leading-relaxed whitespace-pre-wrap select-all">{activeTranscript.transcript}</div>
                                </div>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-card border border-card-border rounded-2xl p-16 text-center">
                            <FileText className="w-12 h-12 mx-auto mb-3 text-muted/15" />
                            <p className="text-sm text-muted/40">Sube un video o audio para transcribir</p>
                            <p className="text-[10px] text-muted/25 mt-1">Gemini AI · Español, Inglés, Auto-detectar</p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
