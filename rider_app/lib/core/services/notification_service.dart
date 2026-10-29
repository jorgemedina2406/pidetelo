import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;

  Future<void> init() async {
    if (_isInitialized) return;

    try {
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const initSettings = InitializationSettings(android: androidSettings);

      await _notificationsPlugin.initialize(initSettings);

      // Create notification channel for high-priority order alerts
      final androidImplementation = _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

      if (androidImplementation != null) {
        await androidImplementation.requestNotificationsPermission();

        const channel = AndroidNotificationChannel(
          'orders_channel_v2',
          'Nuevos Pedidos Pídetelo',
          description: 'Notificaciones prioritarias de nuevos pedidos asignados',
          importance: Importance.max,
          enableVibration: true,
          playSound: true,
          showBadge: true,
        );

        await androidImplementation.createNotificationChannel(channel);
      }

      _isInitialized = true;
    } catch (e) {
      debugPrint('[NotificationService] Init error: $e');
    }
  }

  Future<void> showOrderAssignedNotification({
    required String orderNumber,
    required String customerName,
    required String address,
  }) async {
    try {
      final androidDetails = AndroidNotificationDetails(
        'orders_channel_v2',
        'Nuevos Pedidos Pídetelo',
        channelDescription: 'Alertas prioritarias de nuevos pedidos asignados',
        importance: Importance.max,
        priority: Priority.high,
        ticker: 'Nuevo pedido asignado: $orderNumber',
        playSound: true,
        enableVibration: true,
        vibrationPattern: Int64List.fromList([0, 600, 300, 600, 300, 600]),
        fullScreenIntent: true,
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        autoCancel: true,
        ongoing: false,
        styleInformation: BigTextStyleInformation(
          'Cliente: $customerName\nDirección: $address',
          contentTitle: '🛵 ¡Nuevo Pedido Asignado! $orderNumber',
          summaryText: 'Pídetelo Delivery',
        ),
      );

      final notificationDetails = NotificationDetails(android: androidDetails);

      await _notificationsPlugin.show(
        1001, // Single fixed ID for order alerts so new orders update instead of stacking
        '🛵 ¡Nuevo Pedido Asignado! $orderNumber',
        'Cliente: $customerName\nDirección: $address',
        notificationDetails,
      );
    } catch (e) {
      debugPrint('[NotificationService] Show notification error: $e');
    }
  }
}
