import 'package:firebase_core/firebase_core.dart';

abstract final class DocuMindFirebaseOptions {
  static const _apiKey = String.fromEnvironment('FIREBASE_API_KEY');
  static const _appId = String.fromEnvironment('FIREBASE_IOS_APP_ID');
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
    if (_apiKey.isEmpty || _appId.isEmpty || _projectId.isEmpty) {
      throw StateError(
        'Missing Firebase configuration. Run with the dart-defines documented in mobile/README.md.',
      );
    }
    return const FirebaseOptions(
      apiKey: _apiKey,
      appId: _appId,
      messagingSenderId: _messagingSenderId,
      projectId: _projectId,
      storageBucket: _storageBucket,
      iosBundleId: _iosBundleId,
    );
  }
}
