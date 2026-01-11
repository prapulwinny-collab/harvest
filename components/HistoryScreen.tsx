
import React, { useState, useMemo } from 'react';
import { HarvestEntry, TankSummary, getTankColor, getTankText, getTankBorder, getTankColorName } from '../types';
import { Calendar, ChevronRight, ArrowLeft, Package, Weight, Clock, User, Hash, TrendingUp, Zap, ArrowDownRight, Target, PieChart, Scale, Trash2, AlertTriangle, Loader2, Banknote, IndianRupee, ListFilter, MapPin, Layers } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';

interface HistoryScreenProps {
  entries: HarvestEntry[];
  prices: Record<string, string>;
  onDeleteSession: (farm: string, session: string) => Promise<void>;
}

const getHexForColor = (color: string) => {
  const map: Record<string, string> = {
    'blue': '#2563eb', 'purple': '#9333ea', 'rose': '#e11d48', 'amber': '#d97706', 
    'emerald': '#059669', 'indigo': '#4f46e5', 'orange': '#ea580c', 'cyan': '#0891b2', 
    'fuchsia': '#c026d3', 'teal': '#0d9488', 'lime': '#65a30d', 'violet': '#7c3aed',
  };
  return map[color] || '#2563eb';
};

export const HistoryScreen: React.FC<HistoryScreenProps> = ({ entries, prices, onDeleteSession }) => {
  const [selectedSession, setSelectedSession] = useState<{farm: string, session: string} | null>(null);
  const [confirmingSession, setConfirmingSession] = useState<{farm: string, session: string} | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Group entries by Farm and Session
  const sessionGroups = useMemo(() => {
    const groups: Record<string, HarvestEntry[]> = {};
    entries.forEach(entry => {
      const key = `${entry.farmName || 'Default Farm'}|||${entry.sessionName || 'Default Session'}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(entry);
    });
    return Object.entries(groups).sort((a, b) => b[0].localeCompare(a[0]));
  }, [entries]);

  const sessionStats = useMemo(() => {
    return sessionGroups.map(([key, sessionEntries]) => {
      const [farm, session] = key.split('|||');
      const totalNet = sessionEntries.reduce((sum, e) => {
        const tare = (e.crateCount || 1) * (e.crateWeight || 1.8);
        return sum + Math.max(0, e.weight - tare);
      }, 0);
      
      const dates = new Set(sessionEntries.map(e => e.timestamp.split('T')[0]));
      
      return {
        farm,
        session,
        count: sessionEntries.length,
        totalNet,
        dateRange: Array.from(dates).sort(),
        entries: sessionEntries
      };
    });
  }, [sessionGroups]);

  const handleDeleteClick = async (e: React.MouseEvent, farm: string, session: string) => {
    e.stopPropagation();
    if (confirmingSession?.farm === farm && confirmingSession?.session === session) {
      setIsDeleting(true);
      try {
        await onDeleteSession(farm, session);
        setConfirmingSession(null);
      } finally {
        setIsDeleting(false);
      }
    } else {
      setConfirmingSession({farm, session});
    }
  };

  const dailyAbstract = useMemo(() => {
    if (!selectedSession) return null;
    
    const sessionEntries = entries.filter(e => 
      e.farmName === selectedSession.farm && e.sessionName === selectedSession.session
    );
    const map = new Map<string, TankSummary>();

    sessionEntries.forEach(entry => {
      const current = map.get(entry.tank) || { 
        tank: entry.tank, 
        entryCount: 0,
        patluCount: 0,
        singlesCount: 0,
        crateCount: 0, 
        totalWeight: 0, 
        absoluteWeight: 0,
        shrimpCount: entry.count
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

    const summaries = Array.from(map.values()).sort((a, b) => a.tank.localeCompare(b.tank));
    const totalAbsolute = summaries.reduce((acc, s) => acc + s.absoluteWeight, 0);
    const totalGross = summaries.reduce((acc, s) => acc + s.totalWeight, 0);
    const totalRevenue = summaries.reduce((acc, sum) => {
      const price = parseFloat(prices[sum.tank] || '0') || 0;
      return acc + (sum.absoluteWeight * price);
    }, 0);

    return {
      summaries,
      totalAbsolute,
      totalGross,
      totalRevenue,
      rawEntries: sessionEntries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    };
  }, [selectedSession, entries, prices]);

  if (selectedSession && dailyAbstract) {
    const { summaries, totalAbsolute, totalGross, totalRevenue, rawEntries } = dailyAbstract;
    
    return (
      <div className="space-y-6 pb-24 animate-in slide-in-from-right-4 duration-300">
        <button 
          onClick={() => setSelectedSession(null)}
          className="flex items-center gap-2 text-gray-500 font-black text-xs uppercase tracking-widest px-2"
        >
          <ArrowLeft className="w-4 h-4" /> Back to Archives
        </button>

        <div className="bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-800 rounded-[2.5rem] p-8 shadow-2xl relative border-t border-white/20">
          <div className="flex items-center gap-2 mb-4">
            <div className="bg-white/20 backdrop-blur-md p-1.5 rounded-lg border border-white/30">
              <MapPin className="text-white w-4 h-4" />
            </div>
            <h2 className="text-xs font-black text-white uppercase tracking-[0.2em]">{selectedSession.farm} • {selectedSession.session}</h2>
          </div>

          <div className="grid grid-cols-2 gap-8">
            <div className="flex flex-col">
              <span className="text-[11px] font-black text-blue-100 uppercase tracking-widest mb-1 opacity-80">Final Net Weight</span>
              <div className="flex items-baseline gap-2">
                <span className="text-6xl font-black text-white tracking-tighter">{totalAbsolute.toFixed(1)}</span>
                <span className="text-2xl font-bold text-blue-200 uppercase">KG</span>
              </div>
            </div>
            <div className="flex flex-col items-end justify-center">
               <span className="text-[11px] font-black text-blue-100 uppercase tracking-widest mb-1 opacity-80">Session Value</span>
               <span className="text-4xl font-black text-white tracking-tighter">₹{totalRevenue.toLocaleString()}</span>
            </div>
          </div>
          <div className="mt-4 pt-4 border-t border-white/10 flex items-center justify-between">
            <div className="flex flex-col">
               <span className="text-[9px] font-black text-blue-100/50 uppercase">Session Gross</span>
               <span className="text-sm font-black text-white">{totalGross.toFixed(1)} kg</span>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="px-2">
            <h3 className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Pond Breakdown</h3>
          </div>
          {summaries.map((sum) => (
            <div key={sum.tank} className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className={`${getTankColor(sum.tank)} text-white w-10 h-10 rounded-xl flex items-center justify-center text-xs font-black`}>
                  {sum.tank.replace('Tank ', '')}
                </div>
                <div>
                  <p className="font-black text-sm text-gray-900">{sum.tank}</p>
                  <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">{sum.shrimpCount} PCS Count</p>
                </div>
              </div>
              <div className="text-right">
                <div className="flex items-baseline justify-end gap-1">
                  <span className="text-[9px] font-black text-gray-300 uppercase">NET</span>
                  <p className="text-lg font-black text-gray-900">{sum.absoluteWeight.toFixed(1)}kg</p>
                </div>
                <div className="flex items-baseline justify-end gap-1 opacity-40">
                  <span className="text-[7px] font-black text-gray-400 uppercase">GRS</span>
                  <p className="text-[10px] font-black text-gray-900">{sum.totalWeight.toFixed(1)}kg</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-24 animate-in fade-in duration-500">
      <div>
        <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Archive Explorer</h2>
        <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Lifecycle Tracking by Farm & Session</p>
      </div>

      {sessionStats.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center gap-4">
          <Calendar className="w-12 h-12 text-gray-200" />
          <p className="text-gray-400 font-black uppercase tracking-widest text-sm">Historical Data Empty</p>
        </div>
      ) : (
        <div className="space-y-4">
          {sessionStats.map((stat) => (
            <button
              key={`${stat.farm}-${stat.session}`}
              onClick={() => setSelectedSession({farm: stat.farm, session: stat.session})}
              className="w-full bg-white rounded-[2.5rem] p-6 text-left shadow-lg border border-gray-50 relative group"
            >
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="bg-blue-600 p-2 rounded-xl">
                    <MapPin className="w-5 h-5 text-white" />
                  </div>
                  <div>
                    <h3 className="text-lg font-black text-gray-900 tracking-tight leading-none">{stat.farm}</h3>
                    <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest mt-1 flex items-center gap-1">
                      <Layers className="w-2.5 h-2.5" /> {stat.session}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  {confirmingSession?.farm === stat.farm && confirmingSession?.session === stat.session ? (
                    <button 
                      onClick={(e) => handleDeleteClick(e, stat.farm, stat.session)}
                      className="px-4 py-2 bg-red-600 text-white rounded-xl text-[10px] font-black uppercase animate-pulse"
                    >
                      {isDeleting ? '...' : 'Confirm'}
                    </button>
                  ) : (
                    <div onClick={(e) => handleDeleteClick(e, stat.farm, stat.session)} className="p-2.5 text-gray-200 hover:text-red-500 transition-colors">
                      <Trash2 size={16} />
                    </div>
                  )}
                  <ChevronRight size={20} className="text-gray-300" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div className="bg-gray-50 rounded-2xl p-4 flex flex-col">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Total Yield</span>
                  <span className="text-xl font-black text-gray-900">{stat.totalNet.toFixed(1)}kg</span>
                </div>
                <div className="bg-gray-50 rounded-2xl p-4 flex flex-col">
                  <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest mb-1">Period</span>
                  <span className="text-[10px] font-black text-gray-700 mt-1 uppercase">
                    {stat.dateRange[0]} to {stat.dateRange[stat.dateRange.length-1]}
                  </span>
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
