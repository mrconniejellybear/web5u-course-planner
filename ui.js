const PlannerUI = (() => {
  const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  const timeAgo = (ts) => {
    const d = new Date(ts);
    return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" }) +
      (new Date().toDateString() === d.toDateString() ? "" : ` on ${d.toLocaleDateString([], { month: "short", day: "numeric" })}`);
  };

  const seatBadge = (s) => {
    if (s.seats > 0) return `<span class="pill ok">${esc(s.seats)} open</span>`;
    if (s.waitCount != null && s.waitCount > 0) return `<span class="pill full">Full · ${esc(s.waitCount)} waitlisted</span>`;
    return `<span class="pill full">Full</span>`;
  };

  const TAB_ICONS = {
    courses: `<svg width="11px" height="11px" fill="currentColor" version="1.1" viewBox="18 18 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="m74 37h-48c-2.2109 0-4 1.7891-4 4s1.7891 4 4 4h48c2.2109 0 4-1.7891 4-4s-1.7891-4-4-4z"/>
 <path d="m22 23c0 1.0625 0.42188 2.0781 1.1719 2.8281s1.7656 1.1719 2.8281 1.1719h48c2.2109 0 4-1.7891 4-4s-1.7891-4-4-4h-48c-2.2109 0-4 1.7891-4 4z"/>
 <path d="m74 55h-48c-2.2109 0-4 1.7891-4 4s1.7891 4 4 4h48c2.2109 0 4-1.7891 4-4s-1.7891-4-4-4z"/>
 <path d="m26 81h26c2.2109 0 4-1.7891 4-4s-1.7891-4-4-4h-26c-2.2109 0-4 1.7891-4 4s1.7891 4 4 4z"/>
</svg>`,
    schedule: `<svg width="13px" height="13px" fill="currentColor" version="1.1" viewBox="18 18 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="m34 19c-2.2109 0-4 1.7891-4 4v4.1797c-5.7695 0.97656-9.9922 5.9688-10 11.82v30c0 6.6289 5.3711 12 12 12h36c6.6289 0 12-5.3711 12-12v-30c-0.007812-5.8516-4.2305-10.844-10-11.82v-4.1797c0-2.2109-1.7891-4-4-4s-4 1.7891-4 4v4h-8v-4c0-2.2109-1.7891-4-4-4s-4 1.7891-4 4v4h-8v-4c0-1.0625-0.42188-2.0781-1.1719-2.8281s-1.7656-1.1719-2.8281-1.1719zm38 50c0 1.0625-0.42188 2.0781-1.1719 2.8281s-1.7656 1.1719-2.8281 1.1719h-36c-2.2109 0-4-1.7891-4-4v-18h44zm-26-34h22c1.0625 0 2.0781 0.42188 2.8281 1.1719s1.1719 1.7656 1.1719 2.8281v4h-44v-4c0-2.2109 1.7891-4 4-4z"/>
</svg>`,
    compare: `<svg width="13px" height="13px" fill="currentColor" version="1.1" viewBox="18 18 64 64" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false">
      <path d="m81 31c0-6.6289-5.3711-12-12-12h-38c-6.6289 0-12 5.3711-12 12v38c0 6.6289 5.3711 12 12 12h38c6.6289 0 12-5.3711 12-12zm-26-4v46h-10v-46zm-28 42v-38c0-2.2109 1.7891-4 4-4h6v46h-6c-2.2109 0-4-1.7891-4-4zm46 0c0 1.0625-0.42188 2.0781-1.1719 2.8281s-1.7656 1.1719-2.8281 1.1719h-6v-46h6c1.0625 0 2.0781 0.42188 2.8281 1.1719s1.1719 1.7656 1.1719 2.8281z"/>
</svg>`,
  };

  const BRAND_ICON = `<svg class="brand-icon" width="48" height="34" viewBox="0 0 216 135" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true" focusable="false"><path d="M209.036 1.99219C212.235 1.99241 214.828 4.58545 214.828 7.78418V20.1182C214.828 23.8266 213.226 27.0449 210.16 29.3213C207.108 31.5874 202.637 32.8984 196.911 32.8984C191.13 32.8984 186.645 31.5879 183.592 29.3213C180.524 27.044 178.938 23.8253 178.938 20.1182V7.78418C178.938 4.58545 181.531 1.99241 184.729 1.99219C187.928 1.99219 190.522 4.58531 190.522 7.78418V20.2402C190.522 21.6921 190.879 22.843 191.782 23.6455C192.7 24.4609 194.276 25.0029 196.911 25.0029C199.517 25.0029 201.079 24.4612 201.989 23.6465C202.886 22.8439 203.243 21.6922 203.243 20.2402V7.78418C203.243 4.58531 205.837 1.99219 209.036 1.99219Z" fill="#93C4FF" stroke="#93C4FF"/> <path d="M157.692 27.0272C157.692 31.4455 154.11 35.0272 149.692 35.0272H74.013C70.3899 35.0272 67.1662 37.4593 66.6709 41.0484C66.4715 42.4934 66.3223 43.9891 66.2233 45.5353C65.9793 49.3453 65.8574 53.2782 65.8574 57.334C65.8574 58.1764 65.8574 59.0189 65.8574 59.8614C65.8574 64.8707 61.3061 68.6477 56.3827 67.7243L6.5253 58.3734C2.7417 57.6638 0 54.36 0 50.5104C0 46.19 0 41.9507 0 37.7925C0 31.4016 0 25.0721 0 18.8041C0 15.2027 0 11.6014 0 8C0 3.58172 3.58172 0 8 0L149.692 0C154.11 0 157.692 3.58172 157.692 8V27.0272ZM72.9919 71.5292C74.2115 67.4734 76.2238 63.7863 79.0289 60.468C81.9558 57.1496 85.4317 54.2614 89.4563 51.8034C93.6029 49.3453 98.1153 47.5018 102.994 46.2728C107.994 44.9208 113.116 44.2449 118.36 44.2449C123.117 44.2449 127.995 44.9208 132.995 46.2728C137.996 47.5018 142.813 49.3453 147.447 51.8034C152.082 54.1385 156.228 57.0267 159.887 60.468C163.668 63.7863 166.595 67.5349 168.668 71.7135C170.863 75.8922 171.961 80.4396 171.961 85.3557C171.961 93.0986 169.766 100.043 165.375 106.188C161.107 112.21 155.131 117.372 147.447 121.673C139.764 125.852 130.983 129.048 121.104 131.26C111.226 133.472 100.676 134.578 89.4563 134.578C78.9679 134.578 68.6014 133.533 58.357 131.444C48.2344 129.232 38.9656 126.036 30.5505 121.858C22.1354 117.679 15.3057 112.517 10.0615 106.372C6.59804 102.232 4.11867 97.6906 2.62344 92.7468C1.33277 88.4793 4.73159 84.5217 9.17669 84.1781L60.1795 80.2353C64.3272 79.9146 67.7802 83.6003 70.6137 86.6462C72.5651 88.6126 75.2482 90.1489 78.663 91.255C82.0778 92.3612 86.0415 92.9142 90.5539 92.9142C93.6029 92.9142 96.5298 92.5455 99.3349 91.8081C102.262 91.0707 104.884 89.9646 107.201 88.4897C109.518 87.0149 111.348 85.2328 112.689 83.1435C114.153 80.9312 114.885 78.4117 114.885 75.585C114.885 71.2834 112.933 68.1494 109.031 66.1829C105.128 64.2165 100.311 63.2333 94.5785 63.2333C91.4076 63.2333 88.1757 63.5405 84.8828 64.155C81.7119 64.7696 79.0289 65.6913 76.8336 66.9204C74.6384 68.1494 73.3578 69.6857 72.9919 71.5292Z" fill="white"/></svg>`;

  const COLORS = [
    ["#dbe8fb", "#0b3d91"], ["#dcf2e3", "#14532d"], ["#fde7d4", "#7c2d12"], ["#ece1fb", "#4c1d95"],
    ["#d7f1f3", "#134e4a"], ["#fbe0ea", "#831843"], ["#f4efd2", "#5b4a06"], ["#e2e6ec", "#1f2937"],
  ];
  const colorCss = COLORS.map(([bg, fg], i) =>
    `.c${i} { --bg:${bg}; --fg:${fg}; }`).join("\n");

  const STYLES = `
    :host { all: initial; }
    * { box-sizing: border-box; }
    .root { font: 14px/1.45 system-ui, -apple-system, "Segoe UI", sans-serif; color: #1b2330; }
    .root.dragging, .root.dragging * { cursor: grabbing !important; user-select: none; }
    button { font: inherit; cursor: pointer; color: inherit; }
    button[disabled] { cursor: default; opacity: .5; }
    :focus-visible { outline: 3px solid #f2a900; outline-offset: 2px; }
    ${colorCss}

    .launcher { position: fixed; right: 16px; bottom: 72px; z-index: 2147483646;
      background: #083a8b; color: #fff; border: 0; border-radius: 999px;
      padding: 10px 16px; font-weight: 600; box-shadow: 0 4px 14px rgba(0,0,0,.25); }
    .launcher:hover { background: #00306a; }
    .launcher.alert { background: #17613a; }

    .panel { position: fixed; top: 12px; right: 12px; bottom: 12px; width: min(400px, calc(100vw - 24px));
      z-index: 2147483647; background: #fff; border-radius: 14px; display: flex; flex-direction: column;
      box-shadow: 0 10px 40px rgba(0,0,0,.28); border: 1px solid #d5dbe5; overflow: hidden; }
    .panel.wide { width: min(1120px, calc(100vw - 24px)); }
    .panel[hidden] { display: none; }

    header.top { background: #083a8b; color: #fff; padding: 12px 16px 0; }
    header.top .row { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    header.top h2 { margin: 0; font-size: 17px; }
    header.top .sub { opacity: .85; font-size: 12px; margin-top: -2px; }
    header.top .brand { display: flex; align-items: center; gap: 10px; }
    header.top .brand-icon { flex: none; }
    .icon-btn { background: transparent; border: 0; color: inherit; border-radius: 8px; padding: 4px 8px; font-size: 20px; line-height: 1; }
    .icon-btn:hover { background: rgba(255,255,255,.15); }
    .views { display: flex; gap: 4px; margin-top: 10px; }
    .views button { background: transparent; border: 0; color: #fff; opacity: .8; padding: 8px 12px 7px;
      border-radius: 8px 8px 0 0; font-weight: 600; }
    .views button:hover { opacity: 1; background: rgba(255,255,255,.1); }
    .views button[aria-selected="true"] { background: #fff; color: #003f87; opacity: 1; }
    .views button { display: inline-flex; align-items: center; gap: 6px; }
    .views button svg { flex: none; }

    .notice { margin: 10px 14px 0; font-size: 13px; background: #e3f4e8; color: #17613a; border-radius: 10px;
      padding: 8px 10px; display: flex; gap: 10px; align-items: center; justify-content: space-between; flex-wrap: wrap; }
    .notice.warn { background: #fff7e0; color: #6b4e00; }

    .body { overflow-y: auto; padding: 12px 14px 16px; flex: 1; min-height: 0; }
    h3 { font-size: 12px; text-transform: uppercase; letter-spacing: .06em; color: #5a6475; margin: 14px 2px 8px; }
    h3:first-child { margin-top: 2px; }
    h4 { font-size: 12px; color: #5a6475; margin: 0 0 6px; font-weight: 600; }
    .tip { color: #5a6475; font-size: 12px; margin: 0 2px 10px; line-height: 15px; }
    .tip.center { text-align: center; }
    .muted { color: #5a6475; font-weight: 400; }

    .btn { display: flex; align-items: center; border-radius: 8px; padding: 6px 10px; font-size: 13px; font-weight: 600; white-space: nowrap; }
    .btn svg{ margin-left: -4px; margin-right: 3px; }
    .btn.primary { background: #003f87; color: #fff; border: 0; }
    .btn.primary:hover { background: #00306a; }
    .btn.ghosty { background: #fff; border: 1px solid #c8d0dc; color: #1b2330; }
    .btn.ghosty:hover:not([disabled]) { background: #f2f5f9; }
    .danger-text { color: #9b1c1c !important; }

    .summary-stats { display: flex; gap: 8px; margin-bottom: 4px; }
    .sstat { background: #f2f6fb; border-radius: 10px; padding: 6px 10px; }
    .sstat b { font-size: 18px; display: block; line-height: 1.1; color: #003f87; }
    .sstat span { font-size: 12px; color: #5a6475; }

    .gurs { display: flex; flex-wrap: wrap; gap: 6px; }
    .gur { background: #eaf1fb; color: #003f87; border-radius: 999px; padding: 3px 10px; font-size: 12px; font-weight: 600; }
    .empty { color: #5a6475; background: #f5f7fa; border: 1px dashed #c8d0dc; border-radius: 10px; padding: 14px; }

    details.card { border: 1px solid #d5dbe5; border-radius: 12px; margin-bottom: 8px; background: #fff; }
    details.card[open] { border-color: #9fb4d6; }
    details.card > summary { list-style: none; padding: 10px 12px; cursor: pointer; border-radius: 12px; }
    details.card > summary::-webkit-details-marker { display: none; }
    details.card > summary:hover { background: #f5f8fc; }
    .title-line { display: flex; justify-content: space-between; gap: 8px; align-items: baseline; }
    .code { font-weight: 700; }
    .course-title { color: #3b4556; font-size: 13px; }
    .meta { color: #5a6475; font-size: 12px; margin-top: 2px; }
    .chev { color: #5a6475; transition: transform .15s; }
    details[open] .chev { transform: rotate(90deg); }
    .sections { padding: 0 12px 10px; }
    .sec { display: grid; grid-template-columns: auto 1fr; gap: 2px 10px; padding: 8px 0; border-top: 1px solid #eef1f5; }
    .sec input { width: 18px; height: 18px; margin-top: 2px; accent-color: #003f87; }
    .sec.off .sec-main { opacity: .5; text-decoration: line-through; }
    .sec-main { font-size: 13px; }
    .sec-when { font-weight: 600; }
    .sec-sub { color: #5a6475; font-size: 12px; }
    .pill { display: inline-block; border-radius: 999px; padding: 0 8px; font-size: 11px; font-weight: 700; margin-left: 4px; }
    .pill.ok { background: #e3f4e8; color: #17613a; }
    .pill.full { background: #fde8e8; color: #9b1c1c; }
    .pill.regd { background: #e2e6ec; color: #1f2937; }
    .hint { font-size: 12px; background: #fff7e0; color: #6b4e00; border-radius: 8px; padding: 6px 8px; margin: 8px 0 2px; }
    .hint.done { background: #e3f4e8; color: #17613a; }
    .card-actions { display: flex; justify-content: flex-end; margin-top: 6px; }
    .link-btn { background: none; border: 0; color: #9b1c1c; font-size: 12px; padding: 4px 6px; border-radius: 6px; text-decoration: underline; }
    .result { display: flex; align-items: center; justify-content: space-between; gap: 10px;
      padding: 8px 10px; border: 1px solid #e3e8ef; border-radius: 10px; margin-bottom: 6px; }
    .add-btn { background: #003f87; color: #fff; border: 0; border-radius: 8px; padding: 6px 10px; font-weight: 600; white-space: nowrap; }
    .add-btn:hover { background: #00306a; }
    .add-btn[disabled] { background: #e3f4e8; color: #17613a; opacity: 1; }

    .planbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap; margin-bottom: 10px; }
    .ptabs { display: inline-flex; background: #eef2f7; border-radius: 10px; padding: 3px; }
    .ptab { border: 0; background: transparent; padding: 6px 14px; border-radius: 8px; font-weight: 700; color: #3b4556; }
    .ptab.on { background: #fff; color: #003f87; box-shadow: 0 1px 3px rgba(0,0,0,.15); }
    .ptab-n { margin-left: 6px; font-size: 11px; background: #dbe3ee; color: #3b4556; border-radius: 999px; padding: 0 6px; }
    .ptab.on .ptab-n { background: #003f87; color: #fff; }
    .ptools { display: flex; gap: 6px; flex-wrap: wrap; }

    .sched-main { display: grid; grid-template-columns: 210px 1fr; gap: 14px; min-height: 0; }
    .cart { border-right: 1px solid #eef1f5; padding-right: 12px; }
    .cart.drop-hover { background: #fff5f5; outline: 2px dashed #b91c1c; outline-offset: -2px; border-radius: 10px; }
    .chip { display: grid; grid-template-columns: auto 1fr; column-gap: 8px; align-items: center; text-align: left; width: 100%;
      border: 1px solid #d5dbe5; background: #fff; border-radius: 10px; padding: 7px 10px; margin-bottom: 6px; touch-action: none; }
    .chip:hover:not([disabled]) { border-color: var(--fg, #9fb4d6); }
    .chip .swatch { grid-row: span 2; width: 10px; height: 26px; border-radius: 4px; background: var(--bg); border: 2px solid var(--fg); }
    .chip-code { font-weight: 700; font-size: 13px; }
    .chip-sub { font-size: 11px; color: #5a6475; grid-column: 2; }
    .chip.placed { background: var(--bg); border-color: transparent; }
    .chip.placed .chip-sub { color: var(--fg); }
    .chip.active { outline: 3px solid #003f87; outline-offset: 1px; }
    .chip.clash { border-color: #b91c1c !important; box-shadow: inset 0 0 0 1px #b91c1c; }
    .chip.reg { grid-template-columns: 1fr; background: repeating-linear-gradient(135deg, #eef1f5 0 6px, #e4e8ee 6px 12px); border-color: transparent; cursor: default; }
    .chip.reg .chip-sub { grid-column: 1; }
    .chip.small { width: auto; display: inline-grid; margin: 0 6px 6px 0; }

    .cal-wrap { min-width: 0; }
    .pickbar { display: flex; justify-content: space-between; align-items: center; gap: 10px; flex-wrap: wrap;
      background: #eaf1fb; color: #0b3d91; border-radius: 10px; padding: 8px 10px; margin-bottom: 8px; font-size: 13px; }
    .pickbar-btns { display: flex; gap: 6px; }
    .cal { border: 1px solid #d5dbe5; border-radius: 12px; overflow: hidden; }
    .cal-head, .cal-body { display: grid; grid-template-columns: 52px repeat(var(--ncols), 1fr); }
    .cal-head { background: #f5f7fa; border-bottom: 1px solid #d5dbe5; }
    .dh { text-align: center; font-weight: 700; font-size: 12px; padding: 6px 0; color: #3b4556; }
    .gutter { position: relative; border-right: 1px solid #eef1f5; }
    .gutter span { position: absolute; right: 6px; transform: translateY(-50%); font-size: 10px; color: #5a6475; white-space: nowrap; }
    .gutter span:first-child { transform: none; }
    .col { position: relative; border-right: 1px solid #eef1f5;
      background-image: repeating-linear-gradient(to bottom, #eef1f5 0 1px, transparent 1px 54px); }
    .col:last-child { border-right: 0; }
    .blk { position: absolute; border-radius: 6px; padding: 3px 5px; overflow: hidden; text-align: left;
      background: var(--bg); color: var(--fg); border: 1px solid color-mix(in srgb, var(--fg) 35%, transparent);
      font-size: 11px; line-height: 1.2; display: flex; flex-direction: column; gap: 1px; touch-action: none; }
    .blk b { font-size: 12px; }
    button.blk { cursor: grab; }
    button.blk:hover { box-shadow: 0 2px 8px rgba(0,0,0,.18); z-index: 2; }
    .blk.clash { border: 2px solid #b91c1c; }
    .blk.reg { --bg: #e4e8ee; --fg: #1f2937; background: repeating-linear-gradient(135deg, #eef1f5 0 6px, #e1e6ed 6px 12px); }
    .blk .lock { font-size: 10px; text-transform: uppercase; letter-spacing: .04em; opacity: .8; }
    .cal.picking .blk { opacity: .45; }
    .cal.picking .blk.lifting { opacity: .2; }
    .ghost-layer { position: absolute; inset: 0; pointer-events: none; }
    .ghost { position: absolute; pointer-events: auto; border-radius: 6px; border: 2px dashed; padding: 3px 5px; text-align: left;
      font-size: 11px; line-height: 1.2; display: flex; flex-direction: column; gap: 1px; overflow: hidden; z-index: 3;
      background: rgba(255,255,255,.88); }
    .ghost.ok { border-color: #17613a; color: #14532d; background: rgba(227,244,232,.92); }
    .ghost.full { border-color: #6b7280; color: #374151; background: rgba(243,244,246,.92); }
    .ghost.conflict { border-color: #b91c1c; color: #7f1d1d; background: rgba(253,232,232,.92); }
    .ghost.current { border-style: solid; }
    .ghost .g-time { font-weight: 700; }
    .ghost .g-tag { font-weight: 600; }
    .ghost.hover, .ghost:hover { box-shadow: 0 0 0 3px #003f87; z-index: 4; }
    .notime .ghost { position: static; display: inline-flex; margin: 0 6px 6px 0; min-width: 150px; }

    .notime { margin-top: 10px; }
    .notime-row { display: flex; flex-wrap: wrap; align-items: flex-start; }
    .conflicts {  margin-top: 10px; background: #fde8e8; color: #7f1d1d; border-radius: 10px; padding: 8px 10px; font-size: 13px; }
    .conflicts ul { margin: 4px 0 0; padding-left: 18px; }
    .statline { display: flex; flex-wrap: wrap; gap: 6px 16px; margin-top: 10px; font-size: 13px; color: #3b4556; }
    .statline b { color: #003f87; }

    .export { margin-top: 14px; border: 1px solid #b7d9c3; background: #f1faf4; border-radius: 12px; padding: 12px;
      display: flex; flex-wrap: wrap; gap: 10px; justify-content: space-between; align-items: center; }
    .export.quiet { border-color: #d5dbe5; background: #f7f9fb; }
    .export p { margin: 2px 0 0; font-size: 13px; color: #3b4556; }
    .howto { flex-basis: 100%; font-size: 13px; color: #3b4556; }
    .howto summary { cursor: pointer; color: #003f87; font-weight: 600; }
    .howto ul { margin: 6px 0; padding-left: 18px; }
    .howto p { font-size: 12px; }

    .send { border: 2px solid #003f87; border-radius: 12px; padding: 12px 14px; margin-bottom: 10px; background: #f7faff; }
    .send h4 { font-size: 15px; color: #003f87; margin: 0 0 6px; }
    .send p { margin: 0 0 8px; font-size: 13px; color: #1b2330; }
    .send .small { font-size: 12px; }
    .send-list { list-style: none; margin: 0 0 10px; padding: 0; }
    .send-list li { display: flex; gap: 10px; align-items: flex-start; padding: 7px 0; border-top: 1px solid #e3e8ef; font-size: 13px; }
    .send-list li input { width: 18px; height: 18px; margin-top: 1px; accent-color: #003f87; flex: none; }
    .send-list li label { display: flex; flex-wrap: wrap; gap: 4px 8px; align-items: baseline; }
    .send-list li.skip { opacity: .6; }
    .send-dot { width: 10px; height: 10px; border-radius: 50%; background: #c8d0dc; margin-top: 5px; flex: none; }
    .send-list li.good .send-dot { background: #17613a; }
    .send-list li.bad .send-dot { background: #b91c1c; }
    .flag { font-size: 11px; font-weight: 700; background: #fde8e8; color: #9b1c1c; border-radius: 999px; padding: 1px 8px; }
    .send-state { flex-basis: 100%; font-size: 12px; color: #3b4556; }
    .send-list li.good .send-state { color: #17613a; font-weight: 600; }
    .send-list li.bad .send-state { color: #9b1c1c; font-weight: 600; }
    .send-btns { display: flex; gap: 8px; flex-wrap: wrap; }
    .send-err { color: #9b1c1c !important; font-weight: 600; }

    .compare { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
    .cmp { border: 1px solid #d5dbe5; border-radius: 12px; padding: 12px; }
    .cmp.on { border-color: #003f87; box-shadow: 0 0 0 1px #003f87; }
    .cmp header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
    .cmp h3 { margin: 0; font-size: 15px; text-transform: none; letter-spacing: 0; color: #1b2330; }
    .mini-head, .mini-body { display: grid; grid-template-columns: repeat(var(--ncols), 1fr); gap: 3px; }
    .mini-head span { text-align: center; font-size: 10px; color: #5a6475; font-weight: 700; }
    .mini-col { position: relative; background: #f5f7fa; border-radius: 4px; }
    .mini-col i { position: absolute; border-radius: 3px; background: var(--bg); border: 1px solid var(--fg); }
    .mini-col i.reg { background: #d1d5db; border-color: #6b7280; }
    .cmp dl { margin: 10px 0 0; font-size: 13px; }
    .cmp .row { display: flex; justify-content: space-between; gap: 8px; padding: 4px 0; border-top: 1px solid #eef1f5; }
    .cmp dt { color: #3b4556; }
    .cmp dd { margin: 0; font-weight: 700; text-align: right; }
    .cmp .row.bad dd { color: #b91c1c; }

    footer { border-top: 1px solid #e3e8ef; padding: 10px 14px; font-size: 12px; color: #5a6475;
      display: flex; justify-content: space-between; align-items: center; gap: 8px; }
    .danger { white-space: nowrap; background: none; border: 1px solid #d5dbe5; border-radius: 8px; padding: 4px 8px; color: #9b1c1c; font-size: 12px; }
    .danger.armed { background: #9b1c1c; color: #fff; border-color: #9b1c1c; }

    .drag-float { position: fixed; left: 0; top: 0; z-index: 2147483647; pointer-events: none;
      background: #003f87; color: #fff; font-weight: 700; font-size: 12px; padding: 6px 10px; border-radius: 8px;
      box-shadow: 0 6px 18px rgba(0,0,0,.3); }
    .drag-float[hidden] { display: none; }
    .sr { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); white-space: nowrap; }

    @media (max-width: 760px) {
      .sched-main { grid-template-columns: 1fr; }
      .cart { border-right: 0; padding-right: 0; }
      .compare { grid-template-columns: 1fr; }
    }
  `;

  function create({ onAction }) {
    const host = document.createElement("div");
    host.id = "wwu-planner-root";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>${STYLES}</style>
      <div class="root">
        <button class="launcher" data-action="open" aria-expanded="false" aria-controls="wp-panel">Web5u</button>
        <section class="panel" id="wp-panel" role="dialog" aria-label="Class planner" hidden></section>
        <div class="drag-float" hidden></div>
        <div class="sr" role="status" aria-live="polite"></div>
      </div>`;
    document.documentElement.appendChild(host);

    const root = shadow.querySelector(".root");
    const launcher = shadow.querySelector(".launcher");
    const panel = shadow.querySelector(".panel");
    const float = shadow.querySelector(".drag-float");
    const live = shadow.querySelector("[role=status]");

    let data = null;
    let view = "courses";
    let pick = null;
    let pendingFocus = null;
    let suppressClick = false;
    let clearArmed = false;
    let viewInit = false;
    const openCards = new Set();

    const focusKey = (el) => el?.dataset?.fk || null;
    function draw() {
      if (!data) return;
      const scrolls = {};
      panel.querySelectorAll("[data-scroll]").forEach((el) => { scrolls[el.dataset.scroll] = el.scrollTop; });
      const hadFocus = focusKey(shadow.activeElement);

      panel.className = `panel${view === "courses" ? "" : " wide"}`;
      panel.innerHTML = html();

      panel.querySelectorAll("[data-action], summary").forEach((el) => {
        const d = el.dataset;
        el.dataset.fk = [el.tagName, el.classList[0], d.action, d.key, d.crn, d.plan, d.source, d.view,
          el.closest("details.card")?.dataset.key].join("|");
      });
      panel.querySelectorAll("[data-scroll]").forEach((el) => {
        if (scrolls[el.dataset.scroll] != null) el.scrollTop = scrolls[el.dataset.scroll];
      });
      const target = pendingFocus ? panel.querySelector(pendingFocus)
        : hadFocus ? panel.querySelector(`[data-fk="${CSS.escape(hadFocus)}"]`) : null;
      pendingFocus = null;
      if (target && !panel.hidden) target.focus({ preventScroll: true });
    }

    function html() {
      const ws = data.plan || Plan.emptyPlan("");
      const planId = ws.active || "A";
      const summary = Plan.summarize(ws);
      const { courses, credits } = summary;
      const submitted = data.submittedAt && Date.now() - data.submittedAt < 30 * 60 * 1000;

      launcher.textContent = submitted && data.registered.length ? "Registered · add to calendar"
        : courses.length ? `Web5u · ${courses.length} course${courses.length === 1 ? "" : "s"}` : "Web5u";
      launcher.classList.toggle("alert", !!(submitted && data.registered.length));

      const tabs = [["courses", "Queue"], ["schedule", "Schedule"], ["compare", "Compare"]]
        .map(([id, label]) => `<button role="tab" aria-selected="${view === id}" data-action="view" data-view="${id}">${TAB_ICONS[id] || ""}${label}</button>`).join("");

      const notices = [];
      if (submitted && data.registered.length && view !== "schedule") {
        notices.push(`<div class="notice"><span><b>Registration submitted.</b> Add your classes to your calendar.</span>
          <button class="btn primary" data-action="export" data-source="registered">Download .ics</button></div>`);
      }
      if (data.notice) notices.push(`<div class="notice ${data.noticeKind === "warn" ? "warn" : ""}"><span>${esc(data.notice)}</span>
        <button class="btn ghosty" data-action="dismiss">OK</button></div>`);

      let body;
      if (view === "schedule" || view === "compare") {
        const registered = data.registered || [];
        const weeks = Object.fromEntries(Plan.PLAN_IDS.map((id) => [id, Plan.week(ws, id, registered)]));
        const ctx = {
          ws, planId, weekData: weeks[planId], weeks, pick, registered,
          colorOf: (key) => data.colorIndex(key) % COLORS.length,
          exportInfo: { registeredCount: registered.length, planCount: weeks[planId].items.length },
          send: data.send,
        };
        body = view === "schedule" ? PlannerCalendar.schedule(ctx) : PlannerCalendar.compare(ctx);
      } else {
        body = coursesView(ws, summary);
      }

      return `
        <header class="top">
          <div class="row">
            <div class="brand">${BRAND_ICON}<div><h2>Web5u</h2><div class="sub">${esc(ws.termDesc || "Run a class search to start")}</div></div></div>
            <button class="icon-btn" data-action="close" aria-label="Close planner">×</button>
          </div>
          <div class="views" role="tablist" aria-label="Planner views">${tabs}</div>
        </header>
        ${notices.join("")}
        <div class="body" data-scroll="body">${body}</div>
        <footer>
          <span>Developed by <a href="https://www.linkedin.com/in/connormaus/" style="color:#0083ff; text-decoration: none;">Connor Mausolf</a> for students at Western Washington University. Your data is always private <a href="https://web5u-downloader.netlify.app/privacy-policy" style="color:#0083ff; text-decoration: none;" >see more</a>.</span>
          ${view === "courses" && courses.length ? `<button class="danger" data-action="clear">Clear all courses</button>` : `<span>${credits ? `${credits} credits in your queue` : ""}</span>`}
        </footer>`;
    }

    function coursesView(ws, { courses, credits, gurs }) {
      const regKeys = new Set((data.registered || []).map((r) => r.courseKey));
      const courseCards = courses.map((c) => {
        const all = Object.values(c.sections);
        const included = all.filter((s) => !c.excluded.includes(s.crn));
        const label = `${c.subject} ${c.number}`;
        const secRows = all.map((s) => {
          const on = !c.excluded.includes(s.crn);
          const id = `wp-${c.key}-${s.crn}`;
          return `
            <div class="sec ${on ? "" : "off"}">
              <input type="checkbox" id="${esc(id)}" ${on ? "checked" : ""} data-action="toggle"
                data-key="${esc(c.key)}" data-crn="${esc(s.crn)}">
              <label class="sec-main" for="${esc(id)}">
                <span class="sec-when">${esc(describeBlocks(s, { withRoom: false }))}</span>${seatBadge(s)}<br>
                <span class="sec-sub">${esc(s.instructor)} · ${esc(s.type)} · CRN ${esc(s.crn)}
                  ${s.blocks[0] ? ` · ${esc(s.blocks.map((b) => b.where).join(", "))}` : ""}</span><br>
                <span class="sec-sub">Seats as of ${esc(timeAgo(s.seenAt))}</span>
              </label>
            </div>`;
        }).join("");
        const hint = c.complete
          ? `<div class="hint done">All ${all.length} section${all.length === 1 ? "" : "s"} of ${esc(label)} found.</div>`
          : `<div class="hint">${all.length} section${all.length === 1 ? "" : "s"} seen so far. Search <b>${esc(c.subject)}</b> with course number <b>${esc(c.number)}</b> to make sure you've seen them all.</div>`;
        return `
          <details class="card" data-key="${esc(c.key)}" ${openCards.has(c.key) ? "open" : ""}>
            <summary>
              <div class="title-line"><span class="code">${esc(label)}${regKeys.has(c.key) ? `<span class="pill regd">Registered</span>` : ""}</span><span class="chev" aria-hidden="true">›</span></div>
              <div class="course-title">${esc(c.title)}</div>
              <div class="meta">${esc(c.credits)} credits · ${included.length} of ${all.length} option${all.length === 1 ? "" : "s"} kept</div>
            </summary>
            <div class="sections">
              ${secRows}
              ${hint}
              <div class="card-actions"><button class="link-btn" data-action="remove" data-key="${esc(c.key)}">Remove ${esc(label)}</button></div>
            </div>
          </details>`;
      }).join("");

      let resultsHtml = "";
      const lastResults = data.lastResults;
      if (lastResults && lastResults.size) {
        resultsHtml = `<h3>From your last search</h3>` + [...lastResults.values()].map((secs) => {
          const s = secs[0];
          const inPlan = !!ws.courses[s.courseKey];
          return `
            <div class="result">
              <div><span class="code">${esc(s.subject)} ${esc(s.number)}</span>
                <div class="course-title">${esc(s.title)}</div>
                <div class="meta">${secs.length} section${secs.length === 1 ? "" : "s"} on this page · ${esc(s.credits)} cr</div></div>
              <button class="add-btn" data-action="add" data-key="${esc(s.courseKey)}" ${inPlan ? "disabled" : ""}
                aria-label="${inPlan ? `${esc(s.subject)} ${esc(s.number)} is in your planner` : `Add ${esc(s.subject)} ${esc(s.number)} to planner`}">
                ${inPlan ? "✓ Added" : "+ Add"}</button>
            </div>`;
        }).join("");
      }

      return `
        <div class="summary-stats">
          <div class="sstat"><b>${courses.length}</b><span>course${courses.length === 1 ? "" : "s"}</span></div>
          <div class="sstat"><b>${credits}</b><span>credits</span></div>
          <div class="sstat"><b>${gurs.length}</b><span>GUR area${gurs.length === 1 ? "" : "s"}</span></div>
        </div>
        ${gurs.length ? `<h3>GURs these courses could cover</h3><div class="gurs">${gurs.map((g) =>
          `<span class="gur" title="${esc(g.label)} — ${esc([...g.courses].join(", "))}">${esc(g.code)}</span>`).join("")}</div>` : ""}
        <h3>Courses</h3>
        ${courseCards || `<div class="empty">Nothing here yet. Search for classes, then press <b>+ Plan</b> on any row (or <b>+ Add</b> below). Every section of that course you've seen comes along, and you can narrow them down later.</div>`}
        ${courses.length ? `<p class="tip" style="margin-top:10px">Ready to arrange them? Open the <b>Schedule</b> tab.</p>` : ""}
        ${resultsHtml}`;
    }

    function startPick(key, { focusGhost = true } = {}) {
      pick = { key };
      if (focusGhost) {
        const cur = data.plan?.plans[data.plan.active]?.choices[key];
        pendingFocus = cur ? `.ghost[data-crn="${CSS.escape(cur)}"][tabindex="0"]` : `.ghost[tabindex="0"]`;
      }
      draw();
      const c = data.plan.courses[key];
      announce(`Choosing a time for ${c.subject} ${c.number}. ${Plan.includedSections(c).length} options. Use arrow keys to move between them, Enter to choose, Escape to cancel.`);
    }
    function endPick({ focusKey: k } = {}) {
      pick = null;
      if (k) pendingFocus = `.chip[data-key="${CSS.escape(k)}"]`;
      draw();
    }

    shadow.addEventListener("click", (e) => {
      if (suppressClick) { suppressClick = false; e.preventDefault(); return; }
      const el = e.target.closest("[data-action]");
      if (!el || el.matches('input[type="checkbox"]')) return;
      const { action, key, crn, plan: planId } = el.dataset;
      switch (action) {
        case "view":
          view = el.dataset.view; pick = null; pendingFocus = `[data-action="view"][data-view="${view}"]`;
          draw(); onAction("view", { view }); return;
        case "pick":
          if (pick?.key === key) endPick({ focusKey: key }); else startPick(key);
          return;
        case "cancelpick": { const k = pick?.key; endPick({ focusKey: k }); announce("Cancelled."); return; }
        case "choose": {
          pick = null; pendingFocus = `.chip[data-key="${CSS.escape(key)}"]`;
          onAction("choose", { key, crn }); return;
        }
        case "unplace": pick = null; pendingFocus = `.chip[data-key="${CSS.escape(key)}"]`; onAction("unplace", { key }); return;
        case "plan":
          pick = null;
          if (el.dataset.goto) { view = el.dataset.goto; onAction("view", { view }); pendingFocus = `.ptab[data-plan="${planId}"]`; }
          onAction("plan", { plan: planId }); return;
        case "clear":
          if (!clearArmed) {
            clearArmed = true; el.classList.add("armed"); el.textContent = "Click again to clear";
            setTimeout(() => { clearArmed = false; if (el.isConnected) { el.classList.remove("armed"); el.textContent = "Clear all courses"; } }, 4000);
            return;
          }
          clearArmed = false; onAction("clear", {}); return;
        case "add": openCards.add(key); onAction("add", { key }); return;
        case "export": onAction("export", { source: el.dataset.source }); return;
        case "sendprep": pick = null; onAction("sendprep", {}); return;
        default: onAction(action, { key, crn, plan: planId });
      }
    });
    shadow.addEventListener("change", (e) => {
      const el = e.target.closest('input[type="checkbox"][data-action]');
      if (el) onAction(el.dataset.action, { key: el.dataset.key, crn: el.dataset.crn });
    });
    shadow.addEventListener("toggle", (e) => {
      const d = e.target;
      if (d.matches?.("details.card")) d.open ? openCards.add(d.dataset.key) : openCards.delete(d.dataset.key);
    }, true);
    shadow.addEventListener("keydown", (e) => {
      if (e.key === "Escape") {
        if (drag) { cancelDrag(); return; }
        if (pick) { const k = pick.key; endPick({ focusKey: k }); announce("Cancelled."); e.stopPropagation(); return; }
        if (!panel.hidden) onAction("close", {});
        return;
      }
      const g = e.target.closest?.(".ghost");
      if (g && ["ArrowDown", "ArrowRight", "ArrowUp", "ArrowLeft"].includes(e.key)) {
        const list = [...panel.querySelectorAll('.ghost[tabindex="0"]')];
        const i = list.indexOf(g);
        const next = list[(i + (e.key === "ArrowDown" || e.key === "ArrowRight" ? 1 : -1) + list.length) % list.length];
        next?.focus(); e.preventDefault();
      }
    });
    shadow.addEventListener("pointerover", (e) => {
      const g = e.target.closest?.(".ghost");
      panel.querySelectorAll(".ghost.hover").forEach((x) => x.classList.remove("hover"));
      if (g) panel.querySelectorAll(`.ghost[data-crn="${CSS.escape(g.dataset.crn)}"]`).forEach((x) => x.classList.add("hover"));
    });

    let drag = null;
    shadow.addEventListener("pointerdown", (e) => {
      if (e.button !== 0) return;
      const src = e.target.closest("[data-drag-key]");
      if (!src || src.disabled) return;
      drag = { key: src.dataset.dragKey, x0: e.clientX, y0: e.clientY, started: false, over: null };
    });
    const dropTargetAt = (x, y) => shadow.elementsFromPoint(x, y).find((el) => el.dataset?.drop && panel.contains(el)) || null;
    function setOver(el) {
      if (drag.over === el) return;
      panel.querySelectorAll(".ghost.hover, .drop-hover").forEach((x) => x.classList.remove("hover", "drop-hover"));
      drag.over = el;
      if (!el) return;
      if (el.dataset.drop === "unplace") el.classList.add("drop-hover");
      else panel.querySelectorAll(`.ghost[data-crn="${CSS.escape(el.dataset.drop)}"]`).forEach((x) => x.classList.add("hover"));
    }
    function cancelDrag() {
      if (!drag) return;
      const started = drag.started;
      drag = null;
      float.hidden = true; root.classList.remove("dragging");
      if (started) { pick = null; draw(); }
    }
    window.addEventListener("pointermove", (e) => {
      if (!drag) return;
      if (!drag.started) {
        if (Math.hypot(e.clientX - drag.x0, e.clientY - drag.y0) < 6) return;
        drag.started = true;
        const c = data.plan.courses[drag.key];
        if (!c) { drag = null; return; }
        pick = { key: drag.key };
        draw();
        float.textContent = `${c.subject} ${c.number}`;
        float.hidden = false;
        root.classList.add("dragging");
      }
      e.preventDefault();
      float.style.transform = `translate(${e.clientX + 14}px, ${e.clientY + 12}px)`;
      setOver(dropTargetAt(e.clientX, e.clientY));
    }, { passive: false });
    window.addEventListener("pointerup", (e) => {
      if (!drag) return;
      const d = drag;
      if (!d.started) { drag = null; return; }
      const target = dropTargetAt(e.clientX, e.clientY);
      drag = null;
      float.hidden = true; root.classList.remove("dragging");
      suppressClick = true; setTimeout(() => { suppressClick = false; }, 0);
      pick = null;
      if (target?.dataset.drop === "unplace") onAction("unplace", { key: d.key });
      else if (target) onAction("choose", { key: d.key, crn: target.dataset.drop });
      else draw();
    });
    window.addEventListener("pointercancel", cancelDrag);

    function setOpen(open, { focus = true } = {}) {
      panel.hidden = !open;
      launcher.hidden = open;
      launcher.setAttribute("aria-expanded", String(open));
      if (open) draw();
      if (!focus) return;
      if (open) panel.querySelector(".icon-btn")?.focus(); else launcher.focus();
    }
    function announce(msg) { live.textContent = ""; setTimeout(() => { live.textContent = msg; }, 30); }
    function revealCard(key) {
      if (view !== "courses") { view = "courses"; onAction("view", { view }); }
      openCards.add(key);
      draw();
      const card = panel.querySelector(`details.card[data-key="${CSS.escape(key)}"]`);
      if (card) { card.scrollIntoView({ block: "nearest" }); card.querySelector("summary")?.focus(); }
    }
    function render(next) {
      data = next;
      if (pick && !data.plan?.courses[pick.key]) pick = null;
      if (!viewInit && next.view) { view = next.view; viewInit = true; }
      draw();
    }

    function focusSel(sel) { const el = panel.querySelector(sel); if (el && !panel.hidden) el.focus({ preventScroll: false }); }
    return { render, setOpen, announce, revealCard, focusSel, isOpen: () => !panel.hidden };
  }

  function makeRowButton({ crn, onClick }) {
    const host = document.createElement("span");
    host.className = "wwu-planner-rowbtn";
    host.style.cssText = "display:inline-block;margin:4px 0 0 6px;vertical-align:middle;";
    const shadow = host.attachShadow({ mode: "open" });
    shadow.innerHTML = `
      <style>
        button { font: 600 12px/1 system-ui, sans-serif; border-radius: 6px; padding: 6px 9px; cursor: pointer;
          border: 1px solid #003f87; background: #fff; color: #003f87; white-space: nowrap; }
        button:hover { background: #eaf1fb; }
        button.in { background: #e3f4e8; border-color: #17613a; color: #17613a; }
        button:focus-visible { outline: 3px solid #f2a900; outline-offset: 2px; }
      </style>
      <button type="button"></button>`;
    const btn = shadow.querySelector("button");
    ["click", "mousedown", "mouseup", "keydown"].forEach((ev) =>
      btn.addEventListener(ev, (e) => { e.stopPropagation(); if (ev === "click") { e.preventDefault(); onClick(crn); } }));
    return {
      host,
      crn,
      update(inPlan, label) {
        btn.textContent = inPlan ? "✓ In planner" : "+ Plan";
        btn.classList.toggle("in", inPlan);
        btn.setAttribute("aria-label", inPlan ? `${label} is in your planner. Open it.` : `Add ${label} to your planner`);
      },
    };
  }

  return { create, makeRowButton };
})();
