import { Routes } from '@angular/router';

export const routes: Routes = [
  { path: '', loadComponent: () => import('./publico/menu-publico').then((m) => m.MenuPublico), title: 'Casa Nápoles · Menú' },
  { path: 'admin', loadComponent: () => import('./admin/admin').then((m) => m.Admin), title: 'Casa Nápoles · Administrar menú' },
  { path: '**', redirectTo: '' },
];
