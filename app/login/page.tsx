'use client';

import React, { useState } from 'react';
import {
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signInWithPopup,
    GoogleAuthProvider
} from 'firebase/auth';
import { auth } from '@/lib/firebase/config';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
    const [mode, setMode] = useState<'login' | 'register'>('login');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
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

    const handleRegister = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        if (password !== confirmPassword) {
            setError('Las contraseñas no coinciden.');
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError('La contraseña debe tener al menos 6 caracteres.');
            setLoading(false);
            return;
        }

        try {
            await createUserWithEmailAndPassword(auth, email, password);
            router.push('/dashboard');
        } catch (err: any) {
            console.error('Register error:', err);
            if (err.code === 'auth/email-already-in-use') {
                setError('Este email ya está registrado. Intenta iniciar sesión.');
            } else if (err.code === 'auth/weak-password') {
                setError('La contraseña es muy débil. Usa al menos 6 caracteres.');
            } else if (err.code === 'auth/invalid-email') {
                setError('El email ingresado no es válido.');
            } else {
                setError('Error al crear la cuenta. Intenta de nuevo.');
            }
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

    const switchMode = () => {
        setMode(mode === 'login' ? 'register' : 'login');
        setError('');
        setConfirmPassword('');
    };

    return (
        <div className="min-h-screen bg-[#0A0A0F] font-['Space_Grotesk'] text-white selection:bg-[#d75c33]/30 overflow-hidden relative flex items-center justify-center">
            {/* Background Glows */}
            <div className="absolute top-[-10%] left-[-5%] w-[40%] h-[40%] bg-[#d75c33]/10 rounded-full blur-[120px]"></div>
            <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] bg-blue-500/10 rounded-full blur-[120px]"></div>

            <div className="relative z-10 w-full max-w-md p-8">
                <div className="flex flex-col items-center mb-10">
                    <img src="/logos/grandline-isotipo.png" alt="Grand Line" className="w-20 h-20 mb-4 animate-bounce" />
                    <h1 className="text-4xl font-bold tracking-tight text-center">
                        Grand Line
                    </h1>
                    <p className="text-gray-400 mt-2 font-mono text-sm tracking-widest uppercase">
                        {mode === 'login' ? 'Acceso de Comando' : 'Nuevo Tripulante'}
                    </p>
                </div>

                <div className="bg-gray-900/40 backdrop-blur-xl border border-gray-800 p-8 rounded-2xl shadow-2xl">
                    {/* Mode Toggle */}
                    <div className="flex mb-6 bg-black/30 rounded-xl p-1">
                        <button
                            type="button"
                            onClick={() => { setMode('login'); setError(''); setConfirmPassword(''); }}
                            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${mode === 'login' ? 'bg-[#d75c33] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Iniciar Sesión
                        </button>
                        <button
                            type="button"
                            onClick={() => { setMode('register'); setError(''); }}
                            className={`flex-1 py-2.5 text-xs font-bold uppercase tracking-widest rounded-lg transition-all ${mode === 'register' ? 'bg-[#d75c33] text-white' : 'text-gray-500 hover:text-gray-300'}`}
                        >
                            Crear Cuenta
                        </button>
                    </div>

                    <form onSubmit={mode === 'login' ? handleLogin : handleRegister} className="space-y-6">
                        <div>
                            <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
                                E-MAIL
                            </label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e: React.ChangeEvent<HTMLInputElement>) => setEmail(e.target.value)}
                                placeholder="tu@email.com"
                                className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 placeholder:text-gray-700 outline-none focus:border-[#d75c33]/50 transition-all text-gray-200"
                                required
                            />
                        </div>

                        <div>
                            <div className="flex justify-between items-center mb-2 px-1">
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400">
                                    CONTRASEÑA
                                </label>
                                {mode === 'login' && (
                                    <button type="button" className="text-[10px] text-[#d75c33] hover:underline uppercase tracking-tighter">
                                        ¿Olvidaste tu clave?
                                    </button>
                                )}
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

                        {mode === 'register' && (
                            <div>
                                <label className="block text-xs font-bold uppercase tracking-widest text-gray-400 mb-2 px-1">
                                    CONFIRMAR CONTRASEÑA
                                </label>
                                <input
                                    type="password"
                                    value={confirmPassword}
                                    onChange={(e) => setConfirmPassword(e.target.value)}
                                    placeholder="••••••••"
                                    className="w-full bg-black/50 border border-gray-800 rounded-xl px-4 py-3 placeholder:text-gray-700 outline-none focus:border-[#d75c33]/50 transition-all text-gray-200"
                                    required
                                />
                            </div>
                        )}

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
                                {mode === 'login' ? 'INICIAR SESIÓN' : 'CREAR CUENTA'} {loading ? '...' : '→'}
                            </span>
                        </button>

                        <div className="relative my-8">
                            <div className="absolute inset-0 flex items-center">
                                <div className="w-full border-t border-gray-800"></div>
                            </div>
                            <div className="relative flex justify-center text-xs uppercase">
                                <span className="bg-[#0A0A0F] px-4 text-gray-500 tracking-widest">o continúa con</span>
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

                <p className="mt-6 text-center text-xs text-gray-500">
                    {mode === 'login' ? '¿No tienes cuenta?' : '¿Ya tienes cuenta?'}
                    <button onClick={switchMode} className="ml-1.5 text-[#d75c33] font-bold hover:underline">
                        {mode === 'login' ? 'Crear cuenta' : 'Iniciar sesión'}
                    </button>
                </p>
            </div>
        </div>
    );
}
