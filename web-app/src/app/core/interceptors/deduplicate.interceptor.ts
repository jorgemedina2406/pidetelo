import { HttpInterceptorFn, HttpRequest, HttpHandlerFn, HttpEvent, HttpResponse } from '@angular/common/http';
import { Observable, of } from 'rxjs';
import { shareReplay, finalize, tap } from 'rxjs/operators';

// Mapa de peticiones GET en curso para compartirlas y evitar llamadas duplicadas simultáneas
const inFlightRequests = new Map<string, Observable<HttpEvent<any>>>();

// Mapa de mutaciones recientes (POST/PUT/DELETE) para evitar duplicados por doble clic
const recentMutations = new Map<string, number>();
const MUTATION_COOLDOWN_MS = 800; // 800ms de protección contra doble clic

export const deduplicateInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
): Observable<HttpEvent<unknown>> => {
  // 1. Manejo de peticiones GET: deduplicación de llamadas simultáneas
  if (req.method === 'GET') {
    const cacheKey = `${req.method}:${req.urlWithParams}`;

    if (inFlightRequests.has(cacheKey)) {
      return inFlightRequests.get(cacheKey)!;
    }

    const request$ = next(req).pipe(
      shareReplay(1),
      finalize(() => {
        inFlightRequests.delete(cacheKey);
      })
    );

    inFlightRequests.set(cacheKey, request$);
    return request$;
  }

  // 2. Manejo de mutaciones (POST, PUT, DELETE, PATCH): bloqueo de clics dobles accidentales
  if (['POST', 'PUT', 'DELETE', 'PATCH'].includes(req.method)) {
    const now = Date.now();
    // Clave única basada en método, URL y payload
    let bodyStr = '';
    try {
      bodyStr = req.body ? JSON.stringify(req.body) : '';
    } catch (_) {}
    const mutationKey = `${req.method}:${req.url}:${bodyStr}`;

    const lastExecuted = recentMutations.get(mutationKey);
    if (lastExecuted && now - lastExecuted < MUTATION_COOLDOWN_MS) {
      console.warn(`[DeduplicateInterceptor] Llamada duplicada evitada a: ${req.url}`);
      // Ignorar la llamada duplicada y retornar observable vacío
      return of(new HttpResponse({ status: 200, body: null }));
    }

    recentMutations.set(mutationKey, now);

    // Limpieza de memoria periódica
    if (recentMutations.size > 200) {
      for (const [k, time] of recentMutations.entries()) {
        if (now - time > 10000) recentMutations.delete(k);
      }
    }
  }

  return next(req);
};
