'use client';

import React, { useState, useEffect, useMemo } from 'react';
import {
    Loader2, Plus, X, Trash2, Edit3, ChevronDown, ChevronRight,
    TrendingUp, TrendingDown, DollarSign, Users, Cpu, Building,
    Calendar, Save, AlertCircle, FileSpreadsheet, Warehouse, ShieldCheck
} from 'lucide-react';
import {
    AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
    PieChart, Pie, Cell, Legend, BarChart, Bar
} from 'recharts';
import { useAuth } from '@/lib/context/AuthContext';
// Berry uses effectiveUid (team_id) for all data so team members share expenses
import {
    Expense, ExpenseCategory, DEFAULT_CATEGORIES, CATEGORY_COLORS, getCategoryColor,
    MONTH_NAMES, MONTH_NAMES_FULL,
    getExpenses, saveExpense, deleteExpense, bulkSaveExpenses, clearAllExpenses,
    getCategories, saveCategory, deleteCategory,
    getExpensesByMonth, totalByCategory, totalByMonth
} from '@/lib/services/expenses';
import { getAdSpendHistory, AdSpend, getCampaignMappings, CampaignMapping } from '@/lib/services/marketing';
import { useCurrency } from '@/lib/hooks/useCurrency';
import { toCOP } from '@/lib/utils/currency';
import InfoTooltip from '@/components/common/InfoTooltip';
import { useSupplierData } from '@/lib/hooks/useSupplierData';
import type { SupplierKPIResults } from '@/lib/calculations/supplierKpis';
import { useDashboardData, type ExtendedDropiOrder } from '@/lib/hooks/useDashboardData';
import { parseDropiDate } from '@/lib/utils/date-parsers';
import { calculateKPIs, type KPIResults } from '@/lib/calculations/kpis';

// ── Formatters ──────────────────────────────────────────────────────────────
const fmtCOP = (v: number) => {
    if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
    if (Math.abs(v) >= 1_000) return `$${(v / 1_000).toFixed(0)}K`;
    return `$${v.toLocaleString('es-CO')}`;
};
const fmtFull = (v: number) => `$${v.toLocaleString('es-CO', { maximumFractionDigits: 0 })}`;

// ── Category Icons ──────────────────────────────────────────────────────────
const CATEGORY_ICONS: Record<ExpenseCategory, React.ElementType> = {
    'Aplicaciones': Cpu,
    'Fullfilment': FileSpreadsheet,
    'Envíos': FileSpreadsheet,
    'Nómina': Users,
    'Servicios': Building,
    'Gastos Bancarios': DollarSign,
    'Otros Gastos': AlertCircle,
    'Inversiones': TrendingUp,
    'Impuestos': FileSpreadsheet,
    'Pendiente': AlertCircle,
    'Marketing': TrendingUp,
    'Costos Bodega': Warehouse,
    'Garantías': ShieldCheck,
};

export default function BerryPage() {
    const { effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [expenses, setExpenses] = useState<Expense[]>([]);

    // Filters
    const now = new Date();
    const { rates } = useCurrency();
    const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
    const [selectedYear, setSelectedYear] = useState(now.getFullYear());
    const [viewMode, setViewMode] = useState<'monthly' | 'annual'>('monthly');
    const [categories, setCategories] = useState<string[]>(DEFAULT_CATEGORIES);
    const [adSpendHistory, setAdSpendHistory] = useState<AdSpend[]>([]);
    const [mappings, setMappings] = useState<CampaignMapping[]>([]);
    const [newCategoryName, setNewCategoryName] = useState('');
    const [isManagingCategories, setIsManagingCategories] = useState(false);

    // Modal
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingExpense, setEditingExpense] = useState<Expense | null>(null);
    const [saving, setSaving] = useState(false);

    // Form fields
    const [formCategory, setFormCategory] = useState<ExpenseCategory>('Aplicaciones');
    const [formSubcategory, setFormSubcategory] = useState('');
    const [formAmount, setFormAmount] = useState('');
    const [formDate, setFormDate] = useState(new Date().toISOString().split('T')[0]);
    const [formNotes, setFormNotes] = useState('');
    const [formRecurring, setFormRecurring] = useState(false);

    // Tab
    const [activeTab, setActiveTab] = useState<'gastos' | 'pnl'>('gastos');

    // Expanded categories
    const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set());
    const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set());

    // ── Load Data ───────────────────────────────────────────────────────────
    useEffect(() => {
        async function load() {
            try {
                const [expData, catData, adData, mapData] = await Promise.all([
                    getExpenses(effectiveUid || '').catch(e => { console.error("Failed getExpenses:", e); throw e; }),
                    getCategories(effectiveUid || '').catch(e => { console.error("Failed getCategories:", e); throw e; }),
                    getAdSpendHistory(effectiveUid || '').catch(e => { console.error("Failed getAdSpendHistory:", e); throw e; }),
                    getCampaignMappings(effectiveUid || '').catch(e => { console.error("Failed getCampaignMappings:", e); throw e; })
                ]);
                setExpenses(expData);
                setCategories(catData);
                setAdSpendHistory(adData);
                setMappings(mapData);
            } catch (err) {
                console.error('Error loading Berry data (Detailed):', err);
            } finally {
                setLoading(false);
            }
        }
        load();
    }, []);

    // ── Computed ─────────────────────────────────────────────────────────────
    // Unified Expenses (including Facebook Ads)
    const allExpenses = useMemo(() => {
        const result = [...expenses];

        // 1. Filter Ad Spend to only mapped campaigns
        const mappedCampaigns = new Set(mappings.map(m => m.campaignName.trim().toLowerCase()));

        // Build campaign→country lookup from mappings (uses mapping.country when available)
        const campaignCountryMap = new Map<string, string>();
        mappings.forEach(m => {
            if (m.country) {
                campaignCountryMap.set(`${m.platform}_${m.campaignName.trim().toLowerCase()}`, m.country);
            }
        });

        // Facebook + TikTok, filtered by mapping
        const rawFbAds = adSpendHistory.filter(s =>
            (s.platform === 'facebook' || s.platform === 'tiktok') &&
            s.campaignName &&
            mappedCampaigns.has(s.campaignName.trim().toLowerCase())
        );

        // 2. Berry-specific dedup: ONE entry per date+platform+campaign (most recent wins)
        const berryDedup: Record<string, AdSpend> = {};
        rawFbAds.forEach(s => {
            const dateKey = (s.date || '').split(' ')[0];
            const campaignKey = (s.campaignName || 'global').replace(/\W/g, '').toLowerCase();
            const idKey = `${dateKey}_${s.platform}_${campaignKey}`;

            if (!berryDedup[idKey] || (s.updatedAt || 0) > (berryDedup[idKey].updatedAt || 0)) {
                berryDedup[idKey] = s;
            }
        });
        const dedupedFbAds = Object.values(berryDedup);

        // 3. Aggregate by Platform + Country + Month to "Unify"
        // Currency correction is now handled at the service level (fixAdSpendCurrencies in marketing.ts)
        const monthlyGroups: Record<string, { amount: number, platform: string, country: string, year: number, month: number, updatedAt: number }> = {};

        dedupedFbAds.forEach(ad => {
            const dateParts = ad.date.split('-');
            if (dateParts.length < 2) return;

            const year = parseInt(dateParts[0]);
            const month = parseInt(dateParts[1]);
            const amount = rates ? toCOP(ad.amount, ad.currency, rates) : ad.amount;

            // Use mapping country if available, fallback to ad.country
            const campaignKey = ad.campaignName ? `${ad.platform}_${ad.campaignName.trim().toLowerCase()}` : '';
            const country = (campaignKey && campaignCountryMap.get(campaignKey)) || ad.country;

            const key = `${ad.platform}_${country}_${year}_${month}`;

            if (!monthlyGroups[key]) {
                monthlyGroups[key] = {
                    amount: 0,
                    platform: ad.platform,
                    country,
                    year,
                    month,
                    updatedAt: ad.updatedAt || Date.now()
                };
            }
            monthlyGroups[key].amount += amount;
            if (ad.updatedAt && ad.updatedAt > monthlyGroups[key].updatedAt) {
                monthlyGroups[key].updatedAt = ad.updatedAt;
            }
        });

        // 4. Convert groups to virtual expenses
        Object.values(monthlyGroups).forEach(g => {
            const platformLabel = g.platform === 'facebook' ? 'Meta Ads' :
                g.platform === 'tiktok' ? 'TikTok Ads' : g.platform;

            result.push({
                id: `fb_summary_${g.platform}_${g.country}_${g.year}_${g.month}`,
                category: 'Marketing',
                subcategory: `${platformLabel} - ${g.country.charAt(0).toUpperCase() + g.country.slice(1)}`,
                amount: Math.round(g.amount),
                currency: 'COP',
                date: `${g.year}-${String(g.month).padStart(2, '0')}-01`, // Representative date
                month: g.month,
                year: g.year,
                notes: `Consolidado mensual vía API (Solo mapeados).`,
                createdAt: g.updatedAt,
                updatedAt: g.updatedAt
            });
        });

        return result;
    }, [expenses, adSpendHistory, mappings, rates]);

    const monthExpenses = useMemo(
        () => {
            if (viewMode === 'annual') {
                return allExpenses.filter(e => e.year === selectedYear);
            }
            return allExpenses.filter(e => e.month === selectedMonth && e.year === selectedYear);
        },
        [allExpenses, selectedMonth, selectedYear, viewMode]
    );

    const prevMonthExpenses = useMemo(() => {
        const pm = selectedMonth === 1 ? 12 : selectedMonth - 1;
        const py = selectedMonth === 1 ? selectedYear - 1 : selectedYear;
        return allExpenses.filter(e => e.month === pm && e.year === py);
    }, [allExpenses, selectedMonth, selectedYear]);

    const categoryTotals = useMemo(() => totalByCategory(monthExpenses), [monthExpenses]);
    const prevCategoryTotals = useMemo(() => totalByCategory(prevMonthExpenses), [prevMonthExpenses]);

    const totalMonth = useMemo(() => monthExpenses.reduce((s, e) => s + e.amount, 0), [monthExpenses]);
    const totalPrevMonth = useMemo(() => prevMonthExpenses.reduce((s, e) => s + e.amount, 0), [prevMonthExpenses]);
    const monthChange = totalPrevMonth > 0 ? ((totalMonth - totalPrevMonth) / totalPrevMonth) * 100 : 0;

    // ── P&L: Supplier data ──────────────────────────────────────────────────
    const supplierPeriodRange = useMemo(() => {
        if (viewMode === 'annual') {
            return { start: new Date(selectedYear, 0, 1), end: new Date(selectedYear, 11, 31, 23, 59, 59) };
        }
        return {
            start: new Date(selectedYear, selectedMonth - 1, 1),
            end: new Date(selectedYear, selectedMonth, 0, 23, 59, 59),
        };
    }, [selectedMonth, selectedYear, viewMode]);

    const supplierYearRange = useMemo(() => ({
        start: new Date(selectedYear, 0, 1),
        end: new Date(selectedYear, 11, 31, 23, 59, 59),
    }), [selectedYear]);

    const supplierPeriod = useSupplierData(supplierPeriodRange);
    const supplierYear = useSupplierData(supplierYearRange);

    // ── P&L: Sales/Dropi data ─────────────────────────────────────────────────
    const dashData = useDashboardData();

    const salesOrdersByMonth = useMemo(() => {
        const buckets: Record<number, ExtendedDropiOrder[]> = {};
        for (let m = 1; m <= 12; m++) buckets[m] = [];
        dashData.rawOrders.forEach(o => {
            const d = parseDropiDate(o.FECHA);
            if (d && d.getFullYear() === selectedYear) {
                buckets[d.getMonth() + 1]?.push(o);
            }
        });
        return buckets;
    }, [dashData.rawOrders, selectedYear]);

    const berrySalesOrders = useMemo(() => {
        if (viewMode === 'annual') return Object.values(salesOrdersByMonth).flat();
        return salesOrdersByMonth[selectedMonth] || [];
    }, [salesOrdersByMonth, selectedMonth, viewMode]);

    const berryAdsTotal = useMemo(() => {
        return monthExpenses
            .filter(e => e.category === 'Marketing')
            .reduce((sum, e) => sum + e.amount, 0);
    }, [monthExpenses]);

    const salesKpis = useMemo<KPIResults | null>(() => {
        if (dashData.loading || !berrySalesOrders.length) return null;
        return calculateKPIs(berrySalesOrders, berryAdsTotal);
    }, [berrySalesOrders, berryAdsTotal, dashData.loading]);

    const salesByCountry = useMemo(() => {
        if (!berrySalesOrders.length) return [];
        const countries = [...new Set(berrySalesOrders.map(o => o.country))];
        return countries.map(country => {
            const orders = berrySalesOrders.filter(o => o.country === country);
            const countryAds = monthExpenses
                .filter(e => e.category === 'Marketing' && e.subcategory?.toLowerCase().includes(country.toLowerCase()))
                .reduce((sum, e) => sum + e.amount, 0);
            return { country, kpis: calculateKPIs(orders, countryAds) };
        }).sort((a, b) => b.kpis.ing_real - a.kpis.ing_real);
    }, [berrySalesOrders, monthExpenses]);

    const salesTrend = useMemo(() => {
        return Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const mOrders = salesOrdersByMonth[m] || [];
            const mAds = allExpenses
                .filter(e => e.category === 'Marketing' && e.year === selectedYear && e.month === m)
                .reduce((sum, e) => sum + e.amount, 0);
            const k = calculateKPIs(mOrders, mAds);
            return { mes: MONTH_NAMES[i], ingresos: k.ing_real, costos: k.cpr + k.fl_ent + k.fl_dev + k.fl_tra + k.g_ads, utilidad: k.u_real };
        });
    }, [salesOrdersByMonth, allExpenses, selectedYear]);

    // Trend data (Always Monthly for Berry Dashboard as per user request)
    const trendData = useMemo(() => {
        const byMonth: Record<number, number> = {};
        const targetYear = Number(selectedYear);

        allExpenses.forEach(e => {
            if (Number(e.year) === targetYear) {
                const m = Number(e.month);
                byMonth[m] = (byMonth[m] || 0) + e.amount;
            }
        });

        return Array.from({ length: 12 }, (_, i) => ({
            label: MONTH_NAMES[i],
            total: Math.round(byMonth[i + 1] || 0),
        }));
    }, [allExpenses, selectedYear]);

    // Donut data
    const donutData = useMemo(() => {
        // We filter out hidden categories for the visual
        const visibleEntries = Object.entries(categoryTotals)
            .filter(([name, v]) => v > 0 && !hiddenCategories.has(name));

        const visibleTotal = visibleEntries.reduce((acc, [, v]) => acc + v, 0);

        return visibleEntries
            .map(([name, value]) => ({
                name,
                value,
                percentage: visibleTotal > 0 ? (value / visibleTotal) * 100 : 0,
                color: getCategoryColor(name),
            }))
            .sort((a, b) => b.value - a.value);
    }, [categoryTotals, hiddenCategories]);

    // Update trend data to respect hidden categories
    const filteredTrendData = useMemo(() => {
        const byMonth: Record<number, number> = {};
        const targetYear = Number(selectedYear);

        allExpenses.forEach(e => {
            if (Number(e.year) === targetYear && !hiddenCategories.has(e.category)) {
                const m = Number(e.month);
                byMonth[m] = (byMonth[m] || 0) + e.amount;
            }
        });

        return Array.from({ length: 12 }, (_, i) => ({
            label: MONTH_NAMES[i],
            total: Math.round(byMonth[i + 1] || 0),
        }));
    }, [allExpenses, selectedYear, hiddenCategories]);

    // Category-grouped items for table
    const groupedByCategory = useMemo(() => {
        const groups: Record<string, Expense[]> = {};
        categories.forEach(c => { groups[c] = []; });
        monthExpenses.forEach(e => {
            if (!groups[e.category]) groups[e.category] = [];
            groups[e.category].push(e);
        });
        // Sort each group by amount desc
        Object.values(groups).forEach(arr => arr.sort((a, b) => b.amount - a.amount));
        return groups;
    }, [categories, monthExpenses]);

    // KPI cards data
    const kpis = useMemo(() => {
        const getVal = (cat: string) => categoryTotals[cat] || 0;
        const getPrevVal = (cat: string) => prevCategoryTotals[cat] || 0;

        return [
            { label: 'Total Gastos', value: totalMonth, prev: totalPrevMonth, icon: DollarSign, color: '#d75c33', participation: 100 },
            { label: 'Marketing', value: getVal('Marketing'), prev: getPrevVal('Marketing'), icon: TrendingUp, color: '#f97316', participation: totalMonth > 0 ? (getVal('Marketing') / totalMonth) * 100 : 0 },
            { label: 'Nómina', value: getVal('Nómina'), prev: getPrevVal('Nómina'), icon: Users, color: '#ef4444', participation: totalMonth > 0 ? (getVal('Nómina') / totalMonth) * 100 : 0 },
            { label: 'Aplicaciones', value: getVal('Aplicaciones'), prev: getPrevVal('Aplicaciones'), icon: Cpu, color: '#8b5cf6', participation: totalMonth > 0 ? (getVal('Aplicaciones') / totalMonth) * 100 : 0 },
        ];
    }, [categoryTotals, prevCategoryTotals, totalMonth, totalPrevMonth]);

    // ── Handlers ────────────────────────────────────────────────────────────
    const openAddModal = () => {
        setEditingExpense(null);
        setFormCategory('Aplicaciones');
        setFormSubcategory('');
        setFormAmount('');
        setFormDate(new Date().toISOString().split('T')[0]);
        setFormNotes('');
        setFormRecurring(false);
        setIsModalOpen(true);
    };

    const openEditModal = (expense: Expense) => {
        setEditingExpense(expense);
        setFormCategory(expense.category);
        setFormSubcategory(expense.subcategory);
        setFormAmount(expense.amount.toString());
        setFormDate(expense.date);
        setFormNotes(expense.notes || '');
        setFormRecurring(expense.recurring || false);
        setIsModalOpen(true);
    };

    const handleSave = async () => {
        if (!formSubcategory || !formAmount || !formDate) return;
        setSaving(true);
        try {
            const dateObj = new Date(formDate + 'T12:00:00');
            const expense: Expense = {
                id: editingExpense?.id || `exp_${Date.now()}_${Math.random().toString(36).substring(7)}`,
                category: formCategory,
                subcategory: formSubcategory.trim(),
                amount: parseFloat(formAmount),
                currency: 'COP',
                date: formDate,
                month: dateObj.getMonth() + 1,
                year: dateObj.getFullYear(),
                notes: formNotes.trim() || undefined,
                recurring: formRecurring || undefined,
                createdAt: editingExpense?.createdAt || Date.now(),
                updatedAt: Date.now(),
            };
            await saveExpense(expense, effectiveUid || '');
            setExpenses(prev => {
                const filtered = prev.filter(e => e.id !== expense.id);
                return [...filtered, expense];
            });
            setIsModalOpen(false);
        } catch (err) {
            console.error('Error saving expense:', err);
            alert('Error al guardar el gasto');
        } finally {
            setSaving(false);
        }
    };

    const handleDelete = async (id: string) => {
        if (id.startsWith('fb_')) return; // Protected
        if (!confirm('¿Eliminar este gasto?')) return;
        try {
            await deleteExpense(id, effectiveUid || '');
            setExpenses(prev => prev.filter(e => e.id !== id));
        } catch (err) {
            console.error('Error deleting expense:', err);
        }
    };

    const handleClearAll = async () => {
        if (!confirm('⚠️ ¡ESTA ACCIÓN NO SE PUEDE DESHACER!\n\n¿Estás seguro de que quieres eliminar TODOS los gastos del sistema?')) return;
        if (!confirm('Última advertencia: ¿Confirmas el borrado total de datos de Berry?')) return;

        setLoading(true);
        try {
            await clearAllExpenses(effectiveUid || '');
            setExpenses([]);
            alert('Todos los gastos han sido eliminados.');
        } catch (err) {
            console.error('Error clearing expenses:', err);
            alert('Error al eliminar los gastos.');
        } finally {
            setLoading(false);
        }
    };

    const handleAddCategory = async () => {
        if (!newCategoryName.trim()) return;
        try {
            await saveCategory(newCategoryName.trim(), effectiveUid || '');
            setCategories(prev => [...prev, newCategoryName.trim()]);
            setNewCategoryName('');
        } catch (err) {
            console.error('Error adding category:', err);
        }
    };

    const handleDeleteCategory = async (cat: string) => {
        // Assuming DEFAULT_CATEGORIES is defined elsewhere, e.g., const DEFAULT_CATEGORIES = ['Marketing', 'Nómina', 'Aplicaciones', 'Servicios', 'Envíos', 'Gastos Bancarios', 'Impuestos', 'Fullfilment', 'Inversiones', 'Pendiente'];
        if (DEFAULT_CATEGORIES.includes(cat)) {
            alert('Las categorías base no se pueden eliminar.');
            return;
        }
        if (!confirm(`¿Eliminar la categoría "${cat}"?`)) return;
        try {
            await deleteCategory(cat, effectiveUid || '');
            setCategories(prev => prev.filter(c => c !== cat));
        } catch (err) {
            console.error('Error removing category:', err);
        }
    };

    const toggleCategory = (cat: string) => {
        setExpandedCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    const toggleHideCategory = (cat: string) => {
        setHiddenCategories(prev => {
            const next = new Set(prev);
            if (next.has(cat)) next.delete(cat);
            else next.add(cat);
            return next;
        });
    };

    const handleUpdateCategory = async (expense: Expense, newCategory: ExpenseCategory) => {
        try {
            const updated = { ...expense, category: newCategory, updatedAt: Date.now() };
            await saveExpense(updated, effectiveUid || '');
            setExpenses(prev => prev.map(e => e.id === expense.id ? updated : e));
        } catch (err) {
            console.error('Error updating category:', err);
            alert('Error al cambiar la categoría');
        }
    };

    const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLoading(true);
        try {
            const reader = new FileReader();
            reader.onload = async (evt) => {
                const bstr = evt.target?.result;
                const XLSX = await import('xlsx');
                const wb = XLSX.read(bstr, { type: 'binary' });
                const wsname = wb.SheetNames[0];
                const ws = wb.Sheets[wsname];
                const data = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];

                const importedExpenses: Expense[] = [];

                // Identify mapping from GASTOS 2026.xlsx
                // We look for rows that have data in month columns
                data.forEach((row, rowIndex) => {
                    // Skip header-like rows (usually first few)
                    if (rowIndex < 1) return;

                    const label = row[0]?.toString() || '';
                    if (!label || label.toLowerCase().includes('total') || label.toLowerCase().includes('mes')) return;

                    // Improved Category Matching (Fuzzy)
                    let category: ExpenseCategory = 'Pendiente';
                    const cleanLabel = label.toLowerCase();

                    if (cleanLabel.includes('nomina') || cleanLabel.includes('sueldo') || cleanLabel.includes('prestacion')) category = 'Nómina';
                    else if (cleanLabel.includes('shopify') || cleanLabel.includes('app') || cleanLabel.includes('software')) category = 'Aplicaciones';
                    else if (cleanLabel.includes('arriendo') || cleanLabel.includes('servicio') || cleanLabel.includes('luz') || cleanLabel.includes('agua')) category = 'Servicios';
                    else if (cleanLabel.includes('envio') || cleanLabel.includes('flete') || cleanLabel.includes('transportadora')) category = 'Envíos';
                    else if (cleanLabel.includes('banc') || cleanLabel.includes('comision') || cleanLabel.includes('impuesto 4x1000')) category = 'Gastos Bancarios';
                    else if (cleanLabel.includes('impuest') || cleanLabel.includes('dian') || cleanLabel.includes('iva')) category = 'Impuestos';
                    else if (cleanLabel.includes('fullfilment') || cleanLabel.includes('bodega')) category = 'Fullfilment';
                    else if (cleanLabel.includes('invers') || cleanLabel.includes('mueble') || cleanLabel.includes('computador')) category = 'Inversiones';
                    else {
                        // Fallback to strict match if keywords fail
                        for (const cat of categories) {
                            if (cleanLabel.includes(cat.toLowerCase())) {
                                category = cat as any;
                                break;
                            }
                        }
                    }

                    // Loop through month columns (1-12)
                    for (let m = 1; m <= 12; m++) {
                        let amountStr = row[m]?.toString() || '0';
                        // Clean amount string (remove $, spaces, etc)
                        const amount = parseFloat(amountStr.replace(/[^0-9.-]+/g, ""));

                        if (amount > 1) { // Ignore small noise or 0
                            importedExpenses.push({
                                id: `imp_${Date.now()}_${rowIndex}_${m}`,
                                category,
                                subcategory: label.trim(),
                                amount,
                                currency: 'COP',
                                date: `${selectedYear}-${m.toString().padStart(2, '0')}-01`,
                                month: m,
                                year: selectedYear,
                                notes: 'Importado de Excel',
                                createdAt: Date.now(),
                                updatedAt: Date.now(),
                            });
                        }
                    }
                });

                if (importedExpenses.length > 0) {
                    await bulkSaveExpenses(importedExpenses, effectiveUid || '');
                    setExpenses(prev => [...prev, ...importedExpenses]);
                    alert(`✅ Importados ${importedExpenses.length} gastos correctamente.`);
                } else {
                    alert('No se encontraron montos válidos para importar en las columnas de meses (1-12).');
                }
            };
            reader.readAsBinaryString(file);
        } catch (err) {
            console.error('Error importing Excel:', err);
            alert('Error al procesar el archivo Excel. Verifica el formato del manual.');
        } finally {
            setLoading(false);
            if (e.target) e.target.value = ''; // Reset input
        }
    };

    // ── Render ───────────────────────────────────────────────────────────────
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
                <Loader2 className="w-10 h-10 text-[#d75c33] animate-spin" />
                <p className="text-gray-400 font-mono text-sm animate-pulse tracking-widest uppercase">Cargando Berry...</p>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background text-foreground p-3 md:p-6 font-sans transition-all duration-300">
            <div className="max-w-full mx-auto space-y-5 animate-in fade-in duration-700">

                {/* ── Header ─────────────────────────────────────────────── */}
                <div className="flex items-center justify-between">
                    <div>
                        <img src="/logos/berry-logo.png" alt="Berry" className="h-12 w-auto object-contain hidden dark:block" />
                        <img src="/logos/berry-logo-dark.png" alt="Berry" className="h-12 w-auto object-contain block dark:hidden" />
                    </div>
                    <div className="flex items-center gap-3">
                        <div className="flex items-center gap-1 bg-card border border-card-border rounded-xl p-1 mr-2">
                            <button
                                onClick={() => setViewMode('monthly')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'monthly'
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-muted hover:text-foreground hover:bg-hover-bg'
                                    }`}
                            >
                                Mensual
                            </button>
                            <button
                                onClick={() => setViewMode('annual')}
                                className={`px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${viewMode === 'annual'
                                    ? 'bg-blue-500 text-white shadow-lg shadow-blue-500/20'
                                    : 'text-muted hover:text-foreground hover:bg-hover-bg'
                                    }`}
                            >
                                Anual
                            </button>
                        </div>
                        {activeTab === 'gastos' && (
                            <>
                                <input type="file" accept=".xlsx, .xls" id="excel-import" className="hidden" onChange={handleImport} />
                                <button onClick={() => document.getElementById('excel-import')?.click()}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-card hover:bg-hover-bg text-foreground rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 border border-card-border shadow-sm">
                                    <FileSpreadsheet className="w-4 h-4" /> Importar
                                </button>
                                <button onClick={handleClearAll}
                                    className="flex items-center gap-2 px-4 py-2.5 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 border border-red-500/20">
                                    <Trash2 className="w-4 h-4" /> Eliminar Todo
                                </button>
                                <button onClick={openAddModal}
                                    className="flex items-center gap-2 px-5 py-2.5 bg-[#d75c33] hover:bg-orange-500 text-white rounded-xl font-black uppercase tracking-widest text-[10px] transition-all active:scale-95 shadow-lg shadow-orange-500/20">
                                    <Plus className="w-4 h-4" /> Nuevo Gasto
                                </button>
                            </>
                        )}
                    </div>
                </div>

                {/* ── Tab Toggle ───────────────────────────────────────────── */}
                <div className="flex gap-1 bg-card/50 border border-card-border rounded-xl p-1">
                    <button onClick={() => setActiveTab('gastos')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'gastos' ? 'bg-[#d75c33]/10 text-[#d75c33] border border-[#d75c33]/20' : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'}`}>
                        <DollarSign className="w-4 h-4" /> Gastos
                    </button>
                    <button onClick={() => setActiveTab('pnl')}
                        className={`flex items-center gap-2 px-4 py-2.5 rounded-lg text-sm font-medium transition-all ${activeTab === 'pnl' ? 'bg-[#d75c33]/10 text-[#d75c33] border border-[#d75c33]/20' : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'}`}>
                        <TrendingUp className="w-4 h-4" /> P&L
                    </button>
                </div>

                {/* ── Month Selector (Hidden in Annual Mode) ──────────────── */}
                <div className={`flex items-center gap-2 flex-wrap transition-all duration-300 ${viewMode === 'annual' ? 'opacity-30 pointer-events-none grayscale' : ''}`}>
                    <div className="flex items-center gap-1 bg-card border border-card-border rounded-xl p-1">
                        {MONTH_NAMES.map((m, i) => (
                            <button
                                key={m}
                                onClick={() => setSelectedMonth(i + 1)}
                                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all ${selectedMonth === i + 1
                                    ? 'bg-[#d75c33] text-white shadow-lg shadow-orange-500/20'
                                    : 'text-muted hover:text-foreground hover:bg-hover-bg'
                                    }`}
                            >
                                {m}
                            </button>
                        ))}
                    </div>
                    <select
                        value={selectedYear}
                        onChange={e => setSelectedYear(Number(e.target.value))}
                        className="bg-card border border-card-border rounded-xl px-3 py-2 text-xs font-bold text-muted appearance-auto focus:outline-none"
                    >
                        <option value={2025}>2025</option>
                        <option value={2026}>2026</option>
                        <option value={2027}>2027</option>
                    </select>
                </div>

                {activeTab === 'gastos' && (<>
                {/* ── KPI Cards ──────────────────────────────────────────── */}
                <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    {kpis.map(kpi => {
                        const change = kpi.prev > 0 ? ((kpi.value - kpi.prev) / kpi.prev) * 100 : 0;
                        const Icon = kpi.icon;
                        return (
                            <div key={kpi.label} className="bg-card border border-card-border rounded-2xl p-4 hover:border-accent/30 transition-all group shadow-sm">
                                <div className="flex items-center justify-between mb-3">
                                    <div className="flex items-center gap-2">
                                        <span className="text-[10px] font-black text-muted uppercase tracking-widest flex items-center gap-1">{kpi.label} {kpi.label === 'Total Gastos' ? <InfoTooltip text="Suma total de todos los gastos operativos registrados en el periodo." /> : kpi.label === 'Ads' ? <InfoTooltip text="Inversión en publicidad (Facebook + TikTok) sincronizada desde la central de anuncios." /> : kpi.label === 'Operativos' ? <InfoTooltip text="Gastos fijos del negocio: nómina, herramientas, servicios, etc." /> : <InfoTooltip text="Gastos registrados en esta categoría para el periodo seleccionado." />}</span>
                                        {kpi.label !== 'Total Gastos' && kpi.participation > 0 && (
                                            <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">
                                                {kpi.participation.toFixed(1)}%
                                            </span>
                                        )}
                                    </div>
                                    <div className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ backgroundColor: `${kpi.color}15` }}>
                                        <Icon className="w-4 h-4" style={{ color: kpi.color }} />
                                    </div>
                                </div>
                                <p className="text-xl font-black tracking-tight" style={{ color: kpi.color }}>{fmtCOP(kpi.value)}</p>
                                {kpi.prev > 0 && viewMode === 'monthly' && (
                                    <div className={`flex items-center gap-1 mt-1 text-[10px] font-bold ${change > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                        {change > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                                        {Math.abs(change).toFixed(1)}% vs {MONTH_NAMES_FULL[(selectedMonth === 1 ? 11 : selectedMonth - 2)]}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>

                {/* ── Charts Row ─────────────────────────────────────────── */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                    {/* Trend Chart */}
                    <div className="lg:col-span-2 bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                        <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-1.5">
                            {viewMode === 'monthly' ? `Tendencia Diaria · ${MONTH_NAMES_FULL[selectedMonth - 1]}` : `Tendencia Anual · ${selectedYear}`}
                            <InfoTooltip text="Evolución del gasto total a lo largo del tiempo. Permite identificar picos y patrones de gasto." />
                        </h3>
                        <div className="h-[260px]">
                            <ResponsiveContainer width="100%" height="100%">
                                <AreaChart data={filteredTrendData} margin={{ top: 5, right: 10, left: 10, bottom: 0 }}>
                                    <defs>
                                        <linearGradient id="berryGrad" x1="0" y1="0" x2="0" y2="1">
                                            <stop offset="5%" stopColor="#d75c33" stopOpacity={0.3} />
                                            <stop offset="95%" stopColor="#d75c33" stopOpacity={0} />
                                        </linearGradient>
                                    </defs>
                                    <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" />
                                    <XAxis dataKey="label" tick={{ fill: 'var(--muted)', fontSize: 10, fontWeight: 700 }} axisLine={false} tickLine={false} />
                                    <YAxis tick={{ fill: 'var(--muted)', fontSize: 10 }} axisLine={false} tickLine={false} tickFormatter={fmtCOP} width={70} />
                                    <Tooltip
                                        contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}
                                        itemStyle={{ color: 'var(--foreground)' }}
                                        formatter={(value: any) => [fmtFull(Number(value)), 'Gastos']}
                                    />
                                    <Area type="monotone" dataKey="total" stroke="#d75c33" strokeWidth={2.5} fill="url(#berryGrad)" dot={{ fill: '#d75c33', r: 3 }} activeDot={{ r: 5 }} />
                                </AreaChart>
                            </ResponsiveContainer>
                        </div>
                    </div>

                    {/* Donut Chart */}
                    <div className="bg-card border border-card-border rounded-2xl p-5 shadow-sm">
                        <div className="flex items-center justify-between mb-4">
                            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                                Distribución por Categoría <InfoTooltip text="Proporción de cada categoría sobre el gasto total. Click en una porción para ocultar/mostrar." />
                            </h3>
                            {hiddenCategories.size > 0 && (
                                <button
                                    onClick={() => setHiddenCategories(new Set())}
                                    className="text-[9px] font-bold text-[#d75c33] hover:underline uppercase tracking-tighter"
                                >
                                    Ver todo
                                </button>
                            )}
                        </div>
                        {donutData.length > 0 ? (
                            <div className="h-[260px] relative">
                                <ResponsiveContainer width="100%" height="100%">
                                    <PieChart>
                                        <Pie
                                            data={donutData}
                                            innerRadius={60}
                                            outerRadius={80}
                                            paddingAngle={4}
                                            dataKey="value"
                                            stroke="none"
                                        >
                                            {donutData.map((entry, index) => (
                                                <Cell key={`cell-${index}`} fill={entry.color} />
                                            ))}
                                        </Pie>
                                        <Tooltip
                                            contentStyle={{ background: 'var(--card-bg)', border: '1px solid var(--card-border)', borderRadius: 12, fontSize: 12, fontWeight: 700, color: 'var(--foreground)' }}
                                            itemStyle={{ color: 'var(--foreground)' }}
                                            formatter={(value: any, name: any, props: any) => [
                                                `${fmtFull(Number(value))} (${props.payload.percentage.toFixed(1)}%)`,
                                                name
                                            ]}
                                        />
                                        <Legend
                                            iconType="circle"
                                            onClick={(data: any) => toggleHideCategory(data.value)}
                                            formatter={(value, entry: any) => (
                                                <span className={`text-[10px] font-bold uppercase cursor-pointer select-none ${hiddenCategories.has(value) ? 'opacity-30 line-through' : 'text-muted'}`}>
                                                    {value} {!hiddenCategories.has(value) && (
                                                        <span className="text-[8px] opacity-40 ml-1">
                                                            {((entry.payload.value / donutData.reduce((acc, d) => acc + d.value, 0)) * 100).toFixed(0)}%
                                                        </span>
                                                    )}
                                                </span>
                                            )}
                                        />
                                    </PieChart>
                                </ResponsiveContainer>
                            </div>
                        ) : (
                            <div className="h-[260px] flex items-center justify-center">
                                <p className="text-muted text-xs text-center uppercase font-bold opacity-30 tracking-widest">Sin datos para este mes</p>
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Category Table ─────────────────────────────────────── */}
                <div className="bg-card border border-card-border rounded-2xl overflow-hidden shadow-sm">
                    <div className="px-5 py-4 border-b border-card-border flex items-center justify-between">
                        <h3 className="text-[11px] font-black text-muted uppercase tracking-widest flex items-center gap-1.5">
                            Desglose por Categoría · {viewMode === 'annual' ? `Todo ${selectedYear}` : `${MONTH_NAMES_FULL[selectedMonth - 1]} ${selectedYear}`}
                            <InfoTooltip text="Detalle de gastos agrupados por categoría. Expande una categoría para ver los gastos individuales." />
                        </h3>
                        <span className="text-xs font-bold text-gray-600">{monthExpenses.length} {viewMode === 'annual' ? 'registros' : 'gastos'}</span>
                    </div>

                    <div className="divide-y divide-card-border">
                        {categories.map((cat: string) => {
                            const items = groupedByCategory[cat] || [];
                            const catTotal = categoryTotals[cat] || 0;
                            const prevTotal = prevCategoryTotals[cat] || 0;
                            const catChange = prevTotal > 0 ? ((catTotal - prevTotal) / prevTotal) * 100 : 0;
                            const isExpanded = expandedCategories.has(cat);
                            const CatIcon = CATEGORY_ICONS[cat];
                            const catColor = CATEGORY_COLORS[cat];

                            return (
                                <div key={cat}>
                                    {/* Category Header */}
                                    <button
                                        onClick={() => toggleCategory(cat)}
                                        className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-hover-bg transition-all group"
                                    >
                                        <div className="flex items-center gap-3">
                                            {isExpanded ? <ChevronDown className="w-3.5 h-3.5 text-muted" /> : <ChevronRight className="w-3.5 h-3.5 text-muted" />}
                                            <div className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ backgroundColor: `${catColor}15` }}>
                                                <CatIcon className="w-3.5 h-3.5" style={{ color: catColor }} />
                                            </div>
                                            <span className="text-xs font-black uppercase tracking-wider text-foreground opacity-80">{cat}</span>
                                            {items.length > 0 && (
                                                <span className="text-[10px] font-bold text-muted bg-muted/10 px-2 py-0.5 rounded-full">{items.length}</span>
                                            )}
                                        </div>
                                        <div className="flex items-center gap-4">
                                            {catTotal > 0 && totalMonth > 0 && (
                                                <span className="text-[9px] font-bold text-muted bg-muted/10 px-1.5 py-0.5 rounded tabular-nums">
                                                    {((catTotal / totalMonth) * 100).toFixed(1)}%
                                                </span>
                                            )}
                                            {prevTotal > 0 && catChange !== 0 && (
                                                <span className={`text-[10px] font-bold ${catChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                                    {catChange > 0 ? '+' : ''}{catChange.toFixed(0)}%
                                                </span>
                                            )}
                                            <span className="text-sm font-black tabular-nums" style={{ color: catTotal > 0 ? catColor : '#444' }}>
                                                {fmtFull(catTotal)}
                                            </span>
                                        </div>
                                    </button>

                                    {/* Expanded Items */}
                                    {isExpanded && (
                                        <div className="bg-background/30 border-t border-card-border/50">
                                            {items.length === 0 ? (
                                                <div className="px-12 py-4 text-center">
                                                    <p className="text-[10px] text-muted italic">Sin gastos en esta categoría para este mes</p>
                                                </div>
                                            ) : (
                                                items.map(item => (
                                                    <div
                                                        key={item.id}
                                                        className="flex items-center justify-between px-5 pl-16 py-2.5 hover:bg-hover-bg/50 transition-all group/item"
                                                    >
                                                        <div className="flex items-center gap-3 flex-1 min-w-0">
                                                            <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: catColor }} />
                                                            <span className="text-xs font-bold text-muted truncate">{item.subcategory}</span>
                                                            {item.recurring && (
                                                                <span className="text-[8px] font-black bg-purple-500/10 text-purple-400 px-1.5 py-0.5 rounded uppercase">Recurrente</span>
                                                            )}
                                                            {item.notes && (
                                                                <span className="text-[9px] text-gray-600 italic truncate max-w-[200px]">{item.notes}</span>
                                                            )}
                                                        </div>
                                                        <div className="flex items-center gap-3">
                                                            {/* In-line Category Selector */}
                                                            {!item.id.startsWith('fb_') ? (
                                                                <select
                                                                    value={item.category}
                                                                    onChange={(e) => handleUpdateCategory(item, e.target.value as ExpenseCategory)}
                                                                    className="bg-transparent border-none text-[9px] font-bold text-muted hover:text-foreground focus:outline-none cursor-pointer uppercase tracking-tight"
                                                                >
                                                                    {categories.map((c: string) => (
                                                                        <option key={c} value={c} className="bg-card text-foreground">{c}</option>
                                                                    ))}
                                                                </select>
                                                            ) : (
                                                                <span className="text-[9px] font-bold text-muted uppercase tracking-tight">Lectura</span>
                                                            )}

                                                            <span className="text-[10px] text-muted/50 font-mono">{item.date}</span>
                                                            <span className="text-xs font-black text-foreground/80 tabular-nums w-28 text-right">{fmtFull(item.amount)}</span>
                                                            <div className="flex items-center gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                                                                {!item.id.startsWith('fb_') && (
                                                                    <>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); openEditModal(item); }}
                                                                            className="w-6 h-6 rounded-md hover:bg-hover-bg flex items-center justify-center text-muted hover:text-blue-400 transition-all"
                                                                        >
                                                                            <Edit3 className="w-3 h-3" />
                                                                        </button>
                                                                        <button
                                                                            onClick={(e) => { e.stopPropagation(); handleDelete(item.id); }}
                                                                            className="w-6 h-6 rounded-md hover:bg-hover-bg flex items-center justify-center text-muted hover:text-red-400 transition-all"
                                                                        >
                                                                            <Trash2 className="w-3 h-3" />
                                                                        </button>
                                                                    </>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                ))
                                            )}
                                            {/* Add item to this category */}
                                            <button
                                                onClick={() => { setFormCategory(cat); openAddModal(); }}
                                                className="w-full flex items-center gap-2 px-5 pl-16 py-2.5 text-[10px] font-bold text-muted hover:text-[#d75c33] hover:bg-accent/5 transition-all"
                                            >
                                                <Plus className="w-3 h-3" />
                                                Agregar en {cat}
                                            </button>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* Grand Total Row */}
                    <div className="flex items-center justify-between px-5 py-4 bg-card border-t border-card-border">
                        <span className="text-xs font-black uppercase tracking-widest text-muted">{viewMode === 'annual' ? 'Total del Año' : 'Total del Mes'}</span>
                        <div className="flex items-center gap-4">
                            {monthChange !== 0 && viewMode === 'monthly' && (
                                <span className={`text-xs font-bold ${monthChange > 0 ? 'text-red-400' : 'text-emerald-400'}`}>
                                    {monthChange > 0 ? '+' : ''}{monthChange.toFixed(1)}%
                                </span>
                            )}
                            <span className="text-lg font-black text-accent tabular-nums">{fmtFull(totalMonth)}</span>
                        </div>
                    </div>
                </div>
                </>)}

                {/* ── P&L Tab ──────────────────────────────────────────────── */}
                {activeTab === 'pnl' && (
                    <PnLTab
                        selectedMonth={selectedMonth}
                        selectedYear={selectedYear}
                        viewMode={viewMode}
                        allExpenses={allExpenses}
                        monthExpenses={monthExpenses}
                        categoryTotals={categoryTotals}
                        totalExpenses={totalMonth}
                        supplierKpis={supplierPeriod.kpis}
                        supplierYearKpis={supplierYear.kpis}
                        supplierLoading={supplierPeriod.loading}
                        salesKpis={salesKpis}
                        salesByCountry={salesByCountry}
                        salesTrend={salesTrend}
                        salesLoading={dashData.loading}
                    />
                )}

            {/* ── Add/Edit Modal ──────────────────────────────────────────── */}
            {
                isModalOpen && (
                    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm z-50 flex items-center justify-center p-4" onClick={() => setIsModalOpen(false)}>
                        <div className="bg-card border border-card-border rounded-2xl p-6 w-full max-w-md space-y-5 shadow-2xl" onClick={e => e.stopPropagation()}>
                            <div className="flex items-center justify-between">
                                <h3 className="text-sm font-black uppercase tracking-widest text-foreground">
                                    {editingExpense ? 'Editar Gasto' : 'Nuevo Gasto'}
                                </h3>
                                <button onClick={() => setIsModalOpen(false)} className="w-8 h-8 rounded-lg hover:bg-hover-bg flex items-center justify-center text-muted hover:text-foreground">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>

                            <div className="space-y-4">
                                {/* Category */}
                                <div>
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 block">Categoría</label>
                                    <div className="flex gap-2">
                                        <select
                                            value={formCategory}
                                            onChange={(e) => setFormCategory(e.target.value as ExpenseCategory)}
                                            className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 text-sm focus:outline-none focus:border-accent transition-colors appearance-none text-foreground"
                                        >
                                            {categories.map((c: string) => (
                                                <option key={c} value={c}>{c}</option>
                                            ))}
                                        </select>
                                        <button
                                            type="button"
                                            onClick={() => setIsManagingCategories(!isManagingCategories)}
                                            className={`px-4 rounded-xl border transition-all flex items-center justify-center ${isManagingCategories
                                                ? 'bg-accent/10 border-accent text-accent'
                                                : 'bg-background border-card-border text-muted hover:border-accent/50'
                                                }`}
                                            title="Gestionar Categorías"
                                        >
                                            <Edit3 className="w-4 h-4" />
                                        </button>
                                    </div>

                                    {isManagingCategories && (
                                        <div className="mt-3 bg-background border border-card-border rounded-xl p-3 animate-in fade-in slide-in-from-top-2 duration-200">
                                            <div className="flex items-center justify-between mb-2">
                                                <span className="text-[9px] font-black text-muted uppercase tracking-tight">Gestionar Categorías</span>
                                                <button onClick={() => setIsManagingCategories(false)} className="text-muted hover:text-foreground"><X className="w-3 h-3" /></button>
                                            </div>

                                            <div className="flex gap-2 mb-3">
                                                <input
                                                    type="text"
                                                    placeholder="Nueva categoría..."
                                                    value={newCategoryName}
                                                    onChange={(e) => setNewCategoryName(e.target.value)}
                                                    className="flex-1 bg-background border border-card-border rounded-lg px-3 py-1.5 text-xs focus:outline-none focus:border-accent text-foreground placeholder:text-muted/50"
                                                />
                                                <button
                                                    type="button"
                                                    onClick={handleAddCategory}
                                                    className="bg-accent text-white px-3 py-1.5 rounded-lg text-xs font-bold hover:bg-orange-600 transition-colors"
                                                >
                                                    Agregar
                                                </button>
                                            </div>

                                            <div className="max-h-[120px] overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                                                {categories.filter(c => !DEFAULT_CATEGORIES.includes(c)).map(cat => (
                                                    <div key={cat} className="flex items-center justify-between bg-hover-bg px-3 py-1.5 rounded-lg group">
                                                        <span className="text-xs text-muted">{cat}</span>
                                                        <button
                                                            type="button"
                                                            onClick={() => handleDeleteCategory(cat)}
                                                            className="text-muted/40 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
                                                        >
                                                            <Trash2 className="w-3 h-3" />
                                                        </button>
                                                    </div>
                                                ))}
                                                {categories.filter(c => !DEFAULT_CATEGORIES.includes(c)).length === 0 && (
                                                    <p className="text-[10px] text-muted/40 text-center py-2 italic">No hay categorías personalizadas</p>
                                                )}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Subcategory */}
                                <div>
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 block">Concepto</label>
                                    <input
                                        type="text"
                                        value={formSubcategory}
                                        onChange={e => setFormSubcategory(e.target.value)}
                                        placeholder="Ej: Shopify Lucent, Arriendo..."
                                        className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none transition-colors"
                                    />
                                </div>

                                {/* Amount + Date row */}
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 block">Monto (COP)</label>
                                        <input
                                            type="number"
                                            value={formAmount}
                                            onChange={e => setFormAmount(e.target.value)}
                                            placeholder="0"
                                            className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none transition-colors"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 block">Fecha</label>
                                        <input
                                            type="date"
                                            value={formDate}
                                            onChange={e => setFormDate(e.target.value)}
                                            className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-accent/50 focus:outline-none transition-colors"
                                        />
                                    </div>
                                </div>

                                {/* Notes */}
                                <div>
                                    <label className="text-[10px] font-black text-muted uppercase tracking-widest mb-1.5 block">Notas (opcional)</label>
                                    <input
                                        type="text"
                                        value={formNotes}
                                        onChange={e => setFormNotes(e.target.value)}
                                        placeholder="Notas adicionales..."
                                        className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground placeholder:text-muted focus:border-accent/50 focus:outline-none transition-colors"
                                    />
                                </div>

                                {/* Recurring Toggle */}
                                <label
                                    className="flex items-center gap-3 cursor-pointer group"
                                    onClick={() => setFormRecurring(!formRecurring)}
                                >
                                    <div className={`w-10 h-5 rounded-full relative transition-all ${formRecurring ? 'bg-purple-500' : 'bg-muted/20'}`}>
                                        <div className={`w-4 h-4 rounded-full bg-white absolute top-0.5 transition-all ${formRecurring ? 'left-5' : 'left-0.5'}`} />
                                    </div>
                                    <span className="text-xs font-bold text-muted group-hover:text-foreground transition-colors">Gasto Recurrente</span>
                                </label>
                            </div>

                            {/* Save Button */}
                            <button
                                onClick={handleSave}
                                disabled={saving || !formSubcategory || !formAmount}
                                className="w-full flex items-center justify-center gap-2 py-3 bg-accent hover:bg-orange-600 disabled:bg-muted/10 disabled:text-muted/40 text-white rounded-xl font-black uppercase tracking-widest text-[11px] transition-all active:scale-[0.98] shadow-lg shadow-accent/20"
                            >
                                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                                {saving ? 'Guardando...' : editingExpense ? 'Actualizar' : 'Guardar Gasto'}
                            </button>
                        </div>
                    </div>
                )
            }
            </div>
        </div >
    );
}

// ── P&L Helper Components ────────────────────────────────────────────────────

function PnLRow({ label, value, color, bold, indent, highlight, percent }: {
    label: string; value: number; color?: string; bold?: boolean; indent?: boolean;
    highlight?: boolean; percent?: boolean;
}) {
    const textColor = color || 'text-foreground';
    return (
        <div className={`flex items-center justify-between py-2.5 px-3 ${highlight ? 'bg-hover-bg/40 rounded-lg my-1' : ''} ${indent ? 'pl-8' : ''}`}>
            <span className={`text-sm ${bold ? 'font-black' : 'font-medium'} ${indent ? 'text-muted' : textColor}`}>
                {indent && '(-) '}{label}
            </span>
            <span className={`text-sm tabular-nums ${bold ? 'font-black' : 'font-bold'} ${textColor}`}>
                {percent ? `${value.toFixed(1)}%` : fmtFull(value)}
            </span>
        </div>
    );
}

function WaterfallBar({ label, value, maxValue, color }: {
    label: string; value: number; maxValue: number; color: string;
}) {
    const pct = maxValue > 0 ? Math.min((Math.abs(value) / maxValue) * 100, 100) : 0;
    return (
        <div className="flex items-center gap-3 py-1.5">
            <span className="text-xs font-medium text-muted w-32 truncate text-right">{label}</span>
            <div className="flex-1 h-6 bg-hover-bg/30 rounded-md overflow-hidden">
                <div className="h-full rounded-md transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
            </div>
            <span className="text-xs font-bold tabular-nums w-24 text-right" style={{ color }}>{fmtCOP(value)}</span>
        </div>
    );
}

// ── P&L Sub-Views ────────────────────────────────────────────────────────────

function KpiCard({ label, value, color, percent }: { label: string; value: number; color: string; percent?: boolean }) {
    return (
        <div className="bg-card border border-card-border rounded-xl p-4 flex flex-col items-center justify-center">
            <span className="text-[10px] font-black text-muted uppercase tracking-widest mb-1">{label}</span>
            <span className={`text-xl font-black tabular-nums ${color}`}>
                {percent ? `${value.toFixed(1)}%` : fmtCOP(value)}
            </span>
        </div>
    );
}

function PnLStatement({ title, rows, warning }: {
    title: string;
    rows: { label: string; value: number; color?: string; bold?: boolean; indent?: boolean; highlight?: boolean; percent?: boolean }[];
    warning?: string;
}) {
    return (
        <div className="lg:col-span-2 bg-card border border-card-border rounded-xl p-5">
            <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">{title}</h3>
            {warning && (
                <div className="flex items-center gap-2 mb-4 px-3 py-2 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                    <span className="text-xs text-amber-500 font-medium">{warning}</span>
                </div>
            )}
            <div className="divide-y divide-card-border/50">
                {rows.map((r, i) => <PnLRow key={i} {...r} />)}
            </div>
        </div>
    );
}

function ProveedorPnLView({ supplierKpis, periodLabel }: {
    supplierKpis: SupplierKPIResults | null; periodLabel: string;
}) {
    const ing = supplierKpis?.ingreso_proveedor ?? 0;
    const costo = supplierKpis?.costo_interno ?? 0;
    const bruta = supplierKpis?.ganancia_real ?? 0;
    const flEnt = supplierKpis?.flete_entregados ?? 0;
    const flDev = supplierKpis?.flete_devoluciones ?? 0;
    const util = bruta - flEnt - flDev;
    const margen = ing > 0 ? (util / ing) * 100 : 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <PnLStatement
                    title={`P&L Proveedor — ${periodLabel}`}
                    warning={!supplierKpis ? 'Importa órdenes en el módulo Proveedor para ver datos' : undefined}
                    rows={[
                        { label: 'Ingresos Proveedor', value: ing, color: 'text-emerald-400', bold: true },
                        { label: 'Costo Mercancía', value: costo, color: 'text-red-400', indent: true },
                        { label: 'Ganancia Bruta', value: bruta, color: 'text-blue-400', bold: true, highlight: true },
                        { label: 'Fletes Entregados', value: flEnt, color: 'text-orange-400', indent: true },
                        { label: 'Fletes Devoluciones', value: flDev, color: 'text-orange-400', indent: true },
                        { label: 'Utilidad Proveedor', value: util, color: util >= 0 ? 'text-emerald-400' : 'text-red-400', bold: true, highlight: true },
                        { label: 'Margen Proveedor', value: margen, color: margen >= 0 ? 'text-emerald-400' : 'text-red-400', bold: true, percent: true },
                    ]}
                />
                <div className="flex flex-col gap-4">
                    <KpiCard label="Ingresos" value={ing} color="text-emerald-400" />
                    <KpiCard label="Utilidad" value={util} color={util >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                    <KpiCard label="Margen" value={margen} color={margen >= 0 ? 'text-emerald-400' : 'text-red-400'} percent />
                </div>
            </div>
            <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Desglose Proporcional</h3>
                <div className="space-y-1">
                    <WaterfallBar label="Ingresos" value={ing} maxValue={ing} color="#34d399" />
                    <WaterfallBar label="Costo Mercancía" value={costo} maxValue={ing} color="#f87171" />
                    <WaterfallBar label="Fletes" value={flEnt + flDev} maxValue={ing} color="#fb923c" />
                    <WaterfallBar label="Utilidad" value={util} maxValue={ing} color={util >= 0 ? '#34d399' : '#f87171'} />
                </div>
            </div>
        </div>
    );
}

function VentasPnLView({ salesKpis, salesByCountry, periodLabel }: {
    salesKpis: KPIResults | null;
    salesByCountry: { country: string; kpis: KPIResults }[];
    periodLabel: string;
}) {
    const ing = salesKpis?.ing_real ?? 0;
    const cpr = salesKpis?.cpr ?? 0;
    const flEnt = salesKpis?.fl_ent ?? 0;
    const flDev = salesKpis?.fl_dev ?? 0;
    const flTra = salesKpis?.fl_tra ?? 0;
    const ads = salesKpis?.g_ads ?? 0;
    const util = salesKpis?.u_real ?? 0;
    const margen = ing > 0 ? (util / ing) * 100 : 0;
    const roas = ads > 0 ? (ing / ads) : 0;

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <PnLStatement
                    title={`P&L Ventas — ${periodLabel}`}
                    warning={!salesKpis ? 'Importa órdenes en el Dashboard para ver ventas' : undefined}
                    rows={[
                        { label: 'Ingreso Real Entregados', value: ing, color: 'text-emerald-400', bold: true },
                        { label: 'Costo Producto', value: cpr, color: 'text-red-400', indent: true },
                        { label: 'Flete Entrega', value: flEnt, color: 'text-orange-400', indent: true },
                        { label: 'Flete Devolución', value: flDev, color: 'text-orange-400', indent: true },
                        { label: 'Flete Tránsito', value: flTra, color: 'text-orange-400', indent: true },
                        { label: 'Publicidad', value: ads, color: 'text-purple-400', indent: true },
                        { label: 'Utilidad Real Ventas', value: util, color: util >= 0 ? 'text-emerald-400' : 'text-red-400', bold: true, highlight: true },
                        { label: 'Margen Ventas', value: margen, color: margen >= 0 ? 'text-emerald-400' : 'text-red-400', bold: true, percent: true },
                    ]}
                />
                <div className="flex flex-col gap-4">
                    <KpiCard label="Ingresos" value={ing} color="text-emerald-400" />
                    <KpiCard label="Utilidad" value={util} color={util >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                    <KpiCard label="ROAS" value={roas} color="text-blue-400" />
                </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Desglose Proporcional</h3>
                <div className="space-y-1">
                    <WaterfallBar label="Ingresos" value={ing} maxValue={ing} color="#34d399" />
                    <WaterfallBar label="Costo Producto" value={cpr} maxValue={ing} color="#f87171" />
                    <WaterfallBar label="Fletes" value={flEnt + flDev + flTra} maxValue={ing} color="#fb923c" />
                    <WaterfallBar label="Publicidad" value={ads} maxValue={ing} color="#a855f7" />
                    <WaterfallBar label="Utilidad" value={util} maxValue={ing} color={util >= 0 ? '#34d399' : '#f87171'} />
                </div>
            </div>

            {salesByCountry.length > 0 && (
                <div className="bg-card border border-card-border rounded-xl p-5">
                    <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Desglose por País</h3>
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-card-border/50">
                                    <th className="text-left text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">País</th>
                                    <th className="text-right text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">Ingresos</th>
                                    <th className="text-right text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">Costo</th>
                                    <th className="text-right text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">Fletes</th>
                                    <th className="text-right text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">Ads</th>
                                    <th className="text-right text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">Utilidad</th>
                                    <th className="text-right text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">Margen</th>
                                </tr>
                            </thead>
                            <tbody>
                                {salesByCountry.map(({ country, kpis: k }) => {
                                    const cMargen = k.ing_real > 0 ? (k.u_real / k.ing_real) * 100 : 0;
                                    return (
                                        <tr key={country} className="border-b border-card-border/20 hover:bg-hover-bg/20 transition-colors">
                                            <td className="py-2.5 px-3 font-medium capitalize">{country}</td>
                                            <td className="text-right py-2.5 px-3 font-bold tabular-nums">{fmtCOP(k.ing_real)}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums text-red-400">{fmtCOP(k.cpr)}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums text-orange-400">{fmtCOP(k.fl_ent + k.fl_dev + k.fl_tra)}</td>
                                            <td className="text-right py-2.5 px-3 tabular-nums text-purple-400">{fmtCOP(k.g_ads)}</td>
                                            <td className={`text-right py-2.5 px-3 font-bold tabular-nums ${k.u_real >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{fmtCOP(k.u_real)}</td>
                                            <td className={`text-right py-2.5 px-3 tabular-nums ${cMargen >= 0 ? 'text-emerald-400' : 'text-red-400'}`}>{cMargen.toFixed(1)}%</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}

function OperacionPnLView({ supplierKpis, salesKpis, categoryTotals, totalExpenses, allExpenses, supplierYearKpis, salesTrend, selectedYear, periodLabel }: {
    supplierKpis: SupplierKPIResults | null;
    salesKpis: KPIResults | null;
    categoryTotals: Record<string, number>;
    totalExpenses: number;
    allExpenses: Expense[];
    supplierYearKpis: SupplierKPIResults | null;
    salesTrend: { mes: string; ingresos: number; costos: number; utilidad: number }[];
    selectedYear: number;
    periodLabel: string;
}) {
    const sIng = supplierKpis?.ingreso_proveedor ?? 0;
    const sCosto = supplierKpis?.costo_interno ?? 0;
    const sFlEnt = supplierKpis?.flete_entregados ?? 0;
    const sFlDev = supplierKpis?.flete_devoluciones ?? 0;

    const vIng = salesKpis?.ing_real ?? 0;
    const vCpr = salesKpis?.cpr ?? 0;
    const vFlEnt = salesKpis?.fl_ent ?? 0;
    const vFlDev = salesKpis?.fl_dev ?? 0;
    const vFlTra = salesKpis?.fl_tra ?? 0;
    const vAds = salesKpis?.g_ads ?? 0;

    const ingTotal = sIng + vIng;
    const costoTotal = sCosto + vCpr;
    const gananciaBruta = ingTotal - costoTotal;
    const fletesTotal = sFlEnt + sFlDev + vFlEnt + vFlDev + vFlTra;
    const gastosOpSinMarketing = totalExpenses - (categoryTotals['Marketing'] || 0);
    const utilidadOp = ingTotal - costoTotal - fletesTotal - vAds - gastosOpSinMarketing;
    const margenOp = ingTotal > 0 ? (utilidadOp / ingTotal) * 100 : 0;

    const noData = !supplierKpis && !salesKpis;
    const warningMsg = noData
        ? 'Importa datos en Dashboard y Proveedor para ver el P&L completo'
        : !supplierKpis ? 'Sin datos de proveedor — mostrando solo ventas'
        : !salesKpis ? 'Sin datos de ventas — mostrando solo proveedor' : undefined;

    // Trend chart
    const trendData = useMemo(() => {
        const expByMonth = totalByMonth(allExpenses, selectedYear);
        const supplierByMonth: Record<number, { ingreso: number; costo: number }> = {};
        if (supplierYearKpis?.datos_diarios) {
            for (const d of supplierYearKpis.datos_diarios) {
                let month: number | null = null;
                const ddmm = d.fecha.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/);
                if (ddmm) month = Number(ddmm[2]);
                else {
                    const yyyymm = d.fecha.match(/^(\d{4})[/-](\d{1,2})/);
                    if (yyyymm) month = Number(yyyymm[2]);
                }
                if (month) {
                    if (!supplierByMonth[month]) supplierByMonth[month] = { ingreso: 0, costo: 0 };
                    supplierByMonth[month].ingreso += d.ingreso;
                    supplierByMonth[month].costo += (d.ingreso - d.ganancia);
                }
            }
        }
        return Array.from({ length: 12 }, (_, i) => {
            const m = i + 1;
            const smI = supplierByMonth[m]?.ingreso ?? 0;
            const smC = supplierByMonth[m]?.costo ?? 0;
            const vmI = salesTrend[i]?.ingresos ?? 0;
            const vmC = salesTrend[i]?.costos ?? 0;
            const exp = expByMonth[m] ?? 0;
            const mktExp = allExpenses.filter(e => e.category === 'Marketing' && e.year === selectedYear && e.month === m).reduce((s, e) => s + e.amount, 0);
            return {
                mes: MONTH_NAMES[i],
                ingresos: smI + vmI,
                gastos: smC + vmC + (exp - mktExp),
                utilidad: (smI + vmI) - (smC + vmC) - (exp - mktExp),
            };
        });
    }, [allExpenses, selectedYear, supplierYearKpis, salesTrend]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                <PnLStatement
                    title={`Estado de Resultados — ${periodLabel}`}
                    warning={warningMsg}
                    rows={[
                        { label: 'Ingresos Totales', value: ingTotal, color: 'text-emerald-400', bold: true },
                        { label: 'Costos Producto', value: costoTotal, color: 'text-red-400', indent: true },
                        { label: 'Ganancia Bruta', value: gananciaBruta, color: 'text-blue-400', bold: true, highlight: true },
                        { label: 'Fletes Totales', value: fletesTotal, color: 'text-orange-400', indent: true },
                        { label: 'Publicidad', value: vAds, color: 'text-purple-400', indent: true },
                        { label: 'Gastos Operativos', value: gastosOpSinMarketing, color: 'text-red-400', indent: true },
                        { label: 'Utilidad Operacional', value: utilidadOp, color: utilidadOp >= 0 ? 'text-emerald-400' : 'text-red-400', bold: true, highlight: true },
                        { label: 'Margen Operacional', value: margenOp, color: margenOp >= 0 ? 'text-emerald-400' : 'text-red-400', bold: true, percent: true },
                    ]}
                />
                <div className="flex flex-col gap-4">
                    <KpiCard label="Ingresos" value={ingTotal} color="text-emerald-400" />
                    <KpiCard label="Utilidad Op" value={utilidadOp} color={utilidadOp >= 0 ? 'text-emerald-400' : 'text-red-400'} />
                    <KpiCard label="Margen Op" value={margenOp} color={margenOp >= 0 ? 'text-emerald-400' : 'text-red-400'} percent />
                </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Desglose Proporcional</h3>
                <div className="space-y-1">
                    <WaterfallBar label="Ingresos" value={ingTotal} maxValue={ingTotal} color="#34d399" />
                    <WaterfallBar label="Costos Producto" value={costoTotal} maxValue={ingTotal} color="#f87171" />
                    <WaterfallBar label="Fletes" value={fletesTotal} maxValue={ingTotal} color="#fb923c" />
                    <WaterfallBar label="Publicidad" value={vAds} maxValue={ingTotal} color="#a855f7" />
                    <WaterfallBar label="Gastos Op" value={gastosOpSinMarketing} maxValue={ingTotal} color="#ef4444" />
                    <WaterfallBar label="Utilidad" value={utilidadOp} maxValue={ingTotal} color={utilidadOp >= 0 ? '#34d399' : '#f87171'} />
                </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Tendencia Anual — {selectedYear}</h3>
                <div className="h-64">
                    <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={trendData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                            <defs>
                                <linearGradient id="pnlIngresos" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#34d399" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#34d399" stopOpacity={0} />
                                </linearGradient>
                                <linearGradient id="pnlUtilidad" x1="0" y1="0" x2="0" y2="1">
                                    <stop offset="5%" stopColor="#60a5fa" stopOpacity={0.3} />
                                    <stop offset="95%" stopColor="#60a5fa" stopOpacity={0} />
                                </linearGradient>
                            </defs>
                            <CartesianGrid strokeDasharray="3 3" stroke="var(--card-border)" opacity={0.3} />
                            <XAxis dataKey="mes" tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fontSize: 10, fill: 'var(--muted)' }} axisLine={false} tickLine={false} tickFormatter={(v: number) => fmtCOP(v)} width={60} />
                            <Tooltip
                                contentStyle={{ backgroundColor: 'var(--card)', border: '1px solid var(--card-border)', borderRadius: '12px', fontSize: '12px' }}
                                formatter={(value: any) => fmtFull(Number(value))}
                            />
                            <Area type="monotone" dataKey="ingresos" name="Ingresos" stroke="#34d399" fill="url(#pnlIngresos)" strokeWidth={2} />
                            <Area type="monotone" dataKey="gastos" name="Gastos" stroke="#f87171" fill="none" strokeWidth={2} strokeDasharray="5 5" />
                            <Area type="monotone" dataKey="utilidad" name="Utilidad" stroke="#60a5fa" fill="url(#pnlUtilidad)" strokeWidth={2} />
                        </AreaChart>
                    </ResponsiveContainer>
                </div>
            </div>

            <div className="bg-card border border-card-border rounded-xl p-5">
                <h3 className="text-[10px] font-black text-muted uppercase tracking-widest mb-4">Desglose Gastos Operativos</h3>
                <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-card-border/50">
                                <th className="text-left text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">Categoría</th>
                                <th className="text-right text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">Monto</th>
                                <th className="text-right text-[10px] font-black text-muted uppercase tracking-widest py-2 px-3">% Total</th>
                            </tr>
                        </thead>
                        <tbody>
                            {Object.entries(categoryTotals)
                                .sort(([, a], [, b]) => b - a)
                                .filter(([, v]) => v > 0)
                                .map(([cat, val]) => (
                                    <tr key={cat} className="border-b border-card-border/20 hover:bg-hover-bg/20 transition-colors">
                                        <td className="py-2.5 px-3">
                                            <div className="flex items-center gap-2">
                                                <div className="w-2 h-2 rounded-full" style={{ backgroundColor: getCategoryColor(cat) }} />
                                                <span className="font-medium">{cat}</span>
                                            </div>
                                        </td>
                                        <td className="text-right py-2.5 px-3 font-bold tabular-nums">{fmtFull(val)}</td>
                                        <td className="text-right py-2.5 px-3 text-muted tabular-nums">
                                            {totalExpenses > 0 ? ((val / totalExpenses) * 100).toFixed(1) : 0}%
                                        </td>
                                    </tr>
                                ))}
                        </tbody>
                        <tfoot>
                            <tr className="border-t border-card-border">
                                <td className="py-2.5 px-3 font-black text-xs uppercase">Total</td>
                                <td className="text-right py-2.5 px-3 font-black tabular-nums text-accent">{fmtFull(totalExpenses)}</td>
                                <td className="text-right py-2.5 px-3 font-bold text-muted">100%</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>
            </div>
        </div>
    );
}

// ── PnLTab Component ─────────────────────────────────────────────────────────

interface PnLTabProps {
    selectedMonth: number;
    selectedYear: number;
    viewMode: 'monthly' | 'annual';
    allExpenses: Expense[];
    monthExpenses: Expense[];
    categoryTotals: Record<string, number>;
    totalExpenses: number;
    supplierKpis: SupplierKPIResults | null;
    supplierYearKpis: SupplierKPIResults | null;
    supplierLoading: boolean;
    salesKpis: KPIResults | null;
    salesByCountry: { country: string; kpis: KPIResults }[];
    salesTrend: { mes: string; ingresos: number; costos: number; utilidad: number }[];
    salesLoading: boolean;
}

function PnLTab({
    selectedMonth, selectedYear, viewMode, allExpenses, monthExpenses,
    categoryTotals, totalExpenses, supplierKpis, supplierYearKpis, supplierLoading,
    salesKpis, salesByCountry, salesTrend, salesLoading,
}: PnLTabProps) {
    const [subTab, setSubTab] = useState<'operacion' | 'proveedor' | 'ventas'>('operacion');

    if (supplierLoading && salesLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-6 h-6 animate-spin text-accent mr-3" />
                <span className="text-sm text-muted font-medium">Cargando datos...</span>
            </div>
        );
    }

    const periodLabel = viewMode === 'annual' ? `${selectedYear}` : `${MONTH_NAMES_FULL[selectedMonth - 1]} ${selectedYear}`;

    return (
        <div className="space-y-6">
            {/* Sub-tab selector */}
            <div className="flex gap-2 bg-card border border-card-border rounded-xl p-1.5">
                {([
                    { key: 'operacion' as const, label: 'Operación' },
                    { key: 'proveedor' as const, label: 'Proveedor' },
                    { key: 'ventas' as const, label: 'Ventas' },
                ]).map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setSubTab(tab.key)}
                        className={`flex-1 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                            subTab === tab.key
                                ? 'bg-[#d75c33]/10 text-[#d75c33] border border-[#d75c33]/20'
                                : 'text-muted hover:text-foreground hover:bg-hover-bg border border-transparent'
                        }`}
                    >
                        {tab.label}
                    </button>
                ))}
            </div>

            {subTab === 'operacion' && (
                <OperacionPnLView
                    supplierKpis={supplierKpis}
                    salesKpis={salesKpis}
                    categoryTotals={categoryTotals}
                    totalExpenses={totalExpenses}
                    allExpenses={allExpenses}
                    supplierYearKpis={supplierYearKpis}
                    salesTrend={salesTrend}
                    selectedYear={selectedYear}
                    periodLabel={periodLabel}
                />
            )}

            {subTab === 'proveedor' && (
                <ProveedorPnLView supplierKpis={supplierKpis} periodLabel={periodLabel} />
            )}

            {subTab === 'ventas' && (
                <VentasPnLView salesKpis={salesKpis} salesByCountry={salesByCountry} periodLabel={periodLabel} />
            )}
        </div>
    );
}
