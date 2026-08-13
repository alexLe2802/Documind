import 'package:dio/dio.dart';
import 'package:firebase_auth/firebase_auth.dart';

class ApiClient {
  ApiClient(this._auth)
    : dio = Dio(
        BaseOptions(
          baseUrl: const String.fromEnvironment(
            'API_BASE_URL',
            defaultValue: 'https://api.documind.icu/api',
          ),
          connectTimeout: const Duration(seconds: 15),
          receiveTimeout: const Duration(seconds: 45),
          headers: const {'Accept': 'application/json'},
        ),
      ) {
    dio.interceptors.add(
      InterceptorsWrapper(
        onRequest: (options, handler) async {
          final token = await _auth.currentUser?.getIdToken();
          if (token != null) options.headers['Authorization'] = 'Bearer $token';
          handler.next(options);
        },
      ),
    );
  }

  final FirebaseAuth _auth;
  final Dio dio;

  dynamic unwrap(dynamic response) {
    if (response is Map<String, dynamic> && response['success'] == true) {
      final data = response['data'];
      final meta = response['meta'];
      return meta != null && data is List
          ? {'items': data, 'meta': meta}
          : data;
    }
    return response;
  }

  List<Map<String, dynamic>> listFrom(dynamic value) {
    dynamic raw = value;
    if (raw is Map) raw = raw['items'] ?? raw['data'] ?? raw['results'];
    if (raw is! List) return const [];
    return raw
        .whereType<Map>()
        .map((item) => Map<String, dynamic>.from(item))
        .toList();
  }

  Future<dynamic> get(String path, {Map<String, dynamic>? query}) async =>
      unwrap((await dio.get<dynamic>(path, queryParameters: query)).data);

  Future<dynamic> post(String path, {Object? data}) async =>
      unwrap((await dio.post<dynamic>(path, data: data)).data);

  Future<dynamic> patch(String path, {Object? data}) async =>
      unwrap((await dio.patch<dynamic>(path, data: data)).data);

  Future<dynamic> delete(String path, {Object? data}) async =>
      unwrap((await dio.delete<dynamic>(path, data: data)).data);
}
