import 'dart:convert';
import 'package:flutter/foundation.dart';
import 'package:http/http.dart' as http;
import 'package:shared_preferences/shared_preferences.dart';

class DolarApiService extends ChangeNotifier {
  static final DolarApiService _instance = DolarApiService._internal();
  factory DolarApiService() => _instance;
  DolarApiService._internal();

  static const String _cacheKeyRate = 'dolar_bcv_rate';
  static const String _cacheKeyDate = 'dolar_bcv_date';

  double _officialRate = 36.50; // default fallback
  DateTime? _lastUpdated;
  bool _isLoading = false;

  double get officialRate => _officialRate;
  DateTime? get lastUpdated => _lastUpdated;
  bool get isLoading => _isLoading;

  Future<void> init() async {
    try {
      final prefs = await SharedPreferences.getInstance();
      final cached = prefs.getDouble(_cacheKeyRate);
      if (cached != null && cached > 0) {
        _officialRate = cached;
      }
      final dateStr = prefs.getString(_cacheKeyDate);
      if (dateStr != null) {
        _lastUpdated = DateTime.tryParse(dateStr);
      }
    } catch (_) {}

    // Fetch live rate in background
    fetchRate();
  }

  Future<double> fetchRate() async {
    _isLoading = true;
    notifyListeners();

    try {
      final url = Uri.parse('https://ve.dolarapi.com/v1/dolares/oficial');
      final res = await http.get(url).timeout(const Duration(seconds: 5));
      if (res.statusCode == 200) {
        final data = json.decode(res.body);
        final rate = (data['promedio'] as num?)?.toDouble() ??
            (data['venta'] as num?)?.toDouble() ??
            _officialRate;

        if (rate > 0) {
          _officialRate = rate;
          _lastUpdated = DateTime.tryParse(data['fechaActualizacion'] ?? '') ?? DateTime.now();

          final prefs = await SharedPreferences.getInstance();
          await prefs.setDouble(_cacheKeyRate, _officialRate);
          await prefs.setString(_cacheKeyDate, _lastUpdated!.toIso8601String());
        }
      }
    } catch (e) {
      debugPrint('[DolarApiService] Error consultando dolarapi: $e');
    } finally {
      _isLoading = false;
      notifyListeners();
    }
    return _officialRate;
  }

  double toBs(double usd) => usd * _officialRate;

  String formatUsdWithBs(double usd) {
    final bs = toBs(usd);
    return '\$${usd.toStringAsFixed(2)} (Bs. ${bs.toStringAsFixed(2)})';
  }
}
