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

Thêm vào `.env` (xem `.env.example`):

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

## Lưu ý

- Tài khoản chỉ Google không có mật khẩu local — đổi mật khẩu bị ẩn trên form hồ sơ.
- Menu **Nhân viên** vẫn chỉ dành cho **owner**.
- App chưa hỗ trợ mời user vào shop cụ thể — user Google mới gia nhập shop demo mặc định (`shop1`).
