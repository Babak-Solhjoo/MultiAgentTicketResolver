import { Component, OnInit, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, RouterModule } from '@angular/router';
import { ApiService } from '../api.service';

interface TicketDetail {
  id: number;
  ticket_id?: string;
  title: string;
  status: string;
  priority: string;
  company: string | null;
  assignees_json?: string | null;
  created_at?: string;
}

interface TicketDraft {
  problem?: string;
  environment?: string;
  reproduction?: string;
  impact?: string;
  user_intent?: string;
  confidence_json?: string | null;
  evidence_json?: string | null;
}

interface TicketUpdate {
  author: string;
  message: string;
  created_at?: string;
}

interface Negotiation {
  phase: string;
  transcript_json?: string | null;
  created_at?: string;
}

interface TicketLink {
  duplicate_of_ticket_id?: number | null;
  confidence?: number | null;
}

interface TranscriptLine {
  agent: string;
  message: string;
  evidence?: string;
}

@Component({
  selector: 'app-ticket-history-page',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  templateUrl: './ticket-history-page.html',
  styleUrl: './ticket-history-page.css'
})
export class TicketHistoryPage implements OnInit {
  private api = inject(ApiService);
  private route = inject(ActivatedRoute);
  private cdr = inject(ChangeDetectorRef);

  loading = true;
  error = '';
  ticket: TicketDetail | null = null;
  draft: TicketDraft | null = null;
  updates: TicketUpdate[] = [];
  negotiations: Negotiation[] = [];
  links: TicketLink[] = [];
  searchValue = '';
  approveBusy = false;
  saveBusy = false;
  editForm = { priority: 'Medium', company: '', assignees: [] as string[] };
  assigneeOpen = false;
  assigneeOptions = [
    'Automatic',
    'Backend Team',
    'Frontend Team',
    'Auth Team',
    'Billing Team',
    'Infra Team',
    'Automation Lane'
  ];
  priorityOptions = [
    { value: 'critical', label: 'Critical' },
    { value: 'high', label: 'High' },
    { value: 'medium', label: 'Medium' },
    { value: 'low', label: 'Low' }
  ];
  companyOptions = ['Unassigned', 'SoftTech', 'TechShop'];

  async ngOnInit(): Promise<void> {
    const id = this.route.snapshot.paramMap.get('id');
    if (!id) {
      this.loading = false;
      return;
    }

    await this.loadById(id);
  }

  async searchTicket(): Promise<void> {
    const value = this.searchValue.trim();
    if (!value) return;
    this.loading = true;
    this.error = '';
    const match = value.match(/^(INC|TSK)-(\d+)$/i);
    try {
      const res = await this.api.request<{
        ticket: TicketDetail;
        draft: TicketDraft | null;
        updates: TicketUpdate[];
        negotiations: Negotiation[];
        links: TicketLink[];
      }>(`/tickets/by-number/${encodeURIComponent(value)}`);
      this.applyHistory(res);
      return;
    } catch (err) {
      if (match) {
        try {
          const res = await this.api.request<{
            ticket: TicketDetail;
            draft: TicketDraft | null;
            updates: TicketUpdate[];
            negotiations: Negotiation[];
            links: TicketLink[];
          }>(`/tickets/${match[2]}`);
          this.applyHistory(res);
          return;
        } catch (fallbackErr) {
          this.error = fallbackErr instanceof Error ? fallbackErr.message : 'Failed to load ticket history';
          this.clearHistory();
          return;
        }
      }

      this.error = err instanceof Error ? err.message : 'Failed to load ticket history';
      this.clearHistory();
      return;
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async loadById(id: string): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const res = await this.api.request<{
        ticket: TicketDetail;
        draft: TicketDraft | null;
        updates: TicketUpdate[];
        negotiations: Negotiation[];
        links: TicketLink[];
      }>(`/tickets/${id}`);
      this.applyHistory(res);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load ticket history';
      this.clearHistory();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private async loadByNumber(number: string): Promise<void> {
    this.loading = true;
    this.error = '';
    try {
      const res = await this.api.request<{
        ticket: TicketDetail;
        draft: TicketDraft | null;
        updates: TicketUpdate[];
        negotiations: Negotiation[];
        links: TicketLink[];
      }>(`/tickets/by-number/${encodeURIComponent(number)}`);
      this.applyHistory(res);
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to load ticket history';
      this.clearHistory();
    } finally {
      this.loading = false;
      this.cdr.detectChanges();
    }
  }

  private applyHistory(res: {
    ticket: TicketDetail;
    draft: TicketDraft | null;
    updates: TicketUpdate[];
    negotiations: Negotiation[];
    links: TicketLink[];
  }): void {
    this.ticket = res.ticket;
    this.draft = res.draft;
    this.updates = res.updates || [];
    this.negotiations = res.negotiations || [];
    this.links = res.links || [];
    let assignees: string[] = [];
    if (res.ticket.assignees_json) {
      try {
        const parsed = JSON.parse(res.ticket.assignees_json);
        assignees = Array.isArray(parsed) ? parsed : [];
      } catch (err) {
        assignees = [res.ticket.assignees_json];
      }
    }
    this.editForm = {
      priority: this.priorityLabel(res.ticket.priority),
      company: res.ticket.company || '',
      assignees: Array.isArray(assignees) ? assignees : []
    };
  }

  private clearHistory(): void {
    this.ticket = null;
    this.draft = null;
    this.updates = [];
    this.negotiations = [];
    this.links = [];
    this.editForm = { priority: 'Medium', company: '', assignees: [] };
  }

  async saveSummary(): Promise<void> {
    if (!this.ticket || this.saveBusy) return;
    this.saveBusy = true;
    this.error = '';
    const watchdog = window.setTimeout(() => {
      if (this.saveBusy) {
        this.error = 'Save timed out. Please try again.';
        this.saveBusy = false;
        this.cdr.detectChanges();
      }
    }, 8000);
    try {
      await this.api.request(`/tickets/${this.ticket.id}`, {
        method: 'PATCH',
        body: {
          priority: this.editForm.priority,
          company: this.editForm.company || null,
          assignees: this.editForm.assignees.length > 0 ? this.editForm.assignees : null
        }
      });
      await this.loadById(String(this.ticket.id));
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to save summary';
    } finally {
      window.clearTimeout(watchdog);
      this.saveBusy = false;
      this.cdr.detectChanges();
    }
  }

  get assigneeLabel(): string {
    if (this.editForm.assignees.length === 0) return 'Select assignees';
    if (this.editForm.assignees.includes('Automatic')) return 'Automatic';
    return this.editForm.assignees.join(', ');
  }

  toggleAssigneeOpen(): void {
    this.assigneeOpen = !this.assigneeOpen;
  }

  isAssigneeSelected(option: string): boolean {
    return this.editForm.assignees.includes(option);
  }

  toggleAssignee(option: string, checked: boolean): void {
    if (checked) {
      if (option === 'Automatic') {
        this.editForm.assignees = ['Automatic'];
        return;
      }
      this.editForm.assignees = this.editForm.assignees.filter((item) => item !== 'Automatic');
      if (!this.editForm.assignees.includes(option)) {
        this.editForm.assignees = [...this.editForm.assignees, option];
      }
      return;
    }

    this.editForm.assignees = this.editForm.assignees.filter((item) => item !== option);
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.assignee-select')) {
      this.assigneeOpen = false;
    }
  }

  async approveTicket(): Promise<void> {
    if (!this.ticket || this.approveBusy) return;
    this.approveBusy = true;
    this.error = '';
    try {
      await this.api.request(`/tickets/${this.ticket.id}/approve`, { method: 'POST' });
      await this.loadById(String(this.ticket.id));
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to approve ticket';
    } finally {
      this.approveBusy = false;
      this.cdr.detectChanges();
    }
  }

  ticketNumber(): string {
    if (!this.ticket) return '';
    const raw = this.ticket.ticket_id ? String(this.ticket.ticket_id).trim() : '';
    if (/^(INC|TSK)-\d+$/i.test(raw)) {
      return raw.toUpperCase();
    }
    if (/^\d+$/.test(raw)) {
      return `INC-${raw}`;
    }
    return `INC-${this.ticket.id}`;
  }

  statusLabel(value: string): string {
    if (value === 'pending_approval' || value === 'pending_info') return 'Pending Approval';
    if (value === 'open') return 'New';
    if (value === 'in_progress') return 'In Progress';
    if (value === 'resolved') return 'Resolved';
    return value;
  }

  isPending(value: string): boolean {
    return value === 'pending_approval' || value === 'pending_info';
  }

  priorityLabel(value: string): string {
    const match = this.priorityOptions.find((option) => option.value === value);
    return match ? match.label : value;
  }

  formatAssignees(value?: string | null): string {
    if (!value) return 'Unassigned';
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

  parseTranscript(value?: string | null): TranscriptLine[] {
    if (!value) return [];
    if (Array.isArray(value)) return value as TranscriptLine[];
    if (typeof value === 'object') return [];
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? parsed : [];
    } catch (err) {
      return [];
    }
  }

  parseJson(value?: string | null): string {
    if (!value) return '';
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    try {
      const parsed = JSON.parse(value);
      return JSON.stringify(parsed, null, 2);
    } catch (err) {
      return value;
    }
  }

  parseKeyValues(value?: string | null): Array<{ key: string; value: string }> {
    if (!value) return [];
    let obj: Record<string, unknown> | null = null;
    if (typeof value === 'object') {
      obj = value as Record<string, unknown>;
    } else {
      try {
        const parsed = JSON.parse(value);
        if (parsed && typeof parsed === 'object') {
          obj = parsed as Record<string, unknown>;
        }
      } catch (err) {
        return [];
      }
    }

    if (!obj) return [];
    return Object.entries(obj).map(([key, val]) => ({
      key,
      value: typeof val === 'string' ? val : JSON.stringify(val)
    }));
  }
}
