import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:flutter_local_notifications/flutter_local_notifications.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_messaging/firebase_messaging.dart';
import 'package:http/http.dart' as http;
import '../config/app_config.dart';

// Top-level background message handler for FCM
@pragma('vm:entry-point')
Future<void> _firebaseMessagingBackgroundHandler(RemoteMessage message) async {
  try {
    await Firebase.initializeApp();
  } catch (_) {}
  debugPrint('[FCM Background Rider] Push recibido con app cerrada: ${message.messageId}');
  final notification = message.notification;
  if (notification != null) {
    NotificationService().showRawNotification(
      title: notification.title ?? '🛵 ¡Nuevo Pedido Asignado!',
      body: notification.body ?? 'Revisa tu panel de pedidos.',
    );
  }
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;
  String? _currentRiderId;

  Future<void> init({String? riderId}) async {
    if (riderId != null) _currentRiderId = riderId;
    if (_isInitialized) {
      if (riderId != null) {
        _syncToken(riderId);
      }
      return;
    }

    try {
      // 1. Inicializar notificaciones locales
      const androidSettings = AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );
      const initSettings = InitializationSettings(android: androidSettings, iOS: iosSettings);

      await _notificationsPlugin.initialize(initSettings);

      // Canal Android con máxima prioridad para emergentes en pantalla
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

      // 2. Inicializar Firebase Messaging Remoto
      try {
        await Firebase.initializeApp();
        FirebaseMessaging.onBackgroundMessage(_firebaseMessagingBackgroundHandler);

        final messaging = FirebaseMessaging.instance;
        await messaging.requestPermission(
          alert: true,
          badge: true,
          sound: true,
          provisional: false,
        );

        // Suscribir al topic general de repartidores
        try {
          await messaging.subscribeToTopic('all_riders');
        } catch (_) {}

        if (_currentRiderId != null) {
          _syncToken(_currentRiderId!);
        }

        messaging.onTokenRefresh.listen((newToken) {
          if (_currentRiderId != null) {
            registerTokenWithBackend(_currentRiderId!, newToken, 'rider');
          }
        });

        // Escuchar notificaciones mientras la app está abierta en pantalla
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint('[FCM Foreground Rider] Mensaje recibido: ${message.notification?.title}');
          final notif = message.notification;
          if (notif != null) {
            showRawNotification(
              title: notif.title ?? '🛵 Pídetelo Repartidor',
              body: notif.body ?? '',
            );
          }
        });
      } catch (fbErr) {
        debugPrint('[NotificationService] Firebase init notice: $fbErr');
      }

      _isInitialized = true;
    } catch (e) {
      debugPrint('[NotificationService] Init error: $e');
    }
  }

  Future<void> _syncToken(String riderId) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        debugPrint('[NotificationService] FCM Token de Repartidor: $token');
        await registerTokenWithBackend(riderId, token, 'rider');
      }
    } catch (e) {
      debugPrint('[NotificationService] Error obteniendo FCM Token: $e');
    }
  }

  Future<void> registerTokenWithBackend(String userId, String token, String role) async {
    try {
      final url = Uri.parse('${AppConfig.backendBaseUrl}/api/notifications/register-token');
      await http.post(
        url,
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'userId': userId,
          'role': role,
          'token': token,
          'platform': defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
        }),
      ).timeout(const Duration(seconds: 4));
      debugPrint('[NotificationService] Token FCM registrado exitosamente en backend para $role $userId');
    } catch (e) {
      debugPrint('[NotificationService] Error enviando token al backend: $e');
    }
  }

  Future<void> showRawNotification({
    required String title,
    required String body,
  }) async {
    try {
      final androidDetails = AndroidNotificationDetails(
        'orders_channel_v2',
        'Nuevos Pedidos Pídetelo',
        channelDescription: 'Alertas prioritarias de nuevos pedidos asignados',
        importance: Importance.max,
        priority: Priority.high,
        ticker: title,
        playSound: true,
        enableVibration: true,
        fullScreenIntent: true,
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        autoCancel: true,
      );

      final notificationDetails = NotificationDetails(android: androidDetails);
      await _notificationsPlugin.show(
        DateTime.now().millisecond,
        title,
        body,
        notificationDetails,
      );
    } catch (e) {
      debugPrint('[NotificationService] Show raw notification error: $e');
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
        1001,
        '🛵 ¡Nuevo Pedido Asignado! $orderNumber',
        'Cliente: $customerName\nDirección: $address',
        notificationDetails,
      );
    } catch (e) {
      debugPrint('[NotificationService] Show notification error: $e');
    }
  }
}
