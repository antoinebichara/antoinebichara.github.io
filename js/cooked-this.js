/*
 * "Cooked this?" box at the end of each recipe: the button copies the email
 * address so visitors can paste it into Gmail or whatever email they use.
 */
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
        copy(email).then(function () {
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

    // Try the modern clipboard first, then the older text-box method
    function copy(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).catch(function () { return copyWithTextBox(text); });
        }
        return copyWithTextBox(text);
    }
    function copyWithTextBox(text) {
        return new Promise(function (resolve, reject) {
            var box = document.createElement('textarea');
            box.value = text;
            box.setAttribute('readonly', '');
            box.style.position = 'fixed';
            box.style.opacity = '0';
            document.body.appendChild(box);
            box.select();
            var ok = false;
            try { ok = document.execCommand('copy'); } catch (err) {}
            document.body.removeChild(box);
            if (ok) resolve(); else reject();
        });
    }
})();
