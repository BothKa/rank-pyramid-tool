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
  const CYCLES = CYCLE_NAMES.map((name, index) => {
    const lowerGate = GATES[index * 2];
    const upperGate = GATES[index * 2 + 1];
    const lowerCount = 13;
    const upperCount = 3;
    return {
      idx: index,
      name,
      lowerGate,
      upperGate,
      lowerCount,
      upperCount,
      passWan: lowerGate.base * lowerCount + upperGate.base * upperCount,
      col: upperGate.col
    };
  });

  const STATUS_TEXT = {
    covered: "隊員覆蓋",
    cleared: "清關",
    at_zm: "真命已達",
    wip: "前進中"
  };

  const DEFAULT_STATE = {
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

  function cycleProgressAt(wan, cycle) {
    const amount = Math.max(0, Number(wan) || 0);
    const progress = cycle.passWan > 0 ? Math.min(1, amount / cycle.passWan) : 0;
    return {
      amount,
      cycle,
      passed: amount >= cycle.passWan,
      progress,
      remaining: Math.max(0, cycle.passWan - amount)
    };
  }

  function cycleStatusFor(wan) {
    const amount = Math.max(0, Number(wan) || 0);
    const lastCycle = CYCLES[CYCLES.length - 1];
    const cleared = CYCLES.filter((cycle) => amount >= cycle.passWan).at(-1) || null;
    const allCleared = amount >= lastCycle.passWan;
    const current = allCleared ? lastCycle : CYCLES.find((cycle) => amount < cycle.passWan);
    const currentProgress = cycleProgressAt(amount, current);

    return {
      amount,
      cleared,
      current,
      allCleared,
      progress: currentProgress.progress,
      remaining: currentProgress.remaining
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
    const leaderWan = leaderAmts.reduce((sum, amount) => sum + toWan(amount.v), 0);
    if (leaderWan <= 0) return { steps: [], leaderWan: 0, tc: {} };

    const tc = teamCoverage(members);
    let rem = leaderWan;
    const steps = [];

    for (const gate of GATES) {
      const cnt = tc[gate.name] || 0;
      const tAmt = cnt * gate.base;
      const zz = gate.base * 13;
      const zm = gate.base * 3;
      const need = Math.max(0, zz - tAmt);

      if (tAmt >= zz) {
        steps.push({ g: gate, status: "covered", cnt, tAmt, zz, zm, rem });
        continue;
      }

      if (rem >= need) {
        rem -= need;
        steps.push({ g: gate, status: "cleared", cnt, tAmt, zz, zm, need, rem });
      } else {
        const combined = rem + tAmt;
        steps.push({
          g: gate,
          status: combined >= zm ? "at_zm" : "wip",
          cnt,
          tAmt,
          zz,
          zm,
          combined,
          rem,
          pct: combined / zz
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
    const cascade = calcCascade(state.leader.amounts || [], members);
    const positions = memberPositions(members);
    const effectiveCount = positions.filter((member) => member.wan > 0).length;
    const teamTier = teamTierFor(effectiveCount);
    const teamWan = teamWanOf(positions);
    const xian = xianGate(cascade.last, cascade.curr);
    const highIdx = teamHighGateIdx(positions);
    const shi = shiGate(xian, highIdx);
    const leaderCycle = cycleStatusFor(cascade.leaderWan);
    const teamCycle = cycleStatusFor(teamWan);
    const cycleRows = CYCLES.map((cycle) => ({
      cycle,
      leader: cycleProgressAt(cascade.leaderWan, cycle),
      team: cycleProgressAt(teamWan, cycle)
    }));

    const leaderPersonalGate = gateFor(maxWanOf(state.leader.amounts));

    return {
      ...cascade,
      positions,
      effectiveCount,
      teamTier,
      teamWan,
      leaderCycle,
      teamCycle,
      cycleRows,
      xian,
      xianInProgress: cascade.curr?.status === "wip",
      teamHighIdx: highIdx,
      shi,
      leaderPersonalGate
    };
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
    toWan,
    gateFor,
    teamTierFor,
    maxWanOf,
    cycleProgressAt,
    cycleStatusFor,
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
    leaderName: document.getElementById("leaderName"),
    leaderAmounts: document.getElementById("leaderAmounts"),
    members: document.getElementById("members"),
    summary: document.getElementById("summary"),
    mobileStatus: document.getElementById("mobileStatus"),
    pyramid: document.getElementById("pyramid"),
    cycleRows: document.getElementById("cycleRows"),
    cascadeRows: document.getElementById("cascadeRows"),
    memberRows: document.getElementById("memberRows"),
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
    renderSummary(result);
    renderMobileStatus(result);
    renderMemberInlineStatus(result);
    renderPyramid(result);
    renderCycles(result);
    renderCascade(result);
    renderMembers(result);
  }

  function renderInputs() {
    if (document.activeElement !== els.leaderName) {
      els.leaderName.value = state.leader.name;
    }
    renderAmountList(els.leaderAmounts, state.leader.amounts, "leader");
    renderMemberList();
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
    const xianText = result.xian ? result.xian.name : "—";
    const shiText = result.shi ? result.shi.name : "—";
    const teamText = result.teamTier ? `${result.teamTier.label} ${result.teamTier.desc}` : "—";
    const progress = result.xianInProgress ? "前進中" : "已達真命";
    const personalText = result.leaderPersonalGate ? result.leaderPersonalGate.name : "—";

    els.summary.innerHTML = [
      metric("隊長總額", fmt(result.leaderWan), `${state.leader.amounts.length} 筆加總`),
      metric("隊長個人", personalText, result.leaderPersonalGate ? "個人最高金額定位" : "尚無有效金額"),
      metric("自己輪迴", cycleMainText(result.leaderCycle), cycleSubText(result.leaderCycle)),
      metric("團隊輪迴", cycleMainText(result.teamCycle), `${fmt(result.teamWan)}・${cycleSubText(result.teamCycle)}`),
      metric("先得後修", xianText, result.xian ? progress : "尚未定位"),
      metric("實得實修", shiText, result.teamHighIdx >= 0 ? `隊員最高 +2 上限` : "無隊員限制"),
      metric("有效隊員", `${result.effectiveCount} 人`, teamText)
    ].join("");
  }

  function renderMobileStatus(result) {
    if (!els.mobileStatus) return;

    const shiText = result.shi ? result.shi.name : "—";
    const personalText = result.leaderPersonalGate ? result.leaderPersonalGate.name : "—";

    els.mobileStatus.innerHTML = `
      ${mobileStat("個人", personalText, "個人定位")}
      ${mobileStat("自己", cycleMainText(result.leaderCycle), cycleSubText(result.leaderCycle))}
      ${mobileStat("團隊", cycleMainText(result.teamCycle), fmt(result.teamWan))}
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
    if (status.allCleared) return "已全數通關";
    if (status.cleared) return `${status.cleared.name}已通關`;
    return `差 ${fmt(status.remaining)}`;
  }

  function mobileStat(label, value, sub) {
    return `<div class="mobile-stat"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small></div>`;
  }

  function metric(label, value, sub) {
    return `<div class="metric"><span>${escapeHtml(label)}</span><strong>${escapeHtml(value)}</strong><small>${escapeHtml(sub)}</small></div>`;
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
    const xianIdx = result.xian ? result.xian.idx : -1;
    const shiIdx = result.shi ? result.shi.idx : -1;
    const parts = [];

    parts.push(`<svg class="pyramid-svg" viewBox="0 0 ${width} ${height}" role="img" aria-label="金字塔三色定位圖">`);
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
        const gateZone = zone(gate.idx, shiIdx, xianIdx);
        const fill = gateZone === 2 ? "url(#mutedGate)" : `url(#gateGradient${gate.idx})`;
        const cellClass = gateZone === 0 ? "is-solid" : gateZone === 1 ? "is-nominal" : "is-muted";
        const cx = isLeft
          ? (left0 + center + center + left1) / 4
          : (center + right0 + right1 + center) / 4;
        const cy = (y0 + y1) / 2;

        positions[gate.idx] = { x: cx, y: cy };
        parts.push(`<polygon class="pyramid-cell ${cellClass}" points="${points}" fill="${fill}"></polygon>`);

        if (tier < 4) {
          parts.push(`<text class="gate-text" x="${cx}" y="${cy - 4}" text-anchor="middle">${escapeHtml(gate.name)}</text>`);
          parts.push(`<text class="gate-subtext" x="${cx}" y="${cy + 18}" text-anchor="middle">${escapeHtml(fmt(gate.base))}</text>`);
        } else {
          const labelX = isLeft ? 92 : width - 92;
          const labelY = gate.idx === 8 ? 72 : 104;
          const anchor = isLeft ? "start" : "end";
          parts.push(`<path class="external-callout" d="M ${cx} ${cy} C ${isLeft ? cx - 72 : cx + 72} ${cy - 8}, ${isLeft ? labelX + 96 : labelX - 96} ${labelY - 22}, ${labelX} ${labelY - 8}" stroke="${gate.col}"></path>`);
          parts.push(`<text class="external-label" x="${labelX}" y="${labelY}" text-anchor="${anchor}">${escapeHtml(gate.name)}</text>`);
          parts.push(`<text class="external-subtext" x="${labelX}" y="${labelY + 18}" text-anchor="${anchor}">${escapeHtml(fmt(gate.base))}</text>`);
        }
      });
    }

    parts.push(`</g>`);
    parts.push(...renderStatusRings(result, positions));
    parts.push(...renderMarkers(result, positions));
    parts.push(`</svg>`);
    els.pyramid.innerHTML = parts.join("");

    function halfAt(y) {
      const progress = Math.max(0, Math.min(1, (y - top) / pyramidHeight));
      return (pyramidWidth / 2) * progress;
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
      const need = step.status === "cleared" ? fmt(step.need) : step.status === "covered" ? "0萬" : fmt(Math.max(0, step.zz - step.tAmt));
      const rem = step.status === "wip" || step.status === "at_zm"
        ? `${fmt(step.rem)} / 合計 ${fmt(step.combined)}`
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
        <td><strong>${escapeHtml(cycle.name)}</strong><small>${escapeHtml(fmt(cycle.passWan))} 通關</small></td>
        <td>${escapeHtml(cycle.lowerGate.name)} / ${escapeHtml(cycle.upperGate.name)}</td>
        <td><strong>${cycle.lowerCount} 個 ${escapeHtml(fmt(cycle.lowerGate.base))}</strong><small>+ ${cycle.upperCount} 個 ${escapeHtml(fmt(cycle.upperGate.base))}</small></td>
        <td>${cycleProgressCell(leader)}</td>
        <td>${cycleProgressCell(team)}</td>
      </tr>
    `).join("");
  }

  function cycleProgressCell(progress) {
    const status = progress.passed ? "cleared" : "wip";
    const label = progress.passed ? "通關" : "進行中";
    const sub = progress.passed
      ? `${fmt(progress.amount)} / ${fmt(progress.cycle.passWan)}`
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
    if (result.positions.length === 0) {
      els.memberRows.innerHTML = `<tr><td class="empty-row" colspan="4">—</td></tr>`;
      return;
    }

    els.memberRows.innerHTML = result.positions.map((member) => `
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
    if (!target || target.tagName !== "INPUT") return;

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
