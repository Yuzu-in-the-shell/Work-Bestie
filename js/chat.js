/* Chat: calls OpenAI directly from the browser if the user supplied an API
 * key (stored only in localStorage), otherwise falls back to a canned line
 * bank so the app is fully usable with zero configuration. */
(function () {
  const IDLE_LINES = [
    "喵～今天也要元气满满哦！",
    "工作再忙，也要记得喝水呀～",
    "主人辛苦啦，摸摸头 (｡•ᴗ•｡)",
    "咦？是不是该起来活动一下啦？",
    "我在这里陪着你呢，喵～",
    "深呼吸～休息一下眼睛吧。",
    "今天的你也超棒的！",
    "肚子饿了嘛？记得按时吃饭哦。",
    "喵呜～工作再累也别忘了微笑。",
    "偷偷告诉你，摸鱼五分钟不算过分～",
  ];

  const CANNED = {
    tired: [
      "辛苦啦，靠在我身上休息一下下吧～",
      "累了就伸个懒腰，喵～我陪你歇会儿。",
      "工作使我快乐（骗你的），一起摸鱼五分钟吧。",
    ],
    happy: [
      "看你这么开心，我尾巴都翘起来啦！",
      "耶！那我们一起开心一下～ ٩(ˊᗜˋ*)و",
    ],
    sad: [
      "抱抱你，一切都会好起来的喵～",
      "别难过啦，我把肚肚给你摸～",
      "不开心的话，跟我说说呗，我一直在听。",
    ],
    encourage: [
      "加油！你已经很棒了，喵！",
      "别怕，慢慢来，我给你加油打气～",
      "你可以的！我对你有信心，喵～",
    ],
    money: [
      "钱钱在慢慢变多哦，安心搬砖～",
      "工资是一点一点攒出来的，喵～坚持住！",
    ],
    hungry: [
      "咕噜咕噜～我也饿了，记得按时吃饭呀！",
      "喵！去吃点东西吧，工作不能空腹哦。",
    ],
    greeting: [
      "喵～你来啦！今天想聊点什么呀？",
      "有什么想跟我说的吗？我竖起耳朵听着呢～",
    ],
    default: [
      "喵？再说一遍嘛～",
      "嗯嗯，我在听呢，继续说～",
      "喵呜～有你在，工作也没那么无聊了。",
      "摸摸下巴，今天心情怎么样呀？",
      "喵～要不要一起数数今天赚了多少钱？",
    ],
  };

  const KEYWORD_MAP = [
    [/累|困|好烦|疲惫|好想睡/, "tired"],
    [/开心|哈哈|爽|太好了|棒/, "happy"],
    [/难过|emo|想哭|烦躁|崩溃|压力/, "sad"],
    [/加油|鼓励|打气|坚持/, "encourage"],
    [/钱|工资|薪水|赚|发财/, "money"],
    [/饿|吃饭|午饭|外卖/, "hungry"],
    [/你好|嗨|hi|hello|在吗/i, "greeting"],
  ];

  function pick(arr) {
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function idleLine() {
    return pick(IDLE_LINES);
  }

  function cannedReply(userText) {
    for (const [regex, key] of KEYWORD_MAP) {
      if (regex.test(userText)) return pick(CANNED[key]);
    }
    return pick(CANNED.default);
  }

  function buildSystemPrompt(catName) {
    return [
      `你是用户的宠物猫，名字叫"${catName}"，此刻正陪着用户一起上班/工作。`,
      "性格：粘人、可爱、话不多但很温暖，偶尔卖萌撒娇，喜欢用「喵」作为语气词，但不要每句话都用。",
      "任务：陪用户闲聊解闷，关心TA的工作状态、情绪、有没有喝水休息，语气轻松自然像朋友一样。",
      "回复要简短，控制在 1-2 句话以内，不要长篇大论，不要使用markdown格式。",
    ].join("\n");
  }

  async function callOpenAI({ apiKey, model, catName, history, userText }) {
    const messages = [
      { role: "system", content: buildSystemPrompt(catName) },
      ...history.slice(-8).map((m) => ({
        role: m.role === "cat" ? "assistant" : "user",
        content: m.text,
      })),
      { role: "user", content: userText },
    ];

    const res = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: model || "gpt-4o-mini",
        messages,
        max_tokens: 150,
        temperature: 0.9,
      }),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => "");
      throw new Error(`OpenAI ${res.status}: ${errBody.slice(0, 200)}`);
    }

    const data = await res.json();
    const text = data.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("空响应");
    return text;
  }

  async function reply({ apiKey, model, catName, history, userText }) {
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
      return { text: cannedReply(userText), source: "canned" };
    }
    try {
      const text = await callOpenAI({ apiKey, model, catName, history, userText });
      return { text, source: "ai" };
    } catch (err) {
      console.error("[CatChat] OpenAI call failed:", err);
      return {
        text: "喵呜…信号好像不太好，我先陪你聊点简单的～（请检查设置里的 API Key 或稍后再试）",
        source: "error",
      };
    }
  }

  window.CatChat = { reply, idleLine, cannedReply };
})();
