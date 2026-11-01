const fs = require('fs');
const path = require('path');

const baseRankCatalog = [
  { id: 'rank-kingdom', key: 'kingdom', name: '界', nameLatin: 'Regnum', position: 10, base: true, active: true },
  { id: 'rank-phylum', key: 'phylum', name: '门', nameLatin: 'Phylum', position: 20, base: true, active: true },
  { id: 'rank-class', key: 'class', name: '纲', nameLatin: 'Classis', position: 30, base: true, active: true },
  { id: 'rank-order', key: 'order', name: '目', nameLatin: 'Ordo', position: 40, base: true, active: true },
  { id: 'rank-family', key: 'family', name: '科', nameLatin: 'Familia', position: 50, base: true, active: true },
  { id: 'rank-genus', key: 'genus', name: '属', nameLatin: 'Genus', position: 60, base: true, active: true },
  { id: 'rank-species', key: 'species', name: '种', nameLatin: 'Species', position: 70, base: true, active: true }
];

const pendingOrderIds = new Set(['order-unknown']);

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function writeJson(filePath, data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2) + '\n', 'utf8');
}

function migrateCopy(copyDir) {
  const dataDir = path.join(copyDir, 'data');
  const taxonomyPath = path.join(dataDir, 'taxonomy.json');
  const modelsPath = path.join(dataDir, 'models.json');

  if (!fs.existsSync(taxonomyPath)) {
    throw new Error(`未找到 taxonomy.json: ${taxonomyPath}`);
  }

  const taxonomy = readJson(taxonomyPath);
  if (taxonomy.schemaVersion === 2 && Array.isArray(taxonomy.rankCatalog)) {
    console.log('已经是 schemaVersion 2，跳过迁移。');
    return { migrated: false, entries: taxonomy.entries.length, pending: [] };
  }

  const backupPath = path.join(dataDir, 'taxonomy.pre-v8.json');
  fs.writeFileSync(backupPath, fs.readFileSync(taxonomyPath), 'utf8');

  const now = new Date().toISOString();
  const entries = [];

  entries.push({
    id: 'taxon-animalia',
    rankKey: 'kingdom',
    parentId: null,
    name: '动物界',
    nameLatin: 'Animalia',
    active: true,
    classificationStatus: 'confirmed',
    sortOrder: 1,
    createdAt: now,
    updatedAt: now
  });
  entries.push({
    id: 'taxon-arthropoda',
    rankKey: 'phylum',
    parentId: 'taxon-animalia',
    name: '节肢动物门',
    nameLatin: 'Arthropoda',
    active: true,
    classificationStatus: 'confirmed',
    sortOrder: 1,
    createdAt: now,
    updatedAt: now
  });
  entries.push({
    id: 'taxon-insecta',
    rankKey: 'class',
    parentId: 'taxon-arthropoda',
    name: '昆虫纲',
    nameLatin: 'Insecta',
    active: true,
    classificationStatus: 'confirmed',
    sortOrder: 1,
    createdAt: now,
    updatedAt: now
  });

  const pending = [];

  for (const oldEntry of taxonomy.entries || []) {
    const rankKey = oldEntry.rankKey || oldEntry.rank || 'order';
    const existingStatus = oldEntry.classificationStatus;
    let classificationStatus = existingStatus || 'confirmed';
    let parentId = oldEntry.parentId || null;

    if (rankKey === 'order' && !parentId) {
      if (pendingOrderIds.has(oldEntry.id) || existingStatus === 'pending') {
        classificationStatus = 'pending';
        parentId = null;
        pending.push(oldEntry.id);
      } else {
        parentId = 'taxon-insecta';
      }
    }

    entries.push({
      ...oldEntry,
      rankKey,
      parentId,
      nameLatin: oldEntry.nameLatin || '',
      intro: oldEntry.intro || '',
      classificationBasis: oldEntry.classificationBasis || '',
      identificationSummary: oldEntry.identificationSummary || oldEntry.keyText || '',
      active: oldEntry.active !== false,
      classificationStatus,
      createdAt: oldEntry.createdAt || now,
      updatedAt: oldEntry.updatedAt || now
    });
  }

  const result = {
    schemaVersion: 2,
    rankCatalog: baseRankCatalog,
    entries
  };

  writeJson(taxonomyPath, result);
  if (!fs.existsSync(modelsPath)) {
    throw new Error(`未找到 models.json: ${modelsPath}`);
  }

  console.log(`迁移完成，分类条目数: ${entries.length}`);
  console.log(`待确认节点: ${pending.length ? pending.join(', ') : '无'}`);
  return { migrated: true, entries: entries.length, pending };
}

const target = process.argv[2];
if (!target) {
  console.error('用法: node scripts/migrate-taxonomy-v8.js <项目副本目录>');
  process.exit(1);
}

migrateCopy(target);
