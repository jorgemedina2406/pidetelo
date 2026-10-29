enum AppUserRole {
  rider,
  customer,
}

class AppUser {
  final String id;
  final String name;
  final String email;
  final String phone;
  final AppUserRole role;
  final String? avatarUrl;
  final String? deliveryAddress;
  final double? deliveryLat;
  final double? deliveryLng;
  final String? vehicleType;
  final String? vehicleModel;
  final String? vehiclePlate;

  const AppUser({
    required this.id,
    required this.name,
    required this.email,
    required this.phone,
    required this.role,
    this.avatarUrl,
    this.deliveryAddress,
    this.deliveryLat,
    this.deliveryLng,
    this.vehicleType,
    this.vehicleModel,
    this.vehiclePlate,
  });

  bool get isRider => role == AppUserRole.rider;
  bool get isCustomer => role == AppUserRole.customer;

  AppUser copyWith({
    String? id,
    String? name,
    String? email,
    String? phone,
    AppUserRole? role,
    String? avatarUrl,
    String? deliveryAddress,
    double? deliveryLat,
    double? deliveryLng,
    String? vehicleType,
    String? vehicleModel,
    String? vehiclePlate,
  }) {
    return AppUser(
      id: id ?? this.id,
      name: name ?? this.name,
      email: email ?? this.email,
      phone: phone ?? this.phone,
      role: role ?? this.role,
      avatarUrl: avatarUrl ?? this.avatarUrl,
      deliveryAddress: deliveryAddress ?? this.deliveryAddress,
      deliveryLat: deliveryLat ?? this.deliveryLat,
      deliveryLng: deliveryLng ?? this.deliveryLng,
      vehicleType: vehicleType ?? this.vehicleType,
      vehicleModel: vehicleModel ?? this.vehicleModel,
      vehiclePlate: vehiclePlate ?? this.vehiclePlate,
    );
  }

  Map<String, dynamic> toJson() => {
        'id': id,
        'name': name,
        'email': email,
        'phone': phone,
        'role': role.name,
        'avatarUrl': avatarUrl,
        'deliveryAddress': deliveryAddress,
        'deliveryLat': deliveryLat,
        'deliveryLng': deliveryLng,
        'vehicleType': vehicleType,
        'vehicleModel': vehicleModel,
        'vehiclePlate': vehiclePlate,
      };

  factory AppUser.fromJson(Map<String, dynamic> json) => AppUser(
        id: json['id'] ?? '',
        name: json['name'] ?? '',
        email: json['email'] ?? '',
        phone: json['phone'] ?? '',
        role: json['role'] == 'rider' ? AppUserRole.rider : AppUserRole.customer,
        avatarUrl: json['avatarUrl'],
        deliveryAddress: json['deliveryAddress'],
        deliveryLat: (json['deliveryLat'] as num?)?.toDouble(),
        deliveryLng: (json['deliveryLng'] as num?)?.toDouble(),
        vehicleType: json['vehicleType'],
        vehicleModel: json['vehicleModel'],
        vehiclePlate: json['vehiclePlate'],
      );
}
