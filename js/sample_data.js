/**
 * Bộ Dữ liệu Mẫu Chuẩn Cơ Điện M&E Việt Nam (Sample MEP Dataset)
 * Bao gồm các hệ: Điện (Electrical), Cấp thoát nước (Plumbing), Điều hòa & Thông gió (HVAC)
 * Có đầy đủ Mã hiệu, Thông số quy cách, ĐVT, Đơn giá Vật tư và Đơn giá Nhân công thực tế
 */

const DEFAULT_MEP_MATERIALS = [
  // ==========================================
  // 1. HỆ THỐNG ĐIỆN (ELECTRICAL SYSTEM)
  // ==========================================
  {
    code: 'E-CDV-01',
    name: 'Dây điện đơn ruột đồng bọc PVC',
    spec: 'Cu/PVC 1x1.5 mm2 - 450/750V',
    unit: 'm',
    materialPrice: 4200,
    laborPrice: 6500,
    supplier: 'Cadivi',
    system: 'Hệ Điện'
  },
  {
    code: 'E-CDV-02',
    name: 'Dây điện đơn ruột đồng bọc PVC',
    spec: 'Cu/PVC 1x2.5 mm2 - 450/750V',
    unit: 'm',
    materialPrice: 6800,
    laborPrice: 7000,
    supplier: 'Cadivi',
    system: 'Hệ Điện'
  },
  {
    code: 'E-CDV-03',
    name: 'Dây điện đơn ruột đồng bọc PVC',
    spec: 'Cu/PVC 1x4.0 mm2 - 450/750V',
    unit: 'm',
    materialPrice: 10500,
    laborPrice: 8500,
    supplier: 'Cadivi',
    system: 'Hệ Điện'
  },
  {
    code: 'E-CDV-04',
    name: 'Dây điện đôi ruột đồng bọc PVC',
    spec: 'Cu/PVC/PVC 2x1.5 mm2',
    unit: 'm',
    materialPrice: 9500,
    laborPrice: 8000,
    supplier: 'Cadivi',
    system: 'Hệ Điện'
  },
  {
    code: 'E-CDV-05',
    name: 'Dây điện đôi ruột đồng bọc PVC',
    spec: 'Cu/PVC/PVC 2x2.5 mm2',
    unit: 'm',
    materialPrice: 15200,
    laborPrice: 9500,
    supplier: 'Cadivi',
    system: 'Hệ Điện'
  },
  {
    code: 'E-CDV-06',
    name: 'Cáp điện lực hạ thế 4 ruột',
    spec: 'Cu/XLPE/PVC 4x16 mm2 - 0.6/1kV',
    unit: 'm',
    materialPrice: 185000,
    laborPrice: 35000,
    supplier: 'Cadivi',
    system: 'Hệ Điện'
  },
  {
    code: 'E-CDV-07',
    name: 'Cáp điện lực hạ thế 4 ruột',
    spec: 'Cu/XLPE/PVC 4x25 mm2 - 0.6/1kV',
    unit: 'm',
    materialPrice: 280000,
    laborPrice: 48000,
    supplier: 'Cadivi',
    system: 'Hệ Điện'
  },
  {
    code: 'E-SCH-01',
    name: 'Aptomat tép tự động MCB 1 cực',
    spec: '1P 16A 6kA Easy9',
    unit: 'Cái',
    materialPrice: 65000,
    laborPrice: 30000,
    supplier: 'Schneider',
    system: 'Hệ Điện'
  },
  {
    code: 'E-SCH-02',
    name: 'Aptomat tép tự động MCB 1 cực',
    spec: '1P 20A 6kA Easy9',
    unit: 'Cái',
    materialPrice: 68000,
    laborPrice: 30000,
    supplier: 'Schneider',
    system: 'Hệ Điện'
  },
  {
    code: 'E-SCH-03',
    name: 'Aptomat tép tự động MCB 2 cực',
    spec: '2P 32A 6kA Easy9',
    unit: 'Cái',
    materialPrice: 165000,
    laborPrice: 45000,
    supplier: 'Schneider',
    system: 'Hệ Điện'
  },
  {
    code: 'E-SCH-04',
    name: 'Aptomat khối tự động MCCB 3 cực',
    spec: '3P 100A 18kA EasyPact CVS',
    unit: 'Cái',
    materialPrice: 1450000,
    laborPrice: 250000,
    supplier: 'Schneider',
    system: 'Hệ Điện'
  },
  {
    code: 'E-PNS-01',
    name: 'Ổ cắm đôi 3 chấu có màn che an toàn',
    spec: '16A 250V Wide Series',
    unit: 'Bộ',
    materialPrice: 85000,
    laborPrice: 35000,
    supplier: 'Panasonic',
    system: 'Hệ Điện'
  },
  {
    code: 'E-PNS-02',
    name: 'Công tắc đơn 1 chiều',
    spec: '16A 250V Wide Series',
    unit: 'Bộ',
    materialPrice: 45000,
    laborPrice: 30000,
    supplier: 'Panasonic',
    system: 'Hệ Điện'
  },
  {
    code: 'E-DHL-01',
    name: 'Đèn LED âm trần Downlight tròn',
    spec: 'Công suất 9W, D110mm, ánh sáng trắng/vàng',
    unit: 'Bộ',
    materialPrice: 115000,
    laborPrice: 40000,
    supplier: 'Duhal / Rạng Đông',
    system: 'Hệ Điện'
  },
  {
    code: 'E-DHL-02',
    name: 'Đèn LED Panel tấm vuông âm trần',
    spec: 'Kích thước 600x600mm, công suất 48W',
    unit: 'Bộ',
    materialPrice: 380000,
    laborPrice: 75000,
    supplier: 'Duhal / Rạng Đông',
    system: 'Hệ Điện'
  },
  {
    code: 'E-TRK-01',
    name: 'Máng cáp điện tôn mạ kẽm kèm nắp',
    spec: 'Kích thước 200x100mm, dày 1.2mm',
    unit: 'm',
    materialPrice: 165000,
    laborPrice: 60000,
    supplier: 'Sản xuất trong nước',
    system: 'Hệ Điện'
  },

  // ==========================================
  // 2. HỆ THỐNG CẤP THOÁT NƯỚC (PLUMBING)
  // ==========================================
  {
    code: 'P-TP-01',
    name: 'Ống nhựa uPVC thoát nước class 2',
    spec: 'uPVC D60x2.0mm',
    unit: 'm',
    materialPrice: 32000,
    laborPrice: 28000,
    supplier: 'Tiền Phong',
    system: 'Hệ Nước'
  },
  {
    code: 'P-TP-02',
    name: 'Ống nhựa uPVC thoát nước class 2',
    spec: 'uPVC D90x2.9mm',
    unit: 'm',
    materialPrice: 65000,
    laborPrice: 35000,
    supplier: 'Tiền Phong',
    system: 'Hệ Nước'
  },
  {
    code: 'P-TP-03',
    name: 'Ống nhựa uPVC thoát nước class 2',
    spec: 'uPVC D110x3.2mm',
    unit: 'm',
    materialPrice: 98000,
    laborPrice: 42000,
    supplier: 'Tiền Phong',
    system: 'Hệ Nước'
  },
  {
    code: 'P-TP-04',
    name: 'Ống nhựa uPVC thoát nước class 2',
    spec: 'uPVC D160x4.0mm',
    unit: 'm',
    materialPrice: 195000,
    laborPrice: 65000,
    supplier: 'Tiền Phong',
    system: 'Hệ Nước'
  },
  {
    code: 'P-TP-05',
    name: 'Cút 90 độ nhựa uPVC',
    spec: 'Co 90 uPVC D90',
    unit: 'Cái',
    materialPrice: 28000,
    laborPrice: 18000,
    supplier: 'Tiền Phong',
    system: 'Hệ Nước'
  },
  {
    code: 'P-TP-06',
    name: 'Cút 90 độ nhựa uPVC',
    spec: 'Co 90 uPVC D110',
    unit: 'Cái',
    materialPrice: 42000,
    laborPrice: 22000,
    supplier: 'Tiền Phong',
    system: 'Hệ Nước'
  },
  {
    code: 'P-TP-07',
    name: 'Ba chạc 90 độ (Tê) nhựa uPVC',
    spec: 'Tê uPVC D110',
    unit: 'Cái',
    materialPrice: 62000,
    laborPrice: 25000,
    supplier: 'Tiền Phong',
    system: 'Hệ Nước'
  },
  {
    code: 'P-PPR-01',
    name: 'Ống nhựa hàn nhiệt PPR PN10 (Nước lạnh)',
    spec: 'PPR D25x2.3mm',
    unit: 'm',
    materialPrice: 25000,
    laborPrice: 22000,
    supplier: 'Tiền Phong / Dekko',
    system: 'Hệ Nước'
  },
  {
    code: 'P-PPR-02',
    name: 'Ống nhựa hàn nhiệt PPR PN10 (Nước lạnh)',
    spec: 'PPR D32x2.9mm',
    unit: 'm',
    materialPrice: 38000,
    laborPrice: 26000,
    supplier: 'Tiền Phong / Dekko',
    system: 'Hệ Nước'
  },
  {
    code: 'P-PPR-03',
    name: 'Ống nhựa hàn nhiệt PPR PN20 (Nước nóng)',
    spec: 'PPR D25x4.2mm',
    unit: 'm',
    materialPrice: 45000,
    laborPrice: 26000,
    supplier: 'Tiền Phong / Dekko',
    system: 'Hệ Nước'
  },
  {
    code: 'P-VAL-01',
    name: 'Van cổng đồng nối ren',
    spec: 'DN25 - Đồng thau mạ niken',
    unit: 'Cái',
    materialPrice: 175000,
    laborPrice: 50000,
    supplier: 'Miha / Minh Hòa',
    system: 'Hệ Nước'
  },
  {
    code: 'P-VAL-02',
    name: 'Van cổng đồng nối ren',
    spec: 'DN50 - Đồng thau mạ niken',
    unit: 'Cái',
    materialPrice: 450000,
    laborPrice: 85000,
    supplier: 'Miha / Minh Hòa',
    system: 'Hệ Nước'
  },
  {
    code: 'P-VAL-03',
    name: 'Van bướm tay gạt thân gang cánh inox',
    spec: 'DN100 PN16',
    unit: 'Cái',
    materialPrice: 1250000,
    laborPrice: 220000,
    supplier: 'Shinyi',
    system: 'Hệ Nước'
  },
  {
    code: 'P-PMP-01',
    name: 'Máy bơm ly tâm trục ngang cấp nước sinh hoạt',
    spec: 'Công suất 3.7kW (5HP), Q=15-30 m3/h, H=35-20m',
    unit: 'Bộ',
    materialPrice: 24500000,
    laborPrice: 1800000,
    supplier: 'Ebara',
    system: 'Hệ Nước'
  },

  // ==========================================
  // 3. HỆ THỐNG ĐIỀU HÒA & THÔNG GIÓ (HVAC)
  // ==========================================
  {
    code: 'H-DCT-01',
    name: 'Đường ống gió vuông tôn mạ kẽm',
    spec: 'Tôn mạ kẽm dày 0.75mm, nẹp TDC',
    unit: 'm2',
    materialPrice: 240000,
    laborPrice: 95000,
    supplier: 'Gia công nhà xưởng',
    system: 'Hệ HVAC'
  },
  {
    code: 'H-DCT-02',
    name: 'Đường ống gió vuông tôn mạ kẽm có bảo ôn',
    spec: 'Tôn dày 0.75mm bọc bông thủy tinh cách nhiệt dày 25mm có bạc',
    unit: 'm2',
    materialPrice: 360000,
    laborPrice: 135000,
    supplier: 'Gia công nhà xưởng',
    system: 'Hệ HVAC'
  },
  {
    code: 'H-DIF-01',
    name: 'Miệng gió khuếch tán vuông 4 hướng',
    spec: 'Kích thước cổ 450x450mm, mặt 600x600mm, nhôm sơn tĩnh điện',
    unit: 'Cái',
    materialPrice: 290000,
    laborPrice: 70000,
    supplier: 'Sản xuất trong nước',
    system: 'Hệ HVAC'
  },
  {
    code: 'H-DIF-02',
    name: 'Miệng gió hút / hồi kèm lưới lọc bụi',
    spec: 'Kích thước 600x600mm nan bầu dục mở được',
    unit: 'Cái',
    materialPrice: 380000,
    laborPrice: 85000,
    supplier: 'Sản xuất trong nước',
    system: 'Hệ HVAC'
  },
  {
    code: 'H-VLV-01',
    name: 'Van dập lửa cầu chì ống gió (FD)',
    spec: 'Kích thước 400x300mm kèm cầu chì 72 độ C',
    unit: 'Cái',
    materialPrice: 420000,
    laborPrice: 90000,
    supplier: 'Sản xuất trong nước',
    system: 'Hệ HVAC'
  },
  {
    code: 'H-FAN-01',
    name: 'Quạt hút thông gió gắn trần nối ống',
    spec: 'Lưu lượng Q=250 m3/h, công suất 35W, D100',
    unit: 'Bộ',
    materialPrice: 720000,
    laborPrice: 120000,
    supplier: 'Nedfon',
    system: 'Hệ HVAC'
  },
  {
    code: 'H-AC-01',
    name: 'Dàn lạnh âm trần nối ống gió trung tâm VRV',
    spec: 'Công suất làm lạnh 5.0HP (~48,000 BTU/h)',
    unit: 'Bộ',
    materialPrice: 32500000,
    laborPrice: 2500000,
    supplier: 'Daikin',
    system: 'Hệ HVAC'
  }
];

/**
 * Danh sách các dòng BOQ mẫu đại diện cho một công trình cơ điện thực tế
 * Dùng để kiểm thử ngay lập tức (Test Suite)
 */
const SAMPLE_BOQ_DEMO = [
  { stt: 'I', code: '', description: 'HỆ THỐNG CẤP ĐIỆN VÀ CHIẾU SÁNG', unit: '', quantity: 0, isHeader: true },
  { stt: '1', code: '', description: 'Dây điện Cu/PVC 1x1.5mm2 luồn trong ống', unit: 'm', quantity: 1500, isHeader: false },
  { stt: '2', code: '', description: 'Dây đồng đơn bọc PVC 1x2.5 mm2', unit: 'm', quantity: 2200, isHeader: false },
  { stt: '3', code: '', description: 'Dây dẫn điện Cu/PVC 1x4.0mm2', unit: 'm', quantity: 800, isHeader: false },
  { stt: '4', code: '', description: 'Cáp điện Cu/XLPE/PVC 4x16mm2 cấp nguồn tổng', unit: 'm', quantity: 120, isHeader: false },
  { stt: '5', code: '', description: 'Aptomat 1P 16A Schneider', unit: 'Cái', quantity: 45, isHeader: false },
  { stt: '6', code: '', description: 'Cầu dao tự động MCB 2P 32A', unit: 'Cái', quantity: 18, isHeader: false },
  { stt: '7', code: '', description: 'MCCB 3 pha 100A 18kA tủ MSB', unit: 'Cái', quantity: 2, isHeader: false },
  { stt: '8', code: '', description: 'Đèn LED downlight âm trần 9W D110 Duhal', unit: 'Bộ', quantity: 160, isHeader: false },
  { stt: '9', code: '', description: 'Đèn tấm panel 600x600 48W văn phòng', unit: 'Bộ', quantity: 36, isHeader: false },
  { stt: '10', code: '', description: 'Ổ cắm đôi 3 chấu có tiếp địa Panasonic', unit: 'Bộ', quantity: 85, isHeader: false },
  
  { stt: 'II', code: '', description: 'HỆ THỐNG CẤP THOÁT NƯỚC', unit: '', quantity: 0, isHeader: true },
  { stt: '11', code: '', description: 'Ống thoát nước uPVC D90 Tiền Phong C2', unit: 'm', quantity: 350, isHeader: false },
  { stt: '12', code: '', description: 'Ống nhựa uPVC D110x3.2mm thoát phân', unit: 'm', quantity: 280, isHeader: false },
  { stt: '13', code: '', description: 'Co 90 độ uPVC D110', unit: 'Cái', quantity: 64, isHeader: false },
  { stt: '14', code: '', description: 'Tê đều nhựa uPVC D110', unit: 'Cái', quantity: 32, isHeader: false },
  { stt: '15', code: '', description: 'Ống hàn nhiệt PPR D25 nước lạnh PN10', unit: 'm', quantity: 420, isHeader: false },
  { stt: '16', code: '', description: 'Van chặn đồng nối ren DN50', unit: 'Cái', quantity: 8, isHeader: false },
  { stt: '17', code: '', description: 'Van bướm tay gạt DN100 mặt bích', unit: 'Cái', quantity: 4, isHeader: false },
  { stt: '18', code: '', description: 'Máy bơm ly tâm trục ngang cấp nước 3.7kW', unit: 'Bộ', quantity: 2, isHeader: false },

  { stt: 'III', code: '', description: 'HỆ THỐNG ĐIỀU HÒA & THÔNG GIÓ (HVAC)', unit: '', quantity: 0, isHeader: true },
  { stt: '19', code: '', description: 'Ống gió tôn mạ kẽm dày 0.75mm cấp gió tươi', unit: 'm2', quantity: 450, isHeader: false },
  { stt: '20', code: '', description: 'Ống gió tôn 0.75 bọc bông cách nhiệt 25mm', unit: 'm2', quantity: 320, isHeader: false },
  { stt: '21', code: '', description: 'Cửa gió khuếch tán 4 hướng 600x600 nhôm', unit: 'Cái', quantity: 48, isHeader: false },
  { stt: '22', code: '', description: 'Van dập lửa FD 400x300', unit: 'Cái', quantity: 6, isHeader: false },
  { stt: '23', code: '', description: 'Quạt hút âm trần nối ống gió Nedfon 35W', unit: 'Bộ', quantity: 12, isHeader: false },
  { stt: '24', code: '', description: 'Dàn lạnh giấu trần nối ống gió VRV 5HP Daikin', unit: 'Bộ', quantity: 8, isHeader: false },
  
  { stt: 'IV', code: '', description: 'VẬT TƯ CẦN NỘI SUY / CHƯA CÓ TRONG KHO (EDGE CASES)', unit: '', quantity: 0, isHeader: true },
  { stt: '25', code: '', description: 'Dây cáp điện lực Cu/XLPE 4x50mm2 cấp nguồn Chiller', unit: 'm', quantity: 60, isHeader: false },
  { stt: '26', code: '', description: 'Van bướm tay gạt thân gang cánh inox DN125 PN16', unit: 'Cái', quantity: 2, isHeader: false },
  { stt: '27', code: '', description: 'Côn thu ống nhựa uPVC D110/90 Tiền Phong', unit: 'Cái', quantity: 15, isHeader: false }
];

window.DEFAULT_MEP_MATERIALS = DEFAULT_MEP_MATERIALS;
window.SAMPLE_BOQ_DEMO = SAMPLE_BOQ_DEMO;
