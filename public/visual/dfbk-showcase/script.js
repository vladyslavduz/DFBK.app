(function () {
  "use strict";

  if (new URLSearchParams(window.location.search).get("embed") === "1") {
    document.body.classList.add("is-embedded");
  }

  const root = document.getElementById("dfbk-visual");
  const stage = root.querySelector(".dfbk-stage");
  const tabs = root.querySelector(".dfbk-scenario-tabs");
  const config = window.DFBK_VISUAL_CONFIG;
  const timing = config.timing;
  const uiIcons = "assets/svg/ui-icons.svg";
  const industryIcons = "assets/svg/industry-icons.svg";
  const sceneStarts = [0, timing.capture, timing.capture + timing.description, timing.capture + timing.description + timing.ai];
  const sceneDurations = [timing.capture, timing.description, timing.ai, timing.lead];

  let cycleStartedAt = performance.now();
  let rafId = 0;
  let hiddenAt = 0;
  let activeScenario = -1;

  function icon(file, name, className = "") {
    return `<svg class="${className}" aria-hidden="true"><use href="${file}#${name}"></use></svg>`;
  }

  function waveBars() {
    return Array.from({ length: 18 }, () => "<i></i>").join("");
  }

  function moduleMarkup(module, moduleIndex) {
    return `
      <article class="dfbk-module" data-module="${moduleIndex}" data-module-id="${module.id}" aria-hidden="true">
        <div class="dfbk-industry-pill">
          ${icon(industryIcons, module.icon)}
          <span>${module.label}</span>
        </div>

        <section class="dfbk-scene dfbk-scene-capture" data-scene="0" aria-label="${module.capture.title}">
          <img class="dfbk-photo" src="${module.images.original}" alt="${module.capture.title}">
          <div class="dfbk-camera-drift">
            <img class="dfbk-phone-layer" src="${module.images.phone}" alt="Smartphone-Kamera">
            <div class="dfbk-shutter-pulse" aria-hidden="true"></div>
          </div>
          <div class="dfbk-focus-frame" aria-hidden="true"><i></i><i></i><i></i><i></i></div>
          <div class="dfbk-flash" aria-hidden="true"></div>
          <div class="dfbk-scene-copy"><span class="dfbk-step-number">01</span><div><strong>${module.capture.title}</strong><small>${module.capture.subtitle}</small></div></div>
          <div class="dfbk-upload-toast"><span class="dfbk-success-icon">${icon(uiIcons, "check")}</span>Foto hochgeladen</div>
        </section>

        <section class="dfbk-scene dfbk-scene-result" data-scene="1" aria-label="${module.description.title}">
          <img class="dfbk-photo" src="${module.images.result}" alt="${module.description.title}">
          <div class="dfbk-result-shade"></div>
          <div class="dfbk-scene-copy"><span class="dfbk-step-number">02</span><div><strong>${module.description.title}</strong><small>${module.description.helper}</small></div></div>
          <div class="dfbk-voice-panel">
            <span class="dfbk-mic-button">${icon(uiIcons, "mic")}</span>
            <div class="dfbk-voice-body"><div class="dfbk-wave" aria-hidden="true">${waveBars()}</div><p class="dfbk-transcript"><span>${module.description.transcript}</span></p></div>
            <span class="dfbk-add-photo">${icon(uiIcons, "image-plus")}</span>
          </div>
        </section>

        <section class="dfbk-scene dfbk-scene-ai" data-scene="2" aria-label="DFBK erstellt den Beitrag">
          <div class="dfbk-compare">
            <img class="dfbk-photo" src="${module.images.result}" alt="${module.ai.beforeLabel}">
            <div class="dfbk-after-reveal"><img class="dfbk-photo" src="${module.images.optimized}" alt="${module.ai.afterLabel}"></div>
            <div class="dfbk-scan-line">${icon(uiIcons, "spark")}</div>
            <span class="dfbk-compare-tag dfbk-before-tag">${module.ai.beforeLabel}</span>
            <span class="dfbk-compare-tag dfbk-after-tag">${module.ai.afterLabel}</span>
          </div>
          <div class="dfbk-ai-title">${icon(uiIcons, "spark")}<span>DFBK erstellt deinen Beitrag</span></div>
          <div class="dfbk-ai-output">
            <div class="dfbk-post-preview"><img src="${module.images.optimized}" alt="Optimiertes Ergebnis"><div><strong>${module.ai.title}</strong><p>${module.ai.text}</p></div></div>
            <ul class="dfbk-ai-status"><li>${icon(uiIcons, "check")}Foto optimiert</li><li>${icon(uiIcons, "check")}Text erstellt</li><li>${icon(uiIcons, "check")}Beitrag vorbereitet</li></ul>
          </div>
        </section>

        <section class="dfbk-scene dfbk-scene-lead" data-scene="3" aria-label="${module.lead.type}">
          <img class="dfbk-photo dfbk-lead-background" src="${module.images.optimized}" alt="Veröffentlichter Beitrag">
          <div class="dfbk-lead-shade"></div>
          <div class="dfbk-published-card">
            <div class="dfbk-published-head"><span class="dfbk-mini-brand">DFBK<span>.</span>app</span><small>Gerade eben</small></div>
            <img src="${module.images.optimized}" alt="${module.lead.title}">
            <strong>${module.lead.title}</strong><p>${module.lead.text}</p>
          </div>
          <div class="dfbk-message-card"><div class="dfbk-avatar">${icon(uiIcons, "user")}</div><div><strong>${module.lead.type}</strong><p>${module.lead.message}</p></div><span>10:24</span></div>
          <div class="dfbk-lead-success">${icon(uiIcons, "check")}${module.lead.success}</div>
        </section>

        <nav class="dfbk-progress" aria-label="Fortschritt ${module.label}">
          ${module.nav.map((label, sceneIndex) => `<button type="button" data-module-go="${moduleIndex}" data-scene-go="${sceneIndex}"><span></span><b>${label}</b></button>`).join("")}
        </nav>
      </article>`;
  }

  stage.innerHTML = config.modules.map(moduleMarkup).join("");
  tabs.innerHTML = config.modules.map((module, index) => `
    <button type="button" data-scenario-go="${index}">
      ${icon(industryIcons, module.icon)}<span>${module.label}</span>
    </button>`).join("");

  const moduleNodes = [...stage.querySelectorAll(".dfbk-module")];
  const tabNodes = [...tabs.querySelectorAll("button")];

  function sceneIndexAt(localTime) {
    if (localTime < sceneStarts[1]) return 0;
    if (localTime < sceneStarts[2]) return 1;
    if (localTime < sceneStarts[3]) return 2;
    return 3;
  }

  function setModuleScene(moduleNode, localTime) {
    const index = sceneIndexAt(localTime);
    const scenes = [...moduleNode.querySelectorAll(".dfbk-scene")];
    scenes.forEach((scene, sceneIndex) => scene.classList.toggle("is-active", sceneIndex === index));

    const controls = [...moduleNode.querySelectorAll(".dfbk-progress button")];
    controls.forEach((control, controlIndex) => {
      const complete = controlIndex < index;
      const current = controlIndex === index;
      const progress = complete ? 1 : current ? Math.min(1, Math.max(0, (localTime - sceneStarts[index]) / sceneDurations[index])) : 0;
      control.classList.toggle("is-current", current);
      control.style.setProperty("--dfbk-fill", `${progress * 100}%`);
    });
    return index;
  }

  function moduleOpacity(moduleIndex, localTime) {
    let opacity = 1;
    if (moduleIndex > 0 && localTime < timing.overlap) opacity = localTime / timing.overlap;
    if (moduleIndex < config.modules.length - 1 && localTime > timing.module - timing.overlap) {
      opacity = Math.min(opacity, (timing.module - localTime) / timing.overlap);
    }
    return Math.min(1, Math.max(0, opacity));
  }

  function render(now) {
    const elapsed = (now - cycleStartedAt) % timing.cycle;
    let strongest = { index: 0, opacity: -1 };

    moduleNodes.forEach((moduleNode, moduleIndex) => {
      const localTime = elapsed - timing.moduleStarts[moduleIndex];
      const visible = localTime >= 0 && localTime < timing.module;
      const opacity = visible ? moduleOpacity(moduleIndex, localTime) : 0;
      moduleNode.style.opacity = opacity.toFixed(3);
      moduleNode.style.zIndex = String(10 + Math.round(opacity * 10));
      moduleNode.classList.toggle("is-visible", visible);
      moduleNode.setAttribute("aria-hidden", visible ? "false" : "true");
      if (visible) {
        setModuleScene(moduleNode, localTime);
        if (opacity > strongest.opacity) strongest = { index: moduleIndex, opacity };
      }
    });

    if (strongest.index !== activeScenario) {
      activeScenario = strongest.index;
      tabNodes.forEach((tab, index) => tab.classList.toggle("is-current", index === activeScenario));
      root.dataset.activeScenario = config.modules[activeScenario].id;
    }
    rafId = requestAnimationFrame(render);
  }

  tabs.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scenario-go]");
    if (!button) return;
    const moduleIndex = Number(button.dataset.scenarioGo);
    const offset = timing.moduleStarts[moduleIndex] + (moduleIndex ? timing.overlap : 0);
    cycleStartedAt = performance.now() - offset;
  });

  stage.addEventListener("click", (event) => {
    const button = event.target.closest("[data-scene-go]");
    if (!button) return;
    const moduleIndex = Number(button.dataset.moduleGo);
    const sceneIndex = Number(button.dataset.sceneGo);
    const offset = timing.moduleStarts[moduleIndex] + sceneStarts[sceneIndex] + 20;
    cycleStartedAt = performance.now() - offset;
  });

  function showReducedMotionState() {
    moduleNodes.forEach((moduleNode, moduleIndex) => {
      moduleNode.style.opacity = moduleIndex === 0 ? "1" : "0";
      moduleNode.classList.toggle("is-visible", moduleIndex === 0);
      moduleNode.querySelectorAll(".dfbk-scene").forEach((scene, sceneIndex) => scene.classList.toggle("is-active", moduleIndex === 0 && sceneIndex === 2));
    });
    tabNodes[0].classList.add("is-current");
  }

  if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    showReducedMotionState();
  } else {
    cycleStartedAt = performance.now();
    rafId = requestAnimationFrame(render);
  }

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      hiddenAt = performance.now();
      cancelAnimationFrame(rafId);
    } else if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      cycleStartedAt += performance.now() - hiddenAt;
      rafId = requestAnimationFrame(render);
    }
  });
}());
