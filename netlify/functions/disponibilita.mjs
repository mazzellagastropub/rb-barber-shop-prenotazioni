// Orari liberi di un giorno, letti in tempo reale dal Google Calendar del barbiere.
import { SERVIZI } from "../../lib/config.mjs";
import { candidati, libero, dataValida, locale, aggiungiGiorni } from "../../lib/slot.mjs";
import { occupati } from "../../lib/google.mjs";

export default async (req) => {
  const url = new URL(req.url);
  const data = url.searchParams.get("data") || "";
  const servizio = SERVIZI[url.searchParams.get("servizio") || ""];

  if (!servizio || !dataValida(data)) {
    return Response.json({ errore: "Richiesta non valida" }, { status: 400 });
  }

  const tutti = candidati(data, servizio.durata);
  if (!tutti.length) return Response.json({ orari: [] }, { headers: { "cache-control": "no-store" } });

  try {
    const busy = await occupati(locale(data, "00:00"), locale(aggiungiGiorni(data, 1), "00:00"));
    const orari = tutti.filter((s) => libero(s, busy)).map((s) => s.ora);
    return Response.json({ orari }, { headers: { "cache-control": "no-store" } });
  } catch (e) {
    console.error(e);
    return Response.json({ errore: "Calendario non raggiungibile" }, { status: 502 });
  }
};

export const config = {
  path: "/api/disponibilita",
  method: "GET",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 60 },
};
