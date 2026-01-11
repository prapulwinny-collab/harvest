
import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Plus, RotateCcw, CheckCircle2, Package, XCircle, Hash, Check, Sun, Cloud, CloudRain, Zap, Wind, MapPin, Weight as WeightIcon, Activity, ArrowRight } from 'lucide-react';
import { HarvestSettings, HarvestEntry, getTankColor, getTankText, getTankBorder, formatPatluShort } from '../types';

interface WeatherData {
  temp: number;
  condition: string;
  vibe: 'sunny' | 'cloudy' | 'rainy' | 'stormy' | 'windy';
}

interface CrateEntryProps {
  onSave: (weight: number, crateCount: number) => void;
  onUpdateSettings: (updates: Partial<HarvestSettings>) => void;
  settings: HarvestSettings;
  onChangeTank: () => void;
  lastSaved: string | null;
  entries: HarvestEntry[];
  weather: WeatherData | null;
  loadingWeather: boolean;
  onRefreshWeather: () => void;
}

export const CrateEntry: React.FC<CrateEntryProps> = ({ 
  onSave, 
  onUpdateSettings, 
  settings, 
  onChangeTank, 
  lastSaved, 
  entries,
  weather,
  loadingWeather,
  onRefreshWeather
}) => {
  const [weight, setWeight] = useState<string>('');
  const [crateCount, setCrateCount] = useState<number>(2);
  const [isSuccess, setIsSuccess] = useState(false);
  const [isEditingCount, setIsEditingCount] = useState(false);
  const [tempCount, setTempCount] = useState<string>(settings.shrimpCount.toString());
  const [statsPulse, setStatsPulse] = useState(false);
  
  const weightInputRef = useRef<HTMLInputElement>(null);
  const countInputRef = useRef<HTMLInputElement>(null);

  const activeTankEntries = useMemo(() => 
    entries.filter(e => e.tank === settings.activeTank), 
    [entries, settings.activeTank]
  );

  const tankStats = useMemo(() => {
    let grossTotal = 0;
    let netTotal = 0;
    activeTankEntries.forEach(e => {
      grossTotal += e.weight;
      const tare = (e.crateCount || 1) * (e.crateWeight || 1.8);
      netTotal += Math.max(0, e.weight - tare);
    });
    return { netTotal, grossTotal };
  }, [activeTankEntries]);

  const allTankStats = useMemo(() => {
    const stats: Record<string, number> = {};
    entries.forEach(e => {
      stats[e.tank] = (stats[e.tank] || 0) + e.weight;
    });
    return stats;
  }, [entries]);

  useEffect(() => {
    if (!isSuccess && !isEditingCount) weightInputRef.current?.focus();
  }, [isSuccess, isEditingCount]);

  const handleSave = () => {
    const numWeight = parseFloat(weight);
    if (!isNaN(numWeight) && numWeight > 0) {
      onSave(numWeight, crateCount);
      setWeight('');
      setIsSuccess(true);
      setStatsPulse(true);
      setTimeout(() => {
        setIsSuccess(false);
        setStatsPulse(false);
      }, 800);
    }
  };

  const handleFinishCountEdit = () => {
    const newCount = parseInt(tempCount);
    if (!isNaN(newCount) && newCount > 0) {
      onUpdateSettings({ 
        shrimpCount: newCount,
        tankCounts: { ...(settings.tankCounts || {}), [settings.activeTank]: newCount }
      });
    }
    setIsEditingCount(false);
    weightInputRef.current?.focus();
  };

  const handleTankSelection = (tankName: string) => {
    const savedCount = settings.tankCounts?.[tankName] || settings.shrimpCount;
    onUpdateSettings({ activeTank: tankName, shrimpCount: savedCount });
    setTempCount(savedCount.toString());
    setCrateCount(2);
    setTimeout(() => weightInputRef.current?.focus(), 10);
  };

  const selectCrate = (num: number) => {
    setCrateCount(num);
    weightInputRef.current?.focus();
  };

  const tanks = Array.from({ length: 12 }, (_, i) => `Tank ${i + 1}`);

  return (
    <div className="flex flex-col h-full gap-4 max-w-lg mx-auto pb-6 animate-spring-up">
      
      {/* 1. STATUS MONITOR */}
      <div className="flex items-center justify-between px-1">
        <div className="flex items-center gap-2">
          <div className="bg-slate-900 px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-lg border border-slate-800 animate-float">
            <Activity className="w-3 h-3 text-orange-400 animate-pulse" />
            <span className="text-[10px] font-black text-white uppercase tracking-widest">{settings.sessionName}</span>
          </div>
          <button 
            onClick={onRefreshWeather}
            className="bg-white px-3 py-1.5 rounded-xl flex items-center gap-2 shadow-sm border border-slate-100 active:scale-95 transition-all hover:bg-slate-50"
          >
            {loadingWeather ? <Zap className="w-3.5 h-3.5 text-blue-500 animate-spin" /> : <Sun className="w-3.5 h-3.5 text-orange-400" />}
            <span className="text-[10px] font-black text-slate-900 leading-none">{weather ? `${weather.temp}°C` : '--'}</span>
          </button>
        </div>
        {lastSaved && (
          <div className="bg-emerald-500 text-white px-3 py-1.5 rounded-xl shadow-lg animate-success">
            <span className="text-[9px] font-black uppercase flex items-center gap-1">
              <CheckCircle2 className="w-3 h-3" /> {lastSaved}
            </span>
          </div>
        )}
      </div>

      {/* 2. TANK SELECTOR CAPSULES */}
      <div className="relative">
        <div className="flex gap-2.5 overflow-x-auto py-2 px-1 no-scrollbar snap-x">
          {tanks.map((tank, idx) => {
            const isActive = settings.activeTank === tank;
            const tankGross = allTankStats[tank] || 0;
            return (
              <button
                key={tank}
                onClick={() => handleTankSelection(tank)}
                style={{ animationDelay: `${idx * 0.05}s` }}
                className={`snap-start shrink-0 min-w-[90px] h-24 rounded-2xl border-2 flex flex-col items-center justify-center transition-all duration-300 relative animate-spring-up ${
                  isActive 
                    ? `${getTankColor(tank)} border-transparent text-white shadow-xl scale-100 ring-4 ring-slate-100` 
                    : 'bg-white border-slate-100 text-slate-400 hover:border-slate-300'
                }`}
              >
                <span className="text-[8px] font-black uppercase tracking-[0.1em] opacity-60 mb-0.5">Unit</span>
                <span className="text-xl font-black leading-none">{tank.split(' ')[1]}</span>
                <div className={`mt-2 px-2 py-0.5 rounded-md text-[8px] font-black ${isActive ? 'bg-black/20' : 'bg-slate-50'}`}>
                  {tankGross > 0 ? `${tankGross.toFixed(1)}kg` : 'EMPTY'}
                </div>
              </button>
            );
          })}
        </div>
        <div className="absolute right-0 top-0 bottom-0 w-12 bg-gradient-to-l from-slate-50 to-transparent pointer-events-none" />
      </div>

      {/* 3. LIVE FEED TICKER */}
      <div className="bg-slate-900/5 rounded-2xl p-3 flex items-center gap-3 overflow-hidden border border-slate-100 shimmer-effect">
        <div className="bg-slate-900 p-1.5 rounded-lg shrink-0">
          <Activity size={12} className="text-orange-400" />
        </div>
        <div className="flex gap-4 overflow-x-auto no-scrollbar py-0.5">
          {activeTankEntries.length > 0 ? activeTankEntries.slice(0, 5).map((e, idx) => (
            <div key={e.id} className="flex items-center gap-1.5 whitespace-nowrap animate-spring-in-right" style={{ animationDelay: `${idx * 0.1}s` }}>
              <span className="text-[10px] font-black text-slate-900">{e.weight.toFixed(1)}kg</span>
              <span className="text-[8px] font-bold text-slate-400 uppercase tracking-tighter">{e.crateCount === 2 ? 'P' : 'S'}</span>
              <ArrowRight size={8} className="text-slate-200" />
            </div>
          )) : (
            <span className="text-[10px] font-bold text-slate-300 uppercase tracking-widest italic">Awaiting first crate...</span>
          )}
        </div>
      </div>

      {/* 4. MAIN COMMAND PAD */}
      <div className="flex-1 flex flex-col gap-4">
        <div className={`bg-white rounded-[2.5rem] p-8 border-b-8 transition-all duration-700 shadow-2xl relative overflow-hidden flex flex-col ${
          isSuccess ? 'border-emerald-500 bg-emerald-50 ring-8 ring-emerald-500/10' : 'border-slate-100'
        }`}>
          {/* Pad Header */}
          <div className="flex items-center justify-between mb-6">
            <div className={`flex items-center gap-2 px-4 py-2 rounded-xl bg-slate-900 text-white shadow-lg transition-transform ${isSuccess ? 'scale-110' : ''}`}>
              <div className={`w-2 h-2 rounded-full ${getTankColor(settings.activeTank)} animate-pulse`} />
              <span className="text-[10px] font-black uppercase tracking-widest">{settings.activeTank}</span>
            </div>
            
            <div className="relative">
              {!isEditingCount ? (
                <button 
                  onClick={() => { setTempCount(settings.shrimpCount.toString()); setIsEditingCount(true); }}
                  className="bg-slate-50 border border-slate-100 text-slate-500 px-4 py-2 rounded-xl flex items-center gap-2 hover:bg-slate-100 transition-all active:scale-90"
                >
                  <Hash className="w-3 h-3 text-blue-500" />
                  <span className="text-[10px] font-black uppercase tracking-tight">{settings.shrimpCount} Pcs/kg</span>
                </button>
              ) : (
                <div className="flex items-center bg-slate-900 rounded-xl overflow-hidden shadow-2xl ring-4 ring-blue-500/10 animate-spring-up">
                  <input
                    ref={countInputRef}
                    type="number"
                    inputMode="numeric"
                    value={tempCount}
                    onChange={(e) => setTempCount(e.target.value)}
                    onBlur={handleFinishCountEdit}
                    onKeyDown={(e) => e.key === 'Enter' && handleFinishCountEdit()}
                    className="w-20 bg-transparent text-white font-black text-center py-2 text-sm focus:outline-none"
                    autoFocus
                  />
                  <button onClick={handleFinishCountEdit} className="bg-blue-600 px-3 py-2 text-white active:bg-blue-700">
                    <Check size={16} />
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Mass Input Area */}
          <div className="flex-1 flex flex-col justify-center py-6 relative">
            <div className={`text-center transition-transform duration-500 ${isSuccess ? 'scale-90 opacity-50' : 'scale-100'}`}>
              <label className="text-[10px] font-black text-slate-300 uppercase tracking-[0.5em] mb-4 block">Gross Kilograms</label>
              <div className="relative inline-flex w-full items-center justify-center">
                <input 
                  ref={weightInputRef} 
                  type="number" 
                  inputMode="decimal" 
                  value={weight} 
                  onChange={(e) => setWeight(e.target.value)} 
                  onKeyDown={(e) => e.key === 'Enter' && handleSave()} 
                  placeholder="0.00" 
                  className="w-full text-center text-[10rem] font-black text-slate-900 bg-transparent focus:outline-none placeholder:text-slate-50 tracking-tighter leading-none" 
                />
                {weight && (
                  <button onClick={() => setWeight('')} className="absolute right-0 p-4 text-slate-200 hover:text-red-400 transition-colors">
                    <XCircle size={36} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Precision Dashboard */}
          <div className="mt-8 pt-8 border-t border-slate-50 grid grid-cols-3 gap-3">
            <div className={`bg-slate-50 rounded-2xl p-3 text-center transition-all ${statsPulse ? 'scale-110 shadow-lg' : ''}`}>
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Gross</span>
               <span className="text-sm font-black text-slate-900">{tankStats.grossTotal.toFixed(1)}</span>
            </div>
            <div className={`bg-emerald-50 rounded-2xl p-3 text-center border border-emerald-100 transition-all ${statsPulse ? 'scale-125 bg-emerald-500 text-white shadow-xl rotate-2' : ''}`}>
               <span className={`text-[8px] font-black uppercase tracking-widest block mb-1 ${statsPulse ? 'text-white/80' : 'text-emerald-600'}`}>Net Yield</span>
               <span className={`text-sm font-black ${statsPulse ? 'text-white' : 'text-emerald-700'}`}>{tankStats.netTotal.toFixed(1)}</span>
            </div>
            <div className={`bg-slate-50 rounded-2xl p-3 text-center transition-all ${statsPulse ? 'scale-110 shadow-lg' : ''}`}>
               <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest block mb-1">Crates</span>
               <span className="text-sm font-black text-slate-900">{activeTankEntries.length}</span>
            </div>
          </div>
        </div>

        {/* 5. TACTILE CRATE TOGGLES */}
        <div className="grid grid-cols-2 gap-4">
          {[1, 2].map((num) => (
            <button 
              key={num} 
              onClick={() => selectCrate(num)} 
              className={`py-8 rounded-[2.5rem] font-black border-2 transition-all duration-300 active:scale-90 flex flex-col items-center justify-center gap-2 ${
                crateCount === num 
                  ? `${getTankColor(settings.activeTank)} border-transparent text-white shadow-2xl scale-100 ring-4 ring-slate-100` 
                  : 'bg-white border-slate-100 text-slate-300 hover:border-slate-300'
              }`}
            >
              <div className={`flex -space-x-3 transition-transform ${crateCount === num ? 'scale-110' : ''}`}>
                <Package size={32} strokeWidth={num === crateCount ? 3 : 2} />
                {num === 2 && <Package size={32} strokeWidth={num === crateCount ? 3 : 2} className="mt-2" />}
              </div>
              <span className="uppercase tracking-[0.2em] text-[10px] font-black">{num === 2 ? 'PATLU' : 'SINGLE'}</span>
            </button>
          ))}
        </div>

        {/* 6. PRIMARY ACTIONS */}
        <div className="flex gap-4">
          <button 
            onClick={() => setWeight('')} 
            className="bg-white border-2 border-slate-100 text-slate-300 w-24 h-24 rounded-[2.5rem] flex items-center justify-center active:scale-75 shadow-lg transition-all hover:bg-slate-50"
          >
            <RotateCcw size={32} />
          </button>
          <button 
            onClick={handleSave} 
            disabled={!weight} 
            className={`flex-1 flex items-center justify-center gap-4 h-24 rounded-[2.5rem] font-black shadow-2xl transition-all active:scale-95 ${
              weight 
                ? `${getTankColor(settings.activeTank)} text-white shadow-blue-500/30 hover:brightness-110` 
                : 'bg-slate-100 text-slate-300 opacity-60 cursor-not-allowed'
            }`}
          >
            <Plus size={44} strokeWidth={4} className={weight ? 'animate-pulse' : ''} />
            <span className="text-3xl uppercase font-black tracking-tighter">SAVE CRATE</span>
          </button>
        </div>
      </div>
    </div>
  );
};
