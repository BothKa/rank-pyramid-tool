(function (root) {
  "use strict";

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
  ].map((g) => ({
    ...g,
    tier: Math.floor(g.idx / 2),
    side: g.idx % 2 === 0 ? "left" : "right"
  }));

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

  const EPSILON = 1e-9;

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
      amounts: [{ id: 1, v: "880" }]
    },
    members: [
      { id: 1, name: "隊員 1", amounts: [{ id: 1, v: "2.2" }] },
      { id: 2, name: "隊員 2", amounts: [{ id: 1, v: "2.2" }] },
      { id: 3, name: "隊員 3", amounts: [{ id: 1, v: "2.2" }] }
    ]
  };

  const STORAGE_KEY = "rank-pyramid-v1";

  function toWan(raw) {
    const n = parseFloat(String(raw ?? "").replace(/,/g, ""));
    if (Number.isNaN(n) || n <= 0) return 0;
    return n > 10000 ? n / 10000 : n;
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

  function atLeast(value, target) {
    return value + EPSILON >= target;
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

  function calcCascade(leaderAmts, members) {
    const leaderWan = sumWanOf(leaderAmts);
    if (leaderWan <= 0) return { steps: [], leaderWan: 0, tc: {} };

    const tc = teamCoverage(members);
    let rem = leaderWan;
    const steps = [];

    for (const gate of GATES) {
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

  function xianGate(last, curr) {
    if (!curr) return last ? last.g : null;
    if (curr.status === "at_zm") {
      return GATES[Math.min(curr.g.idx + 1, GATES.length - 1)];
    }
    return curr.g;
  }

  function teamHighGateIdx(positions) {
    return positions.reduce((max, member) => {
      if (!member.gate) return max;
      return Math.max(max, member.gate.idx);
    }, -1);
  }

  function shiGate(xian, teamHighIdx) {
    if (!xian) return null;
    if (teamHighIdx < 0) return xian;
    const cap = Math.min(teamHighIdx + 2, GATES.length - 1);
    const real = Math.min(xian.idx, cap);
    return real >= 0 ? GATES[real] : null;
  }

  function zone(gIdx, shiIdx, xianIdx) {
    if (shiIdx >= 0 && gIdx <= shiIdx) return 0;
    if (xianIdx >= 0 && gIdx <= xianIdx) return 1;
    return 2;
  }

  function analyze(state) {
    const members = state.members || [];
    const settings = normalizeSettings(state.settings, members);
    const cascade = calcCascade(state.leader.amounts || [], members);
    const positions = memberPositions(members);
    const effectiveCount = positions.filter((member) => member.wan > 0).length;
    const teamTier = teamTierFor(effectiveCount);
    const teamWan = teamWanOf(positions);
    const leaderCycleWan = settings.leaderCycleBasis === "max"
      ? maxWanOf(state.leader.amounts || [])
      : cascade.leaderWan;
    const xian = xianGate(cascade.last, cascade.curr);
    const highIdx = teamHighGateIdx(positions);
    const shi = shiGate(xian, highIdx);
    const leaderCycle = cycleStatusFor(leaderCycleWan);
    const teamAmountCycle = cycleStatusFor(teamWan);
    const teamCoverageCycle = cycleStatusForTeamCoverage(positions);
    const teamCycle = settings.teamCycleBasis === "amount" ? teamAmountCycle : teamCoverageCycle;
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
    CYCLES,
    TEAM_TIERS,
    STATUS_TEXT,
    DEFAULT_STATE,
    DEFAULT_SETTINGS,
    toWan,
    gateFor,
    teamTierFor,
    maxWanOf,
    sumWanOf,
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
    leaderAmounts: document.getElementById("leaderAmounts"),
    members: document.getElementById("members"),
    statusOverview: document.getElementById("statusOverview"),
    summary: document.getElementById("summary"),
    mobileStatus: document.getElementById("mobileStatus"),
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
    const result = analyze(state);
    document.body.dataset.viewMode = result.settings.viewMode;
    renderStatusOverview(result);
    renderSummary(result);
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

  function renderInputs() {
    renderSettingsControls();
    if (document.activeElement !== els.leaderName) {
      els.leaderName.value = state.leader.name;
    }
    renderAmountList(els.leaderAmounts, state.leader.amounts, "leader");
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
    if (result.settings.viewMode === "member") {
      renderMemberSummary(result);
      return;
    }

    const xianText = result.xian ? result.xian.name : "—";
    const shiText = result.shi ? result.shi.name : "—";
    const teamText = result.teamTier ? `${result.teamTier.label} ${result.teamTier.desc}` : "—";
    const progress = result.xianInProgress ? "前進中" : "已達真命";
    const personalText = result.leaderPersonalGate ? result.leaderPersonalGate.name : "—";
    const leaderBasis = result.settings.leaderCycleBasis === "max" ? "最高單筆" : `${state.leader.amounts.length} 筆加總`;
    const teamBasis = result.settings.teamCycleBasis === "amount" ? `${fmt(result.teamWan)}・金額加總` : "13/3 配置";

    els.summary.innerHTML = [
      metric("隊長總額", fmt(result.leaderWan), `${state.leader.amounts.length} 筆加總`),
      metric("隊長個人", personalText, result.leaderPersonalGate ? "個人最高金額定位" : "尚無有效金額"),
      metric("自己輪迴", cycleMainText(result.leaderCycle), `${leaderBasis}・${cycleSubText(result.leaderCycle)}`),
      metric("團隊輪迴", cycleMainText(result.teamCycle), `${teamBasis}・${cycleSubText(result.teamCycle)}`),
      metric("先得後修", xianText, result.xian ? progress : "尚未定位"),
      metric("實得實修", shiText, result.teamHighIdx >= 0 ? `隊員最高 +2 上限` : "無隊員限制"),
      metric("有效隊員", `${result.effectiveCount} 人`, teamText)
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

    if (result.settings.viewMode === "member") {
      const member = result.selectedMember;
      const title = member?.gate ? `${member.gate.name}・個人定位` : "尚未定位";
      const sub = member
        ? `${member.name || `隊員 ${member.idx + 1}`} 最高金額 ${member.wan > 0 ? fmt(member.wan) : "—"}`
        : "請先新增隊員金額";
      const gap = member?.cycle ? cycleGapText(member.cycle) : "—";

      els.statusOverview.innerHTML = `
        <div class="status-copy">
          <span class="status-kicker">目前狀態</span>
          <h2>${escapeHtml(title)}</h2>
          <p>${escapeHtml(sub)}</p>
        </div>
        <div class="status-focus">
          <span>下一步</span>
          <strong>${escapeHtml(gap)}</strong>
          <small>${escapeHtml(member?.cycle ? cycleMainText(member.cycle) : "個別輪迴")}</small>
        </div>
      `;
      return;
    }

    const focus = leaderFocus(result);
    const cleared = result.steps
      .filter((step) => step.status === "cleared" || step.status === "covered")
      .map((step) => step.g.name);
    const clearedText = cleared.length > 0 ? cleared.join("、") : "尚未真正過關";
    const shiText = result.shi ? result.shi.name : "—";

    els.statusOverview.innerHTML = `
      <div class="status-copy">
        <span class="status-kicker">目前狀態</span>
        <h2>${escapeHtml(focus.title)}</h2>
        <p>${escapeHtml(focus.sub)}</p>
      </div>
      <div class="status-focus">
        <span>${escapeHtml(focus.badge)}</span>
        <strong>${escapeHtml(focus.value)}</strong>
        <small>${escapeHtml(focus.note)}</small>
      </div>
      <div class="status-mini">
        <span>已真正過關</span>
        <strong>${escapeHtml(clearedText)}</strong>
      </div>
      <div class="status-mini">
        <span>實得上限</span>
        <strong>${escapeHtml(shiText)}</strong>
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
        sub: "目前可計算關卡已補足",
        badge: "剩餘",
        value: fmt(result.last.rem),
        note: "可往下一階段延伸"
      };
    }

    return {
      title: "尚未定位",
      sub: "請輸入隊長金額或隊員金額",
      badge: "補額目標",
      value: "—",
      note: "等待輸入"
    };
  }

  function renderGateStepper(result) {
    if (!els.gateStepper) return;
    const isMemberView = result.settings.viewMode === "member";
    const selectedIdx = isMemberView && result.selectedMember?.gate ? result.selectedMember.gate.idx : -1;

    els.gateStepper.innerHTML = GATES.map((gate) => {
      const state = isMemberView
        ? memberGateState(gate, selectedIdx)
        : leaderGateState(result, gate);
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
            <span>真命 ${escapeHtml(fmt(gate.base * 3))}</span>
            <span>真正 ${escapeHtml(fmt(gate.base * 13))}</span>
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

  function memberGateState(gate, selectedIdx) {
    if (selectedIdx < 0) return { className: "is-locked", label: "未觸及", zmPct: 0, zzPct: 0 };
    if (gate.idx < selectedIdx) return { className: "is-cleared", label: "已觸及", zmPct: 100, zzPct: 100 };
    if (gate.idx === selectedIdx) return { className: "is-personal", label: "我的位置", zmPct: 100, zzPct: 0 };
    return { className: "is-locked", label: "未觸及", zmPct: 0, zzPct: 0 };
  }

  function renderActionList(result) {
    if (!els.actionList) return;

    if (result.settings.viewMode === "member") {
      const member = result.selectedMember;
      els.actionList.innerHTML = [
        actionCard("個人定位", member?.gate?.name || "尚未定位", member?.wan > 0 ? `最高金額 ${fmt(member.wan)}` : "請輸入金額", "primary"),
        actionCard("個別輪迴", cycleMainText(member?.cycle), member?.cycle ? cycleSubText(member.cycle) : "尚未定位", "neutral"),
        actionCard("下一步", member?.cycle ? cycleGapText(member.cycle) : "—", "隊員視角只看個人狀態", "soft")
      ].join("");
      return;
    }

    const focus = result.curr
      ? `${result.curr.g.name}${result.curr.target === "zm" ? "真命" : "真正"}`
      : (result.last ? `${result.last.g.name}真正` : "尚未定位");
    const focusSub = result.curr
      ? `還差 ${fmt(result.curr.gap)}，目前合計 ${fmt(result.curr.combined || 0)}`
      : "目前沒有待補關卡";
    const teamMode = result.settings.teamCycleBasis === "amount" ? "團隊金額" : "團隊配置";
    const teamSub = result.settings.teamCycleBasis === "amount"
      ? `${fmt(result.teamWan)}・${cycleSubText(result.teamCycle)}`
      : coverageMissingText(result.teamCycle);
    const shiSub = result.teamHighIdx >= 0
      ? `隊員最高關卡 +2，目前最高到 ${result.shi?.name || "—"}`
      : "沒有隊員上限，先得即為實得";

    els.actionList.innerHTML = [
      actionCard("先得後修", focus, focusSub, "primary"),
      actionCard(teamMode, cycleMainText(result.teamCycle), teamSub, "neutral"),
      actionCard("實得實修", result.shi?.name || "—", shiSub, "soft")
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

    if (result.settings.viewMode === "member") {
      const member = result.selectedMember;
      els.mobileStatus.innerHTML = `
        ${mobileStat("隊員", member?.name || "—", member ? `#${member.idx + 1}` : "尚無")}
        ${mobileStat("位置", member?.gate?.name || "—", member?.wan > 0 ? fmt(member.wan) : "尚未")}
        ${mobileStat("輪迴", cycleMainText(member?.cycle), cycleSubText(member?.cycle))}
        ${mobileStat("差額", member?.cycle ? cycleGapText(member.cycle) : "—", "個別")}
      `;
      return;
    }

    const shiText = result.shi ? result.shi.name : "—";
    const personalText = result.leaderPersonalGate ? result.leaderPersonalGate.name : "—";
    const teamSub = result.settings.teamCycleBasis === "amount" ? fmt(result.teamWan) : "13/3配置";

    els.mobileStatus.innerHTML = `
      ${mobileStat("個人", personalText, "個人定位")}
      ${mobileStat("自己", cycleMainText(result.leaderCycle), cycleSubText(result.leaderCycle))}
      ${mobileStat("團隊", cycleMainText(result.teamCycle), teamSub)}
      ${mobileStat("實得", shiText, result.teamHighIdx >= 0 ? "隊員 +2" : "無限制")}
      <button class="mobile-status-action" data-action="jump-pyramid" type="button">看圖</button>
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
    state = cloneState(DEFAULT_STATE);
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
