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

let models = [];
let modelButtons = [];
let viewer = null;
let activeIndex = 0;
let busy = false;
let modelLoaded = false;

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
  modelButtons.forEach((button, buttonIndex) => {
    button.setAttribute('aria-selected', String(buttonIndex === index));
  });
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

function normalizeModel(rawModel) {
  return {
    id: rawModel.id,
    name: rawModel.name || '未命名模型',
    fileName: rawModel.fileName,
    path: rawModel.url || `/models/${encodeURIComponent(rawModel.fileName || '')}`,
    splatCount: rawModel.splatCount || 0,
    center: Array.isArray(rawModel.center) ? rawModel.center : [0, 0, 0],
    size: Array.isArray(rawModel.size) ? rawModel.size : [1, 1, 1]
  };
}

async function loadModels() {
  const response = await fetchWithRetry('/api/models');
  if (!response.ok) {
    throw new Error('无法读取模型列表。');
  }

  const data = await response.json();
  models = (data.models || []).map(normalizeModel);

  const requestedIndex = models.findIndex((model, index) => {
    return model.id === requestedModel || model.name === requestedModel || String(index + 1) === requestedModel;
  });
  activeIndex = requestedIndex >= 0 ? requestedIndex : 0;
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
    await loadModels();

    if (models.length === 0) {
      setStatus('暂无模型', 'error');
      return;
    }

    renderModelSwitcher();
    setModelInfo(activeIndex);
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

initialize();
