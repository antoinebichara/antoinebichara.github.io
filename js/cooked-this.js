/*
 * "Cooked this?" box at the end of each recipe:
 * - "I cooked this!" stamps the recipe in the visitor's cooking passport (js/passport.js)
 *   and puts a stamp on the header photo;
 * - the email button copies the address (copying is done by js/copy-email.js).
 */
(function () {
    var passport = window.fairvopiaPassport;
    var stampBtn = document.querySelector('.passport-btn');
    var header = document.querySelector('.intro-header');
    if (!passport || !stampBtn || !header) return;
    var here = location.pathname;
    var MONTHS = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

    var stamp = document.createElement('div');
    stamp.className = 'passport-stamp';
    stamp.setAttribute('aria-hidden', 'true');
    header.appendChild(stamp);

    function show(justStamped) {
        var on = passport.has(here);
        var d = passport.date(here);
        if (on && d) {
            var p = d.split('-');
            stamp.innerHTML = '<span class="ps-word">Cooked</span><span class="ps-date">' + +p[2] + ' ' + MONTHS[+p[1] - 1] + ' ' + p[0] + '</span>';
        }
        stamp.classList.toggle('show', on);
        stamp.classList.toggle('thump', on && !!justStamped);
        stampBtn.classList.toggle('stamped', on);
        stampBtn.setAttribute('aria-pressed', on);
        stampBtn.querySelector('span').textContent = on ? 'In your passport' : 'I cooked this!';
        stampBtn.querySelector('.fa').className = 'fa ' + (on ? 'fa-check-circle' : 'fa-check-circle-o');
    }
    stampBtn.addEventListener('click', function () {
        if (passport.has(here)) passport.remove(here); else passport.add(here);
        show(passport.has(here));
    });
    // Stamped from somewhere else (e.g. the end of cook mode)
    document.addEventListener('fairvopia:passport', function () { show(passport.has(here) && !stamp.classList.contains('show')); });
    show(false);
})();

(function () {
    var button = document.querySelector('.cooked-this-btn');
    if (!button) return;
    var label = button.querySelector('span');
    var status = document.querySelector('.cooked-this-status');
    var emailText = document.querySelector('.cooked-this-email');
    var email = button.getAttribute('data-email');
    var original = label.textContent;
    var timer;

    button.addEventListener('click', function () {
        var copying = window.fairvopiaCopy ? window.fairvopiaCopy(email) : Promise.reject();
        copying.then(function () {
            label.textContent = 'Copied!';
            button.classList.add('copied');
            status.textContent = 'Paste it into Gmail or your email app.';
        }, function () {
            // Copying was blocked: select the address so it can be copied by hand
            var range = document.createRange();
            range.selectNodeContents(emailText);
            var sel = window.getSelection();
            sel.removeAllRanges();
            sel.addRange(range);
            status.textContent = 'Couldn’t copy automatically. The address is selected, so copy it from there.';
        });
        clearTimeout(timer);
        timer = setTimeout(function () {
            label.textContent = original;
            button.classList.remove('copied');
        }, 2500);
    });
})();
