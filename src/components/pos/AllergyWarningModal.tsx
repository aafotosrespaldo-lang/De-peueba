import React, { useState } from 'react';
import { Product, GuestSubaccount } from '../../core/types';
import { usePos } from '../../context/PosContext';
import { ShieldAlert, Lock } from 'lucide-react';

interface AllergyWarningModalProps {
  isOpen: boolean;
  guestSubaccount: GuestSubaccount | null;
  product: Product | null;
  conflicts: any[];
  onClose: () => void;
  onAuthorized: () => void;
}

export const AllergyWarningModal: React.FC<AllergyWarningModalProps> = ({
  isOpen,
  guestSubaccount,
  product,
  conflicts,
  onClose,
  onAuthorized,
}) => {
  const { addItemToSeat, selectedTableId } = usePos();
  const [isAuthorizing, setIsAuthorizing] = useState(false);

  if (!isOpen || !guestSubaccount || !product) return null;

  const handleAuthorize = async () => {
    if (!selectedTableId) return;
    setIsAuthorizing(true);
    try {
      // Send with override_allergy = true, recorded in audit logs
      const res = await addItemToSeat(
        selectedTableId,
        guestSubaccount.id,
        product.id,
        1,
        'AUTORIZADO CON ADVERTENCIA DE ALERGIA',
        true
      );
      if (res.success) {
        onAuthorized();
        onClose();
      }
    } catch (err: any) {
      alert(err.message || 'Error al autorizar pedido');
    } finally {
      setIsAuthorizing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl max-w-lg w-full p-6 shadow-2xl border-2 border-rose-500 animate-in fade-in zoom-in-95 duration-200">
        {/* Header Alert Banner */}
        <div className="flex items-center gap-3 p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 mb-4">
          <div className="p-2.5 rounded-xl bg-rose-600 text-white shrink-0 shadow-md">
            <ShieldAlert className="w-6 h-6 animate-bounce" />
          </div>
          <div>
            <h3 className="text-base font-black tracking-tight text-rose-950 uppercase">
              ¡Alerta Crítica de Alergia Alimentaria!
            </h3>
            <p className="text-xs text-rose-800">
              Validación médica determinista: Conflicto entre comensal e ingrediente del producto.
            </p>
          </div>
        </div>

        {/* Conflict Details */}
        <div className="space-y-3 bg-[#F4F6F8] rounded-2xl p-4 border border-zinc-200 text-xs text-[#101828]">
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
            <span className="font-semibold text-[#667085]">Comensal:</span>
            <span className="font-black text-[#101828] text-sm">
              {guestSubaccount.seat_number} - {guestSubaccount.display_name}
            </span>
          </div>
          <div className="flex items-center justify-between pb-2 border-b border-zinc-200">
            <span className="font-semibold text-[#667085]">Producto Solicitado:</span>
            <span className="font-black text-[#101828] text-sm">{product.name}</span>
          </div>
          <div>
            <span className="font-bold text-rose-700 block mb-1">
              Ingrediente(s) en Riesgo Detectados:
            </span>
            <div className="space-y-1">
              {conflicts.map((c, idx) => (
                <div
                  key={idx}
                  className="p-2 rounded-xl bg-rose-100/70 border border-rose-300 text-rose-950 font-bold flex items-center justify-between"
                >
                  <span>• {c.conflicting_ingredient?.name || 'Ingrediente'}</span>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-rose-700 text-white uppercase font-black">
                    {c.severity || 'Grave'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Warning text */}
        <p className="text-[11px] text-[#667085] my-4 leading-relaxed">
          <strong className="text-[#101828]">Regla de Seguridad Directaurante:</strong> La IA o el frontend jamás deciden
          silenciosamente si un ingrediente es seguro. Solo un encargado o comensal consciente puede
          autorizar el registro, quedando asentado en la pista inmutable de auditoría.
        </p>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 pt-2 border-t border-zinc-100">
          <button
            type="button"
            onClick={onClose}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-bold bg-[#F4F6F8] hover:bg-zinc-200 text-[#101828] border border-zinc-300 transition cursor-pointer"
          >
            Cancelar y Proteger Comensal
          </button>
          <button
            type="button"
            onClick={handleAuthorize}
            disabled={isAuthorizing}
            className="w-full sm:w-auto px-5 py-2.5 rounded-xl text-xs font-black bg-rose-700 hover:bg-rose-800 text-white shadow-sm transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            <Lock className="w-3.5 h-3.5" />
            <span>Autorizar con Pista de Auditoría</span>
          </button>
        </div>
      </div>
    </div>
  );
};
