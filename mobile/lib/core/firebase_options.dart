import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';

abstract final class DocuMindFirebaseOptions {
  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _iosAppId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
  static const _androidAppId = String.fromEnvironment(
    'FIREBASE_ANDROID_APP_ID',
  );
  static const _messagingSenderId = String.fromEnvironment(
    'FIREBASE_MESSAGING_SENDER_ID',
  );
  static const _projectId = String.fromEnvironment('FIREBASE_PROJECT_ID');
  static const _storageBucket = String.fromEnvironment(
    'FIREBASE_STORAGE_BUCKET',
  );
  static const _iosBundleId = String.fromEnvironment(
    'FIREBASE_IOS_BUNDLE_ID',
    defaultValue: 'icu.documind.mobile',
  );

  static FirebaseOptions get currentPlatform {
    final appId = switch (defaultTargetPlatform) {
      // Keep existing builds usable while the Android app is being registered
      // in Firebase. A platform-specific ID takes precedence when configured.
      TargetPlatform.android => _androidAppId.isNotEmpty
          ? _androidAppId
          : _iosAppId,
      TargetPlatform.iOS => _iosAppId,
      _ => '',
    };
    if (_apiKey.isEmpty || appId.isEmpty || _projectId.isEmpty) {
      throw StateError(
        'Missing Firebase configuration. Run with the dart-defines documented in mobile/README.md.',
      );
    }
    return FirebaseOptions(
      apiKey: _apiKey,
      appId: appId,
      messagingSenderId: _messagingSenderId,
      projectId: _projectId,
      storageBucket: _storageBucket,
      iosBundleId: defaultTargetPlatform == TargetPlatform.iOS
          ? _iosBundleId
          : null,
    );
  }
}
