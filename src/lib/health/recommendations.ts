import type { DailyHealthMetrics } from "./types";
import { NUTRITION_TARGETS } from "./targets";

export type RecommendationType = "warning" | "info" | "alta";

export interface Recommendation {
  settore: string;
  gravita: RecommendationType;
  motivo: string;
  azione: string;
  alternative?: string[];
}

/**
 * Genera un elenco di raccomandazioni basate sulle metriche giornaliere e sui target nutrizionali.
 * Le raccomandazioni sono strutturate per fornire contesto (motivo), un'azione immediata e opzioni alternative.
 */
export function generateRecommendations(metrics: DailyHealthMetrics): Recommendation[] {
  const recommendations: Recommendation[] = [];

  // --- Zuccheri ---
  if (metrics.sectors.sugars.isHigh) {
    const sugarKcal = (metrics.sectors.sugars.totalGrams ?? 0) * 4;
    const totalKcal = metrics.totals.calories;
    const percent = totalKcal > 0 ? (sugarKcal / totalKcal) * 100 : 0;

    recommendations.push({
      settore: "Zuccheri",
      gravita: "warning",
      motivo: `L'apporto di zuccheri è al ${percent.toFixed(1)}% delle kcal (target max ${NUTRITION_TARGETS.SUGARS_MAX_PERCENT}%).`,
      azione: "Riduci il consumo di bevande zuccherate e snack dolci.",
      alternative: ["Sostituisci con frutta intera", "Prediligi cereali integrali"],
    });
  }

  // --- Lipidi ---
  if (metrics.sectors.lipids.isHigh) {
    const fatKcal = (metrics.sectors.lipids.totalGrams ?? 0) * 9;
    const totalKcal = metrics.totals.calories;
    const percent = totalKcal > 0 ? (fatKcal / totalKcal) * 100 : 0;

    recommendations.push({
      settore: "Lipidi",
      gravita: "warning",
      motivo: `L'apporto di grassi è al ${percent.toFixed(1)}% delle kcal (target max ${NUTRITION_TARGETS.FAT_MAX_PERCENT}%).`,
      azione: "Riduci l'uso di oli aggiunti e grassi animali.",
      alternative: ["Usa olio extravergine d'oliva a crudo", "Preferisci proteine magre"],
    });
  }

  // --- Proteine ---
  if (metrics.sectors.proteins.isLow) {
    recommendations.push({
      settore: "Proteine",
      gravita: "warning",
      motivo: "L'apporto proteico è inferiore al target minimo consigliato per il mantenimento muscolare.",
      azione: "Aumenta le porzioni di fonti proteiche nei pasti principali.",
      alternative: ["Inserisci legumi", "Aggiungi yogurt o uova"],
    });
  }

  // --- Fibre ---
  if (metrics.fiber.isLow) {
    recommendations.push({
      settore: "Fibre",
      gravita: "warning",
      motivo: `L'apporto di fibre è basso (target: ${NUTRITION_TARGETS.FIBER_MIN_GRAMS}g).`,
      azione: "Aumenta il consumo di verdura e cereali integrali.",
      alternative: ["Aggiungi semi o frutta a guscio", "Sostituisci pane bianco con integrale"],
    });
  }

  // --- Sostanze nocive (Settore 4) ---
  const harmful = metrics.sectors.harmful_substances;

  if (harmful.isHigh) {
    // Caso critico: molti segnali di rischio
    const riskCount = Object.values(harmful).filter(
      (s) => (s instanceof Object ? (s as any).value !== null && (s as any).value > 0 : false)
    ).length;

    if (riskCount >= 3) {
      recommendations.push({
        settore: "Sostanze Nocive",
        gravita: "alta",
        motivo: "Hai accumulato molti indicatori di rischio (alimenti ultra-processati, eccesso di sale o cotture critiche).",
        azione: "Prevedi un giorno di 'reset' con alimenti freschi e minimamente lavorati.",
        alternative: ["Riduci drasticamente i prodotti confezionati domani"],
      });
    } else {
      recommendations.push({
        settore: "Sostanze Nocive",
        gravita: "warning",
        motivo: "Rilevati indicatori di rischio (es. eccesso di sale o cibi ultra-processati).",
        azione: "Cerca di preferire alimenti freschi e meno confezionati.",
      });
    }
  }

  if (harmful.novaScore !== null && harmful.novaScore > NUTRITION_TARGETS.NOVA_MAX_PERCENT) {
    recommendations.push({
      settore: "Sostanze Nocive",
      gravita: "warning",
      motivo: `L'apporto di alimenti processati e ultra-processati (NOVA 3-4) è rilevante: ${harmful.novaScore.toFixed(1)}% delle kcal del giorno.`,
      azione: "Limita i prodotti pronti e industriali.",
      alternative: ["Cucina partendo da ingredienti base", "Leggi le etichette"],
    });
  }

  if (harmful.highTempCooking.value !== null && harmful.highTempCooking.value! >= 2) {
    recommendations.push({
      settore: "Sostanze Nocive",
      gravita: "warning",
      motivo: "Eccesso di cotture ad alte temperature (fritture o griglie intense).",
      azione: "Preferisci cotture più dolci (vapore, bollitura, forno a bassa temperatura).",
      alternative: ["Usa la cottura a vapore", "Preferisci cotture lente"],
    });
  }

  if (harmful.alcohol.value !== null && harmful.alcohol.value! > 0) {
    recommendations.push({
      settore: "Sostanze Nocive",
      gravita: "info",
      motivo: "È stato rilevato il consumo di alcol.",
      azione: "Cerca di limitarne la frequenza e la quantità.",
    });
  }

  if (harmful.sodium.value !== null && harmful.sodium.value! >= 2) {
    recommendations.push({
      settore: "Sostanze Nocive",
      gravita: "warning",
      motivo: "L'apporto di sodio è elevato (limite raccomandato: < 2g).",
      azione: "Riduci l'aggiunta di sale a tavola e i cibi molto salati.",
      alternative: ["Usa spezie ed erbe aromatiche per insaporire"],
    });
  }

  // --- Trigliceridi ---
  if (metrics.sectors.lipids.triglyceridesIndicator === "alto") {
    recommendations.push({
      settore: "Lipidi",
      gravita: "warning",
      motivo: "Indicatore alimentare dei trigliceridi elevato (basato su zuccheri, alcol e grassi saturi).",
      azione: "Cerca di ridurre l'apporto di zuccheri semplici, alcol e grassi saturi.",
      alternative: ["Privilegia grassi insaturi (omega-3)", "Sostituisci zuccheri con fibre"],
    });
  } else if (metrics.sectors.lipids.triglyceridesIndicator === "medio") {
    recommendations.push({
      settore: "Lipidi",
      gravita: "info",
      motivo: "Indicatore alimentare dei trigliceridi in allerta.",
      azione: "Monitora l'apporto di zuccheri e grassi saturi.",
    });
  }

  return recommendations;
}
