import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:image_picker/image_picker.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../../../core/models/order_model.dart';
import '../../../core/models/user_model.dart';
import '../../../core/services/dolar_api_service.dart';
import '../../../core/services/rider_service.dart';
import '../../../core/services/rider_location_service.dart';
import '../../../core/services/background_order_service.dart';
import '../../../core/services/session_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/screens/rider_login_screen.dart';
import 'rider_navigation_screen.dart';

class RiderHomeScreen extends StatefulWidget {
  final SessionService sessionService;

  const RiderHomeScreen({super.key, required this.sessionService});

  @override
  State<RiderHomeScreen> createState() => _RiderHomeScreenState();
}

class _RiderHomeScreenState extends State<RiderHomeScreen> {
  int _selectedTab = 0;
  final RiderService _riderService = RiderService();
  final DolarApiService _dolarApi = DolarApiService();
  final RiderLocationService _locationService = RiderLocationService();

  @override
  void initState() {
    super.initState();
    final riderId = widget.sessionService.currentRider?.id;
    _riderService.init(riderId);
    _dolarApi.init();
    if (riderId != null && riderId.isNotEmpty) {
      BackgroundOrderService().startService(riderId);
      _locationService.startTracking(riderId);
      _locationService.addListener(_onLocationUpdate);
    }
  }

  @override
  void dispose() {
    _locationService.removeListener(_onLocationUpdate);
    super.dispose();
  }

  void _onLocationUpdate() {
    if (mounted) setState(() {});
  }

  // --- MODAL: AGREGAR CUENTA DE RETIRO (VALIDANDO PERFIL) ---
  void _showAddAccountModal(BuildContext context, RiderUser rider) {
    final typeCtrl = ValueNotifier<String>('pago_movil');
    final bankCtrl = TextEditingController(text: '0102 - Banco de Venezuela');
    final accountCtrl = TextEditingController(); // Phone or Account
    final idCtrl = TextEditingController(text: rider.nationalId ?? '');
    final nameCtrl = TextEditingController(text: rider.name);
    final phoneCtrl = TextEditingController(text: rider.phone);

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setMState) {
          return Padding(
            padding: EdgeInsets.only(
              left: 24,
              right: 24,
              top: 24,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Registrar Método de Retiro',
                    style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Por seguridad, la cuenta debe ser personal y coincidir exactamente con los datos de tu perfil de repartidor.',
                    style: GoogleFonts.outfit(
                      fontSize: 12,
                      color: const Color(0xFF94A3B8),
                    ),
                  ),
                  const SizedBox(height: 16),

                  // Account Type Selector
                  Row(
                    children: [
                      _buildMethodChip('Pago Móvil', typeCtrl.value == 'pago_movil', () {
                        setMState(() => typeCtrl.value = 'pago_movil');
                      }),
                      const SizedBox(width: 8),
                      _buildMethodChip('Transferencia', typeCtrl.value == 'bank_transfer', () {
                        setMState(() => typeCtrl.value = 'bank_transfer');
                      }),
                      const SizedBox(width: 8),
                      _buildMethodChip('Zelle', typeCtrl.value == 'zelle', () {
                        setMState(() => typeCtrl.value = 'zelle');
                      }),
                    ],
                  ),
                  const SizedBox(height: 16),

                  // Bank / Platform Name
                  Text('Banco / Entidad', style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: bankCtrl,
                    style: GoogleFonts.outfit(color: Colors.white),
                    decoration: const InputDecoration(hintText: 'Ej: 0102 - Banco de Venezuela, Banesco, Mercantil'),
                  ),
                  const SizedBox(height: 12),

                  // Account Number / Identifier
                  Text(
                    typeCtrl.value == 'pago_movil'
                        ? 'Número de Teléfono Pago Móvil'
                        : typeCtrl.value == 'zelle'
                            ? 'Correo o Teléfono Zelle'
                            : 'Número de Cuenta (20 dígitos)',
                    style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70),
                  ),
                  const SizedBox(height: 6),
                  TextField(
                    controller: accountCtrl,
                    style: GoogleFonts.outfit(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: typeCtrl.value == 'pago_movil'
                          ? '04121234567'
                          : typeCtrl.value == 'zelle'
                              ? 'rider@ejemplo.com'
                              : '01020000000000000000',
                    ),
                  ),
                  const SizedBox(height: 12),

                  // Titular Name (Verified against profile)
                  Text('Nombre del Titular (Debe ser tuyo)', style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: nameCtrl,
                    style: GoogleFonts.outfit(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: rider.name,
                      helperText: 'Debe coincidir con: ${rider.name}',
                      helperStyle: const TextStyle(color: Color(0xFF65A30D)),
                    ),
                  ),
                  const SizedBox(height: 12),

                  // National ID (Cédula)
                  Text('Cédula de Identidad', style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: idCtrl,
                    style: GoogleFonts.outfit(color: Colors.white),
                    decoration: InputDecoration(
                      hintText: rider.nationalId ?? 'V-12345678',
                      helperText: 'Debe coincidir con: ${rider.nationalId ?? "Tu cédula"}',
                      helperStyle: const TextStyle(color: Color(0xFF65A30D)),
                    ),
                  ),
                  const SizedBox(height: 22),

                  // Save Button
                  ElevatedButton(
                    onPressed: () async {
                      final enteredBank = bankCtrl.text.trim();
                      final enteredAcc = accountCtrl.text.trim();
                      final enteredName = nameCtrl.text.trim();
                      final enteredId = idCtrl.text.trim();

                      if (enteredBank.isEmpty || enteredAcc.isEmpty || enteredName.isEmpty || enteredId.isEmpty) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Por favor completa todos los campos requeridos.')),
                        );
                        return;
                      }

                      // STRICT PROFILE VALIDATION (Item 5 requirement)
                      final profileNameNormalized = rider.name.toLowerCase().replaceAll(RegExp(r'\s+'), '');
                      final enteredNameNormalized = enteredName.toLowerCase().replaceAll(RegExp(r'\s+'), '');

                      final profileIdNormalized = (rider.nationalId ?? '').toUpperCase().replaceAll(RegExp(r'[^0-9A-Z]'), '');
                      final enteredIdNormalized = enteredId.toUpperCase().replaceAll(RegExp(r'[^0-9A-Z]'), '');

                      if (profileIdNormalized.isNotEmpty && profileIdNormalized != enteredIdNormalized) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'Validación fallida: La cédula ($enteredId) no coincide con la de tu perfil (${rider.nationalId}). Por seguridad solo puedes retirar a tus propias cuentas.',
                            ),
                            backgroundColor: Colors.redAccent,
                          ),
                        );
                        return;
                      }

                      // Check name match approximately (at least first name or last name contained)
                      if (!profileNameNormalized.contains(enteredNameNormalized) &&
                          !enteredNameNormalized.contains(profileNameNormalized)) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text(
                              'Validación fallida: El titular ($enteredName) no coincide con tu nombre registrado (${rider.name}).',
                            ),
                            backgroundColor: Colors.redAccent,
                          ),
                        );
                        return;
                      }

                      final newAccount = RiderPaymentAccount(
                        id: 'acc_${DateTime.now().millisecondsSinceEpoch}',
                        type: typeCtrl.value,
                        bank: enteredBank,
                        accountNumber: enteredAcc,
                        holderName: enteredName,
                        nationalId: enteredId,
                        phone: phoneCtrl.text.trim(),
                        isDefault: rider.paymentAccounts.isEmpty,
                      );

                      await widget.sessionService.addPaymentAccount(newAccount);

                      if (!ctx.mounted) return;
                      Navigator.pop(ctx);

                      ScaffoldMessenger.of(context).showSnackBar(
                        const SnackBar(
                          content: Text('Método de retiro verificado y agregado exitosamente.'),
                          backgroundColor: Color(0xFF10B981),
                        ),
                      );
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 14),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                    ),
                    child: Text(
                      'Verificar y Guardar Cuenta',
                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  // --- MODAL: SOLICITAR RETIRO ---
  void _showWithdrawalModal(BuildContext context, [MerchantEarningSummary? preselectedMerchant]) {
    final rider = widget.sessionService.currentRider;
    if (rider == null) return;

    if (rider.paymentAccounts.isEmpty) {
      _showAddAccountModal(context, rider);
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Primero registra un método de retiro verificado a tu nombre.')),
      );
      return;
    }

    final merchantList = _riderService.merchantBalances;
    MerchantEarningSummary? selectedMerchant = preselectedMerchant;
    if (selectedMerchant == null && merchantList.isNotEmpty) {
      selectedMerchant = merchantList.firstWhere(
        (m) => m.availableBalance > 0,
        orElse: () => merchantList.first,
      );
    }

    final amountCtrl = TextEditingController();
    RiderPaymentAccount selectedAcc = rider.paymentAccounts.first;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          final maxBalance = selectedMerchant != null
              ? selectedMerchant!.availableBalance
              : _riderService.availableBalance;

          return Padding(
            padding: EdgeInsets.only(
              left: 24,
              right: 24,
              top: 24,
              bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
            ),
            child: SingleChildScrollView(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 4,
                      decoration: BoxDecoration(
                        color: Colors.white24,
                        borderRadius: BorderRadius.circular(10),
                      ),
                    ),
                  ),
                  const SizedBox(height: 18),
                  Text(
                    'Solicitar Retiro de Ganancias',
                    style: GoogleFonts.outfit(
                      fontSize: 20,
                      fontWeight: FontWeight.w800,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'Selecciona el comercio y tu cuenta para recibir la liquidación vía Pago Móvil.',
                    style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                  ),
                  const SizedBox(height: 14),

                  // Selector de Comercio al que se le solicita
                  if (merchantList.isNotEmpty) ...[
                    Text('Comercio deudor', style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.w600)),
                    const SizedBox(height: 6),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 14),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(14),
                        border: Border.all(color: Colors.white12),
                      ),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<MerchantEarningSummary>(
                          value: selectedMerchant,
                          isExpanded: true,
                          dropdownColor: const Color(0xFF1E293B),
                          items: merchantList.map((m) {
                            return DropdownMenuItem(
                              value: m,
                              child: Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Expanded(
                                    child: Text(
                                      m.merchantName,
                                      style: GoogleFonts.outfit(fontSize: 13, color: Colors.white, fontWeight: FontWeight.bold),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ),
                                  Text(
                                    '\$${m.availableBalance.toStringAsFixed(2)}',
                                    style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.primary, fontWeight: FontWeight.bold),
                                  ),
                                ],
                              ),
                            );
                          }).toList(),
                          onChanged: (m) {
                            if (m != null) {
                              setModalState(() {
                                selectedMerchant = m;
                                amountCtrl.text = '';
                              });
                            }
                          },
                        ),
                      ),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Saldo disponible en este local: ${_dolarApi.formatUsdWithBs(maxBalance)}',
                      style: GoogleFonts.outfit(
                        fontSize: 12,
                        color: AppTheme.primary,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                    const SizedBox(height: 14),
                  ],

                  // Account Selector
                  Text('Cuenta Destino (Verificada)', style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 14),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white12),
                    ),
                    child: DropdownButtonHideUnderline(
                      child: DropdownButton<RiderPaymentAccount>(
                        value: selectedAcc,
                        isExpanded: true,
                        dropdownColor: const Color(0xFF1E293B),
                        items: rider.paymentAccounts.map((acc) {
                          return DropdownMenuItem(
                            value: acc,
                            child: Text(
                              '${acc.type.toUpperCase()}: ${acc.bank} - ${acc.accountNumber}',
                              style: GoogleFonts.outfit(fontSize: 13, color: Colors.white),
                            ),
                          );
                        }).toList(),
                        onChanged: (acc) {
                          if (acc != null) setModalState(() => selectedAcc = acc);
                        },
                      ),
                    ),
                  ),
                  const SizedBox(height: 14),

                  // Amount input
                  Text('Monto a Retirar (\$ USD)', style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70, fontWeight: FontWeight.w600)),
                  const SizedBox(height: 6),
                  TextField(
                    controller: amountCtrl,
                    keyboardType: const TextInputType.numberWithOptions(decimal: true),
                    style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w700),
                    onChanged: (v) => setModalState(() {}),
                    decoration: InputDecoration(
                      hintText: '0.00',
                      prefixText: '\$ ',
                      prefixStyle: GoogleFonts.outfit(color: AppTheme.primary, fontWeight: FontWeight.w700),
                      suffixIcon: TextButton(
                        onPressed: () {
                          amountCtrl.text = maxBalance.toStringAsFixed(2);
                          setModalState(() {});
                        },
                        child: Text(
                          'TODO',
                          style: GoogleFonts.outfit(
                            color: AppTheme.primary,
                            fontWeight: FontWeight.w800,
                            fontSize: 12,
                          ),
                        ),
                      ),
                    ),
                  ),
                  if ((double.tryParse(amountCtrl.text) ?? 0) > 0) ...[
                    const SizedBox(height: 6),
                    Text(
                      'Equivalente oficial: ${_dolarApi.formatUsdWithBs(double.tryParse(amountCtrl.text) ?? 0)}',
                      style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF65A30D), fontWeight: FontWeight.w700),
                    ),
                  ],
                  const SizedBox(height: 22),

                  ElevatedButton(
                    onPressed: () async {
                      final enteredAmount = double.tryParse(amountCtrl.text.trim()) ?? 0.0;

                      if (enteredAmount <= 0) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('Ingresa un monto válido para retirar.')),
                        );
                        return;
                      }

                      if (enteredAmount > maxBalance) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          const SnackBar(content: Text('El monto supera el saldo disponible de este comercio.')),
                        );
                        return;
                      }

                      final destDetails = '${selectedAcc.bank} • ${selectedAcc.accountNumber} • ${selectedAcc.nationalId}';
                      final targetTenantId = selectedMerchant?.tenantId ?? 'general';
                      final targetMerchantName = selectedMerchant?.merchantName ?? 'Comercio Pídetelo';

                      final success = await _riderService.requestPayout(
                        amount: enteredAmount,
                        method: selectedAcc.type,
                        destinationDetails: destDetails,
                        tenantId: targetTenantId,
                        merchantName: targetMerchantName,
                        account: selectedAcc,
                        rider: rider,
                      );

                      if (!ctx.mounted) return;
                      Navigator.of(ctx).pop();

                      if (success && mounted) {
                        ScaffoldMessenger.of(context).showSnackBar(
                          SnackBar(
                            content: Text('Retiro de ${_dolarApi.formatUsdWithBs(enteredAmount)} solicitado a $targetMerchantName exitosamente.'),
                            backgroundColor: AppTheme.primary,
                          ),
                        );
                      }
                    },
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 16),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                    ),
                    child: Text(
                      'Confirmar y Notificar al Comercio',
                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
          );
        },
      ),
    );
  }

  ImageProvider? _getAvatarProvider(String? url) {
    if (url == null || url.trim().isEmpty) return null;
    final trimmed = url.trim();
    if (trimmed.startsWith('data:image')) {
      try {
        final commaIdx = trimmed.indexOf(',');
        final base64Data = commaIdx != -1 ? trimmed.substring(commaIdx + 1) : trimmed;
        return MemoryImage(base64Decode(base64Data));
      } catch (_) {
        return null;
      }
    }
    return NetworkImage(trimmed);
  }

  Future<void> _pickAvatarFromDevice(BuildContext ctx, ImageSource source, RiderUser rider) async {
    try {
      final picker = ImagePicker();
      final picked = await picker.pickImage(
        source: source,
        maxWidth: 720,
        maxHeight: 720,
        imageQuality: 85,
      );
      if (picked == null) return;

      final bytes = await picked.readAsBytes();
      final base64Img = 'data:image/jpeg;base64,${base64Encode(bytes)}';

      String finalUrl = base64Img;
      try {
        final supabase = Supabase.instance.client;
        final filename = 'rider_${rider.id}_${DateTime.now().millisecondsSinceEpoch}.jpg';
        await supabase.storage.from('avatars').uploadBinary(
          filename,
          bytes,
          fileOptions: const FileOptions(contentType: 'image/jpeg', upsert: true),
        );
        final publicUrl = supabase.storage.from('avatars').getPublicUrl(filename);
        if (publicUrl.isNotEmpty) {
          finalUrl = publicUrl;
        }
      } catch (storageErr) {
        debugPrint('[RiderApp] Storage fallback a data URI: $storageErr');
      }

      await widget.sessionService.updateAvatar(finalUrl);
      if (ctx.mounted) {
        Navigator.pop(ctx);
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('¡Foto de perfil actualizada con éxito! 🎉'),
            backgroundColor: AppTheme.primary,
            behavior: SnackBarBehavior.floating,
          ),
        );
      }
    } catch (e) {
      debugPrint('[RiderApp] Error seleccionando imagen de perfil: $e');
    }
  }

  // --- MODAL: SUBIR / ACTUALIZAR FOTO DE PERFIL ---
  void _showAvatarPickerModal(BuildContext context, RiderUser rider) {
    final defaultAvatars = [
      'https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=300',
      'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300',
      'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=300',
      'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=300',
    ];
    final urlCtrl = TextEditingController(text: rider.avatarUrl ?? '');
    final isDark = widget.sessionService.isDarkMode;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => Padding(
        padding: EdgeInsets.only(
          left: 24,
          right: 24,
          top: 24,
          bottom: MediaQuery.of(ctx).viewInsets.bottom + 24,
        ),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Center(
              child: Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white24 : Colors.grey.shade300,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Actualizar Foto de Perfil',
              style: GoogleFonts.outfit(
                fontSize: 20,
                fontWeight: FontWeight.w800,
                color: isDark ? Colors.white : const Color(0xFF0F172A),
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Toma una foto, selecciona de tu galería o elige un avatar sugerido.',
              style: GoogleFonts.outfit(
                fontSize: 12,
                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
              ),
            ),
            const SizedBox(height: 18),

            // Botones de carga directa desde el dispositivo
            Row(
              children: [
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _pickAvatarFromDevice(ctx, ImageSource.camera, rider),
                    icon: const Icon(Icons.camera_alt_rounded, size: 18),
                    label: const Text('Cámara'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: AppTheme.primary,
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      elevation: 0,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: ElevatedButton.icon(
                    onPressed: () => _pickAvatarFromDevice(ctx, ImageSource.gallery, rider),
                    icon: const Icon(Icons.photo_library_rounded, size: 18),
                    label: const Text('Galería'),
                    style: ElevatedButton.styleFrom(
                      backgroundColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9),
                      foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
                      padding: const EdgeInsets.symmetric(vertical: 13),
                      shape: RoundedRectangleBorder(
                        borderRadius: BorderRadius.circular(14),
                        side: BorderSide(color: isDark ? Colors.white12 : const Color(0xFFE2E8F0)),
                      ),
                      elevation: 0,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 18),

            // Suggested Avatar Row
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceAround,
              children: defaultAvatars.map((url) {
                return GestureDetector(
                  onTap: () async {
                    await widget.sessionService.updateAvatar(url);
                    if (ctx.mounted) Navigator.pop(ctx);
                  },
                  child: CircleAvatar(
                    radius: 26,
                    backgroundImage: NetworkImage(url),
                  ),
                );
              }).toList(),
            ),
            const SizedBox(height: 16),

            // Or enter URL
            TextField(
              controller: urlCtrl,
              style: GoogleFonts.outfit(color: isDark ? Colors.white : const Color(0xFF0F172A)),
              decoration: InputDecoration(
                hintText: 'https://ejemplo.com/mifoto.jpg',
                labelText: 'O ingresa enlace URL',
                labelStyle: GoogleFonts.outfit(color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                filled: true,
                fillColor: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: BorderSide.none),
              ),
            ),
            const SizedBox(height: 14),

            ElevatedButton(
              onPressed: () async {
                final url = urlCtrl.text.trim();
                if (url.isNotEmpty) {
                  await widget.sessionService.updateAvatar(url);
                }
                if (ctx.mounted) Navigator.pop(ctx);
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
                padding: const EdgeInsets.symmetric(vertical: 13),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                elevation: 0,
              ),
              child: Text(
                'Guardar Enlace URL',
                style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildMethodChip(String title, bool isSelected, VoidCallback onTap) {
    return Expanded(
      child: GestureDetector(
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: isSelected ? AppTheme.primary.withOpacity(0.15) : const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(12),
            border: Border.all(
              color: isSelected ? AppTheme.primary : const Color(0xFF334155),
              width: isSelected ? 1.5 : 1,
            ),
          ),
          child: Center(
            child: Text(
              title,
              style: GoogleFonts.outfit(
                fontSize: 11,
                fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                color: isSelected ? Colors.white : const Color(0xFF94A3B8),
              ),
            ),
          ),
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final rider = widget.sessionService.currentRider;

    return ListenableBuilder(
      listenable: Listenable.merge([_riderService, _dolarApi, widget.sessionService]),
      builder: (context, _) {
        final activeOrder = _riderService.activeOrder;
        final availableOrders = _riderService.availableOrders;

        final isDark = widget.sessionService.isDarkMode;
        final bgColor = isDark ? AppTheme.darkBackground : AppTheme.lightBackground;
        final textColor = isDark ? Colors.white : const Color(0xFF0F172A);

        return Scaffold(
          backgroundColor: bgColor,
          appBar: AppBar(
            backgroundColor: bgColor,
            elevation: 0,
            leadingWidth: 54,
            leading: Padding(
              padding: const EdgeInsets.only(left: 12, top: 8, bottom: 8, right: 2),
              child: Container(
                decoration: BoxDecoration(
                  color: isDark ? const Color(0xFF1E293B) : Colors.white,
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(
                    color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                    width: 1.2,
                  ),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(0.06),
                      blurRadius: 4,
                      offset: const Offset(0, 2),
                    ),
                  ],
                ),
                padding: const EdgeInsets.all(3.5),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(8),
                  child: Image.asset(
                    isDark
                        ? 'assets/images/logo-isotipo-dark.png'
                        : 'assets/images/logo-isotipo-rider.png',
                    fit: BoxFit.contain,
                    filterQuality: FilterQuality.high,
                    errorBuilder: (_, __, ___) => Image.asset(
                      'assets/images/logo-isotipo.png',
                      fit: BoxFit.contain,
                      errorBuilder: (_, __, ___) => Image.asset(
                        'assets/images/logo.png',
                        fit: BoxFit.contain,
                      ),
                    ),
                  ),
                ),
              ),
            ),
            title: Row(
              children: [
                GestureDetector(
                  onTap: () {
                    if (rider != null) _showAvatarPickerModal(context, rider);
                  },
                  child: CircleAvatar(
                    radius: 16,
                    backgroundColor: AppTheme.primary.withOpacity(0.2),
                    backgroundImage: _getAvatarProvider(rider?.avatarUrl),
                    child: (rider?.avatarUrl == null || rider!.avatarUrl!.isEmpty)
                        ? const Icon(Icons.person_rounded, color: AppTheme.primary, size: 18)
                        : null,
                  ),
                ),
                const SizedBox(width: 8),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        rider?.name ?? 'Repartidor',
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700, color: textColor),
                        overflow: TextOverflow.ellipsis,
                      ),
                      Text(
                        'Tasa BCV: Bs. ${_dolarApi.officialRate.toStringAsFixed(2)} / \$',
                        style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFF10B981), fontWeight: FontWeight.w700),
                      ),
                    ],
                  ),
                ),
              ],
            ),
            actions: [
              IconButton(
                onPressed: () => widget.sessionService.toggleTheme(),
                tooltip: isDark ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro',
                icon: Icon(
                  isDark ? Icons.light_mode_rounded : Icons.dark_mode_rounded,
                  color: isDark ? Colors.amber : const Color(0xFF475569),
                  size: 20,
                ),
              ),
              GestureDetector(
                onTap: () => widget.sessionService.toggleOnlineStatus(),
                child: Container(
                  margin: const EdgeInsets.only(right: 12),
                  padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 5),
                  decoration: BoxDecoration(
                    color: (rider?.isOnline ?? true)
                        ? AppTheme.primary.withOpacity(0.15)
                        : Colors.redAccent.withOpacity(0.15),
                    borderRadius: BorderRadius.circular(20),
                    border: Border.all(
                      color: (rider?.isOnline ?? true)
                          ? AppTheme.primary.withOpacity(0.4)
                          : Colors.redAccent.withOpacity(0.4),
                    ),
                  ),
                  child: Row(
                    children: [
                      Container(
                        width: 8,
                        height: 8,
                        decoration: BoxDecoration(
                          color: (rider?.isOnline ?? true) ? AppTheme.primary : Colors.redAccent,
                          shape: BoxShape.circle,
                        ),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        (rider?.isOnline ?? true) ? 'EN LÍNEA' : 'OFFLINE',
                        style: GoogleFonts.outfit(
                          fontSize: 10,
                          fontWeight: FontWeight.w800,
                          color: (rider?.isOnline ?? true) ? AppTheme.primary : Colors.redAccent,
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ],
          ),
          body: IndexedStack(
            index: _selectedTab,
            children: [
              _buildRadarTab(activeOrder, availableOrders),
              _buildWalletTab(),
              _buildProfileTab(rider),
            ],
          ),
          bottomNavigationBar: Container(
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: Color(0xFF1E293B), width: 1)),
            ),
            child: NavigationBar(
              selectedIndex: _selectedTab,
              onDestinationSelected: (idx) => setState(() => _selectedTab = idx),
              backgroundColor: const Color(0xFF0F172A),
              indicatorColor: AppTheme.primary.withOpacity(0.15),
              destinations: const [
                NavigationDestination(
                  icon: Icon(Icons.radar_rounded, color: Color(0xFF94A3B8)),
                  selectedIcon: Icon(Icons.radar_rounded, color: AppTheme.primary),
                  label: 'Radar',
                ),
                NavigationDestination(
                  icon: Icon(Icons.account_balance_wallet_outlined, color: Color(0xFF94A3B8)),
                  selectedIcon: Icon(Icons.account_balance_wallet_rounded, color: AppTheme.primary),
                  label: 'Billetera',
                ),
                NavigationDestination(
                  icon: Icon(Icons.person_outline_rounded, color: Color(0xFF94A3B8)),
                  selectedIcon: Icon(Icons.person_rounded, color: AppTheme.primary),
                  label: 'Perfil',
                ),
              ],
            ),
          ),
        );
      },
    );
  }

  Widget _buildGpsStatusBanner() {
    final riderId = widget.sessionService.currentRider?.id;
    if (_locationService.permissionDenied) {
      return GestureDetector(
        onTap: () {
          if (riderId != null) _locationService.startTracking(riderId);
        },
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
          decoration: BoxDecoration(
            color: Colors.amber.shade900.withOpacity(0.2),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: Colors.amber.shade600.withOpacity(0.5)),
          ),
          child: Row(
            children: [
              const Icon(Icons.location_off_rounded, color: Colors.amber, size: 18),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  'GPS Desactivado: Toca aquí para activar los permisos de ubicación satelital.',
                  style: GoogleFonts.outfit(fontSize: 11, color: Colors.amber.shade300, fontWeight: FontWeight.w600),
                ),
              ),
            ],
          ),
        ),
      );
    }

    if (_locationService.isGpsActive && _locationService.currentPosition != null) {
      final pos = _locationService.currentPosition!;
      return Container(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
        decoration: BoxDecoration(
          color: const Color(0xFF10B981).withOpacity(0.12),
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: const Color(0xFF10B981).withOpacity(0.35)),
        ),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Row(
              children: [
                Container(
                  width: 8,
                  height: 8,
                  decoration: const BoxDecoration(
                    color: Color(0xFF10B981),
                    shape: BoxShape.circle,
                  ),
                ),
                const SizedBox(width: 8),
                Text(
                  'GPS Satelital Transmitiendo',
                  style: GoogleFonts.outfit(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFF34D399),
                  ),
                ),
              ],
            ),
            Text(
              '${pos.latitude.toStringAsFixed(4)}, ${pos.longitude.toStringAsFixed(4)}',
              style: GoogleFonts.spaceMono(
                fontSize: 10,
                color: const Color(0xFF6EE7B7),
                fontWeight: FontWeight.w600,
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: Colors.white12),
      ),
      child: Row(
        children: [
          const SizedBox(
            width: 10,
            height: 10,
            child: CircularProgressIndicator(strokeWidth: 2, color: AppTheme.primary),
          ),
          const SizedBox(width: 10),
          Text(
            'Conectando antena GPS satelital...',
            style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  Widget _buildRadarTab(DeliveryOrder? activeOrder, List<DeliveryOrder> availableOrders) {
    return RefreshIndicator(
      onRefresh: () => _riderService.fetchAvailableOrders(),
      color: AppTheme.primary,
      backgroundColor: const Color(0xFF1E293B),
      child: ListView(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        children: [
          _buildGpsStatusBanner(),
          const SizedBox(height: 12),
          // Active Delivery Banner
          if (activeOrder != null) ...[
            if (!_riderService.isAcceptedByRider) ...[
              // Card: Nueva Asignación - Rider debe ACEPTAR o RECHAZAR
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF1E293B),
                      Colors.amber.shade900.withOpacity(0.25),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: Colors.amber.shade600, width: 2.0),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.amber.shade900.withOpacity(0.3),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: Colors.amber.shade600,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Row(
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              const Icon(Icons.notifications_active_rounded, size: 13, color: Colors.black),
                              const SizedBox(width: 4),
                              Text(
                                'NUEVO PEDIDO ASIGNADO',
                                style: GoogleFonts.outfit(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w900,
                                  color: Colors.black,
                                ),
                              ),
                            ],
                          ),
                        ),
                        Text(
                          activeOrder.orderNumber,
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Comercio: ${activeOrder.merchantName}',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w700,
                        color: Colors.amber.shade300,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Cliente: ${activeOrder.customerName}',
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 15, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            activeOrder.customerAddress,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                      decoration: BoxDecoration(
                        color: Colors.black26,
                        borderRadius: BorderRadius.circular(12),
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Text('Tu Ganancia:', style: GoogleFonts.outfit(fontSize: 12, color: Colors.white70)),
                          Text(
                            _dolarApi.formatUsdWithBs(activeOrder.deliveryFee),
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w900,
                              color: const Color(0xFF10B981),
                            ),
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: 14),
                    Row(
                      children: [
                        // Botón Rechazar
                        Expanded(
                          child: OutlinedButton.icon(
                            onPressed: () async {
                              final confirm = await showDialog<bool>(
                                context: context,
                                builder: (ctx) => AlertDialog(
                                  backgroundColor: const Color(0xFF0F172A),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
                                  title: Text('¿Rechazar Pedido?', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
                                  content: Text(
                                    'El pedido quedará liberado para que el comercio lo asigne a otro repartidor disponible.',
                                    style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 13),
                                  ),
                                  actions: [
                                    TextButton(
                                      onPressed: () => Navigator.pop(ctx, false),
                                      child: const Text('Cancelar'),
                                    ),
                                    ElevatedButton(
                                      onPressed: () => Navigator.pop(ctx, true),
                                      style: ElevatedButton.styleFrom(
                                        backgroundColor: Colors.redAccent,
                                        foregroundColor: Colors.white,
                                      ),
                                      child: const Text('Sí, Rechazar'),
                                    ),
                                  ],
                                ),
                              );

                              if (confirm == true) {
                                await _riderService.rejectAssignedOrder();
                                if (context.mounted) {
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    const SnackBar(
                                      content: Text('Pedido rechazado. El comercio fue notificado.'),
                                      backgroundColor: Colors.redAccent,
                                    ),
                                  );
                                }
                              }
                            },
                            icon: const Icon(Icons.close_rounded, color: Colors.redAccent, size: 18),
                            label: Text('Rechazar', style: GoogleFonts.outfit(color: Colors.redAccent, fontWeight: FontWeight.w700)),
                            style: OutlinedButton.styleFrom(
                              side: const BorderSide(color: Colors.redAccent, width: 1.5),
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Botón Aceptar
                        Expanded(
                          child: ElevatedButton.icon(
                            onPressed: () async {
                              await _riderService.acceptAssignedOrder();
                              if (context.mounted) {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('¡Pedido aceptado! Ve al comercio a recogerlo.'),
                                    backgroundColor: Color(0xFF10B981),
                                  ),
                                );
                              }
                            },
                            icon: const Icon(Icons.check_rounded, size: 18),
                            label: Text('Aceptar Pedido', style: GoogleFonts.outfit(fontWeight: FontWeight.w800)),
                            style: ElevatedButton.styleFrom(
                              backgroundColor: const Color(0xFF10B981),
                              foregroundColor: Colors.white,
                              padding: const EdgeInsets.symmetric(vertical: 12),
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
            ] else ...[
              // Card: Pedido Aceptado - En Proceso / En Camino
              Container(
                padding: const EdgeInsets.all(18),
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: [
                      const Color(0xFF1E293B),
                      AppTheme.primary.withOpacity(0.15),
                    ],
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: AppTheme.primary.withOpacity(0.4), width: 1.5),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                          decoration: BoxDecoration(
                            color: AppTheme.primary,
                            borderRadius: BorderRadius.circular(12),
                          ),
                          child: Text(
                            activeOrder.status == OrderDeliveryStatus.onTheWay
                                ? 'EN RUTA AL CLIENTE'
                                : (activeOrder.status == OrderDeliveryStatus.atMerchant
                                    ? 'EN EL COMERCIO (ESPERANDO PEDIDO)'
                                    : 'PEDIDO ACEPTADO (IR A RECOGER)'),
                            style: GoogleFonts.outfit(
                              fontSize: 10,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                        ),
                        Text(
                          activeOrder.orderNumber,
                          style: GoogleFonts.outfit(
                            fontSize: 14,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Comercio: ${activeOrder.merchantName}',
                      style: GoogleFonts.outfit(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        color: Colors.white70,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      activeOrder.customerName,
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    const SizedBox(height: 4),
                    Row(
                      children: [
                        const Icon(Icons.location_on_outlined, size: 15, color: Color(0xFF94A3B8)),
                        const SizedBox(width: 4),
                        Expanded(
                          child: Text(
                            activeOrder.customerAddress,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      'Ganancia: ${_dolarApi.formatUsdWithBs(activeOrder.deliveryFee)}',
                      style: GoogleFonts.outfit(
                        fontSize: 14,
                        fontWeight: FontWeight.w800,
                        color: AppTheme.primary,
                      ),
                    ),
                    const SizedBox(height: 14),
                    ElevatedButton.icon(
                      onPressed: () {
                        Navigator.of(context).push(
                          MaterialPageRoute(
                            builder: (_) => RiderNavigationScreen(order: activeOrder),
                          ),
                        );
                      },
                      icon: const Icon(Icons.navigation_rounded),
                      label: const Text('Ver Ruta GPS y Continuar'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 18),
            ],
          ],

          // Radar Title
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Radar de Pedidos Disponibles',
                style: GoogleFonts.outfit(
                  fontSize: 17,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFF334155)),
                ),
                child: Text(
                  '${availableOrders.length} en radar',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),

          if (availableOrders.isEmpty)
            Container(
              padding: const EdgeInsets.symmetric(vertical: 48, horizontal: 24),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Column(
                children: [
                  Icon(Icons.radar_rounded, size: 48, color: AppTheme.primary.withOpacity(0.5)),
                  const SizedBox(height: 14),
                  Text(
                    'Buscando pedidos cercanos...',
                    style: GoogleFonts.outfit(
                      fontSize: 16,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Mantén la app abierta. En cuanto un comercio te asigne un pedido aparecerá aquí en tiempo real.',
                    textAlign: TextAlign.center,
                    style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                  ),
                ],
              ),
            )
          else
            ...availableOrders.map((ord) => _buildOrderCard(ord)),
        ],
      ),
    );
  }

  Widget _buildOrderCard(DeliveryOrder ord) {
    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                ord.merchantName,
                style: GoogleFonts.outfit(
                  fontSize: 16,
                  fontWeight: FontWeight.w800,
                  color: Colors.white,
                ),
              ),
              Text(
                '+${_dolarApi.formatUsdWithBs(ord.deliveryFee)}',
                style: GoogleFonts.outfit(
                  fontSize: 13.5,
                  fontWeight: FontWeight.w800,
                  color: AppTheme.primary,
                ),
              ),
            ],
          ),
          const SizedBox(height: 6),
          Row(
            children: [
              const Icon(Icons.storefront_rounded, size: 14, color: AppTheme.orangeAccent),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  ord.merchantAddress,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              const Icon(Icons.location_on_rounded, size: 14, color: Colors.blueAccent),
              const SizedBox(width: 4),
              Expanded(
                child: Text(
                  ord.customerAddress,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          ElevatedButton(
            onPressed: () async {
              final rider = widget.sessionService.currentRider;
              if (rider == null) return;
              final ok = await _riderService.acceptOrder(ord, rider);
              if (ok && mounted) {
                Navigator.of(context).push(
                  MaterialPageRoute(
                    builder: (_) => RiderNavigationScreen(order: _riderService.activeOrder ?? ord),
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 12),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
            ),
            child: Text(
              'Aceptar Entrega',
              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w700),
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildWalletTab() {
    final balance = _riderService.availableBalance;
    final totalEarned = _riderService.totalEarnings;
    final completedCount = _riderService.completedDeliveriesCount;
    final payouts = _riderService.payoutHistory;
    final merchantBalances = _riderService.merchantBalances;
    final rider = widget.sessionService.currentRider;

    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
      children: [
        // Balance Card with live BCV
        Container(
          padding: const EdgeInsets.all(22),
          decoration: BoxDecoration(
            gradient: const LinearGradient(
              colors: [Color(0xFF064E3B), Color(0xFF047857)],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(24),
            boxShadow: [
              BoxShadow(
                color: AppTheme.primary.withOpacity(0.3),
                blurRadius: 16,
                offset: const Offset(0, 6),
              ),
            ],
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Text(
                'Saldo Disponible',
                style: GoogleFonts.outfit(fontSize: 14, color: Colors.white70, fontWeight: FontWeight.w600),
              ),
              const SizedBox(height: 6),
              Text(
                '\$${balance.toStringAsFixed(2)}',
                style: GoogleFonts.outfit(
                  fontSize: 34,
                  fontWeight: FontWeight.w900,
                  color: Colors.white,
                ),
              ),
              Text(
                '≈ Bs. ${_dolarApi.toBs(balance).toStringAsFixed(2)} (Tasa BCV Oficial)',
                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFFA7F3D0), fontWeight: FontWeight.w700),
              ),
              const SizedBox(height: 18),
              Row(
                children: [
                  Expanded(
                    child: ElevatedButton.icon(
                      onPressed: () => _showWithdrawalModal(context),
                      icon: const Icon(Icons.arrow_upward_rounded, size: 16),
                      label: Text('Retirar Ganancias', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: Colors.white,
                        foregroundColor: const Color(0xFF064E3B),
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ),
                ],
              ),
            ],
          ),
        ),
        const SizedBox(height: 20),

        // Saldos Disponibles por Comercio
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Saldos por Comercio',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
            ),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Text(
                '${merchantBalances.length} locales',
                style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8), fontWeight: FontWeight.w600),
              ),
            ),
          ],
        ),
        const SizedBox(height: 8),

        if (merchantBalances.isEmpty)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Row(
              children: [
                const Icon(Icons.storefront_rounded, color: Color(0xFF94A3B8)),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'Aquí verás el balance acumulado y disponible para retirar de cada restaurante o tienda donde realices entregas.',
                    style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                  ),
                ),
              ],
            ),
          )
        else
          ...merchantBalances.map((m) {
            final hasBalance = m.availableBalance > 0;
            return Container(
              margin: const EdgeInsets.only(bottom: 10),
              padding: const EdgeInsets.all(14),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(18),
                border: Border.all(
                  color: hasBalance ? AppTheme.primary.withOpacity(0.35) : const Color(0xFF334155),
                ),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.center,
                    children: [
                      Container(
                        padding: const EdgeInsets.all(8),
                        decoration: BoxDecoration(
                          color: hasBalance ? AppTheme.primary.withOpacity(0.15) : const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(12),
                        ),
                        child: Icon(
                          Icons.store_rounded,
                          color: hasBalance ? AppTheme.primary : const Color(0xFF94A3B8),
                          size: 20,
                        ),
                      ),
                      const SizedBox(width: 12),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              m.merchantName,
                              style: GoogleFonts.outfit(
                                fontSize: 14,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                            const SizedBox(height: 2),
                            Text(
                              '${m.ordersCount} entregas realizadas',
                              style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
                            ),
                          ],
                        ),
                      ),
                      if (hasBalance)
                        ElevatedButton(
                          onPressed: () => _showWithdrawalModal(context, m),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            foregroundColor: Colors.white,
                            padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                            minimumSize: Size.zero,
                            tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                          child: Text(
                            'Retirar',
                            style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700),
                          ),
                        ),
                    ],
                  ),
                  const SizedBox(height: 12),
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(12),
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Disponible a cobrar',
                              style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                            ),
                            Text(
                              _dolarApi.formatUsdWithBs(m.availableBalance),
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                fontWeight: FontWeight.w800,
                                color: hasBalance ? AppTheme.primary : Colors.white70,
                              ),
                            ),
                          ],
                        ),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              'Total generado',
                              style: GoogleFonts.outfit(fontSize: 10, color: const Color(0xFF94A3B8), fontWeight: FontWeight.w600),
                            ),
                            Text(
                              '\$${m.totalEarned.toStringAsFixed(2)}',
                              style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white70),
                            ),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            );
          }),
        const SizedBox(height: 18),

        // Accounts section (Item 5)
        Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Text(
              'Métodos de Retiro Verificados',
              style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800, color: Colors.white),
            ),
            TextButton.icon(
              onPressed: () {
                if (rider != null) _showAddAccountModal(context, rider);
              },
              icon: const Icon(Icons.add, size: 16, color: AppTheme.primary),
              label: Text('Agregar', style: GoogleFonts.outfit(color: AppTheme.primary, fontWeight: FontWeight.w700)),
            ),
          ],
        ),
        const SizedBox(height: 6),

        if (rider?.paymentAccounts.isEmpty ?? true)
          Container(
            padding: const EdgeInsets.all(16),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
              border: Border.all(color: const Color(0xFF334155)),
            ),
            child: Row(
              children: [
                const Icon(Icons.warning_amber_rounded, color: Colors.amberAccent),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    'No tienes cuentas registradas. Agrega tu Pago Móvil o cuenta bancaria personal para poder retirar.',
                    style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                  ),
                ),
              ],
            ),
          )
        else
          ...rider!.paymentAccounts.map((acc) {
            return Container(
              margin: const EdgeInsets.only(bottom: 8),
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(16),
                border: Border.all(color: const Color(0xFF334155)),
              ),
              child: Row(
                children: [
                  Container(
                    padding: const EdgeInsets.all(8),
                    decoration: BoxDecoration(
                      color: AppTheme.primary.withOpacity(0.12),
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.verified_user_rounded, color: AppTheme.primary, size: 18),
                  ),
                  const SizedBox(width: 10),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${acc.bank} (${acc.type.toUpperCase()})',
                          style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white),
                        ),
                        Text(
                          '${acc.accountNumber} • ${acc.holderName} (${acc.nationalId})',
                          style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
                        ),
                      ],
                    ),
                  ),
                  IconButton(
                    icon: const Icon(Icons.delete_outline_rounded, color: Colors.redAccent, size: 18),
                    onPressed: () => widget.sessionService.deletePaymentAccount(acc.id),
                  ),
                ],
              ),
            );
          }),
        const SizedBox(height: 18),

        // Metrics Grid
        Row(
          children: [
            Expanded(
              child: _buildMetricCard(
                'Entregas Hechas',
                '$completedCount',
                Icons.check_circle_outline_rounded,
                AppTheme.primary,
              ),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: _buildMetricCard(
                'Total Generado',
                _dolarApi.formatUsdWithBs(totalEarned),
                Icons.trending_up_rounded,
                Colors.cyanAccent,
              ),
            ),
          ],
        ),
        const SizedBox(height: 24),

        // Payouts History
        Text(
          'Historial de Retiros',
          style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
        ),
        const SizedBox(height: 12),

        if (payouts.isEmpty)
          Container(
            padding: const EdgeInsets.all(24),
            decoration: BoxDecoration(
              color: const Color(0xFF1E293B),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Center(
              child: Text(
                'Aún no has solicitado retiros.',
                style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 13),
              ),
            ),
          )
        else
          ...payouts.map(
            (p) {
              final isPending = p.status == 'pending';
              final isRejected = p.status == 'rejected';
              final isCompleted = p.status == 'completed' || p.status == 'approved';

              final Color badgeBg = isPending
                  ? Colors.amber.withOpacity(0.15)
                  : (isCompleted ? const Color(0xFF10B981).withOpacity(0.15) : Colors.redAccent.withOpacity(0.15));
              final Color badgeFg = isPending
                  ? Colors.amberAccent
                  : (isCompleted ? const Color(0xFF10B981) : Colors.redAccent);
              final String badgeText = isPending
                  ? 'Pendiente'
                  : (isCompleted ? 'Liquidado' : 'Rechazado');

              return Container(
                margin: const EdgeInsets.only(bottom: 10),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isPending ? Colors.amber.withOpacity(0.3) : const Color(0xFF334155),
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.stretch,
                  children: [
                    Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(
                                p.merchantName ?? 'Comercio',
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                              const SizedBox(height: 3),
                              Text(
                                '${p.method.toUpperCase()} • ${p.destinationDetails}',
                                style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                              ),
                            ],
                          ),
                        ),
                        const SizedBox(width: 8),
                        Column(
                          crossAxisAlignment: CrossAxisAlignment.end,
                          children: [
                            Text(
                              '-${_dolarApi.formatUsdWithBs(p.amount)}',
                              style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w800, color: Colors.white),
                            ),
                            const SizedBox(height: 4),
                            Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                              decoration: BoxDecoration(
                                color: badgeBg,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Text(
                                badgeText,
                                style: GoogleFonts.outfit(
                                  fontSize: 10,
                                  fontWeight: FontWeight.w700,
                                  color: badgeFg,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ],
                    ),
                    if (isCompleted && (p.referenceCode?.isNotEmpty ?? false)) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: const Color(0xFF0F172A),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.receipt_long_rounded, size: 14, color: Color(0xFF10B981)),
                            const SizedBox(width: 6),
                            Text(
                              'Ref. Bancaria: ${p.referenceCode}',
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                color: const Color(0xFF10B981),
                                fontWeight: FontWeight.w700,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                    if (isRejected && (p.rejectionReason?.isNotEmpty ?? false)) ...[
                      const SizedBox(height: 8),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                        decoration: BoxDecoration(
                          color: Colors.redAccent.withOpacity(0.1),
                          borderRadius: BorderRadius.circular(10),
                        ),
                        child: Row(
                          children: [
                            const Icon(Icons.info_outline_rounded, size: 14, color: Colors.redAccent),
                            const SizedBox(width: 6),
                            Expanded(
                              child: Text(
                                'Motivo: ${p.rejectionReason}',
                                style: GoogleFonts.outfit(
                                  fontSize: 11,
                                  color: Colors.redAccent,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ],
                ),
              );
            },
          ),
      ],
    );
  }

  Widget _buildMetricCard(String title, String value, IconData icon, Color color) {
    return Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFF334155)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, color: color, size: 22),
          const SizedBox(height: 10),
          Text(
            value,
            style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
          ),
          Text(
            title,
            style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
          ),
        ],
      ),
    );
  }

  Widget _buildProfileTab(RiderUser? rider) {
    return ListView(
      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 16),
      children: [
        Center(
          child: Column(
            children: [
              Stack(
                children: [
                  CircleAvatar(
                    radius: 46,
                    backgroundColor: AppTheme.primary.withOpacity(0.15),
                    backgroundImage: _getAvatarProvider(rider?.avatarUrl),
                    child: (rider?.avatarUrl == null || rider!.avatarUrl!.isEmpty)
                        ? const Icon(Icons.person_rounded, size: 54, color: AppTheme.primary)
                        : null,
                  ),
                  Positioned(
                    bottom: 0,
                    right: 0,
                    child: GestureDetector(
                      onTap: () {
                        if (rider != null) _showAvatarPickerModal(context, rider);
                      },
                      child: Container(
                        padding: const EdgeInsets.all(6),
                        decoration: const BoxDecoration(
                          color: AppTheme.primary,
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(Icons.camera_alt_rounded, size: 16, color: Colors.white),
                      ),
                    ),
                  ),
                ],
              ),
              const SizedBox(height: 12),
              Text(
                rider?.name ?? 'Repartidor',
                style: GoogleFonts.outfit(fontSize: 20, fontWeight: FontWeight.w800, color: Colors.white),
              ),
              Text(
                rider?.email ?? 'repartidor@deliveryhub.com',
                style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
              ),
            ],
          ),
        ),
        const SizedBox(height: 24),

        // Vehicle info card
        Container(
          padding: const EdgeInsets.all(16),
          decoration: BoxDecoration(
            color: const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(20),
            border: Border.all(color: const Color(0xFF334155)),
          ),
          child: Column(
            children: [
              _buildProfileRow('Vehículo', rider?.vehicleType ?? 'Moto'),
              const Divider(color: Color(0xFF334155), height: 16),
              _buildProfileRow('Modelo', rider?.vehicleModel ?? 'Empire Keeway 150'),
              const Divider(color: Color(0xFF334155), height: 16),
              _buildProfileRow('Placa', rider?.vehiclePlate ?? 'AC-1234'),
              const Divider(color: Color(0xFF334155), height: 16),
              _buildProfileRow('Cédula de Identidad', rider?.nationalId ?? 'V-26.123.456'),
              const Divider(color: Color(0xFF334155), height: 16),
              _buildProfileRow('Teléfono Móvil', rider?.phone ?? '+58 412 1234567'),
            ],
          ),
        ),
        const SizedBox(height: 28),

        // Logout Button
        ElevatedButton.icon(
          onPressed: () async {
            await widget.sessionService.logout();
            if (!mounted) return;
            Navigator.of(context).pushAndRemoveUntil(
              MaterialPageRoute(
                builder: (_) => RiderLoginScreen(sessionService: widget.sessionService),
              ),
              (route) => false,
            );
          },
          icon: const Icon(Icons.logout_rounded, size: 18),
          label: Text('Cerrar Sesión', style: GoogleFonts.outfit(fontWeight: FontWeight.w700)),
          style: ElevatedButton.styleFrom(
            backgroundColor: const Color(0xFF1E293B),
            foregroundColor: Colors.redAccent,
            padding: const EdgeInsets.symmetric(vertical: 14),
            shape: RoundedRectangleBorder(
              borderRadius: BorderRadius.circular(16),
              side: const BorderSide(color: Colors.redAccent, width: 1.2),
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildProfileRow(String label, String value) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(label, style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8))),
        Text(value, style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700, color: Colors.white)),
      ],
    );
  }
}
