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
  debugPrint(
      '[FCM Background Customer] Push recibido con app cerrada: ${message.messageId}');
  final notification = message.notification;
  final title = notification?.title ?? message.data['title']?.toString();
  final body = notification?.body ?? message.data['body']?.toString();
  if (title != null || body != null) {
    NotificationService().showRawNotification(
      title: title ?? '🛍️ Actualización de tu Pedido',
      body: body ?? 'Consulta el estado de tu pedido en Pídetelo.',
      orderId: message.data['orderId']?.toString(),
    );
  }
}

class NotificationService {
  static final NotificationService _instance = NotificationService._internal();
  factory NotificationService() => _instance;
  NotificationService._internal();

  final FlutterLocalNotificationsPlugin _notificationsPlugin =
      FlutterLocalNotificationsPlugin();
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
      const androidSettings =
          AndroidInitializationSettings('@mipmap/ic_launcher');
      const iosSettings = DarwinInitializationSettings(
        requestAlertPermission: true,
        requestBadgePermission: true,
        requestSoundPermission: true,
      );
      const initSettings =
          InitializationSettings(android: androidSettings, iOS: iosSettings);

      await _notificationsPlugin.initialize(initSettings);

      final androidImplementation =
          _notificationsPlugin.resolvePlatformSpecificImplementation<
              AndroidFlutterLocalNotificationsPlugin>();

      if (androidImplementation != null) {
        await androidImplementation.requestNotificationsPermission();

        const channel = AndroidNotificationChannel(
          'orders_channel_v2',
          'Actualizaciones de Pedidos Pídetelo',
          description:
              'Avisos de preparación, salida a reparto y entrega de pedidos',
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
        FirebaseMessaging.onBackgroundMessage(
            _firebaseMessagingBackgroundHandler);

        final messaging = FirebaseMessaging.instance;
        await messaging.requestPermission(
          alert: true,
          badge: true,
          sound: true,
          provisional: false,
        );

        // Suscribir al topic general de clientes
        try {
          await messaging.subscribeToTopic('all_customers');
        } catch (_) {}

        if (_currentCustomerId != null && _currentCustomerId!.isNotEmpty) {
          _syncToken(_currentCustomerId!);
        } else {
          // Obtener token y registrar como cliente genérico
          _syncToken('guest_client');
        }

        messaging.onTokenRefresh.listen((newToken) {
          final id = _currentCustomerId?.isNotEmpty == true
              ? _currentCustomerId!
              : 'guest_client';
          registerTokenWithBackend(id, newToken, 'customer');
        });

        // Escuchar notificaciones mientras el cliente tiene la app abierta
        FirebaseMessaging.onMessage.listen((RemoteMessage message) {
          debugPrint(
              '[FCM Foreground Customer] Mensaje recibido: ${message.notification?.title ?? message.data['title']}');
          final notif = message.notification;
          final title = notif?.title ?? message.data['title']?.toString();
          final body = notif?.body ?? message.data['body']?.toString();
          if (title != null || body != null) {
            showRawNotification(
              title: title ?? '🛍️ Pídetelo',
              body: body ?? '',
              orderId: message.data['orderId']?.toString(),
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

  Future<void> registerCustomerPhone(String phone) async {
    if (phone.isEmpty) return;
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        await registerTokenWithBackend(phone, token, 'customer');
      }
    } catch (_) {}
  }

  Future<void> _syncToken(String customerId) async {
    try {
      final token = await FirebaseMessaging.instance.getToken();
      if (token != null && token.isNotEmpty) {
        debugPrint('[NotificationService] FCM Token de Cliente: $token');
        await registerTokenWithBackend(customerId, token, 'customer');
      }
    } catch (e) {
      debugPrint(
          '[NotificationService] Error obteniendo FCM Token de Cliente: $e');
    }
  }

  Future<void> registerTokenWithBackend(
      String userId, String token, String role) async {
    final targets = <String>{
      'http://192.168.0.151:3000/api/notifications/register-token',
      'https://api.pidetelo.app/api/notifications/register-token',
      '${AppConfig.backendBaseUrl.replaceAll(RegExp(r'/api$'), '')}/api/notifications/register-token',
    };

    final payload = jsonEncode({
      'userId': userId,
      'role': role,
      'token': token,
      'platform':
          defaultTargetPlatform == TargetPlatform.iOS ? 'ios' : 'android',
    });

    for (final target in targets) {
      try {
        final url = Uri.parse(target);
        final res = await http
            .post(
              url,
              headers: {'Content-Type': 'application/json'},
              body: payload,
            )
            .timeout(const Duration(seconds: 3));
        if (res.statusCode >= 200 && res.statusCode < 300) {
          debugPrint(
              '[NotificationService] Token FCM registrado en $target ($userId)');
        }
      } catch (_) {
        // Fallback silently if host unreachable
      }
    }
  }

  Future<void> subscribeToOrder(String orderId) async {
    try {
      final clean = orderId.replaceAll(RegExp(r'[^a-zA-Z0-9_\.~%]+'), '_');
      await FirebaseMessaging.instance.subscribeToTopic('order_$clean');
      debugPrint(
          '[NotificationService] Suscrito a topic de orden: order_$clean');
    } catch (_) {}
  }

  Future<void> showRawNotification({
    required String title,
    required String body,
    String? orderId,
    String? tag,
  }) async {
    try {
      final cleanOrderId = orderId?.trim() ?? '';
      final effectiveTag = tag ?? (cleanOrderId.isNotEmpty ? 'order_$cleanOrderId' : null);
      final notifId = cleanOrderId.isNotEmpty
          ? ((cleanOrderId.hashCode & 0x7fffffff) % 100000) + 1000
          : DateTime.now().millisecondsSinceEpoch % 100000;

      final androidDetails = AndroidNotificationDetails(
        'orders_channel_v2',
        'Actualizaciones de Pedidos Pídetelo',
        channelDescription:
            'Avisos de preparación, salida a reparto y entrega de pedidos',
        importance: Importance.max,
        priority: Priority.high,
        ticker: title,
        tag: effectiveTag,
        playSound: true,
        enableVibration: true,
        category: AndroidNotificationCategory.message,
        visibility: NotificationVisibility.public,
        autoCancel: true,
      );

      final notificationDetails = NotificationDetails(android: androidDetails);
      await _notificationsPlugin.show(
        notifId,
        title,
        body,
        notificationDetails,
      );
    } catch (e) {
      debugPrint('[NotificationService] Show raw notification error: $e');
    }
  }

  Future<void> showOrderStatusNotification({
    required String orderId,
    required String orderNumber,
    required String status,
    String? riderName,
  }) async {
    final displayNum =
        orderNumber.startsWith('#') ? orderNumber : '#$orderNumber';
    final cleanRider = (riderName ?? '').trim();
    final riderLabel = cleanRider.isNotEmpty ? cleanRider : 'Tu repartidor';
    final st = status.trim().toLowerCase();

    String title;
    String body;

    switch (st) {
      case 'confirmed':
      case 'in_kitchen':
      case 'preparing':
        title = '🍳 Pedido en preparación $displayNum';
        body =
            'El comercio confirmó tu orden $displayNum y ya la está preparando.';
        break;
      case 'assigned':
      case 'assigned_driver':
      case 'rider_accepted':
        title = '🛵 Repartidor asignado $displayNum';
        body =
            '$riderLabel fue asignado a tu pedido $displayNum y va rumbo al comercio.';
        break;
      case 'atmerchant':
      case 'at_merchant':
        title = '📍 Repartidor en el comercio $displayNum';
        body =
            '$riderLabel ya llegó al local para retirar tu pedido $displayNum.';
        break;
      case 'pickedup':
      case 'picked_up':
      case 'ontheway':
      case 'on_the_way':
        title = '🚀 ¡Tu pedido va en camino! $displayNum';
        body =
            '$riderLabel retiró tu pedido $displayNum y va rumbo a tu dirección.';
        break;
      case 'delivered':
        title = '🎉 ¡Pedido entregado! $displayNum';
        body = 'Tu orden $displayNum fue entregada exitosamente. ¡Buen provecho!';
        break;
      case 'cancelled':
        title = '❌ Pedido cancelado $displayNum';
        body = 'Tu orden $displayNum ha sido cancelada.';
        break;
      default:
        return;
    }

    await showRawNotification(
      title: title,
      body: body,
      orderId: orderId,
    );
  }
}
