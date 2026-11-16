/* Runs inside the sandboxed view. Upgrades native controls that CSS alone cannot restyle. */
(function () {
    var CHEVRON =
        '<svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4 6 4 4 4-4"/></svg>';
    var CHECK =
        '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m3.8 8.4 2.6 2.6 5.8-5.9"/></svg>';

    function fire(el, type) {
        el.dispatchEvent(new Event(type, { bubbles: true }));
    }

    function upgradeSelect(select) {
        if (select.__vg || select.multiple || select.size > 1 || select.hasAttribute("data-native")) return;
        select.__vg = true;

        var wrap = document.createElement("div");
        wrap.className = "vg-select";
        select.parentNode.insertBefore(wrap, select);
        wrap.appendChild(select);
        select.tabIndex = -1;

        var button = document.createElement("button");
        button.type = "button";
        button.className = "vg-select-button";
        button.setAttribute("aria-haspopup", "listbox");
        button.setAttribute("aria-expanded", "false");
        var label = document.createElement("span");
        label.style.cssText = "overflow:hidden;text-overflow:ellipsis;white-space:nowrap";
        button.appendChild(label);
        button.insertAdjacentHTML("beforeend", CHEVRON);

        var menu = document.createElement("div");
        menu.className = "vg-select-menu";
        menu.setAttribute("role", "listbox");
        menu.hidden = true;
        wrap.appendChild(button);
        wrap.appendChild(menu);

        var items = [];
        var active = -1;

        function sync() {
            var option = select.options[select.selectedIndex];
            label.textContent = option ? option.text : "";
            if (!option || option.value === "") button.setAttribute("data-placeholder", "");
            else button.removeAttribute("data-placeholder");
            button.disabled = select.disabled;
            if (select.id) button.id = select.id + "-vg";
        }

        function setActive(index) {
            active = Math.max(0, Math.min(items.length - 1, index));
            items.forEach(function (item, i) {
                if (i === active) {
                    item.setAttribute("data-active", "");
                    item.scrollIntoView({ block: "nearest" });
                    item.focus({ preventScroll: true });
                } else item.removeAttribute("data-active");
            });
        }

        function close(refocus) {
            menu.hidden = true;
            button.setAttribute("aria-expanded", "false");
            if (refocus) button.focus();
        }

        function choose(option) {
            if (select.value !== option.value) {
                select.value = option.value;
                fire(select, "input");
                fire(select, "change");
            }
            sync();
            close(true);
        }

        function open() {
            if (select.disabled) return;
            menu.textContent = "";
            items = [];
            Array.prototype.forEach.call(select.options, function (option) {
                if (option.hidden) return;
                var item = document.createElement("button");
                item.type = "button";
                item.className = "vg-select-option";
                item.setAttribute("role", "option");
                item.disabled = option.disabled;
                var selected = option.value === select.value;
                item.setAttribute("aria-selected", String(selected));
                var text = document.createElement("span");
                text.textContent = option.text;
                item.appendChild(text);
                if (selected) item.insertAdjacentHTML("beforeend", CHECK);
                item.addEventListener("click", function () {
                    choose(option);
                });
                item.__option = option;
                menu.appendChild(item);
                items.push(item);
            });
            menu.hidden = false;
            button.setAttribute("aria-expanded", "true");
            var current = items.findIndex(function (item) {
                return item.__option.value === select.value;
            });
            setActive(current < 0 ? 0 : current);
        }

        button.addEventListener("click", function () {
            if (menu.hidden) open();
            else close(false);
        });
        button.addEventListener("keydown", function (event) {
            if (event.key === "ArrowDown" || event.key === "ArrowUp") {
                event.preventDefault();
                if (menu.hidden) open();
            }
        });
        menu.addEventListener("keydown", function (event) {
            if (event.key === "ArrowDown") (event.preventDefault(), setActive(active + 1));
            else if (event.key === "ArrowUp") (event.preventDefault(), setActive(active - 1));
            else if (event.key === "Home") (event.preventDefault(), setActive(0));
            else if (event.key === "End") (event.preventDefault(), setActive(items.length - 1));
            else if (event.key === "Escape") (event.preventDefault(), close(true));
            else if (event.key === "Tab") close(false);
        });
        document.addEventListener("pointerdown", function (event) {
            if (!menu.hidden && !wrap.contains(event.target)) close(false);
        });
        select.addEventListener("change", sync);
        select.addEventListener("focus", function () {
            button.focus();
        });
        new MutationObserver(sync).observe(select, { childList: true, subtree: true, attributes: true });
        sync();
    }

    function paintRange(range) {
        var min = range.min === "" ? 0 : Number(range.min);
        var max = range.max === "" ? 100 : Number(range.max);
        var percent = max > min ? ((Number(range.value) - min) / (max - min)) * 100 : 0;
        range.style.setProperty("--p", percent + "%");
    }

    function upgradeRange(range) {
        if (range.__vg) return;
        range.__vg = true;
        range.addEventListener("input", function () {
            paintRange(range);
        });
        paintRange(range);
    }

    function run() {
        Array.prototype.forEach.call(document.querySelectorAll("select"), upgradeSelect);
        Array.prototype.forEach.call(document.querySelectorAll('input[type="range"]'), upgradeRange);
    }

    var queued = false;
    function schedule() {
        if (queued) return;
        queued = true;
        requestAnimationFrame(function () {
            queued = false;
            run();
        });
    }

    function start() {
        run();
        new MutationObserver(schedule).observe(document.body, { childList: true, subtree: true });
        // Programmatic `range.value = x` does not fire `input`; repaint on any change too.
        document.addEventListener("change", function (event) {
            if (event.target && event.target.type === "range") paintRange(event.target);
        });
    }

    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start);
    else start();
})();
