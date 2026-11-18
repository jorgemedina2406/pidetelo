import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/app_config.dart';
import '../models/user_model.dart';
import 'rider_service.dart';

class SessionService extends ChangeNotifier {
  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  static const String _keyRiderData = 'current_rider_user_v1';

  RiderUser? _currentRider;
  bool _isInitialized = false;
  String? _lastErrorMessage;
  bool _isDarkMode = true; // Por defecto modo oscuro (Dark Theme prioritario)

  RiderUser? get currentRider => _currentRider;
  bool get isAuthenticated => _currentRider != null;
  bool get isInitialized => _isInitialized;
  String? get lastErrorMessage => _lastErrorMessage;
  bool get isDarkMode => _isDarkMode;
  ThemeMode get themeMode => _isDarkMode ? ThemeMode.dark : ThemeMode.light;

  void toggleTheme() async {
    _isDarkMode = !_isDarkMode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool('rider_dark_mode', _isDarkMode);
    } catch (_) {}
  }

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      _isDarkMode = prefs.getBool('rider_dark_mode') ?? true;
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

  Future<bool> updateAvatar(String newAvatarUrl) async {
    if (_currentRider == null) return false;
    _currentRider = _currentRider!.copyWith(avatarUrl: newAvatarUrl);
    notifyListeners();

    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setString(_keyRiderData, jsonEncode(_currentRider!.toJson()));
    } catch (_) {}

    try {
      final supabase = Supabase.instance.client;
      await supabase
          .from('riders')
          .update({'avatar_url': newAvatarUrl})
          .eq('id', _currentRider!.id);
      return true;
    } catch (e) {
      debugPrint('[SessionService] Error actualizando avatar en Supabase: $e');
      return true;
    }
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
    _lastErrorMessage = null;

    // 1. Authenticate with Supabase Cloud Auth
    bool authSuccess = false;
    String? authUserId;
    try {
      final supabase = Supabase.instance.client;
      final authRes = await supabase.auth.signInWithPassword(
        email: cleanEmail,
        password: password,
      );
      if (authRes.user != null) {
        authSuccess = true;
        authUserId = authRes.user!.id;
      }
    } catch (authError) {
      debugPrint('[SessionService] Supabase Auth signIn notice: $authError');
      final errStr = authError.toString().toLowerCase();
      if (errStr.contains('invalid login credentials') || errStr.contains('invalid_grant')) {
        _lastErrorMessage = 'El correo electrónico o la contraseña ingresados son incorrectos. Por favor, verifica tus datos.';
      } else {
        _lastErrorMessage = 'Error de autenticación: ' + authError.toString().replaceAll('Exception:', '').replaceAll('AuthException:', '').trim();
      }
    }

    // 2. Query Supabase 'riders' table or 'profiles' table for this registered rider
    Map<String, dynamic>? riderData;
    try {
      final supabase = Supabase.instance.client;

      // 2.1 Intentar buscar en tabla 'riders' por email o user_id
      try {
        final ridersQuery = supabase.from('riders').select('*');
        if (authUserId != null) {
          riderData = await ridersQuery.or('email.ilike.$cleanEmail,user_id.eq.$authUserId').maybeSingle();
        } else {
          riderData = await ridersQuery.ilike('email', cleanEmail).maybeSingle();
        }
      } catch (rErr) {
        debugPrint('[SessionService] Error buscando en tabla riders: $rErr');
      }

      // 2.2 Si no existe en 'riders', consultar la tabla 'profiles'
      if (riderData == null) {
        try {
          final profQuery = supabase.from('profiles').select('*');
          final prof = authUserId != null
              ? await profQuery.or('id.eq.$authUserId,email.ilike.$cleanEmail').maybeSingle()
              : await profQuery.ilike('email', cleanEmail).maybeSingle();

          if (prof != null) {
            final role = prof['role']?.toString().toUpperCase();
            if (role != 'RIDER') {
              _lastErrorMessage = 'Esta cuenta está registrada como Cliente ($role). Para acceder como repartidor debes registrarte en la app Pídetelo Rider.';
              try { await supabase.auth.signOut(); } catch (_) {}
              return false;
            }

            // El usuario tiene role = 'RIDER' en profiles (ej: Armando Repartidor)
            // Sincronizarlo de inmediato a la tabla 'riders'
            final plate = 'MOTO-${cleanEmail.split('@').first.toUpperCase().replaceAll(RegExp(r'[^A-Z0-9]'), '')}';
            final toInsert = <String, dynamic>{
              'user_id': authUserId ?? prof['id'],
              'name': prof['full_name'] ?? 'Repartidor',
              'email': cleanEmail,
              'phone': prof['phone'] ?? '+584140000000',
              'status': 'available',
              'vehicle_type': 'moto',
              'vehicle_plate': plate,
              'vehicle_model': 'Motocicleta Estándar',
              'is_certified': true,
              'verification_status': 'verified',
              'verification_score': 100,
              'is_independent': prof['tenant_id'] == null,
              'rating': 5.0,
              'total_deliveries': 0,
              'wallet_balance': 0.0,
              'created_at': DateTime.now().toIso8601String(),
            };

            try {
              final inserted = await supabase.from('riders').insert(toInsert).select().maybeSingle();
              riderData = inserted ?? toInsert;
            } catch (insErr) {
              debugPrint('[SessionService] Error sincronizando perfil a riders: $insErr');
              riderData = toInsert;
            }
          }
        } catch (pErr) {
          debugPrint('[SessionService] Error consultando profiles: $pErr');
        }
      }

      // 2.3 Fallback a autenticación directa en el backend
      if (riderData == null) {
        try {
          final bResp = await http.post(
            Uri.parse('${AppConfig.backendBaseUrl}/riders/login'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({'user': cleanEmail, 'passwordAttempt': password}),
          ).timeout(const Duration(seconds: 5));

          if (bResp.statusCode == 200) {
            final bData = jsonDecode(bResp.body);
            if (bData is Map<String, dynamic>) {
              riderData = bData;
              authSuccess = true;
            }
          }
        } catch (_) {}
      }

      if (riderData != null) {
        final isActive = riderData['is_active'] ?? (riderData['status'] != 'inactive' && riderData['status'] != 'disabled');
        if (isActive == false || riderData['status'] == 'inactive' || riderData['status'] == 'disabled') {
          _lastErrorMessage = 'Tu cuenta de repartidor ha sido desactivada por la administración de la plataforma. Comunícate con soporte para más información.';
          try { await supabase.auth.signOut(); } catch (_) {}
          return false;
        }

        final companyId = riderData['company_id'] ?? riderData['companyId'] ?? riderData['tenant_id'];
        if (companyId != null && companyId.toString().isNotEmpty) {
          try {
            final tenantRes = await supabase
                .from('tenants')
                .select('id, name, is_active')
                .eq('id', companyId.toString())
                .maybeSingle();
            if (tenantRes != null) {
              final tenantActive = tenantRes['is_active'] ?? true;
              if (tenantActive == false) {
                _lastErrorMessage = 'El comercio al que perteneces (' + (tenantRes['name'] ?? 'comercio') + ') se encuentra temporalmente pausado o inactivo. No es posible iniciar turno en este momento.';
                try { await supabase.auth.signOut(); } catch (_) {}
                return false;
              }
            }
          } catch (tenantErr) {
            debugPrint('[SessionService] Error verificando estado del comercio: $tenantErr');
          }
        }

        if (!authSuccess && _lastErrorMessage != null) {
          return false;
        }

        final rider = RiderUser.fromJson(riderData);
        await saveRider(rider);
        return true;
      } else {
        if (_lastErrorMessage == null) {
          _lastErrorMessage = 'No se encontró ninguna cuenta de repartidor asociada a este correo electrónico.';
        }
        return false;
      }
    } catch (e) {
      debugPrint('[SessionService] Error consultando Supabase riders: $e');
      if (_lastErrorMessage == null) {
        _lastErrorMessage = 'Error al consultar la cuenta de repartidor: ' + e.toString();
      }
    }

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

      // Buscar si ya existe por email para evitar errores con constraints
      final existingRider = await supabase
          .from('riders')
          .select('id')
          .eq('email', cleanEmail)
          .maybeSingle();

      dynamic inserted;
      if (existingRider != null && existingRider['id'] != null) {
        inserted = await supabase
            .from('riders')
            .update(upsertData)
            .eq('id', existingRider['id'])
            .select()
            .maybeSingle();
      } else {
        inserted = await supabase
            .from('riders')
            .insert(upsertData)
            .select()
            .maybeSingle();
      }

      // Si falló por RLS o conexión de base de datos directa, enviar por API backend con service role
      if (inserted == null || inserted['id'] == null) {
        try {
          final res = await http.post(
            Uri.parse('${AppConfig.backendBaseUrl}/riders'),
            headers: {'Content-Type': 'application/json'},
            body: jsonEncode({
              'name': name.trim(),
              'email': cleanEmail,
              'password': password,
              'phone': phone.trim(),
              'national_id': nationalId.trim(),
              'vehicle_plate': vehiclePlate.trim().toUpperCase(),
              'vehicle_type': vehicleType,
              'vehicle_model': vehicleModel.trim(),
            }),
          ).timeout(const Duration(seconds: 10));
          if (res.statusCode == 200 || res.statusCode == 201) {
            inserted = jsonDecode(res.body);
          }
        } catch (bkErr) {
          debugPrint('[SessionService] Fallback backend error: $bkErr');
        }
      }

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

      if (response.statusCode >= 200 && response.statusCode < 300) {
        final decoded = jsonDecode(response.body);
        if (decoded is Map && decoded['rider'] != null) {
          final rData = decoded['rider'];
          final isCert = rData['isCertified'] == true || rData['is_certified'] == true;
          final vStatus = rData['verificationStatus']?.toString() ?? rData['verification_status']?.toString() ?? (isCert ? 'verified' : 'pending');
          final rider = RiderUser(
            id: rData['id']?.toString() ?? '',
            name: rData['name'] ?? name.trim(),
            email: cleanEmail,
            phone: phone.trim(),
            nationalId: nationalId.trim(),
            vehicleType: vehicleType,
            vehicleModel: vehicleModel.trim(),
            vehiclePlate: vehiclePlate.trim().toUpperCase(),
            isOnline: isCert,
            isCertified: isCert,
            verificationStatus: vStatus,
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
      debugPrint('[SessionService] Error al conectar con el backend de verificación: $e');
      _lastErrorMessage = 'No se pudo conectar con el servidor de verificación para validar y alojar tus documentos ($e).';
      return false;
    }

    return false;
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
    await prefs.remove('rider_user_id_v1');
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {}
    try {
      await RiderService().reset();
    } catch (_) {}
    notifyListeners();
  }
}
