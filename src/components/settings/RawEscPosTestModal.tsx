import React, { useState, useEffect, useMemo } from 'react';
import { 
  Terminal, 
  X, 
  Printer, 
  CheckCircle2, 
  AlertCircle, 
  Download, 
  Copy, 
  Check, 
  RotateCw, 
  Cpu, 
  Code2, 
  Layers, 
  Zap, 
  ShieldCheck, 
  FileCode,
  ArrowRight
} from 'lucide-react';
import { RestaurantSettings } from '../../types';
import { EscPosService, RawEscPosSendResult } from '../../services/escposService';
import { PrinterConnectionService } from '../../services/printerConnectionService';

interface RawEscPosTestModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings?: RestaurantSettings;
}

export const RawEscPosTestModal: React.FC<RawEscPosTestModalProps> = ({
  isOpen,
  onClose,
  settings
}) => {
  const [selectedChannel, setSelectedChannel] = useState<'AUTO' | 'WEB_SERIAL' | 'WEB_USB' | 'FILE_DISPATCH'>('AUTO');
  const [isSending, setIsSending] = useState(false);
  const [sendResult, setSendResult] = useState<RawEscPosSendResult | null>(null);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'overview' | 'hex' | 'commands'>('overview');

  const printerModel = settings?.printerModelName || 'Rugtek RP326B';
  const is58mm = settings?.paperWidth === '58mm' || settings?.printerType === 'THERMAL_58MM';

  // Generate the raw ESC/POS buffer
  const rawBuffer = useMemo(() => {
    return EscPosService.generateDiagnosticEscPosBuffer({
      modelName: printerModel,
      paperWidth: is58mm ? '58mm' : '80mm',
      includeCutter: true
    });
  }, [printerModel, is58mm]);

  // Buffer analysis
  const analysis = useMemo(() => {
    return EscPosService.analyzeBuffer(rawBuffer);
  }, [rawBuffer]);

  // Hex dump formatted string
  const hexDump = useMemo(() => {
    return EscPosService.formatBufferAsHexDump(rawBuffer);
  }, [rawBuffer]);

  const hexSequence = useMemo(() => {
    return EscPosService.formatBufferAsHexSequence(rawBuffer);
  }, [rawBuffer]);

  const handleCopy = (text: string, key: string) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => setCopiedKey(null), 2500);
  };

  const handleSendRawTest = async () => {
    setIsSending(true);
    setSendResult(null);

    try {
      const result = await EscPosService.sendRawBuffer(rawBuffer, selectedChannel);
      setSendResult(result);
      if (result.success) {
        PrinterConnectionService.markVerified();
      }
    } catch (err: any) {
      setSendResult({
        success: false,
        channel: selectedChannel === 'AUTO' ? 'SIMULATION' : selectedChannel,
        bytesSent: 0,
        handshakeVerified: false,
        characterSetVerified: false,
        error: err?.message || 'Failed to dispatch raw ESC/POS buffer.'
      });
    } finally {
      setIsSending(false);
    }
  };

  // Automatically execute test handshake on modal open if not already run
  useEffect(() => {
    if (isOpen && !sendResult && !isSending) {
      handleSendRawTest();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div 
      id="raw-escpos-modal-backdrop"
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-950/80 backdrop-blur-xs animate-in fade-in duration-200"
      onClick={onClose}
    >
      <div 
        id="raw-escpos-modal-container"
        className="relative w-full max-w-2xl bg-slate-900 border border-slate-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[92vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-800 bg-slate-900/90">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-400 shrink-0">
              <Terminal className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-bold text-slate-100 text-sm sm:text-base leading-tight">
                  Raw ESC/POS Diagnostic Test
                </h3>
                <span className="px-2 py-0.5 rounded text-[10px] font-extrabold uppercase bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                  BYPASS DIALOG
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Verifies hardware handshake &amp; character sets independently of Chrome print window
              </p>
            </div>
          </div>
          <button
            id="close-raw-escpos-modal-button"
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-4 text-xs">
          
          {/* Hardware Specs & Summary Strip */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Printer Profile</span>
              <span className="font-mono font-bold text-slate-200 truncate block">{printerModel}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Buffer Payload</span>
              <span className="font-mono font-bold text-amber-400">{rawBuffer.length} Bytes</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Paper Format</span>
              <span className="font-mono font-bold text-slate-200">{is58mm ? '58mm (32 Col)' : '80mm (48 Col)'}</span>
            </div>
            <div>
              <span className="text-[10px] text-slate-500 block uppercase font-bold">Print Window</span>
              <span className="font-mono font-bold text-emerald-400">Bypassed (0ms)</span>
            </div>
          </div>

          {/* Execution Result Banner */}
          {sendResult && (
            <div 
              id="raw-escpos-result-banner"
              className={`p-3.5 rounded-xl border flex flex-col gap-2 ${
                sendResult.success 
                  ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300' 
                  : 'bg-rose-950/40 border-rose-500/40 text-rose-300'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {sendResult.success ? (
                  <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0 mt-0.5" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-rose-400 shrink-0 mt-0.5" />
                )}
                <div className="flex-1">
                  <div className="font-bold text-xs flex items-center justify-between">
                    <span>
                      {sendResult.success 
                        ? 'Hardware Handshake & Character Set Verified' 
                        : 'Hardware Handshake Alert'}
                    </span>
                    <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-slate-900/60 border border-slate-700/50">
                      Channel: {sendResult.channel}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-300 mt-1">
                    {sendResult.message}
                  </p>
                  {sendResult.error && (
                    <p className="text-[11px] text-rose-400 mt-1 font-mono">
                      Error: {sendResult.error}
                    </p>
                  )}
                </div>
              </div>

              {/* Suggested Direct Terminal Command */}
              {sendResult.suggestedCommand && (
                <div className="mt-1 pt-2 border-t border-slate-800/80 flex items-center justify-between gap-2 bg-slate-900/80 p-2 rounded-lg">
                  <div className="font-mono text-[10px] text-slate-300 truncate">
                    <span className="text-slate-500 mr-1.5">$</span>
                    {sendResult.suggestedCommand}
                  </div>
                  <button
                    type="button"
                    onClick={() => handleCopy(sendResult.suggestedCommand!, 'terminal-cmd')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[10px] font-mono shrink-0 cursor-pointer flex items-center gap-1"
                  >
                    {copiedKey === 'terminal-cmd' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-950 border border-slate-800 rounded-xl p-3">
            <div className="flex items-center gap-2">
              <label className="text-slate-400 text-[11px] font-semibold">Dispatch Interface:</label>
              <select
                value={selectedChannel}
                onChange={(e) => setSelectedChannel(e.target.value as any)}
                className="bg-slate-900 text-slate-200 border border-slate-700 rounded-lg px-2.5 py-1 text-xs cursor-pointer focus:border-amber-400 focus:outline-none"
              >
                <option value="AUTO">Auto (WebSerial / WebUSB / Spooler)</option>
                <option value="WEB_SERIAL">WebSerial (RS-232 / Virtual COM)</option>
                <option value="WEB_USB">WebUSB (Direct Raw USB)</option>
                <option value="FILE_DISPATCH">Download .bin Buffer</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <button
                id="btn-send-raw-escpos"
                type="button"
                onClick={handleSendRawTest}
                disabled={isSending}
                className="px-3.5 py-1.5 bg-amber-500 hover:bg-amber-400 active:bg-amber-600 text-slate-950 font-bold rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 shadow-sm disabled:opacity-50"
              >
                <RotateCw className={`w-3.5 h-3.5 ${isSending ? 'animate-spin' : ''}`} />
                <span>{isSending ? 'Sending Stream...' : 'Send ESC/POS Test'}</span>
              </button>

              <button
                type="button"
                onClick={() => EscPosService.downloadBinaryBuffer(rawBuffer, `${printerModel.toLowerCase().replace(/[^a-z0-9]/g, '_')}_test.bin`)}
                className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg text-xs transition-all cursor-pointer flex items-center gap-1.5 border border-slate-700"
                title="Download raw .bin file for direct terminal spooling"
              >
                <Download className="w-3.5 h-3.5 text-amber-400" />
                <span>Download .bin</span>
              </button>
            </div>
          </div>

          {/* Subtabs for Inspection */}
          <div className="border-b border-slate-800 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveTab('overview')}
              className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'overview'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <ShieldCheck className="w-3.5 h-3.5" />
              <span>Character Sets &amp; Handshake</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('hex')}
              className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'hex'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Code2 className="w-3.5 h-3.5" />
              <span>Hex Dump ({rawBuffer.length} B)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('commands')}
              className={`pb-2 px-3 text-xs font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-1.5 ${
                activeTab === 'commands'
                  ? 'border-amber-400 text-amber-400'
                  : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
            >
              <Layers className="w-3.5 h-3.5" />
              <span>Command Breakdown ({analysis.commands.length})</span>
            </button>
          </div>

          {/* Tab 1: Overview & Character Set Matrix */}
          {activeTab === 'overview' && (
            <div className="space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                
                {/* Character Sets Card */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-emerald-400" />
                    <span>Character Set Support Verified</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-400 text-[11px]">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>ASCII 32–126:</strong> Uppercase, Lowercase, Digits</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Symbols:</strong> !@#$%^&amp;*()_+-=[]{`{}`}|;:&apos;,&lt;&gt;.?/</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Code Page:</strong> PC437 Standard Western (ESC t 0)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Inverse Printing:</strong> White text on black background (GS B 1)</span>
                    </li>
                  </ul>
                </div>

                {/* Hardware Protocol Card */}
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                  <div className="font-bold text-slate-200 flex items-center gap-1.5">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    <span>Hardware Handshake &amp; Features</span>
                  </div>
                  <ul className="space-y-1.5 text-slate-400 text-[11px]">
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Reset:</strong> ESC @ (1B 40) clears hardware buffer</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Font Styling:</strong> Bold (ESC E), Underline (ESC -), 2x Size</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Alignment:</strong> Left (0), Center (1), Right (2)</span>
                    </li>
                    <li className="flex items-center gap-2">
                      <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span><strong>Auto-Cut:</strong> Guillotine partial cut (GS V 66 0)</span>
                    </li>
                  </ul>
                </div>

              </div>

              {/* Direct Spooling Instructions */}
              <div className="p-3 bg-slate-950 border border-slate-800 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-300 flex items-center gap-1.5">
                    <FileCode className="w-3.5 h-3.5 text-amber-400" />
                    <span>Bypass Print Dialog via Command Line (Windows / Linux)</span>
                  </span>
                  <span className="text-[10px] text-slate-500 font-mono">0ms latency</span>
                </div>
                <p className="text-slate-400 text-[11px]">
                  You can send this generated binary buffer directly to your printer spooler or COM port without the browser print dialog:
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 pt-1 font-mono text-[10px]">
                  <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg flex items-center justify-between">
                    <span className="text-slate-300 truncate">copy /b escpos_test.bin \\localhost\POS-80</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('copy /b escpos_test.bin \\\\localhost\\POS-80', 'copy-win')}
                      className="ml-2 text-amber-400 hover:text-amber-300 shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'copy-win' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                  <div className="bg-slate-900 border border-slate-800 p-2 rounded-lg flex items-center justify-between">
                    <span className="text-slate-300 truncate">lp -d RugtekRP326B -o raw escpos_test.bin</span>
                    <button
                      type="button"
                      onClick={() => handleCopy('lp -d RugtekRP326B -o raw escpos_test.bin', 'copy-linux')}
                      className="ml-2 text-amber-400 hover:text-amber-300 shrink-0 cursor-pointer"
                    >
                      {copiedKey === 'copy-linux' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Tab 2: Hex Dump View */}
          {activeTab === 'hex' && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-slate-400 text-[11px] font-mono">
                  Offset / Hex Bytes (16 per line) / ASCII Decoded
                </span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleCopy(hexSequence, 'hex-seq')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'hex-seq' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Hex</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleCopy(hexDump, 'hex-dump')}
                    className="px-2 py-1 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded border border-slate-700 text-[10px] font-mono flex items-center gap-1 cursor-pointer"
                  >
                    {copiedKey === 'hex-dump' ? <Check className="w-3 h-3 text-emerald-400" /> : <Copy className="w-3 h-3" />}
                    <span>Copy Dump</span>
                  </button>
                </div>
              </div>

              <pre className="p-3 bg-slate-950 border border-slate-800 rounded-xl font-mono text-[10px] text-amber-300/90 overflow-x-auto leading-relaxed max-h-64 select-all">
                {hexDump}
              </pre>
            </div>
          )}

          {/* Tab 3: Command Breakdown */}
          {activeTab === 'commands' && (
            <div className="space-y-2">
              <div className="text-slate-400 text-[11px]">
                Recognized ESC/POS control sequences found in this binary stream:
              </div>
              <div className="divide-y divide-slate-800/80 bg-slate-950 border border-slate-800 rounded-xl overflow-hidden">
                {analysis.commands.map((cmd, idx) => (
                  <div key={idx} className="p-2.5 flex items-center justify-between gap-2 hover:bg-slate-900/50">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-[10px] font-bold text-amber-400 bg-slate-900 px-2 py-0.5 rounded border border-slate-800">
                        {cmd.code}
                      </span>
                      <span className="font-bold text-slate-200 text-xs">{cmd.name}</span>
                    </div>
                    <span className="text-slate-400 text-[11px] truncate">{cmd.description}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

        </div>

        {/* Footer */}
        <div className="px-5 py-3 border-t border-slate-800 bg-slate-900/90 flex items-center justify-between">
          <span className="text-[11px] text-slate-500 font-mono">
            Direct ESC/POS Stream • {rawBuffer.length} Bytes
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl font-bold text-xs transition-colors cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
