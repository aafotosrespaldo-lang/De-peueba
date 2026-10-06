import React, { useState, useEffect } from 'react';
import { usePos } from '../../context/PosContext';
import { Printer, OrderItem } from '../../core/types';
import {
  Printer as PrinterIcon,
  X,
  Plus,
  Wifi,
  Usb,
  CheckCircle2,
  AlertCircle,
  Download,
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
  const { selectedTableDetails, sdk } = usePos();
  const [printers, setPrinters] = useState<Printer[]>([]);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<Printer | null>(null);
  const [testStatus, setTestStatus] = useState<string | null>(null);
  const [serviceStatus, setServiceStatus] = useState<'active' | 'offline'>('active');

  // Form states
  const [formName, setFormName] = useState('');
  const [formConnType, setFormConnType] = useState<'network' | 'usb'>('network');
  const [formHost, setFormHost] = useState('192.168.1.200');
  const [formPort, setFormPort] = useState('9100');
  const [formStation, setFormStation] = useState<'kitchen' | 'bar' | 'cash' | 'cashier'>('kitchen');
  const [formPaperWidth, setFormPaperWidth] = useState<58 | 80>(80);

  const loadPrinters = () => {
    fetch('/api/print/printers')
      .then((res) => res.json())
      .then((data) => {
        setPrinters(data.printers || []);
        setServiceStatus('active');
      })
      .catch(() => {
        setServiceStatus('offline');
      });
  };

  useEffect(() => {
    if (!isOpen) return;
    loadPrinters();
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOpenAdd = () => {
    setEditingPrinter(null);
    setFormName('Impresora Cocina');
    setFormConnType('network');
    setFormHost('192.168.1.201');
    setFormPort('9100');
    setFormStation('kitchen');
    setFormPaperWidth(80);
    setShowConfigModal(true);
  };

  const handleOpenEdit = (p: Printer) => {
    setEditingPrinter(p);
    setFormName(p.name);
    setFormConnType(p.connection_type === 'usb' ? 'usb' : 'network');
    setFormHost(p.host || p.address || '192.168.1.200');
    setFormPort(String(p.port || 9100));
    setFormStation((p.station as any) || 'kitchen');
    setFormPaperWidth(p.paper_width || 80);
    setShowConfigModal(true);
  };

  const handleSavePrinter = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      if (editingPrinter) {
        await fetch(`/api/print/printers/${editingPrinter.id}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            connection_type: formConnType,
            host: formConnType === 'network' ? formHost : 'USB_DEVICE',
            port: formConnType === 'network' ? Number(formPort) : 0,
            station: formStation,
            paper_width: formPaperWidth,
          }),
        });
      } else {
        await fetch('/api/print/printers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: formName,
            connection_type: formConnType,
            host: formConnType === 'network' ? formHost : 'USB_DEVICE',
            port: formConnType === 'network' ? Number(formPort) : 0,
            station: formStation,
            paper_width: formPaperWidth,
          }),
        });
      }
      setShowConfigModal(false);
      loadPrinters();
    } catch (err: any) {
      alert('Error guardando impresora: ' + err.message);
    }
  };

  const handleDeletePrinter = async (id: string) => {
    if (!confirm('¿Eliminar esta impresora?')) return;
    try {
      await fetch(`/api/print/printers/${id}`, { method: 'DELETE' });
      loadPrinters();
    } catch (err: any) {
      alert('Error: ' + err.message);
    }
  };

  const handleTestPrint = async (printer: Printer) => {
    setTestStatus(`Enviando prueba a ${printer.name}...`);
    try {
      const now = new Date().toLocaleTimeString('es-MX', { hour: '2-digit', minute: '2-digit' });
      const content = [
        '========================================',
        '          DIRECTAURANTE PRINT           ',
        '           PRUEBA DE CONEXIÓN           ',
        '========================================',
        `IMPRESORA: ${printer.name}`,
        `ESTACIÓN:  ${printer.station.toUpperCase()}`,
        `TIPO:      ${printer.connection_type.toUpperCase()}`,
        `PAPEL:     ${printer.paper_width} mm`,
        `HORA:      ${now}`,
        '----------------------------------------',
        '   ESTADO DE COMUNICACIÓN: CORRECTO     ',
        '========================================\n\n\n',
      ].join('\n');

      await sdk.print.createPrintJob({
        type: 'general',
        station: printer.station,
        printer_id: printer.id,
        formatted_content: content,
        paper_width: printer.paper_width,
        status: 'pending',
      });

      setTestStatus(`¡Prueba enviada con éxito a ${printer.name}!`);
      setTimeout(() => setTestStatus(null), 3000);
    } catch (err: any) {
      setTestStatus(`Error en prueba: ${err.message}`);
    }
  };

  const downloadAgentScript = () => {
    window.open('/api/print/agent/download', '_blank');
  };

  const kitchenPrinters = printers.filter((p) => p.station === 'kitchen');
  const barPrinters = printers.filter((p) => p.station === 'bar');
  const cashierPrinters = printers.filter((p) => p.station === 'cash' || p.station === 'cashier');

  return (
    <div className="fixed inset-0 z-50 bg-[#101828]/60 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5">
      <div className="bg-white rounded-3xl max-w-3xl w-full shadow-2xl border border-zinc-200 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Header */}
        <div className="p-4 sm:p-5 border-b border-zinc-100 flex items-center justify-between bg-[#F4F6F8]">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-[#05268F] text-[#FFD318]">
              <PrinterIcon className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-xl font-black text-[#101828] tracking-tight">
                Impresión del Restaurante
              </h3>
              <p className="text-xs text-[#667085]">
                Configuración de impresoras térmicas de cocina, barra y caja.
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-xl text-[#667085] hover:text-[#101828] transition cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6">
          {/* Service Status Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-2xl bg-[#F4F6F8] border border-zinc-200 gap-3">
            <div className="flex items-center gap-3">
              <div className={`p-2 rounded-xl ${serviceStatus === 'active' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                {serviceStatus === 'active' ? <CheckCircle2 className="w-5 h-5" /> : <AlertCircle className="w-5 h-5" />}
              </div>
              <div>
                <div className="text-xs font-bold text-[#667085] uppercase">Estado del servicio</div>
                <div className="text-sm font-black text-[#101828]">
                  {serviceStatus === 'active' ? 'Activo y en espera de impresiones' : 'Sin conexión'}
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={downloadAgentScript}
                title="Descargar DirectPrint Agent para Windows"
                className="flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-[#101828] transition shadow-xs cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#05268F]" />
                <span>Agente Windows</span>
              </button>
              <button
                onClick={handleOpenAdd}
                className="flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-xs font-black text-white transition shadow-sm cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>Agregar impresora</span>
              </button>
            </div>
          </div>

          {testStatus && (
            <div className="p-3 rounded-xl bg-[#EAF0FF] border border-[#05268F]/20 text-[#05268F] text-xs font-bold flex items-center gap-2 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4" />
              <span>{testStatus}</span>
            </div>
          )}

          {/* Section: Cocina */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h4 className="text-sm font-black text-[#101828] uppercase tracking-wide">
                Cocina
              </h4>
              <span className="text-xs text-[#667085] font-bold">
                {kitchenPrinters.length} impresora(s)
              </span>
            </div>
            {kitchenPrinters.length === 0 ? (
              <p className="text-xs text-[#667085] italic p-3 bg-zinc-50 rounded-xl">
                No hay impresoras configuradas para cocina.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {kitchenPrinters.map((prn) => (
                  <PrinterCard
                    key={prn.id}
                    printer={prn}
                    onEdit={() => handleOpenEdit(prn)}
                    onDelete={() => handleDeletePrinter(prn.id)}
                    onTest={() => handleTestPrint(prn)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section: Barra */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h4 className="text-sm font-black text-[#101828] uppercase tracking-wide">
                Barra
              </h4>
              <span className="text-xs text-[#667085] font-bold">
                {barPrinters.length} impresora(s)
              </span>
            </div>
            {barPrinters.length === 0 ? (
              <p className="text-xs text-[#667085] italic p-3 bg-zinc-50 rounded-xl">
                No hay impresoras configuradas para barra.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {barPrinters.map((prn) => (
                  <PrinterCard
                    key={prn.id}
                    printer={prn}
                    onEdit={() => handleOpenEdit(prn)}
                    onDelete={() => handleDeletePrinter(prn.id)}
                    onTest={() => handleTestPrint(prn)}
                  />
                ))}
              </div>
            )}
          </div>

          {/* Section: Caja */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-2">
              <h4 className="text-sm font-black text-[#101828] uppercase tracking-wide">
                Caja y Cuentas
              </h4>
              <span className="text-xs text-[#667085] font-bold">
                {cashierPrinters.length} impresora(s)
              </span>
            </div>
            {cashierPrinters.length === 0 ? (
              <p className="text-xs text-[#667085] italic p-3 bg-zinc-50 rounded-xl">
                No hay impresoras configuradas para caja.
              </p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {cashierPrinters.map((prn) => (
                  <PrinterCard
                    key={prn.id}
                    printer={prn}
                    onEdit={() => handleOpenEdit(prn)}
                    onDelete={() => handleDeletePrinter(prn.id)}
                    onTest={() => handleTestPrint(prn)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Modal: Configurar o Agregar Impresora */}
      {showConfigModal && (
        <div className="fixed inset-0 z-60 bg-[#101828]/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-md w-full p-5 space-y-4 shadow-2xl border border-zinc-200">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <h4 className="text-base font-black text-[#101828]">
                {editingPrinter ? 'Configurar impresora' : 'Agregar impresora'}
              </h4>
              <button
                onClick={() => setShowConfigModal(false)}
                className="p-1 rounded-lg text-zinc-400 hover:text-zinc-700"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePrinter} className="space-y-3.5">
              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                  Nombre de la impresora
                </label>
                <input
                  type="text"
                  placeholder="Ej: Impresora Cocina Caliente"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold text-[#101828] bg-white"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                    Estación
                  </label>
                  <select
                    value={formStation}
                    onChange={(e) => setFormStation(e.target.value as any)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold text-[#101828] bg-white"
                  >
                    <option value="kitchen">Cocina</option>
                    <option value="bar">Barra</option>
                    <option value="cashier">Caja</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                    Ancho de papel
                  </label>
                  <select
                    value={formPaperWidth}
                    onChange={(e) => setFormPaperWidth(Number(e.target.value) as 58 | 80)}
                    className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-bold text-[#101828] bg-white"
                  >
                    <option value={80}>80 mm (Estándar)</option>
                    <option value={58}>58 mm (Compacto)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                  Tipo de conexión
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormConnType('network')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      formConnType === 'network'
                        ? 'bg-[#05268F] text-white border-[#05268F]'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    <Wifi className="w-3.5 h-3.5" />
                    <span>Red local</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormConnType('usb')}
                    className={`py-2 px-3 rounded-xl border text-xs font-bold flex items-center justify-center gap-1.5 transition ${
                      formConnType === 'usb'
                        ? 'bg-[#05268F] text-white border-[#05268F]'
                        : 'bg-zinc-50 text-zinc-700 border-zinc-200'
                    }`}
                  >
                    <Usb className="w-3.5 h-3.5" />
                    <span>USB</span>
                  </button>
                </div>
              </div>

              {formConnType === 'network' && (
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2">
                    <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                      Dirección IP
                    </label>
                    <input
                      type="text"
                      placeholder="192.168.1.200"
                      value={formHost}
                      onChange={(e) => setFormHost(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono font-bold text-[#101828] bg-white"
                      required
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-[#101828] uppercase mb-1">
                      Puerto
                    </label>
                    <input
                      type="text"
                      placeholder="9100"
                      value={formPort}
                      onChange={(e) => setFormPort(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-zinc-300 text-xs font-mono font-bold text-[#101828] bg-white"
                      required
                    />
                  </div>
                </div>
              )}

              {formConnType === 'usb' && (
                <div className="p-3 rounded-xl bg-blue-50 border border-blue-200 text-[11px] text-blue-900">
                  La impresora será detectada por el <strong>DirectPrint Agent</strong> en la computadora local del restaurante.
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setShowConfigModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-bold text-[#667085] hover:bg-zinc-100 transition"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E72] text-xs font-black text-white transition shadow-sm"
                >
                  Guardar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

const PrinterCard: React.FC<{
  printer: Printer;
  onEdit: () => void;
  onDelete: () => void;
  onTest: () => void;
}> = ({ printer, onEdit, onDelete, onTest }) => {
  return (
    <div className="p-4 rounded-2xl border border-zinc-200 bg-white shadow-xs space-y-3">
      <div className="flex items-start justify-between">
        <div>
          <div className="font-extrabold text-sm text-[#101828]">{printer.name}</div>
          <div className="text-[11px] text-[#667085] mt-0.5 flex items-center gap-1.5">
            {printer.connection_type === 'usb' ? (
              <span className="flex items-center gap-1 text-zinc-700">
                <Usb className="w-3 h-3 text-[#05268F]" /> USB
              </span>
            ) : (
              <span className="flex items-center gap-1 text-zinc-700">
                <Wifi className="w-3 h-3 text-[#05268F]" /> {printer.host || printer.address}:{printer.port || 9100}
              </span>
            )}
            <span>•</span>
            <span>{printer.paper_width} mm</span>
          </div>
        </div>
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
          Conectada
        </span>
      </div>

      <div className="flex items-center gap-2 pt-2 border-t border-zinc-100">
        <button
          onClick={onTest}
          className="flex-1 py-1.5 rounded-xl bg-[#F4F6F8] hover:bg-[#EAF0FF] text-[#05268F] font-bold text-xs transition cursor-pointer text-center"
        >
          Probar impresión
        </button>
        <button
          onClick={onEdit}
          className="px-3 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-50 text-[#101828] font-bold text-xs transition cursor-pointer"
        >
          Configurar
        </button>
        <button
          onClick={onDelete}
          className="px-2 py-1.5 rounded-xl text-rose-500 hover:bg-rose-50 font-bold text-xs transition cursor-pointer"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
};
