const MELI_API = 'https://api.mercadolibre.com';
const MELI_AUTH = 'https://auth.mercadolibre.com.co';

// ─── Types ───

export interface MeliTokens {
    access_token: string;
    refresh_token: string;
    user_id: number;
    expires_at: number; // timestamp when access_token expires
}

export interface MeliOrder {
    id: number;
    status: string; // paid, cancelled, etc.
    date_created: string;
    total_amount: number;
    currency_id: string;
    buyer: { id: number; nickname: string; first_name: string; last_name: string };
    order_items: {
        item: { id: string; title: string; seller_custom_field: string | null };
        quantity: number;
        unit_price: number;
    }[];
    payments: { id: number; total_paid_amount: number; marketplace_fee: number; status: string }[];
    shipping: { id: number; status: string };
    tags: string[];
}

export interface MeliItem {
    id: string;
    title: string;
    price: number;
    available_quantity: number;
    sold_quantity: number;
    thumbnail: string;
    permalink: string;
    status: string;
    category_id: string;
}

export interface MeliUserInfo {
    id: number;
    nickname: string;
    first_name: string;
    last_name: string;
    email: string;
    seller_reputation: {
        level_id: string;
        transactions: { total: number; completed: number; canceled: number };
    };
}

// ─── OAuth ───

export function getMeliAuthUrl(): string {
    const appId = process.env.MELI_APP_ID || process.env.NEXT_PUBLIC_MELI_APP_ID || '';
    const redirectUri = process.env.MELI_REDIRECT_URI || '';
    return `${MELI_AUTH}/authorization?response_type=code&client_id=${appId}&redirect_uri=${encodeURIComponent(redirectUri)}`;
}

export async function exchangeCodeForTokens(code: string): Promise<MeliTokens> {
    const res = await fetch(`${MELI_API}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
            grant_type: 'authorization_code',
            client_id: process.env.MELI_APP_ID || '',
            client_secret: process.env.MELI_CLIENT_SECRET || '',
            code,
            redirect_uri: process.env.MELI_REDIRECT_URI || '',
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || data.error || 'MeLi OAuth failed');
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_id: data.user_id,
        expires_at: Date.now() + (data.expires_in * 1000),
    };
}

export async function refreshAccessToken(refreshToken: string): Promise<MeliTokens> {
    const res = await fetch(`${MELI_API}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded', Accept: 'application/json' },
        body: new URLSearchParams({
            grant_type: 'refresh_token',
            client_id: process.env.MELI_APP_ID || '',
            client_secret: process.env.MELI_CLIENT_SECRET || '',
            refresh_token: refreshToken,
        }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.message || 'MeLi refresh failed');
    return {
        access_token: data.access_token,
        refresh_token: data.refresh_token,
        user_id: data.user_id,
        expires_at: Date.now() + (data.expires_in * 1000),
    };
}

// ─── API Helpers ───

async function meliFetch<T>(path: string, accessToken: string): Promise<T> {
    const res = await fetch(`${MELI_API}${path}`, {
        headers: { Authorization: `Bearer ${accessToken}` },
    });
    if (!res.ok) {
        const err = await res.text();
        throw new Error(`MeLi ${res.status}: ${err}`);
    }
    return res.json();
}

export async function getMeliUser(accessToken: string): Promise<MeliUserInfo> {
    return meliFetch('/users/me', accessToken);
}

export async function getMeliOrders(accessToken: string, sellerId: number, params?: {
    dateFrom?: string; dateTo?: string; status?: string; limit?: number; offset?: number;
}): Promise<{ results: MeliOrder[]; paging: { total: number; offset: number; limit: number } }> {
    const qs = new URLSearchParams();
    qs.set('seller', String(sellerId));
    qs.set('sort', 'date_desc');
    qs.set('limit', String(params?.limit || 50));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.status) qs.set('order.status', params.status);
    if (params?.dateFrom) qs.set('order.date_created.from', params.dateFrom);
    if (params?.dateTo) qs.set('order.date_created.to', params.dateTo);
    return meliFetch(`/orders/search?${qs.toString()}`, accessToken);
}

export async function getMeliItems(accessToken: string, userId: number, params?: {
    limit?: number; offset?: number; status?: string;
}): Promise<{ results: string[]; paging: { total: number } }> {
    const qs = new URLSearchParams();
    if (params?.limit) qs.set('limit', String(params.limit));
    if (params?.offset) qs.set('offset', String(params.offset));
    if (params?.status) qs.set('status', params.status);
    return meliFetch(`/users/${userId}/items/search?${qs.toString()}`, accessToken);
}

export async function getMeliItem(accessToken: string, itemId: string): Promise<MeliItem> {
    return meliFetch(`/items/${itemId}`, accessToken);
}

export async function getMeliShipment(accessToken: string, shipmentId: number): Promise<any> {
    return meliFetch(`/shipments/${shipmentId}`, accessToken);
}

export async function getMeliQuestions(accessToken: string, sellerId: number, status = 'UNANSWERED'): Promise<any> {
    return meliFetch(`/questions/search?seller_id=${sellerId}&status=${status}&sort_fields=date_created&sort_types=DESC`, accessToken);
}
