import React, { useEffect, useState, useCallback } from 'react';
import apiClient from '../api/client';
import { AdminUserItem } from '../types';
import { formatDateTime } from '../utils/format';
import { 
  Search, 
  RefreshCw,
  X,
  AlertCircle,
  CheckCircle2,
  Users,
  Radio,
  Shield,
  PowerOff
} from 'lucide-react';
import axios from 'axios';

export const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<AdminUserItem[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Confirmation Modal
  const [selectedUser, setSelectedUser] = useState<AdminUserItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const fetchUsers = useCallback(async (isBackground = false) => {
    if (!isBackground) setIsLoading(true);
    else setIsRefreshing(true);

    try {
      const response = await apiClient.get<{ users: AdminUserItem[]; total: number }>('/admin/users');
      setUsers(response.data.users || []);
    } catch (err: unknown) {
      console.warn('Failed to fetch admin users:', err);
    } finally {
      setIsLoading(false);
      setIsRefreshing(false);
    }
  }, []);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleForceLogout = async () => {
    if (!selectedUser) return;

    setIsSubmitting(true);
    setFeedback(null);
    try {
      const response = await apiClient.post(`/admin/users/${selectedUser.id}/force-logout`);
      setFeedback({
        type: 'success',
        message: response.data.message || `Seluruh sesi aktif pengguna "${selectedUser.username}" berhasil diputus.`,
      });
      setSelectedUser(null);
      await fetchUsers(true);
    } catch (err: unknown) {
      let errText = 'Gagal memutus sesi pengguna.';
      if (axios.isAxiosError(err) && err.response?.data?.error) {
        errText = err.response.data.error;
      }
      setFeedback({
        type: 'error',
        message: errText,
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const filteredUsers = users.filter((u) => {
    const q = searchTerm.toLowerCase();
    return u.username.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
  });

  const totalSessions = users.reduce((acc, curr) => acc + curr.active_sessions_count, 0);
  const totalAdmins = users.filter((u) => u.role === 'admin').length;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10 space-y-8">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 pb-6 border-b border-zinc-200">
        <div>
          <div className="flex items-center space-x-2">
            <h1 className="text-2xl font-semibold tracking-tight text-zinc-900">Manajemen Pengguna</h1>
            <span className="px-2 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200">
              Admin Only
            </span>
          </div>
          <p className="text-sm text-zinc-500 mt-1">
            Pantau status pengguna secara real-time dan kelola sesi aktif akun
          </p>
        </div>
        <button
          onClick={() => fetchUsers(true)}
          disabled={isRefreshing}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 rounded-lg hover:bg-zinc-50 transition-all duration-200 shadow-xs self-start sm:self-auto cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-zinc-900' : 'text-zinc-500'}`} />
          <span>Segarkan Data</span>
        </button>
      </div>

      {feedback && (
        <div
          className={`p-3.5 rounded-xl border text-xs flex items-center justify-between transition-all ${
            feedback.type === 'success'
              ? 'bg-zinc-50 border-zinc-200 text-zinc-800'
              : 'bg-red-50 border-red-200 text-red-700'
          }`}
        >
          <div className="flex items-center space-x-2.5">
            {feedback.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0" />
            )}
            <span className="font-medium">{feedback.message}</span>
          </div>
          <button onClick={() => setFeedback(null)} className="text-zinc-400 hover:text-zinc-600 cursor-pointer">
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
            <Users className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Total Pengguna Terdaftar</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-0.5 tracking-tight">{users.length}</p>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Total Sesi Aktif Berjalan</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-0.5 tracking-tight">{totalSessions}</p>
          </div>
        </div>

        <div className="bg-white border border-zinc-200 rounded-2xl p-5 shadow-xs flex items-center space-x-3.5">
          <div className="w-10 h-10 rounded-xl bg-zinc-100 border border-zinc-200 flex items-center justify-center text-zinc-700">
            <Shield className="w-5 h-5" />
          </div>
          <div>
            <p className="text-xs font-medium text-zinc-500">Akun Administrator</p>
            <p className="text-2xl font-semibold text-zinc-900 mt-0.5 tracking-tight">{totalAdmins}</p>
          </div>
        </div>
      </div>

      <div className="bg-white border border-zinc-200 rounded-2xl shadow-card overflow-hidden">
        <div className="p-4 border-b border-zinc-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="relative w-full sm:w-80">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-zinc-400">
              <Search className="w-3.5 h-3.5" />
            </div>
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Cari berdasarkan email atau username..."
              className="w-full bg-white border border-zinc-300 rounded-lg pl-8.5 pr-8 py-1.5 text-xs text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:ring-2 focus:ring-zinc-900/20 focus:border-zinc-900 transition-all duration-200 ease-in-out"
            />
            {searchTerm && (
              <button
                onClick={() => setSearchTerm('')}
                className="absolute inset-y-0 right-0 pr-2.5 flex items-center text-zinc-400 hover:text-zinc-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
          <span className="text-xs text-zinc-400">
            Menampilkan {filteredUsers.length} dari {users.length} pengguna
          </span>
        </div>

        {isLoading ? (
          <div className="py-16 text-center">
            <div className="w-5 h-5 border-2 border-zinc-900 border-t-transparent rounded-full animate-spin mx-auto" />
            <p className="text-xs text-zinc-400 mt-2 font-medium">Memuat data pengguna...</p>
          </div>
        ) : filteredUsers.length === 0 ? (
          <div className="py-16 text-center text-xs text-zinc-400">
            Tidak ada pengguna yang sesuai dengan pencarian "{searchTerm}".
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-zinc-50/75 border-b border-zinc-200 text-zinc-500 uppercase text-[11px] font-medium tracking-wider">
                  <th className="py-3 px-5">Pengguna</th>
                  <th className="py-3 px-5">Role</th>
                  <th className="py-3 px-5">Sesi Aktif</th>
                  <th className="py-3 px-5">Tanggal Bergabung</th>
                  <th className="py-3 px-5 text-right">Tindakan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 text-zinc-700">
                {filteredUsers.map((u) => (
                  <tr key={u.id} className="hover:bg-zinc-50/60 transition-colors">
                    <td className="py-3.5 px-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-8 h-8 rounded-lg bg-zinc-100 border border-zinc-200 flex items-center justify-center font-semibold text-xs text-zinc-700 uppercase">
                          {u.username.slice(0, 2)}
                        </div>
                        <div>
                          <div className="font-semibold text-zinc-900 leading-tight">{u.username}</div>
                          <div className="text-zinc-500 text-[11px] mt-0.5">{u.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="py-3.5 px-5">
                      <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/60 capitalize">
                        {u.role === 'admin' ? 'Admin' : 'User'}
                      </span>
                    </td>
                    <td className="py-3.5 px-5">
                      {u.active_sessions_count > 0 ? (
                        <span className="inline-flex items-center space-x-1.5 text-xs text-zinc-800 font-medium">
                          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                          <span>{u.active_sessions_count} Sesi Aktif</span>
                        </span>
                      ) : (
                        <span className="text-zinc-400 text-xs">Offline</span>
                      )}
                    </td>
                    <td className="py-3.5 px-5 text-zinc-500 text-xs">
                      {formatDateTime(u.created_at)}
                    </td>
                    <td className="py-3.5 px-5 text-right">
                      {u.active_sessions_count > 0 ? (
                        <button
                          onClick={() => setSelectedUser(u)}
                          className="inline-flex items-center space-x-1 text-red-600 hover:text-red-700 hover:bg-red-50 border border-transparent hover:border-red-100 px-2.5 py-1 rounded-md text-xs font-medium transition-all duration-150 cursor-pointer"
                        >
                          <PowerOff className="w-3 h-3" />
                          <span>Force Logout</span>
                        </button>
                      ) : (
                        <span className="text-zinc-300 text-xs italic">Tidak ada sesi</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* User-Friendly Confirmation Modal */}
      {selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-zinc-900/40 backdrop-blur-xs">
          <div className="bg-white border border-zinc-200 rounded-2xl max-w-sm w-full p-6 shadow-2xl">
            <h3 className="text-base font-semibold text-zinc-900 tracking-tight">
              Konfirmasi Pemutusan Sesi
            </h3>
            <p className="text-xs text-zinc-600 mt-2.5 leading-relaxed">
              Anda akan memutus <strong>{selectedUser.active_sessions_count} sesi aktif</strong> untuk akun <span className="font-semibold text-zinc-900">"{selectedUser.username}"</span>.
            </p>
            <p className="text-[11px] text-zinc-500 mt-1 leading-relaxed bg-zinc-50 p-2.5 rounded-lg border border-zinc-200/80">
              Pengguna ini akan langsung diminta untuk masuk kembali (login) pada semua perangkat yang sedang digunakannya.
            </p>

            <div className="mt-5 flex items-center justify-end space-x-2">
              <button
                type="button"
                onClick={() => setSelectedUser(null)}
                disabled={isSubmitting}
                className="px-3 py-1.5 text-xs font-medium text-zinc-700 bg-white border border-zinc-200 hover:bg-zinc-50 rounded-lg transition-all duration-150 cursor-pointer"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleForceLogout}
                disabled={isSubmitting}
                className="px-3.5 py-1.5 text-xs font-medium text-white bg-red-600 hover:bg-red-700 disabled:opacity-50 rounded-lg shadow-sm transition-all duration-150 cursor-pointer"
              >
                {isSubmitting ? 'Memproses...' : 'Ya, Putus Sesi'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
