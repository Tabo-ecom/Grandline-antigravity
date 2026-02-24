import { auth } from '@/lib/firebase/config';

/**
 * Returns Authorization headers with the current user's Firebase ID token.
 * Use this in all fetch calls to authenticated API routes.
 */
export async function getAuthHeaders(): Promise<Record<string, string>> {
    const token = await auth.currentUser?.getIdToken();
    if (!token) return {};
    return { 'Authorization': `Bearer ${token}` };
}

/**
 * Authenticated fetch wrapper — automatically includes Firebase ID token.
 */
export async function authFetch(url: string, options: RequestInit = {}): Promise<Response> {
    const authHeaders = await getAuthHeaders();
    const headers = new Headers(options.headers);

    if (authHeaders.Authorization) {
        headers.set('Authorization', authHeaders.Authorization);
    }

    return fetch(url, { ...options, headers });
}
