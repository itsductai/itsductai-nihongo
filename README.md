# N1 / N2 / N3 Vocab Import — README dự án

Tài liệu này ghi lại toàn bộ công việc import 3 bộ từ vựng JLPT (N1, N2, N3) từ file gốc do Zane cung cấp, tính từ lúc bắt đầu tới khi hoàn thành.

## 1. Nguồn dữ liệu gốc

- `N2.txt` — 1560 từ, định dạng `từ, 「đọc」「Hán Việt」 nghĩa`
- `N1.txt` — 2753 từ, cùng định dạng
- `N3_言葉.txt` — 1552 từ, cùng định dạng

Cả 3 file đều là dữ liệu thô dạng scrape/dictionary, không có sẵn câu ví dụ hay đồng/trái nghĩa.

## 2. Quy trình xử lý (áp dụng đồng nhất cho cả 3 cấp độ)

1. **Parse tự động** bằng script Python (regex tách `từ / đọc / Hán Việt / nghĩa`), xử lý fallback cho ~10% dòng bất thường (từ thuần kana không có ngoặc, định nghĩa từ điển dài dòng).
2. **Chia chương** 60 từ/chương (chương cuối mỗi cấp ít hơn do là phần dư).
3. **Tính `doc_marked`** tự động theo quy tắc trường âm đã có sẵn trong dự án (đánh dấu ょう/ゅう/えい/くう/つう...).
4. **Viết câu ví dụ (`vi_du`)** cho TỪNG từ — viết tay, không dùng khuôn mẫu lặp lại, câu tự nhiên đúng ngữ pháp.
5. **Bổ sung đồng/trái nghĩa (`dong_nghia`/`trai_nghia`)** cho các từ có cặp rõ ràng (không ép từ không có cặp thật).

## 3. Kết quả cuối cùng

| Cấp độ | Số chương | Số từ | Câu ví dụ | Đồng/trái nghĩa |
|---|---|---|---|---|
| N2 | 26 | 1560 | ✅ 100% (1560/1560) | ✅ 282 từ (18%) |
| N1 | 46 | 2753 | ✅ 100% (2753/2753) | ⏳ đang làm dần |
| N3 | 26 | 1552 | ✅ 100% (1552/1552) | ✅ 114 từ (7%) |

**Tổng: 98 chương, 5865 từ, 100% có câu ví dụ.**

## 4. File dữ liệu

- `tailieu/n2-vocab-01.json` → `n2-vocab-26.json`
- `tailieu/n1-vocab-01.json` → `n1-vocab-46.json`
- `tailieu/n3-vocab-01.json` → `n3-vocab-26.json`
- `tailieu/index.json` — đã cập nhật đủ 179 file (bao gồm cả Mimi/Tango cũ)
- `tailieu/manifest-thin.json` — bản "mỏng" cho lazy-loading (bỏ han_viet/vi_du/dong_nghia/trai_nghia, chỉ giữ `_id/kanji/cautruc/doc/nghia`)

### Schema mỗi từ (đầy đủ, trong file chương — KHÔNG phải manifest-thin):
```json
{
  "_id": "n2-vocab-01::盆地",
  "kanji": "盆地",
  "cautruc": null,
  "doc": "ぼんち",
  "doc_marked": "ぼんち",
  "han_viet": "BỒN ĐỊA",
  "nghia": "bồn địa; chỗ trũng; chỗ lòng chảo",
  "vi_du": "この村は周囲を山に囲まれた盆地にある。 (Ngôi làng này nằm trong một bồn địa được bao quanh bởi núi.)",
  "vi_du_ruby": "",
  "dong_nghia": [],
  "trai_nghia": [{"kanji": "...", "doc": "...", "nghia": "..."}]
}
```

## 5. Thay đổi giao diện đi kèm (để hiển thị đúng 3 bộ mới)

- **Màu + nhãn theo series:** Mimi = xanh lá, Tango N2 = đỏ, JLPT N2/N1/N3 (import) = tím, Khác = xám. Áp dụng đồng bộ ở: trang chọn bộ theo trình độ, dropdown chọn bộ (Cài đặt), biểu đồ Tổng quan (Dashboard), trang Thống kê, sidebar rà từ vựng ở bài đọc.
- **Thứ tự cố định:** Mimi → Tango → JLPT (N1-N3 import) → Khác — áp dụng mọi nơi có nhóm theo series.
- **Xóa nhãn kỹ thuật thừa:** bỏ "(nut-that)" khỏi tên Tango, bỏ "(import mới)" khỏi tên JLPT.
- **Trang Thống kê** (`js/stats-weakness.js`): tách từ 2 khu (Mimi / Tài liệu khác) thành 4 khu riêng biệt (Mimi / Tango / JLPT N1-N3 / Tài liệu khác) — trước đây Tango và 2 bộ import bị gộp chung nhầm vào "Tài liệu khác".
- **Fix bug đọc câu ví dụ (TTS):** `speakJapaneseForced()` gọi `speechSynthesis.cancel()` ngay đầu mỗi lần — khi gọi lại NGAY trong `onend` (đọc xong từ → đọc tiếp ví dụ) thì nhiều trình duyệt (đặc biệt Chrome) âm thầm bỏ qua utterance thứ 2. Đã thêm độ trễ 100ms trong `js/core.js` để khắc phục.

## 6. Việc còn tồn đọng (tính tới thời điểm xuất file này)

- **N1: 46/46 chương đã có câu ví dụ, nhưng đồng/trái nghĩa mới chỉ bắt đầu** — cần làm tiếp giống cách đã làm cho N2/N3.
- **Chưa cross-reference đồng/trái nghĩa với từ vựng đã có sẵn trong Mimi/Tango** — hiện tại đồng/trái nghĩa chỉ là từ phổ biến tôi tự biết, chưa chủ động tìm và liên kết với từ CÙNG CÓ trong các bộ khác trong app để tiện học nhóm.
- Bug `異なる` không được gạch chân trong bài đọc (được nêu ở phiên làm việc trước, chưa quay lại kiểm tra kỹ).

## 7. Ghi chú quan trọng

- **Không có thay đổi nào** ở các tính năng Đề thi (`exam.js`), Đề nghe (`choukai.js`), hay các module khác không liên quan tới từ vựng trong suốt quá trình làm việc này.
- File xuất lần này **chỉ gồm phần liên quan tới việc import từ vựng N1/N2/N3** — không phải toàn bộ dự án.
