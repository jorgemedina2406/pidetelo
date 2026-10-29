import 'package:flutter_test/flutter_test.dart';
import 'package:mobile_app/core/services/session_service.dart';
import 'package:mobile_app/main.dart';

void main() {
  testWidgets('App renders RoleSelectionScreen initially', (WidgetTester tester) async {
    final sessionService = SessionService();
    await tester.pumpWidget(DeliveryApp(sessionService: sessionService));

    expect(find.text('¿Cómo deseas ingresar hoy?'), findsOneWidget);
    expect(find.text('Soy Repartidor'), findsOneWidget);
    expect(find.text('Soy Usuario / Cliente'), findsOneWidget);
  });
}
