// Máy DuckMess 3D trên mặt nhôm: mô hình assets/may.glb (Higgsfield → Tripo, nén meshopt + webp).
// Một khoảnh khắc lúc mở trang: máy xoay vào chỗ; sau đó nghiêng theo con trỏ, kéo để xoay, thả ra thì trôi về.
// Không có WebGL → giữ ảnh tĩnh assets/may.webp có sẵn trong HTML; giảm chuyển động → máy đứng yên, vẫn kéo xoay được.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.querySelector(".may");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;

function start() {
  const canvas = document.createElement("canvas");
  let renderer;
  try {
    renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: "high-performance",
    });
  } catch {
    return; // không có WebGL: để nguyên ảnh tĩnh
  }
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.75));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.05;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.03).texture;
  // ánh coban hắt từ dưới lên như trong intro, đèn chính trắng lạnh từ trên trái
  const key = new THREE.DirectionalLight(0xffffff, 1.6);
  key.position.set(-2, 3, 2);
  const rim = new THREE.DirectionalLight(0x6f9bff, 1.2);
  rim.position.set(2.5, -0.5, -2);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
  camera.position.set(0, 1.55, 2.35);
  camera.lookAt(0, 0, 0);

  const pivot = new THREE.Group();
  scene.add(pivot);

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load("assets/may.glb", (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    model.scale.setScalar(1.25 / Math.max(size.x, size.z));
    model.traverse((o) => {
      if (o.isMesh && o.material) o.material.envMapIntensity = 1.15;
    });
    pivot.add(model);
    stage.appendChild(canvas);
    resize();
    stage.classList.add("is-3d");
    requestAnimationFrame(tick);
  });

  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
  }
  new ResizeObserver(resize).observe(stage);

  // con trỏ trên cả trang → máy nghiêng nhẹ về phía đó; kéo trên máy → xoay quanh trục đứng
  let aimX = 0,
    aimY = 0,
    spin = 0,
    spinV = 0,
    dragging = false,
    lastX = 0;
  addEventListener(
    "pointermove",
    (e) => {
      aimX = (e.clientX / innerWidth) * 2 - 1;
      aimY = (e.clientY / innerHeight) * 2 - 1;
      if (dragging) {
        spinV = (e.clientX - lastX) * 0.012;
        spin += spinV;
        lastX = e.clientX;
      }
    },
    { passive: true },
  );
  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    lastX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    stage.classList.add("dragging");
  });
  const release = () => {
    dragging = false;
    stage.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);

  // chỉ vẽ khi máy đang trong tầm nhìn
  let visible = true;
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (visible) requestAnimationFrame(tick);
  }).observe(stage);

  const t0 = performance.now();
  const ease = (x) => 1 - Math.pow(1 - x, 4);
  function tick(now) {
    if (!visible) return;
    const t = (now - t0) / 1000;
    // vào chỗ: từ nghiêng ngửa + lệch nửa vòng xoay về tư thế 3/4 trong 1,8 giây
    const k = reduced ? 1 : ease(Math.min(t / 1.8, 1));
    if (!dragging) {
      spinV *= 0.94;
      spin += spinV;
      spin *= 0.965; // thả ra thì trôi dần về hướng ban đầu
    }
    const idle = reduced ? 0 : Math.sin(t * 0.6) * 0.04;
    pivot.rotation.y = (1 - k) * -2.4 + -0.55 + aimX * 0.32 + spin + idle;
    pivot.rotation.x = (1 - k) * 0.9 + aimY * 0.14;
    pivot.position.y = (1 - k) * -0.35 + Math.sin(t * 0.9) * 0.012;
    renderer.render(scene, camera);
    requestAnimationFrame(tick);
  }
}

start();
