const http = require("http");
const fs = require("fs/promises");
const path = require("path");
const crypto = require("crypto");

const PORT = Number(process.env.PORT || 3000);
const ROOT = __dirname;
const PUBLIC_DIR = path.join(ROOT, "public");
const DB_PATH = path.join(ROOT, "data", "db.json");
let writeQueue = Promise.resolve();

const contentTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

async function readDb() {
  return JSON.parse(await fs.readFile(DB_PATH, "utf8"));
}

async function writeDb(db) {
  await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2) + "\n");
}

function mutateDb(callback) {
  const next = writeQueue.then(async () => {
    const db = await readDb();
    const result = await callback(db);
    await writeDb(db);
    return result;
  });
  writeQueue = next.catch(() => {});
  return next;
}

function sendJson(res, status, data) {
  res.writeHead(status, { "Content-Type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", chunk => {
      body += chunk;
      if (body.length > 6_000_000) {
        reject(new Error("Request body too large"));
      }
    });
    req.on("end", () => {
      if (!body) return resolve({});
      try {
        resolve(JSON.parse(body));
      } catch {
        reject(new Error("Invalid JSON"));
      }
    });
    req.on("error", reject);
  });
}

function activeGig(db) {
  return db.gigs.find(gig => gig.status === "active") || null;
}

function cleanText(value, maxLength = 120) {
  return String(value || "").trim().slice(0, maxLength);
}

function cleanMediaValue(value) {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.startsWith("data:image/")) return text.slice(0, 5_500_000);
  if (/^https?:\/\//i.test(text)) return text.slice(0, 1_000);
  return "";
}

function uniqueTags(tags) {
  return [...new Set(tags.map(tag => cleanText(tag, 32)).filter(Boolean))];
}

function songTags(song) {
  return uniqueTags([
    ...(Array.isArray(song.tags) ? song.tags : []),
    song.genre,
    song.decade
  ]);
}

function songView(song) {
  return {
    ...song,
    tags: songTags(song)
  };
}

function defaultSettings() {
  return {
    audienceFiltersEnabled: true,
    audienceFilters: ["Favourites", "Pop", "Soul", "Rock", "Ballad", "Classic"],
    heroTitle: "Pick the next song",
    heroText: "Browse the live song list, send a request, and it will appear straight on the singer's dashboard.",
    profileImageUrl: "",
    backgroundImageUrl: ""
  };
}

function settingsView(db) {
  return {
    ...defaultSettings(),
    ...(db.settings || {})
  };
}

function requestView(db, request) {
  const song = db.songs.find(item => item.id === request.songId);
  return {
    ...request,
    song: song ? songView({
      title: song.title,
      artist: song.artist,
      genre: song.genre,
      decade: song.decade,
      tags: song.tags
    }) : null
  };
}

function gigView(db, gig) {
  const requests = db.requests
    .filter(request => request.gigId === gig.id)
    .map(request => requestView(db, request));

  return {
    ...gig,
    requestCount: requests.length,
    requests
  };
}

function createSong(body) {
  const title = cleanText(body.title, 120);
  const artist = cleanText(body.artist, 120);
  const tags = uniqueTags(Array.isArray(body.tags)
    ? body.tags
    : String(body.tags || "")
      .split(/[|;,]/)
      .map(tag => tag.trim()));

  if (!title || !artist) {
    return { error: "Song title and artist are required." };
  }

  return {
    song: {
      id: `song_${crypto.randomUUID()}`,
      title,
      artist,
      tags,
      available: body.available === undefined ? true : Boolean(body.available),
      featured: Boolean(body.featured)
    }
  };
}

function parseCsvLine(line) {
  const cells = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === "\"" && quoted && next === "\"") {
      current += "\"";
      index += 1;
    } else if (char === "\"") {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(current.trim());
      current = "";
    } else {
      current += char;
    }
  }

  cells.push(current.trim());
  return cells;
}

async function handleApi(req, res, url) {
  if (req.method === "GET" && url.pathname === "/api/public") {
    const db = await readDb();
    const gig = activeGig(db);
    return sendJson(res, 200, {
      singer: db.singer,
      activeGig: gig,
      settings: settingsView(db),
      songs: db.songs.filter(song => !song.deletedAt && song.available).map(songView)
    });
  }

  if (req.method === "GET" && url.pathname === "/api/dashboard") {
    const db = await readDb();
    const gig = activeGig(db);
    const gigRequests = gig
      ? db.requests.filter(item => item.gigId === gig.id).map(item => requestView(db, item))
      : [];

    return sendJson(res, 200, {
      singer: db.singer,
      activeGig: gig,
      settings: settingsView(db),
      songs: db.songs.filter(song => !song.deletedAt).map(songView),
      requests: gigRequests,
      archivedGigs: db.gigs
        .filter(item => item.status === "archived")
        .map(item => ({
          ...item,
          requestCount: db.requests.filter(request => request.gigId === item.id).length
        }))
        .sort((a, b) => String(b.archivedAt).localeCompare(String(a.archivedAt)))
    });
  }

  if (req.method === "GET" && url.pathname.startsWith("/api/gigs/")) {
    const db = await readDb();
    const id = url.pathname.split("/").pop();
    const gig = db.gigs.find(item => item.id === id);

    if (!gig) return sendJson(res, 404, { error: "Gig not found." });
    return sendJson(res, 200, { gig: gigView(db, gig) });
  }

  if (req.method === "POST" && url.pathname === "/api/requests") {
    const body = await readBody(req);
    return mutateDb(db => {
      const gig = activeGig(db);
      const song = db.songs.find(item => item.id === body.songId && !item.deletedAt && item.available);

      if (!gig) return sendJson(res, 409, { error: "Requests are closed right now." });
      if (!song) return sendJson(res, 400, { error: "Please choose an available song." });

      const newRequest = {
        id: `req_${crypto.randomUUID()}`,
        gigId: gig.id,
        songId: song.id,
        guestName: String(body.guestName || "").trim().slice(0, 80),
        message: String(body.message || "").trim().slice(0, 180),
        status: "new",
        createdAt: new Date().toISOString()
      };

      db.requests.push(newRequest);
      return sendJson(res, 201, { request: requestView(db, newRequest) });
    });
  }

  if (req.method === "POST" && url.pathname === "/api/gigs") {
    const body = await readBody(req);
    return mutateDb(db => {
      const now = new Date().toISOString();

      db.gigs = db.gigs.map(gig => {
        if (gig.status !== "active") return gig;
        return { ...gig, status: "archived", archivedAt: now };
      });

      const newGig = {
        id: `gig_${crypto.randomUUID()}`,
        name: String(body.name || "New Gig").trim().slice(0, 80),
        venue: String(body.venue || "").trim().slice(0, 80),
        scheduledAt: String(body.scheduledAt || "").trim().slice(0, 40),
        notes: String(body.notes || "").trim().slice(0, 240),
        status: "active",
        startedAt: now,
        archivedAt: null
      };

      db.gigs.push(newGig);
      return sendJson(res, 201, { activeGig: newGig });
    });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/gigs/")) {
    const id = url.pathname.split("/").pop();
    return mutateDb(db => {
      const gig = db.gigs.find(item => item.id === id);

      if (!gig) return sendJson(res, 404, { error: "Gig not found." });
      if (gig.status === "active") {
        return sendJson(res, 400, { error: "Archive the active gig before deleting it." });
      }

      db.gigs = db.gigs.filter(item => item.id !== id);
      db.requests = db.requests.filter(request => request.gigId !== id);
      return sendJson(res, 200, { deleted: true, gigId: id });
    });
  }

  if (req.method === "POST" && url.pathname === "/api/songs") {
    const body = await readBody(req);
    return mutateDb(db => {
      const result = createSong(body);

      if (result.error) return sendJson(res, 400, { error: result.error });

      db.songs.push(result.song);
      return sendJson(res, 201, { song: songView(result.song) });
    });
  }

  if (req.method === "POST" && url.pathname === "/api/songs/import") {
    const body = await readBody(req);
    return mutateDb(db => {
      const lines = String(body.text || "")
        .split(/\r?\n/)
        .map(line => line.trim())
        .filter(Boolean);
      const imported = [];
      const skipped = [];

      lines.forEach((line, index) => {
        const [title, artist, tagText = ""] = parseCsvLine(line);
        const lowerTitle = String(title || "").toLowerCase();
        const lowerArtist = String(artist || "").toLowerCase();

        if (index === 0 && lowerTitle === "title" && lowerArtist === "artist") return;

        const result = createSong({
          title,
          artist,
          tags: tagText.split(/[|;]/).map(tag => tag.trim())
        });

        if (result.error) {
          skipped.push({ line, error: result.error });
          return;
        }

        const duplicate = db.songs.some(song =>
          !song.deletedAt &&
          song.title.toLowerCase() === result.song.title.toLowerCase() &&
          song.artist.toLowerCase() === result.song.artist.toLowerCase()
        );

        if (duplicate) {
          skipped.push({ line, error: "Duplicate song." });
          return;
        }

        db.songs.push(result.song);
        imported.push(songView(result.song));
      });

      return sendJson(res, 201, { imported, skipped });
    });
  }

  if (req.method === "PATCH" && url.pathname === "/api/settings") {
    const body = await readBody(req);
    return mutateDb(db => {
      const current = settingsView(db);
      const filters = "audienceFilters" in body
        ? uniqueTags(Array.isArray(body.audienceFilters)
          ? body.audienceFilters
          : String(body.audienceFilters || "").split(/[|;,]/)).slice(0, 8)
        : current.audienceFilters;

      if ("stageName" in body) db.singer.stageName = cleanText(body.stageName, 80) || db.singer.stageName;
      if ("tagline" in body) db.singer.tagline = cleanText(body.tagline, 120);

      db.settings = {
        ...current,
        audienceFiltersEnabled: "audienceFiltersEnabled" in body
          ? Boolean(body.audienceFiltersEnabled)
          : current.audienceFiltersEnabled,
        audienceFilters: filters,
        heroTitle: "heroTitle" in body ? cleanText(body.heroTitle, 80) : current.heroTitle,
        heroText: "heroText" in body ? cleanText(body.heroText, 220) : current.heroText,
        profileImageUrl: "profileImageUrl" in body ? cleanMediaValue(body.profileImageUrl) : current.profileImageUrl,
        backgroundImageUrl: "backgroundImageUrl" in body ? cleanMediaValue(body.backgroundImageUrl) : current.backgroundImageUrl
      };

      return sendJson(res, 200, { singer: db.singer, settings: settingsView(db) });
    });
  }

  if (req.method === "PATCH" && url.pathname === "/api/songs/bulk") {
    const body = await readBody(req);
    const ids = new Set(Array.isArray(body.ids) ? body.ids.map(String) : []);
    const updates = body.updates && typeof body.updates === "object" ? body.updates : {};

    if (!ids.size) return sendJson(res, 400, { error: "Choose at least one song." });
    if (!("available" in updates) && !("featured" in updates)) {
      return sendJson(res, 400, { error: "Choose a bulk action." });
    }

    return mutateDb(db => {
      const updated = [];

      db.songs.forEach(song => {
        if (song.deletedAt) return;
        if (!ids.has(song.id)) return;
        if ("available" in updates) song.available = Boolean(updates.available);
        if ("featured" in updates) song.featured = Boolean(updates.featured);
        updated.push(songView(song));
      });

      return sendJson(res, 200, { updated, count: updated.length });
    });
  }

  if (req.method === "DELETE" && url.pathname.startsWith("/api/songs/")) {
    const id = url.pathname.split("/").pop();
    return mutateDb(db => {
      const song = db.songs.find(item => item.id === id && !item.deletedAt);

      if (!song) return sendJson(res, 404, { error: "Song not found." });

      song.deletedAt = new Date().toISOString();
      song.available = false;
      song.featured = false;
      return sendJson(res, 200, { deleted: true, songId: id });
    });
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/requests/")) {
    const body = await readBody(req);
    const id = url.pathname.split("/").pop();
    return mutateDb(db => {
      const allowed = new Set(["new", "queued", "singing", "done", "skipped"]);
      const request = db.requests.find(item => item.id === id);

      if (!request) return sendJson(res, 404, { error: "Request not found." });
      if (!allowed.has(body.status)) return sendJson(res, 400, { error: "Invalid request status." });

      request.status = body.status;
      return sendJson(res, 200, { request: requestView(db, request) });
    });
  }

  if (req.method === "PATCH" && url.pathname.startsWith("/api/songs/")) {
    const body = await readBody(req);
    const id = url.pathname.split("/").pop();
    return mutateDb(db => {
      const song = db.songs.find(item => item.id === id && !item.deletedAt);

      if (!song) return sendJson(res, 404, { error: "Song not found." });
      if ("available" in body) song.available = Boolean(body.available);
      if ("featured" in body) song.featured = Boolean(body.featured);
      if ("title" in body) song.title = cleanText(body.title, 120);
      if ("artist" in body) song.artist = cleanText(body.artist, 120);
      if ("tags" in body) {
        song.tags = uniqueTags(Array.isArray(body.tags)
          ? body.tags
          : String(body.tags || "").split(/[|;,]/));
        delete song.genre;
        delete song.decade;
      }
      return sendJson(res, 200, { song: songView(song) });
    });
  }

  return sendJson(res, 404, { error: "Not found." });
}

async function serveStatic(req, res, url) {
  let filePath = url.pathname === "/" ? "/index.html" : url.pathname;
  if (filePath === "/dashboard") filePath = "/dashboard.html";
  if (filePath === "/request") filePath = "/index.html";

  const resolved = path.normalize(path.join(PUBLIC_DIR, filePath));
  if (!resolved.startsWith(PUBLIC_DIR)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const data = await fs.readFile(resolved);
    const ext = path.extname(resolved);
    res.writeHead(200, { "Content-Type": contentTypes[ext] || "application/octet-stream" });
    res.end(data);
  } catch {
    res.writeHead(404, { "Content-Type": "text/plain; charset=utf-8" });
    res.end("Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  try {
    if (url.pathname.startsWith("/api/")) {
      await handleApi(req, res, url);
      return;
    }
    await serveStatic(req, res, url);
  } catch (error) {
    sendJson(res, 500, { error: error.message || "Server error" });
  }
});

server.listen(PORT, () => {
  console.log(`Sing Request MVP running at http://localhost:${PORT}`);
  console.log(`Audience page: http://localhost:${PORT}/request`);
  console.log(`Singer dashboard: http://localhost:${PORT}/dashboard`);
});
