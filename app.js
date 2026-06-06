(function (root) {
  "use strict";

  let cumulativeTrueWan = 0;
  const GATES = [
    { idx: 0, name: "個人關", base: 2.2, col: "#e74c3c", bg: "#fff5f5" },
    { idx: 1, name: "家庭關", base: 8.8, col: "#e67e22", bg: "#fff8f0" },
    { idx: 2, name: "事業關", base: 22, col: "#f39c12", bg: "#fffde7" },
    { idx: 3, name: "社會關", base: 88, col: "#27ae60", bg: "#f0fff4" },
    { idx: 4, name: "國家關", base: 220, col: "#16a085", bg: "#e8fffe" },
    { idx: 5, name: "民族關", base: 880, col: "#2980b9", bg: "#eef6ff" },
    { idx: 6, name: "世界關", base: 2200, col: "#8e44ad", bg: "#f8f0ff" },
    { idx: 7, name: "世族關", base: 8800, col: "#c0392b", bg: "#fff0f0" },
    { idx: 8, name: "太空關", base: 22000, col: "#d35400", bg: "#fff4ec" },
    { idx: 9, name: "外太空關", base: 88000, col: "#1a252f", bg: "#eceff1" }
  ].map((g) => {
    const zhenMingWan = g.base * 3;
    const trueWan = g.base * 13;
    cumulativeTrueWan += trueWan;
    return {
      ...g,
      zhenMingWan,
      trueWan,
      cumulativeTrueWan,
      tier: Math.floor(g.idx / 2),
      side: g.idx % 2 === 0 ? "left" : "right"
    };
  });

  const TEAM_TIERS = [
    { label: "1:3", desc: "入門", min: 1, max: 3, col: "#74b9ff" },
    { label: "3:5", desc: "成長", min: 4, max: 5, col: "#55efc4" },
    { label: "5:8", desc: "發展", min: 6, max: 8, col: "#fdcb6e" },
    { label: "8:13", desc: "擴張", min: 9, max: 12, col: "#e17055" },
    { label: "13:1", desc: "滿編★", min: 13, max: 99, col: "#a29bfe" }
  ];

  const CYCLE_NAMES = ["小輪迴", "中輪迴", "大輪迴", "極輪迴", "極極輪迴"];
  let cumulativeCycleWan = 0;
  const CYCLES = CYCLE_NAMES.map((name, index) => {
    const lowerGate = GATES[index * 2];
    const upperGate = GATES[index * 2 + 1];
    const carryGate = index > 0 ? GATES[index * 2 - 1] : null;
    const carryCount = carryGate ? 10 : 0;
    const lowerCount = 13;
    const upperCount = 3;
    const passWan = lowerGate.base * lowerCount + upperGate.base * upperCount;
    const segmentWan = passWan + (carryGate ? carryGate.base * carryCount : 0);
    cumulativeCycleWan += segmentWan;
    return {
      idx: index,
      name,
      carryGate,
      carryCount,
      lowerGate,
      upperGate,
      lowerCount,
      upperCount,
      passWan,
      segmentWan,
      cumulativePassWan: cumulativeCycleWan,
      col: upperGate.col
    };
  });

  const STATUS_TEXT = {
    covered: "團隊真正覆蓋",
    cleared: "真正過關",
    at_zm: "真命過關",
    wip: "真命前進中"
  };

  const ZHEN_MING_UNITS = 3;
  const ZHEN_ZHENG_UNITS = 13;
  const EPSILON = 1e-9;
  const PRIMARY_GATE_COUNT = 6;
  const PRIMARY_GATES = GATES.slice(0, PRIMARY_GATE_COUNT);
  let cumulativePhaseWan = 0;
  const PHASES = [
    { idx: 0, name: "第一段數", lowerGate: GATES[0], lowerCount: 13, upperGate: GATES[1], upperCount: 3 },
    { idx: 1, name: "第二段數", lowerGate: GATES[1], lowerCount: 10, upperGate: GATES[2], upperCount: 3 },
    { idx: 2, name: "第三段數", lowerGate: GATES[2], lowerCount: 10, upperGate: GATES[3], upperCount: 3 },
    { idx: 3, name: "第四段數", lowerGate: GATES[3], lowerCount: 10, upperGate: GATES[4], upperCount: 3 },
    { idx: 4, name: "第五段數", lowerGate: GATES[4], lowerCount: 10, upperGate: GATES[5], upperCount: 3, upperBase: 220 }
  ].map((phase) => {
    const lowerBase = phase.lowerBase || phase.lowerGate.base;
    const upperBase = phase.upperBase || phase.upperGate.base;
    const segmentWan = lowerBase * phase.lowerCount + upperBase * phase.upperCount;
    const previousPassWan = cumulativePhaseWan;
    cumulativePhaseWan += segmentWan;
    return {
      ...phase,
      lowerBase,
      upperBase,
      segmentWan,
      previousPassWan,
      passWan: cumulativePhaseWan,
      col: phase.upperGate.col
    };
  });

  const DEFAULT_SETTINGS = {
    viewMode: "leader",
    selectedMemberId: null,
    leaderCycleBasis: "sum",
    teamCycleBasis: "coverage"
  };

  const DEFAULT_STATE = {
    settings: { ...DEFAULT_SETTINGS, selectedMemberId: 1 },
    leader: {
      name: "隊長",
      unitCounts: PRIMARY_GATES.map((gate) => ({ gateIdx: gate.idx, v: "" })),
      amounts: [{ id: 1, v: "" }]
    },
    members: []
  };

  const EXAMPLE_STATE = {
    settings: { ...DEFAULT_SETTINGS, selectedMemberId: null },
    leader: {
      name: "隊長",
      unitCounts: unitCountsFromWan(660),
      amounts: [{ id: 1, v: "660" }]
    },
    members: []
  };

  const STORAGE_KEY = "rank-pyramid-v1";

  function toWan(raw) {
    const text = normalizeAmountText(raw);
    if (!text) return 0;

    const hasYi = /[億亿]/.test(text);
    const hasWan = /[萬万]/.test(text);
    const hasYuan = /元/.test(text);

    if (hasYi || hasWan || hasYuan) {
      return amountTextToWan(text);
    }

    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
  }

  function toCount(raw) {
    const text = normalizeAmountText(raw);
    if (!text) return 0;
    const n = Number(text);
    if (!Number.isFinite(n) || n <= 0) return 0;
    return n;
  }

  function normalizeAmountText(raw) {
    return String(raw ?? "")
      .trim()
      .replace(/[０-９]/g, (char) => String.fromCharCode(char.charCodeAt(0) - 0xfee0))
      .replace(/．/g, ".")
      .replace(/[，,]/g, "")
      .replace(/\s+/g, "")
      .replace(/(?:NTD|TWD|NT\$|台幣|新台幣|\$)/gi, "");
  }

  function amountTextToWan(text) {
    let total = 0;
    let rest = text;

    rest = rest.replace(/([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)([億亿])/gi, (_match, value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) total += n * 10000;
      return "";
    });

    rest = rest.replace(/([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)([萬万])/gi, (_match, value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) total += n;
      return "";
    });

    rest = rest.replace(/([+-]?\d+(?:\.\d+)?(?:e[+-]?\d+)?)(元)/gi, (_match, value) => {
      const n = Number(value);
      if (Number.isFinite(n) && n > 0) total += n / 10000;
      return "";
    });

    const tail = Number(rest);
    if (Number.isFinite(tail) && tail > 0) total += tail;
    return total;
  }

  function gateFor(wan) {
    if (wan <= 0) return null;
    let result = null;
    for (const gate of GATES) {
      if (wan >= gate.base) result = gate;
      else break;
    }
    return result;
  }

  function teamTierFor(n) {
    return TEAM_TIERS.find((tier) => n >= tier.min && n <= tier.max) || null;
  }

  function maxWanOf(amounts) {
    return amounts.reduce((max, amount) => Math.max(max, toWan(amount.v)), 0);
  }

  function sumWanOf(amounts) {
    return amounts.reduce((sum, amount) => sum + toWan(amount.v), 0);
  }

  function leaderTotalWanFromUnitCounts(unitCounts) {
    return ensureUnitCounts(unitCounts).reduce((sum, item) => {
      const gate = GATES.find((candidate) => candidate.idx === Number(item.gateIdx));
      if (!gate) return sum;
      return sum + toCount(item.v) * gate.base;
    }, 0);
  }

  function unitCountsFromWan(wan) {
    let remaining = Math.max(0, Number(wan) || 0);
    return PRIMARY_GATES.map((gate, index) => {
      const isLastGate = index === PRIMARY_GATES.length - 1;
      const units = isLastGate
        ? remaining / gate.base
        : Math.min(ZHEN_ZHENG_UNITS, remaining / gate.base);
      remaining = Math.max(0, remaining - units * gate.base);
      return {
        gateIdx: gate.idx,
        v: units > EPSILON ? fmtUnitInput(units) : ""
      };
    });
  }

  function ensureUnitCounts(unitCounts, fallbackAmounts) {
    if (!Array.isArray(unitCounts) || unitCounts.length === 0) {
      return unitCountsFromWan(sumWanOf(ensureAmounts(fallbackAmounts)));
    }

    const byGate = new Map(unitCounts.map((item) => [Number(item.gateIdx), item]));
    return PRIMARY_GATES.map((gate) => {
      const item = byGate.get(gate.idx);
      return {
        gateIdx: gate.idx,
        v: item?.v ?? ""
      };
    });
  }

  function leaderAmountsFromUnitCounts(unitCounts) {
    const total = leaderTotalWanFromUnitCounts(unitCounts);
    return [{ id: "leader-unit-total", v: total > EPSILON ? String(total) : "" }];
  }

  function atLeast(value, target) {
    return value + EPSILON >= target;
  }

  function countProgressForUnits(rawUnits) {
    const units = Math.max(0, Number(rawUnits) || 0);
    const cappedUnits = Math.min(ZHEN_ZHENG_UNITS, units);
    return {
      units: cappedUnits,
      zhenMing: {
        done: Math.min(ZHEN_MING_UNITS, cappedUnits),
        total: ZHEN_MING_UNITS,
        missing: Math.max(0, ZHEN_MING_UNITS - cappedUnits)
      },
      zhenZheng: {
        done: cappedUnits,
        total: ZHEN_ZHENG_UNITS,
        missing: Math.max(0, ZHEN_ZHENG_UNITS - cappedUnits)
      }
    };
  }

  function countProgressForWan(wan, gate) {
    if (!gate?.base) return countProgressForUnits(0);
    return countProgressForUnits((Number(wan) || 0) / gate.base);
  }

  function phaseStatusFor(wan) {
    const amount = Math.max(0, Number(wan) || 0);
    return PHASES.map((phase) => {
      const inPhaseWan = Math.max(0, amount - phase.previousPassWan);
      const appliedWan = Math.min(phase.segmentWan, inPhaseWan);
      return {
        phase,
        amount,
        inPhaseWan,
        appliedWan,
        passed: atLeast(amount, phase.passWan),
        progress: phase.segmentWan > 0 ? Math.min(1, appliedWan / phase.segmentWan) : 0,
        missing: Math.max(0, phase.passWan - amount)
      };
    });
  }

  function cycleProgressAt(wan, cycle) {
    const amount = Math.max(0, Number(wan) || 0);
    const previousWan = CYCLES[cycle.idx - 1]?.cumulativePassWan || 0;
    const inCycleWan = Math.max(0, amount - previousWan);
    const appliedWan = Math.min(cycle.segmentWan, inCycleWan);
    const progress = cycle.segmentWan > 0 ? Math.min(1, appliedWan / cycle.segmentWan) : 0;
    return {
      amount,
      cycle,
      previousWan,
      inCycleWan,
      appliedWan,
      passed: amount >= cycle.cumulativePassWan,
      progress,
      remaining: Math.max(0, cycle.cumulativePassWan - amount),
      overflowWan: Math.max(0, amount - cycle.cumulativePassWan)
    };
  }

  function cycleStatusFor(wan) {
    const amount = Math.max(0, Number(wan) || 0);
    const lastCycle = CYCLES[CYCLES.length - 1];
    const cleared = CYCLES.filter((cycle) => amount >= cycle.cumulativePassWan).at(-1) || null;
    const allCleared = amount >= lastCycle.cumulativePassWan;
    const current = allCleared ? lastCycle : CYCLES.find((cycle) => amount < cycle.cumulativePassWan);
    const currentProgress = cycleProgressAt(amount, current);

    return {
      amount,
      cleared,
      current,
      allCleared,
      progress: currentProgress.progress,
      remaining: currentProgress.remaining,
      inCycleWan: currentProgress.inCycleWan,
      appliedWan: currentProgress.appliedWan,
      overflowWan: currentProgress.overflowWan
    };
  }

  function cycleRequirementsFor(cycle) {
    return [
      cycle.carryGate ? { gate: cycle.carryGate, count: cycle.carryCount } : null,
      { gate: cycle.lowerGate, count: cycle.lowerCount },
      { gate: cycle.upperGate, count: cycle.upperCount }
    ].filter(Boolean);
  }

  function cycleStatusForTeamCoverage(positions) {
    const counts = {};
    positions.forEach((member) => {
      if (!member.gate) return;
      counts[member.gate.idx] = (counts[member.gate.idx] || 0) + 1;
    });

    const available = { ...counts };
    const rows = [];
    let cleared = null;
    let current = null;
    let currentProgress = null;

    for (const cycle of CYCLES) {
      const requirements = cycleRequirementsFor(cycle);
      const missing = [];
      let appliedWan = 0;
      let remaining = 0;

      requirements.forEach(({ gate, count }) => {
        const have = available[gate.idx] || 0;
        const used = Math.min(have, count);
        const lack = Math.max(0, count - have);
        appliedWan += used * gate.base;
        remaining += lack * gate.base;
        missing.push({ gate, count, have, used, missing: lack });
      });

      const passed = missing.every((item) => item.missing === 0);
      const progress = cycle.segmentWan > 0 ? Math.min(1, appliedWan / cycle.segmentWan) : 0;
      const row = {
        kind: "coverage",
        amount: appliedWan,
        cycle,
        requirements,
        missing,
        passed,
        progress,
        appliedWan,
        remaining,
        overflowWan: 0
      };

      rows.push({ cycle, progress: row });

      if (passed) {
        requirements.forEach(({ gate, count }) => {
          available[gate.idx] = Math.max(0, (available[gate.idx] || 0) - count);
        });
        cleared = cycle;
      } else if (!current) {
        current = cycle;
        currentProgress = row;
      }
    }

    const lastCycle = CYCLES[CYCLES.length - 1];
    const allCleared = cleared?.idx === lastCycle.idx;
    const finalProgress = currentProgress || rows.at(-1)?.progress;

    return {
      kind: "coverage",
      counts,
      rows,
      amount: finalProgress?.appliedWan || 0,
      cleared,
      current: current || lastCycle,
      allCleared,
      progress: finalProgress?.progress || 0,
      remaining: allCleared ? 0 : finalProgress?.remaining || 0,
      missing: allCleared ? [] : finalProgress?.missing || [],
      appliedWan: finalProgress?.appliedWan || 0,
      overflowWan: 0
    };
  }

  function fmt(value) {
    const n = Number(value);
    if (Number.isNaN(n)) return "—";
    if (n >= 10000) return `${parseFloat((n / 10000).toFixed(3))}億`;
    if (n === Math.floor(n)) return `${n.toLocaleString()}萬`;
    return `${parseFloat(n.toFixed(2))}萬`;
  }

  function memberPositions(members) {
    return members.map((member, index) => {
      const wan = maxWanOf(member.amounts || []);
      return {
        ...member,
        idx: index,
        wan,
        gate: gateFor(wan),
        cycle: cycleStatusFor(wan)
      };
    });
  }

  function teamWanOf(positions) {
    return positions.reduce((sum, member) => sum + member.wan, 0);
  }

  function teamCoverage(members) {
    const counts = {};
    memberPositions(members).forEach((member) => {
      if (!member.gate) return;
      counts[member.gate.name] = (counts[member.gate.name] || 0) + 1;
    });
    return counts;
  }

  function calcCascade(leaderAmts, members, gates = GATES) {
    const leaderWan = sumWanOf(leaderAmts);
    if (leaderWan <= 0) return { steps: [], leaderWan: 0, tc: {} };

    const tc = teamCoverage(members);
    let rem = leaderWan;
    const steps = [];

    for (const gate of gates) {
      const cnt = tc[gate.name] || 0;
      const tAmt = cnt * gate.base;
      const zz = gate.base * 13;
      const zm = gate.base * 3;
      const zmNeed = Math.max(0, zm - tAmt);
      const zzNeed = Math.max(0, zz - tAmt);

      if (atLeast(tAmt, zz)) {
        steps.push({ g: gate, status: "covered", cnt, tAmt, zz, zm, zmNeed, zzNeed, target: "zz", targetNeed: 0, gap: 0, rem });
        continue;
      }

      if (atLeast(rem, zzNeed)) {
        rem -= zzNeed;
        steps.push({ g: gate, status: "cleared", cnt, tAmt, zz, zm, need: zzNeed, zmNeed, zzNeed, target: "zz", targetNeed: zzNeed, gap: 0, rem });
      } else {
        const combined = rem + tAmt;
        const reachedZm = atLeast(combined, zm);
        const target = reachedZm ? "zz" : "zm";
        const targetNeed = target === "zz" ? zzNeed : zmNeed;
        const targetTotal = target === "zz" ? zz : zm;
        steps.push({
          g: gate,
          status: reachedZm ? "at_zm" : "wip",
          cnt,
          tAmt,
          zz,
          zm,
          zmNeed,
          zzNeed,
          target,
          targetNeed,
          gap: Math.max(0, targetTotal - combined),
          combined,
          rem,
          pct: targetTotal > 0 ? combined / targetTotal : 0
        });
        break;
      }
    }

    const last = steps.filter((step) => step.status === "cleared" || step.status === "covered").at(-1);
    const curr = steps.find((step) => step.status === "at_zm" || step.status === "wip");
    return { steps, last, curr, leaderWan, tc };
  }

  function xianGate(last, curr, gates = GATES) {
    if (!curr) return last ? last.g : null;
    if (curr.status === "at_zm") {
      const currentIndex = gates.findIndex((gate) => gate.idx === curr.g.idx);
      return gates[Math.min(Math.max(0, currentIndex + 1), gates.length - 1)];
    }
    return curr.g;
  }

  function teamHighGateIdx(positions) {
    return positions.reduce((max, member) => {
      if (!member.gate) return max;
      return Math.max(max, member.gate.idx);
    }, -1);
  }

  function shiGate(xian, teamHighIdx, gates = GATES) {
    if (!xian) return null;
    if (teamHighIdx < 0) return xian;
    const cap = Math.min(teamHighIdx + 2, gates.at(-1)?.idx ?? GATES.length - 1);
    const real = Math.min(xian.idx, cap);
    return real >= 0 ? (gates.find((gate) => gate.idx === real) || GATES[real] || null) : null;
  }

  function zone(gIdx, shiIdx, xianIdx) {
    if (shiIdx >= 0 && gIdx <= shiIdx) return 0;
    if (xianIdx >= 0 && gIdx <= xianIdx) return 1;
    return 2;
  }

  function analyze(state) {
    const members = state.members || [];
    const settings = normalizeSettings(state.settings, members);
    const activeGates = state.primaryOnly ? PRIMARY_GATES : GATES;
    const cascade = calcCascade(state.leader.amounts || [], members, activeGates);
    const positions = memberPositions(members);
    const effectiveCount = positions.filter((member) => member.wan > 0).length;
    const teamTier = teamTierFor(effectiveCount);
    const teamWan = teamWanOf(positions);
    const leaderCycleWan = settings.leaderCycleBasis === "max"
      ? maxWanOf(state.leader.amounts || [])
      : cascade.leaderWan;
    const xian = xianGate(cascade.last, cascade.curr, activeGates);
    const highIdx = teamHighGateIdx(positions);
    const shi = shiGate(xian, highIdx, activeGates);
    const leaderCycle = cycleStatusFor(leaderCycleWan);
    const teamAmountCycle = cycleStatusFor(teamWan);
    const teamCoverageCycle = cycleStatusForTeamCoverage(positions);
    const teamCycle = settings.teamCycleBasis === "amount" ? teamAmountCycle : teamCoverageCycle;
    const phaseRows = phaseStatusFor(cascade.leaderWan);
    const cycleRows = CYCLES.map((cycle) => ({
      cycle,
      leader: cycleProgressAt(leaderCycleWan, cycle),
      team: settings.teamCycleBasis === "amount"
        ? cycleProgressAt(teamWan, cycle)
        : teamCoverageCycle.rows.find((row) => row.cycle.idx === cycle.idx)?.progress
    }));

    const leaderPersonalGate = gateFor(maxWanOf(state.leader.amounts));
    const selectedMember = positions.find((member) => String(member.id) === String(settings.selectedMemberId)) || positions[0] || null;

    return {
      ...cascade,
      settings,
      positions,
      selectedMember,
      effectiveCount,
      teamTier,
      teamWan,
      leaderCycleWan,
      leaderCycle,
      teamAmountCycle,
      teamCoverageCycle,
      teamCycle,
      phaseRows,
      cycleRows,
      xian,
      xianInProgress: cascade.curr?.status === "wip",
      teamHighIdx: highIdx,
      shi,
      leaderPersonalGate
    };
  }

  function normalizeSettings(settings, members = []) {
    const clean = { ...DEFAULT_SETTINGS, ...(settings || {}) };
    if (!["leader", "member"].includes(clean.viewMode)) clean.viewMode = DEFAULT_SETTINGS.viewMode;
    if (!["sum", "max"].includes(clean.leaderCycleBasis)) clean.leaderCycleBasis = DEFAULT_SETTINGS.leaderCycleBasis;
    if (!["coverage", "amount"].includes(clean.teamCycleBasis)) clean.teamCycleBasis = DEFAULT_SETTINGS.teamCycleBasis;

    const ids = members.map((member) => String(member.id));
    if (!ids.includes(String(clean.selectedMemberId))) {
      clean.selectedMemberId = members[0]?.id ?? null;
    }

    return clean;
  }

  function cloneState(state) {
    return JSON.parse(JSON.stringify(state));
  }

  const core = {
    GATES,
    PRIMARY_GATES,
    PHASES,
    CYCLES,
    TEAM_TIERS,
    STATUS_TEXT,
    ZHEN_MING_UNITS,
    ZHEN_ZHENG_UNITS,
    DEFAULT_STATE,
    DEFAULT_SETTINGS,
    toWan,
    toCount,
    gateFor,
    teamTierFor,
    maxWanOf,
    sumWanOf,
    ensureUnitCounts,
    leaderTotalWanFromUnitCounts,
    unitCountsFromWan,
    leaderAmountsFromUnitCounts,
    countProgressForUnits,
    countProgressForWan,
    phaseStatusFor,
    cycleProgressAt,
    cycleStatusFor,
    cycleStatusForTeamCoverage,
    cycleRequirementsFor,
    memberPositions,
    teamWanOf,
    calcCascade,
    xianGate,
    teamHighGateIdx,
    shiGate,
    zone,
    fmt,
    analyze,
    cloneState
  };

  if (typeof module !== "undefined" && module.exports) {
    module.exports = core;
  }

  root.RankPyramidCore = core;

  if (typeof document === "undefined") return;

  let state = loadState();
  let renderQueued = false;
  let needsInputRender = false;

  const els = {
    form: document.getElementById("rankForm"),
    viewerMember: document.getElementById("viewerMember"),
    leaderName: document.getElementById("leaderName"),
    leaderUnitCounts: document.getElementById("leaderUnitCounts"),
    leaderAmounts: document.getElementById("leaderAmounts"),
    members: document.getElementById("members"),
    statusOverview: document.getElementById("statusOverview"),
    summary: document.getElementById("summary"),
    mobileStatus: document.getElementById("mobileStatus"),
    phaseLights: document.getElementById("phaseLights"),
    gateStepper: document.getElementById("gateStepper"),
    actionList: document.getElementById("actionList"),
    waterfall: document.getElementById("waterfall"),
    pyramidHeading: document.getElementById("pyramidHeading"),
    pyramid: document.getElementById("pyramid"),
    cycleRows: document.getElementById("cycleRows"),
    cascadeRows: document.getElementById("cascadeRows"),
    memberRows: document.getElementById("memberRows"),
    memberPanelTitle: document.getElementById("memberPanelTitle"),
    amountTemplate: document.getElementById("amountTemplate"),
    memberTemplate: document.getElementById("memberTemplate"),
    resetExample: document.getElementById("resetExample")
  };

  function loadState() {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) return normalizeState(JSON.parse(saved));
    } catch (error) {
      console.warn("Failed to load saved state", error);
    }
    return cloneState(DEFAULT_STATE);
  }

  function saveState() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function normalizeState(nextState) {
    const clean = cloneState(nextState || DEFAULT_STATE);
    clean.leader = clean.leader || cloneState(DEFAULT_STATE.leader);
    clean.leader.name = clean.leader.name || "隊長";
    clean.leader.amounts = ensureAmounts(clean.leader.amounts);
    clean.leader.unitCounts = ensureUnitCounts(clean.leader.unitCounts, clean.leader.amounts);
    clean.leader.amounts = leaderAmountsFromUnitCounts(clean.leader.unitCounts);
    clean.members = (clean.members || []).slice(0, 13).map((member, index) => ({
      id: member.id || Date.now() + index,
      name: member.name || `隊員 ${index + 1}`,
      amounts: ensureAmounts(member.amounts)
    }));
    clean.settings = normalizeSettings(clean.settings, clean.members);
    return clean;
  }

  function ensureAmounts(amounts) {
    if (!Array.isArray(amounts) || amounts.length === 0) return [{ id: Date.now(), v: "" }];
    return amounts.map((amount, index) => ({
      id: amount.id || Date.now() + index,
      v: amount.v ?? ""
    }));
  }

  function scheduleRender(options = {}) {
    needsInputRender = needsInputRender || Boolean(options.inputs);
    if (renderQueued) return;
    renderQueued = true;
    window.setTimeout(() => {
      renderQueued = false;
      saveState();
      if (needsInputRender) {
        needsInputRender = false;
        render();
        return;
      }
      renderResults();
    }, 0);
  }

  function render() {
    renderInputs();
    renderResults();
  }

  function renderResults() {
    const result = analyze(currentAnalysisState());
    document.body.dataset.viewMode = result.settings.viewMode;
    renderStatusOverview(result);
    renderSummary(result);
    renderPhaseLights(result);
    renderGateStepper(result);
    renderActionList(result);
    renderWaterfall(result);
    renderMobileStatus(result);
    renderMemberInlineStatus(result);
    renderPyramid(result);
    renderCycles(result);
    renderCascade(result);
    renderMembers(result);
  }

  function currentAnalysisState() {
    const next = normalizeState(state);
    next.primaryOnly = true;
    next.members = [];
    next.settings = {
      ...normalizeSettings(next.settings, []),
      viewMode: "leader",
      leaderCycleBasis: "sum",
      teamCycleBasis: "amount",
      selectedMemberId: null
    };
    next.leader.amounts = leaderAmountsFromUnitCounts(next.leader.unitCounts);
    return next;
  }

  function renderInputs() {
    renderSettingsControls();
    if (document.activeElement !== els.leaderName) {
      els.leaderName.value = state.leader.name;
    }
    renderLeaderUnitCounts();
    renderMemberList();
  }

  function renderSettingsControls() {
    state.settings = normalizeSettings(state.settings, state.members);
    document.querySelectorAll("[data-setting]").forEach((input) => {
      input.checked = state.settings[input.dataset.setting] === input.value;
    });

    const active = document.activeElement;
    if (els.viewerMember && active !== els.viewerMember) {
      els.viewerMember.replaceChildren();
      state.members.forEach((member, index) => {
        const option = document.createElement("option");
        option.value = String(member.id);
        option.textContent = member.name || `隊員 ${index + 1}`;
        option.selected = String(member.id) === String(state.settings.selectedMemberId);
        els.viewerMember.append(option);
      });
      els.viewerMember.disabled = state.members.length === 0;
    }
  }

  function renderLeaderUnitCounts() {
    if (!els.leaderUnitCounts) return;
    state.leader.unitCounts = ensureUnitCounts(state.leader.unitCounts, state.leader.amounts);

    const active = document.activeElement;
    const activeKey = active?.dataset?.key;
    els.leaderUnitCounts.replaceChildren();

    state.leader.unitCounts.forEach((item) => {
      const gate = GATES.find((candidate) => candidate.idx === Number(item.gateIdx));
      if (!gate) return;

      const label = document.createElement("label");
      const key = `leader-unit-${gate.idx}`;
      label.className = "unit-count-field";
      label.innerHTML = `
        <span>${escapeHtml(gate.name.replace("關", ""))}</span>
        <small>${escapeHtml(fmt(gate.base))} / 單位</small>
      `;

      const input = document.createElement("input");
      input.type = "text";
      input.inputMode = "decimal";
      input.placeholder = "0";
      input.value = item.v;
      input.dataset.key = key;
      input.dataset.leaderUnit = String(gate.idx);
      input.setAttribute("aria-label", `${gate.name}${fmt(gate.base)}單位數`);

      label.append(input);
      els.leaderUnitCounts.append(label);
    });

    if (activeKey) {
      const restored = els.leaderUnitCounts.querySelector(`input[data-key="${cssEscape(activeKey)}"]`);
      if (restored) {
        restored.focus();
        setCursorToEnd(restored);
      }
    }
  }

  function renderAmountList(container, amounts, scope, memberId) {
    const active = document.activeElement;
    const activeKey = active?.dataset?.key;
    container.replaceChildren();

    amounts.forEach((amount) => {
      const fragment = els.amountTemplate.content.cloneNode(true);
      const row = fragment.querySelector(".amount-row");
      const input = fragment.querySelector(".amount-input");
      const remove = fragment.querySelector(".remove-amount");
      const key = `${scope}-${memberId || "leader"}-${amount.id}`;

      input.value = amount.v;
      input.dataset.key = key;
      input.dataset.scope = scope;
      input.dataset.amountId = String(amount.id);
      if (memberId != null) input.dataset.memberId = String(memberId);

      remove.dataset.scope = scope;
      remove.dataset.amountId = String(amount.id);
      if (memberId != null) remove.dataset.memberId = String(memberId);
      remove.disabled = amounts.length <= 1;

      row.dataset.key = key;
      container.append(fragment);
    });

    if (activeKey) {
      const restored = container.querySelector(`[data-key="${cssEscape(activeKey)}"]`);
      if (restored) {
        restored.focus();
        setCursorToEnd(restored);
      }
    }
  }

  function renderMemberList() {
    const active = document.activeElement;
    const activeKey = active?.dataset?.key;
    els.members.replaceChildren();

    state.members.forEach((member) => {
      const fragment = els.memberTemplate.content.cloneNode(true);
      const item = fragment.querySelector(".member-item");
      const nameInput = fragment.querySelector(".member-name");
      const amounts = fragment.querySelector(".member-amounts");
      const addAmount = fragment.querySelector(".add-member-amount");
      const removeMember = fragment.querySelector(".remove-member");
      const key = `member-name-${member.id}`;

      item.dataset.memberId = String(member.id);
      nameInput.value = member.name;
      nameInput.dataset.key = key;
      nameInput.dataset.memberId = String(member.id);
      addAmount.dataset.memberId = String(member.id);
      removeMember.dataset.memberId = String(member.id);

      renderAmountList(amounts, member.amounts, "member", member.id);
      els.members.append(fragment);
    });

    if (activeKey) {
      const restored = els.members.querySelector(`[data-key="${cssEscape(activeKey)}"]`);
      if (restored) {
        restored.focus();
        setCursorToEnd(restored);
      }
    }
  }

  function renderSummary(result) {
    const clearedCount = result.steps.filter((step) => step.status === "cleared" || step.status === "covered").length;
    const hasStarted = Boolean(result.curr || result.last);
    const targetText = result.curr
      ? `${result.curr.g.name}${result.curr.target === "zm" ? "真命" : "真正"}`
      : (result.last ? `${result.last.g.name}真正` : `${PRIMARY_GATES[0].name}真命`);
    const gapText = result.curr ? fmt(result.curr.gap) : (result.last ? "0萬" : fmt(PRIMARY_GATES[0].zhenMingWan));

    els.summary.innerHTML = [
      metric("隊長總額", fmt(result.leaderWan), "六單位加總"),
      metric("段數 PASS", `${phasePassCount(result)}/${result.phaseRows.length}`, phaseFocusText(result)),
      metric("下一目標", targetText, hasStarted && !result.curr ? "六關已補足" : `缺 ${gapText}`),
      metric("真正過關", `${clearedCount}/${PRIMARY_GATES.length} 關`, clearedGateText(result))
    ].join("");
  }

  function renderMemberSummary(result) {
    const member = result.selectedMember;
    if (!member) {
      els.summary.innerHTML = [
        metric("隊員", "—", "尚無隊員"),
        metric("最高金額", "—", "尚未定位"),
        metric("位置", "—", "尚未定位"),
        metric("個別輪迴", "—", "尚未定位")
      ].join("");
      return;
    }

    els.summary.innerHTML = [
      metric("隊員", member.name || `隊員 ${member.idx + 1}`, `#${member.idx + 1}`),
      metric("最高金額", member.wan > 0 ? fmt(member.wan) : "—", `${(member.amounts || []).length} 筆最高`),
      metric("位置", member.gate ? member.gate.name : "—", member.gate ? fmt(member.gate.base) : "尚未定位"),
      metric("個別輪迴", cycleMainText(member.cycle), cycleSubText(member.cycle))
    ].join("");
  }

  function renderStatusOverview(result) {
    if (!els.statusOverview) return;

    const focus = leaderFocus(result);
    const clearedText = clearedGateText(result);
    const currentPhase = phaseFocusRow(result);
    const phaseCount = result.phaseRows.length;
    const passedCount = phasePassCount(result);
    const dialNumber = currentPhase ? currentPhase.phase.idx + 1 : phaseCount;
    const dialLabel = currentPhase ? "進行中" : "全部 PASS";
    const dialColor = currentPhase ? currentPhase.phase.col : "#147b55";
    const dialProgress = overallPhaseProgress(result);

    els.statusOverview.innerHTML = `
      <div class="status-dial" style="--stage-color: ${dialColor}; --stage-progress: ${dialProgress}%;">
        <span>段數</span>
        <strong>${escapeHtml(dialNumber)}</strong>
        <small>${escapeHtml(dialLabel)}</small>
      </div>
      <div class="status-copy">
        <span class="status-kicker">目前段數階段</span>
        <h2>${escapeHtml(phaseFocusText(result))}</h2>
        <p>${escapeHtml(phaseFocusSubText(result))}</p>
      </div>
      <div class="status-focus">
        <span>${escapeHtml(focus.badge)}</span>
        <strong>${escapeHtml(focus.value)}</strong>
        <small>${escapeHtml(focus.note)}</small>
      </div>
      <div class="status-mini">
        <span>PASS / 真正</span>
        <strong>${escapeHtml(`${passedCount}/${phaseCount} 段`)}</strong>
        <small>${escapeHtml(clearedText)}</small>
      </div>
    `;
  }

  function leaderFocus(result) {
    if (result.curr) {
      const step = result.curr;
      const targetName = step.target === "zm" ? "真命" : "真正";
      const targetTotal = step.target === "zm" ? step.zm : step.zz;
      const title = `${step.g.name}・${STATUS_TEXT[step.status]}`;
      const sub = step.gap > 0
        ? `還差 ${fmt(step.gap)} 到${step.g.name}${targetName}`
        : `已達${step.g.name}${targetName}`;
      return {
        title,
        sub,
        badge: "補額目標",
        value: `${step.g.name}${targetName}`,
        note: `${fmt(step.combined || 0)} / ${fmt(targetTotal)}`
      };
    }

    if (result.last) {
      return {
        title: `${result.last.g.name}・真正過關`,
        sub: "六大關卡已補足",
        badge: "六關後餘額",
        value: fmt(result.last.rem),
        note: "保留後續使用"
      };
    }

    return {
      title: "尚未定位",
      sub: "等待隊長單位數",
      badge: "補額目標",
      value: `${PRIMARY_GATES[0].name}真命`,
      note: `0萬 / ${fmt(PRIMARY_GATES[0].zhenMingWan)}`
    };
  }

  function clearedGateText(result) {
    const cleared = result.steps
      .filter((step) => step.status === "cleared" || step.status === "covered")
      .map((step) => step.g.name);
    return cleared.length > 0 ? cleared.join("、") : "尚未真正過關";
  }

  function renderPhaseLights(result) {
    if (!els.phaseLights) return;
    const currentIndex = result.phaseRows.findIndex((row) => !row.passed);

    els.phaseLights.innerHTML = result.phaseRows.map((row) => {
      const phase = row.phase;
      const className = row.passed
        ? "is-passed"
        : (phase.idx === currentIndex ? "is-current" : "is-waiting");
      const status = row.passed ? "PASS" : "未 PASS";
      const missingText = row.passed ? "已達 PASS" : `差 ${fmt(row.missing)}`;
      const progress = Math.round(row.progress * 100);
      const pairText = `${phase.lowerGate.name.replace("關", "")} ${fmt(phase.lowerBase)} × ${phase.lowerCount} + ${phase.upperGate.name.replace("關", "")} ${fmt(phase.upperBase)} × ${phase.upperCount}`;

      return `
        <article class="phase-card ${className}" style="--phase-color: ${phase.col}; --phase-progress: ${progress}%;">
          <div class="phase-head">
            <span>${phase.idx + 1}</span>
            <strong>${escapeHtml(phase.name)}</strong>
            <b>${escapeHtml(status)}</b>
          </div>
          <p>${escapeHtml(pairText)}</p>
          <div class="phase-bar" aria-hidden="true"><i></i></div>
          <small>本段 ${escapeHtml(fmt(phase.segmentWan))}・累計 ${escapeHtml(fmt(phase.passWan))}・${escapeHtml(missingText)}</small>
        </article>
      `;
    }).join("");
  }

  function phaseFocusRow(result) {
    return result.phaseRows.find((row) => !row.passed) || null;
  }

  function phasePassCount(result) {
    return result.phaseRows.filter((row) => row.passed).length;
  }

  function overallPhaseProgress(result) {
    const last = result.phaseRows.at(-1);
    if (!last) return 0;
    return pct(result.leaderWan, last.phase.passWan);
  }

  function phaseFocusText(result) {
    const current = phaseFocusRow(result);
    if (current) return `${current.phase.name}・${current.passed ? "PASS" : "未 PASS"}`;
    return "五段數・全部 PASS";
  }

  function phaseFocusSubText(result) {
    const current = phaseFocusRow(result);
    if (current) return `還差 ${fmt(current.missing)} 到${current.phase.name} PASS`;
    const last = result.phaseRows.at(-1);
    return last ? `已達 ${fmt(last.phase.passWan)} 累計門檻` : "等待隊長單位數";
  }

  function renderGateStepper(result) {
    if (!els.gateStepper) return;
    const isMemberView = false;
    const selectedIdx = isMemberView && result.selectedMember?.gate ? result.selectedMember.gate.idx : -1;

    els.gateStepper.innerHTML = PRIMARY_GATES.map((gate) => {
      const state = isMemberView
        ? memberGateState(gate, selectedIdx)
        : leaderGateState(result, gate);
      const countState = gateCountState(result, gate);
      return `
        <article class="gate-step ${state.className}" style="--gate-color: ${gate.col}; --zm: ${state.zmPct}%; --zz: ${state.zzPct}%;">
          <div class="gate-step-head">
            <span>${gate.idx + 1}</span>
            <strong>${escapeHtml(gate.name)}</strong>
          </div>
          <small>${escapeHtml(fmt(gate.base))}</small>
          <div class="gate-bars" aria-hidden="true">
            <i class="bar-zm"></i>
            <i class="bar-zz"></i>
          </div>
          <div class="gate-step-meta">
            <span>真命 ${escapeHtml(fmt(gate.zhenMingWan))}</span>
            <span>真正 ${escapeHtml(fmt(gate.trueWan))}</span>
          </div>
          <div class="gate-cumulative">
            <span>累計真正</span>
            <strong>${escapeHtml(fmt(gate.cumulativeTrueWan))}</strong>
          </div>
          <div class="gate-counts">
            ${gateCountLine("真命數", countState.zhenMing)}
            ${gateCountLine("真正數", countState.zhenZheng)}
          </div>
          <b>${escapeHtml(state.label)}</b>
        </article>
      `;
    }).join("");
  }

  function leaderGateState(result, gate) {
    const step = result.steps.find((item) => item.g.idx === gate.idx);
    if (!step) {
      return { className: "is-locked", label: "未開始", zmPct: 0, zzPct: 0 };
    }

    const achieved = step.status === "covered" || step.status === "cleared"
      ? step.zz
      : (step.combined ?? step.tAmt);
    const zmPct = pct(achieved, step.zm);
    const zzPct = pct(achieved, step.zz);
    const labels = {
      covered: "團隊真正覆蓋",
      cleared: "真正過關",
      at_zm: "真命過關",
      wip: "真命前進中"
    };

    return {
      className: `is-${step.status}`,
      label: labels[step.status] || "進行中",
      zmPct,
      zzPct
    };
  }

  function gateCountState(result, gate) {
    if (result.settings.viewMode === "member") {
      const member = result.selectedMember;
      return countProgressForWan(member?.wan || 0, gate);
    }

    const step = result.steps.find((item) => item.g.idx === gate.idx);
    if (!step) return countProgressForUnits(0);
    if (step.status === "covered" || step.status === "cleared") return countProgressForUnits(ZHEN_ZHENG_UNITS);
    return countProgressForWan(step.combined ?? step.tAmt, gate);
  }

  function gateCountLine(label, progress) {
    const complete = progress.missing <= EPSILON;
    const className = complete ? "is-complete" : "is-missing";
    const missing = complete ? "已足" : `缺 ${fmtCount(progress.missing)}個`;
    return `
      <div class="gate-count-line ${className}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(`${fmtCount(progress.done)}/${fmtCount(progress.total)}`)}</strong>
        <small>${escapeHtml(missing)}</small>
      </div>
    `;
  }

  function fmtCount(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return "0";
    if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
    return String(parseFloat(n.toFixed(2)));
  }

  function fmtUnitInput(value) {
    const n = Number(value);
    if (!Number.isFinite(n) || n <= 0) return "";
    if (Math.abs(n - Math.round(n)) < 0.001) return String(Math.round(n));
    return String(parseFloat(n.toFixed(3)));
  }

  function memberGateState(gate, selectedIdx) {
    if (selectedIdx < 0) return { className: "is-locked", label: "未觸及", zmPct: 0, zzPct: 0 };
    if (gate.idx < selectedIdx) return { className: "is-cleared", label: "已觸及", zmPct: 100, zzPct: 100 };
    if (gate.idx === selectedIdx) return { className: "is-personal", label: "我的位置", zmPct: 100, zzPct: 0 };
    return { className: "is-locked", label: "未觸及", zmPct: 0, zzPct: 0 };
  }

  function renderActionList(result) {
    if (!els.actionList) return;

    const focus = result.curr
      ? `${result.curr.g.name}${result.curr.target === "zm" ? "真命" : "真正"}`
      : (result.last ? `${result.last.g.name}真正` : `${PRIMARY_GATES[0].name}真命`);
    const focusSub = result.curr
      ? `還差 ${fmt(result.curr.gap)}，目前合計 ${fmt(result.curr.combined || 0)}`
      : (result.last ? "目前沒有待補關卡" : `還差 ${fmt(PRIMARY_GATES[0].zhenMingWan)}，目前合計 0萬`);
    const clearedCount = result.steps.filter((step) => step.status === "cleared" || step.status === "covered").length;
    const nextGate = result.curr?.g || result.last?.g || PRIMARY_GATES[0];
    const countState = gateCountState(result, nextGate);
    const missingText = result.curr
      ? `真命缺 ${fmtCount(countState.zhenMing.missing)}，真正缺 ${fmtCount(countState.zhenZheng.missing)}`
      : (result.last ? "六關真命與真正已補足" : `真命缺 ${ZHEN_MING_UNITS}，真正缺 ${ZHEN_ZHENG_UNITS}`);

    els.actionList.innerHTML = [
      actionCard("下一步行動", focus, focusSub, "primary"),
      actionCard("段數 PASS", `${phasePassCount(result)}/${result.phaseRows.length}`, phaseFocusSubText(result), "neutral"),
      actionCard("缺少狀態", nextGate?.name || "—", missingText, "soft")
    ].join("");
  }

  function actionCard(label, value, sub, tone) {
    return `
      <div class="action-card tone-${tone}">
        <span>${escapeHtml(label)}</span>
        <strong>${escapeHtml(value || "—")}</strong>
        <small>${escapeHtml(sub || "")}</small>
      </div>
    `;
  }

  function renderWaterfall(result) {
    if (!els.waterfall) return;
    if (result.steps.length === 0) {
      els.waterfall.innerHTML = `<div class="empty-card">尚未有補額流程</div>`;
      return;
    }

    const max = Math.max(result.leaderWan, ...result.steps.map((step) => step.targetNeed || step.need || 0), 1);
    const rows = result.steps.map((step) => {
      const targetName = step.target === "zm" ? "真命" : "真正";
      const need = step.status === "covered" ? 0 : (step.targetNeed ?? step.need ?? 0);
      const paid = step.status === "covered" ? 0 : Math.min(step.rem + (step.status === "cleared" ? need : 0), need);
      const bar = pct(need, max);
      const remText = step.status === "wip" || step.status === "at_zm"
        ? `剩 ${fmt(step.rem)}・差 ${fmt(step.gap)}`
        : `剩 ${fmt(step.rem)}`;
      const status = STATUS_TEXT[step.status] || "進行中";

      return `
        <div class="waterfall-row is-${step.status}" style="--flow: ${bar}%;">
          <div>
            <strong>${escapeHtml(step.g.name)}</strong>
            <small>${escapeHtml(status)}・${escapeHtml(step.status === "covered" ? "團隊已覆蓋" : `${targetName}補額 ${fmt(need)}`)}</small>
          </div>
          <div class="flow-bar"><i></i></div>
          <span>${escapeHtml(step.status === "covered" ? "0萬" : fmt(paid))}</span>
          <em>${escapeHtml(remText)}</em>
        </div>
      `;
    }).join("");

    els.waterfall.innerHTML = `
      <div class="waterfall-total">
        <span>起始隊長總額</span>
        <strong>${escapeHtml(fmt(result.leaderWan))}</strong>
      </div>
      ${rows}
    `;
  }

  function renderMobileStatus(result) {
    if (!els.mobileStatus) return;
    els.mobileStatus.dataset.viewMode = result.settings.viewMode;
    const clearedCount = result.steps.filter((step) => step.status === "cleared" || step.status === "covered").length;
    const gap = result.curr ? fmt(result.curr.gap) : (result.last ? "0萬" : fmt(PRIMARY_GATES[0].zhenMingWan));

    els.mobileStatus.innerHTML = `
      ${mobileStat("總額", fmt(result.leaderWan), "六單位")}
      ${mobileStat("段數", phaseFocusText(result), "目前段數階段")}
      ${mobileStat("缺口", gap, result.curr ? "下一目標" : "已補足")}
      ${mobileStat("真正", `${clearedCount}/${PRIMARY_GATES.length}`, "六關")}
    `;
  }

  function cycleMainText(status) {
    if (!status?.current) return "—";
    return status.allCleared ? "五輪全通" : status.current.name;
  }

  function cycleSubText(status) {
    if (!status?.current) return "尚未定位";
    if (status.kind === "coverage") {
      if (status.allCleared) return "已全數通關";
      const gap = coverageMissingText(status);
      if (status.cleared) return `${status.cleared.name}已通關・${gap}`;
      return gap;
    }
    if (status.allCleared) return status.overflowWan > 0 ? `已全數通關・餘 ${fmt(status.overflowWan)}` : "已全數通關";
    if (status.cleared) return `${status.cleared.name}已通關・差 ${fmt(status.remaining)}`;
    return `差 ${fmt(status.remaining)}`;
  }

  function cycleGapText(status) {
    if (!status?.current) return "—";
    if (status.kind === "coverage") return coverageMissingText(status);
    return status.allCleared ? "已通關" : `差 ${fmt(status.remaining)}`;
  }

  function coverageMissingText(progress) {
    const missing = (progress?.missing || []).filter((item) => item.missing > 0);
    if (missing.length === 0) return "配置已達";
    return `缺 ${missing.map((item) => `${item.gate.name}${item.missing}`).join("、")}`;
  }

  function mobileStat(label, value, sub) {
    return `<div class="mobile-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small></div>`;
  }

  function metric(label, value, sub) {
    return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small></div>`;
  }

  function pct(value, total) {
    if (!total || total <= 0) return 0;
    return Math.round(Math.max(0, Math.min(1, value / total)) * 100);
  }

  function renderPyramid(result) {
    const width = 960;
    const height = 660;
    const top = 58;
    const pyramidHeight = 520;
    const pyramidWidth = 790;
    const center = width / 2;
    const rowHeight = pyramidHeight / 5;
    const positions = {};
    const isMemberView = result.settings.viewMode === "member";
    const selectedGate = isMemberView ? result.selectedMember?.gate : null;
    const selectedIdx = selectedGate ? selectedGate.idx : -1;
    const xianIdx = result.xian ? result.xian.idx : -1;
    const shiIdx = result.shi ? result.shi.idx : -1;
    const parts = [];

    if (els.pyramidHeading) {
      els.pyramidHeading.textContent = isMemberView ? "個人三角形" : "金字塔";
    }

    parts.push(`<svg class="pyramid-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="${isMemberView ? "個人三角形定位圖" : "金字塔三色定位圖"}">`);
    parts.push(renderPyramidDefs());
    parts.push(`<rect class="pyramid-backdrop" x="0" y="0" width="${width}" height="${height}"></rect>`);
    parts.push(`<g class="pyramid-grid" aria-hidden="true">`);
    parts.push(`<path d="M ${center} ${top} L ${center - pyramidWidth / 2} ${top + pyramidHeight} L ${center + pyramidWidth / 2} ${top + pyramidHeight} Z"></path>`);
    for (let band = 1; band < 5; band += 1) {
      const y = top + band * rowHeight;
      parts.push(`<line x1="${center - halfAt(y)}" y1="${y}" x2="${center + halfAt(y)}" y2="${y}"></line>`);
    }
    parts.push(`<line x1="${center}" y1="${top}" x2="${center}" y2="${top + pyramidHeight}"></line>`);
    parts.push(`</g>`);
    parts.push(`<g class="pyramid-cells">`);

    for (let tier = 4; tier >= 0; tier -= 1) {
      const band = 4 - tier;
      const y0 = top + band * rowHeight;
      const y1 = top + (band + 1) * rowHeight;
      const left0 = center - halfAt(y0);
      const right0 = center + halfAt(y0);
      const left1 = center - halfAt(y1);
      const right1 = center + halfAt(y1);
      const gates = [GATES[tier * 2], GATES[tier * 2 + 1]];

      gates.forEach((gate) => {
        const isLeft = gate.side === "left";
        const points = isLeft
          ? `${left0},${y0} ${center},${y0} ${center},${y1} ${left1},${y1}`
          : `${center},${y0} ${right0},${y0} ${right1},${y1} ${center},${y1}`;
        const gateZone = isMemberView
          ? (selectedIdx >= 0 && gate.idx <= selectedIdx ? 0 : 2)
          : zone(gate.idx, shiIdx, xianIdx);
        const fill = gateZone === 2 ? "url(#mutedGate)" : `url(#gateGradient${gate.idx})`;
        const cellClass = gateZone === 0 ? "is-solid" : gateZone === 1 ? "is-nominal" : "is-muted";
        const cx = isLeft
          ? (left0 + center + center + left1) / 4
          : (center + right0 + right1 + center) / 4;
        const cy = (y0 + y1) / 2;

        positions[gate.idx] = { x: cx, y: cy };
        parts.push(`<polygon class="pyramid-cell ${cellClass}" points="${points}" fill="${fill}"></polygon>`);

        const topClass = tier === 4 ? " is-top" : "";
        parts.push(`<text class="gate-text${topClass}" x="${cx}" y="${cy - 4}" text-anchor="middle">${escapeHtml(gate.name)}</text>`);
        parts.push(`<text class="gate-subtext${topClass}" x="${cx}" y="${cy + 18}" text-anchor="middle">${escapeHtml(fmt(gate.base))}</text>`);
      });
    }

    parts.push(`</g>`);
    parts.push(...renderStatusRings(result, positions));
    parts.push(...renderMarkers(result, positions));
    parts.push(`</svg>`);
    els.pyramid.innerHTML = parts.join("");
    centerPersonalPyramid();

    function halfAt(y) {
      const progress = Math.max(0, Math.min(1, (y - top) / pyramidHeight));
      return (pyramidWidth / 2) * progress;
    }

    function centerPersonalPyramid() {
      if (!isMemberView || selectedIdx < 0) return;
      const base = positions[selectedIdx];
      window.requestAnimationFrame(() => {
        const svg = els.pyramid.querySelector(".pyramid-svg");
        if (!svg) return;
        const scale = svg.getBoundingClientRect().width / width;
        const target = base.x * scale - els.pyramid.clientWidth / 2;
        const max = els.pyramid.scrollWidth - els.pyramid.clientWidth;
        els.pyramid.scrollLeft = Math.max(0, Math.min(max, target));
      });
    }
  }

  function renderPyramidDefs() {
    const gradients = GATES.map((gate) => {
      const light = mixColor(gate.col, "#ffffff", 0.35);
      const deep = mixColor(gate.col, "#1f2428", 0.14);
      return `
        <linearGradient id="gateGradient${gate.idx}" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="${light}"></stop>
          <stop offset="54%" stop-color="${gate.col}"></stop>
          <stop offset="100%" stop-color="${deep}"></stop>
        </linearGradient>
      `;
    }).join("");

    return `
      <defs>
        <linearGradient id="mutedGate" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#f1eee6"></stop>
          <stop offset="100%" stop-color="#d9d4c8"></stop>
        </linearGradient>
        <linearGradient id="pyramidBackdropGrad" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" stop-color="#fbfaf5"></stop>
          <stop offset="52%" stop-color="#eef4ef"></stop>
          <stop offset="100%" stop-color="#f7efe6"></stop>
        </linearGradient>
        <filter id="markerGlow" x="-80%" y="-80%" width="260%" height="260%">
          <feDropShadow dx="0" dy="6" stdDeviation="7" flood-color="#1f2428" flood-opacity="0.24"></feDropShadow>
          <feDropShadow dx="0" dy="0" stdDeviation="5" flood-color="#ffffff" flood-opacity="0.9"></feDropShadow>
        </filter>
        ${gradients}
      </defs>
    `;
  }

  function renderStatusRings(result, positions) {
    const parts = [];
    if (result.settings.viewMode === "member") {
      if (result.selectedMember?.gate) {
        const base = positions[result.selectedMember.gate.idx];
        parts.push(`<g class="status-ring personal-ring" transform="translate(${base.x} ${base.y})"><circle r="39"></circle><circle r="29"></circle></g>`);
      }
      return parts;
    }

    if (result.xian) {
      const base = positions[result.xian.idx];
      parts.push(`<g class="status-ring xian-ring" transform="translate(${base.x} ${base.y})"><circle r="42"></circle><circle r="33"></circle></g>`);
    }
    if (result.shi) {
      const base = positions[result.shi.idx];
      parts.push(`<g class="status-ring shi-ring" transform="translate(${base.x} ${base.y})"><path d="M 0 -46 L 46 0 L 0 46 L -46 0 Z"></path></g>`);
    }
    return parts;
  }

  function renderMarkers(result, positions) {
    const parts = [];
    const grouped = new Map();

    if (result.settings.viewMode === "member") {
      const member = result.selectedMember;
      if (!member?.gate) return parts;

      const base = positions[member.gate.idx];
      parts.push(`<g class="selected-member-marker" aria-label="${escapeHtml(member.name || "隊員")}個人定位" transform="translate(${base.x} ${base.y + 30})">`);
      parts.push(`<circle r="17"></circle><text y="1">我</text>`);
      parts.push(`</g>`);
      return parts;
    }

    result.positions.forEach((member) => {
      if (!member.gate) return;
      const list = grouped.get(member.gate.idx) || [];
      list.push(member);
      grouped.set(member.gate.idx, list);
    });

    grouped.forEach((members, gateIdx) => {
      const base = positions[gateIdx];
      members.forEach((member, index) => {
        const offset = markerOffset(index, members.length, 19);
        const label = String(member.idx + 1);
        const x = base.x + offset.x;
        const y = base.y + 30 + offset.y;
        parts.push(`<g class="member-marker" aria-label="${escapeHtml(member.name)}" transform="translate(${x} ${y})">`);
        parts.push(`<circle r="12"></circle><text y="0">${escapeHtml(label)}</text>`);
        parts.push(`</g>`);
      });
    });

    if (result.leaderPersonalGate) {
      const base = positions[result.leaderPersonalGate.idx];
      parts.push(`<g class="leader-personal-marker" aria-label="隊長個人定位" transform="translate(${base.x} ${base.y - 52})">`);
      parts.push(`<circle r="14"></circle><text y="1">個</text>`);
      parts.push(`</g>`);
    }

    if (result.xian) {
      const base = positions[result.xian.idx];
      parts.push(`<g class="leader-marker" aria-label="隊長先得後修" transform="translate(${base.x} ${base.y - 30})">`);
      parts.push(`<circle r="17"></circle><text y="1">★</text>`);
      parts.push(`</g>`);
    }

    if (result.shi) {
      const base = positions[result.shi.idx];
      parts.push(`<g class="shi-marker" aria-label="實得實修上限" transform="translate(${base.x} ${base.y})">`);
      parts.push(`<path d="M 0 -16 L 16 0 L 0 16 L -16 0 Z"></path><text y="1">實</text>`);
      parts.push(`</g>`);
    }

    return parts;
  }

  function markerOffset(index, total, radius) {
    if (total === 1) return { x: 0, y: 0 };
    const angle = (-90 + (360 / Math.max(total, 6)) * index) * (Math.PI / 180);
    return {
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius
    };
  }

  function renderCascade(result) {
    if (result.steps.length === 0) {
      els.cascadeRows.innerHTML = `<tr><td class="empty-row" colspan="5">—</td></tr>`;
      return;
    }

    els.cascadeRows.innerHTML = result.steps.map((step) => {
      const coverage = `${step.cnt} 人 / ${fmt(step.tAmt)}`;
      const need = step.status === "covered" ? "0萬" : `${step.target === "zm" ? "真命 " : "真正 "}${fmt(step.targetNeed ?? step.need ?? 0)}`;
      const rem = step.status === "wip" || step.status === "at_zm"
        ? `${fmt(step.rem)} / 合計 ${fmt(step.combined)} / 差 ${fmt(step.gap)}`
        : fmt(step.rem);
      const baseLine = `真命 ${fmt(step.zm)}；真正 ${fmt(step.zz)}`;
      const pct = step.pct == null ? "" : `<small>${Math.round(step.pct * 100)}%</small>`;

      return `
        <tr>
          <td><strong>${escapeHtml(step.g.name)}</strong><small>${escapeHtml(baseLine)}</small></td>
          <td><span class="status-pill status-${step.status}">${escapeHtml(STATUS_TEXT[step.status])}</span>${pct}</td>
          <td>${escapeHtml(coverage)}</td>
          <td>${escapeHtml(need)}</td>
          <td>${escapeHtml(rem)}</td>
        </tr>
      `;
    }).join("");
  }

  function renderCycles(result) {
    if (!els.cycleRows) return;

    els.cycleRows.innerHTML = result.cycleRows.map(({ cycle, leader, team }) => `
      <tr>
        <td data-label="輪迴"><strong>${escapeHtml(cycle.name)}</strong><small>${escapeHtml(fmt(cycle.cumulativePassWan))} 累計通關</small></td>
        <td data-label="關卡">${cycleGateCell(cycle)}</td>
        <td data-label="通關條件">${cycleRequirementCell(cycle)}</td>
        <td data-label="隊長自己">${cycleProgressCell(leader)}</td>
        <td data-label="${escapeHtml(result.settings.teamCycleBasis === "amount" ? "團隊金額" : "團隊配置")}">${cycleProgressCell(team)}</td>
      </tr>
    `).join("");
  }

  function cycleGateCell(cycle) {
    const carry = cycle.carryGate ? `<small>${escapeHtml(cycle.carryGate.name)}需累計 ${cycle.lowerCount} 個</small>` : "";
    return `${escapeHtml(cycle.lowerGate.name)} / ${escapeHtml(cycle.upperGate.name)}${carry}`;
  }

  function cycleRequirementCell(cycle) {
    const carry = cycle.carryGate
      ? `<strong>補 ${cycle.carryCount} 個 ${escapeHtml(fmt(cycle.carryGate.base))}</strong>`
      : "";
    const main = `${cycle.lowerCount} 個 ${escapeHtml(fmt(cycle.lowerGate.base))}`;
    const upper = `${cycle.upperCount} 個 ${escapeHtml(fmt(cycle.upperGate.base))}`;
    const prefix = carry ? `${carry}<small>+ ${main} + ${upper}</small>` : `<strong>${main}</strong><small>+ ${upper}</small>`;
    return `${prefix}<small>本輪需 ${escapeHtml(fmt(cycle.segmentWan))}</small>`;
  }

  function cycleProgressCell(progress) {
    const status = progress.passed ? "cleared" : "wip";
    const label = progress.passed ? "通關" : "進行中";
    const applied = Math.min(progress.appliedWan, progress.cycle.segmentWan);
    if (progress.kind === "coverage") {
      const sub = progress.passed
        ? "配置已達"
        : `${Math.round(progress.progress * 100)}%・${coverageMissingText(progress)}`;
      return `<span class="status-pill status-${status}">${escapeHtml(label)}</span><small>${escapeHtml(sub)}</small>`;
    }
    const sub = progress.passed
      ? `${fmt(applied)} / ${fmt(progress.cycle.segmentWan)}`
      : `${Math.round(progress.progress * 100)}%・差 ${fmt(progress.remaining)}`;

    return `<span class="status-pill status-${status}">${escapeHtml(label)}</span><small>${escapeHtml(sub)}</small>`;
  }

  function renderMemberInlineStatus(result) {
    result.positions.forEach((member) => {
      const item = els.members.querySelector(`[data-member-id="${cssEscape(member.id)}"]`);
      const status = item?.querySelector(".member-live-status");
      if (!status) return;

      status.innerHTML = `
        <span>個別狀態</span>
        <strong>${escapeHtml(cycleMainText(member.cycle))}</strong>
        <small>${escapeHtml(member.gate ? `${member.gate.name}・${cycleSubText(member.cycle)}` : "尚未定位")}</small>
      `;
    });
  }

  function renderMembers(result) {
    const members = result.settings.viewMode === "member"
      ? (result.selectedMember ? [result.selectedMember] : [])
      : result.positions;

    if (els.memberPanelTitle) {
      els.memberPanelTitle.textContent = result.settings.viewMode === "member" ? "個別定位" : "團隊定位";
    }

    if (members.length === 0) {
      els.memberRows.innerHTML = `<tr><td class="empty-row" colspan="4">—</td></tr>`;
      return;
    }

    els.memberRows.innerHTML = members.map((member) => `
      <tr>
        <td><strong>${escapeHtml(member.name || `隊員 ${member.idx + 1}`)}</strong><small>#${member.idx + 1}</small></td>
        <td>${member.wan > 0 ? escapeHtml(fmt(member.wan)) : "—"}</td>
        <td>${member.gate ? escapeHtml(member.gate.name) : "—"}</td>
        <td><strong>${escapeHtml(cycleMainText(member.cycle))}</strong><small>${escapeHtml(cycleSubText(member.cycle))}</small></td>
      </tr>
    `).join("");
  }

  els.leaderName.addEventListener("input", (event) => {
    state.leader.name = event.target.value;
    scheduleRender();
  });

  document.addEventListener("input", handleFieldEdit);
  document.addEventListener("change", handleFieldEdit);

  function handleFieldEdit(event) {
    const target = event.target;
    if (!target) return;

    if (target.matches("[data-setting]")) {
      state.settings = normalizeSettings(state.settings, state.members);
      state.settings[target.dataset.setting] = target.value;
      scheduleRender();
      return;
    }

    if (target === els.viewerMember) {
      state.settings = normalizeSettings(state.settings, state.members);
      state.settings.selectedMemberId = target.value;
      scheduleRender();
      return;
    }

    if (target.tagName !== "INPUT") return;

    if (target.matches("[data-leader-unit]")) {
      state.leader.unitCounts = ensureUnitCounts(state.leader.unitCounts, state.leader.amounts);
      const item = state.leader.unitCounts.find((unit) => String(unit.gateIdx) === String(target.dataset.leaderUnit));
      if (item) {
        item.v = target.value;
        state.leader.amounts = leaderAmountsFromUnitCounts(state.leader.unitCounts);
        scheduleRender();
      }
      return;
    }

    if (target.classList.contains("amount-input")) {
      const amount = findAmount(target.dataset.scope, target.dataset.amountId, target.dataset.memberId);
      if (amount) {
        amount.v = target.value;
        scheduleRender();
      }
    }

    if (target.classList.contains("member-name")) {
      const member = findMember(target.dataset.memberId);
      if (member) {
        member.name = target.value;
        scheduleRender();
      }
    }
  }

  document.addEventListener("click", (event) => {
    const button = event.target.closest("button");
    if (!button) return;

    const action = button.dataset.action;
    if (action === "add-leader-amount") {
      state.leader.amounts.push({ id: uniqueId(), v: "" });
      scheduleRender({ inputs: true });
      return;
    }

    if (action === "add-member") {
      addMember();
      scheduleRender({ inputs: true });
      return;
    }

    if (action === "jump-pyramid") {
      els.pyramid.closest(".pyramid-frame").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    if (button.classList.contains("remove-amount")) {
      removeAmount(button.dataset.scope, button.dataset.amountId, button.dataset.memberId);
      scheduleRender({ inputs: true });
      return;
    }

    if (button.classList.contains("add-member-amount")) {
      const member = findMember(button.dataset.memberId);
      if (member) member.amounts.push({ id: uniqueId(), v: "" });
      scheduleRender({ inputs: true });
      return;
    }

    if (button.classList.contains("remove-member")) {
      state.members = state.members.filter((member) => String(member.id) !== String(button.dataset.memberId));
      state.settings = normalizeSettings(state.settings, state.members);
      scheduleRender({ inputs: true });
    }
  });

  els.resetExample.addEventListener("click", () => {
    state = cloneState(EXAMPLE_STATE);
    scheduleRender({ inputs: true });
  });

  function addMember() {
    if (state.members.length >= 13) return;
    const next = state.members.length + 1;
    state.members.push({
      id: uniqueId(),
      name: `隊員 ${next}`,
      amounts: [{ id: uniqueId() + 1, v: "" }]
    });
  }

  function removeAmount(scope, amountId, memberId) {
    if (scope === "leader") {
      state.leader.amounts = removeAmountFrom(state.leader.amounts, amountId);
      return;
    }
    const member = findMember(memberId);
    if (member) member.amounts = removeAmountFrom(member.amounts, amountId);
  }

  function removeAmountFrom(amounts, amountId) {
    if (amounts.length <= 1) return amounts;
    return amounts.filter((amount) => String(amount.id) !== String(amountId));
  }

  function findAmount(scope, amountId, memberId) {
    if (scope === "leader") {
      return state.leader.amounts.find((amount) => String(amount.id) === String(amountId));
    }
    const member = findMember(memberId);
    return member?.amounts.find((amount) => String(amount.id) === String(amountId));
  }

  function findMember(memberId) {
    return state.members.find((member) => String(member.id) === String(memberId));
  }

  function uniqueId() {
    return Date.now() + Math.floor(Math.random() * 100000);
  }

  function escapeHtml(value) {
    return String(value)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function mixColor(from, to, amount) {
    const a = hexToRgb(from);
    const b = hexToRgb(to);
    if (!a || !b) return from;
    const mix = (start, end) => Math.round(start + (end - start) * amount);
    return `rgb(${mix(a.r, b.r)}, ${mix(a.g, b.g)}, ${mix(a.b, b.b)})`;
  }

  function hexToRgb(hex) {
    const normalized = String(hex).replace("#", "").trim();
    if (!/^[0-9a-f]{6}$/i.test(normalized)) return null;
    return {
      r: parseInt(normalized.slice(0, 2), 16),
      g: parseInt(normalized.slice(2, 4), 16),
      b: parseInt(normalized.slice(4, 6), 16)
    };
  }

  function cssEscape(value) {
    if (typeof CSS !== "undefined" && CSS.escape) return CSS.escape(value);
    return String(value).replace(/["\\]/g, "\\$&");
  }

  function setCursorToEnd(input) {
    const length = input.value.length;
    try {
      input.setSelectionRange(length, length);
    } catch {
      // Some input modes do not support explicit selection ranges.
    }
  }

  render();
})(typeof window !== "undefined" ? window : globalThis);
