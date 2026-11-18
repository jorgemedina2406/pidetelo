import { Injectable, signal, effect } from '@angular/core';

export type AppTheme = 'dark' | 'light';

@Injectable({
  providedIn: 'root'
})
export class ThemeService {
  private readonly STORAGE_KEY = 'pidetelo_theme_mode';
  // Default theme is strictly LIGHT
  readonly theme = signal<AppTheme>('light');

  constructor() {
    // Limpieza de claves obsoletas
    localStorage.removeItem('pidetelo_theme');
    
    const saved = localStorage.getItem(this.STORAGE_KEY) as AppTheme | null;
    if (saved === 'dark' || saved === 'light') {
      this.theme.set(saved);
    } else {
      this.theme.set('light');
    }

    this.applyTheme(this.theme());

    // Reactive effect whenever theme changes
    effect(() => {
      const current = this.theme();
      this.applyTheme(current);
      localStorage.setItem(this.STORAGE_KEY, current);
    });
  }

  toggleTheme(): void {
    this.theme.update(t => t === 'dark' ? 'light' : 'dark');
  }

  setTheme(t: AppTheme): void {
    this.theme.set(t);
  }

  isDark(): boolean {
    return this.theme() === 'dark';
  }

  private applyTheme(t: AppTheme): void {
    const root = document.documentElement;
    if (t === 'dark') {
      root.classList.add('dark');
      root.classList.remove('light');
    } else {
      root.classList.add('light');
      root.classList.remove('dark');
    }
  }
}
