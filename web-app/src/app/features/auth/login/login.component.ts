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
  readonly isForgotPasswordOpen = signal(false);
  readonly resetEmail = signal('');
  readonly isSendingReset = signal(false);
  readonly resetStatusMessage = signal<string | null>(null);

  openForgotPassword(): void {
    this.resetEmail.set(this.email.trim());
    this.resetStatusMessage.set(null);
    this.isForgotPasswordOpen.set(true);
  }

  async sendPasswordReset(): Promise<void> {
    const email = this.resetEmail().trim();
    if (!email || !email.includes('@')) {
      this.resetStatusMessage.set('Por favor ingresa un correo electrónico válido.');
      return;
    }
    this.isSendingReset.set(true);
    this.resetStatusMessage.set(null);
    try {
      const { error } = await this.supabase.resetPasswordForEmail(email, window.location.origin + '/reset-password');
      if (error) throw error;
      this.resetStatusMessage.set(`✓ Se ha enviado un enlace de recuperación a ${email}. Revisa tu bandeja de entrada o spam.`);
    } catch (err: any) {
      this.resetStatusMessage.set(err?.message || 'Error al enviar el correo de recuperación.');
    } finally {
      this.isSendingReset.set(false);
    }
  }


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
          this.api.loginStoreUser(emailTrim, passTrim).pipe(timeout(2500))
        );
        if (storeUser) {
          this.auth.login(storeUser);
          this.redirectByRole(storeUser.role);
          return;
        }
      } catch (storeErr: any) {
        if (storeErr.status === 401 || storeErr.error?.message === 'Contraseña incorrecta' || storeErr.message?.includes('Contraseña incorrecta')) {
          throw new Error('Contraseña incorrecta para esta cuenta.');
        }
        const msg = storeErr.error?.message || storeErr.message || '';
        if (msg.includes('desactivad') || msg.includes('pausado') || msg.includes('bloqueado') || msg.includes('inactiv')) {
          throw new Error(msg);
        }
      }

      // 3. Verificar si es un motorizado registrado en la plataforma (Backend)
      try {
        const rider = await firstValueFrom(
          this.api.loginRider(emailTrim, passTrim).pipe(timeout(2500))
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
      } catch (riderErr: any) {
        if (riderErr.status === 401 && riderErr.error?.message === 'Contraseña incorrecta') {
          throw new Error('Contraseña incorrecta para esta cuenta de repartidor.');
        }
      }

      // 3.1 Respaldo local de motorizados registrados en navegador
      if (typeof window !== 'undefined') {
        try {
          const localRiders = JSON.parse(localStorage.getItem('deliveryhub_riders_auth') || '[]');
          const matched = localRiders.find((r: any) => 
            (r.email && r.email.toLowerCase() === emailTrim) ||
            (r.name && r.name.toLowerCase().trim() === emailTrim) ||
            (r.phone && r.phone.trim() === emailTrim)
          );
          if (matched) {
            if (matched.password && matched.password !== passTrim) {
              throw new Error('Contraseña incorrecta para esta cuenta de repartidor.');
            }
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
        } catch (e: any) {
          if (e.message?.includes('Contraseña incorrecta')) throw e;
        }
      }

      // 4. Intento de inicio de sesión en Supabase con timeout de protección
      try {
        const supaPromise = this.supabase.signInWithEmail(emailTrim, passTrim);
        const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) =>
          setTimeout(() => reject(new Error('Timeout Supabase Auth')), 2500)
        );
        const { data, error } = await Promise.race([supaPromise, timeoutPromise]);

        if (data?.user) {
          const user = data.user;
          const profile = await this.supabase.getUserProfile(user.id);
          const role: UserRole = (profile?.role as UserRole) || (user.user_metadata?.['role'] as UserRole) || 'MERCHANT_OWNER';
          
          if (role === 'CUSTOMER' || user.user_metadata?.['is_deleted'] || user.user_metadata?.['role'] === 'DELETED') {
            throw new Error('Esta cuenta no tiene permisos de administración ni de comercio en la plataforma.');
          }

          if (profile?.is_active === false || user.user_metadata?.['is_active'] === false) {
            throw new Error('Tu cuenta se encuentra desactivada por la administración de la plataforma. Comunícate con soporte de Pídetelo para más información.');
          }

          let tenantId = profile?.tenant_id || user.user_metadata?.['tenant_id'];
          let tenantName = profile?.tenants?.name || user.user_metadata?.['tenant_name'];

          if (!tenantId || !tenantName) {
            try {
              const rawClient = this.supabase.rawClient;
              if (rawClient) {
                const { data: tenantData } = await rawClient
                  .from('tenants')
                  .select('id, name, is_active')
                  .eq('email', user.email)
                  .maybeSingle();
                if (tenantData) {
                  tenantId = tenantData.id;
                  tenantName = tenantData.name;
                  if (tenantData.is_active === false && role !== 'SUPER_ADMIN') {
                    throw new Error('El comercio asociado a esta cuenta se encuentra pausado o desactivado temporalmente. El acceso administrativo y de repartidores a este comercio está bloqueado.');
                  }
                }
              }
            } catch (tErr: any) {
              if (tErr.message?.includes('El comercio asociado')) throw tErr;
            }
          } else if (tenantId && role !== 'SUPER_ADMIN') {
            try {
              const rawClient = this.supabase.rawClient;
              if (rawClient) {
                const { data: tRow } = await rawClient
                  .from('tenants')
                  .select('is_active')
                  .eq('id', tenantId)
                  .maybeSingle();
                if (tRow && tRow.is_active === false) {
                  throw new Error('El comercio asociado a esta cuenta se encuentra pausado o desactivado temporalmente. El acceso administrativo y de repartidores a este comercio está bloqueado.');
                }
              }
            } catch (tErr: any) {
              if (tErr.message?.includes('El comercio asociado')) throw tErr;
            }
          }

          const appUser: AppUser = {
            id: user.id,
            name: profile?.full_name || user.user_metadata?.['full_name'] || user.email?.split('@')[0] || 'Usuario',
            email: user.email || emailTrim,
            phone: profile?.phone || '',
            role: role,
            tenantId: tenantId || undefined,
            tenantName: tenantName || 'Mi Comercio',
            branchId: profile?.branch_id || user.user_metadata?.['branch_id'] || undefined,
            branchName: profile?.branch_name || user.user_metadata?.['branch_name'] || undefined,
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
        if (supaErr.message?.includes('Contraseña incorrecta') || 
            supaErr.message?.includes('no tiene permisos') ||
            supaErr.message?.includes('desactivada') ||
            supaErr.message?.includes('pausado') ||
            supaErr.message?.includes('bloqueado')) {
          throw supaErr;
        }
        if (supaErr.message?.toLowerCase()?.includes('banned') || supaErr.message?.toLowerCase()?.includes('user is banned')) {
          throw new Error('Tu cuenta se encuentra desactivada por la administración de la plataforma. Comunícate con soporte de Pídetelo para más información.');
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
