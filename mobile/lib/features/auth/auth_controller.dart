import 'package:firebase_auth/firebase_auth.dart';
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

  Future<void> forgotPassword(String email) =>
      _api.post('/auth/forgot-password', data: {'email': email.trim()});

  Future<void> signInWithGoogle() async {
    final google = GoogleSignIn.instance;
    await google.initialize();
    final account = await google.authenticate();
    final idToken = account.authentication.idToken;
    if (idToken == null) throw StateError('Google did not return an ID token');
    await _auth.signInWithCredential(
      GoogleAuthProvider.credential(idToken: idToken),
    );
    await _api.post('/auth/firebase-login');
  }

  Future<void> signOut() async {
    await _auth.signOut();
    try {
      await GoogleSignIn.instance.disconnect();
    } catch (_) {}
  }
}

final authControllerProvider = Provider(
  (ref) => AuthController(
    ref.watch(firebaseAuthProvider),
    ref.watch(apiClientProvider),
  ),
);
