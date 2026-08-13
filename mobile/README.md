# DocuMind Mobile (Flutter)

Ứng dụng Flutter iOS dùng chung backend NestJS và Firebase Authentication với
phiên bản web. Đây là ứng dụng Flutter native, không phải WebView.

## Kiến trúc

- `lib/core`: Firebase options và REST client có Bearer token.
- `lib/features/auth`: đăng nhập Firebase và đồng bộ tài khoản backend.
- `lib/features/home`: dashboard và điều hướng mobile.
- `lib/features/documents`: danh sách/chọn tài liệu tải lên.
- `lib/features/chat`: hỏi đáp AI trên thư viện.
- `lib/features/profile`: tài khoản và đăng xuất.

## Cấu hình

Sao chép file mẫu (file thật đã được Git ignore):

```bash
cp config.example.json config.json
```

Điền Firebase iOS App ID lấy từ Firebase Console. Các giá trị Firebase client
không phải server secret; tuyệt đối không đưa Firebase Admin private key,
DATABASE_URL, R2 secret hoặc Gemini key vào ứng dụng.

Bundle ID iOS hiện tại là `icu.documind.mobile`. Hãy đăng ký đúng Bundle ID này
trong Firebase Console, tải `GoogleService-Info.plist` nếu cần dùng thêm plugin
native, và thêm iOS app vào cùng Firebase project của phiên bản web.

Trong Firebase Console: Project settings → Your apps → Add app → iOS → nhập
`icu.documind.mobile`. Sao chép giá trị `GOOGLE_APP_ID` trong file tải về vào
`FIREBASE_IOS_APP_ID` của `config.json`; các giá trị còn lại có thể đối chiếu
với `frontend/fe.env`. Không dùng `NEXT_PUBLIC_FIREBASE_APP_ID` của web cho
`FIREBASE_IOS_APP_ID`.

## Chạy trên iPhone

Flutter SDK cục bộ nằm trong `.tools/` và không được commit:

```bash
cd /Users/alexxxx/Desktop/Documind/mobile
../.tools/flutter-sdk/flutter/bin/flutter pub get
../.tools/flutter-sdk/flutter/bin/flutter run \
  --dart-define-from-file=config.json
```

Kết nối iPhone 15 Pro, bật Developer Mode, rồi chọn thiết bị khi Flutter hỏi.

## Build và xuất IPA

```bash
../.tools/flutter-sdk/flutter/bin/flutter build ipa \
  --release \
  --dart-define-from-file=config.json
```

Nếu cần điều chỉnh signing, mở:

```bash
open ios/Runner.xcworkspace
```

Trong Xcode chọn target Runner → Signing & Capabilities → Team, sau đó Product
→ Archive → Distribute App. Với tài khoản Apple miễn phí, nên cài lại ngay trước
buổi bảo vệ vì provisioning cá nhân hết hạn sau 7 ngày.

## Kiểm tra chất lượng

```bash
../.tools/flutter-sdk/flutter/bin/flutter analyze
../.tools/flutter-sdk/flutter/bin/flutter test
```
