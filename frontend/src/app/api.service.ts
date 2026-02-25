import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse, HttpHeaders } from '@angular/common/http';
import { TimeoutError, firstValueFrom, timeout } from 'rxjs';
import { AuthService } from './auth.service';

const API_BASE = '/api';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);

  async request<T>(
    path: string,
    options: { method?: string; body?: unknown } = {}
  ): Promise<T> {
    const headers = new HttpHeaders({
      'Content-Type': 'application/json',
      ...(this.auth.token ? { Authorization: `Bearer ${this.auth.token}` } : {})
    });

    try {
      return await firstValueFrom(
        this.http
          .request<T>(options.method || 'GET', `${API_BASE}${path}`, {
            headers,
            body: options.body
          })
          .pipe(timeout(8000))
      );
    } catch (err) {
      if (err instanceof TimeoutError) {
        throw new Error('Request timed out. Please try again.');
      }
      if (err instanceof HttpErrorResponse) {
        const message =
          (err.error && (err.error.detail || err.error.error)) ||
          'Request failed';
        if (err.status === 401) {
          this.auth.clear();
        }
        throw new Error(message);
      }
      throw err;
    }
  }
}
