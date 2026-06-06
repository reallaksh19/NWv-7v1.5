/**
 * useMarketPageViewModel
 *
 * Page-scoped alias for useMarketTabViewModel.
 * Re-exports the canonical Market ViewModel under the page-scoped name
 * required by the Release 6T page-orchestration closeout certification.
 */
export { useMarketTabViewModel as useMarketPageViewModel } from './useMarketTabViewModel.js';
