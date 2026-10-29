import 'package:flutter/material.dart';
import 'package:google_fonts/google_fonts.dart';

class AppTheme {
  // Brand Colors for Repartidor
  static const Color primary = Color(0xFF10B981); // Emerald Green
  static const Color primaryDark = Color(0xFF059669);
  static const Color primaryLight = Color(0xFFA7F3D0);

  // Status & Role Accents
  static const Color accent = Color(0xFF06B6D4); // Cyan
  static const Color amberAccent = Color(0xFFF59E0B);
  static const Color blueAccent = Color(0xFF3B82F6);
  static const Color roseAccent = Color(0xFFF43F5E);
  static const Color orangeAccent = Color(0xFFEA580C);

  // Backgrounds & Neutrals
  static const Color darkBackground = Color(0xFF0B132B); // Deep Navy Slate
  static const Color darkSurface = Color(0xFF1C2541); // Slate 800
  static const Color darkCard = Color(0xFF1C2541);
  static const Color darkBorder = Color(0xFF3A506B);

  static const Color lightBackground = Color(0xFFF8FAFC);
  static const Color lightSurface = Colors.white;
  static const Color lightBorder = Color(0xFFE2E8F0);

  // Dark Theme (default and optimal for drivers)
  static ThemeData get darkTheme {
    final textTheme = GoogleFonts.outfitTextTheme(ThemeData.dark().textTheme);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.dark,
      scaffoldBackgroundColor: darkBackground,
      colorScheme: const ColorScheme.dark(
        primary: primary,
        secondary: accent,
        surface: darkSurface,
        onSurface: Colors.white,
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: darkBackground,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: Colors.white,
        ),
        iconTheme: const IconThemeData(color: Colors.white),
      ),
      cardTheme: CardTheme(
        color: darkCard,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: darkBorder, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: GoogleFonts.outfit(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
      inputDecorationTheme: InputDecorationTheme(
        filled: true,
        fillColor: const Color(0xFF0F172A),
        contentPadding: const EdgeInsets.symmetric(horizontal: 16, vertical: 14),
        border: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: darkBorder),
        ),
        enabledBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: darkBorder),
        ),
        focusedBorder: OutlineInputBorder(
          borderRadius: BorderRadius.circular(14),
          borderSide: const BorderSide(color: primary, width: 1.5),
        ),
        hintStyle: GoogleFonts.outfit(
          color: const Color(0xFF94A3B8),
          fontSize: 14,
        ),
      ),
    );
  }

  // Light Theme
  static ThemeData get lightTheme {
    final textTheme = GoogleFonts.outfitTextTheme(ThemeData.light().textTheme);

    return ThemeData(
      useMaterial3: true,
      brightness: Brightness.light,
      scaffoldBackgroundColor: lightBackground,
      colorScheme: const ColorScheme.light(
        primary: primary,
        secondary: accent,
        surface: lightSurface,
        onSurface: Color(0xFF0F172A),
      ),
      textTheme: textTheme,
      appBarTheme: AppBarTheme(
        backgroundColor: lightSurface,
        elevation: 0,
        centerTitle: true,
        titleTextStyle: GoogleFonts.outfit(
          fontSize: 18,
          fontWeight: FontWeight.w700,
          color: const Color(0xFF0F172A),
        ),
        iconTheme: const IconThemeData(color: Color(0xFF0F172A)),
      ),
      cardTheme: CardTheme(
        color: lightSurface,
        elevation: 0,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(16),
          side: const BorderSide(color: lightBorder, width: 1),
        ),
      ),
      elevatedButtonTheme: ElevatedButtonThemeData(
        style: ElevatedButton.styleFrom(
          backgroundColor: primary,
          foregroundColor: Colors.white,
          elevation: 0,
          padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 14),
          shape: RoundedRectangleBorder(
            borderRadius: BorderRadius.circular(14),
          ),
          textStyle: GoogleFonts.outfit(
            fontSize: 15,
            fontWeight: FontWeight.w700,
          ),
        ),
      ),
    );
  }
}
