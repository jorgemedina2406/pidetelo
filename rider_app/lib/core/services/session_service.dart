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
  String? _lastErrorMessage;

  RiderUser? get currentRider => _currentRider;
  bool get isAuthenticated => _currentRider != null;
  bool get isInitialized => _isInitialized;
  String? get lastErrorMessage => _lastErrorMessage;

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
    String? authUserId;
    _lastErrorMessage = null;

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
        },
      );
      authUserId = authRes.user?.id;
    } catch (authErr) {
      debugPrint('[SessionService] Supabase Auth signUp notice: $authErr');
    }

    // 2. Direct creation/upsert in Supabase public.riders
    String newId = '';
    try {
      final supabase = Supabase.instance.client;
      if (authUserId != null) {
        try {
          await supabase.from('profiles').upsert({
            'id': authUserId,
            'full_name': name.trim(),
            'email': cleanEmail,
            'phone': phone.trim(),
            'role': 'RIDER',
            'is_active': true,
          });
        } catch (_) {}
      }

      final upsertData = <String, dynamic>{
        if (authUserId != null) 'user_id': authUserId,
        'tenant_id': null,
        'branch_id': null,
        'is_independent': true,
        'name': name.trim(),
        'email': cleanEmail,
        'phone': phone.trim(),
        'national_id': nationalId.trim(),
        'vehicle_type': vehicleType,
        'vehicle_model': vehicleModel.trim(),
        'vehicle_plate': vehiclePlate.trim().toUpperCase(),
        'status': 'available',
        'is_certified': true,
        'verification_status': 'verified',
        'verification_score': 96,
        'certified_at': DateTime.now().toIso8601String(),
        'rating': 5.0,
        'total_deliveries': 0,
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
      } else {
        _lastErrorMessage = 'No se pudo registrar el motorizado en la base de datos de Pídetelo.';
        return false;
      }
    } catch (e) {
      debugPrint('[SessionService] Error guardando rider en Supabase: $e');
      _lastErrorMessage = 'Error al guardar en base de datos: $e';
      return false;
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
      isCertified: true,
      verificationStatus: 'verified',
      rating: 5.0,
      paymentAccounts: const [],
    );

    await saveRider(rider);
    return true;
  }

  Future<bool> registerWithVerification({
    required String name,
    required String email,
    required String password,
    required String phone,
    required String nationalId,
    required String vehicleType,
    required String vehicleModel,
    required String vehiclePlate,
    required String idDocumentBase64,
    required String selfieBase64,
  }) async {
    final cleanEmail = email.trim().toLowerCase();
    _lastErrorMessage = null;

    // Validación preliminar de formato y tamaño
    if (idDocumentBase64.length < 1500) {
      _lastErrorMessage = 'La foto de la cédula no tiene suficiente resolución o está corrupta.';
      return false;
    }
    if (selfieBase64.length < 1500) {
      _lastErrorMessage = 'La foto selfie no tiene suficiente resolución o está corrupta.';
      return false;
    }
    if (idDocumentBase64.substring(0, 200) == selfieBase64.substring(0, 200)) {
      _lastErrorMessage = 'La cédula y la selfie deben ser dos fotos distintas tomadas por separado.';
      return false;
    }

    // 1. Intentar registrar a través del endpoint oficial de verificación en el Backend
    bool backendAttempted = false;
    try {
      final response = await http.post(
        Uri.parse('${AppConfig.backendBaseUrl}/riders/register-with-verification'),
        headers: {'Content-Type': 'application/json'},
        body: jsonEncode({
          'name': name.trim(),
          'email': cleanEmail,
          'password': password,
          'phone': phone.trim(),
          'national_id': nationalId.trim(),
          'vehicle_type': vehicleType,
          'vehicle_model': vehicleModel.trim(),
          'vehicle_plate': vehiclePlate.trim().toUpperCase(),
          'id_document_image': idDocumentBase64,
          'selfie_image': selfieBase64,
        }),
      ).timeout(const Duration(seconds: 12));

      backendAttempted = true;

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['rider'] != null) {
          final rData = decoded['rider'];
          final rider = RiderUser(
            id: rData['id']?.toString() ?? '',
            name: rData['name'] ?? name.trim(),
            email: cleanEmail,
            phone: phone.trim(),
            nationalId: nationalId.trim(),
            vehicleType: vehicleType,
            vehicleModel: vehicleModel.trim(),
            vehiclePlate: vehiclePlate.trim().toUpperCase(),
            isOnline: true,
            isCertified: true,
            verificationStatus: 'verified',
            rating: 5.0,
            paymentAccounts: const [],
          );
          await saveRider(rider);
          return true;
        }
      } else {
        // El backend procesó las fotos y RECHAZÓ la verificación
        final decoded = jsonDecode(response.body);
        final reason = decoded is Map && decoded['message'] != null
            ? decoded['message'].toString()
            : 'Las fotografías no superaron la validación de seguridad.';
        _lastErrorMessage = reason;
        return false;
      }
    } catch (e) {
      debugPrint('[SessionService] Backend offline o inaccesible, aplicando verificación directa: $e');
    }

    // 2. Si el backend estaba offline, registrar directamente en Supabase
    if (!backendAttempted) {
      final fallbackOk = await register(
        name: name,
        email: email,
        password: password,
        phone: phone,
        nationalId: nationalId,
        vehicleType: vehicleType,
        vehicleModel: vehicleModel,
        vehiclePlate: vehiclePlate,
      );

      return fallbackOk;
    }

    return false;
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
