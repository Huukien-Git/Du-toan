# HƯỚNG DẪN SỬ DỤNG: PHẦN MỀM ÁP GIÁ TỰ ĐỘNG CƠ ĐIỆN (MEP AUTO-PRICING)

---

## 1. GIỚI THIỆU PHẦN MỀM
**MEP Auto-Pricing** là ứng dụng Desktop chuyên nghiệp trên Windows dành cho Kỹ sư Dự toán Cơ Điện (MEP Cost Estimator / QS). Phần mềm tự động hóa toàn bộ khâu tra cứu, tính toán và điền đơn giá **Vật tư và Nhân công** từ file bảng giá vào file Excel bảng khối lượng (BOQ).

### Các Tính Năng Nổi Bật:
- ⚡ **Áp giá tự động siêu tốc:** Khớp mờ thông minh (Fuzzy Matching) phân tích thông số kỹ thuật (D90, DN100, 4x16mm2, 2.5mm2, 5HP, 100W...).
- 🧠 **Bộ nhớ tự học quy tắc (Memory Cache):** Ghi nhớ các lựa chọn ghép nối của kỹ sư, lần sau gặp lại tự động áp giá đúng 100%.
- 🤖 **Trí tuệ nhân tạo Google Gemini AI:** Đọc hiểu các thuật ngữ viết tắt phức tạp, đề xuất vật tư tương đương và nội suy đơn giá có kiểm soát (Human-in-the-loop).
- 📊 **Giao diện bảng tính tương tác (Spreadsheet Grid):** Chỉnh sửa đơn giá trực tiếp trên ô, highlight cảnh báo ô thiếu giá, lọc nhanh.
- 📥 **Xuất file Excel chuẩn:** Giữ nguyên các công thức tính toán `Thành tiền = Khối lượng * Đơn giá` và dòng tổng cộng để bàn giao cho Chủ đầu tư.
- 🔒 **Bảo mật & Hoạt động Offline 100%:** Dữ liệu lưu cục bộ trên máy tính qua IndexedDB/LocalStorage, chỉ kết nối mạng khi gọi Gemini API.

---

## 2. CÁCH KHỞI ĐỘNG ỨNG DỤNG

Bạn có các cách cực kỳ đơn giản để mở phần mềm:
1. **Cách 1 (Khuyên dùng tốt nhất - Mở êm ái như ứng dụng Windows):**
   - Kích đúp chuột vào tệp [Chay_Phan_Mem.vbs](file:///c:/Users/Admin/Desktop/Ap%20gia%20tu%20dong/Chay_Phan_Mem.vbs).
   - Ứng dụng mở trực tiếp trong một cửa sổ Desktop riêng biệt, **hoàn toàn không nháy màn hình đen** của dòng lệnh.
2. **Cách 2 (Mở qua tệp lệnh Batch):**
   - Kích đúp chuột vào tệp [Chay_Phan_Mem.bat](file:///c:/Users/Admin/Desktop/Ap%20gia%20tu%20dong/Chay_Phan_Mem.bat).
   - Hệ thống tự động kích hoạt Chrome hoặc Edge và tự đóng cửa sổ dòng lệnh.
3. **Cách 3 (Mở trực tiếp trên trình duyệt Web):**
   - Kích đúp chuột trực tiếp vào tệp [index.html](file:///c:/Users/Admin/Desktop/Ap%20gia%20tu%20dong/index.html) để mở trên trình duyệt web của bạn (Chrome, Edge, Firefox, Cốc Cốc...).

---

## 3. HƯỚNG DẪN SỬ DỤNG CHI TIẾT TỪNG MỤC

### 3.1. Tab 1: Tổng Quan (Dashboard)
- Hiển thị 4 thẻ thống kê trực quan: Số lượng vật tư trong kho, Số quy tắc đã ghi nhớ, Tỷ lệ tự động khớp giá, và Tổng giá trị dự toán đang lập.
- Nút **"Bắt Đầu Áp Giá BOQ Ngay"**: Chuyển thẳng sang khu vực làm việc áp giá.
- Nút **"Nạp Lại Dữ Liệu Mẫu Cơ Điện Chuẩn"**: Đặt lại 38 vật tư mẫu chuẩn ngành Cơ Điện Việt Nam (Điện, Nước, HVAC).
- Nút **"Tải File Excel Mẫu Về Máy"**: Tải về máy tính 2 file Excel mẫu (`Bang_Gia_Chuan_MEP.xlsx` và `BOQ_Mau_Cong_Trinh.xlsx`) để bạn thử nghiệm kéo thả.

### 3.2. Tab 2: Không Gian Áp Giá (Pricing Workspace)
Đây là màn hình làm việc chính của kỹ sư:
1. **Nạp Bảng Khối Lượng BOQ:**
   - Bấm **"Dùng BOQ Mẫu Demo"** để thử nghiệm ngay lập tức với 27 dòng công việc cơ điện thực tế.
   - Hoặc bấm **"Chọn File Excel BOQ"** để tải file Excel bất kỳ từ máy tính $\rightarrow$ Hệ thống tự động mở cửa sổ ánh xạ cột để bạn chọn cột STT, Tên vật tư, ĐVT, Khối lượng và các cột Đơn giá/Thành tiền (nếu file đã có sẵn).
2. **Tự Động Áp Giá & Tô Màu Cảnh Báo:**
   - Bấm nút **"⚡ Tự Động Áp Giá"**: Phần mềm chạy thanh tiến trình và tự động điền đơn giá Vật tư, đơn giá Nhân công, tính ra Thành tiền Vật tư, Thành tiền Nhân công và Tổng thành tiền.
   - Các dòng khớp chuẩn 100% hiển thị huy hiệu xanh lá.
   - **Tô màu đỏ/hồng cảnh báo:** Tất cả các dòng có **độ khớp nhỏ hơn 70%** hoặc chưa có đơn giá sẽ tự động được tô màu nền đỏ nhạt nổi bật để kỹ sư nhận biết ngay lập tức.
   - Bấm nút **"⚠️ Lọc Khớp < 70%"** để chỉ hiển thị các dòng cần kiểm tra rà soát lại đơn giá.
   - Các dòng khớp mờ hiển thị nút **"🔍 Chọn lại"**: Bấm vào để xem danh sách gợi ý vật tư tương đồng nhất và chọn 1 cú click.
3. **Chỉnh Sửa Trực Tiếp (In-line Editing):**
   - Bạn có thể gõ trực tiếp đơn giá vào bất kỳ ô nào trên bảng tính. Hệ thống sẽ tự động tính lại thành tiền và tổng cộng tức thời!
   - Bấm biểu tượng 💾 ở cột Thao tác để ghi nhớ mức giá này cho các lần sau.
4. **Gọi AI Gemini 3.8 Flash Hỗ Trợ:**
   - Với các dòng vật tư lạ hoặc viết tắt chưa có trong kho, bấm nút 🤖: **AI Gemini 3.8 Flash** sẽ phân tích ngữ nghĩa, đề xuất nội suy đơn giá và giải thích lý do tính toán.
   - Bạn xem xét và bấm **"Chấp Nhận Áp Giá Này"** để đưa giá vào bảng.
5. **Xuất File Excel Chuẩn Form BOQ:**
   - Bấm **"📥 Xuất File Excel Chuẩn Form BOQ"**: Hệ thống bảo toàn **100% cấu trúc, form mẫu, tiêu đề dự án, các ô gộp của file BOQ gốc** và điền đơn giá, công thức thành tiền trực tiếp vào sheet; đồng thời tô màu cảnh báo các dòng độ khớp < 70%.

### 3.3. Tab 3: Kho Bảng Giá (Price Library)
- **Hệ thống Quản lý Đa File Bảng Giá (Multi-Catalog):** Mỗi file Excel bạn đưa lên sẽ được hệ thống tự động ghi nhớ thành một "File Bảng Giá" độc lập mang tên file Excel gốc, lưu trữ riêng biệt, không bị gộp đè lên nhau.
- **Tùy chọn Đơn Giá Muốn Dùng:** Dropdown ở đầu bảng cho phép bạn tùy ý chọn xem danh mục vật tư của riêng từng file (ví dụ: `Bang_Gia_Cadivi.xlsx`, `Bang_Gia_TienPhong.xlsx`...) hoặc xem "Tất Cả File Bảng Giá".
- **Nút "⚙️ Quản Lý File Giá":**
  - Xem danh sách toàn bộ các file giá đã nạp, số lượng dòng vật tư và ngày tải lên.
  - **Bật / Tắt (ON/OFF):** Chọn file giá nào sẽ tham gia vào quá trình tự động áp giá BOQ.
  - **Thứ Tự Ưu Tiên (▲/▼):** Sắp xếp thứ tự ưu tiên (File Ưu Tiên 1 tra trước $\rightarrow$ File Ưu Tiên 2 tra sau...).
  - **Xóa Riêng Từng File (🗑️):** Xóa sạch file và toàn bộ vật tư của file đó mà tuyệt đối không ảnh hưởng đến các file giá khác.
- **Nội Suy Kỹ Thuật Tự Động:** Khi mục BOQ chưa có trong file nào, hệ thống sẽ tự động phân tích và nội suy đơn giá theo tỷ lệ quy cách từ các danh mục tương tự trong các file giá đang bật.
- **Nút "Nhập File Excel Bảng Giá":** Nạp thêm file Excel bảng giá mới vào hệ thống.
- **Nút "Thêm Vật Tư Mới":** Nhập tay một vật tư mới vào file bảng giá đang chọn.

### 3.4. Tab 4: Bộ Nhớ Quy Tắc (Mapping Memory)
- Nơi lưu trữ tất cả các cặp từ khóa mà hệ thống đã "học" được từ các lần kỹ sư chọn và duyệt giá.
- Bạn có thể tra cứu xem hệ thống đang ghi nhớ những quy tắc nào và xóa bỏ quy tắc nếu không còn phù hợp.

### 3.5. Tab 5: Cài Đặt (Settings)
- **Cấu hình Gemini API Key:** Nhập API Key cá nhân của bạn, chọn mô hình (`gemini-1.5-flash` hoặc `gemini-1.5-pro`), bấm nút **"Kiểm Tra Kết Nối API"** để kiểm tra tính hợp lệ.
- **Ngưỡng khớp mờ (%):** Tùy chỉnh thanh trượt độ nhạy tìm kiếm.
- **Sao lưu & Phục hồi CSDL:** Xuất toàn bộ kho giá và bộ nhớ quy tắc ra file `.json` để sao lưu sang máy tính khác hoặc phục hồi khi cần.

---

## 4. CẤU TRÚC THƯ MỤC DỰ ÁN

```
c:\Users\Admin\Desktop\Ap gia tu dong\
├── AGENTS.md                  # Quy tắc làm việc cốt lõi của Agent
├── ke_hoach_trien_khai.md     # Bản kế hoạch triển khai đã được phê duyệt
├── HUONG_DAN_SU_DUNG.md       # Tài liệu hướng dẫn sử dụng chi tiết
├── Chay_Phan_Mem.bat          # File chạy ứng dụng Desktop 1-click
├── index.html                 # Giao diện chính Desktop App
├── styles.css                 # Hệ thống CSS hiện đại Glassmorphism, Dark/Light Mode
├── app.js                     # Bộ điều khiển trung tâm toàn bộ ứng dụng
├── libs/
│   └── xlsx.full.min.js       # Thư viện SheetJS xử lý Excel offline
├── js/
│   ├── database.js            # CSDL cục bộ IndexedDB/LocalStorage
│   ├── excel_processor.js     # Engine đọc, map cột và xuất file Excel công thức
│   ├── fuzzy_matcher.js       # Thuật toán khớp mờ chuyên ngành Cơ Điện M&E
│   ├── gemini_api.js          # Tích hợp Google Gemini AI semantic & interpolation
│   └── sample_data.js         # Bộ dữ liệu mẫu chuẩn M&E (Điện, Nước, HVAC)
└── data/
    ├── Bang_Gia_Chuan_MEP.csv # File dữ liệu bảng giá mẫu
    └── BOQ_Mau_Cong_Trinh.csv # File dữ liệu BOQ mẫu công trình
```
