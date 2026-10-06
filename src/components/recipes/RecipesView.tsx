import React, { useState, useMemo } from 'react';
import { usePos } from '../../context/PosContext';
import {
  BookOpen,
  ArrowLeft,
  Plus,
  Search,
  DollarSign,
  TrendingUp,
  AlertTriangle,
  History,
  CheckCircle2,
  Trash2,
  Edit3,
  Layers,
  Sparkles,
  Info,
  ChevronRight,
  Save,
  X,
  Scale,
} from 'lucide-react';
import { Recipe, RecipeItem, RecipeModifierItem, RecipeCostCalculation } from '../../core/types';

interface RecipesViewProps {
  onBack: () => void;
}

export const RecipesView: React.FC<RecipesViewProps> = ({ onBack }) => {
  const {
    recipes,
    recipeSummary,
    inventoryItems,
    products,
    fetchRecipes,
    createRecipe,
    updateRecipe,
    deleteRecipe,
    loading,
  } = usePos();

  const [activeTab, setActiveTab] = useState<'catalog' | 'missing' | 'history'>('catalog');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedRecipeForDetail, setSelectedRecipeForDetail] = useState<(Recipe & { cost_calculation?: RecipeCostCalculation }) | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);
  const [editingRecipeId, setEditingRecipeId] = useState<string | null>(null);
  const [selectedRecipeHistory, setSelectedRecipeHistory] = useState<Recipe | null>(null);

  // Form State for Create/Edit Recipe
  const [formProductId, setFormProductId] = useState('');
  const [formName, setFormName] = useState('');
  const [formYieldQty, setFormYieldQty] = useState(1);
  const [formYieldUnit, setFormYieldUnit] = useState('porción');
  const [formInstructions, setFormInstructions] = useState('');
  const [formItems, setFormItems] = useState<RecipeItem[]>([]);
  const [formModifiers, setFormModifiers] = useState<RecipeModifierItem[]>([]);
  const [formError, setFormError] = useState<string | null>(null);
  const [formSuccess, setFormSuccess] = useState<string | null>(null);

  // Filtered recipes
  const filteredRecipes = useMemo(() => {
    return recipes.filter((r) => {
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        r.name.toLowerCase().includes(q) ||
        r.product_id.toLowerCase().includes(q) ||
        (r.items || []).some((item) => item.item_name?.toLowerCase().includes(q))
      );
    });
  }, [recipes, searchQuery]);

  // Open Editor for Creating
  const handleOpenCreate = (preselectedProductId?: string) => {
    setEditingRecipeId(null);
    setFormError(null);
    setFormSuccess(null);

    const targetProduct = preselectedProductId
      ? products.find((p) => p.id === preselectedProductId)
      : products.find((p) => !recipes.some((r) => r.product_id === p.id && r.is_active));

    setFormProductId(targetProduct?.id || products[0]?.id || '');
    setFormName(targetProduct ? `Receta: ${targetProduct.name}` : '');
    setFormYieldQty(1);
    setFormYieldUnit('porción');
    setFormInstructions('');

    // Prepopulate modifiers from product if available
    const productMods = targetProduct?.available_modifiers || [];
    setFormModifiers(
      productMods.map((mod) => ({
        modifier_name: mod,
        affects_inventory: mod.startsWith('+') || mod.toLowerCase().includes('extra'),
        quantity: 1,
        unit: 'pza',
        waste_percent: 0,
        notes: '',
      }))
    );

    // Initial default item
    if (inventoryItems.length > 0) {
      setFormItems([
        {
          inventory_item_id: inventoryItems[0].id,
          item_name: inventoryItems[0].name,
          quantity: 1,
          unit: inventoryItems[0].base_unit,
          waste_percent: 0,
          notes: '',
        },
      ]);
    } else {
      setFormItems([]);
    }

    setIsEditorOpen(true);
  };

  // Open Editor for Updating
  const handleOpenEdit = (recipe: Recipe) => {
    setEditingRecipeId(recipe.id);
    setFormError(null);
    setFormSuccess(null);
    setFormProductId(recipe.product_id);
    setFormName(recipe.name);
    setFormYieldQty(recipe.yield_quantity || 1);
    setFormYieldUnit(recipe.yield_unit || 'porción');
    setFormInstructions(recipe.preparation_instructions || '');
    setFormItems(
      JSON.parse(
        JSON.stringify(
          recipe.items.map((it) => {
            const inv = inventoryItems.find((ii) => ii.id === it.inventory_item_id);
            return {
              ...it,
              item_name: it.item_name || inv?.name || it.inventory_item_id,
            };
          })
        )
      )
    );
    setFormModifiers(
      JSON.parse(JSON.stringify(recipe.modifier_items || []))
    );
    setIsEditorOpen(true);
  };

  // Add Item Row to Form
  const handleAddItemRow = () => {
    if (inventoryItems.length === 0) return;
    setFormItems((prev) => [
      ...prev,
      {
        inventory_item_id: inventoryItems[0].id,
        item_name: inventoryItems[0].name,
        quantity: 1,
        unit: inventoryItems[0].base_unit,
        waste_percent: 0,
        notes: '',
      },
    ]);
  };

  // Remove Item Row from Form
  const handleRemoveItemRow = (index: number) => {
    setFormItems((prev) => prev.filter((_, i) => i !== index));
  };

  // Update Item Row
  const handleUpdateItemRow = (index: number, updates: Partial<RecipeItem>) => {
    setFormItems((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const updated = { ...item, ...updates };
        if (updates.inventory_item_id) {
          const inv = inventoryItems.find((ii) => ii.id === updates.inventory_item_id);
          if (inv) {
            updated.item_name = inv.name;
            if (!updates.unit) updated.unit = inv.base_unit;
          }
        }
        return updated;
      })
    );
  };

  // Live estimated cost for editor
  const estimatedCostData = useMemo(() => {
    let totalCents = 0;
    for (const it of formItems) {
      const inv = inventoryItems.find((ii) => ii.id === it.inventory_item_id);
      if (!inv) continue;
      const wasteFactor = 1 + (it.waste_percent || 0) / 100;
      totalCents += Math.round(it.quantity * wasteFactor * inv.cost_cents);
    }
    const yieldQty = formYieldQty > 0 ? formYieldQty : 1;
    const cogsCents = Math.round(totalCents / yieldQty);
    const prod = products.find((p) => p.id === formProductId);
    const priceCents = prod ? prod.price_cents : 0;
    const marginCents = priceCents - cogsCents;
    const marginPercent = priceCents > 0 ? Math.round(((marginCents / priceCents) * 100) * 10) / 10 : 0;
    const foodCostPercent = priceCents > 0 ? Math.round(((cogsCents / priceCents) * 100) * 10) / 10 : 0;

    return {
      totalBatchCents: totalCents,
      cogsCents,
      priceCents,
      marginCents,
      marginPercent,
      foodCostPercent,
    };
  }, [formItems, formYieldQty, formProductId, inventoryItems, products]);

  // Save Recipe
  const handleSaveRecipe = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError(null);
    setFormSuccess(null);

    if (!formProductId) {
      setFormError('Debes seleccionar un producto comercial para la receta.');
      return;
    }
    if (!formName.trim()) {
      setFormError('El nombre de la receta es obligatorio.');
      return;
    }
    if (formItems.length === 0) {
      setFormError('La receta debe contener al menos un ingrediente.');
      return;
    }

    try {
      if (editingRecipeId) {
        await updateRecipe(editingRecipeId, {
          name: formName,
          yield_quantity: formYieldQty,
          yield_unit: formYieldUnit,
          items: formItems,
          modifier_items: formModifiers,
          preparation_instructions: formInstructions,
        });
        setFormSuccess('Receta actualizada con éxito. Nueva versión registrada en historial.');
      } else {
        await createRecipe({
          product_id: formProductId,
          name: formName,
          yield_quantity: formYieldQty,
          yield_unit: formYieldUnit,
          items: formItems,
          modifier_items: formModifiers,
          preparation_instructions: formInstructions,
        });
        setFormSuccess('Receta creada exitosamente con versión 1.');
      }
      setTimeout(() => {
        setIsEditorOpen(false);
      }, 900);
    } catch (err: any) {
      setFormError(err.message || 'Error al guardar la receta.');
    }
  };

  // Delete Recipe
  const handleDeleteRecipe = async (recipe: Recipe) => {
    if (!window.confirm(`¿Estás seguro de desactivar la receta "${recipe.name}"?`)) {
      return;
    }
    try {
      await deleteRecipe(recipe.id);
      setSelectedRecipeForDetail(null);
    } catch (err: any) {
      alert(err.message || 'Error al desactivar la receta.');
    }
  };

  return (
    <div className="max-w-7xl mx-auto p-4 sm:p-6 space-y-6">
      {/* 1. TOP HEADER & METRICS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-3xl border border-zinc-200 shadow-xs">
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="p-2.5 rounded-2xl border border-zinc-200 hover:bg-zinc-50 transition cursor-pointer text-[#101828]"
            title="Volver"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-black uppercase tracking-wider text-[#05268F] bg-[#EAF0FF] px-2.5 py-0.5 rounded-full">
                Core F7 — Recetas & COGS
              </span>
              <span className="text-xs text-[#667085] font-semibold">
                • Inventario Único F6
              </span>
            </div>
            <h1 className="text-2xl font-black text-[#101828] tracking-tight mt-1">
              Recetas, Escandallos y Costeo Real
            </h1>
            <p className="text-xs text-[#667085] mt-0.5">
              Fichas técnicas estandarizadas, consumo atómico por venta y margen bruto por platillo.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleOpenCreate()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer"
          >
            <Plus className="w-4 h-4" />
            <span>Nueva Receta</span>
          </button>
        </div>
      </div>

      {/* 2. SUMMARY STATS CARDS */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Recipes */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085]">
              Recetas Activas
            </span>
            <div className="text-3xl font-black text-[#101828] mt-1">
              {recipeSummary?.total_recipes || recipes.length}
            </div>
            <span className="text-xs text-[#05268F] font-bold">
              {recipeSummary?.products_with_recipe || 0} platillos cubiertos
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#EAF0FF] text-[#05268F]">
            <BookOpen className="w-6 h-6" />
          </div>
        </div>

        {/* Average Food Cost % */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085]">
              Food Cost Promedio
            </span>
            <div className="text-3xl font-black text-[#101828] mt-1">
              {recipeSummary?.average_food_cost_percent || 0}%
            </div>
            <span className="text-xs text-zinc-500 font-bold">
              Meta estándar: 25% - 35%
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-[#FFF7D6] text-[#101828]">
            <Scale className="w-6 h-6 text-[#05268F]" />
          </div>
        </div>

        {/* Average Gross Margin % */}
        <div className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085]">
              Margen Bruto Promedio
            </span>
            <div className="text-3xl font-black text-emerald-700 mt-1">
              {recipeSummary?.average_gross_margin_percent || 0}%
            </div>
            <span className="text-xs text-emerald-600 font-bold flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> Rentabilidad operativa
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-emerald-50 text-emerald-700">
            <DollarSign className="w-6 h-6" />
          </div>
        </div>

        {/* Products Missing Recipe Alert */}
        <div
          onClick={() => setActiveTab('missing')}
          className="bg-white rounded-3xl p-5 border border-zinc-200 shadow-xs flex items-center justify-between hover:border-amber-400 transition cursor-pointer"
        >
          <div>
            <span className="text-[11px] font-black uppercase tracking-wider text-[#667085]">
              Sin Receta
            </span>
            <div className="text-3xl font-black text-amber-700 mt-1">
              {recipeSummary?.products_without_recipe || 0}
            </div>
            <span className="text-xs text-amber-600 font-bold">
              Platillos por vincular →
            </span>
          </div>
          <div className="p-3.5 rounded-2xl bg-amber-50 text-amber-700">
            <AlertTriangle className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* 3. NAVIGATION TABS & SEARCH */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-2 p-1.5 bg-white rounded-2xl border border-zinc-200 w-fit">
          <button
            onClick={() => setActiveTab('catalog')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer ${
              activeTab === 'catalog'
                ? 'bg-[#05268F] text-white shadow-xs'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            Fichas Técnicas ({recipes.length})
          </button>
          <button
            onClick={() => setActiveTab('missing')}
            className={`px-4 py-2 rounded-xl text-xs font-black transition cursor-pointer flex items-center gap-1.5 ${
              activeTab === 'missing'
                ? 'bg-[#05268F] text-white shadow-xs'
                : 'text-[#667085] hover:text-[#101828]'
            }`}
          >
            <span>Productos Sin Receta</span>
            {(recipeSummary?.products_without_recipe || 0) > 0 && (
              <span className="px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-800 text-[10px] font-black">
                {recipeSummary?.products_without_recipe}
              </span>
            )}
          </button>
        </div>

        {activeTab === 'catalog' && (
          <div className="relative min-w-[280px]">
            <Search className="w-4 h-4 text-zinc-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Buscar por platillo o insumo..."
              className="w-full pl-9 pr-4 py-2 text-xs rounded-2xl bg-white border border-zinc-200 focus:outline-none focus:border-[#05268F] text-[#101828] font-medium"
            />
          </div>
        )}
      </div>

      {/* 4. TAB CONTENT: CATALOG OF RECIPES */}
      {activeTab === 'catalog' && (
        <div className="space-y-4">
          <div className="bg-white rounded-3xl border border-zinc-200 overflow-hidden shadow-xs">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead>
                  <tr className="bg-zinc-50 border-b border-zinc-200 text-[#667085] font-black uppercase tracking-wider text-[11px]">
                    <th className="py-4 px-6">Platillo / Receta</th>
                    <th className="py-4 px-4">Rendimiento</th>
                    <th className="py-4 px-4 text-right">Costo Receta (COGS)</th>
                    <th className="py-4 px-4 text-right">Precio Venta</th>
                    <th className="py-4 px-4 text-right">Margen Bruto</th>
                    <th className="py-4 px-4 text-center">Versión</th>
                    <th className="py-4 px-6 text-right">Acciones</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 font-medium">
                  {filteredRecipes.map((recipe) => {
                    const costCalc = recipe.cost_calculation;
                    const cogsCents = costCalc ? costCalc.cogs_cents : 0;
                    const sellingPriceCents = costCalc ? costCalc.selling_price_cents : 0;
                    const marginCents = costCalc ? costCalc.gross_margin_cents : 0;
                    const marginPercent = costCalc ? costCalc.gross_margin_percent : 0;
                    const foodCostPercent = costCalc ? costCalc.food_cost_percent : 0;

                    return (
                      <tr key={recipe.id} className="hover:bg-zinc-50/70 transition">
                        <td className="py-4 px-6">
                          <div className="font-bold text-[#101828] text-sm">
                            {recipe.name}
                          </div>
                          <div className="text-[11px] text-[#667085] flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono bg-zinc-100 px-1.5 py-0.5 rounded text-[10px]">
                              {recipe.product_id}
                            </span>
                            <span>• {recipe.items?.length || 0} insumos</span>
                            {recipe.modifier_items && recipe.modifier_items.length > 0 && (
                              <span>• {recipe.modifier_items.length} modificadores</span>
                            )}
                          </div>
                        </td>
                        <td className="py-4 px-4">
                          <span className="font-bold text-[#101828]">
                            {recipe.yield_quantity} {recipe.yield_unit || 'porción'}
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div className="font-bold text-[#101828]">
                            ${(cogsCents / 100).toFixed(2)} MXN
                          </div>
                          <div className="text-[10px] text-zinc-500 font-semibold">
                            {foodCostPercent}% del precio
                          </div>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <span className="font-bold text-[#101828]">
                            ${(sellingPriceCents / 100).toFixed(2)} MXN
                          </span>
                        </td>
                        <td className="py-4 px-4 text-right">
                          <div
                            className={`font-black ${
                              marginPercent >= 60
                                ? 'text-emerald-700'
                                : marginPercent >= 45
                                ? 'text-blue-700'
                                : 'text-amber-700'
                            }`}
                          >
                            ${(marginCents / 100).toFixed(2)} ({marginPercent}%)
                          </div>
                          <span className="text-[10px] text-zinc-500 font-semibold">
                            utilidad bruta
                          </span>
                        </td>
                        <td className="py-4 px-4 text-center">
                          <span className="px-2.5 py-1 rounded-full bg-zinc-100 text-[#101828] text-[11px] font-black">
                            v{recipe.version || 1}
                          </span>
                        </td>
                        <td className="py-4 px-6 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedRecipeForDetail(recipe)}
                              className="px-2.5 py-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-xs font-bold text-[#05268F] transition cursor-pointer"
                              title="Ver ficha técnica completa"
                            >
                              Ficha
                            </button>
                            <button
                              onClick={() => handleOpenEdit(recipe)}
                              className="p-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition cursor-pointer"
                              title="Editar receta"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => setSelectedRecipeHistory(recipe)}
                              className="p-1.5 rounded-xl border border-zinc-200 hover:bg-zinc-100 text-zinc-700 transition cursor-pointer"
                              title="Historial de versiones"
                            >
                              <History className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteRecipe(recipe)}
                              className="p-1.5 rounded-xl border border-rose-200 hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                              title="Desactivar"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}

                  {filteredRecipes.length === 0 && (
                    <tr>
                      <td colSpan={7} className="py-12 text-center text-[#667085]">
                        <BookOpen className="w-8 h-8 text-zinc-300 mx-auto mb-2" />
                        <p className="font-bold">No se encontraron recetas.</p>
                        <p className="text-xs mt-1">Crea tu primera receta para comenzar a costear platillos.</p>
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* 5. TAB CONTENT: PRODUCTS MISSING RECIPE */}
      {activeTab === 'missing' && (
        <div className="bg-white rounded-3xl border border-zinc-200 p-6 space-y-4 shadow-xs">
          <div>
            <h2 className="text-lg font-black text-[#101828]">
              Platillos Comerciales Sin Receta Configurada
            </h2>
            <p className="text-xs text-[#667085] mt-0.5">
              Estos productos pueden venderse en el POS, pero no descontarán inventario atómico ni calcularán COGS hasta tener una receta.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
            {(recipeSummary?.missing_recipe_products || []).map((prod) => (
              <div
                key={prod.id}
                className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black uppercase text-amber-800 bg-amber-100 px-2 py-0.5 rounded-full">
                      {prod.category}
                    </span>
                    <span className="text-xs font-bold text-[#101828]">
                      ${(prod.price_cents / 100).toFixed(2)} MXN
                    </span>
                  </div>
                  <h3 className="font-bold text-sm text-[#101828] mt-2">
                    {prod.name}
                  </h3>
                  <span className="text-[11px] text-[#667085] font-mono block mt-0.5">
                    {prod.id}
                  </span>
                </div>

                <div className="mt-4 pt-3 border-t border-amber-200/60 flex items-center justify-between">
                  <span className="text-xs text-amber-700 font-semibold flex items-center gap-1">
                    <AlertTriangle className="w-3.5 h-3.5" /> Sin receta
                  </span>
                  <button
                    onClick={() => handleOpenCreate(prod.id)}
                    className="px-3 py-1.5 rounded-xl bg-[#05268F] hover:bg-[#041E70] text-white text-xs font-black shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Crear Receta
                  </button>
                </div>
              </div>
            ))}

            {(recipeSummary?.missing_recipe_products || []).length === 0 && (
              <div className="col-span-full py-12 text-center text-emerald-700">
                <CheckCircle2 className="w-8 h-8 text-emerald-600 mx-auto mb-2" />
                <p className="font-bold">¡Excelente cobertura!</p>
                <p className="text-xs text-[#667085] mt-1">
                  Todos los platillos comerciales cuentan con una receta o están vinculados a insumos de almacén.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 6. MODAL: DETAILED FICHA TÉCNICA */}
      {selectedRecipeForDetail && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-2xl w-full p-6 space-y-5 max-h-[90vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-4">
              <div>
                <span className="text-xs font-black uppercase text-[#05268F] bg-[#EAF0FF] px-2.5 py-0.5 rounded-full">
                  Ficha Técnica Oficial
                </span>
                <h2 className="text-xl font-black text-[#101828] mt-1">
                  {selectedRecipeForDetail.name}
                </h2>
                <span className="text-xs text-[#667085]">
                  Versión {selectedRecipeForDetail.version} • Rendimiento: {selectedRecipeForDetail.yield_quantity} {selectedRecipeForDetail.yield_unit || 'porción'}
                </span>
              </div>
              <button
                onClick={() => setSelectedRecipeForDetail(null)}
                className="p-2 rounded-2xl hover:bg-zinc-100 text-[#667085] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Ingredients table in ficha técnica */}
            <div>
              <h3 className="text-xs font-black uppercase tracking-wider text-[#667085] mb-2">
                Ingredientes & Consumo por Porción
              </h3>
              <div className="border border-zinc-200 rounded-2xl overflow-hidden text-xs">
                <table className="w-full text-left">
                  <thead className="bg-zinc-50 border-b border-zinc-200 font-bold text-[#667085]">
                    <tr>
                      <th className="py-2.5 px-3">Insumo</th>
                      <th className="py-2.5 px-3">Cantidad</th>
                      <th className="py-2.5 px-3">Merma %</th>
                      <th className="py-2.5 px-3 text-right">Costo Línea</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-100">
                    {selectedRecipeForDetail.cost_calculation?.items_breakdown.map((item, idx) => (
                      <tr key={idx}>
                        <td className="py-2.5 px-3 font-semibold text-[#101828]">
                          {item.name}
                          <span className="text-[10px] text-zinc-400 block font-mono">{item.sku}</span>
                        </td>
                        <td className="py-2.5 px-3">
                          {item.quantity} {item.unit}
                        </td>
                        <td className="py-2.5 px-3">
                          {item.waste_percent}%
                        </td>
                        <td className="py-2.5 px-3 text-right font-bold text-[#101828]">
                          ${(item.line_cost_cents / 100).toFixed(2)} MXN
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Modifiers section */}
            {selectedRecipeForDetail.modifier_items && selectedRecipeForDetail.modifier_items.length > 0 && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#667085] mb-2">
                  Reglas de Modificadores en Inventario
                </h3>
                <div className="space-y-1.5 text-xs">
                  {selectedRecipeForDetail.modifier_items.map((mod, idx) => (
                    <div
                      key={idx}
                      className="p-2.5 rounded-xl border border-zinc-200 bg-zinc-50/50 flex items-center justify-between"
                    >
                      <span className="font-bold text-[#101828]">{mod.modifier_name}</span>
                      <span
                        className={`text-[11px] font-black px-2 py-0.5 rounded-full ${
                          mod.affects_inventory
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-zinc-100 text-zinc-600'
                        }`}
                      >
                        {mod.affects_inventory
                          ? `Consume: ${mod.quantity} ${mod.unit}`
                          : 'Sin impacto en inventario'}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Preparation instructions */}
            {selectedRecipeForDetail.preparation_instructions && (
              <div>
                <h3 className="text-xs font-black uppercase tracking-wider text-[#667085] mb-1.5">
                  Método de Preparación & SLA
                </h3>
                <p className="text-xs text-zinc-700 bg-zinc-50 p-3 rounded-2xl border border-zinc-200 leading-relaxed">
                  {selectedRecipeForDetail.preparation_instructions}
                </p>
              </div>
            )}

            {/* Cost & Margins Box */}
            {selectedRecipeForDetail.cost_calculation && (
              <div className="p-4 rounded-2xl bg-[#EAF0FF] border border-[#CCD8FF] grid grid-cols-3 gap-2 text-center text-xs">
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#05268F]">Costo COGS</span>
                  <div className="text-base font-black text-[#101828] mt-0.5">
                    ${(selectedRecipeForDetail.cost_calculation.cogs_cents / 100).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#05268F]">Precio Venta</span>
                  <div className="text-base font-black text-[#101828] mt-0.5">
                    ${(selectedRecipeForDetail.cost_calculation.selling_price_cents / 100).toFixed(2)}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-[#05268F]">Margen Bruto</span>
                  <div className="text-base font-black text-emerald-700 mt-0.5">
                    {selectedRecipeForDetail.cost_calculation.gross_margin_percent}%
                  </div>
                </div>
              </div>
            )}

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRecipeForDetail(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800 transition cursor-pointer"
              >
                Cerrar Ficha
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 7. MODAL: VERSION HISTORY */}
      {selectedRecipeHistory && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-xl w-full p-6 space-y-4 max-h-[85vh] overflow-y-auto shadow-xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-xs font-black uppercase text-[#05268F] bg-[#EAF0FF] px-2.5 py-0.5 rounded-full">
                  Auditoría Inmutable
                </span>
                <h2 className="text-lg font-black text-[#101828] mt-1">
                  Historial de Versiones: {selectedRecipeHistory.name}
                </h2>
              </div>
              <button
                onClick={() => setSelectedRecipeHistory(null)}
                className="p-2 rounded-2xl hover:bg-zinc-100 text-[#667085] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {/* Current Version */}
              <div className="p-3.5 rounded-2xl border-2 border-[#05268F] bg-[#EAF0FF]/30 text-xs space-y-1">
                <div className="flex items-center justify-between">
                  <span className="font-black text-[#05268F]">
                    Versión Actual (v{selectedRecipeHistory.version})
                  </span>
                  <span className="text-[10px] text-zinc-500 font-mono">
                    {new Date(selectedRecipeHistory.updated_at).toLocaleString()}
                  </span>
                </div>
                <p className="text-zinc-600">
                  {selectedRecipeHistory.items.length} ingredientes configurados.
                </p>
              </div>

              {/* Historical archived versions */}
              {(selectedRecipeHistory.versions_history || []).map((ver, idx) => (
                <div
                  key={idx}
                  className="p-3.5 rounded-2xl border border-zinc-200 bg-white text-xs space-y-1.5"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-[#101828]">
                      Versión {ver.version}
                    </span>
                    <span className="text-[10px] text-zinc-500 font-mono">
                      {new Date(ver.calculated_at).toLocaleString()}
                    </span>
                  </div>
                  <div className="text-[#667085] flex items-center justify-between">
                    <span>Modificado por: {ver.changed_by}</span>
                    <span className="font-bold text-[#101828]">
                      Costo Snapshot: ${(ver.cost_per_yield_cents / 100).toFixed(2)} MXN
                    </span>
                  </div>
                  {ver.notes && (
                    <p className="text-[11px] text-zinc-500 italic bg-zinc-50 p-2 rounded-xl">
                      {ver.notes}
                    </p>
                  )}
                </div>
              ))}

              {(!selectedRecipeHistory.versions_history || selectedRecipeHistory.versions_history.length === 0) && (
                <div className="py-6 text-center text-xs text-zinc-500">
                  Esta receta aún no tiene versiones históricas archivadas (se encuentra en su versión inicial v1).
                </div>
              )}
            </div>

            <div className="pt-2 flex justify-end">
              <button
                onClick={() => setSelectedRecipeHistory(null)}
                className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800 transition cursor-pointer"
              >
                Cerrar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 8. MODAL: CREATE / EDIT RECIPE FORM */}
      {isEditorOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-3xl max-w-3xl w-full p-6 space-y-5 max-h-[92vh] overflow-y-auto shadow-2xl">
            <div className="flex items-center justify-between border-b border-zinc-100 pb-3">
              <div>
                <span className="text-xs font-black uppercase text-[#05268F] bg-[#EAF0FF] px-2.5 py-0.5 rounded-full">
                  {editingRecipeId ? 'Actualizar Versión de Receta' : 'Nueva Receta Estándar'}
                </span>
                <h2 className="text-xl font-black text-[#101828] mt-1">
                  {editingRecipeId ? 'Editar Escandallo' : 'Crear Ficha Técnica'}
                </h2>
              </div>
              <button
                onClick={() => setIsEditorOpen(false)}
                className="p-2 rounded-2xl hover:bg-zinc-100 text-[#667085] cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-800 font-bold flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            {formSuccess && (
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-xs text-emerald-800 font-bold flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>{formSuccess}</span>
              </div>
            )}

            <form onSubmit={handleSaveRecipe} className="space-y-4">
              {/* Product selector and recipe name */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#667085] block mb-1">
                    Platillo Comercial
                  </label>
                  <select
                    value={formProductId}
                    onChange={(e) => {
                      setFormProductId(e.target.value);
                      const prod = products.find((p) => p.id === e.target.value);
                      if (prod && !formName) setFormName(`Receta: ${prod.name}`);
                    }}
                    disabled={Boolean(editingRecipeId)}
                    className="w-full px-3 py-2 text-xs rounded-2xl bg-white border border-zinc-200 font-semibold text-[#101828]"
                  >
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} (${(p.price_cents / 100).toFixed(2)} MXN)
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#667085] block mb-1">
                    Nombre de la Receta
                  </label>
                  <input
                    type="text"
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    required
                    placeholder="Ej. Hamburguesa Clásica Angus"
                    className="w-full px-3 py-2 text-xs rounded-2xl bg-white border border-zinc-200 font-semibold text-[#101828]"
                  />
                </div>
              </div>

              {/* Yield Quantity & Unit */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#667085] block mb-1">
                    Rendimiento (Cantidad)
                  </label>
                  <input
                    type="number"
                    step="any"
                    min="0.01"
                    value={formYieldQty}
                    onChange={(e) => setFormYieldQty(parseFloat(e.target.value) || 1)}
                    required
                    className="w-full px-3 py-2 text-xs rounded-2xl bg-white border border-zinc-200 font-semibold text-[#101828]"
                  />
                </div>
                <div>
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#667085] block mb-1">
                    Unidad de Rendimiento
                  </label>
                  <select
                    value={formYieldUnit}
                    onChange={(e) => setFormYieldUnit(e.target.value)}
                    className="w-full px-3 py-2 text-xs rounded-2xl bg-white border border-zinc-200 font-semibold text-[#101828]"
                  >
                    <option value="porción">porción</option>
                    <option value="pza">pza</option>
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="lt">lt</option>
                    <option value="ml">ml</option>
                  </select>
                </div>
              </div>

              {/* INGREDIENTS LIST */}
              <div className="space-y-2 pt-2">
                <div className="flex items-center justify-between">
                  <label className="text-[11px] font-black uppercase tracking-wider text-[#667085]">
                    Ingredientes del Almacén F6
                  </label>
                  <button
                    type="button"
                    onClick={handleAddItemRow}
                    className="text-xs font-black text-[#05268F] hover:underline flex items-center gap-1 cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" /> Agregar Insumo
                  </button>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto border border-zinc-200 rounded-2xl p-2 bg-zinc-50/50">
                  {formItems.map((item, idx) => (
                    <div
                      key={idx}
                      className="flex flex-wrap sm:flex-nowrap items-center gap-2 bg-white p-2.5 rounded-xl border border-zinc-200"
                    >
                      <select
                        value={item.inventory_item_id}
                        onChange={(e) => handleUpdateItemRow(idx, { inventory_item_id: e.target.value })}
                        className="flex-1 min-w-[160px] text-xs py-1.5 px-2 rounded-xl bg-zinc-50 border border-zinc-200 font-medium"
                      >
                        {inventoryItems.map((inv) => (
                          <option key={inv.id} value={inv.id}>
                            {inv.name} (${(inv.cost_cents / 100).toFixed(2)}/{inv.base_unit})
                          </option>
                        ))}
                      </select>

                      <div className="flex items-center gap-1 w-28">
                        <input
                          type="number"
                          step="any"
                          min="0.0001"
                          value={item.quantity}
                          onChange={(e) =>
                            handleUpdateItemRow(idx, { quantity: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="Cant."
                          className="w-16 text-xs py-1.5 px-2 rounded-xl bg-zinc-50 border border-zinc-200 font-bold"
                        />
                        <select
                          value={item.unit}
                          onChange={(e) => handleUpdateItemRow(idx, { unit: e.target.value })}
                          className="w-14 text-xs py-1.5 px-1 rounded-xl bg-zinc-50 border border-zinc-200"
                        >
                          <option value="pza">pza</option>
                          <option value="kg">kg</option>
                          <option value="g">g</option>
                          <option value="lt">lt</option>
                          <option value="ml">ml</option>
                          <option value="oz">oz</option>
                        </select>
                      </div>

                      <div className="flex items-center gap-1 w-24">
                        <input
                          type="number"
                          min="0"
                          max="100"
                          value={item.waste_percent || 0}
                          onChange={(e) =>
                            handleUpdateItemRow(idx, { waste_percent: parseFloat(e.target.value) || 0 })
                          }
                          placeholder="% Merma"
                          className="w-14 text-xs py-1.5 px-2 rounded-xl bg-zinc-50 border border-zinc-200"
                        />
                        <span className="text-[11px] text-zinc-500 font-bold">%</span>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleRemoveItemRow(idx)}
                        className="p-1.5 rounded-xl hover:bg-rose-50 text-rose-600 transition cursor-pointer"
                        title="Eliminar insumo"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}

                  {formItems.length === 0 && (
                    <div className="py-6 text-center text-xs text-zinc-500">
                      No hay ingredientes en la receta. Haz clic en "Agregar Insumo".
                    </div>
                  )}
                </div>
              </div>

              {/* LIVE ESTIMATED COGS AND MARGIN SUMMARY */}
              <div className="p-4 rounded-2xl bg-[#FFF7D6] border border-[#FFE270] flex flex-wrap items-center justify-between gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-black uppercase text-[#05268F]">Costo Calculado (COGS)</span>
                  <div className="text-lg font-black text-[#101828]">
                    ${(estimatedCostData.cogsCents / 100).toFixed(2)} MXN
                  </div>
                  <span className="text-[11px] text-zinc-600 font-semibold">
                    Food cost: {estimatedCostData.foodCostPercent}%
                  </span>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#05268F]">Precio Venta</span>
                  <div className="text-lg font-black text-[#101828]">
                    ${(estimatedCostData.priceCents / 100).toFixed(2)} MXN
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-black uppercase text-[#05268F]">Margen Bruto</span>
                  <div className="text-lg font-black text-emerald-800">
                    ${(estimatedCostData.marginCents / 100).toFixed(2)} ({estimatedCostData.marginPercent}%)
                  </div>
                </div>
              </div>

              {/* Instructions */}
              <div>
                <label className="text-[11px] font-black uppercase tracking-wider text-[#667085] block mb-1">
                  Instrucciones de Preparación / Ficha Técnica (Opcional)
                </label>
                <textarea
                  rows={2}
                  value={formInstructions}
                  onChange={(e) => setFormInstructions(e.target.value)}
                  placeholder="Detallar proceso de cocción, temperaturas, montaje o emplatado..."
                  className="w-full px-3 py-2 text-xs rounded-2xl bg-white border border-zinc-200 font-medium text-[#101828]"
                />
              </div>

              {/* Action Buttons */}
              <div className="pt-2 flex items-center justify-end gap-2 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsEditorOpen(false)}
                  className="px-4 py-2 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-xs font-bold text-zinc-800 transition cursor-pointer"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2 rounded-xl bg-[#05268F] hover:bg-[#041E70] text-xs font-black text-white shadow-xs transition active:scale-95 cursor-pointer flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{editingRecipeId ? 'Guardar Versión' : 'Crear Receta'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
