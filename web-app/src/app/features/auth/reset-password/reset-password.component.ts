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

  email = '';
  otpCode = '';
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
  readonly isFormValid = computed(() => {
    const passOk = this.hasMinLength() && this.hasUppercase() && this.hasSpecialChar() && this.passwordsMatch();
    if (!this.sessionReady()) {
      return passOk && this.email.trim().length > 3 && this.otpCode.trim().length === 6;
    }
    return passOk;
  });

  async ngOnInit(): Promise<void> {
    this.isMobileDevice.set(/Android|iPhone|iPad|iPod/i.test(navigator.userAgent));

    const queryParams = this.route.snapshot.queryParams;
    const hash = window.location.hash || '';
    const appParam = (queryParams['app'] || '').toLowerCase();

    if (queryParams['email']) {
      this.email = queryParams['email'];
    }

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

    // 1. Escuchar eventos de autenticación de Supabase (PASSWORD_RECOVERY o SIGNED_IN)
    client.auth.onAuthStateChange((event, session) => {
      if (event === 'PASSWORD_RECOVERY' || (session && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION'))) {
        this.sessionReady.set(true);
        this.errorMessage.set(null);
        this.isLoading.set(false);
      }
    });

    try {
      // 2. Comprobar si ya existe una sesión previa válida
      const { data: { session: initialSession } } = await client.auth.getSession();
      if (initialSession) {
        this.sessionReady.set(true);
        this.isLoading.set(false);
        return;
      }

      // 3. Manejo de código PKCE
      if (code) {
        this.recoveryCode.set(code);

        // Si fue originado por Rider App o Cliente App:
        if (this.targetApp() === 'rider' || this.targetApp() === 'cliente') {
          // Si está en dispositivo móvil, transferir directamente a la app nativa donde reside el PKCE code_verifier
          if (this.isMobileDevice()) {
            this.isTransferring.set(true);
            this.isLoading.set(false);
            const deepLink = this.targetApp() === 'rider'
              ? `pidetelo-rider://login-callback?code=${encodeURIComponent(code)}`
              : `pidetelo://login-callback?code=${encodeURIComponent(code)}`;
            window.location.href = deepLink;
            return;
          } else {
            // Si está en Computadora / Escritorio: no redirigir a un deep link de móvil inexistente.
            // Mostrar formulario OTP para que pueda cambiar su contraseña aquí mismo con el código de 6 dígitos.
            this.isLoading.set(false);
            return;
          }
        }

        // Si es web pura, intentar intercambiar código localmente
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          const { data: { session: retrySession } } = await client.auth.getSession();
          if (retrySession) {
            this.sessionReady.set(true);
          } else {
            console.warn('[ResetPassword] exchangeCodeForSession falló (típico si se solicitó en otro dispositivo):', error);
            // En vez de bloquear al usuario con error fatal, le permitimos usar el código OTP de 6 dígitos
            this.sessionReady.set(false);
          }
        } else {
          this.sessionReady.set(true);
        }
      } else {
        // 4. Si no hay código en query params, revisar fragmento hash
        const currentHash = window.location.hash;
        if (currentHash && (currentHash.includes('access_token') || currentHash.includes('type=recovery'))) {
          try {
            const hashParams = new URLSearchParams(currentHash.startsWith('#') ? currentHash.substring(1) : currentHash);
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            if (accessToken && refreshToken) {
              await client.auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
            }
          } catch (_) {}
          this.sessionReady.set(true);
          this.errorMessage.set(null);
        }
      }
    } catch (err: any) {
      console.warn('[ResetPassword] Nota durante verificación inicial:', err);
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
      // Si la sesión no está lista (ej. se abrió en PC tras solicitarse en app móvil), validar con verifyOtp
      if (!this.sessionReady()) {
        const cleanEmail = this.email.trim();
        const cleanOtp = this.otpCode.trim();

        if (!cleanEmail || !cleanEmail.includes('@')) {
          this.errorMessage.set('Por favor ingresa un correo electrónico válido.');
          this.isSubmitting.set(false);
          return;
        }

        if (cleanOtp.length !== 6) {
          this.errorMessage.set('Por favor ingresa el código de 6 dígitos enviado a tu correo.');
          this.isSubmitting.set(false);
          return;
        }

        const { data, error: otpError } = await client.auth.verifyOtp({
          email: cleanEmail,
          token: cleanOtp,
          type: 'recovery',
        });

        if (otpError) {
          throw otpError;
        }

        this.sessionReady.set(true);
      }

      // Con la sesión activa, actualizar la contraseña
      const { error: updateError } = await client.auth.updateUser({
        password: this.newPassword
      });

      if (updateError) {
        throw updateError;
      }

      this.isSuccess.set(true);
    } catch (err: any) {
      console.error('[ResetPassword] Error actualizando contraseña:', err);
      this.errorMessage.set(err?.message || 'Ocurrió un error al actualizar tu contraseña. Verifica los datos e intenta nuevamente.');
    } finally {
      this.isSubmitting.set(false);
    }
  }

  cancelTransferAndUseWeb(): void {
    this.isTransferring.set(false);
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
