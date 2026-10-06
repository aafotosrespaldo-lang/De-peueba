/**
 * DIRECTAURANTE POS CORE v0.1 - DirectImport Module
 * Data migration pipeline architecture for onboarding restaurants from legacy POS.
 */

import { db, DEFAULT_RESTAURANT_ID } from '../../core/database';
import { ImportJob, Product, ImportCandidate } from '../../core/types';
import { AuditService } from '../../core/audit';

export type { ImportCandidate };

export class ImportService {
  /**
   * Create an import job and generate preliminary schema mapping preview
   */
  public static createPreview(
    source_pos: string,
    file_name: string,
    raw_rows: Array<{ name?: string; precio?: string | number; categoria?: string }>,
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ): { job: ImportJob; candidates: ImportCandidate[] } {
    const existingProducts = db.get('products').filter((p) => p.restaurant_id === restaurant_id);
    const existingNames = new Set(existingProducts.map((p) => p.name.toLowerCase().trim()));

    const candidates: ImportCandidate[] = raw_rows.map((row) => {
      const cleanName = (row.name || 'Sin Nombre').trim();
      const rawPriceNum = typeof row.precio === 'number' ? row.precio : parseFloat(String(row.precio || '0').replace(/[^0-9.]/g, '')) || 0;
      const priceCents = Math.round(rawPriceNum * 100);
      const rawCat = (row.categoria || 'Platillos').toLowerCase();

      let category: Product['category'] = 'Platillos';
      let station: 'kitchen' | 'bar' = 'kitchen';

      if (rawCat.includes('bebid') || rawCat.includes('trago') || rawCat.includes('cervez') || rawCat.includes('bar')) {
        category = 'Bebidas';
        station = 'bar';
      } else if (rawCat.includes('postre')) {
        category = 'Postres';
      } else if (rawCat.includes('entrad')) {
        category = 'Entradas';
      } else if (rawCat.includes('snack') || rawCat.includes('botana')) {
        category = 'Snacks';
      }

      const isDuplicate = existingNames.has(cleanName.toLowerCase());
      const isPriceZero = priceCents <= 0;

      let issue_message: string | undefined;
      if (isDuplicate) issue_message = 'El producto ya existe en el catálogo de Directaurante.';
      else if (isPriceZero) issue_message = 'Precio inválido o en cero.';

      return {
        raw_name: row.name || '',
        mapped_name: cleanName,
        raw_price: rawPriceNum,
        price_cents: priceCents,
        category,
        station,
        has_issue: isDuplicate || isPriceZero,
        issue_message,
      };
    });

    const issuesCount = candidates.filter((c) => c.has_issue).length;
    const job: ImportJob = {
      id: `job_${Date.now()}`,
      restaurant_id,
      source_pos,
      file_name,
      status: 'preview_ready',
      total_products_detected: candidates.length,
      issues_count: issuesCount,
      created_at: new Date().toISOString(),
      preview_data: {
        categories: Array.from(new Set(candidates.map((c) => c.category))),
        sample_products: candidates.slice(0, 5).map((c) => ({
          name: c.mapped_name,
          price: c.raw_price,
          category: c.category,
        })),
      },
    };

    db.get('import_jobs').push(job);
    db.save();

    return { job, candidates };
  }

  /**
   * Commit verified candidates into the live Directaurante catalog
   */
  public static executeImport(
    job_id: string,
    verified_candidates: ImportCandidate[],
    actor: string = 'Administrador',
    restaurant_id: string = DEFAULT_RESTAURANT_ID
  ) {
    const job = db.get('import_jobs').find((j) => j.id === job_id);
    if (!job) {
      throw new Error(`Trabajo de importación ${job_id} no encontrado.`);
    }

    const products = db.get('products');
    let importedCount = 0;

    for (const c of verified_candidates) {
      if (c.has_issue) continue;
      const newProduct: Product = {
        id: `prod_imp_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
        restaurant_id,
        name: c.mapped_name,
        category: c.category,
        description: `Importado automáticamente desde ${job.source_pos}`,
        price_cents: c.price_cents,
        ingredient_ids: [],
        destination_station: c.station,
        preparation_time_minutes: c.station === 'bar' ? 3 : 12,
        available: true,
      };
      products.push(newProduct);
      importedCount++;
    }

    job.status = 'imported';
    db.save();

    AuditService.log(
      'directimport_executed',
      'plugin',
      job.id,
      actor,
      null,
      { importedCount, source: job.source_pos },
      `Se importaron ${importedCount} productos desde ${job.source_pos} vía DirectImport.`,
      restaurant_id
    );

    return { success: true, imported_count: importedCount };
  }
}
