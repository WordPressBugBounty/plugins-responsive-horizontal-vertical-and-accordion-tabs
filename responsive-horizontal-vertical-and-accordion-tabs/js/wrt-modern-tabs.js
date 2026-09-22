/* WP Responsive Tabs — Modern Engine (dependency-free) */
(function () {
    'use strict';

    function ready(fn) {
        if (document.readyState !== 'loading') fn();
        else document.addEventListener('DOMContentLoaded', fn);
    }

    // Per the HTML5 spec, <script> tags inserted via innerHTML are inert
    // and never execute (unlike jQuery's .html(), which does re-execute
    // them — legacy engine used jQuery for this same AJAX insertion).
    // Shortcodes/widgets that rely on their own inline <script> running
    // after insertion (e.g. to reveal an initially-hidden container)
    // would otherwise silently never run. Re-create and re-insert any
    // script tags found in freshly-inserted content to force execution.
    function executeScripts(container) {
        var scripts = Array.prototype.slice.call(container.querySelectorAll('script'));
        function runNext(i) {
            if (i >= scripts.length) return;
            var oldScript = scripts[i];
            var newScript = document.createElement('script');
            for (var j = 0; j < oldScript.attributes.length; j++) {
                var attr = oldScript.attributes[j];
                newScript.setAttribute(attr.name, attr.value);
            }
            newScript.textContent = oldScript.textContent;
            if (oldScript.src) {
                newScript.onload = function () { runNext(i + 1); };
                newScript.onerror = function () { runNext(i + 1); };
                oldScript.parentNode.replaceChild(newScript, oldScript);
            } else {
                oldScript.parentNode.replaceChild(newScript, oldScript);
                runNext(i + 1);
            }
        }
        runNext(0);
    }

    function loadPanelViaAjax(root, tabBtn, panel) {
        // Uses the REST API (wrt/v1/tab-render/{id}), not admin-ajax.php.
        // admin-ajax.php always reports is_admin() === true — a PHP
        // constant that file defines, not overridable via hooks — which
        // breaks any third-party shortcode/widget that guards its own
        // script registration behind `if ( ! is_admin() )` (a common
        // pattern): the registration silently never runs, so the
        // shortcode's later enqueue call has nothing to attach to. REST
        // requests don't set that constant, so those plugins register
        // normally.
        var restUrl = root.getAttribute('data-rest-url');
        var tabId = tabBtn.getAttribute('data-tabid');
        var url = restUrl + encodeURIComponent(tabId);

        panel.innerHTML = '<div class="wrt-modern__spinner" role="status" aria-label="Loading"></div>';

        function onSuccess(html) {
            panel.innerHTML = html;
            executeScripts(panel);
            tabBtn.setAttribute('data-loaded', '1');
        }
        function onFailure() {
            panel.innerHTML = '';
        }
        function loadViaXhr() {
            var xhr = new XMLHttpRequest();
            xhr.open('GET', url, true);
            xhr.setRequestHeader('Accept', 'application/json');
            xhr.onload = function () {
                if (xhr.status >= 200 && xhr.status < 300) {
                    try {
                        onSuccess(JSON.parse(xhr.responseText).html);
                    } catch (e) {
                        onFailure();
                    }
                } else {
                    onFailure();
                }
            };
            xhr.onerror = onFailure;
            xhr.send();
        }

        // Some sites have a third-party script that globally wraps
        // window.fetch and assumes every request body is JSON, throwing
        // synchronously even on this simple GET. XMLHttpRequest isn't
        // affected by fetch-specific monkey-patches, so it's the safe
        // fallback whenever fetch() itself is broken like that.
        try {
            fetch(url, { credentials: 'same-origin', headers: { 'Accept': 'application/json' } })
                .then(function (res) { return res.json(); })
                .then(function (data) { onSuccess(data.html); })
                .catch(loadViaXhr);
        } catch (err) {
            loadViaXhr();
        }
    }

    function maybeScrollTo(root, tabBtn) {
        if (root.getAttribute('data-scroll') !== '1') return;
        var isAccordionMode = root.getAttribute('data-type') === 'accordion' ||
            root.classList.contains('wrt-modern--mobile-accordion');
        if (!isAccordionMode) return;
        window.setTimeout(function () {
            var rect = tabBtn.getBoundingClientRect();
            var top = rect.top + window.pageYOffset - 100;
            window.scrollTo({ top: top, behavior: 'smooth' });
        }, 50);
    }

    function updateActiveCover(root) {
        var type = root.getAttribute('data-type');
        if (type !== 'horizontal' && type !== 'vertical') return;
        if (root.classList.contains('wrt-modern--mobile-accordion')) return;
        var nav = root.querySelector('.wrt-modern__nav');
        var cover = root.querySelector('.wrt-modern__active-cover');
        if (!nav || !cover) return;
        var activeTab = nav.querySelector('.wrt-modern__tab[aria-selected="true"]');
        if (!activeTab || activeTab.closest('.wrt-modern__more-menu')) {
            cover.style.width = '0px';
            cover.style.height = '0px';
            return;
        }
        var rootRect = root.getBoundingClientRect();
        var navRect = nav.getBoundingClientRect();
        var tabRect = activeTab.getBoundingClientRect();
        var navIsRow = window.getComputedStyle(nav).flexDirection === 'row';

        if (type === 'horizontal' || navIsRow) {
            cover.style.top = Math.round(nav.offsetHeight - 2) + 'px';
            cover.style.left = Math.round(tabRect.left - navRect.left) + 'px';
            cover.style.width = Math.round(tabRect.width) + 'px';
            cover.style.height = '3px';
        } else {
            // Only inset against the edges that actually coincide with a
            // perpendicular border: the panel's own top border (only where
            // this is the first tab) and the nav's own bottom border (only
            // where this is the last tab). Any other tab boundary is a
            // T-junction that ends inside the nav, so full coverage there
            // is correct and should not be inset.
            var isFirstTab = activeTab === nav.querySelector('.wrt-modern__tab:first-child');
            var isLastTab = activeTab === nav.querySelector('.wrt-modern__tab:last-child');
            var topInset = isFirstTab ? 1 : 0;
            var bottomInset = isLastTab ? 1 : 0;
            cover.style.top = Math.round(tabRect.top - rootRect.top + topInset) + 'px';
            cover.style.left = Math.round(nav.offsetWidth - 2) + 'px';
            cover.style.width = '3px';
            cover.style.height = Math.round(tabRect.height - topInset - bottomInset) + 'px';
        }
    }

    var MOBILE_QUERY = '(max-width: 768px)';

    // On narrow screens, a "vertical" tab set behaves like an accordion:
    // each panel is physically moved to sit right after its own tab button.
    function syncResponsiveLayout(root) {
        if (root.getAttribute('data-type') !== 'vertical') return;
        var nav = root.querySelector('.wrt-modern__nav');
        var panelsWrap = root.querySelector('.wrt-modern__panels');
        if (!nav || !panelsWrap) return;

        var isMobile = window.matchMedia(MOBILE_QUERY).matches;
        var isConverted = root.classList.contains('wrt-modern--mobile-accordion');

        if (isMobile && !isConverted) {
            nav.querySelectorAll('.wrt-modern__tab').forEach(function (tab) {
                var tabId = tab.getAttribute('data-tabid');
                var panel = panelsWrap.querySelector('[data-panel-id="' + tabId + '"]');
                if (panel) tab.insertAdjacentElement('afterend', panel);
            });
            root.classList.add('wrt-modern--mobile-accordion');
        } else if (!isMobile && isConverted) {
            nav.querySelectorAll('.wrt-modern__tab').forEach(function (tab) {
                var tabId = tab.getAttribute('data-tabid');
                var panel = nav.querySelector('[data-panel-id="' + tabId + '"]');
                if (panel) panelsWrap.appendChild(panel);
            });
            root.classList.remove('wrt-modern--mobile-accordion');

            if (!nav.querySelector('.wrt-modern__tab[aria-selected="true"]')) {
                var fallback = nav.querySelector('.wrt-modern__tab[data-tabid="' + root.getAttribute('data-default-id') + '"]') ||
                    nav.querySelector('.wrt-modern__tab');
                if (fallback) activateTab(root, fallback);
            }
        }
    }

    function activateTab(root, tabBtn) {
        var type = root.getAttribute('data-type');
        var isAccordionMode = type === 'accordion' || root.classList.contains('wrt-modern--mobile-accordion');
        var tabId = tabBtn.getAttribute('data-tabid');
        var panel = root.querySelector('[data-panel-id="' + tabId + '"]');
        if (!panel) return;

        var tabs = root.querySelectorAll('.wrt-modern__tab');
        var panels = root.querySelectorAll('.wrt-modern__panel');

        if (isAccordionMode) {
            var alreadyOpen = tabBtn.getAttribute('aria-selected') === 'true';
            tabs.forEach(function (t) { t.setAttribute('aria-selected', 'false'); });
            panels.forEach(function (p) { p.classList.remove('is-active'); });
            if (!alreadyOpen) {
                tabBtn.setAttribute('aria-selected', 'true');
                panel.classList.add('is-active');
            }
        } else {
            tabs.forEach(function (t) { t.setAttribute('aria-selected', 'false'); });
            panels.forEach(function (p) { p.classList.remove('is-active'); });
            tabBtn.setAttribute('aria-selected', 'true');
            panel.classList.add('is-active');
        }

        var useAjax = root.getAttribute('data-use-ajax') === '1';
        if (useAjax && tabBtn.getAttribute('data-loaded') === '0') {
            loadPanelViaAjax(root, tabBtn, panel);
        }

        maybeScrollTo(root, tabBtn);
        updateActiveCover(root);
    }

    // Tabs that don't fit in the horizontal strip collapse into a "More"
    // dropdown menu, matching the legacy engine's behavior — no scrolling.
    // The dropdown holds permanent CLONES of the tab buttons (created once,
    // never moved); each relayout only toggles which of an original/clone
    // pair is visible. No DOM node ever changes parent after init, which
    // avoids clicks landing in a gap during a relayout.
    function initHorizontalOverflowMenu(root) {
        if (root.getAttribute('data-type') !== 'horizontal') return;
        var nav = root.querySelector('.wrt-modern__nav');
        if (!nav || nav.getAttribute('data-overflow-init') === '1') return;
        nav.setAttribute('data-overflow-init', '1');

        var originalTabs = Array.prototype.slice.call(nav.querySelectorAll(':scope > .wrt-modern__tab'));
        if (!originalTabs.length) return;

        var moreBtn = document.createElement('button');
        moreBtn.type = 'button';
        moreBtn.className = 'wrt-modern__more-btn';
        moreBtn.setAttribute('aria-haspopup', 'true');
        moreBtn.setAttribute('aria-expanded', 'false');
        moreBtn.innerHTML = '\u2630';
        moreBtn.setAttribute('aria-label', 'More tabs');

        var moreMenu = document.createElement('div');
        moreMenu.className = 'wrt-modern__more-menu';

        var clones = originalTabs.map(function (t) {
            var clone = t.cloneNode(true);
            clone.removeAttribute('id');
            clone.style.display = 'none';
            moreMenu.appendChild(clone);
            return clone;
        });

        nav.appendChild(moreBtn);
        // Appended to root, not nav — nav has overflow:hidden (so the
        // tab row itself never scrolls), which would otherwise clip the
        // dropdown before it could render.
        root.appendChild(moreMenu);

        function closeMenu() {
            moreMenu.classList.remove('is-open');
            moreMenu.style.display = 'none';
            moreBtn.setAttribute('aria-expanded', 'false');
        }
        function positionMenu() {
            moreMenu.style.top = nav.offsetHeight + 'px';
        }
        moreBtn.addEventListener('click', function (e) {
            e.preventDefault();
            var willOpen = !moreMenu.classList.contains('is-open');
            if (willOpen) {
                positionMenu();
                moreMenu.classList.add('is-open');
                moreMenu.style.display = 'block';
                moreBtn.setAttribute('aria-expanded', 'true');
            } else {
                closeMenu();
            }
        });
        document.addEventListener('click', function (e) {
            if (moreBtn.contains(e.target) || moreMenu.contains(e.target)) return;
            closeMenu();
        });
        moreMenu.addEventListener('click', function (e) {
            if (e.target.closest('.wrt-modern__tab')) closeMenu();
        });

        function layout() {
            closeMenu();
            originalTabs.forEach(function (t) { t.style.display = ''; });
            clones.forEach(function (c) { c.style.display = 'none'; });
            moreBtn.classList.remove('is-visible');

            // Safety margin: offsetWidth/clientWidth round to whole
            // pixels, and cumulative rounding across many tabs — plus
            // the moreBtn's own width sometimes being measured a beat
            // before its font/icon fully settles — can throw the fit
            // off by more than a couple pixels. A generous buffer here
            // trades a little unused trailing space for reliably never
            // clipping the More button.
            var available = nav.clientWidth - 24;
            var used = 0;
            var firstOverflowIndex = -1;

            for (var i = 0; i < originalTabs.length; i++) {
                used += originalTabs[i].offsetWidth;
                if (used > available) {
                    firstOverflowIndex = i;
                    break;
                }
            }

            if (firstOverflowIndex === -1) return;

            // Reserve space for the "More" button itself and recheck.
            moreBtn.classList.add('is-visible');
            var moreBtnWidth = moreBtn.offsetWidth;
            used = 0;
            firstOverflowIndex = -1;
            for (var j = 0; j < originalTabs.length; j++) {
                used += originalTabs[j].offsetWidth;
                if (used + moreBtnWidth > available) {
                    firstOverflowIndex = j;
                    break;
                }
            }
            if (firstOverflowIndex === -1) {
                moreBtn.classList.remove('is-visible');
                return;
            }
            // Always keep at least one tab visible.
            if (firstOverflowIndex === 0) firstOverflowIndex = 1;

            for (var k = firstOverflowIndex; k < originalTabs.length; k++) {
                originalTabs[k].style.display = 'none';
                clones[k].style.display = 'block';
            }
        }

        layout();
        if (window.ResizeObserver) {
            var ro = new ResizeObserver(layout);
            ro.observe(nav);
        }
        window.addEventListener('resize', layout);
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(layout);
        }
    }

    function initTabSet(root) {
        if (root.getAttribute('data-wrt-init') === '1') return;
        root.setAttribute('data-wrt-init', '1');

        syncResponsiveLayout(root);
        initHorizontalOverflowMenu(root);

        root.addEventListener('click', function (e) {
            var tabBtn = e.target.closest('.wrt-modern__tab');
            if (!tabBtn || !root.contains(tabBtn)) return;
            e.preventDefault();
            activateTab(root, tabBtn);
        });

        var defaultId = root.getAttribute('data-default-id');
        if (defaultId) {
            var defaultBtn = root.querySelector('[data-tabid="' + defaultId + '"].wrt-modern__tab');
            if (defaultBtn) activateTab(root, defaultBtn);
        }

        var nav = root.querySelector('.wrt-modern__nav');
        if (nav) {
            nav.addEventListener('scroll', function () { updateActiveCover(root); });
        }
        window.addEventListener('resize', function () {
            syncResponsiveLayout(root);
            updateActiveCover(root);
        });

        // Recompute if the tab strip's own size settles late (web fonts
        // finishing, images loading, etc.) so the seam-cover never drifts.
        if (window.ResizeObserver && nav) {
            var ro = new ResizeObserver(function () { updateActiveCover(root); });
            ro.observe(nav);
            ro.observe(root);
        }
        if (document.fonts && document.fonts.ready) {
            document.fonts.ready.then(function () { updateActiveCover(root); });
        }
    }

    function initAll(context) {
        var scope = context || document;
        var sets = scope.querySelectorAll('.wrt-modern');
        sets.forEach(initTabSet);
    }

    ready(function () { initAll(document); });

    // Expose for dynamically inserted content (e.g. block editor previews, AJAX page loads)
    window.wrtModernTabsInit = initAll;
})();
