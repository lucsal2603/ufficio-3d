/* Ufficio 3D: carica la stanza e gli omini (glb esportati da Blender), li fa vivere con le clip e li muove
   fra i punti della stanza. Riceve gli eventi veri (SSE) e quelli della vita d'ufficio (vita.js).
   Funziona anche da solo, senza server: in quel caso vive con la sola vita d'ufficio. */
import * as THREE from 'three';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

export const AGENTI = ['manager', 'scout', 'ispettore', 'copywriter', 'preventivista', 'social', 'collaudatore', 'segretaria'];
const VELOCITA = 0.9;              // metri al secondo
const GIRI = ['wp_centro', 'wp_divano', 'wp_porta', 'wp_tv', 'wp_acqua', 'wp_stampante', 'wp_poltrona', 'wp_reception'];
const FACCIA_FISSA = { wp_caffe: Math.PI, wp_acqua: Math.PI, wp_frigo: Math.PI, wp_stampante: -Math.PI / 2, wp_tv: -Math.PI / 2 };
const CIBI = ['cibo_panino', 'cibo_pizza', 'cibo_mela', 'cibo_brioche', 'cibo_tazza'];
const rand = (a, b) => a + Math.random() * (b - a);
const scegli = arr => arr[Math.floor(Math.random() * arr.length)];

// fumetti: icona e parola di quello che stanno facendo
const ICONE = {
  digita: ['⌨️', 'scrive'], scrive: ['⌨️', 'scrive'], legge: ['📄', 'legge'], cerca: ['🗺️', 'cerca'], appisola: ['💤', 'zzz'],
  sveglia: ['❗', 'si sveglia'], telefono: ['📱', 'al telefono'], rimprovero: ['😳', 'scusa!'], sgrida: ['😠', 'sgrida'],
  parla: ['💬', 'parla'], chiacchiera: ['💬', 'chiacchiera'], consegna: ['📨', 'consegna'], caffe: ['☕', 'caffè'],
  mangia: ['🍽️', 'mangia'], cammina: ['🚶', 'in giro'], stiracchia_piedi: ['🙆', 'si stira'], balla: ['🎧', 'balla'],
  applaude: ['👏', 'bravo!'], festeggia: ['🎉', 'evviva!'], errore: ['🤔', 'mmm...'], finito: ['✅', 'fatto'],
  trovato: ['🔎', 'trovato!'], pensa: ['💡', 'idea!'], sbadiglia: ['🥱', 'sbadiglia'], gira_sedia: ['🌀', 'gira'],
  guarda_orologio: ['⌚', "che ora è?"], saluta: ['👋', 'ciao!'], beve_acqua: ['💧', 'beve'],
  cibo_panino: ['🥪', 'panino'], cibo_pizza: ['🍕', 'pizza'], cibo_mela: ['🍎', 'mela'], cibo_tazza: ['☕', 'tazza'], cibo_brioche: ['🥐', 'brioche'],
};
const _texture = {};
function texturaFumetto(chiave) {
  if (_texture[chiave]) return _texture[chiave];
  const [icona, testo] = ICONE[chiave] || ['💬', chiave];
  const c = document.createElement('canvas'); c.width = 256; c.height = 176; const g = c.getContext('2d');
  g.fillStyle = '#ffffff'; g.strokeStyle = '#1c2128'; g.lineWidth = 6;
  g.beginPath(); g.roundRect(14, 10, 228, 122, 26); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(56, 128); g.lineTo(34, 166); g.lineTo(96, 128); g.closePath(); g.fill();
  g.beginPath(); g.moveTo(58, 130); g.lineTo(34, 166); g.lineTo(94, 130); g.stroke();
  g.fillStyle = '#ffffff'; g.fillRect(60, 124, 34, 10);
  g.textAlign = 'center'; g.font = '66px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif'; g.fillStyle = '#1c2128';
  g.fillText(icona, 128, 82);
  g.font = '600 24px -apple-system, "Helvetica Neue", Helvetica, Arial, sans-serif'; g.fillText(testo, 128, 118);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; _texture[chiave] = t; return t;
}

function yawVerso(da, a) { return Math.atan2(a.x - da.x, a.z - da.z); }
function lerpAngolo(a, b, t) { let d = ((b - a + Math.PI) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI) - Math.PI; return a + d * t; }

class Omino {
  constructor(nome, gltf, mondo) {
    this.nome = nome; this.mondo = mondo;
    this.root = new THREE.Group();
    gltf.scene.children.slice().forEach(c => { c.position.set(0, 0, 0); c.rotation.set(0, 0, 0); this.root.add(c); });
    this.root.traverse(o => { if (o.isMesh) { o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false; } });
    this.mixer = new THREE.AnimationMixer(this.root);
    this.clips = {}; gltf.animations.forEach(c => { this.clips[c.name] = c; });
    this.azione = null; this.coda = []; this.passo = null;
    this.seduto = false; this.sgabello = null; this.cibo = null; this.occupato = false;
    this.mano = null; this.root.traverse(o => { if (o.isBone && /hand[._]?R/i.test(o.name)) this.mano = o; });
    this.seat = mondo.punti['seat_' + nome] || new THREE.Vector3();
    this.etichetta(); this.creaFumetto(); this.preparaOcchi();
    this.root.position.copy(this.seat); this.root.rotation.y = 0;
    this.siediSubito('digita');
  }
  etichetta() {
    const c = document.createElement('canvas'); c.width = 256; c.height = 64;
    const g = c.getContext('2d'); g.font = '600 30px -apple-system, Helvetica, Arial'; g.textAlign = 'center';
    g.fillStyle = 'rgba(20,24,32,.72)'; g.beginPath(); g.roundRect(28, 8, 200, 48, 14); g.fill();
    g.fillStyle = '#fff'; g.fillText(this.nome[0].toUpperCase() + this.nome.slice(1), 128, 42);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), depthTest: false, transparent: true }));
    sp.scale.set(0.9, 0.22, 1); sp.position.set(0, 2.05, 0); this.root.add(sp);
  }
  preparaOcchi() {
    // battito di ciglia: gli occhi prendono per un attimo il colore della pelle
    this.occhi = []; let pelle = null;
    this.root.traverse(o => {
      if (!o.isMesh || !o.material) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      mats.forEach((m, i) => {
        if (/_(eye|eye_hl|eye_brown)$/.test(m.name)) { const c = m.clone(); if (Array.isArray(o.material)) o.material[i] = c; else o.material = c; this.occhi.push({ m: c, colore: c.color.clone() }); }
        if (/_skin(_tan)?$/.test(m.name) && !pelle) pelle = m.color.clone();
      });
    });
    this.pelle = pelle || new THREE.Color(0.96, 0.72, 0.52);
    this.prossimoBlink = performance.now() + rand(1500, 5000); this.fineBlink = 0; this.doppio = false;
  }
  aggiornaOcchi() {
    const t = performance.now();
    if (this.fineBlink && t > this.fineBlink) {
      this.occhi.forEach(o => o.m.color.copy(o.colore)); this.fineBlink = 0;
      if (this.doppio) { this.doppio = false; this.prossimoBlink = t + 220; } else this.prossimoBlink = t + rand(2500, 6500);
    } else if (!this.fineBlink && t > this.prossimoBlink) {
      this.occhi.forEach(o => o.m.color.copy(this.pelle)); this.fineBlink = t + rand(110, 150);
      if (Math.random() < 0.2) this.doppio = true;
    }
  }
  creaFumetto() {
    this.nuvola = new THREE.Sprite(new THREE.SpriteMaterial({ map: texturaFumetto('parla'), transparent: true, depthTest: false, opacity: 0 }));
    this.nuvola.scale.set(0.82, 0.56, 1); this.nuvola.position.set(0.5, 2.6, 0); this.nuvola.visible = false; this.nuvolaFino = 0; this.root.add(this.nuvola);
  }
  fumetto(chiave, secondi = 4) {
    if (!ICONE[chiave]) return;
    this.nuvola.material.map = texturaFumetto(chiave); this.nuvola.material.needsUpdate = true;
    this.nuvola.visible = true; this.nuvola.material.opacity = 1; this.nuvolaFino = performance.now() + secondi * 1000;
  }
  play(nome, { loop = true, fade = 0.25, tieni = false } = {}) {
    const clip = this.clips[nome]; if (!clip) return 0;
    const az = this.mixer.clipAction(clip);
    az.reset(); az.enabled = true; az.setEffectiveWeight(1);
    if (loop) az.setLoop(THREE.LoopRepeat, Infinity); else { az.setLoop(THREE.LoopOnce, 1); az.clampWhenFinished = tieni || true; }
    if (this.azione && this.azione !== az) { az.crossFadeFrom(this.azione, fade, false); }
    az.play(); this.azione = az; return clip.duration;
  }
  // ---- passi della coda ----
  vai(p, faccia) { this.coda.push({ tipo: 'vai', a: p.clone(), faccia }); return this; }
  clip(nome, opz = {}) { this.coda.push({ tipo: 'clip', nome, ...opz }); return this; }
  attesa(ms) { this.coda.push({ tipo: 'attesa', ms }); return this; }
  fai(fn) { this.coda.push({ tipo: 'fai', fn }); return this; }
  alzati() { this.coda.push({ tipo: 'alzati' }); return this; }
  siediti(poi = 'digita', dove = null, yaw = 0) { this.coda.push({ tipo: 'siediti', poi, dove, yaw }); return this; }
  torna(poi = 'digita') { return this.vai(this.seat).siediti(poi); }
  svuota() { this.coda = []; this.passo = null; }
  siediSubito(poi) { this.seduto = true; this.play(poi, { loop: true, fade: 0.1 }); }
  // ---- sequenze ----
  sedutoCon(nome, secondi, poi = 'digita') {
    this.svuota();
    if (!this.seduto) this.torna(poi);
    this.clip(nome, { loop: !(this.clips[nome] && !['digita', 'seduto', 'telefono', 'cerca', 'legge', 'errore', 'mangia', 'balla', 'chiacchiera', 'parla', 'sgrida', 'applaude', 'caffe', 'idle_piedi'].includes(nome)) ? true : false, secondi });
    if (poi) this.clip(poi, { loop: true });
    return this;
  }
  inPiediAllaScrivania(nome, secondi, poi = 'digita') {
    this.svuota();
    if (this.seduto) this.alzati(); else this.vai(this.seat);
    this.clip(nome, { loop: true, secondi }).siediti(poi);
    return this;
  }
  giro(nome_clip, secondi, tappe = 1) {
    this.svuota(); this.alzati();
    for (let i = 0; i < tappe; i++) { const wp = this.mondo.punti[scegli(GIRI)] || this.seat; this.vai(wp); }
    if (nome_clip) this.clip(nome_clip, { loop: true, secondi });
    return this.torna();
  }
  vaDa(bersaglio, nome_clip, secondi) {
    const b = this.mondo.omini[bersaglio]; if (!b) return this;
    const p = this.mondo.punti['wp_' + bersaglio + '_fronte'];
    this.svuota(); this.alzati();
    if (p) this.vai(p, Math.PI); else this.vai(b.root.position.clone().add(new THREE.Vector3(0.9, 0, 0)));
    this.clip(nome_clip, { loop: true, secondi });
    return this.torna();
  }
  vaA(nomePunto, nome_clip, secondi, poi = 'digita') {
    const p = this.mondo.punti[nomePunto]; if (!p) return this.giro(nome_clip, secondi);
    this.svuota(); this.alzati().vai(p, FACCIA_FISSA[nomePunto]);
    if (nome_clip) this.clip(nome_clip, { loop: true, secondi });
    return this.torna(poi);
  }
  mangia(secondi) {
    const sg = this.mondo.sgabelloLibero(); if (!sg) return this.giro('idle_piedi', 6);
    this.svuota(); this.alzati().vai(sg.inPiedi).fai(() => { this.sgabello = sg; sg.occupato = true; });
    this.siediti('mangia', sg.seduta, sg.yaw);
    this.fai(() => this.prendiCibo()).attesa(secondi * 1000).fai(() => this.lasciaCibo());
    this.alzati().fai(() => { if (this.sgabello) this.sgabello.occupato = false; this.sgabello = null; });
    return this.torna();
  }
  prendiCibo() {
    if (!this.mano || !this.mondo.cibo) return;
    const src = this.mondo.cibo[scegli(CIBI)]; if (!src) return;
    this.cibo = src.clone(true); this.cibo.position.set(-0.05, 0.06, 0.02); this.cibo.rotation.set(0, 0, 0); this.cibo.scale.set(1, 1, 1);
    this.mano.add(this.cibo); this.fumetto(src.name, 30);
  }
  lasciaCibo() { if (this.cibo) { this.cibo.removeFromParent(); this.cibo = null; } }
  // ---- aggiornamento ----
  update(dt) {
    this.mixer.update(dt); this.aggiornaOcchi();
    if (this.nuvola.visible && performance.now() > this.nuvolaFino) { this.nuvola.material.opacity -= dt * 3; if (this.nuvola.material.opacity <= 0) { this.nuvola.visible = false; this.nuvola.material.opacity = 0; } }
    if (!this.passo) { this.passo = this.coda.shift() || null; if (this.passo) this.inizioPasso(this.passo); if (!this.passo) return; }
    const p = this.passo;
    if (p.tipo === 'vai') {
      const pos = this.root.position; const dir = new THREE.Vector3().subVectors(p.a, pos); dir.y = 0; const dist = dir.length();
      if (dist < 0.05) { pos.x = p.a.x; pos.z = p.a.z; if (p.faccia !== undefined && p.faccia !== null) this.root.rotation.y = p.faccia; this.finePasso(); return; }
      dir.normalize(); const passo = Math.min(dist, VELOCITA * dt); pos.addScaledVector(dir, passo);
      this.root.rotation.y = lerpAngolo(this.root.rotation.y, Math.atan2(dir.x, dir.z), Math.min(1, dt * 8));
    } else if (p.tipo === 'clip' || p.tipo === 'attesa' || p.tipo === 'alzati' || p.tipo === 'siediti') {
      p.resto -= dt * 1000; if (p.resto <= 0) this.finePasso();
    }
  }
  inizioPasso(p) {
    if (p.tipo === 'vai') { if (this.seduto) { this.seduto = false; } this.play('cammina', { loop: true }); if (this.root.position.distanceTo(p.a) > 1.2) this.fumetto('cammina', 3); }
    else if (p.tipo === 'clip') { const d = this.play(p.nome, { loop: !!p.loop }); p.resto = (p.secondi != null ? p.secondi : d) * 1000; if (!p.loop && p.secondi == null) p.resto = d * 1000; if (!['digita', 'seduto', 'idle_piedi', 'siediti', 'alzati'].includes(p.nome)) this.fumetto(p.nome, Math.min(60, Math.max(3, p.resto / 1000))); }
    else if (p.tipo === 'attesa') { p.resto = p.ms; }
    else if (p.tipo === 'alzati') { if (this.seduto) { const d = this.play('alzati', { loop: false }); p.resto = d * 1000; this.seduto = false; } else p.resto = 0; }
    else if (p.tipo === 'siediti') {
      const dove = p.dove || this.seat; this.root.position.x = dove.x; this.root.position.z = dove.z; this.root.rotation.y = p.yaw || 0;
      const d = this.play('siediti', { loop: false }); p.resto = d * 1000; this.seduto = true;
      this.coda.unshift({ tipo: 'clip', nome: p.poi, loop: true, secondi: 0.01 });
    }
    else if (p.tipo === 'fai') { try { p.fn(); } catch (e) { console.warn(e); } this.finePasso(); }
  }
  finePasso() { this.passo = null; if (!this.coda.length && this.seduto && !(this.azione && this.azione.loop === THREE.LoopRepeat)) this.play('digita', { loop: true }); }
}

export async function avvia(container, { base = './', ticker = null } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2)); renderer.setSize(container.clientWidth, container.clientHeight);
  renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const scene = new THREE.Scene(); scene.background = new THREE.Color(0xcfd3da);
  const camera = new THREE.PerspectiveCamera(42, container.clientWidth / container.clientHeight, 0.1, 100);
  camera.position.set(8.5, 7.6, 11.2);
  const controls = new OrbitControls(camera, renderer.domElement);
  controls.target.set(-0.2, 0.5, 0.2); controls.maxPolarAngle = Math.PI / 2.05; controls.minPolarAngle = 0.15; controls.minDistance = 2.5; controls.maxDistance = 30; controls.enableDamping = true;
  // si può girare a destra e sinistra, ma non finire dietro la parete di fondo o quella di sinistra
  controls.minAzimuthAngle = THREE.MathUtils.degToRad(-12); controls.maxAzimuthAngle = THREE.MathUtils.degToRad(102);
  controls.enablePan = false;
  const ASSE_Y = new THREE.Vector3(0, 1, 0);
  function ruota(rad) { const off = camera.position.clone().sub(controls.target); off.applyAxisAngle(ASSE_Y, rad); camera.position.copy(controls.target).add(off); controls.update(); }
  let giro = 0;
  addEventListener('keydown', e => { if (e.key === 'ArrowLeft') giro = 1; if (e.key === 'ArrowRight') giro = -1; });
  addEventListener('keyup', e => { if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') giro = 0; });
  scene.add(new THREE.HemisphereLight(0xffffff, 0x8d8c86, 1.15));
  const sole = new THREE.DirectionalLight(0xfff4e0, 2.2); sole.position.set(6, 10, 7); sole.castShadow = true;
  sole.shadow.mapSize.set(2048, 2048); Object.assign(sole.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sole.shadow.bias = -0.0008;
  scene.add(sole);
  const loader = new GLTFLoader();
  const carica = url => new Promise((ok, no) => loader.load(url, ok, undefined, no));
  const mondo = { punti: {}, omini: {}, cibo: null, sgabelli: [], sgabelloLibero() { const l = this.sgabelli.filter(s => !s.occupato); return l.length ? scegli(l) : null; } };

  const stanza = await carica(base + 'modelli/stanza.glb');
  stanza.scene.traverse(o => { if (o.isMesh) { o.receiveShadow = true; o.castShadow = true; } });
  scene.add(stanza.scene); stanza.scene.updateMatrixWorld(true);
  const centroTavolo = new THREE.Vector3();
  stanza.scene.traverse(o => {
    if (/^(wp_|seat_)/.test(o.name)) { const p = new THREE.Vector3(); o.getWorldPosition(p); p.y = 0; mondo.punti[o.name] = p;
      const q = new THREE.Quaternion(); o.getWorldQuaternion(q); const d = new THREE.Vector3(0, 0, 1).applyQuaternion(q); mondo.punti[o.name].yaw = Math.atan2(d.x, d.z); }
  });
  const riun = Object.keys(mondo.punti).filter(k => k.startsWith('wp_riunione_'));
  riun.forEach(k => centroTavolo.add(mondo.punti[k])); if (riun.length) centroTavolo.divideScalar(riun.length);
  riun.forEach(k => { const p = mondo.punti[k]; const verso = new THREE.Vector3().subVectors(centroTavolo, p).setY(0); const dist = verso.length(); verso.normalize();
    const seduta = p.clone().addScaledVector(verso, Math.max(0.25, dist - 1.05)); const inPiedi = p.clone();
    mondo.sgabelli.push({ nome: k, inPiedi, seduta, yaw: Math.atan2(verso.x, verso.z), occupato: false }); });

  try { const cibo = await carica(base + 'modelli/cibo.glb'); mondo.cibo = {}; cibo.scene.children.forEach(o => { if (o.name.startsWith('cibo_')) { o.traverse(m => { if (m.isMesh) m.castShadow = true; }); mondo.cibo[o.name] = o; } }); } catch (e) { console.warn('cibo non caricato', e); }

  const caricati = await Promise.all(AGENTI.map(async n => { try { return [n, await carica(base + 'modelli/' + n + '.glb')]; } catch (e) { console.warn('omino non caricato', n, e); return null; } }));
  caricati.filter(Boolean).forEach(([n, g]) => { const o = new Omino(n, g, mondo); mondo.omini[n] = o; scene.add(o.root); });

  const clock = new THREE.Clock();
  let visibile = true;
  function frame() { requestAnimationFrame(frame); const dt = Math.min(0.05, clock.getDelta()); Object.values(mondo.omini).forEach(o => o.update(dt)); if (giro) ruota(giro * 1.1 * dt); if (visibile) { controls.update(); renderer.render(scene, camera); } }
  frame();
  new ResizeObserver(() => { const w = container.clientWidth, h = container.clientHeight; if (!w || !h) return; renderer.setSize(w, h); camera.aspect = w / h; camera.updateProjectionMatrix(); }).observe(container);

  const nota = t => { if (ticker) ticker(t); };
  function bersaglioDi(ev) { if (AGENTI.includes(ev.soggetto)) return ev.soggetto; const m = /a (\w+):/.exec(ev.dettaglio || ''); return m && AGENTI.includes(m[1]) ? m[1] : null; }

  function evento(ev) {           // eventi veri dell'ufficio
    const o = mondo.omini[ev.agente]; if (!o) return; const b = bersaglioDi(ev);
    switch (ev.azione) {
      case 'inizia': case 'scrive': o.sedutoCon('digita', 0.01); o.fumetto('scrive', 5); break;
      case 'legge': o.sedutoCon('legge', 8); break;
      case 'cerca': o.sedutoCon('cerca', 10); break;
      case 'trovato': o.inPiediAllaScrivania('trovato', 2.5); break;
      case 'finito': o.sedutoCon('finito', 1.5, 'seduto'); break;
      case 'aspetta': o.vaA('wp_caffe', 'caffe', 10, 'seduto'); break;
      case 'errore': o.sedutoCon('errore', 5, 'seduto'); break;
      case 'festeggia': o.inPiediAllaScrivania('festeggia', 4); break;
      case 'consegna': if (b) o.vaDa(b, 'consegna', 3); break;
      case 'parla': if (b) o.vaDa(b, 'parla', 6); break;
    }
  }
  function vita(ev) {             // vita d'ufficio, solo estetica
    const o = mondo.omini[ev.agente]; if (!o) return;
    switch (ev.azione) {
      case 'appisola': o.sedutoCon('appisola', 60, null); break;
      case 'sveglia': o.sedutoCon('sveglia', 0.7); break;
      case 'telefono': o.sedutoCon('telefono', 60, null); break;
      case 'rimprovero': o.sedutoCon('rimprovero', 1); break;
      case 'sgrida': if (ev.soggetto) o.vaDa(ev.soggetto, 'sgrida', 6); break;
      case 'va_da': if (ev.soggetto) o.vaDa(ev.soggetto, 'parla', 6); break;
      case 'passeggia': o.giro('idle_piedi', 4, 2); break;
      case 'sgranchisce': o.giro('stiracchia_piedi', 2.5, 1); break;
      case 'caffe': o.vaA('wp_caffe', 'caffe', rand(8, 14)); break;
      case 'mangia': o.mangia(rand(18, 35)); break;
      case 'chiacchiera': o.vaA(scegli(['wp_acqua', 'wp_caffe']), 'chiacchiera', rand(10, 18)); break;
      case 'balla': o.inPiediAllaScrivania('balla', rand(6, 12)); break;
      case 'applaude': o.inPiediAllaScrivania('applaude', 3); break;
      case 'saluta': o.inPiediAllaScrivania('saluta', 3); break;
      case 'guarda_orologio': o.inPiediAllaScrivania('guarda_orologio', 1.5); break;
      case 'sbadiglia': o.sedutoCon('sbadiglia', 2); break;
      case 'pensa': o.sedutoCon('pensa', 2.5); break;
      case 'gira_sedia': o.sedutoCon('gira_sedia', 2); break;
      case 'torna': if (!o.seduto && !o.coda.length) { o.svuota(); o.torna(); } break;
    }
    nota(ev);
  }
  return { evento, vita, mondo, scene, camera, ruota, gira(dir) { giro = dir; }, mostra(v) { visibile = v; } };
}
