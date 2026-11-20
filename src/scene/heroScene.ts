/* The Lobby: a crystal-glass donut with strawberry glaze, floating over a Florida sunset ocean.
 * Sky + ocean are custom shaders; the donut refracts the sun (transmission + dispersion + iridescence);
 * the seven crystals you collect orbit it. Click to boop. Drag to spin. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CRYSTALS } from '../components/crystals';

const SKY_GLSL = /* glsl */ `
uniform vec3 uSunDir;
uniform float uTime;
float hash(vec2 p){ p = fract(p*vec2(123.34, 456.21)); p += dot(p, p+45.32); return fract(p.x*p.y); }
float noise(vec2 p){ vec2 i=floor(p), f=fract(p); vec2 u=f*f*(3.-2.*f);
  return mix(mix(hash(i),hash(i+vec2(1,0)),u.x), mix(hash(i+vec2(0,1)),hash(i+vec2(1,1)),u.x), u.y); }
float fbm(vec2 p){ float v=0., a=.5; for(int i=0;i<5;i++){ v+=a*noise(p); p*=2.03; a*=.5; } return v; }
vec3 skyColor(vec3 d){
  float h = max(d.y, 0.0);
  vec3 horizon = vec3(1.0, 0.58, 0.42);
  vec3 low = vec3(0.92, 0.33, 0.44);
  vec3 mid = vec3(0.46, 0.13, 0.42);
  vec3 upper = vec3(0.15, 0.055, 0.29);
  vec3 zenith = vec3(0.03, 0.017, 0.10);
  vec3 col = horizon;
  col = mix(col, low, smoothstep(0.0, 0.05, h));
  col = mix(col, mid, smoothstep(0.035, 0.15, h));
  col = mix(col, upper, smoothstep(0.12, 0.32, h));
  col = mix(col, zenith, smoothstep(0.3, 0.75, h));
  float s = max(dot(normalize(d), uSunDir), 0.0);
  col += vec3(1.0, 0.5, 0.3) * pow(s, 6.0) * 0.22;
  col += vec3(1.0, 0.72, 0.48) * pow(s, 70.0) * 0.45;
  // authored as display colors → convert to linear for the HDR pipeline
  return pow(col * 0.95, vec3(2.2));
}`;

const skyMaterial = (uniforms: Record<string, THREE.IUniform>) =>
  new THREE.ShaderMaterial({
    uniforms,
    side: THREE.BackSide,
    depthWrite: false,
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main(){ vDir = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
    fragmentShader: /* glsl */ `
      varying vec3 vDir;
      ${SKY_GLSL}
      void main(){
        vec3 d = normalize(vDir);
        vec3 col = skyColor(d);
        float h = d.y;
        float s = max(dot(d, uSunDir), 0.0);
        col += vec3(1.0, 0.78, 0.5) * smoothstep(0.99905, 0.99935, s) * 3.0;
        if (h > 0.0) {
          vec2 uv = d.xz / (h + 0.09) * 0.55;
          float n = fbm(uv * 0.85 + vec2(uTime * 0.006, uTime * 0.002));
          float band = smoothstep(0.015, 0.08, h) * (1.0 - smoothstep(0.22, 0.48, h));
          float cloud = smoothstep(0.52, 0.86, n) * band;
          vec3 lit = mix(vec3(0.98, 0.46, 0.62), vec3(1.0, 0.8, 0.62), pow(s, 2.5));
          vec3 cc = mix(lit, vec3(0.42, 0.22, 0.58), smoothstep(0.08, 0.38, h));
          col = mix(col, pow(cc, vec3(2.2)), cloud * 0.8);
        }
        gl_FragColor = vec4(col, 1.0);
      }`,
  });

export interface HeroSceneOptions {
  reducedMotion: boolean;
  onBoop: (x: number, y: number) => void;
  onCrystalClick?: (id: string, x: number, y: number) => void;
}

export interface HeroScene {
  start(): void;
  stop(): void;
  intro(onProgress?: (t: number) => void): Promise<void>;
  setScroll(p: number): void;
  setCrystals(ids: readonly string[]): void;
  dispose(): void;
}

export function createHeroScene(canvas: HTMLCanvasElement, opts: HeroSceneOptions): HeroScene {
  const isSmall = Math.min(innerWidth, innerHeight) < 600;
  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance', alpha: false });
  let pixelRatio = Math.min(devicePixelRatio || 1, isSmall ? 1.5 : 1.75);
  renderer.setPixelRatio(pixelRatio);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 0.95;
  renderer.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(34, 1, 0.1, 1200);
  const camHome = new THREE.Vector3(0, 0.95, 8.6);
  const lookHome = new THREE.Vector3(0, 1.62, 0);
  camera.position.copy(camHome);

  const sunDir = new THREE.Vector3(0.21, 0.05, -1).normalize();
  const uniforms = { uSunDir: { value: sunDir }, uTime: { value: 0 } };

  /* Sky */
  const sky = new THREE.Mesh(new THREE.SphereGeometry(500, 48, 24), skyMaterial(uniforms));
  scene.add(sky);

  /* Environment map from the same sky (so the glass reflects the sunset) */
  const pmrem = new THREE.PMREMGenerator(renderer);
  const envScene = new THREE.Scene();
  envScene.add(new THREE.Mesh(new THREE.SphereGeometry(100, 32, 16), skyMaterial({ uSunDir: { value: sunDir }, uTime: { value: 10 } })));
  const envRT = pmrem.fromScene(envScene, 0.02);
  scene.environment = envRT.texture;

  /* Stars */
  const starCount = 900;
  const starPos = new Float32Array(starCount * 3);
  const starSeed = new Float32Array(starCount);
  for (let i = 0; i < starCount; i++) {
    const u = Math.random();
    const v = 0.12 + Math.random() * 0.88;
    const th = u * Math.PI * 2;
    const y = v;
    const r = Math.sqrt(1 - y * y);
    starPos.set([Math.cos(th) * r * 450, y * 450, Math.sin(th) * r * 450], i * 3);
    starSeed[i] = Math.random();
  }
  const starGeo = new THREE.BufferGeometry();
  starGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
  starGeo.setAttribute('seed', new THREE.BufferAttribute(starSeed, 1));
  const stars = new THREE.Points(
    starGeo,
    new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime; varying float vA;
        void main(){
          vec3 d = normalize(position);
          vA = smoothstep(0.18, 0.55, d.y) * (0.45 + 0.55 * sin(uTime * (0.6 + seed * 2.0) + seed * 40.0));
          gl_PointSize = (1.2 + seed * 2.2);
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }`,
      fragmentShader: /* glsl */ `
        varying float vA;
        void main(){ float d = length(gl_PointCoord - .5); if (d > .5) discard; gl_FragColor = vec4(vec3(1.0, 0.95, 1.0), vA * (1.0 - d * 2.0)); }`,
    }),
  );
  scene.add(stars);

  /* Ocean */
  const oceanGeo = new THREE.PlaneGeometry(420, 420, isSmall ? 140 : 220, isSmall ? 140 : 220);
  oceanGeo.rotateX(-Math.PI / 2);
  const ocean = new THREE.Mesh(
    oceanGeo,
    new THREE.ShaderMaterial({
      uniforms,
      vertexShader: /* glsl */ `
        uniform float uTime;
        varying vec3 vWorld; varying vec3 vNormal2;
        vec3 wave(vec2 p){
          // height, d/dx, d/dz  — four gentle swells
          vec3 r = vec3(0.0);
          vec4 A = vec4(0.10, 0.07, 0.045, 0.03);
          vec4 K = vec4(0.32, 0.55, 0.95, 1.6);
          vec4 S = vec4(0.9, 1.25, 1.7, 2.3);
          vec2 D0 = normalize(vec2(0.2, 1.0)), D1 = normalize(vec2(-0.6, 0.9)), D2 = normalize(vec2(0.8, 0.5)), D3 = normalize(vec2(-0.3, -1.0));
          vec2 D[4]; D[0]=D0; D[1]=D1; D[2]=D2; D[3]=D3;
          for (int i = 0; i < 4; i++) {
            float ph = dot(D[i], p) * K[i] + uTime * S[i];
            r.x += A[i] * sin(ph);
            r.y += A[i] * K[i] * cos(ph) * D[i].x;
            r.z += A[i] * K[i] * cos(ph) * D[i].y;
          }
          return r;
        }
        void main(){
          vec4 wp = modelMatrix * vec4(position, 1.0);
          float fade = 1.0 - smoothstep(30.0, 120.0, length(wp.xz - cameraPosition.xz));
          vec3 w = wave(wp.xz) * fade;
          wp.y += w.x;
          vNormal2 = normalize(vec3(-w.y, 1.0, -w.z));
          vWorld = wp.xyz;
          gl_Position = projectionMatrix * viewMatrix * wp;
        }`,
      fragmentShader: /* glsl */ `
        varying vec3 vWorld; varying vec3 vNormal2;
        ${SKY_GLSL}
        void main(){
          vec3 V = normalize(cameraPosition - vWorld);
          float dist = length(vWorld.xz - cameraPosition.xz);
          // fine ripples for sun glitter
          vec2 p = vWorld.xz;
          float rip = (fbm(p * 1.6 + vec2(uTime * 0.35, uTime * 0.2)) - 0.5) * 0.35 * (1.0 - smoothstep(10.0, 90.0, dist));
          float rip2 = (fbm(p * 4.0 - vec2(uTime * 0.5, -uTime * 0.3)) - 0.5) * 0.22 * (1.0 - smoothstep(4.0, 40.0, dist));
          vec3 N = normalize(vNormal2 + vec3(rip + rip2, 0.0, rip - rip2));
          vec3 R = reflect(-V, N); R.y = abs(R.y);
          vec3 refl = skyColor(normalize(R));
          float fres = 0.04 + 0.96 * pow(1.0 - max(dot(N, V), 0.0), 5.0);
          vec3 deep = pow(vec3(0.05, 0.035, 0.14), vec3(2.2));
          vec3 col = mix(deep, refl, fres);
          float sd = max(dot(normalize(R), uSunDir), 0.0);
          col += vec3(1.0, 0.78, 0.55) * (pow(sd, 1400.0) * 6.0 + pow(sd, 260.0) * 0.18);
          vec3 fogDir = normalize(vec3(-V.x, 0.0015, -V.z));
          col = mix(col, skyColor(fogDir), smoothstep(35.0, 200.0, dist));
          gl_FragColor = vec4(col, 1.0);
        }`,
    }),
  );
  scene.add(ocean);

  /* Lights (the env map does most of the work) */
  const sun = new THREE.DirectionalLight(0xffc49a, 2.4);
  sun.position.copy(sunDir).multiplyScalar(20);
  scene.add(sun);
  const rim = new THREE.DirectionalLight(0xb79cff, 1.4);
  rim.position.set(4, 3, 5);
  scene.add(rim);
  scene.add(new THREE.HemisphereLight(0xffb3d9, 0x2a1a5e, 0.6));

  /* The Donut */
  const outer = new THREE.Group(); // tilt + bob + pointer
  const spin = new THREE.Group(); // spins around its own axis
  outer.add(spin);
  outer.position.set(0, 1.62, 0);
  outer.rotation.x = 0.6;
  scene.add(outer);

  const R = 1;
  const r = 0.42;
  const doughGeo = new THREE.TorusGeometry(R, r, 72, 220);
  doughGeo.rotateX(-Math.PI / 2);
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0xffffff,
    metalness: 0,
    roughness: 0.05,
    transmission: 1,
    thickness: 1.4,
    ior: 1.5,
    dispersion: 4,
    iridescence: 1,
    iridescenceIOR: 1.3,
    iridescenceThicknessMinimum: 120,
    iridescenceThicknessMaximum: 520,
    clearcoat: 1,
    clearcoatRoughness: 0.04,
    attenuationColor: new THREE.Color('#fff0f8'),
    attenuationDistance: 4.5,
    specularIntensity: 1,
    envMapIntensity: 1.6,
  });
  const dough = new THREE.Mesh(doughGeo, glass);
  spin.add(dough);

  const glazeGeo = new THREE.TorusGeometry(R, r + 0.028, 72, 220);
  glazeGeo.rotateX(-Math.PI / 2);
  const glaze = new THREE.MeshPhysicalMaterial({
    color: 0xff7fbf,
    roughness: 0.22,
    metalness: 0,
    clearcoat: 1,
    clearcoatRoughness: 0.06,
    sheen: 0.6,
    sheenColor: new THREE.Color('#ffd1ea'),
    sheenRoughness: 0.4,
    envMapIntensity: 1.2,
    side: THREE.DoubleSide,
  });
  glaze.onBeforeCompile = (shader) => {
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFrostUv;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvFrostUv = uv;');
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vFrostUv;')
      .replace(
        'void main() {',
        `void main() {
          float fu = vFrostUv.x * 6.2831853;
          float fv = vFrostUv.y * 6.2831853;
          float edge = -0.16 + 0.07 * sin(fu * 7.0 + 1.0) + 0.05 * sin(fu * 13.0 + 2.0) + 0.025 * sin(fu * 29.0);
          float drip = pow(max(0.0, sin(fu * 9.0 + 0.7)), 16.0) * 0.6 + pow(max(0.0, sin(fu * 5.0 + 2.3)), 24.0) * 0.5;
          float outerSide = smoothstep(-0.2, 0.5, cos(fv));
          if (sin(fv) < edge - drip * outerSide) discard;`,
      );
  };
  const glazeMesh = new THREE.Mesh(glazeGeo, glaze);
  spin.add(glazeMesh);

  /* Sprinkles */
  const sprinkleColors = ['#ffd84a', '#5eb8ff', '#6cf2b5', '#ffffff', '#b79cff', '#ff4fa3', '#ff8a5c'].map((c) => new THREE.Color(c));
  const sprGeo = new THREE.CapsuleGeometry(0.019, 0.085, 4, 8);
  const sprMat = new THREE.MeshPhysicalMaterial({ roughness: 0.35, clearcoat: 0.6, envMapIntensity: 0.8 });
  const sprinkleCount = 230;
  const sprinkles = new THREE.InstancedMesh(sprGeo, sprMat, sprinkleCount);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const up = new THREE.Vector3(0, 1, 0);
  const tmpN = new THREE.Vector3();
  const tmpT = new THREE.Vector3();
  const tmpP = new THREE.Vector3();
  const one = new THREE.Vector3(1, 1, 1);
  let placed = 0;
  while (placed < sprinkleCount) {
    const u = Math.random() * Math.PI * 2;
    const v = Math.random() * Math.PI * 2;
    if (Math.sin(v) < 0.2) continue;
    const rr = r + 0.04;
    tmpN.set(Math.cos(v) * Math.cos(u), Math.sin(v), -Math.cos(v) * Math.sin(u));
    tmpP.set((R + rr * Math.cos(v)) * Math.cos(u), rr * Math.sin(v), -(R + rr * Math.cos(v)) * Math.sin(u));
    tmpT.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).cross(tmpN).normalize();
    q.setFromUnitVectors(up, tmpT);
    m4.compose(tmpP, q, one);
    sprinkles.setMatrixAt(placed, m4);
    sprinkles.setColorAt(placed, sprinkleColors[placed % sprinkleColors.length]);
    placed++;
  }
  spin.add(sprinkles);

  /* Boop burst sprinkles */
  const burstMax = 90;
  const burstMesh = new THREE.InstancedMesh(sprGeo, sprMat, burstMax);
  burstMesh.frustumCulled = false;
  const burstParts = Array.from({ length: burstMax }, (_, i) => ({
    p: new THREE.Vector3(),
    v: new THREE.Vector3(),
    rot: new THREE.Quaternion(),
    spinAxis: new THREE.Vector3(1, 0, 0),
    life: 0,
    color: sprinkleColors[i % sprinkleColors.length],
  }));
  burstParts.forEach((b, i) => {
    burstMesh.setColorAt(i, b.color);
    m4.makeScale(0, 0, 0);
    burstMesh.setMatrixAt(i, m4);
  });
  scene.add(burstMesh);
  let burstCursor = 0;

  /* Orbiting crystals — one per hidden crystal; they light up as you find them */
  const shardBody = new THREE.CylinderGeometry(0.11, 0.11, 0.34, 6);
  const shardTip = new THREE.ConeGeometry(0.11, 0.2, 6);
  shardTip.translate(0, 0.27, 0);
  const shardBottom = new THREE.ConeGeometry(0.11, 0.1, 6);
  shardBottom.rotateX(Math.PI);
  shardBottom.translate(0, -0.22, 0);
  const shardGeo = mergeGeometries([shardBody.toNonIndexed(), shardTip.toNonIndexed(), shardBottom.toNonIndexed()]);
  shardGeo.computeVertexNormals();
  const shards = CRYSTALS.map((c, i) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      roughness: 0.1,
      transmission: 0.55,
      thickness: 0.4,
      ior: 1.6,
      flatShading: true,
      emissive: new THREE.Color(c.color[3]),
      emissiveIntensity: 0,
      iridescence: 0.6,
      transparent: true,
      opacity: 0.55,
      envMapIntensity: 1.4,
    });
    const mesh = new THREE.Mesh(shardGeo, mat);
    const s = 0.55 + (i % 3) * 0.1;
    mesh.scale.setScalar(s);
    mesh.userData = { id: c.id, color: new THREE.Color(c.color[1]), angle: (i / CRYSTALS.length) * Math.PI * 2, radius: 2.15 + (i % 2) * 0.35, y: ((i % 3) - 1) * 0.42, found: false, glow: 0 };
    scene.add(mesh);
    return mesh;
  });

  /* Glitter */
  const gCount = isSmall ? 160 : 320;
  const gPos = new Float32Array(gCount * 3);
  const gSeed = new Float32Array(gCount);
  for (let i = 0; i < gCount; i++) {
    const rad = 1.9 + Math.random() * 3.2;
    const th = Math.random() * Math.PI * 2;
    const ph = Math.acos(Math.random() * 2 - 1);
    gPos.set([Math.sin(ph) * Math.cos(th) * rad, 1.6 + Math.cos(ph) * rad * 0.6, Math.sin(ph) * Math.sin(th) * rad * 0.7], i * 3);
    gSeed[i] = Math.random();
  }
  const gGeo = new THREE.BufferGeometry();
  gGeo.setAttribute('position', new THREE.BufferAttribute(gPos, 3));
  gGeo.setAttribute('seed', new THREE.BufferAttribute(gSeed, 1));
  const glitter = new THREE.Points(
    gGeo,
    new THREE.ShaderMaterial({
      uniforms: { uTime: uniforms.uTime, uPR: { value: pixelRatio } },
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      vertexShader: /* glsl */ `
        attribute float seed; uniform float uTime; uniform float uPR; varying float vA; varying float vS;
        void main(){
          vec3 p = position;
          p.y += sin(uTime * 0.4 + seed * 20.0) * 0.12;
          p.x += cos(uTime * 0.3 + seed * 13.0) * 0.08;
          vec4 mv = modelViewMatrix * vec4(p, 1.0);
          vA = pow(0.5 + 0.5 * sin(uTime * (1.5 + seed * 3.0) + seed * 50.0), 3.0);
          vS = seed;
          gl_PointSize = (6.0 + seed * 10.0) * uPR * (4.0 / -mv.z);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        varying float vA; varying float vS;
        void main(){
          vec2 c = gl_PointCoord - 0.5;
          float star = max(0.0, 1.0 - (abs(c.x) * abs(c.y)) * 60.0 - length(c) * 1.6);
          vec3 col = mix(vec3(1.0, 0.75, 0.9), vec3(0.75, 0.95, 1.0), vS);
          gl_FragColor = vec4(col, star * vA);
        }`,
    }),
  );
  scene.add(glitter);

  /* Post */
  const composer = new EffectComposer(renderer);
  composer.addPass(new RenderPass(scene, camera));
  const bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.32, 0.5, 0.92);
  composer.addPass(bloom);
  composer.addPass(new OutputPass());

  /* Sizing */
  let layoutWide = true;
  const resize = () => {
    const w = canvas.clientWidth || innerWidth;
    const hgt = canvas.clientHeight || innerHeight;
    renderer.setPixelRatio(pixelRatio);
    renderer.setSize(w, hgt, false);
    composer.setPixelRatio(pixelRatio);
    composer.setSize(w, hgt);
    bloom.resolution.set(w / 2, hgt / 2);
    camera.aspect = w / hgt;
    layoutWide = camera.aspect > 1.15;
    camera.fov = layoutWide ? 34 : 46;
    camera.updateProjectionMatrix();
  };
  resize();
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  /* Interaction */
  const pointer = new THREE.Vector2(0, 0);
  const pointerTarget = new THREE.Vector2(0, 0);
  let spinVel = opts.reducedMotion ? 0.06 : 0.32;
  const baseSpin = spinVel;
  let dragging = false;
  let dragX = 0;
  let downX = 0;
  let downY = 0;
  let squash = 0;
  let squashVel = 0;
  const raycaster = new THREE.Raycaster();
  const ndc = new THREE.Vector2();

  const onMove = (e: PointerEvent) => {
    pointerTarget.set((e.clientX / innerWidth) * 2 - 1, (e.clientY / innerHeight) * 2 - 1);
    if (dragging) {
      const dx = e.clientX - dragX;
      dragX = e.clientX;
      spinVel = dx * 0.04;
    }
  };
  const onDown = (e: PointerEvent) => {
    dragging = true;
    dragX = downX = e.clientX;
    downY = e.clientY;
  };
  const onUp = (e: PointerEvent) => {
    if (!dragging) return;
    dragging = false;
    if (Math.hypot(e.clientX - downX, e.clientY - downY) < 6) click(e);
  };
  const click = (e: PointerEvent) => {
    const rect = canvas.getBoundingClientRect();
    ndc.set(((e.clientX - rect.left) / rect.width) * 2 - 1, -((e.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(ndc, camera);
    const shardHit = raycaster.intersectObjects(shards, false)[0];
    if (shardHit) {
      opts.onCrystalClick?.(shardHit.object.userData.id, e.clientX, e.clientY);
      return;
    }
    const hit = raycaster.intersectObjects([dough, glazeMesh], false)[0];
    if (!hit) return;
    squashVel -= 0.9;
    spinVel += (Math.random() > 0.5 ? 1 : -1) * 3.5;
    const n = opts.reducedMotion ? 10 : 34;
    for (let i = 0; i < n; i++) {
      const b = burstParts[burstCursor++ % burstMax];
      b.p.copy(hit.point);
      b.v.set((Math.random() - 0.5) * 4.2, 1.6 + Math.random() * 3.4, (Math.random() - 0.2) * 3.6);
      b.rot.setFromEuler(new THREE.Euler(Math.random() * 6, Math.random() * 6, Math.random() * 6));
      b.spinAxis.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize();
      b.life = 1;
    }
    opts.onBoop(e.clientX, e.clientY);
  };
  canvas.addEventListener('pointerdown', onDown);
  addEventListener('pointermove', onMove, { passive: true });
  addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', () => (dragging = false));

  /* Loop */
  let running = false;
  let raf = 0;
  let last = performance.now();
  let scroll = 0;
  let introT = 1;
  const introFrom = new THREE.Vector3(0, 46, 34);
  let frameTimes: number[] = [];
  const lookAt = new THREE.Vector3();
  const spinQ = new THREE.Quaternion();

  const frame = (now: number) => {
    raf = requestAnimationFrame(frame);
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    uniforms.uTime.value += dt;
    const t = uniforms.uTime.value;

    // Adaptive quality
    frameTimes.push(dt);
    if (frameTimes.length > 90) {
      const avg = frameTimes.reduce((a, b) => a + b, 0) / frameTimes.length;
      frameTimes = [];
      if (avg > 0.028 && pixelRatio > 0.8) {
        pixelRatio = Math.max(0.8, pixelRatio - 0.25);
        if (pixelRatio <= 1) bloom.enabled = false;
        resize();
      }
    }

    pointer.lerp(pointerTarget, 0.05);

    // Spin with inertia back to the idle speed
    if (!dragging) spinVel += (baseSpin - spinVel) * 0.03;
    spin.rotation.y += spinVel * dt;

    // Squash & stretch spring
    squashVel += -squash * 0.35 - squashVel * 0.18;
    squash += squashVel * dt * 10;
    const sxz = 1 - squash * 0.12;
    const sy = 1 + squash * 0.18;
    spin.scale.set(sxz, sy, sxz);

    const bob = opts.reducedMotion ? 0 : Math.sin(t * 0.9) * 0.07;
    const donutX = layoutWide ? 1.95 : 0;
    const donutY = layoutWide ? 1.62 : 2.95;
    outer.scale.setScalar(layoutWide ? 1 : 0.8);
    outer.position.set(donutX, donutY + bob + scroll * 1.4, 0);
    outer.rotation.x = 0.6 + pointer.y * 0.18 + (opts.reducedMotion ? 0 : Math.sin(t * 0.6) * 0.04);
    outer.rotation.z = -pointer.x * 0.22 + (opts.reducedMotion ? 0 : Math.sin(t * 0.45) * 0.05);

    // Burst particles
    let anyBurst = false;
    burstParts.forEach((b, i) => {
      if (b.life <= 0) return;
      anyBurst = true;
      b.life -= dt * 0.8;
      b.v.y -= 6.5 * dt;
      b.p.addScaledVector(b.v, dt);
      spinQ.setFromAxisAngle(b.spinAxis, dt * 8);
      b.rot.multiply(spinQ);
      const s = Math.max(0, b.life) * 1.3;
      m4.compose(b.p, b.rot, tmpP.set(s, s, s));
      burstMesh.setMatrixAt(i, m4);
    });
    if (anyBurst) burstMesh.instanceMatrix.needsUpdate = true;

    // Crystals orbit
    shards.forEach((m, i) => {
      const d = m.userData;
      d.angle += dt * (0.18 + (i % 3) * 0.04) * (opts.reducedMotion ? 0.3 : 1);
      m.position.set(
        outer.position.x + Math.cos(d.angle) * d.radius,
        outer.position.y + d.y + Math.sin(t * 0.8 + i) * 0.08,
        Math.sin(d.angle) * d.radius * 0.75,
      );
      m.rotation.y += dt * 0.8;
      m.rotation.z = Math.sin(t * 0.5 + i) * 0.3;
      d.glow += ((d.found ? 1 : 0) - d.glow) * 0.04;
      const mat = m.material as THREE.MeshPhysicalMaterial;
      mat.emissiveIntensity = d.glow * (0.55 + Math.sin(t * 2 + i) * 0.15);
      mat.color.lerpColors(new THREE.Color(0xffffff), d.color, d.glow);
      mat.opacity = 0.5 + d.glow * 0.5;
    });

    // Camera: intro drop → home, then scroll drift
    const e = introT < 1 ? 1 - Math.pow(1 - introT, 3) : 1;
    camera.position.lerpVectors(introFrom, camHome, e);
    camera.position.x += pointer.x * 0.25;
    camera.position.y += -pointer.y * 0.12 + scroll * 0.9;
    camera.position.z += scroll * 1.6;
    lookAt.copy(lookHome);
    lookAt.x = layoutWide ? 0.45 : 0;
    lookAt.y += (1 - e) * 2 + scroll * 1.2 + (layoutWide ? 0 : -0.35);
    camera.lookAt(lookAt);

    composer.render(dt);
  };

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    intro(onProgress) {
      if (opts.reducedMotion) {
        introT = 1;
        onProgress?.(1);
        return Promise.resolve();
      }
      introT = 0;
      return new Promise<void>((resolve) => {
        const start = performance.now();
        const dur = 3200;
        const step = (now: number) => {
          introT = Math.min(1, (now - start) / dur);
          onProgress?.(introT);
          if (introT < 1) requestAnimationFrame(step);
          else resolve();
        };
        requestAnimationFrame(step);
      });
    },
    setScroll(p: number) {
      scroll = p;
    },
    setCrystals(ids) {
      shards.forEach((m) => (m.userData.found = ids.includes(m.userData.id)));
    },
    dispose() {
      this.stop();
      ro.disconnect();
      removeEventListener('pointermove', onMove);
      removeEventListener('pointerup', onUp);
      renderer.dispose();
      envRT.dispose();
      pmrem.dispose();
    },
  };
}
