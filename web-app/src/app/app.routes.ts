import { Routes } from '@angular/router';
import { superAdminGuard, merchantAdminGuard, riderGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    redirectTo: 'explorar'
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login.component').then(m => m.LoginComponent),
    title: 'Iniciar Sesión | Pídetelo'
  },
  {
    path: 'reset-password',
    loadComponent: () => import('./features/auth/reset-password/reset-password.component').then(m => m.ResetPasswordComponent),
    title: 'Restablecer Contraseña | Pídetelo'
  },
  {
    path: 'super-admin',
    canActivate: [superAdminGuard],
    loadComponent: () => import('./features/super-admin/super-admin.component').then(m => m.SuperAdminComponent),
    title: 'SuperAdmin | Pídetelo'
  },
  {
    path: 'merchant-admin',
    canActivate: [merchantAdminGuard],
    loadComponent: () => import('./features/merchant-admin/merchant-admin.component').then(m => m.MerchantAdminComponent),
    title: 'Panel Comercio | Pídetelo'
  },
  {
    path: 'rider',
    canActivate: [riderGuard],
    loadComponent: () => import('./features/rider-app/rider-app.component').then(m => m.RiderAppComponent),
    title: 'App Motorizados | Pídetelo'
  },
  {
    path: 'track',
    loadComponent: () => import('./features/customer-tracking/customer-tracking.component').then(m => m.CustomerTrackingComponent),
    title: 'Rastrear Pedido | Pídetelo'
  },
  {
    path: 'track/:orderId',
    loadComponent: () => import('./features/customer-tracking/customer-tracking.component').then(m => m.CustomerTrackingComponent),
    title: 'Rastreo en Vivo de tu Pedido'
  },
  {
    path: 't/:slug',
    loadComponent: () => import('./features/tenant-store/pages/store-view/store-view.component').then(m => m.StoreViewComponent),
    title: 'Menú Express WhatsApp | Pedido Online'
  },
  {
    path: 'explorar',
    loadComponent: () => import('./features/marketplace/pages/marketplace-home/marketplace-home.component').then(m => m.MarketplaceHomeComponent),
    title: 'Marketplace | Restaurantes y Comercios Cercanos'
  },
  {
    path: 'merchan-admin',
    redirectTo: 'merchant-admin'
  },
  {
    path: 'admin',
    redirectTo: 'merchant-admin'
  },
  {
    path: '**',
    redirectTo: 'explorar'
  }
];
