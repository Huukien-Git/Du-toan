# KẾ HOẠCH TRIỂN KHAI: PHẦN MỀM ÁP GIÁ TỰ ĐỘNG CƠ ĐIỆN (M&E AUTO-PRICING DESKTOP APP)

---

## 1. MỤC TIÊU DỰ ÁN
Xây dựng một ứng dụng Desktop chuyên nghiệp, hiện đại trên hệ điều hành Windows dành cho kỹ sư dự toán cơ điện (MEP QS). Phần mềm tự động hóa quá trình tra cứu, tính toán và áp đơn giá (vật tư + nhân công) từ danh mục giá/báo giá nhà cung cấp vào bảng khối lượng (BOQ) đầu vào, kết hợp thuật toán khớp mờ (Fuzzy Matching) và trí tuệ nhân tạo Google Gemini API (được kiểm soát bởi người dùng), giúp tăng tốc độ lập dự toán gấp 5-10 lần và loại bỏ sai sót thủ công.

---

## 2. KIẾN TRÚC & CÔNG NGHỆ DỰ KIẾN

### 2.1. Cấu trúc tổng thể
- **Kiến trúc:** Desktop Application theo mô hình **Modern Web-based Desktop GUI** (Sử dụng Python Backend kết hợp PyWebView / Electron hoặc giao diện Web cục bộ độc lập tốc độ cao). Mô hình này mang lại:
  - Giao diện thẩm mỹ cao (Modern Glassmorphism / Dark & Light mode / Spreadsheet Grid tương tác mượt mà như Excel).
  - Backend Python xử lý dữ liệu mạnh mẽ với thư viện chuyên dụng cho Excel và tính toán ma trận.
  - Hoạt động offline hoàn toàn đối với CSDL nội bộ, chỉ kết nối Internet khi gọi Gemini API.

### 2.2. Ngăn xếp công nghệ (Tech Stack)
- **Engine xử lý dữ liệu & tính toán (Backend):**
  - `Python 3.10+`
  - `openpyxl` & `pandas`: Đọc, phân tích, xử lý và xuất file Excel (.xlsx) định dạng phức tạp mà không làm hỏng công thức hay định dạng gốc.
  - `thefuzz` / `RapidFuzz` & `scikit-learn` (TF-IDF): Thuật toán so khớp mờ đa cấp độ (Fuzzy Ratio, Token Sort, Partial Ratio) để tính toán điểm số phần trăm tương đồng (% Match Score).
  - `SQLite`: Cơ sở dữ liệu nhẹ, cục bộ, nhúng sẵn trong ứng dụng để lưu trữ Danh mục giá chuẩn, Lịch sử báo giá nhà cung cấp, và **Bộ nhớ ánh xạ (Mapping Memory Cache)**.
- **Tích hợp Trí tuệ nhân tạo (AI Engine):**
  - `google-genai` / `google-generativeai`: Sử dụng Google Gemini API (người dùng nhập API Key cá nhân trong cài đặt).
  - Nhiệm vụ AI: Phân tích ngữ nghĩa mô tả kỹ thuật viết tắt (ví dụ: *"Dây Cu/PVC 1x2.5"* $\leftrightarrow$ *"Dây đơn ruột đồng bọc PVC 2.5mm2"*), đề xuất nội suy đơn giá cho quy cách tương đương.
  - **Cơ chế an toàn (Human-in-the-loop):** Toàn bộ đề xuất của Gemini hiển thị trong modal kiểm tra, chỉ khi kỹ sư bấm "Chấp nhận" thì đơn giá mới được điền vào bảng.
- **Giao diện người dùng (Frontend GUI):**
  - Modern Responsive HTML5 / CSS3 / JavaScript (DataTables / Tabulator / Canvas-based Grid).
  - Hỗ trợ Dark Mode / Light Mode, thanh tiến trình áp giá, thanh hiển thị % độ chính xác (Confidence Score Badge: Xanh > 85%, Vàng 60-84%, Đỏ < 60%).
  - Chức năng sửa trực tiếp trên ô (In-line editing), lọc, tìm kiếm, phân nhóm theo hệ cơ điện (Điện, Nước, HVAC).

---

## 3. CÁC BƯỚC TRIỂN KHAI CHI TIẾT

### Giai đoạn 1: Thiết kế Cấu trúc Dữ liệu & Cơ sở dữ liệu cục bộ (SQLite)
1. Xây dựng schema bảng `materials_master` (Kho danh mục giá chuẩn: Mã hiệu, Tên vật tư, Thông số/Quy cách, ĐVT, Đơn giá vật tư, Đơn giá nhân công, Nhà cung cấp, Ngày cập nhật, Hệ cơ điện).
2. Xây dựng schema bảng `mapping_memory` (Bộ nhớ học quy tắc: Cụm từ gốc trong BOQ $\rightarrow$ Mã vật tư chuẩn tương ứng $\rightarrow$ Kỹ sư đã xác nhận).
3. Xây dựng schema bảng `settings` (Lưu Gemini API Key an toàn, cấu hình ngưỡng % khớp mờ, hệ số nội suy).

### Giai đoạn 2: Module Xử lý File Excel (Import & Export Engine)
1. **Module Nhập Bảng Giá (Price Importer):**
   - Đọc bất kỳ file Excel nào có cột đơn giá.
   - Giao diện trực quan cho phép kỹ sư ánh xạ cột: Cột Tên vật tư, Cột Quy cách, Cột ĐVT, Cột Giá vật tư, Cột Giá nhân công.
   - Nạp vào CSDL cục bộ để sử dụng lâu dài.
2. **Module Nhập BOQ (BOQ Importer):**
   - Đọc bảng khối lượng đầu vào từ Excel.
   - Tự động nhận diện hoặc cho phép chọn nhanh các cột: STT, Mã hiệu, Diễn giải công việc / Vật tư, ĐVT, Khối lượng.
3. **Module Xuất File Kết quả (Excel Exporter):**
   - Điền đầy đủ: Đơn giá Vật tư, Đơn giá Nhân công, Thành tiền Vật tư, Thành tiền Nhân công, Tổng thành tiền.
   - Highlight màu vàng các dòng chưa có giá hoặc do kỹ sư nhập tay.
   - Giữ nguyên công thức tính toán `Thành tiền = Khối lượng * Đơn giá` để đảm bảo tính minh bạch khi bàn giao cho chủ đầu tư.

### Giai đoạn 3: Thuật toán Khớp mờ (Fuzzy Matching Engine) & Bộ nhớ học (Memory Cache)
1. **Bước 1 (Check Memory):** Kiểm tra xem cụm từ mô tả đã có trong `mapping_memory` chưa $\rightarrow$ Nếu có, áp giá chính xác 100% ngay lập tức.
2. **Bước 2 (Fuzzy Match):** Nếu chưa có trong Memory, chạy thuật toán tính điểm tương đồng % với toàn bộ danh mục vật tư:
   - Tách từ khóa kỹ thuật (kích thước, đường kính $\Phi$, công suất HP/kW, tiết diện mm2, thương hiệu...).
   - Xếp hạng danh sách từ cao xuống thấp.
   - Nếu độ khớp $\ge 90\%$: Tự động đề xuất ưu tiên.
   - Nếu độ khớp từ $60\% - 89\%$: Hiển thị danh sách Top 3-5 gợi ý kèm % để kỹ sư bấm chọn 1 cú click chuột.
3. **Bước 3 (Ghi nhớ tự động):** Khi kỹ sư chọn một vật tư đề xuất, hệ thống lập tức lưu cặp tương ứng vào `mapping_memory` để các lần sau tự động áp giá 100%.

### Giai đoạn 4: Tích hợp Gemini API (AI Semantic Understanding & Interpolation)
1. Cung cấp màn hình cài đặt cấu hình Gemini API Key.
2. Khi gặp các dòng vật tư kỹ thuật viết tắt phức tạp hoặc quy cách lạ:
   - Gửi yêu cầu phân tích ngữ nghĩa tới Gemini kèm theo danh mục các vật tư tương đồng gần nhất.
   - Gemini suy luận vật tư tương đương hoặc nội suy đơn giá (ví dụ: Cút hàn D100 có giá, Cút hàn D125 chưa có giá $\rightarrow$ Gemini gợi ý tỉ lệ trượt giá tương ứng theo đường kính).
3. **Bảng xác nhận bắt buộc (Confirmation Dialog):** Trình bày rõ lý do đề xuất của Gemini, % tin cậy và giá dự kiến. Chỉ khi người dùng bấm "Duyệt" thì giá mới được áp dụng.

### Giai đoạn 5: Phát triển Giao diện Người dùng (Modern Desktop UI)
1. **Trang Chủ (Dashboard):** Thống kê kho dữ liệu giá hiện có, số lượng quy tắc đã học.
2. **Trang Quản lý Bảng giá (Price Library):** Xem, tìm kiếm, chỉnh sửa, nhập thêm file báo giá mới từ NCC.
3. **Trang Dự toán & Áp giá (Pricing Workspace):**
   - Bảng tính tương tác lưới (Spreadsheet Grid).
   - Thanh công cụ: Tự động áp giá, Lọc dòng chưa có giá, Gọi AI Gemini hỗ trợ, Xuất Excel.
   - Cột trạng thái trực quan: Màu xanh (Khớp chính xác), Màu cam (Khớp mờ đã chọn), Màu đỏ (Chưa có giá - cần nhập tay).
4. **Cửa sổ Cài đặt:** Quản lý Gemini API Key, cài đặt chế độ giao diện Sáng/Tối (Dark/Light Mode).

### Giai đoạn 6: Đóng gói Ứng dụng Desktop (.exe) & Kiểm thử
1. Đóng gói hoàn chỉnh thành tệp chạy độc lập trên Windows (`.exe`) bằng PyInstaller hoặc Inno Setup.
2. Kiểm thử với dữ liệu BOQ cơ điện thực tế và các kịch bản biên.

---

## 4. RỦI RO & PHƯƠNG ÁN XỬ LÝ (EDGE CASES)

| Tình huống rủi ro / Ngoại lệ | Phương án xử lý kỹ thuật |
| :--- | :--- |
| **File Excel BOQ có cấu trúc phức tạp, merge ô, nhiều dòng tiêu đề phụ** | Cung cấp bước "Chọn dòng bắt đầu dữ liệu" và "Ánh xạ cột" trực quan; bỏ qua các dòng tiêu đề/tổng phụ không có khối lượng. |
| **Không có kết nối Internet hoặc chưa có Gemini API Key** | Hệ thống vẫn hoạt động 100% bình thường với thuật toán Khớp mờ nội bộ và CSDL SQLite; tính năng AI chỉ kích hoạt khi có mạng và key hợp lệ. |
| **Vật tư hoàn toàn mới chưa từng xuất hiện trong bất kỳ bảng giá nào** | Tự động đổi màu ô thành vàng/đỏ; cho phép kỹ sư gõ giá trực tiếp vào ô trên bảng; cung cấp nút "Lưu nhanh vật tư này vào CSDL" để dùng cho các dự án sau. |
| **Đơn vị tính (ĐVT) khác nhau (ví dụ: mét vs cuộn, cái vs bộ)** | Thuật toán chuẩn hóa ĐVT tự động (bỏ dấu cách, chữ hoa/chữ thường); cảnh báo nếu phát hiện ĐVT trong BOQ khác ĐVT trong bảng giá gốc để kỹ sư rà soát. |
| **Khối lượng dữ liệu lớn (BOQ hàng ngàn dòng)** | Tối ưu hóa thuật toán matching theo nhóm từ khóa chính và xử lý bất đồng bộ (Multi-threading / Async) kèm thanh tiến trình mượt mà, không làm đơ giao diện. |

---

## 5. TIÊU CHÍ ĐÁNH GIÁ HOÀN THÀNH (ACCEPTANCE CRITERIA)
- [x] Đọc thành công mọi file Excel bảng giá có sẵn cột chi phí và file BOQ bất kỳ sau khi map cột.
- [x] Áp chính xác cả 2 loại đơn giá: Vật tư và Nhân công; tính toán đúng tổng thành tiền.
- [x] Thuật toán khớp mờ xếp hạng gợi ý theo % độ chính xác từ cao xuống thấp trực quan.
- [x] Bộ nhớ học ghi nhớ thành công các lựa chọn của kỹ sư, lần chạy sau tự động nhận diện đúng.
- [x] Tích hợp Gemini API phân tích ngữ nghĩa & nội suy thành công; hoạt động theo nguyên tắc người dùng bấm duyệt mới áp dụng.
- [x] Đánh dấu nổi bật các dòng thiếu giá và hỗ trợ chỉnh sửa trực tiếp.
- [x] Giao diện Desktop hiện đại, mượt mà, hỗ trợ Dark Mode.
- [x] Xuất file Excel chuẩn xác, công thức số học nguyên vẹn, định dạng rõ ràng, chuyên nghiệp.
