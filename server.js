const http = require('http');
const https = require('https');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const Busboy = require('busboy');
require('dotenv').config();

let OSS;
try {
  OSS = require('ali-oss');
} catch (error) {
  OSS = null;
}

const rootDir = __dirname;
const modelsDir = path.join(rootDir, 'models');
const thumbnailsDir = path.join(rootDir, 'thumbs');
const dataDir = path.join(rootDir, 'data');
const manifestPath = path.join(dataDir, 'models.json');
const taxonomyPath = path.join(dataDir, 'taxonomy.json');
const port = Number(process.env.PORT || 4173);
const adminKey = process.env.ADMIN_KEY || '';
if (!adminKey || adminKey === 'Logenshinve') {
  console.error('ADMIN_KEY 未配置或仍使用公开示例值，服务器拒绝启动。');
  process.exit(1);
}

const ossRegion = process.env.OSS_REGION || '';
const ossBucket = process.env.OSS_BUCKET || '';
const ossAccessKeyId = process.env.OSS_ACCESS_KEY_ID || '';
const ossAccessKeySecret = process.env.OSS_ACCESS_KEY_SECRET || '';
const ossPrefix = (process.env.OSS_PREFIX || 'models').replace(/^\/+|\/+$/g, '');
const ossBaseUrl = (process.env.OSS_BASE_URL || `https://${ossBucket}.${ossRegion}.aliyuncs.com`).replace(/\/+$/, '');
const ossEnabled = Boolean(OSS && ossRegion && ossBucket && ossAccessKeyId && ossAccessKeySecret);
let ossClient = null;

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
  '.webp': 'image/webp',
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

const seedTaxonomy = [
  { id: 'order-coleoptera', name: '鞘翅目', rank: 'order', parentId: null, keyText: '前翅角质硬化，形成鞘翅；后翅膜质，静止时折叠于鞘翅下。', sortOrder: 1 },
  { id: 'order-hemiptera', name: '半翅目', rank: 'order', parentId: null, keyText: '口器刺吸式；前翅基部革质，端部膜质，静止时平覆背上。', sortOrder: 2 },
  { id: 'order-lepidoptera', name: '鳞翅目', rank: 'order', parentId: null, keyText: '体翅密被鳞片；口器虹吸式，多数种类翅色斑纹鲜明。', sortOrder: 3 },
  { id: 'order-neuroptera', name: '脉翅目', rank: 'order', parentId: null, keyText: '两对膜质翅，翅脉多而呈网状；口器咀嚼式。', sortOrder: 4 },
  { id: 'order-odonata', name: '蜻蜓目', rank: 'order', parentId: null, keyText: '复眼发达；翅长而窄，膜质透明，翅脉网状。', sortOrder: 5 },
  { id: 'order-hymenoptera', name: '膜翅目', rank: 'order', parentId: null, keyText: '两对膜质翅，后翅小于前翅；雌虫常具产卵器。', sortOrder: 6 },
  { id: 'order-diptera', name: '双翅目', rank: 'order', parentId: null, keyText: '仅一对前翅发达；后翅退化为平衡棒。', sortOrder: 7 },
  { id: 'order-blattodea', name: '蜚蠊目', rank: 'order', parentId: null, keyText: '体扁平，前胸背板宽大；前翅革质，后翅膜质。', sortOrder: 8 },
  { id: 'order-dermaptera', name: '革翅目', rank: 'order', parentId: null, keyText: '腹末具坚硬铗状尾须；前翅短小革质，后翅膜质。', sortOrder: 9 },
  { id: 'order-mantodea', name: '螳螂目', rank: 'order', parentId: null, keyText: '前足为捕捉足；前胸细长，头部灵活。', sortOrder: 10 },
  { id: 'order-phasmatodea', name: '䗛目', rank: 'order', parentId: null, keyText: '体形细长如枝，翅常退化或缺失；具拟态。', sortOrder: 11 },
  { id: 'order-orthoptera', name: '直翅目', rank: 'order', parentId: null, keyText: '后足常为跳跃足；前翅狭长革质，后翅膜质。', sortOrder: 12 },
  { id: 'order-unknown', name: '未知目', rank: 'order', parentId: null, keyText: '尚未确定分类或暂未归入已知目。', sortOrder: 13 }
];

const baseRankCatalog = [
  { id: 'rank-kingdom', key: 'kingdom', name: '界', nameLatin: 'Regnum', position: 10, base: true, active: true },
  { id: 'rank-phylum', key: 'phylum', name: '门', nameLatin: 'Phylum', position: 20, base: true, active: true },
  { id: 'rank-class', key: 'class', name: '纲', nameLatin: 'Classis', position: 30, base: true, active: true },
  { id: 'rank-order', key: 'order', name: '目', nameLatin: 'Ordo', position: 40, base: true, active: true },
  { id: 'rank-family', key: 'family', name: '科', nameLatin: 'Familia', position: 50, base: true, active: true },
  { id: 'rank-genus', key: 'genus', name: '属', nameLatin: 'Genus', position: 60, base: true, active: true },
  { id: 'rank-species', key: 'species', name: '种', nameLatin: 'Species', position: 70, base: true, active: true }
];

fs.mkdirSync(modelsDir, { recursive: true });
fs.mkdirSync(thumbnailsDir, { recursive: true });
fs.mkdirSync(dataDir, { recursive: true });

function parseJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJsonAtomic(filePath, data) {
  const directory = path.dirname(filePath);
  const tempPath = path.join(
    directory,
    `.${path.basename(filePath)}.${process.pid}.${Date.now()}.${crypto.randomUUID()}.tmp`
  );

  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), 'utf8');

  try {
    fs.renameSync(tempPath, filePath);
  } catch (error) {
    try {
      fs.unlinkSync(tempPath);
    } catch (cleanupError) {
      console.error(`清理临时 JSON 文件失败: ${tempPath}`, cleanupError);
    }
    throw error;
  }
}

function loadManifest() {
  if (fs.existsSync(manifestPath)) {
    try {
      const parsed = parseJsonFile(manifestPath);
      if (parsed && Array.isArray(parsed.models)) {
        return parsed;
      }
      throw new Error('models.json 缺少 models 数组。');
    } catch (error) {
      throw new Error(`无法读取或解析模型数据文件 ${manifestPath}，已停止启动以保护原文件。原始错误: ${error.message}`);
    }
  }

  const manifest = { models: seedModels };
  writeJsonAtomic(manifestPath, manifest);
  return manifest;
}

let manifest = loadManifest();

function saveManifest() {
  writeJsonAtomic(manifestPath, manifest);
}

function normalizeLegacyTaxonomy(parsed) {
  const rankCatalog = baseRankCatalog.map((entry) => ({ ...entry }));
  const entries = (parsed.entries || []).map((entry) => {
    const rankKey = entry.rankKey || entry.rank || 'order';
    const identificationSummary = entry.identificationSummary || entry.keyText || '';
    return {
      ...entry,
      rankKey,
      nameLatin: entry.nameLatin || '',
      intro: entry.intro || '',
      classificationBasis: entry.classificationBasis || '',
      identificationSummary,
      active: entry.active !== false,
      classificationStatus: entry.classificationStatus || 'confirmed'
    };
  });

  return {
    schemaVersion: 2,
    rankCatalog,
    entries
  };
}

function loadTaxonomy() {
  if (fs.existsSync(taxonomyPath)) {
    try {
      const parsed = parseJsonFile(taxonomyPath);
      if (!parsed || !Array.isArray(parsed.entries)) {
        throw new Error('taxonomy.json 缺少 entries 数组。');
      }

      if (parsed.schemaVersion === 2 && Array.isArray(parsed.rankCatalog)) {
        return parsed;
      }

      return normalizeLegacyTaxonomy(parsed);
    } catch (error) {
      throw new Error(`无法读取或解析分类数据文件 ${taxonomyPath}，已停止启动以保护原文件。原始错误: ${error.message}`);
    }
  }

  const now = new Date().toISOString();
  const taxonomy = {
    schemaVersion: 2,
    rankCatalog: baseRankCatalog.map((entry) => ({ ...entry })),
    entries: seedTaxonomy.map((entry) => ({
      ...entry,
      rankKey: entry.rank,
      nameLatin: '',
      intro: '',
      classificationBasis: '',
      identificationSummary: entry.keyText || '',
      active: true,
      classificationStatus: 'confirmed',
      createdAt: now,
      updatedAt: now
    }))
  };
  writeJsonAtomic(taxonomyPath, taxonomy);
  return taxonomy;
}

let taxonomyManifest = loadTaxonomy();

function saveTaxonomy() {
  writeJsonAtomic(taxonomyPath, taxonomyManifest);
}

const taxonomyRankCatalog = taxonomyManifest.rankCatalog || baseRankCatalog;

function getRankPosition(rankKey) {
  const rank = taxonomyRankCatalog.find((entry) => entry.key === rankKey);
  return rank ? Number(rank.position) : -1;
}

function getRankLabel(rankKey) {
  const rank = taxonomyRankCatalog.find((entry) => entry.key === rankKey);
  return rank ? rank.name : rankKey;
}

function getTaxonomyEntry(id) {
  return taxonomyManifest.entries.find((entry) => entry.id === id) || null;
}

function previousBaseRankKey(rankKey) {
  const bases = taxonomyRankCatalog
    .filter((rank) => rank.base)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const index = bases.findIndex((rank) => rank.key === rankKey);
  return index > 0 ? bases[index - 1].key : null;
}

function createPendingTaxonomyEntry(rankKey, parentId) {
  const id = `pending-${crypto.randomUUID()}`;
  const now = new Date().toISOString();
  const entry = {
    id,
    name: '待补充',
    nameLatin: '',
    code: '',
    rankKey,
    parentId: parentId || null,
    intro: '',
    classificationBasis: '',
    identificationSummary: '',
    active: true,
    classificationStatus: 'pending',
    sortOrder: 1,
    createdAt: now,
    updatedAt: now
  };
  taxonomyManifest.entries.push(entry);
  return entry;
}

function ensureAncestorPathForEntry(entryId) {
  const entry = getTaxonomyEntry(entryId);
  if (!entry) return;

  const visited = new Set();
  let current = entry;
  while (current && (current.rankKey || current.rank) !== 'kingdom' && !visited.has(current.id)) {
    visited.add(current.id);
    const parent = current.parentId ? getTaxonomyEntry(current.parentId) : null;
    if (parent) {
      current = parent;
      continue;
    }

    const parentRank = previousBaseRankKey(current.rankKey || current.rank);
    if (!parentRank) break;
    const placeholder = createPendingTaxonomyEntry(parentRank, null);
    current.parentId = placeholder.id;
    current = placeholder;
  }

  saveTaxonomy();
}

const codeAbbrMap = {
  '动物界': 'DWJ',
  '节肢动物门': 'JZDM',
  '昆虫纲': 'KCG',
  '鞘翅目': 'QCM',
  '半翅目': 'BCM',
  '鳞翅目': 'LCM',
  '脉翅目': 'MCM',
  '蜻蜓目': 'QTM',
  '膜翅目': 'MCM',
  '双翅目': 'SCM',
  '蜚蠊目': 'FLM',
  '革翅目': 'GCM',
  '螳螂目': 'TLM',
  '䗛目': 'XMM',
  '直翅目': 'ZCM',
  '未知目': 'WZM'
};

function codePrefix(name) {
  return codeAbbrMap[name] || 'TAX';
}

function generateTaxonomyCode(parentId, rankKey, name) {
  const position = getRankPosition(rankKey);
  if (position < 0) return '';
  const siblings = taxonomyManifest.entries.filter((entry) => (entry.parentId || null) === (parentId || null));
  const seq = siblings.length + 1;
  const ownCode = `${codePrefix(name)}:${position}-${String(seq).padStart(3, '0')}`;
  const parent = getTaxonomyEntry(parentId);
  return parent?.code ? `${parent.code}/${ownCode}` : ownCode;
}

function isCodeAvailable(code, existingId = null) {
  const normalized = String(code || '').trim();
  if (!normalized) return true;
  return !taxonomyManifest.entries.some((entry) => entry.id !== existingId && entry.code === normalized);
}

function taxonomyName(id) {
  const entry = getTaxonomyEntry(id);
  return entry ? entry.name : '';
}

function getTaxonomyChildren(parentId) {
  return taxonomyManifest.entries
    .filter((entry) => entry.parentId === parentId)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function safeTaxonomy(entry) {
  if (!entry) return null;
  const rankKey = entry.rankKey || entry.rank || 'order';
  const identificationSummary = entry.identificationSummary || entry.keyText || '';
  return {
    id: entry.id,
    name: entry.name,
    code: entry.code || '',
    rank: rankKey,
    rankKey,
    rankLabel: getRankLabel(rankKey),
    rankPosition: getRankPosition(rankKey),
    parentId: entry.parentId || null,
    keyText: identificationSummary,
    nameLatin: entry.nameLatin || '',
    intro: entry.intro || '',
    classificationBasis: entry.classificationBasis || '',
    identificationSummary,
    needsChineseName: Boolean(entry.needsChineseName),
    active: entry.active !== false,
    classificationStatus: entry.classificationStatus || 'confirmed',
    sortOrder: Number.isFinite(Number(entry.sortOrder)) ? Number(entry.sortOrder) : 0,
    createdAt: entry.createdAt,
    updatedAt: entry.updatedAt
  };
}

function modelCountForTaxonomy(id) {
  return manifest.models.filter((model) => model.taxonomyId === id).length;
}

function getOssClient() {
  if (!ossEnabled) return null;
  if (!ossClient) {
    ossClient = new OSS({
      region: ossRegion,
      accessKeyId: ossAccessKeyId,
      accessKeySecret: ossAccessKeySecret,
      bucket: ossBucket
    });
  }
  return ossClient;
}

function ossObjectKey(fileName) {
  return ossPrefix ? `${ossPrefix}/${fileName}` : fileName;
}

function ossObjectUrl(fileName) {
  return `${ossBaseUrl}/${ossObjectKey(fileName).split('/').map(encodeURIComponent).join('/')}`;
}

function proxiedThumbnailUrl(value) {
  if (!isAllowedThumbnailUrl(value)) return value;
  return `/api/thumbnail-proxy?url=${encodeURIComponent(value)}`;
}

function isAllowedThumbnailUrl(value) {
  try {
    const target = new URL(value);
    return target.protocol === 'https:' &&
      /^[a-z0-9.-]+\.aliyuncs\.com$/i.test(target.hostname) &&
      /\.(jpe?g|png|webp)$/i.test(target.pathname);
  } catch (error) {
    return false;
  }
}

function proxyThumbnail(req, res, sourceUrl) {
  if (!isAllowedThumbnailUrl(sourceUrl)) {
    sendJson(res, 400, { error: '缩略图地址无效。' });
    return;
  }

  const upstream = https.get(sourceUrl, {
    headers: {
      Accept: 'image/avif,image/webp,image/png,image/jpeg'
    }
  }, (response) => {
    const contentType = String(response.headers['content-type'] || '');
    const contentLength = Number(response.headers['content-length']) || 0;
    if (response.statusCode !== 200 || !contentType.startsWith('image/')) {
      response.resume();
      sendJson(res, 502, { error: '缩略图读取失败。' });
      return;
    }
    if (contentLength > 8 * 1024 * 1024) {
      response.resume();
      sendJson(res, 413, { error: '缩略图文件过大。' });
      return;
    }

    res.writeHead(200, {
      'Content-Type': contentType,
      'Content-Length': contentLength || undefined,
      'Cache-Control': 'public, max-age=86400',
      'Access-Control-Allow-Origin': '*',
      'Cross-Origin-Resource-Policy': 'cross-origin'
    });
    response.pipe(res);
  });

  upstream.setTimeout(15000, () => {
    upstream.destroy(new Error('缩略图请求超时。'));
  });
  upstream.on('error', (error) => {
    console.error(error);
    if (!res.headersSent) sendJson(res, 502, { error: '缩略图读取失败。' });
    else res.end();
  });
}

function modelThumbnailUrl(model) {
  if (model.thumbnail) return proxiedThumbnailUrl(model.thumbnail);
  if (model.thumbnailUrl) return proxiedThumbnailUrl(model.thumbnailUrl);
  if (model.thumbnailFileName) {
    if (model.thumbnailStorage === 'oss') {
      return proxiedThumbnailUrl(ossObjectUrl(model.thumbnailFileName));
    }
    return `/thumbs/${encodeURIComponent(model.thumbnailFileName)}`;
  }

  const legacyName = `${model.id || ''}.jpg`;
  const legacyPath = path.resolve(thumbnailsDir, legacyName);
  const isInsideThumbnailsDir = legacyPath.startsWith(thumbnailsDir + path.sep);
  if (isInsideThumbnailsDir && fs.existsSync(legacyPath)) {
    return `/thumbs/${encodeURIComponent(legacyName)}`;
  }
  return '/thumbs/placeholder.svg';
}

function safeModel(model) {
  let fileSize = 0;
  if (Number.isFinite(Number(model.fileSize))) {
    fileSize = Number(model.fileSize);
  } else if (model.fileName) {
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
    intro: model.intro || '',
    taxonomyId: model.taxonomyId || null,
    taxonomyName: taxonomyName(model.taxonomyId),
    storage: model.storage || 'local',
    thumbnail: modelThumbnailUrl(model),
    thumbnailFileName: model.thumbnailFileName || '',
    thumbnailStorage: model.thumbnailStorage || '',
    thumbnailFileSize: model.thumbnailFileSize || 0,
    createdAt: model.createdAt,
    updatedAt: model.updatedAt,
    attribution: model.attribution || { collector: '', identifier: '', builder: '' },
    attributionLog: Array.isArray(model.attributionLog) ? model.attributionLog : []
  };
}

function modelUrl(model) {
  if (model.url) {
    return model.url;
  }

  if (model.storage === 'oss' && model.fileName) {
    return ossObjectUrl(model.fileName);
  }
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

const MAX_THUMBNAIL_SIZE_BYTES = 8 * 1024 * 1024;

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
      if (fieldName !== 'file') {
        fileStream.resume();
        return;
      }
      if (result.file) {
        fileStream.resume();
        reject(new Error('一次只能上传一个模型文件。'));
        return;
      }

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

function parseThumbnailUpload(req) {
  return new Promise((resolve, reject) => {
    const busboy = Busboy({
      headers: req.headers,
      limits: {
        files: 1,
        fileSize: MAX_THUMBNAIL_SIZE_BYTES
      }
    });
    let thumbnail = null;

    busboy.on('file', (fieldName, fileStream, info) => {
      if (fieldName !== 'thumbnail') {
        fileStream.resume();
        return;
      }
      if (thumbnail) {
        fileStream.resume();
        reject(new Error('一次只能上传一张缩略图。'));
        return;
      }

      const tempPath = path.join(modelsDir, `thumb-upload-${Date.now()}-${crypto.randomUUID()}.tmp`);
      const writeStream = fs.createWriteStream(tempPath);
      thumbnail = {
        tempPath,
        writeStream,
        originalName: info.filename,
        mimeType: info.mimeType
      };

      fileStream.on('limit', () => {
        fileStream.unpipe(writeStream);
        writeStream.destroy();
        reject(new Error('缩略图不能超过 8MB。'));
      });
      writeStream.on('error', reject);
      fileStream.pipe(writeStream);
    });

    busboy.on('error', reject);
    busboy.on('finish', () => {
      if (!thumbnail) {
        reject(new Error('没有收到缩略图文件。'));
        return;
      }
      resolve({ thumbnail });
    });
    req.pipe(busboy);
  });
}

const SUPPORTED_MODEL_EXTENSIONS = ['.ply', '.spz', '.splat', '.ksplat'];

function modelFileType(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  return SUPPORTED_MODEL_EXTENSIONS.includes(ext) ? ext : null;
}

const SUPPORTED_THUMBNAIL_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function thumbnailFileType(originalName) {
  const ext = path.extname(originalName || '').toLowerCase();
  if (!SUPPORTED_THUMBNAIL_EXTENSIONS.includes(ext)) return null;
  return ext === '.jpeg' ? '.jpg' : ext;
}

function thumbnailMimeType(ext) {
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  return 'image/jpeg';
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

async function isThumbnailFile(filePath, ext) {
  const handle = await fsp.open(filePath, 'r');
  try {
    const buffer = Buffer.alloc(12);
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, 0);
    if (ext === '.png') {
      return bytesRead >= 8 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]));
    }
    if (ext === '.webp') {
      return bytesRead >= 12 &&
        buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
        buffer.subarray(8, 12).toString('ascii') === 'WEBP';
    }
    return bytesRead >= 3 &&
      buffer[0] === 0xff &&
      buffer[1] === 0xd8 &&
      buffer[2] === 0xff;
  } finally {
    await handle.close();
  }
}

function waitForUploadWrite(stream) {
  return new Promise((resolve, reject) => {
    if (stream.closed) {
      resolve();
      return;
    }
    stream.once('close', resolve);
    stream.once('error', reject);
  });
}

async function removeStoredUpload(storage, fileName, directory) {
  if (!fileName) return;
  if (storage === 'oss' && ossEnabled) {
    await getOssClient().delete(ossObjectKey(fileName));
    return;
  }

  const filePath = path.resolve(directory, fileName);
  const isInsideDirectory = filePath === directory || filePath.startsWith(directory + path.sep);
  if (!isInsideDirectory) {
    throw new Error(`拒绝删除目录之外的文件: ${filePath}`);
  }
  try {
    await fsp.unlink(filePath);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
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
  const storage = ossEnabled ? 'oss' : 'local';
  let safeFileName = null;
  let modelStored = false;
  let committed = false;

  try {
    await waitForUploadWrite(upload.file.writeStream);

    const ext = modelFileType(upload.file.originalName);
    if (!ext) {
      throw new Error('只支持 PLY / SPZ / SPLAT / KSPLAT 文件。');
    }
    if (ext === '.ply' && !(await isPlyFile(upload.file.tempPath))) {
      throw new Error('PLY 文件内容无效。');
    }

    const metadata = ext === '.ply'
      ? await parsePlyMetadata(upload.file.tempPath)
      : { vertexCount: 0, center: [0, 0, 0], size: [1, 1, 1] };
    const id = crypto.randomUUID();
    safeFileName = `model-${Date.now()}-${id.slice(0, 8)}${ext}`;
    const fileSize = fs.statSync(upload.file.tempPath).size;

    if (ossEnabled) {
      await getOssClient().put(ossObjectKey(safeFileName), fs.createReadStream(upload.file.tempPath), {
        mime: 'application/octet-stream'
      });
      modelStored = true;
    } else {
      await fsp.rename(upload.file.tempPath, path.join(modelsDir, safeFileName));
      modelStored = true;
    }

    const originalName = upload.file.originalName || '未命名模型';
    const fallbackName = path.parse(originalName).name || '未命名模型';
    const now = new Date().toISOString();
    const modelRecord = {
      id,
      name: String(upload.fields.name || fallbackName).trim() || '未命名模型',
      fileName: safeFileName,
      originalName,
      fileSize,
      splatCount: metadata.vertexCount,
      center: metadata.center,
      size: metadata.size,
      intro: '',
      storage,
      createdAt: now,
      updatedAt: now
    };
    const model = safeModel(modelRecord);

    const previousModels = manifest.models;
    manifest.models.unshift(modelRecord);
    try {
      saveManifest();
    } catch (error) {
      manifest.models = previousModels;
      throw error;
    }
    committed = true;

    if (ossEnabled) {
      await deleteTempFile(upload.file.tempPath);
    }

    sendJson(res, 201, { model: { ...model, url: modelUrl(modelRecord) } });
  } catch (error) {
    console.error('模型上传失败:', error);
    await deleteTempFile(upload.file.tempPath);

    if (!committed) {
      if (modelStored && safeFileName) {
        try {
          await removeStoredUpload(storage, safeFileName, modelsDir);
        } catch (cleanupError) {
          console.error('模型文件清理失败:', cleanupError);
        }
      }
    }
    sendJson(res, 400, { error: error.message || '上传失败。' });
  }
}

function thumbnailSnapshot(model) {
  return {
    thumbnail: model.thumbnail,
    thumbnailUrl: model.thumbnailUrl,
    thumbnailFileName: model.thumbnailFileName,
    thumbnailStorage: model.thumbnailStorage,
    thumbnailFileSize: model.thumbnailFileSize,
    updatedAt: model.updatedAt
  };
}

function restoreThumbnailSnapshot(model, snapshot) {
  for (const [key, value] of Object.entries(snapshot)) {
    if (value === undefined) {
      delete model[key];
    } else {
      model[key] = value;
    }
  }
}

async function replaceModelThumbnail(req, res, id) {
  const model = manifest.models.find((item) => item.id === id);
  if (!model) {
    sendJson(res, 404, { error: '模型不存在。' });
    return;
  }

  const upload = await parseThumbnailUpload(req);
  const previousThumbnail = thumbnailSnapshot(model);
  const storage = ossEnabled ? 'oss' : 'local';
  const oldThumbnailFileName = model.thumbnailFileName || '';
  const oldThumbnailStorage = model.thumbnailStorage || model.storage || 'local';
  let safeThumbnailFileName = null;
  let thumbnailStored = false;
  let committed = false;

  try {
    await waitForUploadWrite(upload.thumbnail.writeStream);
    const thumbnailFileSize = fs.statSync(upload.thumbnail.tempPath).size;
    if (thumbnailFileSize > MAX_THUMBNAIL_SIZE_BYTES) {
      throw new Error('缩略图不能超过 8MB。');
    }

    const thumbnailExt = thumbnailFileType(upload.thumbnail.originalName);
    if (!thumbnailExt) {
      throw new Error('缩略图只支持 JPG / PNG / WEBP 文件。');
    }
    if (!(await isThumbnailFile(upload.thumbnail.tempPath, thumbnailExt))) {
      throw new Error('缩略图内容与文件格式不匹配。');
    }

    safeThumbnailFileName = `thumb-${Date.now()}-${id.slice(0, 8)}${thumbnailExt}`;
    if (ossEnabled) {
      await getOssClient().put(
        ossObjectKey(safeThumbnailFileName),
        fs.createReadStream(upload.thumbnail.tempPath),
        { mime: thumbnailMimeType(thumbnailExt) }
      );
    } else {
      await fsp.rename(upload.thumbnail.tempPath, path.join(thumbnailsDir, safeThumbnailFileName));
    }
    thumbnailStored = true;

    delete model.thumbnail;
    delete model.thumbnailUrl;
    model.thumbnailFileName = safeThumbnailFileName;
    model.thumbnailStorage = storage;
    model.thumbnailFileSize = thumbnailFileSize;
    model.updatedAt = new Date().toISOString();

    try {
      saveManifest();
    } catch (error) {
      restoreThumbnailSnapshot(model, previousThumbnail);
      throw error;
    }
    committed = true;

    if (ossEnabled) await deleteTempFile(upload.thumbnail.tempPath);
    let warning = '';
    if (oldThumbnailFileName && oldThumbnailFileName !== safeThumbnailFileName) {
      try {
        await removeStoredUpload(oldThumbnailStorage, oldThumbnailFileName, thumbnailsDir);
      } catch (error) {
        warning = error.message || '旧缩略图删除失败';
        console.error('新缩略图已保存，但旧缩略图删除失败:', error);
      }
    }

    sendJson(res, 200, warning
      ? { model: safeModel(model), warning }
      : { model: safeModel(model) });
  } catch (error) {
    await deleteTempFile(upload.thumbnail.tempPath);
    if (thumbnailStored && !committed && safeThumbnailFileName) {
      try {
        await removeStoredUpload(storage, safeThumbnailFileName, thumbnailsDir);
      } catch (cleanupError) {
        console.error('新缩略图清理失败:', cleanupError);
      }
    }
    restoreThumbnailSnapshot(model, previousThumbnail);
    sendJson(res, 400, { error: error.message || '缩略图上传失败。' });
  }
}

async function removeModelThumbnail(req, res, id) {
  const model = manifest.models.find((item) => item.id === id);
  if (!model) {
    sendJson(res, 404, { error: '模型不存在。' });
    return;
  }

  const previousThumbnail = thumbnailSnapshot(model);
  const oldThumbnailFileName = model.thumbnailFileName || '';
  const oldThumbnailStorage = model.thumbnailStorage || model.storage || 'local';
  delete model.thumbnail;
  delete model.thumbnailUrl;
  delete model.thumbnailFileName;
  delete model.thumbnailStorage;
  delete model.thumbnailFileSize;
  model.updatedAt = new Date().toISOString();

  try {
    saveManifest();
  } catch (error) {
    restoreThumbnailSnapshot(model, previousThumbnail);
    throw error;
  }

  let warning = '';
  if (oldThumbnailFileName) {
    try {
      await removeStoredUpload(oldThumbnailStorage, oldThumbnailFileName, thumbnailsDir);
    } catch (error) {
      warning = error.message || '缩略图文件删除失败';
      console.error('缩略图记录已清除，但文件删除失败:', error);
    }
  }

  sendJson(res, 200, warning
    ? { model: safeModel(model), warning }
    : { model: safeModel(model) });
}

async function updateModel(req, res, id) {
  const body = await readJsonBody(req);
  const model = manifest.models.find((item) => item.id === id);

  if (!model) {
    sendJson(res, 404, { error: '模型不存在。' });
    return;
  }

  const previousValues = {
    name: model.name,
    intro: model.intro,
    taxonomyId: model.taxonomyId,
    updatedAt: model.updatedAt,
    attribution: model.attribution,
    attributionLog: model.attributionLog
  };

  if (body.name !== undefined) {
    const name = String(body.name).trim();
    if (!name) {
      sendJson(res, 400, { error: '模型名称不能为空。' });
      return;
    }
    model.name = name;
  }

  if (body.intro !== undefined) {
    const intro = String(body.intro).trim();
    if (intro.length > 2000) {
      sendJson(res, 400, { error: '模型介绍不能超过 2000 个字符。' });
      return;
    }
    model.intro = intro;
  }

  if (body.taxonomyId !== undefined) {
    const taxonomyId = body.taxonomyId === null || body.taxonomyId === '' ? null : String(body.taxonomyId);
    if (taxonomyId && !getTaxonomyEntry(taxonomyId)) {
      sendJson(res, 400, { error: '所选分类条目不存在。' });
      return;
    }
    model.taxonomyId = taxonomyId;
  }

  if (body.attribution && typeof body.attribution === 'object') {
    const nextAttribution = { ...(model.attribution || {}) };
    const nextLog = Array.isArray(model.attributionLog) ? [...model.attributionLog] : [];
    for (const field of ['collector', 'identifier', 'builder']) {
      const nextValue = String(body.attribution[field] ?? '').trim();
      const prevValue = String(nextAttribution[field] ?? '').trim();
      if (nextValue !== prevValue) {
        nextAttribution[field] = nextValue;
        nextLog.push({ field, value: nextValue, at: new Date().toISOString() });
      }
    }
    model.attribution = nextAttribution;
    model.attributionLog = nextLog;
  }

  if (model.taxonomyId) {
    ensureAncestorPathForEntry(model.taxonomyId);
  }

  model.updatedAt = new Date().toISOString();
  try {
    saveManifest();
  } catch (error) {
    Object.assign(model, previousValues);
    throw error;
  }
  sendJson(res, 200, { model: { ...safeModel(model), url: modelUrl(model) } });
}

async function deleteModel(req, res, id) {
  const index = manifest.models.findIndex((item) => item.id === id);

  if (index < 0) {
    sendJson(res, 404, { error: '模型不存在。' });
    return;
  }

  const previousModels = manifest.models;
  const [model] = manifest.models.splice(index, 1);
  try {
    saveManifest();
  } catch (error) {
    manifest.models = previousModels;
    throw error;
  }

  let warning = '';
  if (model.fileName) {
    if (model.storage === 'oss' && ossEnabled) {
      try {
        await getOssClient().delete(ossObjectKey(model.fileName));
      } catch (error) {
        warning = error.message || 'OSS 文件删除失败';
        console.error('模型记录已删除，但 OSS 文件删除失败:', error);
      }
    } else {
      const filePath = path.resolve(modelsDir, model.fileName);
      const isInsideModelsDir = filePath === modelsDir || filePath.startsWith(modelsDir + path.sep);
      if (!isInsideModelsDir) {
        warning = `拒绝删除 models 目录之外的模型文件: ${filePath}`;
        console.error(warning);
      } else {
        try {
          await fsp.unlink(filePath);
        } catch (error) {
          if (error.code !== 'ENOENT') {
            warning = error.message || '模型文件删除失败';
            console.error('模型记录已删除，但模型文件删除失败:', error);
          }
        }
      }
    }
  }

  if (model.thumbnailFileName) {
    try {
      await removeStoredUpload(model.thumbnailStorage || model.storage || 'local', model.thumbnailFileName, thumbnailsDir);
    } catch (error) {
      const thumbnailWarning = error.message || '缩略图文件删除失败';
      warning = warning ? `${warning}；${thumbnailWarning}` : thumbnailWarning;
      console.error('模型记录已删除，但缩略图删除失败:', error);
    }
  }

  sendJson(res, 200, warning ? { deleted: id, warning } : { deleted: id });
}

function validateTaxonomyPayload(body, existingId = null) {
  const name = String(body.name || '').trim();
  if (!name || name.length > 50) {
    return { error: '分类名称不能为空且不能超过 50 个字符。' };
  }

  const rankKey = String(body.rankKey || body.rank || 'order');
  if (getRankPosition(rankKey) < 0) {
    return { error: '分类层级无效。' };
  }

  const parentId = body.parentId === null || body.parentId === '' ? null : String(body.parentId);
  if (parentId !== null && parentId === existingId) {
    return { error: '分类条目不能作为自己的父级。' };
  }

  if (parentId) {
    const parent = getTaxonomyEntry(parentId);
    if (!parent) {
      return { error: '父级分类不存在。' };
    }

    const parentRankKey = parent.rankKey || parent.rank;
    const parentPosition = getRankPosition(parentRankKey);
    const rankPosition = getRankPosition(rankKey);
    if (rankPosition < 0 || parentPosition < 0 || rankPosition <= parentPosition) {
      return { error: '子分类的层级必须低于父分类。' };
    }
  }

  const identificationSummary = String(body.identificationSummary || body.keyText || '').trim();
  if (identificationSummary.length > 500) {
    return { error: '鉴定特征不能超过 500 个字符。' };
  }

  const duplicate = taxonomyManifest.entries.find((entry) => {
    return entry.id !== existingId &&
      entry.name === name &&
      (entry.parentId || null) === parentId &&
      (entry.rankKey || entry.rank) === rankKey;
  });
  if (duplicate) {
    return { error: '同一层级下已存在同名分类。' };
  }

  const code = String(body.code || '').trim();
  if (code && !isCodeAvailable(code, existingId)) {
    return { error: '该坐标已被其他分类节点使用。' };
  }

  let sortOrder = Number(body.sortOrder);
  if (!Number.isFinite(sortOrder)) {
    const siblings = taxonomyManifest.entries.filter((entry) => (entry.parentId || null) === parentId);
    sortOrder = siblings.reduce((max, entry) => Math.max(max, Number(entry.sortOrder) || 0), 0) + 1;
  }

  return {
    name,
    rankKey,
    parentId,
    nameLatin: String(body.nameLatin || '').trim(),
    intro: String(body.intro || '').trim(),
    classificationBasis: String(body.classificationBasis || '').trim(),
    identificationSummary,
    active: body.active === undefined ? true : Boolean(body.active),
    classificationStatus: String(body.classificationStatus || 'confirmed').trim(),
    code,
    sortOrder
  };
}

function createTaxonomyEntry(body) {
  const validation = validateTaxonomyPayload(body);
  if (validation.error) return validation;

  const now = new Date().toISOString();
  const entry = {
    id: crypto.randomUUID(),
    name: validation.name,
    code: validation.code || generateTaxonomyCode(validation.parentId, validation.rankKey, validation.name),
    rankKey: validation.rankKey,
    nameLatin: validation.nameLatin,
    parentId: validation.parentId,
    intro: validation.intro,
    classificationBasis: validation.classificationBasis,
    identificationSummary: validation.identificationSummary,
    active: validation.active,
    classificationStatus: validation.classificationStatus,
    sortOrder: validation.sortOrder,
    createdAt: now,
    updatedAt: now
  };

  const previousEntries = taxonomyManifest.entries;
  taxonomyManifest.entries.push(entry);
  try {
    saveTaxonomy();
  } catch (error) {
    taxonomyManifest.entries = previousEntries;
    throw error;
  }
  ensureAncestorPathForEntry(entry.id);
  return { entry: safeTaxonomy(entry) };
}

function updateTaxonomyEntry(id, body) {
  const entry = getTaxonomyEntry(id);
  if (!entry) {
    return { error: '分类条目不存在。' };
  }

  const validation = validateTaxonomyPayload(body, id);
  if (validation.error) return validation;

  const previousValues = {
    name: entry.name,
    code: entry.code,
    rankKey: entry.rankKey,
    nameLatin: entry.nameLatin,
    parentId: entry.parentId,
    intro: entry.intro,
    classificationBasis: entry.classificationBasis,
    identificationSummary: entry.identificationSummary,
    active: entry.active,
    classificationStatus: entry.classificationStatus,
    sortOrder: entry.sortOrder,
    updatedAt: entry.updatedAt
  };

  Object.assign(entry, {
    name: validation.name,
    code: validation.code || generateTaxonomyCode(validation.parentId, validation.rankKey, validation.name),
    rankKey: validation.rankKey,
    nameLatin: validation.nameLatin,
    parentId: validation.parentId,
    intro: validation.intro,
    classificationBasis: validation.classificationBasis,
    identificationSummary: validation.identificationSummary,
    active: validation.active,
    classificationStatus: validation.classificationStatus,
    sortOrder: validation.sortOrder,
    updatedAt: new Date().toISOString()
  });
  try {
    saveTaxonomy();
  } catch (error) {
    Object.assign(entry, previousValues);
    throw error;
  }
  return { entry: safeTaxonomy(entry) };
}

function deleteTaxonomyEntry(id) {
  const entry = getTaxonomyEntry(id);
  if (!entry) {
    return { error: '分类条目不存在。' };
  }

  const childCount = getTaxonomyChildren(id).length;
  if (childCount > 0) {
    return { error: '该分类下还有子分类，请先处理子分类。' };
  }

  const modelCount = modelCountForTaxonomy(id);
  if (modelCount > 0) {
    return { error: `还有 ${modelCount} 个模型归属于该分类，请先调整模型分类。` };
  }

  const previousEntries = taxonomyManifest.entries;
  const entryIndex = previousEntries.indexOf(entry);
  taxonomyManifest.entries = previousEntries.filter((item) => item.id !== id);
  try {
    saveTaxonomy();
  } catch (error) {
    taxonomyManifest.entries = previousEntries.slice();
    throw error;
  }
  return { deleted: id };
}

function createRankDefinition(body) {
  const key = String(body.key || '').trim();
  const name = String(body.name || '').trim();
  const nameLatin = String(body.nameLatin || '').trim();
  const position = Number(body.position);
  const base = Boolean(body.base);

  if (!key || !name) {
    return { error: '阶元 key 和名称不能为空。' };
  }
  if (!Number.isFinite(position)) {
    return { error: '阶元顺序必须是数字。' };
  }
  if (taxonomyRankCatalog.some((entry) => entry.key === key)) {
    return { error: '该阶元 key 已存在。' };
  }
  const basePositions = new Set(baseRankCatalog.map((entry) => entry.position));
  if (basePositions.has(position)) {
    return { error: '特殊阶元位置不能与基础阶元位置相同。' };
  }
  if (taxonomyRankCatalog.some((entry) => Number(entry.position) === position)) {
    return { error: '该层级位置已被使用。' };
  }

  const rank = {
    id: `rank-${key}`,
    key,
    name,
    nameLatin,
    position,
    base,
    active: true
  };
  taxonomyRankCatalog.push(rank);
  saveTaxonomy();
  return { rank: { ...rank } };
}

function updateRankDefinition(key, body) {
  const rank = taxonomyRankCatalog.find((entry) => entry.key === key);
  if (!rank) {
    return { error: '阶元不存在。' };
  }

  if (body.name !== undefined) rank.name = String(body.name).trim();
  if (body.nameLatin !== undefined) rank.nameLatin = String(body.nameLatin).trim();
  if (body.position !== undefined) {
    const position = Number(body.position);
    if (!Number.isFinite(position)) return { error: '阶元顺序必须是数字。' };
    const basePositions = new Set(baseRankCatalog.map((entry) => entry.position));
    if (basePositions.has(position)) {
      return { error: '特殊阶元位置不能与基础阶元位置相同。' };
    }
    const conflict = taxonomyRankCatalog.find((entry) => entry.key !== key && Number(entry.position) === position);
    if (conflict) {
      return { error: `该层级位置已被 ${conflict.name} 使用。` };
    }

    for (const entry of taxonomyManifest.entries) {
      if ((entry.rankKey || entry.rank) !== key) continue;
      const parent = getTaxonomyEntry(entry.parentId);
      if (parent) {
        const parentPosition = getRankPosition(parent.rankKey || parent.rank);
        if (parentPosition >= position) {
          return { error: `移动后，${entry.name} 的父级位置不合法。` };
        }
      }
      for (const child of getTaxonomyChildren(entry.id)) {
        const childPosition = getRankPosition(child.rankKey || child.rank);
        if (childPosition <= position) {
          return { error: `移动后，${child.name} 的子级位置不合法。` };
        }
      }
    }
    rank.position = position;
  }
  if (body.active !== undefined) rank.active = Boolean(body.active);

  saveTaxonomy();
  return { rank: { ...rank } };
}

function deleteRankDefinition(key) {
  const rank = taxonomyRankCatalog.find((entry) => entry.key === key);
  if (!rank) {
    return { error: '阶元不存在。' };
  }

  const usedEntries = taxonomyManifest.entries.filter((entry) => (entry.rankKey || entry.rank) === key);
  if (usedEntries.length) {
    const names = usedEntries.map((entry) => entry.name).join('、');
    return {
      error: `该阶元仍被以下分类节点使用：${names}。请先停用或处理相关节点。`,
      nodes: usedEntries.map((entry) => ({ id: entry.id, name: entry.name, code: entry.code || '' }))
    };
  }

  const index = taxonomyRankCatalog.indexOf(rank);
  if (index >= 0) taxonomyRankCatalog.splice(index, 1);
  saveTaxonomy();
  return { deleted: key };
}

async function handleApi(req, res, url) {
  if (url.pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, { status: 'ok', storage: ossEnabled ? 'oss' : 'local' });
    return true;
  }

  if (url.pathname === '/api/admin/verify' && req.method === 'POST') {
    const body = await readJsonBody(req);
    if (body.key === adminKey) {
      sendJson(res, 200, { ok: true });
    } else {
      sendJson(res, 200, { ok: false, error: '管理秘钥不正确。' });
    }
    return true;
  }

  if (url.pathname === '/api/taxonomy' && req.method === 'GET') {
    const taxonomy = taxonomyManifest.entries.map((entry) => ({
      ...safeTaxonomy(entry),
      modelCount: modelCountForTaxonomy(entry.id)
    }));
    const rankCatalog = taxonomyRankCatalog.map((entry) => ({ ...entry }));
    sendJson(res, 200, { taxonomy, rankCatalog });
    return true;
  }

  if (url.pathname === '/api/thumbnail-proxy' && req.method === 'GET') {
    proxyThumbnail(req, res, url.searchParams.get('url') || '');
    return true;
  }

  if (url.pathname === '/api/search' && req.method === 'GET') {
    const query = (url.searchParams.get('q') || '').trim().toLocaleLowerCase('zh-CN');
    if (!query) {
      sendJson(res, 200, { models: [], taxonomy: [] });
      return true;
    }

    const models = manifest.models
      .map((model) => safeModel(model))
      .filter((model) => {
        const haystack = [
          model.name,
          model.originalName,
          model.intro,
          model.taxonomyName
        ].join(' ').toLocaleLowerCase('zh-CN');
        return haystack.includes(query);
      })
      .map((model) => ({ ...model, url: modelUrl(model) }));

    const taxonomy = taxonomyManifest.entries
      .map((entry) => safeTaxonomy(entry))
      .filter((entry) => {
        const haystack = [
          entry.name,
          entry.keyText,
          entry.rankLabel
        ].join(' ').toLocaleLowerCase('zh-CN');
        return haystack.includes(query);
      })
      .map((entry) => ({ ...entry, modelCount: modelCountForTaxonomy(entry.id) }));

    sendJson(res, 200, { models, taxonomy });
    return true;
  }

  if (req.method !== 'GET' && req.headers['x-admin-key'] !== adminKey) {
    sendJson(res, 401, { error: '需要输入管理秘钥后才能执行此操作。' });
    return true;
  }

  if (url.pathname === '/api/rank-catalog' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const result = createRankDefinition(body);
    if (result.error) {
      sendJson(res, 400, { error: result.error });
    } else {
      sendJson(res, 201, { rank: result.rank });
    }
    return true;
  }

  const rankMatch = url.pathname.match(/^\/api\/rank-catalog\/([^/]+)$/);
  if (rankMatch) {
    const key = decodeURIComponent(rankMatch[1]);
    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const result = updateRankDefinition(key, body);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
      } else {
        sendJson(res, 200, { rank: result.rank });
      }
      return true;
    }
    if (req.method === 'DELETE') {
      const result = deleteRankDefinition(key);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
      } else {
        sendJson(res, 200, { deleted: result.deleted });
      }
      return true;
    }
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

  if (url.pathname === '/api/taxonomy' && req.method === 'POST') {
    const body = await readJsonBody(req);
    const result = createTaxonomyEntry(body);
    if (result.error) {
      sendJson(res, 400, { error: result.error });
    } else {
      sendJson(res, 201, { entry: result.entry });
    }
    return true;
  }

  const taxonomyMatch = url.pathname.match(/^\/api\/taxonomy\/([^/]+)$/);
  if (taxonomyMatch) {
    const id = decodeURIComponent(taxonomyMatch[1]);
    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const result = updateTaxonomyEntry(id, body);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
      } else {
        sendJson(res, 200, { entry: result.entry });
      }
      return true;
    }
    if (req.method === 'DELETE') {
      const result = deleteTaxonomyEntry(id);
      if (result.error) {
        sendJson(res, 400, { error: result.error });
      } else {
        sendJson(res, 200, { deleted: result.deleted });
      }
      return true;
    }
  }

  const modelThumbnailMatch = url.pathname.match(/^\/api\/models\/([^/]+)\/thumbnail$/);
  if (modelThumbnailMatch) {
    const id = decodeURIComponent(modelThumbnailMatch[1]);
    if (req.method === 'PUT') {
      await replaceModelThumbnail(req, res, id);
      return true;
    }
    if (req.method === 'DELETE') {
      await removeModelThumbnail(req, res, id);
      return true;
    }
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

if (require.main === module) {
  server.listen(port, '0.0.0.0', () => {
    console.log(`Gaussian splat viewer running at http://0.0.0.0:${port}`);
  });
}

module.exports = {
  writeJsonAtomic,
  parseJsonFile,
  normalizeLegacyTaxonomy,
  baseRankCatalog
};
