import { inject } from '@angular/core';
import { Router, CanActivateFn } from '@angular/router';
import { AuthStore } from '../stores/auth.store';

/**
 * Guard para proteger el panel SuperAdmin (Solo rol SUPER_ADMIN).
 * Si no está logueado, redirige a /login guardando la URL a la que intentaba acceder.
 * Si está logueado pero no tiene permisos de SuperAdmin, lo redirige a su panel respectivo.
 */
export const superAdminGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!auth.isAuthenticated() || !user) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (user.role === 'SUPER_ADMIN') {
    return true;
  }

  // Redirigir según el rol del usuario si no tiene acceso a SuperAdmin
  const isMerchantRole = ['MERCHANT_OWNER', 'MERCHANT_MANAGER', 'MERCHANT_KITCHEN', 'MERCHANT_DISPATCH'].includes(user.role);
  if (isMerchantRole) {
    return router.createUrlTree(['/merchant-admin']);
  } else if (user.role === 'RIDER') {
    return router.createUrlTree(['/rider']);
  }

  // Si no tiene permisos de SuperAdmin y es cliente u otro rol, pedir iniciar sesión con la cuenta correspondiente
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Guard para proteger el panel Merchant Admin (Dueños, Encargados de Sede, Cocina, Despacho, SuperAdmin).
 * Si no está logueado, bloquea el acceso y redirige a /login.
 * Si está logueado pero no pertenece al comercio (ej. Repartidor o Cliente final), redirige adecuadamente.
 */
export const merchantAdminGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!auth.isAuthenticated() || !user) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  // El SuperAdmin tiene su propio panel central y no debe ingresar como usuario del comercio
  if (user.role === 'SUPER_ADMIN') {
    return router.createUrlTree(['/super-admin']);
  }

  const allowedRoles = [
    'MERCHANT_OWNER',
    'MERCHANT_MANAGER',
    'MERCHANT_KITCHEN',
    'MERCHANT_DISPATCH'
  ];

  if (allowedRoles.includes(user.role)) {
    return true;
  }

  if (user.role === 'RIDER') {
    return router.createUrlTree(['/rider']);
  }

  // Si es un cliente o no tiene rol administrativo, enviarlo al login para autenticarse con la cuenta correcta
  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Guard para proteger la app de Motorizados / Repartidores (Solo RIDER).
 */
export const riderGuard: CanActivateFn = (route, state) => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  const user = auth.currentUser();
  if (!auth.isAuthenticated() || !user) {
    return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
  }

  if (user.role === 'SUPER_ADMIN') {
    return router.createUrlTree(['/super-admin']);
  }

  if (user.role === 'RIDER') {
    return true;
  }

  const isMerchantRole = ['MERCHANT_OWNER', 'MERCHANT_MANAGER', 'MERCHANT_KITCHEN', 'MERCHANT_DISPATCH'].includes(user.role);
  if (isMerchantRole) {
    return router.createUrlTree(['/merchant-admin']);
  }

  return router.createUrlTree(['/login'], { queryParams: { returnUrl: state.url } });
};

/**
 * Guard para evitar que usuarios ya autenticados ingresen a /login.
 * Si ya tienen una sesión activa (SuperAdmin, Comercio, Motorizado), no les permite
 * acceder a la pantalla de login y los redirige a su panel de trabajo respectivo.
 * Para poder acceder al login, deben cerrar sesión previamente.
 */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthStore);
  const router = inject(Router);

  if (!auth.isAuthenticated()) {
    return true;
  }

  const user = auth.currentUser();
  if (!user) {
    return true;
  }

  if (user.role === 'SUPER_ADMIN') {
    return router.createUrlTree(['/super-admin']);
  }

  const isMerchantRole = [
    'MERCHANT_OWNER',
    'MERCHANT_MANAGER',
    'MERCHANT_KITCHEN',
    'MERCHANT_DISPATCH'
  ].includes(user.role);

  if (isMerchantRole) {
    return router.createUrlTree(['/merchant-admin']);
  }

  if (user.role === 'RIDER') {
    return router.createUrlTree(['/rider']);
  }

  return router.createUrlTree(['/explorar']);
};

