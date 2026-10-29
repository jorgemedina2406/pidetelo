import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

class AppConfig {
  static const String appName = 'Pidetelo Repartidor';
  static const String appTagline = 'Panel Oficial de Envíos y Reparto';

  // Supabase Configuration
  static const String supabaseUrl = 'https://rivssielrsjarjwmoycp.supabase.co';
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdnNzaWVscnNqYXJqd21veWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTI3NjIsImV4cCI6MjEwNzY4ODc2Mn0.YWwjxYQcKIXW0teJrF8CmcnBMuvxMv4V6plprJv9tas';

  // Backend API URL (Detects Android emulator vs Desktop/Web)
  static String get backendBaseUrl {
    if (kIsWeb) {
      return 'http://localhost:3000/api';
    }
    try {
      if (Platform.isAndroid) {
        return 'http://192.168.0.151:3000/api';
      }
    } catch (_) {
      // Platform check fallback
    }
    return 'http://localhost:3000/api';
  }
}
