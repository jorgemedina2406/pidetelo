import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';
import 'package:supabase_flutter/supabase_flutter.dart';
import '../config/app_config.dart';
import '../models/user_model.dart';
import 'cart_service.dart';
import 'api_service.dart';
import 'notification_service.dart';

class SessionService extends ChangeNotifier {
  static final SessionService _instance = SessionService._internal();
  factory SessionService() => _instance;
  SessionService._internal();

  static const String _keySelectedRole = 'selected_role';
  static const String _keyUserData = 'user_data';
  static const String _keyRememberChoice = 'remember_choice';
  static const String _keyDarkMode = 'is_dark_mode';

  AppUserRole? _selectedRole;
  AppUser? _currentUser;
  bool _rememberChoice = false;
  bool _isInitialized = false;
  bool _isDarkMode = false;
  final Set<String> _favoriteStoreIds = {};
  Future<void>? _pendingFavSync;

  List<String> get _backendCandidateUrls => [
        AppConfig.backendBaseUrl,
        if (AppConfig.backendBaseUrl != 'https://api.pidetelo.app/api')
          'https://api.pidetelo.app/api',
      ];

  AppUserRole? get selectedRole => _selectedRole;
  AppUser? get currentUser => _currentUser;
  bool get rememberChoice => _rememberChoice;
  bool get isInitialized => _isInitialized;
  bool get isAuthenticated => _currentUser != null;
  bool get isDarkMode => _isDarkMode;
  ThemeMode get themeMode => _isDarkMode ? ThemeMode.dark : ThemeMode.light;
  Set<String> get favoriteStoreIds => Set.unmodifiable(_favoriteStoreIds);

  int get uniqueFavoriteCount {
    final uuidRegex = RegExp(
        r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');
    final uuids = _favoriteStoreIds
        .where((id) => uuidRegex.hasMatch(id.trim()))
        .map((id) => id.trim().toLowerCase())
        .toSet();
    if (uuids.isNotEmpty) return uuids.length;
    return _favoriteStoreIds
        .map((id) => id.trim().toLowerCase())
        .where((id) => id.isNotEmpty)
        .toSet()
        .length;
  }

  Future<void> toggleTheme() async {
    _isDarkMode = !_isDarkMode;
    notifyListeners();
    try {
      final prefs = await SharedPreferences.getInstance();
      await prefs.setBool(_keyDarkMode, _isDarkMode);
    } catch (_) {}
  }

  String _getFavoritesKey(String? identifier) {
    if (identifier == null || identifier.trim().isEmpty) return 'favs_guest';
    final sanitized = identifier.trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), '_');
    return 'favs_$sanitized';
  }

  Future<void> init() async {
    final prefs = await SharedPreferences.getInstance();
    final roleString = prefs.getString(_keySelectedRole);
    if (roleString != null) {
      _selectedRole =
          roleString == 'rider' ? AppUserRole.rider : AppUserRole.customer;
    }

    _rememberChoice = prefs.getBool(_keyRememberChoice) ?? false;
    _isDarkMode = prefs.getBool(_keyDarkMode) ?? false;

    final userJson = prefs.getString(_keyUserData);
    if (userJson != null) {
      try {
        _currentUser = AppUser.fromJson(jsonDecode(userJson));
        if (_currentUser != null) {
          NotificationService().init(customerId: _currentUser!.id);
        }
      } catch (e) {
        debugPrint('[SessionService] Error decodificando usuario: $e');
      }
    }

    // Load favorites specifically for current user or guest
    _favoriteStoreIds.clear();
    final favKey = _getFavoritesKey(_currentUser?.email.isNotEmpty == true ? _currentUser!.email : _currentUser?.id);
    final favs = prefs.getStringList(favKey);
    if (favs != null) {
      _favoriteStoreIds.addAll(favs);
    }

    if (_currentUser != null) {
      await Future.wait([
        syncFavoritesWithCloud(),
        CartService().loadUserOrders(
          _currentUser!.email.isNotEmpty
              ? _currentUser!.email
              : _currentUser!.id,
          phone: _currentUser!.phone,
        ),
      ]);
    } else {
      CartService().clearOrders();
    }

    // Escuchar cambios de autenticación de Supabase (ej: retorno de Google OAuth)
    try {
      Supabase.instance.client.auth.onAuthStateChange.listen((data) async {
        final AuthChangeEvent event = data.event;
        final Session? session = data.session;
        if ((event == AuthChangeEvent.signedIn || event == AuthChangeEvent.tokenRefreshed) && session != null) {
          final user = session.user;
          if (_currentUser == null || _currentUser!.id != user.id) {
            final email = user.email ?? '';
            final meta = user.userMetadata ?? {};
            final fullName = meta['full_name'] ?? meta['name'] ?? (email.isNotEmpty ? email.split('@').first : 'Cliente');
            final phone = meta['phone'] ?? user.phone ?? '';

            final appUser = AppUser(
              id: user.id,
              name: fullName.toString(),
              email: email,
              phone: phone.toString(),
              role: AppUserRole.customer,
              deliveryAddress: 'Cabudare, Edo. Lara',
            );
            await saveUser(appUser);

            try {
              await Supabase.instance.client.from('profiles').upsert({
                'id': user.id,
                'full_name': fullName,
                'email': email,
                'phone': phone,
                'role': 'CUSTOMER',
                'is_active': true,
                'updated_at': DateTime.now().toIso8601String(),
              });
            } catch (_) {}
          }
        }
      });
    } catch (e) {
      debugPrint('[SessionService] onAuthStateChange listen error: $e');
    }

    _isInitialized = true;
    notifyListeners();
  }

  Future<void> setSelectedRole(AppUserRole role, {bool remember = false}) async {
    _selectedRole = role;
    _rememberChoice = remember;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keySelectedRole, role.name);
    await prefs.setBool(_keyRememberChoice, remember);
    notifyListeners();
  }

  Future<void> saveUser(AppUser user) async {
    final bool isSameUser = _currentUser != null && _currentUser!.id == user.id;
    _currentUser = user;
    _selectedRole = user.role;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUserData, jsonEncode(user.toJson()));
    await prefs.setString(_keySelectedRole, user.role.name);

    // Switch favorites to this user (never wipe existing synced favs on concurrent same-user saveUser)
    if (!isSameUser) {
      _favoriteStoreIds.clear();
    }
    final favKey = _getFavoritesKey(user.email.isNotEmpty ? user.email : user.id);
    final favs = prefs.getStringList(favKey);
    if (favs != null) {
      _favoriteStoreIds.addAll(favs);
    }

    await Future.wait([
      syncFavoritesWithCloud(),
      CartService().loadUserOrders(
        user.email.isNotEmpty ? user.email : user.id,
        phone: user.phone,
      ),
    ]);

    // Registrar evento de login en métricas de la plataforma
    try {
      ApiService().logPlatformLogin(
        userId: user.id,
        userEmail: user.email,
        userName: user.name,
        role: user.role.name,
        platform: 'mobile_app_flutter',
      );
      NotificationService().init(customerId: user.id);
    } catch (_) {}

    notifyListeners();
  }

  Future<void> updateUserProfile(AppUser user) async {
    await saveUser(user);
  }

  bool isFavorite(String storeId, {String? slug}) {
    if (storeId.isEmpty && (slug == null || slug.isEmpty)) return false;
    final cleanId = storeId.trim();
    final cleanSlug = (slug ?? '').trim();
    return _favoriteStoreIds.contains(cleanId) ||
        _favoriteStoreIds.contains(cleanId.toLowerCase()) ||
        (cleanSlug.isNotEmpty &&
            (_favoriteStoreIds.contains(cleanSlug) ||
                _favoriteStoreIds.contains(cleanSlug.toLowerCase())));
  }

  Future<void> toggleFavorite(String storeId, {String? slug}) async {
    final keyToToggle = storeId.trim().isNotEmpty ? storeId.trim() : (slug?.trim() ?? '');
    if (keyToToggle.isEmpty) return;

    final wasFav = isFavorite(storeId, slug: slug);
    if (wasFav) {
      _favoriteStoreIds.remove(storeId.trim());
      _favoriteStoreIds.remove(storeId.trim().toLowerCase());
      if (slug != null && slug.trim().isNotEmpty) {
        _favoriteStoreIds.remove(slug.trim());
        _favoriteStoreIds.remove(slug.trim().toLowerCase());
      }
    } else {
      _favoriteStoreIds.add(keyToToggle);
      if (slug != null && slug.trim().isNotEmpty && slug.trim() != keyToToggle) {
        _favoriteStoreIds.add(slug.trim());
      }
    }
    final prefs = await SharedPreferences.getInstance();
    final favKey = _getFavoritesKey(_currentUser?.email.isNotEmpty == true ? _currentUser!.email : _currentUser?.id);
    await prefs.setStringList(favKey, _favoriteStoreIds.toList());
    notifyListeners();

    await _pushFavoritesToCloud(
      toggledStoreId: storeId.trim(),
      toggledSlug: slug?.trim(),
      isAdding: !wasFav,
    );
  }

  Future<void> syncFavoritesWithCloud() async {
    if (_pendingFavSync != null) {
      return _pendingFavSync!;
    }
    final future = _performSyncFavoritesWithCloud();
    _pendingFavSync = future;
    try {
      await future;
    } finally {
      if (identical(_pendingFavSync, future)) {
        _pendingFavSync = null;
      }
    }
  }

  Future<void> _performSyncFavoritesWithCloud() async {
    try {
      final supabase = Supabase.instance.client;
      final authUser = supabase.auth.currentUser;
      final userId = authUser?.id ?? _currentUser?.id;
      if (userId == null || userId.trim().isEmpty) return;

      final Set<String> cloudFavs = {};
      bool hasCustomerFavTableRows = false;
      void collect(dynamic list) {
        if (list is List) {
          for (final item in list) {
            final v = item?.toString().trim() ?? '';
            if (v.isNotEmpty) cloudFavs.add(v);
          }
        }
      }

      // 1. Auth user_metadata
      collect(authUser?.userMetadata?['favorite_store_ids']);

      // 2. Normalized customer_favorites table
      try {
        final rows = await supabase
            .from('customer_favorites')
            .select('tenant_id, tenant_slug')
            .eq('user_id', userId);
        for (final r in rows) {
          hasCustomerFavTableRows = true;
          final tid = r['tenant_id']?.toString().trim() ?? '';
          final tslug = r['tenant_slug']?.toString().trim() ?? '';
          if (tid.isNotEmpty) cloudFavs.add(tid);
          if (tslug.isNotEmpty) cloudFavs.add(tslug);
        }
      } catch (_) {}

      // 3. customer_carts.metadata
      try {
        final cartRes = await supabase
            .from('customer_carts')
            .select('metadata')
            .eq('user_id', userId)
            .maybeSingle();
        if (cartRes != null && cartRes['metadata'] is Map) {
          collect(cartRes['metadata']['favorite_store_ids']);
        }
      } catch (_) {}

      // 4. Backend endpoint fallback
      for (final base in _backendCandidateUrls) {
        try {
          final res = await http
              .get(Uri.parse('$base/users/$userId/favorites'))
              .timeout(const Duration(seconds: 8));
          if (res.statusCode == 200) {
            final decoded = jsonDecode(res.body);
            if (decoded is Map) {
              collect(decoded['favorites']);
            }
            break;
          }
        } catch (_) {}
      }

      if (cloudFavs.isNotEmpty) {
        _favoriteStoreIds.addAll(cloudFavs);
        final prefs = await SharedPreferences.getInstance();
        final favKey = _getFavoritesKey(
            _currentUser?.email.isNotEmpty == true
                ? _currentUser!.email
                : _currentUser?.id);
        await prefs.setStringList(favKey, _favoriteStoreIds.toList());
        notifyListeners();
        if (!hasCustomerFavTableRows) {
          await _pushFavoritesToCloud();
        }
      } else if (_favoriteStoreIds.isNotEmpty) {
        await _pushFavoritesToCloud();
      }
    } catch (e) {
      debugPrint('[SessionService] syncFavoritesWithCloud error: $e');
    }
  }

  Future<void> _pushFavoritesToCloud({
    String? toggledStoreId,
    String? toggledSlug,
    bool? isAdding,
  }) async {
    try {
      final supabase = Supabase.instance.client;
      final authUser = supabase.auth.currentUser;
      final userId = authUser?.id ?? _currentUser?.id;
      if (userId == null || userId.trim().isEmpty) return;

      final favList = _favoriteStoreIds.toList();
      final uuidRegex = RegExp(
          r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

      // 1. Normalized customer_favorites insert/delete (evita upsert por política RLS UPDATE)
      Future<void> syncFavoritesTable() async {
        try {
          if (toggledStoreId != null && uuidRegex.hasMatch(toggledStoreId)) {
            if (isAdding == true) {
              try {
                await supabase.from('customer_favorites').insert({
                  'user_id': userId,
                  'tenant_id': toggledStoreId,
                  'tenant_slug':
                      (toggledSlug != null && toggledSlug.isNotEmpty)
                          ? toggledSlug
                          : null,
                });
              } catch (insErr) {
                // Ignore duplicate constraint 23505 cleanly
                debugPrint(
                    '[SessionService] customer_favorites insert notice: $insErr');
              }
            } else if (isAdding == false) {
              await supabase
                  .from('customer_favorites')
                  .delete()
                  .eq('user_id', userId)
                  .eq('tenant_id', toggledStoreId);
            }
          } else {
            final existingRows = await supabase
                .from('customer_favorites')
                .select('tenant_id')
                .eq('user_id', userId);
            final existingIds = <String>{
              for (final r in existingRows)
                if (r['tenant_id'] != null)
                  r['tenant_id'].toString().trim().toLowerCase()
            };
            for (final id in favList) {
              final clean = id.trim();
              if (uuidRegex.hasMatch(clean) &&
                  !existingIds.contains(clean.toLowerCase())) {
                try {
                  await supabase.from('customer_favorites').insert({
                    'user_id': userId,
                    'tenant_id': clean,
                  });
                } catch (_) {}
              }
            }
          }
        } catch (e) {
          debugPrint('[SessionService] customer_favorites sync notice: $e');
        }
      }

      // 2. Read-merge-upsert customer_carts.metadata (preservando saved_addresses)
      Future<void> syncCartMetadata() async {
        try {
          final existingCart = await supabase
              .from('customer_carts')
              .select('metadata, user_email')
              .eq('user_id', userId)
              .maybeSingle();

          final existingMeta =
              (existingCart != null && existingCart['metadata'] is Map)
                  ? Map<String, dynamic>.from(existingCart['metadata'] as Map)
                  : <String, dynamic>{};

          existingMeta['favorite_store_ids'] = favList;

          await supabase.from('customer_carts').upsert(
            {
              'user_id': userId,
              'user_email': _currentUser?.email.isNotEmpty == true
                  ? _currentUser!.email
                  : authUser?.email,
              'metadata': existingMeta,
              'updated_at': DateTime.now().toUtc().toIso8601String(),
            },
            onConflict: 'user_id',
          );
        } catch (e) {
          debugPrint(
              '[SessionService] customer_carts favorites upsert notice: $e');
        }
      }

      // 3. Supabase Auth user_metadata
      Future<void> syncAuthMeta() async {
        if (authUser == null) return;
        try {
          await supabase.auth.updateUser(
            UserAttributes(data: {'favorite_store_ids': favList}),
          );
        } catch (_) {}
      }

      // 4. Backend endpoint (uses service_role)
      Future<void> syncBackendFavorites() async {
        for (final base in _backendCandidateUrls) {
          try {
            final res = await http
                .put(
                  Uri.parse('$base/users/$userId/favorites'),
                  headers: {'Content-Type': 'application/json'},
                  body: jsonEncode({
                    'favorites': favList,
                    'email': _currentUser?.email ?? authUser?.email,
                  }),
                )
                .timeout(const Duration(seconds: 8));
            if (res.statusCode >= 200 && res.statusCode < 300) {
              return;
            }
          } catch (_) {}
        }
      }

      await Future.wait([
        syncFavoritesTable(),
        syncCartMetadata(),
        syncAuthMeta(),
        syncBackendFavorites(),
      ]);
    } catch (e) {
      debugPrint('[SessionService] _pushFavoritesToCloud error: $e');
    }
  }

  Future<void> clearRoleChoice() async {
    _selectedRole = null;
    _rememberChoice = false;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keySelectedRole);
    await prefs.remove(_keyRememberChoice);
    notifyListeners();
  }

  Future<void> logout() async {
    try {
      await Supabase.instance.client.auth.signOut();
    } catch (_) {}
    _currentUser = null;
    _favoriteStoreIds.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyUserData);
    CartService().clearOrders();
    notifyListeners();
  }

  Future<({bool success, String message})> deleteAccount() async {
    try {
      final supabase = Supabase.instance.client;
      var session = supabase.auth.currentSession;
      if (session == null || session.isExpired) {
        try {
          final refreshed = await supabase.auth.refreshSession();
          session = refreshed.session ?? session;
        } catch (_) {}
      }

      final token = session?.accessToken ?? '';
      if (token.isEmpty) {
        return (
          success: false,
          message:
              'Tu sesión expiró. Vuelve a iniciar sesión o solicita la eliminación en pidetelo.app/legal/eliminar-cuenta',
        );
      }

      for (final base in _backendCandidateUrls) {
        try {
          final res = await http
              .post(
                Uri.parse('$base/auth/delete-account'),
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': 'Bearer $token',
                },
                body: jsonEncode({}),
              )
              .timeout(const Duration(seconds: 15));

          Map<String, dynamic> decoded = {};
          try {
            final parsed = jsonDecode(res.body);
            if (parsed is Map) decoded = Map<String, dynamic>.from(parsed);
          } catch (_) {}

          if (res.statusCode >= 200 && res.statusCode < 300) {
            final prefs = await SharedPreferences.getInstance();
            final user = _currentUser;
            final emailOrId = (user != null && user.email.isNotEmpty) ? user.email : user?.id;
            final favKey = _getFavoritesKey(emailOrId);

            final rawId = user?.id.trim() ?? '';
            final rawEmail = user?.email.trim() ?? '';
            final userKey = rawId.isNotEmpty
                ? rawId.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_')
                : (rawEmail.isNotEmpty
                    ? rawEmail.replaceAll(RegExp(r'[^a-zA-Z0-9_]'), '_')
                    : 'guest');

            final sanCart = (emailOrId ?? '').trim().toLowerCase().replaceAll(RegExp(r'[^a-z0-9_]'), '_');

            await Future.wait([
              prefs.remove(_keyUserData),
              prefs.remove(favKey),
              prefs.remove('wallet_balance_$userKey'),
              prefs.remove('wallet_tx_$userKey'),
              prefs.remove('notif_orders_$userKey'),
              prefs.remove('notif_rider_near_$userKey'),
              prefs.remove('notif_promos_$userKey'),
              prefs.remove('notif_whatsapp_$userKey'),
              if (sanCart.isNotEmpty) prefs.remove('user_orders_$sanCart'),
              if (sanCart.isNotEmpty) prefs.remove('user_addresses_$sanCart'),
              prefs.remove('global_saved_delivery_addresses'),
              prefs.remove('global_selected_delivery_address'),
            ]);

            CartService().clearCart();
            await logout();

            final msg = decoded['message']?.toString().trim();
            return (
              success: true,
              message: (msg != null && msg.isNotEmpty)
                  ? msg
                  : 'Cuenta eliminada permanentemente.',
            );
          }

          if (res.statusCode >= 400 && res.statusCode < 500) {
            final errMsg = decoded['message'];
            final readable = errMsg is List
                ? errMsg.join(', ')
                : (errMsg?.toString() ?? 'No se pudo eliminar la cuenta (código ${res.statusCode}).');
            return (success: false, message: readable);
          }
        } catch (e) {
          debugPrint('[SessionService] deleteAccount attempt failed for $base: $e');
        }
      }

      return (
        success: false,
        message:
            'No pudimos conectar con el servidor. Verifica tu conexión o solicita el borrado en pidetelo.app/legal/eliminar-cuenta',
      );
    } catch (e) {
      return (
        success: false,
        message: 'Ocurrió un error inesperado al eliminar la cuenta: $e',
      );
    }
  }
}
