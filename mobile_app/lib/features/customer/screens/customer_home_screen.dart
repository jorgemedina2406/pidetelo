import 'dart:async';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/models/order_model.dart';
import '../../../core/models/branch_model.dart';
import '../../../core/services/cart_service.dart';
import '../../../core/services/session_service.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import '../widgets/branch_selector_bottom_sheet.dart';
import 'store_detail_screen.dart';
import 'checkout_sheet.dart';
import 'customer_tracking_screen.dart';
import 'user_profile_screen.dart';
import 'saved_addresses_screen.dart';
import '../../auth/screens/customer_login_screen.dart';

class CustomerHomeScreen extends StatefulWidget {
  final SessionService sessionService;

  const CustomerHomeScreen({super.key, required this.sessionService});

  @override
  State<CustomerHomeScreen> createState() => _CustomerHomeScreenState();
}

class _CustomerHomeScreenState extends State<CustomerHomeScreen> {
  int _selectedTab = 0;
  String _selectedCategory = 'Todos';
  bool _isLoadingStores = false;
  bool _isStoreGridView = false;
  List<BannerItem> _banners = [];
  Timer? _liveOrdersSyncTimer;

  List<Map<String, dynamic>> _stores = [];

  @override
  void initState() {
    super.initState();
    _loadTenants();
    _loadBanners();
    _startLiveOrdersSync();
  }

  void _startLiveOrdersSync() {
    _liveOrdersSyncTimer?.cancel();
    _liveOrdersSyncTimer = Timer.periodic(const Duration(seconds: 3), (_) {
      if (!mounted) return;
      final user = widget.sessionService.currentUser;
      final phone = user?.phone.trim() ?? '';
      final name = user?.name.trim() ?? '';
      if (phone.length >= 7) {
        CartService().syncOrdersWithCloud(phone);
      } else if (name.length >= 4 && name.toLowerCase() != 'cliente' && name.toLowerCase() != 'invitado') {
        CartService().syncOrdersWithCloud(name);
      }
    });
  }

  @override
  void dispose() {
    _liveOrdersSyncTimer?.cancel();
    super.dispose();
  }

  Future<void> _loadBanners() async {
    final banners = await ApiService().fetchBanners();
    if (mounted) {
      setState(() {
        _banners = banners;
      });
    }
  }

  Color _parseHexColor(dynamic hex, {Color fallback = const Color(0xFFF97316)}) {
    if (hex == null) return fallback;
    final str = hex.toString().trim();
    if (str.isEmpty) return fallback;
    try {
      final clean = str.replaceAll('#', '');
      if (clean.length == 6) {
        return Color(int.parse('0xFF$clean'));
      } else if (clean.length == 8) {
        return Color(int.parse('0x$clean'));
      }
    } catch (_) {}
    return fallback;
  }

  bool _isStoreOpenNow(Map<String, dynamic> store) {
    try {
      final openStr = store['open_time'] ?? store['openTime'] ?? '09:00';
      final closeStr = store['close_time'] ?? store['closeTime'] ?? '23:00';
      final now = DateTime.now();
      final cur = now.hour * 60 + now.minute;
      final oParts = openStr.toString().split(':').map(int.parse).toList();
      final cParts = closeStr.toString().split(':').map(int.parse).toList();
      final o = (oParts.isNotEmpty ? oParts[0] : 9) * 60 + (oParts.length > 1 ? oParts[1] : 0);
      final c = (cParts.isNotEmpty ? cParts[0] : 23) * 60 + (cParts.length > 1 ? cParts[1] : 0);

      if (c > o) {
        return cur >= o && cur < c;
      } else {
        return cur >= o || cur < c;
      }
    } catch (_) {
      return true;
    }
  }

  Future<void> _loadTenants() async {
    setState(() => _isLoadingStores = true);
    final tenants = await ApiService().fetchTenants();

    final user = widget.sessionService.currentUser;
    final phone = user?.phone.trim() ?? '';
    final name = user?.name.trim() ?? '';
    if (phone.length >= 7) {
      CartService().syncOrdersWithCloud(phone);
    } else if (name.length >= 4 && name.toLowerCase() != 'cliente' && name.toLowerCase() != 'invitado') {
      CartService().syncOrdersWithCloud(name);
    }

    if (mounted) {
      setState(() {
        _stores = tenants;
        _isLoadingStores = false;
      });
    }
  }

  void _showOrderTrackingModal(DeliveryOrder order) {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => CustomerTrackingScreen(order: order),
      ),
    );
  }

  void _openUserProfile() {
    Navigator.push(
      context,
      MaterialPageRoute(
        builder: (_) => UserProfileScreen(sessionService: widget.sessionService),
      ),
    );
  }

  void _openNotificationsSheet(BuildContext context) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: widget.sessionService.isDarkMode ? const Color(0xFF0F172A) : Colors.white,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) {
        return FutureBuilder<List<Map<String, dynamic>>>(
          future: ApiService().fetchNotifications(),
          builder: (context, snapshot) {
            final isDark = widget.sessionService.isDarkMode;
            final textColor = isDark ? Colors.white : const Color(0xFF0F172A);

            return Container(
              padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 24),
              constraints: BoxConstraints(maxHeight: MediaQuery.of(context).size.height * 0.75),
              child: Column(
                mainAxisSize: MainAxisSize.min,
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          const Icon(Icons.notifications_active_rounded, color: AppTheme.primary, size: 24),
                          const SizedBox(width: 8),
                          Text(
                            'Notificaciones & Cupones',
                            style: GoogleFonts.outfit(
                              fontSize: 18,
                              fontWeight: FontWeight.w800,
                              color: textColor,
                            ),
                          ),
                        ],
                      ),
                      IconButton(
                        icon: const Icon(Icons.close_rounded),
                        onPressed: () => Navigator.pop(ctx),
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Promociones exclusivas y cupones enviados para ti',
                    style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey),
                  ),
                  const SizedBox(height: 16),
                  if (snapshot.connectionState == ConnectionState.waiting)
                    const Center(child: Padding(padding: EdgeInsets.all(32), child: CircularProgressIndicator()))
                  else if (!snapshot.hasData || snapshot.data!.isEmpty)
                    Center(
                      child: Padding(
                        padding: const EdgeInsets.symmetric(vertical: 40),
                        child: Column(
                          children: [
                            const Text('🏷️', style: TextStyle(fontSize: 40)),
                            const SizedBox(height: 8),
                            Text(
                              'Sin notificaciones activas',
                              style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.bold, color: textColor),
                            ),
                            const SizedBox(height: 4),
                            Text(
                              'Los cupones que recibas de tus comercios favoritos aparecerán aquí.',
                              textAlign: TextAlign.center,
                              style: GoogleFonts.outfit(fontSize: 12, color: Colors.grey),
                            ),
                          ],
                        ),
                      ),
                    )
                  else
                    Expanded(
                      child: ListView.separated(
                        itemCount: snapshot.data!.length,
                        separatorBuilder: (_, __) => const SizedBox(height: 12),
                        itemBuilder: (context, idx) {
                          final notif = snapshot.data![idx];
                          final couponCode = notif['coupon_code'] ?? notif['couponCode'];
                          return Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isDark ? const Color(0xFF334155) : const Color(0xFFE2E8F0),
                              ),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                  children: [
                                    Expanded(
                                      child: Text(
                                        notif['title'] ?? 'Promoción Especial',
                                        style: GoogleFonts.outfit(
                                          fontWeight: FontWeight.w700,
                                          fontSize: 14,
                                          color: textColor,
                                        ),
                                      ),
                                    ),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                      decoration: BoxDecoration(
                                        color: AppTheme.primary.withOpacity(0.15),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        'Pídetelo',
                                        style: GoogleFonts.outfit(
                                          fontSize: 10,
                                          fontWeight: FontWeight.w800,
                                          color: AppTheme.primary,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                const SizedBox(height: 6),
                                Text(
                                  notif['message'] ?? '',
                                  style: GoogleFonts.outfit(fontSize: 12, color: isDark ? Colors.grey[300] : Colors.grey[700]),
                                ),
                                if (couponCode != null && couponCode.toString().isNotEmpty) ...[
                                  const SizedBox(height: 12),
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                        decoration: BoxDecoration(
                                          color: Colors.amber.withOpacity(0.15),
                                          borderRadius: BorderRadius.circular(8),
                                          border: Border.all(color: Colors.amber.withOpacity(0.4)),
                                        ),
                                        child: Text(
                                          couponCode.toString().toUpperCase(),
                                          style: GoogleFonts.firaCode(
                                            fontWeight: FontWeight.w800,
                                            fontSize: 13,
                                            color: Colors.amber[800] ?? Colors.amber,
                                          ),
                                        ),
                                      ),
                                      ElevatedButton.icon(
                                        onPressed: () {
                                          Clipboard.setData(ClipboardData(text: couponCode.toString()));
                                          ScaffoldMessenger.of(context).showSnackBar(
                                            SnackBar(
                                              content: Text('¡Cupón "$couponCode" copiado!'),
                                              backgroundColor: Colors.emerald,
                                              duration: const Duration(seconds: 2),
                                            ),
                                          );
                                        },
                                        icon: const Icon(Icons.copy_rounded, size: 14),
                                        label: const Text('Copiar'),
                                        style: ElevatedButton.styleFrom(
                                          backgroundColor: AppTheme.primary,
                                          foregroundColor: Colors.white,
                                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                                          textStyle: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.bold),
                                          shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                        ),
                                      ),
                                    ],
                                  ),
                                ],
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
        );
      },
    );
  }

  void _showOrderReceiptDialog(BuildContext context, DeliveryOrder order) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
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
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      order.merchantName,
                      style: GoogleFonts.outfit(
                        fontSize: 18,
                        fontWeight: FontWeight.w800,
                        color: Colors.white,
                      ),
                    ),
                    Text(
                      'Pedido: ${order.orderNumber}',
                      style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                    ),
                  ],
                ),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                  decoration: BoxDecoration(
                    color: (order.status == OrderDeliveryStatus.delivered
                            ? const Color(0xFF10B981)
                            : AppTheme.primary)
                        .withOpacity(0.15),
                    borderRadius: BorderRadius.circular(10),
                  ),
                  child: Text(
                    order.status.label,
                    style: GoogleFonts.outfit(
                      fontSize: 11,
                      fontWeight: FontWeight.w800,
                      color: order.status == OrderDeliveryStatus.delivered
                          ? const Color(0xFF10B981)
                          : AppTheme.primary,
                    ),
                  ),
                ),
              ],
            ),
            const SizedBox(height: 16),
            const Divider(color: Colors.white12),
            const SizedBox(height: 10),

            Text(
              'PLATILLOS DEL PEDIDO',
              style: GoogleFonts.outfit(
                fontSize: 11,
                fontWeight: FontWeight.w800,
                color: const Color(0xFF94A3B8),
                letterSpacing: 0.5,
              ),
            ),
            const SizedBox(height: 8),

            ...order.items.map((item) => Padding(
                  padding: const EdgeInsets.only(bottom: 8),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        '${item.quantity}x ${item.product.name}',
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w600,
                          color: Colors.white,
                        ),
                      ),
                      Text(
                        '\$${item.totalPrice.toStringAsFixed(2)}',
                        style: GoogleFonts.outfit(
                          fontSize: 13,
                          fontWeight: FontWeight.w700,
                          color: Colors.white70,
                        ),
                      ),
                    ],
                  ),
                )),

            const Divider(color: Colors.white12, height: 16),

            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Subtotal', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8))),
                Text('\$${order.subtotal.toStringAsFixed(2)}',
                    style: GoogleFonts.outfit(color: Colors.white)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text('Costo de Envío', style: GoogleFonts.outfit(color: const Color(0xFF94A3B8))),
                Text('\$${order.deliveryFee.toStringAsFixed(2)}',
                    style: GoogleFonts.outfit(color: Colors.white)),
              ],
            ),
            const SizedBox(height: 4),
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Total Pagado',
                  style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w800, color: Colors.white),
                ),
                Text(
                  '\$${order.total.toStringAsFixed(2)}',
                  style: GoogleFonts.outfit(
                    fontSize: 16,
                    fontWeight: FontWeight.w900,
                    color: AppTheme.primary,
                  ),
                ),
              ],
            ),

            const SizedBox(height: 14),
            Container(
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: const Color(0xFF1E293B),
                borderRadius: BorderRadius.circular(14),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    'Dirección de Entrega:',
                    style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
                  ),
                  Text(
                    order.customerAddress,
                    style: GoogleFonts.outfit(fontSize: 12.5, fontWeight: FontWeight.w600, color: Colors.white),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Método de Pago: ${order.paymentMethod}',
                    style: GoogleFonts.outfit(fontSize: 12, color: AppTheme.amberAccent),
                  ),
                ],
              ),
            ),

            const SizedBox(height: 20),

            if (order.status != OrderDeliveryStatus.delivered)
              ElevatedButton.icon(
                onPressed: () {
                  Navigator.pop(ctx);
                  _showOrderTrackingModal(order);
                },
                icon: const Icon(Icons.navigation_rounded),
                label: const Text('Rastrear en Vivo en el Mapa'),
                style: ElevatedButton.styleFrom(
                  backgroundColor: AppTheme.primary,
                  minimumSize: const Size(double.infinity, 48),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
              )
            else
              OutlinedButton(
                onPressed: () => Navigator.pop(ctx),
                style: OutlinedButton.styleFrom(
                  foregroundColor: Colors.white,
                  side: const BorderSide(color: Colors.white24),
                  minimumSize: const Size(double.infinity, 48),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                ),
                child: const Text('Cerrar'),
              ),
          ],
        ),
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final user = widget.sessionService.currentUser;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      appBar: AppBar(
        leading: Padding(
          padding: const EdgeInsets.only(left: 12, top: 8, bottom: 8, right: 4),
          child: Image.asset(
            'assets/images/logo.png',
            fit: BoxFit.contain,
          ),
        ),
        title: Column(
          children: [
            Text(
              'ENTREGAR EN',
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w700,
                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                letterSpacing: 0.5,
              ),
            ),
            AnimatedBuilder(
              animation: CartService(),
              builder: (context, _) {
                final addr = CartService().selectedAddress;
                return InkWell(
                  onTap: () {
                    Navigator.push(
                      context,
                      MaterialPageRoute(
                        builder: (_) => const SavedAddressesScreen(),
                      ),
                    );
                  },
                  borderRadius: BorderRadius.circular(8),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      const Icon(Icons.location_on_rounded, size: 15, color: AppTheme.primary),
                      const SizedBox(width: 4),
                      ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 180),
                        child: Text(
                          addr.title.isNotEmpty ? addr.title : 'Mi Dirección',
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: GoogleFonts.outfit(fontSize: 13.5, fontWeight: FontWeight.w700),
                        ),
                      ),
                      const Icon(Icons.keyboard_arrow_down_rounded, size: 16),
                    ],
                  ),
                );
              },
            ),
          ],
        ),
        actions: [
          IconButton(
            icon: const Icon(Icons.notifications_active_outlined, color: AppTheme.primary, size: 22),
            tooltip: 'Notificaciones y Cupones',
            onPressed: () => _openNotificationsSheet(context),
          ),
          IconButton(
            icon: Icon(
              widget.sessionService.isDarkMode ? Icons.wb_sunny_rounded : Icons.nightlight_round,
              color: widget.sessionService.isDarkMode ? Colors.amber : null,
              size: 20,
            ),
            tooltip: widget.sessionService.isDarkMode ? 'Modo claro' : 'Modo oscuro',
            onPressed: () => widget.sessionService.toggleTheme(),
          ),
          IconButton(
            icon: const Icon(Icons.person_rounded),
            tooltip: 'Mi Perfil',
            onPressed: _openUserProfile,
          ),
          PopupMenuButton<String>(
            icon: const Icon(Icons.more_vert_rounded),
            onSelected: (val) {
              if (val == 'profile') {
                _openUserProfile();
              } else if (val == 'logout') {
                widget.sessionService.logout();
                Navigator.of(context).pushAndRemoveUntil(
                  MaterialPageRoute(
                    builder: (_) => CustomerLoginScreen(sessionService: widget.sessionService),
                  ),
                  (route) => false,
                );
              }
            },
            itemBuilder: (_) => [
              PopupMenuItem(
                value: 'profile',
                child: Row(
                  children: [
                    const Icon(Icons.account_circle_rounded, size: 20, color: AppTheme.primary),
                    const SizedBox(width: 10),
                    Text('Mi Perfil (${user?.name.isNotEmpty == true ? user!.name : "Cliente"})'),
                  ],
                ),
              ),
              const PopupMenuDivider(),
              const PopupMenuItem(
                value: 'logout',
                child: Row(
                  children: [
                    Icon(Icons.logout_rounded, size: 20, color: Colors.redAccent),
                    SizedBox(width: 10),
                    Text('Cerrar Sesión'),
                  ],
                ),
              ),
            ],
          ),
        ],
      ),
      body: AnimatedBuilder(
        animation: Listenable.merge([widget.sessionService, CartService()]),
        builder: (context, _) {
          switch (_selectedTab) {
            case 1:
              return _buildOrdersHistoryTab(isDark);
            case 2:
              return _buildFavoritesTab(isDark);
            case 3:
              return UserProfileScreen(sessionService: widget.sessionService);
            case 0:
            default:
              return _buildCatalogTab(isDark);
          }
        },
      ),
      bottomNavigationBar: NavigationBar(
        selectedIndex: _selectedTab,
        onDestinationSelected: (idx) {
          setState(() => _selectedTab = idx);
        },
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.storefront_outlined),
            selectedIcon: Icon(Icons.storefront_rounded),
            label: 'Explorar',
          ),
          NavigationDestination(
            icon: Icon(Icons.receipt_long_outlined),
            selectedIcon: Icon(Icons.receipt_long_rounded),
            label: 'Pedidos',
          ),
          NavigationDestination(
            icon: Icon(Icons.favorite_outline_rounded),
            selectedIcon: Icon(Icons.favorite_rounded),
            label: 'Favoritos',
          ),
          NavigationDestination(
            icon: Icon(Icons.person_outline_rounded),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Perfil',
          ),
        ],
      ),
    );
  }

  // --- TAB 0: EXPLORAR COMERCIOS ---
  Widget _buildCatalogTab(bool isDark) {
    final cart = CartService();
    final activeOrder = cart.activeOrder;

    return Stack(
      children: [
        RefreshIndicator(
          onRefresh: _loadTenants,
          color: AppTheme.primary,
          child: SingleChildScrollView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 90),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Floating Active Order Radar Banner
                if (activeOrder != null && activeOrder.status != OrderDeliveryStatus.delivered)
                  GestureDetector(
                    onTap: () => _showOrderTrackingModal(activeOrder),
                    child: Container(
                      margin: const EdgeInsets.only(bottom: 16),
                      padding: const EdgeInsets.all(14),
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            AppTheme.primary,
                            AppTheme.primary.withOpacity(0.85),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(18),
                        boxShadow: [
                          BoxShadow(
                            color: AppTheme.primary.withOpacity(0.3),
                            blurRadius: 14,
                            offset: const Offset(0, 6),
                          ),
                        ],
                      ),
                      child: Row(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(12),
                            ),
                            child: const Icon(Icons.delivery_dining_rounded, color: Colors.white, size: 26),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  activeOrder.status == OrderDeliveryStatus.onTheWay
                                      ? 'En camino (${activeOrder.orderNumber})'
                                      : activeOrder.status == OrderDeliveryStatus.atMerchant
                                          ? 'En el local (${activeOrder.orderNumber})'
                                          : activeOrder.status == OrderDeliveryStatus.assigned
                                              ? 'Repartidor asignado (${activeOrder.orderNumber})'
                                              : activeOrder.status == OrderDeliveryStatus.preparing
                                                  ? 'En preparación (${activeOrder.orderNumber})'
                                                  : 'Pedido recibido (${activeOrder.orderNumber})',
                                  style: GoogleFonts.outfit(
                                    color: Colors.white,
                                    fontSize: 13.5,
                                    fontWeight: FontWeight.w800,
                                  ),
                                ),
                                Text(
                                  activeOrder.status == OrderDeliveryStatus.onTheWay
                                      ? '${activeOrder.riderName.isNotEmpty ? activeOrder.riderName : "Repartidor"} en ruta a tu ubicación'
                                      : activeOrder.status == OrderDeliveryStatus.atMerchant
                                          ? '¡${activeOrder.riderName.isNotEmpty ? activeOrder.riderName : "El repartidor"} llegó al local a retirar!'
                                          : activeOrder.status == OrderDeliveryStatus.assigned
                                              ? '${activeOrder.riderName.isNotEmpty ? activeOrder.riderName : "Repartidor"} asignado • Yendo al comercio'
                                              : activeOrder.status == OrderDeliveryStatus.preparing
                                                  ? 'Cocina preparando tu orden'
                                                  : 'Esperando confirmación del comercio',
                                  style: GoogleFonts.outfit(
                                    color: Colors.white.withOpacity(0.9),
                                    fontSize: 11.5,
                                  ),
                                ),
                              ],
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            decoration: BoxDecoration(
                              color: Colors.white,
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Text(
                              'Ver Mapa',
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.primary,
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),

                // Search Bar
                TextField(
                  decoration: InputDecoration(
                    hintText: '¿Qué te gustaría comer hoy en Cabudare?',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    suffixIcon: Container(
                      margin: const EdgeInsets.all(6),
                      padding: const EdgeInsets.all(6),
                      decoration: BoxDecoration(
                        color: AppTheme.primary.withOpacity(0.12),
                        borderRadius: BorderRadius.circular(10),
                      ),
                      child: const Icon(Icons.tune_rounded, size: 18, color: AppTheme.primary),
                    ),
                  ),
                ),

                const SizedBox(height: 16),

                // 1. CATEGORÍAS CON ICONOS EN FONDO GRIS SUAVE
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Explora por categoría',
                      style: GoogleFonts.outfit(
                        fontSize: 16,
                        fontWeight: FontWeight.w800,
                        color: isDark ? Colors.white : const Color(0xFF0F172A),
                      ),
                    ),
                    TextButton(
                      onPressed: () => setState(() => _selectedCategory = 'Todos'),
                      child: Text(
                        'Ver todos',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w700,
                          color: AppTheme.primary,
                        ),
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 8),

                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      {'name': 'Todos', 'icon': '✨', 'filter': 'Todos'},
                      {'name': 'Restaurantes', 'icon': '🍽️', 'filter': 'Comida'},
                      {'name': 'Súper', 'icon': '🛒', 'filter': 'Markets'},
                      {'name': 'Farmacias', 'icon': '💊', 'filter': 'Farmacias'},
                      {'name': 'Mascotas', 'icon': '🐾', 'filter': 'Mascotas'},
                      {'name': 'Licores', 'icon': '🍷', 'filter': 'Licores'},
                      {'name': 'Postres', 'icon': '🧁', 'filter': 'Postres'},
                    ].map((catData) {
                      final name = catData['name'] as String;
                      final icon = catData['icon'] as String;
                      final filter = catData['filter'] as String;
                      final isSelected = _selectedCategory == filter;

                      return Padding(
                        padding: const EdgeInsets.only(right: 10),
                        child: InkWell(
                          borderRadius: BorderRadius.circular(16),
                          onTap: () => setState(() => _selectedCategory = filter),
                          child: AnimatedContainer(
                            duration: const Duration(milliseconds: 150),
                            width: 76,
                            height: 76,
                            decoration: BoxDecoration(
                              color: isSelected
                                  ? (isDark ? AppTheme.darkSurface : Colors.white)
                                  : (isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9)),
                              borderRadius: BorderRadius.circular(16),
                              border: Border.all(
                                color: isSelected
                                    ? AppTheme.primary
                                    : (isDark ? Colors.white10 : const Color(0xFFE2E8F0)),
                                width: isSelected ? 2.0 : 1.0,
                              ),
                              boxShadow: isSelected
                                  ? [
                                      BoxShadow(
                                        color: AppTheme.primary.withOpacity(0.2),
                                        blurRadius: 8,
                                        offset: const Offset(0, 3),
                                      ),
                                    ]
                                  : null,
                            ),
                            child: Column(
                              mainAxisAlignment: MainAxisAlignment.center,
                              children: [
                                Text(icon, style: const TextStyle(fontSize: 24)),
                                const SizedBox(height: 4),
                                Text(
                                  name,
                                  style: GoogleFonts.outfit(
                                    fontSize: 10.5,
                                    fontWeight: isSelected ? FontWeight.w800 : FontWeight.w600,
                                    color: isSelected
                                        ? AppTheme.primary
                                        : (isDark ? Colors.white70 : const Color(0xFF475569)),
                                  ),
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                ),
                              ],
                            ),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),

                // 2. BANNERS PROMOCIONALES / FLASH
                if (_banners.isNotEmpty) ...[
                  const SizedBox(height: 18),
                  ..._banners.take(1).map((b) => Container(
                    padding: const EdgeInsets.all(16),
                    decoration: BoxDecoration(
                      gradient: LinearGradient(
                        colors: [
                          _parseHexColor(b.bgGradientStart, fallback: const Color(0xFFF97316)),
                          _parseHexColor(b.bgGradientEnd, fallback: const Color(0xFFEA580C)),
                        ],
                        begin: Alignment.topLeft,
                        end: Alignment.bottomRight,
                      ),
                      borderRadius: BorderRadius.circular(20),
                      boxShadow: [
                        BoxShadow(
                          color: const Color(0xFFEA580C).withOpacity(0.35),
                          blurRadius: 14,
                          offset: const Offset(0, 5),
                        ),
                      ],
                    ),
                    child: Row(
                      children: [
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              if (b.badgeText != null && b.badgeText!.isNotEmpty)
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                  margin: const EdgeInsets.only(bottom: 6),
                                  decoration: BoxDecoration(
                                    color: Colors.white.withOpacity(0.22),
                                    borderRadius: BorderRadius.circular(8),
                                  ),
                                  child: Text(
                                    b.badgeText!,
                                    style: GoogleFonts.outfit(fontSize: 9.5, fontWeight: FontWeight.w800, color: Colors.white),
                                  ),
                                ),
                              Text(
                                b.title,
                                style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w900, color: Colors.white, height: 1.15),
                              ),
                              if (b.subtitle.isNotEmpty) ...[
                                const SizedBox(height: 3),
                                Text(
                                  b.subtitle,
                                  style: GoogleFonts.outfit(fontSize: 11.5, color: Colors.white.withOpacity(0.92)),
                                ),
                              ],
                              const SizedBox(height: 10),
                              Row(
                                children: [
                                  if (b.couponCode != null && b.couponCode!.isNotEmpty)
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3.5),
                                      margin: const EdgeInsets.only(right: 8),
                                      decoration: BoxDecoration(
                                        color: Colors.black.withOpacity(0.25),
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        'Cupón: ${b.couponCode!}',
                                        style: GoogleFonts.outfit(fontSize: 10.5, fontWeight: FontWeight.w800, color: const Color(0xFFFDE047)),
                                      ),
                                    ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
                                    decoration: BoxDecoration(
                                      color: Colors.white,
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      b.buttonText ?? 'Pedir ahora',
                                      style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w800, color: const Color(0xFFEA580C)),
                                    ),
                                  ),
                                ],
                              ),
                            ],
                          ),
                        ),
                        if (b.imageUrl != null && b.imageUrl!.isNotEmpty)
                          ClipRRect(
                            borderRadius: BorderRadius.circular(14),
                            child: Image.network(
                              b.imageUrl!,
                              width: 80,
                              height: 80,
                              fit: BoxFit.cover,
                              errorBuilder: (_, __, ___) => const SizedBox(),
                            ),
                          ),
                      ],
                    ),
                  )),
                ],

                // 3. COMERCIOS DESTACADOS (TOP SELECCIÓN)
                Builder(
                  builder: (_) {
                    final featured = _stores.where((s) => s['isFeatured'] == true || s['is_featured'] == true).toList();
                    if (featured.isEmpty) return const SizedBox.shrink();

                    return Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const SizedBox(height: 20),
                        Row(
                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                          children: [
                            Row(
                              children: [
                                const Text('⭐ ', style: TextStyle(fontSize: 16)),
                                Text(
                                  'Comercios Destacados',
                                  style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w800),
                                ),
                                const SizedBox(width: 8),
                                Container(
                                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                  decoration: BoxDecoration(
                                    color: const Color(0xFFF59E0B).withOpacity(0.15),
                                    borderRadius: BorderRadius.circular(6),
                                  ),
                                  child: Text(
                                    'TOP SELECCIÓN',
                                    style: GoogleFonts.outfit(fontSize: 9, fontWeight: FontWeight.w900, color: const Color(0xFFF59E0B)),
                                  ),
                                ),
                              ],
                            ),
                            Text(
                              '${featured.length} destacados',
                              style: GoogleFonts.outfit(fontSize: 11.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                            ),
                          ],
                        ),
                        const SizedBox(height: 10),
                        SizedBox(
                          height: 185,
                          child: ListView.separated(
                            scrollDirection: Axis.horizontal,
                            itemCount: featured.length,
                            separatorBuilder: (_, __) => const SizedBox(width: 12),
                            itemBuilder: (ctx, fIdx) {
                              final fStore = featured[fIdx];
                              return _buildFeaturedStoreCard(fStore, isDark);
                            },
                          ),
                        ),
                      ],
                    );
                  },
                ),

                const SizedBox(height: 20),

                // Section Header & View switcher (Grid vs List)
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Comercios en Cabudare',
                          style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w700),
                        ),
                        Text(
                          '${_stores.length} disponibles',
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                          ),
                        ),
                      ],
                    ),

                    // 8. STORE VIEW SWITCHER (CARDS vs LIST)
                    Container(
                      decoration: BoxDecoration(
                        color: isDark ? AppTheme.darkSurface : const Color(0xFFF1F5F9),
                        borderRadius: BorderRadius.circular(10),
                        border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                      ),
                      padding: const EdgeInsets.all(2),
                      child: Row(
                        children: [
                          InkWell(
                            onTap: () => setState(() => _isStoreGridView = false),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: !_isStoreGridView ? AppTheme.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(Icons.view_list_rounded, size: 16, color: !_isStoreGridView ? Colors.white : (isDark ? Colors.white70 : const Color(0xFF64748B))),
                            ),
                          ),
                          InkWell(
                            onTap: () => setState(() => _isStoreGridView = true),
                            borderRadius: BorderRadius.circular(8),
                            child: Container(
                              padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                              decoration: BoxDecoration(
                                color: _isStoreGridView ? AppTheme.primary : Colors.transparent,
                                borderRadius: BorderRadius.circular(8),
                              ),
                              child: Icon(Icons.grid_view_rounded, size: 16, color: _isStoreGridView ? Colors.white : (isDark ? Colors.white70 : const Color(0xFF64748B))),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
                const SizedBox(height: 12),

                // 6. SKELETON LOADERS
                if (_isLoadingStores)
                  _buildStoreSkeletons(isDark)
                else ...[
                  ..._filterStores().map((store) {
                    if (_isStoreGridView) {
                      return _buildStoreGridCard(store, isDark);
                    } else {
                      return _buildStoreListCard(store, isDark);
                    }
                  }),
                ],
              ],
            ),
          ),
        ),

        // Floating Cart Bar (if items in cart)
        Positioned(
          left: 16,
          right: 16,
          bottom: 12,
          child: AnimatedBuilder(
            animation: CartService(),
            builder: (context, _) {
              if (cart.items.isEmpty) return const SizedBox.shrink();

              return Container(
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 12),
                decoration: BoxDecoration(
                  gradient: const LinearGradient(
                    colors: [Color(0xFFEA580C), Color(0xFFF97316)],
                  ),
                  borderRadius: BorderRadius.circular(20),
                  boxShadow: [
                    BoxShadow(
                      color: const Color(0xFFEA580C).withOpacity(0.35),
                      blurRadius: 16,
                      offset: const Offset(0, 6),
                    ),
                  ],
                ),
                child: InkWell(
                  onTap: () {
                    showModalBottomSheet(
                      context: context,
                      isScrollControlled: true,
                      backgroundColor: Colors.transparent,
                      builder: (_) => const CheckoutSheet(),
                    );
                  },
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Row(
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: Colors.white.withOpacity(0.2),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: const Icon(Icons.shopping_bag_rounded, color: Colors.white, size: 20),
                          ),
                          const SizedBox(width: 12),
                          Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            mainAxisSize: MainAxisSize.min,
                            children: [
                              Text(
                                '${cart.totalItemCount} productos',
                                style: GoogleFonts.outfit(
                                  fontSize: 14,
                                  fontWeight: FontWeight.w800,
                                  color: Colors.white,
                                ),
                              ),
                              Text(
                                '\$${cart.grandTotal.toStringAsFixed(2)} total',
                                style: GoogleFonts.outfit(
                                  fontSize: 12,
                                  color: Colors.white70,
                                  fontWeight: FontWeight.w600,
                                ),
                              ),
                            ],
                          ),
                        ],
                      ),
                      Row(
                        children: [
                          Text(
                            'Ver Carrito',
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w800,
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(width: 4),
                          const Icon(Icons.chevron_right_rounded, color: Colors.white),
                        ],
                      ),
                    ],
                  ),
                ),
              );
            },
          ),
        ),
      ],
    );
  }

  // --- TAB 1: HISTORIAL DE PEDIDOS REALES ---
  Widget _buildOrdersHistoryTab(bool isDark) {
    final cart = CartService();
    final orders = cart.orderHistory;

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Mis Pedidos Realizados',
                style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: AppTheme.primary.withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${orders.length} pedidos',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: AppTheme.primary,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          if (orders.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.darkSurface : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
              ),
              child: Center(
                child: Column(
                  children: [
                    const Icon(Icons.receipt_long_outlined, size: 48, color: Colors.grey),
                    const SizedBox(height: 12),
                    Text(
                      'No tienes pedidos realizados aún',
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Explora nuestros comercios y confirma tu primer platillo',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => setState(() => _selectedTab = 0),
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                      child: const Text('Explorar Comercios'),
                    ),
                  ],
                ),
              ),
            )
          else
            ...orders.map((order) {
              final isDelivered = order.status == OrderDeliveryStatus.delivered;

              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                padding: const EdgeInsets.all(16),
                decoration: BoxDecoration(
                  color: isDark ? AppTheme.darkSurface : Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: isDelivered ? (isDark ? AppTheme.darkBorder : AppTheme.lightBorder) : AppTheme.primary.withOpacity(0.5),
                    width: isDelivered ? 1.0 : 1.5,
                  ),
                ),
                child: InkWell(
                  onTap: () => _showOrderReceiptDialog(context, order),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        crossAxisAlignment: CrossAxisAlignment.center,
                        children: [
                          Container(
                            padding: const EdgeInsets.all(8),
                            decoration: BoxDecoration(
                              color: (isDelivered ? const Color(0xFF10B981) : AppTheme.primary).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(10),
                            ),
                            child: Icon(
                              isDelivered ? Icons.check_circle_rounded : Icons.moped_rounded,
                              color: isDelivered ? const Color(0xFF10B981) : AppTheme.primary,
                              size: 20,
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Text(
                                  order.merchantName,
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(fontSize: 14.5, fontWeight: FontWeight.w700),
                                ),
                                Text(
                                  order.orderNumber,
                                  style: GoogleFonts.outfit(fontSize: 11.5, color: const Color(0xFF94A3B8)),
                                ),
                              ],
                            ),
                          ),
                          const SizedBox(width: 8),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                            decoration: BoxDecoration(
                              color: (isDelivered ? const Color(0xFF10B981) : AppTheme.primary).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(8),
                              border: Border.all(
                                color: (isDelivered ? const Color(0xFF10B981) : AppTheme.primary).withOpacity(0.3),
                              ),
                            ),
                            child: Text(
                              order.status.shortLabel,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: isDelivered ? const Color(0xFF10B981) : AppTheme.primary,
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      Text(
                        '${order.items.length} items • Total: \$${order.total.toStringAsFixed(2)} • ${order.paymentMethod}',
                        style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        height: 38,
                        child: Row(
                          children: [
                            if (!isDelivered) ...[
                              Expanded(
                                flex: 6,
                                child: ElevatedButton.icon(
                                  onPressed: () => _showOrderTrackingModal(order),
                                  icon: const Icon(Icons.navigation_rounded, size: 15),
                                  label: Text(
                                    'Rastrear en Vivo',
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700),
                                  ),
                                  style: ElevatedButton.styleFrom(
                                    backgroundColor: AppTheme.primary,
                                    foregroundColor: Colors.white,
                                    padding: const EdgeInsets.symmetric(horizontal: 10),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                ),
                              ),
                              const SizedBox(width: 8),
                            ],
                            Expanded(
                              flex: isDelivered ? 1 : 5,
                              child: OutlinedButton.icon(
                                onPressed: () => _showOrderReceiptDialog(context, order),
                                icon: const Icon(Icons.receipt_long_rounded, size: 15),
                                label: Text(
                                  'Ver Detalle',
                                  maxLines: 1,
                                  overflow: TextOverflow.ellipsis,
                                  style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w600),
                                ),
                                style: OutlinedButton.styleFrom(
                                  padding: const EdgeInsets.symmetric(horizontal: 10),
                                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            }),
        ],
      ),
    );
  }

  // --- TAB 2: COMERCIOS FAVORITOS ---
  Widget _buildFavoritesTab(bool isDark) {
    final favIds = widget.sessionService.favoriteStoreIds;
    final favoriteStores = _stores.where((s) => favIds.contains(s['id']?.toString() ?? '')).toList();

    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text(
                'Tus Comercios Favoritos',
                style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w800),
              ),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                decoration: BoxDecoration(
                  color: const Color(0xFFEF4444).withOpacity(0.12),
                  borderRadius: BorderRadius.circular(10),
                ),
                child: Text(
                  '${favoriteStores.length} favoritos',
                  style: GoogleFonts.outfit(
                    fontSize: 12,
                    fontWeight: FontWeight.w700,
                    color: const Color(0xFFEF4444),
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),

          if (favoriteStores.isEmpty)
            Container(
              padding: const EdgeInsets.all(32),
              decoration: BoxDecoration(
                color: isDark ? AppTheme.darkSurface : Colors.white,
                borderRadius: BorderRadius.circular(20),
                border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
              ),
              child: Center(
                child: Column(
                  children: [
                    const Icon(Icons.favorite_border_rounded, size: 48, color: Color(0xFFEF4444)),
                    const SizedBox(height: 12),
                    Text(
                      'No tienes favoritos guardados',
                      style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 6),
                    Text(
                      'Toca el corazón en cualquier comercio para tenerlo siempre a mano',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
                    ),
                    const SizedBox(height: 16),
                    ElevatedButton(
                      onPressed: () => setState(() => _selectedTab = 0),
                      style: ElevatedButton.styleFrom(backgroundColor: AppTheme.primary),
                      child: const Text('Explorar Comercios'),
                    ),
                  ],
                ),
              ),
            )
          else
            ...favoriteStores.map((store) {
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: isDark ? AppTheme.darkSurface : Colors.white,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                ),
                child: ListTile(
                  contentPadding: const EdgeInsets.all(12),
                  leading: ClipRRect(
                    borderRadius: BorderRadius.circular(12),
                    child: Image.network(
                      store['imageUrl'],
                      width: 56,
                      height: 56,
                      fit: BoxFit.cover,
                    ),
                  ),
                  title: Text(
                    store['name'],
                    style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
                  ),
                  subtitle: Text(
                    '${store['category']} • Envío ${store['fee']}',
                    style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                  ),
                  trailing: IconButton(
                    icon: const Icon(Icons.favorite_rounded, color: Color(0xFFEF4444)),
                    onPressed: () async {
                      await widget.sessionService.toggleFavorite(store['id']?.toString() ?? '');
                      if (mounted) setState(() {});
                    },
                  ),
                  onTap: () {
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
            }),
        ],
      ),
    );
  }

  List<Map<String, dynamic>> _filterStores() {
    return _stores.where((store) {
      final selectedAddr = CartService().selectedAddress;
      final storeLat = (store['lat'] as num?)?.toDouble() ?? (store['latitude'] as num?)?.toDouble();
      final storeLng = (store['lng'] as num?)?.toDouble() ?? (store['longitude'] as num?)?.toDouble();
      final maxRadius = (store['delivery_radius_km'] as num?)?.toDouble() ?? (store['deliveryRadiusKm'] as num?)?.toDouble() ?? 8.0;
      if (storeLat != null && storeLng != null && storeLat != 0 && storeLng != 0) {
        final dist = ApiService.calculateDistanceKm(storeLat, storeLng, selectedAddr.latitude, selectedAddr.longitude);
        if (dist > maxRadius) {
          return false;
        }
      }

      if (_selectedCategory == 'Todos') return true;
      final storeCat = (store['category'] ?? '').toString().toLowerCase();
      final storeName = (store['name'] ?? '').toString().toLowerCase();
      final target = _selectedCategory.toLowerCase();
      if (target == 'comida') {
        return storeCat.contains('hamburguesa') ||
            storeCat.contains('sushi') ||
            storeCat.contains('pizza') ||
            storeCat.contains('comida') ||
            storeCat.contains('grill') ||
            storeCat.contains('restauran');
      }
      if (target == 'farmacias') {
        return storeCat.contains('farma') || storeCat.contains('salud') || storeName.contains('farma');
      }
      if (target == 'markets') {
        return storeCat.contains('market') || storeCat.contains('super') || storeName.contains('market');
      }
      if (target == 'repuestos') {
        return storeCat.contains('repuesto') || storeCat.contains('moto') || storeCat.contains('auto');
      }
      if (target == 'juguetes') {
        return storeCat.contains('juguete') || storeCat.contains('regalo') || storeCat.contains('niño');
      }
      if (target == 'tecnología') {
        return storeCat.contains('tecno') || storeCat.contains('comput') || storeCat.contains('celul');
      }
      if (target == 'mascotas') {
        return storeCat.contains('mascota') || storeCat.contains('veterin');
      }
      if (target == 'licores') {
        return storeCat.contains('licor') || storeCat.contains('vino') || storeCat.contains('cerveza') || storeCat.contains('bodega');
      }
      if (target == 'postres') {
        return storeCat.contains('postre') || storeCat.contains('dulce') || storeCat.contains('helado') || storeCat.contains('panad');
      }
      return storeCat.contains(target) || storeName.contains(target);
    }).toList();
  }

  Future<void> _openStore(Map<String, dynamic> store) async {
    final rawBranches = store['branches'];
    List<Branch> branches = [];
    if (rawBranches is List) {
      branches = rawBranches
          .map((b) => b is Branch ? b : Branch.fromJson(b as Map<String, dynamic>))
          .toList();
    }
    if (branches.isEmpty) {
      final fetched = await ApiService().fetchBranchesForCompany(store['id']?.toString() ?? '');
      if (fetched.isNotEmpty) branches = fetched;
    }
    branches = branches.where((b) => b.status == 'active').toList();

    if (!mounted) return;

    if (branches.length > 1) {
      final userAddr = CartService().selectedAddress;
      final selected = await BranchSelectorBottomSheet.show(
        context: context,
        companyName: store['name'] ?? 'Comercio',
        branches: branches,
        userLat: userAddr.latitude,
        userLng: userAddr.longitude,
      );
      if (selected != null && mounted) {
        Navigator.push(
          context,
          MaterialPageRoute(
            builder: (_) => StoreDetailScreen(
              storeData: store,
              sessionService: widget.sessionService,
              initialBranch: selected,
            ),
          ),
        );
      }
    } else {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => StoreDetailScreen(
            storeData: store,
            sessionService: widget.sessionService,
            initialBranch: branches.isNotEmpty ? branches.first : null,
          ),
        ),
      );
    }
  }

  Widget _buildFeaturedStoreCard(Map<String, dynamic> store, bool isDark) {
    final isOpen = _isStoreOpenNow(store);
    return InkWell(
      borderRadius: BorderRadius.circular(16),
      onTap: () => _openStore(store),
      child: Container(
        width: 220,
        decoration: BoxDecoration(
          color: isDark ? AppTheme.darkSurface : Colors.white,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
              blurRadius: 8,
              offset: const Offset(0, 3),
            ),
          ],
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Stack(
              children: [
                ClipRRect(
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
                  child: Image.network(
                    store['imageUrl'] ?? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
                    height: 95,
                    width: double.infinity,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(height: 95, color: Colors.grey.shade300),
                  ),
                ),
                Positioned(
                  top: 8,
                  left: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: const Color(0xFFF59E0B),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      'TOP SELECCIÓN',
                      style: GoogleFonts.outfit(fontSize: 8.5, fontWeight: FontWeight.w900, color: Colors.white),
                    ),
                  ),
                ),
                Positioned(
                  top: 8,
                  right: 8,
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                    decoration: BoxDecoration(
                      color: isOpen ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                      borderRadius: BorderRadius.circular(6),
                    ),
                    child: Text(
                      isOpen ? 'Abierto' : 'Cerrado',
                      style: GoogleFonts.outfit(fontSize: 8.5, fontWeight: FontWeight.w800, color: Colors.white),
                    ),
                  ),
                ),
              ],
            ),
            Padding(
              padding: const EdgeInsets.all(10),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    store['name'] ?? 'Comercio',
                    style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700),
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                  ),
                  const SizedBox(height: 3),
                  Row(
                    children: [
                      const Icon(Icons.star_rounded, size: 14, color: AppTheme.amberAccent),
                      const SizedBox(width: 3),
                      Text(
                        store['rating']?.toString() ?? '4.9',
                        style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w700),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        store['category'] ?? 'Restaurante',
                        style: GoogleFonts.outfit(fontSize: 10.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildStoreGridCard(Map<String, dynamic> store, bool isDark) {
    final isOpen = _isStoreOpenNow(store);
    final isFav = widget.sessionService.isFavorite(store['id']?.toString() ?? '');
    final selectedAddr = CartService().selectedAddress;
    final sLat = (store['lat'] as num?)?.toDouble() ?? (store['latitude'] as num?)?.toDouble();
    final sLng = (store['lng'] as num?)?.toDouble() ?? (store['longitude'] as num?)?.toDouble();
    final storeDist = (sLat != null && sLng != null && sLat != 0 && sLng != 0)
        ? ApiService.calculateDistanceKm(sLat, sLng, selectedAddr.latitude, selectedAddr.longitude)
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _openStore(store),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Stack(
                children: [
                  ClipRRect(
                    borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
                    child: Image.network(
                      store['imageUrl'] ?? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
                      height: 120,
                      width: double.infinity,
                      fit: BoxFit.cover,
                      errorBuilder: (_, __, ___) => Container(height: 120, color: Colors.grey.shade300),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    left: 8,
                    child: Container(
                      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 3),
                      decoration: BoxDecoration(
                        color: isOpen ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                        borderRadius: BorderRadius.circular(6),
                      ),
                      child: Text(
                        isOpen ? '🟢 Abierto' : '🔴 Cerrado',
                        style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                    ),
                  ),
                  Positioned(
                    top: 8,
                    right: 8,
                    child: Container(
                      decoration: const BoxDecoration(
                        color: Color(0x99000000),
                        shape: BoxShape.circle,
                      ),
                      child: IconButton(
                        constraints: const BoxConstraints(minWidth: 32, minHeight: 32),
                        padding: EdgeInsets.zero,
                        icon: Icon(
                          isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                          color: isFav ? const Color(0xFFEF4444) : Colors.white,
                          size: 18,
                        ),
                        onPressed: () async {
                          await widget.sessionService.toggleFavorite(store['id']?.toString() ?? '');
                          if (mounted) setState(() {});
                        },
                      ),
                    ),
                  ),
                ],
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      store['name'] ?? 'Comercio',
                      style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 3),
                    Row(
                      children: [
                        const Icon(Icons.star_rounded, size: 14, color: AppTheme.amberAccent),
                        const SizedBox(width: 3),
                        Text(
                          store['rating']?.toString() ?? '4.8',
                          style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700),
                        ),
                        const SizedBox(width: 10),
                        Text(
                          store['category'] ?? 'Restaurante',
                          style: GoogleFonts.outfit(fontSize: 11.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                        ),
                        if (storeDist != null) ...[
                          const Spacer(),
                          Text(
                            '${storeDist.toStringAsFixed(1)} km',
                            style: GoogleFonts.outfit(fontSize: 11.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                          ),
                        ],
                      ],
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

  Widget _buildStoreListCard(Map<String, dynamic> store, bool isDark) {
    final isOpen = _isStoreOpenNow(store);
    final isFav = widget.sessionService.isFavorite(store['id']?.toString() ?? '');
    final selectedAddr = CartService().selectedAddress;
    final sLat = (store['lat'] as num?)?.toDouble() ?? (store['latitude'] as num?)?.toDouble();
    final sLng = (store['lng'] as num?)?.toDouble() ?? (store['longitude'] as num?)?.toDouble();
    final storeDist = (sLat != null && sLng != null && sLat != 0 && sLng != 0)
        ? ApiService.calculateDistanceKm(sLat, sLng, selectedAddr.latitude, selectedAddr.longitude)
        : null;

    return Container(
      margin: const EdgeInsets.only(bottom: 12),
      decoration: BoxDecoration(
        color: isDark ? AppTheme.darkSurface : Colors.white,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
            blurRadius: 8,
            offset: const Offset(0, 3),
          ),
        ],
      ),
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          borderRadius: BorderRadius.circular(16),
          onTap: () => _openStore(store),
          child: Padding(
            padding: const EdgeInsets.all(12),
            child: Row(
              children: [
                ClipRRect(
                  borderRadius: BorderRadius.circular(12),
                  child: Image.network(
                    store['imageUrl'] ?? 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
                    width: 72,
                    height: 72,
                    fit: BoxFit.cover,
                    errorBuilder: (_, __, ___) => Container(width: 72, height: 72, color: Colors.grey.shade300),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        mainAxisAlignment: MainAxisAlignment.spaceBetween,
                        children: [
                          Expanded(
                            child: Text(
                              store['name'] ?? 'Comercio',
                              style: GoogleFonts.outfit(fontSize: 15, fontWeight: FontWeight.w700),
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                            ),
                          ),
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                            decoration: BoxDecoration(
                              color: isOpen ? const Color(0xFF10B981).withOpacity(0.12) : const Color(0xFFEF4444).withOpacity(0.12),
                              borderRadius: BorderRadius.circular(6),
                            ),
                            child: Text(
                              isOpen ? 'Abierto' : 'Cerrado',
                              style: GoogleFonts.outfit(
                                fontSize: 9.5,
                                fontWeight: FontWeight.w800,
                                color: isOpen ? const Color(0xFF10B981) : const Color(0xFFEF4444),
                              ),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 3),
                      Text(
                        store['category'] ?? 'Restaurante',
                        style: GoogleFonts.outfit(fontSize: 11.5, color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B)),
                      ),
                      const SizedBox(height: 6),
                      Row(
                        children: [
                          const Icon(Icons.star_rounded, size: 14, color: AppTheme.amberAccent),
                          const SizedBox(width: 3),
                          Text(
                            store['rating']?.toString() ?? '4.8',
                            style: GoogleFonts.outfit(fontSize: 11.5, fontWeight: FontWeight.w700),
                          ),
                          if (storeDist != null) ...[
                            const SizedBox(width: 10),
                            const Icon(Icons.navigation_rounded, size: 12, color: Colors.grey),
                            const SizedBox(width: 2),
                            Text(
                              '${storeDist.toStringAsFixed(1)} km',
                              style: GoogleFonts.outfit(fontSize: 11, color: Colors.grey),
                            ),
                          ],
                        ],
                      ),
                    ],
                  ),
                ),
                IconButton(
                  icon: Icon(
                    isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                    color: isFav ? const Color(0xFFEF4444) : (isDark ? Colors.white38 : Colors.grey.shade400),
                    size: 20,
                  ),
                  onPressed: () async {
                    await widget.sessionService.toggleFavorite(store['id']?.toString() ?? '');
                    if (mounted) setState(() {});
                  },
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildStoreSkeletons(bool isDark) {
    return Column(
      children: List.generate(3, (idx) {
        return Container(
          margin: const EdgeInsets.only(bottom: 14),
          height: 180,
          decoration: BoxDecoration(
            color: isDark ? AppTheme.darkSurface : const Color(0xFFF1F5F9),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                height: 110,
                decoration: BoxDecoration(
                  color: isDark ? Colors.white10 : const Color(0xFFE2E8F0),
                  borderRadius: const BorderRadius.vertical(top: Radius.circular(15)),
                ),
              ),
              Padding(
                padding: const EdgeInsets.all(12),
                child: Row(
                  children: [
                    Container(
                      width: 120,
                      height: 14,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white10 : const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                    const Spacer(),
                    Container(
                      width: 40,
                      height: 14,
                      decoration: BoxDecoration(
                        color: isDark ? Colors.white10 : const Color(0xFFE2E8F0),
                        borderRadius: BorderRadius.circular(4),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      }),
    );
  }

}
