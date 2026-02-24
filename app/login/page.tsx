'use client';

import React, { useState } from 'react';
import {
    signInWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const router = useRouter();

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            await signInWithEmailAndPassword(auth, email, password);
            router.push('/dashboard');
        } catch (err: any) {
            console.error('Login error:', err);
            setError(err.message === 'Firebase: Error (auth/user-not-found).'
                ? 'Usuario no encontrado.'
                : 'Credenciales inválidas o error de conexión.');
        } finally {
            setLoading(false);
        }
    };

    const handleGoogleLogin = async () => {
        const provider = new GoogleAuthProvider();
        setLoading(true);
        try {
            await signInWithPopup(auth, provider);
            router.push('/dashboard');
        } catch (err: any) {
            console.error('Google login error:', err);
            setError('Error al iniciar sesión con Google.');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0A0A0F] font-['Space_Grotesk'] text-white selection:bg-[#d75c33]/30 overflow-hidden relative flex items-center justify-center">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#d75c33]/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>

            <div className="relative z-10 w-full max-w-md p-8">
                <div className="flex flex-col items-center mb-10">
                    <div className="text-6xl mb-4 animate-bounce">⚓</div>
                    <h1 className="text-4xl font-bold tracking-tight text-center">
                        Grand Line
                    </h1>
                    <p className="text-gray-400 mt-2 font-mono text-sm tracking-widest uppercase">
                        Acceso de Comando
                    </p>
                </div>

                <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 p-8 rounded-2xl shadow-2xl">
                    <form onSubmit={handleLogin} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
                                E-MAIL ACCESS
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                placeholder="adm@grandline.io"
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 placeholder:text-gray-700 outline-none focus:border-[#d75c33]/50 transition-all text-gray-200"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2 px-1">
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">
                                    COMMAND KEY
                                </label>
                                <button type="button" className="text-[10px] text-[#d75c33] hover:underline uppercase tracking-tighter">
                                    Forgot Key?
                                </button>
                            </div>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 placeholder:text-gray-700 outline-none focus:border-[#d75c33]/50 transition-all text-gray-200"
                                required
                            />
                        </div>

                        {error && (
                            <div className="bg-red-500/10 border border-red-500/20 text-red-400 text-sm p-4 rounded-xl flex items-center gap-3">
                                <span className="text-xl">⚠️</span> {error}
                            </div>
                        )}

                        <button
                            disabled={loading}
                            className="w-full bg-[#d75c33] hover:bg-[#c04b2a] active:scale-[0.98] py-4 rounded-xl font-bold text-sm tracking-[0.2em] transition-all transform disabled:opacity-50 disabled:cursor-not-allowed group"
                        >
                            <span className="group-hover:translate-x-1 group-active:translate-x-0 transition-transform flex items-center justify-center gap-2">
                                INITIATE COMMAND {loading ? '...' : '→'}
                            </span>
                        </button>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0A0A0F] px-4 text-gray-500 tracking-widest">or continue with</span>
                            </div>
                        </div>

                        <button
                            type="button"
                            onClick={handleGoogleLogin}
                            className="w-full bg-white text-black hover:bg-gray-100 py-3 rounded-xl font-bold text-sm transition-all flex items-center justify-center gap-3 shadow-lg"
                        >
                            <img src="https://www.google.com/favicon.ico" className="w-4 h-4" alt="Google" />
                            GOOGLE ACCOUNT
                        </button>
                    </form>
                </div>

                <div className="mt-10 text-center text-[10px] text-gray-600 font-mono leading-relaxed max-w-xs mx-auto">
                    Warning: Unauthorized access to this terminal is strictly prohibited. All activities are monitored and logged by the Grand Line Command Protocol.
                </div>
            </div>
        </div>
    );
}
