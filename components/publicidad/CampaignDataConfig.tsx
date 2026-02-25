"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    PlusCircle,
    Search,
    RefreshCw,
    X,
    Globe,
    CheckCircle2,
    ChevronDown,
    Loader2,
    Sparkles,
    Zap,
    Trash2,
    Pencil,
    ArrowRight,
    Upload,
    Plus,
    Target,
    DollarSign,
    Check,
    History,
    AlertCircle
} from 'lucide-react';
import {
    getAdSpendHistory,
    getCampaignMappings,
    addMultipleCampaignMappings,
    deleteCampaignMapping,
    updateCampaignMapping,
    saveAdSettings,
    generateMappingSuggestions,
    getProductGroups,
    saveProductGroup,
    deleteProductGroup,
    getEffectiveProductId,
    getAdSettings,
    saveBulkAdSpend,
    clearAdSpendHistory,
    clearPlatformAdSpend,
    type BulkAdSpendRow,
    getAdSpendImportHistory,
    deleteAdSpendImport,
    getAISuggestions,
    updateAISuggestionStatus,
    deleteAISuggestion,
    clearAllAISuggestions,
    type CampaignMapping,
    type AdSpendHistory,
    type AdSettings,
    type ProductGroup,
    type AdSpendImportLog,
    type AISuggestion
} from '@/lib/services/marketing';
import { fetchMetaAdSpend, fetchAccountCurrency, MetaTokenExpiredError } from '@/lib/services/meta';
import { useAuth } from '@/lib/context/AuthContext';
import { resolveProductName } from '@/lib/services/productResolution';
import {
    formatCurrency,
    isMatchingCountry,
    getOfficialCountryName,
    getCurrencyForCountry,
    toCOP,
    fromCOP
} from '@/lib/utils/currency';
import { ALL_COUNTRIES_MASTER } from '@/lib/utils/status';
import { getAllOrderFiles } from '@/lib/firebase/firestore';
import { collection, doc, setDoc, Timestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import { detectHeaderRow, findColumnIndex, parseNumber, parseDate, detectCountryFromCampaign, COLUMN_VARIANTS } from '@/lib/utils/csv-parser';
import { useGlobalFilters } from '@/lib/context/FilterContext';
import { useCurrency } from '@/lib/hooks/useCurrency';

interface CampaignDataConfigProps {
    defaultSection?: 'mapeo' | 'grupos';
}

export default function CampaignDataConfig({ defaultSection = 'mapeo' }: CampaignDataConfigProps) {
    const { user, effectiveUid } = useAuth();
    const { rates } = useCurrency();
    const {
        selectedCountry,
        selectedProduct,
        dateRange,
        startDateCustom,
        endDateCustom,
    } = useGlobalFilters();

    // Section toggle
    const [activeSection, setActiveSection] = useState<'mapeo' | 'grupos'>(defaultSection);

    // Sync with parent tab changes
    useEffect(() => {
        setActiveSection(defaultSection);
    }, [defaultSection]);

    // Data State
    const [history, setHistory] = useState<AdSpendHistory[]>([]);
    const [mappings, setMappings] = useState<CampaignMapping[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [adSettings, setAdSettings] = useState<AdSettings | null>(null);
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
    const [importHistory, setImportHistory] = useState<AdSpendImportLog[]>([]);

    // UI States
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [syncingAPI, setSyncingAPI] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const [mappingMode, setMappingMode] = useState<'manual' | 'ai'>('manual');
    const [importingCSV, setImportingCSV] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [aiMappingInProgress, setAiMappingInProgress] = useState(false);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingMapping, setEditingMapping] = useState<{ productId: string; campaigns: CampaignMapping[] } | null>(null);
    const [editNewProductId, setEditNewProductId] = useState('');
    const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
    const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [campaignSearchTerm, setCampaignSearchTerm] = useState('');
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupProducts, setNewGroupProducts] = useState<string[]>([]);

    // Form States
    const [newMapping, setNewMapping] = useState({
        campaignNames: [] as string[],
        productId: '',
        platform: 'facebook' as 'facebook' | 'tiktok'
    });
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Refs
    const campaignDropdownRef = useRef<HTMLDivElement>(null);
    const productDropdownRef = useRef<HTMLDivElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    // Initial Load
    useEffect(() => {
        async function loadData() {
            try {
                const uid = effectiveUid || '';
                const h = await getAdSpendHistory(uid);
                const m = await getCampaignMappings(uid);
                const s = await getAdSettings(uid);
                const g = await getProductGroups(uid);
                const ai = await getAISuggestions(uid);
                const iHistory = await getAdSpendImportHistory(uid);

                setHistory(h || []);
                setMappings(m || []);
                setAdSettings(s);
                setProductGroups(g || []);
                setAiSuggestions(ai || []);
                setImportHistory(iHistory || []);

                // Load orders
                const files = await getAllOrderFiles(uid);
                const allOrders: any[] = [];
                files.forEach((file: any) => {
                    if (file.orders && Array.isArray(file.orders)) {
                        const country = getOfficialCountryName(file.country || 'Desconocido');
                        file.orders.forEach((o: any) => {
                            allOrders.push({
                                ...o,
                                PAIS: country,
                            });
                        });
                    }
                });
                setOrders(allOrders);
            } catch (error) {
                console.error('Error loading campaign data config:', error);
            } finally {
                setIsInitialLoading(false);
            }
        }
        loadData();
    }, [effectiveUid]);

    // Click outside dropdowns
    useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (campaignDropdownRef.current && !campaignDropdownRef.current.contains(event.target as Node)) {
                setIsCampaignDropdownOpen(false);
            }
            if (productDropdownRef.current && !productDropdownRef.current.contains(event.target as Node)) {
                setIsProductDropdownOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // ── Computed Values ──────────────────────────────────────────────────────

    const availableProducts = useMemo(() => {
        const productMap = new Map<string, { id: string; label: string; country?: string }>();

        orders.forEach(o => {
            if (o.PRODUCTO) {
                const pid = o.PRODUCTO_ID?.toString() || o.PRODUCTO;
                if (!productMap.has(pid)) {
                    productMap.set(pid, { id: pid, label: o.PRODUCTO, country: o.PAIS });
                }
            }
        });

        productGroups.forEach(g => {
            g.productIds.forEach(pid => {
                if (!productMap.has(pid)) {
                    productMap.set(pid, { id: pid, label: resolveProductName(pid, orders as any, mappings, productGroups) });
                }
            });
        });

        const list = Array.from(productMap.values());
        return [{ id: 'Todos', label: 'Todos', country: 'Todos' }, ...list.sort((a, b) => a.label.localeCompare(b.label))];
    }, [orders, productGroups, mappings]);

    const selectableProducts = useMemo(() => {
        const map = new Map<string, { id: string; label: string; country?: string }>();

        availableProducts.forEach(p => {
            if (p.id !== 'Todos') {
                map.set(p.id, p);
            }
        });

        productGroups.forEach(g => {
            let groupCountry: string | undefined = undefined;
            const countries = new Set<string>();

            g.productIds.forEach(pid => {
                const productData = map.get(pid);
                if (productData && productData.country) {
                    countries.add(productData.country);
                }
                map.delete(pid);
            });

            if (countries.size === 1) {
                groupCountry = Array.from(countries)[0];
            } else if (countries.size > 1) {
                groupCountry = 'GL';
            } else {
                groupCountry = 'GL';
            }

            map.set(g.id, { id: g.id, label: `📦 [Grupo] ${g.name}`, country: groupCountry });
        });

        const list = Array.from(map.values());
        return [{ id: 'Todos', label: 'Todos', country: 'Todos' }, ...list.sort((a, b) => a.label.localeCompare(b.label))];
    }, [availableProducts, productGroups]);

    const availableCampaigns = useMemo(() => {
        const unique = new Map<string, any>();
        history.forEach(h => {
            if (h.campaignName) {
                const key = `${h.campaignName}_${h.platform}_${h.country}`;
                if (!unique.has(key)) {
                    unique.set(key, { name: h.campaignName, platform: h.platform, country: h.country });
                }
            }
        });
        return Array.from(unique.values());
    }, [history]);

    const unmappedCampaigns = useMemo(() => {
        return availableCampaigns.filter(c => !mappings.some(m => m.campaignName === c.name && m.platform === c.platform));
    }, [availableCampaigns, mappings]);

    const mappingsByCountryAndProduct = useMemo(() => {
        const countryGroups: Record<string, Record<string, { productId: string; productName: string; campaigns: CampaignMapping[] }>> = {};

        mappings.forEach(m => {
            const effectiveId = getEffectiveProductId(m.productId, productGroups);
            const product = selectableProducts.find(p => p.id === effectiveId) || availableProducts.find(p => p.id === m.productId);
            let country = product?.country || 'Desconocido';

            if (country.toUpperCase() === 'GT') {
                country = 'Guatemala';
            }

            if (m.productId.toLowerCase().includes('global') || country === 'Desconocido' || country === 'Unknown') {
                const upperCam = m.campaignName.toUpperCase();
                if (upperCam.includes('COLOMBIA') || upperCam.includes('CO-')) country = 'Colombia';
                else if (upperCam.includes('ECUADOR') || upperCam.includes('EC-')) country = 'Ecuador';
                else if (upperCam.includes('GUATEMALA') || upperCam.includes('GT-')) country = 'Guatemala';
                else if (upperCam.includes('PANAMA') || upperCam.includes('PA-')) country = 'Panamá';
            }

            if (!countryGroups[country]) countryGroups[country] = {};
            if (!countryGroups[country][effectiveId]) {
                // Priority: selectableProducts label > stored productName > resolveProductName fallback
                const storedName = m.productName;
                const resolvedName = product ? product.label
                    : storedName || resolveProductName(effectiveId, orders as any, mappings, productGroups);
                countryGroups[country][effectiveId] = {
                    productId: effectiveId,
                    productName: resolvedName,
                    campaigns: []
                };
            }
            countryGroups[country][effectiveId].campaigns.push(m);
        });

        return Object.entries(countryGroups)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([country, prodGroups]) => ({
                country,
                products: Object.values(prodGroups).sort((a, b) => a.productName.localeCompare(b.productName))
            }));
    }, [mappings, availableProducts, selectableProducts, productGroups, orders]);

    const unmappedProducts = useMemo(() => {
        return selectableProducts.filter(p => {
            if (p.id === 'Todos') return false;

            const normalizedId = p.id.trim().toLowerCase();

            const isMapped = mappings.some(m => {
                const effectiveId = getEffectiveProductId(m.productId, productGroups).trim().toLowerCase();
                return effectiveId === normalizedId;
            });

            return !isMapped;
        });
    }, [selectableProducts, mappings, productGroups]);

    const groupedAiSuggestions = useMemo(() => {
        const groups: Record<string, {
            productId: string;
            productName: string;
            productCountry?: string;
            campaigns: AISuggestion[];
        }> = {};

        aiSuggestions.forEach(sug => {
            if (!groups[sug.suggestedProductId]) {
                groups[sug.suggestedProductId] = {
                    productId: sug.suggestedProductId,
                    productName: sug.suggestedProductName || sug.suggestedProductId,
                    productCountry: sug.suggestedProductCountry,
                    campaigns: []
                };
            }
            groups[sug.suggestedProductId].campaigns.push(sug);
        });

        return Object.values(groups).sort((a, b) => a.productName.localeCompare(b.productName));
    }, [aiSuggestions]);

    const groupingSuggestions = useMemo(() => {
        if (productGroups.length === 0) return [];

        const suggestions: { groupId: string; groupName: string; suggestedProducts: { id: string; label: string }[] }[] = [];

        selectableProducts.forEach(p => {
            if (p.id === 'Todos') return;
            if (productGroups.some(g => g.id === p.id)) return;

            const label = p.label.toLowerCase();

            productGroups.forEach(g => {
                const gName = g.name.toLowerCase();

                if ((label.includes(gName) || gName.includes(label)) && (label.length > 5 && gName.length > 5)) {
                    let groupMatch = suggestions.find(s => s.groupId === g.id);
                    if (!groupMatch) {
                        groupMatch = { groupId: g.id, groupName: g.name, suggestedProducts: [] };
                        suggestions.push(groupMatch);
                    }
                    groupMatch.suggestedProducts.push({ id: p.id, label: p.label });
                }
            });
        });

        return suggestions;
    }, [selectableProducts, productGroups]);

    const unmappedSpend = useMemo(() => {
        if (!rates) return 0;
        let total = 0;
        history.forEach(h => {
            const isMapped = mappings.some(m => m.campaignName === h.campaignName && m.platform === h.platform);
            if (!isMapped) {
                total += toCOP(h.amount, h.currency, rates);
            }
        });
        return total;
    }, [history, mappings, rates]);

    // ── Handlers ─────────────────────────────────────────────────────────────

    const handleAddMapping = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMapping.productId || newMapping.campaignNames.length === 0) return;
        setSaving(true);
        try {
            const selectedProduct = selectableProducts.find(p => p.id === newMapping.productId);
            const productLabel = selectedProduct?.label?.replace(/^📦 \[Grupo\] /, '') || newMapping.productId;
            await addMultipleCampaignMappings(newMapping.campaignNames.map(name => ({
                campaignName: name,
                productId: newMapping.productId,
                productName: productLabel,
                platform: newMapping.platform,
                updatedAt: Date.now()
            })), effectiveUid || '');
            const updated = await getCampaignMappings(effectiveUid || '');
            setMappings(updated);
            setNewMapping({ campaignNames: [], productId: '', platform: 'facebook' });
            setSuccess(true);
            setTimeout(() => setSuccess(false), 3000);
        } catch (error) {
            console.error('Error adding mapping:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleDeleteMapping = async (campaignName: string, platform: 'facebook' | 'tiktok') => {
        if (confirm('¿Eliminar esta vinculación?')) {
            await deleteCampaignMapping(campaignName, platform, effectiveUid || '');
            setMappings(prev => prev.filter(m => !(m.campaignName === campaignName && m.platform === platform)));
        }
    };

    const handleDeleteGroup = async (id: string) => {
        if (confirm('¿Eliminar este grupo de productos?')) {
            await deleteProductGroup(id, effectiveUid || '');
            setProductGroups(prev => prev.filter(g => g.id !== id));
        }
    };

    const handleAddGroup = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newGroupName || newGroupProducts.length < 2) return;
        setSaving(true);
        try {
            const existingGroup = productGroups.find(g => g.id === editingGroupId);
            const newGroup = {
                id: editingGroupId || `group_${Date.now()}`,
                name: newGroupName,
                productIds: newGroupProducts,
                createdAt: existingGroup ? (existingGroup as any).createdAt || Date.now() : Date.now(),
                updatedAt: Date.now()
            };
            await saveProductGroup(newGroup, effectiveUid || '');
            if (editingGroupId) {
                setProductGroups(prev => prev.map(g => g.id === editingGroupId ? newGroup : g));
            } else {
                setProductGroups(prev => [...prev, newGroup]);
            }
            setIsAddGroupModalOpen(false);
            setEditingGroupId(null);
            setNewGroupName('');
            setNewGroupProducts([]);
        } catch (error) {
            console.error('Error saving group:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleEditMapping = (productId: string, campaigns: CampaignMapping[]) => {
        setEditingMapping({ productId, campaigns });
        setEditNewProductId(productId);
        setIsEditModalOpen(true);
    };

    const handleUpdateMappingProduct = async () => {
        if (!editingMapping || !editNewProductId) return;
        setSaving(true);
        try {
            await Promise.all(editingMapping.campaigns.map(m =>
                updateCampaignMapping(m.campaignName, m.platform, editNewProductId, effectiveUid || '')
            ));
            const updated = await getCampaignMappings(effectiveUid || '');
            setMappings(updated);
            setIsEditModalOpen(false);
            setEditingMapping(null);
        } catch (error) {
            console.error('Error updating mappings:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReloadCampaigns = async () => {
        setSyncingAPI(true);
        setSyncStatus('Conectando con Facebook...');
        try {
            const fbToken = adSettings?.fb_token;
            const fbAccounts = adSettings?.fb_account_ids || [];
            if (!fbToken || fbAccounts.length === 0) {
                const h = await getAdSpendHistory(effectiveUid || '');
                setHistory(h);
                alert('ℹ️ Historial recargado. Configura token FB en Ajustes para sincronizar.');
                return;
            }
            // Use the global date filter instead of hardcoding 30 days
            const today = new Date();
            const todayStr = today.toISOString().split('T')[0];
            let syncStart = todayStr;
            if (dateRange === 'Personalizado' && startDateCustom) {
                syncStart = startDateCustom;
            } else if (dateRange === 'Mes Pasado') {
                syncStart = new Date(today.getFullYear(), today.getMonth() - 1, 1).toISOString().split('T')[0];
            } else if (dateRange === 'Este Mes') {
                syncStart = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
            } else if (dateRange === 'Últimos 30 Días') {
                syncStart = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            } else if (dateRange === 'Últimos 7 Días') {
                syncStart = new Date(Date.now() - 7 * 86400000).toISOString().split('T')[0];
            } else {
                syncStart = new Date(Date.now() - 30 * 86400000).toISOString().split('T')[0];
            }
            const syncEnd = (dateRange === 'Personalizado' && endDateCustom) ? endDateCustom
                : (dateRange === 'Mes Pasado') ? new Date(today.getFullYear(), today.getMonth(), 0).toISOString().split('T')[0]
                : todayStr;
            const bulkRows: BulkAdSpendRow[] = [];
            for (const account of fbAccounts) {
                setSyncStatus(`Descargando FB: ${account.name || account.id}...`);
                // Fetch the REAL currency from Meta API (not user settings)
                const accountCurrency = await fetchAccountCurrency(fbToken, account.id);
                const rows = await fetchMetaAdSpend(fbToken, account.id, syncStart, syncEnd);
                for (const row of rows) {
                    const spend = parseFloat(row.spend || '0');
                    if (spend <= 0) continue;
                    let targetCountry = 'Desconocido';
                    const cleanName = String(row.campaign_name).trim();
                    const existingMapping = mappings.find(m =>
                        m.campaignName.trim().toLowerCase() === cleanName.toLowerCase() &&
                        m.platform === 'facebook'
                    );
                    if (existingMapping) {
                        const product = availableProducts.find(p => p.id === existingMapping.productId);
                        if (product?.country && product.country !== 'Todos') {
                            targetCountry = product.country;
                        }
                    }
                    if (targetCountry === 'Desconocido') {
                        const upper = cleanName.toUpperCase();
                        if (upper.includes('COLOMBIA') || upper.includes('CO-')) targetCountry = 'Colombia';
                        else if (upper.includes('ECUADOR') || upper.includes('EC-')) targetCountry = 'Ecuador';
                        else if (upper.includes('GUATEMALA') || upper.includes('GT-')) targetCountry = 'Guatemala';
                        else if (upper.includes('PANAMA') || upper.includes('PA-')) targetCountry = 'Panamá';
                    }
                    bulkRows.push({
                        country: targetCountry,
                        date: row.date_start,
                        amount: spend,
                        currency: accountCurrency,
                        platform: 'facebook',
                        campaignName: cleanName,
                        userId: effectiveUid || '',
                        metrics: {
                            impressions: parseInt(row.impressions || '0'),
                            clicks: parseInt(row.clicks || '0'),
                            ctr: parseFloat(row.inline_link_click_ctr || '0'),
                            cpc: parseFloat(row.cpc || '0'),
                        },
                    });
                }
            }
            let totalSaved = 0;
            if (bulkRows.length > 0) {
                setSyncStatus(`Guardando ${bulkRows.length} registros (batch)...`);
                totalSaved = await saveBulkAdSpend(bulkRows);
            }
            const h = await getAdSpendHistory(effectiveUid || '');
            setHistory(h);
            alert(totalSaved > 0 ? `✅ ${totalSaved} registros sincronizados.` : '✅ Todo actualizado.');
        } catch (error: any) {
            if (error instanceof MetaTokenExpiredError) {
                alert('❌ Token de Facebook expirado. Actualízalo en Sunny > El Motor.');
            } else {
                alert('❌ Error: ' + (error?.message || 'Error desconocido'));
            }
        } finally {
            setSyncingAPI(false);
            setSyncStatus('');
        }
    };

    const handleClearAndResync = async () => {
        if (!confirm('⚠️ Esto eliminará TODOS los datos de publicidad y volverá a sincronizar desde Facebook.\n\nLos mapeos de campañas NO se pierden.\n\n¿Continuar?')) return;
        setSyncingAPI(true);
        setSyncStatus('Eliminando datos antiguos...');
        try {
            const deleted = await clearAdSpendHistory(effectiveUid || '');
            setSyncStatus(`${deleted} registros eliminados. Re-sincronizando...`);
            // Now trigger the normal sync
            await handleReloadCampaigns();
        } catch (error: any) {
            alert('❌ Error: ' + (error?.message || 'Error desconocido'));
            setSyncingAPI(false);
            setSyncStatus('');
        }
    };

    const handleClearAll = async () => {
        if (!confirm('⚠️ ¿Estás seguro de eliminar TODOS los mapeos?')) return;
        setIsClearing(true);
        try {
            for (const m of mappings) {
                await deleteCampaignMapping(m.campaignName, m.platform, effectiveUid || '');
            }
            setMappings([]);
        } catch (error) {
            console.error('Error clearing mappings:', error);
        } finally {
            setIsClearing(false);
        }
    };

    const handleTikTokCSVUpload = async (file: File) => {
        setImportingCSV(true);
        try {
            const importId = `import_${Date.now()}_${Math.random().toString(36).substring(7)}`;

            await new Promise<void>((resolve, reject) => {
                const reader = new FileReader();
                reader.onerror = () => reject(new Error('No se pudo leer el archivo.'));
                reader.onload = async (e) => {
                    try {
                        const data = e.target?.result;
                        const XLSX = await import('xlsx');
                        const workbook = XLSX.read(data, { type: 'binary' });
                        const firstSheet = workbook.Sheets[workbook.SheetNames[0]];
                        const rawRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                        if (rawRows.length === 0) {
                            alert('⚠️ El archivo está vacío o no se pudo leer.');
                            resolve();
                            return;
                        }

                        const headerRowIdx = detectHeaderRow(rawRows);
                        const headers: string[] = (rawRows[headerRowIdx] || []).map((h: any) => String(h ?? '').trim());
                        const dataRows = rawRows.slice(headerRowIdx + 1);

                        const campaignIdx = findColumnIndex(headers, COLUMN_VARIANTS.campaign);
                        const spendIdx = findColumnIndex(headers, COLUMN_VARIANTS.spend);
                        const dateIdx = findColumnIndex(headers, COLUMN_VARIANTS.date);
                        const currencyIdx = findColumnIndex(headers, COLUMN_VARIANTS.currency);

                        // Metric columns
                        const impressionsIdx = findColumnIndex(headers, COLUMN_VARIANTS.impressions);
                        const clicksIdx = findColumnIndex(headers, COLUMN_VARIANTS.clicks);
                        const ctrIdx = findColumnIndex(headers, COLUMN_VARIANTS.ctr);
                        const cpcIdx = findColumnIndex(headers, COLUMN_VARIANTS.cpc);
                        const conversionsIdx = findColumnIndex(headers, COLUMN_VARIANTS.conversions);
                        const reachIdx = findColumnIndex(headers, COLUMN_VARIANTS.reach);
                        const revenueIdx = findColumnIndex(headers, COLUMN_VARIANTS.revenue);

                        if (campaignIdx === -1 || spendIdx === -1 || dateIdx === -1) {
                            alert(`⚠️ No se encontraron las columnas necesarias.\n\nColumnas detectadas:\n${headers.join(', ')}`);
                            resolve();
                            return;
                        }

                        let importedCount = 0;
                        let skippedBlank = 0;
                        let skippedZeroSpend = 0;
                        let skippedBadData = 0;
                        let mappedCount = 0;
                        let totalSpend = 0;
                        const bulkRows: BulkAdSpendRow[] = [];
                        const unmappedCampaigns = new Map<string, number>(); // name → total spend
                        const mappedCampaigns = new Map<string, number>();

                        for (const row of dataRows) {
                            if (!Array.isArray(row) || row.every(c => c === undefined || c === null || c === '')) {
                                skippedBlank++;
                                continue;
                            }

                            const campaignName = row[campaignIdx];
                            const spendRaw = row[spendIdx];
                            const dateStr = row[dateIdx];

                            if (!campaignName || !dateStr) { skippedBadData++; continue; }
                            if (String(campaignName).toLowerCase().includes('total')) { skippedBlank++; continue; }

                            const spend = parseNumber(spendRaw);
                            if (spend <= 0) { skippedZeroSpend++; continue; }

                            const rowCurrency = currencyIdx !== -1 ? String(row[currencyIdx] || 'USD').toUpperCase() : 'USD';
                            let rowTargetCountry = 'Desconocido';
                            const cleanName = String(campaignName).trim();

                            const existingMapping = mappings.find(m =>
                                m.campaignName.trim().toLowerCase() === cleanName.toLowerCase() &&
                                m.platform === 'tiktok'
                            );

                            if (existingMapping) {
                                mappedCount++;
                                mappedCampaigns.set(cleanName, (mappedCampaigns.get(cleanName) || 0) + spend);
                                const product = availableProducts.find(p => p.id === existingMapping.productId);
                                if (product?.country && product.country !== 'Todos') {
                                    rowTargetCountry = product.country;
                                } else if (selectedCountry !== 'Todos') {
                                    rowTargetCountry = selectedCountry;
                                }
                            } else {
                                unmappedCampaigns.set(cleanName, (unmappedCampaigns.get(cleanName) || 0) + spend);
                                if (selectedCountry !== 'Todos') {
                                    rowTargetCountry = selectedCountry;
                                } else {
                                    const detected = detectCountryFromCampaign(cleanName);
                                    if (detected) rowTargetCountry = detected;
                                }
                            }

                            const formattedDate = parseDate(dateStr);
                            if (!formattedDate) { skippedBadData++; continue; }

                            totalSpend += spend;

                            // Build metrics object from detected columns
                            const metrics: Record<string, number> = {};
                            if (impressionsIdx !== -1) metrics.impressions = parseNumber(row[impressionsIdx]);
                            if (clicksIdx !== -1) metrics.clicks = parseNumber(row[clicksIdx]);
                            if (ctrIdx !== -1) metrics.ctr = parseNumber(row[ctrIdx]);
                            if (cpcIdx !== -1) metrics.cpc = parseNumber(row[cpcIdx]);
                            if (conversionsIdx !== -1) metrics.conversions = parseNumber(row[conversionsIdx]);
                            if (reachIdx !== -1) metrics.reach = parseNumber(row[reachIdx]);
                            if (revenueIdx !== -1) metrics.revenue_attributed = parseNumber(row[revenueIdx]);

                            bulkRows.push({
                                country: rowTargetCountry,
                                date: formattedDate,
                                amount: spend,
                                currency: rowCurrency,
                                platform: 'tiktok',
                                campaignName: cleanName,
                                userId: effectiveUid || '',
                                ...(Object.keys(metrics).length > 0 ? { metrics } : {}),
                            });
                            importedCount++;
                        }

                        // Pre-aggregate: sum amounts for same campaign+date to prevent overwrites in Firebase
                        const aggregated = new Map<string, BulkAdSpendRow>();
                        for (const row of bulkRows) {
                            const key = `${row.date}_${row.campaignName}`.toLowerCase();
                            const existing = aggregated.get(key);
                            if (existing) {
                                existing.amount += row.amount;
                                if (row.metrics && existing.metrics) {
                                    for (const [k, v] of Object.entries(row.metrics)) {
                                        existing.metrics[k] = (existing.metrics[k] || 0) + (v as number);
                                    }
                                } else if (row.metrics) {
                                    existing.metrics = { ...row.metrics };
                                }
                            } else {
                                aggregated.set(key, { ...row, metrics: row.metrics ? { ...row.metrics } : undefined });
                            }
                        }
                        const finalRows = Array.from(aggregated.values()).map(r => ({ ...r, importId }));

                        if (finalRows.length > 0) {
                            // Clear old TikTok data first, then save fresh
                            await clearPlatformAdSpend(effectiveUid || '', 'tiktok');
                            await saveBulkAdSpend(finalRows);
                        }

                        if (importedCount > 0) {
                            const logsCol = collection(db, 'import_logs');
                            await setDoc(doc(logsCol, importId), {
                                fileName: file.name,
                                platform: 'tiktok',
                                uploaded_at: Timestamp.now(),
                                rowCount: importedCount,
                                userId: effectiveUid || 'admin',
                                logType: 'ad_spend'
                            });
                        }

                        const h = await getAdSpendHistory(effectiveUid || '');
                        setHistory(h);
                        const iHistory = await getAdSpendImportHistory(effectiveUid || '');
                        setImportHistory(iHistory);

                        // Build detailed summary
                        const fmtSpend = (n: number) => `$${Math.round(n).toLocaleString('en-US')}`;
                        const totalSkipped = skippedBlank + skippedZeroSpend + skippedBadData;
                        const uniqueMapped = mappedCampaigns.size;
                        const uniqueUnmapped = unmappedCampaigns.size;

                        const aggregatedCount = finalRows.length;
                        const wasAggregated = importedCount > aggregatedCount;

                        let msg = `✅ TikTok Import: ${importedCount} filas → ${aggregatedCount} registros guardados${wasAggregated ? ' (agregados por campaña+fecha)' : ''}`;
                        msg += `\n\n💰 Gasto total importado: ${fmtSpend(totalSpend)}`;
                        msg += `\n📊 Campañas únicas: ${uniqueMapped + uniqueUnmapped} (${uniqueMapped} mapeadas, ${uniqueUnmapped} sin mapear)`;

                        if (mappedCount > 0) {
                            msg += `\n✅ ${mappedCount} filas asignadas por mapeos previos`;
                        }

                        if (totalSkipped > 0) {
                            const details = [];
                            if (skippedZeroSpend > 0) details.push(`${skippedZeroSpend} con $0`);
                            if (skippedBlank > 0) details.push(`${skippedBlank} vacías/totales`);
                            if (skippedBadData > 0) details.push(`${skippedBadData} con datos inválidos`);
                            msg += `\n\n⏭️ ${totalSkipped} filas omitidas: ${details.join(', ')}`;
                        }

                        // Show detected columns
                        const detectedMetrics = [];
                        if (impressionsIdx !== -1) detectedMetrics.push('Impressions');
                        if (clicksIdx !== -1) detectedMetrics.push('Clicks');
                        if (ctrIdx !== -1) detectedMetrics.push('CTR');
                        if (cpcIdx !== -1) detectedMetrics.push('CPC');
                        if (conversionsIdx !== -1) detectedMetrics.push('Conversions');
                        if (reachIdx !== -1) detectedMetrics.push('Reach');
                        if (revenueIdx !== -1) detectedMetrics.push('Revenue');
                        msg += `\n\n📋 Columnas detectadas: Campaign, Cost, Date${detectedMetrics.length > 0 ? ', ' + detectedMetrics.join(', ') : ''}`;

                        if (unmappedCampaigns.size > 0) {
                            msg += `\n\n⚠️ Campañas SIN mapear (${unmappedCampaigns.size}):`;
                            const sortedUnmapped = [...unmappedCampaigns.entries()].sort((a, b) => b[1] - a[1]);
                            sortedUnmapped.forEach(([name, s]) => {
                                msg += `\n• ${name}: ${fmtSpend(s)}`;
                            });
                        }

                        // Log detailed data for debugging
                        console.log('[TikTok Import] Headers:', headers);
                        console.log('[TikTok Import] Column indices:', { campaignIdx, spendIdx, dateIdx, currencyIdx, impressionsIdx, clicksIdx, ctrIdx, cpcIdx, conversionsIdx, reachIdx, revenueIdx });
                        console.log('[TikTok Import] Mapped campaigns:', Object.fromEntries(mappedCampaigns));
                        console.log('[TikTok Import] Unmapped campaigns:', Object.fromEntries(unmappedCampaigns));
                        console.log('[TikTok Import] Total spend:', totalSpend);
                        console.log('[TikTok Import] Sample rows:', bulkRows.slice(0, 3));

                        alert(msg);
                        resolve();
                    } catch (innerErr) {
                        reject(innerErr);
                    }
                };
                reader.readAsBinaryString(file);
            });
        } catch (error: any) {
            alert('Error: ' + error.message);
        } finally {
            setImportingCSV(false);
        }
    };

    const handleDeleteImport = async (importId: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta importación? Se borrarán todos los registros de gasto asociados.')) return;
        try {
            await deleteAdSpendImport(importId);
            const h = await getAdSpendHistory(effectiveUid || '');
            setHistory(h);
            const iHistory = await getAdSpendImportHistory(effectiveUid || '');
            setImportHistory(iHistory);
        } catch (error) {
            console.error('Error deleting import:', error);
        }
    };

    const handleGenerateSuggestions = async () => {
        if (unmappedCampaigns.length === 0) {
            alert('No hay campañas pendientes para analizar.');
            return;
        }

        setAiMappingInProgress(true);
        try {
            const uniqueProducts = new Map<string, { id: string; name: string; country: string }>();
            availableProducts
                .filter(p => p.id !== 'Todos')
                .forEach(p => uniqueProducts.set(p.id, { id: p.id, name: p.label, country: p.country || 'Unknown' }));

            const existingMappingsContext = mappings.map(m => ({
                campaignName: m.campaignName,
                productId: m.productId
            }));

            const suggestions = await generateMappingSuggestions(
                unmappedCampaigns,
                Array.from(uniqueProducts.values()),
                existingMappingsContext,
                effectiveUid || ''
            );
            setAiSuggestions(suggestions);
        } catch (error: any) {
            console.error('Error generating AI suggestions:', error);
            alert('Error al generar sugerencias con IA: ' + (error?.message || 'Verifica tu API Key en Ajustes.'));
        } finally {
            setAiMappingInProgress(false);
        }
    };

    const handleAcceptSuggestion = async (suggestion: any) => {
        try {
            const selectedProduct = selectableProducts.find(p => p.id === suggestion.suggestedProductId);
            const productLabel = selectedProduct?.label?.replace(/^📦 \[Grupo\] /, '') || suggestion.suggestedProductId;
            await addMultipleCampaignMappings([{
                campaignName: suggestion.campaignName,
                productId: suggestion.suggestedProductId,
                productName: productLabel,
                platform: suggestion.platform,
                updatedAt: Date.now()
            }], effectiveUid || '');
            await updateAISuggestionStatus(suggestion.id, 'accepted', effectiveUid || '');
            await deleteAISuggestion(suggestion.id, effectiveUid || '');
            setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));
            const updated = await getCampaignMappings(effectiveUid || '');
            setMappings(updated);
        } catch (error) {
            console.error('Error accepting suggestion:', error);
        }
    };

    const handleRejectSuggestion = async (id: string) => {
        try {
            await updateAISuggestionStatus(id, 'rejected', effectiveUid || '');
            await deleteAISuggestion(id, effectiveUid || '');
            setAiSuggestions(prev => prev.filter(s => s.id !== id));
        } catch (error) {
            console.error('Error rejecting suggestion:', error);
        }
    };

    const handleAcceptGroup = async (groupCampaigns: AISuggestion[]) => {
        for (const sug of groupCampaigns) {
            await handleAcceptSuggestion(sug);
        }
    };

    const handleRejectGroup = async (groupCampaigns: AISuggestion[]) => {
        for (const sug of groupCampaigns) {
            await handleRejectSuggestion(sug.id);
        }
    };

    // ── Render ────────────────────────────────────────────────────────────────

    if (isInitialLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-8 h-8 animate-spin text-accent" />
            </div>
        );
    }

    return (
        <div className="space-y-8">
            {/* ── MAPEO SECTION ─────────────────────────────────────────────── */}
            {activeSection === 'mapeo' && (
                <div className="space-y-12 animate-in fade-in duration-500">
                    <div className="bg-card backdrop-blur-xl border border-[#d75c33]/10 rounded-2xl p-8 flex flex-col md:flex-row items-center justify-between gap-6">
                        <div className="flex items-center gap-6">
                            <div className="flex flex-col">
                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest leading-none mb-2">Mapeo de Campañas</h3>
                                <div className="flex items-center gap-4 text-[10px] font-bold text-muted uppercase tracking-widest">
                                    <div className="flex items-center gap-2">
                                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                                        {mappings.length} mapeos activos
                                    </div>
                                    {unmappedSpend > 0 && (
                                        <>
                                            <div className="w-px h-4 bg-white/10"></div>
                                            <div className="flex items-center gap-2 px-3 py-1.5 bg-orange-500/10 border border-orange-500/20 rounded-xl">
                                                <DollarSign className="w-3.5 h-3.5 text-orange-400" />
                                                <span className="text-orange-400 uppercase tracking-widest">{formatCurrency(unmappedSpend)} sin asignar</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                            <div className="h-12 w-px bg-[#d75c33]/10 hidden md:block" />
                            <div className="flex gap-2 p-1.5 bg-card border border-[#d75c33]/10 rounded-2xl">
                                <button onClick={() => setMappingMode('ai')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mappingMode === 'ai' ? 'bg-[#d75c33] text-white' : 'text-muted hover:text-foreground'}`}>Autopiloto IA</button>
                                <button onClick={() => setMappingMode('manual')} className={`px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${mappingMode === 'manual' ? 'bg-blue-600 text-white' : 'text-muted hover:text-foreground'}`}>Modo Manual</button>
                            </div>
                        </div>
                        <div className="flex items-center gap-3">
                            <input ref={csvInputRef} type="file" accept=".csv,.xls,.xlsx" className="hidden" onChange={(e) => e.target.files?.[0] && handleTikTokCSVUpload(e.target.files[0])} />
                            <button onClick={() => csvInputRef.current?.click()} className="flex items-center gap-2 px-6 py-4 rounded-2xl bg-teal-600/10 border border-teal-500/30 text-teal-400 hover:bg-teal-600/20 transition-all text-[10px] font-black uppercase tracking-[0.2em]">
                                {importingCSV ? <Loader2 className="w-4 h-4 animate-spin" /> : <Upload className="w-4 h-4" />} Subir TikTok
                            </button>
                            <button
                                onClick={handleReloadCampaigns}
                                disabled={syncingAPI}
                                className="flex items-center gap-2 px-6 py-4 bg-blue-600/10 border border-blue-500/30 hover:bg-blue-600/20 text-blue-300 disabled:opacity-60 disabled:cursor-not-allowed rounded-2xl transition-all text-[10px] font-black uppercase tracking-[0.2em] min-w-[140px]"
                            >
                                {syncingAPI ? (
                                    <>
                                        <Loader2 className="w-4 h-4 animate-spin shrink-0" />
                                        <span className="truncate max-w-[160px]">{syncStatus || 'Sincronizando...'}</span>
                                    </>
                                ) : (
                                    <>
                                        <RefreshCw className="w-4 h-4 shrink-0" />
                                        Sincronizar FB
                                    </>
                                )}
                            </button>
                            <button
                                onClick={handleClearAndResync}
                                disabled={syncingAPI}
                                className="flex items-center gap-2 px-6 py-4 bg-amber-600/10 border border-amber-500/30 hover:bg-amber-600/20 text-amber-300 disabled:opacity-60 disabled:cursor-not-allowed rounded-2xl transition-all text-[10px] font-black uppercase tracking-[0.2em]"
                            >
                                {syncingAPI ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Limpiar y Re-sync
                            </button>
                            <button onClick={handleClearAll} className="flex items-center gap-3 px-8 py-4 bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-400 rounded-2xl transition-all text-[10px] font-black uppercase tracking-[0.2em]">
                                {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Limpiar Mapeos
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                        <div className="lg:col-span-8 space-y-12">
                            {/* AI Autopilot Section */}
                            {mappingMode === 'ai' && (
                                <div className="space-y-10 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <div className="bg-card border border-[#d75c33]/20 p-12 rounded-2xl shadow-2xl relative overflow-hidden group">
                                        <div className="absolute top-0 right-0 p-12 opacity-5 group-hover:opacity-10 transition-opacity">
                                            <Zap className="w-32 h-32 text-[#d75c33]" />
                                        </div>
                                        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-8">
                                            <div>
                                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-4 flex items-center gap-4">
                                                    Autopiloto IA
                                                    <span className="px-3 py-1 bg-[#d75c33]/20 text-[#d75c33] text-[10px] font-black rounded-lg border border-[#d75c33]/30 tracking-widest">BETA</span>
                                                </h3>
                                                <p className="text-muted text-sm max-w-xl font-medium leading-relaxed">
                                                    Analiza automáticamente tus campañas no vinculadas usando inteligencia artificial para sugerir el producto más probable basándose en patrones de nombres y países.
                                                </p>
                                            </div>
                                            <button
                                                onClick={handleGenerateSuggestions}
                                                disabled={aiMappingInProgress || unmappedCampaigns.length === 0}
                                                className="px-10 py-5 bg-[#d75c33] hover:bg-[#ef6b3d] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-[2rem] font-black uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-[#d75c33]/20 flex items-center justify-center gap-3 min-w-[240px]"
                                            >
                                                {aiMappingInProgress ? (
                                                    <>
                                                        <Loader2 className="w-5 h-5 animate-spin" />
                                                        Analizando...
                                                    </>
                                                ) : (
                                                    <>
                                                        <Sparkles className="w-5 h-5" />
                                                        Analizar {unmappedCampaigns.length} Campañas
                                                    </>
                                                )}
                                            </button>
                                        </div>
                                    </div>

                                    {aiSuggestions.length > 0 && (
                                        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
                                            {groupedAiSuggestions.map((group) => (
                                                <div key={group.productId} className="bg-gradient-to-br from-black/80 to-black/40 border border-card-border p-6 rounded-[2rem] hover:border-[#d75c33]/40 transition-all flex flex-col">
                                                    {/* Product Header */}
                                                    <div className="flex justify-between items-start mb-6">
                                                        <div className="flex gap-4">
                                                            <div className="w-10 h-10 rounded-xl bg-[#d75c33]/10 border border-[#d75c33]/20 flex items-center justify-center shrink-0">
                                                                <Sparkles className="w-5 h-5 text-[#d75c33]" />
                                                            </div>
                                                            <div>
                                                                <div className="flex items-center gap-2 mb-1">
                                                                    <div className="text-[9px] font-black text-muted uppercase tracking-widest leading-none">Producto Sugerido</div>
                                                                    {group.productCountry && (
                                                                        <span className="text-[8px] font-black bg-[#d75c33]/20 text-[#d75c33] px-1.5 py-0.5 rounded border border-[#d75c33]/30 uppercase leading-none" title={`País de origen: ${group.productCountry}`}>
                                                                            {group.productCountry}
                                                                        </span>
                                                                    )}
                                                                </div>
                                                                <h3 className="text-sm font-black text-foreground leading-tight line-clamp-2">{group.productName}</h3>
                                                            </div>
                                                        </div>
                                                    </div>

                                                    {/* Campaign List */}
                                                    <div className="space-y-3 mb-6 flex-1 overflow-y-auto pr-2 custom-scrollbar" style={{ maxHeight: '240px' }}>
                                                        {group.campaigns.map((suggestion) => (
                                                            <div key={suggestion.id} className="bg-hover-bg p-4 rounded-2xl border border-card-border group/sugg relative">
                                                                <div className="flex gap-3 mb-3">
                                                                    <span className={`text-[8px] font-black uppercase tracking-widest shrink-0 py-0.5 px-1.5 rounded bg-hover-bg ${suggestion.platform === 'facebook' ? 'text-blue-400' : 'text-teal-400'}`}>
                                                                        {suggestion.platform}
                                                                    </span>
                                                                    {suggestion.country && (
                                                                        <span className="text-[8px] font-black text-muted uppercase tracking-widest shrink-0 py-0.5 px-1.5 rounded bg-hover-bg">
                                                                            {suggestion.country}
                                                                        </span>
                                                                    )}
                                                                    <div className={`px-1.5 py-0.5 rounded text-[8px] font-black shrink-0 ml-auto flex items-center gap-1 ${suggestion.confidence > 0.8 ? 'text-emerald-400 bg-emerald-500/10' : 'text-orange-400 bg-orange-500/10'}`}>
                                                                        {Math.round(suggestion.confidence * 100)}% Confianza
                                                                    </div>
                                                                </div>

                                                                <div className="relative group/name cursor-help mb-3">
                                                                    <h4 className="text-foreground/80 font-bold text-xs line-clamp-2 leading-relaxed" title={suggestion.campaignName}>
                                                                        {suggestion.campaignName}
                                                                    </h4>
                                                                    <div className="absolute left-0 top-full mt-2 hidden group-hover/name:block bg-card border border-card-border text-white text-xs p-3 rounded-xl z-[100] shadow-2xl whitespace-normal break-words w-max max-w-[240px]">
                                                                        {suggestion.campaignName}
                                                                    </div>
                                                                </div>

                                                                <div className="flex gap-2">
                                                                    <button
                                                                        onClick={() => handleAcceptSuggestion(suggestion)}
                                                                        className="flex-1 py-1.5 bg-hover-bg hover:bg-emerald-500/20 text-muted hover:text-emerald-400 font-black rounded-xl text-[9px] uppercase tracking-widest transition-all border border-card-border flex items-center justify-center gap-1.5"
                                                                    >
                                                                        <Check className="w-3 h-3" /> Aceptar
                                                                    </button>
                                                                    <button
                                                                        onClick={() => handleRejectSuggestion(suggestion.id)}
                                                                        className="px-3 py-1.5 bg-hover-bg hover:bg-rose-500/10 text-muted hover:text-rose-400 font-black rounded-xl transition-all border border-card-border"
                                                                    >
                                                                        <X className="w-3 h-3" />
                                                                    </button>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>

                                                    {/* Group Actions */}
                                                    {group.campaigns.length > 1 && (
                                                        <div className="flex gap-3 pt-6 border-t border-white/5 mt-auto">
                                                            <button
                                                                onClick={() => handleAcceptGroup(group.campaigns)}
                                                                className="flex-1 py-3.5 bg-[#d75c33] hover:bg-[#ef6b3d] text-white font-black rounded-2xl text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2"
                                                            >
                                                                <Check className="w-4 h-4" /> Aceptar Todas ({group.campaigns.length})
                                                            </button>
                                                            <button
                                                                onClick={() => handleRejectGroup(group.campaigns)}
                                                                className="px-4 py-3.5 bg-hover-bg hover:bg-rose-500/10 text-muted hover:text-rose-400 rounded-2xl transition-all border border-card-border"
                                                            >
                                                                <Trash2 className="w-4 h-4" />
                                                            </button>
                                                        </div>
                                                    )}
                                                    {group.campaigns.length === 1 && (
                                                        <div className="pt-6 border-t border-white/5 mt-auto text-center">
                                                            <span className="text-[9px] font-black text-muted uppercase tracking-widest">1 Campaña Sugerida</span>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}

                                    {aiSuggestions.length === 0 && !aiMappingInProgress && unmappedCampaigns.length > 0 && (
                                        <div className="py-20 text-center bg-hover-bg rounded-2xl border border-dashed border-card-border">
                                            <Target className="w-12 h-12 text-gray-700 mx-auto mb-4 opacity-20" />
                                            <p className="text-muted font-bold uppercase tracking-widest text-[11px]">Listo para analizar tus campañas pendientes</p>
                                        </div>
                                    )}
                                </div>
                            )}

                            {/* Manual Mapping Form */}
                            {mappingMode === 'manual' && (
                                <div className="bg-card border border-[#d75c33]/10 p-10 rounded-2xl shadow-2xl relative z-20">
                                    <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-10">Nueva Vinculación</h3>
                                    <form onSubmit={handleAddMapping} className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                        <div className="space-y-8" ref={campaignDropdownRef}>
                                            <label className="text-[11px] font-black text-muted uppercase tracking-[0.15em] block">1. Seleccionar Campañas</label>
                                            <div onClick={() => setIsCampaignDropdownOpen(!isCampaignDropdownOpen)} className="w-full bg-card border border-card-border rounded-2xl px-6 py-5 text-sm text-foreground/80 cursor-pointer min-h-[64px] flex flex-wrap gap-2">
                                                {newMapping.campaignNames.length > 0 ? newMapping.campaignNames.map((n, idx) => (
                                                    <span key={`${n}_${idx}`} className="px-3 py-1 bg-blue-500/20 text-blue-400 text-[10px] font-bold rounded-lg border border-blue-500/30">{n}</span>
                                                )) : <span className="text-muted">Seleccionar campañas detectadas...</span>}
                                            </div>
                                            {isCampaignDropdownOpen && (
                                                <div className="absolute z-50 w-full mt-3 bg-card border border-card-border rounded-2xl p-6 shadow-2xl max-h-[300px] overflow-y-auto space-y-2">
                                                    <div className="sticky top-0 bg-card pb-2 z-10">
                                                        <input
                                                            type="text"
                                                            placeholder="Buscar campaña..."
                                                            value={campaignSearchTerm}
                                                            onChange={(e) => setCampaignSearchTerm(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full bg-card border border-card-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-blue-500/50 outline-none"
                                                        />
                                                    </div>
                                                    {availableCampaigns
                                                        .filter(c => !mappings.some(m => m.campaignName === c.name && m.platform === c.platform))
                                                        .filter(c => c.name.toLowerCase().includes(campaignSearchTerm.toLowerCase()))
                                                        .map(c => (
                                                            <div key={`${c.name}_${c.platform}_${c.country}`} onClick={() => setNewMapping({ ...newMapping, campaignNames: newMapping.campaignNames.includes(c.name) ? newMapping.campaignNames.filter((n: string) => n !== c.name) : [...newMapping.campaignNames, c.name], platform: c.platform })} className={`p-4 rounded-xl cursor-pointer transition-all ${newMapping.campaignNames.includes(c.name) ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-hover-bg text-muted'}`}>
                                                                {c.name} ({c.platform}) {c.country ? `[${c.country}]` : ''}
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                        </div>
                                        <div className="space-y-8" ref={productDropdownRef}>
                                            <label className="text-[11px] font-black text-muted uppercase tracking-[0.15em] block">2. Seleccionar Producto</label>
                                            <div onClick={() => setIsProductDropdownOpen(!isProductDropdownOpen)} className="w-full bg-card border border-card-border rounded-2xl px-6 py-5 text-sm text-foreground/80 cursor-pointer min-h-[64px]">
                                                {newMapping.productId || 'Seleccionar producto...'}
                                            </div>
                                            {isProductDropdownOpen && (
                                                <div className="absolute z-50 w-full mt-3 bg-card border border-card-border rounded-2xl p-6 shadow-2xl max-h-[300px] overflow-y-auto space-y-2">
                                                    <div className="sticky top-0 bg-card pb-2 z-10">
                                                        <input
                                                            type="text"
                                                            placeholder="Buscar producto..."
                                                            value={productSearchTerm}
                                                            onChange={(e) => setProductSearchTerm(e.target.value)}
                                                            onClick={(e) => e.stopPropagation()}
                                                            className="w-full bg-card border border-card-border rounded-xl px-4 py-3 text-sm text-foreground focus:border-orange-500/50 outline-none"
                                                        />
                                                    </div>
                                                    {[
                                                        { id: 'global', label: 'Carga Global', country: 'GL' },
                                                        ...Array.from(new Map(selectableProducts.filter(p => p.id !== 'Todos').map(p => [p.label.trim().toLowerCase(), p])).values())
                                                    ].filter(p => p.label.toLowerCase().includes(productSearchTerm.toLowerCase()) || p.id.toLowerCase().includes(productSearchTerm.toLowerCase()))
                                                        .map(p => (
                                                            <div key={p.id} onClick={() => { setNewMapping({ ...newMapping, productId: p.id }); setIsProductDropdownOpen(false); setProductSearchTerm(''); }} className={`p-4 rounded-xl cursor-pointer transition-all flex items-center gap-2 ${newMapping.productId === p.id ? 'bg-orange-600 text-white shadow-lg' : 'hover:bg-hover-bg text-muted'}`}>
                                                                <span className="text-[10px] text-emerald-500 font-bold uppercase tracking-widest px-1.5 py-0.5 rounded border border-emerald-500/20 bg-emerald-500/10 shrink-0">
                                                                    {p.country ? (p.country === 'Global' ? 'GL' : p.country.substring(0, 2)) : 'N/A'}
                                                                </span>
                                                                <span className="truncate">{p.label}</span>
                                                                <span className="text-[10px] text-muted ml-auto shrink-0">({p.id})</span>
                                                            </div>
                                                        ))}
                                                </div>
                                            )}
                                            <button type="submit" disabled={saving} className="w-full mt-6 bg-emerald-600 hover:bg-emerald-500 text-white font-black py-4 rounded-2xl transition-all uppercase tracking-widest text-[11px]">
                                                {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'Guardar Mapeo'}
                                            </button>
                                        </div>
                                    </form>
                                </div>
                            )}

                            {/* Active Mappings */}
                            <div className="space-y-12">
                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest border-l-4 border-blue-500 pl-4">Vinculaciones Activas</h3>

                                <div className="space-y-6">
                                    {mappingsByCountryAndProduct.map(({ country, products }) => {
                                        const isExpanded = expandedCountries[country];
                                        return (
                                            <div key={country} className="space-y-4">
                                                <button
                                                    onClick={() => setExpandedCountries(prev => ({ ...prev, [country]: !prev[country] }))}
                                                    className="w-full flex items-center gap-4 hover:opacity-80 transition-all group py-2"
                                                >
                                                    <div className="flex items-center gap-3">
                                                        <div className="p-2 bg-hover-bg rounded-xl border border-card-border group-hover:border-blue-500/30 transition-all">
                                                            <Globe className={`w-3.5 h-3.5 transition-all ${!isExpanded ? 'text-muted' : 'text-blue-500'}`} />
                                                        </div>
                                                        <h4 className="text-xs font-black text-foreground uppercase tracking-widest">{country}</h4>
                                                        <span className="text-[9px] font-bold text-muted bg-hover-bg px-2 py-0.5 rounded-lg border border-card-border">
                                                            {products.length}
                                                        </span>
                                                    </div>
                                                    <div className="flex-1 h-px bg-hover-bg"></div>
                                                    <div className={`p-1.5 rounded-lg bg-hover-bg border border-card-border transition-transform duration-300 ${isExpanded ? 'rotate-180' : ''}`}>
                                                        <ChevronDown className="w-3.5 h-3.5 text-muted" />
                                                    </div>
                                                </button>

                                                {isExpanded && (
                                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-in slide-in-from-top-2 duration-300">
                                                        {products.map((group, idx) => (
                                                            <div key={idx} className="p-8 bg-card border border-card-border backdrop-blur-md rounded-2xl group/card hover:border-blue-500/30 transition-all relative">
                                                                <div className="flex justify-between items-start mb-6">
                                                                    <div className="flex flex-col">
                                                                        <h5 className="text-sm font-black text-foreground uppercase">{group.productName}</h5>
                                                                    </div>
                                                                    <div className="flex gap-2 opacity-0 group-hover/card:opacity-100 transition-all">
                                                                        <button
                                                                            onClick={() => handleEditMapping(group.productId, group.campaigns)}
                                                                            className="p-3 bg-blue-500/10 text-blue-400 rounded-xl hover:bg-blue-500 hover:text-white transition-all shadow-lg"
                                                                        >
                                                                            <Pencil className="w-4 h-4" />
                                                                        </button>
                                                                        <button
                                                                            onClick={() => {
                                                                                if (confirm('¿Eliminar todas las vinculaciones de este producto?')) {
                                                                                    group.campaigns.forEach((c: any) => handleDeleteMapping(c.campaignName, c.platform));
                                                                                }
                                                                            }}
                                                                            className="p-3 bg-rose-500/10 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-lg"
                                                                        >
                                                                            <Trash2 className="w-4 h-4" />
                                                                        </button>
                                                                    </div>
                                                                </div>
                                                                <div className="space-y-4">
                                                                    <div className="flex flex-wrap gap-2">
                                                                        {group.campaigns.map((c: any, cIdx: number) => (
                                                                            <div key={cIdx} className="px-4 py-2 bg-card border border-card-border rounded-xl flex items-center gap-3 hover:border-white/10 transition-all">
                                                                                <span className={`text-[8px] font-black uppercase tracking-tighter ${c.platform === 'facebook' ? 'text-blue-400' : 'text-teal-400'}`}>
                                                                                    {c.platform}
                                                                                </span>
                                                                                <span className="text-[10px] font-bold text-muted uppercase truncate max-w-[150px]">
                                                                                    {c.campaignName}
                                                                                </span>
                                                                                <button
                                                                                    onClick={() => handleDeleteMapping(c.campaignName, c.platform)}
                                                                                    className="text-muted hover:text-rose-500 transition-all"
                                                                                >
                                                                                    <X className="w-3.5 h-3.5" />
                                                                                </button>
                                                                            </div>
                                                                        ))}
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        ))}
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        </div>

                        {/* Right Sidebar */}
                        <div className="lg:col-span-4 space-y-8">
                            {/* Pending Campaigns */}
                            <div className="bg-orange-900/10 border border-orange-500/20 p-8 rounded-2xl">
                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-6 flex items-center justify-between">
                                    Campañas Pendientes
                                    <History className="w-4 h-4 text-orange-500/50" />
                                </h3>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {unmappedCampaigns.length === 0 ? (
                                        <div className="text-center py-8">
                                            <CheckCircle2 className="w-6 h-6 text-emerald-500 mx-auto mb-2" />
                                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">Sin campañas pendientes</p>
                                        </div>
                                    ) : unmappedCampaigns.map(c => (
                                        <div key={`${c.name}_${c.platform}_${c.country}`} onClick={() => { setNewMapping({ campaignNames: [c.name], platform: c.platform as any, productId: '' }); setMappingMode('manual'); }} className="p-5 bg-card border border-card-border rounded-2xl cursor-pointer hover:border-orange-500/50 transition-all flex justify-between items-center group">
                                            <div className="flex flex-col">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span className="text-[9px] font-black text-muted uppercase">{c.platform}</span>
                                                    {c.country && <span className="text-[9px] font-black text-gray-700 bg-hover-bg px-1.5 rounded">{c.country}</span>}
                                                </div>
                                                <span className="text-[10px] font-bold text-muted truncate w-32 uppercase">{c.name}</span>
                                            </div>
                                            <ArrowRight className="w-4 h-4 text-orange-500 group-hover:translate-x-1 transition-transform" />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Import History */}
                            <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm">
                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-6 flex items-center justify-between">
                                    Importaciones Recientes
                                    <Upload className="w-4 h-4 text-teal-500/50" />
                                </h3>
                                <div className="space-y-4 max-h-[300px] overflow-y-auto pr-2 custom-scrollbar">
                                    {importHistory.length === 0 ? (
                                        <div className="text-center py-8">
                                            <p className="text-[10px] font-bold text-muted uppercase tracking-widest">No hay importaciones</p>
                                        </div>
                                    ) : (
                                        importHistory.map(log => (
                                            <div key={log.id} className="p-4 bg-card border border-card-border rounded-2xl flex items-center gap-4 group">
                                                <div className="w-10 h-10 rounded-xl bg-teal-500/10 flex items-center justify-center shrink-0">
                                                    <Upload className="w-4 h-4 text-teal-400" />
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <p className="text-[10px] font-bold text-foreground/80 truncate uppercase">{log.fileName}</p>
                                                    <p className="text-[9px] text-muted uppercase tracking-tighter">
                                                        {log.rowCount} filas · {
                                                            (log.uploaded_at as any)?.toDate
                                                                ? (log.uploaded_at as any).toDate().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
                                                                : new Date(log.uploaded_at as any).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
                                                        }
                                                    </p>
                                                </div>
                                                <button
                                                    onClick={() => handleDeleteImport(log.id)}
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center text-muted hover:text-rose-500 hover:bg-rose-500/10 transition-all opacity-0 group-hover:opacity-100"
                                                    title="Eliminar importación"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>

                            {/* Unmapped Products */}
                            <div className="bg-card border border-card-border p-6 rounded-2xl shadow-sm">
                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-6">Productos Sin Mapeo</h3>
                                <div className="space-y-4 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
                                    {unmappedProducts.length === 0 ? (
                                        <div className="text-center py-8">
                                            <CheckCircle2 className="w-8 h-8 text-emerald-500 mx-auto mb-3" />
                                            <span className="text-[10px] font-bold text-muted uppercase tracking-widest">Todos los productos mapeados</span>
                                        </div>
                                    ) : (
                                        unmappedProducts.map(p => (
                                            <div key={p.id} onClick={() => { setNewMapping({ ...newMapping, productId: p.id }); setMappingMode('manual'); }} className="p-5 bg-card border border-card-border rounded-2xl cursor-pointer hover:border-gray-500 transition-all flex justify-between items-center group">
                                                <div className="flex flex-col">
                                                    <span className="text-[9px] font-black text-muted mb-1 uppercase">{p.country || 'Sin País'}</span>
                                                    <span className="text-[10px] font-bold text-muted uppercase truncate w-32">{p.label}</span>
                                                </div>
                                                <Plus className="w-4 h-4 text-muted group-hover:text-blue-500" />
                                            </div>
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {/* ── GRUPOS SECTION ────────────────────────────────────────────── */}
            {activeSection === 'grupos' && (
                <div className="space-y-10 animate-in fade-in duration-500">
                    {/* Grouping Advice */}
                    {groupingSuggestions.length > 0 && (
                        <div className="bg-purple-600/5 border border-purple-500/20 p-8 rounded-2xl relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Sparkles className="w-24 h-24 text-purple-500" />
                            </div>
                            <div className="relative z-10">
                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-2 flex items-center gap-3">
                                    Asistente de Organización
                                    <div className="px-2 py-0.5 bg-purple-500/20 text-purple-400 text-[8px] font-black rounded border border-purple-500/30">OFERTA</div>
                                </h3>
                                <p className="text-muted text-[11px] font-bold uppercase tracking-widest mb-8">He encontrado {groupingSuggestions.reduce((s, g) => s + g.suggestedProducts.length, 0)} productos que podrían pertenecer a tus grupos existentes.</p>

                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                                    {groupingSuggestions.map(s => (
                                        <div key={s.groupId} className="bg-card border border-card-border p-6 rounded-[2rem] hover:border-purple-500/40 transition-all">
                                            <h4 className="text-[10px] font-black text-purple-400 uppercase tracking-widest mb-4 flex items-center gap-2">
                                                Para el grupo: <span className="text-white">{s.groupName}</span>
                                            </h4>
                                            <div className="space-y-3">
                                                {s.suggestedProducts.map(p => (
                                                    <div key={p.id} className="flex items-center justify-between gap-3 p-3 bg-hover-bg rounded-xl border border-card-border group/p">
                                                        <div className="min-w-0">
                                                            <p className="text-[10px] font-bold text-foreground/80 truncate uppercase">{p.label}</p>
                                                            <p className="text-[8px] font-black text-muted uppercase">ID: {p.id}</p>
                                                        </div>
                                                        <button
                                                            onClick={async () => {
                                                                const current = productGroups.find(g => g.id === s.groupId);
                                                                if (current) {
                                                                    const updatedGroup = { ...current, productIds: [...current.productIds, p.id], updatedAt: Date.now() };
                                                                    await saveProductGroup(updatedGroup, effectiveUid || '');
                                                                    setProductGroups(prev => prev.map(g => g.id === s.groupId ? updatedGroup : g));
                                                                }
                                                            }}
                                                            className="px-3 py-1.5 bg-purple-600/20 hover:bg-purple-600 text-purple-400 hover:text-white text-[8px] font-black rounded-lg transition-all border border-purple-500/20"
                                                        >
                                                            Añadir
                                                        </button>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Group Management */}
                    <div className="bg-card border border-card-border p-10 rounded-2xl">
                        <div className="flex justify-between items-center mb-10">
                            <h3 className="text-2xl font-black uppercase italic tracking-tighter text-white">Gestión de Grupos</h3>
                            <button
                                onClick={() => setIsAddGroupModalOpen(true)}
                                className="bg-purple-600 hover:bg-purple-500 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-purple-600/20 flex items-center gap-2"
                            >
                                <PlusCircle className="w-4 h-4" />
                                Añadir Grupo
                            </button>
                        </div>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
                            {productGroups.map(g => (
                                <div key={g.id} className="bg-card border border-white/10 p-8 rounded-2xl group hover:border-purple-500/30 transition-all">
                                    <div className="flex justify-between items-center mb-6">
                                        <h4 className="text-sm font-black text-foreground uppercase">{g.name}</h4>
                                        <div className="flex gap-2">
                                            <button onClick={() => { setEditingGroupId(g.id); setNewGroupName(g.name); setNewGroupProducts(g.productIds); setIsAddGroupModalOpen(true); }} className="p-2 text-muted hover:text-blue-400 transition-colors"><Pencil className="w-4 h-4" /></button>
                                            <button onClick={() => handleDeleteGroup(g.id)} className="p-2 text-muted hover:text-red-500 transition-colors"><X className="w-4 h-4" /></button>
                                        </div>
                                    </div>
                                    <div className="flex flex-wrap gap-2">
                                        {g.productIds.map(pid => {
                                            const product = availableProducts.find(p => p.id === pid);
                                            const displayName = product ? product.label : pid;
                                            return (
                                                <span key={pid} className="px-3 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold rounded-xl border border-purple-500/20 uppercase">{displayName}</span>
                                            );
                                        })}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            )}

            {/* ── Add/Edit Group Modal ──────────────────────────────────────── */}
            {isAddGroupModalOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => { setIsAddGroupModalOpen(false); setEditingGroupId(null); setNewGroupName(''); setNewGroupProducts([]); }}></div>
                    <div className="bg-card border border-card-border w-full max-w-lg rounded-2xl relative z-10 p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-8">
                            {editingGroupId ? 'Editar Grupo de Productos' : 'Crear Grupo de Productos'}
                        </h3>
                        <form onSubmit={handleAddGroup} className="space-y-6">
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
                                <button type="button" onClick={() => { setIsAddGroupModalOpen(false); setEditingGroupId(null); setNewGroupName(''); setNewGroupProducts([]); }} className="flex-1 px-6 py-4 rounded-2xl bg-hover-bg hover:bg-white/10 text-white text-[11px] font-black uppercase tracking-widest transition-all">Cancelar</button>
                                <button type="submit" disabled={saving || newGroupProducts.length < 2 || !newGroupName} className="flex-1 px-6 py-4 rounded-2xl bg-purple-600 hover:bg-purple-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-[11px] font-black uppercase tracking-widest transition-all shadow-lg shadow-purple-600/20">
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : (editingGroupId ? 'Actualizar Grupo' : 'Crear Grupo')}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}

            {/* ── Edit Mapping Modal ───────────────────────────────────────── */}
            {isEditModalOpen && editingMapping && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsEditModalOpen(false)}></div>
                    <div className="bg-card border border-card-border w-full max-w-lg rounded-2xl relative z-10 p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                        <div className="flex justify-between items-start mb-8">
                            <div className="flex flex-col">
                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Editar Vinculación</h3>
                                <p className="text-[10px] font-bold text-muted uppercase tracking-widest mt-1">Se moverán {editingMapping.campaigns.length} campañas</p>
                            </div>
                            <button onClick={() => setIsEditModalOpen(false)} className="p-2 text-muted hover:text-white"><X className="w-6 h-6" /></button>
                        </div>

                        <div className="space-y-8">
                            <div className="p-6 bg-card border border-card-border rounded-2xl space-y-4">
                                <span className="text-[9px] font-black text-muted uppercase tracking-widest">Campañas Actuales</span>
                                <div className="flex flex-wrap gap-2">
                                    {editingMapping.campaigns.map((c: any) => (
                                        <div key={`${c.campaignName}_${c.platform}`} className="px-3 py-2 bg-hover-bg text-muted text-[9px] font-bold rounded-lg border border-white/10 flex items-center gap-3 group/item">
                                            <div className="flex flex-col">
                                                <span className="text-[10px]">{c.campaignName}</span>
                                                <span className={`text-[7px] font-black uppercase ${c.platform === 'facebook' ? 'text-blue-500' : 'text-teal-500'}`}>{c.platform}</span>
                                            </div>
                                            <button
                                                onClick={() => {
                                                    if (confirm(`¿Eliminar vinculación de ${c.campaignName}?`)) {
                                                        handleDeleteMapping(c.campaignName, c.platform);
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
                                    onClick={() => setIsEditModalOpen(false)}
                                    className="flex-1 px-8 py-5 rounded-2xl font-black text-muted uppercase tracking-widest text-[11px] hover:bg-hover-bg transition-all"
                                >
                                    Cancelar
                                </button>
                                <button
                                    disabled={saving}
                                    onClick={handleUpdateMappingProduct}
                                    className="flex-[2] bg-blue-600 hover:bg-blue-500 py-5 rounded-2xl font-black text-foreground uppercase tracking-[0.2em] text-[11px] transition-all shadow-xl shadow-blue-600/20"
                                >
                                    {saving ? <Loader2 className="w-5 h-5 animate-spin mx-auto" /> : 'Actualizar Vinculación'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
