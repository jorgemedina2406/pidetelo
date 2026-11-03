import 'dart:async';
import 'dart:convert';
import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:http/http.dart' as http;
import 'package:latlong2/latlong.dart' as ll;
import 'package:google_fonts/google_fonts.dart';
import '../../../core/models/order_model.dart';
import '../../../core/theme/app_theme.dart';

class AddressSuggestion {
  final String title;
  final String subtitle;
  final double latitude;
  final double longitude;

  const AddressSuggestion({
    required this.title,
    required this.subtitle,
    required this.latitude,
    required this.longitude,
  });
}

class MapAddressPickerScreen extends StatefulWidget {
  final DeliveryAddress? initialAddress;

  const MapAddressPickerScreen({super.key, this.initialAddress});

  @override
  State<MapAddressPickerScreen> createState() => _MapAddressPickerScreenState();
}

class _MapAddressPickerScreenState extends State<MapAddressPickerScreen> {
  final MapController _mapController = MapController();
  late ll.LatLng _selectedLocation;
  late TextEditingController _titleCtrl;
  late TextEditingController _addressCtrl;
  late TextEditingController _referenceCtrl;
  late TextEditingController _instructionsCtrl;

  String _selectedCategory = 'Casa';
  final List<String> _categoryPresets = ['Casa', 'Trabajo', 'Pareja', 'Padres', 'Otro'];

  List<AddressSuggestion> _filteredSuggestions = [];
  bool _isSearching = false;
  Timer? _debounceTimer;

  static const List<AddressSuggestion> _presetSuggestions = [
    AddressSuggestion(
      title: 'El Placer',
      subtitle: 'Cabudare, Parroquia José Gregorio Bastidas',
      latitude: 10.034574,
      longitude: -69.237544,
    ),
    AddressSuggestion(
      title: 'Sector La Mata',
      subtitle: 'Av. Intercomunal Barquisimeto-Cabudare',
      latitude: 10.026743,
      longitude: -69.257153,
    ),
    AddressSuggestion(
      title: 'Urb. Valle Hondo',
      subtitle: 'Cabudare, Palavecino, Edo. Lara',
      latitude: 10.038100,
      longitude: -69.250000,
    ),
    AddressSuggestion(
      title: 'Casco Central de Cabudare',
      subtitle: 'Plaza Bolívar, Alcaldía de Palavecino',
      latitude: 10.030500,
      longitude: -69.261200,
    ),
    AddressSuggestion(
      title: 'Urb. Las Mercedes',
      subtitle: 'Cabudare, Palavecino',
      latitude: 10.028900,
      longitude: -69.263500,
    ),
    AddressSuggestion(
      title: 'Urb. La Hacienda',
      subtitle: 'Av. La Montañita, Cabudare',
      latitude: 10.031200,
      longitude: -69.245000,
    ),
    AddressSuggestion(
      title: 'Urb. Chucho Briceño',
      subtitle: 'Cabudare, Edo. Lara',
      latitude: 10.033400,
      longitude: -69.248200,
    ),
    AddressSuggestion(
      title: 'Tarabana',
      subtitle: 'Sector Agua Viva / Tarabana, Cabudare',
      latitude: 10.019500,
      longitude: -69.265000,
    ),
    AddressSuggestion(
      title: 'Los Rastrojos',
      subtitle: 'Sector Histórico Los Rastrojos, Cabudare',
      latitude: 10.024000,
      longitude: -69.269000,
    ),
    AddressSuggestion(
      title: 'Agua Viva',
      subtitle: 'Sector Agua Viva, cerca del Parque Terepaima',
      latitude: 10.015000,
      longitude: -69.275000,
    ),
    AddressSuggestion(
      title: 'Av. Intercomunal Barquisimeto-Cabudare',
      subtitle: 'Corredor vial principal Cabudare',
      latitude: 10.035000,
      longitude: -69.258000,
    ),
    AddressSuggestion(
      title: 'Redoma de Santa Rosa',
      subtitle: 'Pueblo de Santa Rosa / Monumento Divina Pastora',
      latitude: 10.055000,
      longitude: -69.280000,
    ),
    AddressSuggestion(
      title: 'Av. Los Leones',
      subtitle: 'Sector Este, Barquisimeto',
      latitude: 10.071200,
      longitude: -69.294100,
    ),
    AddressSuggestion(
      title: 'Av. Lara',
      subtitle: 'Barquisimeto Este / Nueva Segovia',
      latitude: 10.065000,
      longitude: -69.288000,
    ),
    AddressSuggestion(
      title: 'Centro Comercial Sambil Barquisimeto',
      subtitle: 'Av. Venezuela con Av. Bracamonte',
      latitude: 10.068000,
      longitude: -69.285000,
    ),
    AddressSuggestion(
      title: 'C.C. Las Trinitarias',
      subtitle: 'Av. Los Leones, Barquisimeto',
      latitude: 10.075000,
      longitude: -69.291000,
    ),
  ];

  // Quick preset pills
  final List<Map<String, dynamic>> _quickLocations = [
    {
      'name': 'El Placer',
      'lat': 10.034574,
      'lng': -69.237544,
      'address': 'El Placer, Cabudare',
    },
    {
      'name': 'La Mata',
      'lat': 10.026743,
      'lng': -69.257153,
      'address': 'Av. Intercomunal, Sector La Mata',
    },
    {
      'name': 'Valle Hondo',
      'lat': 10.038100,
      'lng': -69.250000,
      'address': 'Urb. Valle Hondo, Cabudare',
    },
    {
      'name': 'Centro Cabudare',
      'lat': 10.030500,
      'lng': -69.261200,
      'address': 'Casco Central de Cabudare, Plaza Bolívar',
    },
    {
      'name': 'Barquisimeto Este',
      'lat': 10.071200,
      'lng': -69.294100,
      'address': 'Av. Los Leones, Barquisimeto',
    },
  ];

  @override
  void initState() {
    super.initState();
    final init = widget.initialAddress;
    _selectedLocation = init != null
        ? ll.LatLng(init.latitude, init.longitude)
        : const ll.LatLng(10.034574, -69.237544); // Default El Placer

    _titleCtrl = TextEditingController(text: init?.title ?? 'Casa');
    _addressCtrl = TextEditingController(text: init?.address ?? 'El Placer, Cabudare');
    _referenceCtrl = TextEditingController(text: init?.reference ?? '');
    _instructionsCtrl = TextEditingController(text: init?.instructions ?? '');
  }

  @override
  void dispose() {
    _debounceTimer?.cancel();
    _titleCtrl.dispose();
    _addressCtrl.dispose();
    _referenceCtrl.dispose();
    _instructionsCtrl.dispose();
    super.dispose();
  }

  void _onAddressInputChanged(String query) {
    _debounceTimer?.cancel();
    final clean = query.trim();
    if (clean.length < 2) {
      setState(() {
        _filteredSuggestions = [];
        _isSearching = false;
      });
      return;
    }

    final q = clean.toLowerCase();
    // 1. Instant local match
    final localMatches = _presetSuggestions.where((s) {
      return s.title.toLowerCase().contains(q) || s.subtitle.toLowerCase().contains(q);
    }).toList();

    setState(() {
      _filteredSuggestions = localMatches;
      _isSearching = true;
    });

    // 2. Debounced online Nominatim OpenStreetMap search
    _debounceTimer = Timer(const Duration(milliseconds: 400), () async {
      try {
        final encoded = Uri.encodeComponent(clean);
        final url = Uri.parse(
          'https://nominatim.openstreetmap.org/search?q=$encoded&format=json&limit=8&countrycodes=ve',
        );
        final res = await http.get(url, headers: {
          'User-Agent': 'PideteloDeliveryApp/1.0',
        }).timeout(const Duration(seconds: 4));

        if (res.statusCode == 200 && mounted) {
          final List list = json.decode(res.body);
          final online = list.map((item) {
            final displayName = item['display_name']?.toString() ?? '';
            final parts = displayName.split(',');
            final title = parts.isNotEmpty ? parts.first.trim() : displayName;
            final subtitle = parts.length > 1 ? parts.sublist(1).take(3).join(', ').trim() : 'Venezuela';
            return AddressSuggestion(
              title: title,
              subtitle: subtitle,
              latitude: double.tryParse(item['lat']?.toString() ?? '') ?? _selectedLocation.latitude,
              longitude: double.tryParse(item['lon']?.toString() ?? '') ?? _selectedLocation.longitude,
            );
          }).toList();

          if (mounted) {
            final all = [...localMatches];
            for (final o in online) {
              final duplicate = all.any((a) =>
                  (a.latitude - o.latitude).abs() < 0.002 &&
                  (a.longitude - o.longitude).abs() < 0.002);
              if (!duplicate) all.add(o);
            }
            setState(() {
              _filteredSuggestions = all;
              _isSearching = false;
            });
          }
        }
      } catch (_) {
        if (mounted) setState(() => _isSearching = false);
      }
    });
  }

  void _selectSuggestion(AddressSuggestion suggestion) {
    FocusScope.of(context).unfocus();
    final newLoc = ll.LatLng(suggestion.latitude, suggestion.longitude);
    setState(() {
      _selectedLocation = newLoc;
      _addressCtrl.text = '${suggestion.title}, ${suggestion.subtitle}';
      _filteredSuggestions = [];
      _isSearching = false;
    });
    _mapController.move(newLoc, 16.5);
  }

  void _moveToLocation(double lat, double lng, String addressText) {
    final newLoc = ll.LatLng(lat, lng);
    setState(() {
      _selectedLocation = newLoc;
      _addressCtrl.text = addressText;
      _filteredSuggestions = [];
    });
    _mapController.move(newLoc, 16.0);
  }

  void _saveAddress() {
    final title = _titleCtrl.text.trim().isEmpty ? _selectedCategory : _titleCtrl.text.trim();
    final addressText = _addressCtrl.text.trim().isEmpty ? 'Ubicación seleccionada en mapa' : _addressCtrl.text.trim();

    final result = DeliveryAddress(
      id: widget.initialAddress?.id ?? 'addr_${DateTime.now().millisecondsSinceEpoch}',
      title: title,
      address: addressText,
      reference: _referenceCtrl.text.trim().isNotEmpty ? _referenceCtrl.text.trim() : null,
      latitude: _selectedLocation.latitude,
      longitude: _selectedLocation.longitude,
      instructions: _instructionsCtrl.text.trim().isNotEmpty ? _instructionsCtrl.text.trim() : null,
    );

    Navigator.pop(context, result);
  }

  @override
  Widget build(BuildContext context) {
    final viewInsets = MediaQuery.of(context).viewInsets;
    final isKeyboardOpen = viewInsets.bottom > 50;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Scaffold(
      resizeToAvoidBottomInset: false,
      backgroundColor: isDark ? const Color(0xFF0F172A) : const Color(0xFFF8FAFC),
      appBar: AppBar(
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded, color: isDark ? Colors.white : const Color(0xFF0F172A), size: 24),
          tooltip: 'Regresar',
          onPressed: () => Navigator.pop(context),
        ),
        title: Text(
          widget.initialAddress != null ? 'Modificar Dirección' : 'Fijar Dirección en el Mapa',
          style: GoogleFonts.outfit(fontSize: 17, fontWeight: FontWeight.w700, color: isDark ? Colors.white : const Color(0xFF0F172A)),
        ),
        backgroundColor: isDark ? const Color(0xFF0F172A) : Colors.white,
        foregroundColor: isDark ? Colors.white : const Color(0xFF0F172A),
        elevation: 0,
      ),
      body: Stack(
        children: [
          // 1. Interactive OpenStreetMap (Full screen background)
          Positioned.fill(
            child: FlutterMap(
              mapController: _mapController,
              options: MapOptions(
                initialCenter: _selectedLocation,
                initialZoom: 15.5,
                minZoom: 11.0,
                maxZoom: 18.5,
                onTap: (tapPosition, point) {
                  FocusScope.of(context).unfocus();
                  setState(() {
                    _selectedLocation = point;
                    _filteredSuggestions = [];
                  });
                },
              ),
              children: [
                TileLayer(
                  urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                  userAgentPackageName: 'com.deliveryhub.mobile_app',
                  maxZoom: 19,
                ),
                MarkerLayer(
                  markers: [
                    Marker(
                      point: _selectedLocation,
                      width: 90,
                      height: 90,
                      child: Column(
                        children: [
                          Container(
                            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                            decoration: BoxDecoration(
                              color: Colors.black87,
                              borderRadius: BorderRadius.circular(8),
                              boxShadow: const [BoxShadow(color: Colors.black38, blurRadius: 4)],
                            ),
                            child: Text(
                              'Tu Entrega',
                              style: GoogleFonts.outfit(
                                fontSize: 10,
                                fontWeight: FontWeight.w800,
                                color: AppTheme.amberAccent,
                              ),
                            ),
                          ),
                          const SizedBox(height: 2),
                          const Icon(
                            Icons.location_on_rounded,
                            size: 42,
                            color: AppTheme.primary,
                          ),
                        ],
                      ),
                    ),
                  ],
                ),
              ],
            ),
          ),

          // 2. Top Header Controls: Quick Pills + Address Search Bar (Google Maps style)
          Positioned(
            top: 10,
            left: 14,
            right: 14,
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                // Quick preset pills
                SingleChildScrollView(
                  scrollDirection: Axis.horizontal,
                  child: Row(
                    children: _quickLocations.map((loc) {
                      return Container(
                        margin: const EdgeInsets.only(right: 8),
                        child: ElevatedButton.icon(
                          onPressed: () {
                            FocusScope.of(context).unfocus();
                            _moveToLocation(loc['lat'], loc['lng'], loc['address']);
                          },
                          icon: const Icon(Icons.near_me_rounded, size: 13, color: AppTheme.primary),
                          label: Text(
                            loc['name'],
                            style: GoogleFonts.outfit(fontSize: 11.5, fontWeight: FontWeight.w700),
                          ),
                          style: ElevatedButton.styleFrom(
                            backgroundColor: const Color(0xFF0F172A).withValues(alpha: 0.92),
                            foregroundColor: Colors.white,
                            elevation: 4,
                            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
                            shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
                          ),
                        ),
                      );
                    }).toList(),
                  ),
                ),
                const SizedBox(height: 8),

                // Floating Top Search Input
                Container(
                  decoration: BoxDecoration(
                    color: const Color(0xFF1E293B),
                    borderRadius: BorderRadius.circular(14),
                    boxShadow: const [
                      BoxShadow(color: Colors.black45, blurRadius: 10, offset: Offset(0, 4)),
                    ],
                    border: Border.all(color: AppTheme.primary, width: 1.5),
                  ),
                  child: Theme(
                    data: ThemeData.dark().copyWith(
                      colorScheme: const ColorScheme.dark(primary: AppTheme.primary),
                    ),
                    child: TextField(
                      controller: _addressCtrl,
                      onChanged: _onAddressInputChanged,
                      onSubmitted: (val) {
                        if (_filteredSuggestions.isNotEmpty) {
                          _selectSuggestion(_filteredSuggestions.first);
                        }
                        FocusScope.of(context).unfocus();
                      },
                      cursorColor: AppTheme.primary,
                      style: GoogleFonts.outfit(
                        color: Colors.white,
                        fontSize: 14,
                        fontWeight: FontWeight.w600,
                      ),
                      decoration: InputDecoration(
                        filled: true,
                        fillColor: const Color(0xFF1E293B),
                        hintText: 'Buscar calle, urbanización, lugar...',
                        hintStyle: GoogleFonts.outfit(
                          color: const Color(0xFF94A3B8),
                          fontSize: 13,
                        ),
                        prefixIcon: const Icon(Icons.search_rounded, color: AppTheme.primary, size: 22),
                        suffixIcon: _addressCtrl.text.isNotEmpty
                            ? IconButton(
                                icon: const Icon(Icons.close_rounded, size: 18, color: Colors.white70),
                                onPressed: () {
                                  _addressCtrl.clear();
                                  setState(() => _filteredSuggestions = []);
                                },
                              )
                            : null,
                        border: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        enabledBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: BorderSide.none,
                        ),
                        focusedBorder: OutlineInputBorder(
                          borderRadius: BorderRadius.circular(14),
                          borderSide: const BorderSide(color: AppTheme.primary, width: 1.5),
                        ),
                        contentPadding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
                      ),
                    ),
                  ),
                ),

                // 3. Autocomplete Suggestions Dropdown
                if (_filteredSuggestions.isNotEmpty)
                  Container(
                    margin: const EdgeInsets.only(top: 4),
                    constraints: const BoxConstraints(maxHeight: 220),
                    decoration: BoxDecoration(
                      color: const Color(0xFF0F172A),
                      borderRadius: BorderRadius.circular(14),
                      border: Border.all(color: Colors.white12),
                      boxShadow: const [
                        BoxShadow(color: Colors.black54, blurRadius: 12, offset: Offset(0, 6)),
                      ],
                    ),
                    child: ListView.separated(
                      shrinkWrap: true,
                      padding: const EdgeInsets.symmetric(vertical: 4),
                      itemCount: _filteredSuggestions.length,
                      separatorBuilder: (_, __) => const Divider(height: 1, color: Colors.white10),
                      itemBuilder: (ctx, i) {
                        final item = _filteredSuggestions[i];
                        return ListTile(
                          dense: true,
                          visualDensity: VisualDensity.compact,
                          leading: const Icon(Icons.place_rounded, size: 18, color: AppTheme.primary),
                          title: Text(
                            item.title,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(
                              fontSize: 13,
                              fontWeight: FontWeight.w700,
                              color: Colors.white,
                            ),
                          ),
                          subtitle: Text(
                            item.subtitle,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: GoogleFonts.outfit(
                              fontSize: 11,
                              color: const Color(0xFF94A3B8),
                            ),
                          ),
                          trailing: const Icon(Icons.north_west_rounded, size: 14, color: Colors.white54),
                          onTap: () {
                            FocusScope.of(context).unfocus();
                            _selectSuggestion(item);
                          },
                        );
                      },
                    ),
                  ),
              ],
            ),
          ),

          // 4. Floating GPS Coordinates Chip (bottom right of map)
          Positioned(
            right: 14,
            bottom: isKeyboardOpen ? 180 : 230,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
              decoration: BoxDecoration(
                color: const Color(0xFF0F172A).withValues(alpha: 0.85),
                borderRadius: BorderRadius.circular(10),
                border: Border.all(color: Colors.white12),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  const Icon(Icons.gps_fixed_rounded, size: 12, color: AppTheme.primary),
                  const SizedBox(width: 5),
                  Text(
                    '${_selectedLocation.latitude.toStringAsFixed(5)}, ${_selectedLocation.longitude.toStringAsFixed(5)}',
                    style: GoogleFonts.outfit(fontSize: 11, fontWeight: FontWeight.w700, color: Colors.white),
                  ),
                ],
              ),
            ),
          ),

          // 5. Bottom Form Card for details (Only visible when user is not actively searching)
          if (_filteredSuggestions.isEmpty && !isKeyboardOpen)
            Positioned(
              left: 0,
              right: 0,
              bottom: 0,
              child: Container(
                padding: const EdgeInsets.fromLTRB(16, 12, 16, 16),
                decoration: const BoxDecoration(
                  color: Color(0xFF0F172A),
                  borderRadius: BorderRadius.vertical(top: Radius.circular(22)),
                  boxShadow: [
                    BoxShadow(color: Colors.black54, blurRadius: 16, offset: Offset(0, -4)),
                  ],
                ),
                child: SingleChildScrollView(
                  physics: const ClampingScrollPhysics(),
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.stretch,
                    children: [
                      // Category chips (Horizontal Scrollable)
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        physics: const BouncingScrollPhysics(),
                        child: Row(
                          children: _categoryPresets.map((cat) {
                            final isSel = _selectedCategory == cat;
                            return Padding(
                              padding: const EdgeInsets.only(right: 8),
                              child: ChoiceChip(
                                label: Text(
                                  cat,
                                  style: GoogleFonts.outfit(
                                    fontSize: 12,
                                    fontWeight: isSel ? FontWeight.w800 : FontWeight.w600,
                                  ),
                                ),
                                selected: isSel,
                                selectedColor: AppTheme.primary,
                                backgroundColor: const Color(0xFF1E293B),
                                labelStyle: TextStyle(color: isSel ? Colors.white : const Color(0xFF94A3B8)),
                                onSelected: (val) {
                                  if (val) {
                                    setState(() {
                                      _selectedCategory = cat;
                                      _titleCtrl.text = cat;
                                    });
                                  }
                                },
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    const SizedBox(height: 8),

                    // Reference & Instructions
                    Row(
                      children: [
                        Expanded(
                          child: TextField(
                            controller: _referenceCtrl,
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                            decoration: InputDecoration(
                              labelText: 'Punto de referencia',
                              labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                              filled: true,
                              fillColor: const Color(0xFF1E293B),
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: BorderSide.none,
                              ),
                              prefixIcon: const Icon(Icons.place_outlined, color: Color(0xFF94A3B8), size: 16),
                            ),
                          ),
                        ),
                        const SizedBox(width: 8),
                        Expanded(
                          child: TextField(
                            controller: _instructionsCtrl,
                            style: const TextStyle(color: Colors.white, fontSize: 12),
                            decoration: InputDecoration(
                              labelText: 'Indicaciones (ej: Timbrar)',
                              labelStyle: const TextStyle(color: Color(0xFF94A3B8), fontSize: 11),
                              filled: true,
                              fillColor: const Color(0xFF1E293B),
                              isDense: true,
                              contentPadding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
                              border: OutlineInputBorder(
                                borderRadius: BorderRadius.circular(10),
                                borderSide: BorderSide.none,
                              ),
                              prefixIcon: const Icon(Icons.info_outline_rounded, color: Color(0xFF94A3B8), size: 16),
                            ),
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: 10),

                    // Save Button
                    ElevatedButton.icon(
                      onPressed: _saveAddress,
                      icon: const Icon(Icons.check_circle_rounded, size: 18),
                      label: Text(
                        'Confirmar y Guardar Dirección',
                        style: GoogleFonts.outfit(fontSize: 14, fontWeight: FontWeight.w800),
                      ),
                      style: ElevatedButton.styleFrom(
                        backgroundColor: AppTheme.primary,
                        foregroundColor: Colors.white,
                        padding: const EdgeInsets.symmetric(vertical: 12),
                        shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(14)),
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ],
      ),
    );
  }
}
