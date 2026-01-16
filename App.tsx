
import React, { useState, useEffect, useRef } from 'react';
import { 
  BrainCircuit, 
  Send, 
  LayoutDashboard, 
  FileText, 
  History, 
  ShieldCheck, 
  TrendingUp, 
  AlertCircle, 
  Sparkles, 
  ChevronRight, 
  Loader2, 
  RefreshCw, 
  Plus, 
  Link as LinkIcon,
  MessageSquare,
  CheckCircle2,
  CalendarDays,
  Paperclip,
  Image as ImageIcon,
  CheckCircle,
  XCircle,
  AlertTriangle,
  ClipboardCheck,
  Shield,
  Eye,
  Info
} from 'lucide-react';
import { CareerEntry, EntryType, ConfidenceLevel, ProcessingState, AppraisalSummary } from './types';
import { captureEntryTool } from './tools/capture_entry';
import { selfCorrectionQueueTool } from './tools/self_correction_queue';
import { weeklyReflectionTool } from './tools/weekly_reflection';
import { attachEvidenceTool } from './tools/attach_evidence';
import { generateAppraisalSummaryTool } from './tools/generate_appraisal_summary';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';

const App: React.FC = () => {
  const [entries, setEntries] = useState<CareerEntry[]>([]);
  const [input, setInput] = useState('');
  const [activeTab, setActiveTab] = useState<'dashboard' | 'history' | 'appraisal'>('dashboard');
  const [processing, setProcessing] = useState<ProcessingState>({ isProcessing: false, status: '' });
  const [summary, setSummary] = useState<AppraisalSummary | null>(null);
  const [clarificationResponse, setClarificationResponse] = useState<Record<string, string>>({});
  const [evidenceInput, setEvidenceInput] = useState('');
  const [showGuardrails, setShowGuardrails] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const saved = localStorage.getItem('career_track_memory_v6');
    if (saved) {
      setEntries(JSON.parse(saved));
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('career_track_memory_v6', JSON.stringify(entries));
  }, [entries]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || processing.isProcessing) return;

    setProcessing({ isProcessing: true, status: 'Agent: Capturing entry...' });
    try {
      const result = await captureEntryTool(input);
      let newEntry: CareerEntry = {
        entry_id: result.entry_id || Math.random().toString(36).substr(2, 9),
        timestamp: result.timestamp,
        raw_input: result.raw_input,
        thought_signature: result.thought_signature,
        category: result.category as EntryType,
        skills: result.skills,
        impact_summary: result.impact_summary,
        confidence_score: result.confidence_score as ConfidenceLevel,
        evidence_links: result.evidence_links || [],
        refinement_state: result.refinement_state as 'pending'
      };

      if (newEntry.confidence_score === ConfidenceLevel.LOW) {
        setProcessing({ isProcessing: true, status: 'Agent: Queuing clarification...' });
        const correction = await selfCorrectionQueueTool(newEntry);
        newEntry.clarification_question = correction.question;
      }

      setEntries(prev => [newEntry, ...prev]);
      setInput('');
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  const handleEvidenceUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || entries.length === 0) return;

    setProcessing({ isProcessing: true, status: 'Agent: Analyzing artifact...' });
    const reader = new FileReader();
    reader.onload = async (event) => {
      const base64 = event.target?.result as string;
      await processEvidence(base64, file.type, file.name);
    };
    reader.readAsDataURL(file);
  };

  const processEvidence = async (artifact: string, mimeType: string, label: string) => {
    try {
      const result = await attachEvidenceTool(artifact, entries, mimeType);
      
      if (result.is_match) {
        setProcessing({ isProcessing: true, status: `Agent: Matching evidence...` });
        setEntries(prev => prev.map(e => {
          if (e.entry_id === result.match_id) {
            return {
              ...e,
              evidence_links: [...(e.evidence_links || []), label],
              confidence_score: result.suggested_confidence as ConfidenceLevel,
              refinement_state: 'refined'
            };
          }
          return e;
        }));
      }
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      setEvidenceInput('');
    }
  };

  const handleLinkEvidence = async () => {
    if (!evidenceInput.trim() || entries.length === 0) return;
    setProcessing({ isProcessing: true, status: 'Agent: Analyzing link...' });
    await processEvidence(evidenceInput, 'text/plain', evidenceInput);
  };

  const handleWeeklyReflection = async () => {
    if (entries.length === 0 || processing.isProcessing) return;
    setProcessing({ isProcessing: true, status: 'Agent: Performing weekly reflection...' });
    try {
      const { refined_entries } = await weeklyReflectionTool(entries);
      setEntries(refined_entries);
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  const handleGenerateSummary = async () => {
    if (entries.length === 0 || processing.isProcessing) return;
    setProcessing({ isProcessing: true, status: 'Agent: Synthesizing appraisal...' });
    try {
      const result = await generateAppraisalSummaryTool(entries);
      setSummary(result);
      setActiveTab('appraisal');
    } catch (error) {
      console.error(error);
    } finally {
      setProcessing({ isProcessing: false, status: '' });
    }
  };

  const submitClarification = async (id: string) => {
    const responseText = clarificationResponse[id];
    if (!responseText || !responseText.trim()) return;

    setProcessing({ isProcessing: true, status: 'Agent: Updating memory...' });
    setEntries(prev => prev.map(e => {
      if (e.entry_id === id) {
        return {
          ...e,
          user_clarification_response: responseText,
          confidence_score: ConfidenceLevel.MEDIUM,
          refinement_state: 'pending'
        };
      }
      return e;
    }));
    setClarificationResponse(prev => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    setProcessing({ isProcessing: false, status: '' });
  };

  const getConfidenceValue = (level: ConfidenceLevel) => {
    switch (level) {
      case ConfidenceLevel.HIGH: return 100;
      case ConfidenceLevel.MEDIUM: return 66;
      case ConfidenceLevel.LOW: return 33;
      default: return 0;
    }
  };

  const stats = {
    achievements: entries.filter(e => e.category === EntryType.ACHIEVEMENT).length,
    challenges: entries.filter(e => e.category === EntryType.CHALLENGE).length,
    learnings: entries.filter(e => e.category === EntryType.LEARNING).length,
    pendingClarifications: entries.filter(e => e.clarification_question && !e.user_clarification_response).length,
    withEvidence: entries.filter(e => e.evidence_links.length > 0).length,
  };

  const chartData = [
    { name: 'Achievements', value: stats.achievements, color: '#10b981' },
    { name: 'Challenges', value: stats.challenges, color: '#f59e0b' },
    { name: 'Learnings', value: stats.learnings, color: '#3b82f6' },
  ].filter(d => d.value > 0);

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50 text-slate-900 font-sans">
      <nav className="w-full md:w-64 bg-white border-r border-slate-200 flex flex-col sticky top-0 h-auto md:h-screen z-20">
        <div className="p-6 flex items-center gap-3 border-b border-slate-100">
          <div className="bg-indigo-600 p-2 rounded-lg text-white shadow-indigo-100 shadow-lg">
            <BrainCircuit size={24} />
          </div>
          <div>
            <h1 className="font-bold text-xl tracking-tight text-slate-900">CareerTrack</h1>
            <p className="text-[10px] text-indigo-600 font-black uppercase tracking-widest">Memory Agent v3.1</p>
          </div>
        </div>

        <div className="flex-1 p-4 space-y-1">
          <NavItem active={activeTab === 'dashboard'} onClick={() => setActiveTab('dashboard')} icon={<LayoutDashboard size={20} />} label="Dashboard" />
          <NavItem active={activeTab === 'history'} onClick={() => setActiveTab('history')} icon={<History size={20} />} label="Memory Log" />
          <NavItem active={activeTab === 'appraisal'} onClick={() => setActiveTab('appraisal')} icon={<FileText size={20} />} label="Appraisal Sync" />
        </div>

        <div className="p-4 border-t border-slate-100 space-y-3">
           <button 
             onClick={handleWeeklyReflection}
             disabled={processing.isProcessing || entries.length === 0}
             className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-sm font-bold transition-all disabled:opacity-50"
           >
             <CalendarDays size={18} className={processing.isProcessing ? 'animate-spin' : ''} />
             Weekly Reflection
           </button>
           <div className="bg-indigo-50/50 p-4 rounded-xl flex items-center gap-3 border border-indigo-100 shadow-sm">
              <div className="h-2 w-2 rounded-full bg-indigo-500 animate-pulse"></div>
              <span className="text-[10px] font-black text-indigo-700 uppercase tracking-widest">Agent Logic Active</span>
           </div>
        </div>
      </nav>

      <main className="flex-1 overflow-y-auto relative">
        <div className="max-w-5xl mx-auto p-4 md:p-10">
          
          {processing.isProcessing && (
            <div className="fixed bottom-6 right-6 bg-white border border-slate-200 shadow-2xl rounded-2xl p-5 flex items-center gap-5 z-50 animate-in fade-in slide-in-from-bottom-4 ring-1 ring-black/5">
              <div className="bg-indigo-50 p-3 rounded-full">
                <Loader2 className="animate-spin text-indigo-600" size={24} />
              </div>
              <div>
                <p className="text-sm font-black text-slate-900 uppercase tracking-widest">{processing.status}</p>
                <p className="text-xs text-slate-500 font-medium italic">Autonomous reasoning in progress...</p>
              </div>
            </div>
          )}

          {activeTab === 'dashboard' && (
            <div className="space-y-8 animate-in fade-in duration-500">
              <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-emerald-100 text-emerald-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Live Session</span>
                    <span className="text-slate-300">/</span>
                    <button 
                      onClick={() => setShowGuardrails(!showGuardrails)}
                      className="text-indigo-600 text-[10px] font-black uppercase tracking-widest flex items-center gap-1 hover:bg-indigo-50 px-2 py-0.5 rounded transition-colors"
                    >
                      <Shield size={10} /> Safety Guardrails
                    </button>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Activity Stream</h2>
                  <p className="text-slate-500 mt-1 text-lg font-medium">Capture your progress. Let the agent handle the complexity.</p>
                </div>
                <button 
                  onClick={handleGenerateSummary}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-indigo-200 transition-all hover:scale-[1.02] active:scale-[0.98] uppercase tracking-widest text-sm"
                >
                  <Sparkles size={18} />
                  Synthesize Appraisal
                </button>
              </header>

              {showGuardrails && (
                <div className="bg-slate-900 text-white p-8 rounded-[40px] shadow-2xl animate-in slide-in-from-top-4 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-10 opacity-5 group-hover:opacity-10 transition-opacity">
                    <Shield size={160} />
                  </div>
                  <button onClick={() => setShowGuardrails(false)} className="absolute top-6 right-6 text-slate-500 hover:text-white transition-colors">
                    <XCircle size={24} />
                  </button>
                  <h3 className="text-indigo-400 font-black text-xs uppercase tracking-[0.2em] mb-6 flex items-center gap-2">
                    <Shield size={16} /> Reasoning & Safety Guardrails
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6 relative z-10">
                    <div className="space-y-4">
                      <GuardrailItem label="Missing Info" text="Acknowledge uncertainty instead of guessing outcomes." />
                      <GuardrailItem label="Integrity" text="Never exaggerate impact or assume promotions/recognition." />
                    </div>
                    <div className="space-y-4">
                      <GuardrailItem label="Objectivity" text="Prefer factual summaries over persuasive language." />
                      <GuardrailItem label="Grounding" text="Every claim MUST map to stored career memory entries." />
                    </div>
                  </div>
                </div>
              )}

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
                <div className="lg:col-span-8 bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 md:p-10 hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between mb-6">
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em]">New Entry</h3>
                    <div className="flex items-center gap-2 text-slate-300">
                      <div className="h-1 w-12 bg-slate-100 rounded-full"></div>
                      <Info size={14} className="hover:text-indigo-400 cursor-help" />
                    </div>
                  </div>
                  <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="relative group">
                      <textarea 
                        value={input}
                        onChange={(e) => setInput(e.target.value)}
                        placeholder="What did you work on today? Focus on the activity, I'll infer the impact."
                        className="w-full h-44 p-7 bg-slate-50 border-none rounded-[32px] focus:ring-4 focus:ring-indigo-100 resize-none text-slate-700 placeholder:text-slate-300 text-xl font-medium leading-relaxed shadow-inner transition-all group-hover:bg-slate-50/80"
                      ></textarea>
                      <button 
                        type="submit"
                        disabled={!input.trim() || processing.isProcessing}
                        className="absolute bottom-6 right-6 bg-indigo-600 text-white p-4 rounded-2xl hover:bg-indigo-700 transition-all shadow-xl shadow-indigo-100 disabled:opacity-50 hover:-translate-y-1 active:translate-y-0"
                      >
                        <Send size={28} />
                      </button>
                    </div>
                  </form>
                </div>

                <div className="lg:col-span-4 bg-white rounded-[40px] shadow-sm border border-slate-200 p-8 md:p-10 flex flex-col justify-between hover:shadow-md transition-shadow">
                  <div>
                    <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] mb-6">Attach Artifact</h3>
                    <div className="space-y-4">
                      <div className="relative">
                        <input 
                          type="text" 
                          value={evidenceInput}
                          onChange={(e) => setEvidenceInput(e.target.value)}
                          placeholder="Evidence URL..."
                          className="w-full bg-slate-50 border-none rounded-2xl px-5 py-4 text-sm font-bold focus:ring-4 focus:ring-indigo-100 pr-12 shadow-inner"
                        />
                        <button 
                          onClick={handleLinkEvidence}
                          disabled={!evidenceInput.trim() || entries.length === 0}
                          className="absolute right-2 top-2 p-2 text-indigo-600 hover:bg-indigo-100 rounded-xl disabled:opacity-30 transition-colors"
                        >
                          <Plus size={20} />
                        </button>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="h-px bg-slate-100 flex-1"></div>
                        <span className="text-[10px] font-black text-slate-300 uppercase">Artifact</span>
                        <div className="h-px bg-slate-100 flex-1"></div>
                      </div>
                      <input type="file" ref={fileInputRef} className="hidden" accept="image/*" onChange={handleEvidenceUpload} />
                      <button 
                        onClick={() => fileInputRef.current?.click()}
                        disabled={entries.length === 0}
                        className="w-full flex items-center justify-center gap-3 py-4 px-4 rounded-2xl border-2 border-dashed border-slate-200 text-slate-500 hover:text-indigo-600 hover:border-indigo-300 hover:bg-indigo-50/30 transition-all group disabled:opacity-30"
                      >
                        <ImageIcon size={20} className="group-hover:scale-110 transition-transform" />
                        <span className="text-sm font-black uppercase tracking-widest">Upload File</span>
                      </button>
                    </div>
                  </div>
                  <div className="mt-6 pt-6 border-t border-slate-100">
                    <div className="flex items-center gap-2 text-[10px] font-black text-indigo-400 uppercase tracking-tighter">
                      <Eye size={12} /> Autonomous Signature Matching
                    </div>
                  </div>
                </div>
              </div>

              {stats.pendingClarifications > 0 && (
                <div className="space-y-6">
                  <h3 className="text-xs font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3 ml-2">
                    <MessageSquare size={16} className="text-amber-500" /> Self-Correction Queue
                  </h3>
                  {entries.filter(e => e.clarification_question && !e.user_clarification_response).map(e => (
                    <div key={e.entry_id} className="bg-white border border-slate-200 rounded-[32px] p-8 animate-in slide-in-from-left-4 shadow-xl shadow-amber-900/5 relative overflow-hidden">
                       <div className="absolute top-0 left-0 h-full w-2 bg-amber-400"></div>
                       <div className="flex flex-col md:flex-row gap-8 items-start">
                         <div className="flex-1">
                            <p className="text-[10px] font-black text-amber-600 uppercase mb-3 tracking-[0.2em]">Clarification Requested</p>
                            <p className="text-xl text-slate-900 font-bold mb-6">"{e.clarification_question}"</p>
                            <div className="flex gap-4">
                                <input 
                                  type="text" 
                                  value={clarificationResponse[e.entry_id] || ''}
                                  onChange={(ev) => setClarificationResponse(prev => ({ ...prev, [e.entry_id]: ev.target.value }))}
                                  onKeyDown={(ev) => ev.key === 'Enter' && submitClarification(e.entry_id)}
                                  placeholder="Provide detail for context..."
                                  className="flex-1 bg-slate-50 border-none rounded-2xl px-6 py-4 text-base font-medium focus:outline-none focus:ring-4 focus:ring-amber-100 shadow-inner"
                                />
                                <button 
                                  onClick={() => submitClarification(e.entry_id)}
                                  className="bg-amber-500 text-white px-8 py-4 rounded-2xl text-sm font-black uppercase tracking-widest hover:bg-amber-600 transition-all shadow-lg shadow-amber-100"
                                >
                                  Update
                                </button>
                            </div>
                         </div>
                         <div className="w-full md:w-64 bg-slate-50 p-5 rounded-2xl border border-slate-100">
                           <p className="text-[10px] font-black text-slate-400 uppercase mb-2 tracking-widest">Entry Ref</p>
                           <p className="text-xs text-slate-600 font-medium italic leading-relaxed">"{e.raw_input}"</p>
                         </div>
                       </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
                <StatCard title="Achievements" value={stats.achievements} icon={<ShieldCheck className="text-emerald-500" />} color="emerald" />
                <StatCard title="Challenges" value={stats.challenges} icon={<AlertCircle className="text-amber-500" />} color="amber" />
                <StatCard title="Learnings" value={stats.learnings} icon={<TrendingUp className="text-blue-500" />} color="blue" />
                <StatCard title="Evidence" value={stats.withEvidence} icon={<Paperclip className="text-indigo-500" />} color="indigo" />
              </div>
            </div>
          )}

          {activeTab === 'history' && (
            <div className="animate-in fade-in duration-500 space-y-10">
              <header className="flex items-center justify-between">
                <div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Memory Log</h2>
                  <p className="text-slate-500 mt-1 text-lg font-medium">Factual history of autonomous interpretations.</p>
                </div>
                <div className="text-xs font-black text-indigo-700 bg-indigo-50 px-6 py-3 rounded-full border border-indigo-100 shadow-sm uppercase tracking-widest">
                  {entries.length} RECORDS
                </div>
              </header>

              <div className="space-y-8">
                {entries.map(entry => (
                  <div key={entry.entry_id} className={`bg-white p-10 rounded-[40px] border border-slate-200 shadow-sm hover:border-indigo-200 transition-all group ${entry.confidence_score === ConfidenceLevel.LOW ? 'ring-2 ring-amber-100 ring-offset-0' : ''}`}>
                    <div className="flex flex-col lg:flex-row gap-12">
                      <div className="flex-1 space-y-6">
                        <div className="flex items-center gap-4">
                          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest ${
                            entry.category === EntryType.ACHIEVEMENT ? 'bg-emerald-100 text-emerald-700' :
                            entry.category === EntryType.CHALLENGE ? 'bg-amber-100 text-amber-700' :
                            'bg-blue-100 text-blue-700'
                          }`}>
                            {entry.category}
                          </span>
                          <span className="text-xs text-slate-400 font-mono font-bold">
                            {new Date(entry.timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}
                          </span>
                          {entry.refinement_state === 'refined' && (
                            <span className="flex items-center gap-2 text-[10px] text-indigo-600 font-black bg-indigo-50 px-4 py-1 rounded-full uppercase tracking-[0.1em] border border-indigo-100">
                              <Sparkles size={10} /> Refined Log
                            </span>
                          )}
                        </div>
                        <div className="relative">
                          <p className="text-lg text-slate-600 leading-relaxed italic border-l-8 border-indigo-50 pl-8 py-3 bg-slate-50/30 rounded-r-[32px]">
                            "{entry.raw_input}"
                          </p>
                        </div>
                        
                        {entry.evidence_links.length > 0 && (
                          <div className="flex flex-wrap gap-3">
                             {entry.evidence_links.map((link, i) => (
                               <div key={i} className="flex items-center gap-3 bg-indigo-50/50 text-indigo-700 px-4 py-2 rounded-2xl border border-indigo-100 text-[10px] font-black uppercase tracking-widest shadow-sm">
                                 <Paperclip size={14} />
                                 <span className="truncate max-w-[200px]">{link}</span>
                               </div>
                             ))}
                          </div>
                        )}

                        {entry.user_clarification_response && (
                          <div className="bg-emerald-50/50 border border-emerald-100 p-6 rounded-[32px] flex items-start gap-4">
                             <div className="bg-emerald-100 p-2 rounded-xl">
                              <CheckCircle2 size={20} className="text-emerald-600 shrink-0" />
                             </div>
                             <div>
                                <p className="text-[10px] font-black text-emerald-700 uppercase mb-2 tracking-[0.2em]">Safety Correction Context</p>
                                <p className="text-base text-slate-700 font-bold italic">"{entry.user_clarification_response}"</p>
                             </div>
                          </div>
                        )}

                        <div className="pt-4 space-y-4">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] flex items-center gap-3">
                             <BrainCircuit size={14} className="text-indigo-400" /> Agent Inferred Impact
                          </p>
                          <p className="text-lg text-slate-800 font-bold leading-relaxed bg-slate-50 p-6 rounded-[32px] border border-slate-100 shadow-inner">
                            {entry.impact_summary}
                          </p>
                          <div className="flex items-center gap-2 text-[10px] font-mono text-slate-300 uppercase tracking-tighter">
                            Reasoning Signature: <span className="text-indigo-300 font-bold">{entry.thought_signature}</span>
                          </div>
                        </div>
                      </div>
                      <div className="w-full lg:w-64 shrink-0 space-y-8 bg-slate-50/50 p-8 rounded-[40px] border border-slate-100">
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-4">Core Skills</p>
                          <div className="flex flex-wrap gap-2">
                            {entry.skills.map(skill => (
                              <span key={skill} className="bg-white text-slate-700 px-4 py-1.5 rounded-xl text-[10px] font-black border border-slate-200 shadow-sm uppercase tracking-tighter">
                                {skill}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div>
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3">Logic Confidence</p>
                          <div className="flex items-center gap-4">
                            <div className="h-3 flex-1 bg-white rounded-full overflow-hidden border border-slate-200 shadow-inner">
                              <div className={`h-full rounded-full transition-all duration-1000 ${
                                entry.confidence_score === ConfidenceLevel.HIGH ? 'bg-emerald-500 shadow-lg shadow-emerald-200' :
                                entry.confidence_score === ConfidenceLevel.MEDIUM ? 'bg-indigo-500 shadow-lg shadow-indigo-200' : 'bg-amber-500 shadow-lg shadow-amber-200'
                              }`} style={{ width: `${getConfidenceValue(entry.confidence_score)}%` }}></div>
                            </div>
                            <span className="text-[10px] font-black font-mono text-slate-600 uppercase">{entry.confidence_score}</span>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'appraisal' && (
            <div className="animate-in fade-in duration-500 space-y-10 pb-20">
               <header className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className="bg-indigo-100 text-indigo-700 text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-tighter">Multi-Step Reasoning (Tool 5)</span>
                  </div>
                  <h2 className="text-4xl font-black text-slate-900 tracking-tight">Appraisal Sync</h2>
                  <p className="text-slate-500 mt-1 text-lg font-medium">Formal synthesis of long-term memory for reviews.</p>
                </div>
                <button 
                  onClick={handleGenerateSummary}
                  disabled={entries.length === 0 || processing.isProcessing}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white px-8 py-4 rounded-2xl font-black flex items-center gap-2 shadow-xl shadow-indigo-200 transition-all disabled:opacity-50 active:scale-95 uppercase tracking-widest text-sm"
                >
                  <RefreshCw size={18} className={processing.isProcessing ? 'animate-spin' : ''} />
                  Regenerate Sync
                </button>
              </header>

              {!summary && !processing.isProcessing && (
                <div className="text-center py-32 bg-white rounded-[60px] border border-slate-200 shadow-sm hover:shadow-md transition-shadow">
                  <FileText className="mx-auto text-slate-100 mb-8" size={100} />
                  <h3 className="text-slate-800 text-3xl font-black mb-4">Memory Sufficient</h3>
                  <p className="text-slate-500 max-w-sm mx-auto mb-10 text-xl font-medium leading-relaxed">Ready to synthesize {entries.length} data points into a high-integrity appraisal summary.</p>
                  <button 
                    onClick={handleGenerateSummary} 
                    className="bg-indigo-600 text-white px-12 py-5 rounded-[24px] font-black text-lg hover:bg-indigo-700 shadow-2xl shadow-indigo-200 transition-all hover:-translate-y-2 active:translate-y-0 uppercase tracking-widest"
                  >
                    Generate Appraisal
                  </button>
                </div>
              )}

              {summary && (
                <div className="space-y-12">
                   <div className="bg-gradient-to-br from-indigo-600 via-indigo-700 to-violet-900 p-12 md:p-16 rounded-[60px] text-white shadow-2xl relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-20 opacity-5 group-hover:opacity-10 transition-all duration-1000 rotate-12">
                      <Sparkles size={300} />
                    </div>
                    <div className="flex items-center gap-3 mb-8 bg-white/10 w-fit px-5 py-2 rounded-full border border-white/10">
                      <Shield size={16} className="text-indigo-200" />
                      <span className="text-indigo-100 text-[10px] font-black uppercase tracking-[0.2em]">Guardrail Compliant Narrative</span>
                    </div>
                    <h3 className="text-indigo-200 text-xs font-black uppercase tracking-[0.3em] mb-6">Executive Summary</h3>
                    <p className="text-2xl md:text-4xl font-black leading-tight relative z-10">{summary.executiveSummary}</p>
                    <div className="mt-12 flex flex-wrap gap-4 relative z-10">
                      <div className="text-indigo-50 text-[10px] bg-white/10 px-6 py-3 rounded-2xl border border-white/20 font-black tracking-widest uppercase">
                        Period: {summary.period}
                      </div>
                      <div className="text-emerald-300 text-[10px] bg-emerald-500/10 px-6 py-3 rounded-2xl border border-emerald-500/20 font-black tracking-widest uppercase flex items-center gap-2">
                        <CheckCircle size={14} /> Factual Grounding: 100%
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                    <div className="bg-white p-12 rounded-[60px] border border-slate-200 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                      <div className="absolute top-0 right-0 p-12 opacity-5"><ShieldCheck size={140} /></div>
                      <h4 className="font-black text-2xl mb-8 flex items-center gap-4 text-slate-800 relative z-10">
                        <ShieldCheck className="text-emerald-500" /> Top Strengths
                      </h4>
                      <ul className="space-y-6 relative z-10">
                        {summary.topStrengths.map((s, i) => (
                          <li key={i} className="flex items-start gap-5 text-slate-700 text-lg font-bold leading-relaxed">
                             <div className="h-8 w-8 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0 font-black text-xs border border-emerald-100 shadow-sm">{i+1}</div>
                             {s}
                          </li>
                        ))}
                      </ul>
                    </div>

                    <div className="bg-white p-12 rounded-[60px] border border-slate-200 shadow-sm relative overflow-hidden hover:shadow-md transition-shadow">
                      <div className="absolute top-0 right-0 p-12 opacity-5"><TrendingUp size={140} /></div>
                      <h4 className="font-black text-2xl mb-8 flex items-center gap-4 text-slate-800 relative z-10">
                        <TrendingUp className="text-blue-500" /> Strategic Focus
                      </h4>
                      <p className="text-slate-600 text-xl leading-relaxed mb-8 font-bold italic relative z-10 text-indigo-900/60">"{summary.recommendedFocus}"</p>
                      <div className="space-y-4 relative z-10">
                        {summary.growthAreas.map((g, i) => (
                          <div key={i} className="bg-slate-50 border border-slate-100 p-5 rounded-[24px] text-base text-slate-800 font-black flex items-center gap-4 shadow-sm">
                             <div className="h-2 w-2 rounded-full bg-blue-500"></div>
                             {g}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="bg-amber-50/50 p-12 rounded-[60px] border border-amber-100 shadow-sm border-l-[12px] border-l-amber-400 group">
                    <h4 className="font-black text-2xl mb-6 flex items-center gap-4 text-amber-900">
                      <AlertTriangle className="text-amber-500 group-hover:scale-110 transition-transform" /> Gap Analysis & Uncertainty
                    </h4>
                    <p className="text-amber-800 text-xl font-bold leading-relaxed">
                      {summary.gapAnalysis}
                    </p>
                    <div className="mt-6 flex items-center gap-2 text-amber-600/60 text-[10px] font-black uppercase tracking-widest">
                      <Shield size={12} /> Guardrail: Acknowledging missing metrics
                    </div>
                  </div>

                  <div className="bg-white p-12 md:p-16 rounded-[60px] border border-slate-200 shadow-sm">
                    <h4 className="font-black text-2xl mb-12 flex items-center gap-4 text-slate-800">
                      <ClipboardCheck className="text-indigo-600" /> Key Achievements (Manager-Ready)
                    </h4>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
                      {summary.keyAchievements.map((ach, i) => (
                        <div key={i} className="p-10 rounded-[40px] bg-slate-50 border border-slate-100 hover:bg-white hover:border-indigo-300 transition-all shadow-sm hover:shadow-xl group">
                          <p className="text-slate-800 text-xl font-black leading-tight mb-6 group-hover:text-indigo-900 transition-colors">{ach}</p>
                          <div className="h-2 w-20 bg-indigo-100 rounded-full group-hover:bg-indigo-600 transition-all"></div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
};

const NavItem: React.FC<{ active: boolean, onClick: () => void, icon: React.ReactNode, label: string }> = ({ active, onClick, icon, label }) => (
  <button onClick={onClick} className={`w-full flex items-center gap-4 px-6 py-4 rounded-2xl transition-all duration-300 group ${active ? 'bg-indigo-50 text-indigo-700 shadow-indigo-100/50 shadow-md ring-1 ring-indigo-100' : 'text-slate-500 hover:bg-slate-50 hover:text-slate-900'}`}>
    <span className={`${active ? 'text-indigo-600' : 'text-slate-400 group-hover:text-slate-600'}`}>{icon}</span>
    <span className="text-sm font-black tracking-widest uppercase">{label}</span>
  </button>
);

const StatCard: React.FC<{ title: string, value: number, icon: React.ReactNode, color: string }> = ({ title, value, icon, color }) => (
  <div className="bg-white p-8 rounded-[40px] border border-slate-200 shadow-sm group hover:shadow-xl transition-all hover:-translate-y-2 relative overflow-hidden">
    <div className={`absolute top-0 right-0 p-12 opacity-5 bg-${color}-500 blur-3xl rounded-full -mr-16 -mt-16`}></div>
    <div className="flex justify-between items-start mb-8 relative z-10">
      <div className={`p-4 rounded-3xl bg-${color}-50 border border-${color}-100 shadow-sm`}>
        {icon}
      </div>
    </div>
    <div className="flex items-end justify-between relative z-10">
      <h4 className="text-slate-400 font-black text-[10px] uppercase tracking-[0.2em]">{title}</h4>
      <span className="text-5xl font-black text-slate-900 leading-none tracking-tighter">{value}</span>
    </div>
  </div>
);

const GuardrailItem: React.FC<{ label: string, text: string }> = ({ label, text }) => (
  <div className="flex items-start gap-4">
    <div className="mt-1 h-2 w-2 rounded-full bg-indigo-500 shrink-0 shadow-lg shadow-indigo-500/50"></div>
    <div>
      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{label}</p>
      <p className="text-sm font-medium text-slate-200">{text}</p>
    </div>
  </div>
);

export default App;
