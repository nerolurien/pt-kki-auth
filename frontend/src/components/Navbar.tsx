import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Shield, LogOut } from 'lucide-react';

export const Navbar: React.FC = () => {
  const { user, isAuthenticated, isAdmin, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  const isActive = (path: string) => location.pathname === path;

  return (
    <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-zinc-200/80">
      <div className="max-w-6xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
        <div className="flex items-center space-x-6">
          <Link to={isAuthenticated ? '/profile' : '/login'} className="flex items-center space-x-2.5 group">
            <div className="w-6 h-6 rounded-md bg-zinc-900 flex items-center justify-center text-white shadow-xs group-hover:bg-zinc-800 transition-colors">
              <span className="font-semibold text-xs tracking-tighter">K</span>
            </div>
            <div className="flex items-center space-x-1.5">
              <span className="font-semibold text-sm tracking-tight text-zinc-900">KKI</span>
              <span className="text-zinc-300">/</span>
              <span className="text-xs text-zinc-500 font-medium">Auth System</span>
            </div>
          </Link>

          {isAuthenticated && (
            <nav className="hidden sm:flex items-center space-x-1 pl-2">
              <Link
                to="/profile"
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ease-in-out ${
                  isActive('/profile')
                    ? 'text-zinc-900 bg-zinc-100'
                    : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                Profil & Sesi
              </Link>
              {isAdmin && (
                <Link
                  to="/admin/users"
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-all duration-200 ease-in-out ${
                    isActive('/admin/users')
                      ? 'text-zinc-900 bg-zinc-100'
                      : 'text-zinc-500 hover:text-zinc-900 hover:bg-zinc-50'
                  }`}
                >
                  Manajemen Pengguna
                </Link>
              )}
            </nav>
          )}
        </div>

        <div className="flex items-center space-x-3">
          {isAuthenticated ? (
            <>
              <div className="flex items-center space-x-2 text-xs text-zinc-600">
                <span className="font-medium text-zinc-900">{user?.username}</span>
                {isAdmin ? (
                  <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-700 border border-zinc-200/60">
                    <Shield className="w-3 h-3 text-zinc-500" />
                    <span>Admin</span>
                  </span>
                ) : (
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-medium bg-zinc-100 text-zinc-600 border border-zinc-200/60">
                    User
                  </span>
                )}
              </div>

              <div className="h-4 w-[1px] bg-zinc-200" />

              <button
                onClick={handleLogout}
                className="inline-flex items-center space-x-1.5 text-xs font-medium text-zinc-500 hover:text-zinc-900 hover:bg-zinc-100 px-2.5 py-1.5 rounded-md transition-all duration-200 ease-in-out"
                title="Keluar dari sesi saat ini"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </>
          ) : (
            <div className="flex items-center space-x-2">
              <Link
                to="/login"
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all duration-200 ease-in-out ${
                  isActive('/login')
                    ? 'text-zinc-900 bg-zinc-100'
                    : 'text-zinc-600 hover:text-zinc-900 hover:bg-zinc-50'
                }`}
              >
                Masuk
              </Link>
              <Link
                to="/register"
                className="px-3 py-1.5 text-xs font-medium text-white bg-zinc-900 hover:bg-zinc-800 rounded-md shadow-xs transition-all duration-200 ease-in-out"
              >
                Daftar Akun
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
