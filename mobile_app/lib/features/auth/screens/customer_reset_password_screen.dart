import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/services/session_service.dart';
import 'customer_login_screen.dart';
import '../../customer/screens/customer_home_screen.dart';

class CustomerResetPasswordScreen extends StatefulWidget {
  final SessionService sessionService;

  const CustomerResetPasswordScreen({super.key, required this.sessionService});

  @override
  State<CustomerResetPasswordScreen> createState() => _CustomerResetPasswordScreenState();
}

class _CustomerResetPasswordScreenState extends State<CustomerResetPasswordScreen> {
  final _newPasswordController = TextEditingController();
  final _confirmPasswordController = TextEditingController();

  bool _obscureNew = true;
  bool _obscureConfirm = true;
  bool _isLoading = false;
  String? _errorMessage;

  @override
  void dispose() {
    _newPasswordController.dispose();
    _confirmPasswordController.dispose();
    super.dispose();
  }

  Future<void> _updatePassword() async {
    final newPass = _newPasswordController.text.trim();
    final confirmPass = _confirmPasswordController.text.trim();

    if (newPass.length < 6) {
      setState(() {
        _errorMessage = 'La contraseña debe tener al menos 6 caracteres.';
      });
      return;
    }

    if (newPass != confirmPass) {
      setState(() {
        _errorMessage = 'Las contraseñas no coinciden. Verifícalas.';
      });
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try {
      await Supabase.instance.client.auth.updateUser(
        UserAttributes(password: newPass),
      );

      if (mounted) {
        showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: Row(
              children: [
                Container(
                  padding: const EdgeInsets.all(8),
                  decoration: BoxDecoration(
                    color: const Color(0xFF10B981).withOpacity(0.15),
                    shape: BoxShape.circle,
                  ),
                  child: const Icon(Icons.check_circle_rounded, color: Color(0xFF10B981), size: 28),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Text(
                    '¡Contraseña Actualizada!',
                    style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold),
                  ),
                ),
              ],
            ),
            content: Text(
              'Tu contraseña ha sido guardada exitosamente. Ya puedes disfrutar de tus pedidos en Pídetelo.',
              style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF64748B)),
            ),
            actions: [
              ElevatedButton(
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFFF97316),
                  foregroundColor: Colors.white,
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 12),
                ),
                onPressed: () {
                  Navigator.pop(ctx);
                  if (widget.sessionService.currentUser != null) {
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CustomerHomeScreen(sessionService: widget.sessionService),
                      ),
                      (route) => false,
                    );
                  } else {
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(
                        builder: (_) => CustomerLoginScreen(sessionService: widget.sessionService),
                      ),
                      (route) => false,
                    );
                  }
                },
                child: Text('Continuar a la App', style: GoogleFonts.outfit(fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      }
    } catch (e) {
      if (mounted) {
        setState(() {
          _errorMessage = 'Error al actualizar: ${e.toString().replaceAll("Exception:", "").trim()}';
        });
      }
    } finally {
      if (mounted) {
        setState(() {
          _isLoading = false;
        });
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: Colors.white,
      body: SafeArea(
        child: Center(
          child: SingleChildScrollView(
            padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Header Icon
                Center(
                  child: Container(
                    width: 76,
                    height: 76,
                    decoration: BoxDecoration(
                      color: const Color(0xFFF97316).withOpacity(0.12),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: const Color(0xFFF97316).withOpacity(0.3), width: 1.5),
                    ),
                    child: const Icon(Icons.lock_reset_rounded, size: 38, color: Color(0xFFEA580C)),
                  ),
                ),
                const SizedBox(height: 20),

                Text(
                  'Nueva Contraseña',
                  style: GoogleFonts.outfit(
                    fontSize: 24,
                    fontWeight: FontWeight.bold,
                    color: const Color(0xFF0F172A),
                  ),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 8),

                Text(
                  'Crea una nueva contraseña segura para tu cuenta de Pídetelo.',
                  style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 28),

                // Error Banner
                if (_errorMessage != null) ...[
                  Container(
                    padding: const EdgeInsets.all(12),
                    decoration: BoxDecoration(
                      color: const Color(0xFFEF4444).withOpacity(0.1),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.3)),
                    ),
                    child: Row(
                      children: [
                        const Icon(Icons.error_outline_rounded, color: Color(0xFFEF4444), size: 20),
                        const SizedBox(width: 10),
                        Expanded(
                          child: Text(
                            _errorMessage!,
                            style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFFB91C1C), fontWeight: FontWeight.w500),
                          ),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 18),
                ],

                // New Password Input
                Text(
                  'NUEVA CONTRASEÑA',
                  style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _newPasswordController,
                  obscureText: _obscureNew,
                  style: GoogleFonts.outfit(color: const Color(0xFF0F172A), fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Mínimo 6 caracteres',
                    hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8)),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    prefixIcon: const Icon(Icons.lock_outline_rounded, color: Color(0xFF94A3B8), size: 20),
                    suffixIcon: IconButton(
                      icon: Icon(_obscureNew ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: const Color(0xFF94A3B8), size: 20),
                      onPressed: () => setState(() => _obscureNew = !_obscureNew),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFF97316), width: 1.5)),
                  ),
                ),
                const SizedBox(height: 18),

                // Confirm Password Input
                Text(
                  'CONFIRMAR CONTRASEÑA',
                  style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold, color: const Color(0xFF64748B), letterSpacing: 0.5),
                ),
                const SizedBox(height: 6),
                TextField(
                  controller: _confirmPasswordController,
                  obscureText: _obscureConfirm,
                  style: GoogleFonts.outfit(color: const Color(0xFF0F172A), fontSize: 14),
                  decoration: InputDecoration(
                    hintText: 'Repite tu nueva contraseña',
                    hintStyle: GoogleFonts.outfit(color: const Color(0xFF94A3B8)),
                    filled: true,
                    fillColor: const Color(0xFFF8FAFC),
                    prefixIcon: const Icon(Icons.lock_clock_outlined, color: Color(0xFF94A3B8), size: 20),
                    suffixIcon: IconButton(
                      icon: Icon(_obscureConfirm ? Icons.visibility_outlined : Icons.visibility_off_outlined, color: const Color(0xFF94A3B8), size: 20),
                      onPressed: () => setState(() => _obscureConfirm = !_obscureConfirm),
                    ),
                    contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
                    border: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFE2E8F0))),
                    focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(16), borderSide: const BorderSide(color: Color(0xFFF97316), width: 1.5)),
                  ),
                ),
                const SizedBox(height: 28),

                // Submit Button
                ElevatedButton(
                  onPressed: _isLoading ? null : _updatePassword,
                  style: ElevatedButton.styleFrom(
                    backgroundColor: const Color(0xFFF97316),
                    foregroundColor: Colors.white,
                    disabledBackgroundColor: const Color(0xFFF97316).withOpacity(0.4),
                    padding: const EdgeInsets.symmetric(vertical: 16),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    elevation: 3,
                  ),
                  child: _isLoading
                      ? const SizedBox(width: 22, height: 22, child: CircularProgressIndicator(strokeWidth: 2.5, color: Colors.white))
                      : Text(
                          'Actualizar Contraseña',
                          style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.bold),
                        ),
                ),
                const SizedBox(height: 16),

                TextButton(
                  onPressed: () {
                    Navigator.pushAndRemoveUntil(
                      context,
                      MaterialPageRoute(builder: (_) => CustomerLoginScreen(sessionService: widget.sessionService)),
                      (route) => false,
                    );
                  },
                  child: Text(
                    'Volver al Inicio de Sesión',
                    style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B), fontWeight: FontWeight.w600),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
