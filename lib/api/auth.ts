import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase/admin';

export interface AuthResult {
    uid: string;
    email?: string;
    /** team_id for shared data access (team_id || uid) */
    teamId: string;
}

/**
 * Verifies the Firebase ID token from the Authorization header.
 * Returns the decoded user info (with team_id resolved) or null if invalid.
 */
export async function verifyAuth(req: NextRequest): Promise<AuthResult | null> {
    if (!adminAuth) return null;

    const authHeader = req.headers.get('Authorization');
    if (!authHeader?.startsWith('Bearer ')) return null;

    try {
        const token = authHeader.split('Bearer ')[1];
        const decoded = await adminAuth.verifyIdToken(token);

        // Resolve team_id from user profile
        let teamId = decoded.uid;
        if (adminDb) {
            try {
                const profileDoc = await adminDb.collection('user_profiles').doc(decoded.uid).get();
                const profileData = profileDoc.data();
                if (profileData?.team_id) {
                    teamId = profileData.team_id;
                }
            } catch {
                // If profile lookup fails, fall back to uid
            }
        }

        return { uid: decoded.uid, email: decoded.email, teamId };
    } catch {
        return null;
    }
}

/**
 * Returns a 401 JSON response for unauthorized requests.
 */
export function unauthorizedResponse() {
    return NextResponse.json({ error: 'No autorizado' }, { status: 401 });
}
