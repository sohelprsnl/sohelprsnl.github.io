/* sohelprsnl.com motion system
   No dependencies. Everything degrades safely if any part fails.
   Sections: 1 year stamp, 2 reveals, 3 stagger, 4 stat count-up,
             5 scroll progress bar, 6 timeline draw. */
(function () {
  "use strict";

  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ---------- 1. Footer year ---------- */
  var yr = document.getElementById("yr");
  if (yr) yr.textContent = new Date().getFullYear();

  /* Safety net: if anything below throws, nothing stays invisible. */
  function showEverything() {
    document.querySelectorAll(".reveal, .stagger").forEach(function (el) {
      el.classList.add("in");
    });
  }

  /* ---------- Copy-to-clipboard buttons (WhatsApp username, etc.) ----------
     Registered before the motion code so it works even if animation is off. */
  document.querySelectorAll(".copy-btn").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var value = btn.getAttribute("data-copy") || "";
      var done = function () {
        var original = btn.textContent;
        btn.textContent = "Copied";
        btn.classList.add("copied");
        setTimeout(function () {
          btn.textContent = original;
          btn.classList.remove("copied");
        }, 1800);
      };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(done, fallback);
      } else {
        fallback();
      }
      function fallback() {
        var t = document.createElement("textarea");
        t.value = value;
        t.setAttribute("readonly", "");
        t.style.position = "absolute";
        t.style.left = "-9999px";
        document.body.appendChild(t);
        t.select();
        try { document.execCommand("copy"); done(); } catch (e) { /* ignore */ }
        document.body.removeChild(t);
      }
    });
  });

  if (reduced || !("IntersectionObserver" in window)) {
    showEverything();
    return;
  }

  try {

    /* ---------- 3. Automatic stagger ----------
       Any parent holding several .reveal siblings becomes a staggered group.
       No markup changes needed: cards enter 70ms apart instead of together. */
    var groups = new Set();
    document.querySelectorAll(".reveal").forEach(function (el) {
      if (el.parentElement) groups.add(el.parentElement);
    });
    groups.forEach(function (parent) {
      var kids = Array.prototype.filter.call(parent.children, function (c) {
        return c.classList.contains("reveal");
      });
      if (kids.length < 2) return;
      kids.forEach(function (kid, i) {
        kid.style.transitionDelay = Math.min(i, 6) * 70 + "ms";
      });
    });

    /* ---------- 2. Reveal on scroll ---------- */
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) {
        if (!e.isIntersecting) return;
        e.target.classList.add("in");
        io.unobserve(e.target);
        if (e.target.classList.contains("statband")) countUp(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });

    document.querySelectorAll(".reveal, .stagger, .t-item, .statband")
      .forEach(function (el) { io.observe(el); });

    /* ---------- 4. Stat count-up ----------
       Keeps any prefix or suffix: 14+, 3M, 97%, $35M. */
    function countUp(band) {
      band.querySelectorAll(".num").forEach(function (el) {
        var raw = el.textContent.trim();
        var m = raw.match(/^([^0-9]*)([0-9]+(?:\.[0-9]+)?)(.*)$/);
        if (!m) return;

        var prefix = m[1], target = parseFloat(m[2]), suffix = m[3];
        var decimals = (m[2].split(".")[1] || "").length;
        var duration = 1100, start = null;

        el.textContent = prefix + (0).toFixed(decimals) + suffix;

        function step(ts) {
          if (start === null) start = ts;
          var p = Math.min((ts - start) / duration, 1);
          var eased = 1 - Math.pow(1 - p, 3);          // easeOutCubic
          el.textContent = prefix + (target * eased).toFixed(decimals) + suffix;
          if (p < 1) requestAnimationFrame(step);
          else el.textContent = raw;                    // restore exact original
        }
        requestAnimationFrame(step);
      });
    }

    /* ---------- 5 and 6. Scroll-linked effects ---------- */
    var bar = document.querySelector(".scroll-progress");
    var timeline = document.querySelector(".timeline");
    var ticking = false;

    function onScroll() {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(function () {
        var y = window.scrollY || window.pageYOffset;

        if (bar) {
          var max = document.documentElement.scrollHeight - window.innerHeight;
          bar.style.transform = "scaleX(" + (max > 0 ? Math.min(y / max, 1) : 0) + ")";
        }

        if (timeline) {
          var r = timeline.getBoundingClientRect();
          var vh = window.innerHeight;
          // 0 when the timeline top reaches 85% of the viewport,
          // 1 when its bottom passes 60%.
          var p = (vh * 0.85 - r.top) / (r.height + vh * 0.25);
          timeline.style.setProperty("--draw", Math.max(0, Math.min(p, 1)).toFixed(3));
        }

        ticking = false;
      });
    }

    if (bar || timeline) {
      if (timeline) timeline.style.setProperty("--draw", "0");
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", onScroll, { passive: true });
      onScroll();
    }

  } catch (err) {
    showEverything();
  }
})();
