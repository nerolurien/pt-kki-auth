import React, { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import apiClient from '../api/client';
import { useAuth } from '../context/AuthContext';
import { LoginResponse } from '../types';
import axios from 'axios';
import { 
  Eye, 
  EyeOff, 
  AlertCircle, 
  Sparkles, 
  ArrowRight,
  Laptop,
  ShieldAlert,
  Clock,
  LogOut,
  X
} from 'lucide-react';

export const Login: React.FC = () => {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const { login, sessionNotification, clearSessionNotification } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    clearSessionNotification();

    if (!identifier || !password) {
      setErrorMessage('Silakan masukkan email/username dan password.');
      return;
    }

    setIsLoading(true);
    try {
      const response = await apiClient.post<LoginResponse>('/auth/login', {
        identifier,
        password,
      });

      const { token, user } = response.data;
      login(token, user);

      const from = (location.state as { from?: { pathname: string } })?.from?.pathname;
      if (from) {
        navigate(from, { replace: true });
      } else if (user.role === 'admin') {
        navigate('/admin/users', { replace: true });
      } else {
        navigate('/profile', { replace: true });
      }
    } catch (err: unknown) {
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        setErrorMessage(err.response.data.error);
      } else {
        setErrorMessage('Tidak dapat terhubung ke server. Pastikan layanan backend aktif.');
      }
    } finally {
      setIsLoading(false);
    }
  };

  const handleFillAdmin = () => {
    setIdentifier('admin@kki.co.id');
    setPassword('Admin123!');
    setErrorMessage(null);
  };

  return (
    <div className="min-h-[calc(100vh-3.5rem)] flex items-center justify-center p-4">
      <div className="w-full max-w-sm">
        <div className="bg-white border border-zinc-200 rounded-2xl p-7 shadow-card">
          <div className="mb-6">
            <h1 className="text-xl font-semibold tracking-tight text-zinc-900">Selamat Datang</h1>
            <p className="text-xs text-zinc-500 mt-1">
              Masuk menggunakan alamat email atau username Anda
            </p>
          </div>

          {sessionNotification && (
            <div className={`mb-5 p-3.5 rounded-xl text-xs flex items-start justify-between space-x-2.5 border ${
              sessionNotification.reasonCode === 'max_sessions_exceeded'
                ? 'bg-amber-50/80 border-amber-200 text-amber-900'
                : sessionNotification.reasonCode === 'admin_force_logout'
                ? 'bg-red-50/80 border-red-200 text-red-900'
                : 'bg-zinc-50 border-zinc-200 text-zinc-800'
            }`}>
              <div className="flex items-start space-x-2.5">
                <div className="mt-0.5 flex-shrink-0">
                  {sessionNotification.reasonCode === 'max_sessions_exceeded' && (
                    <Laptop className="w-4 h-4 text-amber-600" />
                  )}
                  {sessionNotification.reasonCode === 'admin_force_logout' && (
                    <ShieldAlert className="w-4 h-4 text-red-600" />
                  )}
                  {sessionNotification.reasonCode === 'user_logout_all' && (
                    <LogOut className="w-4 h-4 text-zinc-600" />
                  )}
                  {sessionNotification.reasonCode !== 'max_sessions_exceeded' &&
                   sessionNotification.reasonCode !== 'admin_force_logout' &&
                   sessionNotification.reasonCode !== 'user_logout_all' && (
                    <Clock className="w-4 h-4 text-zinc-500" />
                  )}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <p className="font-semibold">{sessionNotification.title}</p>
                  </div>
                  <p className="mt-1 text-[11px] leading-relaxed opacity-90">
                    {sessionNotification.reasonText}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={clearSessionNotification}
                className="text-zinc-400 hover:text-zinc-600 cursor-pointer p-0.5"
                title="Tutup pemberitahuan"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          )}

          {errorMessage && (
            <div className="mb-4 p-3.5 bg-red-50 border border-red-200 text-red-700 rounded-xl text-xs flex items-start space-x-2.5">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <p className="leading-relaxed mt-0.5">{errorMessage}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-700 mb-1.5">
                Email atau Username
              </label>
              <input
                type="text"
                value={identifier}
                onChange={(e) => {
                  setIdentifier(e.target.value);
                  if (errorMessage) setErrorMessage(null);
                }}
                placeholder="misal: admin@kki.co.id atau admin"
                required
                className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all duration-200 ease-in-out"
              />
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-medium text-zinc-700">
                  Password
                </label>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="Masukkan password Anda"
                  required
                  className="w-full bg-white border border-zinc-300 rounded-lg px-3 py-2 pr-10 text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all duration-200 ease-in-out"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-zinc-400 hover:text-zinc-600 transition-colors"
                  title={showPassword ? "Sembunyikan password" : "Tampilkan password"}
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full mt-2 py-2.5 px-3 text-sm font-medium text-white bg-zinc-900 hover:bg-zinc-800 active:scale-[0.99] disabled:opacity-50 rounded-lg shadow-sm transition-all duration-200 ease-in-out flex items-center justify-center space-x-2 cursor-pointer"
            >
              {isLoading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  <span>Memverifikasi akun...</span>
                </>
              ) : (
                <>
                  <span>Masuk ke Akun</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-zinc-100">
            <div className="bg-zinc-50 border border-zinc-200/80 rounded-xl p-3 flex items-center justify-between">
              <div className="text-[11px] text-zinc-600">
                <p className="font-medium text-zinc-800">Akun Pengujian Admin</p>
                <p className="text-zinc-400 font-mono text-[10px]">admin@kki.co.id</p>
              </div>
              <button
                type="button"
                onClick={handleFillAdmin}
                className="inline-flex items-center space-x-1 text-xs font-medium text-zinc-900 bg-white border border-zinc-200 hover:bg-zinc-100 px-2.5 py-1 rounded-md shadow-2xs transition-all duration-150 cursor-pointer"
              >
                <Sparkles className="w-3 h-3 text-amber-500" />
                <span>Isi Otomatis</span>
              </button>
            </div>
          </div>

          <div className="text-center text-xs text-zinc-500 mt-5 pt-4 border-t border-zinc-100">
            Belum memiliki akun?{' '}
            <Link to="/register" className="font-medium text-zinc-900 hover:underline">
              Daftar sekarang
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
};
