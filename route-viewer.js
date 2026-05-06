(function () {
  const STORAGE_KEY = "oa_mileage_portal_data";
  const config = window.OA_MILEAGE_CONFIG || {};
  let googleMapsPromise = null;

  document.addEventListener("DOMContentLoaded", init);

  async function init() {
    const tripCode = new URLSearchParams(window.location.search).get("trip");

    if (!tripCode) {
      showError("No recibimos el codigo del viaje en el enlace.");
      return;
    }

    try {
      const trip = await loadTripData(tripCode);

      if (!trip) {
        showError("No encontramos datos para ese viaje. Si el enlace viene desde la hoja, revisa que la sincronizacion ya se haya hecho.");
        return;
      }

      renderTrip(normalizeTrip(trip));
    } catch (error) {
      showError(error instanceof Error ? error.message : String(error));
    }
  }

  function configValue(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  function getAppsScriptUrl() {
    return configValue(config.appsScriptUrl);
  }

  function getGoogleMapsApiKey() {
    return configValue(config.googleMapsApiKey);
  }

  async function loadTripData(tripCode) {
    const remoteTrip = await loadRemoteTripData(tripCode);
    if (remoteTrip) {
      return remoteTrip;
    }

    return loadLocalTripData(tripCode);
  }

  async function loadRemoteTripData(tripCode) {
    const appsScriptUrl = getAppsScriptUrl();
    if (!appsScriptUrl) {
      return null;
    }

    try {
      const url = new URL(appsScriptUrl);
      url.searchParams.set("action", "trip");
      url.searchParams.set("code", tripCode);

      const response = await fetch(url.toString(), { method: "GET" });
      const payload = await response.json().catch(() => ({}));

      if (!response.ok || payload.ok === false || !payload.trip) {
        return null;
      }

      return payload.trip;
    } catch (error) {
      return null;
    }
  }

  function loadLocalTripData(tripCode) {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) {
        return null;
      }

      const data = JSON.parse(raw);
      return (data.trips || []).find((trip) => trip.code === tripCode) || null;
    } catch (error) {
      return null;
    }
  }

  function normalizeTrip(trip) {
    const routePoints = Array.isArray(trip.routePoints)
      ? trip.routePoints
      : Array.isArray(trip.points)
        ? trip.points
        : [];

    return {
      code: trip.code || "Sin codigo",
      numberLabel: trip.numberLabel || "Ruta registrada",
      type: trip.typeLabel || trip.type || "-",
      destination: trip.destination || "-",
      notes: trip.notes || "",
      originBranchName: trip.originBranchName || trip.originBranch || trip.origin || "-",
      expectedDeparture: trip.expectedDeparture || "",
      driverName: trip.driverName || trip.driver || trip.chofer || "-",
      driverUsername: trip.driverUsername || trip.usuario_chofer || "",
      status: trip.status || "completed",
      statusLabel: trip.statusLabel || humanStatus(trip.status),
      startedAt: trip.startedAt || trip.inicio_real || "",
      finishedAt: trip.finishedAt || trip.fin_real || "",
      totalKm: Number(trip.totalKm || trip.kilometros_recorridos || 0),
      lastPingAt: trip.lastPingAt || trip.ultimo_ping || "",
      routeViewUrl: trip.routeViewUrl || "",
      routePoints: routePoints.map((point, index) => ({
        sequence: Number(point.sequence || index + 1),
        lat: Number(point.lat || point.latitud || 0),
        lng: Number(point.lng || point.longitud || 0),
        timestamp: point.timestamp || "",
        accuracy: Number(point.accuracy || point.precision_metros || 0),
        speedKmh: Number(point.speedKmh || point.velocidad_kmh || 0)
      }))
    };
  }

  function renderTrip(trip) {
    document.getElementById("routeLoading").hidden = true;
    document.getElementById("routeError").hidden = true;
    document.getElementById("routeContent").hidden = false;

    setText("routeViewTitle", `Ruta ${trip.code}`);
    setText("routeViewSubtitle", `${trip.originBranchName} -> ${trip.destination}`);
    setText("routeSummaryCode", `${trip.numberLabel} - ${trip.code}`);

    const statusNode = document.getElementById("routeSummaryStatus");
    statusNode.textContent = trip.statusLabel;
    statusNode.className = `status-badge ${statusClass(trip.status)}`.trim();

    renderSummaryGrid(trip);
    renderRouteActions(trip);
    renderMap(trip.routePoints);
  }

  function renderSummaryGrid(trip) {
    const grid = document.getElementById("routeSummaryGrid");
    grid.innerHTML = "";

    const items = [
      ["Chofer", trip.driverName],
      ["Usuario", trip.driverUsername || "Sin usuario visible"],
      ["Origen", trip.originBranchName],
      ["Destino", trip.destination],
      ["Salida esperada", formatDateTime(trip.expectedDeparture)],
      ["Inicio real", formatDateTime(trip.startedAt)],
      ["Fin real", formatDateTime(trip.finishedAt)],
      ["Kilometraje real", formatKm(trip.totalKm)],
      ["Ultimo ping", formatDateTime(trip.lastPingAt)],
      ["Tipo de viaje", humanTripType(trip.type)],
      ["Observaciones", trip.notes || "Sin observaciones"]
    ];

    items.forEach(([label, value]) => {
      const item = document.createElement("div");
      item.className = "route-summary-item";
      item.append(createTextNode("span", label), createTextNode("strong", value));
      grid.appendChild(item);
    });
  }

  function renderRouteActions(trip) {
    const button = document.getElementById("routeViewExternalMap");
    const lastPoint = trip.routePoints[trip.routePoints.length - 1];

    if (!lastPoint) {
      button.hidden = true;
      return;
    }

    button.href = `https://www.google.com/maps?q=${lastPoint.lat},${lastPoint.lng}`;
    button.hidden = false;
  }

  function renderPointList(points) {
    const list = document.getElementById("routePointList");
    list.innerHTML = "";

    if (!points.length) {
      const empty = document.createElement("div");
      empty.className = "route-point-row";
      empty.append(
        createTextNode("div", "0", "route-point-order"),
        buildPointContent("Sin puntos registrados", "Este viaje no tiene ubicaciones guardadas todavia."),
        createTextNode("span", "Sin GPS", "route-point-chip")
      );
      list.appendChild(empty);
      return;
    }

    points.forEach((point) => {
      const row = document.createElement("article");
      row.className = "route-point-row";
      row.append(
        createTextNode("div", String(point.sequence), "route-point-order"),
        buildPointContent(
          `${formatDateTime(point.timestamp)} · ${point.lat.toFixed(6)}, ${point.lng.toFixed(6)}`,
          `Precision ${Math.round(point.accuracy || 0)} m · Velocidad ${Math.round(point.speedKmh || 0)} km/h`
        ),
        createTextNode("span", `#${point.sequence}`, "route-point-chip")
      );
      list.appendChild(row);
    });
  }

  function buildPointContent(title, subtitle) {
    const wrapper = document.createElement("div");
    wrapper.append(
      createTextNode("h4", title),
      createTextNode("p", subtitle)
    );
    return wrapper;
  }

  async function renderMap(points) {
    const mapStage = document.getElementById("routeMapStage");
    const fallbackStage = document.getElementById("routeMapFallback");
    fallbackStage.hidden = true;
    mapStage.hidden = false;
    mapStage.innerHTML = "";

    if (!points.length) {
      mapStage.hidden = true;
      fallbackStage.hidden = false;
      fallbackStage.innerHTML = `
        <p>No hay puntos suficientes para dibujar un recorrido.</p>
      `;
      return;
    }

    try {
      await ensureGoogleMaps();
      const snappedPoints = await getRenderableRoutePoints(points);
      drawGoogleMap(snappedPoints, mapStage);
    } catch (error) {
      mapStage.hidden = true;
      fallbackStage.hidden = false;
      fallbackStage.innerHTML = `
        <p>No pudimos cargar Google Maps o todavia no configuraste la API key.</p>
      `;

      if (points.length > 1) {
        const preview = document.createElement("div");
        preview.className = "route-preview route-map-stage";
        preview.innerHTML = buildRouteSvgMarkup(points, 860, 320, 24);
        fallbackStage.appendChild(preview);
      }
    }
  }

  async function getRenderableRoutePoints(points) {
    const cleanedPoints = cleanRoutePoints(points);

    if (cleanedPoints.length < 2) {
      return cleanedPoints;
    }

    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      return cleanedPoints;
    }

    try {
      const snappedPoints = await snapPathToRoads(cleanedPoints, apiKey);
      return snappedPoints.length ? snappedPoints : cleanedPoints;
    } catch (error) {
      console.warn("No se pudo ajustar la ruta a las calles de Google Maps", error);
      return cleanedPoints;
    }
  }

  function cleanRoutePoints(points) {
    const cleaned = [];

    (points || []).forEach((point, index) => {
      const lat = Number(point.lat);
      const lng = Number(point.lng);

      if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
        return;
      }

      const previous = cleaned[cleaned.length - 1];
      if (previous && Math.abs(previous.lat - lat) < 0.000001 && Math.abs(previous.lng - lng) < 0.000001) {
        return;
      }

      cleaned.push({
        sequence: Number(point.sequence || index + 1),
        lat,
        lng,
        timestamp: point.timestamp || "",
        accuracy: Number(point.accuracy || 0),
        speedKmh: Number(point.speedKmh || 0)
      });
    });

    return cleaned;
  }

  async function snapPathToRoads(points, apiKey) {
    const chunks = buildRoadChunks(points, 100);
    const snappedPath = [];

    for (const chunk of chunks) {
      const snappedChunk = await requestSnappedChunk(chunk, apiKey);

      snappedChunk.forEach((point) => {
        const previous = snappedPath[snappedPath.length - 1];
        if (previous && Math.abs(previous.lat - point.lat) < 0.000001 && Math.abs(previous.lng - point.lng) < 0.000001) {
          return;
        }

        snappedPath.push(point);
      });
    }

    return snappedPath;
  }

  function buildRoadChunks(points, maxPointsPerRequest) {
    if (points.length <= maxPointsPerRequest) {
      return [points];
    }

    const chunks = [];
    const step = Math.max(maxPointsPerRequest - 1, 1);

    for (let start = 0; start < points.length; start += step) {
      const end = Math.min(start + maxPointsPerRequest, points.length);
      const chunk = points.slice(start, end);
      if (chunk.length >= 2) {
        chunks.push(chunk);
      }
    }

    return chunks;
  }

  async function requestSnappedChunk(points, apiKey) {
    const url = new URL("https://roads.googleapis.com/v1/snapToRoads");
    url.searchParams.set("path", points.map((point) => `${point.lat},${point.lng}`).join("|"));
    url.searchParams.set("interpolate", "true");
    url.searchParams.set("key", apiKey);

    const response = await fetch(url.toString(), { method: "GET" });
    const payload = await response.json().catch(() => ({}));

    if (!response.ok || !Array.isArray(payload.snappedPoints)) {
      const detail = payload && payload.error && payload.error.message
        ? payload.error.message
        : `HTTP ${response.status}`;
      throw new Error(detail);
    }

    return payload.snappedPoints
      .map((point, index) => ({
        sequence: index + 1,
        lat: Number(point.location && point.location.latitude),
        lng: Number(point.location && point.location.longitude)
      }))
      .filter((point) => Number.isFinite(point.lat) && Number.isFinite(point.lng));
  }

  function ensureGoogleMaps() {
    if (window.google && window.google.maps) {
      return Promise.resolve(window.google.maps);
    }

    const apiKey = getGoogleMapsApiKey();
    if (!apiKey) {
      return Promise.reject(new Error("Google Maps no esta configurado."));
    }

    if (googleMapsPromise) {
      return googleMapsPromise;
    }

    googleMapsPromise = new Promise((resolve, reject) => {
      const callbackName = `oaMileageMapReady${Date.now()}`;
      window[callbackName] = () => {
        delete window[callbackName];
        resolve(window.google.maps);
      };

      const script = document.createElement("script");
      script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&callback=${callbackName}`;
      script.async = true;
      script.defer = true;
      script.onerror = () => {
        delete window[callbackName];
        reject(new Error("No pudimos cargar la libreria de Google Maps."));
      };
      document.head.appendChild(script);
    });

    return googleMapsPromise;
  }

  function drawGoogleMap(points, container) {
    const map = new google.maps.Map(container, {
      center: { lat: points[0].lat, lng: points[0].lng },
      zoom: 10,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true
    });

    const bounds = new google.maps.LatLngBounds();
    const path = points.map((point) => {
      const latLng = { lat: point.lat, lng: point.lng };
      bounds.extend(latLng);
      return latLng;
    });

    new google.maps.Polyline({
      path,
      map,
      strokeColor: "#d91f26",
      strokeOpacity: 1,
      strokeWeight: 5
    });

    new google.maps.Marker({
      position: path[0],
      map,
      label: "A"
    });

    new google.maps.Marker({
      position: path[path.length - 1],
      map,
      label: "B"
    });

    if (path.length === 1) {
      map.setCenter(path[0]);
      map.setZoom(15);
      return;
    }

    map.fitBounds(bounds, 48);
  }

  function buildRouteSvgMarkup(points, width, height, padding) {
    const latitudes = points.map((point) => point.lat);
    const longitudes = points.map((point) => point.lng);
    const minLat = Math.min(...latitudes);
    const maxLat = Math.max(...latitudes);
    const minLng = Math.min(...longitudes);
    const maxLng = Math.max(...longitudes);
    const latRange = Math.max(maxLat - minLat, 0.0001);
    const lngRange = Math.max(maxLng - minLng, 0.0001);

    const polyline = points
      .map((point) => {
        const x = padding + ((point.lng - minLng) / lngRange) * (width - padding * 2);
        const y = height - padding - ((point.lat - minLat) / latRange) * (height - padding * 2);
        return `${x},${y}`;
      })
      .join(" ");

    const firstPoint = polyline.split(" ")[0].split(",");
    const lastPoint = polyline.split(" ").slice(-1)[0].split(",");

    return `
      <svg viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" aria-hidden="true">
        <polyline points="${polyline}" fill="none" stroke="#d91f26" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"></polyline>
        <circle cx="${firstPoint[0]}" cy="${firstPoint[1]}" r="7" fill="#2056a6"></circle>
        <circle cx="${lastPoint[0]}" cy="${lastPoint[1]}" r="8" fill="#177f5d"></circle>
      </svg>
    `;
  }

  function showError(message) {
    document.getElementById("routeLoading").hidden = true;
    document.getElementById("routeContent").hidden = true;
    document.getElementById("routeError").hidden = false;
    setText("routeErrorText", message);
  }

  function humanTripType(type) {
    const value = String(type || "").toLowerCase();

    if (value.indexOf("transfer") !== -1) {
      return "Transferencia";
    }

    if (value.indexOf("repart") !== -1) {
      return "Reparto";
    }

    return type || "-";
  }

  function humanStatus(status) {
    const map = {
      assigned: "Pendiente",
      edited: "Reprogramado",
      in_route: "En ruta",
      completed: "Completado"
    };

    return map[status] || "Registrado";
  }

  function statusClass(status) {
    const map = {
      assigned: "status-badge--pending",
      edited: "status-badge--warm",
      in_route: "status-badge--progress",
      completed: "status-badge--success"
    };

    return map[status] || "";
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

  function formatKm(value) {
    return `${Number(value || 0).toFixed(1)} km`;
  }

  function setText(id, value) {
    const node = document.getElementById(id);
    if (node) {
      node.textContent = value;
    }
  }

  function createTextNode(tag, text, className) {
    const node = document.createElement(tag);
    if (className) {
      node.className = className;
    }
    node.textContent = text;
    return node;
  }
})();
