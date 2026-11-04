/**
 * Thuật toán Khớp mờ Chuyên biệt cho Ngành Cơ Điện (MEP Fuzzy Matching Engine)
 * Tối ưu hóa cho từ ngữ kỹ thuật tiếng Việt, thông số kích thước, tiết diện, công suất
 * Xếp hạng độ tương đồng theo % từ cao xuống thấp
 */

class FuzzyMatcher {
  constructor() {
    // Từ điển từ đồng nghĩa & viết tắt phổ biến trong ngành M&E
    this.synonyms = {
      'aptomat': ['cb', 'mcb', 'mccb', 'elcb', 'cầu dao', 'át'],
      'mcb': ['aptomat', 'cầu dao tự động', 'át tép'],
      'mccb': ['aptomat khối', 'cầu dao khối'],
      'dây': ['dây điện', 'cáp', 'cáp điện'],
      'cáp': ['dây', 'dây điện', 'cáp điện'],
      'co': ['cút', 'chếch', 'elbow', 'góc 90'],
      'cút': ['co', 'chếch', 'elbow'],
      'tê': ['ba chạc', 'tee', 'chữ t'],
      'côn thu': ['giảm', 'côn giảm', 'nối giảm', 'reducer'],
      'van cổng': ['gate valve', 'van chặn'],
      'van bi': ['ball valve'],
      'van bướm': ['butterfly valve'],
      'van 1 chiều': ['van một chiều', 'check valve'],
      'ống ppr': ['ống hàn nhiệt', 'ống nước nóng'],
      'ống upvc': ['ống pvc', 'ống thoát'],
      'ống kẽm': ['ống thép mạ kẽm', 'ống gi'],
      'miệng gió': ['cửa gió', 'diffuser', 'grille'],
      'ống gió': ['đường ống gió', 'duct'],
      'bình chữa cháy': ['bình pccc', 'bình cứu hỏa']
    };
  }

  /**
   * Chuẩn hóa chuỗi văn bản: chữ thường, bỏ ký tự đặc biệt thừa, chuẩn hóa dấu cách
   */
  normalizeText(str) {
    if (!str) return '';
    return str
      .toString()
      .toLowerCase()
      .replace(/[,\.;:!\?_\(\)\[\]\{\}\/\\-]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /**
   * Chuyển tiếng Việt có dấu sang không dấu để hỗ trợ tìm kiếm linh hoạt
   */
  removeAccents(str) {
    if (!str) return '';
    return str
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/g, 'd')
      .replace(/Đ/g, 'D');
  }

  /**
   * Trích xuất các thông số kỹ thuật cốt lõi (kích thước, tiết diện, công suất, v.v.)
   * Ví dụ: D110, DN50, 4x16mm2, 2.5mm2, 100W, 5HP...
   */
  extractSpecs(text) {
    if (!text) return [];
    const normalized = text.toLowerCase().replace(/\s+/g, '');
    const specs = [];

    // 1. Đường kính ống, van: D90, DN100, Phi 60, phi60, d110...
    const diameterRegex = /(?:dn|phi|d|ø)\s*(\d+(?:\.\d+)?)/gi;
    let match;
    while ((match = diameterRegex.exec(text)) !== null) {
      specs.push(`d${match[1]}`);
    }

    // 2. Tiết diện cáp điện: 1x2.5, 3x4+1x2.5, 4x16mm2, 2x1.5, 1.5mm2...
    const wireRegex = /(\d+x\d+(?:\.\d+)?|\d+(?:\.\d+)?mm2)/gi;
    while ((match = wireRegex.exec(text)) !== null) {
      specs.push(match[1].replace('mm2', ''));
    }

    // 3. Công suất & Dòng điện: 100w, 5kw, 10hp, 16a, 32a, 100a...
    const powerRegex = /(\d+(?:\.\d+)?(?:kw|hp|kva|w|a|v|pa|m3\/h))/gi;
    while ((match = powerRegex.exec(text)) !== null) {
      specs.push(match[1]);
    }

    return [...new Set(specs)];
  }

  /**
   * Tính khoảng cách Levenshtein giữa 2 chuỗi
   */
  levenshtein(s1, s2) {
    const l1 = s1.length;
    const l2 = s2.length;
    const d = [];

    for (let i = 0; i <= l1; i++) d[i] = [i];
    for (let j = 0; j <= l2; j++) d[0][j] = j;

    for (let i = 1; i <= l1; i++) {
      for (let j = 1; j <= l2; j++) {
        const cost = s1[i - 1] === s2[j - 1] ? 0 : 1;
        d[i][j] = Math.min(
          d[i - 1][j] + 1,      // Xóa
          d[i][j - 1] + 1,      // Chèn
          d[i - 1][j - 1] + cost // Thay thế
        );
      }
    }
    return d[l1][l2];
  }

  /**
   * Tính điểm tỉ lệ tương đồng Levenshtein (0 - 100)
   */
  levenshteinRatio(s1, s2) {
    if (!s1 && !s2) return 100;
    if (!s1 || !s2) return 0;
    const distance = this.levenshtein(s1, s2);
    const maxLen = Math.max(s1.length, s2.length);
    if (maxLen === 0) return 100;
    return Math.round((1 - distance / maxLen) * 100);
  }

  /**
   * Tính điểm tương đồng dựa trên tập từ khóa (Token Set / Jaccard Similarity)
   */
  tokenScore(text1, text2) {
    const tokens1 = new Set(this.normalizeText(text1).split(' ').filter(w => w.length > 1));
    const tokens2 = new Set(this.normalizeText(text2).split(' ').filter(w => w.length > 1));

    if (tokens1.size === 0 || tokens2.size === 0) return 0;

    let intersectionCount = 0;
    for (const t1 of tokens1) {
      if (tokens2.has(t1)) {
        intersectionCount++;
      } else {
        // Kiểm tra từ đồng nghĩa
        for (const [key, list] of Object.entries(this.synonyms)) {
          if ((t1 === key || list.includes(t1)) && Array.from(tokens2).some(t2 => t2 === key || list.includes(t2))) {
            intersectionCount += 0.85; // Điểm đồng nghĩa
            break;
          }
        }
      }
    }

    const unionCount = tokens1.size + tokens2.size - intersectionCount;
    return Math.round((intersectionCount / unionCount) * 100);
  }

  /**
   * Tính toán độ khớp tổng hợp giữa Mô tả cần tìm và Vật tư trong kho giá
   * Kết hợp:
   * 1. Token Match Score
   * 2. Levenshtein không dấu
   * 3. Kiểm tra thông số kỹ thuật (Kích thước, quy cách - yếu tố quyết định giá)
   */
  calculateSimilarity(query, material) {
    const queryNorm = this.normalizeText(query);
    const matFullText = `${material.code || ''} ${material.name || ''} ${material.spec || ''}`;
    const matNorm = this.normalizeText(matFullText);

    // 1. Nếu trùng khớp chính xác 100%
    if (queryNorm === matNorm || (material.code && queryNorm === material.code.toLowerCase())) {
      return 100;
    }

    // 2. Điểm từ khóa (Tokens)
    const tokenSim = this.tokenScore(queryNorm, matNorm);

    // 3. Điểm Levenshtein trên chuỗi không dấu
    const cleanQuery = this.removeAccents(queryNorm);
    const cleanMat = this.removeAccents(matNorm);
    const levSim = this.levenshteinRatio(cleanQuery, cleanMat);

    // 4. Kiểm tra độ khớp thông số kỹ thuật (Specs)
    const querySpecs = this.extractSpecs(query);
    const matSpecs = this.extractSpecs(matFullText);

    let specModifier = 0;
    if (querySpecs.length > 0 && matSpecs.length > 0) {
      const commonSpecs = querySpecs.filter(s => matSpecs.includes(s));
      if (commonSpecs.length === querySpecs.length) {
        // Trùng tất cả thông số cốt lõi (ví dụ đều là D110 hoặc 2.5mm2) -> Thưởng điểm lớn!
        specModifier += 20;
      } else if (commonSpecs.length > 0) {
        specModifier += 10;
      } else {
        // Có thông số nhưng khác hoàn toàn (ví dụ BOQ tìm D90 mà vật tư là D110) -> Phạt nặng!
        specModifier -= 35;
      }
    }

    // 5. Kiểm tra Đơn vị tính (ĐVT)
    let unitBonus = 0;
    if (material.unit && query) {
      const qTokens = queryNorm.split(' ');
      const unitNorm = this.normalizeText(material.unit);
      if (qTokens.includes(unitNorm)) {
        unitBonus = 5;
      }
    }

    // Tính điểm tổng hợp có trọng số
    let totalScore = Math.round(tokenSim * 0.55 + levSim * 0.45 + specModifier + unitBonus);

    // Giới hạn trong khoảng 0 - 100
    totalScore = Math.max(0, Math.min(99, totalScore));

    return totalScore;
  }

  /**
   * Tìm kiếm gợi ý tốt nhất từ danh mục vật tư
   * Trả về danh sách Top các vật tư có % khớp từ cao xuống thấp
   */
  findMatches(query, materialList, limit = 5, minThreshold = 50) {
    if (!query || !materialList || materialList.length === 0) {
      return [];
    }

    const scoredList = [];

    for (const mat of materialList) {
      const score = this.calculateSimilarity(query, mat);
      if (score >= minThreshold) {
        scoredList.push({
          material: mat,
          score: score
        });
      }
    }

    // Sắp xếp giảm dần theo điểm số %
    scoredList.sort((a, b) => b.score - a.score);

    return scoredList.slice(0, limit);
  }
}

// Khởi tạo đối tượng Khớp mờ dùng chung
window.fuzzyMatcher = new FuzzyMatcher();
