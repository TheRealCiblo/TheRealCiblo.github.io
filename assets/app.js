/* ciblo.xyz — page behaviour */
(() => {
  const root = document.documentElement;
  const $ = sel => document.querySelector(sel);
  const $$ = sel => [...document.querySelectorAll(sel)];

  /* ---------- Light / dark theme ---------- */
  const themeBtn = $("#theme");
  const themeMeta = $('meta[name="theme-color"]');

  function applyTheme(theme, remember) {
    root.dataset.theme = theme;
    themeMeta.content = theme === "light" ? "#f4f4f1" : "#000000";
    themeBtn.setAttribute("aria-label", theme === "light" ? "Switch to dark mode" : "Switch to light mode");
    if (remember) try { localStorage.setItem("theme", theme); } catch (e) {}
  }
  applyTheme(root.dataset.theme || "dark", false);

  themeBtn.addEventListener("click", () => {
    const next = root.dataset.theme === "light" ? "dark" : "light";
    const r = themeBtn.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;

    if (!document.startViewTransition) {             // older browsers: soft colour fade
      root.classList.add("theme-fade");
      applyTheme(next, true);
      setTimeout(() => root.classList.remove("theme-fade"), 600);
      return;
    }
    // modern browsers: the new theme spreads out from the button as a growing circle
    const vt = document.startViewTransition(() => applyTheme(next, true));
    vt.ready.then(() => {
      const end = Math.hypot(Math.max(x, innerWidth - x), Math.max(y, innerHeight - y));
      root.animate(
        { clipPath: [`circle(0px at ${x}px ${y}px)`, `circle(${end}px at ${x}px ${y}px)`] },
        { duration: 750, easing: "cubic-bezier(0.16, 1, 0.3, 1)", pseudoElement: "::view-transition-new(root)" }
      );
    });
  });

  // follow the device's setting until the visitor picks one themselves
  matchMedia("(prefers-color-scheme: light)").addEventListener("change", e => {
    let saved = null;
    try { saved = localStorage.getItem("theme"); } catch (err) {}
    if (!saved) applyTheme(e.matches ? "light" : "dark", false);
  });

  /* ---------- Clock: 12-hour, in the visitor's own time zone ---------- */
  const timeEl = $("#time"), ampmEl = $("#ampm"), zoneEl = $("#zone");
  const timeFmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric", minute: "2-digit", second: "2-digit", hour12: true, timeZoneName: "short",
  });
  function tick() {
    const now = new Date();
    if (!document.hidden) {
      const p = Object.fromEntries(timeFmt.formatToParts(now).map(x => [x.type, x.value]));
      timeEl.textContent = `${p.hour}:${p.minute}:${p.second}`;
      ampmEl.textContent = (p.dayPeriod || "").toUpperCase();
      zoneEl.textContent = p.timeZoneName || "";
    }
    setTimeout(tick, 1000 - (now.getTime() % 1000));   // stays on the second
  }
  tick();
  document.addEventListener("visibilitychange", () => { if (!document.hidden) tick(); });

  /* ---------- Typewriter: "welcome to ciblo.xyz" (once, on load) ---------- */
  (() => {
    const text = "welcome to ciblo.xyz";
    const out = $("#typed"), caret = $("#caret");
    let i = 0;
    function step() {
      out.textContent = text.slice(0, ++i);
      if (i < text.length) setTimeout(step, text[i - 1] === " " ? 120 : 55 + Math.random() * 45);
      else setTimeout(() => caret.classList.add("gone"), 1800);
    }
    setTimeout(step, 1200);
  })();

  // after the opening animation, page switches blur in straight away
  setTimeout(() => document.body.style.removeProperty("--page-delay"), 1500);

  /* ---------- Pages (#home, #about, #contact — so links, refresh and Back all work) ---------- */
  const PAGES = ["home", "about", "contact"];
  const TITLES = { home: "ciblo.xyz", about: "About · ciblo.xyz", contact: "Contact · ciblo.xyz" };
  let slideNext = false;

  function showPage(name, slide) {
    const current = $(".page.active");
    const next = $("#page-" + name);
    if (!next || current === next) return;

    $$(".tab").forEach(t => {
      if (t.dataset.page === name) t.setAttribute("aria-current", "page");
      else t.removeAttribute("aria-current");
    });
    $$(".page.leaving").forEach(p => p.classList.remove("leaving"));
    document.title = TITLES[name];

    if (current) {
      current.classList.remove("active", "slide-in");
      if (slide) {                                   // keep the old page visible while it slides away
        current.classList.add("leaving");
        current.addEventListener("animationend", function done(e) {
          if (e.target !== current) return;
          current.classList.remove("leaving");
          current.removeEventListener("animationend", done);
        });
      }
    }
    next.classList.toggle("slide-in", slide);
    next.classList.add("active");
  }

  function route() {
    const hash = location.hash.slice(1);
    if (hash && !PAGES.includes(hash)) return;       // e.g. the skip link
    showPage(hash || "home", slideNext);
    slideNext = false;
  }
  document.addEventListener("click", e => { if (e.target.closest("a[data-slide]")) slideNext = true; });
  addEventListener("hashchange", route);
  route();

  // arrow keys move between tabs (keyboards and TV remotes)
  $(".tabs").addEventListener("keydown", e => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const tabs = $$(".tab");
    const i = tabs.indexOf(document.activeElement);
    if (i < 0) return;
    e.preventDefault();
    tabs[(i + (e.key === "ArrowRight" ? 1 : tabs.length - 1)) % tabs.length].focus();
  });

  /* ---------- Email: click to copy, faint "copied" at the very bottom ---------- */
  const toast = $("#toast");
  let toastTimer;
  $$("[data-copy]").forEach(el => el.addEventListener("click", async () => {
    const text = el.dataset.copy;
    try { await navigator.clipboard.writeText(text); }
    catch (e) {
      const t = Object.assign(document.createElement("textarea"), { value: text });
      document.body.appendChild(t); t.select(); document.execCommand("copy"); t.remove();
    }
    toast.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toast.classList.remove("show"), 1600);
  }));

  /* ---------- UI sounds ---------- */
  const sounds = { tab: new Audio("sounds/tab-click.mp3"), button: new Audio("sounds/button-click.mp3") };
  Object.values(sounds).forEach(a => { a.preload = "auto"; });
  function play(name) {
    const a = sounds[name].cloneNode();               // fresh copy so quick clicks can overlap
    a.volume = 0.5;
    a.play().catch(() => {});
  }
  function soundFor(target) {
    if (target.closest(".tab")) play("tab");
    else if (target.closest("a, button")) play("button");
  }
  document.addEventListener("pointerdown", e => { if (e.button === 0) soundFor(e.target); });
  document.addEventListener("keydown", e => { if (e.key === "Enter" || e.key === " ") soundFor(e.target); });

  /* ---------- Custom cursor: dot, becomes a + over clickable things, with motion blur ---------- */
  (() => {
    if (!matchMedia("(hover: hover) and (pointer: fine)").matches) return;   // phones, tablets, TVs keep their own
    root.classList.add("custom-cursor");

    const canvas = document.createElement("canvas");
    canvas.className = "cursor";
    canvas.setAttribute("aria-hidden", "true");
    document.body.appendChild(canvas);
    const ctx = canvas.getContext("2d");

    let W = 0, H = 0, dpr = 1;
    function resize() {
      dpr = Math.min(devicePixelRatio || 1, 2);
      W = innerWidth; H = innerHeight;
      canvas.width = W * dpr; canvas.height = H * dpr;
      kick();
    }

    const target = { x: -100, y: -100 }, pos = { x: -100, y: -100 };
    let shown = false, vis = 0, hoverT = 0, hover = 0, pressT = 0, press = 0, running = false;

    function kick() { if (!running) { running = true; requestAnimationFrame(frame); } }

    addEventListener("pointermove", e => {
      if (e.pointerType !== "mouse") return;
      target.x = e.clientX; target.y = e.clientY;
      if (!shown) { pos.x = target.x; pos.y = target.y; shown = true; }
      hoverT = e.target.closest("a, button") ? 1 : 0;
      kick();
    }, { passive: true });
    root.addEventListener("mouseleave", () => { shown = false; kick(); });
    addEventListener("pointerdown", () => { pressT = 1; kick(); });
    addEventListener("pointerup", () => { pressT = 0; kick(); });
    addEventListener("resize", resize);
    resize();

    function draw(x, y, alpha) {
      ctx.save();
      ctx.translate(x, y);
      ctx.fillStyle = `rgba(255,255,255,${alpha})`;
      const r = (3.5 - hover * 2.5) * (1 - press * 0.3);
      ctx.beginPath(); ctx.arc(0, 0, r, 0, Math.PI * 2); ctx.fill();
      if (hover > 0.01) {
        const gap = 4 - press * 1.5, len = 8 * hover;
        ctx.strokeStyle = `rgba(255,255,255,${alpha * hover})`;
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(-gap - len, 0); ctx.lineTo(-gap, 0);
        ctx.moveTo(gap, 0);        ctx.lineTo(gap + len, 0);
        ctx.moveTo(0, -gap - len); ctx.lineTo(0, -gap);
        ctx.moveTo(0, gap);        ctx.lineTo(0, gap + len);
        ctx.stroke();
      }
      ctx.restore();
    }

    function frame() {
      const px = pos.x, py = pos.y;
      pos.x += (target.x - pos.x) * 0.5;
      pos.y += (target.y - pos.y) * 0.5;
      hover += (hoverT - hover) * 0.2;
      press += (pressT - press) * 0.35;
      vis   += ((shown ? 1 : 0) - vis) * 0.2;

      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, W, H);
      const vx = pos.x - px, vy = pos.y - py;
      if (vis > 0.01) {
        const n = Math.min(10, 1 + Math.floor(Math.hypot(vx, vy) / 3));   // motion blur trail
        for (let i = n - 1; i >= 1; i--) {
          const t = i / n;
          draw(pos.x - vx * t * 1.6, pos.y - vy * t * 1.6, vis * (1 - t) * 0.3);
        }
        draw(pos.x, pos.y, vis);
      }
      // stop drawing when everything has settled (saves battery); the next mouse move restarts it
      const settled = Math.abs(vx) + Math.abs(vy) < 0.05 && Math.abs(hoverT - hover) < 0.01 &&
                      Math.abs(pressT - press) < 0.01 && Math.abs((shown ? 1 : 0) - vis) < 0.01;
      if (settled) running = false;
      else requestAnimationFrame(frame);
    }
  })();
})();
