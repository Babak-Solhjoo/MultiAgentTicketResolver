import { Component, ChangeDetectorRef, HostListener, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../api.service';

@Component({
  selector: 'app-create-ticket-page',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './create-ticket-page.html',
  styleUrl: './create-ticket-page.css'
})
export class CreateTicketPage {
  private api = inject(ApiService);
  private cdr = inject(ChangeDetectorRef);

  rawText = '';
  title = '';
  type = 'INC';
  typeOpen = false;
  typeOptions = [
    { value: 'INC', label: 'Incident (INC)' },
    { value: 'TSK', label: 'Task (TSK)' }
  ];
  company = '';
  priority = 'Automatic';
  assignees: string[] = ['Automatic'];
  assigneeOptions = [
    'Automatic',
    'Backend Team',
    'Frontend Team',
    'Auth Team',
    'Billing Team',
    'Infra Team',
    'Automation Lane'
  ];
  assigneeOpen = false;
  status = '';
  error = '';
  busy = false;

  get assigneeLabel(): string {
    if (this.assignees.length === 0) return 'Select assignees';
    if (this.assignees.includes('Automatic')) return 'Automatic';
    return this.assignees.join(', ');
  }

  get typeLabel(): string {
    const match = this.typeOptions.find((option) => option.value === this.type);
    return match ? match.label : 'Select type';
  }

  toggleTypeOpen(): void {
    this.typeOpen = !this.typeOpen;
  }

  selectType(option: { value: string; label: string }): void {
    this.type = option.value;
    this.typeOpen = false;
  }

  toggleAssigneeOpen(): void {
    this.assigneeOpen = !this.assigneeOpen;
  }

  @HostListener('document:click', ['$event'])
  onDocumentClick(event: MouseEvent): void {
    const target = event.target as HTMLElement;
    if (!target.closest('.assignee-select')) {
      this.assigneeOpen = false;
    }
    if (!target.closest('.type-select')) {
      this.typeOpen = false;
    }
  }

  isAssigneeSelected(option: string): boolean {
    return this.assignees.includes(option);
  }

  toggleAssignee(option: string, checked: boolean): void {
    if (checked) {
      if (option === 'Automatic') {
        this.assignees = ['Automatic'];
        return;
      }
      this.assignees = this.assignees.filter((item) => item !== 'Automatic');
      if (!this.assignees.includes(option)) {
        this.assignees = [...this.assignees, option];
      }
      return;
    }

    this.assignees = this.assignees.filter((item) => item !== option);
  }

  async submitTicket(): Promise<void> {
    if (!this.rawText.trim()) return;
    this.busy = true;
    this.error = '';
    this.status = '';
    const watchdog = window.setTimeout(() => {
      if (this.busy) {
        this.error = 'Request timed out. Please try again.';
        this.status = '';
        this.busy = false;
        this.cdr.detectChanges();
      }
    }, 8000);
    try {
      await this.api.request('/tickets', {
        method: 'POST',
        body: {
          title: this.title.trim() || null,
          type: this.type,
          rawText: this.rawText,
          company: this.company.trim() || null,
          priority: this.priority,
          assignees: this.assignees.length > 0 ? this.assignees : null
        }
      });
      this.status = 'Ticket created.';
      this.rawText = '';
      this.title = '';
      this.type = 'INC';
      this.typeOpen = false;
      this.company = '';
      this.priority = 'Automatic';
      this.assignees = ['Automatic'];
      this.assigneeOpen = false;
    } catch (err) {
      this.error = err instanceof Error ? err.message : 'Failed to create ticket';
    } finally {
      window.clearTimeout(watchdog);
      this.busy = false;
      this.cdr.detectChanges();
    }
  }
}
