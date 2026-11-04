/**
 * Quản trị Cơ sở dữ liệu Cục bộ cho Ứng dụng Áp giá Cơ Điện (M&E)
 * Sử dụng IndexedDB với fallback tự động sang LocalStorage
 * Quản lý: Kho vật tư chuẩn (materials_master), Bộ nhớ quy tắc (mapping_memory), Cấu hình (settings)
 */

class DatabaseManager {
  constructor() {
    this.dbName = 'MEP_Pricing_Database';
    this.dbVersion = 3;
    this.db = null;
    this.storageKeyPrefix = 'mep_pricing_';
  }

  /**
   * Khởi tạo cơ sở dữ liệu IndexedDB
   */
  async init() {
    return new Promise((resolve, reject) => {
      if (!window.indexedDB) {
        console.warn('Trình duyệt không hỗ trợ IndexedDB, chuyển sang LocalStorage');
        resolve(this);
        return;
      }

      const request = indexedDB.open(this.dbName, this.dbVersion);

      request.onblocked = (event) => {
        console.warn('IndexedDB đang bị khóa bởi tab khác. Vui lòng đóng bớt tab cũ để hoàn tất nâng cấp DB!');
      };

      request.onerror = (event) => {
        console.error('Lỗi khi mở IndexedDB:', event.target.error);
        resolve(this); // Vẫn resolve để fallback sang LocalStorage an toàn
      };

      request.onsuccess = async (event) => {
        this.db = event.target.result;
        console.log('Khởi tạo IndexedDB thành công (v' + (this.db ? this.db.version : this.dbVersion) + ')!');

        // Lắng nghe khi có phiên bản mới ở tab khác để tự động đóng kết nối
        this.db.onversionchange = () => {
          console.warn('Cơ sở dữ liệu có phiên bản mới, tự động đóng kết nối cũ.');
          this.db.close();
        };

        // Kiểm tra và thực hiện di chuyển dữ liệu cũ (migration) nếu có
        try {
          await this.checkAndMigrateLegacyData();
        } catch (migErr) {
          console.warn('Cảnh báo di chuyển dữ liệu cũ:', migErr);
        }
        resolve(this);
      };

      request.onupgradeneeded = (event) => {
        const db = event.target.result;

        // Bảng 1: Kho danh mục giá vật tư chuẩn (materials)
        let materialStore;
        if (!db.objectStoreNames.contains('materials')) {
          materialStore = db.createObjectStore('materials', { keyPath: 'id', autoIncrement: true });
          materialStore.createIndex('code', 'code', { unique: false });
          materialStore.createIndex('name', 'name', { unique: false });
          materialStore.createIndex('system', 'system', { unique: false }); // Điện, Cấp thoát nước, HVAC
          materialStore.createIndex('supplier', 'supplier', { unique: false });
          materialStore.createIndex('catalogId', 'catalogId', { unique: false });
        } else {
          materialStore = event.target.transaction.objectStore('materials');
          if (!materialStore.indexNames.contains('catalogId')) {
            materialStore.createIndex('catalogId', 'catalogId', { unique: false });
          }
        }

        // Bảng 1.1: Quản lý các File Bảng Giá Đã Nạp (price_catalogs)
        if (!db.objectStoreNames.contains('price_catalogs')) {
          const catalogStore = db.createObjectStore('price_catalogs', { keyPath: 'id', autoIncrement: true });
          catalogStore.createIndex('fileName', 'fileName', { unique: false });
          catalogStore.createIndex('priority', 'priority', { unique: false });
          catalogStore.createIndex('isActive', 'isActive', { unique: false });
        }

        // Bảng 2: Bộ nhớ quy tắc đã học (mapping_memory)
        if (!db.objectStoreNames.contains('memory')) {
          const memoryStore = db.createObjectStore('memory', { keyPath: 'id', autoIncrement: true });
          memoryStore.createIndex('originalPhrase', 'originalPhrase', { unique: true });
          memoryStore.createIndex('materialCode', 'materialCode', { unique: false });
        }

        // Bảng 3: Cấu hình hệ thống (settings)
        if (!db.objectStoreNames.contains('settings')) {
          db.createObjectStore('settings', { keyPath: 'key' });
        }
      };
    });
  }

  /**
   * Tự động gộp dữ liệu cũ vào Catalog mặc định ban đầu nếu người dùng đã có dữ liệu trước đây
   */
  async checkAndMigrateLegacyData() {
    const catalogs = await this.getAllCatalogs();
    const materials = await this.getAllMaterials();

    if (catalogs.length === 0 && materials.length > 0) {
      console.log('Thực hiện di chuyển vật tư cũ sang Catalog mặc định ban đầu...');
      const defaultCatalog = await this.addCatalog({
        fileName: 'Bang_Gia_Hien_Huu.xlsx',
        displayName: 'Bảng Giá Chuẩn Ban Đầu',
        itemCount: materials.length,
        uploadedAt: new Date().toISOString(),
        isActive: true,
        priority: 1
      });

      // Cập nhật catalogId cho tất cả các vật tư hiện hữu
      for (const m of materials) {
        if (!m.catalogId) {
          m.catalogId = defaultCatalog.id;
          await this.updateMaterial(m);
        }
      }
    }
  }

  // ==========================================
  // 1. QUẢN LÝ CÁC FILE BẢNG GIÁ (PRICE CATALOGS)
  // ==========================================

  /**
   * Lấy toàn bộ danh sách các file bảng giá, sắp xếp theo độ ưu tiên tăng dần (1, 2, 3...)
   */
  async getAllCatalogs() {
    if (this.db && this.db.objectStoreNames.contains('price_catalogs')) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction('price_catalogs', 'readonly');
          const store = tx.objectStore('price_catalogs');
          const request = store.getAll();
          request.onsuccess = () => {
            const list = request.result || [];
            list.sort((a, b) => (a.priority || 999) - (b.priority || 999) || a.id - b.id);
            resolve(list);
          };
          request.onerror = () => reject(request.error);
        } catch (err) {
          console.warn('Lỗi khi đọc bảng price_catalogs từ IndexedDB, chuyển fallback:', err);
          const data = localStorage.getItem(this.storageKeyPrefix + 'price_catalogs');
          const list = data ? JSON.parse(data) : [];
          list.sort((a, b) => (a.priority || 999) - (b.priority || 999) || a.id - b.id);
          resolve(list);
        }
      });
    } else {
      const data = localStorage.getItem(this.storageKeyPrefix + 'price_catalogs');
      const list = data ? JSON.parse(data) : [];
      list.sort((a, b) => (a.priority || 999) - (b.priority || 999) || a.id - b.id);
      return list;
    }
  }

  /**
   * Lấy thông tin 1 file bảng giá theo ID
   */
  async getCatalog(id) {
    const list = await this.getAllCatalogs();
    return list.find(c => c.id === Number(id)) || null;
  }

  /**
   * Thêm một File Bảng Giá mới
   */
  async addCatalog(catData) {
    const existing = await this.getAllCatalogs();
    const maxPriority = existing.reduce((max, c) => Math.max(max, c.priority || 0), 0);

    const catalog = {
      fileName: catData.fileName || 'Bang_Gia.xlsx',
      displayName: catData.displayName || catData.fileName || 'Bảng Giá Mới',
      itemCount: Number(catData.itemCount) || 0,
      uploadedAt: catData.uploadedAt || new Date().toISOString(),
      priority: catData.priority !== undefined ? catData.priority : maxPriority + 1,
      isActive: catData.isActive !== undefined ? catData.isActive : true,
      notes: catData.notes || ''
    };

    if (this.db && this.db.objectStoreNames.contains('price_catalogs')) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction('price_catalogs', 'readwrite');
          const store = tx.objectStore('price_catalogs');
          const req = store.add(catalog);
          req.onsuccess = () => {
            catalog.id = req.result;
            resolve(catalog);
          };
          req.onerror = () => reject(req.error);
        } catch (err) {
          console.warn('Lỗi khi thêm catalog vào IndexedDB, chuyển fallback:', err);
          catalog.id = Date.now() + Math.floor(Math.random() * 1000);
          existing.push(catalog);
          localStorage.setItem(this.storageKeyPrefix + 'price_catalogs', JSON.stringify(existing));
          resolve(catalog);
        }
      });
    } else {
      catalog.id = Date.now() + Math.floor(Math.random() * 1000);
      existing.push(catalog);
      localStorage.setItem(this.storageKeyPrefix + 'price_catalogs', JSON.stringify(existing));
      return catalog;
    }
  }

  /**
   * Cập nhật thông tin file bảng giá (đổi tên, trạng thái kích hoạt, thứ tự ưu tiên)
   */
  async updateCatalog(catData) {
    if (this.db && this.db.objectStoreNames.contains('price_catalogs')) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction('price_catalogs', 'readwrite');
          const store = tx.objectStore('price_catalogs');
          const req = store.put(catData);
          req.onsuccess = () => resolve(true);
          req.onerror = () => reject(req.error);
        } catch (err) {
          console.warn('Lỗi khi cập nhật catalog trong IndexedDB, chuyển fallback:', err);
          this.updateCatalogInLocalStorage(catData);
          resolve(true);
        }
      });
    } else {
      this.updateCatalogInLocalStorage(catData);
      return true;
    }
  }

  updateCatalogInLocalStorage(catData) {
    const data = localStorage.getItem(this.storageKeyPrefix + 'price_catalogs');
    let list = data ? JSON.parse(data) : [];
    const idx = list.findIndex(c => c.id === catData.id);
    if (idx !== -1) {
      list[idx] = catData;
      localStorage.setItem(this.storageKeyPrefix + 'price_catalogs', JSON.stringify(list));
    }
  }

  /**
   * Bật / Tắt kích hoạt 1 file bảng giá
   */
  async toggleCatalogActive(id) {
    const catalog = await this.getCatalog(id);
    if (!catalog) return false;
    catalog.isActive = !catalog.isActive;
    await this.updateCatalog(catalog);
    return catalog.isActive;
  }

  /**
   * Thay đổi thứ tự ưu tiên của file bảng giá (đẩy lên hoặc hạ xuống)
   */
  async moveCatalogPriority(id, direction) {
    const list = await this.getAllCatalogs();
    const idx = list.findIndex(c => c.id === Number(id));
    if (idx === -1) return false;

    if (direction === 'up' && idx > 0) {
      const prev = list[idx - 1];
      const curP = list[idx].priority || (idx + 1);
      const prevP = prev.priority || idx;
      list[idx].priority = prevP;
      prev.priority = curP >= prevP ? curP + 1 : curP;
      await this.updateCatalog(list[idx]);
      await this.updateCatalog(prev);
      return true;
    } else if (direction === 'down' && idx < list.length - 1) {
      const next = list[idx + 1];
      const curP = list[idx].priority || (idx + 1);
      const nextP = next.priority || (idx + 2);
      list[idx].priority = nextP;
      next.priority = curP <= nextP ? curP - 1 : curP;
      await this.updateCatalog(list[idx]);
      await this.updateCatalog(next);
      return true;
    }
    return false;
  }

  /**
   * XÓA MỘT FILE BẢNG GIÁ RIÊNG BIỆT:
   * Xóa sạch catalog này và toàn bộ vật tư của catalog đó, tuyệt đối không ảnh hưởng file khác!
   */
  async deleteCatalog(id) {
    const catalogId = Number(id);

    if (this.db && this.db.objectStoreNames.contains('price_catalogs') && this.db.objectStoreNames.contains('materials')) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction(['price_catalogs', 'materials'], 'readwrite');
          const catStore = tx.objectStore('price_catalogs');
          const matStore = tx.objectStore('materials');

          // 1. Xóa catalog
          catStore.delete(catalogId);

          // 2. Xóa tất cả materials thuộc catalogId này
          if (matStore.indexNames.contains('catalogId')) {
            const index = matStore.index('catalogId');
            const req = index.openCursor(IDBKeyRange.only(catalogId));
            req.onsuccess = (e) => {
              const cursor = e.target.result;
              if (cursor) {
                cursor.delete();
                cursor.continue();
              }
            };
          } else {
            // Duyệt toàn bộ bảng nếu index chưa sẵn sàng
            const req = matStore.openCursor();
            req.onsuccess = (e) => {
              const cursor = e.target.result;
              if (cursor) {
                if (cursor.value.catalogId === catalogId) {
                  cursor.delete();
                }
                cursor.continue();
              }
            };
          }

          tx.oncomplete = () => resolve(true);
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          console.warn('Lỗi khi xóa catalog trong IndexedDB, chuyển fallback:', err);
          this.deleteCatalogFromLocalStorage(catalogId).then(resolve).catch(reject);
        }
      });
    } else {
      return this.deleteCatalogFromLocalStorage(catalogId);
    }
  }

  async deleteCatalogFromLocalStorage(catalogId) {
    let catalogs = await this.getAllCatalogs();
    catalogs = catalogs.filter(c => c.id !== catalogId);
    localStorage.setItem(this.storageKeyPrefix + 'price_catalogs', JSON.stringify(catalogs));

    let materials = await this.getAllMaterials();
    materials = materials.filter(m => m.catalogId !== catalogId);
    localStorage.setItem(this.storageKeyPrefix + 'materials', JSON.stringify(materials));
    return true;
  }

  // ==========================================
  // 1.1. QUẢN LÝ DANH MỤC VẬT TƯ (MATERIALS)
  // ==========================================

  /**
   * Lấy danh mục vật tư (Có thể lọc theo catalogId hoặc lấy toàn bộ)
   */
  async getAllMaterials(catalogFilter) {
    if (this.db && this.db.objectStoreNames.contains('materials')) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction('materials', 'readonly');
          const store = tx.objectStore('materials');

          if (catalogFilter && catalogFilter !== 'all' && store.indexNames.contains('catalogId')) {
            const catId = Number(catalogFilter);
            const index = store.index('catalogId');
            const request = index.getAll(IDBKeyRange.only(catId));
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = () => reject(request.error);
          } else {
            const request = store.getAll();
            request.onsuccess = () => {
              let res = request.result || [];
              if (catalogFilter && catalogFilter !== 'all') {
                res = res.filter(m => m.catalogId === Number(catalogFilter));
              }
              resolve(res);
            };
            request.onerror = () => reject(request.error);
          }
        } catch (err) {
          console.warn('Lỗi khi đọc materials từ IndexedDB, chuyển fallback:', err);
          const data = localStorage.getItem(this.storageKeyPrefix + 'materials');
          let list = data ? JSON.parse(data) : [];
          if (catalogFilter && catalogFilter !== 'all') {
            list = list.filter(m => m.catalogId === Number(catalogFilter));
          }
          resolve(list);
        }
      });
    } else {
      const data = localStorage.getItem(this.storageKeyPrefix + 'materials');
      let list = data ? JSON.parse(data) : [];
      if (catalogFilter && catalogFilter !== 'all') {
        list = list.filter(m => m.catalogId === Number(catalogFilter));
      }
      return list;
    }
  }

  /**
   * Lấy danh sách vật tư từ các File Bảng Giá đang kích hoạt (isActive = true),
   * được sắp xếp theo đúng thứ tự ưu tiên của từng file.
   */
  async getActiveMaterialsWithPriorities() {
    const allCatalogs = await this.getAllCatalogs();
    const activeCatalogs = allCatalogs.filter(c => c.isActive !== false);

    if (activeCatalogs.length === 0) {
      return [];
    }

    const allMaterials = await this.getAllMaterials('all');
    const catalogMap = new Map();
    activeCatalogs.forEach(c => catalogMap.set(c.id, c));

    // Lọc các vật tư thuộc file đang kích hoạt và gán thông tin độ ưu tiên
    const activeMaterials = [];
    for (const m of allMaterials) {
      // Nếu không có catalogId thì gán catalog đầu tiên nếu chỉ có 1 file
      const cId = m.catalogId || (activeCatalogs[0] ? activeCatalogs[0].id : null);
      if (catalogMap.has(cId)) {
        const cat = catalogMap.get(cId);
        activeMaterials.push({
          ...m,
          catalogId: cat.id,
          catalogName: cat.displayName || cat.fileName,
          catalogFileName: cat.fileName,
          catalogPriority: cat.priority !== undefined ? cat.priority : 999
        });
      }
    }

    // Sắp xếp vật tư theo thứ tự ưu tiên của file (file ưu tiên 1 trước, rồi đến 2, 3...)
    activeMaterials.sort((a, b) => a.catalogPriority - b.catalogPriority);
    return activeMaterials;
  }

  /**
   * Thêm một vật tư mới
   */
  async addMaterial(item) {
    item.createdAt = new Date().toISOString();
    item.updatedAt = new Date().toISOString();

    if (this.db && this.db.objectStoreNames.contains('materials')) {
      return new Promise((resolve, reject) => {
        try {
          const tx = this.db.transaction('materials', 'readwrite');
          const store = tx.objectStore('materials');
          const request = store.add(item);
          request.onsuccess = () => resolve(request.result);
          request.onerror = () => reject(request.error);
        } catch (err) {
          console.warn('Lỗi khi addMaterial vào IndexedDB:', err);
          this.addMaterialToLocalStorage(item).then(resolve).catch(reject);
        }
      });
    } else {
      return this.addMaterialToLocalStorage(item);
    }
  }

  async addMaterialToLocalStorage(item) {
    const list = await this.getAllMaterials();
    item.id = Date.now() + Math.floor(Math.random() * 1000);
    list.push(item);
    localStorage.setItem(this.storageKeyPrefix + 'materials', JSON.stringify(list));
    return item.id;
  }

  /**
   * Nhập hàng loạt vật tư kèm gắn mã catalogId của file bảng giá
   */
  async bulkAddMaterials(items, catalogId = null) {
    if (!items || items.length === 0) return 0;
    const now = new Date().toISOString();
    items.forEach(item => {
      if (catalogId !== null && catalogId !== undefined) {
        item.catalogId = Number(catalogId);
      }
      item.createdAt = now;
      item.updatedAt = now;
    });

    if (this.db && this.db.objectStoreNames.contains('materials')) {
      return new Promise((resolve, reject) => {
        try {
          const hasCatalogStore = Boolean(catalogId && this.db.objectStoreNames.contains('price_catalogs'));
          const storeNames = hasCatalogStore ? ['materials', 'price_catalogs'] : ['materials'];
          const tx = this.db.transaction(storeNames, 'readwrite');
          const store = tx.objectStore('materials');
          let count = 0;
          for (const item of items) {
            store.add(item);
            count++;
          }

          // Cập nhật lại số lượng itemCount trong catalog
          if (hasCatalogStore) {
            try {
              const catStore = tx.objectStore('price_catalogs');
              const getReq = catStore.get(Number(catalogId));
              getReq.onsuccess = () => {
                if (getReq.result) {
                  const cat = getReq.result;
                  cat.itemCount = (cat.itemCount || 0) + count;
                  catStore.put(cat);
                }
              };
            } catch (catErr) {
              console.warn('Lỗi cập nhật itemCount cho catalog trong bulkAddMaterials:', catErr);
            }
          }

          tx.oncomplete = () => resolve(count);
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          console.warn('Lỗi khi bulkAddMaterials vào IndexedDB, chuyển fallback:', err);
          this.bulkAddMaterialsToLocalStorage(items, catalogId).then(resolve).catch(reject);
        }
      });
    } else {
      return this.bulkAddMaterialsToLocalStorage(items, catalogId);
    }
  }

  async bulkAddMaterialsToLocalStorage(items, catalogId) {
    const list = await this.getAllMaterials();
    let startId = Date.now();
    items.forEach((item, idx) => {
      item.id = startId + idx;
      list.push(item);
    });
    localStorage.setItem(this.storageKeyPrefix + 'materials', JSON.stringify(list));

    if (catalogId) {
      const catalogs = await this.getAllCatalogs();
      const cat = catalogs.find(c => c.id === Number(catalogId));
      if (cat) {
        cat.itemCount = (cat.itemCount || 0) + items.length;
        localStorage.setItem(this.storageKeyPrefix + 'price_catalogs', JSON.stringify(catalogs));
      }
    }
    return items.length;
  }

  /**
   * Cập nhật thông tin vật tư
   */
  async updateMaterial(item) {
    item.updatedAt = new Date().toISOString();
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('materials', 'readwrite');
        const store = tx.objectStore('materials');
        const request = store.put(item);
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } else {
      let list = await this.getAllMaterials();
      const idx = list.findIndex(m => m.id === item.id);
      if (idx !== -1) {
        list[idx] = item;
        localStorage.setItem(this.storageKeyPrefix + 'materials', JSON.stringify(list));
      }
      return true;
    }
  }

  /**
   * Xóa một vật tư theo ID
   */
  async deleteMaterial(id) {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('materials', 'readwrite');
        const store = tx.objectStore('materials');
        const request = store.delete(Number(id));
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } else {
      let list = await this.getAllMaterials();
      list = list.filter(m => m.id !== id);
      localStorage.setItem(this.storageKeyPrefix + 'materials', JSON.stringify(list));
      return true;
    }
  }

  /**
   * Xóa toàn bộ danh mục vật tư & toàn bộ catalogs
   */
  async clearMaterials() {
    if (this.db && this.db.objectStoreNames.contains('materials')) {
      return new Promise((resolve, reject) => {
        try {
          const hasCatalogStore = this.db.objectStoreNames.contains('price_catalogs');
          const storeNames = hasCatalogStore ? ['materials', 'price_catalogs'] : ['materials'];
          const tx = this.db.transaction(storeNames, 'readwrite');
          tx.objectStore('materials').clear();
          if (hasCatalogStore) {
            tx.objectStore('price_catalogs').clear();
          }
          tx.oncomplete = () => {
            localStorage.removeItem(this.storageKeyPrefix + 'materials');
            localStorage.removeItem(this.storageKeyPrefix + 'price_catalogs');
            resolve(true);
          };
          tx.onerror = () => reject(tx.error);
        } catch (err) {
          console.warn('Lỗi khi xóa trong IndexedDB, chuyển xóa LocalStorage:', err);
          localStorage.removeItem(this.storageKeyPrefix + 'materials');
          localStorage.removeItem(this.storageKeyPrefix + 'price_catalogs');
          resolve(true);
        }
      });
    } else {
      localStorage.removeItem(this.storageKeyPrefix + 'materials');
      localStorage.removeItem(this.storageKeyPrefix + 'price_catalogs');
      return true;
    }
  }

  // ==========================================
  // 2. QUẢN LÝ BỘ NHỚ HỌC QUY TẮC (MAPPING MEMORY)
  // ==========================================

  /**
   * Chuẩn hóa cụm từ để tra cứu bộ nhớ (bỏ khoảng trắng thừa, chữ thường)
   */
  normalizePhrase(phrase) {
    if (!phrase) return '';
    return phrase
      .toString()
      .trim()
      .toLowerCase()
      .replace(/\s+/g, ' ');
  }

  /**
   * Tìm kiếm trong bộ nhớ xem cụm từ đã từng được kỹ sư duyệt chưa
   */
  async getMemory(phrase) {
    const cleanPhrase = this.normalizePhrase(phrase);
    if (!cleanPhrase) return null;

    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('memory', 'readonly');
        const store = tx.objectStore('memory');
        const index = store.index('originalPhrase');
        const request = index.get(cleanPhrase);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      });
    } else {
      const list = await this.getAllMemory();
      return list.find(m => m.originalPhrase === cleanPhrase) || null;
    }
  }

  /**
   * Lưu quy tắc ghi nhớ khi kỹ sư chọn hoặc xác nhận ghép giá
   */
  async saveMemory(phrase, material) {
    const cleanPhrase = this.normalizePhrase(phrase);
    if (!cleanPhrase || !material) return false;

    const memoryItem = {
      originalPhrase: cleanPhrase,
      materialId: material.id,
      materialCode: material.code || '',
      materialName: material.name || '',
      spec: material.spec || '',
      unit: material.unit || '',
      materialPrice: Number(material.materialPrice) || 0,
      laborPrice: Number(material.laborPrice) || 0,
      system: material.system || '',
      updatedAt: new Date().toISOString()
    };

    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('memory', 'readwrite');
        const store = tx.objectStore('memory');
        const index = store.index('originalPhrase');
        const getReq = index.get(cleanPhrase);

        getReq.onsuccess = () => {
          if (getReq.result) {
            memoryItem.id = getReq.result.id;
            store.put(memoryItem);
          } else {
            store.add(memoryItem);
          }
          resolve(true);
        };
        getReq.onerror = () => {
          store.put(memoryItem);
          resolve(true);
        };
      });
    } else {
      let list = await this.getAllMemory();
      const idx = list.findIndex(m => m.originalPhrase === cleanPhrase);
      if (idx !== -1) {
        memoryItem.id = list[idx].id;
        list[idx] = memoryItem;
      } else {
        memoryItem.id = Date.now();
        list.push(memoryItem);
      }
      localStorage.setItem(this.storageKeyPrefix + 'memory', JSON.stringify(list));
      return true;
    }
  }

  /**
   * Lấy toàn bộ danh sách bộ nhớ quy tắc
   */
  async getAllMemory() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('memory', 'readonly');
        const store = tx.objectStore('memory');
        const request = store.getAll();
        request.onsuccess = () => resolve(request.result || []);
        request.onerror = () => reject(request.error);
      });
    } else {
      const data = localStorage.getItem(this.storageKeyPrefix + 'memory');
      return data ? JSON.parse(data) : [];
    }
  }

  /**
   * Xóa một quy tắc ghi nhớ theo ID
   */
  async deleteMemory(id) {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('memory', 'readwrite');
        const store = tx.objectStore('memory');
        const request = store.delete(Number(id));
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } else {
      let list = await this.getAllMemory();
      list = list.filter(m => m.id !== id);
      localStorage.setItem(this.storageKeyPrefix + 'memory', JSON.stringify(list));
      return true;
    }
  }

  /**
   * Xóa toàn bộ bộ nhớ học
   */
  async clearMemory() {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('memory', 'readwrite');
        const store = tx.objectStore('memory');
        const request = store.clear();
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } else {
      localStorage.removeItem(this.storageKeyPrefix + 'memory');
      return true;
    }
  }

  // ==========================================
  // 3. QUẢN LÝ CẤU HÌNH HỆ THỐNG (SETTINGS)
  // ==========================================

  /**
   * Lấy toàn bộ cấu hình hệ thống
   */
  async getSettings() {
    const defaultSettings = {
      geminiApiKey: '',
      geminiModel: 'gemini-2.0-flash',
      minFuzzyThreshold: 60, // Ngưỡng tối thiểu đề xuất gợi ý (%)
      autoMatchThreshold: 88, // Ngưỡng tự động chấp nhận giá cao (%)
      theme: 'dark', // Giao diện tối mặc định hiện đại
      defaultLaborRatio: 0.25, // Tỉ lệ nhân công mặc định nếu nội suy
      maxSuggestions: 4 // Số lượng gợi ý hiển thị
    };

    if (this.db) {
      return new Promise((resolve) => {
        const tx = this.db.transaction('settings', 'readonly');
        const store = tx.objectStore('settings');
        const request = store.get('app_config');
        request.onsuccess = () => {
          if (request.result && request.result.value) {
            const cfg = { ...defaultSettings, ...request.result.value };
            if (cfg.geminiModel === 'gemini-3.8-flash' || cfg.geminiModel === 'gemini-2.5-flash') {
              cfg.geminiModel = 'gemini-2.0-flash';
            }
            resolve(cfg);
          } else {
            resolve(defaultSettings);
          }
        };
        request.onerror = () => resolve(defaultSettings);
      });
    } else {
      const data = localStorage.getItem(this.storageKeyPrefix + 'settings');
      if (!data) return defaultSettings;
      const cfg = { ...defaultSettings, ...JSON.parse(data) };
      if (cfg.geminiModel === 'gemini-3.8-flash' || cfg.geminiModel === 'gemini-2.5-flash') {
        cfg.geminiModel = 'gemini-2.0-flash';
      }
      return cfg;
    }
  }

  /**
   * Lưu cấu hình hệ thống
   */
  async saveSettings(settings) {
    if (this.db) {
      return new Promise((resolve, reject) => {
        const tx = this.db.transaction('settings', 'readwrite');
        const store = tx.objectStore('settings');
        const request = store.put({ key: 'app_config', value: settings });
        request.onsuccess = () => resolve(true);
        request.onerror = () => reject(request.error);
      });
    } else {
      localStorage.setItem(this.storageKeyPrefix + 'settings', JSON.stringify(settings));
      return true;
    }
  }

  // ==========================================
  // 4. SAO LƯU & PHỤC HỒI DỮ LIỆU (BACKUP & RESTORE)
  // ==========================================

  /**
   * Xuất toàn bộ dữ liệu ra tệp JSON sao lưu
   */
  async exportBackup() {
    const catalogs = await this.getAllCatalogs();
    const materials = await this.getAllMaterials();
    const memory = await this.getAllMemory();
    const settings = await this.getSettings();

    return JSON.stringify({
      version: '2.0',
      exportedAt: new Date().toISOString(),
      catalogs,
      materials,
      memory,
      settings: { ...settings, geminiApiKey: '' } // Không xuất API Key để đảm bảo an toàn
    }, null, 2);
  }

  /**
   * Nhập dữ liệu phục hồi từ tệp JSON
   */
  async importBackup(jsonString) {
    try {
      const data = JSON.parse(jsonString);
      if (Array.isArray(data.catalogs)) {
        await this.clearAllCatalogs ? this.clearAllCatalogs() : this.clearMaterials();
        for (const cat of data.catalogs) {
          await this.addCatalog(cat);
        }
      }
      if (Array.isArray(data.materials)) {
        if (!Array.isArray(data.catalogs)) {
          await this.clearMaterials();
        }
        await this.bulkAddMaterials(data.materials);
      }
      if (Array.isArray(data.memory)) {
        await this.clearMemory();
        for (const m of data.memory) {
          delete m.id;
          await this.saveMemory(m.originalPhrase, m);
        }
      }
      return { 
        success: true, 
        catalogCount: data.catalogs?.length || 0,
        materialCount: data.materials?.length || 0, 
        memoryCount: data.memory?.length || 0 
      };
    } catch (e) {
      console.error('Lỗi khi nạp dữ liệu sao lưu:', e);
      return { success: false, error: e.message };
    }
  }
}

// Khởi tạo đối tượng CSDL dùng chung toàn hệ thống
window.dbManager = new DatabaseManager();
