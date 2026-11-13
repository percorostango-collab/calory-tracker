import type { HealthEntry, DailyHealthMetrics, Score03 } from "./types";
import { NUTRITION_TARGETS } from "./targets";

function scoreFromCount(count: number): 0 | 1 | 2 | 3 {
  if (count >= 3) return 3;
  if (count === 2) return 2;
  if (count === 1) return 1;
  return 0;
}

function score03(value: 0 | 1 | 2 | 3 | null, motivo: string): Score03 {
  return { value, motivo };
}

/**
 * Calcola un punteggio 0-3 tracciando dati mancanti.
 * Se ci sono dati null e nessun valore positivo, il punteggio è null (non valutabile).
 */
function scoreWithNulls(
  trueCount: number,
  nullCount: number,
  zeroMotivo: string,
  positiveMotivo: (count: number) => string,
): Score03 {
  if (nullCount > 0 && trueCount === 0) {
    return score03(null, "dato non disponibile per alcune voci");
  }
  const value = scoreFromCount(trueCount);
  return score03(
    value,
    trueCount === 0 ? zeroMotivo : positiveMotivo(trueCount),
  );
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
        },
        lipids: {
          totalGrams: null, saturatedGrams: null, monounsaturatedGrams: null,
          polyunsaturatedGrams: null, omega3Grams: null, omega6Grams: null,
          transGrams: null, cholesterolMg: null,
          triglyceridesIndicator: null, triglyceridesFactors: [],
          kcalPercentage: null, isHigh: null,
        },
        proteins: {
          totalGrams: null, animalGrams: null, vegetalGrams: null,
          gramsPerKg: null, kcalPercentage: null, mix: null, isLow: null,
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
          isHigh: null,
        },
      },
      fiber: { totalGrams: null, isLow: null },
      dailyLoad: null,
      dailyLoadFoods: [],
      coverage: null,
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
  let novaEntriesWithCategory = 0;

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

    // NOVA 3-4 share of kcal (Sector 4)
    if (food.nova_group != null) {
      novaEntriesWithCategory++;
      if (food.nova_group >= 3) {
        novaKcal += entryKcal;
      }
    }

    // High-temperature cooking (Sector 4)
    if (cooking_method == null) {
      highTempCookingNull++;
    } else if (isHighTempCooking(cooking_method)) {
      highTempCookingTrue++;
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
    "nessuna carne lavorata rilevata",
    (c) => `${c} voce${c > 1 ? "ci" : ""} di carne lavorata`,
  );
  const redMeat = scoreWithNulls(
    redMeatTrue, redMeatNull,
    "nessuna carne rossa rilevata",
    (c) => `${c} voce${c > 1 ? "ci" : ""} di carne rossa`,
  );
  const highTempCooking = scoreWithNulls(
    highTempCookingTrue, highTempCookingNull,
    "nessuna cottura ad alta temperatura rilevata",
    (c) => `${c} cottura${c > 1 ? "e ad alta temperatura" : " ad alta temperatura"}`,
  );
  const ultraProcessed = scoreWithNulls(
    ultraProcessedTrue, ultraProcessedNull,
    "nessun ultra-processato (NOVA 4) rilevato",
    (c) => `${c} alimento${c > 1 ? "i ultra-processati (NOVA 4)" : " ultra-processato (NOVA 4)"}`,
  );
  const alcohol = scoreWithNulls(
    alcoholTrue, alcoholNull,
    "nessun alcol rilevato",
    (c) => `${c} voce${c > 1 ? "ci" : ""} con alcol`,
  );
  const sodiumValue = sodiumScore(totalSodium);
  const sodium = score03(
    sodiumValue,
    totalSodium == null
      ? "sodio non disponibile"
      : totalSodium < 2000
        ? `sodio ${totalSodium} mg (entro soglia)`
        : `sodio ${totalSodium} mg (sopra soglia)`,
  );
  const mercury = scoreWithNulls(
    mercuryTrue, mercuryNull,
    "nessun pesce alto mercurio rilevato",
    (c) => `${c} voce${c > 1 ? "ci" : ""} di pesce alto mercurio`,
  );
  const additivi = scoreWithNulls(
    additiviTrue, additiviNull,
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
        isHigh:
          maxSector4Score != null ? maxSector4Score >= 2 : null,
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
  };
}
