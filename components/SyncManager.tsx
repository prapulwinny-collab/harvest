
import React, { useState, useEffect, useMemo } from 'react';
import { CloudUpload, Download, CheckCircle, AlertCircle, Loader2, Info, FileText, Database, HardDrive, Link, RefreshCw, Copy, ExternalLink, HelpCircle, Calendar, X, CheckSquare, Square, ListFilter, ShieldCheck, AlertOctagon, AlertTriangle, MapPin, Layers, Table, Settings2, FileSpreadsheet, Lock, Unlock, ChevronRight, Terminal, Zap } from 'lucide-react';
import { HarvestEntry, HarvestSettings, TankSummary, getTankColorName } from '../types';
import { DBService } from '../db';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable';

interface SyncManagerProps {
  entries: HarvestEntry[];
  settings: HarvestSettings;
  onSyncComplete: () => void;
  onUpdateSettings: (updates: Partial<HarvestSettings>) => void;
}

export const SyncManager: React.FC<SyncManagerProps> = ({ entries, settings, onSyncComplete, onUpdateSettings }) => {
  const [syncing, setSyncing] = useState(false);
  const [recalling, setRecalling] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [totalDbCount, setTotalDbCount] = useState<number | null>(null);
  const [result, setResult] = useState<{ type: 'success' | 'error', message: string } | null>(null);
  const [showInstructions, setShowInstructions] = useState(false);
  
  const [showSessionPicker, setShowSessionPicker] = useState(false);
  const [selectedSessions, setSelectedSessions] = useState<Set<string>>(new Set());

  const isWebhookUrl = settings.googleSheetUrl?.includes('/macros/s/') || settings.googleSheetUrl?.includes('/exec');

  const availableSessions = useMemo(() => {
    const sessions = new Set<string>();
    entries.forEach(e => {
        const key = `${e.farmName || 'Default'}|||${e.sessionName || 'Default'}`;
        sessions.add(key);
    });
    return Array.from(sessions).sort((a, b) => b.localeCompare(a));
  }, [entries]);

  useEffect(() => {
    const fetchCount = async () => {
      const count = await DBService.getCount();
      setTotalDbCount(count);
    };
    fetchCount();
  }, [entries]);

  const toggleSession = (key: string) => {
    const next = new Set(selectedSessions);
    if (next.has(key)) next.delete(key);
    else next.add(key);
    setSelectedSessions(next);
  };

  const handlePushToSheets = async () => {
    if (!settings.googleSheetUrl) {
      setResult({ type: 'error', message: 'Configure URL first.' });
      return;
    }

    if (!isWebhookUrl) {
      setResult({ type: 'error', message: 'Bridge URL required for direct sync.' });
      setShowInstructions(true);
      return;
    }

    const unsyncedEntries = entries.filter(e => !e.synced);
    if (unsyncedEntries.length === 0) {
       setResult({ type: 'success', message: 'Cloud is already up to date!' });
       return;
    }

    setSyncing(true);
    setResult(null);

    try {
      await fetch(settings.googleSheetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unsyncedEntries)
      });

      const idsToSync = unsyncedEntries.map(e => e.id);
      await DBService.markSynced(idsToSync);
      setResult({ type: 'success', message: `Manual Sync Success (${idsToSync.length} items)` });
      onSyncComplete();
    } catch (error) {
      setResult({ type: 'error', message: 'Connection Error.' });
    } finally {
      setSyncing(false);
    }
  };

  const handleRecallFromSheets = async () => {
    if (!isWebhookUrl) {
      setResult({ type: 'error', message: 'Webhook URL required for Recall.' });
      setShowInstructions(true);
      return;
    }

    setRecalling(true);
    setResult(null);

    try {
      const response = await fetch(settings.googleSheetUrl);
      const data = await response.json();
      
      if (!Array.isArray(data)) throw new Error('Invalid Format');

      const recalledEntries: HarvestEntry[] = data.slice(1).map((row: any[]) => ({
        id: String(row[0]),
        tank: String(row[1]),
        count: Number(row[2]),
        weight: Number(row[3]),
        crateWeight: Number(row[5] || 1.8),
        crateCount: Number(row[4] || 1),
        team: String(row[6]),
        timestamp: String(row[7]),
        synced: true,
        farmName: String(row[8]),
        sessionName: String(row[9])
      })).filter(e => e.id && e.id.startsWith('id_'));

      await DBService.upsertEntries(recalledEntries);
      setResult({ type: 'success', message: `Restored ${recalledEntries.length} items.` });
      onSyncComplete();
    } catch (error) {
      setResult({ type: 'error', message: 'Recall failed. Check Webhook.' });
    } finally {
      setRecalling(false);
    }
  };

  const handleDownloadPDF = async () => {
    if (selectedSessions.size === 0) return;
    setGeneratingPdf(true);
    try {
      const filteredEntries = entries.filter(e => selectedSessions.has(`${e.farmName}|||${e.sessionName}`));
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.getWidth();
      
      // Calculate Summaries
      const tankMap = new Map<string, TankSummary>();
      let totalGross = 0;
      let totalNet = 0;
      
      filteredEntries.forEach(e => {
        const tare = (e.crateCount || 1) * (e.crateWeight || 1.8);
        const net = Math.max(0, e.weight - tare);
        totalGross += e.weight;
        totalNet += net;
        
        const current = tankMap.get(e.tank) || {
          tank: e.tank, entryCount: 0, patluCount: 0, singlesCount: 0,
          crateCount: 0, totalWeight: 0, absoluteWeight: 0, shrimpCount: e.count
        };
        current.entryCount++;
        current.crateCount += (e.crateCount || 1);
        if (e.crateCount === 2) current.patluCount++;
        else current.singlesCount++;
        current.totalWeight += e.weight;
        current.absoluteWeight += net;
        current.shrimpCount = e.count;
        tankMap.set(e.tank, current);
      });

      const tankSummaries = Array.from(tankMap.values()).sort((a,b) => a.tank.localeCompare(b.tank));
      const totalRevenue = tankSummaries.reduce((acc, s) => {
        const price = parseFloat(settings.tankPrices[s.tank] || '0') || 0;
        return acc + (s.absoluteWeight * price);
      }, 0);

      // --- PAGE 1: EXECUTIVE SUMMARY & DASHBOARD ---
      doc.setFillColor(15, 23, 42); // Slate-900
      doc.rect(0, 0, pageWidth, 40, 'F');
      
      doc.setFont("helvetica", "bold");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(20);
      doc.text("HARVEST PERFORMANCE AUDIT", 14, 25);
      
      doc.setFontSize(9);
      doc.setFont("helvetica", "normal");
      // Fix: Explicitly type 's' as string to avoid property 'split' error on 'unknown' type
      doc.text(`FARM: ${Array.from(selectedSessions).map((s: string) => s.split('|||')[0]).join(', ')}`, 14, 34);
      doc.text(`SESSION: ${Array.from(selectedSessions).map((s: string) => s.split('|||')[1]).join(', ')}`, 14, 38);

      // Dashboard Stats Grid
      let yPos = 55;
      const drawStat = (label: string, value: string, x: number, color: [number, number, number]) => {
        doc.setFillColor(248, 250, 252);
        doc.roundedRect(x, yPos, (pageWidth - 40) / 4, 25, 3, 3, 'F');
        doc.setTextColor(100, 116, 139);
        doc.setFontSize(7);
        doc.text(label.toUpperCase(), x + 5, yPos + 8);
        doc.setTextColor(...color);
        doc.setFontSize(12);
        doc.text(value, x + 5, yPos + 18);
      };

      drawStat("Net Yield", `${totalNet.toFixed(1)} KG`, 14, [15, 23, 42]);
      drawStat("Gross Weight", `${totalGross.toFixed(1)} KG`, 14 + (pageWidth - 36) / 4, [100, 116, 139]);
      drawStat("Efficiency", `${((totalNet/totalGross)*100).toFixed(1)}%`, 14 + 2 * (pageWidth - 36) / 4, [5, 150, 105]);
      drawStat("Est. Revenue", `INR ${totalRevenue.toLocaleString()}`, 14 + 3 * (pageWidth - 36) / 4, [5, 150, 105]);

      // Tank Yield Visualization (Mini Bars)
      yPos = 100;
      doc.setTextColor(15, 23, 42);
      doc.setFontSize(12);
      doc.text("Pond Yield Distribution", 14, yPos - 5);
      
      tankSummaries.forEach((sum, idx) => {
        const barY = yPos + (idx * 12);
        const maxWeight = Math.max(...tankSummaries.map(s => s.absoluteWeight));
        const barWidth = (sum.absoluteWeight / maxWeight) * (pageWidth - 80);
        
        doc.setFontSize(8);
        doc.setTextColor(71, 85, 105);
        doc.text(sum.tank, 14, barY + 6);
        
        doc.setFillColor(241, 245, 249);
        doc.rect(40, barY, pageWidth - 80, 8, 'F');
        doc.setFillColor(37, 99, 235);
        doc.rect(40, barY, barWidth, 8, 'F');
        
        doc.setTextColor(15, 23, 42);
        doc.setFont("helvetica", "bold");
        doc.text(`${sum.absoluteWeight.toFixed(1)}kg`, pageWidth - 35, barY + 6);
        doc.setFont("helvetica", "normal");
      });

      // Tank Metrics Table
      (doc as any).autoTable({
        startY: yPos + (tankSummaries.length * 12) + 15,
        head: [['Tank', 'Count', 'Net Yield', 'Gross', 'P+S Crates', 'Rev Rate', 'Valuation']],
        body: tankSummaries.map(s => [
          s.tank, 
          s.shrimpCount, 
          `${s.absoluteWeight.toFixed(1)} kg`, 
          `${s.totalWeight.toFixed(1)} kg`, 
          `${s.patluCount}P + ${s.singlesCount}S`,
          `Rs.${settings.tankPrices[s.tank] || '0'}`,
          `Rs.${((parseFloat(settings.tankPrices[s.tank]) || 0) * s.absoluteWeight).toLocaleString()}`
        ]),
        styles: { fontSize: 8, cellPadding: 4 },
        headStyles: { fillColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [249, 250, 251] }
      });

      // --- PAGE 2: DETAILED CRATE LOG ---
      doc.addPage();
      doc.setFillColor(15, 23, 42);
      doc.rect(0, 0, pageWidth, 25, 'F');
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(14);
      doc.text("CRATE TRANSACTION LEDGER", 14, 17);

      (doc as any).autoTable({
        startY: 35,
        head: [['SN', 'Time', 'Tank', 'Count', 'Weight (Gross)', 'Tare', 'Net Yield', 'Team']],
        body: filteredEntries.map((e, idx) => {
          const tare = (e.crateCount || 1) * (e.crateWeight || 1.8);
          return [
            filteredEntries.length - idx,
            new Date(e.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            e.tank,
            e.count,
            `${e.weight.toFixed(2)}`,
            `${tare.toFixed(1)} (${e.crateCount}c)`,
            `${Math.max(0, e.weight - tare).toFixed(2)}`,
            e.team
          ];
        }),
        styles: { fontSize: 7 },
        headStyles: { fillColor: [51, 65, 85] }
      });

      // Footer
      const pageCount = (doc as any).internal.getNumberOfPages();
      for(let i = 1; i <= pageCount; i++) {
        doc.setPage(i);
        doc.setFontSize(8);
        doc.setTextColor(148, 163, 184);
        doc.text(`Generated on ${new Date().toLocaleString()} | Page ${i} of ${pageCount}`, 14, doc.internal.pageSize.getHeight() - 10);
      }

      doc.save(`Harvest_Report_${Date.now()}.pdf`);
      setShowSessionPicker(false);
    } catch (err) {
      console.error(err);
      alert("PDF Error: " + err);
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleDownloadCSV = (filteredData?: HarvestEntry[]) => {
    const dataToExport = filteredData || entries;
    const headers = ['ID', 'Tank', 'Count', 'Weight', 'CrateCount', 'CrateWeight', 'Team', 'Timestamp', 'Farm', 'Session'];
    const rows = dataToExport.map(e => [e.id, e.tank, e.count, e.weight, e.crateCount, e.crateWeight, e.team, e.timestamp, e.farmName, e.sessionName]);
    const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `harvest_export_${Date.now()}.csv`;
    a.click();
    setShowSessionPicker(false);
  };

  return (
    <div className="max-w-md mx-auto space-y-6 pb-20">
      <div className="bg-white rounded-[2.5rem] p-8 border border-emerald-100 shadow-xl relative overflow-hidden">
        <div className="absolute -top-10 -right-10 bg-emerald-50 w-40 h-40 rounded-full blur-3xl opacity-50" />

        <div className="flex items-center justify-between mb-8 relative z-10">
          <div className="flex items-center gap-3">
            <div className="bg-emerald-600 p-2.5 rounded-2xl shadow-lg">
              <CloudUpload className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-black text-gray-900 leading-none">Cloud Sync Hub</h2>
              <p className="text-[9px] font-black text-emerald-600 uppercase mt-1">G-Sheets Integration</p>
            </div>
          </div>
          <button onClick={() => setShowInstructions(!showInstructions)} className="p-2 bg-gray-50 rounded-xl text-gray-400">
            <HelpCircle className="w-5 h-5" />
          </button>
        </div>

        <div className="space-y-6 relative z-10">
          <div className="bg-blue-50/50 rounded-2xl p-4 flex items-center gap-3 border border-blue-100">
             <Zap className="w-5 h-5 text-blue-600 animate-pulse" />
             <div>
               <p className="text-[10px] font-black text-blue-900 uppercase leading-none">Auto-Sync Active</p>
               <p className="text-[9px] font-bold text-blue-700 mt-1">Data will sync automatically when internet is detected.</p>
             </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center justify-between px-1">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Bridge Webhook URL</label>
              <div className={`flex items-center gap-1 text-[8px] font-black uppercase ${isWebhookUrl ? 'text-emerald-500' : 'text-amber-500'}`}>
                {isWebhookUrl ? <CheckCircle className="w-2.5 h-2.5" /> : <AlertCircle className="w-2.5 h-2.5" />}
                {isWebhookUrl ? 'Bridge Active' : 'Setup Required'}
              </div>
            </div>
            <input 
              type="text" 
              placeholder="Paste Google Apps Script URL here..." 
              value={settings.googleSheetUrl || ''} 
              onChange={(e) => onUpdateSettings({ googleSheetUrl: e.target.value })}
              className={`w-full bg-gray-50 border-2 rounded-2xl py-4 px-4 text-[11px] font-bold transition-all focus:outline-none ${isWebhookUrl ? 'border-emerald-100 focus:border-emerald-500' : 'border-gray-100 focus:border-blue-500'}`}
            />
          </div>

          {showInstructions && (
            <div className="bg-blue-50 border border-blue-100 rounded-2xl p-5 space-y-3 animate-in fade-in zoom-in-95 duration-200">
              <div className="flex items-center gap-2 mb-1">
                <Terminal className="w-4 h-4 text-blue-600" />
                <p className="text-[10px] font-black text-blue-900 uppercase">Setup Instructions</p>
              </div>
              <ol className="text-[9px] font-bold text-blue-700 space-y-2 list-decimal ml-4">
                <li>Open your Google Sheet</li>
                <li>Go to <b>Extensions &gt; Apps Script</b></li>
                <li>Paste the Bridge Code provided by the system</li>
                <li>Click <b>Deploy &gt; New Deployment</b></li>
                <li>Set Access to <b>"Anyone"</b> and click Deploy</li>
                <li>Copy the "Web App URL" and paste it above</li>
              </ol>
            </div>
          )}

          {result && (
            <div className={`p-4 rounded-2xl flex items-center gap-3 ${result.type === 'success' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-700 border border-red-100'}`}>
              <span className="text-[10px] font-black uppercase tracking-wider">{result.message}</span>
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <button 
              onClick={handlePushToSheets} 
              disabled={syncing}
              className="bg-emerald-600 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95"
            >
              {syncing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CloudUpload className="w-4 h-4" />}
              Push Manually
            </button>
            <button 
              onClick={handleRecallFromSheets} 
              disabled={recalling}
              className="bg-blue-600 disabled:opacity-50 text-white py-5 rounded-2xl font-black text-[10px] uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95"
            >
              {recalling ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
              Recall Session
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-4 px-1">
        <div className="flex items-center gap-2 mb-2">
           <HardDrive className="w-3.5 h-3.5 text-gray-400" />
           <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Local Exports</span>
        </div>
        
        <button
          onClick={() => setShowSessionPicker(true)}
          className="w-full bg-white text-gray-900 border-2 border-gray-100 py-6 px-6 rounded-[2rem] font-black flex items-center justify-between shadow-lg"
        >
          <div className="flex items-center gap-4">
            <FileText className="w-6 h-6 text-blue-600" />
            <span className="text-sm uppercase tracking-wider">Generate Audit PDF</span>
          </div>
          <ChevronRight className="w-5 h-5 text-gray-300" />
        </button>

        <button
          onClick={() => handleDownloadCSV()}
          disabled={entries.length === 0}
          className="w-full bg-white text-gray-700 border border-gray-100 py-5 px-6 rounded-[2rem] font-bold flex items-center justify-between"
        >
          <div className="flex items-center gap-4">
            <Table className="w-5 h-5 text-gray-400" />
            <span className="text-[10px] uppercase font-black">Full CSV Backup</span>
          </div>
          <span className="text-xs bg-gray-100 px-2.5 py-1 rounded-lg text-gray-500 font-black">{entries.length}</span>
        </button>
      </div>

      {showSessionPicker && (
        <div className="fixed inset-0 z-[100] bg-gray-900/90 backdrop-blur-md flex items-end justify-center p-4">
          <div className="bg-white w-full max-w-sm rounded-[2.5rem] p-6 max-h-[85vh] flex flex-col">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black uppercase">Select Dataset</h3>
              <button onClick={() => setShowSessionPicker(false)} className="p-2 bg-gray-50 rounded-full"><X className="w-6 h-6 text-gray-400" /></button>
            </div>
            <div className="flex-1 overflow-y-auto space-y-3">
              {availableSessions.map(key => {
                const [farm, session] = key.split('|||');
                const isSelected = selectedSessions.has(key);
                return (
                  <button 
                    key={key} 
                    onClick={() => toggleSession(key)}
                    className={`w-full p-4 rounded-2xl border-2 text-left flex items-center justify-between ${isSelected ? 'bg-blue-50 border-blue-600' : 'bg-gray-50 border-transparent'}`}
                  >
                    <div>
                      <p className="font-black text-sm text-gray-800">{farm}</p>
                      <p className="text-[10px] font-bold text-gray-400 uppercase">{session}</p>
                    </div>
                    {isSelected ? <CheckSquare className="text-blue-600" /> : <Square className="text-gray-200" />}
                  </button>
                );
              })}
            </div>
            <div className="grid grid-cols-2 gap-3 mt-8">
              <button onClick={handleDownloadPDF} disabled={generatingPdf} className="py-5 bg-blue-600 text-white rounded-2xl font-black uppercase text-[10px]">
                {generatingPdf ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : 'GENERATE PDF'}
              </button>
              <button onClick={() => handleDownloadCSV()} className="py-5 bg-emerald-600 text-white rounded-2xl font-black uppercase text-[10px]">CSV Archive</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
