import React from 'react';
import { formatCurrency } from '@/lib/utils/currency';
import { Package, TrendingUp, DollarSign, MousePointerClick, Activity, ExternalLink, ShoppingCart, Target, RefreshCw, Image } from 'lucide-react';

interface AdCreative {
    id?: string;
    name: string;
    campaign_name?: string;
    campaign_id?: string;
    platform: string;
    spend: number;
    impressions?: number;
    clicks?: number;
    ctr?: number;
    conversions?: number;
    revenue?: number;
    page_visits?: number;
    add_to_cart?: number;
    thumbnail?: string;
    productName?: string;
}

interface CreativesGalleryProps {
    data: AdCreative[];
    onSync?: () => void;
    isSyncing?: boolean;
}

function getViewUrl(ad: AdCreative): { url: string; label: string } | null {
    if (ad.platform === 'facebook') {
        if (ad.id) {
            return { url: `https://www.facebook.com/ads/manager/manage/ads?act=&selected_ad_ids=${ad.id}`, label: 'Ver Anuncio' };
        }
        // Fallback: search by campaign name in Ads Manager
        const encoded = encodeURIComponent(ad.campaign_name || ad.name);
        return { url: `https://www.facebook.com/ads/manager/manage/campaigns?search_value=${encoded}`, label: 'Ver Campaña' };
    }
    if (ad.platform === 'tiktok') {
        return { url: `https://ads.tiktok.com/i18n/perf/ad`, label: 'Ver en TikTok' };
    }
    return null;
}

export const CreativesGallery: React.FC<CreativesGalleryProps> = ({ data, onSync, isSyncing }) => {
    const hasThumbnails = data.some(ad => ad.thumbnail);

    return (
        <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Top Creativos por Producto</h3>
                    <p className="text-xs text-muted mt-1">Mejor campaña/anuncio por producto ordenado por gasto.</p>
                </div>
                {onSync && !hasThumbnails && data.length > 0 && (
                    <button
                        onClick={onSync}
                        disabled={isSyncing}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-accent/10 border border-accent/20 text-accent text-[9px] font-black uppercase tracking-widest hover:bg-accent/20 transition-colors disabled:opacity-50"
                    >
                        <RefreshCw className={`w-3.5 h-3.5 ${isSyncing ? 'animate-spin' : ''}`} />
                        {isSyncing ? 'Sincronizando...' : 'Cargar Creativos'}
                    </button>
                )}
            </div>

            {/* Info banner when no thumbnails */}
            {!hasThumbnails && data.length > 0 && (
                <div className="flex items-center gap-3 mb-5 p-3 rounded-xl bg-blue-500/5 border border-blue-500/10">
                    <Image className="w-4 h-4 text-blue-400 shrink-0" />
                    <p className="text-[10px] text-blue-400/80 font-bold">
                        Presiona &quot;Sincronizar con Facebook&quot; en la parte superior para cargar las miniaturas de los anuncios.
                    </p>
                </div>
            )}

            <div className="space-y-3">
                {data.slice(0, 5).map((ad, idx) => {
                    const roas = ad.spend > 0 && ad.revenue ? ad.revenue / ad.spend : 0;
                    const cpa = ad.conversions && ad.conversions > 0 ? ad.spend / ad.conversions : 0;
                    const ctr = ad.ctr || (ad.impressions && ad.impressions > 0 && ad.clicks ? (ad.clicks / ad.impressions) * 100 : 0);
                    const isFb = ad.platform === 'facebook';
                    const viewLink = getViewUrl(ad);

                    return (
                        <div key={ad.id || `${ad.name}_${idx}`} className="flex flex-col sm:flex-row gap-4 sm:gap-5 p-4 border border-card-border rounded-2xl bg-hover-bg/30 hover:bg-hover-bg hover:border-accent/30 transition-all group">
                            {/* Thumbnail or Rank Badge */}
                            {ad.thumbnail ? (
                                <div className="w-full sm:w-36 h-36 shrink-0 bg-card rounded-xl overflow-hidden relative border border-card-border">
                                    <img src={ad.thumbnail} alt={ad.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                                    <div className="absolute top-2 left-2">
                                        <span className={`px-2 py-1 rounded text-[8px] font-black uppercase tracking-widest border ${isFb ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-teal-500/20 text-teal-400 border-teal-500/30'}`}>
                                            {ad.platform}
                                        </span>
                                    </div>
                                    <div className="absolute bottom-2 right-2">
                                        <div className="flex items-center justify-center w-6 h-6 rounded-lg bg-card/80 border border-card-border backdrop-blur-sm">
                                            <span className="text-[10px] font-black text-muted">#{idx + 1}</span>
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="hidden sm:flex items-center justify-center w-12 shrink-0">
                                    <div className="flex flex-col items-center gap-1">
                                        <div className="flex items-center justify-center w-8 h-8 rounded-xl bg-card border border-card-border">
                                            <span className="text-xs font-black text-muted">#{idx + 1}</span>
                                        </div>
                                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border ${isFb ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-teal-500/20 text-teal-400 border-teal-500/30'}`}>
                                            {isFb ? 'FB' : 'TT'}
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Details & Metrics */}
                            <div className="flex-1 min-w-0 flex flex-col justify-between">
                                {/* Header */}
                                <div className="mb-3">
                                    <div className="flex items-center gap-2 flex-wrap mb-1">
                                        {ad.productName && (
                                            <span className="inline-block px-2 py-0.5 rounded-md bg-accent/10 text-accent text-[9px] font-black uppercase tracking-widest border border-accent/20">
                                                {ad.productName}
                                            </span>
                                        )}
                                        {!ad.thumbnail && (
                                            <span className={`sm:hidden px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest border ${isFb ? 'bg-blue-500/20 text-blue-400 border-blue-500/30' : 'bg-teal-500/20 text-teal-400 border-teal-500/30'}`}>
                                                {isFb ? 'FB' : 'TT'}
                                            </span>
                                        )}
                                    </div>
                                    <h4 className="text-sm font-black text-foreground truncate" title={ad.name}>{ad.name}</h4>
                                </div>

                                {/* Metrics Row */}
                                <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-5">
                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1"><DollarSign className="w-3 h-3" /> Gasto</span>
                                        <span className="text-base font-black text-orange-400 tabular-nums leading-none">{formatCurrency(ad.spend)}</span>
                                    </div>

                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1"><TrendingUp className="w-3 h-3" /> ROAS FB</span>
                                        <span className={`text-base font-black tabular-nums leading-none ${roas >= 1 ? 'text-emerald-400' : roas > 0 ? 'text-yellow-400' : 'text-muted'}`}>
                                            {roas > 0 ? `${roas.toFixed(2)}x` : '-'}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1"><Activity className="w-3 h-3" /> CPA FB</span>
                                        <span className="text-base font-black text-foreground/80 tabular-nums leading-none">
                                            {cpa > 0 ? formatCurrency(cpa) : '-'}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1"><MousePointerClick className="w-3 h-3" /> CTR</span>
                                        <span className="text-base font-black text-foreground/80 tabular-nums leading-none">
                                            {ctr > 0 ? `${ctr.toFixed(2)}%` : '-'}
                                        </span>
                                    </div>

                                    <div className="flex flex-col gap-0.5">
                                        <span className="text-[9px] font-black text-muted uppercase tracking-widest flex items-center gap-1"><ShoppingCart className="w-3 h-3" /> Compras</span>
                                        <span className="text-base font-black text-foreground/80 tabular-nums leading-none">
                                            {ad.conversions && ad.conversions > 0 ? ad.conversions : '-'}
                                        </span>
                                    </div>
                                </div>

                                {/* Action link */}
                                {viewLink && (
                                    <div className="mt-3">
                                        <a
                                            href={viewLink.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-card border border-card-border text-[9px] font-black text-muted uppercase tracking-widest hover:text-accent hover:border-accent/30 transition-colors"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                            {viewLink.label}
                                        </a>
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>

            {data.length === 0 && (
                <div className="text-center py-20 text-muted bg-hover-bg rounded-2xl border border-dashed border-card-border">
                    <div className="flex justify-center mb-4 opacity-20"><Target className="w-12 h-12" /></div>
                    <span className="font-mono text-[10px] uppercase tracking-widest">Mapea campañas a productos para ver los mejores creativos</span>
                </div>
            )}
        </div>
    );
};
