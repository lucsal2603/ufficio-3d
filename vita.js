/* Vita d'ufficio: comportamenti solo estetici degli omini (pisolini, giri, caffè, telefono, sgridate).
   Non toccano il lavoro vero: gli eventi reali arrivano dal server e hanno sempre la precedenza.
   Lo stesso motore piloterà le clip dell'ufficio 3D: ogni evento qui emesso ha un'azione del vocabolario
   AZIONI_VITA (vedi ufficio/azioni.py). */
(function () {
  const AGENTI = ['manager', 'scout', 'ispettore', 'copywriter', 'preventivista', 'social', 'collaudatore', 'segretaria'];
  const CON_CUFFIE = ['social', 'collaudatore'];
  const CAPO = 'manager';
  const DURATE = { appisola: [8, 20], passeggia: [10, 20], caffe: [15, 30], telefono: [12, 25], va_da: [8, 8], sgrida: [6, 6],
    sbadiglia: [3, 4], pensa: [4, 6], gira_sedia: [3, 3], guarda_orologio: [3, 3], balla: [8, 15], applaude: [3, 4], chiacchiera: [15, 30],
    sgranchisce: [14, 20], mangia: [30, 50] };
  const PESI = { appisola: 0.04, passeggia: 0.16, caffe: 0.12, telefono: 0.12, sbadiglia: 0.06, pensa: 0.08, gira_sedia: 0.05, guarda_orologio: 0.05, balla: 0.04, sgranchisce: 0.14, mangia: 0.10 };
  const PAUSA_PISOLINO = 10 * 60 * 1000;   // al massimo un pisolino ogni dieci minuti per omino
  const stato = {};
  const rand = (a, b) => a + Math.random() * (b - a);
  const ms = ([a, b]) => rand(a, b) * 1000;
  const RAPIDA = !!window.VITA_RAPIDA;
  AGENTI.forEach(a => { stato[a] = { fase: 'lavora', fino: 0, ultimoReale: 0, prossimo: Date.now() + (RAPIDA ? rand(4, 30) : rand(25, 80)) * 1000, sgridata: 0 }; });

  function emetti(agente, azione, soggetto) {
    const d = new Date(); const ts = new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 19);
    const ev = { ts, agente, azione, soggetto: soggetto || '', dettaglio: '', estetico: true };
    window.dispatchEvent(new CustomEvent('vita', { detail: ev }));
  }
  function inizia(agente, fase, soggetto) {
    const s = stato[agente];
    s.fase = fase; s.fino = Date.now() + ms(DURATE[fase]); s.sgridata = 0;
    if (fase === 'appisola') s.ultimoPisolino = Date.now();
    emetti(agente, fase, soggetto);
    if (fase === 'telefono' && Math.random() < 0.6) s.sgridata = Date.now() + rand(5, 10) * 1000;
    if (fase === 'caffe' && Math.random() < 0.45) {
      const liberi = AGENTI.filter(a => a !== agente && stato[a].fase === 'lavora');
      if (liberi.length) { const b = liberi[Math.floor(Math.random() * liberi.length)]; const sb = stato[b];
        sb.fase = 'chiacchiera'; sb.fino = s.fino; emetti(b, 'chiacchiera', agente); }
    }
  }
  function torna(agente) {
    const s = stato[agente];
    if (s.fase === 'appisola') emetti(agente, 'sveglia');
    else if (s.fase !== 'lavora') emetti(agente, 'torna');
    s.fase = 'lavora'; s.fino = 0; s.sgridata = 0;
    s.prossimo = Date.now() + (RAPIDA ? rand(15, 60) : rand(40, 120)) * 1000;
  }
  function scegli(agente) {
    const pesi = Object.assign({}, PESI);
    if (agente === CAPO) delete pesi.telefono;
    if (!CON_CUFFIE.includes(agente)) delete pesi.balla;
    if (Date.now() - (stato[agente].ultimoPisolino || 0) < PAUSA_PISOLINO) delete pesi.appisola;
    let r = Math.random() * Object.values(pesi).reduce((x, y) => x + y, 0);
    for (const [k, p] of Object.entries(pesi)) { r -= p; if (r <= 0) return k; }
    return 'appisola';
  }
  function tick() {
    const now = Date.now();
    for (const a of AGENTI) {
      const s = stato[a];
      if (s.fase === 'telefono' && s.sgridata && now >= s.sgridata) {
        s.sgridata = 0;
        const capo = stato[CAPO];
        if (capo.fase === 'lavora' || capo.fase === 'passeggia') {
          capo.fase = 'sgrida'; capo.fino = now + ms(DURATE.sgrida);
          emetti(CAPO, 'sgrida', a);
          s.fase = 'rimprovero'; s.fino = now + 2000;
          emetti(a, 'rimprovero');
        }
        continue;
      }
      if (s.fase !== 'lavora' && now >= s.fino) { torna(a); continue; }
      if (s.fase === 'lavora' && now >= s.prossimo && now - s.ultimoReale > 20000) inizia(a, scegli(a));
    }
  }
  function reale(ev) {
    const s = stato[ev.agente];
    if (!s) return;
    s.ultimoReale = Date.now();
    if (s.fase !== 'lavora') torna(ev.agente);
    let bersaglio = AGENTI.includes(ev.soggetto) ? ev.soggetto : null;
    const m = /a (\w+):/.exec(ev.dettaglio || '');
    if (!bersaglio && m && AGENTI.includes(m[1])) bersaglio = m[1];
    if (bersaglio && bersaglio !== ev.agente && (ev.azione === 'consegna' || ev.azione === 'parla')) {
      if (stato[bersaglio].fase === 'appisola') torna(bersaglio);
      s.fase = 'va_da'; s.fino = Date.now() + ms(DURATE.va_da);
      emetti(ev.agente, 'va_da', bersaglio);
    }
    if (ev.azione === 'festeggia') {
      AGENTI.filter(a => a !== ev.agente && stato[a].fase === 'lavora').sort(() => Math.random() - 0.5).slice(0, 2)
        .forEach(a => { stato[a].fase = 'applaude'; stato[a].fino = Date.now() + ms(DURATE.applaude); emetti(a, 'applaude', ev.agente); });
    }
    if (ev.azione === 'aspetta' || ev.azione === 'finito') s.prossimo = Date.now() + rand(10, 40) * 1000;
    else s.prossimo = Date.now() + rand(40, 120) * 1000;
  }
  setInterval(tick, 1000);
  window.vita = { reale, stato, FRASI: {
    appisola: 'si è appisolato sulla tastiera', sveglia: 'si sveglia di colpo e riprende a lavorare',
    passeggia: 'si alza e fa due passi', caffe: 'va a prendersi un caffè', torna: 'torna alla scrivania',
    telefono: 'tira fuori il telefono e scrive a qualcuno', sgrida: 'si alza e sgrida',
    rimprovero: 'mette via il telefono e si rimette a lavorare', va_da: 'si alza e va da',
    sbadiglia: 'si stira e sbadiglia', pensa: 'mano al mento, ci pensa su', gira_sedia: 'fa un giro sulla sedia',
    guarda_orologio: 'guarda l\'orologio', balla: 'balla con le cuffie', applaude: 'applaude', chiacchiera: 'chiacchiera al caffè con',
    sgranchisce: 'si alza per sgranchirsi le gambe', mangia: 'va al tavolo a mangiare qualcosa',
  } };
})();
