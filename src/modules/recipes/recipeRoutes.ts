/**
 * DIRECTAURANTE POS CORE v0.1 - Recipes & Costing Routes
 * HTTP API endpoints for recipes, COGS, versioning and consumption.
 */

import { Router, Request, Response } from 'express';
import { RecipeService } from './recipeService';
import { DEFAULT_RESTAURANT_ID } from '../../core/database';

export const recipeRoutes = Router();

// Helper to extract restaurant context
function getRestaurantId(req: Request): string {
  return (req.headers['x-restaurant-id'] as string) || DEFAULT_RESTAURANT_ID;
}

/**
 * GET /api/recipes/summary
 * Operational summary: food cost %, gross margin %, products without recipe, low margin alerts
 */
recipeRoutes.get('/summary', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const summary = RecipeService.getRecipeSummary(restaurant_id);
    return res.json({ ok: true, data: summary });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/recipes
 * List all active recipes with computed costs and margins
 */
recipeRoutes.get('/', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const productId = req.query.product_id as string | undefined;
    const search = req.query.search as string | undefined;

    const recipes = RecipeService.getRecipes(restaurant_id, {
      product_id: productId,
      search,
    });

    // Enrich with calculated cost and margins
    const enriched = recipes.map((r) => {
      try {
        const costCalc = RecipeService.calculateRecipeCost(r, restaurant_id);
        return {
          ...r,
          cost_calculation: costCalc,
        };
      } catch {
        return r;
      }
    });

    return res.json({ ok: true, data: enriched });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/recipes/:id
 * Retrieve specific recipe by ID
 */
recipeRoutes.get('/:id', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const recipe = RecipeService.getRecipeById(req.params.id, restaurant_id);
    if (!recipe) {
      return res.status(404).json({ ok: false, error: `Receta ${req.params.id} no encontrada.` });
    }

    const costCalc = RecipeService.calculateRecipeCost(recipe, restaurant_id);
    return res.json({
      ok: true,
      data: {
        ...recipe,
        cost_calculation: costCalc,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/recipes/:id/cost
 * Calculate dynamic cost & COGS based on current inventory prices
 */
recipeRoutes.get('/:id/cost', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const cost = RecipeService.calculateRecipeCost(req.params.id, restaurant_id);
    return res.json({ ok: true, data: cost });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/recipes/:id/versions
 * Audit trail of historical versions of a recipe
 */
recipeRoutes.get('/:id/versions', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const versions = RecipeService.getRecipeVersions(req.params.id, restaurant_id);
    return res.json({ ok: true, data: versions });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/recipes
 * Create a new recipe
 */
recipeRoutes.post('/', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const actor = (req.headers['x-actor'] as string) || req.body.actor || 'Administrador';

    const recipe = RecipeService.createRecipe(req.body, actor, restaurant_id);
    const costCalc = RecipeService.calculateRecipeCost(recipe, restaurant_id);

    return res.status(201).json({
      ok: true,
      data: {
        ...recipe,
        cost_calculation: costCalc,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

/**
 * PUT /api/recipes/:id
 * Update recipe (increments version and preserves historical audit)
 */
recipeRoutes.put('/:id', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const actor = (req.headers['x-actor'] as string) || req.body.actor || 'Administrador';

    const updated = RecipeService.updateRecipe(req.params.id, req.body, actor, restaurant_id);
    const costCalc = RecipeService.calculateRecipeCost(updated, restaurant_id);

    return res.json({
      ok: true,
      data: {
        ...updated,
        cost_calculation: costCalc,
      },
    });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

/**
 * DELETE /api/recipes/:id
 * Soft delete / deactivate recipe
 */
recipeRoutes.delete('/:id', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const actor = (req.headers['x-actor'] as string) || 'Administrador';

    const deleted = RecipeService.deleteRecipe(req.params.id, actor, restaurant_id);
    return res.json({ ok: true, data: { deleted } });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

/**
 * GET /api/products/:productId/recipe
 * Fetch recipe for a specific commercial product
 */
recipeRoutes.get('/product/:productId', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const recipe = RecipeService.getRecipeByProductId(req.params.productId, restaurant_id);
    if (!recipe) {
      return res.status(404).json({
        ok: false,
        error: `No hay receta activa para el producto ${req.params.productId}`,
      });
    }

    const costCalc = RecipeService.calculateRecipeCost(recipe, restaurant_id);
    return res.json({
      ok: true,
      data: {
        ...recipe,
        cost_calculation: costCalc,
      },
    });
  } catch (err: any) {
    return res.status(500).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/recipes/consume
 * Consume recipe on order item
 */
recipeRoutes.post('/consume', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const { order_id, order_item_id, product_id, quantity, modifiers, actor } = req.body;

    if (!order_id || !order_item_id || !product_id) {
      return res.status(400).json({
        ok: false,
        error: 'order_id, order_item_id y product_id son requeridos.',
      });
    }

    const result = RecipeService.consumeRecipeForOrderItem({
      order_id,
      order_item_id,
      product_id,
      quantity: Number(quantity) || 1,
      modifiers: modifiers || [],
      actor: actor || 'POS Terminal',
      restaurant_id,
    });

    return res.json({ ok: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});

/**
 * POST /api/recipes/reverse
 * Reverse recipe consumption on cancellation
 */
recipeRoutes.post('/reverse', (req: Request, res: Response) => {
  try {
    const restaurant_id = getRestaurantId(req);
    const { order_id, order_item_id, actor, reason } = req.body;

    if (!order_id || !order_item_id) {
      return res.status(400).json({
        ok: false,
        error: 'order_id y order_item_id son requeridos para reversión.',
      });
    }

    const result = RecipeService.reverseRecipeConsumption({
      order_id,
      order_item_id,
      actor: actor || 'POS Reversal',
      reason,
      restaurant_id,
    });

    return res.json({ ok: true, data: result });
  } catch (err: any) {
    return res.status(400).json({ ok: false, error: err.message });
  }
});
