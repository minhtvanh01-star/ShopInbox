# UC-CH-01: Kết nối Facebook / Instagram

| **Mã Use Case:** | UC-CH-01 |
| ---: | :--- |
| **Tên Use Case:** | Kết nối Facebook / Instagram |
| **Người tạo:** | Team ShopInbox | **Cập nhật bởi:** | Team ShopInbox |
| **Ngày tạo:** | 2026-09-15 | **Ngày cập nhật:** | 2026-09-15 |

| **Diễn viên:** | **Chính:** Chủ shop (có quyền `channels.connect`). **Phụ:** Meta (Facebook Login, Graph API, Webhooks). |
| ---: | :--- |
| **Mô tả:** | Chủ shop nối Fanpage Facebook hoặc tài khoản Instagram Business (qua Fanpage đã liên kết) vào ShopInbox để nhận và gửi tin trong Inbox. Sau khi xong, kênh ở trạng thái Đã nối, token Page được lưu, webhook được đăng ký (tự động nếu được, hoặc hướng dẫn cấu hình tay). |
| **Điều kiện trước:** | 1. Chủ shop đã đăng nhập ShopInbox.<br>2. Server đã có `META_APP_ID`, `META_APP_SECRET`; `NEXT_PUBLIC_APP_URL` trỏ HTTPS đúng môi trường đang dùng.<br>3. Trên Meta Developers: App Domains + Valid OAuth Redirect URI khớp callback của app.<br>4. Với Instagram: Fanpage đã liên kết Instagram Professional / Business. |
| **Điều kiện sau:** | 1. Bản ghi `channel_accounts` của shop cho kênh `facebook` hoặc `instagram` có `status = ready`, có `accessToken`, `pageId` (và `linkedPageId` nếu IG).<br>2. Giao diện Cài đặt hiện tên Page / IG đã nối.<br>3. Hệ thống đã thử đăng ký webhook app/page; ghi chú kết quả trên kênh.<br>4. Có thể nhận tin khách (sau khi webhook verify / subscribe đủ) và gửi tin shop khi còn trong cửa sổ messaging của Meta. |
| **Độ ưu tiên:** | Cao — chặn việc mang sản phẩm ra dùng thật |
| **Tần suất:** | Vài lần mỗi shop lúc setup; đôi khi nối lại khi token hết / đổi Page |
| **Luồng chính:** | 1. Chủ shop mở **Cài đặt**, chọn **Thêm kết nối**, chọn Facebook hoặc Instagram.<br>2. Hệ thống kiểm tra đủ biến Meta; nếu thiếu thì khóa nút OAuth và liệt kê biến còn thiếu.<br>3. Chủ shop bấm **Kết nối với Facebook/Instagram**.<br>4. Hệ thống tạo state OAuth (JWT + cookie), redirect sang Facebook Login với scope Page: `pages_show_list`, `pages_messaging`, `pages_manage_metadata`.<br>5. Chủ shop đăng nhập Meta và cấp quyền cho app.<br>6. Meta redirect về `/api/connect/meta/callback` kèm `code` và `state`.<br>7. Hệ thống đối chiếu `state` với cookie, đổi `code` lấy user token ngắn, đổi sang long-lived token, gọi Graph lấy danh sách Page (lọc theo kênh FB hoặc IG có `instagram_business_account`).<br>8. Nếu đúng một Page hợp lệ: hệ thống lưu kết nối (`saveOAuthConnection`), ghi audit, thử subscribe webhook app + page, redirect Cài đặt kèm `oauth_success`.<br>9. Hệ thống cập nhật ghi chú kênh (kết quả webhook / đồng bộ tin gần đây nếu có).<br>10. Chủ shop thấy kênh **Đã nối** và có thể mở Inbox kiểm tra. |
| **Luồng thay thế:** | **UC-CH-01.AC.1: Nhiều Page**<br>Tại bước 7–8, nếu có nhiều Page hợp lệ: hệ thống lưu danh sách tạm (cookie), redirect `oauth_pick`, chủ shop chọn một Page trên modal, hệ thống lưu kết nối rồi tiếp tục như bước 8–10.<br><br>**UC-CH-01.AC.2: Webhook tự động thất bại**<br>Tại bước 8–9, nếu Graph subscribe lỗi: hệ thống vẫn lưu kênh `ready`, ghi chú yêu cầu dán Webhook URL / verify token thủ công trên Meta Developers. Chủ shop làm theo [ket-noi-meta-fb-ig.md](./ket-noi-meta-fb-ig.md) rồi nhắn thử. |
| **Ngoại lệ:** | **UC-CH-01.EX.1: Thiếu cấu hình Meta**<br>Trigger: thiếu `META_APP_ID` / `META_APP_SECRET`.<br>Response: redirect / khóa nút với mã `meta_not_configured`.<br>Trạng thái cuối: chưa lưu kết nối.<br><br>**UC-CH-01.EX.2: User hủy cấp quyền**<br>Trigger: Meta trả `error` trên callback.<br>Response: `meta_denied`, xóa cookie state.<br>Trạng thái cuối: chưa nối.<br><br>**UC-CH-01.EX.3: State không hợp lệ**<br>Trigger: thiếu/sai cookie state hoặc shopId lệch session.<br>Response: `meta_state`.<br>Trạng thái cuối: chưa nối; yêu cầu bấm kết nối lại.<br><br>**UC-CH-01.EX.4: Không có Page / không có IG**<br>Trigger: Graph trả danh sách rỗng sau lọc.<br>Response: `meta_no_pages` hoặc `meta_no_instagram`.<br>Trạng thái cuối: chưa nối. Chủ shop cần tạo/liên kết Page–IG rồi thử lại.<br><br>**UC-CH-01.EX.5: Lỗi Graph / đổi token**<br>Trigger: exception khi exchange token hoặc fetch pages.<br>Response: `meta_failed` + `oauth_message`.<br>Trạng thái cuối: chưa nối (hoặc giữ trạng thái cũ nếu trước đó đã nối).<br><br>**UC-CH-01.EX.6: Redirect URI / App Domains sai**<br>Trigger: Meta báo lỗi miền / redirect không khớp trước khi về app.<br>Response: user thấy lỗi trên trang Meta.<br>Trạng thái cuối: chưa vào được callback. Sửa theo checklist Meta. |
| **Includes:** | — (đăng ký webhook và sync tin gần đây gọi nội bộ sau khi lưu kết nối) |
| **Yêu cầu đặc biệt:** | **Bảo mật:** App Secret không ra client (chỉ cờ đã lưu); OAuth state ~15 phút; chỉ `channels.connect`. Webhook Meta POST verify `X-Hub-Signature-256`.<br>**Tin cậy:** Callback HTTPS; webhook GET verify token khớp env.<br>**Hiệu năng:** Đổi token + fetch pages trong một request callback. |
| **Giả định:** | 1. Chủ shop là admin Page (hoặc đủ quyền messaging) trên Fanpage cần nối.<br>2. App Meta ở chế độ Development thì chỉ tester/role trong app nhắn được; Live thì cần App Review đúng quyền.<br>3. Instagram DM đi qua Page liên kết; không xin các scope IG đã bị Meta từ chối trên nhiều app (`instagram_basic`, `instagram_manage_messages`). |
| **Ghi chú / việc mở:** | [TBD-1] Token mã hóa at-rest \| Owner: BE \| Due: sau MVP Meta<br>[TBD-2] Inbox realtime SSE/WS (thay soft poll) \| Owner: FE/BE \| Due: sau webhook ổn<br>[TBD-3] App Review / Live ops checklist riêng \| Owner: chủ shop |

---

## Tham chiếu code (để dev lần theo)

| Việc | Chỗ chính |
|------|-----------|
| Bắt đầu OAuth | `src/app/api/connect/meta/start/route.ts` |
| Callback | `src/app/api/connect/meta/callback/route.ts` |
| Scope / token / subscribe | `src/backend/meta-oauth.ts` |
| Lưu kênh + webhook note | `src/backend/channel-connect.ts` |
| Env / redirect | `src/backend/oauth-config.ts` |
| Thông báo lỗi UI | `src/components/settings/AddConnectionModal.tsx` (`OAUTH_ERROR_MESSAGES`) |

Hướng dẫn thao tác Meta Developers + bảng lỗi thường gặp: [ket-noi-meta-fb-ig.md](./ket-noi-meta-fb-ig.md).
