// Reads copies of search and registration responses this page already receives. Makes no requests of its own.
(() => {
  const TAG = "wwu-planner";
  const wanted = (url) => typeof url === "string" &&
    (url.includes("searchResults?") || url.includes("/classRegistration/"));
  const MAX = 3_000_000;

  const forward = (url, text) => {
    if (typeof text !== "string" || text.length > MAX) return;
    const t = text.trimStart();
    if (!(t.startsWith("{") || t.startsWith("["))) return;
    window.postMessage({ source: TAG, type: "response", url, text }, window.location.origin);
  };

  const origOpen = XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open = function (method, url, ...rest) {
    this.__plannerUrl = String(url);
    return origOpen.call(this, method, url, ...rest);
  };

  const origSend = XMLHttpRequest.prototype.send;
  XMLHttpRequest.prototype.send = function (...args) {
    if (wanted(this.__plannerUrl)) {
      this.addEventListener("load", () => {
        try {
          const text = this.responseType === "" || this.responseType === "text" ? this.responseText
            : this.responseType === "json" ? JSON.stringify(this.response) : null;
          forward(this.__plannerUrl, text);
        } catch (_) {  }
      });
    }
    return origSend.apply(this, args);
  };

  try {
    new PerformanceObserver((list) => {
      for (const e of list.getEntries()) {
        if (e.initiatorType === "fetch" && wanted(e.name)) console.debug("[Web5u] Web4U used fetch for", e.name.split("?")[0]);
      }
    }).observe({ type: "resource", buffered: false });
  } catch (_) {}
})();
