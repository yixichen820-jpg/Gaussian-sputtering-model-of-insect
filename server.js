const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { URL } = require('url');
const Busboy = require('busboy');
require('dotenv').config({ path: path.join(__dirname, '.env') });

let OSS;
try {
  OSS = require('ali-oss');
} catch (error) {
  OSS = null;
}

const rootDir = __dirname;
const modelsDir = path.join(rootDir, 'models');
const dataDir = path.join(rootDir, 'data');
const manifestPath = path.join(dataDir, 'models.json');
const taxonomyPath = path.join(dataDir, 'taxonomy.json');
const port = Number(process.env.PORT || 4173);
const adminKey = process.env.ADMIN_KEY;

if (!adminKey || adminKey.trim().length === 0) {
  console.error('缺少 ADMIN_KEY 环境变量。请设置非空的管理密钥后再启动服务器。');
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
  '.svg': 'image/svg+xml',
  '.map': 'application/json; charset=utf-8'
};

const seedModels = [];

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
const taxonomyRanks = taxonomyRankCatalog.map((entry) => entry.key);
const rankLabels = Object.fromEntries(taxonomyRankCatalog.map((entry) => [entry.key, entry.name]));

function getRankPosition(rankKey) {
  const rank = taxonomyRankCatalog.find((entry) => entry.key === rankKey);
  return rank ? Number(rank.position) : -1;
}

function getTaxonomyEntry(id) {
  return taxonomyManifest.entries.find((entry) => entry.id === id) || null;
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
    rank: rankKey,
    rankKey,
    rankLabel: rankLabels[rankKey] || rankKey,
    parentId: entry.parentId || null,
    keyText: identificationSummary,
    nameLatin: entry.nameLatin || '',
    intro: entry.intro || '',
    classificationBasis: entry.classificationBasis || '',
    identificationSummary,
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

function safeModel(model) {
  let fileSize = 0;
  if (model.storage === 'oss' && ossEnabled && Number.isFinite(Number(model.fileSize))) {
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
    createdAt: model.createdAt,
    updatedAt: model.updatedAt
  };
}

function modelUrl(model) {
  if (model.storage === 'oss' && ossEnabled && model.fileName) {
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
  let finalPath = null;
  let safeFileName = null;

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
    safeFileName = `model-${Date.now()}-${id.slice(0, 8)}.ply`;
    const fileSize = fs.statSync(upload.file.tempPath).size;

    if (ossEnabled) {
      await getOssClient().put(ossObjectKey(safeFileName), fs.createReadStream(upload.file.tempPath), {
        mime: 'application/octet-stream'
      });
      await deleteTempFile(upload.file.tempPath);
    } else {
      finalPath = path.join(modelsDir, safeFileName);
      await fsp.rename(upload.file.tempPath, finalPath);
    }

    const originalName = upload.file.originalName || '未命名.ply';
    const fallbackName = path.parse(originalName).name || '未命名模型';
    const now = new Date().toISOString();
    const model = safeModel({
      id,
      name: String(upload.fields.name || fallbackName).trim() || '未命名模型',
      fileName: safeFileName,
      originalName,
      fileSize,
      splatCount: metadata.vertexCount,
      center: metadata.center,
      size: metadata.size,
      intro: '',
      storage: ossEnabled ? 'oss' : 'local',
      createdAt: now,
      updatedAt: now
    });

    const previousModels = manifest.models;
    manifest.models.unshift(model);
    try {
      saveManifest();
    } catch (error) {
      manifest.models = previousModels;
      throw error;
    }

    sendJson(res, 201, { model: { ...model, url: modelUrl(model) } });
  } catch (error) {
    if (ossEnabled) {
      console.error('模型可能已上传到 OSS，但模型清单保存失败，请手动检查 OSS 对象:', safeFileName, error);
    } else if (finalPath) {
      console.error('模型文件可能已写入，但模型清单保存失败，请手动检查文件:', finalPath, error);
    } else {
      console.error('模型上传失败:', error);
    }
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

  const previousValues = {
    name: model.name,
    intro: model.intro,
    taxonomyId: model.taxonomyId,
    updatedAt: model.updatedAt
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

  sendJson(res, 200, warning ? { deleted: id, warning } : { deleted: id });
}

function validateTaxonomyPayload(body, existingId = null) {
  const name = String(body.name || '').trim();
  if (!name || name.length > 50) {
    return { error: '分类名称不能为空且不能超过 50 个字符。' };
  }

  const rankKey = String(body.rankKey || body.rank || 'order');
  if (!taxonomyRanks.includes(rankKey)) {
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
    sendJson(res, 200, { taxonomy });
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
