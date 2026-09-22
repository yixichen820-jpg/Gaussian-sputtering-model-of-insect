import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';
import { createIcons, icons } from 'lucide';

const MODEL_URL = './models/大丽灯蛾final.spz';
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

const viewer = new GaussianSplats3D.Viewer({
  rootElement: stage,
  cameraUp: [0, 1, 0],
  initialCameraPosition: [0, 2, 8],
  initialCameraLookAt: [0, 0, 0],
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

function frameFromBoundingBox() {
  if (!viewer.splatMesh || viewer.splatMesh.scenes.length === 0) return;

  const box = viewer.splatMesh.computeBoundingBox(true, 0);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2;
  const distance = Math.max(radius * 1.8, radius + 3);

  viewer.camera.up.set(0, 1, 0);
  viewer.camera.position.set(center.x, center.y + radius * 0.22, center.z + distance);
  viewer.camera.lookAt(center);
  viewer.controls.target.copy(center);
  viewer.controls.update();
}

setStatus('正在加载模型', 'loading');

viewer.addSplatScene(MODEL_URL, {
  progressiveLoad: false,
  showLoadingUI: false,
  splatAlphaRemovalThreshold: 1,
  onProgress: (percentComplete) => {
    setProgress(percentComplete);
    if (percentComplete >= 100) {
      setStatus('模型已就绪', 'ready');
    }
  }
}).then(() => {
  frameFromBoundingBox();
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
