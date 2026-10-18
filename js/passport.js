/*
 * Cooking passport: the recipes a visitor has marked "I cooked this!", saved only in their
 * own browser. Loaded in <head> on every page (_includes/app-head.html) and used by the
 * recipe page (js/cooked-this.js, js/recipe-tools.js) and the home page (js/recipe-globe.js,
 * js/recipe-finder.js). Pages listen for the "fairvopia:passport" event to update.
 */
window.fairvopiaPassport = (function () {
    var KEY = 'fairvopia-passport';
    function read() {
        try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch (e) { return {}; }
    }
    function write(stamps) {
        try { localStorage.setItem(KEY, JSON.stringify(stamps)); } catch (e) {}
        document.dispatchEvent(new CustomEvent('fairvopia:passport'));
    }
    // Recipe addresses are kept like "fatayer.html"
    function key(url) { return String(url).replace(/^https?:\/\/[^/]+/, '').replace(/^\//, '').replace(/[?#].*$/, ''); }
    return {
        has: function (url) { return !!read()[key(url)]; },
        date: function (url) { return read()[key(url)] || null; },
        add: function (url) { var s = read(); s[key(url)] = new Date().toISOString().slice(0, 10); write(s); },
        remove: function (url) { var s = read(); delete s[key(url)]; write(s); },
        all: read,
        key: key
    };
})();
