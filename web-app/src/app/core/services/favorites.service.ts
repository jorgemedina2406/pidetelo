import { Injectable, signal } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private readonly storageKey = 'pidetelo_customer_favorites';
  readonly favorites = signal<string[]>(this.loadFromStorage());

  private loadFromStorage(): string[] {
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  isFavorite(slugOrId: string): boolean {
    if (!slugOrId) return false;
    return this.favorites().includes(slugOrId.toLowerCase().trim());
  }

  toggleFavorite(slugOrId: string): boolean {
    if (!slugOrId) return false;
    const clean = slugOrId.toLowerCase().trim();
    const current = this.favorites();
    let updated: string[];

    if (current.includes(clean)) {
      updated = current.filter(x => x !== clean);
    } else {
      updated = [...current, clean];
    }

    this.favorites.set(updated);
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(updated));
    } catch {}

    return updated.includes(clean);
  }
}

