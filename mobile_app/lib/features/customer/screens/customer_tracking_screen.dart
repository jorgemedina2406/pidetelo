import 'dart:async';
import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:latlong2/latlong.dart' as ll;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/order_model.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/cart_service.dart';
import '../../../core/theme/app_theme.dart';

class CustomerTrackingScreen extends StatefulWidget {
  final DeliveryOrder order;

  const CustomerTrackingScreen({super.key, required this.order});

  @override
  State<CustomerTrackingScreen> createState() => _CustomerTrackingScreenState();
}

class _CustomerTrackingScreenState extends State<CustomerTrackingScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late DeliveryOrder _order;
  final MapController _mapController = MapController();
  Timer? _pollTimer;

  bool _isDarkMap = false;
  bool _isDetailsExpanded = false;

  late List<ll.LatLng> _routePoints;
  int _estimatedMinutes = 7;
  double _distanceKm = 4.29;

  bool get _hasRider =>
      _order.riderName.trim().isNotEmpty ||
      _order.status.index >= OrderDeliveryStatus.assigned.index;

  double _telemetryProgress = 0.0;
  ll.LatLng? _liveRiderCoord;
  ll.LatLng? _displayedRiderCoord;
  ll.LatLng? _lastRoutedRiderCoord;
  bool _isFetchingRoute = false;
  Timer? _smoothGlideTimer;
  RealtimeChannel? _telemetryChannel;
  String? _subscribedOrderUuid;

  // Calificación del motorizado
  bool _hasRatedRider = false;
  double _selectedRiderRating = 5.0;
  bool _isSubmittingRating = false;
  final TextEditingController _ratingCommentController = TextEditingController();

  Future<void> _submitRiderRating() async {
    final riderId = _order.riderId;
    if (riderId == null || riderId.isEmpty) return;
    setState(() => _isSubmittingRating = true);
    final ok = await ApiService().rateRider(
      riderId: riderId,
      rating: _selectedRiderRating,
      orderId: _order.id,
      comment: _ratingCommentController.text.trim(),
    );
    if (!mounted) return;
    setState(() {
      _isSubmittingRating = false;
      _hasRatedRider = ok;
    });
    if (ok) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('¡Gracias por calificar a tu repartidor de Pídetelo!'),
          backgroundColor: Color(0xFF10B981),
        ),
      );
    }
  }

  // Calificación del comercio / tienda
  bool _hasRatedStore = false;
  double _selectedStoreRating = 5.0;
  bool _isSubmittingStoreRating = false;
  final TextEditingController _storeRatingCommentController = TextEditingController();

  Future<void> _submitStoreRating() async {
    final tenantId = _order.tenantId;
    if (tenantId == null || tenantId.isEmpty) return;
    setState(() => _isSubmittingStoreRating = true);
    final res = await ApiService().submitTenantReview(
      tenantId: tenantId,
      rating: _selectedStoreRating,
      orderId: _order.id,
      comment: _storeRatingCommentController.text.trim(),
      customerName: _order.customerName.isNotEmpty ? _order.customerName : 'Cliente',
      customerPhone: _order.customerPhone,
    );
    if (!mounted) return;
    setState(() {
      _isSubmittingStoreRating = false;
      _hasRatedStore = res != null;
    });
    if (res != null) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text('¡Gracias por calificar a ${_order.tenantName.isNotEmpty ? _order.tenantName : "tu comercio"}! ⭐'),
          backgroundColor: const Color(0xFF10B981),
        ),
      );
    }
  }

  double get _riderProgress {
    if (!_hasRider) return 0.0;
    switch (_order.status) {
      case OrderDeliveryStatus.assigned:
      case OrderDeliveryStatus.atMerchant:
      case OrderDeliveryStatus.pickedUp:
        return 0.0;
      case OrderDeliveryStatus.onTheWay:
        return _telemetryProgress.clamp(0.0, 1.0);
      case OrderDeliveryStatus.delivered:
        return 1.0;
      default:
        return 0.0;
    }
  }

  double _haversineKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * math.pi / 180.0;
    final dLon = (lon2 - lon1) * math.pi / 180.0;
    final a = math.sin(dLat / 2) * math.sin(dLat / 2) +
        math.cos(lat1 * math.pi / 180.0) *
            math.cos(lat2 * math.pi / 180.0) *
            math.sin(dLon / 2) *
            math.sin(dLon / 2);
    final c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a));
    return r * c;
  }

  void _updateProgressFromCoord(double lat, double lng) {
    if (!mounted) return;
    double newProg = _telemetryProgress;
    if (_routePoints.length >= 2) {
      int closestIdx = 0;
      double minDistance = double.infinity;
      for (int i = 0; i < _routePoints.length; i++) {
        final pt = _routePoints[i];
        final d = math.pow(pt.latitude - lat, 2) + math.pow(pt.longitude - lng, 2);
        if (d < minDistance) {
          minDistance = d.toDouble();
          closestIdx = i;
        }
      }
      newProg = closestIdx / (_routePoints.length - 1);
    }

    final remKm = _haversineKm(lat, lng, _order.customerLat, _order.customerLng);
    final coordChanged = _liveRiderCoord == null ||
        (_liveRiderCoord!.latitude - lat).abs() > 0.000003 ||
        (_liveRiderCoord!.longitude - lng).abs() > 0.000003;

    if (coordChanged || (newProg - _telemetryProgress).abs() > 0.002) {
      setState(() {
        _liveRiderCoord = ll.LatLng(lat, lng);
        _displayedRiderCoord ??= _liveRiderCoord;
        _telemetryProgress = newProg;
        if (_order.status == OrderDeliveryStatus.onTheWay) {
          _distanceKm = double.parse(remKm.toStringAsFixed(2));
          _estimatedMinutes = (remKm * 2.5).round().clamp(1, 90);
        }
      });

      // Recalcular ruta óptima en vivo desde la moto al cliente cuando avanza más de 35 metros
      if (_order.status == OrderDeliveryStatus.onTheWay && !_isFetchingRoute) {
        final movedKm = _lastRoutedRiderCoord != null
            ? _haversineKm(lat, lng, _lastRoutedRiderCoord!.latitude, _lastRoutedRiderCoord!.longitude)
            : 999.0;
        if (movedKm > 0.035) {
          _loadDynamicFastestRoute(fromLat: lat, fromLng: lng);
        }
      }
    }
  }

  void _subscribeToOrderTelemetry(String orderUuid) {
    if (orderUuid.isEmpty || _subscribedOrderUuid == orderUuid) return;
    _subscribedOrderUuid = orderUuid;
    _telemetryChannel?.unsubscribe();

    try {
      _telemetryChannel = Supabase.instance.client
          .channel('telemetry:$orderUuid')
          .onPostgresChanges(
            event: PostgresChangeEvent.insert,
            schema: 'public',
            table: 'rider_telemetry',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'order_id',
              value: orderUuid,
            ),
            callback: (payload) {
              final row = payload.newRecord;
              final lat = row['latitude'] ?? row['lat'];
              final lng = row['longitude'] ?? row['lng'];
              if (lat != null && lng != null) {
                _updateProgressFromCoord((lat as num).toDouble(), (lng as num).toDouble());
              }
            },
          )
          .onBroadcast(
            event: 'telemetry_update',
            callback: (payload) {
              final lat = payload['latitude'] ?? payload['lat'];
              final lng = payload['longitude'] ?? payload['lng'];
              if (lat != null && lng != null) {
                _updateProgressFromCoord((lat as num).toDouble(), (lng as num).toDouble());
              }
            },
          )
          .subscribe();
    } catch (e) {
      debugPrint('[Tracking] Telemetry realtime subscribe notice: $e');
    }
  }

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    _routePoints = [
      ll.LatLng(_order.merchantLat, _order.merchantLng),
      ll.LatLng(_order.customerLat, _order.customerLng),
    ];

    _loadDynamicFastestRoute();
    _setupRealtimeListener();
    _refreshOrderStatus();

    // Interpolación suave a 25 FPS para eliminar saltos bruscos de la moto
    _smoothGlideTimer = Timer.periodic(const Duration(milliseconds: 40), (_) {
      if (!mounted || _liveRiderCoord == null) return;
      if (_displayedRiderCoord == null) {
        setState(() => _displayedRiderCoord = _liveRiderCoord);
        return;
      }
      final dLat = _liveRiderCoord!.latitude - _displayedRiderCoord!.latitude;
      final dLng = _liveRiderCoord!.longitude - _displayedRiderCoord!.longitude;
      if (dLat.abs() < 0.000002 && dLng.abs() < 0.000002) return;
      setState(() {
        _displayedRiderCoord = ll.LatLng(
          _displayedRiderCoord!.latitude + dLat * 0.22,
          _displayedRiderCoord!.longitude + dLng * 0.22,
        );
      });
    });

    // Refresco de respaldo a 4 segundos (Supabase Realtime ya envía cambios instantáneamente)
    _pollTimer = Timer.periodic(const Duration(milliseconds: 4000), (_) {
      _refreshOrderStatus();
    });
  }

  RealtimeChannel? _realtimeChannel;

  void _setupRealtimeListener() {
    try {
      final cleanNum = _order.orderNumber.replaceAll('#', '').trim();
      _realtimeChannel = Supabase.instance.client
          .channel('order_realtime_$cleanNum')
          .onPostgresChanges(
            event: PostgresChangeEvent.all,
            schema: 'public',
            table: 'orders',
            filter: PostgresChangeFilter(
              type: PostgresChangeFilterType.eq,
              column: 'order_number',
              value: _order.orderNumber,
            ),
            callback: (payload) {
              debugPrint('[Tracking] Realtime order event: ${payload.eventType}');
              _refreshOrderStatus();
            },
          )
          .subscribe();
    } catch (e) {
      debugPrint('[Tracking] Realtime subscription error: $e');
    }
  }

  Future<void> _refreshOrderStatus() async {
    try {
      final supabase = Supabase.instance.client;
      final cleanNum = _order.orderNumber.replaceAll('#', '').trim();
      final isUuid = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')
          .hasMatch(_order.id);

      final filter = isUuid
          ? 'id.eq.${_order.id},order_number.eq.$cleanNum,order_number.eq.#$cleanNum'
          : 'order_number.eq.$cleanNum,order_number.eq.#$cleanNum';

      final res = await supabase
          .from('orders')
          .select('*, riders(*), tenants(*), branches(*)')
          .or(filter)
          .maybeSingle();

      if (res != null && mounted) {
        final statusStr = res['status']?.toString() ?? '';
        final rawNotes = (res['notes'] ?? '').toString();
        final riderData = res['riders'] as Map<String, dynamic>?;
        OrderDeliveryStatus newStatus = _mapSupabaseStatus(statusStr);
        final riderName = riderData != null ? (riderData['name'] ?? '') : (res['rider_name'] ?? '');
        final riderPhone = riderData != null ? (riderData['phone'] ?? '') : (res['rider_phone'] ?? '');
        final riderPlate = riderData != null ? (riderData['vehicle_plate'] ?? '') : '';
        final riderVehicle = riderData != null ? (riderData['vehicle_model'] ?? riderData['vehicle_type'] ?? 'Moto') : 'Moto';

        // Detect rider sub-status from notes & driver presence
        if (rawNotes.contains('[RIDER_AT_MERCHANT]')) {
          newStatus = OrderDeliveryStatus.atMerchant;
        } else if (rawNotes.contains('[RIDER_ON_THE_WAY]') || statusStr == 'on_the_way') {
          newStatus = OrderDeliveryStatus.onTheWay;
        } else if (rawNotes.contains('[RIDER_PICKED_UP]')) {
          newStatus = OrderDeliveryStatus.onTheWay;
        } else if (rawNotes.contains('[RIDER_ACCEPTED]') || (res['driver_id'] != null && riderName.isNotEmpty)) {
          if (newStatus == OrderDeliveryStatus.pending ||
              newStatus == OrderDeliveryStatus.confirmed ||
              newStatus == OrderDeliveryStatus.preparing) {
            newStatus = OrderDeliveryStatus.assigned;
          }
        }

        // Live telemetry check when order is on the way
        final orderUuid = (res['id'] ?? _order.id).toString();
        if (orderUuid.isNotEmpty) {
          _subscribeToOrderTelemetry(orderUuid);
        }

        if (newStatus == OrderDeliveryStatus.onTheWay) {
          bool updatedFromTelemetry = false;
          try {
            final telem = await supabase
                .from('rider_telemetry')
                .select('latitude, longitude')
                .eq('order_id', orderUuid)
                .order('recorded_at', ascending: false)
                .limit(1)
                .maybeSingle();
            if (telem != null && telem['latitude'] != null && telem['longitude'] != null) {
              final tLat = (telem['latitude'] as num).toDouble();
              final tLng = (telem['longitude'] as num).toDouble();
              _updateProgressFromCoord(tLat, tLng);
              updatedFromTelemetry = true;
            }
          } catch (_) {}

          if (!updatedFromTelemetry &&
              riderData != null &&
              riderData['current_lat'] != null &&
              riderData['current_lng'] != null) {
            final rLat = (riderData['current_lat'] as num).toDouble();
            final rLng = (riderData['current_lng'] as num).toDouble();
            _updateProgressFromCoord(rLat, rLng);
          }
        }

        final tenantData = res['tenants'] as Map<String, dynamic>?;
        final branchData = res['branches'] as Map<String, dynamic>?;
        final dynamicMerchantName = (branchData != null && (branchData['name'] ?? '').toString().isNotEmpty)
            ? branchData['name'].toString()
            : (tenantData != null && (tenantData['name'] ?? '').toString().isNotEmpty)
                ? tenantData['name'].toString()
                : _order.merchantName;
        final dynamicMerchantAddress = (branchData != null && (branchData['address'] ?? '').toString().isNotEmpty)
            ? branchData['address'].toString()
            : (tenantData != null && (tenantData['address'] ?? '').toString().isNotEmpty)
                ? tenantData['address'].toString()
                : _order.merchantAddress;
        final dynamicMerchantLat = (branchData != null && branchData['latitude'] != null)
            ? (branchData['latitude'] as num).toDouble()
            : (tenantData != null && tenantData['latitude'] != null)
                ? (tenantData['latitude'] as num).toDouble()
                : _order.merchantLat;
        final dynamicMerchantLng = (branchData != null && branchData['longitude'] != null)
            ? (branchData['longitude'] as num).toDouble()
            : (tenantData != null && tenantData['longitude'] != null)
                ? (tenantData['longitude'] as num).toDouble()
                : _order.merchantLng;
        final dynamicCustomerName = (res['customer_name'] ?? '').toString().isNotEmpty
            ? res['customer_name'].toString()
            : _order.customerName;
        final dynamicCustomerAddress = (res['delivery_address'] ?? '').toString().isNotEmpty
            ? res['delivery_address'].toString()
            : _order.customerAddress;

        final bool merchantLocationChanged =
            (_order.merchantLat - dynamicMerchantLat).abs() > 0.0001 ||
            (_order.merchantLng - dynamicMerchantLng).abs() > 0.0001;

        final String newPaymentStatus = (res['payment_status'] ?? _order.paymentStatus).toString();
        final String newPaymentReference = (res['payment_reference'] ?? _order.paymentReference).toString();
        String originBank = (res['payment_origin_bank'] ?? _order.paymentOriginBank).toString();
        if (originBank.isEmpty && rawNotes.contains('[PAGO_ORIGEN:')) {
          final m = RegExp(r'\[PAGO_ORIGEN:([^\]]+)\]').firstMatch(rawNotes);
          if (m != null) originBank = m.group(1)!.trim();
        }

        if (newStatus != _order.status ||
            newPaymentStatus != _order.paymentStatus ||
            newPaymentReference != _order.paymentReference ||
            riderName != _order.riderName ||
            riderPlate != _order.riderPlate ||
            dynamicMerchantName != _order.merchantName ||
            merchantLocationChanged) {
          setState(() {
            _order.status = newStatus;
            _order = DeliveryOrder(
              id: _order.id,
              orderNumber: _order.orderNumber,
              riderId: res['driver_id']?.toString() ?? _order.riderId,
              merchantName: dynamicMerchantName,
              merchantPhone: _order.merchantPhone,
              merchantAddress: dynamicMerchantAddress,
              merchantLat: dynamicMerchantLat,
              merchantLng: dynamicMerchantLng,
              customerName: dynamicCustomerName,
              customerPhone: _order.customerPhone,
              customerAddress: dynamicCustomerAddress,
              customerLat: _order.customerLat,
              customerLng: _order.customerLng,
              riderName: riderName,
              riderPhone: riderPhone,
              riderVehicle: riderVehicle,
              riderPlate: riderPlate,
              pin: () {
                final notes = (res['notes'] ?? '').toString();
                if (notes.contains('[PIN:')) {
                  final m = RegExp(r'\[PIN:(\d{4})\]').firstMatch(notes);
                  if (m != null) return m.group(1)!;
                }
                final orderNum = (res['order_number'] ?? _order.orderNumber).toString();
                final digits = orderNum.replaceAll(RegExp(r'\D'), '');
                if (digits.length >= 4) {
                  return digits.substring(digits.length - 4);
                } else if (digits.isNotEmpty) {
                  return digits.padLeft(4, '0');
                }
                if (_order.pin.isNotEmpty && _order.pin != '1234' && _order.pin != '6420') {
                  return _order.pin;
                }
                return '1234';
              }(),
              status: newStatus,
              items: _order.items,
              subtotal: _order.subtotal,
              deliveryFee: _order.deliveryFee,
              total: _order.total,
              paymentMethod: _order.paymentMethod,
              paymentStatus: newPaymentStatus,
              paymentReference: newPaymentReference,
              paymentOriginBank: originBank,
              createdAt: _order.createdAt,
              branchId: _order.branchId,
              companyId: _order.companyId,
            );
          });
          CartService().updateOrderStatus(newStatus, orderId: _order.id);
          if (merchantLocationChanged) {
            _loadDynamicFastestRoute();
          }
        }
      }
    } catch (e) {
      debugPrint('[Tracking] _refreshOrderStatus error: $e');
    }
  }

  OrderDeliveryStatus _mapSupabaseStatus(String status) {
    switch (status.toLowerCase()) {
      case 'received':
      case 'pending':
        return OrderDeliveryStatus.pending;
      case 'confirmed':
        return OrderDeliveryStatus.confirmed;
      case 'in_kitchen':
      case 'preparing':
        return OrderDeliveryStatus.preparing;
      case 'assigned_driver':
      case 'assigned':
        return OrderDeliveryStatus.assigned;
      case 'on_the_way':
      case 'ontheway':
        return OrderDeliveryStatus.onTheWay;
      case 'delivered':
        return OrderDeliveryStatus.delivered;
      case 'cancelled':
        return OrderDeliveryStatus.cancelled;
      default:
        return _order.status;
    }
  }

  Future<void> _loadDynamicFastestRoute({double? fromLat, double? fromLng}) async {
    if (_isFetchingRoute) return;
    _isFetchingRoute = true;
    try {
      final bool useRiderOrigin = fromLat != null && fromLng != null;
      final originLat = useRiderOrigin
          ? fromLat
          : (_order.status == OrderDeliveryStatus.onTheWay && _liveRiderCoord != null
              ? _liveRiderCoord!.latitude
              : _order.merchantLat);
      final originLng = useRiderOrigin
          ? fromLng
          : (_order.status == OrderDeliveryStatus.onTheWay && _liveRiderCoord != null
              ? _liveRiderCoord!.longitude
              : _order.merchantLng);

      if (_order.status == OrderDeliveryStatus.onTheWay) {
        _lastRoutedRiderCoord = ll.LatLng(originLat, originLng);
      }

      final route = await ApiService().fetchFastestRoute(
        originLat: originLat,
        originLng: originLng,
        destLat: _order.customerLat,
        destLng: _order.customerLng,
      );
      if (!mounted) return;
      if (route['waypoints'] != null && (route['waypoints'] as List).isNotEmpty) {
        final List raw = route['waypoints'];
        setState(() {
          _routePoints = raw
              .map<ll.LatLng>((pt) => ll.LatLng((pt[0] as num).toDouble(), (pt[1] as num).toDouble()))
              .toList();
          _estimatedMinutes = route['durationMinutes'] ?? 7;
          _distanceKm = (route['distanceKm'] as num?)?.toDouble() ?? 4.29;
        });
      }
    } finally {
      _isFetchingRoute = false;
    }
  }

  @override
  void dispose() {
    _ratingCommentController.dispose();
    _storeRatingCommentController.dispose();
    _smoothGlideTimer?.cancel();
    _pollTimer?.cancel();
    _realtimeChannel?.unsubscribe();
    _telemetryChannel?.unsubscribe();
    _animController.dispose();
    super.dispose();
  }

  ll.LatLng get _riderCurrentLatLng {
    if (_order.status == OrderDeliveryStatus.delivered) {
      return ll.LatLng(_order.customerLat, _order.customerLng);
    }
    if (_order.status != OrderDeliveryStatus.onTheWay) {
      return ll.LatLng(_order.merchantLat, _order.merchantLng);
    }
    if (_displayedRiderCoord != null) {
      return _displayedRiderCoord!;
    }
    if (_liveRiderCoord != null) {
      return _liveRiderCoord!;
    }
    if (_routePoints.isEmpty) {
      return ll.LatLng(_order.merchantLat, _order.merchantLng);
    }
    final targetIdx = (_riderProgress.clamp(0.0, 1.0) * (_routePoints.length - 1)).round();
    return _routePoints[targetIdx];
  }

  List<ll.LatLng> get _traversedPoints {
    if (_routePoints.isEmpty || !_hasRider) return [];
    if (_order.status != OrderDeliveryStatus.onTheWay && _order.status != OrderDeliveryStatus.delivered) {
      return [];
    }
    final targetIdx = (_riderProgress.clamp(0.0, 1.0) * (_routePoints.length - 1)).round();
    if (targetIdx <= 0) return [];
    return _routePoints.sublist(0, targetIdx + 1);
  }

  void _centerOnRider() {
    _mapController.move(_riderCurrentLatLng, 15.5);
  }

  void _fitEntireRoute() {
    final centerLat = (_order.merchantLat + _order.customerLat) / 2;
    final centerLng = (_order.merchantLng + _order.customerLng) / 2;
    _mapController.move(ll.LatLng(centerLat, centerLng), 14.2);
  }

  void _zoomIn() {
    final currentZoom = _mapController.camera.zoom;
    _mapController.move(_mapController.camera.center, (currentZoom + 1).clamp(11.0, 18.0));
  }

  void _zoomOut() {
    final currentZoom = _mapController.camera.zoom;
    _mapController.move(_mapController.camera.center, (currentZoom - 1).clamp(11.0, 18.0));
  }

  Future<void> _launchWhatsAppRider() async {
    final destination = _order.customerAddress.trim().isNotEmpty
        ? _order.customerAddress.trim()
        : 'mi dirección';
    final msg = Uri.encodeComponent(
      '¡Hola ${_order.riderName}! Soy ${_order.customerName}, cliente del pedido ${_order.orderNumber}. ¿Cómo va la entrega hacia $destination?',
    );
    final phone = _order.riderPhone.replaceAll(RegExp(r'\D'), '');
    final url = Uri.parse('https://wa.me/$phone?text=$msg');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        _showToast('No se pudo abrir WhatsApp');
      }
    } catch (_) {
      _showToast('Abriendo WhatsApp...');
    }
  }

  Future<void> _launchPhoneCallRider() async {
    final url = Uri.parse('tel:${_order.riderPhone}');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url);
      } else {
        _showToast('Llamando a ${_order.riderName}...');
      }
    } catch (_) {
      _showToast('Llamando a ${_order.riderPhone}');
    }
  }

  Future<void> _launchWhatsAppMerchant() async {
    final phone = _order.merchantPhone.replaceAll('+', '').replaceAll(' ', '');
    final msg = Uri.encodeComponent(
      '¡Hola ${_order.merchantName}! Soy ${_order.customerName}, cliente del pedido ${_order.orderNumber}. ¿Cómo va la preparación de mi orden?',
    );
    final url = Uri.parse('https://wa.me/$phone?text=$msg');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        _showToast('No se pudo abrir WhatsApp');
      }
    } catch (_) {
      _showToast('Abriendo WhatsApp...');
    }
  }

  Future<void> _launchWhatsAppPaymentIssue() async {
    final phone = _order.merchantPhone.replaceAll('+', '').replaceAll(' ', '');
    final cleanPhone = phone.isNotEmpty ? phone : '584245065032';
    final ref = _order.paymentReference.isNotEmpty ? _order.paymentReference : 'N/A';
    final msg = Uri.encodeComponent(
      '¡Hola ${_order.merchantName}! Soy ${_order.customerName}, cliente del pedido ${_order.orderNumber}. '
      'Vi en la app que mi pago móvil (Ref: $ref) requiere validación. Aquí te adjunto el capture del comprobante bancario:',
    );
    final url = Uri.parse('https://wa.me/$cleanPhone?text=$msg');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url, mode: LaunchMode.externalApplication);
      } else {
        _showToast('No se pudo abrir WhatsApp');
      }
    } catch (_) {
      _showToast('Abriendo WhatsApp...');
    }
  }

  void _showEditPaymentRefDialog() {
    final textCtrl = TextEditingController(text: _order.paymentReference);
    bool isSaving = false;

    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (context, setDialogState) => AlertDialog(
          backgroundColor: const Color(0xFF1E293B),
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Text(
            'Corregir Referencia de Pago',
            style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 16),
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Ingresa los dígitos correctos del comprobante bancario emitido a ${_order.merchantName}:',
                style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: textCtrl,
                keyboardType: TextInputType.number,
                style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w600),
                decoration: InputDecoration(
                  hintText: 'Ej: 987654',
                  hintStyle: GoogleFonts.outfit(color: Colors.white38),
                  filled: true,
                  fillColor: const Color(0xFF0F172A),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white24)),
                  enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: Colors.white24)),
                  focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: const BorderSide(color: AppTheme.primary)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text('Cancelar', style: GoogleFonts.outfit(color: Colors.white54)),
            ),
            ElevatedButton(
              onPressed: isSaving
                  ? null
                  : () async {
                      final newRef = textCtrl.text.trim();
                      if (newRef.isEmpty) return;
                      setDialogState(() => isSaving = true);
                      try {
                        final cleanNum = _order.orderNumber.replaceAll('#', '').trim();
                        await Supabase.instance.client
                            .from('orders')
                            .update({
                              'payment_reference': newRef,
                              'payment_status': 'pending',
                            })
                            .or('id.eq.${_order.id},order_number.eq.$cleanNum,order_number.eq.#$cleanNum');

                        if (mounted) {
                          setState(() {
                            _order = DeliveryOrder(
                              id: _order.id,
                              orderNumber: _order.orderNumber,
                              merchantName: _order.merchantName,
                              merchantPhone: _order.merchantPhone,
                              merchantAddress: _order.merchantAddress,
                              merchantLat: _order.merchantLat,
                              merchantLng: _order.merchantLng,
                              customerName: _order.customerName,
                              customerPhone: _order.customerPhone,
                              customerAddress: _order.customerAddress,
                              customerLat: _order.customerLat,
                              customerLng: _order.customerLng,
                              riderId: _order.riderId,
                              riderName: _order.riderName,
                              riderPhone: _order.riderPhone,
                              riderVehicle: _order.riderVehicle,
                              riderPlate: _order.riderPlate,
                              pin: _order.pin,
                              status: _order.status,
                              items: _order.items,
                              subtotal: _order.subtotal,
                              deliveryFee: _order.deliveryFee,
                              total: _order.total,
                              paymentMethod: _order.paymentMethod,
                              paymentStatus: 'pending',
                              paymentReference: newRef,
                              paymentOriginBank: _order.paymentOriginBank,
                              createdAt: _order.createdAt,
                              branchId: _order.branchId,
                              companyId: _order.companyId,
                            );
                          });
                          Navigator.pop(ctx);
                          ScaffoldMessenger.of(context).showSnackBar(
                            const SnackBar(
                              content: Text('¡Referencia actualizada! El comercio la validará en breve.'),
                              backgroundColor: Color(0xFF10B981),
                            ),
                          );
                        }
                      } catch (e) {
                        setDialogState(() => isSaving = false);
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(content: Text('Error al actualizar: $e'), backgroundColor: Colors.red),
                        );
                      }
                    },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: isSaving
                  ? const SizedBox(width: 16, height: 16, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('Guardar y Notificar', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }



  void _showToast(String msg) {
    if (!mounted) return;
    ScaffoldMessenger.of(context).showSnackBar(
      SnackBar(
        content: Text(msg, style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
        backgroundColor: const Color(0xFF1E293B),
        behavior: SnackBarBehavior.floating,
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
      ),
    );
  }


  void _showAppendItemsSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(22),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 40,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 16),
            Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.add_circle_outline_rounded, color: AppTheme.primary, size: 24),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Adicionar a Orden ${_order.orderNumber}',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        'Estado: En Preparación en Cocina',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: const Color(0xFF10B981),
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: 14),
            Text(
              '¡Estás a tiempo! Como tu orden aún no ha salido con el repartidor, puedes adicionar bebidas, acompañantes o postres. Comunícate al WhatsApp del comercio o indícalo directamente para anexarlo a tu comanda.',
              style: GoogleFonts.outfit(
                fontSize: 13,
                color: Colors.white70,
                height: 1.4,
              ),
            ),
            const SizedBox(height: 20),
            ElevatedButton.icon(
              onPressed: () {
                Navigator.pop(ctx);
                _launchWhatsAppMerchant();
              },
              icon: const Icon(Icons.chat_rounded, size: 18),
              label: const Text('Coordinar Adición por WhatsApp'),
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF22C55E),
                foregroundColor: Colors.white,
                padding: const EdgeInsets.symmetric(vertical: 14),
                textStyle: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
            ),
            const SizedBox(height: 10),
            TextButton(
              onPressed: () => Navigator.pop(ctx),
              child: Text(
                'Cerrar',
                style: GoogleFonts.outfit(color: Colors.white54, fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final centerLat = (_order.merchantLat + _order.customerLat) / 2;
    final centerLng = (_order.merchantLng + _order.customerLng) / 2;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D),
      body: Stack(
        children: [
          // 1. EMBEDDED REAL STREET MAP (OpenStreetMap / CartoDB)
          Positioned.fill(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: ll.LatLng(centerLat, centerLng),
                initialZoom: 14.3,
                minZoom: 11.0,
                maxZoom: 18.0,
                interactionOptions: const InteractionOptions(
                  flags: InteractiveFlag.all,
                ),
              ),
              children: [
                // Clean OpenStreetMap Layer (100% Free, No Watermark, No API Key Required)
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.deliveryhub.mobile_app',
                  maxZoom: 19,
                ),

                // Road Polyline Layer (88 real road coordinates in Cabudare)
                PolylineLayer(
                  polylines: [
                    // Glow / Casing line
                    Polyline(
                      points: _routePoints,
                      strokeWidth: 6.5,
                      color: const Color(0xFF0284C7).withOpacity(0.5),
                    ),
                    // Full route road line
                    Polyline(
                      points: _routePoints,
                      strokeWidth: 4.2,
                      color: const Color(0xFF06B6D4),
                    ),
                    // Traversed route segment (completed by rider)
                    if (_hasRider && _traversedPoints.isNotEmpty)
                      Polyline(
                        points: _traversedPoints,
                        strokeWidth: 4.5,
                        color: const Color(0xFF10B981),
                      ),
                  ],
                ),

                // Pins / Markers Layer
                MarkerLayer(
                  markers: [
                    // Merchant Marker
                    Marker(
                      point: ll.LatLng(_order.merchantLat, _order.merchantLng),
                      width: 140,
                      height: 75,
                      child: _buildMerchantMapPin(),
                    ),

                    // Customer Marker: (Delivery location)
                    Marker(
                      point: ll.LatLng(_order.customerLat, _order.customerLng),
                      width: 140,
                      height: 75,
                      child: _buildCustomerMapPin(),
                    ),

                    // Rider Marker ONLY when rider is actually assigned
                    if (_hasRider)
                      Marker(
                        point: _riderCurrentLatLng,
                        width: 150,
                        height: 85,
                        child: _buildRiderMapPin(),
                      ),
                  ],
                ),
              ],
            ),
          ),

          // 2. Top Header Bar with Live Order Status
          Positioned(
            top: MediaQuery.of(context).padding.top + 10,
            left: 16,
            right: 16,
            child: Row(
              children: [
                CircleAvatar(
                  backgroundColor: const Color(0xFF1E293B).withOpacity(0.92),
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B).withOpacity(0.92),
                      borderRadius: BorderRadius.circular(16),
                      border: Border.all(color: Colors.white12),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(0.4),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Text(
                              'Rastreo: ${_order.orderNumber}',
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              _order.paymentStatus == 'rejected'
                                  ? 'Comanda en pausa • Pago no verificado'
                                  : _order.status == OrderDeliveryStatus.pending
                                      ? 'Esperando confirmación del comercio'
                                      : _order.status == OrderDeliveryStatus.confirmed
                                          ? 'Comercio confirmó tu pedido'
                                          : _order.status == OrderDeliveryStatus.preparing && !_hasRider
                                              ? 'En preparación en cocina'
                                              : _order.status == OrderDeliveryStatus.atMerchant
                                                  ? '¡El repartidor ${_order.riderName.isNotEmpty ? _order.riderName : ""} llegó al local!'
                                                  : _order.status == OrderDeliveryStatus.assigned
                                                      ? 'Repartidor ${_order.riderName.isNotEmpty ? _order.riderName : ""} asignado • Yendo al local'
                                                      : _order.status == OrderDeliveryStatus.onTheWay
                                                          ? 'En camino a tu ubicación • ~$_estimatedMinutes min'
                                                          : _order.status == OrderDeliveryStatus.delivered
                                                              ? '¡Pedido entregado con éxito!'
                                                              : _hasRider
                                                                  ? 'Repartidor asignado: ${_order.riderName}'
                                                                  : 'Buscando repartidor cercano...',
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.w600,
                                color: _order.paymentStatus == 'rejected'
                                    ? const Color(0xFFF43F5E)
                                    : _order.status == OrderDeliveryStatus.atMerchant
                                        ? const Color(0xFF38BDF8)
                                        : _order.status == OrderDeliveryStatus.onTheWay
                                            ? AppTheme.primary
                                            : _hasRider
                                                ? AppTheme.primary
                                                : AppTheme.amberAccent,
                              ),
                            ),
                          ],
                        ),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.riderAccent.withOpacity(0.2),
                            borderRadius: BorderRadius.circular(8),
                          ),
                          child: Text(
                            '${_distanceKm.toStringAsFixed(1)} km',
                            style: GoogleFonts.outfit(
                              fontSize: 11.5,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.riderAccent,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ],
            ),
          ),

          // 3. Floating In-App Map Controls (Right Side)
          Positioned(
            right: 16,
            top: MediaQuery.of(context).padding.top + 75,
            child: Column(
              children: [
                // Center on rider button
                _buildMapToolButton(
                  icon: Icons.my_location_rounded,
                  tooltip: 'Centrar en Moto',
                  color: AppTheme.riderAccent,
                  onTap: _centerOnRider,
                ),
                const SizedBox(height: 8),
                // Fit full route button
                _buildMapToolButton(
                  icon: Icons.zoom_out_map_rounded,
                  tooltip: 'Ver Ruta Completa',
                  color: const Color(0xFF38BDF8),
                  onTap: _fitEntireRoute,
                ),
                const SizedBox(height: 8),
                // Toggle Map Theme (Calles vs Oscuro)
                _buildMapToolButton(
                  icon: _isDarkMap ? Icons.map_outlined : Icons.dark_mode_outlined,
                  tooltip: _isDarkMap ? 'Modo Calles' : 'Modo Nocturno',
                  color: Colors.white,
                  onTap: () {
                    setState(() => _isDarkMap = !_isDarkMap);
                  },
                ),
                const SizedBox(height: 8),
                // Zoom In
                _buildMapToolButton(
                  icon: Icons.add_rounded,
                  tooltip: 'Acercar',
                  color: Colors.white70,
                  onTap: _zoomIn,
                ),
                const SizedBox(height: 8),
                // Zoom Out
                _buildMapToolButton(
                  icon: Icons.remove_rounded,
                  tooltip: 'Alejar',
                  color: Colors.white70,
                  onTap: _zoomOut,
                ),
              ],
            ),
          ),

          // 4. Bottom Order & Delivery Details Sheet (Expandable/Collapsible)
          Positioned(
            left: 0,
            right: 0,
            bottom: 0,
            child: AnimatedContainer(
              duration: const Duration(milliseconds: 250),
              curve: Curves.easeInOut,
              padding: const EdgeInsets.fromLTRB(20, 14, 20, 24),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A).withOpacity(0.97),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(26)),
                border: Border.all(color: Colors.white12),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.6),
                    blurRadius: 24,
                    offset: const Offset(0, -6),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Drag Handle & Expand Toggle
                  GestureDetector(
                    behavior: HitTestBehavior.opaque,
                    onTap: () {
                      setState(() => _isDetailsExpanded = !_isDetailsExpanded);
                    },
                    child: Center(
                      child: Container(
                        width: 44,
                        height: 5,
                        decoration: BoxDecoration(
                          color: Colors.white30,
                          borderRadius: BorderRadius.circular(10),
                        ),
                      ),
                    ),
                  ),
                  const SizedBox(height: 12),

                  if (_order.paymentStatus == 'rejected') ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 14),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF881337).withOpacity(0.92),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: const Color(0xFFF43F5E).withOpacity(0.4)),
                      ),
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(6),
                                decoration: const BoxDecoration(
                                  color: Color(0xFFE11D48),
                                  shape: BoxShape.circle,
                                ),
                                child: const Icon(Icons.warning_amber_rounded, color: Colors.white, size: 16),
                              ),
                              const SizedBox(width: 8),
                              Expanded(
                                child: Text(
                                  'Pago Móvil no verificado / En pausa',
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                              ),
                            ],
                          ),
                          const SizedBox(height: 8),
                          Text(
                            'El comercio no pudo confirmar la transferencia bancaria (${_order.paymentReference.isNotEmpty ? "Ref: #" + _order.paymentReference : "sin referencia"}). Para iniciar la preparación en cocina, reenvía el comprobante.',
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              color: const Color(0xFFFECDD3),
                              height: 1.3,
                            ),
                          ),
                          const SizedBox(height: 10),
                          Row(
                            children: [
                              Expanded(
                                child: ElevatedButton.icon(
                                  onPressed: _launchWhatsAppPaymentIssue,
                                  icon: const Icon(Icons.chat_rounded, size: 15),
                                  label: const Text('Enviar Capture WhatsApp'),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: const Color(0xFF22C55E),
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(vertical: 8),
                                    textStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                              OutlinedButton.icon(
                                onPressed: _showEditPaymentRefDialog,
                                icon: const Icon(Icons.edit, size: 14),
                                label: const Text('Corregir Ref'),
                                style: OutlinedButton.styleFrom(
                                  foregroundColor: Colors.white,
                                  side: const BorderSide(color: Colors.white30),
                                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                                  textStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],

                  // Delivery Timeline Stepper
                  Builder(
                    builder: (_) {
                      final step = _order.status.stepIndex;
                      final s0 = step >= 0;
                      final s1 = step >= 1;
                      final s2 = step >= 3;
                      final s3 = step >= 4;

                      return Row(
                        children: [
                          _buildStepNode('Confirmado', s0, isCurrent: step == 0),
                          Expanded(child: Container(height: 2, color: s1 ? AppTheme.primary : Colors.white24)),
                          _buildStepNode('En Cocina', s1, isCurrent: step == 1 || step == 2),
                          Expanded(child: Container(height: 2, color: s2 ? AppTheme.primary : Colors.white24)),
                          _buildStepNode('En Camino', s2, isCurrent: step == 3),
                          Expanded(child: Container(height: 2, color: s3 ? AppTheme.primary : Colors.white24)),
                          _buildStepNode('Entregado', s3, isCurrent: step == 4),
                        ],
                      );
                    },
                  ),

                  const SizedBox(height: 14),

                  if (!_hasRider)
                    // State: Searching for Rider / Waiting Merchant Confirmation
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(10),
                            decoration: BoxDecoration(
                              color: AppTheme.primary.withOpacity(0.12),
                              shape: BoxShape.circle,
                            ),
                            child: const SizedBox(
                              width: 22,
                              height: 22,
                              child: CircularProgressIndicator(
                                strokeWidth: 2.2,
                                color: AppTheme.primary,
                              ),
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _order.status == OrderDeliveryStatus.pending
                                      ? 'Esperando confirmación'
                                      : 'Buscando repartidor cercano...',
                                  style: GoogleFonts.outfit(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                                Text(
                                  _order.status == OrderDeliveryStatus.pending
                                      ? 'El restaurante está revisando tu orden'
                                      : 'Asignando el motorizado disponible más rápido',
                                  style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
                                ),
                              ],
                            ),
                          ),
                          IconButton.filledTonal(
                            tooltip: 'Contactar Comercio',
                            onPressed: _launchWhatsAppMerchant,
                            icon: const Icon(Icons.storefront_rounded, size: 20, color: AppTheme.primary),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFF334155),
                            ),
                          ),
                        ],
                      ),
                    )
                  else
                    // Rider Card & Communication (Only when rider is assigned)
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Row(
                        children: [
                          const CircleAvatar(
                            radius: 20,
                            backgroundImage: NetworkImage(
                              'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80',
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  _order.riderName,
                                  style: GoogleFonts.outfit(
                                    fontSize: 14,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                                Text(
                                  _order.status == OrderDeliveryStatus.atMerchant
                                      ? '¡Llegó al local! Retirando tu pedido • ${_order.riderVehicle}'
                                      : _order.status == OrderDeliveryStatus.onTheWay
                                          ? 'En ruta hacia ti • ${_order.riderVehicle} • ${_order.riderPlate}'
                                          : 'Rumbo al comercio • ${_order.riderVehicle} • ${_order.riderPlate}',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(
                                    fontSize: 11,
                                    color: _order.status == OrderDeliveryStatus.atMerchant
                                        ? const Color(0xFF38BDF8)
                                        : const Color(0xFF94A3B8),
                                    fontWeight: _order.status == OrderDeliveryStatus.atMerchant
                                        ? FontWeight.w700
                                        : FontWeight.normal,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          IconButton.filled(
                            onPressed: _launchWhatsAppRider,
                            icon: const Icon(Icons.chat_bubble_rounded, size: 18),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFF22C55E),
                              foregroundColor: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 6),
                          IconButton.filledTonal(
                            onPressed: _launchPhoneCallRider,
                            icon: const Icon(Icons.phone_rounded, size: 18),
                            style: IconButton.styleFrom(
                              backgroundColor: const Color(0xFF334155),
                              foregroundColor: Colors.white,
                            ),
                          ),
                        ],
                      ),
                    ),

                  
                  // Banner Adicionar Productos antes del Despacho
                  if (_order.status == OrderDeliveryStatus.pending ||
                      _order.status == OrderDeliveryStatus.confirmed ||
                      _order.status == OrderDeliveryStatus.preparing) ...[
                    Container(
                      margin: const EdgeInsets.only(bottom: 12),
                      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: AppTheme.primary.withOpacity(0.35)),
                      ),
                      child: Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(7),
                            decoration: BoxDecoration(
                              color: AppTheme.primary.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.add_shopping_cart_rounded, size: 18, color: AppTheme.primary),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  '¿Olvidaste algo en tu pedido?',
                                  style: GoogleFonts.outfit(
                                    fontSize: 12.5,
                                    fontWeight: FontWeight.w700,
                                    color: Colors.white,
                                  ),
                                ),
                                Text(
                                  'Tu orden está en preparación. Puedes adicionar productos.',
                                  style: GoogleFonts.outfit(
                                    fontSize: 10.5,
                                    color: Colors.white70,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          ElevatedButton.icon(
                            onPressed: () => _showAppendItemsSheet(context),
                            icon: const Icon(Icons.add_rounded, size: 15),
                            label: const Text('Añadir'),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: AppTheme.primary,
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                              textStyle: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],

                  const SizedBox(height: 12),

                  // Calificación de Repartidor cuando el pedido fue entregado
                  if (_order.status == OrderDeliveryStatus.delivered) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(
                          color: _hasRatedRider
                              ? const Color(0xFF10B981)
                              : AppTheme.amberAccent.withOpacity(0.5),
                        ),
                      ),
                      child: _hasRatedRider
                          ? Row(
                              children: [
                                const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 24),
                                const SizedBox(width: 12),
                                Expanded(
                                  child: Text(
                                    '¡Has calificado a ${_order.riderName.isNotEmpty ? _order.riderName : "tu repartidor"} con ${_selectedRiderRating.toInt()} ⭐! Gracias por tu opinión.',
                                    style: GoogleFonts.outfit(
                                      color: Colors.white,
                                      fontSize: 13,
                                      fontWeight: FontWeight.w600,
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Icon(Icons.star_rounded, color: AppTheme.amberAccent, size: 22),
                                    const SizedBox(width: 8),
                                    Text(
                                      'Califica el servicio de entrega',
                                      style: GoogleFonts.outfit(
                                        color: Colors.white,
                                        fontSize: 14,
                                        fontWeight: FontWeight.w800,
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  '¿Cómo fue tu experiencia con ${_order.riderName.isNotEmpty ? _order.riderName : "el repartidor"}?',
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFF94A3B8),
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: List.generate(5, (index) {
                                    final starValue = (index + 1).toDouble();
                                    return IconButton(
                                      onPressed: () {
                                        setState(() => _selectedRiderRating = starValue);
                                      },
                                      icon: Icon(
                                        starValue <= _selectedRiderRating
                                            ? Icons.star_rounded
                                            : Icons.star_outline_rounded,
                                        color: AppTheme.amberAccent,
                                        size: 32,
                                      ),
                                    );
                                  }),
                                ),
                                const SizedBox(height: 10),
                                SizedBox(
                                  width: double.infinity,
                                  height: 44,
                                  child: ElevatedButton(
                                    onPressed: _isSubmittingRating ? null : _submitRiderRating,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.amberAccent,
                                      foregroundColor: const Color(0xFF0F172A),
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    child: _isSubmittingRating
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Color(0xFF0F172A),
                                            ),
                                          )
                                        : Text(
                                            'Enviar Valoración',
                                            style: GoogleFonts.outfit(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                  ),
                                ),
                              ],
                            ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Calificar al comercio / tienda
                  if (_order.status == OrderDeliveryStatus.delivered && (_order.tenantId != null && _order.tenantId!.isNotEmpty)) ...[
                    Container(
                      padding: const EdgeInsets.all(16),
                      decoration: BoxDecoration(
                        color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                        borderRadius: BorderRadius.circular(20),
                        border: Border.all(
                          color: isDark ? Colors.white10 : const Color(0xFFE2E8F0),
                        ),
                      ),
                      child: _hasRatedStore
                          ? Row(
                              children: [
                                const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 24),
                                const SizedBox(width: 10),
                                Expanded(
                                  child: Text(
                                    '¡Has valorado a ${_order.tenantName.isNotEmpty ? _order.tenantName : "tu comercio"} con ${_selectedStoreRating.toInt()} ⭐! Gracias por tu opinión.',
                                    style: GoogleFonts.outfit(
                                      color: const Color(0xFF10B981),
                                      fontSize: 13,
                                      fontWeight: FontWeight.w700,
                                    ),
                                  ),
                                ),
                              ],
                            )
                          : Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  children: [
                                    const Text('🏪', style: TextStyle(fontSize: 18)),
                                    const SizedBox(width: 8),
                                    Expanded(
                                      child: Text(
                                        '¿Qué tal estuvo la comida de ${_order.tenantName.isNotEmpty ? _order.tenantName : "este comercio"}?',
                                        style: GoogleFonts.outfit(
                                          fontWeight: FontWeight.w800,
                                          fontSize: 14,
                                          color: isDark ? Colors.white : const Color(0xFF0F172A),
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 4),
                                Text(
                                  'Valora la calidad, empaque y sabor de tu pedido:',
                                  style: GoogleFonts.outfit(
                                    color: const Color(0xFF94A3B8),
                                    fontSize: 12,
                                  ),
                                ),
                                const SizedBox(height: 10),
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: List.generate(5, (index) {
                                    final starValue = (index + 1).toDouble();
                                    return IconButton(
                                      onPressed: () {
                                        setState(() => _selectedStoreRating = starValue);
                                      },
                                      icon: Icon(
                                        starValue <= _selectedStoreRating
                                            ? Icons.star_rounded
                                            : Icons.star_outline_rounded,
                                        color: AppTheme.amberAccent,
                                        size: 32,
                                      ),
                                    );
                                  }),
                                ),
                                const SizedBox(height: 6),
                                TextField(
                                  controller: _storeRatingCommentController,
                                  style: GoogleFonts.outfit(fontSize: 12.5, color: isDark ? Colors.white : Colors.black87),
                                  decoration: InputDecoration(
                                    hintText: 'Escribe un comentario sobre tu comida (opcional)...',
                                    hintStyle: GoogleFonts.outfit(fontSize: 12, color: Colors.grey),
                                    filled: true,
                                    fillColor: isDark ? const Color(0xFF0F172A) : Colors.white,
                                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                                    contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                                  ),
                                ),
                                const SizedBox(height: 10),
                                SizedBox(
                                  width: double.infinity,
                                  height: 42,
                                  child: ElevatedButton(
                                    onPressed: _isSubmittingStoreRating ? null : _submitStoreRating,
                                    style: ElevatedButton.styleFrom(
                                      backgroundColor: AppTheme.primary,
                                      foregroundColor: Colors.white,
                                      shape: RoundedRectangleBorder(
                                        borderRadius: BorderRadius.circular(12),
                                      ),
                                    ),
                                    child: _isSubmittingStoreRating
                                        ? const SizedBox(
                                            width: 20,
                                            height: 20,
                                            child: CircularProgressIndicator(
                                              strokeWidth: 2,
                                              color: Colors.white,
                                            ),
                                          )
                                        : Text(
                                            'Calificar Comercio ⭐',
                                            style: GoogleFonts.outfit(
                                              fontSize: 13,
                                              fontWeight: FontWeight.w800,
                                            ),
                                          ),
                                  ),
                                ),
                              ],
                            ),
                    ),
                    const SizedBox(height: 12),
                  ],

                  // Security PIN Card & Toggle Details Button
                  Row(
                    children: [
                      // PIN
                      Expanded(
                        child: Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: AppTheme.amberAccent.withOpacity(0.12),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: AppTheme.amberAccent.withOpacity(0.3)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.shield_rounded, color: AppTheme.amberAccent, size: 20),
                              const SizedBox(width: 10),
                              Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'PIN DE ENTREGA',
                                    style: GoogleFonts.outfit(
                                      fontSize: 10,
                                      fontWeight: FontWeight.w800,
                                      color: AppTheme.amberAccent,
                                      letterSpacing: 0.5,
                                    ),
                                  ),
                                  Text(
                                    _order.pin,
                                    style: GoogleFonts.outfit(
                                      fontSize: 20,
                                      fontWeight: FontWeight.w900,
                                      color: Colors.white,
                                      letterSpacing: 2,
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      // Expand / Collapse details button
                      OutlinedButton.icon(
                        onPressed: () {
                          setState(() => _isDetailsExpanded = !_isDetailsExpanded);
                        },
                        icon: Icon(
                          _isDetailsExpanded
                              ? Icons.keyboard_arrow_down_rounded
                              : Icons.keyboard_arrow_up_rounded,
                          size: 18,
                        ),
                        label: Text(_isDetailsExpanded ? 'Ocultar' : 'Detalles'),
                        style: OutlinedButton.styleFrom(
                          foregroundColor: Colors.white,
                          side: const BorderSide(color: Colors.white24),
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                        ),
                      ),
                    ],
                  ),

                  // Expandable Details (Addresses, Items, Total)
                  if (_isDetailsExpanded) ...[
                    const SizedBox(height: 14),

                    // Origin & Destination Addresses
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Column(
                        children: [
                          Row(
                            children: [
                              const Icon(Icons.storefront_rounded, color: AppTheme.amberAccent, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      _order.merchantName,
                                      style: GoogleFonts.outfit(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white,
                                      ),
                                    ),
                                    Text(
                                      _order.merchantAddress,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: const Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                          const Padding(
                            padding: EdgeInsets.symmetric(vertical: 6),
                            child: Divider(color: Colors.white10, height: 1),
                          ),
                          Row(
                            children: [
                              const Icon(Icons.location_on_rounded, color: AppTheme.riderAccent, size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${_order.customerName} (Destino)',
                                      style: GoogleFonts.outfit(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white,
                                      ),
                                    ),
                                    Text(
                                      _order.customerAddress,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: const Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),

                    const SizedBox(height: 12),

                    // Items and Total
                    Container(
                      padding: const EdgeInsets.all(12),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Column(
                        children: [
                          ..._order.items.map((item) => Padding(
                                padding: const EdgeInsets.only(bottom: 6),
                                child: Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      '${item.quantity}x ${item.product.name}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: Colors.white,
                                      ),
                                    ),
                                    Text(
                                      '\$${item.totalPrice.toStringAsFixed(2)}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w700,
                                        color: Colors.white70,
                                      ),
                                    ),
                                  ],
                                ),
                              )),
                          const Divider(color: Colors.white10, height: 12),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Costo de Envío:',
                                style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                              ),
                              Text(
                                '\$${_order.deliveryFee.toStringAsFixed(2)}',
                                style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70),
                              ),
                            ],
                          ),
                          const SizedBox(height: 4),
                          Row(
                            mainAxisAlignment: MainAxisAlignment.spaceBetween,
                            children: [
                              Text(
                                'Total Pagado:',
                                style: GoogleFonts.outfit(
                                  fontSize: 13,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                '\$${_order.total.toStringAsFixed(2)}',
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: AppTheme.riderAccent,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  // --- MAP MARKER WIDGETS ---

  Widget _buildMerchantMapPin() {
    final storeName = _order.merchantName.trim().isNotEmpty
        ? _order.merchantName.trim()
        : 'Comercio';
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B).withOpacity(0.95),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: AppTheme.amberAccent, width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.4),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            '🏪 $storeName',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const Icon(Icons.location_on_rounded, color: AppTheme.amberAccent, size: 34),
      ],
    );
  }

  Widget _buildCustomerMapPin() {
    final clientName = _order.customerName.trim().isNotEmpty
        ? _order.customerName.trim()
        : 'Tu Ubicación';
    return Column(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B).withOpacity(0.95),
            borderRadius: BorderRadius.circular(8),
            border: Border.all(color: const Color(0xFF10B981), width: 1.2),
            boxShadow: [
              BoxShadow(
                color: Colors.black.withOpacity(0.4),
                blurRadius: 6,
                offset: const Offset(0, 2),
              ),
            ],
          ),
          child: Text(
            '🏠 $clientName',
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.outfit(
              color: Colors.white,
              fontSize: 10,
              fontWeight: FontWeight.w800,
            ),
          ),
        ),
        const Icon(Icons.location_on_rounded, color: Color(0xFF10B981), size: 34),
      ],
    );
  }

  Widget _buildRiderMapPin() {
    return AnimatedBuilder(
      animation: _animController,
      builder: (context, _) {
        final pulse = 4.0 * math.sin(_animController.value * math.pi * 2);
        return Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A).withOpacity(0.95),
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppTheme.riderAccent, width: 1.5),
                boxShadow: [
                  BoxShadow(
                    color: AppTheme.riderAccent.withOpacity(0.3),
                    blurRadius: 8,
                    offset: const Offset(0, 2),
                  ),
                ],
              ),
              child: Text(
                _order.status == OrderDeliveryStatus.atMerchant
                    ? '🛵 ${_order.riderName.isNotEmpty ? _order.riderName : "Repartidor"} • En el local'
                    : '🛵 ${_order.riderName.isNotEmpty ? _order.riderName : "Repartidor"} • ~$_estimatedMinutes min',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: GoogleFonts.outfit(
                  color: AppTheme.riderAccent,
                  fontSize: 10,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
            const SizedBox(height: 2),
            Stack(
              alignment: Alignment.center,
              children: [
                // Pulse wave
                Container(
                  width: 38 + pulse,
                  height: 38 + pulse,
                  decoration: BoxDecoration(
                    shape: BoxShape.circle,
                    color: AppTheme.riderAccent.withOpacity(0.25),
                  ),
                ),
                // Rider circle
                Container(
                  width: 32,
                  height: 32,
                  decoration: BoxDecoration(
                    color: const Color(0xFF0F172A),
                    shape: BoxShape.circle,
                    border: Border.all(color: AppTheme.riderAccent, width: 2.5),
                  ),
                  child: const Center(
                    child: Icon(Icons.two_wheeler_rounded, color: AppTheme.riderAccent, size: 18),
                  ),
                ),
              ],
            ),
          ],
        );
      },
    );
  }

  Widget _buildStepNode(String title, bool done, {bool isCurrent = false}) {
    return Column(
      children: [
        Container(
          width: 22,
          height: 22,
          decoration: BoxDecoration(
            color: done ? AppTheme.primary : const Color(0xFF334155),
            shape: BoxShape.circle,
            border: isCurrent ? Border.all(color: Colors.white, width: 2) : null,
          ),
          child: Center(
            child: isCurrent
                ? const Icon(Icons.two_wheeler_rounded, size: 12, color: Colors.white)
                : const Icon(Icons.check, size: 12, color: Colors.white),
          ),
        ),
        const SizedBox(height: 4),
        Text(
          title,
          style: GoogleFonts.outfit(
            fontSize: 10,
            fontWeight: isCurrent ? FontWeight.w800 : FontWeight.w500,
            color: isCurrent ? Colors.white : const Color(0xFF94A3B8),
          ),
        ),
      ],
    );
  }

  Widget _buildMapToolButton({
    required IconData icon,
    required String tooltip,
    required Color color,
    required VoidCallback onTap,
  }) {
    return Tooltip(
      message: tooltip,
      child: Material(
        color: const Color(0xFF1E293B).withOpacity(0.92),
        borderRadius: BorderRadius.circular(12),
        elevation: 6,
        child: InkWell(
          borderRadius: BorderRadius.circular(12),
          onTap: onTap,
          child: Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              borderRadius: BorderRadius.circular(12),
              border: Border.all(color: Colors.white12),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
        ),
      ),
    );
  }
}
