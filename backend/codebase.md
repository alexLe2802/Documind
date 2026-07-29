# DocuMind Project Memory & Progress Log

Tài liệu này lưu trữ bối cảnh (context), lịch sử phát triển, tiến độ hiện tại và kế hoạch hành động tiếp theo của dự án **DocuMind Backend**. Tài liệu này cần được đọc và cập nhật ở mỗi phiên làm việc để đảm bảo tính liên tục của dự án.

---

## 1. Bối cảnh Dự án (Project Context)

### Công nghệ sử dụng (Tech Stack)

- **Framework:** NestJS & TypeScript.
- **Database ORM:** Prisma ORM kết nối tới PostgreSQL (host trên Supabase).
- **Authentication:** Firebase Authentication (xác thực token qua Firebase Admin SDK).
- **Storage:** Firebase Cloud Storage (lưu trữ tài liệu).
- **AI Integration:** Gemini API (để tóm tắt và hỏi đáp tài liệu).

### Quy định lập trình (Coding Rules)

- Controllers giữ độ mỏng tối đa; toàn bộ logic nghiệp vụ đặt ở Services.
- Sử dụng DTO và `class-validator` để xác thực dữ liệu đầu vào.
- Chỉ truy cập PostgreSQL thông qua `PrismaService`.
- Các API quản trị/bảo mật phải được bảo vệ bằng `FirebaseAuthGuard` và `RolesGuard`, phân quyền dựa trên dữ liệu từ PostgreSQL.
- **TDD (Test-Driven Development):** Luôn viết unit tests/E2E tests trước hoặc đồng thời khi phát triển tính năng mới. Không commit code lỗi Lint hoặc Format.

---

## 2. Nhật ký Tiến độ & Lịch sử Tính năng

### Trạng thái Git Hiện tại (Nhánh: `ThienNTN`)

- **Đã lọc lại scope:** local giữ lại phần nền cần thiết và 5 task `THIEN-01` đến `THIEN-05`.
- **Đã loại khỏi scope ThienNTN:** source từ branch khác như Auth API endpoints của Thống và AI Chatbot module của Quang không còn được import hoặc giữ trong source tree.
- **Module boundary:** `src/chatbot/chatbot.module.ts` được giữ ở dạng skeleton compile-ready; `src/ai-chatbot` đã bị loại khỏi `AppModule`.

### Bảng Tiến độ các Task (Tính đến 13/06/2026)

| Mã Task        | Tính năng                 | Trạng thái             | Chi tiết triển khai                                                                                                                                                                  |
| :------------- | :------------------------ | :--------------------- | :----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **FOUNDATION** | Khung dự án base          | **Hoàn thành**         | Setup project, Prisma schema, global pipes, healthcheck, config validation, Firebase Admin config, and Auth guards.                                                                  |
| **THIEN-01**   | Module skeleton           | **Hoàn thành**         | Có dashboard, audit-log, download-log modules/controllers/services/dtos; admin log routes đã được bảo vệ bằng Firebase/Auth role guards.                                             |
| **THIEN-02**   | Analytics & Logs schema   | **Hoàn thành**         | `DownloadLog` và `AuditLog` đã có trong Prisma schema; analytics/logs spec đã cập nhật để không đề xuất Redis trong MVP.                                                             |
| **THIEN-03**   | Dashboard Summary API     | **Hoàn thành**         | `GET /api/admin/dashboard/summary` trả về tổng số user, tài liệu active/public/private, chats, và downloads.                                                                         |
| **THIEN-04**   | Reusable AuditLog Service | **Hoàn thành** (Local) | Viết dịch vụ `AuditLogService` ghi log hệ thống vào DB. Triển khai API bảo mật `GET /api/admin/logs/audit`. Đã viết Unit/E2E test.                                                   |
| **THIEN-05**   | Admin statistics APIs     | **Hoàn thành** (Local) | Triển khai các API thống kê chi tiết theo vai trò/trạng thái user, trạng thái/chế độ tài liệu, thống kê theo môn học/danh mục và lượng upload theo thời gian. Đã viết Unit/E2E test. |

---

## 3. Bản đồ Mã nguồn & Các file quan trọng

- **Cấu hình & Schema DB:**
  - [schema.prisma](file:///F:/docu-mind-local/prisma/schema.prisma) - Định nghĩa thực thể DB (User, Document, ChatSession, AuditLog, DownloadLog...).
  - [AGENTS.md](file:///F:/docu-mind-local/AGENTS.md) - Quy định phát triển và cấm kỵ công nghệ của dự án.
- **Hệ thống xác thực:**
  - [firebase-auth.guard.ts](file:///F:/docu-mind-local/src/auth/guards/firebase-auth.guard.ts) - Guard xác thực Firebase ID Token từ client.
  - [roles.guard.ts](file:///F:/docu-mind-local/src/auth/guards/roles.guard.ts) - Guard kiểm tra quyền ADMIN/USER dựa trên DB PostgreSQL.
- **Thống kê Dashboard:**
  - [dashboard.controller.ts](file:///F:/docu-mind-local/src/dashboard/dashboard.controller.ts) & [dashboard.service.ts](file:///F:/docu-mind-local/src/dashboard/dashboard.service.ts) - Nơi xử lý các API thống kê.
- **Nhật ký hệ thống:**
  - [audit-log.service.ts](file:///F:/docu-mind-local/src/audit-log/audit-log.service.ts) - Dịch vụ ghi log dùng chung.
- **Bộ kiểm thử chính:**
  - [dashboard.e2e-spec.ts](file:///F:/docu-mind-local/test/dashboard.e2e-spec.ts), [audit-log.e2e-spec.ts](file:///F:/docu-mind-local/test/audit-log.e2e-spec.ts), và [admin-security.e2e-spec.ts](file:///F:/docu-mind-local/test/admin-security.e2e-spec.ts) - Bộ test E2E xác thực chất lượng API và bảo vệ admin routes.

---

## 4. Kế hoạch Hành động Tiếp theo (Next Action Items)

Khi bắt đầu phiên làm việc mới, hãy thực hiện lần lượt các bước sau:

1. **Kiểm tra lại trạng thái trước khi push/PR:**
   - `npm run format:check`
   - `npm run lint`
   - `npm test -- --runInBand`
   - `npm run test:e2e -- --runInBand`
   - `npm run prisma:validate`
   - `npm run build`
2. **Phát triển các Domain MVP tiếp theo:**
   - Subjects / Categories management.
   - Document upload & extraction.
   - Search & saved document flows.
