// Inserisce in Google Calendar gli appuntamenti confermati dal barbiere, saltando quelli già presenti.
import { CODICE_AGENDA, SERVIZI, TIMEZONE } from "../../lib/config.mjs";
import { locale, aggiungiGiorni } from "../../lib/slot.mjs";
import { eventi, creaEvento } from "../../lib/google.mjs";

const norm = (s) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").trim();

export default async (req) => {
  if (req.headers.get("x-codice") !== CODICE_AGENDA) return new Response("Non autorizzato", { status: 401 });

  let b;
  try { b = await req.json(); } catch { return Response.json({ errore: "Richiesta non valida" }, { status: 400 }); }
  const lista = Array.isArray(b.appuntamenti) ? b.appuntamenti.slice(0, 40) : [];

  const risultati = [];
  const cacheGiorni = new Map();

  for (const a of lista) {
    const servizio = SERVIZI[a.servizio];
    const nome = String(a.nome || "").trim().slice(0, 60);
    const ok = servizio && nome && /^\d{4}-\d{2}-\d{2}$/.test(a.data) && /^\d{2}:\d{2}$/.test(a.ora);
    if (!ok) { risultati.push({ ...a, esito: "dati incompleti" }); continue; }

    try {
      const inizio = locale(a.data, a.ora);
      const fine = new Date(inizio.getTime() + servizio.durata * 60000);

      if (!cacheGiorni.has(a.data)) {
        cacheGiorni.set(a.data, await eventi(locale(a.data, "00:00"), locale(aggiungiGiorni(a.data, 1), "00:00")));
      }
      const giorno = cacheGiorni.get(a.data);
      const stesso = giorno.find((e) => e.inizio.getTime() === inizio.getTime());
      if (stesso) {
        const doppione = norm(stesso.titolo).includes(norm(nome.split(" ")[0]));
        risultati.push({ ...a, esito: doppione ? "già in calendario" : `orario già occupato da "${stesso.titolo}"` });
        continue;
      }

      await creaEvento({
        inizio, fine, timeZone: TIMEZONE,
        titolo: `${nome} – ${servizio.nome}`,
        descrizione: "Aggiunto dalla foto dell'agenda",
      });
      giorno.push({ inizio, titolo: `${nome} – ${servizio.nome}` });
      risultati.push({ ...a, esito: "aggiunto" });
    } catch (e) {
      console.error(e);
      risultati.push({ ...a, esito: "errore, riprova" });
    }
  }

  return Response.json({ risultati });
};

export const config = { path: "/api/aggiungi-appuntamenti", method: "POST" };
