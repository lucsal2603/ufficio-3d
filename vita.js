/* Vita d'ufficio deterministica.
   La giornata di ogni omino è un'agenda calcolata da un seme legato alla data (e al carico di lavoro
   degli ultimi giorni): movimenti casuali ma identici su ogni dispositivo, senza loop e senza server.
   Chi apre la pagina calcola cosa sta facendo ognuno in questo istante e riprende da lì.
   Gli eventi veri (SSE, solo con il Mac acceso) interrompono l'agenda; poi si riprende. */
(function () {
  const AGENTI = ['manager', 'scout', 'ispettore', 'copywriter', 'preventivista', 'social', 'collaudatore', 'segretaria'];
  const CAPO = 'manager';
  const CON_CUFFIE = ['social', 'collaudatore'];
  const GIORNO = 86400000;
  const GIRI = ['wp_centro', 'wp_divano', 'wp_porta', 'wp_tv', 'wp_acqua', 'wp_stampante', 'wp_poltrona', 'wp_reception'];
  const DURATE = { appisola: [40, 90], passeggia: [18, 30], caffe: [20, 40], telefono: [25, 45], sbadiglia: [3, 4], pensa: [4, 7],
    gira_sedia: [3, 3], guarda_orologio: [3, 3], balla: [10, 18], sgranchisce: [16, 26], mangia: [60, 140], chiacchiera: [20, 40] };
  const PESI = { appisola: 0.05, passeggia: 0.16, caffe: 0.13, telefono: 0.12, sbadiglia: 0.07, pensa: 0.08, gira_sedia: 0.05, guarda_orologio: 0.05, balla: 0.05, sgranchisce: 0.14, mangia: 0.10 };
  const VARIANTI = ['digita', 'digita', 'digita', 'digita', 'legge', 'cerca', 'digita', 'pensa'];

  // ---- casualità deterministica ----
  function hash(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function mulberry32(a) { return function () { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }
  const tra = (r, a, b) => a + r() * (b - a);
  function pesato(r, pesi) { const tot = Object.values(pesi).reduce((x, y) => x + y, 0); let v = r() * tot; for (const [k, p] of Object.entries(pesi)) { v -= p; if (v <= 0) return k; } return Object.keys(pesi)[0]; }

  function pesiPer(agente, ora) {
    const p = Object.assign({}, PESI);
    if (agente === CAPO) delete p.telefono;
    if (!CON_CUFFIE.includes(agente)) delete p.balla;
    p.mangia *= (ora >= 12 && ora < 15) || (ora >= 19 && ora < 21) ? 4 : 0.15;
    p.caffe *= (ora >= 8 && ora < 11) || (ora >= 15 && ora < 17) ? 2 : 1;
    p.appisola *= ora >= 14 && ora < 16 ? 2.5 : (ora >= 1 && ora < 6 ? 1.8 : 0.6);
    return p;
  }

  // ---- agenda di un omino per un giorno ----
  function generaAgente(agente, giorno, carico) {
    const r = mulberry32(hash(`${giorno}|${agente}|${Math.round(carico * 100)}`));
    const inizio = giorno * GIORNO, fine = inizio + GIORNO;
    const blocchi = []; let t = inizio; let ultimoPisolino = -Infinity;
    while (t < fine) {
      const lavoro = tra(r, 70, 260) * 1000 * carico;
      blocchi.push({ inizio: t, fine: Math.min(fine, t + lavoro), azione: 'lavora', dati: { variante: VARIANTI[Math.floor(r() * VARIANTI.length)] } });
      t += lavoro; if (t >= fine) break;
      const ora = new Date(t).getHours();
      const pesi = pesiPer(agente, ora);
      if (t - ultimoPisolino < 10 * 60 * 1000) delete pesi.appisola;
      const azione = pesato(r, pesi);
      const durata = tra(r, DURATE[azione][0], DURATE[azione][1]) * 1000;
      const dati = { punto: GIRI[Math.floor(r() * GIRI.length)], cibo: Math.floor(r() * 5), sgabello: Math.floor(r() * 6), reazione: r() };
      if (azione === 'appisola') ultimoPisolino = t;
      blocchi.push({ inizio: t, fine: Math.min(fine, t + durata), azione, dati });
      t += durata;
    }
    return blocchi;
  }

  function taglia(blocchi, inizio, fine, nuovo) {
    // inserisce `nuovo` in [inizio, fine) tagliando solo blocchi di lavoro; ritorna false se lì c'è una pausa
    const i = blocchi.findIndex(b => b.inizio <= inizio && b.fine > inizio);
    if (i < 0) return false;
    const b = blocchi[i];
    if (b.azione !== 'lavora' || b.fine < fine) return false;
    const prima = Object.assign({}, b, { fine: inizio });
    const dopo = Object.assign({}, b, { inizio: fine });
    const ins = [];
    if (prima.fine - prima.inizio > 1000) ins.push(prima);
    ins.push(Object.assign({ inizio, fine }, nuovo));
    if (dopo.fine - dopo.inizio > 1000) ins.push(dopo);
    blocchi.splice(i, 1, ...ins);
    return true;
  }

  function generaGiorno(giorno, carico) {
    const agende = {};
    for (const a of AGENTI) agende[a] = generaAgente(a, giorno, carico[a] || 1);
    // il capo reagisce: schiaffo a chi dorme, sgridata a chi sta al telefono
    for (const a of AGENTI) {
      if (a === CAPO) continue;
      for (const b of agende[a]) {
        if (b.azione === 'appisola' && b.dati.reazione < 0.75) {
          const i0 = b.inizio + 5000 + b.dati.reazione * 5000;
          if (taglia(agende[CAPO], i0, i0 + 9000, { azione: 'schiaffo', dati: { soggetto: a } })) { b.fine = Math.min(b.fine, i0 + 4000); b.interrotto = 'sveglia'; }
        }
        if (b.azione === 'telefono' && b.dati.reazione < 0.6) {
          const i0 = b.inizio + 6000 + b.dati.reazione * 8000;
          if (taglia(agende[CAPO], i0, i0 + 8000, { azione: 'sgrida', dati: { soggetto: a } })) { b.fine = Math.min(b.fine, i0 + 4000); b.interrotto = 'rimprovero'; }
        }
      }
    }
    // chiacchiere: quando uno va al caffè, un collega libero lo raggiunge
    for (const a of AGENTI) {
      for (const b of agende[a]) {
        if (b.azione !== 'caffe' || b.dati.reazione > 0.45) continue;
        const r = mulberry32(hash(`${giorno}|${a}|${b.inizio}|chiacchiera`));
        const altri = AGENTI.filter(x => x !== a); const c = altri[Math.floor(r() * altri.length)];
        if (taglia(agende[c], b.inizio + 3000, b.fine, { azione: 'chiacchiera', dati: { soggetto: a, punto: 'wp_caffe' } })) b.dati.compagno = c;
      }
    }
    // dopo una pausa interrotta o normale, l'omino torna a lavorare: i blocchi seguenti restano lavoro
    for (const a of AGENTI) agende[a].sort((x, y) => x.inizio - y.inizio);
    return agende;
  }

  // ---- stato corrente ----
  let carico = {}; let giornoCorrente = null; let agende = {}; const ultimo = {}; let avviata = false;
  function assicura(t) {
    const g = Math.floor(t / GIORNO);
    if (g !== giornoCorrente) { giornoCorrente = g; agende = generaGiorno(g, carico); }
  }
  function bloccoA(agente, t) { assicura(t); const bl = agende[agente] || []; let lo = 0, hi = bl.length - 1, ris = null; while (lo <= hi) { const m = (lo + hi) >> 1; if (bl[m].inizio <= t) { ris = bl[m]; lo = m + 1; } else hi = m - 1; } return ris; }
  function attuale(agente, t = Date.now()) { const b = bloccoA(agente, t); if (!b) return null; return { agente, azione: b.azione, soggetto: (b.dati && b.dati.soggetto) || (b.dati && b.dati.compagno) || '', dati: b.dati || {}, inizio: b.inizio, fine: b.fine, trascorso: (t - b.inizio) / 1000, rimasto: Math.max(0, (b.fine - t) / 1000), interrotto: b.interrotto || null }; }

  // ---- umore: dipende da cosa è successo prima, dall'ora e dal carico ----
  function umore(agente, t = Date.now()) {
    const b = bloccoA(agente, t); if (!b) return 'sereno';
    const bl = agende[agente] || []; const i = bl.indexOf(b); const prec = i > 0 ? bl[i - 1] : null;
    const ora = new Date(t).getHours(), giornoSett = new Date(t).getDay();
    if (prec && prec.interrotto === 'sveglia' && t - prec.fine < 10 * 60000) return 'irritato';
    if (prec && prec.azione === 'caffe' && t - prec.fine < 15 * 60000) return 'carico';
    if (prec && prec.azione === 'mangia' && t - prec.fine < 20 * 60000) return 'soddisfatto';
    if (b.azione === 'lavora' && t - b.inizio > 200000 && (carico[agente] || 1) > 1.1) return 'stanco';
    if (ora < 7 || ora >= 22) return 'assonnato';
    if (giornoSett === 5 && ora >= 16) return 'allegro';
    return 'sereno';
  }
  // ---- battute: decise dal seme del giorno, uguali su ogni dispositivo ----
  const SITUAZIONI = { lavora: 'lavora', caffe: 'caffe', mangia: 'mangia', telefono: 'telefono', appisola: 'appisola', passeggia: 'passeggia',
    sgranchisce: 'sgranchisce', balla: 'balla', chiacchiera: 'chiacchiera', sgrida: 'sgrida', schiaffo: 'schiaffo', pensa: 'pensa', sbadiglia: 'sbadiglia' };
  function battuta(agente, b, giorno) {
    if (!window.personaggi) return null;
    const r = mulberry32(hash(`${giorno}|${agente}|${b.inizio}|dice`));
    const prob = b.azione === 'lavora' ? 0.22 : (['sgrida', 'schiaffo', 'chiacchiera'].includes(b.azione) ? 1 : 0.55);
    if (r() > prob) return null;
    let sit = SITUAZIONI[b.azione]; if (!sit) return null;
    if (b.azione === 'lavora' && r() < 0.35) sit = 'saluto';
    const collega = (b.dati && (b.dati.soggetto || b.dati.compagno)) || AGENTI.filter(a => a !== agente)[Math.floor(r() * 7)];
    const ctx = { collega, cibo: ['cibo_panino', 'cibo_pizza', 'cibo_mela', 'cibo_tazza', 'cibo_brioche'][(b.dati && b.dati.cibo) || 0], n: 2 + Math.floor(r() * 3) };
    const testo = window.personaggi.frase(agente, sit, umore(agente, b.inizio + 1000), ctx, r());
    if (!testo) return null;
    const aCollega = ['chiacchiera', 'sgrida', 'schiaffo', 'consegna'].includes(sit) || (sit === 'lavora' && r() < 0.3);
    const a = aCollega ? collega : 'luca';
    const risposta = aCollega ? window.personaggi.frase(collega, 'risposta', umore(collega, b.inizio + 1000), { collega: agente }, r()) : null;
    return { testo, a, risposta };
  }
  function emetti(ev) { window.dispatchEvent(new CustomEvent('vita', { detail: Object.assign({ ts: new Date().toISOString(), estetico: true }, ev) })); }
  function tick() {
    const t = Date.now();
    for (const a of AGENTI) {
      const b = attuale(a, t); if (!b) continue;
      const chiave = b.inizio;
      if (ultimo[a] === undefined) { ultimo[a] = chiave; continue; }     // il primo stato lo applica il visualizzatore con attuale()
      if (ultimo[a] === chiave) continue;
      const prec = bloccoA(a, ultimo[a]);
      ultimo[a] = chiave;
      if (b.azione === 'lavora') {
        if (prec && prec.interrotto) emetti({ agente: a, azione: prec.interrotto, soggetto: '', dati: b.dati, fine: b.fine, rimasto: b.rimasto });
        else if (prec && prec.azione !== 'lavora') emetti({ agente: a, azione: 'torna', soggetto: '', dati: b.dati, fine: b.fine, rimasto: b.rimasto });
        else emetti({ agente: a, azione: 'lavora', soggetto: '', dati: b.dati, fine: b.fine, rimasto: b.rimasto, silenzioso: true });
      } else emetti({ agente: a, azione: b.azione, soggetto: b.soggetto, dati: b.dati, fine: b.fine, rimasto: b.rimasto });
      const d = battuta(a, b, giornoCorrente);
      if (d) setTimeout(() => emetti({ agente: a, azione: 'dice', testo: d.testo, a: d.a, risposta: d.risposta, umore: umore(a) }), b.azione === 'lavora' ? 1500 : 6000);
    }
  }

  async function caricaCarico() {
    for (const url of ['./carico.json', '/api/carico']) {
      try { const r = await fetch(url, { cache: 'no-store' }); if (r.ok) { const j = await r.json(); if (j && typeof j === 'object') return j; } } catch (e) { /* prossimo */ }
    }
    return {};
  }
  const pronta = (async () => { carico = await caricaCarico(); assicura(Date.now()); if (!avviata) { avviata = true; setInterval(tick, 1000); } })();

  window.vita = { AGENTI, attuale, pronta, umore, reale() {}, get carico() { return carico; }, FRASI: {
    appisola: 'si è appisolato sulla tastiera', sveglia: 'si sveglia di colpo e riprende a lavorare',
    passeggia: 'si alza e fa due passi', caffe: 'va a prendersi un caffè', torna: 'torna alla scrivania e si rimette al lavoro',
    telefono: 'tira fuori il telefono e scrive a qualcuno', sgrida: 'si alza e sgrida',
    rimprovero: 'mette via il telefono e si rimette a lavorare', va_da: 'si alza e va da',
    sbadiglia: 'si stira e sbadiglia', pensa: 'mano al mento, ci pensa su', gira_sedia: 'fa un giro sulla sedia',
    guarda_orologio: 'guarda l\'orologio', balla: 'balla con le cuffie', applaude: 'applaude', chiacchiera: 'chiacchiera al caffè con',
    sgranchisce: 'si alza per sgranchirsi le gambe', mangia: 'va al tavolo a mangiare qualcosa', schiaffo: 'corre a svegliare con uno schiaffo',
    lavora: 'lavora',
  } };
})();
