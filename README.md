# ShopInbox

Web app inbox đa kênh cho cửa hàng: gom tin nhắn, trả lời, lưu đơn hàng.

Hiện tại: **Lát 1** (UI mock) + **Lát 2 DB** (PostgreSQL qua Docker + Prisma + dữ liệu mẫu). Chưa nối Facebook / Zalo / Instagram thật.

## Yêu cầu

- Node.js 20+
- Docker Desktop đang chạy (chỉ cần nền — làm việc bằng lệnh, không cần vào màn Containers)

## 1. Bật database (Docker bằng lệnh)

Trong PowerShell:

```powershell
cd E:\project_job\ShopInbox
docker compose up -d
docker compose ps
```

Postgres chạy ở cổng **5433** (tránh trùng Postgres sẵn có trên 5432).

Các lệnh hay dùng:

```powershell
docker compose logs -f db   # xem log (Ctrl+C thoát)
docker compose stop         # tạm dừng
docker compose start        # chạy lại
docker compose down         # tắt container (giữ dữ liệu)
```

## 2. Cài package + tạo bảng + seed

```powershell
npm install
npx prisma migrate dev
npx prisma db seed
```

Hoặc:

```powershell
npm run db:up
npm run db:migrate
npm run db:seed
```

## 3. Kiểm tra dữ liệu

```powershell
npx prisma studio
```

Mở [http://localhost:5555](http://localhost:5555) — xem bảng `Customer`, `Conversation`, `Message`, `Order`, …

## 4. Chạy app (UI vẫn dùng mock cho đến lát nối UI)

```powershell
npm run dev
```

Mở [http://localhost:3000](http://localhost:3000), bấm **Vào cửa hàng demo**.

## Biến môi trường

Copy từ `.env.example` nếu chưa có `.env`:

```
DATABASE_URL="postgresql://shopinbox:shopinbox@localhost:5433/shopinbox"
```

Không commit file `.env`.
