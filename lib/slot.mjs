// Calcolo degli orari prenotabili, nel fuso orario del negozio.
import { TIMEZONE, ORARI, PASSO_MINUTI, PREAVVISO_MINUTI, GIORNI_MAX } from "./config.mjs";

// Scarto in minuti tra il fuso del negozio e UTC in un dato istante.
function scarto(istante) {
  const parti = new Intl.DateTimeFormat("en-US", {
    timeZone: TIMEZONE, hourCycle: "h23",
    year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit",
  }).formatToParts(istante).reduce((o, p) => ((o[p.type] = p.value), o), {});
  const comeUtc = Date.UTC(+parti.year, +parti.month - 1, +parti.day, +parti.hour, +parti.minute, +parti.second);
  return Math.round((comeUtc - istante.getTime()) / 60000);
}

// "2026-11-14" + "09:30" ora locale del negozio -> Date (UTC)
export function locale(data, ora) {
  const [y, m, d] = data.split("-").map(Number);
  const [h, min] = ora.split(":").map(Number);
  const ipotesi = Date.UTC(y, m - 1, d, h, min);
  let t = ipotesi - scarto(new Date(ipotesi)) * 60000;
  t = ipotesi - scarto(new Date(t)) * 60000; // seconda passata per i cambi d'ora
  return new Date(t);
}

// Data di oggi nel fuso del negozio, "YYYY-MM-DD"
export function oggiLocale(adesso = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: TIMEZONE }).format(adesso);
}

export function aggiungiGiorni(data, n) {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d + n)).toISOString().slice(0, 10);
}

function giornoSettimana(data) {
  const [y, m, d] = data.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).getUTCDay();
}

const hhmm = (min) => `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
const minuti = (s) => { const [h, m] = s.split(":").map(Number); return h * 60 + m; };

export function dataValida(data, adesso = new Date()) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data)) return false;
  const oggi = oggiLocale(adesso);
  return data >= oggi && data <= aggiungiGiorni(oggi, GIORNI_MAX);
}

export function aperto(data) {
  return Boolean(ORARI[giornoSettimana(data)]);
}

// Tutti gli orari di inizio teorici di un giorno per un servizio di "durata" minuti.
export function candidati(data, durata, adesso = new Date()) {
  const fasce = ORARI[giornoSettimana(data)] || [];
  const limite = adesso.getTime() + PREAVVISO_MINUTI * 60000;
  const out = [];
  for (const [da, a] of fasce) {
    for (let t = minuti(da); t + durata <= minuti(a); t += PASSO_MINUTI) {
      const inizio = locale(data, hhmm(t));
      if (inizio.getTime() < limite) continue;
      out.push({ ora: hhmm(t), inizio, fine: new Date(inizio.getTime() + durata * 60000) });
    }
  }
  return out;
}

export function libero(slot, occupati) {
  return !occupati.some((b) => slot.inizio < b.end && slot.fine > b.start);
}
