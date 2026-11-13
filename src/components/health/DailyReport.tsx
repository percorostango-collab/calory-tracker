import { LucideIcon, Utensils, Droplet, Wheat, Sparkles, AlertCircle, Target, Info, AlertTriangle, Award } from "lucide-react";
import { DailyHealthMetrics } from "@/lib/health/types";
import type { Recommendation } from "@/lib/health/recommendations";

interface DailyReportProps {
  date: string;
  today: string;
  metrics: DailyHealthMetrics;
  recommendations: Recommendation[];
}

/**
 * Card for individual sector metrics
 */
function SectorCard({
  label,
  value,
  target,
  icon: Icon,
  colorClass,
  status,
  subText
}: {
  label: string;
  value: string | number;
  target?: string;
  icon: LucideIcon;
  colorClass: string;
  status: "normal" | "warning" | "high" | "low" | "unknown";
  subText?: string;
}) {
  const statusColors = {
    normal: "text-slate-600",
    warning: "text-amber-600",
    high: "text-red-600",
    low: "text-blue-600",
    unknown: "text-slate-400"
  };

  const bgColors = {
    normal: "bg-slate-50",
    warning: "bg-amber-50",
    high: "bg-red-50",
    low: "bg-blue-50",
    unknown: "bg-slate-50"
  };

  return (
    <div className={`p-4 rounded-2xl border transition-all ${bgColors[status]} ${status !== 'normal' ? 'border-current opacity-90' : 'border-slate-200 shadow-sm'}`}>
      <div className="flex items-center justify-between mb-2">
        <div className={`p-2 rounded-xl bg-white shadow-sm ${colorClass}`}>
          <Icon className="w-4 h-4" />
        </div >
        {status !== "normal" && (
          <span className={`text-[10px] font-bold uppercase tracking-wider ${statusColors[status]}`}>
            {status === "high" ? "Elevato" : status === "low" ? "Basso" : status === "unknown" ? "N/D" : "Attenzione"}
          </span >
        )}
      </div >
      <p className="text-xs font-bold text-slate-500 uppercase tracking-wider">{label}</p>
      <div className="flex items-baseline gap-1 mt-1">
        <span className={`text-xl font-black ${statusColors[status]}`}>{value}</span >
        {target && <span className="text-[10px] font-medium text-slate-400">/ {target}</span >}
      </div >
      {subText && <p className="text-[10px] text-slate-500 mt-1 font-medium">{subText}</p>}
    </div >
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
        </div >
      </div >
      <div className="space-y-2">
        <p className="text-sm font-semibold">Azione: <span className="font-normal">{rec.azione}</span></p>
        {rec.alternative && (
          <div className="flex flex-wrap gap-2 mt-2">
            {rec.alternative.map((alt, i) => (
              <span key={i} className="text-[10px] px-2 py-1 rounded-full bg-white/50 border border-current/20 font-medium">
                {alt}
              </span >
            ))}
          </div >
        )}
      </div >
    </div >
  );
}

export default function DailyReport({
  date,
  today,
  metrics,
  recommendations,
}: DailyReportProps) {
  const isToday = date === today;

  return (
    <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <SectorCard
          label="Zuccheri"
          value={metrics.sectors.sugars.totalGrams?.toFixed(1) ?? "non noto"}
          target={metrics.sectors.sugars.isHigh ? "Troppo alto" : undefined}
          icon={Target}
          colorClass="text-red-500"
          status={metrics.sectors.sugars.isHigh === null ? "unknown" : (metrics.sectors.sugars.isHigh ? (metrics.sectors.sugars.kcalPercentage !== null && metrics.sectors.sugars.kcalPercentage > 15 ? "high" : "warning") : "normal")}
          subText={metrics.sectors.sugars.glycemicClass ? `Classe: ${metrics.sectors.sugars.glycemicClass}` : undefined}
        />
        <SectorCard
          label="Lipidi"
          value={metrics.sectors.lipids.totalGrams?.toFixed(1) ?? "non noto"}
          target={metrics.sectors.lipids.isHigh ? "Troppo alto" : undefined}
          icon={Droplet}
          colorClass="text-pink-500"
          status={metrics.sectors.lipids.isHigh === null ? "unknown" : (metrics.sectors.lipids.isHigh ? "warning" : "normal")}
          subText={metrics.sectors.lipids.triglyceridesIndicator ? `Trigliceridi: ${metrics.sectors.lipids.triglyceridesIndicator}` : undefined}
        />
        <SectorCard
          label="Proteine"
          value={metrics.sectors.proteins.totalGrams?.toFixed(1) ?? "non noto"}
          target={metrics.sectors.proteins.isLow ? "Troppo basso" : undefined}
          icon={Utensils}
          colorClass="text-blue-500"
          status={metrics.sectors.proteins.isLow === null ? "unknown" : (metrics.sectors.proteins.isLow ? "low" : "normal")}
          subText={metrics.sectors.proteins.gramsPerKg !== null ? `${metrics.sectors.proteins.gramsPerKg.toFixed(1)} g/kg` : undefined}
        />
        <SectorCard
          label="Fibre"
          value={metrics.fiber.totalGrams?.toFixed(1) ?? "non noto"}
          target={metrics.fiber.isLow ? "Target: 25g" : undefined}
          icon={Wheat}
          colorClass="text-emerald-500"
          status={metrics.fiber.isLow === null ? "unknown" : (metrics.fiber.isLow ? "low" : "normal")}
        />
      </div >

      <div className="bg-white rounded-3xl p-6 border border-slate-200 shadow-sm space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-black text-slate-900 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            Sostanze Nocive & Rischi
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-blue-50 text-blue-600 border border-blue-100">
              Stima AI
            </span >
          </h3>
          <div className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-500">
            Copertura: {metrics.coverage !== null ? `${(metrics.coverage * 100).toFixed(0)}%` : "non noto"}
          </div >
        </div >

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className={`p-3 rounded-2xl border text-sm ${metrics.sectors.harmful_substances.isHigh === true ? 'bg-red-50 border-red-100 text-red-700' : metrics.sectors.harmful_substances.isHigh === false ? 'bg-slate-50 border-slate-100 text-slate-600' : 'bg-slate-50 border-slate-100 text-slate-400'}`}>
            <span className="font-bold block mb-1">Rischio Cumulativo</span>
            <span className="opacity-90">{metrics.sectors.harmful_substances.isHigh === true ? "Elevato (Settore 4)" : metrics.sectors.harmful_substances.isHigh === false ? "Basso/Assente" : "non noto"}</span >
          </div >
          <div className={`p-3 rounded-2xl border text-sm ${metrics.sectors.harmful_substances.novaScore !== null && metrics.sectors.harmful_substances.novaScore > 30 ? 'bg-amber-50 border-amber-100 text-amber-700' : 'bg-slate-50 border-slate-100 text-slate-600'}`}>
            <span className="font-bold block mb-1">Alimenti Processati (NOVA)</span>
            <span className="opacity-90">{metrics.sectors.harmful_substances.novaScore !== null ? `${metrics.sectors.harmful_substances.novaScore.toFixed(1)}%` : "non noto"}</span >
          </div >
        </div >

        {metrics.dailyLoadFoods.length > 0 && (
          <div className="mt-3 pt-3 border-t border-amber-100/50">
            <p className="text-[10px] font-bold text-amber-700 uppercase mb-1.5">Alimenti principali:</p>
            <div className="flex flex-wrap gap-1.5">
              {metrics.dailyLoadFoods.map((food, i) => (
                <span key={i} className="text-[10px] px-2 py-0.5 rounded-full bg-amber-100/50 text-amber-800 font-medium">
                  {food}
                </span >
              ))}
            </div >
          </div >
        )}
      </div >

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
          </div >
        ) : (
          <div className="bg-emerald-50 border border-emerald-100 p-6 rounded-3xl text-center space-y-2">
            <Award className="w-10 h-10 text-emerald-500 mx-auto mb-2" />
            <p className="text-emerald-800 font-bold">Ottimo lavoro!</p>
            <p className="text-emerald-600 text-sm">I tuoi valori sono in linea con gli obiettivi nutrizionali.</p>
          </div >
        )}
      </div >

      <div className="flex gap-3 p-4 rounded-2xl bg-slate-100/50 border border-slate-200 text-slate-500">
        <Info className="w-5 h-5 shrink-0" />
        <p className="text-[10px] leading-relaxed">
          Informazioni generali, non sostituiscono il parere di un medico o di un dietista. In presenza di patologie consulta un professionista.
        </p>
      </div >
    </div >
  );
}
