import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/app_config.dart';
import '../models/user_model.dart';

class SessionService extends ChangeNotifier {
  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  static const String _keyRiderData = 'current_rider_user_v1';

  RiderUser? _currentRider;
  bool _isInitialized = false;

  RiderUser? get currentRider => _currentRider;
  bool get isAuthenticated => _currentRider != null;
  bool get isInitialized => _isInitialized;

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final riderJson = prefs.getString(_keyRiderData);
      if (riderJson != null) {
        _currentRider = RiderUser.fromJson(jsonDecode(riderJson));
      }
    } catch (e) {
      debugPrint('[SessionService] Error inicializando sesión de repartidor: $e');
    }
    _isInitialized = true;
    notifyListeners();
  }

  Future<void> saveRider(RiderUser rider) async {
    _currentRider = rider;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyRiderData, jsonEncode(rider.toJson()));
    await prefs.setString('rider_user_id_v1', rider.id);
    notifyListeners();
  }

  Future<bool> login(String email, String password) async {
    final cleanEmail = email.trim().toLowerCase();

    // 1. Authenticate with Supabase Cloud Auth
    try {
      final supabase = Supabase.instance.client;
      await supabase.auth.signInWithPassword(
        email: cleanEmail,
        password: password,
      );
    } catch (authError) {
      debugPrint('[SessionService] Supabase Auth signIn notice: $authError');
    }

    // 2. Query Supabase 'riders' table for this real registered rider
    try {
      final supabase = Supabase.instance.client;
      final res = await supabase
          .from('riders')
          .select('*')
          .eq('email', cleanEmail)
          .maybeSingle();

      if (res != null) {
        final rider = RiderUser.fromJson(res);
        await saveRider(rider);
        return true;
      }
    } catch (e) {
      debugPrint('[SessionService] Error consultando Supabase riders: $e');
    }

    // 3. If no rider found with this email, do not use test defaults
    return false;
  }

  Future<bool> register({
    required String name,
    required String email,
    required String password,
    required String phone,
    required String nationalId,
    required String vehicleType,
    required String vehicleModel,
    required String vehiclePlate,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    const String defaultTenantId = 'dac59429-fd6f-4d3e-8b2e-ab0e23828c1f';
    const String defaultBranchId = 'b1111111-fd6f-4d3e-8b2e-ab0e23828c1f';
    String? authUserId;

    // 1. Create Auth user in Supabase
    try {
      final supabase = Supabase.instance.client;
      final authRes = await supabase.auth.signUp(
        email: cleanEmail,
        password: password,
        data: {
          'name': name.trim(),
          'full_name': name.trim(),
          'phone': phone.trim(),
          'national_id': nationalId.trim(),
          'role': 'RIDER',
          'tenant_id': defaultTenantId,
          'branch_id': defaultBranchId,
        },
      );
      authUserId = authRes.user?.id;
    } catch (authErr) {
      debugPrint('[SessionService] Supabase Auth signUp notice: $authErr');
    }

    // 2. Register via Backend API for guaranteed service_role transactional creation
    String newId = '';
    try {
      final response = await http.post(
        Uri.parse('${AppConfig.backendBaseUrl}/riders'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'tenant_id': defaultTenantId,
          'branch_id': defaultBranchId,
          'name': name.trim(),
          'email': cleanEmail,
          'password': password,
          'phone': phone.trim(),
          'national_id': nationalId.trim(),
          'vehicle_type': vehicleType,
          'vehicle_plate': vehiclePlate.trim().toUpperCase(),
        }),
      );
      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['id'] != null) {
          newId = decoded['id'].toString();
        }
      }
    } catch (apiErr) {
      debugPrint('[SessionService] Backend API registration notice: $apiErr');
    }

    // 3. Fallback direct upsert to Supabase profiles & riders
    try {
      final supabase = Supabase.instance.client;
      if (authUserId != null) {
        await supabase.from('profiles').upsert({
          'id': authUserId,
          'tenant_id': defaultTenantId,
          'branch_id': defaultBranchId,
          'full_name': name.trim(),
          'email': cleanEmail,
          'phone': phone.trim(),
          'role': 'RIDER',
          'is_active': true,
        });
      }

      final upsertData = <String, dynamic>{
        if (authUserId != null) 'user_id': authUserId,
        'tenant_id': defaultTenantId,
        'branch_id': defaultBranchId,
        'name': name.trim(),
        'email': cleanEmail,
        'phone': phone.trim(),
        'national_id': nationalId.trim(),
        'vehicle_type': vehicleType,
        'vehicle_model': vehicleModel.trim(),
        'vehicle_plate': vehiclePlate.trim().toUpperCase(),
        'status': 'available',
        'rating': 5.0,
        'wallet_balance': 0.0,
        'payment_accounts': [],
      };

      final inserted = await supabase
          .from('riders')
          .upsert(upsertData, onConflict: 'email')
          .select()
          .maybeSingle();

      if (inserted != null && inserted['id'] != null) {
        newId = inserted['id'].toString();
      }
    } catch (e) {
      debugPrint('[SessionService] Supabase fallback notice: $e');
    }

    final rider = RiderUser(
      id: newId,
      name: name.trim(),
      email: cleanEmail,
      phone: phone.trim(),
      nationalId: nationalId.trim(),
      vehicleType: vehicleType,
      vehicleModel: vehicleModel.trim(),
      vehiclePlate: vehiclePlate.trim().toUpperCase(),
      isOnline: true,
      rating: 5.0,
      paymentAccounts: const [],
    );

    await saveRider(rider);
    return true;
  }

  Future<bool> updateAvatar(String avatarUrl) async {
    if (_currentRider == null) return false;
    final updated = _currentRider!.copyWith(avatarUrl: avatarUrl);
    await saveRider(updated);

    try {
      final supabase = Supabase.instance.client;
      await supabase.from('riders').update({
        'avatar_url': avatarUrl,
      }).eq('id', updated.id);
    } catch (e) {
      debugPrint('[SessionService] Error updating avatar: $e');
    }
    return true;
  }

  Future<bool> addPaymentAccount(RiderPaymentAccount account) async {
    if (_currentRider == null) return false;

    final updatedAccounts = List<RiderPaymentAccount>.from(_currentRider!.paymentAccounts)..add(account);
    final updated = _currentRider!.copyWith(paymentAccounts: updatedAccounts);
    await saveRider(updated);

    try {
      final supabase = Supabase.instance.client;
      await supabase.from('riders').update({
        'payment_accounts': updatedAccounts.map((a) => a.toJson()).toList(),
      }).eq('id', updated.id);
    } catch (e) {
      debugPrint('[SessionService] Error saving payment accounts to Supabase: $e');
    }
    return true;
  }

  Future<bool> deletePaymentAccount(String accountId) async {
    if (_currentRider == null) return false;

    final updatedAccounts = _currentRider!.paymentAccounts.where((a) => a.id != accountId).toList();
    final updated = _currentRider!.copyWith(paymentAccounts: updatedAccounts);
    await saveRider(updated);

    try {
      final supabase = Supabase.instance.client;
      await supabase.from('riders').update({
        'payment_accounts': updatedAccounts.map((a) => a.toJson()).toList(),
      }).eq('id', updated.id);
    } catch (e) {
      debugPrint('[SessionService] Error deleting payment account: $e');
    }
    return true;
  }

  Future<void> toggleOnlineStatus() async {
    if (_currentRider == null) return;
    final updated = _currentRider!.copyWith(isOnline: !_currentRider!.isOnline);
    await saveRider(updated);

    try {
      final supabase = Supabase.instance.client;
      await supabase.from('riders').update({
        'status': updated.isOnline ? 'available' : 'offline',
      }).eq('id', updated.id);
    } catch (e) {
      debugPrint('[SessionService] Error updating online status: $e');
    }
  }

  Future<void> logout() async {
    _currentRider = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyRiderData);
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {}
    notifyListeners();
  }
}
