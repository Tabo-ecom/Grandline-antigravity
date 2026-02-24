'use client';

import React from 'react';
import { useParams, usePathname } from 'next/navigation';
import {
    LayoutDashboard,
    BarChart3,
    ArrowLeft,
} from 'lucide-react';
import Link from 'next/link';

export default function CountryLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const params = useParams();
    const pathname = usePathname();
    const country = params.country as string;

    const decodedCountry = decodeURIComponent(country);
    const countryName = decodedCountry.charAt(0).toUpperCase() + decodedCountry.slice(1);

    const tabs = [
        { name: 'Operación', href: `/${country}/operacion`, icon: LayoutDashboard },
        { name: 'P&L', href: `/${country}/pl`, icon: BarChart3 },
    ];

    const getFlag = (c: string) => {
        const lower = c.toLowerCase();
        if (lower.includes('colombia')) return '🇨🇴';
        if (lower.includes('ecuador')) return '🇪🇨';
        if (lower.includes('panam')) return '🇵🇦';
        if (lower.includes('guatemala')) return '🇬🇹';
        return '🏳️';
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500">
            {/* Country Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex items-center gap-4">
                    <Link
                        href="/dashboard"
                        className="p-2 rounded-xl bg-hover-bg border border-card-border text-muted hover:text-foreground hover:bg-card transition-all"
                    >
                        <ArrowLeft className="w-4 h-4" />
                    </Link>
                    <div className="flex items-center gap-3">
                        <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-accent to-[#ff8c42] flex items-center justify-center text-2xl shadow-lg shadow-accent/20 border border-card-border">
                            {getFlag(countryName)}
                        </div>
                        <div>
                            <h1 className="text-2xl font-black text-foreground uppercase tracking-tight">{countryName}</h1>
                            <p className="text-[10px] font-bold text-muted uppercase tracking-[0.2em]">Dashboard Territorial</p>
                        </div>
                    </div>
                </div>

                {/* Tab Navigation */}
                <div className="flex items-center gap-1 bg-card p-1 rounded-xl border border-card-border">
                    {tabs.map((tab) => {
                        const isActive = pathname.includes(tab.href);
                        return (
                            <Link
                                key={tab.name}
                                href={tab.href}
                                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-[10px] font-bold uppercase tracking-wider transition-all ${isActive
                                        ? 'bg-accent text-white shadow-lg shadow-accent/20'
                                        : 'text-muted hover:text-foreground hover:bg-hover-bg'
                                    }`}
                            >
                                <tab.icon className={`w-3.5 h-3.5 ${isActive ? 'text-white' : 'text-muted'}`} />
                                {tab.name}
                            </Link>
                        );
                    })}
                </div>
            </div>

            {/* Content Area */}
            <div className="min-h-[60vh]">
                {children}
            </div>
        </div>
    );
}
