import { Component, Input, Output, EventEmitter, inject, signal, OnChanges, SimpleChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import * as L from 'leaflet';
import { Branch } from '../../../core/models/branch.model';
import { IconComponent } from '../../../shared/components/icon.component';
import { ApiService } from '../../../core/services/api.service';

@Component({
  selector: 'app-branch-form-modal',
  standalone: true,
  imports: [CommonModule, FormsModule, IconComponent],
  template: `
    @if (isOpen) {
    <div class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in"
      (click)="close.emit()">
      <div
        class="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6 sm:p-8 border border-slate-200 dark:border-slate-800 space-y-6"
        (click)="$event.stopPropagation()">

        <div class="flex items-center justify-between pb-4 border-b border-slate-200 dark:border-slate-800">
          <div>
            <span class="text-[10px] font-black uppercase tracking-wider text-brand-500 bg-brand-50 dark:bg-brand-950/40 px-2.5 py-1 rounded-full">
              {{ mode === 'create' ? 'Expansión Multi-Sede' : 'Configuración de Sucursal' }}
            </span>
            <h3 class="text-xl font-extrabold mt-1">
              {{ mode === 'create' ? 'Registrar Nueva Sucursal' : 'Editar Sucursal / Sede' }}
            </h3>
            <p class="text-xs text-slate-500 dark:text-slate-400">
              {{ mode === 'create'
                ? 'Define la ubicación física y las cuentas directas donde tus clientes pagarán sin comisiones.'
                : 'Actualiza la dirección física, coordenadas satelitales y radio de cobertura.' }}
            </p>
          </div>
          <button (click)="close.emit()" class="text-slate-400 hover:text-slate-600 dark:hover:text-white p-2 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer">
            <app-icon name="x" [size]="20"></app-icon>
          </button>
        </div>

        @if (errorMessage()) {
        <div class="bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400 p-3 rounded-xl text-xs font-semibold">
          {{ errorMessage() }}
        </div>
        }

        <form (submit)="onSubmit($event)" class="space-y-5 text-xs">
          
          <!-- 1. Datos Operativos y Ubicación -->
          <div class="space-y-3">
            <h4 class="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
              <app-icon name="store" [size]="16" className="text-brand-500"></app-icon>
              <span>1. Datos Operativos y Ubicación</span>
            </h4>

            <div>
              <label class="block font-semibold mb-1">Nombre Comercial de la Sucursal *</label>
              <input type="text" [(ngModel)]="form.name" name="bName" required
                placeholder="Ej: Sede Principal - Centro"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500 font-bold" />
            </div>

            <div>
              <label class="block font-semibold mb-1">Dirección Física Completa *</label>
              <input type="text" [(ngModel)]="form.address" name="bAddress" required
                placeholder="Ej: Av. Libertador con Calle 9, Centro de Cabudare, Local 3"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-3 focus:outline-none focus:border-brand-500" />
            </div>

            <!-- GPS Detection Box -->
            <div class="p-3.5 rounded-xl bg-slate-100 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2.5">
              <div class="flex items-center justify-between">
                <span class="font-bold text-slate-700 dark:text-slate-300">Coordenadas Satelitales (Latitud / Longitud)</span>
                <button type="button" (click)="captureGps()" [disabled]="isDetectingGps()"
                  class="px-3 py-1.5 rounded-lg bg-brand-500 hover:bg-brand-600 text-white font-bold flex items-center gap-1.5 transition-all shadow-xs cursor-pointer">
                  <app-icon name="crosshair" [size]="14"></app-icon>
                  <span>{{ isDetectingGps() ? 'Detectando...' : 'Capturar GPS del Local' }}</span>
                </button>
              </div>

              @if (gpsMessage()) {
              <div class="text-[11px] font-semibold text-brand-600 dark:text-brand-400 bg-brand-50 dark:bg-brand-950/40 p-2 rounded-lg">
                {{ gpsMessage() }}
              </div>
              }

              <div class="grid grid-cols-2 gap-3">
                <div>
                  <label class="block font-semibold text-[11px] mb-1">Latitud</label>
                  <input type="number" step="0.000001" [(ngModel)]="form.latitude" (ngModelChange)="updateMapFromInputs()" name="bLat"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-center font-bold" />
                </div>
                <div>
                  <label class="block font-semibold text-[11px] mb-1">Longitud</label>
                  <input type="number" step="0.000001" [(ngModel)]="form.longitude" (ngModelChange)="updateMapFromInputs()" name="bLng"
                    class="w-full bg-white dark:bg-slate-900 border border-slate-300 dark:border-slate-700 rounded-lg p-2 font-mono text-center font-bold" />
                </div>
              </div>

              <!-- Selector Interactivo en Mapa -->
              <div class="pt-2">
                <div class="flex items-center justify-between text-[11px] text-slate-500 mb-1.5">
                  <span class="font-bold flex items-center gap-1 text-slate-700 dark:text-slate-300">
                    <span>🗺️</span>
                    <span>Fijar en mapa satelital interactivo</span>
                  </span>
                  <span class="text-[10px] text-brand-600 dark:text-brand-400 font-semibold">Clic o arrastrar marcador</span>
                </div>
                <div id="branch-modal-location-map" class="w-full h-44 rounded-xl border border-slate-300 dark:border-slate-700 overflow-hidden shadow-xs z-0"></div>
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-4 gap-3">
              <div>
                <label class="block font-semibold mb-1">Radio Cobertura (km)</label>
                <input type="number" step="0.5" [(ngModel)]="form.deliveryRadiusKm" name="bRadius"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-center font-bold" />
              </div>
              <div>
                <label class="block font-semibold mb-1">Envío Base ($)</label>
                <input type="number" step="0.5" [(ngModel)]="form.baseDeliveryFee" name="bFee"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-center font-bold text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <label class="block font-semibold mb-1">Hora Apertura</label>
                <input type="text" [(ngModel)]="form.openTime" name="bOpen" placeholder="11:30"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-center font-mono font-bold" />
              </div>
              <div>
                <label class="block font-semibold mb-1">Hora Cierre</label>
                <input type="text" [(ngModel)]="form.closeTime" name="bClose" placeholder="23:00"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 text-center font-mono font-bold" />
              </div>
            </div>
          </div>

          <!-- 2. Datos Financieros Directos de Esta Sede -->
          <div class="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h4 class="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <app-icon name="wallet" [size]="16" className="text-orange-500"></app-icon>
                <span>2. Datos Financieros Directos de Esta Sede</span>
              </h4>
              <span class="text-[10px] uppercase font-black tracking-wider bg-orange-100 text-orange-700 dark:bg-orange-950 dark:text-orange-300 px-2 py-0.5 rounded-md">
                0% Comisiones
              </span>
            </div>
            <p class="text-[11px] text-slate-400">
              Los clientes transferirán directamente a estas cuentas cuando ordenen de esta sede. No retenemos ni comisionamos tus ventas.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold mb-1">Banco Pago Móvil</label>
                <input type="text" [(ngModel)]="form.pagoMovilBank" name="bPmBank" required
                  placeholder="Ej: 0105 - Mercantil"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-bold" />
              </div>
              <div>
                <label class="block font-semibold mb-1">Teléfono Pago Móvil</label>
                <input type="text" [(ngModel)]="form.pagoMovilPhone" name="bPmPhone" required
                  placeholder="0412-9988776"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-mono font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold mb-1">Cédula o RIF del Titular</label>
                <input type="text" [(ngModel)]="form.pagoMovilIdNumber" name="bPmId" required
                  placeholder="J-501234567 o V-25.123.456"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-mono font-bold uppercase" />
              </div>
              <div>
                <label class="block font-semibold mb-1">Nombre del Titular de la Cuenta</label>
                <input type="text" [(ngModel)]="form.pagoMovilAccountName" name="bPmAccount" required
                  placeholder="Ej: Inversiones Los Andes C.A."
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-bold" />
              </div>
            </div>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold mb-1">Correo Zelle (Opcional)</label>
                <input type="email" [(ngModel)]="form.zelleEmail" name="bZelle"
                  placeholder="pagos@comercio.com"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-mono" />
              </div>
              <div>
                <label class="block font-semibold mb-1">Titular Zelle (Opcional)</label>
                <input type="text" [(ngModel)]="form.zelleAccountName" name="bZelleName"
                  placeholder="Ej: Comercio Group LLC"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5" />
              </div>
            </div>
          </div>

          <!-- 3. Credenciales de Acceso Exclusivas para Esta Sucursal -->
          <div class="space-y-3 pt-4 border-t border-slate-200 dark:border-slate-800">
            <div class="flex items-center justify-between">
              <h4 class="font-bold text-slate-900 dark:text-white text-sm flex items-center gap-2">
                <app-icon name="lock" [size]="16" className="text-brand-500"></app-icon>
                <span>3. Credenciales de Acceso {{ mode === 'create' ? 'Exclusivas para Esta Sucursal' : 'de Esta Sucursal' }}</span>
              </h4>
              <span class="text-[10px] uppercase font-black tracking-wider px-2 py-0.5 rounded-md"
                [class.bg-brand-100]="mode === 'create'" [class.text-brand-700]="mode === 'create'"
                [class.bg-blue-100]="mode === 'edit'" [class.text-blue-700]="mode === 'edit'">
                {{ mode === 'create' ? 'Ingreso Independiente' : 'Seguridad Sede' }}
              </span>
            </div>
            <p class="text-[11px] text-slate-400">
              Cada sucursal cuenta con su propio correo y contraseña para ingresar. El personal de esta sede solo podrá gestionar sus propios pedidos, stock y configuración local, sin acceso a las demás sucursales.
            </p>

            <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label class="block font-semibold mb-1">Correo de Acceso Exclusivo {{ mode === 'create' ? '*' : '' }}</label>
                <input type="email" [(ngModel)]="form.managerEmail" name="bManagerEmail" [required]="mode === 'create'"
                  placeholder="ej: sede.centro@micomercio.com"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-bold font-mono text-brand-600 dark:text-brand-400" />
              </div>
              <div>
                <label class="block font-semibold mb-1">
                  {{ mode === 'create' ? 'Contraseña de Acceso *' : 'Nueva Contraseña (Opcional)' }}
                </label>
                <input type="text" [(ngModel)]="form.managerPassword" name="bManagerPass" [required]="mode === 'create'"
                  [placeholder]="mode === 'create' ? 'Contraseña (mínimo 4 caracteres)' : 'Dejar en blanco para conservar'"
                  class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-bold font-mono" />
              </div>
            </div>

            <div>
              <label class="block font-semibold mb-1">Nombre del Encargado / Responsable</label>
              <input type="text" [(ngModel)]="form.managerName" name="bManagerName"
                placeholder="ej: Carlos Mendoza (Gerente de Sede)"
                class="w-full bg-slate-50 dark:bg-slate-800 border border-slate-300 dark:border-slate-700 rounded-xl p-2.5 font-semibold" />
            </div>
          </div>

          @if (mode === 'create') {
          <div class="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2">
            <app-icon name="alert-triangle" [size]="16" className="text-amber-600 flex-shrink-0 mt-0.5"></app-icon>
            <span>
              <strong>Flujo de Aprobación Obligatorio:</strong> La sucursal iniciará en estado <em>Pendiente de Aprobación</em>. Un Super Administrador validará las coordenadas y datos operativos antes de que los clientes la visualicen en la app.
            </span>
          </div>
          }

          <div class="pt-4 border-t border-slate-200 dark:border-slate-800 flex items-center justify-between gap-3 flex-wrap">
            @if (mode === 'edit' && isMainBranchOrOwner && branch && !branch.isMain) {
            <button type="button" (click)="deleteRequested.emit(branch)"
              class="px-4 py-2.5 rounded-xl border border-red-300 dark:border-red-900/60 text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/50 font-bold text-xs flex items-center gap-1.5 cursor-pointer transition-all active:scale-95">
              <app-icon name="trash" [size]="14"></app-icon>
              <span>Eliminar Sucursal</span>
            </button>
            } @else {
              <div></div>
            }

            <div class="flex items-center gap-3 ml-auto">
              <button type="button" (click)="close.emit()" [disabled]="isSaving()"
                class="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 font-semibold cursor-pointer">
                Cancelar
              </button>
              <button type="submit" [disabled]="isSaving()"
                class="px-6 py-2.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-extrabold shadow-md shadow-brand-500/25 flex items-center gap-2 cursor-pointer active:scale-95 transition-all disabled:opacity-50">
                @if (isSaving()) {
                  <span class="animate-spin inline-block w-3.5 h-3.5 border-2 border-white border-t-transparent rounded-full"></span>
                  <span>Guardando...</span>
                } @else {
                  <span>{{ mode === 'create' ? 'Enviar a Revisión de Super Admin' : 'Guardar Cambios de Sucursal' }}</span>
                }
              </button>
            </div>
          </div>

        </form>
      </div>
    </div>
    }
  `
})
export class BranchFormModalComponent implements OnChanges {
  @Input() isOpen = false;
  @Input() mode: 'create' | 'edit' = 'create';
  @Input() branch: Branch | null = null;
  @Input() tenantId = '';
  @Input() tenantName = '';
  @Input() isMainBranchOrOwner = false;
  @Input() creatorRole?: string;
  @Input() creatorBranchId?: string;

  @Output() close = new EventEmitter<void>();
  @Output() branchSaved = new EventEmitter<void>();
  @Output() deleteRequested = new EventEmitter<Branch>();

  private readonly api = inject(ApiService);

  readonly isDetectingGps = signal(false);
  readonly gpsMessage = signal<string | null>(null);
  readonly errorMessage = signal<string | null>(null);
  readonly isSaving = signal(false);

  form: any = this.getDefaultForm();

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['branch'] || changes['isOpen'] || changes['mode']) {
      if (this.isOpen) {
        this.errorMessage.set(null);
        this.gpsMessage.set(null);
        if (this.mode === 'edit' && this.branch) {
          this.form = {
            id: this.branch.id,
            name: this.branch.name,
            address: this.branch.address,
            phone: this.branch.phone || '',
            whatsapp: this.branch.whatsapp || '',
            latitude: this.branch.latitude,
            longitude: this.branch.longitude,
            deliveryRadiusKm: this.branch.deliveryRadiusKm,
            baseDeliveryFee: this.branch.baseDeliveryFee,
            openTime: this.branch.openTime || '11:00',
            closeTime: this.branch.closeTime || '23:00',
            pagoMovilBank: this.branch.paymentCredentials?.pagoMovilBank || '0102 - Banco de Venezuela',
            pagoMovilPhone: this.branch.paymentCredentials?.pagoMovilPhone || '',
            pagoMovilIdNumber: this.branch.paymentCredentials?.pagoMovilIdNumber || '',
            pagoMovilAccountName: this.branch.paymentCredentials?.pagoMovilAccountName || '',
            zelleEmail: this.branch.paymentCredentials?.zelleEmail || '',
            zelleAccountName: this.branch.paymentCredentials?.zelleAccountName || '',
            managerEmail: this.branch.managerEmail || '',
            managerPassword: '',
            managerName: this.branch.managerName || ''
          };
        } else {
          this.form = this.getDefaultForm();
        }
        setTimeout(() => this.initBranchModalMap(), 250);
      } else {
        if (this.branchModalMap) {
          try { this.branchModalMap.remove(); } catch (_) {}
          this.branchModalMap = undefined;
          this.branchModalMarker = undefined;
        }
      }
    }
  }

  private getDefaultForm() {
    return {
      name: '',
      address: '',
      phone: '',
      whatsapp: '',
      latitude: 10.06777,
      longitude: -69.34735,
      deliveryRadiusKm: 8.0,
      baseDeliveryFee: 2.50,
      openTime: '11:30',
      closeTime: '23:00',
      pagoMovilBank: '0102 - Banco de Venezuela',
      pagoMovilPhone: '',
      pagoMovilIdNumber: '',
      pagoMovilAccountName: '',
      zelleEmail: '',
      zelleAccountName: '',
      managerEmail: '',
      managerPassword: '',
      managerName: ''
    };
  }

  captureGps(): void {
    if (typeof navigator !== 'undefined' && 'geolocation' in navigator) {
      this.isDetectingGps.set(true);
      this.gpsMessage.set('Detectando satélites GPS de la sucursal...');
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          const lat = Number(pos.coords.latitude.toFixed(6));
          const lng = Number(pos.coords.longitude.toFixed(6));
          this.form.latitude = lat;
          this.form.longitude = lng;
          this.isDetectingGps.set(false);
          this.gpsMessage.set(`✓ Coordenadas satelitales fijadas: ${lat}, ${lng}`);
          this.updateMapFromInputs();

          try {
            const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}`);
            if (res.ok) {
              const data = await res.json();
              if (data?.display_name && (!this.form.address || this.form.address.trim().length < 5)) {
                this.form.address = data.display_name;
              }
            }
          } catch {}

          setTimeout(() => this.gpsMessage.set(null), 5000);
        },
        () => {
          this.isDetectingGps.set(false);
          this.gpsMessage.set('No se pudo obtener el GPS automáticamente. Ingresa las coordenadas manualmente.');
        },
        { enableHighAccuracy: true, timeout: 8000 }
      );
    }
  }

  private branchModalMap?: L.Map;
  private branchModalMarker?: L.Marker;

  initBranchModalMap(retryCount = 0): void {
    const container = document.getElementById('branch-modal-location-map');
    if (!container) {
      if (retryCount < 8) {
        setTimeout(() => this.initBranchModalMap(retryCount + 1), 100);
      }
      return;
    }

    if (this.branchModalMap) {
      try { this.branchModalMap.remove(); } catch (_) {}
      this.branchModalMap = undefined;
      this.branchModalMarker = undefined;
    }

    if ((container as any)._leaflet_id) {
      delete (container as any)._leaflet_id;
    }

    const lat = Number(this.form.latitude) || 10.06777;
    const lng = Number(this.form.longitude) || -69.34735;

    this.branchModalMap = L.map(container, {
      zoomControl: true,
      attributionControl: false
    }).setView([lat, lng], 15);

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap'
    }).addTo(this.branchModalMap);

    const storeIcon = L.divIcon({
      className: 'leaflet-branch-marker',
      html: `
        <div style="background:#f97316;color:white;width:38px;height:38px;border-radius:12px;display:flex;align-items:center;justify-content:center;box-shadow:0 6px 14px rgba(0,0,0,0.3);border:2.5px solid white;cursor:grab;">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="m2 7 4.41-4.41A2 2 0 0 1 7.83 2h8.34a2 2 0 0 1 1.42.59L22 7"/><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><path d="M15 22v-4a2 2 0 0 0-2-2h-2a2 2 0 0 0-2 2v4"/><path d="M2 7h20"/></svg>
        </div>
      `,
      iconSize: [38, 38],
      iconAnchor: [19, 19]
    });

    this.branchModalMarker = L.marker([lat, lng], {
      icon: storeIcon,
      draggable: true
    }).addTo(this.branchModalMap);

    this.branchModalMarker.on('dragend', (e: any) => {
      const pos = e.target.getLatLng();
      this.form.latitude = Number(pos.lat.toFixed(6));
      this.form.longitude = Number(pos.lng.toFixed(6));
    });

    this.branchModalMap.on('click', (e: any) => {
      const cLat = Number(e.latlng.lat.toFixed(6));
      const cLng = Number(e.latlng.lng.toFixed(6));
      this.form.latitude = cLat;
      this.form.longitude = cLng;
      this.branchModalMarker?.setLatLng([cLat, cLng]);
      this.branchModalMap?.panTo([cLat, cLng]);
    });

    setTimeout(() => this.branchModalMap?.invalidateSize(), 150);
    setTimeout(() => this.branchModalMap?.invalidateSize(), 350);
  }

  updateMapFromInputs(): void {
    const lat = Number(this.form.latitude);
    const lng = Number(this.form.longitude);
    if (!isNaN(lat) && !isNaN(lng) && lat !== 0 && lng !== 0) {
      if (this.branchModalMarker && this.branchModalMap) {
        this.branchModalMarker.setLatLng([lat, lng]);
        this.branchModalMap.panTo([lat, lng]);
      }
    }
  }

  onSubmit(e: Event): void {
    e.preventDefault();
    if (this.mode === 'create') {
      this.submitCreate();
    } else {
      this.submitEdit();
    }
  }

  private submitCreate(): void {
    if (!this.isMainBranchOrOwner) {
      this.errorMessage.set('Acceso denegado: Una sucursal no puede crear sucursales. Solo la Sede Principal tiene permisos para crear sucursales.');
      return;
    }
    if (!this.form.name.trim()) {
      this.errorMessage.set('El nombre de la sucursal es obligatorio.');
      return;
    }
    if (!this.form.address.trim()) {
      this.errorMessage.set('La dirección física de la sucursal es obligatoria.');
      return;
    }
    if (!this.form.managerEmail.trim()) {
      this.errorMessage.set('El correo de acceso exclusivo para la sucursal es obligatorio.');
      return;
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(this.form.managerEmail.trim())) {
      this.errorMessage.set('El formato del correo de acceso no es válido.');
      return;
    }
    if (!this.form.managerPassword.trim() || this.form.managerPassword.trim().length < 4) {
      this.errorMessage.set('La contraseña de acceso para la sucursal debe tener al menos 4 caracteres.');
      return;
    }

    const payload: any = {
      companyId: this.tenantId,
      companyName: this.tenantName,
      name: this.form.name.trim(),
      slug: this.form.name.trim().toLowerCase().replace(/\s+/g, '-'),
      address: this.form.address.trim(),
      phone: this.form.phone,
      whatsapp: this.form.whatsapp,
      latitude: Number(this.form.latitude),
      longitude: Number(this.form.longitude),
      deliveryRadiusKm: Number(this.form.deliveryRadiusKm),
      baseDeliveryFee: Number(this.form.baseDeliveryFee),
      openTime: this.form.openTime,
      closeTime: this.form.closeTime,
      managerEmail: this.form.managerEmail.trim().toLowerCase(),
      managerPassword: this.form.managerPassword.trim(),
      managerName: this.form.managerName.trim() || `Encargado ${this.form.name.trim()}`,
      creatorRole: this.creatorRole,
      creatorBranchId: this.creatorBranchId,
      paymentCredentials: {
        pagoMovilBank: this.form.pagoMovilBank,
        pagoMovilPhone: this.form.pagoMovilPhone,
        pagoMovilIdNumber: this.form.pagoMovilIdNumber,
        pagoMovilAccountName: this.form.pagoMovilAccountName,
        zelleEmail: this.form.zelleEmail,
        zelleAccountName: this.form.zelleAccountName,
        isActive: true
      }
    };

    this.isSaving.set(true);
    this.api.createBranch(payload).subscribe({
      next: (res) => {
        this.isSaving.set(false);
        if (res.success) {
          this.branchSaved.emit();
          this.close.emit();
        } else {
          this.errorMessage.set(res.message || 'Error al registrar la sucursal.');
        }
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || err?.message || 'Error en el servidor al registrar la sucursal.');
      }
    });
  }

  private submitEdit(): void {
    if (!this.form.name.trim()) {
      this.errorMessage.set('El nombre de la sucursal es obligatorio.');
      return;
    }
    if (!this.form.address.trim()) {
      this.errorMessage.set('La dirección física de la sucursal es obligatoria.');
      return;
    }

    const branchId = this.form.id;
    const payload: any = {
      name: this.form.name.trim(),
      address: this.form.address.trim(),
      phone: this.form.phone,
      whatsapp: this.form.whatsapp,
      latitude: Number(this.form.latitude),
      longitude: Number(this.form.longitude),
      deliveryRadiusKm: Number(this.form.deliveryRadiusKm),
      baseDeliveryFee: Number(this.form.baseDeliveryFee),
      openTime: this.form.openTime,
      closeTime: this.form.closeTime,
      managerEmail: this.form.managerEmail?.trim()?.toLowerCase() || undefined,
      managerPassword: this.form.managerPassword?.trim() || undefined,
      managerName: this.form.managerName?.trim() || undefined,
      paymentCredentials: {
        pagoMovilBank: this.form.pagoMovilBank,
        pagoMovilPhone: this.form.pagoMovilPhone,
        pagoMovilIdNumber: this.form.pagoMovilIdNumber,
        pagoMovilAccountName: this.form.pagoMovilAccountName,
        zelleEmail: this.form.zelleEmail,
        zelleAccountName: this.form.zelleAccountName,
        isActive: true
      }
    };

    this.isSaving.set(true);
    this.api.updateBranch(branchId, payload).subscribe({
      next: () => {
        this.isSaving.set(false);
        this.branchSaved.emit();
        this.close.emit();
      },
      error: (err) => {
        this.isSaving.set(false);
        this.errorMessage.set(err?.error?.message || err?.message || 'Error al actualizar la sucursal.');
      }
    });
  }
}
