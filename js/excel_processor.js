/**
 * Module Xử lý File Excel (Excel Importer & Exporter Engine)
 * Đọc file bảng giá, đọc file BOQ đầu vào, hỗ trợ ánh xạ cột linh hoạt
 * Sử dụng ExcelJS để xuất file kết quả GIỮ NGUYÊN 100% FORM BOQ ĐẦU VÀO:
 * - Giữ trọn vẹn mọi ô gộp (merge cells), phông chữ, chiều cao dòng, độ rộng cột, đường viền
 * - Tự động căn chỉnh chuẩn ngành dự toán (STT/ĐVT giữa, Diễn giải trái, Số/Tiền phải format #,##0)
 * - Tự động tô màu cảnh báo: Vàng nhạt (độ khớp < 70%), Tím nhạt (AI nội suy)
 */

class ExcelProcessor {
  constructor() {
    this.currentWorkbook = null;
    this.currentSheetName = null;
    this.rawRows = [];
    this.rawFileBuffer = null;
    this.boqFileBuffer = null;     // Lưu riêng buffer tệp BOQ gốc
    this.priceFileBuffer = null;   // Lưu riêng buffer tệp Bảng Giá gốc
  }

  /**
   * Đọc tệp Excel từ người dùng tải lên
   * @param {File} file - Tệp Excel
   * @param {string} type - 'boq' | 'price'
   */
  async readExcelFile(file, type = 'boq') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      reader.onload = (e) => {
        try {
          const data = new Uint8Array(e.target.result);
          this.rawFileBuffer = data;

          if (type === 'boq') {
            this.boqFileBuffer = data;
          } else if (type === 'price') {
            this.priceFileBuffer = data;
          }

          // Sử dụng thư viện SheetJS offline để phân tích nhanh cấu trúc bảng
          const workbook = XLSX.read(data, {
            type: 'array',
            cellDates: true,
            cellStyles: true,
            raw: false
          });

          this.currentWorkbook = workbook;
          const sheetNames = workbook.SheetNames;
          const firstSheetName = sheetNames[0];
          this.currentSheetName = firstSheetName;

          const worksheet = workbook.Sheets[firstSheetName];
          const rows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
          this.rawRows = rows;

          resolve({
            sheetNames: sheetNames,
            activeSheet: firstSheetName,
            rows: rows,
            totalRows: rows.length,
            workbook: workbook
          });
        } catch (err) {
          console.error('Lỗi khi phân tích tệp Excel:', err);
          reject(new Error('Không thể đọc tệp Excel. Vui lòng kiểm tra lại định dạng file (.xlsx, .xls)!'));
        }
      };

      reader.onerror = (err) => {
        reject(new Error('Lỗi khi đọc file từ ổ đĩa: ' + err.message));
      };

      reader.readAsArrayBuffer(file);
    });
  }

  /**
   * Chuyển đổi Sheet được chọn
   */
  switchSheet(sheetName) {
    if (!this.currentWorkbook || !this.currentWorkbook.Sheets[sheetName]) {
      return null;
    }
    this.currentSheetName = sheetName;
    const worksheet = this.currentWorkbook.Sheets[sheetName];
    this.rawRows = XLSX.utils.sheet_to_json(worksheet, { header: 1, defval: '' });
    return this.rawRows;
  }

  /**
   * Tự động phán đoán vai trò các cột dựa vào tên tiêu đề (Header Auto-detection Thông Minh)
   * Sử dụng thuật toán chấm điểm trọng số (Scoring Multi-column) và tự động ghép tiêu đề 2 tầng (Multi-level Header)
   */
  autoDetectColumns(sampleRows, type = 'boq') {
    if (!sampleRows || sampleRows.length === 0) return {};

    // 1. Tìm dòng có điểm số Header cao nhất trong tối đa 25 dòng đầu
    let bestRowIndex = 0;
    let bestScore = -1;

    for (let i = 0; i < Math.min(25, sampleRows.length); i++) {
      const row = sampleRows[i] || [];
      const nonEmptyCells = row.filter(c => c !== null && c !== undefined && c.toString().trim() !== '');
      if (nonEmptyCells.length < 2) continue; // Bỏ qua các dòng chỉ có 1 ô (thường là tiêu đề dự án, tên công ty)

      let score = 0;
      const rowText = row.map(c => (c || '').toString().toLowerCase()).join(' ');

      if (rowText.includes('stt') || rowText.includes('no.') || rowText.includes('item')) score += 3;
      if (rowText.includes('tên') || rowText.includes('diễn giải') || rowText.includes('công tác') || rowText.includes('nội dung') || rowText.includes('mô tả')) score += 5;
      if (rowText.includes('đvt') || rowText.includes('đơn vị') || rowText.includes('unit')) score += 3;
      if (rowText.includes('khối lượng') || rowText.includes('số lượng') || rowText.includes('qty')) score += 4;
      if (rowText.includes('đơn giá') || rowText.includes('price') || rowText.includes('đơn giá (chưa vat)')) score += 4;
      if (rowText.includes('nhân công') || rowText.includes('vật tư')) score += 3;
      if (rowText.includes('thành tiền') || rowText.includes('total') || rowText.includes('tiền')) score += 3;
      if (rowText.includes('quy cách') || rowText.includes('thông số') || rowText.includes('spec')) score += 2;

      if (score > bestScore) {
        bestScore = score;
        bestRowIndex = i;
      }
    }

    const row1 = sampleRows[bestRowIndex] || [];
    const row2 = sampleRows[bestRowIndex + 1] || [];

    // 2. Nhận diện tiêu đề 2 tầng (Multi-level Sub-Header)
    // Ví dụ Tầng 1: Đơn giá, Thành tiền | Tầng 2: Vật tư, Nhân công, Tổng
    const text2 = row2.map(c => (c || '').toString().toLowerCase()).join(' ');
    const isSubHeader = (
      text2.includes('vật tư') ||
      text2.includes('nhân công') ||
      text2.includes('máy') ||
      text2.includes('tổng')
    );

    let mergedHeaders = [];
    let currentParent = '';
    let dataStartRowIndex = bestRowIndex + (isSubHeader ? 2 : 1);

    if (isSubHeader) {
      const maxLen = Math.max(row1.length, row2.length);
      for (let c = 0; c < maxLen; c++) {
        const h1 = (row1[c] || '').toString().trim();
        const h2 = (row2[c] || '').toString().trim();

        if (h1) currentParent = h1;

        if (h1 && h2) {
          mergedHeaders.push(h1 + ' - ' + h2);
        } else if (h2) {
          mergedHeaders.push((currentParent ? currentParent + ' - ' : '') + h2);
        } else if (h1) {
          mergedHeaders.push(h1);
        } else {
          mergedHeaders.push(`Cột ${c + 1}`);
        }
      }
    } else {
      mergedHeaders = row1.map((c, idx) => (c || '').toString().trim() || `Cột ${idx + 1}`);
    }

    // Tự động bỏ qua các dòng trống trước khi dữ liệu thực sự bắt đầu
    while (dataStartRowIndex < sampleRows.length) {
      const r = sampleRows[dataStartRowIndex];
      if (r && r.some(cell => cell !== null && cell !== undefined && cell.toString().trim() !== '')) {
        break;
      }
      dataStartRowIndex++;
    }

    const mapping = {
      headerRowIndex: bestRowIndex,
      dataStartRowIndex: dataStartRowIndex,
      mergedHeaders: mergedHeaders,
      isSubHeader: isSubHeader
    };

    // 3. Quét các tiêu đề cột để ánh xạ vai trò
    mergedHeaders.forEach((h, colIdx) => {
      const colName = (h || '').toString().trim().toLowerCase();
      if (!colName) return;

      // Cột STT
      if (colName === 'stt' || colName === 'no' || colName === 'no.' || colName === 'item') {
        if (mapping.sttCol === undefined) mapping.sttCol = colIdx;
      }
      // Cột Mã hiệu
      else if (colName.includes('mã') || colName.includes('code') || colName.includes('sku')) {
        if (mapping.codeCol === undefined) mapping.codeCol = colIdx;
      }
      // Cột Tên vật tư / Tên công tác / Diễn giải
      else if (
        colName.includes('tên công tác') ||
        colName.includes('tên công việc') ||
        colName.includes('tên vật tư') ||
        colName.includes('diễn giải') ||
        colName.includes('nội dung') ||
        colName.includes('mô tả') ||
        colName.includes('description') ||
        (colName.includes('tên') && !colName.includes('thành tiền'))
      ) {
        if (mapping.nameCol === undefined) mapping.nameCol = colIdx;
      }
      // Cột Quy cách / Thông số
      else if (colName.includes('quy cách') || colName.includes('thông số') || colName.includes('spec') || colName.includes('kích thước')) {
        if (mapping.specCol === undefined) mapping.specCol = colIdx;
      }
      // Cột Đơn vị tính (ĐVT)
      else if (colName.includes('đvt') || colName.includes('đơn vị') || colName.includes('unit')) {
        if (mapping.unitCol === undefined) mapping.unitCol = colIdx;
      }
      // Cột Khối lượng / Số lượng
      else if (
        colName.includes('khối lượng') ||
        colName.includes('số lượng') ||
        colName.includes('quantity') ||
        colName.includes('qty') ||
        colName === 'kl' ||
        colName === 'sl'
      ) {
        if (mapping.quantityCol === undefined) mapping.quantityCol = colIdx;
      }
      // Cột Đơn giá Vật tư
      else if (
        (colName.includes('đơn giá') && colName.includes('vật tư')) ||
        (colName.includes('giá') && colName.includes('vt')) ||
        colName.includes('mat price') ||
        (colName.includes('vật tư') && !colName.includes('thành tiền') && !colName.includes('tên'))
      ) {
        if (mapping.materialPriceCol === undefined) mapping.materialPriceCol = colIdx;
      }
      // Cột Đơn giá Nhân công
      else if (
        (colName.includes('đơn giá') && colName.includes('nhân công')) ||
        (colName.includes('giá') && colName.includes('nc')) ||
        colName.includes('labor') ||
        colName.includes('labour') ||
        (colName.includes('nhân công') && !colName.includes('thành tiền') && !colName.includes('tên'))
      ) {
        if (mapping.laborPriceCol === undefined) mapping.laborPriceCol = colIdx;
      }
      // Cột Đơn giá chung (nếu không tách riêng VT và NC)
      else if (
        (colName.includes('đơn giá') || colName === 'giá' || colName.includes('unit price') || colName.includes('rate')) &&
        !colName.includes('thành tiền')
      ) {
        if (mapping.materialPriceCol === undefined) {
          mapping.materialPriceCol = colIdx;
        }
      }
      // Cột Thành tiền Vật tư
      else if (
        colName.includes('thành tiền - vật tư') ||
        colName.includes('thành tiền vt') ||
        colName.includes('tiền vật tư') ||
        colName.includes('mat amount') ||
        colName.includes('mat total')
      ) {
        if (mapping.materialTotalCol === undefined) mapping.materialTotalCol = colIdx;
      }
      // Cột Thành tiền Nhân công
      else if (
        colName.includes('thành tiền - nhân công') ||
        colName.includes('thành tiền nc') ||
        colName.includes('tiền nhân công') ||
        colName.includes('lab amount') ||
        colName.includes('lab total')
      ) {
        if (mapping.laborTotalCol === undefined) mapping.laborTotalCol = colIdx;
      }
      // Cột Tổng cộng thành tiền / Thành tiền tổng
      else if (
        colName.includes('tổng cộng') ||
        colName.includes('tổng tiền') ||
        colName.includes('thành tiền - tổng') ||
        colName.includes('thành tiền') ||
        colName.includes('grand total') ||
        colName.includes('amount')
      ) {
        if (mapping.grandTotalCol === undefined) {
          mapping.grandTotalCol = colIdx;
        }
      }
      // Cột Phân hệ (cho file bảng giá)
      else if (colName.includes('hệ thống') || colName.includes('phân hệ') || colName.includes('system')) {
        if (mapping.systemCol === undefined) mapping.systemCol = colIdx;
      }
      // Cột Nhà cung cấp / Hãng
      else if (colName.includes('nhà cung cấp') || colName.includes('hãng') || colName.includes('ncc') || colName.includes('vendor') || colName.includes('brand')) {
        if (mapping.supplierCol === undefined) mapping.supplierCol = colIdx;
      }
    });

    return mapping;
  }

  /**
   * Chuyển đổi dữ liệu thô sang mảng vật tư chuẩn (cho Kho Bảng Giá)
   * Tự động lọc bỏ các dòng tiêu đề la mã/phân mục không có giá
   */
  parsePriceLibrary(rawRows, mapping, defaultSystem = 'Hệ Điện') {
    const startRow = mapping.dataStartRowIndex || 1;
    const materials = [];

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const name = (row[mapping.nameCol] || '').toString().trim();
      if (!name) continue; // Bỏ qua dòng trống tên

      // Bỏ qua các dòng chỉ chứa ký tự phân mục hoặc đánh số chỉ dẫn: (1), (2), (3)...
      if (name.match(/^\(\d+\)$/)) continue;

      const code = mapping.codeCol !== undefined ? (row[mapping.codeCol] || '').toString().trim() : '';
      const spec = mapping.specCol !== undefined ? (row[mapping.specCol] || '').toString().trim() : '';
      const unit = mapping.unitCol !== undefined ? (row[mapping.unitCol] || '').toString().trim() : 'Bộ';

      const matPrice = mapping.materialPriceCol !== undefined ? this.cleanNumber(row[mapping.materialPriceCol]) : 0;
      const labPrice = mapping.laborPriceCol !== undefined ? this.cleanNumber(row[mapping.laborPriceCol]) : 0;

      // Nếu cả đơn giá vật tư và đơn giá nhân công đều bằng 0, kiểm tra xem có phải dòng tiêu đề phân mục không
      if (matPrice === 0 && labPrice === 0) {
        const upper = name.toUpperCase();
        if (
          upper.startsWith('PHẦN') ||
          upper.startsWith('HẠNG MỤC') ||
          upper.startsWith('HỆ THỐNG') ||
          name.match(/^[IVXLCDM]+[\.\s]/i) ||
          name.match(/^[A-Z][\.\s]/)
        ) {
          continue; // Bỏ qua dòng tiêu đề phân mục không có giá để tránh làm rác kho giá
        }
      }

      // Xác định phân hệ
      let system = defaultSystem;
      if (mapping.systemCol !== undefined && row[mapping.systemCol]) {
        system = row[mapping.systemCol].toString().trim();
      }

      const supplier = mapping.supplierCol !== undefined ? (row[mapping.supplierCol] || '').toString().trim() : '';

      materials.push({
        id: Date.now() + Math.random(),
        code: code || `VT-${materials.length + 1}`,
        name: name,
        spec: spec,
        unit: unit || 'Bộ',
        materialPrice: matPrice,
        laborPrice: labPrice,
        system: system,
        supplier: supplier
      });
    }

    return materials;
  }

  /**
   * Nạp gộp toàn bộ các Sheet của tệp Bảng Giá đa phân hệ (Multi-sheet Price Catalog)
   * Tự động nhận diện cột và chuẩn hóa tên phân hệ theo từng Sheet
   */
  parseAllSheetsPriceLibrary(workbook, baseMapping = null, defaultSupplier = '') {
    if (!workbook || !workbook.SheetNames || workbook.SheetNames.length === 0) {
      return [];
    }

    const allMaterials = [];
    const systemNameMap = {
      'điện': 'Hệ Thống Điện',
      'điện nhẹ': 'Hệ Thống Điện Nhẹ',
      'ctn': 'Hệ Thống Cấp Thoát Nước',
      'cấp thoát nước': 'Hệ Thống Cấp Thoát Nước',
      'đhkk': 'Hệ Thống Điều Hòa Không Khí & Thông Gió',
      'điều hòa': 'Hệ Thống Điều Hòa Không Khí & Thông Gió',
      'hvac': 'Hệ Thống HVAC',
      'ckt': 'Hệ Thống Cấp Khí Tươi & Hút Mùi',
      'tahk': 'Hệ Thống Tăng Áp & Hút Khói',
      'pccc': 'Hệ Thống PCCC',
      'heatpump': 'Hệ Thống Heatpump & Nước Nóng'
    };

    workbook.SheetNames.forEach(sheetName => {
      const ws = workbook.Sheets[sheetName];
      if (!ws) return;

      const rawRows = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
      if (!rawRows || rawRows.length < 2) return;

      // Tự động nhận diện cột cho từng Sheet
      const sheetMapping = this.autoDetectColumns(rawRows, 'price');

      // Nếu người dùng đã chỉ định mapping từ giao diện và sheet mapping thiếu cột giá thì kế thừa
      if (baseMapping) {
        if (sheetMapping.nameCol === undefined && baseMapping.nameCol !== undefined) {
          sheetMapping.nameCol = baseMapping.nameCol;
        }
        if (sheetMapping.unitCol === undefined && baseMapping.unitCol !== undefined) {
          sheetMapping.unitCol = baseMapping.unitCol;
        }
        if (sheetMapping.materialPriceCol === undefined && baseMapping.materialPriceCol !== undefined) {
          sheetMapping.materialPriceCol = baseMapping.materialPriceCol;
        }
        if (sheetMapping.laborPriceCol === undefined && baseMapping.laborPriceCol !== undefined) {
          sheetMapping.laborPriceCol = baseMapping.laborPriceCol;
        }
      }

      // Xác định tên phân hệ chuẩn
      const lowerSheet = sheetName.trim().toLowerCase();
      const standardSystem = systemNameMap[lowerSheet] || `Hệ ${sheetName}`;

      const sheetMats = this.parsePriceLibrary(rawRows, sheetMapping, standardSystem);
      sheetMats.forEach(m => {
        if (defaultSupplier && !m.supplier) m.supplier = defaultSupplier;
        allMaterials.push(m);
      });
    });

    return allMaterials;
  }

  /**
   * Chuyển đổi dữ liệu thô sang danh sách BOQ
   */
  parseBOQ(rawRows, mapping) {
    const startRow = mapping.dataStartRowIndex || 1;
    const boqItems = [];

    for (let i = startRow; i < rawRows.length; i++) {
      const row = rawRows[i];
      if (!row || row.length === 0) continue;

      const desc = (row[mapping.nameCol] || '').toString().trim();
      const stt = mapping.sttCol !== undefined ? (row[mapping.sttCol] || '').toString().trim() : '';
      const code = mapping.codeCol !== undefined ? (row[mapping.codeCol] || '').toString().trim() : '';
      const unit = mapping.unitCol !== undefined ? (row[mapping.unitCol] || '').toString().trim() : '';
      const qty = mapping.quantityCol !== undefined ? this.cleanNumber(row[mapping.quantityCol]) : 0;

      if (!desc && !stt && qty === 0) continue;

      // Phán đoán dòng tiêu đề phân mục (không có khối lượng, thường in hoa hoặc chỉ có STT la mã)
      const isHeader = !qty && (
        !unit ||
        desc === desc.toUpperCase() ||
        stt.match(/^[IVXLCDM]+$/i) ||
        stt.match(/^[A-Z]$/) ||
        desc.toLowerCase().startsWith('phần') ||
        desc.toLowerCase().startsWith('hạng mục') ||
        desc.toLowerCase().startsWith('hệ thống')
      );

      const existingMatPrice = mapping.materialPriceCol !== undefined ? this.cleanNumber(row[mapping.materialPriceCol]) : 0;
      const existingLabPrice = mapping.laborPriceCol !== undefined ? this.cleanNumber(row[mapping.laborPriceCol]) : 0;

      boqItems.push({
        id: 'boq-' + i,
        rowIndex: i,
        stt: stt || (isHeader ? '' : (boqItems.length + 1).toString()),
        code: code,
        description: desc,
        unit: unit,
        quantity: qty,
        materialPrice: existingMatPrice,
        laborPrice: existingLabPrice,
        materialTotal: qty * existingMatPrice,
        laborTotal: qty * existingLabPrice,
        grandTotal: (qty * existingMatPrice) + (qty * existingLabPrice),
        isHeader: isHeader,
        matchScore: existingMatPrice > 0 ? 100 : 0,
        matchType: existingMatPrice > 0 ? 'exact' : 'none',
        matchedMaterial: null,
        suggestions: []
      });
    }

    return boqItems;
  }

  /**
   * Alias tương thích ngược
   */
  extractBOQFromRows(rawRows, mapping) {
    return this.parseBOQ(rawRows, mapping);
  }

  extractMaterialsFromRows(rawRows, mapping) {
    return this.parsePriceLibrary(rawRows, mapping);
  }

  /**
   * Làm sạch và ép kiểu số từ dữ liệu chuỗi có dấu phân cách
   */
  cleanNumber(val) {
    if (val === null || val === undefined || val === '') return 0;
    if (typeof val === 'number') return isNaN(val) ? 0 : val;

    let s = val.toString().trim();
    s = s.replace(/[^0-9.,-]/g, '');

    // Chuẩn hóa định dạng số Việt Nam (1.000.000,50) hoặc Quốc tế (1,000,000.50)
    if (s.includes('.') && s.includes(',')) {
      if (s.lastIndexOf(',') > s.lastIndexOf('.')) {
        s = s.replace(/\./g, '').replace(',', '.');
      } else {
        s = s.replace(/,/g, '');
      }
    } else if (s.includes('.')) {
      const parts = s.split('.');
      if (parts.length > 2 || parts[parts.length - 1].length === 3) {
        s = s.replace(/\./g, '');
      }
    } else if (s.includes(',')) {
      const parts = s.split(',');
      if (parts.length > 2 || parts[parts.length - 1].length === 3) {
        s = s.replace(/,/g, '');
      } else {
        s = s.replace(',', '.');
      }
    }

    const n = parseFloat(s);
    return isNaN(n) ? 0 : n;
  }

  /**
   * Xuất file kết quả hoàn chỉnh:
   * Nếu có BOQ gốc tải lên -> Giữ nguyên 100% định dạng, merge cell, fonts, column widths
   * Nếu là BOQ Demo -> Tạo file chuẩn hồ sơ dự toán cơ điện trang trọng
   */
  async exportToExcel(boqItems, sourceWorkbook, sourceSheetName, mapping, projectName = 'Du_Toan_MEP') {
    if (window.ExcelJS && this.boqFileBuffer) {
      // Ưu tiên cao nhất: Sử dụng ExcelJS để giữ 100% format BOQ gốc
      return await this._exportWithExcelJS(boqItems, sourceSheetName, mapping, projectName);
    } else if (window.ExcelJS) {
      // Dùng ExcelJS để tạo file BOQ Demo chuyên nghiệp
      return await this._exportStandardMEPWithExcelJS(boqItems, projectName);
    } else {
      // Fallback sang SheetJS nếu ExcelJS chưa kịp tải
      return this._fallbackExportSheetJS(boqItems, sourceWorkbook, sourceSheetName, mapping, projectName);
    }
  }

  /**
   * Động cơ xuất ExcelJS: Giữ 100% form BOQ gốc, tự động căn lề và tô màu cảnh báo
   */
  async _exportWithExcelJS(boqItems, sourceSheetName, mapping, projectName) {
    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(this.boqFileBuffer);

    let worksheet = sourceSheetName ? workbook.getWorksheet(sourceSheetName) : null;
    if (!worksheet) {
      worksheet = workbook.worksheets[0];
    }
    if (!worksheet) {
      throw new Error('Không tìm thấy trang tính (Worksheet) trong tệp Excel!');
    }

    const headerRowIdx = mapping && mapping.headerRowIndex !== undefined ? mapping.headerRowIndex + 1 : 1; // 1-indexed trong ExcelJS
    const headerRow = worksheet.getRow(headerRowIdx);

    // Xác định các cột tương ứng (chuyển sang 1-indexed của ExcelJS)
    let matPriceCol = mapping && mapping.materialPriceCol !== undefined ? mapping.materialPriceCol + 1 : null;
    let laborPriceCol = mapping && mapping.laborPriceCol !== undefined ? mapping.laborPriceCol + 1 : null;
    let matTotalCol = mapping && mapping.materialTotalCol !== undefined ? mapping.materialTotalCol + 1 : null;
    let laborTotalCol = mapping && mapping.laborTotalCol !== undefined ? mapping.laborTotalCol + 1 : null;
    let grandTotalCol = mapping && mapping.grandTotalCol !== undefined ? mapping.grandTotalCol + 1 : null;

    let maxCol = worksheet.columnCount || 10;

    // Bổ sung các cột tính toán nếu trong form gốc chưa có
    if (!matPriceCol) {
      maxCol++;
      matPriceCol = maxCol;
      this._styleHeaderCell(headerRow.getCell(matPriceCol), 'Đơn Giá Vật Tư (VNĐ)');
    }
    if (!laborPriceCol) {
      maxCol++;
      laborPriceCol = maxCol;
      this._styleHeaderCell(headerRow.getCell(laborPriceCol), 'Đơn Giá Nhân Công (VNĐ)');
    }
    if (!matTotalCol) {
      maxCol++;
      matTotalCol = maxCol;
      this._styleHeaderCell(headerRow.getCell(matTotalCol), 'Thành Tiền Vật Tư (VNĐ)');
    }
    if (!laborTotalCol) {
      maxCol++;
      laborTotalCol = maxCol;
      this._styleHeaderCell(headerRow.getCell(laborTotalCol), 'Thành Tiền Nhân Công (VNĐ)');
    }
    if (!grandTotalCol) {
      maxCol++;
      grandTotalCol = maxCol;
      this._styleHeaderCell(headerRow.getCell(grandTotalCol), 'Tổng Thành Tiền (VNĐ)');
    }

    // Luôn bổ sung cột % Độ Khớp và Trạng Thái Áp Giá
    maxCol++;
    const scoreCol = maxCol;
    this._styleHeaderCell(headerRow.getCell(scoreCol), 'Độ Khớp (%)');

    maxCol++;
    const statusCol = maxCol;
    this._styleHeaderCell(headerRow.getCell(statusCol), 'Trạng Thái & Phê Duyệt');

    headerRow.commit();

    const qtyColIdx = mapping && mapping.quantityCol !== undefined ? mapping.quantityCol + 1 : 5;
    const sttColIdx = mapping && mapping.sttCol !== undefined ? mapping.sttCol + 1 : 1;
    const unitColIdx = mapping && mapping.unitCol !== undefined ? mapping.unitCol + 1 : 4;
    const descColIdx = mapping && mapping.nameCol !== undefined ? mapping.nameCol + 1 : 3;

    // Chuyển đổi chỉ số cột sang chữ cái (A, B, C...) để tạo công thức Excel
    const qtyColLetter = this._getColLetter(qtyColIdx);
    const mpColLetter = this._getColLetter(matPriceCol);
    const lpColLetter = this._getColLetter(laborPriceCol);
    const mtColLetter = this._getColLetter(matTotalCol);
    const ltColLetter = this._getColLetter(laborTotalCol);

    // Cấu hình màu sắc cảnh báo theo đúng yêu cầu kỹ sư dự toán:
    // 1. Dòng có độ khớp thấp (< 70%) hoặc thiếu giá
    const fillLowMatchRow = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFF1F2' } // Nền hồng cam dịu cho cả dòng
    };

    // 2. Ô DỮ LIỆU ĐỘ KHỚP THẤP & TRẠNG THÁI (< 70%): Nền đỏ hồng cảnh báo rõ nét
    const fillLowMatchCell = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFD2D6' }
    };

    const fontAlertRed = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFB91C1C' }
    };

    // 3. Ô DỮ LIỆU ĐƠN GIÁ BỊ THIẾU (bằng 0 hoặc chưa có giá)
    const fillMissingPriceCell = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFFFE4E6' }
    };

    const fontMissingPrice = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FFDC2626' }
    };

    // 4. Ô dữ liệu Độ Khớp cao (>= 70% Chuẩn / Ghi nhớ)
    const fillHighMatchCell = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFD1FAE5' }
    };

    const fontHighMatch = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FF065F46' }
    };

    // 5. Dòng & Ô dữ liệu do AI 3.8 Flash nội suy
    const fillAIRow = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFF5F3FF' }
    };

    const fillAICell = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFE9D5FF' }
    };

    const fontAI = {
      name: 'Segoe UI',
      size: 10,
      bold: true,
      color: { argb: 'FF6B21A8' }
    };

    // Duyệt qua từng mục dữ liệu và ghi vào worksheet
    boqItems.forEach((item) => {
      if (item.rowIndex === undefined || item.rowIndex === null) return;
      const r = item.rowIndex + 1; // 1-indexed trong ExcelJS
      const row = worksheet.getRow(r);

      if (item.isHeader) {
        // Dòng tiêu đề phân mục -> Giữ nguyên form gốc
        return;
      }

      const isLowMatch = (item.matchScore < 70 || !item.matchScore || (item.materialPrice === 0 && item.laborPrice === 0));
      const isAIRow = item.matchType === 'ai';

      // 1. Căn chỉnh các cột cơ bản theo chuẩn kỹ sư dự toán
      const sttCell = row.getCell(sttColIdx);
      if (sttCell.value !== null && sttCell.value !== undefined) {
        sttCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      const unitCell = row.getCell(unitColIdx);
      if (unitCell.value !== null && unitCell.value !== undefined) {
        unitCell.alignment = { horizontal: 'center', vertical: 'middle' };
      }

      const descCell = row.getCell(descColIdx);
      if (descCell.value !== null && descCell.value !== undefined) {
        descCell.alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
      }

      // 2. Ghi Đơn giá Vật tư
      const matPriceCell = row.getCell(matPriceCol);
      matPriceCell.value = Number(item.materialPrice) || 0;
      matPriceCell.numFmt = '#,##0';
      matPriceCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // 3. Ghi Đơn giá Nhân công
      const laborPriceCell = row.getCell(laborPriceCol);
      laborPriceCell.value = Number(item.laborPrice) || 0;
      laborPriceCell.numFmt = '#,##0';
      laborPriceCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // 4. Ghi Thành tiền Vật tư (Kèm công thức Excel = Số lượng * Đơn giá VT)
      const matTotalCell = row.getCell(matTotalCol);
      matTotalCell.value = {
        formula: `${qtyColLetter}${r}*${mpColLetter}${r}`,
        result: (Number(item.quantity) || 0) * (Number(item.materialPrice) || 0)
      };
      matTotalCell.numFmt = '#,##0';
      matTotalCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // 5. Ghi Thành tiền Nhân công (Kèm công thức Excel = Số lượng * Đơn giá NC)
      const laborTotalCell = row.getCell(laborTotalCol);
      laborTotalCell.value = {
        formula: `${qtyColLetter}${r}*${lpColLetter}${r}`,
        result: (Number(item.quantity) || 0) * (Number(item.laborPrice) || 0)
      };
      laborTotalCell.numFmt = '#,##0';
      laborTotalCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // 6. Ghi Tổng thành tiền (Kèm công thức Excel = Tiền VT + Tiền NC)
      const grandTotalCell = row.getCell(grandTotalCol);
      grandTotalCell.value = {
        formula: `${mtColLetter}${r}+${ltColLetter}${r}`,
        result: Number(item.grandTotal) || 0
      };
      grandTotalCell.numFmt = '#,##0';
      grandTotalCell.font = { bold: true };
      grandTotalCell.alignment = { horizontal: 'right', vertical: 'middle' };

      // 7. Cột % Độ Khớp
      const scoreCell = row.getCell(scoreCol);
      scoreCell.value = item.matchScore ? `${item.matchScore}%` : '0%';
      scoreCell.alignment = { horizontal: 'center', vertical: 'middle' };

      // 8. Cột Trạng thái / Cảnh báo
      const statusCell = row.getCell(statusCol);
      let statusText = 'Chưa có giá';
      if (item.matchType === 'exact') statusText = '✅ Khớp chuẩn 100%';
      else if (item.matchType === 'memory') statusText = '✅ Bộ nhớ tự động (100%)';
      else if (item.matchType === 'ai') statusText = `🤖 AI 3.8 Flash (${item.matchScore}%)`;
      else if (item.matchType === 'manual') statusText = '✍️ Kỹ sư nhập tay';
      else if (item.matchScore >= 70) statusText = `⚡ Khớp mờ (${item.matchScore}%)`;
      else statusText = `⚠️ KHỚP THẤP (<70%): ${item.matchScore || 0}% - CẦN RÀ SOÁT`;

      statusCell.value = statusText;
      statusCell.alignment = { horizontal: 'left', vertical: 'middle' };

      // 9. TÔ MÀU Ô DỮ LIỆU CẢNH BÁO TRỰC TIẾP TRÊN FILE EXCEL:
      if (isLowMatch) {
        // Tô nền hồng dịu cảnh báo cho toàn bộ các ô của dòng
        for (let c = 1; c <= maxCol; c++) {
          row.getCell(c).fill = fillLowMatchRow;
        }

        // TÔ MÀU ĐẶC BIỆT NỔI BẬT CHO CÁC Ô DỮ LIỆU CỤ THỂ CÓ ĐỘ KHỚP THẤP:
        // Ô cột % Độ Khớp
        scoreCell.fill = fillLowMatchCell;
        scoreCell.font = fontAlertRed;

        // Ô cột Trạng Thái & Cảnh Báo
        statusCell.fill = fillLowMatchCell;
        statusCell.font = fontAlertRed;

        // Ô cột Đơn giá Vật tư nếu thiếu hoặc bằng 0
        if (!item.materialPrice || item.materialPrice === 0) {
          matPriceCell.fill = fillMissingPriceCell;
          matPriceCell.font = fontMissingPrice;
        }

        // Ô cột Đơn giá Nhân công nếu thiếu hoặc bằng 0
        if (!item.laborPrice || item.laborPrice === 0) {
          laborPriceCell.fill = fillMissingPriceCell;
          laborPriceCell.font = fontMissingPrice;
        }
      } else if (isAIRow) {
        // Tô nền tím nhạt cho cả dòng do AI 3.8 Flash nội suy
        for (let c = 1; c <= maxCol; c++) {
          row.getCell(c).fill = fillAIRow;
        }
        // Nổi bật ô dữ liệu Độ khớp và Trạng thái AI
        scoreCell.fill = fillAICell;
        scoreCell.font = fontAI;
        statusCell.fill = fillAICell;
        statusCell.font = fontAI;
      } else {
        // Độ khớp cao (>= 70%): Nổi bật màu xanh thành công tại ô Độ Khớp & Trạng Thái
        scoreCell.fill = fillHighMatchCell;
        scoreCell.font = fontHighMatch;
        statusCell.fill = fillHighMatchCell;
        statusCell.font = fontHighMatch;
      }

      row.commit();
    });

    // Xuất file tải về máy
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `${projectName}_ApGia_ChuanForm_${dateStr}.xlsx`;
    await this._downloadWorkbook(workbook, fileName);
    return fileName;
  }

  /**
   * Xuất file định dạng chuẩn hồ sơ dự toán cơ điện bằng ExcelJS (khi dùng BOQ Demo)
   */
  async _exportStandardMEPWithExcelJS(boqItems, projectName) {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'MEP Auto-Pricing System';
    workbook.created = new Date();

    const worksheet = workbook.addWorksheet('BOQ_DuToan_ApGia', {
      views: [{ showGridLines: true }]
    });

    // 1. Cấu hình độ rộng các cột
    worksheet.columns = [
      { width: 7 },   // STT
      { width: 14 },  // Mã hiệu
      { width: 45 },  // Tên công việc / Diễn giải
      { width: 9 },   // ĐVT
      { width: 13 },  // Khối lượng
      { width: 20 },  // Đơn giá VT
      { width: 20 },  // Đơn giá NC
      { width: 22 },  // Thành tiền VT
      { width: 22 },  // Thành tiền NC
      { width: 24 },  // Tổng thành tiền
      { width: 14 },  // % Độ khớp
      { width: 28 }   // Trạng thái & Phê duyệt
    ];

    // 2. Tiêu đề dự án phía trên
    const headerTitles = [
      'DỰ ÁN: TÒA NHÀ TRUNG TÂM THƯƠNG MẠI & VĂN PHÒNG MEP COMPLEX',
      'GÓI THẦU: HỆ THỐNG CƠ ĐIỆN TOÀN CÔNG TRÌNH (ĐIỆN - CẤP THOÁT NƯỚC - HVAC)',
      'BẢNG TIÊN LƯỢNG KHỐI LƯỢNG VÀ ÁP ĐƠN GIÁ DỰ TOÁN CHI TIẾT',
      'Ngày lập: ' + new Date().toLocaleDateString('vi-VN') + ' | Bộ phận: Kỹ sư Dự toán Cơ Điện (MEP QS)'
    ];

    headerTitles.forEach((title, idx) => {
      const row = worksheet.addRow([title]);
      worksheet.mergeCells(`A${idx + 1}:L${idx + 1}`);
      row.getCell(1).font = { name: 'Segoe UI', size: idx === 2 ? 13 : 11, bold: true, color: { argb: idx === 2 ? 'FF1E3A8A' : 'FF334155' } };
      row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
      row.height = 24;
    });

    worksheet.addRow([]); // Dòng trống cách ly

    // 3. Dòng Header của bảng (Dòng 6)
    const tableHeaders = [
      'STT',
      'Mã Hiệu',
      'Nội Dung Công Việc / Diễn Giải Vật Tư',
      'ĐVT',
      'Khối Lượng',
      'Đơn Giá Vật Tư (VNĐ)',
      'Đơn Giá Nhân Công (VNĐ)',
      'Thành Tiền Vật Tư (VNĐ)',
      'Thành Tiền Nhân Công (VNĐ)',
      'Tổng Thành Tiền (VNĐ)',
      'Độ Khớp (%)',
      'Trạng Thái & Phê Duyệt'
    ];

    const hRow = worksheet.addRow(tableHeaders);
    hRow.height = 30;
    hRow.eachCell((cell) => {
      cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
      cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
      cell.border = {
        top: { style: 'thin', color: { argb: 'FF64748B' } },
        left: { style: 'thin', color: { argb: 'FF64748B' } },
        bottom: { style: 'medium', color: { argb: 'FF0F172A' } },
        right: { style: 'thin', color: { argb: 'FF64748B' } }
      };
    });

    const startDataRow = 7;
    const thinBorder = {
      top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
      right: { style: 'thin', color: { argb: 'FFE2E8F0' } }
    };

    const fillWarning = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF2CC' } };
    const fillAI = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF3E8FF' } };

    // 4. Điền từng dòng dữ liệu BOQ
    boqItems.forEach((item, idx) => {
      const curRowIdx = startDataRow + idx;

      if (item.isHeader) {
        const row = worksheet.addRow([
          item.stt || '',
          item.code || '',
          item.description || '',
          '', '', '', '', '', '', '', '', 'TIÊU ĐỀ PHÂN MỤC'
        ]);
        row.height = 24;
        row.getCell(3).font = { name: 'Segoe UI', bold: true, color: { argb: 'FF0F172A' } };
        row.eachCell(cell => {
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F5F9' } };
          cell.border = thinBorder;
        });
      } else {
        const isLowMatch = (item.matchScore < 70 || !item.matchScore || (item.materialPrice === 0 && item.laborPrice === 0));
        const isAIRow = item.matchType === 'ai';

        let statusText = 'Chưa có giá';
        if (item.matchType === 'exact') statusText = '✅ Khớp chuẩn 100%';
        else if (item.matchType === 'memory') statusText = '✅ Bộ nhớ tự động (100%)';
        else if (item.matchType === 'ai') statusText = `🤖 AI 3.8 Flash (${item.matchScore}%)`;
        else if (item.matchType === 'manual') statusText = '✍️ Kỹ sư nhập tay';
        else if (item.matchScore >= 70) statusText = `⚡ Khớp mờ (${item.matchScore}%)`;
        else statusText = `⚠️ KHỚP THẤP (<70%): ${item.matchScore || 0}% - CẦN RÀ SOÁT`;

        const row = worksheet.addRow([
          item.stt || (idx + 1).toString(),
          item.code || '',
          item.description || '',
          item.unit || '',
          item.quantity || 0,
          item.materialPrice || 0,
          item.laborPrice || 0,
          { formula: `E${curRowIdx}*F${curRowIdx}`, result: (item.quantity || 0) * (item.materialPrice || 0) },
          { formula: `E${curRowIdx}*G${curRowIdx}`, result: (item.quantity || 0) * (item.laborPrice || 0) },
          { formula: `H${curRowIdx}+I${curRowIdx}`, result: item.grandTotal || 0 },
          item.matchScore ? `${item.matchScore}%` : '0%',
          statusText
        ]);

        row.height = 22;

        // Căn chỉnh ô
        row.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(2).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(3).alignment = { horizontal: 'left', vertical: 'middle', wrapText: true };
        row.getCell(4).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(5).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(6).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(7).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(8).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(9).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(10).alignment = { horizontal: 'right', vertical: 'middle' };
        row.getCell(11).alignment = { horizontal: 'center', vertical: 'middle' };
        row.getCell(12).alignment = { horizontal: 'left', vertical: 'middle' };

        // Định dạng số #,##0
        row.getCell(5).numFmt = '#,##0';
        row.getCell(6).numFmt = '#,##0';
        row.getCell(7).numFmt = '#,##0';
        row.getCell(8).numFmt = '#,##0';
        row.getCell(9).numFmt = '#,##0';
        row.getCell(10).numFmt = '#,##0';
        row.getCell(10).font = { bold: true };

        row.eachCell(cell => {
          cell.border = thinBorder;
          if (isLowMatch) {
            cell.fill = fillLowMatchRow;
          } else if (isAIRow) {
            cell.fill = fillAIRow;
          }
        });

        // Tô màu trực tiếp cho các ô dữ liệu có độ khớp thấp
        if (isLowMatch) {
          const scCell = row.getCell(11); // Cột % Khớp
          scCell.fill = fillLowMatchCell;
          scCell.font = fontAlertRed;

          const stCell = row.getCell(12); // Cột Trạng thái
          stCell.fill = fillLowMatchCell;
          stCell.font = fontAlertRed;

          if (!item.materialPrice || item.materialPrice === 0) {
            row.getCell(6).fill = fillMissingPriceCell; // Đơn giá VT
            row.getCell(6).font = fontMissingPrice;
          }
          if (!item.laborPrice || item.laborPrice === 0) {
            row.getCell(7).fill = fillMissingPriceCell; // Đơn giá NC
            row.getCell(7).font = fontMissingPrice;
          }
        } else if (isAIRow) {
          row.getCell(11).fill = fillAICell;
          row.getCell(11).font = fontAI;
          row.getCell(12).fill = fillAICell;
          row.getCell(12).font = fontAI;
        } else {
          row.getCell(11).fill = fillHighMatchCell;
          row.getCell(11).font = fontHighMatch;
          row.getCell(12).fill = fillHighMatchCell;
          row.getCell(12).font = fontHighMatch;
        }
      }
    });

    // 5. Dòng TỔNG CỘNG TOÀN BẢNG DỰ TOÁN
    const lastDataRow = startDataRow + boqItems.length - 1;
    const totalRow = worksheet.addRow([
      '', '', 'TỔNG CỘNG TOÀN BỘ CHI PHÍ TRƯỚC THUẾ (VNĐ)', '', '', '', '',
      { formula: `SUM(H${startDataRow}:H${lastDataRow})` },
      { formula: `SUM(I${startDataRow}:I${lastDataRow})` },
      { formula: `SUM(J${startDataRow}:J${lastDataRow})` },
      '', ''
    ]);

    totalRow.height = 28;
    totalRow.getCell(3).font = { name: 'Segoe UI', bold: true, size: 11, color: { argb: 'FFB91C1C' } };
    totalRow.getCell(8).numFmt = '#,##0';
    totalRow.getCell(9).numFmt = '#,##0';
    totalRow.getCell(10).numFmt = '#,##0';
    totalRow.getCell(8).font = { bold: true };
    totalRow.getCell(9).font = { bold: true };
    totalRow.getCell(10).font = { bold: true, size: 11, color: { argb: 'FFB91C1C' } };

    totalRow.eachCell(cell => {
      cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFEF3C7' } };
      cell.border = {
        top: { style: 'medium', color: { argb: 'FFD97706' } },
        bottom: { style: 'double', color: { argb: 'FFD97706' } }
      };
    });

    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const fileName = `${projectName}_StandardForm_${dateStr}.xlsx`;
    await this._downloadWorkbook(workbook, fileName);
    return fileName;
  }

  _styleHeaderCell(cell, text) {
    cell.value = text;
    cell.font = { name: 'Segoe UI', size: 10, bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E293B' } };
    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
  }

  _getColLetter(colIdx) {
    let temp = colIdx;
    let letter = '';
    while (temp > 0) {
      const mod = (temp - 1) % 26;
      letter = String.fromCharCode(65 + mod) + letter;
      temp = Math.floor((temp - mod) / 26);
    }
    return letter;
  }

  async _downloadWorkbook(workbook, fileName) {
    const buffer = await workbook.xlsx.writeBuffer();
    const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.URL.revokeObjectURL(url);
  }

  /**
   * Fallback SheetJS dự phòng
   */
  _fallbackExportSheetJS(boqItems, sourceWorkbook, sourceSheetName, mapping, projectName) {
    const workbook = XLSX.utils.book_new();
    const rows = [
      ['STT', 'Mã Hiệu', 'Nội Dung', 'ĐVT', 'Khối Lượng', 'Đơn Giá VT', 'Đơn Giá NC', 'Thành Tiền VT', 'Thành Tiền NC', 'Tổng Tiền', 'Độ Khớp', 'Trạng Thái']
    ];
    boqItems.forEach(i => {
      rows.push([
        i.stt, i.code, i.description, i.unit, i.quantity, i.materialPrice, i.laborPrice,
        (i.quantity * i.materialPrice), (i.quantity * i.laborPrice), i.grandTotal,
        `${i.matchScore}%`, i.matchType
      ]);
    });
    const ws = XLSX.utils.aoa_to_sheet(rows);
    XLSX.utils.book_append_sheet(workbook, ws, 'BOQ');
    const fileName = `${projectName}_SheetJS.xlsx`;
    XLSX.writeFile(workbook, fileName);
    return fileName;
  }
}

// Khởi tạo đối tượng xử lý Excel dùng chung
window.excelProcessor = new ExcelProcessor();
