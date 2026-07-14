const state = {
  songs: [],
  settings: {
    audienceFiltersEnabled: true,
    audienceFilters: []
  },
  selectedFilter: "All",
  selectedSong: null,
  sort: "title"
};

const favouriteFilter = "Favourites";

const els = {
  singerName: document.querySelector("#singerName"),
  tagline: document.querySelector("#tagline"),
  profileMark: document.querySelector("#profileMark"),
  profileImage: document.querySelector("#profileImage"),
  heroTitle: document.querySelector("#heroTitle"),
  heroText: document.querySelector("#heroText"),
  intro: document.querySelector(".intro"),
  requestHeading: document.querySelector("#requestHeading"),
  gigVenue: document.querySelector("#gigVenue"),
  searchInput: document.querySelector("#searchInput"),
  genreChips: document.querySelector("#genreChips"),
  songList: document.querySelector("#songList"),
  sortButtons: document.querySelectorAll("[data-sort]"),
  refreshButton: document.querySelector("#refreshButton"),
  dialog: document.querySelector("#requestDialog"),
  form: document.querySelector("#requestForm"),
  dialogSongTitle: document.querySelector("#dialogSongTitle"),
  dialogSongArtist: document.querySelector("#dialogSongArtist"),
  guestName: document.querySelector("#guestName"),
  message: document.querySelector("#message"),
  cancelRequest: document.querySelector("#cancelRequest"),
  toast: document.querySelector("#toast")
};

function escapeHtml(value) {
  return String(value == null ? "" : value).replace(/[&<>"']/g, char => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#039;"
  })[char]);
}

function showToast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  window.setTimeout(() => els.toast.classList.remove("show"), 2600);
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

function songMatches(song) {
  const query = els.searchInput.value.trim().toLowerCase();
  const tags = tagsFor(song);
  const lowerTags = tags.map(tag => tag.toLowerCase());
  const selectedFilter = state.selectedFilter.toLowerCase();
  const tagMatchesFilter = lowerTags.some(tag =>
    tag === selectedFilter ||
    tag.indexOf(selectedFilter) !== -1 ||
    selectedFilter.indexOf(tag) !== -1
  );
  const filterMatch = state.selectedFilter === "All" ||
    (selectedFilter === favouriteFilter.toLowerCase() ? song.featured : tagMatchesFilter);
  const textMatch = !query || `${song.title} ${song.artist} ${tags.join(" ")}`.toLowerCase().indexOf(query) !== -1;
  return filterMatch && textMatch;
}

function tagsFor(song) {
  return Array.isArray(song.tags) ? song.tags : [song.genre, song.decade].filter(Boolean);
}

function quotedUrl(value) {
  return `url(${JSON.stringify(value)})`;
}

function renderPublicSettings(data) {
  const settings = data.settings || {};
  els.singerName.textContent = data.singer.stageName;
  els.tagline.textContent = data.singer.tagline;
  els.heroTitle.textContent = settings.heroTitle || "Pick the next song";
  els.heroText.textContent = settings.heroText || "";

  if (settings.profileImageUrl) {
    els.profileImage.src = settings.profileImageUrl;
    els.profileMark.classList.add("has-photo");
  } else {
    els.profileImage.removeAttribute("src");
    els.profileMark.classList.remove("has-photo");
  }

  if (settings.backgroundImageUrl) {
    els.intro.style.setProperty("--hero-image", quotedUrl(settings.backgroundImageUrl));
  } else {
    els.intro.style.removeProperty("--hero-image");
  }
}

function renderGenres() {
  if (!state.settings.audienceFiltersEnabled) {
    state.selectedFilter = "All";
    els.genreChips.innerHTML = "";
    return;
  }

  const configuredFilters = Array.isArray(state.settings.audienceFilters)
    ? state.settings.audienceFilters
    : [];
  const filters = ["All"].concat(configuredFilters).slice(0, 8);

  if (filters.indexOf(state.selectedFilter) === -1) state.selectedFilter = "All";

  els.genreChips.innerHTML = filters.map(filter => `
    <button class="chip ${filter === state.selectedFilter ? "active" : ""}" type="button" data-filter="${filter}">
      ${escapeHtml(filter)}
    </button>
  `).join("");
}

function renderSongs() {
  const songs = state.songs.filter(songMatches).sort((a, b) => {
    if (a.featured !== b.featured) return a.featured ? -1 : 1;
    const primary = state.sort === "artist"
      ? a.artist.localeCompare(b.artist)
      : a.title.localeCompare(b.title);
    if (primary !== 0) return primary;
    return a.title.localeCompare(b.title);
  });

  if (!songs.length) {
    els.songList.innerHTML = `<div class="empty">No available songs match that search.</div>`;
    return;
  }

  els.songList.innerHTML = songs.map(song => `
    <article class="song-card">
      <div>
        <h3>${escapeHtml(song.title)}</h3>
        <p>${escapeHtml(song.artist)}</p>
      </div>
      <button class="primary" type="button" data-song-id="${song.id}">Request</button>
    </article>
  `).join("");
}

async function loadPublic() {
  try {
    const data = await api("/api/public");
    renderPublicSettings(data);
    state.songs = data.songs;
    state.settings = data.settings || state.settings;

    if (data.activeGig) {
      els.requestHeading.textContent = data.activeGig.name;
      els.gigVenue.textContent = data.activeGig.venue || "Requests are open";
    } else {
      els.requestHeading.textContent = "Requests are closed";
      els.gigVenue.textContent = "Check back during the next performance.";
    }

    renderGenres();
    renderSongs();
  } catch (error) {
    showToast(error.message);
  }
}

els.genreChips.addEventListener("click", event => {
  const button = event.target.closest("[data-filter]");
  if (!button) return;
  state.selectedFilter = button.dataset.filter;
  els.searchInput.value = "";
  renderGenres();
  renderSongs();
});

els.sortButtons.forEach(button => {
  button.addEventListener("click", () => {
    state.sort = button.dataset.sort;
    els.sortButtons.forEach(item => item.classList.toggle("active", item === button));
    renderSongs();
  });
});

els.songList.addEventListener("click", event => {
  const button = event.target.closest("[data-song-id]");
  if (!button) return;
  state.selectedSong = state.songs.find(song => song.id === button.dataset.songId);
  els.dialogSongTitle.textContent = state.selectedSong.title;
  els.dialogSongArtist.textContent = state.selectedSong.artist;
  els.form.reset();
  openDialog(els.dialog);
});

els.form.addEventListener("submit", async event => {
  event.preventDefault();
  if (!state.selectedSong) return;

  try {
    await api("/api/requests", {
      method: "POST",
      body: JSON.stringify({
        songId: state.selectedSong.id,
        guestName: els.guestName.value,
        message: els.message.value
      })
    });
    closeDialog(els.dialog);
    showToast(`Request sent: ${state.selectedSong.title}`);
  } catch (error) {
    showToast(error.message);
  }
});

els.cancelRequest.addEventListener("click", () => closeDialog(els.dialog));
els.searchInput.addEventListener("input", () => {
  if (state.selectedFilter !== "All") {
    state.selectedFilter = "All";
    renderGenres();
  }
  renderSongs();
});
els.refreshButton.addEventListener("click", loadPublic);

loadPublic();
