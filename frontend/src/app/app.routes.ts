import { Routes } from '@angular/router';
import { StatsPage } from './pages/stats-page';
import { CreateTicketPage } from './pages/create-ticket-page';
import { TicketHistoryPage } from './pages/ticket-history-page';

export const routes: Routes = [
  { path: '', redirectTo: 'stats', pathMatch: 'full' },
  { path: 'stats', component: StatsPage },
  { path: 'create', component: CreateTicketPage },
  { path: 'history', component: TicketHistoryPage },
  { path: 'history/:id', component: TicketHistoryPage },
  { path: '**', redirectTo: 'stats' }
];
