import React from 'react';
import { usePos } from '../../context/PosContext';
import {
  Puzzle,
  X,
  UtensilsCrossed,
  ChefHat,
  DollarSign,
  Printer,
  UploadCloud,
  Boxes,
  Award,
  Sparkles,
  Check,
} from 'lucide-react';

interface PluginsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PluginsModal: React.FC<PluginsModalProps> = ({ isOpen, onClose }) => {
  const { plugins, togglePlugin } = usePos();

  if (!isOpen) return null;

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'UtensilsCrossed':
        return UtensilsCrossed;
      case 'ChefHat':
        return ChefHat;
      case 'DollarSign':
        return DollarSign;
      case 'Printer':
        return Printer;
      case 'UploadCloud':
        return UploadCloud;
      case 'Boxes':
        return Boxes;
      case 'Award':
        return Award;
      case 'Sparkles':
        return Sparkles;
      default:
        return Puzzle;
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-[#F4F6F8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#05268F] text-[#FFD318]">
              <Puzzle className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#101828] tracking-tight">
                Módulos y Soluciones Directaurante
              </h3>
              <p className="text-xs text-[#667085]">
                Monolito modular: Habilite o deshabilite capacidades operativas sobre el mismo núcleo de datos.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#667085] hover:text-[#101828] transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-3">
          <div className="p-3.5 bg-[#EAF0FF] border border-[#05268F]/20 rounded-2xl text-xs text-[#05268F] flex items-center justify-between">
            <span>
              <strong>Visión de Negocio:</strong> Cada restaurante activa las soluciones que necesita sin
              instalar sistemas paralelos ni fragmentar inventarios o bases de datos.
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2">
            {plugins.map((plugin) => {
              const Icon = getIcon(plugin.icon);
              return (
                <div
                  key={plugin.id}
                  className={`p-4 rounded-2xl border transition flex flex-col justify-between ${
                    plugin.enabled
                      ? 'bg-white border-[#05268F]/30 shadow-xs'
                      : 'bg-[#F4F6F8] border-zinc-200 opacity-60'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2.5">
                        <div
                          className={`p-2 rounded-xl ${
                            plugin.enabled ? 'bg-[#05268F] text-[#FFD318]' : 'bg-zinc-200 text-[#667085]'
                          }`}
                        >
                          <Icon className="w-4 h-4" />
                        </div>
                        <div>
                          <div className="font-black text-sm text-[#101828]">{plugin.name}</div>
                          <span className="text-[10px] text-[#667085] font-mono">v{plugin.version}</span>
                        </div>
                      </div>

                      {plugin.isCore ? (
                        <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-[#EAF0FF] text-[#05268F] border border-[#05268F]/20">
                          Núcleo Base
                        </span>
                      ) : (
                        <button
                          type="button"
                          onClick={() => togglePlugin(plugin.id, !plugin.enabled)}
                          className={`px-3 py-1 rounded-full text-xs font-bold transition flex items-center gap-1 cursor-pointer ${
                            plugin.enabled
                              ? 'bg-[#05268F] text-white shadow-xs hover:bg-[#041E72]'
                              : 'bg-zinc-200 text-[#101828] hover:bg-zinc-300'
                          }`}
                        >
                          {plugin.enabled && <Check className="w-3 h-3 text-[#FFD318]" />}
                          <span>{plugin.enabled ? 'Habilitado' : 'Desactivado'}</span>
                        </button>
                      )}
                    </div>

                    <p className="text-xs text-[#667085] mt-2.5 leading-relaxed">{plugin.description}</p>
                  </div>

                  {/* Capabilities badges */}
                  <div className="mt-3 pt-2 border-t border-zinc-100 flex flex-wrap gap-1">
                    {plugin.capabilities.map((cap) => (
                      <span
                        key={cap}
                        className="px-2 py-0.5 rounded bg-[#F4F6F8] text-[#101828] text-[9px] font-semibold font-mono"
                      >
                        #{cap}
                      </span>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
