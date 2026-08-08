/*
 * frontend/src/guide/Owl.tsx // the guide's face. The actual pixel art
 * lives in `../owl` — an independent module shared with the door into the
 * case's live room — so this file only re-exports it under the name the
 * rest of `guide/` already imports. `OwlTip` didn't need to change.
 */

export { OwlSprite as Owl } from '../owl/OwlSprite'
