import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../models/branch_model.dart';
import '../models/order_model.dart';

class AgeRestrictionHelper {
  static bool _sessionVerified = false;

  static bool get isSessionVerified => _sessionVerified;

  static void resetSessionVerification() {
    _sessionVerified = false;
  }

  static String _normalize(String? value) {
    if (value == null || value.isEmpty) return '';
    return value
        .toLowerCase()
        .replaceAll('á', 'a')
        .replaceAll('é', 'e')
        .replaceAll('í', 'i')
        .replaceAll('ó', 'o')
        .replaceAll('ú', 'u')
        .replaceAll('ü', 'u')
        .replaceAll('ñ', 'n')
        .trim();
  }

  static bool isStoreAgeRestricted(Map<String, dynamic>? store) {
    if (store == null) return false;

    final explicit = store['isAgeRestricted'] ?? store['is_age_restricted'];
    if (explicit is bool) return explicit;

    final cs = store['currencySettings'] ?? store['currency_settings'];
    if (cs is Map && cs['isAgeRestricted'] is bool) {
      return cs['isAgeRestricted'] == true;
    }

    final branches = store['branches'];
    if (branches is List && branches.isNotEmpty) {
      final first = branches.first;
      if (first is Branch && first.isAgeRestricted) {
        return true;
      } else if (first is Map) {
        final bcs = first['currencySettings'] ?? first['currency_settings'];
        if ((bcs is Map && bcs['isAgeRestricted'] == true) ||
            first['isAgeRestricted'] == true ||
            first['is_age_restricted'] == true) {
          return true;
        }
      }
    }

    final normCat = _normalize(store['category']?.toString());
    return RegExp(r'licor|bodeg|alcohol|cervez|cervec|vinot|licorer').hasMatch(normCat);
  }

  static bool isProductAgeRestricted(Product product, {Map<String, dynamic>? store}) {
    if (product.isAgeRestricted) return true;
    if (store != null && isStoreAgeRestricted(store)) return true;
    final normCat = _normalize(product.category);
    return RegExp(r'licor|cervez|vino|ron|whisky|vodka|tequila|ginebra|coctel|trago|alcohol')
        .hasMatch(normCat);
  }

  static Future<bool> ensureAgeVerified(
    BuildContext context, {
    String? storeName,
    bool isProduct = false,
  }) async {
    if (_sessionVerified) return true;
    if (!context.mounted) return false;

    final isDark = Theme.of(context).brightness == Brightness.dark;
    final dialogBg = isDark ? const Color(0xFF0F172A) : Colors.white;
    final textColor = isDark ? Colors.white : const Color(0xFF0F172A);
    final subtextColor = isDark ? const Color(0xFFCBD5E1) : const Color(0xFF475569);

    final result = await showDialog<bool>(
      context: context,
      barrierDismissible: false,
      builder: (ctx) => PopScope(
        canPop: false,
        child: AlertDialog(
          backgroundColor: dialogBg,
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(22),
            side: const BorderSide(color: Color(0xFFE11D48), width: 1.4),
          ),
          title: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: const Color(0xFFE11D48),
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(
                  '+18',
                  style: GoogleFonts.outfit(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                    fontSize: 16,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Verificación +18',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w800,
                        fontSize: 18,
                        color: textColor,
                      ),
                    ),
                    Text(
                      'Solo para mayores de 18 años',
                      style: GoogleFonts.outfit(
                        fontWeight: FontWeight.w700,
                        fontSize: 11.5,
                        color: const Color(0xFFE11D48),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          content: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                isProduct
                    ? 'Este producto tiene restricción legal de venta exclusiva para mayores de 18 años.'
                    : '${storeName?.isNotEmpty == true ? storeName : "Este comercio"} ofrece licores o productos exclusivos para mayores de 18 años.',
                style: GoogleFonts.outfit(
                  fontSize: 14,
                  height: 1.4,
                  color: subtextColor,
                ),
              ),
              const SizedBox(height: 12),
              Container(
                padding: const EdgeInsets.all(12),
                decoration: BoxDecoration(
                  color: const Color(0xFFE11D48).withOpacity(0.10),
                  borderRadius: BorderRadius.circular(12),
                  border: Border.all(color: const Color(0xFFE11D48).withOpacity(0.35)),
                ),
                child: Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('🔞', style: TextStyle(fontSize: 16)),
                    const SizedBox(width: 8),
                    Expanded(
                      child: Text(
                        'Al continuar confirmas ser mayor de edad. El motorizado podrá solicitar tu cédula de identidad al momento de entregar el pedido.',
                        style: GoogleFonts.outfit(
                          fontSize: 12,
                          fontWeight: FontWeight.w600,
                          height: 1.35,
                          color: isDark ? const Color(0xFFFDA4AF) : const Color(0xFF9F1239),
                        ),
                      ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          actionsPadding: const EdgeInsets.fromLTRB(16, 0, 16, 16),
          actions: [
            Row(
              children: [
                Expanded(
                  child: OutlinedButton(
                    style: OutlinedButton.styleFrom(
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.of(ctx).pop(false),
                    child: Text(
                      'Soy menor (Salir)',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w700, fontSize: 12.5),
                    ),
                  ),
                ),
                const SizedBox(width: 10),
                Expanded(
                  child: ElevatedButton(
                    style: ElevatedButton.styleFrom(
                      backgroundColor: const Color(0xFFE11D48),
                      foregroundColor: Colors.white,
                      padding: const EdgeInsets.symmetric(vertical: 12),
                      shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(12)),
                    ),
                    onPressed: () => Navigator.of(ctx).pop(true),
                    child: Text(
                      'Soy mayor de 18',
                      style: GoogleFonts.outfit(fontWeight: FontWeight.w800, fontSize: 12.5),
                    ),
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );

    if (result == true) {
      _sessionVerified = true;
      return true;
    }
    return false;
  }
}
