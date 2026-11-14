import { LucideIcon, Utensils, Droplet, Wheat, Sparkles, AlertCircle, Info, AlertTriangle, Award, FlaskConical } from "lucide-react";
import type { ReactNode } from "react";
import { DailyHealthMetrics } from "@/lib/health/types";
import type { Recommendation } from "@/lib/health/recommendations";
import { NUTRITION_TARGETS } from "@/lib/health/targets";

interface DailyReportProps {
  date: string;
  today: string;
  metrics: DailyHealthMetrics;
  recommendations: Recommendation[];
}

const GLYCEMIC_LABELS: Record<"low" | "medium" | "high", string> = {
  low: "Bassa",
  medium: "Media",
  high: "Alta",
};

const TRIG_LABELS: Record<"basso" | "medio" | "alto", string> = {
  basso: "Basso",
  medio: "Medio",
  alto: "Alto",
};

const MIX_LABELS: Record<"animal" | "vegetal" | "mixed", string> = {
  animal: "Prevalentemente animale",
  vegetal: "Prevalentemente vegetale",
  mixed: "Mista",
};

// Sotto questa copertura dei dati il "carico del giorno" non è affidabile.
const COVERAGE_MIN_PERCENT = 70;

function fmtNum(v: number | null | undefined): string {
  if (v === null || v === undefined) return "–";
  return Number.isInteger(v) ? String(v) : v.toFixed(1);
}

function fmtUnit(v: number | null | undefined, unit: string): string {
  if (v === null || v === undefined) return "non noto";
  return `${fmtNum(v)} ${unit}`;
}

type CardStatus = "ok" | "over" | "under" | "high" | "unknown";

const STATUS_STYLES: Record<CardStatus, { badge: string; border: string }> = {
  ok: { badge: "bg-emerald-50 text-emerald-700 border-emerald-200", border: "border-slate-200" },
  over: { badge: "bg-amber-50 text-amber-700 border-amber-200", border: "border-amber-300" },
  under: { badge: "bg-blue-50 text-blue-700 border-blue-200", border: "border-blue-200" },
  high: { badge: "bg-red-50 text-red-700 border-red-200", border: "border-red-300" },
  unknown: { badge: "bg-slate-100 text-slate-500 border-slate-200", border: "border-slate-200" },
};

const STATUS_LABELS: Record<CardStatus, string> = {
  ok: "Nei limiti",
  over: "Sopra target",
  under: "Sotto target",
  high: "Carico elevato",
  unknown: "Non noto",
};

/**
 * Card di un settore salutare: titolo, stato, valore principale,
 * righe di dettaglio con unità e confronto con i target.
 */
function SectorCard({
  title,
  icon: Icon,
  iconClass,
  status,
  statusLabel,
  mainValue,
  mainLabel,
  children,
  targetNote,
}: {
  title: string;
  icon: LucideIcon;
  iconClass: string;
  status: CardStatus;
  statusLabel?: string;
  mainValue: string;
  mainLabel: string;
  children?: ReactNode;
  targetNote?: string;
}) {
  const styles = STATUS_STYLES[status];
  const valueClass =
    status === "high" ? "text-red-700"
    : status === "over" ? "text-amber-700"
    : status === "under" ? "text-blue-700"
    : "text-slate-900";

  return (
    <div className={`p-4 rounded-2xl border bg-white shadow-sm transition-all ${styles.border}`}>
      <div className="flex items-center justify-between gap-2 mb-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className={`p-1.5 rounded-lg bg-slate-50 shrink-0 ${iconClass}`}>
            <Icon className="w-4 h-4" />
          </div>
          <p className="text-xs font-bold text-slate-500 uppercase tracking-wider truncate">{title}</p>
        </div>
        <span className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border whitespace-nowrap ${styles.badge}`}>
          {statusLabel ?? STATUS_LABELS[status]}
        </span>
      </div>
      <div className="flex items-baseline gap-1.5">
        <span className={`text-2xl font-black tabular-nums ${valueClass}`}>{mainValue}</span>
        <span className="text-[11px] font-medium text-slate-400">{mainLabel}</span>
      </div>
      {children && <div className="mt-2.5 space-y-1">{children}</div>}
      {targetNote && (
        <p className="mt-2.5 pt-2 border-t border-slate-100 text-[10px] text-slate-400 font-medium leading-4">{targetNote}</p>
      )}
    </div>
  );
}

/**
 * Riga "etichetta — valore (unità)" dentro una SectorCard.
 */
function DetailRow({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: "warn" | "high" | "under" | "muted";
}) {
  const valueClass =
    tone === "warn" ? "text-amber-600"
    : tone === "high" ? "text-red-600"
    : tone === "under" ? "text-blue-600"
    : tone === "muted" ? "text-slate-400"
    : "text-slate-700";

  return (
    <div className="flex items-baseline justify-between gap-2 text-[11px] leading-5">
      <span className="text-slate-500">{label}</span>
      <span className={`font-semibold tabular-nums text-right ${valueClass}`}>{value}</span>
    </div>
  );
}

/**
 * Card for recommendations
 */
function RecommendationCard({ rec }: { rec: Recommendation }) {
  const typeStyles = {
    info: "bg-blue-50 text-blue-700 border-blue-100",
    warning: "bg-amber-50 text-amber-700 border-amber-100",
    alta: "bg-red-50 text-red-700 border-red-100"
  };

  const Icon = {
    info: Info,
    warning: AlertTriangle,
    alta: AlertCircle
  }[rec.gravita];

  return (
    <div className={`p-4 rounded-2xl border shadow-sm space-y-3 ${typeStyles[rec.gravita]}`}>
      <div className="flex items-start gap-3">
        <Icon className="w-5 h-5 mt-0.5 shrink-0" />
        <div>
          <p className="font-bold text-sm">{rec.settore}</p>
          <p className="text-sm opacity-90 leading-relaxed">{rec.motivo}</p>
        </div>
      </div>
      <div className="space-y-2">
        <p className="text-sm font-semibold">Azione: <span className="font-normal">{rec.azione}</span></p>
        {rec.alternative && (
          <div className="flex flex-wrap gap-2 mt-2">
            {rec.alternative.map((alt, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white/50 border border-current/20 font-medium">
                {alt}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

export default function DailyReport({
  date,
  today,
  metrics,
  recommendations,
}: DailyReportProps) {
  const isToday = date === today;
  const { sugars, lipids, proteins } = metrics.sectors;
  const harmful = metrics.sectors.harmful_substances;

  // ---------- stati e confronti con i target ----------
  const coveragePct = metrics.coverage !== null ? Math.round(metrics.coverage * 100) : null;
  const coverageLow = metrics.coverage !== null && metrics.coverage * 100 < COVERAGE_MIN_PERCENT;

  const sugarsStatus: CardStatus = sugars.isHigh === null ? "unknown" : sugars.isHigh ? "over" : "ok";
  const lipidsStatus: CardStatus = lipids.isHigh === null ? "unknown" : lipids.isHigh ? "over" : "ok";
  const proteinsStatus: CardStatus = proteins.isLow === null ? "unknown" : proteins.isLow ? "under" : "ok";

  const harmfulStatus: CardStatus =
    coverageLow || harmful.isHigh === null ? "unknown" : harmful.isHigh ? "high" : "ok";
  const caricoMain = coverageLow
    ? "Non valutabile"
    : harmful.isHigh === null
      ? "Non noto"
      : harmful.isHigh
        ? "Elevato"
        : "Basso";
  const harmfulRows = [
    { label: "Carne lavorata", score: harmful.processedMeat },
    { label: "Carne rossa", score: harmful.redMeat },
    { label: "Cotture intense", score: harmful.highTempCooking },
    { label: "Ultra-processati", score: harmful.ultraProcessed },
    { label: "Alcol", score: harmful.alcohol },
    { label: "Sodio", score: harmful.sodium },
    { label: "Pesce alto mercurio", score: harmful.mercury },
    { label: "Additivi", score: harmful.additivi },
  ];

  const sugarsNote =
    sugars.kcalPercentage !== null
      ? `Zuccheri al ${fmtNum(sugars.kcalPercentage)}% delle kcal · target max ${NUTRITION_TARGETS.SUGARS_MAX_PERCENT}%`
      : `Target: max ${NUTRITION_TARGETS.SUGARS_MAX_PERCENT}% delle kcal da zuccheri`;
  const lipidsNote =
    lipids.kcalPercentage !== null
      ? `Grassi al ${fmtNum(lipids.kcalPercentage)}% delle kcal · target max ${NUTRITION_TARGETS.FAT_MAX_PERCENT}%`
      : `Target: max ${NUTRITION_TARGETS.FAT_MAX_PERCENT}% delle kcal da grassi`;
  const proteinsNote =
    proteins.kcalPercentage !== null
      ? `Proteine al ${fmtNum(proteins.kcalPercentage)}% delle kcal · target min ${NUTRITION_TARGETS.PROTEIN_MIN_PERCENT}%`
      : `Target: min ${NUTRITION_TARGETS.PROTEIN_MIN_PERCENT}% delle kcal da proteine`;
  // Origine delle stime del giorno (AI vs dichiarata) — sempre visibile.
  const originChip =
    metrics.source === "ai"
      ? `Stime AI${metrics.provider ? ` (${metrics.provider})` : ""}`
      : metrics.source === "user"
        ? "Dati dichiarati"
        : metrics.source === "mixed"
          ? "Misto: AI + dichiarazioni"
          : "";
  // Righe "Processati (NOVA 3-4)": gli alimenti che compongono la quota NOVA 3-4,
  // ciascuno con gruppo e kcal (contributori reali, non un elenco generico).
  const novaBoxText =
    harmful.novaFoods.length > 0
      ? harmful.novaFoods.map((f) => `${f.name} (NOVA ${f.group}, ${Math.round(f.kcal)} kcal)`).join(" · ")
      : harmful.novaScore === null
        ? "classificazione non nota"
        : "nessun alimento NOVA 3-4 oggi";
  // "Alimenti che pesano di più": contribuiscono solo quando il carico è realmente
  // non basso; altrimenti è semplicemente l'elenco degli alimenti analizzati
  // (metrics.dailyLoadFoods) e va etichettato "inclusi nel calcolo".
  const loadIsReal = harmful.isHigh === true;
  const loadContributors = loadIsReal
    ? harmful.novaFoods
        .map((f) => `${f.name} (NOVA ${f.group}, ${Math.round(f.kcal)} kcal)`)
        .concat(harmful.highTempCooking.value !== null && harmful.highTempCooking.value > 0 ? [harmful.highTempCooking.motivo] : [])
    : [];
  // Copertura dei campi chiave (non tutti i campi del profilo): zuccheri, fibre,
  // grassi saturi, categoria, gruppo NOVA, sodio e proteine animali/vegetali.
  const coverageNote =
    `Copertura campi chiave (zuccheri, fibre, grassi saturi, categoria, NOVA, sodio, proteine): ${coveragePct !== null ? `${coveragePct}%` : "non nota"} (${metrics.entriesComplete}/${metrics.sectors.harmful_substances.entriesTotal} voci) · `;
  // NOVA: le due misure restano sempre separate e senza soglia implicita.
  const novaNote =
    `Processati e ultra-processati (NOVA 3-4): ${harmful.novaScore !== null ? `${fmtNum(harmful.novaScore)}% delle kcal` : "non noto"} · ` +
    `Ultra-processati (NOVA 4): ${harmful.nova4KcalPercent !== null ? `${fmtNum(harmful.nova4KcalPercent)}% delle kcal` : "non noto"}`;
  // Nota superiore = solo i numeri (copertura + NOVA). L'origine AI (originChip)
  // vive UNA sola volta, nella nota di disclaimer in fondo alla scheda, così da
  // evitare il doppio disclaimer Gemini.
  const harmfulNote = `${coverageNote}${novaNote}`;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* --- Quattro schede settori, con dettagli calcolati da aggregateDay --- */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <SectorCard
          title="Zuccheri e carboidrati"
          icon={Wheat}
          iconClass="text-red-500"
          status={sugarsStatus}
          mainValue={fmtNum(metrics.totals.carbs)}
          mainLabel="g · carboidrati totali"
          targetNote={sugarsNote}
        >
          <DetailRow label="Zuccheri semplici" value={fmtUnit(sugars.simpleGrams, "g")} />
          <DetailRow label="Carboidrati complessi" value={fmtUnit(sugars.complexGrams, "g")} />
          <DetailRow
            label={`Fibre (target ${NUTRITION_TARGETS.FIBER_MIN_GRAMS} g)`}
            value={fmtUnit(metrics.fiber.totalGrams, "g")}
            tone={metrics.fiber.isLow ? "under" : undefined}
          />
          <DetailRow
            label="Classe glicemica"
            value={sugars.glycemicClass !== null ? GLYCEMIC_LABELS[sugars.glycemicClass] : "non nota"}
            tone={sugars.glycemicClass === "high" ? "warn" : undefined}
          />
        </SectorCard>

        <SectorCard
          title="Lipidi"
          icon={Droplet}
          iconClass="text-pink-500"
          status={lipidsStatus}
          mainValue={fmtNum(lipids.totalGrams)}
          mainLabel="g · grassi totali"
          targetNote={lipidsNote}
        >
          <DetailRow label="Saturi" value={fmtUnit(lipids.saturatedGrams, "g")} />
          <DetailRow label="Monoinsaturi" value={fmtUnit(lipids.monounsaturatedGrams, "g")} />
          <DetailRow label="Polinsaturi" value={fmtUnit(lipids.polyunsaturatedGrams, "g")} />
          <DetailRow label="Omega-3" value={fmtUnit(lipids.omega3Grams, "g")} />
          <DetailRow label="Omega-6" value={fmtUnit(lipids.omega6Grams, "g")} />
          <DetailRow label="Grassi trans" value={fmtUnit(lipids.transGrams, "g")} />
          <DetailRow label="Colesterolo" value={fmtUnit(lipids.cholesterolMg, "mg")} />
          <div>
            <DetailRow
              label="Rischio trigliceridi (indicatore alimentare)"
              value={lipids.triglyceridesIndicator !== null ? TRIG_LABELS[lipids.triglyceridesIndicator] : "non noto"}
              tone={
                lipids.triglyceridesIndicator === "alto" ? "high"
                : lipids.triglyceridesIndicator === "medio" ? "warn"
                : undefined
              }
            />
            <p className="text-[9px] text-slate-400 leading-3.5 mt-0.5">
              Stima dietetica su zuccheri, alcol e grassi saturi/trans: non una misurazione
            </p>
            {lipids.triglyceridesFactors.length > 0 && (
              <p className="text-[10px] text-slate-400 leading-4">
                Fattori: {lipids.triglyceridesFactors.join(", ")}
              </p>
            )}
          </div>
        </SectorCard>

        <SectorCard
          title="Proteine"
          icon={Utensils}
          iconClass="text-blue-500"
          status={proteinsStatus}
          mainValue={fmtNum(proteins.totalGrams)}
          mainLabel="g · proteine totali"
          targetNote={proteinsNote}
        >
          <DetailRow label="Animali" value={fmtUnit(proteins.animalGrams, "g")} />
          <DetailRow label="Vegetali" value={fmtUnit(proteins.vegetalGrams, "g")} />
          {proteins.gramsPerKg !== null && (
            <DetailRow label="Per kg corporeo" value={`${fmtNum(proteins.gramsPerKg)} g/kg`} />
          )}
          <DetailRow
            label="Mix"
            value={proteins.mix !== null ? MIX_LABELS[proteins.mix] : "non noto"}
          />
        </SectorCard>

        <SectorCard
          title="Sostanze nocive"
          icon={FlaskConical}
          iconClass="text-amber-500"
          status={harmfulStatus}
          mainValue={caricoMain}
          mainLabel="carico del giorno"
          targetNote={harmfulNote}
        >
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
            {harmfulRows.map(({ label, score }) => (
              <div key={label} className="leading-4">
                <div className="flex items-baseline justify-between gap-2 text-[11px]">
                  <span className="text-slate-500">{label}</span>
                  <span
                    className={`font-bold tabular-nums ${
                      score.value === null
                        ? "text-slate-300"
                        : score.value >= 2
                          ? "text-red-600"
                          : score.value === 1
                            ? "text-amber-600"
                            : "text-slate-700"
                    }`}
                  >
                    {score.value === null ? "N/D" : `${score.value}/3`}
                  </span>
                </div>
                <div className="flex justify-between items-baseline gap-2">
                  <p className="text-[10px] text-slate-400 leading-4 min-w-0 truncate" title={score.motivo}>{score.motivo || "—"}</p>
                  {score.copertura && (
                    <span className="text-[9px] text-slate-300 font-medium whitespace-nowrap" title="Copertura dati di questo indicatore: voci con dato / voci totali">
                      {score.copertura}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-2 pt-2 border-t border-amber-100/60 space-y-2">
            <p className="text-[10px] leading-4 text-slate-500">
              <span className="font-bold text-amber-700">Processati (NOVA 3-4):</span> {novaBoxText}
            </p>
            {metrics.dailyLoadFoods.length > 0 && (
              <div>
                <p className="text-[10px] font-bold text-amber-700 uppercase mb-1">
                  {loadIsReal ? "Alimenti che pesano di più:" : "Alimenti inclusi nel calcolo:"}
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {(loadIsReal ? loadContributors : metrics.dailyLoadFoods).map((food, i) => (
                    <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100/50 text-amber-800 font-medium">
                      {food}
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[9px] text-slate-400 leading-3.5">
              {originChip ? `${originChip}: valori nutrizionali, classificazione NOVA e metodi di cottura stimati dall'AI, non dati di laboratorio. ` : ""}
              Indicatori qualitativi su presenza e frequenza: non quantità misurate.
            </p>
          </div>
        </SectorCard>
      </div>

      {/* --- Raccomandazioni --- */}
      <div className="space-y-4">
        <h3 className="text-xl font-black text-slate-900 flex items-center gap-2">
          <Sparkles className="w-6 h-6 text-blue-500" />
          {isToday ? "Consigli per domani" : "Consigli per oggi, in base a ieri"}
        </h3>

        {recommendations.length > 0 ? (
          <div className="space-y-3">
            {recommendations.map((rec, idx) => (
              <RecommendationCard key={idx} rec={rec} />
            ))}
          </div>
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl text-center space-y-2">
            <Award className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-emerald-800 font-bold">Ottimo lavoro!</p>
            <p className="text-emerald-600 text-sm">I tuoi valori sono in linea con gli obiettivi nutrizionali.</p>
          </div>
        )}
      </div>

      {/* --- Disclaimer fisso --- */}
      <div className="flex gap-3 p-4 rounded-2xl bg-slate-100/50 border border-slate-200 text-slate-500">
        <Info className="w-5 h-5 shrink-0" />
        <p className="text-[10px] leading-relaxed">
          Informazioni generali, non sostituiscono il parere di un medico o di un dietista. In presenza di patologie consulta un professionista.
        </p>
      </div>
    </div>
  );
}
