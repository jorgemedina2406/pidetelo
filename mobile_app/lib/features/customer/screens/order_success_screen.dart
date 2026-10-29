import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/models/order_model.dart';
import '../../../core/theme/app_theme.dart';
import 'customer_tracking_screen.dart';

class OrderSuccessScreen extends StatefulWidget {
  final DeliveryOrder order;

  const OrderSuccessScreen({super.key, required this.order});

  @override
  State<OrderSuccessScreen> createState() => _OrderSuccessScreenState();
}

class _OrderSuccessScreenState extends State<OrderSuccessScreen>
    with SingleTickerProviderStateMixin {
  late AnimationController _animController;
  late Animation<double> _scaleAnimation;
  late Animation<double> _fadeAnimation;

  @override
  void initState() {
    super.initState();
    _animController = AnimationController(
      vsync: this,
      duration: const Duration(milliseconds: 900),
    );

    _scaleAnimation = CurvedAnimation(
      parent: _animController,
      curve: Curves.elasticOut,
    );

    _fadeAnimation = CurvedAnimation(
      parent: _animController,
      curve: const Interval(0.2, 1.0, curve: Curves.easeIn),
    );

    _animController.forward();
  }

  @override
  void dispose() {
    _animController.dispose();
    super.dispose();
  }

  void _trackOrder() {
    Navigator.pushReplacement(
      context,
      MaterialPageRoute(
        builder: (_) => CustomerTrackingScreen(order: widget.order),
      ),
    );
  }

  void _backToHome() {
    Navigator.of(context).popUntil((route) => route.isFirst);
  }

  @override
  Widget build(BuildContext context) {
    final order = widget.order;

    return Scaffold(
      backgroundColor: const Color(0xFF0A0F1D),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 20),

              // 1. Animated Badge with Pulses
              Center(
                child: ScaleTransition(
                  scale: _scaleAnimation,
                  child: Stack(
                    alignment: Alignment.center,
                    children: [
                      Container(
                        width: 120,
                        height: 120,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.primary.withOpacity(0.12),
                        ),
                      ),
                      Container(
                        width: 96,
                        height: 96,
                        decoration: BoxDecoration(
                          shape: BoxShape.circle,
                          color: AppTheme.primary.withOpacity(0.25),
                        ),
                      ),
                      Container(
                        width: 76,
                        height: 76,
                        decoration: const BoxDecoration(
                          shape: BoxShape.circle,
                          gradient: LinearGradient(
                            colors: [AppTheme.primary, Color(0xFF10B981)],
                            begin: Alignment.topLeft,
                            end: Alignment.bottomRight,
                          ),
                          boxShadow: [
                            BoxShadow(
                              color: Color(0x6610B981),
                              blurRadius: 24,
                              offset: Offset(0, 8),
                            ),
                          ],
                        ),
                        child: const Icon(
                          Icons.check_rounded,
                          color: Colors.white,
                          size: 46,
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 24),

              // 2. Titles
              FadeTransition(
                opacity: _fadeAnimation,
                child: Column(
                  children: [
                    Text(
                      '¡Pedido Confirmado! 🎉',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 26,
                        fontWeight: FontWeight.w900,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Tu orden ha sido recibida con éxito y el restaurante está comenzando a preparar tus platillos.',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        color: const Color(0xFF94A3B8),
                        height: 1.4,
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // 3. Security PIN Highlight Card
              FadeTransition(
                opacity: _fadeAnimation,
                child: Container(
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
                  decoration: BoxDecoration(
                    color: AppTheme.amberAccent.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(color: AppTheme.amberAccent.withOpacity(0.4), width: 1.5),
                  ),
                  child: Row(
                    children: [
                      Container(
                        padding: const EdgeInsets.all(10),
                        decoration: BoxDecoration(
                          color: AppTheme.amberAccent.withOpacity(0.2),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.pin_rounded, color: AppTheme.amberAccent, size: 24),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'PIN DE ENTREGA OBLIGATORIO',
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.amberAccent,
                                letterSpacing: 0.5,
                              ),
                            ),
                            const SizedBox(height: 2),
                            Text(
                              order.pin,
                              style: GoogleFonts.outfit(
                                fontSize: 28,
                                fontWeight: FontWeight.w900,
                                color: Colors.white,
                                letterSpacing: 6,
                              ),
                            ),
                            Text(
                              'Entrégale este código al motorizado al recibir',
                              style: GoogleFonts.outfit(
                                fontSize: 11.5,
                                color: const Color(0xFFCBD5E1),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 16),

              // 4. Order Summary Card
              FadeTransition(
                opacity: _fadeAnimation,
                child: Container(
                  padding: const EdgeInsets.all(20),
                  decoration: BoxDecoration(
                    color: const Color(0xFF131D31),
                    borderRadius: BorderRadius.circular(22),
                    border: Border.all(color: Colors.white10),
                  ),
                  child: Column(
                    children: [
                      _buildInfoRow('Número de Orden', order.orderNumber, isBold: true, highlight: true),
                      const Divider(color: Colors.white10, height: 22),
                      _buildInfoRow('Comercio', order.merchantName),
                      const SizedBox(height: 10),
                      _buildInfoRow('Método de Pago', order.paymentMethod),
                      const SizedBox(height: 10),
                      _buildInfoRow('Dirección', order.customerAddress, maxLines: 2),
                      const SizedBox(height: 10),
                      _buildInfoRow('Total Pagado', '\$${order.total.toStringAsFixed(2)}', isBold: true, isPrice: true),
                    ],
                  ),
                ),
              ),

              const SizedBox(height: 28),

              // 5. Actions
              FadeTransition(
                opacity: _fadeAnimation,
                child: Column(
                  children: [
                    ElevatedButton.icon(
                      onPressed: _trackOrder,
                      icon: const Icon(Icons.gps_fixed_rounded, size: 20),
                      label: Text(
                        'Rastrear Pedido en Vivo',
                        style: GoogleFonts.outfit(
                          fontSize: 16,
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        minimumSize: const Size(double.infinity, 54),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                        elevation: 4,
                      ),
                    ),
                    const SizedBox(height: 12),
                    OutlinedButton(
                      onPressed: _backToHome,
                      style: OutlinedButton.styleFrom(
                        foregroundColor: const Color(0xFF94A3B8),
                        side: const BorderSide(color: Colors.white24),
                        minimumSize: const Size(double.infinity, 50),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                      ),
                      child: Text(
                        'Volver al Inicio',
                        style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 20),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildInfoRow(String label, String value, {bool isBold = false, bool highlight = false, bool isPrice = false, int maxLines = 1}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: 13,
            color: const Color(0xFF94A3B8),
          ),
        ),
        const SizedBox(width: 14),
        Expanded(
          child: Text(
            value,
            textAlign: TextAlign.end,
            maxLines: maxLines,
            overflow: TextOverflow.ellipsis,
            style: GoogleFonts.outfit(
              fontSize: isPrice ? 17 : (highlight ? 15 : 13.5),
              fontWeight: (isBold || highlight || isPrice) ? FontWeight.w800 : FontWeight.w600,
              color: isPrice ? AppTheme.primary : (highlight ? AppTheme.amberAccent : Colors.white),
            ),
          ),
        ),
      ],
    );
  }
}
