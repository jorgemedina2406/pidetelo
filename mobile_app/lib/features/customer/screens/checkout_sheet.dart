import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/models/order_model.dart';
import '../../../core/services/cart_service.dart';
import '../../../core/services/session_service.dart';
import '../../../core/theme/app_theme.dart';
import 'order_success_screen.dart';
import 'map_address_picker_screen.dart';

class CheckoutSheet extends StatefulWidget {
  const CheckoutSheet({super.key});

  @override
  State<CheckoutSheet> createState() => _CheckoutSheetState();
}

class _CheckoutSheetState extends State<CheckoutSheet> {
  String _selectedPayment = 'pago_movil';
  final TextEditingController _notesController = TextEditingController();
  final TextEditingController _cashAmountController = TextEditingController();
  final TextEditingController _cashBsAmountController = TextEditingController();
  final TextEditingController _pagoMovilRefController = TextEditingController();
  final TextEditingController _zelleRefController = TextEditingController();

  @override
  void dispose() {
    _notesController.dispose();
    _cashAmountController.dispose();
    _cashBsAmountController.dispose();
    _pagoMovilRefController.dispose();
    _zelleRefController.dispose();
    super.dispose();
  }

  void _showAddressPicker(BuildContext context, CartService cart) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final modalBg = isDark ? const Color(0xFF0F172A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569);
    final cardBg = isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9);
    final cardBorder = isDark ? Colors.white12 : const Color(0xFFCBD5E1);
    showModalBottomSheet(
      context: context,
      backgroundColor: modalBg,
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(24)),
      ),
      builder: (ctx) => Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Text(
                  'Mis Direcciones Guardadas',
                  style: GoogleFonts.outfit(
                    fontSize: 18,
                    fontWeight: FontWeight.w800,
                    color: textColor,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(ctx),
                  icon: Icon(Icons.close_rounded, color: subtextColor),
                ),
              ],
            ),
            const SizedBox(height: 16),
            ...cart.savedAddresses.map((addr) {
              final isSelected = addr.id == cart.selectedAddress.id;
              return Container(
                margin: const EdgeInsets.only(bottom: 12),
                decoration: BoxDecoration(
                  color: isSelected
                      ? AppTheme.primary.withOpacity(0.12)
                      : cardBg,
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? AppTheme.primary : cardBorder,
                    width: isSelected ? 1.5 : 1.0,
                  ),
                ),
                child: ListTile(
                  leading: Icon(
                    addr.title.toLowerCase().contains('casa')
                        ? Icons.home_rounded
                        : Icons.business_rounded,
                    color: isSelected ? AppTheme.primary : subtextColor,
                  ),
                  title: Text(
                    addr.title,
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: textColor,
                    ),
                  ),
                  subtitle: Text(
                    '${addr.address}\n${addr.reference ?? ''}',
                    style: GoogleFonts.outfit(
                        fontSize: 12, color: subtextColor),
                  ),
                  trailing: isSelected
                      ? const Icon(Icons.check_circle_rounded,
                          color: AppTheme.primary)
                      : null,
                  onTap: () {
                    cart.selectAddress(addr);
                    Navigator.pop(ctx);
                  },
                ),
              );
            }),
            const SizedBox(height: 8),
            ElevatedButton.icon(
              onPressed: () async {
                Navigator.pop(ctx);
                final newAddr = await Navigator.push<DeliveryAddress>(
                  context,
                  MaterialPageRoute(
                      builder: (_) => const MapAddressPickerScreen()),
                );
                if (newAddr != null) {
                  await cart.addSavedAddress(newAddr);
                }
              },
              icon: const Icon(Icons.add_location_alt_rounded),
              label: const Text('Fijar Nueva Dirección en el Mapa'),
              style: ElevatedButton.styleFrom(
                backgroundColor: AppTheme.primary,
                foregroundColor: Colors.white,
                minimumSize: const Size(double.infinity, 48),
                shape: RoundedRectangleBorder(
                    borderRadius: BorderRadius.circular(14)),
              ),
            ),
          ],
        ),
      ),
    );
  }

  void _confirmOrder(BuildContext context, CartService cart) {
    if (cart.items.isEmpty) return;

    if (cart.currentBranch != null && !cart.currentBranch!.isOpenRightNow) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'El comercio está cerrado en este momento (Abre a las ${cart.currentBranch!.businessHoursOpen}). No es posible procesar pedidos ahora.',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
          ),
          backgroundColor: const Color(0xFFEF4444),
          duration: const Duration(seconds: 4),
          behavior: SnackBarBehavior.floating,
        ),
      );
      return;
    }

    if (cart.isOutOfCoverage) {
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
              'Tu dirección está a ${cart.distanceToCurrentBranchKm ?? 0} km, fuera de la zona de cobertura.'),
          backgroundColor: Colors.redAccent,
        ),
      );
      return;
    }

    String paymentLabel = 'Pago Móvil';
    if (_selectedPayment == 'pago_movil') {
      paymentLabel = _pagoMovilRefController.text.isNotEmpty
          ? 'Pago Móvil (Ref: ${_pagoMovilRefController.text.trim()})'
          : 'Pago Móvil';
    } else if (_selectedPayment == 'cash_usd') {
      paymentLabel = _cashAmountController.text.isNotEmpty
          ? 'Efectivo \$ USD (Paga con \$${_cashAmountController.text.trim()})'
          : 'Efectivo \$ USD (Exacto)';
    } else if (_selectedPayment == 'cash_local') {
      paymentLabel = _cashBsAmountController.text.isNotEmpty
          ? 'Efectivo Bs. (Paga con Bs. ${_cashBsAmountController.text.trim()})'
          : 'Efectivo Bs. (Exacto)';
    } else if (_selectedPayment == 'zelle') {
      paymentLabel = _zelleRefController.text.isNotEmpty
          ? 'Zelle Directo (Ref/Titular: ${_zelleRefController.text.trim()})'
          : 'Zelle Directo';
    } else if (_selectedPayment == 'card_terminal') {
      paymentLabel = 'Punto de Venta (Tarjeta al recibir)';
    } else if (_selectedPayment == 'efectivo') {
      paymentLabel = _cashAmountController.text.isNotEmpty
          ? 'Efectivo (Paga con \$${_cashAmountController.text.trim()})'
          : 'Efectivo exacto';
    } else if (_selectedPayment == 'tarjeta') {
      paymentLabel = 'Tarjeta / Zelle';
    }

    cart.createOrderFromCart(
      paymentMethod: paymentLabel,
      user: SessionService().currentUser,
      notes: _notesController.text.isNotEmpty ? _notesController.text : null,
    );

    Navigator.pop(context); // Close checkout sheet

    final newOrder = cart.activeOrder;
    if (newOrder != null) {
      Navigator.push(
        context,
        MaterialPageRoute(
          builder: (_) => OrderSuccessScreen(order: newOrder),
        ),
      );
    }
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: CartService(),
      builder: (context, _) {
        final cart = CartService();
        final isDark = Theme.of(context).brightness == Brightness.dark;
        final sheetBg = isDark ? const Color(0xFF0F172A) : Colors.white;
        final cardBg = isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC);
        final cardBorder = isDark ? Colors.white12 : const Color(0xFFE2E8F0);
        final dividerColor = isDark ? Colors.white10 : const Color(0xFFE2E8F0);
        final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
        final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);
        final inputFill = isDark ? const Color(0xFF1E293B) : Colors.white;
        final inputBorder = isDark ? Colors.white12 : const Color(0xFFCBD5E1);
        final handleColor = isDark ? Colors.white24 : const Color(0xFFCBD5E1);
        final darkBoxBg = isDark ? const Color(0xFF0F172A) : const Color(0xFFF1F5F9);

        return Container(
          height: MediaQuery.of(context).size.height * 0.88,
          decoration: BoxDecoration(
            color: sheetBg,
            borderRadius: const BorderRadius.vertical(top: Radius.circular(30)),
          ),
          child: Column(
            children: [
              // Top bar
              const SizedBox(height: 12),
              Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: handleColor,
                  borderRadius: BorderRadius.circular(10),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(20, 16, 20, 12),
                child: Row(
                  mainAxisAlignment: MainAxisAlignment.spaceBetween,
                  children: [
                    Text(
                      'Tu Pedido (${cart.totalItemCount})',
                      style: GoogleFonts.outfit(
                        fontSize: 20,
                        fontWeight: FontWeight.w800,
                        color: textColor,
                      ),
                    ),
                    if (cart.items.isNotEmpty)
                      TextButton(
                        onPressed: cart.clearCart,
                        child: Text(
                          'Vaciar',
                          style: GoogleFonts.outfit(
                            color: const Color(0xFFEF4444),
                            fontWeight: FontWeight.w600,
                          ),
                        ),
                      ),
                  ],
                ),
              ),
              Divider(color: dividerColor, height: 1),

              // Content
              Expanded(
                child: cart.items.isEmpty
                    ? Center(
                        child: Column(
                          mainAxisAlignment: MainAxisAlignment.center,
                          children: [
                            const Icon(
                              Icons.shopping_basket_outlined,
                              size: 64,
                              color: Colors.white24,
                            ),
                            // SUGERENCIAS CROSS-SELLING
                          if (cart.suggestedProducts.isNotEmpty) ...[
                            Row(
                              children: [
                                const Icon(Icons.auto_awesome, size: 16, color: AppTheme.amberAccent),
                                const SizedBox(width: 6),
                                Text(
                                  '¿Deseas acompañar tu pedido?',
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w700,
                                    color: textColor,
                                  ),
                                ),
                              ],
                            ),
                            const SizedBox(height: 8),
                            SizedBox(
                              height: 92,
                              child: ListView.separated(
                                scrollDirection: Axis.horizontal,
                                itemCount: cart.suggestedProducts.length,
                                separatorBuilder: (_, __) => const SizedBox(width: 10),
                                itemBuilder: (ctx, sIdx) {
                                  final sug = cart.suggestedProducts[sIdx];
                                  return Container(
                                    width: 190,
                                    padding: const EdgeInsets.all(8),
                                    decoration: BoxDecoration(
                                      color: cardBg,
                                      borderRadius: BorderRadius.circular(14),
                                      border: Border.all(color: cardBorder),
                                    ),
                                    child: Row(
                                      children: [
                                        ClipRRect(
                                          borderRadius: BorderRadius.circular(10),
                                          child: Image.network(
                                            sug.imageUrl,
                                            width: 52,
                                            height: 52,
                                            fit: BoxFit.cover,
                                            errorBuilder: (_, __, ___) => Container(
                                              width: 52,
                                              height: 52,
                                              color: const Color(0xFF334155),
                                              child: const Icon(Icons.fastfood, size: 20, color: Colors.white30),
                                            ),
                                          ),
                                        ),
                                        const SizedBox(width: 8),
                                        Expanded(
                                          child: Column(
                                            mainAxisAlignment: MainAxisAlignment.center,
                                            crossAxisAlignment: CrossAxisAlignment.start,
                                            children: [
                                              Text(
                                                sug.name,
                                                style: GoogleFonts.outfit(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w700,
                                                  color: textColor,
                                                ),
                                                maxLines: 1,
                                                overflow: TextOverflow.ellipsis,
                                              ),
                                              Text(
                                                '\$${sug.price.toStringAsFixed(2)}',
                                                style: GoogleFonts.outfit(
                                                  fontSize: 11.5,
                                                  fontWeight: FontWeight.w800,
                                                  color: AppTheme.primary,
                                                ),
                                              ),
                                              const SizedBox(height: 4),
                                              InkWell(
                                                onTap: () => cart.addItem(sug, quantity: 1),
                                                child: Container(
                                                  padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2.5),
                                                  decoration: BoxDecoration(
                                                    color: AppTheme.primary,
                                                    borderRadius: BorderRadius.circular(6),
                                                  ),
                                                  child: Text(
                                                    '+ Agregar',
                                                    style: GoogleFonts.outfit(
                                                      fontSize: 10,
                                                      fontWeight: FontWeight.w800,
                                                      color: Colors.white,
                                                    ),
                                                  ),
                                                ),
                                              ),
                                            ],
                                          ),
                                        ),
                                      ],
                                    ),
                                  );
                                },
                              ),
                            ),
                            const SizedBox(height: 14),
                          ],

                          if (cart.currentBranch != null && !cart.currentBranch!.isOpenRightNow) ...[
                            Container(
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFFEF4444).withOpacity(0.15),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.5)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.access_time_filled_rounded, color: Color(0xFFEF4444), size: 20),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Text(
                                      'Comercio cerrado en este momento. Horario de atención: ${cart.currentBranch!.businessHoursOpen} a ${cart.currentBranch!.businessHoursClose}.',
                                      style: GoogleFonts.outfit(
                                        color: Colors.white,
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 16),
                            Text(
                              'El carrito está vacío',
                              style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: textColor,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Agrega platillos deliciosos para comenzar',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                color: subtextColor,
                              ),
                            ),
                          ],
                        ),
                      )
                    : ListView(
                        padding: const EdgeInsets.symmetric(
                            horizontal: 20, vertical: 16),
                        children: [
                          // 0. Active Branch Header (Multi-Sucursal & Direct Payment Notice)
                          if (cart.currentBranchName != null ||
                              cart.currentStoreName != null) ...[
                            Container(
                              margin: const EdgeInsets.only(bottom: 14),
                              padding: const EdgeInsets.symmetric(
                                  horizontal: 14, vertical: 10),
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                    color: AppTheme.primary.withOpacity(0.35)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.storefront_rounded,
                                      color: AppTheme.primary, size: 22),
                                  const SizedBox(width: 10),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          cart.currentBranchName ??
                                              cart.currentStoreName ??
                                              'Comercio',
                                          style: GoogleFonts.outfit(
                                            fontSize: 13.5,
                                            fontWeight: FontWeight.w700,
                                            color: textColor,
                                          ),
                                        ),
                                        if (cart.currentBranchAddress != null)
                                          Text(
                                            cart.currentBranchAddress!,
                                            style: GoogleFonts.outfit(
                                              fontSize: 11,
                                              color: subtextColor,
                                            ),
                                            maxLines: 1,
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                      ],
                                    ),
                                  ),
                                  Container(
                                    padding: const EdgeInsets.symmetric(
                                        horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF10B981)
                                          .withOpacity(0.15),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      '0% COMISIÓN',
                                      style: GoogleFonts.outfit(
                                        fontSize: 9.5,
                                        fontWeight: FontWeight.w800,
                                        color: const Color(0xFF10B981),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          // 1. Items List
                          ...cart.items.asMap().entries.map((entry) {
                            final idx = entry.key;
                            final item = entry.value;

                            return Container(
                              margin: const EdgeInsets.only(bottom: 12),
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: cardBg,
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: cardBorder),
                              ),
                              child: Row(
                                children: [
                                  ClipRRect(
                                    borderRadius: BorderRadius.circular(12),
                                    child: Image.network(
                                      item.product.imageUrl,
                                      width: 60,
                                      height: 60,
                                      fit: BoxFit.cover,
                                      errorBuilder: (_, __, ___) => Container(
                                        width: 60,
                                        height: 60,
                                        color: const Color(0xFF334155),
                                        child: const Icon(
                                          Icons.fastfood_rounded,
                                          color: Colors.white54,
                                        ),
                                      ),
                                    ),
                                  ),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment:
                                          CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          item.product.name,
                                          style: GoogleFonts.outfit(
                                            fontSize: 14.5,
                                            fontWeight: FontWeight.w700,
                                            color: textColor,
                                          ),
                                        ),
                                        if (item.notes != null &&
                                            item.notes!.isNotEmpty)
                                          Text(
                                            'Nota: ${item.notes}',
                                            style: GoogleFonts.outfit(
                                              fontSize: 11.5,
                                              color: AppTheme.amberAccent,
                                            ),
                                          ),
                                        Text(
                                          '\$${item.totalPrice.toStringAsFixed(2)}',
                                          style: GoogleFonts.outfit(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w800,
                                            color: AppTheme.primary,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                  // Quantity controls
                                  Container(
                                    decoration: BoxDecoration(
                                      color: darkBoxBg,
                                      borderRadius: BorderRadius.circular(12),
                                      border: Border.all(color: cardBorder),
                                    ),
                                    child: Row(
                                      children: [
                                        IconButton(
                                          icon: const Icon(Icons.remove,
                                              size: 16),
                                          onPressed: () =>
                                              cart.updateQuantity(idx, -1),
                                          constraints: const BoxConstraints(
                                            minWidth: 32,
                                            minHeight: 32,
                                          ),
                                          padding: EdgeInsets.zero,
                                          color: textColor,
                                        ),
                                        Text(
                                          '${item.quantity}',
                                          style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.w800,
                                            color: textColor,
                                          ),
                                        ),
                                        IconButton(
                                          icon: const Icon(Icons.add, size: 16),
                                          onPressed: () =>
                                              cart.updateQuantity(idx, 1),
                                          constraints: const BoxConstraints(
                                            minWidth: 32,
                                            minHeight: 32,
                                          ),
                                          padding: EdgeInsets.zero,
                                          color: AppTheme.primary,
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            );
                          }),

                          const SizedBox(height: 16),

                          // 2. Delivery Address Card
                          Container(
                            padding: const EdgeInsets.all(14),
                            decoration: BoxDecoration(
                              color: cardBg,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: cardBorder),
                            ),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Row(
                                      children: [
                                        const Icon(
                                          Icons.location_on_rounded,
                                          color: AppTheme.primary,
                                          size: 18,
                                        ),
                                        const SizedBox(width: 6),
                                        Text(
                                          'Dirección de Entrega',
                                          style: GoogleFonts.outfit(
                                            fontSize: 14,
                                            fontWeight: FontWeight.w700,
                                            color: textColor,
                                          ),
                                        ),
                                      ],
                                    ),
                                    TextButton(
                                      onPressed: () =>
                                          _showAddressPicker(context, cart),
                                      child: Text(
                                        'Cambiar',
                                        style: GoogleFonts.outfit(
                                          color: AppTheme.primary,
                                          fontWeight: FontWeight.w700,
                                        ),
                                      ),
                                    ),
                                  ],
                                ),
                                Text(
                                  '${cart.selectedAddress.title} • ${cart.selectedAddress.address}',
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    color: textColor,
                                  ),
                                ),
                                if (cart.selectedAddress.reference != null)
                                  Text(
                                    'Ref: ${cart.selectedAddress.reference}',
                                    style: GoogleFonts.outfit(
                                      fontSize: 11.5,
                                      color: subtextColor,
                                    ),
                                  ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 16),

                          // 3. Payment Method
                          Text(
                            'Método de Pago',
                            style: GoogleFonts.outfit(
                              fontSize: 15,
                              fontWeight: FontWeight.w700,
                              color: textColor,
                            ),
                          ),
                          const SizedBox(height: 10),

                          Builder(
                            builder: (context) {
                              final branch = cart.currentBranch;
                              final rawAccepted = branch?.acceptedPaymentMethods ?? const ['pago_movil', 'cash_usd', 'cash_local', 'mobile_transfer'];
                              
                              final allMethodsDef = [
                                {
                                  'id': 'pago_movil',
                                  'title': 'Pago Móvil',
                                  'subtitle': 'Transferencia bancaria',
                                  'icon': Icons.phone_android_rounded,
                                  'color': AppTheme.amberAccent,
                                  'match': ['pago_movil', 'mobile_transfer'],
                                },
                                {
                                  'id': 'cash_usd',
                                  'title': 'Efectivo \$ USD',
                                  'subtitle': 'En divisa al recibir',
                                  'icon': Icons.attach_money_rounded,
                                  'color': const Color(0xFF10B981),
                                  'match': ['cash_usd', 'efectivo', 'cash'],
                                },
                                {
                                  'id': 'cash_local',
                                  'title': 'Efectivo Bs.',
                                  'subtitle': 'A tasa oficial BCV',
                                  'icon': Icons.payments_rounded,
                                  'color': const Color(0xFFF59E0B),
                                  'match': ['cash_local', 'cash_bs', 'efectivo'],
                                },
                                {
                                  'id': 'zelle',
                                  'title': 'Zelle Directo',
                                  'subtitle': 'Transferencia USA',
                                  'icon': Icons.bolt_rounded,
                                  'color': const Color(0xFF8B5CF6),
                                  'match': ['zelle', 'tarjeta'],
                                },
                                {
                                  'id': 'card_terminal',
                                  'title': 'Punto de Venta',
                                  'subtitle': 'Tarjeta al recibir',
                                  'icon': Icons.credit_card_rounded,
                                  'color': const Color(0xFF3B82F6),
                                  'match': ['card_terminal', 'pos_card', 'tarjeta', 'terminal'],
                                },
                              ];

                              final availableMethods = allMethodsDef.where((m) {
                                final matches = m['match'] as List<String>;
                                return rawAccepted.any((a) => matches.contains(a));
                              }).toList();

                              final effectiveMethods = availableMethods.isNotEmpty
                                  ? availableMethods
                                  : allMethodsDef.take(2).toList();

                              if (!effectiveMethods.any((m) => m['id'] == _selectedPayment)) {
                                WidgetsBinding.instance.addPostFrameCallback((_) {
                                  if (mounted) setState(() => _selectedPayment = effectiveMethods.first['id'] as String);
                                });
                              }

                              return SizedBox(
                                height: 82,
                                child: ListView.separated(
                                  scrollDirection: Axis.horizontal,
                                  itemCount: effectiveMethods.length,
                                  separatorBuilder: (_, __) => const SizedBox(width: 10),
                                  itemBuilder: (context, idx) {
                                    final m = effectiveMethods[idx];
                                    return _buildPaymentCard(
                                      id: m['id'] as String,
                                      icon: m['icon'] as IconData,
                                      title: m['title'] as String,
                                      subtitle: m['subtitle'] as String,
                                      color: m['color'] as Color,
                                    );
                                  },
                                ),
                              );
                            },
                          ),

                          if (_selectedPayment == 'pago_movil') ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: darkBoxBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: cardBorder),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Datos de Pago Móvil Directo:',
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: AppTheme.amberAccent,
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF10B981)
                                              .withOpacity(0.15),
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          '100% DIRECTO',
                                          style: GoogleFonts.outfit(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                            color: const Color(0xFF10B981),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    '${(cart.currentBranchPayment?.pagoMovilPhone != null && cart.currentBranchPayment!.pagoMovilPhone.isNotEmpty) ? cart.currentBranchPayment!.pagoMovilPhone : 'Teléfono no configurado'} • CI/RIF: ${(cart.currentBranchPayment?.pagoMovilIdNumber != null && cart.currentBranchPayment!.pagoMovilIdNumber.isNotEmpty) ? cart.currentBranchPayment!.pagoMovilIdNumber : 'N/A'} • ${(cart.currentBranchPayment?.pagoMovilBank != null && cart.currentBranchPayment!.pagoMovilBank.isNotEmpty) ? cart.currentBranchPayment!.pagoMovilBank : 'Banco no especificado'}',
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: textColor,
                                    ),
                                  ),
                                  if (cart.currentBranchPayment
                                          ?.pagoMovilAccountName !=
                                      null && cart.currentBranchPayment!.pagoMovilAccountName.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      'Titular: ${cart.currentBranchPayment!.pagoMovilAccountName}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: subtextColor,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 8),
                                  TextField(
                                    controller: _pagoMovilRefController,
                                    style: TextStyle(
                                        color: textColor,
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700),
                                    decoration: InputDecoration(
                                      hintText:
                                          'Número de referencia (ej: 4821)',
                                      hintStyle: TextStyle(
                                          color: subtextColor, fontSize: 12),
                                      filled: true,
                                      fillColor: inputFill,
                                      isDense: true,
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                              horizontal: 14, vertical: 12),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: BorderSide(
                                            color: inputBorder),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: BorderSide(
                                            color: inputBorder),
                                      ),
                                      focusedBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: AppTheme.amberAccent,
                                            width: 1.5),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          if (_selectedPayment == 'cash_usd') ...[
                            const SizedBox(height: 12),
                            TextField(
                              controller: _cashAmountController,
                              keyboardType: TextInputType.number,
                              style: TextStyle(
                                  color: textColor,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700),
                              decoration: InputDecoration(
                                hintText:
                                    '¿Con cuántos \$ USD pagas? (Para llevarte cambio)',
                                hintStyle: TextStyle(
                                    color: subtextColor, fontSize: 12),
                                filled: true,
                                fillColor: inputFill,
                                isDense: true,
                                contentPadding: const EdgeInsets.symmetric(
                                    horizontal: 14, vertical: 12),
                                border: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide:
                                      const BorderSide(color: Colors.white12),
                                ),
                                enabledBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide:
                                      const BorderSide(color: Colors.white12),
                                ),
                                focusedBorder: OutlineInputBorder(
                                  borderRadius: BorderRadius.circular(12),
                                  borderSide: const BorderSide(
                                      color: Color(0xFF10B981), width: 1.5),
                                ),
                              ),
                            ),
                          ],

                          if (_selectedPayment == 'cash_local') ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: darkBoxBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: cardBorder),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Total en Bolívares (Tasa Oficial):',
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFFF59E0B),
                                        ),
                                      ),
                                      Text(
                                        'Bs. ${(cart.grandTotal * (cart.currentStoreExchangeRate ?? 896.12)).toStringAsFixed(2)}',
                                        style: GoogleFonts.outfit(
                                          fontSize: 14,
                                          fontWeight: FontWeight.w900,
                                          color: textColor,
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 8),
                                  TextField(
                                    controller: _cashBsAmountController,
                                    keyboardType: TextInputType.number,
                                    style: TextStyle(
                                        color: textColor,
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700),
                                    decoration: InputDecoration(
                                      hintText:
                                          '¿Con cuántos Bs. pagas? (Para llevarte cambio)',
                                      hintStyle: TextStyle(
                                          color: subtextColor, fontSize: 12),
                                      filled: true,
                                      fillColor: inputFill,
                                      isDense: true,
                                      contentPadding: const EdgeInsets.symmetric(
                                          horizontal: 14, vertical: 12),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide:
                                            const BorderSide(color: Colors.white12),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide:
                                            const BorderSide(color: Colors.white12),
                                      ),
                                      focusedBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: Color(0xFFF59E0B), width: 1.5),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          if (_selectedPayment == 'zelle') ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: darkBoxBg,
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: cardBorder),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment:
                                        MainAxisAlignment.spaceBetween,
                                    children: [
                                      Text(
                                        'Datos para Zelle Directo:',
                                        style: GoogleFonts.outfit(
                                          fontSize: 12,
                                          fontWeight: FontWeight.w700,
                                          color: const Color(0xFF8B5CF6),
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(
                                            horizontal: 6, vertical: 2),
                                        decoration: BoxDecoration(
                                          color: const Color(0xFF10B981)
                                              .withOpacity(0.15),
                                          borderRadius:
                                              BorderRadius.circular(6),
                                        ),
                                        child: Text(
                                          '100% DIRECTO',
                                          style: GoogleFonts.outfit(
                                            fontSize: 9,
                                            fontWeight: FontWeight.w800,
                                            color: const Color(0xFF10B981),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 4),
                                  Text(
                                    (cart.currentBranchPayment?.zelleEmail !=
                                                null &&
                                            cart.currentBranchPayment!
                                                .zelleEmail!.isNotEmpty)
                                        ? 'Email: ${cart.currentBranchPayment!.zelleEmail}'
                                        : 'Email no configurado por el comercio',
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: textColor,
                                    ),
                                  ),
                                  if (cart.currentBranchPayment
                                              ?.zelleAccountName !=
                                          null &&
                                      cart.currentBranchPayment!
                                          .zelleAccountName!.isNotEmpty) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      'A nombre de: ${cart.currentBranchPayment!.zelleAccountName}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: subtextColor,
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 8),
                                  TextField(
                                    controller: _zelleRefController,
                                    style: TextStyle(
                                        color: textColor,
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700),
                                    decoration: InputDecoration(
                                      hintText:
                                          'Nombre del titular o número de confirmación Zelle',
                                      hintStyle: TextStyle(
                                          color: subtextColor, fontSize: 12),
                                      filled: true,
                                      fillColor: inputFill,
                                      isDense: true,
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                              horizontal: 14, vertical: 12),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: BorderSide(
                                            color: inputBorder),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: BorderSide(
                                            color: inputBorder),
                                      ),
                                      focusedBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: Color(0xFF8B5CF6),
                                            width: 1.5),
                                      ),
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          if (_selectedPayment == 'card_terminal') ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFF3B82F6).withOpacity(0.12),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: const Color(0xFF3B82F6).withOpacity(0.35)),
                              ),
                              child: Row(
                                children: [
                                  const Icon(Icons.credit_card_rounded, color: Color(0xFF3B82F6), size: 24),
                                  const SizedBox(width: 12),
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          'Punto de Venta Inalámbrico',
                                          style: GoogleFonts.outfit(
                                            fontSize: 12.5,
                                            fontWeight: FontWeight.w800,
                                            color: textColor,
                                          ),
                                        ),
                                        const SizedBox(height: 2),
                                        Text(
                                          'El motorizado llevará el punto de venta móvil a tu puerta. Puedes pagar con tarjeta de débito o crédito bancaria al recibir.',
                                          style: GoogleFonts.outfit(
                                            fontSize: 11,
                                            color: subtextColor,
                                          ),
                                        ),
                                      ],
                                    ),
                                  ),
                                ],
                              ),
                            ),
                          ],

                          const SizedBox(height: 20),

                          // 4. Price Breakdown
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: cardBg,
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: cardBorder),
                            ),
                            child: Column(
                              children: [
                                _buildPriceRow('Subtotal',
                                    '\$${cart.subtotal.toStringAsFixed(2)}'),
                                const SizedBox(height: 8),
                                _buildPriceRow(
                                  'Costo de envío',
                                  cart.isOutOfCoverage
                                      ? 'Fuera de Cobertura'
                                      : (cart.distanceToCurrentBranchKm != null
                                          ? '\$${cart.deliveryFee.toStringAsFixed(2)} (${cart.distanceToCurrentBranchKm} km)'
                                          : '\$${cart.deliveryFee.toStringAsFixed(2)}'),
                                ),
                                const Divider(
                                    color: Colors.white12, height: 16),
                                _buildPriceRow(
                                  'Total a pagar',
                                  '\$${cart.grandTotal.toStringAsFixed(2)}',
                                  isTotal: true,
                                ),
                                const SizedBox(height: 6),
                                Row(
                                  mainAxisAlignment:
                                      MainAxisAlignment.spaceBetween,
                                  children: [
                                    Text(
                                      'Equivalente BCV Oficial',
                                      style: GoogleFonts.outfit(
                                        fontSize: 12,
                                        fontWeight: FontWeight.w600,
                                        color: const Color(0xFF65A30D),
                                      ),
                                    ),
                                    Text(
                                      'Bs. ${cart.grandTotalBs.toStringAsFixed(2)}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 13,
                                        fontWeight: FontWeight.w800,
                                        color: const Color(0xFF65A30D),
                                      ),
                                    ),
                                  ],
                                ),
                              ],
                            ),
                          ),

                          const SizedBox(height: 24),
                        ],
                      ),
              ),

              // Bottom Confirmation Button
              if (cart.items.isNotEmpty)
                Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 24),
                  child: ElevatedButton(
                    onPressed: cart.isOutOfCoverage
                        ? null
                        : () => _confirmOrder(context, cart),
                    style: ElevatedButton.styleFrom(
                      backgroundColor:
                          cart.isOutOfCoverage ? Colors.grey : AppTheme.primary,
                      minimumSize: const Size(double.infinity, 54),
                      shape: RoundedRectangleBorder(
                          borderRadius: BorderRadius.circular(16)),
                      elevation: cart.isOutOfCoverage ? 0 : 4,
                    ),
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Text(
                          cart.isOutOfCoverage
                              ? 'Fuera de Cobertura'
                              : 'Confirmar Pedido',
                          style: GoogleFonts.outfit(
                            fontSize: 16,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        Text(
                          '\$${cart.grandTotal.toStringAsFixed(2)}',
                          style: GoogleFonts.outfit(
                            fontSize: 18,
                            fontWeight: FontWeight.w900,
                            color: Colors.white,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        );
      },
    );
  }

  Widget _buildPaymentCard({
    required String id,
    required IconData icon,
    required String title,
    required String subtitle,
    required Color color,
  }) {
    final isSelected = _selectedPayment == id;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final cardBg = isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9);
    final cardBorder = isDark ? Colors.white10 : const Color(0xFFCBD5E1);
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF64748B);

    return GestureDetector(
      onTap: () => setState(() => _selectedPayment = id),
      child: AnimatedContainer(
        duration: const Duration(milliseconds: 180),
        width: 135,
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
        decoration: BoxDecoration(
          color: isSelected ? color.withOpacity(0.14) : cardBg,
          borderRadius: BorderRadius.circular(16),
          border: Border.all(
            color: isSelected ? color : cardBorder,
            width: isSelected ? 2.0 : 1.0,
          ),
          boxShadow: isSelected
              ? [
                  BoxShadow(
                    color: color.withOpacity(0.18),
                    blurRadius: 8,
                    offset: const Offset(0, 3),
                  )
                ]
              : null,
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            Row(
              mainAxisAlignment: MainAxisAlignment.spaceBetween,
              children: [
                Icon(icon, color: isSelected ? color : subtextColor, size: 20),
                if (isSelected)
                  Container(
                    width: 16,
                    height: 16,
                    decoration: BoxDecoration(
                      color: color,
                      shape: BoxShape.circle,
                    ),
                    child: const Icon(Icons.check, size: 11, color: Colors.white),
                  ),
              ],
            ),
            const SizedBox(height: 6),
            Text(
              title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 12,
                fontWeight: FontWeight.w700,
                color: isSelected ? textColor : textColor.withOpacity(0.85),
              ),
            ),
            Text(
              subtitle,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: GoogleFonts.outfit(
                fontSize: 10,
                fontWeight: FontWeight.w500,
                color: subtextColor,
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPriceRow(String label, String value, {bool isTotal = false}) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFF94A3B8) : const Color(0xFF475569);

    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: isTotal ? 16 : 13.5,
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w500,
            color: isTotal ? textColor : subtextColor,
          ),
        ),
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: isTotal ? 18 : 14,
            fontWeight: isTotal ? FontWeight.w900 : FontWeight.w700,
            color: isTotal ? AppTheme.primary : textColor,
          ),
        ),
      ],
    );
  }
}
