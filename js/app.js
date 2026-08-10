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
    catCharacterId: "orange",
    customCatImage: "",
  };

  const BUILTIN_CATS = [
    { id: "orange", name: "橘团子", swatch: "#f6b26b" },
    { id: "gray", name: "灰灰", swatch: "#b9bec6" },
    { id: "black", name: "小黑", swatch: "#54545c" },
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
  const customCatImg = $("customCatImg");
  const catCanvasEl = $("catCanvas");
  const catSwitcher = $("catSwitcher");
  const catUploadInput = $("catUploadInput");

  // ---------- Cat ----------
  const cat = new PixelCat(catCanvasEl);

  function applyCatCharacter() {
    const id = state.settings.catCharacterId;
    if (id === "custom" && state.settings.customCatImage) {
      catCanvasEl.hidden = true;
      customCatImg.hidden = false;
      customCatImg.src = state.settings.customCatImage;
    } else {
      const palette = PixelCat.PALETTES[id] || PixelCat.PALETTES.orange;
      cat.setPalette(palette);
      catCanvasEl.hidden = false;
      customCatImg.hidden = true;
    }
  }

  function renderCatSwitcher() {
    catSwitcher.innerHTML = "";
    for (const c of BUILTIN_CATS) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "cat-swatch" + (state.settings.catCharacterId === c.id ? " active" : "");
      btn.style.background = c.swatch;
      btn.title = c.name;
      btn.addEventListener("click", () => {
        state.settings.catCharacterId = c.id;
        saveSettings(state.settings);
        applyCatCharacter();
        renderCatSwitcher();
      });
      catSwitcher.appendChild(btn);
    }

    const uploadBtn = document.createElement("button");
    uploadBtn.type = "button";
    uploadBtn.className = "cat-swatch upload" + (state.settings.catCharacterId === "custom" ? " active" : "");
    uploadBtn.title = "上传我喜欢的猫咪图片/表情包";
    if (state.settings.customCatImage) {
      const img = document.createElement("img");
      img.src = state.settings.customCatImage;
      uploadBtn.appendChild(img);
      uploadBtn.addEventListener("click", () => {
        state.settings.catCharacterId = "custom";
        saveSettings(state.settings);
        applyCatCharacter();
        renderCatSwitcher();
      });
    } else {
      uploadBtn.textContent = "📷";
      uploadBtn.addEventListener("click", () => catUploadInput.click());
    }
    catSwitcher.appendChild(uploadBtn);
  }

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
      renderCatSwitcher();
      say("新猫咪上线啦！喵～");
    };
    reader.readAsDataURL(file);
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
      say(CatChat.idleLine());
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
      history: state.history,
      userText: text,
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
  renderCatSwitcher();
  updateChatHint();
  renderHistory();
  tickStats();
  setInterval(tickStats, 1000);
  scheduleIdleLine();
})();
