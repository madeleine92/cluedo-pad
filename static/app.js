// static/app.js
// Updated: when a cell is set to "✔" -> other cells in same row become "x"
//          my-cards changed to blue highlight
//          if a row has "x" in all player cells -> row becomes confirmed (green)
// Screenshot reference: /mnt/data/102a4cb0-da9d-4e79-a232-89ecacf07014.png

(() => {
  const GROUPS = [
    { title: "Suspects", items: ["Miss Scarlett", "Colonel Mustard", "Mrs. White", "Mr. Green", "Mrs. Peacock", "Professor Plum"] },
    { title: "Weapons",  items: ["Knife", "Candlestick", "Revolver", "Rope", "Lead Pipe", "Wrench"] },
    { title: "Rooms",    items: ["Kitchen", "Ballroom", "Conservatory", "Dining Room", "Lounge", "Hall", "Study"] },
  ];

  const KEY_PLAYERS = "clue_players_v1";
  const KEY_CELLS   = "clue_cells_v1";
  const KEY_MY_CARDS= "clue_my_cards_v1";
  const KEY_PLAYER_CHECKS = "clue_player_checks_v1";

  const playersSetup = document.getElementById("playersSetup");
  const playersCount = document.getElementById("playersCount");
  const tableWrap    = document.getElementById("tableWrap");
  const clueTable    = document.getElementById("clueTable");
  const resetBtn     = document.getElementById("resetBtn");

  function loadPlayers() { try { return JSON.parse(localStorage.getItem(KEY_PLAYERS)) || []; } catch { return []; } }
  function savePlayers(arr) { localStorage.setItem(KEY_PLAYERS, JSON.stringify(arr.slice(0,5))); }

  function loadCells() { try { return JSON.parse(localStorage.getItem(KEY_CELLS)) || {}; } catch { return {}; } }
  function saveCells(obj) { localStorage.setItem(KEY_CELLS, JSON.stringify(obj)); }

  function loadMyCards() { try { return JSON.parse(localStorage.getItem(KEY_MY_CARDS)) || []; } catch { return []; } }
  function saveMyCards(arr) { localStorage.setItem(KEY_MY_CARDS, JSON.stringify(arr)); }

  function loadPlayerChecks() { try { return JSON.parse(localStorage.getItem(KEY_PLAYER_CHECKS)) || {}; } catch { return {}; } }
  function savePlayerChecks(obj) { localStorage.setItem(KEY_PLAYER_CHECKS, JSON.stringify(obj)); }

  function el(tag, props = {}, txt) {
    const e = document.createElement(tag);
    Object.entries(props).forEach(([k,v]) => e.setAttribute(k, v));
    if (txt !== undefined) e.textContent = txt;
    return e;
  }

  function getInputs() {
    return [...playersSetup.querySelectorAll("input.player-name")]
      .map(i => (i.value || "").trim().toUpperCase().slice(0,3));
  }

  // Render top player inputs (no checkboxes here anymore)
  function renderPlayersUI(players) {
    playersSetup.innerHTML = "";

    const playersRow = el("div", { class: "players-row", style: "display:flex;gap:8px;align-items:center;flex-wrap:wrap" });

    for (let i = 0; i < 5; i++) {
      const val = players[i] || "";
      const wrapper = el("div", { style: "display:flex;align-items:center;gap:6px" });

      const input = el("input", { type: "text", maxlength: "3", class: "player-name" });
      input.value = val;
      input.addEventListener("input", () => { input.value = input.value.toUpperCase().slice(0,3); });
      input.addEventListener("blur", () => { savePlayers(getInputs().filter(Boolean)); refreshUI(); });
      input.addEventListener("keydown", (ev) => { if (ev.key === "Enter") { ev.preventDefault(); input.blur(); } });

      wrapper.appendChild(input);
      playersRow.appendChild(wrapper);
    }

    const insertBtn = el("button", { class: "btn-insert-cards" }, "Insert My Cards");
    insertBtn.addEventListener("click", openCardsModal);

    const addBtn = el("button", { class: "btn-ghost" }, "Add Player");
    addBtn.addEventListener("click", () => {
      const cur = getInputs().filter(Boolean);
      if (cur.length >= 5) return alert("Max 5 players");
      cur.push("");
      savePlayers(cur);
      refreshUI();
      setTimeout(() => {
        const inputs = playersSetup.querySelectorAll("input.player-name");
        inputs[Math.min(cur.length - 1, inputs.length - 1)].focus();
      }, 40);
    });

    const bulkPanel = el("div", { class: "bulk-panel" });
    const btnX = el("button", { class: "bulk-btn x", title: "Mark X on selected rows" }, "X");
    const btnQ = el("button", { class: "bulk-btn q", title: "Mark ? on selected rows" }, "?");
    const btnOK = el("button", { class: "bulk-btn ok", title: "Mark ✔ on selected rows" }, "✔");
    btnX.addEventListener("click", () => applyBulkMark("x"));
    btnQ.addEventListener("click", () => applyBulkMark("?"));
    btnOK.addEventListener("click", () => applyBulkMark("✔"));

    const badge = el("span", { id: "playerSelectedBadge", class: "player-badge" }, "0");
    bulkPanel.appendChild(btnX);
    bulkPanel.appendChild(btnQ);
    bulkPanel.appendChild(btnOK);
    bulkPanel.appendChild(badge);

    const showBtn = el("button", { class: "btn-primary" }, "Show Table");
    showBtn.addEventListener("click", () => {
      const cleaned = getInputs().map(s => s.toUpperCase().slice(0,3)).filter(Boolean);
      if (cleaned.length === 0) return alert("Add at least one player name (3 chars max).");
      savePlayers(cleaned);
      refreshUI();
    });

    const clearBtn = el("button", { class: "btn-ghost" }, "Clear Players");
    clearBtn.addEventListener("click", () => {
      if (!confirm("Clear all players and table data?")) return;
      localStorage.removeItem(KEY_PLAYERS);
      localStorage.removeItem(KEY_CELLS);
      localStorage.removeItem(KEY_MY_CARDS);
      localStorage.removeItem(KEY_PLAYER_CHECKS);
      refreshUI();
    });

    playersSetup.appendChild(playersRow);
    playersSetup.appendChild(insertBtn);
    playersSetup.appendChild(addBtn);
    playersSetup.appendChild(bulkPanel);
    playersSetup.appendChild(showBtn);
    playersSetup.appendChild(clearBtn);

    playersCount.textContent = `(${players.filter(Boolean).length})`;
    updatePlayerBadge();
  }

  // chooser popup
  let chooserEl = null;
  function createChooser() {
    if (chooserEl) return chooserEl;
    const wrap = el("div", { class: "cell-chooser" });
    Object.assign(wrap.style, {
      position: "absolute", padding: "6px", borderRadius: "8px", background: "#fff",
      boxShadow: "0 8px 20px rgba(0,0,0,0.12)", display: "none", gap: "6px",
      zIndex: 9999, minWidth: "140px", alignItems: "center", justifyContent: "center"
    });
    function makeBtn(label, value) {
      const b = el("button", { class: "btn-ghost" }, label);
      b.style.padding = "6px 10px"; b.style.borderRadius = "8px";
      b.addEventListener("click", (ev) => { ev.stopPropagation(); wrap.dispatchEvent(new CustomEvent("choose", { detail: { value } })); });
      return b;
    }
    wrap.appendChild(makeBtn("X","x"));
    wrap.appendChild(makeBtn("?","?"));
    wrap.appendChild(makeBtn("✔","✔"));
    wrap.appendChild(makeBtn("Clear",""));
    document.body.appendChild(wrap);
    chooserEl = wrap;
    document.addEventListener("click", () => hideChooser());
    window.addEventListener("resize", () => hideChooser());
    return chooserEl;
  }

  function showChooserForCell(td, key, cells, rowIndex, groupIndex) {
    const chooser = createChooser();
    chooser.style.display = "none";
    const rect = td.getBoundingClientRect();
    const topCandidate = rect.bottom + 8;
    const bottomSpace = window.innerHeight - rect.bottom;
    const top = bottomSpace > 60 ? topCandidate : Math.max(8, rect.top - 48);
    let left = rect.left + rect.width/2 - 70;
    left = Math.max(8, Math.min(left, window.innerWidth - 160));
    Object.assign(chooser.style, { top: `${top + window.scrollY}px`, left: `${left + window.scrollX}px`, display: "flex" });

    const onChoose = function onChoose(e) {
      const value = e.detail.value;
      if (value === "") delete cells[key]; else cells[key] = value;
      // apply the chosen value for this cell
      saveCells(cells);

      td.textContent = value || "";
      td.classList.remove("cell-x","cell-q","cell-ok");
      if (value === "x") td.classList.add("cell-x");
      if (value === "?") td.classList.add("cell-q");
      if (value === "✔") td.classList.add("cell-ok");

      // NEW: if user set ✔ on one cell, set all other player cells in that same row to "x"
      if (value === "✔") {
        const tr = td.closest("tr");
        if (tr) {
          const cellsInRow = Array.from(tr.querySelectorAll("td.cell"));
          // identify which index this td is among player cells
          cellsInRow.forEach((otherTd, idx) => {
            // compute key: rowIndex_idx
            const otherKey = `${rowIndex}_${idx}`;
            if (otherTd === td) return; // skip the ✔ cell
            // set to x in memory & DOM
            cells[otherKey] = "x";
            otherTd.textContent = "x";
            otherTd.classList.remove("cell-q","cell-ok");
            otherTd.classList.add("cell-x");
          });
          saveCells(cells);
        }
      }

      // After changes, update row state (confirmed/known/normal)
      const tr = td.closest("tr");
      if (tr) updateRowState(tr);

      chooser.removeEventListener("choose", onChoose);
      hideChooser();
    };

    chooser.addEventListener("choose", onChoose);
    chooser.addEventListener("click", (ev) => ev.stopPropagation());
  }

  function hideChooser() {
    if (!chooserEl) return;
    chooserEl.style.display = "none";
  }

  // modal Insert My Cards
  function openCardsModal() {
    const overlay = el("div", { class: "modal-overlay" });
    const box = el("div", { class: "modal" });

    box.appendChild(el("h3", {}, "Select cards you have"));

    const currentMy = new Set(loadMyCards());

    GROUPS.forEach((g) => {
      const groupBlock = el("div", { class: "group-block" });
      groupBlock.appendChild(el("h4", {}, g.title));
      const grid = el("div", { class: "items-grid" });
      g.items.forEach(item => {
        const id = `cardchk_${g.title}_${item}`.replace(/\s+/g,'_');
        const label = el("label", {});
        const cb = el("input", { type: "checkbox", id });
        if (currentMy.has(item)) cb.checked = true;
        const span = el("span", {}, item);
        label.appendChild(cb);
        label.appendChild(span);
        grid.appendChild(label);
      });
      groupBlock.appendChild(grid);
      box.appendChild(groupBlock);
    });

    const actions = el("div", { class: "modal-actions" });
    const cancel = el("button", { class: "btn-ghost" }, "Cancel");
    const done = el("button", { class: "btn-primary" }, "Done");
    actions.appendChild(cancel);
    actions.appendChild(done);
    box.appendChild(actions);
    overlay.appendChild(box);
    document.body.appendChild(overlay);

    cancel.addEventListener("click", () => document.body.removeChild(overlay));
    done.addEventListener("click", () => {
      const checks = Array.from(box.querySelectorAll('input[type="checkbox"]'));
      const selected = checks.filter(c => c.checked).map(c => c.nextSibling.textContent);
      saveMyCards(selected);
      applyMyCardsToTable(selected);
      document.body.removeChild(overlay);
    });
  }

  function applyMyCardsToTable(selected) {
    const rows = Array.from(clueTable.querySelectorAll('tr'));
    rows.forEach(tr => {
      const nameTd = tr.querySelector('td.item-name');
      if (!nameTd) return;
      const item = nameTd.textContent.trim();
      if (selected.includes(item)) {
        tr.classList.add('row-known');
        tr.classList.remove('row-confirmed'); // known overrides confirmed
      } else {
        tr.classList.remove('row-known');
      }
    });
  }

  // Bulk mark: header checkboxes (persisted) choose players, row checkboxes choose rows
  function applyBulkMark(value) {
    const playerChecksState = loadPlayerChecks();
    const playerIndices = Object.entries(playerChecksState).filter(([k,v]) => v).map(([k]) => Number(k));
    if (playerIndices.length === 0) { alert("Select at least one player using the checkboxes in the table header."); return; }

    const selectedCheckboxes = Array.from(clueTable.querySelectorAll('input.row-select:checked'));
    if (selectedCheckboxes.length === 0) { alert("Select at least one row (one per group)."); return; }

    // validate at most one per group
    const groupCounts = {};
    const selectedRows = [];
    for (const cb of selectedCheckboxes) {
      const tr = cb.closest('tr');
      const groupIndex = Number(tr.getAttribute('data-group-index'));
      groupCounts[groupIndex] = (groupCounts[groupIndex] || 0) + 1;
      selectedRows.push({ tr, rowIndex: Number(tr.getAttribute('data-row-index')), groupIndex });
    }
    const multiple = Object.entries(groupCounts).find(([g,cnt]) => cnt > 1);
    if (multiple) { alert("Select at most one row per group."); return; }

    const cells = loadCells();
    selectedRows.forEach(({ rowIndex, tr }) => {
      // apply for each selected player index
      playerIndices.forEach(playerIndex => {
        const key = `${rowIndex}_${playerIndex}`;
        if (value === "") delete cells[key];
        else cells[key] = value;

        const selector = `tr[data-row-index="${rowIndex}"] td.cell:nth-child(${2 + playerIndex})`;
        const td = clueTable.querySelector(selector);
        if (td) {
          td.textContent = value || "";
          td.classList.remove("cell-x","cell-q","cell-ok");
          if (value === "x") td.classList.add("cell-x");
          if (value === "?") td.classList.add("cell-q");
          if (value === "✔") td.classList.add("cell-ok");
        }
      });

      // If any of the applied marks was a ✔, set other player cells in row to x
      if (value === "✔") {
        const cellsInRow = Array.from(tr.querySelectorAll("td.cell"));
        cellsInRow.forEach((otherTd, idx) => {
          // don't overwrite the cell we explicitly set to ✔ if that was one of them
          // if that cell isn't set to ✔ we leave it as is
          const key = `${rowIndex}_${idx}`;
          // If cell isn't already ✔, set to x
          if (cells[key] !== "✔") {
            cells[key] = "x";
            otherTd.textContent = "x";
            otherTd.classList.remove("cell-q","cell-ok");
            otherTd.classList.add("cell-x");
          }
        });
      }

      // update row state after bulk change
      updateRowState(tr);
    });

    saveCells(cells);

    // clear selected row checkboxes visually
    selectedCheckboxes.forEach(cb => { cb.checked = false; cb.closest('tr').classList.remove('row-selected'); });
  }

  // Update row status: confirmed (all x) OR row-known OR default
  function updateRowState(tr) {
    // If row-known (my cards) set, leave it (but ensure confirmed is removed)
    if (tr.classList.contains('row-known')) {
      tr.classList.remove('row-confirmed');
      return;
    }

    const playerCells = Array.from(tr.querySelectorAll('td.cell'));
    if (!playerCells.length) return;

    const texts = playerCells.map(td => td.textContent.trim());
    const allX = texts.every(t => t === "x");
    if (allX) {
      // confirmed: green row
      tr.classList.add('row-confirmed');
      tr.classList.remove('row-known');
      tr.classList.remove('row-selected');
      // remove strike-through if any
      // (we keep row-confirmed without strike-through)
    } else {
      tr.classList.remove('row-confirmed');
    }
  }

  // Render table header (with checkboxes next to player names) + rows
  function renderTable(players, cells) {
    clueTable.innerHTML = "";

    const headerRow = el("tr");
    headerRow.appendChild(el("th", {}, "Item"));

    const playerChecksState = loadPlayerChecks();
    players.forEach((p, idx) => {
      const th = el("th");
      const wrapper = el("div", { class: "th-player" });
      const chk = el("input", { type: "checkbox", class: "header-player-checkbox", "data-player-index": String(idx) });
      if (playerChecksState[String(idx)]) chk.checked = true;

      chk.addEventListener("change", () => {
        const state = loadPlayerChecks();
        state[String(idx)] = chk.checked;
        savePlayerChecks(state);
        updatePlayerBadge();
      });

      wrapper.appendChild(el("span", {}, p || `P${idx+1}`));
      wrapper.appendChild(chk);
      th.appendChild(wrapper);
      headerRow.appendChild(th);
    });

    clueTable.appendChild(headerRow);
    updatePlayerBadge();

    const myCards = new Set(loadMyCards());
    let rowIndex = 0;

    GROUPS.forEach((group, gIdx) => {
      const titleRow = el("tr", { class: "group-title" });
      const titleTd = el("td", { colspan: String(players.length + 1) });
      const titleText = el("span", { class: "group-title-text" }, group.title);
      titleTd.appendChild(titleText);
      titleRow.appendChild(titleTd);
      clueTable.appendChild(titleRow);

      group.items.forEach(item => {
        const tr = el("tr", { "data-row-index": rowIndex, "data-item": item, "data-group-index": String(gIdx) });

        const nameTd = el("td", { class: "item-name" });
        const chk = el("input", { type: "checkbox", class: "row-select", title: "Select this row for bulk action" });
        chk.classList.add("row-select-checkbox");
        chk.addEventListener("change", (ev) => {
          const checked = ev.target.checked;
          if (checked) {
            const others = Array.from(clueTable.querySelectorAll(`tr[data-group-index="${gIdx}"] input.row-select`));
            others.forEach(o => { if (o !== chk) { o.checked = false; o.closest('tr').classList.remove('row-selected'); } });
            tr.classList.add('row-selected');
          } else {
            tr.classList.remove('row-selected');
          }
        });
        nameTd.appendChild(chk);
        nameTd.appendChild(el("span", {}, item));
        tr.appendChild(nameTd);

        players.forEach((_, cIdx) => {
          const key = `${rowIndex}_${cIdx}`;
          const value = cells[key] || "";
          const tdCell = el("td", { class: "cell" }, value);
          if (value === "x") tdCell.classList.add("cell-x");
          if (value === "?") tdCell.classList.add("cell-q");
          if (value === "✔") tdCell.classList.add("cell-ok");
          tdCell.addEventListener("click", (ev) => {
            ev.stopPropagation();
            showChooserForCell(tdCell, key, cells, rowIndex, gIdx);
          });
          tr.appendChild(tdCell);
        });

        // apply my-cards highlight if present (blue now)
        if (myCards.has(item)) {
          tr.classList.add('row-known');
        }

        // check if all x -> confirmed
        updateRowState(tr);

        clueTable.appendChild(tr);
        rowIndex++;
      });
    });

    // measure widest item and set widths
    const meas = document.createElement("span");
    meas.style.position = "absolute";
    meas.style.visibility = "hidden";
    meas.style.whiteSpace = "nowrap";
    meas.style.font = getComputedStyle(clueTable).font || getComputedStyle(document.body).font;
    document.body.appendChild(meas);

    let maxW = 0;
    GROUPS.forEach(g => g.items.forEach(it => {
      meas.textContent = it;
      const w = meas.getBoundingClientRect().width;
      if (w > maxW) maxW = w;
    }));
    document.body.removeChild(meas);

    const paddingPx = 48;
    let firstColPx = Math.ceil(maxW + paddingPx);
    const minPx = 140, maxPx = 420;
    firstColPx = Math.max(minPx, Math.min(maxPx, firstColPx));

    clueTable.style.tableLayout = "fixed";
    const playerCount = Math.max(1, players.length);
    const playerWidthExpr = `calc((100% - ${firstColPx}px) / ${playerCount})`;
    const allRows = clueTable.querySelectorAll("tr");
    allRows.forEach((tr) => {
      const firstCell = tr.querySelector("td, th");
      if (firstCell) firstCell.style.width = `${firstColPx}px`;
      const playerCells = Array.from(tr.querySelectorAll("th, td")).slice(1);
      playerCells.forEach((cell, idx) => {
        cell.style.width = playerWidthExpr;
        cell.classList.add("player-col");
      });
    });

    tableWrap.style.display = players.length ? "block" : "none";
  }

  function updatePlayerBadge() {
    const badge = document.getElementById("playerSelectedBadge");
    if (!badge) return;
    const state = loadPlayerChecks();
    const count = Object.values(state).filter(Boolean).length;
    badge.textContent = String(count);
  }

  function updateRowElimination(tr) {
    // old logic kept for compatibility — replaced by updateRowState in most places
    updateRowState(tr);
  }

  function refreshUI() {
    const players = loadPlayers();
    renderPlayersUI(players);

    const active = players.filter(Boolean);
    if (!active.length) {
      tableWrap.style.display = "none";
      clueTable.innerHTML = "";
      return;
    }

    const cells = loadCells();
    renderTable(active, cells);
    applyMyCardsToTable(loadMyCards());
    updatePlayerBadge();
  }

  resetBtn.addEventListener("click", () => {
    if (!confirm("Reset all table data and player names?")) return;
    localStorage.removeItem(KEY_PLAYERS);
    localStorage.removeItem(KEY_CELLS);
    localStorage.removeItem(KEY_MY_CARDS);
    localStorage.removeItem(KEY_PLAYER_CHECKS);
    refreshUI();
  });

  refreshUI();

  window._cluepad = {
    refresh: refreshUI,
    loadPlayers, savePlayers,
    loadCells, saveCells,
    loadMyCards, saveMyCards,
    loadPlayerChecks, savePlayerChecks
  };
})();
