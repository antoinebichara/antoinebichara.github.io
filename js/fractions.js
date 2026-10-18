/*
 * Nicely typeset fractions, used on recipe pages (js/recipe-tools.js) and the home page
 * (js/recipe-finder.js). Loaded in <head> on every page.
 */
// =====================================================================
// Fractions: "1 1/2" and "½" are shown as a small raised number over a lowered one.
// The recipe files keep plain "1/2"; this only changes how they look on the page.
// (Also used by js/recipe-finder.js through window.fairvopiaFractions.)
// =====================================================================
var fairvopiaFractions = (function () {
    var GLYPHS = { '½': '1/2', '⅓': '1/3', '⅔': '2/3', '¼': '1/4', '¾': '3/4', '⅕': '1/5', '⅖': '2/5', '⅗': '3/5', '⅘': '4/5',
        '⅙': '1/6', '⅚': '5/6', '⅛': '1/8', '⅜': '3/8', '⅝': '5/8', '⅞': '7/8' };
    // "1 1/2", "1 ½", "1/2", "½" (not dates like 10/22/2016)
    var FRAC = /(\d+)?(\s*)(?:(?<![\d\/⁄])(\d+)\s*[\/⁄]\s*(\d+)(?![\d\/⁄])|([½⅓⅔¼¾⅕⅖⅗⅘⅙⅚⅛⅜⅝⅞]))/g;
    function piece(n, d) {
        return '<span class="frac"><span class="frac-num">' + n + '</span>&frasl;<span class="frac-den">' + d + '</span></span>';
    }
    // Takes HTML-safe text and returns HTML with fractions marked up
    function toHTML(safeText) {
        return safeText.replace(FRAC, function (all, whole, space, n, d, glyph) {
            if (glyph) { var p = GLYPHS[glyph].split('/'); n = p[0]; d = p[1]; }
            // "1 1/2" -> whole number, a thin space, then the fraction; a lone "1/2" keeps its leading space
            return (whole ? whole + ' ' : space) + piece(n, d);
        });
    }
    function esc(s) { return String(s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
    // Format every fraction in the text of an element (skipping parts listed in `skip`)
    function format(root, skip) {
        var walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
            acceptNode: function (node) {
                var p = node.parentNode;
                if (!p || p.closest('script, style, .frac' + (skip ? ', ' + skip : ''))) return NodeFilter.FILTER_REJECT;
                FRAC.lastIndex = 0;
                return FRAC.test(node.nodeValue) ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
            }
        });
        var nodes = [];
        while (walker.nextNode()) nodes.push(walker.currentNode);
        nodes.forEach(function (node) {
            var holder = document.createElement('span');
            holder.innerHTML = toHTML(esc(node.nodeValue));
            var frag = document.createDocumentFragment();
            while (holder.firstChild) frag.appendChild(holder.firstChild);
            node.parentNode.replaceChild(frag, node);
        });
    }
    return { toHTML: toHTML, format: format, esc: esc };
})();
window.fairvopiaFractions = fairvopiaFractions;
