import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { Printer, PrinterRoutingRule, OrderItem } from '../../core/types';
import {
  Printer as PrinterIcon,
  X,
  FileCode,
  Network,
  Cpu,
  Copy,
} from 'lucide-react';

interface DirectPrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  customItems?: OrderItem[];
  customTable?: string;
}

export const DirectPrintModal: React.FC<DirectPrintModalProps> = ({
  isOpen,
  onClose,
  customItems,
  customTable,
}) => {
  const { selectedTableDetails } = usePos();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [, setRules] = useState<PrinterRoutingRule[]>([]);
  const [activeStation, setActiveStation] = useState<string>('kitchen');
  const [ticketData, setTicketData] = useState<{ formatted_ticket: string; escpos_hex: string; bytes_count: number } | null>(null);
  const [copiedHex, setCopiedHex] = useState(false);

  useEffect(() => {
    if (!isOpen) return;
    fetch('/api/print/printers')
      .then((res) => res.json())
      .then((data) => {
        setPrinters(data.printers || []);
        setRules(data.rules || []);
      })
      .catch(console.error);
  }, [isOpen]);

  // Generate ticket preview
  useEffect(() => {
    if (!isOpen) return;
    const itemsToPrint =
      customItems ||
      (selectedTableDetails?.items ? selectedTableDetails.items.filter((i) => i.preparation_status !== 'cancelled') : []);

    const filteredForStation =
      activeStation === 'cashier'
        ? itemsToPrint
        : itemsToPrint.filter((i) => i.destination_station === activeStation);

    fetch('/api/print/ticket-preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        station: activeStation,
        table_number: customTable || selectedTableDetails?.table.number || 'Mesa 1',
        waiter: selectedTableDetails?.table.assigned_waiter || 'Mesero Carlos R.',
        items: filteredForStation.length > 0 ? filteredForStation : itemsToPrint,
      }),
    })
      .then((res) => res.json())
      .then(setTicketData)
      .catch(console.error);
  }, [isOpen, activeStation, customItems, customTable, selectedTableDetails]);

  if (!isOpen) return null;

  const copyToClipboard = () => {
    if (ticketData?.escpos_hex) {
      navigator.clipboard.writeText(ticketData.escpos_hex);
      setCopiedHex(true);
      setTimeout(() => setCopiedHex(false), 2000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-4xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-[#F4F6F8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#05268F] text-[#FFD318]">
              <PrinterIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#101828] tracking-tight">
                DirectPrint - Impresión Térmica ESC/POS
              </h3>
              <p className="text-xs text-[#667085]">
                Comandas en red Ethernet, Wi-Fi y USB nativas para cocina y barra.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#667085] hover:text-[#101828] transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Column: Printers Status & Routing Rules (5 cols) */}
          <div className="md:col-span-5 space-y-4">
            <h4 className="text-xs font-black text-[#101828] uppercase tracking-wider">
              Impresoras Térmicas Registradas
            </h4>
            <div className="space-y-2">
              {printers.map((prn) => (
                <div
                  key={prn.id}
                  onClick={() => setActiveStation(prn.station)}
                  className={`p-3 rounded-2xl border cursor-pointer transition ${
                    activeStation === prn.station
                      ? 'bg-[#EAF0FF] border-[#05268F] shadow-xs'
                      : 'bg-[#F4F6F8] border-zinc-200 hover:bg-[#EAF0FF]/50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-extrabold text-xs text-[#101828]">{prn.name}</div>
                      <div className="text-[10px] text-[#667085] flex items-center gap-1 mt-0.5">
                        <Network className="w-3 h-3 text-[#05268F]" />
                        <span>{prn.connection_type.toUpperCase()} • {prn.address}:{prn.port}</span>
                      </div>
                    </div>
                    <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-[#05268F] text-white">
                      80mm ESC/POS
                    </span>
                  </div>
                  <div className="mt-2 pt-1 border-t border-zinc-200 flex items-center justify-between text-[10px] text-[#667085]">
                    <span>Estación: <strong className="uppercase text-[#101828]">{prn.station}</strong></span>
                    <span className="text-[#05268F] font-bold">Ver Comanda &rarr;</span>
                  </div>
                </div>
              ))}
            </div>

            {/* Routing Rules explanation */}
            <div className="bg-[#05268F] rounded-2xl p-4 text-white text-xs space-y-1.5 shadow-xs">
              <div className="flex items-center gap-1.5 font-black text-[#FFD318] text-xs">
                <Cpu className="w-4 h-4" />
                <span>Enrutamiento Inteligente por Categoría</span>
              </div>
              <p className="text-[11px] text-white/90">
                • <strong>Cocina:</strong> Platillos, Entradas, Postres, Snacks &rarr; 192.168.1.201
              </p>
              <p className="text-[11px] text-white/90">
                • <strong>Barra:</strong> Bebidas, Cervezas, Micheladas &rarr; 192.168.1.202
              </p>
            </div>
          </div>

          {/* Right Column: Virtual ESC/POS Thermal Paper & Raw Hex Stream (7 cols) */}
          <div className="md:col-span-7 flex flex-col space-y-3">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-black text-[#101828] uppercase tracking-wider">
                Simulador Térmico y Secuencia Binaria
              </h4>
              <div className="flex items-center gap-1">
                {(['kitchen', 'bar', 'cashier'] as const).map((st) => (
                  <button
                    key={st}
                    onClick={() => setActiveStation(st)}
                    className={`px-2.5 py-1 rounded-lg text-[10px] font-bold uppercase transition cursor-pointer ${
                      activeStation === st ? 'bg-[#05268F] text-white' : 'bg-[#F4F6F8] text-[#101828] hover:bg-zinc-200'
                    }`}
                  >
                    {st}
                  </button>
                ))}
              </div>
            </div>

            {/* Virtual Thermal Paper Preview */}
            <div className="bg-[#FFF7D6] border border-[#FFD318]/50 rounded-2xl p-4 font-mono text-xs text-[#101828] shadow-inner whitespace-pre overflow-x-auto leading-tight select-all">
              {ticketData?.formatted_ticket || 'Generando comanda ESC/POS...'}
            </div>

            {/* Hex Payload Inspector */}
            <div className="bg-[#101828] rounded-2xl p-3.5 text-zinc-300 space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-bold text-white flex items-center gap-1.5">
                  <FileCode className="w-3.5 h-3.5 text-[#FFD318]" />
                  <span>Payload Binario ESC/POS ({ticketData?.bytes_count || 0} bytes)</span>
                </span>
                <button
                  onClick={copyToClipboard}
                  className="flex items-center gap-1 text-[10px] px-2.5 py-0.5 rounded bg-[#FFD318] text-[#101828] font-bold hover:bg-[#F0C40F] cursor-pointer"
                >
                  <Copy className="w-3 h-3" />
                  <span>{copiedHex ? '¡Copiado!' : 'Copiar Hex'}</span>
                </button>
              </div>
              <div className="font-mono text-[10px] text-emerald-400 break-all max-h-16 overflow-y-auto">
                {ticketData?.escpos_hex || ''}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
