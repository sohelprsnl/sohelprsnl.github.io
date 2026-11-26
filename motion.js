/* sohelprsnl.com motion system
   No dependencies. Everything degrades safely if any part fails.
   Sections: 1 year stamp, 2 reveals, 3 stagger, 4 stat count-up,
             5 scroll progress bar, 6 timeline draw. */
(function () {
  "use strict";

  var reduced = window.matchMedia &&
                window.matchMedia("(prefers-reduced-motion: reduce)").matches;


  /* ---------- 0. Theme toggle ----------
     The theme is already applied by the inline boot script in <head>.
     This only wires the button, remembers the choice, and keeps following
     the OS until the visitor makes an explicit choice. */
  (function () {
    var root = document.documentElement;
    var btn = document.getElementById("themeToggle");
    var mq = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function apply(theme, remember) {
      /* Transitions are switched on only for the duration of the change,
         so page load stays instant and the switch still reads as a fade. */
      document.body.classList.add("theme-anim");
      root.setAttribute("data-theme", theme);
      if (remember) { try { localStorage.setItem("theme", theme); } catch (e) {} }
      if (btn) btn.setAttribute("aria-label",
        theme === "dark" ? "Switch to light theme" : "Switch to dark theme");
      window.setTimeout(function () {
        document.body.classList.remove("theme-anim");
      }, 320);
    }

    if (btn) {
      apply(root.getAttribute("data-theme") || "light", false);
      btn.addEventListener("click", function () {
        apply(root.getAttribute("data-theme") === "dark" ? "light" : "dark", true);
      });
    }

    /* Follow the OS only while the visitor has not chosen for themselves. */
    if (mq && mq.addEventListener) {
      mq.addEventListener("change", function (e) {
        var chosen = null;
        try { chosen = localStorage.getItem("theme"); } catch (err) {}
        if (!chosen) apply(e.matches ? "dark" : "light", false);
      });
    }
  })();

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

    /* ---------- 7. AI course console cards ----------
       Count the stats up and type the closing rule line once the card
       enters the screen. The text is already in the HTML, so without JS
       or with reduced motion nothing is lost. */
    var consoles = document.querySelectorAll(".cx");
    if (consoles.length) {
      var cxIo = new IntersectionObserver(function (entries) {
        entries.forEach(function (e) {
          if (!e.isIntersecting) return;
          cxIo.unobserve(e.target);
          var card = e.target;
          card.querySelectorAll(".cx-n").forEach(function (el) {
            var target = parseInt(el.getAttribute("data-n"), 10);
            if (isNaN(target)) return;
            var start = null, dur = 900;
            el.textContent = "0";
            function step(ts) {
              if (start === null) start = ts;
              var p = Math.min((ts - start) / dur, 1);
              el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
              if (p < 1) requestAnimationFrame(step); else el.textContent = String(target);
            }
            setTimeout(function () { requestAnimationFrame(step); }, 300);
            setTimeout(function () { el.textContent = String(target); }, 300 + dur + 400);
          });
          var t = card.querySelector(".cx-type");
          if (t) {
            var full = t.getAttribute("data-text") || t.textContent, k = 0;
            t.textContent = "";
            setTimeout(function tick() {
              k += 1;
              t.textContent = full.slice(0, k);
              if (k < full.length) setTimeout(tick, 28);
            }, 1500);
          }
        });
      }, { threshold: 0.3 });
      consoles.forEach(function (el) { cxIo.observe(el); });
    }

    /* ---------- 8. AI Learning page: hero typing and neural net ----------
       Only runs on body.ai-page. The canvas pauses when off screen or when
       the tab is hidden, and is skipped entirely for reduced motion. */
    if (document.body.classList.contains("ai-page")) {
      var ht = document.querySelector(".ai-type");
      if (ht) {
        var full8 = ht.getAttribute("data-text") || ht.textContent, k8 = 0;
        ht.textContent = "";
        setTimeout(function tick8() {
          k8 += 1; ht.textContent = full8.slice(0, k8);
          if (k8 < full8.length) setTimeout(tick8, 24);
        }, 700);
      }
      var cv = document.querySelector(".ai-net");
      if (cv && cv.getContext) {
        var ctx = cv.getContext("2d"), dpr = Math.min(window.devicePixelRatio || 1, 2);
        var W = 0, H = 0, pts = [], running = false, visible = true, raf = 0;
        var size = function () {
          var r = cv.getBoundingClientRect(); W = r.width; H = r.height;
          cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
          ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
          var n = Math.max(18, Math.min(60, Math.round(W * H / 16000)));
          pts = [];
          for (var q = 0; q < n; q++) pts.push({ x: Math.random() * W, y: Math.random() * H,
            vx: (Math.random() - .5) * .28, vy: (Math.random() - .5) * .28 });
        };
        var frame = function () {
          ctx.clearRect(0, 0, W, H);
          for (var a = 0; a < pts.length; a++) {
            var p = pts[a]; p.x += p.vx; p.y += p.vy;
            if (p.x < 0 || p.x > W) p.vx *= -1;
            if (p.y < 0 || p.y > H) p.vy *= -1;
            for (var b = a + 1; b < pts.length; b++) {
              var o = pts[b], dx = p.x - o.x, dy = p.y - o.y, d2 = dx * dx + dy * dy;
              if (d2 < 15000) {
                ctx.strokeStyle = "rgba(63,208,164," + (0.22 * (1 - d2 / 15000)).toFixed(3) + ")";
                ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(o.x, o.y); ctx.stroke();
              }
            }
            ctx.fillStyle = "rgba(150,235,205,.75)";
            ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, 6.283); ctx.fill();
          }
          if (running) raf = requestAnimationFrame(frame);
        };
        var setRun = function () {
          var want = visible && !document.hidden;
          if (want && !running) { running = true; raf = requestAnimationFrame(frame); }
          else if (!want && running) { running = false; cancelAnimationFrame(raf); }
        };
        size(); setRun();
        new IntersectionObserver(function (es) { visible = es[0].isIntersecting; setRun(); }).observe(cv);
        document.addEventListener("visibilitychange", setRun);
        var rt = 0;
        window.addEventListener("resize", function () { clearTimeout(rt); rt = setTimeout(size, 200); }, { passive: true });
      }
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
