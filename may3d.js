// Máy DuckMess 3D trên mặt nhôm: mô hình assets/may.glb (Higgsfield → Tripo, làm mượt Taubin, nén meshopt + webp).
// Chuyển động duy nhất tự chạy: lúc mở trang máy xoay vào chỗ. Sau đó máy đứng yên, chỉ xoay khi người xem kéo;
// thả tay thì trôi chậm lại rồi dừng tại chỗ. Chỉ vẽ lại khi có chuyển động, đứng yên thì không tốn máy.
// Không có WebGL → giữ ảnh tĩnh assets/may.webp có sẵn trong HTML.
import * as THREE from "three";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";

const stage = document.querySelector(".may");
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const REST_Y = -0.7; // tư thế 3/4 như ảnh sản phẩm: màn coban trên trái, logo bên phải
const REST_X = 0.42;

let renderer;
try {
  renderer = new THREE.WebGLRenderer({
    antialias: true,
    alpha: true,
    powerPreference: "high-performance",
  });
} catch {
  renderer = null; // không có WebGL: để nguyên ảnh tĩnh
}
if (renderer) start();

function start() {
  const canvas = renderer.domElement;
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const pmrem = new THREE.PMREMGenerator(renderer);
  scene.environment = pmrem.fromScene(new RoomEnvironment(), 0.04).texture;
  const key = new THREE.DirectionalLight(0xffffff, 1.4);
  key.position.set(-2, 3, 2);
  const rim = new THREE.DirectionalLight(0x7aa2ff, 0.9);
  rim.position.set(2.5, -0.5, -2);
  scene.add(key, rim);

  const camera = new THREE.PerspectiveCamera(28, 1, 0.1, 50);
  camera.position.set(0, 1.5, 2.45);
  camera.lookAt(0, -0.02, 0);

  const pivot = new THREE.Group();
  scene.add(pivot);

  // góc hiện tại đuổi theo góc đích → kéo mượt, không giật theo từng sự kiện chuột
  const target = {
    y: REST_Y - (reduced ? 0 : 2.2),
    x: REST_X + (reduced ? 0 : 0.7),
  };
  const cur = { y: target.y, x: target.x };
  let vel = 0,
    dragging = false,
    lastX = 0,
    lastY = 0,
    running = false;

  function resize() {
    const r = stage.getBoundingClientRect();
    renderer.setSize(r.width, r.height, false);
    camera.aspect = r.width / r.height;
    camera.updateProjectionMatrix();
    wake();
  }

  function wake() {
    if (!running && pivot.children.length) {
      running = true;
      requestAnimationFrame(frame);
    }
  }

  function frame() {
    if (!dragging && Math.abs(vel) > 0.0001) {
      target.y += vel;
      vel *= 0.92;
    }
    const k = dragging ? 0.35 : 0.12;
    cur.y += (target.y - cur.y) * k;
    cur.x += (target.x - cur.x) * k;
    pivot.rotation.set(cur.x, cur.y, 0);
    renderer.render(scene, camera);
    const moving =
      dragging ||
      Math.abs(vel) > 0.0001 ||
      Math.abs(target.y - cur.y) > 0.0005 ||
      Math.abs(target.x - cur.x) > 0.0005;
    if (moving) requestAnimationFrame(frame);
    else running = false;
  }

  const loader = new GLTFLoader();
  loader.setMeshoptDecoder(MeshoptDecoder);
  loader.load("assets/may.glb", (gltf) => {
    const model = gltf.scene;
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    model.position.sub(box.getCenter(new THREE.Vector3()));
    model.scale.setScalar(1.05 / Math.max(size.x, size.z));
    pivot.add(model);
    stage.appendChild(canvas);
    stage.classList.add("is-3d");
    resize();
    // xoay vào chỗ: đặt góc đích về tư thế nghỉ, phần đuổi theo tạo chuyển động chậm dần
    target.y = REST_Y;
    target.x = REST_X;
    wake();
  });
  new ResizeObserver(resize).observe(stage);

  canvas.addEventListener("pointerdown", (e) => {
    dragging = true;
    vel = 0;
    lastX = e.clientX;
    lastY = e.clientY;
    canvas.setPointerCapture(e.pointerId);
    stage.classList.add("dragging");
    wake();
  });
  canvas.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const dx = (e.clientX - lastX) * 0.009;
    target.y += dx;
    target.x = Math.min(
      0.9,
      Math.max(-0.1, target.x + (e.clientY - lastY) * 0.006),
    );
    vel = dx * 0.6;
    lastX = e.clientX;
    lastY = e.clientY;
  });
  const release = () => {
    dragging = false;
    stage.classList.remove("dragging");
  };
  canvas.addEventListener("pointerup", release);
  canvas.addEventListener("pointercancel", release);
}
