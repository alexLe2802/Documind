import 'package:dio/dio.dart';
import 'package:file_picker/file_picker.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:url_launcher/url_launcher.dart';
import 'package:webview_flutter/webview_flutter.dart';

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
    await Navigator.of(context).push<void>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _DocumentPreviewPage(document: document),
      ),
    );
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

class _DocumentPreviewPage extends ConsumerStatefulWidget {
  const _DocumentPreviewPage({required this.document});
  final Map<String, dynamic> document;

  @override
  ConsumerState<_DocumentPreviewPage> createState() =>
      _DocumentPreviewPageState();
}

class _DocumentPreviewPageState extends ConsumerState<_DocumentPreviewPage> {
  WebViewController? controller;
  String? originalUrl;
  String? error;
  int progress = 0;

  @override
  void initState() {
    super.initState();
    _loadPreview();
  }

  Future<void> _loadPreview() async {
    if (mounted) {
      setState(() {
        controller = null;
        error = null;
        progress = 0;
      });
    }
    try {
      final result = Map<String, dynamic>.from(
        await ref
            .read(apiClientProvider)
            .get(
              '/documents/${widget.document['id']}/preview',
              receiveTimeout: const Duration(seconds: 15),
            ),
      );
      final rawUrl = (result['url'] ?? result['downloadUrl'])?.toString();
      if (rawUrl == null) throw StateError('Preview URL unavailable');
      final previewUrl = _previewUrl(result, rawUrl);
      final webController = WebViewController()
        ..setJavaScriptMode(JavaScriptMode.unrestricted)
        ..setBackgroundColor(const Color(0xfff8fafc))
        ..setNavigationDelegate(
          NavigationDelegate(
            onProgress: (value) {
              if (mounted) setState(() => progress = value);
            },
            onPageFinished: (_) {
              if (mounted) setState(() => progress = 100);
            },
            onWebResourceError: (webError) {
              if (webError.isForMainFrame == true && mounted) {
                setState(
                  () => error = 'Không thể hiển thị tài liệu trong app.',
                );
              }
            },
          ),
        )
        ..loadRequest(Uri.parse(previewUrl));
      if (!mounted) return;
      setState(() {
        originalUrl = rawUrl;
        controller = webController;
      });
    } catch (_) {
      if (mounted) setState(() => error = 'Không thể tải bản xem trước.');
    }
  }

  String _previewUrl(Map<String, dynamic> result, String rawUrl) {
    final contentType = result['contentType']?.toString().toLowerCase() ?? '';
    final useOfficeViewer =
        result['fallbackToOfficeViewer'] == true ||
        contentType.contains('officedocument');
    if (!useOfficeViewer) return rawUrl;
    return 'https://view.officeapps.live.com/op/embed.aspx?src='
        '${Uri.encodeComponent(rawUrl)}';
  }

  Future<void> _download() async {
    try {
      final result = await ref
          .read(apiClientProvider)
          .get('/documents/${widget.document['id']}/download');
      final url = (result['url'] ?? result['downloadUrl'])?.toString();
      if (url == null ||
          !await launchUrl(
            Uri.parse(url),
            mode: LaunchMode.externalApplication,
          )) {
        throw StateError('Download URL unavailable');
      }
    } catch (_) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          const SnackBar(content: Text('Không thể tải xuống tài liệu.')),
        );
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final title = widget.document['title']?.toString() ?? 'Tài liệu';
    final fileName = widget.document['fileName']?.toString() ?? '';
    return Scaffold(
      backgroundColor: const Color(0xfff1f5f9),
      appBar: AppBar(
        automaticallyImplyLeading: false,
        title: Row(
          children: [
            const Icon(Icons.description_outlined, color: Color(0xffd97706)),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(title, maxLines: 1, overflow: TextOverflow.ellipsis),
                  Text(
                    fileName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontSize: 12,
                      fontWeight: FontWeight.w400,
                      color: Color(0xff64748b),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
        actions: [
          IconButton(
            tooltip: 'Đóng',
            onPressed: () => Navigator.pop(context),
            icon: const Icon(Icons.close_rounded),
          ),
        ],
        bottom: progress > 0 && progress < 100
            ? PreferredSize(
                preferredSize: const Size.fromHeight(3),
                child: LinearProgressIndicator(value: progress / 100),
              )
            : null,
      ),
      body: Padding(
        padding: const EdgeInsets.all(10),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(14),
          child: ColoredBox(
            color: Colors.white,
            child: error != null
                ? _PreviewError(message: error!, retry: _loadPreview)
                : controller == null
                ? const Center(child: CircularProgressIndicator())
                : WebViewWidget(controller: controller!),
          ),
        ),
      ),
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(16, 10, 16, 12),
          child: Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: originalUrl == null
                      ? null
                      : () => controller?.loadRequest(Uri.parse(originalUrl!)),
                  icon: const Icon(Icons.visibility_outlined),
                  label: const Text('Mở bản gốc'),
                ),
              ),
              const SizedBox(width: 10),
              Expanded(
                child: FilledButton.icon(
                  onPressed: _download,
                  icon: const Icon(Icons.download_outlined),
                  label: const Text('Tải xuống'),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _PreviewError extends StatelessWidget {
  const _PreviewError({required this.message, required this.retry});
  final String message;
  final VoidCallback retry;

  @override
  Widget build(BuildContext context) => Center(
    child: Padding(
      padding: const EdgeInsets.all(24),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          const Icon(Icons.cloud_off_rounded, size: 52, color: Colors.red),
          const SizedBox(height: 12),
          Text(message, textAlign: TextAlign.center),
          const SizedBox(height: 16),
          OutlinedButton.icon(
            onPressed: retry,
            icon: const Icon(Icons.refresh_rounded),
            label: const Text('Thử lại'),
          ),
        ],
      ),
    ),
  );
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
