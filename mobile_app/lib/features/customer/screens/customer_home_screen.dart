import 'dart:async';
import 'package:flutter/material.dart';
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
  Timer? _liveOrdersSyncTimer;

  List<Map<String, dynamic>> _stores = [];

  @override
  void initState() {
    super.initState();
    _loadTenants();
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

                // Categories list
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: [
                      'Todos',
                      'Comida',
                      'Farmacias',
                      'Markets',
                      'Repuestos',
                      'Juguetes',
                      'Tecnología',
                      'Mascotas'
                    ].map((cat) {
                      final isSelected = _selectedCategory == cat;
                      return Padding(
                        padding: const EdgeInsets.only(right: 8),
                        child: FilterChip(
                          selected: isSelected,
                          label: Text(cat),
                          labelStyle: GoogleFonts.outfit(
                            fontSize: 12,
                            fontWeight: isSelected ? FontWeight.w700 : FontWeight.w500,
                            color: isSelected ? Colors.white : (isDark ? Colors.white70 : const Color(0xFF334155)),
                          ),
                          backgroundColor: isDark ? AppTheme.darkSurface : const Color(0xFFF1F5F9),
                          selectedColor: AppTheme.primary,
                          shape: RoundedRectangleBorder(
                            borderRadius: BorderRadius.circular(12),
                            side: BorderSide(
                              color: isSelected
                                  ? AppTheme.primary
                                  : (isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                            ),
                          ),
                          onSelected: (val) {
                            setState(() => _selectedCategory = cat);
                          },
                        ),
                      );
                    }).toList(),
                  ),
                ),

                const SizedBox(height: 20),

                // Section Header
                Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
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
                if (_isLoadingStores)
                  const Padding(
                    padding: EdgeInsets.symmetric(vertical: 8),
                    child: LinearProgressIndicator(color: AppTheme.primary, minHeight: 2),
                  ),
                const SizedBox(height: 12),

                ..._stores.where((store) {
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
                  return storeCat.contains(target) || storeName.contains(target);
                }).map((store) {
                  final isFav = widget.sessionService.isFavorite(store['id']?.toString() ?? '');
                  final selectedAddr = CartService().selectedAddress;
                  final dynamicDeliveryTime = ApiService.calculateDeliveryTime(
                    store['lat'],
                    store['lng'],
                    selectedAddr.latitude,
                    selectedAddr.longitude,
                  );

                  return Container(
                    margin: const EdgeInsets.only(bottom: 14),
                    decoration: BoxDecoration(
                      color: isDark ? AppTheme.darkSurface : Colors.white,
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                      boxShadow: [
                        BoxShadow(
                          color: Colors.black.withOpacity(isDark ? 0.2 : 0.04),
                          blurRadius: 12,
                          offset: const Offset(0, 4),
                        ),
                      ],
                    ),
                    child: Material(
                      color: Colors.transparent,
                      child: InkWell(
                        borderRadius: BorderRadius.circular(20),
                        onTap: () async {
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
                          // Filtrar estrictamente solo sucursales activas para clientes (nunca inactivas o pendientes)
                          branches = branches
                              .where((b) => b.status == 'active')
                              .toList();

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
                        },
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Stack(
                              children: [
                                ClipRRect(
                                  borderRadius: const BorderRadius.vertical(top: Radius.circular(19)),
                                  child: Image.network(
                                    store['imageUrl'],
                                    height: 140,
                                    width: double.infinity,
                                    fit: BoxFit.cover,
                                  ),
                                ),
                                if (store['isPromo'] == true)
                                  Positioned(
                                    top: 10,
                                    left: 10,
                                    child: Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                      decoration: BoxDecoration(
                                        color: AppTheme.primary,
                                        borderRadius: BorderRadius.circular(8),
                                      ),
                                      child: Text(
                                        store['promoText'] ?? 'Envío garantizado',
                                        style: GoogleFonts.outfit(
                                          color: Colors.white,
                                          fontSize: 10.5,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ),
                                Positioned(
                                  top: 10,
                                  right: 10,
                                  child: Container(
                                    decoration: const BoxDecoration(
                                      color: Color(0x99000000),
                                      shape: BoxShape.circle,
                                    ),
                                    child: IconButton(
                                      icon: Icon(
                                        isFav ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                                        color: isFav ? const Color(0xFFEF4444) : Colors.white,
                                        size: 20,
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
                              padding: const EdgeInsets.all(14),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Text(
                                          store['name'],
                                          style: GoogleFonts.outfit(fontSize: 16, fontWeight: FontWeight.w700),
                                        ),
                                      ),
                                      Row(
                                        children: [
                                          const Icon(Icons.star_rounded, size: 16, color: AppTheme.amberAccent),
                                          const SizedBox(width: 3),
                                          Text(
                                            store['rating']?.toString() ?? '4.8',
                                            style: GoogleFonts.outfit(fontSize: 13, fontWeight: FontWeight.w700),
                                          ),
                                          if (store['reviewsCount'] != null) ...[
                                            const SizedBox(width: 3),
                                            Text(
                                              '(${store['reviewsCount']})',
                                              style: GoogleFonts.outfit(
                                                fontSize: 11,
                                                color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 2),
                                  Text(
                                    store['category'] ?? 'Restaurante',
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      color: isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B),
                                    ),
                                  ),
                                  const SizedBox(height: 8),
                                  Row(
                                    children: [
                                      const Icon(Icons.access_time_rounded, size: 14, color: Colors.grey),
                                      const SizedBox(width: 4),
                                      Text(
                                        dynamicDeliveryTime,
                                        style: GoogleFonts.outfit(fontSize: 11.5, color: Colors.grey),
                                      ),
                                      const SizedBox(width: 14),
                                      const Icon(Icons.delivery_dining_rounded, size: 15, color: Colors.grey),
                                      const SizedBox(width: 4),
                                      Text(
                                        'Envío: ${store['fee'] ?? "\$2.50"}',
                                        style: GoogleFonts.outfit(fontSize: 11.5, color: Colors.grey),
                                      ),
                                      if (store['branches'] is List && (store['branches'] as List).length > 1) ...[
                                        const SizedBox(width: 14),
                                        const Icon(Icons.storefront_rounded, size: 14, color: AppTheme.primary),
                                        const SizedBox(width: 4),
                                        Text(
                                          '${(store['branches'] as List).length} sedes',
                                          style: GoogleFonts.outfit(
                                            fontSize: 11.5,
                                            color: AppTheme.primary,
                                            fontWeight: FontWeight.w700,
                                          ),
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
                }),
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
}
