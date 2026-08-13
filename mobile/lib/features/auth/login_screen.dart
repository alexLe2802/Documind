import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'auth_controller.dart';

class LoginScreen extends ConsumerStatefulWidget {
  const LoginScreen({super.key});
  @override
  ConsumerState<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends ConsumerState<LoginScreen> {
  final email = TextEditingController();
  final password = TextEditingController();
  bool loading = false;
  String? error;

  Future<void> submit() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await ref.read(authControllerProvider).signIn(email.text, password.text);
    } catch (e) {
      setState(
        () =>
            error = 'Đăng nhập thất bại. Kiểm tra email, mật khẩu và kết nối.',
      );
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> googleSignIn() async {
    setState(() {
      loading = true;
      error = null;
    });
    try {
      await ref.read(authControllerProvider).signInWithGoogle();
    } catch (_) {
      setState(
        () => error =
            'Không thể đăng nhập bằng Google. Hãy kiểm tra cấu hình Google Sign-In.',
      );
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  Future<void> showRegister() async {
    final fullName = TextEditingController(),
        mail = TextEditingController(),
        pass = TextEditingController();
    await showDialog(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Create account'),
        content: SingleChildScrollView(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              TextField(
                controller: fullName,
                decoration: const InputDecoration(labelText: 'Full name'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: mail,
                decoration: const InputDecoration(labelText: 'Email'),
              ),
              const SizedBox(height: 10),
              TextField(
                controller: pass,
                obscureText: true,
                decoration: const InputDecoration(labelText: 'Password'),
              ),
            ],
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c),
            child: const Text('CANCEL'),
          ),
          FilledButton(
            onPressed: () async {
              await ref
                  .read(authControllerProvider)
                  .register(fullName.text, mail.text, pass.text);
              if (c.mounted) Navigator.pop(c);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text(
                      'Registration complete. Check your verification email.',
                    ),
                  ),
                );
              }
            },
            child: const Text('REGISTER'),
          ),
        ],
      ),
    );
  }

  Future<void> showForgot() async {
    final mail = TextEditingController(text: email.text);
    await showDialog(
      context: context,
      builder: (c) => AlertDialog(
        title: const Text('Forgot password'),
        content: TextField(
          controller: mail,
          decoration: const InputDecoration(labelText: 'Email'),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(c),
            child: const Text('CANCEL'),
          ),
          FilledButton(
            onPressed: () async {
              await ref.read(authControllerProvider).forgotPassword(mail.text);
              if (c.mounted) Navigator.pop(c);
              if (mounted) {
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(content: Text('Password reset email sent.')),
                );
              }
            },
            child: const Text('SEND'),
          ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Scaffold(
    body: SafeArea(
      child: Center(
        child: SingleChildScrollView(
          padding: const EdgeInsets.all(28),
          child: ConstrainedBox(
            constraints: const BoxConstraints(maxWidth: 440),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.stretch,
              children: [
                Center(
                  child: Image.network(
                    'https://documind.icu/Logo.png',
                    width: 88,
                    height: 88,
                    errorBuilder: (_, _, _) => const Icon(
                      Icons.auto_stories_rounded,
                      size: 72,
                      color: Color(0xffd97706),
                    ),
                  ),
                ),
                const SizedBox(height: 18),
                Text(
                  'DocuMind',
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.headlineLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const Text(
                  'Không gian học tập và tài liệu thông minh',
                  textAlign: TextAlign.center,
                ),
                const SizedBox(height: 36),
                TextField(
                  controller: email,
                  keyboardType: TextInputType.emailAddress,
                  decoration: const InputDecoration(
                    labelText: 'Email',
                    prefixIcon: Icon(Icons.email_outlined),
                  ),
                ),
                Align(
                  alignment: Alignment.centerRight,
                  child: TextButton(
                    onPressed: showForgot,
                    child: const Text('Forgot password?'),
                  ),
                ),
                const SizedBox(height: 14),
                TextField(
                  controller: password,
                  obscureText: true,
                  decoration: const InputDecoration(
                    labelText: 'Mật khẩu',
                    prefixIcon: Icon(Icons.lock_outline),
                  ),
                ),
                if (error != null)
                  Padding(
                    padding: const EdgeInsets.only(top: 12),
                    child: Text(
                      error!,
                      style: const TextStyle(color: Colors.red),
                    ),
                  ),
                const SizedBox(height: 18),
                FilledButton(
                  onPressed: loading ? null : submit,
                  child: Padding(
                    padding: const EdgeInsets.all(14),
                    child: loading
                        ? const SizedBox.square(
                            dimension: 20,
                            child: CircularProgressIndicator(strokeWidth: 2),
                          )
                        : const Text('Đăng nhập'),
                  ),
                ),
                const Padding(
                  padding: EdgeInsets.symmetric(vertical: 14),
                  child: Row(
                    children: [
                      Expanded(child: Divider()),
                      Padding(
                        padding: EdgeInsets.symmetric(horizontal: 12),
                        child: Text('HOẶC'),
                      ),
                      Expanded(child: Divider()),
                    ],
                  ),
                ),
                OutlinedButton.icon(
                  onPressed: loading ? null : googleSignIn,
                  icon: const Icon(Icons.g_mobiledata_rounded, size: 30),
                  label: const Padding(
                    padding: EdgeInsets.all(13),
                    child: Text('Tiếp tục với Google'),
                  ),
                ),
                const SizedBox(height: 10),
                TextButton(
                  onPressed: showRegister,
                  child: const Text('New to DocuMind? Create account'),
                ),
              ],
            ),
          ),
        ),
      ),
    ),
  );
}
