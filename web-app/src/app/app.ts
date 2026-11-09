import { Component, signal } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { ConfirmDialogComponent } from './shared/components/confirm-dialog.component';
import { CookieBannerComponent } from './shared/components/cookie-banner.component';

@Component({
  selector: 'app-root',
  imports: [RouterOutlet, ConfirmDialogComponent, CookieBannerComponent],
  templateUrl: './app.html',
  styleUrl: './app.css'
})
export class App {
  protected readonly title = signal('web-app');
}
