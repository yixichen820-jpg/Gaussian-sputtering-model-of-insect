import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';
import { createIcons, icons } from 'lucide';

const MODEL_URL = './models/大丽灯蛾final.spz';
const MODEL_CENTER = [0.4039127826690674, 2.957986831665039, -2.070513606071472];
const MODEL_SIZE = [4.565914154052734, 7.914432525634766, 9.13870644569397];

const stage = document.getElementById('stage');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');
const progressFill = document.getElementById('progress-fill');
const autoRotateButton = document.getElementById('auto-rotate');

createIcons({ icons });

function setStatus(text, state = 'loading') {
  statusText.textContent = text;
  statusDot.className = 'status-dot';
  if (state === 'ready') statusDot.classList.add('is-ready');
  if (state === 'error') statusDot.classList.add('is-error');
}

function setProgress(value) {
  progressFill.style.width = `${Math.max(0, Math.min(100, value))}%`;
}

const radius = Math.max(...MODEL_SIZE) / 2;
const distance = Math.max(radius * 1.8, radius + 5);
const target = new THREE.Vector3(...MODEL_CENTER);
const position = new THREE.Vector3(
  MODEL_CENTER[0],
  MODEL_CENTER[1] + radius * 0.25,
  MODEL_CENTER[2] + distance
);

const viewer = new GaussianSplats3D.Viewer({
  rootElement: stage,
  cameraUp: [0, 1, 0],
  initialCameraPosition: position.toArray(),
  initialCameraLookAt: target.toArray(),
  useBuiltInControls: true,
  selfDrivenMode: true,
  sharedMemoryForWorkers: false,
  gpuAcceleratedSort: false,
  integerBasedSort: true,
  enableSIMDInSort: true,
  kernel2DSize: 0.65,
  renderMode: GaussianSplats3D.RenderMode.Always,
  sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
  logLevel: GaussianSplats3D.LogLevel.None,
  sphericalHarmonicsDegree: 1,
  optimizeSplatData: true,
  freeIntermediateSplatData: true
});

viewer.controls.autoRotate = false;
viewer.controls.autoRotateSpeed = 0.4;
viewer.start();

setStatus('正在加载模型', 'loading');

viewer.addSplatScene(MODEL_URL, {
  progressiveLoad: true,
  showLoadingUI: false,
  splatAlphaRemovalThreshold: 1,
  onProgress: (percentComplete) => {
    setProgress(percentComplete);
    if (percentComplete >= 100) {
      setStatus('模型已就绪', 'ready');
    }
  }
}).then(() => {
  setStatus('模型已就绪', 'ready');
  setProgress(100);
}).catch((error) => {
  console.error(error);
  setStatus('模型加载失败', 'error');
});

autoRotateButton.addEventListener('click', () => {
  viewer.controls.autoRotate = !viewer.controls.autoRotate;
  autoRotateButton.setAttribute('aria-pressed', String(viewer.controls.autoRotate));
});
