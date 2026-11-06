import 'dart:convert';
import 'dart:math' as math;
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/app_config.dart';
import '../models/order_model.dart';
import '../models/branch_model.dart';
import 'dolar_api_service.dart';

class ApiService {
  static final ApiService _instance = ApiService._internal();
  factory ApiService() => _instance;
  ApiService._internal();

  /// Precalculated road waypoints for fallback reference
  static const List<List<double>> defaultRealWaypoints = [
    [10.026753, -69.257198],
    [10.027134, -69.257113],
    [10.027259, -69.257086],
    [10.027477, -69.257042],
    [10.027698, -69.256996],
    [10.028904, -69.256737],
    [10.029422, -69.256632],
    [10.029906, -69.256533],
    [10.030330, -69.256448],
    [10.030617, -69.256384],
    [10.031482, -69.256192],
    [10.031533, -69.256179],
    [10.031763, -69.256008],
    [10.031809, -69.255969],
    [10.031901, -69.255889],
    [10.031957, -69.255959],
    [10.032849, -69.257113],
    [10.033158, -69.257515],
    [10.033441, -69.257814],
    [10.033984, -69.258264],
    [10.034428, -69.258456],
    [10.034591, -69.258497],
    [10.034830, -69.258555],
    [10.034917, -69.258579],
    [10.035044, -69.258605],
    [10.035171, -69.258631],
    [10.036753, -69.258954],
    [10.037260, -69.259046],
    [10.038525, -69.259289],
    [10.039516, -69.259468],
    [10.039761, -69.259511],
    [10.040039, -69.259561],
    [10.040107, -69.259520],
    [10.040185, -69.259472],
    [10.040233, -69.259433],
    [10.040291, -69.259379],
    [10.040297, -69.259254],
    [10.040344, -69.258913],
    [10.040402, -69.258106],
    [10.040466, -69.257578],
    [10.040474, -69.257547],
    [10.040533, -69.257400],
    [10.040543, -69.257296],
    [10.040529, -69.257135],
    [10.040468, -69.256945],
    [10.040330, -69.256610],
    [10.040098, -69.256120],
    [10.040001, -69.255899],
    [10.039256, -69.254226],
    [10.038961, -69.253559],
    [10.038918, -69.253455],
    [10.038775, -69.252991],
    [10.038715, -69.252680],
    [10.038549, -69.251523],
    [10.038530, -69.251396],
    [10.038493, -69.251057],
    [10.038411, -69.250312],
    [10.038387, -69.249975],
    [10.038377, -69.249831],
    [10.038371, -69.249744],
    [10.038258, -69.248401],
    [10.038138, -69.247278],
    [10.038108, -69.246933],
    [10.038108, -69.246705],
    [10.038105, -69.246486],
    [10.038102, -69.245986],
    [10.038099, -69.245507],
    [10.038105, -69.245111],
    [10.038103, -69.244917],
    [10.038080, -69.244480],
    [10.038080, -69.244405],
    [10.038081, -69.244167],
    [10.038066, -69.243988],
    [10.038008, -69.243873],
    [10.037752, -69.243541],
    [10.037635, -69.243400],
    [10.036934, -69.242438],
    [10.036768, -69.242200],
    [10.036562, -69.241914],
    [10.036002, -69.241144],
    [10.035072, -69.239776],
    [10.034573, -69.239070],
    [10.034658, -69.239012],
    [10.034961, -69.238796],
    [10.034916, -69.238728],
    [10.034517, -69.238151],
    [10.034798, -69.237944],
    [10.034535, -69.237572],
  ];

  /// Fetch real order details from backend
  Future<DeliveryOrder?> fetchOrder(String orderId) async {
    try {
      final url = Uri.parse('${AppConfig.backendBaseUrl}/orders/$orderId');
      final res = await http.get(url).timeout(const Duration(seconds: 4));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final tenant = data['tenants'] ?? {};
        final branch = data['branches'] as Map<String, dynamic>?;
        final rider = data['riders'] ?? {};
        final items = (data['order_items'] as List? ?? []).map((i) {
          return CartItem(
            product: Product(
              id: i['product_id'] ?? '',
              name: i['product_name'] ?? 'Producto',
              description: '',
              price: (i['unit_price'] as num?)?.toDouble() ?? 0.0,
              imageUrl: '',
              category: 'General',
            ),
            quantity: i['quantity'] ?? 1,
          );
        }).toList();

        final merchantName = (branch != null && (branch['name'] ?? '').toString().isNotEmpty)
            ? branch['name'].toString()
            : (tenant['name'] ?? 'Comercio');
        final merchantPhone = (branch != null && (branch['phone'] ?? '').toString().isNotEmpty)
            ? branch['phone'].toString()
            : (tenant['phone'] ?? '');
        final merchantAddress = (branch != null && (branch['address'] ?? '').toString().isNotEmpty)
            ? branch['address'].toString()
            : (tenant['address'] ?? '');
        final merchantLat = (branch != null && branch['latitude'] != null)
            ? (branch['latitude'] as num).toDouble()
            : ((tenant['latitude'] as num?)?.toDouble() ?? 10.077715);
        final merchantLng = (branch != null && branch['longitude'] != null)
            ? (branch['longitude'] as num).toDouble()
            : ((tenant['longitude'] as num?)?.toDouble() ?? -69.2812938);

        final pin = () {
          final notes = (data['notes'] ?? '').toString();
          if (notes.contains('[PIN:')) {
            final m = RegExp(r'\[PIN:(\d{4})\]').firstMatch(notes);
            if (m != null) return m.group(1)!;
          }
          final orderNum = (data['order_number'] ?? '').toString();
          final digits = orderNum.replaceAll(RegExp(r'\D'), '');
          if (digits.length >= 4) {
            return digits.substring(digits.length - 4);
          }
          return data['delivery_pin']?.toString() ?? '1234';
        }();

        return DeliveryOrder(
          id: data['id']?.toString() ?? '',
          orderNumber: data['order_number'] ?? 'ORD-0000',
          merchantName: merchantName,
          merchantPhone: merchantPhone,
          merchantAddress: merchantAddress,
          merchantLat: merchantLat,
          merchantLng: merchantLng,
          customerName: data['customer_name'] ?? 'Cliente',
          customerPhone: data['customer_phone'] ?? '',
          customerAddress: data['delivery_address'] ?? 'Dirección de Entrega',
          customerLat: (data['delivery_lat'] as num?)?.toDouble() ?? 10.034574,
          customerLng: (data['delivery_lng'] as num?)?.toDouble() ?? -69.237544,
          riderName: rider['name'] ?? '',
          riderPhone: rider['phone'] ?? '',
          riderVehicle: rider['name'] != null ? '${rider['vehicle_type'] ?? "Moto"} • ${rider['vehicle_model'] ?? ""}' : '',
          riderPlate: rider['vehicle_plate'] ?? '',
          pin: pin,
          status: _mapStatus(data['status']),
          items: items,
          subtotal: (data['subtotal'] as num?)?.toDouble() ?? 0.0,
          deliveryFee: (data['delivery_fee'] as num?)?.toDouble() ?? 2.50,
          total: (data['total'] as num?)?.toDouble() ?? 0.0,
          paymentMethod: data['payment_method'] ?? 'Pago Móvil',
          createdAt: DateTime.tryParse(data['created_at'] ?? '') ?? DateTime.now(),
          branchId: data['branch_id']?.toString(),
          companyId: data['tenant_id']?.toString(),
        );
      }
    } catch (e) {
      if (kDebugMode) {
        print('[ApiService] Error fetching order $orderId: $e');
      }
    }
    return null;
  }

  /// Fetch real OSRM fastest route from multi-engine OSRM or backend
  Future<Map<String, dynamic>> fetchFastestRoute({
    required double originLat,
    required double originLng,
    required double destLat,
    required double destLng,
  }) async {
    // 1. Multi-engine Optimal Routing (evaluates all urban alternatives across 3 OSRM engines and selects the shortest & fastest path)
    try {
      final coordsParam = '$originLng,$originLat;$destLng,$destLat';
      final endpoints = [
        'https://routing.openstreetmap.de/routed-car/route/v1/driving/$coordsParam?overview=full&geometries=geojson&alternatives=3&continue_straight=false',
        'https://router.project-osrm.org/route/v1/driving/$coordsParam?overview=full&geometries=geojson&alternatives=3&continue_straight=false',
        'https://routing.openstreetmap.de/routed-bike/route/v1/driving/$coordsParam?overview=full&geometries=geojson&alternatives=3&continue_straight=false',
      ];

      final responses = await Future.wait(
        endpoints.map((url) async {
          try {
            final res = await http
                .get(Uri.parse(url), headers: {'User-Agent': 'DeliveryApp/1.0'})
                .timeout(const Duration(seconds: 4));
            if (res.statusCode == 200) {
              return json.decode(res.body) as Map<String, dynamic>;
            }
          } catch (_) {}
          return null;
        }),
      );

      double bestScore = double.infinity;
      Map<String, dynamic>? bestResult;

      for (final data in responses) {
        if (data == null || data['code'] != 'Ok' || data['routes'] == null) continue;
        final routes = data['routes'] as List;
        for (final r in routes) {
          final rawCoords = r['geometry']?['coordinates'] as List?;
          if (rawCoords == null || rawCoords.length < 2) continue;
          final distKm = ((r['distance'] as num).toDouble()) / 1000.0;
          final rawDurMins = ((r['duration'] as num).toDouble()) / 60.0;
          final avgSpeedMins = (distKm / 30.0) * 60.0;
          final motoMins = math.max(1, (math.min(rawDurMins, avgSpeedMins * 1.15) * 0.85).round());
          final score = (distKm * 1.7) + (motoMins * 0.3);

          if (score < bestScore) {
            bestScore = score;
            final pts = rawCoords
                .map<List<double>>((c) => [(c[1] as num).toDouble(), (c[0] as num).toDouble()])
                .toList();
            bestResult = {
              'distanceKm': double.parse(distKm.toStringAsFixed(2)),
              'durationMinutes': motoMins.clamp(1, 180),
              'waypoints': pts,
            };
          }
        }
      }

      if (bestResult != null) {
        return bestResult;
      }
    } catch (e) {
      if (kDebugMode) print('[ApiService] Optimal OSRM error: $e');
    }

    // 2. Fallback to Backend endpoint
    final backendUrls = [
      '${AppConfig.backendBaseUrl}/orders/fastest-route?originLat=$originLat&originLng=$originLng&destLat=$destLat&destLng=$destLng',
      'http://192.168.0.151:3000/api/orders/fastest-route?originLat=$originLat&originLng=$originLng&destLat=$destLat&destLng=$destLng',
    ];

    for (final u in backendUrls) {
      try {
        final res = await http.get(Uri.parse(u)).timeout(const Duration(seconds: 3));
        if (res.statusCode == 200) {
          final data = json.decode(res.body);
          if (data['success'] == true && data['waypoints'] != null) {
            final rawWaypoints = data['waypoints'] as List;
            final pts = rawWaypoints
                .map<List<double>>((pt) => [(pt[0] as num).toDouble(), (pt[1] as num).toDouble()])
                .toList();
            return {
              'distanceKm': (data['distanceKm'] as num?)?.toDouble() ?? 4.29,
              'durationMinutes': data['durationMinutes'] ?? 7,
              'waypoints': pts,
            };
          }
        }
      } catch (_) {}
    }

    // Straight line fallback between origin and destination coordinates
    final directDistance = calculateDistanceKm(originLat, originLng, destLat, destLng);
    return {
      'distanceKm': double.parse(directDistance.toStringAsFixed(2)),
      'durationMinutes': (15 + (directDistance * 2.5)).round().clamp(5, 120),
      'waypoints': [
        [originLat, originLng],
        [destLat, destLng],
      ],
    };
  }

  /// Rate rider after delivery completion
  Future<bool> rateRider({
    required String riderId,
    required double rating,
    String? orderId,
    String? comment,
  }) async {
    try {
      final supabase = Supabase.instance.client;
      final res = await supabase.from('riders').select('rating, total_deliveries').eq('id', riderId).maybeSingle();
      if (res != null) {
        final currentTotal = (res['total_deliveries'] as num?)?.toInt() ?? 0;
        final currentRating = (res['rating'] as num?)?.toDouble() ?? 5.0;
        final newTotal = currentTotal + 1;
        final newRating = double.parse(((currentRating * currentTotal + rating) / newTotal).toStringAsFixed(1));
        await supabase.from('riders').update({
          'rating': newRating,
          'total_deliveries': newTotal,
          'updated_at': DateTime.now().toIso8601String(),
        }).eq('id', riderId);
      }
      if (orderId != null) {
        try {
          await supabase.from('orders').update({
            'rider_rating': rating,
            'rider_review': comment,
          }).eq('id', orderId);
        } catch (_) {}
      }
      return true;
    } catch (e) {
      debugPrint('[ApiService] Error calificando rider: $e');
      return false;
    }
  }

  /// Calculate real distance in km between two coordinate points
  static double calculateDistanceKm(double lat1, double lon1, double lat2, double lon2) {
    const double p = 0.017453292519943295;
    final double a = 0.5 -
        math.cos((lat2 - lat1) * p) / 2 +
        math.cos(lat1 * p) * math.cos(lat2 * p) * (1 - math.cos((lon2 - lon1) * p)) / 2;
    final straight = 12742 * math.asin(math.sqrt(a));
    // Factor de ruta vial terrestre (1.28x) para reflejar calles y retornos reales
    return straight * 1.28;
  }

  /// Compute realistic delivery time dynamically based on distance
  static String calculateDeliveryTime(double? storeLat, double? storeLng, double? custLat, double? custLng) {
    if (storeLat == null || storeLng == null || custLat == null || custLng == null) {
      return '25-35 min';
    }
    final distanceKm = calculateDistanceKm(storeLat, storeLng, custLat, custLng);
    // Cooking & packaging: 15-20 min, Motorcycle transit: ~2.2-3.2 min per km
    final minTime = (15 + (distanceKm * 2.2)).round();
    final maxTime = (20 + (distanceKm * 3.2)).round();
    return '$minTime-$maxTime min';
  }

  /// Default branches list (empty by default; loaded dynamically from DB)
  static const List<Branch> defaultRealBranches = [];

  /// Default tenants list (empty by default; loaded dynamically from DB)
  static final List<Map<String, dynamic>> defaultRealTenants = [];

  /// Fetch active branches for a company
  Future<List<Branch>> fetchBranchesForCompany(String companyId) async {
    final urls = [
      '${AppConfig.backendBaseUrl}/tenants/$companyId/branches?onlyActive=true',
      'http://192.168.0.151:3000/api/tenants/$companyId/branches?onlyActive=true',
      'http://127.0.0.1:3000/api/tenants/$companyId/branches?onlyActive=true',
    ];

    for (final u in urls) {
      try {
        final res = await http.get(Uri.parse(u)).timeout(const Duration(seconds: 3));
        if (res.statusCode == 200) {
          final List list = json.decode(res.body);
          if (list.isNotEmpty) {
            return list
                .map((b) => Branch.fromJson(b as Map<String, dynamic>))
                .where((b) => b.status == 'active')
                .toList();
          }
        }
      } catch (e) {
        if (kDebugMode) print('[ApiService] fetchBranchesForCompany backend exception on $u: $e');
      }
    }

    try {
      final supabase = Supabase.instance.client;
      final data = await supabase
          .from('branches')
          .select('*, branch_payment_credentials(*)')
          .eq('company_id', companyId)
          .eq('status', 'active');
      if (data.isNotEmpty) {
        return (data as List)
            .map((b) => Branch.fromJson(b))
            .where((b) => b.status == 'active')
            .toList();
      }
    } catch (e) {
      if (kDebugMode) print('[ApiService] Supabase fetchBranchesForCompany note: $e');
    }

    return [];
  }

  Map<String, dynamic> _mapTenantItem(dynamic item) {
    final rawBranches = item['branches'];
    List<Branch> branchesList = [];
    if (rawBranches is List) {
      branchesList = rawBranches
          .map((b) => b is Branch ? b : Branch.fromJson(b as Map<String, dynamic>))
          .where((b) => b.status == 'active')
          .toList();
    }
    final baseFee = ((item['base_delivery_fee'] ?? item['deliverySettings']?['baseDeliveryFee']) as num?)?.toDouble() ?? 2.50;
    final rawRate = ((item['exchange_rate'] ?? item['currency_settings']?['exchangeRate'] ?? item['currencySettings']?['exchangeRate']) as num?)?.toDouble();
    final rate = (rawRate != null && rawRate > 0) ? rawRate : DolarApiService().officialRate;
    final displayMode = item['display_mode'] ?? item['currency_settings']?['displayMode'] ?? item['currencySettings']?['displayMode'] ?? 'usd_and_bs';
    final baseCurrency = item['base_currency'] ?? item['currency_settings']?['baseCurrency'] ?? item['currencySettings']?['baseCurrency'] ?? 'USD';
    final accent = item['accent_color'] ?? item['branding']?['accentColor'] ?? '#ea580c';
    final tagline = item['tagline'] ?? '';
    final whatsapp = item['whatsapp_number'] ?? item['contact']?['whatsappNumber'] ?? item['phone'] ?? '';
    final rawLogo = item['logo_url'] ?? item['branding']?['logoUrl'];
    final rawBanner = item['banner_url'] ?? item['branding']?['bannerUrl'];
    final deliveryRadius = (item['delivery_radius_km'] as num?)?.toDouble() ??
        (item['deliveryRadiusKm'] as num?)?.toDouble() ??
        (item['deliverySettings']?['deliveryRadiusKm'] as num?)?.toDouble() ??
        15.0;

    return {
      'id': item['id'],
      'name': item['name'] ?? 'Comercio',
      'slug': item['slug'] ?? '',
      'category': item['category'] ?? 'Restaurantes',
      'subcategories': item['subcategories'] ?? [],
      'rating': item['rating']?.toString() ?? '5.0',
      'reviewsCount': item['reviews_count']?.toString() ?? '0',
      'time': '25-35 min',
      'fee': '\$${baseFee.toStringAsFixed(2)}',
      'baseDeliveryFee': baseFee,
      'imageUrl': (rawLogo != null && rawLogo.toString().trim().isNotEmpty)
          ? rawLogo.toString()
          : 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?w=500',
      'bannerUrl': (rawBanner != null && rawBanner.toString().trim().isNotEmpty)
          ? rawBanner.toString()
          : 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=1200',
      'address': item['address'] ?? item['contact']?['address'] ?? '',
      'phone': item['phone'] ?? item['contact']?['phone'] ?? '',
      'whatsappNumber': whatsapp,
      'accentColor': accent,
      'tagline': tagline,
      'exchangeRate': rate,
      'baseCurrency': baseCurrency,
      'displayMode': displayMode,
      'acceptedPaymentMethods': item['accepted_payment_methods'] ?? item['payment_methods'] ?? item['paymentMethods'] ?? item['currency_settings']?['acceptedPaymentMethods'] ?? item['currencySettings']?['acceptedPaymentMethods'] ?? ['pago_movil', 'cash_usd', 'zelle'],
      'latitude': (item['latitude'] as num?)?.toDouble() ?? 10.077715,
      'longitude': (item['longitude'] as num?)?.toDouble() ?? -69.2812938,
      'delivery_radius_km': deliveryRadius,
      'deliveryRadiusKm': deliveryRadius,
      'isPromo': false,
      'promoText': '',
      'isFeatured': item['is_featured'] ?? item['isFeatured'] ?? false,
      'branches': branchesList,
    };
  }

  /// Fetch real merchants/tenants from backend
  Future<List<Map<String, dynamic>>> fetchTenants() async {
    // 1. Direct cloud Supabase query (Immediate, works from any network/device)
    try {
      final supabase = Supabase.instance.client;
      final data = await supabase
          .from('tenants')
          .select('*, branches(*)')
          .eq('is_active', true)
          .timeout(const Duration(seconds: 4));
      if (data.isNotEmpty) {
        return (data as List).map((item) => _mapTenantItem(item)).toList();
      }
    } catch (e) {
      if (kDebugMode) print('[ApiService] Supabase fetchTenants notice: $e');
    }

    // 2. Fallback: local backend
    final urls = [
      '${AppConfig.backendBaseUrl}/tenants',
      'http://192.168.0.151:3000/api/tenants',
      'http://127.0.0.1:3000/api/tenants',
    ];

    for (final u in urls) {
      try {
        final res = await http.get(Uri.parse(u)).timeout(const Duration(seconds: 2));
        if (res.statusCode == 200) {
          final List list = json.decode(res.body);
          if (list.isNotEmpty) {
            return list.map((item) => _mapTenantItem(item)).toList();
          }
        }
      } catch (e) {
        if (kDebugMode) print('[ApiService] fetchTenants exception on $u: $e');
      }
    }

    return [];
  }

  /// Fetch real products for a tenant and specific branch (Database Only - Zero Mock Products)
  Future<List<Product>> fetchProductsByTenant(String tenantId, {String? branchId}) async {
    String queryParams = 'onlyAvailable=true';
    if (branchId != null && branchId.trim().isNotEmpty && branchId != 'all') {
      queryParams += '&branchId=${Uri.encodeComponent(branchId.trim())}';
    }

    final urls = [
      '${AppConfig.backendBaseUrl}/tenants/$tenantId/products?$queryParams',
      'http://192.168.0.151:3000/api/tenants/$tenantId/products?$queryParams',
      'http://127.0.0.1:3000/api/tenants/$tenantId/products?$queryParams',
    ];

    for (final u in urls) {
      try {
        final res = await http.get(Uri.parse(u)).timeout(const Duration(seconds: 3));
        if (res.statusCode == 200) {
          final List list = json.decode(res.body);
          return list.map((item) {
            final rawModGroups = item['modifier_groups'] ?? item['modifierGroups'] ?? [];
            final modGroups = (rawModGroups as List? ?? [])
                .map((g) => ProductModifierGroup.fromJson(g as Map<String, dynamic>))
                .toList();

            final options = <ProductOption>[];
            for (final g in modGroups) {
              for (final opt in g.options) {
                options.add(
                  ProductOption(
                    name: '${g.title}: ${opt.name}',
                    extraPrice: opt.priceDelta,
                  ),
                );
              }
            }

            final name = item['name']?.toString() ?? '';
            final category = item['categories']?['name'] ?? 'General';

            return Product(
              id: item['id'] ?? '',
              name: name,
              description: item['description'] ?? '',
              price: (item['price'] as num?)?.toDouble() ?? 0.0,
              imageUrl: item['image_url'] ??
                  item['imageUrl'] ??
                  'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
              category: category,
              isPopular: item['is_popular'] ?? item['isPopular'] ?? false,
              isFeatured: item['is_featured'] ?? item['isFeatured'] ?? false,
              isOnSale: item['is_on_sale'] ?? item['isOnSale'] ?? false,
              compareAtPrice: (item['compare_at_price'] as num?)?.toDouble() ?? (item['compareAtPrice'] as num?)?.toDouble(),
              discountPercentage: (item['discount_percentage'] as num?)?.toInt() ?? (item['discountPercentage'] as num?)?.toInt(),
              branchId: item['branch_id'] ?? item['branchId'],
              availableOptions: options,
              modifierGroups: modGroups,
            );
          }).toList();
        }
      } catch (e) {
        if (kDebugMode) print('[ApiService] fetchProductsByTenant exception on $u: $e');
      }
    }

    // Direct Supabase fallback
    try {
      final supabase = Supabase.instance.client;
      var query = supabase
          .from('products')
          .select('*, categories(name), modifier_groups(*, modifier_options(*))')
          .eq('tenant_id', tenantId)
          .or('is_available.eq.true,is_available.is.null');

      if (branchId != null && branchId.trim().isNotEmpty && branchId != 'all') {
        final bData = await supabase.from('branches').select('is_main').eq('id', branchId.trim()).maybeSingle();
        final isMain = bData != null && bData['is_main'] == true;
        if (isMain) {
          query = query.or('branch_id.eq.${branchId.trim()},branch_id.is.null');
        } else {
          query = query.eq('branch_id', branchId.trim());
        }
      }

      var data = await query.order('sort_order', ascending: true);
      return (data as List).map((item) {
        final rawModGroups = item['modifier_groups'] ?? [];
        final modGroups = (rawModGroups as List)
            .map((g) => ProductModifierGroup.fromJson(g as Map<String, dynamic>))
            .toList();

        final options = <ProductOption>[];
        for (final g in modGroups) {
          for (final opt in g.options) {
            options.add(
              ProductOption(
                name: '${g.title}: ${opt.name}',
                extraPrice: opt.priceDelta,
              ),
            );
          }
        }

        final name = item['name']?.toString() ?? '';
        final category = item['categories']?['name'] ?? 'General';

        return Product(
          id: item['id'] ?? '',
          name: name,
          description: item['description'] ?? '',
          price: (item['price'] as num?)?.toDouble() ?? 0.0,
          imageUrl: item['image_url'] ??
              'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=600',
          category: category,
          isPopular: item['is_popular'] ?? false,
          isFeatured: item['is_featured'] ?? false,
          isOnSale: item['is_on_sale'] ?? false,
          compareAtPrice: (item['compare_at_price'] as num?)?.toDouble(),
          discountPercentage: (item['discount_percentage'] as num?)?.toInt(),
          branchId: item['branch_id'],
          availableOptions: options,
          modifierGroups: modGroups,
        );
      }).toList();
    } catch (e) {
      if (kDebugMode) print('[ApiService] Supabase fetchProductsByTenant note: $e');
    }

    // Zero mock fallback: if no products exist in the database for this branch, return empty list
    return [];
  }

  /// Fetch promotional banners from backend or fallback to Supabase
  Future<List<BannerItem>> fetchBanners() async {
    final urls = [
      '${AppConfig.backendBaseUrl}/banners?activeOnly=true',
      'http://192.168.0.151:3000/api/banners?activeOnly=true',
      'http://127.0.0.1:3000/api/banners?activeOnly=true',
    ];

    for (final u in urls) {
      try {
        final res = await http.get(Uri.parse(u)).timeout(const Duration(seconds: 3));
        if (res.statusCode == 200) {
          final List list = json.decode(res.body);
          if (list.isNotEmpty) {
            return list.map((b) => BannerItem.fromJson(b as Map<String, dynamic>)).toList();
          }
        }
      } catch (e) {
        if (kDebugMode) print('[ApiService] fetchBanners exception on $u: $e');
      }
    }

    try {
      final supabase = Supabase.instance.client;
      final data = await supabase.from('banners').select().eq('is_active', true).order('sort_order', ascending: true);
      if (data.isNotEmpty) {
        return (data as List).map((b) => BannerItem.fromJson(b as Map<String, dynamic>)).toList();
      }
    } catch (_) {}

    // Default flash promotion fallback banner
    return const [
      BannerItem(
        id: 'banner_default',
        title: '30% OFF en tu primer pedido',
        subtitle: 'Usa el cupón FLASHNOW al pagar',
        couponCode: 'FLASHNOW',
        badgeText: '⚡ ENTREGA FLASH 20 MIN',
        buttonText: 'Pedir ahora',
        linkUrl: '/explorar',
        imageUrl: 'https://images.unsplash.com/photo-1568901346375-23c9450c58cd?w=500',
        bgGradientStart: '#f97316',
        bgGradientEnd: '#ea580c',
        isActive: true,
      ),
    ];
  }

  /// Obtiene notificaciones y cupones dirigidos a los clientes directamente desde Supabase Cloud
  Future<List<Map<String, dynamic>>> fetchNotifications({String? customerId}) async {
    try {
      final supaClient = Supabase.instance.client;
      final res = await supaClient
          .from('customer_notifications')
          .select('*')
          .order('created_at', ascending: false)
          .limit(40);
      if (res is List && res.isNotEmpty) {
        return List<Map<String, dynamic>>.from(res.map((n) => {
          'id': n['id'],
          'title': n['title'] ?? 'Notificación Pídetelo',
          'body': n['body'] ?? n['message'] ?? '',
          'message': n['body'] ?? n['message'] ?? '',
          'type': n['type'] ?? 'coupon',
          'coupon_code': n['coupon_code'] ?? n['data']?['couponCode'] ?? '',
          'couponCode': n['coupon_code'] ?? n['data']?['couponCode'] ?? '',
          'data': n['data'] ?? {},
          'created_at': n['created_at'] ?? DateTime.now().toIso8601String(),
        }));
      }
    } catch (e) {
      if (kDebugMode) print('[ApiService] Supabase notifications fetch error: $e');
    }

    final urls = [
      '${AppConfig.backendBaseUrl}/notifications',
      'http://192.168.0.151:3000/api/notifications',
      'http://127.0.0.1:3000/api/notifications',
    ];

    for (final u in urls) {
      try {
        final res = await http.get(Uri.parse(u)).timeout(const Duration(seconds: 4));
        if (res.statusCode == 200) {
          final decoded = jsonDecode(res.body);
          if (decoded is List && decoded.isNotEmpty) {
            return List<Map<String, dynamic>>.from(decoded);
          }
        }
      } catch (_) {}
    }

    return [
      {
        'id': 'welcome_promo',
        'title': '🎉 ¡Bienvenido a Pídetelo!',
        'body': 'Disfruta de delivery rápido, tarifas transparentes en Bs. y seguimiento GPS en tiempo real.',
        'message': 'Disfruta de delivery rápido, tarifas transparentes en Bs. y seguimiento GPS en tiempo real.',
        'type': 'system',
        'coupon_code': 'BIENVENIDO',
        'couponCode': 'BIENVENIDO',
        'created_at': DateTime.now().toIso8601String(),
      }
    ];
  }

  /// Update order status in backend
  Future<bool> updateOrderStatus(String orderId, String newStatus) async {
    final urls = [
      '${AppConfig.backendBaseUrl}/orders/$orderId/status',
      'http://192.168.0.151:3000/api/orders/$orderId/status',
      'http://127.0.0.1:3000/api/orders/$orderId/status',
    ];

    for (final u in urls) {
      try {
        final res = await http.patch(
          Uri.parse(u),
          headers: {'Content-Type': 'application/json'},
          body: json.encode({'status': newStatus}),
        ).timeout(const Duration(seconds: 3));
        if (res.statusCode == 200 || res.statusCode == 204) {
          return true;
        }
      } catch (e) {
        if (kDebugMode) print('[ApiService] updateOrderStatus exception on $u: $e');
      }
    }
    return false;
  }

  /// Create real order in Supabase Cloud and Backend
  Future<bool> createOrder(DeliveryOrder order) async {
    bool savedInSupabase = false;

    final validBranchId = (order.branchId != null &&
            order.branchId!.trim().isNotEmpty &&
            order.branchId != 'all')
        ? order.branchId!.trim()
        : null;

    final uuidRegex = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
    String resolvedTenantId = (order.companyId != null && uuidRegex.hasMatch(order.companyId!.trim()))
        ? order.companyId!.trim()
        : '';

    // 1. Primary: Save directly to Supabase Cloud PostgreSQL
    try {
      final supabase = Supabase.instance.client;

      if (resolvedTenantId.isEmpty && validBranchId != null) {
        final bData = await supabase.from('branches').select('company_id').eq('id', validBranchId).maybeSingle();
        if (bData != null && bData['company_id'] != null && uuidRegex.hasMatch(bData['company_id'].toString())) {
          resolvedTenantId = bData['company_id'].toString();
        }
      }

      if (resolvedTenantId.isEmpty) {
        final tData = await supabase.from('tenants').select('id').eq('is_active', true).limit(1).maybeSingle();
        if (tData != null && tData['id'] != null && uuidRegex.hasMatch(tData['id'].toString())) {
          resolvedTenantId = tData['id'].toString();
        } else {
          resolvedTenantId = 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f';
        }
      }

      final inserted = await supabase
          .from('orders')
          .insert({
            'tenant_id': resolvedTenantId,
            'branch_id': validBranchId,
            'order_number': order.orderNumber,
            'source': 'mobile_app',
            'status': 'received',
            'fulfillment_type': 'delivery',
            'payment_method': 'mobile_transfer',
            'customer_name': order.customerName.isNotEmpty ? order.customerName : 'Cliente',
            'customer_phone': order.customerPhone.isNotEmpty ? order.customerPhone : '04120000000',
            'delivery_address': order.customerAddress.isNotEmpty ? order.customerAddress : 'Dirección de entrega',
            'delivery_lat': order.customerLat,
            'delivery_lng': order.customerLng,
            'subtotal': order.subtotal,
            'delivery_fee': order.deliveryFee,
            'total': order.total,
            'notes': '[PIN:${order.pin}]',
          })
          .select()
          .single();

      final orderId = inserted['id']?.toString();
      if (orderId != null && order.items.isNotEmpty) {
        final itemsPayload = order.items.map((i) => {
          'order_id': orderId,
          'product_id': uuidRegex.hasMatch(i.product.id) ? i.product.id : null,
          'product_name': i.product.name,
          'unit_price': i.product.price,
          'quantity': i.quantity,
          'item_total': i.totalPrice,
          'selected_modifiers': i.selectedModifiers.map((m) => m.toJson()).toList(),
        }).toList();
        await supabase.from('order_items').insert(itemsPayload);
      }
      debugPrint('[ApiService] ✅ Pedido guardado exitosamente en Supabase: $orderId (Sede: $validBranchId, Tenant: $resolvedTenantId)');
      savedInSupabase = true;
    } catch (e) {
      debugPrint('[ApiService] Error guardando pedido en Supabase: $e');
    }

    // 2. Secondary: Synchronize with local NestJS backend if reachable
    final payload = {
      'tenant_id': resolvedTenantId.isNotEmpty ? resolvedTenantId : 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f',
      'branch_id': validBranchId,
      'order_number': order.orderNumber,
      'customer_name': order.customerName.isNotEmpty ? order.customerName : 'Cliente',
      'customer_phone': order.customerPhone.isNotEmpty ? order.customerPhone : '04120000000',
      'delivery_address': order.customerAddress.isNotEmpty ? order.customerAddress : 'Dirección de entrega',
      'delivery_lat': order.customerLat,
      'delivery_lng': order.customerLng,
      'payment_method': order.paymentMethod,
      'subtotal': order.subtotal,
      'delivery_fee': order.deliveryFee,
      'total': order.total,
      'items': order.items
          .map((i) => {
                'product_id': uuidRegex.hasMatch(i.product.id) ? i.product.id : null,
                'product_name': i.product.name,
                'unit_price': i.product.price,
                'quantity': i.quantity,
                'item_total': i.totalPrice,
                'selected_modifiers': i.selectedModifiers.map((m) => m.toJson()).toList(),
              })
          .toList(),
    };

    final urls = [
      '${AppConfig.backendBaseUrl}/orders',
      'http://127.0.0.1:3000/api/orders',
      'http://192.168.0.151:3000/api/orders',
    ];

    for (final u in urls) {
      try {
        final res = await http
            .post(
              Uri.parse(u),
              headers: {'Content-Type': 'application/json'},
              body: json.encode(payload),
            )
            .timeout(const Duration(seconds: 2));
        if (res.statusCode == 200 || res.statusCode == 201) {
          return true;
        }
      } catch (_) {}
    }

    return savedInSupabase;
  }

  /// Fetch user's orders from Supabase cloud database
  Future<List<DeliveryOrder>> fetchUserOrdersFromCloud(String phoneOrName) async {
    final search = phoneOrName.trim();
    if (search.isEmpty || search.toLowerCase() == 'cliente' || search.toLowerCase() == 'invitado') {
      return [];
    }

    try {
      final supabase = Supabase.instance.client;
      final query = supabase
          .from('orders')
          .select('*, order_items(*), riders(*), branches(*), tenants(*)')
          .order('created_at', ascending: false)
          .limit(25);

      final List<dynamic> data = await query;
      final List<DeliveryOrder> list = [];

      final searchClean = search.replaceAll(RegExp(r'\D'), '');
      final searchName = search.toLowerCase();

      for (final row in data) {
        final cPhone = row['customer_phone']?.toString().replaceAll(RegExp(r'\D'), '') ?? '';
        final cName = (row['customer_name']?.toString() ?? '').toLowerCase().trim();

        bool matches = false;
        if (searchClean.length >= 7 && cPhone.contains(searchClean)) {
          matches = true;
        } else if (searchName.length >= 4 && cName == searchName) {
          matches = true;
        }

        if (!matches) continue;

        final rawItems = row['order_items'] as List? ?? [];
        final items = rawItems.map((i) {
          return CartItem(
            product: Product(
              id: i['product_id'] ?? 'p1',
              name: i['product_name'] ?? 'Producto',
              description: '',
              price: (i['unit_price'] as num?)?.toDouble() ?? 0.0,
              imageUrl: '',
              category: 'General',
            ),
            quantity: i['quantity'] ?? 1,
          );
        }).toList();

        final riderData = row['riders'] as Map<String, dynamic>?;
        final riderName = riderData != null ? (riderData['name']?.toString() ?? '') : '';
        final riderPhone = riderData != null ? (riderData['phone']?.toString() ?? '') : '';
        final riderVehicle = riderData != null ? (riderData['vehicle_model'] ?? riderData['vehicle_type'] ?? '') : '';
        final riderPlate = riderData != null ? (riderData['vehicle_plate']?.toString() ?? '') : '';
        final pin = row['delivery_pin']?.toString() ?? '${(row['id']?.toString().hashCode.abs() ?? 1000) % 9000 + 1000}';

        final branchData = row['branches'] as Map<String, dynamic>?;
        final tenantData = row['tenants'] as Map<String, dynamic>?;

        final merchantName = (branchData != null && (branchData['name'] ?? '').toString().isNotEmpty)
            ? branchData['name'].toString()
            : (tenantData != null && (tenantData['name'] ?? '').toString().isNotEmpty)
                ? tenantData['name'].toString()
                : 'Comercio';

        final merchantPhone = (branchData != null && (branchData['phone'] ?? '').toString().isNotEmpty)
            ? branchData['phone'].toString()
            : (tenantData != null && (tenantData['phone'] ?? '').toString().isNotEmpty)
                ? tenantData['phone'].toString()
                : '';

        final merchantAddress = (branchData != null && (branchData['address'] ?? '').toString().isNotEmpty)
            ? branchData['address'].toString()
            : (tenantData != null && (tenantData['address'] ?? '').toString().isNotEmpty)
                ? tenantData['address'].toString()
                : '';

        final merchantLat = (branchData != null && branchData['latitude'] != null)
            ? (branchData['latitude'] as num).toDouble()
            : (tenantData != null && tenantData['latitude'] != null)
                ? (tenantData['latitude'] as num).toDouble()
                : 10.077715;

        final merchantLng = (branchData != null && branchData['longitude'] != null)
            ? (branchData['longitude'] as num).toDouble()
            : (tenantData != null && tenantData['longitude'] != null)
                ? (tenantData['longitude'] as num).toDouble()
                : -69.2812938;

        list.add(
          DeliveryOrder(
            id: row['id']?.toString() ?? '',
            orderNumber: row['order_number'] ?? 'ORD-0000',
            merchantName: merchantName,
            merchantPhone: merchantPhone,
            merchantAddress: merchantAddress,
            merchantLat: merchantLat,
            merchantLng: merchantLng,
            customerName: row['customer_name'] ?? 'Cliente',
            customerPhone: row['customer_phone'] ?? '',
            customerAddress: row['delivery_address'] ?? 'Dirección de Entrega',
            customerLat: (row['delivery_lat'] as num?)?.toDouble() ?? 10.034574,
            customerLng: (row['delivery_lng'] as num?)?.toDouble() ?? -69.237544,
            riderName: riderName,
            riderPhone: riderPhone,
            riderVehicle: riderVehicle,
            riderPlate: riderPlate,
            pin: pin,
            status: _mapStatus(row['status']),
            items: items,
            subtotal: (row['subtotal'] as num?)?.toDouble() ?? 0.0,
            deliveryFee: (row['delivery_fee'] as num?)?.toDouble() ?? 0.0,
            total: (row['total'] as num?)?.toDouble() ?? 0.0,
            paymentMethod: row['payment_method'] ?? 'Pago Móvil',
            createdAt: DateTime.tryParse(row['created_at'] ?? '') ?? DateTime.now(),
            branchId: row['branch_id']?.toString(),
            companyId: row['tenant_id']?.toString(),
          ),
        );
      }
      return list;
    } catch (e) {
      debugPrint('[ApiService] Error cargando órdenes de Supabase: $e');
      return [];
    }
  }

  OrderDeliveryStatus _mapStatus(String? status) {
    if (status == null) return OrderDeliveryStatus.pending;
    switch (status.toLowerCase()) {
      case 'received':
      case 'pending':
        return OrderDeliveryStatus.pending;
      case 'confirmed':
        return OrderDeliveryStatus.confirmed;
      case 'in_kitchen':
      case 'preparing':
        return OrderDeliveryStatus.preparing;
      case 'assigned_driver':
      case 'assigned':
        return OrderDeliveryStatus.assigned;
      case 'on_the_way':
      case 'ontheway':
        return OrderDeliveryStatus.onTheWay;
      case 'delivered':
        return OrderDeliveryStatus.delivered;
      case 'cancelled':
        return OrderDeliveryStatus.cancelled;
      default:
        return OrderDeliveryStatus.pending;
    }
  }
}

