import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:geolocator/geolocator.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/app_config.dart';

class RiderLocationService extends ChangeNotifier {
  static final RiderLocationService _instance = RiderLocationService._internal();
  factory RiderLocationService() => _instance;
  RiderLocationService._internal();

  StreamSubscription<Position>? _positionStreamSubscription;
  Timer? _periodicPingTimer;
  RealtimeChannel? _activeTelemetryChannel;
  String? _subscribedTelemetryOrderId;
  bool _isBroadcasting = false;

  Position? _currentPosition;
  bool _isGpsActive = false;
  bool _permissionDenied = false;
  String? _currentRiderId;
  String? _activeOrderId;

  Position? get currentPosition => _currentPosition;
  bool get isGpsActive => _isGpsActive;
  bool get permissionDenied => _permissionDenied;
  double? get currentLat => _currentPosition?.latitude;
  double? get currentLng => _currentPosition?.longitude;

  /// Inicia el rastreo por sensor satelital GPS continuo del teléfono en alta frecuencia
  Future<void> startTracking(String riderId, {String? activeOrderId}) async {
    _currentRiderId = riderId;
    if (activeOrderId != null) {
      setActiveOrderId(activeOrderId);
    }

    try {
      // 1. Verificar si el servicio de ubicación del sistema operativo está encendido
      bool serviceEnabled = await Geolocator.isLocationServiceEnabled();
      if (!serviceEnabled) {
        debugPrint('[RiderLocationService] Servicio de GPS del dispositivo está desactivado.');
        _isGpsActive = false;
        notifyListeners();
      }

      // 2. Verificar y solicitar permisos de GPS
      LocationPermission permission = await Geolocator.checkPermission();
      if (permission == LocationPermission.denied) {
        permission = await Geolocator.requestPermission();
        if (permission == LocationPermission.denied) {
          debugPrint('[RiderLocationService] Permiso de ubicación denegado por el usuario.');
          _permissionDenied = true;
          _isGpsActive = false;
          notifyListeners();
          return;
        }
      }

      if (permission == LocationPermission.deniedForever) {
        debugPrint('[RiderLocationService] Permiso de ubicación denegado permanentemente.');
        _permissionDenied = true;
        _isGpsActive = false;
        notifyListeners();
        return;
      }

      _permissionDenied = false;

      // 3. Obtener fijación inicial del sensor GPS con precisión de navegación
      try {
        final initialPos = await Geolocator.getCurrentPosition(
          locationSettings: const LocationSettings(
            accuracy: LocationAccuracy.bestForNavigation,
            timeLimit: Duration(seconds: 6),
          ),
        );
        _onPositionUpdate(initialPos);
      } catch (e) {
        debugPrint('[RiderLocationService] Error obteniendo posición inicial: $e');
      }

      // 4. Suscribirse al flujo continuo de GPS de alta frecuencia (cada ~800ms y sin salto de 5m)
      _positionStreamSubscription?.cancel();
      final LocationSettings locationSettings = defaultTargetPlatform == TargetPlatform.android
          ? AndroidSettings(
              accuracy: LocationAccuracy.bestForNavigation,
              distanceFilter: 0,
              intervalDuration: const Duration(milliseconds: 800),
            )
          : const LocationSettings(
              accuracy: LocationAccuracy.bestForNavigation,
              distanceFilter: 0,
            );

      _positionStreamSubscription = Geolocator.getPositionStream(
        locationSettings: locationSettings,
      ).listen(
        _onPositionUpdate,
        onError: (err) {
          debugPrint('[RiderLocationService] Error en stream de GPS: $err');
          _isGpsActive = false;
          notifyListeners();
        },
      );

      // 5. Ping continuo de alta frecuencia cada 1 segundo para fluidez en tiempo real
      _periodicPingTimer?.cancel();
      _periodicPingTimer = Timer.periodic(const Duration(milliseconds: 1000), (_) async {
        if (_currentPosition != null && _currentRiderId != null) {
          _broadcastLocationToBackendAndSupabase(_currentPosition!);
        }
      });

      _isGpsActive = true;
      notifyListeners();
    } catch (e) {
      debugPrint('[RiderLocationService] Excepción iniciando rastreo GPS: $e');
    }
  }

  void setActiveOrderId(String? orderId) {
    _activeOrderId = orderId;
    if (orderId == null || orderId.isEmpty) {
      _activeTelemetryChannel?.unsubscribe();
      _activeTelemetryChannel = null;
      _subscribedTelemetryOrderId = null;
      return;
    }
    if (_subscribedTelemetryOrderId != orderId && Supabase.instance.isInitialized) {
      _activeTelemetryChannel?.unsubscribe();
      _subscribedTelemetryOrderId = orderId;
      try {
        _activeTelemetryChannel = Supabase.instance.client
            .channel('telemetry:$orderId')
            .subscribe();
      } catch (_) {}
    }
  }

  void _onPositionUpdate(Position position) {
    _currentPosition = position;
    _isGpsActive = true;
    _permissionDenied = false;
    notifyListeners();

    _broadcastLocationToBackendAndSupabase(position);
  }

  Future<void> _broadcastLocationToBackendAndSupabase(Position position) async {
    final riderId = _currentRiderId;
    if (riderId == null || riderId.isEmpty || _isBroadcasting) return;
    _isBroadcasting = true;

    try {
      final lat = double.parse(position.latitude.toStringAsFixed(6));
      final lng = double.parse(position.longitude.toStringAsFixed(6));
      final speedKmh = position.speed > 0 ? (position.speed * 3.6).roundToDouble() : 0.0;
      final nowIso = DateTime.now().toIso8601String();

      if (Supabase.instance.isInitialized) {
        final supabase = Supabase.instance.client;
        final telemetryPayload = {
          'rider_id': riderId,
          'order_id': _activeOrderId,
          'latitude': lat,
          'longitude': lng,
          'lat': lat,
          'lng': lng,
          'speed_kmh': speedKmh,
          'speed': speedKmh,
          'battery_level': 92,
          'recorded_at': nowIso,
        };

        // 1. Broadcast WebSocket instantáneo (<30ms) si hay pedido activo
        if (_activeOrderId != null) {
          if (_activeTelemetryChannel == null || _subscribedTelemetryOrderId != _activeOrderId) {
            setActiveOrderId(_activeOrderId);
          }
          try {
            _activeTelemetryChannel?.sendBroadcastMessage(
              event: 'telemetry_update',
              payload: telemetryPayload,
            );
          } catch (_) {}
        }

        // 2. Actualizar tabla riders y rider_telemetry en paralelo
        final futures = <Future<dynamic>>[
          supabase.from('riders').update({
            'current_lat': lat,
            'current_lng': lng,
            'last_ping_at': nowIso,
          }).eq('id', riderId),
        ];

        if (_activeOrderId != null) {
          futures.add(
            supabase.from('rider_telemetry').insert({
              'rider_id': riderId,
              'order_id': _activeOrderId,
              'latitude': lat,
              'longitude': lng,
              'speed_kmh': speedKmh,
              'battery_level': 92,
              'recorded_at': nowIso,
            }),
          );
        }

        await Future.wait(futures);
      }

      // 3. Actualizar Backend API local sin bloquear (fire-and-forget)
      final url = Uri.parse('${AppConfig.backendBaseUrl}/riders/$riderId/location');
      http
          .post(
            url,
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'lat': lat, 'lng': lng}),
          )
          .timeout(const Duration(seconds: 2))
          .catchError((_) => http.Response('', 500));

      if (_activeOrderId != null) {
        final telUrl = Uri.parse('${AppConfig.backendBaseUrl}/riders/telemetry');
        http
            .post(
              telUrl,
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'rider_id': riderId,
                'order_id': _activeOrderId,
                'latitude': lat,
                'longitude': lng,
                'speed_kmh': speedKmh,
                'battery_level': 92,
              }),
            )
            .timeout(const Duration(seconds: 2))
            .catchError((_) => http.Response('', 500));
      }
    } catch (_) {
    } finally {
      _isBroadcasting = false;
    }
  }

  void stopTracking() {
    _positionStreamSubscription?.cancel();
    _positionStreamSubscription = null;
    _periodicPingTimer?.cancel();
    _periodicPingTimer = null;
    _activeTelemetryChannel?.unsubscribe();
    _activeTelemetryChannel = null;
    _subscribedTelemetryOrderId = null;
    _isGpsActive = false;
    notifyListeners();
  }
}
