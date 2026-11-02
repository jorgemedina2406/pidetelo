import 'dart:async';
import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_foreground_task/flutter_foreground_task.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/app_config.dart';
import 'notification_service.dart';

// The callback function should always be a top-level function.
@pragma('vm:entry-point')
void startForegroundOrderListenerCallback() {
  FlutterForegroundTask.setTaskHandler(RiderOrderTaskHandler());
}

class RiderOrderTaskHandler extends TaskHandler {
  SupabaseClient? _supabase;
  String? _riderId;
  String? _lastNotifiedOrderId;

  @override
  Future<void> onStart(DateTime timestamp, TaskStarter starter) async {
    debugPrint('[RiderOrderTaskHandler] Foreground task started at $timestamp');
    try {
      final prefs = await SharedPreferences.getInstance();
      _riderId = prefs.getString('rider_user_id_v1');
      _lastNotifiedOrderId = prefs.getString('rider_last_notified_order_v1');

      // Initialize Supabase in background isolate if needed
      if (!Supabase.instance.isInitialized) {
        await Supabase.initialize(
          url: AppConfig.supabaseUrl,
          anonKey: AppConfig.supabaseAnonKey,
        );
      }
      _supabase = Supabase.instance.client;

      // Initialize notifications plugin in isolate
      await NotificationService().init();
    } catch (e) {
      debugPrint('[RiderOrderTaskHandler] onStart error: $e');
    }
  }

  @override
  Future<void> onRepeatEvent(DateTime timestamp) async {
    // Check if new orders are assigned to this rider every few seconds
    try {
      final prefs = await SharedPreferences.getInstance();
      _riderId ??= prefs.getString('rider_user_id_v1');
      if (_riderId == null || _riderId!.isEmpty) {
        final riderDataJson = prefs.getString('current_rider_user_v1');
        if (riderDataJson != null) {
          try {
            final Map<String, dynamic> data = jsonDecode(riderDataJson);
            _riderId = data['id']?.toString();
          } catch (_) {}
        }
      }

      if (_riderId == null || _riderId!.isEmpty) return;

      if (_supabase == null) {
        if (!Supabase.instance.isInitialized) {
          await Supabase.initialize(
            url: AppConfig.supabaseUrl,
            anonKey: AppConfig.supabaseAnonKey,
          );
        }
        _supabase = Supabase.instance.client;
      }

      final res = await _supabase!
          .from('orders')
          .select('id, order_number, customer_name, delivery_address, status')
          .eq('driver_id', _riderId!)
          .not('status', 'in', '("delivered","cancelled")')
          .order('created_at', ascending: false)
          .limit(1);

      if (res.isNotEmpty) {
        final order = res.first;
        final orderId = order['id']?.toString() ?? '';
        final orderNumber = order['order_number']?.toString() ?? 'ORD-0000';
        final customer = order['customer_name']?.toString() ?? 'Cliente';
        final address = order['delivery_address']?.toString() ?? 'Dirección de Entrega';

        if (orderId != _lastNotifiedOrderId) {
          _lastNotifiedOrderId = orderId;
          await prefs.setString('rider_last_notified_order_v1', orderId);

          debugPrint('[RiderOrderTaskHandler] Triggering background push for: $orderNumber');
          
          // 1. Update foreground notification (immediately pops up heads-up banner on Android)
          await FlutterForegroundTask.updateService(
            notificationTitle: '🛵 ¡Nuevo Pedido Asignado! $orderNumber',
            notificationText: 'Cliente: $customer | Dir: $address',
          );

          // 2. Also trigger local notification for vibration & persistent status bar alert
          await NotificationService().showOrderAssignedNotification(
            orderNumber: orderNumber,
            customerName: customer,
            address: address,
          );
        }
      }
    } catch (e) {
      debugPrint('[RiderOrderTaskHandler] Polling error: $e');
    }
  }

  @override
  Future<void> onDestroy(DateTime timestamp, bool isTimeout) async {
    debugPrint('[RiderOrderTaskHandler] Foreground task destroyed (timeout: $isTimeout)');
  }

  @override
  void onReceiveData(Object data) {
    if (data is Map && data.containsKey('rider_id')) {
      _riderId = data['rider_id']?.toString();
    }
  }

  @override
  void onNotificationButtonPressed(String id) {}
}

class BackgroundOrderService {
  static final BackgroundOrderService _instance = BackgroundOrderService._internal();
  factory BackgroundOrderService() => _instance;
  BackgroundOrderService._internal();

  Future<void> init() async {
    FlutterForegroundTask.init(
      androidNotificationOptions: AndroidNotificationOptions(
        channelId: 'rider_orders_alert_channel',
        channelName: 'Alertas de Nuevos Pedidos',
        channelDescription: 'Avisos prioritarios y emergentes de nuevos pedidos asignados',
        channelImportance: NotificationChannelImportance.HIGH,
        priority: NotificationPriority.HIGH,
        enableVibration: true,
        playSound: true,
        visibility: NotificationVisibility.VISIBILITY_PUBLIC,
      ),
      iosNotificationOptions: const IOSNotificationOptions(
        showNotification: true,
        playSound: true,
      ),
      foregroundTaskOptions: ForegroundTaskOptions(
        eventAction: ForegroundTaskEventAction.repeat(3000), // Check every 3 seconds
        autoRunOnBoot: true,
        autoRunOnMyPackageReplaced: true,
        allowWakeLock: true,
        allowWifiLock: true,
      ),
    );
  }

  Future<void> startService(String riderId) async {
    try {
      // Save riderId to shared preferences for background isolate access
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString('rider_user_id_v1', riderId);

      // Check permissions
      if (!await FlutterForegroundTask.isIgnoringBatteryOptimizations) {
        await FlutterForegroundTask.requestIgnoreBatteryOptimization();
      }

      final notifPermission = await FlutterForegroundTask.checkNotificationPermission();
      if (notifPermission != NotificationPermission.granted) {
        await FlutterForegroundTask.requestNotificationPermission();
      }

      if (await FlutterForegroundTask.isRunningService) {
        FlutterForegroundTask.sendDataToTask({'rider_id': riderId});
        return;
      }

      await FlutterForegroundTask.startService(
        serviceId: 256,
        notificationTitle: 'Pídetelo Repartidor Activo',
        notificationText: 'Escuchando nuevos pedidos en segundo plano...',
        callback: startForegroundOrderListenerCallback,
      );

      debugPrint('[BackgroundOrderService] Started successfully for rider: $riderId');
    } catch (e) {
      debugPrint('[BackgroundOrderService] Start error: $e');
    }
  }

  Future<void> stopService() async {
    try {
      if (await FlutterForegroundTask.isRunningService) {
        await FlutterForegroundTask.stopService();
      }
    } catch (e) {
      debugPrint('[BackgroundOrderService] Stop error: $e');
    }
  }
}
