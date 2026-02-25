import { DollarSign, Loader2 } from 'lucide-react';
import ModalOverlay from '@/components/common/ModalOverlay';

interface ProductOption {
    id: string;
    label: string;
    country?: string;
}

interface ManualSpendModalProps {
    date: string;
    setDate: (date: string) => void;
    amount: string;
    setAmount: (amount: string) => void;
    productId: string;
    setProductId: (id: string) => void;
    selectableProducts: ProductOption[];
    saving: boolean;
    onSubmit: (e: React.FormEvent) => void;
    onClose: () => void;
}

export default function ManualSpendModal({
    date,
    setDate,
    amount,
    setAmount,
    productId,
    setProductId,
    selectableProducts,
    saving,
    onSubmit,
    onClose,
}: ManualSpendModalProps) {
    return (
        <ModalOverlay onClose={onClose}>
            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-8">Registrar Gasto Manual</h3>
            <form onSubmit={onSubmit} className="space-y-6">
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest px-2">Fecha del Gasto</label>
                    <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full bg-card border border-card-border rounded-2xl px-6 py-4 text-white font-mono text-sm focus:border-orange-500/50 outline-none transition-all" />
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest px-2">Monto Invertido</label>
                    <div className="relative">
                        <DollarSign className="absolute left-6 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        <input type="number" placeholder="0.00" value={amount} onChange={e => setAmount(e.target.value)} className="w-full bg-card border border-card-border rounded-2xl pl-14 pr-6 py-4 text-white font-mono text-sm focus:border-orange-500/50 outline-none transition-all" />
                    </div>
                </div>
                <div className="space-y-2">
                    <label className="text-[10px] font-black text-muted uppercase tracking-widest px-2">Producto / Destino</label>
                    <select value={productId} onChange={e => setProductId(e.target.value)} className="w-full bg-card border border-card-border rounded-2xl px-6 py-4 text-foreground font-bold text-xs uppercase tracking-widest focus:border-orange-500/50 outline-none transition-all appearance-none cursor-pointer">
                        <option value="global">[GL] Carga Global</option>
                        {Array.from(new Map(selectableProducts.filter(p => p.id !== 'Todos').map(p => [p.label.trim().toLowerCase(), p])).values()).map(p => (
                            <option key={p.id} value={p.id}>
                                [{p.country ? p.country.substring(0, 2) : 'XX'}] {p.label}
                            </option>
                        ))}
                    </select>
                </div>
                <div className="pt-4">
                    <button disabled={saving} className="w-full bg-orange-600 hover:bg-orange-500 py-5 rounded-2xl font-black text-foreground uppercase tracking-[0.2em] text-[11px] transition-all shadow-lg shadow-orange-600/20">
                        {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Guardar Datos'}
                    </button>
                </div>
            </form>
        </ModalOverlay>
    );
}
