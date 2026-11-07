/**
 * Máy Chủ Cục Bộ & Cổng Chuyển Tiếp Google Gemini API (MEP Local Server Gateway)
 * Được xây dựng hoàn toàn bằng module chuẩn có sẵn của Node.js (http, https, fs, path, child_process).
 * Không phụ thuộc bất kỳ thư viện npm bên ngoài nào.
 * 
 * Chức năng:
 * 1. Phục vụ toàn bộ giao diện phần mềm qua giao thức HTTP chuẩn (http://localhost:3000).
 * 2. Đóng vai trò Reverse Proxy Gateway trung gian chuyển tiếp an toàn các cuộc gọi API
 *    từ trình duyệt lên máy chủ Google AI Studio (generativelanguage.googleapis.com).
 * 3. Tích hợp quản lý, kết nối và giám sát Đám Mây Cloudflare WARP trực tiếp ngay trong ứng dụng.
 * 4. Loại bỏ triệt để 100% rào cản CORS của trình duyệt và lỗi phân giải tên miền quốc tế.
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');

const DEFAULT_PORT = 3000;
const PUBLIC_DIR = __dirname;
const WARP_CLI_PATH = path.join(process.env.ProgramFiles || 'C:\\Program Files', 'Cloudflare', 'Cloudflare WARP', 'warp-cli.exe');

// Bảng ánh xạ MIME Type cho các tệp tĩnh
const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.csv': 'text/csv; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.xls': 'application/vnd.ms-excel'
};

/**
 * Kiểm tra trạng thái kết nối Cloudflare mạng Anycast
 */
function getCloudflareStatus(callback) {
  const isInstalled = fs.existsSync(WARP_CLI_PATH);

  const req = https.get('https://www.cloudflare.com/cdn-cgi/trace', { timeout: 3500 }, (res) => {
    let data = '';
    res.on('data', chunk => data += chunk);
    res.on('end', () => {
      const lines = data.split('\n');
      const trace = {};
      lines.forEach(line => {
        const idx = line.indexOf('=');
        if (idx > 0) {
          trace[line.slice(0, idx).trim()] = line.slice(idx + 1).trim();
        }
      });

      const isWarpActive = (trace.warp === 'on' || trace.warp === 'plus');
      callback(null, {
        isInstalled,
        warpActive: isWarpActive,
        ip: trace.ip || '',
        loc: trace.loc || 'VN',
        colo: trace.colo || 'HKG',
        warp: trace.warp || 'off',
        statusText: isWarpActive 
          ? 'Đang kết nối Đám Mây Cloudflare Online 100%' 
          : (isInstalled ? 'Cloudflare WARP đã cài đặt (Chưa kết nối)' : 'Chưa cài đặt Cloudflare WARP')
      });
    });
  });

  req.on('error', (err) => {
    callback(null, {
      isInstalled,
      warpActive: false,
      ip: '',
      loc: 'VN',
      colo: '',
      warp: 'error',
      statusText: isInstalled ? 'Cloudflare WARP đã cài đặt (Chưa bật)' : 'Chưa cài đặt Cloudflare WARP',
      error: err.message
    });
  });

  req.on('timeout', () => {
    req.destroy();
    callback(null, {
      isInstalled,
      warpActive: false,
      ip: '',
      loc: 'VN',
      colo: '',
      warp: 'timeout',
      statusText: 'Hết thời gian phản hồi kiểm tra Cloudflare'
    });
  });
}

/**
 * Điều khiển bật / tắt Cloudflare WARP
 */
function toggleCloudflareWarp(action, callback) {
  if (!fs.existsSync(WARP_CLI_PATH)) {
    return callback(new Error('Chưa tìm thấy tệp warp-cli.exe trên máy tính. Vui lòng bấm Cài Đặt Cloudflare WARP!'));
  }

  const cmd = (action === 'disconnect') ? 'disconnect' : 'connect';
  exec(`"${WARP_CLI_PATH}" ${cmd}`, (err, stdout, stderr) => {
    if (err) {
      console.warn('[Cloudflare WARP Warning]:', err.message);
    }
    // Chờ 1.5 giây để dịch vụ mạng áp dụng trạng thái
    setTimeout(() => {
      getCloudflareStatus(callback);
    }, 1500);
  });
}

/**
 * Kích hoạt bộ cài đặt Cloudflare WARP tự động
 */
function triggerCloudflareInstall(callback) {
  const batPath = path.join(__dirname, 'Cai_Dat_Cloudflare.bat');
  const escapedBat = batPath.replace(/\\/g, '\\\\');
  exec(`powershell -Command "Start-Process cmd.exe -ArgumentList '/c', ('\`\"' + '${escapedBat}' + '\`\"') -Verb RunAs"`, (err) => {
    if (err) {
      return callback(err);
    }
    callback(null, { success: true, message: 'Đã mở trình cài đặt Cloudflare WARP chính hãng với quyền Quản trị viên!' });
  });
}

/**
 * Xử lý chuyển tiếp yêu cầu API sang Google AI Studio
 */
function handleGoogleApiProxy(req, res) {
  // Đặt các tiêu đề CORS cho phép gọi từ bất kỳ nguồn cục bộ nào
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key, Authorization');

  // Xử lý Preflight Request (OPTIONS)
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Chuẩn bị chuyển tiếp tới generativelanguage.googleapis.com
  const options = {
    hostname: 'generativelanguage.googleapis.com',
    port: 443,
    path: req.url,
    method: req.method,
    headers: {
      'Content-Type': req.headers['content-type'] || 'application/json',
      'User-Agent': 'MEP-Pricing-Local-Gateway/2.0'
    }
  };

  // Giữ nguyên header x-goog-api-key nếu có
  if (req.headers['x-goog-api-key']) {
    options.headers['x-goog-api-key'] = req.headers['x-goog-api-key'];
  }

  const proxyReq = https.request(options, (proxyRes) => {
    // Trả về đúng mã HTTP Status và các Header cần thiết
    res.writeHead(proxyRes.statusCode, {
      'Content-Type': proxyRes.headers['content-type'] || 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*'
    });
    proxyRes.pipe(res);
  });

  proxyReq.on('error', (err) => {
    console.error('[Gateway Error] Lỗi chuyển tiếp tới Google AI:', err.message);
    res.writeHead(502, { 
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*' 
    });
    res.end(JSON.stringify({
      error: {
        code: 502,
        message: 'Không thể kết nối tới máy chủ Google AI Studio qua Gateway cục bộ: ' + err.message,
        status: 'BAD_GATEWAY'
      }
    }));
  });

  // Truyền tiếp payload từ client sang Google
  req.pipe(proxyReq);
}

/**
 * Xử lý phục vụ các tệp tĩnh (Static File Server)
 */
function handleStaticFiles(req, res) {
  let decodedUrl;
  try {
    decodedUrl = decodeURIComponent(req.url.split('?')[0]);
  } catch (e) {
    decodedUrl = req.url.split('?')[0];
  }

  let filePath = path.join(PUBLIC_DIR, decodedUrl === '/' ? 'index.html' : decodedUrl);

  // Đảm bảo không truy cập ra ngoài thư mục gốc dự án (Security Check)
  if (!filePath.startsWith(PUBLIC_DIR)) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('403 Forbidden: Không có quyền truy cập');
    return;
  }

  fs.stat(filePath, (err, stats) => {
    if (err || !stats.isFile()) {
      // Nếu là thư mục, thử tìm index.html bên trong
      if (stats && stats.isDirectory()) {
        const indexInDir = path.join(filePath, 'index.html');
        if (fs.existsSync(indexInDir)) {
          filePath = indexInDir;
        } else {
          res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
          res.end('404 Not Found: Tệp tin không tồn tại');
          return;
        }
      } else {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
        res.end('404 Not Found: Tệp tin không tồn tại');
        return;
      }
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] || 'application/octet-stream';

    res.writeHead(200, {
      'Content-Type': contentType,
      'Access-Control-Allow-Origin': '*'
    });

    const readStream = fs.createReadStream(filePath);
    readStream.pipe(res);
  });
}

/**
 * Tạo máy chủ HTTP
 */
const server = http.createServer((req, res) => {
  // CORS chung cho mọi API
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, x-goog-api-key, Authorization');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // 1. Endpoint kiểm tra sức khỏe
  if (req.url === '/api/health') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ 
      status: 'ok', 
      gateway: 'MEP-Local-Server-Gateway',
      time: new Date().toISOString() 
    }));
    return;
  }

  // 2. Endpoint kiểm tra trạng thái Cloudflare WARP
  if (req.url === '/api/cloudflare/status') {
    getCloudflareStatus((err, data) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify(data));
    });
    return;
  }

  // 3. Endpoint Bật/Tắt kết nối Cloudflare WARP
  if (req.url === '/api/cloudflare/toggle') {
    let body = '';
    req.on('data', chunk => body += chunk);
    req.on('end', () => {
      let action = 'connect';
      try {
        if (body) {
          const parsed = JSON.parse(body);
          if (parsed.action) action = parsed.action;
        }
      } catch (e) {}

      toggleCloudflareWarp(action, (err, data) => {
        if (err) {
          res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ error: err.message }));
        } else {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify(data));
        }
      });
    });
    return;
  }

  // 4. Endpoint mở trình cài đặt Cloudflare WARP
  if (req.url === '/api/cloudflare/install') {
    triggerCloudflareInstall((err, result) => {
      if (err) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ error: err.message }));
      } else {
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify(result));
      }
    });
    return;
  }

  // 5. Chuyển tiếp các cuộc gọi API của Google Gemini
  if (req.url.startsWith('/v1beta/') || req.url.startsWith('/v1/')) {
    handleGoogleApiProxy(req, res);
    return;
  }

  // 6. Phục vụ các tệp giao diện ứng dụng
  handleStaticFiles(req, res);
});

/**
 * Khởi động máy chủ với cơ chế tự động tìm cổng rảnh
 */
function startServer(port) {
  server.listen(port, () => {
    console.log(`=======================================================`);
    console.log(`🚀 Phần Mềm Áp Giá Tự Động Cơ Điện đang chạy tại:`);
    console.log(`👉 http://localhost:${port}`);
    console.log(`🛡️ Cổng Chuyển Tiếp Google AI: http://localhost:${port}/v1beta/`);
    console.log(`🌐 Tích Hợp Đám Mây Cloudflare: Có sẵn (/api/cloudflare/status)`);
    console.log(`=======================================================`);
  });

  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.warn(`Cổng ${port} đang bận, tự động chuyển sang cổng ${port + 1}...`);
      startServer(port + 1);
    } else {
      console.error('Lỗi khởi động máy chủ cục bộ:', err);
    }
  });
}

// Khởi chạy
startServer(DEFAULT_PORT);
