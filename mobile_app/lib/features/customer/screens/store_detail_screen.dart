import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';
import '../../../core/models/order_model.dart';
import '../../../core/models/branch_model.dart';
import '../../../core/services/cart_service.dart';
import '../../../core/services/api_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/services/session_service.dart';
import '../../../core/services/dolar_api_service.dart';
import '../widgets/branch_selector_bottom_sheet.dart';
import 'checkout_sheet.dart';

Color _parseHexColor(dynamic hex, {Color fallback = AppTheme.primary}) {
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

class StoreDetailScreen extends StatefulWidget {
  final Map<String, dynamic> storeData;
  final SessionService? sessionService;
  final Branch? initialBranch;

  const StoreDetailScreen({
    super.key,
    required this.storeData,
    this.sessionService,
    this.initialBranch,
  });

  @override
  State<StoreDetailScreen> createState() => _StoreDetailScreenState();
}

class _StoreDetailScreenState extends State<StoreDetailScreen> {
  String _selectedCategory = 'Todos';
  bool _isFavorite = false;
  Branch? _selectedBranch;
  List<Branch> _availableBranches = [];

  List<Product> _products = [];
  bool _isLoadingProducts = true;
  bool _isProductGridView = false;

  @override
  void initState() {
    super.initState();
    final storeId = widget.storeData['id']?.toString() ?? '';
    _isFavorite = widget.sessionService?.isFavorite(storeId) ?? false;
    _selectedBranch = widget.initialBranch;
    _loadBranches();
    _loadRealProducts();
  }

  Future<void> _loadBranches() async {
    final rawBranches = widget.storeData['branches'];
    List<Branch> list = [];
    if (rawBranches is List) {
      list = rawBranches
          .map((b) => b is Branch ? b : Branch.fromJson(b as Map<String, dynamic>))
          .toList();
    }

    final tenantId = widget.storeData['id']?.toString() ?? '';
    if (list.isEmpty && tenantId.isNotEmpty) {
      final fetched = await ApiService().fetchBranchesForCompany(tenantId);
      if (fetched.isNotEmpty) {
        list = fetched;
      }
    }

    // Filtrar estrictamente solo sucursales activas y aprobadas (nunca mostrar inactivas o pendientes)
    list = list.where((b) => b.status == 'active').toList();

    if (mounted) {
      setState(() {
        _availableBranches = list;
        if (_selectedBranch == null && list.isNotEmpty) {
          final userAddr = CartService().selectedAddress;
          list.sort((a, b) => a
              .distanceKmTo(userAddr.latitude, userAddr.longitude)
              .compareTo(b.distanceKmTo(userAddr.latitude, userAddr.longitude)));
          _selectedBranch = list.first;
        }
      });
      if (_selectedBranch != null) {
        CartService().setBranch(_selectedBranch);
        _loadRealProducts();
      }
    }
  }

  Future<void> _openBranchSelector() async {
    final userAddr = CartService().selectedAddress;
    final selected = await BranchSelectorBottomSheet.show(
      context: context,
      companyName: widget.storeData['name'] ?? 'Comercio',
      branches: _availableBranches,
      currentSelectedBranch: _selectedBranch,
      userLat: userAddr.latitude,
      userLng: userAddr.longitude,
    );

    if (selected != null && mounted) {
      setState(() {
        _selectedBranch = selected;
      });
      CartService().setBranch(selected);
      _loadRealProducts();
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Sede seleccionada: ${selected.name}',
            style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
          ),
          backgroundColor: const Color(0xFF1E293B),
          duration: const Duration(seconds: 2),
          behavior: SnackBarBehavior.floating,
        ),
      );
    }
  }

  Future<void> _loadRealProducts() async {
    final tenantId = widget.storeData['id']?.toString() ?? '';
    final branchId = _selectedBranch?.id;
    if (mounted) {
      setState(() {
        _isLoadingProducts = true;
      });
    }
    var prods = await ApiService().fetchProductsByTenant(tenantId, branchId: branchId);
    if (prods.isEmpty && branchId != null) {
      prods = await ApiService().fetchProductsByTenant(tenantId, branchId: null);
    }
    if (mounted) {
      setState(() {
        _products = prods;
        _isLoadingProducts = false;
      });
      CartService().setStoreProducts(prods);
    }
  }

  void _openProductSheet(Product product) {
    final storeAccent = _parseHexColor(widget.storeData['accentColor']);
    final rate = (widget.storeData['exchangeRate'] as num?)?.toDouble() ?? DolarApiService().officialRate;
    final displayMode = widget.storeData['displayMode']?.toString() ?? 'usd_and_bs';
    int quantity = 1;
    final selectedOptions = <ProductOption>[];
    final selectedModifiers = <SelectedProductModifier>[];
    final notesCtrl = TextEditingController();

    // Preseleccionar opciones por defecto de los grupos de modificadores
    for (final group in product.modifierGroups) {
      for (final opt in group.options) {
        if (opt.isDefault) {
          selectedModifiers.add(
            SelectedProductModifier(
              groupId: group.id,
              groupTitle: group.title,
              optionId: opt.id,
              optionName: opt.name,
              priceDelta: opt.priceDelta,
            ),
          );
        }
      }
    }

    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: const Color(0xFF0F172A),
      shape: const RoundedRectangleBorder(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
      ),
      builder: (ctx) => StatefulBuilder(
        builder: (ctx, setSheetState) {
          double calculatedTotal = product.price;
          for (final opt in selectedOptions) {
            calculatedTotal += opt.extraPrice;
          }
          for (final mod in selectedModifiers) {
            calculatedTotal += mod.priceDelta;
          }
          calculatedTotal *= quantity;

          int getSelectedCountInGroup(String groupId) {
            return selectedModifiers.where((m) => m.groupId == groupId).length;
          }

          bool isGroupComplete(ProductModifierGroup group) {
            if (group.minSelections <= 0) return true;
            return getSelectedCountInGroup(group.id) >= group.minSelections;
          }

          int getMissingCount(ProductModifierGroup group) {
            if (group.minSelections <= 0) return 0;
            final diff = group.minSelections - getSelectedCountInGroup(group.id);
            return diff > 0 ? diff : 0;
          }

          bool isValidSelection() {
            for (final group in product.modifierGroups) {
              if (group.minSelections > 0) {
                if (getSelectedCountInGroup(group.id) < group.minSelections) {
                  return false;
                }
              }
            }
            return true;
          }

          void toggleModifier(ProductModifierGroup group, ProductModifierOption option) {
            setSheetState(() {
              if (group.maxSelections == 1) {
                // Selección única tipo radio button
                selectedModifiers.removeWhere((m) => m.groupId == group.id);
                selectedModifiers.add(
                  SelectedProductModifier(
                    groupId: group.id,
                    groupTitle: group.title,
                    optionId: option.id,
                    optionName: option.name,
                    priceDelta: option.priceDelta,
                  ),
                );
              } else {
                // Selección múltiple tipo checkbox
                final existsIdx = selectedModifiers.indexWhere(
                    (m) => m.groupId == group.id && m.optionId == option.id);
                if (existsIdx != -1) {
                  selectedModifiers.removeAt(existsIdx);
                } else {
                  final count = getSelectedCountInGroup(group.id);
                  if (count < group.maxSelections) {
                    selectedModifiers.add(
                      SelectedProductModifier(
                        groupId: group.id,
                        groupTitle: group.title,
                        optionId: option.id,
                        optionName: option.name,
                        priceDelta: option.priceDelta,
                      ),
                    );
                  }
                }
              }
            });
          }

          return Container(
            constraints: BoxConstraints(
              maxHeight: MediaQuery.of(ctx).size.height * 0.90,
            ),
            decoration: const BoxDecoration(
              color: Color(0xFF0F172A),
              borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
            ),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Center(
                  child: Container(
                    margin: const EdgeInsets.only(top: 14, bottom: 8),
                    width: 44,
                    height: 4,
                    decoration: BoxDecoration(
                      color: Colors.white24,
                      borderRadius: BorderRadius.circular(10),
                    ),
                  ),
                ),

                // Scrollable Content
                Flexible(
                  child: SingleChildScrollView(
                    padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 8),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.stretch,
                      children: [
                        // Product image preview
                        ClipRRect(
                          borderRadius: BorderRadius.circular(20),
                          child: Image.network(
                            product.imageUrl,
                            height: 170,
                            width: double.infinity,
                            fit: BoxFit.cover,
                            errorBuilder: (_, __, ___) => Container(
                              height: 170,
                              color: const Color(0xFF1E293B),
                              child: const Icon(Icons.fastfood_rounded, color: Colors.white30, size: 48),
                            ),
                          ),
                        ),
                        const SizedBox(height: 16),

                        Text(
                          product.name,
                          style: GoogleFonts.outfit(
                            fontSize: 20,
                            fontWeight: FontWeight.w800,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          product.description,
                          style: GoogleFonts.outfit(fontSize: 13, color: const Color(0xFF94A3B8)),
                        ),
                        const SizedBox(height: 16),

                        // Grupos de modificadores (Obligatorios y Opcionales)
                        if (product.modifierGroups.isNotEmpty) ...[
                          ...product.modifierGroups.map((group) {
                            final isComplete = isGroupComplete(group);
                            final missingCount = getMissingCount(group);
                            final isSingleChoice = group.maxSelections == 1;

                            String ruleSubtitle = '';
                            if (group.minSelections == 1 && group.maxSelections == 1) {
                              ruleSubtitle = 'Obligatorio (Elige 1)';
                            } else if (group.minSelections == 0) {
                              ruleSubtitle = 'Opcional (Hasta ${group.maxSelections} extras)';
                            } else if (group.minSelections > 0 && group.minSelections == group.maxSelections) {
                              ruleSubtitle = 'Obligatorio (Elige exactamente ${group.minSelections})';
                            } else {
                              ruleSubtitle = 'Obligatorio (Elige al menos ${group.minSelections} de ${group.options.length})';
                            }

                            return Container(
                              margin: const EdgeInsets.only(bottom: 18),
                              padding: const EdgeInsets.all(14),
                              decoration: BoxDecoration(
                                color: const Color(0xFF1E293B).withOpacity(0.5),
                                borderRadius: BorderRadius.circular(18),
                                border: Border.all(
                                  color: isComplete ? Colors.white12 : Colors.amber.withOpacity(0.4),
                                  width: 1.2,
                                ),
                              ),
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Row(
                                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                    children: [
                                      Expanded(
                                        child: Column(
                                          crossAxisAlignment: CrossAxisAlignment.start,
                                          children: [
                                            Text(
                                              group.title,
                                              style: GoogleFonts.outfit(
                                                fontSize: 14.5,
                                                fontWeight: FontWeight.w800,
                                                color: Colors.white,
                                              ),
                                            ),
                                            const SizedBox(height: 2),
                                            Text(
                                              ruleSubtitle,
                                              style: GoogleFonts.outfit(
                                                fontSize: 11.5,
                                                fontWeight: FontWeight.w600,
                                                color: group.minSelections > 0
                                                    ? AppTheme.primary
                                                    : const Color(0xFF94A3B8),
                                              ),
                                            ),
                                          ],
                                        ),
                                      ),
                                      Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 9, vertical: 3.5),
                                        decoration: BoxDecoration(
                                          color: isComplete
                                              ? const Color(0xFF10B981).withOpacity(0.18)
                                              : Colors.amber.withOpacity(0.18),
                                          borderRadius: BorderRadius.circular(10),
                                          border: Border.all(
                                            color: isComplete
                                                ? const Color(0xFF10B981).withOpacity(0.4)
                                                : Colors.amber.withOpacity(0.5),
                                          ),
                                        ),
                                        child: Text(
                                          isComplete
                                              ? (group.maxSelections > 1
                                                  ? '✓ Listo (${getSelectedCountInGroup(group.id)}/${group.maxSelections})'
                                                  : '✓ Listo')
                                              : 'Faltan $missingCount',
                                          style: GoogleFonts.outfit(
                                            fontSize: 10.5,
                                            fontWeight: FontWeight.w700,
                                            color: isComplete
                                                ? const Color(0xFF34D399)
                                                : const Color(0xFFFBBF24),
                                          ),
                                        ),
                                      ),
                                    ],
                                  ),
                                  const SizedBox(height: 10),

                                  // Lista de opciones del grupo
                                  ...group.options.map((opt) {
                                    final isSelected = selectedModifiers.any(
                                        (m) => m.groupId == group.id && m.optionId == opt.id);

                                    return InkWell(
                                      onTap: () => toggleModifier(group, opt),
                                      borderRadius: BorderRadius.circular(12),
                                      child: Container(
                                        margin: const EdgeInsets.only(bottom: 6),
                                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                                        decoration: BoxDecoration(
                                          color: isSelected
                                              ? AppTheme.primary.withOpacity(0.15)
                                              : const Color(0xFF0F172A),
                                          borderRadius: BorderRadius.circular(12),
                                          border: Border.all(
                                            color: isSelected
                                                ? AppTheme.primary
                                                : Colors.white.withOpacity(0.08),
                                            width: isSelected ? 1.5 : 1.0,
                                          ),
                                        ),
                                        child: Row(
                                          children: [
                                            // Radio o Checkbox Icon
                                            Icon(
                                              isSingleChoice
                                                  ? (isSelected
                                                      ? Icons.radio_button_checked_rounded
                                                      : Icons.radio_button_off_rounded)
                                                  : (isSelected
                                                      ? Icons.check_box_rounded
                                                      : Icons.check_box_outline_blank_rounded),
                                              color: isSelected ? AppTheme.primary : Colors.white38,
                                              size: 20,
                                            ),
                                            const SizedBox(width: 10),
                                            Expanded(
                                              child: Text(
                                                opt.name,
                                                style: GoogleFonts.outfit(
                                                  fontSize: 13,
                                                  fontWeight: isSelected
                                                      ? FontWeight.w700
                                                      : FontWeight.w500,
                                                  color: Colors.white,
                                                ),
                                              ),
                                            ),
                                            Text(
                                              opt.priceDelta > 0
                                                  ? '+\$${opt.priceDelta.toStringAsFixed(2)}'
                                                  : 'Incluido',
                                              style: GoogleFonts.outfit(
                                                fontSize: 12,
                                                fontWeight: FontWeight.w700,
                                                color: opt.priceDelta > 0
                                                    ? AppTheme.primary
                                                    : const Color(0xFF94A3B8),
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
                          }),
                        ] else if (product.availableOptions.isNotEmpty) ...[
                          // Fallback para opciones tradicionales si no hay modifierGroups
                          Text(
                            'Personaliza tu pedido (Opcional):',
                            style: GoogleFonts.outfit(
                              fontSize: 14,
                              fontWeight: FontWeight.w700,
                              color: AppTheme.amberAccent,
                            ),
                          ),
                          const SizedBox(height: 10),
                          ...product.availableOptions.map((opt) {
                            final isChecked = selectedOptions.contains(opt);
                            return Container(
                              margin: const EdgeInsets.only(bottom: 8),
                              decoration: BoxDecoration(
                                color: isChecked
                                    ? AppTheme.primary.withOpacity(0.12)
                                    : const Color(0xFF1E293B),
                                borderRadius: BorderRadius.circular(14),
                                border: Border.all(
                                  color: isChecked ? AppTheme.primary : Colors.white12,
                                  width: isChecked ? 1.5 : 1.0,
                                ),
                              ),
                              child: CheckboxListTile(
                                contentPadding: const EdgeInsets.symmetric(horizontal: 12, vertical: 2),
                                value: isChecked,
                                activeColor: AppTheme.primary,
                                checkColor: Colors.white,
                                side: const BorderSide(color: Color(0xFF94A3B8), width: 1.8),
                                checkboxShape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(6)),
                                title: Text(
                                  opt.name,
                                  style: GoogleFonts.outfit(
                                    fontSize: 13.5,
                                    fontWeight: isChecked ? FontWeight.w700 : FontWeight.w500,
                                    color: Colors.white,
                                  ),
                                ),
                                subtitle: Text(
                                  '+ \$${opt.extraPrice.toStringAsFixed(2)}',
                                  style: GoogleFonts.outfit(
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                    color: isChecked ? AppTheme.primary : const Color(0xFF94A3B8),
                                  ),
                                ),
                                onChanged: (val) {
                                  setSheetState(() {
                                    if (val == true) {
                                      selectedOptions.add(opt);
                                    } else {
                                      selectedOptions.remove(opt);
                                    }
                                  });
                                },
                              ),
                            );
                          }),
                        ],

                        const SizedBox(height: 8),

                        // Special instructions
                        Text(
                          'Instrucciones especiales para cocina (Opcional)',
                          style: GoogleFonts.outfit(
                            fontSize: 12,
                            fontWeight: FontWeight.w700,
                            color: const Color(0xFF94A3B8),
                          ),
                        ),
                        const SizedBox(height: 6),
                        TextField(
                          controller: notesCtrl,
                          style: const TextStyle(color: Colors.white, fontSize: 13),
                          decoration: InputDecoration(
                            hintText: 'Ej: Sin cebolla, salsas aparte, etc.',
                            hintStyle: const TextStyle(color: Colors.white38, fontSize: 12),
                            filled: true,
                            fillColor: const Color(0xFF1E293B),
                            border: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: Colors.white12),
                            ),
                            enabledBorder: OutlineInputBorder(
                              borderRadius: BorderRadius.circular(14),
                              borderSide: const BorderSide(color: Colors.white12),
                            ),
                            contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                          ),
                        ),
                        const SizedBox(height: 16),
                      ],
                    ),
                  ),
                ),

                // Sticky Bottom Action Bar
                Container(
                  padding: EdgeInsets.fromLTRB(
                    20,
                    12,
                    20,
                    MediaQuery.of(ctx).viewInsets.bottom + 16,
                  ),
                  decoration: const BoxDecoration(
                    color: Color(0xFF0F172A),
                    border: Border(top: BorderSide(color: Colors.white12)),
                  ),
                  child: Row(
                    children: [
                      Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(16),
                          border: Border.all(color: Colors.white12),
                        ),
                        child: Row(
                          children: [
                            IconButton(
                              icon: const Icon(Icons.remove, color: Colors.white70),
                              onPressed: () {
                                if (quantity > 1) {
                                  setSheetState(() => quantity--);
                                }
                              },
                            ),
                            Text(
                              '$quantity',
                              style: GoogleFonts.outfit(
                                fontSize: 16,
                                fontWeight: FontWeight.w800,
                                color: Colors.white,
                              ),
                            ),
                            IconButton(
                              icon: Icon(Icons.add, color: storeAccent),
                              onPressed: () => setSheetState(() => quantity++),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(width: 14),
                      Expanded(
                        child: ElevatedButton(
                          onPressed: isValidSelection()
                              ? () {
                                  CartService().addItem(
                                    product,
                                    quantity: quantity,
                                    options: selectedOptions,
                                    modifiers: selectedModifiers,
                                    notes: notesCtrl.text.isNotEmpty ? notesCtrl.text : null,
                                    storeName: widget.storeData['name'],
                                    branch: _selectedBranch,
                                    exchangeRate: rate,
                                    displayMode: displayMode,
                                    whatsapp: widget.storeData['whatsappNumber']?.toString(),
                                    accentColor: widget.storeData['accentColor']?.toString(),
                                    baseDeliveryFee: (widget.storeData['baseDeliveryFee'] as num?)?.toDouble(),
                                  );
                                  Navigator.pop(ctx);
                                  ScaffoldMessenger.of(context).showSnackBar(
                                    SnackBar(
                                      content: Text(
                                        '¡${product.name} agregado al carrito!',
                                        style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                                      ),
                                      backgroundColor: const Color(0xFF1E293B),
                                      duration: const Duration(seconds: 2),
                                      behavior: SnackBarBehavior.floating,
                                    ),
                                  );
                                }
                              : null,
                          style: ElevatedButton.styleFrom(
                            backgroundColor: storeAccent,
                            disabledBackgroundColor: Colors.white12,
                            padding: const EdgeInsets.symmetric(vertical: 16),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(16)),
                          ),
                          child: Row(
                            mainAxisAlignment: MainAxisAlignment.center,
                            children: [
                              Text(
                                isValidSelection() ? 'Agregar ' : 'Completa requeridos ',
                                style: const TextStyle(fontWeight: FontWeight.w700),
                              ),
                              if (isValidSelection())
                                Text(
                                  DolarApiService().formatPrice(
                                    calculatedTotal,
                                    customRate: rate,
                                    displayMode: displayMode,
                                  ),
                                  style: const TextStyle(fontWeight: FontWeight.w900),
                                ),
                            ],
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
    );
  }

  void _openCheckout() {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (_) => const CheckoutSheet(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final store = widget.storeData;
    final storeAccent = _parseHexColor(store['accentColor']);
    final rate = (store['exchangeRate'] as num?)?.toDouble() ?? DolarApiService().officialRate;
    final displayMode = store['displayMode']?.toString() ?? 'usd_and_bs';
    final categories = ['Todos', ...{..._products.map((p) => p.category)}];

    final filteredProducts = _selectedCategory == 'Todos'
        ? _products
        : _products.where((p) => p.category == _selectedCategory).toList();

    return Scaffold(
      backgroundColor: const Color(0xFF0F172A),
      body: Stack(
        children: [
          CustomScrollView(
            slivers: [
              // Hero Store Header
              SliverAppBar(
                expandedHeight: 240,
                pinned: true,
                backgroundColor: const Color(0xFF0F172A),
                leading: Container(
                  margin: const EdgeInsets.all(8),
                  decoration: const BoxDecoration(
                    color: Color(0x99000000),
                    shape: BoxShape.circle,
                  ),
                  child: IconButton(
                    icon: const Icon(Icons.arrow_back_rounded, color: Colors.white),
                    onPressed: () => Navigator.pop(context),
                  ),
                ),
                actions: [
                  Container(
                    margin: const EdgeInsets.all(8),
                    decoration: const BoxDecoration(
                      color: Color(0x99000000),
                      shape: BoxShape.circle,
                    ),
                    child: IconButton(
                      icon: Icon(
                        _isFavorite ? Icons.favorite_rounded : Icons.favorite_border_rounded,
                        color: _isFavorite ? const Color(0xFFEF4444) : Colors.white,
                      ),
                      onPressed: () async {
                        final storeId = widget.storeData['id']?.toString() ?? '';
                        if (widget.sessionService != null) {
                          await widget.sessionService!.toggleFavorite(storeId);
                          setState(() {
                            _isFavorite = widget.sessionService!.isFavorite(storeId);
                          });
                        } else {
                          setState(() => _isFavorite = !_isFavorite);
                        }
                        if (mounted) {
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                _isFavorite
                                    ? '¡Guardado en tus Favoritos! ❤️'
                                    : 'Eliminado de tus Favoritos',
                                style: GoogleFonts.outfit(fontWeight: FontWeight.w600),
                              ),
                              backgroundColor: _isFavorite ? const Color(0xFFEF4444) : const Color(0xFF1E293B),
                              duration: const Duration(seconds: 1),
                              behavior: SnackBarBehavior.floating,
                            ),
                          );
                        }
                      },
                    ),
                  ),
                ],
                flexibleSpace: FlexibleSpaceBar(
                  background: Stack(
                    fit: StackFit.expand,
                    children: [
                      Image.network(
                        (store['bannerUrl'] != null && store['bannerUrl'].toString().isNotEmpty)
                            ? store['bannerUrl']
                            : (store['imageUrl'] ?? ''),
                        fit: BoxFit.cover,
                        errorBuilder: (_, __, ___) => Container(color: const Color(0xFF1E293B)),
                      ),
                      Container(
                        decoration: BoxDecoration(
                          gradient: LinearGradient(
                            begin: Alignment.topCenter,
                            end: Alignment.bottomCenter,
                            colors: [
                              Colors.black.withOpacity(0.3),
                              const Color(0xFF0F172A),
                            ],
                          ),
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Store Meta details
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 4, 20, 16),
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        store['name'] ?? 'Comercio',
                        style: GoogleFonts.outfit(
                          fontSize: 26,
                          fontWeight: FontWeight.w800,
                          color: Colors.white,
                        ),
                      ),
                      if (store['tagline'] != null && store['tagline'].toString().trim().isNotEmpty) ...[
                        const SizedBox(height: 2),
                        Text(
                          store['tagline'].toString().trim(),
                          style: GoogleFonts.outfit(
                            fontSize: 13.5,
                            fontStyle: FontStyle.italic,
                            color: const Color(0xFFCBD5E1),
                          ),
                        ),
                      ],
                      const SizedBox(height: 4),
                      Text(
                        store['category'] ?? '',
                        style: GoogleFonts.outfit(
                          fontSize: 14,
                          fontWeight: FontWeight.w500,
                          color: const Color(0xFF94A3B8),
                        ),
                      ),
                      const SizedBox(height: 12),

                      // Badges
                      Builder(
                        builder: (_) {
                          final selectedAddr = CartService().selectedAddress;
                          final dynamicDeliveryTime = ApiService.calculateDeliveryTime(
                            store['lat'] ?? store['latitude'],
                            store['lng'] ?? store['longitude'],
                            selectedAddr.latitude,
                            selectedAddr.longitude,
                          );
                          final ratingStr = store['rating']?.toString() ?? '4.8';
                          final reviews = store['reviewsCount'] != null ? ' (${store['reviewsCount']})' : '';
                          final baseFeeNum = (store['baseDeliveryFee'] as num?)?.toDouble();
                          final feeStr = baseFeeNum != null ? '\$${baseFeeNum.toStringAsFixed(2)}' : (store['fee'] ?? '\$1.50');

                          return Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: [
                              _buildBadge(Icons.star_rounded, '$ratingStr$reviews', AppTheme.amberAccent),
                              _buildBadge(Icons.schedule_rounded, dynamicDeliveryTime, const Color(0xFF38BDF8)),
                              _buildBadge(Icons.delivery_dining_rounded, 'Envío $feeStr', AppTheme.riderAccent),
                              _buildBadge(Icons.currency_exchange_rounded, 'Tasa: ${rate.toStringAsFixed(2)} Bs/\$', const Color(0xFF10B981)),
                            ],
                          );
                        },
                      ),

                      // Closed Store Warning
                      if (_selectedBranch != null && !_selectedBranch!.isOpenRightNow) ...[
                        const SizedBox(height: 12),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                          decoration: BoxDecoration(
                            color: const Color(0xFFEF4444).withOpacity(0.18),
                            borderRadius: BorderRadius.circular(14),
                            border: Border.all(color: const Color(0xFFEF4444).withOpacity(0.6)),
                          ),
                          child: Row(
                            children: [
                              const Icon(Icons.access_time_filled_rounded, color: Color(0xFFEF4444), size: 20),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Text(
                                  'Local actualmente cerrado • Abre a las ${_selectedBranch!.businessHoursOpen} (Horario: ${_selectedBranch!.businessHoursOpen} - ${_selectedBranch!.businessHoursClose})',
                                  style: GoogleFonts.outfit(
                                    color: Colors.white,
                                    fontSize: 12,
                                    fontWeight: FontWeight.w700,
                                  ),
                                ),
                              ),
                            ],
                          ),
                        ),
                      ],
                      
                      // Active Branch Banner (Multi-Sucursal)
                      if (_selectedBranch != null) ...[
                        const SizedBox(height: 14),
                        Container(
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(16),
                            border: Border.all(
                              color: storeAccent.withOpacity(0.4),
                              width: 1.2,
                            ),
                          ),
                          child: Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.all(8),
                                decoration: BoxDecoration(
                                  color: storeAccent.withOpacity(0.15),
                                  borderRadius: BorderRadius.circular(10),
                                ),
                                child: Icon(Icons.storefront_rounded, color: storeAccent, size: 20),
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Row(
                                      children: [
                                        Text(
                                          'Sede: ',
                                          style: GoogleFonts.outfit(
                                            fontSize: 12,
                                            color: const Color(0xFF94A3B8),
                                            fontWeight: FontWeight.w600,
                                          ),
                                        ),
                                        Expanded(
                                          child: Text(
                                            _selectedBranch!.name,
                                            style: GoogleFonts.outfit(
                                              fontSize: 13.5,
                                              fontWeight: FontWeight.w700,
                                              color: Colors.white,
                                            ),
                                            overflow: TextOverflow.ellipsis,
                                          ),
                                        ),
                                      ],
                                    ),
                                    Text(
                                      '${_selectedBranch!.distanceKmTo(CartService().selectedAddress.latitude, CartService().selectedAddress.longitude).toStringAsFixed(1)} km • ${_selectedBranch!.deliveryTimeTo(CartService().selectedAddress.latitude, CartService().selectedAddress.longitude)} • ${_selectedBranch!.address}',
                                      style: GoogleFonts.outfit(
                                        fontSize: 11,
                                        color: const Color(0xFF94A3B8),
                                      ),
                                      overflow: TextOverflow.ellipsis,
                                    ),
                                  ],
                                ),
                              ),
                              if (_availableBranches.length > 1) ...[
                                const SizedBox(width: 6),
                                TextButton(
                                  onPressed: _openBranchSelector,
                                  style: TextButton.styleFrom(
                                    padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                                    backgroundColor: storeAccent.withOpacity(0.15),
                                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                                  ),
                                  child: Text(
                                    'Cambiar',
                                    style: GoogleFonts.outfit(
                                      fontSize: 12,
                                      fontWeight: FontWeight.w700,
                                      color: storeAccent,
                                    ),
                                  ),
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                      const SizedBox(height: 20),

                      // Category Pills
                      SizedBox(
                        height: 38,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemCount: categories.length,
                          separatorBuilder: (_, __) => const SizedBox(width: 8),
                          itemBuilder: (context, idx) {
                            final cat = categories[idx];
                            final isSel = cat == _selectedCategory;

                            return GestureDetector(
                              onTap: () => setState(() => _selectedCategory = cat),
                              child: AnimatedContainer(
                                duration: const Duration(milliseconds: 200),
                                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                                decoration: BoxDecoration(
                                  color: isSel ? storeAccent : const Color(0xFF1E293B),
                                  borderRadius: BorderRadius.circular(20),
                                  border: Border.all(
                                    color: isSel ? storeAccent : Colors.white10,
                                  ),
                                ),
                                child: Text(
                                  cat,
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: isSel ? FontWeight.w700 : FontWeight.w500,
                                    color: isSel ? Colors.white : const Color(0xFF94A3B8),
                                  ),
                                ),
                              ),
                            );
                          },
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // View Switcher & Title Header
              SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.fromLTRB(20, 10, 20, 12),
                  child: Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text(
                        'Menú & Platillos',
                        style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w800, color: Colors.white),
                      ),
                      Container(
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(10),
                          border: Border.all(color: Colors.white12),
                        ),
                        padding: const EdgeInsets.all(2),
                        child: Row(
                          children: [
                            InkWell(
                              onTap: () => setState(() => _isProductGridView = false),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: !_isProductGridView ? storeAccent : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(Icons.view_list_rounded, size: 16, color: !_isProductGridView ? Colors.white : Colors.white60),
                              ),
                            ),
                            InkWell(
                              onTap: () => setState(() => _isProductGridView = true),
                              borderRadius: BorderRadius.circular(8),
                              child: Container(
                                padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
                                decoration: BoxDecoration(
                                  color: _isProductGridView ? storeAccent : Colors.transparent,
                                  borderRadius: BorderRadius.circular(8),
                                ),
                                child: Icon(Icons.grid_view_rounded, size: 16, color: _isProductGridView ? Colors.white : Colors.white60),
                              ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
              ),

              // Product Cards List / Grid
              if (_isLoadingProducts)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, idx) => Container(
                        margin: const EdgeInsets.only(bottom: 12),
                        height: 90,
                        decoration: BoxDecoration(
                          color: const Color(0xFF1E293B),
                          borderRadius: BorderRadius.circular(18),
                          border: Border.all(color: Colors.white10),
                        ),
                        child: Padding(
                          padding: const EdgeInsets.all(12),
                          child: Row(
                            children: [
                              Container(
                                width: 66,
                                height: 66,
                                decoration: BoxDecoration(
                                  color: Colors.white10,
                                  borderRadius: BorderRadius.circular(12),
                                ),
                              ),
                              const SizedBox(width: 12),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  mainAxisAlignment: MainAxisAlignment.center,
                                  children: [
                                    Container(width: 140, height: 14, decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(4))),
                                    const SizedBox(height: 8),
                                    Container(width: 80, height: 12, decoration: BoxDecoration(color: Colors.white10, borderRadius: BorderRadius.circular(4))),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                      ),
                      childCount: 4,
                    ),
                  ),
                )
              else if (filteredProducts.isEmpty)
                SliverToBoxAdapter(
                  child: Container(
                    margin: const EdgeInsets.symmetric(horizontal: 20, vertical: 20),
                    padding: const EdgeInsets.all(28),
                    decoration: BoxDecoration(
                      color: const Color(0xFF1E293B),
                      borderRadius: BorderRadius.circular(20),
                      border: Border.all(color: Colors.white10),
                    ),
                    child: Column(
                      children: [
                        Container(
                          padding: const EdgeInsets.all(16),
                          decoration: BoxDecoration(
                            color: AppTheme.primary.withValues(alpha: 0.12),
                            shape: BoxShape.circle,
                          ),
                          child: const Icon(Icons.storefront_rounded, size: 36, color: AppTheme.primary),
                        ),
                        const SizedBox(height: 14),
                        Text(
                          'Sin productos en esta sucursal',
                          style: GoogleFonts.outfit(
                            fontSize: 17,
                            fontWeight: FontWeight.w700,
                            color: Colors.white,
                          ),
                        ),
                        const SizedBox(height: 6),
                        Text(
                          _selectedBranch != null
                              ? 'La sede "${_selectedBranch!.name}" no tiene productos asignados en la base de datos.'
                              : 'No hay productos disponibles actualmente.',
                          textAlign: TextAlign.center,
                          style: GoogleFonts.outfit(
                            fontSize: 13,
                            color: const Color(0xFF94A3B8),
                          ),
                        ),
                      ],
                    ),
                  ),
                )
              else if (_isProductGridView)
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                  sliver: SliverGrid(
                    gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      crossAxisSpacing: 12,
                      mainAxisSpacing: 12,
                      childAspectRatio: 0.68,
                    ),
                    delegate: SliverChildBuilderDelegate(
                      (context, idx) {
                        final prod = filteredProducts[idx];
                        return Container(
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(18),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(18),
                            onTap: () => _openProductSheet(prod),
                            child: Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              children: [
                                Stack(
                                  children: [
                                    ClipRRect(
                                      borderRadius: const BorderRadius.vertical(top: Radius.circular(17)),
                                      child: Image.network(
                                        prod.imageUrl,
                                        height: 110,
                                        width: double.infinity,
                                        fit: BoxFit.cover,
                                        errorBuilder: (_, __, ___) => Container(height: 110, color: const Color(0xFF334155)),
                                      ),
                                    ),
                                    if (prod.isOnSale)
                                      Positioned(
                                        top: 6,
                                        left: 6,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFEF4444),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            prod.discountPercentage != null ? '🔥 ${prod.discountPercentage}% OFF' : '🔥 OFERTA',
                                            style: GoogleFonts.outfit(fontSize: 8.5, fontWeight: FontWeight.w900, color: Colors.white),
                                          ),
                                        ),
                                      )
                                    else if (prod.isPopular || prod.isFeatured)
                                      Positioned(
                                        top: 6,
                                        left: 6,
                                        child: Container(
                                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2.5),
                                          decoration: BoxDecoration(
                                            color: const Color(0xFFF59E0B),
                                            borderRadius: BorderRadius.circular(6),
                                          ),
                                          child: Text(
                                            '⭐ DESTACADO',
                                            style: GoogleFonts.outfit(fontSize: 8.5, fontWeight: FontWeight.w900, color: Colors.white),
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
                                        prod.name,
                                        style: GoogleFonts.outfit(fontSize: 13.5, fontWeight: FontWeight.w700, color: Colors.white),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 2),
                                      Text(
                                        prod.description,
                                        style: GoogleFonts.outfit(fontSize: 11, color: const Color(0xFF94A3B8)),
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                      ),
                                      const SizedBox(height: 6),
                                      Row(
                                        children: [
                                          Text(
                                            '\$${prod.price.toStringAsFixed(2)}',
                                            style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w900, color: storeAccent),
                                          ),
                                          if (prod.compareAtPrice != null && prod.compareAtPrice! > prod.price) ...[
                                            const SizedBox(width: 4),
                                            Text(
                                              '\$${prod.compareAtPrice!.toStringAsFixed(2)}',
                                              style: GoogleFonts.outfit(
                                                fontSize: 10.5,
                                                color: Colors.white38,
                                                decoration: TextDecoration.lineThrough,
                                              ),
                                            ),
                                          ],
                                        ],
                                      ),
                                      Text(
                                        'Bs. ${(prod.price * rate).toStringAsFixed(2)}',
                                        style: GoogleFonts.outfit(fontSize: 10, fontWeight: FontWeight.w600, color: const Color(0xFF65A30D)),
                                      ),
                                    ],
                                  ),
                                ),
                              ],
                            ),
                          ),
                        );
                      },
                      childCount: filteredProducts.length,
                    ),
                  ),
                )
              else
                SliverPadding(
                  padding: const EdgeInsets.fromLTRB(20, 0, 20, 100),
                  sliver: SliverList(
                    delegate: SliverChildBuilderDelegate(
                      (context, idx) {
                        final prod = filteredProducts[idx];
                        return Container(
                          margin: const EdgeInsets.only(bottom: 14),
                          decoration: BoxDecoration(
                            color: const Color(0xFF1E293B),
                            borderRadius: BorderRadius.circular(20),
                            border: Border.all(color: Colors.white10),
                          ),
                          child: InkWell(
                            borderRadius: BorderRadius.circular(20),
                            onTap: () => _openProductSheet(prod),
                            child: Padding(
                              padding: const EdgeInsets.all(12),
                              child: Row(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  // Thumbnail with badge
                                  Stack(
                                    children: [
                                      ClipRRect(
                                        borderRadius: BorderRadius.circular(16),
                                        child: Image.network(
                                          prod.imageUrl,
                                          width: 90,
                                          height: 90,
                                          fit: BoxFit.cover,
                                          errorBuilder: (_, __, ___) => Container(
                                            width: 90,
                                            height: 90,
                                            color: const Color(0xFF334155),
                                            child: const Icon(Icons.fastfood_rounded, color: Colors.white30),
                                          ),
                                        ),
                                      ),
                                      if (prod.isOnSale)
                                        Positioned(
                                          top: 6,
                                          left: 6,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFEF4444),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              prod.discountPercentage != null ? '🔥 ${prod.discountPercentage}% OFF' : '🔥 OFERTA',
                                              style: GoogleFonts.outfit(
                                                fontSize: 8.5,
                                                fontWeight: FontWeight.w900,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                        )
                                      else if (prod.isPopular || prod.isFeatured)
                                        Positioned(
                                          top: 6,
                                          left: 6,
                                          child: Container(
                                            padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                                            decoration: BoxDecoration(
                                              color: const Color(0xFFF59E0B),
                                              borderRadius: BorderRadius.circular(6),
                                            ),
                                            child: Text(
                                              '⭐ DESTACADO',
                                              style: GoogleFonts.outfit(
                                                fontSize: 8.5,
                                                fontWeight: FontWeight.w900,
                                                color: Colors.white,
                                              ),
                                            ),
                                          ),
                                        ),
                                    ],
                                  ),
                                  const SizedBox(width: 14),

                                  // Details
                                  Expanded(
                                    child: Column(
                                      crossAxisAlignment: CrossAxisAlignment.start,
                                      children: [
                                        Text(
                                          prod.name,
                                          style: GoogleFonts.outfit(
                                            fontSize: 16,
                                            fontWeight: FontWeight.w700,
                                            color: Colors.white,
                                          ),
                                        ),
                                        const SizedBox(height: 4),
                                        Text(
                                          prod.description,
                                          maxLines: 2,
                                          overflow: TextOverflow.ellipsis,
                                          style: GoogleFonts.outfit(
                                            fontSize: 12,
                                            color: const Color(0xFF94A3B8),
                                          ),
                                        ),
                                        const SizedBox(height: 8),
                                        Row(
                                          mainAxisAlignment: MainAxisAlignment.spaceBetween,
                                          children: [
                                            Column(
                                              crossAxisAlignment: CrossAxisAlignment.start,
                                              children: [
                                                Row(
                                                  children: [
                                                    Text(
                                                      '\$${prod.price.toStringAsFixed(2)}',
                                                      style: GoogleFonts.outfit(
                                                        fontSize: 16,
                                                        fontWeight: FontWeight.w900,
                                                        color: storeAccent,
                                                      ),
                                                    ),
                                                    if (prod.compareAtPrice != null && prod.compareAtPrice! > prod.price) ...[
                                                      const SizedBox(width: 6),
                                                      Text(
                                                        '\$${prod.compareAtPrice!.toStringAsFixed(2)}',
                                                        style: GoogleFonts.outfit(
                                                          fontSize: 11.5,
                                                          color: Colors.white38,
                                                          decoration: TextDecoration.lineThrough,
                                                        ),
                                                      ),
                                                    ],
                                                  ],
                                                ),
                                                Text(
                                                  'Bs. ${(prod.price * rate).toStringAsFixed(2)}',
                                                  style: GoogleFonts.outfit(
                                                    fontSize: 11,
                                                    fontWeight: FontWeight.w600,
                                                    color: const Color(0xFF65A30D),
                                                  ),
                                                ),
                                              ],
                                            ),
                                            Container(
                                              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
                                              decoration: BoxDecoration(
                                                color: storeAccent.withOpacity(0.12),
                                                borderRadius: BorderRadius.circular(10),
                                                border: Border.all(color: storeAccent.withOpacity(0.3)),
                                              ),
                                              child: Text(
                                                '+ Agregar',
                                                style: GoogleFonts.outfit(
                                                  fontSize: 12,
                                                  fontWeight: FontWeight.w700,
                                                  color: storeAccent,
                                                ),
                                              ),
                                            ),
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
                      },
                      childCount: filteredProducts.length,
                    ),
                  ),
                ),
            ],
          ),

          // Floating Cart Bar at bottom
          Positioned(
            left: 16,
            right: 16,
            bottom: 24,
            child: AnimatedBuilder(
              animation: CartService(),
              builder: (context, _) {
                final cart = CartService();
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
                        color: const Color(0xFFEA580C).withOpacity(0.4),
                        blurRadius: 20,
                        offset: const Offset(0, 8),
                      ),
                    ],
                  ),
                  child: InkWell(
                    onTap: _openCheckout,
                    child: Row(
                      mainAxisAlignment: MainAxisAlignment.spaceBetween,
                      children: [
                        Row(
                          children: [
                            Container(
                              padding: const EdgeInsets.all(8),
                              decoration: const BoxDecoration(
                                color: Colors.white24,
                                shape: BoxShape.circle,
                              ),
                              child: const Icon(Icons.shopping_bag_rounded, color: Colors.white, size: 20),
                            ),
                            const SizedBox(width: 12),
                            Column(
                              crossAxisAlignment: CrossAxisAlignment.start,
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Text(
                                  '${cart.totalItemCount} artículos en pedido',
                                  style: GoogleFonts.outfit(
                                    fontSize: 13,
                                    fontWeight: FontWeight.w600,
                                    color: Colors.white.withOpacity(0.9),
                                  ),
                                ),
                                Text(
                                  '\$${cart.subtotal.toStringAsFixed(2)}',
                                  style: GoogleFonts.outfit(
                                    fontSize: 17,
                                    fontWeight: FontWeight.w900,
                                    color: Colors.white,
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
                                fontSize: 15,
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
      ),
    );
  }

  Widget _buildBadge(IconData icon, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 4),
      decoration: BoxDecoration(
        color: const Color(0xFF1E293B),
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Colors.white10),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: color),
          const SizedBox(width: 4),
          Text(
            text,
            style: GoogleFonts.outfit(fontSize: 12, fontWeight: FontWeight.w700, color: Colors.white),
          ),
        ],
      ),
    );
  }
}
