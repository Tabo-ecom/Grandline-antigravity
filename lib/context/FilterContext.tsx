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
    selectedBrand: string;
    setSelectedBrand: (brand: string) => void;
}

const FilterContext = createContext<FilterContextType | undefined>(undefined);

export function FilterProvider({ children }: { children: ReactNode }) {
    // Initial states with localStorage check
    const [dateRange, setDateRange] = useState('Últimos 7 Días');
    const [startDateCustom, setStartDateCustom] = useState('');
    const [endDateCustom, setEndDateCustom] = useState('');
    const [selectedCountry, setSelectedCountry] = useState('Todos');
    const [selectedProduct, setSelectedProduct] = useState('Todos');
    const [selectedBrand, setSelectedBrand] = useState('Todos');

    const [isLoaded, setIsLoaded] = useState(false);

    // Initialize from localStorage
    useEffect(() => {
        const saved = localStorage.getItem('grand_line_filters');
        if (saved) {
            try {
                const parsed = JSON.parse(saved);
                // Validate dateRange is a known preset
                const validRanges = ['Hoy', 'Ayer', 'Últimos 7 Días', 'Últimos 30 Días', 'Este Mes', 'Mes Pasado', 'Todos', 'Personalizado'];
                if (parsed.dateRange && validRanges.includes(parsed.dateRange)) setDateRange(parsed.dateRange);
                if (parsed.startDateCustom) setStartDateCustom(parsed.startDateCustom);
                if (parsed.endDateCustom) setEndDateCustom(parsed.endDateCustom);
                if (parsed.selectedCountry) setSelectedCountry(parsed.selectedCountry);
                if (parsed.selectedProduct) setSelectedProduct(parsed.selectedProduct);
                if (parsed.selectedBrand) setSelectedBrand(parsed.selectedBrand);
            } catch (e) {
                console.error("Failed to parse saved filters, resetting", e);
                localStorage.removeItem('grand_line_filters');
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
            selectedProduct,
            selectedBrand
        };
        localStorage.setItem('grand_line_filters', JSON.stringify(filters));
    }, [dateRange, startDateCustom, endDateCustom, selectedCountry, selectedProduct, selectedBrand, isLoaded]);

    return (
        <FilterContext.Provider value={{
            dateRange, setDateRange,
            startDateCustom, setStartDateCustom,
            endDateCustom, setEndDateCustom,
            selectedCountry, setSelectedCountry,
            selectedProduct, setSelectedProduct,
            selectedBrand, setSelectedBrand
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
