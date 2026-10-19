(() => {
  'use strict';
  if (window.top !== window) return;
  chrome.runtime.onMessage.addListener((message, sender, respond) => {
    if (sender.id !== chrome.runtime.id || message?.type !== 'DAVOLIO_READ_VISIBLE_DOCUMENT') return;
    try {
      if (location.origin === 'https://mail.google.com' && message.kind === 'mail') {
        respond(globalThis.DavolioDomReader.readMail(document, location.href));
      } else if (location.origin === 'https://laboratorio-davolio.roberto81.chatgpt.site' && message.kind === 'orders') {
        respond(globalThis.DavolioDomReader.readOrders(document, location.href));
      }
    } catch {
      respond({ status: 'unrecognized', items: [], message: 'Impossibile riconoscere le righe visibili. Mostra l’elenco nella scheda e riprova.' });
    }
  });
})();
