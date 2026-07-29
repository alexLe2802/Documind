# Kế hoạch test của Nguyễn Trần Ngọc Thiện (ThienNTN) — Dashboard, Analytics, Logs, Reports và Payment backend

## Ownership dùng để chia test

Backend chính: Dashboard/admin analytics, audit logs, download logs, reports, subscription/payment APIs và cron. Frontend Payment do Thống test; Dashboard/Admin UI còn lại do Khoa/Thống test. Thiện chịu trách nhiệm tính đúng dữ liệu, quyền API, idempotency và transaction.

## Dữ liệu chuẩn bị

ADMIN-A/B; USER-A/B; user FREE/STUDENT/PRO/expired; ít nhất 35 users/documents/logs/payments; dữ liệu theo ngày/tuần/tháng; invoice PENDING/SUCCESS/FAILED/CANCELLED/expired; payment sandbox và webhook payload hợp lệ/sai/trùng.

## A. Authorization và API contract

| ID            | Pri | Tiền điều kiện                  | Bước test                                       | Kết quả mong đợi                                     | Kết quả |
| ------------- | --- | ------------------------------- | ----------------------------------------------- | ---------------------------------------------------- | ------- |
| THIEN-AUTH-01 | P0  | GUEST                           | Gọi dashboard/reports/audit/download admin APIs | 401, không dữ liệu                                   |         |
| THIEN-AUTH-02 | P0  | USER-A                          | Gọi cùng APIs                                   | 403, không metadata                                  |         |
| THIEN-AUTH-03 | P1  | ADMIN-A                         | Gọi endpoints hợp lệ                            | 2xx envelope/pagination đúng                         |         |
| THIEN-AUTH-04 | P0  | Token hết hạn/admin bị hạ quyền | Gọi lại                                         | Bị chặn kịp thời                                     |         |
| THIEN-API-01  | P1  | Bất kỳ endpoint                 | Gây 400/404/409/429/500                         | Error có code/path/requestId; không stack/SQL/secret |         |
| THIEN-API-02  | P1  | Query pagination                | page 0, limit 0/1/100/101/non-number            | Validation đúng; không 500                           |         |

## B. Dashboard summary và analytics

| ID            | Pri | Tiền điều kiện                            | Bước test                               | Kết quả mong đợi                                         | Kết quả |
| ------------- | --- | ----------------------------------------- | --------------------------------------- | -------------------------------------------------------- | ------- |
| THIEN-DASH-01 | P1  | Seed chuẩn                                | Gọi summary                             | User/document/download/payment totals khớp dữ liệu nguồn |         |
| THIEN-DASH-02 | P1  | Không dữ liệu trong kỳ                    | Gọi summary/statistics                  | Trả 0/array rỗng đúng shape, không null/NaN              |         |
| THIEN-DASH-03 | P1  | Có ACTIVE/SUSPENDED/users                 | Gọi user-stats                          | Breakdown/tổng khớp rule                                 |         |
| THIEN-DASH-04 | P1  | Mix document status/visibility/moderation | Gọi document-stats                      | Không double count; nhóm đúng                            |         |
| THIEN-DASH-05 | P1  | Date boundary                             | from=to, đầu/cuối ngày, tháng, năm      | Inclusive/exclusive và timezone Asia/Saigon đúng         |         |
| THIEN-DASH-06 | P1  | Query sai                                 | from>to, invalid date                   | 400, không truy vấn sai/500                              |         |
| THIEN-DASH-07 | P1  | Upload data                               | period day/week/month                   | Bucket/label/count đúng, không lệch timezone             |         |
| THIEN-DASH-08 | P1  | Subjects/categories                       | Gọi documents-by-subject/category       | Tổng breakdown khớp document hợp lệ                      |         |
| THIEN-DASH-09 | P1  | Soft-deleted/hidden/rejected docs         | Gọi analytics                           | Bao gồm/loại đúng quy tắc thống nhất                     |         |
| THIEN-DASH-10 | P1  | Data lớn                                  | Chạy endpoints nhiều lần/đồng thời      | Thời gian chấp nhận; không query nổ/timeout              |         |
| THIEN-DASH-11 | P1  | Mutation mới                              | Upload/download/status change rồi query | Số liệu cập nhật một lần, không stale/double count       |         |
| THIEN-DASH-12 | P1  | DB error                                  | Gọi endpoint                            | Controlled 500; không partial/wrong totals               |         |

## C. Reports

| ID           | Pri | Tiền điều kiện                  | Bước test                 | Kết quả mong đợi                               | Kết quả |
| ------------ | --- | ------------------------------- | ------------------------- | ---------------------------------------------- | ------- |
| THIEN-REP-01 | P1  | Download data                   | Most-downloaded           | Thứ tự/count đúng; tie ổn định                 |         |
| THIEN-REP-02 | P1  | Saved data                      | Most-saved                | Count khớp SavedDocument hợp lệ                |         |
| THIEN-REP-03 | P1  | Upload data                     | Upload-statistics         | Tổng/bucket đúng với dashboard cùng rule       |         |
| THIEN-REP-04 | P1  | Date filter                     | Boundary và invalid range | Đúng timezone/validation                       |         |
| THIEN-REP-05 | P1  | limit                           | 1/100/0/101               | Chỉ 1–100; sai 400                             |         |
| THIEN-REP-06 | P1  | Document deleted/private/hidden | Query report              | Không lộ metadata trái policy; count theo rule |         |
| THIEN-REP-07 | P1  | Cùng count                      | Gọi lặp                   | Order deterministic, pagination không nhảy     |         |
| THIEN-REP-08 | P0  | USER-A                          | Gọi report admin          | 403                                            |         |

## D. Audit log

| ID           | Pri | Tiền điều kiện               | Bước test                                     | Kết quả mong đợi                                 | Kết quả |
| ------------ | --- | ---------------------------- | --------------------------------------------- | ------------------------------------------------ | ------- |
| THIEN-AUD-01 | P1  | Admin status change          | Kiểm tra audit                                | Actor/action/target/before-after/timestamp đúng  |         |
| THIEN-AUD-02 | P1  | Approve/reject/hide document | Kiểm tra audit                                | Đúng admin/document/reason/result                |         |
| THIEN-AUD-03 | P1  | Mutation thất bại/rollback   | Kiểm tra log                                  | Không ghi success giả; attempt/failure phân biệt |         |
| THIEN-AUD-04 | P1  | Hai admin đồng thời          | Mutation cùng target                          | Log đủ actor/thứ tự; không overwrite             |         |
| THIEN-AUD-05 | P1  | Target đã xóa                | Query log                                     | Log vẫn đọc, target marked unavailable           |         |
| THIEN-AUD-06 | P1  | 35+ logs                     | Filter actor/action/date/page                 | Không trùng/mất; tổng đúng                       |         |
| THIEN-AUD-07 | P0  | Inspect payload              | Tìm token/password/Firebase/R2/webhook secret | Không có dữ liệu nhạy cảm                        |         |
| THIEN-AUD-08 | P0  | USER-A                       | Gọi audit API                                 | 403, không lộ hành vi                            |         |

## E. Download log

| ID          | Pri | Tiền điều kiện                   | Bước test                  | Kết quả mong đợi                                                     | Kết quả |
| ----------- | --- | -------------------------------- | -------------------------- | -------------------------------------------------------------------- | ------- |
| THIEN-DL-01 | P1  | USER-A download thành công       | Query log                  | Một record đúng user/document/time                                   |         |
| THIEN-DL-02 | P1  | Preview hoặc download lỗi        | Query log/count            | Không ghi download success sai                                       |         |
| THIEN-DL-03 | P1  | Double-click/retry               | Query log/count            | Theo đúng định nghĩa một download nghiệp vụ; không count request lỗi |         |
| THIEN-DL-04 | P1  | GUEST/public download nếu hỗ trợ | Query log                  | Actor/anonymous rule đúng                                            |         |
| THIEN-DL-05 | P1  | Document bị xóa sau download     | Query log/report           | Log không crash; metadata an toàn                                    |         |
| THIEN-DL-06 | P1  | 35+ logs                         | Filter/date/page           | Tổng/order/timezone đúng                                             |         |
| THIEN-DL-07 | P0  | USER-A                           | Gọi admin download-log API | 403                                                                  |         |
| THIEN-DL-08 | P1  | Concurrent downloads             | Gọi đồng thời              | Không lost update hoặc count sai do race                             |         |

## F. Subscription plans/current và cron

| ID           | Pri | Tiền điều kiện           | Bước test                               | Kết quả mong đợi                                       | Kết quả |
| ------------ | --- | ------------------------ | --------------------------------------- | ------------------------------------------------------ | ------- |
| THIEN-SUB-01 | P1  | GUEST                    | Gọi plans                               | Public theo contract; giá/quyền lợi đúng               |         |
| THIEN-SUB-02 | P1  | FREE/STUDENT/PRO         | Gọi current                             | Plan/status/start/end đúng user                        |         |
| THIEN-SUB-03 | P0  | USER-A/B                 | USER-A truy vấn/sửa subscription USER-B | Không thể; scope token                                 |         |
| THIEN-SUB-04 | P1  | STUDENT còn hạn          | Upgrade PRO                             | Tính phần chênh lệch; khi success giữ expiry theo rule |         |
| THIEN-SUB-05 | P1  | PRO                      | Checkout STUDENT                        | 409/blocked, không downgrade                           |         |
| THIEN-SUB-06 | P1  | Paid active              | Chuyển FREE thủ công                    | Bị chặn; Free chỉ khi hết hạn theo rule                |         |
| THIEN-SUB-07 | P1  | Subscription vừa hết hạn | Chạy cron/đọc current                   | Activate FREE một lần; timestamp/audit đúng            |         |
| THIEN-SUB-08 | P1  | Cron chạy lặp/đồng thời  | Trigger nhiều lần                       | Idempotent; không tạo nhiều subscription transition    |         |
| THIEN-SUB-09 | P1  | Boundary expiry/timezone | Trước/đúng/sau expiresAt                | Chuyển đúng thời điểm, không sớm/muộn do timezone      |         |

## G. Checkout và payment state machine

| ID           | Pri | Tiền điều kiện                   | Bước test                              | Kết quả mong đợi                                                   | Kết quả |
| ------------ | --- | -------------------------------- | -------------------------------------- | ------------------------------------------------------------------ | ------- |
| THIEN-PAY-01 | P1  | USER-A                           | Checkout STUDENT/PRO với method hợp lệ | Amount server tính; invoice unique; expiry đúng                    |         |
| THIEN-PAY-02 | P0  | DevTools/API                     | Gửi plan/method/amount sai             | Validate/tự tính; không mua giá giả                                |         |
| THIEN-PAY-03 | P1  | Double request                   | Checkout đồng thời                     | Trả/reuse một pending session theo rule 2 phút                     |         |
| THIEN-PAY-04 | P1  | Pending còn hạn                  | Checkout lại                           | Resume cùng invoice/session                                        |         |
| THIEN-PAY-05 | P1  | Pending hết hạn                  | Checkout lại                           | Không reuse session hết hạn; state cũ rõ                           |         |
| THIEN-PAY-06 | P0  | Invoice USER-B                   | USER-A detail/update                   | 403/404                                                            |         |
| THIEN-PAY-07 | P1  | Payment history 35+              | Page/detail/filter                     | Chỉ payment user; tổng/order đúng                                  |         |
| THIEN-PAY-08 | P1  | PENDING                          | Update FAILED/CANCELLED                | Chỉ transition cho phép; subscription không đổi                    |         |
| THIEN-PAY-09 | P0  | SUCCESS                          | Thử chuyển ngược FAILED/CANCELLED      | Bị chặn; subscription không rollback sai                           |         |
| THIEN-PAY-10 | P1  | DB lỗi giữa payment/subscription | Gây lỗi                                | Transaction rollback; không SUCCESS mà chưa có plan hoặc ngược lại |         |

## H. SePay webhook/IPN và idempotency

| ID           | Pri | Tiền điều kiện                            | Bước test                             | Kết quả mong đợi                                   | Kết quả |
| ------------ | --- | ----------------------------------------- | ------------------------------------- | -------------------------------------------------- | ------- |
| THIEN-IPN-01 | P0  | Pending + payload hợp lệ                  | Gửi đúng invoice/amount/content       | SUCCESS một lần; activate đúng plan                |         |
| THIEN-IPN-02 | P0  | Đã SUCCESS                                | Gửi lại cùng event nhiều lần          | Idempotent; không cộng plan/thời hạn/record        |         |
| THIEN-IPN-03 | P0  | Pending                                   | Gửi hai webhook đồng thời             | Lock/transaction; chỉ apply một lần                |         |
| THIEN-IPN-04 | P0  | Pending                                   | Amount thiếu/thừa/sai invoice/content | Không activate nhầm                                |         |
| THIEN-IPN-05 | P0  | Webhook auth có cấu hình                  | Thiếu/sai secret/signature            | Từ chối; không đổi state                           |         |
| THIEN-IPN-06 | P1  | Success xử lý xong nhưng response timeout | Provider retry                        | Trả trạng thái đã xử lý, không duplicate           |         |
| THIEN-IPN-07 | P0  | Hai pending invoices                      | Thanh toán một invoice                | Chỉ invoice/plan tương ứng đổi                     |         |
| THIEN-IPN-08 | P1  | Event đến sai thứ tự                      | Cancel/fail/success sequence          | State machine không chuyển ngược trái phép         |         |
| THIEN-IPN-09 | P0  | Inspect logs                              | Kiểm tra payload/error                | Không log secret/dữ liệu ngân hàng nhạy cảm đầy đủ |         |

## Flow E2E bắt buộc

1. Upload/download thực tế → download log → dashboard/report count tăng đúng một.
2. Admin moderation/status change → audit log đúng actor/before-after.
3. FREE → checkout STUDENT → IPN success → current/history/dashboard cập nhật.
4. STUDENT → PRO phần chênh lệch → giữ expiry; webhook lặp không cộng thêm.
5. Subscription hết hạn → cron chuyển FREE đúng một lần.

## Điều kiện hoàn thành

- [ ] 100% P0/P1 đã chạy.
- [ ] Mọi số liệu được đối chiếu DB/seed, không chỉ nhìn UI.
- [ ] Payment state/ownership/idempotency/transaction đều PASS.
- [ ] Audit/download logs không ghi success giả hoặc secret.
- [ ] FE Thống/Khoa hiển thị đúng contract sau regression.

## Mẫu bug

`[THIEN][PAYMENT][P0] Hai IPN đồng thời cộng thời hạn subscription hai lần`
