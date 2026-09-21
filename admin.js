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

let models = [];
let unlocked = false;
let adminKey = '';

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
  renderModelRows();
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
        saveModelName(model.id, nameInput);
      }
    });

    nameRow.append(fileIcon, nameInput);

    const meta = document.createElement('div');
    meta.className = 'model-file-meta';
    meta.textContent = `${model.originalName} · ${formatBytes(model.fileSize)}`;

    main.append(nameRow, meta);

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
    saveButton.setAttribute('aria-label', '保存名称');
    saveButton.disabled = !unlocked;
    saveButton.append(createIcon('save'));
    saveButton.addEventListener('click', () => saveModelName(model.id, nameInput));

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
  updateSummary();
  renderModelRows();
}

async function saveModelName(id, input) {
  if (!requireUnlocked()) return;

  const nextName = input.value.trim();
  if (!nextName) {
    input.value = models.find((model) => model.id === id)?.name || '';
    showToast('模型名称不能为空', true);
    return;
  }

  try {
    const response = await fetch(`/api/models/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: authHeaders(true),
      body: JSON.stringify({ name: nextName })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error || '保存失败。');
    }

    const model = models.find((item) => item.id === id);
    if (model) model.name = nextName;
    updateSummary();
    showToast('名称已保存');
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
loadModels().catch((error) => {
  showToast(error.message || '加载失败', true);
});
