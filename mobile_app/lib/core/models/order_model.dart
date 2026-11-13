class DeliveryAddress {
  final String id;
  final String title; // "Casa", "Trabajo", "Otro"
  final String address;
  final String? reference;
  final double latitude;
  final double longitude;
  final String? instructions;

  const DeliveryAddress({
    required this.id,
    required this.title,
    required this.address,
    this.reference,
    required this.latitude,
    required this.longitude,
    this.instructions,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'address': address,
        'reference': reference,
        'latitude': latitude,
        'longitude': longitude,
        'instructions': instructions,
      };

  factory DeliveryAddress.fromJson(Map<String, dynamic> json) => DeliveryAddress(
        id: json['id'] ?? '',
        title: json['title'] ?? 'Ubicación',
        address: json['address'] ?? '',
        reference: json['reference'],
        latitude: (json['latitude'] as num?)?.toDouble() ?? 10.034574,
        longitude: (json['longitude'] as num?)?.toDouble() ?? -69.237544,
        instructions: json['instructions'],
      );
}

class ProductOption {
  final String name;
  final double extraPrice;

  const ProductOption({required this.name, this.extraPrice = 0.0});

  Map<String, dynamic> toJson() => {
        'name': name,
        'extraPrice': extraPrice,
      };

  factory ProductOption.fromJson(Map<String, dynamic> json) => ProductOption(
        name: json['name'] ?? '',
        extraPrice: (json['extraPrice'] as num?)?.toDouble() ?? 0.0,
      );
}

class ProductModifierOption {
  final String id;
  final String name;
  final double priceDelta;
  final bool isDefault;
  final bool isAvailable;

  const ProductModifierOption({
    required this.id,
    required this.name,
    this.priceDelta = 0.0,
    this.isDefault = false,
    this.isAvailable = true,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'price_delta': priceDelta,
        'is_default': isDefault,
        'is_available': isAvailable,
      };

  factory ProductModifierOption.fromJson(Map<String, dynamic> json) =>
      ProductModifierOption(
        id: json['id']?.toString() ?? '',
        name: json['name']?.toString() ?? '',
        priceDelta: (json['price_delta'] as num?)?.toDouble() ??
            (json['priceDelta'] as num?)?.toDouble() ??
            0.0,
        isDefault: json['is_default'] ?? json['isDefault'] ?? false,
        isAvailable: json['is_available'] ?? json['isAvailable'] ?? true,
      );
}

class ProductModifierGroup {
  final String id;
  final String title;
  final String? description;
  final int minSelections;
  final int maxSelections;
  final List<ProductModifierOption> options;

  const ProductModifierGroup({
    required this.id,
    required this.title,
    this.description,
    this.minSelections = 0,
    this.maxSelections = 1,
    this.options = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'title': title,
        'description': description,
        'min_selections': minSelections,
        'max_selections': maxSelections,
        'options': options.map((o) => o.toJson()).toList(),
      };

  factory ProductModifierGroup.fromJson(Map<String, dynamic> json) {
    final rawOptions = json['modifier_options'] ?? json['options'] ?? [];
    return ProductModifierGroup(
      id: json['id']?.toString() ?? '',
      title: json['title']?.toString() ?? 'Opciones',
      description: json['description']?.toString(),
      minSelections: (json['min_selections'] as num?)?.toInt() ??
          (json['minSelections'] as num?)?.toInt() ??
          0,
      maxSelections: (json['max_selections'] as num?)?.toInt() ??
          (json['maxSelections'] as num?)?.toInt() ??
          1,
      options: (rawOptions as List? ?? [])
          .map((o) => ProductModifierOption.fromJson(o as Map<String, dynamic>))
          .toList(),
    );
  }
}

class SelectedProductModifier {
  final String groupId;
  final String groupTitle;
  final String optionId;
  final String optionName;
  final double priceDelta;

  const SelectedProductModifier({
    required this.groupId,
    required this.groupTitle,
    required this.optionId,
    required this.optionName,
    required this.priceDelta,
  });

  Map<String, dynamic> toJson() => {
        'group_id': groupId,
        'group_title': groupTitle,
        'option_id': optionId,
        'option_name': optionName,
        'price_delta': priceDelta,
      };

  factory SelectedProductModifier.fromJson(Map<String, dynamic> json) =>
      SelectedProductModifier(
        groupId: json['group_id'] ?? json['groupId'] ?? '',
        groupTitle: json['group_title'] ?? json['groupTitle'] ?? '',
        optionId: json['option_id'] ?? json['optionId'] ?? '',
        optionName: json['option_name'] ?? json['optionName'] ?? '',
        priceDelta: (json['price_delta'] as num?)?.toDouble() ??
            (json['priceDelta'] as num?)?.toDouble() ??
            0.0,
      );
}

class Product {
  final String id;
  final String name;
  final String description;
  final double price;
  final String imageUrl;
  final String category;
  final bool isPopular;
  final bool isFeatured;
  final bool isOnSale;
  final double? compareAtPrice;
  final int? discountPercentage;
  final String? branchId;
  final List<ProductOption> availableOptions;
  final List<ProductModifierGroup> modifierGroups;

  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.imageUrl,
    required this.category,
    this.isPopular = false,
    this.isFeatured = false,
    this.isOnSale = false,
    this.compareAtPrice,
    this.discountPercentage,
    this.branchId,
    this.availableOptions = const [],
    this.modifierGroups = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'price': price,
        'imageUrl': imageUrl,
        'category': category,
        'isPopular': isPopular,
        'isFeatured': isFeatured,
        'isOnSale': isOnSale,
        'compareAtPrice': compareAtPrice,
        'discountPercentage': discountPercentage,
        'branch_id': branchId,
        'availableOptions': availableOptions.map((o) => o.toJson()).toList(),
        'modifier_groups': modifierGroups.map((g) => g.toJson()).toList(),
      };

  factory Product.fromJson(Map<String, dynamic> json) {
    final rawModGroups = json['modifier_groups'] ?? json['modifierGroups'] ?? [];
    final modGroupsList = (rawModGroups as List? ?? [])
        .map((g) => ProductModifierGroup.fromJson(g as Map<String, dynamic>))
        .toList();

    return Product(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      description: json['description'] ?? '',
      price: (json['price'] as num?)?.toDouble() ?? 0.0,
      imageUrl: json['imageUrl'] ?? json['image_url'] ?? '',
      category: json['category'] ?? json['categories']?['name'] ?? '',
      isPopular: json['isPopular'] ?? json['is_popular'] ?? false,
      isFeatured: json['isFeatured'] ?? json['is_featured'] ?? false,
      isOnSale: json['isOnSale'] ?? json['is_on_sale'] ?? false,
      compareAtPrice: (json['compareAtPrice'] as num?)?.toDouble() ?? (json['compare_at_price'] as num?)?.toDouble(),
      discountPercentage: (json['discountPercentage'] as num?)?.toInt() ?? (json['discount_percentage'] as num?)?.toInt(),
      branchId: json['branch_id'] ?? json['branchId'],
      availableOptions: (json['availableOptions'] as List? ?? [])
          .map((o) => ProductOption.fromJson(o as Map<String, dynamic>))
          .toList(),
      modifierGroups: modGroupsList,
    );
  }
}

class CartItem {
  final Product product;
  int quantity;
  final List<ProductOption> selectedOptions;
  final List<SelectedProductModifier> selectedModifiers;
  final String? notes;

  CartItem({
    required this.product,
    this.quantity = 1,
    this.selectedOptions = const [],
    this.selectedModifiers = const [],
    this.notes,
  });

  double get unitPrice {
    double total = product.price;
    for (final opt in selectedOptions) {
      total += opt.extraPrice;
    }
    for (final mod in selectedModifiers) {
      total += mod.priceDelta;
    }
    return total;
  }

  double get totalPrice => unitPrice * quantity;

  Map<String, dynamic> toJson() => {
        'product': product.toJson(),
        'quantity': quantity,
        'selectedOptions': selectedOptions.map((o) => o.toJson()).toList(),
        'selected_modifiers': selectedModifiers.map((m) => m.toJson()).toList(),
        'notes': notes,
      };

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        product: Product.fromJson(json['product'] as Map<String, dynamic>),
        quantity: json['quantity'] ?? 1,
        selectedOptions: (json['selectedOptions'] as List? ?? [])
            .map((o) => ProductOption.fromJson(o as Map<String, dynamic>))
            .toList(),
        selectedModifiers: (json['selected_modifiers'] as List? ??
                json['selectedModifiers'] as List? ??
                [])
            .map((m) =>
                SelectedProductModifier.fromJson(m as Map<String, dynamic>))
            .toList(),
        notes: json['notes'],
      );
}

enum OrderDeliveryStatus {
  pending,
  confirmed,
  preparing,
  assigned,
  atMerchant,
  pickedUp,
  onTheWay,
  delivered,
  cancelled,
}

extension OrderDeliveryStatusX on OrderDeliveryStatus {
  String get shortLabel {
    switch (this) {
      case OrderDeliveryStatus.pending:
        return 'Pendiente';
      case OrderDeliveryStatus.confirmed:
        return 'Confirmado';
      case OrderDeliveryStatus.preparing:
        return 'En Cocina';
      case OrderDeliveryStatus.assigned:
        return 'Motorizado Asig.';
      case OrderDeliveryStatus.atMerchant:
        return 'En Local';
      case OrderDeliveryStatus.pickedUp:
        return 'Recogido';
      case OrderDeliveryStatus.onTheWay:
        return 'En Camino';
      case OrderDeliveryStatus.delivered:
        return 'Entregado';
      case OrderDeliveryStatus.cancelled:
        return 'Cancelado';
    }
  }

  String get label {
    switch (this) {
      case OrderDeliveryStatus.pending:
        return 'Pendiente de confirmación';
      case OrderDeliveryStatus.confirmed:
        return 'Confirmado por comercio';
      case OrderDeliveryStatus.preparing:
        return 'En preparación';
      case OrderDeliveryStatus.assigned:
        return 'Repartidor asignado';
      case OrderDeliveryStatus.atMerchant:
        return 'En el comercio';
      case OrderDeliveryStatus.pickedUp:
        return 'Pedido recogido';
      case OrderDeliveryStatus.onTheWay:
        return 'En ruta hacia ti';
      case OrderDeliveryStatus.delivered:
        return 'Entregado';
      case OrderDeliveryStatus.cancelled:
        return 'Cancelado';
    }
  }

  int get stepIndex {
    switch (this) {
      case OrderDeliveryStatus.pending:
      case OrderDeliveryStatus.confirmed:
        return 0;
      case OrderDeliveryStatus.preparing:
        return 1;
      case OrderDeliveryStatus.assigned:
      case OrderDeliveryStatus.atMerchant:
        return 2;
      case OrderDeliveryStatus.pickedUp:
      case OrderDeliveryStatus.onTheWay:
        return 3;
      case OrderDeliveryStatus.delivered:
        return 4;
      case OrderDeliveryStatus.cancelled:
        return -1;
    }
  }
}

class DeliveryOrder {
  final String id;
  final String orderNumber;
  final String merchantName;
  final String merchantPhone;
  final String merchantAddress;
  final double merchantLat;
  final double merchantLng;
  final String customerName;
  final String customerPhone;
  final String customerAddress;
  final double customerLat;
  final double customerLng;
  final String riderId;
  final String riderName;
  final String riderPhone;
  final String riderVehicle;
  final String riderPlate;
  final String pin;
  OrderDeliveryStatus status;
  final List<CartItem> items;
  final double subtotal;
  final double deliveryFee;
  final double total;
  final String paymentMethod;
  final String paymentStatus;
  final String paymentReference;
  final String paymentOriginBank;
  final DateTime createdAt;
  final String? branchId;
  final String? companyId;

  String? get tenantId => companyId;
  String get tenantName => merchantName;

  DeliveryOrder({
    required this.id,
    required this.orderNumber,
    required this.merchantName,
    required this.merchantPhone,
    required this.merchantAddress,
    required this.merchantLat,
    required this.merchantLng,
    required this.customerName,
    required this.customerPhone,
    required this.customerAddress,
    required this.customerLat,
    required this.customerLng,
    this.riderId = '',
    required this.riderName,
    required this.riderPhone,
    required this.riderVehicle,
    required this.riderPlate,
    required this.pin,
    required this.status,
    required this.items,
    required this.subtotal,
    required this.deliveryFee,
    required this.total,
    required this.paymentMethod,
    this.paymentStatus = 'pending',
    this.paymentReference = '',
    this.paymentOriginBank = '',
    required this.createdAt,
    this.branchId,
    this.companyId,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'orderNumber': orderNumber,
        'merchantName': merchantName,
        'merchantPhone': merchantPhone,
        'merchantAddress': merchantAddress,
        'merchantLat': merchantLat,
        'merchantLng': merchantLng,
        'customerName': customerName,
        'customerPhone': customerPhone,
        'customerAddress': customerAddress,
        'customerLat': customerLat,
        'customerLng': customerLng,
        'riderId': riderId,
        'riderName': riderName,
        'riderPhone': riderPhone,
        'riderVehicle': riderVehicle,
        'riderPlate': riderPlate,
        'pin': pin,
        'status': status.name,
        'items': items.map((i) => i.toJson()).toList(),
        'subtotal': subtotal,
        'deliveryFee': deliveryFee,
        'total': total,
        'paymentMethod': paymentMethod,
        'paymentStatus': paymentStatus,
        'paymentReference': paymentReference,
        'paymentOriginBank': paymentOriginBank,
        'createdAt': createdAt.toIso8601String(),
        'branchId': branchId,
        'companyId': companyId,
      };

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) {
    final rawNotes = (json['notes'] ?? '').toString();
    String originBank = (json['payment_origin_bank'] ?? json['paymentOriginBank'] ?? '').toString();
    if (originBank.isEmpty && rawNotes.contains('[PAGO_ORIGEN:')) {
      final m = RegExp(r'\[PAGO_ORIGEN:([^\]]+)\]').firstMatch(rawNotes);
      if (m != null) originBank = m.group(1)!.trim();
    }

    return DeliveryOrder(
        id: json['id'] ?? '',
        orderNumber: json['orderNumber'] ?? '',
        merchantName: json['merchantName'] ?? '',
        merchantPhone: json['merchantPhone'] ?? '',
        merchantAddress: json['merchantAddress'] ?? '',
        merchantLat: (json['merchantLat'] as num?)?.toDouble() ?? 10.077715,
        merchantLng: (json['merchantLng'] as num?)?.toDouble() ?? -69.2812938,
        customerName: json['customerName'] ?? '',
        customerPhone: json['customerPhone'] ?? '',
        customerAddress: json['customerAddress'] ?? '',
        customerLat: (json['customerLat'] as num?)?.toDouble() ?? 10.034574,
        customerLng: (json['customerLng'] as num?)?.toDouble() ?? -69.237544,
        riderId: json['riderId'] ?? json['driver_id'] ?? json['driverId'] ?? '',
        riderName: json['riderName'] ?? json['driver_name'] ?? json['driverName'] ?? '',
        riderPhone: json['riderPhone'] ?? json['driver_phone'] ?? json['driverPhone'] ?? '',
        riderVehicle: json['riderVehicle'] ?? json['driver_vehicle'] ?? '',
        riderPlate: json['riderPlate'] ?? json['driver_plate'] ?? '',
        pin: json['pin'] ?? '1234',
        status: OrderDeliveryStatus.values.firstWhere(
          (s) => s.name == json['status'],
          orElse: () => OrderDeliveryStatus.confirmed,
        ),
        items: (json['items'] as List? ?? [])
            .map((i) => CartItem.fromJson(i as Map<String, dynamic>))
            .toList(),
        subtotal: (json['subtotal'] as num?)?.toDouble() ?? 0.0,
        deliveryFee: (json['deliveryFee'] as num?)?.toDouble() ?? 0.0,
        total: (json['total'] as num?)?.toDouble() ?? 0.0,
        paymentMethod: json['paymentMethod'] ?? '',
        paymentStatus: json['payment_status'] ?? json['paymentStatus'] ?? 'pending',
        paymentReference: json['payment_reference'] ?? json['paymentReference'] ?? '',
        paymentOriginBank: originBank,
        createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
        branchId: json['branchId'] ?? json['branch_id'],
        companyId: json['companyId'] ?? json['tenant_id'],
      );
  }
}
