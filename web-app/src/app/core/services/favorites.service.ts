import { Injectable, signal, inject, effect } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { environment } from '../../../environments/environment';
import { SupabaseService } from './supabase.service';
import { AuthStore } from '../stores/auth.store';

@Injectable({
  providedIn: 'root'
})
export class FavoritesService {
  private readonly supabase = inject(SupabaseService);
  private readonly auth = inject(AuthStore);
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiUrl || 'http://localhost:3000/api';
  private readonly storageKey = 'pidetelo_customer_favorites';
  readonly favorites = signal<string[]>(this.loadFromStorage());
  private lastSyncedUserId: string | null = null;

  constructor() {
    effect(() => {
      const supUser = this.supabase.currentUser();
      const storeUser = this.auth.currentUser();
      const userId = supUser?.id || storeUser?.id || null;
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      if (userId && uuidRegex.test(userId)) {
        if (this.lastSyncedUserId !== userId) {
          this.lastSyncedUserId = userId;
          this.syncFromCloud(userId, supUser?.email || storeUser?.email || undefined);
        }
      } else {
        this.lastSyncedUserId = null;
      }
    });
  }

  private getActiveUser(): { id: string; email?: string } | null {
    const supUser = this.supabase.currentUser();
    const storeUser = this.auth.currentUser();
    const id = supUser?.id || storeUser?.id;
    const email = supUser?.email || storeUser?.email || undefined;
    if (!id || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)) {
      return null;
    }
    return { id, email };
  }

  private loadFromStorage(): string[] {
    if (typeof window === 'undefined') return [];
    try {
      const saved = localStorage.getItem(this.storageKey);
      return saved ? JSON.parse(saved) : [];
    } catch {
      return [];
    }
  }

  private saveToStorage(list: string[]): void {
    if (typeof window === 'undefined') return;
    try {
      localStorage.setItem(this.storageKey, JSON.stringify(list));
    } catch {}
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
    this.saveToStorage(updated);
    this.pushToCloud(updated);

    return updated.includes(clean);
  }

  async syncFromCloud(userId?: string, email?: string): Promise<void> {
    const targetUser = userId ? { id: userId, email } : this.getActiveUser();
    if (!targetUser) return;

    const collected = new Set<string>();
    const addFavs = (arr: any) => {
      if (!Array.isArray(arr)) return;
      for (const item of arr) {
        const clean = String(item || '').toLowerCase().trim();
        if (clean) collected.add(clean);
      }
    };

    const supUser = this.supabase.currentUser();
    if (supUser?.id === targetUser.id) {
      addFavs(supUser.user_metadata?.['favorite_store_ids']);
    }

    const client = this.supabase.rawClient;
    if (client) {
      try {
        const { data: favRows, error } = await client
          .from('customer_favorites')
          .select('tenant_id, tenant_slug')
          .eq('user_id', targetUser.id);
        if (!error && Array.isArray(favRows)) {
          for (const r of favRows) {
            if (r?.tenant_id) collected.add(String(r.tenant_id).toLowerCase().trim());
            if (r?.tenant_slug) collected.add(String(r.tenant_slug).toLowerCase().trim());
          }
        }
      } catch {}

      try {
        const { data: cartRow } = await client
          .from('customer_carts')
          .select('metadata')
          .eq('user_id', targetUser.id)
          .maybeSingle();
        addFavs(cartRow?.metadata?.favorite_store_ids);
      } catch {}
    }

    try {
      const apiRes = await firstValueFrom(
        this.http.get<{ favorites?: string[] }>(`${this.baseUrl}/users/${targetUser.id}/favorites`)
      );
      addFavs(apiRes?.favorites);
    } catch {}

    if (collected.size > 0) {
      const merged = Array.from(new Set([...this.favorites(), ...collected]));
      this.favorites.set(merged);
      this.saveToStorage(merged);
    } else if (this.favorites().length > 0) {
      await this.pushToCloud(this.favorites(), targetUser.id, targetUser.email);
    }
  }

  private async pushToCloud(list: string[], explicitUserId?: string, explicitEmail?: string): Promise<void> {
    const user = explicitUserId ? { id: explicitUserId, email: explicitEmail } : this.getActiveUser();
    if (!user) return;

    const cleanList = Array.from(new Set(list.map(x => String(x || '').toLowerCase().trim()).filter(Boolean)));
    const client = this.supabase.rawClient;

    if (client) {
      // 1. Auth metadata si coincide la sesión activa
      try {
        const supUser = this.supabase.currentUser();
        if (supUser?.id === user.id) {
          await client.auth.updateUser({
            data: { favorite_store_ids: cleanList }
          });
        }
      } catch {}

      // 2. Read-merge-upsert customer_carts.metadata
      try {
        const { data: existingCart } = await client
          .from('customer_carts')
          .select('metadata, user_email')
          .eq('user_id', user.id)
          .maybeSingle();

        const existingMeta =
          existingCart?.metadata && typeof existingCart.metadata === 'object'
            ? { ...existingCart.metadata }
            : {};

        await client
          .from('customer_carts')
          .upsert(
            {
              user_id: user.id,
              user_email: user.email || existingCart?.user_email || null,
              metadata: {
                ...existingMeta,
                favorite_store_ids: cleanList
              },
              updated_at: new Date().toISOString()
            },
            { onConflict: 'user_id' }
          );
      } catch {}
    }

    // 3. Backend API (sincroniza customer_favorites + customer_carts + auth admin)
    try {
      await firstValueFrom(
        this.http.put(`${this.baseUrl}/users/${user.id}/favorites`, {
          favorites: cleanList,
          email: user.email
        })
      );
    } catch {}
  }
}

