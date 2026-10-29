import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/app_config.dart';
import 'notification_service.dart';
import '../models/order_model.dart';
import '../models/user_model.dart';

class RiderPayoutTransaction {
  final String id;
  final double amount;
  final String method; // 'Pago Móvil', 'Transferencia', 'Zelle'
  final String destinationDetails;
  final DateTime date;
  final String status; // 'Completado', 'Procesando'

  RiderPayoutTransaction({
    required this.id,
    required this.amount,
    required this.method,
    required this.destinationDetails,
    required this.date,
    this.status = 'Completado',
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'amount': amount,
        'method': method,
        'destinationDetails': destinationDetails,
        'date': date.toIso8601String(),
        'status': status,
      };

  factory RiderPayoutTransaction.fromJson(Map<String, dynamic> json) =>
      RiderPayoutTransaction(
        id: json['id'] ?? '',
        amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
        method: json['method'] ?? 'Pago Móvil',
        destinationDetails: json['destinationDetails'] ?? '',
        date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
        status: json['status'] ?? 'Completado',
      );
}

class RiderService extends ChangeNotifier {
  static final RiderService _instance = RiderService._internal();
  factory RiderService() => _instance;
  RiderService._internal();

  static const String _keyActiveOrder = 'rider_active_order_v1';
  static const String _keyAcceptedOrder = 'rider_accepted_order_v1';
  static const String _keyCompletedOrders = 'rider_completed_orders_v1';
  static const String _keyPayoutHistory = 'rider_payout_history_v1';

  DeliveryOrder? _activeOrder;
  bool _isAcceptedByRider = false;
  final List<DeliveryOrder> _availableOrders = [];
  final List<DeliveryOrder> _completedDeliveries = [];
  final List<RiderPayoutTransaction> _payoutHistory = [];
  RealtimeChannel? _ordersSubscription;
  Timer? _pollTimer;
  bool _isLoading = false;
  String? _currentRiderId;
  String? _lastNotifiedOrderId;

  DeliveryOrder? get activeOrder => _activeOrder;
  bool get hasActiveOrder => _activeOrder != null;
  bool get isAcceptedByRider => _isAcceptedByRider;
  List<DeliveryOrder> get availableOrders => List.unmodifiable(_availableOrders);
  List<DeliveryOrder> get completedDeliveries => List.unmodifiable(_completedDeliveries);
  List<RiderPayoutTransaction> get payoutHistory => List.unmodifiable(_payoutHistory);
  bool get isLoading => _isLoading;

  int get completedDeliveriesCount => _completedDeliveries.length;

  double get totalEarnings => _completedDeliveries.fold(
        0.0,
        (sum, o) => sum + o.deliveryFee,
      );

  double get totalTips => _completedDeliveries.fold(
        0.0,
        (sum, o) => sum + (o.total * 0.05), // 5% average tip
      );

  double get totalWithdrawn => _payoutHistory.fold(
        0.0,
        (sum, p) => sum + p.amount,
      );

  double get availableBalance {
    final bal = (totalEarnings + totalTips) - totalWithdrawn;
    return bal < 0.0 ? 0.0 : bal;
  }

  Future<void> init([String? riderId]) async {
    _currentRiderId = riderId;
    try {
      final prefs = await SharedPreferences.getInstance();

      if (_currentRiderId == null || _currentRiderId!.isEmpty) {
        _currentRiderId = prefs.getString('rider_user_id_v1');
        if (_currentRiderId == null || _currentRiderId!.isEmpty) {
          final riderDataJson = prefs.getString('current_rider_user_v1');
          if (riderDataJson != null) {
            try {
              final Map<String, dynamic> data = jsonDecode(riderDataJson);
              _currentRiderId = data['id']?.toString();
            } catch (_) {}
          }
        }
      }

      // Load active order if still active and not delivered/cancelled
      final activeJson = prefs.getString(_keyActiveOrder);
      if (activeJson != null) {
        final parsed = DeliveryOrder.fromJson(jsonDecode(activeJson));
        if (parsed.status != OrderDeliveryStatus.delivered && parsed.status != OrderDeliveryStatus.cancelled) {
          _activeOrder = parsed;
          final acceptedOrderId = prefs.getString(_keyAcceptedOrder);
          _isAcceptedByRider = (acceptedOrderId == _activeOrder?.id) || (_activeOrder?.status == OrderDeliveryStatus.onTheWay);
        } else {
          _activeOrder = null;
          _isAcceptedByRider = false;
          await prefs.remove(_keyActiveOrder);
          await prefs.remove(_keyAcceptedOrder);
        }
      }

      // Load completed orders
      final completedJson = prefs.getStringList(_keyCompletedOrders);
      if (completedJson != null) {
        _completedDeliveries.clear();
        for (final item in completedJson) {
          try {
            _completedDeliveries.add(DeliveryOrder.fromJson(jsonDecode(item)));
          } catch (_) {}
        }
      }

      // Load payout history
      final payoutJson = prefs.getString(_keyPayoutHistory);
      if (payoutJson != null) {
        final List list = jsonDecode(payoutJson);
        _payoutHistory.clear();
        for (final item in list) {
          _payoutHistory.add(RiderPayoutTransaction.fromJson(item));
        }
      }
    } catch (e) {
      debugPrint('[RiderService] Init error: $e');
    }

    await fetchAvailableOrders();
    _setupRealtimeSubscription();

    // Setup periodic polling fallback every 3 seconds to guarantee updates
    _pollTimer?.cancel();
    _pollTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      fetchAvailableOrders();
    });

    notifyListeners();
  }

  void _setupRealtimeSubscription() {
    try {
      final supabase = Supabase.instance.client;
      _ordersSubscription = supabase
          .channel('public:orders_rider')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'orders',
            callback: (payload) {
              debugPrint('[RiderService] Realtime order event: ${payload.eventType}');
              fetchAvailableOrders();
            },
          )
          .subscribe();
    } catch (e) {
      debugPrint('[RiderService] Realtime subscription notice: $e');
    }
  }

  DeliveryOrder _parseOrderRow(Map<String, dynamic> row) {
    final tenant = row['tenants'] as Map<String, dynamic>? ?? {};
    final branch = row['branches'] as Map<String, dynamic>? ?? {};
    final rawItems = row['order_items'] as List? ?? [];
    final items = rawItems.map((i) {
      return CartItem(
        product: Product(
          id: i['product_id'] ?? '',
          name: i['product_name'] ?? 'Producto',
          description: '',
          price: (i['unit_price'] as num?)?.toDouble() ?? 0.0,
          imageUrl: '',
          category: 'General',
        ),
        quantity: i['quantity'] ?? 1,
      );
    }).toList();

    final rawNotes = (row['notes'] ?? '').toString();
    OrderDeliveryStatus mappedStatus = _mapStatus(row['status']);
    if (row['status'] == 'in_kitchen' && row['driver_id'] != null) {
      if (rawNotes.contains('[RIDER_PICKED_UP]')) {
        mappedStatus = OrderDeliveryStatus.pickedUp;
      } else if (rawNotes.contains('[RIDER_AT_MERCHANT]')) {
        mappedStatus = OrderDeliveryStatus.atMerchant;
      } else if (rawNotes.contains('[RIDER_ACCEPTED]')) {
        mappedStatus = OrderDeliveryStatus.assigned;
      } else {
        mappedStatus = OrderDeliveryStatus.assigned;
      }
    } else if (row['status'] == 'received' && row['driver_id'] != null) {
      mappedStatus = OrderDeliveryStatus.assigned;
    }

    final resolvedMerchantName = (branch['name'] ?? '').toString().trim().isNotEmpty
        ? branch['name'].toString()
        : (tenant['name']?.toString() ?? 'Comercio Local');
    final resolvedMerchantPhone = (branch['phone'] ?? '').toString().trim().isNotEmpty
        ? branch['phone'].toString()
        : (tenant['phone']?.toString() ?? '+584121234567');
    final resolvedMerchantAddress = (branch['address'] ?? '').toString().trim().isNotEmpty
        ? branch['address'].toString()
        : (tenant['address']?.toString() ?? 'Cabudare, Edo. Lara');
    final resolvedMerchantLat = (branch['latitude'] as num?)?.toDouble() ??
        (tenant['latitude'] as num?)?.toDouble() ??
        10.026743;
    final resolvedMerchantLng = (branch['longitude'] as num?)?.toDouble() ??
        (tenant['longitude'] as num?)?.toDouble() ??
        -69.257153;

    return DeliveryOrder(
      id: row['id']?.toString() ?? '',
      orderNumber: row['order_number'] ?? 'ORD-0000',
      merchantName: resolvedMerchantName,
      merchantPhone: resolvedMerchantPhone,
      merchantAddress: resolvedMerchantAddress,
      merchantLat: resolvedMerchantLat,
      merchantLng: resolvedMerchantLng,
      customerName: row['customer_name'] ?? 'Cliente',
      customerPhone: row['customer_phone'] ?? '',
      customerAddress: row['delivery_address'] ?? 'Dirección de Entrega',
      customerLat: (row['delivery_lat'] as num?)?.toDouble() ?? 10.034574,
      customerLng: (row['delivery_lng'] as num?)?.toDouble() ?? -69.237544,
      riderName: '',
      riderPhone: '',
      riderVehicle: '',
      riderPlate: '',
      pin: () {
        final notes = (row['notes'] ?? '').toString();
        if (notes.contains('[PIN:')) {
          final m = RegExp(r'\[PIN:(\d{4})\]').firstMatch(notes);
          if (m != null) return m.group(1)!;
        }
        final orderNum = (row['order_number'] ?? '').toString();
        final digits = orderNum.replaceAll(RegExp(r'\D'), '');
        if (digits.length >= 4) {
          return digits.substring(digits.length - 4);
        }
        return row['delivery_pin']?.toString() ?? '1234';
      }(),
      status: mappedStatus,
      items: items,
      subtotal: (row['subtotal'] as num?)?.toDouble() ?? 0.0,
      deliveryFee: (row['delivery_fee'] as num?)?.toDouble() ?? 2.50,
      total: (row['total'] as num?)?.toDouble() ?? 0.0,
      paymentMethod: row['payment_method'] ?? 'Pago Móvil',
      createdAt: DateTime.tryParse(row['created_at'] ?? '') ?? DateTime.now(),
    );
  }

  Future<void> fetchAvailableOrders() async {
    _isLoading = true;
    notifyListeners();

    try {
      final supabase = Supabase.instance.client;

      // 1. Check if an order is currently assigned to this rider in Supabase
      if (_currentRiderId != null && _currentRiderId!.isNotEmpty) {
        try {
          // Query by driver_id (UUID or custom ID)
          List assignedQuery = [];
          try {
            assignedQuery = await supabase
                .from('orders')
                .select('*, tenants(*), branches(*), order_items(*)')
                .eq('driver_id', _currentRiderId!)
                .not('status', 'in', '("delivered","cancelled")')
                .order('created_at', ascending: false)
                .limit(1);
          } catch (_) {
            assignedQuery = await supabase
                .from('orders')
                .select('*, tenants(*), order_items(*)')
                .eq('driver_id', _currentRiderId!)
                .not('status', 'in', '("delivered","cancelled")')
                .order('created_at', ascending: false)
                .limit(1);
          }

          if (assignedQuery.isNotEmpty) {
            final activeRow = assignedQuery.first;
            final assignedOrder = _parseOrderRow(activeRow);
            
            // Trigger push notification if this is a newly assigned order
            final prefs = await SharedPreferences.getInstance();
            final lastNotified = prefs.getString('rider_last_notified_order_v1');
            if (_lastNotifiedOrderId != assignedOrder.id && lastNotified != assignedOrder.id) {
              _lastNotifiedOrderId = assignedOrder.id;
              await prefs.setString('rider_last_notified_order_v1', assignedOrder.id);
              NotificationService().showOrderAssignedNotification(
                orderNumber: assignedOrder.orderNumber,
                customerName: assignedOrder.customerName,
                address: assignedOrder.customerAddress,
              );
            }

            _activeOrder = assignedOrder;

            await prefs.setString(_keyActiveOrder, jsonEncode(assignedOrder.toJson()));
            final acceptedOrderId = prefs.getString(_keyAcceptedOrder);
            final rawNotes = (activeRow['notes'] ?? '').toString();
            final isAcceptedInDb = rawNotes.contains('[RIDER_ACCEPTED]') ||
                rawNotes.contains('[RIDER_AT_MERCHANT]') ||
                rawNotes.contains('[RIDER_PICKED_UP]') ||
                assignedOrder.status == OrderDeliveryStatus.onTheWay;

            _isAcceptedByRider = isAcceptedInDb || (acceptedOrderId == assignedOrder.id);
          } else {
            // No active orders assigned in database: clear local cache and banner
            if (_activeOrder != null) {
              final prefs = await SharedPreferences.getInstance();
              await prefs.remove(_keyActiveOrder);
              await prefs.remove(_keyAcceptedOrder);
              _activeOrder = null;
              _isAcceptedByRider = false;
            }
          }
        } catch (e) {
          debugPrint('[RiderService] Notice checking assigned order: $e');
        }
      }

      // 2. In this merchant fleet dispatch model, orders are strictly assigned by the merchant to riders.
      // Unassigned orders (driver_id == null) in kitchen or received must NEVER be broadcast to riders.
      // Only additional queued orders assigned to this rider (if any beyond the active one) are shown.
      if (_currentRiderId != null && _currentRiderId!.isNotEmpty && _activeOrder != null) {
        final query = await supabase
            .from('orders')
            .select('*, tenants(*), order_items(*)')
            .eq('driver_id', _currentRiderId!)
            .not('status', 'in', '("delivered","cancelled")')
            .neq('id', _activeOrder!.id)
            .order('created_at', ascending: false)
            .limit(10);

        final List<DeliveryOrder> fetched = [];
        for (final row in (query as List)) {
          fetched.add(_parseOrderRow(row));
        }
        _availableOrders.clear();
        _availableOrders.addAll(fetched);
      } else {
        _availableOrders.clear();
      }
    } catch (e) {
      debugPrint('[RiderService] Error fetching available orders: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
  }

  Future<bool> acceptOrder(DeliveryOrder order, RiderUser rider) async {
    try {
      final supabase = Supabase.instance.client;

      // Preserve existing customer instructions and append [RIDER_ACCEPTED]
      String notes = '';
      try {
        final currentOrder = await supabase
            .from('orders')
            .select('notes')
            .eq('id', order.id)
            .maybeSingle();
        notes = (currentOrder?['notes'] ?? '').toString();
        notes = notes.replaceAll(RegExp(r'\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*'), '').trim();
      } catch (_) {}
      final updatedNotes = notes.isEmpty ? '[RIDER_ACCEPTED]' : '[RIDER_ACCEPTED] $notes';

      final cleanDriverId = (rider.id.isNotEmpty && !rider.id.startsWith('r_')) ? rider.id : null;

      // Al aceptar, permanece en Cocina ('in_kitchen') para ir al local a buscarlo
      await supabase.from('orders').update({
        'driver_id': cleanDriverId,
        'status': 'in_kitchen',
        'notes': updatedNotes,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', order.id);

      order.status = OrderDeliveryStatus.assigned;
      final assignedOrder = DeliveryOrder(
        id: order.id,
        orderNumber: order.orderNumber,
        merchantName: order.merchantName,
        merchantPhone: order.merchantPhone,
        merchantAddress: order.merchantAddress,
        merchantLat: order.merchantLat,
        merchantLng: order.merchantLng,
        customerName: order.customerName,
        customerPhone: order.customerPhone,
        customerAddress: order.customerAddress,
        customerLat: order.customerLat,
        customerLng: order.customerLng,
        riderName: rider.name,
        riderPhone: rider.phone,
        riderVehicle: '${rider.vehicleType} • ${rider.vehicleModel}',
        riderPlate: rider.vehiclePlate,
        pin: order.pin,
        status: OrderDeliveryStatus.assigned,
        items: order.items,
        subtotal: order.subtotal,
        deliveryFee: order.deliveryFee,
        total: order.total,
        paymentMethod: order.paymentMethod,
        createdAt: order.createdAt,
      );

      _activeOrder = assignedOrder;
      _isAcceptedByRider = true;
      _availableOrders.removeWhere((o) => o.id == order.id);

      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyActiveOrder, jsonEncode(assignedOrder.toJson()));
      await prefs.setString(_keyAcceptedOrder, assignedOrder.id);

      // Notificar al portal web del comercio en tiempo real
      try {
        final tenantRow = await supabase.from('orders').select('tenant_id').eq('id', order.id).maybeSingle();
        final tenantId = tenantRow?['tenant_id'] ?? 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f';
        final channel = supabase.channel('orders:$tenantId');
        await channel.sendBroadcastMessage(
          event: 'order_status_updated',
          payload: {
            'id': order.id,
            'status': 'in_kitchen',
            'notes': updatedNotes,
            'riderTag': '[RIDER_ACCEPTED]',
            'driverId': cleanDriverId,
            'driverName': rider.name,
          },
        );
      } catch (_) {}

      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[RiderService] Error accepting order: $e');
      return false;
    }
  }

  Future<void> acceptAssignedOrder() async {
    if (_activeOrder == null) return;
    _isAcceptedByRider = true;
    _activeOrder!.status = OrderDeliveryStatus.assigned;
    final orderId = _activeOrder!.id;
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyAcceptedOrder, orderId);
      await prefs.setString(_keyActiveOrder, jsonEncode(_activeOrder!.toJson()));

      final supabase = Supabase.instance.client;
      final currentOrder = await supabase
          .from('orders')
          .select('notes')
          .eq('id', orderId)
          .maybeSingle();

      String notes = (currentOrder?['notes'] ?? '').toString();
      notes = notes.replaceAll(RegExp(r'\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*'), '').trim();
      final updatedNotes = notes.isEmpty ? '[RIDER_ACCEPTED]' : '[RIDER_ACCEPTED] $notes';

      // Al aceptar la asignación, se mantiene en cocina con la etiqueta [RIDER_ACCEPTED]
      await supabase.from('orders').update({
        'status': 'in_kitchen',
        'notes': updatedNotes,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', orderId);

      // Notificar al comercio
      try {
        final tenantRow = await supabase.from('orders').select('tenant_id').eq('id', orderId).maybeSingle();
        final tenantId = tenantRow?['tenant_id'] ?? 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f';
        final channel = supabase.channel('orders:$tenantId');
        await channel.sendBroadcastMessage(
          event: 'order_status_updated',
          payload: {
            'id': orderId,
            'status': 'in_kitchen',
            'notes': updatedNotes,
            'riderTag': '[RIDER_ACCEPTED]',
          },
        );
      } catch (_) {}

      debugPrint('[RiderService] Order $orderId accepted and kept in_kitchen in Supabase');
    } catch (e) {
      debugPrint('[RiderService] Error accepting order in Supabase: $e');
    }
    notifyListeners();
  }

  Future<bool> rejectAssignedOrder() async {
    if (_activeOrder == null) return false;
    final order = _activeOrder!;
    final orderId = order.id;
    try {
      final supabase = Supabase.instance.client;

      // 1. Get current rider user name if available
      String riderName = order.riderName;
      if (riderName.isEmpty) {
        final prefs = await SharedPreferences.getInstance();
        final rawRider = prefs.getString('current_rider_user_v1');
        if (rawRider != null) {
          try {
            final data = jsonDecode(rawRider);
            riderName = data['name'] ?? '';
          } catch (_) {}
        }
      }
      if (riderName.isEmpty) riderName = 'Repartidor';

      // 2. Fetch existing notes to preserve customer instructions
      String notes = '';
      try {
        final currentOrder = await supabase.from('orders').select('notes').eq('id', orderId).maybeSingle();
        notes = (currentOrder?['notes'] ?? '').toString();
        notes = notes.replaceAll(RegExp(r'\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*'), '').trim();
      } catch (_) {}
      final rejectedNotes = notes.isEmpty ? '[RIDER_REJECTED:$riderName]' : '[RIDER_REJECTED:$riderName] $notes';

      // 3. Unassign driver so order returns to available state in database
      await supabase.from('orders').update({
        'driver_id': null,
        'notes': rejectedNotes,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', orderId);

      // 4. Broadcast explicit rejection to merchant portal
      try {
        final orderRow = await supabase.from('orders').select('tenant_id').eq('id', orderId).maybeSingle();
        final tenantId = orderRow?['tenant_id'] ?? 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
        final channel = supabase.channel('orders:$tenantId');
        await channel.sendBroadcastMessage(
          event: 'order_rejected',
          payload: {
            'id': order.id,
            'orderNumber': order.orderNumber,
            'riderName': riderName,
          },
        );
      } catch (broadcastErr) {
        debugPrint('[RiderService] Notice broadcasting rejection: $broadcastErr');
      }

      _activeOrder = null;
      _isAcceptedByRider = false;

      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(_keyActiveOrder);
      await prefs.remove(_keyAcceptedOrder);

      notifyListeners();
      await fetchAvailableOrders();
      return true;
    } catch (e) {
      debugPrint('[RiderService] Error rejecting assigned order: $e');
      return false;
    }
  }

  Future<void> updateOrderStatus(OrderDeliveryStatus newStatus) async {
    if (_activeOrder == null) return;
    _activeOrder!.status = newStatus;
    final orderId = _activeOrder!.id;

    final dbStatus = _statusToDb(newStatus);
    String riderTag = '';
    if (newStatus == OrderDeliveryStatus.assigned) {
      riderTag = '[RIDER_ACCEPTED]';
    } else if (newStatus == OrderDeliveryStatus.atMerchant) {
      riderTag = '[RIDER_AT_MERCHANT]';
    } else if (newStatus == OrderDeliveryStatus.pickedUp) {
      riderTag = '[RIDER_PICKED_UP]';
    } else if (newStatus == OrderDeliveryStatus.onTheWay) {
      riderTag = '[RIDER_ON_THE_WAY]';
    }

    try {
      final supabase = Supabase.instance.client;
      final currentOrder = await supabase.from('orders').select('notes, tenant_id').eq('id', orderId).maybeSingle();
      String notes = (currentOrder?['notes'] ?? '').toString();
      notes = notes.replaceAll(RegExp(r'\[RIDER_[A-Z_]+(?::[^\]]*)?\]\s*'), '').trim();
      final updatedNotes = riderTag.isEmpty
          ? (notes.isEmpty ? null : notes)
          : (notes.isEmpty ? riderTag : '$riderTag $notes');

      await supabase.from('orders').update({
        'status': dbStatus,
        'notes': updatedNotes,
        'updated_at': DateTime.now().toIso8601String(),
      }).eq('id', orderId);

      // Broadcast update to merchant channel
      try {
        final tenantId = currentOrder?['tenant_id'] ?? 'a1b2c3d4-e5f6-7a8b-9c0d-1e2f3a4b5c6d';
        final channel = supabase.channel('orders:$tenantId');
        await channel.sendBroadcastMessage(
          event: 'order_status_updated',
          payload: {
            'id': orderId,
            'status': dbStatus,
            'notes': updatedNotes,
            'riderTag': riderTag,
          },
        );
      } catch (_) {}
    } catch (e) {
      debugPrint('[RiderService] Error updating status in Supabase: $e');
    }

    final prefs = await SharedPreferences.getInstance();

    if (newStatus == OrderDeliveryStatus.delivered) {
      _completedDeliveries.insert(0, _activeOrder!);
      final listStrings = _completedDeliveries.map((o) => jsonEncode(o.toJson())).toList();
      await prefs.setStringList(_keyCompletedOrders, listStrings);
      await prefs.remove(_keyActiveOrder);
      await prefs.remove(_keyAcceptedOrder);
      _activeOrder = null;
      _isAcceptedByRider = false;
    } else {
      await prefs.setString(_keyActiveOrder, jsonEncode(_activeOrder!.toJson()));
    }

    notifyListeners();
  }

  Future<void> sendTelemetry(
    double lat,
    double lng, {
    String? orderId,
    double speedKmh = 32.0,
  }) async {
    final ordId = orderId ?? _activeOrder?.id;
    final riderId = _currentRiderId;

    final cleanLat = double.parse(lat.toStringAsFixed(6));
    final cleanLng = double.parse(lng.toStringAsFixed(6));
    final nowIso = DateTime.now().toIso8601String();

    // 1. Actualizar API backend (ubicación + telemetría)
    if (riderId != null && riderId.isNotEmpty) {
      try {
        final url = Uri.parse('${AppConfig.backendBaseUrl}/riders/$riderId/location');
        http.post(
          url,
          headers: {'Content-Type': 'application/json'},
          body: jsonEncode({'lat': cleanLat, 'lng': cleanLng}),
        ).timeout(const Duration(seconds: 4));
      } catch (_) {}

      if (ordId != null && ordId.isNotEmpty) {
        try {
          final telemUrl = Uri.parse('${AppConfig.backendBaseUrl}/riders/telemetry');
          http.post(
            telemUrl,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'rider_id': riderId,
              'order_id': ordId,
              'latitude': cleanLat,
              'longitude': cleanLng,
              'speed_kmh': speedKmh,
              'battery_level': 92,
            }),
          ).timeout(const Duration(seconds: 4));
        } catch (_) {}
      }
    }

    // 2. Actualizar Supabase (tabla riders, rider_telemetry y Realtime broadcast)
    try {
      final supabase = Supabase.instance.client;
      if (riderId != null && riderId.isNotEmpty) {
        await supabase.from('riders').update({
          'current_lat': cleanLat,
          'current_lng': cleanLng,
          'last_ping_at': nowIso,
        }).eq('id', riderId);
      }

      if (ordId != null && ordId.isNotEmpty) {
        await supabase.from('rider_telemetry').insert({
          'rider_id': riderId,
          'order_id': ordId,
          'latitude': cleanLat,
          'longitude': cleanLng,
          'speed_kmh': speedKmh,
          'battery_level': 92,
          'recorded_at': nowIso,
        });

        try {
          final telemChannel = supabase.channel('telemetry:$ordId');
          await telemChannel.sendBroadcastMessage(
            event: 'telemetry_update',
            payload: {
              'rider_id': riderId,
              'order_id': ordId,
              'latitude': cleanLat,
              'longitude': cleanLng,
              'lat': cleanLat,
              'lng': cleanLng,
              'speed_kmh': speedKmh,
              'speed': speedKmh,
              'recorded_at': nowIso,
            },
          );
        } catch (_) {}
      }
    } catch (_) {}
  }

  Future<bool> requestPayout(double amount, String method, String destinationDetails) async {
    if (amount <= 0 || amount > availableBalance) return false;

    final tx = RiderPayoutTransaction(
      id: 'tx_${DateTime.now().millisecondsSinceEpoch}',
      amount: amount,
      method: method,
      destinationDetails: destinationDetails,
      date: DateTime.now(),
      status: 'Completado',
    );

    _payoutHistory.insert(0, tx);

    try {
      final prefs = await SharedPreferences.getInstance();
      final list = _payoutHistory.map((p) => p.toJson()).toList();
      await prefs.setString(_keyPayoutHistory, jsonEncode(list));
    } catch (_) {}

    notifyListeners();
    return true;
  }

  OrderDeliveryStatus _mapStatus(String? status) {
    if (status == null) return OrderDeliveryStatus.pending;
    switch (status.toLowerCase()) {
      case 'received':
      case 'pending':
        return OrderDeliveryStatus.pending;
      case 'confirmed':
        return OrderDeliveryStatus.confirmed;
      case 'in_kitchen':
      case 'preparing':
      case 'ready':
        return OrderDeliveryStatus.preparing;
      case 'assigned_driver':
      case 'assigned':
        return OrderDeliveryStatus.assigned;
      case 'at_merchant':
        return OrderDeliveryStatus.atMerchant;
      case 'picked_up':
        return OrderDeliveryStatus.pickedUp;
      case 'on_the_way':
      case 'ontheway':
        return OrderDeliveryStatus.onTheWay;
      case 'delivered':
        return OrderDeliveryStatus.delivered;
      case 'cancelled':
        return OrderDeliveryStatus.cancelled;
      default:
        return OrderDeliveryStatus.confirmed;
    }
  }

  String _statusToDb(OrderDeliveryStatus status) {
    switch (status) {
      case OrderDeliveryStatus.pending:
      case OrderDeliveryStatus.confirmed:
        return 'received';
      case OrderDeliveryStatus.preparing:
      case OrderDeliveryStatus.assigned:
      case OrderDeliveryStatus.atMerchant:
      case OrderDeliveryStatus.pickedUp:
        return 'in_kitchen';
      case OrderDeliveryStatus.onTheWay:
        return 'on_the_way';
      case OrderDeliveryStatus.delivered:
        return 'delivered';
      case OrderDeliveryStatus.cancelled:
        return 'cancelled';
    }
  }

  @override
  void dispose() {
    _pollTimer?.cancel();
    _ordersSubscription?.unsubscribe();
    super.dispose();
  }
}
