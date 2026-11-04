# QUY TẮC BẮT BUỘC KHI LÀM VIỆC (CORE OPERATING RULES)

Tất cả các phiên làm việc và mọi tương tác của AI Agent trong dự án này PHẢI TUÂN THỦ TUYỆT ĐỐI các quy tắc gốc dưới đây. Không có ngoại lệ.

---

## 1. Sử Dụng 100% Ngôn Ngữ Tiếng Việt
- **Ngôn ngữ giao tiếp**: Mọi câu trả lời, giải thích, trao đổi, thông báo tiến độ, và tài liệu hướng dẫn phải được viết bằng 100% tiếng Việt tự nhiên, rõ ràng, mạch lạc.
- **Ngoại lệ kỹ thuật**: Chỉ giữ nguyên tiếng Anh cho:
  - Tên biến, hàm, class, schema, API endpoint trong mã nguồn.
  - Tên các thư viện, framework, package, công nghệ hoặc thuật ngữ chuyên ngành chuẩn quốc tế không thể dịch hoặc dịch ra gây hiểu lầm.
- **Giải thích & chú thích code**: Mọi chú thích (comments) trong code hoặc phân tích logic kỹ thuật đều phải viết bằng tiếng Việt.

---

## 2. Luôn Lập Kế Hoạch (Plan) Trước Khi Code & Phải Được Người Dùng Duyệt
- **Cấm tự ý viết code trước**: Tuyệt đối KHÔNG viết mã nguồn mới, KHÔNG chỉnh sửa code hiện có, và KHÔNG chạy các lệnh can thiệp logic dự án khi chưa có Kế hoạch (Plan) hoàn chỉnh.
- **Cấu trúc của Plan**:
  1. **Mục tiêu**: Tóm tắt rõ ràng những gì sẽ đạt được.
  2. **Kiến trúc & Công nghệ**: Thư viện, mô hình, giải pháp dự kiến sử dụng.
  3. **Các bước triển khai chi tiết**: Phân tách thành từng bước cụ thể, có thứ tự thực hiện rõ ràng.
  4. **Rủi ro & Phương án xử lý (Edge Cases)**: Dự tính các lỗi có thể gặp và cách phòng ngừa.
  5. **Tiêu chí kiểm thử/đánh giá hoàn thành**: Cách kiểm chứng tính đúng đắn.
- **Yêu cầu phê duyệt**: Sau khi trình bày Plan, agent PHẢI dừng lại và chờ người dùng duyệt (phê duyệt bằng chữ "Đồng ý", "Duyệt", "Proceed", hoặc chỉnh sửa góp ý). Chỉ khi người dùng đồng ý mới được bắt đầu bước code.

---

## 3. Hỏi Ít Nhất 10 Câu Hỏi Để Thu Thập Thông Tin Bổ Sung Vào Plan
- **Nguyên tắc làm rõ yêu cầu**: Trước khi chốt Plan hoặc trong quá trình xây dựng Plan cho bất kỳ tác vụ/tính năng mới nào, agent PHẢI đặt ra **ít nhất 10 câu hỏi chi tiết, có chiều sâu**.
- **Các nhóm câu hỏi cần khai thác**:
  1. Yêu cầu nghiệp vụ & bài toán cốt lõi.
  2. Đối tượng sử dụng & quy mô thành viên gia đình.
  3. Đầu vào dữ liệu (nhập tay, scan hóa đơn OCR, import Excel/CSV, kết nối ngân hàng...).
  4. Đầu ra mong muốn (báo cáo, biểu đồ, xuất file PDF/Excel, thông báo cảnh báo...).
  5. Công nghệ, thư viện, hoặc framework ưu tiên sử dụng (Frontend, Backend, Database).
  6. Môi trường thực thi & nền tảng (Web App, Desktop App, Mobile/PWA...).
  7. Yêu cầu về giao diện người dùng (UI/UX), chủ đề sáng/tối (Dark/Light mode), độ thẩm mỹ.
  8. Quản lý phân quyền & thành viên (ai chi tiêu, ai xem, quỹ chung vs chi tiêu riêng).
  9. Bảo mật dữ liệu & lưu trữ (Local Storage, SQLite, Cloud Database...).
  10. Kịch bản kiểm thử, dữ liệu mẫu và tính năng đặc biệt (quản lý ngân sách tháng, cảnh báo vượt hạn mức, chia tiền quỹ...).
- **Tích hợp thông tin**: Sau khi người dùng trả lời, toàn bộ thông tin thu thập được phải được tổng hợp và bổ sung trực tiếp vào Plan trước khi trình người dùng phê duyệt.
