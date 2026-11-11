import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../../shared/components/icon.component';

export type LegalTab = 'terminos' | 'privacidad' | 'cookies' | 'reclamaciones';

@Component({
  selector: 'app-legal',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule, IconComponent],
  template: `
    <div class="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      
      <!-- Top Navigation -->
      <header class="bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-slate-800 sticky top-0 z-30 shadow-xs">
        <div class="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <a routerLink="/explorar" class="flex items-center gap-2 group cursor-pointer focus:outline-none">
            <img src="assets/logo.png" alt="Pídetelo Express" class="h-9 sm:h-10 w-auto object-contain" />
            <span class="text-[10px] font-black uppercase px-2 py-0.5 rounded-full bg-brand-500/10 text-brand-600 dark:text-brand-400 border border-brand-500/20 tracking-wider">
              LEGAL & TRANSPARENCIA
            </span>
          </a>

          <div class="flex items-center gap-3">
            <button (click)="theme.toggleTheme()" 
                    [title]="theme.isDark() ? 'Modo claro' : 'Modo oscuro'"
                    class="p-2 rounded-lg bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-200 transition-colors cursor-pointer">
              <app-icon [name]="theme.isDark() ? 'sun' : 'moon'" [size]="15" [className]="theme.isDark() ? 'text-amber-400' : 'text-slate-600'"></app-icon>
            </button>

            <a routerLink="/explorar"
               class="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-brand-500 hover:bg-brand-600 text-white font-bold text-xs shadow-xs transition-all active:scale-95">
              <span>← Volver a la Tienda</span>
            </a>
          </div>
        </div>
      </header>

      <!-- Main Container -->
      <main class="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 flex-1 w-full space-y-8">
        
        <!-- Document Navigation Tabs -->
        <div class="flex items-center gap-2 overflow-x-auto pb-2 scrollbar-none border-b border-slate-200 dark:border-slate-800">
          <button (click)="setTab('terminos')"
                  [class.border-brand-500]="activeTab() === 'terminos'"
                  [class.text-brand-600]="activeTab() === 'terminos'"
                  [class.dark:text-brand-400]="activeTab() === 'terminos'"
                  [class.bg-brand-50]="activeTab() === 'terminos'"
                  [class.dark:bg-brand-950/40]="activeTab() === 'terminos'"
                  [class.border-transparent]="activeTab() !== 'terminos'"
                  [class.text-slate-600]="activeTab() !== 'terminos'"
                  [class.dark:text-slate-400]="activeTab() !== 'terminos'"
                  class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer">
            <span>📜</span>
            <span>Términos y Condiciones</span>
          </button>

          <button (click)="setTab('privacidad')"
                  [class.border-brand-500]="activeTab() === 'privacidad'"
                  [class.text-brand-600]="activeTab() === 'privacidad'"
                  [class.dark:text-brand-400]="activeTab() === 'privacidad'"
                  [class.bg-brand-50]="activeTab() === 'privacidad'"
                  [class.dark:bg-brand-950/40]="activeTab() === 'privacidad'"
                  [class.border-transparent]="activeTab() !== 'privacidad'"
                  [class.text-slate-600]="activeTab() !== 'privacidad'"
                  [class.dark:text-slate-400]="activeTab() !== 'privacidad'"
                  class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer">
            <span>🔒</span>
            <span>Política de Privacidad</span>
          </button>

          <button (click)="setTab('cookies')"
                  [class.border-brand-500]="activeTab() === 'cookies'"
                  [class.text-brand-600]="activeTab() === 'cookies'"
                  [class.dark:text-brand-400]="activeTab() === 'cookies'"
                  [class.bg-brand-50]="activeTab() === 'cookies'"
                  [class.dark:bg-brand-950/40]="activeTab() === 'cookies'"
                  [class.border-transparent]="activeTab() !== 'cookies'"
                  [class.text-slate-600]="activeTab() !== 'cookies'"
                  [class.dark:text-slate-400]="activeTab() !== 'cookies'"
                  class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer">
            <span>🍪</span>
            <span>Política de Cookies</span>
          </button>

          <button (click)="setTab('reclamaciones')"
                  [class.border-brand-500]="activeTab() === 'reclamaciones'"
                  [class.text-brand-600]="activeTab() === 'reclamaciones'"
                  [class.dark:text-brand-400]="activeTab() === 'reclamaciones'"
                  [class.bg-brand-50]="activeTab() === 'reclamaciones'"
                  [class.dark:bg-brand-950/40]="activeTab() === 'reclamaciones'"
                  [class.border-transparent]="activeTab() !== 'reclamaciones'"
                  [class.text-slate-600]="activeTab() !== 'reclamaciones'"
                  [class.dark:text-slate-400]="activeTab() !== 'reclamaciones'"
                  class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer">
            <span>📖</span>
            <span>Libro de Reclamaciones</span>
          </button>
        </div>

        <!-- Document Content Container -->
        <div class="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 sm:p-10 shadow-sm leading-relaxed text-slate-700 dark:text-slate-300 space-y-6">
          
          <!-- 1. TÉRMINOS Y CONDICIONES -->
          @if (activeTab() === 'terminos') {
            <div class="space-y-6 animate-fade-in">
              <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
                <span class="text-xs font-bold text-brand-600 dark:text-brand-400 uppercase tracking-widest">Documento Oficial</span>
                <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">Términos y Condiciones de Uso</h1>
                <p class="text-xs text-slate-400 mt-1">Última actualización: Noviembre 2026 • Plataforma Pídetelo.app</p>
              </div>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                  1. Identificación y Aceptación
                </h2>
                <p>
                  Bienvenido a <strong>Pídetelo Express</strong> (en adelante, «Pídetelo.app» o «la Plataforma»). Al acceder a nuestro sitio web, aplicaciones móviles o servicios asociados de mensajería automatizada, el usuario declara haber leído, comprendido y aceptado en su totalidad las presentes Condiciones de Servicio.
                </p>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                  2. Naturaleza del Servicio
                </h2>
                <p>
                  Pídetelo.app opera como una plataforma tecnológica que conecta a comercios aliados (restaurantes, supermercados, farmacias, bodegones) con consumidores finales y repartidores independientes o de flotas propias. Pídetelo.app facilita la exhibición de cartas digitales, cotización de envíos y comunicación directa por WhatsApp o web.
                </p>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                  3. Precios, Divisas y Tasa de Cambio
                </h2>
                <p>
                  Los precios de los productos y tarifas de entrega son fijados de forma autónoma por cada comercio asociado. Los montos se expresan en Dólares Estadounidenses (USD) y Bolívares (VES), calculados con base en la tasa oficial vigente informada por el Banco Central de Venezuela (BCV) o la tasa configurada por el establecimiento.
                </p>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                  4. Horarios y Disponibilidad
                </h2>
                <p>
                  Cada comercio define de forma soberana sus horarios de atención semanales y apertura de cocina/despacho. Pídetelo.app valida en tiempo real si el comercio se encuentra operativo; los pedidos fuera de horario podrán ser programados o confirmados en la siguiente ventana de atención.
                </p>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                  5. Contacto Legal
                </h2>
                <p>
                  Para cualquier requerimiento, notificación o aclaratoria, puedes escribirnos formalmente a 
                  <a href="mailto:pideteloadomicilio@gmail.com" class="text-brand-600 dark:text-brand-400 font-bold underline">pideteloadomicilio@gmail.com</a>.
                </p>
              </section>
            </div>
          }

          <!-- 2. POLÍTICA DE PRIVACIDAD -->
          @if (activeTab() === 'privacidad') {
            <div class="space-y-6 animate-fade-in">
              <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
                <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Protección de Datos</span>
                <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">Política de Privacidad</h1>
                <p class="text-xs text-slate-400 mt-1">Compromiso de Confidencialidad • Pídetelo.app</p>
              </div>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  1. Información que Recopilamos
                </h2>
                <p>
                  Para procesar tus solicitudes de delivery y permitir la comunicación directa con el comercio, recopilamos únicamente los datos necesarios:
                </p>
                <ul class="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
                  <li>Nombre completo y número telefónico / WhatsApp de contacto.</li>
                  <li>Dirección de entrega y coordenadas de geolocalización GPS cuando autorizas el cálculo de distancia.</li>
                  <li>Historial de pedidos y comercios favoritos guardados en tu navegador o app.</li>
                </ul>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  2. Uso de la Información
                </h2>
                <p>
                  Tus datos se utilizan con el único fin de: coordinar el despacho con el comercio y el repartidor, calcular con precisión el costo de envío por kilómetro, enviar confirmaciones y ofrecer soporte al cliente.
                </p>
                <p class="font-bold text-slate-900 dark:text-white">
                  Pídetelo.app no comercializa, no alquila y no comparte tus datos personales con terceros para fines publicitarios externos.
                </p>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  3. Derechos del Titular y Cancelación
                </h2>
                <p>
                  Puedes solicitar la rectificación o eliminación total de tus registros en cualquier momento enviando un correo a 
                  <a href="mailto:pideteloadomicilio@gmail.com" class="text-brand-600 dark:text-brand-400 font-bold underline">pideteloadomicilio@gmail.com</a>.
                </p>
              </section>
            </div>
          }

          <!-- 3. POLÍTICA DE COOKIES -->
          @if (activeTab() === 'cookies') {
            <div class="space-y-6 animate-fade-in">
              <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
                <span class="text-xs font-bold text-amber-500 uppercase tracking-widest">Almacenamiento Local</span>
                <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">Política de Cookies y Almacenamiento Local</h1>
                <p class="text-xs text-slate-400 mt-1">Transparencia de Navegación • Pídetelo.app</p>
              </div>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  1. ¿Qué tecnologías utilizamos?
                </h2>
                <p>
                  En Pídetelo.app empleamos cookies técnicas y almacenamiento local del navegador (<code>localStorage</code>) para optimizar la velocidad y retener tus preferencias entre sesiones sin necesidad de pedirte que inicies sesión cada vez.
                </p>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  2. Cookies y Registros Específicos
                </h2>
                <ul class="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400">
                  <li><strong>Tema (Dark / Light):</strong> Recuerda tu preferencia visual entre modo oscuro y claro.</li>
                  <li><strong>Ubicación de Entrega:</strong> Almacena temporalmente la última zona GPS seleccionada para calcular distancias.</li>
                  <li><strong>Carrito de Compras:</strong> Mantiene los productos seleccionados en tu comercio actual.</li>
                  <li><strong>Favoritos:</strong> Lista local de tiendas marcadas con corazón para acceso rápido.</li>
                </ul>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  3. Control de Cookies
                </h2>
                <p>
                  Puedes vaciar las cookies y la memoria local en cualquier momento desde las opciones de configuración y privacidad de tu navegador web.
                </p>
              </section>
            </div>
          }

          <!-- 4. LIBRO DE RECLAMACIONES -->
          @if (activeTab() === 'reclamaciones') {
            <div class="space-y-6 animate-fade-in">
              <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
                <span class="text-xs font-bold text-blue-600 dark:text-blue-400 uppercase tracking-widest">Atención al Consumidor</span>
                <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">Libro de Reclamaciones Virtual</h1>
                <p class="text-xs text-slate-400 mt-1">Conforme a la normativa de protección al consumidor y comercio electrónico</p>
              </div>

              <div class="p-4 rounded-2xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800 text-xs text-blue-900 dark:text-blue-300">
                Pídetelo Express pone a disposición de todos sus usuarios este canal formal para presentar quejas o reclamos sobre la plataforma o pedidos. Todo reclamo será atendido en un lapso máximo de 15 días hábiles a través de tu correo electrónico.
              </div>

              <!-- Formulario de Reclamación -->
              @if (isReclamoSubmitted()) {
                <div class="p-6 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-center space-y-3">
                  <span class="text-4xl block">✅</span>
                  <h3 class="text-base font-bold text-emerald-700 dark:text-emerald-300">Reclamo Registrado Exitosamente</h3>
                  <p class="text-xs text-slate-600 dark:text-slate-300 max-w-md mx-auto">
                    Hemos registrado tu queja con copia formal a <strong>pideteloadomicilio&#64;gmail.com</strong>. Nuestro equipo de atención te responderá formalmente al correo indicado.
                  </p>
                  <button (click)="isReclamoSubmitted.set(false)" class="text-xs font-bold text-brand-600 dark:text-brand-400 underline cursor-pointer">
                    Presentar otro reclamo
                  </button>
                </div>
              } @else {
                <form (submit)="submitReclamo($event)" class="space-y-4 pt-2">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Nombre Completo *</label>
                      <input type="text" [(ngModel)]="reclamoForm.nombre" name="nombre" required placeholder="Tu nombre y apellido"
                             class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>

                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Cédula o Documento de Identidad *</label>
                      <input type="text" [(ngModel)]="reclamoForm.documento" name="documento" required placeholder="V-12345678"
                             class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Correo Electrónico *</label>
                      <input type="email" [(ngModel)]="reclamoForm.email" name="email" required placeholder="tu-correo@gmail.com"
                             class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>

                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Teléfono / WhatsApp *</label>
                      <input type="tel" [(ngModel)]="reclamoForm.telefono" name="telefono" required placeholder="+58 412 1234567"
                             class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>

                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Tipo de Requerimiento *</label>
                      <select [(ngModel)]="reclamoForm.tipo" name="tipo"
                              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500">
                        <option value="reclamo">Reclamo (Disconformidad con un producto o servicio)</option>
                        <option value="queja">Queja (Malestar respecto a la atención o plataforma)</option>
                      </select>
                    </div>

                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Comercio o Número de Pedido (Opcional)</label>
                      <input type="text" [(ngModel)]="reclamoForm.comercioOPedido" name="comercioOPedido" placeholder="Ej: Burger Lab • Pedido #1234"
                             class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                    </div>
                  </div>

                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Detalle del Reclamo o Queja *</label>
                    <textarea rows="4" [(ngModel)]="reclamoForm.detalle" name="detalle" required placeholder="Describe lo sucedido de manera detallada para poder darte una solución rápida..."
                              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"></textarea>
                  </div>

                  <button type="submit"
                          [disabled]="isSubmittingReclamo()"
                          class="px-6 py-3 rounded-xl bg-brand-500 hover:bg-brand-600 disabled:opacity-50 text-white font-bold text-xs shadow-md transition-all active:scale-95 cursor-pointer">
                    {{ isSubmittingReclamo() ? 'Registrando Reclamo...' : 'Enviar Hoja de Reclamación Virtual' }}
                  </button>
                </form>
              }
            </div>
          }

        </div>

      </main>

      <!-- Legal Footer -->
      <footer class="bg-white dark:bg-slate-900 border-t border-slate-200 dark:border-slate-800 py-6 px-4 text-center text-xs text-slate-400">
        <p>© 2026 Pídetelo Express C.A. • Dominio Oficial: <strong>pidetelo.app</strong></p>
        <p class="text-[11px] text-slate-500 mt-1">Canal Oficial de Atención: <a href="mailto:pideteloadomicilio@gmail.com" class="text-brand-500 underline">pideteloadomicilio&#64;gmail.com</a></p>
      </footer>

    </div>
  `
})
export class LegalComponent implements OnInit {
  readonly theme = inject(ThemeService);
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);

  readonly activeTab = signal<LegalTab>('terminos');
  readonly isSubmittingReclamo = signal<boolean>(false);
  readonly isReclamoSubmitted = signal<boolean>(false);

  reclamoForm = {
    nombre: '',
    documento: '',
    email: '',
    telefono: '',
    tipo: 'reclamo',
    comercioOPedido: '',
    detalle: ''
  };

  ngOnInit(): void {
    this.route.paramMap.subscribe(params => {
      const doc = params.get('doc') as LegalTab;
      if (doc && ['terminos', 'privacidad', 'cookies', 'reclamaciones'].includes(doc)) {
        this.activeTab.set(doc);
      }
    });

    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as LegalTab;
      if (tab && ['terminos', 'privacidad', 'cookies', 'reclamaciones'].includes(tab)) {
        this.activeTab.set(tab);
      }
    });
  }

  setTab(tab: LegalTab): void {
    this.activeTab.set(tab);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  async submitReclamo(e: Event): Promise<void> {
    e.preventDefault();
    this.isSubmittingReclamo.set(true);

    try {
      // Envío formal a pideteloadomicilio@gmail.com
      await fetch('https://formsubmit.co/ajax/pideteloadomicilio@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify({
          _subject: `📖 Libro de Reclamaciones: ${this.reclamoForm.tipo.toUpperCase()} - ${this.reclamoForm.nombre}`,
          _template: 'table',
          _captcha: 'false',
          _replyto: this.reclamoForm.email,
          "Tipo": this.reclamoForm.tipo.toUpperCase(),
          "Cliente": this.reclamoForm.nombre,
          "Cédula / Documento": this.reclamoForm.documento,
          "Correo": this.reclamoForm.email,
          "Teléfono": this.reclamoForm.telefono,
          "Comercio o Pedido": this.reclamoForm.comercioOPedido || 'No especificado',
          "Detalle del Reclamo": this.reclamoForm.detalle,
          "Fecha": new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
          "Plataforma": 'pidetelo.app'
        })
      });
    } catch (_) {}

    this.isSubmittingReclamo.set(false);
    this.isReclamoSubmitted.set(true);
  }
}
