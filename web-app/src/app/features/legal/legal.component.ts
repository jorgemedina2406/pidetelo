import { Component, OnInit, inject, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { HttpClient } from '@angular/common/http';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { firstValueFrom } from 'rxjs';
import { ThemeService } from '../../core/services/theme.service';
import { IconComponent } from '../../shared/components/icon.component';
import { environment } from '../../../environments/environment';

export type LegalTab = 'terminos' | 'privacidad' | 'cookies' | 'reclamaciones' | 'eliminar-cuenta';

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

          <button (click)="setTab('eliminar-cuenta')"
                  [class.border-red-500]="activeTab() === 'eliminar-cuenta'"
                  [class.text-red-600]="activeTab() === 'eliminar-cuenta'"
                  [class.dark:text-red-400]="activeTab() === 'eliminar-cuenta'"
                  [class.bg-red-50]="activeTab() === 'eliminar-cuenta'"
                  [class.dark:bg-red-950/40]="activeTab() === 'eliminar-cuenta'"
                  [class.border-transparent]="activeTab() !== 'eliminar-cuenta'"
                  [class.text-slate-600]="activeTab() !== 'eliminar-cuenta'"
                  [class.dark:text-slate-400]="activeTab() !== 'eliminar-cuenta'"
                  class="px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold border-2 transition-all flex items-center gap-2 flex-shrink-0 cursor-pointer">
            <span>🗑️</span>
            <span>Eliminar Cuenta</span>
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
                <span class="text-xs font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-widest">Protección de Datos & Geolocalización</span>
                <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">Política de Privacidad y Tratamiento de Datos</h1>
                <p class="text-xs text-slate-400 mt-1">Compromiso de Confidencialidad y Transparencia GPS • Pídetelo.app (Actualizado Noviembre 2026)</p>
              </div>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  1. Información que Recopilamos
                </h2>
                <p>
                  Para procesar tus solicitudes de delivery, conectar de manera eficiente a clientes, comercios y repartidores, y asegurar un servicio transparente, recopilamos las siguientes categorías de datos:
                </p>
                <ul class="list-disc list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-400">
                  <li><strong>Datos de Identificación y Contacto:</strong> Nombre, apellido, número de teléfono móvil / WhatsApp, correo electrónico y documento de identidad (C.I. / RIF).</li>
                  <li><strong>Datos de Entrega:</strong> Dirección domiciliaria o comercial, puntos de referencia e instrucciones especiales de entrega.</li>
                  <li><strong>Datos de Repartidores (Riders):</strong> Fotografías de documento oficial de identidad, fotografía facial biométrica (selfie en vivo para prevención de suplantación), datos del vehículo (placa, marca, modelo) y credenciales de cobro.</li>
                  <li><strong>Datos Transaccionales:</strong> Historial de pedidos realizados, comprobantes de pago / transferencias de Pago Móvil y valoraciones de servicio.</li>
                </ul>
              </section>

              <!-- CLÁUSULA EXPLICITA DE UBICACIÓN Y RASTREO CONTINUO (REQUISITO GOOGLE PLAY / APP STORE) -->
              <section class="space-y-4 text-xs sm:text-sm bg-amber-500/5 dark:bg-amber-500/10 border border-amber-500/20 rounded-2xl p-5">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-amber-500"></span>
                  2. Permisos de Ubicación y Rastreo Continuo en Segundo Plano (GPS)
                </h2>
                
                <p class="leading-relaxed">
                  El funcionamiento de una plataforma de entregas a domicilio depende de la precisión geográfica para calcular distancias, garantizar la frescura de los alimentos y optimizar los tiempos de despacho. A continuación se detalla cómo gestionamos la ubicación según el rol:
                </p>

                <div class="space-y-3 pt-2">
                  <div class="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <h3 class="font-black text-slate-900 dark:text-white flex items-center gap-2">
                      📍 Para Clientes (App Móvil y Plataforma Web)
                    </h3>
                    <p class="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                      La app solicita acceso a la <strong>ubicación precisa en primer plano</strong> (únicamente mientras utilizas la aplicación) con el objetivo de fijar el punto exacto de entrega en el mapa, comprobar que te encuentras dentro del radio de cobertura del comercio, calcular automáticamente el costo de envío por kilómetro y mostrar al repartidor la ruta más rápida hacia tu dirección.
                    </p>
                  </div>

                  <div class="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <h3 class="font-black text-slate-900 dark:text-white flex items-center gap-2">
                      🛵 Para Repartidores (Pídetelo Rider) — Rastreo Continuo en Segundo Plano
                    </h3>
                    <p class="text-slate-600 dark:text-slate-400 text-xs leading-relaxed">
                      <strong>Declaración Prominente:</strong> La aplicación <em>Pídetelo Rider</em> recopila y transmite datos de ubicación geográfica precisa de manera continua, <strong>incluso cuando la aplicación está cerrada o no está en pantalla (segundo plano)</strong>, con las siguientes finalidades críticas:
                    </p>
                    <ul class="list-disc list-inside space-y-1 pl-2 text-slate-600 dark:text-slate-400 text-xs">
                      <li><strong>Seguimiento en Vivo del Pedido:</strong> Permitir al cliente y al comercio monitorear en tiempo real la trayectoria del repartidor en el mapa interactivo durante la entrega.</li>
                      <li><strong>Asignación Eficiente de Despachos:</strong> Asignar pedidos de forma inteligente a los repartidores que se encuentren más cercanos físicamente al comercio emisor.</li>
                      <li><strong>Cálculo Exacto de Tarifas por Kilómetro:</strong> Registrar la distancia real recorrida para la liquidación precisa de fletes y pagos al repartidor.</li>
                      <li><strong>Seguridad Operativa y Auditoría:</strong> Verificar la entrega efectiva del paquete en el destino pactado y prevenir desvíos o incidencias.</li>
                    </ul>
                    <p class="text-[11px] text-amber-700 dark:text-amber-300 font-semibold mt-2 pt-2 border-t border-slate-100 dark:border-slate-800">
                      ℹ️ El rastreo en segundo plano se ejecuta mediante un servicio permanente del sistema con notificación visible en la barra de estado y <strong>se detiene de manera inmediata e irrevocable en cuanto el repartidor pulsa "Desconectarse" o finaliza su turno activo</strong>.
                    </p>
                  </div>
                </div>

                <div class="text-xs text-slate-500 dark:text-slate-400 pt-1">
                  <strong>Control de Permisos por el Usuario:</strong> Puedes revocar o modificar los permisos de ubicación en cualquier momento desde los ajustes de privacidad de tu dispositivo Android o iOS. Toma en cuenta que para los repartidores, revocar la ubicación impedirá recibir pedidos y prestar servicios en la plataforma.
                </div>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  3. Uso y No Divulgación de la Información
                </h2>
                <p>
                  Tus datos se utilizan con el único fin de procesar la orden, coordinar el despacho con el comercio y el repartidor, calcular las tarifas de envío, enviar confirmaciones de estado y ofrecer soporte postventa.
                </p>
                <div class="p-3 bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50 rounded-xl text-emerald-800 dark:text-emerald-300 font-bold text-xs">
                  🛡️ Compromiso Inquebrantable: Pídetelo jamás vende, comercializa, alquila ni comparte tus datos personales o de ubicación con agencias de publicidad o terceros para fines comerciales externos.
                </div>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  4. Seguridad y Cifrado de Datos
                </h2>
                <p>
                  Implementamos altos estándares de seguridad en la nube: todas las comunicaciones y transmisiones de telemetría GPS viajan encriptadas mediante protocolos seguros HTTPS/TLS con cifrado en reposo en bases de datos con control de acceso restringido.
                </p>
              </section>

              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-emerald-500"></span>
                  5. Derechos ARCO, Retención y Eliminación de Cuenta
                </h2>
                <p>
                  Tienes derecho de acceder, rectificar o solicitar la eliminación total de tus datos personales en cualquier momento. Puedes eliminar tu cuenta de forma inmediata directamente desde la app móvil en <strong>Perfil → Eliminar Cuenta</strong> o desde nuestro portal web dedicado de eliminación de cuenta:
                </p>
                <div class="p-3.5 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-xs space-y-2">
                  <div><strong>Eliminación Inmediata en Línea:</strong> <button type="button" (click)="setTab('eliminar-cuenta')" class="text-brand-600 dark:text-brand-400 font-bold underline cursor-pointer">https://pidetelo.app/legal/eliminar-cuenta</button></div>
                  <div><strong>Correo de Privacidad:</strong> <a href="mailto:pideteloadomicilio@gmail.com" class="text-brand-600 dark:text-brand-400 font-bold underline">pideteloadomicilio&#64;gmail.com</a></div>
                  <div><strong>Tiempo de Respuesta:</strong> Inmediato en la app o formulario web; menor a 48 horas hábiles para solicitudes manuales.</div>
                </div>
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

          <!-- 5. ELIMINACIÓN DE CUENTA Y DATOS (REQUISITO GOOGLE PLAY) -->
          @if (activeTab() === 'eliminar-cuenta') {
            <div class="space-y-6 animate-fade-in">
              <div class="border-b border-slate-100 dark:border-slate-800 pb-4">
                <span class="text-xs font-bold text-red-600 dark:text-red-400 uppercase tracking-widest">Control de Privacidad & Google Play</span>
                <h1 class="text-2xl sm:text-3xl font-black text-slate-900 dark:text-white mt-1">Eliminación de Cuenta y Datos Personales</h1>
                <p class="text-xs text-slate-400 mt-1">
                  Aplicaciones: <strong>Pídetelo</strong> (<code>com.pidetelo.customer</code>), <strong>Pídetelo Repartidor</strong> (<code>com.pidetelo.rider</code>) & Web Oficial <strong>pidetelo.app</strong> • Desarrollador: <strong>Pídetelo Express C.A.</strong>
                </p>
              </div>

              <!-- 1. Pasos desde la App -->
              <section class="space-y-3 text-xs sm:text-sm">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-red-500"></span>
                  1. Cómo eliminar tu cuenta desde la App Móvil (Inmediato)
                </h2>
                <p>Si tienes instalada la aplicación <strong>Pídetelo</strong> (Clientes) o <strong>Pídetelo Repartidor</strong> (Riders) en tu teléfono Android o iOS, puedes borrar tu cuenta al instante siguiendo estos pasos:</p>
                <ol class="list-decimal list-inside space-y-1.5 pl-2 text-slate-600 dark:text-slate-300">
                  <li>Abre la app <strong>Pídetelo</strong> o <strong>Pídetelo Repartidor</strong> con tu sesión iniciada.</li>
                  <li>En la barra inferior, entra a la pestaña <strong>Perfil</strong>.</li>
                  <li>Desplázate hasta la parte inferior y toca el botón <strong>Eliminar Cuenta</strong>.</li>
                  <li>Confirma tocando <strong>«Sí, Eliminar Cuenta»</strong>. Tu cuenta y datos personales se eliminarán de inmediato.</li>
                </ol>
              </section>

              <!-- 2. Transparencia de datos -->
              <section class="space-y-3 text-xs sm:text-sm bg-slate-50 dark:bg-slate-850 border border-slate-200 dark:border-slate-800 rounded-2xl p-5">
                <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <span class="w-2 h-2 rounded-full bg-brand-500"></span>
                  2. ¿Qué datos se eliminan y cuáles se conservan?
                </h2>
                <div class="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div class="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-emerald-500/30 space-y-2">
                    <h3 class="font-black text-emerald-700 dark:text-emerald-400 text-xs uppercase tracking-wider">✅ Se eliminan permanentemente</h3>
                    <ul class="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li>Cuenta y credenciales de acceso (Auth).</li>
                      <li>Nombre completo, correo, teléfono y foto de perfil.</li>
                      <li>Direcciones de entrega y coordenadas guardadas.</li>
                      <li>Comercios favoritos, carrito y preferencias.</li>
                      <li>Tokens de notificaciones push (Firebase FCM).</li>
                    </ul>
                  </div>
                  <div class="p-3.5 bg-white dark:bg-slate-900 rounded-xl border border-amber-500/30 space-y-2">
                    <h3 class="font-black text-amber-700 dark:text-amber-400 text-xs uppercase tracking-wider">⚖️ Qué se conserva por obligación legal</h3>
                    <ul class="list-disc list-inside space-y-1 text-xs text-slate-600 dark:text-slate-400">
                      <li>Registros contables y fiscales mínimos de pedidos ya completados con comercios aliados (números de orden, montos y referencias bancarias exigidas por normativa tributaria y prevención de fraude).</li>
                      <li>Estos registros no se usan con fines comerciales ni permiten reactivar la cuenta.</li>
                    </ul>
                    <p class="text-[11px] text-slate-500 dark:text-slate-400 pt-1">
                      <strong>Plazo de borrado:</strong> Inmediato al confirmar en la app o en el formulario web; máximo 48 horas hábiles para solicitudes manuales.
                    </p>
                  </div>
                </div>
              </section>

              <!-- 3. Formulario Eliminación Inmediata con Correo + Contraseña -->
              <section class="space-y-4 text-xs sm:text-sm border border-red-200 dark:border-red-900/50 bg-red-50/40 dark:bg-red-950/10 rounded-2xl p-5">
                <div>
                  <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-red-500"></span>
                    3. Eliminar cuenta inmediatamente desde la web
                  </h2>
                  <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Si ya desinstalaste la app, ingresa el correo y la contraseña de tu cuenta de Pídetelo para verificar tu identidad y eliminarla al instante.
                  </p>
                </div>

                @if (instantDeleteResult(); as res) {
                  <div [class]="res.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'"
                       class="p-4 rounded-xl border text-xs font-semibold">
                    {{ res.message }}
                  </div>
                }

                <form (submit)="submitInstantAccountDeletion($event)" class="space-y-3">
                  <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Correo de la Cuenta *</label>
                      <input type="email" [(ngModel)]="instantDeleteForm.email" name="instantDeleteEmail" required placeholder="tu-correo@gmail.com"
                             class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                    <div>
                      <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Contraseña *</label>
                      <input type="password" [(ngModel)]="instantDeleteForm.password" name="instantDeletePassword" required placeholder="Tu contraseña actual"
                             class="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-red-500" />
                    </div>
                  </div>

                  <label class="flex items-start gap-2.5 text-xs text-slate-600 dark:text-slate-300 cursor-pointer select-none pt-1">
                    <input type="checkbox" [(ngModel)]="instantDeleteForm.confirmed" name="instantDeleteConfirmed" required
                           class="mt-0.5 rounded border-slate-300 text-red-600 focus:ring-red-500" />
                    <span>Entiendo que esta acción es permanente e irreversible y eliminará mi perfil, direcciones guardadas y favoritos en Pídetelo.</span>
                  </label>

                  <button type="submit"
                          [disabled]="isInstantDeleting() || !instantDeleteForm.confirmed"
                          class="px-5 py-2.5 rounded-xl bg-red-600 hover:bg-red-700 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all cursor-pointer">
                    {{ isInstantDeleting() ? 'Eliminando cuenta...' : 'Eliminar Cuenta Permanentemente' }}
                  </button>
                </form>
              </section>

              <!-- 4. Solicitud Manual (cuentas Google OAuth o sin contraseña) -->
              <section class="space-y-4 text-xs sm:text-sm border border-slate-200 dark:border-slate-800 rounded-2xl p-5 bg-white dark:bg-slate-900">
                <div>
                  <h2 class="text-base sm:text-lg font-bold text-slate-900 dark:text-white flex items-center gap-2">
                    <span class="w-2 h-2 rounded-full bg-sky-500"></span>
                    4. ¿Iniciaste sesión con Google o no recuerdas tu contraseña?
                  </h2>
                  <p class="text-xs text-slate-600 dark:text-slate-400 mt-1">
                    Registra una solicitud de eliminación manual con tu correo asociado. Procesaremos el borrado definitivo en menos de 48 horas hábiles.
                  </p>
                </div>

                @if (manualDeleteResult(); as mRes) {
                  <div [class]="mRes.success ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-800 dark:text-emerald-300' : 'bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-300'"
                       class="p-4 rounded-xl border text-xs font-semibold space-y-1">
                    <div>{{ mRes.message }}</div>
                    @if (mRes.requestId) {
                      <div class="font-mono text-[11px] opacity-85">Código de solicitud: {{ mRes.requestId }}</div>
                    }
                  </div>
                }

                <form (submit)="submitManualAccountDeletion($event)" class="space-y-3">
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Correo electrónico registrado *</label>
                    <input type="email" [(ngModel)]="manualDeleteForm.email" name="manualDeleteEmail" required placeholder="tu-correo@gmail.com"
                           class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500" />
                  </div>
                  <div>
                    <label class="block text-xs font-bold text-slate-700 dark:text-slate-300 mb-1">Motivo o comentario (Opcional)</label>
                    <textarea rows="2" [(ngModel)]="manualDeleteForm.reason" name="manualDeleteReason" placeholder="Ej: Cuenta vinculada con Google, deseo eliminar mis datos..."
                              class="w-full bg-slate-50 dark:bg-slate-950 border border-slate-300 dark:border-slate-700 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-brand-500"></textarea>
                  </div>
                  <button type="submit"
                          [disabled]="isSubmittingManualDelete()"
                          class="px-5 py-2.5 rounded-xl bg-slate-900 dark:bg-brand-500 hover:opacity-90 disabled:opacity-50 text-white font-bold text-xs shadow-sm transition-all cursor-pointer">
                    {{ isSubmittingManualDelete() ? 'Registrando solicitud...' : 'Solicitar Eliminación Manual' }}
                  </button>
                </form>
              </section>
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
  private readonly http = inject(HttpClient);

  readonly activeTab = signal<LegalTab>('terminos');
  readonly isSubmittingReclamo = signal<boolean>(false);
  readonly isReclamoSubmitted = signal<boolean>(false);

  readonly isInstantDeleting = signal<boolean>(false);
  readonly instantDeleteResult = signal<{ success: boolean; message: string } | null>(null);
  instantDeleteForm = {
    email: '',
    password: '',
    confirmed: false
  };

  readonly isSubmittingManualDelete = signal<boolean>(false);
  readonly manualDeleteResult = signal<{ success: boolean; message: string; requestId?: string } | null>(null);
  manualDeleteForm = {
    email: '',
    reason: ''
  };

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
      if (doc && ['terminos', 'privacidad', 'cookies', 'reclamaciones', 'eliminar-cuenta'].includes(doc)) {
        this.activeTab.set(doc);
      }
    });

    this.route.queryParamMap.subscribe(params => {
      const tab = params.get('tab') as LegalTab;
      if (tab && ['terminos', 'privacidad', 'cookies', 'reclamaciones', 'eliminar-cuenta'].includes(tab)) {
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

  async submitInstantAccountDeletion(e: Event): Promise<void> {
    e.preventDefault();
    if (!this.instantDeleteForm.confirmed) return;
    this.isInstantDeleting.set(true);
    this.instantDeleteResult.set(null);

    try {
      const apiBase = environment.apiUrl || 'https://api.pidetelo.app/api';
      const res: any = await firstValueFrom(
        this.http.post(`${apiBase}/auth/delete-account`, {
          email: this.instantDeleteForm.email.trim(),
          password: this.instantDeleteForm.password
        })
      );
      this.instantDeleteResult.set({
        success: true,
        message: res?.message || 'Tu cuenta y todos tus datos personales han sido eliminados permanentemente.'
      });
      this.instantDeleteForm = { email: '', password: '', confirmed: false };
    } catch (err: any) {
      const msg =
        err?.error?.message ||
        'No se pudo eliminar la cuenta. Verifica tu correo y contraseña o utiliza la solicitud manual.';
      this.instantDeleteResult.set({
        success: false,
        message: Array.isArray(msg) ? msg.join(', ') : String(msg)
      });
    } finally {
      this.isInstantDeleting.set(false);
    }
  }

  async submitManualAccountDeletion(e: Event): Promise<void> {
    e.preventDefault();
    this.isSubmittingManualDelete.set(true);
    this.manualDeleteResult.set(null);

    const email = this.manualDeleteForm.email.trim();
    const reason = this.manualDeleteForm.reason.trim();

    try {
      const apiBase = environment.apiUrl || 'https://api.pidetelo.app/api';
      const res: any = await firstValueFrom(
        this.http.post(`${apiBase}/auth/request-account-deletion`, { email, reason })
      );

      // Copia informativa al correo oficial de soporte
      try {
        await fetch('https://formsubmit.co/ajax/pideteloadomicilio@gmail.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify({
            _subject: `🗑️ Solicitud Eliminación de Cuenta: ${email}`,
            _template: 'table',
            _captcha: 'false',
            _replyto: email,
            'Código Solicitud': res?.requestId || 'N/A',
            'Correo Cuenta': email,
            'Motivo': reason || 'No especificado',
            'Fecha': new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' }),
            'Plataforma': 'pidetelo.app'
          })
        });
      } catch (_) {}

      this.manualDeleteResult.set({
        success: true,
        requestId: res?.requestId,
        message:
          res?.message ||
          'Solicitud registrada correctamente. Procesaremos la eliminación definitiva de tu cuenta en menos de 48 horas hábiles.'
      });
      this.manualDeleteForm = { email: '', reason: '' };
    } catch (err: any) {
      const msg = err?.error?.message || 'No se pudo registrar la solicitud. Verifica el correo ingresado.';
      this.manualDeleteResult.set({
        success: false,
        message: Array.isArray(msg) ? msg.join(', ') : String(msg)
      });
    } finally {
      this.isSubmittingManualDelete.set(false);
    }
  }
}

