// Đôi cánh ASCII ở đầu trang, vẽ bằng WebGL2. Nguồn hình là video lặp vòng assets/canh.mp4 (cánh vỗ mượt, lông bay, hành tinh xoay;
// tạo bằng Higgsfield Seedance 2.0 từ chính ảnh canh.webp làm khung đầu và khung cuối). Video chưa phát được, không tự
// phát được (vd. chế độ tiết kiệm pin) hoặc người dùng bật "giảm chuyển động" → dùng ảnh tĩnh assets/canh.webp.
// Lúc yên: mỗi ô là một ký tự theo độ sáng hình, mờ. Chuột/ngón tay đi tới đâu, "vệt nhiệt" ở đó làm ký tự nổi lên:
// to ra, sáng lên, đặc hơn, xáo trộn, tách màu RGB, rồi chìm dần. Cuộn khỏi đầu trang thì video tạm dừng, thôi vẽ.
// Không có WebGL2 → để nguyên ảnh nền CSS của .hero.
// khung .ascii do CSS định cỡ; canvas bên trong luôn 100% khung → đo khung, không đo canvas (tránh canvas tự phình)
const box = document.querySelector(".ascii");
const canvas = box.querySelector("canvas");
const hero = document.querySelector(".hero");
const gl = canvas.getContext("webgl2", { antialias: false, alpha: false });
const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
const RAMP = " .:-=+*?%#▓█"; // thưa → đặc; dấu ? lấy từ ảnh mẫu
const G = 64; // cỡ mỗi ký tự trong atlas (px)

if (gl) {
  Promise.all([
    loadImage("assets/canh.webp"),
    document.fonts.load(`${G}px "Geist Mono"`),
  ]).then(([img]) => start(img));
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const im = new Image();
    im.onload = () => resolve(im);
    im.onerror = reject;
    im.src = src;
  });
}

const VERT = `#version 300 es
in vec2 p;
void main() { gl_Position = vec4(p, 0., 1.); }`;

const FRAG = `#version 300 es
precision highp float;
uniform sampler2D uImg, uAtlas, uHeat;
uniform vec2 uRes, uImgSize, uGrid;
uniform float uCell, uN, uTick;
out vec4 o;

float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }

// ảnh phủ kín màn hình, giữ tỉ lệ (như background-size: cover)
vec2 cover(vec2 p) {
  float sa = uRes.x / uRes.y, ia = uImgSize.x / uImgSize.y;
  vec2 s = sa > ia ? vec2(1., ia / sa) : vec2(sa / ia, 1.);
  return (p - .5) * s + .5;
}

float glyph(float idx, vec2 g) {
  if (g.x < 0. || g.y < 0. || g.x > 1. || g.y > 1.) return 0.;
  return texture(uAtlas, vec2((idx + g.x) / uN, g.y)).r;
}

void main() {
  vec2 px = vec2(gl_FragCoord.x, uRes.y - gl_FragCoord.y);
  vec2 cell = floor(px / uCell);
  vec2 local = fract(px / uCell);
  vec3 col = texture(uImg, cover((cell + .5) * uCell / uRes)).rgb;
  // màu rực (hành tinh coban) cũng tính là sáng, không thì nó chìm thành ký tự thưa
  float lum = max(dot(col, vec3(.299, .587, .114)), max(col.r, max(col.g, col.b)) * .85);
  float heat = texture(uHeat, (cell + .5) / uGrid).r;

  // nổi lên: ký tự phóng to và nhích lên khỏi ô
  float scale = 1. + heat * .7;
  vec2 g = (local - .5) / scale + .5 + vec2(0., heat * .22);
  float idx = floor(clamp(lum * 1.1 + heat * .45, 0., .999) * uN);
  float r = hash(cell + uTick);
  if (heat > .2 && r < heat * .4) idx = floor(mix(uN * .45, uN - .01, hash(cell * 1.7 + uTick)));

  // tách màu: kênh đỏ/xanh lệch ngang theo độ nóng
  float sh = heat * .16;
  vec3 m = vec3(glyph(idx, g + vec2(sh, 0.)), glyph(idx, g), glyph(idx, g - vec2(sh, 0.)));
  // lúc yên giữ màu ảnh (hành tinh coban vẫn xanh), chỗ nóng ngả sang trắng sáng
  vec3 tint = mix(min(col * 1.35, 1.), vec3(.95, .94, 1.), .15 + heat * .5);
  vec3 c = m * tint * (.62 + heat * 1.1);
  c += col * .05;
  o = vec4(c, 1.);
}`;

function start(img) {
  const prog = gl.createProgram();
  for (const [type, src] of [
    [gl.VERTEX_SHADER, VERT],
    [gl.FRAGMENT_SHADER, FRAG],
  ]) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS))
      throw new Error(gl.getShaderInfoLog(s));
    gl.attachShader(prog, s);
  }
  gl.linkProgram(prog);
  gl.useProgram(prog);
  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(
    gl.ARRAY_BUFFER,
    new Float32Array([-1, -1, 3, -1, -1, 3]),
    gl.STATIC_DRAW,
  );
  const loc = gl.getAttribLocation(prog, "p");
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);
  const U = (n) => gl.getUniformLocation(prog, n);

  // atlas ký tự: một hàng, mỗi ký tự một ô G×G
  const atlas = document.createElement("canvas");
  atlas.width = G * RAMP.length;
  atlas.height = G;
  const a = atlas.getContext("2d");
  a.fillStyle = "#fff";
  a.font = `${Math.round(G * 0.8)}px "Geist Mono"`;
  a.textAlign = "center";
  a.textBaseline = "middle";
  [...RAMP].forEach((ch, i) => a.fillText(ch, i * G + G / 2, G / 2 + G * 0.04));

  // vệt nhiệt: canvas nhỏ đúng bằng lưới ô, mờ dần mỗi khung
  const heat = document.createElement("canvas");
  const h = heat.getContext("2d", { willReadFrequently: false });

  const tex = (unit, source, filter) => {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, filter);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
    return t;
  };
  const imgTex = tex(0, img, gl.LINEAR);
  tex(1, atlas, gl.LINEAR);
  const heatTex = tex(2, heat, gl.LINEAR);
  gl.uniform1i(U("uImg"), 0);
  gl.uniform1i(U("uAtlas"), 1);
  gl.uniform1i(U("uHeat"), 2);
  gl.uniform2f(U("uImgSize"), img.naturalWidth, img.naturalHeight);
  gl.uniform1f(U("uN"), RAMP.length);

  let cellCss = 9,
    dpr = 1,
    cols = 1,
    rows = 1;
  function resize() {
    const r = box.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return; // khung chưa có cỡ (CSS chưa tải): chờ lần đo sau
    dpr = Math.min(devicePixelRatio || 1, 1.5, 4096 / r.width, 4096 / r.height);
    cellCss = r.width < 700 ? 7 : 9;
    canvas.width = Math.round(r.width * dpr);
    canvas.height = Math.round(r.height * dpr);
    gl.viewport(0, 0, canvas.width, canvas.height);
    cols = Math.ceil(r.width / cellCss);
    rows = Math.ceil(r.height / cellCss);
    heat.width = cols;
    heat.height = rows;
    gl.uniform2f(U("uRes"), canvas.width, canvas.height);
    gl.uniform1f(U("uCell"), cellCss * dpr);
    gl.uniform2f(U("uGrid"), cols, rows);
    draw();
  }

  // các điểm cần đốt nóng trong khung tới (đường nối giữa hai lần chuột để vệt liền, không lỗ chỗ)
  let last = null,
    pending = [],
    lastInput = -1e9,
    running = false,
    hot = false, // vệt nhiệt còn nóng
    visible = true, // đầu trang còn trong màn hình (cuộn xuống thì dừng video cho đỡ tốn máy)
    tick = 0;
  function wake() {
    if (!running) {
      running = true;
      requestAnimationFrame(frame);
    }
  }
  function heatAt(x, y) {
    const rad = Math.max(7, cols / 22);
    const gr = h.createRadialGradient(x, y, 0, x, y, rad);
    gr.addColorStop(0, "rgba(255,255,255,0.55)");
    gr.addColorStop(1, "rgba(255,255,255,0)");
    h.fillStyle = gr;
    h.fillRect(x - rad, y - rad, rad * 2, rad * 2);
  }
  function poke(clientX, clientY) {
    const r = box.getBoundingClientRect();
    if (clientY < r.top || clientY > r.bottom) return;
    const p = {
      x: (clientX - r.left) / cellCss,
      y: (clientY - r.top) / cellCss,
    };
    if (last) {
      const d = Math.hypot(p.x - last.x, p.y - last.y),
        n = Math.ceil(d / 2);
      for (let i = 1; i <= n; i++)
        pending.push({
          x: last.x + ((p.x - last.x) * i) / n,
          y: last.y + ((p.y - last.y) * i) / n,
        });
    } else pending.push(p);
    last = p;
    lastInput = performance.now();
    hot = true;
    wake();
  }

  function draw() {
    gl.activeTexture(gl.TEXTURE2);
    gl.bindTexture(gl.TEXTURE_2D, heatTex);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, heat);
    gl.uniform1f(U("uTick"), tick);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  }

  function frame(now) {
    if (hot) {
      // chìm dần: phủ đen mỏng lên vệt nhiệt
      h.globalCompositeOperation = "source-over";
      h.fillStyle = "rgba(0,0,0,0.045)";
      h.fillRect(0, 0, cols, rows);
      h.globalCompositeOperation = "lighter";
      for (const p of pending) heatAt(p.x, p.y);
      pending = [];
      if (now - lastInput > 2600) {
        // vệt đã nguội hẳn: xóa sạch (8 bit không tự về 0)
        h.clearRect(0, 0, cols, rows);
        last = null;
        hot = false;
      }
    }
    if (Math.floor(now / 70) !== tick) tick = Math.floor(now / 70); // xáo ký tự ~14 lần/giây
    if (video && video.readyState >= 2) {
      // chép khung hình hiện tại của video vào chỗ ảnh tĩnh
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, imgTex);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, video);
    }
    draw();
    if (hot || (video && visible)) requestAnimationFrame(frame);
    else running = false;
  }

  addEventListener("pointermove", (e) => poke(e.clientX, e.clientY), {
    passive: true,
  });
  addEventListener("pointerleave", () => (last = null));
  new ResizeObserver(resize).observe(box);
  resize();
  hero.classList.add("is-ascii");

  // video: phát được thì thay ảnh tĩnh (khung đầu của video chính là ảnh đó nên lúc đổi không bị giật)
  let video = null;
  if (!reduced) {
    const v = document.createElement("video");
    v.muted = true;
    v.loop = true;
    v.playsInline = true;
    v.preload = "auto";
    v.src = "assets/canh.mp4?v=2"; // đổi số khi thay video, để trình duyệt không dùng bản cũ đã lưu
    v.addEventListener("playing", () => {
      if (video) return;
      video = v;
      gl.uniform2f(U("uImgSize"), v.videoWidth, v.videoHeight);
      wake();
    });
    v.play().catch(() => {});
  }
  new IntersectionObserver(([e]) => {
    visible = e.isIntersecting;
    if (!video) return;
    if (visible) {
      video.play().catch(() => {});
      wake();
    } else video.pause();
  }).observe(hero);

  // một lần lúc mở trang: vệt lướt qua đôi cánh, để ai cũng thấy ký tự nổi lên (cả điện thoại không có chuột)
  if (!reduced) {
    const t0 = performance.now(),
      dur = 1700;
    const sweep = (now) => {
      const k = Math.min((now - t0) / dur, 1);
      const r = box.getBoundingClientRect();
      const x = r.left + r.width * (0.08 + 0.84 * k);
      const y = r.top + r.height * (0.42 - 0.16 * Math.sin(k * Math.PI));
      poke(x, y);
      if (k < 1) requestAnimationFrame(sweep);
      else last = null;
    };
    setTimeout(() => requestAnimationFrame(sweep), 350);
  }
}
