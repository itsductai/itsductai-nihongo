# 読解問題 — Quy tắc ra đề (Reading Comprehension Question Rules)

Tài liệu này ghi lại nguyên tắc bắt buộc khi soạn câu hỏi đọc hiểu cho mục 読解モード, để giữ chất lượng đồng nhất và đúng chuẩn JLPT thật (không phải câu hỏi "dò từ khóa").

## 1. Nguyên tắc bắt buộc

### 1.1. Cân bằng độ dài đáp án
- 4 đáp án phải có độ dài **gần nhau** (chênh lệch tối đa nên dưới ~10-12 ký tự). Đáp án đúng dài/ngắn bất thường so với 3 đáp án sai là dấu hiệu lộ đáp án — người học không cần đọc bài cũng đoán được.
- Trước khi chốt câu hỏi, **luôn đo độ dài từng đáp án** (số ký tự) và kiểm tra chênh lệch.

### 1.2. Đáp án đúng KHÔNG được copy nguyên văn
- Đáp án đúng phải được **diễn đạt lại (paraphrase)** — dùng từ đồng nghĩa hoặc cấu trúc ngữ pháp khác so với câu gốc trong bài.
- Nếu đáp án đúng là chuỗi ký tự gần như trùng khớp với 1 câu trong bài, PHẢI viết lại.

### 1.3. 4 loại bẫy bắt buộc dùng cho đáp án sai (distractors)
1. **Bẫy nhiễu (Distraction Trap):** lấy từ khóa hấp dẫn ở câu MỞ ĐẦU hoặc câu dẫn dắt — đặc biệt các câu đứng TRƯỚC từ chuyển ý (しかし, 一方で, ところが, ただし). Ý này thường bị phủ định/bổ sung ngay sau đó trong bài, nhưng người đọc lười đọc hết dễ chọn nhầm.
2. **Bẫy đạo lý đời thực (Common Sense Trap):** đáp án nghe rất hợp lý, đúng theo lẽ thường tình xã hội, nhưng KHÔNG hề được nhắc tới trong bài.
3. **Bẫy tuyệt đối hóa (Extreme Words):** chèn từ tuyệt đối như 必ず, 絶対に, すべて, 常に, 皆 vào đáp án sai — biến 1 ý đúng một phần thành sai hoàn toàn.
4. **Thông tin bịa:** đáp án không liên quan/không có căn cứ trong bài (dùng tiết chế, không lạm dụng để tránh đáp án sai quá lộ liễu).

### 1.4. 3 dạng câu hỏi bắt buộc luân phiên
- **Dạng lý do** (`type: "reason"`): `〜なぜか / どうしてか` — đáp án nằm gần cấu trúc chỉ nguyên nhân (〜からだ, 〜によって, 〜ため).
- **Dạng ý chính** (`type: "main_idea"`): `筆者が最も言いたいことは何か / この文章のテーマはどれか` — đáp án phải bao quát toàn bài, thường nằm ở đoạn kết (要するに, 結局, したがって).
- **Dạng chỉ thị từ** (`type: "referent"`): `下線部「それ・こういうこと」が指す内容はどれか` — đáp án nằm ở câu/cụm ngay TRƯỚC chỉ thị từ.

Mỗi bài nên có 3-5 câu, xen kẽ đủ 3 dạng trên (không chỉ dùng 1 dạng lặp lại).

## 2. Chủ đề ưu tiên (theo xu hướng đề JLPT N2/N1 thật)

- Triết học & Tâm lý học xã hội: cá nhân/tập thể, ý thức bản thân, cô đơn thời số hóa
- Công nghệ & Xã hội (IT/Cloud/AI): thay đổi cách làm việc/giao tiếp, bảo mật, riêng tư
- Giáo dục & Nuôi dạy: cách đánh giá năng lực, khác biệt thế hệ, phương pháp truyền đạt
- Môi trường & Tiêu dùng: thay đổi thói quen mua sắm, phát triển bền vững

## 3. Schema dữ liệu (mỗi câu hỏi trong file `dokkai-articles/reading-XX.json`)

```json
{
  "difficulty": 1-5,
  "type": "reason" | "main_idea" | "referent" (tùy chọn, để phân loại dạng câu hỏi),
  "q": "câu hỏi tiếng Nhật",
  "options": ["4 đáp án, độ dài gần nhau"],
  "answer": 0-3 (index đáp án đúng — LUÔN kiểm tra lại sau khi đổi thứ tự đáp án!),
  "trap_analysis": "giải thích từng đáp án sai thuộc loại bẫy nào (tùy chọn, chưa hiện lên UI)"
}
```

**LƯU Ý QUAN TRỌNG:** nếu đảo thứ tự các đáp án trong mảng `options` sau khi viết xong, PHẢI cập nhật lại `answer` cho khớp — đây là lỗi đã từng xảy ra thật khi rà soát lại các bài (đảo vị trí đáp án đúng lên đầu nhưng quên sửa `answer` từ 1 xuống 0).

## 4. Khi câu hỏi có từ vựng/ngữ pháp mới xuất hiện trong ĐÁP ÁN (không chỉ trong bài đọc)

Nếu một đáp án (kể cả đáp án sai/bẫy) dùng từ vựng hoặc ngữ pháp N2/N1 mà bài đọc gốc chưa có, **phải bổ sung từ đó vào `n2VocabList` hoặc `grammarList` của bài** — để người học không gặp từ lạ mà không biết tra ở đâu.

## 5. Trạng thái các bài hiện tại (tính tới lần cập nhật này)

| Bài | Đã rà theo quy tắc trên? |
|---|---|
| reading-01, 02 | ✅ Đã sửa |
| reading-03 | ✅ Đã đạt chuẩn (kiểm tra thấy ổn, không cần sửa) |
| reading-04 → 10 | ✅ Đã rà và sửa xong (chênh lệch tối đa giờ dưới 10 ký tự) |
| reading-11, 12, 13, 14 | ✅ Đã sửa (viết theo bẫy đúng nhưng ban đầu quên cân bằng độ dài, đã fix) |
| reading-15, 16 | ✅ Viết mới, áp dụng đúng quy tắc ngay từ đầu |
| reading-17, 18, 19 | ✅ Viết mới, áp dụng đúng quy tắc ngay từ đầu |

Toàn bộ 19 bài đọc hiện tại đã đạt chuẩn cân bằng độ dài đáp án.
