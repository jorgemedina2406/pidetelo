import 'dart:async';
import 'dart:convert';
import 'dart:math';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart' as ll;
import 'package:supabase_flutter/supabase_flutter.dart';
import 'package:url_launcher/url_launcher.dart';
import '../../../core/models/order_model.dart';
import '../../../core/services/rider_service.dart';
import '../../../core/services/rider_location_service.dart';
import '../../../core/theme/app_theme.dart';

class RiderNavigationScreen extends StatefulWidget {
  final DeliveryOrder order;

  const RiderNavigationScreen({super.key, required this.order});

  @override
  State<RiderNavigationScreen> createState() => _RiderNavigationScreenState();
}

class _RiderNavigationScreenState extends State<RiderNavigationScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late DeliveryOrder _order;
  final TextEditingController _pinController = TextEditingController();
  final MapController _mapController = MapController();

  double _riderProgress = 0.0;
  bool _isDarkMap = true;
  late List<ll.LatLng> _routePoints;
  int _estimatedMinutes = 7;
  double _distanceKm = 4.29;

  ll.LatLng? _displayedRiderCoord;
  ll.LatLng? _targetRiderCoord;
  ll.LatLng? _lastRoutedOrigin;
  bool _isFetchingRoute = false;
  Timer? _smoothGlideTimer;

  @override
  void initState() {
    super.initState();
    _order = widget.order;
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(seconds: 3),
    )..repeat();

    final initPos = RiderLocationService().currentPosition;
    if (initPos != null) {
      _displayedRiderCoord = ll.LatLng(initPos.latitude, initPos.longitude);
      _targetRiderCoord = _displayedRiderCoord;
    }

    _routePoints = [
      _displayedRiderCoord ?? ll.LatLng(_order.merchantLat, _order.merchantLng),
      ll.LatLng(_order.customerLat, _order.customerLng),
    ];

    _riderProgress = 0.0;

    _loadDynamicFastestRoute();

    // Conectar rastreo por sensor satelital en vivo con la orden activa
    RiderLocationService().setActiveOrderId(_order.id);
    RiderLocationService().addListener(_onGpsUpdate);

    // Interpolación suave a 25 FPS para eliminar saltos bruscos del marcador
    _smoothGlideTimer = Timer.periodic(const Duration(milliseconds: 40), (_) {
      if (!mounted || _targetRiderCoord == null) return;
      if (_displayedRiderCoord == null) {
        setState(() => _displayedRiderCoord = _targetRiderCoord);
        return;
      }
      final dLat = _targetRiderCoord!.latitude - _displayedRiderCoord!.latitude;
      final dLng = _targetRiderCoord!.longitude - _displayedRiderCoord!.longitude;
      if (dLat.abs() < 0.000002 && dLng.abs() < 0.000002) return;
      setState(() {
        _displayedRiderCoord = ll.LatLng(
          _displayedRiderCoord!.latitude + dLat * 0.22,
          _displayedRiderCoord!.longitude + dLng * 0.22,
        );
      });
    });

    // Emitir telemetría inicial en la posición actual
    final cur = _riderCurrentLatLng;
    RiderService().sendTelemetry(cur.latitude, cur.longitude, orderId: _order.id);
  }

  double _haversineKm(double lat1, double lon1, double lat2, double lon2) {
    const r = 6371.0;
    final dLat = (lat2 - lat1) * pi / 180.0;
    final dLon = (lon2 - lon1) * pi / 180.0;
    final a = sin(dLat / 2) * sin(dLat / 2) +
        cos(lat1 * pi / 180.0) *
            cos(lat2 * pi / 180.0) *
            sin(dLon / 2) *
            sin(dLon / 2);
    final c = 2 * atan2(sqrt(a), sqrt(1 - a));
    return r * c;
  }

  void _onGpsUpdate() {
    if (!mounted) return;
    final pos = RiderLocationService().currentPosition;
    if (pos != null) {
      _targetRiderCoord = ll.LatLng(pos.latitude, pos.longitude);
      _displayedRiderCoord ??= _targetRiderCoord;

      // Recalcular ruta óptima en vivo si el repartidor se desplazó más de 35 metros
      final movedKm = _lastRoutedOrigin != null
          ? _haversineKm(
              pos.latitude,
              pos.longitude,
              _lastRoutedOrigin!.latitude,
              _lastRoutedOrigin!.longitude,
            )
          : 999.0;
      if (movedKm > 0.035 && !_isFetchingRoute) {
        _loadDynamicFastestRoute(fromLat: pos.latitude, fromLng: pos.longitude);
      }

      if (_routePoints.isNotEmpty) {
        int closestIdx = 0;
        double minDist = double.infinity;
        for (int i = 0; i < _routePoints.length; i++) {
          final d = _haversineKm(
            pos.latitude,
            pos.longitude,
            _routePoints[i].latitude,
            _routePoints[i].longitude,
          );
          if (d < minDist) {
            minDist = d;
            closestIdx = i;
          }
        }
        setState(() {
          if (_order.status == OrderDeliveryStatus.onTheWay) {
            _riderProgress = (closestIdx / max(1, _routePoints.length - 1)).clamp(0.0, 1.0);
          }
        });
        return;
      }
    }
    setState(() {});
  }

  Future<void> _loadDynamicFastestRoute({double? fromLat, double? fromLng}) async {
    if (_isFetchingRoute) return;
    _isFetchingRoute = true;
    try {
      final pos = RiderLocationService().currentPosition;
      final originLat = fromLat ?? pos?.latitude ?? _order.merchantLat;
      final originLng = fromLng ?? pos?.longitude ?? _order.merchantLng;

      // Determinar destino activo: si aún va rumbo al comercio y está a >90m del comercio, trazar hacia el comercio; de lo contrario hacia el cliente
      final distToMerchantKm = _haversineKm(originLat, originLng, _order.merchantLat, _order.merchantLng);
      final bool headingToMerchant = (_order.status == OrderDeliveryStatus.assigned ||
              _order.status == OrderDeliveryStatus.pending ||
              _order.status == OrderDeliveryStatus.confirmed ||
              _order.status == OrderDeliveryStatus.preparing) &&
          distToMerchantKm > 0.09;

      final destLat = headingToMerchant ? _order.merchantLat : _order.customerLat;
      final destLng = headingToMerchant ? _order.merchantLng : _order.customerLng;

      _lastRoutedOrigin = ll.LatLng(originLat, originLng);

      final coordsParam = '$originLng,$originLat;$destLng,$destLat';
      final endpoints = [
        'https://routing.openstreetmap.de/routed-car/route/v1/driving/$coordsParam?overview=full&geometries=geojson&alternatives=3&continue_straight=false',
        'https://router.project-osrm.org/route/v1/driving/$coordsParam?overview=full&geometries=geojson&alternatives=3&continue_straight=false',
        'https://routing.openstreetmap.de/routed-bike/route/v1/driving/$coordsParam?overview=full&geometries=geojson&alternatives=3&continue_straight=false',
      ];

      final responses = await Future.wait(
        endpoints.map((url) async {
          try {
            final res = await http
                .get(Uri.parse(url), headers: {'User-Agent': 'RiderApp/1.0'})
                .timeout(const Duration(seconds: 4));
            if (res.statusCode == 200) {
              return json.decode(res.body) as Map<String, dynamic>;
            }
          } catch (_) {}
          return null;
        }),
      );

      double bestScore = double.infinity;
      double bestDistanceKm = 0;
      int bestDurationMins = 1;
      List<ll.LatLng> bestPoints = [];

      for (final data in responses) {
        if (data == null || data['code'] != 'Ok' || data['routes'] == null) continue;
        final routes = data['routes'] as List;
        for (final r in routes) {
          final rawCoords = r['geometry']?['coordinates'] as List?;
          if (rawCoords == null || rawCoords.length < 2) continue;
          final distKm = ((r['distance'] as num).toDouble()) / 1000.0;
          final rawDurMins = ((r['duration'] as num).toDouble()) / 60.0;
          final avgSpeedMins = (distKm / 30.0) * 60.0;
          final motoMins = max(1, (min(rawDurMins, avgSpeedMins * 1.15) * 0.85).round());
          final score = (distKm * 1.7) + (motoMins * 0.3);

          if (score < bestScore) {
            bestScore = score;
            bestDistanceKm = double.parse(distKm.toStringAsFixed(2));
            bestDurationMins = motoMins.clamp(1, 180);
            bestPoints = rawCoords
                .map<ll.LatLng>((c) => ll.LatLng((c[1] as num).toDouble(), (c[0] as num).toDouble()))
                .toList();
          }
        }
      }

      if (mounted && bestPoints.isNotEmpty) {
        setState(() {
          _routePoints = bestPoints;
          _distanceKm = bestDistanceKm;
          _estimatedMinutes = bestDurationMins;
          _riderProgress = 0.0;
        });
      }
    } catch (e) {
      debugPrint('[RiderNav] Optimal route fetch error: $e');
    } finally {
      _isFetchingRoute = false;
    }
  }

  @override
  void dispose() {
    _smoothGlideTimer?.cancel();
    RiderLocationService().setActiveOrderId(null);
    RiderLocationService().removeListener(_onGpsUpdate);
    _animController.dispose();
    _pinController.dispose();
    super.dispose();
  }

  ll.LatLng get _riderCurrentLatLng {
    if (_displayedRiderCoord != null) {
      return _displayedRiderCoord!;
    }
    final realPos = RiderLocationService().currentPosition;
    if (realPos != null) {
      return ll.LatLng(realPos.latitude, realPos.longitude);
    }

    if (_routePoints.isEmpty ||
        (_order.status != OrderDeliveryStatus.onTheWay &&
            _order.status != OrderDeliveryStatus.delivered)) {
      return ll.LatLng(_order.merchantLat, _order.merchantLng);
    }
    final targetIdx = (_riderProgress.clamp(0.0, 1.0) * (_routePoints.length - 1)).round();
    return _routePoints[targetIdx];
  }

  List<ll.LatLng> get _traversedPoints {
    if (_routePoints.isEmpty ||
        (_order.status != OrderDeliveryStatus.onTheWay &&
            _order.status != OrderDeliveryStatus.delivered)) {
      return [];
    }
    final targetIdx = (_riderProgress.clamp(0.0, 1.0) * (_routePoints.length - 1)).round();
    if (targetIdx <= 0) return [];
    return _routePoints.sublist(0, targetIdx + 1);
  }

  void _centerOnMoto() {
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

  Future<void> _launchWhatsApp() async {
    final phone = _order.customerPhone.replaceAll('+', '').replaceAll(' ', '');
    final message = Uri.encodeComponent(
      '¡Hola ${_order.customerName}! Soy tu repartidor ${_order.riderName} de DeliveryHub. Voy en camino con tu pedido ${_order.orderNumber} 🛵',
    );
    final url = Uri.parse('https://wa.me/$phone?text=$message');
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

  Future<void> _launchPhoneCall() async {
    final url = Uri.parse('tel:${_order.customerPhone}');
    try {
      if (await canLaunchUrl(url)) {
        await launchUrl(url);
      } else {
        _showToast('Llamando a ${_order.customerPhone}');
      }
    } catch (_) {
      _showToast('Llamando a ${_order.customerPhone}');
    }
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

  void _advanceOrderState() {
    if (_order.status == OrderDeliveryStatus.onTheWay) {
      _showPinVerificationDialog();
      return;
    }

    final riderService = RiderService();
    setState(() {
      if (_order.status == OrderDeliveryStatus.assigned ||
          _order.status == OrderDeliveryStatus.pending ||
          _order.status == OrderDeliveryStatus.confirmed ||
          _order.status == OrderDeliveryStatus.preparing) {
        _order.status = OrderDeliveryStatus.atMerchant;
        _riderProgress = 0.0;
      } else if (_order.status == OrderDeliveryStatus.atMerchant ||
                 _order.status == OrderDeliveryStatus.pickedUp) {
        _order.status = OrderDeliveryStatus.onTheWay;
        _riderProgress = 0.0;
      }
    });

    riderService.updateOrderStatus(_order.status);
    final cur = _riderCurrentLatLng;
    riderService.sendTelemetry(cur.latitude, cur.longitude, orderId: _order.id);
    _loadDynamicFastestRoute(fromLat: cur.latitude, fromLng: cur.longitude);

    _showToast('Estado actualizado: ${_order.status.label}');
  }

  void _showPinVerificationDialog() {
    _pinController.clear();
    String? pinError;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) => Padding(
          padding: EdgeInsets.only(
            left: 24,
            right: 24,
            top: 24,
            bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 48,
                  height: 4,
                  decoration: BoxDecoration(
                    color: Colors.white24,
                    borderRadius: BorderRadius.circular(10),
                  ),
                ),
              ),
              const SizedBox(height: 20),
              Center(
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: AppTheme.primary.withOpacity(0.12),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.verified_user_rounded, size: 36, color: AppTheme.primary),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                'Confirmar Entrega',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(
                  fontSize: 22,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              const SizedBox(height: 6),
              Text(
                'Solicita el código PIN de 4 dígitos al cliente (${_order.customerName}) para finalizar la entrega.',
                textAlign: TextAlign.center,
                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
              ),
              const SizedBox(height: 24),
              TextField(
                controller: _pinController,
                keyboardType: TextInputType.number,
                maxLength: 4,
                textAlign: TextAlign.center,
                autofocus: true,
                onChanged: (_) {
                  if (pinError != null) {
                    setModalState(() => pinError = null);
                  }
                },
                style: GoogleFonts.outfit(
                  fontSize: 28,
                  fontWeight: FontWeight.w800,
                  letterSpacing: 16,
                  color: Colors.white,
                ),
                decoration: InputDecoration(
                  counterText: '',
                  hintText: '••••',
                  hintStyle: GoogleFonts.outfit(
                    fontSize: 28,
                    letterSpacing: 16,
                    color: const Color(0xFF475569),
                  ),
                  filled: true,
                  fillColor: const Color(0xFF1E293B),
                  border: OutlineInputBorder(
                    borderRadius: BorderRadius.circular(16),
                    borderSide: const BorderSide(color: Color(0xFF334155)),
                  ),
                ),
              ),
              if (pinError != null) ...[
                const SizedBox(height: 12),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                  decoration: BoxDecoration(
                    color: Colors.redAccent.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: Colors.redAccent.withOpacity(0.4)),
                  ),
                  child: Text(
                    pinError!,
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(
                      fontSize: 13,
                      fontWeight: FontWeight.w600,
                      color: Colors.redAccent,
                    ),
                  ),
                ),
              ],
              const SizedBox(height: 20),
              ElevatedButton(
                onPressed: () async {
                  final entered = _pinController.text.trim();
                  if (entered.length < 4) {
                    setModalState(() {
                      pinError = 'Por favor ingresa los 4 dígitos del PIN';
                    });
                    return;
                  }

                  // Determine expected PIN:
                  String expectedPin = _order.pin.trim();

                  // If _order.pin is empty, attempt to read [PIN:XXXX] from order notes
                  if (expectedPin.isEmpty) {
                    try {
                      final supabase = Supabase.instance.client;
                      final row = await supabase
                          .from('orders')
                          .select('notes, order_number')
                          .eq('id', _order.id)
                          .maybeSingle();
                      if (row != null) {
                        final notes = (row['notes'] ?? '').toString();
                        if (notes.contains('[PIN:')) {
                          final m = RegExp(r'\[PIN:(\d{4})\]').firstMatch(notes);
                          if (m != null) expectedPin = m.group(1)!;
                        }
                      }
                    } catch (_) {}
                  }

                  // Order number digits (e.g. ORD-6420 -> 6420)
                  final orderDigits = _order.orderNumber.replaceAll(RegExp(r'\D'), '');
                  final orderNumPin = orderDigits.length >= 4
                      ? orderDigits.substring(orderDigits.length - 4)
                      : '';

                  // Strictly validate: entered PIN must match the order's real PIN or order number digits
                  final isValid = (expectedPin.isNotEmpty && entered == expectedPin) ||
                                  (orderNumPin.isNotEmpty && entered == orderNumPin);

                  if (isValid) {
                    Navigator.of(ctx).pop();
                    _completeDelivery();
                  } else {
                    setModalState(() {
                      pinError = 'PIN incorrecto. El cliente ve su PIN en la app.';
                    });
                  }
                },
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  foregroundColor: Colors.white,
                  padding: const EdgeInsets.symmetric(vertical: 16),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                ),
                child: Text(
                  'Validar y Finalizar Entrega',
                  style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _completeDelivery() async {
    final riderService = RiderService();
    setState(() {
      _order.status = OrderDeliveryStatus.delivered;
      _riderProgress = 1.0;
      _distanceKm = 0.0;
      _estimatedMinutes = 0;
    });

    final cur = _riderCurrentLatLng;
    await riderService.sendTelemetry(cur.latitude, cur.longitude, speedKmh: 0.0, orderId: _order.id);
    await riderService.updateOrderStatus(OrderDeliveryStatus.delivered);

    if (!mounted) return;
    showDialog(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF0F172A),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Container(
              padding: const EdgeInsets.all(18),
              decoration: BoxDecoration(
                color: AppTheme.primary.withOpacity(0.15),
                shape: BoxShape.circle,
              ),
              child: const Icon(Icons.check_circle_rounded, size: 48, color: AppTheme.primary),
            ),
            const SizedBox(height: 18),
            Text(
              '¡Entrega Completada!',
              style: GoogleFonts.outfit(
                fontSize: 22,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              'Has recibido \$${_order.deliveryFee.toStringAsFixed(2)} por esta entrega. El saldo ya está en tu billetera.',
              textAlign: TextAlign.center,
              style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: () {
                Navigator.of(ctx).pop();
                Navigator.of(context).pop(); // Back to home
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                padding: const EdgeInsets.symmetric(horizontal: 32, vertical: 14),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
              ),
              child: Text(
                'Volver al Panel',
                style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final riderPos = _riderCurrentLatLng;
    final merchantPos = ll.LatLng(_order.merchantLat, _order.merchantLng);
    final customerPos = ll.LatLng(_order.customerLat, _order.customerLng);

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Stack(
        children: [
          // 1. Live Flutter Map
          FlutterMap(
            mapController: _mapController,
            options: MapOptions(
              initialCenter: riderPos,
              initialZoom: 15.0,
              minZoom: 10.0,
              maxZoom: 18.0,
            ),
            children: [
              TileLayer(
                urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                userAgentPackageName: 'com.deliveryhub.rider_app',
                maxZoom: 19,
              ),

              // Full route polyline
              PolylineLayer(
                polylines: [
                  // Glow / Casing border for high contrast against any map style
                  Polyline(
                    points: _routePoints,
                    strokeWidth: 7.0,
                    color: const Color(0xFF0284C7).withOpacity(0.55),
                  ),
                  // Full route road line (Vivid Cyan)
                  Polyline(
                    points: _routePoints,
                    strokeWidth: 4.8,
                    color: const Color(0xFF06B6D4),
                  ),
                  // Traversed route segment (Vivid Green)
                  if (_traversedPoints.isNotEmpty)
                    Polyline(
                      points: _traversedPoints,
                      strokeWidth: 5.2,
                      color: const Color(0xFF10B981),
                    ),
                ],
              ),

              // Markers
              MarkerLayer(
                markers: [
                  // Merchant marker
                  Marker(
                    point: merchantPos,
                    width: 44,
                    height: 44,
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppTheme.orangeAccent,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.storefront_rounded, color: Colors.white, size: 22),
                    ),
                  ),

                  // Customer marker
                  Marker(
                    point: customerPos,
                    width: 44,
                    height: 44,
                    child: Container(
                      decoration: BoxDecoration(
                        color: Colors.blueAccent,
                        shape: BoxShape.circle,
                        border: Border.all(color: Colors.white, width: 2),
                        boxShadow: [
                          BoxShadow(
                            color: Colors.black.withOpacity(0.3),
                            blurRadius: 8,
                            offset: const Offset(0, 3),
                          ),
                        ],
                      ),
                      child: const Icon(Icons.person_pin_circle_rounded, color: Colors.white, size: 26),
                    ),
                  ),

                  // Rider marker
                  Marker(
                    point: riderPos,
                    width: 52,
                    height: 52,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        AnimatedBuilder(
                          animation: _animController,
                          builder: (context, child) {
                            return Container(
                              width: 40 + (_animController.value * 12),
                              height: 40 + (_animController.value * 12),
                              decoration: BoxDecoration(
                                shape: BoxShape.circle,
                                color: AppTheme.primary.withOpacity(0.3 * (1 - _animController.value)),
                              ),
                            );
                          },
                        ),
                        Container(
                          width: 36,
                          height: 36,
                          decoration: BoxDecoration(
                            color: AppTheme.primary,
                            shape: BoxShape.circle,
                            border: Border.all(color: Colors.white, width: 2.5),
                            boxShadow: [
                              BoxShadow(
                                color: Colors.black.withOpacity(0.3),
                                blurRadius: 6,
                              ),
                            ],
                          ),
                          child: const Icon(Icons.two_wheeler_rounded, color: Colors.white, size: 20),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ],
          ),

          // 2. Top Header Bar
          Positioned(
            top: 0,
            left: 0,
            right: 0,
            child: Container(
              padding: EdgeInsets.only(
                top: MediaQuery.of(context).padding.top + 8,
                left: 16,
                right: 16,
                bottom: 12,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                  colors: [
                    const Color(0xFF0F172A).withOpacity(0.95),
                    Colors.transparent,
                  ],
                ),
              ),
              child: Row(
                children: [
                  CircleAvatar(
                    backgroundColor: const Color(0xFF1E293B),
                    child: IconButton(
                      icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 18, color: Colors.white),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          _order.orderNumber,
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          _order.status.label,
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ],
                    ),
                  ),
                  // Map Theme Toggle
                  CircleAvatar(
                    backgroundColor: const Color(0xFF1E293B),
                    child: IconButton(
                      icon: Icon(
                        _isDarkMap ? Icons.wb_sunny_rounded : Icons.nightlight_round,
                        size: 20,
                        color: Colors.amberAccent,
                      ),
                      onPressed: () => setState(() => _isDarkMap = !_isDarkMap),
                    ),
                  ),
                ],
              ),
            ),
          ),

          // 3. Map Controls (Zoom, Center)
          Positioned(
            right: 16,
            bottom: 270,
            child: Column(
              children: [
                _buildMapButton(Icons.add_rounded, _zoomIn),
                const SizedBox(height: 8),
                _buildMapButton(Icons.remove_rounded, _zoomOut),
                const SizedBox(height: 8),
                _buildMapButton(Icons.navigation_rounded, _centerOnMoto, color: AppTheme.primary),
                const SizedBox(height: 8),
                _buildMapButton(Icons.route_rounded, _fitEntireRoute),
              ],
            ),
          ),

          // 4. Bottom Delivery Panel
          Positioned(
            left: 16,
            right: 16,
            bottom: 16,
            child: Container(
              padding: const EdgeInsets.all(20),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(24),
                border: Border.all(color: const Color(0xFF334155)),
                boxShadow: [
                  BoxShadow(
                    color: Colors.black.withOpacity(0.4),
                    blurRadius: 20,
                    offset: const Offset(0, 8),
                  ),
                ],
              ),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  // Client info & Contact
                  Row(
                    children: [
                      CircleAvatar(
                        radius: 20,
                        backgroundColor: AppTheme.primary.withOpacity(0.15),
                        child: Text(
                          _order.customerName.isNotEmpty ? _order.customerName[0].toUpperCase() : 'C',
                          style: GoogleFonts.outfit(
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              _order.customerName,
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            Text(
                              _order.customerAddress,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(
                                fontSize: 12,
                                color: const Color(0xFF94A3B8),
                              ),
                            ),
                          ],
                        ),
                      ),
                      IconButton(
                        onPressed: _launchWhatsApp,
                        icon: const Icon(Icons.chat_bubble_outline_rounded, color: Colors.greenAccent),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.greenAccent.withOpacity(0.12),
                        ),
                      ),
                      const SizedBox(width: 6),
                      IconButton(
                        onPressed: _launchPhoneCall,
                        icon: const Icon(Icons.phone_rounded, color: Colors.blueAccent),
                        style: IconButton.styleFrom(
                          backgroundColor: Colors.blueAccent.withOpacity(0.12),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  const Divider(color: Color(0xFF334155), height: 1),
                  const SizedBox(height: 14),

                  // Distance & Fee metrics
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.near_me_rounded, size: 16, color: AppTheme.primary),
                          const SizedBox(width: 6),
                          Text(
                            '$_distanceKm km • ~$_estimatedMinutes min',
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              fontWeight: FontWeight.w600,
                              color: Colors.white70,
                            ),
                          ),
                        ],
                      ),
                      Text(
                        'Ganancia: \$${_order.deliveryFee.toStringAsFixed(2)}',
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w800,
                          color: AppTheme.primary,
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Action Button
                  ElevatedButton(
                    onPressed: _advanceOrderState,
                    style: ElevatedButton.styleFrom(
                      backgroundColor: _getActionColor(),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(16),
                      ),
                    ),
                    child: Text(
                      _getActionLabel(),
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildMapButton(IconData icon, VoidCallback onTap, {Color? color}) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        shape: BoxShape.circle,
        border: Border.all(color: const Color(0xFF334155)),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(0.3),
            blurRadius: 8,
          ),
        ],
      ),
      child: IconButton(
        icon: Icon(icon, size: 20, color: color ?? Colors.white),
        onPressed: onTap,
      ),
    );
  }

  Color _getActionColor() {
    switch (_order.status) {
      case OrderDeliveryStatus.assigned:
      case OrderDeliveryStatus.pending:
      case OrderDeliveryStatus.confirmed:
      case OrderDeliveryStatus.preparing:
        return AppTheme.orangeAccent;
      case OrderDeliveryStatus.atMerchant:
      case OrderDeliveryStatus.pickedUp:
      case OrderDeliveryStatus.onTheWay:
        return AppTheme.primary;
      default:
        return AppTheme.primary;
    }
  }

  String _getActionLabel() {
    switch (_order.status) {
      case OrderDeliveryStatus.assigned:
      case OrderDeliveryStatus.pending:
      case OrderDeliveryStatus.confirmed:
      case OrderDeliveryStatus.preparing:
        return 'Llegué al Comercio';
      case OrderDeliveryStatus.atMerchant:
      case OrderDeliveryStatus.pickedUp:
        return 'Pedido Recogido (En Camino)';
      case OrderDeliveryStatus.onTheWay:
        return 'Completar Entrega (Pedir PIN)';
      default:
        return 'Entrega Completada';
    }
  }
}
