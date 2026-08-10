/* Earnings + work-time progress calculations. */
(function () {
  const DEFAULTS = {
    salary: 10000,
    start: "09:00",
    end: "18:00",
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
    };
  }

  function clamp(v, min, max) {
    return Math.max(min, Math.min(max, v));
  }

  function weekdayLabel(workDaysPerWeek) {
    const names = ["一", "二", "三", "四", "五", "六", "日"];
    if (workDaysPerWeek >= 7) return "周一 - 周日（天天上班）";
    return `周一 - 周${names[workDaysPerWeek - 1]}`;
  }

  window.WorkStats = { computeStats, weekdayLabel, DEFAULTS };
})();
