'use client';

import React from 'react';

export default function LogPosePage() {
    return (
        <div className="space-y-6">
            <h1 className="text-3xl font-bold tracking-tight">Log Pose — Proyección</h1>
            <div className="bg-gray-900/40 backdrop-blur-md border border-gray-800 p-12 rounded-3xl flex flex-col items-center justify-center text-center">
                <div className="text-5xl mb-4 animate-pulse">🧭</div>
                <h2 className="text-2xl font-bold italic text-[#d75c33]">Ajustando Navegación</h2>
                <p className="text-gray-400 mt-2 max-w-sm">Estamos calibrando el Log Pose para calcular tus utilidades proyectadas. Estará listo en la próxima marea.</p>
                <div className="mt-8 flex gap-6">
                    <div className="w-32 h-2 bg-gray-800 rounded-full overflow-hidden">
                        <div className="w-2/3 h-full bg-[#d75c33] animate-[loading_2s_ease-in-out_infinite]"></div>
                    </div>
                </div>
            </div>
        </div>
    );
}
