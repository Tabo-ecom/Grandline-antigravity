'use client';

import React, { useState } from 'react';
import { X, PlayCircle } from 'lucide-react';
import type { TutorialConfig } from '@/lib/config/tutorials';

interface Props {
    tutorial: TutorialConfig;
    onClose: () => void;
    onDismiss?: () => void;
}

function toEmbedUrl(url: string): string {
    if (!url) return '';
    const ytShort = url.match(/youtu\.be\/([a-zA-Z0-9_-]+)/);
    if (ytShort) return `https://www.youtube.com/embed/${ytShort[1]}`;
    const ytLong = url.match(/youtube\.com\/watch\?v=([a-zA-Z0-9_-]+)/);
    if (ytLong) return `https://www.youtube.com/embed/${ytLong[1]}`;
    if (url.includes('youtube.com/embed/')) return url;
    if (url.includes('loom.com')) return url.replace('/share/', '/embed/');
    return url;
}

export default function VideoTutorialModal({ tutorial, onClose, onDismiss }: Props) {
    const [activeIdx, setActiveIdx] = useState(0);
    const hasVideos = tutorial.videos.length > 0;
    const activeVideo = tutorial.videos[activeIdx];
    const embedUrl = activeVideo ? toEmbedUrl(activeVideo.url) : '';

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={onClose} />
            <div className="relative z-10 w-full max-w-2xl border-2 border-[#d75c33] bg-card rounded-2xl shadow-[0_0_30px_rgba(215,92,51,0.15)] animate-in zoom-in-95 duration-200 overflow-hidden">
                {/* Header */}
                <div className="flex items-center justify-between px-6 pt-5 pb-3">
                    <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-[#d75c33]/10 flex items-center justify-center">
                            <PlayCircle size={20} className="text-[#d75c33]" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-foreground">{tutorial.title}</h2>
                            <p className="text-xs text-muted">{tutorial.description}</p>
                        </div>
                    </div>
                    <button
                        onClick={onClose}
                        className="p-1.5 rounded-lg hover:bg-hover-bg text-muted hover:text-foreground transition-colors"
                    >
                        <X size={18} />
                    </button>
                </div>

                {/* Video tabs (only if multiple) */}
                {tutorial.videos.length > 1 && (
                    <div className="px-6 pb-2 flex gap-2">
                        {tutorial.videos.map((v, i) => (
                            <button
                                key={i}
                                onClick={() => setActiveIdx(i)}
                                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                                    i === activeIdx
                                        ? 'bg-[#d75c33] text-white'
                                        : 'bg-[#d75c33]/10 text-[#d75c33] hover:bg-[#d75c33]/20'
                                }`}
                            >
                                {v.title}
                            </button>
                        ))}
                    </div>
                )}

                {/* Video */}
                <div className="px-6 pb-4">
                    {hasVideos ? (
                        <iframe
                            key={activeIdx}
                            src={embedUrl}
                            allowFullScreen
                            className="w-full aspect-video rounded-xl border border-card-border"
                            allow="autoplay; fullscreen; encrypted-media"
                        />
                    ) : (
                        <div className="w-full aspect-video rounded-xl border-2 border-dashed border-[#d75c33]/30 bg-[#d75c33]/5 flex items-center justify-center">
                            <div className="text-center">
                                <PlayCircle size={48} className="text-[#d75c33]/40 mx-auto mb-2" />
                                <p className="text-sm text-muted">Video tutorial proximamente</p>
                            </div>
                        </div>
                    )}
                </div>

                {/* Steps */}
                <div className="px-6 pb-4">
                    <p className="text-[10px] font-black text-[#d75c33] uppercase tracking-widest mb-2">Pasos clave</p>
                    <div className="space-y-2">
                        {tutorial.steps.map((step, i) => (
                            <div key={i} className="flex items-start gap-3">
                                <span className="flex-shrink-0 w-6 h-6 rounded-full bg-[#d75c33] text-white text-xs font-bold flex items-center justify-center mt-0.5">
                                    {i + 1}
                                </span>
                                <p className="text-sm text-foreground/80 leading-relaxed">{step}</p>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Footer */}
                <div className="px-6 pb-5 flex items-center justify-end gap-3">
                    {onDismiss && (
                        <button
                            onClick={() => { onDismiss(); onClose(); }}
                            className="text-xs text-muted hover:text-foreground transition-colors"
                        >
                            No mostrar de nuevo
                        </button>
                    )}
                    <button
                        onClick={onClose}
                        className="px-5 py-2 bg-[#d75c33] text-white text-sm font-semibold rounded-xl hover:bg-[#c04e2a] transition-colors"
                    >
                        Entendido
                    </button>
                </div>
            </div>
        </div>
    );
}
