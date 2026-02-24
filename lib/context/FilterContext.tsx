'use client';

import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

interface FilterContextType {
    dateRange: string;
    setDateRange: (range: string) => void;
    startDateCustom: string;
    setStartDateCustom: (date: string) => void;
    endDateCustom: string;
    setEndDateCustom: (date: string) => void;
    selectedCountry: string;
    setSelectedCountry: (country: string) => void;
    selectedProduct: string;
    setSelectedProduct: (product: string) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
    // Initial states with localStorage check
    const [dateRange, setDateRange] = useState('Últimos 7 Días');
    const [startDateCustom, setStartDateCustom] = useState('');
    const [endDateCustom, setEndDateCustom] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('Todos');
    const [selectedProduct, setSelectedProduct] = useState('Todos');

    const [isLoaded, setIsLoaded] = useState(false);

    // Initialize from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('grand_line_filters');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                if (parsed.dateRange) setDateRange(parsed.dateRange);
                if (parsed.startDateCustom) setStartDateCustom(parsed.startDateCustom);
                if (parsed.endDateCustom) setEndDateCustom(parsed.endDateCustom);
                if (parsed.selectedCountry) setSelectedCountry(parsed.selectedCountry);
                if (parsed.selectedProduct) setSelectedProduct(parsed.selectedProduct);
            } catch (e) {
                console.error("Failed to parse saved filters", e);
            }
        }
        setIsLoaded(true);
    }, []);

    // Save to localStorage
    useEffect(() => {
        if (!isLoaded) return;
        const filters = {
            dateRange,
            startDateCustom,
            endDateCustom,
            selectedCountry,
            selectedProduct
        };
        localStorage.setItem('grand_line_filters', JSON.stringify(filters));
    }, [dateRange, startDateCustom, endDateCustom, selectedCountry, selectedProduct, isLoaded]);

    return (
        <FilterContext.Provider value={{
            dateRange, setDateRange,
            startDateCustom, setStartDateCustom,
            endDateCustom, setEndDateCustom,
            selectedCountry, setSelectedCountry,
            selectedProduct, setSelectedProduct
        }}>
            {children}
        </FilterContext.Provider>
    );
}

export function useGlobalFilters() {
    const context = useContext(FilterContext);
    if (context === undefined) {
        throw new Error('useGlobalFilters must be used within a FilterProvider');
    }
    return context;
}
