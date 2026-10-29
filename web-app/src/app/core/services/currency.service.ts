import { Injectable } from '@angular/core';
import { TenantCurrencySettings } from '../models/tenant.model';

export interface FormattedPrice {
  primary: string;
  secondary?: string;
  badge?: string;
  usdAmount: number;
  vesAmount: number;
}

export interface DolarApiResponse {
  moneda: string;
  fuente: 'oficial' | 'paralelo' | string;
  nombre: string;
  compra: number | null;
  venta: number | null;
  promedio: number;
  fechaActualizacion: string;
}

@Injectable({
  providedIn: 'root'
})
export class CurrencyService {
  readonly defaultBcvRate = 879.12; // DolarApi oficial

  /**
   * Fetches official BCV or Parallel exchange rate from https://ve.dolarapi.com
   */
  async fetchDolarApiRate(fuente: 'oficial' | 'paralelo' = 'oficial'): Promise<DolarApiResponse> {
    try {
      const res = await fetch(`https://ve.dolarapi.com/v1/dolares/${fuente}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data: DolarApiResponse = await res.json();
      return data;
    } catch (err) {
      console.warn(`[CurrencyService] Fallback for dolarapi.com/${fuente}:`, err);
      return {
        moneda: 'USD',
        fuente,
        nombre: fuente === 'oficial' ? 'Dólar Oficial (BCV)' : 'Dólar Paralelo',
        compra: null,
        venta: null,
        promedio: this.defaultBcvRate,
        fechaActualizacion: new Date().toISOString()
      };
    }
  }

  /**
   * Fetches all available dollar exchange rates from dolarapi.com
   */
  async fetchAllDolarApiRates(): Promise<DolarApiResponse[]> {
    try {
      const res = await fetch('https://ve.dolarapi.com/v1/dolares');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      console.warn('[CurrencyService] Error fetching all rates from dolarapi.com:', err);
      return [];
    }
  }

  /**
   * Formats a product/item price considering the tenant's currency settings
   * and the base currency of the price.
   */
  formatPrice(
    amount: number,
    itemCurrency: 'USD' | 'VES' = 'USD',
    settings?: TenantCurrencySettings
  ): FormattedPrice {
    const rate = settings?.exchangeRate || this.defaultBcvRate;
    const mode = settings?.displayMode || 'usd_and_bs';

    let usd = 0;
    let ves = 0;

    if (itemCurrency === 'USD') {
      usd = amount;
      ves = amount * rate;
    } else {
      ves = amount;
      usd = rate > 0 ? amount / rate : 0;
    }

    const usdStr = `$${usd.toFixed(2)}`;
    const vesStr = `Bs. ${ves.toLocaleString('es-VE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

    switch (mode) {
      case 'usd_and_bs':
        return {
          primary: usdStr,
          secondary: vesStr,
          badge: `Tasa: ${rate.toFixed(2)} Bs/$`,
          usdAmount: usd,
          vesAmount: ves
        };
      case 'bs_and_usd':
        return {
          primary: vesStr,
          secondary: usdStr,
          badge: `Tasa: ${rate.toFixed(2)} Bs/$`,
          usdAmount: usd,
          vesAmount: ves
        };
      case 'only_usd':
        return {
          primary: usdStr,
          usdAmount: usd,
          vesAmount: ves
        };
      case 'only_bs':
        return {
          primary: vesStr,
          usdAmount: usd,
          vesAmount: ves
        };
      default:
        return {
          primary: usdStr,
          secondary: vesStr,
          usdAmount: usd,
          vesAmount: ves
        };
    }
  }

  /**
   * Converts USD to VES
   */
  toVes(amountUsd: number, exchangeRate: number): number {
    return Number((amountUsd * exchangeRate).toFixed(2));
  }

  /**
   * Converts VES to USD
   */
  toUsd(amountVes: number, exchangeRate: number): number {
    return exchangeRate > 0 ? Number((amountVes / exchangeRate).toFixed(2)) : 0;
  }
}
