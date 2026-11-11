// Accesso a Google Calendar con un account di servizio, senza librerie esterne.
import { createSign } from "node:crypto";

const SCOPE = "https://www.googleapis.com/auth/calendar";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const API = "https://www.googleapis.com/calendar/v3";

let cache = { token: null, scade: 0 };

function env(nome) {
  const v = Netlify.env.get(nome);
  if (!v) throw new Error(`Variabile mancante: ${nome}`);
  return v;
}

function b64url(buf) {
  return Buffer.from(buf).toString("base64").replace(/=/g, "").replace(/\+/g, "-").replace(/\//g, "_");
}

async function getToken() {
  const ora = Math.floor(Date.now() / 1000);
  if (cache.token && cache.scade - 60 > ora) return cache.token;

  const email = env("GOOGLE_CLIENT_EMAIL");
  // Le chiavi incollate nelle variabili d'ambiente spesso hanno "\n" letterali.
  const chiave = env("GOOGLE_PRIVATE_KEY").replace(/\\n/g, "\n");

  const header = b64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const payload = b64url(JSON.stringify({ iss: email, scope: SCOPE, aud: TOKEN_URL, iat: ora, exp: ora + 3600 }));
  const firma = createSign("RSA-SHA256").update(`${header}.${payload}`).sign(chiave);
  const jwt = `${header}.${payload}.${b64url(firma)}`;

  const res = await fetch(TOKEN_URL, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: jwt }),
  });
  if (!res.ok) throw new Error(`Accesso Google non riuscito (${res.status}): ${await res.text()}`);
  const dati = await res.json();
  cache = { token: dati.access_token, scade: ora + dati.expires_in };
  return cache.token;
}

async function chiama(percorso, opzioni = {}) {
  const token = await getToken();
  const res = await fetch(`${API}${percorso}`, {
    ...opzioni,
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json", ...(opzioni.headers || {}) },
  });
  if (!res.ok) throw new Error(`Errore Google Calendar (${res.status}): ${await res.text()}`);
  return res.json();
}

export function calendarId() {
  return env("GOOGLE_CALENDAR_ID");
}

// Restituisce gli intervalli occupati [{start, end}] (Date) tra due istanti.
export async function occupati(da, a) {
  const id = calendarId();
  const dati = await chiama("/freeBusy", {
    method: "POST",
    body: JSON.stringify({ timeMin: da.toISOString(), timeMax: a.toISOString(), items: [{ id }] }),
  });
  const cal = dati.calendars?.[id];
  if (cal?.errors?.length) throw new Error(`Calendario non accessibile: ${JSON.stringify(cal.errors)}`);
  return (cal?.busy || []).map((b) => ({ start: new Date(b.start), end: new Date(b.end) }));
}

// Eventi (non annullati) tra due istanti, con orario di inizio e titolo.
export async function eventi(da, a) {
  const q = new URLSearchParams({ timeMin: da.toISOString(), timeMax: a.toISOString(), singleEvents: "true", maxResults: "250" });
  const dati = await chiama(`/calendars/${encodeURIComponent(calendarId())}/events?${q}`);
  return (dati.items || [])
    .filter((e) => e.status !== "cancelled" && e.start?.dateTime)
    .map((e) => ({ inizio: new Date(e.start.dateTime), titolo: e.summary || "" }));
}

export async function creaEvento({ inizio, fine, titolo, descrizione, timeZone }) {
  return chiama(`/calendars/${encodeURIComponent(calendarId())}/events`, {
    method: "POST",
    body: JSON.stringify({
      summary: titolo,
      description: descrizione,
      start: { dateTime: inizio.toISOString(), timeZone },
      end: { dateTime: fine.toISOString(), timeZone },
    }),
  });
}
