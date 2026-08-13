import 'package:firebase_auth/firebase_auth.dart';
import 'package:dio/dio.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:google_sign_in/google_sign_in.dart';

import '../../core/api_client.dart';

final firebaseAuthProvider = Provider((_) => FirebaseAuth.instance);
final apiClientProvider = Provider(
  (ref) => ApiClient(ref.watch(firebaseAuthProvider)),
);
final authStateProvider = StreamProvider<User?>(
  (ref) => ref.watch(firebaseAuthProvider).authStateChanges(),
);

class AuthController {
  AuthController(this._auth, this._api);
  final FirebaseAuth _auth;
  final ApiClient _api;

  Future<void> signIn(String email, String password) async {
    final credential = await _auth.signInWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    await credential.user?.reload();
    if (_auth.currentUser?.emailVerified != true) {
      await _auth.signOut();
      throw StateError('Verify your email before signing in.');
    }
    await _api.post('/auth/firebase-login');
  }

  Future<void> register(String fullName, String email, String password) async {
    final credential = await _auth.createUserWithEmailAndPassword(
      email: email.trim(),
      password: password,
    );
    await credential.user?.updateDisplayName(fullName.trim());
    await _api.post(
      '/auth/register',
      data: {'fullName': fullName.trim(), 'acceptedTerms': true},
    );
    await credential.user?.sendEmailVerification();
    await _auth.signOut();
  }

  Future<void> registerGoogle(String fullName) async {
    if (_auth.currentUser == null) throw StateError('Google session expired');
    await _api.post(
      '/auth/register',
      data: {'fullName': fullName.trim(), 'acceptedTerms': true},
    );
    await _auth.signOut();
  }

  Future<void> forgotPassword(String email) =>
      _api.post('/auth/forgot-password', data: {'email': email.trim()});

  Future<GoogleRegistrationData?> signInWithGoogle() async {
    final google = GoogleSignIn.instance;
    await google.initialize();
    try {
      await google.disconnect();
    } catch (_) {}
    final account = await google.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null) throw StateError('Google did not return an ID token');
    await _auth.signInWithCredential(
      GoogleAuthProvider.credential(idToken: idToken),
    );
    try {
      await _api.post('/auth/firebase-login');
      return null;
    } on DioException catch (error) {
      final body = error.response?.data;
      final message = body is Map
          ? ((body['error'] is Map ? body['error']['message'] : body['message'])
                    ?.toString() ??
                '')
          : '';
      if (message.contains('Account registration is required')) {
        return GoogleRegistrationData(
          fullName: account.displayName ?? '',
          email: account.email,
        );
      }
      await _auth.signOut();
      rethrow;
    }
  }

  Future<void> signOut() async {
    await _auth.signOut();
    try {
      await GoogleSignIn.instance.disconnect();
    } catch (_) {}
  }
}

class GoogleRegistrationData {
  const GoogleRegistrationData({required this.fullName, required this.email});
  final String fullName;
  final String email;
}

final authControllerProvider = Provider(
  (ref) => AuthController(
    ref.watch(firebaseAuthProvider),
    ref.watch(apiClientProvider),
  ),
);
