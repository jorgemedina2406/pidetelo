import { Component, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { AuthStore } from '../../../core/stores/auth.store';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ApiService } from '../../../core/services/api.service';
import { ThemeService } from '../../../core/services/theme.service';
import { I18nService } from '../../../core/services/i18n.service';
import { IconComponent } from '../../../shared/components/icon.component';
import { AppUser, UserRole, ROLE_PERMISSIONS_PRESETS } from '../../../core/models/user.model';
import { firstValueFrom, timeout } from 'rxjs';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './login.component.html'
})
export class LoginComponent {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  private readonly supabase = inject(SupabaseService);
  private readonly api = inject(ApiService);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);

  readonly showPassword = signal(false);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly successMessage = signal<string | null>(null);
  readonly isSignUpMode = signal(false);

  email = '';
  password = '';
  fullName = '';
  selectedRole: UserRole = 'MERCHANT_OWNER';

  constructor() {
    if (this.auth.isAuthenticated()) {
      const user = this.auth.currentUser();
      if (user?.role === 'SUPER_ADMIN') {
        this.router.navigate(['/super-admin']);
      } else if (user && ['MERCHANT_OWNER', 'MERCHANT_MANAGER', 'MERCHANT_KITCHEN', 'MERCHANT_DISPATCH'].includes(user.role)) {
        this.router.navigate(['/merchant-admin']);
      } else if (user?.role === 'RIDER') {
        this.router.navigate(['/rider']);
      } else {
        this.router.navigate(['/explorar']);
      }
    }
  }

  async onManualLogin(e: Event): Promise<void> {
    e.preventDefault();
    this.errorMessage.set(null);
    this.successMessage.set(null);

    const emailTrim = (this.email || '').trim().toLowerCase();
    const passTrim = (this.password || '').trim();

    if (!emailTrim || !passTrim) {
      this.errorMessage.set('Por favor ingresa tu correo/usuario y tu contraseña.');
      return;
    }

    this.isSubmitting.set(true);

    try {
      if (this.isSignUpMode()) {
        // Registro en Supabase
        const { data, error } = await this.supabase.signUpWithEmail(
          emailTrim,
          passTrim,
          this.fullName || emailTrim.split('@')[0],
          this.selectedRole
        );

        if (error) {
          throw error;
        }

        this.successMessage.set('¡Cuenta creada exitosamente en Supabase! Ya puedes iniciar sesión con tu contraseña.');
        this.isSignUpMode.set(false);
        this.isSubmitting.set(false);
        return;
      }

      // 1. Verificación prioritaria de cuenta oficial SuperAdmin (jorge@pidetelo.com)
      if (emailTrim === 'jorge@pidetelo.com') {
        // Intentar validar contraseña con el backend local primero si responde rápido
        try {
          const storeUser = await firstValueFrom(
            this.api.loginStoreUser(emailTrim, passTrim).pipe(timeout(1500))
          );
          if (storeUser) {
            this.auth.login(storeUser);
            this.redirectByRole('SUPER_ADMIN');
            return;
          }
        } catch (suErr: any) {
          if (suErr.status === 401 || suErr.error?.message === 'Contraseña incorrecta') {
            throw new Error('Contraseña incorrecta para SuperAdmin.');
          }
        }

        // Validación de respaldo directo
        if (passTrim !== '123456') {
          throw new Error('Contraseña incorrecta para SuperAdmin.');
        }

        this.auth.loginAsRole('superadmin');
        this.redirectByRole('SUPER_ADMIN');
        return;
      }

      // 2. Intentar autenticar como dueño / colaborador del comercio (Backend API)
      try {
        const storeUser = await firstValueFrom(
          this.api.loginStoreUser(emailTrim, passTrim).pipe(timeout(2000))
        );
        if (storeUser) {
          this.auth.login(storeUser);
          this.redirectByRole(storeUser.role);
          return;
        }
      } catch (storeErr: any) {
        if (storeErr.error?.message?.includes('desactivada') || storeErr.message?.includes('desactivada')) {
          throw new Error(storeErr.error?.message || storeErr.message);
        }
        // Si no coincide la clave local, continuamos hacia Supabase Auth para verificar con su clave real
      }

      // 3. Verificar si es un motorizado registrado en la plataforma (Backend)
      try {
        const rider = await firstValueFrom(
          this.api.loginRider(emailTrim, passTrim).pipe(timeout(2000))
        );
        if (rider) {
          this.auth.loginAsRider({
            id: rider.id,
            name: rider.name || 'Repartidor',
            email: rider.email || emailTrim,
            phone: rider.phone,
            vehiclePlate: rider.vehicle_plate || rider.vehiclePlate,
            vehicleType: rider.vehicle_type || rider.vehicleType,
            vehicleModel: rider.vehicle_model || rider.vehicleModel,
            tenantId: rider.tenant_id,
            nationalId: rider.national_id || rider.nationalId,
            avatarUrl: rider.avatar_url || rider.avatarUrl,
            paymentAccounts: rider.payment_accounts || rider.paymentAccounts
          });
          this.redirectByRole('RIDER');
          return;
        }
      } catch (_) {}

      // 3.1 Respaldo local de motorizados registrados en navegador
      if (typeof window !== 'undefined') {
        try {
          const localRiders = JSON.parse(localStorage.getItem('deliveryhub_riders_auth') || '[]');
          const matched = localRiders.find((r: any) => 
            (r.email && r.email.toLowerCase() === emailTrim) ||
            (r.name && r.name.toLowerCase().trim() === emailTrim) ||
            (r.phone && r.phone.trim() === emailTrim)
          );
          if (matched && (!matched.password || matched.password === passTrim)) {
            this.auth.loginAsRider({
              id: matched.id || 'rider-local',
              name: matched.name,
              email: matched.email || emailTrim,
              phone: matched.phone,
              vehiclePlate: matched.vehicle_plate || matched.vehiclePlate,
              vehicleType: matched.vehicle_type || matched.vehicleType,
              vehicleModel: matched.vehicle_model || matched.vehicleModel,
              tenantId: matched.tenant_id,
              nationalId: matched.national_id || matched.nationalId,
              avatarUrl: matched.avatar_url || matched.avatarUrl,
              paymentAccounts: matched.payment_accounts || matched.paymentAccounts
            });
            this.redirectByRole('RIDER');
            return;
          }
        } catch (_) {}
      }

      // 4. Intento de inicio de sesión en Supabase con timeout de protección
      try {
        const supaPromise = this.supabase.signInWithEmail(emailTrim, passTrim);
        const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase Auth')), 3000)
        );
        const { data, error } = await Promise.race([supaPromise, timeoutPromise]);

        if (data?.user) {
          const user = data.user;
          const userEmail = (user.email || emailTrim).toLowerCase().trim();
          const profile = await this.supabase.getUserProfile(user.id);

          let role: UserRole = (profile?.role as UserRole) || (user.user_metadata?.['role'] as UserRole);
          let tenantId = profile?.tenant_id || user.user_metadata?.['tenant_id'];
          let tenantName = profile?.tenants?.name || user.user_metadata?.['tenant_name'];
          let branchId = profile?.branch_id || user.user_metadata?.['branch_id'];
          let branchName = profile?.branch_name || user.user_metadata?.['branch_name'];

          const isSuperAdminEmail = userEmail === 'jorge@pidetelo.com' || userEmail === 'admin@pidetelo.app';
          const isBranchEmail = userEmail.includes('trinitarias') || userEmail.includes('sucursal') || userEmail.includes('sede');
          const isMerchantEmail = userEmail.includes('@comercio.com') || userEmail.includes('burgerking') || userEmail.includes('mcdonalds') || userEmail.includes('willsteak') || userEmail.includes('comercio');
          const isRiderEmail = userEmail.includes('repartidor') || userEmail.includes('rider');

          if (!role || role === 'CUSTOMER') {
            if (isSuperAdminEmail) role = 'SUPER_ADMIN';
            else if (isBranchEmail) role = 'MERCHANT_MANAGER';
            else if (isMerchantEmail) role = 'MERCHANT_OWNER';
            else if (isRiderEmail) role = 'RIDER';
          }

          const rawClient = this.supabase.rawClient;

          // Si falta tenantId o datos de comercio, buscar exhaustivamente en la base de datos
          if (rawClient && !tenantId) {
            try {
              const { data: collab } = await rawClient
                .from('store_collaborators')
                .select('*, tenants(id, name), branches(id, name)')
                .eq('email', userEmail)
                .maybeSingle();
              if (collab) {
                tenantId = collab.tenant_id;
                tenantName = collab.tenants?.name || tenantName;
                branchId = collab.branch_id || branchId;
                branchName = collab.branches?.name || branchName;
                role = (collab.role as UserRole) || role;
              }
            } catch (_) {}

            if (!tenantId) {
              try {
                const { data: bData } = await rawClient
                  .from('branches')
                  .select('id, name, company_id')
                  .eq('email', userEmail)
                  .maybeSingle();
                if (bData) {
                  tenantId = bData.company_id;
                  branchId = bData.id;
                  branchName = bData.name;
                  role = 'MERCHANT_MANAGER';
                }
              } catch (_) {}
            }

            if (!tenantId) {
              try {
                const { data: allTenants } = await rawClient.from('tenants').select('id, name, slug, email');
                if (allTenants && allTenants.length > 0) {
                  const match = allTenants.find((t: any) => 
                    (t.email && t.email.toLowerCase() === userEmail) ||
                    (userEmail.includes('burgerking') && (t.slug.includes('burger') || t.name.toLowerCase().includes('burger'))) ||
                    (userEmail.includes('mcdonalds') && (t.slug.includes('mcdonald') || t.name.toLowerCase().includes('mcdonald'))) ||
                    (userEmail.includes('willsteak') && (t.slug.includes('will') || t.name.toLowerCase().includes('will')))
                  );
                  if (match) {
                    tenantId = match.id;
                    tenantName = match.name;
                    if (!role || role === 'CUSTOMER') {
                      role = isBranchEmail ? 'MERCHANT_MANAGER' : 'MERCHANT_OWNER';
                    }
                  }
                }
              } catch (_) {}
            }
          }

          // Resolver sucursal Trinitarias si aplica
          if (rawClient && tenantId && !branchId && isBranchEmail) {
            try {
              const { data: bData } = await rawClient
                .from('branches')
                .select('id, name')
                .eq('company_id', tenantId)
                .ilike('name', '%trinitarias%')
                .maybeSingle();
              if (bData) {
                branchId = bData.id;
                branchName = bData.name;
              }
            } catch (_) {}
          }

          // Fallback por defecto si es Burger King
          if (!tenantId && userEmail.includes('burgerking')) {
            tenantId = '0cefc844-f2f2-4fd6-ac8f-aefcd83dd91d';
            tenantName = 'Burger King';
            if (isBranchEmail) {
              branchId = 'c79fadbd-8094-4063-a0a6-9a2cce68db62';
              branchName = 'Burger King trinitarias';
            }
          }

          // Si es Rider
          if (role === 'RIDER') {
            this.auth.loginAsRider({
              id: user.id,
              name: profile?.full_name || user.user_metadata?.['full_name'] || user.email?.split('@')[0] || 'Repartidor',
              email: user.email || emailTrim,
              phone: profile?.phone || '',
              tenantId: tenantId,
              avatarUrl: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            });
            this.redirectByRole('RIDER');
            return;
          }

          // Bloquear si es únicamente cuenta de cliente en app de pedidos
          if (role === 'CUSTOMER' && !isMerchantEmail && !isSuperAdminEmail) {
            throw new Error('Esta cuenta es de cliente. Por favor inicia sesión en la aplicación de pedidos.');
          }

          // Asegurar rol comercial si correspondía
          if (role === 'CUSTOMER') {
            role = isBranchEmail ? 'MERCHANT_MANAGER' : 'MERCHANT_OWNER';
          }

          // Sincronizar en profiles de Supabase en segundo plano
          if (rawClient && user.id) {
            rawClient.from('profiles').upsert({
              id: user.id,
              email: userEmail,
              full_name: profile?.full_name || user.user_metadata?.['full_name'] || user.email?.split('@')[0] || (isBranchEmail ? 'Burger King Trinitarias' : 'Burger King'),
              role: role,
              tenant_id: tenantId || null,
              branch_id: branchId || null,
              is_active: true,
              updated_at: new Date().toISOString()
            }).then();
          }

          const appUser: AppUser = {
            id: user.id,
            name: profile?.full_name || user.user_metadata?.['full_name'] || user.email?.split('@')[0] || tenantName || 'Usuario Comercio',
            email: user.email || emailTrim,
            phone: profile?.phone || '',
            role: role,
            tenantId: tenantId || '0cefc844-f2f2-4fd6-ac8f-aefcd83dd91d',
            tenantName: tenantName || 'Burger King',
            branchId: branchId || undefined,
            branchName: branchName || (branchId ? 'Sede Trinitarias' : 'Todas las Sedes (Acceso Global)'),
            permissions: [...(ROLE_PERMISSIONS_PRESETS[role] || [])],
            avatarUrl: profile?.avatar_url || 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150',
            isActive: true
          };

          this.auth.login(appUser);
          this.redirectByRole(appUser.role);
          return;
        }

        if (error) {
          const errorMsg = error.message === 'Invalid login credentials' 
            ? 'La cuenta ingresada no existe o las credenciales son incorrectas.' 
            : error.message;
          throw new Error(errorMsg || 'La cuenta ingresada no existe o las credenciales son incorrectas.');
        }
      } catch (supaErr: any) {
        if (supaErr.message?.includes('Contraseña incorrecta') || supaErr.message?.includes('no tiene permisos')) {
          throw supaErr;
        }
        console.warn('[LoginComponent] Supabase auth fallback:', supaErr);
      }

      throw new Error('La cuenta ingresada no existe o las credenciales son incorrectas.');
    } catch (err: any) {
      console.warn('[LoginComponent] Error de autenticación:', err);
      let msg = err.message || 'Error al autenticar. Verifica tu correo y contraseña.';
      if (msg === 'Invalid login credentials' || msg.includes('Database error') || msg.includes('Timeout')) {
        msg = 'La cuenta ingresada no existe o las credenciales son incorrectas.';
      }
      this.errorMessage.set(msg);
    } finally {
      this.isSubmitting.set(false);
    }
  }

  private redirectByRole(role?: string): void {
    const returnUrl = this.route.snapshot.queryParams['returnUrl'];
    if (returnUrl) {
      const isSuperAdminRoute = returnUrl.includes('super-admin');
      const isMerchantRoute = returnUrl.includes('merchant-admin') || returnUrl.includes('/admin');
      const isRiderRoute = returnUrl.includes('rider');

      if (isSuperAdminRoute && role === 'SUPER_ADMIN') {
        this.router.navigateByUrl(returnUrl);
        return;
      }
      if (isMerchantRoute && ['SUPER_ADMIN', 'MERCHANT_OWNER', 'MERCHANT_MANAGER', 'MERCHANT_KITCHEN', 'MERCHANT_DISPATCH'].includes(role || '')) {
        this.router.navigateByUrl(returnUrl);
        return;
      }
      if (isRiderRoute && (role === 'RIDER' || role === 'SUPER_ADMIN')) {
        this.router.navigateByUrl(returnUrl);
        return;
      }
    }

    if (role === 'SUPER_ADMIN') {
      this.router.navigate(['/super-admin']);
    } else if (role === 'RIDER') {
      this.router.navigate(['/rider']);
    } else if (role === 'CUSTOMER') {
      this.router.navigate(['/explorar']);
    } else {
      this.router.navigate(['/merchant-admin']);
    }
  }
}
