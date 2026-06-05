import type { User } from './types';
import { authApi } from './api';

export interface AuthState {
  user: User | null;
  token: string | null;
  isAuthenticated: boolean;
}

type AuthListener = (state: AuthState) => void;

class AuthService {
  private listeners: AuthListener[] = [];

  getState(): AuthState {
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    let user: User | null = null;
    if (userStr) {
      try {
        user = JSON.parse(userStr);
      } catch {
        user = null;
      }
    }
    return {
      user,
      token,
      isAuthenticated: !!token && !!user,
    };
  }

  subscribe(listener: AuthListener): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach(l => l(state));
  }

  async login(username: string, password: string): Promise<void> {
    const token = await authApi.login(username, password);
    localStorage.setItem('token', token.access_token);
    const user = await authApi.getMe();
    localStorage.setItem('user', JSON.stringify(user));
    this.notify();
  }

  logout() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.notify();
  }

  getRole(): string | null {
    return this.getState().user?.role || null;
  }

  isAdmin(): boolean {
    return this.getRole() === 'admin';
  }

  isStaff(): boolean {
    const role = this.getRole();
    return role === 'admin' || role === 'staff';
  }

  isObserver(): boolean {
    return !!this.getRole();
  }
}

export const authService = new AuthService();
