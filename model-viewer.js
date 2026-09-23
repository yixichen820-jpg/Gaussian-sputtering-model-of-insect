import * as GaussianSplats3D from '@mkkellogg/gaussian-splats-3d';
import * as THREE from 'three';

const MODEL_URL = '/models/cleaned-boosted-model-1790093866443-33b83ff1.ply';
const stage = document.getElementById('stage');
const statusText = document.getElementById('status-text');
const statusDot = document.getElementById('status-dot');

const viewer = new GaussianSplats3D.Viewer({
  rootElement: stage,
  cameraUp: [0, 1, 0],
  initialCameraPosition: [0, 2, 8],
  initialCameraLookAt: [0, 0, 0],
  useBuiltInControls: true,
  selfDrivenMode: true,
  sharedMemoryForWorkers: false,
  gpuAcceleratedSort: false,
  integerBasedSort: false,
  enableSIMDInSort: false,
  kernel2DSize: 1.5,
  renderMode: GaussianSplats3D.RenderMode.Always,
  sceneRevealMode: GaussianSplats3D.SceneRevealMode.Instant,
  logLevel: GaussianSplats3D.LogLevel.None,
  sphericalHarmonicsDegree: 0,
  halfPrecisionCovariancesOnGPU: false,
  optimizeSplatData: false,
  freeIntermediateSplatData: false
});

viewer.controls.autoRotate = false;
viewer.controls.autoRotateSpeed = 0.4;

function setStatus(text, state = 'loading') {
  statusText.textContent = text;
  statusDot.className = 'status-dot';
  if (state === 'ready') statusDot.classList.add('is-ready');
  if (state === 'error') statusDot.classList.add('is-error');
}

function frameFromBoundingBox() {
  if (!viewer.splatMesh || viewer.splatMesh.scenes.length === 0) return;

  const box = viewer.splatMesh.computeBoundingBox(true, 0);
  const center = box.getCenter(new THREE.Vector3());
  const size = box.getSize(new THREE.Vector3());
  const radius = Math.max(size.x, size.y, size.z) / 2;
  const distance = Math.max(radius * 0.55, 0.4);

  viewer.camera.up.set(0, 1, 0);
  viewer.camera.position.set(center.x, center.y + radius * 0.2, center.z + distance);
  viewer.camera.lookAt(center);
  viewer.controls.target.copy(center);
  viewer.controls.minDistance = 0.01;
  viewer.controls.maxDistance = Math.max(distance * 10, 50);
  viewer.controls.dollySpeed = 1.2;
  viewer.controls.rotateSpeed = 1.45;
  viewer.controls.panSpeed = 1.45;
  viewer.controls.zoomSpeed = 1.35;
  viewer.controls.update();
}

setStatus('正在加载模型', 'loading');

viewer.addSplatScene(MODEL_URL, {
  progressiveLoad: false,
  showLoadingUI: false,
  splatAlphaRemovalThreshold: 1,
  scale: [1, 1, 1]
}).then(() => {
  viewer.start();
  frameFromBoundingBox();
  setStatus('模型已就绪', 'ready');
}).catch((error) => {
  console.error(error);
  setStatus('模型加载失败', 'error');
});
