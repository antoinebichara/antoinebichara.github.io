/*
 * Page transitions: when you open a recipe from a home page card, the card's photo grows
 * into the recipe's header photo, and shrinks back into the card when you go back.
 * Loaded in <head> so it is ready before the page first appears. Does nothing in
 * browsers without cross-page View Transitions.
 */
(function () {
    if (!('onpagereveal' in window)) return;

    function cardPhoto(url) {
        var path = new URL(url, location.href).pathname.replace(/^\//, '');
        return document.querySelector('.recipe-card[data-url="' + CSS.escape(path) + '"] .rc-photo');
    }
    // Give the card's photo the same name as the recipe page's header for this one transition
    function pair(el, transition, until) {
        el.style.viewTransitionName = 'hero-photo';
        var clear = function () { el.style.viewTransitionName = ''; };
        transition[until].then(clear, clear);
        transition.ready.catch(function () {});   // a skipped transition is fine, not an error
    }

    // Leaving the home page for a recipe
    window.addEventListener('pageswap', function (e) {
        if (!e.viewTransition || !e.activation || !e.activation.entry) return;
        var el = cardPhoto(e.activation.entry.url);
        if (el) pair(el, e.viewTransition, 'finished');
    });

    // Coming back to the home page from a recipe
    window.addEventListener('pagereveal', function (e) {
        if (!e.viewTransition || !window.navigation || !navigation.activation || !navigation.activation.from) return;
        var el = cardPhoto(navigation.activation.from.url);
        if (el) pair(el, e.viewTransition, 'ready');
    });
})();
