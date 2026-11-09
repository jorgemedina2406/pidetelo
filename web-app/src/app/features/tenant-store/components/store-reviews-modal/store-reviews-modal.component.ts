import { Component, EventEmitter, Input, OnChanges, Output, SimpleChanges, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ApiService } from '../../../../core/services/api.service';
import { Tenant } from '../../../../core/models/tenant.model';

@Component({
  selector: 'app-store-reviews-modal',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './store-reviews-modal.component.html',
  styles: [`
    @keyframes fadeIn {
      from { opacity: 0; transform: scale(0.97); }
      to { opacity: 1; transform: scale(1); }
    }
    .animate-modal-in {
      animation: fadeIn 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
    }
  `]
})
export class StoreReviewsModalComponent implements OnChanges {
  private readonly api = inject(ApiService);

  @Input() store!: Tenant;
  @Input() isOpen = false;
  @Output() close = new EventEmitter<void>();
  @Output() ratingUpdated = new EventEmitter<{ rating: number; reviewCount: number }>();

  readonly reviews = signal<any[]>([]);
  readonly isLoading = signal<boolean>(false);
  readonly isSubmitting = signal<boolean>(false);
  readonly showForm = signal<boolean>(false);

  selectedRating = 5;
  hoveredRating = 0;
  customerName = '';
  customerPhone = '';
  comment = '';

  readonly successMessage = signal<string>('');
  readonly errorMessage = signal<string>('');

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['isOpen'] && this.isOpen && this.store?.id) {
      this.loadReviews();
      this.initFormDefaults();
    }
  }

  private initFormDefaults() {
    this.successMessage.set('');
    this.errorMessage.set('');
    this.showForm.set(false);
    this.selectedRating = 5;
    this.comment = '';

    // Intentar obtener nombre de usuario previo en localStorage
    try {
      const savedUser = localStorage.getItem('pidetelo_guest_info') || localStorage.getItem('pidetelo_customer_user');
      if (savedUser) {
        const parsed = JSON.parse(savedUser);
        if (parsed.name) this.customerName = parsed.name;
        if (parsed.phone) this.customerPhone = parsed.phone;
      }
    } catch (_) {}
  }

  loadReviews() {
    if (!this.store?.id) return;
    this.isLoading.set(true);
    this.api.getTenantReviews(this.store.id).subscribe({
      next: (list) => {
        this.reviews.set(list || []);
        this.isLoading.set(false);
      },
      error: () => {
        this.isLoading.set(false);
      }
    });
  }

  setRating(rating: number) {
    this.selectedRating = rating;
  }

  setHover(rating: number) {
    this.hoveredRating = rating;
  }

  getStarLabel(rating: number): string {
    switch (rating) {
      case 1: return '1 - Muy mala experiencia';
      case 2: return '2 - Regular, puede mejorar';
      case 3: return '3 - Buena experiencia';
      case 4: return '4 - Muy buena calidad';
      case 5: return '5 - ¡Excelente, totalmente recomendado!';
      default: return '';
    }
  }

  getRatingDistribution(star: number): number {
    const list = this.reviews();
    if (!list.length) return 0;
    const count = list.filter(r => Math.round(Number(r.rating)) === star).length;
    return Math.round((count / list.length) * 100);
  }

  submitReview() {
    if (!this.customerName.trim()) {
      this.errorMessage.set('Por favor ingresa tu nombre para publicar tu valoración.');
      return;
    }

    this.isSubmitting.set(true);
    this.errorMessage.set('');

    const payload = {
      rating: this.selectedRating,
      comment: this.comment.trim(),
      customerName: this.customerName.trim(),
      customerPhone: this.customerPhone.trim()
    };

    this.api.submitTenantReview(this.store.id, payload).subscribe({
      next: (res) => {
        this.isSubmitting.set(false);
        this.successMessage.set('¡Muchas gracias! Tu valoración y comentario han sido registrados con éxito.');

        // Agregar la reseña creada localmente al inicio de la lista
        if (res?.review) {
          this.reviews.update(current => [res.review, ...current]);
        }

        // Emitir evento para actualizar el promedio de estrellas en la cabecera
        if (res?.rating != null && res?.reviewCount != null) {
          this.ratingUpdated.emit({ rating: res.rating, reviewCount: res.reviewCount });
        }

        // Limpiar formulario y ocultarlo después de unos segundos
        setTimeout(() => {
          this.showForm.set(false);
          this.comment = '';
        }, 1500);
      },
      error: (err) => {
        this.isSubmitting.set(false);
        this.errorMessage.set(err?.error?.message || 'Hubo un error guardando tu valoración. Por favor intenta de nuevo.');
      }
    });
  }

  onClose() {
    this.close.emit();
  }
}

