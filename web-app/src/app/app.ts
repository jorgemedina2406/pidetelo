import { Component, signal, OnInit, inject } from '@angular/core';
import { RouterOutlet, Router } from '@angular/router';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog.component';
import { CookieBannerComponent } from './shared/components/cookie-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialogComponent, CookieBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App implements OnInit {
  protected readonly title = signal('web-app');
  private readonly router = inject(Router);

  ngOnInit(): void {
    if (typeof window !== 'undefined') {
      const urlParams = new URLSearchParams(window.location.search);
      const code = urlParams.get('code');
      const error = urlParams.get('error') || urlParams.get('error_description');
      const hash = window.location.hash;
      const isRecovery = hash.includes('type=recovery') || hash.includes('access_token');

      // Si Supabase o un enlace de correo redirige con código/token de recuperación a cualquier ruta (ej: /explorar?code=...)
      if ((code || error || isRecovery) && !window.location.pathname.includes('reset-password')) {
        this.router.navigate(['/reset-password'], {
          queryParams: Object.fromEntries(urlParams.entries()),
          fragment: hash ? hash.replace(/^#/, '') : undefined
        });
      }
    }
  }
}
