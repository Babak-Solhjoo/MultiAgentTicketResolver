import { Component, OnInit, OnDestroy, ChangeDetectorRef, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { NavigationEnd, Router } from '@angular/router';
import { Subject, filter, takeUntil } from 'rxjs';
import { ApiService } from '../api.service';

interface Ticket {
  id: number;
  ticket_id?: string;
  title: string;
  status: string;
  priority: string;
  company: string | null;
  assignees_json?: string | null;
  severity: string;
  team: string;
  sla_risk: number;
  created_at?: string;
}

@Component({
  selector: 'app-stats-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './stats-page.html',
  styleUrl: './stats-page.css'
})
export class StatsPage implements OnInit, OnDestroy {
  private api = inject(ApiService);
  private router = inject(Router);
  private cdr = inject(ChangeDetectorRef);
  private destroyed$ = new Subject<void>();

  tickets: Ticket[] = [];
  error = '';
  status = '';
  automationBusy = false;
  editing: Ticket | null = null;
  editForm = { title: '', status: 'open', priority: 'Medium', company: '', assignees: [] as string[] };
  assigneeOptions = [
    'Automatic',
    'Backend Team',
    'Frontend Team',
    'Auth Team',
    'Billing Team',
    'Infra Team',
    'Automation Lane'
  ];

  statusOptions = [
    { value: 'open', label: 'New' },
    { value: 'pending_info', label: 'Pending Approval' },
    { value: 'in_progress', label: 'In Progress' },
    { value: 'resolved', label: 'Resolved' }
  ];

  priorityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];

  async ngOnInit(): Promise<void> {
    await this.loadTickets();
    this.router.events
      .pipe(
        filter((event) => event instanceof NavigationEnd),
        takeUntil(this.destroyed$)
      )
      .subscribe(() => {
        if (this.router.url.startsWith('/stats')) {
          this.loadTickets();
        }
      });
  }

  ngOnDestroy(): void {
    this.destroyed$.next();
    this.destroyed$.complete();
  }

  async loadTickets(): Promise<void> {
    try {
      const res = await this.api.request<{ tickets: Ticket[] }>('/tickets');
      this.tickets = res.tickets || [];
      this.cdr.detectChanges();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load tickets';
    }
  }

  async runAutomation(): Promise<void> {
    if (this.automationBusy) return;
    this.automationBusy = true;
    this.error = '';
    this.status = '';
    try {
      const res = await this.api.request<{ processed: number; skipped: number }>(
        '/tickets/automate-open',
        { method: 'POST' }
      );
      this.status = `Automation completed. Processed ${res.processed}, skipped ${res.skipped}.`;
      await this.loadTickets();
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to run automation';
    } finally {
      this.automationBusy = false;
      this.cdr.detectChanges();
    }
  }

  get statusStats(): Array<{ label: string; count: number }> {
    return this.statusOptions.map((option) => ({
      label: option.label,
      count: this.tickets.filter((ticket) => this.statusKey(ticket.status) === option.value).length
    }));
  }

  get statusMax(): number {
    return Math.max(1, ...this.statusStats.map((item) => item.count));
  }

  get priorityStats(): Array<{ label: string; count: number }> {
    const openTickets = this.tickets.filter((ticket) => ticket.status !== 'resolved');
    return this.priorityOptions.map((option) => ({
      label: option.label,
      count: openTickets.filter((ticket) => ticket.priority === option.value).length
    }));
  }

  get priorityMax(): number {
    return Math.max(1, ...this.priorityStats.map((item) => item.count));
  }

  get companyStats(): Array<{ label: string; count: number }> {
    const counts = new Map<string, number>();
    for (const ticket of this.tickets) {
      const label = ticket.company || 'Unassigned';
      counts.set(label, (counts.get(label) || 0) + 1);
    }
    return Array.from(counts.entries())
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 6);
  }

  get companyMax(): number {
    return Math.max(1, ...this.companyStats.map((item) => item.count));
  }

  get recentTickets(): Ticket[] {
    return [...this.tickets].slice(0, 8);
  }

  formatAssignees(value?: string | null): string {
    if (!value) return '';
    try {
      const parsed = JSON.parse(value);
      if (Array.isArray(parsed)) {
        return parsed.join(', ');
      }
    } catch (err) {
      return value;
    }
    return value;
  }

  statusLabel(value: string): string {
    const match = this.statusOptions.find((option) => option.value === this.statusKey(value));
    return match ? match.label : value;
  }

  statusKey(value: string): string {
    if (value === 'pending_approval') return 'pending_info';
    return value;
  }

  isNew(value: string): boolean {
    return this.statusKey(value) === 'open';
  }

  isPending(value: string): boolean {
    return this.statusKey(value) === 'pending_info';
  }

  isInProgress(value: string): boolean {
    return this.statusKey(value) === 'in_progress';
  }

  isResolved(value: string): boolean {
    return this.statusKey(value) === 'resolved';
  }

  priorityLabel(value: string): string {
    const match = this.priorityOptions.find((option) => option.value === value);
    return match ? match.label : value;
  }

  barWidth(count: number, max: number): string {
    return `${Math.round((count / Math.max(1, max)) * 100)}%`;
  }

  ticketNumber(ticket: Ticket): string {
    const raw = ticket.ticket_id ? String(ticket.ticket_id).trim() : '';
    if (/^(INC|TSK)-\d+$/i.test(raw)) {
      return raw.toUpperCase();
    }
    if (/^\d+$/.test(raw)) {
      return `INC-${raw}`;
    }
    if (ticket.id !== undefined && ticket.id !== null) {
      return `INC-${ticket.id}`;
    }
    return raw || 'INC-?';
  }

  goToHistory(ticket: Ticket): void {
    this.router.navigate(['/history', ticket.id]);
  }

  startEdit(ticket: Ticket): void {
    const assignees = ticket.assignees_json
      ? JSON.parse(ticket.assignees_json)
      : [];
    this.editing = ticket;
    this.editForm = {
      title: ticket.title,
      status: ticket.status,
      priority: this.priorityLabel(ticket.priority),
      company: ticket.company || '',
      assignees: Array.isArray(assignees) ? assignees : []
    };
  }

  cancelEdit(): void {
    this.editing = null;
  }

  async saveEdit(): Promise<void> {
    if (!this.editing) return;
    try {
      await this.api.request(`/tickets/${this.editing.id}`, {
        method: 'PATCH',
        body: {
          title: this.editForm.title,
          status: this.editForm.status,
          priority: this.editForm.priority,
          company: this.editForm.company || null,
          assignees: this.editForm.assignees.length > 0 ? this.editForm.assignees : null
        }
      });
      await this.loadTickets();
      this.editing = null;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to update ticket';
    }
  }
}
