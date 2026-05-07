(function () {
  const MANUSCRIPT_PATH = "content/rauhoita-hermostosi.md";
  const STORAGE_KEY = "rauhoita-hermostosi-progress";
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
    isTurning: false
  };

  const elements = {
    bookTitle: document.getElementById("book-title"),
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
    summaryList: document.getElementById("summary-list"),
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
    elements.nextChapter.addEventListener("click", () => navigate(1, elements.nextChapter));
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
    elements.videoSlot.classList.toggle("hidden", !firstInPart);
    if (firstInPart) {
      elements.videoSlotTitle.textContent = chapter.partTitle;
      elements.videoSlotCopy.textContent =
        chapter.partTitle === "Päätös"
          ? "Voit lisätä myöhemmin lopun siirtymävideon tähän kohtaan."
          : "Voit lisätä myöhemmin tämän pääosan alkuun lyhyen tunnelmallisen siirtymävideon.";
    }

    const lastInPart = isLastChapterInPart(chapter);
    elements.observationCard.classList.toggle("hidden", !lastInPart);
    if (lastInPart) {
      const prompt = OBSERVATION_PROMPTS[chapter.partTitle] || OBSERVATION_PROMPTS["OSA 5"];
      elements.observationTitle.textContent = `${chapter.partTitle} – oma havainto`;
      elements.observationCopy.textContent = prompt;
      elements.observationInput.value = state.progress.observations[chapter.partTitle] || "";
      elements.saveFeedback.textContent = "";
    }

    const isFinalPart = chapter.partTitle === "Päätös";
    elements.summaryCard.classList.toggle("hidden", !isFinalPart);
    if (isFinalPart) {
      renderSummary();
    }

    elements.prevChapter.disabled = state.currentIndex === 0;
    elements.nextChapter.disabled = state.currentIndex === state.flatChapters.length - 1;
    elements.markComplete.textContent = state.progress.completed[chapter.slug]
      ? "Luettu"
      : "Merkitse luetuksi";

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

  function navigate(step, triggerElement) {
    if (state.isTurning) {
      return;
    }
    goToChapter(state.currentIndex + step, triggerElement);
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
    if (chapter.partTitle === "Päätös") {
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

    const finalPart = book.parts[book.parts.length - 1];
    if (finalPart && finalPart.title === "Päätös" && finalPart.chapters.length === 0) {
      finalPart.chapters.push({
        partTitle: "Päätös",
        title: "Päätös",
        slug: slugify("Päätös"),
        body: "Tämä osa toimii lopun yhteenvetosivuna tallennetuille havainnoille."
      });
    }

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
