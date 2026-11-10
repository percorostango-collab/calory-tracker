"use client";

import React, { useState, useEffect, useRef } from "react";
import {
  Search,
  Plus,
  X,
  Utensils,
  Flame,
  Droplet,
  Wheat,
  Sparkles,
  Camera,
  Loader2,
  Check,
  AlertCircle,
  Trash2,
  CameraIcon
} from "lucide-react";
import { Food, DailyLogData, NewFood, LogEntry } from "@/lib/types";

interface MobileTrackerProps {
  initialData: DailyLogData;
  initialFoods: Food[];
  today: string;
  formattedDate: string;
}

export default function MobileTracker({ initialData, today, formattedDate }: MobileTrackerProps) {
  const [entries, setEntries] = useState(initialData.entries);
  const [totals, setTotals] = useState(initialData.totals);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<Food[]>([]);

  // AI States
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreviewItems, setAiPreviewItems] = useState<NewFood[] | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

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

  const clearLog = async () => {
    if (!window.confirm("Vuoi svuotare l'intero diario di oggi?")) return;
    const res = await fetch(`/api/log?date=${today}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await refreshLog();
    }
  };

  // AI Workflow: Save then Log
  const handleAiAddition = async (foods: NewFood[]) => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      for (const food of foods) {
        const saveRes = await fetch("/api/foods/ai", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(food),
        });

        if (!saveRes.ok) throw new Error(`Errore nel salvataggio di ${food.name}.`);
        const { id } = await saveRes.json();

        const logRes = await fetch("/api/log", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ foodId: id, servings: 1, date: today }),
        });

        if (!logRes.ok) throw new Error(`Errore nel log di ${food.name}.`);
      }

      await refreshLog();
      setAiPreviewItems(null);
    } catch (err: any) {
      setAiError(err.message || "Si è verificato un errore durante l'elaborazione AI.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleTextLookup = async (description: string) => {
    if (!description.trim()) return;
    setIsAiLoading(true);
    setAiError(null);
    setAiPreviewItems(null);

    try {
      const res = await fetch("/api/nutrition/text", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ricerca testuale fallita.");

      setAiPreviewItems(data);
    } catch (err: any) {
      setAiError(err.message || "Ricerca testuale fallita.");
    } finally {
      setIsAiLoading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiLoading(true);
    setAiError(null);
    setAiPreviewItems(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/nutrition/image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analisi immagine fallita.");

      setAiPreviewItems(data);
    } catch (err: any) {
      setAiError(err.message || "Caricamento immagine fallito.");
    } finally {
      setIsAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const handleCameraCapture = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiLoading(true);
    setAiError(null);
    setAiPreviewItems(null);

    const formData = new FormData();
    formData.append("image", file);

    try {
      const res = await fetch("/api/nutrition/image", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analisi immagine fallita.");

      setAiPreviewItems(data);
    } catch (err: any) {
      setAiError(err.message || "Caricamento immagine fallito.");
    } finally {
      setIsAiLoading(false);
      if (cameraInputRef.current) cameraInputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-col w-full max-w-md mx-auto space-y-6 pb-12">
      {/* Header */}
      <header className="text-center space-y-1 pt-4">
        <h1 className="text-2xl font-bold text-slate-900">Monitoraggio Calorie</h1>
        <p className="text-slate-500 font-medium">{formattedDate}</p>
      </header>

      {/* Progress Card */}
      <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
        <div className="flex justify-between items-end">
          <div>
            <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider">Calorie Oggi</p>
            <h2 className="text-3xl font-black text-slate-900">
              {Math.round(totals.calories)} <span className="text-base font-normal text-slate-400">kcal</span>
            </h2>
          </div>
        </div>
      </div>

      {/* Nutrient Stats Grid */}
      <div className="grid grid-cols-2 gap-3">
        <SummaryCard label="Proteine" value={totals.protein.toFixed(1)} icon={<Utensils className="w-3 h-3 text-blue-500" />} unit="g" />
        <SummaryCard label="Carboidrati" value={totals.carbs.toFixed(1)} icon={<Wheat className="w-3 h-3 text-yellow-500" />} unit="g" />
        <SummaryCard label="Grassi" value={totals.fat.toFixed(1)} icon={<Droplet className="w-3 h-3 text-pink-500" />} unit="g" />
        <SummaryCard label="Calorie" value={Math.round(totals.calories)} icon={<Flame className="w-3 h-3 text-orange-500" />} unit="kcal" />
      </div>

      {/* AI Section */}
      <div className="space-y-4">
        {aiError && (
          <div className="flex items-center gap-3 p-4 rounded-2xl bg-red-50 text-red-600 border border-red-100 animate-in fade-in slide-in-from-top-2">
            <AlertCircle className="w-5 h-5" />
            <p className="text-sm font-semibold">{aiError}</p>
            <button onClick={() => setAiError(null)} className="ml-auto p-1 hover:bg-red-100 rounded-full transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* AI Results Preview */}
        {aiPreviewItems && (
          <div className="bg-white rounded-3xl p-5 shadow-md border-2 border-blue-100 space-y-4 animate-in zoom-in-95 duration-300">
            <div className="flex items-center gap-2 text-blue-600 font-bold">
              <Sparkles className="w-5 h-5" />
              <span className="text-sm">Suggerimenti AI</span>
            </div>
            <div className="space-y-3">
              {aiPreviewItems.map((item, idx) => (
                <div key={idx} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-100">
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-sm">{item.name}</span>
                    <span className="text-[10px] text-slate-500">
                      {item.protein}g P • {item.servingSize}
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="text-sm font-bold text-slate-900">
                      {item.calories} kcal
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setAiPreviewItems(prev => prev?.filter((_, i) => i !== idx) || null);
                      }}
                      className="p-1 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
            <button
              onClick={() => handleAiAddition(aiPreviewItems)}
              disabled={isAiLoading || (aiPreviewItems?.length ?? 0) === 0}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
            >
              {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
              Aggiungi
            </button>
            <button
              onClick={() => setAiPreviewItems(null)}
              className="w-full py-2 text-xs font-medium text-slate-400 hover:text-slate-600 transition-colors"
            >
              Annulla
            </button>
          </div>
        )}

        {/* Input Methods */}
        {!aiPreviewItems && (
          <div className="space-y-3">
            {/* Text Input */}
            <div className="bg-white rounded-3xl p-3 shadow-sm border border-slate-200 space-y-3">
              <div className="relative">
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <Sparkles className="w-4 h-4 text-blue-500" />
                </div>
                <input
                  ref={textInputRef}
                  type="text"
                  placeholder="Descrivi cosa hai mangiato..."
                  className="w-full pl-10 pr-4 py-3 rounded-xl bg-slate-50 border-transparent focus:bg-white focus:ring-2 focus:ring-blue-500 transition-all text-sm outline-none"
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const target = e.target as HTMLInputElement;
                      handleTextLookup(target.value);
                      target.value = '';
                    }
                  }}
                />
              </div>
              <button
                onClick={() => {
                  if (textInputRef.current) {
                    handleTextLookup(textInputRef.current.value);
                    textInputRef.current.value = '';
                  }
                }}
                disabled={isAiLoading}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" />}
                Analizza con AI
              </button>
            </div>

            {/* Photo/Camera Input Group */}
            <div className="grid grid-cols-2 gap-3">
              <button
                onClick={() => cameraInputRef.current?.click()}
                disabled={isAiLoading}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-white border-2 border-dashed border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50 transition-all group disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />}
                <span className="text-xs font-bold">Scatta Foto</span>
                <input
                  type="file"
                  ref={cameraInputRef}
                  className="hidden"
                  accept="image/*"
                  capture="environment"
                  onChange={handleCameraCapture}
                />
              </button>

              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAiLoading}
                className="flex flex-col items-center justify-center gap-2 p-4 rounded-3xl bg-white border-2 border-dashed border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50 transition-all group disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <Plus className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />}
                <span className="text-xs font-bold">Allega Foto</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </button>
            </div>
          </div>
        )}

        {/* AI Loading Spinner */}
        {isAiLoading && !aiPreviewItems && (
          <div className="flex items-center justify-center py-4 gap-2 text-blue-600 font-bold text-sm animate-pulse">
            <Loader2 className="w-5 h-5 animate-spin" />
            L'intelligenza artificiale sta analizzando...
          </div>
        )}
      </div>

      {/* Search Section */}
      <div className="space-y-4">
        <div className="relative group">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-400 group-focus-within:text-blue-500 transition-colors" />
          <input
            type="text"
            placeholder="Cerca tra i cibi..."
            className="w-full pl-12 pr-4 py-4 rounded-3xl bg-white border border-slate-200 shadow-sm focus:ring-2 focus:ring-blue-500 transition-all outline-none text-base"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {searchResults.length > 0 && (
          <div className="bg-white rounded-3xl border border-slate-200 shadow-xl max-h-64 overflow-auto overflow-hidden">
            {searchResults.map((food) => (
              <FoodSearchItem key={food.id} food={food} onAdd={addFood} />
            ))}
          </div>
        )}
      </div>

      {/* Food Log Section */}
      <div className="space-y-4 pb-12">
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-black text-slate-900 flex items-center gap-2">
            <Utensils className="w-5 h-5 text-slate-400" />
            Diario di Oggi
            <span className="text-xs font-bold text-slate-400 bg-slate-100 px-2.5 py-1 rounded-full ml-1">
              {entries.length}
            </span>
          </h2>
          {entries.length > 0 && (
            <button
              onClick={clearLog}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-50 text-red-600 text-xs font-bold hover:bg-red-100 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Svuota diario
            </button>
          )}
        </div>

        <div className="bg-white rounded-3xl border border-slate-200 shadow-sm overflow-hidden">
          {entries.length === 0 ? (
            <div className="p-12 text-center space-y-4">
              <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                <Utensils className="w-8 h-8 text-slate-200" />
              </div>
              <p className="text-slate-400 font-medium text-sm">Il tuo diario è vuoto.</p>
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {entries.map((entry) => (
                <FoodLogEntryRow key={entry.id} entry={entry} onDelete={removeFood} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, unit }: { label: string; value: string | number; icon: React.ReactNode; unit: string }) {
  return (
    <div className="p-3 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-1">
      <div className="p-1.5 bg-slate-50 rounded-lg mb-1">
        {icon}
      </div>
      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="text-base font-black text-slate-900">
        {value} <span className="text-[10px] font-medium text-slate-400">{unit}</span>
      </div>
    </div>
  );
}

function FoodSearchItem({ food, onAdd }: { food: Food; onAdd: (f: Food) => void }) {
  return (
    <div
      className="flex items-center justify-between p-4 hover:bg-blue-50/50 cursor-pointer transition-colors group"
      onClick={() => onAdd(food)}
    >
      <div className="flex flex-col">
        <span className="font-bold text-slate-900 text-sm">{food.name}</span>
        <span className="text-[10px] text-slate-500">
          {food.calories} kcal • {food.protein}g P • {food.servingSize}
        </span>
      </div>
      <button
        className="p-1.5 rounded-full bg-blue-600 text-white opacity-0 group-hover:opacity-100 transition-all transform group-hover:scale-110 shadow-lg shadow-blue-200"
        onClick={(e) => {
          e.stopPropagation();
          onAdd(food);
        }}
      >
        <Plus className="w-4 h-4" />
      </button>
    </div>
  );
}

function FoodLogEntryRow({ entry, onDelete }: { entry: LogEntry; onDelete: (id: number) => void }) {
  return (
    <div className="flex items-center justify-between p-4 hover:bg-slate-50 transition-colors">
      <div className="flex flex-col">
        <span className="font-bold text-slate-900 text-sm">{entry.food.name}</span>
        <span className="text-xs text-slate-500 font-medium">
          {entry.servings}x {entry.food.servingSize} • {Math.round(entry.food.calories * entry.servings)} kcal
        </span>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="p-1.5 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}
