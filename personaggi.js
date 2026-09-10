/* Carattere, umore e parlata di ogni dipendente dell'ufficio digitale.
   frase(agente, situazione, umore, contesto, r) ritorna una battuta (r = numero casuale 0-1, deterministico). */
(function () {
  const PERSONALITA = {
    manager:       { nome: 'Manager', tratti: 'decisa, ironica, protettiva con la squadra, allergica alle perdite di tempo', tono: 'asciutto, con battute secche' },
    scout:         { nome: 'Scout', tratti: 'entusiasta, curioso, un po\' impulsivo, vive per la scoperta', tono: 'esclamativo, racconta come un esploratore' },
    ispettore:     { nome: 'Ispettore', tratti: 'pignolo, calmo, ama i dettagli e le liste', tono: 'preciso, quasi da verbale' },
    copywriter:    { nome: 'Copywriter', tratti: 'sensibile, elegante, perfezionista con le parole', tono: 'dolce, con immagini' },
    preventivista: { nome: 'Preventivista', tratti: 'pragmatico, parla per numeri, poco romantico', tono: 'secco, con cifre e percentuali' },
    social:        { nome: 'Social', tratti: 'giovane, sempre di buon umore, cuffie in testa, parla veloce', tono: 'colloquiale, "raga", "top"' },
    collaudatore:  { nome: 'Collaudatore', tratti: 'nerd tranquillo, diffidente per mestiere, cerca il difetto', tono: 'tecnico, mezze frasi' },
    segretaria:    { nome: 'Segretaria', tratti: 'organizzata, gentile, memoria di ferro, un filo materna', tono: 'cortese, rassicurante' },
  };

  // frasi per situazione: {generico: [...], <agente>: [...]}. {luca} = Luca, {c} = collega, {cibo}, {n} = numero
  const FRASI = {
    saluto: {
      generico: ['Ciao {luca}, tutto sotto controllo qui.', 'Ehi {luca}, passa quando vuoi.', 'Buon lavoro {luca}!'],
      manager: ['{luca}, qui comando io ma il caffè lo pago tu.', 'Ho rilette tutte le mail, {luca}: zero sviste. Prego.', 'Squadra in riga, {luca}. Quasi.'],
      scout: ['{luca}! Ho fiutato tre attività nuove stamattina!', 'La mappa oggi profuma di clienti, {luca}.', 'Dammi una città e ti porto un cliente, {luca}.'],
      ispettore: ['Buongiorno {luca}. Scheda 4: copyright fermo al 2019, nota mia.', 'Ho controllato tutto due volte, {luca}. Come sempre.', '{luca}, dettaglio: il sito di ieri non ha il lucchetto.'],
      copywriter: ['Ciao {luca}, oggi le parole scivolano bene.', 'Ho scritto una mail che sembra una lettera vera, {luca}.', '{luca}, la bozza nuova ha il tuo tono, ci ho messo il cuore.'],
      preventivista: ['{luca}: 1.500 a listino, 1.200 abituale. Lo so, lo so.', 'Totale, IVA, acconto. Fatto, {luca}.', 'Un preventivo pronto, margine ok.'],
      social: ['Raga, che giornata! Ciao {luca}!', '{luca}, ho tre post che spaccano.', 'Top vibes oggi in ufficio, {luca}.'],
      collaudatore: ['{luca}, lucsal.it risponde in 300 ms. Bene.', 'Nessun link rotto stanotte. Sospetto.', 'Test ok. Per ora.'],
      segretaria: ['Buongiorno {luca}, la posta è in ordine.', '{luca}, ti ho segnato tutto, non ti preoccupare.', 'Ciao {luca}, ricordati il giovedì.'],
    },
    lavora: {
      generico: ['Concentrazione massima.', 'Ancora due righe e ho finito.', 'Oggi si lavora sodo.'],
      manager: ['Rileggo, correggo, sorrido. Routine.', 'Se una mail esce sbagliata è colpa mia. Quindi non esce.', 'Silenzio, sto pensando per tutti.'],
      scout: ['Bergamo, Brescia, Verona... chi ha il sito più vecchio?', 'Trovata! Anzi no. Anzi sì!', 'La mappa non mente mai.'],
      ispettore: ['Punto uno. Punto due. Punto tre.', 'Manca il viewport. Segno.', 'Leggo il sito riga per riga, come si deve.'],
      copywriter: ['"Salve, mi chiamo Luca Salvemini"... e poi la magia.', 'Questa frase va accarezzata, non spinta.', 'Niente parole inglesi. Mai.'],
      preventivista: ['Due pagine extra: più 300. Semplice.', 'Il modello sbaglia le somme, io no.', 'Acconto 30 per cento, come sempre.'],
      social: ['Post, hashtag, boom.', 'Raga questa caption è oro.', 'Cinque hashtag, non uno di più.'],
      collaudatore: ['Se non lo testo, non esiste.', 'Immagini senza alt: quattro. Noto.', 'Lighthouse dice 98. Non mi fido.'],
      segretaria: ['Risposta letta, replica pronta, {luca} approva.', 'Tutto in ordine, tutto segnato.', 'Interessato: ne parlo con {luca}.'],
    },
    finito: { generico: ['Finito!', 'Fatto, e fatto bene.'], scout: ['Preda consegnata!'], ispettore: ['Verbale chiuso.'], copywriter: ['La mail è pronta, {luca}: leggila con calma.'], preventivista: ['Preventivo chiuso. Numeri veri.'], social: ['Post pronti, raga!'], collaudatore: ['Test superato. Stavolta.'], segretaria: ['Replica pronta, {luca}.'], manager: ['Riletto. Va bene così.'] },
    caffe: {
      generico: ['Senza caffè non si ragiona.', 'Pausa caffè, sacra.', 'Un caffè e riparto.'],
      manager: ['Il caffè del capo non si tocca.', 'Doppio. Oggi doppio.'], scout: ['Caffè e poi si torna a caccia!'], ispettore: ['Caffè: 25 ml, temperatura giusta. Approvato.'],
      copywriter: ['Il caffè è la punteggiatura della giornata.'], preventivista: ['Un caffè: 1,20. Lo metto in nota spese.'], social: ['Raga, caffè e reel.'],
      collaudatore: ['La macchina del caffè è l\'unica cosa che non testo.'], segretaria: ['Un caffè per me e uno per chi lo chiede.'],
    },
    mangia: {
      generico: ['Che fame.', 'Pausa pranzo, finalmente.', 'Mangio e torno.'],
      manager: ['{cibo}. Poi si torna a lavorare, eh.'], scout: ['{cibo}! Trovato pure questo!'], ispettore: ['{cibo}: ingredienti verificati.'],
      copywriter: ['Un {cibo} e un pensiero gentile.'], preventivista: ['{cibo}: costo zero, il migliore.'], social: ['{cibo} time, raga.'],
      collaudatore: ['Test del {cibo}: passato.'], segretaria: ['Ho preso un {cibo} anche per chi non ha mangiato.'],
    },
    telefono: { generico: ['Un messaggio veloce...', 'Solo un attimo, giuro.'], scout: ['Guardo se hanno risposto... sul telefono, eh.'], social: ['Raga, una storia al volo.'], collaudatore: ['Controllo una cosa. Sul telefono. Personale.'], copywriter: ['Rispondo a mia madre e torno.'], preventivista: ['Il conto della cena di ieri. Due minuti.'], segretaria: ['La farmacia per mia nonna, scusate.'], ispettore: ['Verifico un orario. Sul telefono.'] },
    sgrida: { generico: ['{c}! Il telefono! Al lavoro!', 'Ehi {c}, le mail non si scrivono da sole.'], manager: ['{c}, quel telefono lo vedo anche da qui.', 'Al lavoro, {c}. Il TikTok può aspettare.'] },
    rimprovero: { generico: ['Scusa capo, torno subito.', 'Era una cosa urgente. Quasi.'], social: ['Raga, beccato.'], scout: ['Stavo cercando clienti! Sul telefono!'], collaudatore: ['Stavo testando... il telefono.'], copywriter: ['Perdonami, mi sono persa un attimo.'], preventivista: ['Due minuti, non li fatturo.'], segretaria: ['Hai ragione, hai ragione.'], ispettore: ['Annotato. Non si ripeterà.'] },
    appisola: { generico: ['Solo cinque minuti...', 'Chiudo un attimo gli occhi...'], collaudatore: ['I test girano da soli... zzz'], scout: ['La mappa... si è fatta scura...'], preventivista: ['Somma... riporto... zzz'] },
    schiaffo: { generico: ['{c}! Sveglia!', 'In piedi, {c}!'], manager: ['{c}, la sveglia è servita.', 'Dormi a casa, {c}!'] },
    sveglia: { generico: ['Ahia! Sono sveglio!', 'Non dormivo, pensavo!'], collaudatore: ['Ahia. Bug nel sonno.'], scout: ['Trovato! Cosa? Dov\'ero?'], social: ['Raga, che schiaffo.'], copywriter: ['Stavo sognando una frase perfetta...'], preventivista: ['Ok ok, sveglio. Costo: una guancia.'], segretaria: ['Scusa, la notte sono stata sveglia.'], ispettore: ['Registrato: sveglia forzata.'] },
    chiacchiera: {
      generico: ['{c}, ma l\'hai visto quel sito?', 'Senti {c}, oggi il capo è in forma.', '{c}, a pranzo dove si va?'],
      manager: ['{c}, te lo dico da capo: bel lavoro. Non abituarti.'], scout: ['{c}, oggi ho trovato una latteria che è una miniera!'], ispettore: ['{c}, quel sito aveva il viewport... incredibile.'],
      copywriter: ['{c}, ti leggo una frase e mi dici se scorre?'], preventivista: ['{c}, secondo te 1.200 è poco?'], social: ['Raga {c}, quel reel farebbe numeri.'],
      collaudatore: ['{c}, ho trovato un link rotto sul sito di un competitor. Godo.'], segretaria: ['{c}, hai mangiato? No perché ho una brioche.'],
    },
    risposta: { generico: ['Eh, lo so.', 'Vero, verissimo.', 'Ma dai!', 'Poi mi racconti.', 'Sì sì, poi ci penso.'], manager: ['Al lavoro, che è meglio.'], social: ['Top.'], collaudatore: ['Mh. Da verificare.'], ispettore: ['Prendo nota.'], preventivista: ['Quanto costa?'], copywriter: ['Che bello.'], scout: ['Andiamo a vedere!'], segretaria: ['Te lo segno.'] },
    passeggia: { generico: ['Due passi e torno.', 'Mi sgranchisco.'], scout: ['Esploro l\'ufficio, non si sa mai.'], collaudatore: ['Test di camminata.'], social: ['Giretto.'], manager: ['Giro di controllo.'] },
    sgranchisce: { generico: ['Che schiena.', 'Ahh, ci voleva.'], ispettore: ['Stiramento: eseguito.'], preventivista: ['Schiena: da preventivare.'] },
    balla: { generico: ['Questa canzone!'], social: ['Raga questa è una bomba!'], collaudatore: ['Il beat passa il test.'] },
    arrabbiato: { generico: ['Ma quanto ci vuole?!', 'C\'è una fila, eh!', 'Uffa!'], manager: ['Io sono il capo e sono in coda. Assurdo.'], preventivista: ['Tempo perso: non fatturabile.'], social: ['Raga, muovetevi!'], collaudatore: ['Coda. Bug di sistema.'], segretaria: ['Con calma eh, però...'], ispettore: ['Tre minuti e dodici secondi di attesa. Annotato.'] },
    trovato: { generico: ['Trovato!'], scout: ['{luca}, ho trovato una perla: {n} spunti!', 'Eccola! Sito da rifare, ci scommetto!'] },
    consegna: { generico: ['{c}, tocca a te.', 'Ecco il foglio, {c}.'], scout: ['{c}, guarda che roba ho trovato!'], ispettore: ['{c}, scheda completa, tre punti.'], copywriter: ['{c}, dai un occhio alla mia mail, per favore.'] },
    festeggia: { generico: ['Sì! Approvata!', 'Grande {luca}!'], copywriter: ['{luca} ha approvato la mail! Che gioia.'], segretaria: ['Replica approvata, la mando subito.'] },
    errore: { generico: ['Mmm, qualcosa non torna.', 'Riprovo.'], collaudatore: ['Errore. Finalmente qualcosa di interessante.'], preventivista: ['Errore: costo zero, per fortuna.'] },
    pensa: { generico: ['Idea!', 'Aspetta... sì!'], copywriter: ['Ecco la frase giusta.'], scout: ['E se cercassi a Cremona?'] },
    sbadiglia: { generico: ['Che sonno.', 'Uaaah.'] },
  };
  const UMORE = {
    sereno: { prefisso: [], suffisso: [] },
    carico: { prefisso: ['Carico!', 'Dai dai dai.'], suffisso: ['Andiamo!'] },
    stanco: { prefisso: ['Uff...', 'Che giornata...'], suffisso: ['...poi mi fermo.'] },
    soddisfatto: { prefisso: ['Ah, che bello.'], suffisso: ['Si sta bene qui.'] },
    irritato: { prefisso: ['Ma insomma.', 'Bah.'], suffisso: ['Comunque.'] },
    allegro: { prefisso: ['Che venerdì!'], suffisso: ['Quasi weekend!'] },
    assonnato: { prefisso: ['Sbadiglio...'], suffisso: ['...a quest\'ora.'] },
    arrabbiato: { prefisso: ['Uffa!'], suffisso: ['!'] },
  };
  const NOMI = { manager: 'Manager', scout: 'Scout', ispettore: 'Ispettore', copywriter: 'Copywriter', preventivista: 'Preventivista', social: 'Social', collaudatore: 'Collaudatore', segretaria: 'Segretaria' };
  const CIBI_NOMI = { cibo_panino: 'panino', cibo_pizza: 'pizza', cibo_mela: 'mela', cibo_tazza: 'tazza di tè', cibo_brioche: 'brioche' };

  function scegli(lista, r) { return lista[Math.floor(r * lista.length) % lista.length]; }
  function frase(agente, situazione, umore, ctx, r) {
    const banco = FRASI[situazione]; if (!banco) return '';
    const mie = banco[agente] || []; const gen = banco.generico || [];
    const lista = mie.length && r < 0.7 ? mie : (gen.length ? gen : mie); if (!lista.length) return '';
    let t = scegli(lista, (r * 7.31) % 1);
    t = t.replace('{luca}', 'Luca').replace('{c}', NOMI[ctx.collega] || ctx.collega || 'collega').replace('{cibo}', CIBI_NOMI[ctx.cibo] || 'panino').replace('{n}', ctx.n || 2);
    const u = UMORE[umore] || UMORE.sereno; const r2 = (r * 13.7) % 1;
    if (u.prefisso.length && r2 < 0.3) t = scegli(u.prefisso, r2 * 3) + ' ' + t;
    else if (u.suffisso.length && r2 > 0.8) t = t + ' ' + scegli(u.suffisso, r2 * 5);
    return t;
  }
  window.personaggi = { PERSONALITA, FRASI, UMORE, NOMI, frase };
})();
