const state = {
  dashboard: null,
  catalogSort: "title",
  catalogQuery: "",
  editingSongId: null,
  archiveGig: null,
  publicSettingsDirty: false,
  filterSettingsDirty: false,
  selectedSongIds: new Set()
};

const els = {
  dashboardSinger: document.querySelector("#dashboardSinger"),
  activeGigName: document.querySelector("#activeGigName"),
  activeGigMeta: document.querySelector("#activeGigMeta"),
  activeGigControlName: document.querySelector("#activeGigControlName"),
  activeGigControlMeta: document.querySelector("#activeGigControlMeta"),
  editActiveGig: document.querySelector("#editActiveGig"),
  endActiveGig: document.querySelector("#endActiveGig"),
  stats: document.querySelector("#stats"),
  requestList: document.querySelector("#requestList"),
  publicSettingsForm: document.querySelector("#publicSettingsForm"),
  publicStageName: document.querySelector("#publicStageName"),
  publicTagline: document.querySelector("#publicTagline"),
  publicHeroTitle: document.querySelector("#publicHeroTitle"),
  publicHeroText: document.querySelector("#publicHeroText"),
  publicProfileImageFile: document.querySelector("#publicProfileImageFile"),
  publicProfileImagePreview: document.querySelector("#publicProfileImagePreview"),
  publicProfileImageUrl: document.querySelector("#publicProfileImageUrl"),
  publicBackgroundImageFile: document.querySelector("#publicBackgroundImageFile"),
  publicBackgroundImagePreview: document.querySelector("#publicBackgroundImagePreview"),
  publicBackgroundImageUrl: document.querySelector("#publicBackgroundImageUrl"),
  songAdmin: document.querySelector("#songAdmin"),
  songForm: document.querySelector("#songForm"),
  songTitle: document.querySelector("#songTitle"),
  songArtist: document.querySelector("#songArtist"),
  songTags: document.querySelector("#songTags"),
  catalogSearch: document.querySelector("#catalogSearch"),
  filterSettingsForm: document.querySelector("#filterSettingsForm"),
  audienceFiltersEnabled: document.querySelector("#audienceFiltersEnabled"),
  audienceFilters: document.querySelector("#audienceFilters"),
  selectVisibleSongs: document.querySelector("#selectVisibleSongs"),
  selectionCount: document.querySelector("#selectionCount"),
  makeVisibleOnly: document.querySelector("#makeVisibleOnly"),
  openImportDialog: document.querySelector("#openImportDialog"),
  importDialog: document.querySelector("#importDialog"),
  importForm: document.querySelector("#importForm"),
  importText: document.querySelector("#importText"),
  cancelImport: document.querySelector("#cancelImport"),
  editSongDialog: document.querySelector("#editSongDialog"),
  editSongForm: document.querySelector("#editSongForm"),
  editSongHeading: document.querySelector("#editSongHeading"),
  editSongTitle: document.querySelector("#editSongTitle"),
  editSongArtist: document.querySelector("#editSongArtist"),
  editSongTags: document.querySelector("#editSongTags"),
  editSongAvailable: document.querySelector("#editSongAvailable"),
  editSongFeatured: document.querySelector("#editSongFeatured"),
  deleteSong: document.querySelector("#deleteSong"),
  cancelEditSong: document.querySelector("#cancelEditSong"),
  archiveList: document.querySelector("#archiveList"),
  archiveDialog: document.querySelector("#archiveDialog"),
  archiveDialogTitle: document.querySelector("#archiveDialogTitle"),
  archiveDialogMeta: document.querySelector("#archiveDialogMeta"),
  archiveRequestList: document.querySelector("#archiveRequestList"),
  startFromArchive: document.querySelector("#startFromArchive"),
  closeArchiveDialog: document.querySelector("#closeArchiveDialog"),
  openGigDialog: document.querySelector("#openGigDialog"),
  gigDialog: document.querySelector("#gigDialog"),
  gigDialogTitle: document.querySelector("#gigDialogTitle"),
  gigDialogHint: document.querySelector("#gigDialogHint"),
  gigForm: document.querySelector("#gigForm"),
  gigMode: document.querySelector("#gigMode"),
  gigId: document.querySelector("#gigId"),
  gigName: document.querySelector("#gigName"),
  gigVenue: document.querySelector("#gigVenue"),
  gigScheduledAt: document.querySelector("#gigScheduledAt"),
  gigNotes: document.querySelector("#gigNotes"),
  cancelGig: document.querySelector("#cancelGig"),
  toast: document.querySelector("#toast")
};

const statuses = ["new", "queued", "singing", "done", "skipped"];
const statusLabels = {
  new: "New",
  queued: "Queued",
  singing: "Singing",
  done: "Done",
  skipped: "Skipped"
};

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 2600);
}

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function openDialog(dialog) {
  if (typeof dialog.showModal === "function") {
    dialog.showModal();
    return;
  }

  dialog.setAttribute("open", "");
}

function closeDialog(dialog) {
  if (typeof dialog.close === "function") {
    dialog.close();
    return;
  }

  dialog.removeAttribute("open");
}

async function api(path, options) {
  const fetchOptions = options || {};
  fetchOptions.headers = Object.assign({ "Content-Type": "application/json" }, fetchOptions.headers || {});
  const response = await fetch(path, fetchOptions);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

function timeLabel(value) {
  return new Intl.DateTimeFormat(undefined, {
    hour: "2-digit",
    minute: "2-digit"
  }).format(new Date(value));
}

function dateTimeLabel(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(undefined, {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function localDateTimeValue(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const offsetDate = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
  return offsetDate.toISOString().slice(0, 16);
}

function fileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(new Error("Could not read that image."));
    reader.readAsDataURL(file);
  });
}

function imageFromUrl(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("That image could not be loaded."));
    image.src = url;
  });
}

async function resizeImageFile(file, maxSize) {
  if (!file) return "";
  if (!file.type.startsWith("image/")) throw new Error("Choose an image file.");
  if (file.size > 8_000_000) throw new Error("Choose an image under 8MB.");

  const originalUrl = await fileAsDataUrl(file);
  const image = await imageFromUrl(originalUrl);
  const scale = Math.min(1, maxSize / Math.max(image.width, image.height));
  const width = Math.max(1, Math.round(image.width * scale));
  const height = Math.max(1, Math.round(image.height * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  canvas.width = width;
  canvas.height = height;
  context.drawImage(image, 0, 0, width, height);
  return canvas.toDataURL("image/jpeg", 0.84);
}

function renderImagePreview(element, value, emptyText) {
  element.classList.toggle("has-image", Boolean(value));
  element.style.backgroundImage = value ? `url(${JSON.stringify(value)})` : "";
  element.innerHTML = value ? "" : `<span>${emptyText}</span>`;
}

function renderStats(requests) {
  const counts = statuses.reduce((result, status) => {
    result[status] = 0;
    return result;
  }, {});
  requests.forEach(request => counts[request.status] += 1);
  els.stats.innerHTML = [
    ["New", counts.new],
    ["Queued", counts.queued],
    ["Singing", counts.singing],
    ["Done", counts.done]
  ].map(([label, count]) => `
    <div class="stat">
      <strong>${count}</strong>
      <span>${label}</span>
    </div>
  `).join("");
}

function requestSort(a, b) {
  const order = { singing: 0, queued: 1, new: 2, skipped: 3, done: 4 };
  if (order[a.status] !== order[b.status]) return order[a.status] - order[b.status];
  return new Date(a.createdAt) - new Date(b.createdAt);
}

function renderRequests() {
  const requests = state.dashboard.requests.slice().sort(requestSort);
  renderStats(requests);

  if (!requests.length) {
    els.requestList.innerHTML = `<div class="empty">No requests yet. When someone uses the public page, they will appear here.</div>`;
    return;
  }

  const groups = requests.reduce((items, request) => {
    const key = request.songId || `${request.song && request.song.title || "Unknown song"}-${request.song && request.song.artist || ""}`;
    const group = items.get(key) || {
      key,
      song: request.song,
      requests: []
    };
    group.requests.push(request);
    items.set(key, group);
    return items;
  }, new Map());

  els.requestList.innerHTML = Array.from(groups.values()).map(group => {
    const groupRequests = group.requests.sort(requestSort);
    const topStatus = groupRequests[0] && groupRequests[0].status || "new";
    const isRepeat = groupRequests.length > 1;
    const requestIds = groupRequests.map(request => request.id).join(",");

    return `
    <article class="request-card ${isRepeat ? "repeat-request" : ""}" data-status="${topStatus}">
      <div class="section-title">
        <div>
          <h3>${escapeHtml(group.song && group.song.title || "Unknown song")}</h3>
          <p>${escapeHtml(group.song && group.song.artist || "")}</p>
        </div>
        <div class="request-badges">
          ${isRepeat ? `<span class="repeat-pill">${groupRequests.length} requests</span>` : ""}
          <span class="status-pill" data-status="${topStatus}">${statusLabels[topStatus]}</span>
        </div>
      </div>
      <div class="grouped-requests">
        ${groupRequests.map(request => `
          <div class="grouped-request">
            <div class="request-detail-lines">
              <p><strong>${request.guestName ? escapeHtml(request.guestName) : "Anonymous"}</strong></p>
              ${request.message ? `<p>${escapeHtml(request.message)}</p>` : ""}
              <p class="muted">Requested at ${timeLabel(request.createdAt)}</p>
            </div>
          </div>
        `).join("")}
      </div>
      <div class="status-row">
        ${statuses.map(status => `
          <button class="status-button ${status === topStatus ? "active" : ""}" type="button" data-request-ids="${requestIds}" data-status="${status}">
            ${statusLabels[status]}
          </button>
        `).join("")}
      </div>
    </article>
  `;
  }).join("");
}

function tagsFor(song) {
  return Array.isArray(song.tags) ? song.tags : [song.genre, song.decade].filter(Boolean);
}

function songMeta(song) {
  const tags = tagsFor(song);
  return tags.length ? tags.join(" · ") : "No tags yet";
}

function findSong(id) {
  return state.dashboard.songs.find(song => song.id === id);
}

function catalogMatches(song) {
  const query = state.catalogQuery.toLowerCase();
  if (!query) return true;
  return `${song.title} ${song.artist} ${tagsFor(song).join(" ")}`.toLowerCase().indexOf(query) !== -1;
}

function visibleSongs() {
  return state.dashboard.songs
    .filter(catalogMatches)
    .sort((a, b) => {
      const primary = state.catalogSort === "artist"
        ? a.artist.localeCompare(b.artist)
        : a.title.localeCompare(b.title);
      if (primary !== 0) return primary;
      return a.title.localeCompare(b.title);
    });
}

function renderBulkControls(songs) {
  const visibleIds = songs.map(song => song.id);
  const selectedVisibleCount = visibleIds.filter(id => state.selectedSongIds.has(id)).length;
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;

  els.selectionCount.textContent = `${state.selectedSongIds.size} selected`;
  els.selectVisibleSongs.checked = allVisibleSelected;
  els.selectVisibleSongs.indeterminate = selectedVisibleCount > 0 && !allVisibleSelected;
  els.makeVisibleOnly.disabled = visibleIds.length === 0 || !state.catalogQuery.trim();

  document.querySelectorAll("[data-bulk-action]").forEach(button => {
    button.disabled = state.selectedSongIds.size === 0;
  });
}

function renderSongs() {
  const songs = visibleSongs();
  renderBulkControls(songs);

  els.songAdmin.innerHTML = songs.map(song => `
      <div class="toggle-row">
        <label class="row-check" aria-label="Select ${escapeHtml(song.title)}">
          <input type="checkbox" data-select-song-id="${song.id}" ${state.selectedSongIds.has(song.id) ? "checked" : ""}>
        </label>
        <div class="song-row-main">
          <div class="song-title-line">
            <strong>${escapeHtml(song.title)}</strong>
            ${song.featured ? `<span class="tag favourite-tag">Favourite</span>` : ""}
          </div>
          <p class="muted">${escapeHtml(song.artist)} · ${escapeHtml(songMeta(song))}</p>
        </div>
        <div class="song-row-actions">
          <button class="ghost" type="button" data-edit-song-id="${song.id}">Edit</button>
          <label class="switch" aria-label="${song.available ? "Available" : "Unavailable"}">
            <input type="checkbox" data-song-id="${song.id}" ${song.available ? "checked" : ""}>
            <span class="slider"></span>
          </label>
        </div>
      </div>
    `).join("") || `<div class="empty">No songs match that catalog search.</div>`;
}

function renderArchive() {
  if (!state.dashboard.archivedGigs.length) {
    els.archiveList.innerHTML = `<div class="empty">Archived gigs will appear here.</div>`;
    return;
  }

  els.archiveList.innerHTML = state.dashboard.archivedGigs.map(gig => `
    <article class="archive-card">
      <div>
        <strong>${escapeHtml(gig.name)}</strong>
        <p>${escapeHtml(gig.venue || "No venue")}${gig.scheduledAt ? ` · ${dateTimeLabel(gig.scheduledAt)}` : ""} · ${gig.requestCount || 0} request${gig.requestCount === 1 ? "" : "s"} · archived ${dateTimeLabel(gig.archivedAt)}</p>
      </div>
      <div class="archive-actions">
        <button class="mini-button" type="button" data-open-archive-id="${gig.id}">Open</button>
        <button class="mini-button" type="button" data-start-archive-id="${gig.id}">New</button>
        <button class="mini-button danger-button" type="button" data-delete-archive-id="${gig.id}">Delete</button>
      </div>
    </article>
  `).join("");
}

function renderArchiveDialog(gig) {
  state.archiveGig = gig;
  els.archiveDialogTitle.textContent = gig.name;
  els.archiveDialogMeta.textContent = `${gig.venue || "No venue"}${gig.scheduledAt ? ` · ${dateTimeLabel(gig.scheduledAt)}` : ""} · ${gig.requestCount} request${gig.requestCount === 1 ? "" : "s"} · archived ${dateTimeLabel(gig.archivedAt)}`;

  if (!gig.requests.length) {
    els.archiveRequestList.innerHTML = `<div class="empty">No requests were saved for this gig.</div>`;
  } else {
    els.archiveRequestList.innerHTML = gig.requests.map(request => `
      <article class="archive-request">
        <div>
          <strong>${escapeHtml(request.song && request.song.title || "Unknown song")}</strong>
          <p>${escapeHtml(request.song && request.song.artist || "")}</p>
        </div>
        <span class="status-pill" data-status="${request.status}">${statusLabels[request.status] || request.status}</span>
        <p class="muted">${request.guestName ? escapeHtml(request.guestName) : "Anonymous"}${request.message ? ` · ${escapeHtml(request.message)}` : ""}</p>
      </article>
    `).join("");
  }

  openDialog(els.archiveDialog);
}

function openGigForm(gig = null, mode = "create") {
  els.gigForm.reset();
  const isEdit = mode === "edit";
  els.gigMode.value = mode;
  els.gigId.value = isEdit ? (gig && gig.id || "") : "";
  els.gigDialogTitle.textContent = isEdit
    ? "Edit active gig"
    : gig
      ? "Start from archived gig"
      : "Start a fresh queue";
  els.gigDialogHint.textContent = isEdit
    ? "Update the details shown on the dashboard and audience page."
    : gig
      ? "Review the details before starting the new active gig."
      : "The current gig will be archived automatically.";
  els.gigName.value = gig && gig.name || "Tonight's Set";
  els.gigVenue.value = gig && gig.venue || "";
  els.gigScheduledAt.value = localDateTimeValue(gig && gig.scheduledAt);
  els.gigNotes.value = gig && gig.notes || "";
  openDialog(els.gigDialog);
}

function renderDashboard() {
  const { singer, activeGig } = state.dashboard;
  els.dashboardSinger.textContent = singer.stageName;
  const settings = state.dashboard.settings || {};

  if (!state.publicSettingsDirty) {
    els.publicStageName.value = singer.stageName || "";
    els.publicTagline.value = singer.tagline || "";
    els.publicHeroTitle.value = settings.heroTitle || "";
    els.publicHeroText.value = settings.heroText || "";
    els.publicProfileImageUrl.value = settings.profileImageUrl || "";
    els.publicBackgroundImageUrl.value = settings.backgroundImageUrl || "";
    renderImagePreview(els.publicProfileImagePreview, settings.profileImageUrl, "No photo");
    renderImagePreview(els.publicBackgroundImagePreview, settings.backgroundImageUrl, "Default background");
  }

  if (!state.filterSettingsDirty) {
    els.audienceFiltersEnabled.checked = settings.audienceFiltersEnabled !== false;
    els.audienceFilters.value = Array.isArray(settings.audienceFilters)
      ? settings.audienceFilters.join(", ")
      : "";
  }

  if (activeGig) {
    els.activeGigName.textContent = activeGig.name;
    els.activeGigMeta.textContent = `${activeGig.venue || "No venue"}${activeGig.scheduledAt ? ` · ${dateTimeLabel(activeGig.scheduledAt)}` : ""} · started ${timeLabel(activeGig.startedAt)}`;
    els.activeGigControlName.textContent = activeGig.name;
    els.activeGigControlMeta.textContent = `${activeGig.venue || "No venue"}${activeGig.scheduledAt ? ` · ${dateTimeLabel(activeGig.scheduledAt)}` : ""} · requests are open`;
    els.editActiveGig.disabled = false;
    els.endActiveGig.disabled = false;
  } else {
    els.activeGigName.textContent = "No active gig";
    els.activeGigMeta.textContent = "Start a new gig to open audience requests.";
    els.activeGigControlName.textContent = "No active gig";
    els.activeGigControlMeta.textContent = "Start a new gig to open audience requests.";
    els.editActiveGig.disabled = true;
    els.endActiveGig.disabled = true;
  }

  renderRequests();
  state.selectedSongIds = new Set(Array.from(state.selectedSongIds).filter(id =>
    state.dashboard.songs.some(song => song.id === id)
  ));
  renderSongs();
  renderArchive();
}

async function loadDashboard() {
  try {
    state.dashboard = await api("/api/dashboard");
    renderDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

els.requestList.addEventListener("click", async event => {
  const button = event.target.closest("[data-request-id], [data-request-ids]");
  if (!button) return;
  const requestIds = button.dataset.requestIds
    ? button.dataset.requestIds.split(",").filter(Boolean)
    : [button.dataset.requestId];

  try {
    await Promise.all(requestIds.map(id => api(`/api/requests/${id}`, {
      method: "PATCH",
      body: JSON.stringify({ status: button.dataset.status })
    })));
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.songAdmin.addEventListener("change", async event => {
  const selection = event.target.closest("[data-select-song-id]");
  if (selection) {
    if (selection.checked) {
      state.selectedSongIds.add(selection.dataset.selectSongId);
    } else {
      state.selectedSongIds.delete(selection.dataset.selectSongId);
    }
    renderSongs();
    return;
  }

  const input = event.target.closest("[data-song-id]");
  if (!input) return;
  try {
    await api(`/api/songs/${input.dataset.songId}`, {
      method: "PATCH",
      body: JSON.stringify({ available: input.checked })
    });
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.selectVisibleSongs.addEventListener("change", () => {
  const ids = visibleSongs().map(song => song.id);
  const shouldSelect = els.selectVisibleSongs.checked;

  ids.forEach(id => {
    if (shouldSelect) {
      state.selectedSongIds.add(id);
    } else {
      state.selectedSongIds.delete(id);
    }
  });

  renderSongs();
});

async function bulkUpdate(ids, updates, successMessage) {
  if (!ids.length) {
    showToast("Choose at least one song.");
    return;
  }

  try {
    const result = await api("/api/songs/bulk", {
      method: "PATCH",
      body: JSON.stringify({ ids, updates })
    });
    showToast(`${successMessage} ${result.count} song${result.count === 1 ? "" : "s"}.`);
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
}

document.querySelector(".bulk-toolbar").addEventListener("click", async event => {
  const button = event.target.closest("[data-bulk-action]");
  if (!button) return;

  const ids = Array.from(state.selectedSongIds);
  if (button.dataset.bulkAction === "delete") {
    if (!ids.length) {
      showToast("Choose at least one song.");
      return;
    }
    if (!window.confirm(`Delete ${ids.length} selected song${ids.length === 1 ? "" : "s"} from the catalog?`)) return;

    try {
      const result = await api("/api/songs/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids, action: "delete" })
      });
      state.selectedSongIds.clear();
      showToast(`Deleted ${result.count} song${result.count === 1 ? "" : "s"}.`);
      await loadDashboard();
    } catch (error) {
      showToast(error.message);
    }
    return;
  }

  const actions = {
    favourite: { updates: { featured: true }, message: "Favourited" },
    unfavourite: { updates: { featured: false }, message: "Unfavourited" },
    available: { updates: { available: true }, message: "Made available" },
    unavailable: { updates: { available: false }, message: "Made unavailable" }
  };
  const action = actions[button.dataset.bulkAction];
  await bulkUpdate(ids, action.updates, action.message);
});

els.makeVisibleOnly.addEventListener("click", async () => {
  const visibleIds = visibleSongs().map(song => song.id);
  const hiddenIds = state.dashboard.songs
    .filter(song => visibleIds.indexOf(song.id) === -1)
    .map(song => song.id);

  if (!visibleIds.length) {
    showToast("Search or filter down to the songs you want first.");
    return;
  }

  if (!state.catalogQuery.trim()) {
    showToast("Search first, then make the visible songs available.");
    return;
  }

  try {
    await api("/api/songs/bulk", {
      method: "PATCH",
      body: JSON.stringify({ ids: visibleIds, updates: { available: true } })
    });
    if (hiddenIds.length) {
      await api("/api/songs/bulk", {
        method: "PATCH",
        body: JSON.stringify({ ids: hiddenIds, updates: { available: false } })
      });
    }
    state.selectedSongIds = new Set(visibleIds);
    showToast(`Only ${visibleIds.length} visible song${visibleIds.length === 1 ? " is" : "s are"} available.`);
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.songAdmin.addEventListener("click", event => {
  const button = event.target.closest("[data-edit-song-id]");
  if (!button) return;
  const song = findSong(button.dataset.editSongId);
  if (!song) return;

  state.editingSongId = song.id;
  els.editSongHeading.textContent = song.title;
  els.editSongTitle.value = song.title;
  els.editSongArtist.value = song.artist;
  els.editSongTags.value = tagsFor(song).join(", ");
  els.editSongAvailable.checked = Boolean(song.available);
  els.editSongFeatured.checked = Boolean(song.featured);
  openDialog(els.editSongDialog);
});

document.querySelector(".segmented").addEventListener("click", event => {
  const button = event.target.closest("[data-sort]");
  if (!button) return;
  state.catalogSort = button.dataset.sort;
  document.querySelectorAll("[data-sort]").forEach(item => {
    item.classList.toggle("active", item === button);
  });
  renderSongs();
});

els.catalogSearch.addEventListener("input", () => {
  state.catalogQuery = els.catalogSearch.value;
  renderSongs();
});

els.publicProfileImageFile.addEventListener("change", async () => {
  state.publicSettingsDirty = true;
  try {
    const value = await resizeImageFile(els.publicProfileImageFile.files[0], 640);
    els.publicProfileImageUrl.value = value;
    renderImagePreview(els.publicProfileImagePreview, value, "No photo");
  } catch (error) {
    els.publicProfileImageFile.value = "";
    showToast(error.message);
  }
});

els.publicBackgroundImageFile.addEventListener("change", async () => {
  state.publicSettingsDirty = true;
  try {
    const value = await resizeImageFile(els.publicBackgroundImageFile.files[0], 1600);
    els.publicBackgroundImageUrl.value = value;
    renderImagePreview(els.publicBackgroundImagePreview, value, "Default background");
  } catch (error) {
    els.publicBackgroundImageFile.value = "";
    showToast(error.message);
  }
});

els.publicSettingsForm.addEventListener("click", event => {
  const button = event.target.closest("[data-clear-public-image]");
  if (!button) return;

  if (button.dataset.clearPublicImage === "profile") {
    state.publicSettingsDirty = true;
    els.publicProfileImageFile.value = "";
    els.publicProfileImageUrl.value = "";
    renderImagePreview(els.publicProfileImagePreview, "", "No photo");
  }

  if (button.dataset.clearPublicImage === "background") {
    state.publicSettingsDirty = true;
    els.publicBackgroundImageFile.value = "";
    els.publicBackgroundImageUrl.value = "";
    renderImagePreview(els.publicBackgroundImagePreview, "", "Default background");
  }
});

els.publicSettingsForm.addEventListener("input", () => {
  state.publicSettingsDirty = true;
});

els.publicSettingsForm.addEventListener("change", () => {
  state.publicSettingsDirty = true;
});

els.publicSettingsForm.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        stageName: els.publicStageName.value,
        tagline: els.publicTagline.value,
        heroTitle: els.publicHeroTitle.value,
        heroText: els.publicHeroText.value,
        profileImageUrl: els.publicProfileImageUrl.value,
        backgroundImageUrl: els.publicBackgroundImageUrl.value
      })
    });
    state.publicSettingsDirty = false;
    showToast("Public page saved.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.deleteSong.addEventListener("click", async () => {
  const song = findSong(state.editingSongId);
  if (!song) return;
  if (!window.confirm(`Delete ${song.title} from the catalog?`)) return;

  try {
    await api(`/api/songs/${song.id}`, { method: "DELETE" });
    state.editingSongId = null;
    closeDialog(els.editSongDialog);
    showToast("Song deleted.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.filterSettingsForm.addEventListener("input", () => {
  state.filterSettingsDirty = true;
});

els.filterSettingsForm.addEventListener("change", () => {
  state.filterSettingsDirty = true;
});

els.filterSettingsForm.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    await api("/api/settings", {
      method: "PATCH",
      body: JSON.stringify({
        audienceFiltersEnabled: els.audienceFiltersEnabled.checked,
        audienceFilters: els.audienceFilters.value.split(/[|;,]/).map(filter => filter.trim()).filter(Boolean)
      })
    });
    state.filterSettingsDirty = false;
    showToast("Audience filters saved.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.archiveList.addEventListener("click", async event => {
  const openButton = event.target.closest("[data-open-archive-id]");
  const startButton = event.target.closest("[data-start-archive-id]");
  const deleteButton = event.target.closest("[data-delete-archive-id]");

  try {
    if (openButton) {
      const result = await api(`/api/gigs/${openButton.dataset.openArchiveId}`);
      renderArchiveDialog(result.gig);
      return;
    }

    if (startButton) {
      const result = await api(`/api/gigs/${startButton.dataset.startArchiveId}`);
      openGigForm(result.gig);
      return;
    }

    if (deleteButton) {
      const gig = state.dashboard.archivedGigs.find(item => item.id === deleteButton.dataset.deleteArchiveId);
      const name = gig && gig.name || "this archived gig";
      if (!window.confirm(`Delete ${name} and its saved requests?`)) return;

      await api(`/api/gigs/${deleteButton.dataset.deleteArchiveId}`, { method: "DELETE" });
      showToast("Archived gig deleted.");
      await loadDashboard();
    }
  } catch (error) {
    showToast(error.message);
  }
});

els.closeArchiveDialog.addEventListener("click", () => closeDialog(els.archiveDialog));

els.startFromArchive.addEventListener("click", async () => {
  if (!state.archiveGig) return;
  openGigForm(state.archiveGig);
  closeDialog(els.archiveDialog);
});

els.songForm.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const tags = els.songTags.value.split(/[|;,]/).map(tag => tag.trim()).filter(Boolean);
    await api("/api/songs", {
      method: "POST",
      body: JSON.stringify({
        title: els.songTitle.value,
        artist: els.songArtist.value,
        tags
      })
    });
    els.songForm.reset();
    showToast("Song added.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.openImportDialog.addEventListener("click", () => {
  els.importForm.reset();
  openDialog(els.importDialog);
});

els.cancelImport.addEventListener("click", () => closeDialog(els.importDialog));

els.importForm.addEventListener("submit", async event => {
  event.preventDefault();
  try {
    const result = await api("/api/songs/import", {
      method: "POST",
      body: JSON.stringify({ text: els.importText.value })
    });
    closeDialog(els.importDialog);
    showToast(`Imported ${result.imported.length} song${result.imported.length === 1 ? "" : "s"}.`);
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.cancelEditSong.addEventListener("click", () => closeDialog(els.editSongDialog));

els.editSongForm.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.editingSongId) return;

  try {
    await api(`/api/songs/${state.editingSongId}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: els.editSongTitle.value,
        artist: els.editSongArtist.value,
        tags: els.editSongTags.value.split(/[|;,]/).map(tag => tag.trim()).filter(Boolean),
        available: els.editSongAvailable.checked,
        featured: els.editSongFeatured.checked
      })
    });
    closeDialog(els.editSongDialog);
    state.editingSongId = null;
    showToast("Song updated.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.openGigDialog.addEventListener("click", () => {
  openGigForm();
});

els.editActiveGig.addEventListener("click", () => {
  if (!state.dashboard.activeGig) return;
  openGigForm(state.dashboard.activeGig, "edit");
});

els.endActiveGig.addEventListener("click", async () => {
  const gig = state.dashboard.activeGig;
  if (!gig) return;
  if (!window.confirm(`End ${gig.name} and close audience requests?`)) return;

  try {
    await api(`/api/gigs/${gig.id}/end`, { method: "POST" });
    showToast("Gig ended. Audience requests are closed.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

els.cancelGig.addEventListener("click", () => closeDialog(els.gigDialog));

els.gigForm.addEventListener("submit", async event => {
  event.preventDefault();
  const mode = els.gigMode.value;
  const isEdit = mode === "edit";
  const body = JSON.stringify({
    name: els.gigName.value,
    venue: els.gigVenue.value,
    scheduledAt: els.gigScheduledAt.value,
    notes: els.gigNotes.value
  });

  try {
    await api(isEdit ? `/api/gigs/${els.gigId.value}` : "/api/gigs", {
      method: isEdit ? "PATCH" : "POST",
      body
    });
    closeDialog(els.gigDialog);
    showToast(isEdit ? "Gig details updated." : "New gig started. Previous gig archived.");
    await loadDashboard();
  } catch (error) {
    showToast(error.message);
  }
});

loadDashboard();
window.setInterval(loadDashboard, 5000);
