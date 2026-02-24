
import { ExtendedDropiOrder } from '../hooks/useDashboardData';
import { CampaignMapping } from './marketing';
import { ProductGroup } from './productGroups';

/**
 * Heuristic to extract a potential product name from a campaign string
 */
export function guessNameFromCampaign(campaignName: string): string {
    if (!campaignName) return '';

    // Remove common prefixes
    let name = campaignName
        .replace(/^(CO|EC|GT|PA|PE|CL|MX|ES|US|BR|AR|BO)[- ]/i, '') // Country codes
        .replace(/^(FB|TT|GG|IG)[- ]/i, '') // Platforms
        .replace(/^(PROSPECTING|REMARKETING|PURCHASE|CONVERSION)[- ]/i, '') // Funnel steps
        .replace(/[_-]/g, ' ') // Separators
        .trim();

    // If it contains a numeric ID at the end, clean it
    name = name.replace(/\s+\d+$/, '').trim();

    // Capitalize properly
    return name.charAt(0).toUpperCase() + name.slice(1).toLowerCase();
}

/**
 * Resolves a display name for a given product ID using all available data sources
 */
export function resolveProductName(
    pId: string,
    rawOrders: ExtendedDropiOrder[],
    mappings: CampaignMapping[],
    productGroups: ProductGroup[]
): string {
    if (!pId || pId === 'unknown' || pId === 'global') return pId;

    // 1. Check Product Groups first
    const group = productGroups.find(g => g.id === pId);
    if (group) return group.name;

    // 2. Check Order History for matching ID
    const orderMatch = rawOrders.find(o => o.PRODUCTO_ID?.toString() === pId);
    if (orderMatch && orderMatch.PRODUCTO) return orderMatch.PRODUCTO;

    // 3. Check Campaign Mappings for clues
    // If a campaign is mapped to this ID, maybe the campaign name has a clue
    const mappingMatch = mappings.find(m => m.productId === pId);
    if (mappingMatch) {
        return guessNameFromCampaign(mappingMatch.campaignName) || pId;
    }

    return pId;
}

/**
 * Built-in dictionary to help resolve common IDs if known (Optional fallback)
 */
const KNOWN_ID_FALLBACKS: Record<string, string> = {
    '1536609': 'Parche para cicatriz de silicona',
    '1929759': 'Botox de Veneno de abeja',
    '64363': 'Cera Carro',
};

export function getResolvedLabel(pId: string, orders: ExtendedDropiOrder[], mappings: CampaignMapping[], groups: ProductGroup[]): string {
    const resolved = resolveProductName(pId, orders, mappings, groups);
    if (resolved === pId && KNOWN_ID_FALLBACKS[pId]) {
        return KNOWN_ID_FALLBACKS[pId];
    }
    return resolved;
}
