import { computed } from '@angular/core';
import { signalStore, withState, withComputed, withMethods, patchState } from '@ngrx/signals';
import { AppUser, Permission, ROLE_PERMISSIONS_PRESETS, UserRole } from '../models/user.model';

export interface AuthState {
  currentUser: AppUser | null;
  isAuthenticated: boolean;
  rolePermissions: Record<UserRole, Permission[]>;
}

export const DEMO_USERS: Record<string, AppUser> = {
  superadmin: {
    id: 'd1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c99',
    name: 'Jorge Medina',
    email: 'jorge@pidetelo.com',
    phone: '+584125163118',
    role: 'SUPER_ADMIN',
    permissions: [...ROLE_PERMISSIONS_PRESETS.SUPER_ADMIN],
    avatarUrl: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80',
    isActive: true
  }
};

function getInitialUser(): AppUser | null {
  if (typeof window !== 'undefined') {
    const raw = localStorage.getItem('deliveryhub_user');
    if (raw) {
      try {
        return JSON.parse(raw);
      } catch {
        // ignore
      }
    }
  }
  return null;
}

const initialUser = getInitialUser();

const initialState: AuthState = {
  currentUser: initialUser,
  isAuthenticated: Boolean(initialUser),
  rolePermissions: { ...ROLE_PERMISSIONS_PRESETS }
};

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed((store) => {
    const isSuperAdmin = computed(() => store.currentUser()?.role === 'SUPER_ADMIN');
    const isMerchant = computed(() => {
      const r = store.currentUser()?.role;
      return r === 'MERCHANT_OWNER' || r === 'MERCHANT_MANAGER' || r === 'MERCHANT_DISPATCH' || r === 'MERCHANT_KITCHEN';
    });
    const isRider = computed(() => store.currentUser()?.role === 'RIDER');
    const isCustomer = computed(() => store.currentUser()?.role === 'CUSTOMER');

    return {
      isSuperAdmin,
      isMerchant,
      isRider,
      isCustomer
    };
  }),
  withMethods((store) => ({
    login(user: AppUser): void {
      if (typeof window !== 'undefined') {
        localStorage.setItem('deliveryhub_user', JSON.stringify(user));
      }
      patchState(store, { currentUser: user, isAuthenticated: true });
    },

    loginAsRole(roleKey: 'superadmin'): void {
      const user = DEMO_USERS[roleKey];
      if (user) {
        // Apply current role permissions
        const perms = store.rolePermissions()[user.role] || user.permissions;
        const loggedUser = { ...user, permissions: perms };
        if (typeof window !== 'undefined') {
          localStorage.setItem('deliveryhub_user', JSON.stringify(loggedUser));
        }
        patchState(store, { 
          currentUser: loggedUser, 
          isAuthenticated: true 
        });
      }
    },

    loginAsRider(rider: { id: string; name: string; email?: string; phone?: string; vehiclePlate?: string; vehicleType?: string; vehicleModel?: string; tenantId?: string; nationalId?: string; avatarUrl?: string; paymentAccounts?: any[] }): void {
      const cleanName = rider.name || 'Repartidor';
      const email = rider.email || `${cleanName.toLowerCase().replace(/[^a-z0-9]/g, '.')}@deliveryhub.io`;
      const perms = store.rolePermissions()['RIDER'] || ROLE_PERMISSIONS_PRESETS.RIDER;
      const user: AppUser = {
        id: rider.id,
        name: cleanName,
        email: email,
        phone: rider.phone || '',
        role: 'RIDER',
        tenantId: rider.tenantId || '',
        tenantName: (rider as any).tenantName || 'Red Delivery',
        permissions: [...perms],
        avatarUrl: rider.avatarUrl || 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
        isActive: true,
        vehiclePlate: rider.vehiclePlate || '',
        vehicleType: (rider.vehicleType as any) || 'moto',
        vehicleModel: rider.vehicleModel,
        nationalId: rider.nationalId,
        paymentAccounts: rider.paymentAccounts || []
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('deliveryhub_user', JSON.stringify(user));
      }
      patchState(store, { currentUser: user, isAuthenticated: true });
    },

    loginAsCustomer(customer: { id?: string; name: string; email: string; phone?: string }): void {
      const user: AppUser = {
        id: customer.id || `cust_${Date.now()}`,
        name: customer.name,
        email: customer.email,
        phone: customer.phone || '',
        role: 'CUSTOMER',
        permissions: [...ROLE_PERMISSIONS_PRESETS.CUSTOMER],
        isActive: true
      };
      if (typeof window !== 'undefined') {
        localStorage.setItem('deliveryhub_user', JSON.stringify(user));
      }
      patchState(store, { currentUser: user, isAuthenticated: true });
    },

    logout(): void {
      if (typeof window !== 'undefined') {
        localStorage.removeItem('deliveryhub_user');
      }
      patchState(store, { currentUser: null, isAuthenticated: false });
    },

    hasPermission(permission: Permission): boolean {
      const user = store.currentUser();
      if (!user) return false;
      if (user.role === 'SUPER_ADMIN') return true;
      return user.permissions.includes(permission);
    },

    toggleRolePermission(role: UserRole, permission: Permission): void {
      const currentPerms = store.rolePermissions()[role] || [];
      const updated = currentPerms.includes(permission)
        ? currentPerms.filter(p => p !== permission)
        : [...currentPerms, permission];

      const newMatrix = {
        ...store.rolePermissions(),
        [role]: updated
      };

      patchState(store, { rolePermissions: newMatrix });

      // If current user is of that role, update their active permissions immediately
      if (store.currentUser()?.role === role) {
        patchState(store, {
          currentUser: {
            ...store.currentUser()!,
            permissions: updated
          }
        });
      }
    }
  }))
);
