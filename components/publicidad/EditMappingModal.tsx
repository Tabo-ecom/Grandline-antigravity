import { X, Loader2 } from 'lucide-react';
import ModalOverlay from '@/components/common/ModalOverlay';
import type { CampaignMapping } from '@/lib/services/marketing';

interface EditingMapping {
    productId: string;
    campaigns: CampaignMapping[];
}

interface ProductOption {
    id: string;
    label: string;
    country?: string;
}

interface EditMappingModalProps {
    editingMapping: EditingMapping;
    setEditingMapping: React.Dispatch<React.SetStateAction<EditingMapping | null>>;
    editNewProductId: string;
    setEditNewProductId: (id: string) => void;
    selectableProducts: ProductOption[];
    saving: boolean;
    onDeleteMapping: (campaignName: string, platform: 'facebook' | 'tiktok') => void;
    onUpdateProduct: () => void;
    onClose: () => void;
}

export default function EditMappingModal({
    editingMapping,
    setEditingMapping,
    editNewProductId,
    setEditNewProductId,
    selectableProducts,
    saving,
    onDeleteMapping,
    onUpdateProduct,
    onClose,
}: EditMappingModalProps) {
    return (
        <ModalOverlay onClose={onClose}>
            <div className="flex justify-between items-start mb-8">
                <div className="flex flex-col">
                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Editar Vinculación</h3>
                    <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Se moverán {editingMapping.campaigns.length} campañas</p>
                </div>
                <button onClick={onClose} className="p-2 text-muted hover:text-white"><X className="w-6 h-6" /></button>
            </div>

            <div className="space-y-8">
                <div className="p-6 bg-card border border-card-border rounded-2xl space-y-4">
                    <span className="text-[9px] font-black text-muted uppercase tracking-widest">Campañas Actuales</span>
                    <div className="flex flex-wrap gap-2">
                        {editingMapping.campaigns.map((c) => (
                            <div key={`${c.campaignName}_${c.platform}`} className="px-3 py-2 bg-hover-bg text-muted text-[9px] font-bold rounded-lg border border-white/10 flex items-center gap-3 group/item">
                                <div className="flex flex-col">
                                    <span className="text-[10px]">{c.campaignName}</span>
                                    <span className={`text-[7px] font-black uppercase ${c.platform === 'facebook' ? 'text-blue-500' : 'text-teal-500'}`}>{c.platform}</span>
                                </div>
                                <button
                                    onClick={() => {
                                        if (confirm(`¿Eliminar vinculación de ${c.campaignName}?`)) {
                                            onDeleteMapping(c.campaignName, c.platform);
                                            setEditingMapping(prev => prev ? ({
                                                ...prev,
                                                campaigns: prev.campaigns.filter(cam => !(cam.campaignName === c.campaignName && cam.platform === c.platform))
                                            }) : null);
                                        }
                                    }}
                                    className="hover:text-rose-500 transition-all ml-auto"
                                    title="Eliminar campaña de este producto"
                                >
                                    <X className="w-3 h-3" />
                                </button>
                            </div>
                        ))}
                    </div>
                </div>

                <div className="space-y-4">
                    <label className="text-[11px] font-black text-muted uppercase tracking-widest px-2">Nuevo Producto Destino</label>
                    <select
                        value={editNewProductId}
                        onChange={e => setEditNewProductId(e.target.value)}
                        className="w-full bg-card border border-card-border rounded-2xl px-6 py-5 text-white font-black text-sm uppercase tracking-widest focus:border-blue-500/50 outline-none transition-all appearance-none cursor-pointer shadow-lg"
                    >
                        <option value="global">[GL] Carga Global</option>
                        {Array.from(new Map(selectableProducts.filter(p => p.id !== 'Todos').map(p => [p.label.trim().toLowerCase(), p])).values()).map(p => (
                            <option key={p.id} value={p.id}>
                                [{p.country ? p.country.substring(0, 2) : 'XX'}] {p.label}
                            </option>
                        ))}
                    </select>
                </div>

                <div className="pt-4 flex gap-4">
                    <button
                        onClick={onClose}
                        className="flex-1 px-8 py-5 rounded-2xl font-black text-muted uppercase tracking-widest text-[11px] hover:bg-hover-bg transition-all"
                    >
                        Cancelar
                    </button>
                    <button
                        disabled={saving}
                        onClick={onUpdateProduct}
                        className="flex-[2] bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-foreground uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-blue-600/20"
                    >
                        {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Actualizar Vinculación'}
                    </button>
                </div>
            </div>
        </ModalOverlay>
    );
}
