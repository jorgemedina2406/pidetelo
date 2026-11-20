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

  AppUserRole? get selectedRole => _selectedRole;
  AppUser? get currentUser => _currentUser;
  bool get rememberChoice => _rememberChoice;
  bool get isInitialized => _isInitialized;
  bool get isAuthenticated => _currentUser != null;
  bool get isDarkMode => _isDarkMode;
  ThemeMode get themeMode => _isDarkMode ? ThemeMode.dark : ThemeMode.light;
  Set<String> get favoriteStoreIds => Set.unmodifiable(_favoriteStoreIds);

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
      // Also load orders specifically for this user
      await CartService().loadUserOrders(
        _currentUser!.email.isNotEmpty ? _currentUser!.email : _currentUser!.id,
        phone: _currentUser!.phone,
      );
      await syncFavoritesWithCloud();
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
    _currentUser = user;
    _selectedRole = user.role;
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString(_keyUserData, jsonEncode(user.toJson()));
    await prefs.setString(_keySelectedRole, user.role.name);

    // Switch favorites to this user
    _favoriteStoreIds.clear();
    final favKey = _getFavoritesKey(user.email.isNotEmpty ? user.email : user.id);
    final favs = prefs.getStringList(favKey);
    if (favs != null) {
      _favoriteStoreIds.addAll(favs);
    }

    // Switch orders specifically to this user
    await CartService().loadUserOrders(
      user.email.isNotEmpty ? user.email : user.id,
      phone: user.phone,
    );
    await syncFavoritesWithCloud();

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
    try {
      final supabase = Supabase.instance.client;
      final authUser = supabase.auth.currentUser;
      final userId = authUser?.id ?? _currentUser?.id;
      if (userId == null || userId.trim().isEmpty) return;

      final Set<String> cloudFavs = {};
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
      try {
        final res = await http
            .get(Uri.parse('${AppConfig.backendBaseUrl}/users/$userId/favorites'))
            .timeout(const Duration(seconds: 4));
        if (res.statusCode == 200) {
          final decoded = jsonDecode(res.body);
          if (decoded is Map) {
            collect(decoded['favorites']);
          }
        }
      } catch (_) {}

      if (cloudFavs.isNotEmpty) {
        _favoriteStoreIds.addAll(cloudFavs);
        final prefs = await SharedPreferences.getInstance();
        final favKey = _getFavoritesKey(_currentUser?.email.isNotEmpty == true ? _currentUser!.email : _currentUser?.id);
        await prefs.setStringList(favKey, _favoriteStoreIds.toList());
        notifyListeners();
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
      final uuidRegex = RegExp(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$');

      // 1. Direct normalized table upsert/delete (when table migrated & user authenticated)
      if (toggledStoreId != null && uuidRegex.hasMatch(toggledStoreId)) {
        try {
          if (isAdding == true) {
            await supabase.from('customer_favorites').upsert(
              {
                'user_id': userId,
                'tenant_id': toggledStoreId,
                'tenant_slug': (toggledSlug != null && toggledSlug.isNotEmpty) ? toggledSlug : null,
              },
              onConflict: 'user_id,tenant_id',
            );
          } else if (isAdding == false) {
            await supabase
                .from('customer_favorites')
                .delete()
                .eq('user_id', userId)
                .eq('tenant_id', toggledStoreId);
          }
        } catch (_) {}
      }

      // 2. Read-merge-upsert customer_carts.metadata (preserving saved_addresses & other keys)
      try {
        final existingCart = await supabase
            .from('customer_carts')
            .select('metadata, user_email')
            .eq('user_id', userId)
            .maybeSingle();

        final existingMeta = (existingCart != null && existingCart['metadata'] is Map)
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
            'updated_at': DateTime.now().toIso8601String(),
          },
          onConflict: 'user_id',
        );
      } catch (e) {
        debugPrint('[SessionService] customer_carts favorites upsert notice: $e');
      }

      // 3. Supabase Auth user_metadata
      if (authUser != null) {
        try {
          await supabase.auth.updateUser(
            UserAttributes(data: {'favorite_store_ids': favList}),
          );
        } catch (_) {}
      }

      // 4. Backend endpoint (uses service_role)
      try {
        await http
            .put(
              Uri.parse('${AppConfig.backendBaseUrl}/users/$userId/favorites'),
              headers: {'Content-Type': 'application/json'},
              body: jsonEncode({
                'favorites': favList,
                'email': _currentUser?.email ?? authUser?.email,
              }),
            )
            .timeout(const Duration(seconds: 5));
      } catch (_) {}
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
    _currentUser = null;
    _favoriteStoreIds.clear();
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove(_keyUserData);
    CartService().clearOrders();
    notifyListeners();
  }
}
