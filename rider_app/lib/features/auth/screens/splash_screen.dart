import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:video_player/video_player.dart';

class SplashScreen extends StatefulWidget {
  final Widget nextScreen;
  final String appTitle;
  final String subtitle;

  const SplashScreen({
    super.key,
    required this.nextScreen,
    this.appTitle = 'Pídetelo.',
    this.subtitle = 'Riders',
  });

  @override
  State<SplashScreen> createState() => _SplashScreenState();
}

class _SplashScreenState extends State<SplashScreen> with SingleTickerProviderStateMixin {
  VideoPlayerController? _videoController;
  bool _isVideoInitialized = false;
  bool _hasNavigated = false;
  Timer? _fallbackTimer;

  late AnimationController _pulseController;
  late Animation<double> _pulseAnimation;

  @override
  void initState() {
    super.initState();

    SystemChrome.setSystemUIOverlayStyle(
      const SystemUiOverlayStyle(
        statusBarColor: Colors.transparent,
        statusBarIconBrightness: Brightness.light,
        systemNavigationBarColor: Color(0xFF070B14),
        systemNavigationBarIconBrightness: Brightness.light,
      ),
    );

    _pulseController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 1800),
    )..repeat(reverse: true);

    _pulseAnimation = Tween<double>(begin: 0.96, end: 1.04).animate(
      CurvedAnimation(parent: _pulseController, curve: Curves.easeInOut),
    );

    _initVideoAndNavigation();
  }

  Future<void> _initVideoAndNavigation() async {
    VideoPlayerController? controller;
    try {
      controller = VideoPlayerController.asset('assets/screen splash.mp4');
      await controller.initialize();
    } catch (_) {
      try {
        controller = VideoPlayerController.asset('assets/screen_splash.mp4');
        await controller.initialize();
      } catch (e) {
        debugPrint('[SplashScreen] Video initialization fallback: $e');
        controller = null;
      }
    }

    if (mounted && controller != null && controller.value.isInitialized) {
      _videoController = controller;
      setState(() => _isVideoInitialized = true);

      await _videoController!.setLooping(false);
      await _videoController!.setVolume(1.0);
      await _videoController!.play();

      _videoController!.addListener(() {
        if (!mounted || _hasNavigated || _videoController == null) return;
        final position = _videoController!.value.position;
        final duration = _videoController!.value.duration;
        if (duration.inMilliseconds > 0 && position >= duration) {
          _navigateToNext();
        }
      });

      final videoDuration = _videoController!.value.duration;
      final maxWait = videoDuration.inMilliseconds > 0
          ? videoDuration + const Duration(milliseconds: 300)
          : const Duration(seconds: 4);

      _fallbackTimer = Timer(maxWait, () {
        if (!_hasNavigated && mounted) _navigateToNext();
      });
    } else {
      _fallbackTimer = Timer(const Duration(milliseconds: 3200), () {
        if (!_hasNavigated && mounted) _navigateToNext();
      });
    }
  }

  void _navigateToNext() {
    if (_hasNavigated || !mounted) return;
    _hasNavigated = true;
    _fallbackTimer?.cancel();
    _videoController?.pause();

    Navigator.of(context).pushReplacement(
      PageRouteBuilder(
        pageBuilder: (_, __, ___) => widget.nextScreen,
        transitionsBuilder: (_, animation, __, child) {
          return FadeTransition(opacity: animation, child: child);
        },
        transitionDuration: const Duration(milliseconds: 450),
      ),
    );
  }

  @override
  void dispose() {
    _fallbackTimer?.cancel();
    _videoController?.dispose();
    _pulseController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final size = MediaQuery.of(context).size;

    return Scaffold(
      backgroundColor: const Color(0xFF070B14),
      body: GestureDetector(
        behavior: HitTestBehavior.opaque,
        onTap: _navigateToNext,
        child: Stack(
          fit: StackFit.expand,
          children: [
            // 1. Futuristic cybernetic custom painted background
            CustomPaint(
              size: size,
              painter: const _CyberSplashPainter(),
            ),

            // 2. Center Animated Content (Video or Animated Logo Fallback)
            Center(
              child: Padding(
                padding: const EdgeInsets.only(bottom: 60),
                child: _isVideoInitialized && _videoController != null
                    ? SizedBox(
                        width: size.width,
                        child: AspectRatio(
                          aspectRatio: _videoController!.value.aspectRatio,
                          child: ShaderMask(
                            shaderCallback: (rect) {
                              return const LinearGradient(
                                begin: Alignment.topCenter,
                                end: Alignment.bottomCenter,
                                colors: [
                                  Colors.transparent,
                                  Colors.black,
                                  Colors.black,
                                  Colors.transparent,
                                ],
                                stops: [0.0, 0.08, 0.92, 1.0],
                              ).createShader(rect);
                            },
                            blendMode: BlendMode.dstIn,
                            child: VideoPlayer(_videoController!),
                          ),
                        ),
                      )
                    : ScaleTransition(
                        scale: _pulseAnimation,
                        child: Stack(
                          alignment: Alignment.center,
                          children: [
                            Container(
                              width: 240,
                              height: 120,
                              decoration: BoxDecoration(
                                shape: BoxShape.rectangle,
                                borderRadius: BorderRadius.circular(60),
                                boxShadow: [
                                  BoxShadow(
                                    color: const Color(0xFFEA580C).withValues(alpha: 0.35),
                                    blurRadius: 60,
                                    spreadRadius: 10,
                                  ),
                                  BoxShadow(
                                    color: const Color(0xFF38BDF8).withValues(alpha: 0.2),
                                    blurRadius: 40,
                                    spreadRadius: 5,
                                  ),
                                ],
                              ),
                            ),
                            Image.asset(
                              'assets/images/logo.png',
                              width: size.width * 0.72,
                              fit: BoxFit.contain,
                            ),
                          ],
                        ),
                      ),
              ),
            ),

            // 3. Bottom Loading Section (Exact match to design mockup)
            Positioned(
              bottom: 48,
              left: 0,
              right: 0,
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const SizedBox(
                    width: 38,
                    height: 38,
                    child: CircularProgressIndicator(
                      strokeWidth: 3.5,
                      valueColor: AlwaysStoppedAnimation<Color>(Color(0xFFEA580C)),
                      backgroundColor: Color(0xFF1E293B),
                    ),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    'Cargando...',
                    style: GoogleFonts.outfit(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: const Color(0xFF8FA0B5),
                      letterSpacing: 0.4,
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

/// Custom painter that renders tech circuit lines, angular polygons and glowing ambiance
class _CyberSplashPainter extends CustomPainter {
  const _CyberSplashPainter();

  @override
  void paint(Canvas canvas, Size size) {
    final bgRect = Offset.zero & size;
    final bgPaint = Paint()
      ..shader = const RadialGradient(
        center: Alignment(0.0, -0.1),
        radius: 0.95,
        colors: [
          Color(0xFF121B2F),
          Color(0xFF090E1B),
          Color(0xFF050811),
        ],
        stops: [0.0, 0.55, 1.0],
      ).createShader(bgRect);
    canvas.drawRect(bgRect, bgPaint);

    final coreGlowPaint = Paint()
      ..shader = RadialGradient(
        center: const Alignment(0.0, -0.05),
        radius: 0.45,
        colors: [
          const Color(0xFFEA580C).withValues(alpha: 0.12),
          const Color(0xFF38BDF8).withValues(alpha: 0.05),
          Colors.transparent,
        ],
        stops: const [0.0, 0.4, 1.0],
      ).createShader(bgRect);
    canvas.drawRect(bgRect, coreGlowPaint);

    final linePaint = Paint()
      ..color = const Color(0xFF1E293B).withValues(alpha: 0.35)
      ..style = PaintingStyle.stroke
      ..strokeWidth = 1.0;

    final polyPaint = Paint()
      ..color = const Color(0xFF162540).withValues(alpha: 0.22)
      ..style = PaintingStyle.fill;

    final pathTopLeft = Path()
      ..moveTo(0, size.height * 0.12)
      ..lineTo(size.width * 0.35, size.height * 0.06)
      ..lineTo(size.width * 0.48, size.height * 0.14)
      ..lineTo(size.width * 0.20, size.height * 0.24)
      ..close();
    canvas.drawPath(pathTopLeft, polyPaint);
    canvas.drawPath(pathTopLeft, linePaint);

    final pathTopRight = Path()
      ..moveTo(size.width, size.height * 0.08)
      ..lineTo(size.width * 0.65, size.height * 0.16)
      ..lineTo(size.width * 0.78, size.height * 0.28)
      ..lineTo(size.width, size.height * 0.22)
      ..close();
    canvas.drawPath(pathTopRight, polyPaint);
    canvas.drawPath(pathTopRight, linePaint);

    final circuitPath1 = Path()
      ..moveTo(size.width * 0.08, size.height * 0.72)
      ..lineTo(size.width * 0.24, size.height * 0.64)
      ..lineTo(size.width * 0.40, size.height * 0.64);
    canvas.drawPath(circuitPath1, linePaint);

    final pathBottomRight = Path()
      ..moveTo(size.width * 0.60, size.height * 0.68)
      ..lineTo(size.width * 0.88, size.height * 0.58)
      ..lineTo(size.width * 0.95, size.height * 0.72)
      ..lineTo(size.width * 0.70, size.height * 0.78)
      ..close();
    canvas.drawPath(pathBottomRight, polyPaint);
    canvas.drawPath(pathBottomRight, linePaint);

    final nodePaint = Paint()
      ..color = const Color(0xFF38BDF8).withValues(alpha: 0.35)
      ..style = PaintingStyle.fill;

    canvas.drawCircle(Offset(size.width * 0.40, size.height * 0.64), 2.5, nodePaint);
    canvas.drawCircle(Offset(size.width * 0.48, size.height * 0.14), 2.5, nodePaint);
    canvas.drawCircle(Offset(size.width * 0.65, size.height * 0.16), 2.5, nodePaint);
  }

  @override
  bool shouldRepaint(covariant CustomPainter oldDelegate) => false;
}
