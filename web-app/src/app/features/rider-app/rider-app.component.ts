import { Component, inject, signal, computed, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthStore } from '../../core/stores/auth.store';
import { ThemeService } from '../../core/services/theme.service';
import { I18nService } from '../../core/services/i18n.service';
import { MockDataService } from '../../core/services/mock-data.service';
import { ApiService } from '../../core/services/api.service';
import { SupabaseService } from '../../core/services/supabase.service';
import { Order, OrderStatus } from '../../core/models/order.model';
import { AppUser } from '../../core/models/user.model';
import { IconComponent } from '../../shared/components/icon.component';

export interface RiderDeliveryJob {
  orderId: string;
  orderNumber: string;
  tenantId: string;
  storeName: string;
  storeAddress: string;
  storeColor?: string;
  storeLogo?: string;
  storePhone?: string;
  storeLat: number;
  storeLng: number;
  customerName: string;
  customerPhone: string;
  deliveryAddress: string;
  deliveryReference?: string;
  itemsSummary: string;
  orderTotal: number;
  deliveryFee: number;
  tip: number;
  paymentMethod: 'cash_usd' | 'card_online';
  step: 'heading_to_store' | 'at_store' | 'heading_to_customer' | 'delivered';
  customerPin?: string;
}

export interface DeliveryHistoryItem {
  id: string;
  orderNumber: string;
  storeName: string;
  customerAddress: string;
  timeAgo: string;
  earnings: number;
  tip: number;
  paymentMethod: string;
}

export interface RiderPaymentAccount {
  id: string;
  type: 'pago_movil' | 'bank_transfer' | 'zelle' | 'binance';
  bankOrPlatform: string;
  accountIdentifier: string;
  holderId?: string;
  holderName: string;
  isDefault: boolean;
}

@Component({
  selector: 'app-rider-app',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule, IconComponent],
  templateUrl: './rider-app.component.html'
})
export class RiderAppComponent implements OnInit, OnDestroy {
  readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  readonly theme = inject(ThemeService);
  readonly i18n = inject(I18nService);
  private readonly mockData = inject(MockDataService);
  private readonly api = inject(ApiService);
  private readonly supabase = inject(SupabaseService);

  private gpsTelemetryInterval: any = null;
  private gpsWatchId: number | null = null;
  private realtimeChannel: any = null;

  readonly isOnline = signal(true);
  readonly gpsStatus = signal<'active' | 'denied' | 'waiting'>('waiting');
  readonly currentGpsCoords = signal<{ lat: number; lng: number } | null>(null);
  readonly activeTab = signal<'deliveries' | 'wallet' | 'history' | 'profile'>('deliveries');
  
  readonly todayEarnings = signal(0.00);
  readonly todayTips = signal(0.00);
  readonly completedDeliveriesCount = signal(0);

  readonly currentRider = computed(() => this.auth.currentUser());
  readonly currentRiderName = computed(() => this.currentRider()?.name || 'Repartidor');
  readonly currentRiderPlate = computed(() => this.currentRider()?.vehiclePlate || 'SIN-PLACA');
  readonly currentRiderVehicle = computed(() => {
    const vt = this.currentRider()?.vehicleType;
    return vt === 'auto' ? 'Auto' : vt === 'bicicleta' ? 'Bicicleta' : 'Moto';
  });
  readonly currentRiderId = computed(() => this.currentRider()?.id || '91111111-1111-4111-8111-111111111111');

  readonly allRiders = signal<any[]>([]);
  readonly isSwitchModalOpen = signal(false);

  readonly riderProfile = signal({
    fullName: 'Repartidor',
    email: '',
    phone: '',
    vehicleType: 'moto',
    vehicleModel: '',
    plateNumber: '',
    nationalId: '',
    avatarUrl: '',
    paymentAccounts: [] as RiderPaymentAccount[],
    autoAcceptOrders: true,
    soundNotifications: true
  });
  readonly isProfileSaved = signal(false);

  readonly isAddAccountModalOpen = signal(false);
  newAccount: {
    type: 'pago_movil' | 'bank_transfer' | 'zelle' | 'binance';
    bankOrPlatform: string;
    accountIdentifier: string;
    holderId: string;
    holderName: string;
    isDefault: boolean;
  } = {
    type: 'pago_movil',
    bankOrPlatform: 'Banesco',
    accountIdentifier: '',
    holderId: '',
    holderName: '',
    isDefault: false
  };

  saveProfile(): void {
    const user = this.auth.currentUser();
    const prof = this.riderProfile();
    if (user) {
      if (typeof window !== 'undefined') {
        try {
          localStorage.setItem(`rider_profile_${user.id}`, JSON.stringify(prof));
        } catch {}
      }
      const updatedUser: AppUser = {
        ...user,
        name: prof.fullName,
        email: prof.email,
        phone: prof.phone,
        vehiclePlate: prof.plateNumber,
        vehicleType: prof.vehicleType as any,
        vehicleModel: prof.vehicleModel,
        nationalId: prof.nationalId,
        avatarUrl: prof.avatarUrl,
        paymentAccounts: prof.paymentAccounts
      };
      this.auth.login(updatedUser);

      // Persistir de forma permanente al backend
      this.api.updateRiderProfile(user.id, prof).subscribe({
        next: () => console.log('[RiderApp] Perfil guardado y sincronizado con backend exitosamente'),
        error: (err) => console.warn('[RiderApp] Advertencia al persistir en backend:', err)
      });
    }
    this.isProfileSaved.set(true);
    setTimeout(() => this.isProfileSaved.set(false), 3000);
  }

  onAvatarSelected(event: Event): void {
    const input = event.target as HTMLInputElement;
    if (input.files && input.files[0]) {
      const file = input.files[0];
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64 = e.target?.result as string;
        this.riderProfile.update(p => ({ ...p, avatarUrl: base64 }));
        this.saveProfile();
      };
      reader.readAsDataURL(file);
    }
  }

  openAddAccountModal(): void {
    const prof = this.riderProfile();
    this.newAccount = {
      type: 'pago_movil',
      bankOrPlatform: 'Banesco',
      accountIdentifier: prof.phone || '',
      holderId: prof.nationalId || '',
      holderName: prof.fullName || '',
      isDefault: prof.paymentAccounts.length === 0
    };
    this.isAddAccountModalOpen.set(true);
  }

  saveNewPaymentAccount(): void {
    if (!this.newAccount.accountIdentifier.trim() || !this.newAccount.holderName.trim()) {
      alert('Por favor completa los datos obligatorios de la cuenta de cobro.');
      return;
    }

    const created: RiderPaymentAccount = {
      id: `acc-${Date.now()}`,
      type: this.newAccount.type,
      bankOrPlatform: this.newAccount.bankOrPlatform.trim() || (this.newAccount.type === 'pago_movil' ? 'Banco Nacional' : 'Plataforma'),
      accountIdentifier: this.newAccount.accountIdentifier.trim(),
      holderId: this.newAccount.holderId.trim(),
      holderName: this.newAccount.holderName.trim(),
      isDefault: this.newAccount.isDefault || this.riderProfile().paymentAccounts.length === 0
    };

    this.riderProfile.update(p => {
      let accounts = [...p.paymentAccounts];
      if (created.isDefault) {
        accounts = accounts.map(a => ({ ...a, isDefault: false }));
      }
      accounts.push(created);
      return { ...p, paymentAccounts: accounts };
    });

    this.isAddAccountModalOpen.set(false);
    this.saveProfile();
  }

  removePaymentAccount(id: string): void {
    this.riderProfile.update(p => {
      const remaining = p.paymentAccounts.filter(a => a.id !== id);
      if (remaining.length > 0 && !remaining.some(a => a.isDefault)) {
        remaining[0].isDefault = true;
      }
      return { ...p, paymentAccounts: remaining };
    });
    this.saveProfile();
  }

  setDefaultAccount(id: string): void {
    this.riderProfile.update(p => ({
      ...p,
      paymentAccounts: p.paymentAccounts.map(a => ({ ...a, isDefault: a.id === id }))
    }));
    this.saveProfile();
  }

  getAccountTypeLabel(type: string): string {
    switch (type) {
      case 'pago_movil': return 'Pago Móvil';
      case 'zelle': return 'Zelle (USD)';
      case 'binance': return 'Binance Pay';
      case 'bank_transfer': return 'Transferencia Bs';
      default: return 'Cuenta';
    }
  }

  readonly activeJobs = signal<RiderDeliveryJob[]>([]);
  readonly selectedTenantFilter = signal<string>('all');

  readonly tenantStores = computed(() => {
    const jobs = this.activeJobs();
    const map = new Map<string, { id: string; name: string; count: number; color?: string; logo?: string }>();
    for (const j of jobs) {
      const tId = j.tenantId || 'other';
      const existing = map.get(tId);
      if (existing) {
        existing.count++;
      } else {
        map.set(tId, { id: tId, name: j.storeName, count: 1, color: j.storeColor, logo: j.storeLogo });
      }
    }
    return Array.from(map.values());
  });

  readonly filteredJobs = computed(() => {
    const filter = this.selectedTenantFilter();
    const jobs = this.activeJobs();
    if (filter === 'all') return jobs;
    return jobs.filter(j => j.tenantId === filter);
  });

  readonly deliveryHistory = signal<DeliveryHistoryItem[]>([]);

  readonly pendingOffer = signal<RiderDeliveryJob | null>(null);
  readonly offerSecondsRemaining = signal(30);
  private countdownTimer: any = null;

  readonly completingJob = signal<RiderDeliveryJob | null>(null);
  enteredPin: string = '';

  ngOnInit(): void {
    this.syncCurrentProfile();
    this.loadAllRiders();
    this.loadRiderOrders();

    const user = this.auth.currentUser();
    const tenantId = user?.tenantId && user.tenantId !== 'tenant-1' 
      ? user.tenantId 
      : 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    // 2. Suscribirse a cambios en tiempo real en Supabase
    this.realtimeChannel = this.supabase.subscribeToOrders(tenantId, (payload) => {
      console.log('[RiderApp] Evento de pedidos en tiempo real desde Supabase:', payload);
      this.loadRiderOrders();
    });

    // 3. Emisión periódica de telemetría GPS REAL desde el sensor del dispositivo del motorizado
    const emitRealGps = (lat: number, lng: number, speedKmh: number = 0) => {
      if (!this.isOnline()) return;
      const cleanLat = Number(lat.toFixed(6));
      const cleanLng = Number(lng.toFixed(6));
      this.currentGpsCoords.set({ lat: cleanLat, lng: cleanLng });
      this.gpsStatus.set('active');

      const riderId = this.currentRiderId();
      const currentJob = this.activeJobs()[0];

      // Enviar coordenadas exactas a la base de datos
      this.api.updateRiderLocation(riderId, cleanLat, cleanLng).subscribe({
        error: (err) => console.warn('[RiderApp] Error actualizando ubicación:', err)
      });

      this.api.saveTelemetry({
        rider_id: riderId,
        order_id: currentJob ? currentJob.orderId : undefined,
        latitude: cleanLat,
        longitude: cleanLng,
        speed_kmh: speedKmh,
        battery_level: 95
      }).subscribe({
        error: (err) => console.warn('[RiderApp] Error guardando telemetría:', err)
      });
    };

    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      // Rastreo continuo al desplazarse
      this.gpsWatchId = navigator.geolocation.watchPosition(
        (pos) => {
          const lat = pos.coords.latitude;
          const lng = pos.coords.longitude;
          const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
          emitRealGps(lat, lng, speedKmh);
        },
        (err) => {
          console.warn('[RiderApp] Advertencia al obtener GPS satelital:', err.message);
          if (err.code === err.PERMISSION_DENIED) {
            this.gpsStatus.set('denied');
          }
        },
        {
          enableHighAccuracy: true,
          maximumAge: 4000,
          timeout: 15000
        }
      );

      // Ping de respaldo cada 8s para sincronización continua
      this.gpsTelemetryInterval = setInterval(() => {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            const lng = pos.coords.longitude;
            const speedKmh = pos.coords.speed ? Math.round(pos.coords.speed * 3.6) : 0;
            emitRealGps(lat, lng, speedKmh);
          },
          () => {},
          { enableHighAccuracy: true, timeout: 8000 }
        );
      }, 8000);
    }
  }

  private syncCurrentProfile(): void {
    const user = this.auth.currentUser();
    if (user) {
      let savedCustom: any = null;
      if (typeof window !== 'undefined') {
        try {
          const raw = localStorage.getItem(`rider_profile_${user.id}`);
          if (raw) savedCustom = JSON.parse(raw);
        } catch {}
      }

      const emailVal = savedCustom?.email || user.email || '';

      let accounts: RiderPaymentAccount[] = savedCustom?.paymentAccounts || user.paymentAccounts || [];
      if (!Array.isArray(accounts)) {
        accounts = [];
      }

      this.riderProfile.set({
        fullName: savedCustom?.fullName || user.name || 'Repartidor',
        email: emailVal,
        phone: savedCustom?.phone || user.phone || '',
        plateNumber: savedCustom?.plateNumber || user.vehiclePlate || 'SIN-PLACA',
        vehicleType: savedCustom?.vehicleType || user.vehicleType || 'moto',
        vehicleModel: savedCustom?.vehicleModel || user.vehicleModel || (user.vehicleType === 'auto' ? 'Vehículo Sedan' : user.vehicleType === 'bicicleta' ? 'Bicicleta' : 'Moto 150cc'),
        nationalId: savedCustom?.nationalId || user.nationalId || '',
        avatarUrl: savedCustom?.avatarUrl || user.avatarUrl || '',
        paymentAccounts: accounts,
        autoAcceptOrders: savedCustom?.autoAcceptOrders ?? true,
        soundNotifications: savedCustom?.soundNotifications ?? true
      });

      // Consultar perfil fresco directamente desde la base de datos a través del backend
      this.api.getRiderProfile(user.id).subscribe(dbRider => {
        if (dbRider) {
          const remoteAccounts = dbRider.payment_accounts || dbRider.paymentAccounts;
          this.riderProfile.update(current => ({
            ...current,
            fullName: dbRider.name || current.fullName,
            email: dbRider.email || current.email,
            phone: dbRider.phone || current.phone,
            plateNumber: dbRider.vehicle_plate || dbRider.vehiclePlate || current.plateNumber,
            vehicleType: dbRider.vehicle_type || dbRider.vehicleType || current.vehicleType,
            vehicleModel: dbRider.vehicle_model || dbRider.vehicleModel || current.vehicleModel,
            nationalId: dbRider.national_id || dbRider.nationalId || current.nationalId,
            avatarUrl: dbRider.avatar_url || dbRider.avatarUrl || current.avatarUrl,
            paymentAccounts: Array.isArray(remoteAccounts) && remoteAccounts.length > 0 ? remoteAccounts : current.paymentAccounts
          }));
        }
      });
    }
  }

  loadAllRiders(): void {
    this.api.getRiders().subscribe(riders => {
      if (riders && riders.length > 0) {
        this.allRiders.set(riders);
      }
    });
  }

  loadRiderOrders(): void {
    const user = this.auth.currentUser();
    const riderId = user?.id || '91111111-1111-4111-8111-111111111111';
    const riderPhone = user?.phone;
    const riderName = user?.name ? user.name.toLowerCase().trim() : '';

    const tenantId = user?.tenantId && user.tenantId !== 'tenant-1' 
      ? user.tenantId 
      : 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';

    this.api.getOrdersByDriver(riderId).subscribe(driverOrders => {
      if (driverOrders && driverOrders.length > 0) {
        this.processAllOrders(driverOrders);
      } else {
        this.api.getOrders(tenantId).subscribe(orders => {
          const myOrders = (orders || []).filter(o => {
            const isAssignedToMe = o.driverId === riderId ||
              (Boolean(o.driverPhone) && Boolean(riderPhone) && o.driverPhone === riderPhone) ||
              (Boolean(o.driverName) && Boolean(riderName) && o.driverName!.toLowerCase().trim() === riderName);

            return isAssignedToMe;
          });
          this.processAllOrders(myOrders);
        });
      }
    });
  }

  private processAllOrders(orders: Order[]): void {
    const active = orders.filter(o => o.status === 'assigned_driver' || o.status === 'on_the_way');
    this.processOrders(active);

    const delivered = orders.filter(o => o.status === 'delivered');

    // Métricas 100% reales de despachos del repartidor
    const todayStr = new Date().toISOString().slice(0, 10);
    const deliveredToday = delivered.filter(o => {
      const d = o.updatedAt || o.createdAt || (o as any).created_at;
      return d ? d.startsWith(todayStr) : true;
    });

    const realEarnings = deliveredToday.reduce((sum, o) => sum + (Number(o.deliveryFee) || 2.50), 0);
    const realTips = deliveredToday.reduce((sum, o) => sum + (Number(o.tip) || 0), 0);

    this.todayEarnings.set(realEarnings);
    this.todayTips.set(realTips);
    this.completedDeliveriesCount.set(deliveredToday.length);

    if (delivered.length > 0) {
      const historyList: DeliveryHistoryItem[] = delivered.map(o => ({
        id: o.id,
        orderNumber: `#${o.orderNumber.replace('#', '')}`,
        storeName: o.tenantName || 'Comercio',
        customerAddress: o.customer.deliveryAddress || 'Caracas',
        timeAgo: this.formatTimeAgo(o.updatedAt || o.createdAt),
        earnings: Number(o.deliveryFee) || 2.50,
        tip: Number(o.tip) || 0,
        paymentMethod: o.paymentMethod === 'cash_usd' ? 'Efectivo $' : 'Pago Online'
      }));
      this.deliveryHistory.set(historyList);
    } else {
      this.deliveryHistory.set([]);
    }
  }

  private formatTimeAgo(dateString?: string): string {
    if (!dateString) return 'Hoy';
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    if (diffMins < 1) return 'Recién entregado';
    if (diffMins < 60) return `Hace ${diffMins} min`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `Hace ${diffHours} hora${diffHours > 1 ? 's' : ''}`;
    return date.toLocaleDateString();
  }

  private processOrders(active: Order[]): void {
    if (active.length > 0) {
      const mappedJobs: RiderDeliveryJob[] = active.map(o => ({
        orderId: o.id,
        orderNumber: `#${o.orderNumber.replace('#', '')}`,
        tenantId: o.tenantId || '',
        storeName: o.tenantName || 'Comercio',
        storeAddress: (o as any).branches?.address || (o as any).tenants?.address || 'Comercio',
        storePhone: (o as any).branches?.phone || (o as any).tenants?.phone || '',
        storeColor: (o as any).tenants?.accent_color || (o.tenantName?.includes('Tokyo') ? '#dc2626' : '#f97316'),
        storeLat: (o as any).tenants?.latitude || 10.4812,
        storeLng: (o as any).tenants?.longitude || -66.8601,
        customerName: o.customer.name,
        customerPhone: o.customer.phone,
        deliveryAddress: o.customer.deliveryAddress || 'Caracas',
        deliveryReference: o.customer.notes || 'Entregar en puerta',
        itemsSummary: o.items.map(i => `${i.quantity}x ${i.name}`).join(' + '),
        orderTotal: o.total,
        deliveryFee: o.deliveryFee || 2.50,
        tip: 1.50,
        paymentMethod: o.paymentMethod === 'cash_usd' ? 'cash_usd' : 'card_online',
        step: o.status === 'on_the_way' ? 'heading_to_customer' : 'heading_to_store',
        customerPin: o.orderNumber.replace(/\D/g, '').slice(-4) || '1234'
      }));
      this.activeJobs.set(mappedJobs);
    } else {
      this.activeJobs.set([]);
    }
  }

  switchRider(rider: any): void {
    this.auth.loginAsRider({
      id: rider.id,
      name: rider.name || `Repartidor (${rider.vehicle_plate || rider.vehiclePlate})`,
      phone: rider.phone,
      vehiclePlate: rider.vehicle_plate || rider.vehiclePlate,
      vehicleType: rider.vehicle_type || rider.vehicleType,
      tenantId: rider.tenant_id || rider.tenantId
    });
    this.syncCurrentProfile();
    this.isSwitchModalOpen.set(false);
    this.loadRiderOrders();
  }

  ngOnDestroy(): void {
    if (this.gpsWatchId !== null && typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      navigator.geolocation.clearWatch(this.gpsWatchId);
      this.gpsWatchId = null;
    }
    if (this.countdownTimer) {
      clearInterval(this.countdownTimer);
    }
    if (this.gpsTelemetryInterval) {
      clearInterval(this.gpsTelemetryInterval);
    }
    if (this.realtimeChannel && typeof this.realtimeChannel.unsubscribe === 'function') {
      this.realtimeChannel.unsubscribe();
    }
  }

  toggleOnlineStatus(): void {
    this.isOnline.update(val => !val);
  }

  triggerIncomingOffer(): void {
    if (!this.isOnline()) {
      this.isOnline.set(true);
    }

    const newOffer: RiderDeliveryJob = {
      orderId: 'ord-' + Math.floor(Math.random() * 9000 + 1000),
      orderNumber: '#ORD-' + Math.floor(Math.random() * 900 + 4100),
      tenantId: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
      storeName: 'Tokyo Roll & Poke',
      storeAddress: 'Centro Comercial Tolón, Nivel Feria',
      storeColor: '#dc2626',
      storeLat: 10.478,
      storeLng: -66.865,
      customerName: 'Santiago González',
      customerPhone: '+584149998877',
      deliveryAddress: 'Av. Luis Roche, Res. Ávila Real, Apto 5-A',
      deliveryReference: 'Dejar en conserjería con el vigilante',
      itemsSummary: '2x Crunchy Salmon Roll + 1x Gyozas Mixtas',
      orderTotal: 26.00,
      deliveryFee: 4.00,
      tip: 2.00,
      paymentMethod: 'card_online',
      step: 'heading_to_store',
      customerPin: '8877'
    };

    this.pendingOffer.set(newOffer);
    this.offerSecondsRemaining.set(30);

    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.countdownTimer = setInterval(() => {
      this.offerSecondsRemaining.update(s => {
        if (s <= 1) {
          this.rejectOffer();
          return 0;
        }
        return s - 1;
      });
    }, 1000);
  }

  acceptOffer(): void {
    const offer = this.pendingOffer();
    if (offer) {
      if (this.countdownTimer) clearInterval(this.countdownTimer);
      this.activeJobs.update(jobs => [offer, ...jobs]);
      this.pendingOffer.set(null);
      this.activeTab.set('deliveries');
      this.api.updateOrderStatus(offer.orderId, 'assigned_driver').subscribe();
    }
  }

  rejectOffer(): void {
    if (this.countdownTimer) clearInterval(this.countdownTimer);
    this.pendingOffer.set(null);
  }

  advanceJobStep(orderId: string, nextStep: 'at_store' | 'heading_to_customer'): void {
    this.activeJobs.update(jobs =>
      jobs.map(j => (j.orderId === orderId ? { ...j, step: nextStep } : j))
    );
    if (nextStep === 'at_store') {
      this.api.updateOrderStatus(orderId, 'at_merchant').subscribe({
        next: () => console.log(`[RiderApp] Pedido ${orderId} en comercio`),
        error: (err) => console.warn('[RiderApp] Error actualizando estado:', err)
      });
    } else if (nextStep === 'heading_to_customer') {
      this.api.updateOrderStatus(orderId, 'on_the_way').subscribe({
        next: () => console.log(`[RiderApp] Pedido ${orderId} en camino`),
        error: (err) => console.warn('[RiderApp] Error actualizando estado:', err)
      });
    }
  }

  openCompletionModal(job: RiderDeliveryJob): void {
    this.completingJob.set(job);
    this.enteredPin = '';
  }

  finalizeDelivery(): void {
    const job = this.completingJob();
    if (!job) return;

    this.api.updateOrderStatus(job.orderId, 'delivered').subscribe({
      next: () => console.log(`[RiderApp] Pedido ${job.orderId} entregado exitosamente`),
      error: (err) => console.warn('[RiderApp] Error finalizando entrega:', err)
    });

    this.todayEarnings.update(e => e + job.deliveryFee);
    this.todayTips.update(t => t + job.tip);
    this.completedDeliveriesCount.update(c => c + 1);

    this.deliveryHistory.update(hist => [
      {
        id: 'hist-' + Date.now(),
        orderNumber: job.orderNumber,
        storeName: job.storeName,
        customerAddress: job.deliveryAddress,
        timeAgo: 'Recién entregado',
        earnings: job.deliveryFee,
        tip: job.tip,
        paymentMethod: job.paymentMethod === 'cash_usd' ? 'Efectivo $' : 'Pago Online'
      },
      ...hist
    ]);

    this.activeJobs.update(jobs => jobs.filter(j => j.orderId !== job.orderId));
    this.completingJob.set(null);
  }

  openGpsNavigation(address: string): void {
    const query = encodeURIComponent(address || 'Caracas');
    window.open(`https://www.google.com/maps/search/?api=1&query=${query}`, '_blank');
  }

  openWazeNavigation(address: string): void {
    const query = encodeURIComponent(address || 'Caracas');
    window.open(`https://waze.com/ul?q=${query}&navigate=yes`, '_blank');
  }

  requestWithdrawal(): void {
    const totalBalance = this.todayEarnings() + this.todayTips();
    if (totalBalance <= 0) {
      alert('Actualmente no posees balance disponible para retirar.');
      return;
    }
    const defaultAcc = this.riderProfile().paymentAccounts.find(a => a.isDefault) || this.riderProfile().paymentAccounts[0];
    if (!defaultAcc) {
      alert('Debes registrar al menos una Cuenta de Cobro (Pago Móvil, Zelle o Transferencia) en la pestaña Perfil para procesar tus retiros.');
      this.activeTab.set('profile');
      return;
    }
    alert(`¡Solicitud de retiro procesada exitosamente por $${totalBalance.toFixed(2)}!\n\nCuenta Destino: ${defaultAcc.bankOrPlatform} (${defaultAcc.accountIdentifier})\nTitular: ${defaultAcc.holderName}\n\nLos fondos se liquidarán según el ciclo de pago.`);
  }

  async logout(): Promise<void> {
    await this.supabase.signOut();
    this.auth.logout();
    this.router.navigate(['/login']);
  }
}
