import { authFetch } from '@/lib/api/client';

// ── Types ───────────────────────────────────────────────────────────────────

export interface PipelineStore {
    key: string;
    name: string;
    url: string;
    default_niche: string;
    has_token: boolean;
}

export type Niche = 'supplements' | 'skincare' | 'beauty' | 'generic';
export type Provider = 'gemini' | 'openai';
export type JobStatus = 'pending' | 'running' | 'completed' | 'failed';
export type CreativeFormat = 'feed_4x5' | 'story_9x16';

export interface JobResponse {
    job_id: string;
    status: string;
    poll_url: string;
}

export interface JobPoll {
    job_id: string;
    status: JobStatus;
    job_type: string;
    progress: string;
    result: any;
    error: string | null;
    files: string[] | null;
    created_at: string;
    completed_at: string | null;
}

export interface CreativesParams {
    image_base64: string;
    image_filename: string;
    niche: Niche;
    provider: Provider;
    limit: number;
    formats: CreativeFormat[] | null;
    workers: number;
}

export interface PipelineParams {
    url: string;
    store: string;
    niche?: Niche;
    image_base64?: string | null;
    image_filename?: string | null;
    status?: 'draft' | 'active';
    research_data?: any;
}

export interface CopyParams {
    url: string;
    niche: Niche;
}

export interface ImagesParams {
    image_base64: string;
    image_filename: string;
    niche: Niche;
}

export interface CopyResult {
    title: string;
    tagline: string;
    short_description: string;
    long_description: string;
    key_benefits: string[];
    how_to_use: string;
    faq: { question: string; answer: string }[];
    meta_title: string;
    meta_description: string;
}

// ── Constants ───────────────────────────────────────────────────────────────

export const NICHES: { value: Niche; label: string; desc: string }[] = [
    { value: 'skincare', label: 'Skincare', desc: 'Mascarillas, glass skin, K-beauty' },
    { value: 'supplements', label: 'Suplementos', desc: 'Gomitas, cápsulas, salud' },
    { value: 'beauty', label: 'Beauty', desc: 'Igual a skincare' },
    { value: 'generic', label: 'Genérico', desc: 'Cualquier producto' },
];

export const PROVIDERS: { value: Provider; label: string; desc: string }[] = [
    { value: 'gemini', label: 'Gemini', desc: 'Gratis — Google AI' },
    { value: 'openai', label: 'OpenAI', desc: 'Pago — Mejor calidad' },
];

// ── API Functions ───────────────────────────────────────────────────────────

export async function getStores(): Promise<PipelineStore[]> {
    const res = await authFetch('/api/pipeline/stores');
    if (!res.ok) throw new Error('Error cargando tiendas');
    const data = await res.json();
    return data.stores || [];
}

export async function startCreatives(params: CreativesParams): Promise<JobResponse> {
    const res = await authFetch('/api/pipeline/creatives', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Error iniciando creativos');
    }
    return res.json();
}

export async function startPipeline(params: PipelineParams): Promise<JobResponse> {
    const res = await authFetch('/api/pipeline/create', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Error iniciando pipeline');
    }
    return res.json();
}

export async function startCopy(params: CopyParams): Promise<JobResponse> {
    const res = await authFetch('/api/pipeline/copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Error generando copy');
    }
    return res.json();
}

export async function startImages(params: ImagesParams): Promise<JobResponse> {
    const res = await authFetch('/api/pipeline/images', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(params),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Error generando imágenes');
    }
    return res.json();
}

export async function startAdLibrary(params: { query: string; country: string; limit?: number }): Promise<JobResponse> {
    const res = await authFetch('/api/pipeline/ad-library', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: params.query, country: params.country, limit: params.limit || 10 }),
    });
    if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || err.error || 'Error buscando en Ad Library');
    }
    return res.json();
}

export async function pollJob(jobId: string): Promise<JobPoll> {
    const res = await authFetch(`/api/pipeline/jobs/${jobId}`);
    if (!res.ok) throw new Error('Error consultando job');
    return res.json();
}

export function getFileUrl(jobId: string, filePath: string): string {
    return `/api/pipeline/files/${jobId}/${filePath}`;
}

// ── Helpers ─────────────────────────────────────────────────────────────────

export function fileToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const result = reader.result as string;
            // Remove data URL prefix (data:image/png;base64,)
            const base64 = result.split(',')[1] || result;
            resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
    });
}
