/**
 * DIRECTAURANTE POS CORE v0.1 - Recipes, Ingredients Consumption & COGS Service
 * Unified, persistent, atomic, multi-tenant recipe & costing engine.
 * Single source of truth for bill of materials (BOM), ingredient consumption on sale,
 * sub-recipes, modifier inventory impact, and gross profit margin calculation.
 * Builds strictly on top of F6 Inventory Core.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import {
  Recipe,
  RecipeItem,
  RecipeModifierItem,
  RecipeVersionRecord,
  RecipeCostCalculation,
  RecipeCostBreakdownItem,
  RecipeSummary,
  InventoryUnit,
  Product,
} from '../../core/types';
import { InventoryService } from '../inventory/inventoryService';
import { AuditService } from '../../core/audit';

export interface CreateRecipeDTO {
  product_id: string;
  name: string;
  yield_quantity?: number;
  yield_unit?: string;
  items: RecipeItem[];
  modifier_items?: RecipeModifierItem[];
  sub_recipe_ids?: string[];
  preparation_instructions?: string;
}

export interface UpdateRecipeDTO {
  name?: string;
  yield_quantity?: number;
  yield_unit?: string;
  items?: RecipeItem[];
  modifier_items?: RecipeModifierItem[];
  sub_recipe_ids?: string[];
  preparation_instructions?: string;
  is_active?: boolean;
}

export class RecipeService {
  /**
   * Helper to generate unique identifiers
   */
  private static generateId(prefix: string): string {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
  }

  /**
   * Standardized Unit Conversion Engine (Reusing F6 Inventory units)
   * Converts a quantity from one unit to the inventory item's base unit.
   */
  public static convertUnit(
    quantity: number,
    fromUnit: string,
    toUnit: string,
    itemConversionFactor?: number
  ): number {
    const from = fromUnit.toLowerCase().trim();
    const to = toUnit.toLowerCase().trim();

    if (from === to) {
      return quantity;
    }

    // Weight conversions (kg <-> g <-> oz)
    if (from === 'kg' && to === 'g') return quantity * 1000;
    if (from === 'g' && to === 'kg') return quantity / 1000;
    if (from === 'oz' && to === 'g') return quantity * 28.3495;
    if (from === 'g' && to === 'oz') return quantity / 28.3495;
    if (from === 'oz' && to === 'kg') return (quantity * 28.3495) / 1000;
    if (from === 'kg' && to === 'oz') return (quantity * 1000) / 28.3495;

    // Volume conversions (lt <-> ml <-> oz)
    if ((from === 'lt' || from === 'l') && to === 'ml') return quantity * 1000;
    if (from === 'ml' && (to === 'lt' || to === 'l')) return quantity / 1000;
    if (from === 'oz' && to === 'ml') return quantity * 29.5735;
    if (from === 'ml' && to === 'oz') return quantity / 29.5735;
    if (from === 'oz' && (to === 'lt' || to === 'l')) return (quantity * 29.5735) / 1000;
    if ((from === 'lt' || from === 'l') && to === 'oz') return (quantity * 1000) / 29.5735;

    // Packaging / Piece conversions
    const factor = itemConversionFactor || 1;
    if (from === 'caja' && (to === 'pza' || to === 'piezas')) return quantity * factor;
    if ((from === 'pza' || from === 'piezas') && to === 'caja') return quantity / factor;
    if (from === 'porción' && to === 'pza') return quantity;
    if (from === 'pza' && to === 'porción') return quantity;

    // Default 1:1 if units are nominal equivalents
    return quantity;
  }

  /**
   * List all recipes for a restaurant with optional product or search filters
   */
  public static getRecipes(
    restaurant_id: string = DEFAULT_RESTAURANT_ID,
    filters?: {
      product_id?: string;
      search?: string;
      is_active?: boolean;
    }
  ): Recipe[] {
    const recipes = db.get('recipes') || [];
    let result = recipes.filter((r) => r.restaurant_id === restaurant_id);

    if (filters?.is_active !== undefined) {
      result = result.filter((r) => r.is_active === filters.is_active);
    } else {
      result = result.filter((r) => r.is_active);
    }

    if (filters?.product_id) {
      result = result.filter((r) => r.product_id === filters.product_id);
    }

    if (filters?.search && filters.search.trim()) {
      const q = filters.search.toLowerCase().trim();
      result = result.filter(
        (r) => r.name.toLowerCase().includes(q) || r.product_id.toLowerCase().includes(q)
      );
    }

    return result;
  }

  /**
   * Get single recipe by ID
   */
  public static getRecipeById(
    recipe_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Recipe | undefined {
    const recipes = db.get('recipes') || [];
    return recipes.find((r) => r.id === recipe_id && r.restaurant_id === restaurant_id);
  }

  /**
   * Get recipe associated with a specific commercial product
   */
  public static getRecipeByProductId(
    product_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Recipe | undefined {
    const recipes = db.get('recipes') || [];
    return recipes.find(
      (r) => r.product_id === product_id && r.restaurant_id === restaurant_id && r.is_active
    );
  }

  /**
   * Calculate Real Cost & Margins (COGS) dynamically from current Inventory prices
   */
  public static calculateRecipeCost(
    recipe_or_id: string | Recipe,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): RecipeCostCalculation {
    let recipe: Recipe | undefined;

    if (typeof recipe_or_id === 'string') {
      recipe = this.getRecipeById(recipe_or_id, restaurant_id);
      if (!recipe) {
        throw new Error(`Receta "${recipe_or_id}" no encontrada en el restaurante.`);
      }
    } else {
      recipe = recipe_or_id;
    }

    const products = db.get('products') || [];
    const product = products.find((p) => p.id === recipe!.product_id && p.restaurant_id === restaurant_id);
    const sellingPriceCents = product ? product.price_cents : 0;
    const productName = product ? product.name : recipe.name;

    const itemsBreakdown: RecipeCostBreakdownItem[] = [];
    let totalBatchCostCents = 0;

    // 1. Calculate cost for each ingredient from F6 Inventory
    for (const item of recipe.items || []) {
      const invItem = InventoryService.getItemById(item.inventory_item_id, restaurant_id);
      if (!invItem) {
        continue;
      }

      // Unit conversion to item's base unit
      const convertedQty = this.convertUnit(
        item.quantity,
        item.unit,
        invItem.base_unit,
        invItem.conversion_factor
      );

      // Waste factor calculation
      const wasteFactor = 1 + (item.waste_percent || 0) / 100;
      const effectiveQty = Math.round(convertedQty * wasteFactor * 1000) / 1000;

      // Line cost in cents
      const lineCostCents = Math.round(effectiveQty * invItem.cost_cents);
      totalBatchCostCents += lineCostCents;

      itemsBreakdown.push({
        inventory_item_id: invItem.id,
        name: invItem.name,
        sku: invItem.sku,
        quantity: item.quantity,
        unit: item.unit,
        waste_percent: item.waste_percent || 0,
        effective_quantity: effectiveQty,
        unit_cost_cents: invItem.cost_cents,
        base_unit: invItem.base_unit,
        line_cost_cents: lineCostCents,
      });
    }

    // 2. Sub-recipes support
    if (recipe.sub_recipe_ids && recipe.sub_recipe_ids.length > 0) {
      for (const subId of recipe.sub_recipe_ids) {
        const subRecipe = this.getRecipeById(subId, restaurant_id);
        if (subRecipe && subRecipe.id !== recipe.id) {
          const subCost = this.calculateRecipeCost(subRecipe, restaurant_id);
          totalBatchCostCents += subCost.cogs_cents;
        }
      }
    }

    // 3. Modifier costs breakdown
    const modifierCosts: Array<{
      modifier_name: string;
      affects_inventory: boolean;
      cost_cents: number;
      inventory_item_name?: string;
    }> = [];

    if (recipe.modifier_items && recipe.modifier_items.length > 0) {
      for (const mod of recipe.modifier_items) {
        if (mod.affects_inventory && mod.inventory_item_id) {
          const modInv = InventoryService.getItemById(mod.inventory_item_id, restaurant_id);
          if (modInv) {
            const converted = this.convertUnit(
              mod.quantity || 1,
              mod.unit || modInv.base_unit,
              modInv.base_unit,
              modInv.conversion_factor
            );
            const waste = 1 + (mod.waste_percent || 0) / 100;
            const cost = Math.round(converted * waste * modInv.cost_cents);
            modifierCosts.push({
              modifier_name: mod.modifier_name,
              affects_inventory: true,
              cost_cents: cost,
              inventory_item_name: modInv.name,
            });
          }
        } else {
          modifierCosts.push({
            modifier_name: mod.modifier_name,
            affects_inventory: false,
            cost_cents: 0,
          });
        }
      }
    }

    // 4. Yield, COGS and Margins
    const yieldQty = recipe.yield_quantity > 0 ? recipe.yield_quantity : 1;
    const cogsCents = Math.round(totalBatchCostCents / yieldQty);
    const grossMarginCents = sellingPriceCents - cogsCents;
    const grossMarginPercent =
      sellingPriceCents > 0
        ? Math.round(((grossMarginCents / sellingPriceCents) * 100) * 10) / 10
        : 0;
    const foodCostPercent =
      sellingPriceCents > 0
        ? Math.round(((cogsCents / sellingPriceCents) * 100) * 10) / 10
        : 0;

    return {
      recipe_id: recipe.id,
      product_id: recipe.product_id,
      product_name: productName,
      selling_price_cents: sellingPriceCents,
      yield_quantity: yieldQty,
      yield_unit: recipe.yield_unit || 'porción',
      total_batch_cost_cents: totalBatchCostCents,
      cogs_cents: cogsCents,
      gross_margin_cents: grossMarginCents,
      gross_margin_percent: grossMarginPercent,
      food_cost_percent: foodCostPercent,
      items_breakdown: itemsBreakdown,
      modifier_costs: modifierCosts,
      has_outdated_cost: false,
      calculated_at: new Date().toISOString(),
    };
  }

  /**
   * Create a new Recipe with version 1
   */
  public static createRecipe(
    data: CreateRecipeDTO,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Recipe {
    const recipes = db.get('recipes');
    const now = new Date().toISOString();

    // Check if recipe already exists for product
    const existing = recipes.find(
      (r) => r.product_id === data.product_id && r.restaurant_id === restaurant_id && r.is_active
    );
    if (existing) {
      throw new Error(`El producto ya cuenta con la receta activa "${existing.name}". Edita la existente.`);
    }

    // Validate that each ingredient exists in F6 Inventory
    for (const item of data.items) {
      const invItem = InventoryService.getItemById(item.inventory_item_id, restaurant_id);
      if (!invItem) {
        throw new Error(
          `Insumo de inventario "${item.inventory_item_id}" no encontrado en el almacén.`
        );
      }
      if (!item.item_name) {
        item.item_name = invItem.name;
      }
    }

    const newRecipe: Recipe = {
      id: this.generateId('rec'),
      restaurant_id,
      product_id: data.product_id,
      name: data.name,
      yield_quantity: data.yield_quantity || 1,
      yield_unit: data.yield_unit || 'porción',
      items: data.items,
      modifier_items: data.modifier_items || [],
      sub_recipe_ids: data.sub_recipe_ids || [],
      version: 1,
      is_active: true,
      preparation_instructions: data.preparation_instructions,
      versions_history: [],
      created_at: now,
      updated_at: now,
    };

    recipes.push(newRecipe);
    db.save();

    AuditService.log(
      'recipe_created',
      'recipe',
      newRecipe.id,
      actor,
      null,
      newRecipe,
      `Nueva receta creada para producto ${newRecipe.product_id}: "${newRecipe.name}".`,
      restaurant_id
    );

    return newRecipe;
  }

  /**
   * Update an existing Recipe (Increments version and stores immutable history)
   */
  public static updateRecipe(
    recipe_id: string,
    data: UpdateRecipeDTO,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): Recipe {
    const recipes = db.get('recipes');
    const recipe = recipes.find((r) => r.id === recipe_id && r.restaurant_id === restaurant_id);
    if (!recipe) {
      throw new Error(`Receta "${recipe_id}" no encontrada.`);
    }

    const now = new Date().toISOString();

    // 1. Calculate previous cost snapshot before mutation
    let prevCostSnapshot = 0;
    let prevCogsSnapshot = 0;
    try {
      const costCalc = this.calculateRecipeCost(recipe, restaurant_id);
      prevCostSnapshot = costCalc.total_batch_cost_cents;
      prevCogsSnapshot = costCalc.cogs_cents;
    } catch {
      // Ignored if items were empty
    }

    // 2. Archive previous version in history
    const versionRecord: RecipeVersionRecord = {
      version: recipe.version,
      yield_quantity: recipe.yield_quantity,
      yield_unit: recipe.yield_unit,
      items: JSON.parse(JSON.stringify(recipe.items)),
      modifier_items: recipe.modifier_items ? JSON.parse(JSON.stringify(recipe.modifier_items)) : [],
      sub_recipe_ids: recipe.sub_recipe_ids ? [...recipe.sub_recipe_ids] : [],
      total_cost_cents: prevCostSnapshot,
      cost_per_yield_cents: prevCogsSnapshot,
      calculated_at: now,
      changed_by: actor,
      notes: `Modificación por ${actor} a versión ${recipe.version + 1}`,
    };

    if (!recipe.versions_history) {
      recipe.versions_history = [];
    }
    recipe.versions_history.push(versionRecord);

    // 3. Mutate recipe with new version
    if (data.name !== undefined) recipe.name = data.name;
    if (data.yield_quantity !== undefined) recipe.yield_quantity = Number(data.yield_quantity) || 1;
    if (data.yield_unit !== undefined) recipe.yield_unit = data.yield_unit;
    if (data.items !== undefined) {
      // Validate ingredients exist in F6
      for (const item of data.items) {
        const invItem = InventoryService.getItemById(item.inventory_item_id, restaurant_id);
        if (!invItem) {
          throw new Error(
            `Insumo "${item.inventory_item_id}" no existe en el catálogo de inventario.`
          );
        }
        if (!item.item_name) item.item_name = invItem.name;
      }
      recipe.items = data.items;
    }
    if (data.modifier_items !== undefined) recipe.modifier_items = data.modifier_items;
    if (data.sub_recipe_ids !== undefined) recipe.sub_recipe_ids = data.sub_recipe_ids;
    if (data.preparation_instructions !== undefined)
      recipe.preparation_instructions = data.preparation_instructions;
    if (data.is_active !== undefined) recipe.is_active = data.is_active;

    recipe.version = recipe.version + 1;
    recipe.updated_at = now;

    db.save();

    AuditService.log(
      'recipe_updated',
      'recipe',
      recipe.id,
      actor,
      { version: recipe.version - 1 },
      { version: recipe.version, name: recipe.name },
      `Receta "${recipe.name}" actualizada a versión ${recipe.version}.`,
      restaurant_id
    );

    return recipe;
  }

  /**
   * Soft Delete / Deactivate a Recipe
   */
  public static deleteRecipe(
    recipe_id: string,
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): boolean {
    const recipes = db.get('recipes');
    const recipe = recipes.find((r) => r.id === recipe_id && r.restaurant_id === restaurant_id);
    if (!recipe) {
      throw new Error(`Receta "${recipe_id}" no encontrada.`);
    }

    recipe.is_active = false;
    recipe.updated_at = new Date().toISOString();
    db.save();

    AuditService.log(
      'recipe_deleted',
      'recipe',
      recipe.id,
      actor,
      null,
      null,
      `Receta "${recipe.name}" desactivada.`,
      restaurant_id
    );

    return true;
  }

  /**
   * Get historical versions of a recipe
   */
  public static getRecipeVersions(
    recipe_id: string,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): RecipeVersionRecord[] {
    const recipe = this.getRecipeById(recipe_id, restaurant_id);
    if (!recipe) {
      throw new Error(`Receta "${recipe_id}" no encontrada.`);
    }
    return recipe.versions_history || [];
  }

  /**
   * ATOMIC SALE CONSUMPTION ENGINE
   * Dispatches exact inventory deductions strictly to F6 Inventory Core.
   * Enforces:
   * 1. Recipe item consumption = (item.quantity / yield) * order_quantity * (1 + waste%)
   * 2. Modifier items consumption = modifier.quantity * order_quantity (only if affects_inventory === true)
   * 3. Pure informational modifiers ('Sin cebolla', 'Término medio') produce zero movements.
   * 4. Idempotency: Duplicate calls with the same order_item_id return existing movements without double-deduction.
   * 5. Non-negative stock protection from F6.
   * 6. Product fallback: If no recipe exists, checks product.inventory_item_id or warns recipe_missing.
   */
  public static consumeRecipeForOrderItem(params: {
    order_id: string;
    order_item_id: string;
    product_id: string;
    quantity: number;
    modifiers?: string[];
    actor: string;
    restaurant_id?: string;
  }): {
    success: boolean;
    recipe_consumed: boolean;
    movements_created: number;
    warning?: string;
  } {
    const restaurant_id = params.restaurant_id || DEFAULT_RESTAURANT_ID;
    const recipe = this.getRecipeByProductId(params.product_id, restaurant_id);

    // If no recipe found for product
    if (!recipe) {
      const product = db
        .get('products')
        .find((p) => p.id === params.product_id && p.restaurant_id === restaurant_id);

      // Fallback 1: Direct product inventory item (e.g. bottled beer, water)
      if (product && product.inventory_item_id) {
        InventoryService.deductProductSale({
          restaurant_id,
          product_id: product.id,
          quantity: params.quantity,
          order_id: params.order_id,
          actor: params.actor,
        });
        return { success: true, recipe_consumed: false, movements_created: 1 };
      }

      // Non-inventoriable item (e.g. services, tips)
      if (product && product.inventory_tracking === false) {
        return { success: true, recipe_consumed: false, movements_created: 0 };
      }

      // Warning: missing recipe
      return {
        success: true,
        recipe_consumed: false,
        movements_created: 0,
        warning: `recipe_missing: Producto "${product?.name || params.product_id}" no tiene receta configurada.`,
      };
    }

    let movementsCount = 0;
    const yieldQty = recipe.yield_quantity > 0 ? recipe.yield_quantity : 1;

    // 1. Consume Recipe Base Ingredients
    for (const item of recipe.items || []) {
      const invItem = InventoryService.getItemById(item.inventory_item_id, restaurant_id);
      if (!invItem) continue;

      const wasteFactor = 1 + (item.waste_percent || 0) / 100;
      const baseConsumptionInRecipeUnit = (item.quantity / yieldQty) * params.quantity * wasteFactor;

      // Convert to inventory item's base unit
      const convertedConsumption = this.convertUnit(
        baseConsumptionInRecipeUnit,
        item.unit,
        invItem.base_unit,
        invItem.conversion_factor
      );

      const roundedQty = Math.round(convertedConsumption * 1000) / 1000;
      if (roundedQty <= 0) continue;

      // Deduct via F6 with strict idempotency key
      InventoryService.registerMovement({
        restaurant_id,
        inventory_item_id: invItem.id,
        movement_type: 'sale',
        quantity: roundedQty,
        reason: `Consumo Receta "${recipe.name}" (Orden ${params.order_id})`,
        reference_type: 'recipe_sale',
        reference_id: `RECIPE-${params.order_id}-${params.order_item_id}-${invItem.id}`,
        actor: params.actor,
      });

      movementsCount++;
    }

    // 2. Consume Modifiers with Inventory Impact
    if (params.modifiers && params.modifiers.length > 0 && recipe.modifier_items) {
      for (const modName of params.modifiers) {
        const modRule = recipe.modifier_items.find(
          (m) => m.modifier_name.toLowerCase().trim() === modName.toLowerCase().trim()
        );

        // If modifier does not affect inventory, skip completely (Section 31)
        if (!modRule || !modRule.affects_inventory || !modRule.inventory_item_id) {
          continue;
        }

        const modInv = InventoryService.getItemById(modRule.inventory_item_id, restaurant_id);
        if (!modInv) continue;

        const waste = 1 + (modRule.waste_percent || 0) / 100;
        const modQty = (modRule.quantity || 1) * params.quantity * waste;

        const convertedModQty = this.convertUnit(
          modQty,
          modRule.unit || modInv.base_unit,
          modInv.base_unit,
          modInv.conversion_factor
        );

        const roundedMod = Math.round(convertedModQty * 1000) / 1000;
        if (roundedMod <= 0) continue;

        InventoryService.registerMovement({
          restaurant_id,
          inventory_item_id: modInv.id,
          movement_type: 'sale',
          quantity: roundedMod,
          reason: `Consumo Modificador "${modName}" en "${recipe.name}" (Orden ${params.order_id})`,
          reference_type: 'recipe_modifier_sale',
          reference_id: `RECIPE-MOD-${params.order_id}-${params.order_item_id}-${modInv.id}`,
          actor: params.actor,
        });

        movementsCount++;
      }
    }

    return {
      success: true,
      recipe_consumed: true,
      movements_created: movementsCount,
    };
  }

  /**
   * REVERSAL ON ORDER CANCELLATION (Section 18)
   * Restores exact physical inventory without deleting historical sale movements.
   * Registers a movement_type: 'return' with reference to original order item.
   */
  public static reverseRecipeConsumption(params: {
    order_id: string;
    order_item_id: string;
    actor: string;
    reason?: string;
    restaurant_id?: string;
  }): {
    reversed_count: number;
  } {
    const restaurant_id = params.restaurant_id || DEFAULT_RESTAURANT_ID;
    const allMovements = db.get('inventory_movements') || [];

    // Find all sale movements associated with this order_item
    const matchPrefix = `-${params.order_id}-${params.order_item_id}-`;
    const targetMovements = allMovements.filter((m) => {
      return (
        m.restaurant_id === restaurant_id &&
        (m.movement_type === 'sale' || m.reference_type === 'recipe_sale' || m.reference_type === 'recipe_modifier_sale') &&
        m.reference_id &&
        m.reference_id.includes(matchPrefix)
      );
    });

    let reversedCount = 0;

    for (const mov of targetMovements) {
      const returnRef = `RETURN-${mov.id}`;
      // Idempotency: check if return movement already recorded
      const alreadyReversed = allMovements.some(
        (m) => m.reference_type === 'return' && m.reference_id === returnRef
      );
      if (alreadyReversed) continue;

      const qtyToReturn = Math.abs(mov.quantity);

      InventoryService.registerMovement({
        restaurant_id,
        inventory_item_id: mov.inventory_item_id,
        movement_type: 'return',
        quantity: qtyToReturn,
        reason:
          params.reason ||
          `Reversión por cancelación de comanda/ítem (Ref: ${mov.reference_id})`,
        reference_type: 'return',
        reference_id: returnRef,
        actor: params.actor,
      });

      reversedCount++;
    }

    return { reversed_count: reversedCount };
  }

  /**
   * Operational Summary for Dashboard & Recipe Management (Section 5, 29)
   */
  public static getRecipeSummary(restaurant_id: string = DEFAULT_RESTAURANT_ID): RecipeSummary {
    const products = (db.get('products') || []).filter(
      (p) => p.restaurant_id === restaurant_id && p.available !== false
    );
    const recipes = this.getRecipes(restaurant_id);

    const productsWithRecipe: string[] = [];
    const missingRecipeProducts: Array<{
      id: string;
      name: string;
      category: string;
      price_cents: number;
    }> = [];

    const lowMarginRecipes: Array<{
      recipe_id: string;
      product_name: string;
      margin_percent: number;
      cogs_cents: number;
      price_cents: number;
    }> = [];

    let totalMarginPercentSum = 0;
    let totalFoodCostPercentSum = 0;
    let calculatedCount = 0;

    for (const recipe of recipes) {
      try {
        const cost = this.calculateRecipeCost(recipe, restaurant_id);
        productsWithRecipe.push(recipe.product_id);
        totalMarginPercentSum += cost.gross_margin_percent;
        totalFoodCostPercentSum += cost.food_cost_percent;
        calculatedCount++;

        // Alert if margin is low (< 50%)
        if (cost.gross_margin_percent < 50) {
          lowMarginRecipes.push({
            recipe_id: recipe.id,
            product_name: cost.product_name,
            margin_percent: cost.gross_margin_percent,
            cogs_cents: cost.cogs_cents,
            price_cents: cost.selling_price_cents,
          });
        }
      } catch {
        // Skip invalid recipe in calculations
      }
    }

    for (const prod of products) {
      if (prod.inventory_tracking === false) continue;
      if (!recipes.some((r) => r.product_id === prod.id && r.is_active)) {
        // Direct bottled beverage/inventory item can count as covered or flagged
        if (!prod.inventory_item_id) {
          missingRecipeProducts.push({
            id: prod.id,
            name: prod.name,
            category: prod.category,
            price_cents: prod.price_cents,
          });
        }
      }
    }

    return {
      total_recipes: recipes.length,
      products_with_recipe: productsWithRecipe.length,
      products_without_recipe: missingRecipeProducts.length,
      average_food_cost_percent:
        calculatedCount > 0 ? Math.round((totalFoodCostPercentSum / calculatedCount) * 10) / 10 : 0,
      average_gross_margin_percent:
        calculatedCount > 0 ? Math.round((totalMarginPercentSum / calculatedCount) * 10) / 10 : 0,
      missing_recipe_products: missingRecipeProducts,
      low_margin_recipes: lowMarginRecipes,
      outdated_cost_recipes_count: 0,
    };
  }
}
