import { Component, inject, signal, computed, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../core/stores/auth.store';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Tenant } from '../../core/models/tenant.model';
import { Branch } from '../../core/models/branch.model';
import { Permission, UserRole } from '../../core/models/user.model';
import { Banner } from '../../core/models/banner.model';
import { BusinessCategory } from '../../core/models/category.model';
import { Coupon } from '../../core/models/coupon.model';
import { IconComponent } from '../../shared/components/icon.component';

export interface ToastNotification {
  id: string;
  type: 'success' | 'error' | 'info';
  title: string;
  message: string;
}

@Component({
  selector: 'app-super-admin',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './super-admin.component.html'
})
export class SuperAdminComponent implements OnInit {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private readonly api = inject(ApiService);
  private readonly supabase = inject(SupabaseService);

  readonly isSidebarExpanded = signal(true);
  readonly isMobileMenuOpen = signal(false);
  readonly activeTab = signal<'merchants' | 'branch_approvals' | 'categories' | 'roles' | 'metrics' | 'banners' | 'users' | 'global_coupons'>('merchants');
  searchMerchant = '';
  readonly isCreateModalOpen = signal(false);

  // --- SISTEMA DE TOASTS LLAMATIVOS ---
  readonly activeToasts = signal<ToastNotification[]>([]);

  showToast(type: 'success' | 'error' | 'info', title: string, message: string): void {
    const id = `toast_${Date.now()}_${Math.random()}`;
    const newToast: ToastNotification = { id, type, title, message };
    this.activeToasts.update(list => [...list, newToast]);
    setTimeout(() => {
      this.activeToasts.update(list => list.filter(t => t.id !== id));
    }, 4500);
  }

  removeToast(id: string): void {
    this.activeToasts.update(list => list.filter(t => t.id !== id));
  }

  // --- SELECTOR INTUITIVO DE ICONOS Y EMOJIS ---
  readonly iconCategories = [
    { name: '🧸 Juguetes & Niños', icons: ['🧸', '🎮', '🎯', '🚀', '🎲', '🛹', '🪀', '🧩', '🎨', '🎪', '🎠'] },
    { name: '🍔 Comida & Restaurantes', icons: ['🍽️', '🍔', '🍕', '🍣', '🌮', '🍗', '🍝', '🥩', '🥪', '🍰', '🧁', '🍦', '☕'] },
    { name: '🛒 Súper & Mercados', icons: ['🛒', '🛍️', '🏬', '🥖', '🥛', '🍎', '🥦', '🥩', '🧀', '🥫', '🧴', '🧹'] },
    { name: '💊 Farmacia & Salud', icons: ['💊', '🩺', '🩹', '🧼', '🦷', '🍼', '👶', '♿'] },
    { name: '🐾 Mascotas', icons: ['🐾', '🐶', '🐱', '🦜', '🐠', '🦴', '🐹'] },
    { name: '🍷 Licores & Bebidas', icons: ['🍷', '🍺', '🍸', '🍹', '🍾', '🥃', '🥂'] },
    { name: '👗 Moda & Ropa', icons: ['👕', '👗', '👟', '👠', '🧢', '👜', '💍', '💄', '🕶️'] },
    { name: '📱 Tecnología & Varios', icons: ['📱', '💻', '🎧', '⚡', '🔧', '💐', '📚', '⚽', '🚗', '🛵'] }
  ];
  readonly selectedIconCategoryIdx = signal(0);

  selectCategoryIcon(icon: string): void {
    this.editingCategory.icon = icon;
  }

  // --- USUARIOS DE LA PLATAFORMA ---
  readonly platformUsers = signal<any[]>([]);
  readonly loadingUsers = signal(false);
  readonly userSearchQuery = signal('');
  readonly userRoleFilter = signal('all');

  // --- CUPONES GLOBALES DE PLATAFORMA ---
  readonly allCoupons = signal<Coupon[]>([]);
  readonly loadingCoupons = signal(false);
  readonly isGlobalCouponModalOpen = signal(false);
  readonly isSavingGlobalCoupon = signal(false);
  editingGlobalCoupon: Partial<Coupon> = {
    isGlobal: true,
    discountType: 'percentage',
    discountValue: 15,
    minOrderAmount: 0,
    isActive: true,
    targetCondition: 'all'
  };

  // --- MÉTRICAS REALES Y REPORTES DE SEDES ---
  readonly metricsSummary = signal<any>(null);
  readonly loadingMetrics = signal(false);

  readonly merchants = signal<Tenant[]>([]);
  readonly pendingBranches = signal<Branch[]>([]);
  readonly banners = signal<Banner[]>([]);
  readonly isBannerModalOpen = signal(false);
  readonly isSavingBanner = signal(false);
  editingBanner: Partial<Banner> = {};
  readonly bannerActionNotice = signal<string | null>(null);

  // --- CATEGORÍAS GLOBALES DEL MARKETPLACE ---
  readonly businessCategories = signal<BusinessCategory[]>([]);
  readonly isCategoryModalOpen = signal(false);
  readonly isSavingCategory = signal(false);
  editingCategory: Partial<BusinessCategory> = { subcategories: [] };
  newSubcategoryInput = '';
  readonly categoryActionNotice = signal<string | null>(null);

  readonly rejectReasonModalOpen = signal(false);
  readonly selectedBranchToReject = signal<Branch | null>(null);
  rejectionReason = '';
  readonly branchApprovalNotice = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getTenants(true).subscribe(tenants => {
      this.merchants.set(tenants || []);
    });
    this.loadPendingBranches();
    this.loadBanners();
    this.loadBusinessCategories();
    this.loadPlatformUsers();
    this.loadMetricsSummary();
    this.loadAllCoupons();
  }

  loadPlatformUsers(): void {
    this.loadingUsers.set(true);
    this.api.getPlatformUsers().subscribe(users => {
      this.platformUsers.set(users || []);
      this.loadingUsers.set(false);
    });
  }

  loadMetricsSummary(): void {
    this.loadingMetrics.set(true);
    this.api.getMetricsSummary().subscribe(data => {
      this.metricsSummary.set(data);
      this.loadingMetrics.set(false);
    });
  }

  loadAllCoupons(): void {
    this.loadingCoupons.set(true);
    this.api.getAllCoupons().subscribe(coupons => {
      this.allCoupons.set(coupons || []);
      this.loadingCoupons.set(false);
    });
  }

  readonly filteredPlatformUsers = computed(() => {
    const q = this.userSearchQuery().toLowerCase().trim();
    const filterRole = this.userRoleFilter().toUpperCase().trim();
    return this.platformUsers().filter(u => {
      const matchQuery = !q ||
        (u.name && u.name.toLowerCase().includes(q)) ||
        (u.email && u.email.toLowerCase().includes(q)) ||
        (u.phone && u.phone.toLowerCase().includes(q)) ||
        (u.tenantName && u.tenantName.toLowerCase().includes(q)) ||
        (u.branchName && u.branchName.toLowerCase().includes(q));

      if (filterRole === 'ALL') return matchQuery;

      const userRole = (u.role || '').toUpperCase().trim();
      const matchRole =
        userRole === filterRole ||
        (filterRole === 'MERCHANT_OWNER' && (userRole === 'MERCHANT_ADMIN' || userRole === 'ADMIN' || userRole === 'OWNER')) ||
        (filterRole === 'MERCHANT_MANAGER' && (userRole === 'BRANCH_MANAGER' || userRole === 'MANAGER')) ||
        (filterRole === 'MERCHANT_KITCHEN' && (userRole === 'KITCHEN' || userRole === 'COCINA')) ||
        (filterRole === 'RIDER' && (userRole === 'MOTORIZADO' || userRole === 'REPARTIDOR')) ||
        (filterRole === 'CUSTOMER' && (userRole === 'CLIENTE')) ||
        (filterRole === 'SUPER_ADMIN' && (userRole === 'SUPERADMIN'));

      return matchQuery && matchRole;
    });
  });

  readonly platformUsersCount = computed(() => this.platformUsers().length);
  readonly customerUsersCount = computed(() => this.platformUsers().filter(u => (u.role || '').toUpperCase().includes('CUSTOMER') || (u.role || '').toUpperCase().includes('CLIENT')).length);
  readonly riderUsersCount = computed(() => this.platformUsers().filter(u => (u.role || '').toUpperCase().includes('RIDER') || (u.role || '').toUpperCase().includes('MOTOR')).length);
  readonly merchantUsersCount = computed(() => this.platformUsers().filter(u => {
    const r = (u.role || '').toUpperCase();
    return r.includes('MERCHANT') || r.includes('OWNER') || r.includes('MANAGER') || r.includes('KITCHEN') || r.includes('ADMIN');
  }).length);

  openNewGlobalCouponModal(): void {
    this.editingGlobalCoupon = {
      isGlobal: true,
      tenantId: 'global',
      code: '',
      description: 'Cupón general de plataforma para todos los comercios',
      discountType: 'percentage',
      discountValue: 15,
      minOrderAmount: 0,
      isActive: true,
      targetCondition: 'all'
    };
    this.isGlobalCouponModalOpen.set(true);
  }

  saveGlobalCoupon(): void {
    if (!this.editingGlobalCoupon.code) return;
    this.isSavingGlobalCoupon.set(true);
    this.editingGlobalCoupon.isGlobal = true;
    this.editingGlobalCoupon.tenantId = 'global';

    if (this.editingGlobalCoupon.id) {
      this.api.updateCoupon(this.editingGlobalCoupon.id, this.editingGlobalCoupon).subscribe({
        next: () => {
          this.isSavingGlobalCoupon.set(false);
          this.isGlobalCouponModalOpen.set(false);
          this.loadAllCoupons();
          this.showToast('success', '¡Cupón Global Actualizado!', `El cupón ${this.editingGlobalCoupon.code} está listo.`);
        },
        error: () => this.isSavingGlobalCoupon.set(false)
      });
    } else {
      this.api.createCoupon(this.editingGlobalCoupon).subscribe({
        next: (created) => {
          this.isSavingGlobalCoupon.set(false);
          this.isGlobalCouponModalOpen.set(false);
          this.loadAllCoupons();
          this.showToast('success', '¡Cupón Global Creado!', `El cupón ${created.code} aplica en cualquier comercio de la plataforma.`);
        },
        error: () => this.isSavingGlobalCoupon.set(false)
      });
    }
  }

  deleteGlobalCoupon(c: Coupon): void {
    if (!confirm(`¿Eliminar el cupón global "${c.code}"?`)) return;
    this.api.deleteCoupon(c.id).subscribe(() => {
      this.loadAllCoupons();
      this.showToast('info', 'Cupón Eliminado', `El cupón ${c.code} fue retirado.`);
    });
  }

  loadBusinessCategories(): void {
    this.api.getBusinessCategories(true).subscribe(cats => {
      this.businessCategories.set(cats || []);
    });
  }

  readonly filteredMerchants = computed(() => {
    const q = this.searchMerchant.toLowerCase().trim();
    if (!q) return this.merchants();
    return this.merchants().filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.category.toLowerCase().includes(q) || 
      (m.subcategories || []).some(s => s.toLowerCase().includes(q)) ||
      m.slug.toLowerCase().includes(q)
    );
  });

  readonly activeMerchantsCount = computed(() => this.merchants().filter(m => m.isActive).length);

  newMerchant: {
    name: string;
    slug: string;
    category: string;
    subcategories: string[];
    whatsapp: string;
    address: string;
    deliveryFee: number;
    commission: number;
    ownerName: string;
    ownerEmail: string;
    ownerPassword: string;
  } = {
    name: '',
    slug: '',
    category: 'Restaurantes',
    subcategories: ['Hamburguesas'],
    whatsapp: '+584129990000',
    address: 'Av. Las Delicias, Centro',
    deliveryFee: 2.50,
    commission: 5.0,
    ownerName: '',
    ownerEmail: '',
    ownerPassword: ''
  };

  readonly isCreatingMerchant = signal(false);
  readonly createMerchantError = signal<string | null>(null);
  readonly createdCredentialsModal = signal<{
    tenantName: string;
    ownerName: string;
    email: string;
    pass: string;
    slug: string;
  } | null>(null);
  readonly copiedCredentials = signal(false);

  // --- ACTUALIZAR DATOS DE COMERCIO ---
  readonly isEditModalOpen = signal(false);
  readonly isSavingEdit = signal(false);
  readonly editMerchantError = signal<string | null>(null);
  editingMerchant: {
    id: string;
    name: string;
    slug: string;
    category: string;
    subcategories: string[];
    whatsapp: string;
    address: string;
    deliveryFee: number;
    commission: number;
    isActive: boolean;
  } = {
    id: '',
    name: '',
    slug: '',
    category: 'Restaurantes',
    subcategories: [],
    whatsapp: '',
    address: '',
    deliveryFee: 2.50,
    commission: 5.0,
    isActive: true
  };

  openEditMerchantModal(m: Tenant): void {
    this.editingMerchant = {
      id: m.id,
      name: m.name,
      slug: m.slug,
      category: m.category || 'Restaurantes',
      subcategories: Array.isArray(m.subcategories) ? [...m.subcategories] : [],
      whatsapp: m.contact?.whatsappNumber || '',
      address: m.contact?.address || '',
      deliveryFee: m.deliverySettings?.baseDeliveryFee ?? 2.50,
      commission: m.commissionPercentage ?? 5.0,
      isActive: m.isActive
    };
    this.editMerchantError.set(null);
    this.isEditModalOpen.set(true);
  }

  // Helper para obtener las subdivisiones disponibles para una categoría seleccionada
  getSubcategoriesFor(categoryName: string): string[] {
    const cat = this.businessCategories().find(c => c.name.toLowerCase() === (categoryName || '').toLowerCase() || c.slug.toLowerCase() === (categoryName || '').toLowerCase());
    return cat?.subcategories || ['Hamburguesas', 'Sushi & Asiática', 'Pastas & Italiana', 'Pizzas', 'Pollos & Brasas', 'Carnes & Grill', 'Comida Rápida', 'Comida Mexicana', 'Café & Bakery'];
  }

  toggleEditSubcategory(sub: string): void {
    const current = this.editingMerchant.subcategories || [];
    if (current.includes(sub)) {
      this.editingMerchant.subcategories = current.filter(s => s !== sub);
    } else {
      this.editingMerchant.subcategories = [...current, sub];
    }
  }

  toggleNewSubcategory(sub: string): void {
    const current = this.newMerchant.subcategories || [];
    if (current.includes(sub)) {
      this.newMerchant.subcategories = current.filter(s => s !== sub);
    } else {
      this.newMerchant.subcategories = [...current, sub];
    }
  }

  onSaveEditMerchant(e: Event): void {
    e.preventDefault();
    this.editMerchantError.set(null);
    this.isSavingEdit.set(true);

    const updatePayload = {
      name: this.editingMerchant.name.trim(),
      category: this.editingMerchant.category,
      subcategories: this.editingMerchant.subcategories,
      whatsapp_number: this.editingMerchant.whatsapp.trim(),
      phone: this.editingMerchant.whatsapp.trim(),
      address: this.editingMerchant.address.trim(),
      base_delivery_fee: this.editingMerchant.deliveryFee,
      commission_percentage: this.editingMerchant.commission,
      is_active: this.editingMerchant.isActive
    };

    this.api.updateTenant(this.editingMerchant.id, updatePayload).subscribe({
      next: () => {
        this.isSavingEdit.set(false);
        this.isEditModalOpen.set(false);
        this.showToast('success', '¡Datos Actualizados!', `Los datos de "${updatePayload.name}" fueron guardados exitosamente.`);
        this.merchants.update(list => list.map(m => {
          if (m.id === this.editingMerchant.id) {
            return {
              ...m,
              name: updatePayload.name,
              category: updatePayload.category,
              isActive: updatePayload.is_active,
              commissionPercentage: updatePayload.commission_percentage,
              contact: {
                ...m.contact,
                whatsappNumber: updatePayload.whatsapp_number,
                address: updatePayload.address
              },
              deliverySettings: {
                ...m.deliverySettings,
                baseDeliveryFee: updatePayload.base_delivery_fee
              }
            };
          }
          return m;
        }));
      },
      error: (err: any) => {
        this.isSavingEdit.set(false);
        this.editMerchantError.set(err.error?.message || 'Error actualizando los datos del comercio.');
      }
    });
  }

  readonly availableRoles: UserRole[] = [
    'SUPER_ADMIN',
    'PLATFORM_SUPPORT',
    'MERCHANT_OWNER',
    'MERCHANT_MANAGER',
    'MERCHANT_KITCHEN',
    'MERCHANT_DISPATCH',
    'RIDER'
  ];

  readonly roleLabels: Record<string, string> = {
    SUPER_ADMIN: 'SuperAdmin',
    PLATFORM_SUPPORT: 'Soporte SaaS',
    MERCHANT_OWNER: 'Dueño Local',
    MERCHANT_MANAGER: 'Encargado',
    MERCHANT_KITCHEN: 'Cocina',
    MERCHANT_DISPATCH: 'Despacho',
    RIDER: 'Motorizado',
    CUSTOMER: 'Cliente'
  };

  getRoleLabel(role: any): string {
    if (!role) return 'Usuario';
    const norm = String(role).toUpperCase().trim();
    if (norm === 'SUPER_ADMIN' || norm === 'SUPERADMIN') return 'SuperAdmin';
    if (norm === 'MERCHANT_OWNER' || norm === 'MERCHANT_ADMIN' || norm === 'ADMIN' || norm === 'OWNER') return 'Dueño Local';
    if (norm === 'MERCHANT_MANAGER' || norm === 'BRANCH_MANAGER' || norm === 'MANAGER') return 'Encargado';
    if (norm === 'MERCHANT_KITCHEN' || norm === 'KITCHEN' || norm === 'COCINA') return 'Cocina';
    if (norm === 'MERCHANT_DISPATCH' || norm === 'DISPATCH' || norm === 'DESPACHO') return 'Despacho';
    if (norm === 'RIDER' || norm === 'MOTORIZADO' || norm === 'REPARTIDOR') return 'Motorizado';
    if (norm === 'CUSTOMER' || norm === 'CLIENTE') return 'Cliente';
    return this.roleLabels[norm] || String(role);
  }

  readonly availablePermissions: { id: Permission; label: string }[] = [
    { id: 'manage_tenants', label: 'Alta y Baja de Comercios' },
    { id: 'manage_commissions', label: 'Modificar Comisiones de Red' },
    { id: 'manage_roles', label: 'Gestionar Matriz de Permisos' },
    { id: 'manage_catalog', label: 'Catálogo de Platos y Modificadores' },
    { id: 'manage_inventory', label: 'Control de Stock e Inventario' },
    { id: 'manage_orders', label: 'Ver y Gestionar Comandas' },
    { id: 'assign_riders', label: 'Asignar Motorizados a Pedidos' },
    { id: 'manage_riders', label: 'Crear y Gestionar Motorizados' },
    { id: 'manage_store_users', label: 'Crear Usuarios del Comercio' },
    { id: 'view_realtime_gps', label: 'Ver Ubicación en Tiempo Real del Repartidor' },
    { id: 'accept_deliveries', label: 'Aceptar y Entregar Pedidos (Motorizado)' },
    { id: 'view_reports', label: 'Ver Reportes y Finanzas' }
  ];

  isRolePermitted(role: UserRole, permission: Permission): boolean {
    const list = this.auth.rolePermissions()[role] || [];
    return list.includes(permission);
  }

  togglePermission(role: UserRole, permission: Permission): void {
    this.auth.toggleRolePermission(role, permission);
    const roleName = this.roleLabels[role] || role;
    this.showToast('success', '¡Permiso Actualizado!', `Permisos modificados correctamente para el rol "${roleName}".`);
  }

  toggleMerchantActive(id: string): void {
    const m = this.merchants().find(item => item.id === id);
    const newActive = m ? !m.isActive : true;
    this.merchants.update(list => 
      list.map(item => item.id === id ? { ...item, isActive: newActive } : item)
    );
    this.api.updateTenant(id, { is_active: newActive }).subscribe({
      next: () => console.log(`[SuperAdmin] Comercio ${id} estado actualizado a ${newActive}`),
      error: (err) => console.warn('[SuperAdmin] Error actualizando estado en backend:', err)
    });
  }

  onCreateMerchant(e: Event): void {
    e.preventDefault();
    this.createMerchantError.set(null);
    this.isCreatingMerchant.set(true);

    const payload = {
      name: this.newMerchant.name.trim(),
      slug: this.newMerchant.slug.trim() || this.newMerchant.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
      category: this.newMerchant.category,
      subcategories: this.newMerchant.subcategories,
      whatsapp: this.newMerchant.whatsapp.trim(),
      address: this.newMerchant.address.trim(),
      deliveryFee: this.newMerchant.deliveryFee,
      commission: this.newMerchant.commission,
      owner_name: this.newMerchant.ownerName.trim() || `${this.newMerchant.name} (Dueño)`,
      owner_email: this.newMerchant.ownerEmail.trim().toLowerCase(),
      owner_password: this.newMerchant.ownerPassword || '123456'
    };

    this.api.createTenant(payload).subscribe({
      next: (res: any) => {
        this.isCreatingMerchant.set(false);
        this.isCreateModalOpen.set(false);
        this.showToast('success', '¡Comercio Creado!', `El comercio "${payload.name}" fue dado de alta con éxito.`);
        this.api.getTenants(true).subscribe(tenants => {
          if (tenants && tenants.length > 0) {
            this.merchants.set(tenants);
          }
        });
        this.createdCredentialsModal.set({
          tenantName: payload.name,
          ownerName: res.owner?.name || payload.owner_name,
          email: res.owner?.email || payload.owner_email,
          pass: res.owner?.password || payload.owner_password,
          slug: payload.slug
        });
        this.newMerchant = {
          name: '',
          slug: '',
          category: 'Restaurantes',
          subcategories: [],
          whatsapp: '+58412',
          address: '',
          deliveryFee: 2.50,
          commission: 5.0,
          ownerName: '',
          ownerEmail: '',
          ownerPassword: ''
        };
      },
      error: (err: any) => {
        this.isCreatingMerchant.set(false);
        this.createMerchantError.set(err.error?.message || 'Error creando comercio en el servidor.');
      }
    });
  }

  copyCredentials(): void {
    const cred = this.createdCredentialsModal();
    if (!cred) return;
    const text = `🏪 Credenciales de Acceso - ${cred.tenantName}\n👤 Dueño: ${cred.ownerName}\n✉️ Correo: ${cred.email}\n🔑 Contraseña: ${cred.pass}\n🔗 Panel de Administración: http://localhost:4200/merchant-admin\n📱 Menú WhatsApp: http://localhost:4200/t/${cred.slug}`;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text);
      this.copiedCredentials.set(true);
      setTimeout(() => this.copiedCredentials.set(false), 2500);
    }
  }

  // --- GESTIÓN DE APROBACIÓN DE SUCURSALES ---
  loadPendingBranches(): void {
    this.api.getPendingBranches().subscribe(branches => {
      this.pendingBranches.set(branches || []);
    });
  }

  approveBranch(branch: Branch): void {
    this.api.approveBranch(branch.id).subscribe(() => {
      this.loadPendingBranches();
      this.showToast('success', '¡Sucursal Aprobada!', `La sucursal "${branch.name}" fue aprobada y activada.`);
      this.branchApprovalNotice.set(`✓ Sucursal "${branch.name}" aprobada exitosamente y activada en el radar.`);
      setTimeout(() => this.branchApprovalNotice.set(null), 5000);
    });
  }

  openRejectModal(branch: Branch): void {
    this.selectedBranchToReject.set(branch);
    this.rejectionReason = '';
    this.rejectReasonModalOpen.set(true);
  }

  confirmRejectBranch(): void {
    const b = this.selectedBranchToReject();
    if (!b) return;
    const reason = this.rejectionReason.trim() || 'Coordenadas o datos de verificación incompletos.';
    this.api.rejectBranch(b.id, reason).subscribe(() => {
      this.rejectReasonModalOpen.set(false);
      this.selectedBranchToReject.set(null);
      this.loadPendingBranches();
      this.branchApprovalNotice.set(`Sede "${b.name}" rechazada.`);
      setTimeout(() => this.branchApprovalNotice.set(null), 5000);
    });
  }

  // --- GESTIÓN DE COMERCIOS DESTACADOS ---
  toggleMerchantFeatured(m: Tenant): void {
    const nextVal = !m.isFeatured;
    this.merchants.update(list => list.map(item => item.id === m.id ? { ...item, isFeatured: nextVal } : item));
    this.api.updateTenant(m.id, { is_featured: nextVal }).subscribe({
      next: () => {
        const msg = nextVal ? `⭐ "${m.name}" marcado como Comercio Destacado.` : `"${m.name}" retirado de destacados.`;
        this.branchApprovalNotice.set(msg);
        setTimeout(() => this.branchApprovalNotice.set(null), 3500);
      }
    });
  }

  // --- GESTIÓN DE BANNERS & PROMOCIONES GLOBALES ---
  loadBanners(): void {
    this.api.getBanners(false).subscribe(banners => {
      this.banners.set(banners || []);
    });
  }

  openCreateBannerModal(): void {
    this.editingBanner = {
      title: '',
      subtitle: '',
      couponCode: '',
      badgeText: '⚡ PROMOCIÓN FLASH',
      buttonText: 'Pedir ahora',
      linkUrl: '/explorar',
      imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500&auto=format&fit=crop&q=80',
      bgGradientStart: '#f97316',
      bgGradientEnd: '#ea580c',
      sortOrder: (this.banners().length + 1),
      isActive: true,
    };
    this.isBannerModalOpen.set(true);
  }

  openEditBannerModal(b: Banner): void {
    this.editingBanner = { ...b };
    this.isBannerModalOpen.set(true);
  }

  saveBanner(): void {
    if (!this.editingBanner.title?.trim()) {
      alert('El título del banner es requerido.');
      return;
    }
    this.isSavingBanner.set(true);

    if (this.editingBanner.id) {
      this.api.updateBanner(this.editingBanner.id, this.editingBanner).subscribe({
        next: (saved) => {
          this.isSavingBanner.set(false);
          this.isBannerModalOpen.set(false);
          this.loadBanners();
          this.bannerActionNotice.set('✓ Banner actualizado correctamente.');
          setTimeout(() => this.bannerActionNotice.set(null), 3500);
        },
        error: () => this.isSavingBanner.set(false)
      });
    } else {
      this.api.createBanner(this.editingBanner).subscribe({
        next: (created) => {
          this.isSavingBanner.set(false);
          this.isBannerModalOpen.set(false);
          this.loadBanners();
          this.bannerActionNotice.set('✓ Nuevo banner promocional publicado.');
          setTimeout(() => this.bannerActionNotice.set(null), 3500);
        },
        error: () => this.isSavingBanner.set(false)
      });
    }
  }

  toggleBannerActive(b: Banner): void {
    const nextVal = !b.isActive;
    this.api.updateBanner(b.id, { isActive: nextVal }).subscribe(() => {
      this.banners.update(list => list.map(item => item.id === b.id ? { ...item, isActive: nextVal } : item));
    });
  }

  deleteBanner(b: Banner): void {
    if (!confirm(`¿Eliminar el banner "${b.title}"?`)) return;
    this.api.deleteBanner(b.id).subscribe(() => {
      this.banners.update(list => list.filter(item => item.id !== b.id));
      this.bannerActionNotice.set(`Banner "${b.title}" eliminado.`);
      setTimeout(() => this.bannerActionNotice.set(null), 3500);
    });
  }

  // --- MÉTODOS DE GESTIÓN DE CATEGORÍAS GLOBALES ---
  openNewCategoryModal(): void {
    this.editingCategory = {
      name: '',
      slug: '',
      icon: '🛍️',
      subcategories: [],
      sort_order: (this.businessCategories().length + 1),
      is_active: true
    };
    this.newSubcategoryInput = '';
    this.isCategoryModalOpen.set(true);
  }

  openEditCategoryModal(cat: BusinessCategory): void {
    this.editingCategory = {
      ...cat,
      subcategories: [...(cat.subcategories || [])]
    };
    this.newSubcategoryInput = '';
    this.isCategoryModalOpen.set(true);
  }

  addSubcategoryToEditing(): void {
    const val = this.newSubcategoryInput.trim();
    if (!val) return;
    const current = this.editingCategory.subcategories || [];
    if (!current.includes(val)) {
      this.editingCategory.subcategories = [...current, val];
    }
    this.newSubcategoryInput = '';
  }

  removeSubcategoryFromEditing(sub: string): void {
    const current = this.editingCategory.subcategories || [];
    this.editingCategory.subcategories = current.filter(s => s !== sub);
  }

  saveBusinessCategory(): void {
    if (!this.editingCategory.name) return;
    this.isSavingCategory.set(true);

    if (this.editingCategory.id) {
      this.api.updateBusinessCategory(this.editingCategory.id, this.editingCategory).subscribe({
        next: (saved) => {
          this.isSavingCategory.set(false);
          this.isCategoryModalOpen.set(false);
          this.loadBusinessCategories();
          this.showToast('success', '¡Categoría Actualizada!', `La categoría "${saved.name}" fue actualizada exitosamente.`);
          this.categoryActionNotice.set(`✓ Categoría "${saved.name}" actualizada con éxito.`);
          setTimeout(() => this.categoryActionNotice.set(null), 3500);
        },
        error: (err: any) => {
          this.isSavingCategory.set(false);
          this.showToast('error', 'Error al Guardar', err.error?.message || 'No se pudo actualizar la categoría.');
        }
      });
    } else {
      this.api.createBusinessCategory(this.editingCategory).subscribe({
        next: (created) => {
          this.isSavingCategory.set(false);
          this.isCategoryModalOpen.set(false);
          this.loadBusinessCategories();
          this.showToast('success', '¡Categoría Creada!', `La categoría "${created.name}" fue creada con éxito.`);
          this.categoryActionNotice.set(`✓ Nueva categoría "${created.name}" creada con éxito.`);
          setTimeout(() => this.categoryActionNotice.set(null), 3500);
        },
        error: (err: any) => {
          this.isSavingCategory.set(false);
          this.showToast('error', 'Error al Crear', err.error?.message || 'No se pudo crear la categoría.');
        }
      });
    }
  }

  toggleCategoryActive(cat: BusinessCategory): void {
    const nextVal = !cat.is_active;
    this.api.updateBusinessCategory(cat.id, { is_active: nextVal }).subscribe(() => {
      this.loadBusinessCategories();
    });
  }

  deleteCategory(cat: BusinessCategory): void {
    if (!confirm(`¿Eliminar la categoría "${cat.name}"?`)) return;
    this.api.deleteBusinessCategory(cat.id).subscribe(() => {
      this.loadBusinessCategories();
      this.categoryActionNotice.set(`Categoría "${cat.name}" eliminada.`);
      setTimeout(() => this.categoryActionNotice.set(null), 3500);
    });
  }

  async logout(): Promise<void> {
    await this.supabase.signOut();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
