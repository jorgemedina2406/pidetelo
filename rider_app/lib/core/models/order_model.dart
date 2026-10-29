class DeliveryAddress {
  final String id;
  final String title;
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

class Product {
  final String id;
  final String name;
  final String description;
  final double price;
  final String imageUrl;
  final String category;
  final bool isPopular;
  final List<ProductOption> availableOptions;

  const Product({
    required this.id,
    required this.name,
    required this.description,
    required this.price,
    required this.imageUrl,
    required this.category,
    this.isPopular = false,
    this.availableOptions = const [],
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'description': description,
        'price': price,
        'imageUrl': imageUrl,
        'category': category,
        'isPopular': isPopular,
        'availableOptions': availableOptions.map((o) => o.toJson()).toList(),
      };

  factory Product.fromJson(Map<String, dynamic> json) => Product(
        id: json['id'] ?? '',
        name: json['name'] ?? '',
        description: json['description'] ?? '',
        price: (json['price'] as num?)?.toDouble() ?? 0.0,
        imageUrl: json['imageUrl'] ?? '',
        category: json['category'] ?? '',
        isPopular: json['isPopular'] ?? false,
        availableOptions: (json['availableOptions'] as List? ?? [])
            .map((o) => ProductOption.fromJson(o as Map<String, dynamic>))
            .toList(),
      );
}

class CartItem {
  final Product product;
  int quantity;
  final List<ProductOption> selectedOptions;
  final String? notes;

  CartItem({
    required this.product,
    this.quantity = 1,
    this.selectedOptions = const [],
    this.notes,
  });

  double get unitPrice {
    double total = product.price;
    for (final opt in selectedOptions) {
      total += opt.extraPrice;
    }
    return total;
  }

  double get totalPrice => unitPrice * quantity;

  Map<String, dynamic> toJson() => {
        'product': product.toJson(),
        'quantity': quantity,
        'selectedOptions': selectedOptions.map((o) => o.toJson()).toList(),
        'notes': notes,
      };

  factory CartItem.fromJson(Map<String, dynamic> json) => CartItem(
        product: Product.fromJson(json['product'] as Map<String, dynamic>),
        quantity: json['quantity'] ?? 1,
        selectedOptions: (json['selectedOptions'] as List? ?? [])
            .map((o) => ProductOption.fromJson(o as Map<String, dynamic>))
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
        return 'Asignado';
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
        return 'En ruta de entrega';
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
  final DateTime createdAt;
  final String? branchId;
  final String? companyId;

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
        'createdAt': createdAt.toIso8601String(),
        'branchId': branchId,
        'companyId': companyId,
      };

  factory DeliveryOrder.fromJson(Map<String, dynamic> json) => DeliveryOrder(
        id: json['id'] ?? '',
        orderNumber: json['orderNumber'] ?? '',
        merchantName: json['merchantName'] ?? '',
        merchantPhone: json['merchantPhone'] ?? '',
        merchantAddress: json['merchantAddress'] ?? '',
        merchantLat: (json['merchantLat'] as num?)?.toDouble() ?? 10.026743,
        merchantLng: (json['merchantLng'] as num?)?.toDouble() ?? -69.257153,
        customerName: json['customerName'] ?? '',
        customerPhone: json['customerPhone'] ?? '',
        customerAddress: json['customerAddress'] ?? '',
        customerLat: (json['customerLat'] as num?)?.toDouble() ?? 10.034574,
        customerLng: (json['customerLng'] as num?)?.toDouble() ?? -69.237544,
        riderName: json['riderName'] ?? '',
        riderPhone: json['riderPhone'] ?? '',
        riderVehicle: json['riderVehicle'] ?? '',
        riderPlate: json['riderPlate'] ?? '',
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
        createdAt: DateTime.tryParse(json['createdAt'] ?? '') ?? DateTime.now(),
        branchId: json['branchId'] ?? json['branch_id'],
        companyId: json['companyId'] ?? json['tenant_id'],
      );
}
