/**
 * AI-powered Campaign to Product Mapper
 * Supports both Gemini AI and ChatGPT
 */

export type AIProvider = 'gemini' | 'openai' | 'none';

export interface AIMapperConfig {
    provider: AIProvider;
    apiKey: string;
}

export interface CampaignInfo {
    name: string;
    platform: 'facebook' | 'tiktok';
    country?: string;
}

export interface ProductInfo {
    id: string;
    name: string;
    country: string;
}

export interface MappingSuggestion {
    campaignName: string;
    suggestedProductId: string;
    suggestedProductCountry?: string; // Added for product country visibility
    confidence: number; // 0-1
    reasoning: string;
}

/**
 * Map campaign to product using Gemini AI
 */
async function mapWithGemini(
    apiKey: string,
    campaign: CampaignInfo,
    availableProducts: ProductInfo[],
    existingMappings?: { campaignName: string, productId: string }[]
): Promise<MappingSuggestion> {
    const prompt = `Actúas como un experto en mapeo de campañas de marketing a productos de un e-commerce.
Tu tarea es analizar el nombre de una campaña publicitaria y encontrar el producto exacto al que pertenece en la tienda.

REGLAS ESTRICTAS DE MAPEO:
1. **PAÍS PRIMERO**: El país de la campaña DEBE COINCIDIR con el país del producto. 
   - Busca códigos como "CO" (Colombia), "EC" (Ecuador), "GT" (Guatemala), "PA" (Panamá) al inicio del nombre de la campaña.
   - Si no hay código en el nombre, usa el "País detectado".
   - **NUNCA** sugieras un producto de un país diferente al de la campaña. Es preferible un nivel de confianza más bajo a un país equivocado.
2. **COINCIDENCIA EXACTA**: Si el nombre de la campaña contiene exactamente el nombre del producto o gran parte del mismo (ej: campaña "CO_Trinchete" y producto "Trinchete"), esta es la señal más fuerte. Prioriza esto por encima de todo.
3. **SIMILITUD DE NOMBRE**: Busca palabras clave comunes entre el nombre de la campaña y el nombre del producto (ej. "CREMA", "REDUCTORA", "SHAMPOO").
4. **TESTEOS**: Si la campaña contiene la palabra "TEST" o "TESTEO", busca el producto que se está testeando.
${existingMappings && existingMappings.length > 0 ? `\nEjemplos históricos de campañas mapeadas correctamente:\n${existingMappings.slice(0, 15).map(m => `- Campaña: "${m.campaignName}" -> Producto ID: "${m.productId}"`).join('\n')}\n` : ''}
Campaña a analizar:
- Nombre: "${campaign.name}"
- Plataforma: ${campaign.platform}
- País detectado (Contexto): ${campaign.country || 'No especificado'}

Lista de Productos Disponibles:
${availableProducts.map(p => `[ID: ${p.id}] - Nombre: "${p.name}" - País: ${p.country}`).join('\n')}

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin comentarios ni formato Markdown extra.
Estructura esperada:
{
  "productId": "El ID exacto del producto de la lista que mejor encaja",
  "confidence": Un número entre 0.0 y 1.0 indicando qué tan seguro estás, penalizando si las palabras clave divergen mucho aunque el país coincida,
  "reasoning": "Breve explicación de por qué elegiste este producto, mencionando la coincidencia de país y palabras clave."
}`;

    try {
        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${apiKey}`,
            {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }],
                    generationConfig: {
                        temperature: 0.3,
                        maxOutputTokens: 300,
                    }
                })
            }
        );

        if (!response.ok) {
            const errorText = await response.text();
            console.error('Gemini API error response:', errorText);
            throw new Error(`Gemini API error (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();

        // Validate response structure
        if (!data.candidates || !data.candidates[0] || !data.candidates[0].content || !data.candidates[0].content.parts) {
            console.error('Invalid Gemini response structure:', JSON.stringify(data, null, 2));
            throw new Error('Invalid response structure from Gemini API');
        }

        const text = data.candidates[0].content.parts[0].text;

        // Extract JSON from markdown code blocks if present
        let jsonText = text.trim();
        const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || jsonText.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            jsonText = jsonMatch[1];
        }

        // Validate it looks like JSON
        if (!jsonText.startsWith('{')) {
            console.error('Response does not appear to be JSON:', jsonText);
            throw new Error('AI response is not valid JSON format');
        }

        let result;
        try {
            result = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Failed to parse text:', jsonText);
            throw new Error(`Failed to parse Gemini response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        const matchedProduct = availableProducts.find(p => p.id === (result.productId || availableProducts[0]?.id));
        return {
            campaignName: campaign.name,
            suggestedProductId: result.productId || availableProducts[0]?.id || 'global',
            suggestedProductCountry: matchedProduct?.country,
            confidence: result.confidence || 0.5,
            reasoning: result.reasoning || 'Auto-mapped by AI'
        };
    } catch (error) {
        console.error('Error mapping with Gemini:', error);
        // Fallback to first product
        return {
            campaignName: campaign.name,
            suggestedProductId: availableProducts[0]?.id || 'global',
            suggestedProductCountry: availableProducts[0]?.country,
            confidence: 0.3,
            reasoning: `Fallback mapping due to AI error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

/**
 * Map campaign to product using OpenAI ChatGPT
 */
async function mapWithOpenAI(
    apiKey: string,
    campaign: CampaignInfo,
    availableProducts: ProductInfo[],
    existingMappings?: { campaignName: string, productId: string }[]
): Promise<MappingSuggestion> {
    const prompt = `Actúas como un experto en mapeo de campañas de marketing a productos de un e-commerce.
Tu tarea es analizar el nombre de una campaña publicitaria y encontrar el producto exacto al que pertenece en la tienda.

REGLAS ESTRICTAS DE MAPEO:
1. **PAÍS PRIMERO**: El país de la campaña DEBE COINCIDIR con el país del producto. 
   - Busca códigos como "CO" (Colombia), "EC" (Ecuador), "GT" (Guatemala), "PA" (Panamá) al inicio del nombre de la campaña.
   - Si no hay código en el nombre, usa el "País detectado".
   - **NUNCA** sugieras un producto de un país diferente al de la campaña. Es preferible un nivel de confianza más bajo a un país equivocado.
2. **COINCIDENCIA EXACTA**: Si el nombre de la campaña contiene exactamente el nombre del producto o gran parte del mismo (ej: campaña "CO_Trinchete" y producto "Trinchete"), esta es la señal más fuerte. Prioriza esto por encima de todo.
3. **SIMILITUD DE NOMBRE**: Busca palabras clave comunes entre el nombre de la campaña y el nombre del producto (ej. "CREMA", "REDUCTORA", "SHAMPOO").
4. **TESTEOS**: Si la campaña contiene la palabra "TEST" o "TESTEO", busca el producto que se está testeando.
${existingMappings && existingMappings.length > 0 ? `\nEjemplos históricos de campañas mapeadas correctamente:\n${existingMappings.slice(0, 15).map(m => `- Campaña: "${m.campaignName}" -> Producto ID: "${m.productId}"`).join('\n')}\n` : ''}
Campaña a analizar:
- Nombre: "${campaign.name}"
- Plataforma: ${campaign.platform}
- País detectado (Contexto): ${campaign.country || 'No especificado'}

Lista de Productos Disponibles:
${availableProducts.map(p => `[ID: ${p.id}] - Nombre: "${p.name}" - País: ${p.country}`).join('\n')}

IMPORTANTE: Responde ÚNICAMENTE con un objeto JSON válido, sin comentarios ni formato Markdown extra.
Estructura esperada:
{
  "productId": "El ID exacto del producto de la lista que mejor encaja",
  "confidence": Un número entre 0.0 y 1.0 indicando qué tan seguro estás, penalizando si las palabras clave divergen mucho aunque el país coincida,
  "reasoning": "Breve explicación de por qué elegiste este producto, mencionando la coincidencia de país y palabras clave."
}`;

    try {
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`
            },
            body: JSON.stringify({
                model: 'gpt-3.5-turbo',
                messages: [
                    {
                        role: 'system',
                        content: 'Eres un experto en marketing digital y análisis de campañas publicitarias. Respondes siempre en formato JSON válido.'
                    },
                    {
                        role: 'user',
                        content: prompt
                    }
                ],
                temperature: 0.3,
                max_tokens: 200
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error('OpenAI API error response:', errorText);
            throw new Error(`OpenAI API error (${response.status}): ${errorText.substring(0, 200)}`);
        }

        const data = await response.json();

        if (data.error) {
            console.error('OpenAI API returned error:', data.error);
            throw new Error(data.error.message || 'Unknown OpenAI error');
        }

        // Validate response structure
        if (!data.choices || !data.choices[0] || !data.choices[0].message || !data.choices[0].message.content) {
            console.error('Invalid OpenAI response structure:', JSON.stringify(data, null, 2));
            throw new Error('Invalid response structure from OpenAI API');
        }

        const text = data.choices[0].message.content;

        // Extract JSON from markdown code blocks if present
        let jsonText = text.trim();
        const jsonMatch = jsonText.match(/```(?:json)?\s*(\{[\s\S]*?\})\s*```/) || jsonText.match(/(\{[\s\S]*\})/);
        if (jsonMatch) {
            jsonText = jsonMatch[1];
        }

        // Validate it looks like JSON
        if (!jsonText.startsWith('{')) {
            console.error('Response does not appear to be JSON:', jsonText);
            throw new Error('AI response is not valid JSON format');
        }

        let result;
        try {
            result = JSON.parse(jsonText);
        } catch (parseError) {
            console.error('JSON parse error:', parseError);
            console.error('Failed to parse text:', jsonText);
            throw new Error(`Failed to parse OpenAI response: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
        }

        const matchedProduct = availableProducts.find(p => p.id === (result.productId || availableProducts[0]?.id));
        return {
            campaignName: campaign.name,
            suggestedProductId: result.productId || availableProducts[0]?.id || 'global',
            suggestedProductCountry: matchedProduct?.country,
            confidence: result.confidence || 0.5,
            reasoning: result.reasoning || 'Auto-mapped by AI'
        };
    } catch (error) {
        console.error('Error mapping with OpenAI:', error);
        // Fallback to first product
        return {
            campaignName: campaign.name,
            suggestedProductId: availableProducts[0]?.id || 'global',
            suggestedProductCountry: availableProducts[0]?.country,
            confidence: 0.3,
            reasoning: `Fallback mapping due to AI error: ${error instanceof Error ? error.message : 'Unknown error'}`
        };
    }
}

/**
 * Map multiple campaigns to products using AI
 */
export async function mapCampaignsToProducts(
    config: AIMapperConfig,
    campaigns: CampaignInfo[],
    availableProducts: ProductInfo[],
    existingMappings?: { campaignName: string, productId: string }[]
): Promise<MappingSuggestion[]> {
    if (config.provider === 'none' || !config.apiKey) {
        return [];
    }

    const mappingPromises = campaigns.map(campaign => {
        // Step 1: Detect Campaign Country
        let campaignCountryMatch = campaign.country || 'Desconocido';
        const upperName = campaign.name.toUpperCase();
        if (upperName.includes('COLOMBIA') || upperName.includes('CO-') || upperName.startsWith('CO_') || upperName.startsWith('CO ')) campaignCountryMatch = 'Colombia';
        else if (upperName.includes('ECUADOR') || upperName.includes('EC-') || upperName.startsWith('EC_') || upperName.startsWith('EC ')) campaignCountryMatch = 'Ecuador';
        else if (upperName.includes('GUATEMALA') || upperName.includes('GT-') || upperName.startsWith('GT_') || upperName.startsWith('GT ')) campaignCountryMatch = 'Guatemala';
        else if (upperName.includes('PANAMA') || upperName.includes('PA-') || upperName.startsWith('PA_') || upperName.startsWith('PA ')) campaignCountryMatch = 'Panamá';

        // Step 2: Filter products by detected country OR global products
        const filteredProducts = availableProducts.filter(p => {
            if (p.id.toLowerCase().includes('global')) return true;
            if (campaignCountryMatch === 'Desconocido' || campaignCountryMatch === 'Unknown') return true; // Send all if we can't guess
            return p.country === campaignCountryMatch || p.country === 'Desconocido' || p.country === 'Unknown';
        });

        // Ensure we always have at least one product
        const productsToSend = filteredProducts.length > 0 ? filteredProducts : availableProducts;

        // Step 3: Call AI Provider with filtered list
        if (config.provider === 'gemini') {
            return mapWithGemini(config.apiKey, campaign, productsToSend, existingMappings);
        } else if (config.provider === 'openai') {
            return mapWithOpenAI(config.apiKey, campaign, productsToSend, existingMappings);
        }
        return Promise.resolve({
            campaignName: campaign.name,
            suggestedProductId: 'global',
            confidence: 0,
            reasoning: 'No AI provider configured'
        });
    });

    try {
        return await Promise.all(mappingPromises);
    } catch (error) {
        console.error('Error mapping campaigns:', error);
        return [];
    }
}

/**
 * Map a single campaign to a product using AI
 */
export async function mapSingleCampaign(
    config: AIMapperConfig,
    campaign: CampaignInfo,
    availableProducts: ProductInfo[]
): Promise<MappingSuggestion | null> {
    if (config.provider === 'none' || !config.apiKey) {
        return null;
    }

    try {
        if (config.provider === 'gemini') {
            return await mapWithGemini(config.apiKey, campaign, availableProducts);
        } else if (config.provider === 'openai') {
            return await mapWithOpenAI(config.apiKey, campaign, availableProducts);
        }
    } catch (error) {
        console.error('Error mapping single campaign:', error);
    }

    return null;
}
