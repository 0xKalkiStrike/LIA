/* JARVIS AI — avatar.js compat layer.
 * Delegates rendering directly to the premium buildAnime engine in anime.js.
 */

window.buildAvatar = function(el, cfg) {
  return window.buildAnime(el, cfg);
};
