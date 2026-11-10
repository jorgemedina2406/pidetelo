import { Injectable } from '@angular/core';
import { Tenant } from '../models/tenant.model';
import { Product, ProductCategory } from '../models/product.model';
import { Order } from '../models/order.model';
import { Branch, SubscriptionPlan } from '../models/branch.model';

@Injectable({
  providedIn: 'root'
})
export class MockDataService {
  private readonly tenants: Tenant[] = [
    {
      id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      slug: 'burger-lab',
      name: 'Burger Lab Artisanal',
      tagline: 'Hamburguesas smash & cortes premium con pan brioche artesanal',
      description: 'Ingredientes 100% frescos, carnes maduradas y salsas de la casa preparadas diariamente.',
      logoUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=1200&auto=format&fit=crop&q=80',
      rating: 4.9,
      reviewCount: 342,
      category: 'Hamburguesas',
      isActive: true,
      contact: {
        whatsappNumber: '+584129998877',
        phone: '+582121234567',
        instagram: '@burgerlab.artesanal',
        address: 'Av. Principal Las Mercedes, Edif. Gourmet, PB',
        coordinates: { lat: 10.4806, lng: -66.8622 }
      },
      deliverySettings: {
        hasDelivery: true,
        hasPickup: true,
        baseDeliveryFee: 2.50,
        estimatedDeliveryMinMinutes: 30,
        estimatedDeliveryMaxMinutes: 45,
        freeDeliveryThreshold: 25.00,
        minOrderAmount: 8.00,
        currency: 'USD',
        currencySymbol: '$'
      },
      businessHours: {
        open: '12:00',
        close: '23:30',
        isOpenToday: true
      },
      branding: {
        accentColor: '#f97316',
        logoUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=200&auto=format&fit=crop&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=1200&auto=format&fit=crop&q=80'
      },
      currencySettings: {
        baseCurrency: 'USD',
        displayMode: 'usd_and_bs',
        exchangeRate: 45.50,
        lastRateUpdate: new Date().toISOString()
      },
      subscriptionPlanId: 'COMERCIO'
    },
    {
      id: 'tenant-2',
      slug: 'tokyo-sushi',
      name: 'Tokyo Roll & Poke',
      tagline: 'Sushi fresco, ceviches y poke bowls de autor',
      description: 'Pescados seleccionados con la máxima frescura y fusiones contemporáneas.',
      logoUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=1200&auto=format&fit=crop&q=80',
      rating: 4.8,
      reviewCount: 218,
      category: 'Sushi & Asiática',
      isActive: true,
      contact: {
        whatsappNumber: '+584145556677',
        instagram: '@tokyo.roll.poke',
        address: 'C.C. San Ignacio, Nivel Jardín',
        coordinates: { lat: 10.4950, lng: -66.8530 }
      },
      deliverySettings: {
        hasDelivery: true,
        hasPickup: true,
        baseDeliveryFee: 3.00,
        estimatedDeliveryMinMinutes: 40,
        estimatedDeliveryMaxMinutes: 55,
        freeDeliveryThreshold: 35.00,
        minOrderAmount: 12.00,
        currency: 'USD',
        currencySymbol: '$'
      },
      businessHours: {
        open: '13:00',
        close: '23:00',
        isOpenToday: true
      },
      branding: {
        accentColor: '#e11d48',
        logoUrl: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=200&auto=format&fit=crop&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1611143669185-af224c5e3252?w=1200&auto=format&fit=crop&q=80'
      },
      currencySettings: {
        baseCurrency: 'USD',
        displayMode: 'usd_and_bs',
        exchangeRate: 45.50,
        lastRateUpdate: new Date().toISOString()
      }
    },
    {
      id: 'tenant-3',
      slug: 'napoli-pizza',
      name: 'Napoli Forno e Pasta',
      tagline: 'Auténtica pizza napolitana a la leña',
      description: 'Masa fermentada 48 horas, mozzarella fior di latte y tomate San Marzano.',
      logoUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1200&auto=format&fit=crop&q=80',
      rating: 4.7,
      reviewCount: 189,
      category: 'Pizza & Pasta',
      isActive: true,
      contact: {
        whatsappNumber: '+584167778899',
        instagram: '@napoli.forno',
        address: 'Av. Francisco de Miranda, Los Palos Grandes',
        coordinates: { lat: 10.4988, lng: -66.8455 }
      },
      deliverySettings: {
        hasDelivery: true,
        hasPickup: true,
        baseDeliveryFee: 2.00,
        estimatedDeliveryMinMinutes: 25,
        estimatedDeliveryMaxMinutes: 40,
        freeDeliveryThreshold: 30.00,
        minOrderAmount: 10.00,
        currency: 'USD',
        currencySymbol: '$'
      },
      businessHours: {
        open: '12:00',
        close: '22:30',
        isOpenToday: true
      },
      branding: {
        accentColor: '#16a34a',
        logoUrl: 'https://images.unsplash.com/photo-1513104890138-7c749659a591?w=200&auto=format&fit=crop&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1574071318508-1cdbab80d002?w=1200&auto=format&fit=crop&q=80'
      },
      currencySettings: {
        baseCurrency: 'USD',
        displayMode: 'usd_and_bs',
        exchangeRate: 45.50,
        lastRateUpdate: new Date().toISOString()
      }
    },
    {
      id: 'tenant-4',
      slug: 'tacos-chingon',
      name: 'Tacos El Chingón',
      tagline: 'Auténticos tacos al pastor, birria quesatacos y guacamole',
      description: 'Sabor 100% mexicano con tortillas de maíz nixtamalizado hechas al momento y salsas picantes artesanales.',
      logoUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=200&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&auto=format&fit=crop&q=80',
      rating: 4.9,
      reviewCount: 310,
      category: 'Mexicana & Tacos',
      isActive: true,
      contact: {
        whatsappNumber: '+584128889900',
        instagram: '@tacoselchingon.ccs',
        address: 'Calle Madrid, Las Mercedes',
        coordinates: { lat: 10.4830, lng: -66.8610 }
      },
      deliverySettings: {
        hasDelivery: true,
        hasPickup: true,
        baseDeliveryFee: 2.00,
        estimatedDeliveryMinMinutes: 20,
        estimatedDeliveryMaxMinutes: 35,
        freeDeliveryThreshold: 25.00,
        minOrderAmount: 8.00,
        currency: 'USD',
        currencySymbol: '$'
      },
      businessHours: {
        open: '12:00',
        close: '00:00',
        isOpenToday: true
      },
      branding: {
        accentColor: '#ea580c',
        logoUrl: 'https://images.unsplash.com/photo-1551504734-5ee1c4a1479b?w=200&auto=format&fit=crop&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=1200&auto=format&fit=crop&q=80'
      },
      currencySettings: {
        baseCurrency: 'USD',
        displayMode: 'usd_and_bs',
        exchangeRate: 45.50,
        lastRateUpdate: new Date().toISOString()
      }
    },
    {
      id: 'tenant-5',
      slug: 'dulce-tentacion',
      name: 'Dulce Tentación & Waffles',
      tagline: 'Waffles belgas, croissants rellenos, marquesas y café de especialidad',
      description: 'Repostería fina europea y postres artesanales para consentirte a cualquier hora.',
      logoUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&auto=format&fit=crop&q=80',
      bannerUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&auto=format&fit=crop&q=80',
      rating: 4.8,
      reviewCount: 145,
      category: 'Postres & Dulces',
      isActive: true,
      contact: {
        whatsappNumber: '+584142223344',
        instagram: '@dulcetentacion.waffles',
        address: 'Av. Andrés Bello, Los Palos Grandes',
        coordinates: { lat: 10.4965, lng: -66.8480 }
      },
      deliverySettings: {
        hasDelivery: true,
        hasPickup: true,
        baseDeliveryFee: 2.50,
        estimatedDeliveryMinMinutes: 20,
        estimatedDeliveryMaxMinutes: 30,
        freeDeliveryThreshold: 20.00,
        minOrderAmount: 6.00,
        currency: 'USD',
        currencySymbol: '$'
      },
      businessHours: {
        open: '08:30',
        close: '21:00',
        isOpenToday: true
      },
      branding: {
        accentColor: '#db2777',
        logoUrl: 'https://images.unsplash.com/photo-1509440159596-0249088772ff?w=200&auto=format&fit=crop&q=80',
        bannerUrl: 'https://images.unsplash.com/photo-1578985545062-69928b1d9587?w=1200&auto=format&fit=crop&q=80'
      },
      currencySettings: {
        baseCurrency: 'USD',
        displayMode: 'usd_and_bs',
        exchangeRate: 45.50,
        lastRateUpdate: new Date().toISOString()
      }
    }
  ];

  updateTenant(tenantId: string, partial: Partial<Tenant>): Tenant | undefined {
    const index = this.tenants.findIndex(t => t.id === tenantId);
    if (index > -1) {
      this.tenants[index] = {
        ...this.tenants[index],
        ...partial,
        branding: {
          ...this.tenants[index].branding,
          ...(partial.branding || {})
        },
        currencySettings: {
          ...this.tenants[index].currencySettings,
          ...(partial.currencySettings || {})
        },
        contact: {
          ...this.tenants[index].contact,
          ...(partial.contact || {})
        }
      };
      return this.tenants[index];
    }
    return undefined;
  }


  private readonly categoriesByTenant: Record<string, ProductCategory[]> = {
    'tenant-1': [
      { id: 'cat-promos', name: 'Combos & Promos', slug: 'promos', displayOrder: 1 },
      { id: 'cat-smash', name: 'Smash Burgers', slug: 'smash', displayOrder: 2 },
      { id: 'cat-gourmet', name: 'Burgers Gourmet', slug: 'gourmet', displayOrder: 3 },
      { id: 'cat-sides', name: 'Acompañantes', slug: 'sides', displayOrder: 4 },
      { id: 'cat-drinks', name: 'Bebidas & Malteadas', slug: 'drinks', displayOrder: 5 }
    ]
  };

  private readonly productsByTenant: Record<string, Product[]> = {
    'tenant-1': [
      {
        id: 'prod-101',
        tenantId: 'tenant-1',
        categoryId: 'cat-promos',
        name: 'Combo Doble Bacon Smash + Papas + Bebida',
        description: 'Dos carnes smash de 100g, queso cheddar fundido, tocineta ahumada crujiente, cebolla caramelizada y salsa secret lab en pan brioche. Incluye papas y bebida.',
        price: 9.99,
        compareAtPrice: 13.50,
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
        isAvailable: true,
        isPopular: true,
        isFeatured: true,
        tags: ['Más Pedido', 'Oferta'],
        modifierGroups: [
          {
            id: 'mod-drink',
            title: 'Elige tu Bebida',
            minSelections: 1,
            maxSelections: 1,
            options: [
              { id: 'd1', name: 'Coca Cola Regular 355ml', priceDelta: 0, isDefault: true },
              { id: 'd2', name: 'Coca Cola Zero 355ml', priceDelta: 0 },
              { id: 'd3', name: 'Té Frío Limón Casero', priceDelta: 0.50 },
              { id: 'd4', name: 'Cerveza Artesanal IPA', priceDelta: 2.00 }
            ]
          },
          {
            id: 'mod-extras',
            title: 'Agrega Extras Deliciosos',
            minSelections: 0,
            maxSelections: 3,
            options: [
              { id: 'e1', name: 'Carne Smash Extra (100g)', priceDelta: 2.00 },
              { id: 'e2', name: 'Tocineta Ahumada Extra', priceDelta: 1.50 },
              { id: 'e3', name: 'Doble Queso Cheddar Americano', priceDelta: 1.00 },
              { id: 'e4', name: 'Jalapeños encurtidos', priceDelta: 0.75 }
            ]
          }
        ]
      },
      {
        id: 'prod-102',
        tenantId: 'tenant-1',
        categoryId: 'cat-smash',
        name: 'Classic Oklahoma Onion Smash',
        description: 'Técnica clásica de Oklahoma: cebolla cortada ultrafina prensada directamente en la carne a fuego vivo, doble queso americano y pepinillos agridulces.',
        price: 7.50,
        imageUrl: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80',
        isAvailable: true,
        isPopular: true,
        tags: ['Recomendado'],
        modifierGroups: [
          {
            id: 'mod-sides-opt',
            title: '¿Deseas acompañante?',
            minSelections: 0,
            maxSelections: 1,
            options: [
              { id: 's1', name: 'Papas Rústicas con Sal Marina', priceDelta: 2.50 },
              { id: 's2', name: 'Papas Trufadas con Parmesano', priceDelta: 4.00 },
              { id: 's3', name: 'Aros de Cebolla Rebozados', priceDelta: 3.00 }
            ]
          }
        ]
      },
      {
        id: 'prod-103',
        tenantId: 'tenant-1',
        categoryId: 'cat-gourmet',
        name: 'The Truffle & Mushroom Royale',
        description: 'Carne angus de 180g, reducción de hongos portobello al vino tinto, queso gruyère suizo y mayonesa de trufa negra.',
        price: 11.50,
        imageUrl: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=600&auto=format&fit=crop&q=80',
        isAvailable: true,
        isPopular: false,
        tags: ['Gourmet']
      },
      {
        id: 'prod-104',
        tenantId: 'tenant-1',
        categoryId: 'cat-sides',
        name: 'Papas Cheese & Bacon Fries',
        description: 'Porción generosa de papas fritas bañadas en salsa cheddar caliente artesanal y lluvia de tocineta ahumada crujiente.',
        price: 4.50,
        imageUrl: 'https://images.unsplash.com/photo-1585109649139-366815a0d713?w=600&auto=format&fit=crop&q=80',
        isAvailable: true,
        isPopular: true
      },
      {
        id: 'prod-105',
        tenantId: 'tenant-1',
        categoryId: 'cat-drinks',
        name: 'Malteada de Nutella & Brownie',
        description: 'Helado de vainilla premium, nutella original, trozos de brownie húmedo y crema batida.',
        price: 5.00,
        imageUrl: 'https://images.unsplash.com/photo-1572490122747-3968b75cc699?w=600&auto=format&fit=crop&q=80',
        isAvailable: true
      }
    ]
  };

  private readonly initialOrders: Order[] = [
    {
      id: 'ord-101',
      orderNumber: 'ORD-4029',
      tenantId: 'tenant-1',
      tenantName: 'Burger Lab Artisanal',
      source: 'whatsapp_link',
      status: 'in_kitchen',
      fulfillmentType: 'delivery',
      paymentMethod: 'mobile_transfer',
      customer: {
        name: 'Carlos Mendoza',
        phone: '+584123456789',
        deliveryAddress: 'Av. San Juan Bosco, Edif. Altamira Plaza, Apto 4B',
        addressReference: 'Frente a la panadería St. Honoré'
      },
      items: [
        {
          cartItemId: 'item-1',
          productId: 'prod-101',
          name: 'Combo Doble Bacon Smash + Papas + Bebida',
          unitPrice: 9.99,
          quantity: 2,
          selectedModifiers: [
            { groupId: 'mod-drink', groupTitle: 'Bebida', optionId: 'd1', optionName: 'Coca Cola Regular', priceDelta: 0 },
            { groupId: 'mod-extras', groupTitle: 'Extras', optionId: 'e2', optionName: 'Tocineta Extra', priceDelta: 1.50 }
          ],
          itemTotal: 22.98
        }
      ],
      subtotal: 22.98,
      deliveryFee: 2.50,
      discount: 0,
      total: 25.48,
      createdAt: new Date(Date.now() - 15 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 5 * 60000).toISOString()
    },
    {
      id: 'ord-102',
      orderNumber: 'ORD-4030',
      tenantId: 'tenant-1',
      tenantName: 'Burger Lab Artisanal',
      source: 'whatsapp_link',
      status: 'received',
      fulfillmentType: 'delivery',
      paymentMethod: 'cash_usd',
      customer: {
        name: 'Valentina Silva',
        phone: '+584249876543',
        deliveryAddress: 'Calle El Parque, Quinta Los Jabillos, Campo Alegre',
        addressReference: 'Portón negro con cerca eléctrica'
      },
      items: [
        {
          cartItemId: 'item-2',
          productId: 'prod-102',
          name: 'Classic Oklahoma Onion Smash',
          unitPrice: 7.50,
          quantity: 1,
          selectedModifiers: [],
          itemTotal: 7.50
        },
        {
          cartItemId: 'item-3',
          productId: 'prod-104',
          name: 'Papas Cheese & Bacon Fries',
          unitPrice: 4.50,
          quantity: 1,
          selectedModifiers: [],
          itemTotal: 4.50
        }
      ],
      subtotal: 12.00,
      deliveryFee: 2.50,
      discount: 0,
      total: 14.50,
      createdAt: new Date(Date.now() - 3 * 60000).toISOString(),
      updatedAt: new Date(Date.now() - 3 * 60000).toISOString()
    }
  ];

  private readonly subscriptionPlans: SubscriptionPlan[] = [
    {
      id: 'plan_emprendedor',
      code: 'EMPRENDEDOR',
      name: 'Plan Emprendedor',
      priceMonthly: 9.00,
      priceAnnual: 7.00,
      monthlyPriceUsd: 9.00,
      maxBranches: 0,
      hasWhatsappBot: false,
      hasExcelReports: false,
      hasFeaturedBanners: false,
      maxAdditionalUsers: 1,
      maxMonthlyOrders: 20,
      maxProducts: 20,
      description: 'Para negocios y marcas que inician con su sede principal.',
      features: [
        '0 sucursales adicionales (solo sede principal)',
        'Hasta 20 productos en catálogo',
        'Hasta 20 pedidos al mes',
        '1 usuario de equipo adicional',
        'Tienda web y menú digital con código QR',
        'Acceso a la App Móvil de Clientes',
        'Acceso a la App de Repartidores con GPS',
        'Pagos 100% directos (0% comisión sobre ventas)',
        'Tracking de pedidos en tiempo real',
        'Soporte estándar'
      ]
    },
    {
      id: 'plan_comercio_pro',
      code: 'COMERCIO_PRO',
      name: 'Plan Comercio Pro',
      priceMonthly: 29.00,
      priceAnnual: 23.00,
      monthlyPriceUsd: 29.00,
      maxBranches: 2,
      hasWhatsappBot: true,
      hasExcelReports: true,
      hasFeaturedBanners: false,
      maxAdditionalUsers: 3,
      maxMonthlyOrders: 50,
      maxProducts: 100,
      description: 'Para comercios establecidos que buscan automatización y expansión local.',
      features: [
        'Todo lo incluido en el Plan Emprendedor',
        'Hasta 2 sucursales adicionales (3 sedes en total)',
        'Hasta 100 productos en catálogo',
        'Hasta 50 pedidos al mes',
        'Hasta 3 usuarios de equipo adicionales',
        'Bot automático de WhatsApp y Live Chat 24/7',
        'Reportes avanzados en Excel (.xlsx)',
        'Soporte prioritario'
      ]
    },
    {
      id: 'plan_franquicia',
      code: 'FRANQUICIA',
      name: 'Plan Franquicia',
      priceMonthly: 79.00,
      priceAnnual: 63.00,
      monthlyPriceUsd: 79.00,
      maxBranches: -1,
      hasWhatsappBot: true,
      hasExcelReports: true,
      hasFeaturedBanners: true,
      maxAdditionalUsers: -1,
      maxMonthlyOrders: -1,
      maxProducts: -1,
      description: 'Para cadenas gastronómicas, franquicias y marcas líderes de alto volumen.',
      features: [
        'Todo lo incluido en el Plan Comercio Pro',
        'Sucursales físicas ilimitadas',
        'Productos en catálogo ilimitados',
        'Pedidos al mes ilimitados',
        'Cuentas de usuarios de equipo ilimitadas',
        'Banners destacados VIP en la App Móvil',
        'Bot automático de WhatsApp ilimitado con IA',
        'Auditoría de inicios de sesión y BI empresarial',
        'Soporte VIP 24/7 con ejecutivo asignado'
      ]
    }
  ];

  private branches: Branch[] = [
    {
      id: 'b1111111-1111-1111-1111-111111111111',
      companyId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      companyName: 'Burger Lab Artisanal',
      name: 'Burger Lab - La Mata (Sede Principal)',
      slug: 'la-mata',
      address: 'Av. Intercomunal Barquisimeto-Cabudare, Sector La Mata, C.C. Trébol',
      latitude: 10.026743,
      longitude: -69.257153,
      deliveryRadiusKm: 8.0,
      baseDeliveryFee: 2.50,
      status: 'active',
      phone: '+584121234567',
      whatsapp: '+584121234567',
      openTime: '11:30',
      closeTime: '23:00',
      isOpenNow: true,
      createdAt: '2026-01-15T10:00:00Z',
      paymentCredentials: {
        pagoMovilBank: '0134 - Banesco',
        pagoMovilPhone: '0414-5001122',
        pagoMovilIdNumber: 'V-25.123.456',
        pagoMovilAccountName: 'Burger Lab La Mata C.A.',
        zelleEmail: 'pagos.lamata@burgerlab.com',
        zelleAccountName: 'Burger Lab Group LLC',
        isActive: true
      }
    },
    {
      id: 'b2222222-2222-2222-2222-222222222222',
      companyId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      companyName: 'Burger Lab Artisanal',
      name: 'Burger Lab - Cabudare Centro',
      slug: 'cabudare-centro',
      address: 'Av. Libertador con Calle 9, Centro de Cabudare',
      latitude: 10.038500,
      longitude: -69.248200,
      deliveryRadiusKm: 8.0,
      baseDeliveryFee: 2.00,
      status: 'active',
      phone: '+584129988776',
      whatsapp: '+584129988776',
      openTime: '12:00',
      closeTime: '23:30',
      isOpenNow: true,
      createdAt: '2026-02-10T12:00:00Z',
      paymentCredentials: {
        pagoMovilBank: '0105 - Mercantil',
        pagoMovilPhone: '0412-9988776',
        pagoMovilIdNumber: 'J-501234567',
        pagoMovilAccountName: 'Burger Lab Centro C.A.',
        zelleEmail: 'pagos.centro@burgerlab.com',
        zelleAccountName: 'Burger Lab Group LLC',
        isActive: true
      }
    },
    {
      id: 'b3333333-3333-3333-3333-333333333333',
      companyId: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      companyName: 'Burger Lab Artisanal',
      name: 'Burger Lab - El Placer Express',
      slug: 'el-placer',
      address: 'Urb. El Placer, Manzana B, Frente a la Plaza Central',
      latitude: 10.034574,
      longitude: -69.237544,
      deliveryRadiusKm: 6.0,
      baseDeliveryFee: 2.00,
      status: 'pending_approval',
      phone: '+584145554321',
      whatsapp: '+584145554321',
      openTime: '16:00',
      closeTime: '23:00',
      isOpenNow: false,
      createdAt: new Date().toISOString(),
      paymentCredentials: {
        pagoMovilBank: '0108 - Provincial',
        pagoMovilPhone: '0414-5554321',
        pagoMovilIdNumber: 'V-26.789.012',
        pagoMovilAccountName: 'Burger Lab El Placer',
        zelleEmail: 'elplacer@burgerlab.com',
        zelleAccountName: 'Burger Lab Group LLC',
        isActive: true
      }
    }
  ];

  getTenants(): Tenant[] {
    return this.tenants;
  }

  getTenantBySlug(slug: string): Tenant | undefined {
    return this.tenants.find(t => t.slug === slug || t.id === slug) || this.tenants[0];
  }

  getCategories(tenantId: string): ProductCategory[] {
    return this.categoriesByTenant[tenantId] || this.categoriesByTenant['tenant-1'] || [];
  }

  getProducts(tenantId: string): Product[] {
    return this.productsByTenant[tenantId] || this.productsByTenant['tenant-1'] || [];
  }

  getOrders(tenantId: string): Order[] {
    return [];
  }

  // --- MULTI-SUCURSAL & SUSCRIPCIONES ---
  getSubscriptionPlans(): SubscriptionPlan[] {
    return this.subscriptionPlans;
  }

  getSubscriptionPlanById(id: string): SubscriptionPlan | undefined {
    return this.subscriptionPlans.find(p => p.id === id);
  }

  getBranchesByCompany(companyId: string): Branch[] {
    return this.branches.filter(b => b.companyId === companyId);
  }

  getAllBranches(): Branch[] {
    return [...this.branches];
  }

  getPendingBranches(): Branch[] {
    return this.branches.filter(b => b.status === 'pending_approval');
  }

  createBranch(branchData: Partial<Branch>): { success: boolean; branch?: Branch; message?: string } {
    const company = this.tenants.find(t => t.id === branchData.companyId);
    const planId = company?.subscriptionPlanId || 'COMERCIO';
    const plan = this.subscriptionPlans.find(p => p.id === planId) || this.subscriptionPlans[1];

    const currentActiveCount = this.branches.filter(
      b => b.companyId === branchData.companyId && b.status === 'active'
    ).length;

    if (currentActiveCount >= plan.maxBranches) {
      return {
        success: false,
        message: `Has alcanzado el límite máximo de ${plan.maxBranches} sedes activas para tu ${plan.name}. Actualiza a un plan superior para registrar más sucursales.`
      };
    }

    const newBranch: Branch = {
      id: `b-${Date.now()}-${Math.random().toString(36).substr(2, 6)}`,
      companyId: branchData.companyId || 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
      companyName: company?.name || 'Burger Lab Artisanal',
      name: branchData.name || 'Nueva Sucursal',
      slug: (branchData.name || 'nueva-sucursal').toLowerCase().replace(/\s+/g, '-'),
      address: branchData.address || '',
      latitude: branchData.latitude || 10.026743,
      longitude: branchData.longitude || -69.257153,
      deliveryRadiusKm: branchData.deliveryRadiusKm || 8.0,
      baseDeliveryFee: branchData.baseDeliveryFee || 2.50,
      status: 'pending_approval', // Siempre inicia pendiente de aprobación por Super Admin
      phone: branchData.phone || '',
      whatsapp: branchData.whatsapp || '',
      openTime: branchData.openTime || '11:00',
      closeTime: branchData.closeTime || '23:00',
      isOpenNow: false,
      createdAt: new Date().toISOString(),
      paymentCredentials: branchData.paymentCredentials || {
        pagoMovilBank: '0134 - Banesco',
        pagoMovilPhone: '0414-0000000',
        pagoMovilIdNumber: 'V-00000000',
        pagoMovilAccountName: company?.name || 'Comercio',
        isActive: true
      }
    };

    this.branches.push(newBranch);
    return { success: true, branch: newBranch };
  }

  approveBranch(branchId: string): boolean {
    const branch = this.branches.find(b => b.id === branchId);
    if (branch) {
      branch.status = 'active';
      branch.isOpenNow = true;
      return true;
    }
    return false;
  }

  rejectBranch(branchId: string, reason?: string): boolean {
    const branch = this.branches.find(b => b.id === branchId);
    if (branch) {
      branch.status = 'rejected';
      branch.rejectionReason = reason || 'Rechazada por Super Administrador';
      branch.isOpenNow = false;
      return true;
    }
    return false;
  }

  toggleBranchStatus(branchId: string): boolean {
    const branch = this.branches.find(b => b.id === branchId);
    if (branch && branch.status === 'active') {
      branch.isOpenNow = !branch.isOpenNow;
      return true;
    }
    return false;
  }
}
