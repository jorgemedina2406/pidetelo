/**
 * Pídetelo Landing Page - Main Interactive Scripts
 * Soporte completo Dark/Light Mode, Precios desde $9, Calculadora ROI desde $1
 * Sin emoticones: 100% Iconos Vectoriales SVG
 */

document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  initMobileMenu();
  initModuleTabs();
  initPricingToggle();
  initRoiCalculator();
  initFaqAccordion();
  initDownloadModal();
  initLegalModal();
  initContactForm();
  initImageLightbox();
  initFloatingWhatsApp();
});

/* ===================================================================
   1. MODO OSCURO / CLARO (Theme Controller con Iconos SVG)
=================================================================== */
function initTheme() {
  const themeToggleBtn = document.getElementById('theme-toggle');
  const themeToggleMobile = document.getElementById('theme-toggle-mobile');
  const sunIcon = document.getElementById('sun-icon');
  const moonIcon = document.getElementById('moon-icon');
  const html = document.documentElement;

  const savedTheme = localStorage.getItem('pidetelo_theme');
  const systemPrefersDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  
  const initialTheme = savedTheme ? savedTheme : (systemPrefersDark ? 'dark' : 'dark');
  applyTheme(initialTheme);

  function applyTheme(theme) {
    if (theme === 'dark') {
      html.classList.add('dark');
      localStorage.setItem('pidetelo_theme', 'dark');
      if (sunIcon) sunIcon.classList.remove('hidden');
      if (moonIcon) moonIcon.classList.add('hidden');
    } else {
      html.classList.remove('dark');
      localStorage.setItem('pidetelo_theme', 'light');
      if (sunIcon) sunIcon.classList.add('hidden');
      if (moonIcon) moonIcon.classList.remove('hidden');
    }
  }

  function toggleTheme() {
    const isDark = html.classList.contains('dark');
    applyTheme(isDark ? 'light' : 'dark');
  }

  if (themeToggleBtn) themeToggleBtn.addEventListener('click', toggleTheme);
  if (themeToggleMobile) themeToggleMobile.addEventListener('click', toggleTheme);
}

/* ===================================================================
   2. MENÚ MÓVIL
=================================================================== */
function initMobileMenu() {
  const toggleBtn = document.getElementById('mobile-menu-btn');
  const menu = document.getElementById('mobile-menu');
  const links = document.querySelectorAll('.mobile-nav-link');

  if (!toggleBtn || !menu) return;

  toggleBtn.addEventListener('click', () => {
    menu.classList.toggle('hidden');
  });

  links.forEach(link => {
    link.addEventListener('click', () => {
      menu.classList.add('hidden');
    });
  });
}

/* ===================================================================
   3. PESTAÑAS DE MÓDULOS DEL ECOSISTEMA
=================================================================== */
function initModuleTabs() {
  const tabButtons = document.querySelectorAll('.module-tab-btn');
  const tabPanels = document.querySelectorAll('.module-tab-panel');

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      const targetId = btn.getAttribute('data-target');

      tabButtons.forEach(b => {
        b.classList.remove('bg-brand-500', 'text-white', 'shadow-lg', 'shadow-brand-500/25');
        b.classList.add('text-slate-600', 'dark:text-slate-400', 'hover:text-brand-500', 'dark:hover:text-white', 'bg-slate-100', 'dark:bg-slate-800/50');
      });

      btn.classList.add('bg-brand-500', 'text-white', 'shadow-lg', 'shadow-brand-500/25');
      btn.classList.remove('text-slate-600', 'dark:text-slate-400', 'hover:text-brand-500', 'dark:hover:text-white', 'bg-slate-100', 'dark:bg-slate-800/50');

      tabPanels.forEach(panel => {
        if (panel.id === targetId) {
          panel.classList.remove('hidden');
          panel.classList.add('animate-fade-in');
        } else {
          panel.classList.add('hidden');
          panel.classList.remove('animate-fade-in');
        }
      });
    });
  });
}

/* ===================================================================
   4. SELECTOR DE PRECIOS (Mensual vs Anual con 20% Desc.)
   Plan Emprendedor: $9/mes ($7 anual)
   Plan Pro: $29/mes ($23 anual)
   Plan Franquicia: $79/mes ($63 anual)
=================================================================== */
function initPricingToggle() {
  const toggle = document.getElementById('pricing-toggle');
  if (!toggle) return;

  const priceElements = document.querySelectorAll('.plan-price');
  const periodElements = document.querySelectorAll('.plan-period');

  const prices = {
    monthly: { starter: '9', pro: '29', enterprise: '79' },
    annual: { starter: '7', pro: '23', enterprise: '63' }
  };

  toggle.addEventListener('change', (e) => {
    const isAnnual = e.target.checked;
    const mode = isAnnual ? 'annual' : 'monthly';

    priceElements.forEach(el => {
      const plan = el.getAttribute('data-plan');
      if (prices[mode][plan]) {
        el.textContent = prices[mode][plan];
      }
    });

    periodElements.forEach(el => {
      el.textContent = isAnnual ? '/mes (facturado anual)' : '/mes';
    });
  });
}

/* ===================================================================
   5. CALCULADORA INTERACTIVA DE RETORNO DE INVERSIÓN (ROI)
   Ticket mínimo: 1$ | Pedidos mínimos: 1
=================================================================== */
function initRoiCalculator() {
  const ordersSlider = document.getElementById('roi-orders');
  const ticketSlider = document.getElementById('roi-ticket');
  const ordersVal = document.getElementById('roi-orders-val');
  const ticketVal = document.getElementById('roi-ticket-val');

  const revenueDisplay = document.getElementById('roi-revenue');
  const savingsDisplay = document.getElementById('roi-savings');
  const timeSavedDisplay = document.getElementById('roi-time');

  if (!ordersSlider || !ticketSlider) return;

  function recalculate() {
    const ordersPerDay = Math.max(1, parseInt(ordersSlider.value, 10) || 1);
    const avgTicket = Math.max(1, parseFloat(ticketSlider.value) || 1);

    ordersVal.textContent = ordersPerDay.toString();
    ticketVal.textContent = `$${avgTicket.toFixed(0)}`;

    const monthlyOrders = ordersPerDay * 30;
    const monthlyRevenue = monthlyOrders * avgTicket;

    const estimatedSavings = monthlyRevenue * 0.15;
    const hoursSaved = Math.round((monthlyOrders * 6) / 60);

    if (revenueDisplay) {
      revenueDisplay.textContent = `$${monthlyRevenue.toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    if (savingsDisplay) {
      savingsDisplay.textContent = `$${Math.max(1, estimatedSavings).toLocaleString('en-US', { maximumFractionDigits: 0 })}`;
    }
    if (timeSavedDisplay) {
      timeSavedDisplay.textContent = `${hoursSaved} hrs/mes`;
    }
  }

  ordersSlider.addEventListener('input', recalculate);
  ticketSlider.addEventListener('input', recalculate);
  recalculate();
}

/* ===================================================================
   6. ACORDEÓN DE PREGUNTAS FRECUENTES (FAQ)
=================================================================== */
function initFaqAccordion() {
  const faqItems = document.querySelectorAll('.faq-item');

  faqItems.forEach(item => {
    const header = item.querySelector('.faq-header');
    const content = item.querySelector('.faq-content');
    const icon = item.querySelector('.faq-icon');

    if (!header || !content) return;

    header.addEventListener('click', () => {
      const isOpen = !content.classList.contains('hidden');

      faqItems.forEach(other => {
        const otherContent = other.querySelector('.faq-content');
        const otherIcon = other.querySelector('.faq-icon');
        if (otherContent) otherContent.classList.add('hidden');
        if (otherIcon) otherIcon.style.transform = 'rotate(0deg)';
      });

      if (!isOpen) {
        content.classList.remove('hidden');
        if (icon) icon.style.transform = 'rotate(180deg)';
      } else {
        content.classList.add('hidden');
        if (icon) icon.style.transform = 'rotate(0deg)';
      }
    });
  });
}

/* ===================================================================
   7. MODAL DE DESCARGA DE APLICACIONES
=================================================================== */
function initDownloadModal() {
  const modal = document.getElementById('download-modal');
  const openButtons = document.querySelectorAll('.open-download-modal');
  const closeButtons = document.querySelectorAll('.close-download-modal');

  if (!modal) return;

  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    });
  });

  closeButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    });
  });

  modal.addEventListener('click', (e) => {
    if (e.target === modal) {
      modal.classList.add('hidden');
      modal.classList.remove('flex');
    }
  });
}

/* ===================================================================
   8. FORMULARIO DE CONTACTO & SOLICITUD DE DEMO (Envío a pideteloadomicilio@gmail.com)
=================================================================== */
function initContactForm() {
  const form = document.getElementById('contact-form');
  const alertSuccess = document.getElementById('contact-success');
  const submitBtn = document.getElementById('contact-submit-btn');
  const waLink = document.getElementById('contact-wa-link');
  const resetBtn = document.getElementById('contact-reset-btn');

  if (!form) return;

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (alertSuccess) alertSuccess.classList.add('hidden');
      form.classList.remove('hidden');
      form.reset();
    });
  }

  form.addEventListener('submit', async (e) => {
    e.preventDefault();

    const name = document.getElementById('contact-name')?.value.trim() || '';
    const email = document.getElementById('contact-email')?.value.trim() || '';
    const phone = document.getElementById('contact-phone')?.value.trim() || '';
    const store = document.getElementById('contact-store')?.value.trim() || '';
    const city = document.getElementById('contact-city')?.value.trim() || '';
    const message = document.getElementById('contact-message')?.value.trim() || '';

    if (!name || !email || !phone || !store) return;

    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = `
        <span class="inline-block animate-spin mr-2">⏳</span>
        <span>Enviando solicitud a pideteloadomicilio@gmail.com...</span>
      `;
    }

    const payload = {
      _subject: `🚀 Nueva Solicitud de Afiliación: ${store} (${city || 'Venezuela'}) - Pídetelo.app`,
      _template: 'table',
      _captcha: 'false',
      _replyto: email,
      "Nombre y Apellido": name,
      "Correo Electrónico": email,
      "Teléfono / WhatsApp": phone,
      "Comercio o Marca": store,
      "Ciudad / Ubicación": city || 'No especificada',
      "Mensaje o Requerimiento": message || 'Solicitud de información / demo',
      "Plataforma Web": "https://pidetelo.app",
      "Fecha de Solicitud": new Date().toLocaleString('es-VE', { timeZone: 'America/Caracas' })
    };

    const waText = encodeURIComponent(
      `¡Hola equipo Pídetelo! Deseo solicitar información para afiliar mi comercio.\n\n` +
      `*Nombre:* ${name}\n` +
      `*Email:* ${email}\n` +
      `*Comercio:* ${store}\n` +
      `*Ciudad:* ${city}\n` +
      `*Teléfono:* ${phone}\n` +
      `*Detalle:* ${message || 'Solicitud de demo comercial'}`
    );
    const whatsappUrl = `https://wa.me/584120000000?text=${waText}`;
    if (waLink) waLink.href = whatsappUrl;

    try {
      const response = await fetch('https://formsubmit.co/ajax/pideteloadomicilio@gmail.com', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
        },
        body: JSON.stringify(payload)
      });
      console.log('[Landing Contact] FormSubmit status:', response.status);
    } catch (err) {
      console.warn('[Landing Contact] Notice:', err);
    }

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = 'Enviar Solicitud de Afiliación Inmediata';
    }

    form.classList.add('hidden');
    if (alertSuccess) {
      alertSuccess.classList.remove('hidden');
    }
  });
}

/* ===================================================================
   9. LIGHTBOX PARA SCREENSHOTS
=================================================================== */
function initImageLightbox() {
  const lightbox = document.getElementById('image-lightbox');
  const lightboxImg = document.getElementById('lightbox-img');
  const closeBtn = document.getElementById('lightbox-close');
  const zoomableImages = document.querySelectorAll('.zoomable-image');

  if (!lightbox || !lightboxImg) return;

  zoomableImages.forEach(img => {
    img.addEventListener('click', () => {
      lightboxImg.src = img.src;
      lightbox.classList.remove('hidden');
      lightbox.classList.add('flex');
    });
  });

  function close() {
    lightbox.classList.add('hidden');
    lightbox.classList.remove('flex');
  }

  if (closeBtn) closeBtn.addEventListener('click', close);
  lightbox.addEventListener('click', (e) => {
    if (e.target === lightbox) close();
  });
}

/* ===================================================================
   10. BOTÓN FLOTANTE DE WHATSAPP
=================================================================== */
function initFloatingWhatsApp() {
  const btn = document.getElementById('floating-whatsapp');
  if (!btn) return;

  btn.addEventListener('click', (e) => {
    e.preventDefault();
    const msg = encodeURIComponent('¡Hola Pídetelo! Me interesa afiliar mi comercio y conocer la plataforma.');
    window.open(`https://wa.me/584120000000?text=${msg}`, '_blank');
  });
}

/* ===================================================================
   11. MODAL LEGAL COMPLETO (Términos, Privacidad, Cookies, Reclamaciones)
=================================================================== */
function initLegalModal() {
  const modal = document.getElementById('legal-modal');
  const openButtons = document.querySelectorAll('.open-legal-modal');
  const closeButtons = document.querySelectorAll('.close-legal-modal');
  const tabButtons = document.querySelectorAll('.legal-tab-btn');
  const tabPanels = document.querySelectorAll('.legal-tab-panel');

  if (!modal) return;

  function switchTab(tabId) {
    tabButtons.forEach(btn => {
      const active = btn.dataset.tab === tabId;
      btn.classList.toggle('bg-brand-500', active);
      btn.classList.toggle('text-white', active);
      btn.classList.toggle('shadow-md', active);
      btn.classList.toggle('bg-slate-100', !active);
      btn.classList.toggle('dark:bg-slate-800', !active);
      btn.classList.toggle('text-slate-600', !active);
      btn.classList.toggle('dark:text-slate-400', !active);
    });

    tabPanels.forEach(panel => {
      panel.classList.toggle('hidden', panel.id !== `legal-panel-${tabId}`);
    });
  }

  openButtons.forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const tab = btn.dataset.tab || 'terminos';
      switchTab(tab);
      modal.classList.remove('hidden');
      modal.classList.add('flex');
    });
  });

  function closeModal() {
    modal.classList.add('hidden');
    modal.classList.remove('flex');
  }

  closeButtons.forEach(btn => btn.addEventListener('click', closeModal));
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeModal();
  });

  tabButtons.forEach(btn => {
    btn.addEventListener('click', () => {
      switchTab(btn.dataset.tab);
    });
  });

  // Formulario interactivo de reclamaciones
  const claimForm = document.getElementById('claim-form');
  const claimSuccess = document.getElementById('claim-success');
  const claimSubmitBtn = document.getElementById('claim-submit-btn');

  if (claimForm) {
    claimForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      if (claimSubmitBtn) {
        claimSubmitBtn.disabled = true;
        claimSubmitBtn.textContent = 'Enviando reclamación...';
      }

      const claimData = {
        _subject: `⚠️ Nuevo Reclamo Registrado - Pídetelo.app [${new Date().toLocaleDateString('es-VE')}]`,
        _template: 'table',
        _captcha: 'false',
        _replyto: document.getElementById('claim-email')?.value || '',
        "Nombres": document.getElementById('claim-name')?.value || '',
        "Cédula / Documento": document.getElementById('claim-id')?.value || '',
        "Correo": document.getElementById('claim-email')?.value || '',
        "Teléfono": document.getElementById('claim-phone')?.value || '',
        "Comercio Afectado": document.getElementById('claim-store')?.value || '',
        "Nº de Pedido": document.getElementById('claim-order')?.value || 'N/A',
        "Tipo de Caso": document.getElementById('claim-type')?.value || 'Reclamo',
        "Detalle del Hecho": document.getElementById('claim-desc')?.value || '',
        "Petición del Usuario": document.getElementById('claim-request')?.value || '',
        "Destino Oficial": "pideteloadomicilio@gmail.com"
      };

      try {
        await fetch('https://formsubmit.co/ajax/pideteloadomicilio@gmail.com', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
          body: JSON.stringify(claimData)
        });
      } catch (_) {}

      if (claimSubmitBtn) {
        claimSubmitBtn.disabled = false;
        claimSubmitBtn.textContent = 'Registrar Reclamación en Libro';
      }
      claimForm.classList.add('hidden');
      if (claimSuccess) claimSuccess.classList.remove('hidden');
    });
  }
}
