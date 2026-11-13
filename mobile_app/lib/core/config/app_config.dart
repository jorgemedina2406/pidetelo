import 'dart:io' show Platform;
import 'package:flutter/foundation.dart';

class AppConfig {
  static const String appName = 'Pidetelo';
  static const String appTagline = 'Tu comida favorita en minutos';

  // Supabase Configuration
  static const String supabaseUrl = 'https://rivssielrsjarjwmoycp.supabase.co';
  static const String supabaseAnonKey =
      'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InJpdnNzaWVscnNqYXJqd21veWNwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3OTIxMTI3NjIsImV4cCI6MjEwNzY4ODc2Mn0.YWwjxYQcKIXW0teJrF8CmcnBMuvxMv4V6plprJv9tas';

  // Backend API URL (Detects Production vs Local Debug)
  static String get backendBaseUrl {
    const envUrl = String.fromEnvironment('BACKEND_URL');
    if (envUrl.isNotEmpty) return envUrl;

    if (kReleaseMode) {
      return 'https://api.pidetelo.com/api';
    }

    if (kIsWeb) {
      return 'http://localhost:3000/api';
    }
    try {
      if (Platform.isAndroid || Platform.isIOS) {
        // Use local PC Wi-Fi IP for physical phone in debug mode
        return 'http://192.168.0.151:3000/api';
      }
    } catch (_) {
      // Platform check not supported on all targets
    }
    return 'http://localhost:3000/api';
  }
}
