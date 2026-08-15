# Đăng nhập Google (OAuth 2.0)

Hướng dẫn cấu hình **Đăng nhập với Google** cho ShopInbox.

## 1. Tạo OAuth Client trên Google Cloud Console

1. Mở [Google Cloud Console](https://console.cloud.google.com/) → chọn hoặc tạo project.
2. **APIs & Services** → **OAuth consent screen**:
   - User type: **External** (hoặc Internal nếu dùng Google Workspace).
   - Điền tên app, email hỗ trợ, domain (tuỳ chọn khi dev).
   - Scopes: thêm `openid`, `email`, `profile` (hoặc để mặc định qua flow).
3. **Credentials** → **Create Credentials** → **OAuth client ID**:
   - Application type: **Web application**
   - **Authorized redirect URIs**:
     - Dev: `http://localhost:3000/api/auth/google/callback`
     - Production: `https://<domain-cua-ban>/api/auth/google/callback`
4. Copy **Client ID** và **Client secret**.

## 2. Biến môi trường

Checklist tổng hợp: [env-checklist.md](./env-checklist.md). Thêm vào `.env` (xem `.env.example`):

```
GOOGLE_CLIENT_ID=<client-id>
GOOGLE_CLIENT_SECRET=<client-secret>
GOOGLE_REDIRECT_URI=http://localhost:3000/api/auth/google/callback
```

`GOOGLE_REDIRECT_URI` phải khớp chính xác URI đã đăng ký trên Google Cloud.

## 3. Chạy local

```powershell
npm run dev
```

Mở `/login` → bấm **Đăng nhập với Google**.

- Email đã có trong bảng `staff` → đăng nhập (tự liên kết `googleId` nếu trước đó chỉ có mật khẩu).
- Email mới → tạo tài khoản `staff` (chủ shop nếu DB chưa có nhân viên nào).
- Token Google **không** lưu lâu dài — chỉ dùng lấy profile, lưu `googleId` + ảnh/email.

## 4. Liên kết từ hồ sơ

Đã đăng nhập bằng email/mật khẩu → **Hồ sơ cá nhân** → **Liên kết Google**.

## 5. Đăng ký email / mật khẩu

Trang `/register` (link **Chưa có tài khoản? Đăng ký** trên `/login`):

- Validate: họ tên bắt buộc, email hợp lệ, mật khẩu ≥ 8 ký tự, xác nhận khớp.
- Email đã tồn tại (kể cả tài khoản chỉ Google) → từ chối.
- **User đầu tiên** trong DB → vai trò `admin`; tạo shop `shop1` nếu chưa có.
- **User sau** → vai trò `staff`, gia nhập shop mặc định `shop1` (giống Google signup mở).
- Sau đăng ký: set cookie session và chuyển `/inbox`.
- Audit: `auth.register`.

**Hạn chế:** đăng ký mở không chọn shop; không tự tạo thêm `admin` sau user đầu tiên. Mời nhân viên có kiểm soát vẫn dùng menu **Nhân viên**.

## Lưu ý

- Tài khoản chỉ Google không có mật khẩu local — đổi mật khẩu bị ẩn trên form hồ sơ.
- Menu **Nhân viên** vẫn chỉ dành cho **owner**.
- App chưa hỗ trợ mời user vào shop cụ thể — user Google / đăng ký mở mới gia nhập shop demo mặc định (`shop1`).
