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
  String _selectedPayment = 'pago_movil'; // 'efectivo', 'pago_movil', 'tarjeta'
  final TextEditingController _notesController = TextEditingController();
  final TextEditingController _cashAmountController = TextEditingController();
  final TextEditingController _pagoMovilRefController = TextEditingController();

  @override
  void dispose() {
    _notesController.dispose();
    _cashAmountController.dispose();
    _pagoMovilRefController.dispose();
    super.dispose();
  }

  void _showAddressPicker(BuildContext context, CartService cart) {
    showModalBottomSheet(
      context: context,
      backgroundColor: const Color(0xFF0F172A),
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
                    color: Colors.white,
                  ),
                ),
                IconButton(
                  onPressed: () => Navigator.pop(ctx),
                  icon: const Icon(Icons.close_rounded, color: Colors.white70),
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
                      : const Color(0xFF1E293B),
                  borderRadius: BorderRadius.circular(16),
                  border: Border.all(
                    color: isSelected ? AppTheme.primary : Colors.white12,
                    width: isSelected ? 1.5 : 1.0,
                  ),
                ),
                child: ListTile(
                  leading: Icon(
                    addr.title.toLowerCase().contains('casa')
                        ? Icons.home_rounded
                        : Icons.business_rounded,
                    color: isSelected ? AppTheme.primary : Colors.white70,
                  ),
                  title: Text(
                    addr.title,
                    style: GoogleFonts.outfit(
                      fontSize: 15,
                      fontWeight: FontWeight.w700,
                      color: Colors.white,
                    ),
                  ),
                  subtitle: Text(
                    '${addr.address}\n${addr.reference ?? ''}',
                    style: GoogleFonts.outfit(
                        fontSize: 12, color: const Color(0xFF94A3B8)),
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
    if (_selectedPayment == 'efectivo') {
      paymentLabel = _cashAmountController.text.isNotEmpty
          ? 'Efectivo (Paga con \$${_cashAmountController.text})'
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

        return Container(
          height: MediaQuery.of(context).size.height * 0.88,
          decoration: const BoxDecoration(
            color: Color(0xFF0F172A),
            borderRadius: BorderRadius.vertical(top: Radius.circular(30)),
          ),
          child: Column(
            children: [
              // Top bar
              const SizedBox(height: 12),
              Container(
                width: 44,
                height: 4,
                decoration: BoxDecoration(
                  color: Colors.white24,
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
                        color: Colors.white,
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
              const Divider(color: Colors.white10, height: 1),

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
                            const SizedBox(height: 16),
                            Text(
                              'El carrito está vacío',
                              style: GoogleFonts.outfit(
                                fontSize: 18,
                                fontWeight: FontWeight.w700,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(height: 6),
                            Text(
                              'Agrega platillos deliciosos para comenzar',
                              style: GoogleFonts.outfit(
                                fontSize: 13,
                                color: const Color(0xFF94A3B8),
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
                                color: const Color(0xFF1E293B),
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
                                            color: Colors.white,
                                          ),
                                        ),
                                        if (cart.currentBranchAddress != null)
                                          Text(
                                            cart.currentBranchAddress!,
                                            style: GoogleFonts.outfit(
                                              fontSize: 11,
                                              color: const Color(0xFF94A3B8),
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
                                color: const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(16),
                                border: Border.all(color: Colors.white10),
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
                                            color: Colors.white,
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
                                      color: const Color(0xFF0F172A),
                                      borderRadius: BorderRadius.circular(12),
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
                                          color: Colors.white70,
                                        ),
                                        Text(
                                          '${item.quantity}',
                                          style: GoogleFonts.outfit(
                                            fontWeight: FontWeight.w800,
                                            color: Colors.white,
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
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(18),
                              border: Border.all(color: Colors.white12),
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
                                            color: Colors.white,
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
                                    color: const Color(0xFFCBD5E1),
                                  ),
                                ),
                                if (cart.selectedAddress.reference != null)
                                  Text(
                                    'Ref: ${cart.selectedAddress.reference}',
                                    style: GoogleFonts.outfit(
                                      fontSize: 11.5,
                                      color: const Color(0xFF94A3B8),
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
                              color: Colors.white,
                            ),
                          ),
                          const SizedBox(height: 10),

                          Row(
                            children: [
                              _buildPaymentOption(
                                id: 'pago_movil',
                                icon: Icons.phone_android_rounded,
                                label: 'Pago Móvil',
                              ),
                              const SizedBox(width: 8),
                              _buildPaymentOption(
                                id: 'efectivo',
                                icon: Icons.payments_rounded,
                                label: 'Efectivo',
                              ),
                              const SizedBox(width: 8),
                              _buildPaymentOption(
                                id: 'tarjeta',
                                icon: Icons.credit_card_rounded,
                                label: 'Zelle / Tarjeta',
                              ),
                            ],
                          ),

                          if (_selectedPayment == 'pago_movil') ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: Colors.white10),
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
                                    '${cart.currentBranchPayment?.pagoMovilPhone ?? "0414-5001122"} • CI/RIF: ${cart.currentBranchPayment?.pagoMovilIdNumber ?? "V-25.123.456"} • ${cart.currentBranchPayment?.pagoMovilBank ?? "Banesco (0134)"}',
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFFCBD5E1),
                                    ),
                                  ),
                                  if (cart.currentBranchPayment
                                          ?.pagoMovilAccountName !=
                                      null) ...[
                                    const SizedBox(height: 2),
                                    Text(
                                      'Titular: ${cart.currentBranchPayment!.pagoMovilAccountName}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: const Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 8),
                                  TextField(
                                    controller: _pagoMovilRefController,
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700),
                                    decoration: InputDecoration(
                                      hintText:
                                          'Número de referencia (ej: 4821)',
                                      hintStyle: const TextStyle(
                                          color: Colors.white38, fontSize: 12),
                                      filled: true,
                                      fillColor: const Color(0xFF1E293B),
                                      isDense: true,
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                              horizontal: 14, vertical: 12),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: Colors.white12),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: Colors.white12),
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

                          if (_selectedPayment == 'tarjeta') ...[
                            const SizedBox(height: 12),
                            Container(
                              padding: const EdgeInsets.all(12),
                              decoration: BoxDecoration(
                                color: const Color(0xFF0F172A),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(color: Colors.white10),
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
                                        : 'Email: pagos@burgerlab.com',
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w600,
                                      color: const Color(0xFFCBD5E1),
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
                                        color: const Color(0xFF94A3B8),
                                      ),
                                    ),
                                  ],
                                  const SizedBox(height: 8),
                                  TextField(
                                    controller: _pagoMovilRefController,
                                    style: const TextStyle(
                                        color: Colors.white,
                                        fontSize: 13.5,
                                        fontWeight: FontWeight.w700),
                                    decoration: InputDecoration(
                                      hintText:
                                          'Nombre de la cuenta o referencia Zelle',
                                      hintStyle: const TextStyle(
                                          color: Colors.white38, fontSize: 12),
                                      filled: true,
                                      fillColor: const Color(0xFF1E293B),
                                      isDense: true,
                                      contentPadding:
                                          const EdgeInsets.symmetric(
                                              horizontal: 14, vertical: 12),
                                      border: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: Colors.white12),
                                      ),
                                      enabledBorder: OutlineInputBorder(
                                        borderRadius: BorderRadius.circular(12),
                                        borderSide: const BorderSide(
                                            color: Colors.white12),
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

                          if (_selectedPayment == 'efectivo') ...[
                            const SizedBox(height: 12),
                            TextField(
                              controller: _cashAmountController,
                              keyboardType: TextInputType.number,
                              style: const TextStyle(
                                  color: Colors.white,
                                  fontSize: 13.5,
                                  fontWeight: FontWeight.w700),
                              decoration: InputDecoration(
                                hintText:
                                    '¿Con cuánto pagas? (Para llevarte cambio)',
                                hintStyle: const TextStyle(
                                    color: Colors.white38, fontSize: 12),
                                filled: true,
                                fillColor: const Color(0xFF1E293B),
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
                                      color: AppTheme.primary, width: 1.5),
                                ),
                              ),
                            ),
                          ],

                          const SizedBox(height: 20),

                          // 4. Price Breakdown
                          Container(
                            padding: const EdgeInsets.all(16),
                            decoration: BoxDecoration(
                              color: const Color(0xFF1E293B),
                              borderRadius: BorderRadius.circular(18),
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
                                      'Bs. ${(cart.grandTotal * 36.5).toStringAsFixed(2)}',
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

  Widget _buildPaymentOption({
    required String id,
    required IconData icon,
    required String label,
  }) {
    final isSelected = _selectedPayment == id;

    return Expanded(
      child: GestureDetector(
        onTap: () => setState(() => _selectedPayment = id),
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 12),
          decoration: BoxDecoration(
            color: isSelected
                ? AppTheme.primary.withOpacity(0.15)
                : const Color(0xFF1E293B),
            borderRadius: BorderRadius.circular(14),
            border: Border.all(
              color: isSelected ? AppTheme.primary : Colors.white10,
              width: isSelected ? 1.5 : 1.0,
            ),
          ),
          child: Column(
            children: [
              Icon(icon,
                  color: isSelected ? AppTheme.primary : Colors.white70,
                  size: 20),
              const SizedBox(height: 6),
              Text(
                label,
                style: GoogleFonts.outfit(
                  fontSize: 11.5,
                  fontWeight: FontWeight.w700,
                  color: isSelected ? AppTheme.primary : Colors.white70,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildPriceRow(String label, String value, {bool isTotal = false}) {
    return Row(
      mainAxisAlignment: MainAxisAlignment.spaceBetween,
      children: [
        Text(
          label,
          style: GoogleFonts.outfit(
            fontSize: isTotal ? 16 : 13.5,
            fontWeight: isTotal ? FontWeight.w800 : FontWeight.w500,
            color: isTotal ? Colors.white : const Color(0xFF94A3B8),
          ),
        ),
        Text(
          value,
          style: GoogleFonts.outfit(
            fontSize: isTotal ? 18 : 14,
            fontWeight: isTotal ? FontWeight.w900 : FontWeight.w700,
            color: isTotal ? AppTheme.primary : Colors.white,
          ),
        ),
      ],
    );
  }
}
