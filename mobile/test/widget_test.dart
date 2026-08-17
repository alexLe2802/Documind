import 'package:documind_mobile/features/auth/login_screen.dart';
import 'package:documind_mobile/features/documents/documents_screen.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

void main() {
  testWidgets('shows the DocuMind sign-in form', (tester) async {
    await tester.pumpWidget(
      const ProviderScope(child: MaterialApp(home: LoginScreen())),
    );
    expect(find.text('DocuMind'), findsOneWidget);
    expect(find.text('Đăng nhập'), findsOneWidget);
    expect(find.byType(TextField), findsNWidgets(2));
    expect(find.byType(GoogleLogo), findsOneWidget);
  });

  test('AI sources combine owned and saved community documents once', () {
    final result = mergeAiSourceDocuments(
      [
        {'id': 'owned', 'title': 'Owned'},
        {'id': 'same', 'title': 'Owned version'},
      ],
      [
        {'id': 'saved', 'title': 'Saved'},
        {'id': 'same', 'title': 'Saved version'},
      ],
    );

    expect(result.map((item) => item['id']), ['owned', 'same', 'saved']);
    expect(result[1]['isCommunitySaved'], isTrue);
    expect(result[2]['isCommunitySaved'], isTrue);
  });
}
