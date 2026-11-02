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

