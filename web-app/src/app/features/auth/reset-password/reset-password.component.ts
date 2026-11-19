import { Component, OnInit, inject, signal, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule, ActivatedRoute } from '@angular/router';
import { SupabaseService } from '../../../core/services/supabase.service';
import { ThemeService } from '../../../core/services/theme.service';
import { IconComponent } from '../../../shared/components/icon.component';

@Component({
  selector: 'app-reset-password',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './reset-password.component.html'
})
export class ResetPasswordComponent implements OnInit {
  private readonly supabase = inject(SupabaseService);
  private readonly router = inject(Router);
  private readonly route = inject(ActivatedRoute);
  readonly theme = inject(ThemeService);

  newPassword = '';
  confirmPassword = '';
  showNewPassword = false;
  showConfirmPassword = false;

  readonly isLoading = signal(true);
  readonly isSubmitting = signal(false);
  readonly errorMessage = signal<string | null>(null);
  readonly isSuccess = signal(false);
  readonly sessionReady = signal(false);
  readonly targetApp = signal<'rider' | 'cliente' | 'web'>('web');
  readonly isMobileDevice = signal(false);
  readonly isTransferring = signal(false);
  readonly recoveryCode = signal<string | null>(null);

  // Validaciones de seguridad de contraseña
  readonly hasMinLength = computed(() => this.newPassword.length >= 8);
  readonly hasUppercase = computed(() => /[A-Z]/.test(this.newPassword));
  readonly hasSpecialChar = computed(() => /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?~`]/.test(this.newPassword));
  readonly passwordsMatch = computed(() => this.newPassword.length > 0 && this.newPassword === this.confirmPassword);
  readonly isFormValid = computed(() => 
    this.hasMinLength() && 
    this.hasUppercase() && 
    this.hasSpecialChar() && 
    this.passwordsMatch()
  );

  async ngOnInit(): Promise<void> {
    this.isMobileDevice.set(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    const queryParams = this.route.snapshot.queryParams;
    const hash = window.location.hash || '';
    const appParam = (queryParams['app'] || '').toLowerCase();

    if (appParam === 'rider' || hash.includes('app=rider')) {
      this.targetApp.set('rider');
    } else if (appParam === 'cliente' || appParam === 'customer' || hash.includes('app=cliente')) {
      this.targetApp.set('cliente');
    }

    const errorDesc = queryParams['error_description'] || queryParams['error'];
    
    if (errorDesc) {
      this.errorMessage.set(`El enlace de recuperación es inválido o ha expirado: ${decodeURIComponent(errorDesc)}`);
      this.isLoading.set(false);
      return;
    }

    const code = queryParams['code'];
    const client = this.supabase.rawClient;

    if (!client) {
      this.errorMessage.set('Error: Servicio de autenticación no inicializado.');
      this.isLoading.set(false);
      return;
    }

    // 1. Escuchar eventos de autenticación de Supabase (detecta PASSWORD_RECOVERY y SIGNED_IN automáticamente)
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION'))) {
        this.sessionReady.set(true);
        this.errorMessage.set(null);
        this.isLoading.set(false);
      }
    });

    try {
      // 2. Comprobar si Supabase SDK ya intercambió el código e inició sesión automáticamente
      const { data: { session: initialSession } } = await client.auth.getSession();
      if (initialSession) {
        this.sessionReady.set(true);
        this.isLoading.set(false);
        return;
      }

      // 3. Manejo de código PKCE
      if (code) {
        this.recoveryCode.set(code);

        // Si fue originado por Rider App, transferir a la app móvil donde reside el code_verifier
        if (this.targetApp() === 'rider') {
          this.isTransferring.set(true);
          this.isLoading.set(false);
          const riderDeepLink = `pidetelo-rider://login-callback?code=${encodeURIComponent(code)}`;
          if (this.isMobileDevice()) {
            window.location.href = riderDeepLink;
          }
          return;
        }

        // Si fue originado por Cliente App, transferir a la app móvil donde reside el code_verifier
        if (this.targetApp() === 'cliente') {
          this.isTransferring.set(true);
          this.isLoading.set(false);
          const clienteDeepLink = `pidetelo://login-callback?code=${encodeURIComponent(code)}`;
          if (this.isMobileDevice()) {
            window.location.href = clienteDeepLink;
          }
          return;
        }

        // Si es web, intercambiar código localmente
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          // Volver a comprobar la sesión por si el SDK la resolvió concurrentemente
          const { data: { session: retrySession } } = await client.auth.getSession();
          if (retrySession) {
            this.sessionReady.set(true);
          } else {
            console.warn('[ResetPassword] Error al intercambiar código:', error);
            this.errorMessage.set('El enlace de restablecimiento ha expirado o ya fue utilizado. Por favor solicita uno nuevo desde la pantalla de login.');
          }
        } else {
          this.sessionReady.set(true);
        }
      } else {
        // 4. Si no hay código en query params, revisar fragmento hash (#access_token=... o #type=recovery)
        const hash = window.location.hash;
        if (hash && (hash.includes('access_token') || hash.includes('type=recovery'))) {
          try {
            const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.substring(1) : hash);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            }
          } catch (_) {}
          this.sessionReady.set(true);
          this.errorMessage.set(null);
        } else {
          // Margen para que el SDK resuelva el token de URL
          setTimeout(async () => {
            const { data: { session: delayedSession } } = await client.auth.getSession();
            if (delayedSession) {
              this.sessionReady.set(true);
              this.errorMessage.set(null);
            } else if (!this.sessionReady()) {
              this.errorMessage.set('No se encontró un código o token de recuperación válido. Por favor solicita un nuevo enlace desde la pantalla de inicio de sesión.');
            }
          }, 1000);
        }
      }
    } catch (err: any) {
      this.errorMessage.set(err?.message || 'Error validando el enlace de recuperación.');
    } finally {
      this.isLoading.set(false);
    }
  }

  async onSubmit(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.isFormValid()) return;

    this.isSubmitting.set(true);
    this.errorMessage.set(null);

    const client = this.supabase.rawClient;
    if (!client) {
      this.errorMessage.set('Servicio no disponible.');
      this.isSubmitting.set(false);
      return;
    }

    try {
      const { error } = await client.auth.updateUser({
        password: this.newPassword
      });

      if (error) {
        throw error;
      }

      this.isSuccess.set(true);
    } catch (err: any) {
      console.error('[ResetPassword] Error actualizando contraseña:', err);
      this.errorMessage.set(err?.message || 'Ocurrió un error al actualizar tu contraseña. Intenta nuevamente.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  openInMobileApp(): void {
    const code = this.recoveryCode();
    const s = window.location.search || '';
    const h = window.location.hash || '';
    const query = code ? `?code=${encodeURIComponent(code)}` : (s + h);

    if (this.targetApp() === 'rider') {
      window.location.href = `pidetelo-rider://login-callback${query}`;
    } else if (this.targetApp() === 'cliente') {
      window.location.href = `pidetelo://login-callback${query}`;
    }
  }

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}

