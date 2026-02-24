import { getAppData, setAppData } from '../firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export const DEFAULT_CATEGORIES = [
    'Aplicaciones',
    'Fullfilment',
    'Envíos',
    'Nómina',
    'Servicios',
    'Gastos Bancarios',
    'Otros Gastos',
    'Inversiones',
    'Impuestos',
    'Marketing',
    'Pendiente',
] as string[];

export type ExpenseCategory = string;

export interface Expense {
    id: string;
    category: ExpenseCategory;
    subcategory: string;       // e.g. "Shopify Lucent", "Arriendo"
    amount: number;            // In COP
    currency: string;          // Default 'COP'
    date: string;              // YYYY-MM-DD
    month: number;             // 1-12
    year: number;              // 2026
    notes?: string;
    recurring?: boolean;
    createdAt: number;
    updatedAt: number;
}

const EXPENSES_KEY = 'berry_expenses';
const CATEGORIES_KEY = 'berry_categories';

// ── CRUD Functions ──────────────────────────────────────────────────────────

export async function getCategories(userId: string = ''): Promise<string[]> {
    if (!userId) return DEFAULT_CATEGORIES;
    const data = await getAppData<string[]>(CATEGORIES_KEY, userId);
    if (Array.isArray(data) && data.length > 0) return data;
    return DEFAULT_CATEGORIES;
}

export async function saveCategory(category: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getCategories(userId);
    if (current.includes(category)) return;
    await setAppData(CATEGORIES_KEY, [...current, category], userId);
}

export async function deleteCategory(category: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getCategories(userId);
    const filtered = current.filter(c => c !== category);
    await setAppData(CATEGORIES_KEY, filtered, userId);
}

export async function getExpenses(userId: string = ''): Promise<Expense[]> {
    if (!userId) return [];
    const data = await getAppData<Expense[]>(EXPENSES_KEY, userId);
    return Array.isArray(data) ? data : [];
}

export async function saveExpense(expense: Expense, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getExpenses(userId);
    const filtered = current.filter(e => e.id !== expense.id);
    await setAppData(EXPENSES_KEY, [...filtered, expense], userId);
}

export async function deleteExpense(expenseId: string, userId: string): Promise<void> {
    if (!userId) return;
    const current = await getExpenses(userId);
    const filtered = current.filter(e => e.id !== expenseId);
    await setAppData(EXPENSES_KEY, filtered, userId);
}

export async function clearAllExpenses(userId: string): Promise<void> {
    if (!userId) return;
    await setAppData(EXPENSES_KEY, [], userId);
}

export async function bulkSaveExpenses(expenses: Expense[], userId: string): Promise<void> {
    if (!userId) return;
    const current = await getExpenses(userId);
    // Merge: new expenses replace any with matching IDs
    const newIds = new Set(expenses.map(e => e.id));
    const kept = current.filter(e => !newIds.has(e.id));
    await setAppData(EXPENSES_KEY, [...kept, ...expenses], userId);
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function getExpensesByMonth(expenses: Expense[], month: number, year: number): Expense[] {
    return expenses.filter(e => e.month === month && e.year === year);
}

export function getExpensesByCategory(expenses: Expense[], category: ExpenseCategory): Expense[] {
    return expenses.filter(e => e.category === category);
}

export function totalByCategory(expenses: Expense[]): Record<string, number> {
    const totals: Record<string, number> = {};
    expenses.forEach(e => {
        totals[e.category] = (totals[e.category] || 0) + e.amount;
    });
    return totals;
}

export function totalByMonth(expenses: Expense[], year: number): Record<number, number> {
    const totals: Record<number, number> = {};
    expenses.filter(e => e.year === year).forEach(e => {
        totals[e.month] = (totals[e.month] || 0) + e.amount;
    });
    return totals;
}

export const CATEGORY_COLORS: Record<ExpenseCategory, string> = {
    'Aplicaciones': '#8b5cf6',
    'Fullfilment': '#06b6d4',
    'Envíos': '#f59e0b',
    'Nómina': '#ef4444',
    'Servicios': '#10b981',
    'Gastos Bancarios': '#6366f1',
    'Otros Gastos': '#78716c',
    'Inversiones': '#ec4899',
    'Impuestos': '#d75c33',
    'Marketing': '#f97316',
    'Pendiente': '#94a3b8',
};

export function getCategoryColor(category: string): string {
    return CATEGORY_COLORS[category] || '#6366f1';
}

export const MONTH_NAMES = ['ENE', 'FEB', 'MAR', 'ABR', 'MAY', 'JUN', 'JUL', 'AGO', 'SEP', 'OCT', 'NOV', 'DIC'];
export const MONTH_NAMES_FULL = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
