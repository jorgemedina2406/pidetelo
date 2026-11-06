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
    const queryParams = this.route.snapshot.queryParams;
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

    try {
      if (code) {
        // Intercambiar código de recuperación por sesión activa
        const { error } = await client.auth.exchangeCodeForSession(code);
        if (error) {
          console.warn('[ResetPassword] Error al intercambiar código:', error);
          this.errorMessage.set('El enlace de restablecimiento ha expirado o ya fue utilizado. Por favor solicita uno nuevo.');
        } else {
          this.sessionReady.set(true);
        }
      } else {
        // Verificar si ya hay una sesión activa o token en hash
        const { data: { session } } = await client.auth.getSession();
        if (session) {
          this.sessionReady.set(true);
        } else {
          // Si no hay código ni sesión, revisar si hay hash fragment
          const hash = window.location.hash;
          if (hash && hash.includes('access_token')) {
            this.sessionReady.set(true);
          } else {
            this.errorMessage.set('No se encontró un código o token de recuperación válido. Por favor solicita un nuevo enlace desde la pantalla de inicio de sesión.');
          }
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

  goToLogin(): void {
    this.router.navigate(['/login']);
  }
}

