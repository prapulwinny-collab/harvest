
import React, { useMemo } from 'react';
import { HarvestEntry, TankSummary, getTankColor, getTankText } from '../types';
import { Banknote, TrendingUp, IndianRupee, Calculator, Zap, ShieldCheck, Wallet } from 'lucide-react';

interface RevenueScreenProps {
  entries: HarvestEntry[];
  prices: Record<string, string>;
  onUpdatePrice: (tank: string, price: string) => void;
}

export const RevenueScreen: React.FC<RevenueScreenProps> = ({ entries, prices, onUpdatePrice }) => {
  const summaries = useMemo(() => {
    const map = new Map<string, TankSummary>();

    entries.forEach(entry => {
      const current = map.get(entry.tank) || { 
        tank: entry.tank, entryCount: 0, patluCount: 0, singlesCount: 0,
        crateCount: 0, totalWeight: 0, absoluteWeight: 0, shrimpCount: entry.count
      };
      
      const entryCrateCount = entry.crateCount || 1;
      const effectiveCrateWeight = entry.crateWeight || 1.8;
      
      current.entryCount += 1;
      if (entryCrateCount === 2) current.patluCount += 1;
      else if (entryCrateCount === 1) current.singlesCount += 1;

      current.crateCount += entryCrateCount;
      current.totalWeight += entry.weight;
      current.absoluteWeight += (entry.weight - (entryCrateCount * effectiveCrateWeight));
      current.shrimpCount = entry.count;
      
      map.set(entry.tank, current);
    });

    return Array.from(map.values()).sort((a, b) => a.tank.localeCompare(b.tank));
  }, [entries]);

  const totalRevenue = summaries.reduce((acc, sum) => {
    const price = parseFloat(prices[sum.tank] || '0') || 0;
    return acc + (sum.absoluteWeight * price);
  }, 0);

  return (
    <div className="space-y-6 pb-24 animate-reveal max-w-2xl mx-auto">
      
      {/* 1. BANKER HERO CARD */}
      <div className="bg-gradient-to-br from-slate-900 to-slate-800 rounded-[2.5rem] p-10 shadow-2xl relative border-t border-slate-700">
        <div className="absolute -top-10 -left-10 bg-orange-500/10 w-48 h-48 rounded-full blur-3xl" />
        
        <div className="flex items-center gap-3 mb-10 relative z-10">
          <div className="bg-orange-500 p-2 rounded-xl shadow-lg shadow-orange-500/20">
            <Wallet className="text-white w-5 h-5" />
          </div>
          <h2 className="text-xs font-black text-slate-500 uppercase tracking-[0.4em]">Settlement Vault</h2>
        </div>

        <div className="relative z-10">
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-3">Total Payable Revenue</span>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-bold text-orange-500">₹</span>
              <span className="text-8xl font-black text-white tracking-tighter leading-none drop-shadow-lg">
                {totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </span>
            </div>
          </div>
        </div>
        
        <div className="mt-10 pt-8 border-t border-slate-700 flex justify-between relative z-10">
           <div className="flex flex-col">
             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Session Yield</span>
             <span className="text-xl font-black text-white">{summaries.reduce((a,b)=>a+b.absoluteWeight, 0).toFixed(1)} <span className="text-xs text-slate-500">KG</span></span>
           </div>
           <div className="flex flex-col items-end">
             <span className="text-[9px] font-black text-slate-600 uppercase tracking-widest mb-1">Audit Status</span>
             <span className="text-xs font-black text-emerald-400 bg-emerald-400/10 px-3 py-1 rounded-lg border border-emerald-400/20 uppercase tracking-widest">Live Validated</span>
           </div>
        </div>
      </div>

      {/* 2. PRICING TERMINAL */}
      <div className="px-1 space-y-4">
        {summaries.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-slate-100 flex flex-col items-center gap-4">
            <div className="bg-slate-50 p-6 rounded-full"><Calculator className="w-12 h-12 text-slate-200" /></div>
            <p className="text-slate-400 font-black uppercase tracking-widest text-xs">Awaiting harvest logs...</p>
          </div>
        ) : (
          summaries.map((sum) => (
            <div key={`rev-pad-${sum.tank}`} className={`bg-white rounded-[2rem] p-8 shadow-xl border-2 transition-all duration-300 ${prices[sum.tank] ? 'border-orange-500' : 'border-slate-100'}`}>
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-4">
                  <div className={`${getTankColor(sum.tank)} text-white w-14 h-14 rounded-2xl flex items-center justify-center text-xl font-black shadow-lg`}>
                    {sum.tank.replace('Tank ', '')}
                  </div>
                  <div>
                    <h4 className={`font-black text-xl leading-none ${getTankText(sum.tank)} uppercase tracking-tight`}>{sum.tank}</h4>
                    <p className="text-[10px] font-black text-slate-400 uppercase mt-2">{sum.shrimpCount} Pcs • {sum.absoluteWeight.toFixed(1)} kg</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="text-[9px] font-black text-slate-300 uppercase tracking-widest mb-1">Value</p>
                  <span className="text-3xl font-black text-emerald-600 leading-none">
                    ₹{((parseFloat(prices[sum.tank]) || 0) * sum.absoluteWeight).toLocaleString(undefined, { maximumFractionDigits: 0 })}
                  </span>
                </div>
              </div>

              <div className="relative">
                <div className="absolute left-6 top-1/2 -translate-y-1/2 text-orange-500">
                  <IndianRupee size={28} strokeWidth={3} />
                </div>
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Set Rate / KG"
                  value={prices[sum.tank] || ''}
                  onChange={(e) => onUpdatePrice(sum.tank, e.target.value)}
                  className="w-full bg-slate-50 border-2 border-slate-100 rounded-3xl py-6 pl-16 pr-8 font-black text-4xl text-slate-900 focus:outline-none focus:border-orange-500 transition-all placeholder:text-slate-100 shadow-inner"
                />
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
