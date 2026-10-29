import 'dart:convert';
import 'package:flutter/foundation.dart';
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

  AppUserRole? _selectedRole;
  AppUser? _currentUser;
  bool _rememberChoice = false;
  bool _isInitialized = false;
  final Set<String> _favoriteStoreIds = {};

  AppUserRole? get selectedRole => _selectedRole;
  AppUser? get currentUser => _currentUser;
  bool get rememberChoice => _rememberChoice;
  bool get isInitialized => _isInitialized;
  bool get isAuthenticated => _currentUser != null;
  Set<String> get favoriteStoreIds => Set.unmodifiable(_favoriteStoreIds);

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

    final userJson = prefs.getString(_keyUserData);
    if (userJson != null) {
      try {
        _currentUser = AppUser.fromJson(jsonDecode(userJson));
      } catch (e) {
        debugPrint('[SessionService] Error decodificando usuario: $e');
      }
    }

    // Load favorites specifically for current user
    _favoriteStoreIds.clear();
    if (_currentUser != null) {
      final favKey = _getFavoritesKey(_currentUser!.email.isNotEmpty ? _currentUser!.email : _currentUser!.id);
      final favs = prefs.getStringList(favKey);
      if (favs != null) {
        _favoriteStoreIds.addAll(favs);
      }
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

  bool isFavorite(String storeId) {
    return _favoriteStoreIds.contains(storeId);
  }

  Future<void> toggleFavorite(String storeId) async {
    if (_favoriteStoreIds.contains(storeId)) {
      _favoriteStoreIds.remove(storeId);
    } else {
      _favoriteStoreIds.add(storeId);
    }
    final prefs = await SharedPreferences.getInstance();
    final favKey = _getFavoritesKey(_currentUser?.email ?? _currentUser?.id);
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
