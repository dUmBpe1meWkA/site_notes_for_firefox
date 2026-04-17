const api = typeof browser !== "undefined" ? browser : chrome;

const currentDomainEl = document.getElementById("currentDomain");
const noteInputEl = document.getElementById("noteInput");
const saveBtnEl = document.getElementById("saveBtn");
const deleteBtnEl = document.getElementById("deleteBtn");
const statusEl = document.getElementById("status");
const notesListEl = document.getElementById("notesList");

let currentDomain = null;

function setStatus(message) {
  statusEl.textContent = message || "";
}

function getStorageKey(domain) {
  return `note:${domain}`;
}

function extractDomain(url) {
  try {
    const parsed = new URL(url);

    if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
      return null;
    }

    return parsed.hostname;
  } catch {
    return null;
  }
}

function escapeHtml(value) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

async function getCurrentTab() {
  const tabs = await api.tabs.query({
    active: true,
    currentWindow: true
  });

  return tabs[0] || null;
}

async function loadCurrentSiteNote() {
  const tab = await getCurrentTab();

  if (!tab || !tab.url) {
    currentDomainEl.textContent = "Не удалось определить вкладку";
    noteInputEl.disabled = true;
    saveBtnEl.disabled = true;
    deleteBtnEl.disabled = true;
    return;
  }

  currentDomain = extractDomain(tab.url);

  if (!currentDomain) {
    currentDomainEl.textContent = "Для этой страницы заметки недоступны";
    noteInputEl.disabled = true;
    saveBtnEl.disabled = true;
    deleteBtnEl.disabled = true;
    return;
  }

  currentDomainEl.textContent = currentDomain;

  const key = getStorageKey(currentDomain);
  const data = await api.storage.local.get(key);

  noteInputEl.value = data[key] || "";
}

async function saveCurrentNote() {
  if (!currentDomain) return;

  const value = noteInputEl.value.trim();
  const key = getStorageKey(currentDomain);

  if (!value) {
    setStatus("Пустую заметку сохранять нельзя.");
    return;
  }

  await api.storage.local.set({
    [key]: value
  });

  setStatus("Заметка сохранена.");
  await renderAllNotes();
}

async function deleteCurrentNote() {
  if (!currentDomain) return;

  const key = getStorageKey(currentDomain);
  await api.storage.local.remove(key);

  noteInputEl.value = "";
  setStatus("Заметка удалена.");
  await renderAllNotes();
}

async function deleteNoteByDomain(domain) {
  const key = getStorageKey(domain);
  await api.storage.local.remove(key);

  if (currentDomain === domain) {
    noteInputEl.value = "";
  }

  setStatus(`Заметка для ${domain} удалена.`);
  await renderAllNotes();
}

async function renderAllNotes() {
  const data = await api.storage.local.get(null);

  const entries = Object.entries(data)
    .filter(([key, value]) => key.startsWith("note:") && typeof value === "string" && value.trim())
    .map(([key, value]) => ({
      domain: key.replace("note:", ""),
      text: value
    }))
    .sort((a, b) => a.domain.localeCompare(b.domain, "ru"));

  if (!entries.length) {
    notesListEl.innerHTML = `<div class="empty">Пока заметок нет.</div>`;
    return;
  }

  notesListEl.innerHTML = entries.map(item => `
    <div class="note-item">
      <div class="note-head">
        <div class="note-domain">${escapeHtml(item.domain)}</div>
        <button class="note-delete-btn" data-domain="${encodeURIComponent(item.domain)}">
          Удалить
        </button>
      </div>
      <div class="note-text">${escapeHtml(item.text)}</div>
    </div>
  `).join("");
}

saveBtnEl.addEventListener("click", async () => {
  try {
    await saveCurrentNote();
  } catch (error) {
    console.error(error);
    setStatus("Ошибка при сохранении.");
  }
});

deleteBtnEl.addEventListener("click", async () => {
  try {
    await deleteCurrentNote();
  } catch (error) {
    console.error(error);
    setStatus("Ошибка при удалении.");
  }
});

notesListEl.addEventListener("click", async (event) => {
  const button = event.target.closest(".note-delete-btn");
  if (!button) return;

  const encodedDomain = button.dataset.domain;
  if (!encodedDomain) return;

  const domain = decodeURIComponent(encodedDomain);

  try {
    await deleteNoteByDomain(domain);
  } catch (error) {
    console.error(error);
    setStatus("Ошибка при удалении заметки.");
  }
});

document.addEventListener("DOMContentLoaded", async () => {
  try {
    await loadCurrentSiteNote();
    await renderAllNotes();
    setStatus("");
  } catch (error) {
    console.error(error);
    setStatus("Ошибка загрузки.");
  }
});