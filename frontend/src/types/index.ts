export interface User {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  created_at: string;
}

export interface Session {
  id: string;
  user_agent: string;
  ip_address: string;
  created_at: string;
  expires_at: string;
  is_current: boolean;
}

export interface UserProfileResponse {
  user: User;
  sessions: Session[];
}

export interface AdminUserItem {
  id: string;
  email: string;
  username: string;
  role: 'user' | 'admin';
  created_at: string;
  active_sessions_count: number;
}

export interface LoginResponse {
  token: string;
  user: User;
}

export interface RegisterResponse {
  message: string;
  user: User;
}
