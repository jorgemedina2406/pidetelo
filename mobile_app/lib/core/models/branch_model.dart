import 'dart:math' as math;

class DeliveryTier {
  final String id;
  final double minKm;
  final double maxKm;
  final double price;

  const DeliveryTier({
    required this.id,
    required this.minKm,
    required this.maxKm,
    required this.price,
  });

  factory DeliveryTier.fromJson(Map<String, dynamic> json) => DeliveryTier(
    id: json['id']?.toString() ?? '',
    minKm: (json['minKm'] as num?)?.toDouble() ?? (json['min_km'] as num?)?.toDouble() ?? 0.0,
    maxKm: (json['maxKm'] as num?)?.toDouble() ?? (json['max_km'] as num?)?.toDouble() ?? 5.0,
    price: (json['price'] as num?)?.toDouble() ?? 2.50,
  );

  Map<String, dynamic> toJson() => {
    'id': id,
    'minKm': minKm,
    'maxKm': maxKm,
    'price': price,
  };
}

class BranchPaymentCredentials {
  final String pagoMovilBank;
  final String pagoMovilPhone;
  final String pagoMovilIdNumber;
  final String pagoMovilAccountName;
  final String? zelleEmail;
  final String? zelleAccountName;
  final bool isActive;

  const BranchPaymentCredentials({
    required this.pagoMovilBank,
    required this.pagoMovilPhone,
    required this.pagoMovilIdNumber,
    required this.pagoMovilAccountName,
    this.zelleEmail,
    this.zelleAccountName,
    this.isActive = true,
  });

  Map<String, dynamic> toJson() => {
        'pago_movil_bank': pagoMovilBank,
        'pago_movil_phone': pagoMovilPhone,
        'pago_movil_id_number': pagoMovilIdNumber,
        'pago_movil_account_name': pagoMovilAccountName,
        'zelle_email': zelleEmail,
        'zelle_account_name': zelleAccountName,
        'is_active': isActive,
      };

  factory BranchPaymentCredentials.fromJson(Map<String, dynamic> json) {
    final pm = json['pago_movil'] is Map ? json['pago_movil'] as Map<String, dynamic> : null;
    final z = json['zelle'] is Map ? json['zelle'] as Map<String, dynamic> : null;

    final bankName = pm?['bank_name'] ?? json['pago_movil_bank'] ?? json['pagoMovilBank'] ?? '';
    final bankCode = pm?['bank_code'] != null ? '${pm!['bank_code']} - ' : '';
    final fullBank = pm?['bank_name'] != null ? '$bankCode$bankName' : bankName;

    return BranchPaymentCredentials(
      pagoMovilBank: fullBank,
      pagoMovilPhone: pm?['phone'] ?? json['pago_movil_phone'] ?? json['pagoMovilPhone'] ?? '',
      pagoMovilIdNumber: pm?['id_number'] ?? json['pago_movil_id_number'] ?? json['pagoMovilIdNumber'] ?? '',
      pagoMovilAccountName: pm?['account_name'] ?? json['pago_movil_account_name'] ?? json['pagoMovilAccountName'] ?? (json['name'] ?? ''),
      zelleEmail: z?['email'] ?? json['zelle_email'] ?? json['zelleEmail'],
      zelleAccountName: z?['account_name'] ?? json['zelle_account_name'] ?? json['zelleAccountName'],
      isActive: (pm?['enabled'] as bool?) ?? json['is_active'] ?? json['isActive'] ?? true,
    );
  }
}

class Branch {
  final String id;
  final String companyId;
  final String companyName;
  final String name;
  final String slug;
  final String address;
  final double latitude;
  final double longitude;
  final double deliveryRadiusKm;
  final double baseDeliveryFee;
  final List<DeliveryTier> deliveryTiers;
  final String status; // 'active', 'pending_approval', 'inactive', 'rejected'
  final String? phone;
  final String? whatsapp;
  final String openTime;
  final String closeTime;
  final bool isOpenNow;
  final BranchPaymentCredentials paymentCredentials;
  final String? tagline;
  final String? accentColor;
  final String? logoUrl;
  final String? bannerUrl;
  final double? exchangeRate;
  final String? baseCurrency;
  final String? displayMode;

  const Branch({
    required this.id,
    required this.companyId,
    required this.companyName,
    required this.name,
    required this.slug,
    required this.address,
    required this.latitude,
    required this.longitude,
    this.deliveryRadiusKm = 8.0,
    this.baseDeliveryFee = 2.50,
    this.deliveryTiers = const [
      DeliveryTier(id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50),
      DeliveryTier(id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00),
      DeliveryTier(id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50),
    ],
    this.status = 'active',
    this.phone,
    this.whatsapp,
    this.openTime = '11:30',
    this.closeTime = '23:00',
    this.isOpenNow = true,
    required this.paymentCredentials,
    this.tagline,
    this.accentColor,
    this.logoUrl,
    this.bannerUrl,
    this.exchangeRate,
    this.baseCurrency,
    this.displayMode,
  });

  /// Real distance in km using Haversine
  double distanceKmTo(double userLat, double userLng) {
    const double p = 0.017453292519943295;
    final double a = 0.5 -
        math.cos((userLat - latitude) * p) / 2 +
        math.cos(latitude * p) *
            math.cos(userLat * p) *
            (1 - math.cos((userLng - longitude) * p)) /
            2;
    final straight = 12742 * math.asin(math.sqrt(a));
    // Factor de ruta vial urbana terrestre (1.28x) para reflejar calles y avenidas reales
    return straight * 1.28;
  }

  /// Estimated delivery time dynamically computed from distance
  String deliveryTimeTo(double userLat, double userLng) {
    final dist = distanceKmTo(userLat, userLng);
    final minTime = (15 + (dist * 2.2)).round();
    final maxTime = (20 + (dist * 3.2)).round();
    return '$minTime-$maxTime min';
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'company_id': companyId,
        'company_name': companyName,
        'name': name,
        'slug': slug,
        'address': address,
        'latitude': latitude,
        'longitude': longitude,
        'delivery_radius_km': deliveryRadiusKm,
        'base_delivery_fee': baseDeliveryFee,
        'status': status,
        'phone': phone,
        'whatsapp': whatsapp,
        'open_time': openTime,
        'close_time': closeTime,
        'is_open_now': isOpenNow,
        'payment_credentials': paymentCredentials.toJson(),
      };

  factory Branch.fromJson(Map<String, dynamic> json) {
    final payData = json['payment_credentials'] ??
        json['branch_payment_credentials'] ??
        json['paymentCredentials'];

    final credentials = payData is Map<String, dynamic>
        ? BranchPaymentCredentials.fromJson(payData)
        : (payData is List && payData.isNotEmpty && payData.first is Map<String, dynamic>)
            ? BranchPaymentCredentials.fromJson(payData.first as Map<String, dynamic>)
            : const BranchPaymentCredentials(
                pagoMovilBank: '',
                pagoMovilPhone: '',
                pagoMovilIdNumber: '',
                pagoMovilAccountName: '',
                zelleEmail: null,
                zelleAccountName: null,
              );

    final rawTiers = json['delivery_tiers'] ?? json['deliveryTiers'];
    final List<DeliveryTier> parsedTiers = (rawTiers is List && rawTiers.isNotEmpty)
        ? rawTiers.map((t) => DeliveryTier.fromJson(Map<String, dynamic>.from(t as Map))).toList()
        : const [
            DeliveryTier(id: 'tier_1', minKm: 0, maxKm: 2, price: 1.50),
            DeliveryTier(id: 'tier_2', minKm: 2, maxKm: 5, price: 3.00),
            DeliveryTier(id: 'tier_3', minKm: 5, maxKm: 8, price: 4.50),
          ];

    return Branch(
      id: json['id'] ?? '',
      companyId: json['company_id'] ?? json['companyId'] ?? '',
      companyName: json['company_name'] ?? json['companyName'] ?? 'Comercio',
      name: json['name'] ?? 'Sucursal',
      slug: json['slug'] ?? '',
      address: json['address'] ?? '',
      latitude: (json['latitude'] as num?)?.toDouble() ?? 10.077715,
      longitude: (json['longitude'] as num?)?.toDouble() ?? -69.2812938,
      deliveryRadiusKm: (json['delivery_radius_km'] as num?)?.toDouble() ??
          (json['deliveryRadiusKm'] as num?)?.toDouble() ??
          8.0,
      baseDeliveryFee: (json['base_delivery_fee'] as num?)?.toDouble() ??
          (json['baseDeliveryFee'] as num?)?.toDouble() ??
          2.50,
      deliveryTiers: parsedTiers,
      status: json['status'] ?? 'active',
      phone: json['phone'],
      whatsapp: json['whatsapp'],
      openTime: json['open_time'] ?? json['openTime'] ?? '11:30',
      closeTime: json['close_time'] ?? json['closeTime'] ?? '23:00',
      isOpenNow: json['is_open_now'] ?? json['isOpenNow'] ?? true,
      paymentCredentials: credentials,
      tagline: json['tagline']?.toString(),
      accentColor: json['accent_color']?.toString() ?? json['accentColor']?.toString(),
      logoUrl: json['logo_url']?.toString() ?? json['logoUrl']?.toString(),
      bannerUrl: json['banner_url']?.toString() ?? json['bannerUrl']?.toString(),
      exchangeRate: (json['exchange_rate'] as num?)?.toDouble() ?? (json['exchangeRate'] as num?)?.toDouble(),
      baseCurrency: json['base_currency']?.toString() ?? json['baseCurrency']?.toString(),
      displayMode: json['display_mode']?.toString() ?? json['displayMode']?.toString(),
    );
  }
}
