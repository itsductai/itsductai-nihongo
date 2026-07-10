# Prompt mẫu — Tự tạo bài đọc kiểu bẫy JLPT (dùng cho Claude/AI khác)

Copy nguyên khối dưới đây, thay phần `[CHỦ ĐỀ]` và `[TƯ LIỆU GỐC]`, gửi cho Claude (hoặc AI khác) là ra bài đúng chuẩn.

---

```
Bạn là chuyên gia ra đề JLPT N1/N2. Viết 1 bài đọc hiểu (長文) theo chủ đề:
[CHỦ ĐỀ — ví dụ: "Công nghệ IOWN của NTT" / "Hội chứng Quiet Quitting"]

Tư liệu tham khảo (tóm tắt sự thật, KHÔNG copy nguyên văn):
[TƯ LIỆU GỐC — dán tóm tắt bài báo/thông tin thật vào đây]

YÊU CẦU BẮT BUỘC:

1. CẤU TRÚC ẨN DỤ (quan trọng nhất):
   - Đoạn 1: mở bằng 1 HÌNH TƯỢNG CỤ THỂ, dễ hình dung (ví dụ: con thuyền,
     cây cổ thụ, đường lầy lội, mài kim...) — người đọc lướt sẽ tưởng bài
     nói về chủ đề khác hẳn (làm vườn, hàng hải, thể thao...).
   - Đoạn 2-3: chuyển sang Ý TỔNG QUÁT THẬT (chủ đề chính) bằng cách đối
     chiếu từng phần của hình tượng với thực tế (thân cây = văn hóa cũ,
     cành mới = nhân lực trẻ...).
   - Đoạn cuối: kết luận, có thể lặp lại hình tượng ban đầu 1 lần nữa để
     chốt ý.

2. ĐỘ DÀI: 500-800 chữ, 4 đoạn, văn phong báo chí/luận văn N1.

3. CÂU HỎI: đúng 5 câu, xếp DỄ -> KHÓ, đủ 3 dạng xen kẽ:
   - Dạng lý do (なぜか/どうしてか) — đáp án gần cấu trúc 〜からだ/〜によって
   - Dạng chỉ thị từ (下線部「それ」が指す内容) — đáp án ở câu NGAY TRƯỚC
   - Dạng ý chính (筆者が最も言いたいこと) — đáp án bao quát cả bài, đặt CUỐI

4. QUY TẮC ĐÁP ÁN (bắt buộc, hay bị quên nhất):
   - 4 đáp án PHẢI dài xấp xỉ nhau (chênh lệch dưới ~10-12 ký tự — ĐẾM THẬT
     bằng code/tool trước khi chốt, đừng chỉ nhìn bằng mắt).
   - Đáp án ĐÚNG phải diễn đạt lại (paraphrase) — KHÔNG copy nguyên cụm từ
     trong bài.
   - 3 đáp án SAI, mỗi cái dùng 1 trong 4 loại bẫy:
     a) Bẫy nhiễu: lấy ý ở câu MỞ ĐẦU/dẫn dắt, trước từ chuyển ý (しかし/
        一方で/ところが) — ý này bị phủ định ngay sau đó trong bài.
     b) Bẫy đạo lý đời thực: nghe rất hợp lý, đúng lẽ thường, nhưng KHÔNG
        có trong bài.
     c) Bẫy tuyệt đối hóa: chèn 必ず/絶対に/すべて/常に để biến ý đúng một
        phần thành sai hoàn toàn.
     d) Thông tin bịa: không liên quan, không có căn cứ trong bài.

5. TỪ VỰNG — tách 2 luồng màu:
   - 🔵 Thuật ngữ chuyên ngành/IT (đánh dấu "colorTag": "blue")
   - 🟡 Từ vựng văn hóa/business/thành ngữ (đánh dấu "colorTag": "yellow")
   - Mỗi từ ghi kèm: kanji, cách đọc, Hán Việt, nghĩa tiếng Việt.
   - NẾU từ vựng/ngữ pháp mới xuất hiện TRONG ĐÁP ÁN (không chỉ trong bài),
     PHẢI bổ sung luôn vào danh sách để người học không gặp từ lạ.

6. NGỮ PHÁP: liệt kê các mẫu N2/N1 xuất hiện trong bài (bỏ qua ngữ pháp
   N4/N5 quá cơ bản), kèm nghĩa tiếng Việt.

7. XUẤT RA ĐÚNG SCHEMA JSON (để dán thẳng vào file dữ liệu):
{
  "id": "reading-XX",
  "title": "...", "titleVi": "...",
  "level": "N1" hoặc "N2", "category": "経済|心理学|文化|健康|社会",
  "date": "YYYY-MM-DD", "source": "ai", "private": true,
  "sourceNote": "ghi rõ tư liệu tham khảo thật, xác nhận đã viết lại 100%",
  "paragraphs": ["đoạn 1 có {{furigana|đọc|nghĩa}} cho từ khó...", ...],
  "paragraphsVi": ["bản dịch từng đoạn..."],
  "questions": [
    {"difficulty": 1-5, "type": "reason|referent|main_idea",
     "q": "...", "options": ["4 đáp án"], "answer": 0-3}
  ],
  "n2VocabList": [{"kanji":"...","hanviet":"...","reading":"...","meaning":"...","colorTag":"blue|yellow"}],
  "grammarList": [{"pattern":"...","meaning":"..."}]
}

LƯU Ý: sau khi viết xong, TỰ KIỂM TRA lại:
- Đo độ dài (số ký tự) từng đáp án trong mỗi câu hỏi, báo cáo chênh lệch.
- Xác nhận "answer" index khớp ĐÚNG đáp án đã diễn đạt lại (dễ sai nếu đảo
  vị trí đáp án lúc sửa).
```

---

## Mẹo dùng thêm

- Nếu muốn AI tự tìm tư liệu thật trước khi viết, thêm câu: *"Trước khi viết, tìm kiếm thông tin thật về [chủ đề] trong 6 tháng gần nhất, tóm tắt lại rồi mới viết bài theo cấu trúc trên."*
- Muốn bài dễ hơn (N2 thay vì N1): thêm *"Dùng ngữ pháp N2 trở xuống, câu ngắn hơn, ẩn dụ đơn giản hơn."*
- Muốn kiểm tra chất lượng bẫy: hỏi thêm *"Giải thích rõ từng đáp án sai thuộc loại bẫy nào trong 4 loại đã nêu."* (trường `trap_analysis` tùy chọn trong schema).
