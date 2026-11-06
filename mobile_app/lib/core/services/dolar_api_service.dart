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

  double _officialRate = 896.12; // default realistic fallback
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

  double toBs(double usd, {double? customRate}) {
    final rate = (customRate != null && customRate > 0) ? customRate : _officialRate;
    return usd * rate;
  }

  String formatPrice(
    double amount, {
    double? customRate,
    String displayMode = 'usd_and_bs',
    String itemCurrency = 'USD',
  }) {
    final rate = (customRate != null && customRate > 0) ? customRate : _officialRate;
    double usd = 0;
    double bs = 0;

    if (itemCurrency == 'USD') {
      usd = amount;
      bs = amount * rate;
    } else {
      bs = amount;
      usd = rate > 0 ? amount / rate : 0;
    }

    final usdStr = '\$${usd.toStringAsFixed(2)}';
    final bsStr = 'Bs. ${bs.toStringAsFixed(2)}';

    switch (displayMode) {
      case 'usd_and_bs':
        return '$usdStr ($bsStr)';
      case 'bs_and_usd':
        return '$bsStr ($usdStr)';
      case 'only_usd':
        return usdStr;
      case 'only_bs':
        return bsStr;
      default:
        return '$usdStr ($bsStr)';
    }
  }

  String formatUsdWithBs(double usd, {double? customRate}) {
    return formatPrice(usd, customRate: customRate, displayMode: 'usd_and_bs', itemCurrency: 'USD');
  }
}
