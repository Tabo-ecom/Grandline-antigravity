import { getAppData, setAppData } from '../firebase/firestore';

// ── Types ───────────────────────────────────────────────────────────────────

export interface VegaSubtask {
    id: string;
    text: string;
    done: boolean;
    assignee: string;
    assigneeType: 'agent' | 'person';
}

export interface VegaComment {
    id: string;
    author: string;
    authorType: 'agent' | 'person';
    text: string;
    timestamp: number;
}

export interface VegaFile {
    id: string;
    name: string;
    size: string;
    uploadedBy: string;
    timestamp: number;
}

export interface VegaActivity {
    id: string;
    text: string;
    agentOrPerson: string;
    type: 'agent' | 'person' | 'system';
    timestamp: number;
}

export type TaskStatus = 'pendiente' | 'en_progreso' | 'bloqueado' | 'retraso' | 'pendiente_aprobacion' | 'corregir' | 'listo_para_subir' | 'completado';
export type AnalysisStatus = 'sin_asignar' | 'corriendo' | 'revision' | 'escalando' | 'apagado' | 'completado';

export interface VegaTask {
    id: string;
    name: string;
    description: string;
    status: TaskStatus;
    agentId: string | null;
    assignees: string[];
    store: string;
    product: string;
    tipoActividad: string;
    tipoEstrategia: string;
    linkDrive: string;
    urlPagina: string;
    refVideo: string;
    refLanding: string;
    cuentaPublicitaria: string;
    progress: number;
    priority: string;
    templateId: string | null;
    subtasks: VegaSubtask[];
    comments: VegaComment[];
    files: VegaFile[];
    activity: VegaActivity[];
    createdAt: number;
    updatedAt: number;
    scheduledFor: number | null;
}

export interface VegaAnalysis {
    id: string;
    name: string;
    taskId: string;
    status: AnalysisStatus;
    agentId: string;
    assignees: string[];
    product: string;
    store: string;
    cpc: string;
    ctr: string;
    costoPromVista: string;
    numVentas: number;
    promedioReprod: string;
    rendimiento: 'alto' | 'medio' | 'bajo' | '';
    resultado: string;
    puntoDolor: string;
    tipoContenido: string;
    responsableEtiquetas: string;
    responsableUGC: string;
    canalVenta: string;
    createdAt: number;
    updatedAt: number;
}

export interface BuyerPersona {
    name: string;
    age: string;
    gender: string;
    occupation: string;
    income: string;
    location: string;
    painPoints: string[];
    desires: string[];
    objections: string[];
    platforms: string[];
    buyingTriggers: string[];
    phrase: string;
}

export interface CompetitorInfo {
    name: string;
    url: string;
    priceRange: string;
    strengths: string;
    weaknesses: string;
    adStatus: string;
}

export interface ResearchReport {
    summary: string;
    demand: string;
    competition: string;
    competitors: CompetitorInfo[];
    usBrands: { name: string; url: string; description: string }[];
    redditInsights: { subreddit: string; summary: string; topPains: string[]; topLoves: string[] };
    amazonBestSeller: { title: string; url: string; price: string; rating: string; whyBest: string };
    keywords: string[];
    buyerPersona: BuyerPersona;
    unitEconomics: {
        costProduct: string;
        suggestedPrice: string;
        estimatedCPA: string;
        projectedMargin: string;
        minROAS: string;
    };
    scorecard: {
        wowFactor: number;
        solvesProblem: number;
        impulsePrice: number;
        goodMargins: number;
        notInRetail: number;
        easyToShip: number;
        videoFriendly: number;
        total: number;
    };
    saturationLevel: 'low' | 'medium' | 'high';
    trendPhase: 'emergent' | 'growth' | 'peak' | 'decline' | 'dead';
    recommendation: 'GO' | 'NO_GO' | 'INVESTIGATE';
    targetAudience: string;
    painPoints: string[];
    adAngles: string[];
    adScripts: { angle: string; hook: string; body: string; cta: string }[];
    offerSuggestions: { name: string; description: string; type: string }[];
}

export interface VegaResearch {
    id: string;
    productName: string;
    referenceUrl: string;
    productUrl: string;
    country: string;
    status: 'pending' | 'running' | 'completed' | 'failed';
    progress: string;
    niche: string;
    store: string;
    productImages: string[];
    scrapedData: { reference: string; product: string };
    report: ResearchReport | null;
    error: string | null;
    createdAt: number;
    updatedAt: number;
}

export interface VegaFlowStep {
    name: string;
    agentId: string;
    description: string;
    outputs: string[];
    delegatedTo?: { person: string; task: string };
}

export interface VegaTemplate {
    id: string;
    name: string;
    description: string;
    agentId: string;
    steps: VegaFlowStep[];
    runs: number;
}

export interface VegaAgent {
    id: string;
    name: string;
    initials: string;
    role: string;
    model: string;
    color: string;
}

export interface TeamMember {
    name: string;
    initials: string;
    color: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const VEGA_AGENTS: VegaAgent[] = [
    { id: 'stella', name: 'Stella', initials: 'ST', role: 'Orquestador', model: 'opus-4.6', color: '#FFD700' },
    { id: 'shaka', name: 'Shaka', initials: 'SH', role: 'Data Analytics', model: 'sonnet-4.6', color: '#00CFFF' },
    { id: 'lilith', name: 'Lilith', initials: 'LI', role: 'Campaign Strategy', model: 'sonnet-4.6', color: '#FF3366' },
    { id: 'edison', name: 'Edison', initials: 'ED', role: 'Creative Designer', model: 'sonnet+DALL-E', color: '#00FF88' },
    { id: 'pythagoras', name: 'Pythagoras', initials: 'PY', role: 'Market Research', model: 'sonnet-4.6', color: '#AA77FF' },
    { id: 'atlas', name: 'Atlas', initials: 'AT', role: 'Content Creator', model: 'sonnet-4.6', color: '#FF8800' },
    { id: 'york', name: 'York', initials: 'YK', role: 'Media Buyer', model: 'sonnet+Meta', color: '#FF55AA' },
];

export const TEAM_MEMBERS: TeamMember[] = [
    { name: 'Gustavo M.', initials: 'GM', color: '#d75c33' },
    { name: 'Luisa Garcia', initials: 'LG', color: '#FF55AA' },
    { name: 'Andres Candamil', initials: 'AC', color: '#4A9EFF' },
    { name: 'Aurora Quejada', initials: 'AQ', color: '#00DD88' },
    { name: 'Jackeline Arango', initials: 'JA', color: '#FFD700' },
    { name: 'Marisol Lopez', initials: 'ML', color: '#AA77FF' },
];

export const TASK_STATUSES: { value: TaskStatus; label: string; color: string }[] = [
    { value: 'pendiente', label: 'PENDIENTE', color: '#666' },
    { value: 'en_progreso', label: 'EN PROGRESO', color: '#00CFFF' },
    { value: 'bloqueado', label: 'BLOQUEADO', color: '#FFD700' },
    { value: 'retraso', label: 'RETRASO', color: '#FF3333' },
    { value: 'pendiente_aprobacion', label: 'PEND. APROBACIÓN', color: '#FFAA00' },
    { value: 'corregir', label: 'CORREGIR', color: '#FF8800' },
    { value: 'listo_para_subir', label: 'LISTO PARA SUBIR', color: '#00FF88' },
    { value: 'completado', label: 'COMPLETADO', color: '#00FF88' },
];

export const ANALYSIS_STATUSES: { value: AnalysisStatus; label: string; color: string }[] = [
    { value: 'sin_asignar', label: 'SIN ASIGNAR', color: '#666' },
    { value: 'corriendo', label: 'CORRIENDO', color: '#00CFFF' },
    { value: 'revision', label: 'REVISIÓN', color: '#FF3333' },
    { value: 'escalando', label: 'ESCALANDO', color: '#AA77FF' },
    { value: 'apagado', label: 'APAGADO', color: '#FF3366' },
    { value: 'completado', label: 'COMPLETADO', color: '#00FF88' },
];

export const STORES = [
    { value: 'tabo', label: 'TABO ACCESORIOS', color: '#00CFFF' },
    { value: 'lucent', label: 'LUCENT SKINCARE', color: '#AA77FF' },
    { value: 'vivant', label: 'VIVANT', color: '#00FF88' },
    { value: 'essentials', label: 'TIENDA ESSENTIALS', color: '#FF8800' },
    { value: 'gl', label: 'GRAND LINE', color: '#d75c33' },
];

export const TIPO_ACTIVIDADES = ['LANDING PAGE', 'VIDEOS CREATIVOS', 'COPY', 'RESEARCH', 'ADS', 'ANALYTICS', 'DISEÑO'];

// ── Firestore Keys ──────────────────────────────────────────────────────────

const TASKS_KEY = 'vega_tasks';
const ANALYSIS_KEY = 'vega_analysis';
const TEMPLATES_KEY = 'vega_templates';
const RESEARCH_KEY = 'vega_research';

// ── CRUD: Tasks ─────────────────────────────────────────────────────────────

export async function getVegaTasks(uid: string): Promise<VegaTask[]> {
    const data = await getAppData<VegaTask[]>(TASKS_KEY, uid);
    return data || [];
}

export async function saveVegaTasks(uid: string, tasks: VegaTask[]): Promise<void> {
    await setAppData(TASKS_KEY, tasks, uid);
}

export async function saveVegaTask(uid: string, task: VegaTask): Promise<void> {
    const tasks = await getVegaTasks(uid);
    const idx = tasks.findIndex(t => t.id === task.id);
    if (idx >= 0) tasks[idx] = { ...task, updatedAt: Date.now() };
    else tasks.push({ ...task, updatedAt: Date.now() });
    await saveVegaTasks(uid, tasks);
}

export async function deleteVegaTask(uid: string, taskId: string): Promise<void> {
    const tasks = await getVegaTasks(uid);
    await saveVegaTasks(uid, tasks.filter(t => t.id !== taskId));
}

// ── CRUD: Analysis ──────────────────────────────────────────────────────────

export async function getVegaAnalysis(uid: string): Promise<VegaAnalysis[]> {
    const data = await getAppData<VegaAnalysis[]>(ANALYSIS_KEY, uid);
    return data || [];
}

export async function saveVegaAnalysisList(uid: string, items: VegaAnalysis[]): Promise<void> {
    await setAppData(ANALYSIS_KEY, items, uid);
}

export async function saveVegaAnalysisItem(uid: string, item: VegaAnalysis): Promise<void> {
    const items = await getVegaAnalysis(uid);
    const idx = items.findIndex(i => i.id === item.id);
    if (idx >= 0) items[idx] = { ...item, updatedAt: Date.now() };
    else items.push({ ...item, updatedAt: Date.now() });
    await saveVegaAnalysisList(uid, items);
}

// ── CRUD: Templates ─────────────────────────────────────────────────────────

export async function getVegaTemplates(uid: string): Promise<VegaTemplate[]> {
    const data = await getAppData<VegaTemplate[]>(TEMPLATES_KEY, uid);
    return data || [];
}

export async function saveVegaTemplates(uid: string, templates: VegaTemplate[]): Promise<void> {
    await setAppData(TEMPLATES_KEY, templates, uid);
}

// ── Helpers ──────────────────────────────────────────────────────────────────

export function createId(): string {
    return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

export function createEmptyTask(overrides?: Partial<VegaTask>): VegaTask {
    return {
        id: createId(),
        name: '',
        description: '',
        status: 'pendiente',
        agentId: null,
        assignees: [],
        store: '',
        product: '',
        tipoActividad: '',
        tipoEstrategia: '',
        linkDrive: '',
        urlPagina: '',
        refVideo: '',
        refLanding: '',
        cuentaPublicitaria: '',
        progress: 0,
        priority: '',
        templateId: null,
        subtasks: [],
        comments: [],
        files: [],
        activity: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        scheduledFor: null,
        ...overrides,
    };
}

export function getAgent(id: string): VegaAgent | undefined {
    return VEGA_AGENTS.find(a => a.id === id);
}

export function getStoreInfo(storeVal: string) {
    return STORES.find(s => s.value === storeVal);
}

export function getStatusInfo(status: TaskStatus) {
    return TASK_STATUSES.find(s => s.value === status);
}

export function getAnalysisStatusInfo(status: AnalysisStatus) {
    return ANALYSIS_STATUSES.find(s => s.value === status);
}

// ── CRUD: Research ──────────────────────────────────────────────────────────

export async function getVegaResearchList(uid: string): Promise<VegaResearch[]> {
    const data = await getAppData<VegaResearch[]>(RESEARCH_KEY, uid);
    return data || [];
}

export async function saveVegaResearchList(uid: string, items: VegaResearch[]): Promise<void> {
    await setAppData(RESEARCH_KEY, items, uid);
}

export async function saveVegaResearch(uid: string, research: VegaResearch): Promise<void> {
    const items = await getVegaResearchList(uid);
    const idx = items.findIndex(i => i.id === research.id);
    if (idx >= 0) items[idx] = { ...research, updatedAt: Date.now() };
    else items.push({ ...research, updatedAt: Date.now() });
    await saveVegaResearchList(uid, items);
}

export async function deleteVegaResearch(uid: string, id: string): Promise<void> {
    const items = await getVegaResearchList(uid);
    await saveVegaResearchList(uid, items.filter(i => i.id !== id));
}

export function createEmptyResearch(overrides?: Partial<VegaResearch>): VegaResearch {
    return {
        id: createId(),
        productName: '',
        referenceUrl: '',
        productUrl: '',
        country: 'Colombia',
        status: 'pending',
        progress: '',
        niche: '',
        store: '',
        productImages: [],
        scrapedData: { reference: '', product: '' },
        report: null,
        error: null,
        createdAt: Date.now(),
        updatedAt: Date.now(),
        ...overrides,
    };
}

// ── Default Templates ───────────────────────────────────────────────────────

export const DEFAULT_TEMPLATES: VegaTemplate[] = [
    {
        id: 'tpl_research', name: 'Market Research Completo', description: 'Investigación 5 fases Hormozi: tendencias, competidores, precios, Reddit, scorecard.', agentId: 'pythagoras', runs: 0,
        steps: [
            { name: 'Scraping Tendencias', agentId: 'pythagoras', description: 'Google Trends, AliExpress trending, Amazon BSR.', outputs: ['Trends data', 'Top 50', 'BSR'] },
            { name: 'Reddit & Social', agentId: 'pythagoras', description: 'Pain points y preguntas frecuentes en Reddit y TikTok.', outputs: ['Pain points', 'Sentiment'] },
            { name: 'Competidores', agentId: 'pythagoras', description: 'Meta Ad Library: ads activos, copys, landing pages.', outputs: ['Ads activos', 'Screenshots'] },
            { name: 'Análisis Precios', agentId: 'pythagoras', description: 'Compara precios AliExpress vs competidores. Margen Dropi.', outputs: ['Tabla precios', 'Unit economics'] },
            { name: 'Scorecard Final', agentId: 'pythagoras', description: 'Puntuación Hormozi 5 fases. Rankea por potencial.', outputs: ['Scorecard', 'Top 5', 'Recomendación'] },
        ],
    },
    {
        id: 'tpl_analytics', name: 'Daily Analytics Report', description: 'Reporte diario KPIs Grand Line: ventas, margen, ROAS, alertas.', agentId: 'shaka', runs: 0,
        steps: [
            { name: 'Conexión Grand Line', agentId: 'shaka', description: 'Lee Firebase: órdenes, KPIs, ad spend.', outputs: ['Órdenes', 'KPIs'] },
            { name: 'Detección Alertas', agentId: 'shaka', description: 'Compara vs periodo anterior. Alerta si >10% caída.', outputs: ['Alertas'] },
            { name: 'Tendencias', agentId: 'shaka', description: 'Patrones: mejores días, productos top, países.', outputs: ['Rankings'] },
            { name: 'Reporte', agentId: 'shaka', description: 'Compila y envía por email y Telegram.', outputs: ['Email', 'Telegram'] },
        ],
    },
    {
        id: 'tpl_content', name: 'Content Development', description: 'Copys para ads, descripciones Shopify, secuencias por producto.', agentId: 'atlas', runs: 0,
        steps: [
            { name: 'Contexto', agentId: 'atlas', description: 'Lee buyer persona y datos desde Second Brain.', outputs: ['Brief'] },
            { name: 'Copys Ads', agentId: 'atlas', description: '3 variaciones PAS, RMBC, Schwartz.', outputs: ['v1', 'v2', 'v3'] },
            { name: 'Descripción Shopify', agentId: 'atlas', description: 'HTML CRO con Liquid.', outputs: ['HTML'] },
            { name: 'Revisión', agentId: 'atlas', description: 'Entrega para aprobación.', outputs: ['Final'], delegatedTo: { person: 'Luisa Garcia', task: 'Revisar tono y aprobar' } },
        ],
    },
    {
        id: 'tpl_campaign', name: 'Campaign Performance', description: 'Analiza ROAS por campaña, sugiere escalar o apagar.', agentId: 'lilith', runs: 0,
        steps: [
            { name: 'Pull Métricas', agentId: 'lilith', description: 'ROAS, CPA, CPE por campaña desde Grand Line.', outputs: ['Métricas'] },
            { name: 'Análisis', agentId: 'lilith', description: 'Escalar (>2x), pausar (<1x), ajustar.', outputs: ['Escalar', 'Pausar'] },
            { name: 'Recomendaciones', agentId: 'lilith', description: 'Plan semanal con presupuestos sugeridos.', outputs: ['Plan', 'Budget'] },
        ],
    },
    {
        id: 'tpl_creative', name: 'Creative Generation', description: 'Creativos publicitarios multi-formato con variaciones de hook.', agentId: 'edison', runs: 0,
        steps: [
            { name: 'Brief', agentId: 'edison', description: 'Lee brief de Lilith: producto, ángulo, tono.', outputs: ['Brief visual'] },
            { name: 'Generación', agentId: 'edison', description: 'DALL-E/Flux + brand kit.', outputs: ['Base', 'Variaciones'] },
            { name: 'Multi-Formato', agentId: 'edison', description: '1080x1080, 9:16, 1200x628.', outputs: ['Feed', 'Story', 'Link'] },
            { name: 'Entrega', agentId: 'edison', description: 'Dashboard para revisión.', outputs: ['Creativos'], delegatedTo: { person: 'Andres Candamil', task: 'Revisar calidad visual' } },
        ],
    },
    {
        id: 'tpl_competitor', name: 'Competitor Analysis', description: 'Scraping Meta Ad Library + landing pages competidores.', agentId: 'pythagoras', runs: 0,
        steps: [
            { name: 'Ad Library', agentId: 'pythagoras', description: 'Ads activos por keyword y categoría.', outputs: ['Ads', 'Screenshots'] },
            { name: 'Landing Pages', agentId: 'pythagoras', description: 'Estructura, copy, precio, CTA.', outputs: ['Estructura', 'CTAs'] },
            { name: 'Precios', agentId: 'pythagoras', description: 'Tabla comparativa.', outputs: ['Tabla'] },
            { name: 'Reporte', agentId: 'pythagoras', description: 'Oportunidades, amenazas, plan.', outputs: ['Plan acción'] },
        ],
    },
    {
        id: 'tpl_product', name: 'Product Pipeline Shopify', description: 'Scrape referencia, copy CRO, imágenes IA, push Shopify.', agentId: 'atlas', runs: 0,
        steps: [
            { name: 'Scrape Referencia', agentId: 'atlas', description: 'Imágenes, specs, precio.', outputs: ['Imágenes', 'Specs'] },
            { name: 'Vision AI', agentId: 'edison', description: 'Estilo, colores, contexto.', outputs: ['Brief visual'] },
            { name: 'Copy CRO', agentId: 'atlas', description: 'Título, HTML, beneficios, FAQ.', outputs: ['HTML'] },
            { name: 'Imágenes AI', agentId: 'edison', description: 'DALL-E + brand guidelines.', outputs: ['Hero', 'Lifestyle'] },
            { name: 'Build Shopify', agentId: 'atlas', description: 'Metafields, variantes, Liquid.', outputs: ['JSON'], delegatedTo: { person: 'Andres Candamil', task: 'Revisar y publicar' } },
            { name: 'QA & Publicación', agentId: 'atlas', description: 'GraphQL API. Verifica live.', outputs: ['URL'], delegatedTo: { person: 'Luisa Garcia', task: 'Aprobar landing final' } },
        ],
    },
    {
        id: 'tpl_launch', name: 'Campaign Launch', description: 'Lanza en Meta/TikTok con creativos y audiencias.', agentId: 'york', runs: 0,
        steps: [
            { name: 'Estrategia', agentId: 'york', description: 'Lee plan de Lilith.', outputs: ['Brief'] },
            { name: 'Audiencia', agentId: 'york', description: 'Meta: intereses, lookalikes, exclusiones.', outputs: ['Audiencia'] },
            { name: 'Creativos', agentId: 'york', description: 'Sube creativos de Edison + copy Atlas.', outputs: ['Ads config'] },
            { name: 'Presupuesto', agentId: 'york', description: 'Budget, bid strategy, schedule.', outputs: ['Budget set'] },
            { name: 'Lanzar', agentId: 'york', description: 'Activa campaña. Notifica Telegram.', outputs: ['Activa', 'Notificación'] },
        ],
    },
];
