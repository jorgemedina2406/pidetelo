import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/services/session_service.dart';
import '../widgets/animated_delivery_mascot.dart';
import '../../rider/screens/rider_home_screen.dart';

class RiderLoginScreen extends StatefulWidget {
  final SessionService sessionService;

  const RiderLoginScreen({super.key, required this.sessionService});

  @override
  State<RiderLoginScreen> createState() => _RiderLoginScreenState();
}

class _RiderLoginScreenState extends State<RiderLoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();
  final _nationalIdController = TextEditingController();
  final _modelController = TextEditingController();
  final _plateController = TextEditingController();
  final String _vehicleType = 'Moto';

  bool _isLoading = false;
  bool _isRegister = false;
  bool _keepMeSignedIn = true;
  bool _obscurePassword = true;

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    _nationalIdController.dispose();
    _modelController.dispose();
    _plateController.dispose();
    super.dispose();
  }

  void _submit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor ingresa tu correo y contraseña.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    if (_isRegister) {
      final name = _nameController.text.trim();
      final phone = _phoneController.text.trim();
      final nationalId = _nationalIdController.text.trim();
      final model = _modelController.text.trim();
      final plate = _plateController.text.trim();

      if (name.isEmpty || phone.isEmpty || nationalId.isEmpty || plate.isEmpty) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Por favor completa todos los datos personales y de tu vehículo.')),
        );
        return;
      }

      final ok = await widget.sessionService.register(
        name: name,
        email: email,
        password: password,
        phone: phone,
        nationalId: nationalId,
        vehicleType: _vehicleType,
        vehicleModel: model.isEmpty ? 'Empire Keeway 150cc' : model,
        vehiclePlate: plate,
      );

      if (!ok) {
        if (!mounted) return;
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('No se pudo registrar el repartidor en la base de datos.'),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }
    } else {
      final ok = await widget.sessionService.login(email, password);
      if (!ok) {
        if (!mounted) return;
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Credenciales inválidas o no existe repartidor registrado con este correo.'),
            backgroundColor: Colors.redAccent,
          ),
        );
        return;
      }
    }

    if (!mounted) return;
    setState(() => _isLoading = false);

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => RiderHomeScreen(sessionService: widget.sessionService),
      ),
      (route) => false,
    );
  }

  @override
  Widget build(BuildContext context) {
    final screenHeight = MediaQuery.of(context).size.height;

    return Scaffold(
      backgroundColor: Colors.white,
      body: SingleChildScrollView(
        child: Column(
          children: [
            // TOP GREEN CURVED HEADER WITH ANIMATED MASCOT (Spanish)
            Stack(
              clipBehavior: Clip.none,
              children: [
                Container(
                  width: double.infinity,
                  height: screenHeight * 0.38,
                  decoration: const BoxDecoration(
                    gradient: LinearGradient(
                      colors: [Color(0xFF1E3A1E), Color(0xFF3F7E24)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.only(
                      bottomLeft: Radius.circular(36),
                      bottomRight: Radius.circular(36),
                    ),
                  ),
                  padding: const EdgeInsets.fromLTRB(28, 54, 20, 20),
                  child: Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      // Brand & Subtitle
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            RichText(
                              text: TextSpan(
                                style: GoogleFonts.outfit(
                                  fontSize: 32,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                                children: const [
                                  TextSpan(text: 'Píde'),
                                  TextSpan(
                                    text: 'telo',
                                    style: TextStyle(color: Color(0xFFA3E635)),
                                  ),
                                  TextSpan(text: '. Riders'),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Entregas ágiles,\nganancias reales.',
                              style: GoogleFonts.outfit(
                                fontSize: 14.5,
                                height: 1.3,
                                color: Colors.white.withValues(alpha: 0.95),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Animated Mascot
                      const AnimatedDeliveryMascot(size: 150),
                    ],
                  ),
                ),
              ],
            ),

            // FORM BODY (100% Spanish)
            Padding(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 24),
              child: ConstrainedBox(
                constraints: const BoxConstraints(maxWidth: 420),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Text(
                      _isRegister ? 'Registro de Repartidor' : 'Bienvenido de Nuevo',
                      style: GoogleFonts.outfit(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Registration Extra Fields
                    if (_isRegister) ...[
                      _buildRoundedInput(
                        controller: _nameController,
                        hint: 'Nombre y Apellido',
                        icon: Icons.person_outline_rounded,
                      ),
                      const SizedBox(height: 14),
                      _buildRoundedInput(
                        controller: _phoneController,
                        hint: 'Teléfono Móvil (ej: 04121234567)',
                        icon: Icons.phone_outlined,
                        keyboardType: TextInputType.phone,
                      ),
                      const SizedBox(height: 14),
                      _buildRoundedInput(
                        controller: _nationalIdController,
                        hint: 'Cédula de Identidad (ej: V-26123456)',
                        icon: Icons.badge_outlined,
                      ),
                      const SizedBox(height: 14),
                      _buildRoundedInput(
                        controller: _modelController,
                        hint: 'Marca y Modelo de Moto',
                        icon: Icons.two_wheeler_rounded,
                      ),
                      const SizedBox(height: 14),
                      _buildRoundedInput(
                        controller: _plateController,
                        hint: 'Placa del Vehículo',
                        icon: Icons.pin_outlined,
                      ),
                      const SizedBox(height: 14),
                    ],

                    // Email Input
                    _buildRoundedInput(
                      controller: _emailController,
                      hint: 'Correo Electrónico',
                      icon: Icons.mail_outline_rounded,
                      keyboardType: TextInputType.emailAddress,
                    ),
                    const SizedBox(height: 14),

                    // Password Input
                    _buildRoundedInput(
                      controller: _passwordController,
                      hint: 'Contraseña',
                      icon: Icons.lock_outline_rounded,
                      isPassword: true,
                      obscureText: _obscurePassword,
                      onTogglePassword: () => setState(() => _obscurePassword = !_obscurePassword),
                    ),
                    const SizedBox(height: 14),

                    // Keep signed in & Forgot Password in Spanish
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Checkbox(
                              value: _keepMeSignedIn,
                              activeColor: const Color(0xFF3F7E24),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(5)),
                              onChanged: (v) => setState(() => _keepMeSignedIn = v ?? true),
                            ),
                            Text(
                              'Recordarme',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w500,
                                color: const Color(0xFF64748B),
                              ),
                            ),
                          ],
                        ),
                        if (!_isRegister)
                          GestureDetector(
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Contacta a la central de despacho para restablecer.')),
                              );
                            },
                            child: Text(
                              '¿Olvidaste tu clave?',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF3F7E24),
                              ),
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // Main Action Button (Gradient Green)
                    Container(
                      height: 52,
                      decoration: BoxDecoration(
                        gradient: const LinearGradient(
                          colors: [Color(0xFF2E6B1F), Color(0xFF4A8F29)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF3F7E24).withValues(alpha: 0.35),
                            blurRadius: 14,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: ElevatedButton(
                        onPressed: _isLoading ? null : _submit,
                        style: ElevatedButton.styleFrom(
                          backgroundColor: Colors.transparent,
                          shadowColor: Colors.transparent,
                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(28)),
                        ),
                        child: _isLoading
                            ? const SizedBox(
                                width: 22,
                                height: 22,
                                child: CircularProgressIndicator(color: Colors.white, strokeWidth: 2.5),
                              )
                            : Text(
                                _isRegister ? 'Registrar como Rider' : 'Iniciar Sesión',
                                style: GoogleFonts.outfit(
                                  fontSize: 16,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                      ),
                    ),
                    const SizedBox(height: 24),

                    // Divider in Spanish
                    Row(
                      children: [
                        const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                        Padding(
                          padding: const EdgeInsets.symmetric(horizontal: 12),
                          child: Text(
                            'O continúa con',
                            style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                          ),
                        ),
                        const Expanded(child: Divider(color: Color(0xFFE2E8F0))),
                      ],
                    ),
                    const SizedBox(height: 18),

                    // Social Buttons (Google & Apple)
                    Row(
                      children: [
                        Expanded(
                          child: _buildSocialButton(
                            label: 'Google',
                            icon: Icons.g_mobiledata_rounded,
                            iconColor: const Color(0xFFEA4335),
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Acceso Google para repartidores vía correo.')),
                              );
                            },
                          ),
                        ),
                        const SizedBox(width: 14),
                        Expanded(
                          child: _buildSocialButton(
                            label: 'Apple',
                            icon: Icons.apple_rounded,
                            iconColor: Colors.black,
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(content: Text('Acceso Apple para repartidores vía correo.')),
                              );
                            },
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 24),

                    // Toggle register/login in Spanish
                    Center(
                      child: GestureDetector(
                        onTap: () => setState(() => _isRegister = !_isRegister),
                        child: RichText(
                          text: TextSpan(
                            style: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF64748B)),
                            children: [
                              TextSpan(
                                text: _isRegister ? '¿Ya estás registrado? ' : '¿No tienes una cuenta? ',
                              ),
                              TextSpan(
                                text: _isRegister ? 'Inicia Sesión' : 'Regístrate aquí',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF2E6B1F),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildRoundedInput({
    required TextEditingController controller,
    required String hint,
    required IconData icon,
    bool isPassword = false,
    bool obscureText = false,
    VoidCallback? onTogglePassword,
    TextInputType keyboardType = TextInputType.text,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 16),
      child: TextField(
        controller: controller,
        obscureText: isPassword && obscureText,
        keyboardType: keyboardType,
        style: GoogleFonts.outfit(fontSize: 14.5, color: const Color(0xFF0F172A), fontWeight: FontWeight.w600),
        decoration: InputDecoration(
          isDense: true,
          filled: false,
          fillColor: Colors.transparent,
          contentPadding: const EdgeInsets.symmetric(vertical: 14),
          icon: Icon(icon, color: const Color(0xFF94A3B8), size: 20),
          hintText: hint,
          hintStyle: GoogleFonts.outfit(fontSize: 14, color: const Color(0xFF94A3B8), fontWeight: FontWeight.w400),
          border: InputBorder.none,
          enabledBorder: InputBorder.none,
          focusedBorder: InputBorder.none,
          suffixIcon: isPassword
              ? IconButton(
                  icon: Icon(
                    obscureText ? Icons.visibility_off_outlined : Icons.visibility_outlined,
                    color: const Color(0xFF94A3B8),
                    size: 20,
                  ),
                  onPressed: onTogglePassword,
                )
              : null,
        ),
      ),
    );
  }

  Widget _buildSocialButton({
    required String label,
    required IconData icon,
    required Color iconColor,
    required VoidCallback onTap,
  }) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        height: 48,
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(22),
          border: Border.all(color: const Color(0xFFE2E8F0), width: 1.2),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Icon(icon, color: iconColor, size: 24),
            const SizedBox(width: 8),
            Text(
              label,
              style: GoogleFonts.outfit(
                fontSize: 14,
                fontWeight: FontWeight.w700,
                color: const Color(0xFF1E293B),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
