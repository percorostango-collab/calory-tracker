"use client";

import React, { useState, useEffect, useRef } from "react";
import { X, Utensils, Flame, Droplet, Wheat, Sparkles, Camera, Loader2, Check, AlertCircle, Trash2, ChevronLeft, ChevronRight, Scale } from "lucide-react";
import { DailyLogData, FoodEntry, AiItem } from "@/lib/types";
import { format, addDays, subDays, parseISO, isSameDay } from "date-fns";
import { it } from "date-fns/locale";
import DailyReport from "./health/DailyReport";
import { getUserWeight, saveWeight } from "@/lib/settings-actions";
import type { DailyHealthMetrics } from "@/lib/health/types";
import type { Recommendation } from "@/lib/health/recommendations";

interface CalorieTrackerProps {
  initialData: DailyLogData;
  today: string;
  formattedDate: string;
}

const CALORIE_GOAL = 2500;

export default function CalorieTracker({ initialData, today: initialToday, formattedDate: initialFormattedDate }: CalorieTrackerProps) {
  const [selectedDate, setSelectedDate] = useState(initialToday);
  const [entries, setEntries] = useState<FoodEntry[]>(initialData.entries);
  const [totals, setTotals] = useState(initialData.totals);
  const [weight, setWeight] = useState<number | null>(null);
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);

  // Load user settings (weight)
  useEffect(() => {
    getUserWeight().then(w => setWeight(w));
  }, []);

  // AI States
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);
  const [aiPreviewItems, setAiPreviewItems] = useState<AiItem[] | null>(null);
  // Incremented on every diary mutation so the health report re-fetches its
  // metrics immediately (not only when the date changes).
  const [reportRefresh, setReportRefresh] = useState(0);
  // Context needed to commit the preview with a single POST /api/entries.
  const [pendingQueryText, setPendingQueryText] = useState<string | null>(null);
  const [pendingImageFile, setPendingImageFile] = useState<File | null>(null);
  const [pendingImageNote, setPendingImageNote] = useState<string | undefined>(undefined);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const textInputRef = useRef<HTMLInputElement>(null);

  const refreshLog = async () => {
    const reloadRes = await fetch(`/api/log?date=${selectedDate}`);
    const newData = await reloadRes.json();
    setEntries(newData.entries);
    setTotals(newData.totals);
    // Diary changed -> health metrics must be recomputed on the server side.
    setReportRefresh(n => n + 1);
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
    const res = await fetch(`/api/log?date=${selectedDate}`, {
      method: "DELETE",
    });
    if (res.ok) {
      await refreshLog();
    }
  };

  const handleSaveWeight = async (newWeight: number) => {
    try {
      await saveWeight(newWeight);
      setWeight(newWeight);
      setIsWeightModalOpen(false);
    } catch (err) {
      console.error("Errore nel salvataggio del peso:", err);
    }
  };

  // AI Workflow: commit the preview with ONE POST /api/entries.
  const handleAiAddition = async () => {
    setIsAiLoading(true);
    setAiError(null);
    try {
      let res: Response;
      if (pendingImageFile) {
        const formData = new FormData();
        formData.append("image", pendingImageFile);
        if (pendingImageNote) formData.append("note", pendingImageNote);
        formData.append("date", selectedDate);
        res = await fetch("/api/entries", { method: "POST", body: formData });
      } else {
        res = await fetch("/api/entries", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ queryText: pendingQueryText ?? "", date: selectedDate }),
        });
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Inserimento fallito.");

      await refreshLog();
      setAiPreviewItems(null);
      setPendingQueryText(null);
      setPendingImageFile(null);
      setPendingImageNote(undefined);
    } catch (err: any) {
      setAiError(err.message || "Si è verificato un errore durante l'elaborazione AI.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Text Lookup (preview, non-committal)
  const handleTextLookup = async (description: string) => {
    if (!description.trim()) return;
    setIsAiLoading(true);
    setAiError(null);
    setAiPreviewItems(null);

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ queryText: description, preview: true }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Ricerca testuale fallita.");

      setAiPreviewItems(data);
      setPendingQueryText(description);
      setPendingImageFile(null);
    } catch (err: any) {
      setAiError(err.message || "Ricerca testuale fallita.");
    } finally {
      setIsAiLoading(false);
    }
  };

  // AI Image Upload (preview, non-committal)
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsAiLoading(true);
    setAiError(null);
    setAiPreviewItems(null);

    const formData = new FormData();
    formData.append("image", file);
    formData.append("preview", "1");

    try {
      const res = await fetch("/api/entries", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Analisi immagine fallita.");

      setAiPreviewItems(data);
      setPendingQueryText(null);
      setPendingImageFile(file);
      setPendingImageNote(undefined);
    } catch (err: any) {
      setAiError(err.message || "Caricamento immagine fallito.");
    } finally {
      setIsAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col items-center py-12 px-4 text-slate-900">
      <div className="w-full max-w-2xl space-y-6">

        {/* Header with Date Selector */}
        <header className="relative flex items-center justify-between bg-white p-4 rounded-3xl border border-slate-200 shadow-sm">
          <button
            onClick={() => setSelectedDate(format(subDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronLeft className="w-5 h-5 text-slate-600" />
          </button>

          <div className="text-center">
            <h1 className="text-xl font-black text-slate-900">
              {isSameDay(parseISO(selectedDate), parseISO(initialToday))
                ? "Oggi"
                : format(parseISO(selectedDate), "EEEE d MMMM", { locale: it })}
            </h1>
            <p className="text-xs font-medium text-slate-500">
              {format(parseISO(selectedDate), "d MMMM yyyy", { locale: it })}
            </p>
          </div>

          <button
            onClick={() => setSelectedDate(format(addDays(parseISO(selectedDate), 1), "yyyy-MM-dd"))}
            className="p-2 hover:bg-slate-100 rounded-full transition-colors"
          >
            <ChevronRight className="w-5 h-5 text-slate-600" />
          </button>
        </header>

        {/* Weight Button (top-right of header row) */}
        <div className="absolute top-4 right-4">
          <button
            onClick={() => setIsWeightModalOpen(true)}
            className="p-2 rounded-full bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 hover:text-blue-600 transition-all shadow-sm"
            title="Imposta peso"
          >
            <Scale className="w-5 h-5" />
          </button>
        </div>

        {/* Progress Card */}
        <div className="bg-white rounded-3xl p-6 shadow-sm border border-slate-200">
          <div className="flex justify-between items-end">
            <div>
              <p className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Calorie Oggi</p>
              <h2 className="text-4xl font-black text-slate-900">
                {Math.round(totals.calories)} <span className="text-lg font-normal text-slate-400">kcal</span>
              </h2>
            </div>
          </div>
        </div>

        {/* Nutrient Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <SummaryCard label="Proteine" value={totals.protein.toFixed(1)} icon={<Utensils className="w-4 h-4 text-blue-500" />} unit="g" />
          <SummaryCard label="Carboidrati" value={totals.carbs.toFixed(1)} icon={<Wheat className="w-4 h-4 text-yellow-500" />} unit="g" />
          <SummaryCard label="Grassi" value={totals.fat.toFixed(1)} icon={<Droplet className="w-4 h-4 text-pink-500" />} unit="g" />
          <SummaryCard label="Calorie" value={Math.round(totals.calories)} icon={<Flame className="w-4 h-4 text-orange-500" />} unit="kcal" />
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
            <div className="bg-white rounded-3xl p-6 shadow-md border-2 border-blue-100 space-y-4 animate-in zoom-in-95 duration-300">
              <div className="flex items-center gap-2 text-blue-600 font-bold">
                <Sparkles className="w-5 h-5" />
                <span>Suggerimenti AI</span>
              </div>
              <div className="space-y-3">
                {aiPreviewItems.map((item, idx) => (
                  <div key={idx} className="flex items-center justify-between p-4 bg-slate-50 rounded-2xl border border-slate-100">
                    <div className="flex flex-col">
                      <span className="font-bold text-slate-900">{item.name}</span>
                      <span className="text-xs text-slate-500">
                        {item.protein}g P • {item.servingSize || (item.serving_grams ? `${item.serving_grams} g st.` : "dato non disponibile")}
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
                        title="Rimuovi"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <button
                onClick={() => handleAiAddition()}
                disabled={isAiLoading || (aiPreviewItems?.length ?? 0) === 0}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-all disabled:opacity-50 shadow-lg shadow-blue-100"
              >
                {isAiLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                Aggiungi
              </button>
              <button
                onClick={() => setAiPreviewItems(null)}
                className="w-full py-2 text-sm font-medium text-slate-400 hover:text-slate-600 transition-colors"
              >
                Annulla
              </button>
            </div>
          )}

          {/* Input Methods */}
          {!aiPreviewItems && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Text Input */}
              <div className="bg-white rounded-3xl p-4 shadow-sm border border-slate-200 space-y-3">
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

              {/* Photo Input */}
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={isAiLoading}
                className="flex items-center justify-center gap-3 px-6 py-4 rounded-3xl bg-white border-2 border-dashed border-slate-200 text-slate-600 hover:border-blue-400 hover:bg-blue-50 transition-all group disabled:opacity-50"
              >
                {isAiLoading ? <Loader2 className="w-6 h-6 animate-spin text-blue-600" /> : <Camera className="w-6 h-6 text-slate-400 group-hover:text-blue-500" />}
                <span className="font-bold">Analizza Foto</span>
                <input
                  type="file"
                  ref={fileInputRef}
                  className="hidden"
                  accept="image/*"
                  onChange={handleImageUpload}
                />
              </button>
            </div>
          )}

          {isAiLoading && !aiPreviewItems && (
            <div className="flex items-center justify-center py-4 gap-2 text-blue-600 font-bold text-sm animate-pulse">
              <Loader2 className="w-5 h-5 animate-spin" />
              L'intelligenza artificiale sta analizzando...
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
              <div className="p-16 text-center space-y-4">
                <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
                  <Utensils className="w-10 h-10 text-slate-200" />
                </div >
                <p className="text-slate-400 font-medium">Il tuo diario è vuoto. Inizia una ricerca!</p>
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

        {/* Health Report Section */}
        <section className="space-y-4 pb-12">
          <DailyReportView date={selectedDate} weight={weight} today={initialToday} refreshKey={reportRefresh} />
        </section>

        {/* Weight Modal */}
        {isWeightModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm bg-white rounded-3xl p-6 shadow-2xl space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
                  <Scale className="w-5 h-5 text-blue-500" />
                  Il tuo peso
                </h3>
                <button
                  onClick={() => setIsWeightModalOpen(false)}
                  className="p-1.5 text-slate-400 hover:text-slate-600 hover:bg-slate-100 rounded-full transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="text-sm text-slate-500">
                Opzionale: usato solo per calcolare i g di proteine per kg. Se lasciato vuoto, non viene mostrato.
              </p>
              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  const val = parseFloat((e.target as HTMLFormElement).elements.namedItem("weight") as unknown as string);
                  if (!Number.isFinite(val) || val <= 0) return;
                  await handleSaveWeight(val);
                }}
                className="space-y-4"
              >
                <input
                  name="weight"
                  type="number"
                  step="0.1"
                  min="0.1"
                  defaultValue={weight ?? ""}
                  placeholder="es. 70"
                  className="w-full px-4 py-3 rounded-2xl bg-slate-50 border border-slate-200 focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all text-base font-bold outline-none"
                />
                <div className="flex gap-3">
                  <button
                    type="button"
                    onClick={() => setIsWeightModalOpen(false)}
                    className="flex-1 py-2.5 rounded-2xl border border-slate-200 text-slate-500 text-sm font-bold hover:bg-slate-50 transition-colors"
                  >
                    Annulla
                  </button>
                  <button
                    type="submit"
                    className="flex-1 py-2.5 rounded-2xl bg-blue-600 text-white text-sm font-bold hover:bg-blue-700 transition-colors"
                  >
                    Salva
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {/* Weight Button (top-right of header row) */}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon, unit }: { label: string; value: string | number; icon: React.ReactNode; unit: string }) {
  return (
    <div className="p-4 rounded-2xl bg-white border border-slate-200 shadow-sm flex flex-col items-center text-center space-y-1">
      <div className="p-2 bg-slate-50 rounded-xl mb-1">
        {icon}
      </div >
      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">{label}</p>
      <div className="text-lg font-black text-slate-900">
        {value} <span className="text-xs font-medium text-slate-400">{unit}</span >
      </div >
    </div >
  );
}

function FoodLogEntryRow({ entry, onDelete }: { entry: FoodEntry; onDelete: (id: number) => void }) {
  const portion = entry.requested_grams != null ? `${Math.round(entry.requested_grams)} g` : "porzione";
  const kcal = entry.calculated_calories != null ? `${Math.round(entry.calculated_calories)} kcal` : "kcal: dato non disponibile";
  return (
    <div className="flex items-center justify-between p-5 hover:bg-slate-50 transition-colors">
      <div className="flex flex-col">
        <span className="font-bold text-slate-900 text-base">{entry.name ?? entry.query_text}</span>
        <span className="text-sm text-slate-500 font-medium">
          {portion} • {kcal}
        </span>
      </div>
      <button
        onClick={() => onDelete(entry.id)}
        className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-all"
      >
        <X className="w-5 h-5" />
      </button>
    </div>
  );
}

function DailyReportView({ date, weight, today, refreshKey }: { date: string; weight: number | null; today: string; refreshKey: number }) {
  const [metrics, setMetrics] = useState<DailyHealthMetrics | null>(null);
  const [recommendations, setRecommendations] = useState<Recommendation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/health/metrics?date=${date}`);
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || `Errore HTTP ${res.status}`);
        }

        if (data && data.metrics) {
          setMetrics(data.metrics);
          setRecommendations(data.recommendations || []);
        } else {
          throw new Error("Risposta API incompleta: mancano i dati metrics.");
        }
      } catch (e) {
        console.error("Error loading metrics:", e);
        setError(e instanceof Error ? e.message : "Errore sconosciuto nel caricamento dei dati.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, [date, refreshKey]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 gap-3 text-slate-400 font-medium animate-pulse">
        <Loader2 className="w-5 h-5 animate-spin" />
        Analisi salute in corso...
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="p-8 text-center bg-red-50 rounded-3xl border border-dashed border-red-200 text-red-600">
        <AlertCircle className="w-8 h-8 mx-auto mb-3 opacity-50" />
        <p className="font-bold">Dati del resoconto non disponibili</p>
        <p className="text-sm opacity-80">{error || "Nessun dato trovato per questa data."}</p>
      </div>
    );
  }

  return (
    <DailyReport
      date={date}
      today={today}
      metrics={metrics}
      recommendations={recommendations}
    />
  );
}
