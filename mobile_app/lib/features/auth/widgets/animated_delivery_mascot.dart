import 'dart:math' as math;
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AnimatedDeliveryMascot extends StatefulWidget {
  final double size;
  const AnimatedDeliveryMascot({super.key, this.size = 180});

  @override
  State<AnimatedDeliveryMascot> createState() => _AnimatedDeliveryMascotState();
}

class _AnimatedDeliveryMascotState extends State<AnimatedDeliveryMascot>
    with SingleTickerProviderStateMixin {
  late AnimationController _controller;

  @override
  void initState() {
    super.initState();
    _controller = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 2200),
    )..repeat();
  }

  @override
  void dispose() {
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, _) {
        final t = _controller.value;
        // Natural gentle bobbing and forward tilting movement
        final verticalOffset = math.sin(t * 2 * math.pi) * 6.0;
        final tiltAngle = math.sin(t * 2 * math.pi) * 0.02;

        return SizedBox(
          width: widget.size,
          height: widget.size,
          child: Stack(
            alignment: Alignment.center,
            children: [
              // 1. Glowing ripple ring behind mascot
              Container(
                width: widget.size * 0.88,
                height: widget.size * 0.88,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  gradient: RadialGradient(
                    colors: [
                      const Color(0xFF65A30D).withValues(alpha: 0.25),
                      const Color(0xFF84CC16).withValues(alpha: 0.08),
                      Colors.transparent,
                    ],
                  ),
                ),
              ),

              // 2. Animated ground shadow expanding/contracting
              Positioned(
                bottom: widget.size * 0.06,
                child: Container(
                  width: widget.size * (0.65 - (verticalOffset * 0.01)),
                  height: 14,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.18),
                        blurRadius: 10 + verticalOffset.abs(),
                        spreadRadius: 2,
                      ),
                    ],
                  ),
                ),
              ),

              // 3. Floating official platform logo
              Transform.translate(
                offset: Offset(0, verticalOffset),
                child: Transform.rotate(
                  angle: tiltAngle,
                  child: ClipRRect(
                    borderRadius: BorderRadius.circular(28),
                    child: Image.asset(
                      'assets/images/logo.png',
                      width: widget.size * 0.92,
                      height: widget.size * 0.92,
                      fit: BoxFit.contain,
                    ),
                  ),
                ),
              ),
            ],
          ),
        );
      },
    );
  }
}
