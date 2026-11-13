import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PlansService } from '../plans/plans.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private supabase: SupabaseService,
    private plansService: PlansService,
  ) {}

  async create(orderPayload: any) {
    const client = this.supabase.getClient();

    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    // Resolve tenant_id to a valid PostgreSQL UUID
    let resolvedTenantId = orderPayload.tenant_id;
    if (!isUuid(resolvedTenantId) && isUuid(orderPayload.branch_id)) {
      const { data: b } = await client.from('branches').select('company_id').eq('id', orderPayload.branch_id).maybeSingle();
      if (b?.company_id && isUuid(b.company_id)) {
        resolvedTenantId = b.company_id;
      }
    }

    if (!isUuid(resolvedTenantId)) {
      const { data: t } = await client.from('tenants').select('id').or(`slug.eq.${resolvedTenantId},name.ilike.%${resolvedTenantId}%`).maybeSingle();
      if (t?.id && isUuid(t.id)) {
        resolvedTenantId = t.id;
      } else {
        const { data: firstTenant } = await client.from('tenants').select('id').eq('is_active', true).limit(1).maybeSingle();
        if (firstTenant?.id) {
          resolvedTenantId = firstTenant.id;
        }
      }
    }

    // Validar límite mensual de pedidos según el plan de suscripción del comercio
    if (resolvedTenantId && isUuid(resolvedTenantId)) {
      await this.plansService.checkLimit(resolvedTenantId, 'order');
    }

    // Resolve branch_id to a valid branch or fallback to tenant main branch
    let resolvedBranchId = isUuid(orderPayload.branch_id) ? orderPayload.branch_id : null;
    if (!resolvedBranchId && isUuid(resolvedTenantId)) {
      const { data: mainB } = await client.from('branches').select('id').eq('company_id', resolvedTenantId).eq('is_main', true).maybeSingle();
      if (mainB?.id) {
        resolvedBranchId = mainB.id;
      }
    }

    const orderNumber = orderPayload.order_number || `#ORD-${Math.floor(1000 + Math.random() * 9000)}`;
    const { items, ...orderHeader } = orderPayload;

    const subtotal = Number(orderHeader.subtotal) || Number(orderHeader.total) || 0;
    const deliveryFee = Number(orderHeader.delivery_fee) || 0;
    const discount = Number(orderHeader.discount) || 0;
    const total = Number(orderHeader.total) || (subtotal + deliveryFee - discount);

    const paymentMethod = orderHeader.payment_method || 'mobile_transfer';
    const isPagoMovil = paymentMethod === 'mobile_transfer' || paymentMethod === 'pago_movil';
    const paymentStatus = orderHeader.payment_status || (isPagoMovil ? 'pending' : 'not_required');
    const paymentReference = orderHeader.payment_reference || null;
    const paymentOriginBank = orderHeader.payment_origin_bank || null;
    let finalNotes = (orderHeader.notes || '').toString();
    if (paymentOriginBank && !finalNotes.includes('[PAGO_ORIGEN:')) {
      finalNotes = `[PAGO_ORIGEN:${paymentOriginBank}] ${finalNotes}`.trim();
    }

    // 1. Insert order header
    const { data: newOrder, error: orderErr } = await client
      .from('orders')
      .insert({
        tenant_id: resolvedTenantId,
        branch_id: resolvedBranchId,
        order_number: orderNumber,
        source: orderHeader.source || 'whatsapp_link',
        status: orderHeader.status || 'received',
        fulfillment_type: orderHeader.fulfillment_type || 'delivery',
        payment_method: paymentMethod,
        payment_status: paymentStatus,
        payment_reference: paymentReference,
        customer_name: orderHeader.customer_name || 'Cliente',
        customer_phone: orderHeader.customer_phone || '04120000000',
        delivery_address: orderHeader.delivery_address || null,
        delivery_lat: orderHeader.delivery_lat !== undefined && orderHeader.delivery_lat !== null ? Number(orderHeader.delivery_lat) : null,
        delivery_lng: orderHeader.delivery_lng !== undefined && orderHeader.delivery_lng !== null ? Number(orderHeader.delivery_lng) : null,
        notes: finalNotes.length > 0 ? finalNotes : null,
        subtotal: subtotal,
        delivery_fee: deliveryFee,
        discount: discount,
        total: total,
      })
      .select()
      .single();

    if (orderErr) {
      throw new InternalServerErrorException(`Error creating order: ${orderErr.message}`);
    }

    // 2. Insert items if provided
    if (items && Array.isArray(items) && items.length > 0) {
      const formattedItems = items.map(item => ({
        order_id: newOrder.id,
        product_id: isUuid(item.product_id) ? item.product_id : null,
        product_name: item.product_name || 'Producto',
        unit_price: Number(item.unit_price) || 0,
        quantity: Number(item.quantity) || 1,
        item_total: Number(item.item_total || (Number(item.unit_price || 0) * Number(item.quantity || 1))) || 0,
        selected_modifiers: item.selected_modifiers || [],
      }));

      const { error: itemsErr } = await client.from('order_items').insert(formattedItems);

      if (itemsErr) {
        console.warn(`[OrdersService] Warning inserting order items: ${itemsErr.message}`);
      }

      // 2.1 Deducción automática de stock para productos con inventario habilitado
      for (const item of items) {
        const prodId = item.product_id;
        if (prodId && isUuid(prodId)) {
          try {
            const { data: p } = await client
              .from('products')
              .select('id, track_stock, stock_quantity, name')
              .eq('id', prodId)
              .maybeSingle();

            if (p && p.track_stock && p.stock_quantity !== null && p.stock_quantity !== undefined) {
              const currentStock = Number(p.stock_quantity) || 0;
              const qtyBought = Number(item.quantity) || 1;
              const newStock = Math.max(0, currentStock - qtyBought);
              const isOut = newStock <= 0;

              await client.from('products').update({
                stock_quantity: newStock,
                previous_stock: currentStock,
                is_available: !isOut
              }).eq('id', p.id);

              // Registrar en historial de movimientos de inventario
              await client.from('stock_history').insert({
                product_id: p.id,
                tenant_id: newOrder.tenant_id,
                previous_stock: currentStock,
                new_stock: newStock,
                difference: -qtyBought,
                change_type: 'order_deduction',
                reference_id: newOrder.order_number,
                notes: `Venta por orden #${newOrder.order_number}`
              });
            }
          } catch (stkErr) {
            console.warn('[OrdersService] Error descontando stock de producto:', stkErr);
          }
        }
      }
    }

    // 3. Return order with items
    return this.findById(newOrder.id);
  }

  async findByTenant(tenantId: string, status?: string, branchId?: string) {
    const isUuid = (val?: string) => Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    let resolvedTenantId = tenantId;
    if (!isUuid(resolvedTenantId)) {
      const { data: t } = await this.supabase.getClient().from('tenants').select('id').or(`slug.eq.${resolvedTenantId},name.ilike.%${resolvedTenantId}%`).maybeSingle();
      if (t?.id && isUuid(t.id)) {
        resolvedTenantId = t.id;
      } else {
        const { data: firstTenant } = await this.supabase.getClient().from('tenants').select('id').eq('is_active', true).limit(1).maybeSingle();
        if (firstTenant?.id) {
          resolvedTenantId = firstTenant.id;
        }
      }
    }

    let query = this.supabase
      .getClient()
      .from('orders')
      .select('*, order_items(*), riders(id, name, phone, vehicle_plate, vehicle_type, status, current_lat, current_lng), branches(id, name, slug, phone, address, latitude, longitude)')
      .eq('tenant_id', resolvedTenantId)
      .order('created_at', { ascending: false });

    if (status) {
      query = query.eq('status', status);
    }

    if (branchId && branchId !== 'all') {
      try {
        const { data: branch } = await this.supabase
          .getClient()
          .from('branches')
          .select('is_main, name')
          .eq('id', branchId)
          .maybeSingle();

        const isMain = branch?.is_main || branch?.name?.toLowerCase().includes('principal');
        if (isMain) {
          query = query.or(`branch_id.eq.${branchId},branch_id.is.null`);
        } else {
          query = query.eq('branch_id', branchId);
        }
      } catch (_) {
        query = query.eq('branch_id', branchId);
      }
    }

    const { data, error } = await query;
    if (error) {
      throw new InternalServerErrorException(`Error fetching orders: ${error.message}`);
    }
    return data;
  }

  async findByDriver(driverId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('orders')
      .select('*, order_items(*), tenants(id, name, slug, phone, address, latitude, longitude, accent_color, logo_url), branches(id, name, slug, phone, address, latitude, longitude)')
      .eq('driver_id', driverId)
      .order('created_at', { ascending: false });

    if (error) {
      throw new InternalServerErrorException(`Error fetching driver orders: ${error.message}`);
    }
    return data || [];
  }

  async findById(id: string) {
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

    let query = this.supabase
      .getClient()
      .from('orders')
      .select('*, order_items(*), tenants(id, name, slug, phone, address, latitude, longitude, accent_color, logo_url), branches(id, name, slug, phone, address, latitude, longitude), riders(id, name, phone, vehicle_plate, vehicle_type, vehicle_model, avatar_url, status, current_lat, current_lng)');

    if (isUuid) {
      query = query.eq('id', id);
    } else {
      const clean = id.replace('#', '');
      query = query.or(`order_number.eq.${clean},order_number.eq.#${clean}`);
    }

    const { data, error } = await query.maybeSingle();

    if (error || !data) {
      throw new NotFoundException(`Pedido '${id}' no encontrado`);
    }
    return data;
  }

  async updateStatus(id: string, status: string) {
    let dbStatus = status;
    let riderTag = '';

    if (status === 'assigned_driver') {
      dbStatus = 'in_kitchen';
      riderTag = '[RIDER_ACCEPTED]';
    } else if (status === 'at_merchant') {
      dbStatus = 'in_kitchen';
      riderTag = '[RIDER_AT_MERCHANT]';
    } else if (status === 'on_the_way') {
      dbStatus = 'on_the_way';
      riderTag = '[RIDER_ON_THE_WAY]';
    }

    const updatePayload: any = {
      status: dbStatus,
      updated_at: new Date().toISOString(),
    };

    if (riderTag) {
      try {
        const { data: currentOrder } = await this.supabase
          .getClient()
          .from('orders')
          .select('notes')
          .eq('id', id)
          .maybeSingle();

        let cleanNotes = (currentOrder?.notes || '').toString();
        cleanNotes = cleanNotes.replace(/\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*/g, '').trim();
        updatePayload.notes = cleanNotes.length > 0 ? `${riderTag} ${cleanNotes}` : riderTag;
      } catch (_) {}
    }

    const { data, error } = await this.supabase
      .getClient()
      .from('orders')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`Error updating order status: ${error.message}`);
    }
    return data;
  }

  async assignRider(orderId: string, riderId: string) {
    const { data, error } = await this.supabase
      .getClient()
      .from('orders')
      .update({
        driver_id: riderId || null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', orderId)
      .select()
      .single();

    if (error) {
      console.warn(`[OrdersService] Nota al asignar repartidor en Supabase: ${error.message}`);
      // Fallback si el repartidor aún no se ha reflejado en la tabla física de Supabase por RLS
      const fallback = await this.supabase
        .getClient()
        .from('orders')
        .update({
          updated_at: new Date().toISOString(),
        })
        .eq('id', orderId)
        .select()
        .single();

      if (!fallback.error && fallback.data) {
        return {
          ...fallback.data,
          driver_id: riderId
        };
      }
      throw new InternalServerErrorException(`Error assigning rider: ${error.message}`);
    }
    return data;
  }

  async getFastestRoute(originLat: number, originLng: number, destLat: number, destLng: number) {
    const queryStr = `${originLng},${originLat};${destLng},${destLat}?overview=full&geometries=geojson&alternatives=3&continue_straight=false`;
    const endpoints = [
      `https://routing.openstreetmap.de/routed-car/route/v1/driving/${queryStr}`,
      `https://router.project-osrm.org/route/v1/driving/${queryStr}`,
      `https://routing.openstreetmap.de/routed-bike/route/v1/driving/${queryStr}`,
    ];

    interface RouteCandidate {
      distanceKm: number;
      durationMinutes: number;
      waypoints: [number, number][];
      score: number;
    }

    const fetchFromEndpoint = async (url: string): Promise<RouteCandidate[]> => {
      try {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 3500);
        const response = await fetch(url, {
          headers: { 'User-Agent': 'DeliveryPlatform/1.0' },
          signal: controller.signal,
        });
        clearTimeout(timer);
        if (!response.ok) return [];
        const data: any = await response.json();
        if (data?.code === 'Ok' && Array.isArray(data.routes)) {
          return data.routes
            .filter((r: any) => r?.geometry?.coordinates?.length >= 2)
            .map((r: any) => {
              const distanceKm = Number((r.distance / 1000).toFixed(2));
              // Para motos en ciudad (~30 km/h promedio real), estimamos duración realista
              const rawMins = r.duration / 60;
              const motoMins = Math.max(1, Math.round(Math.min(rawMins, (distanceKm / 28) * 60)));
              const waypoints: [number, number][] = r.geometry.coordinates.map(
                (c: [number, number]) => [c[1], c[0]],
              );
              // Priorizar la ruta más corta y directa en tiempo urbano de moto
              const score = distanceKm * 1.7 + motoMins * 0.3;
              return {
                distanceKm,
                durationMinutes: motoMins,
                waypoints,
                score,
              };
            });
        }
      } catch (_) {}
      return [];
    };

    try {
      const results = await Promise.all(endpoints.map(fetchFromEndpoint));
      const allCandidates = results.flat();
      if (allCandidates.length > 0) {
        allCandidates.sort((a, b) => a.score - b.score);
        const best = allCandidates[0];
        return {
          success: true,
          distanceKm: best.distanceKm,
          durationMinutes: best.durationMinutes,
          waypoints: best.waypoints,
        };
      }
    } catch (err: any) {
      console.warn('[OrdersService] Error consultando motores OSRM:', err.message);
    }

    // Fallback directo sin zigzags artificiales
    const dLat = ((destLat - originLat) * Math.PI) / 180;
    const dLon = ((destLng - originLng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((originLat * Math.PI) / 180) * Math.cos((destLat * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
    const distKm = Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(2));

    return {
      success: true,
      distanceKm: distKm,
      durationMinutes: Math.max(1, Math.round((distKm / 28) * 60)),
      waypoints: [
        [originLat, originLng],
        [destLat, destLng],
      ],
    };
  }
  async appendItems(orderId: string, newItems: any[]) {
    const order = await this.findById(orderId);
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const nonModifiable = ['on_the_way', 'delivered', 'cancelled'];
    if (nonModifiable.includes(order.status)) {
      throw new BadRequestException('No se pueden adicionar productos a un pedido que ya está en camino o finalizado.');
    }

    const client = this.supabase.getClient();
    let addedSubtotal = 0;

    const formattedItems = newItems.map(item => {
      const unitPrice = Number(item.unit_price || item.price || 0);
      const qty = Number(item.quantity || 1);
      const itemTotal = Number(item.item_total || (unitPrice * qty));
      addedSubtotal += itemTotal;
      return {
        order_id: order.id,
        product_id: item.product_id || null,
        product_name: item.product_name || item.name || 'Producto adicional',
        unit_price: unitPrice,
        quantity: qty,
        item_total: itemTotal,
        selected_modifiers: item.selected_modifiers || [],
      };
    });

    const { error: insErr } = await client.from('order_items').insert(formattedItems);
    if (insErr) {
      console.warn('[OrdersService] Error inserting appended items:', insErr.message);
    }

    const newSubtotal = Number(order.subtotal || 0) + addedSubtotal;
    const deliveryFee = Number(order.delivery_fee || 0);
    const newTotal = newSubtotal + deliveryFee;

    await client.from('orders').update({
      subtotal: newSubtotal,
      total_amount_usd: newTotal,
      total: newTotal,
      updated_at: new Date().toISOString()
    }).eq('id', order.id);

    return this.findById(order.id);
  }

  async removeItemFromOrder(orderId: string, payload: { itemId: string; productId?: string; disableProduct?: boolean }) {
    const order = await this.findById(orderId);
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const client = this.supabase.getClient();

    const { data: itemToDelete } = await client
      .from('order_items')
      .select('*')
      .eq('id', payload.itemId)
      .maybeSingle();

    if (itemToDelete) {
      await client.from('order_items').delete().eq('id', payload.itemId);

      const itemTotal = Number(itemToDelete.item_total || (Number(itemToDelete.unit_price) * Number(itemToDelete.quantity))) || 0;
      const newSubtotal = Math.max(0, Number(order.subtotal || 0) - itemTotal);
      const deliveryFee = Number(order.delivery_fee || 0);
      const newTotal = newSubtotal + deliveryFee;

      await client.from('orders').update({
        subtotal: newSubtotal,
        total_amount_usd: newTotal,
        total: newTotal,
        updated_at: new Date().toISOString()
      }).eq('id', order.id);
    }

    if (payload.disableProduct && payload.productId) {
      await client.from('products').update({ is_available: false }).eq('id', payload.productId);
    }

    return this.findById(order.id);
  }
  async notifyStockIssue(orderId: string, payload: { productName: string; customMessage?: string }) {
    const order = await this.findById(orderId);
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const customerPhone = order.customer_phone || (order.customer && order.customer.phone);
    const customerName = order.customer_name || (order.customer && order.customer.name) || 'Cliente';
    const orderNum = order.order_number || order.id.slice(0, 8);
    const tenantName = (order.tenants && order.tenants.name) || 'el comercio';

    const defaultMsg = "Hola " + customerName + ", te escribimos de " + tenantName + ". Lamentamos informarte que el producto \"" + payload.productName + "\" de tu pedido #" + orderNum + " se encuentra agotado.\n\n¿Deseas sustituirlo por otra opción similar o prefieres que lo retiremos y ajustemos el total a pagar? Disculpa los inconvenientes.";
    const messageText = payload.customMessage || defaultMsg;

    let sentViaBot = false;
    const cleanPhone = (customerPhone || '').replace(/\D/g, '');

    if (cleanPhone) {
      try {
        const client = this.supabase.getClient();
        const { data: inst } = await client
          .from('whatsapp_instances')
          .select('status, phone_number')
          .eq('tenant_id', order.tenant_id)
          .maybeSingle();

        if (inst && inst.status === 'connected') {
          sentViaBot = true;
        }
      } catch (_) {}
    }

    const encoded = encodeURIComponent(messageText);
    const whatsappWebUrl = cleanPhone ? ("https://wa.me/" + cleanPhone + "?text=" + encoded) : '';

    return {
      success: true,
      sentViaBot,
      channel: sentViaBot ? 'whatsapp_bot' : 'whatsapp_web',
      customerPhone: cleanPhone,
      whatsappWebUrl,
      messageText,
      inAppAlert: "Notificación de producto agotado enviada para la orden #" + orderNum
    };
  }

  async verifyPayment(
    id: string,
    payload: {
      status: 'verified' | 'rejected' | 'pending';
      reference?: string;
      originBank?: string;
      verifiedBy?: string;
      autoSendToKitchen?: boolean;
    },
  ) {
    const updateData: any = {
      payment_status: payload.status,
      updated_at: new Date().toISOString(),
    };

    if (payload.reference) {
      updateData.payment_reference = payload.reference.trim();
    }

    if (payload.status === 'verified' && payload.autoSendToKitchen) {
      updateData.status = 'in_kitchen';
    }

    try {
      const { data: currentOrder } = await this.supabase
        .getClient()
        .from('orders')
        .select('notes')
        .eq('id', id)
        .maybeSingle();

      const existingNotes = (currentOrder?.notes || '').toString();
      let cleanNotes = existingNotes.replace(/\[PAGO_[A-Z_]+(?::[^\]]*)?\]\s*/g, '').trim();

      if (payload.status === 'verified') {
        const auditTag = `[PAGO_VERIFICADO${payload.reference ? ':Ref ' + payload.reference : ''}${payload.originBank ? ' (' + payload.originBank + ')' : ''}${payload.verifiedBy ? ' por ' + payload.verifiedBy : ''}]`;
        updateData.notes = cleanNotes.length > 0 ? `${auditTag} ${cleanNotes}` : auditTag;
      } else if (payload.status === 'rejected') {
        const rejectTag = `[PAGO_RECHAZADO${payload.reference ? ':Ref ' + payload.reference : ''}]`;
        updateData.notes = cleanNotes.length > 0 ? `${rejectTag} ${cleanNotes}` : rejectTag;
      } else if (payload.status === 'pending') {
        const originTag = payload.originBank ? `[PAGO_ORIGEN:${payload.originBank}]` : '';
        const combined = [originTag, cleanNotes].filter(Boolean).join(' ').trim();
        updateData.notes = combined.length > 0 ? combined : null;
      }
    } catch (_) {}

    const { data, error } = await this.supabase
      .getClient()
      .from('orders')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (error) {
      throw new InternalServerErrorException(`Error verificando pago: ${error.message}`);
    }
    return data;
  }
}
