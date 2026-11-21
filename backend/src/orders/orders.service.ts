import { Injectable, NotFoundException, InternalServerErrorException, BadRequestException } from '@nestjs/common';
import * as crypto from 'crypto';
import { SupabaseService } from '../supabase/supabase.service.js';
import { PlansService } from '../plans/plans.service.js';
import { NotificationsService } from '../notifications/notifications.service.js';
import { BranchesService } from '../branches/branches.service.js';

@Injectable()
export class OrdersService {
  constructor(
    private supabase: SupabaseService,
    private plansService: PlansService,
    private notificationsService: NotificationsService,
    private branchesService: BranchesService,
  ) {}

  private generateRandomPin(orderNumber: string): string {
    const orderDigits = (orderNumber || '').replace(/\D/g, '').slice(-4).padStart(4, '0');
    let pin = String(crypto.randomInt(1000, 10000));
    while (pin === orderDigits || pin === '1234' || pin === '0000') {
      pin = String(crypto.randomInt(1000, 10000));
    }
    return pin;
  }

  async create(orderPayload: any) {
    if (!orderPayload) {
      throw new BadRequestException('El cuerpo de la solicitud no puede estar vacío.');
    }

    // Validación rigurosa de inputs del cliente
    const customerName = String(orderPayload.customer_name || orderPayload.customerName || '').trim();
    if (customerName.length < 2) {
      throw new BadRequestException('El nombre del cliente es obligatorio (mínimo 2 caracteres).');
    }

    const customerPhone = String(orderPayload.customer_phone || orderPayload.customerPhone || '').trim();
    if (customerPhone.length < 8) {
      throw new BadRequestException('El número de teléfono móvil del cliente es obligatorio.');
    }

    const isDelivery = (orderPayload.fulfillment_type || orderPayload.fulfillmentType || 'delivery') === 'delivery';
    const deliveryAddress = String(orderPayload.delivery_address || orderPayload.deliveryAddress || '').trim();
    if (isDelivery && deliveryAddress.length < 4) {
      throw new BadRequestException('La dirección de entrega es obligatoria para pedidos con delivery.');
    }

    const rawItems = orderPayload.items;
    if (!Array.isArray(rawItems) || rawItems.length === 0) {
      throw new BadRequestException('El pedido debe incluir al menos un producto.');
    }

    const rawTotal = Number(orderPayload.total || 0);
    if (isNaN(rawTotal) || rawTotal < 0) {
      throw new BadRequestException('El monto total del pedido es inválido o negativo.');
    }

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

    // Validar que la sucursal tenga métodos de pago activos y configurados
    if (resolvedBranchId) {
      try {
        const branchData = await this.branchesService.findById(resolvedBranchId);
        if (!this.branchesService.hasValidPaymentMethods(branchData)) {
          throw new BadRequestException('El comercio seleccionado no tiene métodos de pago configurados y no puede recibir pedidos en este momento.');
        }

        const pMethod = orderPayload.payment_method || 'mobile_transfer';
        if (pMethod === 'mobile_transfer' || pMethod === 'pago_movil') {
          const pmCreds = branchData.paymentCredentials || branchData.payment_credentials;
          const pmPhone = String(pmCreds?.pagoMovilPhone || '').replace(/\D/g, '');
          const pmBank = String(pmCreds?.pagoMovilBank || '').trim();
          const pmId = String(pmCreds?.pagoMovilIdNumber || '').replace(/\D/g, '');
          const isReal = pmBank.length >= 2 && pmPhone.length >= 10 && pmId.length >= 5 &&
            !pmPhone.includes('1234567') && pmPhone !== '04140000000' && pmPhone !== '04121234567' &&
            !pmId.includes('50123456') && !pmId.includes('12345678') && pmId !== '00000000';
          if (!isReal) {
            throw new BadRequestException('El comercio seleccionado no tiene configurados los datos de Pago Móvil para recibir pagos.');
          }
        }
      } catch (err: any) {
        if (err instanceof BadRequestException) {
          throw err;
        }
        // Si no se pudo obtener detalles por error de red pero la sucursal existe, continuar con resiliencia
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
    const paymentReference = orderHeader.payment_reference ? String(orderHeader.payment_reference).trim() : null;
    if (isPagoMovil && orderHeader.source !== 'merchant_manual') {
      if (!paymentReference || paymentReference.length < 4) {
        throw new BadRequestException('Debes ingresar el número de referencia del Pago Móvil (mínimo 4 dígitos).');
      }
    }
    const paymentOriginBank = orderHeader.payment_origin_bank || null;
    let finalNotes = (orderHeader.notes || '').toString();
    if (paymentOriginBank && !finalNotes.includes('[PAGO_ORIGEN:')) {
      finalNotes = `[PAGO_ORIGEN:${paymentOriginBank}] ${finalNotes}`.trim();
    }
    const orderDigits = orderNumber.replace(/\D/g, '').slice(-4).padStart(4, '0');
    const explicitPin = String(orderHeader.delivery_pin || orderHeader.deliveryPin || '').trim();
    const existingPinMatch = finalNotes.match(/\[PIN:(\d{4})\]/);
    let resolvedPin = '';
    if (/^\d{4}$/.test(explicitPin) && explicitPin !== orderDigits && explicitPin !== '1234' && explicitPin !== '0000') {
      resolvedPin = explicitPin;
    } else if (existingPinMatch && existingPinMatch[1] !== orderDigits && existingPinMatch[1] !== '1234' && existingPinMatch[1] !== '0000') {
      resolvedPin = existingPinMatch[1];
    } else {
      resolvedPin = this.generateRandomPin(orderNumber);
    }

    if (existingPinMatch) {
      finalNotes = finalNotes.replace(/\[PIN:\d{4}\]/, `[PIN:${resolvedPin}]`).trim();
    } else {
      finalNotes = `[PIN:${resolvedPin}] ${finalNotes}`.trim();
    }

    // Resolver tasa de cambio oficial/referencial del momento del pedido
    let exchangeRate = Number(orderHeader.exchange_rate) || 0;
    if (!exchangeRate && resolvedBranchId) {
      try {
        const { data: bData } = await client.from('branches').select('exchange_rate').eq('id', resolvedBranchId).maybeSingle();
        if (bData?.exchange_rate) {
          exchangeRate = Number(bData.exchange_rate);
        }
      } catch (_) {}
    }
    if (!exchangeRate && resolvedTenantId) {
      try {
        const { data: tData } = await client.from('tenants').select('exchange_rate').eq('id', resolvedTenantId).maybeSingle();
        if (tData?.exchange_rate) {
          exchangeRate = Number(tData.exchange_rate);
        }
      } catch (_) {}
    }
    if (!exchangeRate) {
      exchangeRate = 45.50; // Fallback predeterminado
    }

    const subtotalBs = Number(orderHeader.subtotal_bs) || Number((subtotal * exchangeRate).toFixed(2));
    const deliveryFeeBs = Number(orderHeader.delivery_fee_bs) || Number((deliveryFee * exchangeRate).toFixed(2));
    const discountBs = Number(orderHeader.discount_bs) || Number((discount * exchangeRate).toFixed(2));
    const totalBs = Number(orderHeader.total_bs) || Number((total * exchangeRate).toFixed(2));
    const currency = orderHeader.currency || 'USD';

    // Inmutable histórico: dejamos una huella [FX:...] en las notas como salvaguarda
    if (!finalNotes.includes('[FX:')) {
      finalNotes = `[FX:rate=${exchangeRate.toFixed(2)}|total_bs=${totalBs.toFixed(2)}|delivery_bs=${deliveryFeeBs.toFixed(2)}|subtotal_bs=${subtotalBs.toFixed(2)}] ${finalNotes}`.trim();
    }

    // 1. Insert order header
    const insertPayload: any = {
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
      exchange_rate: exchangeRate,
      currency: currency,
      subtotal_bs: subtotalBs,
      delivery_fee_bs: deliveryFeeBs,
      discount_bs: discountBs,
      total_bs: totalBs,
    };

    let { data: newOrder, error: orderErr } = await client
      .from('orders')
      .insert(insertPayload)
      .select()
      .single();

    if (orderErr && (orderErr.code === '42703' || orderErr.message?.includes('exchange_rate') || orderErr.message?.includes('total_bs'))) {
      console.warn(`[OrdersService] orders table missing currency columns, inserting base columns: ${orderErr.message}`);
      delete insertPayload.exchange_rate;
      delete insertPayload.currency;
      delete insertPayload.subtotal_bs;
      delete insertPayload.delivery_fee_bs;
      delete insertPayload.discount_bs;
      delete insertPayload.total_bs;
      const retry = await client.from('orders').insert(insertPayload).select().single();
      newOrder = retry.data;
      orderErr = retry.error;
    }

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
    return (data || []).map((order: any) => this.enrichOrderCurrency(order));
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
    return (data || []).map((order: any) => this.enrichOrderCurrency(order));
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
    return this.enrichOrderCurrency(data);
  }

  private enrichOrderCurrency(order: any): any {
    if (!order) return order;
    const rawNotes = (order.notes || '').toString();
    const fxMatch = rawNotes.match(/\[FX:rate=([0-9.]+)\|total_bs=([0-9.]+)(?:\|delivery_bs=([0-9.]+))?(?:\|subtotal_bs=([0-9.]+))?\]/);

    const exchangeRate = Number(order.exchange_rate ?? fxMatch?.[1]) || null;
    const totalBs = Number(order.total_bs ?? fxMatch?.[2]) || (exchangeRate && Number(order.total) ? Number((Number(order.total) * exchangeRate).toFixed(2)) : null);
    const deliveryFeeBs = Number(order.delivery_fee_bs ?? fxMatch?.[3]) || (exchangeRate && order.delivery_fee !== undefined ? Number((Number(order.delivery_fee) * exchangeRate).toFixed(2)) : null);
    const subtotalBs = Number(order.subtotal_bs ?? fxMatch?.[4]) || (exchangeRate && order.subtotal !== undefined ? Number((Number(order.subtotal) * exchangeRate).toFixed(2)) : null);
    const discountBs = Number(order.discount_bs) || (exchangeRate && order.discount ? Number((Number(order.discount) * exchangeRate).toFixed(2)) : null);

    return {
      ...order,
      exchange_rate: exchangeRate,
      currency: order.currency || 'USD',
      total_bs: totalBs,
      delivery_fee_bs: deliveryFeeBs,
      subtotal_bs: subtotalBs,
      discount_bs: discountBs,
    };
  }

  async updateStatus(id: string, status: string) {
    const semanticStatus = String(status || '').trim().toLowerCase();
    let dbStatus = semanticStatus;
    let riderTag = '';
    let shouldCleanRiderTags = false;

    if (semanticStatus === 'assigned_driver' || semanticStatus === 'rider_accepted') {
      dbStatus = 'in_kitchen';
      riderTag = '[RIDER_ACCEPTED]';
    } else if (semanticStatus === 'at_merchant') {
      dbStatus = 'in_kitchen';
      riderTag = '[RIDER_AT_MERCHANT]';
    } else if (semanticStatus === 'picked_up') {
      dbStatus = 'in_kitchen';
      riderTag = '[RIDER_PICKED_UP]';
    } else if (semanticStatus === 'on_the_way' || semanticStatus === 'on_way' || semanticStatus === 'dispatched') {
      dbStatus = 'on_the_way';
      riderTag = '[RIDER_ON_THE_WAY]';
    } else if (semanticStatus === 'delivered' || semanticStatus === 'cancelled') {
      shouldCleanRiderTags = true;
    }

    const updatePayload: any = {
      status: dbStatus,
      updated_at: new Date().toISOString(),
    };

    if (riderTag || shouldCleanRiderTags) {
      try {
        const { data: currentOrder, error: fetchErr } = await this.supabase
          .getClient()
          .from('orders')
          .select('notes')
          .eq('id', id)
          .maybeSingle();

        if (!fetchErr && currentOrder) {
          const cleanNotes = (currentOrder.notes || '')
            .toString()
            .replace(/\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*/g, '')
            .trim();
          if (riderTag) {
            updatePayload.notes = cleanNotes.length > 0 ? `${riderTag} ${cleanNotes}` : riderTag;
          } else {
            updatePayload.notes = cleanNotes.length > 0 ? cleanNotes : null;
          }
        }
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

    // Disparar Push Notification al cliente con el estado semántico exacto
    try {
      this.notificationsService.notifyOrderStatus(data || { id, status: dbStatus }, semanticStatus);
    } catch (_) {}

    // Registro automático y transparente en el Libro de Comisiones y Reparto al entregarse el pedido
    if (dbStatus === 'delivered' && data) {
      const deliveryFee = Number(data.delivery_fee) || 0;
      if (deliveryFee > 0 || data.driver_id) {
        this.plansService.recordDeliveryCommission({
          order_id: data.id,
          order_number: data.order_number || `#ORD-${data.id.slice(0, 5)}`,
          tenant_id: data.tenant_id,
          branch_id: data.branch_id,
          rider_id: data.driver_id,
          delivery_fee: deliveryFee
        });
      }
    }

    return data;
  }

  async assignRider(orderId: string, riderId: string) {
    if (riderId) {
      const sb = this.supabase.getClient();
      // 1. Validar que el motorizado no esté desconectado (offline)
      const { data: rider } = await sb.from('riders').select('id, name, status').eq('id', riderId).maybeSingle();
      if (rider && rider.status === 'offline') {
        throw new BadRequestException(`El motorizado ${rider.name || ''} está desconectado (offline) y no puede recibir pedidos.`);
      }

      // 2. Validar que el motorizado no tenga ya una orden en reparto activo
      const { data: busyOrder } = await sb
        .from('orders')
        .select('id, order_number')
        .eq('driver_id', riderId)
        .neq('id', orderId)
        .in('status', ['assigned_driver', 'at_merchant', 'picked_up', 'on_the_way'])
        .limit(1)
        .maybeSingle();

      if (busyOrder) {
        throw new BadRequestException(`El motorizado ${rider?.name || ''} ya tiene una orden en reparto activo (${busyOrder.order_number}). Debe completarla antes de ser reasignado.`);
      }
    }

    const updateObj: any = {
      driver_id: riderId || null,
      updated_at: new Date().toISOString(),
    };

    try {
      const { data: currentOrder, error: fetchErr } = await this.supabase
        .getClient()
        .from('orders')
        .select('notes')
        .eq('id', orderId)
        .maybeSingle();

      if (!fetchErr && currentOrder) {
        const cleanNotes = (currentOrder.notes || '')
          .toString()
          .replace(/\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*/g, '')
          .trim();
        updateObj.notes = cleanNotes.length > 0 ? cleanNotes : null;
      }
    } catch (_) {}

    const { data, error } = await this.supabase
      .getClient()
      .from('orders')
      .update(updateObj)
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
        const resObj = {
          ...fallback.data,
          driver_id: riderId
        };
        try {
          this.notificationsService.notifyRiderAssigned(resObj, riderId);
        } catch (_) {}
        return resObj;
      }
      throw new InternalServerErrorException(`Error assigning rider: ${error.message}`);
    }

    try {
      this.notificationsService.notifyRiderAssigned(data, riderId);
    } catch (_) {}

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
  async appendItems(orderId: string, bodyOrItems: any) {
    const newItems: any[] = Array.isArray(bodyOrItems)
      ? bodyOrItems
      : Array.isArray(bodyOrItems?.items)
        ? bodyOrItems.items
        : [];

    if (!Array.isArray(newItems) || newItems.length === 0) {
      throw new BadRequestException('Debes seleccionar al menos un producto adicional.');
    }

    const paymentMethod: 'cash' | 'mobile_transfer' =
      !Array.isArray(bodyOrItems) && bodyOrItems?.paymentMethod === 'mobile_transfer'
        ? 'mobile_transfer'
        : 'cash';
    const paymentReference =
      !Array.isArray(bodyOrItems) && bodyOrItems?.paymentReference
        ? String(bodyOrItems.paymentReference).trim()
        : '';
    const paymentOriginBank =
      !Array.isArray(bodyOrItems) && bodyOrItems?.paymentOriginBank
        ? String(bodyOrItems.paymentOriginBank).trim()
        : '';

    if (paymentMethod === 'mobile_transfer' && paymentReference.length < 4) {
      throw new BadRequestException('Por favor ingresa los últimos dígitos de la referencia de Pago Móvil.');
    }

    const order = await this.findById(orderId);
    if (!order) throw new NotFoundException('Pedido no encontrado');

    const nonModifiable = ['picked_up', 'on_the_way', 'delivered', 'cancelled'];
    if (nonModifiable.includes(order.status)) {
      throw new BadRequestException('No se pueden adicionar productos a un pedido que ya fue recogido, está en camino o finalizado.');
    }

    const client = this.supabase.getClient();
    const isUuid = (val?: string) =>
      Boolean(val && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(val));

    let exchangeRate = Number(order.exchange_rate) || 0;
    const rawNotes = (order.notes || '').toString();
    if (!exchangeRate) {
      const fxMatch = rawNotes.match(/\[FX:rate=([0-9.]+)/);
      if (fxMatch) exchangeRate = Number(fxMatch[1]) || 0;
    }
    if (!exchangeRate && order.branch_id) {
      try {
        const { data: bData } = await client
          .from('branches')
          .select('exchange_rate')
          .eq('id', order.branch_id)
          .maybeSingle();
        if (bData?.exchange_rate) exchangeRate = Number(bData.exchange_rate) || 0;
      } catch (_) {}
    }
    if (!exchangeRate && order.tenant_id) {
      try {
        const { data: tData } = await client
          .from('tenants')
          .select('exchange_rate')
          .eq('id', order.tenant_id)
          .maybeSingle();
        if (tData?.exchange_rate) exchangeRate = Number(tData.exchange_rate) || 0;
      } catch (_) {}
    }

    let addedSubtotal = 0;
    const summaryParts: string[] = [];

    const formattedItems = newItems.map(item => {
      const unitPrice = Number(item.unit_price ?? item.price ?? 0);
      const qty = Math.max(1, Number(item.quantity ?? 1));
      const itemTotal = Number(item.item_total ?? unitPrice * qty);
      addedSubtotal += itemTotal;

      const baseName = String(item.product_name || item.name || 'Producto adicional').trim();
      const displayBaseName = baseName.replace(/\s*\(Adici[oó]n\)\s*$/i, '').trim();
      summaryParts.push(`${qty}x ${displayBaseName}`);

      const productNameWithTag = baseName.includes('(Adición)') ? baseName : `${baseName} (Adición)`;
      const rawModifiers = Array.isArray(item.selected_modifiers) ? [...item.selected_modifiers] : [];
      const hasAddMod = rawModifiers.some((m: any) =>
        String(m?.name || m?.optionName || '').toLowerCase().includes('adici'),
      );
      if (!hasAddMod) {
        rawModifiers.push({ name: 'Adición posterior', price: 0 });
      }

      return {
        order_id: order.id,
        product_id: isUuid(item.product_id) ? item.product_id : null,
        product_name: productNameWithTag,
        unit_price: unitPrice,
        quantity: qty,
        item_total: Number(itemTotal.toFixed(2)),
        selected_modifiers: rawModifiers,
      };
    });

    addedSubtotal = Number(addedSubtotal.toFixed(2));

    const { error: insErr } = await client.from('order_items').insert(formattedItems);
    if (insErr) {
      throw new InternalServerErrorException(`Error insertando productos adicionales: ${insErr.message}`);
    }

    const newSubtotal = Number((Number(order.subtotal || 0) + addedSubtotal).toFixed(2));
    const deliveryFee = Number(order.delivery_fee || 0);
    const discount = Number(order.discount || 0);
    const newTotal = Number(Math.max(0, newSubtotal + deliveryFee - discount).toFixed(2));

    const rate = exchangeRate > 1 ? exchangeRate : 0;
    const extraBs = rate > 1 ? Number((addedSubtotal * rate).toFixed(2)) : 0;
    const newSubtotalBs = rate > 1 ? Number((newSubtotal * rate).toFixed(2)) : null;
    const newTotalBs = rate > 1 ? Number((newTotal * rate).toFixed(2)) : null;

    const appendSummary = summaryParts.join(', ');
    const bsText = extraBs > 0 ? ` (Bs. ${extraBs.toFixed(2)})` : '';
    const bankSegment = paymentOriginBank ? ` | Banco: ${paymentOriginBank}` : '';
    const additionTag =
      paymentMethod === 'mobile_transfer'
        ? `[ADICIONAL: ${appendSummary} | +$${addedSubtotal.toFixed(2)}${bsText} | Método: Pago Móvil${bankSegment} | Ref: ${paymentReference} | Estado: Pendiente de Verificación]`
        : `[ADICIONAL: ${appendSummary} | +$${addedSubtotal.toFixed(2)}${bsText} | Método: Efectivo al Recibir]`;

    let updatedNotes = rawNotes;
    if (rate > 1 && newSubtotalBs !== null && newTotalBs !== null) {
      const fxRegex = /\[FX:rate=[0-9.]+\|total_bs=[0-9.]+(?:\|delivery_bs=([0-9.]+))?(?:\|subtotal_bs=[0-9.]+)?\]/;
      const existingFx = updatedNotes.match(fxRegex);
      if (existingFx) {
        const delivBs = existingFx[1] || Number((deliveryFee * rate).toFixed(2)).toFixed(2);
        const newFxTag = `[FX:rate=${rate.toFixed(2)}|total_bs=${newTotalBs.toFixed(2)}|delivery_bs=${delivBs}|subtotal_bs=${newSubtotalBs.toFixed(2)}]`;
        updatedNotes = updatedNotes.replace(fxRegex, newFxTag);
      }
    }
    updatedNotes = updatedNotes.trim().length > 0 ? `${updatedNotes.trim()}\n${additionTag}` : additionTag;

    const nowIso = new Date().toISOString();
    const updatePayload: any = {
      subtotal: newSubtotal,
      total: newTotal,
      notes: updatedNotes,
      updated_at: nowIso,
    };
    if (newSubtotalBs !== null) updatePayload.subtotal_bs = newSubtotalBs;
    if (newTotalBs !== null) updatePayload.total_bs = newTotalBs;

    let { error: updErr } = await client.from('orders').update(updatePayload).eq('id', order.id);
    if (
      updErr &&
      (updErr.code === '42703' ||
        updErr.message?.includes('total_bs') ||
        updErr.message?.includes('subtotal_bs'))
    ) {
      delete updatePayload.subtotal_bs;
      delete updatePayload.total_bs;
      const retry = await client.from('orders').update(updatePayload).eq('id', order.id);
      updErr = retry.error;
    }

    if (updErr) {
      throw new InternalServerErrorException(`Error actualizando totales del pedido: ${updErr.message}`);
    }

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
      const { data: currentOrder, error: fetchErr } = await this.supabase
        .getClient()
        .from('orders')
        .select('notes')
        .eq('id', id)
        .maybeSingle();

      if (!fetchErr && currentOrder) {
        const existingNotes = (currentOrder.notes || '').toString();
        const cleanNotes = existingNotes.replace(/\[PAGO_[A-Z_]+(?::[^\]]*)?\]\s*/g, '').trim();
        const originBank = payload.originBank || existingNotes.match(/\[PAGO_ORIGEN:([^\]]+)\]/)?.[1];

        if (payload.status === 'verified') {
          const auditTag = `[PAGO_VERIFICADO${payload.reference ? ':Ref ' + payload.reference : ''}${originBank ? ' (' + originBank + ')' : ''}${payload.verifiedBy ? ' por ' + payload.verifiedBy : ''}]`;
          updateData.notes = cleanNotes.length > 0 ? `${auditTag} ${cleanNotes}` : auditTag;
        } else if (payload.status === 'rejected') {
          const rejectTag = `[PAGO_RECHAZADO${payload.reference ? ':Ref ' + payload.reference : ''}]`;
          updateData.notes = cleanNotes.length > 0 ? `${rejectTag} ${cleanNotes}` : rejectTag;
        } else if (payload.status === 'pending') {
          const originTag = originBank ? `[PAGO_ORIGEN:${originBank}]` : '';
          const combined = [originTag, cleanNotes].filter(Boolean).join(' ').trim();
          updateData.notes = combined.length > 0 ? combined : null;
        }
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

  async verifyAdditionPayment(
    id: string,
    payload: {
      additionRaw: string;
      status: 'verified' | 'rejected' | 'pending';
      reference?: string;
      originBank?: string;
      verifiedBy?: string;
    },
  ) {
    const order = await this.findById(id);
    if (!order) {
      throw new NotFoundException(`Pedido '${id}' no encontrado`);
    }

    const notes: string = String(order.notes || '');
    let targetRaw = payload.additionRaw ? String(payload.additionRaw).trim() : '';

    if (!targetRaw || !notes.includes(targetRaw)) {
      const tagMatches: string[] = notes.match(/\[(?:ADICIONAL|Adición en app)[^\]]*\]/gi) || [];
      if (payload.reference) {
        const refClean = String(payload.reference).trim();
        targetRaw = tagMatches.find((t: string) => t.includes(refClean)) || '';
      }
      if (!targetRaw && tagMatches.length > 0) {
        targetRaw =
          tagMatches.find((t: string) => /pago\s*m[oó]vil/i.test(t) && !/verificado/i.test(t)) ||
          tagMatches[tagMatches.length - 1];
      }
    }

    if (!targetRaw || !notes.includes(targetRaw)) {
      throw new NotFoundException('No se encontró el registro de adicional especificado en este pedido.');
    }

    let updatedTag = targetRaw;

    if (payload.reference && payload.reference.trim().length > 0) {
      const cleanRef = payload.reference.trim();
      if (/Ref:\s*[^|\]]+/i.test(updatedTag)) {
        updatedTag = updatedTag.replace(/Ref:\s*[^|\]]+/i, `Ref: ${cleanRef}`);
      } else {
        updatedTag = updatedTag.replace(/\]$/, ` | Ref: ${cleanRef}]`);
      }
    }

    if (payload.originBank && payload.originBank.trim().length > 0) {
      const cleanBank = payload.originBank.trim();
      if (/Banco:\s*[^|\]]+/i.test(updatedTag)) {
        updatedTag = updatedTag.replace(/Banco:\s*[^|\]]+/i, `Banco: ${cleanBank}`);
      } else if (/Ref:/i.test(updatedTag)) {
        updatedTag = updatedTag.replace(/(\|\s*Ref:)/i, `| Banco: ${cleanBank} $1`);
      } else {
        updatedTag = updatedTag.replace(/\]$/, ` | Banco: ${cleanBank}]`);
      }
    }

    const statusLabel =
      payload.status === 'verified'
        ? `Verificado${payload.verifiedBy ? ` por ${payload.verifiedBy.trim()}` : ''}`
        : payload.status === 'rejected'
          ? 'Rechazado'
          : 'Pendiente de Verificación';

    if (/Estado:\s*[^|\]]+/i.test(updatedTag)) {
      updatedTag = updatedTag.replace(/Estado:\s*[^|\]]+/i, `Estado: ${statusLabel}`);
    } else {
      updatedTag = updatedTag.replace(/\]$/, ` | Estado: ${statusLabel}]`);
    }

    const updatedNotes = notes.replace(targetRaw, updatedTag);

    const { error } = await this.supabase
      .getClient()
      .from('orders')
      .update({
        notes: updatedNotes,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (error) {
      throw new InternalServerErrorException(`Error actualizando estado de adicional: ${error.message}`);
    }

    return this.findById(order.id);
  }
}
