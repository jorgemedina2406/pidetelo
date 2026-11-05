-- ==============================================================================
-- DELIVERY PLATFORM - SEED REAL DATA SCRIPT
-- Ejecuta este script en el SQL Editor de tu Dashboard de Supabase
-- para poblar la base de datos con comercios, menú, productos, extras y comandas.
-- ==============================================================================

-- 1. COMERCIOS (TENANTS)
INSERT INTO tenants (
  id, slug, name, business_name, tax_id, phone, whatsapp_number, email, 
  logo_url, banner_url, accent_color, address, latitude, longitude, 
  delivery_radius_km, base_delivery_fee, min_order_amount, commission_percentage, is_active
)
VALUES
(
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'burger-lab',
  'Burger Lab Artisanal',
  'Burger Lab Gourmet C.A.',
  'J-50123456-7',
  '+584121234567',
  '584121234567',
  'contacto@burgerlab.com',
  'https://images.unsplash.com/photo-1550547660-d9450f859349?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=1200&auto=format&fit=crop&q=80',
  '#f97316',
  'Calle París con Av. Caroní, Las Mercedes, Caracas',
  10.4820,
  -66.8610,
  8.0,
  2.50,
  8.00,
  10.0,
  true
),
(
  'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
  'tokyo-sushi',
  'Tokyo Sushi Fusion',
  'Inversiones Tokyo Sushi C.A.',
  'J-50987654-3',
  '+584129876543',
  '584129876543',
  'pedidos@tokyosushi.com',
  'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=300&auto=format&fit=crop&q=80',
  'https://images.unsplash.com/photo-1617196034796-73dfa7b1fd56?w=1200&auto=format&fit=crop&q=80',
  '#dc2626',
  'Av. Principal de Chacao, Edif. Centro Sushi, Caracas',
  10.4920,
  -66.8520,
  10.0,
  3.00,
  10.00,
  10.0,
  true
)
ON CONFLICT (id) DO UPDATE SET
  logo_url = EXCLUDED.logo_url,
  banner_url = EXCLUDED.banner_url,
  accent_color = EXCLUDED.accent_color,
  delivery_radius_km = EXCLUDED.delivery_radius_km,
  base_delivery_fee = EXCLUDED.base_delivery_fee,
  min_order_amount = EXCLUDED.min_order_amount;

-- 2. CATEGORIAS DE PRODUCTOS
INSERT INTO categories (id, tenant_id, name, sort_order, is_active)
VALUES
  ('c1111111-1111-4111-8111-111111111111', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Hamburguesas Smash', 1, true),
  ('c2222222-2222-4222-8222-222222222222', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Acompañantes & Sides', 2, true),
  ('c3333333-3333-4333-8333-333333333333', 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d', 'Bebidas & Malteadas', 3, true),
  ('c4444444-4444-4444-8444-444444444444', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'Rolls Especiales', 1, true),
  ('c5555555-5555-4555-8555-555555555555', 'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e', 'Entradas & Gyozas', 2, true)
ON CONFLICT (id) DO NOTHING;

-- 3. PRODUCTOS
INSERT INTO products (id, tenant_id, category_id, name, description, price, image_url, is_available, sort_order)
VALUES
(
  'd1111111-1111-4111-8111-111111111111',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'c1111111-1111-4111-8111-111111111111',
  'Smash Bacon Truffle',
  'Doble medallón smash 90g corte angus, queso cheddar inglés derretido, tocineta ahumada crujiente, cebolla crispy y emulsión de trufa negra en pan brioche artesanal.',
  9.50,
  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600&auto=format&fit=crop&q=80',
  true,
  1
),
(
  'd2222222-2222-4222-8222-222222222222',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'c1111111-1111-4111-8111-111111111111',
  'Double Cheese Monster',
  'Doble medallón angus, cuádruple queso americano madurado, pepinillos dulces encurtidos en casa y salsa secreta burger lab.',
  10.50,
  'https://images.unsplash.com/photo-1586190848861-99aa4a171e90?w=600&auto=format&fit=crop&q=80',
  true,
  2
),
(
  'd3333333-3333-4333-8333-333333333333',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  'c2222222-2222-4222-8222-222222222222',
  'Papas Rústicas con Trufa & Parmesano',
  'Papas naturales cortadas a mano con piel, bañadas en aceite de trufa blanca, queso parmesano reggiano rallado al momento y perejil fresco.',
  4.50,
  'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
  true,
  3
),
(
  'd4444444-4444-4444-8444-444444444444',
  'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
  'c4444444-4444-4444-8444-444444444444',
  'Tokyo Volcano Roll (10 pcs)',
  'Relleno de salmón fresco noruego, queso crema y aguacate hass. Coronado con tartar de cangrejo picante flambeado en mesa y reducción de unagi.',
  12.50,
  'https://images.unsplash.com/photo-1579871494447-9811cf80d66c?w=600&auto=format&fit=crop&q=80',
  true,
  1
),
(
  'd5555555-5555-4555-8555-555555555555',
  'b2c3d4e5-f6a7-8b9c-0d1e-2f3a4b5c6d7e',
  'c5555555-5555-4555-8555-555555555555',
  'Gyozas de Cerdo y Jengibre (5 pcs)',
  'Empanadillas japonesas artesanales selladas a la plancha, rellenas de lomo de cerdo, cebollín y jengibre fresco con salsa ponzu cítrica.',
  6.00,
  'https://images.unsplash.com/photo-1496116218417-1a781b1c416c?w=600&auto=format&fit=crop&q=80',
  true,
  2
)
ON CONFLICT (id) DO UPDATE SET
  price = EXCLUDED.price,
  description = EXCLUDED.description,
  image_url = EXCLUDED.image_url;

-- 4. GRUPOS DE MODIFICADORES & EXTRAS
INSERT INTO modifier_groups (id, product_id, title, min_selections, max_selections, sort_order)
VALUES
(
  'e1111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  'Término de la Carne',
  1,
  1,
  1
),
(
  'e2222222-2222-4222-8222-222222222222',
  'd1111111-1111-4111-8111-111111111111',
  'Extras y Toppings',
  0,
  4,
  2
)
ON CONFLICT (id) DO NOTHING;

-- 5. OPCIONES DE MODIFICADORES
INSERT INTO modifier_options (id, group_id, name, price_delta, is_available, sort_order)
VALUES
  ('f1111111-1111-4111-8111-111111111111', 'e1111111-1111-4111-8111-111111111111', 'Término Medio (Jugosa)', 0.00, true, 1),
  ('f2222222-2222-4222-8222-222222222222', 'e1111111-1111-4111-8111-111111111111', 'Tres Cuartos (Recomendado)', 0.00, true, 2),
  ('f3333333-3333-4333-8333-333333333333', 'e1111111-1111-4111-8111-111111111111', 'Bien Cocida', 0.00, true, 3),
  ('f4444444-4444-4444-8444-444444444444', 'e2222222-2222-4222-8222-222222222222', 'Tocineta Extra Crujiente', 1.50, true, 1),
  ('f5555555-5555-4555-8555-555555555555', 'e2222222-2222-4222-8222-222222222222', 'Huevo Frito de Campo', 1.00, true, 2),
  ('f6666666-6666-4666-8666-666666666666', 'e2222222-2222-4222-8222-222222222222', 'Cebolla Caramelizada', 0.80, true, 3)
ON CONFLICT (id) DO NOTHING;

-- 6. REPARTIDORES: No se insertan riders de prueba. Se registran con datos reales desde la app de repartidores.

-- 7. PEDIDO DE EJEMPLO ACTIVO (PARA COCINA Y MAPA DE RASTREO)
INSERT INTO orders (
  id, tenant_id, order_number, source, status, fulfillment_type, payment_method, 
  payment_status, payment_reference, customer_name, customer_phone, delivery_address, 
  delivery_lat, delivery_lng, driver_id, subtotal, delivery_fee, discount, total, notes
)
VALUES
(
  '81111111-1111-4111-8111-111111111111',
  'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d',
  '#BL-4821',
  'whatsapp_link',
  'on_the_way',
  'delivery',
  'mobile_transfer',
  'confirmed',
  'REF-78945612',
  'María Alejandra Gómez',
  '+584143332211',
  'Av. San Juan Bosco, Edif. Altamira Suites, Apto 4-B',
  10.4960,
  -66.8520,
  '91111111-1111-4111-8111-111111111111',
  14.00,
  2.50,
  0.00,
  16.50,
  'Favor timbrar en recepción al llegar'
)
ON CONFLICT (id) DO NOTHING;

-- 8. ITEMS DEL PEDIDO
INSERT INTO order_items (id, order_id, product_id, product_name, unit_price, quantity, item_total, selected_modifiers)
VALUES
(
  '71111111-1111-4111-8111-111111111111',
  '81111111-1111-4111-8111-111111111111',
  'd1111111-1111-4111-8111-111111111111',
  'Smash Bacon Truffle',
  9.50,
  1,
  9.50,
  '[{"group": "Término de la Carne", "option": "Tres Cuartos (Recomendado)", "price": 0}]'::jsonb
),
(
  '72222222-2222-4222-8222-222222222222',
  '81111111-1111-4111-8111-111111111111',
  'd3333333-3333-4333-8333-333333333333',
  'Papas Rústicas con Trufa & Parmesano',
  4.50,
  1,
  4.50,
  '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- 9. TELEMETRIA GPS INICIAL PARA RASTREO
INSERT INTO rider_telemetry (rider_id, order_id, latitude, longitude, speed_kmh, heading, battery_level)
VALUES
(
  '91111111-1111-4111-8111-111111111111',
  '81111111-1111-4111-8111-111111111111',
  10.4850,
  -66.8580,
  35.5,
  45.0,
  88
);
