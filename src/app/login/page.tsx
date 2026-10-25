'use client';

import React, { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Droplet, Lock, Phone, Mail, Eye, EyeOff, AlertCircle, User, MapPin } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectPath = searchParams.get('redirect') || '';

  const [loginId, setLoginId] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loginType, setLoginType] = useState<'phone' | 'email'>('phone');
  
  // Registration fields
  const [isLoginMode, setIsLoginMode] = useState(true);
  const [registerName, setRegisterName] = useState('');
  const [registerPhone, setRegisterPhone] = useState('');
  const [registerAddress, setRegisterAddress] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Clear cookie/token verification if user manually navigates here
  useEffect(() => {
    // Check if user is already authenticated
    fetch('/api/auth/me')
      .then(res => {
        if (res.ok) {
          return res.json();
        }
        return null;
      })
      .then(data => {
        if (data && data.user) {
          if (data.user.role === 'ADMIN') {
            router.push('/admin/dashboard');
          } else {
            router.push('/customer/dashboard');
          }
        }
      })
      .catch(() => {});
  }, [router]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ loginId, password }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Login failed. Please try again.');
      }

      // Successful login - redirect based on role
      const userRole = data.user.role;
      if (redirectPath) {
        router.push(redirectPath);
      } else if (userRole === 'ADMIN') {
        router.push('/admin/dashboard');
      } else {
        router.push('/customer/dashboard');
      }
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          name: registerName,
          phone: registerPhone,
          address: registerAddress,
          password,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Registration failed. Please try again.');
      }

      // Successful registration - redirect to customer dashboard
      router.push('/customer/dashboard');
    } catch (err: any) {
      setError(err.message);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#050b18] px-4 relative overflow-hidden">
      {/* Dynamic Background Glows */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl animate-pulse"></div>
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/10 rounded-full blur-3xl animate-pulse"></div>

      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
        className="w-full max-w-md glass-card p-8 md:p-10 rounded-3xl border border-sky-500/15 relative z-10"
      >
        <div className="text-center space-y-3 mb-8">
          <div className="h-16 w-16 rounded-2xl bg-gradient-to-tr from-blue-600 to-cyan-400 flex items-center justify-center mx-auto shadow-lg glow-aqua">
            <Droplet className="h-8 w-8 text-white fill-white animate-pulse" />
          </div>
          <h1 className="text-2xl md:text-3xl font-extrabold tracking-tight text-white">
            CHHATRAPATI AQUA
          </h1>
          <p className="text-xs text-slate-400 font-medium tracking-wide uppercase">
            Pure Water Jar Delivery & SaaS
          </p>
        </div>

        {isLoginMode ? (
          <>
            {/* Tab Switcher for Phone/Email login */}
            <div className="flex bg-slate-950/80 p-1 rounded-xl border border-slate-900 mb-6">
              <button
                type="button"
                onClick={() => {
                  setLoginType('phone');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  loginType === 'phone' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Phone className="h-3.5 w-3.5" />
                Mobile No
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginType('email');
                  setError(null);
                }}
                className={`flex-1 py-2 rounded-lg text-xs font-bold transition-all flex items-center justify-center gap-1.5 ${
                  loginType === 'email' ? 'bg-cyan-500 text-white shadow' : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Mail className="h-3.5 w-3.5" />
                Email Address
              </button>
            </div>

            <form onSubmit={handleLogin} className="space-y-5">
              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                  {loginType === 'phone' ? 'Mobile Number' : 'Email Address'}
                </label>
                <div className="relative">
                  <input
                    type={loginType === 'phone' ? 'tel' : 'email'}
                    required
                    value={loginId}
                    onChange={(e) => setLoginId(e.target.value)}
                    placeholder={loginType === 'phone' ? 'e.g. 9876543210' : 'e.g. sushil@gmail.com'}
                    className="w-full bg-slate-950/85 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 pl-11 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    {loginType === 'phone' ? <Phone className="h-4 w-4" /> : <Mail className="h-4 w-4" />}
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full bg-slate-950/85 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 pl-11 pr-11 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                  />
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                    <Lock className="h-4 w-4" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 p-1"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <AnimatePresence>
                {error && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex items-center gap-2 text-rose-400 bg-rose-950/20 border border-rose-900/30 p-3.5 rounded-xl text-xs font-semibold"
                  >
                    <AlertCircle className="h-4 w-4 shrink-0" />
                    <span>{error}</span>
                  </motion.div>
                )}
              </AnimatePresence>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 glow-aqua relative overflow-hidden"
              >
                {isLoading ? (
                  <div className="flex items-center gap-2">
                    <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                    <span>Authenticating...</span>
                  </div>
                ) : (
                  <span>Unlock Dashboard</span>
                )}
              </button>
            </form>
          </>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                Full Name
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={registerName}
                  onChange={(e) => setRegisterName(e.target.value)}
                  placeholder="e.g. Ramesh Kumar"
                  className="w-full bg-slate-950/85 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 pl-11 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <User className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                Mobile Number
              </label>
              <div className="relative">
                <input
                  type="tel"
                  required
                  value={registerPhone}
                  onChange={(e) => setRegisterPhone(e.target.value)}
                  placeholder="e.g. 9876543210"
                  className="w-full bg-slate-950/85 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 pl-11 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Phone className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                Billed Delivery Address
              </label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={registerAddress}
                  onChange={(e) => setRegisterAddress(e.target.value)}
                  placeholder="e.g. Flat 302, Phase 2, Hinjewadi, Pune"
                  className="w-full bg-slate-950/85 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 pl-11 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <MapPin className="h-4 w-4" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/85 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 pl-11 pr-11 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-350 p-1"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider pl-1">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full bg-slate-950/85 border border-slate-800 focus:border-cyan-500 rounded-xl py-3 px-4 pl-11 pr-11 text-xs text-white placeholder-slate-600 focus:outline-none transition-all"
                />
                <div className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500">
                  <Lock className="h-4 w-4" />
                </div>
              </div>
            </div>

            <AnimatePresence>
              {error && (
                <motion.div
                  initial={{ opacity: 0, height: 0 }}
                  animate={{ opacity: 1, height: 'auto' }}
                  exit={{ opacity: 0, height: 0 }}
                  className="flex items-center gap-2 text-rose-400 bg-rose-950/20 border border-rose-900/30 p-3.5 rounded-xl text-xs font-semibold"
                >
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  <span>{error}</span>
                </motion.div>
              )}
            </AnimatePresence>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3.5 mt-2 bg-gradient-to-r from-blue-600 to-cyan-500 hover:opacity-95 text-white font-extrabold text-xs rounded-xl shadow-md transition-all flex items-center justify-center gap-2 glow-aqua relative overflow-hidden"
            >
              {isLoading ? (
                <div className="flex items-center gap-2">
                  <span className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></span>
                  <span>Registering Account...</span>
                </div>
              ) : (
                <span>Register & Log In</span>
              )}
            </button>
          </form>
        )}

        {/* Toggle between login and register */}
        <div className="mt-5 text-center">
          <button
            type="button"
            onClick={() => {
              setIsLoginMode(!isLoginMode);
              setError(null);
            }}
            className="text-xs text-cyan-400 hover:text-cyan-300 font-bold tracking-wide transition-all"
          >
            {isLoginMode ? "Need an account? Create one here" : "Already have an account? Access login"}
          </button>
        </div>

      </motion.div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-[#050b18] flex items-center justify-center">
        <span className="h-8 w-8 border-4 border-cyan-500 border-t-transparent rounded-full animate-spin"></span>
      </div>
    }>
      <LoginContent />
    </Suspense>
  );
}
