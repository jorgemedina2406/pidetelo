import 'dart:convert';
import 'dart:math';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../models/order_model.dart';
import '../models/user_model.dart';
import '../models/branch_model.dart';
import 'api_service.dart';
import 'dolar_api_service.dart';

class RiderPayoutTransaction {
  final String id;
  final double amount;
  final String method; // 'Pago Móvil', 'Transferencia Bancaria', 'Zelle / Binance'
  final String destinationDetails;
  final DateTime date;
  final String status; // 'Completado', 'Procesando'

  RiderPayoutTransaction({
    required this.id,
    required this.amount,
    required this.method,
    required this.destinationDetails,
    required this.date,
    this.status = 'Completado',
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'amount': amount,
        'method': method,
        'destinationDetails': destinationDetails,
        'date': date.toIso8601String(),
        'status': status,
      };

  factory RiderPayoutTransaction.fromJson(Map<String, dynamic> json) =>
      RiderPayoutTransaction(
        id: json['id'] ?? '',
        amount: (json['amount'] as num?)?.toDouble() ?? 0.0,
        method: json['method'] ?? 'Pago Móvil',
        destinationDetails: json['destinationDetails'] ?? '',
        date: DateTime.tryParse(json['date'] ?? '') ?? DateTime.now(),
        status: json['status'] ?? 'Completado',
      );
}

class CartService extends ChangeNotifier {
  static final CartService _instance = CartService._internal();
  factory CartService() => _instance;
  CartService._internal();

  static const String _keyPayouts = 'rider_payout_history_v2';

  final List<CartItem> _items = [];
  List<Product> _storeProducts = [];
  String? _currentStoreName;
  Branch? _currentBranch;
  String? _currentCompanyId;
  String? _currentCompanyName;
  double? _currentStoreExchangeRate;
  String? _currentStoreDisplayMode;
  String? _currentStoreWhatsapp;
  String? _currentStoreAccentColor;
  double? _currentStoreBaseDeliveryFee;
  DeliveryAddress _selectedAddress = const DeliveryAddress(
    id: '',
    title: 'Sin dirección',
    address: 'Selecciona una dirección de entrega',
    latitude: 10.034574,
    longitude: -69.237544,
  );

  final List<DeliveryAddress> _savedAddresses = [];

  final List<DeliveryOrder> _orderHistory = [];
  final List<RiderPayoutTransaction> _payoutHistory = [];
  String? _currentAccountKey;

  // Active delivery order (shared between customer tracking and rider dashboard)
  DeliveryOrder? _activeOrder;
  Future<String?>? _pendingOrderSync;
  String? _pendingOrderNumber;

  List<CartItem> get items => List.unmodifiable(_items);
  String? get currentStoreName => _currentStoreName;
  Branch? get currentBranch => _currentBranch;
  String? get currentBranchId => _currentBranch?.id;
  String? get currentBranchName => _currentBranch?.name;
  String? get currentBranchAddress => _currentBranch?.address;
  String? get currentBranchPhone => _currentBranch?.phone;
  double? get currentBranchLat => _currentBranch?.latitude;
  double? get currentBranchLng => _currentBranch?.longitude;
  BranchPaymentCredentials? get currentBranchPayment => _currentBranch?.paymentCredentials;
  String? get currentCompanyId => _currentCompanyId;
  String? get currentCompanyName => _currentCompanyName;
  double? get currentStoreExchangeRate => _currentStoreExchangeRate;
  String get currentStoreDisplayMode => _currentStoreDisplayMode ?? 'usd_and_bs';
  String? get currentStoreWhatsapp => _currentStoreWhatsapp;
  String? get currentStoreAccentColor => _currentStoreAccentColor;
  double? get currentStoreBaseDeliveryFee => _currentStoreBaseDeliveryFee;

  double get effectiveExchangeRate =>
      (_currentStoreExchangeRate != null && _currentStoreExchangeRate! > 0)
          ? _currentStoreExchangeRate!
          : DolarApiService().officialRate;

  DeliveryAddress get selectedAddress => _selectedAddress;
  bool get hasValidDeliveryAddress =>
      _selectedAddress.id.isNotEmpty &&
      !_selectedAddress.title.toLowerCase().contains('sin dirección') &&
      !_selectedAddress.address.toLowerCase().contains('selecciona una dirección') &&
      _selectedAddress.latitude != 0.0 &&
      _selectedAddress.longitude != 0.0;
  List<DeliveryAddress> get savedAddresses => List.unmodifiable(_savedAddresses);
  DeliveryOrder? get activeOrder => _activeOrder;
  bool get hasActiveOrder => _activeOrder != null;
  List<DeliveryOrder> get orderHistory => List.unmodifiable(_orderHistory);
  List<RiderPayoutTransaction> get payoutHistory => List.unmodifiable(_payoutHistory);

  int get totalItemCount => _items.fold(0, (sum, item) => sum + item.quantity);
  double get subtotal => _items.fold(0.0, (sum, item) => sum + item.totalPrice);

  List<Product> get storeProducts => List.unmodifiable(_storeProducts);

  void setStoreProducts(List<Product> prods) {
    _storeProducts = List.from(prods);
    notifyListeners();
  }

  List<Product> get suggestedProducts {
    if (_items.isEmpty || _storeProducts.isEmpty) return [];
    final inCartIds = _items.map((i) => i.product.id).toSet();
    final candidates = _storeProducts.where((p) => !inCartIds.contains(p.id)).toList();
    candidates.sort((a, b) {
      final aScore = (a.isOnSale ? 3 : 0) + (a.isPopular ? 2 : 0) + (a.isFeatured ? 1 : 0);
      final bScore = (b.isOnSale ? 3 : 0) + (b.isPopular ? 2 : 0) + (b.isFeatured ? 1 : 0);
      return bScore.compareTo(aScore);
    });
    return candidates.take(5).toList();
  }

  double? get distanceToCurrentBranchKm {
    if (_currentBranch == null) return null;
    return double.parse(_currentBranch!.distanceKmTo(_selectedAddress.latitude, _selectedAddress.longitude).toStringAsFixed(1));
  }

  double get maxCoverageRadiusKm {
    if (_currentBranch == null) return 8.0;
    double maxRadius = _currentBranch!.deliveryRadiusKm;
    for (final tier in _currentBranch!.deliveryTiers) {
      if (tier.maxKm > maxRadius) {
        maxRadius = tier.maxKm;
      }
    }
    return maxRadius > 0 ? maxRadius : 8.0;
  }

  bool get isOutOfCoverage {
    if (_currentBranch == null) return false;
    final dist = distanceToCurrentBranchKm;
    if (dist == null) return false;
    return dist > maxCoverageRadiusKm;
  }

  DeliveryTier? get appliedDeliveryTier {
    final dist = distanceToCurrentBranchKm;
    if (dist == null || _currentBranch == null) return null;
    for (final tier in _currentBranch!.deliveryTiers) {
      if (dist >= tier.minKm && dist <= tier.maxKm) {
        return tier;
      }
    }
    if (_currentBranch!.deliveryTiers.isNotEmpty) {
      final maxTier = _currentBranch!.deliveryTiers.reduce((a, b) => a.maxKm > b.maxKm ? a : b);
      if (dist > maxTier.maxKm) return maxTier;
    }
    return null;
  }

  double get deliveryFee {
    if (_items.isEmpty) return 0.0;
    if (isOutOfCoverage) return 0.0;
    final tier = appliedDeliveryTier;
    if (tier != null) {
      return tier.price;
    }
    if (_currentBranch != null) {
      return _currentBranch!.baseDeliveryFee;
    }
    if (_currentStoreBaseDeliveryFee != null && _currentStoreBaseDeliveryFee! > 0) {
      return _currentStoreBaseDeliveryFee!;
    }
    return 2.50;
  }
  double get grandTotal => subtotal + deliveryFee;
  double get grandTotalBs => grandTotal * effectiveExchangeRate;

  // Real computed Rider statistics
  int get completedDeliveriesCount =>
      _orderHistory.where((o) => o.status == OrderDeliveryStatus.delivered).length;

  double get totalRiderEarnings => _orderHistory
      .where((o) => o.status == OrderDeliveryStatus.delivered)
      .fold(0.0, (sum, o) => sum + o.deliveryFee);

  double get totalRiderTips => _orderHistory
      .where((o) => o.status == OrderDeliveryStatus.delivered)
      .fold(0.0, (sum, o) => sum + (o.total * 0.05)); // 5% avg customer tip

  double get totalWithdrawn =>
      _payoutHistory.fold(0.0, (sum, p) => sum + p.amount);

  double get availableWalletBalance {
    final bal = (totalRiderEarnings + totalRiderTips) - totalWithdrawn;
    return bal < 0.0 ? 0.0 : bal;
  }

  static const String _keyGlobalSavedAddresses = 'global_saved_delivery_addresses';
  static const String _keyGlobalSelectedAddress = 'global_selected_delivery_address';

  String _getOrdersKey(String? identifier) {
    if (identifier == null || identifier.trim().isEmpty) return 'user_orders_guest';
    final sanitized = identifier.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), '_');
    return 'user_orders_$sanitized';
  }

  String _getAddressesKey(String? identifier) {
    if (identifier == null || identifier.trim().isEmpty) return 'user_addresses_guest';
    final sanitized = identifier.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), '_');
    return 'user_addresses_$sanitized';
  }

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final payoutsJson = prefs.getString(_keyPayouts);
      if (payoutsJson != null) {
        final List pList = jsonDecode(payoutsJson);
        _payoutHistory.clear();
        for (final item in pList) {
          try {
            _payoutHistory.add(RiderPayoutTransaction.fromJson(item));
          } catch (e) {
            debugPrint('[CartService] Error parsing payout: $e');
          }
        }
      }

      // Load saved addresses and selected address globally
      final globalAddrsJson = prefs.getString(_keyGlobalSavedAddresses);
      if (globalAddrsJson != null) {
        try {
          final List aList = jsonDecode(globalAddrsJson);
          _savedAddresses.clear();
          for (final a in aList) {
            _savedAddresses.add(DeliveryAddress.fromJson(a));
          }
        } catch (_) {}
      }

      final globalSelJson = prefs.getString(_keyGlobalSelectedAddress);
      if (globalSelJson != null) {
        try {
          _selectedAddress = DeliveryAddress.fromJson(jsonDecode(globalSelJson));
        } catch (_) {}
      } else if (_savedAddresses.isNotEmpty) {
        _selectedAddress = _savedAddresses.first;
      }

      // Sync addresses with cloud if authenticated
      syncAddressesWithCloud();
    } catch (e) {
      debugPrint('[CartService] Init error: $e');
    }

    notifyListeners();
  }

  Future<void> loadUserOrders(String identifier, {String? phone}) async {
    _currentAccountKey = identifier;
    _orderHistory.clear();
    _activeOrder = null;

    final prefs = await SharedPreferences.getInstance();
    final key = _getOrdersKey(identifier);
    final ordersJson = prefs.getString(key);
    if (ordersJson != null) {
      try {
        final List list = jsonDecode(ordersJson);
        for (final item in list) {
          _orderHistory.add(DeliveryOrder.fromJson(item));
        }
      } catch (e) {
        debugPrint('[CartService] Error parsing user orders: $e');
      }
    }

    try {
      _activeOrder = _orderHistory.firstWhere(
        (o) => o.status != OrderDeliveryStatus.delivered,
      );
    } catch (_) {
      _activeOrder = null;
    }

    // Load addresses specifically for this user, falling back to global addresses if empty
    final addrKey = _getAddressesKey(identifier);
    final addrsJson = prefs.getString(addrKey);
    if (addrsJson != null) {
      try {
        final List aList = jsonDecode(addrsJson);
        if (aList.isNotEmpty) {
          _savedAddresses.clear();
          for (final a in aList) {
            _savedAddresses.add(DeliveryAddress.fromJson(a));
          }
        }
      } catch (e) {
        debugPrint('[CartService] Error parsing user addresses: $e');
      }
    }

    if (_savedAddresses.isEmpty) {
      final globalAddrsJson = prefs.getString(_keyGlobalSavedAddresses);
      if (globalAddrsJson != null) {
        try {
          final List aList = jsonDecode(globalAddrsJson);
          for (final a in aList) {
            _savedAddresses.add(DeliveryAddress.fromJson(a));
          }
        } catch (_) {}
      }
    }

    final globalSelJson = prefs.getString(_keyGlobalSelectedAddress);
    if (globalSelJson != null) {
      try {
        _selectedAddress = DeliveryAddress.fromJson(jsonDecode(globalSelJson));
      } catch (_) {}
    } else if (_savedAddresses.isNotEmpty) {
      _selectedAddress = _savedAddresses.first;
    }

    // Sync from Supabase Cloud for this user's phone or identifier
    final searchTarget = (phone != null && phone.trim().isNotEmpty) ? phone : identifier;
    if (searchTarget.trim().isNotEmpty) {
      await syncOrdersWithCloud(searchTarget);
    }
    await syncAddressesWithCloud();

    notifyListeners();
  }

  void clearOrders() {
    _currentAccountKey = null;
    _orderHistory.clear();
    _activeOrder = null;
    _items.clear();
    notifyListeners();
  }

  Future<void> syncOrdersWithCloud(String phoneOrName) async {
    try {
      final cloudOrders = await ApiService().fetchUserOrdersFromCloud(phoneOrName);
      // Synchronize with cloud: if the user deleted orders in the cloud DB,
      // local order history should reflect reality (not preserve zombie orders).
      _orderHistory.clear();
      _orderHistory.addAll(cloudOrders);
      _orderHistory.sort((a, b) => b.createdAt.compareTo(a.createdAt));
      try {
        _activeOrder = _orderHistory.firstWhere(
          (o) => o.status != OrderDeliveryStatus.delivered,
        );
      } catch (_) {
        _activeOrder = null;
      }
      await _saveOrders();
      notifyListeners();
    } catch (e) {
      debugPrint('[CartService] syncOrdersWithCloud error: $e');
    }
  }

  Future<void> _saveOrders() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getOrdersKey(_currentAccountKey);
      final encoded = jsonEncode(_orderHistory.map((o) => o.toJson()).toList());
      await prefs.setString(key, encoded);
    } catch (e) {
      debugPrint('[CartService] Error saving orders: $e');
    }
  }

  Future<void> _savePayouts() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = jsonEncode(_payoutHistory.map((p) => p.toJson()).toList());
      await prefs.setString(_keyPayouts, encoded);
    } catch (e) {
      debugPrint('[CartService] Error saving payouts: $e');
    }
  }

  bool isDifferentStore({Branch? branch, String? storeName, String? companyId}) {
    if (_items.isEmpty) return false;

    // 1. Validar por Company / Tenant ID
    final targetCompId = branch?.companyId ?? companyId;
    if (_currentCompanyId != null &&
        targetCompId != null &&
        _currentCompanyId!.isNotEmpty &&
        targetCompId.isNotEmpty) {
      if (_currentCompanyId != targetCompId) return true;
    }

    // 2. Validar por Sucursal (Branch ID)
    if (branch != null && _currentBranch != null) {
      if (_currentBranch!.id.isNotEmpty &&
          branch.id.isNotEmpty &&
          _currentBranch!.id != branch.id) {
        return true;
      }
    }

    // 3. Comparación por nombre comercial
    if (storeName != null && _currentStoreName != null) {
      final cur = _currentStoreName!.toLowerCase().trim();
      final target = storeName.toLowerCase().trim();
      if (cur.isNotEmpty && target.isNotEmpty) {
        final curBase = cur.split('-').first.trim();
        final targetBase = target.split('-').first.trim();
        if (curBase != targetBase && !cur.contains(target) && !target.contains(cur)) {
          return true;
        }
      }
    }

    return false;
  }

  void clearForNewStore({
    Branch? branch,
    String? storeName,
    String? companyId,
    String? companyName,
    double? exchangeRate,
    String? displayMode,
    String? whatsapp,
    String? accentColor,
    double? baseDeliveryFee,
  }) {
    _items.clear();
    _currentBranch = branch;
    _currentCompanyId = branch?.companyId ?? companyId;
    _currentCompanyName = branch?.companyName ?? companyName;
    _currentStoreName = branch != null
        ? '${branch.companyName} - ${branch.name}'
        : (storeName ?? 'Comercio');
    if (exchangeRate != null && exchangeRate > 0) _currentStoreExchangeRate = exchangeRate;
    if (displayMode != null && displayMode.isNotEmpty) _currentStoreDisplayMode = displayMode;
    if (whatsapp != null && whatsapp.isNotEmpty) _currentStoreWhatsapp = whatsapp;
    if (accentColor != null && accentColor.isNotEmpty) _currentStoreAccentColor = accentColor;
    if (baseDeliveryFee != null && baseDeliveryFee > 0) _currentStoreBaseDeliveryFee = baseDeliveryFee;
    notifyListeners();
    saveCartToStorage();
  }

  void setBranch(Branch? branch, {bool force = false}) {
    if (branch == null) return;
    if (_currentBranch?.id == branch.id) {
      // Even if ID matches, ALWAYS refresh live branch details (e.g. updated payment credentials, schedules)
      _currentBranch = branch;
      notifyListeners();
      return;
    }

    // Si el carrito ya tiene productos y no se fuerza, preservamos el carrito de la sede actual
    if (_items.isNotEmpty && !force) {
      return;
    }

    if (force && _items.isNotEmpty) {
      _items.clear();
    }

    _currentBranch = branch;
    _currentStoreName = '${branch.companyName} - ${branch.name}';
    _currentCompanyId = branch.companyId;
    _currentCompanyName = branch.companyName;
    notifyListeners();
    saveCartToStorage();
  }

  void updateBranchPayment(BranchPaymentCredentials credentials) {
    if (_currentBranch != null) {
      _currentBranch = _currentBranch!.copyWith(
        paymentCredentials: credentials,
      );
      notifyListeners();
    }
  }

  void setStoreMetadata({
    double? exchangeRate,
    String? displayMode,
    String? whatsapp,
    String? accentColor,
    double? baseDeliveryFee,
  }) {
    if (exchangeRate != null && exchangeRate > 0) _currentStoreExchangeRate = exchangeRate;
    if (displayMode != null && displayMode.isNotEmpty) _currentStoreDisplayMode = displayMode;
    if (whatsapp != null && whatsapp.isNotEmpty) _currentStoreWhatsapp = whatsapp;
    if (accentColor != null && accentColor.isNotEmpty) _currentStoreAccentColor = accentColor;
    if (baseDeliveryFee != null && baseDeliveryFee > 0) _currentStoreBaseDeliveryFee = baseDeliveryFee;
    notifyListeners();
  }

  void addItem(
    Product product, {
    int quantity = 1,
    List<ProductOption> options = const [],
    List<SelectedProductModifier> modifiers = const [],
    String? notes,
    String? storeName,
    Branch? branch,
    double? exchangeRate,
    String? displayMode,
    String? whatsapp,
    String? accentColor,
    double? baseDeliveryFee,
  }) {
    if (exchangeRate != null && exchangeRate > 0) _currentStoreExchangeRate = exchangeRate;
    if (displayMode != null && displayMode.isNotEmpty) _currentStoreDisplayMode = displayMode;
    if (whatsapp != null && whatsapp.isNotEmpty) _currentStoreWhatsapp = whatsapp;
    if (accentColor != null && accentColor.isNotEmpty) _currentStoreAccentColor = accentColor;
    if (baseDeliveryFee != null && baseDeliveryFee > 0) _currentStoreBaseDeliveryFee = baseDeliveryFee;

    if (branch != null) {
      if (_currentBranch != null && _currentBranch!.id != branch.id) {
        // Enforce strict single-branch locking: clear previous items from different branch
        _items.clear();
      }
      _currentBranch = branch;
      _currentCompanyId = branch.companyId;
      _currentCompanyName = branch.companyName;
      _currentStoreName = '${branch.companyName} - ${branch.name}';
    } else if (_currentStoreName != null && storeName != null && _currentStoreName != storeName) {
      _items.clear();
      _currentStoreName = storeName;
    } else if (storeName != null) {
      _currentStoreName = storeName;
    }

    final existingIndex = _items.indexWhere((i) {
      if (i.product.id != product.id || i.notes != notes) return false;
      if (i.selectedModifiers.length != modifiers.length) return false;
      for (final m in modifiers) {
        if (!i.selectedModifiers.any(
            (im) => im.groupId == m.groupId && im.optionId == m.optionId)) {
          return false;
        }
      }
      return true;
    });

    if (existingIndex != -1) {
      _items[existingIndex].quantity += quantity;
    } else {
      _items.add(CartItem(
        product: product,
        quantity: quantity,
        selectedOptions: options,
        selectedModifiers: modifiers,
        notes: notes,
      ));
    }
    notifyListeners();
    saveCartToStorage();
  }

  void updateQuantity(int index, int delta) {
    if (index < 0 || index >= _items.length) return;
    _items[index].quantity += delta;
    if (_items[index].quantity <= 0) {
      _items.removeAt(index);
      if (_items.isEmpty) {
        _currentStoreName = null;
        _currentBranch = null;
        _currentCompanyId = null;
        _currentCompanyName = null;
      }
    }
    notifyListeners();
    saveCartToStorage();
  }

  void removeItem(int index) {
    if (index >= 0 && index < _items.length) {
      _items.removeAt(index);
      if (_items.isEmpty) {
        _currentStoreName = null;
        _currentBranch = null;
        _currentCompanyId = null;
        _currentCompanyName = null;
        _currentStoreExchangeRate = null;
        _currentStoreDisplayMode = null;
        _currentStoreWhatsapp = null;
        _currentStoreAccentColor = null;
        _currentStoreBaseDeliveryFee = null;
      }
      notifyListeners();
      saveCartToStorage();
    }
  }

  void clearCart() {
    _items.clear();
    _currentStoreName = null;
    _currentBranch = null;
    _currentCompanyId = null;
    _currentCompanyName = null;
    _currentStoreExchangeRate = null;
    _currentStoreDisplayMode = null;
    _currentStoreWhatsapp = null;
    _currentStoreAccentColor = null;
    _currentStoreBaseDeliveryFee = null;
    notifyListeners();
    discardSavedCart();
  }

  static String _getCartKey(String? identifier) => 'customer_pending_cart_${identifier ?? "default"}';

  Future<void> saveCartToStorage() async {
    try {
      final key = _getCartKey(_currentAccountKey);
      final prefs = await SharedPreferences.getInstance();
      if (_items.isEmpty) {
        await prefs.remove(key);
        // Eliminar también de Supabase
        try {
          final user = Supabase.instance.client.auth.currentUser;
          if (user != null) {
            await Supabase.instance.client.from('customer_carts').delete().eq('user_id', user.id);
          }
        } catch (_) {}
        return;
      }

      final payload = {
        'items': _items.map((i) => i.toJson()).toList(),
        'storeName': _currentStoreName,
        'branch': _currentBranch?.toJson(),
        'companyId': _currentCompanyId,
        'companyName': _currentCompanyName,
        'exchangeRate': _currentStoreExchangeRate,
        'displayMode': _currentStoreDisplayMode,
        'whatsapp': _currentStoreWhatsapp,
        'accentColor': _currentStoreAccentColor,
        'baseDeliveryFee': _currentStoreBaseDeliveryFee,
        'updatedAt': DateTime.now().toIso8601String(),
      };
      await prefs.setString(key, jsonEncode(payload));

      // Sincronizar en la nube con Supabase (Tabla customer_carts)
      try {
        final user = Supabase.instance.client.auth.currentUser;
        if (user != null) {
          await Supabase.instance.client.from('customer_carts').upsert({
            'user_id': user.id,
            'user_email': user.email,
            'tenant_id': _currentCompanyId,
            'branch_id': _currentBranch?.id,
            'store_name': _currentStoreName,
            'items': _items.map((i) => i.toJson()).toList(),
            'items_count': _items.length,
            'subtotal': subtotal,
            'exchange_rate': _currentStoreExchangeRate,
            'delivery_fee': deliveryFee,
            'updated_at': DateTime.now().toIso8601String(),
          }, onConflict: 'user_id');
        }
      } catch (dbErr) {
        debugPrint('[CartService] Sync to Supabase customer_carts note: $dbErr');
      }
    } catch (e) {
      debugPrint('[CartService] Error saving cart to storage: $e');
    }
  }

  Future<Map<String, dynamic>?> getPendingSavedCart({String? identifier}) async {
    try {
      final key = _getCartKey(identifier ?? _currentAccountKey);
      final prefs = await SharedPreferences.getInstance();
      final raw = prefs.getString(key);
      if (raw != null) {
        final decoded = jsonDecode(raw) as Map<String, dynamic>;
        final items = decoded['items'] as List?;
        if (items != null && items.isNotEmpty) return decoded;
      }

      // Fallback a consultar en Supabase (si cambió de teléfono o reinstaló la app)
      try {
        final user = Supabase.instance.client.auth.currentUser;
        if (user != null) {
          final res = await Supabase.instance.client
              .from('customer_carts')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();

          if (res != null && res['items'] is List && (res['items'] as List).isNotEmpty) {
            return {
              'items': res['items'],
              'storeName': res['store_name'],
              'companyId': res['tenant_id'],
              'branchId': res['branch_id'],
              'exchangeRate': res['exchange_rate'],
              'baseDeliveryFee': res['delivery_fee'],
            };
          }
        }
      } catch (_) {}

      return null;
    } catch (e) {
      return null;
    }
  }

  Future<bool> restoreSavedCart({String? identifier}) async {
    try {
      final data = await getPendingSavedCart(identifier: identifier);
      if (data == null) return false;

      final itemsRaw = data['items'] as List;
      _items.clear();
      for (final i in itemsRaw) {
        _items.add(CartItem.fromJson(Map<String, dynamic>.from(i as Map)));
      }

      _currentStoreName = data['storeName']?.toString();
      _currentCompanyId = data['companyId']?.toString();
      _currentCompanyName = data['companyName']?.toString();
      _currentStoreExchangeRate = (data['exchangeRate'] as num?)?.toDouble();
      _currentStoreDisplayMode = data['displayMode']?.toString();
      _currentStoreWhatsapp = data['whatsapp']?.toString();
      _currentStoreAccentColor = data['accentColor']?.toString();
      _currentStoreBaseDeliveryFee = (data['baseDeliveryFee'] as num?)?.toDouble();

      if (data['branch'] is Map) {
        _currentBranch = Branch.fromJson(Map<String, dynamic>.from(data['branch'] as Map));
      }

      notifyListeners();
      return true;
    } catch (e) {
      debugPrint('[CartService] Error restoring cart: $e');
      return false;
    }
  }

  Future<void> discardSavedCart({String? identifier}) async {
    try {
      final key = _getCartKey(identifier ?? _currentAccountKey);
      final prefs = await SharedPreferences.getInstance();
      await prefs.remove(key);

      // Eliminar también de Supabase
      try {
        final user = Supabase.instance.client.auth.currentUser;
        if (user != null) {
          await Supabase.instance.client.from('customer_carts').delete().eq('user_id', user.id);
        }
      } catch (_) {}
    } catch (e) {
      debugPrint('[CartService] Error discarding cart: $e');
    }
  }

  Future<void> _saveAddresses() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final encoded = jsonEncode(_savedAddresses.map((a) => a.toJson()).toList());
      // 1. Always save to global key so addresses persist reliably across sessions/logins
      await prefs.setString(_keyGlobalSavedAddresses, encoded);

      // 2. Save for specific user account if signed in
      if (_currentAccountKey != null && _currentAccountKey!.isNotEmpty) {
        final key = _getAddressesKey(_currentAccountKey);
        await prefs.setString(key, encoded);
      }

      // 3. Persist the currently selected address
      await prefs.setString(_keyGlobalSelectedAddress, jsonEncode(_selectedAddress.toJson()));
    } catch (e) {
      debugPrint('[CartService] Error saving addresses: $e');
    }
  }

  Future<void> _pushAddressesToCloud() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      final addrJson = _savedAddresses.map((a) => a.toJson()).toList();
      final selJson = _selectedAddress.toJson();

      // 1. Update Supabase Auth user metadata
      try {
        await Supabase.instance.client.auth.updateUser(
          UserAttributes(data: {
            'saved_addresses': addrJson,
            'selected_address': selJson,
          }),
        );
      } catch (e) {
        debugPrint('[CartService] Error updating user metadata addresses: $e');
      }

      // 2. Read-merge-upsert customer_carts metadata in Supabase (preserves favorite_store_ids, etc.)
      try {
        final existingCart = await Supabase.instance.client
            .from('customer_carts')
            .select('metadata, user_email')
            .eq('user_id', user.id)
            .maybeSingle();

        final existingMeta = (existingCart != null && existingCart['metadata'] is Map)
            ? Map<String, dynamic>.from(existingCart['metadata'] as Map)
            : <String, dynamic>{};

        existingMeta['saved_addresses'] = addrJson;
        existingMeta['selected_address'] = selJson;

        await Supabase.instance.client.from('customer_carts').upsert(
          {
            'user_id': user.id,
            'user_email': user.email ?? existingCart?['user_email'],
            'metadata': existingMeta,
            'updated_at': DateTime.now().toIso8601String(),
          },
          onConflict: 'user_id',
        );
      } catch (e) {
        debugPrint('[CartService] Error updating customer_carts metadata: $e');
      }
    } catch (e) {
      debugPrint('[CartService] _pushAddressesToCloud error: $e');
    }
  }

  Future<void> syncAddressesWithCloud() async {
    try {
      final user = Supabase.instance.client.auth.currentUser;
      if (user == null) return;

      bool hasChanges = false;
      final List<DeliveryAddress> cloudAddrs = [];
      DeliveryAddress? cloudSelected;

      // 1. Fetch from user metadata
      final meta = user.userMetadata;
      if (meta != null && meta['saved_addresses'] != null) {
        try {
          final dynamic raw = meta['saved_addresses'];
          final List list = raw is String ? jsonDecode(raw) : (raw as List);
          for (final a in list) {
            cloudAddrs.add(DeliveryAddress.fromJson(Map<String, dynamic>.from(a)));
          }
        } catch (e) {
          debugPrint('[CartService] Error parsing metadata saved_addresses: $e');
        }
      }

      if (meta != null && meta['selected_address'] != null) {
        try {
          final dynamic raw = meta['selected_address'];
          final Map<String, dynamic> selData = raw is String ? jsonDecode(raw) : Map<String, dynamic>.from(raw);
          cloudSelected = DeliveryAddress.fromJson(selData);
        } catch (_) {}
      }

      // 2. Fetch from customer_carts metadata
      try {
        final cartRes = await Supabase.instance.client
            .from('customer_carts')
            .select('metadata')
            .eq('user_id', user.id)
            .maybeSingle();
        if (cartRes != null && cartRes['metadata'] != null) {
          final cartMeta = cartRes['metadata'];
          if (cartMeta['saved_addresses'] != null) {
            final dynamic raw = cartMeta['saved_addresses'];
            final List list = raw is String ? jsonDecode(raw) : (raw as List);
            for (final a in list) {
              final parsed = DeliveryAddress.fromJson(Map<String, dynamic>.from(a));
              if (!cloudAddrs.any((x) => x.id == parsed.id)) {
                cloudAddrs.add(parsed);
              }
            }
          }
          if (cloudSelected == null && cartMeta['selected_address'] != null) {
            final dynamic raw = cartMeta['selected_address'];
            final Map<String, dynamic> selData = raw is String ? jsonDecode(raw) : Map<String, dynamic>.from(raw);
            cloudSelected = DeliveryAddress.fromJson(selData);
          }
        }
      } catch (e) {
        debugPrint('[CartService] Error fetching customer_carts metadata: $e');
      }

      // Merge cloud addresses with local
      if (cloudAddrs.isNotEmpty) {
        for (final ca in cloudAddrs) {
          final idx = _savedAddresses.indexWhere((a) => a.id == ca.id);
          if (idx == -1) {
            _savedAddresses.add(ca);
            hasChanges = true;
          } else {
            _savedAddresses[idx] = ca;
            hasChanges = true;
          }
        }
      }

      if (cloudSelected != null && cloudSelected.id.isNotEmpty) {
        _selectedAddress = cloudSelected;
        hasChanges = true;
      } else if (!hasValidDeliveryAddress && _savedAddresses.isNotEmpty) {
        _selectedAddress = _savedAddresses.first;
        hasChanges = true;
      }

      // If local had addresses that cloud didn't have, push them to cloud
      if (_savedAddresses.isNotEmpty && (cloudAddrs.length < _savedAddresses.length)) {
        await _pushAddressesToCloud();
      }

      if (hasChanges) {
        await _saveAddresses();
        notifyListeners();
      }
    } catch (e) {
      debugPrint('[CartService] syncAddressesWithCloud error: $e');
    }
  }

  void selectAddress(DeliveryAddress address) {
    _selectedAddress = address;
    if (hasValidDeliveryAddress) {
      final idx = _savedAddresses.indexWhere((a) => a.id == address.id);
      if (idx == -1) {
        _savedAddresses.insert(0, address);
      } else {
        _savedAddresses[idx] = address;
      }
    }
    _saveAddresses();
    _pushAddressesToCloud();
    notifyListeners();
  }

  Future<void> addSavedAddress(DeliveryAddress address) async {
    final idx = _savedAddresses.indexWhere((a) => a.id == address.id);
    if (idx != -1) {
      _savedAddresses[idx] = address;
    } else {
      _savedAddresses.insert(0, address);
    }
    _selectedAddress = address;
    await _saveAddresses();
    await _pushAddressesToCloud();
    notifyListeners();
  }

  Future<void> updateSavedAddress(DeliveryAddress address) async {
    final idx = _savedAddresses.indexWhere((a) => a.id == address.id);
    if (idx != -1) {
      _savedAddresses[idx] = address;
      if (_selectedAddress.id == address.id) {
        _selectedAddress = address;
      }
      await _saveAddresses();
      await _pushAddressesToCloud();
      notifyListeners();
    }
  }

  Future<void> deleteSavedAddress(String id) async {
    _savedAddresses.removeWhere((a) => a.id == id);
    if (_selectedAddress.id == id && _savedAddresses.isNotEmpty) {
      _selectedAddress = _savedAddresses.first;
    }
    await _saveAddresses();
    await _pushAddressesToCloud();
    notifyListeners();
  }

  void appendItemsToActiveOrder(
    String orderId,
    List<CartItem> newItems,
    double extraAmount, {
    String? appendedNote,
  }) {
    final idx = _orderHistory.indexWhere((o) => o.id == orderId || o.orderNumber == orderId);
    if (idx != -1) {
      final old = _orderHistory[idx];
      final updatedItems = List<CartItem>.from(old.items)..addAll(newItems);
      String? updatedNotes = old.notes;
      if (appendedNote != null && appendedNote.trim().isNotEmpty) {
        final existing = (old.notes ?? '').trim();
        updatedNotes = existing.isEmpty ? appendedNote.trim() : '$existing\n${appendedNote.trim()}';
      }
      final updated = old.copyWith(
        items: updatedItems,
        subtotal: old.subtotal + extraAmount,
        total: old.total + extraAmount,
        notes: updatedNotes,
      );
      _orderHistory[idx] = updated;
      if (_activeOrder?.id == orderId || _activeOrder?.orderNumber == orderId) {
        _activeOrder = updated;
      }
      _saveOrders();
      notifyListeners();
    }
  }

  void updateOrderPin(String orderNumber, String pin) {
    final cleanPin = pin.trim();
    if (!RegExp(r'^\d{4}$').hasMatch(cleanPin)) return;
    bool changed = false;
    final idx = _orderHistory.indexWhere((o) => o.orderNumber == orderNumber);
    if (idx != -1 && _orderHistory[idx].pin != cleanPin) {
      _orderHistory[idx] = _orderHistory[idx].copyWith(pin: cleanPin);
      changed = true;
    }
    if (_activeOrder?.orderNumber == orderNumber && _activeOrder?.pin != cleanPin) {
      _activeOrder = _activeOrder!.copyWith(pin: cleanPin);
      changed = true;
    }
    if (changed) {
      _saveOrders();
      notifyListeners();
    }
  }

  void updateOrderCloudId(String orderNumber, String realUuid) {
    if (realUuid.isEmpty) return;
    bool changed = false;
    final idx = _orderHistory.indexWhere((o) => o.orderNumber == orderNumber);
    if (idx != -1 && _orderHistory[idx].id != realUuid) {
      _orderHistory[idx] = _orderHistory[idx].copyWith(id: realUuid);
      changed = true;
    }
    if (_activeOrder?.orderNumber == orderNumber && _activeOrder?.id != realUuid) {
      _activeOrder = _activeOrder!.copyWith(id: realUuid);
      changed = true;
    }
    if (changed) {
      _saveOrders();
      notifyListeners();
    }
  }

  void updateOrderStatus(OrderDeliveryStatus newStatus, {String? orderId}) {
    if (orderId != null) {
      final idx = _orderHistory.indexWhere((o) => o.id == orderId);
      if (idx != -1) {
        _orderHistory[idx].status = newStatus;
      }
      if (_activeOrder?.id == orderId) {
        _activeOrder!.status = newStatus;
      }
    } else if (_activeOrder != null) {
      _activeOrder!.status = newStatus;
      final idx = _orderHistory.indexWhere((o) => o.id == _activeOrder!.id);
      if (idx != -1) {
        _orderHistory[idx].status = newStatus;
      }
    }
    _saveOrders();
    notifyListeners();
  }

  Future<String?> waitForPendingOrderSync(String orderNumber) async {
    final cleanTarget = orderNumber.replaceAll('#', '').trim();
    final cleanPending = (_pendingOrderNumber ?? '').replaceAll('#', '').trim();
    if (_pendingOrderSync != null && cleanPending.isNotEmpty && cleanPending == cleanTarget) {
      return await _pendingOrderSync;
    }
    return null;
  }

  DeliveryOrder _buildAndQueueOrder({
    required String paymentMethod,
    AppUser? user,
    String? notes,
    String? paymentReference,
    String? paymentOriginBank,
  }) {
    if (user != null) {
      _currentAccountKey = user.email.isNotEmpty ? user.email : user.id;
    }

    final now = DateTime.now();
    final orderDigits = '${(now.millisecondsSinceEpoch % 9000) + 1000}';
    final rng = Random.secure();
    String newPin = '${1000 + rng.nextInt(9000)}';
    while (newPin == orderDigits || newPin == '1234' || newPin == '0000') {
      newPin = '${1000 + rng.nextInt(9000)}';
    }

    final String branchName = _currentBranch != null
        ? (_currentBranch!.name.toLowerCase().contains(_currentBranch!.companyName.toLowerCase())
            ? _currentBranch!.name
            : '${_currentBranch!.companyName} - ${_currentBranch!.name}')
        : (_currentStoreName?.isNotEmpty == true ? _currentStoreName! : 'Comercio');
    final String branchPhone = (_currentBranch?.phone != null && _currentBranch!.phone!.isNotEmpty)
        ? _currentBranch!.phone!
        : '';
    final String branchAddress = (_currentBranch != null && _currentBranch!.address.isNotEmpty)
        ? _currentBranch!.address
        : '';
    final branchLat = _currentBranch?.latitude ?? 10.077715;
    final branchLng = _currentBranch?.longitude ?? -69.2812938;

    final newOrder = DeliveryOrder(
      id: 'ord_${now.millisecondsSinceEpoch}',
      orderNumber: 'ORD-$orderDigits',
      merchantName: branchName,
      merchantPhone: branchPhone,
      merchantAddress: branchAddress,
      merchantLat: branchLat,
      merchantLng: branchLng,
      customerName: user?.name.isNotEmpty == true ? user!.name : 'Cliente',
      customerPhone: user?.phone.isNotEmpty == true ? user!.phone : '',
      customerAddress: _selectedAddress.address,
      customerLat: _selectedAddress.latitude,
      customerLng: _selectedAddress.longitude,
      riderName: '',
      riderPhone: '',
      riderVehicle: '',
      riderPlate: '',
      pin: newPin,
      status: OrderDeliveryStatus.pending,
      items: List.from(_items),
      subtotal: subtotal,
      deliveryFee: deliveryFee,
      total: grandTotal,
      paymentMethod: paymentMethod,
      paymentReference: (paymentReference ?? '').trim(),
      paymentOriginBank: (paymentOriginBank ?? '').trim(),
      createdAt: now,
      branchId: _currentBranch?.id ??
          _items
              .where((i) =>
                  i.product.branchId != null &&
                  i.product.branchId!.trim().isNotEmpty)
              .firstOrNull
              ?.product
              .branchId,
      companyId: (_currentBranch?.companyId != null && _currentBranch!.companyId.trim().isNotEmpty)
          ? _currentBranch!.companyId.trim()
          : (_currentCompanyId?.trim() ?? ''),
      notes: (notes != null && notes.trim().isNotEmpty) ? notes.trim() : null,
    );

    _activeOrder = newOrder;
    _orderHistory.insert(0, newOrder);
    _saveOrders();
    clearCart();

    _pendingOrderNumber = newOrder.orderNumber;
    _pendingOrderSync = _createBackendOrder(newOrder);

    notifyListeners();
    return newOrder;
  }

  void createOrderFromCart({
    required String paymentMethod,
    AppUser? user,
    String? notes,
    String? paymentReference,
    String? paymentOriginBank,
  }) {
    _buildAndQueueOrder(
      paymentMethod: paymentMethod,
      user: user,
      notes: notes,
      paymentReference: paymentReference,
      paymentOriginBank: paymentOriginBank,
    );
  }

  Future<DeliveryOrder> createOrderFromCartAsync({
    required String paymentMethod,
    AppUser? user,
    String? notes,
    String? paymentReference,
    String? paymentOriginBank,
  }) async {
    final lowerMethod = paymentMethod.toLowerCase();
    final isCash = lowerMethod.contains('efectivo') || lowerMethod.contains('cash');
    final isZelle = lowerMethod.contains('zelle');
    final isPos = lowerMethod.contains('punto') || lowerMethod.contains('pos') || lowerMethod.contains('tarjeta');
    final isPagoMovil = !isCash && !isZelle && !isPos;
    final cleanRefDigits = (paymentReference ?? '').replaceAll(RegExp(r'\D'), '');
    if (isPagoMovil && cleanRefDigits.length < 4) {
      throw Exception('Debes ingresar el número de referencia del Pago Móvil (mínimo 4 dígitos).');
    }

    final created = _buildAndQueueOrder(
      paymentMethod: paymentMethod,
      user: user,
      notes: notes,
      paymentReference: isPagoMovil ? cleanRefDigits : paymentReference,
      paymentOriginBank: paymentOriginBank,
    );
    await _pendingOrderSync;
    if (_activeOrder?.orderNumber == created.orderNumber) {
      return _activeOrder!;
    }
    return created;
  }

  Future<String?> _createBackendOrder(DeliveryOrder order) async {
    try {
      final realId = await ApiService().createOrder(order);
      if (realId != null && realId.isNotEmpty) {
        updateOrderCloudId(order.orderNumber, realId);
      }
      return realId;
    } catch (e) {
      debugPrint('[CartService] Error sync order with backend: $e');
      return null;
    }
  }

  Future<bool> requestPayout({
    required double amount,
    required String method,
    required String destinationDetails,
  }) async {
    if (amount <= 0 || amount > availableWalletBalance) {
      return false;
    }

    final payout = RiderPayoutTransaction(
      id: 'pay_${DateTime.now().millisecondsSinceEpoch}',
      amount: amount,
      method: method,
      destinationDetails: destinationDetails,
      date: DateTime.now(),
      status: 'Completado',
    );

    _payoutHistory.insert(0, payout);
    await _savePayouts();
    notifyListeners();
    return true;
  }
}
