# Feature Specification: play-go MVP — imparare e giocare a Go

**Feature Branch**: `001-go-mvp`

**Created**: 2026-06-29

**Status**: Draft

**Input**: User description: "Sito per imparare e giocare a Go con parte didattica
interattiva, gioco contro il computer e contro altri utenti, registrazione
nome+password, memoria dei moduli didattici completati, hosting su Raspberry Pi 3,
esposto su go.tongatron.org."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Registrazione e gioco contro il computer (Priority: P1)

Un visitatore crea un account con nome utente e password, accede, e gioca una
partita di Go 9×9 (o 13×13) contro l'avversario computer, potendo scegliere un
livello di difficoltà. Al termine vede il risultato (chi vince e con quale
scarto) e può salvare/rivedere la partita.

**Why this priority**: È il nucleo giocabile del prodotto e l'unica parte che da
sola giustifica l'esistenza del sito. Dimostra il motore di regole, lo scoring e
l'integrazione con GNU Go — i pezzi tecnicamente più rischiosi.

**Independent Test**: Registrarsi, avviare una partita 9×9 contro il computer,
giocare fino a fine partita (due pass), verificare conteggio area corretto e
risultato mostrato. Testabile end-to-end senza le altre user story.

**Acceptance Scenarios**:

1. **Given** un visitatore non registrato, **When** inserisce un nome utente libero
   e una password valida, **Then** l'account è creato, l'utente è autenticato e la
   password è memorizzata solo come hash.
2. **Given** un nome utente già esistente, **When** si tenta la registrazione,
   **Then** il sistema rifiuta con messaggio chiaro e non crea duplicati.
3. **Given** un utente autenticato, **When** avvia una partita 9×9 contro il
   computer a difficoltà scelta, **Then** la goban è mostrata e l'utente può posare
   una pietra in un'intersezione legale.
4. **Given** una mossa illegale (suicidio o violazione di ko), **When** l'utente
   tenta di giocarla, **Then** il sistema la rifiuta e spiega il motivo.
5. **Given** una posizione in cui una mossa cattura pietre avversarie, **When**
   l'utente gioca, **Then** le pietre senza libertà sono rimosse correttamente.
6. **Given** entrambi i giocatori passano, **When** la partita finisce, **Then** il
   sistema avvia la fase di marcatura pietre morte e poi mostra il punteggio ad area
   (cinese) con komi applicato e il vincitore.
7. **Given** una partita conclusa, **When** l'utente la salva, **Then** può
   riaprirla e rivederla mossa per mossa (replay).

---

### User Story 2 - Percorso didattico con memoria dei moduli (Priority: P2)

Un utente segue moduli didattici (lezioni con goban interattiva ed esercizi di tipo
tsumego). Il sistema valida le risposte sull'esercizio, segna i moduli completati e
li ricorda tra le sessioni, sbloccando i moduli successivi secondo i prerequisiti.

**Why this priority**: È il "imparare" del titolo e il driver di ritorno
dell'utente, ma poggia sul motore di regole della Story 1 (validazione mosse).

**Independent Test**: Da utente autenticato, aprire il primo modulo, completare il
suo esercizio, verificare che risulti "completato" dopo logout/login e che il modulo
successivo si sblocchi.

**Acceptance Scenarios**:

1. **Given** un utente autenticato senza progressi, **When** apre l'elenco moduli,
   **Then** vede il primo modulo disponibile e i successivi bloccati dai prerequisiti.
2. **Given** un esercizio tsumego, **When** l'utente gioca la sequenza corretta,
   **Then** l'esercizio è validato come risolto e il modulo è marcato completato.
3. **Given** un modulo completato, **When** l'utente torna dopo un nuovo login,
   **Then** il completamento è ancora registrato e i moduli sbloccati restano tali.
4. **Given** una soluzione errata a un esercizio, **When** l'utente la gioca,
   **Then** riceve feedback e può ritentare senza che il modulo risulti completato.

---

### User Story 3 - Partita asincrona contro un altro utente (Priority: P3)

Due utenti registrati giocano una partita di Go a turni (correspondence): uno crea
una sfida, l'altro la accetta, ciascuno gioca quando vuole; il sistema mostra di chi
è il turno e notifica gli aggiornamenti. La partita arriva a conteggio o resa.

**Why this priority**: Completa la terna richiesta (vs computer / vs utenti) ma è la
più complessa per gestione stato/turni e la meno critica per un primo lancio.

**Independent Test**: Con due account, creare una sfida, accettarla da un secondo
account, alternare alcune mosse rispettando i turni, arrivare a fine partita e
verificare il risultato per entrambi.

**Acceptance Scenarios**:

1. **Given** un utente autenticato, **When** crea una sfida (dimensione board, colore,
   komi), **Then** la sfida è visibile/accettabile da un altro utente.
2. **Given** una sfida aperta, **When** un secondo utente l'accetta, **Then** la
   partita inizia e il sistema indica di chi è il turno.
3. **Given** una partita in corso, **When** non è il turno dell'utente, **Then** il
   sistema impedisce di muovere fino al proprio turno.
4. **Given** una mossa giocata dall'avversario, **When** l'utente torna sulla partita,
   **Then** vede la posizione aggiornata e una notifica che è il suo turno.
5. **Given** una partita, **When** un giocatore si arrende, **Then** la partita
   termina e l'altro è dichiarato vincitore.

---

### Edge Cases

- **Ko / superko**: posizione ripetuta — la mossa che la ricreerebbe è vietata.
- **Disaccordo sulle pietre morte** a fine partita: cosa succede se i due giocatori
  non concordano? (ipotesi MVP: si torna a giocare finché non si raggiunge accordo).
- **Doppio pass** vs **resign** vs **abbandono** (utente che non muove più in una
  partita async): definire timeout/stato "abbandonata".
- **Sessione scaduta** durante una partita contro il computer: la partita va
  ripristinata al rientro.
- **GNU Go non disponibile/crash** sul Pi: la partita vs computer deve degradare con
  errore gestito, non bloccare l'app.
- **Concorrenza**: due richieste di mossa simultanee sulla stessa partita async.
- **Nome utente** con caratteri speciali/spazi o troppo lungo.
- **Carico**: più partite vs computer simultanee che saturano la CPU del Pi3.

## Requirements *(mandatory)*

### Functional Requirements

**Account & sessione**
- **FR-001**: Il sistema MUST permettere la registrazione con nome utente univoco e
  password, senza email.
- **FR-002**: Il sistema MUST memorizzare le password solo come hash forte (argon2/bcrypt).
- **FR-003**: Il sistema MUST autenticare gli utenti e mantenere la sessione via
  cookie firmato.
- **FR-004**: Il sistema MUST informare l'utente, in fase di registrazione, che senza
  email non è previsto recupero password.

**Motore di gioco (regole)**
- **FR-005**: Il sistema MUST applicare le regole del Go: turni alternati, cattura per
  assenza di libertà, divieto di suicidio, divieto di ripetizione (ko/superko
  posizionale), pass e resign.
- **FR-006**: Il sistema MUST supportare board 9×9 e 13×13 con komi configurabile.
- **FR-007**: Il sistema MUST rifiutare le mosse illegali spiegandone il motivo.
- **FR-008**: Il sistema MUST calcolare il punteggio ad **area (regole cinesi)** dopo
  marcatura/rimozione delle pietre morte confermata dai giocatori.
- **FR-009**: Il sistema MUST consentire export/import della partita in formato **SGF**
  e il replay mossa per mossa.

**Gioco vs computer**
- **FR-010**: Il sistema MUST far giocare l'utente contro un avversario computer basato
  su **GNU Go** (via GTP).
- **FR-011**: Il sistema MUST offrire livelli di difficoltà selezionabili.
- **FR-012**: Il sistema MUST limitare il tempo/risorse per mossa del computer per non
  saturare il Pi3 e gestire l'indisponibilità del motore senza crash dell'app.

**Didattica**
- **FR-013**: Il sistema MUST presentare moduli didattici (lezioni + esercizi tsumego
  interattivi) con prerequisiti tra moduli.
- **FR-014**: Il sistema MUST validare la soluzione degli esercizi usando il motore di
  regole e dare feedback su tentativi errati.
- **FR-015**: Il sistema MUST registrare per ogni utente i moduli completati e
  persisterli tra le sessioni.
- **FR-016**: Il sistema MUST sbloccare i moduli successivi al soddisfacimento dei
  prerequisiti.

**Multiplayer asincrono**
- **FR-017**: Il sistema MUST permettere di creare e accettare sfide tra utenti
  (dimensione, colore, komi).
- **FR-018**: Il sistema MUST gestire partite a turni, impedendo mosse fuori turno e
  mostrando di chi è il turno.
- **FR-019**: Il sistema MUST notificare l'utente quando è il suo turno.
- **FR-020**: Il sistema MUST gestire resa e definire lo stato di partita abbandonata
  dopo **14 giorni** di inattività del giocatore di turno.

**Persistenza & deploy**
- **FR-021**: Il sistema MUST persistere utenti, partite e progressi in SQLite.
- **FR-022**: Il sistema MUST girare come servizio su Raspberry Pi 3 ed essere esposto
  su `go.tongatron.org` via tunnel Cloudflare.

### Key Entities

- **User**: identità di gioco — nome utente univoco, hash password, data creazione.
- **Game**: una partita — dimensione board, komi, tipo (vs-computer | async-pvp),
  giocatori (o difficoltà AI), sequenza mosse, stato (in corso | scoring |
  conclusa | abbandonata), risultato.
- **Move**: una mossa nella sequenza di una Game (posizione o pass/resign, colore, ordine).
- **Module**: unità didattica — titolo, contenuto lezione, esercizio/i, prerequisiti.
- **ModuleProgress**: relazione User↔Module — stato completamento, data.
- **Challenge**: sfida aperta per il multiplayer async prima dell'accettazione.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Un nuovo utente completa registrazione e prima mossa contro il computer
  in meno di 2 minuti.
- **SC-002**: Il motore di regole supera il 100% di una suite di casi di test su
  cattura, ko, suicidio e scoring ad area.
- **SC-003**: Su Pi3, il computer (GNU Go) risponde a una mossa su 9×9 entro un tempo
  configurato (target ≤ ~5 s a difficoltà media) senza esaurire la RAM.
- **SC-004**: Un utente che completa un modulo lo ritrova "completato" dopo
  logout/login nel 100% dei casi.
- **SC-005**: Due utenti completano una partita async fino al conteggio rispettando i
  turni, con risultato coerente mostrato a entrambi.
- **SC-006**: L'app resta stabile (nessun crash del service) durante almeno **3 partite
  vs computer simultanee** sul Pi3.

## Assumptions

- Utenza ridotta (uso personale/amici), non migliaia di utenti concorrenti: il Pi3
  basta per il carico previsto.
- I contenuti didattici iniziali sono bozze in italiano scritte dal team e poi
  revisionate; non serve un editor di contenuti nell'MVP (i moduli possono essere
  definiti come dati/file).
- L'utente accede da browser moderno (desktop o mobile); l'app è mobile-first PWA.
- GNU Go è installabile su Raspbian trixie armv7l (da verificare in fase di plan);
  in caso contrario si valuta un fallback equivalente leggero.
- Scoring ad area (cinese) è la regola adottata; il conteggio territorio (giapponese)
  è fuori scope MVP.
- Lo scoring delle pietre morte richiede accordo dei due giocatori; non è previsto un
  rilevamento automatico delle pietre morte nell'MVP.
- L'analytics aggregato (`analytics.js`, GA4 Consent Mode) è riusato come per le altre
  app del dominio.
