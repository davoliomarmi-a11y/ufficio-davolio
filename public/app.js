'use strict';
const $ = selector => document.querySelector(selector);
const TIMEZONE = 'Europe/Rome';
const PERIOD = 2 * 60 * 60 * 1000;
const getSaved = (key, fallback = '') => { try { return localStorage.getItem(key) || fallback; } catch { return fallback; } };
const save = (key, value) => { try { localStorage.setItem(key, value); } catch {} };
const romeDay = date => new Intl.DateTimeFormat('sv-SE', { timeZone: TIMEZONE }).format(date);
function refreshDay() {
  $('#today-date').textContent = new Intl.DateTimeFormat('it-IT', { weekday:'long', day:'numeric', month:'long', year:'numeric', timeZone:TIMEZONE }).format(new Date());
}
refreshDay();
setInterval(refreshDay, 60000);
$('#open-settings').onclick = () => $('#settings').showModal();
document.querySelectorAll('[data-close]').forEach(button => button.onclick = () => document.getElementById(button.dataset.close).close());
function setSize(large) {
  document.documentElement.classList.toggle('large', large);
  $('#large-text').setAttribute('aria-pressed', String(large));
  $('#large-text').textContent = large ? 'A− Testo normale' : 'A+ Testo più grande';
}
setSize(getSaved('ufficio-large-text') === 'yes');
$('#large-text').onclick = () => { const large = !document.documentElement.classList.contains('large'); setSize(large); save('ufficio-large-text', large ? 'yes' : 'no'); };
let voices = [], remindersOn = false, nextReminder = 0;
const hasVoice = 'speechSynthesis' in window;
function loadVoices() {
  if (!hasVoice) return;
  voices = speechSynthesis.getVoices().filter(voice => /^it(?:-|_)/i.test(voice.lang));
  const select = $('#voice-choice');
  select.replaceChildren(new Option('Voce italiana automatica', ''));
  voices.forEach(voice => select.add(new Option(voice.name, voice.voiceURI)));
  select.value = getSaved('ufficio-voice');
  if (select.selectedIndex < 0) select.value = '';
}
function speak(text) {
  if (!hasVoice) { $('#reminder-status').textContent = 'La sintesi vocale non è disponibile in questo browser.'; return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'it-IT';
  utterance.voice = voices.find(voice => voice.voiceURI === $('#voice-choice').value) || voices[0] || null;
  utterance.rate = .96;
  utterance.onerror = event => { if (!['canceled', 'interrupted'].includes(event.error)) $('#reminder-status').textContent = 'Il browser non ha riprodotto la voce. Provate di nuovo con «Prova la voce».'; };
  speechSynthesis.speak(utterance);
}
if (hasVoice) { loadVoices(); speechSynthesis.addEventListener('voiceschanged', loadVoices); }
$('#voice-choice').onchange = () => save('ufficio-voice', $('#voice-choice').value);
$('#test-voice').onclick = () => speak('Ciao Sabrina, ciao Angela. Guardiamo insieme le cose da fare, una cosa alla volta.');
$('#stop-voice').onclick = () => { if (hasVoice) speechSynthesis.cancel(); };
$('#read-report').onclick = () => speak('Benvenute nella scrivania dell’ufficio. Tenete aperte Gmail e la lista Lavori, poi premete Leggi posta e lavori. Per le priorità aprite Briefing programmati. Per chiedere una mano scegliete Assistente e voce: nella chat potete scrivere oppure premere il pulsante della voce.');
function reminderStatus() {
  $('#toggle-reminders').setAttribute('aria-pressed', String(remindersOn));
  $('#toggle-reminders').textContent = remindersOn ? 'Disattiva i promemoria vocali' : 'Attiva i promemoria vocali';
  $('#reminder-status').textContent = remindersOn ? 'Attivi finché la pagina resta aperta: saluto alle 08:30 e promemoria ogni due ore, nella fascia indicata.' : 'Promemoria vocali disattivati.';
}
$('#toggle-reminders').onclick = () => {
  if (!hasVoice) { $('#reminder-status').textContent = 'La sintesi vocale non è disponibile in questo browser.'; return; }
  remindersOn = !remindersOn;
  if (remindersOn) { nextReminder = Math.max(Date.now() + PERIOD, Number(getSaved('ufficio-last-reminder', '0')) + PERIOD); speak('Ciao Sabrina, ciao Angela. I promemoria sono attivi mentre la pagina resta aperta. Vi ricorderò di consultare i briefing in ChatGPT.'); }
  else { speechSynthesis.cancel(); $('#reminder-toast').hidden = true; }
  reminderStatus();
};
function announce(text, day, morning) {
  const now = Date.now();
  save('ufficio-last-reminder', String(now));
  if (morning) save('ufficio-morning-day', day);
  nextReminder = now + PERIOD;
  $('#reminder-message').textContent = text;
  $('#reminder-toast').hidden = false;
  speak(text);
}
function checkReminders() {
  if (!remindersOn) return;
  const now = new Date(), day = romeDay(now);
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone:TIMEZONE, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).formatToParts(now);
  const hour = Number(parts.find(part => part.type === 'hour').value), minute = Number(parts.find(part => part.type === 'minute').value);
  if (hour === 8 && minute >= 30 && getSaved('ufficio-morning-day') !== day) {
    announce('Buongiorno Sabrina, buongiorno Angela! Caffè pronto? Aprite il briefing delle otto e trenta in ChatGPT per fare il punto su appuntamenti, posta e priorità. Buon lavoro!', day, true);
  } else if (hour >= 8 && hour < 19 && now.getTime() >= nextReminder && now.getTime() - Number(getSaved('ufficio-last-reminder', '0')) >= PERIOD) {
    announce('Sabrina e Angela, facciamo il punto. Aprite il briefing in ChatGPT per controllare le novità e scegliere la prossima cosa da fare.', day, false);
  }
}
setInterval(checkReminders, 15000);
document.addEventListener('visibilitychange', () => { if (!document.hidden) { refreshDay(); checkReminders(); } });
$('#dismiss-reminder').onclick = () => { $('#reminder-toast').hidden = true; if (hasVoice) speechSynthesis.cancel(); };
