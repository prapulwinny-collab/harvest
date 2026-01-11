
import React, { useState, useMemo, useEffect } from 'react';
import { HarvestEntry, getTankColor, getTankText, getTankBorder, formatPatluDisplay } from '../types';
import { Trash2, Edit2, ChevronDown, Save, Square, CheckSquare, Loader2, History, Package, AlertTriangle, ListChecks, Clock, User, Hash, Weight, TrendingUp, BarChart } from 'lucide-react';

interface LogScreenProps {
  entries: HarvestEntry[];
  onDelete: (id: string) => Promise<void>;
  onBatchDelete: (ids: string[]) => Promise<void>;
  onUpdate: (entry: HarvestEntry) => Promise<void>;
}

interface RunningTotals {
  runningGross: number;
  runningNet: number;
}

export const LogScreen: React.FC<LogScreenProps> = ({ entries, onDelete, onBatchDelete, onUpdate }) => {
  const [expandedTanks, setExpandedTanks] = useState<Record<string, boolean>>({});
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editValues, setEditValues] = useState<Partial<HarvestEntry>>({});
  const [isBatchConfirming, setIsBatchConfirming] = useState(false);
  const [isBatchDeleting, setIsBatchDeleting] = useState(false);
  const [isUpdating, setIsUpdating] = useState(false);

  useEffect(() => {
    const tanks: string[] = Array.from(new Set(entries.map(e => e.tank)));
    setExpandedTanks(prev => {
      const next = { ...prev };
      tanks.forEach((t: string) => { if (next[t] === undefined) next[t] = true; });
      return next;
    });
  }, [entries.length]);

  // Group entries and calculate tank-exclusive running totals
  const processedGroups = useMemo(() => {
    const groups: Record<string, HarvestEntry[]> = {};
    const runningTotalsMap: Record<string, RunningTotals> = {};

    // 1. Grouping
    entries.forEach(entry => {
      if (!groups[entry.tank]) groups[entry.tank] = [];
      groups[entry.tank].push(entry);
    });

    // 2. Sorting and Calculating Accumulations
    Object.keys(groups).forEach(tank => {
      // Sort chronologically (oldest first) to calculate running totals correctly
      const chronological = [...groups[tank]].sort((a, b) => 
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      );

      let currentGross = 0;
      let currentNet = 0;

      chronological.forEach(entry => {
        const tare = (entry.crateCount || 1) * (entry.crateWeight || 1.8);
        const net = Math.max(0, entry.weight - tare);
        currentGross += entry.weight;
        currentNet += net;

        runningTotalsMap[entry.id] = {
          runningGross: currentGross,
          runningNet: currentNet
        };
      });

      // Sort descending (newest first) for the UI display
      groups[tank].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
    });

    const sortedTanks = Object.entries(groups).sort((a, b) => {
      const aTime = new Date(groups[a[0]][0].timestamp).getTime();
      const bTime = new Date(groups[b[0]][0].timestamp).getTime();
      return bTime - aTime;
    });

    return { groups: sortedTanks, runningTotalsMap };
  }, [entries]);

  const handleToggleSelect = (id: string) => {
    if (editingId) return;
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedIds.size === entries.length) setSelectedIds(new Set());
    else setSelectedIds(new Set(entries.map(e => e.id)));
  };

  const startEdit = (entry: HarvestEntry) => {
    setEditingId(entry.id);
    setEditValues({ ...entry });
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValues({});
  };

  const saveEdit = async () => {
    if (!editingId || !editValues.id) return;
    setIsUpdating(true);
    try {
      await onUpdate(editValues as HarvestEntry);
      setEditingId(null);
    } finally {
      setIsUpdating(false);
    }
  };

  const startDelete = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setConfirmingId(id);
  };

  const confirmDelete = async (id: string, e: React.MouseEvent, idToDelete: string) => {
    e.stopPropagation();
    setConfirmingId(null);
    setDeletingId(idToDelete);
    try {
      await onDelete(idToDelete);
    } finally {
      setDeletingId(null);
    }
  };

  const handleBatchDeleteClick = async () => {
    const ids = Array.from(selectedIds);
    if (ids.length === 0 || isBatchDeleting) return;
    setIsBatchDeleting(true);
    try {
      await onBatchDelete(ids);
      setSelectedIds(new Set());
      setIsBatchConfirming(false);
    } finally {
      setIsBatchDeleting(false);
    }
  };

  return (
    <div className="space-y-6 pb-32">
      <div className="flex flex-col gap-4 px-1 animate-spring-up stagger-1">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-black text-gray-900 tracking-tight uppercase">Harvest Logs</h2>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] mt-1">Real-time Crate Tracking</p>
          </div>
          <div className="bg-white px-4 py-2 rounded-2xl border border-gray-100 shadow-sm flex items-center gap-2 animate-float">
            <ListChecks className="w-4 h-4 text-blue-600" />
            <span className="text-sm font-black text-gray-900">{entries.length}</span>
          </div>
        </div>
        
        {entries.length > 0 && (
          <button 
            onClick={handleSelectAll}
            className={`w-full flex items-center justify-center gap-2 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all active:scale-95 shadow-lg ${
              selectedIds.size === entries.length 
                ? 'bg-blue-600 text-white shadow-blue-100' 
                : 'bg-white text-gray-700 border border-gray-100 shadow-sm'
            }`}
          >
            <ListChecks className="w-4 h-4" />
            {selectedIds.size === entries.length ? 'Clear Selection' : 'Select All Records'}
          </button>
        )}
      </div>

      {processedGroups.groups.length === 0 ? (
        <div className="text-center py-20 bg-white rounded-[3rem] border-4 border-dashed border-gray-100 flex flex-col items-center gap-4 animate-spring-up stagger-2">
          <div className="bg-gray-50 p-6 rounded-full">
            <History className="w-12 h-12 text-gray-200" />
          </div>
          <p className="text-gray-400 font-black uppercase tracking-widest text-sm">No Active Logs</p>
        </div>
      ) : (
        processedGroups.groups.map(([tank, tankEntries], tankIdx) => {
          const patlu = tankEntries.filter(e => e.crateCount === 2).length;
          const singles = tankEntries.filter(e => e.crateCount === 1).length;
          const totalInTank = tankEntries.length;
          const tankGrossTotal = tankEntries.reduce((sum, e) => sum + e.weight, 0);
          
          return (
            <div key={tank} className="bg-white rounded-[2rem] overflow-hidden shadow-xl shadow-gray-100 border border-gray-100 animate-spring-up" style={{ animationDelay: `${0.1 * tankIdx}s` }}>
              <button 
                onClick={() => setExpandedTanks(p => ({...p, [tank]: !p[tank]}))} 
                className={`w-full flex items-center justify-between p-5 transition-all active:bg-gray-50 ${expandedTanks[tank] ? 'border-b border-gray-50 bg-slate-50/30' : ''}`}
              >
                <div className="flex items-center gap-4">
                  <div className={`${getTankColor(tank)} text-white w-12 h-12 rounded-2xl flex items-center justify-center text-lg font-black shadow-lg shadow-blue-100 transition-transform ${expandedTanks[tank] ? 'scale-110' : ''}`}>
                    {tank.replace('Tank ', '')}
                  </div>
                  <div className="text-left">
                    <div className="flex items-center gap-3">
                      <p className={`font-black text-lg leading-none ${getTankText(tank)} uppercase tracking-tight`}>{tank}</p>
                      <div className="flex items-center gap-1 bg-slate-100 px-2 py-0.5 rounded-lg shimmer-effect">
                        <Weight size={10} className="text-slate-400" />
                        <span className="text-[10px] font-black text-slate-600">{tankGrossTotal.toFixed(1)}kg</span>
                      </div>
                    </div>
                    <div className="flex gap-2 mt-1.5 flex-wrap">
                      <span className="text-[9px] font-black bg-gray-100 text-gray-500 px-2 py-0.5 rounded-full uppercase">
                        {formatPatluDisplay(patlu, singles)}
                      </span>
                    </div>
                  </div>
                </div>
                <div className={`p-2 rounded-full bg-gray-50 transition-transform duration-500 ${expandedTanks[tank] ? 'rotate-180 bg-blue-50' : ''}`}>
                  <ChevronDown size={20} className={expandedTanks[tank] ? 'text-blue-500' : 'text-gray-400'} />
                </div>
              </button>

              {expandedTanks[tank] && (
                <div className="divide-y divide-gray-50 bg-white">
                  {tankEntries.map((entry, idx) => {
                    const serialNumber = totalInTank - idx; 
                    const running = processedGroups.runningTotalsMap[entry.id];
                    return (
                      <div key={entry.id} className={`group transition-all duration-300 animate-spring-up ${selectedIds.has(entry.id) ? 'bg-blue-50/70 translate-x-2' : 'bg-white hover:bg-gray-50/50'} ${deletingId === entry.id ? 'opacity-0 scale-90 blur-lg' : ''}`} style={{ animationDelay: `${idx * 0.05}s` }}>
                        {editingId === entry.id ? (
                          <div className={`p-6 bg-blue-50 border-l-8 ${getTankBorder(tank)} animate-spring-up`}>
                            <div className="flex items-center gap-2 mb-4">
                              <span className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Editing Row #{serialNumber}</span>
                            </div>
                            <div className="grid grid-cols-2 gap-4 mb-4">
                              <input type="number" step="0.01" value={editValues.weight || ''} onChange={(e) => setEditValues({...editValues, weight: parseFloat(e.target.value)})} className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 px-4 font-black text-2xl focus:border-blue-500 outline-none transition-all" />
                              <select value={editValues.crateCount || 1} onChange={(e) => setEditValues({...editValues, crateCount: parseInt(e.target.value)})} className="w-full bg-white border-2 border-gray-100 rounded-2xl py-4 px-4 font-black text-2xl focus:border-blue-500 outline-none transition-all">
                                <option value={1}>1 Crate</option>
                                <option value={2}>2 Crates</option>
                              </select>
                            </div>
                            <div className="flex gap-3">
                              <button onClick={cancelEdit} className="flex-1 bg-white text-gray-500 font-black py-4 rounded-2xl text-[10px] uppercase border hover:bg-gray-50 transition-colors">Cancel</button>
                              <button onClick={saveEdit} className={`flex-[2] text-white font-black py-4 rounded-2xl text-[10px] uppercase ${getTankColor(tank)} shadow-xl hover:brightness-110 active:scale-95 transition-all`}>Update Record</button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex flex-col">
                            <div className="p-5 flex items-center gap-4 relative">
                              <button onClick={() => handleToggleSelect(entry.id)} className={`p-2 rounded-xl transition-all active:scale-75 ${selectedIds.has(entry.id) ? getTankColor(tank) + ' text-white scale-110 shadow-lg' : 'bg-gray-50 text-gray-300'}`}>
                                {selectedIds.has(entry.id) ? <CheckSquare className="w-6 h-6" /> : <Square className="w-6 h-6" />}
                              </button>
                              <div className="flex-1">
                                <div className="flex items-center gap-3">
                                  <div className="flex flex-col items-center justify-center bg-gray-100 w-8 h-8 rounded-lg shrink-0 group-hover:bg-slate-900 group-hover:text-white transition-colors">
                                     <span className="text-[8px] font-black text-gray-400 uppercase leading-none mb-0.5 group-hover:text-slate-500">SN</span>
                                     <span className="text-xs font-black leading-none">{serialNumber}</span>
                                  </div>
                                  <span className="text-2xl font-black text-gray-900 tracking-tighter group-hover:text-blue-600 transition-colors">{entry.weight.toFixed(2)}kg</span>
                                  <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase transition-all ${entry.crateCount === 2 ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'}`}>
                                    {entry.crateCount === 2 ? 'Patlu' : 'Single'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-4 text-[9px] font-black text-gray-400 mt-1.5 uppercase">
                                  <Clock className="w-3 h-3 group-hover:text-blue-400" /> {new Date(entry.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}
                                  <User className="w-3 h-3 ml-2 group-hover:text-blue-400" /> {entry.team}
                                </div>
                              </div>
                              <div className="flex gap-2 transition-transform duration-300 group-hover:-translate-x-1">
                                {confirmingId === entry.id ? (
                                  <button onClick={(e) => confirmDelete(entry.id, e, entry.id)} className="px-4 py-2 bg-rose-600 text-white rounded-xl text-[10px] font-black uppercase shadow-lg shadow-rose-200 animate-heartbeat">Confirm Delete</button>
                                ) : (
                                  <>
                                    <button onClick={() => startEdit(entry)} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-blue-50 hover:text-blue-600 active:scale-90 transition-all"><Edit2 size={18} /></button>
                                    <button onClick={(e) => startDelete(entry.id, e)} className="p-3 bg-gray-50 text-gray-400 rounded-2xl hover:bg-rose-50 hover:text-rose-600 active:scale-90 transition-all"><Trash2 size={18} /></button>
                                  </>
                                )}
                              </div>
                            </div>
                            
                            {/* Cumulative Stats Row (Retrospective until this entry) */}
                            <div className="px-5 pb-4 pl-20">
                              <div className="bg-slate-50 border-l-4 border-slate-200 p-2.5 rounded-xl flex items-center justify-between animate-reveal">
                                <div className="flex items-center gap-4">
                                  <div className="flex flex-col">
                                    <span className="text-[7px] font-black text-slate-400 uppercase tracking-widest">Running Gross</span>
                                    <div className="flex items-center gap-1">
                                      <TrendingUp size={10} className="text-slate-300" />
                                      <span className="text-[11px] font-black text-slate-600">{running.runningGross.toFixed(1)} kg</span>
                                    </div>
                                  </div>
                                  <div className="h-6 w-[1px] bg-slate-200" />
                                  <div className="flex flex-col">
                                    <span className="text-[7px] font-black text-emerald-500 uppercase tracking-widest">Running Net</span>
                                    <div className="flex items-center gap-1">
                                      <BarChart size={10} className="text-emerald-300" />
                                      <span className="text-[11px] font-black text-emerald-600">{running.runningNet.toFixed(1)} kg</span>
                                    </div>
                                  </div>
                                </div>
                                <div className="text-right">
                                  <span className="text-[7px] font-black text-slate-300 uppercase block">Tank Progress</span>
                                  <span className="text-[9px] font-black text-slate-400">
                                    {((running.runningNet / tankGrossTotal) * 100).toFixed(0)}%
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })
      )}

      {selectedIds.size > 0 && (
        <div className="fixed bottom-24 left-4 right-4 z-50 animate-spring-up">
          <div className="bg-gray-900/95 backdrop-blur-lg text-white rounded-[2.5rem] p-5 flex items-center justify-between shadow-2xl ring-4 ring-blue-500/20">
            <div className="flex items-center gap-4 ml-2">
              <div className="bg-blue-600 w-12 h-12 rounded-2xl flex items-center justify-center font-black text-lg animate-heartbeat">
                {selectedIds.size}
              </div>
              <span className="text-[11px] font-black uppercase tracking-widest">Records Selected</span>
            </div>
            <button onClick={() => setIsBatchConfirming(true)} className="bg-rose-600 text-white font-black px-8 py-4 rounded-2xl text-xs uppercase tracking-widest hover:bg-rose-700 active:scale-95 transition-all shadow-xl shadow-rose-900/20">Batch Delete</button>
          </div>
        </div>
      )}

      {isBatchConfirming && (
        <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-300">
          <div className="bg-white rounded-[2.5rem] p-8 max-sm w-full shadow-2xl animate-spring-up">
            <div className="bg-rose-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6 ring-8 ring-rose-500/5">
              <AlertTriangle className="w-10 h-10 text-rose-600 animate-pulse" />
            </div>
            <h3 className="text-xl font-black text-gray-900 text-center uppercase mb-2">Delete {selectedIds.size} Items?</h3>
            <p className="text-xs text-gray-500 text-center mb-8 uppercase font-bold tracking-tight">This historical data will be removed permanently.</p>
            <div className="grid grid-cols-2 gap-4">
              <button onClick={() => setIsBatchConfirming(false)} className="py-4 bg-gray-100 rounded-2xl font-black uppercase text-[10px] hover:bg-gray-200 transition-colors">Abort</button>
              <button onClick={handleBatchDeleteClick} className="py-4 bg-rose-600 text-white rounded-2xl font-black uppercase text-[10px] shadow-xl shadow-rose-100 hover:bg-rose-700 active:scale-95 transition-all">Verify & Delete</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
