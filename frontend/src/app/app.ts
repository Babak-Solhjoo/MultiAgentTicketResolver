import { Component, OnInit, inject, ChangeDetectorRef, ElementRef, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { AuthService } from './auth.service';
import { ApiService } from './api.service';

type AuthMode = 'login' | 'register';

@Component({
  selector: 'app-root',
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  private cdr = inject(ChangeDetectorRef);
  private host = inject(ElementRef<HTMLElement>);
  private auth = inject(AuthService);
  private api = inject(ApiService);

  authMode: AuthMode = 'login';
  authForm = { email: '', password: '', role: 'agent' };
  error = '';
  status = '';
  busy = false;
  aboutOpen = false;

  get isAuthed(): boolean {
    return this.auth.isAuthed;
  }

  get role(): string {
    return this.auth.role;
  }

  async ngOnInit(): Promise<void> {}

  setAuthMode(mode: AuthMode): void {
    this.authMode = mode;
    this.error = '';
    this.status = '';
  }

  async handleAuth(): Promise<void> {
    this.error = '';
    this.status = '';
    this.busy = true;
    try {
      this.status = this.authMode === 'login' ? 'Signing in...' : 'Creating account...';
      if (this.authMode === 'login') {
        const res = await this.request<{ token: string; role: string }>(
          '/auth/login',
          { method: 'POST', body: { email: this.authForm.email, password: this.authForm.password } }
        );
        this.auth.setAuth(res.token, res.role || 'agent');
        this.status = '';
        this.busy = false;
        this.cdr.detectChanges();
        return;
      } else {
        this.authMode = 'login';
        const requestPromise = this.request('/auth/register', {
          method: 'POST',
          body: {
            email: this.authForm.email,
            password: this.authForm.password,
            role: this.authForm.role
          }
        });
        let settled = false;
        const finalize = () => {
          if (settled) return;
          settled = true;
          this.busy = false;
        };

        window.setTimeout(() => {
          if (!settled) {
            this.status = 'Account request sent. Please try logging in.';
            finalize();
          }
        }, 2500);

        requestPromise
          .then(() => {
            this.status = 'Account created. Please log in.';
            this.authForm = { email: this.authForm.email, password: '', role: 'agent' };
            finalize();
          })
          .catch((err) => {
            this.error = err instanceof Error ? err.message : 'Auth failed';
            this.status = '';
            this.authMode = 'register';
            finalize();
          });
        return;
      }
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Auth failed';
      this.status = '';
      if (this.authMode === 'login') {
        this.authMode = 'register';
      }
    } finally {
      this.busy = false;
    }
  }

  logout(): void {
    this.auth.clear();
    this.aboutOpen = false;
  }

  toggleAbout(): void {
    this.aboutOpen = !this.aboutOpen;
  }

  @HostListener('document:click', ['$event'])
  handleOutsideClick(event: MouseEvent): void {
    if (!this.aboutOpen) return;
    const target = event.target as Node | null;
    const dropdown = this.host.nativeElement.querySelector('.nav-dropdown');
    if (dropdown && target && dropdown.contains(target)) return;
    this.aboutOpen = false;
  }

  private async request<T>(
    path: string,
    options: { method?: string; body?: unknown; token?: string } = {}
  ): Promise<T> {
    return this.api.request(path, options);
  }
}
