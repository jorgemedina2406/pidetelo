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
  templateUrl: './branch-form-modal.component.html'
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
