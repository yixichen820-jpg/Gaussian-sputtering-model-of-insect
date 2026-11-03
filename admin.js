import replaceElement from './node_modules/lucide/dist/esm/replaceElement.mjs';
import ArrowLeft from './node_modules/lucide/dist/esm/icons/arrow-left.mjs';
import ArrowRight from './node_modules/lucide/dist/esm/icons/arrow-right.mjs';
import ChevronDown from './node_modules/lucide/dist/esm/icons/chevron-down.mjs';
import ChevronRight from './node_modules/lucide/dist/esm/icons/chevron-right.mjs';
import CornerDownRight from './node_modules/lucide/dist/esm/icons/corner-down-right.mjs';
import FolderCog from './node_modules/lucide/dist/esm/icons/folder-cog.mjs';
import ImagePlus from './node_modules/lucide/dist/esm/icons/image-plus.mjs';
import Inbox from './node_modules/lucide/dist/esm/icons/inbox.mjs';
import KeyRound from './node_modules/lucide/dist/esm/icons/key-round.mjs';
import Lock from './node_modules/lucide/dist/esm/icons/lock.mjs';
import LockKeyhole from './node_modules/lucide/dist/esm/icons/lock-keyhole.mjs';
import Minus from './node_modules/lucide/dist/esm/icons/minus.mjs';
import Pencil from './node_modules/lucide/dist/esm/icons/pencil.mjs';
import Plus from './node_modules/lucide/dist/esm/icons/plus.mjs';
import Save from './node_modules/lucide/dist/esm/icons/save.mjs';
import ToggleLeft from './node_modules/lucide/dist/esm/icons/toggle-left.mjs';
import ToggleRight from './node_modules/lucide/dist/esm/icons/toggle-right.mjs';
import Trash2 from './node_modules/lucide/dist/esm/icons/trash.mjs';
import UploadCloud from './node_modules/lucide/dist/esm/icons/cloud-upload.mjs';
import X from './node_modules/lucide/dist/esm/icons/x.mjs';

const icons = {
  ArrowLeft,
  ArrowRight,
  ChevronDown,
  ChevronRight,
  CornerDownRight,
  FolderCog,
  ImagePlus,
  Inbox,
  KeyRound,
  Lock,
  LockKeyhole,
  Minus,
  Pencil,
  Plus,
  Save,
  ToggleLeft,
  ToggleRight,
  Trash2,
  UploadCloud,
  X
};

function createIcons({ root = document } = {}) {
  root.querySelectorAll('[data-lucide]').forEach((element) => {
    replaceElement(element, { nameAttr: 'data-lucide', icons, attrs: {} });
  });
}

const modelList = document.getElementById('model-list');
const emptyState = document.getElementById('empty-state');
const modelCount = document.getElementById('model-count');
const totalSplats = document.getElementById('total-splats');
const totalSize = document.getElementById('total-size');
const listHint = document.getElementById('list-hint');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadForm = document.getElementById('upload-form');
const uploadTasks = document.getElementById('upload-tasks');
const authGate = document.getElementById('auth-gate');
const uploadSection = document.getElementById('upload-section');
const unlockForm = document.getElementById('unlock-form');
const adminKeyInput = document.getElementById('admin-key-input');
const lockButton = document.getElementById('lock-button');
const toast = document.getElementById('toast');
const addTaxonomyButton = document.getElementById('add-taxonomy-button');
const taxonomyEditor = document.getElementById('taxonomy-editor');
const taxonomyNameInput = document.getElementById('taxonomy-name');
const taxonomyCodeInput = document.getElementById('taxonomy-code');
const taxonomyRankInput = document.getElementById('taxonomy-rank');
const taxonomyParentInput = document.getElementById('taxonomy-parent');
const taxonomySortInput = document.getElementById('taxonomy-sort');
const taxonomyKeyTextInput = document.getElementById('taxonomy-key-text');
const taxonomyNameLatinInput = document.getElementById('taxonomy-name-latin');
const taxonomyActiveInput = document.getElementById('taxonomy-active');
const taxonomyStatusInput = document.getElementById('taxonomy-status');
const taxonomyBasisInput = document.getElementById('taxonomy-basis');
const taxonomyIntroInput = document.getElementById('taxonomy-intro');
const taxonomySaveButton = document.getElementById('taxonomy-save');
const taxonomyCancelButton = document.getElementById('taxonomy-cancel');
const taxonomyList = document.getElementById('taxonomy-list');
const taxonomyHint = document.getElementById('taxonomy-hint');
const addRankButton = document.getElementById('add-rank-button');
const rankEditor = document.getElementById('rank-editor');
const rankKeyInput = document.getElementById('rank-key');
const rankNameInput = document.getElementById('rank-name');
const rankNameLatinInput = document.getElementById('rank-name-latin');
const rankPositionInput = document.getElementById('rank-position');
const rankBaseInput = document.getElementById('rank-base');
const rankParentIdInput = document.getElementById('rank-parent-id');
const rankSaveButton = document.getElementById('rank-save');
const rankCancelButton = document.getElementById('rank-cancel');
const rankList = document.getElementById('rank-list');
const rankTree = document.getElementById('rank-tree');
const rankCatalogHint = document.getElementById('rank-catalog-hint');
const tabRankBtn = document.getElementById('tab-rank-btn');
const tabFillBtn = document.getElementById('tab-fill-btn');
const tabModelsBtn = document.getElementById('tab-models-btn');

let models = [];
let taxonomy = [];
let rankCatalog = [];
let unlocked = false;
let adminKey = '';
let editingTaxonomyId = null;
let editingRankKey = null;
let activeTab = 'models';
const expandedTaxonomyAdminIds = new Set(['taxon-animalia', 'taxon-arthropoda']);
const expandedRankTreeIds = new Set(['taxon-animalia', 'taxon-arthropoda', 'taxon-insecta']);

createIcons({ icons });

const numberFormatter = new Intl.NumberFormat('zh-CN');
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

const ATTRIBUTION_FIELDS = {
  collector: '采集者',
  identifier: '鉴定者',
  builder: '模型构建者'
};

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** index;
  return `${value >= 100 || index === 0 ? Math.round(value) : value.toFixed(1)} ${units[index]}`;
}

function showToast(message, isError = false) {
  toast.textContent = message;
  toast.classList.toggle('is-error', isError);
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 3000);
}

function readStoredAuth() {
  unlocked = sessionStorage.getItem('admin-unlocked') === 'true';
  adminKey = sessionStorage.getItem('admin-key') || '';
  if (!adminKey) unlocked = false;
}

function applyTabVisibility() {
  const showModels = activeTab === 'models';
  const showRank = activeTab === 'rank';
  const showFill = activeTab === 'fill';

  document.querySelectorAll('section[data-tab="models"]').forEach((el) => {
    el.hidden = el === uploadSection ? !unlocked || !showModels : !showModels;
  });
  document.querySelectorAll('section[data-tab="rank"]').forEach((el) => {
    el.hidden = !showRank;
  });
  document.querySelectorAll('section[data-tab="fill"]').forEach((el) => {
    el.hidden = !showFill;
  });

  const tabButtons = [
    ['models', tabModelsBtn],
    ['rank', tabRankBtn],
    ['fill', tabFillBtn]
  ];
  for (const [key, btn] of tabButtons) {
    const active = activeTab === key;
    btn.classList.toggle('is-active', active);
    btn.setAttribute('aria-selected', String(active));
  }
}

function renderAuthState() {
  authGate.hidden = unlocked;
  applyTabVisibility();
  lockButton.hidden = !unlocked;
  addTaxonomyButton.hidden = true;
  taxonomyEditor.hidden = true;
  addRankButton.disabled = !unlocked;
  if (!unlocked && !taxonomyEditor.hidden) closeTaxonomyEditor();
  if (!unlocked && !rankEditor.hidden) closeRankEditor();
  renderModelRows();
  renderTaxonomyList();
  renderRankList();
  renderRankTree();
}

function requireUnlocked() {
  if (unlocked) return true;
  showToast('请先输入管理秘钥', true);
  authGate.hidden = false;
  adminKeyInput.focus();
  return false;
}

function authHeaders(contentType = false) {
  const headers = {
    'X-Admin-Key': adminKey
  };
  if (contentType) {
    headers['Content-Type'] = 'application/json';
  }
  return headers;
}

const SUPPORTED_MODEL_EXTENSIONS = ['.ply', '.spz', '.splat', '.ksplat'];
const SUPPORTED_THUMBNAIL_EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp'];

function fileExtension(name) {
  const dot = name.lastIndexOf('.');
  return dot >= 0 ? name.slice(dot).toLowerCase() : '';
}

function createUploadTask(file) {
  const row = document.createElement('div');
  row.className = 'upload-task';

  const copy = document.createElement('div');
  copy.className = 'upload-task-copy';

  const name = document.createElement('span');
  name.className = 'upload-task-name';
  name.textContent = file.name;

  const status = document.createElement('span');
  status.className = 'upload-task-status';
  status.textContent = '等待中';

  copy.append(name, status);

  const bar = document.createElement('div');
  bar.className = 'progress-line';
  const fill = document.createElement('div');
  fill.className = 'progress-line-fill';
  bar.append(fill);

  row.append(copy, bar);
  uploadTasks.append(row);

  return {
    setStatus(text) {
      status.textContent = text;
    },
    setProgress(percent) {
      const pct = Math.max(0, Math.min(100, percent));
      fill.style.width = `${pct}%`;
      status.textContent = `上传中 ${Math.round(pct)}%`;
    },
    setDone() {
      fill.style.width = '100%';
      status.textContent = '完成';
      status.classList.add('is-done');
    },
    setError(message) {
      status.textContent = message || '失败';
      status.classList.add('is-error');
    }
  };
}

function updateSummary() {
  modelCount.textContent = numberFormatter.format(models.length);
  totalSplats.textContent = numberFormatter.format(models.reduce((sum, model) => sum + (model.splatCount || 0), 0));
  totalSize.textContent = formatBytes(models.reduce((sum, model) => sum + (model.fileSize || 0), 0));
  listHint.textContent = models.length ? `${models.length} 个模型` : '';
}

function createIcon(name) {
  const wrapper = document.createElement('i');
  wrapper.dataset.lucide = name;
  return wrapper;
}

function getRankLabel(rankKey) {
  const rank = rankCatalog.find((entry) => entry.key === rankKey);
  return rank ? rank.name : rankKey;
}

function sortedTaxonomy(parentId) {
  return taxonomy
    .filter((entry) => (entry.parentId || null) === (parentId || null))
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function getSpecialRankPlaceholders(parentEntry) {
  const parentPosition = Number(parentEntry.rankPosition) || 0;
  const childRankKeys = new Set(sortedTaxonomy(parentEntry.id).map((entry) => entry.rankKey || entry.rank));

  return rankCatalog
    .filter((rank) => {
      if (rank.base || rank.active === false) return false;
      const position = Number(rank.position);
      if (!Number.isFinite(position) || position <= parentPosition) return false;
      if (childRankKeys.has(rank.key)) return false;

      const nextBasePosition = rankCatalog
        .filter((item) => item.base && Number(item.position) > parentPosition)
        .sort((a, b) => Number(a.position) - Number(b.position))[0]?.position;

      return nextBasePosition === undefined || position < Number(nextBasePosition);
    })
    .sort((a, b) => Number(a.position) - Number(b.position));
}

function getImmediateChildRanks(parentEntry) {
  const parentPosition = Number(parentEntry.rankPosition) || 0;
  const childRankKeys = new Set(sortedTaxonomy(parentEntry.id).map((entry) => entry.rankKey || entry.rank));
  const nextBase = rankCatalog
    .filter((rank) => rank.base && Number(rank.position) > parentPosition)
    .sort((a, b) => Number(a.position) - Number(b.position))[0];
  if (!nextBase) return [];
  const limit = Number(nextBase.position);
  return rankCatalog
    .filter((rank) => {
      const position = Number(rank.position);
      return position > parentPosition && position <= limit && !childRankKeys.has(rank.key);
    })
    .sort((a, b) => Number(a.position) - Number(b.position));
}

function getNextRankForAdd(parentEntry) {
  const parentPosition = Number(parentEntry.rankPosition) || 0;
  const nextBase = rankCatalog
    .filter((rank) => rank.base && Number(rank.position) > parentPosition)
    .sort((a, b) => Number(a.position) - Number(b.position))[0];
  if (!nextBase) return null;
  const limit = Number(nextBase.position);
  return rankCatalog
    .filter((rank) => Number(rank.position) > parentPosition && Number(rank.position) <= limit)
    .sort((a, b) => Number(a.position) - Number(b.position))[0] || null;
}

function getTaxonomyEntry(id) {
  return taxonomy.find((entry) => entry.id === id) || null;
}

function renderRankOptions(selected = '') {
  taxonomyRankInput.innerHTML = '';
  for (const rank of rankCatalog) {
    if (rank.active === false) continue;
    const option = document.createElement('option');
    option.value = rank.key;
    option.textContent = `${rank.name}${rank.nameLatin ? ' · ' + rank.nameLatin : ''}`;
    if (rank.key === selected) option.selected = true;
    taxonomyRankInput.append(option);
  }
}

function renderRankList() {
  rankList.innerHTML = '';
  rankCatalogHint.textContent = rankCatalog.length ? `${rankCatalog.length} 个阶元` : '';

  function createRankRow(rank, depth) {
    const row = document.createElement('article');
    row.className = 'rank-row';
    row.dataset.key = rank.key;
    row.style.setProperty('--rank-depth', depth);

    const badge = document.createElement('span');
    badge.className = 'rank-badge';
    badge.textContent = rank.base ? '基础' : '特殊';

    const main = document.createElement('div');
    main.className = 'rank-row-main';
    const name = document.createElement('strong');
    name.textContent = `${rank.name}${rank.nameLatin ? ' · ' + rank.nameLatin : ''}`;
    const meta = document.createElement('small');
    meta.textContent = `key: ${rank.key} · 坐标: ${rank.position} · ${rank.active ? '启用' : '停用'}`;
    main.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'model-actions';

    const editButton = document.createElement('button');
    editButton.className = 'action-button';
    editButton.type = 'button';
    editButton.disabled = !unlocked;
    editButton.setAttribute('aria-label', '编辑阶元');
    editButton.append(createIcon('pencil'));
    editButton.addEventListener('click', () => openRankEditor(rank));

    const toggleButton = document.createElement('button');
    toggleButton.className = 'action-button';
    toggleButton.type = 'button';
    toggleButton.disabled = !unlocked;
    toggleButton.setAttribute('aria-label', rank.active ? '停用阶元' : '启用阶元');
    toggleButton.append(createIcon(rank.active ? 'toggle-left' : 'toggle-right'));
    toggleButton.addEventListener('click', () => toggleRank(rank));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'action-button delete rank-delete-button';
    deleteButton.type = 'button';
    deleteButton.disabled = !unlocked;
    deleteButton.setAttribute('aria-label', '删除阶元');
    deleteButton.append(createIcon('trash-2'));
    const deleteText = document.createElement('span');
    deleteText.textContent = '删除';
    deleteButton.append(deleteText);
    deleteButton.addEventListener('click', () => deleteRank(rank));

    actions.append(editButton, toggleButton, deleteButton);

    row.append(badge, main, actions);
    rankList.append(row);
  }

  const bases = rankCatalog
    .filter((rank) => rank.base)
    .sort((a, b) => Number(a.position) - Number(b.position));
  const specials = rankCatalog
    .filter((rank) => !rank.base)
    .sort((a, b) => Number(a.position) - Number(b.position));

  bases.forEach((base, index) => {
    createRankRow(base, 0);
    const nextPosition = bases[index + 1] ? Number(bases[index + 1].position) : Infinity;
    for (const special of specials) {
      const position = Number(special.position);
      if (position > Number(base.position) && position < nextPosition) {
        createRankRow(special, 1);
      }
    }
  });

  createIcons({ icons });
}

function renderRankTree() {
  rankTree.innerHTML = '';

  function appendEntry(entry, depth) {
    const children = sortedTaxonomy(entry.id);
    const placeholderRanks = getImmediateChildRanks(entry);
    const nextRank = getNextRankForAdd(entry);
    const expanded = expandedRankTreeIds.has(entry.id);
    const row = document.createElement('article');
    row.className = 'rank-row';
    row.dataset.id = entry.id;
    row.style.setProperty('--rank-depth', depth);

    const lead = document.createElement('div');
    lead.className = 'taxonomy-row-lead';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'taxonomy-toggle';
    toggle.disabled = children.length === 0 && placeholderRanks.length === 0;
    toggle.setAttribute('aria-label', expanded ? '收起下级' : '展开下级');
    toggle.append(createIcon((children.length || placeholderRanks.length) ? (expanded ? 'chevron-down' : 'chevron-right') : 'minus'));
    toggle.addEventListener('click', () => {
      if (expanded) {
        expandedRankTreeIds.delete(entry.id);
      } else {
        expandedRankTreeIds.add(entry.id);
      }
      renderRankTree();
    });

    const badge = document.createElement('span');
    badge.className = 'rank-badge';
    badge.textContent = getRankLabel(entry.rankKey || entry.rank);
    lead.append(toggle, badge);

    const main = document.createElement('div');
    main.className = 'rank-row-main';
    const name = document.createElement('strong');
    name.textContent = `${entry.name}${entry.nameLatin ? ' · ' + entry.nameLatin : ''}`;
    const meta = document.createElement('small');
    meta.textContent = `坐标: ${entry.code || '未生成'} · 阶元坐标: ${entry.rankPosition}${entry.needsChineseName ? ' · 待补中文名' : ''}`;
    main.append(name, meta);

    const actions = document.createElement('div');
    actions.className = 'model-actions';

    if (nextRank) {
      const addButton = document.createElement('button');
      addButton.className = 'action-button rank-add-button';
      addButton.type = 'button';
      addButton.disabled = !unlocked;
      addButton.setAttribute('aria-label', '增添下一级阶元');
      addButton.append(createIcon('plus'));
      const addText = document.createElement('span');
      addText.textContent = '增添';
      addButton.append(addText);
      addButton.addEventListener('click', () => addChildToNode(entry, nextRank));
      actions.append(addButton);
    }

    const placeButton = document.createElement('button');
    placeButton.className = 'action-button';
    placeButton.type = 'button';
    placeButton.disabled = !unlocked;
    placeButton.setAttribute('aria-label', '放置特殊阶元到此节点');
    placeButton.append(createIcon('corner-down-right'));
    placeButton.addEventListener('click', () => {
      rankParentIdInput.value = entry.id;
      openRankEditor();
    });
    actions.append(placeButton);

    row.append(lead, main, actions);
    rankTree.append(row);

    if (children.length && expanded) {
      for (const child of children) {
        appendEntry(child, depth + 1);
      }
    }

    if (expanded) {
      for (const rank of placeholderRanks) {
        const placeholder = document.createElement('article');
        placeholder.className = 'rank-row rank-placeholder';
        placeholder.style.setProperty('--rank-depth', depth + 1);

        const lead = document.createElement('div');
        lead.className = 'taxonomy-row-lead';
        const badge = document.createElement('span');
        badge.className = 'rank-badge';
        badge.textContent = rank.name;
        lead.append(badge);

        const main = document.createElement('div');
        main.className = 'rank-row-main';
        const name = document.createElement('strong');
        name.textContent = `未建立：${rank.name}`;
        const meta = document.createElement('small');
        meta.textContent = `坐标: ${rank.position}`;
        main.append(name, meta);

        const actions = document.createElement('div');
        actions.className = 'model-actions';
        const addButton = document.createElement('button');
        addButton.className = 'action-button';
        addButton.type = 'button';
        addButton.disabled = !unlocked;
        addButton.setAttribute('aria-label', `新增${rank.name}`);
        addButton.append(createIcon('plus'));
        addButton.addEventListener('click', () => addRankPlaceholder(entry, rank));
        actions.append(addButton);

        placeholder.append(lead, main, actions);
        rankTree.append(placeholder);
      }
    }
  }

  for (const entry of sortedTaxonomy(null)) {
    appendEntry(entry, 0);
  }

  createIcons({ icons });
}

function openRankEditor(rank = null) {
  editingRankKey = rank?.key || null;
  rankKeyInput.value = rank?.key || '';
  rankNameInput.value = rank?.name || '';
  rankNameLatinInput.value = rank?.nameLatin || '';
  rankPositionInput.value = rank?.position || '';
  rankBaseInput.value = String(rank?.base || false);
  rankKeyInput.disabled = Boolean(rank);
  rankEditor.hidden = false;
  rankNameInput.focus();
}

function closeRankEditor() {
  editingRankKey = null;
  rankEditor.hidden = true;
  rankKeyInput.value = '';
  rankNameInput.value = '';
  rankNameLatinInput.value = '';
  rankPositionInput.value = '';
  rankBaseInput.value = 'false';
  rankParentIdInput.value = '';
  rankKeyInput.disabled = false;
}

async function saveRank() {
  if (!requireUnlocked()) return;
  const payload = {
    key: rankKeyInput.value.trim(),
    name: rankNameInput.value.trim(),
    nameLatin: rankNameLatinInput.value.trim(),
    position: Number(rankPositionInput.value),
    base: rankBaseInput.value === 'true'
  };
  if (!payload.key || !payload.name || !Number.isFinite(payload.position)) {
    showToast('请完整填写阶元 key、名称和坐标', true);
    return;
  }

  const url = editingRankKey
    ? `/api/rank-catalog/${encodeURIComponent(editingRankKey)}`
    : '/api/rank-catalog';
  const method = editingRankKey ? 'PATCH' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: authHeaders(true),
      body: JSON.stringify(payload)
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '保存阶元失败');
    }

    if (!editingRankKey && rankParentIdInput.value) {
      const taxonomyResponse = await fetch('/api/taxonomy', {
        method: 'POST',
        headers: authHeaders(true),
        body: JSON.stringify({
          name: rankNameInput.value.trim(),
          rankKey: rankKeyInput.value.trim(),
          nameLatin: rankNameLatinInput.value.trim(),
          parentId: rankParentIdInput.value,
          identificationSummary: '',
          classificationBasis: '',
          intro: '',
          active: true,
          classificationStatus: 'confirmed'
        })
      });
      if (!taxonomyResponse.ok) {
        const data = await taxonomyResponse.json();
        throw new Error(data.error || '创建分类节点失败');
      }
    }

    await loadTaxonomy();
    closeRankEditor();
    showToast('阶元已保存');
  } catch (error) {
    showToast(error.message || '保存失败', true);
  }
}

async function toggleRank(rank) {
  if (!requireUnlocked()) return;
  try {
    const response = await fetch(`/api/rank-catalog/${encodeURIComponent(rank.key)}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ active: !rank.active })
    });
    if (!response.ok) {
      const data = await response.json();
      throw new Error(data.error || '更新阶元失败');
    }
    await loadTaxonomy();
    showToast(rank.active ? '阶元已停用' : '阶元已启用');
  } catch (error) {
    showToast(error.message || '更新失败', true);
  }
}

async function deleteRank(rank) {
  if (!requireUnlocked()) return;
  if (!window.confirm(`确定删除特殊阶元“${rank.name}”吗？`)) return;

  try {
    const response = await fetch(`/api/rank-catalog/${encodeURIComponent(rank.key)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    if (!response.ok) {
      const data = await response.json();
      const message = data.error || '删除阶元失败';
      throw new Error(message);
    }
    await loadTaxonomy();
    showToast('特殊阶元已删除');
  } catch (error) {
    showToast(error.message || '删除失败', true);
  }
}

function renderParentOptions(selectedId = '', excludedId = null) {
  taxonomyParentInput.innerHTML = '';
  const none = document.createElement('option');
  none.value = '';
  none.textContent = '无（顶层）';
  taxonomyParentInput.append(none);

  const appendOptions = (parentId, depth) => {
    for (const entry of sortedTaxonomy(parentId)) {
      if (entry.id === excludedId) continue;
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = `${'　'.repeat(depth)}${entry.name}（${getRankLabel(entry.rankKey || entry.rank)}）`;
      option.disabled = entry.id === excludedId;
      if (entry.id === selectedId) option.selected = true;
      taxonomyParentInput.append(option);
      appendOptions(entry.id, depth + 1);
    }
  };

  appendOptions(null, 0);
}

function flattenTaxonomy(parentId = null, depth = 0) {
  const rows = [];
  for (const entry of sortedTaxonomy(parentId)) {
    rows.push({ entry, depth });
    rows.push(...flattenTaxonomy(entry.id, depth + 1));
  }
  return rows;
}

function openTaxonomyEditor(entry = null) {
  editingTaxonomyId = entry?.id || null;
  taxonomyNameInput.value = entry?.name || '';
  taxonomyCodeInput.value = entry?.code || '';
  taxonomyRankInput.value = entry?.rankKey || entry?.rank || 'order';
  taxonomyNameLatinInput.value = entry?.nameLatin || '';
  taxonomyActiveInput.value = String(entry?.active !== false);
  taxonomyStatusInput.value = entry?.classificationStatus || 'confirmed';
  taxonomySortInput.value = entry?.sortOrder || '';
  taxonomyKeyTextInput.value = entry?.identificationSummary || entry?.keyText || '';
  taxonomyBasisInput.value = entry?.classificationBasis || '';
  taxonomyIntroInput.value = entry?.intro || '';
  renderRankOptions(taxonomyRankInput.value);
  renderParentOptions(entry?.parentId || '', entry?.id || null);
  taxonomyEditor.hidden = false;
  taxonomyNameInput.focus();
}

function closeTaxonomyEditor() {
  editingTaxonomyId = null;
  taxonomyEditor.hidden = true;
  taxonomyNameInput.value = '';
  taxonomyCodeInput.value = '';
  taxonomyNameLatinInput.value = '';
  taxonomyActiveInput.value = 'true';
  taxonomyStatusInput.value = 'confirmed';
  taxonomySortInput.value = '';
  taxonomyKeyTextInput.value = '';
  taxonomyBasisInput.value = '';
  taxonomyIntroInput.value = '';
  renderRankOptions('');
  renderParentOptions('');
}

function addRankPlaceholder(parentEntry, rank) {
  activeTab = 'fill';
  applyTabVisibility();
  openTaxonomyEditor();
  taxonomyRankInput.value = rank.key;
  taxonomyParentInput.value = parentEntry.id;
  taxonomyNameInput.value = '';
}

function addChildToNode(parentEntry, rank) {
  activeTab = 'fill';
  applyTabVisibility();
  openTaxonomyEditor();
  taxonomyRankInput.value = rank.key;
  taxonomyParentInput.value = parentEntry.id;
  taxonomyNameInput.value = '';
  taxonomyCodeInput.value = '';
}

function createRankPlaceholderRow(parentEntry, rank, depth) {
  const row = document.createElement('article');
  row.className = 'taxonomy-row taxonomy-placeholder';
  row.style.setProperty('--taxonomy-depth', depth);

  const lead = document.createElement('div');
  lead.className = 'taxonomy-row-lead';
  const badge = document.createElement('span');
  badge.className = 'taxonomy-rank-badge';
  badge.textContent = rank.name;
  lead.append(badge);

  const main = document.createElement('div');
  main.className = 'taxonomy-row-main';
  const text = document.createElement('div');
  text.className = 'taxonomy-placeholder-text';
  text.textContent = `新增 ${rank.name}`;
  main.append(text);

  const actions = document.createElement('div');
  actions.className = 'model-actions';
  const addButton = document.createElement('button');
  addButton.className = 'action-button';
  addButton.type = 'button';
  addButton.disabled = !unlocked;
  addButton.setAttribute('aria-label', `新增${rank.name}`);
  addButton.append(createIcon('plus'));
  addButton.addEventListener('click', () => addRankPlaceholder(parentEntry, rank));
  actions.append(addButton);

  row.append(lead, main, document.createElement('div'), actions);
  taxonomyList.append(row);
}

function renderTaxonomyList() {
  taxonomyList.innerHTML = '';
  taxonomyHint.textContent = taxonomy.length ? `${taxonomy.length} 个条目` : '';

  function createTaxonomyRow(entry, depth) {
    const children = sortedTaxonomy(entry.id);
    const expanded = expandedTaxonomyAdminIds.has(entry.id);
    const row = document.createElement('article');
    row.className = 'taxonomy-row';
    row.dataset.id = entry.id;
    row.style.setProperty('--taxonomy-depth', depth);

    const lead = document.createElement('div');
    lead.className = 'taxonomy-row-lead';

    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'taxonomy-toggle';
    toggle.disabled = children.length === 0;
    toggle.setAttribute('aria-label', expanded ? '收起下级分类' : '展开下级分类');
    toggle.append(createIcon(children.length ? (expanded ? 'chevron-down' : 'chevron-right') : 'minus'));
    toggle.addEventListener('click', () => {
      if (expanded) {
        expandedTaxonomyAdminIds.delete(entry.id);
      } else {
        expandedTaxonomyAdminIds.add(entry.id);
      }
      renderTaxonomyList();
    });

    const rank = document.createElement('span');
    rank.className = 'taxonomy-rank-badge';
    rank.textContent = getRankLabel(entry.rankKey || entry.rank);
    lead.append(toggle, rank);

    const main = document.createElement('div');
    main.className = 'taxonomy-row-main';

    const nameInput = document.createElement('input');
    nameInput.className = 'taxonomy-name-input';
    nameInput.value = entry.name;
    nameInput.disabled = !unlocked;
    nameInput.setAttribute('aria-label', '分类名称');

    const codeLabel = document.createElement('div');
    codeLabel.className = 'taxonomy-code';
    codeLabel.textContent = entry.code || '未生成坐标';

    const keyInput = document.createElement('textarea');
    keyInput.className = 'taxonomy-key-input';
    keyInput.value = entry.identificationSummary || entry.keyText || '';
    keyInput.rows = 2;
    keyInput.placeholder = '鉴定特征摘要（可选）';
    keyInput.disabled = !unlocked;
    keyInput.setAttribute('aria-label', '鉴定特征摘要');

    main.append(nameInput, codeLabel, keyInput);

    const meta = document.createElement('div');
    meta.className = 'taxonomy-row-meta';
    meta.textContent = `${modelCountForTaxonomy(entry.id)} 个模型`;

    const actions = document.createElement('div');
    actions.className = 'model-actions';

    const deleteButton = document.createElement('button');
    deleteButton.className = 'action-button delete';
    deleteButton.type = 'button';
    deleteButton.disabled = !unlocked;
    deleteButton.setAttribute('aria-label', '删除分类节点');
    deleteButton.append(createIcon('trash-2'));
    deleteButton.addEventListener('click', () => deleteTaxonomy(entry));
    actions.append(deleteButton);

    const assignWrap = document.createElement('div');
    assignWrap.className = 'taxonomy-assign';

    const assignSelect = document.createElement('select');
    assignSelect.className = 'taxonomy-assign-select';
    assignSelect.setAttribute('aria-label', `选择要划入${entry.name}的模型`);
    assignSelect.disabled = !unlocked;
    const placeholder = document.createElement('option');
    placeholder.value = '';
    placeholder.textContent = '';
    placeholder.selected = true;
    assignSelect.append(placeholder);
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model.id;
      option.textContent = `${model.name}${model.taxonomyId === entry.id ? '（当前）' : ''}`;
      assignSelect.append(option);
    }

    const assignButton = document.createElement('button');
    assignButton.className = 'action-button assign-model-button';
    assignButton.type = 'button';
    assignButton.disabled = !unlocked;
    assignButton.setAttribute('aria-label', '划入此分类');
    assignButton.append(createIcon('arrow-right'));
    assignButton.addEventListener('click', () => assignModelToTaxonomy(entry.id, assignSelect));

    assignWrap.append(assignSelect, assignButton);
    row.append(lead, main, meta, actions, assignWrap);
    taxonomyList.append(row);

    if (children.length && expanded) {
      for (const child of children) {
        createTaxonomyRow(child, depth + 1);
      }
    }

    if (expanded) {
      for (const rank of getSpecialRankPlaceholders(entry)) {
        createRankPlaceholderRow(entry, rank, depth + 1);
      }
    }
  }

  for (const entry of sortedTaxonomy(null)) {
    createTaxonomyRow(entry, 0);
  }

  createIcons({ icons });
}

function modelCountForTaxonomy(id) {
  return models.filter((model) => model.taxonomyId === id).length;
}

function refreshTaxonomyDependentUi() {
  updateSummary();
  renderModelRows();
  renderTaxonomyList();
}

function renderModelRows() {
  modelList.innerHTML = '';
  emptyState.hidden = models.length !== 0;

  for (const model of models) {
    const row = document.createElement('article');
    row.className = 'model-row';
    row.dataset.id = model.id;

    const main = document.createElement('div');
    main.className = 'model-row-main';
    const attrInputs = {};

    const nameRow = document.createElement('div');
    nameRow.className = 'model-name-row';

    const thumbnailPanel = document.createElement('div');
    thumbnailPanel.className = 'model-thumbnail-panel';
    const thumbnailImage = document.createElement('img');
    thumbnailImage.className = 'model-thumbnail-image';
    thumbnailImage.crossOrigin = 'anonymous';
    thumbnailImage.src = model.thumbnail || '/thumbs/placeholder.svg';
    thumbnailImage.alt = `${model.name} 缩略图`;
    thumbnailImage.loading = 'lazy';
    thumbnailImage.addEventListener('error', () => {
      thumbnailImage.src = '/thumbs/placeholder.svg';
    }, { once: true });

    const thumbnailTools = document.createElement('div');
    thumbnailTools.className = 'model-thumbnail-tools';
    const thumbnailInput = document.createElement('input');
    thumbnailInput.type = 'file';
    thumbnailInput.accept = '.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp';
    thumbnailInput.hidden = true;
    const thumbnailButton = document.createElement('button');
    thumbnailButton.className = 'model-thumbnail-button';
    thumbnailButton.type = 'button';
    thumbnailButton.disabled = !unlocked;
    thumbnailButton.append(createIcon('image-plus'));
    const thumbnailButtonLabel = document.createElement('span');
    thumbnailButtonLabel.textContent = model.thumbnailFileName ? '更换' : '添加';
    thumbnailButton.append(thumbnailButtonLabel);
    thumbnailButton.addEventListener('click', () => {
      if (requireUnlocked()) thumbnailInput.click();
    });
    thumbnailInput.addEventListener('change', () => {
      const file = thumbnailInput.files?.[0];
      thumbnailInput.value = '';
      if (file) uploadModelThumbnail(model, file, thumbnailButton, thumbnailButtonLabel);
    });

    const thumbnailClearButton = document.createElement('button');
    thumbnailClearButton.className = 'model-thumbnail-clear';
    thumbnailClearButton.type = 'button';
    thumbnailClearButton.textContent = '清除';
    thumbnailClearButton.disabled = !unlocked;
    thumbnailClearButton.hidden = !model.thumbnailFileName;
    thumbnailClearButton.addEventListener('click', () => clearModelThumbnail(model, thumbnailClearButton));

    thumbnailTools.append(thumbnailButton, thumbnailClearButton, thumbnailInput);
    thumbnailPanel.append(thumbnailImage, thumbnailTools);

    const nameInput = document.createElement('input');
    nameInput.className = 'model-name-input';
    nameInput.value = model.name;
    nameInput.setAttribute('aria-label', '模型名称');
    nameInput.disabled = !unlocked;
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveModel(model.id, nameInput, introInput, taxonomySelect, attrInputs);
      }
    });

    nameRow.append(thumbnailPanel, nameInput);

    const meta = document.createElement('div');
    meta.className = 'model-file-meta';
    meta.textContent = `${model.originalName} · ${formatBytes(model.fileSize)}`;

    const introInput = document.createElement('textarea');
    introInput.className = 'model-intro-input';
    introInput.value = model.intro || '';
    introInput.rows = 3;
    introInput.placeholder = '填写该昆虫模型的介绍（可选）';
    introInput.setAttribute('aria-label', '模型介绍');
    introInput.disabled = !unlocked;
    introInput.addEventListener('keydown', (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key === 'Enter') {
        event.preventDefault();
        saveModel(model.id, nameInput, introInput, taxonomySelect, attrInputs);
      }
    });

    const taxonomySelect = document.createElement('select');
    taxonomySelect.className = 'model-taxonomy-select';
    taxonomySelect.setAttribute('aria-label', '模型分类');
    taxonomySelect.disabled = !unlocked;
    const emptyOption = document.createElement('option');
    emptyOption.value = '';
    emptyOption.textContent = '未分类';
    taxonomySelect.append(emptyOption);
    for (const { entry, depth } of flattenTaxonomy()) {
      const option = document.createElement('option');
      option.value = entry.id;
      option.textContent = `${'　'.repeat(depth)}${entry.name}`;
      if (entry.id === model.taxonomyId) option.selected = true;
      taxonomySelect.append(option);
    }

    const attributionGroup = document.createElement('div');
    attributionGroup.className = 'model-attribution';
    for (const [fieldKey, fieldLabel] of Object.entries(ATTRIBUTION_FIELDS)) {
      const label = document.createElement('label');
      label.className = 'model-attribution-field';
      const span = document.createElement('span');
      span.textContent = fieldLabel;
      const input = document.createElement('input');
      input.type = 'text';
      input.value = model.attribution?.[fieldKey] || '';
      input.placeholder = fieldLabel;
      input.disabled = !unlocked;
      input.setAttribute('aria-label', fieldLabel);
      attrInputs[fieldKey] = input;
      label.append(span, input);
      attributionGroup.append(label);
    }

    const attributionHistoryEl = document.createElement('div');
    attributionHistoryEl.className = 'model-attribution-history';
    const attributionLog = Array.isArray(model.attributionLog) ? model.attributionLog : [];
    if (attributionLog.length) {
      const seen = { collector: 0, identifier: 0, builder: 0 };
      for (const entry of attributionLog) {
        seen[entry.field] = (seen[entry.field] || 0) + 1;
        const round = seen[entry.field] + 1;
        const line = document.createElement('span');
        line.textContent = `${ATTRIBUTION_FIELDS[entry.field] || entry.field} 第${round}次：${entry.value}`;
        attributionHistoryEl.append(line);
      }
    }

    main.append(nameRow, meta, introInput, taxonomySelect, attributionGroup, attributionHistoryEl);

    const details = document.createElement('div');
    details.className = 'model-details';
    details.innerHTML = `
      <span><strong>${numberFormatter.format(model.splatCount || 0)}</strong> 高斯点</span>
      <span>更新于 ${dateFormatter.format(new Date(model.updatedAt || Date.now()))}</span>
    `;

    const actions = document.createElement('div');
    actions.className = 'model-actions';

    const saveButton = document.createElement('button');
    saveButton.className = 'action-button';
    saveButton.type = 'button';
    saveButton.setAttribute('aria-label', '保存修改');
    saveButton.disabled = !unlocked;
    saveButton.append(createIcon('save'));
    saveButton.addEventListener('click', () => saveModel(model.id, nameInput, introInput, taxonomySelect, attrInputs));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'action-button delete';
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', '删除模型');
    deleteButton.disabled = !unlocked;
    deleteButton.append(createIcon('trash-2'));
    deleteButton.addEventListener('click', () => deleteModel(model));

    actions.append(saveButton, deleteButton);
    row.append(main, details, actions);
    modelList.append(row);
  }

  createIcons({ icons });
}

async function loadModels(render = true) {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error('无法读取模型列表。');
  }
  const data = await response.json();
  models = data.models || [];
  if (render) refreshTaxonomyDependentUi();
}

async function loadTaxonomy(render = true) {
  const response = await fetch('/api/taxonomy');
  if (!response.ok) {
    throw new Error('无法读取分类列表。');
  }
  const data = await response.json();
  taxonomy = data.taxonomy || [];
  rankCatalog = data.rankCatalog || [];
  if (!render) return;
  renderTaxonomyList();
  renderRankList();
  renderRankTree();
  renderRankOptions(taxonomyRankInput.value || '');
  renderModelRows();
}

async function saveModel(id, nameInput, introInput, taxonomySelect, attrInputs) {
  if (!requireUnlocked()) return;

  const nextName = nameInput.value.trim();
  if (!nextName) {
    nameInput.value = models.find((model) => model.id === id)?.name || '';
    showToast('模型名称不能为空', true);
    return;
  }

  const nextIntro = (introInput?.value || '').trim();
  const nextTaxonomyId = taxonomySelect?.value || null;
  const nextAttribution = attrInputs
    ? {
        collector: (attrInputs.collector?.value || '').trim(),
        identifier: (attrInputs.identifier?.value || '').trim(),
        builder: (attrInputs.builder?.value || '').trim()
      }
    : undefined;

  try {
    const payload = { name: nextName, intro: nextIntro, taxonomyId: nextTaxonomyId };
    if (nextAttribution) payload.attribution = nextAttribution;

    const response = await fetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '保存失败。');
    }

    const data = await response.json();
    const model = models.find((item) => item.id === id);
    if (model) {
      model.name = nextName;
      model.intro = nextIntro;
      model.taxonomyId = nextTaxonomyId;
      if (data.model?.attribution) model.attribution = data.model.attribution;
      if (Array.isArray(data.model?.attributionLog)) model.attributionLog = data.model.attributionLog;
    }
    refreshTaxonomyDependentUi();
    showToast('修改已保存');
  } catch (error) {
    showToast(error.message || '保存失败', true);
  }
}

async function uploadModelThumbnail(model, file, button, buttonLabel) {
  if (!requireUnlocked()) return;
  if (!SUPPORTED_THUMBNAIL_EXTENSIONS.includes(fileExtension(file.name))) {
    showToast('缩略图只支持 JPG / PNG / WebP', true);
    return;
  }

  const formData = new FormData();
  formData.append('thumbnail', file);
  const previousLabel = buttonLabel.textContent;
  button.disabled = true;
  buttonLabel.textContent = '上传中';

  try {
    const response = await fetch(`/api/models/${encodeURIComponent(model.id)}/thumbnail`, {
      method: 'PUT',
      headers: authHeaders(),
      body: formData
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '缩略图上传失败。');
    }

    Object.assign(model, data.model || {});
    renderModelRows();
    showToast(data.warning || '缩略图已更新');
  } catch (error) {
    button.disabled = false;
    buttonLabel.textContent = previousLabel;
    showToast(error.message || '缩略图上传失败', true);
  }
}

async function clearModelThumbnail(model, button) {
  if (!requireUnlocked()) return;
  if (!window.confirm(`确定清除“${model.name}”的缩略图吗？`)) return;

  button.disabled = true;
  try {
    const response = await fetch(`/api/models/${encodeURIComponent(model.id)}/thumbnail`, {
      method: 'DELETE',
      headers: authHeaders()
    });
    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.error || '缩略图清除失败。');
    }

    Object.assign(model, data.model || {});
    renderModelRows();
    showToast(data.warning || '缩略图已清除');
  } catch (error) {
    button.disabled = false;
    showToast(error.message || '缩略图清除失败', true);
  }
}

async function deleteModel(model) {
  if (!requireUnlocked()) return;

  if (!window.confirm(`确定删除“${model.name}”吗？`)) return;

  try {
    const response = await fetch(`/api/models/${encodeURIComponent(model.id)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '删除失败。');
    }

    models = models.filter((item) => item.id !== model.id);
    updateSummary();
    renderModelRows();
    showToast('模型已删除');
  } catch (error) {
    showToast(error.message || '删除失败', true);
  }
}

async function saveTaxonomyRow(id, nameInput, keyInput) {
  if (!requireUnlocked()) return;

  const name = nameInput.value.trim();
  if (!name) {
    nameInput.value = getTaxonomyEntry(id)?.name || '';
    showToast('分类名称不能为空', true);
    return;
  }

  const entry = getTaxonomyEntry(id);
  if (!entry) {
    showToast('分类条目不存在', true);
    return;
  }

  try {
    const response = await fetch(`/api/taxonomy/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({
        name,
        rank: entry.rank,
        parentId: entry.parentId,
        keyText: (keyInput?.value || '').trim(),
        sortOrder: entry.sortOrder
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '保存失败。');
    }

    const data = await response.json();
    Object.assign(entry, data.entry);
    refreshTaxonomyDependentUi();
    showToast('分类已保存');
  } catch (error) {
    showToast(error.message || '保存失败', true);
  }
}

async function assignModelToTaxonomy(taxonomyId, assignSelect) {
  if (!requireUnlocked()) return;

  const modelId = assignSelect?.value;
  if (!modelId) {
    showToast('请选择要划入的模型', true);
    return;
  }

  const entry = getTaxonomyEntry(taxonomyId);
  const model = models.find((item) => item.id === modelId);
  if (!entry || !model) return;

  try {
    const response = await fetch(`/api/models/${encodeURIComponent(modelId)}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ taxonomyId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '划入分类失败。');
    }

    const data = await response.json();
    model.taxonomyId = taxonomyId;
    model.taxonomyName = data.model?.taxonomyName || entry.name;
    refreshTaxonomyDependentUi();
    showToast(`已将“${model.name}”划入${entry.name}`);
  } catch (error) {
    showToast(error.message || '划入分类失败', true);
  }
}

async function deleteTaxonomy(entry) {
  if (!requireUnlocked()) return;
  if (!window.confirm(`确定删除“${entry.name}”吗？`)) return;

  try {
    const response = await fetch(`/api/taxonomy/${encodeURIComponent(entry.id)}`, {
      method: 'DELETE',
      headers: authHeaders()
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '删除失败。');
    }

    taxonomy = taxonomy.filter((item) => item.id !== entry.id);
    refreshTaxonomyDependentUi();
    showToast('分类已删除');
  } catch (error) {
    showToast(error.message || '删除失败', true);
  }
}

async function submitTaxonomyEditor() {
  if (!requireUnlocked()) return;

  const name = taxonomyNameInput.value.trim();
  if (!name) {
    showToast('分类名称不能为空', true);
    taxonomyNameInput.focus();
    return;
  }

  const payload = {
    name,
    code: taxonomyCodeInput.value.trim(),
    rankKey: taxonomyRankInput.value,
    nameLatin: taxonomyNameLatinInput.value.trim(),
    parentId: taxonomyParentInput.value || null,
    identificationSummary: taxonomyKeyTextInput.value.trim(),
    classificationBasis: taxonomyBasisInput.value.trim(),
    intro: taxonomyIntroInput.value.trim(),
    active: taxonomyActiveInput.value === 'true',
    classificationStatus: taxonomyStatusInput.value,
    sortOrder: Number(taxonomySortInput.value) || undefined
  };

  const url = editingTaxonomyId
    ? `/api/taxonomy/${encodeURIComponent(editingTaxonomyId)}`
    : '/api/taxonomy';
  const method = editingTaxonomyId ? 'PATCH' : 'POST';

  try {
    const response = await fetch(url, {
      method,
      headers: authHeaders(true),
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '保存失败。');
    }

    const data = await response.json();
    if (editingTaxonomyId) {
      const entry = getTaxonomyEntry(editingTaxonomyId);
      Object.assign(entry, data.entry);
    } else {
      taxonomy.push(data.entry);
    }

    closeTaxonomyEditor();
    refreshTaxonomyDependentUi();
    showToast('分类已保存');
  } catch (error) {
    showToast(error.message || '保存失败', true);
  }
}

function uploadFile(file, task) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.replace(/\.[^.]+$/, ''));

    const request = new XMLHttpRequest();
    request.open('POST', '/api/models');
    request.setRequestHeader('X-Admin-Key', adminKey);
    task.setStatus('上传中 0%');
    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      task.setProgress((event.loaded / event.total) * 100);
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        const result = JSON.parse(request.responseText);
        task.setDone();
        resolve(result);
      } else {
        let message = '上传失败。';
        try {
          message = JSON.parse(request.responseText).error || message;
        } catch (error) {}
        task.setError(message);
        reject(new Error(message));
      }
    });
    request.addEventListener('error', () => {
      task.setError('网络错误，上传失败。');
      reject(new Error('网络错误，上传失败。'));
    });
    request.send(formData);
  });
}

async function handleFiles(files) {
  if (!requireUnlocked()) return;

  const fileArray = Array.from(files).filter((file) => SUPPORTED_MODEL_EXTENSIONS.includes(fileExtension(file.name)));
  if (fileArray.length === 0) {
    showToast('请选择 PLY / SPZ / SPLAT / KSPLAT 文件', true);
    return;
  }

  uploadTasks.replaceChildren();
  const tasks = fileArray.map((file) => createUploadTask(file));
  uploadTasks.hidden = false;
  uploadZone.setAttribute('aria-busy', 'true');

  let doneCount = 0;
  let failCount = 0;
  const CONCURRENCY = 3;
  let cursor = 0;
  const worker = async () => {
    while (cursor < fileArray.length) {
      const index = cursor++;
      try {
        const result = await uploadFile(fileArray[index], tasks[index]);
        models.unshift(result.model);
        doneCount += 1;
      } catch (error) {
        failCount += 1;
        showToast(`${fileArray[index].name}: ${error.message || '上传失败'}`, true);
      }
      updateSummary();
      renderModelRows();
    }
  };
  await Promise.all(Array.from({ length: Math.min(CONCURRENCY, fileArray.length) }, worker));

  uploadZone.removeAttribute('aria-busy');
  fileInput.value = '';

  if (fileArray.length === 1 && failCount === 0) {
    showToast('上传完成');
  } else if (fileArray.length > 1) {
    showToast(`批量上传完成：成功 ${doneCount} 个，失败 ${failCount} 个`);
  }

  window.setTimeout(() => {
    uploadTasks.replaceChildren();
    uploadTasks.hidden = true;
  }, 4000);
}

uploadZone.addEventListener('click', () => {
  if (!requireUnlocked()) return;
  fileInput.click();
});
uploadForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (!requireUnlocked()) return;
  handleFiles(fileInput.files);
});
fileInput.addEventListener('change', () => {
  if (!requireUnlocked()) return;
  handleFiles(fileInput.files);
});

for (const eventName of ['dragenter', 'dragover']) {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.add('is-dragging');
  });
}

for (const eventName of ['dragleave', 'drop']) {
  uploadZone.addEventListener(eventName, (event) => {
    event.preventDefault();
    uploadZone.classList.remove('is-dragging');
  });
}

uploadZone.addEventListener('drop', (event) => {
  if (!requireUnlocked()) return;
  handleFiles(event.dataTransfer.files);
});

addTaxonomyButton.addEventListener('click', () => {
  if (!requireUnlocked()) return;
  openTaxonomyEditor();
});

addRankButton.addEventListener('click', () => {
  if (!requireUnlocked()) return;
  openRankEditor();
});

taxonomySaveButton.addEventListener('click', submitTaxonomyEditor);
taxonomyCancelButton.addEventListener('click', closeTaxonomyEditor);
rankSaveButton.addEventListener('click', saveRank);
rankCancelButton.addEventListener('click', closeRankEditor);
taxonomyNameInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') {
    event.preventDefault();
    submitTaxonomyEditor();
  }
});

unlockForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  const key = adminKeyInput.value.trim();
  if (!key) {
    showToast('请输入管理秘钥', true);
    adminKeyInput.focus();
    return;
  }

  try {
    const response = await fetch('/api/admin/verify', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ key })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || '管理秘钥不正确。');
    }

    adminKey = key;
    unlocked = true;
    sessionStorage.setItem('admin-unlocked', 'true');
    sessionStorage.setItem('admin-key', key);
    adminKeyInput.value = '';
    renderAuthState();
    showToast('编辑已解锁');
  } catch (error) {
    showToast(error.message || '解锁失败', true);
    adminKeyInput.focus();
  }
});

lockButton.addEventListener('click', () => {
  unlocked = false;
  adminKey = '';
  sessionStorage.removeItem('admin-unlocked');
  sessionStorage.removeItem('admin-key');
  renderAuthState();
  showToast('编辑已锁定');
});

tabRankBtn.addEventListener('click', () => {
  activeTab = 'rank';
  applyTabVisibility();
});

tabFillBtn.addEventListener('click', () => {
  activeTab = 'fill';
  applyTabVisibility();
});

tabModelsBtn.addEventListener('click', () => {
  activeTab = 'models';
  applyTabVisibility();
});

readStoredAuth();
renderAuthState();
Promise.all([loadModels(false), loadTaxonomy(false)])
  .then(() => {
    updateSummary();
    renderAuthState();
    renderRankOptions(taxonomyRankInput.value || '');
  })
  .catch((error) => {
    showToast(error.message || '加载失败', true);
  });
