(function () {
  const MANUSCRIPT_PATH = "content/rauhoita-hermostosi.md";
  const STORAGE_KEY = "rauhoita-hermostosi-progress";
  const VIDEO_SOUND_KEY = "rauhoita-hermostosi-video-sound";
  const VIDEO_SOUND_LEVEL = 0.25;
  const SECTION_VIDEOS = {
    "Johdanto": "assets/video/johdanto.mp4",
    "OSA 1": "assets/video/osa-1.mp4",
    "OSA 2": "assets/video/osa-2.mp4",
    "OSA 3": "assets/video/osa-3.mp4",
    "OSA 4": "assets/video/osa-4.mp4",
    "OSA 5": "assets/video/osa-5.mp4",
    "Päätös": "assets/video/paatos.mp4"
  };
  const OBSERVATION_PROMPTS = {
    "Johdanto": "Mikä tapa käyttää tätä kirjaa tuntuu kehollesi mahdolliselta juuri nyt?",
    "OSA 1": "Mikä tässä osassa tuntui tunnistettavalta omassa kehossasi?",
    "OSA 2": "Missä kuormitus kertyy sinulla huomaamatta arjen aikana?",
    "OSA 3": "Mihin turvasignaaliin tai hidastukseen kehosi vastaa helpoimmin?",
    "OSA 4": "Minkä pienen arjen suunnanmuutoksen haluat ottaa mukaan seuraavaan päivään?",
    "OSA 5": "Mikä auttaa sinua muistamaan, että palautuminen on suunta eikä suoritus?",
    "Päätös": "Mitä haluat tämän kirjan lopusta jäävän mukaasi?"
  };

  const state = {
    book: null,
    flatChapters: [],
    currentIndex: 0,
    progress: loadProgress(),
    videoSoundEnabled: loadVideoSoundPreference(),
    isTurning: false,
    videoAvailability: {},
    videoRequestToken: 0
  };

  const elements = {
    bookTitle: document.getElementById("book-title"),
    routeLabel: document.querySelector(".hero-panel .panel-label"),
    routeList: document.getElementById("route-list"),
    startScreen: document.getElementById("start-screen"),
    readerScreen: document.getElementById("reader-screen"),
    readerCard: document.querySelector(".reader-card"),
    errorScreen: document.getElementById("error-screen"),
    errorCopy: document.getElementById("error-copy"),
    tocToggle: document.getElementById("toc-toggle"),
    openMap: document.getElementById("open-map"),
    tocPanel: document.getElementById("toc-panel"),
    tocList: document.getElementById("toc-list"),
    startReading: document.getElementById("start-reading"),
    partLabel: document.getElementById("part-label"),
    chapterTitle: document.getElementById("chapter-title"),
    progressText: document.getElementById("progress-text"),
    progressPercent: document.getElementById("progress-percent"),
    progressBar: document.getElementById("progress-bar"),
    videoSlot: document.getElementById("video-slot"),
    videoSlotTitle: document.getElementById("video-slot-title"),
    videoSlotCopy: document.getElementById("video-slot-copy"),
    readerBody: document.getElementById("reader-body"),
    observationCard: document.getElementById("observation-card"),
    observationTitle: document.getElementById("observation-title"),
    observationCopy: document.getElementById("observation-copy"),
    observationInput: document.getElementById("observation-input"),
    saveObservation: document.getElementById("save-observation"),
    saveFeedback: document.getElementById("save-feedback"),
    summaryCard: document.getElementById("summary-card"),
    summaryEyebrow: document.querySelector("#summary-card .eyebrow"),
    summaryHeading: document.querySelector("#summary-card h2"),
    summaryList: document.getElementById("summary-list"),
    readerFooter: document.querySelector(".reader-footer"),
    prevChapter: document.getElementById("prev-chapter"),
    nextChapter: document.getElementById("next-chapter"),
    markComplete: document.getElementById("mark-complete"),
    resetProgress: document.getElementById("reset-progress")
  };

  bindEvents();
  init();

  async function init() {
    try {
      const response = await fetch(MANUSCRIPT_PATH, { cache: "no-store" });
      if (!response.ok) {
        throw new Error("HTTP " + response.status);
      }
      const markdown = await response.text();
      state.book = parseBook(markdown);
      state.flatChapters = flattenChapters(state.book);
      hydrateProgress();
      renderShell();
      state.currentIndex = resolveInitialIndex();
      if (window.location.hash) {
        showReader();
        renderCurrentChapter();
      }
    } catch (error) {
      showError(error);
    }
  }

  function bindEvents() {
    elements.startReading.addEventListener("click", () => {
      showReader();
      goToChapter(resolveInitialIndex(), null, { animate: false });
    });
    elements.openMap.addEventListener("click", toggleToc);
    elements.tocToggle.addEventListener("click", toggleToc);
    elements.prevChapter.addEventListener("click", () => navigate(-1, elements.prevChapter));
    elements.nextChapter.addEventListener("click", () => handleNextAction(elements.nextChapter));
    elements.markComplete.addEventListener("click", () => markCurrentComplete(elements.markComplete));
    elements.saveObservation.addEventListener("click", saveObservation);
    elements.resetProgress.addEventListener("click", resetProgress);
    window.addEventListener("hashchange", handleHashChange);
    document.addEventListener("click", (event) => {
      if (!elements.tocPanel.classList.contains("is-open")) {
        return;
      }
      const insidePanel = elements.tocPanel.contains(event.target);
      const isToggle = event.target === elements.tocToggle || event.target === elements.openMap;
      if (!insidePanel && !isToggle) {
        closeToc();
      }
    });
  }

  function renderShell() {
    elements.bookTitle.textContent = state.book.title;
    if (elements.routeLabel) {
      elements.routeLabel.textContent = "Sisäinen kartta";
    }
    if (elements.summaryEyebrow) {
      elements.summaryEyebrow.textContent = "Opuksen jäljet";
    }
    if (elements.summaryHeading) {
      elements.summaryHeading.textContent = "Matkan aikana merkityt havainnot";
    }
    renderRouteList();
    renderToc();
  }

  function renderRouteList() {
    elements.routeList.innerHTML = "";
    state.book.parts.forEach((part) => {
      const item = document.createElement("div");
      item.className = "route-item";
      item.innerHTML = `<strong>${escapeHtml(part.title)}</strong><span>${part.chapters.length} osiota</span>`;
      elements.routeList.appendChild(item);
    });
  }

  function renderToc() {
    elements.tocList.innerHTML = "";
    state.book.parts.forEach((part) => {
      const group = document.createElement("section");
      group.className = "toc-group";
      const heading = document.createElement("h3");
      heading.textContent = part.title;
      group.appendChild(heading);

      part.chapters.forEach((chapter) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "toc-button";
        button.dataset.slug = chapter.slug;
        button.textContent = chapter.title;
        button.addEventListener("click", () => {
          showReader();
          goToChapter(indexBySlug(chapter.slug), button);
          closeToc();
        });
        group.appendChild(button);
      });

      elements.tocList.appendChild(group);
    });

    updateTocState();
  }

  function renderCurrentChapter() {
    const chapter = state.flatChapters[state.currentIndex];
    if (!chapter) {
      return;
    }
    const summaryChapter = isSummaryChapter(chapter);
    const closingChapter = isClosingChapter(chapter);
    const finalChapter = state.currentIndex === state.flatChapters.length - 1;

    elements.partLabel.textContent = chapter.partTitle;
    elements.chapterTitle.textContent = chapter.title;
    elements.readerBody.innerHTML = markdownToHtml(chapter.body);

    const completedCount = Object.keys(state.progress.completed).length;
    const chapterCount = state.flatChapters.length;
    const progressPct = chapterCount ? Math.round((completedCount / chapterCount) * 100) : 0;
    elements.progressText.textContent = `${state.currentIndex + 1} / ${chapterCount}`;
    elements.progressPercent.textContent = `${progressPct}%`;
    elements.progressBar.style.width = `${progressPct}%`;

    const firstInPart = isFirstChapterInPart(chapter);
    renderSectionVideo(chapter, firstInPart);
    elements.videoSlot.classList.toggle("hidden", !elements.videoSlot.querySelector("video"));
    if (firstInPart && !elements.videoSlot.classList.contains("hidden") && !elements.videoSlot.querySelector("video")) {
      elements.videoSlotTitle.textContent = chapter.partTitle;
      elements.videoSlotCopy.textContent =
        chapter.partTitle === "Päätös"
          ? "Voit lisätä myöhemmin lopun siirtymävideon tähän kohtaan."
          : "Voit lisätä myöhemmin tämän pääosan alkuun lyhyen tunnelmallisen siirtymävideon.";
    }

    const lastInPart = isLastChapterInPart(chapter);
    const showObservation = lastInPart && !closingChapter;
    elements.observationCard.classList.toggle("hidden", !showObservation);
    if (showObservation) {
      const prompt = OBSERVATION_PROMPTS[chapter.partTitle] || OBSERVATION_PROMPTS["OSA 5"];
      elements.observationTitle.textContent = `${chapter.partTitle} – oma havainto`;
      elements.observationCopy.textContent = prompt;
      elements.observationInput.value = state.progress.observations[chapter.partTitle] || "";
      elements.saveFeedback.textContent = "";
    }

    elements.summaryCard.classList.toggle("hidden", !summaryChapter);
    if (summaryChapter) {
      renderSummary();
    }

    elements.prevChapter.disabled = state.currentIndex === 0;
    elements.nextChapter.disabled = false;
    elements.nextChapter.textContent = closingChapter && finalChapter ? "Palaa alkuun" : "Seuraava";
    elements.markComplete.classList.toggle("hidden", closingChapter);
    elements.readerFooter.classList.toggle("is-final-close", closingChapter);
    elements.markComplete.textContent = state.progress.completed[chapter.slug]
      ? "Kuljettu"
      : "Merkitse kuljetuksi";

    updateTocState();
  }

  function renderSummary() {
    elements.summaryList.innerHTML = "";
    const entries = Object.entries(state.progress.observations).filter(([, value]) => value.trim());

    if (!entries.length) {
      const empty = document.createElement("p");
      empty.className = "summary-empty";
      empty.textContent = "Et ole vielä tallentanut havaintoja. Voit kirjoittaa niitä pääosien lopussa.";
      elements.summaryList.appendChild(empty);
      return;
    }

    entries.forEach(([part, value]) => {
      const item = document.createElement("article");
      item.className = "summary-item";
      item.innerHTML = `<h3>${escapeHtml(part)}</h3><p>${escapeHtml(value)}</p>`;
      elements.summaryList.appendChild(item);
    });
  }

  function renderSectionVideo(chapter, firstInPart) {
    const videoPath = SECTION_VIDEOS[chapter.partTitle];
    const shouldTryVideo = firstInPart && Boolean(videoPath);
    const requestToken = ++state.videoRequestToken;

    resetSectionVideo();

    if (!shouldTryVideo) {
      return;
    }

    if (state.videoAvailability[videoPath] === false) {
      return;
    }

    elements.videoSlot.classList.remove("hidden");
    elements.videoSlot.classList.add("is-loading");
    elements.videoSlot.dataset.videoState = "loading";
    elements.videoSlotTitle.textContent = chapter.partTitle;
    elements.videoSlotCopy.textContent = "Lyhyt siirtymä avautuu vain tämän pääosan alussa.";

    const video = document.createElement("video");
    video.className = "threshold-video";
    video.muted = true;
    video.defaultMuted = true;
    video.playsInline = true;
    video.autoplay = true;
    video.loop = true;
    video.preload = "metadata";
    video.setAttribute("muted", "");
    video.setAttribute("playsinline", "");
    video.setAttribute("autoplay", "");
    video.setAttribute("loop", "");
    video.setAttribute("tabindex", "-1");
    video.setAttribute("aria-hidden", "true");
    video.src = videoPath;

    const soundControl = document.createElement("button");
    soundControl.type = "button";
    soundControl.className = "threshold-sound-toggle";
    soundControl.textContent = "Äänet päälle";
    soundControl.setAttribute("aria-pressed", "false");
    soundControl.addEventListener("click", () => {
      toggleThresholdVideoSound(video, soundControl);
    });

    video.addEventListener("loadeddata", () => {
      if (requestToken !== state.videoRequestToken) {
        video.pause();
        return;
      }
      state.videoAvailability[videoPath] = true;
      elements.videoSlot.classList.remove("is-loading");
      elements.videoSlot.dataset.videoState = "ready";
      applyMutedAutoplay(video);
      syncThresholdSoundControl(video, soundControl);
      if (state.videoSoundEnabled) {
        syncThresholdVideoSound(video, true).then((enabled) => {
          state.videoSoundEnabled = enabled;
          persistVideoSoundPreference(enabled);
          syncThresholdSoundControl(video, soundControl);
        });
      }
    }, { once: true });

    video.addEventListener("error", () => {
      if (requestToken !== state.videoRequestToken) {
        return;
      }
      state.videoAvailability[videoPath] = false;
      resetSectionVideo();
    }, { once: true });

    elements.videoSlot.appendChild(video);
    elements.videoSlot.appendChild(soundControl);
  }

  function resetSectionVideo() {
    const existingVideo = elements.videoSlot.querySelector("video");
    if (existingVideo) {
      existingVideo.pause();
      existingVideo.removeAttribute("src");
      existingVideo.load();
      existingVideo.remove();
    }
    const existingSoundControl = elements.videoSlot.querySelector(".threshold-sound-toggle");
    if (existingSoundControl) {
      existingSoundControl.remove();
    }
    elements.videoSlot.dataset.videoState = "idle";
    elements.videoSlot.classList.remove("is-loading");
    elements.videoSlot.classList.add("hidden");
    elements.videoSlotTitle.textContent = "";
    elements.videoSlotCopy.textContent = "";
  }

  function goToChapter(index, triggerElement, options = {}) {
    const boundedIndex = Math.max(0, Math.min(index, state.flatChapters.length - 1));
    state.currentIndex = boundedIndex;
    const chapter = state.flatChapters[boundedIndex];
    if (!chapter) {
      return;
    }
    const applyChapter = () => {
      showReader();
      window.location.hash = `#${chapter.slug}`;
      renderCurrentChapter();
    };
    const animate = options.animate !== false && !elements.readerScreen.classList.contains("hidden");
    pulseControl(triggerElement);
    if (animate) {
      runMembraneTurn(applyChapter);
      return;
    }
    applyChapter();
  }

  function handleHashChange() {
    if (!state.flatChapters.length) {
      return;
    }
    const slug = window.location.hash.replace(/^#/, "");
    if (!slug) {
      return;
    }
    const index = indexBySlug(slug);
    if (index >= 0 && index !== state.currentIndex) {
      state.currentIndex = index;
      showReader();
      renderCurrentChapter();
    }
  }

  function handleNextAction(triggerElement) {
    const chapter = state.flatChapters[state.currentIndex];
    if (isClosingChapter(chapter) && state.currentIndex === state.flatChapters.length - 1) {
      returnToStart(triggerElement);
      return;
    }
    navigate(1, triggerElement);
  }

  function navigate(step, triggerElement) {
    if (state.isTurning) {
      return;
    }
    goToChapter(state.currentIndex + step, triggerElement);
  }

  function returnToStart(triggerElement) {
    pulseControl(triggerElement);
    if (window.history && typeof window.history.replaceState === "function") {
      window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
    } else {
      window.location.hash = "";
    }
    closeToc();
    elements.readerScreen.classList.add("hidden");
    elements.errorScreen.classList.add("hidden");
    elements.startScreen.classList.remove("hidden");
    window.scrollTo({ top: 0, behavior: prefersReducedMotion() ? "auto" : "smooth" });
  }

  function markCurrentComplete(triggerElement) {
    if (state.isTurning) {
      return;
    }
    const chapter = state.flatChapters[state.currentIndex];
    pulseControl(triggerElement);
    runMembraneTurn(() => {
      state.progress.completed[chapter.slug] = true;
      persistProgress();
      renderCurrentChapter();
    });
  }

  function saveObservation() {
    const chapter = state.flatChapters[state.currentIndex];
    state.progress.observations[chapter.partTitle] = elements.observationInput.value;
    persistProgress();
    elements.saveFeedback.textContent = "Havainto tallennettu tähän laitteeseen.";
    if (isSummaryChapter(chapter)) {
      renderSummary();
    }
  }

  function resetProgress() {
    const confirmed = window.confirm("Poistetaanko tallennetut etenemistiedot ja havainnot tältä laitteelta?");
    if (!confirmed) {
      return;
    }
    state.progress = { completed: {}, observations: {} };
    persistProgress();
    renderCurrentChapter();
  }

  function toggleToc() {
    const open = !elements.tocPanel.classList.contains("is-open");
    elements.tocPanel.classList.toggle("is-open", open);
    elements.tocToggle.setAttribute("aria-expanded", String(open));
  }

  function closeToc() {
    elements.tocPanel.classList.remove("is-open");
    elements.tocToggle.setAttribute("aria-expanded", "false");
  }

  function updateTocState() {
    const currentSlug = state.flatChapters[state.currentIndex] && state.flatChapters[state.currentIndex].slug;
    const buttons = elements.tocList.querySelectorAll(".toc-button");
    buttons.forEach((button) => {
      const slug = button.dataset.slug;
      button.classList.toggle("is-active", slug === currentSlug);
      button.classList.toggle("is-complete", Boolean(state.progress.completed[slug]));
    });
  }

  function showReader() {
    elements.startScreen.classList.add("hidden");
    elements.errorScreen.classList.add("hidden");
    elements.readerScreen.classList.remove("hidden");
  }

  function showError(error) {
    elements.startScreen.classList.add("hidden");
    elements.readerScreen.classList.add("hidden");
    elements.errorScreen.classList.remove("hidden");
    elements.errorCopy.textContent =
      "Tarkista, että sivu avataan staattisen palvelimen kautta ja että content/rauhoita-hermostosi.md löytyy. " +
      `Virhe: ${error.message}`;
  }

  function resolveInitialIndex() {
    const hashSlug = window.location.hash.replace(/^#/, "");
    if (hashSlug) {
      const hashIndex = indexBySlug(hashSlug);
      if (hashIndex >= 0) {
        return hashIndex;
      }
    }

    const completed = Object.keys(state.progress.completed);
    if (completed.length) {
      const lastCompletedIndex = Math.max(
        ...completed
          .map((slug) => indexBySlug(slug))
          .filter((index) => index >= 0)
      );
      return Math.min(lastCompletedIndex + 1, state.flatChapters.length - 1);
    }

    return 0;
  }

  function indexBySlug(slug) {
    return state.flatChapters.findIndex((chapter) => chapter.slug === slug);
  }

  function isFirstChapterInPart(chapter) {
    const part = state.book.parts.find((item) => item.title === chapter.partTitle);
    return Boolean(part && part.chapters[0] && part.chapters[0].slug === chapter.slug);
  }

  function isLastChapterInPart(chapter) {
    const part = state.book.parts.find((item) => item.title === chapter.partTitle);
    return Boolean(part && part.chapters[part.chapters.length - 1] && part.chapters[part.chapters.length - 1].slug === chapter.slug);
  }

  function isSummaryChapter(chapter) {
    return Boolean(chapter && chapter.partTitle === "Päätös" && chapter.title === "Omat jäljet tästä opuksesta");
  }

  function isClosingChapter(chapter) {
    return Boolean(chapter && chapter.partTitle === "Päätös" && chapter.title === "Sulje opus");
  }

  function flattenChapters(book) {
    const result = [];
    book.parts.forEach((part) => {
      part.chapters.forEach((chapter) => {
        result.push(chapter);
      });
    });
    return result;
  }

  function parseBook(markdown) {
    const normalized = markdown.replace(/\r\n/g, "\n");
    const lines = normalized.split("\n");
    const book = { title: "", parts: [] };
    let currentPart = null;
    let currentChapter = null;
    let buffer = [];

    function flushChapter() {
      if (!currentChapter) {
        return;
      }
      currentChapter.body = buffer.join("\n").trim();
      if (!currentChapter.body) {
        currentChapter.body = "Tämä osio odottaa vielä sisältöään.";
      }
      currentPart.chapters.push(currentChapter);
      currentChapter = null;
      buffer = [];
    }

    function ensurePart(title) {
      flushChapter();
      currentPart = { title, chapters: [] };
      book.parts.push(currentPart);
    }

    lines.forEach((line) => {
      if (line.startsWith("# ")) {
        book.title = line.slice(2).trim();
        return;
      }
      if (line.startsWith("## ")) {
        ensurePart(line.slice(3).trim());
        return;
      }
      if (line.startsWith("### ")) {
        flushChapter();
        if (!currentPart) {
          ensurePart("Johdanto");
        }
        currentChapter = {
          partTitle: currentPart.title,
          title: line.slice(4).trim(),
          slug: slugify(`${currentPart.title}-${line.slice(4).trim()}`),
          body: ""
        };
        return;
      }
      buffer.push(line);
    });

    flushChapter();
    return book;
  }

  function markdownToHtml(markdown) {
    const lines = markdown.split("\n");
    const html = [];
    let paragraph = [];
    let listItems = [];
    let quoteLines = [];
    let inAside = false;
    let asideLines = [];

    function flushParagraph() {
      if (!paragraph.length) {
        return;
      }
      html.push(`<p>${renderInline(paragraph.join(" "))}</p>`);
      paragraph = [];
    }

    function flushList() {
      if (!listItems.length) {
        return;
      }
      html.push(`<ul>${listItems.map((item) => `<li>${renderInline(item)}</li>`).join("")}</ul>`);
      listItems = [];
    }

    function flushQuote() {
      if (!quoteLines.length) {
        return;
      }
      html.push(`<blockquote>${quoteLines.map((line) => `<p>${renderInline(line)}</p>`).join("")}</blockquote>`);
      quoteLines = [];
    }

    function flushAside() {
      if (!asideLines.length) {
        html.push("<aside></aside>");
      } else {
        html.push(`<aside>${markdownToHtml(asideLines.join("\n"))}</aside>`);
      }
      asideLines = [];
      inAside = false;
    }

    lines.forEach((line) => {
      const trimmed = line.trim();

      if (trimmed === "<aside>") {
        flushParagraph();
        flushList();
        flushQuote();
        inAside = true;
        asideLines = [];
        return;
      }

      if (trimmed === "</aside>") {
        flushParagraph();
        flushList();
        flushQuote();
        flushAside();
        return;
      }

      if (inAside) {
        asideLines.push(line);
        return;
      }

      if (!trimmed) {
        flushParagraph();
        flushList();
        flushQuote();
        return;
      }

      if (/^---+$/.test(trimmed)) {
        flushParagraph();
        flushList();
        flushQuote();
        html.push("<hr />");
        return;
      }

      if (/^#{4,6}\s+/.test(trimmed)) {
        flushParagraph();
        flushList();
        flushQuote();
        const match = trimmed.match(/^(#{4,6})\s+(.*)$/);
        const level = Math.min(6, match[1].length);
        html.push(`<h${level}>${renderInline(match[2])}</h${level}>`);
        return;
      }

      if (/^- /.test(trimmed)) {
        flushParagraph();
        flushQuote();
        listItems.push(trimmed.slice(2).trim());
        return;
      }

      if (/^> ?/.test(trimmed)) {
        flushParagraph();
        flushList();
        quoteLines.push(trimmed.replace(/^> ?/, ""));
        return;
      }

      paragraph.push(trimmed);
    });

    flushParagraph();
    flushList();
    flushQuote();
    if (inAside) {
      flushAside();
    }

    return html.join("");
  }

  function renderInline(text) {
    const escaped = escapeHtml(text);
    return escaped
      .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
      .replace(/\*(.+?)\*/g, "<em>$1</em>")
      .replace(/`(.+?)`/g, "<code>$1</code>");
  }

  function slugify(text) {
    return text
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "");
  }

  function escapeHtml(text) {
    return text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function loadProgress() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return { completed: {}, observations: {} };
      }
      const parsed = JSON.parse(raw);
      return {
        completed: parsed.completed || {},
        observations: parsed.observations || {}
      };
    } catch (error) {
      return { completed: {}, observations: {} };
    }
  }

  function loadVideoSoundPreference() {
    try {
      return localStorage.getItem(VIDEO_SOUND_KEY) === "on";
    } catch (error) {
      return false;
    }
  }

  function persistVideoSoundPreference(enabled) {
    try {
      localStorage.setItem(VIDEO_SOUND_KEY, enabled ? "on" : "off");
    } catch (error) {
      return;
    }
  }

  function applyMutedAutoplay(video) {
    video.volume = VIDEO_SOUND_LEVEL;
    video.muted = true;
    video.defaultMuted = true;
    const playPromise = video.play();
    if (playPromise && typeof playPromise.catch === "function") {
      playPromise.catch(() => {});
    }
  }

  function syncThresholdSoundControl(video, control) {
    if (!video || !control) {
      return;
    }
    const soundEnabled = !video.muted;
    control.textContent = soundEnabled ? "Äänet pois" : "Äänet päälle";
    control.setAttribute("aria-pressed", soundEnabled ? "true" : "false");
  }

  function syncThresholdVideoSound(video, shouldEnableSound) {
    if (!video) {
      return Promise.resolve(false);
    }

    if (!shouldEnableSound) {
      video.volume = VIDEO_SOUND_LEVEL;
      video.muted = true;
      video.defaultMuted = true;
      return Promise.resolve(true);
    }

    video.volume = VIDEO_SOUND_LEVEL;
    video.muted = false;
    video.defaultMuted = false;

    const playPromise = video.play();
    if (!playPromise || typeof playPromise.then !== "function") {
      return Promise.resolve(true);
    }

    return playPromise.then(() => true).catch(() => {
      video.volume = VIDEO_SOUND_LEVEL;
      video.muted = true;
      video.defaultMuted = true;
      return false;
    });
  }

  function toggleThresholdVideoSound(video, control) {
    const shouldEnableSound = video.muted;
    syncThresholdVideoSound(video, shouldEnableSound).then((enabled) => {
      state.videoSoundEnabled = enabled ? shouldEnableSound : false;
      persistVideoSoundPreference(state.videoSoundEnabled);
      syncThresholdSoundControl(video, control);
    });
  }

  function hydrateProgress() {
    state.progress = {
      completed: state.progress.completed || {},
      observations: state.progress.observations || {}
    };
  }

  function persistProgress() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.progress));
  }

  function runMembraneTurn(updateFn) {
    if (prefersReducedMotion() || !elements.readerCard) {
      updateFn();
      return;
    }
    if (state.isTurning) {
      return;
    }
    state.isTurning = true;
    elements.readerCard.classList.add("page-is-turning");

    window.setTimeout(() => {
      updateFn();
      elements.readerCard.classList.remove("page-is-turning");
      elements.readerCard.classList.add("page-has-turned");

      window.setTimeout(() => {
        elements.readerCard.classList.remove("page-has-turned");
        state.isTurning = false;
      }, 120);
    }, 90);
  }

  function pulseControl(element) {
    if (!element) {
      return;
    }
    element.classList.remove("is-triggered");
    void element.offsetWidth;
    element.classList.add("is-triggered");
    window.setTimeout(() => {
      element.classList.remove("is-triggered");
    }, prefersReducedMotion() ? 40 : 260);
  }

  function prefersReducedMotion() {
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  }
})();
