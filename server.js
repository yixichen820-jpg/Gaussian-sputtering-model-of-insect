const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const Busboy = require('busboy');

const rootDir = __dirname;
const modelsDir = path.join(rootDir, 'models');
const dataDir = path.join(rootDir, 'data');
const manifestPath = path.join(dataDir, 'models.json');
const port = Number(process.env.PORT || 4173);
const adminKey = process.env.ADMIN_KEY || 'Logenshinve';

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.ply': 'application/octet-stream',
  '.wasm': 'application/wasm',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8'
};

const seedModels = [
  {
    id: 'original-video',
    name: '原视频',
    fileName: '原视频.ply',
    originalName: 'final.ply',
    splatCount: 460668,
    center: [-1.477460493317872, 0.6474183397394051, 7.8252014425847545],
    size: [65.03194618225098, 48.72028160095215, 101.84395408630371],
    createdAt: '2026-09-21T13:21:22.000Z',
    updatedAt: '2026-09-21T13:21:22.000Z'
  },
  {
    id: 'garden-tiger-moth',
    name: '大丽灯蛾',
    fileName: '大丽灯蛾.ply',
    originalName: '大丽灯蛾final.ply',
    splatCount: 28328,
    center: [1.330281365521342, 3.684586825380101, 0.7816264259336924],
    size: [26.624978065490723, 22.238462924957275, 25.706748008728027],
    createdAt: '2026-09-21T17:20:18.000Z',
    updatedAt: '2026-09-21T17:20:18.000Z'
  }
];

fs.mkdirSync(modelsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

function loadManifest() {
  if (fs.existsSync(manifestPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
      if (parsed && Array.isArray(parsed.models)) {
        return parsed;
      }
    } catch (error) {
      console.error('Could not parse model manifest, reseeding it.', error);
    }
  }

  const manifest = { models: seedModels };
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  return manifest;
}

let manifest = loadManifest();

function saveManifest() {
  fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
}

function safeModel(model) {
  let fileSize = 0;
  if (model.fileName) {
    try {
      fileSize = fs.statSync(path.join(modelsDir, model.fileName)).size;
    } catch (error) {
      fileSize = 0;
    }
  }

  return {
    id: model.id,
    name: model.name,
    fileName: model.fileName,
    originalName: model.originalName || model.fileName,
    fileSize,
    splatCount: model.splatCount || 0,
    center: Array.isArray(model.center) ? model.center : [0, 0, 0],
    size: Array.isArray(model.size) ? model.size : [1, 1, 1],
    createdAt: model.createdAt,
    updatedAt: model.updatedAt
  };
}

function modelUrl(model) {
  return `/models/${encodeURIComponent(model.fileName)}`;
}

async function readPlyHeader(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(256 * 1024);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    const data = buffer.subarray(0, bytesRead);
    const endIndex = data.indexOf(Buffer.from('end_header\n'));

    if (endIndex < 0) {
      throw new Error('Not a valid PLY file: end_header was not found.');
    }

    return {
      header: data.subarray(0, endIndex + 11).toString('utf8'),
      dataStart: endIndex + 11
    };
  } finally {
    await handle.close();
  }
}

function parseHeaderInfo(header) {
  let vertexCount = 0;
  const properties = [];
  const lines = header.split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();
    const vertexMatch = /^element\s+vertex\s+(\d+)/i.exec(trimmed);
    if (vertexMatch) {
      vertexCount = Number(vertexMatch[1]);
    }

    const propertyMatch = /^property\s+float\s+([a-zA-Z0-9_]+)/i.exec(trimmed);
    if (propertyMatch) {
      properties.push(propertyMatch[1]);
    }
  }

  return { vertexCount, properties };
}

async function parsePlyMetadata(filePath) {
  const { header, dataStart } = await readPlyHeader(filePath);
  const { vertexCount, properties } = parseHeaderInfo(header);
  const stride = properties.length * 4;
  const xIndex = properties.indexOf('x');
  const yIndex = properties.indexOf('y');
  const zIndex = properties.indexOf('z');
  const center = [0, 0, 0];
  const size = [1, 1, 1];

  if (vertexCount > 0 && stride > 0 && xIndex >= 0 && yIndex >= 0 && zIndex >= 0) {
    const handle = await fsp.open(filePath, 'r');
    try {
      const min = [Infinity, Infinity, Infinity];
      const max = [-Infinity, -Infinity, -Infinity];
      const sampleCount = Math.min(vertexCount, 5000);
      const step = vertexCount > 1 ? (vertexCount - 1) / (sampleCount - 1) : 0;
      const record = Buffer.alloc(stride);

      for (let i = 0; i < sampleCount; i++) {
        const vertexIndex = Math.round(i * step);
        const position = dataStart + vertexIndex * stride;
        const { bytesRead } = await handle.read(record, 0, stride, position);

        if (bytesRead < stride) break;

        const x = record.readFloatLE(xIndex * 4);
        const y = record.readFloatLE(yIndex * 4);
        const z = record.readFloatLE(zIndex * 4);

        min[0] = Math.min(min[0], x);
        min[1] = Math.min(min[1], y);
        min[2] = Math.min(min[2], z);
        max[0] = Math.max(max[0], x);
        max[1] = Math.max(max[1], y);
        max[2] = Math.max(max[2], z);
      }

      for (let axis = 0; axis < 3; axis++) {
        center[axis] = (min[axis] + max[axis]) / 2;
        size[axis] = max[axis] - min[axis];
      }
    } finally {
      await handle.close();
    }
  }

  return { vertexCount, center, size };
}

function sendJson(res, statusCode, data) {
  res.writeHead(statusCode, {
    'Content-Type': 'application/json; charset=utf-8',
    'Access-Control-Allow-Origin': '*'
  });
  res.end(JSON.stringify(data));
}

function readJsonBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > 1_000_000) {
        reject(new Error('Request body is too large.'));
        req.destroy();
      }
    });
    req.on('end', () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(error);
      }
    });
    req.on('error', reject);
  });
}

function parseUpload(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: 2 * 1024 * 1024 * 1024
      }
    });
    const result = {
      fields: {},
      file: null
    };

    busboy.on('file', (fieldName, fileStream, info) => {
      const tempName = `upload-${Date.now()}-${crypto.randomUUID()}.tmp`;
      const tempPath = path.join(modelsDir, tempName);
      const writeStream = fs.createWriteStream(tempPath);
      result.file = {
        tempPath,
        writeStream,
        originalName: info.filename,
        mimeType: info.mimeType
      };

      fileStream.on('limit', () => {
        fileStream.unpipe(writeStream);
        writeStream.destroy();
        reject(new Error('上传文件超过 2GB 限制。'));
      });

      writeStream.on('error', reject);
      fileStream.pipe(writeStream);
    });

    busboy.on('field', (fieldName, value) => {
      result.fields[fieldName] = value;
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (!result.file) {
        reject(new Error('没有收到上传文件。'));
        return;
      }
      resolve(result);
    });

    req.pipe(busboy);
  });
}

async function isPlyFile(filePath) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(4);
    const { bytesRead } = await handle.read(buffer, 0, 4, 0);
    return bytesRead >= 3 && buffer.subarray(0, 3).toString('ascii') === 'ply';
  } finally {
    await handle.close();
  }
}

async function deleteTempFile(filePath) {
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') console.error(error);
  }
}

async function createModel(req, res) {
  const upload = await parseUpload(req);
  const writeStream = upload.file.writeStream;

  try {
    await new Promise((resolve, reject) => {
      if (writeStream.closed) {
        resolve();
        return;
      }
      writeStream.once('close', resolve);
      writeStream.once('error', reject);
    });

    if (!(await isPlyFile(upload.file.tempPath))) {
      throw new Error('只支持 PLY 文件。');
    }

    const metadata = await parsePlyMetadata(upload.file.tempPath);
    const id = crypto.randomUUID();
    const safeFileName = `model-${Date.now()}-${id.slice(0, 8)}.ply`;
    const finalPath = path.join(modelsDir, safeFileName);
    await fsp.rename(upload.file.tempPath, finalPath);

    const originalName = upload.file.originalName || '未命名.ply';
    const fallbackName = path.parse(originalName).name || '未命名模型';
    const now = new Date().toISOString();
    const model = safeModel({
      id,
      name: String(upload.fields.name || fallbackName).trim() || '未命名模型',
      fileName: safeFileName,
      originalName,
      splatCount: metadata.vertexCount,
      center: metadata.center,
      size: metadata.size,
      createdAt: now,
      updatedAt: now
    });

    manifest.models.unshift(model);
    saveManifest();
    sendJson(res, 201, { model: { ...model, url: modelUrl(model) } });
  } catch (error) {
    await deleteTempFile(upload.file.tempPath);
    sendJson(res, 400, { error: error.message || '上传失败。' });
  }
}

async function updateModel(req, res, id) {
  const body = await readJsonBody(req);
  const model = manifest.models.find((item) => item.id === id);

  if (!model) {
    sendJson(res, 404, { error: '模型不存在。' });
    return;
  }

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      sendJson(res, 400, { error: '模型名称不能为空。' });
      return;
    }
    model.name = name;
  }

  model.updatedAt = new Date().toISOString();
  saveManifest();
  sendJson(res, 200, { model: { ...safeModel(model), url: modelUrl(model) } });
}

async function deleteModel(req, res, id) {
  const index = manifest.models.findIndex((item) => item.id === id);

  if (index < 0) {
    sendJson(res, 404, { error: '模型不存在。' });
    return;
  }

  const [model] = manifest.models.splice(index, 1);
  saveManifest();

  if (model.fileName) {
    const filePath = path.resolve(modelsDir, model.fileName);
    const isInsideModelsDir = filePath === modelsDir || filePath.startsWith(modelsDir + path.sep);
    if (isInsideModelsDir) {
      try {
        await fsp.unlink(filePath);
      } catch (error) {
        if (error.code !== 'ENOENT') console.error(error);
      }
    }
  }

  sendJson(res, 200, { deleted: id });
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/admin/verify' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body.key === adminKey) {
      sendJson(res, 200, { ok: true });
    } else {
      sendJson(res, 200, { ok: false, error: '管理秘钥不正确。' });
    }
    return true;
  }

  if (req.method !== 'GET' && req.headers['x-admin-key'] !== adminKey) {
    sendJson(res, 401, { error: '需要输入管理秘钥后才能执行此操作。' });
    return true;
  }

  if (url.pathname === '/api/models' && req.method === 'GET') {
    const models = manifest.models.map((model) => ({
      ...safeModel(model),
      url: modelUrl(model)
    }));
    sendJson(res, 200, { models });
    return true;
  }

  if (url.pathname === '/api/models' && req.method === 'POST') {
    await createModel(req, res);
    return true;
  }

  const modelMatch = url.pathname.match(/^\/api\/models\/([^/]+)$/);
  if (modelMatch) {
    const id = decodeURIComponent(modelMatch[1]);
    if (req.method === 'PATCH') {
      await updateModel(req, res, id);
      return true;
    }
    if (req.method === 'DELETE') {
      await deleteModel(req, res, id);
      return true;
    }
  }

  return false;
}

function resolveRequestPath(urlPath) {
  const decodedPath = decodeURIComponent(urlPath);
  const relativePath = decodedPath === '/' ? 'index.html' : decodedPath.replace(/^\/+/, '');
  const resolvedPath = path.resolve(rootDir, relativePath);

  if (!resolvedPath.startsWith(rootDir + path.sep) && resolvedPath !== rootDir) {
    return null;
  }

  return resolvedPath;
}

function sendFile(req, res, filePath) {
  const stat = fs.statSync(filePath);
  const extension = path.extname(filePath).toLowerCase();
  const contentType = mimeTypes[extension] || 'application/octet-stream';
  const range = req.headers.range;

  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
  res.setHeader('Accept-Ranges', 'bytes');
  res.setHeader('Cache-Control', 'no-cache');

  if (range) {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    if (match) {
      const start = match[1] ? Number(match[1]) : 0;
      const end = match[2] ? Number(match[2]) : stat.size - 1;
      const safeEnd = Math.min(end, stat.size - 1);

      if (start > safeEnd || start >= stat.size) {
        res.writeHead(416, {
          'Content-Range': `bytes */${stat.size}`
        });
        res.end();
        return;
      }

      res.writeHead(206, {
        'Content-Type': contentType,
        'Content-Length': safeEnd - start + 1,
        'Content-Range': `bytes ${start}-${safeEnd}/${stat.size}`
      });

      const stream = fs.createReadStream(filePath, { start, end: safeEnd });
      stream.pipe(res);
      return;
    }
  }

  res.writeHead(200, {
    'Content-Type': contentType,
    'Content-Length': stat.size
  });
  fs.createReadStream(filePath).pipe(res);
}

const server = http.createServer(async (req, res) => {
  try {
    const url = new URL(req.url, `http://${req.headers.host}`);

    if (url.pathname.startsWith('/api/')) {
      const handled = await handleApi(req, res, url);
      if (handled) return;
    }

    if (url.pathname === '/admin') {
      sendFile(req, res, path.join(rootDir, 'admin.html'));
      return;
    }

    const isSensitivePath = url.pathname === '/server.js' || url.pathname === '/data' ||
      url.pathname.startsWith('/data/') || url.pathname === '/.env';
    if (isSensitivePath) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const filePath = resolveRequestPath(url.pathname);
    if (!filePath) {
      res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Forbidden');
      return;
    }

    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    if (req.method === 'HEAD') {
      const stat = fs.statSync(filePath);
      res.writeHead(200, {
        'Content-Type': mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream',
        'Content-Length': stat.size,
        'Accept-Ranges': 'bytes'
      });
      res.end();
      return;
    }

    sendFile(req, res, filePath);
  } catch (error) {
    console.error(error);
    if (!res.headersSent) {
      sendJson(res, 500, { error: '服务器处理请求时出错。' });
    } else {
      res.end();
    }
  }
});

server.listen(port, '0.0.0.0', () => {
  console.log(`Gaussian splat viewer running at http://0.0.0.0:${port}`);
});
