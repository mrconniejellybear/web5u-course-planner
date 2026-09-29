const SendCRNs = (() => {
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  const panel = () => document.getElementById("tabs-enterCRN");
  const isShown = (el) => !!el && el.offsetParent !== null && getComputedStyle(el).display !== "none";

  // Never presses Submit: changing a registration is always the student's decision.
  function safeClick(el) {
    const text = (el.textContent || el.value || "").trim();
    if (/^submit$/i.test(text) || el.closest("#inner-south, .button-bar-background") ||
        /submit/i.test(el.getAttribute("aria-label") || "")) {
      throw new Error("Refusing to press Submit. That's always your decision.");
    }
    el.click();
  }

  const controls = () => [...(panel()?.querySelectorAll("a, button, input[type=button], input[type=submit]") || [])];
  const findControl = (re) => controls().find((el) => re.test((el.textContent || el.value || "").trim()));

  const crnInputs = () => [...(panel()?.querySelectorAll('#crns input[id^="txt_crn"]') || [])]
    .filter((i) => !i.closest("#crn-template"));

  function typeInto(input, value) {
    input.focus();
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value").set.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: value.slice(-1) }));
    input.dispatchEvent(new Event("change", { bubbles: true }));
    input.blur();
    input.dispatchEvent(new FocusEvent("focusout", { bubbles: true }));
  }

  async function openEnterCrnsTab() {
    if (isShown(panel())) return true;
    const tab = document.getElementById("enterCRNs-tab") ||
      [...document.querySelectorAll('[role="tab"], a')].find((a) => /enter crns/i.test(a.textContent || ""));
    if (!tab) return false;
    safeClick(tab);
    for (let i = 0; i < 20 && !isShown(panel()); i++) await sleep(100);
    return isShown(panel());
  }

  async function ensureEmptyBoxes(n) {
    const empties = () => crnInputs().filter((i) => !i.value.trim());
    const addAnother = findControl(/add another crn/i);
    for (let guard = 0; empties().length < n && guard < n + 2; guard++) {
      if (!addAnother) break;
      const before = crnInputs().length;
      safeClick(addAnother);
      for (let i = 0; i < 15 && crnInputs().length === before; i++) await sleep(80);
    }
    return empties().slice(0, n);
  }

  async function run({ crns, waitFor, onStep }) {
    if (!(await openEnterCrnsTab())) {
      throw new Error("Couldn't find Web4U's Enter CRNs tab. Open Register for Classes and try again.");
    }
    const already = new Set(crnInputs().map((i) => i.value.trim()).filter(Boolean));
    const todo = crns.filter((c) => !already.has(c));
    const boxes = await ensureEmptyBoxes(todo.length);
    if (boxes.length < todo.length) throw new Error("Web4U didn't give enough CRN boxes. Try clearing the Enter CRNs tab first.");

    for (let i = 0; i < todo.length; i++) {
      const crn = todo[i];
      onStep({ crn, stage: "typing" });
      const checked = waitFor(/getSectionDetailsFromCRN/i, (url) => url.includes(crn), 6000);
      typeInto(boxes[i], crn);
      const res = await checked;
      if (!res) onStep({ crn, stage: "checked", ok: null, message: "Web4U didn't respond to the check; it will verify on Add." });
      else if (res.json?.success === false) onStep({ crn, stage: "checked", ok: false, message: res.json?.message || "Web4U doesn't recognize this CRN." });
      else onStep({ crn, stage: "checked", ok: true, message: res.json?.courseTitle || "" });
      await sleep(250);
    }

    const addBtn = findControl(/add to summary/i);
    if (!addBtn) throw new Error("Couldn't find the Add to Summary button.");
    for (let i = 0; i < 30 && (addBtn.disabled || addBtn.classList.contains("disabled")); i++) await sleep(100);
    const added = waitFor(/addCRNRegistrationItems/i, () => true, 12000);
    safeClick(addBtn);
    const res = await added;
    return res ? Registered.fromAdd(res.json) : null;
  }

  return { run, safeClick };
})();
