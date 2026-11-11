// Config PostCSS locale per tracker_mobile.
// Esiste per BLOCCARE la ricerca di postcss-load-config verso la radice
// del monorepo (la cui config richiede @tailwindcss/postcss, non installato
// qui). I CSS di questo progetto sono gestiti dal loader Turbopack
// (@tailwindcss/turbopack) definito in next.config.ts, quindi i plugin
// PostCSS non sono necessari.
const config = {
  plugins: {},
};

export default config;
