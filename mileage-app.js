(function () {
  const STORAGE_KEY = "oa_mileage_portal_data";
  const SESSION_KEY = "oa_mileage_portal_session";
  const TRACK_POINT_INTERVAL_MS = 60 * 1000;
  const page = document.body.dataset.page || "";
  const config = window.OA_MILEAGE_CONFIG || {};

  const state = {
    data: loadData(),
    currentUser: null,
    driverWatchId: null,
    driverActiveTripId: null,
    editingTripId: null,
    noticeTimer: null
  };

  document.addEventListener("DOMContentLoaded", () => {
    init().catch((error) => {
      console.error("No se pudo iniciar el portal de kilometraje", error);
    });
  });

  async function init() {
    if (page === "login") {
      initLoginPage();
      return;
    }

    const session = getSession();

    if (!session) {
      redirectTo("index.html");
      return;
    }

    const user = findSessionUser(session);

    if (!user) {
      clearSession();
      redirectTo("index.html");
      return;
    }

    state.currentUser = user;
    await hydrateRemoteData();

    const remoteSessionUser = findUserByUsername(state.currentUser.username);
    if (remoteSessionUser) {
      state.currentUser = remoteSessionUser;
      setSession(remoteSessionUser);
    }

    if (page === "supervisor" && user.role !== "supervisor") {
      redirectByRole(user.role);
      return;
    }

    if (page === "chofer" && user.role !== "chofer") {
      redirectByRole(user.role);
      return;
    }

    bindShellNavigation();
    bindGlobalNotice();
    window.addEventListener("storage", handleExternalRefresh);

    if (page === "supervisor") {
      initSupervisorPage();
    }

    if (page === "chofer") {
      initDriverPage();
    }
  }

  function seedData() {
    const now = new Date();

    function iso(daysOffset, hourOffset, minuteOffset) {
      const date = new Date(now);
      date.setDate(date.getDate() + daysOffset);
      date.setHours(date.getHours() + hourOffset);
      date.setMinutes(date.getMinutes() + (minuteOffset || 0));
      return date.toISOString();
    }

    function localDateTimeValue(daysOffset, hourOffset) {
      const date = new Date(now);
      date.setDate(date.getDate() + daysOffset);
      date.setHours(date.getHours() + hourOffset, 0, 0, 0);
      return date.toISOString().slice(0, 16);
    }

    const activeRoutePoints = [
      { lat: -25.3048, lng: -57.6144, timestamp: iso(0, -2, -30), accuracy: 18, speedKmh: 0 },
      { lat: -25.2904, lng: -57.6041, timestamp: iso(0, -2, -10), accuracy: 15, speedKmh: 38 },
      { lat: -25.2761, lng: -57.5937, timestamp: iso(0, -1, -48), accuracy: 12, speedKmh: 44 },
      { lat: -25.2619, lng: -57.5828, timestamp: iso(0, -1, -22), accuracy: 11, speedKmh: 47 }
    ];

    const completedRoutePoints = [
      { lat: -25.301, lng: -57.635, timestamp: iso(-1, -8, 0), accuracy: 16, speedKmh: 0 },
      { lat: -25.285, lng: -57.620, timestamp: iso(-1, -7, 30), accuracy: 12, speedKmh: 42 },
      { lat: -25.270, lng: -57.600, timestamp: iso(-1, -7, 0), accuracy: 10, speedKmh: 48 },
      { lat: -25.248, lng: -57.580, timestamp: iso(-1, -6, 30), accuracy: 14, speedKmh: 36 }
    ];

    return {
      sequence: {
        trip: 204,
        log: 7
      },
      branches: [
        { id: "br-1", name: "Casa Central Asuncion", city: "Asuncion" },
        { id: "br-2", name: "Sucursal San Lorenzo", city: "San Lorenzo" },
        { id: "br-3", name: "Deposito CDE", city: "Ciudad del Este" },
        { id: "br-4", name: "Planta Limpio", city: "Limpio" }
      ],
      origins: [
        "Casa Central Asuncion",
        "Sucursal San Lorenzo",
        "Deposito CDE",
        "Planta Limpio"
      ],
      destinations: [
        "Ciudad del Este",
        "Encarnacion",
        "Pedro Juan Caballero",
        "Deposito Limpio",
        "Sucursal San Lorenzo",
        "Mariano Roque Alonso",
        "Concepcion",
        "Coronel Oviedo"
      ],
      users: [
        {
          id: "sup-1",
          username: "ClaraS",
          password: "Cla260A",
          role: "supervisor",
          fullName: "Clara Samaniego",
          phone: "0983123123",
          active: true
        },
        {
          id: "drv-1",
          username: "DerlisE",
          password: "Der210A",
          role: "chofer",
          fullName: "Derlis Espinola",
          phone: "0984111222",
          active: true
        },
        {
          id: "drv-2",
          username: "HugoG",
          password: "HG250A",
          role: "chofer",
          fullName: "Hugo Galeano",
          phone: "0984333444",
          active: true
        },
        {
          id: "drv-3",
          username: "FernandoI",
          password: "FIn240A",
          role: "chofer",
          fullName: "Fernando Insaurralde",
          phone: "0984555666",
          active: true
        },
        {
          id: "sup-2",
          username: "AlbertB",
          password: "Ab26oA",
          role: "supervisor",
          fullName: "Alberto Barrios",
          phone: "0983777888",
          active: true
        }
      ],
      trips: [
        {
          id: "trip-201",
          code: "VIA-20260506-201",
          numberLabel: "Viaje Nro 1",
          type: "transferencia",
          destination: "Ciudad del Este",
          notes: "Transferencia con pallets completos. Confirmar descarga en deposito 3.",
          originBranchId: "br-1",
          expectedDeparture: localDateTimeValue(0, 15),
          driverId: "drv-1",
          assignedBy: "sup-1",
          status: "assigned",
          createdAt: iso(0, -1, 0),
          updatedAt: iso(0, -1, 0),
          startedAt: null,
          finishedAt: null,
          totalKm: 0,
          lastPingAt: null,
          currentLat: null,
          currentLng: null,
          routePoints: []
        },
        {
          id: "trip-202",
          code: "VIA-20260506-202",
          numberLabel: "Viaje Nro 2",
          type: "reparto",
          destination: "Sucursal San Lorenzo",
          notes: "Reparto mixto con retorno de envases vacios.",
          originBranchId: "br-4",
          expectedDeparture: localDateTimeValue(0, 12),
          driverId: "drv-2",
          assignedBy: "sup-1",
          status: "in_route",
          createdAt: iso(0, -4, 0),
          updatedAt: iso(0, -1, -22),
          startedAt: iso(0, -2, -35),
          finishedAt: null,
          totalKm: 12.4,
          lastPingAt: iso(0, -1, -22),
          currentLat: activeRoutePoints[activeRoutePoints.length - 1].lat,
          currentLng: activeRoutePoints[activeRoutePoints.length - 1].lng,
          routePoints: activeRoutePoints
        },
        {
          id: "trip-203",
          code: "VIA-20260505-203",
          numberLabel: "Viaje Nro 3",
          type: "reparto",
          destination: "Coronel Oviedo",
          notes: "Entrega con doble control de remito.",
          originBranchId: "br-2",
          expectedDeparture: localDateTimeValue(-1, 7),
          driverId: "drv-1",
          assignedBy: "sup-1",
          status: "completed",
          createdAt: iso(-1, -10, 0),
          updatedAt: iso(-1, -6, 0),
          startedAt: iso(-1, -8, 0),
          finishedAt: iso(-1, -6, 0),
          totalKm: 148.2,
          lastPingAt: iso(-1, -6, 0),
          currentLat: completedRoutePoints[completedRoutePoints.length - 1].lat,
          currentLng: completedRoutePoints[completedRoutePoints.length - 1].lng,
          routePoints: completedRoutePoints
        }
      ],
      activityLogs: [
        {
          id: "log-1",
          type: "assign_trip",
          userId: "sup-1",
          tripId: "trip-201",
          createdAt: iso(0, -1, 0),
          detail: "Asigno viaje a Raul Benitez"
        },
        {
          id: "log-2",
          type: "start_trip",
          userId: "drv-2",
          tripId: "trip-202",
          createdAt: iso(0, -2, -35),
          detail: "Inicio viaje hacia San Lorenzo"
        },
        {
          id: "log-3",
          type: "finish_trip",
          userId: "drv-1",
          tripId: "trip-203",
          createdAt: iso(-1, -6, 0),
          detail: "Finalizo viaje a Coronel Oviedo"
        }
      ]
    };
  }

  function loadData() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);

      if (!raw) {
        const seeded = normalizeDataShape(seedData());
        localStorage.setItem(STORAGE_KEY, JSON.stringify(seeded));
        return seeded;
      }

      const parsed = JSON.parse(raw);
      return normalizeDataShape(parsed && parsed.users ? parsed : seedData());
    } catch (error) {
      return normalizeDataShape(seedData());
    }
  }

  function normalizeDataShape(data) {
    if (!data || !Array.isArray(data.trips)) {
      return normalizeDataShape(seedData());
    }

    data.trips.forEach((trip) => {
      trip.routePoints = Array.isArray(trip.routePoints) ? trip.routePoints : [];
      trip.routeViewUrl = trip.routeViewUrl || buildRouteViewerUrl(trip.code);
      trip.syncStatus = trip.syncStatus || (trip.status === "completed" ? "local_only" : "pending");
      trip.syncError = trip.syncError || "";
      trip.syncedAt = trip.syncedAt || "";
    });

    return data;
  }

  function saveData() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.data));
  }

  function getSession() {
    try {
      return JSON.parse(localStorage.getItem(SESSION_KEY) || "null");
    } catch (error) {
      return null;
    }
  }

  function setSession(userId) {
    localStorage.setItem(
      SESSION_KEY,
      JSON.stringify({
        userId: userId.id || userId,
        user: typeof userId === "object" ? buildSessionUser(userId) : null,
        loginAt: new Date().toISOString()
      })
    );
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  function findUserById(userId) {
    return state.data.users.find((user) => user.id === userId) || null;
  }

  function findUserByUsername(username) {
    return state.data.users.find((user) => normalizeValue(user.username) === normalizeValue(username)) || null;
  }

  function findSessionUser(session) {
    if (!session) {
      return null;
    }

    if (session.user && session.user.username) {
      return session.user;
    }

    return findUserById(session.userId);
  }

  function buildSessionUser(user) {
    return {
      id: user.id,
      username: user.username,
      role: user.role,
      fullName: user.fullName,
      phone: user.phone || ""
    };
  }

  function findBranchById(branchId) {
    return state.data.branches.find((branch) => branch.id === branchId) || null;
  }

  function findTripById(tripId) {
    return state.data.trips.find((trip) => trip.id === tripId) || null;
  }

  function normalizeValue(value) {
    return String(value || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function redirectTo(path) {
    window.location.href = path;
  }

  function redirectByRole(role) {
    if (role === "supervisor") {
      redirectTo("supervisor.html");
      return;
    }

    redirectTo("chofer.html");
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function setInlineMessage(element, text, type) {
    if (!element) {
      return;
    }

    element.textContent = text || "";
    element.className = "inline-message";

    if (type) {
      element.classList.add(`is-${type}`);
    }
  }

  function createElement(tag, className, text) {
    const element = document.createElement(tag);

    if (className) {
      element.className = className;
    }

    if (typeof text === "string") {
      element.textContent = text;
    }

    return element;
  }

  function formatDateTime(value) {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("es-PY", {
      dateStyle: "short",
      timeStyle: "short"
    }).format(new Date(value));
  }

  function formatDateOnly(value) {
    if (!value) {
      return "-";
    }

    return new Intl.DateTimeFormat("es-PY", {
      dateStyle: "medium"
    }).format(new Date(value));
  }

  function formatDuration(startedAt, finishedAt) {
    if (!startedAt) {
      return "-";
    }

    const end = finishedAt ? new Date(finishedAt) : new Date();
    const seconds = Math.max(0, Math.round((end - new Date(startedAt)) / 1000));
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.round((seconds % 3600) / 60);

    if (hours) {
      return `${hours}h ${minutes}m`;
    }

    return `${minutes} min`;
  }

  function formatKm(value) {
    return `${Number(value || 0).toFixed(1)} km`;
  }

  function tripKmSummary(trip) {
    if (Number(trip.totalKm || 0) > 0) {
      return formatKm(trip.totalKm);
    }

    return trip.status === "completed" ? "Sin kilometraje registrado" : "Se calcula al finalizar";
  }

  function configValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getAppsScriptUrl() {
    return configValue(config.appsScriptUrl);
  }

  function hasRemoteBackend() {
    return Boolean(getAppsScriptUrl());
  }

  function getRouteViewerBaseUrl() {
    return configValue(config.routeViewerBaseUrl);
  }

  function buildRouteViewerUrl(tripCode) {
    const target = getRouteViewerBaseUrl()
      ? new URL(getRouteViewerBaseUrl(), window.location.href)
      : new URL("ruta.html", window.location.href);

    if (tripCode) {
      target.searchParams.set("trip", tripCode);
    }

    return target.toString();
  }

  function getTripRouteViewerUrl(trip) {
    return buildRouteViewerUrl(trip.code);
  }

  function normalizeRoutePoints(routePoints, tripCode) {
    return (routePoints || []).map((point, index) => ({
      tripCode,
      sequence: index + 1,
      timestamp: point.timestamp || "",
      lat: Number(point.lat || 0),
      lng: Number(point.lng || 0),
      accuracy: Number(point.accuracy || 0),
      speedKmh: Number(point.speedKmh || 0)
    }));
  }

  function buildTripSyncPayload(trip) {
    const driver = findUserById(trip.driverId);
    const branch = findBranchById(trip.originBranchId);
    const supervisor = findUserById(trip.assignedBy);

    return {
      action: "saveTrip",
      trip: {
        id: trip.id,
        code: trip.code,
        numberLabel: trip.numberLabel,
        type: trip.type,
        typeLabel: humanTripType(trip.type),
        destination: trip.destination,
        notes: trip.notes || "",
        originBranchId: trip.originBranchId,
        originBranchName: branch ? branch.name : "",
        originCity: branch ? branch.city : "",
        expectedDeparture: trip.expectedDeparture || "",
        driverId: trip.driverId,
        driverName: driver ? driver.fullName : "",
        driverUsername: driver ? driver.username : "",
        assignedBy: supervisor ? supervisor.username : (trip.assignedBy || ""),
        status: trip.status,
        statusLabel: statusMeta(trip.status).label,
        startedAt: trip.startedAt || "",
        finishedAt: trip.finishedAt || "",
        totalKm: Number(trip.totalKm || 0),
        lastPingAt: trip.lastPingAt || "",
        currentLat: trip.currentLat ?? "",
        currentLng: trip.currentLng ?? "",
        createdAt: trip.createdAt || "",
        updatedAt: trip.updatedAt || "",
        routePointCount: (trip.routePoints || []).length,
        routeViewUrl: getTripRouteViewerUrl(trip)
      },
      routePoints: normalizeRoutePoints(trip.routePoints, trip.code)
    };
  }

  async function syncCompletedTrip(tripId) {
    const trip = findTripById(tripId);
    if (!trip) {
      return;
    }

    trip.routeViewUrl = getTripRouteViewerUrl(trip);

    await syncTripToRemote(tripId, true);
  }

  async function callRemoteBackend(payload) {
    const appsScriptUrl = getAppsScriptUrl();
    if (!appsScriptUrl) {
      throw new Error("No hay Apps Script configurado.");
    }

    const response = await fetch(appsScriptUrl, {
      method: "POST",
      headers: {
        "Content-Type": "text/plain;charset=utf-8"
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    if (!response.ok || data.ok === false) {
      throw new Error(data.error || `HTTP ${response.status}`);
    }

    return data;
  }

  async function hydrateRemoteData() {
    if (!hasRemoteBackend()) {
      return;
    }

    try {
      const appsScriptUrl = new URL(getAppsScriptUrl());
      appsScriptUrl.searchParams.set("action", "dataset");
      const response = await fetch(appsScriptUrl.toString(), { method: "GET" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.ok === false) {
        throw new Error(payload.error || `HTTP ${response.status}`);
      }

      state.data.users = (payload.users || []).map((user) => ({
        id: user.id,
        username: user.username,
        password: "",
        role: user.role,
        fullName: user.fullName,
        phone: user.phone || "",
        active: user.active !== false
      }));

      if (Array.isArray(payload.trips)) {
        state.data.trips = payload.trips.map((trip) => ({
          id: trip.id,
          code: trip.code,
          numberLabel: trip.numberLabel,
          type: trip.type,
          destination: trip.destination,
          notes: trip.notes || "",
          originBranchId: trip.originBranchId,
          expectedDeparture: trip.expectedDeparture || "",
          driverId: trip.driverId,
          assignedBy: trip.assignedBy || "",
          status: trip.status,
          createdAt: trip.createdAt || "",
          updatedAt: trip.updatedAt || "",
          startedAt: trip.startedAt || "",
          finishedAt: trip.finishedAt || "",
          totalKm: Number(trip.totalKm || 0),
          lastPingAt: trip.lastPingAt || "",
          currentLat: typeof trip.currentLat === "number" ? trip.currentLat : null,
          currentLng: typeof trip.currentLng === "number" ? trip.currentLng : null,
          routePoints: Array.isArray(trip.routePoints) ? trip.routePoints : [],
          routeViewUrl: getTripRouteViewerUrl(trip),
          syncStatus: "synced",
          syncError: "",
          syncedAt: trip.syncedAt || ""
        }));
      }

        if (Array.isArray(payload.activityLogs)) {
          state.data.activityLogs = payload.activityLogs;
        }

        if (Array.isArray(payload.origins) && payload.origins.length) {
          state.data.origins = payload.origins;
        }

        if (Array.isArray(payload.destinations) && payload.destinations.length) {
          state.data.destinations = payload.destinations;
        }

        saveData();
    } catch (error) {
      console.warn("No se pudo hidratar el portal desde Google Sheets", error);
    }
  }

  async function syncTripToRemote(tripId, completedSync) {
    const trip = findTripById(tripId);
    if (!trip) {
      return;
    }

    trip.routeViewUrl = getTripRouteViewerUrl(trip);

    if (!hasRemoteBackend()) {
      trip.syncStatus = "local_only";
      trip.syncError = "";
      saveData();
      refreshCurrentPage();
      return;
    }

    trip.syncStatus = "syncing";
    trip.syncError = "";
    saveData();
    refreshCurrentPage();

    try {
      const payload = await callRemoteBackend(buildTripSyncPayload(trip));
      trip.routeViewUrl = payload.routeViewUrl || getTripRouteViewerUrl(trip);
      trip.syncStatus = completedSync ? "synced_completed" : "synced";
      trip.syncError = "";
      trip.syncedAt = new Date().toISOString();
    } catch (error) {
      trip.syncStatus = "sync_error";
      trip.syncError = error instanceof Error ? error.message : String(error);
    }

    saveData();
    refreshCurrentPage();
  }

  async function syncLogToRemote(entry) {
    if (!hasRemoteBackend() || !entry) {
      return;
    }

    try {
      await callRemoteBackend({
        action: "appendLog",
        entry: entry
      });
    } catch (error) {
      console.warn("No se pudo registrar la bitacora remota", error);
    }
  }

  function refreshCurrentPage() {
    if (page === "chofer") {
      renderDriverTrips();
    }

    if (page === "supervisor") {
      renderSupervisorOverview();
      renderPendingTrips();
      renderActiveTrips();
      renderHistoryTrips();
    }
  }

  function statusMeta(status) {
    const map = {
      assigned: { label: "Pendiente", className: "status-badge status-badge--pending" },
      in_route: { label: "En ruta", className: "status-badge status-badge--progress" },
      completed: { label: "Completado", className: "status-badge status-badge--success" },
      edited: { label: "Reprogramado", className: "status-badge status-badge--warm" }
    };

    return map[status] || { label: status, className: "status-badge" };
  }

  function humanTripType(type) {
    return type === "transferencia" ? "Transferencia" : "Reparto";
  }

  function branchName(branchId) {
    const branch = findBranchById(branchId);
    return branch ? branch.name : (branchId || "-");
  }

  function driverName(driverId) {
    const driver = findUserById(driverId);
    return driver ? driver.fullName : "-";
  }

  function logActivity(type, tripId, detail) {
    state.data.sequence.log += 1;
    const entry = {
      id: `log-${state.data.sequence.log}`,
      type,
      userId: state.currentUser ? state.currentUser.id : null,
      tripId,
      createdAt: new Date().toISOString(),
      detail
    };
    state.data.activityLogs.unshift(entry);
    const trip = tripId ? findTripById(tripId) : null;
    syncLogToRemote({
      id: entry.id,
      userId: entry.userId,
      username: state.currentUser ? state.currentUser.username : "",
      fullName: state.currentUser ? state.currentUser.fullName : "",
      action: type,
      tripId: trip ? trip.code : entry.tripId,
      createdAt: entry.createdAt,
      detail: entry.detail
    });
  }

  function bindShellNavigation() {
    const links = document.querySelectorAll(".nav-link");
    const mobileToggle = document.getElementById(
      page === "supervisor" ? "mobileMenuToggleSupervisor" : "mobileMenuToggleDriver"
    );
    const mobileNav = document.getElementById(
      page === "supervisor" ? "supervisorNav" : "driverNav"
    );

    if (mobileToggle && mobileNav) {
      mobileToggle.addEventListener("click", () => {
        const isOpen = mobileNav.classList.toggle("is-open");
        mobileToggle.classList.toggle("is-open", isOpen);
        mobileToggle.setAttribute("aria-expanded", String(isOpen));
      });
    }

    links.forEach((link) => {
      link.addEventListener("click", () => {
        activateSection(link.dataset.target);

        if (mobileToggle && mobileNav && window.innerWidth <= 640) {
          mobileNav.classList.remove("is-open");
          mobileToggle.classList.remove("is-open");
          mobileToggle.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  function activateSection(sectionId) {
    document.querySelectorAll(".view-section").forEach((section) => {
      section.classList.toggle("is-active", section.id === sectionId);
    });

    document.querySelectorAll(".nav-link").forEach((link) => {
      link.classList.toggle("is-active", link.dataset.target === sectionId);
    });
  }

  function bindGlobalNotice() {
    const close = document.getElementById("globalNoticeClose");
    if (close) {
      close.addEventListener("click", hideNotice);
    }
  }

  function showNotice(title, text) {
    const notice = document.getElementById("globalNotice");
    if (!notice) {
      return;
    }

    setText("globalNoticeTitle", title);
    setText("globalNoticeText", text);
    notice.hidden = false;

    if (state.noticeTimer) {
      window.clearTimeout(state.noticeTimer);
    }

    state.noticeTimer = window.setTimeout(() => {
      hideNotice();
    }, 6500);
  }

  function hideNotice() {
    const notice = document.getElementById("globalNotice");
    if (notice) {
      notice.hidden = true;
    }

    if (state.noticeTimer) {
      window.clearTimeout(state.noticeTimer);
      state.noticeTimer = null;
    }
  }

  function initLoginPage() {
    const form = document.getElementById("loginForm");
    const usernameInput = document.getElementById("loginUsername");
    const passwordInput = document.getElementById("loginPassword");
    const message = document.getElementById("loginMessage");

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      const username = normalizeValue(usernameInput.value);
      const password = passwordInput.value;
      let user = null;

      if (hasRemoteBackend()) {
        try {
          const payload = await callRemoteBackend({
            action: "login",
            username: usernameInput.value.trim(),
            password
          });
          user = payload.user || null;
        } catch (error) {
          setInlineMessage(message, error instanceof Error ? error.message : "No se pudo validar el usuario.", "error");
          return;
        }
      } else {
        user = state.data.users.find(
          (item) =>
            normalizeValue(item.username) === username &&
            item.password === password &&
            item.active
        ) || null;
      }

      if (!user) {
        setInlineMessage(message, "Usuario o contrasena incorrectos.", "error");
        return;
      }

      setSession(user);
      setInlineMessage(message, "Acceso correcto. Redirigiendo...", "success");
      redirectByRole(user.role);
    });
  }

  function initSupervisorPage() {
    setText("supervisorSidebarName", state.currentUser.fullName);
    setText("supervisorTopbarName", state.currentUser.fullName);

    document.getElementById("logoutSupervisor").addEventListener("click", handleLogout);
    document.getElementById("assignTripForm").addEventListener("submit", handleAssignTripSubmit);
    document.getElementById("cancelTripEdit").addEventListener("click", resetAssignForm);
    document.getElementById("pendingTripSearch").addEventListener("input", renderPendingTrips);
    document.getElementById("historyTripSearch").addEventListener("input", renderHistoryTrips);
    document.getElementById("exportTripsCsv").addEventListener("click", exportTripsCsv);

      bindSupervisorDashboardActions();
      populateDriverSelect();
      populateBranchSelect();
      populateDestinationSelect();
      resetAssignForm();
    renderSupervisorOverview();
    renderPendingTrips();
    renderActiveTrips();
    renderHistoryTrips();
  }

  function initDriverPage() {
    setText("driverSidebarName", state.currentUser.fullName);
    setText("driverTopbarName", state.currentUser.fullName);
    document.getElementById("logoutDriver").addEventListener("click", handleLogout);
    restoreDriverTracking();
    renderDriverTrips();
  }

  function handleExternalRefresh(event) {
    if (event.key !== STORAGE_KEY) {
      return;
    }

    state.data = loadData();

    if (page === "supervisor") {
      renderSupervisorOverview();
      renderPendingTrips();
      renderActiveTrips();
      renderHistoryTrips();
    }

    if (page === "chofer") {
      restoreDriverTracking();
      renderDriverTrips();
    }
  }

  function handleLogout() {
    stopDriverTracking(false);
    clearSession();
    redirectTo("index.html");
  }

  function populateDriverSelect() {
    const select = document.getElementById("tripDriver");
    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Selecciona un chofer</option>';
    state.data.users
      .filter((user) => user.role === "chofer" && user.active)
      .forEach((user) => {
        const option = document.createElement("option");
        option.value = user.id;
        option.textContent = user.fullName;
        select.appendChild(option);
      });
  }

  function populateBranchSelect() {
    const select = document.getElementById("tripOrigin");
    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Selecciona origen</option>';
    const origins = Array.isArray(state.data.origins) && state.data.origins.length
      ? state.data.origins
      : state.data.branches.map((branch) => branch.name);

    origins.forEach((origin) => {
      const option = document.createElement("option");
      option.value = origin;
      option.textContent = origin;
      select.appendChild(option);
    });
  }

  function populateDestinationSelect() {
    const select = document.getElementById("tripDestination");
    if (!select) {
      return;
    }

    select.innerHTML = '<option value="">Selecciona destino</option>';
    state.data.destinations.forEach((destination) => {
      const option = document.createElement("option");
      option.value = destination;
      option.textContent = destination;
      select.appendChild(option);
    });
  }

  function resetAssignForm() {
    const form = document.getElementById("assignTripForm");
    const badge = document.getElementById("assignModeBadge");

    state.editingTripId = null;
    form.reset();
    document.getElementById("assignTripId").value = "";
    document.getElementById("cancelTripEdit").hidden = true;
    badge.textContent = "Nuevo";
    setInlineMessage(document.getElementById("assignTripMessage"), "");
  }

  function handleAssignTripSubmit(event) {
    event.preventDefault();

    const message = document.getElementById("assignTripMessage");
    const type = document.getElementById("tripType").value;
    const driverId = document.getElementById("tripDriver").value;
    const originBranchId = document.getElementById("tripOrigin").value;
    const destination = document.getElementById("tripDestination").value.trim();
    const expectedDeparture = document.getElementById("tripDeparture").value;
    const notes = document.getElementById("tripNotes").value.trim();

    if (!type || !driverId || !originBranchId || !destination || !expectedDeparture) {
      setInlineMessage(message, "Completa los datos obligatorios del viaje.", "error");
      return;
    }

    const now = new Date().toISOString();

    if (state.editingTripId) {
      const trip = findTripById(state.editingTripId);
      if (!trip) {
        setInlineMessage(message, "No se encontro el viaje a modificar.", "error");
        return;
      }

      trip.type = type;
      trip.driverId = driverId;
      trip.originBranchId = originBranchId;
        trip.destination = destination;
        trip.expectedDeparture = expectedDeparture;
        trip.notes = notes;
        trip.updatedAt = now;
        trip.routeViewUrl = getTripRouteViewerUrl(trip);
        if (trip.status === "assigned") {
          trip.status = "edited";
        }

        logActivity("edit_trip", trip.id, `Actualizo ${trip.code}`);
        saveData();
        syncTripToRemote(trip.id, false);
        setInlineMessage(message, "Viaje actualizado correctamente.", "success");
        showNotice("Viaje actualizado", `Se ajustaron los datos del viaje ${trip.code}.`);
      } else {
      state.data.sequence.trip += 1;
      const tripNumber = state.data.sequence.trip;
      const dayStamp = now.slice(0, 10).replace(/-/g, "");
        const trip = {
          id: `trip-${tripNumber}`,
          code: `VIA-${dayStamp}-${tripNumber}`,
          numberLabel: `Viaje Nro ${tripNumber - 200}`,
        type,
        destination,
        notes,
        originBranchId,
        expectedDeparture,
        driverId,
        assignedBy: state.currentUser.id,
        status: "assigned",
        createdAt: now,
        updatedAt: now,
        startedAt: null,
          finishedAt: null,
          totalKm: 0,
          lastPingAt: null,
          currentLat: null,
          currentLng: null,
          routePoints: [],
          routeViewUrl: buildRouteViewerUrl(`VIA-${dayStamp}-${tripNumber}`),
          syncStatus: "pending",
          syncError: "",
          syncedAt: ""
        };

        state.data.trips.unshift(trip);
        logActivity("assign_trip", trip.id, `Asigno ${trip.code} a ${driverName(driverId)}`);
        saveData();
        syncTripToRemote(trip.id, false);
        setInlineMessage(message, "Viaje asignado correctamente.", "success");
        showNotice("Viaje asignado", `El viaje ${trip.code} ya aparece en la lista del chofer.`);
      }

    resetAssignForm();
    renderSupervisorOverview();
    renderPendingTrips();
    renderActiveTrips();
    renderHistoryTrips();
  }

  function getSupervisorTrips() {
    return state.data.trips.slice().sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
  }

  function renderSupervisorOverview() {
    const trips = getSupervisorTrips();
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    const weekAgo = new Date(now);
    weekAgo.setDate(weekAgo.getDate() - 7);

    const onRoute = trips.filter((trip) => trip.status === "in_route");
    const pending = trips.filter((trip) => trip.status === "assigned" || trip.status === "edited");
    const completedToday = trips.filter((trip) => trip.status === "completed" && (trip.finishedAt || "").slice(0, 10) === today);
    const kmWeek = trips
      .filter((trip) => trip.status === "completed" && trip.finishedAt && new Date(trip.finishedAt) >= weekAgo)
      .reduce((sum, trip) => sum + Number(trip.totalKm || 0), 0);

    setText("statDriversOnRoute", String(onRoute.length));
    setText("statPendingTrips", String(pending.length));
    setText("statCompletedToday", String(completedToday.length));
    setText("statKmWeek", formatKm(kmWeek));

    const liveContainer = document.getElementById("overviewLiveRoutes");
    liveContainer.innerHTML = "";

    if (!onRoute.length) {
      liveContainer.appendChild(emptyRow("No hay choferes en ruta en este momento."));
    } else {
      onRoute.forEach((trip) => {
        const row = createElement("button", "summary-row summary-row--action");
        row.type = "button";
        row.addEventListener("click", () => {
          activateSection("supActive");
        });

        const top = createElement("div", "summary-row__top");
        const content = createElement("div");
        content.append(
          createElement("h5", "", `${trip.code} - ${driverName(trip.driverId)}`),
          createElement("p", "", `${branchName(trip.originBranchId)} -> ${trip.destination}`),
          createElement("p", "", `Ultimo ping: ${formatDateTime(trip.lastPingAt)} - ${formatKm(trip.totalKm)}`)
        );
        top.append(content, badgeElement(trip.status));
        row.append(top);
        liveContainer.appendChild(row);
      });
    }

    const pendingContainer = document.getElementById("overviewPendingTrips");
    pendingContainer.innerHTML = "";

    if (!pending.length) {
      pendingContainer.appendChild(emptyRow("No hay viajes pendientes por salir."));
    } else {
      pending.slice(0, 5).forEach((trip) => {
        const row = createElement("button", "summary-row summary-row--action");
        row.type = "button";
        row.addEventListener("click", () => activateSection("supPending"));

        const top = createElement("div", "summary-row__top");
        const content = createElement("div");
        content.append(
          createElement("h5", "", trip.code),
          createElement("p", "", `${driverName(trip.driverId)} - ${trip.destination}`),
          createElement("p", "", `Salida esperada: ${formatDateTime(trip.expectedDeparture)}`)
        );
        top.append(content, badgeElement(trip.status));
        row.append(top);
        pendingContainer.appendChild(row);
      });
    }
  }

  function bindSupervisorDashboardActions() {
    const dayCard = document.getElementById("cardCompletedToday");
    const pendingCard = document.getElementById("cardPendingTrips");
    const liveCard = document.getElementById("cardDriversOnRoute");
    const kmCard = document.getElementById("cardKmWeek");

    dayCard.addEventListener("click", () => activateSection("supHistory"));
    pendingCard.addEventListener("click", () => activateSection("supPending"));
    liveCard.addEventListener("click", () => activateSection("supActive"));
    kmCard.addEventListener("click", () => activateSection("supHistory"));
    document.getElementById("overviewLiveRoutesCard").addEventListener("click", () => activateSection("supActive"));
    document.getElementById("overviewPendingRequestsCard").addEventListener("click", () => activateSection("supPending"));
  }

  function renderPendingTrips() {
    const search = normalizeValue(document.getElementById("pendingTripSearch").value);
    const container = document.getElementById("pendingTripList");
    container.innerHTML = "";

    const trips = getSupervisorTrips()
      .filter((trip) => trip.status === "assigned" || trip.status === "edited")
      .filter((trip) => {
        if (!search) {
          return true;
        }

        return [trip.code, trip.destination, driverName(trip.driverId), branchName(trip.originBranchId)]
          .some((value) => normalizeValue(value).includes(search));
      });

    if (!trips.length) {
      container.appendChild(emptyTripCard("No hay viajes pendientes con ese filtro."));
      return;
    }

    trips.forEach((trip) => {
      container.appendChild(buildTripCard(trip, "pending"));
    });
  }

  function renderActiveTrips() {
    const container = document.getElementById("activeTripList");
    container.innerHTML = "";

    const trips = getSupervisorTrips().filter((trip) => trip.status === "in_route");

    if (!trips.length) {
      container.appendChild(emptyTripCard("No hay choferes activos en ruta."));
      return;
    }

    trips.forEach((trip) => {
      container.appendChild(buildTripCard(trip, "active"));
    });
  }

  function renderHistoryTrips() {
    const search = normalizeValue(document.getElementById("historyTripSearch").value);
    const container = document.getElementById("historyTripList");
    container.innerHTML = "";

    const trips = getSupervisorTrips()
      .filter((trip) => trip.status === "completed")
      .filter((trip) => {
        if (!search) {
          return true;
        }

        return [trip.code, trip.destination, driverName(trip.driverId), branchName(trip.originBranchId)]
          .some((value) => normalizeValue(value).includes(search));
      });

    if (!trips.length) {
      container.appendChild(emptyTripCard("No hay viajes finalizados para mostrar."));
      return;
    }

    trips.forEach((trip) => {
      container.appendChild(buildTripCard(trip, "history"));
    });
  }

  function buildTripCard(trip, mode) {
    const card = createElement("article", "trip-card");
    const top = createElement("div", "trip-card__top");
    const content = createElement("div");
    content.append(
      createElement("h4", "", `${trip.numberLabel} - ${trip.code}`),
      createElement("p", "", `${humanTripType(trip.type)} - ${branchName(trip.originBranchId)} -> ${trip.destination}`),
      createElement("p", "", `Chofer: ${driverName(trip.driverId)} - Salida esperada: ${formatDateTime(trip.expectedDeparture)}`)
    );
    top.append(content, badgeElement(trip.status));

    const meta = createElement("div", "trip-card__meta");
    meta.append(
      createMetaItem("Observaciones", trip.notes || "Sin observaciones"),
      createMetaItem("Kilometraje", tripKmSummary(trip)),
      createMetaItem("Inicio", formatDateTime(trip.startedAt)),
      createMetaItem("Fin", formatDateTime(trip.finishedAt))
    );

    const actions = createElement("div", "route-actions");

    if (mode === "pending") {
      const editButton = createElement("button", "button button-secondary", "Modificar");
      editButton.type = "button";
      editButton.addEventListener("click", () => openTripForEdit(trip.id));
      actions.append(editButton);
    }

    if (mode === "active" || mode === "history") {
      card.append(buildRouteSummarySection(trip));
    }

    if (mode === "history" && trip.status === "completed") {
      const routeButton = createRouteViewerLink(trip, "Ver ruta");
      actions.append(routeButton);
    }

    if (trip.currentLat && trip.currentLng) {
      const mapButton = createElement("a", "button button-secondary", "Abrir ubicacion");
      mapButton.href = googleMapsPointLink(trip.currentLat, trip.currentLng);
      mapButton.target = "_blank";
      mapButton.rel = "noopener noreferrer";
      actions.append(mapButton);
    }

    if (trip.routePoints && trip.routePoints.length > 1) {
      const exportButton = createElement("button", "button button-primary", "Descargar ruta");
      exportButton.type = "button";
      exportButton.addEventListener("click", () => downloadTripRoute(trip.id));
      actions.append(exportButton);
    }

    if (actions.children.length) {
      card.append(actions);
    }

    card.prepend(meta);
    card.prepend(top);
    return card;
  }

  function buildRouteSummarySection(trip) {
    const section = createElement("div", "trip-card__route");
    const heading = createElement("div", "trip-card__route-heading");
    heading.append(
      createElement("strong", "", "Resumen de ruta"),
      createElement("p", "", "Abre el visor para revisar el recorrido exacto sobre Google Maps.")
    );
    section.append(heading);

    const stats = createElement("div", "route-stats");
    stats.append(
      createRouteStat("Puntos", String((trip.routePoints || []).length)),
      createRouteStat("Ultimo ping", formatShortPing(trip.lastPingAt)),
      createRouteStat("Tiempo", formatDuration(trip.startedAt, trip.finishedAt))
    );

    section.append(stats);
    return section;
  }

  function createRouteViewerLink(trip, label) {
    const link = createElement("a", "button button-secondary", label || "Ver ruta");
    link.href = getTripRouteViewerUrl(trip);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    return link;
  }

  function createRouteStat(label, value) {
    const stat = createElement("div", "route-stat");
    stat.append(createElement("span", "", label), createElement("strong", "", value));
    return stat;
  }

  function createMetaItem(label, value) {
    const item = createElement("div", "trip-card__meta-item");
    item.append(createElement("span", "", label), createElement("strong", "", value));
    return item;
  }

  function openTripForEdit(tripId) {
    const trip = findTripById(tripId);
    if (!trip) {
      return;
    }

    state.editingTripId = tripId;
    document.getElementById("assignTripId").value = trip.id;
    document.getElementById("tripType").value = trip.type;
    document.getElementById("tripDriver").value = trip.driverId;
    document.getElementById("tripOrigin").value = trip.originBranchId;
    document.getElementById("tripDestination").value = trip.destination;
    document.getElementById("tripDeparture").value = trip.expectedDeparture;
    document.getElementById("tripNotes").value = trip.notes || "";
    document.getElementById("cancelTripEdit").hidden = false;
    document.getElementById("assignModeBadge").textContent = "Edicion";
    setInlineMessage(document.getElementById("assignTripMessage"), "");
    activateSection("supAssign");
  }

  function renderDriverTrips() {
    const container = document.getElementById("driverTripList");
    container.innerHTML = "";

    const trips = state.data.trips
      .filter((trip) => trip.driverId === state.currentUser.id)
      .sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));

    if (!trips.length) {
      container.appendChild(emptyTripCard("No tenes rutas asignadas por ahora."));
      return;
    }

    trips.forEach((trip) => {
      const card = createElement("article", "trip-card");
      const top = createElement("div", "trip-card__top");
      const content = createElement("div");
      content.append(
        createElement("h4", "", `${trip.numberLabel}`),
        createElement("p", "", `Destino: ${trip.destination}`),
        createElement("p", "", `Obs: ${trip.notes || "Sin observaciones"}`),
        createElement("p", "", `Fecha de salida esperada: ${formatDateTime(trip.expectedDeparture)}`),
        createElement("p", "", `Origen: ${branchName(trip.originBranchId)}`)
      );
      top.append(content, badgeElement(trip.status));

      const meta = createElement("div", "trip-card__meta");
      meta.append(
        createMetaItem("Tipo", humanTripType(trip.type)),
        createMetaItem("Kilometraje", tripKmSummary(trip)),
        createMetaItem("Inicio", formatDateTime(trip.startedAt)),
        createMetaItem("Ultimo ping", formatDateTime(trip.lastPingAt))
      );

      const actions = createElement("div", "route-actions");

      if (trip.status === "assigned" || trip.status === "edited") {
        const startButton = createElement("button", "button button-primary", "Iniciar viaje");
        startButton.type = "button";
        startButton.addEventListener("click", () => startDriverTrip(trip.id));
        actions.append(startButton);
      }

        if (trip.status === "in_route") {
          const pingButton = createElement("button", "button button-secondary", "Actualizar ubicacion");
          pingButton.type = "button";
          pingButton.addEventListener("click", () => requestSinglePosition(trip.id, false));

          const finishButton = createElement("button", "button button-primary", "Finalizar viaje");
          finishButton.type = "button";
          finishButton.addEventListener("click", () => finishDriverTrip(trip.id));

          actions.append(pingButton, finishButton);
          card.append(buildRouteSummarySection(trip));
        }

        if (trip.status === "completed") {
          card.append(buildRouteSummarySection(trip));
          actions.append(createRouteViewerLink(trip, "Ver ruta"));

          if (trip.routePoints.length > 1) {
            const exportButton = createElement("button", "button button-secondary", "Descargar ruta");
          exportButton.type = "button";
          exportButton.addEventListener("click", () => downloadTripRoute(trip.id));
          actions.append(exportButton);
        }
      }

      if (actions.children.length) {
        card.append(actions);
      }

      card.append(top, meta);
      container.appendChild(card);
    });
  }

  function startDriverTrip(tripId) {
    const trip = findTripById(tripId);

    if (!trip) {
      return;
    }

    if (!window.confirm(`Estas seguro de iniciar ${trip.code}? Se comenzara a registrar tu ubicacion.`)) {
      return;
    }

    const now = new Date().toISOString();
    trip.status = "in_route";
    trip.startedAt = now;
    trip.updatedAt = now;
    trip.lastPingAt = now;
    trip.routePoints = trip.routePoints || [];
      saveData();
      logActivity("start_trip", trip.id, `Inicio ${trip.code}`);
      showNotice("Viaje iniciado", `El viaje ${trip.code} comenzo a registrar la ruta.`);
      beginDriverTracking(trip.id);
      requestSinglePosition(trip.id, false, true);
      renderDriverTrips();
    }

  function finishDriverTrip(tripId) {
    const trip = findTripById(tripId);

    if (!trip) {
      return;
    }

    if (!window.confirm(`Vas a finalizar ${trip.code}. Deseas cerrar el viaje ahora?`)) {
      return;
    }

      requestSinglePosition(tripId, true, true);
    }

  function beginDriverTracking(tripId) {
    stopDriverTracking(false);
    state.driverActiveTripId = tripId;

    if (!("geolocation" in navigator)) {
      showNotice("Ubicacion no disponible", "Este dispositivo no permite geolocalizacion en el navegador.");
      return;
    }

      state.driverWatchId = navigator.geolocation.watchPosition(
        (position) => {
          persistPosition(tripId, position, false, false);
        },
      () => {
        showNotice("No se pudo leer ubicacion", "El viaje sigue activo, pero necesitamos permiso de ubicacion para registrar kilometraje.");
      },
      {
        enableHighAccuracy: true,
        maximumAge: 10000,
        timeout: 15000
      }
    );
  }

  function stopDriverTracking(clearTrip) {
    if (state.driverWatchId !== null && "geolocation" in navigator) {
      navigator.geolocation.clearWatch(state.driverWatchId);
    }

    state.driverWatchId = null;

    if (clearTrip) {
      state.driverActiveTripId = null;
    }
  }

  function restoreDriverTracking() {
    const activeTrip = state.data.trips.find(
      (trip) => trip.driverId === state.currentUser.id && trip.status === "in_route"
    );

    if (!activeTrip) {
      stopDriverTracking(true);
      return;
    }

    if (state.driverActiveTripId !== activeTrip.id || state.driverWatchId === null) {
      beginDriverTracking(activeTrip.id);
    }
  }

  function requestSinglePosition(tripId, finishAfter, forceSave) {
    if (!("geolocation" in navigator)) {
      if (finishAfter) {
        finalizeTripWithoutNewPoint(tripId);
      }
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
          persistPosition(tripId, position, Boolean(finishAfter), Boolean(forceSave));
      },
      () => {
        if (finishAfter) {
          finalizeTripWithoutNewPoint(tripId);
        } else {
          showNotice("Ubicacion no actualizada", "No pudimos leer tu ubicacion en este intento.");
        }
      },
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 5000
      }
    );
  }

  function persistPosition(tripId, position, finishAfter, forceSave) {
      const trip = findTripById(tripId);
      if (!trip) {
        return;
      }

    const coords = position.coords;
    const timestamp = new Date(position.timestamp || Date.now()).toISOString();
      const point = {
        lat: Number(coords.latitude.toFixed(6)),
        lng: Number(coords.longitude.toFixed(6)),
        accuracy: Math.round(coords.accuracy || 0),
        speedKmh: coords.speed ? Number((coords.speed * 3.6).toFixed(1)) : 0,
        timestamp
      };

      const previous = trip.routePoints[trip.routePoints.length - 1];
      trip.currentLat = point.lat;
      trip.currentLng = point.lng;
      trip.lastPingAt = timestamp;
      trip.updatedAt = timestamp;

      const shouldStorePoint =
        !previous ||
        Boolean(forceSave) ||
        Boolean(finishAfter) ||
        new Date(timestamp).getTime() - new Date(previous.timestamp || 0).getTime() >= TRACK_POINT_INTERVAL_MS;

      if (shouldStorePoint) {
        if (previous) {
          trip.totalKm = Number((trip.totalKm + haversineKm(previous, point)).toFixed(2));
        }

        trip.routePoints.push(point);
      }

      saveData();
      syncTripToRemote(trip.id, false);

      if (finishAfter) {
        finalizeTripWithoutNewPoint(tripId);
      return;
    }

    if (page === "chofer") {
      renderDriverTrips();
    }

    if (page === "supervisor") {
      renderSupervisorOverview();
      renderActiveTrips();
      renderHistoryTrips();
    }
  }

  function finalizeTripWithoutNewPoint(tripId) {
    const trip = findTripById(tripId);
    if (!trip) {
      return;
    }

    const now = new Date().toISOString();
    trip.status = "completed";
    trip.finishedAt = now;
    trip.updatedAt = now;
    trip.lastPingAt = trip.lastPingAt || now;
    trip.routeViewUrl = getTripRouteViewerUrl(trip);
    saveData();
    logActivity("finish_trip", trip.id, `Finalizo ${trip.code}`);
    stopDriverTracking(true);
    showNotice("Viaje finalizado", `El viaje ${trip.code} se cerro con ${formatKm(trip.totalKm)} recorridos.`);
    syncCompletedTrip(trip.id);

    if (page === "chofer") {
      renderDriverTrips();
    }

    if (page === "supervisor") {
      renderSupervisorOverview();
      renderPendingTrips();
      renderActiveTrips();
      renderHistoryTrips();
    }
  }

  function haversineKm(a, b) {
    const toRad = (value) => (value * Math.PI) / 180;
    const earthRadiusKm = 6371;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);

    const hav =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.sin(dLng / 2) * Math.sin(dLng / 2) * Math.cos(lat1) * Math.cos(lat2);
    const arc = 2 * Math.atan2(Math.sqrt(hav), Math.sqrt(1 - hav));
    return earthRadiusKm * arc;
  }

  function emptyRow(text) {
    const row = createElement("div", "summary-row");
    row.appendChild(createElement("p", "", text));
    return row;
  }

  function emptyTripCard(text) {
    const card = createElement("article", "trip-card");
    card.appendChild(createElement("p", "", text));
    return card;
  }

  function badgeElement(status) {
    const meta = statusMeta(status);
    return createElement("span", meta.className, meta.label);
  }

  function formatShortPing(value) {
    if (!value) {
      return "Sin ping";
    }

    const date = new Date(value);
    return new Intl.DateTimeFormat("es-PY", {
      hour: "2-digit",
      minute: "2-digit"
    }).format(date);
  }

  function googleMapsPointLink(lat, lng) {
    return `https://www.google.com/maps?q=${lat},${lng}`;
  }

  function tripToGeoJson(trip) {
    return {
      type: "FeatureCollection",
      features: [
        {
          type: "Feature",
            properties: {
              code: trip.code,
              destino: trip.destination,
              origen: branchName(trip.originBranchId),
              chofer: driverName(trip.driverId),
              url_ruta: getTripRouteViewerUrl(trip),
              kilometros: trip.totalKm,
              salida_esperada: trip.expectedDeparture,
              inicio: trip.startedAt,
            fin: trip.finishedAt,
            observaciones: trip.notes || ""
          },
          geometry: {
            type: "LineString",
            coordinates: trip.routePoints.map((point) => [point.lng, point.lat])
          }
        }
      ]
    };
  }

  function downloadTripRoute(tripId) {
    const trip = findTripById(tripId);
    if (!trip || !trip.routePoints.length) {
      showNotice("Ruta vacia", "Todavia no hay puntos suficientes para exportar la ruta.");
      return;
    }

    const geoJson = JSON.stringify(tripToGeoJson(trip), null, 2);
    downloadTextFile(`${trip.code}-ruta.geojson`, geoJson, "application/geo+json");
  }

  function exportTripsCsv() {
    const rows = [
      [
        "Codigo",
        "Chofer",
        "Tipo",
        "Origen",
        "Destino",
        "Salida_esperada",
        "Inicio",
        "Fin",
        "Estado",
        "Kilometros",
        "Ultimo_ping",
        "Observaciones",
        "URL_ruta",
        "Estado_sync",
        "Ultima_sync"
      ]
    ];

    getSupervisorTrips().forEach((trip) => {
      rows.push([
        trip.code,
        driverName(trip.driverId),
        humanTripType(trip.type),
        branchName(trip.originBranchId),
        trip.destination,
        formatDateTime(trip.expectedDeparture),
        formatDateTime(trip.startedAt),
        formatDateTime(trip.finishedAt),
          statusMeta(trip.status).label,
          Number(trip.totalKm || 0).toFixed(2),
          formatDateTime(trip.lastPingAt),
          trip.notes || "",
          getTripRouteViewerUrl(trip),
          trip.syncStatus || "",
          formatDateTime(trip.syncedAt)
        ]);
      });

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(","))
      .join("\n");

    downloadTextFile("viajes_kilometraje_demo.csv", csv, "text/csv;charset=utf-8");
  }

  function downloadTextFile(fileName, content, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = fileName;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  }
})();
