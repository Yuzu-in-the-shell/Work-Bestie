/* Chat: calls OpenAI directly from the browser if the user supplied an API
 * key (stored only in localStorage), otherwise falls back to a canned line
 * bank so the app is fully usable with zero configuration.
 *
 * Both paths are context-aware: they get a snapshot of where the user is in
 * their workday (time left, earnings, progress) so the cat can say something
 * that actually fits the moment instead of a generic platitude. */
(function () {
  /* ---------- Idle bubble lines, keyed by workday phase ---------- */
  const IDLE_BY_PHASE = {
    offday: [
      "今天不用上班，好好躺平吧～",
      "休息日就该睡到自然醒，喵。",
      "放假啦！要不要一起晒太阳？",
      "今天没有班要上，开心！",
    ],
    before: [
      "还没到上班时间呢，再赖一会儿也没关系～",
      "早呀～先喝口水再开始吧。",
      "今天也要慢慢来，不急不急。",
      "开工前先深呼吸一下，喵。",
    ],
    early: [
      "刚开始呢，先把最难的事做掉吧～",
      "早上脑子最清醒，加油喵！",
      "今天的第一杯水喝了吗？",
      "慢慢进入状态就好，我陪着你。",
    ],
    midday: [
      "工作再忙，也要记得喝水呀～",
      "我在这里陪着你呢，喵～",
      "深呼吸～休息一下眼睛吧。",
      "偷偷告诉你，摸鱼五分钟不算过分～",
      "坐久了记得起来动一动哦。",
      "今天的你也超棒的！",
    ],
    halfway: [
      "已经过半啦！下半场轻松一点～",
      "一半了一半了，胜利在望喵！",
      "过半场啦，奖励自己一杯咖啡？",
    ],
    lunch: [
      "到饭点啦！去吃点好吃的吧～",
      "咕噜咕噜…我也饿了，一起吃饭嘛？",
      "吃完饭记得眯一会儿，下午才有精神。",
      "别忘了吃饭呀，工作不能空腹！",
    ],
    afternoonslump: [
      "下午最容易犯困了，起来走两步？",
      "困了就眯五分钟，喵～",
      "来杯咖啡续命吧！",
      "撑住撑住，快熬过去了。",
    ],
    endgame: [
      "快下班啦！最后冲刺一下～",
      "曙光就在前面了，喵！",
      "马上解放，再坚持一下下！",
      "收拾收拾准备下班咯～",
    ],
    after: [
      "已经过了下班时间啦，别太拼哦。",
      "该走啦！工作是做不完的，人是会累的。",
      "下班时间到，喵！快回家吧～",
      "加班要有限度呀，答应我早点休息。",
    ],
  };

  /* Reactions to being poked/petted, mixed into the bubble on cat clicks. */
  const POKE_LINES = [
    "喵！被你戳到了～",
    "呼噜呼噜…再摸摸嘛。",
    "干嘛呀，人家在认真上班呢（并没有）",
    "喵呜～痒痒的！",
    "戳一下我就跳一下，好玩吧？",
    "别闹啦，专心工作！…好吧再戳一下也行。",
    "尾巴甩甩，表示很开心～",
    "喵？有什么事吗？还是只想摸我？",
    "被摸到了，今天的能量补满啦！",
    "嘿嘿，我最喜欢被戳了。",
    "再戳我就要翻肚皮了哦～",
    "喵喵喵！（快乐地转圈）",
    "手感不错吧？我可是每天都梳毛的。",
    "工作累了就来撸我，随时营业～",
  ];

  /* ---------- Keyword-matched replies ---------- */
  const CANNED = {
    tired: [
      "辛苦啦，靠在我身上休息一下下吧～",
      "累了就伸个懒腰，喵～我陪你歇会儿。",
      "工作使我快乐（骗你的），一起摸鱼五分钟吧。",
      "闭上眼睛数三下，我在旁边守着你。",
      "累是正常的，你已经做得够多了。",
    ],
    happy: [
      "看你这么开心，我尾巴都翘起来啦！",
      "耶！那我们一起开心一下～ ٩(ˊᗜˋ*)و",
      "好耶！这种时刻值得多摸我两下。",
      "你开心我就开心，喵～",
    ],
    sad: [
      "抱抱你，一切都会好起来的喵～",
      "别难过啦，我把肚肚给你摸～",
      "不开心的话，跟我说说呗，我一直在听。",
      "难受就难受一会儿，不用急着好起来。",
      "我不太会安慰人，但我会一直在这里。",
    ],
    encourage: [
      "加油！你已经很棒了，喵！",
      "别怕，慢慢来，我给你加油打气～",
      "你可以的！我对你有信心，喵～",
      "一步一步来，你比自己想的更厉害。",
    ],
    money: [
      "钱钱在慢慢变多哦，安心搬砖～",
      "工资是一点一点攒出来的，喵～坚持住！",
      "每一秒都在进账，想想是不是好受一点？",
      "打工人的快乐，就是看数字往上跳～",
    ],
    hungry: [
      "咕噜咕噜～我也饿了，记得按时吃饭呀！",
      "喵！去吃点东西吧，工作不能空腹哦。",
      "吃饭最大！先去，工作等你回来。",
    ],
    greeting: [
      "喵～你来啦！今天想聊点什么呀？",
      "有什么想跟我说的吗？我竖起耳朵听着呢～",
      "嗨～我一直在这儿等你呢。",
    ],
    work: [
      "又是需求又是会议，辛苦你了喵…",
      "工作的事慢慢来，一件一件解决。",
      "深呼吸，这个也会过去的。",
      "先列个清单吧，脑子里装太多会炸的。",
    ],
    boss: [
      "喵！我帮你挠他（小声）",
      "忍一忍，下班就自由了。",
      "别往心里去，你已经做得很好了。",
    ],
    overtime: [
      "又加班呀…要不要先吃口东西？",
      "加班归加班，别熬太晚，答应我。",
      "陪你一起熬，喵。",
    ],
    coffee: [
      "咖啡续命！不过别喝太多哦～",
      "喝完提提神，我们继续～",
      "记得也喝点水，不然会渴的喵。",
    ],
    bored: [
      "无聊的话，摸摸我呀～",
      "要不要看我转个圈？（转不动）",
      "偶尔发发呆也挺好的，喵。",
    ],
    weekend: [
      "周末快到啦！撑住～",
      "想想周末要干嘛，是不是有动力了？",
      "放假的味道我已经闻到了，喵！",
    ],
    catlove: [
      "喵呜～被夸了，尾巴翘起来！",
      "嘿嘿，我也很喜欢你呀～",
      "摸摸摸，随便摸，我最喜欢这个了。",
      "被你这么说，我今天可以多干一小时（并不会）",
    ],
    thanks: [
      "不客气喵～这是我的工作（陪你）",
      "嘿嘿，能帮上忙就好～",
      "跟我还客气什么呀。",
    ],
    bye: [
      "下班啦！路上小心，明天见喵～",
      "辛苦一天啦，好好休息！",
      "走咯走咯，别回头看工作了。",
    ],
    sleepy: [
      "困了就眯一会儿，我帮你看着门。",
      "打个盹吧，五分钟也好，喵。",
      "熬夜不好哦，早点睡～",
    ],
    default: [
      "嗯嗯，我在听呢，继续说～",
      "喵呜～有你在，工作也没那么无聊了。",
      "摸摸下巴，今天心情怎么样呀？",
      "原来是这样呀，喵。",
      "我不太懂，但我陪着你。",
      "说吧说吧，我竖着耳朵听～",
    ],
  };

  /* Order matters: earlier patterns win. */
  const KEYWORD_MAP = [
    [/加班|通宵|做不完|赶工|deadline|ddl/i, "overtime"],
    [/老板|领导|甲方|客户|同事|pua/i, "boss"],
    [/开会|会议|需求|项目|报告|方案|代码|bug|ppt|excel/i, "work"],
    [/咖啡|奶茶|coffee|拿铁|美式/i, "coffee"],
    [/困|想睡|睡觉|熬夜|失眠/, "sleepy"],
    [/累|疲惫|好烦|烦死|心累|顶不住/, "tired"],
    [/难过|emo|想哭|烦躁|崩溃|压力|焦虑|委屈/, "sad"],
    [/开心|哈哈|哈哈哈|爽|太好了|好耶|棒/, "happy"],
    [/加油|鼓励|打气|坚持|冲/, "encourage"],
    [/钱|工资|薪水|赚|发财|涨薪|奖金/, "money"],
    [/饿|吃饭|午饭|晚饭|外卖|干饭/, "hungry"],
    [/周末|放假|假期|休息日|周五/, "weekend"],
    [/无聊|好闲|没事干|摸鱼/, "bored"],
    [/可爱|好萌|喜欢你|爱你|乖|摸摸|rua|贴贴/, "catlove"],
    [/谢谢|感谢|thx|thanks/i, "thanks"],
    [/下班|走了|拜拜|再见|bye|明天见/i, "bye"],
    [/你好|嗨|hi|hello|在吗|在不在/i, "greeting"],
  ];

  /* Questions the cat can actually answer from the workday state. These run
   * before the keyword bank so "还有多久下班" gets a real number instead of
   * being mistaken for a goodbye. */
  const DYNAMIC_MAP = [
    [/还有多久|多久下班|几点下班|还要多久|什么时候下班|多长时间/, answerTimeLeft],
    [/赚了多少|多少钱|挣了多少|收入|今天赚/, answerEarnings],
    [/进度|多少了|过了多少|完成多少/, answerProgress],
  ];

  function answerTimeLeft(ctx) {
    if (!ctx) return "喵？我也不知道现在几点…";
    if (!ctx.workToday) return "今天不用上班呀，随便玩！";
    if (ctx.isBeforeStart) return "还没开始上班呢，先放松会儿～";
    if (ctx.isAfterEnd) return "早就该下班啦，你还不走？快回家喵！";
    const remain = window.WorkStats.formatRemaining(ctx.minutesToEnd);
    if (ctx.minutesToEnd <= 30) return `只剩 ${remain} 啦，胜利在望！`;
    return `还有 ${remain} 就下班咯，撑住喵～`;
  }

  function answerEarnings(ctx) {
    if (!ctx) return "钱钱在慢慢变多哦～";
    if (!ctx.workToday) return "今天休息日，不赚钱但也不累，挺好的～";
    if (ctx.earnings <= 0) return "还没开始赚呢，等上班了数字就会跳啦！";
    return `今天已经赚了 $${ctx.earnings.toFixed(2)} 啦，喵～`;
  }

  function answerProgress(ctx) {
    if (!ctx || !ctx.workToday) return "今天不用上班，进度就是 100% 的快乐！";
    if (ctx.isBeforeStart) return "还没开始呢，0%，喵。";
    return `今天走了 ${ctx.dayPercent.toFixed(0)}%，这周 ${ctx.weekPercent.toFixed(0)}% 咯～`;
  }

  /* Contextual one-liners the cat can volunteer when the user says something
   * unclassified — these reference the actual workday state. */
  function contextualDefaults(ctx) {
    if (!ctx) return [];
    const out = [];
    if (!ctx.workToday) {
      out.push("今天不用上班，说这些干嘛～放松点！", "休息日就别想工作啦，喵。");
      return out;
    }
    if (ctx.isBeforeStart) {
      out.push("还没到上班时间呢，再摸会儿鱼～");
      return out;
    }
    if (ctx.isAfterEnd) {
      out.push("都过下班点了，快回家吧！", "该下班啦，工作明天再说～");
      return out;
    }
    const remain = window.WorkStats.formatRemaining(ctx.minutesToEnd);
    out.push(`还有 ${remain} 就下班啦，撑住！`);
    out.push(`今天已经赚了 $${ctx.earnings.toFixed(2)} 咯～`);
    if (ctx.phase === "endgame") out.push("最后一点点了，冲鸭！");
    if (ctx.phase === "halfway") out.push("已经过半啦，下半场加油～");
    if (ctx.isLastWorkday) out.push("熬过今天就周末了，喵！");
    return out;
  }

  /* Avoid repeating the exact line twice in a row. */
  let lastLine = "";
  function pick(arr) {
    if (!arr || arr.length === 0) return "";
    if (arr.length === 1) return arr[0];
    let choice;
    for (let i = 0; i < 6; i++) {
      choice = arr[Math.floor(Math.random() * arr.length)];
      if (choice !== lastLine) break;
    }
    lastLine = choice;
    return choice;
  }

  function idleLine(ctx) {
    const phase = (ctx && ctx.phase) || "midday";
    const pool = IDLE_BY_PHASE[phase] || IDLE_BY_PHASE.midday;
    return pick(pool);
  }

  /* Mostly poke reactions, with the odd phase-appropriate line mixed in so
   * repeated clicking still surfaces "还有 20 分钟下班" type comments. */
  function pokeLine(ctx) {
    const phase = (ctx && ctx.phase) || "midday";
    const idle = IDLE_BY_PHASE[phase] || IDLE_BY_PHASE.midday;
    return pick(Math.random() < 0.25 ? idle : POKE_LINES);
  }

  function cannedReply(userText, ctx) {
    for (const [regex, answer] of DYNAMIC_MAP) {
      if (regex.test(userText)) return answer(ctx);
    }
    for (const [regex, key] of KEYWORD_MAP) {
      if (regex.test(userText)) return pick(CANNED[key]);
    }
    // Unmatched: mix generic filler with lines that reference the real state,
    // so the fallback still feels like it's paying attention.
    return pick([...CANNED.default, ...contextualDefaults(ctx)]);
  }

  function buildSystemPrompt(catName, ctx) {
    const parts = [
      `你是用户的宠物猫，名字叫"${catName}"，此刻正陪着用户一起上班/工作。`,
      "性格：粘人、可爱、话不多但很温暖，偶尔卖萌撒娇，喜欢用「喵」作为语气词，但不要每句话都用。",
      "任务：陪用户闲聊解闷，关心TA的工作状态、情绪、有没有喝水休息，语气轻松自然像朋友一样。",
      "回复要简短，控制在 1-2 句话以内，不要长篇大论，不要使用markdown格式。",
    ];
    if (ctx && ctx.summary) {
      parts.push(
        "",
        "【当前情况】",
        ctx.summary,
        "",
        "可以自然地把上面的情况融进对话（比如提一句还剩多久下班、今天赚了多少），但不要每句话都报数字，也不要像播报机器人。"
      );
    }
    return parts.join("\n");
  }

  async function callOpenAI({ apiKey, model, catName, history, userText, ctx }) {
    const messages = [
      { role: "system", content: buildSystemPrompt(catName, ctx) },
      ...history.slice(-12).map((m) => ({
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

  async function reply({ apiKey, model, catName, history, userText, ctx }) {
    if (!apiKey) {
      await new Promise((r) => setTimeout(r, 300 + Math.random() * 500));
      return { text: cannedReply(userText, ctx), source: "canned" };
    }
    try {
      const text = await callOpenAI({ apiKey, model, catName, history, userText, ctx });
      return { text, source: "ai" };
    } catch (err) {
      console.error("[CatChat] OpenAI call failed:", err);
      return {
        text: "喵呜…信号好像不太好，我先陪你聊点简单的～（请检查设置里的 API Key 或稍后再试）",
        source: "error",
      };
    }
  }

  window.CatChat = { reply, idleLine, pokeLine, cannedReply };
})();
