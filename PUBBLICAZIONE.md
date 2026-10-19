# Pubblicazione di Ufficio D’Avolio

Il sito statico è destinato a **https://davoliomarmi-a11y.github.io/ufficio-davolio/**.
I sorgenti restano nel ramo `main`; il ramo `gh-pages` contiene solo i file da servire.
Questa pubblicazione usa GitHub Pages e non richiede API applicative, server o dipendenze Node.

## Preparare i file

Dalla cartella del repository, con Python 3 installato:

```sh
python3 scripts/package-extension.py
python3 scripts/build-pages.py
```

Il primo comando aggiorna lo ZIP dell’estensione Chrome dai suoi sorgenti. Il secondo
prepara `out/pages/`, già esclusa da Git. Si può ripetere: sovrascrive soltanto i file
generati che riconosce. Se la cartella contiene elementi sconosciuti, si interrompe
senza cancellarli. Non copiare altri file dentro questa cartella.

La confezione include la pagina iniziale, gli script e lo stile usati nel browser,
logo, favicon, collegamento Windows, estensione Chrome, `.nojekyll` e una pagina 404.
Non include il vecchio rapporto della giornata, mappe dei sorgenti, test, dipendenze,
credenziali o archivi del progetto. Il file `.ufficio-pages-generated` è un marcatore
locale per riconoscere l’output e non è necessario per il sito.

Per controllare la pagina in locale:

```sh
python3 -m http.server 8000 --bind 127.0.0.1 --directory out/pages
```

Aprire `http://127.0.0.1:8000/`. Questo comando serve solo l’anteprima locale.

## Aggiornare GitHub Pages

Il ramo `gh-pages` è già caricato. L’attivazione automatica del servizio è stata
rifiutata da GitHub con `Resource not accessible by integration` (HTTP 403):
l’accesso di questa chat consente il push dei file, ma non l’abilitazione di Pages.
Per la prima attivazione il titolare può aprire direttamente
https://github.com/davoliomarmi-a11y/ufficio-davolio/settings/pages e impostare
**Deploy from a branch**, **gh-pages**, **/ (root)**, quindi **Save**.
Non serve condividere password o token nella chat. Dopo il salvataggio GitHub
esegue la prima pubblicazione; il sito non va dichiarato attivo finché non è verificato.

1. Salvare i sorgenti aggiornati nel ramo `main` e rigenerare i file.
2. Pubblicare **solo il contenuto di `out/pages/`** nel ramo `gh-pages`, alla radice
   del ramo; non pubblicare l’intero checkout né la cartella `out` come sottocartella.
   Il marcatore locale può essere escluso.
   Il comando preparato per questo passaggio è `python3 scripts/publish-pages.py`:
   usa un indice Git temporaneo, conserva il checkout corrente e pubblica senza
   push forzati. Se i file sono già identici a quelli sul ramo remoto, non crea
   un nuovo commit. Non crea un checkout o un worktree aggiuntivo.
3. In GitHub, aprire **Settings → Pages**, scegliere **Deploy from a branch**,
   ramo **gh-pages**, cartella **/ (root)** e salvare.
4. Attendere il completamento della pubblicazione e aprire l’indirizzo indicato sopra.
   Controllare logo, colori, collegamenti e download dell’estensione.

Gli aggiornamenti successivi richiedono un nuovo commit dei file generati su
`gh-pages`. Un commit dei soli sorgenti su `main` non aggiorna il sito.
Non occorre aggiungere un workflow di build nel repository per questa modalità.

## Accessi e dati dell’ufficio

**La pagina GitHub Pages è pubblica.** Non eredita l’accesso riservato o le sessioni
del precedente sito ChatGPT Sites. Non inserire nel suo HTML rapporti personali,
email, appuntamenti o dati degli ordini. I collegamenti a Gmail, laboratorio,
ChatGPT e Fatture in Cloud richiedono gli accessi previsti da ciascuno di quei siti;
questa pagina non fornisce né trasferisce credenziali.

La lettura delle schede richiede Google Chrome e l’estensione locale installata.
L’estensione legge in sola lettura il DOM delle liste già caricate nelle schede
supportate. I dati letti di email e ordini passano alla memoria della scrivania
aperta nello stesso browser e non vengono inviati a GitHub o a servizi esterni.
Ricaricando la pagina, i dati letti scompaiono. Per vedere novità, aggiornare prima
le pagine di posta e laboratorio e poi premere **Leggi posta e lavori**.

Non basta pubblicare il sito per installare l’estensione sui PC dell’ufficio.
Dopo un aggiornamento dell’estensione, sostituire i suoi file e premere
**Ricarica** in `chrome://extensions`, quindi ricaricare le schede interessate.
L’integrazione in sola lettura dei dati di Fatture in Cloud resta un passo successivo.
