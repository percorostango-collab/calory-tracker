import type { HealthEntry, DailyHealthMetrics, Score03 } from "./types";
import { NUTRITION_TARGETS } from "./targets";

function scoreFromCount(count: number): 0 | 1 | 2 | 3 {
  if (count >= 3) return 3;
  if (count === 2) return 2;
  if (count === 1) return 1;
  return 0;
}

function score03(value: 0 | 1 | 2 | 3 | null, motivo: string, copertura?: string): Score03 {
  return copertura != null ? { value, motivo, copertura } : { value, motivo };
}

/**
 * Sotto questa copertura dei dati, "nessun rischio rilevato" non è affidabile
 * e l'indicatore resta "non valutabile" (null).
 */
const MIN_COVERAGE_FOR_LOW_SCORE = 0.7;

/**
 * Calcola un punteggio 0-3 tracciando dati mancanti.
 * - trueCount > 0: il punteggio riflette i rischi rilevati (i null non bloccano);
 *   se ci sono null, il motivo segnala la copertura parziale.
 * - trueCount === 0 e nullCount === 0: punteggio 0 con motivo standard.
 * - trueCount === 0 e nullCount > 0:
 *   - copertura (valutati/totale) >= soglia: punteggio 0 con copertura parziale;
 *   - copertura < soglia: null (non valutabile).
 */
function scoreWithNulls(
  trueCount: number,
  nullCount: number,
  evaluatedCount: number,
  zeroMotivo: string,
  positiveMotivo: (count: number) => string,
): Score03 {
  const total = evaluatedCount + nullCount;
  const copertura = `${evaluatedCount}/${total}`;

  if (trueCount > 0) {
    return score03(scoreFromCount(trueCount), positiveMotivo(trueCount), copertura);
  }

  if (nullCount === 0) {
    return score03(0, zeroMotivo, copertura);
  }

  const coverage = total > 0 ? evaluatedCount / total : 0;

  if (coverage >= MIN_COVERAGE_FOR_LOW_SCORE) {
    return score03(0, zeroMotivo, copertura);
  }

  return score03(null, "copertura dati insufficiente per questo indicatore", copertura);
}

/**
 * Punteggio sodio 0-3 basato sui mg totali giornalieri.
 * Null se il sodio è sconosciuto.
 */
function sodiumScore(mg: number | null): 0 | 1 | 2 | 3 | null {
  if (mg == null) return null;
  if (mg < 2000) return 0;
  if (mg < 3000) return 1;
  if (mg < 4000) return 2;
  return 3;
}

/**
 * Classe glicemica stimata dal rapporto zuccheri semplici / carboidrati totali.
 * Null quando non ci sono dati sufficienti.
 */
function glycemicClass(
  simpleGrams: number | null,
  totalCarbs: number,
): "low" | "medium" | "high" | null {
  if (simpleGrams == null || totalCarbs <= 0) return null;
  const ratio = simpleGrams / totalCarbs;
  if (ratio > 0.5) return "high";
  if (ratio >= 0.2) return "medium";
  return "low";
}

/**
 * Rischio trigliceridi: basso / medio / alto / null (dati insufficienti).
 * Fattori: zuccheri semplici, alcol, grassi saturi.
 */
function triglyceridesRisk(
  totalFat: number | null,
  saturated: number | null,
  trans: number | null,
  sugar: number | null,
  carbs: number,
  alcohol: number | null,
): { level: "basso" | "medio" | "alto" | null; factors: string[] } {
  if (totalFat == null) return { level: null, factors: [] };

  const factors: string[] = [];
  const satRatio = saturated != null ? saturated / totalFat : 0;
  const sugarRatio = carbs > 0 && sugar != null ? sugar / carbs : 0;

  let high = false;
  let medium = false;

  if (alcohol != null && alcohol > 0) {
    factors.push("alcol");
    high = true;
  }
  if (sugarRatio > 0.5) {
    factors.push("zuccheri semplici elevati (>50% carboidrati)");
    high = true;
  } else if (sugarRatio > 0.25) {
    factors.push("zuccheri semplici >25% carboidrati");
    medium = true;
  }
  if (satRatio > 0.5) {
    factors.push("grassi saturi >50% grassi totali");
    high = true;
  } else if (satRatio > 0.3) {
    factors.push("grassi saturi >30% grassi totali");
    medium = true;
  }
  if (trans != null && trans > 0) {
    factors.push("grassi trans presenti");
    high = true;
  }

  if (high) return { level: "alto", factors };
  if (medium || factors.length > 0) return { level: "medio", factors };
  return { level: "basso", factors };
}

/**
 * Cotture a temperatura elevata: fritto, frittura, grigliato, arrosto.
 */
function isHighTempCooking(method: string | null | undefined): boolean {
  if (!method) return false;
  const m = method.toLowerCase();
  return (
    m.includes("fritto") ||
    m.includes("frittura") ||
    m.includes("grigliat") ||
    m.includes("arrosto")
  );
}

/**
 * Somma sicura: ignora i null ma se tutti i valori sono null restituisce null.
 */
function sumOrNull(values: (number | null)[]): number | null {
  const present = values.filter((v): v is number => v != null);
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

/**
 * Daily load based ONLY on sector-4 scores (0-3).
 * Null if nothing is evaluable (all scores null).
 */
function dailyLoadFromScores(scores: Score03[]): "low" | "medium" | "high" | null {
  const present = scores.filter((s) => s.value != null && s.value > 0);
  const anyKnown = scores.some((s) => s.value != null);
  if (!anyKnown) return null;
  if (present.length === 0) {
    return "low";
  }
  if (present.some((s) => s.value === 3)) return "high";
  return "medium";
}

/**
 * Pure logic for aggregating nutritional data into the 4 Healthy Sectors
 * (Settori Salutari) plus coverage, daily load and critical foods.
 * Decoupled from any database or framework.
 */
export function aggregateDay(entries: HealthEntry[], weightKg?: number | null): DailyHealthMetrics {
  if (entries.length === 0) {
    const emptyMotivo = "nessun dato";
    return {
      totals: { calories: 0, carbs: 0, protein: 0, fat: 0, fiber: 0 },
      sectors: {
        sugars: {
          totalGrams: null, simpleGrams: null, complexGrams: null,
          glycemicClass: null, kcalPercentage: null, isHigh: null,
          entriesTotal: 0, entriesWithData: 0,
        },
        lipids: {
          totalGrams: null, saturatedGrams: null, monounsaturatedGrams: null,
          polyunsaturatedGrams: null, omega3Grams: null, omega6Grams: null,
          transGrams: null, cholesterolMg: null,
          triglyceridesIndicator: null, triglyceridesFactors: [],
          kcalPercentage: null, isHigh: null,
          entriesTotal: 0, entriesWithData: 0,
        },
        proteins: {
          totalGrams: null, animalGrams: null, vegetalGrams: null,
          gramsPerKg: null, kcalPercentage: null, mix: null, isLow: null,
          entriesTotal: 0, entriesWithData: 0,
        },
        harmful_substances: {
          processedMeat: score03(null, emptyMotivo),
          redMeat: score03(null, emptyMotivo),
          highTempCooking: score03(null, emptyMotivo),
          ultraProcessed: score03(null, emptyMotivo),
          alcohol: score03(null, emptyMotivo),
          sodium: score03(null, emptyMotivo),
          mercury: score03(null, emptyMotivo),
          additivi: score03(null, emptyMotivo),
          novaScore: null,
          nova4KcalPercent: null,
          novaCounts: { g1: 0, g2: 0, g3: 0, g4: 0, unknown: 0 },
          novaFoods: [],
          cookingSources: { declared: 0, ai: 0, unknown: 0 },
          isHigh: null,
          entriesTotal: 0, entriesWithData: 0,
        },
      },
      fiber: { totalGrams: null, isLow: null },
      dailyLoad: null,
      dailyLoadFoods: [],
      coverage: null,
      entriesComplete: 0,
      source: "none",
      provider: null,
    };
  }

  // ---------- per-entry accumulation ----------
  let totalCalories = 0;
  let totalCarbs = 0;

  const sugarsList: (number | null)[] = [];
  const fiberList: (number | null)[] = [];
  const fatList: (number | null)[] = [];
  const proteinList: (number | null)[] = [];

  const saturatedList: (number | null)[] = [];
  const monoList: (number | null)[] = [];
  const polyList: (number | null)[] = [];
  const omega3List: (number | null)[] = [];
  const omega6List: (number | null)[] = [];
  const transList: (number | null)[] = [];
  const cholesterolList: (number | null)[] = [];
  const sodiumList: (number | null)[] = [];
  const alcoholList: (number | null)[] = [];

  const animalProteinList: (number | null)[] = [];
  const vegetalProteinList: (number | null)[] = [];

  let novaKcal = 0;
  let novaKcal4 = 0;
  let novaEntriesWithCategory = 0;
  let novaCount1 = 0, novaCount2 = 0, novaCount3 = 0, novaCount4 = 0, novaCountUnknown = 0;
  const novaFoods: { name: string; group: number; kcal: number }[] = [];

  // Sector 4 counts with null tracking
  let processedMeatTrue = 0;
  let processedMeatNull = 0;
  let redMeatTrue = 0;
  let redMeatNull = 0;
  let highTempCookingTrue = 0;
  let highTempCookingNull = 0;
  let ultraProcessedTrue = 0;
  let ultraProcessedNull = 0;
  let alcoholTrue = 0;
  let alcoholNull = 0;
  let mercuryTrue = 0;
  let mercuryNull = 0;
  let additiviTrue = 0;
  let additiviNull = 0;

  let entriesWithFullData = 0;
  let sector4WithData = 0;

  const cookingSources = { declared: 0, ai: 0, unknown: 0 };

  for (const entry of entries) {
    const { food, servings, cooking_method } = entry;
    const s = servings ?? 1;
    const entryKcal = food.calories * s;

    totalCalories += entryKcal;
    totalCarbs += food.carbs * s;

    sugarsList.push(food.sugar == null ? null : food.sugar * s);
    fiberList.push(food.fiber == null ? null : food.fiber * s);
    fatList.push(food.fat == null ? null : food.fat * s);
    proteinList.push(food.protein == null ? null : food.protein * s);

    saturatedList.push(food.saturated_fat == null ? null : food.saturated_fat * s);
    monoList.push(food.monounsaturated_fat == null ? null : food.monounsaturated_fat * s);
    polyList.push(food.polyunsaturated_fat == null ? null : food.polyunsaturated_fat * s);
    omega3List.push(food.omega_3 == null ? null : food.omega_3 * s);
    omega6List.push(food.omega_6 == null ? null : food.omega_6 * s);
    transList.push(food.trans_fat == null ? null : food.trans_fat * s);
    cholesterolList.push(food.cholesterol == null ? null : food.cholesterol * s);
    sodiumList.push(food.sodium == null ? null : food.sodium * s);
    alcoholList.push(food.alcohol == null ? null : food.alcohol * s);

    animalProteinList.push(food.animal_protein == null ? null : food.animal_protein * s);
    vegetalProteinList.push(food.vegetal_protein == null ? null : food.vegetal_protein * s);

    // NOVA: single accumulation — counts, kcal share (3-4 e 4-only) e lista
    // alimenti NOVA>=3 (fonte unica per dettaglio, riepilogo e consigli).
    if (food.nova_group == null) {
      novaCountUnknown++;
    } else {
      novaEntriesWithCategory++;
      if (food.nova_group === 1) novaCount1++;
      else if (food.nova_group === 2) novaCount2++;
      else if (food.nova_group === 3) novaCount3++;
      else {
        novaCount4++;
        novaKcal4 += entryKcal;
      }
      if (food.nova_group >= 3) {
        novaKcal += entryKcal;
        novaFoods.push({ name: food.name, group: food.nova_group, kcal: entryKcal });
      }
    }

    // High-temperature cooking (Sector 4)
    if (cooking_method == null) {
      highTempCookingNull++;
      cookingSources.unknown++;
    } else {
      cookingSources[entry.cooking_source === "declared" ? "declared" : "ai"]++;
      if (isHighTempCooking(cooking_method)) highTempCookingTrue++;
    }

    // Flags for harmful substances scores (Sector 4)
    if (food.carne_lavorata === true) processedMeatTrue++;
    else if (food.carne_lavorata == null) processedMeatNull++;

    if (food.carne_rossa === true) redMeatTrue++;
    else if (food.carne_rossa == null) redMeatNull++;

    if (food.nova_group === 4) ultraProcessedTrue++;
    else if (food.nova_group == null) ultraProcessedNull++;

    if (food.alcol === true) alcoholTrue++;
    else if (food.alcol == null) alcoholNull++;

    if (food.pesce_alto_mercurio === true) mercuryTrue++;
    else if (food.pesce_alto_mercurio == null) mercuryNull++;

    if (food.additivi === true) additiviTrue++;
    else if (food.additivi == null) additiviNull++;

    // Coverage: entry complete only if all key health fields are present
    if (
      food.sugar != null &&
      food.fiber != null &&
      food.saturated_fat != null &&
      food.category != null &&
      food.nova_group != null &&
      food.sodium != null &&
      food.animal_protein != null &&
      food.vegetal_protein != null
    ) {
      entriesWithFullData++;
    }

    // Sector 4: entry has sufficient data if the 7 food-level indicators are
    // known. cooking_method is intentionally NOT required: it lives on food_log
    // (often missing for legacy entries) and the highTempCooking score already
    // reports "non valutabile" when it is absent, so coverage should not be
    // unfairly penalized by its absence.
    if (
      food.carne_lavorata != null &&
      food.carne_rossa != null &&
      food.nova_group != null &&
      food.alcol != null &&
      food.pesce_alto_mercurio != null &&
      food.additivi != null &&
      food.sodium != null
    ) {
      sector4WithData++;
    }
  }

  // ---------- totals ----------
  const totalSugars = sumOrNull(sugarsList);
  const totalFiber = sumOrNull(fiberList);
  const totalFat = sumOrNull(fatList);
  const totalProtein = sumOrNull(proteinList);

  const totalSaturated = sumOrNull(saturatedList);
  const totalMono = sumOrNull(monoList);
  const totalPoly = sumOrNull(polyList);
  const totalOmega3 = sumOrNull(omega3List);
  const totalOmega6 = sumOrNull(omega6List);
  const totalTrans = sumOrNull(transList);
  const totalCholesterol = sumOrNull(cholesterolList);
  const totalSodium = sumOrNull(sodiumList);
  const totalAlcohol = sumOrNull(alcoholList);

  const totalAnimal = sumOrNull(animalProteinList);
  const totalVegetal = sumOrNull(vegetalProteinList);

  // ---------- derived ----------
  const sugarKcal = (totalSugars ?? 0) * 4;
  const fatKcal = (totalFat ?? 0) * 9;
  const proteinKcal = (totalProtein ?? 0) * 4;

  const sugarKcalPercent =
    totalCalories > 0 && totalSugars != null ? (sugarKcal / totalCalories) * 100 : null;
  const fatKcalPercent =
    totalCalories > 0 && totalFat != null ? (fatKcal / totalCalories) * 100 : null;
  const proteinKcalPercent =
    totalCalories > 0 && totalProtein != null ? (proteinKcal / totalCalories) * 100 : null;
  const novaKcalPercent =
    novaEntriesWithCategory > 0 && totalCalories > 0 ? (novaKcal / totalCalories) * 100 : null;
  const nova4KcalPercent =
    novaEntriesWithCategory > 0 && totalCalories > 0 ? (novaKcal4 / totalCalories) * 100 : null;

  // Simple / complex carbs split
  let simpleGrams: number | null = null;
  let complexGrams: number | null = null;
  if (totalSugars != null) {
    simpleGrams = totalSugars;
    complexGrams = totalCarbs - totalSugars;
    if (complexGrams < 0) complexGrams = 0;
  }

  // Protein mix
  let mix: "animal" | "vegetal" | "mixed" | null = null;
  if (totalAnimal == null && totalVegetal == null) {
    mix = "mixed";
  } else {
    const a = totalAnimal ?? 0;
    const v = totalVegetal ?? 0;
    if (a === 0 && v === 0) {
      mix = "mixed";
    } else if (a > v * 1.5) {
      mix = "animal";
    } else if (v > a * 1.5) {
      mix = "vegetal";
    } else {
      mix = "mixed";
    }
  }

  // ---------- sector-4 scores (0-3) with motivi ----------
  const processedMeat = scoreWithNulls(
    processedMeatTrue, processedMeatNull,
    entries.length - processedMeatNull,
    "nessuna carne lavorata rilevata",
    (c) => `${c} voce${c > 1 ? "ci" : ""} di carne lavorata`,
  );
  const redMeat = scoreWithNulls(
    redMeatTrue, redMeatNull,
    entries.length - redMeatNull,
    "nessuna carne rossa rilevata",
    (c) => `${c} voce${c > 1 ? "ci" : ""} di carne rossa`,
  );
  // Cotture: il dato mancante NON è assenza di rischio — il motivo distingue
  // esplicitamente "metodo sconosciuto" da "metodo noto non intenso". In questa
  // versione il metodo di cottura non si dichiara a mano: è sempre stimato dall'AI.
  const cookingSourceNote =
    cookingSources.declared === 0 ? "metodi stimati dall'AI" : "metodi in parte stimati dall'AI";
  const highTempCooking = scoreWithNulls(
    highTempCookingTrue, highTempCookingNull,
    entries.length - highTempCookingNull,
    highTempCookingNull > 0
      ? `nessuna cottura intensa tra le ${entries.length - highTempCookingNull} voci con metodo noto (${highTempCookingNull} senza dato) · ${cookingSourceNote}`
      : `nessuna cottura intensa · ${cookingSourceNote}`,
    (c) => `${c} cottura${c > 1 ? "i" : ""} intensa${c > 1 ? "e" : ""} ad alta temperatura · ${cookingSourceNote}`,
  );
  const ultraProcessed = scoreWithNulls(
    ultraProcessedTrue, ultraProcessedNull,
    entries.length - ultraProcessedNull,
    "nessun ultra-processato (NOVA 4) rilevato",
    (c) => `${c} alimento${c > 1 ? "i ultra-processati (NOVA 4)" : " ultra-processato (NOVA 4)"}`,
  );
  const alcohol = scoreWithNulls(
    alcoholTrue, alcoholNull,
    entries.length - alcoholNull,
    "nessun alcol rilevato",
    (c) => `${c} voce${c > 1 ? "ci" : ""} con alcol`,
  );
  const sodiumValue = sodiumScore(totalSodium);
  const sodiumWithData = sodiumList.filter((v) => v != null).length;
  const sodium = score03(
    sodiumValue,
    totalSodium == null
      ? "sodio non disponibile"
      : totalSodium < 2000
        ? `sodio ${Math.round(totalSodium)} mg (entro soglia)`
        : `sodio ${Math.round(totalSodium)} mg (sopra soglia)`,
    `${sodiumWithData}/${entries.length}`,
  );
  // Mercurio: l'assenza vale solo sulle voci con dato; le restanti vanno
  // dichiarate "senza dato" (come per le cotture), non come assenza di rischio.
  const mercury = scoreWithNulls(
    mercuryTrue, mercuryNull,
    entries.length - mercuryNull,
    mercuryNull > 0
      ? `nessun pesce alto mercurio tra le ${entries.length - mercuryNull} voci valutate (${mercuryNull} senza dato)`
      : "nessun pesce alto mercurio rilevato",
    (c) => `${c} voce${c > 1 ? "ci" : ""} di pesce alto mercurio`,
  );
  const additivi = scoreWithNulls(
    additiviTrue, additiviNull,
    entries.length - additiviNull,
    "nessun additivo rilevato",
    (c) => `${c} voce${c > 1 ? "ci" : ""} con additivi`,
  );

  const sector4Scores = [
    processedMeat, redMeat, highTempCooking, ultraProcessed,
    alcohol, sodium, mercury, additivi,
  ];
  const knownSector4Scores = sector4Scores.filter((s) => s.value != null);
  const maxSector4Score =
    knownSector4Scores.length > 0
      ? Math.max(...knownSector4Scores.map((s) => s.value!))
      : null;

  // ---------- triglycerides ----------
  const trig = triglyceridesRisk(
    totalFat, totalSaturated, totalTrans, totalSugars, totalCarbs, totalAlcohol,
  );

  // ---------- daily load (sector 4 scores only) ----------
  const dailyLoad = dailyLoadFromScores(sector4Scores);

  const dailyLoadFoods =
    dailyLoad !== "low" && dailyLoad !== null
      ? [...new Set(entries.map((e) => e.food.name))]
      : [];

  // ---------- coverage ----------
  const coverage = entriesWithFullData / entries.length;

  return {
    totals: {
      calories: totalCalories,
      carbs: totalCarbs,
      protein: totalProtein ?? 0,
      fat: totalFat ?? 0,
      fiber: totalFiber ?? 0,
    },
    sectors: {
      sugars: {
        totalGrams: totalSugars,
        simpleGrams,
        complexGrams,
        glycemicClass: glycemicClass(simpleGrams, totalCarbs),
        kcalPercentage: sugarKcalPercent,
        isHigh:
          sugarKcalPercent != null
            ? sugarKcalPercent > NUTRITION_TARGETS.SUGARS_MAX_PERCENT
            : null,
        entriesTotal: entries.length,
        entriesWithData: sugarsList.filter((v) => v != null).length,
      },
      lipids: {
        totalGrams: totalFat,
        saturatedGrams: totalSaturated,
        monounsaturatedGrams: totalMono,
        polyunsaturatedGrams: totalPoly,
        omega3Grams: totalOmega3,
        omega6Grams: totalOmega6,
        transGrams: totalTrans,
        cholesterolMg: totalCholesterol,
        triglyceridesIndicator: trig.level,
        triglyceridesFactors: trig.factors,
        kcalPercentage: fatKcalPercent,
        isHigh:
          fatKcalPercent != null ? fatKcalPercent > NUTRITION_TARGETS.FAT_MAX_PERCENT : null,
        entriesTotal: entries.length,
        entriesWithData: fatList.filter((v) => v != null).length,
      },
      proteins: {
        totalGrams: totalProtein,
        animalGrams: totalAnimal,
        vegetalGrams: totalVegetal,
        gramsPerKg:
          weightKg != null && weightKg > 0 && totalProtein != null
            ? totalProtein / weightKg
            : null,
        kcalPercentage: proteinKcalPercent,
        mix,
        isLow:
          proteinKcalPercent != null
            ? proteinKcalPercent < NUTRITION_TARGETS.PROTEIN_MIN_PERCENT
            : null,
        entriesTotal: entries.length,
        entriesWithData: proteinList.filter((v) => v != null).length,
      },
      harmful_substances: {
        processedMeat,
        redMeat,
        highTempCooking,
        ultraProcessed,
        alcohol,
        sodium,
        mercury,
        additivi,
        novaScore: novaKcalPercent,
        nova4KcalPercent,
        novaCounts: { g1: novaCount1, g2: novaCount2, g3: novaCount3, g4: novaCount4, unknown: novaCountUnknown },
        novaFoods,
        cookingSources,
        isHigh:
          maxSector4Score != null ? maxSector4Score >= 2 : null,
        entriesTotal: entries.length,
        entriesWithData: sector4WithData,
      },
    },
    fiber: {
      totalGrams: totalFiber,
      isLow:
        totalFiber != null && totalCalories > 0
          ? totalFiber < NUTRITION_TARGETS.FIBER_MIN_GRAMS
          : null,
    },
    dailyLoad,
    dailyLoadFoods,
    coverage,
    entriesComplete: entriesWithFullData,
    source: entries.every((e) => e.source === "ai")
      ? "ai"
      : entries.every((e) => e.source === "user")
        ? "user"
        : "mixed",
    provider: entries[0].provider ?? null,
  };
}
