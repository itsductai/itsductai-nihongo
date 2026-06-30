# N2 Vocab Lab v2 — Hướng dẫn đầy đủ + Tình trạng dự án

Tài liệu này giải thích **toàn bộ** cấu trúc dữ liệu, quy tắc viết file, cơ chế hoạt động, và tình trạng hiện tại của app (đã làm gì / chưa làm gì) — để bất kỳ chat mới nào cũng hiểu ngay mà không cần đọc lại toàn bộ code. Nếu bắt đầu chat mới: **gửi kèm file zip dự án + đoạn mô tả ngắn + nội dung README này** là đủ.

---

## 0. TÓM TẮT SIÊU NGẮN (đọc trước, đọc kỹ phần này trước khi đọc gì khác)

- Web app tĩnh (HTML/CSS/JS thuần), không server/database, chạy bằng `python3 -m http.server` hoặc GitHub Pages tại `itsductai.github.io/itsductai-nihongo/`.
- Repo GitHub: `itsductai/itsductai-nihongo`, nhánh `main`.
- 3 loại dữ liệu, đều cần file `.json` riêng + khai báo trong `index.json` của đúng thư mục:
  - `tailieu/` — bộ từ vựng (`TUVUNG`) / ngữ pháp (`NGUPHAP`), học bằng Flashcard/SRS/Bảng/Gõ hiragana/Trắc nghiệm/Ghép thẻ.
  - `dethi/` — đề thi trắc nghiệm chữ (đọc kanji, ngữ pháp, đọc hiểu...).
  - `dethi-choukai/` — đề luyện nghe (聴解), kèm audio đặt trong `file-nghe/`.
- **Quy tắc bất biến quan trọng nhất:** thêm file `.json` mới mà KHÔNG thêm tên file đó vào `index.json` tương ứng → app không lỗi gì cả nhưng file đó **không bao giờ xuất hiện**. Đây luôn là điều đầu tiên cần kiểm tra khi "tôi đã thêm mà sao không thấy".
- Mỗi lần sửa BẤT KỲ file `js/*.js` nào (10 module sau khi tách + `srs.js`), **phải tăng số version `?v=N` của ĐÚNG file đó** trong `index.html` (xem mục 1), nếu không trình duyệt/GitHub Pages có thể cache lại bản cũ, sửa code xong tưởng không có tác dụng. Không cần tăng version của các file không đổi.
- Khi giao file cho người dùng: **chỉ xuất đúng (các) file vừa thay đổi**, không xuất nguyên zip cả project trừ khi được yêu cầu rõ — đỡ công upload lại toàn bộ.

---

## 1. Cấu trúc thư mục hiện tại

```
itsductai-nihongo/
├── index.html
├── README.md                  (file này)
├── css/
│   └── style.css
├── js/
│   ├── srs.js                 (thuật toán ôn tập kiểu Anki + tính năng "Đã thuộc")
│   ├── core.js                 (App state, utils, render helpers, audio/speech)
│   ├── stats-weakness.js       (Theo dõi điểm yếu + lịch sử đề thi/nghe + trang Thống kê)
│   ├── config-focus.js         (Focus mode toàn màn hình + các config lưu localStorage)
│   ├── loader-nav.js           (Load decks/exams, dropdown, sidebar nav, switchDeck/setMode)
│   ├── flashcard-edit.js       (Panel cấu hình field/cột, modal sửa từ, mode Flashcard)
│   ├── table-srs-typing.js     (Mode Bảng, mode SRS, mode Gõ)
│   ├── quiz-match.js           (Mode Trắc nghiệm nhanh + mode Nối từ)
│   ├── exam.js                 (Toàn bộ tính năng "Luyện đề thi chữ")
│   ├── choukai.js               (Toàn bộ tính năng "Luyện nghe" — đề nghe + Luyện nghe câu)
│   └── init.js                  (Gắn event listener + khởi động app — PHẢI load SAU CÙNG)
├── tailieu/                    (bộ từ vựng / ngữ pháp — xem mục 3, 4)
│   ├── index.json
│   └── *.json                  (20 file hiện có — xem mục 22 để biết đầy đủ)
├── dethi/                       (đề thi trắc nghiệm chữ — xem mục 6)
│   ├── index.json
│   └── *.json                   (8 file hiện có)
├── dethi-choukai/                (đề luyện nghe — xem mục 19)
│   ├── index.json
│   └── choukai-NN.json           (hiện có choukai-01, 02, 18, 19)
└── file-nghe/                     (audio .m4a/.mp3 cho phần luyện nghe — Zane tự upload,
                                     KHÔNG đi qua Claude. Tên file phải khớp 100% với field
                                     audioFile/audioFiles trong từng choukai-NN.json)
```

### ⚠️ QUAN TRỌNG: `app.js` đã được TÁCH thành 10 module — KHÔNG còn 1 file lớn nữa

Trước đây toàn bộ logic nằm trong 1 file `js/app.js` (4740 dòng, ~200KB) — mỗi lần cần sửa
1 chỗ nhỏ, Claude phải đọc/ghi vào file rất lớn, tốn rất nhiều token/usage không cần thiết.
File đã được **cắt nguyên văn** (không sửa 1 ký tự nào, đã xác nhận khớp 100% byte-cho-byte
với bản gốc) thành 10 file nhỏ theo đúng tính năng — xem cây thư mục ở trên.

**Quy tắc bắt buộc khi sửa code từ giờ:**
1. **Xác định đúng module** cần sửa dựa theo tính năng (ví dụ: sửa gì liên quan đến đề nghe →
   chỉ cần đọc/sửa `js/choukai.js`, KHÔNG cần đọc cả 10 file).
2. Tất cả module vẫn dùng CHUNG 1 biến toàn cục `App` (định nghĩa trong `core.js`) và gọi hàm
   qua lại bình thường — đây KHÔNG phải ES module (không có `import`/`export`), chỉ là nhiều
   thẻ `<script>` tải tuần tự, nên **không cần lo về thứ tự load** giữa các module (trừ
   `init.js` luôn phải đứng CUỐI vì nó chạy code thực thi ngay lúc tải, cần các hàm ở module
   khác đã được định nghĩa xong).
3. **Tăng version `?v=N`** của ĐÚNG module vừa sửa trong `index.html` (không cần tăng version
   của các module không đổi) — xem dòng `<script src="js/xxx.js?v=N">`.
4. Nếu cần thêm 1 hàm MỚI mà không chắc nó thuộc module nào, đặt nó vào module có chứa các
   hàm liên quan gần nhất về mặt tính năng — không tạo file mới trừ khi tính năng đó đủ lớn
   để tách riêng (như cách `choukai.js` đã tách khỏi exam.js trước đây).



JavaScript chạy trong trình duyệt **không có cách nào tự liệt kê file trong 1 thư mục** qua HTTP thuần — đây là giới hạn của web, không phải hạn chế riêng của app này. Vì vậy app luôn quét dữ liệu bằng cách đọc file `index.json` của đúng thư mục.

**Quy trình (giống nhau cho cả 3 loại — `tailieu/`, `dethi/`, `dethi-choukai/`):**
1. Tạo file `.json` mới, đặt tên không dấu, không khoảng trắng (ví dụ `n3-co-ban.json`).
2. Viết nội dung theo đúng cấu trúc ở mục 3/4 (tailieu), mục 6 (dethi), hoặc mục 19 (dethi-choukai).
3. Mở `index.json` của đúng thư mục đó, thêm tên file vào mảng `files`.
4. Tải lại trang (hard refresh nếu vừa đổi file `.js` nào) — bộ mới tự xuất hiện trong dropdown sidebar.

**Thứ tự hiển thị trong dropdown KHÔNG phụ thuộc thứ tự trong `index.json`** — app tự sắp theo `title` bên trong từng file, dùng `localeCompare(title, "vi", { numeric: true })` (sắp theo chữ cái tiếng Việt CÓ DẤU đúng thứ tự, và hiểu số tự nhiên — "Unit 3" < "Unit 4" < "Unit 10" < "Unit 11", không bị xếp theo kiểu chuỗi ký tự thường "10" < "3"). Vì vậy **thứ tự ghi trong `index.json` không quan trọng cho việc hiển thị** — chỉ cần file có trong danh sách là đủ, có thể ghi theo bất kỳ thứ tự nào (khuyến nghị vẫn ghi theo A-Z cho dễ đọc bằng mắt khi mở file ra xem).

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
      "dong_nghia": [
        { "kanji": "逆転する", "doc": "ぎゃくてんする", "nghia": "đảo ngược tình huống" }
      ],
      "trai_nghia": []
    }
  ]
}
```

| Field | Bắt buộc | Giải thích |
|---|---|---|
| `kanji` | Có | Từ vựng gốc. Dùng làm khóa định danh `_id` — xem mục 9. |
| `doc` | Có | Cách đọc hiragana **thuần**, không chứa `**`. Dùng so khớp ở mode "Gõ hiragana". |
| `doc_marked` | Không | Giống `doc` nhưng đánh dấu trường âm bằng `**...**`. Để trống thì app dùng `doc`. Quy tắc đánh dấu — mục 5. |
| `han_viet` | Có | Âm Hán Việt, viết hoa. Từ thuần Nhật: `"(thuần Nhật)"`. Từ ngoại lai: `"(từ ngoại lai)"`. |
| `nghia` | Có | Nghĩa tiếng Việt. |
| `vi_du` | Có | Câu ví dụ + dịch: `câu tiếng Nhật。(dịch tiếng Việt.)`. Có thể nối nhiều câu cách nhau bằng dấu cách (không phải mảng, là 1 chuỗi). |
| `vi_du_ruby` | Không | Giống **câu đầu tiên** trong `vi_du`, nhưng kanji được bọc `<ruby>kanji<rt>đọc</rt></ruby>`. Chỉ cần ruby câu đầu, không cần toàn bộ `vi_du`. Nếu ví dụ viết bằng kana thật (vd từ đó người Nhật quy ước viết kana, không viết kanji) thì để nguyên không ruby — KHÔNG phải lỗi. |
| `dong_nghia` / `trai_nghia` | Không | Mảng — xem 2 format dưới đây. |

### `dong_nghia` / `trai_nghia` — 2 format, và **TÌNH TRẠNG THỰC TẾ HIỆN NAY (quan trọng)**

**Format mới (object đầy đủ — chuẩn cần hướng tới):**
```json
"dong_nghia": [
  { "kanji": "弱点", "doc": "じゃくてん", "nghia": "điểm yếu" }
]
```
`doc`/`nghia` có thể để trống nếu không cần, app vẫn hiện được (chỉ thiếu phần furigana/nghĩa kèm).

**Format cũ (chuỗi đơn giản — vẫn được app hỗ trợ hiển thị, KHÔNG bị lỗi/crash):**
```json
"dong_nghia": ["弱点", "短所"]
```
2 format trộn lẫn được trong cùng 1 mảng, app tự nhận diện đúng từng phần tử.

**⚠️ TÌNH TRẠNG THỰC TẾ — đã rà soát toàn bộ `tailieu/` (lúc viết tài liệu này):** phần lớn file vẫn dùng **format cũ** (chỉ có kanji, chưa có cách đọc/nghĩa kèm theo), KHÔNG đồng nhất với 1 số file mới hơn đã dùng format đầy đủ. Thống kê cụ thể (số lượng mục `dong_nghia`+`trai_nghia`):

| File | Format cũ (chuỗi) | Format mới (object) |
|---|---|---|
| `danh-tu-jlpt-n2.json` | 0 | 197 |
| `danh-tu-thiet-yeu.json` | 0 | 197 |
| `mimi-n2-unit3-adj.json` | 0 | 136 |
| `mimi-n2-unit11.json` | 0 | 114 |
| `mimi-n2-unit6-photu.json` | 31 | 0 |
| `mimi-n2-tunoi-photu.json` | 144 | 0 |
| `mimi-n2-unit4.json` | 14 | 0 |
| `mimi-n2-unit10-adj.json` | 188 | 0 |
| `mimi-unit8.json` | 301 | 0 |
| `nut-that-n2.json` | 40 | 0 |
| `nguphap-hoc-tu.json` | 83 | 2 |
| `nguphap-mau.json` | 3 | 0 |
| `nguphap-pham-vi-b-m11-dokkai.json` | 19 | 0 |
| `nguphap-top40-mimitry.json` | 3 | 0 |
| `nguphap-pham-vi-a-m789.json` | 0 | 0 |

**→ TODO còn tồn đọng:** ~826 mục đang ở format cũ, cần bổ sung cách đọc + nghĩa Việt để nâng cấp lên format mới. Đây là việc **tốn nhiều thời gian** (phải tra/xác nhận đúng cách đọc+nghĩa từng từ, không thể tự suy đoán đại trà vì dễ sai) — nên làm DẦN theo từng file khi có nhu cầu thực tế, không cố làm 1 lần. **Không phải lỗi/bug** — app vẫn chạy đúng, chỉ là card sẽ hiện "thiếu thông tin phụ" (chỉ thấy kanji, không thấy cách đọc+nghĩa của từ đồng/trái nghĩa đó).

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
      "vi_du": "<ruby>悪天候<rt>あくてんこう</rt></ruby>にもかかわらず、<ruby>試合<rt>しあい</rt></ruby>は<ruby>行<rt>おこな</rt></ruby>われた。(Mặc dù thời tiết xấu, trận đấu vẫn được diễn ra.)",
      "so_sanh_de_nham": [
        { "cautruc": "～のに", "khac_biet": "のに mang sắc thái cảm xúc cá nhân nhiều hơn; にもかかわらず khách quan, trang trọng hơn." }
      ],
      "dong_nghia": [],
      "trai_nghia": []
    }
  ]
}
```

| Field | Bắt buộc | Giải thích |
|---|---|---|
| `cautruc` | Có | Cấu trúc ngữ pháp, dùng làm `_id`. |
| `nghia` | Có | Ý nghĩa, cách dùng. |
| `muc_do` | Không | Mức trang trọng/văn nói-viết, chuỗi tự do. |
| `cau_truc_ngu_phap` | Không | Công thức (V/A/N + gì). |
| `vi_du` | Có | Câu ví dụ — **toàn bộ** kanji trong câu nên có `<ruby>`, không có field `vi_du_ruby` riêng cho NGUPHAP (viết ruby trực tiếp trong `vi_du`). |
| `so_sanh_de_nham` | Không | Mảng `{cautruc, khac_biet}`. |
| `dong_nghia` / `trai_nghia` | Không | Cùng 2 format với mục 3 — xem bảng tình trạng thực tế ở trên. |

Mode "Gõ hiragana" và "Ghép thẻ" chỉ thiết kế cho TUVUNG, không hiện khi học NGUPHAP.

---

## 5. Quy tắc đánh dấu trường âm (`doc_marked`)

Bọc đoạn cần tô đỏ trong `**...**`, app tự chuyển thành `<span class="choon">`.

- おう/こう/ごう/とう/どう/のう/ぼう/もう/ろう/よう/ぞう/そう + biến thể raised-kana (しょう/ちょう/じょう/りょう/きょう/ぎょう/ひょう/びょう/みょう) → đánh dấu cả 2 ký tự.
- ゅう/ゆう (kyuu, shuu, juu...) → đánh dấu cả 2 ký tự.
- けい/せい/てい/ねい/へい/めい/れい/げい/ぜい/でい/べい/ぺい + えい (nhóm e+i) → đánh dấu cả 2 ký tự.
- くう/つう (nguyên âm kéo dài đơn giản) → đánh dấu cả 2 ký tự.
- Katakana có dấu `ー` → đánh dấu ký tự trước nó + dấu `ー`.

Có thể sửa trực tiếp trong app qua nút "✎ Sửa" (bôi đen đoạn cần đánh dấu, bấm nút) — xem mục 9.

---

## 6. Cấu trúc đề thi trắc nghiệm chữ (`dethi/`)

```json
{
  "title": "Mondai 1 - Đọc kanji (mẫu N2 2023-12)",
  "questions": [
    {
      "de_bai": "次の文の＿＿＿の言葉の読み方として最もよいものを、1・2・3・4から一つ選びなさい。\n会議の内容を<u>簡潔</u>にまとめてください。",
      "options": ["かんせつ", "かんけつ", "かんきつ", "かんかつ"],
      "dap_an_dung": 1,
      "giai_thich": ["Sai. ...", "Đúng. ...", "Sai. ...", "Sai. ..."]
    }
  ]
}
```

| Field | Bắt buộc | Giải thích |
|---|---|---|
| `de_bai` | Có | Đề bài, `\n` để xuống dòng. **Mondai 1/2/4** (đọc kanji, viết kanji, từ vựng theo văn cảnh): nên bọc `<u>...</u>` quanh từ/kanji đang được hỏi trong câu — app render bằng `innerHTML` nên tag này hoạt động, có CSS riêng tô màu nhấn (`.exam-question u`). |
| `options` | Có | Đúng 4 chuỗi. |
| `dap_an_dung` | Có | Index 0-based đáp án đúng. |
| `giai_thich` | Không | Đúng 4 chuỗi theo thứ tự `options`. Để trống thì nút "Xem giải thích" không hiện cho câu đó. **Quy tắc viết:** ngắn gọn, dễ hiểu, KHÔNG dùng thuật ngữ ngữ âm học khó (ví dụ tránh nói "âm bán trọc/handakuten" — chỉ cần nói từ đó không tồn tại hoặc trùng cách đọc với từ khác thì nêu nghĩa từ đó). |

**2 chế độ chấm (chọn mỗi lần bắt đầu đề qua modal):**
- **⚡ Chấm ngay tại chỗ** — trả lời → tô đúng/sai ngay, có giải thích, nút "Tiếp tục". Sai → đẩy về cuối hàng đợi làm lại tới khi đúng. Có nút **"🚪 Thoát & xem kết quả"** để dừng giữa chừng (chỉ hiện ở mode này) — tính điểm theo những gì đã làm, câu chưa làm hiện riêng biệt "chưa làm" (không tính sai).
- **📝 Chấm sửa cuối bài** — làm hết 1 lượt theo thứ tự gốc, không biết đúng/sai lúc làm, cuối bài hiện bảng đầy đủ.

**Kết quả cuối bài (cả 2 mode) — lưới ô tròn nhỏ:** mỗi câu 1 ô, xanh = đúng / đỏ = sai / xám = chưa làm (chỉ xuất hiện khi dùng "Thoát & xem kết quả"). Bấm vào ô → mở popup chi tiết: đề bài (có gạch chân nếu có `<u>`), 4 đáp án kèm tag "Đáp án đúng"/"Bạn đã chọn", giải thích riêng từng đáp án.

**Lưu lịch sử + xem lại không cần làm lại:** mỗi lần hoàn thành đề, hệ thống lưu **2 tầng**:
- `n2vocab_exam_history` — điểm tổng từng đề (điểm, số lần làm, thời gian).
- `n2vocab_exam_detail_history` — chi tiết từng câu của **lần làm gần nhất** (đáp án đã chọn, đúng/sai) — dùng để vẽ lại lưới kết quả + popup chi tiết SAU KHI đã rời app/tải lại trang/nhập từ máy khác, không cần làm lại đề. Khi chọn 1 đề đã có lưu, modal chọn chế độ chấm sẽ hiện thêm nút **"📊 Xem kết quả lần làm gần nhất"**.

Cả 2 đều nằm trong file Xuất/Nhập tiến độ (mục 12).

**Tab "Đề thi" trong trang Điểm yếu:** gộp câu sai từ MỌI đề đã làm (dùng deckId giả `"__exam__"`, itemId dạng `"examId::qN"`), bấm vào dòng mở lại đúng popup chi tiết.

---

## 7. Cách app định danh (`_id`)

```
_id = "<tên file (không đuôi .json)>::<kanji hoặc cautruc>"
```
Dùng nội dung làm khóa (không dùng index mảng) để `_id` ổn định khi sắp xếp lại thứ tự từ trong file. Trùng kanji/cautruc trong cùng file → tự thêm hậu tố `#2`, `#3`...

**Đổi tên file `.json` = đổi toàn bộ `_id` bên trong** → mất khớp tiến độ SRS cũ. Tránh đổi tên file đã học một thời gian; nếu cần, export tiến độ trước.

---

## 8. SRS (kiểu Anki) + tính năng "⭐ Đã thuộc"

3 nút thường: **Quên / Khó / Dễ** — công thức SM-2 đơn giản hóa trong `js/srs.js`:

| Nút | Lần đầu | Các lần sau |
|---|---|---|
| Quên | 1 phút | luôn về 1 phút; ease -0.2 (sàn 1.3) |
| Khó | 6 phút | interval × 1.2; ease -0.05 |
| Dễ | 10 phút | interval × ease (nếu <1 ngày) hoặc × (ease+1.5) (nếu ≥1 ngày); ease +0.1 (trần 3.5) |

Trạng thái: `new` (chưa học) / `learning` (<1 ngày) / `known` (≥1 ngày, "đã thuộc" tự nhiên).

**Nút thứ 4 riêng — "⭐ Đã thuộc"** (thêm mới): dành cho từ đã học vững ở nơi khác (Anki/Quizlet/sách giấy...), KHÔNG muốn đi từng bước Quên→Khó→Dễ. Bấm vào đẩy thẳng `intervalMin = 60 ngày` (86400 phút), set `entry.mastered = true`, trạng thái hiển thị riêng là `mastered` (≠ `known`, nhưng **được tính chung vào nhóm "known" ở thanh % tổng quan** để không bị lệch số liệu). Nếu sau 60 ngày từ đó tới hạn ôn lại và được rate bằng 1 trong 3 nút thường, cờ `mastered` tự tắt — coi như đang ôn THẬT lại từ đầu.

Filter riêng trong Bảng: `"⭐ Đã thuộc (đánh dấu tay)"` (value=`mastered`) tách biệt với `"Đã thuộc (tự nhiên)"` (value=`known`).

**3 lỗi đã từng có và đã sửa khi thêm tính năng này** (ghi lại để tránh tái phát nếu sửa `SRS.status()` lần sau): mọi nơi trong code (chủ yếu `stats-weakness.js`, `table-srs-typing.js`) so sánh `status === "known"` đều phải nhớ thêm nhánh `=== "mastered"` (đếm % tổng quan ở `computeDeckStats`, số đếm "đã thuộc lâu" đầu trang SRS, label badge trong Bảng) — nếu quên, các mục `mastered` sẽ bị tính lẫn vào "chưa học" hoặc hiện chữ "undefined".

---

## 9. Sửa tạm trong app (nút ✎ Sửa)

Lưu vào `localStorage` (`n2vocab_editpatches`), áp đè lên dữ liệu gốc mỗi lần mở app — **không sửa file gốc trên đĩa** (giới hạn an toàn của mọi web app). Field sửa được: TUVUNG (`kanji, doc, doc_marked, han_viet, nghia, vi_du, vi_du_ruby, dong_nghia, trai_nghia`), NGUPHAP (`cautruc, nghia, muc_do, cau_truc_ngu_phap, vi_du, dong_nghia, trai_nghia`). Sửa `doc_marked` → tự đồng bộ lại `doc` (bỏ `**`).

**Muốn lưu vĩnh viễn vào file gốc:** Xuất tiến độ → tìm `editPatches` trong file xuất ra → tự tay copy vào đúng file JSON trong `tailieu/`.

---

## 10. Trang Thống kê (Stats)

3 phần: (1) bảng tổng quan mọi bộ từ vựng/ngữ pháp — tách riêng 2 nhóm "📘 Mimi N2 (giáo trình chính)" và "📚 Tài liệu khác" (dựa trên field `series`), mỗi nhóm có **biểu đồ tròn (donut) tổng quan** (SVG thuần, hàm `buildDonutSvg()` trong `stats-weakness.js`) hiện % đã thuộc CHUNG của cả nhóm + 🏆 bộ mạnh nhất / ⚠ bộ cần ưu tiên, kèm bảng chi tiết từng bộ với thanh % 3 màu; (2) bảng đề thi chữ; (3) bảng đề luyện nghe. Bấm tên bộ/đề → nhảy thẳng vào học/làm ngay.

**MỚI: Lưu & xem lại NHIỀU LẦN làm 1 đề** — mỗi đề thi chữ/đề nghe giờ hiện thêm **"🏆 Tốt nhất: x/y"** (điểm cao nhất trong mọi lần đã làm, không chỉ lần gần nhất) và nút **"📊 Xem lưới N lần làm"**. Bấm vào mở modal **lưới kết quả**: hàng ngang = số câu (1, 2, 3...), cột dọc = "Lần 1, Lần 2, Lần 3..." theo đúng thứ tự thời gian đã làm. Câu **SAI** ở lần đó → vòng tròn **ĐỎ**, bên trong hiện **số đáp án ĐÚNG** (1-4, tra trực tiếp từ file đề JSON, không lưu trùng lặp). Câu **ĐÚNG** → vòng tròn **XANH**, không hiện gì bên trong. Nhìn 1 lần là biết ngay câu nào sai từ lần đầu và đã khắc phục được chưa qua các lần sau.

- **Chỉ lưu khi HOÀN THÀNH hẳn 1 đề** (gọi trong `finishExam()`/`finishChoukai()`) — bỏ ngang giữa đường (đổi đề, chuyển mode, tắt trang) **KHÔNG lưu gì cả**, đúng yêu cầu. "Dừng sớm và xem kết quả" (nút thoát giữa bài có xác nhận) VẪN được coi là hoàn thành (người dùng chủ động chọn kết thúc), câu chưa làm tới sẽ hiện dấu "—" (không tính đúng/sai) trong lưới.
- Lưu trữ: `n2vocab_exam_attempts` / `n2vocab_choukai_attempts` — mỗi đề là 1 mảng các lần làm `{completedAt, score, total, results}` (results chỉ lưu đúng/sai từng câu, KHÔNG lưu đáp án đúng vì luôn tra sống từ file đề — tránh dữ liệu trùng lặp, file đề sửa nội dung sau cũng không làm sai lệch lịch sử). Giới hạn tối đa 50 lần/đề (`MAX_ATTEMPTS_KEPT`), lần cũ nhất bị loại nếu vượt.
- **Tự động nâng cấp (migrate) dữ liệu CŨ**: nếu 1 đề chưa có gì trong hệ mới nhưng có snapshot CŨ (`n2vocab_exam_detail_history`/`n2vocab_choukai_detail_history`, lưu duy nhất bản gần nhất từ trước khi có tính năng này), tự động biến nó thành "Lần 1" — không mất lịch sử Zane đã làm trước đó. **Thứ tự gọi quan trọng**: `recordExamAttempt()`/`recordChoukaiAttempt()` PHẢI chạy TRƯỚC `saveExamDetailSnapshot()`/`saveChoukaiDetailSnapshot()` trong hàm finish — nếu đảo ngược, đoạn migrate sẽ đọc nhầm snapshot VỪA ghi của lần hiện tại thành "dữ liệu cũ", tạo ra 1 lần làm trùng lặp giả (bug đã gặp và sửa, xem mục bug log).
- Đã thêm vào **Export/Import** (mục 12) — gộp theo `completedAt`, không trùng lặp giữa nhiều máy.

---

## 11. Trang Điểm yếu — 3 tab

`"Từ vựng/Ngữ pháp (bộ đang chọn)"` / `"Đề thi (mọi đề)"` / `"Nghe (mọi đề)"`. Mỗi lần trả lời đúng/sai ở **6 chế độ học** + **luyện nghe** đều ghi vào `n2vocab_weakness_stats`.

**MỚI: Hệ thống "hệ số quan trọng" (priority) thay cho tỉ lệ sai cũ** — thông minh hơn, ưu tiên đúng theo yêu cầu "sai lần đầu rất quan trọng":
- **Sai ở LẦN ĐẦU TIÊN** gặp câu/từ đó → `priority` khởi đầu **CAO NGAY (100)**. Đúng ngay từ đầu → khởi đầu **0** (chưa coi là điểm yếu).
- Mỗi lần làm **ĐÚNG** tiếp theo (bất kể đầu sai hay không) → `priority` **giảm 25** (tối thiểu 0) — đúng liên tục 4 lần thì hết hẳn là điểm yếu.
- Mỗi lần làm **SAI** (kể cả không phải lần đầu) → `priority` **tăng 35** (tối đa 100) — sai lại thì coi là điểm yếu nghiêm trọng ngay.
- Chỉ hiện trong danh sách điểm yếu khi `priority > 0`, sắp giảm dần theo `priority` — câu/từ dai dẳng sai luôn nổi lên đầu.
- UI: mỗi dòng có **thanh + số priority màu đỏ/vàng/xanh** (hàm `renderPriorityBadge()`) + tag **"⚠ sai từ lần đầu"** nếu đúng vậy.
- Dữ liệu CŨ (lưu trước khi có hệ này, thiếu field `priority`) tự "nâng cấp" ở lần ghi kết quả tiếp theo (`getEntryPriority()` ước lượng tạm theo tỉ lệ sai hiện có).

---

## 12. Xuất / Nhập tiến độ

File xuất gồm: `srsProgress, fieldConfig, visibleCols, peekCols, editPatches, starredItems, weaknessStats, examHistory, examDetailHistory, examAttempts, choukaiHistory, choukaiDetailHistory, choukaiAttempts, shuffleEnabled, soundEnabled, speechEnabled`.

Khi nhập: `weaknessStats` cộng dồn (không đè). `examDetailHistory`/`choukaiDetailHistory` lấy theo `savedAt` mới hơn. `examHistory`/`choukaiHistory` cộng `totalCompletions`, lấy `lastScore` theo `lastCompletedAt` mới hơn. **`examAttempts`/`choukaiAttempts` (MỚI): GỘP mảng 2 máy lại, loại trùng theo `completedAt`, sắp lại theo thời gian** — đảm bảo lưới kết quả đúng đủ dù học trên nhiều máy khác nhau, không trùng lặp khi export/import lại nhiều lần. Phần còn lại gộp không trùng lặp.

---

## 12b. Ghi chú đề thi / đề nghe (MỚI) + gọn hóa chọn đề thi

**Gọn hóa UI chọn đề thi**: dropdown `#examPicker` đã CHUYỂN từ sidebar vào thẳng trong tab "Làm đề thi" (`.quiz-head`), giống cách "Luyện nghe theo đề" đã làm (`#choukaiPicker` trong `.view-head`) — không cần qua sidebar nữa.

**Ghi chú (note)**: BÔI ĐEN (chọn) 1 đoạn text trong câu hỏi/đáp án/giải thích — áp dụng CẢ lúc làm đề thi chữ (`#examQuestion`, `#examOptions`, `#examExplainBox`) VÀ đề luyện nghe (`#choukaiPrompt`, `#choukaiOptions`, `#choukaiReviewContent`) — nút nổi "📝 Ghi chú" hiện cạnh đoạn vừa chọn, gõ nghĩa/ghi nhớ rồi lưu. Đoạn đó được bọc `<mark class="exam-note-mark">` (vàng, gạch chân chấm), giữ nguyên khi điều hướng qua câu khác rồi quay lại (tự áp lại lúc render).

**Sửa ghi chú**: bấm trực tiếp vào phần đã bôi vàng (`<mark>`) — MỞ LẠI popup ngay tại đó để sửa nội dung, không cần qua trang riêng. Cũng sửa được từ trang "Ghi chú" qua nút ✎.

**Trang "📝 Ghi chú"** (nav mới, sau "Làm đề thi"): nhóm theo đề (📄 đề thi chữ, 🎧 đề nghe), trong mỗi đề sắp theo số câu. Bấm "Câu N"/"mXqY" → nhảy thẳng tới đúng câu đó (đề thi: mở modal xem chi tiết; đề nghe: bắt đầu lại đề rồi tự nhảy tới đúng vị trí trong queue — hàm `jumpToChoukaiNote()`), kèm highlight luôn. Nút ✎ sửa, ✕ xóa.

**Lưu trữ**: 2 key riêng `n2vocab_exam_notes` / `n2vocab_choukai_notes`, cấu trúc `{ [examId/testId]: { [qIndex/qKey]: [ {id, text, note, createdAt} ] } }` (qKey đề nghe = chuỗi `choukaiKeyFor()`, vd `"m2q3"`). Hàm lõi DÙNG CHUNG cho cả 2 loại đề (`loadNotesRawG/addNoteG/updateNoteG/deleteNoteG/getNotesForQuestionG/applyNoteHighlights` trong `exam.js`, nhận tham số `kind: "exam"|"choukai"`) — các tên hàm CŨ riêng đề thi chữ (`loadExamNotesRaw`, `addExamNote`...) vẫn giữ làm wrapper mỏng gọi xuống hàm chung, không phải sửa lại chỗ đã gọi trước đó.

**⚠️ CHƯA có trong Export/Import** (mục 12) — 2 key `n2vocab_exam_notes`/`n2vocab_choukai_notes` hiện chỉ lưu trên 1 máy, chưa đồng bộ đa máy. Cần làm thêm nếu Zane muốn ghi chú theo qua nhiều máy.

**Bug đã gặp và sửa lúc làm tính năng này**: `jumpToChoukaiNote()` lúc đầu gọi `applyNoteHighlights()` thêm 1 lần SAU khi đã gọi `renderChoukaiQuestion()` (hàm này tự áp highlight bên trong rồi) → bị áp 2 lần, tạo `<mark>` LỒNG trong `<mark>`. Đã sửa: bỏ lệnh gọi thừa, chỉ để `renderChoukaiQuestion()` tự áp 1 lần duy nhất.

---

## 12d. Điểm mô phỏng JLPT (Linear Score + Simulated IRT Score)

Sau khi hoàn thành đề thi chữ HOẶC đề nghe, hiện thêm khối **"📊 Mô phỏng điểm JLPT"** (thang 0-60) ngay dưới điểm thô, dựa trên tài liệu đặc tả "JLPT N2 Scoring Engine" Zane cung cấp.

**Trọng số theo số thứ tự Mondai — CỐ ĐỊNH, không cần phân biệt FORMAT_OLD/FORMAT_NEW** (đã đối chiếu kỹ tài liệu đặc tả: trọng số mỗi Mondai giống nhau giữa 2 format, chỉ SỐ CÂU một vài Mondai khác nhau — nên không cần cấu hình old/new riêng, chỉ cần biết Mondai nào có BAO NHIÊU CÂU TRONG ĐỀ NÀY):
- Từ vựng-Ngữ pháp: M1-7 = ×1đ, M8-9 = ×2đ
- Đọc hiểu: M10-14 = ×3đ (chưa có đề nào dùng tới, để sẵn cho sau)
- Nghe hiểu: M1=×2, M2=×2.5, M3=×3, M4=×1, M5=×3

**2 công thức** (`js/scoring.js`, hàm `calculateLinearScore`/`calculateIRTScore`):
- Linear: `round((raw/maxRaw) * 60)` — chia tỉ lệ đều.
- IRT mô phỏng: `round(60 * (raw/maxRaw)^1.15)` — phạt nặng hơn ở vùng điểm thô thấp (mô phỏng IRT thật chống khoanh lụi).

**Linh động theo đúng cấu trúc THẬT của từng đề** ("tùy đề tùy mondai" theo đúng yêu cầu):
- Đề thi chữ: thêm field mới `mondai_breakdown` (mảng `{mondai, ten, so_cau}` liên tiếp) vào TOP-LEVEL mỗi file `dethi/*.json` — đã thêm cho cả 8 file hiện có, xác minh khớp 100% bằng cách dò ranh giới câu chỉ dẫn (`de_bai`) thật trong dữ liệu trước khi gán (4 đề Mondai 1-9 đủ 51 câu, 3 đề chỉ Mondai 1-6 = 30 câu, 1 đề mẫu chỉ Mondai 1 = 3 câu). **Đề mới thêm sau này PHẢI tự thêm field này** (không có thì khối điểm JLPT sẽ không hiện, không lỗi).
- Đề nghe: KHÔNG cần thêm field gì — đếm trực tiếp từ cấu trúc `test.mondai[]` đã có sẵn. Nếu chỉ luyện riêng 1 Mondai (`App.choukaiMondaiFilter`), điểm chỉ tính trên ĐÚNG Mondai đó, không tính sai vào các Mondai chưa luyện.
- Đã test thực tế đề nghe `choukai-01` có cấu trúc KHÔNG chuẩn hẳn theo OLD/NEW (M4=11 câu kiểu NEW nhưng M5=4 câu kiểu OLD) — code vẫn tính đúng vì chỉ dựa vào số câu THẬT, không giả định cứng theo 1 format nào.

**Bug đã gặp lúc làm**: `loadExams()` (`loader-nav.js`) chỉ whitelist đúng 3 field `id/title/questions` khi đọc file đề thi, làm `mondai_breakdown` mới thêm bị rớt mất hoàn toàn — đã sửa thêm field này vào danh sách giữ lại.

**Hiển thị**: `renderJlptScoreBox()` trong `scoring.js` — Linear + IRT to, điểm thô nhỏ hơn, có `<details>` xem breakdown từng Mondai, kèm dòng disclaimer rằng đây là điểm MÔ PHỎNG tham khảo, không phải điểm thi thật.

**Đã lưu vào lịch sử + Export/Import** (sửa sau khi Zane hỏi lại) — lúc đầu 2 điểm này chỉ tính tạm lúc hiện kết quả rồi MẤT, không lưu ở đâu. Đã sửa: `recordExamAttempt()`/`recordChoukaiAttempt()` (`stats-weakness.js`) giờ tính và lưu thêm `linearScore`/`irtScore` ngay vào MỖI lần làm trong `n2vocab_exam_attempts`/`n2vocab_choukai_attempts` — đúng object đã có sẵn cơ chế Export/Import (mục 12) từ trước, nên **KHÔNG cần sửa thêm gì ở phần export/import**, 2 điểm này tự động được gộp theo khi xuất/nhập. Cũng hiện thêm "· Linear N / IRT N" ngay trong dòng "Lần X" ở lưới kết quả nhiều lần làm (mục 12b) để xem lại tiến triển điểm mô phỏng qua từng lần.

---



Schema NGUPHAP (mục 4) đã có sẵn `so_sanh_de_nham` ({cautruc, khac_biet}) và `dong_nghia` — chỉ là **chưa được khai thác hiệu quả**: `dong_nghia` đa số file (`pham-vi-a-m789`, `top40-mimitry`...) chỉ lưu CHUỖI THÔ (vd `["～ものの"]`), không có nghĩa kèm theo.

**Đã làm — KHÔNG cần sửa lại file JSON nào:**
- `buildGrammarIndex()` (`core.js`) — gộp TẤT CẢ cấu trúc của mọi bộ NGUPHAP đang có thành 1 index tra cứu `cautruc -> cả entry`, build lúc khởi động + sau khi xóa sửa tạm + sau khi sửa 1 từ qua modal ✎.
- `enrichGrammarSynonym()` — khi render `dong_nghia` cho NGUPHAP, nếu mục đó là chuỗi thô thì TỰ TRA cứu qua index để lấy nghĩa thật, hiện kèm luôn (không sửa file gốc, chỉ enrich lúc hiển thị).
- Nút **"🔗 Xem ngữ pháp liên quan / dễ nhầm"** tự hiện trên mặt thẻ (flashcard/SRS) khi mặt đó có cấu hình hiện field `dong_nghia` hoặc `so_sanh_de_nham` VÀ từ đó thực sự có dữ liệu. Bấm vào mở popup gồm 2 phần:
  - 🟢 **Đồng nghĩa** — liệt kê cấu trúc + nghĩa thật (tra qua index).
  - ⚠️ **Dễ nhầm** — liệt kê cấu trúc + ghi chú phân biệt (`khac_biet`, đã có sẵn trong data) + nghĩa thật nếu tra được.
- Hàm: `openGrammarRelatedPopup(cautruc)` / `closeGrammarRelatedPopup()` (`flashcard-edit.js`), modal `#grammarRelatedModalOverlay` (`index.html`).

**CHƯA làm (đã trao đổi, để sau nếu cần)**: trang riêng "Nhóm ngữ pháp" gom theo nhãn để xem tổng quan cả hệ thống, và mode flashcard chuyên biệt để LUYỆN phân biệt các cặp dễ nhầm. Popup hiện tại đã giải quyết phần lớn nhu cầu xem nhanh lúc học bình thường.

---

## 12e. 3 việc lớn: sửa data ngữ pháp toàn bộ + thống kê theo cấu trúc + học SRS gộp bộ

**1) Data ngữ pháp đã rà soát lại toàn bộ** (`grammar_excel/classify.py`, `build_web_json.py`, `build_excel3.py` — script làm việc, không nằm trong app, giữ lại để tái tạo data khi cần): phát hiện nhóm "00. Khác/Cần xếp tay" gom tới 25 mục bị bỏ sót phân loại + phát hiện lỗi gõ nhầm dấu `-`/`/` làm vài nhóm bị TÁCH ĐÔI thành 2 nhóm gần giống tên nhau (vd "03. Nhượng bộ - ..." và "03. Nhượng bộ / ..." là 2 nhóm khác nhau trong code dù đọc y như nhau). Đã sửa toàn bộ bằng `MANUAL_OVERRIDE` dict trong `classify.py` — giờ đúng 16 nhóm sạch, không trùng, 186 mục (163 gốc + 23 bổ sung). `data/grammar-groups.json` và file Excel đều build lại từ `entries_full.json` (nguồn DUY NHẤT dùng chung, tránh lệch giữa web/Excel).

**2) Trang Thống kê — mục mới "📖 Ngữ pháp — theo từng cấu trúc"**: giống cách trình bày Mimi N2 (donut + bảng % đã thuộc) nhưng ở MỨC TỪNG CẤU TRÚC riêng lẻ thay vì gộp theo bộ — vì 1 bộ NGUPHAP có thể chứa vài chục cấu trúc, gộp theo bộ sẽ che mất "cấu trúc A đã thuộc, cấu trúc B cùng bộ vẫn yếu". Hàm `renderStatsGrammarItems()` (`stats-weakness.js`), gọi trong `renderStatsMode()`. Sắp yếu nhất lên đầu, bấm vào 1 cấu trúc nhảy đúng bộ chứa nó + mở SRS luôn.

**3) Học SRS gộp nhiều bộ ngữ pháp tùy ý** ("Anki-style", tái dùng 100% giao diện/thuật toán SRS có sẵn, không làm lại từ đầu): nút "🔀 Học SRS gộp nhiều bộ" ở đầu trang Nhóm ngữ pháp → modal chọn checkbox các bộ → `startComboSrs(deckIds)` (`table-srs-typing.js`) gộp `words` + `progress` của các bộ đã chọn thành 1 phiên học chung.
- **Then chốt kỹ thuật**: `_id` mỗi từ đã có dạng `deckId::key` từ trước (hàm `wordId()` trong `core.js`) — không trùng giữa các bộ, gộp an toàn không cần sửa gì thêm.
- **Lưu progress đúng**: lúc đánh giá thẻ trong phiên gộp, KHÔNG thể lưu chung 1 chỗ — `saveComboProgress()` tách lại đúng theo từng `deckId` gốc (lấy từ tiền tố `_id`) rồi lưu riêng vào progress THẬT của từng bộ, y như học bình thường. Đã thêm `saveCurrentSrsProgress()` (wrapper tự nhận biết combo hay không) thay cho MỌI lệnh `SRS.saveProgress(App.currentDeckId, App.progress)` cũ trong `table-srs-typing.js`, `flashcard-edit.js`, `quiz-match.js` — phòng trường hợp lỡ qua Flashcard/Quiz giữa lúc đang combo cũng không bị lưu lạc vào key ảo `"__combo__"`.
- Rời combo (chọn lại 1 bộ bình thường ở sidebar) tự reset `App.srsComboActive = false` trong `switchDeck()`.
- Đã test: gộp 2 bộ → đánh giá 1 thẻ → xác nhận entry THẬT trong progress của đúng bộ gốc đã cập nhật (seen, reps, lastRating...), KHÔNG có key `"__combo__"` rác nào được tạo ra.

---

## 13-18. Các tính năng nhỏ khác (giữ nguyên từ trước, chưa đổi)

- **Tùy chỉnh giao diện**: ⚙ Mặt thẻ (chọn field hiện trước/sau), ☷ Cột (ẩn/hiện + "ẩn để tự kiểm tra"), ⤮ Ngẫu nhiên (áp dụng từ phiên học tiếp theo).
- **⛶ Focus mode**: ẩn sidebar, tăng cỡ chữ, thoát bằng ✕ hoặc Esc.
- **Gõ hiragana**: tự luận thật, không hiện gợi ý sẵn. Nút 💡 Gợi ý (hiện thêm 1 ký tự) / 👁 Xem đáp án (tính chưa nhớ).
- **Âm thanh + phát âm**: nút 🔊 (beep đúng/sai, không áp dụng Flashcard/SRS) và 🗣 (đọc to khi lật thẻ, cần 1 tương tác chạm đầu tiên trên mobile để "mở khóa").
- **Luyện tốc độ 30s/câu**: chỉ áp dụng đề thi chữ, không khóa khi quá giờ, chỉ cảnh báo màu.
- **Đề thi nâng cao**: xem lại câu đã làm (← →), tô chọn text được, 2 mốc thời gian (lượt đầu / sửa câu sai), lịch sử sai từng câu.
- **Flashcard (Quizlet-style) ≠ SRS (Anki-style)**: Flashcard là hàng đợi trong 1 phiên ngắn (Chưa nhớ→quay lại sau 3 thẻ, Khó→sau 7 thẻ, Đã nhớ→ra hẳn); SRS là lịch ôn trải dài theo thời gian thật. Phím tắt Flashcard: ←Chưa nhớ ↑Khó ↓Lật →Đã nhớ.
- **Đánh dấu ★**: không ảnh hưởng SRS, có toggle học riêng từ đã sao ở Flashcard/SRS, filter riêng ở Bảng.

*(Chi tiết đầy đủ từng mục — nếu cần xem sâu hơn, đọc trực tiếp code tương ứng trong module phù hợp — xem cây thư mục mục 1 để biết tính năng nào nằm ở file nào — phần cốt lõi các mục này không đổi qua nhiều phiên làm việc.)*

---

## 19. Cấu trúc đề luyện nghe (`dethi-choukai/`) — TÍNH NĂNG MỚI, đầy đủ chi tiết

```json
{
  "id": "choukai-01",
  "title": "聴解 1 (JLPT N2 2011/07)",
  "year": "2011/07",
  "audioMode": "combined",
  "audioFile": "聴解 1.m4a",
  "audioFiles": null,
  "mondai": [
    {
      "number": 1, "name": "課題理解",
      "instruction": "Hướng dẫn tiếng Việt hiện phía trên audio player",
      "questions": [
        {
          "qnum": 1,
          "prompt": "Câu hỏi đọc trước khi nghe (Mondai 1/2). NULL cho Mondai 3/4/5 (không có câu hỏi trước).",
          "options": ["4 lựa chọn..."],
          "correctIndex": 0,
          "script": "Toàn bộ transcript hội thoại tiếng Nhật (mỗi lượt nói 1 dòng, cách nhau \\n)",
          "scriptVi": "Bản dịch tiếng Việt, CÙNG SỐ DÒNG \\n như script (để chế độ Luyện nghe câu ghép cặp đúng)",
          "tip": "Mẹo nghe/giải thích ngắn gọn — KHÔNG breakdown từng đáp án như đề thi chữ",
          "keywords": ["chỉ có ở Mondai 3 & 5", "vài từ khóa gợi ý"]
        }
      ]
    }
  ]
}
```

### Quy tắc cấu trúc Mondai (đúng định dạng JLPT N2 thật — đã xác nhận qua nhiều đề thật)
| Mondai | Tên | Số câu thường gặp | Đặc điểm |
|---|---|---|---|
| 1 | 課題理解 | 5 | Có `prompt` (câu hỏi đọc trước), 4 lựa chọn HÀNH ĐỘNG. |
| 2 | ポイント理解 | 6 | Có `prompt`, có THỜI GIAN ĐỌC trước 4 lựa chọn rồi mới nghe hội thoại. |
| 3 | 概要理解 | 5 | **`prompt: null`** — không có lựa chọn in sẵn, không câu hỏi trước. Nghe hết đoạn → mới nghe câu hỏi+4 lựa chọn. |
| 4 | 即時応答 | 11-12 (thay đổi theo năm) | **`prompt: null`**, KHÔNG có `script` hội thoại dài — chỉ 1 câu nói ngắn (`script`) + 3 lựa chọn phản hồi (không phải 4!). Có thêm field `optionsVi` (dịch các lựa chọn, vì chúng quá ngắn không cần format câu+dịch chung). |
| 5 | 統合理解 | 2 câu đơn + 1 câu có **2 câu hỏi con** (`isDualQuestion: true` + `subQuestions: [{label, promptVi, options, correctIndex}, ...]`) = tổng 3-4 điểm. |

### Field cấp `audioMode` — 2 kiểu file âm thanh
- `"combined"` — 1 file audio DUY NHẤT cho cả đề (field `audioFile`, `audioFiles: null`). App tự cảnh báo "tự kéo thanh thời gian tới đúng đoạn" vì không tách được audio theo câu.
- `"split"` — mỗi Mondai 1 file riêng (field `audioFiles: {"1": "...", "2": "...", ..., "5": "..."}`, `audioFile: null`). Đây là kiểu PHỔ BIẾN HƠN — Zane xác nhận từ đề 2 trở đi audio luôn được tách sẵn theo Mondai (tên file dạng `聴解 N M.m4a/mp3`, M=số Mondai 1-5). **Lưu ý:** dù Mondai 5 có 3 đoạn nghe (2 câu đơn + 1 câu có 2 câu hỏi con), cả 3 đoạn đó vẫn nằm chung trong **1 file duy nhất** `聴解 N 5.m4a` — file lấy theo SỐ MONDAI, không phải theo từng câu riêng.
- **Tên file phải khớp CHÍNH XÁC** với tên thật trên GitHub (kể cả khoảng trắng, kể cả đuôi `.m4a` hay `.mp3` — đã từng bị lệch đuôi vì đoán theo mẫu cũ, luôn đối chiếu ảnh chụp GitHub thật, không suy đoán).

### Quy tắc viết `script`/`scriptVi`/`tip`
- `script`: transcript tiếng Nhật, mỗi câu nói của 1 người = 1 dòng riêng (`\n`), bắt đầu bằng `女:`/`男:` nếu hội thoại 2 người. Câu hỏi đặt ở dòng cuối (lặp lại prompt).
- `scriptVi`: dịch tương ứng, **PHẢI cùng số dòng `\n`** như `script` — vì chế độ "Luyện nghe câu" (mục dưới) ghép cặp 2 mảng này theo INDEX dòng, lệch số dòng sẽ ghép sai.
- `tip`: ngắn gọn, chỉ ra ĐÚNG đáp án dựa trên đâu (bẫy gì, từ khóa nào loại trừ đáp án nào) — không lan man, không phải dịch lại cả câu.
- Tuyệt đối KHÔNG tự chế nội dung script khi chưa có file Word gốc — chỉ transcribe đúng 100% từ file `聴解 N.docx` (19 file script gốc, định dạng JLPT thật kèm đáp án `正解:`).

### Field tùy chọn MỚI: `startSec` (câu hỏi) và `lineTimestamps` (script) — hỗ trợ tự nhảy audio + karaoke

Hai field này **HOÀN TOÀN TÙY CHỌN** — file cũ không có vẫn chạy đúng như trước, không lỗi/crash gì cả. Chỉ khi file JSON MỚI khai báo thêm các field này thì app mới bật tính năng tương ứng:

- **`startSec`** (số giây, đặt trong từng object `questions[]`): khi có, app tự `audioEl.currentTime = startSec` mỗi khi chuyển sang câu đó — dùng cho cả khi vẫn dùng CHUNG 1 file audio của cả Mondai. Không có field này → giữ nguyên hành vi cũ (không tự seek, người học tự kéo thanh thời gian).
- **`lineTimestamps`** (mảng số giây, đặt trong từng object `questions[]`, PHẢI cùng số dòng với `script`): bật hiệu ứng karaoke (bôi sáng dòng đang phát + TỰ ĐỘNG CUỘN dòng đó ra GIỮA khung nhìn) + cho BẤM VÀO BẤT KỲ DÒNG NÀO (tiếng Nhật hoặc bản dịch) để nhảy audio tới đúng đoạn đó. Dùng ở CẢ 2 nơi: mode "Luyện nghe câu" (`choukai-shadow`) VÀ panel xem đáp án lúc làm đề (`choukaiReviewPanel`, tab Script/Dịch). Nếu người dùng TỰ kéo cuộn ra khỏi dòng đang nghe (muốn xem các dòng khác), app tự NGỪNG cuộn theo để người dùng tự do xem, kèm nút "⬇ Về dòng đang nghe" (cố định theo khung nhìn — `position:fixed`, luôn thấy được dù đang cuộn ở khung cuộn nào) để nhảy lại + bật lại tự cuộn theo audio khi bấm. Không có field này (hoặc số phần tử không khớp số dòng script) → giữ nguyên hành vi cũ (chỉ hiện chữ bình thường, không bôi sáng, không bấm được, không tự cuộn).

```json
{
  "qnum": 1,
  "startSec": 12.5,
  "script": "...\n...\n...",
  "lineTimestamps": [0, 4.2, 9.8],
  ...
}
```

**Cách lấy `startSec`/`lineTimestamps` thực tế (quy trình đã dùng cho đề 18, 19):** Zane tạo 1 file `.docx` chứa transcript TỰ ĐỘNG (giọng → chữ, ví dụ qua Notta/Otter) có mốc thời gian `HH:MM:SS` kèm theo từng đoạn — file này CHỈ dùng để lấy mốc giờ + tên file audio thật, KHÔNG dùng làm script chính thức (vì máy nghe tự động có thể nghe sai vài chữ). Claude dùng thuật toán so khớp mờ (`difflib.SequenceMatcher`, script `align_timestamps.py`) để khớp từng dòng trong script CHÍNH THỨC (transcribe tay từ `.docx` gốc đề thi) với mốc giờ gần nhất trong file transcript tự động, rồi nội suy tuyến tính cho các dòng không khớp được. **Đây là ước lượng tự động, không phải đo tay 100% chính xác** — nếu nghe thực tế thấy lệch vài giây ở dòng nào, có thể sửa trực tiếp số trong mảng `lineTimestamps` của câu đó.


- **Trang "Luyện nghe theo đề"**: chọn đề (dropdown) → chọn luyện cả đề hoặc CHỈ 1 Mondai cụ thể → modal chọn chấm ngay/chấm cuối (giống đề thi chữ, có nút "Xem kết quả lần làm gần nhất").
- **Audio player**: dùng `<audio controls>` GỐC của trình duyệt (có thanh thời gian/seek bar đầy đủ — không tự vẽ control riêng). Audio **CHỈ load lại khi đổi sang Mondai khác** (file khác) — không reload mỗi câu trong cùng 1 Mondai (tránh audio bị giật lại từ đầu liên tục).
- **Tự dừng audio**: khi chuyển mode trong app (`setMode()`) HOẶC chuyển tab trình duyệt khác (`visibilitychange`).
- **Đổi Mondai giữa lúc đang làm bài**: dropdown chọn Mondai dùng được NGAY CẢ khi đang làm, không chỉ lúc bắt đầu — đổi sẽ nhảy thẳng tới Mondai đó, giữ nguyên đáp án các câu đã làm.
- **Chấm ngay**: trả lời → khóa toàn bộ nút lựa chọn (tránh bug cộng điểm 2 lần nếu bấm thêm lần nữa — ĐÃ TỪNG có bug này, xem cảnh báo dưới) → hiện panel 3 tab **Script / Dịch / Mẹo nghe** (không breakdown từng đáp án như đề chữ).
- **Mondai 3 & 5**: toggle "💡 Hiện gợi ý từ khóa khi đang nghe" — bật thì hiện vài chip từ khóa NGAY TRONG LÚC làm câu (trước khi trả lời), hỗ trợ luyện bắt ý mà không cần ghi chú giấy.
- **🚪 Thoát & xem kết quả** (chỉ mode chấm ngay) — giống đề chữ.
- **Kết quả cuối**: điểm tổng + breakdown theo từng Mondai (vd "1/5 Mondai 1") + lưới ô tròn (đúng/sai/chưa làm) bấm vào xem chi tiết.
- **Trang "Luyện nghe câu"** (mode riêng `choukai-shadow`): chọn đề + câu cụ thể, hiện TỪNG dòng script kèm bản dịch (hiện trực tiếp, KHÔNG còn làm mờ như trước). Nếu câu có `lineTimestamps`: bôi sáng kiểu karaoke đúng dòng đang phát + bấm vào BẤT KỲ dòng nào (JP hoặc VI) để nhảy audio tới đúng đoạn — xem mục field tùy chọn ở trên. Nếu KHÔNG có: vẫn dùng nút "Phát lại" để phát lại TOÀN BỘ audio của câu đó như cũ, có cảnh báo rõ giới hạn này trong UI (note tự ẩn khi câu đã có timestamp).
- **🖥️ Phóng to toàn màn hình thật (Fullscreen)**: cả "Luyện nghe theo đề" và "Luyện nghe câu" đều có nút ⛶ dùng Fullscreen API thật của trình duyệt (che cả thanh tab/địa chỉ trên PC/laptop), không chỉ phóng to trong trang như trước. Tự fallback về CSS-only nếu trình duyệt từ chối — xem mục bug/lưu ý dưới.
- **Lưu lịch sử**: cùng pattern với đề chữ — `n2vocab_choukai_history` (điểm tổng) + `n2vocab_choukai_detail_history` (chi tiết từng câu, key dạng `m{Mondai}q{qnum}[s{subIndex}]`).
- **Tích hợp Điểm yếu** (tab "Nghe") và **Thống kê** (mục "🎧 Luyện nghe") — dùng lại `recordWeaknessResult("__choukai__", ...)`.

### ⚠️ Bug đã từng gặp và ĐÃ SỬA — đọc kỹ để không lặp lại khi code tiếp
1. **Audio không tự dừng khi rời tab** → đã thêm pause ở `setMode()` + `visibilitychange`.
2. **Audio bị tải lại (giật về đầu) mỗi câu trong cùng 1 Mondai** → đã thêm so sánh `App.choukaiCurrentAudioSrc` trước khi set lại `audioEl.src`.
3. **Đổi Mondai giữa bài không có tác dụng** → đã thêm listener riêng cho `choukaiMondaiPicker` khi session đang chạy.
4. **Bug điểm số nghiêm trọng nhất:** sau khi trả lời, các nút lựa chọn VẪN bấm được dưới panel review → bấm thêm sẽ ghi đè đáp án + cộng điểm THÊM LẦN NỮA → điểm "câu đúng" trông giống "số câu đã làm". **Đã sửa bằng cờ `App.choukaiAnswering`** + khóa toàn bộ nút (`.disabled`) ngay sau khi trả lời, và khi back lại câu đã làm (nút "Câu trước") thì khóa lại luôn, không cho trả lời lần 2.
5. **Sai đuôi file audio** (`.mp3` thay vì `.m4a` hoặc ngược lại) — luôn đối chiếu đúng tên file thật theo ảnh chụp GitHub, không suy đoán theo mẫu đề trước.
6. **`audioEl.play()` ném lỗi không bắt được** — `.play()` trả về 1 Promise, lỗi (vd "no supported sources" khi chưa có file audio thật) bị REJECT bất đồng bộ, KHÔNG bị `try/catch` thông thường bắt được. Phải dùng `const p = audioEl.play(); if (p && p.catch) p.catch(() => {});` ở MỌI nơi gọi `.play()` sau khi set `currentTime`.
7. **Focus mode (phóng to toàn màn hình) làm MẤT phần ĐẦU của nội dung dài (script)** — do CSS `#app.focus-mode .main { display:flex; align-items:center; ... overflow-y:auto }`: đây là lỗi kinh điển của flexbox, khi nội dung CAO HƠN khung nhìn, `align-items:center` khiến phần đầu bị đẩy lên trên vùng cuộn được và KHÔNG THỂ cuộn lên xem lại. **Đã sửa bằng cách đổi `align-items: center` → `align-items: flex-start`** — giữ canh giữa ngang qua `justify-content`, bỏ canh giữa dọc để nội dung neo từ trên, cuộn xuống bình thường.
8. **`findScrollParent()` (dùng cho tính năng tự cuộn karaoke) tìm SAI khung cuộn** — lúc đầu code bắt đầu tìm từ `el.parentElement` (cha của phần tử được truyền vào), khiến với panel xem đáp án (chính `#choukaiReviewContent` LÀ khung cuộn riêng, không phải cha của nó) bị bỏ qua, tự cuộn nhầm sang `.main` ở ngoài. **Đã sửa: kiểm tra CHÍNH phần tử được truyền vào trước, rồi mới đi lên các cha.**
9. **Lưu trùng lặp "Lần 1" khi migrate dữ liệu cũ sang hệ thống nhiều lần làm (attempts)** — ban đầu gọi `saveChoukaiDetailSnapshot()` (ghi snapshot CŨ, dùng để migrate) TRƯỚC `recordChoukaiAttempt()` trong `finishChoukai()`. Vì `recordChoukaiAttempt()`/`getChoukaiAttempts()` có cơ chế "nếu chưa có gì trong hệ mới, biến snapshot cũ thành Lần 1", khi gọi SAU, nó đọc nhầm snapshot VỪA ghi của chính lần làm hiện tại thành "dữ liệu cũ", tạo ra 1 lần làm ảo trùng lặp (lần làm đầu tiên luôn bị nhân đôi thành 2 dòng trong lưới kết quả). **Đã sửa: đảo thứ tự, gọi `recordExamAttempt()`/`recordChoukaiAttempt()` LUÔN PHẢI ĐỨNG TRƯỚC** `saveExamDetailSnapshot()`/`saveChoukaiDetailSnapshot()` trong cả `finishExam()` và `finishChoukai()`. Phát hiện được nhờ test Playwright làm 2 lần liên tiếp rồi đếm số dòng trong lưới.

---

## 20. Toàn bộ key `localStorage`

| Key | Nội dung |
|---|---|
| `n2vocab_progress_<tên file>` | Tiến độ SRS 1 bộ |
| `n2vocab_fieldconfig` | Field hiện trước/sau flashcard theo TYPE |
| `n2vocab_colconfig` / `n2vocab_peekcols` | Cấu hình cột Bảng |
| `n2vocab_editpatches` | Sửa tạm qua ✎ Sửa |
| `n2vocab_sound_enabled` / `n2vocab_speech_enabled` | Bật/tắt âm thanh/phát âm |
| `n2vocab_weakness_stats` | Thống kê đúng/sai (mọi loại, kể cả `__exam__`/`__choukai__`) |
| `n2vocab_starred` | Đánh dấu ★ |
| `n2vocab_shuffle_enabled` | Ngẫu nhiên Flashcard/SRS |
| `n2vocab_exam_history` / `n2vocab_exam_detail_history` | Điểm tổng / chi tiết từng câu đề thi chữ |
| `n2vocab_choukai_history` / `n2vocab_choukai_detail_history` | Điểm tổng / chi tiết từng câu đề luyện nghe |

---

## 21. Quy ước nhóm dữ liệu "Mimi" (giáo trình chính) — **ĐÃ LÀM**

Các file giáo trình Mimi (`mimi-n2-unit1`, `unit2`, `unit3-adj`, `unit4`, `unit6-photu`, `unit7`, `unit8`, `unit9`, `unit10-adj`, `unit11`, `unit12`, `tunoi-photu`) giờ có thêm field `"series": "mimi"` ngay sau `"type"` trong JSON. `populateDeckPicker()` trong `loader-nav.js` đọc field này và render dropdown sidebar bằng 2 `<optgroup>` riêng: **"📘 Mimi N2 (giáo trình chính)"** (luôn ở ĐẦU dropdown) và **"Tài liệu khác"** (các bộ còn lại). Thứ tự A-Z trong từng nhóm vẫn giữ nguyên như cũ (không đổi cách sort). Bộ MỚI thêm sau này: muốn vào nhóm Mimi thì chỉ cần thêm `"series": "mimi"` vào file JSON, không cần sửa code thêm.

Đã kiểm tra bằng Playwright: dropdown hiện đúng 2 optgroup (lúc đó nhóm Mimi mới có 7 bộ, nhóm khác 8 bộ — sau khi thêm Unit 1/2/7/9/12 thì nhóm Mimi có 12 bộ, nhóm khác vẫn 8 bộ), không có lỗi console.

---

## 22. Trạng thái dữ liệu hiện tại (kiểm kê đầy đủ — lúc viết tài liệu này)

### `tailieu/` (20 file)
| File | Type | Số từ |
|---|---|---|
| danh-tu-jlpt-n2.json | TUVUNG | 73 |
| danh-tu-thiet-yeu.json | TUVUNG | 73 |
| mimi-n2-unit1.json | TUVUNG | 100 |
| mimi-n2-unit2.json | TUVUNG | 120 |
| mimi-n2-tunoi-photu.json | TUVUNG | 58 |
| mimi-n2-unit3-adj.json | TUVUNG | 50 |
| mimi-n2-unit4.json | TUVUNG | 100 |
| mimi-n2-unit6-photu.json | TUVUNG | 59 |
| mimi-n2-unit7.json | TUVUNG | 99 |
| mimi-unit8.json | TUVUNG | 110 |
| mimi-n2-unit9.json | TUVUNG | 50 |
| mimi-n2-unit10-adj.json | TUVUNG | 50 |
| mimi-n2-unit11.json | TUVUNG | 100 |
| mimi-n2-unit12.json | TUVUNG | 100 |
| nut-that-n2.json | TUVUNG | 120 |
| nguphap-hoc-tu.json | NGUPHAP | 66 |
| nguphap-mau.json | NGUPHAP | 3 |
| nguphap-pham-vi-a-m789.json | NGUPHAP | 71 |
| nguphap-pham-vi-b-m11-dokkai.json | NGUPHAP | 29 |
| nguphap-top40-mimitry.json | NGUPHAP | 40 |

**Mimi Unit 1, 2, 7, 9, 12 — MỚI LÀM XONG** (469 từ): Unit 1 (danh từ tổng hợp, 100 từ), Unit 2 (động từ, 120 từ, gộp từ 2 phần nguồn), Unit 7 (danh từ, 99 từ), Unit 9 (từ ngoại lai/katakana, 50 từ — không có `han_viet` vì là từ vay mượn), Unit 12 (động từ, 100 từ). Tất cả đã có `"series": "mimi"`, `doc_marked` đúng quy tắc, `vi_du_ruby` ruby cả từ đang học + từ khó N2 khác trong câu, đồng/trái nghĩa bổ sung có chọn lọc ở từ quan trọng (không ép buộc đủ 100%).

**⚠️ Trùng tên hiển thị chưa xử lý:** `danh-tu-jlpt-n2.json` và `danh-tu-thiet-yeu.json` có title GIỐNG NHAU ("Danh từ thiết yếu JLPT N2") nhưng nội dung khác — Zane chưa quyết định giữ/xóa/đổi tên cái nào, đang để cả 2.

**⚠️ Trùng nội dung đã xử lý (không cần làm lại):** Unit 6 (phó từ/liên từ) đã rà soát kỹ — phần liên từ logic (だから/しかし/ところが...) trùng ~100% với `mimi-n2-tunoi-photu.json` nên KHÔNG đưa vào Unit 6, chỉ giữ phần phó từ mức độ/thời gian/trạng thái thực sự mới (59 từ).

### `dethi/` (8 file — đề thi trắc nghiệm chữ)
9 đề tự soạn đầy đủ 51 câu (Mondai 1-9, có giải thích chuẩn): `n2-2021-07`, `n2-2021-12`, `n2-2022-07`, `n2-2022-12`, `n2-2023-07`, `n2-2024-07`, `n2-2024-12`, `n2-2025-07`, `n2-2025-12`. 1 đề mẫu nhỏ (`mondai1-mau-2023-12`, 3 câu). `n2-2019-12`, `n2-2020-12`, `n2-2023-12` — 30/51 câu (chỉ Mondai 1-6, THIẾU Mondai 7-9: ghép câu ★, đoạn văn) — **đã có đủ `giai_thich` cho cả 30 câu** mỗi đề.

### `dethi-choukai/` (đề luyện nghe — MỚI, đang xây)
- `choukai-01.json` — 31 câu, đầy đủ script+dịch+tip, audioMode `combined`. **CHƯA có** `startSec`/`lineTimestamps`.
- `choukai-02.json` — 32 câu, đầy đủ, audioMode `split`. **CHƯA có** `startSec`/`lineTimestamps`.
- **`choukai-18.json` — XONG, ĐÃ CÓ timestamp** (32 câu, đầy đủ script+dịch+tip+keywords, audioMode `split`). Transcribe đúng 100% từ `聴解 18.docx` gốc. Tên file audio (`聴解 18 1.m4a`...`5.m4a`) đã xác nhận đúng từ file `choukai_18_time.docx` (transcript tự động kèm mốc giờ mà Zane gửi) — KHÔNG còn là đoán theo mẫu nữa. `startSec`/`lineTimestamps` đã gán bằng thuật toán so khớp mờ (`align_timestamps.py`) giữa script chính thức và mốc giờ trong file transcript tự động — xem mục 19 để biết quy trình + lưu ý độ chính xác.
- **`choukai-19.json` — XONG, ĐÃ CÓ timestamp** (32 câu — Zane tự soạn sẵn theo đúng schema, gửi lại để Claude không cần làm lại script/dịch/tip). Claude chỉ thêm `startSec`/`lineTimestamps` từ file `choukai_19_time.docx` bằng quy trình giống đề 18. Tên file audio (`聴解 19 1.m4a`...`5.m4a`) đã có sẵn đúng trong file Zane gửi.
- **CHƯA LÀM: đề 03-17** (15 đề) — đã có sẵn file script gốc `聴解 N.docx` (N=3..17), cấu trúc xác nhận ổn định (Mondai1≈5-6 câu, Mondai2=6 câu, Mondai3=5 câu, Mondai4=11-12 câu, Mondai5=3-4 điểm) — chỉ cần transcribe + dịch + viết tip theo đúng quy trình mục 19. Nếu Zane gửi kèm file `_time.docx` tương ứng, Claude sẽ gán `startSec`/`lineTimestamps` luôn trong cùng lần làm.
- **`file-nghe/` (audio thật)**: Zane tự upload trực tiếp lên GitHub, KHÔNG đi qua Claude. Đề 18, 19 đã xác nhận đúng tên+đuôi `.m4a` qua file transcript tự động kèm mốc giờ — các đề 01, 02 (đuôi `.m4a`/`.mp3` theo ảnh chụp cũ) và các đề sẽ làm sau vẫn cần đối chiếu cẩn thận như quy tắc cũ.

---

## 23. TODO tổng hợp — việc còn lại theo đúng yêu cầu gần nhất của Zane

1. **Xây tiếp 15 đề luyện nghe còn lại** (choukai-03 → choukai-17) — cần file `聴解 N.docx` tương ứng (đã có), và nếu Zane chuẩn bị thêm file `_time.docx` kèm mốc giờ cho từng đề thì Claude sẽ làm timestamp luôn trong cùng lượt.
2. **Chuẩn hóa `dong_nghia`/`trai_nghia` sang format mới** (~826 mục đang format cũ) — xem bảng mục 3, làm dần.
3. **Quyết định xử lý 2 file trùng tên** `danh-tu-jlpt-n2.json` / `danh-tu-thiet-yeu.json` — xem mục 22.
4. **Hoàn thiện 3 đề thi chữ thiếu** (`n2-2019-12`, `n2-2020-12`, `n2-2023-12`) — thêm Mondai 7-9 + giải thích.
5. **Bổ sung `startSec`/`lineTimestamps`** cho `choukai-01`, `choukai-02` nếu Zane chuẩn bị file `_time.docx` tương ứng — quy trình giống đề 18/19 ở mục 19.
6. **Kiểm tra lại độ chính xác `lineTimestamps`** của đề 18/19 khi có audio thật — vì là ước lượng tự động (so khớp mờ + nội suy), có thể lệch vài giây ở 1 số dòng ngắn ("はい。", "うん。"...), sửa tay trực tiếp trong JSON nếu cần khi nghe thực tế thấy lệch.

---

## 24. Việc ĐÃ HOÀN THÀNH (tóm tắt, để biết KHÔNG cần làm lại)

- Toàn bộ hệ thống học từ vựng/ngữ pháp (Flashcard, SRS+"Đã thuộc", Bảng, Gõ hiragana, Trắc nghiệm, Ghép thẻ) — ổn định.
- Toàn bộ hệ thống đề thi chữ (2 mode chấm, lưu lịch sử, xem lại không cần làm lại, gạch chân kanji, lưới kết quả, "Thoát & xem kết quả") — ổn định.
- Toàn bộ hệ thống luyện nghe MỚI (mục 19) — đã xây xong toàn bộ UI/JS/cơ chế, đã test kỹ qua Playwright, đã sửa hết các bug phát sinh — chỉ còn THIẾU DỮ LIỆU (16 đề chưa transcribe), không phải thiếu code/tính năng.
- Sắp xếp A-Z tự nhiên (hiểu số, "Unit 3 < Unit 10") cho mọi dropdown bộ học + đề thi.
- Trang Thống kê, trang Điểm yếu (3 tab: bộ học / đề thi / nghe).
- Cache-busting `?v=N` riêng cho TỪNG file `.js` (10 module + `srs.js`) để tránh bị cache nhầm bản cũ trên GitHub Pages.
