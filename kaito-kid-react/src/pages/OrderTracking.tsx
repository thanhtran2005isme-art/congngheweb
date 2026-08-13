// Compatibility entrypoint: keep the existing /orders router import stable while
// the customer order experience lives in the lifecycle-aware OrderCenter page.
export { default } from './OrderCenter';
