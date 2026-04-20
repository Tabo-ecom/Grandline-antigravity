"use client";

import React, { useState, useEffect } from 'react';
import {
    Zap,
    Target,
    DollarSign,
    Wand2,
    CheckCircle2,
    AlertCircle,
    Monitor,
    Cloud,
    Globe,
    Loader2,
    Rocket,
    Link,
    X,
    FileVideo,
    Sparkles,
    Dices,
    Layers,
    Split,
    Shuffle,
    Info,
    ChevronDown,
    Search,
    ArrowUpDown,
    GalleryHorizontalEnd,
} from 'lucide-react';
import { useSunny } from '@/lib/context/SunnyContext';
import { getAdSettings } from '@/lib/services/marketing';
import { generateCampaignName, NamingVariables, NAMING_TAGS, DEFAULT_NAMING_TEMPLATE } from '@/lib/services/sunny/naming';
import { generateCopy, type VegaAIResult } from '@/lib/services/sunny/vega-ai';
import { openDrivePicker } from '@/lib/services/sunny/google-drive';
import {
    createMetaFlexibleAd,
    createMetaCampaign,
    createMetaAdSet,
    createMetaAd,
    uploadMetaAdImage,
    uploadMetaAdVideo,
    uploadMetaAdImageFromUrl,
    uploadMetaAdVideoFromUrl,
    fetchMetaCampaigns,
    fetchMetaAdSets,
    type MetaCampaignConfig,
    type MetaAdSetConfig,
    type MetaAdConfig,
    type MetaLaunchResult,
    type FlexibleAdConfig,
    type UploadProgressCallback,
    resolveExclusionLocations,
    fetchMetaAdAccounts,
    createMetaMultiFormatAd,
    MetaTokenExpiredError
} from '@/lib/services/meta';
import {
    createTikTokCampaign,
    createTikTokAdGroup,
    createTikTokAd,
    uploadTikTokVideo,
    uploadTikTokImage,
    getTikTokLocationId,
    getTikTokAgeGroups,
    type TikTokLaunchResult,
} from '@/lib/services/tiktok';
import { useAuth } from '@/lib/context/AuthContext';
import { authFetch } from '@/lib/api/client';
import { PLAN_CAMPAIGN_LIMIT } from '@/lib/hooks/usePlanAccess';
import { countSunnyCampaignsThisMonth, saveSunnyCampaign } from '@/lib/firebase/firestore';

interface UploadedFile {
    id: string;
    name: string;
    preview: string;
    type: 'local' | 'gdrive';
    file?: File;
    mimeType?: string;
    ratio?: '4:5' | '9:16' | 'other'; // detected aspect ratio
    width?: number;
    height?: number;
}

interface FormatPair {
    feed?: UploadedFile;   // 4:5 for Feed
    story?: UploadedFile;  // 9:16 for Stories/Reels
}

type AdStructure = 'grouped' | 'isolated' | 'flexible';

// Collapsible section with toggle — defined OUTSIDE the component to avoid remounting on every render
const CollapsibleSection = ({ title, icon: Icon, children, className = '', defaultOpen = true }: {
    title: string;
    icon: React.ElementType;
    children: React.ReactNode;
    className?: string;
    defaultOpen?: boolean;
}) => {
    const [isOpen, setIsOpen] = React.useState(defaultOpen);
    return (
        <div className={`bg-card border border-card-border rounded-2xl ${className}`}>
            <button
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="w-full flex items-center justify-between p-6 cursor-pointer"
            >
                <div className="flex items-center gap-3">
                    <Icon className="w-5 h-5 text-accent" />
                    <h2 className="text-lg font-black italic uppercase tracking-tighter">{title}</h2>
                </div>
                <ChevronDown className={`w-5 h-5 text-muted transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`} />
            </button>
            {isOpen && <div className="px-6 pb-6">{children}</div>}
        </div>
    );
};

export const Lanzador: React.FC = () => {
    const { storeProfiles, selectedStoreId, setSelectedStoreId, activeStore, exclusionLists, namingTemplate, setNamingTemplate } = useSunny();
    const { effectiveUid, profile } = useAuth();
    const [adAccounts, setAdAccounts] = useState<any[]>([]);
    const [isLoadingAccounts, setIsLoadingAccounts] = useState(false);
    const [isGenerating, setIsGenerating] = useState(false);
    const [isLaunched, setIsLaunched] = useState(false);
    const [isLaunching, setIsLaunching] = useState(false);
    const [launchError, setLaunchError] = useState<string | null>(null);
    const [launchProgress, setLaunchProgress] = useState('');
    const [videoProgress, setVideoProgress] = useState<Map<string, number>>(new Map());
    const [launchResults, setLaunchResults] = useState<(MetaLaunchResult & { accountName: string })[]>([]);
    const [selectedExclusionId, setSelectedExclusionId] = useState<string | null>(null);
    const [metaToken, setMetaToken] = useState<string | null>(null);
    const [ttToken, setTtToken] = useState<string | null>(null);
    const [platform, setPlatform] = useState<'facebook' | 'tiktok' | 'both'>('facebook');
    const [campaignsUsed, setCampaignsUsed] = useState(0);

    const userPlan = profile?.plan || 'free';
    const campaignLimit = PLAN_CAMPAIGN_LIMIT[userPlan] ?? 0;
    const isAdmin = profile?.role === 'admin' && !profile?.plan;
    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Default schedule: 5:00 AM next day (local time)
    const getDefaultScheduleDate = () => {
        const d = new Date();
        d.setDate(d.getDate() + 1);
        d.setHours(5, 0, 0, 0);
        return d;
    };

    // Naming & Strategy
    const [naming, setNaming] = useState<NamingVariables>({
        country: activeStore?.country || 'Colombia',
        strategy: 'CBO',
        product: '',
        buyer: '',
        date: getDefaultScheduleDate()
    });

    const [budget, setBudget] = useState({
        amount: 30000,
        currency: 'COP'
    });

    const [adStructure, setAdStructure] = useState<AdStructure>('grouped');
    const [adsPerAdSet, setAdsPerAdSet] = useState<number>(0); // 0 = all in one ad set
    const [multiFormat, setMultiFormat] = useState(false);
    const [formatPairs, setFormatPairs] = useState<FormatPair[]>([]);

    const currencyConfig: Record<string, { min: number; max: number; step: number; presets: number[]; symbol: string }> = {
        COP: { min: 10000, max: 2000000, step: 5000, presets: [30000, 50000, 100000], symbol: '$' },
        USD: { min: 1, max: 500, step: 1, presets: [20, 50, 100], symbol: '$' },
        MXN: { min: 200, max: 50000, step: 100, presets: [500, 1000, 3000], symbol: '$' },
        PEN: { min: 20, max: 5000, step: 10, presets: [50, 100, 300], symbol: 'S/' },
        GTQ: { min: 50, max: 10000, step: 50, presets: [100, 300, 500], symbol: 'Q' },
    };

    const getCurrencyForCountry = (country: string): string => {
        const map: Record<string, string> = {
            'Colombia': 'COP', 'Ecuador': 'USD', 'Panamá': 'USD', 'Panama': 'USD',
            'Guatemala': 'GTQ', 'México': 'MXN', 'Mexico': 'MXN', 'Perú': 'PEN',
            'Chile': 'CLP', 'España': 'EUR',
        };
        return map[country] || 'USD';
    };

    const activeCurrencyConfig = currencyConfig[budget.currency] || currencyConfig['USD'];

    const [selectedAccountIds, setSelectedAccountIds] = useState<string[]>([]);
    const [demographics, setDemographics] = useState({ ageMin: 18, ageMax: 65, gender: 'all' as 'all' | 'male' | 'female' });
    const [copy, setCopy] = useState('');
    const [destinationUrl, setDestinationUrl] = useState('');
    const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
    const [aiCopies, setAiCopies] = useState<string[]>([]);
    const [aiTitle, setAiTitle] = useState('');
    const [aiDescription, setAiDescription] = useState('');
    const [selectedCopyIndices, setSelectedCopyIndices] = useState<number[]>([]);
    const [showNamingEditor, setShowNamingEditor] = useState(false);
    const [campaignMode, setCampaignMode] = useState<'new' | 'existing'>('new');
    const [campaignsByAccount, setCampaignsByAccount] = useState<Record<string, { id: string; name: string; status: string }[]>>({});
    const [adSetsByAccount, setAdSetsByAccount] = useState<Record<string, { id: string; name: string; status: string }[]>>({});
    const [selectedCampaignByAccount, setSelectedCampaignByAccount] = useState<Record<string, string>>({});
    const [selectedAdSetByAccount, setSelectedAdSetByAccount] = useState<Record<string, string>>({});
    const [isLoadingCampaigns, setIsLoadingCampaigns] = useState(false);
    const [campaignSearchByAccount, setCampaignSearchByAccount] = useState<Record<string, string>>({});
    const [vegaInstruction, setVegaInstruction] = useState('');

    useEffect(() => {
        if (effectiveUid) {
            countSunnyCampaignsThisMonth(effectiveUid).then(setCampaignsUsed).catch(console.error);
        }
    }, [effectiveUid]);

    // Reset selected accounts when platform changes
    useEffect(() => {
        setSelectedAccountIds([]);
        setCampaignMode('new');
        if (naming.strategy === 'ASC' && platform !== 'facebook') {
            setNaming(prev => ({ ...prev, strategy: 'CBO' }));
        }
    }, [platform]);

    useEffect(() => {
        if (activeStore) {
            setNaming(prev => ({ ...prev, country: activeStore.country }));
            const storeCurrency = activeStore.currency || getCurrencyForCountry(activeStore.country);
            const config = currencyConfig[storeCurrency] || currencyConfig['USD'];
            setBudget({ amount: config.presets[0], currency: storeCurrency });
            if (activeStore.defaultAccountId && selectedAccountIds.length === 0) {
                setSelectedAccountIds([activeStore.defaultAccountId]);
            }
        }
    }, [activeStore]);

    // Auto-build format pairs when multiFormat is on
    useEffect(() => {
        if (!multiFormat) { setFormatPairs([]); return; }
        const images = uploadedFiles.filter(f => !f.mimeType?.startsWith('video'));
        const feed = images.filter(f => f.ratio === '4:5');
        const story = images.filter(f => f.ratio === '9:16');
        const maxLen = Math.max(feed.length, story.length);
        const pairs: FormatPair[] = [];
        for (let i = 0; i < maxLen; i++) {
            pairs.push({ feed: feed[i] || undefined, story: story[i] || undefined });
        }
        setFormatPairs(pairs);
    }, [multiFormat, uploadedFiles]);

    // Map account ID → token for multi-connection support
    const [fbTokenMap, setFbTokenMap] = useState<Map<string, string>>(new Map());

    useEffect(() => {
        const loadAccounts = async () => {
            setIsLoadingAccounts(true);
            try {
                const settings = await getAdSettings(effectiveUid || '');
                if (settings) {
                    if (settings.fb_token) setMetaToken(settings.fb_token);
                    if (settings.tt_token) setTtToken(settings.tt_token);

                    const tokenMap = new Map<string, string>();
                    let allFb: any[] = [];

                    // Primary connection
                    if (settings.fb_token && settings.fb_account_ids?.length) {
                        const primary = settings.fb_account_ids.map((acc: any) => ({ ...acc, platform: 'facebook' }));
                        primary.forEach((acc: any) => tokenMap.set(acc.id, settings.fb_token));
                        allFb.push(...primary);
                    }

                    // Additional connections
                    if (settings.fb_connections?.length) {
                        for (const conn of settings.fb_connections) {
                            if (conn.token && conn.account_ids?.length) {
                                const connAccs = conn.account_ids.map((acc: any) => ({
                                    ...acc,
                                    platform: 'facebook',
                                    connectionLabel: conn.label,
                                }));
                                connAccs.forEach((acc: any) => tokenMap.set(acc.id, conn.token));
                                allFb.push(...connAccs);
                            }
                        }
                    }

                    setFbTokenMap(tokenMap);
                    const tt = (settings.tt_account_ids || []).map((acc: any) => ({ ...acc, platform: 'tiktok' }));
                    setAdAccounts([...allFb, ...tt]);
                }
            } catch (error) {
                console.error("Error loading global ad accounts:", error);
            } finally {
                setIsLoadingAccounts(false);
            }
        };
        loadAccounts();
    }, []);

    // Load existing campaigns when switching to existing mode (for all selected accounts)
    const loadExistingCampaigns = async () => {
        if (!metaToken || selectedAccountIds.length === 0) return;
        setIsLoadingCampaigns(true);
        try {
            const results: Record<string, { id: string; name: string; status: string }[]> = {};
            await Promise.all(selectedAccountIds.map(async (accId) => {
                const accountId = accId.startsWith('act_') ? accId : `act_${accId}`;
                try {
                    results[accId] = await fetchMetaCampaigns(metaToken!, accountId);
                } catch (e) {
                    console.error(`Error loading campaigns for ${accId}:`, e);
                    results[accId] = [];
                }
            }));
            setCampaignsByAccount(results);
        } finally {
            setIsLoadingCampaigns(false);
        }
    };

    const loadExistingAdSets = async (accountId: string, campaignId: string) => {
        if (!metaToken || !campaignId) return;
        try {
            const adSets = await fetchMetaAdSets(metaToken!, campaignId);
            setAdSetsByAccount(prev => ({ ...prev, [accountId]: adSets }));
        } catch (e) {
            console.error('Error loading ad sets:', e);
        }
    };

    useEffect(() => {
        if (campaignMode === 'existing') {
            loadExistingCampaigns();
        }
    }, [campaignMode, selectedAccountIds, metaToken]);

    const campaignName = generateCampaignName(naming, namingTemplate);

    const handleGenerateCopy = async () => {
        if (!naming.product) return;
        setIsGenerating(true);
        try {
            const result = await generateCopy({
                product: naming.product,
                target: naming.country,
                style: 'hype',
                destinationLink: destinationUrl,
                instruction: vegaInstruction || undefined,
                platform,
            });
            setAiTitle(result.title);
            setAiDescription(result.description);
            setAiCopies(result.copies);
            setSelectedCopyIndices([]);
        } catch (error) {
            console.error(error);
        } finally {
            setIsGenerating(false);
        }
    };

    const getCountryCode = (country: string): string => {
        const map: Record<string, string> = {
            'Colombia': 'CO', 'Ecuador': 'EC', 'Panamá': 'PA', 'Panama': 'PA',
            'Guatemala': 'GT', 'México': 'MX', 'Mexico': 'MX', 'Perú': 'PE',
            'Chile': 'CL', 'España': 'ES'
        };
        return map[country] || 'CO';
    };

    // Currencies where Meta expects the actual amount (no cents conversion)
    // Meta uses "offset 0" for these — meaning 30000 COP = send 30000, not 3000000
    const NO_CENTS_CURRENCIES = ['COP', 'CLP', 'KRW', 'JPY', 'IDR', 'TWD', 'VND', 'HUF', 'ISK'];

    const getBudgetForMeta = (amount: number, currency: string) => {
        if (NO_CENTS_CURRENCIES.includes(currency)) return amount;
        return Math.round(amount * 100); // USD, EUR, etc. need cents
    };

    const handleLaunch = async () => {
        setLaunchError(null);

        // Campaign limit check
        if (!isAdmin && campaignLimit < Infinity) {
            const currentCount = await countSunnyCampaignsThisMonth(effectiveUid || '');
            setCampaignsUsed(currentCount);
            if (currentCount >= campaignLimit) {
                setLaunchError(`Has alcanzado el límite de ${campaignLimit} campañas este mes. Actualiza a Yonko para campañas ilimitadas.`);
                return;
            }
        }

        const launchFb = platform === 'facebook' || platform === 'both';
        const launchTt = platform === 'tiktok' || platform === 'both';

        if (launchFb && !metaToken) {
            setLaunchError('No hay token de Meta configurado. Ve a Ajustes y conecta tu cuenta de Facebook.');
            return;
        }
        if (launchTt && !ttToken) {
            setLaunchError('No hay token de TikTok configurado. Ve a Ajustes y conecta tu cuenta de TikTok.');
            return;
        }

        const fbAccounts = selectedAccountIds
            .map(id => adAccounts.find(a => a.id === id && a.platform === 'facebook'))
            .filter(Boolean);

        const ttAccounts = selectedAccountIds
            .map(id => adAccounts.find(a => a.id === id && a.platform === 'tiktok'))
            .filter(Boolean);

        if (launchFb && fbAccounts.length === 0) {
            setLaunchError('Selecciona al menos una cuenta publicitaria de Facebook.');
            return;
        }
        if (launchTt && ttAccounts.length === 0) {
            setLaunchError('Selecciona al menos una cuenta publicitaria de TikTok.');
            return;
        }
        if (launchTt && copy.length > 100) {
            setLaunchError('El copy de TikTok no puede superar 100 caracteres.');
            return;
        }

        if (!naming.product.trim()) {
            setLaunchError('Ingresa el nombre del producto.');
            return;
        }

        if (!copy.trim() && !destinationUrl.trim()) {
            setLaunchError('Agrega un copy o un link de destino.');
            return;
        }

        if (destinationUrl.trim()) {
            try {
                new URL(destinationUrl.trim());
            } catch {
                setLaunchError('La URL de destino no es válida. Debe empezar con https://');
                return;
            }
        }

        if (!activeStore?.pageId) {
            setLaunchError('No hay Page ID configurado en el perfil de tienda. Configúralo en El Motor.');
            return;
        }

        if (campaignMode === 'existing') {
            const missingCampaign = fbAccounts.some(acc => !selectedCampaignByAccount[acc.id]);
            if (missingCampaign) {
                setLaunchError('Selecciona una campaña existente para cada cuenta o cambia a "Nueva Campaña".');
                return;
            }
        }

        setIsLaunching(true);
        setLaunchProgress('Preparando campaña...');

        try {
            let combinedResults: { campaignId: string; adSetId: string; adId: string; accountName: string }[] = [];

            // ─── TikTok Launch Flow ─────────────────────────
            if (launchTt) {
                const token = ttToken!;
                const allResults: (TikTokLaunchResult)[] = [];

                for (const acc of ttAccounts) {
                    const advertiserId = acc.advertiser_id || acc.id;

                    // Get BC ID for this advertiser (needed for identity)
                    let bcId: string | undefined;
                    try {
                        const bcRes = await authFetch(`/api/sunny/tiktok-advertiser-info?advertiser_id=${advertiserId}`);
                        if (bcRes.ok) {
                            const bcData = await bcRes.json();
                            bcId = bcData.bc_id || undefined;
                        }
                    } catch { /* ignore */ }

                    setLaunchProgress(`Subiendo creativos a ${acc.name || advertiserId}...`);

                    // Upload creatives
                    const videoFiles = uploadedFiles.filter(f => f.type === 'local' && f.file?.type.startsWith('video/'));
                    const imageFiles = uploadedFiles.filter(f => f.type === 'local' && f.file && !f.file.type.startsWith('video/'));

                    const ttVideoIds: string[] = [];
                    const ttImageIds: string[] = [];

                    for (const vf of videoFiles) {
                        if (vf.file) {
                            setLaunchProgress(`Subiendo video ${vf.name}...`);
                            const vid = await uploadTikTokVideo(token, advertiserId, vf.file);
                            ttVideoIds.push(vid);
                        }
                    }
                    for (const imgf of imageFiles) {
                        if (imgf.file) {
                            const imgId = await uploadTikTokImage(token, advertiserId, imgf.file);
                            ttImageIds.push(imgId);
                        }
                    }

                    // Create campaign
                    setLaunchProgress(`Creando campaña TikTok en ${acc.name || advertiserId}...`);
                    const isCBO = naming.strategy === 'CBO';
                    const ttBudget = budget.amount; // TikTok uses actual currency value

                    const campaignId = await createTikTokCampaign(token, {
                        advertiserId,
                        name: campaignName,
                        objectiveType: 'CONVERSIONS',
                        budgetMode: isCBO ? 'BUDGET_MODE_DAY' : 'BUDGET_MODE_INFINITE',
                        budget: isCBO ? ttBudget : undefined,
                        status: 'DISABLE',
                    });

                    // Create ad group
                    setLaunchProgress('Creando ad group...');
                    const scheduleTime = naming.date.toISOString().replace('T', ' ').slice(0, 19);
                    const locationId = getTikTokLocationId(naming.country);
                    const ageGroups = getTikTokAgeGroups(demographics.ageMin, demographics.ageMax);
                    const ttGender = demographics.gender === 'male' ? 'GENDER_MALE' : demographics.gender === 'female' ? 'GENDER_FEMALE' : 'GENDER_UNLIMITED';

                    const adGroupId = await createTikTokAdGroup(token, {
                        advertiserId,
                        campaignId,
                        name: `${campaignName} - AdGroup`,
                        budgetMode: 'BUDGET_MODE_DAY',
                        budget: ttBudget,
                        optimizationGoal: (activeStore?.ttPixelId && /^\d+$/.test(activeStore.ttPixelId)) ? 'CONVERT' : 'CLICK',
                        billingEvent: 'OCPM',
                        bidType: 'BID_TYPE_NO_BID',
                        scheduleStartTime: scheduleTime,
                        locationIds: [locationId],
                        ageGroups,
                        gender: ttGender,
                        pixelId: (activeStore?.ttPixelId && /^\d+$/.test(activeStore.ttPixelId)) ? activeStore.ttPixelId : undefined,
                        optimizationEvent: (activeStore?.ttPixelId && /^\d+$/.test(activeStore.ttPixelId)) ? 'ON_WEB_ORDER' : undefined,
                    });

                    // Create ads
                    setLaunchProgress('Creando anuncios...');
                    let lastAdId = '';
                    const allCreatives = [...ttVideoIds.map(id => ({ type: 'video' as const, id })), ...ttImageIds.map(id => ({ type: 'image' as const, id }))];

                    if (allCreatives.length === 0) {
                        throw new Error('Sube al menos un video o imagen para crear anuncios en TikTok.');
                    }

                    for (let i = 0; i < allCreatives.length; i++) {
                        const creative = allCreatives[i];
                        const adName = uploadedFiles[i]?.name.replace(/\.[^/.]+$/, '') || `Ad ${i + 1}`;

                        lastAdId = await createTikTokAd(token, {
                            advertiserId,
                            adGroupId,
                            name: adName,
                            adFormat: creative.type === 'video' ? 'SINGLE_VIDEO' : 'SINGLE_IMAGE',
                            videoId: creative.type === 'video' ? creative.id : undefined,
                            imageId: creative.type === 'image' ? creative.id : undefined,
                            adText: copy || naming.product,
                            callToAction: 'SHOP_NOW',
                            landingPageUrl: destinationUrl || 'https://example.com',
                            displayName: naming.product || 'Grand Line',
                            bcId,
                        });
                    }

                    allResults.push({ campaignId, adGroupId, adId: lastAdId, accountName: acc.name || advertiserId });
                }

                const ttLaunchResults = allResults.map(r => ({ campaignId: r.campaignId, adSetId: r.adGroupId, adId: r.adId, accountName: `[TT] ${r.accountName}` }));

                if (effectiveUid) {
                    for (const result of allResults) {
                        await saveSunnyCampaign({
                            campaignId: result.campaignId,
                            campaignName: campaignName,
                            accountId: result.accountName,
                            createdAt: new Date().toISOString(),
                        }, effectiveUid);
                    }
                    setCampaignsUsed(prev => prev + allResults.length);
                }

                // If TikTok only, finish here
                if (!launchFb) {
                    setLaunchResults(ttLaunchResults);
                    setLaunchProgress('');
                    setIsLaunched(true);
                    return;
                }

                // If both, continue to Facebook with accumulated results
                setLaunchProgress('Continuando con Facebook...');
                combinedResults = [...ttLaunchResults];
            }

            // ─── Facebook Launch Flow ───────────────────────
            if (!launchFb) { return; } // safety — shouldn't reach here
            const token = metaToken!;
            const countryCode = getCountryCode(naming.country);
            const metaBudget = getBudgetForMeta(budget.amount, budget.currency);
            const isASC = naming.strategy === 'ASC';

            // Resolve exclusion list locations to Meta location keys
            const selectedExclusion = selectedExclusionId ? exclusionLists.find(l => l.id === selectedExclusionId) : null;
            let excludedGeoLocations: { cities?: { key: string }[]; regions?: { key: string }[] } | undefined;
            if (selectedExclusion && token) {
                setLaunchProgress('Resolviendo ubicaciones de exclusión...');
                const locationNames = selectedExclusion.locations.split(',').map(l => l.trim()).filter(Boolean);
                const resolved = await resolveExclusionLocations(token, locationNames);
                if (resolved) {
                    excludedGeoLocations = {};
                    if (resolved.cities?.length) excludedGeoLocations.cities = resolved.cities;
                    if (resolved.regions?.length) excludedGeoLocations.regions = resolved.regions;
                    if (resolved.unresolvedNames?.length > 0) {
                        console.warn('[SUNNY] No se encontraron estas ubicaciones en Meta:', resolved.unresolvedNames);
                        setLaunchProgress(`⚠️ No se encontraron: ${resolved.unresolvedNames.join(', ')}. Continuando...`);
                        await new Promise(r => setTimeout(r, 2000));
                    }
                } else {
                    console.warn('[SUNNY] Ninguna ubicación de exclusión fue resuelta');
                    setLaunchProgress('⚠️ No se pudieron resolver las exclusiones. Continuando sin exclusiones...');
                    await new Promise(r => setTimeout(r, 2000));
                }
            }

            const genders = demographics.gender === 'male' ? [1] : demographics.gender === 'female' ? [2] : undefined;
            const allLaunchResults: (MetaLaunchResult & { accountName: string })[] = [];

            for (const acc of fbAccounts) {
                // Use the token mapped to this specific account (multi-connection support)
                const token = fbTokenMap.get(acc.id) || metaToken!;
                const accountId = acc.id.startsWith('act_') ? acc.id : `act_${acc.id}`;
                setLaunchProgress(`Subiendo creativos a ${acc.name}...`);

                // Upload all creatives — videos sequentially (chunked upload), images in parallel
                // Track file names alongside hashes/ids for ad naming
                const imageHashes: string[] = [];
                const imageNames: string[] = [];
                const videoIds: string[] = [];
                const videoThumbnails: string[] = [];
                const videoNames: string[] = [];

                // Separate images and videos
                const imageFiles = uploadedFiles.filter(f =>
                    (f.type === 'local' && f.file && !f.file.type.startsWith('video/')) ||
                    (f.type === 'gdrive' && !f.mimeType?.startsWith('video/'))
                );
                const videoFiles = uploadedFiles.filter(f =>
                    (f.type === 'local' && f.file?.type.startsWith('video/')) ||
                    (f.type === 'gdrive' && f.mimeType?.startsWith('video/'))
                );

                // Upload images in parallel (small, fast)
                const imagePromises = imageFiles.map(async (file) => {
                    let hash: string | null = null;
                    if (file.type === 'local' && file.file) {
                        hash = await uploadMetaAdImage(token, accountId, file.file);
                    } else if (file.type === 'gdrive') {
                        const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;
                        hash = await uploadMetaAdImageFromUrl(token, accountId, downloadUrl);
                    }
                    return hash ? { hash, name: file.name } : null;
                });

                const imageResults = await Promise.all(imagePromises);
                imageResults.forEach(r => { if (r) { imageHashes.push(r.hash); imageNames.push(r.name); } });

                // Upload videos in parallel (max 3 concurrent)
                const MAX_CONCURRENT_VIDEOS = 3;
                const videoResults: { videoId: string; thumbnailUrl: string; name: string }[] = [];
                let videoIdx = 0;

                const uploadNextVideo = async (): Promise<void> => {
                    while (videoIdx < videoFiles.length) {
                        const currentIdx = videoIdx++;
                        const file = videoFiles[currentIdx];
                        const fileProgress: UploadProgressCallback = (fileName, percent) => {
                            setVideoProgress(prev => new Map(prev).set(fileName, percent));
                        };

                        let result: { videoId: string; thumbnailUrl: string } | undefined;
                        if (file.type === 'local' && file.file) {
                            result = await uploadMetaAdVideo(token, accountId, file.file, fileProgress);
                        } else if (file.type === 'gdrive') {
                            const downloadUrl = `https://drive.google.com/uc?export=download&id=${file.id}`;
                            result = await uploadMetaAdVideoFromUrl(token, accountId, downloadUrl, file.name, fileProgress);
                        }
                        if (result) videoResults.push({ videoId: result.videoId, thumbnailUrl: result.thumbnailUrl, name: file.name });
                    }
                };

                if (videoFiles.length > 0) {
                    setLaunchProgress(`Subiendo ${videoFiles.length} video${videoFiles.length > 1 ? 's' : ''} (${Math.min(MAX_CONCURRENT_VIDEOS, videoFiles.length)} en paralelo)...`);
                    await Promise.all(
                        Array.from({ length: Math.min(MAX_CONCURRENT_VIDEOS, videoFiles.length) }, () => uploadNextVideo())
                    );
                    videoResults.forEach(r => { videoIds.push(r.videoId); videoThumbnails.push(r.thumbnailUrl || ''); videoNames.push(r.name); });
                    setVideoProgress(new Map());
                }

                let campaignId: string;
                let adSetId: string;

                // Base ad set config reusable for both modes and isolated structure
                const baseAdSetConfig = {
                    accountId,
                    status: 'ACTIVE' as const,
                    dailyBudget: naming.strategy === 'ABO' ? metaBudget : undefined,
                    billingEvent: 'IMPRESSIONS' as const,
                    optimizationGoal: (activeStore?.pixelId ? 'OFFSITE_CONVERSIONS' : 'LINK_CLICKS') as MetaAdSetConfig['optimizationGoal'],
                    targeting: isASC ? undefined : {
                        geoLocations: { countries: [countryCode] },
                        ageMin: demographics.ageMin,
                        ageMax: demographics.ageMax,
                        genders,
                        excludedGeoLocations,
                    },
                    promotedObject: activeStore?.pixelId ? {
                        pixelId: activeStore.pixelId,
                        customEventType: 'PURCHASE'
                    } : undefined,
                    startTime: naming.date.toISOString(),
                };

                if (campaignMode === 'existing' && selectedCampaignByAccount[acc.id]) {
                    campaignId = selectedCampaignByAccount[acc.id];
                    setLaunchProgress(`Usando campaña existente en ${acc.name}...`);

                    const accountAdSetId = selectedAdSetByAccount[acc.id];
                    if (accountAdSetId) {
                        adSetId = accountAdSetId;
                    } else {
                        setLaunchProgress(`Creando ad set en campaña existente...`);
                        adSetId = await createMetaAdSet(token, {
                            ...baseAdSetConfig,
                            campaignId,
                            name: `${campaignName} - AdSet`,
                        });
                    }
                } else {
                    setLaunchProgress(`Creando campaña en ${acc.name}...`);

                    const campaignConfig: MetaCampaignConfig = {
                        accountId,
                        name: campaignName,
                        objective: 'OUTCOME_SALES',
                        status: 'PAUSED',
                        specialAdCategories: [],
                        buyingType: 'AUCTION',
                        budgetOptStrategy: naming.strategy,
                        dailyBudget: (naming.strategy === 'CBO' || naming.strategy === 'ASC') ? metaBudget : undefined,
                    };

                    campaignId = await createMetaCampaign(token, campaignConfig);

                    adSetId = await createMetaAdSet(token, {
                        ...baseAdSetConfig,
                        campaignId,
                        name: `${campaignName} - AdSet`,
                    });
                }

                // Create ads
                setLaunchProgress('Creando anuncios...');

                // Helper: get creative file name (without extension) for ad naming
                const allCreativeNames = [...imageNames, ...videoNames];
                const getAdName = (index: number) => {
                    if (index < allCreativeNames.length) {
                        // Strip file extension
                        return allCreativeNames[index].replace(/\.[^/.]+$/, '');
                    }
                    return `Ad ${index + 1}`;
                };

                if (multiFormat && formatPairs.length > 0) {
                    // Multi-format: upload paired images and create ads with placement customization
                    const validPairs = formatPairs.filter(p => p.feed && p.story);
                    setLaunchProgress(`Subiendo ${validPairs.length * 2} imágenes multi-formato...`);

                    let lastAdId = '';
                    for (let i = 0; i < validPairs.length; i++) {
                        const pair = validPairs[i];

                        // Upload both images
                        let feedHash: string;
                        let storyHash: string;

                        if (pair.feed!.type === 'local' && pair.feed!.file) {
                            feedHash = await uploadMetaAdImage(token, accountId, pair.feed!.file);
                        } else {
                            const url = `https://drive.google.com/uc?export=download&id=${pair.feed!.id}`;
                            feedHash = await uploadMetaAdImageFromUrl(token, accountId, url);
                        }

                        if (pair.story!.type === 'local' && pair.story!.file) {
                            storyHash = await uploadMetaAdImage(token, accountId, pair.story!.file);
                        } else {
                            const url = `https://drive.google.com/uc?export=download&id=${pair.story!.id}`;
                            storyHash = await uploadMetaAdImageFromUrl(token, accountId, url);
                        }

                        const adName = pair.feed!.name.replace(/\.[^/.]+$/, '');
                        setLaunchProgress(`Creando ad multi-formato ${i + 1}/${validPairs.length}...`);

                        lastAdId = await createMetaMultiFormatAd(token, {
                            accountId,
                            adSetId,
                            name: adName,
                            status: 'ACTIVE',
                            pageId: activeStore.pageId,
                            link: destinationUrl || 'https://example.com',
                            feedImageHash: feedHash,
                            storyImageHash: storyHash,
                            message: copy || naming.product,
                            title: aiTitle || undefined,
                            description: aiDescription || undefined,
                            callToAction: 'SHOP_NOW',
                        });
                    }
                    allLaunchResults.push({ campaignId, adSetId, adId: lastAdId, accountName: acc.name });

                } else if (adStructure === 'flexible') {
                    const bodies = selectedCopyIndices.length > 0
                        ? selectedCopyIndices.map(i => aiCopies[i])
                        : [copy || naming.product];

                    const flexConfig: FlexibleAdConfig = {
                        accountId,
                        adSetId,
                        name: `${campaignName} - Flexible Ad`,
                        status: 'ACTIVE',
                        pageId: activeStore.pageId,
                        link: destinationUrl || 'https://example.com',
                        imageHashes: imageHashes.length > 0 ? imageHashes : undefined,
                        videoIds: videoIds.length > 0 ? videoIds : undefined,
                        bodies,
                        titles: aiTitle ? [aiTitle] : undefined,
                        descriptions: aiDescription ? [aiDescription] : undefined,
                        callToAction: 'SHOP_NOW',
                    };

                    const adId = await createMetaFlexibleAd(token, flexConfig);
                    allLaunchResults.push({ campaignId, adSetId, adId, accountName: acc.name });

                } else if (adStructure === 'isolated') {
                    let lastAdId = '';
                    for (let i = 0; i < Math.max(imageHashes.length + videoIds.length, 1); i++) {
                        const isoAdSetId = i === 0 ? adSetId :
                            await createMetaAdSet(token, {
                                ...baseAdSetConfig,
                                campaignId,
                                name: `${campaignName} - AdSet ${i + 1}`
                            });

                        const adConfig: MetaAdConfig = {
                            accountId,
                            adSetId: isoAdSetId,
                            name: getAdName(i),
                            status: 'ACTIVE',
                            creative: {
                                pageId: activeStore.pageId,
                                message: copy || naming.product,
                                title: aiTitle || undefined,
                                description: aiDescription || undefined,
                                link: destinationUrl || 'https://example.com',
                                imageHash: i < imageHashes.length ? imageHashes[i] : undefined,
                                videoId: i >= imageHashes.length ? videoIds[i - imageHashes.length] : undefined,
                                videoThumbnailUrl: i >= imageHashes.length ? videoThumbnails[i - imageHashes.length] : undefined,
                                callToAction: 'SHOP_NOW',
                            }
                        };

                        lastAdId = await createMetaAd(token, adConfig);
                    }
                    allLaunchResults.push({ campaignId, adSetId, adId: lastAdId || '', accountName: acc.name });

                } else {
                    // Grouped (default): ads distributed across ad sets
                    let lastAdId = '';
                    const totalCreatives = Math.max(imageHashes.length + videoIds.length, 1);

                    // Split creatives into chunks if adsPerAdSet is set
                    const chunkSize = adsPerAdSet > 0 ? adsPerAdSet : totalCreatives;
                    const numChunks = Math.ceil(totalCreatives / chunkSize);

                    for (let chunk = 0; chunk < numChunks; chunk++) {
                        // First chunk uses the already-created adSetId, subsequent chunks create new ad sets
                        const currentAdSetId = chunk === 0 ? adSetId : await createMetaAdSet(token, {
                            ...baseAdSetConfig,
                            campaignId,
                            name: `${campaignName} - AdSet ${chunk + 1}`,
                        });

                        const startIdx = chunk * chunkSize;
                        const endIdx = Math.min(startIdx + chunkSize, totalCreatives);

                        for (let i = startIdx; i < endIdx; i++) {
                            const isVideo = i >= imageHashes.length;
                            const adConfig: MetaAdConfig = {
                                accountId,
                                adSetId: currentAdSetId,
                                name: getAdName(i),
                                status: 'ACTIVE',
                                creative: {
                                    pageId: activeStore.pageId,
                                    message: copy || naming.product,
                                    title: aiTitle || undefined,
                                    description: aiDescription || undefined,
                                    link: destinationUrl || 'https://example.com',
                                    imageHash: !isVideo ? imageHashes[i] : undefined,
                                    videoId: isVideo ? videoIds[i - imageHashes.length] : undefined,
                                    videoThumbnailUrl: isVideo ? videoThumbnails[i - imageHashes.length] : undefined,
                                    callToAction: 'SHOP_NOW',
                                }
                            };
                            lastAdId = await createMetaAd(token, adConfig);
                        }

                        setLaunchProgress(`AdSet ${chunk + 1}/${numChunks} creado (${endIdx - startIdx} ads)...`);
                    }
                    allLaunchResults.push({ campaignId, adSetId, adId: lastAdId, accountName: acc.name });
                }
            }

            const fbResults = allLaunchResults.map(r => ({ ...r, accountName: launchTt ? `[FB] ${r.accountName}` : r.accountName }));
            setLaunchResults([...combinedResults, ...fbResults]);
            setLaunchProgress('');
            setIsLaunched(true);

            // Log campaigns to Firestore for limit tracking
            if (effectiveUid) {
                for (const result of allLaunchResults) {
                    await saveSunnyCampaign({
                        campaignId: result.campaignId,
                        campaignName: campaignName,
                        accountId: result.accountName,
                        createdAt: new Date().toISOString(),
                    }, effectiveUid);
                }
                setCampaignsUsed(prev => prev + allLaunchResults.length);
            }
        } catch (error: any) {
            console.error('Launch failed:', error);
            setLaunchError(error.message || 'Error desconocido al publicar la campaña.');
        } finally {
            setIsLaunching(false);
        }
    };

    const handleFileClick = () => fileInputRef.current?.click();

    // Detect image aspect ratio from dimensions
    // Feed = 4:5 (0.8) or 1:1 (1.0) — anything roughly square or slightly tall
    // Story = 9:16 (0.5625) — clearly tall/vertical
    const detectRatio = (w: number, h: number): '4:5' | '9:16' | 'other' => {
        const r = w / h;
        // 9:16 = 0.5625 — vertical formats (r < 0.7)
        if (r >= 0.35 && r < 0.7) return '9:16';
        // 4:5 = 0.8, 1:1 = 1.0 — feed formats (r >= 0.7 and <= 1.15)
        if (r >= 0.7 && r <= 1.15) return '4:5';
        return 'other';
    };

    const loadImageDimensions = (file: UploadedFile): Promise<UploadedFile> => {
        if (file.mimeType?.startsWith('video')) return Promise.resolve(file);
        return new Promise(resolve => {
            const img = new Image();
            img.onload = () => {
                resolve({ ...file, width: img.naturalWidth, height: img.naturalHeight, ratio: detectRatio(img.naturalWidth, img.naturalHeight) });
            };
            img.onerror = () => resolve(file);
            img.src = file.preview;
        });
    };

    const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        const newFiles: UploadedFile[] = files.map(file => ({
            id: `local-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            name: file.name,
            file,
            preview: URL.createObjectURL(file),
            type: 'local',
            mimeType: file.type
        }));

        // Detect dimensions for images
        const withDimensions = await Promise.all(newFiles.map(loadImageDimensions));
        setUploadedFiles(prev => [...prev, ...withDimensions]);
    };

    const handleGoogleDriveUpload = async () => {
        const files = await openDrivePicker(effectiveUid || '');
        if (files && files.length > 0) {
            const newFiles: UploadedFile[] = files.map(file => ({
                id: file.id,
                name: file.name,
                preview: file.thumbnailUrl,
                type: 'gdrive',
                mimeType: file.mimeType
            }));
            setUploadedFiles(prev => [...prev, ...newFiles]);
        }
    };

    const removeFile = (index: number) => {
        setUploadedFiles(prev => {
            const next = [...prev];
            if (next[index].type === 'local') URL.revokeObjectURL(next[index].preview);
            next.splice(index, 1);
            return next;
        });
    };

    const toggleCopySelect = (index: number) => {
        setSelectedCopyIndices(prev =>
            prev.includes(index) ? prev.filter(i => i !== index) : [...prev, index]
        );
    };

    const resetForm = () => {
        setNaming(prev => ({ ...prev, product: '', buyer: '', date: getDefaultScheduleDate() }));
        setCopy('');
        setDestinationUrl('');
        setUploadedFiles([]);
        setAiCopies([]);
        setAiTitle('');
        setAiDescription('');
        setSelectedCopyIndices([]);
        setVegaInstruction('');
        setCampaignMode('new');
        setSelectedCampaignByAccount({});
        setSelectedAdSetByAccount({});
        setCampaignsByAccount({});
        setAdSetsByAccount({});
        setCampaignSearchByAccount({});
        setSelectedExclusionId(null);
        setLaunchError(null);
        setAdsPerAdSet(0);
        setMultiFormat(false);
        setFormatPairs([]);
    };

    if (isLaunched) {
        return (
            <div className="h-[600px] flex items-center justify-center p-8 text-center animate-in zoom-in-95 duration-500">
                <div className="space-y-6 max-w-md">
                    <div className="mx-auto w-24 h-24 bg-accent/10 rounded-full border border-accent/30 flex items-center justify-center text-accent">
                        <Rocket className="w-12 h-12 animate-bounce" />
                    </div>
                    <h2 className="text-4xl font-black italic uppercase tracking-tighter text-foreground">¡MISIÓN LANZADA!</h2>
                    <p className="text-muted text-sm font-bold uppercase tracking-widest leading-relaxed">
                        Tu campaña <span className="text-accent">{naming.product}</span> fue creada exitosamente en {platform === 'tiktok' ? 'TikTok Ads' : platform === 'both' ? 'Facebook + TikTok Ads' : 'Meta Ads'}.
                    </p>
                    <div className="p-4 bg-card border border-card-border rounded-2xl font-mono text-xs text-muted">
                        {campaignName}
                    </div>
                    {launchResults.length > 0 && (
                        <div className="space-y-3">
                            {launchResults.map((result, i) => (
                                <div key={i} className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-2xl text-left space-y-1">
                                    {launchResults.length > 1 && (
                                        <p className="text-[10px] font-black text-accent uppercase tracking-widest mb-2">{result.accountName}</p>
                                    )}
                                    <p className="text-xs text-muted"><span className="text-emerald-400 font-bold">Campaign ID:</span> {result.campaignId}</p>
                                    <p className="text-xs text-muted"><span className="text-emerald-400 font-bold">Ad Set ID:</span> {result.adSetId}</p>
                                    <p className="text-xs text-muted"><span className="text-emerald-400 font-bold">Ad ID:</span> {result.adId}</p>
                                </div>
                            ))}
                            <p className="text-xs text-amber-400 font-bold">Estado: PAUSADA (actívala desde el Ads Manager)</p>
                        </div>
                    )}
                    <button
                        onClick={() => { setIsLaunched(false); setLaunchResults([]); resetForm(); }}
                        className="px-8 py-3 bg-card hover:bg-hover-bg text-foreground font-black uppercase text-xs rounded-xl transition-all border border-card-border"
                    >
                        Volver al Lanzador
                    </button>
                </div>
            </div>
        );
    }

    return (
        <div className="flex flex-col h-full">
            <div className="flex-1 overflow-y-auto p-6 lg:p-10 space-y-6 custom-scrollbar">

                {/* 1. Configuración */}
                <CollapsibleSection title="Configuración" icon={Zap}>
                    {/* Platform Selector */}
                    <div className="flex gap-2 mb-5">
                        <button
                            onClick={() => setPlatform('facebook')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${platform === 'facebook'
                                ? 'bg-blue-600/20 border-blue-500/40 text-blue-400'
                                : 'bg-card border-card-border text-muted hover:border-blue-500/20'}`}
                        >
                            <span className="text-sm font-black">FB</span> Facebook
                        </button>
                        <button
                            onClick={() => setPlatform('tiktok')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${platform === 'tiktok'
                                ? 'bg-pink-600/20 border-pink-500/40 text-pink-400'
                                : 'bg-card border-card-border text-muted hover:border-pink-500/20'}`}
                        >
                            <span className="text-sm font-black">TT</span> TikTok
                        </button>
                        <button
                            onClick={() => setPlatform('both')}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all border ${platform === 'both'
                                ? 'bg-accent/20 border-accent/40 text-accent'
                                : 'bg-card border-card-border text-muted hover:border-accent/20'}`}
                        >
                            <span className="text-sm font-black">FB+TT</span> Ambas
                        </button>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block">Perfil de Tienda</label>
                            <select
                                className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-accent/50 outline-none transition-colors"
                                value={selectedStoreId || ''}
                                onChange={e => {
                                    const id = e.target.value;
                                    setSelectedStoreId(id);
                                    const store = storeProfiles.find(s => s.id === id);
                                    if (store) setNaming(prev => ({ ...prev, country: store.country }));
                                }}
                            >
                                <option value="" disabled>Seleccionar Tienda...</option>
                                {storeProfiles.map(profile => (
                                    <option key={profile.id} value={profile.id}>{profile.name} ({profile.country})</option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block">Producto</label>
                            <input
                                type="text"
                                placeholder="EJ: TIBURON LED"
                                className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-accent/50 outline-none transition-colors"
                                value={naming.product}
                                onChange={e => { const v = e.target.value; setNaming(prev => ({ ...prev, product: v })); }}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block">Programación</label>
                            <input
                                type="datetime-local"
                                className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-accent/50 outline-none transition-colors"
                                value={naming.date ? new Date(naming.date.getTime() - (naming.date.getTimezoneOffset() * 60000)).toISOString().slice(0, 16) : ''}
                                onChange={e => { const d = new Date(e.target.value); setNaming(prev => ({ ...prev, date: d })); }}
                            />
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block">Estrategia</label>
                            <select
                                className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-accent/50 outline-none transition-colors"
                                value={naming.strategy}
                                onChange={e => { const s = e.target.value as NamingVariables['strategy']; setNaming(prev => ({ ...prev, strategy: s })); }}
                            >
                                {platform === 'tiktok' ? (
                                    <>
                                        <option value="CBO">CBO (Campaign Budget)</option>
                                        <option value="ABO">ABO (Ad Group Budget)</option>
                                    </>
                                ) : (
                                    <>
                                        <option value="CBO">CBO (Campaign Budget Opt)</option>
                                        <option value="ABO">ABO (Ad Set Budget Opt)</option>
                                        {platform === 'facebook' && <option value="ASC">ASC (Advantage+ Shopping)</option>}
                                    </>
                                )}
                            </select>
                        </div>

                        <div>
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block">País</label>
                            <div className="p-2.5 bg-card border border-card-border rounded-xl text-xs font-bold text-accent uppercase flex items-center gap-2">
                                <Globe className="w-3 h-3" />
                                {naming.country}
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* 2. Naming Convention Preview */}
                <div className="p-4 bg-accent/10 border border-accent/20 rounded-2xl space-y-3">
                    <div className="flex items-center justify-between">
                        <div className="space-y-1">
                            <span className="text-[10px] font-black uppercase tracking-widest text-accent/70">Naming Convention</span>
                            <p className="font-mono text-xs font-bold text-foreground tracking-widest">{campaignName}</p>
                        </div>
                        <button
                            onClick={() => setShowNamingEditor(!showNamingEditor)}
                            className="p-2 bg-accent/20 rounded-lg hover:bg-accent/30 transition-all"
                            title="Editar formato de naming"
                        >
                            <Rocket className="w-5 h-5 text-accent" />
                        </button>
                    </div>
                    {showNamingEditor && (
                        <div className="space-y-3 pt-3 border-t border-accent/20 animate-in fade-in duration-200">
                            <div className="flex items-center gap-2">
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Template</label>
                                <button
                                    onClick={() => setNamingTemplate(DEFAULT_NAMING_TEMPLATE)}
                                    className="text-[10px] font-bold text-accent hover:underline"
                                >
                                    Reset
                                </button>
                            </div>
                            <input
                                type="text"
                                className="w-full bg-background border border-card-border rounded-xl px-4 py-2.5 text-xs font-mono text-foreground focus:border-accent/50 outline-none"
                                value={namingTemplate}
                                onChange={e => setNamingTemplate(e.target.value)}
                            />
                            <div className="flex flex-wrap gap-2">
                                {NAMING_TAGS.map(t => (
                                    <button
                                        key={t.tag}
                                        onClick={() => {
                                            const input = document.querySelector<HTMLInputElement>('input[value="' + CSS.escape(namingTemplate) + '"]');
                                            setNamingTemplate(namingTemplate + (namingTemplate.endsWith(' ') || namingTemplate === '' ? '' : ' - ') + t.tag);
                                        }}
                                        className="px-3 py-1.5 bg-card border border-card-border rounded-lg text-[10px] font-black uppercase text-accent hover:bg-accent/10 transition-all"
                                        title={t.description}
                                    >
                                        {t.tag}
                                    </button>
                                ))}
                            </div>
                        </div>
                    )}
                </div>

                {/* 3. Cuentas Publicitarias */}
                <CollapsibleSection title="Cuentas Publicitarias" icon={Target}>
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {isLoadingAccounts ? (
                            <div className="col-span-full py-12 flex flex-col items-center gap-4">
                                <Loader2 className="w-8 h-8 text-accent animate-spin" />
                                <p className="text-xs font-black uppercase tracking-widest text-muted italic animate-pulse">Consultando APIs de Marketing...</p>
                            </div>
                        ) : adAccounts.filter(a => platform === 'both' || a.platform === platform).length > 0 ? (
                            adAccounts.filter(a => platform === 'both' || a.platform === platform).map((acc) => {
                                const isSelected = selectedAccountIds.includes(acc.id);
                                return (
                                    <button
                                        key={`${acc.platform}-${acc.id}`}
                                        type="button"
                                        onClick={() => {
                                            setSelectedAccountIds(prev =>
                                                prev.includes(acc.id)
                                                    ? prev.filter(id => id !== acc.id)
                                                    : [...prev, acc.id]
                                            );
                                        }}
                                        className={`flex items-center justify-between p-4 rounded-2xl border transition-all text-left ${isSelected
                                            ? 'bg-accent/10 border-accent/30'
                                            : 'bg-background border-card-border hover:border-accent/20'
                                            }`}
                                    >
                                        <div className="flex items-center gap-4">
                                            <div className={`w-10 h-10 rounded-xl flex items-center justify-center font-black ${acc.platform === 'facebook' ? 'bg-blue-600/20 text-blue-400' : 'bg-pink-600/20 text-pink-400'}`}>
                                                {acc.platform === 'facebook' ? 'f' : 't'}
                                            </div>
                                            <div className="overflow-hidden">
                                                <h4 className="font-bold text-foreground text-sm truncate">{acc.name}</h4>
                                                <p className="text-xs text-muted uppercase tracking-widest truncate">{acc.id}</p>
                                            </div>
                                        </div>
                                        {isSelected && <CheckCircle2 className="w-5 h-5 text-accent" />}
                                    </button>
                                );
                            })
                        ) : (
                            <div className="col-span-full p-8 border border-dashed border-card-border rounded-2xl text-center bg-background">
                                <AlertCircle className="w-8 h-8 text-muted mx-auto mb-3" />
                                <p className="text-sm text-muted font-bold uppercase tracking-widest">No hay cuentas en Configuración</p>
                                <p className="text-xs text-muted mt-1">Configura tus APIs en el módulo de Ajustes Globales</p>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>

                {/* 3.5 Campaign Mode: New vs Existing (Facebook only) */}
                {(platform === 'facebook' || platform === 'both') && <CollapsibleSection title="Destino de Campaña" icon={Rocket}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <button
                            onClick={() => { setCampaignMode('new'); setSelectedCampaignByAccount({}); setSelectedAdSetByAccount({}); }}
                            className={`p-5 rounded-2xl border transition-all text-left ${campaignMode === 'new'
                                ? 'bg-accent/10 border-accent/30'
                                : 'bg-background border-card-border hover:border-accent/20'
                                }`}
                        >
                            <Sparkles className={`w-5 h-5 mb-3 ${campaignMode === 'new' ? 'text-accent' : 'text-muted'}`} />
                            <h4 className="text-sm font-black uppercase tracking-tighter">Nueva Campaña</h4>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-widest">Crear campaña desde cero</p>
                        </button>
                        <button
                            onClick={() => setCampaignMode('existing')}
                            className={`p-5 rounded-2xl border transition-all text-left ${campaignMode === 'existing'
                                ? 'bg-accent/10 border-accent/30'
                                : 'bg-background border-card-border hover:border-accent/20'
                                }`}
                        >
                            <Layers className={`w-5 h-5 mb-3 ${campaignMode === 'existing' ? 'text-accent' : 'text-muted'}`} />
                            <h4 className="text-sm font-black uppercase tracking-tighter">Campaña Existente</h4>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-widest">Agregar ads a una campaña activa</p>
                        </button>
                    </div>

                    {campaignMode === 'existing' && (
                        <div className="space-y-4 animate-in fade-in duration-200">
                            {isLoadingCampaigns ? (
                                <div className="flex items-center gap-2 p-3">
                                    <Loader2 className="w-4 h-4 text-accent animate-spin" />
                                    <span className="text-xs text-muted">Cargando campañas...</span>
                                </div>
                            ) : selectedAccountIds.length === 0 ? (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-xl flex items-center gap-3">
                                    <AlertCircle className="w-4 h-4 text-amber-500 shrink-0" />
                                    <p className="text-xs text-amber-500 font-bold">Selecciona al menos una cuenta publicitaria.</p>
                                </div>
                            ) : (
                                <>
                                    {selectedAccountIds.map(accId => {
                                        const acc = adAccounts.find(a => a.id === accId);
                                        const campaigns = campaignsByAccount[accId] || [];
                                        const search = campaignSearchByAccount[accId] || '';
                                        const selectedCampId = selectedCampaignByAccount[accId] || '';
                                        const adSets = adSetsByAccount[accId] || [];
                                        const selectedAdSet = selectedAdSetByAccount[accId] || '';

                                        return (
                                            <div key={accId} className="border border-card-border rounded-xl p-4 space-y-3">
                                                <div className="flex items-center gap-2">
                                                    <div className="w-6 h-6 bg-blue-600/20 text-blue-400 rounded-lg flex items-center justify-center text-xs font-black">f</div>
                                                    <span className="text-xs font-black uppercase tracking-widest">{acc?.name || accId}</span>
                                                    {selectedCampId && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 ml-auto" />}
                                                </div>

                                                <div className="relative">
                                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" />
                                                    <input
                                                        type="text"
                                                        placeholder="Buscar campaña..."
                                                        className="w-full bg-background border border-card-border rounded-xl pl-9 pr-4 py-2 text-sm text-foreground focus:border-accent/50 outline-none"
                                                        value={search}
                                                        onChange={e => setCampaignSearchByAccount(prev => ({ ...prev, [accId]: e.target.value }))}
                                                    />
                                                </div>
                                                <div className="max-h-36 overflow-y-auto border border-card-border rounded-xl bg-background">
                                                    {campaigns
                                                        .filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase()))
                                                        .map(c => (
                                                            <button
                                                                key={c.id}
                                                                onClick={() => {
                                                                    setSelectedCampaignByAccount(prev => ({ ...prev, [accId]: c.id }));
                                                                    setSelectedAdSetByAccount(prev => ({ ...prev, [accId]: '' }));
                                                                    setCampaignSearchByAccount(prev => ({ ...prev, [accId]: '' }));
                                                                    loadExistingAdSets(accId, c.id);
                                                                }}
                                                                className={`w-full text-left px-4 py-2 text-sm transition-colors border-b border-card-border last:border-b-0 ${selectedCampId === c.id ? 'bg-accent/10 text-accent font-bold' : 'text-foreground hover:bg-accent/5'}`}
                                                            >
                                                                {c.name} <span className="text-[10px] text-muted ml-1">({c.status})</span>
                                                            </button>
                                                        ))}
                                                    {campaigns.filter(c => !search || c.name.toLowerCase().includes(search.toLowerCase())).length === 0 && (
                                                        <p className="px-4 py-3 text-xs text-muted text-center">No se encontraron campañas</p>
                                                    )}
                                                </div>

                                                {selectedCampId && adSets.length > 0 && (
                                                    <div>
                                                        <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-1 block">Ad Set (opcional)</label>
                                                        <select
                                                            className="w-full bg-background border border-card-border rounded-xl px-4 py-2 text-sm text-foreground focus:border-accent/50 outline-none"
                                                            value={selectedAdSet}
                                                            onChange={e => setSelectedAdSetByAccount(prev => ({ ...prev, [accId]: e.target.value }))}
                                                        >
                                                            <option value="">Crear nuevo Ad Set</option>
                                                            {adSets.map(s => (
                                                                <option key={s.id} value={s.id}>{s.name} ({s.status})</option>
                                                            ))}
                                                        </select>
                                                    </div>
                                                )}
                                            </div>
                                        );
                                    })}

                                    {/* Confirmation summary */}
                                    {Object.values(selectedCampaignByAccount).some(id => id) && (
                                        <div className="p-4 bg-emerald-500/5 border border-emerald-500/20 rounded-xl space-y-2">
                                            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Resumen de Selección</p>
                                            {selectedAccountIds.map(accId => {
                                                const acc = adAccounts.find(a => a.id === accId);
                                                const campId = selectedCampaignByAccount[accId];
                                                if (!campId) return null;
                                                const camp = (campaignsByAccount[accId] || []).find(c => c.id === campId);
                                                const adSetId = selectedAdSetByAccount[accId];
                                                const adSet = adSetId ? (adSetsByAccount[accId] || []).find(s => s.id === adSetId) : null;
                                                return (
                                                    <div key={accId} className="flex items-center gap-2 text-xs">
                                                        <CheckCircle2 className="w-3 h-3 text-emerald-400 shrink-0" />
                                                        <span className="text-foreground font-bold truncate">{acc?.name}</span>
                                                        <span className="text-muted shrink-0">&rarr;</span>
                                                        <span className="text-accent truncate">{camp?.name}</span>
                                                        {adSet && <><span className="text-muted shrink-0">&rarr;</span><span className="text-muted truncate">{adSet.name}</span></>}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                </>
                            )}
                        </div>
                    )}
                </CollapsibleSection>}

                {/* 4. Ad Structure (Facebook only — TikTok always uses grouped) */}
                {(platform === 'facebook' || platform === 'both') && <CollapsibleSection title="Estructura de Anuncios" icon={Layers}>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        {/* Grouped */}
                        <button
                            onClick={() => setAdStructure('grouped')}
                            className={`p-5 rounded-2xl border transition-all text-left ${adStructure === 'grouped'
                                ? 'bg-accent/10 border-accent/30'
                                : 'bg-background border-card-border hover:border-accent/20'
                                }`}
                        >
                            <Layers className={`w-5 h-5 mb-3 ${adStructure === 'grouped' ? 'text-accent' : 'text-muted'}`} />
                            <h4 className="text-sm font-black uppercase tracking-tighter">Agrupados</h4>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-widest">
                                {adsPerAdSet > 0 ? `${adsPerAdSet} ads por AdSet` : '1 AdSet, todos los ads juntos'}
                            </p>
                            {adStructure === 'grouped' && (
                                <div className="mt-3 pt-3 border-t border-card-border" onClick={(e) => e.stopPropagation()}>
                                    <label className="text-[9px] font-bold uppercase tracking-widest text-muted block mb-1.5">Ads por AdSet</label>
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="number"
                                            min={0}
                                            max={50}
                                            value={adsPerAdSet}
                                            onChange={(e) => setAdsPerAdSet(Math.max(0, parseInt(e.target.value) || 0))}
                                            className="w-14 bg-background border border-card-border rounded-lg px-2 py-1.5 text-center font-mono text-sm focus:border-accent focus:outline-none"
                                        />
                                        <span className="text-[9px] text-muted uppercase tracking-wider">
                                            {adsPerAdSet === 0 ? 'Todos en 1 AdSet' : `${uploadedFiles.length > 0 ? Math.ceil(uploadedFiles.length / adsPerAdSet) : '?'} AdSets`}
                                        </span>
                                    </div>
                                </div>
                            )}
                        </button>

                        {/* Isolated */}
                        <button
                            onClick={() => setAdStructure('isolated')}
                            className={`p-5 rounded-2xl border transition-all text-left ${adStructure === 'isolated'
                                ? 'bg-accent/10 border-accent/30'
                                : 'bg-background border-card-border hover:border-accent/20'
                                }`}
                        >
                            <Split className={`w-5 h-5 mb-3 ${adStructure === 'isolated' ? 'text-accent' : 'text-muted'}`} />
                            <h4 className="text-sm font-black uppercase tracking-tighter">Aislados</h4>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-widest">1 AdSet por cada creativo</p>
                        </button>

                        {/* Flexible */}
                        <button
                            onClick={() => setAdStructure('flexible')}
                            className={`p-5 rounded-2xl border transition-all text-left ${adStructure === 'flexible'
                                ? 'bg-accent/10 border-accent/30'
                                : 'bg-background border-card-border hover:border-accent/20'
                                }`}
                        >
                            <Shuffle className={`w-5 h-5 mb-3 ${adStructure === 'flexible' ? 'text-accent' : 'text-muted'}`} />
                            <h4 className="text-sm font-black uppercase tracking-tighter">Flexible Ads</h4>
                            <p className="text-[10px] text-muted mt-1 uppercase tracking-widest">asset_feed_spec (multi-asset)</p>
                        </button>
                    </div>
                </CollapsibleSection>}

                {/* 5. Presupuesto */}
                <CollapsibleSection title="Presupuesto" icon={DollarSign}>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div className="space-y-6">
                            <div>
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block">Presupuesto Diario</label>
                                <div className="flex items-center gap-2">
                                    <span className="text-lg font-black text-muted">{activeCurrencyConfig.symbol}</span>
                                    <input
                                        type="number"
                                        min={activeCurrencyConfig.min}
                                        max={activeCurrencyConfig.max}
                                        step={activeCurrencyConfig.step}
                                        value={budget.amount}
                                        onChange={e => {
                                            const val = parseInt(e.target.value) || 0;
                                            setBudget({ ...budget, amount: Math.max(activeCurrencyConfig.min, Math.min(activeCurrencyConfig.max, val)) });
                                        }}
                                        className="flex-1 bg-background border border-card-border rounded-xl px-4 py-3 text-2xl font-black italic text-foreground focus:border-accent/50 outline-none transition-colors font-mono"
                                    />
                                    <span className="text-sm font-bold text-accent">{budget.currency}</span>
                                </div>
                                <div className="flex justify-between mt-2 text-[10px] font-bold text-muted">
                                    <span>Min: {activeCurrencyConfig.symbol}{activeCurrencyConfig.min.toLocaleString()}</span>
                                    <span>Max: {activeCurrencyConfig.symbol}{activeCurrencyConfig.max.toLocaleString()}</span>
                                </div>
                            </div>
                            <div className="grid grid-cols-3 gap-2">
                                {activeCurrencyConfig.presets.map(val => (
                                    <button
                                        key={val}
                                        onClick={() => setBudget({ ...budget, amount: val })}
                                        className={`py-2 rounded-xl text-xs font-black transition-all ${budget.amount === val ? 'bg-accent text-white' : 'bg-background text-muted hover:bg-hover-bg border border-card-border'}`}
                                    >
                                        {activeCurrencyConfig.symbol}{val.toLocaleString()}
                                    </button>
                                ))}
                            </div>

                            {/* Multi-Account Budget Indicator */}
                            {selectedAccountIds.length > 1 && (
                                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-2xl flex items-center gap-3">
                                    <Info className="w-5 h-5 text-amber-500 shrink-0" />
                                    <p className="text-xs font-bold text-amber-500">
                                        Gasto total proyectado: {activeCurrencyConfig.symbol}{(budget.amount * selectedAccountIds.length).toLocaleString()}/día ({activeCurrencyConfig.symbol}{budget.amount.toLocaleString()} x {selectedAccountIds.length} cuentas)
                                    </p>
                                </div>
                            )}
                        </div>

                        <div className="bg-accent/5 border border-accent/20 p-6 rounded-2xl space-y-4">
                            <div className="flex items-center gap-3 text-accent">
                                <Dices className="w-5 h-5" />
                                <h3 className="font-black uppercase italic tracking-tighter text-sm">Impacto Proyectado</h3>
                            </div>
                            <div className="space-y-3">
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted font-bold uppercase">Alcance</span>
                                    <span className="text-foreground font-mono">{Math.floor(budget.amount * 1200).toLocaleString()} - {Math.floor(budget.amount * 3500).toLocaleString()}</span>
                                </div>
                                <div className="flex justify-between text-xs">
                                    <span className="text-muted font-bold uppercase">Conversiones</span>
                                    <span className="text-emerald-500 font-mono font-bold">~{Math.floor(budget.amount * 0.4)} - {Math.floor(budget.amount * 1.2)}</span>
                                </div>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* 6. Segmentación */}
                <CollapsibleSection title="Segmentación" icon={Target} className={naming.strategy === 'ASC' ? 'opacity-40 pointer-events-none relative' : ''}>
                    {naming.strategy === 'ASC' && (
                        <div className="absolute inset-0 z-10 flex items-center justify-center bg-card/50 rounded-2xl">
                            <div className="p-4 bg-accent/10 border border-accent/20 rounded-2xl flex items-center gap-3">
                                <Info className="w-5 h-5 text-accent" />
                                <p className="text-xs font-bold text-accent uppercase tracking-widest">Advantage+ maneja la segmentación automáticamente</p>
                            </div>
                        </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        {/* Exclusion lists — Facebook only */}
                        {platform !== 'tiktok' && <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Listas de Exclusión</label>
                            <div className="grid grid-cols-1 gap-3">
                                {exclusionLists.length > 0 ? exclusionLists.map((list) => (
                                    <button
                                        key={list.id}
                                        onClick={() => setSelectedExclusionId(selectedExclusionId === list.id ? null : list.id)}
                                        className={`w-full p-4 border rounded-2xl flex items-center justify-between transition-all ${selectedExclusionId === list.id
                                            ? 'bg-accent/10 border-accent/30'
                                            : 'bg-background border-card-border hover:border-accent/20'
                                            }`}
                                    >
                                        <div className="flex flex-col items-start">
                                            <span className="text-xs font-bold">{list.name}</span>
                                            <span className="text-xs text-muted uppercase font-mono">{list.locations.split(',').length} Ubicaciones</span>
                                        </div>
                                        <div className={`p-1 rounded-full ${selectedExclusionId === list.id ? 'bg-accent text-white' : 'bg-background text-muted'}`}>
                                            <CheckCircle2 className="w-3 h-3" />
                                        </div>
                                    </button>
                                )) : (
                                    <div className="p-8 border-2 border-dashed border-card-border rounded-2xl text-center">
                                        <p className="text-xs text-muted font-bold uppercase tracking-widest">No hay listas guardadas</p>
                                        <p className="text-xs text-muted mt-1 uppercase">Crea una en El Motor</p>
                                    </div>
                                )}
                            </div>
                        </div>}
                        <div className="space-y-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-muted">Demografía (Opcional)</label>
                            <div className="p-5 bg-background border border-card-border rounded-2xl space-y-5">
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-mono">
                                        <span className="text-muted uppercase">Edad Mínima</span>
                                        <span className="text-accent font-bold">{demographics.ageMin}</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={13}
                                        max={64}
                                        value={demographics.ageMin}
                                        onChange={e => setDemographics(prev => ({ ...prev, ageMin: parseInt(e.target.value) }))}
                                        className="w-full h-1 bg-card-border rounded-full appearance-none cursor-pointer accent-accent"
                                    />
                                </div>
                                <div className="space-y-3">
                                    <div className="flex justify-between text-xs font-mono">
                                        <span className="text-muted uppercase">Edad Máxima</span>
                                        <span className="text-accent font-bold">{demographics.ageMax}+</span>
                                    </div>
                                    <input
                                        type="range"
                                        min={14}
                                        max={65}
                                        value={demographics.ageMax}
                                        onChange={e => setDemographics(prev => ({ ...prev, ageMax: parseInt(e.target.value) }))}
                                        className="w-full h-1 bg-card-border rounded-full appearance-none cursor-pointer accent-accent"
                                    />
                                </div>
                                <div className="flex gap-2">
                                    {([
                                        { id: 'male' as const, label: 'Hombres' },
                                        { id: 'female' as const, label: 'Mujeres' },
                                        { id: 'all' as const, label: 'Todos' },
                                    ]).map((g) => (
                                        <button
                                            key={g.id}
                                            type="button"
                                            onClick={() => setDemographics(prev => ({ ...prev, gender: g.id }))}
                                            className={`flex-1 py-2 rounded-lg text-xs font-black uppercase transition-all ${demographics.gender === g.id ? 'bg-accent text-white' : 'bg-card text-muted border border-card-border hover:border-accent/20'}`}
                                        >
                                            {g.label}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </CollapsibleSection>

                {/* 7. Creativos & Copy */}
                <CollapsibleSection title="Creativos & Copy" icon={Monitor}>
                    <input
                        type="file"
                        ref={fileInputRef}
                        className="hidden"
                        multiple
                        accept="image/*,video/*"
                        onChange={handleFileChange}
                    />

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
                        <button
                            onClick={handleFileClick}
                            className="p-6 bg-accent/5 border-2 border-dashed border-accent/20 hover:border-accent rounded-2xl flex flex-col items-center gap-3 group transition-all"
                        >
                            <div className="p-3 bg-accent/10 rounded-xl group-hover:bg-accent group-hover:text-white transition-all text-accent">
                                <Monitor className="w-6 h-6" />
                            </div>
                            <div className="text-center">
                                <span className="text-sm font-black uppercase italic tracking-tighter block">Subir desde PC</span>
                                <span className="text-xs font-bold text-muted uppercase tracking-widest">MP4, MOV, JPG, PNG</span>
                            </div>
                        </button>
                        <button
                            onClick={handleGoogleDriveUpload}
                            className="p-6 bg-background border-2 border-dashed border-card-border hover:border-blue-500/50 hover:bg-blue-500/5 rounded-2xl flex flex-col items-center gap-3 group transition-all"
                        >
                            <div className="p-3 bg-card rounded-xl group-hover:bg-blue-500/20 transition-all border border-card-border">
                                <Cloud className="w-6 h-6 text-muted group-hover:text-blue-400" />
                            </div>
                            <div className="text-center">
                                <span className="text-sm font-black uppercase italic tracking-tighter block">Google Drive</span>
                                <span className="text-xs font-bold text-[#4285F4] uppercase tracking-widest">Picker Activo</span>
                            </div>
                        </button>
                    </div>

                    {uploadedFiles.length > 0 && (
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                            {uploadedFiles.map((item, idx) => (
                                <div key={item.id} className="relative group aspect-square rounded-2xl overflow-hidden border border-card-border bg-background">
                                    {item.mimeType?.startsWith('video') ? (
                                        <div className="w-full h-full flex flex-col items-center justify-center gap-2">
                                            <FileVideo className="w-8 h-8 text-accent" />
                                            <span className="text-xs font-bold uppercase truncate max-w-full px-2 text-muted">{item.name}</span>
                                        </div>
                                    ) : (
                                        <img src={item.preview} className="w-full h-full object-cover" alt="preview" />
                                    )}
                                    {item.type === 'gdrive' && (
                                        <div className="absolute top-2 left-2 p-1 bg-blue-500/20 text-blue-400 rounded-md backdrop-blur-sm">
                                            <Cloud className="w-3 h-3" />
                                        </div>
                                    )}
                                    <button
                                        onClick={() => removeFile(idx)}
                                        className="absolute top-2 right-2 p-1.5 bg-background/80 hover:bg-red-500 text-foreground hover:text-white rounded-lg opacity-0 group-hover:opacity-100 transition-all"
                                    >
                                        <X className="w-3 h-3" />
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Multi-Format Toggle */}
                    {uploadedFiles.filter(f => !f.mimeType?.startsWith('video')).length >= 2 && (
                        <div className="mb-6">
                            <label className="flex items-center gap-3 cursor-pointer" onClick={() => setMultiFormat(!multiFormat)}>
                                <div className={`relative w-9 h-5 rounded-full transition-colors ${multiFormat ? 'bg-accent' : 'bg-gray-600'}`}>
                                    <div className={`absolute top-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${multiFormat ? 'translate-x-4' : 'translate-x-0.5'}`} />
                                </div>
                                <div className="flex items-center gap-2">
                                    <GalleryHorizontalEnd className={`w-4 h-4 ${multiFormat ? 'text-accent' : 'text-muted'}`} />
                                    <span className="text-xs font-black uppercase tracking-wider">Multi-Formato</span>
                                    <span className="text-[9px] text-muted uppercase tracking-widest">Feed (4:5) + Stories (9:16)</span>
                                </div>
                            </label>
                        </div>
                    )}

                    {/* Multi-Format Pairing UI */}
                    {multiFormat && formatPairs.length > 0 && (
                        <div className="mb-6 p-4 bg-background border border-card-border rounded-2xl">
                            <div className="flex items-center justify-between mb-3">
                                <h4 className="text-[10px] font-black uppercase tracking-widest text-muted flex items-center gap-2">
                                    <ArrowUpDown className="w-3.5 h-3.5" />
                                    Emparejamiento ({formatPairs.filter(p => p.feed && p.story).length} pares)
                                </h4>
                                <span className="text-[9px] text-muted uppercase tracking-widest">
                                    {uploadedFiles.filter(f => f.ratio === '4:5').length} feed · {uploadedFiles.filter(f => f.ratio === '9:16').length} story
                                </span>
                            </div>

                            <div className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-2">
                                <span className="text-[9px] font-bold text-center uppercase tracking-widest text-muted">Feed 4:5</span>
                                <span></span>
                                <span className="text-[9px] font-bold text-center uppercase tracking-widest text-muted">Story 9:16</span>
                            </div>

                            {formatPairs.map((pair, idx) => (
                                <div key={idx} className="grid grid-cols-[1fr_auto_1fr] gap-2 items-center mb-2">
                                    {/* Feed (4:5) */}
                                    <div className={`aspect-[4/5] max-h-24 rounded-xl overflow-hidden border ${pair.feed ? 'border-card-border' : 'border-dashed border-muted/30'} bg-card`}>
                                        {pair.feed ? (
                                            <div className="relative w-full h-full group">
                                                <img src={pair.feed.preview} className="w-full h-full object-cover" alt="" />
                                                <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/60 text-white px-1 rounded truncate max-w-[90%]">{pair.feed.name}</span>
                                                {/* Move buttons */}
                                                <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {idx > 0 && (
                                                        <button onClick={() => {
                                                            setFormatPairs(prev => {
                                                                const next = [...prev];
                                                                const temp = next[idx].feed;
                                                                next[idx] = { ...next[idx], feed: next[idx - 1].feed };
                                                                next[idx - 1] = { ...next[idx - 1], feed: temp };
                                                                return next;
                                                            });
                                                        }} className="p-0.5 bg-black/60 rounded text-white text-[8px]">▲</button>
                                                    )}
                                                    {idx < formatPairs.length - 1 && (
                                                        <button onClick={() => {
                                                            setFormatPairs(prev => {
                                                                const next = [...prev];
                                                                const temp = next[idx].feed;
                                                                next[idx] = { ...next[idx], feed: next[idx + 1].feed };
                                                                next[idx + 1] = { ...next[idx + 1], feed: temp };
                                                                return next;
                                                            });
                                                        }} className="p-0.5 bg-black/60 rounded text-white text-[8px]">▼</button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted text-[9px]">Sin imagen</div>
                                        )}
                                    </div>

                                    {/* Pair indicator */}
                                    <div className={`text-xs font-bold ${pair.feed && pair.story ? 'text-accent' : 'text-muted/30'}`}>⟷</div>

                                    {/* Story (9:16) */}
                                    <div className={`aspect-[9/16] max-h-24 rounded-xl overflow-hidden border ${pair.story ? 'border-card-border' : 'border-dashed border-muted/30'} bg-card`}>
                                        {pair.story ? (
                                            <div className="relative w-full h-full group">
                                                <img src={pair.story.preview} className="w-full h-full object-cover" alt="" />
                                                <span className="absolute bottom-0.5 left-0.5 text-[8px] bg-black/60 text-white px-1 rounded truncate max-w-[90%]">{pair.story.name}</span>
                                                <div className="absolute top-0.5 right-0.5 flex flex-col gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    {idx > 0 && (
                                                        <button onClick={() => {
                                                            setFormatPairs(prev => {
                                                                const next = [...prev];
                                                                const temp = next[idx].story;
                                                                next[idx] = { ...next[idx], story: next[idx - 1].story };
                                                                next[idx - 1] = { ...next[idx - 1], story: temp };
                                                                return next;
                                                            });
                                                        }} className="p-0.5 bg-black/60 rounded text-white text-[8px]">▲</button>
                                                    )}
                                                    {idx < formatPairs.length - 1 && (
                                                        <button onClick={() => {
                                                            setFormatPairs(prev => {
                                                                const next = [...prev];
                                                                const temp = next[idx].story;
                                                                next[idx] = { ...next[idx], story: next[idx + 1].story };
                                                                next[idx + 1] = { ...next[idx + 1], story: temp };
                                                                return next;
                                                            });
                                                        }} className="p-0.5 bg-black/60 rounded text-white text-[8px]">▼</button>
                                                    )}
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center text-muted text-[9px]">Sin imagen</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}

                    {/* Destination Link */}
                    <div className="mb-6">
                        <label className="text-[10px] font-black uppercase tracking-widest text-muted mb-2 block">Link de Destino</label>
                        <div className="relative group">
                            <input
                                type="url"
                                placeholder="https://tu-tienda.com/producto..."
                                className="w-full bg-background border border-card-border rounded-xl p-3 pl-10 text-sm font-bold text-foreground focus:border-accent/50 outline-none transition-all placeholder:text-muted"
                                value={destinationUrl}
                                onChange={e => setDestinationUrl(e.target.value)}
                            />
                            <Link className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted" />
                        </div>
                    </div>

                    {/* Copywriting */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2">
                                <Wand2 className="w-4 h-4 text-purple-400" />
                                <label className="text-[10px] font-black uppercase tracking-widest text-muted">Copywriting Engine</label>
                            </div>
                            {copy.length > 100 && (
                                <div className="flex items-center gap-2 px-3 py-1 bg-red-500/20 border border-red-500/30 rounded-full">
                                    <AlertCircle className="w-3 h-3 text-red-500" />
                                    <span className="text-[10px] font-black uppercase text-red-500">+100 chars</span>
                                </div>
                            )}
                        </div>

                        <div className="relative group mb-4">
                            {(platform === 'tiktok' || platform === 'both') && (
                                <p className="text-[10px] font-bold text-pink-400 uppercase tracking-widest mb-2">
                                    TikTok: máximo 100 caracteres para la descripción del anuncio
                                </p>
                            )}
                            <textarea
                                placeholder={platform === 'tiktok' ? 'Descripción del producto (máx 100 chars)...' : 'Escribe el copy principal aquí...'}
                                className={`w-full bg-background border rounded-2xl p-5 text-sm font-medium text-foreground focus:border-accent/50 outline-none transition-all placeholder:text-muted resize-none ${
                                    (platform === 'tiktok' || platform === 'both') ? 'min-h-[80px]' : 'min-h-[120px]'
                                } ${(platform === 'tiktok' || platform === 'both') && copy.length > 100 ? 'border-red-500/50' : 'border-card-border'}`}
                                value={copy}
                                onChange={e => setCopy(e.target.value)}
                                maxLength={platform === 'tiktok' ? 100 : undefined}
                            />
                            <div className="absolute bottom-4 right-4 flex gap-2">
                                <div className={`flex items-center gap-2 mr-2 px-3 py-1.5 bg-card border border-card-border rounded-lg font-mono text-xs ${
                                    (platform === 'tiktok' || platform === 'both') && copy.length > 100 ? 'text-red-400' : 'text-muted'
                                }`}>
                                    {copy.length}{(platform === 'tiktok' || platform === 'both') && '/100'}
                                </div>
                        </div>
                        </div>

                        {/* VEGA Instruction */}
                        <div className="mb-4">
                            <label className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2 block">Instrucción para Vega AI (opcional)</label>
                            <div className="flex gap-2">
                                <input
                                    type="text"
                                    placeholder='Ej: "Para Black Friday", "Enfocado en madres", "Tono urgente"...'
                                    className="flex-1 bg-background border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm text-foreground focus:border-purple-500/50 outline-none transition-colors placeholder:text-muted"
                                    value={vegaInstruction}
                                    onChange={e => setVegaInstruction(e.target.value)}
                                />
                                <div className="relative group/vega">
                                    <button
                                        onClick={handleGenerateCopy}
                                        disabled={isGenerating || !naming.product}
                                        className={`p-2 px-4 border rounded-lg transition-all flex items-center gap-2 text-xs font-black uppercase disabled:cursor-not-allowed ${!naming.product ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 opacity-80' : 'bg-purple-500/20 hover:bg-purple-500 text-purple-400 hover:text-white border-purple-500/30 disabled:opacity-50'}`}
                                    >
                                        {isGenerating ? <Loader2 className="w-3 h-3 animate-spin" /> : !naming.product ? <AlertCircle className="w-3 h-3" /> : <Sparkles className="w-3 h-3" />}
                                        {aiCopies.length > 0 ? 'Regenerar' : 'Vega AI'}
                                    </button>
                                    {!naming.product && (
                                        <div className="absolute bottom-full right-0 mb-2 px-3 py-2 bg-amber-500 text-white text-[10px] font-bold rounded-lg shadow-lg opacity-0 group-hover/vega:opacity-100 pointer-events-none transition-opacity duration-200 whitespace-nowrap z-50">
                                            Escribe el nombre del producto primero
                                            <div className="absolute top-full right-4 border-4 border-transparent border-t-amber-500" />
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Title + Description from AI */}
                        {(aiTitle || aiDescription) && (
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4 animate-in fade-in duration-300">
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2 block">Título del Anuncio</label>
                                    <input
                                        type="text"
                                        className="w-full bg-background border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:border-purple-500/50 outline-none"
                                        value={aiTitle}
                                        onChange={e => setAiTitle(e.target.value)}
                                        placeholder="Título corto..."
                                    />
                                    <span className="text-[10px] text-muted mt-1 block">{aiTitle.length}/40 chars</span>
                                </div>
                                <div>
                                    <label className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-2 block">Descripción</label>
                                    <input
                                        type="text"
                                        className="w-full bg-background border border-purple-500/20 rounded-xl px-4 py-2.5 text-sm font-bold text-foreground focus:border-purple-500/50 outline-none"
                                        value={aiDescription}
                                        onChange={e => setAiDescription(e.target.value)}
                                        placeholder="Descripción corta..."
                                    />
                                    <span className="text-[10px] text-muted mt-1 block">{aiDescription.length}/90 chars</span>
                                </div>
                            </div>
                        )}

                        {aiCopies.length > 0 && (
                            <div className="space-y-2">
                                <p className="text-[10px] font-black uppercase tracking-widest text-purple-400 mb-3">
                                    Selecciona copies ({selectedCopyIndices.length} seleccionado{selectedCopyIndices.length !== 1 ? 's' : ''})
                                </p>
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-3 animate-in fade-in slide-in-from-top-4 duration-500">
                                    {aiCopies.map((variant, i) => {
                                        const isActive = selectedCopyIndices.includes(i);
                                        return (
                                            <button
                                                key={i}
                                                onClick={() => {
                                                    toggleCopySelect(i);
                                                    // Also set the textarea to the last clicked copy
                                                    if (!selectedCopyIndices.includes(i)) {
                                                        setCopy(variant);
                                                    }
                                                }}
                                                className={`p-4 rounded-2xl text-left transition-all group border-2 ${isActive
                                                    ? 'bg-purple-500/10 border-purple-500/50'
                                                    : 'bg-background border-card-border hover:border-purple-500/30'}`}
                                            >
                                                <div className="flex justify-between items-start mb-2">
                                                    <span className="text-[10px] font-black uppercase tracking-widest text-purple-400/70">Idea {i + 1}</span>
                                                    {isActive && <CheckCircle2 className="w-3 h-3 text-purple-500" />}
                                                </div>
                                                <p className="text-xs text-muted leading-relaxed font-medium line-clamp-4 group-hover:text-foreground transition-colors">
                                                    {variant}
                                                </p>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                </CollapsibleSection>
            </div>

            {/* Sticky Bottom Bar */}
            <div className="p-6 lg:px-10 border-t border-card-border bg-card shrink-0 space-y-3">
                {launchError && (
                    <div className="flex items-center gap-3 p-3 bg-red-500/10 border border-red-500/20 rounded-xl animate-in fade-in duration-300">
                        <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                        <p className="text-xs text-red-400 font-medium">{launchError}</p>
                        <button onClick={() => setLaunchError(null)} className="ml-auto p-1 hover:bg-hover-bg rounded-lg">
                            <X className="w-3 h-3 text-muted" />
                        </button>
                    </div>
                )}

                {isLaunching && (videoProgress.size > 0 || launchProgress) && (
                    <div className="p-3 bg-accent/10 border border-accent/20 rounded-xl space-y-2">
                        {launchProgress && (
                            <div className="flex items-center gap-3">
                                <Loader2 className="w-4 h-4 text-accent animate-spin shrink-0" />
                                <p className="text-xs text-accent font-bold">{launchProgress}</p>
                            </div>
                        )}
                        {videoProgress.size > 0 && (
                            <div className="space-y-1.5">
                                {Array.from(videoProgress.entries()).map(([name, percent]) => (
                                    <div key={name} className="flex items-center gap-3">
                                        <span className="text-[10px] font-bold text-muted truncate w-32">{name}</span>
                                        <div className="flex-1 h-1.5 bg-card rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-accent rounded-full transition-all duration-300"
                                                style={{ width: `${percent}%` }}
                                            />
                                        </div>
                                        <span className="text-[10px] font-bold text-accent tabular-nums w-8 text-right">{percent}%</span>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}

                <div className="flex items-center justify-between">
                    {/* Campaign counter */}
                    {!isAdmin && campaignLimit < Infinity ? (
                        <div className="flex items-center gap-3">
                            <div className="flex items-center gap-2">
                                <Rocket className="w-4 h-4 text-accent" />
                                <span className="text-xs font-black uppercase tracking-widest text-muted">Campañas</span>
                            </div>
                            <div className="flex items-center gap-2">
                                <span className={`text-sm font-black tabular-nums ${campaignsUsed >= campaignLimit ? 'text-red-400' : 'text-accent'}`}>
                                    {campaignsUsed}/{campaignLimit}
                                </span>
                                <div className="w-24 h-1.5 bg-card-border rounded-full overflow-hidden">
                                    <div
                                        className={`h-full rounded-full transition-all ${campaignsUsed >= campaignLimit ? 'bg-red-500' : 'bg-accent'}`}
                                        style={{ width: `${Math.min((campaignsUsed / campaignLimit) * 100, 100)}%` }}
                                    />
                                </div>
                            </div>
                            <span className="text-[10px] text-muted font-bold uppercase">este mes</span>
                        </div>
                    ) : !isAdmin ? (
                        <div className="flex items-center gap-2">
                            <Rocket className="w-4 h-4 text-accent" />
                            <span className="text-xs font-black uppercase tracking-widest text-muted">Campañas ilimitadas</span>
                        </div>
                    ) : <div />}

                    <button
                        onClick={handleLaunch}
                        disabled={isLaunching || (!isAdmin && campaignsUsed >= campaignLimit && campaignLimit < Infinity)}
                        className="px-12 py-4 bg-emerald-500 hover:bg-emerald-600 text-white font-black uppercase italic tracking-tighter text-lg rounded-2xl flex items-center gap-3 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {isLaunching ? (
                            <>
                                <Loader2 className="w-6 h-6 animate-spin" />
                                Publicando...
                            </>
                        ) : (
                            <>
                                ¡FUEGO!
                                <Rocket className="w-6 h-6" />
                            </>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
