/**
 * Bộ Điều Khiển Trung Tâm Toàn Hệ Thống (Main Application Controller)
 * Quản lý trạng thái giao diện, tương tác người dùng, tích hợp dữ liệu,
 * thuật toán khớp mờ và trí tuệ nhân tạo Gemini AI.
 */

class AppController {
  constructor() {
    this.currentBOQItems = [];
    this.currentMaterials = [];
    this.currentMemory = [];
    this.settings = {};
    this.filterOnlyUnpriced = false;
    this.filterOnlyLowMatch = false;

    // Lưu trữ workbook gốc để xuất file Excel giữ nguyên 100% form BOQ
    this.boqSourceWorkbook = null;
    this.boqSourceSheetName = null;
    this.boqMapping = null;

    // Trạng thái modal ánh xạ cột
    this.pendingExcelImport = {
      type: null, // 'boq' | 'price'
      rawRows: [],
      sheetNames: [],
      activeSheet: ''
    };

    // Trạng thái modal đề xuất AI hiện tại
    this.activeAIPendingRowIndex = null;
    this.activeAIPendingData = null;

    // Trạng thái chạy AI hàng loạt (Batch AI)
    this.isAIBatchRunning = false;
    this.isAIBatchCancelled = false;
  }

  /**
   * Khởi chạy ứng dụng khi DOM sẵn sàng
   */
  async init() {
    console.log('Khởi chạy Hệ thống Áp giá Tự động Cơ Điện...');

    // 1. Khởi tạo CSDL
    await window.dbManager.init();

    // 2. Tải cấu hình
    this.settings = await window.dbManager.getSettings();
    this.applyTheme(this.settings.theme || 'dark');
    this.bindSettingsForm();

    // 3. Tải danh sách file bảng giá và vật tư
    this.currentCatalogs = await window.dbManager.getAllCatalogs();
    this.currentMaterials = await window.dbManager.getAllMaterials();

    if (this.currentMaterials.length === 0 && window.DEFAULT_MEP_MATERIALS) {
      console.log('Nạp dữ liệu mẫu ban đầu...');
      const initCat = await window.dbManager.addCatalog({
        fileName: 'Bang_Gia_Chuan_MEP.xlsx',
        displayName: 'Bảng Giá Chuẩn MEP (Mẫu Hệ Thống)',
        itemCount: window.DEFAULT_MEP_MATERIALS.length,
        uploadedAt: new Date().toISOString(),
        priority: 1,
        isActive: true
      });
      await window.dbManager.bulkAddMaterials(window.DEFAULT_MEP_MATERIALS, initCat.id);
      this.currentCatalogs = await window.dbManager.getAllCatalogs();
      this.currentMaterials = await window.dbManager.getAllMaterials();
      this.showToast('Đã nạp sẵn bộ dữ liệu mẫu cơ điện chuẩn (Điện, Nước, HVAC)!', 'success');
    }

    this.currentMemory = await window.dbManager.getAllMemory();

    // 4. Đăng ký các sự kiện giao diện (Event Listeners)
    this.bindEvents();

    // 5. Cập nhật Dashboard & danh sách bảng giá
    this.renderCatalogFilterOptions();
    this.updateWorkspaceCatalogStatus();
    this.updateDashboardStats();
    this.renderLibraryTable();
    this.renderMemoryTable();

    // 6. Tải sẵn dữ liệu BOQ Demo để người dùng trải nghiệm ngay
    this.loadDemoBOQ();
  }

  // ==========================================
  // GẮN SỰ KIỆN GIAO DIỆN (EVENT BINDING)
  // ==========================================

  bindEvents() {
    // 1. Chuyển đổi Tab điều hướng
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        const tabId = btn.getAttribute('data-tab');
        this.switchTab(tabId);
      });
    });

    // 2. Chuyển đổi giao diện Sáng / Tối
    const btnTheme = document.getElementById('btn-toggle-theme');
    if (btnTheme) {
      btnTheme.addEventListener('click', () => {
        const isDark = document.body.classList.contains('dark-theme');
        const newTheme = isDark ? 'light' : 'dark';
        this.applyTheme(newTheme);
        this.settings.theme = newTheme;
        window.dbManager.saveSettings(this.settings);
      });
    }

    // 3. Các nút tại Dashboard
    const btnDashStart = document.getElementById('btn-dash-start');
    if (btnDashStart) btnDashStart.addEventListener('click', () => this.switchTab('tab-workspace'));

    const btnQuickPricing = document.getElementById('btn-quick-pricing');
    if (btnQuickPricing) btnQuickPricing.addEventListener('click', () => this.switchTab('tab-workspace'));

    const btnQuickImport = document.getElementById('btn-quick-import-price');
    if (btnQuickImport) btnQuickImport.addEventListener('click', () => this.switchTab('tab-library'));

    const btnQuickSettings = document.getElementById('btn-quick-settings');
    if (btnQuickSettings) btnQuickSettings.addEventListener('click', () => this.switchTab('tab-settings'));

    const btnDashSeed = document.getElementById('btn-dash-seed-data');
    if (btnDashSeed) {
      btnDashSeed.addEventListener('click', async () => {
        if (confirm('Bạn có chắc chắn muốn nạp lại bộ dữ liệu mẫu chuẩn ngành Cơ Điện?')) {
          await window.dbManager.clearMaterials();
          await window.dbManager.bulkAddMaterials(window.DEFAULT_MEP_MATERIALS);
          this.currentMaterials = await window.dbManager.getAllMaterials();
          this.updateDashboardStats();
          this.renderLibraryTable();
          this.showToast('Đã nạp lại thành công danh mục vật tư mẫu!', 'success');
        }
      });
    }

    const btnDownloadSamples = document.getElementById('btn-dash-download-samples');
    if (btnDownloadSamples) {
      btnDownloadSamples.addEventListener('click', () => this.downloadSampleExcelFiles());
    }

    // 4. Các nút tại Workspace Áp Giá
    const btnOpenBOQ = document.getElementById('btn-open-boq');
    const inputBOQ = document.getElementById('input-boq-file');
    if (btnOpenBOQ && inputBOQ) {
      btnOpenBOQ.addEventListener('click', () => inputBOQ.click());
      inputBOQ.addEventListener('change', (e) => this.handleExcelUpload(e, 'boq'));
    }

    const btnLoadDemoBOQ = document.getElementById('btn-load-demo-boq');
    if (btnLoadDemoBOQ) {
      btnLoadDemoBOQ.addEventListener('click', () => {
        this.loadDemoBOQ();
        this.showToast('Đã tải bảng khối lượng BOQ mẫu công trình!', 'info');
      });
    }

    const btnRunAuto = document.getElementById('btn-run-auto-pricing');
    if (btnRunAuto) {
      btnRunAuto.addEventListener('click', () => this.runAutoPricing());
    }

    const btnFilterUnpriced = document.getElementById('btn-filter-unpriced');
    if (btnFilterUnpriced) {
      btnFilterUnpriced.addEventListener('click', () => {
        this.filterOnlyUnpriced = !this.filterOnlyUnpriced;
        const textSpan = document.getElementById('text-filter-unpriced');
        if (this.filterOnlyUnpriced) {
          textSpan.textContent = 'Hiện Toàn Bộ Bảng';
          btnFilterUnpriced.classList.add('btn-primary');
          btnFilterUnpriced.classList.remove('btn-secondary');
        } else {
          textSpan.textContent = 'Lọc Ô Thiếu Giá';
          btnFilterUnpriced.classList.remove('btn-primary');
          btnFilterUnpriced.classList.add('btn-secondary');
        }
        this.renderBOQTable();
      });
    }

    const btnFilterLowMatch = document.getElementById('btn-filter-low-match');
    if (btnFilterLowMatch) {
      btnFilterLowMatch.addEventListener('click', () => {
        this.filterOnlyLowMatch = !this.filterOnlyLowMatch;
        const textSpan = document.getElementById('text-filter-low-match');
        if (this.filterOnlyLowMatch) {
          textSpan.textContent = 'Hiện Toàn Bộ Bảng';
          btnFilterLowMatch.classList.add('btn-primary');
          btnFilterLowMatch.classList.remove('btn-secondary');
        } else {
          textSpan.textContent = 'Lọc Khớp < 70%';
          btnFilterLowMatch.classList.remove('btn-primary');
          btnFilterLowMatch.classList.add('btn-secondary');
        }
        this.renderBOQTable();
      });
    }

    const btnRunAIBatch = document.getElementById('btn-run-ai-batch');
    if (btnRunAIBatch) {
      btnRunAIBatch.addEventListener('click', () => this.runAIBatch());
    }

    const btnCancelAIBatch = document.getElementById('btn-cancel-ai-batch');
    if (btnCancelAIBatch) {
      btnCancelAIBatch.addEventListener('click', () => {
        this.isAIBatchCancelled = true;
        this.showToast('Đang yêu cầu dừng tiến trình AI...', 'warning');
      });
    }

    const btnApproveAllAI = document.getElementById('btn-approve-all-ai');
    if (btnApproveAllAI) {
      btnApproveAllAI.addEventListener('click', () => this.approveAllAIRows());
    }

    const btnExportExcel = document.getElementById('btn-export-excel');
    if (btnExportExcel) {
      btnExportExcel.addEventListener('click', async () => {
        if (!this.currentBOQItems || this.currentBOQItems.length === 0) {
          this.showToast('Chưa có dữ liệu BOQ để xuất file!', 'warning');
          return;
        }

        try {
          btnExportExcel.disabled = true;
          btnExportExcel.innerHTML = '<span>⏳</span> Đang xuất file...';
          this.showToast('Đang khởi tạo tệp Excel chuẩn 100% form BOQ gốc và định dạng màu sắc...', 'info');

          const fileName = await window.excelProcessor.exportToExcel(
            this.currentBOQItems,
            this.boqSourceWorkbook,
            this.boqSourceSheetName,
            this.boqMapping,
            'Du_Toan_BOQ_Co_Dien'
          );

          this.showToast(`Đã xuất thành công tệp Excel chuẩn form BOQ: ${fileName}`, 'success');
        } catch (err) {
          console.error('Lỗi khi xuất file Excel:', err);
          this.showToast('Lỗi khi xuất file Excel: ' + err.message, 'error');
        } finally {
          btnExportExcel.disabled = false;
          btnExportExcel.innerHTML = '<span>📥</span> Xuất File Excel Chuẩn Form BOQ';
        }
      });
    }

    // 5. Các nút tại Kho Bảng Giá & Quản lý File Bảng Giá
    const searchLib = document.getElementById('search-library-input');
    if (searchLib) {
      searchLib.addEventListener('input', () => this.renderLibraryTable());
    }

    const filterPriceCat = document.getElementById('filter-price-catalog');
    if (filterPriceCat) {
      filterPriceCat.addEventListener('change', () => this.renderLibraryTable());
    }

    const filterSystem = document.getElementById('filter-system');
    if (filterSystem) {
      filterSystem.addEventListener('change', () => this.renderLibraryTable());
    }

    const btnManageCatalogs = document.getElementById('btn-manage-catalogs');
    if (btnManageCatalogs) {
      btnManageCatalogs.addEventListener('click', () => this.openPriceCatalogsModal());
    }

    const btnWsManageCatalogs = document.getElementById('btn-ws-manage-catalogs');
    if (btnWsManageCatalogs) {
      btnWsManageCatalogs.addEventListener('click', () => this.openPriceCatalogsModal());
    }

    const btnImportPrice = document.getElementById('btn-import-price-excel');
    const inputPrice = document.getElementById('input-price-file');
    if (btnImportPrice && inputPrice) {
      btnImportPrice.addEventListener('click', () => inputPrice.click());
      inputPrice.addEventListener('change', (e) => this.handleExcelUpload(e, 'price'));
    }

    const btnModalImportPrice = document.getElementById('btn-modal-import-new-price');
    if (btnModalImportPrice && inputPrice) {
      btnModalImportPrice.addEventListener('click', () => {
        this.closeModal('modal-price-catalogs');
        inputPrice.click();
      });
    }

    const btnAddMat = document.getElementById('btn-add-material-modal');
    if (btnAddMat) {
      btnAddMat.addEventListener('click', () => this.openMaterialModal());
    }

    const btnClearLib = document.getElementById('btn-clear-library');
    if (btnClearLib) {
      btnClearLib.addEventListener('click', async () => {
        if (confirm('CẢNH BÁO: Bạn có chắc chắn muốn xóa toàn bộ các File Bảng Giá và toàn bộ vật tư trong kho giá không?')) {
          await window.dbManager.clearMaterials();
          this.currentCatalogs = [];
          this.currentMaterials = [];
          this.renderCatalogFilterOptions();
          this.updateWorkspaceCatalogStatus();
          this.updateDashboardStats();
          this.renderLibraryTable();
          this.showToast('Đã xóa sạch toàn bộ kho bảng giá!', 'info');
        }
      });
    }

    // 6. Các nút tại Bộ Nhớ Quy Tắc
    const btnOpenAddMemory = document.getElementById('btn-open-add-memory');
    if (btnOpenAddMemory) {
      btnOpenAddMemory.addEventListener('click', () => this.openAddMemoryModal());
    }

    const btnClearMem = document.getElementById('btn-clear-memory');
    if (btnClearMem) {
      btnClearMem.addEventListener('click', async () => {
        if (confirm('Bạn có chắc chắn muốn xóa toàn bộ bộ nhớ quy tắc ghép giá đã học?')) {
          await window.dbManager.clearMemory();
          this.currentMemory = [];
          this.updateDashboardStats();
          this.renderMemoryTable();
          this.showToast('Đã làm trống bộ nhớ quy tắc!', 'info');
        }
      });
    }

    // Modal Thêm Quy Tắc Ghép Giá Thủ Công
    const btnMemModeLib = document.getElementById('btn-mem-mode-library');
    const btnMemModeCust = document.getElementById('btn-mem-mode-custom');
    if (btnMemModeLib && btnMemModeCust) {
      btnMemModeLib.addEventListener('click', () => {
        btnMemModeLib.classList.add('active');
        btnMemModeCust.classList.remove('active');
        document.getElementById('mem-panel-library').style.display = 'block';
        document.getElementById('mem-panel-custom').style.display = 'none';
      });

      btnMemModeCust.addEventListener('click', () => {
        btnMemModeCust.classList.add('active');
        btnMemModeLib.classList.remove('active');
        document.getElementById('mem-panel-library').style.display = 'none';
        document.getElementById('mem-panel-custom').style.display = 'block';
      });
    }

    const selectMemMat = document.getElementById('mem-select-material');
    if (selectMemMat) {
      selectMemMat.addEventListener('change', () => this.onSelectMemoryMaterialChange());
    }

    const btnSaveManualMemory = document.getElementById('btn-save-manual-memory');
    if (btnSaveManualMemory) {
      btnSaveManualMemory.addEventListener('click', () => this.saveManualMemory());
    }

    // 7. Cài Đặt (Settings)
    const btnTestGemini = document.getElementById('btn-test-gemini-key');
    const inputGeminiKey = document.getElementById('setting-gemini-key');

    // Tự động lưu key ngay khi người dùng gõ hoặc dán vào ô input
    if (inputGeminiKey) {
      const syncKey = () => {
        const val = inputGeminiKey.value.trim();
        this.settings.geminiApiKey = val;
        window.dbManager.saveSettings(this.settings);
      };
      inputGeminiKey.addEventListener('input', syncKey);
      inputGeminiKey.addEventListener('change', syncKey);
    }

    if (btnTestGemini) {
      btnTestGemini.addEventListener('click', async () => {
        const key = (inputGeminiKey?.value || '').trim();
        const model = document.getElementById('setting-gemini-model').value;
        if (!key) {
          this.showToast('Vui lòng nhập API Key vào ô trước khi kiểm tra!', 'warning');
          return;
        }

        btnTestGemini.disabled = true;
        btnTestGemini.innerHTML = '<span>⏳</span> Đang kiểm tra...';
        const res = await window.geminiService.testApiKey(key, model);
        btnTestGemini.disabled = false;
        btnTestGemini.innerHTML = '<span>🔌</span> Kiểm Tra Kết Nối API';

        if (res.success) {
          // Tự động lưu luôn key khi kiểm tra kết nối thành công!
          this.settings.geminiApiKey = key;
          await window.dbManager.saveSettings(this.settings);
          this.showToast(res.message, 'success');
        } else {
          this.showToast(res.message, 'error');
        }
      });
    }

    const btnSaveSettings = document.getElementById('btn-save-gemini-settings');
    if (btnSaveSettings) {
      btnSaveSettings.addEventListener('click', async () => {
        this.settings.geminiApiKey = document.getElementById('setting-gemini-key').value.trim();
        this.settings.geminiModel = document.getElementById('setting-gemini-model').value;
        this.settings.minFuzzyThreshold = Number(document.getElementById('setting-fuzzy-threshold').value);
        this.settings.autoMatchThreshold = Number(document.getElementById('setting-auto-threshold').value);

        await window.dbManager.saveSettings(this.settings);
        this.showToast('Đã lưu cấu hình hệ thống thành công!', 'success');
      });
    }

    const sliderFuzzy = document.getElementById('setting-fuzzy-threshold');
    if (sliderFuzzy) {
      sliderFuzzy.addEventListener('input', (e) => {
        document.getElementById('val-fuzzy-threshold').textContent = `${e.target.value}%`;
      });
    }

    const sliderAuto = document.getElementById('setting-auto-threshold');
    if (sliderAuto) {
      sliderAuto.addEventListener('input', (e) => {
        document.getElementById('val-auto-threshold').textContent = `${e.target.value}%`;
      });
    }

    const btnBackup = document.getElementById('btn-backup-data');
    if (btnBackup) {
      btnBackup.addEventListener('click', async () => {
        const json = await window.dbManager.exportBackup();
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `MEP_Pricing_Backup_${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
        this.showToast('Đã tải xuống tệp sao lưu CSDL!', 'success');
      });
    }

    const btnRestore = document.getElementById('btn-restore-data');
    const inputRestore = document.getElementById('input-restore-file');
    if (btnRestore && inputRestore) {
      btnRestore.addEventListener('click', () => inputRestore.click());
      inputRestore.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = async (evt) => {
          const res = await window.dbManager.importBackup(evt.target.result);
          if (res.success) {
            this.currentCatalogs = await window.dbManager.getAllCatalogs();
            this.currentMaterials = await window.dbManager.getAllMaterials();
            this.currentMemory = await window.dbManager.getAllMemory();
            this.renderCatalogFilterOptions();
            this.updateWorkspaceCatalogStatus();
            this.updateDashboardStats();
            this.renderLibraryTable();
            this.renderMemoryTable();
            this.showToast(`Phục hồi thành công ${res.catalogCount || 0} file bảng giá, ${res.materialCount} vật tư và ${res.memoryCount} quy tắc!`, 'success');
          } else {
            this.showToast('Lỗi phục hồi tệp: ' + res.error, 'error');
          }
        };
        reader.readAsText(file);
      });
    }

    const btnToggleEye = document.getElementById('btn-toggle-key-visibility');
    if (btnToggleEye) {
      btnToggleEye.addEventListener('click', () => {
        const input = document.getElementById('setting-gemini-key');
        if (input.type === 'password') {
          input.type = 'text';
          btnToggleEye.textContent = '🔒';
        } else {
          input.type = 'password';
          btnToggleEye.textContent = '👁️';
        }
      });
    }

    // 8. Đóng tất cả các Modal khi bấm nút đóng
    document.querySelectorAll('[data-close]').forEach(btn => {
      btn.addEventListener('click', () => {
        const modalId = btn.getAttribute('data-close');
        this.closeModal(modalId);
      });
    });

    // 9. Xác nhận ánh xạ cột Excel
    const btnConfirmMap = document.getElementById('btn-confirm-mapping');
    if (btnConfirmMap) {
      btnConfirmMap.addEventListener('click', () => this.confirmExcelMapping());
    }

    // 10. Chấp nhận đề xuất của AI Gemini
    const btnAcceptAI = document.getElementById('btn-accept-ai-proposal');
    if (btnAcceptAI) {
      btnAcceptAI.addEventListener('click', () => this.confirmAIProposal());
    }

    // 11. Lưu vật tư mới / sửa vật tư
    const btnSaveMatForm = document.getElementById('btn-save-material-form');
    if (btnSaveMatForm) {
      btnSaveMatForm.addEventListener('click', () => this.saveMaterialForm());
    }
  }

  // ==========================================
  // QUẢN LÝ TAB & THEME
  // ==========================================

  switchTab(tabId) {
    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.classList.toggle('active', btn.getAttribute('data-tab') === tabId);
    });

    document.querySelectorAll('.tab-panel').forEach(panel => {
      panel.classList.toggle('active', panel.id === tabId);
    });

    if (tabId === 'tab-dashboard') this.updateDashboardStats();
    if (tabId === 'tab-library') this.renderLibraryTable();
    if (tabId === 'tab-memory') this.renderMemoryTable();
  }

  applyTheme(theme) {
    const isDark = theme === 'dark';
    document.body.classList.toggle('dark-theme', isDark);
    document.body.classList.toggle('light-theme', !isDark);
    const icon = document.getElementById('theme-icon');
    if (icon) icon.textContent = isDark ? '☀️' : '🌙';
  }

  bindSettingsForm() {
    if (this.settings.geminiApiKey) {
      document.getElementById('setting-gemini-key').value = this.settings.geminiApiKey;
    }
    if (this.settings.geminiModel) {
      document.getElementById('setting-gemini-model').value = this.settings.geminiModel;
    }
    if (this.settings.minFuzzyThreshold) {
      document.getElementById('setting-fuzzy-threshold').value = this.settings.minFuzzyThreshold;
      document.getElementById('val-fuzzy-threshold').textContent = `${this.settings.minFuzzyThreshold}%`;
    }
    if (this.settings.autoMatchThreshold) {
      document.getElementById('setting-auto-threshold').value = this.settings.autoMatchThreshold;
      document.getElementById('val-auto-threshold').textContent = `${this.settings.autoMatchThreshold}%`;
    }
  }

  // ==========================================
  // CẬP NHẬT THỐNG KÊ DASHBOARD
  // ==========================================

  updateDashboardStats() {
    document.getElementById('stat-total-materials').textContent = (this.currentMaterials || []).length.toLocaleString('vi-VN');
    const catEl = document.getElementById('stat-total-catalogs');
    if (catEl) catEl.textContent = (this.currentCatalogs || []).length;
    document.getElementById('stat-total-memory').textContent = (this.currentMemory || []).length.toLocaleString('vi-VN');

    if (this.currentBOQItems && this.currentBOQItems.length > 0) {
      const nonHeader = this.currentBOQItems.filter(i => !i.isHeader);
      const pricedCount = nonHeader.filter(i => (i.materialPrice > 0 || i.laborPrice > 0)).length;
      const rate = nonHeader.length > 0 ? Math.round((pricedCount / nonHeader.length) * 100) : 0;
      document.getElementById('stat-match-rate').textContent = `${rate}%`;

      const grandTotal = nonHeader.reduce((sum, i) => sum + (i.grandTotal || 0), 0);
      document.getElementById('stat-total-value').textContent = `${Math.round(grandTotal).toLocaleString('vi-VN')} đ`;
    } else {
      document.getElementById('stat-match-rate').textContent = '0%';
      document.getElementById('stat-total-value').textContent = '0 đ';
    }
  }

  // ==========================================
  // WORKSPACE: NẠP BOQ & ÁP GIÁ TỰ ĐỘNG
  // ==========================================

  /**
   * Tải bảng khối lượng BOQ mẫu
   */
  loadDemoBOQ() {
    this.currentBOQItems = JSON.parse(JSON.stringify(window.SAMPLE_BOQ_DEMO || []));
    // Reset thông tin workbook gốc để xuất chuẩn mẫu form MEP nếu dùng demo
    this.boqSourceWorkbook = null;
    this.boqSourceSheetName = null;
    this.boqMapping = null;

    // Tự động tính toán sơ bộ
    this.currentBOQItems.forEach(item => {
      item.materialPrice = 0;
      item.laborPrice = 0;
      item.materialTotal = 0;
      item.laborTotal = 0;
      item.grandTotal = 0;
      item.matchScore = 0;
      item.matchType = 'none';
      item.suggestions = [];
    });

    this.renderBOQTable();
    this.updateBOQSummary();
    this.updateDashboardStats();
  }

  /**
   * Chạy quy trình Áp giá Tự động toàn bộ bảng BOQ
   */
  async runAutoPricing() {
    if (!this.currentBOQItems || this.currentBOQItems.length === 0) {
      this.showToast('Vui lòng chọn hoặc tải bảng BOQ trước khi áp giá!', 'warning');
      return;
    }

    const activeMaterials = await window.dbManager.getActiveMaterialsWithPriorities();
    if (!activeMaterials || activeMaterials.length === 0) {
      this.showToast('Không có File Bảng Giá nào đang được kích hoạt! Vui lòng vào "Quản Lý File Giá" để bật ít nhất 1 file.', 'warning');
      return;
    }

    const progressWrapper = document.getElementById('pricing-progress-wrapper');
    const progressBar = document.getElementById('progress-bar-fill');
    const progressPercent = document.getElementById('progress-percent');
    const progressText = document.getElementById('progress-text');

    progressWrapper.style.display = 'block';
    progressBar.style.width = '0%';

    const minThreshold = this.settings.minFuzzyThreshold || 60;
    const autoThreshold = this.settings.autoMatchThreshold || 88;

    const total = this.currentBOQItems.length;
    let matchedCount = 0;

    for (let i = 0; i < total; i++) {
      const item = this.currentBOQItems[i];
      if (item.isHeader) continue;

      // Cập nhật thanh tiến trình
      const pct = Math.round(((i + 1) / total) * 100);
      progressBar.style.width = `${pct}%`;
      progressPercent.textContent = `${pct}%`;
      progressText.textContent = `Đang so khớp mục ${i + 1}/${total}: ${item.description.slice(0, 35)}...`;

      // 1. Kiểm tra bộ nhớ học quy tắc (Memory Cache) trước
      const memoryMatch = await window.dbManager.getMemory(item.description);
      if (memoryMatch) {
        item.materialPrice = memoryMatch.materialPrice || 0;
        item.laborPrice = memoryMatch.laborPrice || 0;
        item.matchScore = 100;
        item.matchType = 'memory';
        item.matchedMaterial = memoryMatch;
        item.suggestions = [{ material: memoryMatch, score: 100 }];
        matchedCount++;
      } else {
        // 2. Chạy thuật toán khớp mờ theo thứ tự ưu tiên các file giá đang bật
        const suggestions = window.fuzzyMatcher.findMatches(item.description, activeMaterials, 5, minThreshold);
        item.suggestions = suggestions;

        if (suggestions.length > 0) {
          const topMatch = suggestions[0];
          item.matchScore = topMatch.score;

          if (topMatch.score >= autoThreshold) {
            // Khớp độ tin cậy rất cao: Tự động gán giá
            item.materialPrice = topMatch.material.materialPrice || 0;
            item.laborPrice = topMatch.material.laborPrice || 0;
            item.matchedMaterial = topMatch.material;
            item.matchType = topMatch.score === 100 ? 'exact' : 'fuzzy';
            matchedCount++;
          } else {
            // Khớp mờ ở mức trung bình (60-87%): Gợi ý sẵn để kỹ sư kiểm tra
            item.materialPrice = topMatch.material.materialPrice || 0;
            item.laborPrice = topMatch.material.laborPrice || 0;
            item.matchedMaterial = topMatch.material;
            item.matchType = 'fuzzy';
            matchedCount++;
          }
        } else {
          // 3. TỰ ĐỘNG NỘI SUY TỪ CÁC DANH MỤC QUY CÁCH TƯƠNG TỰ TRONG CÁC FILE ĐANG BẬT
          const interp = window.geminiService.fallbackSmartInterpolate(item.description, activeMaterials);
          if (interp && interp.success && (interp.data.materialPrice > 0 || interp.data.laborPrice > 0)) {
            item.materialPrice = interp.data.materialPrice;
            item.laborPrice = interp.data.laborPrice;
            item.matchScore = interp.data.confidenceScore || 78;
            item.matchType = 'interpolated';
            item.interpolatedReason = interp.data.reasoning || 'Tự động nội suy từ danh mục quy cách tương tự trong các file giá đang bật';
            item.matchedMaterial = {
              name: interp.data.decodedName || item.description,
              spec: interp.data.spec,
              unit: interp.data.unit,
              materialPrice: interp.data.materialPrice,
              laborPrice: interp.data.laborPrice,
              supplier: 'Nội suy từ kho file giá',
              catalogFileName: 'Tự nội suy kỹ thuật'
            };
            matchedCount++;
          } else {
            // Không tìm thấy giá phù hợp
            item.matchScore = 0;
            item.matchType = 'none';
          }
        }
      }

      // 4. Tính toán thành tiền
      item.materialTotal = (item.quantity || 0) * (item.materialPrice || 0);
      item.laborTotal = (item.quantity || 0) * (item.laborPrice || 0);
      item.grandTotal = item.materialTotal + item.laborTotal;

      // Cho phép UI render mượt mà
      if (i % 5 === 0) {
        await new Promise(r => setTimeout(r, 10));
      }
    }

    progressWrapper.style.display = 'none';
    this.renderBOQTable();
    this.updateBOQSummary();
    this.updateDashboardStats();

    this.showToast(`Hoàn thành áp giá tự động cho ${matchedCount} mục công việc (Theo thứ tự ưu tiên các file giá và tự nội suy)!`, 'success');
  }

  /**
   * Render bảng tính tương tác BOQ
   */
  renderBOQTable() {
    const tbody = document.getElementById('boq-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    if (!this.currentBOQItems || this.currentBOQItems.length === 0) {
      tbody.innerHTML = `<tr><td colspan="12" style="text-align: center; padding: 40px; color: var(--text-muted);">Chưa có dữ liệu bảng BOQ. Vui lòng bấm "Chọn File Excel BOQ" hoặc "Dùng BOQ Mẫu Demo" ở thanh công cụ!</td></tr>`;
      return;
    }

    this.currentBOQItems.forEach((item, index) => {
      // Nếu đang bật chế độ lọc chỉ ô chưa có giá
      if (this.filterOnlyUnpriced) {
        if (item.isHeader) return;
        if (item.materialPrice > 0 && item.laborPrice > 0 && item.matchScore >= (this.settings.autoMatchThreshold || 88)) {
          return;
        }
      }

      // Kiểm tra dòng có độ khớp nhỏ hơn 70% hoặc chưa có đơn giá
      const isLowMatch = !item.isHeader && (item.matchScore < 70 || !item.matchScore || item.matchType === 'none' || (item.materialPrice === 0 && item.laborPrice === 0));

      // Nếu đang bật chế độ lọc chỉ các dòng có độ khớp < 70%
      if (this.filterOnlyLowMatch) {
        if (item.isHeader) return;
        if (!isLowMatch) return;
      }

      const tr = document.createElement('tr');

      if (item.isHeader) {
        tr.className = 'header-row';
        tr.innerHTML = `
          <td style="text-align: center;">${item.stt || ''}</td>
          <td>${item.code || ''}</td>
          <td colspan="9" style="font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">${item.description}</td>
          <td style="text-align: center;">-</td>
        `;
      } else {
        // Tô màu nổi bật cảnh báo nếu độ khớp < 70%
        if (isLowMatch) {
          tr.classList.add('low-match-row');
        }

        // Tô màu tím nhạt nếu dòng do AI 3.8 Flash nội suy
        if (item.matchType === 'ai' || item.matchType === 'interpolated') {
          tr.classList.add('ai-row');
        }

        const isUnpriced = (item.materialPrice === 0 && item.laborPrice === 0);
        if (isUnpriced) tr.classList.add('unpriced-row');

        // Badge độ khớp
        let badgeHtml = '';
        if (item.matchType === 'exact') {
          badgeHtml = `<span class="badge badge-green">100% Chuẩn</span>`;
        } else if (item.matchType === 'memory') {
          badgeHtml = `<span class="badge badge-green">100% Ghi nhớ</span>`;
        } else if (item.matchType === 'interpolated') {
          badgeHtml = `<span class="badge" style="background: rgba(168, 85, 247, 0.2); color: #c084fc; border: 1px solid rgba(168, 85, 247, 0.4); font-weight: 600;" title="${item.interpolatedReason || 'Tự động nội suy từ danh mục quy cách tương tự'}">✨ ${item.matchScore}% Nội suy</span>`;
        } else if (item.matchType === 'ai') {
          badgeHtml = `<span class="badge badge-purple" title="${item.aiData?.reasoning || 'AI 3.8 Flash nội suy'}">🤖 AI 3.8 Flash (${item.matchScore}%)</span>`;
        } else if (item.matchType === 'manual') {
          badgeHtml = `<span class="badge badge-blue">Nhập tay</span>`;
        } else if (item.matchScore >= 80) {
          badgeHtml = `<span class="badge badge-green">${item.matchScore}%</span>`;
        } else if (item.matchScore >= 70) {
          badgeHtml = `<span class="badge badge-amber">${item.matchScore}% Gợi ý</span>`;
        } else {
          // Nhỏ hơn 70%: Tô màu đỏ và cảnh báo rõ ràng
          badgeHtml = `<span class="badge badge-red" style="font-weight: 700;">⚠️ ${item.matchScore || 0}% Cần duyệt</span>`;
        }

        // Nút gợi ý nếu có danh sách ứng viên
        let suggestBtnHtml = '';
        if (item.suggestions && item.suggestions.length > 0) {
          suggestBtnHtml = `
            <div>
              <button class="suggestion-btn" onclick="window.appController.openSuggestionsModal(${index})">
                <span>🔍</span> Chọn lại (${item.suggestions.length})
              </button>
            </div>
          `;
        }

        // Cột Thao tác: Nút Duyệt (cho dòng AI), Nút Lưu Quy Tắc nổi bật, Nút gọi AI riêng
        let actionButtonsHtml = '';
        if (item.matchType === 'ai' || item.matchType === 'interpolated') {
          actionButtonsHtml += `
            <button class="btn btn-success btn-sm" style="padding: 4px 8px; font-size: 11px; font-weight: 600;" title="Phê duyệt đơn giá này và lưu vào bộ nhớ quy tắc" onclick="window.appController.approveAIRow(${index})">
              <span>✅</span> Duyệt
            </button>
          `;
        }

        actionButtonsHtml += `
          <button class="btn btn-secondary btn-sm btn-save-memory-row" title="Lưu ngay tên BOQ và đơn giá hiện tại vào Bộ Nhớ Quy Tắc" onclick="window.appController.saveRowToMemory(${index})">
            <span>💾</span> Lưu Quy Tắc
          </button>
          <button class="btn btn-purple btn-sm" style="padding: 4px 7px;" title="Gọi AI 3.8 Flash phân tích và nội suy riêng cho dòng này" onclick="window.appController.callGeminiForRow(${index})">
            <span>🤖</span>
          </button>
        `;

        tr.innerHTML = `
          <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${item.stt || (index + 1)}</td>
          <td class="mono" style="font-size: 11px; color: var(--text-secondary);">${item.code || ''}</td>
          <td style="font-weight: 500;">
            ${item.description}
            ${item.matchedMaterial ? `
              <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">
                ↳ Khớp: <em>${item.matchedMaterial.name} (${item.matchedMaterial.spec || ''})</em>
                ${item.matchedMaterial.catalogFileName ? `<span class="badge-catalog" style="font-size: 10px; padding: 1px 5px; margin-left: 4px;">📁 ${item.matchedMaterial.catalogFileName}</span>` : ''}
              </div>` : ''}
            ${item.interpolatedReason ? `<div style="font-size: 11px; color: #c084fc; margin-top: 2px;">↳ ✨ <em>${item.interpolatedReason}</em></div>` : ''}
            ${item.aiData?.decodedName ? `<div style="font-size: 11px; color: #c084fc; margin-top: 2px;">↳ AI nhận diện: <em>${item.aiData.decodedName} (${item.aiData.spec || ''})</em></div>` : ''}
          </td>
          <td style="text-align: center;">${item.unit || '-'}</td>
          <td class="mono" style="text-align: right; font-weight: 600;">${(item.quantity || 0).toLocaleString('vi-VN')}</td>
          <td>
            <input type="text" class="table-input" value="${item.materialPrice ? item.materialPrice.toLocaleString('vi-VN') : '0'}" 
              onfocus="this.select()" 
              onchange="window.appController.handleCellPriceChange(${index}, 'materialPrice', this.value)">
          </td>
          <td>
            <input type="text" class="table-input" value="${item.laborPrice ? item.laborPrice.toLocaleString('vi-VN') : '0'}" 
              onfocus="this.select()" 
              onchange="window.appController.handleCellPriceChange(${index}, 'laborPrice', this.value)">
          </td>
          <td class="mono" style="text-align: right; color: var(--text-secondary);" id="cell-mat-total-${index}">
            ${Math.round(item.materialTotal || 0).toLocaleString('vi-VN')}
          </td>
          <td class="mono" style="text-align: right; color: var(--text-secondary);" id="cell-lab-total-${index}">
            ${Math.round(item.laborTotal || 0).toLocaleString('vi-VN')}
          </td>
          <td class="mono" style="text-align: right; font-weight: 700; color: var(--accent-secondary);" id="cell-grand-total-${index}">
            ${Math.round(item.grandTotal || 0).toLocaleString('vi-VN')}
          </td>
          <td style="text-align: center;">
            ${badgeHtml}
            ${suggestBtnHtml}
          </td>
          <td style="text-align: center;">
            <div style="display: flex; gap: 4px; justify-content: center; align-items: center; flex-wrap: wrap;">
              ${actionButtonsHtml}
            </div>
          </td>
        `;
      }

      tbody.appendChild(tr);
    });

    // Cập nhật số lượng dòng có độ khớp < 70% lên thanh thông báo
    const lowCountEl = document.getElementById('stats-low-match-count');
    if (lowCountEl && this.currentBOQItems) {
      const count = this.currentBOQItems.filter(i => !i.isHeader && (i.matchScore < 70 || !i.matchScore || (i.materialPrice === 0 && i.laborPrice === 0))).length;
      lowCountEl.innerHTML = `Số dòng &lt; 70%: <strong style="color: #ef4444;">${count} dòng</strong>`;
    }

    // Kiểm tra và hiển thị nút duyệt toàn bộ AI nếu có dòng do AI đề xuất
    this.checkAIApprovalStatus();
  }

  /**
   * Xử lý khi kỹ sư sửa trực tiếp đơn giá trên bảng tính (In-line editing)
   */
  handleCellPriceChange(index, field, rawValue) {
    const item = this.currentBOQItems[index];
    if (!item) return;

    const num = window.excelProcessor.cleanNumber(rawValue);
    item[field] = num;
    item.matchType = 'manual';

    // Tính toán lại thành tiền dòng
    item.materialTotal = (item.quantity || 0) * (item.materialPrice || 0);
    item.laborTotal = (item.quantity || 0) * (item.laborPrice || 0);
    item.grandTotal = item.materialTotal + item.laborTotal;

    // Cập nhật tức thời các ô tương ứng trên DOM
    const matTotalCell = document.getElementById(`cell-mat-total-${index}`);
    if (matTotalCell) matTotalCell.textContent = Math.round(item.materialTotal).toLocaleString('vi-VN');

    const labTotalCell = document.getElementById(`cell-lab-total-${index}`);
    if (labTotalCell) labTotalCell.textContent = Math.round(item.laborTotal).toLocaleString('vi-VN');

    const grandTotalCell = document.getElementById(`cell-grand-total-${index}`);
    if (grandTotalCell) grandTotalCell.textContent = Math.round(item.grandTotal).toLocaleString('vi-VN');

    this.updateBOQSummary();
    this.updateDashboardStats();
  }

  /**
   * Cập nhật thanh tổng hợp số liệu Workspace
   */
  updateBOQSummary() {
    if (!this.currentBOQItems || this.currentBOQItems.length === 0) {
      document.getElementById('sum-total-rows').textContent = '0';
      document.getElementById('sum-priced-rows').textContent = '0';
      document.getElementById('sum-unpriced-rows').textContent = '0';
      document.getElementById('sum-mat-total').textContent = '0 đ';
      document.getElementById('sum-lab-total').textContent = '0 đ';
      document.getElementById('sum-grand-total').textContent = '0 đ';
      return;
    }

    const nonHeader = this.currentBOQItems.filter(i => !i.isHeader);
    const priced = nonHeader.filter(i => (i.materialPrice > 0 || i.laborPrice > 0));
    const unpriced = nonHeader.length - priced.length;

    const matTotal = nonHeader.reduce((s, i) => s + (i.materialTotal || 0), 0);
    const labTotal = nonHeader.reduce((s, i) => s + (i.laborTotal || 0), 0);
    const grandTotal = matTotal + labTotal;

    document.getElementById('sum-total-rows').textContent = nonHeader.length.toLocaleString('vi-VN');
    document.getElementById('sum-priced-rows').textContent = priced.length.toLocaleString('vi-VN');
    document.getElementById('sum-unpriced-rows').textContent = unpriced.toLocaleString('vi-VN');
    document.getElementById('sum-mat-total').textContent = `${Math.round(matTotal).toLocaleString('vi-VN')} đ`;
    document.getElementById('sum-lab-total').textContent = `${Math.round(labTotal).toLocaleString('vi-VN')} đ`;
    document.getElementById('sum-grand-total').textContent = `${Math.round(grandTotal).toLocaleString('vi-VN')} đ`;
  }

  // ==========================================
  // XỬ LÝ GỢI Ý (SUGGESTIONS MODAL)
  // ==========================================

  openSuggestionsModal(rowIndex) {
    const item = this.currentBOQItems[rowIndex];
    if (!item) return;

    document.getElementById('suggest-query-text').textContent = item.description;
    const container = document.getElementById('suggestions-list-container');
    container.innerHTML = '';

    const suggestions = item.suggestions || [];
    if (suggestions.length === 0) {
      container.innerHTML = `<div style="padding: 20px; text-align: center; color: var(--text-muted);">Không có gợi ý phù hợp nào.</div>`;
    } else {
      suggestions.forEach((s) => {
        const mat = s.material;
        const card = document.createElement('div');
        card.style.cssText = 'background: var(--bg-input); border: 1px solid var(--bg-border); padding: 14px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; gap: 12px;';

        let badgeColor = s.score >= 85 ? 'badge-green' : (s.score >= 60 ? 'badge-amber' : 'badge-red');

        card.innerHTML = `
          <div style="flex: 1;">
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="badge ${badgeColor}">${s.score}% Khớp</span>
              <span style="font-weight: 600; font-size: 14px;">${mat.name}</span>
            </div>
            <div style="font-size: 12px; color: var(--text-muted); margin-top: 4px;">
              Quy cách: ${mat.spec || 'N/A'} | ĐVT: ${mat.unit} | Hệ: ${mat.system || 'Cơ Điện'} | Hãng: ${mat.supplier || 'N/A'}
            </div>
            <div style="font-size: 13px; color: var(--accent-secondary); margin-top: 4px;" class="mono">
              Giá VT: <strong>${(mat.materialPrice || 0).toLocaleString('vi-VN')} đ</strong> &nbsp;|&nbsp; 
              Giá NC: <strong>${(mat.laborPrice || 0).toLocaleString('vi-VN')} đ</strong>
            </div>
          </div>
          <button class="btn btn-primary btn-sm" onclick="window.appController.applySuggestion(${rowIndex}, ${mat.id})">
            <span>✅</span> Chọn & Ghi Nhớ
          </button>
        `;

        container.appendChild(card);
      });
    }

    this.openModal('modal-suggestions');
  }

  async applySuggestion(rowIndex, materialId) {
    const item = this.currentBOQItems[rowIndex];
    const mat = this.currentMaterials.find(m => m.id === materialId);
    if (!item || !mat) return;

    item.materialPrice = mat.materialPrice || 0;
    item.laborPrice = mat.laborPrice || 0;
    item.matchedMaterial = mat;
    item.matchType = 'fuzzy';

    item.materialTotal = (item.quantity || 0) * (item.materialPrice || 0);
    item.laborTotal = (item.quantity || 0) * (item.laborPrice || 0);
    item.grandTotal = item.materialTotal + item.laborTotal;

    // Tự động lưu vào bộ nhớ quy tắc (Memory Cache)
    await window.dbManager.saveMemory(item.description, mat);
    this.currentMemory = await window.dbManager.getAllMemory();
    this.renderMemoryTable();
    this.updateDashboardStats();

    this.closeModal('modal-suggestions');
    this.renderBOQTable();
    this.updateBOQSummary();

    this.showToast(`Đã áp giá và tự động ghi nhớ quy tắc cho: "${item.description.slice(0, 30)}..."`, 'success');
  }

  async saveRowToMemory(rowIndex) {
    const item = this.currentBOQItems[rowIndex];
    if (!item || (item.materialPrice === 0 && item.laborPrice === 0)) {
      this.showToast('Dòng này chưa có đơn giá để lưu quy tắc!', 'warning');
      return;
    }

    const matRecord = {
      id: Date.now(),
      code: item.code || 'MEP-' + Date.now().toString().slice(-4),
      name: item.aiData?.decodedName || item.description,
      spec: item.aiData?.spec || '',
      unit: item.unit || 'Bộ',
      materialPrice: item.materialPrice,
      laborPrice: item.laborPrice,
      system: 'Cơ Điện'
    };

    await window.dbManager.saveMemory(item.description, matRecord);
    this.currentMemory = await window.dbManager.getAllMemory();

    // Cập nhật trạng thái dòng ngay lập tức sang 100% Ghi nhớ
    item.matchType = 'memory';
    item.matchScore = 100;
    item.matchedMaterial = matRecord;

    this.renderMemoryTable();
    this.updateDashboardStats();
    this.renderBOQTable();
    this.showToast(`Đã lưu quy tắc ghép giá vào Bộ Nhớ cho: "${item.description.slice(0, 30)}..."`, 'success');
  }

  // ==========================================
  // TÍCH HỢP AI GEMINI
  // ==========================================

  /**
   * Lấy API Key hợp lệ (tự động fallback sang ô nhập trên DOM nếu chưa bấm lưu)
   */
  getEffectiveApiKey() {
    let key = (this.settings.geminiApiKey || '').trim();
    if (!key) {
      const inputEl = document.getElementById('setting-gemini-key');
      if (inputEl && inputEl.value.trim()) {
        key = inputEl.value.trim();
        this.settings.geminiApiKey = key;
        window.dbManager.saveSettings(this.settings);
      }
    }
    return key;
  }

  async callGeminiForRow(rowIndex) {
    const item = this.currentBOQItems[rowIndex];
    if (!item) return;

    const apiKey = this.getEffectiveApiKey();
    if (!apiKey) {
      this.showToast('Vui lòng vào mục "Cài Đặt" để dán Google Gemini API Key trước!', 'warning');
      this.switchTab('tab-settings');
      return;
    }

    this.activeAIPendingRowIndex = rowIndex;
    this.showToast('Đang gửi yêu cầu phân tích tới AI Gemini 3.8 Flash...', 'info');

    // Tìm các vật tư tương đồng gần nhất làm dữ liệu tham chiếu cho AI từ các file bảng giá đang kích hoạt
    const activeMaterials = await window.dbManager.getActiveMaterialsWithPriorities();
    const matPool = activeMaterials.length > 0 ? activeMaterials : (this.currentMaterials || []);
    const candidates = window.fuzzyMatcher.findMatches(item.description, matPool, 8, 30).map(s => s.material);

    const res = await window.geminiService.analyzeAndInterpolate(
      item.description,
      candidates,
      apiKey,
      this.settings.geminiModel || 'gemini-3.8-flash'
    );

    if (res.success && res.data) {
      this.activeAIPendingData = res.data;

      // Đưa dữ liệu vào Modal xác nhận
      document.getElementById('ai-item-description').textContent = item.description;
      document.getElementById('ai-decoded-name').textContent = res.data.decodedName;
      document.getElementById('ai-decoded-spec').textContent = `Quy cách: ${res.data.spec || 'Chuẩn kỹ thuật'} | ĐVT: ${res.data.unit || item.unit || 'bộ'}`;
      document.getElementById('ai-mat-price').textContent = `${(res.data.materialPrice || 0).toLocaleString('vi-VN')} đ`;
      document.getElementById('ai-lab-price').textContent = `${(res.data.laborPrice || 0).toLocaleString('vi-VN')} đ`;
      document.getElementById('ai-reason-text').textContent = res.data.reasoning || 'Nội suy dựa trên tỷ lệ kích thước và tiêu chuẩn lắp đặt cơ điện.';

      this.openModal('modal-gemini-proposal');
    } else {
      this.showToast('Lỗi từ AI Gemini: ' + (res.error || 'Không nhận được phản hồi'), 'error');
    }
  }

  async confirmAIProposal() {
    if (this.activeAIPendingRowIndex === null || !this.activeAIPendingData) return;

    const item = this.currentBOQItems[this.activeAIPendingRowIndex];
    if (!item) return;

    item.materialPrice = this.activeAIPendingData.materialPrice || 0;
    item.laborPrice = this.activeAIPendingData.laborPrice || 0;
    item.matchType = 'ai';
    item.matchScore = this.activeAIPendingData.confidenceScore || 85;

    item.materialTotal = (item.quantity || 0) * (item.materialPrice || 0);
    item.laborTotal = (item.quantity || 0) * (item.laborPrice || 0);
    item.grandTotal = item.materialTotal + item.laborTotal;

    // Tự động ghi nhớ vào memory
    const aiMatRecord = {
      id: Date.now(),
      code: 'AI-' + Date.now().toString().slice(-4),
      name: this.activeAIPendingData.decodedName,
      spec: this.activeAIPendingData.spec,
      unit: this.activeAIPendingData.unit || item.unit,
      materialPrice: item.materialPrice,
      laborPrice: item.laborPrice,
      system: 'Cơ Điện'
    };

    await window.dbManager.saveMemory(item.description, aiMatRecord);
    this.currentMemory = await window.dbManager.getAllMemory();
    this.renderMemoryTable();
    this.updateDashboardStats();

    this.closeModal('modal-gemini-proposal');
    this.renderBOQTable();
    this.updateBOQSummary();

    this.showToast('Đã áp dụng đề xuất của AI Gemini và lưu quy tắc thành công!', 'success');
  }

  // ==========================================
  // TỰ ĐỘNG CHẠY AI 3.8 FLASH THEO ĐỢT & PHÊ DUYỆT TRỰC TIẾP
  // ==========================================

  /**
   * Tự động chạy AI 3.8 Flash cho toàn bộ các dòng chưa có giá hoặc khớp < 70% (Phương án A)
   */
  async runAIBatch() {
    const apiKey = this.getEffectiveApiKey();
    if (!apiKey) {
      this.showToast('Vui lòng vào mục "Cài Đặt" để dán Google Gemini API Key trước khi chạy AI!', 'warning');
      this.switchTab('tab-settings');
      return;
    }

    if (!this.currentBOQItems || this.currentBOQItems.length === 0) {
      this.showToast('Chưa có dữ liệu BOQ để chạy AI!', 'warning');
      return;
    }

    // Phương án A: Chỉ chạy cho các dòng trừ tiêu đề mà chưa có giá hoặc có độ khớp < 70%
    const targetRows = this.currentBOQItems
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) => !item.isHeader && (item.matchScore < 70 || !item.matchScore || (item.materialPrice === 0 && item.laborPrice === 0)));

    if (targetRows.length === 0) {
      this.showToast('Tất cả các dòng đều đã có đơn giá và đạt độ khớp tốt (>= 70%)!', 'info');
      return;
    }

    const progressWrapper = document.getElementById('ai-batch-progress-wrapper');
    const progressBar = document.getElementById('ai-batch-progress-fill');
    const progressPercent = document.getElementById('ai-batch-progress-percent');
    const progressText = document.getElementById('ai-batch-progress-text');

    progressWrapper.style.display = 'block';
    progressBar.style.width = '0%';
    this.isAIBatchCancelled = false;
    this.isAIBatchRunning = true;

    let successCount = 0;
    const total = targetRows.length;
    const activeMaterials = await window.dbManager.getActiveMaterialsWithPriorities();
    const matPool = activeMaterials.length > 0 ? activeMaterials : (this.currentMaterials || []);

    for (let i = 0; i < total; i++) {
      if (this.isAIBatchCancelled) {
        this.showToast(`Đã dừng tiến trình AI theo yêu cầu! Đã xử lý ${successCount}/${total} dòng.`, 'info');
        break;
      }

      const { item, idx } = targetRows[i];
      const pct = Math.round(((i + 1) / total) * 100);
      progressBar.style.width = `${pct}%`;
      progressPercent.textContent = `${pct}% (${i + 1}/${total})`;
      progressText.textContent = `AI 3.8 Flash đang phân tích & nội suy dòng ${i + 1}/${total}: "${item.description.slice(0, 32)}..."`;

      // Tìm ứng viên tham chiếu trong các file bảng giá đang kích hoạt
      const candidates = window.fuzzyMatcher.findMatches(item.description, matPool, 8, 30).map(s => s.material);

      try {
        const res = await window.geminiService.analyzeAndInterpolate(
          item.description,
          candidates,
          apiKey,
          this.settings.geminiModel || 'gemini-3.8-flash'
        );

        if (res.success && res.data) {
          item.materialPrice = res.data.materialPrice || 0;
          item.laborPrice = res.data.laborPrice || 0;
          item.matchType = 'ai';
          item.matchScore = res.data.confidenceScore || 85;
          item.aiData = res.data;

          item.materialTotal = (item.quantity || 0) * item.materialPrice;
          item.laborTotal = (item.quantity || 0) * item.laborPrice;
          item.grandTotal = item.materialTotal + item.laborTotal;
          successCount++;
        }
      } catch (err) {
        console.warn(`Lỗi khi AI phân tích dòng ${idx}:`, err);
      }

      // Render lại định kỳ để kỹ sư thấy ngay kết quả nội suy trên màn hình
      if (i % 2 === 0 || i === total - 1) {
        this.renderBOQTable();
        this.updateBOQSummary();
      }

      // Giãn cách thời gian giữa các request (400ms) để ổn định kết nối API
      await new Promise(r => setTimeout(r, 400));
    }

    this.isAIBatchRunning = false;
    progressWrapper.style.display = 'none';
    this.renderBOQTable();
    this.updateBOQSummary();
    this.updateDashboardStats();
    this.checkAIApprovalStatus();

    if (successCount > 0) {
      this.showToast(`AI 3.8 Flash đã hoàn tất phân tích & nội suy cho ${successCount} dòng! Bạn có thể phê duyệt trực tiếp trên bảng trước khi xuất Excel.`, 'success');
    }
  }

  /**
   * Phê duyệt đơn giá AI cho một dòng cụ thể và lưu vào Bộ Nhớ Quy Tắc
   */
  async approveAIRow(index) {
    const item = this.currentBOQItems[index];
    if (!item) return;

    item.matchType = 'memory';
    item.matchScore = 100;

    const matRecord = {
      id: Date.now(),
      code: item.code || 'AI-' + Date.now().toString().slice(-4),
      name: item.aiData?.decodedName || item.description,
      spec: item.aiData?.spec || '',
      unit: item.aiData?.unit || item.unit || 'Bộ',
      materialPrice: item.materialPrice,
      laborPrice: item.laborPrice,
      system: 'Cơ Điện'
    };

    await window.dbManager.saveMemory(item.description, matRecord);
    this.currentMemory = await window.dbManager.getAllMemory();
    this.renderMemoryTable();
    this.updateDashboardStats();
    this.renderBOQTable();
    this.checkAIApprovalStatus();

    this.showToast(`Đã duyệt đơn giá AI và lưu quy tắc cho: "${item.description.slice(0, 30)}..."`, 'success');
  }

  /**
   * Phê duyệt toàn bộ các dòng đề xuất AI cùng một lúc
   */
  async approveAllAIRows() {
    const aiRows = this.currentBOQItems.filter(i => !i.isHeader && i.matchType === 'ai');
    if (aiRows.length === 0) {
      this.showToast('Không có dòng đề xuất AI nào đang chờ duyệt!', 'info');
      return;
    }

    let count = 0;
    for (const item of aiRows) {
      item.matchType = 'memory';
      item.matchScore = 100;

      const matRecord = {
        id: Date.now() + Math.random(),
        code: item.code || 'AI-' + Date.now().toString().slice(-4),
        name: item.aiData?.decodedName || item.description,
        spec: item.aiData?.spec || '',
        unit: item.aiData?.unit || item.unit || 'Bộ',
        materialPrice: item.materialPrice,
        laborPrice: item.laborPrice,
        system: 'Cơ Điện'
      };

      await window.dbManager.saveMemory(item.description, matRecord);
      count++;
    }

    this.currentMemory = await window.dbManager.getAllMemory();
    this.renderMemoryTable();
    this.updateDashboardStats();
    this.renderBOQTable();
    this.checkAIApprovalStatus();

    this.showToast(`Đã phê duyệt thành công toàn bộ ${count} dòng đề xuất của AI và lưu vào Bộ Nhớ Quy Tắc!`, 'success');
  }

  /**
   * Kiểm tra và hiển thị nút Duyệt Toàn Bộ AI
   */
  checkAIApprovalStatus() {
    const btnApproveAll = document.getElementById('btn-approve-all-ai');
    if (!btnApproveAll) return;
    const hasAIRows = (this.currentBOQItems || []).some(i => !i.isHeader && i.matchType === 'ai');
    btnApproveAll.style.display = hasAIRows ? 'inline-flex' : 'none';
  }

  // ==========================================
  // QUẢN LÝ BỘ NHỚ QUY TẮC THỦ CÔNG (MANUAL MEMORY MODAL)
  // ==========================================

  openAddMemoryModal() {
    // 1. Nạp danh sách vật tư vào select
    const select = document.getElementById('mem-select-material');
    if (select) {
      select.innerHTML = '<option value="">-- Chọn một vật tư chuẩn từ kho giá --</option>';
      (this.currentMaterials || []).forEach(m => {
        const opt = document.createElement('option');
        opt.value = m.id;
        opt.textContent = `[${m.code || 'VT'}] ${m.name} - Giá VT: ${(m.materialPrice || 0).toLocaleString('vi-VN')} đ | NC: ${(m.laborPrice || 0).toLocaleString('vi-VN')} đ`;
        select.appendChild(opt);
      });
    }

    // 2. Reset các ô nhập
    document.getElementById('mem-input-boq-phrase').value = '';
    document.getElementById('mem-custom-name').value = '';
    document.getElementById('mem-custom-spec').value = '';
    document.getElementById('mem-custom-unit').value = 'Bộ';
    document.getElementById('mem-custom-matprice').value = '';
    document.getElementById('mem-custom-labprice').value = '';
    document.getElementById('mem-preview-selected-mat').style.display = 'none';

    // Mặc định chọn tab thư viện
    const btnLib = document.getElementById('btn-mem-mode-library');
    if (btnLib) btnLib.click();

    this.openModal('modal-add-memory');
  }

  onSelectMemoryMaterialChange() {
    const select = document.getElementById('mem-select-material');
    const preview = document.getElementById('mem-preview-selected-mat');
    if (!select || !preview) return;

    const selectedId = select.value;
    const mat = (this.currentMaterials || []).find(m => m.id == selectedId);

    if (mat) {
      preview.style.display = 'block';
      document.getElementById('mem-prev-name').textContent = `[${mat.code || 'VT'}] ${mat.name}`;
      document.getElementById('mem-prev-spec').textContent = `Quy cách: ${mat.spec || 'Tiêu chuẩn'} | ĐVT: ${mat.unit || 'Bộ'}`;
      document.getElementById('mem-prev-matprice').textContent = `Giá VT: ${(mat.materialPrice || 0).toLocaleString('vi-VN')} đ`;
      document.getElementById('mem-prev-labprice').textContent = `Giá NC: ${(mat.laborPrice || 0).toLocaleString('vi-VN')} đ`;
    } else {
      preview.style.display = 'none';
    }
  }

  async saveManualMemory() {
    const boqPhrase = (document.getElementById('mem-input-boq-phrase')?.value || '').trim();
    if (!boqPhrase) {
      this.showToast('Vui lòng nhập cụm từ / mô tả công việc trong BOQ cần ghi nhớ!', 'warning');
      return;
    }

    const isLibraryMode = document.getElementById('btn-mem-mode-library')?.classList.contains('active');
    let matRecord = null;

    if (isLibraryMode) {
      const selectedId = document.getElementById('mem-select-material')?.value;
      if (!selectedId) {
        this.showToast('Vui lòng chọn một vật tư từ danh sách kho giá!', 'warning');
        return;
      }
      const mat = (this.currentMaterials || []).find(m => m.id == selectedId);
      if (!mat) {
        this.showToast('Không tìm thấy vật tư đã chọn!', 'error');
        return;
      }
      matRecord = {
        id: mat.id,
        code: mat.code,
        name: mat.name,
        spec: mat.spec,
        unit: mat.unit,
        materialPrice: mat.materialPrice,
        laborPrice: mat.laborPrice,
        system: mat.system
      };
    } else {
      const name = (document.getElementById('mem-custom-name')?.value || '').trim();
      const unit = (document.getElementById('mem-custom-unit')?.value || '').trim() || 'Bộ';
      const matPrice = Number(document.getElementById('mem-custom-matprice')?.value) || 0;
      const labPrice = Number(document.getElementById('mem-custom-labprice')?.value) || 0;

      if (!name) {
        this.showToast('Vui lòng nhập tên vật tư chuẩn!', 'warning');
        return;
      }
      if (matPrice === 0 && labPrice === 0) {
        this.showToast('Vui lòng nhập đơn giá vật tư hoặc nhân công lớn hơn 0!', 'warning');
        return;
      }

      matRecord = {
        id: Date.now(),
        code: 'QT-' + Date.now().toString().slice(-4),
        name: name,
        spec: (document.getElementById('mem-custom-spec')?.value || '').trim(),
        unit: unit,
        materialPrice: matPrice,
        laborPrice: labPrice,
        system: document.getElementById('mem-custom-system')?.value || 'Cơ Điện'
      };
    }

    await window.dbManager.saveMemory(boqPhrase, matRecord);
    this.currentMemory = await window.dbManager.getAllMemory();
    this.renderMemoryTable();
    this.updateDashboardStats();
    this.closeModal('modal-add-memory');

    this.showToast(`Đã thêm thành công quy tắc ghi nhớ cho: "${boqPhrase}"!`, 'success');
  }

  // ==========================================
  // XỬ LÝ FILE EXCEL UPLOAD & ÁNH XẠ CỘT
  // ==========================================

  async handleExcelUpload(event, type) {
    const file = event.target.files[0];
    if (!file) return;

    try {
      this.showToast('Đang đọc tệp Excel...', 'info');
      const parsed = await window.excelProcessor.readExcelFile(file, type);

      this.pendingExcelImport = {
        type: type,
        rawRows: parsed.rows,
        sheetNames: parsed.sheetNames,
        activeSheet: parsed.activeSheet,
        fileName: file.name
      };

      this.openColumnMappingModal(type, parsed);
    } catch (err) {
      this.showToast('Lỗi đọc file: ' + err.message, 'error');
    } finally {
      event.target.value = ''; // Reset input để có thể chọn lại cùng 1 file
    }
  }

  openColumnMappingModal(type, parsed) {
    const title = type === 'boq' ? 'Ánh Xạ Cột: Bảng Khối Lượng BOQ' : 'Ánh Xạ Cột: Bảng Giá Vật Tư / Báo Giá';
    document.getElementById('mapping-modal-title').textContent = title;

    // Hiển thị hoặc ẩn ô đặt tên file bảng giá
    const catContainer = document.getElementById('map-catalog-info-container');
    const catInput = document.getElementById('map-catalog-name');
    if (type !== 'boq') {
      if (catContainer) catContainer.style.display = 'block';
      if (catInput) {
        catInput.value = this.pendingExcelImport.fileName || 'Bang_Gia_Moi.xlsx';
      }
    } else {
      if (catContainer) catContainer.style.display = 'none';
    }

    // Sheet dropdown
    const sheetSelect = document.getElementById('map-sheet-select');
    sheetSelect.innerHTML = '';
    parsed.sheetNames.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      opt.selected = (name === parsed.activeSheet);
      sheetSelect.appendChild(opt);
    });

    sheetSelect.onchange = () => {
      const rows = window.excelProcessor.switchSheet(sheetSelect.value);
      this.pendingExcelImport.rawRows = rows;
      this.renderMappingFields(type, rows);
    };

    this.renderMappingFields(type, parsed.rows);
    this.openModal('modal-column-mapping');
  }

  renderMappingFields(type, rows) {
    const detected = window.excelProcessor.autoDetectColumns(rows, type);
    document.getElementById('map-start-row').value = (detected.dataStartRowIndex || 1) + 1; // Hiển thị 1-indexed

    const headerRow = rows[detected.headerRowIndex || 0] || [];
    const makeOptions = (selectedColIdx) => {
      let opts = '<option value="">-- Không chọn --</option>';
      headerRow.forEach((colName, idx) => {
        const name = (colName || '').toString().trim() || `Cột ${idx + 1}`;
        const isSel = idx === selectedColIdx ? 'selected' : '';
        opts += `<option value="${idx}" ${isSel}>Cột ${idx + 1}: ${name}</option>`;
      });
      return opts;
    };

    const container = document.getElementById('mapping-fields-container');
    container.innerHTML = '';

    if (type === 'boq') {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Cột STT</label>
          <select class="form-control" id="map-col-stt">${makeOptions(detected.sttCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Mã Hiệu (Nếu có)</label>
          <select class="form-control" id="map-col-code">${makeOptions(detected.codeCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Tên Vật Tư / Diễn Giải *</label>
          <select class="form-control" id="map-col-name">${makeOptions(detected.nameCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Đơn Vị Tính (ĐVT)</label>
          <select class="form-control" id="map-col-unit">${makeOptions(detected.unitCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Khối Lượng *</label>
          <select class="form-control" id="map-col-qty">${makeOptions(detected.quantityCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Đơn Giá Vật Tư (Nếu BOQ đã có cột này)</label>
          <select class="form-control" id="map-col-matprice">${makeOptions(detected.materialPriceCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Đơn Giá Nhân Công (Nếu BOQ đã có cột này)</label>
          <select class="form-control" id="map-col-labprice">${makeOptions(detected.laborPriceCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Thành Tiền Tổng (Nếu BOQ đã có cột này)</label>
          <select class="form-control" id="map-col-grandtotal">${makeOptions(detected.grandTotalCol)}</select>
        </div>
      `;
    } else {
      container.innerHTML = `
        <div class="form-group">
          <label class="form-label">Cột Mã Hiệu Vật Tư</label>
          <select class="form-control" id="map-col-code">${makeOptions(detected.codeCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Tên Vật Tư Chuẩn *</label>
          <select class="form-control" id="map-col-name">${makeOptions(detected.nameCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Thông Số / Quy Cách</label>
          <select class="form-control" id="map-col-spec">${makeOptions(detected.specCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Đơn Vị Tính (ĐVT)</label>
          <select class="form-control" id="map-col-unit">${makeOptions(detected.unitCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Đơn Giá Vật Tư (VNĐ) *</label>
          <select class="form-control" id="map-col-matprice">${makeOptions(detected.materialPriceCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Đơn Giá Nhân Công (VNĐ)</label>
          <select class="form-control" id="map-col-labprice">${makeOptions(detected.laborPriceCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Phân Hệ (Điện, Nước, HVAC)</label>
          <select class="form-control" id="map-col-system">${makeOptions(detected.systemCol)}</select>
        </div>
        <div class="form-group">
          <label class="form-label">Cột Nhà Cung Cấp / Hãng</label>
          <select class="form-control" id="map-col-supplier">${makeOptions(detected.supplierCol)}</select>
        </div>
      `;
    }
  }

  async confirmExcelMapping() {
    const type = this.pendingExcelImport.type;
    const rows = this.pendingExcelImport.rawRows;
    const startRow = Math.max(0, (parseInt(document.getElementById('map-start-row').value) || 2) - 1); // Đổi sang 0-indexed

    const parseCol = (id) => {
      const el = document.getElementById(id);
      return el && el.value !== '' ? parseInt(el.value) : undefined;
    };

    if (type === 'boq') {
      const nameCol = parseCol('map-col-name');
      if (nameCol === undefined) {
        this.showToast('Vui lòng chọn cột Tên vật tư / Diễn giải!', 'warning');
        return;
      }

      const mapping = {
        headerRowIndex: Math.max(0, startRow - 1),
        dataStartRowIndex: startRow,
        sttCol: parseCol('map-col-stt'),
        codeCol: parseCol('map-col-code'),
        nameCol: nameCol,
        unitCol: parseCol('map-col-unit'),
        quantityCol: parseCol('map-col-qty'),
        materialPriceCol: parseCol('map-col-matprice'),
        laborPriceCol: parseCol('map-col-labprice'),
        grandTotalCol: parseCol('map-col-grandtotal')
      };

      // Lưu trữ workbook gốc để khi xuất Excel sẽ giữ nguyên 100% form BOQ của người dùng
      this.boqSourceWorkbook = window.excelProcessor.currentWorkbook;
      this.boqSourceSheetName = this.pendingExcelImport.activeSheet || window.excelProcessor.currentSheetName;
      this.boqMapping = mapping;

      this.currentBOQItems = window.excelProcessor.extractBOQFromRows(rows, mapping);
      this.closeModal('modal-column-mapping');
      this.switchTab('tab-workspace');
      this.renderBOQTable();
      this.updateBOQSummary();
      this.updateDashboardStats();

      this.showToast(`Nạp thành công ${this.currentBOQItems.length} dòng BOQ (Giữ nguyên form mẫu gốc khi xuất)!`, 'success');
    } else {
      const nameCol = parseCol('map-col-name');
      const matPriceCol = parseCol('map-col-matprice');
      if (nameCol === undefined || matPriceCol === undefined) {
        this.showToast('Vui lòng chọn cột Tên vật tư và cột Đơn giá!', 'warning');
        return;
      }

      const mapping = {
        dataStartRowIndex: startRow,
        codeCol: parseCol('map-col-code'),
        nameCol: nameCol,
        specCol: parseCol('map-col-spec'),
        unitCol: parseCol('map-col-unit'),
        materialPriceCol: matPriceCol,
        laborPriceCol: parseCol('map-col-labprice'),
        systemCol: parseCol('map-col-system'),
        supplierCol: parseCol('map-col-supplier')
      };

      const catName = (document.getElementById('map-catalog-name')?.value || '').trim() || this.pendingExcelImport.fileName || 'Bang_Gia_Moi.xlsx';
      const newMaterials = window.excelProcessor.extractMaterialsFromRows(rows, mapping);
      if (newMaterials.length === 0) {
        this.showToast('Không tìm thấy dòng vật tư hợp lệ nào!', 'warning');
        return;
      }

      try {
        // Tạo Catalog mới cho file này
        const newCatalog = await window.dbManager.addCatalog({
          fileName: this.pendingExcelImport.fileName || catName,
          displayName: catName,
          itemCount: newMaterials.length,
          uploadedAt: new Date().toISOString(),
          isActive: true
        });

        // Lưu vật tư gắn liền với catalogId
        await window.dbManager.bulkAddMaterials(newMaterials, newCatalog.id);
        this.currentCatalogs = await window.dbManager.getAllCatalogs();
        this.currentMaterials = await window.dbManager.getAllMaterials();
        this.closeModal('modal-column-mapping');
        this.switchTab('tab-library');

        // Tự động chọn catalog vừa nạp trong dropdown
        this.renderCatalogFilterOptions();
        const filterCat = document.getElementById('filter-price-catalog');
        if (filterCat) filterCat.value = newCatalog.id;
        this.renderLibraryTable();
        this.updateWorkspaceCatalogStatus();
        this.updateDashboardStats();

        this.showToast(`Đã lưu thành công ${newMaterials.length} vật tư vào bộ đơn giá [${catName}]!`, 'success');
      } catch (err) {
        console.error('Lỗi khi lưu bảng giá vào CSDL:', err);
        this.showToast('Có lỗi khi lưu bảng giá: ' + (err.message || err), 'error');
      }
    }
  }

  // ==========================================
  // QUẢN LÝ KHO BẢNG GIÁ & ĐA FILE BẢNG GIÁ
  // ==========================================

  renderCatalogFilterOptions() {
    const select = document.getElementById('filter-price-catalog');
    if (!select) return;
    const currentVal = select.value;
    select.innerHTML = '';

    const allOpt = document.createElement('option');
    allOpt.value = 'all';
    allOpt.textContent = `📁 Tất Cả File Bảng Giá (${(this.currentMaterials || []).length} VT)`;
    select.appendChild(allOpt);

    (this.currentCatalogs || []).forEach(cat => {
      const opt = document.createElement('option');
      opt.value = cat.id;
      const statusStr = cat.isActive ? 'Bật' : 'Tắt';
      opt.textContent = `📄 ${cat.displayName || cat.fileName} (${cat.itemCount || 0} VT) - [${statusStr}]`;
      select.appendChild(opt);
    });

    if (currentVal && [...select.options].some(o => o.value == currentVal)) {
      select.value = currentVal;
    } else {
      select.value = 'all';
    }

    const activeCount = (this.currentCatalogs || []).filter(c => c.isActive !== false).length;
    const badgeCount = document.getElementById('catalogs-active-count');
    if (badgeCount) badgeCount.textContent = `${activeCount}/${(this.currentCatalogs || []).length}`;
  }

  updateWorkspaceCatalogStatus() {
    const textEl = document.getElementById('ws-active-catalogs-text');
    if (!textEl) return;

    const activeCatalogs = (this.currentCatalogs || []).filter(c => c.isActive !== false);
    if (activeCatalogs.length === 0) {
      textEl.textContent = 'Chưa bật file nào (Bấm để chọn)';
      textEl.style.color = '#ef4444';
    } else if (activeCatalogs.length === 1) {
      textEl.textContent = `${activeCatalogs[0].displayName || activeCatalogs[0].fileName} (${activeCatalogs[0].itemCount || 0} VT)`;
      textEl.style.color = 'var(--accent-primary)';
    } else {
      const names = activeCatalogs.map((c, i) => `#${i + 1} ${c.displayName || c.fileName}`).join(' > ');
      textEl.textContent = `${activeCatalogs.length} file kích hoạt: ${names}`;
      textEl.style.color = 'var(--accent-primary)';
    }
  }

  async openPriceCatalogsModal() {
    try {
      this.currentCatalogs = await window.dbManager.getAllCatalogs();
      this.renderPriceCatalogsManagementTable();
      this.openModal('modal-price-catalogs');
    } catch (err) {
      console.error('Lỗi khi mở modal quản lý file giá:', err);
      this.showToast('Không thể tải danh sách file bảng giá: ' + (err.message || err), 'error');
    }
  }

  renderPriceCatalogsManagementTable() {
    const tbody = document.getElementById('catalogs-management-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = this.currentCatalogs || [];
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="6" style="text-align: center; padding: 30px; color: var(--text-muted);">Chưa có File Bảng Giá nào được nạp. Hãy bấm "Nạp Thêm File Excel Bảng Giá Mới" để thêm!</td></tr>`;
      return;
    }

    list.forEach((cat, idx) => {
      const tr = document.createElement('tr');
      const isFirst = idx === 0;
      const isLast = idx === list.length - 1;
      const dateStr = cat.uploadedAt ? new Date(cat.uploadedAt).toLocaleDateString('vi-VN') : '-';

      tr.innerHTML = `
        <td style="text-align: center;">
          <div class="priority-controls">
            <span class="priority-badge ${isFirst ? 'p1' : ''}">${idx + 1}</span>
            <button class="priority-btn" ${isFirst ? 'disabled' : ''} onclick="window.appController.moveCatalogPriority(${cat.id}, 'up')" title="Tăng mức độ ưu tiên tra cứu">▲</button>
            <button class="priority-btn" ${isLast ? 'disabled' : ''} onclick="window.appController.moveCatalogPriority(${cat.id}, 'down')" title="Giảm mức độ ưu tiên tra cứu">▼</button>
          </div>
        </td>
        <td>
          <div style="font-weight: 600; color: var(--text-main); font-size: 13px;">${cat.displayName || cat.fileName}</div>
          <div style="font-size: 11px; color: var(--text-muted); margin-top: 2px;">Tệp gốc: <code>${cat.fileName}</code></div>
        </td>
        <td style="text-align: center; font-size: 12px; color: var(--text-secondary);">${dateStr}</td>
        <td class="mono" style="text-align: right; font-weight: 600; color: var(--accent-primary);">${(cat.itemCount || 0).toLocaleString('vi-VN')}</td>
        <td style="text-align: center;">
          <label class="switch-toggle" title="${cat.isActive ? 'Đang BẬT - Tham gia áp giá BOQ' : 'Đang TẮT - Bỏ qua khi tra cứu'}">
            <input type="checkbox" ${cat.isActive ? 'checked' : ''} onchange="window.appController.toggleCatalogActive(${cat.id})">
            <span class="switch-slider"></span>
          </label>
        </td>
        <td style="text-align: center;">
          <button class="btn btn-danger btn-sm" style="padding: 4px 8px;" title="Xóa file bảng giá này (Không ảnh hưởng các file khác)" onclick="window.appController.deleteCatalog(${cat.id})">
            <span>🗑️</span>
          </button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async toggleCatalogActive(id) {
    const updatedState = await window.dbManager.toggleCatalogActive(id);
    this.currentCatalogs = await window.dbManager.getAllCatalogs();
    this.renderPriceCatalogsManagementTable();
    this.renderCatalogFilterOptions();
    this.updateWorkspaceCatalogStatus();
    this.showToast(`Đã ${updatedState ? 'BẬT kích hoạt' : 'TẮT'} file bảng giá!`, 'info');
  }

  async moveCatalogPriority(id, direction) {
    const ok = await window.dbManager.moveCatalogPriority(id, direction);
    if (ok) {
      this.currentCatalogs = await window.dbManager.getAllCatalogs();
      this.renderPriceCatalogsManagementTable();
      this.renderCatalogFilterOptions();
      this.updateWorkspaceCatalogStatus();
    }
  }

  async deleteCatalog(id) {
    const cat = (this.currentCatalogs || []).find(c => c.id === Number(id));
    const name = cat ? (cat.displayName || cat.fileName) : `ID #${id}`;
    const count = cat ? (cat.itemCount || 0) : 0;

    if (confirm(`XÁC NHẬN XÓA FILE BẢNG GIÁ:\n\nBạn có chắc chắn muốn xóa file "${name}" và toàn bộ ${count.toLocaleString('vi-VN')} vật tư của file này không?\n\nLưu ý: Các file bảng giá khác sẽ được bảo toàn nguyên vẹn 100%!`)) {
      await window.dbManager.deleteCatalog(id);
      this.currentCatalogs = await window.dbManager.getAllCatalogs();
      this.currentMaterials = await window.dbManager.getAllMaterials();
      this.renderPriceCatalogsManagementTable();
      this.renderCatalogFilterOptions();
      this.updateWorkspaceCatalogStatus();
      this.renderLibraryTable();
      this.updateDashboardStats();
      this.showToast(`Đã xóa vĩnh viễn file bảng giá [${name}]!`, 'success');
    }
  }

  renderLibraryTable() {
    const tbody = document.getElementById('library-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const query = (document.getElementById('search-library-input')?.value || '').toLowerCase().trim();
    const systemFilter = document.getElementById('filter-system')?.value || 'all';
    const catalogFilter = document.getElementById('filter-price-catalog')?.value || 'all';

    let list = this.currentMaterials || [];

    if (catalogFilter !== 'all') {
      list = list.filter(m => m.catalogId == Number(catalogFilter));
    }

    if (systemFilter !== 'all') {
      list = list.filter(m => m.system === systemFilter);
    }

    if (query) {
      list = list.filter(m => {
        const full = `${m.code || ''} ${m.name || ''} ${m.spec || ''} ${m.supplier || ''}`.toLowerCase();
        return full.includes(query);
      });
    }

    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="11" style="text-align: center; padding: 40px; color: var(--text-muted);">Không tìm thấy vật tư nào phù hợp trong file bảng giá này.</td></tr>`;
      return;
    }

    const catalogMap = new Map();
    (this.currentCatalogs || []).forEach(c => catalogMap.set(c.id, c.displayName || c.fileName));

    list.slice(0, 200).forEach((mat, idx) => {
      const tr = document.createElement('tr');
      const catName = catalogMap.get(mat.catalogId) || 'Mặc định';

      tr.innerHTML = `
        <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
        <td class="mono" style="font-size: 11px; font-weight: 600;">${mat.code || '-'}</td>
        <td style="font-weight: 500;">${mat.name}</td>
        <td style="color: var(--text-secondary); font-size: 12px;">${mat.spec || '-'}</td>
        <td style="text-align: center;">${mat.unit || '-'}</td>
        <td class="mono" style="text-align: right; color: var(--accent-primary); font-weight: 600;">${(mat.materialPrice || 0).toLocaleString('vi-VN')}</td>
        <td class="mono" style="text-align: right; color: var(--accent-secondary); font-weight: 600;">${(mat.laborPrice || 0).toLocaleString('vi-VN')}</td>
        <td><span class="badge badge-blue">${mat.system || 'Cơ Điện'}</span></td>
        <td style="font-size: 12px; color: var(--text-secondary);">${mat.supplier || 'Nội bộ'}</td>
        <td><span class="badge-catalog" title="${catName}">📁 ${catName}</span></td>
        <td style="text-align: center;">
          <div style="display: flex; gap: 4px; justify-content: center;">
            <button class="btn btn-secondary btn-sm" style="padding: 4px 6px;" title="Sửa vật tư" onclick="window.appController.openMaterialModal(${mat.id})">✏️</button>
            <button class="btn btn-danger btn-sm" style="padding: 4px 6px;" title="Xóa vật tư" onclick="window.appController.deleteMaterial(${mat.id})">🗑️</button>
          </div>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  openMaterialModal(matId = null) {
    const title = document.getElementById('material-form-title');
    const form = document.getElementById('material-form');
    form.reset();

    if (matId) {
      title.textContent = 'Chỉnh Sửa Vật Tư';
      const mat = this.currentMaterials.find(m => m.id === matId);
      if (mat) {
        document.getElementById('mat-form-id').value = mat.id;
        document.getElementById('mat-form-code').value = mat.code || '';
        document.getElementById('mat-form-name').value = mat.name || '';
        document.getElementById('mat-form-spec').value = mat.spec || '';
        document.getElementById('mat-form-unit').value = mat.unit || '';
        document.getElementById('mat-form-matprice').value = mat.materialPrice || 0;
        document.getElementById('mat-form-labprice').value = mat.laborPrice || 0;
        document.getElementById('mat-form-system').value = mat.system || 'Hệ Điện';
        document.getElementById('mat-form-supplier').value = mat.supplier || '';
      }
    } else {
      title.textContent = 'Thêm Vật Tư Mới Vào Kho Bảng Giá';
      document.getElementById('mat-form-id').value = '';
    }

    this.openModal('modal-material-form');
  }

  async saveMaterialForm() {
    const id = document.getElementById('mat-form-id').value;
    const name = document.getElementById('mat-form-name').value.trim();
    const unit = document.getElementById('mat-form-unit').value.trim();
    const matPrice = parseFloat(document.getElementById('mat-form-matprice').value) || 0;
    const labPrice = parseFloat(document.getElementById('mat-form-labprice').value) || 0;

    if (!name || !unit) {
      this.showToast('Vui lòng điền đầy đủ Tên vật tư và Đơn vị tính!', 'warning');
      return;
    }

    const itemData = {
      code: document.getElementById('mat-form-code').value.trim(),
      name: name,
      spec: document.getElementById('mat-form-spec').value.trim(),
      unit: unit,
      materialPrice: matPrice,
      laborPrice: labPrice,
      system: document.getElementById('mat-form-system').value,
      supplier: document.getElementById('mat-form-supplier').value.trim() || 'Nội bộ'
    };

    if (id) {
      itemData.id = Number(id);
      const existing = (this.currentMaterials || []).find(m => m.id === Number(id));
      if (existing && existing.catalogId) {
        itemData.catalogId = existing.catalogId;
      }
      await window.dbManager.updateMaterial(itemData);
      this.showToast('Đã cập nhật thông tin vật tư!', 'success');
    } else {
      const catalogFilter = document.getElementById('filter-price-catalog')?.value;
      if (catalogFilter && catalogFilter !== 'all') {
        itemData.catalogId = Number(catalogFilter);
      } else if (this.currentCatalogs && this.currentCatalogs.length > 0) {
        itemData.catalogId = this.currentCatalogs[0].id;
      }
      await window.dbManager.addMaterial(itemData);
      this.showToast('Đã thêm vật tư mới vào kho giá!', 'success');
    }

    this.currentCatalogs = await window.dbManager.getAllCatalogs();
    this.currentMaterials = await window.dbManager.getAllMaterials();
    this.closeModal('modal-material-form');
    this.renderCatalogFilterOptions();
    this.renderLibraryTable();
    this.updateDashboardStats();
  }

  async deleteMaterial(id) {
    if (confirm('Bạn có chắc chắn muốn xóa vật tư này khỏi kho bảng giá?')) {
      await window.dbManager.deleteMaterial(id);
      this.currentCatalogs = await window.dbManager.getAllCatalogs();
      this.currentMaterials = await window.dbManager.getAllMaterials();
      this.renderCatalogFilterOptions();
      this.renderLibraryTable();
      this.updateDashboardStats();
      this.showToast('Đã xóa vật tư thành công!', 'info');
    }
  }

  // ==========================================
  // QUẢN LÝ BỘ NHỚ HỌC QUY TẮC (MEMORY)
  // ==========================================

  renderMemoryTable() {
    const tbody = document.getElementById('memory-table-body');
    if (!tbody) return;
    tbody.innerHTML = '';

    const list = this.currentMemory || [];
    if (list.length === 0) {
      tbody.innerHTML = `<tr><td colspan="8" style="text-align: center; padding: 40px; color: var(--text-muted);">Chưa có quy tắc ghi nhớ nào. Khi bạn áp giá và chọn vật tư chuẩn trong BOQ, hệ thống sẽ tự động học và hiển thị ở đây!</td></tr>`;
      return;
    }

    list.forEach((m, idx) => {
      const tr = document.createElement('tr');
      const dateStr = m.updatedAt ? new Date(m.updatedAt).toLocaleDateString('vi-VN') : '-';
      tr.innerHTML = `
        <td style="text-align: center; color: var(--text-muted); font-size: 11px;">${idx + 1}</td>
        <td style="font-weight: 500; color: var(--accent-warning);">${m.originalPhrase}</td>
        <td>
          <div style="font-weight: 600;">${m.materialName}</div>
          <div style="font-size: 11px; color: var(--text-muted);">${m.spec || ''}</div>
        </td>
        <td style="text-align: center;">${m.unit || '-'}</td>
        <td class="mono" style="text-align: right; color: var(--accent-primary);">${(m.materialPrice || 0).toLocaleString('vi-VN')}</td>
        <td class="mono" style="text-align: right; color: var(--accent-secondary);">${(m.laborPrice || 0).toLocaleString('vi-VN')}</td>
        <td style="font-size: 11px; color: var(--text-muted);">${dateStr}</td>
        <td style="text-align: center;">
          <button class="btn btn-danger btn-sm" style="padding: 4px 6px;" title="Xóa quy tắc" onclick="window.appController.deleteMemoryItem(${m.id})">🗑️</button>
        </td>
      `;
      tbody.appendChild(tr);
    });
  }

  async deleteMemoryItem(id) {
    await window.dbManager.deleteMemory(id);
    this.currentMemory = await window.dbManager.getAllMemory();
    this.renderMemoryTable();
    this.updateDashboardStats();
    this.showToast('Đã xóa quy tắc học!', 'info');
  }

  // ==========================================
  // XUẤT FILE EXCEL MẪU DEMO
  // ==========================================

  downloadSampleExcelFiles() {
    // 1. Xuất file Bảng Giá Chuẩn MEP
    const priceWb = XLSX.utils.book_new();
    const priceData = [
      ['Mã Hiệu', 'Tên Vật Tư Chuẩn', 'Thông Số / Quy Cách', 'ĐVT', 'Đơn Giá Vật Tư (VNĐ)', 'Đơn Giá Nhân Công (VNĐ)', 'Phân Hệ', 'Nhà Cung Cấp']
    ];
    (window.DEFAULT_MEP_MATERIALS || []).forEach(m => {
      priceData.push([m.code, m.name, m.spec, m.unit, m.materialPrice, m.laborPrice, m.system, m.supplier]);
    });
    const priceWs = XLSX.utils.aoa_to_sheet(priceData);
    XLSX.utils.book_append_sheet(priceWb, priceWs, 'Bang_Gia_Chuan');
    XLSX.writeFile(priceWb, 'Bang_Gia_Chuan_MEP.xlsx');

    // 2. Xuất file Bảng BOQ Mẫu Công Trình
    const boqWb = XLSX.utils.book_new();
    const boqData = [
      ['STT', 'Mã Hiệu', 'Nội Dung Công Việc / Diễn Giải Vật Tư', 'Đơn Vị Tính', 'Khối Lượng']
    ];
    (window.SAMPLE_BOQ_DEMO || []).forEach(b => {
      boqData.push([b.stt, b.code, b.description, b.unit, b.quantity]);
    });
    const boqWs = XLSX.utils.aoa_to_sheet(boqData);
    XLSX.utils.book_append_sheet(boqWb, boqWs, 'BOQ_MEP');
    XLSX.writeFile(boqWb, 'BOQ_Mau_Cong_Trinh.xlsx');

    this.showToast('Đã tải xuống 2 file Excel mẫu: Bang_Gia_Chuan_MEP.xlsx và BOQ_Mau_Cong_Trinh.xlsx!', 'success');
  }

  // ==========================================
  // QUẢN LÝ MODAL & TOAST
  // ==========================================

  openModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.add('active');
  }

  closeModal(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) modal.classList.remove('active');
  }

  showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;

    const toast = document.createElement('div');
    toast.className = `toast ${type}`;

    let icon = 'ℹ️';
    if (type === 'success') icon = '✅';
    if (type === 'error') icon = '❌';
    if (type === 'warning') icon = '⚠️';

    toast.innerHTML = `<span>${icon}</span><span style="flex: 1;">${message}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

// Khởi tạo Controller toàn cục
window.appController = new AppController();

document.addEventListener('DOMContentLoaded', () => {
  window.appController.init();
});
