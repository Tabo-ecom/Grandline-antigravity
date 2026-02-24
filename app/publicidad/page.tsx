"use client";

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
    PlusCircle,
    Download,
    History,
    Search,
    RefreshCw,
    X,
    Filter,
    Plus,
    Target,
    Globe,
    CheckCircle2,
    AlertCircle,
    ChevronDown,
    Loader2,
    Sparkles,
    Zap,
    Trash2,
    Pencil,
    ArrowRight,
    Upload,
    MousePointer2,
    DollarSign,
    Check
} from 'lucide-react';
import {
    getAdSpendHistory,
    getCampaignMappings,
    addCampaignMapping,
    addMultipleCampaignMappings,
    deleteCampaignMapping,
    saveManualAdSpend,
    getAdSpendMetrics,
    updateCampaignMapping,
    saveAdSettings,
    generateMappingSuggestions,
    getProductGroups,
    saveProductGroup,
    deleteProductGroup,
    getEffectiveProductId,
    type CampaignMapping,
    type AdSpendHistory,
    type AdSettings,
    type ProductGroup,
    type AdSpendImportLog,
    type AISuggestion,
    getAdSettings,
    saveAdSpend,
    getAdSpendImportHistory,
    deleteAdSpendImport,
    getAISuggestions,
    updateAISuggestionStatus,
    deleteAISuggestion,
    clearAllAISuggestions
} from '@/lib/services/marketing';
import { fetchMetaAdSpend, fetchMetaAdCreatives, fetchMetaAdThumbnails, MetaTokenExpiredError } from '@/lib/services/meta';
import { fetchTikTokAdCreatives, fetchTikTokAdThumbnails } from '@/lib/services/tiktok';
import { useAuth } from '@/lib/context/AuthContext';
import { resolveProductName } from '@/lib/services/productResolution';
import { useCurrency } from '@/lib/hooks/useCurrency';
import {
    isMatchingCountry,
    getOfficialCountryName,
    getCurrencyForCountry,
    toCOP,
    fromCOP,
    formatCurrency
} from '@/lib/utils/currency';
import { ALL_COUNTRIES_MASTER } from '@/lib/utils/status';
import { getLocalDateKey } from '@/lib/utils/date-parsers';
import { getAllOrderFiles } from '@/lib/firebase/firestore';
import { calculateKPIs, type KPIResults } from '@/lib/calculations/kpis';
import { useDashboardData } from '@/lib/hooks/useDashboardData';
import { useGlobalFilters } from '@/lib/context/FilterContext';
import { GlobalSummary } from '@/components/publicidad/GlobalSummary';
import { CampaignAnalysis } from '@/components/publicidad/CampaignAnalysis';
import { ProductSpend } from '@/components/publicidad/ProductSpend';
import { CountryAnalysis } from '@/components/publicidad/CountryAnalysis';
import { TimeTrends } from '@/components/publicidad/TimeTrends';
import { CreativesGallery } from '@/components/publicidad/CreativesGallery';
import { collection, query, where, getDocs, getDoc, orderBy, Timestamp, doc, setDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase/config';
import FilterHeader from '@/components/FilterHeader';

// Session cache to prevent re-fetching on tab switch
const adCenterSessionCache = {
    history: null as AdSpendHistory[] | null,
    mappings: null as CampaignMapping[] | null,
    orders: null as any[] | null,
    timestamp: 0
};

export default function AdvertisingPage() {
    const { user, effectiveUid } = useAuth();
    const { rates } = useCurrency();
    const [activeTab, setActiveTab] = useState('dashboard');

    // Use Dashboard's KPI pipeline as single source of truth
    const dashboardData = useDashboardData();
    const {
        selectedCountry, setSelectedCountry,
        selectedProduct, setSelectedProduct,
        dateRange, setDateRange,
        startDateCustom, setStartDateCustom,
        endDateCustom, setEndDateCustom
    } = useGlobalFilters();

    // Re-calculate local startDate/endDate based on global filters to maintain compatibility
    const { startDate, endDate } = useMemo(() => {
        const today = new Date();
        const end = today.toISOString().split('T')[0];
        let start = end;

        if (dateRange === 'Personalizado' && startDateCustom && endDateCustom) {
            return { startDate: startDateCustom, endDate: endDateCustom };
        }

        switch (dateRange) {
            case 'Hoy':
                start = end;
                break;
            case 'Ayer':
                const yesterday = new Date();
                yesterday.setDate(yesterday.getDate() - 1);
                start = yesterday.toISOString().split('T')[0];
                return { startDate: start, endDate: start };
            case 'Últimos 7 Días':
                const last7 = new Date();
                last7.setDate(last7.getDate() - 7);
                start = last7.toISOString().split('T')[0];
                break;
            case 'Últimos 30 Días':
                const last30 = new Date();
                last30.setDate(last30.getDate() - 30);
                start = last30.toISOString().split('T')[0];
                break;
            case 'Este Mes':
                start = new Date(today.getFullYear(), today.getMonth(), 1).toISOString().split('T')[0];
                break;
            case 'Mes Pasado':
                const firstDayLastMonth = new Date(today.getFullYear(), today.getMonth() - 1, 1);
                const lastDayLastMonth = new Date(today.getFullYear(), today.getMonth(), 0);
                return {
                    startDate: firstDayLastMonth.toISOString().split('T')[0],
                    endDate: lastDayLastMonth.toISOString().split('T')[0]
                };
            case 'Todos':
                start = '2020-01-01'; // Default far back
                break;
            default:
                const d = new Date();
                d.setDate(d.getDate() - 30);
                start = d.toISOString().split('T')[0];
        }

        return { startDate: start, endDate: end };
    }, [dateRange, startDateCustom, endDateCustom]);

    // Data State
    const [history, setHistory] = useState<AdSpendHistory[]>([]);
    const [mappings, setMappings] = useState<CampaignMapping[]>([]);
    const [orders, setOrders] = useState<any[]>([]);
    const [rawOrders, setRawOrders] = useState<any[]>([]);
    const [adSettings, setAdSettings] = useState<AdSettings | null>(null);
    const [productGroups, setProductGroups] = useState<ProductGroup[]>([]);
    const [importHistory, setImportHistory] = useState<AdSpendImportLog[]>([]);

    // UI States
    const [isInitialLoading, setIsInitialLoading] = useState(true);
    const [syncingAPI, setSyncingAPI] = useState(false);
    const [syncStatus, setSyncStatus] = useState<string>('');
    const [isManualModalOpen, setIsManualModalOpen] = useState(false);
    const [isProductDropdownOpen, setIsProductDropdownOpen] = useState(false);
    const [isCampaignDropdownOpen, setIsCampaignDropdownOpen] = useState(false);
    const [mappingMode, setMappingMode] = useState<'manual' | 'ai'>('manual');
    const [importingCSV, setImportingCSV] = useState(false);
    const [isClearing, setIsClearing] = useState(false);
    const [aiMappingInProgress, setAiMappingInProgress] = useState(false);
    const [aiSuggestions, setAiSuggestions] = useState<any[]>([]);
    const [isEditModalOpen, setIsEditModalOpen] = useState(false);
    const [editingMapping, setEditingMapping] = useState<{ productId: string, campaigns: CampaignMapping[] } | null>(null);
    const [editNewProductId, setEditNewProductId] = useState('');
    const [expandedCountries, setExpandedCountries] = useState<Record<string, boolean>>({});
    const [campaignSearchTerm, setCampaignSearchTerm] = useState('');
    const [productSearchTerm, setProductSearchTerm] = useState('');
    const [isAddGroupModalOpen, setIsAddGroupModalOpen] = useState(false);
    const [editingGroupId, setEditingGroupId] = useState<string | null>(null);
    const [newGroupName, setNewGroupName] = useState('');
    const [newGroupProducts, setNewGroupProducts] = useState<string[]>([]);
    const [adCreatives, setAdCreatives] = useState<any[]>([]);

    // Ref for dropdowns
    const campaignDropdownRef = useRef<HTMLDivElement>(null);
    const productDropdownRef = useRef<HTMLDivElement>(null);
    const csvInputRef = useRef<HTMLInputElement>(null);

    // Form States
    const [newMapping, setNewMapping] = useState({
        campaignNames: [] as string[],
        productId: '',
        platform: 'facebook' as 'facebook' | 'tiktok'
    });
    const [platform, setPlatform] = useState<'facebook' | 'tiktok'>('facebook');
    const [amount, setAmount] = useState('');
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [productId, setProductId] = useState('global');
    const [saving, setSaving] = useState(false);
    const [success, setSuccess] = useState(false);

    // Initial Load
    useEffect(() => {
        async function loadData() {
            try {
                // Check cache first (valid for 5 mins)
                const now = Date.now();
                const isCacheValid = adCenterSessionCache.timestamp > 0 && (now - adCenterSessionCache.timestamp < 300000);

                const h = isCacheValid ? adCenterSessionCache.history! : await getAdSpendHistory(effectiveUid || '');
                const m = isCacheValid ? adCenterSessionCache.mappings! : await getCampaignMappings(effectiveUid || '');
                const s = await getAdSettings(effectiveUid || '');
                const g = await getProductGroups(effectiveUid || '');
                const ai = await getAISuggestions(effectiveUid || '');

                setHistory(h || []);
                setMappings(m || []);
                setAdSettings(s);
                setProductGroups(g || []);
                setAiSuggestions(ai || []);

                // Load cached ad creatives (direct read, skip legacy fallback)
                try {
                    const uid = effectiveUid || '';
                    if (uid) {
                        const creativesSnap = await getDoc(doc(db, 'app_data', `ad_creatives_${uid}`));
                        if (creativesSnap.exists()) {
                            const cached = creativesSnap.data()?.value;
                            if (cached?.data) setAdCreatives(cached.data);
                        }
                    }
                } catch (e) { /* ignore - doc may not exist yet */ }

                // Update cache
                if (!isCacheValid) {
                    adCenterSessionCache.history = h;
                    adCenterSessionCache.mappings = m;
                    adCenterSessionCache.timestamp = now;
                }
            } catch (error) {
                console.error('Error loading advertising history/mappings:', error);
            } finally {
                setIsInitialLoading(false);
            }
        }
        loadData();
    }, []);

    // Effect for orders - depends on filters
    useEffect(() => {
        refreshOrders();
    }, [user, startDate, endDate, selectedCountry, selectedProduct, rates]);

    // Effect for handling clicks outside dropdowns
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

    async function refreshOrders() {
        if (!user) return;
        try {
            // Permission fix: Use order_files instead of orders collection
            const files = await getAllOrderFiles(effectiveUid || '');
            const allOrders: any[] = [];
            const allUnfilteredOrders: any[] = [];

            files.forEach((file: any) => {
                if (file.orders && Array.isArray(file.orders)) {
                    const country = getOfficialCountryName(file.country || 'Desconocido');
                    const currency = getCurrencyForCountry(country);

                    file.orders.forEach((o: any) => {
                        const dateKey = getLocalDateKey(o.FECHA);
                        // In-memory filter for date, country and product
                        const matchesDate = (!startDate || dateKey >= startDate) && (!endDate || dateKey <= endDate);
                        const matchesCountry = !selectedCountry || selectedCountry === 'Todos' || isMatchingCountry(country, selectedCountry);

                        // Robust product matching: support both Name and ID (for cross-module sync parity)
                        const pid = o.PRODUCTO_ID?.toString();
                        const pname = o.PRODUCTO;
                        const matchesProduct = !selectedProduct || selectedProduct === 'Todos' ||
                            pid === selectedProduct || pname === selectedProduct;

                        if (matchesCountry && matchesProduct) {
                            // Normalize fields and Convert currency to COP for chart parity
                            const normalized: any = { ...o };
                            if (rates) {
                                normalized["TOTAL DE LA ORDEN"] = toCOP(o["TOTAL DE LA ORDEN"], currency, rates);
                                normalized["TOTAL_CON_DESCUENTO"] = normalized["TOTAL DE LA ORDEN"]; // Alias for simpler chart access
                                if (o["PRECIO PROVEEDOR"]) normalized["PRECIO PROVEEDOR"] = toCOP(o["PRECIO PROVEEDOR"], currency, rates);
                                if (o["PRECIO PROVEEDOR X CANTIDAD"]) normalized["PRECIO PROVEEDOR X CANTIDAD"] = toCOP(o["PRECIO PROVEEDOR X CANTIDAD"], currency, rates);
                                if (o["PRECIO FLETE"]) normalized["PRECIO FLETE"] = toCOP(o["PRECIO FLETE"], currency, rates);
                                if (o["COSTO DEVOLUCION FLETE"]) normalized["COSTO DEVOLUCION FLETE"] = toCOP(o["COSTO DEVOLUCION FLETE"], currency, rates);
                                if (o.GANANCIA) normalized.GANANCIA = toCOP(o.GANANCIA, currency, rates);
                            }

                            const orderObj = {
                                ...normalized,
                                PAIS: country,
                                FECHA: dateKey
                            };

                            allUnfilteredOrders.push(orderObj);

                            if (matchesDate) {
                                allOrders.push(orderObj);
                            }
                        }
                    });
                }
            });

            setOrders(allOrders);
            setRawOrders(allUnfilteredOrders);
            adCenterSessionCache.orders = allOrders;
        } catch (error) {
            console.error('Error refreshing orders:', error);
        }
    }

    // Handlers
    const handleAddMapping = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newMapping.productId || newMapping.campaignNames.length === 0) return;
        setSaving(true);
        try {
            await addMultipleCampaignMappings(newMapping.campaignNames.map(name => ({
                campaignName: name,
                productId: newMapping.productId,
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

    const handleDeleteMapping = async (campaignName: string, platform: 'facebook' | 'tiktok') => {
        if (confirm('¿Eliminar esta vinculación?')) {
            await deleteCampaignMapping(campaignName, platform, effectiveUid || '');
            setMappings(prev => prev.filter(m => !(m.campaignName === campaignName && m.platform === platform)));
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

    const handleSave = async (e: React.FormEvent) => {
        e.preventDefault();
        setSaving(true);
        try {
            await saveManualAdSpend({
                country: selectedCountry === 'Todos' ? 'Colombia' : selectedCountry,
                date,
                amount: parseFloat(amount),
                currency: 'USD',
                platform: platform as any,
                productId,
                userId: effectiveUid || ''
            });
            const h = await getAdSpendHistory(effectiveUid || '');
            setHistory(h);
            setIsManualModalOpen(false);
            setAmount('');
        } catch (error) {
            console.error('Error saving manual spend:', error);
        } finally {
            setSaving(false);
        }
    };

    const handleReloadCampaigns = async () => {
        setSyncingAPI(true);
        setSyncStatus('Conectando con Facebook...');
        const errors: string[] = [];
        let totalSaved = 0;

        try {
            // ── Facebook / Meta sync ──────────────────────────────────────────
            const fbToken = adSettings?.fb_token;
            const fbAccounts = adSettings?.fb_account_ids || [];

            if (fbToken && fbAccounts.length > 0) {
                for (const account of fbAccounts) {
                    try {
                        setSyncStatus(`Descargando datos de FB: ${account.name || account.id}...`);
                        const rows = await fetchMetaAdSpend(
                            fbToken,
                            account.id,
                            startDate,
                            endDate
                        );

                        if (rows.length > 0) {
                            setSyncStatus(`Guardando ${rows.length} registros de Facebook...`);
                            await Promise.all(rows.map(row => {
                                const spend = parseFloat(row.spend || 0);
                                if (spend <= 0) return Promise.resolve();

                                // ── Smart Country Detection (Same as TikTok) ───────────────────
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
                                    } else if (selectedCountry && selectedCountry !== 'Todos') {
                                        targetCountry = selectedCountry;
                                    }
                                } else if (selectedCountry && selectedCountry !== 'Todos') {
                                    targetCountry = selectedCountry;
                                }

                                if (targetCountry === 'Desconocido' || targetCountry === 'Todos') {
                                    const upperCam = cleanName.toUpperCase();
                                    if (upperCam.includes('COLOMBIA') || upperCam.includes('CO-')) targetCountry = 'Colombia';
                                    else if (upperCam.includes('ECUADOR') || upperCam.includes('EC-')) targetCountry = 'Ecuador';
                                    else if (upperCam.includes('GUATEMALA') || upperCam.includes('GT-')) targetCountry = 'Guatemala';
                                    else if (upperCam.includes('PANAMA') || upperCam.includes('PA-')) targetCountry = 'Panamá';
                                    else targetCountry = 'Desconocido';
                                }

                                return saveAdSpend(
                                    targetCountry,
                                    row.date_start,
                                    spend,
                                    adSettings?.fb_currency || 'USD',
                                    'facebook',
                                    'global',
                                    row.campaign_name,
                                    'admin',
                                    'api',
                                    'admin',
                                    {
                                        impressions: parseInt(row.impressions || 0),
                                        clicks: parseInt(row.clicks || 0),
                                        ctr: parseFloat(row.inline_link_click_ctr || 0),
                                        cpc: parseFloat(row.cpc || 0),
                                        conversions: row.purchases || 0,
                                        revenue_attributed: row.revenue || 0,
                                        page_visits: parseInt(row.page_visits || 0),
                                        add_to_cart: parseInt(row.add_to_cart || 0),
                                    }
                                );
                            }));
                            totalSaved += rows.filter(r => parseFloat(r.spend || 0) > 0).length;
                        }
                    } catch (accErr: any) {
                        const msg = accErr?.message || String(accErr);
                        console.error(`[Sync FB] Error en cuenta ${account.id}:`, accErr);
                        errors.push(`FB ${account.name || account.id}: ${msg}`);
                    }
                }
            } else if (!fbToken) {
                console.warn('[Sync] Sin token de Facebook configurado.');
            }

            // ── Fetch ad creatives + thumbnails ──────────────────────────────
            setSyncStatus('Descargando creativos...');
            const allCreatives: any[] = [];

            if (fbToken && fbAccounts.length > 0) {
                for (const account of fbAccounts) {
                    try {
                        const creatives = await fetchMetaAdCreatives(fbToken, account.id, startDate, endDate);
                        if (creatives.length > 0) {
                            const adIds = creatives.map((c: any) => c.id).filter(Boolean);
                            let thumbnails: Record<string, string> = {};
                            if (adIds.length > 0) {
                                try {
                                    thumbnails = await fetchMetaAdThumbnails(fbToken, adIds);
                                } catch (e) { console.warn('[Sync] Thumbnails FB error:', e); }
                            }
                            creatives.forEach((c: any) => {
                                if (thumbnails[c.id]) c.thumbnail = thumbnails[c.id];
                                allCreatives.push(c);
                            });
                        }
                    } catch (e) { console.warn('[Sync] Creatives FB error:', e); }
                }
            }

            // TikTok creatives (if token configured)
            const ttToken = adSettings?.tt_token;
            const ttAccounts = adSettings?.tt_account_ids || [];
            if (ttToken && ttAccounts.length > 0) {
                for (const account of ttAccounts) {
                    const advId = typeof account === 'string' ? account : account.id;
                    try {
                        const creatives = await fetchTikTokAdCreatives(ttToken, advId, startDate, endDate);
                        if (creatives.length > 0) {
                            const adIds = creatives.map((c: any) => c.id).filter(Boolean);
                            let thumbnails: Record<string, string> = {};
                            if (adIds.length > 0) {
                                try {
                                    thumbnails = await fetchTikTokAdThumbnails(ttToken, advId, adIds);
                                } catch (e) { console.warn('[Sync] Thumbnails TT error:', e); }
                            }
                            creatives.forEach((c: any) => {
                                if (thumbnails[c.id]) c.thumbnail = thumbnails[c.id];
                                allCreatives.push(c);
                            });
                        }
                    } catch (e) { console.warn('[Sync] Creatives TT error:', e); }
                }
            }

            if (allCreatives.length > 0) {
                setAdCreatives(allCreatives);
                try {
                    const uid = effectiveUid || '';
                    if (uid) {
                        await setDoc(doc(db, 'app_data', `ad_creatives_${uid}`), {
                            key: 'ad_creatives', value: { data: allCreatives, updatedAt: Date.now() }, userId: uid, updated_at: Timestamp.now()
                        });
                    }
                } catch (e) { console.warn('[Sync] Error caching creatives:', e); }
            }

            // ── Reload history from Firestore ─────────────────────────────────
            setSyncStatus('Actualizando historial...');
            const freshHistory = await getAdSpendHistory(effectiveUid || '');
            setHistory(freshHistory);
            adCenterSessionCache.timestamp = 0;

            // ── Result feedback ───────────────────────────────────────────────
            if (errors.length > 0) {
                alert(`⚠️ Sincronización completada con errores:\n${errors.join('\n')}\n\n${totalSaved} registros guardados.`);
            } else if (totalSaved > 0) {
                alert(`✅ Facebook sincronizado: ${totalSaved} registros actualizados.`);
            } else if (!fbToken || fbAccounts.length === 0) {
                alert('ℹ️ Historial recargado desde base de datos.\n\nPara sincronizar con Facebook, configura el token y las cuentas en Ajustes.');
            } else {
                alert('✅ Todo actualizado. No había datos nuevos para el período seleccionado.');
            }
        } catch (error: any) {
            console.error('Error en sincronización:', error);
            alert('❌ Error al sincronizar: ' + (error?.message || 'Error desconocido'));
        } finally {
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

                        // ── Step 1: Read ALL rows as raw arrays (no header assumption) ──
                        const rawRows: any[][] = XLSX.utils.sheet_to_json(firstSheet, { header: 1 });

                        if (rawRows.length === 0) {
                            alert('⚠️ El archivo está vacío o no se pudo leer.');
                            resolve();
                            return;
                        }

                        // ── Step 2: Find the real header row ──────────────────────────
                        const HEADER_KEYWORDS = [
                            'campaign', 'campaña', 'cost', 'coste', 'costo', 'gasto',
                            'spend', 'date', 'fecha', 'día', 'day', 'nombre'
                        ];

                        let headerRowIdx = -1;
                        for (let i = 0; i < rawRows.length; i++) {
                            const row = rawRows[i];
                            if (!Array.isArray(row)) continue;
                            const rowText = row.map(cell => String(cell ?? '').toLowerCase()).join(' ');
                            const matchCount = HEADER_KEYWORDS.filter(kw => rowText.includes(kw)).length;
                            if (matchCount >= 2) {
                                headerRowIdx = i;
                                break;
                            }
                        }

                        if (headerRowIdx === -1) {
                            headerRowIdx = 0;
                        }

                        const headers: string[] = (rawRows[headerRowIdx] || []).map(h => String(h ?? '').trim());
                        const dataRows = rawRows.slice(headerRowIdx + 1);

                        const findColIdx = (variants: string[]): number => {
                            for (const v of variants) {
                                const exact = headers.indexOf(v);
                                if (exact !== -1) return exact;
                            }
                            for (const v of variants) {
                                const idx = headers.findIndex(h => h.toLowerCase() === v.toLowerCase());
                                if (idx !== -1) return idx;
                            }
                            return -1;
                        };

                        const campaignIdx = findColIdx(['Campaign name', 'Campaña', 'Nombre de la campaña', 'campaign_name', 'Nombre campaña']);
                        const spendIdx = findColIdx(['Cost', 'Gasto', 'Spend', 'Coste', 'Costo', 'Importe gastado']);
                        const dateIdx = findColIdx(['Date', 'Fecha', 'Day', 'By Day', 'Reporting date', 'Fecha de inicio']);
                        const currencyIdx = findColIdx(['Currency', 'Divisa', 'Moneda']);

                        if (campaignIdx === -1 || spendIdx === -1 || dateIdx === -1) {
                            alert(`⚠️ No se encontraron las columnas necesarias.\n\nColumnas detectadas:\n${headers.join(', ')}`);
                            resolve();
                            return;
                        }

                        const parseNumber = (val: any): number => {
                            if (val === undefined || val === null || val === '') return 0;
                            if (typeof val === 'number') return val;
                            const str = String(val).trim().replace(/[^\d.,-]/g, '');
                            if (/^[-]?[\d.]+,[\d]+$/.test(str)) return parseFloat(str.replace(/\./g, '').replace(',', '.'));
                            if (/^[-]?[\d,]+\.[\d]+$/.test(str)) return parseFloat(str.replace(/,/g, ''));
                            return parseFloat(str.replace(/,/g, '')) || 0;
                        };

                        let importedCount = 0;
                        let skippedBlank = 0;
                        let skippedZeroSpend = 0;
                        let skippedBadData = 0;
                        let mappedCount = 0;

                        for (const row of dataRows) {
                            if (!Array.isArray(row) || row.every(c => c === undefined || c === null || c === '')) {
                                skippedBlank++;
                                continue;
                            }

                            const campaignName = row[campaignIdx];
                            const spendRaw = row[spendIdx];
                            const dateStr = row[dateIdx];

                            if (!campaignName || !dateStr) {
                                skippedBadData++;
                                continue;
                            }

                            if (String(campaignName).toLowerCase().includes('total')) {
                                skippedBlank++;
                                continue;
                            }

                            const spend = parseNumber(spendRaw);
                            if (spend <= 0) {
                                skippedZeroSpend++;
                                continue;
                            }

                            const rowCurrency = currencyIdx !== -1 ? String(row[currencyIdx] || 'USD').toUpperCase() : 'USD';

                            // ── Deterministic Target Country Logic ───────────────────
                            let rowTargetCountry = 'Desconocido';
                            const cleanName = String(campaignName).trim();

                            // 1. Check if campaign is already mapped
                            const existingMapping = mappings.find(m =>
                                m.campaignName.trim().toLowerCase() === cleanName.toLowerCase() &&
                                m.platform === 'tiktok'
                            );

                            if (existingMapping) {
                                // Find product country from inventory
                                const product = availableProducts.find(p => p.id === existingMapping.productId);
                                if (product?.country && product.country !== 'Todos') {
                                    rowTargetCountry = product.country;
                                    mappedCount++;
                                } else if (selectedCountry !== 'Todos') {
                                    rowTargetCountry = selectedCountry;
                                }
                            } else if (selectedCountry !== 'Todos') {
                                // 2. Fallback to active selection if not mapped
                                rowTargetCountry = selectedCountry;
                            } else {
                                // 3. Try to detect from campaign name (Global mode)
                                const upperCam = cleanName.toUpperCase();
                                if (upperCam.includes('COLOMBIA') || upperCam.includes('CO-')) rowTargetCountry = 'Colombia';
                                else if (upperCam.includes('ECUADOR') || upperCam.includes('EC-')) rowTargetCountry = 'Ecuador';
                                else if (upperCam.includes('GUATEMALA') || upperCam.includes('GT-')) rowTargetCountry = 'Guatemala';
                                else if (upperCam.includes('PANAMA') || upperCam.includes('PA-')) rowTargetCountry = 'Panama';
                                else if (upperCam.includes('EC-') || upperCam.includes('ECUADOR')) rowTargetCountry = 'Ecuador';
                            }

                            // ── Date parsing ────────────────────────────────────────────
                            let formattedDate: string;
                            const rawDate = String(dateStr).trim();
                            if (/^\d{4}-\d{2}-\d{2}/.test(rawDate)) {
                                formattedDate = rawDate.slice(0, 10);
                            } else if (/^\d{1,2}\/\d{1,2}\/\d{4}/.test(rawDate)) {
                                const parts = rawDate.split('/');
                                formattedDate = `${parts[2]}-${parts[1].padStart(2, '0')}-${parts[0].padStart(2, '0')}`;
                            } else if (typeof dateStr === 'number') {
                                const excelEpoch = new Date(1899, 11, 30);
                                const d = new Date(excelEpoch.getTime() + dateStr * 86400000);
                                formattedDate = d.toISOString().split('T')[0];
                            } else {
                                const parsed = new Date(rawDate);
                                if (isNaN(parsed.getTime())) {
                                    skippedBadData++;
                                    continue;
                                }
                                formattedDate = parsed.toISOString().split('T')[0];
                            }

                            await saveAdSpend(
                                rowTargetCountry,
                                formattedDate,
                                spend,
                                rowCurrency,
                                'tiktok',
                                'global',
                                cleanName,
                                'admin',
                                'api',
                                'admin',
                                {},
                                importId
                            );
                            importedCount++;
                        }

                        // Save import log
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
                        adCenterSessionCache.timestamp = 0;

                        const totalSkipped = skippedBlank + skippedZeroSpend + skippedBadData;
                        let msg = `✅ Se procesaron ${importedCount} registros de TikTok.`;
                        if (mappedCount > 0) msg += `\n(${mappedCount} asignados automáticamente por mapeos previos)`;

                        if (totalSkipped > 0) {
                            const details = [];
                            if (skippedZeroSpend > 0) details.push(`${skippedZeroSpend} con $0`);
                            if (skippedBlank > 0) details.push(`${skippedBlank} vacías/totales`);
                            msg += `\n\n${totalSkipped} filas omitidas: ${details.join(', ')}.`;
                        }
                        alert(msg);
                        resolve();
                    } catch (innerErr) {
                        reject(innerErr);
                    }
                };
                reader.readAsBinaryString(file);
            });
        } catch (error) {
            console.error('Error uploads:', error);
            alert('❌ Error: ' + (error instanceof Error ? error.message : 'Error desconocido'));
        } finally {
            setImportingCSV(false);
        }
    };

    const handleDeleteImport = async (importId: string) => {
        if (!confirm('¿Estás seguro de que deseas eliminar esta importación? Se borrarán todos los registros de gasto asociados.')) return;
        setIsInitialLoading(true);
        try {
            await deleteAdSpendImport(importId);
            const h = await getAdSpendHistory(effectiveUid || '');
            setHistory(h);
            const iHistory = await getAdSpendImportHistory(effectiveUid || '');
            setImportHistory(iHistory);
        } catch (error) {
            console.error('Error deleting import:', error);
        } finally {
            setIsInitialLoading(false);
        }
    };

    const handleGenerateSuggestions = async () => {
        if (unmappedCampaigns.length === 0) {
            alert('No hay campañas pendientes para analizar.');
            return;
        }

        setAiMappingInProgress(true);
        try {
            const uniqueProducts = new Map<string, { id: string, name: string, country: string }>();
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

    const handleAcceptSuggestion = async (suggestion: AISuggestion) => {
        try {
            await addCampaignMapping({
                campaignName: suggestion.campaignName,
                productId: suggestion.suggestedProductId,
                platform: suggestion.platform,
                updatedAt: Date.now()
            }, effectiveUid || '');

            // Local state update
            setAiSuggestions(prev => prev.filter(s => s.id !== suggestion.id));

            // Refresh mappings
            const freshMappings = await getCampaignMappings(effectiveUid || '');
            setMappings(freshMappings);

            // Re-invalidate cache
            adCenterSessionCache.timestamp = 0;

        } catch (error) {
            console.error('Error accepting suggestion:', error);
            alert('Error al aceptar la sugerencia');
        }
    };

    const handleRejectSuggestion = async (id: string) => {
        try {
            setAiSuggestions(prev => prev.filter(s => s.id !== id));
            await deleteAISuggestion(id, effectiveUid || '');
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

        // Sort alphabetically by product name to prevent jumping when items are removed
        return Object.values(groups).sort((a, b) => a.productName.localeCompare(b.productName));
    }, [aiSuggestions]);

    // Derived State
    const filteredHistory = useMemo(() => {
        return history.filter(h => {
            const dateIn = h.date >= startDate && h.date <= endDate;
            const countryIn = selectedCountry === 'Todos' || h.country === selectedCountry;

            // Product filter: only show spend for campaigns mapped to this product
            // If mapped to a group, filter by group.
            if (selectedProduct !== 'Todos') {
                const m = mappings.find(map => map.campaignName === h.campaignName && map.platform === h.platform);
                if (!m) return false;

                // Use effective ID to catch product groups
                const effectiveId = getEffectiveProductId(m.productId, productGroups);
                if (effectiveId !== selectedProduct && m.productId !== selectedProduct) return false;
            }

            return dateIn && countryIn;
        });
    }, [history, startDate, endDate, selectedCountry, selectedProduct, mappings, productGroups]);

    const availableProducts = useMemo(() => {
        const productMap = new Map<string, { id: string, label: string, country?: string }>(); // id -> data

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
    }, [orders, productGroups]);

    // Selectable products: Hides individual products that are within groups, and exposes the groups themselves
    const selectableProducts = useMemo(() => {
        const map = new Map<string, { id: string, label: string, country?: string }>();

        availableProducts.forEach(p => {
            if (p.id !== 'Todos') {
                map.set(p.id, p);
            }
        });

        // Remove individual products that belong to a group
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

            // If all constituent products share the same country, assign it to the group.
            if (countries.size === 1) {
                groupCountry = Array.from(countries)[0];
            } else if (countries.size > 1) {
                groupCountry = 'GL'; // Mixed countries or not found
            } else {
                groupCountry = 'GL'; // Fallback
            }

            // Add the group itself
            map.set(g.id, { id: g.id, label: `📦 [Grupo] ${g.name}`, country: groupCountry });
        });

        const list = Array.from(map.values());
        return [{ id: 'Todos', label: 'Todos', country: 'Todos' }, ...list.sort((a, b) => a.label.localeCompare(b.label))];
    }, [availableProducts, productGroups]);

    // Build available campaigns from ALL history (not just filtered) so newly-uploaded
    // campaigns outside the current date/country view are still visible for mapping.
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
        const countryGroups: Record<string, Record<string, { productId: string, productName: string, campaigns: CampaignMapping[] }>> = {};

        mappings.forEach(m => {
            const effectiveId = getEffectiveProductId(m.productId, productGroups);
            const product = selectableProducts.find(p => p.id === effectiveId) || availableProducts.find(p => p.id === m.productId);
            let country = product?.country || 'Desconocido';

            // Unify GT and Guatemala
            if (country.toUpperCase() === 'GT') {
                country = 'Guatemala';
            }

            // If it's a GLOBAL product or Desconocido, try to guess country from campaign name
            if (m.productId.toLowerCase().includes('global') || country === 'Desconocido' || country === 'Unknown') {
                const upperCam = m.campaignName.toUpperCase();
                if (upperCam.includes('COLOMBIA') || upperCam.includes('CO-')) country = 'Colombia';
                else if (upperCam.includes('ECUADOR') || upperCam.includes('EC-')) country = 'Ecuador';
                else if (upperCam.includes('GUATEMALA') || upperCam.includes('GT-')) country = 'Guatemala';
                else if (upperCam.includes('PANAMA') || upperCam.includes('PA-')) country = 'Panamá';
            }

            if (!countryGroups[country]) countryGroups[country] = {};
            if (!countryGroups[country][effectiveId]) {
                countryGroups[country][effectiveId] = {
                    productId: effectiveId,
                    productName: product ? product.label : resolveProductName(effectiveId, orders as any, mappings, productGroups),
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
    }, [mappings, availableProducts, selectableProducts, productGroups]);

    const unmappedProducts = useMemo(() => {
        return selectableProducts.filter(p => {
            if (p.id === 'Todos') return false;

            const normalizedId = p.id.trim().toLowerCase();

            // A product/group is mapped if any mapping's effectiveId matches it
            const isMapped = mappings.some(m => {
                const effectiveId = getEffectiveProductId(m.productId, productGroups).trim().toLowerCase();
                return effectiveId === normalizedId;
            });

            return !isMapped;
        });
    }, [selectableProducts, mappings, productGroups]);

    // Smart Grouping Analysis: Finds individual products that likely belong to a group
    const groupingSuggestions = useMemo(() => {
        if (productGroups.length === 0) return [];

        const suggestions: { groupId: string, groupName: string, suggestedProducts: { id: string, label: string }[] }[] = [];

        // Check each individual product against each group
        selectableProducts.forEach(p => {
            if (p.id === 'Todos') return;

            // Skip if it's already a group ID
            if (productGroups.some(g => g.id === p.id)) return;

            const label = p.label.toLowerCase();

            productGroups.forEach(g => {
                const gName = g.name.toLowerCase();

                // Heuristic: If label contains group name or vice versa (and they are not too short)
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

    // Use Dashboard's KPI pipeline as single source of truth for GlobalSummary
    // This ensures Publicidad and Dashboard show identical numbers
    const kpis = dashboardData.kpis;
    const prevKpis = dashboardData.prevKpis;

    // Unmapped spend is only used for the UI badge, computed from local ad history
    const unmappedSpend = useMemo(() => {
        if (!rates) return 0;
        let total = 0;
        filteredHistory.forEach(h => {
            const isMapped = mappings.some(m => m.campaignName === h.campaignName && m.platform === h.platform);
            if (!isMapped) {
                total += toCOP(h.amount, h.currency, rates);
            }
        });
        return total;
    }, [filteredHistory, mappings, rates]);

    // Use Dashboard's dailySalesData directly — single source of truth for chart
    const combinedChartData = useMemo(() => {
        return dashboardData.dailySalesData.map((d: any) => ({
            date: d.date,
            spend: d.ads || 0,
            revenue: d.sales_despachada || 0,
            roas: d.ads > 0 ? (d.sales_despachada || 0) / d.ads : 0,
            cpa: d.orders > 0 ? d.ads / d.orders : 0,
            projectedProfit: d.projected_profit || 0
        }));
    }, [dashboardData.dailySalesData]);

    // Use Dashboard's productPerformanceData for product spend chart
    const spendByProductChartData = useMemo(() => {
        return dashboardData.productPerformanceData
            .filter((p: any) => p.ads > 0)
            .map((p: any) => ({ name: p.name || p.label, value: p.ads }));
    }, [dashboardData.productPerformanceData]);

    // Use dashboardData.metricsByCountry for country-level spend
    const spendByCountry = useMemo(() => {
        const map: Record<string, number> = {};
        dashboardData.metricsByCountry.forEach((c: any) => {
            map[c.name] = c.adSpend || 0;
        });
        return map;
    }, [dashboardData.metricsByCountry]);

    // Use dashboardData for product breakdown — single source of truth
    const productBreakdown = useMemo(() => {
        const productMap: Record<string, any> = {};
        dashboardData.metricsByCountry.forEach((c: any) => {
            (c.products || []).forEach((p: any) => {
                const key = p.name || p.id;
                if (!productMap[key]) {
                    productMap[key] = {
                        productName: p.name,
                        spend: 0,
                        kpis: { n_ord: 0, n_ent: 0, n_nc: 0, fact_neto: 0, ing_real: 0, g_ads: 0, u_real: 0, roas: 0, roas_real: 0, cpa: 0, tasa_ent: 0, tasa_can: 0, fact_despachada: 0 }
                    };
                }
                productMap[key].spend += (p.adSpend || 0);
                productMap[key].kpis.n_ord += (p.orderCount || 0);
                productMap[key].kpis.fact_neto += (p.netSales || 0);
                productMap[key].kpis.g_ads += (p.adSpend || 0);
                productMap[key].kpis.u_real += (p.profit || 0);
                productMap[key].kpis.roas = productMap[key].kpis.g_ads > 0 ? productMap[key].kpis.fact_neto / productMap[key].kpis.g_ads : 0;
            });
        });
        return Object.values(productMap).sort((a: any, b: any) => b.spend - a.spend);
    }, [dashboardData.metricsByCountry]);

    const topCreatives = useMemo(() => {
        const targetCurrency = selectedCountry === 'Todos' ? 'COP' : getCurrencyForCountry(selectedCountry);

        // If we have ad-level creatives (from sync), use those
        if (adCreatives.length > 0) {
            const adsWithProducts = adCreatives.map(ad => {
                const mapping = mappings.find(m =>
                    m.campaignName.trim().toLowerCase() === (ad.campaign_name || '').trim().toLowerCase() &&
                    m.platform === ad.platform
                );
                const product = mapping ? availableProducts.find(p => p.id === mapping.productId) : null;
                return { ...ad, productName: product?.label || null, productId: mapping?.productId };
            }).filter(ad => ad.productName);

            const byProduct: Record<string, any> = {};
            adsWithProducts.forEach(ad => {
                const key = ad.productId;
                if (!byProduct[key] || ad.spend > byProduct[key].spend) {
                    byProduct[key] = ad;
                }
            });

            return Object.values(byProduct)
                .sort((a: any, b: any) => b.spend - a.spend)
                .slice(0, 5);
        }

        // Fallback: build from filteredHistory (campaign-level data)
        const campaignAgg: Record<string, any> = {};
        filteredHistory.forEach(h => {
            if (!h.campaignName || !rates) return;
            const key = `${h.campaignName}_${h.platform}`;
            if (!campaignAgg[key]) {
                campaignAgg[key] = {
                    name: h.campaignName, campaign_name: h.campaignName, platform: h.platform,
                    spend: 0, impressions: 0, clicks: 0, conversions: 0, revenue: 0, revenue_attributed: 0
                };
            }
            const amountInCOP = toCOP(h.amount, h.currency, rates);
            const amountInTarget = fromCOP(amountInCOP, targetCurrency, rates);
            campaignAgg[key].spend += amountInTarget;
            campaignAgg[key].impressions += (h.impressions || 0);
            campaignAgg[key].clicks += (h.clicks || 0);
            campaignAgg[key].conversions += (h.conversions || 0);
            campaignAgg[key].revenue_attributed += (h.revenue_attributed || 0);
        });

        // Associate with products and pick best per product
        const byProduct: Record<string, any> = {};
        Object.values(campaignAgg).forEach((ad: any) => {
            const mapping = mappings.find(m => m.campaignName === ad.name && m.platform === ad.platform);
            if (!mapping) return;
            const product = availableProducts.find(p => p.id === mapping.productId);
            if (!product) return;
            ad.productName = product.label;
            ad.productId = mapping.productId;
            ad.revenue = ad.revenue_attributed;

            if (!byProduct[mapping.productId] || ad.spend > byProduct[mapping.productId].spend) {
                byProduct[mapping.productId] = ad;
            }
        });

        return Object.values(byProduct)
            .sort((a: any, b: any) => b.spend - a.spend)
            .slice(0, 5);
    }, [adCreatives, filteredHistory, mappings, availableProducts, rates, selectedCountry]);

    if (isInitialLoading) {
        return (
            <div className="flex flex-col items-center justify-center py-20">
                <Loader2 className="w-10 h-10 text-orange-500 animate-spin mb-4" />
                <p className="text-muted font-mono text-xs uppercase tracking-widest animate-pulse">Cargando Ad Center...</p>
            </div>
        );
    }

    return (
        <div className="space-y-6 pb-20 max-w-[1600px] mx-auto px-4 sm:px-6">
            <FilterHeader
                availableCountries={['Todos', ...ALL_COUNTRIES_MASTER]}
                availableProducts={availableProducts}
                title="Central de Anuncios"
                icon={Target}
            >
                <button
                    onClick={() => setIsManualModalOpen(true)}
                    className="bg-accent hover:bg-accent/90 text-white px-5 py-2.5 rounded-xl font-bold text-[10px] uppercase tracking-widest transition-all shadow-lg shadow-accent/20 flex items-center gap-2"
                >
                    <PlusCircle className="w-4 h-4" />
                    Registrar Gasto
                </button>
            </FilterHeader>

            <div className="flex border-b border-card-border">
                {['dashboard', 'mapeo', 'grupos'].map(tab => (
                    <button
                        key={tab}
                        onClick={() => setActiveTab(tab)}
                        className={`px-8 py-4 text-[10px] font-black uppercase tracking-widest transition-all relative ${activeTab === tab ? tab === 'mapeo' ? 'text-blue-400' : tab === 'grupos' ? 'text-purple-400' : 'text-accent' : 'text-muted hover:text-foreground'}`}
                    >
                        {tab === 'mapeo' ? 'Mapeo de Campañas' : tab === 'grupos' ? 'Grupos de Productos' : 'Dashboard'}
                        {activeTab === tab && (
                            <div className={`absolute bottom-0 left-0 right-0 h-0.5 ${tab === 'mapeo' ? 'bg-blue-500' : tab === 'grupos' ? 'bg-purple-500' : 'bg-accent'}`}></div>
                        )}
                    </button>
                ))}
            </div>

            <div className="pt-6">
                {activeTab === 'dashboard' && (
                    <div className="space-y-8 animate-in fade-in duration-500">
                        <GlobalSummary
                            kpis={kpis as any}
                            prevKpis={prevKpis as any}
                        />

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                            <div className="lg:col-span-8">
                                <TimeTrends data={combinedChartData as any} />
                            </div>
                            <div className="lg:col-span-4">
                                <ProductSpend
                                    data={spendByProductChartData as any}
                                    tableData={productBreakdown as any}
                                />
                            </div>
                        </div>

                        <div className="space-y-6">
                            <CountryAnalysis
                                data={ALL_COUNTRIES_MASTER.map((c: string) => {
                                    const cOrders = dashboardData.filteredOrders.filter(o => o.country === c);
                                    return {
                                        countryName: c,
                                        kpis: calculateKPIs(cOrders as any, spendByCountry[c] || 0)
                                    };
                                })}
                            />

                            <CampaignAnalysis
                                rawHistory={history as any}
                                mappings={mappings}
                                rawOrders={rawOrders}
                                globalCountryFilter={selectedCountry}
                                customMetrics={adSettings?.custom_metrics}
                                startDate={startDate}
                                endDate={endDate}
                            />
                        </div>

                        {/* Top Creativos — coming soon */}
                        <div className="bg-card border border-card-border rounded-2xl p-6 shadow-sm">
                            <div className="flex items-center justify-between mb-2">
                                <h3 className="text-[11px] font-black text-muted uppercase tracking-widest">Top Creativos por Producto</h3>
                                <span className="px-3 py-1 rounded-lg bg-accent/10 text-accent text-[9px] font-black uppercase tracking-widest border border-accent/20">Próximamente</span>
                            </div>
                            <p className="text-xs text-muted">Visualización de los mejores anuncios con miniaturas y métricas detalladas. Disponible pronto.</p>
                        </div>
                    </div>
                )}

                {activeTab === 'mapeo' && (
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
                                <button onClick={handleClearAll} className="flex items-center gap-3 px-8 py-4 bg-red-600/10 border border-red-500/20 hover:bg-red-600/20 text-red-400 rounded-2xl transition-all text-[10px] font-black uppercase tracking-[0.2em]">
                                    {isClearing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />} Limpiar
                                </button>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 lg:grid-cols-12 gap-12">
                            <div className="lg:col-span-8 space-y-12">
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
                                                                <div key={`${c.name}_${c.platform}_${c.country}`} onClick={() => setNewMapping({ ...newMapping, campaignNames: newMapping.campaignNames.includes(c.name) ? newMapping.campaignNames.filter(n => n !== c.name) : [...newMapping.campaignNames, c.name], platform: c.platform })} className={`p-4 rounded-xl cursor-pointer transition-all ${newMapping.campaignNames.includes(c.name) ? 'bg-blue-600 text-white shadow-lg' : 'hover:bg-hover-bg text-muted'}`}>
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

                            <div className="lg:col-span-4 space-y-8">
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
                                                                log.uploaded_at?.toDate
                                                                    ? log.uploaded_at.toDate().toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
                                                                    : new Date(log.uploaded_at).toLocaleDateString('es-ES', { month: 'short', day: 'numeric' })
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

                {activeTab === 'grupos' && (
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
                                            {g.productIds.map(pid => (
                                                <span key={pid} className="px-3 py-1 bg-purple-500/10 text-purple-400 text-[10px] font-bold rounded-xl border border-purple-500/20 uppercase">{pid}</span>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                )}
            </div>

            {
                isAddGroupModalOpen && (
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
                )
            }

            {
                isManualModalOpen && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                        <div className="absolute inset-0 bg-black/80 backdrop-blur-md" onClick={() => setIsManualModalOpen(false)}></div>
                        <div className="bg-card border border-card-border w-full max-w-lg rounded-2xl relative z-10 p-10 shadow-2xl animate-in zoom-in-95 duration-200">
                            <h3 className="text-[11px] font-black text-muted uppercase tracking-widest mb-8">Registrar Gasto Manual</h3>
                            <form onSubmit={handleSave} className="space-y-6">
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
                        </div>
                    </div>
                )
            }

            {
                isEditModalOpen && editingMapping && (
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
                )
            }
        </div >
    );
}
