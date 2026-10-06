import React, { useState } from 'react';
import { usePos } from '../../context/PosContext';
import { ImportJob, ImportCandidate } from '../../core/types';
import {
  UploadCloud,
  X,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  ArrowRight,
} from 'lucide-react';

interface DirectImportModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const DirectImportModal: React.FC<DirectImportModalProps> = ({ isOpen, onClose }) => {
  const { refreshAll } = usePos();
  const [sourcePos, setSourcePos] = useState('SoftRestaurant');
  const [step, setStep] = useState<'upload' | 'preview' | 'completed'>('upload');
  const [job, setJob] = useState<ImportJob | null>(null);
  const [candidates, setCandidates] = useState<ImportCandidate[]>([]);
  const [isProcessing, setIsProcessing] = useState(false);
  const [importedResult, setImportedResult] = useState<{ imported_count: number } | null>(null);

  if (!isOpen) return null;

  const samplePresets: { [key: string]: any[] } = {
    SoftRestaurant: [
      { name: 'Costillas BBQ en Leña', precio: 220.0, categoria: 'Platillos' },
      { name: 'Mojito Cubano de Menta', precio: 95.0, categoria: 'Bebidas' },
      { name: 'Dedos de Queso Mozzarella', precio: 85.0, categoria: 'Entradas' },
      { name: 'Cheesecake de Frambuesa', precio: 75.0, categoria: 'Postres' },
      { name: 'Boneless BBQ', precio: 140.0, categoria: 'Entradas' }, // Duplicate test
    ],
    Toast: [
      { name: 'Tacos de Ribeye (3 pzas)', precio: 195.0, categoria: 'Platillos' },
      { name: 'Margarita Tradicional', precio: 110.0, categoria: 'Bebidas' },
      { name: 'Guacamole con Totopos', precio: 90.0, categoria: 'Snacks' },
    ],
    Square: [
      { name: 'Café Espresso Doble', precio: 45.0, categoria: 'Bebidas' },
      { name: 'Croissant Horneado', precio: 50.0, categoria: 'Snacks' },
    ],
  };

  const handleGeneratePreview = async () => {
    setIsProcessing(true);
    try {
      const rows = samplePresets[sourcePos] || samplePresets.SoftRestaurant;
      const res = await fetch('/api/import/preview', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          source_pos: sourcePos,
          file_name: `export_${sourcePos.toLowerCase()}_2026.csv`,
          rows,
        }),
      });
      const data = await res.json();
      setJob(data.job);
      setCandidates(data.candidates);
      setStep('preview');
    } catch (err: any) {
      alert(err.message || 'Error al procesar preview');
    } finally {
      setIsProcessing(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!job) return;
    setIsProcessing(true);
    try {
      const res = await fetch('/api/import/execute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          candidates,
        }),
      });
      const data = await res.json();
      setImportedResult(data);
      setStep('completed');
      await refreshAll();
    } catch (err: any) {
      alert(err.message || 'Error al ejecutar importación');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-[#F4F6F8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#05268F] text-[#FFD318]">
              <UploadCloud className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#101828] tracking-tight">
                DirectImport - Migración de Menús POS
              </h3>
              <p className="text-xs text-[#667085]">
                Onboarding acelerado desde SoftRestaurant, Toast, Square al catálogo de Directaurante.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#667085] hover:text-[#101828] transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          {step === 'upload' && (
            <div className="space-y-4 max-w-lg mx-auto py-4">
              <div>
                <label className="block text-xs font-black text-[#101828] uppercase tracking-wider mb-2">
                  1. Seleccione el Sistema POS de Origen
                </label>
                <div className="grid grid-cols-3 gap-2">
                  {['SoftRestaurant', 'Toast', 'Square'].map((pos) => (
                    <button
                      key={pos}
                      type="button"
                      onClick={() => setSourcePos(pos)}
                      className={`p-3 rounded-2xl border text-center font-bold text-xs transition cursor-pointer ${
                        sourcePos === pos
                          ? 'bg-[#05268F] text-white border-[#05268F] shadow-sm'
                          : 'bg-[#F4F6F8] text-[#101828] border-zinc-200 hover:bg-[#EAF0FF]'
                      }`}
                    >
                      {pos}
                    </button>
                  ))}
                </div>
              </div>

              <div className="border-2 border-dashed border-zinc-200 rounded-3xl p-6 text-center bg-[#F4F6F8]">
                <FileSpreadsheet className="w-10 h-10 text-[#05268F] mx-auto mb-2" />
                <h4 className="font-extrabold text-sm text-[#101828]">
                  Carga de Archivo de Exportación (.CSV, .XLSX)
                </h4>
                <p className="text-xs text-[#667085] mt-1 max-w-sm mx-auto">
                  El motor analizará automáticamente columnas, precios, categorías e identificará duplicados.
                </p>
                <div className="mt-4 flex items-center justify-center gap-2">
                  <span className="text-[11px] font-semibold text-[#667085]">Datos de prueba listos para:</span>
                  <span className="text-[11px] font-bold text-[#05268F]">{sourcePos}</span>
                </div>
              </div>

              <button
                onClick={handleGeneratePreview}
                disabled={isProcessing}
                className="w-full py-3 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-sm shadow-sm transition flex items-center justify-center gap-2 cursor-pointer"
              >
                <span>Analizar y Generar Preview de Mapeo</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>
          )}

          {step === 'preview' && (
            <div className="space-y-4">
              <div className="flex items-center justify-between bg-[#EAF0FF] p-3 rounded-2xl border border-[#05268F]/20 text-xs">
                <div>
                  <span className="font-black text-[#05268F]">Origen: {job?.source_pos}</span> •{' '}
                  <span className="text-[#05268F]/90 font-medium">{job?.total_products_detected} productos detectados</span>
                </div>
                {job?.issues_count ? (
                  <span className="font-bold text-rose-700 flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" />
                    {job.issues_count} duplicado(s) o conflicto(s)
                  </span>
                ) : (
                  <span className="font-bold text-emerald-700">Catálogo 100% normalizado</span>
                )}
              </div>

              {/* Table of mapped candidates */}
              <div className="border border-zinc-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-[#F4F6F8] text-[#101828] uppercase font-black text-[10px]">
                    <tr>
                      <th className="p-2.5">Producto Detectado</th>
                      <th className="p-2.5">Precio</th>
                      <th className="p-2.5">Categoría Mapeada</th>
                      <th className="p-2.5">Estación</th>
                      <th className="p-2.5">Validación</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {candidates.map((c, i) => (
                      <tr key={i} className={c.has_issue ? 'bg-rose-50/60' : 'hover:bg-[#EAF0FF]/30'}>
                        <td className="p-2.5 font-bold text-[#101828]">{c.mapped_name}</td>
                        <td className="p-2.5 font-mono text-[#101828]">${c.raw_price.toFixed(2)}</td>
                        <td className="p-2.5">
                          <span className="px-2 py-0.5 rounded bg-zinc-100 font-semibold text-[#101828]">{c.category}</span>
                        </td>
                        <td className="p-2.5 uppercase font-bold text-[10px] text-[#667085]">{c.station}</td>
                        <td className="p-2.5">
                          {c.has_issue ? (
                            <span className="text-rose-700 font-bold flex items-center gap-1 text-[11px]">
                              <AlertTriangle className="w-3 h-3 text-rose-600" />
                              {c.issue_message}
                            </span>
                          ) : (
                            <span className="text-emerald-700 font-bold flex items-center gap-1 text-[11px]">
                              <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                              Listo para importar
                            </span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button
                  onClick={() => setStep('upload')}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#101828] bg-[#F4F6F8] hover:bg-zinc-200 cursor-pointer"
                >
                  &larr; Volver a Seleccionar
                </button>
                <button
                  onClick={handleExecuteImport}
                  disabled={isProcessing}
                  className="px-5 py-2.5 rounded-xl bg-[#FFD318] hover:bg-[#F0C40F] text-[#101828] font-black text-xs shadow-sm transition cursor-pointer"
                >
                  Confirmar e Importar al Catálogo Real
                </button>
              </div>
            </div>
          )}

          {step === 'completed' && (
            <div className="text-center py-8 space-y-3">
              <div className="w-14 h-14 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <h4 className="text-lg font-black text-[#101828]">¡Migración Completada con Éxito!</h4>
              <p className="text-xs text-[#667085] max-w-sm mx-auto">
                Se agregaron <strong>{importedResult?.imported_count}</strong> productos nuevos al
                catálogo persistente del restaurante. Ya están disponibles en la comanda del mesero.
              </p>
              <button
                onClick={onClose}
                className="mt-4 px-6 py-2.5 rounded-xl bg-[#05268F] text-white text-xs font-bold shadow-sm hover:bg-[#041E72] cursor-pointer"
              >
                Cerrar y Ver Productos en Salón
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
