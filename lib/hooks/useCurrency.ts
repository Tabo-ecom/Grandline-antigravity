import { useState, useEffect } from 'react';
import { fetchExchangeRates, ExchangeRates } from '@/lib/utils/currency';

export function useCurrency() {
    const [rates, setRates] = useState<ExchangeRates | null>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let mounted = true;
        async function loadRates() {
            try {
                const r = await fetchExchangeRates();
                if (mounted) {
                    setRates(r);
                    setLoading(false);
                }
            } catch (err) {
                console.error("useCurrency error:", err);
                if (mounted) setLoading(false);
            }
        }
        loadRates();
        return () => { mounted = false; };
    }, []);

    return { rates, loading };
}
