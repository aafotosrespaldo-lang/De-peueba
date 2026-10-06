/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState } from 'react';
import { PosProvider, usePos } from './context/PosContext';
import { Sidebar, NavigationTarget } from './components/navigation/Sidebar';
import { TopBar } from './components/navigation/TopBar';
import { OperationalSummary } from './components/dashboard/OperationalSummary';
import { TableGrid } from './components/pos/TableGrid';
import { QuickOrderView } from './components/pos/QuickOrderView';
import { ComanderoView } from './components/comandero/ComanderoView';
import { SolutionsCenter } from './components/solutions/SolutionsCenter';
import { ModulePlaceholder } from './components/admin/ModulePlaceholder';
import { InventoryView } from './components/inventory/InventoryView';
import { RecipesView } from './components/recipes/RecipesView';
import { PurchasesView } from './components/purchases/PurchasesView';
import { StaffView } from './components/staff/StaffView';
import { CrmView } from './components/crm/CrmView';
import { FinanceView } from './components/finance/FinanceView';

import { BillModal } from './components/pos/BillModal';
import { AllergyWarningModal } from './components/pos/AllergyWarningModal';
import { KdsView } from './components/kds/KdsView';
import { CashModal } from './components/cash/CashModal';
import { DirectPrintModal } from './components/print/DirectPrintModal';
import { DirectImportModal } from './components/import/DirectImportModal';
import { PluginsModal } from './components/plugins/PluginsModal';
import { AuditModal } from './components/audit/AuditModal';

import { Product, GuestSubaccount, SubaccountBill } from './core/types';

function PosDashboard() {
  const { selectedTableId, selectTable, fetchBill } = usePos();

  // Active Hierarchical Navigation Target (Default: Resumen Operativo)
  const [currentTarget, setCurrentTarget] = useState<NavigationTarget>('dashboard');
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);

  // Modals & Overlays
  const [isBillOpen, setIsBillOpen] = useState(false);
  const [isKdsModalOpen, setIsKdsModalOpen] = useState(false);
  const [isCashModalOpen, setIsCashModalOpen] = useState(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState(false);
  const [isImportModalOpen, setIsImportModalOpen] = useState(false);
  const [isPluginsModalOpen, setIsPluginsModalOpen] = useState(false);
  const [isAuditModalOpen, setIsAuditModalOpen] = useState(false);

  // Allergy warning alert state
  const [allergyAlertData, setAllergyAlertData] = useState<{
    guestSubaccount: GuestSubaccount | null;
    product: Product | null;
    conflicts: any[];
  }>({
    guestSubaccount: null,
    product: null,
    conflicts: [],
  });

  // Custom print payload
  const [customPrintData, setCustomPrintData] = useState<{ items?: any[]; table?: string }>({});

  const handleOpenBill = async () => {
    if (selectedTableId) {
      const bill = await fetchBill(selectedTableId);
      if (bill && bill.status !== 'closed' && bill.table_session_id) {
        setIsBillOpen(true);
      } else {
        setCurrentTarget('tables');
      }
    } else {
      setCurrentTarget('tables');
    }
  };

  const handlePrintTicket = (subaccount?: SubaccountBill) => {
    if (subaccount) {
      setCustomPrintData({
        items: subaccount.items,
        table: `Mesa 1 (Subcuenta ${subaccount.seat_number} - ${subaccount.display_name})`,
      });
    } else {
      setCustomPrintData({});
    }
    setIsPrintModalOpen(true);
  };

  const handleNavigate = (target: NavigationTarget) => {
    setCurrentTarget(target);

    // If navigating to dedicated tool modals that can also open directly:
    if (target === 'cash') {
      setIsCashModalOpen(true);
    } else if (target === 'print') {
      setIsPrintModalOpen(true);
    } else if (target === 'import') {
      setIsImportModalOpen(true);
    } else if (target === 'audit') {
      setIsAuditModalOpen(true);
    }
  };

  return (
    <div className="min-h-screen bg-[#F4F6F8] flex text-[#101828] font-sans antialiased">
      {/* 1. HIERARCHICAL ACCORDION SIDEBAR */}
      <Sidebar
        currentTarget={currentTarget}
        onNavigate={handleNavigate}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
      />

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="flex-1 lg:pl-64 flex flex-col min-w-0">
        {/* Top Minimal Focused Header */}
        <TopBar
          currentTarget={currentTarget}
          onToggleMobileSidebar={() => setIsMobileSidebarOpen((prev) => !prev)}
          onOpenComandero={() => setCurrentTarget('comandero')}
        />

        {/* Dynamic View Body based on Current Target */}
        <main className="flex-1 overflow-y-auto">
          {/* VIEW 1: RESUMEN OPERATIVO (DASHBOARD RESUMIDO - DEFAULT) */}
          {currentTarget === 'dashboard' && (
            <OperationalSummary
              onNavigate={(target) => handleNavigate(target)}
              onOpenQuickCobro={handleOpenBill}
            />
          )}

          {/* VIEW 2: MESAS Y SALÓN */}
          {currentTarget === 'tables' && (
            <div>
              {!selectedTableId ? (
                <TableGrid onSelectTable={(id) => selectTable(id)} />
              ) : (
                <QuickOrderView
                  onBack={() => selectTable(null)}
                  onOpenBill={handleOpenBill}
                  onTriggerAllergyModal={({ guestSubaccount, product, conflicts }) => {
                    setAllergyAlertData({ guestSubaccount, product, conflicts });
                  }}
                />
              )}
            </div>
          )}

          {/* VIEW 3: COMANDERO TÁCTIL (WAITER TOUCH) */}
          {currentTarget === 'comandero' && <ComanderoView />}

          {/* VIEW 4: COCINA / KDS */}
          {currentTarget === 'kds' && (
            <div className="h-[calc(100vh-60px)] relative">
              <KdsView isOpen={true} onClose={() => setCurrentTarget('dashboard')} />
            </div>
          )}

          {/* VIEW 5: CONFIGURACIÓN -> CENTRO DE SOLUCIONES */}
          {currentTarget === 'solutions' && <SolutionsCenter />}

          {/* VIEW 6: INVENTARIO, KÁRDEX Y STOCK (CORE F6) */}
          {currentTarget === 'inventory' && (
            <InventoryView onBack={() => setCurrentTarget('dashboard')} />
          )}

          {/* VIEW 7: RECETAS, ESCANDALLOS Y COSTEO (CORE F7) */}
          {currentTarget === 'recipes' && (
            <RecipesView onBack={() => setCurrentTarget('dashboard')} />
          )}

          {/* VIEW 8: COMPRAS, PROVEEDORES Y ENTRADAS (CORE F8) */}
          {currentTarget === 'purchases' && (
            <PurchasesView onBack={() => setCurrentTarget('dashboard')} />
          )}

          {/* VIEW 9: PERSONAL, ROLES Y TURNOS (CORE F10) */}
          {(currentTarget === 'staff' || currentTarget === 'roles') && (
            <StaffView
              initialTab={currentTarget === 'roles' ? 'roles' : 'members'}
              onBack={() => setCurrentTarget('dashboard')}
            />
          )}

          {/* VIEW 10: CLIENTES, CRM, FIDELIDAD Y PROMOCIONES (CORE F11) */}
          {(currentTarget === 'customers' ||
            currentTarget === 'loyalty' ||
            currentTarget === 'promotions') && (
            <CrmView
              initialTab={
                currentTarget === 'loyalty'
                  ? 'loyalty'
                  : currentTarget === 'promotions'
                  ? 'promotions'
                  : 'customers'
              }
              onBack={() => setCurrentTarget('dashboard')}
            />
          )}

          {/* VIEW 11: FINANZAS, CAJA, GASTOS Y P&L (CORE F12 / F12.1) */}
          {currentTarget === 'finance' && (
            <FinanceView onBack={() => setCurrentTarget('dashboard')} />
          )}

          {/* VIEW 12: SECONDARY ADMINISTRATIVE & SETTINGS VIEWS */}
          {currentTarget !== 'dashboard' &&
            currentTarget !== 'tables' &&
            currentTarget !== 'comandero' &&
            currentTarget !== 'kds' &&
            currentTarget !== 'solutions' &&
            currentTarget !== 'inventory' &&
            currentTarget !== 'recipes' &&
            currentTarget !== 'purchases' &&
            currentTarget !== 'staff' &&
            currentTarget !== 'roles' &&
            currentTarget !== 'customers' &&
            currentTarget !== 'loyalty' &&
            currentTarget !== 'promotions' &&
            currentTarget !== 'finance' && (
              <ModulePlaceholder
                target={currentTarget}
                onBackToDashboard={() => setCurrentTarget('dashboard')}
              />
            )}
        </main>
      </div>

      {/* 3. MODALS & SPECIALIZED OVERLAYS (Preserved with full capabilities) */}
      <BillModal
        isOpen={isBillOpen}
        onClose={() => setIsBillOpen(false)}
        onPrintTicket={handlePrintTicket}
      />

      <AllergyWarningModal
        isOpen={Boolean(allergyAlertData.product)}
        guestSubaccount={allergyAlertData.guestSubaccount}
        product={allergyAlertData.product}
        conflicts={allergyAlertData.conflicts}
        onClose={() => setAllergyAlertData({ guestSubaccount: null, product: null, conflicts: [] })}
        onAuthorized={() => {
          if (selectedTableId) selectTable(selectedTableId);
        }}
      />

      <CashModal
        isOpen={isCashModalOpen}
        onClose={() => {
          setIsCashModalOpen(false);
          if (currentTarget === 'cash') setCurrentTarget('dashboard');
        }}
      />

      <DirectPrintModal
        isOpen={isPrintModalOpen}
        onClose={() => {
          setIsPrintModalOpen(false);
          if (currentTarget === 'print') setCurrentTarget('dashboard');
        }}
        customItems={customPrintData.items}
        customTable={customPrintData.table}
      />

      <DirectImportModal
        isOpen={isImportModalOpen}
        onClose={() => {
          setIsImportModalOpen(false);
          if (currentTarget === 'import') setCurrentTarget('dashboard');
        }}
      />

      <PluginsModal
        isOpen={isPluginsModalOpen}
        onClose={() => setIsPluginsModalOpen(false)}
      />

      <AuditModal
        isOpen={isAuditModalOpen}
        onClose={() => {
          setIsAuditModalOpen(false);
          if (currentTarget === 'audit') setCurrentTarget('dashboard');
        }}
      />

      {/* Floating KDS modal for quick pop-ups from anywhere */}
      {isKdsModalOpen && currentTarget !== 'kds' && (
        <KdsView isOpen={true} onClose={() => setIsKdsModalOpen(false)} />
      )}
    </div>
  );
}

export default function App() {
  return (
    <PosProvider>
      <PosDashboard />
    </PosProvider>
  );
}
