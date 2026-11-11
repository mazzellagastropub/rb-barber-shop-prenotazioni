// Legge la foto dell'agenda con Gemini (piano gratuito) e restituisce gli appuntamenti trovati.
import { CODICE_AGENDA, SERVIZI, ORARI, TIMEZONE } from "../../lib/config.mjs";
import { oggiLocale } from "../../lib/slot.mjs";

const GG = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];

export default async (req) => {
  if (req.headers.get("x-codice") !== CODICE_AGENDA) return new Response("Non autorizzato", { status: 401 });

  const chiave = Netlify.env.get("GEMINI_API_KEY");
  if (!chiave) return Response.json({ errore: "Manca la chiave Gemini su Netlify" }, { status: 500 });
  const modello = Netlify.env.get("GEMINI_MODEL") || "gemini-flash-latest";

  let b;
  try { b = await req.json(); } catch { return Response.json({ errore: "Foto non valida" }, { status: 400 }); }
  const immagine = String(b.immagine || "");
  if (!immagine || immagine.length > 5_000_000) return Response.json({ errore: "Foto mancante o troppo grande" }, { status: 400 });

  const oggi = oggiLocale();
  const [y, m, d] = oggi.split("-").map(Number);
  const giornoOggi = GG[new Date(Date.UTC(y, m - 1, d)).getUTCDay()];
  const servizi = Object.values(SERVIZI).map((s) => s.nome).join(", ");
  const giorniAperti = Object.keys(ORARI).map((n) => GG[n]).join(", ");

  const istruzioni = `Sei l'assistente di un barbiere italiano. La foto mostra una pagina della sua agenda di carta, scritta a mano.
Oggi è ${giornoOggi} ${oggi} (fuso ${TIMEZONE}). Il negozio è aperto ${giorniAperti}.
Estrai OGNI appuntamento scritto: data, ora di inizio, nome del cliente, servizio.
- La data va dedotta dall'intestazione della pagina o del giorno. Se manca l'anno, usa la data futura più vicina a oggi (al massimo 60 giorni avanti). Se non si capisce la data, lascia data vuota.
- Ora in formato HH:MM a 24 ore. Le ore del pomeriggio scritte come "3", "4", "5"... sono 15:00, 16:00, 17:00...
- Servizio: uno tra ${servizi}. "T" o "taglio" = Taglio; "B" o "barba" = Barba; entrambi = Taglio + barba. Se non è indicato usa Taglio.
- Ignora righe cancellate o barrate.
- "dubbio" = true se la scrittura è poco leggibile o hai dovuto indovinare qualcosa.`;

  const schema = {
    type: "OBJECT",
    properties: {
      appuntamenti: {
        type: "ARRAY",
        items: {
          type: "OBJECT",
          properties: {
            data: { type: "STRING", description: "YYYY-MM-DD" },
            ora: { type: "STRING", description: "HH:MM" },
            nome: { type: "STRING" },
            servizio: { type: "STRING", enum: Object.values(SERVIZI).map((s) => s.nome) },
            dubbio: { type: "BOOLEAN" },
          },
          required: ["data", "ora", "nome", "servizio", "dubbio"],
        },
      },
    },
    required: ["appuntamenti"],
  };

  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modello}:generateContent`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-goog-api-key": chiave },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [
        { inline_data: { mime_type: "image/jpeg", data: immagine } },
        { text: istruzioni },
      ] }],
      generationConfig: { responseMimeType: "application/json", responseSchema: schema, temperature: 0 },
    }),
  });

  if (!res.ok) {
    const t = await res.text();
    console.error("Gemini", res.status, t);
    const msg = res.status === 429 ? "Limite gratuito raggiunto, riprova tra qualche minuto" : "Non riesco a leggere la foto, riprova";
    return Response.json({ errore: msg }, { status: 502 });
  }

  try {
    const j = await res.json();
    const testo = j.candidates?.[0]?.content?.parts?.map((p) => p.text || "").join("") || "{}";
    const { appuntamenti = [] } = JSON.parse(testo);
    const servizioId = Object.fromEntries(Object.entries(SERVIZI).map(([id, s]) => [s.nome, id]));
    const puliti = appuntamenti.map((a) => ({
      data: /^\d{4}-\d{2}-\d{2}$/.test(a.data) ? a.data : "",
      ora: /^\d{1,2}:\d{2}$/.test(a.ora) ? a.ora.padStart(5, "0") : "",
      nome: String(a.nome || "").slice(0, 60),
      servizio: servizioId[a.servizio] || "taglio",
      dubbio: Boolean(a.dubbio) || !a.data || !a.ora,
    }));
    return Response.json({ appuntamenti: puliti });
  } catch (e) {
    console.error(e);
    return Response.json({ errore: "Risposta non leggibile, riprova con una foto più nitida" }, { status: 502 });
  }
};

export const config = {
  path: "/api/leggi-agenda",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 6 },
};
