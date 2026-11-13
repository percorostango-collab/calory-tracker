export interface Food {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
  sugar?: number | null;
  fiber?: number | null;
  category?: string | null;
  nova_group?: number | null;
  is_healthy_flag?: number | null;
  source?: string | null;
  saturated_fat?: number | null;
  monounsaturated_fat?: number | null;
  polyunsaturated_fat?: number | null;
  omega_3?: number | null;
  omega_6?: number | null;
  trans_fat?: number | null;
  cholesterol?: number | null;
  sodium?: number | null;
  animal_protein?: number | null;
  vegetal_protein?: number | null;
  alcohol?: number | null;
  carne_lavorata?: boolean | null;
  carne_rossa?: boolean | null;
  alcol?: boolean | null;
  pesce_alto_mercurio?: boolean | null;
  additivi?: boolean | null;
}

export type NewFood = Omit<Food, "id"> & {
  /**
   * Transient AI field: carried from the API response to addLogEntry and
   * written to food_log.cooking_method — never to the foods table.
   */
  cooking_method?: string | null;
};

export interface LogEntry {
  id: number;
  servings: number;
  loggedAt: string;
  food: Food;
  cooking_method?: string | null;
}

export interface DailyLogData {
  entries: LogEntry[];
  totals: {
    calories: number;
    protein: number;
    carbs: number;
    fat: number;
  };
}

export interface FoodSearchResult {
  id: number;
  name: string;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  servingSize: string;
}
