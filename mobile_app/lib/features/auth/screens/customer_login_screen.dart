import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/config/app_config.dart';
import '../../../core/models/user_model.dart';
import '../../../core/services/session_service.dart';
import '../widgets/animated_delivery_mascot.dart';
import '../../customer/screens/customer_home_screen.dart';

class CustomerLoginScreen extends StatefulWidget {
  final SessionService sessionService;

  const CustomerLoginScreen({super.key, required this.sessionService});

  @override
  State<CustomerLoginScreen> createState() => _CustomerLoginScreenState();
}

class _CustomerLoginScreenState extends State<CustomerLoginScreen> {
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();
  final _nameController = TextEditingController();
  final _phoneController = TextEditingController();

  bool _isLoading = false;
  bool _isRegister = false;
  bool _keepMeSignedIn = true;
  bool _obscurePassword = true;

  @override
  void initState() {
    super.initState();
    _passwordController.addListener(() {
      if (_isRegister && mounted) setState(() {});
    });
  }

  bool get _hasMinLength => _passwordController.text.length >= 8;
  bool get _hasUppercase => RegExp(r'[A-Z]').hasMatch(_passwordController.text);
  bool get _hasSpecialChar => RegExp(r'[!@#$%^&*(),.?":{}|<>_\-+=[\]\\\/~`]').hasMatch(_passwordController.text);
  bool get _isPasswordValid => _hasMinLength && _hasUppercase && _hasSpecialChar;

  void _showForgotPasswordDialog() {
    final emailCtrl = TextEditingController(text: _emailController.text.trim());
    bool isSending = false;
    showDialog(
      context: context,
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setDlgState) => AlertDialog(
          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
          title: Row(
            children: [
              const Icon(Icons.lock_reset_rounded, color: Color(0xFF4A8F29)),
              const SizedBox(width: 8),
              Text('Recuperar Clave', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 18)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Ingresa tu correo registrado para enviarte un enlace de recuperación:',
                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Correo Electrónico',
                  hintText: 'ejemplo@correo.com',
                  prefixIcon: const Icon(Icons.email_outlined),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12)),
                ),
              ),
            ],
          ),
          actions: [
            TextButton(
              onPressed: isSending ? null : () => Navigator.pop(ctx),
              child: Text('Cancelar', style: GoogleFonts.outfit(color: const Color(0xFF64748B))),
            ),
            ElevatedButton(
              onPressed: isSending ? null : () async {
                final email = emailCtrl.text.trim();
                if (email.isEmpty || !email.contains('@')) {
                  ScaffoldMessenger.of(context).showSnackBar(const SnackBar(content: Text('Ingresa un correo válido')));
                  return;
                }
                setDlgState(() => isSending = true);
                try {
                  await Supabase.instance.client.auth.resetPasswordForEmail(email, redirectTo: 'pidetelo://reset-password');
                  if (mounted) {
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(
                        content: Text('Enlace enviado a ' + email + '. Revisa tu correo o spam.'),
                        backgroundColor: const Color(0xFF10B981),
                      ),
                    );
                  }
                } catch (e) {
                  setDlgState(() => isSending = false);
                  if (mounted) {
                    ScaffoldMessenger.of(context).showSnackBar(
                      SnackBar(content: Text('Error: ' + e.toString()), backgroundColor: const Color(0xFFEF4444)),
                    );
                  }
                }
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: const Color(0xFF4A8F29),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
              ),
              child: isSending
                  ? const SizedBox(width: 18, height: 18, child: CircularProgressIndicator(strokeWidth: 2, color: Colors.white))
                  : Text('Enviar Enlace', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _handleOAuthLogin(OAuthProvider provider) async {
    try {
      setState(() => _isLoading = true);
      await Supabase.instance.client.auth.signInWithOAuth(provider, redirectTo: 'pidetelo://login-callback');
    } catch (e) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error con acceso social: ' + e.toString()), backgroundColor: const Color(0xFFEF4444)),
        );
      }
    } finally {
      if (mounted) setState(() => _isLoading = false);
    }
  }

  @override
  void dispose() {
    _emailController.dispose();
    _passwordController.dispose();
    _nameController.dispose();
    _phoneController.dispose();
    super.dispose();
  }

  void _submit() async {
    final email = _emailController.text.trim();
    final password = _passwordController.text.trim();
    final name = _nameController.text.trim();
    final phone = _phoneController.text.trim();

    if (email.isEmpty || password.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor ingresa tu correo y contraseña.')),
      );
      return;
    }

    if (_isRegister && !_isPasswordValid) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(
          content: Text('La contraseña debe tener al menos 8 dígitos, una mayúscula y un carácter especial (*, ., etc).'),
          backgroundColor: Color(0xFFEF4444),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (_isRegister && (name.isEmpty || phone.isEmpty)) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Por favor completa tu nombre y número de teléfono.')),
      );
      return;
    }

    setState(() => _isLoading = true);

    String registeredName = name;
    String registeredPhone = phone;
    String userId = '';

    try {
      final supabase = Supabase.instance.client;

      if (_isRegister) {
        User? createdUser;
        try {
          final authRes = await supabase.auth.signUp(
            email: email,
            password: password,
            data: {
              'full_name': name,
              'phone': phone,
              'role': 'CUSTOMER',
            },
          );
          createdUser = authRes.user;
        } catch (signupErr) {
          final errStr = signupErr.toString().toLowerCase();
          // Fallback vía backend Admin API si Supabase alcanza el límite de envío de correos
          if (errStr.contains('rate') || errStr.contains('429') || errStr.contains('email')) {
            try {
              final regUri = Uri.parse('${AppConfig.backendBaseUrl}/auth/register-customer');
              final resp = await http.post(
                regUri,
                headers: {'Content-Type': 'application/json'},
                body: jsonEncode({
                  'email': email,
                  'password': password,
                  'name': name,
                  'phone': phone,
                }),
              ).timeout(const Duration(seconds: 6));

              if (resp.statusCode == 200 || resp.statusCode == 201) {
                final loginRes = await supabase.auth.signInWithPassword(
                  email: email,
                  password: password,
                );
                createdUser = loginRes.user;
              } else {
                throw signupErr;
              }
            } catch (_) {
              throw signupErr;
            }
          } else {
            rethrow;
          }
        }

        userId = createdUser?.id ?? 'cust_${DateTime.now().millisecondsSinceEpoch}';
        registeredName = name;

        // Sincronizar de inmediato el perfil en la base de datos de Pídetelo
        if (createdUser != null) {
          try {
            await supabase.from('profiles').upsert({
              'id': createdUser.id,
              'full_name': name,
              'email': email,
              'phone': phone,
              'role': 'CUSTOMER',
              'is_active': true,
              'updated_at': DateTime.now().toIso8601String(),
            });
          } catch (_) {}
        }
      } else {
        final authRes = await supabase.auth.signInWithPassword(
          email: email,
          password: password,
        );

        if (authRes.user == null) {
          throw Exception('Credenciales incorrectas o usuario no registrado');
        }

        userId = authRes.user!.id;
        final meta = authRes.user?.userMetadata;
        bool isDeactivated = meta?['is_active'] == false || 
                             meta?['status'] == 'inactive' || 
                             meta?['status'] == 'disabled' || 
                             meta?['disabled'] == true;

        if (!isDeactivated) {
          try {
            final profRow = await supabase
                .from('profiles')
                .select('is_active')
                .eq('id', userId)
                .maybeSingle();
            if (profRow != null && profRow['is_active'] == false) {
              isDeactivated = true;
            }
          } catch (_) {}
        }

        if (isDeactivated) {
          await supabase.auth.signOut();
          throw Exception('Tu cuenta se encuentra desactivada por la administración de la plataforma. Comunícate con soporte de Pídetelo para más información.');
        }

        if (meta != null) {
          final cloudName = meta['full_name'] ?? meta['name'];
          if (cloudName != null && cloudName.toString().trim().isNotEmpty) {
            registeredName = cloudName.toString().trim();
          }
          final cloudPhone = meta['phone'];
          if (cloudPhone != null && cloudPhone.toString().trim().isNotEmpty) {
            registeredPhone = cloudPhone.toString().trim();
          }
        }
      }
    } catch (e) {
      setState(() => _isLoading = false);
      String userMessage = e.toString().replaceAll('Exception:', '').replaceAll('AuthException:', '').trim();
      final lower = userMessage.toLowerCase();
      if (lower.contains('banned') || lower.contains('user is banned') || lower.contains('desactivada') || lower.contains('desactivado') || lower.contains('inactiva') || lower.contains('inactivo')) {
        userMessage = 'Tu cuenta se encuentra desactivada por la administración de la plataforma. Comunícate con soporte de Pídetelo para más información.';
      } else if (lower.contains('invalid login credentials') || lower.contains('invalid_grant') || lower.contains('invalid credentials') || lower.contains('credenciales incorrectas')) {
        userMessage = 'El correo electrónico o la contraseña ingresados son incorrectos. Por favor, verifica tus datos e inténtalo nuevamente.';
      } else if (lower.contains('rate') || lower.contains('429')) {
      } else if (lower.contains('network') || lower.contains('socketexception') || lower.contains('connection refused')) {
        userMessage = 'Error de conexión. Por favor verifica tu acceso a internet e inténtalo de nuevo.';
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(userMessage),
          backgroundColor: Colors.redAccent,
          duration: const Duration(seconds: 5),
        ),
      );
      return;
    }

    if (registeredName.isEmpty) {
      final prefix = email.split('@').first;
      registeredName = prefix[0].toUpperCase() + prefix.substring(1);
    }

    final customer = AppUser(
      id: userId.isNotEmpty ? userId : 'cust_${DateTime.now().millisecondsSinceEpoch}',
      name: registeredName,
      email: email,
      phone: registeredPhone,
      role: AppUserRole.customer,
      deliveryAddress: 'Cabudare, Edo. Lara',
    );

    await widget.sessionService.saveUser(customer);

    if (!mounted) return;
    setState(() => _isLoading = false);

    Navigator.of(context).pushAndRemoveUntil(
      MaterialPageRoute(
        builder: (_) => CustomerHomeScreen(sessionService: widget.sessionService),
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
                      colors: [Color(0xFF2E6B1F), Color(0xFF4A8F29)],
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
                      // Brand & Subtitle in Spanish
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            RichText(
                              text: TextSpan(
                                style: GoogleFonts.outfit(
                                  fontSize: 34,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.white,
                                ),
                                children: const [
                                  TextSpan(text: 'Píde'),
                                  TextSpan(
                                    text: 'telo',
                                    style: TextStyle(color: Color(0xFFF97316)),
                                  ),
                                  TextSpan(text: '.'),
                                ],
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Comida caliente,\ndirecto a tu puerta.',
                              style: GoogleFonts.outfit(
                                fontSize: 15,
                                height: 1.3,
                                color: Colors.white.withValues(alpha: 0.95),
                                fontWeight: FontWeight.w500,
                              ),
                            ),
                          ],
                        ),
                      ),
                      // Animated Delivery Mascot
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
                      _isRegister ? 'Crear Cuenta' : 'Bienvenido de Nuevo',
                      style: GoogleFonts.outfit(
                        fontSize: 26,
                        fontWeight: FontWeight.w800,
                        color: const Color(0xFF1E293B),
                      ),
                    ),
                    const SizedBox(height: 20),

                    // Registration extra fields
                    if (_isRegister) ...[
                      _buildRoundedInput(
                        controller: _nameController,
                        hint: 'Nombre Completo',
                        icon: Icons.person_outline_rounded,
                      ),
                      const SizedBox(height: 14),
                      _buildRoundedInput(
                        controller: _phoneController,
                        hint: 'Teléfono Móvil (+58 412...)',
                        icon: Icons.phone_outlined,
                        keyboardType: TextInputType.phone,
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
                    if (_isRegister) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(12),
                          border: Border.all(color: _isPasswordValid ? const Color(0xFF10B981) : const Color(0xFFE2E8F0)),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                Icon(
                                  _isPasswordValid ? Icons.check_circle_rounded : Icons.shield_outlined,
                                  size: 14,
                                  color: _isPasswordValid ? const Color(0xFF10B981) : const Color(0xFF64748B),
                                ),
                                const SizedBox(width: 6),
                                Text(
                                  _isPasswordValid ? 'Contraseña segura ✓' : 'Requisitos de la contraseña:',
                                  style: GoogleFonts.outfit(
                                    fontSize: 11.5,
                                    fontWeight: FontWeight.w700,
                                    color: _isPasswordValid ? const Color(0xFF10B981) : const Color(0xFF475569),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 6),
                            _buildPasswordReqRow('Mínimo 8 caracteres', _hasMinLength),
                            _buildPasswordReqRow('Al menos 1 letra mayúscula (A-Z)', _hasUppercase),
                            _buildPasswordReqRow('Al menos 1 carácter especial (*, ., @, #, etc.)', _hasSpecialChar),
                          ],
                        ),
                      ),
                    ],
                    const SizedBox(height: 14),

                    // Keep signed in & Forgot Password in Spanish
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Checkbox(
                              value: _keepMeSignedIn,
                              activeColor: const Color(0xFF4A8F29),
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
                            onTap: _showForgotPasswordDialog,
                            child: Text(
                              '¿Olvidaste tu clave?',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF4A8F29),
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
                          colors: [Color(0xFF3F7E24), Color(0xFF5CAE31)],
                          begin: Alignment.centerLeft,
                          end: Alignment.centerRight,
                        ),
                        borderRadius: BorderRadius.circular(28),
                        boxShadow: [
                          BoxShadow(
                            color: const Color(0xFF4A8F29).withValues(alpha: 0.35),
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
                                _isRegister ? 'Registrarme' : 'Iniciar Sesión',
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

                    // Social Button (Google)
                    _buildSocialButton(
                      label: 'Continuar con Google',
                      icon: Icons.g_mobiledata_rounded,
                      iconColor: const Color(0xFFEA4335),
                      onTap: () => _handleOAuthLogin(OAuthProvider.google),
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
                                text: _isRegister ? '¿Ya tienes una cuenta? ' : '¿No tienes una cuenta? ',
                              ),
                              TextSpan(
                                text: _isRegister ? 'Inicia Sesión' : 'Regístrate aquí',
                                style: const TextStyle(
                                  fontWeight: FontWeight.w800,
                                  color: Color(0xFF4A8F29),
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

  Widget _buildPasswordReqRow(String label, bool satisfied) {
    return Padding(
      padding: const EdgeInsets.only(top: 2),
      child: Row(
        children: [
          Icon(
            satisfied ? Icons.check_circle_rounded : Icons.radio_button_unchecked_rounded,
            size: 13,
            color: satisfied ? const Color(0xFF10B981) : const Color(0xFF94A3B8),
          ),
          const SizedBox(width: 6),
          Text(
            label,
            style: GoogleFonts.outfit(
              fontSize: 11,
              fontWeight: satisfied ? FontWeight.w600 : FontWeight.w400,
              color: satisfied ? const Color(0xFF15803D) : const Color(0xFF64748B),
            ),
          ),
        ],
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
