import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';
import replaceElement from './node_modules/lucide/dist/esm/replaceElement.mjs';
import ArrowLeft from './node_modules/lucide/dist/esm/icons/arrow-left.mjs';
import Box from './node_modules/lucide/dist/esm/icons/box.mjs';
import Bug from './node_modules/lucide/dist/esm/icons/bug.mjs';
import ChevronDown from './node_modules/lucide/dist/esm/icons/chevron-down.mjs';
import ChevronLeft from './node_modules/lucide/dist/esm/icons/chevron-left.mjs';
import ChevronRight from './node_modules/lucide/dist/esm/icons/chevron-right.mjs';
import ChevronUp from './node_modules/lucide/dist/esm/icons/chevron-up.mjs';
import Funnel from './node_modules/lucide/dist/esm/icons/funnel.mjs';
import ListTree from './node_modules/lucide/dist/esm/icons/list-tree.mjs';
import LocateFixed from './node_modules/lucide/dist/esm/icons/locate-fixed.mjs';
import Maximize from './node_modules/lucide/dist/esm/icons/maximize.mjs';
import Minus from './node_modules/lucide/dist/esm/icons/minus.mjs';
import Moon from './node_modules/lucide/dist/esm/icons/moon.mjs';
import PanelLeftClose from './node_modules/lucide/dist/esm/icons/panel-left-close.mjs';
import PanelLeftOpen from './node_modules/lucide/dist/esm/icons/panel-left-open.mjs';
import RotateCw from './node_modules/lucide/dist/esm/icons/rotate-cw.mjs';
import Search from './node_modules/lucide/dist/esm/icons/search.mjs';
import Settings2 from './node_modules/lucide/dist/esm/icons/settings-2.mjs';
import Share2 from './node_modules/lucide/dist/esm/icons/share-2.mjs';
import Sun from './node_modules/lucide/dist/esm/icons/sun.mjs';
import X from './node_modules/lucide/dist/esm/icons/x.mjs';
import { TrackballControls } from 'three/addons/controls/TrackballControls.js';

const icons = {
  ArrowLeft,
  Box,
  Bug,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Filter: Funnel,
  ListTree,
  LocateFixed,
  Maximize,
  Minus,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  RotateCw,
  Search,
  Settings2,
  Share2,
  Sun,
  X
};

function createIcons({ root = document } = {}) {
  root.querySelectorAll('[data-lucide]').forEach((element) => {
    replaceElement(element, { nameAttr: 'data-lucide', icons, attrs: {} });
  });
}

const stage = document.getElementById('stage');
const stagePrompt = document.getElementById('stage-prompt');
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
const sidePanelTitleText = document.getElementById('side-panel-title-text');
const panelCollapse = document.getElementById('panel-collapse');
const allModelsToggle = document.getElementById('all-models-toggle');
const allModelsList = document.getElementById('all-models-list');
const taxonomyDrawer = document.getElementById('taxonomy-drawer');
const taxonomyDrawerTitle = document.getElementById('taxonomy-drawer-title');
const taxonomyDrawerList = document.getElementById('taxonomy-drawer-list');
const taxonomyDrawerClose = document.getElementById('taxonomy-drawer-close');
const viewBallElement = document.getElementById('view-ball');
const viewBallCanvas = document.getElementById('view-ball-canvas');
const shareButton = document.getElementById('share');
const themeToggle = document.getElementById('theme-toggle');
const toast = document.getElementById('toast');
const attrCollector = document.getElementById('attr-collector');
const attrIdentifier = document.getElementById('attr-identifier');
const attrBuilder = document.getElementById('attr-builder');
const attributionHistory = document.getElementById('attribution-history');
const attributionHistoryToggle = document.getElementById('attribution-history-toggle');
const attributionHistoryList = document.getElementById('attribution-history-list');
const attributionHistoryCount = document.getElementById('attribution-history-count');
const catalogView = document.getElementById('catalog-view');
const catalogTree = document.getElementById('catalog-tree');
const catalogPanelHost = document.getElementById('catalog-panel-host');
const catalogGrid = document.getElementById('catalog-grid');
const catalogEmpty = document.getElementById('catalog-empty');
const catalogTitle = document.getElementById('catalog-title');
const catalogRank = document.getElementById('catalog-rank');
const catalogResetFilter = document.getElementById('catalog-reset-filter');
const catalogSearchInput = document.getElementById('catalog-search-input');
const catalogThemeToggle = document.getElementById('catalog-theme-toggle');
const catalogPageSizeSelect = document.getElementById('catalog-page-size');
const catalogTotal = document.getElementById('catalog-total');
const catalogPrev = document.getElementById('catalog-prev');
const catalogNext = document.getElementById('catalog-next');
const catalogPageNumbers = document.getElementById('catalog-page-numbers');
const catalogBack = document.getElementById('catalog-back');
const sidePanelHomeParent = sidePanel.parentNode;
const sidePanelHomeNextSibling = sidePanel.nextSibling;

let models = [];
let allModels = [];
let taxonomy = [];
let rankCatalog = [];
let viewer = null;
let activeIndex = 0;
let busy = false;
let modelLoaded = false;
let taxonomyFilterId = null;
let searchTimer = null;
let viewBall = null;
let loadSequence = 0;
let pendingModelIndex = null;
let catalogFilterId = null;
let catalogPage = 1;
let catalogPageSize = 12;
let catalogQuery = '';
let catalogTargetModelId = null;
const expandedTaxonomyIds = new Set();
const expandedCatalogIds = new Set();
let ancestorSectionOpen = false;

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

function setModelInfo(index) {
  const model = models[index];
  if (!model) return;

  modelName.textContent = model.name;
  splatCount.textContent = formatter.format(model.splatCount || 0);
  infoTaxonomy.textContent = model.taxonomyName || '未分类';
  infoTaxonomy.classList.toggle('is-empty', !model.taxonomyName);
  introText.textContent = model.intro?.trim() || '暂无介绍。';
  renderAttribution(model);
  renderAllModelsList();
}

function getModelThumbnail(model) {
  return model?.thumbnail || `/thumbs/${encodeURIComponent(model?.id || '')}.jpg`;
}

function createModelThumbnail(model, className = '') {
  const image = document.createElement('img');
  image.className = className;
  image.crossOrigin = 'anonymous';
  image.src = getModelThumbnail(model);
  image.alt = '';
  image.loading = 'lazy';
  image.decoding = 'async';
  image.addEventListener('error', () => {
    image.src = '/thumbs/placeholder.svg';
  }, { once: true });
  return image;
}

function showStagePrompt() {
  if (stagePrompt) stagePrompt.hidden = false;
  stage.classList.add('is-empty');
}

function hideStagePrompt() {
  if (stagePrompt) stagePrompt.hidden = true;
  stage.classList.remove('is-empty');
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
    .filter((entry) => (entry.parentId || null) === (parentId || null) && entry.active !== false)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function getTaxonomyAncestorIds(entryId) {
  const ancestors = [];
  let current = getTaxonomyEntry(entryId);
  const seen = new Set();

  while (current && current.parentId && !seen.has(current.parentId)) {
    seen.add(current.parentId);
    const parent = getTaxonomyEntry(current.parentId);
    if (!parent) break;
    ancestors.push(parent.id);
    current = parent;
  }

  return ancestors;
}

function isInsectTreeOrder(entry) {
  if (!entry || entry.rankKey !== 'order' || entry.active === false) return false;
  const ancestors = getTaxonomyAncestorIds(entry.id);
  return ancestors.includes('taxon-insecta');
}

function getDefaultOrderRoots() {
  return taxonomy
    .filter(isInsectTreeOrder)
    .sort((a, b) => (Number(a.sortOrder) || 0) - (Number(b.sortOrder) || 0));
}

function getSpecialRankPlaceholders(parentEntry) {
  const parentPosition = Number(parentEntry.rankPosition) || 0;
  const childRankKeys = new Set(
    sortedTaxonomyChildren(parentEntry.id).map((entry) => entry.rankKey || entry.rank)
  );

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

function createRankPlaceholderElement(rank, depth) {
  const wrapper = document.createElement('div');
  wrapper.className = 'taxonomy-branch taxonomy-placeholder';
  wrapper.style.setProperty('--taxonomy-depth', depth);

  const row = document.createElement('div');
  row.className = 'taxonomy-entry';
  const badge = document.createElement('span');
  badge.className = 'taxonomy-rank';
  badge.textContent = rank.name;
  const name = document.createElement('span');
  name.className = 'taxonomy-name';
  name.textContent = '未建立下级';
  row.append(badge, name);
  wrapper.append(row);
  return wrapper;
}

function getDisplayAncestorEntries() {
  const ancestors = new Map();
  for (const root of getDefaultOrderRoots()) {
    for (const ancestorId of getTaxonomyAncestorIds(root.id)) {
      const entry = getTaxonomyEntry(ancestorId);
      if (entry && entry.rankKey !== 'order') {
        ancestors.set(entry.id, entry);
      }
    }
  }

  return [...ancestors.values()].sort((a, b) => {
    return (Number(a.rankPosition) || 0) - (Number(b.rankPosition) || 0);
  });
}

function createAncestorSection() {
  const section = document.createElement('div');
  section.className = 'taxonomy-ancestors';

  const head = document.createElement('button');
  head.type = 'button';
  head.className = 'taxonomy-ancestors-toggle';
  head.innerHTML = '';
  head.append(createTaxonomyIcon('chevron-down'));
  const label = document.createElement('span');
  label.textContent = '上级分类';
  head.append(label);

  const list = document.createElement('div');
  list.className = 'taxonomy-ancestors-list';
  list.hidden = !ancestorSectionOpen;

  const kingdom = getTaxonomyEntry('taxon-animalia');
  if (kingdom) {
    list.append(createTaxonomyElement(kingdom, 0));
  }

  head.addEventListener('click', () => {
    list.hidden = !list.hidden;
    ancestorSectionOpen = !list.hidden;
    head.innerHTML = '';
    head.append(createTaxonomyIcon(list.hidden ? 'chevron-down' : 'chevron-up'));
    const title = document.createElement('span');
    title.textContent = '上级分类';
    head.append(title);
    createIcons({ icons });
  });

  section.append(head, list);
  return section;
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
    if (!catalogView.hidden) {
      catalogFilterId = entry.id;
      taxonomyFilterId = entry.id;
      catalogPage = 1;
      if (children.length) expandedTaxonomyIds.add(entry.id);
      updateActiveFilter();
      renderCatalogHeader();
      renderCatalogGrid();
      renderTaxonomyTree();
      return;
    }

    if (children.length === 0) {
      openTaxonomyDrawer(entry);
      return;
    }

    if (expanded) {
      expandedTaxonomyIds.delete(entry.id);
    } else {
      expandedTaxonomyIds.add(entry.id);
    }
    renderTaxonomyTree();
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

  if (expanded) {
    const placeholders = getSpecialRankPlaceholders(entry);
    if (placeholders.length) {
      const placeholderContainer = document.createElement('div');
      placeholderContainer.className = 'taxonomy-children';
      for (const rank of placeholders) {
        placeholderContainer.append(createRankPlaceholderElement(rank, depth + 1));
      }
      wrapper.append(placeholderContainer);
    }
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

  taxonomyTree.append(createAncestorSection());
  const sectionDivider = document.createElement('div');
  sectionDivider.className = 'taxonomy-section-divider';
  sectionDivider.textContent = '目级分类';
  taxonomyTree.append(sectionDivider);

  for (const entry of getDefaultOrderRoots()) {
    taxonomyTree.append(createTaxonomyElement(entry, 0));
  }

  createIcons({ icons });
}

function getCatalogModels() {
  const allowedIds = catalogFilterId ? new Set(getTaxonomyDescendantIds(catalogFilterId)) : null;
  const needle = catalogQuery.trim().toLocaleLowerCase('zh-CN');
  return allModels.filter((model) => {
    if (allowedIds && !allowedIds.has(model.taxonomyId)) return false;
    if (!needle) return true;
    const path = getTaxonomyPath(model.taxonomyId).join(' ');
    return `${model.name} ${path}`.toLocaleLowerCase('zh-CN').includes(needle);
  });
}

function getTaxonomyPath(taxonomyId) {
  const path = [];
  let current = getTaxonomyEntry(taxonomyId);
  const seen = new Set();
  while (current && !seen.has(current.id)) {
    seen.add(current.id);
    path.unshift(current.name);
    current = current.parentId ? getTaxonomyEntry(current.parentId) : null;
  }
  return path.length ? path : ['未分类'];
}

function getCatalogCard(model) {
  const card = document.createElement('button');
  card.type = 'button';
  card.className = 'catalog-card';
  card.dataset.modelId = model.id;
  card.classList.toggle('is-target', model.id === catalogTargetModelId);

  const imageWrap = document.createElement('span');
  imageWrap.className = 'catalog-card-image-wrap';
  const image = createModelThumbnail(model, 'catalog-card-image');
  imageWrap.append(image);

  const body = document.createElement('span');
  body.className = 'catalog-card-body';
  const name = document.createElement('strong');
  name.className = 'catalog-card-name';
  name.textContent = model.name;
  const path = document.createElement('span');
  path.className = 'catalog-card-path';
  path.textContent = getTaxonomyPath(model.taxonomyId).join(' › ');
  body.append(name, path);

  card.append(imageWrap, body);
  card.addEventListener('click', () => openCatalogModel(model));
  return card;
}

function renderCatalogHeader() {
  const entry = getTaxonomyEntry(catalogFilterId);
  catalogTitle.textContent = entry?.name || '全部模型';
  catalogRank.textContent = entry?.rankLabel || entry?.rankKey || entry?.rank || 'ALL';
}

function renderCatalogGrid() {
  if (!catalogGrid) return;
  const filtered = getCatalogModels();
  const pageCount = Math.max(1, Math.ceil(filtered.length / catalogPageSize));
  catalogPage = Math.min(catalogPage, pageCount);
  const start = (catalogPage - 1) * catalogPageSize;
  const pageModels = filtered.slice(start, start + catalogPageSize);

  catalogGrid.replaceChildren(...pageModels.map(getCatalogCard));
  catalogGrid.hidden = pageModels.length === 0;
  catalogEmpty.hidden = pageModels.length !== 0;
  catalogTotal.textContent = `共 ${filtered.length} 条记录`;
  catalogPrev.disabled = catalogPage <= 1;
  catalogNext.disabled = catalogPage >= pageCount;

  catalogPageNumbers.replaceChildren();
  const firstPage = Math.max(1, Math.min(catalogPage - 2, pageCount - 4));
  const lastPage = Math.min(pageCount, firstPage + 4);
  for (let page = firstPage; page <= lastPage; page += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'catalog-page-number';
    button.textContent = String(page);
    button.classList.toggle('is-active', page === catalogPage);
    button.addEventListener('click', () => {
      catalogPage = page;
      renderCatalogGrid();
    });
    catalogPageNumbers.append(button);
  }
}

function renderCatalogTree() {
  if (!catalogTree) return;
  catalogTree.replaceChildren();

  const allButton = document.createElement('button');
  allButton.type = 'button';
  allButton.className = 'catalog-tree-entry';
  allButton.classList.toggle('is-active', !catalogFilterId);
  const allLabel = document.createElement('span');
  allLabel.className = 'catalog-tree-label';
  const allName = document.createElement('strong');
  allName.textContent = '全部模型';
  const allMeta = document.createElement('small');
  allMeta.textContent = `${allModels.length} 个模型`;
  allLabel.append(allName, allMeta);
  allButton.append(allLabel);
  allButton.addEventListener('click', () => {
    catalogFilterId = null;
    catalogPage = 1;
    renderCatalogTree();
    renderCatalogHeader();
    renderCatalogGrid();
  });
  catalogTree.append(allButton);

  const renderEntry = (entry, depth) => {
    const children = sortedTaxonomyChildren(entry.id);
    const expanded = expandedCatalogIds.has(entry.id);
    const count = getTaxonomyDescendantIds(entry.id)
      .reduce((sum, id) => sum + allModels.filter((model) => model.taxonomyId === id).length, 0);

    const row = document.createElement('div');
    row.className = 'catalog-tree-row';
    const toggle = document.createElement('button');
    toggle.type = 'button';
    toggle.className = 'catalog-tree-toggle';
    toggle.disabled = children.length === 0;
    toggle.setAttribute('aria-label', expanded ? '收起分类' : '展开分类');
    toggle.append(createTaxonomyIcon(children.length ? (expanded ? 'chevron-down' : 'chevron-right') : 'minus'));
    toggle.addEventListener('click', () => {
      expanded ? expandedCatalogIds.delete(entry.id) : expandedCatalogIds.add(entry.id);
      renderCatalogTree();
    });

    const select = document.createElement('button');
    select.type = 'button';
    select.className = 'catalog-tree-entry';
    select.classList.toggle('is-active', catalogFilterId === entry.id);
    const label = document.createElement('span');
    label.className = 'catalog-tree-label';
    const name = document.createElement('strong');
    name.textContent = entry.name;
    const meta = document.createElement('small');
    meta.textContent = `${entry.rankLabel || entry.rankKey || entry.rank || '分类'} · ${count} 个模型`;
    label.append(name, meta);
    select.append(label);
    select.addEventListener('click', () => {
      catalogFilterId = entry.id;
      catalogPage = 1;
      getTaxonomyAncestorIds(entry.id).forEach((id) => expandedCatalogIds.add(id));
      renderCatalogTree();
      renderCatalogHeader();
      renderCatalogGrid();
    });

    const wrapper = document.createElement('div');
    wrapper.style.paddingLeft = `${depth * 11}px`;
    row.append(toggle, select);
    wrapper.append(row);
    if (expanded && children.length) {
      const childWrap = document.createElement('div');
      childWrap.className = 'catalog-tree-children';
      children.forEach((child) => childWrap.append(renderEntry(child, depth + 1)));
      wrapper.append(childWrap);
    }
    return wrapper;
  };

  getDefaultOrderRoots().forEach((entry) => catalogTree.append(renderEntry(entry, 0)));
  createIcons({ icons });
}

async function openCatalogModel(model) {
  const index = allModels.findIndex((item) => item.id === model.id);
  if (index < 0) return;
  document.body.classList.remove('catalog-open');
  sidePanel.classList.remove('is-catalog-mode');
  sidePanelTitleText.textContent = '分类与介绍';
  if (sidePanelHomeParent) {
    if (sidePanelHomeNextSibling && sidePanelHomeNextSibling.parentNode === sidePanelHomeParent) {
      sidePanelHomeParent.insertBefore(sidePanel, sidePanelHomeNextSibling);
    } else {
      sidePanelHomeParent.append(sidePanel);
    }
  }
  catalogView.hidden = true;
  taxonomyFilterId = null;
  models = allModels;
  setModelInfo(index);
  await switchModel(index);
}

function openCatalog() {
  catalogView.hidden = false;
  document.body.classList.add('catalog-open');
  sidePanel.classList.add('is-catalog-mode');
  sidePanelTitleText.textContent = '分类条目';
  if (catalogPanelHost && sidePanel.parentNode !== catalogPanelHost) {
    catalogPanelHost.append(sidePanel);
  }
  sidePanel.classList.remove('is-collapsed');
  panelCollapse.setAttribute('aria-pressed', 'false');
  panelCollapse.innerHTML = '<i data-lucide="panel-left-close"></i>';
  renderTaxonomyTree();
  renderCatalogTree();
  renderCatalogHeader();
  renderCatalogGrid();
  createIcons({ icons });
}

function openCatalogForModel(modelId) {
  const index = allModels.findIndex((model) => model.id === modelId);
  catalogTargetModelId = modelId;
  catalogFilterId = null;
  taxonomyFilterId = null;
  catalogQuery = '';
  catalogSearchInput.value = '';
  catalogPage = index >= 0 ? Math.floor(index / catalogPageSize) + 1 : 1;
  updateActiveFilter();
  openCatalog();
  requestAnimationFrame(() => {
    const card = catalogGrid.querySelector(`[data-model-id="${CSS.escape(modelId)}"]`);
    card?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  });
}

function getTaxonomyDescendantIds(rootId) {
  const ids = [rootId];
  const queue = [rootId];

  while (queue.length) {
    const parentId = queue.shift();
    for (const entry of taxonomy) {
      if ((entry.parentId || null) === parentId && entry.active !== false) {
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
    button.append(createModelThumbnail(model, 'taxonomy-drawer-thumb'));
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
      openCatalogForModel(model.id);
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
    button.append(createModelThumbnail(model, 'all-model-thumb'));
    button.append(createTaxonomyIcon('box'));

    const copy = document.createElement('span');
    copy.className = 'all-model-copy';

    const name = document.createElement('strong');
    name.textContent = model.name;

    const meta = document.createElement('small');
    meta.textContent = model.taxonomyName || '未分类';

    copy.append(name, meta);
    button.append(copy);
    button.addEventListener('click', () => openCatalogForModel(model.id));
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

function createViewBall() {
  const renderer = new THREE.WebGLRenderer({
    canvas: viewBallCanvas,
    alpha: true,
    antialias: true,
    powerPreference: 'high-performance'
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  renderer.setClearColor(0x000000, 0);

  const scene = new THREE.Scene();
  const camera = new THREE.OrthographicCamera(-1.25, 1.25, 1.25, -1.25, 0.1, 10);
  camera.position.set(0, 0, 3);
  camera.lookAt(0, 0, 0);

  const fixedGroup = new THREE.Group();
  const orientationGroup = new THREE.Group();
  scene.add(fixedGroup, orientationGroup);

  const sphere = new THREE.Mesh(
    new THREE.SphereGeometry(0.98, 28, 20),
    new THREE.MeshBasicMaterial({
      color: 0x7dd3a8,
      wireframe: true,
      transparent: true,
      opacity: 0.16,
      depthWrite: false
    })
  );
  fixedGroup.add(sphere);

  const axes = new THREE.AxesHelper(1.12);
  axes.material.transparent = true;
  axes.material.opacity = 0.58;
  axes.material.depthTest = false;
  fixedGroup.add(axes);

  const axisHandleMeshes = [];
  const axisDefinitions = [
    { axis: new THREE.Vector3(1, 0, 0), color: 0xff6b6b },
    { axis: new THREE.Vector3(0, 1, 0), color: 0x6bd68b },
    { axis: new THREE.Vector3(0, 0, 1), color: 0x6b9bff }
  ];

  for (const definition of axisDefinitions) {
    for (const sign of [-1, 1]) {
      const handle = new THREE.Mesh(
        new THREE.SphereGeometry(0.09, 16, 16),
        new THREE.MeshBasicMaterial({ color: definition.color, depthTest: false })
      );
      handle.position.copy(definition.axis).multiplyScalar(sign * 1.14);
      handle.userData.axis = definition.axis.clone();
      fixedGroup.add(handle);
      axisHandleMeshes.push(handle);
    }
  }

  const frontMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0x7dd3a8, depthTest: false })
  );
  frontMarker.position.set(0, 0, -0.98);
  orientationGroup.add(frontMarker);

  const upMarker = new THREE.Mesh(
    new THREE.SphereGeometry(0.06, 16, 16),
    new THREE.MeshBasicMaterial({ color: 0xf2c94c, depthTest: false })
  );
  upMarker.position.set(0, 0.98, 0);
  orientationGroup.add(upMarker);

  const resize = () => {
    const rect = viewBallElement.getBoundingClientRect();
    const size = Math.max(1, Math.min(rect.width, rect.height));
    renderer.setSize(size, size, false);
  };

  resize();
  window.addEventListener('resize', resize);

  let pointerId = null;
  let interactionMode = 'none';
  let dragStart = null;
  let dragStartQuaternion = new THREE.Quaternion();
  let axisDrag = null;

  const trackballVector = (event) => {
    const rect = viewBallCanvas.getBoundingClientRect();
    const x = (event.clientX - rect.left - rect.width / 2) / (rect.width / 2);
    const y = (rect.height / 2 - (event.clientY - rect.top)) / (rect.height / 2);
    const zSquared = 1 - x * x - y * y;
    const vector = new THREE.Vector3(x, y, zSquared > 0 ? Math.sqrt(zSquared) : 0);
    return vector.normalize();
  };

  const pointerAngle = (event) => {
    const rect = viewBallCanvas.getBoundingClientRect();
    const x = event.clientX - rect.left - rect.width / 2;
    const y = rect.height / 2 - (event.clientY - rect.top);
    return Math.atan2(y, x);
  };

  const getAxisHandleHit = (event) => {
    const rect = viewBallCanvas.getBoundingClientRect();
    const ndc = new THREE.Vector2(
      ((event.clientX - rect.left) / rect.width) * 2 - 1,
      -(((event.clientY - rect.top) / rect.height) * 2 - 1)
    );
    const raycaster = new THREE.Raycaster();
    raycaster.setFromCamera(ndc, camera);
    const hits = raycaster.intersectObjects(axisHandleMeshes, false);
    return hits[0]?.object || null;
  };

  const onPointerDown = (event) => {
    if (!viewer || !viewer.camera || pointerId !== null) return;
    event.preventDefault();
    pointerId = event.pointerId;
    dragStartQuaternion.copy(viewer.camera.quaternion);

    const axisHandle = getAxisHandleHit(event);
    if (axisHandle) {
      interactionMode = 'axis';
      axisDrag = {
        handle: axisHandle,
        axisLocal: axisHandle.userData.axis.clone(),
        startQuaternion: viewer.camera.quaternion.clone(),
        startAngle: pointerAngle(event)
      };
    } else {
      interactionMode = 'trackball';
      dragStart = trackballVector(event);
    }

    viewBallElement.setPointerCapture?.(event.pointerId);
  };

  const onPointerMove = (event) => {
    if (!viewer || pointerId === null || event.pointerId !== pointerId) return;
    event.preventDefault();

    let next;

    if (interactionMode === 'axis' && axisDrag) {
      const angleDelta = pointerAngle(event) - axisDrag.startAngle;
      const axisWorld = axisDrag.axisLocal.clone();
      const delta = new THREE.Quaternion().setFromAxisAngle(axisWorld, angleDelta);
      next = delta.multiply(axisDrag.startQuaternion);
    } else if (interactionMode === 'trackball' && dragStart) {
      const current = trackballVector(event);
      const delta = new THREE.Quaternion().setFromUnitVectors(dragStart, current);
      next = delta.multiply(dragStartQuaternion);
    } else {
      return;
    }

    orientationGroup.quaternion.copy(next);
    syncMainCameraFromQuaternion(next);
  };

  const onPointerUp = (event) => {
    if (event.pointerId !== pointerId) return;
    event.preventDefault();
    pointerId = null;
    interactionMode = 'none';
    dragStart = null;
    axisDrag = null;
    viewBallElement.releasePointerCapture?.(event.pointerId);
  };

  viewBallElement.addEventListener('pointerdown', onPointerDown);
  viewBallElement.addEventListener('pointermove', onPointerMove);
  viewBallElement.addEventListener('pointerup', onPointerUp);
  viewBallElement.addEventListener('pointercancel', onPointerUp);

  return {
    renderer,
    scene,
    camera,
    orientationGroup,
    resize,
    get dragging() {
      return pointerId !== null;
    }
  };
}

function syncMainCameraFromQuaternion(quaternion) {
  if (!viewer || !viewer.camera || !viewer.controls) return;

  const target = viewer.controls.target;
  const distance = viewer.camera.position.distanceTo(target) || 1;
  const offset = new THREE.Vector3(0, 0, 1)
    .applyQuaternion(quaternion)
    .multiplyScalar(distance);

  viewer.camera.position.copy(target).add(offset);
  viewer.camera.up.set(0, 1, 0).applyQuaternion(quaternion);
  viewer.camera.quaternion.copy(quaternion);
  viewer.camera.lookAt(target);
  viewer.camera.quaternion.copy(quaternion);
  viewer.controls.controls.update();
}

function syncViewBallFromMain() {
  if (!viewBall || viewBall.dragging || !viewer?.camera) return;
  viewBall.orientationGroup.quaternion.copy(viewer.camera.quaternion);
}

function renderViewBall() {
  if (!viewBall) return;
  viewBall.renderer.render(viewBall.scene, viewBall.camera);
}

function setupViewerControls(initialTarget) {
  const controls = new TrackballControls(viewer.camera, viewer.renderer.domElement);
  controls.target.copy(initialTarget);
  controls.rotateSpeed = 1.08;
  controls.zoomSpeed = 1.0;
  controls.panSpeed = 0.35;
  controls.multiTouchRoll = true;
  controls.staticMoving = true;
  controls.minDistance = 0.05;
  controls.maxDistance = 10000;
  controls.update();

  window.addEventListener('resize', () => {
    controls.handleResize();
  });

  const freeControls = {
    controls,
    target: controls.target,
    autoRotate: true,
    autoRotateSpeed: 1.6,
    update() {
      if (this.autoRotate && controls.state === -1) {
        const angle = (2 * Math.PI) / 60 / 60 * this.autoRotateSpeed;
        const axis = new THREE.Vector3(0, 1, 0);
        viewer.camera.position.sub(controls.target).applyAxisAngle(axis, angle).add(controls.target);
        viewer.camera.up.applyAxisAngle(axis, angle);
      }

      controls.update();
      syncViewBallFromMain();
      renderViewBall();
    }
  };

  viewer.controls = freeControls;
  autoRotateButton.setAttribute('aria-pressed', String(freeControls.autoRotate));
  viewBall = createViewBall();
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
  hideStagePrompt();

  viewer = new GaussianSplats3D.Viewer({
    rootElement: stage,
    cameraUp: [0, 1, 0],
    initialCameraPosition: frame.position.toArray(),
    initialCameraLookAt: frame.target.toArray(),
    useBuiltInControls: false,
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
    sphericalHarmonicsDegree: 3,
    halfPrecisionCovariancesOnGPU: false,
    maxScreenSpaceSplatSize: isMobile ? 1024 : 2048,
    optimizeSplatData: false,
    freeIntermediateSplatData: false
  });

  setupViewerControls(frame.target);
  viewer.start();
  viewer.showInfo = false;
  if (viewer.infoPanel) viewer.infoPanel.hide();
  applyViewerBackground();
}

async function loadActiveModel() {
  const model = models[activeIndex];
  if (!model) return;
  if (!viewer) createViewer();

  const requestId = ++loadSequence;

  busy = true;
  modelLoaded = false;
  setStatus('正在加载', 'loading');
  setProgress(0);
  stage.classList.add('is-loading');

  try {
    const existingScenes = viewer.splatMesh?.scenes || [];
    if (existingScenes.length > 0) {
      const sceneIndexes = existingScenes.map((scene, index) => index);
      await viewer.removeSplatScenes(sceneIndexes, false);
      await waitForViewerIdle();
    }
    if (viewer.splatMesh?.scenes.length > 0) {
      throw new Error('旧模型场景未能完全清理。');
    }

    frameCurrentModel();

    const loadPromise = viewer.addSplatScene(model.path, {
      progressiveLoad: true,
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

    if (requestId !== loadSequence) return;

    if (!modelLoaded) {
      setStatus('模型已就绪', 'ready');
      modelLoaded = true;
      busy = false;
      stage.classList.remove('is-loading');
    }
  } catch (error) {
    if (requestId !== loadSequence) return;
    console.error(error);
    setStatus('模型加载失败', 'error');
    setProgress(100);
    modelLoaded = false;
    busy = false;
    stage.classList.remove('is-loading');
  }
}

async function switchModel(index) {
  if (!models[index]) return;
  if (busy) {
    pendingModelIndex = index;
    return;
  }
  if (index === activeIndex && modelLoaded) return;

  const requestedIndex = index;
  activeIndex = requestedIndex;
  setModelInfo(requestedIndex);
  await loadActiveModel();

  if (pendingModelIndex !== null) {
    const nextIndex = pendingModelIndex;
    pendingModelIndex = null;
    if (nextIndex !== requestedIndex || !modelLoaded) await switchModel(nextIndex);
  }
}

async function applyModelFilter(taxonomyId) {
  const previousId = models[activeIndex]?.id;
  taxonomyFilterId = taxonomyId || null;
  models = getFilteredModels();
  updateActiveFilter();

  let nextIndex = models.findIndex((model) => model.id === previousId);
  if (nextIndex < 0) nextIndex = 0;
  activeIndex = nextIndex;

  if (models.length === 0) {
    modelName.textContent = '暂无模型';
    splatCount.textContent = '0';
    infoTaxonomy.textContent = '未分类';
    introText.textContent = '该分类下暂时还没有模型。';
    setStatus('该分类下暂无模型', 'error');
    attrCollector.textContent = '—';
    attrIdentifier.textContent = '—';
    attrBuilder.textContent = '—';
    attributionHistory.hidden = true;
    showStagePrompt();
    return;
  }

  setModelInfo(activeIndex);
  if (!viewer) showStagePrompt();
}

async function focusModelById(id) {
  if (!id) return;

  let index = models.findIndex((model) => model.id === id);
  if (index < 0) {
    taxonomyFilterId = null;
    models = allModels;
    updateActiveFilter();
    index = models.findIndex((model) => model.id === id);
  }

  if (index < 0) return;
  await switchModel(index);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast._timer);
  showToast._timer = window.setTimeout(() => toast.classList.remove('is-visible'), 2200);
}

async function shareModel() {
  const model = models[activeIndex];
  if (!model) return;
  const url = `${location.origin}${location.pathname}?model=${encodeURIComponent(model.id)}`;
  try {
    await navigator.clipboard.writeText(url);
    showToast('分享链接已复制');
  } catch {
    const input = document.createElement('textarea');
    input.value = url;
    input.style.cssText = 'position:fixed;opacity:0;pointer-events:none;';
    document.body.appendChild(input);
    input.select();
    try {
      document.execCommand('copy');
      showToast('分享链接已复制');
    } catch {
      showToast('复制失败，请手动复制地址栏');
    }
    input.remove();
  }
}

function applyViewerBackground() {
  if (!viewer || !viewer.renderer) return;
  const light = document.documentElement.getAttribute('data-theme') === 'light';
  viewer.renderer.setClearColor(new THREE.Color(light ? 0xeef1f5 : 0x090b0f), 1);
}

function setTheme(theme, persist = true) {
  const resolved = theme === 'light' ? 'light' : 'dark';
  const nextLabel = resolved === 'light' ? '切换为深色模式' : '切换为浅色模式';
  document.documentElement.setAttribute('data-theme', resolved);
  if (persist) {
    try {
      localStorage.setItem('theme', resolved);
    } catch {
      /* ignore */
    }
  }
  applyViewerBackground();
  [themeToggle, catalogThemeToggle].forEach((toggle) => {
    toggle.innerHTML = '';
    const icon = document.createElement('i');
    icon.dataset.lucide = resolved === 'light' ? 'moon' : 'sun';
    toggle.append(icon);
    toggle.setAttribute('aria-label', nextLabel);
    toggle.title = nextLabel;
  });
  createIcons({ icons });
}

function initTheme() {
  let saved = null;
  try {
    saved = localStorage.getItem('theme');
  } catch {
    /* ignore */
  }
  setTheme(saved === 'light' ? 'light' : 'dark', false);
}

function localSearch(query) {
  const needle = query.trim().toLocaleLowerCase('zh-CN');
  if (!needle) {
    return { models: [], taxonomy: [] };
  }

  const byExactName = (a, b) => {
    const aExact = (a.name || '').toLocaleLowerCase('zh-CN') === needle;
    const bExact = (b.name || '').toLocaleLowerCase('zh-CN') === needle;
    if (aExact !== bExact) return aExact ? -1 : 1;
    return 0;
  };

  const modelResults = allModels
    .filter((model) => {
      const haystack = [model.name, model.taxonomyName, model.intro || ''].join(' ');
      return haystack.toLocaleLowerCase('zh-CN').includes(needle);
    })
    .sort(byExactName)
    .slice(0, 12);

  const taxonomyResults = taxonomy
    .filter((entry) => {
      if (entry.active === false) return false;
      const haystack = [entry.name, entry.keyText || '', entry.rankLabel || ''].join(' ');
      return haystack.toLocaleLowerCase('zh-CN').includes(needle);
    })
    .sort(byExactName)
    .slice(0, 12);

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
        openCatalogForModel(model.id);
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
    thumbnail: rawModel.thumbnail || rawModel.thumbnailUrl || '',
    splatCount: rawModel.splatCount || 0,
    center: Array.isArray(rawModel.center) ? rawModel.center : [0, 0, 0],
    size: Array.isArray(rawModel.size) ? rawModel.size : [1, 1, 1],
    intro: rawModel.intro || '',
    taxonomyId: rawModel.taxonomyId || null,
    taxonomyName: rawModel.taxonomyName || '',
    attribution: rawModel.attribution || {},
    attributionLog: Array.isArray(rawModel.attributionLog) ? rawModel.attributionLog : []
  };
}

const ATTRIBUTION_FIELDS = {
  collector: '采集者',
  identifier: '鉴定者',
  builder: '模型构建者'
};

function renderAttribution(model) {
  const attr = model?.attribution || {};
  attrCollector.textContent = attr.collector?.trim() || '—';
  attrIdentifier.textContent = attr.identifier?.trim() || '—';
  attrBuilder.textContent = attr.builder?.trim() || '—';

  const log = Array.isArray(model?.attributionLog) ? model.attributionLog : [];
  attributionHistoryList.innerHTML = '';
  attributionHistory.hidden = log.length === 0;
  if (log.length === 0) return;

  attributionHistoryCount.textContent = `修改记录（${log.length}）`;
  attributionHistoryList.hidden = true;
  attributionHistoryToggle.classList.remove('is-open');

  const seen = { collector: 0, identifier: 0, builder: 0 };
  for (const entry of log) {
    const label = ATTRIBUTION_FIELDS[entry.field] || entry.field;
    seen[entry.field] = (seen[entry.field] || 0) + 1;
    const round = seen[entry.field] + 1;

    const item = document.createElement('div');
    item.className = 'attribution-history-item';

    const strong = document.createElement('strong');
    strong.textContent = `${label} 第${round}次：${entry.value}`;

    const small = document.createElement('small');
    const date = entry.at ? new Date(entry.at) : null;
    small.textContent = date && !Number.isNaN(date.getTime())
      ? date.toLocaleString('zh-CN', { year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit' })
      : '';

    item.append(strong, small);
    attributionHistoryList.append(item);
  }
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
  rankCatalog = data.rankCatalog || [];
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

    renderTaxonomyTree();
    updateActiveFilter();
    setModelInfo(activeIndex);
    setAllModelsCollapsed(true);
    showStagePrompt();
    openCatalog();
    setStatus('等待选择模型', 'loading');
    setProgress(0);
    if (requestedModel) {
      const sharedModel = allModels.find((model) => model.id === requestedModel);
      if (sharedModel) await openCatalogModel(sharedModel);
    }
  } catch (error) {
    console.error(error);
    setStatus('模型清单加载失败', 'error');
  }
}

catalogSearchInput.addEventListener('input', () => {
  catalogQuery = catalogSearchInput.value;
  catalogPage = 1;
  renderCatalogGrid();
});

catalogPageSizeSelect.addEventListener('change', () => {
  catalogPageSize = Number(catalogPageSizeSelect.value) || 12;
  catalogPage = 1;
  renderCatalogGrid();
});

catalogResetFilter.addEventListener('click', () => {
  catalogFilterId = null;
  taxonomyFilterId = null;
  catalogPage = 1;
  updateActiveFilter();
  renderTaxonomyTree();
  renderCatalogHeader();
  renderCatalogGrid();
});

catalogPrev.addEventListener('click', () => {
  if (catalogPage <= 1) return;
  catalogPage -= 1;
  renderCatalogGrid();
});

catalogNext.addEventListener('click', () => {
  catalogPage += 1;
  renderCatalogGrid();
});

catalogBack.addEventListener('click', openCatalog);

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

shareButton.addEventListener('click', shareModel);
themeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  setTheme(next, true);
});
catalogThemeToggle.addEventListener('click', () => {
  const next = document.documentElement.getAttribute('data-theme') === 'light' ? 'dark' : 'light';
  setTheme(next, true);
});
attributionHistoryToggle.addEventListener('click', () => {
  attributionHistoryList.hidden = !attributionHistoryList.hidden;
  attributionHistoryToggle.classList.toggle('is-open', !attributionHistoryList.hidden);
});
initTheme();

initialize();
