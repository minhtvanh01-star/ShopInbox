# Đăng ký email — mã OTP qua Gmail

Khi đăng ký bằng email/mật khẩu, ShopInbox gửi **mã 6 số** tới Gmail. User nhập mã mới tạo tài khoản.

## Cấu hình Gmail (khuyến nghị)

1. Bật [Xác minh 2 bước](https://myaccount.google.com/security) cho tài khoản Gmail gửi thư.
2. Tạo [Mật khẩu ứng dụng](https://myaccount.google.com/apppasswords) (App Password) — 16 ký tự.
3. Thêm vào `.env` (local) hoặc Railway Variables:

```env
GMAIL_USER=ban@gmail.com
GMAIL_APP_PASSWORD=xxxx xxxx xxxx xxxx
# tùy chọn:
# SMTP_FROM="ShopInbox <ban@gmail.com>"
```

Hoặc SMTP tường minh:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=ban@gmail.com
SMTP_PASS=xxxx-app-password
SMTP_FROM="ShopInbox <ban@gmail.com>"
```

4. Restart `npm run dev` / Deploy Railway.
5. Chạy migration: `npx prisma migrate deploy`

## Luồng

1. `/register` → điền họ tên, email, mật khẩu → **Gửi mã xác thực**
2. Kiểm tra Gmail (và Spam) → nhập mã 6 số
3. Tạo `staff` + đăng nhập

Mã hết hạn sau **10 phút**, gửi lại tối thiểu **60 giây**, tối đa **5 lần** nhập sai.

## Dev không gửi mail thật

```env
EMAIL_OTP_DEV_LOG=1
```

Nếu chưa cấu hình SMTP mà bật `EMAIL_OTP_DEV_LOG=1`, mã in ra console server (không gửi Gmail). Production vẫn cần SMTP thật.
