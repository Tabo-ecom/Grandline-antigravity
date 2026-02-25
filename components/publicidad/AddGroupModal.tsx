import { Loader2 } from 'lucide-react';
import ModalOverlay from '@/components/common/ModalOverlay';

interface ProductOption {
    id: string;
    label: string;
}

interface AddGroupModalProps {
    editingGroupId: string | null;
    newGroupName: string;
    setNewGroupName: (name: string) => void;
    newGroupProducts: string[];
    setNewGroupProducts: (products: string[]) => void;
    availableProducts: ProductOption[];
    saving: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}

export default function AddGroupModal({
    editingGroupId,
    newGroupName,
    setNewGroupName,
    newGroupProducts,
    setNewGroupProducts,
    availableProducts,
    saving,
    onSubmit,
    onClose,
}: AddGroupModalProps) {
    return (
        <ModalOverlay onClose={onClose}>
            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-8">
                {editingGroupId ? 'Editar Grupo de Productos' : 'Crear Grupo de Productos'}
            </h3>
            <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest px-2">Nombre del Grupo</label>
                    <input type="text" placeholder="Ej. Promoción Verano" value={newGroupName} onChange={e => setNewGroupName(e.target.value)} className="w-full bg-card border border-card-border rounded-2xl px-6 py-4 text-white font-mono text-sm focus:border-purple-500/50 outline-none transition-all" required />
                </div>
                <div className="space-y-2 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest px-2">Seleccionar Productos (mín 2)</label>
                    <div className="flex flex-col gap-2">
                        {Array.from(new Map(availableProducts.filter(p => p.id !== 'Todos').map(p => [p.label.trim().toLowerCase(), p])).values()).map(p => (
                            <label key={p.id} className="flex items-center gap-3 p-3 bg-hover-bg rounded-xl border border-card-border cursor-pointer hover:bg-white/10 transition-colors">
                                <input
                                    type="checkbox"
                                    checked={newGroupProducts.includes(p.id)}
                                    onChange={(e) => {
                                        if (e.target.checked) setNewGroupProducts([...newGroupProducts, p.id]);
                                        else setNewGroupProducts(newGroupProducts.filter(id => id !== p.id));
                                    }}
                                    className="w-4 h-4 rounded bg-black border-gray-700 text-purple-600 focus:ring-purple-600 focus:ring-offset-gray-900"
                                />
                                <span className="text-sm text-foreground/80 font-medium">{p.label} <span className="text-[10px] text-muted">({p.id})</span></span>
                            </label>
                        ))}
                    </div>
                </div>
                <div className="flex gap-4 pt-4 border-t border-card-border">
                    <button type="button" onClick={onClose} className="flex-1 px-6 py-4 rounded-2xl bg-hover-bg hover:bg-white/10 text-white text-[11px] font-black uppercase tracking-widest transition-all">Cancelar</button>
                    <button type="submit" disabled={saving || newGroupProducts.length < 2 || !newGroupName} className="flex-1 px-6 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-600/20">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (editingGroupId ? 'Actualizar Grupo' : 'Crear Grupo')}
                    </button>
                </div>
            </form>
        </ModalOverlay>
    );
}
