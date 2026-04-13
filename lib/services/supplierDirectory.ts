import { getAppData, setAppData } from '../firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface Supplier {
    id: string;
    nombre: string;
    contacto: string;
    telefono: string;
    whatsapp?: string;
    email?: string;
    pais: string;
    moneda: 'USD' | 'COP';
    condicionesPago: string;
    notas: string;
    createdAt: number;
    updatedAt: number;
}

const DIRECTORY_KEY = 'supplier_directory';

// ── CRUD ────────────────────────────────────────────────────────────────────

export async function getSuppliers(userId: string): Promise<Supplier[]> {
    if (!userId) return [];
    const data = await getAppData<Supplier[]>(DIRECTORY_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function saveSupplier(supplier: Supplier, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getSuppliers(userId);
    const filtered = current.filter(s => s.id !== supplier.id);
    await setAppData(DIRECTORY_KEY, [...filtered, { ...supplier, updatedAt: Date.now() }], userId);
}

export async function deleteSupplier(supplierId: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getSuppliers(userId);
    const filtered = current.filter(s => s.id !== supplierId);
    await setAppData(DIRECTORY_KEY, filtered, userId);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function generateSupplierId(): string {
    return `sup_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
}
