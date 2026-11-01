import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';
import { createIcons, icons } from 'lucide';

const stage = document.getElementById('stage');
const modelSwitcher = document.getElementById('model-switcher');
const modelName = document.getElementById('model-name');
const splatCount = document.getElementById('splat-count');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const progressTrack = document.getElementById('progress-track');
const progressFill = document.getElementById('progress-fill');
const autoRotateButton = document.getElementById('auto-rotate');
const resetViewButton = document.getElementById('reset-view');
const fullscreenButton = document.getElementById('fullscreen');
const introText = document.getElementById('intro-text');
const searchInput = document.getElementById('search-input');
const searchClear = document.getElementById('search-clear');
const searchResults = document.getElementById('search-results');
const taxonomyTree = document.getElementById('taxonomy-tree');
const activeFilter = document.getElementById('active-filter');
const activeFilterLabel = document.getElementById('active-filter-label');
const activeFilterClear = document.getElementById('active-filter-clear');
const infoTaxonomy = document.getElementById('info-taxonomy');
const sidePanel = document.getElementById('side-panel');
const panelCollapse = document.getElementById('panel-collapse');
const allModelsToggle = document.getElementById('all-models-toggle');
const allModelsList = document.getElementById('all-models-list');
const taxonomyDrawer = document.getElementById('taxonomy-drawer');
const taxonomyDrawerTitle = document.getElementById('taxonomy-drawer-title');
const taxonomyDrawerList = document.getElementById('taxonomy-drawer-list');
const taxonomyDrawerClose = document.getElementById('taxonomy-drawer-close');

let models = [];
let allModels = [];
let taxonomy = [];
let modelButtons = [];
let viewer = null;
let activeIndex = 0;
let busy = false;
let modelLoaded = false;
let taxonomyFilterId = null;
let searchTimer = null;
const expandedTaxonomyIds = new Set();

const requestedModel = new URLSearchParams(window.location.search).get('model');
const formatter = new Intl.NumberFormat('zh-CN');

createIcons({ icons });

function setStatus(text, state = 'loading') {
  statusText.textContent = text;
  statusDot.className = 'status-dot';

  if (state === 'ready') {
    statusDot.classList.add('is-ready');
  } else if (state === 'error') {
    statusDot.classList.add('is-error');
  }
}

function setProgress(percent) {
  const normalized = Math.max(0, Math.min(100, Number(percent) || 0));
  progressFill.style.width = `${normalized}%`;
  progressTrack.style.opacity = normalized >= 100 ? '0' : '1';
}

function setButtonsDisabled(disabled) {
  modelButtons.forEach((button) => {
    button.disabled = disabled;
  });
}

function setModelInfo(index) {
  const model = models[index];
  if (!model) return;

  modelName.textContent = model.name;
  splatCount.textContent = formatter.format(model.splatCount || 0);
  infoTaxonomy.textContent = model.taxonomyName || '未分类';
  infoTaxonomy.classList.toggle('is-empty', !model.taxonomyName);
  introText.textContent = model.intro?.trim() || '暂无介绍。';
  modelButtons.forEach((button, buttonIndex) => {
    button.setAttribute('aria-selected', String(buttonIndex === index));
  });
  renderAllModelsList();
}

function renderModelSwitcher() {
  modelSwitcher.innerHTML = '';
  modelButtons = [];

  models.forEach((model, index) => {
    const button = document.createElement('button');
    button.className = 'model-button';
    button.type = 'button';
    button.role = 'tab';
    button.setAttribute('aria-selected', String(index === activeIndex));

    const icon = document.createElement('i');
    icon.dataset.lucide = index % 2 === 0 ? 'film' : 'bug';

    const label = document.createElement('span');
    label.textContent = model.name;

    button.append(icon, label);
    button.addEventListener('click', () => switchModel(index));
    modelSwitcher.append(button);
    modelButtons.push(button);
  });

  createIcons({ icons });
}

function getFilteredModels() {
  if (!taxonomyFilterId) return allModels;
  return allModels.filter((model) => model.taxonomyId === taxonomyFilterId);
}

function getTaxonomyEntry(id) {
  return taxonomy.find((entry) => entry.id === id) || null;
}

function updateActiveFilter() {
  const entry = getTaxonomyEntry(taxonomyFilterId);
  activeFilter.hidden = !entry;
  if (entry) {
    activeFilterLabel.textContent = `分类：${entry.name}`;
  }
}

function getTaxonomyModelCount(id) {
  return allModels.filter((model) => model.taxonomyId === id).length;
}

function sortedTaxonomyChildren(parentId) {
  return taxonomy
    .filter((entry) => (entry.parentId || null) === (parentId || null))
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function createTaxonomyElement(entry, depth) {
  const children = sortedTaxonomyChildren(entry.id);
  const expanded = expandedTaxonomyIds.has(entry.id);
  const isSelected = taxonomyFilterId === entry.id;
  const wrapper = document.createElement('div');
  wrapper.className = 'taxonomy-branch';
  wrapper.style.setProperty('--taxonomy-depth', depth);

  const row = document.createElement('div');
  row.className = 'taxonomy-entry';
  row.classList.toggle('is-selected', isSelected);

  const toggle = document.createElement('button');
  toggle.type = 'button';
  toggle.className = 'taxonomy-toggle';
  toggle.setAttribute('aria-label', expanded ? '收起子分类' : '展开子分类');
  toggle.append(createTaxonomyIcon(children.length ? (expanded ? 'chevron-down' : 'chevron-right') : 'minus'));
  toggle.disabled = children.length === 0;
  toggle.addEventListener('click', () => {
    if (expanded) {
      expandedTaxonomyIds.delete(entry.id);
    } else {
      expandedTaxonomyIds.add(entry.id);
    }
    renderTaxonomyTree();
  });

  const select = document.createElement('button');
  select.type = 'button';
  select.className = 'taxonomy-select';
  select.append(createTaxonomyIcon('bug'));

  const copy = document.createElement('span');
  copy.className = 'taxonomy-copy';
  const heading = document.createElement('span');
  heading.className = 'taxonomy-heading';

  const rank = document.createElement('span');
  rank.className = 'taxonomy-rank';
  rank.textContent = entry.rankLabel || entry.rank;

  const name = document.createElement('span');
  name.className = 'taxonomy-name';
  name.textContent = entry.name;
  heading.append(rank, name);

  const count = document.createElement('span');
  count.className = 'taxonomy-count';
  count.textContent = `${getTaxonomyModelCount(entry.id)} 个模型`;
  copy.append(heading, count);
  select.append(copy);

  select.addEventListener('click', () => {
    openTaxonomyDrawer(entry);
  });

  row.append(toggle, select);
  wrapper.append(row);

  if (entry.keyText) {
    const key = document.createElement('p');
    key.className = 'taxonomy-key';
    key.textContent = entry.keyText;
    wrapper.append(key);
  }

  if (children.length && expanded) {
    const childContainer = document.createElement('div');
    childContainer.className = 'taxonomy-children';
    for (const child of children) {
      childContainer.append(createTaxonomyElement(child, depth + 1));
    }
    wrapper.append(childContainer);
  }

  return wrapper;
}

function createTaxonomyIcon(name) {
  const icon = document.createElement('i');
  icon.dataset.lucide = name;
  return icon;
}

function renderTaxonomyTree() {
  taxonomyTree.innerHTML = '';

  for (const entry of sortedTaxonomyChildren(null)) {
    taxonomyTree.append(createTaxonomyElement(entry, 0));
  }

  createIcons({ icons });
}

function getTaxonomyDescendantIds(rootId) {
  const ids = [rootId];
  const queue = [rootId];

  while (queue.length) {
    const parentId = queue.shift();
    for (const entry of taxonomy) {
      if ((entry.parentId || null) === parentId) {
        ids.push(entry.id);
        queue.push(entry.id);
      }
    }
  }

  return ids;
}

function getModelsForTaxonomy(entryId) {
  const ids = new Set(getTaxonomyDescendantIds(entryId));
  return allModels
    .filter((model) => ids.has(model.taxonomyId))
    .sort((a, b) => a.name.localeCompare(b.name, 'zh-CN'));
}

function renderTaxonomyDrawer(entry) {
  taxonomyDrawerTitle.textContent = entry.name;
  taxonomyDrawerList.innerHTML = '';

  const drawerModels = getModelsForTaxonomy(entry.id);
  if (drawerModels.length === 0) {
    const empty = document.createElement('p');
    empty.className = 'taxonomy-drawer-empty';
    empty.textContent = '该分类下暂无模型。';
    taxonomyDrawerList.append(empty);
    return;
  }

  for (const model of drawerModels) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'taxonomy-drawer-item';
    button.classList.toggle('is-active', model.id === models[activeIndex]?.id);
    button.append(createTaxonomyIcon('box'));

    const copy = document.createElement('span');
    copy.className = 'taxonomy-drawer-copy';
    const name = document.createElement('strong');
    name.textContent = model.name;
    const meta = document.createElement('small');
    meta.textContent = `${model.taxonomyName || '未分类'} · ${formatter.format(model.splatCount || 0)} 点`;
    copy.append(name, meta);
    button.append(copy);

    button.addEventListener('click', () => {
      focusModelById(model.id);
      closeTaxonomyDrawer();
    });
    taxonomyDrawerList.append(button);
  }

  createIcons({ icons });
}

function openTaxonomyDrawer(entry) {
  if (!entry) return;
  renderTaxonomyDrawer(entry);
  taxonomyDrawer.hidden = false;
  requestAnimationFrame(() => taxonomyDrawer.classList.add('is-open'));
}

function closeTaxonomyDrawer() {
  taxonomyDrawer.classList.remove('is-open');
  taxonomyDrawer.hidden = true;
}

function renderAllModelsList() {
  allModelsList.innerHTML = '';

  allModels.forEach((model) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'all-model-item';
    button.classList.toggle('is-active', model.id === models[activeIndex]?.id);
    button.append(createTaxonomyIcon('box'));

    const copy = document.createElement('span');
    copy.className = 'all-model-copy';

    const name = document.createElement('strong');
    name.textContent = model.name;

    const meta = document.createElement('small');
    meta.textContent = model.taxonomyName || '未分类';

    copy.append(name, meta);
    button.append(copy);
    button.addEventListener('click', () => focusModelById(model.id));
    allModelsList.append(button);
  });

  createIcons({ icons });
}

function setAllModelsCollapsed(collapsed) {
  allModelsList.hidden = collapsed;
  allModelsToggle.setAttribute('aria-pressed', String(!collapsed));
  allModelsToggle.innerHTML = '';
  const icon = document.createElement('i');
  icon.dataset.lucide = collapsed ? 'chevron-down' : 'chevron-up';
  allModelsToggle.append(icon);
  createIcons({ icons });
}

function getCameraFrame(model) {
  const radius = Math.max(...(model.size || [1, 1, 1])) / 2;
  const distance = Math.max(radius * 1.65, radius + 5);
  const center = model.center || [0, 0, 0];
  const target = new THREE.Vector3(...center);
  const position = new THREE.Vector3(
    center[0],
    center[1] + radius * 0.22,
    center[2] + distance
  );

  return { target, position };
}

function frameCurrentModel() {
  if (!viewer || !viewer.controls || !viewer.camera || !models[activeIndex]) return;

  const frame = getCameraFrame(models[activeIndex]);
  viewer.camera.up.set(0, 1, 0);
  viewer.camera.position.copy(frame.position);
  viewer.camera.lookAt(frame.target);
  viewer.controls.target.copy(frame.target);
  viewer.controls.update();
}

function waitForViewerIdle() {
  return new Promise((resolve) => {
    const check = () => {
      if (!viewer || !viewer.isLoadingOrUnloading()) {
        resolve();
        return;
      }
      window.setTimeout(check, 120);
    };

    check();
  });
}

function createViewer() {
  const model = models[activeIndex];
  const frame = getCameraFrame(model);
  const isMobile = /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent) || window.innerWidth < 768;
  const canUseSharedMemory = window.isSecureContext && window.crossOriginIsolated;

  viewer = new GaussianSplats3D.Viewer({
    rootElement: stage,
    cameraUp: [0, 1, 0],
    initialCameraPosition: frame.position.toArray(),
    initialCameraLookAt: frame.target.toArray(),
    useBuiltInControls: true,
    selfDrivenMode: true,
    sharedMemoryForWorkers: false,
    gpuAcceleratedSort: false,
    integerBasedSort: false,
    enableSIMDInSort: false,
    kernel2DSize: isMobile ? 0.7 : 0.55,
    splatSortDistanceMapPrecision: 20,
    renderMode: GaussianSplats3D.RenderMode.Always,
    sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
    logLevel: GaussianSplats3D.LogLevel.None,
    sphericalHarmonicsDegree: 0,
    halfPrecisionCovariancesOnGPU: false,
    maxScreenSpaceSplatSize: isMobile ? 1024 : 2048,
    optimizeSplatData: false,
    freeIntermediateSplatData: false
  });

  viewer.controls.autoRotate = false;
  viewer.controls.autoRotateSpeed = 0.45;
  viewer.start();
  viewer.showInfo = false;
  if (viewer.infoPanel) viewer.infoPanel.hide();
}

async function loadActiveModel() {
  const model = models[activeIndex];
  if (!model || !viewer) return;

  busy = true;
  modelLoaded = false;
  setStatus('正在加载', 'loading');
  setProgress(0);
  setButtonsDisabled(true);

  try {
    if (viewer.splatMesh && viewer.splatMesh.scenes.length > 0) {
      await viewer.removeSplatScene(0, false);
    }

    frameCurrentModel();

    const loadPromise = viewer.addSplatScene(model.path, {
      progressiveLoad: model.splatCount > 100000,
      showLoadingUI: false,
      splatAlphaRemovalThreshold: 1,
      onProgress: (percentComplete, label) => {
        setProgress(percentComplete);

        if (percentComplete >= 100) {
          setStatus('正在完成模型构建', 'loading');
        } else if (label && label.includes('%')) {
          setStatus(`正在加载 ${label}`, 'loading');
        }
      }
    });

    await loadPromise;
    await waitForViewerIdle();

    if (!modelLoaded) {
      setStatus('模型已就绪', 'ready');
      modelLoaded = true;
      busy = false;
      setButtonsDisabled(false);
    }
  } catch (error) {
    console.error(error);
    setStatus('模型加载失败', 'error');
    setProgress(100);
    modelLoaded = false;
    busy = false;
    setButtonsDisabled(false);
  }
}

async function switchModel(index) {
  if (index === activeIndex || busy) return;

  activeIndex = index;
  setModelInfo(index);
  await loadActiveModel();
}

async function applyModelFilter(taxonomyId) {
  const previousId = models[activeIndex]?.id;
  taxonomyFilterId = taxonomyId || null;
  models = getFilteredModels();
  updateActiveFilter();

  let nextIndex = models.findIndex((model) => model.id === previousId);
  if (nextIndex < 0) nextIndex = 0;
  activeIndex = nextIndex;
  renderModelSwitcher();

  if (models.length === 0) {
    modelName.textContent = '暂无模型';
    splatCount.textContent = '0';
    infoTaxonomy.textContent = '未分类';
    introText.textContent = '该分类下暂时还没有模型。';
    setStatus('该分类下暂无模型', 'error');
    return;
  }

  setModelInfo(activeIndex);

  if (!viewer) {
    createViewer();
    await loadActiveModel();
    return;
  }

  await loadActiveModel();
}

async function focusModelById(id) {
  if (!id) return;

  let index = models.findIndex((model) => model.id === id);
  if (index < 0) {
    taxonomyFilterId = null;
    models = allModels;
    updateActiveFilter();
    renderModelSwitcher();
    index = models.findIndex((model) => model.id === id);
  }

  if (index < 0) return;
  activeIndex = index;
  setModelInfo(index);
  await loadActiveModel();
}

function localSearch(query) {
  const needle = query.trim().toLocaleLowerCase('zh-CN');
  if (!needle) {
    return { models: [], taxonomy: [] };
  }

  const modelResults = allModels
    .filter((model) => {
      const haystack = [model.name, model.taxonomyName, model.intro || ''].join(' ');
      return haystack.toLocaleLowerCase('zh-CN').includes(needle);
    })
    .slice(0, 8);

  const taxonomyResults = taxonomy
    .filter((entry) => {
      const haystack = [entry.name, entry.keyText || '', entry.rankLabel || ''].join(' ');
      return haystack.toLocaleLowerCase('zh-CN').includes(needle);
    })
    .slice(0, 8);

  return { models: modelResults, taxonomy: taxonomyResults };
}

function renderSearchResults(results) {
  searchResults.innerHTML = '';

  if (results.models.length === 0 && results.taxonomy.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'search-empty';
    empty.textContent = '没有找到匹配的模型或分类。';
    searchResults.append(empty);
    searchResults.hidden = false;
    return;
  }

  if (results.models.length) {
    const heading = document.createElement('div');
    heading.className = 'search-section-title';
    heading.textContent = '模型';
    searchResults.append(heading);

    for (const model of results.models) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result';
      button.append(createTaxonomyIcon('box'));
      const copy = document.createElement('span');
      copy.className = 'search-result-copy';
      const name = document.createElement('strong');
      name.textContent = model.name;
      const meta = document.createElement('small');
      meta.textContent = model.taxonomyName || '未分类';
      copy.append(name, meta);
      button.append(copy);
      button.addEventListener('click', () => {
        hideSearchResults();
        searchInput.value = model.name;
        focusModelById(model.id);
      });
      searchResults.append(button);
    }
  }

  if (results.taxonomy.length) {
    const heading = document.createElement('div');
    heading.className = 'search-section-title';
    heading.textContent = '分类条目';
    searchResults.append(heading);

    for (const entry of results.taxonomy) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'search-result taxonomy-result';
      button.append(createTaxonomyIcon('list-tree'));
      const copy = document.createElement('span');
      copy.className = 'search-result-copy';
      const name = document.createElement('strong');
      name.textContent = `${entry.name}${entry.rankLabel ? ` · ${entry.rankLabel}` : ''}`;
      const meta = document.createElement('small');
      meta.textContent = entry.keyText || `${getTaxonomyModelCount(entry.id)} 个模型`;
      copy.append(name, meta);
      button.append(copy);
      button.addEventListener('click', () => {
        hideSearchResults();
        searchInput.value = entry.name;
        taxonomyFilterId = entry.id;
        updateActiveFilter();
        renderTaxonomyTree();
        applyModelFilter(entry.id);
      });
      searchResults.append(button);
    }
  }

  searchResults.hidden = false;
  createIcons({ icons });
}

function hideSearchResults() {
  searchResults.hidden = true;
}

function showSearchResults(query) {
  renderSearchResults(localSearch(query));
}

function setPanelCollapsed(collapsed) {
  sidePanel.classList.toggle('is-collapsed', collapsed);
  if (collapsed) closeTaxonomyDrawer();
  panelCollapse.setAttribute('aria-pressed', String(collapsed));
  panelCollapse.innerHTML = '';
  const icon = document.createElement('i');
  icon.dataset.lucide = collapsed ? 'panel-left-open' : 'panel-left-close';
  panelCollapse.append(icon);
  createIcons({ icons });
}

function normalizeModel(rawModel) {
  return {
    id: rawModel.id,
    name: rawModel.name || '未命名模型',
    fileName: rawModel.fileName,
    path: rawModel.url || `/models/${encodeURIComponent(rawModel.fileName || '')}`,
    splatCount: rawModel.splatCount || 0,
    center: Array.isArray(rawModel.center) ? rawModel.center : [0, 0, 0],
    size: Array.isArray(rawModel.size) ? rawModel.size : [1, 1, 1],
    intro: rawModel.intro || '',
    taxonomyId: rawModel.taxonomyId || null,
    taxonomyName: rawModel.taxonomyName || ''
  };
}

async function loadModels() {
  const response = await fetchWithRetry('/api/models');
  if (!response.ok) {
    throw new Error('无法读取模型列表。');
  }

  const data = await response.json();
  allModels = (data.models || []).map(normalizeModel);
  models = getFilteredModels();

  const requestedIndex = allModels.findIndex((model, index) => {
    return model.id === requestedModel || model.name === requestedModel || String(index + 1) === requestedModel;
  });
  activeIndex = requestedIndex >= 0 ? requestedIndex : 0;
}

async function loadTaxonomy() {
  const response = await fetchWithRetry('/api/taxonomy');
  if (!response.ok) {
    throw new Error('无法读取分类列表。');
  }

  const data = await response.json();
  taxonomy = data.taxonomy || [];
  renderTaxonomyTree();
}

async function fetchWithRetry(url, retries = 3) {
  let lastError;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetch(url);
      if (response.status !== 520) return response;
      lastError = new Error('服务器正在预热，请稍后重试。');
    } catch (error) {
      lastError = error;
    }

    if (attempt < retries - 1) {
      setStatus(`正在连接服务器 ${attempt + 1}/${retries}`, 'loading');
      await new Promise((resolve) => window.setTimeout(resolve, 1200 * (attempt + 1)));
    }
  }

  throw lastError;
}

async function initialize() {
  try {
    await Promise.all([loadModels(), loadTaxonomy()]);

    if (models.length === 0) {
      setStatus('暂无模型', 'error');
      return;
    }

    renderModelSwitcher();
    renderTaxonomyTree();
    updateActiveFilter();
    setModelInfo(activeIndex);
    setAllModelsCollapsed(true);
    createViewer();
    await loadActiveModel();
  } catch (error) {
    console.error(error);
    setStatus('模型清单加载失败', 'error');
  }
}

autoRotateButton.addEventListener('click', () => {
  if (!viewer || !viewer.controls) return;

  viewer.controls.autoRotate = !viewer.controls.autoRotate;
  autoRotateButton.setAttribute('aria-pressed', String(viewer.controls.autoRotate));
});

resetViewButton.addEventListener('click', () => {
  if (!viewer) return;
  frameCurrentModel();
});

fullscreenButton.addEventListener('click', async () => {
  try {
    if (document.fullscreenElement) {
      await document.exitFullscreen();
    } else {
      await document.documentElement.requestFullscreen();
    }
  } catch (error) {
    console.error(error);
  }
});

document.addEventListener('fullscreenchange', () => {
  fullscreenButton.setAttribute('aria-pressed', String(Boolean(document.fullscreenElement)));
});

searchInput.addEventListener('input', () => {
  window.clearTimeout(searchTimer);
  const query = searchInput.value;
  searchClear.hidden = query.length === 0;
  if (!query.trim()) {
    hideSearchResults();
    return;
  }

  searchTimer = window.setTimeout(() => {
    showSearchResults(query);
  }, 160);
});

searchInput.addEventListener('focus', () => {
  if (searchInput.value.trim()) showSearchResults(searchInput.value);
});

searchInput.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    searchInput.value = '';
    searchClear.hidden = true;
    hideSearchResults();
    searchInput.blur();
  }
});

searchClear.addEventListener('click', () => {
  searchInput.value = '';
  searchClear.hidden = true;
  hideSearchResults();
  searchInput.focus();
});

document.addEventListener('click', (event) => {
  if (!searchResults.hidden && !event.target.closest('.search-box')) {
    hideSearchResults();
  }
});

document.addEventListener('keydown', (event) => {
  const target = event.target;
  const isTyping = target instanceof HTMLElement && (
    target.tagName === 'INPUT' ||
    target.tagName === 'TEXTAREA' ||
    target.isContentEditable
  );

  if (event.key.toLowerCase() === 'i') {
    if (!isTyping) event.preventDefault();
    event.stopPropagation();
  }
});

panelCollapse.addEventListener('click', () => {
  setPanelCollapsed(!sidePanel.classList.contains('is-collapsed'));
});

allModelsToggle.addEventListener('click', () => {
  setAllModelsCollapsed(!allModelsList.hidden);
});

taxonomyDrawerClose.addEventListener('click', closeTaxonomyDrawer);

activeFilterClear.addEventListener('click', () => {
  applyModelFilter(null);
});

initialize();
