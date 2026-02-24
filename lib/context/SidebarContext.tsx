'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';

interface SidebarContextType {
    collapsed: boolean;
    toggleCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextType>({
    collapsed: false,
    toggleCollapsed: () => { },
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
    const [collapsed, setCollapsed] = useState(false);

    // Persist state in localStorage
    useEffect(() => {
        const stored = localStorage.getItem('sidebar_collapsed');
        if (stored !== null) {
            setCollapsed(stored === 'true');
        }
    }, []);

    const toggleCollapsed = () => {
        setCollapsed(prev => {
            const next = !prev;
            localStorage.setItem('sidebar_collapsed', String(next));
            return next;
        });
    };

    return (
        <SidebarContext.Provider value={{ collapsed, toggleCollapsed }}>
            {children}
        </SidebarContext.Provider>
    );
}

export function useSidebar() {
    return useContext(SidebarContext);
}
