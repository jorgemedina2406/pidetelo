import 'package:flutter/material.dart';
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

  // Initialize Supabase with graceful fallback
  try {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      anonKey: AppConfig.supabaseAnonKey,
    );
  } catch (e) {
    debugPrint('[Main] Supabase init fallback/offline mode: $e');
  }

  // Initialize Session Persistence
  final sessionService = SessionService();
  await sessionService.init();

  // Initialize Cart & Orders History Persistence
  await CartService().init();

  // Initialize Live BCV DolarApi
  await DolarApiService().init();

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
          themeMode: ThemeMode.light,
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
