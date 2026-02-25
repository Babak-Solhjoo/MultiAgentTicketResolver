import { Injectable } from '@angular/core';

@Injectable({ providedIn: 'root' })
export class AuthService {
  token = localStorage.getItem('token') || '';
  role = localStorage.getItem('role') || 'agent';

  get isAuthed(): boolean {
    return Boolean(this.token);
  }

  setAuth(token: string, role: string): void {
    this.token = token;
    this.role = role || 'agent';
    localStorage.setItem('token', this.token);
    localStorage.setItem('role', this.role);
  }

  clear(): void {
    this.token = '';
    this.role = 'agent';
    localStorage.removeItem('token');
    localStorage.removeItem('role');
  }
}
