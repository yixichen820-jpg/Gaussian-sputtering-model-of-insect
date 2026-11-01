import { createIcons, icons } from 'lucide';

const modelList = document.getElementById('model-list');
const emptyState = document.getElementById('empty-state');
const modelCount = document.getElementById('model-count');
const totalSplats = document.getElementById('total-splats');
const totalSize = document.getElementById('total-size');
const listHint = document.getElementById('list-hint');
const uploadZone = document.getElementById('upload-zone');
const fileInput = document.getElementById('file-input');
const uploadForm = document.getElementById('upload-form');
const uploadProgress = document.getElementById('upload-progress');
const uploadProgressName = document.getElementById('upload-progress-name');
const uploadProgressPercent = document.getElementById('upload-progress-percent');
const uploadProgressFill = document.getElementById('upload-progress-fill');
const authGate = document.getElementById('auth-gate');
const uploadSection = document.getElementById('upload-section');
const unlockForm = document.getElementById('unlock-form');
const adminKeyInput = document.getElementById('admin-key-input');
const lockButton = document.getElementById('lock-button');
const toast = document.getElementById('toast');
const addTaxonomyButton = document.getElementById('add-taxonomy-button');
const taxonomyEditor = document.getElementById('taxonomy-editor');
const taxonomyNameInput = document.getElementById('taxonomy-name');
const taxonomyRankInput = document.getElementById('taxonomy-rank');
const taxonomyParentInput = document.getElementById('taxonomy-parent');
const taxonomySortInput = document.getElementById('taxonomy-sort');
const taxonomyKeyTextInput = document.getElementById('taxonomy-key-text');
const taxonomySaveButton = document.getElementById('taxonomy-save');
const taxonomyCancelButton = document.getElementById('taxonomy-cancel');
const taxonomyList = document.getElementById('taxonomy-list');
const taxonomyHint = document.getElementById('taxonomy-hint');

let models = [];
let taxonomy = [];
let unlocked = false;
let adminKey = '';
let editingTaxonomyId = null;

createIcons({ icons });

const numberFormatter = new Intl.NumberFormat('zh-CN');
const dateFormatter = new Intl.DateTimeFormat('zh-CN', {
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit'
});

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

function renderAuthState() {
  authGate.hidden = unlocked;
  uploadSection.hidden = !unlocked;
  lockButton.hidden = !unlocked;
  addTaxonomyButton.disabled = !unlocked;
  if (!unlocked && !taxonomyEditor.hidden) closeTaxonomyEditor();
  renderModelRows();
  renderTaxonomyList();
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

function setUploadProgress(name, percent) {
  uploadProgress.hidden = false;
  uploadProgressName.textContent = name;
  uploadProgressPercent.textContent = `${Math.round(percent)}%`;
  uploadProgressFill.style.width = `${Math.max(0, Math.min(100, percent))}%`;
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

const taxonomyRankLabels = {
  order: '目',
  family: '科',
  genus: '属',
  species: '种'
};

function sortedTaxonomy(parentId) {
  return taxonomy
    .filter((entry) => (entry.parentId || null) === (parentId || null))
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function getTaxonomyEntry(id) {
  return taxonomy.find((entry) => entry.id === id) || null;
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
      option.textContent = `${'　'.repeat(depth)}${entry.name}（${taxonomyRankLabels[entry.rank] || entry.rank}）`;
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
  taxonomyRankInput.value = entry?.rank || 'order';
  taxonomySortInput.value = entry?.sortOrder || '';
  taxonomyKeyTextInput.value = entry?.keyText || '';
  renderParentOptions(entry?.parentId || '', entry?.id || null);
  taxonomyEditor.hidden = false;
  taxonomyNameInput.focus();
}

function closeTaxonomyEditor() {
  editingTaxonomyId = null;
  taxonomyEditor.hidden = true;
  taxonomyNameInput.value = '';
  taxonomyRankInput.value = 'order';
  taxonomySortInput.value = '';
  taxonomyKeyTextInput.value = '';
  renderParentOptions('');
}

function renderTaxonomyList() {
  taxonomyList.innerHTML = '';
  taxonomyHint.textContent = taxonomy.length ? `${taxonomy.length} 个条目` : '';

  for (const { entry, depth } of flattenTaxonomy()) {
    const row = document.createElement('article');
    row.className = 'taxonomy-row';
    row.dataset.id = entry.id;
    row.style.setProperty('--taxonomy-depth', depth);

    const rank = document.createElement('span');
    rank.className = 'taxonomy-rank-badge';
    rank.textContent = taxonomyRankLabels[entry.rank] || entry.rank;

    const main = document.createElement('div');
    main.className = 'taxonomy-row-main';

    const nameInput = document.createElement('input');
    nameInput.className = 'taxonomy-name-input';
    nameInput.value = entry.name;
    nameInput.disabled = !unlocked;
    nameInput.setAttribute('aria-label', '分类名称');

    const keyInput = document.createElement('textarea');
    keyInput.className = 'taxonomy-key-input';
    keyInput.value = entry.keyText || '';
    keyInput.rows = 2;
    keyInput.placeholder = '检索特征（可选）';
    keyInput.disabled = !unlocked;
    keyInput.setAttribute('aria-label', '检索特征');

    main.append(nameInput, keyInput);

    const meta = document.createElement('div');
    meta.className = 'taxonomy-row-meta';
    meta.textContent = `${modelCountForTaxonomy(entry.id)} 个模型`;

    const actions = document.createElement('div');
    actions.className = 'model-actions';

    const saveButton = document.createElement('button');
    saveButton.className = 'action-button';
    saveButton.type = 'button';
    saveButton.setAttribute('aria-label', '保存分类');
    saveButton.disabled = !unlocked;
    saveButton.append(createIcon('save'));
    saveButton.addEventListener('click', () => saveTaxonomyRow(entry.id, nameInput, keyInput));

    const deleteButton = document.createElement('button');
    deleteButton.className = 'action-button delete';
    deleteButton.type = 'button';
    deleteButton.setAttribute('aria-label', '删除分类');
    deleteButton.disabled = !unlocked;
    deleteButton.append(createIcon('trash-2'));
    deleteButton.addEventListener('click', () => deleteTaxonomy(entry));

    actions.append(saveButton, deleteButton);

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
    row.append(rank, main, meta, actions, assignWrap);
    taxonomyList.append(row);
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

    const nameRow = document.createElement('div');
    nameRow.className = 'model-name-row';

    const fileIcon = document.createElement('span');
    fileIcon.className = 'model-file-icon';
    fileIcon.append(createIcon('file-box'));

    const nameInput = document.createElement('input');
    nameInput.className = 'model-name-input';
    nameInput.value = model.name;
    nameInput.setAttribute('aria-label', '模型名称');
    nameInput.disabled = !unlocked;
    nameInput.addEventListener('keydown', (event) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        saveModel(model.id, nameInput, introInput, taxonomySelect);
      }
    });

    nameRow.append(fileIcon, nameInput);

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
        saveModel(model.id, nameInput, introInput, taxonomySelect);
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

    main.append(nameRow, meta, introInput, taxonomySelect);

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
    saveButton.addEventListener('click', () => saveModel(model.id, nameInput, introInput, taxonomySelect));

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

async function loadModels() {
  const response = await fetch('/api/models');
  if (!response.ok) {
    throw new Error('无法读取模型列表。');
  }
  const data = await response.json();
  models = data.models || [];
  refreshTaxonomyDependentUi();
}

async function loadTaxonomy() {
  const response = await fetch('/api/taxonomy');
  if (!response.ok) {
    throw new Error('无法读取分类列表。');
  }
  const data = await response.json();
  taxonomy = data.taxonomy || [];
  renderTaxonomyList();
  renderModelRows();
}

async function saveModel(id, nameInput, introInput, taxonomySelect) {
  if (!requireUnlocked()) return;

  const nextName = nameInput.value.trim();
  if (!nextName) {
    nameInput.value = models.find((model) => model.id === id)?.name || '';
    showToast('模型名称不能为空', true);
    return;
  }

  const nextIntro = (introInput?.value || '').trim();
  const nextTaxonomyId = taxonomySelect?.value || null;

  try {
    const response = await fetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ name: nextName, intro: nextIntro, taxonomyId: nextTaxonomyId })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '保存失败。');
    }

    const model = models.find((item) => item.id === id);
    if (model) {
      model.name = nextName;
      model.intro = nextIntro;
      model.taxonomyId = nextTaxonomyId;
    }
    refreshTaxonomyDependentUi();
    showToast('修改已保存');
  } catch (error) {
    showToast(error.message || '保存失败', true);
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
    rank: taxonomyRankInput.value,
    parentId: taxonomyParentInput.value || null,
    keyText: taxonomyKeyTextInput.value.trim(),
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

function uploadFile(file, index, total) {
  return new Promise((resolve, reject) => {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('name', file.name.replace(/\.ply$/i, ''));

    const request = new XMLHttpRequest();
    request.open('POST', '/api/models');
    request.setRequestHeader('X-Admin-Key', adminKey);
    request.upload.addEventListener('progress', (event) => {
      if (!event.lengthComputable) return;
      const filePercent = (event.loaded / event.total) * 100;
      const overallPercent = ((index + filePercent / 100) / total) * 100;
      setUploadProgress(file.name, overallPercent);
    });
    request.addEventListener('load', () => {
      if (request.status >= 200 && request.status < 300) {
        resolve(JSON.parse(request.responseText));
      } else {
        let message = '上传失败。';
        try {
          message = JSON.parse(request.responseText).error || message;
        } catch (error) {}
        reject(new Error(message));
      }
    });
    request.addEventListener('error', () => reject(new Error('网络错误，上传失败。')));
    request.send(formData);
  });
}

async function handleFiles(files) {
  if (!requireUnlocked()) return;

  const fileArray = Array.from(files).filter((file) => file.name.toLowerCase().endsWith('.ply'));
  if (fileArray.length === 0) {
    showToast('请选择 PLY 文件', true);
    return;
  }

  uploadZone.setAttribute('aria-busy', 'true');
  for (let index = 0; index < fileArray.length; index++) {
    try {
      const result = await uploadFile(fileArray[index], index, fileArray.length);
      models.unshift(result.model);
      updateSummary();
      renderModelRows();
      if (fileArray.length === 1) {
        showToast(`${result.model.name} 上传完成`);
      }
    } catch (error) {
      showToast(error.message || '上传失败', true);
    }
  }

  if (fileArray.length > 1) {
    showToast('批量上传完成');
  }

  uploadZone.removeAttribute('aria-busy');
  uploadProgress.hidden = true;
  uploadProgressFill.style.width = '0%';
  fileInput.value = '';
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

taxonomySaveButton.addEventListener('click', submitTaxonomyEditor);
taxonomyCancelButton.addEventListener('click', closeTaxonomyEditor);
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

readStoredAuth();
renderAuthState();
Promise.all([loadModels(), loadTaxonomy()]).catch((error) => {
  showToast(error.message || '加载失败', true);
});
