import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import 'core/config/app_config.dart';
import 'core/services/session_service.dart';
import 'core/services/notification_service.dart';
import 'core/services/background_order_service.dart';
import 'core/services/dolar_api_service.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/screens/rider_login_screen.dart';
import 'features/auth/screens/splash_screen.dart';
import 'features/rider/screens/rider_home_screen.dart';

void main() async {
  WidgetsFlutterBinding.ensureInitialized();

  // Set system UI style
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(
      statusBarColor: Colors.transparent,
      statusBarIconBrightness: Brightness.light,
      systemNavigationBarColor: Color(0xFF0F172A),
      systemNavigationBarIconBrightness: Brightness.light,
    ),
  );

  // Initialize Supabase Cloud
  try {
    await Supabase.initialize(
      url: AppConfig.supabaseUrl,
      anonKey: AppConfig.supabaseAnonKey,
    );
  } catch (e) {
    debugPrint('[RiderApp] Supabase init notice: $e');
  }

  // Initialize Session
  final sessionService = SessionService();
  await sessionService.init();

  // Initialize Live BCV DolarApi
  await DolarApiService().init();

  // Initialize Local Push Notifications for Orders
  await NotificationService().init();

  // Initialize Background Order Polling Service (runs even when app is minimized or screen off)
  await BackgroundOrderService().init();
  if (sessionService.isAuthenticated && sessionService.currentRider?.id != null) {
    await BackgroundOrderService().startService(sessionService.currentRider!.id);
  }

  runApp(RiderApp(sessionService: sessionService));
}

class RiderApp extends StatelessWidget {
  final SessionService sessionService;

  const RiderApp({super.key, required this.sessionService});

  @override
  Widget build(BuildContext context) {
    return ListenableBuilder(
      listenable: sessionService,
      builder: (context, _) {
        return MaterialApp(
          title: 'Pídetelo Riders',
          debugShowCheckedModeBanner: false,
          theme: AppTheme.darkTheme,
          darkTheme: AppTheme.darkTheme,
          themeMode: ThemeMode.dark,
          home: SplashScreen(
            appTitle: 'Pídetelo. Riders',
            subtitle: 'Despacho ágil, entregas inteligentes',
            nextScreen: sessionService.isAuthenticated
                ? RiderHomeScreen(sessionService: sessionService)
                : RiderLoginScreen(sessionService: sessionService),
          ),
        );
      },
    );
  }
}
