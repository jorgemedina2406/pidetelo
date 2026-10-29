class RiderPaymentAccount {
  final String id;
  final String type; // 'pago_movil', 'bank_transfer', 'zelle'
  final String bank; // e.g. '0102 - Banco de Venezuela', '0108 - Banco Provincial', etc.
  final String accountNumber; // phone number for pago móvil, 20 digit account for transfer, or email for zelle
  final String holderName;
  final String nationalId;
  final String phone;
  final bool isDefault;

  const RiderPaymentAccount({
    required this.id,
    required this.type,
    required this.bank,
    required this.accountNumber,
    required this.holderName,
    required this.nationalId,
    required this.phone,
    this.isDefault = false,
  });

  Map<String, dynamic> toJson() => {
        'id': id,
        'type': type,
        'bank': bank,
        'accountNumber': accountNumber,
        'holderName': holderName,
        'nationalId': nationalId,
        'phone': phone,
        'isDefault': isDefault,
      };

  factory RiderPaymentAccount.fromJson(Map<String, dynamic> json) =>
      RiderPaymentAccount(
        id: json['id'] ?? '',
        type: json['type'] ?? 'pago_movil',
        bank: json['bank'] ?? '',
        accountNumber: json['accountNumber'] ?? json['account_number'] ?? '',
        holderName: json['holderName'] ?? json['holder_name'] ?? '',
        nationalId: json['nationalId'] ?? json['national_id'] ?? '',
        phone: json['phone'] ?? '',
        isDefault: json['isDefault'] ?? json['is_default'] ?? false,
      );
}

class RiderUser {
  final String id;
  final String name;
  final String email;
  final String phone;
  final String? nationalId;
  final String? avatarUrl;
  final String vehicleType;
  final String vehicleModel;
  final String vehiclePlate;
  final bool isOnline;
  final double rating;
  final List<RiderPaymentAccount> paymentAccounts;

  const RiderUser({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    this.nationalId,
    this.avatarUrl,
    this.vehicleType = 'Moto',
    this.vehicleModel = '',
    this.vehiclePlate = '',
    this.isOnline = true,
    this.rating = 5.0,
    this.paymentAccounts = const [],
  });

  RiderUser copyWith({
    String? id,
    String? name,
    String? email,
    String? phone,
    String? nationalId,
    String? avatarUrl,
    String? vehicleType,
    String? vehicleModel,
    String? vehiclePlate,
    bool? isOnline,
    double? rating,
    List<RiderPaymentAccount>? paymentAccounts,
  }) {
    return RiderUser(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      nationalId: nationalId ?? this.nationalId,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      vehicleType: vehicleType ?? this.vehicleType,
      vehicleModel: vehicleModel ?? this.vehicleModel,
      vehiclePlate: vehiclePlate ?? this.vehiclePlate,
      isOnline: isOnline ?? this.isOnline,
      rating: rating ?? this.rating,
      paymentAccounts: paymentAccounts ?? this.paymentAccounts,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'nationalId': nationalId,
        'avatarUrl': avatarUrl,
        'vehicleType': vehicleType,
        'vehicleModel': vehicleModel,
        'vehiclePlate': vehiclePlate,
        'isOnline': isOnline,
        'rating': rating,
        'paymentAccounts': paymentAccounts.map((a) => a.toJson()).toList(),
      };

  factory RiderUser.fromJson(Map<String, dynamic> json) {
    List<RiderPaymentAccount> accounts = [];
    final rawAccounts = json['paymentAccounts'] ?? json['payment_accounts'];
    if (rawAccounts is List) {
      accounts = rawAccounts
          .map((a) => RiderPaymentAccount.fromJson(a as Map<String, dynamic>))
          .toList();
    }

    return RiderUser(
      id: json['id'] ?? '',
      name: json['name'] ?? '',
      email: json['email'] ?? '',
      phone: json['phone'] ?? '',
      nationalId: json['nationalId'] ?? json['national_id'],
      avatarUrl: json['avatarUrl'] ?? json['avatar_url'],
      vehicleType: json['vehicleType'] ?? json['vehicle_type'] ?? 'Moto',
      vehicleModel: json['vehicleModel'] ?? json['vehicle_model'] ?? '',
      vehiclePlate: json['vehiclePlate'] ?? json['vehicle_plate'] ?? '',
      isOnline: json['isOnline'] ?? json['is_active'] ?? true,
      rating: (json['rating'] as num?)?.toDouble() ?? 5.0,
      paymentAccounts: accounts,
    );
  }
}
