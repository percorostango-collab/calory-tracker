"use client";

import React, { useState, useEffect } from "react";
import { Search, Plus, X, Utensils, Flame, Droplet, Wheat } from "lucide-react";
import { Food, DailyLogData } from "@/lib/types";

interface CalorieTrackerProps {
  initialData: DailyLogData;
  initialFoods: Food[];
  today: string;
  formattedDate: string;
}

export default function CalorieTracker({ initialData, today, formattedDate }: CalorieTrackerProps) {
  const [entries, setEntries] = useState(initialData.entries);
  const [totals, setTotals] = useState(initialData.totals);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Food[]>([]);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(async () => {
      if (searchQuery.trim()) {
        const res = await fetch(`/api/foods?q=${encodeURIComponent(searchQuery)}`);
        const data = await res.json();
        setSearchResults(data);
      } else {
        setSearchResults([]);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const refreshLog = async () => {
    const reloadRes = await fetch(`/api/log?date=${today}`);
    const newData = await reloadRes.json();
    setEntries(newData.entries);
    setTotals(newData.totals);
  };

  const addFood = async (food: Food) => {
    const res = await fetch("/api/log", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ foodId: food.id, servings: 1, date: today }),
    });
    if (res.ok) {
      await refreshLog();
      setSearchQuery("");
      setSearchResults([]);
    }
  };

  const removeFood = async (id: number) => {
    const res = await fetch(`/api/log/${id}?id=${id}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await refreshLog();
    }
  };

  return (
    <div className="min-h-screen bg-background flex flex-col items-center py-12 px-4">
      <div className="w-full max-w-2xl space-y-8">
        {/* Header */}
        <header className="text-center space-y-1">
          <h1 className="text-4xl font-extrabold tracking-tight text-foreground">Daily Calorie Tracker</h1>
          <p className="text-lg text-muted-foreground">
            {formattedDate}
          </p>
        </header>

        {/* Daily Summary Card */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Calories" value={Math.round(totals.calories)} icon={<Flame className="w-5 h-5 text-orange-500" />} unit="kcal" />
          <SummaryCard label="Protein" value={totals.protein.toFixed(1)} icon={<Utensils className="w-5 h-5 text-blue-500" />} unit="g" />
          <SummaryCard label="Carbs" value={totals.carbs.toFixed(1)} icon={<Wheat className="w-5 h-5 text-yellow-500" />} unit="g" />
          <SummaryCard label="Fat" value={totals.fat.toFixed(1)} icon={<Droplet className="w-5 h-5 text-pink-500" />} unit="g" />
        </div>

        {/* Search Section */}
        <div className="relative space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search for foods..."
              className="w-full pl-11 pr-4 py-3 rounded-xl border border-input bg-card text-foreground shadow-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {/* Search Results (in normal document flow so it pushes content below, not over it) */}
          {searchResults.length > 0 && (
            <div className="w-full bg-card border rounded-xl shadow-xl max-h-72 overflow-auto">
              {searchResults.map((food) => (
                <FoodSearchItem key={food.id} food={food} onAdd={addFood} />
              ))}
            </div>
          )}
        </div>

        {/* Food Log Section */}
        <div className="space-y-4">
          <h2 className="text-2xl font-bold text-foreground flex items-center gap-2">
            Today's Log
            <span className="text-sm font-medium text-muted-foreground bg-secondary px-2 py-0.5 rounded-full">
              {entries.length}
            </span>
          </h2>

          <div className="rounded-2xl border bg-card text-card-foreground shadow-sm overflow-hidden">
            {entries.length === 0 ? (
              <div className="p-12 text-center text-muted-foreground space-y-4">
                <div className="w-16 h-16 bg-secondary/50 rounded-full flex items-center justify-center mx-auto">
                  <Utensils className="w-8 h-8 opacity-40" />
                </div>
                <p className="text-lg">Your log is empty. Start by searching for food!</p>
              </div>
            ) : (
              <div className="divide-y divide-border">
                {entries.map((entry) => (
                  <FoodLogEntryRow key={entry.id} entry={entry} onDelete={removeFood} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, unit }: { label: string; value: string | number; icon: React.ReactNode; unit: string }) {
  return (
    <div className="p-4 rounded-2xl border bg-card shadow-sm flex flex-col items-center text-center space-y-2 transition-all hover:shadow-md">
      <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider">
        {icon}
        {label}
      </div>
      <div className="text-xl font-extrabold text-foreground">
        {value} <span className="text-sm font-medium text-muted-foreground">{unit}</span>
      </div>
    </div>
  );
}

function FoodSearchItem({ food, onAdd }: { food: Food; onAdd: (f: Food) => void }) {
  return (
    <div
      className="flex items-center justify-between p-4 hover:bg-accent cursor-pointer transition-colors group"
      onClick={() => onAdd(food)}
    >
      <div className="flex flex-col">
        <span className="font-semibold text-foreground">{food.name}</span>
        <span className="text-sm text-muted-foreground">
          {food.calories} kcal • {food.protein}g P • {food.servingSize}
        </span>
      </div>
      <button
        className="p-2 rounded-full bg-primary text-primary-foreground opacity-0 group-hover:opacity-100 transition-all transform group-hover:scale-110"
        onClick={(e) => {
          e.stopPropagation();
          onAdd(food);
        }}
      >
        <Plus className="w-5 h-5" />
      </button>
    </div>
  );
}

function FoodLogEntryRow({ entry, onDelete }: { entry: any; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-accent/50 transition-colors">
      <div className="flex flex-col">
        <span className="font-semibold text-foreground">{entry.food.name}</span>
        <span className="text-sm text-muted-foreground">
          {entry.servings}x {entry.food.servingSize} • {Math.round(entry.food.calories * entry.servings)} kcal
        </span>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-full transition-all"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}
