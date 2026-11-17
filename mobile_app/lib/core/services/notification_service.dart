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
  debugPrint('[FCM Background Customer] Push recibido con app cerrada: ${message.messageId}');
  final notification = message.notification;
  if (notification != null) {
    NotificationService().showRawNotification(
      title: notification.title ?? '🛍️ Actualización de tu Pedido',
      body: notification.body ?? 'Consulta el estado de tu pedido en Pídetelo.',
    );
  }
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin = FlutterLocalNotificationsPlugin();
  bool _isInitialized = false;
  String? _currentCustomerId;

  Future<void> init({String? customerId}) async {
    if (customerId != null) _currentCustomerId = customerId;
    if (_isInitialized) {
      if (customerId != null) {
        _syncToken(customerId);
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

      final androidImplementation = _notificationsPlugin
          .resolvePlatformSpecificImplementation<AndroidFlutterLocalNotificationsPlugin>();

      if (androidImplementation != null) {
        await androidImplementation.requestNotificationsPermission();

        const channel = AndroidNotificationChannel(
          'orders_channel_v2',
          'Actualizaciones de Pedidos Pídetelo',
          description: 'Avisos de preparación, salida a reparto y entrega de pedidos',
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

        if (_currentCustomerId != null) {
          _syncToken(_currentCustomerId!);
        }

        messaging.onTokenRefresh.listen((newToken) {
          if (_currentCustomerId != null) {
            registerTokenWithBackend(_currentCustomerId!, newToken, 'customer');
          }
        });

        // Escuchar notificaciones mientras el cliente tiene la app abierta
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint('[FCM Foreground Customer] Mensaje recibido: ${message.notification?.title}');
          final notif = message.notification;
          if (notif != null) {
            showRawNotification(
              title: notif.title ?? '🛍️ Pídetelo',
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

  Future<void> _syncToken(String customerId) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        debugPrint('[NotificationService] FCM Token de Cliente: $token');
        await registerTokenWithBackend(customerId, token, 'customer');
      }
    } catch (e) {
      debugPrint('[NotificationService] Error obteniendo FCM Token de Cliente: $e');
    }
  }

  Future<void> registerTokenWithBackend(String userId, String token, String role) async {
    try {
      final url = Uri.parse('${AppConfig.backendBaseUrl}/notifications/register-token');
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
      debugPrint('[NotificationService] Token FCM de cliente registrado en backend ($userId)');
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
        'Actualizaciones de Pedidos Pídetelo',
        channelDescription: 'Avisos de preparación, salida a reparto y entrega de pedidos',
        importance: Importance.max,
        priority: Priority.high,
        ticker: title,
        playSound: true,
        enableVibration: true,
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
}
