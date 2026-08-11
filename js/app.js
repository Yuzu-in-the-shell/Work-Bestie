(function () {
  const STORAGE_KEY = "workBestie.settings.v1";
  const CHAT_KEY = "workBestie.chatHistory.v1";

  const DEFAULT_SETTINGS = {
    catName: "团子",
    salary: 9500,
    start: "09:00",
    end: "17:00",
    workDaysPerWeek: 5,
    apiKey: "",
    model: "gpt-4o-mini",
    catCharacterId: "loaf",
    customCatImage: "",
  };

  const BUILTIN_CATS = [
    { id: "loaf", src: "assets/cats/loaf-cat.gif" },
    { id: "wave", src: "assets/cats/scuba-scuba-cat.gif" },
    { id: "pudding", src: "assets/cats/maxwell-cat.gif" },
    { id: "standing", src: "assets/cats/cat-meme-running.gif" },
    { id: "banana", src: "assets/cats/banana-cat-cat-banana.gif" },
    { id: "dance", src: "assets/cats/cat-excited.gif" },
  ];

  const MAX_UPLOAD_BYTES = 1.5 * 1024 * 1024;

  function loadSettings() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return { ...DEFAULT_SETTINGS };
      return { ...DEFAULT_SETTINGS, ...JSON.parse(raw) };
    } catch {
      return { ...DEFAULT_SETTINGS };
    }
  }

  function saveSettings(settings) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }

  function loadChatHistory() {
    try {
      const raw = localStorage.getItem(CHAT_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  }

  function saveChatHistory(history) {
    localStorage.setItem(CHAT_KEY, JSON.stringify(history.slice(-40)));
  }

  const state = {
    settings: loadSettings(),
    history: loadChatHistory(),
  };

  // ---------- DOM refs ----------
  const $ = (id) => document.getElementById(id);
  const moneyValue = $("moneyValue");
  const dayFill = $("dayFill");
  const dayPercent = $("dayPercent");
  const dayTimeRange = $("dayTimeRange");
  const weekFill = $("weekFill");
  const weekPercent = $("weekPercent");
  const weekSub = $("weekSub");
  const speechText = $("speechText");
  const speechBubble = $("speechBubble");
  const catNameLabel = $("catNameLabel");
  const catNameLabel2 = $("catNameLabel2");

  const chatLog = $("chatLog");
  const chatForm = $("chatForm");
  const chatInput = $("chatInput");
  const chatHint = $("chatHint");

  const settingsBtn = $("settingsBtn");
  const modalOverlay = $("modalOverlay");
  const closeModalBtn = $("closeModalBtn");
  const saveSettingsBtn = $("saveSettingsBtn");
  const clearKeyBtn = $("clearKeyBtn");

  const inputCatName = $("inputCatName");
  const inputSalary = $("inputSalary");
  const inputStart = $("inputStart");
  const inputEnd = $("inputEnd");
  const inputWorkdays = $("inputWorkdays");
  const inputApiKey = $("inputApiKey");
  const inputModel = $("inputModel");

  const catStage = $("catStage");
  const catImg = $("catImg");
  const catPicker = $("catPicker");
  const catPickerTrigger = $("catPickerTrigger");
  const catPickerMenu = $("catPickerMenu");
  const catUploadInput = $("catUploadInput");
  const catNameInput = $("catNameInput");

  // ---------- Cat ----------
  function findCharacter(id) {
    if (id === "custom" && state.settings.customCatImage) {
      return { id: "custom", src: state.settings.customCatImage };
    }
    return BUILTIN_CATS.find((c) => c.id === id) || BUILTIN_CATS[0];
  }

  function applyCatCharacter() {
    const char = findCharacter(state.settings.catCharacterId);
    state.settings.catCharacterId = char.id;
    catImg.src = char.src;
  }

  function closeCatPicker() {
    catPickerMenu.hidden = true;
    catPickerTrigger.setAttribute("aria-expanded", "false");
  }

  function renderCatPicker() {
    catPickerMenu.innerHTML = "";

    const options = [...BUILTIN_CATS];
    if (state.settings.customCatImage) {
      options.push({ id: "custom", src: state.settings.customCatImage });
    }

    for (const c of options) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-picker-option" + (state.settings.catCharacterId === c.id ? " active" : "");
      btn.setAttribute("role", "option");
      const img = document.createElement("img");
      img.src = c.src;
      img.alt = "";
      btn.appendChild(img);
      btn.addEventListener("click", () => {
        state.settings.catCharacterId = c.id;
        saveSettings(state.settings);
        applyCatCharacter();
        renderCatPicker();
        closeCatPicker();
      });
      catPickerMenu.appendChild(btn);
    }

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "cat-picker-option upload";
    uploadBtn.title = "上传我喜欢的猫咪图片/GIF";
    uploadBtn.textContent = "📷";
    uploadBtn.addEventListener("click", () => {
      closeCatPicker();
      catUploadInput.click();
    });
    catPickerMenu.appendChild(uploadBtn);
  }

  catPickerTrigger.addEventListener("click", () => {
    const willOpen = catPickerMenu.hidden;
    catPickerMenu.hidden = !willOpen;
    catPickerTrigger.setAttribute("aria-expanded", String(willOpen));
  });

  document.addEventListener("click", (e) => {
    if (!catPicker.contains(e.target)) closeCatPicker();
  });

  catUploadInput.addEventListener("change", () => {
    const file = catUploadInput.files && catUploadInput.files[0];
    catUploadInput.value = "";
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      say("这张图片有点太大啦，换一张小一点的吧～（建议 1.5MB 以内）");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      state.settings.customCatImage = reader.result;
      state.settings.catCharacterId = "custom";
      saveSettings(state.settings);
      applyCatCharacter();
      renderCatPicker();
      say("新猫咪上线啦！喵～");
    };
    reader.readAsDataURL(file);
  });

  // ---------- Inline rename ----------
  function startRename() {
    catNameInput.value = state.settings.catName;
    catNameLabel.hidden = true;
    catNameInput.hidden = false;
    catNameInput.focus();
    catNameInput.select();
  }

  function finishRename(commit) {
    if (catNameInput.hidden) return;
    if (commit) {
      const name = catNameInput.value.trim();
      if (name && name !== state.settings.catName) {
        state.settings.catName = name;
        saveSettings(state.settings);
        applySettingsToView();
        say(`好耶，我以后就叫${name}啦！`);
      }
    }
    catNameInput.hidden = true;
    catNameLabel.hidden = false;
  }

  catNameLabel.addEventListener("click", startRename);
  catNameInput.addEventListener("blur", () => finishRename(true));
  catNameInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") finishRename(true);
    if (e.key === "Escape") finishRename(false);
  });

  catStage.addEventListener("click", () => {
    catStage.classList.remove("bounce");
    void catStage.offsetWidth;
    catStage.classList.add("bounce");
  });
  catStage.addEventListener("animationend", () => catStage.classList.remove("bounce"));

  // ---------- Settings UI ----------
  function applySettingsToForm() {
    inputCatName.value = state.settings.catName;
    inputSalary.value = state.settings.salary;
    inputStart.value = state.settings.start;
    inputEnd.value = state.settings.end;
    inputWorkdays.value = String(state.settings.workDaysPerWeek);
    inputApiKey.value = state.settings.apiKey;
    inputModel.value = state.settings.model;
  }

  function applySettingsToView() {
    catNameLabel.textContent = state.settings.catName;
    catNameLabel2.textContent = state.settings.catName;
    dayTimeRange.textContent = `${state.settings.start} - ${state.settings.end}`;
    weekSub.textContent = WorkStats.weekdayLabel(state.settings.workDaysPerWeek);
  }

  function openModal() {
    applySettingsToForm();
    modalOverlay.classList.add("open");
  }
  function closeModal() {
    modalOverlay.classList.remove("open");
  }

  settingsBtn.addEventListener("click", openModal);
  closeModalBtn.addEventListener("click", closeModal);
  modalOverlay.addEventListener("click", (e) => {
    if (e.target === modalOverlay) closeModal();
  });

  saveSettingsBtn.addEventListener("click", () => {
    const salary = Number(inputSalary.value);
    state.settings = {
      ...state.settings,
      catName: inputCatName.value.trim() || DEFAULT_SETTINGS.catName,
      salary: Number.isFinite(salary) && salary >= 0 ? salary : DEFAULT_SETTINGS.salary,
      start: inputStart.value || DEFAULT_SETTINGS.start,
      end: inputEnd.value || DEFAULT_SETTINGS.end,
      workDaysPerWeek: Number(inputWorkdays.value) || DEFAULT_SETTINGS.workDaysPerWeek,
      apiKey: inputApiKey.value.trim(),
      model: inputModel.value,
    };
    saveSettings(state.settings);
    applySettingsToView();
    updateChatHint();
    closeModal();
    say(`设置好啦，${state.settings.catName}会记住的～`);
  });

  clearKeyBtn.addEventListener("click", () => {
    inputApiKey.value = "";
  });

  // ---------- Speech bubble ----------
  let bubbleTimer = null;
  function say(text) {
    speechBubble.style.opacity = "0";
    setTimeout(() => {
      speechText.textContent = text;
      speechBubble.style.opacity = "1";
    }, 150);
  }

  function scheduleIdleLine() {
    clearTimeout(bubbleTimer);
    const delay = 25000 + Math.random() * 35000;
    bubbleTimer = setTimeout(() => {
      say(CatChat.idleLine(WorkStats.buildContext(state.settings)));
      scheduleIdleLine();
    }, delay);
  }

  // ---------- Stats loop ----------
  function formatMoney(v) {
    return "$ " + v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }

  let lastMoneyInt = -1;
  function tickStats() {
    const stats = WorkStats.computeStats(state.settings);

    moneyValue.textContent = formatMoney(stats.earnings);
    const wholeYuan = Math.floor(stats.earnings);
    if (wholeYuan !== lastMoneyInt) {
      lastMoneyInt = wholeYuan;
      moneyValue.classList.add("pulse");
      setTimeout(() => moneyValue.classList.remove("pulse"), 180);
    }

    dayFill.style.width = stats.dayPercent.toFixed(1) + "%";
    dayPercent.textContent = stats.dayPercent.toFixed(0) + "%";
    weekFill.style.width = stats.weekPercent.toFixed(1) + "%";
    weekPercent.textContent = stats.weekPercent.toFixed(0) + "%";

    if (!stats.workToday) {
      dayTimeRange.textContent = "今天不用上班，好好休息呀 🎉";
    } else {
      dayTimeRange.textContent = `${state.settings.start} - ${state.settings.end}`;
    }
  }

  // ---------- Chat ----------
  function renderMessage(role, text) {
    const el = document.createElement("div");
    el.className = "msg " + (role === "cat" ? "cat" : "user");
    el.textContent = text;
    chatLog.appendChild(el);
    chatLog.scrollTop = chatLog.scrollHeight;
    return el;
  }

  function renderHistory() {
    chatLog.innerHTML = "";
    if (state.history.length === 0) {
      renderMessage("cat", `喵～我是${state.settings.catName}，今天也一起加油上班吧！有什么想跟我聊的都可以说～`);
      return;
    }
    for (const m of state.history) renderMessage(m.role, m.text);
  }

  function updateChatHint() {
    chatHint.textContent = state.settings.apiKey
      ? `已连接 OpenAI（${state.settings.model}）`
      : "未设置 API Key，使用内置猫咪语录 ~ 可在设置中接入 OpenAI 获得更聪明的对话";
  }

  chatForm.addEventListener("submit", async (e) => {
    e.preventDefault();
    const text = chatInput.value.trim();
    if (!text) return;
    chatInput.value = "";
    chatInput.disabled = true;

    renderMessage("user", text);
    state.history.push({ role: "user", text });
    saveChatHistory(state.history);

    const typingEl = document.createElement("div");
    typingEl.className = "msg typing";
    typingEl.textContent = `${state.settings.catName} 正在输入…`;
    chatLog.appendChild(typingEl);
    chatLog.scrollTop = chatLog.scrollHeight;

    const { text: replyText } = await CatChat.reply({
      apiKey: state.settings.apiKey,
      model: state.settings.model,
      catName: state.settings.catName,
      // history already has this turn's message appended; callOpenAI adds
      // userText itself, so trim it here to avoid sending it twice.
      history: state.history.slice(0, -1),
      userText: text,
      ctx: WorkStats.buildContext(state.settings),
    });

    typingEl.remove();
    renderMessage("cat", replyText);
    say(replyText);
    state.history.push({ role: "cat", text: replyText });
    saveChatHistory(state.history);

    chatInput.disabled = false;
    chatInput.focus();
  });

  // ---------- Init ----------
  applySettingsToView();
  applyCatCharacter();
  renderCatPicker();
  updateChatHint();
  renderHistory();
  tickStats();
  setInterval(tickStats, 1000);
  scheduleIdleLine();
})();
