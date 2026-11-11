// Servizi e giorni prenotabili (prossimi 30 giorni).
import { SERVIZI, GIORNI_MAX } from "../../lib/config.mjs";
import { oggiLocale, aggiungiGiorni, aperto } from "../../lib/slot.mjs";

export default async () => {
  const oggi = oggiLocale();
  const giorni = [];
  for (let i = 0; i <= GIORNI_MAX; i++) {
    const d = aggiungiGiorni(oggi, i);
    giorni.push({ data: d, aperto: aperto(d) });
  }
  const servizi = Object.entries(SERVIZI).map(([id, s]) => ({ id, nome: s.nome, durata: s.durata }));
  return Response.json({ servizi, giorni }, { headers: { "cache-control": "no-store" } });
};

export const config = { path: "/api/info", method: "GET" };
