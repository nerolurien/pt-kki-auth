import React, { useEffect, useState, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import { UserProfileResponse, Session } from '../types';
import apiClient from '../api/client';
import { parseUserAgent, formatDateTime } from '../utils/format';
import { 
  Laptop, 
  Smartphone, 
  Globe, 
  RefreshCw, 
  LogOut, 
  Copy, 
  Check, 
  Info, 
  Clock, 
  MapPin 
} from 'lucide-react';

export const Profile: React.FC = () => {
  const { user, logout, logoutAll } = useAuth();
  const [profileData, setProfileData] = useState<UserProfileResponse | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedId, setCopiedId] = useState(false);

  const fetchProfile = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const response = await apiClient.get<UserProfileResponse>('/users/me');
      setProfileData(response.data);
    } catch (err) {
      console.warn('Failed to fetch profile:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();

    // Auto-poll every 8s to detect if session is revoked or displaced
    const interval = setInterval(() => {
      fetchProfile(true);
    }, 8000);

    return () => clearInterval(interval);
  }, [fetchProfile]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(true);
    setTimeout(() => setCopiedId(false), 2000);
  };

  const getDeviceIcon = (deviceType: string) => {
    if (deviceType === 'mobile') return <Smartphone className="w-4 h-4 text-zinc-600" />;
    if (deviceType === 'desktop') return <Laptop className="w-4 h-4 text-zinc-600" />;
    return <Globe className="w-4 h-4 text-zinc-600" />;
  };

  if (isLoading && !profileData) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 flex flex-col items-center justify-center">
        <div className="w-6 h-6 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin" />
        <p className="mt-3 text-xs text-zinc-500 font-medium">Memuat informasi profil dan sesi Anda...</p>
      </div>
    );
  }

  const currentUser = profileData?.user || user;
  const sessions: Session[] = profileData?.sessions || [];
  const isSessionLimitReached = sessions.length >= 2;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">
              Halo, {currentUser?.username}
            </h1>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Kelola profil akun dan pantau perangkat yang saat ini memiliki akses aktif
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => fetchProfile(true)}
            disabled={isRefreshing}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-all duration-200 shadow-xs cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-zinc-900' : 'text-zinc-500'}`} />
            <span>Segarkan</span>
          </button>
          <button
            onClick={logout}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 hover:text-zinc-900 rounded-lg transition-all duration-200 shadow-xs cursor-pointer"
          >
            <LogOut className="w-3.5 h-3.5 text-zinc-500" />
            <span>Keluar Sesi Ini</span>
          </button>
          <button
            onClick={logoutAll}
            className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-lg transition-all duration-200 shadow-xs cursor-pointer"
            title="Keluarkan akun dari semua perangkat aktif"
          >
            <LogOut className="w-3.5 h-3.5 text-red-500" />
            <span>Keluar Semua Perangkat</span>
          </button>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl p-6 shadow-card">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-zinc-100">
          <div className="flex items-center space-x-3.5">
            <div className="w-11 h-11 rounded-xl bg-zinc-900 text-white flex items-center justify-center font-semibold text-sm uppercase shadow-xs">
              {currentUser?.username?.slice(0, 2) || 'US'}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-semibold text-zinc-900">{currentUser?.username}</h2>
                <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/60 capitalize">
                  {currentUser?.role === 'admin' ? 'Administrator' : 'Pengguna'}
                </span>
              </div>
              <p className="text-xs text-zinc-500 mt-0.5">{currentUser?.email}</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-5 text-xs">
          <div>
            <span className="text-zinc-400 block mb-1">User Identifier (UUID)</span>
            <div className="flex items-center space-x-2">
              <span className="font-mono text-zinc-800 bg-zinc-50 border border-zinc-200/80 px-2 py-1 rounded text-[11px] select-all">
                {currentUser?.id}
              </span>
              <button
                onClick={() => currentUser?.id && handleCopyId(currentUser.id)}
                className="text-zinc-400 hover:text-zinc-700 p-1 rounded transition-colors cursor-pointer"
                title="Salin ID"
              >
                {copiedId ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
              </button>
            </div>
          </div>
          <div>
            <span className="text-zinc-400 block mb-1">Terdaftar Sejak</span>
            <span className="text-zinc-800 font-medium">
              {currentUser?.created_at ? formatDateTime(currentUser.created_at) : '-'}
            </span>
          </div>
        </div>
      </div>

      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="text-base font-semibold tracking-tight text-zinc-900">Perangkat & Sesi Aktif</h2>
            <p className="text-xs text-zinc-500 mt-0.5">
              Daftar perangkat yang saat ini memiliki token aktif untuk akun Anda
            </p>
          </div>
          <span className={`self-start sm:self-auto px-2.5 py-1 text-xs font-medium rounded-lg border ${
            isSessionLimitReached 
              ? 'bg-amber-50 text-amber-800 border-amber-200' 
              : 'bg-zinc-100 text-zinc-700 border-zinc-200'
          }`}>
            {sessions.length} dari 2 Sesi Aktif Digunakan
          </span>
        </div>

        <div className="p-4 bg-zinc-50 border border-zinc-200/80 rounded-xl flex items-start space-x-3 text-xs text-zinc-600 leading-relaxed">
          <Info className="w-4 h-4 text-zinc-500 flex-shrink-0 mt-0.5" />
          <div>
            <span className="font-medium text-zinc-900 block mb-0.5">Aturan Keamanan 2 Sesi:</span>
            Untuk menjaga keamanan akun Anda, sistem membatasi maksimal 2 perangkat aktif bersamaan. Apabila Anda login dari perangkat ketiga, perangkat yang paling lama tidak digunakan akan otomatis dikeluarkan dengan respon 401.
          </div>
        </div>

        {sessions.length === 0 ? (
          <div className="p-8 text-center text-xs text-zinc-400 bg-white border border-zinc-200 rounded-xl">
            Tidak ada sesi aktif yang ditemukan.
          </div>
        ) : (
          <div className="bg-white border border-zinc-200 rounded-2xl divide-y divide-zinc-200 shadow-card overflow-hidden">
            {sessions.map((sess) => {
              const { browser, os, deviceType } = parseUserAgent(sess.user_agent);

              return (
                <div
                  key={sess.id}
                  className={`p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 transition-colors ${
                    sess.is_current ? 'bg-zinc-50/70' : 'hover:bg-zinc-50/40'
                  }`}
                >
                  <div className="flex items-start space-x-3.5">
                    <div className="w-9 h-9 rounded-xl bg-white border border-zinc-200 flex items-center justify-center flex-shrink-0 mt-0.5 shadow-2xs">
                      {getDeviceIcon(deviceType)}
                    </div>
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="text-sm font-semibold text-zinc-900">
                          {browser} pada {os}
                        </span>
                        {sess.is_current && (
                          <span className="inline-flex items-center space-x-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-zinc-900 text-white">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            <span>Perangkat Ini</span>
                          </span>
                        )}
                      </div>

                      {/* Metadata row with readable dates */}
                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-1 text-xs text-zinc-500">
                        <span className="inline-flex items-center space-x-1 font-mono text-zinc-600">
                          <MapPin className="w-3 h-3 text-zinc-400" />
                          <span>IP {sess.ip_address || '127.0.0.1'}</span>
                        </span>
                        <span className="inline-flex items-center space-x-1">
                          <Clock className="w-3 h-3 text-zinc-400" />
                          <span>Waktu Masuk: {formatDateTime(sess.created_at)}</span>
                        </span>
                      </div>

                      {/* Raw UA Tooltip / subtle view */}
                      <p className="text-[10px] text-zinc-400 mt-1 truncate max-w-md" title={sess.user_agent}>
                        {sess.user_agent}
                      </p>
                    </div>
                  </div>

                  <div className="self-end sm:self-center">
                    <span className="inline-flex items-center space-x-1.5 text-xs text-zinc-700 font-medium bg-white px-2.5 py-1 rounded-md border border-zinc-200 shadow-2xs">
                      <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                      <span>Sesi Valid</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};
