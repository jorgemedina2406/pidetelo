import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/constants/legal_terms.dart';
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

  // Biometric & ID Document verification state
  String? _idDocumentBase64;
  String? _selfieBase64;
  bool _acceptedTerms = true;
  final ImagePicker _picker = ImagePicker();

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
              const Icon(Icons.lock_reset_rounded, color: Color(0xFF3F7E24)),
              const SizedBox(width: 8),
              Text('Recuperar Clave Rider', style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 18)),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Ingresa el correo electrónico de tu cuenta de repartidor para recibir el enlace de recuperación:',
                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
              ),
              const SizedBox(height: 14),
              TextField(
                controller: emailCtrl,
                keyboardType: TextInputType.emailAddress,
                decoration: InputDecoration(
                  labelText: 'Correo Electrónico',
                  hintText: 'rider@pidetelo.com',
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
                  await Supabase.instance.client.auth.resetPasswordForEmail(email, redirectTo: 'pidetelo-rider://reset-password');
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
                backgroundColor: const Color(0xFF3F7E24),
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

  Future<void> _pickDocumentImage(ImageSource source) async {
    try {
      final XFile? file = await _picker.pickImage(
        source: source,
        imageQuality: 85,
        maxWidth: 1280,
        maxHeight: 1280,
      );
      if (file != null) {
        final bytes = await file.readAsBytes();
        final base64Str = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        setState(() {
          _idDocumentBase64 = base64Str;
        });
      }
    } catch (e) {
      debugPrint('[RiderLogin] Error al capturar documento: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al capturar imagen: $e')),
        );
      }
    }
  }

  Future<void> _pickSelfieImage(ImageSource source) async {
    try {
      final XFile? file = await _picker.pickImage(
        source: source,
        preferredCameraDevice: CameraDevice.front,
        imageQuality: 85,
        maxWidth: 1024,
        maxHeight: 1024,
      );
      if (file != null) {
        final bytes = await file.readAsBytes();
        final base64Str = 'data:image/jpeg;base64,${base64Encode(bytes)}';
        setState(() {
          _selfieBase64 = base64Str;
        });
      }
    } catch (e) {
      debugPrint('[RiderLogin] Error al capturar selfie: $e');
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Error al capturar selfie: $e')),
        );
      }
    }
  }

  void _showImageSourceDialog({required bool isSelfie}) {
    showModalBottomSheet(
      context: context,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => SafeArea(
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 16),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 40,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.grey.shade300, borderRadius: BorderRadius.circular(4)),
                ),
              ),
              const SizedBox(height: 16),
              Text(
                isSelfie ? 'Foto Selfie en Vivo' : 'Foto de Cédula de Identidad',
                style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.bold, color: const Color(0xFF1E293B)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 8),
              Text(
                isSelfie
                    ? 'Toma una foto frontal nítida de tu rostro con buena iluminación.'
                    : 'Asegúrate de que la cédula sea legible, completa y sin reflejos.',
                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF64748B)),
                textAlign: TextAlign.center,
              ),
              const SizedBox(height: 20),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: const Color(0xFF3F7E24).withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.camera_alt_rounded, color: Color(0xFF2E6B1F)),
                ),
                title: Text('Tomar con la Cámara', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(ctx);
                  if (isSelfie) {
                    _pickSelfieImage(ImageSource.camera);
                  } else {
                    _pickDocumentImage(ImageSource.camera);
                  }
                },
              ),
              ListTile(
                leading: Container(
                  padding: const EdgeInsets.all(10),
                  decoration: BoxDecoration(
                    color: Colors.blue.withOpacity(0.12),
                    borderRadius: BorderRadius.circular(12),
                  ),
                  child: const Icon(Icons.photo_library_rounded, color: Colors.blue),
                ),
                title: Text('Elegir de la Galería', style: GoogleFonts.outfit(fontWeight: FontWeight.w600)),
                onTap: () {
                  Navigator.pop(ctx);
                  if (isSelfie) {
                    _pickSelfieImage(ImageSource.gallery);
                  } else {
                    _pickDocumentImage(ImageSource.gallery);
                  }
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showLegalTermsModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.white,
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => DefaultTabController(
        length: 3,
        child: Container(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(color: const Color(0xFFCBD5E1), borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 16),
              TabBar(
                indicatorColor: const Color(0xFF2E6B1F),
                labelColor: const Color(0xFF2E6B1F),
                unselectedLabelColor: const Color(0xFF64748B),
                isScrollable: true,
                tabs: const [
                  Tab(text: 'Términos Rider'),
                  Tab(text: 'Términos Generales'),
                  Tab(text: 'Política Privacidad'),
                ],
              ),
              const SizedBox(height: 16),
              Expanded(
                child: TabBarView(
                  children: [
                    SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Acuerdo de Prestación de Servicios Rider', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                          const SizedBox(height: 10),
                          SelectableText(LegalTerms.riderServiceAgreement, style: GoogleFonts.outfit(fontSize: 12.5, height: 1.5, color: const Color(0xFF475569))),
                        ],
                      ),
                    ),
                    SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Términos y Condiciones Generales', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                          const SizedBox(height: 10),
                          SelectableText(LegalTerms.termsAndConditions, style: GoogleFonts.outfit(fontSize: 12.5, height: 1.5, color: const Color(0xFF475569))),
                        ],
                      ),
                    ),
                    SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Política de Privacidad y Tratamiento de Datos', style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: const Color(0xFF0F172A))),
                          const SizedBox(height: 10),
                          SelectableText(LegalTerms.privacyPolicy, style: GoogleFonts.outfit(fontSize: 12.5, height: 1.5, color: const Color(0xFF475569))),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
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
      if (!_isPasswordValid) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('La contraseña debe tener al menos 8 dígitos, una mayúscula y un carácter especial (*, ., etc).'),
            backgroundColor: Color(0xFFEF4444),
            behavior: SnackBarBehavior.floating,
          ),
        );
        return;
      }
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

      // Certificación obligatoria de documentos reales
      if (_idDocumentBase64 == null || _selfieBase64 == null) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Debes adjuntar la foto de tu Cédula y tu Selfie en vivo para certificar tu cuenta.'),
            backgroundColor: Colors.deepOrange,
          ),
        );
        return;
      }

      if (!_acceptedTerms) {
        setState(() => _isLoading = false);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Debes aceptar los Términos y Condiciones y Política de Privacidad de Pídetelo.'),
            backgroundColor: Colors.deepOrange,
          ),
        );
        return;
      }

      final ok = await widget.sessionService.registerWithVerification(
        name: name,
        email: email,
        password: password,
        phone: phone,
        nationalId: nationalId,
        vehicleType: _vehicleType,
        vehicleModel: model.isEmpty ? 'Empire Keeway 150cc' : model,
        vehiclePlate: plate,
        idDocumentBase64: _idDocumentBase64!,
        selfieBase64: _selfieBase64!,
      );

      if (!ok) {
        if (!mounted) return;
        setState(() => _isLoading = false);
        final errorMsg = widget.sessionService.lastErrorMessage ??
            'No se pudo completar la certificación. Verifica que las fotos sean nítidas y que tu correo no esté duplicado.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(errorMsg, style: const TextStyle(fontWeight: FontWeight.w600)),
            backgroundColor: Colors.redAccent,
            duration: const Duration(seconds: 4),
          ),
        );
        return;
      }

      if (mounted) {
        await showDialog(
          context: context,
          barrierDismissible: false,
          builder: (ctx) => AlertDialog(
            backgroundColor: Colors.white,
            surfaceTintColor: Colors.transparent,
            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(24)),
            title: Row(
              children: [
                const Icon(Icons.verified_rounded, color: Color(0xFF16A34A), size: 28),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    '¡Identidad Certificada!',
                    style: GoogleFonts.outfit(
                      fontSize: 18,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                ),
              ],
            ),
            content: Text(
              'Tus datos, cédula de identidad y selfie en vivo han sido verificados con éxito en Pídetelo.\n\nTu cuenta ha sido activada y ya puedes recibir órdenes de comercios y despachos independientes.',
              style: GoogleFonts.outfit(fontSize: 14, height: 1.45, color: const Color(0xFF334155), fontWeight: FontWeight.w500),
            ),
            actions: [
              ElevatedButton(
                onPressed: () => Navigator.pop(ctx),
                style: ElevatedButton.styleFrom(
                  backgroundColor: const Color(0xFF2E6B1F),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                ),
                child: Text('Comenzar a Trabajar', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
              ),
            ],
          ),
        );
      }
    } else {
      final ok = await widget.sessionService.login(email, password);
      if (!ok) {
        if (!mounted) return;
        setState(() => _isLoading = false);
        final msg = widget.sessionService.lastErrorMessage ?? 'El correo electrónico o la contraseña ingresados son incorrectos. Por favor, verifica tus datos.';
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(msg),
            backgroundColor: Colors.redAccent,
            duration: const Duration(seconds: 4),
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

                      // Document & Biometric Identity Certification Box
                      Container(
                        padding: const EdgeInsets.all(16),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF0FDF4),
                          borderRadius: BorderRadius.circular(20),
                          border: Border.all(color: const Color(0xFF86EFAC), width: 1.2),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Row(
                              children: [
                                const Icon(Icons.verified_user_rounded, color: Color(0xFF16A34A), size: 20),
                                const SizedBox(width: 8),
                                Text(
                                  'Certificación de Identidad Real',
                                  style: GoogleFonts.outfit(
                                    fontSize: 14.5,
                                    fontWeight: FontWeight.w800,
                                    color: const Color(0xFF166534),
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Validación real y obligatoria para todos los repartidores de Pídetelo.',
                              style: GoogleFonts.outfit(fontSize: 11.5, color: const Color(0xFF15803D)),
                            ),
                            const SizedBox(height: 12),
                            _buildVerificationTile(
                              title: 'Cédula de Identidad',
                              subtitle: _idDocumentBase64 != null ? 'Cédula capturada y validada' : 'Toca para tomar foto o adjuntar',
                              icon: Icons.badge_outlined,
                              isUploaded: _idDocumentBase64 != null,
                              onTap: () => _showImageSourceDialog(isSelfie: false),
                            ),
                            const SizedBox(height: 8),
                            _buildVerificationTile(
                              title: 'Foto Selfie en Vivo',
                              subtitle: _selfieBase64 != null ? 'Biometría facial registrada' : 'Toca para tomar selfie de tu rostro',
                              icon: Icons.face_rounded,
                              isUploaded: _selfieBase64 != null,
                              onTap: () => _showImageSourceDialog(isSelfie: true),
                            ),
                          ],
                        ),
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
                        padding: const EdgeInsets.all(12),
                        decoration: BoxDecoration(
                          color: const Color(0xFFF1F5F9),
                          borderRadius: BorderRadius.circular(14),
                          border: Border.all(
                            color: _isPasswordValid
                                ? const Color(0xFF10B981).withValues(alpha: 0.5)
                                : const Color(0xFFCBD5E1),
                          ),
                        ),
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Requisitos de contraseña segura:',
                              style: GoogleFonts.outfit(
                                fontSize: 11.5,
                                fontWeight: FontWeight.w700,
                                color: const Color(0xFF475569),
                              ),
                            ),
                            const SizedBox(height: 6),
                            _buildPasswordReqRow('Mínimo 8 caracteres', _hasMinLength),
                            _buildPasswordReqRow('Al menos 1 letra mayúscula (A-Z)', _hasUppercase),
                            _buildPasswordReqRow('Al menos 1 carácter especial (*, ., @, etc)', _hasSpecialChar),
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
                            onTap: _showForgotPasswordDialog,
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
                    // Terms of Service & Privacy agreement
                    if (_isRegister) ...[
                      const SizedBox(height: 12),
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Checkbox(
                            value: _acceptedTerms,
                            activeColor: const Color(0xFF3F7E24),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(4)),
                            onChanged: (v) => setState(() => _acceptedTerms = v ?? true),
                          ),
                          Expanded(
                            child: GestureDetector(
                              onTap: _showLegalTermsModal,
                              child: RichText(
                                text: TextSpan(
                                  style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF64748B)),
                                  children: const [
                                    TextSpan(text: 'Acepto los '),
                                    TextSpan(
                                      text: 'Términos de Servicio',
                                      style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E6B1F), decoration: TextDecoration.underline),
                                    ),
                                    TextSpan(text: ' y la '),
                                    TextSpan(
                                      text: 'Política de Privacidad',
                                      style: TextStyle(fontWeight: FontWeight.bold, color: Color(0xFF2E6B1F), decoration: TextDecoration.underline),
                                    ),
                                    TextSpan(text: ' de Pídetelo.'),
                                  ],
                                ),
                              ),
                            ),
                          ),
                        ],
                      ),
                    ],

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

                    // Social Button (Google)
                    _buildSocialButton(
                      label: 'Continuar con Google',
                      icon: Icons.g_mobiledata_rounded,
                      iconColor: const Color(0xFFEA4335),
                      onTap: () {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Acceso Google para repartidores vía correo.')),
                        );
                      },
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
        onChanged: (val) {
          if (mounted) setState(() {});
        },
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

  Widget _buildVerificationTile({
    required String title,
    required String subtitle,
    required IconData icon,
    required bool isUploaded,
    required VoidCallback onTap,
  }) {
    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        decoration: BoxDecoration(
          color: isUploaded ? const Color(0xFFDCFCE7) : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isUploaded ? const Color(0xFF22C55E) : const Color(0xFFCBD5E1),
            width: isUploaded ? 1.5 : 1,
          ),
        ),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(8),
              decoration: BoxDecoration(
                color: isUploaded ? const Color(0xFF16A34A) : const Color(0xFFF1F5F9),
                shape: BoxShape.circle,
              ),
              child: Icon(
                isUploaded ? Icons.check_rounded : icon,
                color: isUploaded ? Colors.white : const Color(0xFF64748B),
                size: 20,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 13.5,
                      fontWeight: FontWeight.w700,
                      color: const Color(0xFF0F172A),
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.outfit(
                      fontSize: 11.5,
                      fontWeight: FontWeight.w500,
                      color: isUploaded ? const Color(0xFF15803D) : const Color(0xFF64748B),
                    ),
                  ),
                ],
              ),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: isUploaded ? const Color(0xFF22C55E).withOpacity(0.15) : const Color(0xFFF1F5F9),
                borderRadius: BorderRadius.circular(20),
              ),
              child: Text(
                isUploaded ? 'Cargada' : 'Adjuntar',
                style: GoogleFonts.outfit(
                  fontSize: 11,
                  fontWeight: FontWeight.w700,
                  color: isUploaded ? const Color(0xFF15803D) : const Color(0xFF334155),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
