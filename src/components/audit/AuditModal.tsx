import React from 'react';
import { usePos } from '../../context/PosContext';
import { X, Shield, Clock, User } from 'lucide-react';

interface AuditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AuditModal: React.FC<AuditModalProps> = ({ isOpen, onClose }) => {
  const { auditLogs } = usePos();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-[#F4F6F8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#05268F] text-[#FFD318]">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#101828] tracking-tight">
                Pista de Auditoría Financiera y Operacional
              </h3>
              <p className="text-xs text-[#667085]">
                Registro inmutable: Prohibición de borrados físicos, eventos compensatorios y trazabilidad de actores.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#667085] hover:text-[#101828] transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1">
          <div className="divide-y divide-zinc-100">
            {auditLogs.length === 0 ? (
              <p className="text-xs text-[#667085] text-center py-8">No hay registros de auditoría aún.</p>
            ) : (
              auditLogs.map((log) => {
                const isAllergy = log.action === 'allergy_override';
                const isCash = log.entity_type === 'cash_shift';

                return (
                  <div key={log.id} className="py-3 flex items-start justify-between gap-3 text-xs">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <span
                          className={`px-2 py-0.5 rounded font-mono text-[10px] font-bold uppercase tracking-wider ${
                            isAllergy
                              ? 'bg-rose-100 text-rose-900 border border-rose-300'
                              : isCash
                              ? 'bg-emerald-100 text-emerald-900'
                              : 'bg-[#EAF0FF] text-[#05268F]'
                          }`}
                        >
                          {log.action}
                        </span>
                        <span className="font-bold text-[#101828]">{log.notes || 'Operación registrada'}</span>
                      </div>
                      <div className="flex items-center gap-3 text-[11px] text-[#667085]">
                        <span className="flex items-center gap-1">
                          <User className="w-3 h-3 text-[#05268F]" />
                          <span className="text-[#101828] font-medium">{log.actor}</span>
                        </span>
                        <span className="flex items-center gap-1 font-mono">
                          <Clock className="w-3 h-3 text-[#667085]" />
                          <span>{new Date(log.timestamp).toLocaleString('es-MX')}</span>
                        </span>
                        <span className="text-[10px] text-[#667085]">
                          Entidad: <strong className="text-[#101828]">{log.entity_type}</strong> ({log.entity_id})
                        </span>
                      </div>
                    </div>
                    <span className="font-mono text-[10px] text-[#667085] shrink-0">#{log.id.slice(-6)}</span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
