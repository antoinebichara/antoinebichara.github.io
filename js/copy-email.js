/*
 * Copy the email address instead of opening a mail app. Any link or button with
 * data-copy-email="address" copies that address and shows a short "copied" message.
 * Also provides window.fairvopiaCopy(text), used by js/cooked-this.js.
 */
(function () {
    // Try the modern clipboard first, then the older text-box method
    function copyText(text) {
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
    window.fairvopiaCopy = copyText;

    var toast, timer;
    function showToast(html) {
        if (!toast) {
            toast = document.createElement('div');
            toast.className = 'copy-toast';
            toast.setAttribute('role', 'status');
            toast.setAttribute('aria-live', 'polite');
            document.body.appendChild(toast);
        }
        toast.innerHTML = html;
        // Restart the fade-in even if a message is already showing
        toast.classList.remove('show');
        void toast.offsetWidth;
        toast.classList.add('show');
        clearTimeout(timer);
        timer = setTimeout(function () { toast.classList.remove('show'); }, 3000);
    }

    document.addEventListener('click', function (e) {
        var link = e.target.closest('[data-copy-email]');
        if (!link) return;
        e.preventDefault();
        var email = link.getAttribute('data-copy-email');
        copyText(email).then(function () {
            showToast('<i class="fa fa-check" aria-hidden="true"></i>Email address copied: ' + email);
        }, function () {
            showToast('My email address: ' + email);
        });
    });
})();
