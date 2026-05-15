const DEFAULTS = {
  apiBase: "http://localhost:8000",
  webBase: "http://localhost:3000",
};

async function load() {
  const cfg = await chrome.storage.local.get(["apiBase", "webBase"]);
  document.getElementById("apiBase").value = cfg.apiBase || DEFAULTS.apiBase;
  document.getElementById("webBase").value = cfg.webBase || DEFAULTS.webBase;
}

async function save() {
  const apiBase = document.getElementById("apiBase").value.trim() || DEFAULTS.apiBase;
  const webBase = document.getElementById("webBase").value.trim() || DEFAULTS.webBase;
  await chrome.storage.local.set({ apiBase, webBase });
  const status = document.getElementById("status");
  status.textContent = "Saved";
  setTimeout(() => (status.textContent = ""), 1500);
}

document.getElementById("save").addEventListener("click", save);
load();
