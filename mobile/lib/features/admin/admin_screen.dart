import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../auth/auth_controller.dart';

final adminSummaryProvider = FutureProvider<Map<String, dynamic>>(
  (ref) async => Map<String, dynamic>.from(
    await ref.watch(apiClientProvider).get('/admin/dashboard/summary'),
  ),
);

class AdminScreen extends StatelessWidget {
  const AdminScreen({super.key});
  @override
  Widget build(BuildContext context) => const DefaultTabController(
    length: 3,
    child: Column(
      children: [
        TabBar(
          tabs: [
            Tab(text: 'Overview'),
            Tab(text: 'Users'),
            Tab(text: 'Documents'),
          ],
        ),
        Expanded(
          child: TabBarView(children: [_Summary(), _Users(), _Documents()]),
        ),
      ],
    ),
  );
}

class _Summary extends ConsumerWidget {
  const _Summary();
  @override
  Widget build(BuildContext context, WidgetRef ref) => RefreshIndicator(
    onRefresh: () async {
      ref.invalidate(adminSummaryProvider);
      await ref.read(adminSummaryProvider.future);
    },
    child: ref
        .watch(adminSummaryProvider)
        .when(
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (e, _) => ListView(children: [Center(child: Text('$e'))]),
          data: (d) => GridView.count(
            padding: const EdgeInsets.all(16),
            crossAxisCount: 2,
            children: [
              for (final x in [
                ('USERS', d['totalUsers']),
                ('DOCUMENTS', d['totalDocuments']),
                ('PUBLIC', d['totalPublicDocuments']),
                ('CHATS', d['totalChats']),
              ])
                Card(
                  child: Center(
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Text(
                          '${x.$2 ?? 0}',
                          style: const TextStyle(
                            fontSize: 30,
                            fontWeight: FontWeight.w800,
                          ),
                        ),
                        Text(x.$1),
                      ],
                    ),
                  ),
                ),
            ],
          ),
        ),
  );
}

class _Users extends ConsumerStatefulWidget {
  const _Users();
  @override
  ConsumerState<_Users> createState() => _UsersState();
}

class _UsersState extends ConsumerState<_Users> {
  final search = TextEditingController();
  String keyword = '';

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> load() async {
    final api = ref.read(apiClientProvider);
    return api.listFrom(
      await api.get(
        '/admin/users',
        query: {
          'page': 1,
          'limit': 50,
          if (keyword.isNotEmpty) 'keyword': keyword,
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.all(16),
        child: TextField(
          controller: search,
          textInputAction: TextInputAction.done,
          onChanged: (v) => setState(() => keyword = v.trim()),
          onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
          decoration: InputDecoration(
            hintText: 'Search by name or email',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: IconButton(
              onPressed: () {
                search.clear();
                setState(() => keyword = '');
              },
              icon: const Icon(Icons.clear),
            ),
          ),
        ),
      ),
      Expanded(
        child: FutureBuilder(
          future: load(),
          builder: (context, s) {
            if (!s.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = s.data!;
            return RefreshIndicator(
              onRefresh: () async => setState(() {}),
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final u = items[i];
                  return Card(
                    child: ListTile(
                      title: Text(
                        u['fullName']?.toString() ?? u['email'].toString(),
                      ),
                      subtitle: Text('${u['email']} · ${u['role']}'),
                      trailing: u['role'] == 'ADMIN'
                          ? _StatusChip(status: u['status'].toString())
                          : PopupMenuButton<String>(
                              onSelected: (status) async {
                                await ref
                                    .read(apiClientProvider)
                                    .patch(
                                      '/admin/users/${u['id']}/status',
                                      data: {'status': status},
                                    );
                                setState(() {});
                              },
                              itemBuilder: (_) => const [
                                PopupMenuItem(
                                  value: 'ACTIVE',
                                  child: Text('ACTIVE'),
                                ),
                                PopupMenuItem(
                                  value: 'BLOCKED',
                                  child: Text('BLOCKED'),
                                ),
                                PopupMenuItem(
                                  value: 'INACTIVE',
                                  child: Text('INACTIVE'),
                                ),
                              ],
                              child: _StatusChip(
                                status: u['status'].toString(),
                              ),
                            ),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    ],
  );
}

class _Documents extends ConsumerStatefulWidget {
  const _Documents();
  @override
  ConsumerState<_Documents> createState() => _DocumentsState();
}

class _DocumentsState extends ConsumerState<_Documents> {
  final search = TextEditingController();
  String keyword = '', status = '';

  @override
  void dispose() {
    search.dispose();
    super.dispose();
  }

  Future<List<Map<String, dynamic>>> load() async {
    final api = ref.read(apiClientProvider);
    return api.listFrom(
      await api.get(
        '/admin/documents',
        query: {
          'page': 1,
          'limit': 50,
          if (keyword.isNotEmpty) 'keyword': keyword,
          if (status.isNotEmpty) 'moderationStatus': status,
        },
      ),
    );
  }

  @override
  Widget build(BuildContext context) => Column(
    children: [
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 16, 16, 8),
        child: TextField(
          controller: search,
          textInputAction: TextInputAction.done,
          onChanged: (v) => setState(() => keyword = v.trim()),
          onSubmitted: (_) => FocusManager.instance.primaryFocus?.unfocus(),
          decoration: InputDecoration(
            hintText: 'Search documents',
            prefixIcon: const Icon(Icons.search),
            suffixIcon: IconButton(
              onPressed: () {
                search.clear();
                setState(() => keyword = '');
              },
              icon: const Icon(Icons.clear),
            ),
          ),
        ),
      ),
      Padding(
        padding: const EdgeInsets.fromLTRB(16, 0, 16, 8),
        child: DropdownButtonFormField(
          initialValue: status,
          decoration: const InputDecoration(labelText: 'Moderation status'),
          items: const [
            DropdownMenuItem(value: '', child: Text('ALL')),
            DropdownMenuItem(value: 'PENDING', child: Text('PENDING')),
            DropdownMenuItem(value: 'APPROVED', child: Text('APPROVED')),
            DropdownMenuItem(value: 'REJECTED', child: Text('REJECTED')),
          ],
          onChanged: (v) => setState(() => status = v!),
        ),
      ),
      Expanded(
        child: FutureBuilder(
          future: load(),
          builder: (context, s) {
            if (!s.hasData) {
              return const Center(child: CircularProgressIndicator());
            }
            final items = s.data!;
            return RefreshIndicator(
              onRefresh: () async => setState(() {}),
              child: ListView.separated(
                physics: const AlwaysScrollableScrollPhysics(),
                padding: const EdgeInsets.all(16),
                itemCount: items.length,
                separatorBuilder: (_, _) => const SizedBox(height: 8),
                itemBuilder: (_, i) {
                  final d = items[i];
                  return Card(
                    child: ListTile(
                      title: Text(d['title']?.toString() ?? ''),
                      subtitle: Row(
                        children: [
                          Expanded(
                            child: Text('${d['owner']?['email'] ?? ''}'),
                          ),
                          _StatusChip(
                            status: d['moderationStatus']?.toString() ?? '',
                          ),
                        ],
                      ),
                      trailing: PopupMenuButton<String>(
                        onSelected: (a) async {
                          if (a == 'APPROVE') {
                            await ref
                                .read(apiClientProvider)
                                .dio
                                .put('/admin/documents/${d['id']}/approve');
                          }
                          if (a == 'HIDE') {
                            await ref
                                .read(apiClientProvider)
                                .dio
                                .put(
                                  '/admin/documents/${d['id']}/hide',
                                  data: {
                                    'hidden': true,
                                    'reason': 'Hidden by administrator',
                                  },
                                );
                          }
                          setState(() {});
                        },
                        itemBuilder: (_) => const [
                          PopupMenuItem(
                            value: 'APPROVE',
                            child: Text('APPROVE'),
                          ),
                          PopupMenuItem(value: 'HIDE', child: Text('HIDE')),
                        ],
                      ),
                    ),
                  );
                },
              ),
            );
          },
        ),
      ),
    ],
  );
}

class _StatusChip extends StatelessWidget {
  const _StatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    final normalized = status.toUpperCase();
    final isGreen = normalized == 'ACTIVE' || normalized == 'APPROVED';
    final isRed = normalized == 'BLOCKED' || normalized == 'REJECTED';
    final color = isGreen
        ? const Color(0xff15803d)
        : isRed
        ? const Color(0xffdc2626)
        : const Color(0xff64748b);
    return Chip(
      visualDensity: VisualDensity.compact,
      side: BorderSide(color: color.withValues(alpha: .35)),
      backgroundColor: color.withValues(alpha: .1),
      label: Text(
        normalized,
        style: TextStyle(color: color, fontWeight: FontWeight.w800),
      ),
    );
  }
}
