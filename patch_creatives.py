import re

new_content = """import React from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { Package, TrendingUp, DollarSign, Eye, MousePointerClick, Target, Activity } from 'lucide-react';

interface AdCreative {
    name: string;
    platform: string;
    spend: number;
    roas: number;
    revenue: number;
    impressions?: number;
    clicks?: number;
    conversions?: number;
    revenue_attributed?: number;
    thumbnail?: string;
}

interface CreativesGalleryProps {
    data: AdCreative[];
}

export const CreativesGallery: React.FC<CreativesGalleryProps> = ({ data }) => {
    return (
        <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-8">
                <div>
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Top Creativos (por Gasto)</h3>
                    <p className="text-xs text-muted mt-1">Análisis de rendimiento de los mejores anuncios con métricas directas del pixel.</p>
                </div>
            </div>

            <div className="space-y-4">
                {data.slice(0, 10).map((ad, idx) => {
                    const ctr = ad.impressions && ad.impressions > 0 && ad.clicks ? (ad.clicks / ad.impressions) * 100 : 0;
                    const cpaAd = ad.conversions && ad.conversions > 0 ? ad.spend / ad.conversions : 0;
                    const isFb = ad.platform === 'facebook';

                    return (
                        <div key={idx} className="flex flex-col sm:flex-row gap-4 sm:gap-6 p-4 border border-card-border rounded-2xl bg-hover-bg/30 hover:bg-hover-bg hover:border-accent/30 transition-all group">
                            {/* Thumbnail */}
                            <div className="w-full sm:w-32 h-32 shrink-0 bg-card rounded-xl overflow-hidden relative border border-card-border">
                                {ad.thumbnail ? (
                                    <img src={ad.thumbnail} alt={ad.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                ) : (
                                    <div className="w-full h-full flex flex-col items-center justify-center bg-[#0a0f16]">
                                        <Package className="w-8 h-8 text-muted/30 mb-2" />
                                        <span className="text-[8px] font-black text-muted uppercase tracking-widest">No Media</span>
                                    </div>
                                )}
                                <div className="absolute top-2 left-2">
                                    <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${isFb ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-teal-500/20 text-teal-400 border-teal-500/30'}`}>
                                        {ad.platform}
                                    </span>
                                </div>
                            </div>

                            {/* Details & Metrics */}
                            <div className="flex-1 min-w-0 py-1 flex flex-col justify-between">
                                {/* Header */}
                                <div className="mb-4">
                                    <div className="flex items-center gap-2 mb-1">
                                        <div className="flex items-center justify-center w-5 h-5 rounded-md bg-card border border-card-border">
                                            <span className="text-[10px] font-black text-muted">#{idx + 1}</span>
                                        </div>
                                        <h4 className="text-sm font-black text-foreground truncate" title={ad.name}>{ad.name}</h4>
                                    </div>
                                </div>

                                {/* Metrics Row */}
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-8">
                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><DollarSign className="w-3 h-3" /> Gasto</span>
                                        <span className="text-lg font-black text-orange-400 tabular-nums leading-none">{formatCurrency(ad.spend)}</span>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><TrendingUp className="w-3 h-3" /> ROAS (Dropi)</span>
                                        <span className="text-lg font-black text-emerald-400 tabular-nums leading-none">{ad.roas?.toFixed(2)}x</span>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><MousePointerClick className="w-3 h-3" /> CTR (Pixel)</span>
                                        <span className="text-lg font-black text-foreground/80 tabular-nums leading-none">
                                            {ctr > 0 ? `${ctr.toFixed(2)}%` : '-'}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-1">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5"><Activity className="w-3 h-3" /> CPA (Pixel)</span>
                                        <span className="text-lg font-black text-foreground/80 tabular-nums leading-none">
                                            {cpaAd > 0 ? formatCurrency(cpaAd) : '-'}
                                        </span>
                                        {ad.conversions !== undefined && ad.conversions > 0 && (
                                            <span className="text-[9px] text-muted font-bold ml-1">{ad.conversions} compras</span>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            {data.length === 0 && (
                <div className="text-center py-20 text-muted bg-hover-bg rounded-2xl border border-dashed border-card-border">
                    <div className="flex justify-center mb-4 opacity-20"><Target className="w-12 h-12" /></div>
                    <span className="font-mono text-[10px] uppercase tracking-widest">No hay anuncios detectados para el período seleccionado</span>
                </div>
            )}
        </div>
    );
};
"""

with open('components/publicidad/CreativesGallery.tsx', 'w', encoding='utf-8') as f:
    f.write(new_content)

print("Redesigned CreativesGallery successfully")

