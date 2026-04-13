import { getAppData, setAppData } from '../firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Warranty {
    id: string;
    productoId: string;
    productoNombre: string;
    variacionId?: string;
    variacion?: string;
    descripcion: string;
    costo: number;
    fecha: string;               // YYYY-MM-DD
    estado: 'pendiente' | 'resuelta' | 'rechazada';
    solucion?: string;
    createdAt: number;
    updatedAt: number;
}

const WARRANTIES_KEY = 'supplier_warranties';

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function getWarranties(userId: string): Promise<Warranty[]> {
    if (!userId) return [];
    const data = await getAppData<Warranty[]>(WARRANTIES_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function saveWarranty(warranty: Warranty, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getWarranties(userId);
    const filtered = current.filter(w => w.id !== warranty.id);
    await setAppData(WARRANTIES_KEY, [...filtered, { ...warranty, updatedAt: Date.now() }], userId);
}

export async function deleteWarranty(warrantyId: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getWarranties(userId);
    const filtered = current.filter(w => w.id !== warrantyId);
    await setAppData(WARRANTIES_KEY, filtered, userId);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getWarrantiesByMonth(warranties: Warranty[], month: number, year: number): Warranty[] {
    return warranties.filter(w => {
        const [y, m] = w.fecha.split('-').map(Number);
        return y === year && m === month;
    });
}

export function totalWarrantyCost(warranties: Warranty[]): number {
    return warranties.reduce((sum, w) => sum + w.costo, 0);
}

export function totalWarrantyCostByMonth(warranties: Warranty[], month: number, year: number): number {
    return getWarrantiesByMonth(warranties, month, year).reduce((sum, w) => sum + w.costo, 0);
}
