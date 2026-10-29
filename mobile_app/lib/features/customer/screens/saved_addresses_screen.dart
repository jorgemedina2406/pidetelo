import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/models/order_model.dart';
import '../../../core/services/cart_service.dart';
import '../../../core/theme/app_theme.dart';
import 'map_address_picker_screen.dart';

class SavedAddressesScreen extends StatefulWidget {
  const SavedAddressesScreen({super.key});

  @override
  State<SavedAddressesScreen> createState() => _SavedAddressesScreenState();
}

class _SavedAddressesScreenState extends State<SavedAddressesScreen> {
  void _openMapPicker([DeliveryAddress? addressToEdit]) async {
    final result = await Navigator.push<DeliveryAddress>(
      context,
      MaterialPageRoute(
        builder: (_) => MapAddressPickerScreen(initialAddress: addressToEdit),
      ),
    );

    if (result != null) {
      if (addressToEdit != null) {
        await CartService().updateSavedAddress(result);
      } else {
        await CartService().addSavedAddress(result);
      }
      setState(() {});
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(
            content: Text(
              addressToEdit != null ? 'Dirección actualizada con éxito' : 'Nueva dirección guardada y seleccionada',
              style: GoogleFonts.outfit(),
            ),
            backgroundColor: AppTheme.primary,
          ),
        );
      }
    }
  }

  void _deleteAddress(DeliveryAddress addr) {
    showDialog(
      context: context,
      builder: (ctx) => AlertDialog(
        backgroundColor: const Color(0xFF1E293B),
        title: Text('Eliminar Dirección', style: GoogleFonts.outfit(color: Colors.white, fontWeight: FontWeight.bold)),
        content: Text(
          '¿Estás seguro de que deseas eliminar "${addr.title}"?',
          style: GoogleFonts.outfit(color: const Color(0xFF94A3B8)),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(ctx),
            child: const Text('Cancelar', style: TextStyle(color: Color(0xFF94A3B8))),
          ),
          ElevatedButton(
            style: ElevatedButton.styleFrom(backgroundColor: Colors.redAccent),
            onPressed: () {
              Navigator.pop(ctx);
              CartService().deleteSavedAddress(addr.id);
              setState(() {});
            },
            child: const Text('Eliminar', style: TextStyle(color: Colors.white)),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final cart = CartService();
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final addresses = cart.savedAddresses;
    final currentSelectedId = cart.selectedAddress.id;

    return Scaffold(
      appBar: AppBar(
        title: Text(
          'Mis Direcciones de Entrega',
          style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700),
        ),
      ),
      body: AnimatedBuilder(
        animation: cart,
        builder: (context, _) {
          if (addresses.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    const Icon(Icons.location_off_outlined, size: 54, color: Color(0xFF94A3B8)),
                    const SizedBox(height: 16),
                    Text(
                      'No tienes direcciones guardadas',
                      style: GoogleFonts.outfit(fontSize: 18, fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Guarda tus ubicaciones frecuentes para pedir en tus comercios y tiendas favoritas en segundos',
                      textAlign: TextAlign.center,
                      style: GoogleFonts.outfit(color: const Color(0xFF94A3B8)),
                    ),
                    const SizedBox(height: 24),
                    ElevatedButton.icon(
                      onPressed: () => _openMapPicker(),
                      icon: const Icon(Icons.add_location_alt_rounded),
                      label: const Text('Agregar Dirección con Mapa'),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
                      ),
                    ),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.fromLTRB(16, 16, 16, 100),
            itemCount: addresses.length,
            separatorBuilder: (_, __) => const SizedBox(height: 12),
            itemBuilder: (context, index) {
              final addr = addresses[index];
              final isSelected = addr.id == currentSelectedId;

              return InkWell(
                onTap: () {
                  cart.selectAddress(addr);
                  setState(() {});
                },
                borderRadius: BorderRadius.circular(18),
                child: Container(
                  padding: const EdgeInsets.all(16),
                  decoration: BoxDecoration(
                    color: isDark ? AppTheme.darkSurface : Colors.white,
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(
                      color: isSelected ? AppTheme.primary : (isDark ? AppTheme.darkBorder : AppTheme.lightBorder),
                      width: isSelected ? 2 : 1,
                    ),
                    boxShadow: isSelected
                        ? [
                            BoxShadow(
                              color: AppTheme.primary.withOpacity(0.12),
                              blurRadius: 10,
                              offset: const Offset(0, 4),
                            ),
                          ]
                        : null,
                  ),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Row(
                        children: [
                          Icon(
                            isSelected ? Icons.radio_button_checked_rounded : Icons.radio_button_off_rounded,
                            color: isSelected ? AppTheme.primary : const Color(0xFF94A3B8),
                            size: 20,
                          ),
                          const SizedBox(width: 8),
                          Expanded(
                            child: Row(
                              children: [
                                Flexible(
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                    decoration: BoxDecoration(
                                      color: isSelected ? AppTheme.primary.withValues(alpha: 0.15) : (isDark ? const Color(0xFF1E293B) : const Color(0xFFF1F5F9)),
                                      borderRadius: BorderRadius.circular(8),
                                    ),
                                    child: Text(
                                      addr.title,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: GoogleFonts.outfit(
                                        fontSize: 12.5,
                                        fontWeight: FontWeight.w800,
                                        color: isSelected ? AppTheme.primary : (isDark ? Colors.white : const Color(0xFF0F172A)),
                                      ),
                                    ),
                                  ),
                                ),
                                if (isSelected) ...[
                                  const SizedBox(width: 6),
                                  Container(
                                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                    decoration: BoxDecoration(
                                      color: const Color(0xFF10B981).withValues(alpha: 0.15),
                                      borderRadius: BorderRadius.circular(6),
                                    ),
                                    child: Text(
                                      'Activa',
                                      style: GoogleFonts.outfit(
                                        fontSize: 10,
                                        fontWeight: FontWeight.w800,
                                        color: const Color(0xFF10B981),
                                      ),
                                    ),
                                  ),
                                ],
                              ],
                            ),
                          ),
                          InkWell(
                            onTap: () => _openMapPicker(addr),
                            borderRadius: BorderRadius.circular(8),
                            child: const Padding(
                              padding: EdgeInsets.all(6),
                              child: Icon(Icons.edit_location_alt_outlined, size: 18, color: Color(0xFF94A3B8)),
                            ),
                          ),
                          const SizedBox(width: 4),
                          InkWell(
                            onTap: () => _deleteAddress(addr),
                            borderRadius: BorderRadius.circular(8),
                            child: const Padding(
                              padding: EdgeInsets.all(6),
                              child: Icon(Icons.delete_outline_rounded, size: 18, color: Colors.redAccent),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 10),
                      Text(
                        addr.address,
                        style: GoogleFonts.outfit(
                          fontSize: 13.5,
                          fontWeight: FontWeight.w600,
                          color: isDark ? Colors.white : const Color(0xFF0F172A),
                        ),
                      ),
                      if (addr.reference != null && addr.reference!.isNotEmpty) ...[
                        const SizedBox(height: 4),
                        Row(
                          children: [
                            const Icon(Icons.turn_slight_right_rounded, size: 14, color: Color(0xFF94A3B8)),
                            const SizedBox(width: 4),
                            Expanded(
                              child: Text(
                                'Ref: ${addr.reference}',
                                style: GoogleFonts.outfit(fontSize: 12, color: const Color(0xFF94A3B8)),
                              ),
                            ),
                          ],
                        ),
                      ],
                      const SizedBox(height: 8),
                      // Coordinates chip
                      Container(
                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                        decoration: BoxDecoration(
                          color: isDark ? const Color(0xFF1E293B) : const Color(0xFFF8FAFC),
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            const Icon(Icons.pin_drop_outlined, size: 12, color: AppTheme.primary),
                            const SizedBox(width: 4),
                            Text(
                              'GPS: ${addr.latitude.toStringAsFixed(4)}, ${addr.longitude.toStringAsFixed(4)}',
                              style: GoogleFonts.outfit(
                                fontSize: 11,
                                color: const Color(0xFF94A3B8),
                                fontWeight: FontWeight.w600,
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              );
            },
          );
        },
      ),
      bottomNavigationBar: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: isDark ? AppTheme.darkSurface : Colors.white,
          border: Border(top: BorderSide(color: isDark ? AppTheme.darkBorder : AppTheme.lightBorder)),
        ),
        child: SafeArea(
          child: ElevatedButton.icon(
            onPressed: () => _openMapPicker(),
            icon: const Icon(Icons.add_location_alt_rounded),
            label: Text(
              'Agregar Nueva Dirección con Mapa',
              style: GoogleFonts.outfit(fontSize: 14.5, fontWeight: FontWeight.w800),
            ),
            style: ElevatedButton.styleFrom(
              backgroundColor: AppTheme.primary,
              foregroundColor: Colors.white,
              padding: const EdgeInsets.symmetric(vertical: 14),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
            ),
          ),
        ),
      ),
    );
  }
}
