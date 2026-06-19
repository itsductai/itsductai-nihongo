# N2 Vocab Lab v2 — Hướng dẫn đầy đủ

Tài liệu này giải thích cấu trúc dữ liệu JSON, quy tắc viết file, và toàn bộ cơ chế hoạt động của app — để tự thêm bộ học mới, tự debug, hoặc tự sửa code sau này mà không cần hỏi lại.

---

## 1. Cấu trúc thư mục

```
app2/
├── index.html
├── README.md
├── css/
│   └── style.css
├── js/
│   ├── srs.js           (thuật toán ôn tập kiểu Anki, tính theo phút)
│   └── app.js            (toàn bộ logic app: render, mode, sự kiện)
├── tailieu/
│   ├── index.json        (danh sách file bộ từ vựng/ngữ pháp — BẮT BUỘC cập nhật khi thêm bộ mới)
│   ├── nut-that-n2.json       (mẫu TYPE: TUVUNG, 120 từ)
│   └── nguphap-mau.json       (mẫu TYPE: NGUPHAP, 3 cấu trúc)
└── dethi/
    ├── index.json        (danh sách file đề thi — BẮT BUỘC cập nhật khi thêm đề mới)
    └── mondai1-mau-2023-12.json   (mẫu đề thi, 3 câu)
```

App là web app tĩnh (HTML/CSS/JS thuần), không có server/database. Mọi tiến độ học, cấu hình, và sửa tạm đều lưu trong `localStorage` của trình duyệt. Có thể mở trực tiếp `index.html` qua `python3 -m http.server` hoặc đẩy lên GitHub Pages.

---

## 2. Cách thêm bộ mới — và vì sao phải sửa `index.json`

JavaScript chạy trong trình duyệt **không có cách nào tự liệt kê file trong 1 thư mục** qua HTTP thuần (đây là giới hạn của web, không phải hạn chế riêng của app này). Vì vậy app quét dữ liệu bằng cách đọc file `index.json` liệt kê tên các file cần tải.

**Quy trình thêm 1 bộ từ vựng/ngữ pháp mới:**
1. Tạo file `.json` mới trong `tailieu/`, đặt tên không dấu, không khoảng trắng (ví dụ `n3-co-ban.json`).
2. Viết nội dung theo đúng cấu trúc ở mục 3 hoặc mục 4 dưới đây.
3. Mở `tailieu/index.json`, thêm tên file đó vào mảng `files`:
   ```json
   { "files": ["nut-that-n2.json", "nguphap-mau.json", "n3-co-ban.json"] }
   ```
4. Tải lại trang (F5) — bộ mới tự xuất hiện trong dropdown "Bộ học" ở sidebar.

**Quy trình thêm 1 đề thi mới:** giống hệt nhưng làm trong thư mục `dethi/` và sửa `dethi/index.json`.

Nếu quên bước 3, file mới sẽ không lỗi gì cả nhưng cũng **không xuất hiện** — đây là điều đầu tiên cần kiểm tra nếu thấy "tôi đã tạo file mà sao không thấy bộ mới".

---

## 3. Cấu trúc bộ từ vựng — `"type": "TUVUNG"`

```json
{
  "type": "TUVUNG",
  "title": "Tên bộ hiển thị trong dropdown",
  "words": [
    {
      "kanji": "一転する",
      "doc": "いってんする",
      "doc_marked": "いってんする",
      "han_viet": "NHẤT CHUYỂN",
      "nghia": "thay đổi hoàn toàn, đảo ngược",
      "vi_du": "留学の話が一転した。(Câu chuyện du học đã thay đổi hoàn toàn.)",
      "vi_du_ruby": "留学の話が<ruby>一転<rt>いってん</rt></ruby>した。(Câu chuyện du học đã thay đổi hoàn toàn.)",
      "dong_nghia": [],
      "trai_nghia": []
    }
  ]
}
```

| Field | Bắt buộc | Giải thích |
|---|---|---|
| `kanji` | Có | Chữ kanji / từ vựng gốc. Dùng làm khóa định danh (`_id`) — xem mục 7. |
| `doc` | Có | Cách đọc hiragana **thuần**, không chứa `**`. Dùng để so khớp khi tự luận ở mode "Gõ hiragana" — phải khớp chính xác ký tự với gì người học gõ ra. |
| `doc_marked` | Không | Giống `doc` nhưng có đánh dấu trường âm bằng `**...**` quanh đoạn cần tô đỏ. Nếu để trống, app tự dùng `doc` (không tô màu). Xem quy tắc đánh dấu ở mục 5. |
| `han_viet` | Có | Âm Hán Việt, viết hoa. Nếu từ thuần Nhật không có âm Hán Việt: ghi `"(thuần Nhật)"`. Nếu từ ngoại lai (katakana mượn tiếng Anh/Pháp...): ghi `"(từ ngoại lai)"`. |
| `nghia` | Có | Nghĩa tiếng Việt. Không để trống — đây là field bắt buộc cho mọi chế độ học. |
| `vi_du` | Có | Câu ví dụ tiếng Nhật kèm dịch tiếng Việt trong ngoặc, format: `câu tiếng Nhật。(dịch tiếng Việt.)` |
| `vi_du_ruby` | Không | Giống `vi_du` nhưng từ vựng chính trong câu được bọc `<ruby>kanji<rt>cách đọc</rt></ruby>` để hiện furigana nhỏ phía trên khi hiển thị. Nếu để trống, app dùng `vi_du` thường (không furigana). Chỉ cần bọc đúng phần kanji của từ đang học, không cần bọc toàn câu. |
| `dong_nghia` | Không | Mảng chuỗi các từ đồng nghĩa. Để `[]` nếu không có. |
| `trai_nghia` | Không | Mảng chuỗi các từ trái nghĩa. Để `[]` nếu không có. |

---

## 4. Cấu trúc bộ ngữ pháp — `"type": "NGUPHAP"`

```json
{
  "type": "NGUPHAP",
  "title": "Tên bộ hiển thị",
  "words": [
    {
      "cautruc": "～にもかかわらず",
      "nghia": "mặc dù..., dù... vẫn",
      "muc_do": "Trang trọng (văn viết, văn bản chính thức)",
      "cau_truc_ngu_phap": "N / Vる・Vた / Aい / Aな + にもかかわらず",
      "vi_du": "<ruby>悪天候<rt>あくてんこう</rt></ruby>にもかかわらず、試合は行われた。(Mặc dù thời tiết xấu, trận đấu vẫn được diễn ra.)",
      "so_sanh_de_nham": [
        { "cautruc": "～のに", "khac_biet": "のに mang sắc thái cảm xúc cá nhân nhiều hơn, dùng cả văn nói; にもかかわらず khách quan, trang trọng hơn." }
      ],
      "dong_nghia": ["～ものの"],
      "trai_nghia": []
    }
  ]
}
```

| Field | Bắt buộc | Giải thích |
|---|---|---|
| `cautruc` | Có | Cấu trúc ngữ pháp. Hiện mặc định ở mặt trước flashcard. Dùng làm khóa định danh (`_id`) nếu không có `kanji`. |
| `nghia` | Có | Ý nghĩa, cách dùng bằng tiếng Việt. |
| `muc_do` | Không | Mức độ trang trọng / văn nói hay văn viết. Chuỗi tự do (ví dụ "Trang trọng", "Thân mật", "Trung lập"). |
| `cau_truc_ngu_phap` | Không | Công thức ngữ pháp (V/A/N + gì), hiển thị dạng monospace nổi bật trong card. |
| `vi_du` | Có | Câu ví dụ. Có thể tự bọc `<ruby>kanji<rt>đọc</rt></ruby>` thủ công nếu muốn furigana — không có field `vi_du_ruby` riêng cho NGUPHAP. |
| `so_sanh_de_nham` | Không | Mảng object `{cautruc, khac_biet}` liệt kê các cấu trúc dễ nhầm và điểm khác biệt. Để `[]` nếu không có. |
| `dong_nghia` | Không | Mảng chuỗi các cấu trúc đồng nghĩa. |
| `trai_nghia` | Không | Mảng chuỗi các cấu trúc trái nghĩa. |

**Lưu ý quan trọng:** mode "Gõ hiragana" và "Ghép thẻ" (Match) chỉ thiết kế cho TUVUNG, không xuất hiện trong nav khi đang học bộ NGUPHAP (vì cấu trúc ngữ pháp thường dài, không phù hợp kiểu chơi ghép đôi ngắn).

---

## 5. Quy tắc đánh dấu trường âm (trong `doc_marked`)

Trường âm (âm kéo dài trong tiếng Nhật) được tô đỏ bằng cách bọc đoạn ký tự cần đánh dấu trong `**...**`. App tự động chuyển `**xxx**` → `<span class="choon">xxx</span>` khi hiển thị (hàm `renderChoon` trong `app.js`).

**Quy tắc nhận diện trường âm thật (không phải mọi chữ おう/えい đều là trường âm — cần hiểu đúng ngữ âm):**
- おう, こう, ごう, とう, どう, のう, ぼう, もう, ろう, よう và biến thể có raised kana (しょう, ちょう, じょう, りょう, きょう, ぎょう, ひょう, びょう, みょう...) → đánh dấu cả 2 ký tự, ví dụ: か**こう**, **とう**ろん, り**ょう****しゅう**しょ
- ゅう / ゆう (kyuu, shuu, juu...) → đánh dấu cả 2 ký tự, ví dụ: かく**じゅう**, けん**しゅう**
- けい/せい/てい/ねい/へい/めい/れい/げい/ぜい/でい/べい/ぺい (e+i) → đánh dấu cả 2 ký tự, ví dụ: **せい**さん, **けい**とう
- えい → đánh dấu cả 2 ký tự, ví dụ: **えい**きゅう
- Trong từ katakana, dấu kéo dài `ー` (chōonpu, U+30FC) → đánh dấu luôn ký tự ngay trước nó cùng với dấu `ー`, ví dụ: **ハー**ド

**Cách sửa/thêm đánh dấu ngay trong app (không cần sửa tay JSON):** dùng nút "✎ Sửa" ở Flashcard hoặc bảng, bôi đen (chọn) đoạn hiragana cần đánh dấu trong ô "Cách đọc có đánh dấu trường âm", bấm nút "Đánh dấu trường âm (đỏ)". Có thể bấm nhiều lần cho nhiều đoạn khác nhau trong cùng 1 từ. Xem mục 9 để biết cách lưu vĩnh viễn vào file.

---

## 6. Cấu trúc đề thi trắc nghiệm (thư mục `dethi/`)

```json
{
  "title": "Mondai 1 - Đọc kanji (mẫu N2 2023-12)",
  "questions": [
    {
      "de_bai": "次の文の＿＿＿の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。\n会議の内容を簡潔にまとめてください。",
      "options": ["かんせつ", "かんけつ", "かんきつ", "かんかつ"],
      "dap_an_dung": 1
    }
  ]
}
```

| Field | Bắt buộc | Giải thích |
|---|---|---|
| `title` | Có | Tên đề thi hiển thị trong dropdown "Đề thi trắc nghiệm" ở sidebar. |
| `questions` | Có | Mảng câu hỏi, mỗi câu gồm các field bên dưới |
| `questions[].de_bai` | Có | Đề bài. Dùng `\n` để xuống dòng nếu câu dài (ví dụ phần hướng dẫn + câu cần chọn riêng dòng). |
| `questions[].options` | Có | Mảng **đúng 4 chuỗi** đáp án. |
| `questions[].dap_an_dung` | Có | **Index 0-based** của đáp án đúng trong `options` (0 = đáp án thứ 1, 1 = đáp án thứ 2, 2 = thứ 3, 3 = thứ 4). |

**Cơ chế làm bài:**
- Thứ tự 4 đáp án được xáo trộn ngẫu nhiên mỗi lần hiện câu (tránh học vẹt vị trí đáp án).
- Trả lời sai → câu đó bị đẩy xuống cuối hàng đợi để làm lại, đến khi đúng mới được tính qua hẳn.
- Điểm chỉ cộng 1 lần cho mỗi câu khi trả lời đúng **lần đầu tiên** — làm lại sau khi đã từng đúng không cộng thêm điểm.
- Không có khái niệm "đề thi sai" hay "trượt" — đề chỉ kết thúc khi mọi câu trong hàng đợi đã được trả lời đúng ít nhất 1 lần.

---

## 7. Cách app định danh từng từ/cấu trúc (`_id`) — vì sao quan trọng

Mỗi từ/cấu trúc khi tải vào app được gắn 1 `_id` nội bộ, dùng làm khóa để lưu tiến độ SRS, sửa tạm, và thống kê điểm yếu. Công thức:

```
_id = "<tên file (không đuôi .json)>::<kanji hoặc cautruc>"
```

Ví dụ: từ "一転する" trong file `nut-that-n2.json` có `_id = "nut-that-n2::一転する"`.

**Vì sao không dùng vị trí (index) trong mảng:** nếu dùng index, việc chèn/xóa 1 từ ở giữa file sẽ làm lệch toàn bộ `_id` của các từ phía sau, mất sạch tiến độ đã học. Dùng nội dung (`kanji`/`cautruc`) làm khóa giúp `_id` ổn định bất kể bạn sắp xếp lại thứ tự từ trong file.

**Trường hợp 2 từ trùng `kanji`/`cautruc` y hệt trong cùng 1 file** (hiếm, ví dụ liệt kê riêng để học 2 nghĩa khác nhau của 1 từ đồng âm): app tự thêm hậu tố `#2`, `#3`... vào `_id` của các bản trùng tiếp theo để đảm bảo không bị nhầm lẫn.

**Lưu ý khi đổi tên file:** đổi tên file `.json` sẽ làm đổi toàn bộ `_id` của các từ trong đó (vì tên file là 1 phần của `_id`) → tiến độ SRS cũ sẽ không khớp nữa. Tránh đổi tên file sau khi đã học một thời gian; nếu cần đổi, hãy export tiến độ trước.

---

## 8. Cơ chế ôn tập SRS (kiểu Anki, tính theo phút)

3 nút: **Quên** (Again) / **Khó** (Hard) / **Dễ** (Easy). Công thức SM-2 đơn giản hóa, định nghĩa trong `js/srs.js`:

| Nút bấm | Lần đầu | Các lần sau |
|---|---|---|
| Quên | → 1 phút | → luôn về lại 1 phút; hệ số dễ (ease) giảm 0.2, tối thiểu 1.3 |
| Khó | → 6 phút | → interval hiện tại × 1.2 (tối thiểu 6 phút); ease giảm 0.05 |
| Dễ | → 10 phút | → nếu interval < 1 ngày (1440 phút): interval × ease; nếu đã ≥ 1 ngày: interval × (ease + 1.5); ease tăng 0.1, tối đa 3.5 |

Trạng thái hiển thị trong Bảng/SRS:
- **Chưa học** (`new`) — chưa từng được đánh giá.
- **Đang học** (`learning`) — đã học, interval < 1 ngày.
- **Đã thuộc** (`known`) — interval ≥ 1 ngày (1440 phút).

Mỗi nút trong Flashcard/SRS hiện sẵn thời gian dự kiến tới lần ôn tiếp theo (ví dụ "Dễ — 26 phút") để biết trước hệ quả của lựa chọn.

Toàn bộ tiến độ lưu trong `localStorage`, theo từng bộ riêng biệt (key: `n2vocab_progress_<tên file>`).

---

## 9. Sửa thông tin trực tiếp trong app (nút ✎ Sửa) — sửa tạm, không phải sửa file gốc

Có ở 2 nơi: nút "✎ Sửa" trong Flashcard mode (sửa từ đang xem), và icon ✎ ở cuối mỗi dòng trong Bảng.

**Đây là sửa tạm.** Vì app chạy hoàn toàn trên trình duyệt, JavaScript không có quyền ghi đè file trên đĩa (giới hạn an toàn của mọi web app, không riêng app này). Khi bấm "Lưu thay đổi", bản sửa được lưu trong `localStorage` (key `n2vocab_editpatches`, cấu trúc `{ [tên file]: { [_id]: {...field đã sửa} } }`) và áp dụng đè lên dữ liệu gốc mỗi khi mở app — học liền mạch ngay, không cần tải lại file gì.

**Field sửa được:**
- TUVUNG: `kanji`, `doc`, `doc_marked` (kèm nút đánh dấu trường âm), `han_viet`, `nghia`, `vi_du`, `vi_du_ruby`, `dong_nghia`, `trai_nghia`.
- NGUPHAP: `cautruc`, `nghia`, `muc_do`, `cau_truc_ngu_phap`, `vi_du`, `dong_nghia`, `trai_nghia`.

Khi sửa `doc_marked`, app tự đồng bộ lại `doc` (bỏ hết dấu `**`) để mode "Gõ hiragana" vẫn so khớp đúng.

**Muốn sửa vĩnh viễn vào file gốc:** dùng "Xuất tiến độ" ở sidebar (file xuất ra gồm cả các sửa tạm), mở file xuất ra, tìm phần `editPatches`, rồi tự tay copy nội dung đã sửa vào đúng file JSON tương ứng trong `tailieu/`. Cách này chắc chắn 100% và tránh rủi ro app tự động ghi sai cấu trúc file.

**Nếu không muốn học 1 bộ nữa:** xóa file đó khỏi `tailieu/index.json` (và xóa file JSON) như bình thường. Các sửa tạm liên quan đến bộ đó vẫn còn trong `localStorage` nhưng vô hại — không bao giờ được áp dụng lại vì app không còn đọc bộ đó nữa. Có nút "Dọn các sửa tạm" ở sidebar để xóa sạch toàn bộ nếu muốn dọn rác.

---

## 10. Xuất / nhập tiến độ — gồm những gì

Nút "Xuất tiến độ" / "Nhập tiến độ" ở sidebar. File xuất ra (JSON) gồm:

```json
{
  "exportedAt": "...",
  "version": 5,
  "srsProgress": { "n2vocab_progress_<tên file>": {} },
  "fieldConfig": {},
  "visibleCols": {},
  "peekCols": {},
  "editPatches": {},
  "starredItems": {},
  "weaknessStats": {},
  "shuffleEnabled": { "flash": true, "srs": true },
  "soundEnabled": true,
  "speechEnabled": true
}
```

- `srsProgress` — toàn bộ lịch sử SRS của **mọi bộ** đang có trong `localStorage`, không chỉ bộ đang mở.
- `fieldConfig` — field nào hiện ở mặt trước/sau flashcard, riêng theo từng TYPE.
- `visibleCols` / `peekCols` — cấu hình ẩn/hiện cột và "ẩn để tự kiểm tra" trong Bảng.
- `editPatches` — toàn bộ các sửa tạm qua nút ✎ Sửa.
- `starredItems` — toàn bộ các từ/cấu trúc đã đánh dấu ★, theo từng bộ.
- `weaknessStats` — toàn bộ số liệu đúng/sai dùng cho mục Điểm yếu, của **mọi bộ và cả đề thi**.
- `shuffleEnabled`, `soundEnabled`, `speechEnabled` — các cấu hình bật/tắt nhỏ.

Khi nhập vào máy khác (đã có sẵn cùng file JSON gốc trong `tailieu/`/`dethi/`), mọi thứ khôi phục đúng và áp dụng ngay. Riêng `weaknessStats` được **cộng dồn** (không đè) với số liệu đã có trên máy hiện tại, vì đây là số liệu tích lũy theo thời gian — đè thẳng sẽ làm mất lịch sử sẵn có. Các phần khác (sửa tạm, đánh dấu sao) được gộp không trùng lặp. File export cũ (chỉ có `srsProgress` không có wrapper, hoặc thiếu vài field mới) vẫn được hỗ trợ nhập vào — field nào không có trong file cũ sẽ giữ nguyên giá trị hiện tại, không bị xóa.

---

## 11. Tùy chỉnh giao diện Flashcard / Bảng

- Nút **⚙ Mặt thẻ** (Flashcard mode): popup chọn field nào hiện ở mặt trước (chỉ chọn 1, radio button) và mặt sau (chọn nhiều, checkbox) — riêng theo từng TYPE. Lưu `localStorage` (`n2vocab_fieldconfig`).
- Nút **☷ Cột** (Bảng mode): mỗi cột có 2 control riêng — checkbox ẩn/hiện hẳn cột khỏi bảng, và 1 switch riêng "ẩn để tự kiểm tra" (chỉ áp dụng các cột không phải định danh chính: đọc, hán việt, nghĩa, ví dụ, mức độ). Khi bật switch peek, nội dung cột đó bị che bởi 1 lớp overlay (không làm lệch chiều cao hàng), hiện ra khi rê chuột vào. Lưu `localStorage` (`n2vocab_colconfig`, `n2vocab_peekcols`).

---

## 12. Chế độ phóng to toàn màn hình (⛶ Focus mode)

Có ở mọi mode học (Flashcard, Bảng, SRS, Gõ hiragana, Trắc nghiệm, Ghép thẻ, Đề thi). Bấm nút "⛶" để ẩn sidebar và các điều khiển phụ (tìm kiếm, lọc, đồng hồ phụ...), tăng cỡ chữ để tập trung học. Thoát bằng nút "✕" tròn cố định góc trên phải, hoặc phím **Esc**.

Riêng đề thi: nếu chưa chọn đề thi nào, app sẽ chặn vào focus mode và nhắc chọn đề trước (vì dropdown chọn đề nằm ở sidebar, sẽ không bấm được khi sidebar đang ẩn).

---

## 13. Gõ hiragana (mode "Gõ hiragana") — tự luận thật, không phải tập đánh máy

Chỉ hiện kanji + nghĩa, **không hiện khung gợi ý cách đọc**. Người học tự nhớ và gõ cách đọc ra ô input, bấm **Enter** hoặc nút "Kiểm tra" để so khớp toàn bộ một lần (không soi từng ký tự khi đang gõ — đúng tinh thần tự luận).

- Nút **💡 Gợi ý** — hiện thêm 1 ký tự đúng tiếp theo (dòng chấm tròn phía dưới ô input), không tính là sai.
- Nút **👁 Xem đáp án** — hiện full đáp án ngay, tính là **chưa nhớ được** (SRS xếp ôn lại sớm hơn, ghi nhận vào thống kê điểm yếu).
- Gõ đúng hoàn toàn → tự động chuyển qua từ tiếp theo.

---

## 14. Âm thanh phản hồi + Thống kê điểm yếu

**Âm thanh:** nút 🔊/🔇 cạnh tên app ở sidebar. Phát tiếng "beep" ngắn (tạo bằng Web Audio API, không cần file âm thanh) khi trả lời đúng/sai. Áp dụng cho: Gõ hiragana, Trắc nghiệm, Ghép thẻ, Đề thi. Không áp dụng cho Flashcard/SRS vì đó là tự đánh giá (Quên/Khó/Dễ), không có đúng/sai khách quan. Trạng thái lưu `localStorage` (`n2vocab_sound_enabled`).

**Phát âm tiếng Nhật:** nút 🗣 cạnh nút 🔊. Khi bật, mỗi lần lật thẻ sang mặt sau (cả Flashcard và SRS) sẽ tự đọc cách đọc thật của từ/cấu trúc bằng Web Speech API có sẵn trong trình duyệt (miễn phí, không cần internet sau khi tải trang). Trạng thái lưu `localStorage` (`n2vocab_speech_enabled`).

Lưu ý kỹ thuật quan trọng trên mobile (đặc biệt iOS): trình duyệt yêu cầu phải có ít nhất 1 tương tác chạm/click trên trang trước khi cho phép phát âm, nếu không lệnh đọc sẽ bị chặn âm thầm (không báo lỗi, chỉ là không có tiếng). App đã xử lý bằng cách "mở khóa" engine đọc ngay từ lần chạm đầu tiên trên trang (bất kỳ đâu), và tự tìm giọng đọc tiếng Nhật phù hợp nhất có sẵn trên máy. Nếu máy không có giọng đọc tiếng Nhật nào được cài, sẽ không có tiếng — đây là hạn chế của thiết bị, không phải lỗi app.

**Thống kê điểm yếu:** mục "⚠ Điểm yếu" trong nav (có ở cả TUVUNG và NGUPHAP). Mỗi lần trả lời đúng/sai ở **Flashcard, SRS, Gõ hiragana, Trắc nghiệm, Ghép thẻ, Đề thi** (toàn bộ 6 chế độ học) đều được ghi nhận vào `localStorage` (`n2vocab_weakness_stats`). Một từ/câu được coi là "điểm yếu" khi đã sai ít nhất 1 lần, và nếu đã làm ≥3 lần thì tỷ lệ sai phải ≥40% (tránh báo nhầm từ đã từng sai nhưng học tốt hẳn lên về sau). Với dữ liệu còn ít (1-2 lần làm), chỉ cần có sai là hiện ngay, để dễ kiểm tra tính năng khi mới dùng.

Có nút "Ôn riêng các từ yếu này" để mở thẳng Flashcard chỉ gồm các từ đang yếu. Với đề thi, sau khi hoàn thành sẽ hiện thêm danh sách câu hay sai nhất trong đề đó ngay trong phần kết quả.

---

## 15. Luyện tốc độ khi làm đề thi (⚡ 30 giây/câu)

Bật bằng checkbox "⚡ Luyện tốc độ (30s/câu)" ở đầu trang làm đề thi, áp dụng cho **cả đề từ vựng (mojigoi) và đề ngữ pháp** — mục đích rèn phản xạ nhanh để dành thời gian cho phần đọc hiểu trong bài thi thật. Bật/tắt áp dụng **ngay lập tức**, không cần đổi đề hay tải lại trang.

- Mỗi câu có đồng hồ đếm ngược 30 giây. Còn ≤10 giây → chuyển vàng cảnh báo.
- Quá 30 giây → **vẫn cho làm tiếp bình thường** (không khóa, không trừ điểm), đồng hồ chuyển đỏ và hiện số giây đã vượt (ví dụ "+5") để biết đang chậm — mục đích là phản hồi trực quan rèn cảm giác tốc độ, không phải ép buộc.
- Đồng hồ tổng (góc trên) đo tổng thời gian làm hết cả đề; không bị reset nếu lỡ rời trang giữa lúc làm bài rồi quay lại.

Tắt checkbox → làm đề bình thường, không đồng hồ, phù hợp khi muốn học kỹ và đọc lại đề chậm.

---

## 15b. Làm đề thi nâng cao — xem lại câu, tô chọn đáp án, 2 mốc thời gian, lịch sử sai

**Xem lại câu đã làm:** nút "← Câu trước" / "Câu sau →" ở đầu khu vực làm bài, cho phép lùi/tiến qua toàn bộ các câu đã từng hiện ra (kể cả câu đã làm lại nhiều lần). Khi xem lại, có băng thông báo "📖 Đang xem lại câu đã làm" và đáp án đã chọn được tô lại đúng như lúc làm (không cho chọn lại). Bấm "Câu sau →" liên tục tới cuối sẽ tự quay về câu đang chờ trả lời thật.

**Tô chọn được đáp án:** các nút đáp án và đề bài cho phép bôi đen (chọn) text bình thường — để tự tra Google Dịch cách đọc kanji nếu cần. Trước đây bị chặn vì giới hạn mặc định của thẻ `<button>` trong HTML, đã thêm `user-select: text` để ghi đè.

**2 mốc thời gian** (chỉ hiện khi bật ⚡ Luyện tốc độ), trong phần kết quả sau khi hoàn thành đề:
- **Mốc 1 — Lượt đầu:** thời gian từ lúc bắt đầu đề tới khi đã hỏi hết lượt đầu tiên theo đúng thứ tự gốc trong file (chưa tính làm lại câu sai), kèm số câu đúng ngay lần 1 / sai lần 1.
- **Mốc 2 — Sửa lại câu sai:** thời gian riêng từ lúc bắt đầu pha làm lại các câu đã sai cho tới khi mọi câu đều đúng (đề hoàn thành hẳn).

**Lịch sử sai từng câu:** phần kết quả có khu vực "Chi tiết các câu đã sai", liệt kê từng câu kèm nhãn "sai ở lần 1" (chỉ sai 1 lần, đúng ngay lần làm lại) hoặc "sai nhiều lần" (≥2 lần sai), sắp theo số lần sai nhiều nhất trước. Trong lúc đang làm bài, nếu gặp lại 1 câu đã từng sai trước đó, sẽ có ghi chú nhỏ "⚠ Câu này đã sai N lần trong đề này" ngay dưới các đáp án.

---

## 16. Toàn bộ key `localStorage` app sử dụng

| Key | Nội dung |
|---|---|
| `n2vocab_progress_<tên file>` | Tiến độ SRS của 1 bộ cụ thể |
| `n2vocab_fieldconfig` | Field hiện ở mặt trước/sau flashcard theo TYPE |
| `n2vocab_colconfig` | Cột nào hiện/ẩn trong Bảng theo TYPE |
| `n2vocab_peekcols` | Cột nào đang ở trạng thái "ẩn để tự kiểm tra" theo TYPE |
| `n2vocab_editpatches` | Toàn bộ sửa tạm qua nút ✎ Sửa |
| `n2vocab_sound_enabled` | Trạng thái bật/tắt âm thanh phản hồi |
| `n2vocab_weakness_stats` | Thống kê số lần đúng/sai từng từ/câu, dùng cho mục Điểm yếu |
| `n2vocab_starred` | Danh sách các từ/cấu trúc đã đánh dấu ★, theo từng bộ |
| `n2vocab_speech_enabled` | Trạng thái bật/tắt phát âm khi lật thẻ |
| `n2vocab_shuffle_enabled` | Trạng thái bật/tắt học theo thứ tự ngẫu nhiên, riêng cho Flashcard và SRS |

Xóa toàn bộ các key này (qua DevTools hoặc xóa cache trình duyệt) sẽ reset app về trạng thái ban đầu, không ảnh hưởng file JSON gốc.

---

## 17. Flashcard kiểu Quizlet — khác gì với SRS (Anki)

**Đây là 2 khái niệm khác nhau, không phải trùng lặp:**

- **Flashcard** = học nhanh trong 1 phiên ngắn ngay lúc đó. Khi bấm "Chưa nhớ" hoặc "Khó", từ đó **vẫn nằm trong hàng đợi của phiên học hiện tại** và sẽ quay lại sau vài thẻ nữa để lặp lại liên tục cho tới khi bạn bấm "Đã nhớ" — đúng kiểu chế độ "Learn" của Quizlet. Bấm "Chưa nhớ" → quay lại sớm (cách 3 thẻ). Bấm "Khó" → quay lại muộn hơn một chút (cách 7 thẻ, hoặc cuối hàng đợi nếu hàng đợi ngắn hơn 7). Bấm "Đã nhớ" → ra khỏi hàng đợi hẳn, không gặp lại trong phiên này nữa. Học hết toàn bộ hàng đợi → hiện màn hình hoàn thành, gợi ý học lại toàn bộ hoặc chỉ học riêng các từ đã ★ đánh dấu.
- **SRS (mục "Ôn tập")** = lịch ôn trải dài theo thời gian thật (phút/giờ/ngày), không có khái niệm "hàng đợi trong phiên". Bấm "Khó" → 6 phút sau quay lại (có thể đã rời app, quay lại app sau mới thấy). Bấm "Dễ" → có khi ngày mai mới quay lại. Đây là cơ chế chống quên dài hạn kiểu Anki thật, xem chi tiết công thức ở mục 8.

Nói ngắn: Flashcard = luyện tập trong lúc ngồi học (vài chục giây tới vài chục phút), SRS = lịch trình ôn tập trải dài nhiều ngày/tuần.

**Phím tắt khi học Flashcard** (không cần click chuột, dùng được khi đặt tay trên phím mũi tên):
- **←** Chưa nhớ
- **↑** Khó
- **↓** Lật thẻ
- **→** Đã nhớ

Phím tắt tự động bị tắt khi đang mở popup "✎ Sửa" hoặc đang gõ trong 1 ô input/textarea bất kỳ, để không xung đột.

---

## 18. Đánh dấu sao (★) — kiểu Quizlet

Nút ★ xuất hiện ở góc trên-phải của thẻ Flashcard (cả 2 mặt trước/sau), và 1 cột riêng ở đầu mỗi dòng trong Bảng. Bấm để đánh dấu/bỏ đánh dấu 1 từ — không ảnh hưởng gì đến tiến độ SRS hay trạng thái Chưa học/Đang học/Đã thuộc.

**Cách dùng:**
- Trong **Bảng**: chọn filter "★ Đã đánh dấu" ở dropdown để chỉ xem các từ đã đánh dấu.
- Trong **Flashcard**: sau khi học hết 1 phiên (màn hình hoàn thành), có nút "Chỉ học các từ đã ★" để bắt đầu phiên mới chỉ gồm các từ đó — tiện khi muốn tập trung ôn lại đúng những từ mình thấy khó/quan trọng mà không phải lọc tay.

Dữ liệu đánh dấu lưu `localStorage` (`n2vocab_starred`, theo từng bộ riêng biệt), và được gồm trong file "Xuất tiến độ" để giữ lại khi chuyển máy khác.
