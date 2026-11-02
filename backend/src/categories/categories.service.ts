import { Injectable } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service.js';

export interface BusinessCategory {
  id: string;
  name: string;
  slug: string;
  icon: string;
  subcategories: string[];
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

@Injectable()
export class CategoriesService {
  private filePath = path.join(process.cwd(), 'data', 'categories.json');

  private defaultCategories: BusinessCategory[] = [
    {
      id: 'cat_restaurantes',
      name: 'Restaurantes',
      slug: 'restaurantes',
      icon: '🍽️',
      subcategories: [
        'Hamburguesas',
        'Sushi & Asiática',
        'Pastas & Italiana',
        'Pizzas',
        'Pollos & Brasas',
        'Carnes & Grill',
        'Comida Rápida',
        'Comida Mexicana',
        'Café & Bakery',
        'Desayunos',
        'Arepas & Empanadas'
      ],
      sort_order: 1,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'cat_super',
      name: 'Súper',
      slug: 'super',
      icon: '🛒',
      subcategories: ['Víveres', 'Lácteos & Huevos', 'Frutas & Verduras', 'Carnicería & Aves', 'Limpieza', 'Bebidas'],
      sort_order: 2,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'cat_farmacias',
      name: 'Farmacias',
      slug: 'farmacias',
      icon: '💊',
      subcategories: ['Medicamentos', 'Cuidado Personal', 'Bebés & Maternidad', 'Primeros Auxilios', 'Vitaminas'],
      sort_order: 3,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'cat_mascotas',
      name: 'Mascotas',
      slug: 'mascotas',
      icon: '🐾',
      subcategories: ['Alimento Perros', 'Alimento Gatos', 'Snacks & Premios', 'Higiene & Farmacia', 'Accesorios'],
      sort_order: 4,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'cat_licores',
      name: 'Licores',
      slug: 'licores',
      icon: '🍷',
      subcategories: ['Cervezas', 'Vinos', 'Rones', 'Whiskies', 'Snacks & Hielo'],
      sort_order: 5,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    },
    {
      id: 'cat_postres',
      name: 'Postres',
      slug: 'postres',
      icon: '🧁',
      subcategories: ['Tortas & Pasteles', 'Helados', 'Donas & Churros', 'Chocolatería', 'Galletas'],
      sort_order: 6,
      is_active: true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }
  ];

  constructor(private readonly supabase: SupabaseService) {
    this.ensureDataFile();
  }

  private ensureDataFile() {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      if (!fs.existsSync(this.filePath)) {
        fs.writeFileSync(this.filePath, JSON.stringify(this.defaultCategories, null, 2), 'utf-8');
      }
    } catch (e) {
      console.warn('[CategoriesService] Error inicializando categories.json:', e);
    }
  }

  private readLocal(): BusinessCategory[] {
    try {
      this.ensureDataFile();
      const content = fs.readFileSync(this.filePath, 'utf-8');
      const list = JSON.parse(content);
      return Array.isArray(list) ? list : this.defaultCategories;
    } catch (_) {
      return this.defaultCategories;
    }
  }

  private writeLocal(data: BusinessCategory[]) {
    try {
      const dir = path.dirname(this.filePath);
      if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(this.filePath, JSON.stringify(data, null, 2), 'utf-8');
    } catch (e) {
      console.warn('[CategoriesService] Error guardando categories.json:', e);
    }
  }

  async findAll(includeInactive = false): Promise<BusinessCategory[]> {
    try {
      let query = this.supabase.getClient().from('business_categories').select('*').order('sort_order', { ascending: true });
      if (!includeInactive) {
        query = query.eq('is_active', true);
      }
      const { data, error } = await query;
      if (!error && data && data.length > 0) {
        return data.map(r => ({
          id: r.id,
          name: r.name,
          slug: r.slug,
          icon: r.icon,
          subcategories: Array.isArray(r.subcategories) ? r.subcategories : (typeof r.subcategories === 'string' ? JSON.parse(r.subcategories) : []),
          sort_order: r.sort_order ?? 0,
          is_active: r.is_active ?? true,
          created_at: r.created_at,
          updated_at: r.updated_at
        }));
      }
    } catch (_) {}

    const local = this.readLocal();
    return includeInactive ? local : local.filter(c => c.is_active);
  }

  async create(payload: Partial<BusinessCategory>): Promise<BusinessCategory> {
    const slug = (payload.slug || payload.name || '').toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || `cat-${Date.now()}`;

    const newCat: BusinessCategory = {
      id: crypto.randomUUID(),
      name: payload.name || 'Nueva Categoría',
      slug,
      icon: payload.icon || '🛍️',
      subcategories: payload.subcategories || [],
      sort_order: payload.sort_order ?? 99,
      is_active: payload.is_active ?? true,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };

    try {
      const { data } = await this.supabase.getClient()
        .from('business_categories')
        .insert({
          id: newCat.id,
          name: newCat.name,
          slug: newCat.slug,
          icon: newCat.icon,
          subcategories: newCat.subcategories,
          sort_order: newCat.sort_order,
          is_active: newCat.is_active,
          created_at: newCat.created_at,
          updated_at: newCat.updated_at
        })
        .select()
        .maybeSingle();

      if (data) {
        newCat.id = data.id;
      }
    } catch (_) {}

    const list = this.readLocal();
    list.push(newCat);
    this.writeLocal(list);
    return newCat;
  }

  async update(id: string, payload: Partial<BusinessCategory>): Promise<BusinessCategory> {
    const list = this.readLocal();
    const idx = list.findIndex(c => c.id === id || c.slug === id);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        ...payload,
        updated_at: new Date().toISOString()
      };
      this.writeLocal(list);
    }

    try {
      const supabasePayload: any = { updated_at: new Date().toISOString() };
      if (payload.name !== undefined) supabasePayload.name = payload.name;
      if (payload.icon !== undefined) supabasePayload.icon = payload.icon;
      if (payload.subcategories !== undefined) supabasePayload.subcategories = payload.subcategories;
      if (payload.sort_order !== undefined) supabasePayload.sort_order = payload.sort_order;
      if (payload.is_active !== undefined) supabasePayload.is_active = payload.is_active;

      await this.supabase.getClient()
        .from('business_categories')
        .update(supabasePayload)
        .or(`id.eq.${id},slug.eq.${id}`);
    } catch (_) {}

    return idx !== -1 ? list[idx] : (payload as BusinessCategory);
  }

  async delete(id: string): Promise<boolean> {
    const list = this.readLocal().filter(c => c.id !== id && c.slug !== id);
    this.writeLocal(list);

    try {
      await this.supabase.getClient()
        .from('business_categories')
        .delete()
        .or(`id.eq.${id},slug.eq.${id}`);
    } catch (_) {}

    return true;
  }
}

