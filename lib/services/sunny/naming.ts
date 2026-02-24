"use client";

import { format } from 'date-fns';

export interface NamingVariables {
    country: string;
    strategy: 'CBO' | 'ABO' | 'ASC';
    product: string;
    buyer: string;
    date: Date;
}

/**
 * Available tags for dynamic naming convention.
 * Users can build a custom template like: "[País] - [Estrategia] - [Producto] - [Fecha]"
 */
export const NAMING_TAGS = [
    { tag: '[País]', description: 'País de la tienda (ej: COLOMBIA)' },
    { tag: '[Estrategia]', description: 'Tipo: CBO, ABO, ASC' },
    { tag: '[Producto]', description: 'Nombre del producto' },
    { tag: '[Fecha]', description: 'Fecha dd/MM' },
] as const;

export const DEFAULT_NAMING_TEMPLATE = '[País] - [Estrategia] - [Producto] - [Fecha]';

/**
 * Generate campaign name from a template with dynamic tags.
 * Template example: "[País] - [Estrategia] - [Producto] - [Fecha]"
 */
export function generateCampaignName(vars: NamingVariables, template?: string): string {
    const { country, strategy, product, date } = vars;
    const tpl = template || DEFAULT_NAMING_TEMPLATE;

    const formattedDate = format(date, 'dd/MM');
    const cleanProduct = product.trim().toUpperCase();
    const cleanCountry = country.trim().toUpperCase();

    return tpl
        .replace(/\[País\]/g, cleanCountry)
        .replace(/\[Estrategia\]/g, strategy)
        .replace(/\[Producto\]/g, cleanProduct)
        .replace(/\[Fecha\]/g, formattedDate);
}

export function parseCampaignName(name: string): Partial<NamingVariables> | null {
    const regex = /^(.*?)\s-\s(CBO|ABO|ASC)\s-\s(.*?)\s-\s(\d{2}\/\d{2})$/;
    const match = name.match(regex);

    if (!match) return null;

    return {
        country: match[1],
        strategy: match[2] as 'CBO' | 'ABO' | 'ASC',
        product: match[3],
    };
}
