/**
 * DIRECTAURANTE POS & COMANDERO - SDK Entry Point
 */

import { DirectauranteSDK } from './DirectauranteSDK';
import { HttpDirectauranteAdapter } from './adapter';

export * from './types';
export * from './adapter';
export * from './DirectauranteSDK';

// Default SDK singleton instance configured with HTTP Adapter
export const directauranteSDK = new DirectauranteSDK(new HttpDirectauranteAdapter());
