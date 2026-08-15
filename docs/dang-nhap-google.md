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

Mở `/login` → **Đăng nhập với Google**, hoặc `/register` → **Đăng ký với Google**.

Bảo mật OAuth:

- Authorization code + **PKCE (S256)** + `client_secret`.
- `state` JWT httpOnly cookie phải khớp query; `nonce` phải khớp `id_token`.
- Xác minh `id_token` (chữ ký Google JWKS, `iss`, `aud`, `exp`) — không tin userinfo một mình.
- Chỉ chấp nhận email Google đã `email_verified`.
- **Không tự liên kết** tài khoản mật khẩu với Google. Liên kết chỉ từ **Hồ sơ** khi đã đăng nhập.
- Đăng nhập Google chỉ mở tài khoản đã có `googleId`. Tài khoản mới phải **đăng ký** (`mode=register`).
- Token Google **không** lưu lâu dài — chỉ lấy identity, lưu `googleId` + ảnh/email.

## 4. Liên kết từ hồ sơ

Đã đăng nhập bằng email/mật khẩu → **Hồ sơ cá nhân** → **Liên kết Google**.

## 5. Đăng ký

Trang `/register` (link **Chưa có tài khoản? Đăng ký** trên `/login`):

### Google

- Nút **Đăng ký với Google** → `/api/auth/google/start?mode=register`.
- Email Google chưa xác minh, hoặc email/googleId đã có trong `staff` → từ chối (không chiếm tài khoản).
- User đầu tiên → `admin` + tạo shop `shop1`; user sau → `staff` vào `shop1`.
- Audit: `auth.register` (`method: google`) rồi `auth.login`.

### Email / mật khẩu

- Validate: họ tên bắt buộc, email hợp lệ, mật khẩu ≥ 8 ký tự, xác nhận khớp.
- Email đã tồn tại (kể cả tài khoản chỉ Google) → từ chối.
- **User đầu tiên** trong DB → vai trò `admin`; tạo shop `shop1` nếu chưa có.
- **User sau** → vai trò `staff`, gia nhập shop mặc định `shop1`.
- Sau đăng ký: set cookie session và chuyển `/inbox`.
- Audit: `auth.register`.

**Hạn chế:** đăng ký mở không chọn shop; không tự tạo thêm `admin` sau user đầu tiên. Mời nhân viên có kiểm soát vẫn dùng menu **Nhân viên**.

## Lưu ý

- Tài khoản chỉ Google không có mật khẩu local — đổi mật khẩu bị ẩn trên form hồ sơ.
- Menu **Nhân viên** vẫn chỉ dành cho **owner**.
- App chưa hỗ trợ mời user vào shop cụ thể — user Google / đăng ký mở mới gia nhập shop demo mặc định (`shop1`).
