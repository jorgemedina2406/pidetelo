import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/order_model.dart';
import '../models/user_model.dart';
import '../models/branch_model.dart';
import 'api_service.dart';

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
          : 45.50;

  DeliveryAddress get selectedAddress => _selectedAddress;
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

    // Load addresses specifically for this user
    _savedAddresses.clear();
    final addrKey = _getAddressesKey(identifier);
    final addrsJson = prefs.getString(addrKey);
    if (addrsJson != null) {
      try {
        final List aList = jsonDecode(addrsJson);
        for (final a in aList) {
          _savedAddresses.add(DeliveryAddress.fromJson(a));
        }
      } catch (e) {
        debugPrint('[CartService] Error parsing user addresses: $e');
      }
    }

    if (_savedAddresses.isNotEmpty) {
      _selectedAddress = _savedAddresses.first;
    } else {
      _selectedAddress = const DeliveryAddress(
        id: '',
        title: 'Sin dirección',
        address: 'Selecciona una dirección de entrega',
        latitude: 10.034574,
        longitude: -69.237544,
      );
    }

    // Sync from Supabase Cloud for this user's phone or identifier
    final searchTarget = (phone != null && phone.trim().isNotEmpty) ? phone : identifier;
    if (searchTarget.trim().isNotEmpty) {
      await syncOrdersWithCloud(searchTarget);
    }

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

  void setBranch(Branch? branch) {
    if (_currentBranch?.id != branch?.id) {
      if (_items.isNotEmpty) {
        _items.clear();
      }
      _currentBranch = branch;
      if (branch != null) {
        _currentStoreName = '${branch.companyName} - ${branch.name}';
        _currentCompanyId = branch.companyId;
        _currentCompanyName = branch.companyName;
      }
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
  }

  Future<void> _saveAddresses() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final key = _getAddressesKey(_currentAccountKey);
      final encoded = jsonEncode(_savedAddresses.map((a) => a.toJson()).toList());
      await prefs.setString(key, encoded);
    } catch (e) {
      debugPrint('[CartService] Error saving addresses: $e');
    }
  }

  void selectAddress(DeliveryAddress address) {
    _selectedAddress = address;
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
      notifyListeners();
    }
  }

  Future<void> deleteSavedAddress(String id) async {
    _savedAddresses.removeWhere((a) => a.id == id);
    if (_selectedAddress.id == id && _savedAddresses.isNotEmpty) {
      _selectedAddress = _savedAddresses.first;
    }
    await _saveAddresses();
    notifyListeners();
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

  void createOrderFromCart({
    required String paymentMethod,
    AppUser? user,
    String? notes,
  }) {
    if (user != null) {
      _currentAccountKey = user.email.isNotEmpty ? user.email : user.id;
    }

    final now = DateTime.now();
    final orderDigits = '${(now.millisecondsSinceEpoch % 9000) + 1000}';
    final newPin = orderDigits;

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
    );

    _activeOrder = newOrder;
    _orderHistory.insert(0, newOrder);
    _saveOrders();
    clearCart();

    // Send asynchronously to backend and Supabase
    _createBackendOrder(newOrder);

    notifyListeners();
  }

  Future<void> _createBackendOrder(DeliveryOrder order) async {
    try {
      await ApiService().createOrder(order);
    } catch (e) {
      debugPrint('[CartService] Error sync order with backend: $e');
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
