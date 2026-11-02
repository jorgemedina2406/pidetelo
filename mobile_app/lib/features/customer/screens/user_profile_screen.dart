import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../../../core/models/order_model.dart';
import '../../../core/models/user_model.dart';
import '../../../core/services/api_service.dart';
import '../../../core/services/cart_service.dart';
import '../../../core/services/session_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../auth/screens/customer_login_screen.dart';
import 'saved_addresses_screen.dart';
import 'store_detail_screen.dart';

class UserProfileScreen extends StatefulWidget {
  final SessionService sessionService;

  const UserProfileScreen({super.key, required this.sessionService});

  @override
  State<UserProfileScreen> createState() => _UserProfileScreenState();
}

class _UserProfileScreenState extends State<UserProfileScreen> {
  // Notification preferences state
  bool _notifyOrders = true;
  bool _notifyRiderNear = true;
  bool _notifyPromos = false;
  bool _notifyWhatsApp = true;

  // Real user wallet balance & transactions
  double _walletBalance = 0.0;
  List<Map<String, dynamic>> _walletTransactions = [];

  String get _userKey {
    final user = widget.sessionService.currentUser;
    final id = user?.id.trim() ?? '';
    if (id.isNotEmpty) return id.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');
    final email = user?.email.trim() ?? '';
    if (email.isNotEmpty) return email.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_');
    return 'guest';
  }

  @override
  void initState() {
    super.initState();
    _loadUserPreferencesAndWallet();
  }

  Future<void> _loadUserPreferencesAndWallet() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _userKey;

      setState(() {
        _notifyOrders = prefs.getBool('notif_orders_$key') ?? true;
        _notifyRiderNear = prefs.getBool('notif_rider_near_$key') ?? true;
        _notifyPromos = prefs.getBool('notif_promos_$key') ?? false;
        _notifyWhatsApp = prefs.getBool('notif_whatsapp_$key') ?? true;

        _walletBalance = prefs.getDouble('wallet_balance_$key') ?? 0.0;
        final txJson = prefs.getString('wallet_tx_$key');
        if (txJson != null) {
          final List list = jsonDecode(txJson);
          _walletTransactions = list.map((e) => Map<String, dynamic>.from(e)).toList();
        } else {
          _walletTransactions = [];
        }
      });
    } catch (e) {
      debugPrint('[UserProfile] Error loading user prefs and wallet: $e');
    }
  }

  Future<void> _saveNotificationPreferences() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _userKey;
      await prefs.setBool('notif_orders_$key', _notifyOrders);
      await prefs.setBool('notif_rider_near_$key', _notifyRiderNear);
      await prefs.setBool('notif_promos_$key', _notifyPromos);
      await prefs.setBool('notif_whatsapp_$key', _notifyWhatsApp);
    } catch (e) {
      debugPrint('[UserProfile] Error saving notification preferences: $e');
    }
  }

  Future<void> _addWalletTransaction({
    required String title,
    required double amount,
    required bool isPositive,
  }) async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _userKey;
      final newBalance = _walletBalance + (isPositive ? amount : -amount);
      final finalBalance = newBalance < 0.0 ? 0.0 : newBalance;

      final now = DateTime.now();
      final dateStr = '${now.day} ${_getMonthName(now.month)}, ${now.hour.toString().padLeft(2, '0')}:${now.minute.toString().padLeft(2, '0')}';

      final txItem = {
        'id': 'tx_${now.millisecondsSinceEpoch}',
        'title': title,
        'amount': '${isPositive ? "+" : "-"}\$${amount.toStringAsFixed(2)}',
        'date': dateStr,
        'isPositive': isPositive,
      };

      _walletTransactions.insert(0, txItem);
      _walletBalance = finalBalance;

      await prefs.setDouble('wallet_balance_$key', _walletBalance);
      await prefs.setString('wallet_tx_$key', jsonEncode(_walletTransactions));
      setState(() {});
    } catch (e) {
      debugPrint('[UserProfile] Error saving wallet transaction: $e');
    }
  }

  String _getMonthName(int month) {
    const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
    if (month >= 1 && month <= 12) return months[month - 1];
    return '';
  }

  void _editProfile(BuildContext context, AppUser user) {
    final nameCtrl = TextEditingController(text: user.name);
    final phoneCtrl = TextEditingController(text: user.phone);
    final emailCtrl = TextEditingController(text: user.email);
    final addrCtrl = TextEditingController(
      text: user.deliveryAddress ?? CartService().selectedAddress.address,
    );

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
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
                  color: Colors.white24,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
            ),
            const SizedBox(height: 18),
            Text(
              'Editar Datos de Perfil',
              style: GoogleFonts.outfit(
                fontSize: 18,
                fontWeight: FontWeight.w800,
                color: Colors.white,
              ),
            ),
            const SizedBox(height: 6),
            Text(
              'Actualiza tu información personal y de contacto',
              style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
            ),
            const SizedBox(height: 20),
            TextField(
              controller: nameCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              decoration: InputDecoration(
                labelText: 'Nombre y Apellido',
                labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primary, width: 1.5)),
                prefixIcon: const Icon(Icons.person_outline_rounded, color: Color(0xFF94A3B8), size: 20),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: phoneCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              keyboardType: TextInputType.phone,
              decoration: InputDecoration(
                labelText: 'Teléfono Móvil (WhatsApp)',
                labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primary, width: 1.5)),
                prefixIcon: const Icon(Icons.phone_outlined, color: Color(0xFF94A3B8), size: 20),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: emailCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              keyboardType: TextInputType.emailAddress,
              decoration: InputDecoration(
                labelText: 'Correo Electrónico',
                labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primary, width: 1.5)),
                prefixIcon: const Icon(Icons.email_outlined, color: Color(0xFF94A3B8), size: 20),
              ),
            ),
            const SizedBox(height: 12),
            TextField(
              controller: addrCtrl,
              style: const TextStyle(color: Colors.white, fontSize: 14),
              maxLines: 2,
              decoration: InputDecoration(
                labelText: 'Dirección Principal de Entrega',
                labelStyle: const TextStyle(color: Color(0xFF94A3B8)),
                filled: true,
                fillColor: const Color(0xFF1E293B),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
                enabledBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: Colors.white12)),
                focusedBorder: OutlineInputBorder(borderRadius: BorderRadius.circular(14), borderSide: const BorderSide(color: AppTheme.primary, width: 1.5)),
                prefixIcon: const Icon(Icons.location_on_outlined, color: Color(0xFF94A3B8), size: 20),
              ),
            ),
            const SizedBox(height: 22),
            ElevatedButton(
              onPressed: () async {
                final nav = Navigator.of(ctx);
                final messenger = ScaffoldMessenger.of(context);
                final updatedUser = user.copyWith(
                  name: nameCtrl.text.trim(),
                  phone: phoneCtrl.text.trim(),
                  email: emailCtrl.text.trim(),
                  deliveryAddress: addrCtrl.text.trim(),
                );
                await widget.sessionService.updateUserProfile(updatedUser);

                if (addrCtrl.text.trim().isNotEmpty) {
                  CartService().selectAddress(
                    DeliveryAddress(
                      id: 'user_primary_addr',
                      title: 'Principal',
                      address: addrCtrl.text.trim(),
                      latitude: 10.034574,
                      longitude: -69.237544,
                    ),
                  );
                }

                if (!mounted) return;
                setState(() {});
                nav.pop();
                messenger.showSnackBar(
                  SnackBar(
                    content: Text('Perfil actualizado correctamente', style: GoogleFonts.outfit()),
                    backgroundColor: AppTheme.primary,
                    behavior: SnackBarBehavior.floating,
                  ),
                );
              },
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                minimumSize: const Size(double.infinity, 50),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
              ),
              child: Text(
                'Guardar Cambios',
                style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _showFavoritesModal() async {
    final favIds = widget.sessionService.favoriteStoreIds;
    final allStores = await ApiService().fetchTenants();
    if (!mounted) return;

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setModalState) {
          final favStores = allStores.where((s) => favIds.contains(s['id']?.toString())).toList();

          return Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.75),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.favorite_rounded, color: Color(0xFFEF4444), size: 22),
                    const SizedBox(width: 8),
                    Text(
                      'Mis Comercios Favoritos',
                      style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Tus restaurantes preferidos en Cabudare y Barquisimeto',
                  style: GoogleFonts.outfit(fontSize: 12.5, color: const Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 16),
                if (favStores.isEmpty)
                  Expanded(
                    child: Center(
                      child: Column(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          const Icon(Icons.favorite_border_rounded, size: 50, color: Colors.white24),
                          const SizedBox(height: 12),
                          Text(
                            'No tienes comercios en favoritos aún',
                            style: GoogleFonts.outfit(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w600),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Toca el corazón en la tienda que te guste para guardarla aquí',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12),
                          ),
                        ],
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.separated(
                      itemCount: favStores.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (ctx, idx) {
                        final store = favStores[idx];
                        return Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: ListTile(
                            leading: ClipRRect(
                              borderRadius: BorderRadius.circular(10),
                              child: Image.network(
                                store['imageUrl'],
                                width: 50,
                                height: 50,
                                fit: BoxFit.cover,
                              ),
                            ),
                            title: Text(
                              store['name'],
                              style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14),
                            ),
                            subtitle: Text(
                              '${store['category']} • ⭐ ${store['rating']}',
                              style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12),
                            ),
                            trailing: IconButton(
                              icon: const Icon(Icons.favorite_rounded, color: Color(0xFFEF4444)),
                              onPressed: () async {
                                await widget.sessionService.toggleFavorite(store['id'].toString());
                                setModalState(() {});
                                setState(() {});
                              },
                            ),
                            onTap: () {
                              Navigator.pop(ctx);
                              Navigator.push(
                                context,
                                MaterialPageRoute(
                                  builder: (_) => StoreDetailScreen(
                                    storeData: store,
                                    sessionService: widget.sessionService,
                                  ),
                                ),
                              );
                            },
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showWalletModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setWalletState) {
          final bcvRate = 45.50; // Reference rate
          final inBs = _walletBalance * bcvRate;

          return Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.85),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: SingleChildScrollView(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  Center(
                    child: Container(
                      width: 44,
                      height: 4,
                      decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(10)),
                    ),
                  ),
                  const SizedBox(height: 16),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.account_balance_wallet_rounded, color: Color(0xFF10B981), size: 24),
                          const SizedBox(width: 8),
                          Text(
                            'Billetera DeliveryHub',
                            style: GoogleFonts.outfit(fontSize: 19, fontWeight: FontWeight.w800, color: Colors.white),
                          ),
                        ],
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: const Color(0xFF10B981).withOpacity(0.15),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Text(
                          'Activa',
                          style: GoogleFonts.outfit(color: const Color(0xFF10B981), fontSize: 11, fontWeight: FontWeight.w800),
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 18),

                  // Balance Card
                  Container(
                    padding: const EdgeInsets.all(20),
                    decoration: BoxDecoration(
                      gradient: const LinearGradient(
                        colors: [Color(0xFF059669), Color(0xFF10B981)],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFF10B981).withOpacity(0.3),
                          blurRadius: 16,
                          offset: const Offset(0, 6),
                        ),
                      ],
                    ),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Saldo Disponible',
                          style: GoogleFonts.outfit(color: Colors.white70, fontSize: 12.5, fontWeight: FontWeight.w600),
                        ),
                        const SizedBox(height: 6),
                        Row(
                          crossAxisAlignment: CrossAxisAlignment.baseline,
                          textBaseline: TextBaseline.alphabetic,
                          children: [
                            Text(
                              '\$${_walletBalance.toStringAsFixed(2)}',
                              style: GoogleFonts.outfit(color: Colors.white, fontSize: 32, fontWeight: FontWeight.w900),
                            ),
                            const SizedBox(width: 8),
                            Text(
                              'USD',
                              style: GoogleFonts.outfit(color: Colors.white70, fontSize: 14, fontWeight: FontWeight.w700),
                            ),
                          ],
                        ),
                        const SizedBox(height: 4),
                        Text(
                          'Equivalente: Bs. ${inBs.toStringAsFixed(2)} (Tasa BCV: 45.50)',
                          style: GoogleFonts.outfit(color: Colors.white.withOpacity(0.9), fontSize: 11.5),
                        ),
                      ],
                    ),
                  ),

                  const SizedBox(height: 16),

                  // Action Buttons
                  Row(
                    children: [
                      Expanded(
                        child: ElevatedButton.icon(
                          onPressed: () {
                            _showRechargeDialog(ctx, () => setWalletState(() {}));
                          },
                          icon: const Icon(Icons.add_circle_outline_rounded, size: 18),
                          label: const Text('Recargar Saldo'),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: AppTheme.primary,
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ),
                      const SizedBox(width: 10),
                      Expanded(
                        child: OutlinedButton.icon(
                          onPressed: () {
                            _showCouponDialog(ctx, () => setWalletState(() {}));
                          },
                          icon: const Icon(Icons.confirmation_number_outlined, size: 18, color: Colors.white),
                          label: const Text('Canjear Cupón', style: TextStyle(color: Colors.white)),
                          style: OutlinedButton.styleFrom(
                            side: const BorderSide(color: Colors.white24),
                            padding: const EdgeInsets.symmetric(vertical: 12),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                          ),
                        ),
                      ),
                    ],
                  ),

                  const SizedBox(height: 20),
                  Text(
                    'HISTORIAL DE MOVIMIENTOS',
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: const Color(0xFF94A3B8),
                      letterSpacing: 0.5,
                    ),
                  ),
                  const SizedBox(height: 10),

                  if (_walletTransactions.isEmpty)
                    Container(
                      padding: const EdgeInsets.symmetric(vertical: 28, horizontal: 16),
                      decoration: BoxDecoration(
                        color: const Color(0xFF1E293B),
                        borderRadius: BorderRadius.circular(16),
                        border: Border.all(color: Colors.white10),
                      ),
                      child: Column(
                        children: [
                          const Icon(Icons.receipt_long_outlined, size: 36, color: Color(0xFF64748B)),
                          const SizedBox(height: 10),
                          Text(
                            'No tienes movimientos en tu billetera',
                            style: GoogleFonts.outfit(color: Colors.white, fontSize: 13.5, fontWeight: FontWeight.w700),
                          ),
                          const SizedBox(height: 4),
                          Text(
                            'Tus recargas y compras aparecerán aquí en tiempo real.',
                            textAlign: TextAlign.center,
                            style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 11.5),
                          ),
                        ],
                      ),
                    )
                  else
                    ..._walletTransactions.map(
                      (tx) => _buildWalletTxItem(
                        tx['title'] ?? 'Movimiento',
                        tx['amount'] ?? '\$0.00',
                        tx['date'] ?? '',
                        tx['isPositive'] == true,
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

  void _showRechargeDialog(BuildContext ctx, VoidCallback onUpdated) {
    final amountCtrl = TextEditingController(text: '10.00');
    final refCtrl = TextEditingController();

    showDialog(
      context: ctx,
      builder: (dCtx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Recargar Billetera', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w800)),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text('Datos para Pago Móvil / Transferencia:', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 13)),
              const SizedBox(height: 8),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(color: const Color(0xFF0F172A), borderRadius: BorderRadius.circular(12)),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('• Banco: Banesco (0134)', style: GoogleFonts.outfit(color: Colors.white, fontSize: 12)),
                    Text('• Teléfono: 0412-5163118', style: GoogleFonts.outfit(color: Colors.white, fontSize: 12)),
                    Text('• Cédula/RIF: V-24.891.234', style: GoogleFonts.outfit(color: Colors.white, fontSize: 12)),
                    Text('• Tasa Oficial: BCV del día', style: GoogleFonts.outfit(color: AppTheme.amberAccent, fontSize: 12)),
                  ],
                ),
              ),
              const SizedBox(height: 14),
              Text('Monto a Recargar (\$ USD):', style: GoogleFonts.outfit(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              TextField(
                controller: amountCtrl,
                keyboardType: const TextInputType.numberWithOptions(decimal: true),
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  prefixText: '\$ ',
                  prefixStyle: const TextStyle(color: AppTheme.primary, fontWeight: FontWeight.bold),
                  filled: true,
                  fillColor: const Color(0xFF0F172A),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
              const SizedBox(height: 12),
              Text('N° de Referencia de Pago:', style: GoogleFonts.outfit(color: Colors.white, fontSize: 12, fontWeight: FontWeight.w600)),
              const SizedBox(height: 6),
              TextField(
                controller: refCtrl,
                keyboardType: TextInputType.number,
                style: const TextStyle(color: Colors.white),
                decoration: InputDecoration(
                  hintText: 'Ej: 489123 (últimos 4 a 6 dígitos)',
                  hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
                  filled: true,
                  fillColor: const Color(0xFF0F172A),
                  border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
                ),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dCtx),
            child: const Text('Cancelar', style: TextStyle(color: Colors.white54)),
          ),
          ElevatedButton(
            onPressed: () async {
              final amt = double.tryParse(amountCtrl.text.trim()) ?? 0.0;
              final ref = refCtrl.text.trim();
              if (amt <= 0) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Por favor ingresa un monto válido mayor a 0.')),
                );
                return;
              }
              if (ref.isEmpty) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Por favor ingresa el número de referencia.')),
                );
                return;
              }
              await _addWalletTransaction(
                title: 'Recarga reportada (Ref: $ref)',
                amount: amt,
                isPositive: true,
              );
              onUpdated();
              if (mounted) {
                Navigator.pop(dCtx);
                ScaffoldMessenger.of(context).showSnackBar(
                  SnackBar(
                    content: Text('¡Recarga de \$${amt.toStringAsFixed(2)} reportada y acreditada con éxito!'),
                    backgroundColor: const Color(0xFF10B981),
                  ),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: const Text('Registrar Recarga'),
          ),
        ],
      ),
    );
  }

  void _showCouponDialog(BuildContext ctx, VoidCallback onUpdated) {
    final codeCtrl = TextEditingController();
    showDialog(
      context: ctx,
      builder: (dCtx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Canjear Cupón', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w800)),
        content: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            TextField(
              controller: codeCtrl,
              style: const TextStyle(color: Colors.white),
              decoration: InputDecoration(
                hintText: 'Ingresa código (ej: CABUDARE2026)',
                hintStyle: const TextStyle(color: Colors.white30, fontSize: 12),
                filled: true,
                fillColor: const Color(0xFF0F172A),
                border: OutlineInputBorder(borderRadius: BorderRadius.circular(12), borderSide: BorderSide.none),
              ),
            ),
          ],
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dCtx), child: const Text('Cancelar', style: TextStyle(color: Colors.white54))),
          ElevatedButton(
            onPressed: () async {
              final code = codeCtrl.text.trim().toUpperCase();
              if (code == 'CABUDARE2026' || code == 'BIENVENIDO5' || code == 'DELIVERY5') {
                await _addWalletTransaction(
                  title: 'Bono de Cupón ($code)',
                  amount: 5.00,
                  isPositive: true,
                );
                onUpdated();
                if (mounted) {
                  Navigator.pop(dCtx);
                  ScaffoldMessenger.of(context).showSnackBar(
                    const SnackBar(content: Text('¡Cupón aplicado! Se acreditaron +\$5.00 a tu billetera.'), backgroundColor: Color(0xFF10B981)),
                  );
                }
              } else {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Código de cupón inválido o expirado.'), backgroundColor: Color(0xFFEF4444)),
                );
              }
            },
            style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
            child: const Text('Aplicar'),
          ),
        ],
      ),
    );
  }

  Widget _buildWalletTxItem(String title, String amount, String date, bool isPositive) {
    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(
        mainAxisAlignment: MainAxisAlignment.spaceBetween,
        children: [
          Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(title, style: GoogleFonts.outfit(color: Colors.white, fontSize: 12.5, fontWeight: FontWeight.w600)),
              Text(date, style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 11)),
            ],
          ),
          Text(
            amount,
            style: GoogleFonts.outfit(
              color: isPositive ? const Color(0xFF10B981) : const Color(0xFFEF4444),
              fontSize: 14,
              fontWeight: FontWeight.w800,
            ),
          ),
        ],
      ),
    );
  }

  void _showCouponsModal(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => FutureBuilder<List<Map<String, dynamic>>>(
        future: ApiService().fetchNotifications(),
        builder: (ctx, snapshot) {
          final items = (snapshot.data ?? [])
              .where((n) => n['coupon_code'] != null || n['couponCode'] != null || n['type'] == 'coupon')
              .toList();

          return Container(
            constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.75),
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.local_offer_rounded, color: Color(0xFFF59E0B), size: 24),
                    const SizedBox(width: 8),
                    Text(
                      'Mis Cupones y Promociones',
                      style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Cupones disponibles emitidos por la plataforma y tus comercios',
                  style: GoogleFonts.outfit(fontSize: 12.5, color: const Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 16),
                if (snapshot.connectionState == ConnectionState.waiting)
                  const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator(color: AppTheme.primary)))
                else if (items.isEmpty)
                  Center(
                    child: Padding(
                      padding: const EdgeInsets.symmetric(vertical: 36),
                      child: Column(
                        children: [
                          const Text('🏷️', style: TextStyle(fontSize: 40)),
                          const SizedBox(height: 10),
                          Text('No tienes cupones vigentes', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 15)),
                          const SizedBox(height: 4),
                          Text('Los cupones y ofertas que recibas aparecerán aquí.', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12)),
                        ],
                      ),
                    ),
                  )
                else
                  Expanded(
                    child: ListView.separated(
                      shrinkWrap: true,
                      itemCount: items.length,
                      separatorBuilder: (_, __) => const SizedBox(height: 10),
                      itemBuilder: (context, idx) {
                        final item = items[idx];
                        final code = (item['coupon_code'] ?? item['couponCode'] ?? '').toString();
                        return Container(
                          padding: const EdgeInsets.all(14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(color: const Color(0xFF334155)),
                          ),
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                children: [
                                  Text(
                                    item['tenant_name'] ?? item['tenantName'] ?? 'Pídetelo',
                                    style: GoogleFonts.outfit(color: AppTheme.primary, fontWeight: FontWeight.bold, fontSize: 12),
                                  ),
                                  if (code.isNotEmpty)
                                    InkWell(
                                      onTap: () {
                                        Clipboard.setData(ClipboardData(text: code));
                                        ScaffoldMessenger.of(context).showSnackBar(
                                          SnackBar(
                                            content: Text('¡Cupón $code copiado!'),
                                            backgroundColor: const Color(0xFF10B981),
                                            duration: const Duration(seconds: 2),
                                          ),
                                        );
                                      },
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFFF59E0B).withOpacity(0.15),
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: const Color(0xFFF59E0B).withOpacity(0.5)),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Text(code.toUpperCase(), style: GoogleFonts.firaCode(color: const Color(0xFFF59E0B), fontWeight: FontWeight.bold, fontSize: 12)),
                                            const SizedBox(width: 4),
                                            const Icon(Icons.copy_rounded, color: Color(0xFFF59E0B), size: 13),
                                          ],
                                        ),
                                      ),
                                    ),
                                ],
                              ),
                              const SizedBox(height: 6),
                              Text(item['title'] ?? 'Cupón de Descuento', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold, fontSize: 14)),
                              const SizedBox(height: 2),
                              Text(item['message'] ?? item['body'] ?? '', style: GoogleFonts.outfit(color: const Color(0xFFCBD5E1), fontSize: 12)),
                            ],
                          ),
                        );
                      },
                    ),
                  ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showNotificationSettingsModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setNotifState) {
          return Container(
            padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Container(
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(10)),
                  ),
                ),
                const SizedBox(height: 16),
                Row(
                  children: [
                    const Icon(Icons.notifications_active_rounded, color: Color(0xFF38BDF8), size: 24),
                    const SizedBox(width: 8),
                    Text(
                      'Configuración de Notificaciones',
                      style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                  ],
                ),
                const SizedBox(height: 6),
                Text(
                  'Elige cómo deseas recibir las alertas de tus entregas',
                  style: GoogleFonts.outfit(fontSize: 12.5, color: const Color(0xFF94A3B8)),
                ),
                const SizedBox(height: 20),

                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppTheme.primary,
                  title: Text('Estatus del Pedido en Tiempo Real', style: GoogleFonts.outfit(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text('Avisos de confirmación, preparación y despacho', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12)),
                  value: _notifyOrders,
                  onChanged: (val) {
                    setNotifState(() => _notifyOrders = val);
                    setState(() => _notifyOrders = val);
                  },
                ),
                const Divider(color: Colors.white12),

                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppTheme.primary,
                  title: Text('Llegada del Motorizado', style: GoogleFonts.outfit(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text('Alerta sonora y vibración cuando el repartidor está a menos de 500 metros', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12)),
                  value: _notifyRiderNear,
                  onChanged: (val) {
                    setNotifState(() => _notifyRiderNear = val);
                    setState(() => _notifyRiderNear = val);
                  },
                ),
                const Divider(color: Colors.white12),

                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppTheme.primary,
                  title: Text('Ofertas y Cupones Flash', style: GoogleFonts.outfit(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text('Descuentos exclusivos en comercios y tiendas aliadas', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12)),
                  value: _notifyPromos,
                  onChanged: (val) {
                    setNotifState(() => _notifyPromos = val);
                    setState(() => _notifyPromos = val);
                  },
                ),
                const Divider(color: Colors.white12),

                SwitchListTile(
                  contentPadding: EdgeInsets.zero,
                  activeColor: AppTheme.primary,
                  title: Text('Alertas por WhatsApp', style: GoogleFonts.outfit(color: Colors.white, fontSize: 14, fontWeight: FontWeight.w600)),
                  subtitle: Text('Mensaje de respaldo con enlace de rastreo en tu teléfono', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12)),
                  value: _notifyWhatsApp,
                  onChanged: (val) {
                    setNotifState(() => _notifyWhatsApp = val);
                    setState(() => _notifyWhatsApp = val);
                  },
                ),
                const SizedBox(height: 18),

                ElevatedButton(
                  onPressed: () async {
                    await _saveNotificationPreferences();
                    if (!mounted) return;
                    Navigator.pop(ctx);
                    ScaffoldMessenger.of(context).showSnackBar(
                      const SnackBar(
                        content: Text('Configuración de notificaciones guardada exitosamente'),
                        backgroundColor: Color(0xFF10B981),
                      ),
                    );
                  },
                  style: ElevatedButton.styleFrom(
                    backgroundColor: AppTheme.primary,
                    padding: const EdgeInsets.symmetric(vertical: 14),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                  ),
                  child: const Text('Guardar Preferencias'),
                ),
              ],
            ),
          );
        },
      ),
    );
  }

  void _showLegalInfoModal() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(borderRadius: BorderRadius.vertical(top: Radius.circular(28))),
      builder: (ctx) => DefaultTabController(
        length: 2,
        child: Container(
          constraints: BoxConstraints(maxHeight: MediaQuery.of(ctx).size.height * 0.8),
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              Center(
                child: Container(
                  width: 44,
                  height: 4,
                  decoration: BoxDecoration(color: Colors.white24, borderRadius: BorderRadius.circular(10)),
                ),
              ),
              const SizedBox(height: 16),
              TabBar(
                indicatorColor: AppTheme.primary,
                labelColor: Colors.white,
                unselectedLabelColor: const Color(0xFF94A3B8),
                tabs: const [
                  Tab(text: 'Términos Billetera'),
                  Tab(text: 'Políticas Privacidad'),
                ],
              ),
              const SizedBox(height: 16),
              Expanded(
                child: TabBarView(
                  children: [
                    // Tab 1: Wallet Terms
                    SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Términos y Condiciones de la Billetera DeliveryHub', style: GoogleFonts.outfit(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 10),
                          Text(
                            '1. Uso del Saldo:\nEl saldo recargado en tu Billetera DeliveryHub puede ser utilizado exclusivamente para el pago de platillos, tarifas de envío y propinas en todos los comercios afiliados a la plataforma en Cabudare y Barquisimeto.\n\n'
                            '2. Recargas y Conversión:\nLas recargas realizadas en Bolívares (VES) mediante Pago Móvil son convertidas a dólares al tipo de cambio oficial publicado por el Banco Central de Venezuela (BCV) al momento de procesar la transacción.\n\n'
                            '3. No Caducidad:\nLos fondos acreditados en tu cuenta no tienen fecha de vencimiento ni generan comisiones por mantenimiento o inactividad.\n\n'
                            '4. Garantía de Entrega y Reembolsos:\nEn caso de que un pedido sea cancelado por el restaurante o no pueda ser completado por factores ajenos al cliente, el importe total será reintegrado de forma instantánea a tu saldo disponible.',
                            style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12.5, height: 1.45),
                          ),
                        ],
                      ),
                    ),
                    // Tab 2: Privacy Policy
                    SingleChildScrollView(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text('Políticas de Privacidad y Tratamiento de Datos', style: GoogleFonts.outfit(color: Colors.white, fontSize: 15, fontWeight: FontWeight.w800)),
                          const SizedBox(height: 10),
                          Text(
                            '1. Datos Personales Recolectados:\nDeliveryHub almacena tu nombre, número telefónico y direcciones de entrega con el único propósito de gestionar tus pedidos y permitir la comunicación directa con el repartidor asignado.\n\n'
                            '2. Uso de Coordenadas GPS:\nLas coordenadas geográficas capturadas en el mapa se utilizan estrictamente para el cálculo de distancia, costo de despacho y enrutamiento del motorizado hacia tu domicilio.\n\n'
                            '3. Seguridad y Confidencialidad:\nTus credenciales y números de referencia están protegidos mediante cifrado de grado industrial. En ningún momento comercializamos ni compartimos tu información con terceros no autorizados.\n\n'
                            '4. Derechos del Titular:\nPuedes modificar tus datos o solicitar la eliminación definitiva de tu cuenta y registros en cualquier momento desde la sección de ajustes.',
                            style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 12.5, height: 1.45),
                          ),
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

  void _logout() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (dCtx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Text('Cerrar Sesión', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w800)),
        content: Text('¿Estás seguro que deseas cerrar sesión de tu cuenta?', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 13.5)),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dCtx, false), child: const Text('Cancelar', style: TextStyle(color: Colors.white54))),
          ElevatedButton(
            onPressed: () => Navigator.pop(dCtx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            child: const Text('Cerrar Sesión'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await widget.sessionService.logout();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => CustomerLoginScreen(sessionService: widget.sessionService)),
        (route) => false,
      );
    }
  }

  void _deleteAccount() async {
    final confirm = await showDialog<bool>(
      context: context,
      builder: (dCtx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(20)),
        title: Row(
          children: [
            const Icon(Icons.warning_amber_rounded, color: Color(0xFFEF4444)),
            const SizedBox(width: 8),
            Text('Eliminar Cuenta', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.w800)),
          ],
        ),
        content: Text(
          'Esta acción es definitiva e irreversible. Se eliminará tu perfil, direcciones guardadas, historial de pedidos y saldo en billetera. ¿Deseas proceder?',
          style: GoogleFonts.outfit(color: const Color(0xFF94A3B8), fontSize: 13, height: 1.4),
        ),
        actions: [
          TextButton(onPressed: () => Navigator.pop(dCtx, false), child: const Text('Cancelar', style: TextStyle(color: Colors.white54))),
          ElevatedButton(
            onPressed: () => Navigator.pop(dCtx, true),
            style: ElevatedButton.styleFrom(backgroundColor: const Color(0xFFEF4444)),
            child: const Text('Sí, Eliminar Cuenta'),
          ),
        ],
      ),
    );

    if (confirm == true) {
      await widget.sessionService.logout();
      if (!mounted) return;
      Navigator.of(context).pushAndRemoveUntil(
        MaterialPageRoute(builder: (_) => CustomerLoginScreen(sessionService: widget.sessionService)),
        (route) => false,
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final user = widget.sessionService.currentUser ??
        const AppUser(
          id: '',
          name: 'Cliente Invitado',
          email: '',
          phone: '',
          deliveryAddress: '',
          role: AppUserRole.customer,
        );

    final cart = CartService();

    return Scaffold(
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
      body: SafeArea(
        child: SingleChildScrollView(
          padding: const EdgeInsets.fromLTRB(20, 16, 20, 36),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              // User Avatar & Name Header
              Center(
                child: Column(
                  children: [
                    Stack(
                      children: [
                        CircleAvatar(
                          radius: 46,
                          backgroundColor: AppTheme.primary.withOpacity(0.15),
                          child: Text(
                            user.name.isNotEmpty
                                ? user.name.split(' ').map((n) => n.isNotEmpty ? n[0] : '').take(2).join()
                                : 'C',
                            style: GoogleFonts.outfit(
                              fontSize: 32,
                              fontWeight: FontWeight.w800,
                              color: AppTheme.primary,
                            ),
                          ),
                        ),
                        Positioned(
                          bottom: 0,
                          right: 0,
                          child: Container(
                            padding: const EdgeInsets.all(4),
                            decoration: const BoxDecoration(
                              color: AppTheme.primary,
                              shape: BoxShape.circle,
                            ),
                            child: const Icon(Icons.verified_rounded, size: 20, color: Colors.white),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      user.name.isNotEmpty ? user.name : 'Cliente',
                      style: GoogleFonts.outfit(
                        fontSize: 22,
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                    if (user.email.isNotEmpty) ...[
                      const SizedBox(height: 4),
                      Text(
                        user.email,
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          color: const Color(0xFF94A3B8),
                        ),
                      ),
                    ],
                    if (user.phone.isNotEmpty) ...[
                      const SizedBox(height: 2),
                      Text(
                        user.phone,
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          color: AppTheme.primary,
                          fontWeight: FontWeight.w600,
                        ),
                      ),
                    ],
                    const SizedBox(height: 12),
                    OutlinedButton.icon(
                      onPressed: () => _editProfile(context, user),
                      icon: const Icon(Icons.edit_rounded, size: 16),
                      label: const Text('Modificar Perfil'),
                      style: OutlinedButton.styleFrom(
                        foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
                        side: BorderSide(color: isDark ? Colors.white24 : const Color(0xFFCBD5E1)),
                        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                      ),
                    ),
                  ],
                ),
              ),

              const SizedBox(height: 24),

              // Menu Card with the requested 7 items
              Container(
                decoration: BoxDecoration(
                  color: isDark ? AppTheme.darkSurface : Colors.white,
                  borderRadius: BorderRadius.circular(22),
                  border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                  boxShadow: [
                    BoxShadow(
                      color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
                      blurRadius: 14,
                      offset: const Offset(0, 4),
                    ),
                  ],
                ),
                child: Column(
                  children: [
                    // 1. Direcciones
                    _buildMenuItem(
                      context: context,
                      icon: Icons.location_on_rounded,
                      iconColor: AppTheme.primary,
                      title: 'Mis Direcciones',
                      subtitle: '${cart.savedAddresses.length} guardadas • Fijar en Mapa GPS',
                      onTap: () {
                        Navigator.push(
                          context,
                          MaterialPageRoute(builder: (_) => const SavedAddressesScreen()),
                        );
                      },
                    ),
                    Divider(height: 1, indent: 64, color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),

                    // 2. Favoritos
                    _buildMenuItem(
                      context: context,
                      icon: Icons.favorite_rounded,
                      iconColor: const Color(0xFFEF4444),
                      title: 'Favoritos',
                      subtitle: '${widget.sessionService.favoriteStoreIds.length} comercios guardados',
                      onTap: _showFavoritesModal,
                    ),
                    Divider(height: 1, indent: 64, color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),

                    // 3. Billetera
                    _buildMenuItem(
                      context: context,
                      icon: Icons.account_balance_wallet_rounded,
                      iconColor: const Color(0xFF10B981),
                      title: 'Billetera Pídetelo',
                      subtitle: 'Saldo: \$${_walletBalance.toStringAsFixed(2)} • Recargas y Métodos',
                      onTap: _showWalletModal,
                    ),
                    Divider(height: 1, indent: 64, color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),

                    // 4. Mis Cupones y Promociones
                    _buildMenuItem(
                      context: context,
                      icon: Icons.local_offer_rounded,
                      iconColor: const Color(0xFFF59E0B),
                      title: 'Mis Cupones y Descuentos',
                      subtitle: 'Cupones vigentes y códigos promocionales',
                      onTap: () => _showCouponsModal(context),
                    ),
                    Divider(height: 1, indent: 64, color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),

                    // 5. Configuración de Notificaciones
                    _buildMenuItem(
                      context: context,
                      icon: Icons.notifications_active_rounded,
                      iconColor: const Color(0xFF38BDF8),
                      title: 'Configuración de Notificaciones',
                      subtitle: 'Alertas de entrega, motorizado y promociones',
                      onTap: _showNotificationSettingsModal,
                    ),
                    Divider(height: 1, indent: 64, color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),

                    // 5. Información Legal
                    _buildMenuItem(
                      context: context,
                      icon: Icons.gavel_rounded,
                      iconColor: AppTheme.amberAccent,
                      title: 'Información Legal',
                      subtitle: 'Términos de Billetera y Políticas de Privacidad',
                      onTap: _showLegalInfoModal,
                    ),
                    Divider(height: 1, indent: 64, color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),

                    // 6. Cerrar Sesión
                    _buildMenuItem(
                      context: context,
                      icon: Icons.logout_rounded,
                      iconColor: const Color(0xFF94A3B8),
                      title: 'Cerrar Sesión',
                      subtitle: 'Salir de forma segura de tu cuenta',
                      onTap: _logout,
                    ),
                    Divider(height: 1, indent: 64, color: isDark ? Colors.white10 : const Color(0xFFE2E8F0)),

                    // 7. Eliminar Cuenta (Danger Zone)
                    _buildMenuItem(
                      context: context,
                      icon: Icons.delete_forever_rounded,
                      iconColor: const Color(0xFFEF4444),
                      title: 'Eliminar Cuenta',
                      subtitle: 'Eliminar permanentemente todos tus datos',
                      isDestructive: true,
                      onTap: _deleteAccount,
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

  Widget _buildMenuItem({
    required BuildContext context,
    required IconData icon,
    required Color iconColor,
    required String title,
    required String subtitle,
    required VoidCallback onTap,
    bool isDestructive = false,
  }) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final titleColor = isDestructive
        ? const Color(0xFFEF4444)
        : (isDark ? Colors.white : const Color(0xFF0F172A));
    final subtitleColor = isDestructive
        ? const Color(0xFFEF4444).withOpacity(0.8)
        : (isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B));
    final chevronColor = isDestructive
        ? const Color(0xFFEF4444)
        : (isDark ? Colors.white38 : const Color(0xFF94A3B8));

    return InkWell(
      onTap: onTap,
      borderRadius: BorderRadius.circular(16),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        child: Row(
          children: [
            Container(
              padding: const EdgeInsets.all(10),
              decoration: BoxDecoration(
                color: iconColor.withOpacity(0.12),
                borderRadius: BorderRadius.circular(12),
              ),
              child: Icon(icon, color: iconColor, size: 22),
            ),
            const SizedBox(width: 14),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: GoogleFonts.outfit(
                      fontSize: 14.5,
                      fontWeight: FontWeight.w700,
                      color: titleColor,
                    ),
                  ),
                  const SizedBox(height: 2),
                  Text(
                    subtitle,
                    style: GoogleFonts.outfit(
                      fontSize: 11.5,
                      color: subtitleColor,
                    ),
                  ),
                ],
              ),
            ),
            Icon(
              Icons.chevron_right_rounded,
              size: 20,
              color: chevronColor,
            ),
          ],
        ),
      ),
    );
  }
}
