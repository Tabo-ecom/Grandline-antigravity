'use client';

import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/lib/context/AuthContext';
import { getAllOrderFiles } from '@/lib/firebase/firestore';
import { calculateKPIs, KPIResults, DropiOrder } from '@/lib/calculations/kpis';
import {
    fetchExchangeRates, ExchangeRates, toCOP,
    getCurrencyForCountry, isMatchingCountry,
    getOfficialCountryName, normalizeCountry
} from '@/lib/utils/currency';
import { listAdSpends, AdSpend } from '@/lib/services/marketing';
import { isEntregado, isCancelado, isTransit, isDevolucion } from '@/lib/utils/status';

export type DateRangeOption = 'Últimos 3 Días' | 'Últimos 7 Días' | 'Últimos 30 Días' | 'Todos';

const DAYS_MAP: Record<string, number> = {
    'Últimos 3 Días': 3,
    'Últimos 7 Días': 7,
    'Últimos 30 Días': 30,
    'Todos': 9999,
};

function parseOrderDate(dateStr: string | Date | undefined): Date {
    if (!dateStr) return new Date(0);
    if (dateStr instanceof Date) return dateStr;
    if (dateStr.includes('/')) {
        const parts = dateStr.split(' ')[0].split('/');
        if (parts.length === 3) {
            const [d, m, y] = parts;
            const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d));
            if (!isNaN(date.getTime())) return date;
        }
    }
    const date = new Date(dateStr);
    return isNaN(date.getTime()) ? new Date(0) : date;
}

export function useCountryData() {
    const { country } = useParams();
    const { effectiveUid } = useAuth();
    const [loading, setLoading] = useState(true);
    const [rates, setRates] = useState<ExchangeRates | null>(null);
    const [countryOrders, setCountryOrders] = useState<DropiOrder[]>([]);
    const [totalActiveCountries, setTotalActiveCountries] = useState(1);
    const [filterDateRange, setFilterDateRange] = useState<DateRangeOption>('Últimos 30 Días');
    const [adHistory, setAdHistory] = useState<AdSpend[]>([]);

    const decodedCountry = decodeURIComponent(country as string);
    const countryName = decodedCountry.charAt(0).toUpperCase() + decodedCountry.slice(1);
    const localCurrency = getCurrencyForCountry(countryName);

    // Load order data + exchange rates
    useEffect(() => {
        async function loadData() {
            try {
                const [files, exchangeRates] = await Promise.all([
                    getAllOrderFiles(effectiveUid || ''),
                    fetchExchangeRates()
                ]);
                setRates(exchangeRates);

                const uniqueCountries = new Set(
                    files.map(f => getOfficialCountryName(f.country || 'Desconocido'))
                );
                setTotalActiveCountries(uniqueCountries.size || 1);

                const matchingFiles = files.filter(f => {
                    if (!f.country) return false;
                    return isMatchingCountry(f.country, decodedCountry);
                });

                const allCountryOrders: DropiOrder[] = [];
                matchingFiles.forEach(file => {
                    if (file.orders) {
                        const currency = getCurrencyForCountry(file.country || decodedCountry);
                        const normalized = file.orders.map((o: DropiOrder) => ({
                            ...o,
                            "TOTAL DE LA ORDEN": toCOP(o["TOTAL DE LA ORDEN"], currency, exchangeRates),
                            "PRECIO PROVEEDOR": o["PRECIO PROVEEDOR"] ? toCOP(o["PRECIO PROVEEDOR"], currency, exchangeRates) : 0,
                            "PRECIO PROVEEDOR X CANTIDAD": o["PRECIO PROVEEDOR X CANTIDAD"] ? toCOP(o["PRECIO PROVEEDOR X CANTIDAD"], currency, exchangeRates) : 0,
                            "PRECIO FLETE": o["PRECIO FLETE"] ? toCOP(o["PRECIO FLETE"], currency, exchangeRates) : 0,
                            "COSTO DEVOLUCION FLETE": o["COSTO DEVOLUCION FLETE"]
                                ? toCOP(o["COSTO DEVOLUCION FLETE"], currency, exchangeRates)
                                : (o["PRECIO FLETE"] ? toCOP(o["PRECIO FLETE"], currency, exchangeRates) : 0),
                            GANANCIA: o.GANANCIA ? toCOP(o.GANANCIA, currency, exchangeRates) : 0,
                        }));
                        allCountryOrders.push(...normalized);
                    }
                });

                setCountryOrders(allCountryOrders);
            } catch (error) {
                console.error('Error loading country data:', error);
            } finally {
                setLoading(false);
            }
        }
        loadData();
    }, [countryName]);

    // Load ad spend history
    useEffect(() => {
        if (!decodedCountry || !effectiveUid) return;
        const officialName = getOfficialCountryName(decodedCountry);
        listAdSpends(officialName, effectiveUid).then(setAdHistory);
    }, [decodedCountry, effectiveUid]);

    // Filter orders by date range
    const filteredOrders = useMemo(() => {
        const days = DAYS_MAP[filterDateRange] || 30;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        return filterDateRange === 'Todos'
            ? countryOrders
            : countryOrders.filter(o => parseOrderDate(o.FECHA) >= cutoff);
    }, [countryOrders, filterDateRange]);

    // Calculate ad spend for current date range
    const calculatedAdSpend = useMemo(() => {
        if (!rates) return 0;
        const days = DAYS_MAP[filterDateRange] || 30;
        const cutoff = new Date();
        cutoff.setDate(cutoff.getDate() - days);

        const relevantHistory = filterDateRange === 'Todos'
            ? adHistory
            : adHistory.filter(h => new Date(h.date) >= cutoff);

        let totalCOP = 0;
        relevantHistory.forEach(h => {
            const amount = h.currency === 'COP' ? h.amount : toCOP(h.amount, h.currency, rates);
            const isShared = normalizeCountry(h.country) === 'desconocido' || normalizeCountry(h.country) === 'todos';
            totalCOP += isShared ? (amount / totalActiveCountries) : amount;
        });

        return totalCOP;
    }, [adHistory, filterDateRange, rates, totalActiveCountries]);

    // Calculate KPIs
    const kpis = useMemo(() => {
        if (filteredOrders.length === 0 || !rates) return null;
        return calculateKPIs(filteredOrders, calculatedAdSpend);
    }, [filteredOrders, rates, calculatedAdSpend]);

    // Status statistics
    const statusStats = useMemo(() => {
        const entregados = filteredOrders.filter(o => isEntregado(o.ESTATUS)).length;
        const cancelados = filteredOrders.filter(o => isCancelado(o.ESTATUS)).length;
        const transito = filteredOrders.filter(o => isTransit(o.ESTATUS)).length;
        const devoluciones = filteredOrders.filter(o => isDevolucion(o.ESTATUS)).length;
        const total = filteredOrders.length || 1;
        const noCancelados = total - cancelados || 1;

        return {
            entregados,
            cancelados,
            transito,
            devoluciones,
            total,
            noCancelados,
            percents: {
                entregados: (entregados / noCancelados) * 100,
                cancelados: (cancelados / total) * 100,
                transito: (transito / noCancelados) * 100,
                devoluciones: (devoluciones / noCancelados) * 100,
            }
        };
    }, [filteredOrders]);

    return {
        loading,
        rates,
        countryOrders,
        filteredOrders,
        kpis,
        statusStats,
        localCurrency,
        countryName,
        decodedCountry,
        filterDateRange,
        setFilterDateRange,
        calculatedAdSpend,
        adHistory,
        totalActiveCountries,
    };
}
