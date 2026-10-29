import { Injectable, Logger } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';

@Injectable()
export class SeedService {
  private readonly logger = new Logger(SeedService.name);

  constructor(private supabase: SupabaseService) {}

  async seedAll() {
    this.logger.log('Iniciando carga de datos reales en Supabase...');
    const client = this.supabase.getClient();

    // 1. Tenants (Burger Lab & Tokyo Sushi)
    const tenants = [
      {
        id: 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
        slug: 'burger-lab',
        name: 'Burger Lab Artisanal',
        business_name: 'Burger Lab Gourmet C.A.',
        tax_id: 'J-50123456-7',
        phone: '+584121234567',
        whatsapp_number: '584121234567',
        email: 'contacto@burgerlab.com',
        logo_url: 'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&auto=format&fit=crop&q=80',
        banner_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=1200&auto=format&fit=crop&q=80',
        accent_color: '#f97316',
        address: 'Calle París con Av. Caroní, Las Mercedes, Caracas',
        latitude: 10.4820,
        longitude: -66.8610,
        delivery_radius_km: 8.0,
        base_delivery_fee: 2.50,
        min_order_amount: 8.00,
        commission_percentage: 10.0,
        is_active: true,
      },
      {
        id: 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
        slug: 'tokyo-sushi',
        name: 'Tokyo Sushi Fusion',
        business_name: 'Inversiones Tokyo Sushi C.A.',
        tax_id: 'J-50987654-3',
        phone: '+584129876543',
        whatsapp_number: '584129876543',
        email: 'pedidos@tokyosushi.com',
        logo_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&auto=format&fit=crop&q=80',
        banner_url: 'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=1200&auto=format&fit=crop&q=80',
        accent_color: '#dc2626',
        address: 'Av. Principal de Chacao, Edif. Centro Sushi, Caracas',
        latitude: 10.4920,
        longitude: -66.8520,
        delivery_radius_km: 10.0,
        base_delivery_fee: 3.00,
        min_order_amount: 10.00,
        commission_percentage: 10.0,
        is_active: true,
      },
    ];

    for (const t of tenants) {
      await client.from('tenants').upsert(t, { onConflict: 'id' });
    }
    this.logger.log('Comercios cargados exitosamente.');

    // 2. Categories
    const categoriesData = [
      { id: 'c1111111-1111-1111-1111-111111111111', tenant_id: tenants[0].id, name: 'Hamburguesas Smash', sort_order: 1 },
      { id: 'c2222222-2222-2222-2222-222222222222', tenant_id: tenants[0].id, name: 'Acompañantes & Sides', sort_order: 2 },
      { id: 'c3333333-3333-3333-3333-333333333333', tenant_id: tenants[0].id, name: 'Bebidas & Malteadas', sort_order: 3 },
      { id: 'c4444444-4444-4444-4444-444444444444', tenant_id: tenants[1].id, name: 'Rolls Especiales', sort_order: 1 },
      { id: 'c5555555-5555-5555-5555-555555555555', tenant_id: tenants[1].id, name: 'Entradas & Gyozas', sort_order: 2 },
    ];

    for (const c of categoriesData) {
      await client.from('categories').upsert(c, { onConflict: 'id' });
    }
    this.logger.log('Categorías cargadas.');

    // 3. Products
    const productsData = [
      {
        id: 'p1111111-1111-1111-1111-111111111111',
        tenant_id: tenants[0].id,
        category_id: categoriesData[0].id,
        name: 'Smash Bacon Truffle',
        description: 'Doble carne smash 90g, queso cheddar inglés, tocineta crujiente, cebolla crispy y emulsión de trufa negra en pan brioche.',
        price: 9.50,
        image_url: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
        is_available: true,
        sort_order: 1,
      },
      {
        id: 'p2222222-2222-2222-2222-222222222222',
        tenant_id: tenants[0].id,
        category_id: categoriesData[0].id,
        name: 'Double Cheese Monster',
        description: 'Doble medallón angus, cuádruple queso americano derretido, pepinillos encurtidos dulces y salsa secreta burger lab.',
        price: 10.50,
        image_url: 'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80',
        is_available: true,
        sort_order: 2,
      },
      {
        id: 'p3333333-3333-3333-3333-333333333333',
        tenant_id: tenants[0].id,
        category_id: categoriesData[1].id,
        name: 'Papas Rústicas con Trufa & Parmesano',
        description: 'Papas cortadas a mano con piel, bañadas en aceite de trufa blanca, queso parmesano reggiano rallado y perejil fresco.',
        price: 4.50,
        image_url: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
        is_available: true,
        sort_order: 3,
      },
      {
        id: 'p4444444-4444-4444-4444-444444444444',
        tenant_id: tenants[1].id,
        category_id: categoriesData[3].id,
        name: 'Tokyo Volcano Roll (10 pcs)',
        description: 'Relleno de salmón fresco, queso crema y aguacate. Coronado con tartar de cangrejo picante flambeado y salsa unagi.',
        price: 12.50,
        image_url: 'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80',
        is_available: true,
        sort_order: 1,
      },
      {
        id: 'p5555555-5555-5555-5555-555555555555',
        tenant_id: tenants[1].id,
        category_id: categoriesData[4].id,
        name: 'Gyozas de Cerdo y Jengibre (5 pcs)',
        description: 'Empanadillas japonesas a la plancha rellenas de cerdo especiado, cebollín y jengibre fresco con salsa ponzu cítrica.',
        price: 6.00,
        image_url: 'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&auto=format&fit=crop&q=80',
        is_available: true,
        sort_order: 2,
      },
    ];

    for (const p of productsData) {
      await client.from('products').upsert(p, { onConflict: 'id' });
    }
    this.logger.log('Productos cargados.');

    // 4. Modifier Groups & Options for Smash Bacon Truffle
    const modGroup = {
      id: 'g1111111-1111-1111-1111-111111111111',
      product_id: productsData[0].id,
      title: 'Punto de Cocción de la Carne',
      min_selections: 1,
      max_selections: 1,
      sort_order: 1,
    };
    await client.from('modifier_groups').upsert(modGroup, { onConflict: 'id' });

    const modOptions = [
      { id: 'o1111111-1111-1111-1111-111111111111', group_id: modGroup.id, name: 'Término Medio (Jugosa)', price_delta: 0.00, sort_order: 1 },
      { id: 'o2222222-2222-2222-2222-222222222222', group_id: modGroup.id, name: 'Tres Cuartos (Recomendado)', price_delta: 0.00, sort_order: 2 },
      { id: 'o3333333-3333-3333-3333-333333333333', group_id: modGroup.id, name: 'Bien Cocida', price_delta: 0.00, sort_order: 3 },
    ];
    for (const opt of modOptions) {
      await client.from('modifier_options').upsert(opt, { onConflict: 'id' });
    }

    const modGroupExtras = {
      id: 'g2222222-2222-2222-2222-222222222222',
      product_id: productsData[0].id,
      title: 'Extras Deliciosos',
      min_selections: 0,
      max_selections: 4,
      sort_order: 2,
    };
    await client.from('modifier_groups').upsert(modGroupExtras, { onConflict: 'id' });

    const modExtrasOptions = [
      { id: 'o4444444-4444-4444-4444-444444444444', group_id: modGroupExtras.id, name: 'Tocineta Ahumada Extra (+2 tiras)', price_delta: 1.50, sort_order: 1 },
      { id: 'o5555555-5555-5555-5555-555555555555', group_id: modGroupExtras.id, name: 'Huevo Frito de Campo', price_delta: 1.00, sort_order: 2 },
      { id: 'o6666666-6666-6666-6666-666666666666', group_id: modGroupExtras.id, name: 'Cebolla Caramelizada', price_delta: 0.80, sort_order: 3 },
    ];
    for (const opt of modExtrasOptions) {
      await client.from('modifier_options').upsert(opt, { onConflict: 'id' });
    }

    // 5. Riders
    const sampleRider = {
      id: 'r1111111-1111-1111-1111-111111111111',
      tenant_id: tenants[0].id,
      vehicle_type: 'moto',
      vehicle_plate: 'AE4R21G',
      status: 'available',
      current_lat: 10.4815,
      current_lng: -66.8612,
    };
    await client.from('riders').upsert(sampleRider, { onConflict: 'id' });
    this.logger.log('Repartidor registrado.');

    // 6. Sample Order
    const sampleOrder = {
      id: 'ord11111-1111-1111-1111-111111111111',
      tenant_id: tenants[0].id,
      order_number: '#BL-4821',
      source: 'whatsapp_link',
      status: 'on_the_way',
      fulfillment_type: 'delivery',
      payment_method: 'mobile_transfer',
      payment_status: 'confirmed',
      payment_reference: 'REF-78945612',
      customer_name: 'María Alejandra Gómez',
      customer_phone: '+584143332211',
      delivery_address: 'Av. San Juan Bosco, Edif. Altamira Suites, Apto 4-B',
      delivery_lat: 10.4960,
      delivery_lng: -66.8520,
      driver_id: sampleRider.id,
      subtotal: 14.00,
      delivery_fee: 2.50,
      discount: 0.00,
      total: 16.50,
      notes: 'Favor timbrar en recepción al llegar',
    };
    await client.from('orders').upsert(sampleOrder, { onConflict: 'id' });

    // Order items
    await client.from('order_items').upsert([
      {
        order_id: sampleOrder.id,
        product_id: productsData[0].id,
        product_name: 'Smash Bacon Truffle',
        unit_price: 9.50,
        quantity: 1,
        item_total: 9.50,
        selected_modifiers: [{ group: 'Punto de Cocción', option: 'Tres Cuartos', price: 0 }],
      },
      {
        order_id: sampleOrder.id,
        product_id: productsData[2].id,
        product_name: 'Papas Rústicas con Trufa & Parmesano',
        unit_price: 4.50,
        quantity: 1,
        item_total: 4.50,
        selected_modifiers: [],
      },
    ]);

    // Initial Telemetry point
    await client.from('rider_telemetry').insert({
      rider_id: sampleRider.id,
      order_id: sampleOrder.id,
      latitude: 10.4850,
      longitude: -66.8580,
      speed_kmh: 35.5,
      heading: 45.0,
      battery_level: 88,
    });

    this.logger.log('¡Base de datos poblada exitosamente con datos reales!');
    return {
      success: true,
      message: 'Base de datos de Supabase poblada con datos reales de comercios, categorías, productos, modificadores, pedidos y telemetría.',
      counts: {
        tenants: tenants.length,
        categories: categoriesData.length,
        products: productsData.length,
        orders: 1,
        riders: 1,
      },
    };
  }
}
