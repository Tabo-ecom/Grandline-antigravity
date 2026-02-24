'use client';

import React from 'react';
import {
    Calendar as CalendarIcon,
    Globe,
    ChevronDown,
    Package,
    ArrowRight,
    ChevronLeft,
    ChevronRight,
} from 'lucide-react';
import { useGlobalFilters } from '@/lib/context/FilterContext';
import {
    format,
    addMonths,
    subMonths,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    isSameMonth,
    isSameDay,
    addDays,
    isWithinInterval,
    parseISO,
    isValid
} from 'date-fns';
import { es } from 'date-fns/locale';

interface ProductOption {
    id: string;
    label: string;
}

interface FilterHeaderProps {
    availableCountries?: string[];
    availableProducts?: (string | ProductOption)[];
    title?: string;
    icon?: React.ElementType;
    children?: React.ReactNode;
}

const FilterHeader = ({
    availableCountries = ['Todos'],
    availableProducts = ['Todos'],
    title = 'Grand Line',
    icon: Icon = Globe,
    children
}: FilterHeaderProps) => {
    const {
        dateRange, setDateRange,
        startDateCustom, setStartDateCustom,
        endDateCustom, setEndDateCustom,
        selectedCountry, setSelectedCountry,
        selectedProduct, setSelectedProduct
    } = useGlobalFilters();
    const [isCalendarOpen, setIsCalendarOpen] = React.useState(false);
    const [viewDate, setViewDate] = React.useState(new Date());
    const calendarRef = React.useRef<HTMLDivElement>(null);

    // Handle clicks outside
    React.useEffect(() => {
        function handleClickOutside(event: MouseEvent) {
            if (calendarRef.current && !calendarRef.current.contains(event.target as Node)) {
                setIsCalendarOpen(false);
            }
        }
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleDateSelect = (date: Date) => {
        const dateStr = format(date, 'yyyy-MM-dd');

        // Ensure we switch to 'Personalizado' when a date is chosen
        if (dateRange !== 'Personalizado') {
            setDateRange('Personalizado');
        }

        // If we don't have a start date, or we have both (reset)
        if (!startDateCustom || (startDateCustom && endDateCustom)) {
            setStartDateCustom(dateStr);
            setEndDateCustom('');
        } else {
            // We have a start date but no end date
            const start = parseISO(startDateCustom);
            if (date < start) {
                // If user selects a date before start, swap them
                setEndDateCustom(startDateCustom);
                setStartDateCustom(dateStr);
            } else {
                setEndDateCustom(dateStr);
            }
        }
    };

    const renderCalendar = () => {
        const monthStart = startOfMonth(viewDate);
        const monthEnd = endOfMonth(monthStart);
        const startDate = startOfWeek(monthStart);
        const endDate = endOfWeek(monthEnd);

        const rows = [];
        let days = [];
        let day = startDate;
        const formattedMonth = format(viewDate, 'MMMM yyyy', { locale: es });

        while (day <= endDate) {
            for (let i = 0; i < 7; i++) {
                const currentDay = day;
                const isSelected = (startDateCustom && isSameDay(currentDay, parseISO(startDateCustom))) ||
                    (endDateCustom && isSameDay(currentDay, parseISO(endDateCustom)));

                const isInRange = startDateCustom && endDateCustom &&
                    isWithinInterval(currentDay, {
                        start: parseISO(startDateCustom),
                        end: parseISO(endDateCustom)
                    });

                const isToday = isSameDay(currentDay, new Date());
                const isCurrentMonth = isSameMonth(currentDay, monthStart);

                days.push(
                    <div
                        key={day.toString()}
                        onClick={() => handleDateSelect(currentDay)}
                        className={`
                            relative h-10 w-10 flex items-center justify-center text-xs font-bold cursor-pointer rounded-xl transition-all
                            ${!isCurrentMonth ? 'text-gray-700 opacity-20' : 'text-gray-300'}
                            ${isSelected ? 'bg-orange-600 text-white shadow-lg shadow-orange-600/40 z-10' : 'hover:bg-white/5'}
                            ${isInRange && !isSelected ? 'bg-orange-600/10 text-orange-400' : ''}
                            ${isToday && !isSelected ? 'border border-orange-500/30' : ''}
                        `}
                    >
                        {format(currentDay, 'd')}
                        {isToday && <div className="absolute bottom-1 w-1 h-1 bg-orange-500 rounded-full" />}
                    </div>
                );
                day = addDays(day, 1);
            }
            rows.push(
                <div key={day.toString()} className="grid grid-cols-7 gap-1">
                    {days}
                </div>
            );
            days = [];
        }

        return (
            <div className="p-5 space-y-4">
                <div className="flex items-center justify-between px-1">
                    <h4 className="text-sm font-black text-white uppercase tracking-widest">{formattedMonth}</h4>
                    <div className="flex gap-1">
                        <button onClick={() => setViewDate(subMonths(viewDate, 1))} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                            <ChevronLeft className="w-4 h-4" />
                        </button>
                        <button onClick={() => setViewDate(addMonths(viewDate, 1))} className="p-1.5 hover:bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors">
                            <ChevronRight className="w-4 h-4" />
                        </button>
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1 px-1">
                    {['D', 'L', 'M', 'M', 'J', 'V', 'S'].map((d, i) => (
                        <div key={i} className="h-8 w-10 flex items-center justify-center text-[10px] font-black text-gray-600 uppercase">
                            {d}
                        </div>
                    ))}
                </div>
                <div className="space-y-1">
                    {rows}
                </div>
            </div>
        );
    };

    return (
        <header className="sticky top-4 z-[100] bg-[#0a0a0f]/80 backdrop-blur-xl border border-white/[0.08] py-3 px-6 -mx-4 md:-mx-6 mb-8 shadow-2xl shadow-black/40 rounded-2xl mx-0 md:mx-0">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                {/* Brand / Page Title */}
                <div className="flex items-center gap-3">
                    <div className="p-2.5 rounded-xl bg-gradient-to-br from-[#d75c33] to-[#ff8c5a] shadow-lg shadow-[#d75c33]/20">
                        <Icon className="w-5 h-5 text-white" />
                    </div>
                    <div>
                        <h1 className="text-lg font-black tracking-tight text-white uppercase">{title}</h1>
                        <p className="text-xs text-gray-500 font-bold tracking-widest uppercase">Command Center</p>
                    </div>
                </div>

                {/* Filters Group */}
                <div className="flex flex-wrap items-center gap-2 md:gap-3 bg-white/[0.03] p-2 rounded-2xl border border-white/[0.05]">

                    {/* Country Selector */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group">
                        <Globe className="w-4 h-4 text-indigo-400" />
                        <select
                            value={selectedCountry}
                            onChange={(e) => setSelectedCountry(e.target.value)}
                            className="bg-transparent text-sm font-bold text-gray-300 outline-none cursor-pointer appearance-none min-w-[80px]"
                        >
                            {availableCountries.map(c => (
                                <option key={c} value={c} className="bg-[#0a0c10] text-gray-300">{c === 'Todos' ? 'País: Todos' : c}</option>
                            ))}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                    </div>

                    <div className="w-px h-5 bg-white/10" />

                    {/* Product Selector */}
                    <div className="flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group max-w-[220px]">
                        <Package className="w-4 h-4 text-amber-400" />
                        <select
                            value={selectedProduct}
                            onChange={(e) => setSelectedProduct(e.target.value)}
                            className="bg-transparent text-sm font-bold text-gray-300 outline-none cursor-pointer appearance-none truncate flex-1"
                        >
                            {availableProducts.map(p => {
                                const id = typeof p === 'string' ? p : p.id;
                                const label = typeof p === 'string' ? p : p.label;
                                return (
                                    <option key={id} value={id} className="bg-[#0a0c10] text-gray-300">
                                        {id === 'Todos' ? 'Producto: Todos' : (label.length > 25 ? label.substring(0, 25) + '...' : label)}
                                    </option>
                                );
                            })}
                        </select>
                        <ChevronDown className="w-3.5 h-3.5 text-gray-600 group-hover:text-gray-400 transition-colors" />
                    </div>

                    <div className="w-px h-5 bg-white/10" />

                    {/* Date Selector */}
                    <div className="relative" ref={calendarRef}>
                        <div
                            onClick={() => {
                                setIsCalendarOpen(!isCalendarOpen);
                            }}
                            className={`flex items-center gap-2 px-3.5 py-2 rounded-xl hover:bg-white/5 transition-colors cursor-pointer group ${isCalendarOpen ? 'bg-white/5 ring-1 ring-white/10' : ''}`}
                        >
                            <CalendarIcon className="w-4 h-4 text-emerald-400" />
                            <div className="flex flex-col">
                                <span className="text-[10px] font-black text-gray-500 uppercase leading-none mb-0.5">Rango de Fechas</span>
                                <div className="flex items-center gap-1.5">
                                    <span className="text-xs font-bold text-gray-300">
                                        {dateRange === 'Personalizado' ? (
                                            startDateCustom ? (
                                                endDateCustom ? `${format(parseISO(startDateCustom), 'dd MMM')} - ${format(parseISO(endDateCustom), 'dd MMM')}` : format(parseISO(startDateCustom), 'dd MMM')
                                            ) : 'Seleccionar...'
                                        ) : dateRange}
                                    </span>
                                    <ChevronDown className={`w-3 h-3 text-gray-600 transition-transform ${isCalendarOpen ? 'rotate-180' : ''}`} />
                                </div>
                            </div>
                        </div>

                        {/* Calendar Popover */}
                        {isCalendarOpen && (
                            <div className="absolute top-full right-0 mt-3 bg-[#0c0f16] border border-gray-800 rounded-[2.5rem] shadow-2xl z-[100] w-[320px] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                                {/* Presets inside calendar */}
                                <div className="grid grid-cols-2 gap-1 p-2 border-b border-white/5 bg-black/20">
                                    {['Hoy', 'Ayer', 'Últimos 7 Días', 'Últimos 30 Días', 'Este Mes', 'Mes Pasado', 'Todos'].map(preset => (
                                        <button
                                            key={preset}
                                            onClick={() => {
                                                setDateRange(preset);
                                                setIsCalendarOpen(false);
                                            }}
                                            className={`px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest text-left transition-all ${dateRange === preset ? 'bg-orange-600/20 text-orange-400 border border-orange-500/30' : 'text-gray-500 hover:text-gray-300 hover:bg-white/5'}`}
                                        >
                                            {preset}
                                        </button>
                                    ))}
                                </div>
                                {renderCalendar()}
                                {(startDateCustom || endDateCustom) && (
                                    <div className="p-4 bg-black/40 border-t border-white/5 flex items-center justify-between">
                                        <button
                                            onClick={() => {
                                                setStartDateCustom('');
                                                setEndDateCustom('');
                                            }}
                                            className="text-[9px] font-black text-gray-500 hover:text-red-400 uppercase tracking-widest transition-colors"
                                        >
                                            Limpiar
                                        </button>
                                        <button
                                            onClick={() => setIsCalendarOpen(false)}
                                            className="px-4 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all"
                                        >
                                            Aplicar
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* Actions */}
                {children && (
                    <div className="flex items-center gap-3">
                        {children}
                    </div>
                )}
            </div>
        </header>
    );
};

export default FilterHeader;
