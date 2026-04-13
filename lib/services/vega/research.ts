import { callAIRaw } from './gemini';
import type { ResearchReport } from '../vega';

// ── Scraping ────────────────────────────────────────────────────────────────

function cleanHtml(html: string): string {
    return html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
        .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
        .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
        .replace(/<!--[\s\S]*?-->/g, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&#\d+;/g, '')
        .replace(/\s+/g, ' ')
        .trim();
}

interface ShopifyScrapeResult { text: string; images: string[]; }

async function tryShopifyJson(url: string): Promise<ShopifyScrapeResult | null> {
    try {
        const jsonUrl = url.replace(/\/?(\?.*)?$/, '.json');
        const res = await fetch(jsonUrl, { headers: { 'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json' }, signal: AbortSignal.timeout(10000) });
        if (!res.ok) return null;
        const data = await res.json();
        const p = data.product;
        if (!p) return null;
        const desc = cleanHtml(p.body_html || '');
        const variants = (p.variants || []).map((v: any) => `${v.title}: $${v.price} ${v.price_currency || 'COP'}`).join(', ');
        const images = (p.images || []).slice(0, 3).map((img: any) => img.src);
        const text = `PRODUCTO SHOPIFY: ${p.title}. Vendor: ${p.vendor}. Tipo: ${p.product_type}. Precio: ${variants}. Tags: ${p.tags || ''}. Descripcion: ${desc}`.slice(0, 3000);
        return { text, images };
    } catch { return null; }
}

export async function scrapeUrl(url: string): Promise<{ text: string; images: string[] }> {
    try {
        if (url.includes('/products/') && !url.includes('amazon.') && !url.includes('aliexpress.')) {
            const shopifyData = await tryShopifyJson(url);
            if (shopifyData) return shopifyData;
        }
        const res = await fetch(url, {
            headers: { 'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36', 'Accept': 'text/html', 'Accept-Language': 'es-CO,es;q=0.9' },
            signal: AbortSignal.timeout(15000),
        });
        if (!res.ok) return { text: `[No se pudo acceder - HTTP ${res.status}]`, images: [] };
        const html = await res.text();
        // Extract PRODUCT images only — strict filtering
        const imgMatches = html.match(/https?:\/\/[^"'\s]+\.(?:jpg|jpeg|png|webp)/gi) || [];
        const productImages = [...new Set(imgMatches)].filter(img => {
            const lower = img.toLowerCase();
            // Exclude Amazon/platform UI elements
            if (lower.includes('icon') || lower.includes('logo') || lower.includes('sprite')) return false;
            if (lower.includes('favicon') || lower.includes('badge') || lower.includes('flag')) return false;
            if (lower.includes('btn') || lower.includes('button') || lower.includes('arrow')) return false;
            if (lower.includes('1x1') || lower.includes('pixel') || lower.includes('tracking')) return false;
            if (lower.includes('svg') || lower.includes('gif')) return false;
            if (lower.includes('amazon.com') && !lower.includes('/images/I/')) return false; // Only Amazon product images
            if (lower.includes('prime') || lower.includes('fresh') || lower.includes('banner')) return false;
            if (lower.includes('ssl-images-amazon') && lower.includes('G/01')) return false; // Amazon UI sprites
            if (lower.includes('m.media-amazon.com/images/G/')) return false; // Amazon site images
            if (img.length < 60) return false;
            // Prefer CDN product images
            if (lower.includes('m.media-amazon.com/images/I/')) return true; // Amazon product images OK
            if (lower.includes('cdn.shopify.com')) return true;
            return true;
        }).slice(0, 3);
        return { text: cleanHtml(html).slice(0, 3000), images: productImages };
    } catch (error: any) {
        return { text: `[Error: ${error.message || 'timeout'}]`, images: [] };
    }
}

// ── JSON Fixer ──────────────────────────────────────────────────────────────

function fixLLMJson(raw: string): string {
    let s = raw.trim();
    s = s.replace(/```json\s*/gi, '').replace(/```\s*/gi, '');
    const start = s.indexOf('{');
    const end = s.lastIndexOf('}');
    if (start === -1 || end === -1) throw new Error('No JSON found');
    s = s.slice(start, end + 1);
    let result = '';
    let inStr = false;
    let esc = false;
    for (let i = 0; i < s.length; i++) {
        const c = s[i];
        if (esc) { result += c; esc = false; continue; }
        if (c === '\\') { result += c; esc = true; continue; }
        if (c === '"') { inStr = !inStr; result += c; continue; }
        if (inStr && (c === '\n' || c === '\r' || c === '\t')) { result += ' '; continue; }
        result += c;
    }
    result = result.replace(/,\s*([}\]])/g, '$1');
    return result;
}

function safeParseJSON(text: string): any {
    const fixed = fixLLMJson(text);
    try {
        return JSON.parse(fixed);
    } catch (e1) {
        // Try removing the last incomplete property and closing
        const lastComma = fixed.lastIndexOf(',');
        if (lastComma > 0) {
            const truncated = fixed.slice(0, lastComma) + '}';
            try { return JSON.parse(truncated); } catch {}
            // Try closing arrays/objects
            let attempt = fixed.slice(0, lastComma);
            const openBraces = (attempt.match(/\{/g) || []).length - (attempt.match(/\}/g) || []).length;
            const openBrackets = (attempt.match(/\[/g) || []).length - (attempt.match(/\]/g) || []).length;
            attempt += ']'.repeat(Math.max(0, openBrackets)) + '}'.repeat(Math.max(0, openBraces));
            try { return JSON.parse(attempt); } catch {}
        }
        console.error('All JSON parse attempts failed. First 800 chars:', fixed.slice(0, 800));
        throw new Error('Error parseando respuesta de IA. Intenta de nuevo.');
    }
}

// ── Prompts (Split into 2 calls for reliability) ────────────────────────────

function buildPrompt1(productName: string, content: string, country: string): string {
    return `Eres el mejor analista de productos para dropshipping COD. Analiza para el mercado de ${country}.

PRODUCTO: ${productName}
PAIS OBJETIVO: ${country}
DATOS DEL PRODUCTO: ${content}

Responde SOLO con JSON valido. Strings en UNA linea.

{"summary":"Resumen viabilidad 2 oraciones","demand":"Analisis demanda en ${country} 3 oraciones","competition":"Analisis competencia en ${country} 3 oraciones","competitors":[{"name":"Competidor real 1","url":"https://url-real.com","priceRange":"$X-$Y","strengths":"Fortaleza","weaknesses":"Debilidad","adStatus":"X ads activos en Meta"}],"usBrands":[{"name":"Marca USA lider","url":"https://url-real.com","description":"Por que lideran y cuanto facturan"}],"amazonBestSeller":{"title":"Nombre del producto mas vendido en Amazon en esta categoria","url":"https://amazon.com/dp/REAL","price":"$X.XX USD","rating":"4.X de 5","whyBest":"Por que es el mas vendido"},"redditInsights":{"subreddit":"r/subreddit_real","summary":"Lo mas discutido sobre este tipo de producto","topPains":["Queja 1","Queja 2","Queja 3","Queja 4","Queja 5"],"topLoves":["Lo que mas les gusta 1","Lo que aman 2","Lo positivo 3","Beneficio favorito 4","Lo que recomiendan 5"]},"keywords":["kw1","kw2","kw3","kw4","kw5","kw6","kw7","kw8","kw9","kw10","kw11","kw12","kw13","kw14","kw15","kw16","kw17","kw18","kw19","kw20"],"unitEconomics":{"costProduct":"$X USD","suggestedPrice":"$XX,000 COP","estimatedCPA":"$X,000 COP","projectedMargin":"X%","minROAS":"X.X"},"saturationLevel":"low","trendPhase":"growth","recommendation":"GO","targetAudience":"Publico objetivo en ${country}","painPoints":["Pain 1","Pain 2","Pain 3","Pain 4","Pain 5"],"adAngles":["Angulo creativo 1","Angulo 2","Angulo 3","Angulo 4","Angulo 5"]}

REGLAS: 3 competidores REALES con URLs reales de tiendas que vendan esto en ${country}. 3 marcas USA REALES lideres. Amazon best seller REAL de esta categoria. Reddit: 5 quejas Y 5 cosas que aman. 20 keywords reales. URLs deben existir.
saturationLevel=low/medium/high. trendPhase=emergent/growth/peak/decline/dead. recommendation=GO/NO_GO/INVESTIGATE.`;
}

function buildPrompt2(productName: string, content: string, country: string): string {
    return `Eres experto en buyer personas para e-commerce en ${country}.

PRODUCTO: ${productName}
PAIS: ${country}
DATOS: ${content}

Responde SOLO con JSON valido. Strings en UNA linea.

{"buyerPersona":{"name":"Nombre ficticio tipico de ${country}","age":"25-35","gender":"Mujer","occupation":"Ocupacion comun en ${country}","income":"Ingreso mensual en moneda local","location":"Ciudad principal de ${country}","painPoints":["Dolor 1","Dolor 2","Dolor 3"],"desires":["Deseo 1","Deseo 2","Deseo 3"],"objections":["Objecion 1","Objecion 2","Objecion 3"],"platforms":["Instagram","TikTok","Facebook"],"buyingTriggers":["Trigger 1","Trigger 2","Trigger 3"],"phrase":"Frase en espanol que diria el comprador"},"scorecard":{"wowFactor":8,"solvesProblem":7,"impulsePrice":9,"goodMargins":7,"notInRetail":8,"easyToShip":9,"videoFriendly":8,"total":8.0}}

Criterios 1-10: wowFactor(viral), solvesProblem(dolor real), impulsePrice($15-80 USD), goodMargins(3x-5x), notInRetail(no en tiendas locales), easyToShip(ligero), videoFriendly(demo visual). total=promedio de los 7.`;
}

function buildPrompt3(productName: string, content: string, country: string): string {
    return `Eres experto en guiones publicitarios y ofertas irresistibles para e-commerce COD en ${country}.
Usa el framework Hook-Body-CTA y el Grand Slam Offer de Alex Hormozi.

PRODUCTO: ${productName}
PAIS: ${country}
DATOS: ${content}

Responde SOLO con JSON valido. Strings en UNA linea.

{"adScripts":[{"angle":"Angulo de venta 1","hook":"Hook de 3 segundos que atrapa atencion","body":"Cuerpo del guion 2-3 oraciones que genera deseo","cta":"Llamado a accion final"},{"angle":"Angulo 2","hook":"Hook 2","body":"Cuerpo 2","cta":"CTA 2"},{"angle":"Angulo 3","hook":"Hook 3","body":"Cuerpo 3","cta":"CTA 3"},{"angle":"Angulo 4","hook":"Hook 4","body":"Cuerpo 4","cta":"CTA 4"},{"angle":"Angulo 5","hook":"Hook 5","body":"Cuerpo 5","cta":"CTA 5"}],"offerSuggestions":[{"name":"Nombre oferta","description":"Como funciona la oferta","type":"bundle"},{"name":"Oferta 2","description":"Descripcion","type":"gift"},{"name":"Oferta 3","description":"Descripcion","type":"guarantee"},{"name":"Oferta 4","description":"Descripcion","type":"discount"},{"name":"Oferta 5","description":"Descripcion","type":"urgency"}]}

GUIONES: 5 guiones diferentes con hooks impactantes (problema, curiosidad, resultado, controversia, social proof). Body genera deseo. CTA claro.
OFERTAS: 5 ofertas tipo bundle/gift/guarantee/discount/urgency/guide/bonus. Inspirate en competidores exitosos.`;
}

// ── Parse ────────────────────────────────────────────────────────────────────

function defaults(): ResearchReport {
    return {
        summary: '', demand: '', competition: '',
        competitors: [], usBrands: [],
        redditInsights: { subreddit: '', summary: '', topPains: [], topLoves: [] },
        amazonBestSeller: { title: '', url: '', price: '', rating: '', whyBest: '' },
        keywords: [],
        buyerPersona: { name: '', age: '', gender: '', occupation: '', income: '', location: '', painPoints: [], desires: [], objections: [], platforms: [], buyingTriggers: [], phrase: '' },
        unitEconomics: { costProduct: '—', suggestedPrice: '—', estimatedCPA: '—', projectedMargin: '—', minROAS: '—' },
        scorecard: { wowFactor: 5, solvesProblem: 5, impulsePrice: 5, goodMargins: 5, notInRetail: 5, easyToShip: 5, videoFriendly: 5, total: 5 },
        saturationLevel: 'medium', trendPhase: 'growth', recommendation: 'INVESTIGATE',
        targetAudience: '', painPoints: [], adAngles: [],
        adScripts: [], offerSuggestions: [],
    };
}

function mergeReport(p1: any, p2: any, p3: any = {}): ResearchReport {
    const d = defaults();
    return {
        summary: p1?.summary || d.summary,
        demand: p1?.demand || d.demand,
        competition: p1?.competition || d.competition,
        competitors: Array.isArray(p1?.competitors) ? p1.competitors.map((c: any) => ({
            name: c.name || '', url: c.url || '', priceRange: c.priceRange || '', strengths: c.strengths || '', weaknesses: c.weaknesses || '', adStatus: c.adStatus || '',
        })) : d.competitors,
        usBrands: Array.isArray(p1?.usBrands) ? p1.usBrands.map((b: any) => ({
            name: b.name || '', url: b.url || '', description: b.description || '',
        })) : d.usBrands,
        redditInsights: {
            subreddit: p1?.redditInsights?.subreddit || '',
            summary: p1?.redditInsights?.summary || '',
            topPains: Array.isArray(p1?.redditInsights?.topPains) ? p1.redditInsights.topPains : [],
            topLoves: Array.isArray(p1?.redditInsights?.topLoves) ? p1.redditInsights.topLoves : [],
        },
        amazonBestSeller: {
            title: p1?.amazonBestSeller?.title || '',
            url: p1?.amazonBestSeller?.url || '',
            price: p1?.amazonBestSeller?.price || '',
            rating: p1?.amazonBestSeller?.rating || '',
            whyBest: p1?.amazonBestSeller?.whyBest || '',
        },
        keywords: Array.isArray(p1?.keywords) ? p1.keywords.slice(0, 20) : d.keywords,
        buyerPersona: {
            name: p2?.buyerPersona?.name || '', age: p2?.buyerPersona?.age || '', gender: p2?.buyerPersona?.gender || '',
            occupation: p2?.buyerPersona?.occupation || '', income: p2?.buyerPersona?.income || '', location: p2?.buyerPersona?.location || '',
            painPoints: Array.isArray(p2?.buyerPersona?.painPoints) ? p2.buyerPersona.painPoints : [],
            desires: Array.isArray(p2?.buyerPersona?.desires) ? p2.buyerPersona.desires : [],
            objections: Array.isArray(p2?.buyerPersona?.objections) ? p2.buyerPersona.objections : [],
            platforms: Array.isArray(p2?.buyerPersona?.platforms) ? p2.buyerPersona.platforms : [],
            buyingTriggers: Array.isArray(p2?.buyerPersona?.buyingTriggers) ? p2.buyerPersona.buyingTriggers : [],
            phrase: p2?.buyerPersona?.phrase || '',
        },
        unitEconomics: {
            costProduct: p1?.unitEconomics?.costProduct || d.unitEconomics.costProduct,
            suggestedPrice: p1?.unitEconomics?.suggestedPrice || d.unitEconomics.suggestedPrice,
            estimatedCPA: p1?.unitEconomics?.estimatedCPA || d.unitEconomics.estimatedCPA,
            projectedMargin: p1?.unitEconomics?.projectedMargin || d.unitEconomics.projectedMargin,
            minROAS: p1?.unitEconomics?.minROAS || d.unitEconomics.minROAS,
        },
        scorecard: {
            wowFactor: Number(p2?.scorecard?.wowFactor) || 5,
            solvesProblem: Number(p2?.scorecard?.solvesProblem) || 5,
            impulsePrice: Number(p2?.scorecard?.impulsePrice) || 5,
            goodMargins: Number(p2?.scorecard?.goodMargins) || 5,
            notInRetail: Number(p2?.scorecard?.notInRetail) || 5,
            easyToShip: Number(p2?.scorecard?.easyToShip) || 5,
            videoFriendly: Number(p2?.scorecard?.videoFriendly) || 5,
            total: Number(p2?.scorecard?.total) || 5,
        },
        saturationLevel: (['low', 'medium', 'high'].includes(p1?.saturationLevel) ? p1.saturationLevel : 'medium') as any,
        trendPhase: (['emergent', 'growth', 'peak', 'decline', 'dead'].includes(p1?.trendPhase) ? p1.trendPhase : 'growth') as any,
        recommendation: (['GO', 'NO_GO', 'INVESTIGATE'].includes(p1?.recommendation) ? p1.recommendation : 'INVESTIGATE') as any,
        targetAudience: p1?.targetAudience || '',
        painPoints: Array.isArray(p1?.painPoints) ? p1.painPoints : [],
        adAngles: Array.isArray(p1?.adAngles) ? p1.adAngles : [],
        adScripts: Array.isArray(p3?.adScripts) ? p3.adScripts.map((s: any) => ({
            angle: s.angle || '', hook: s.hook || '', body: s.body || '', cta: s.cta || '',
        })) : [],
        offerSuggestions: Array.isArray(p3?.offerSuggestions) ? p3.offerSuggestions.map((o: any) => ({
            name: o.name || '', description: o.description || '', type: o.type || '',
        })) : [],
    };
}

// ── Main Research Function ──────────────────────────────────────────────────

export async function runResearch(productName: string, referenceUrl: string, productUrl: string, country: string = 'Colombia'): Promise<{
    scrapedData: { reference: string; product: string };
    report: ResearchReport;
    niche: string;
    productImages: string[];
}> {
    // 1. Scrape (both URLs optional — at least one needed)
    const scrapePromises: Promise<{ text: string; images: string[] }>[] = [];
    if (referenceUrl) scrapePromises.push(scrapeUrl(referenceUrl));
    if (productUrl) scrapePromises.push(scrapeUrl(productUrl));
    if (scrapePromises.length === 0) scrapePromises.push(Promise.resolve({ text: `Producto: ${productName}`, images: [] }));

    const results = await Promise.all(scrapePromises);
    const refResult = results[0] || { text: '', images: [] };
    const prodResult = results[1] || refResult;
    const combined = referenceUrl && productUrl
        ? `URL REFERENCIA: ${refResult.text}\n\nURL PRODUCTO: ${prodResult.text}`
        : `DATOS DEL PRODUCTO: ${refResult.text}`;
    // Prioritize Shopify images (clean), then other images
    const allImages = [...refResult.images, ...(prodResult !== refResult ? prodResult.images : [])];
    const productImages = allImages.filter(img => !img.includes('amazon.com/images/G/')).slice(0, 3);

    // 2. Three parallel AI calls (market + persona + scripts/offers)
    const [raw1, raw2, raw3] = await Promise.all([
        callAIRaw(buildPrompt1(productName, combined, country), 'precise'),
        callAIRaw(buildPrompt2(productName, combined, country), 'precise'),
        callAIRaw(buildPrompt3(productName, combined, country), 'precise'),
    ]);

    // 3. Parse all
    const parsed1 = safeParseJSON(raw1);
    const parsed2 = safeParseJSON(raw2);
    let parsed3 = {};
    try { parsed3 = safeParseJSON(raw3); } catch { /* scripts/offers optional */ }

    // 4. Merge
    const report = mergeReport(parsed1, parsed2, parsed3);

    // 5. Detect niche
    const txt = (report.summary + ' ' + report.demand + ' ' + productName).toLowerCase();
    let niche = 'generic';
    if (txt.match(/skincare|piel|facial|serum|mascarilla|colageno|crema/)) niche = 'skincare';
    else if (txt.match(/suplement|vitamina|proteina|creatina|gomita/)) niche = 'supplements';
    else if (txt.match(/beauty|maquillaje|cosmetic/)) niche = 'beauty';
    else if (txt.match(/tech|accesorio|cargador|gadget|cable|luz|led/)) niche = 'tech';
    else if (txt.match(/fitness|ejercicio|gym|banda|yoga/)) niche = 'fitness';

    return { scrapedData: { reference: refResult.text, product: prodResult.text }, report, niche, productImages };
}
