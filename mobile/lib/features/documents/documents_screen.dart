import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';

import '../auth/auth_controller.dart';

final documentsProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
      final api = ref.watch(apiClientProvider);
      final result = await api.get(
        '/documents',
        query: {'ownerOnly': true, 'page': 1, 'limit': 100},
      );
      return api.listFrom(result);
    });

class DocumentsScreen extends ConsumerWidget {
  const DocumentsScreen({super.key});

  static Future<void> openUpload(BuildContext context, WidgetRef ref) async {
    final api = ref.read(apiClientProvider);
    try {
      final metadata = await Future.wait([
        api.get('/subjects'),
        api.get('/categories'),
      ]);
      final subjects = api.listFrom(metadata[0]);
      final categories = api.listFrom(metadata[1]);
      if (!context.mounted) return;
      if (subjects.isEmpty || categories.isEmpty) {
        throw StateError('Hệ thống chưa có môn học hoặc danh mục.');
      }
      await showModalBottomSheet<void>(
        context: context,
        isScrollControlled: true,
        useSafeArea: true,
        builder: (_) => _UploadSheet(
          subjects: subjects,
          categories: categories,
          onUploaded: () => ref.invalidate(documentsProvider),
        ),
      );
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Không thể tải môn học và danh mục: $error')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final documents = ref.watch(documentsProvider);
    return Scaffold(
      backgroundColor: Colors.transparent,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => openUpload(context, ref),
        icon: const Icon(Icons.upload_file_rounded),
        label: const Text('Tải lên'),
      ),
      body: RefreshIndicator(
        onRefresh: () => ref.refresh(documentsProvider.future),
        child: documents.when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => _EmptyState(
            icon: Icons.cloud_off_rounded,
            title: 'Không thể tải thư viện',
            detail: error.toString(),
            action: () => ref.invalidate(documentsProvider),
          ),
          data: (items) => items.isEmpty
              ? _EmptyState(
                  icon: Icons.folder_open_rounded,
                  title: 'Thư viện đang trống',
                  detail: 'Tải tài liệu đầu tiên để bắt đầu hỏi đáp cùng AI.',
                  action: () => openUpload(context, ref),
                  actionLabel: 'Tải tài liệu',
                )
              : ListView.separated(
                  padding: const EdgeInsets.fromLTRB(16, 10, 16, 100),
                  itemCount: items.length,
                  separatorBuilder: (_, _) => const SizedBox(height: 10),
                  itemBuilder: (_, index) => _DocumentTile(items[index]),
                ),
        ),
      ),
    );
  }
}

class _DocumentTile extends ConsumerWidget {
  const _DocumentTile(this.document);
  final Map<String, dynamic> document;
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final fileName = document['fileName']?.toString() ?? '';
    final type = fileName.split('.').lastOrNull?.toUpperCase() ?? 'FILE';
    final status = document['aiStatus']?.toString() ?? 'PENDING';
    return Card(
      clipBehavior: Clip.antiAlias,
      child: InkWell(
        onTap: () => _showActions(context, ref),
        child: Padding(
          padding: const EdgeInsets.all(16),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 54,
                decoration: BoxDecoration(
                  color: const Color(0xfffff7ed),
                  borderRadius: BorderRadius.circular(12),
                ),
                alignment: Alignment.center,
                child: Text(
                  type,
                  style: const TextStyle(
                    color: Color(0xffb45309),
                    fontWeight: FontWeight.w800,
                    fontSize: 11,
                  ),
                ),
              ),
              const SizedBox(width: 14),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      document['title']?.toString() ?? 'Tài liệu',
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(fontWeight: FontWeight.w700),
                    ),
                    const SizedBox(height: 5),
                    Text(
                      '${document['subject']?['name'] ?? 'Chưa phân môn'} · ${document['category']?['name'] ?? ''}',
                      style: const TextStyle(color: Color(0xff64748b)),
                    ),
                    const SizedBox(height: 8),
                    Text(
                      status == 'COMPLETED' || status == 'MOCKED'
                          ? 'AI sẵn sàng'
                          : 'AI: $status',
                      style: const TextStyle(
                        color: Color(0xff166534),
                        fontSize: 12,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              IconButton(
                tooltip: 'Tùy chọn tài liệu',
                onPressed: () => _showActions(context, ref),
                icon: const Icon(Icons.chevron_right_rounded),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Future<void> _showActions(BuildContext context, WidgetRef ref) async {
    await showModalBottomSheet<void>(
      context: context,
      useSafeArea: true,
      builder: (sheetContext) => Padding(
        padding: const EdgeInsets.fromLTRB(18, 14, 18, 20),
        child: Column(
          mainAxisSize: MainAxisSize.min,
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            Text(
              document['title']?.toString() ?? 'Document',
              style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
            ),
            const SizedBox(height: 12),
            ListTile(
              leading: const Icon(Icons.visibility_outlined),
              title: const Text('Xem trước'),
              onTap: () {
                Navigator.pop(sheetContext);
                _showPreview(context, ref);
              },
            ),
            ListTile(
              leading: const Icon(Icons.download_outlined),
              title: const Text('Tải xuống'),
              onTap: () => _openUrl(
                sheetContext,
                ref,
                '/documents/${document['id']}/download',
              ),
            ),
            ListTile(
              leading: const Icon(Icons.auto_awesome_rounded),
              title: const Text('Hỏi AI'),
              subtitle: const Text('Dùng tài liệu này làm nguồn trả lời'),
              onTap: () {
                Navigator.pop(sheetContext);
                ScaffoldMessenger.of(context).showSnackBar(
                  const SnackBar(
                    content: Text('Mở Hỏi AI và chọn tài liệu này.'),
                  ),
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _showPreview(BuildContext context, WidgetRef ref) async {
    await showDialog<void>(
      context: context,
      builder: (dialogContext) => AlertDialog(
        title: Text(document['title']?.toString() ?? 'Xem trước tài liệu'),
        content: SizedBox(
          width: double.maxFinite,
          height: MediaQuery.sizeOf(dialogContext).height * .42,
          child: FutureBuilder<dynamic>(
            future: ref
                .read(apiClientProvider)
                .get(
                  '/documents/${document['id']}/preview',
                  receiveTimeout: const Duration(seconds: 15),
                ),
            builder: (context, snapshot) {
              if (snapshot.connectionState != ConnectionState.done) {
                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const CircularProgressIndicator(),
                    const SizedBox(height: 16),
                    const Text('Đang chuyển tài liệu sang PDF...'),
                    const SizedBox(height: 14),
                    OutlinedButton.icon(
                      onPressed: () => _openOriginal(dialogContext, ref),
                      icon: const Icon(Icons.file_open_outlined),
                      label: const Text('Mở bản gốc ngay'),
                    ),
                  ],
                );
              }
              if (snapshot.hasError) {
                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    const Icon(
                      Icons.cloud_off_rounded,
                      size: 48,
                      color: Colors.red,
                    ),
                    const SizedBox(height: 12),
                    const Text(
                      'Không thể tạo PDF trong thời gian cho phép. Bạn vẫn có thể mở file gốc.',
                      textAlign: TextAlign.center,
                    ),
                    const SizedBox(height: 18),
                    OutlinedButton.icon(
                      onPressed: () => _openOriginal(dialogContext, ref),
                      icon: const Icon(Icons.open_in_new_rounded),
                      label: const Text('Mở bản gốc'),
                    ),
                  ],
                );
              }
              final data = snapshot.data as Map<String, dynamic>;
              final originalUrl = data['url'] ?? data['downloadUrl'];
              final previewUrl = originalUrl == null
                  ? null
                  : _webPreviewUrl(data, originalUrl.toString());
              final usesOfficeViewer = previewUrl != originalUrl;
              return Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  const Icon(
                    Icons.description_outlined,
                    size: 56,
                    color: Color(0xffd97706),
                  ),
                  const SizedBox(height: 14),
                  Text(
                    usesOfficeViewer
                        ? 'Tài liệu sẽ được mở bằng Microsoft Office Viewer.'
                        : 'Bản PDF xem trước đã sẵn sàng.',
                    textAlign: TextAlign.center,
                  ),
                  const SizedBox(height: 18),
                  FilledButton.icon(
                    onPressed: previewUrl == null
                        ? null
                        : () => launchUrl(
                            Uri.parse(previewUrl),
                            mode: LaunchMode.inAppBrowserView,
                          ),
                    icon: const Icon(Icons.open_in_new_rounded),
                    label: const Text('Xem ngay'),
                  ),
                  const SizedBox(height: 8),
                  TextButton.icon(
                    onPressed: () => _openOriginal(dialogContext, ref),
                    icon: const Icon(Icons.file_open_outlined),
                    label: const Text('Mở bản gốc'),
                  ),
                ],
              );
            },
          ),
        ),
        actions: [
          TextButton(
            onPressed: () => Navigator.pop(dialogContext),
            child: const Text('Đóng'),
          ),
        ],
      ),
    );
  }

  String _webPreviewUrl(Map<String, dynamic> result, String originalUrl) {
    final contentType = result['contentType']?.toString().toLowerCase() ?? '';
    final useOfficeViewer =
        result['fallbackToOfficeViewer'] == true ||
        contentType.contains('officedocument');
    if (!useOfficeViewer) return originalUrl;
    return 'https://view.officeapps.live.com/op/view.aspx?src='
        '${Uri.encodeComponent(originalUrl)}';
  }

  Future<void> _openOriginal(BuildContext context, WidgetRef ref) async {
    try {
      final result = await ref
          .read(apiClientProvider)
          .get('/documents/${document['id']}/download');
      final url = result['url'] ?? result['downloadUrl'];
      if (url == null ||
          !await launchUrl(
            Uri.parse(url.toString()),
            mode: LaunchMode.inAppBrowserView,
          )) {
        throw StateError('URL unavailable');
      }
    } catch (_) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể mở file gốc. Vui lòng thử lại sau.'),
          ),
        );
      }
    }
  }

  Future<void> _openUrl(
    BuildContext context,
    WidgetRef ref,
    String path,
  ) async {
    try {
      final result = await ref.read(apiClientProvider).get(path);
      final url = result['url'] ?? result['downloadUrl'];
      if (url == null ||
          !await launchUrl(
            Uri.parse(url.toString()),
            mode: LaunchMode.externalApplication,
          )) {
        throw StateError('URL unavailable');
      }
      if (context.mounted) Navigator.pop(context);
    } catch (error) {
      if (context.mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(
            content: Text('Không thể tạo đường dẫn. Vui lòng thử lại sau.'),
          ),
        );
      }
    }
  }
}

class _UploadSheet extends ConsumerStatefulWidget {
  const _UploadSheet({
    required this.subjects,
    required this.categories,
    required this.onUploaded,
  });
  final List<Map<String, dynamic>> subjects;
  final List<Map<String, dynamic>> categories;
  final VoidCallback onUploaded;
  @override
  ConsumerState<_UploadSheet> createState() => _UploadSheetState();
}

class _UploadSheetState extends ConsumerState<_UploadSheet> {
  final title = TextEditingController();
  final description = TextEditingController();
  PlatformFile? file;
  late String subjectId = widget.subjects.first['id'].toString();
  late String categoryId = widget.categories.first['id'].toString();
  bool isPublic = false;
  bool loading = false;

  List<Map<String, dynamic>> get categories => widget.categories.where((item) {
    final linked = item['subjectId']?.toString();
    return linked == null || linked.isEmpty || linked == subjectId;
  }).toList();

  Future<void> pickFile() async {
    final result = await FilePicker.platform.pickFiles(
      withData: true,
      type: FileType.custom,
      allowedExtensions: const ['pdf', 'docx', 'pptx', 'xlsx'],
    );
    if (result == null) return;
    setState(() {
      file = result.files.single;
      if (title.text.trim().isEmpty) {
        title.text = file!.name.replaceFirst(RegExp(r'\.[^.]+$'), '');
      }
    });
  }

  Future<void> submit() async {
    if (file == null || title.text.trim().isEmpty) return;
    setState(() => loading = true);
    try {
      final part = file!.path != null
          ? await MultipartFile.fromFile(file!.path!, filename: file!.name)
          : MultipartFile.fromBytes(file!.bytes!, filename: file!.name);
      await ref
          .read(apiClientProvider)
          .dio
          .post<dynamic>(
            '/documents/upload',
            data: FormData.fromMap({
              'file': part,
              'title': title.text.trim(),
              'description': description.text.trim(),
              'subjectId': subjectId,
              'categoryId': categoryId,
              'visibility': isPublic ? 'PUBLIC' : 'PRIVATE',
            }),
          );
      widget.onUploaded();
      if (mounted) Navigator.pop(context);
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(
          context,
        ).showSnackBar(SnackBar(content: Text('Tải lên thất bại: $error')));
      }
    } finally {
      if (mounted) setState(() => loading = false);
    }
  }

  @override
  Widget build(BuildContext context) => Padding(
    padding: EdgeInsets.fromLTRB(
      20,
      16,
      20,
      MediaQuery.viewInsetsOf(context).bottom + 20,
    ),
    child: SingleChildScrollView(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.stretch,
        children: [
          const Text(
            'Tải tài liệu mới',
            style: TextStyle(fontSize: 24, fontWeight: FontWeight.w800),
          ),
          const SizedBox(height: 6),
          const Text('PDF, DOCX, PPTX hoặc XLSX · tối đa 80 MB'),
          const SizedBox(height: 18),
          OutlinedButton.icon(
            onPressed: pickFile,
            icon: const Icon(Icons.attach_file_rounded),
            label: Padding(
              padding: const EdgeInsets.all(14),
              child: Text(file?.name ?? 'Chọn tệp'),
            ),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: title,
            decoration: const InputDecoration(labelText: 'Tên tài liệu *'),
          ),
          const SizedBox(height: 12),
          TextField(
            controller: description,
            maxLines: 3,
            decoration: const InputDecoration(labelText: 'Mô tả'),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            initialValue: subjectId,
            decoration: const InputDecoration(labelText: 'Môn học *'),
            items: widget.subjects
                .map(
                  (e) => DropdownMenuItem(
                    value: e['id'].toString(),
                    child: Text(e['name'].toString()),
                  ),
                )
                .toList(),
            onChanged: (value) => setState(() {
              subjectId = value!;
              final filtered = categories;
              if (filtered.isNotEmpty) {
                categoryId = filtered.first['id'].toString();
              }
            }),
          ),
          const SizedBox(height: 12),
          DropdownButtonFormField<String>(
            key: ValueKey('$subjectId-$categoryId'),
            initialValue:
                categories.any((e) => e['id'].toString() == categoryId)
                ? categoryId
                : categories.firstOrNull?['id']?.toString(),
            decoration: const InputDecoration(labelText: 'Danh mục *'),
            items: categories
                .map(
                  (e) => DropdownMenuItem(
                    value: e['id'].toString(),
                    child: Text(e['name'].toString()),
                  ),
                )
                .toList(),
            onChanged: (value) => categoryId = value!,
          ),
          SwitchListTile(
            contentPadding: EdgeInsets.zero,
            value: isPublic,
            onChanged: (value) => setState(() => isPublic = value),
            title: const Text('Chia sẻ lên cộng đồng'),
          ),
          const SizedBox(height: 12),
          FilledButton.icon(
            onPressed: loading ? null : submit,
            icon: const Icon(Icons.cloud_upload_outlined),
            label: Padding(
              padding: const EdgeInsets.all(15),
              child: Text(loading ? 'Đang tải...' : 'Tải lên và xử lý AI'),
            ),
          ),
        ],
      ),
    ),
  );
}

class _EmptyState extends StatelessWidget {
  const _EmptyState({
    required this.icon,
    required this.title,
    required this.detail,
    required this.action,
    this.actionLabel = 'Thử lại',
  });
  final IconData icon;
  final String title;
  final String detail;
  final VoidCallback action;
  final String actionLabel;
  @override
  Widget build(BuildContext context) => ListView(
    children: [
      const SizedBox(height: 120),
      Icon(icon, size: 62, color: const Color(0xffd97706)),
      const SizedBox(height: 14),
      Text(
        title,
        textAlign: TextAlign.center,
        style: const TextStyle(fontSize: 20, fontWeight: FontWeight.w800),
      ),
      Padding(
        padding: const EdgeInsets.all(12),
        child: Text(
          detail,
          textAlign: TextAlign.center,
          style: const TextStyle(color: Color(0xff64748b)),
        ),
      ),
      Center(
        child: FilledButton(onPressed: action, child: Text(actionLabel)),
      ),
    ],
  );
}
