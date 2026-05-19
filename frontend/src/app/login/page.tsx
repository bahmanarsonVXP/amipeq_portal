'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { supabase } from '@/lib/supabase';
import { Mail, Lock, Info, Eye, EyeOff } from 'lucide-react';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) throw signInError;
      if (!data.session) throw new Error('Identifiants incorrects');

      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen bg-[#fcf8ef] flex items-center justify-center p-4 font-sans">
      <div className="w-full max-w-md">
        
        {/* Card */}
        <div className="bg-white rounded-3xl shadow-[0_8px_30px_rgb(0,0,0,0.04)] sm:p-10 p-6 border-0">
          
          {/* Logo */}
          <div className="flex justify-center mb-6">
            <img 
              src="/AMIEQ FRANCE - CERTIFIEE ISO.png" 
              alt="AMIPEQ Logo" 
              className="h-[80px] w-auto object-contain"
            />
          </div>

          <div className="text-center mb-10">
            <h1 className="text-3xl font-extrabold text-[#1a2332] mb-3 font-sans">Portail AMIPEQ</h1>
            <p className="text-slate-500 text-[15px]">Plateforme de gestion commerciale AMIPEQ</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-[15px] font-semibold text-slate-700 mb-2">
                Email
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Mail className="h-[18px] w-[18px] text-slate-400" />
                </div>
                <Input
                  type="email"
                  placeholder="arsonbahman@gmail.com"
                  className="pl-10 bg-[#f0f4fb] border-[#e2e8f4] text-slate-700 h-[48px] rounded-xl focus:border-primary-500 focus:ring-primary-500/20"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                />
              </div>
            </div>

            <div>
              <label className="block text-[15px] font-semibold text-slate-700 mb-2">
                Mot de passe
              </label>
              <div className="relative">
                <div className="absolute inset-y-0 left-0 pl-3.5 flex items-center pointer-events-none">
                  <Lock className="h-[18px] w-[18px] text-slate-400" />
                </div>
                <Input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="••••••"
                  className="pl-10 pr-10 bg-[#f0f4fb] border-[#e2e8f4] text-slate-700 h-[48px] rounded-xl focus:border-primary-500 focus:ring-primary-500/20"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3.5 flex items-center text-slate-400 hover:text-slate-600 focus:outline-none"
                  aria-label={showPassword ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
                >
                  {showPassword ? <EyeOff className="h-[18px] w-[18px]" /> : <Eye className="h-[18px] w-[18px]" />}
                </button>
              </div>
              <div className="flex justify-end mt-3">
                <a href="#" className="text-sm font-medium text-primary-500 hover:text-primary-600 transition-colors">
                  Mot de passe oublié ?
                </a>
              </div>
            </div>

            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-100 px-4 py-3 rounded-xl mt-4">
                {error}
              </p>
            )}

            <div className="pt-2">
              <Button type="submit" className="w-full bg-primary-500 hover:bg-primary-600 text-gray-900 h-[50px] text-[16px] rounded-xl font-bold transition-colors shadow-sm" disabled={loading}>
                {loading ? 'Connexion...' : 'Se connecter'}
              </Button>
            </div>

            <div className="mt-8 bg-[#f4f8fd] border border-[#dbeafe] rounded-xl p-4 text-[14px] text-slate-600 leading-relaxed shadow-sm">
              <div className="flex items-start gap-2.5">
                <div className="mt-[2px] bg-slate-400 text-white rounded-md w-4 h-4 flex items-center justify-center shrink-0">
                  <span className="text-[10px] font-bold font-serif leading-none italic">i</span>
                </div>
                <p>
                  Connexion avec le même compte que l&apos;application RPS. La création de compte est réservée aux administrateurs — contactez <a href="mailto:admin@amipeq.fr" className="text-blue-700 underline underline-offset-2 hover:text-blue-800 font-medium">admin@amipeq.fr</a>.
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
