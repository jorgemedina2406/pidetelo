import { Injectable, signal } from '@angular/core';

export interface ConfirmOptions {
  title?: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  isDanger?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ConfirmService {
  readonly state = signal<{
    isOpen: boolean;
    options: ConfirmOptions;
    resolve?: (value: boolean) => void;
  }>({
    isOpen: false,
    options: { message: '' }
  });

  confirm(options: ConfirmOptions | string): Promise<boolean> {
    const opts: ConfirmOptions = typeof options === 'string' ? { message: options } : options;
    return new Promise<boolean>((resolve) => {
      this.state.set({
        isOpen: true,
        options: {
          title: opts.title || '¿Estás seguro?',
          message: opts.message,
          confirmText: opts.confirmText || 'Confirmar',
          cancelText: opts.cancelText !== undefined ? opts.cancelText : 'Cancelar',
          isDanger: opts.isDanger !== false
        },
        resolve
      });
    });
  }

  handleAnswer(answer: boolean): void {
    const current = this.state();
    if (current.resolve) {
      current.resolve(answer);
    }
    this.state.set({ isOpen: false, options: { message: '' } });
  }
}

