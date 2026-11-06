import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/config/app_config.dart';
import 'core/services/session_service.dart';
import 'core/services/cart_service.dart';
import 'core/services/dolar_api_service.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/screens/customer_login_screen.dart';
import 'features/auth/screens/splash_screen.dart';
import 'features/customer/screens/customer_home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set system UI style immediately to avoid glitches
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.dark,
      systemNavigationBarColor: Colors.white,
      systemNavigationBarIconBrightness: Brightness.dark,
    ),
  );

  // Initialize Supabase with graceful fallback and strict timeout
  try {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      anonKey: AppConfig.supabaseAnonKey,
    ).timeout(const Duration(seconds: 3));
  } catch (e) {
    debugPrint('[Main] Supabase init fallback/offline mode: $e');
  }

  // Initialize Session Persistence with timeout
  final sessionService = SessionService();
  try {
    await sessionService.init().timeout(const Duration(seconds: 2));
  } catch (e) {
    debugPrint('[Main] SessionService init error: $e');
  }

  // Initialize Cart & Orders History Persistence
  try {
    await CartService().init().timeout(const Duration(seconds: 2));
  } catch (e) {
    debugPrint('[Main] CartService init error: $e');
  }

  // Initialize Live BCV DolarApi asynchronously without blocking UI
  try {
    DolarApiService().init();
  } catch (e) {
    debugPrint('[Main] DolarApiService init error: $e');
  }

  runApp(DeliveryApp(sessionService: sessionService));
}

class DeliveryApp extends StatelessWidget {
  final SessionService sessionService;

  const DeliveryApp({super.key, required this.sessionService});

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: sessionService,
      builder: (context, _) {
        return MaterialApp(
          title: AppConfig.appName,
          debugShowCheckedModeBanner: false,
          theme: AppTheme.lightTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: sessionService.themeMode,
          home: SplashScreen(
            appTitle: 'Pídetelo.',
            subtitle: 'Tu comida favorita, directo a tu puerta',
            nextScreen: _determineInitialScreen(),
          ),
        );
      },
    );
  }

  Widget _determineInitialScreen() {
    if (sessionService.currentUser != null) {
      return CustomerHomeScreen(sessionService: sessionService);
    }
    return CustomerLoginScreen(sessionService: sessionService);
  }
}
