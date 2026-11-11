// Impostazioni di RB Barber Shop. Per cambiare servizi, durate o orari si modifica solo questo file.

export const TIMEZONE = "Europe/Rome";

// Durata in minuti di ogni servizio. Da aggiornare quando il barbiere conferma le durate reali.
export const SERVIZI = {
  taglio: { nome: "Taglio", durata: 30 },
  barba: { nome: "Barba", durata: 30 },
  "taglio-barba": { nome: "Taglio + barba", durata: 30 },
};

// Orari di apertura per giorno della settimana (0 = domenica, 1 = lunedì, ... 6 = sabato).
// Ogni fascia è ["HH:MM", "HH:MM"]. I giorni assenti sono chiusi.
export const ORARI = {
  2: [["09:00", "13:00"], ["15:00", "20:00"]],
  3: [["09:00", "13:00"], ["15:00", "20:00"]],
  4: [["09:00", "13:00"], ["15:00", "20:00"]],
  5: [["09:00", "13:00"], ["15:00", "20:00"]],
  6: [["09:00", "13:00"], ["15:00", "20:00"]],
};

export const PASSO_MINUTI = 30;        // ogni quanto parte un appuntamento
export const PREAVVISO_MINUTI = 120;   // preavviso minimo per prenotare
export const GIORNI_MAX = 30;          // fino a quanti giorni avanti si prenota

// Codice della pagina privata "Foto agenda" (indirizzo: /agenda-e56ef10186).
// Chi non conosce il link non può usarla.
export const CODICE_AGENDA = "e56ef10186";
