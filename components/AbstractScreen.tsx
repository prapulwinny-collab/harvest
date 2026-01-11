
import React, { useMemo } from 'react';
import { HarvestEntry, TankSummary, getTankColor, getTankText, getTankBorder, formatPatluDisplay, getTankColorName, formatPatluShort } from '../types';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, AreaChart, Area } from 'recharts';
import { TrendingUp, Package, Scale, ListFilter, Weight, ArrowDownRight, Zap, Target, Hash, Banknote, IndianRupee, Activity, Gauge } from 'lucide-react';

interface AbstractScreenProps {
  entries: HarvestEntry[];
  prices: Record<string, string>;
}

export const AbstractScreen: React.FC<AbstractScreenProps> = ({ entries, prices }) => {
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

  const totalAbsolute = summaries.reduce((acc, s) => acc + s.absoluteWeight, 0);
  const totalGross = summaries.reduce((acc, s) => acc + s.totalWeight, 0);
  const netEfficiency = totalGross > 0 ? (totalAbsolute / totalGross) * 100 : 0;

  const timelineData = useMemo(() => {
    if (entries.length === 0) return [];
    const sorted = [...entries].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime());
    let cumulative = 0;
    return sorted.map((e, idx) => {
      const tare = (e.crateCount || 1) * (e.crateWeight || 1.8);
      const net = Math.max(0, e.weight - tare);
      cumulative += net;
      return { 
        time: new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }), 
        weight: net,
        cumulative: Math.round(cumulative)
      };
    });
  }, [entries]);

  const totalRevenue = summaries.reduce((acc, sum) => {
    const price = parseFloat(prices[sum.tank] || '0') || 0;
    return acc + (sum.absoluteWeight * price);
  }, 0);

  return (
    <div className="space-y-6 pb-24">
      
      {/* 1. SESSION COMMAND CARD */}
      <div className="bg-slate-900 rounded-[2.5rem] p-8 shadow-2xl relative overflow-hidden border border-slate-800 animate-spring-up stagger-1">
        <div className="absolute top-0 right-0 p-12 opacity-5 pointer-events-none">
          <Activity className="w-64 h-64 text-emerald-400 animate-float" />
        </div>
        
        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-500/10 p-2 rounded-xl border border-emerald-500/20">
              <Gauge className="text-emerald-400 w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-xs font-black text-slate-400 uppercase tracking-[0.3em]">Master Performance</h2>
          </div>
          <div className="bg-slate-800 px-4 py-1.5 rounded-full border border-slate-700 animate-float">
             <span className="text-[10px] font-black text-emerald-400 uppercase">Efficiency {netEfficiency.toFixed(1)}%</span>
          </div>
        </div>

        <div className="relative z-10 grid grid-cols-1 md:grid-cols-2 gap-10">
          <div className="flex flex-col">
            <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Cumulative Yield</span>
            <div className="flex items-baseline gap-3">
              <span className="text-7xl font-black text-white tracking-tighter animate-heartbeat">{totalAbsolute.toFixed(1)}</span>
              <span className="text-2xl font-bold text-slate-500 uppercase">KG</span>
            </div>
          </div>

          <div className="flex flex-col md:items-end justify-center">
             <span className="text-[11px] font-black text-slate-500 uppercase tracking-widest mb-2">Session Valuation</span>
             <div className="flex items-baseline gap-2">
               <span className="text-3xl font-bold text-emerald-500 animate-pulse">₹</span>
               <span className="text-5xl font-black text-white tracking-tighter">
                 {totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
               </span>
             </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mt-10 pt-8 border-t border-slate-800 relative z-10">
          <div className="flex flex-col animate-spring-up stagger-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Gross Inbound</span>
            <p className="text-2xl font-black text-slate-200">{totalGross.toFixed(1)} <span className="text-xs opacity-40">kg</span></p>
          </div>
          <div className="flex flex-col items-end animate-spring-up stagger-2">
            <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Total Tare</span>
            <p className="text-2xl font-black text-rose-400">{(totalGross - totalAbsolute).toFixed(1)} <span className="text-xs opacity-40">kg</span></p>
          </div>
        </div>
      </div>

      {/* 2. HARVEST FLOW CHART */}
      <div className="bg-white rounded-[2rem] p-8 border border-slate-100 shadow-xl relative overflow-hidden animate-spring-up stagger-2">
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <div className="bg-blue-50 p-2 rounded-xl">
              <TrendingUp className="w-5 h-5 text-blue-600 animate-pulse" />
            </div>
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-widest">Harvest Velocity</h3>
          </div>
          <div className="text-right">
             <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Crates Logged</p>
             <p className="text-lg font-black text-slate-900 leading-none mt-1 animate-heartbeat">{entries.length}</p>
          </div>
        </div>

        <div className="h-48 w-full shimmer-effect rounded-xl overflow-hidden">
          {timelineData.length > 1 ? (
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={timelineData}>
                <defs>
                  <linearGradient id="colorNet" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="time" hide />
                <YAxis hide />
                <Tooltip 
                  content={({ active, payload }) => {
                    if (active && payload && payload.length) {
                      return (
                        <div className="bg-slate-900 p-3 rounded-xl shadow-2xl border border-slate-800 animate-spring-up">
                          <p className="text-white font-black text-sm">{payload[0].value} <span className="text-[10px] opacity-40">KG</span></p>
                          <p className="text-slate-500 text-[9px] font-black uppercase mt-1">{payload[0].payload.time}</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Area type="monotone" dataKey="cumulative" stroke="#3b82f6" strokeWidth={5} fillOpacity={1} fill="url(#colorNet)" />
              </AreaChart>
            </ResponsiveContainer>
          ) : (
            <div className="h-full flex items-center justify-center text-slate-300 font-black uppercase text-[10px] tracking-widest italic">Awaiting data stream...</div>
          )}
        </div>
      </div>

      {/* 3. TANK MATRIX HEATMAP */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {summaries.map((sum, idx) => (
          <div key={`heat-${sum.tank}`} className={`bg-white rounded-[1.5rem] p-5 border-2 transition-all hover:scale-105 hover:shadow-2xl animate-spring-up ${getTankBorder(sum.tank)} flex items-center justify-between`} style={{ animationDelay: `${0.3 + idx * 0.1}s` }}>
             <div className="flex items-center gap-4">
               <div className={`${getTankColor(sum.tank)} text-white w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black shadow-lg animate-pulse`}>
                 {sum.tank.replace('Tank ', '')}
               </div>
               <div>
                 <p className="text-sm font-black text-slate-900 leading-none">{sum.tank}</p>
                 <p className="text-[9px] font-bold text-slate-400 mt-1 uppercase tracking-tight">
                   {formatPatluShort(sum.patluCount, sum.singlesCount)} • {sum.shrimpCount}C
                 </p>
               </div>
             </div>
             <div className="text-right">
               <p className="text-xl font-black text-slate-900 leading-none">{sum.absoluteWeight.toFixed(1)}</p>
               <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-1">NET KG</p>
             </div>
          </div>
        ))}
      </div>

      {/* 4. DETAIL LEDGER TABLE */}
      <div className="bg-white rounded-[2rem] overflow-hidden border border-slate-100 shadow-2xl mb-10 animate-spring-up stagger-5">
        <div className="px-6 py-6 bg-slate-50/50 border-b border-slate-100 flex items-center justify-between">
          <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest">Detail Matrix</h3>
          <span className="text-[9px] font-black text-blue-600 bg-blue-50 px-3 py-1 rounded-full uppercase animate-pulse">Real-time Verified</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[500px]">
            <thead>
              <tr className="border-b border-slate-50">
                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-wider">Source</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Gross</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Tare</th>
                <th className="px-4 py-5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Yield</th>
                <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-wider text-right">Valuation</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {summaries.map((sum, idx) => {
                const rev = sum.absoluteWeight * (parseFloat(prices[sum.tank] || '0') || 0);
                return (
                  <tr key={sum.tank} className="hover:bg-slate-50 transition-all duration-300 group">
                    <td className="px-6 py-5">
                      <span className={`font-black text-sm group-hover:scale-110 inline-block transition-transform ${getTankText(sum.tank)}`}>{sum.tank}</span>
                    </td>
                    <td className="px-4 py-5 text-right font-bold text-slate-400 text-xs">{sum.totalWeight.toFixed(1)}</td>
                    <td className="px-4 py-5 text-right font-bold text-rose-300 text-xs">{(sum.totalWeight - sum.absoluteWeight).toFixed(1)}</td>
                    <td className="px-4 py-5 text-right font-black text-slate-900 text-sm group-hover:text-blue-600 transition-colors">{sum.absoluteWeight.toFixed(1)}</td>
                    <td className="px-6 py-5 text-right">
                       <span className="font-black text-emerald-600 text-sm group-hover:scale-105 inline-block">₹{rev.toLocaleString(undefined, { maximumFractionDigits: 0 })}</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
