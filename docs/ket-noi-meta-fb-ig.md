# Đọc hiểu: kết nối Facebook & Instagram

Cập nhật: 24/09/2026

Tài liệu này dành cho người **ngồi đọc hết một lần** rồi mới mở Meta Developers / ShopInbox. Mục tiêu: hiểu mô hình, làm đúng thứ tự, biết chỗ nào hay lệch.

- Use case nghiệp vụ: [UC-CH-01_ket-noi-facebook-instagram.md](./UC-CH-01_ket-noi-facebook-instagram.md)
- Tổng các kênh (gồm Zalo): [ket-noi-kenh.md](./ket-noi-kenh.md)
- Biến môi trường: [env-checklist.md](./env-checklist.md)

---

## 1. Bạn cần nhớ 5 ý

1. **Một Meta App** phục vụ cả Facebook Messenger và Instagram DM.
2. Instagram **không đứng một mình**. Phải có Fanpage đã gắn Instagram Professional / Business.
3. ShopInbox xin quyền **Page** (`pages_show_list`, `pages_messaging`, `pages_manage_metadata`). Không xin các scope IG kiểu `instagram_basic` / `instagram_manage_messages` — Meta hay từ chối trên nhiều app.
4. **Kênh “Đã nối”** chỉ nghĩa là đã lưu Page token. **Inbox có tin** còn phụ thuộc webhook Meta gọi được vào server.
5. Meta **bắt HTTPS công khai**. `localhost` thuần gần như không dùng được cho OAuth/webhook. Local thì ngrok (hoặc tunnel tương đương).

Nếu chỉ nhớ được một câu: *nối xong mà Inbox trống = webhook / hostname / Roles app, không phải “OAuth hỏng”.*

---

## 2. Facebook khác Instagram chỗ nào?

| | Facebook Messenger | Instagram DM |
|--|--------------------|--------------|
| Đối tượng nối | Một Fanpage | Cùng Fanpage đó, nhưng Page phải có `instagram_business_account` |
| Trong ShopInbox | **Cài đặt → Thêm kết nối → Facebook** | **… → Instagram** |
| OAuth | Chung Meta Login + cùng 3 scope Page | Cùng luồng, server lọc Page **có IG gắn** |
| Nếu không có Page / IG | Lỗi `meta_no_pages` | Lỗi `meta_no_instagram` |
| Webhook | Object `page` + Page `subscribed_apps` | Cùng webhook page; dashboard Meta đôi khi còn bước IG messaging |
| Gửi sau 24h kể từ tin khách | Thử thẻ `HUMAN_AGENT` (≤ 7 ngày, cần App Review) | **Không** retry Human Agent — phải đợi khách nhắn lại |

Hai kênh lưu **hai dòng** `channel_accounts` (`facebook` / `instagram`). Có thể nối Facebook trước, Instagram sau — miễn cùng kiểu Page hợp lệ.

---

## 3. Hai tầng: OAuth và webhook

```text
Chủ shop bấm Kết nối
        ↓
Facebook Login (cấp quyền Page)
        ↓
Callback ShopInbox đổi code → token dài hạn → chọn Page
        ↓
Lưu channel_accounts  status = ready     ← tầng 1: “Đã nối”
        ↓
Đăng ký webhook app + page (tự hoặc tay)
        ↓
Khách nhắn → Meta POST /api/webhooks/meta
        ↓
Inbox có hội thoại                          ← tầng 2: “Nhận tin”
```

| Tầng | Thành công khi | Thất bại thì thấy |
|------|----------------|-------------------|
| OAuth | Cài đặt hiện **Đã nối**, có tên Page / @IG | URL `oauth_error=…` |
| Webhook | `lastWebhookAt` / “Webhook gần nhất” đổi sau khi khách nhắn | Cài đặt xanh, Inbox trống |

Gửi tin từ Inbox dùng token đã lưu, **không** cần webhook cho chiều shop → khách. Nhưng nếu chưa nhận được tin khách, composer thường không có hội thoại để trả lời.

---

## 4. Chuẩn bị Meta App (làm một lần)

Làm trên [Meta for Developers](https://developers.facebook.com/) → **My Apps** → **Create App**.

Giao diện hay đổi. **Không** tìm nút to tên “Business” rồi chịu. Làm theo màn hình đang hiện:

### 4.1. Tạo app — hai nhánh

**Nhánh A (thường gặp 2025/2026):** trang hỏi *What do you want your app to do?*

1. Chọn **Engage with customers on Messenger from Meta** (VI: *Tương tác với khách hàng trên Messenger từ Meta*).
2. **Không** chọn *Authenticate and request data from users with Facebook Login* (login user, không phải inbox Page).
3. Instagram: **không bắt buộc** chọn *Manage messaging & content on Instagram* — ShopInbox lấy DM qua Fanpage đã gắn IG.
4. Next → tên app `ShopInbox` → email liên hệ → **Create app**.

**Nhánh B (wizard cũ):** thấy ô Consumer / Business / Gaming

1. Chọn **Business** (Doanh nghiệp). Không chọn Consumer.
2. Tạo xong → **Add products** → Set up **Messenger** + **Facebook Login for Business**.

Đúng khi bạn đang ở **App Dashboard** (menu trái: Dashboard, Settings, Facebook Login…).

Chi tiết từng nút: file Word `docs/Huong-dan-ket-noi-Facebook-va-Instagram.docx`.

### 4.2. Copy App ID / Secret

**Settings → Basic**: copy **App ID**, **App Secret**.

### 4.2. Khai báo miền (hay quên)

Trên **Thông tin cơ bản**:

- **Miền ứng dụng:** chỉ hostname, không có `https://`  
  Ví dụ: `app.example.com` hoặc `xxxx.ngrok-free.app`.
- Thêm nền tảng **Website** → URL = `https://<hostname>/`

Sai mục này → Facebook báo *“Miền của URL này không được đưa vào miền của ứng dụng”* trước khi về ShopInbox.

### 4.3. Redirect OAuth

**Đăng nhập bằng Facebook → Cài đặt → Valid OAuth Redirect URIs** — dán **đúng từng ký tự**:

```text
https://<hostname>/api/connect/meta/callback
```

Local và production là **hai URI**. Dùng song song thì thêm cả hai.

### 4.4. Webhook trên dashboard

Khi ShopInbox không tự subscribe được (note kênh sẽ bảo):

1. Messenger → Settings → Webhooks.
2. Callback: `https://<hostname>/api/webhooks/meta`
3. Verify token: đúng `META_WEBHOOK_VERIFY_TOKEN` trong `.env`.
4. Subscribe object `page`, fields tối thiểu:

   - `messages`
   - `messaging_postbacks`
   - `message_deliveries`
   - `message_reads`
   - `message_reactions`

5. Gắn đúng **Page** đã chọn trong ShopInbox.
6. Instagram: kiểm thêm phần Instagram messaging / Page liên kết trên dashboard nếu DM vẫn không vào.

GET verify dùng verify token. POST inbound **bắt buộc** header `X-Hub-Signature-256` khớp `META_APP_SECRET` — sai/thiếu thì server từ chối, Inbox không có tin.

---

## 5. Biến môi trường ShopInbox

```env
META_APP_ID=
META_APP_SECRET=
META_WEBHOOK_VERIFY_TOKEN=chuoi-ban-tu-dat
NEXT_PUBLIC_APP_URL=https://<hostname>
# META_REDIRECT_URI=   ← để trống cũng được; app tự ghép .../api/connect/meta/callback
```

Quy tắc:

- `NEXT_PUBLIC_APP_URL` phải là URL **đang mở trên trình duyệt** (HTTPS khi nối Meta).
- Nếu `META_REDIRECT_URI` còn `localhost` trong khi app đã lên domain thật, code **ưu tiên** URL public.
- Nút OAuth trong Cài đặt **chỉ bật** khi đủ `META_APP_ID` + `META_APP_SECRET`.
- Sửa env xong phải **restart** `npm run dev` (hoặc redeploy).

Danh sách biến: [env-checklist.md](./env-checklist.md), mẫu: `.env.example`.

---

## 6. Nối kênh trong ShopInbox

**Quyền:** chủ shop / role có `channels.connect`.

1. Đăng nhập → **Cài đặt → Thêm kết nối**.
2. Chọn **Facebook** hoặc **Instagram**.
3. Bấm **Kết nối với Facebook / Instagram**.
4. Cấp quyền trên Facebook (đừng hủy).
5. Nếu **một** Page hợp lệ: hệ thống lưu luôn, về Cài đặt kèm thành công.
6. Nếu **nhiều** Page: modal chọn một trang rồi mới lưu.
7. Đọc **ghi chú kênh**: webhook app/page OK hay phải dán tay trên Meta.
8. (Tuỳ chọn) nút **Đồng bộ tin nhắn** để kéo vài hội thoại gần đây.

Luồng kỹ thuật (nếu cần lần theo code): start `/api/connect/meta/start` → callback `/api/connect/meta/callback` → `meta-oauth.ts` đổi token + list Page → `channel-connect.ts` lưu + thử subscribe webhook.

State OAuth sống khoảng **15 phút**, gắn cookie. Mở nhiều tab, chặn cookie, hoặc để quá lâu rồi mới cấp quyền → `meta_state`. Bấm nối lại **cùng một tab**.

---

## 7. Instagram — checklist riêng

Làm **trước** khi bấm nối kênh Instagram:

1. Tài khoản IG chuyển **Professional** (Business hoặc Creator).
2. Trong Meta Business Suite / Page settings: **liên kết IG với đúng Fanpage** sẽ chọn.
3. User Facebook dùng để OAuth phải là **admin Page** (đủ messaging).
4. App Development: người nhắn thử từ IG phải nằm trong **Roles** của Meta App (admin / developer / tester), giống Messenger.

Trong callback, ShopInbox gọi Graph:

```text
id,name,access_token,instagram_business_account{id,username}
```

Không thấy `instagram_business_account` → `meta_no_instagram`. Sửa link Page–IG rồi nối lại, đừng tạo Meta App thứ hai.

Sau khi nối: kênh Instagram hiện username IG; `linkedPageId` trỏ về Fanpage. Webhook vẫn đi path `/api/webhooks/meta` — map theo Page / IG id đã lưu.

---

## 8. Local với ngrok

```bash
# Terminal 1
npm run dev

# Terminal 2
ngrok http 3000
```

1. Copy `https://….ngrok-free.app` vào `NEXT_PUBLIC_APP_URL`.
2. Thêm hostname ngrok vào App Domains + Website URL trên Meta.
3. Thêm Redirect URI `https://….ngrok-free.app/api/connect/meta/callback`.
4. Restart `npm run dev`.
5. Nối kênh trong Cài đặt (mở app **qua URL ngrok**, không qua `http://localhost:3000` nếu redirect đã là ngrok).
6. Verify webhook bằng cùng hostname.
7. Nick tester nhắn Page / IG → F5 Inbox.

Mỗi lần restart ngrok ra subdomain mới: sửa `.env` + App Domains + Redirect + Webhook. Production dùng domain cố định cho đỡ làm lại.

---

## 9. Development vs Live

| Chế độ Meta App | Ai nhắn / nhận được |
|-----------------|---------------------|
| **Development** | Chỉ tài khoản trong Roles của app |
| **Live** | User thật — thường cần **App Review** đúng quyền messaging |

OAuth “xanh” nhưng chỉ một số người nhắn vào Inbox được → gần như chắc app còn Development và người nhắn không thuộc Roles.

Go-live thật: App Review + Live + domain cố định + webhook verified. Checklist ops tổng: [yeu-cau-he-thong.md](./yeu-cau-he-thong.md).

---

## 10. Cửa sổ 24 giờ (gửi tin)

Composer Inbox ước lượng theo tin khách gần nhất (cảnh báo trước). Lỗi Graph khi bấm gửi vẫn là nguồn đúng.

| Kênh | Trong 24h sau tin khách | Sau 24h |
|------|-------------------------|---------|
| Facebook | Gửi `RESPONSE` bình thường | ShopInbox thử `HUMAN_AGENT` (≤ 7 ngày). Chưa Advanced Access thì Meta từ chối — UI báo rõ. |
| Instagram | Gửi `RESPONSE` bình thường | Không dùng Human Agent. Banner: cần khách nhắn lại. |

---

## 11. Checklist end-to-end (tick theo thứ tự)

### Môi trường

- [ ] App đang chạy (`npm run dev` hoặc process production)
- [ ] Có HTTPS public (ngrok nếu local)
- [ ] `NEXT_PUBLIC_APP_URL` = đúng URL đang mở
- [ ] Đã restart sau khi đổi env / đổi URL tunnel

### Meta Developers

- [ ] App Domains + Website URL khớp hostname
- [ ] Valid OAuth Redirect URI khớp callback
- [ ] `META_APP_SECRET` đúng App Secret
- [ ] Webhook GET verify thành công (Meta báo verified)
- [ ] Development: người nhắn thử nằm trong Roles
- [ ] User OAuth là admin Page
- [ ] Instagram: IG Professional đã link đúng Fanpage

### Trong ShopInbox

- [ ] Login tài khoản có `channels.connect`
- [ ] Nút OAuth không bị khóa vì thiếu env
- [ ] Kết nối xong không còn `oauth_error=` trên URL Cài đặt
- [ ] Kênh **Đã nối**, đúng tên Page / @IG
- [ ] Note webhook: tự OK hoặc đã làm tay mục 4.4
- [ ] Tester nhắn → Inbox có hội thoại (`lastWebhookAt` đổi)
- [ ] Trả lời từ Inbox → khách nhận trên Messenger / IG

Một bước đỏ thì sửa bước đó. Đừng nhảy sang auto-reply khi Inbox còn trống.

---

## 12. Bảng lỗi thường gặp

### Trên URL Cài đặt (`oauth_error=…`)

| Mã | Ý nghĩa | Việc nên làm |
|----|---------|--------------|
| `meta_not_configured` | Thiếu env Meta | Điền `META_APP_ID`, `META_APP_SECRET`, restart |
| `meta_denied` | Hủy cấp quyền trên Facebook | Kết nối lại, bấm Cho phép |
| `meta_state` | Cookie / state hết hạn hoặc bị chặn | Một tab, cho cookie, nối lại trong ~15 phút |
| `meta_invalid` | Callback thiếu `code` / `state` | Kiểm tra Redirect URI từng ký tự |
| `meta_no_pages` | Không lấy được Fanpage | Account phải là admin Page |
| `meta_no_instagram` | Page không có IG Business | Liên kết IG Professional rồi nối kênh Instagram lại |
| `meta_failed` | Lỗi Graph (`oauth_message`) | Sai secret, app khóa, thiếu quyền, hoặc URI/domain |

### Ngoài app

| Hiện tượng | Nguyên nhân hay gặp | Cách xử |
|------------|---------------------|---------|
| “Miền URL không nằm trong miền ứng dụng” | Chưa khai App Domains / Website | Thêm hostname, Save |
| Redirect URI không được phép | URI Meta ≠ URI app đang dùng | Copy từ `NEXT_PUBLIC_APP_URL` + `/api/connect/meta/callback` |
| OAuth OK, Inbox trống | Webhook / subscribe / sai hostname / Roles | Mục 3, 4.4, 11; xem `lastWebhookAt` |
| «Ứng dụng không hoạt động» khi bấm Kết nối | App còn Development; nick Facebook không có trong Roles | Meta Developers → App roles → Add Testers (đúng email nick đó). Muốn mọi nick nối/nhắn được thì Live + App Review |
| Chỉ vài người nhắn / đồng bộ được | App Development | Thêm tester hoặc Live + App Review |
| Gửi bị Meta từ chối | Hết cửa sổ 24h (IG) hoặc Human Agent chưa duyệt (FB) | Khách nhắn lại; xem banner composer |
| IG nối được nhưng không có DM | Sai Page, chưa link IG, webhook IG thiếu | Đúng Page có IG; cấu hình webhook IG |
| Hôm qua ngrok A, hôm nay B | URL đổi | Sửa env + Redirect + Webhook + App Domains |

Ngắt kết nối (UC-CH-02): hội thoại kênh đó **ẩn khỏi Inbox**, không xóa DB. Nối lại thì lịch sử hiện lại.

---

## 13. URL và scope trong code

| Mục | Path |
|-----|------|
| Bắt đầu OAuth | `{APP_URL}/api/connect/meta/start` |
| Callback | `{APP_URL}/api/connect/meta/callback` |
| Webhook | `{APP_URL}/api/webhooks/meta` |

`{APP_URL}` = `NEXT_PUBLIC_APP_URL` (HTTPS khi làm việc với Meta).

Scope:

```text
pages_show_list
pages_messaging
pages_manage_metadata
```

Graph version: `v21.0` (`src/backend/meta-oauth.ts`).

Tài liệu Meta (tham khảo, không copy code):

- [Messenger Platform – Webhooks](https://developers.facebook.com/docs/messenger-platform/webhooks/)
- [Instagram messaging](https://developers.facebook.com/docs/messenger-platform/instagram)

---

## 14. Việc còn mở (liên quan kết nối)

| Việc | Trạng thái |
|------|------------|
| Soft refresh Inbox (~8s) | Đã có — chưa SSE/WebSocket |
| Nút «Đồng bộ tin nhắn» | Đã có trên Cài đặt |
| Chữ ký webhook `X-Hub-Signature-256` | Đã có — thiếu/sai thì từ chối POST |
| Token mã hóa at-rest | Chưa — plaintext trong DB |
| App Review / Live checklist riêng | Ops khi cho user ngoài Roles |

Zalo là kênh khác: xem [ket-noi-kenh.md](./ket-noi-kenh.md).
