/**
 * Simple in-memory sliding-window rate limiter for Vercel serverless.
 * Limits requests per user (by uid) per endpoint.
 *
 * NOTE: This is per-instance — on Vercel each cold start gets its own Map.
 * For stricter enforcement, upgrade to Upstash Redis (@upstash/ratelimit).
 */

import { NextResponse } from 'next/server';

interface RateLimitEntry {
    timestamps: number[];
}

const store = new Map<string, RateLimitEntry>();

// Cleanup stale entries every 5 minutes
const CLEANUP_INTERVAL = 5 * 60 * 1000;
let lastCleanup = Date.now();

function cleanup(windowMs: number) {
    const now = Date.now();
    if (now - lastCleanup < CLEANUP_INTERVAL) return;
    lastCleanup = now;

    for (const [key, entry] of store) {
        entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);
        if (entry.timestamps.length === 0) store.delete(key);
    }
}

interface RateLimitOptions {
    /** Max requests allowed in the window */
    max: number;
    /** Window size in milliseconds (default: 60_000 = 1 min) */
    windowMs?: number;
}

interface RateLimitResult {
    success: boolean;
    remaining: number;
}

/**
 * Check rate limit for a given key (typically `uid:endpoint`).
 * Returns { success: true } if under limit, { success: false } if exceeded.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): RateLimitResult {
    const { max, windowMs = 60_000 } = options;
    const now = Date.now();

    cleanup(windowMs);

    let entry = store.get(key);
    if (!entry) {
        entry = { timestamps: [] };
        store.set(key, entry);
    }

    // Remove timestamps outside the window
    entry.timestamps = entry.timestamps.filter(t => now - t < windowMs);

    if (entry.timestamps.length >= max) {
        return { success: false, remaining: 0 };
    }

    entry.timestamps.push(now);
    return { success: true, remaining: max - entry.timestamps.length };
}

/**
 * Returns a 429 JSON response.
 */
export function rateLimitResponse() {
    return NextResponse.json(
        { error: 'Demasiadas solicitudes. Intenta de nuevo en un momento.' },
        { status: 429 }
    );
}
