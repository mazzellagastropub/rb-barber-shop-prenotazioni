// Crea la prenotazione direttamente nel Google Calendar del barbiere.
import { SERVIZI, TIMEZONE } from "../../lib/config.mjs";
import { candidati, libero, dataValida } from "../../lib/slot.mjs";
import { occupati, creaEvento } from "../../lib/google.mjs";

const pulisci = (s, max) => String(s || "").replace(/[\u0000-\u001f]/g, " ").trim().slice(0, max);

export default async (req) => {
  let b;
  try { b = await req.json(); } catch { return Response.json({ errore: "Richiesta non valida" }, { status: 400 }); }

  // Campo trappola per i bot: le persone non lo vedono.
  if (b.sito) return Response.json({ ok: true });

  const servizio = SERVIZI[b.servizio];
  const nome = pulisci(b.nome, 60);
  const telefono = pulisci(b.telefono, 20).replace(/[^\d+ ]/g, "");
  const note = pulisci(b.note, 200);
  const data = String(b.data || "");
  const ora = String(b.ora || "");

  if (!servizio || !dataValida(data) || nome.length < 2 || telefono.replace(/\D/g, "").length < 8) {
    return Response.json({ errore: "Controlla i dati inseriti" }, { status: 400 });
  }

  const slot = candidati(data, servizio.durata).find((s) => s.ora === ora);
  if (!slot) return Response.json({ errore: "Orario non disponibile" }, { status: 409 });

  try {
    // Ricontrollo all'ultimo istante per evitare doppie prenotazioni.
    const busy = await occupati(slot.inizio, slot.fine);
    if (!libero(slot, busy)) {
      return Response.json({ errore: "Questo orario è appena stato preso. Scegline un altro." }, { status: 409 });
    }
    await creaEvento({
      inizio: slot.inizio,
      fine: slot.fine,
      timeZone: TIMEZONE,
      titolo: `${nome} – ${servizio.nome}`,
      descrizione: [`Telefono: ${telefono}`, note && `Note: ${note}`, "Prenotato dal sito"].filter(Boolean).join("\n"),
    });
    return Response.json({ ok: true, servizio: servizio.nome, data, ora });
  } catch (e) {
    console.error(e);
    return Response.json({ errore: "Prenotazione non riuscita, riprova o scrivici su WhatsApp" }, { status: 502 });
  }
};

export const config = {
  path: "/api/prenota",
  method: "POST",
  rateLimit: { action: "rate_limit", aggregateBy: ["ip", "domain"], windowSize: 60, windowLimit: 8 },
};
