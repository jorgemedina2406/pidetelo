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
import { IconComponent } from '../../shared/components/icon.component';

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
  readonly activeTab = signal<'merchants' | 'branch_approvals' | 'roles' | 'metrics'>('merchants');
  searchMerchant = '';
  readonly isCreateModalOpen = signal(false);

  readonly merchants = signal<Tenant[]>([]);
  readonly pendingBranches = signal<Branch[]>([]);
  readonly rejectReasonModalOpen = signal(false);
  readonly selectedBranchToReject = signal<Branch | null>(null);
  rejectionReason = '';
  readonly branchApprovalNotice = signal<string | null>(null);

  ngOnInit(): void {
    this.api.getTenants(true).subscribe(tenants => {
      this.merchants.set(tenants || []);
    });
    this.loadPendingBranches();
  }

  readonly filteredMerchants = computed(() => {
    const q = this.searchMerchant.toLowerCase().trim();
    if (!q) return this.merchants();
    return this.merchants().filter(m => 
      m.name.toLowerCase().includes(q) || 
      m.category.toLowerCase().includes(q) || 
      m.slug.toLowerCase().includes(q)
    );
  });

  readonly activeMerchantsCount = computed(() => this.merchants().filter(m => m.isActive).length);

  newMerchant = {
    name: '',
    slug: '',
    category: 'Hamburguesas',
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
  editingMerchant = {
    id: '',
    name: '',
    slug: '',
    category: 'Hamburguesas',
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
      category: m.category,
      whatsapp: m.contact?.whatsappNumber || '',
      address: m.contact?.address || '',
      deliveryFee: m.deliverySettings?.baseDeliveryFee ?? 2.50,
      commission: m.commissionPercentage ?? 5.0,
      isActive: m.isActive
    };
    this.editMerchantError.set(null);
    this.isEditModalOpen.set(true);
  }

  onSaveEditMerchant(e: Event): void {
    e.preventDefault();
    this.editMerchantError.set(null);
    this.isSavingEdit.set(true);

    const updatePayload = {
      name: this.editingMerchant.name.trim(),
      category: this.editingMerchant.category,
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

  readonly roleLabels: Record<UserRole, string> = {
    SUPER_ADMIN: 'SuperAdmin',
    PLATFORM_SUPPORT: 'Soporte SaaS',
    MERCHANT_OWNER: 'Dueño Local',
    MERCHANT_MANAGER: 'Encargado',
    MERCHANT_KITCHEN: 'Cocina',
    MERCHANT_DISPATCH: 'Despacho',
    RIDER: 'Motorizado',
    CUSTOMER: 'Cliente'
  };

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
          category: 'Hamburguesas',
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

  async logout(): Promise<void> {
    await this.supabase.signOut();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
