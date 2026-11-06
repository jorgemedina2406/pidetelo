import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../models/user_model.dart';
import 'cart_service.dart';

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
    } else {
      CartService().clearOrders();
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

    notifyListeners();
  }

  Future<void> updateUserProfile(AppUser user) async {
    await saveUser(user);
  }

  bool isFavorite(String storeId, {String? slug}) {
    if (storeId.isEmpty && (slug == null || slug.isEmpty)) return false;
    return _favoriteStoreIds.contains(storeId) ||
        (slug != null && slug.isNotEmpty && _favoriteStoreIds.contains(slug));
  }

  Future<void> toggleFavorite(String storeId, {String? slug}) async {
    final keyToToggle = storeId.isNotEmpty ? storeId : (slug ?? '');
    if (keyToToggle.isEmpty) return;

    final wasFav = isFavorite(storeId, slug: slug);
    if (wasFav) {
      _favoriteStoreIds.remove(storeId);
      if (slug != null) _favoriteStoreIds.remove(slug);
    } else {
      _favoriteStoreIds.add(keyToToggle);
      if (slug != null && slug.isNotEmpty && slug != keyToToggle) {
        _favoriteStoreIds.add(slug);
      }
    }
    final prefs = await SharedPreferences.getInstance();
    final favKey = _getFavoritesKey(_currentUser?.email.isNotEmpty == true ? _currentUser!.email : _currentUser?.id);
    await prefs.setStringList(favKey, _favoriteStoreIds.toList());
    notifyListeners();
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
