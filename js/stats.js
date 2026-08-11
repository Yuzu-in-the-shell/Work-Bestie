/* Earnings + work-time progress calculations. */
(function () {
  const DEFAULTS = {
    salary: 9500,
    start: "09:00",
    end: "17:00",
    workDaysPerWeek: 5,
  };

  const AVG_WEEKS_PER_MONTH = 4.345;

  function parseTime(str) {
    const [h, m] = str.split(":").map(Number);
    return { h, m };
  }

  function todayAt(str) {
    const { h, m } = parseTime(str);
    const d = new Date();
    d.setHours(h, m, 0, 0);
    return d;
  }

  // Monday=0 ... Sunday=6
  function weekdayIndex(date) {
    return (date.getDay() + 6) % 7;
  }

  function isWorkday(date, workDaysPerWeek) {
    return weekdayIndex(date) < workDaysPerWeek;
  }

  function computeStats(settings) {
    const now = new Date();
    const start = todayAt(settings.start);
    const end = todayAt(settings.end);
    const totalMs = Math.max(end - start, 1);

    const workToday = isWorkday(now, settings.workDaysPerWeek);
    const dayFraction = workToday ? clamp((now - start) / totalMs, 0, 1) : 0;

    const dailySalary = settings.salary / (settings.workDaysPerWeek * AVG_WEEKS_PER_MONTH);
    const earnings = workToday ? dailySalary * dayFraction : 0;
    const dayPercent = workToday ? dayFraction * 100 : 0;

    const wdIndex = weekdayIndex(now); // 0=Mon
    const completedWorkdays = wdIndex >= settings.workDaysPerWeek
      ? settings.workDaysPerWeek // weekend: week's work is fully done
      : wdIndex + dayFraction;
    const weekPercent = clamp((completedWorkdays / settings.workDaysPerWeek) * 100, 0, 100);

    return {
      earnings,
      dayPercent: clamp(dayPercent, 0, 100),
      weekPercent,
      workToday,
      isBeforeStart: workToday && now < start,
      isAfterEnd: workToday && now > end,
      hour: now.getHours(),
      minute: now.getMinutes(),
      weekdayIndex: wdIndex,
      minutesToEnd: Math.round((end - now) / 60000),
      minutesSinceStart: Math.round((now - start) / 60000),
      isLastWorkday: wdIndex === settings.workDaysPerWeek - 1,
    };
  }

  /* Coarse label for "where in the workday are we", used to make both the
   * canned lines and the AI prompt aware of the moment. */
  function phaseOf(stats) {
    if (!stats.workToday) return "offday";
    if (stats.isBeforeStart) return "before";
    if (stats.isAfterEnd) return "after";
    if (stats.minutesToEnd <= 45) return "endgame";
    if (stats.minutesSinceStart <= 45) return "early";
    if (stats.hour >= 12 && stats.hour < 14) return "lunch";
    if (stats.dayPercent >= 45 && stats.dayPercent <= 55) return "halfway";
    if (stats.hour >= 14 && stats.hour < 16) return "afternoonslump";
    return "midday";
  }

  const WEEKDAY_NAMES = ["周一", "周二", "周三", "周四", "周五", "周六", "周日"];

  function formatRemaining(minutes) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    if (h <= 0) return `${m}分钟`;
    return m > 0 ? `${h}小时${m}分钟` : `${h}小时`;
  }

  function buildContext(settings, stats) {
    const s = stats || computeStats(settings);
    const hh = String(s.hour).padStart(2, "0");
    const mm = String(s.minute).padStart(2, "0");

    const lines = [
      `现在时间：${WEEKDAY_NAMES[s.weekdayIndex]} ${hh}:${mm}`,
      `工作时间设定：${settings.start} - ${settings.end}，每周上 ${settings.workDaysPerWeek} 天`,
    ];

    if (!s.workToday) {
      lines.push("今天是休息日，用户不用上班。");
    } else if (s.isBeforeStart) {
      lines.push("还没到上班时间，用户可能刚起床或在通勤。");
    } else if (s.isAfterEnd) {
      lines.push(`已经过了下班时间，用户今天赚了 $${s.earnings.toFixed(2)}，如果还在这里说明可能在加班。`);
    } else {
      const remain = formatRemaining(s.minutesToEnd);
      lines.push(
        `用户正在上班中：今天已完成 ${s.dayPercent.toFixed(0)}%，距离下班还有 ${remain}。`,
        `今天已赚到 $${s.earnings.toFixed(2)}，本周进度 ${s.weekPercent.toFixed(0)}%。`
      );
      if (s.isLastWorkday) lines.push("今天是本周最后一个工作日，熬过今天就放假了。");
    }

    return { ...s, phase: phaseOf(s), summary: lines.join("\n") };
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function weekdayLabel(workDaysPerWeek) {
    const names = ["一", "二", "三", "四", "五", "六", "日"];
    if (workDaysPerWeek >= 7) return "周一 - 周日（天天上班）";
    return `周一 - 周${names[workDaysPerWeek - 1]}`;
  }

  window.WorkStats = { computeStats, buildContext, weekdayLabel, formatRemaining, DEFAULTS };
})();
