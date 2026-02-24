"use client";

/**
 * Vega AI Service - Real copywriting assistant for Módulo Sunny
 * Calls /api/sunny/generate-copy which uses Gemini/OpenAI
 */

import { authFetch } from '@/lib/api/client';

export interface VegaAIRequest {
    product: string;
    target: string;
    style?: string;
    destinationLink?: string;
}

export interface VegaAIResult {
    title: string;
    description: string;
    copies: string[];
}

export async function generateCopy(req: VegaAIRequest): Promise<VegaAIResult> {
    const { product, target, destinationLink } = req;

    const response = await authFetch('/api/sunny/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            product,
            country: target,
            destinationUrl: destinationLink
        })
    });

    if (!response.ok) {
        const error = await response.json().catch(() => ({ error: 'Unknown error' }));
        throw new Error(error.error || `API error: ${response.status}`);
    }

    const data = await response.json();
    return {
        title: data.title || '',
        description: data.description || '',
        copies: data.copies || []
    };
}
