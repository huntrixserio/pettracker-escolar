/* ==========================================================================
   Vista · Inicio / panel en vivo
   ========================================================================== */
(function () {
  'use strict';

  const PT = window.PT;
  const store = PT.store;
  const ui = PT.ui;
  const util = PT.util;
  const data = PT.data;

  let leafletMap = null;
  let mapMarkers = {};
  let mapTrailLine = null;
  let mapFeedUnsubs = [];
  let mapView = null;
  let mapAutoFit = false;

  function currentEntries(state, petId) {
    return state.timeline
      .filter(function (entry) { return entry.petId === petId; })
      .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
  }

  function healthSnapshot(health) {
    const preventions = health.vaccines.concat(health.dewormings || []);
    let overdue = 0;
    let soon = 0;
    let nearest = null;

    preventions.forEach(function (item) {
      if (!item.next) return;
      const days = util.daysUntil(item.next);
      if (days < 0) overdue += 1;
      else if (days <= 7) soon += 1;
      if (!nearest || util.daysUntil(item.next) < util.daysUntil(nearest.next)) nearest = item;
    });

    let label = 'Al día';
    let tone = 'emerald';
    if (overdue) {
      label = 'Requiere atención';
      tone = 'rose';
    } else if (soon) {
      label = 'Revisar pronto';
      tone = 'amber';
    }

    let meta = 'Sin alertas próximas';
    if (nearest) {
      const days = util.daysUntil(nearest.next);
      meta = nearest.name + ' · ' + (days < 0 ? 'vencida' : util.relativeDays(nearest.next).toLowerCase());
    }

    return { label: label, tone: tone, meta: meta, overdue: overdue, soon: soon };
  }

  function gatherEvents(state, pet, health) {
    const events = [];
    const today = util.todayKey();

    health.vaccines.forEach(function (vaccine) {
      if (!vaccine.next) return;
      const days = util.daysUntil(vaccine.next);
      events.push({
        title: vaccine.name,
        kind: 'Vacuna',
        date: vaccine.next,
        datetime: vaccine.next + 'T12:00',
        icon: 'syringe',
        tone: days < 0 ? 'rose' : days <= 7 ? 'amber' : 'emerald',
        meta: 'Refuerzo de vacuna'
      });
    });

    (health.dewormings || []).forEach(function (item) {
      if (!item.next) return;
      const days = util.daysUntil(item.next);
      events.push({
        title: item.name,
        kind: 'Prevención',
        date: item.next,
        datetime: item.next + 'T12:00',
        icon: 'shield-plus',
        tone: days < 0 ? 'rose' : days <= 7 ? 'amber' : 'sky',
        meta: 'Control de prevención'
      });
    });

    (health.meds || []).forEach(function (med) {
      if (!med.active || !med.end) return;
      const days = util.daysUntil(med.end);
      if (days < 0) return;
      events.push({
        title: 'Fin de ' + med.name,
        kind: 'Medicamento',
        date: med.end,
        datetime: med.end + 'T09:00',
        icon: 'pill',
        tone: days <= 3 ? 'amber' : 'violet',
        meta: med.dose + ' · ' + med.frequency
      });
    });

    const now = new Date();
    const currentTime = util.pad(now.getHours()) + ':' + util.pad(now.getMinutes());

    state.shifts
      .filter(function (shift) {
        if (shift.petId !== pet.id) return false;
        if (shift.date > today) return true;
        return shift.date === today && shift.time >= currentTime;
      })
      .forEach(function (shift) {
        const type = data.SHIFT_TYPES[shift.type] || data.SHIFT_TYPES.paseo;
        events.push({
          title: type.label + ' de ' + pet.name,
          kind: 'Turno',
          date: shift.date,
          datetime: shift.date + 'T' + shift.time,
          icon: type.icon,
          tone: type.tone,
          meta: shift.time + ' · ' + shift.signups.length + '/' + shift.capacity + ' inscritos'
        });
      });

    return events
      .sort(function (a, b) { return new Date(a.datetime) - new Date(b.datetime); })
      .slice(0, 4);
  }

  function statCard(iconName, toneName, value, label, meta, valueClass) {
    const t = ui.tone(toneName);
    return (
      '<div class="card reveal min-w-0 p-4">' +
        '<div class="flex items-start justify-between gap-2">' +
          '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl ' + t.ico + '">' + ui.icon(iconName, 'h-[1.1rem] w-[1.1rem]') + '</span>' +
          '<span class="text-right text-[0.57rem] font-extrabold uppercase leading-tight tracking-wide text-ink/55">' + util.esc(label) + '</span>' +
        '</div>' +
        '<p class="mt-3 font-display ' + (valueClass || 'text-2xl') + ' font-semibold leading-none text-ink">' + util.esc(value) + '</p>' +
        (meta ? '<p class="mt-1.5 text-[0.63rem] font-bold leading-tight ' + t.text + '">' + util.esc(meta) + '</p>' : '') +
      '</div>'
    );
  }

  function connectionMeta(state) {
    if (state.status === 'connecting') return { label: 'Conectando…', tone: 'amber', dot: 'bg-amber-500 ws-pulse' };
    if (state.status === 'reconnecting') return { label: 'Reconectando…', tone: 'amber', dot: 'bg-amber-500 ws-pulse' };
    if (state.paused) return { label: 'En pausa', tone: 'amber', dot: 'bg-amber-500' };
    if (state.status === 'online') return { label: 'WS en vivo', tone: 'emerald', dot: 'bg-emerald-500' };
    return { label: 'Sin señal', tone: 'rose', dot: 'bg-rose-500' };
  }

  function speedLabel(state) {
    return state.mode === 'home' ? '0 km/h' : state.speedKmh.toFixed(1) + ' km/h';
  }

  function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function mapPetCard(petId, pet, state, active) {
    const isHome = state.mode === 'home';
    return (
      '<button type="button" class="pet-live-card ' + (active ? 'is-active' : '') + '" data-map-pet="' + petId + '" aria-pressed="' + active + '">' +
        '<span class="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white text-2xl shadow-sm">' + pet.emoji + '</span>' +
        '<span class="min-w-0 flex-1 text-left">' +
          '<span class="flex flex-wrap items-center gap-1.5">' +
            '<span class="text-sm font-extrabold text-ink">' + util.esc(pet.name) + '</span>' +
            ui.badge(isHome ? 'En casa' : 'En paseo', isHome ? 'emerald' : 'sky') +
          '</span>' +
          '<span id="map-pet-' + petId + '-place" class="mt-0.5 block truncate text-[0.68rem] font-semibold text-ink/60">' + util.esc(state.place) + '</span>' +
        '</span>' +
        '<span class="flex flex-none flex-col items-end gap-0.5">' +
          '<span id="map-pet-' + petId + '-meta" class="text-[0.6rem] font-bold text-ink/55">' + (isHome ? 'Sin desplazamiento' : speedLabel(state)) + '</span>' +
          '<span class="flex items-center gap-1 text-[0.6rem] font-extrabold text-brand-700">' + (active ? 'Viendo' : 'Ver perfil') + ui.icon('chevron-right', 'h-3 w-3') + '</span>' +
        '</span>' +
      '</button>'
    );
  }

  function telemetryCell(label, value, id) {
    return (
      '<div class="min-w-0 rounded-xl bg-stone-50/80 px-2.5 py-2">' +
        '<p class="text-[0.55rem] font-extrabold uppercase tracking-wide text-ink/55">' + label + '</p>' +
        '<p id="' + id + '" class="mt-0.5 truncate text-xs font-extrabold text-ink">' + util.esc(value) + '</p>' +
      '</div>'
    );
  }

  function mapTelemetryMarkup(state, pet) {
    const isWalk = state.mode === 'walk';
    const pct = isWalk && state.routeDistanceMeters ? (state.progressMeters / state.routeDistanceMeters) * 100 : 0;
    return (
      '<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">' +
        telemetryCell('Ubicación GPS', state.place, 'map-place') +
        telemetryCell('Velocidad', speedLabel(state), 'map-speed') +
        telemetryCell('Precisión', '±' + state.accuracy + ' m', 'map-accuracy') +
        telemetryCell('Batería', state.battery + '%', 'map-battery') +
      '</div>' +
      (isWalk
        ? '<div class="mt-3">' +
            '<div class="flex items-center justify-between gap-2 text-[0.62rem] font-bold text-ink/55">' +
              '<span>Avance del paseo</span>' +
              '<span id="map-progress-label">' + Math.round(state.progressMeters) + ' m / ' + (state.routeDistanceMeters / 1000).toFixed(2) + ' km</span>' +
            '</div>' +
            '<div class="capacity-bar mt-1"><span id="map-progress-fill" style="width:' + Math.max(1, pct).toFixed(1) + '%"></span></div>' +
          '</div>'
        : '<div class="mt-3 flex items-center gap-2 rounded-xl bg-brand-50/70 px-3 py-2 text-[0.7rem] font-semibold text-brand-800">' +
            ui.icon('home', 'h-4 w-4') + util.esc(pet.name) + ' está en casa, sin desplazamiento.' +
          '</div>') +
      '<div class="mt-3 flex flex-wrap items-center justify-between gap-2">' +
        '<p class="min-w-0 text-[0.6rem] font-semibold leading-relaxed text-ink/55">' +
          '<span class="font-extrabold text-ink/65">WebSocket simulado</span> · ' +
          '<span id="map-socket-url" class="break-all">' + util.esc(state.socketUrl) + '</span> · mensaje <span id="map-seq">#' + state.seq + '</span> · último paquete <span id="map-last">' + util.esc(state.updatedAt ? util.fmtTime(state.updatedAt) : 'Esperando…') + '</span> · <span id="map-rssi">' + state.rssi + ' dBm</span>' +
        '</p>' +
        '<button type="button" class="btn btn-sm btn-ghost flex-none text-brand-700" data-map-reconnect title="Simular reconexión del WebSocket">' + ui.icon('refresh-cw', 'h-3.5 w-3.5') + ' Reconectar</button>' +
      '</div>'
    );
  }

  function updateMapChrome(feedState) {
    const info = connectionMeta(feedState);
    const tone = ui.tone(info.tone);
    const statusEl = document.getElementById('map-ws-status');
    const statusKey = info.label + '|' + info.tone;

    if (statusEl && statusEl.getAttribute('data-state') !== statusKey) {
      statusEl.setAttribute('data-state', statusKey);
      statusEl.className = 'chip-soft ' + tone.chip;
      statusEl.innerHTML = '<span class="h-1.5 w-1.5 rounded-full ' + info.dot + '"></span>' + util.esc(info.label);
      statusEl.setAttribute('title', feedState.paused ? 'Simulación pausada' : 'WebSocket simulado: ' + feedState.socketUrl);
    }

    const pauseButton = document.querySelector('[data-map-pause]');
    if (pauseButton && pauseButton.getAttribute('data-paused') !== String(feedState.paused)) {
      pauseButton.setAttribute('data-paused', String(feedState.paused));
      pauseButton.innerHTML = ui.icon(feedState.paused ? 'play' : 'pause', 'h-4 w-4');
      pauseButton.setAttribute('aria-label', feedState.paused ? 'Reanudar seguimiento GPS' : 'Pausar seguimiento GPS');
      pauseButton.setAttribute('title', feedState.paused ? 'Reanudar seguimiento GPS' : 'Pausar seguimiento GPS');
      ui.icons();
    }
  }

  function updateMapPetCard(feedState) {
    setText('map-pet-' + feedState.petId + '-place', feedState.place);
    setText('map-pet-' + feedState.petId + '-meta', feedState.mode === 'home' ? 'Sin desplazamiento' : speedLabel(feedState));
  }

  function updateMapMarker(feedState) {
    const marker = mapMarkers[feedState.petId];
    if (!marker) return;
    marker.setLatLng([feedState.position.lat, feedState.position.lng]);

    const iconElement = marker.getElement();
    if (iconElement) {
      const pin = iconElement.querySelector('.pet-pin');
      if (pin) {
        pin.classList.toggle('is-offline', feedState.status !== 'online');
        pin.classList.toggle('is-paused', feedState.paused);
      }
    }

    if (feedState.petId === 'nube' && mapTrailLine) {
      mapTrailLine.setLatLngs(PT.realtime.routeTrail(feedState.progressMeters));
    }
  }

  function updateMapTelemetry(feedState) {
    setText('map-place', feedState.place);
    setText('map-speed', speedLabel(feedState));
    setText('map-accuracy', '±' + feedState.accuracy + ' m');
    setText('map-battery', feedState.battery + '%');
    setText('map-last', feedState.updatedAt ? util.fmtTime(feedState.updatedAt) : 'Esperando…');
    setText('map-seq', '#' + feedState.seq);
    setText('map-rssi', feedState.rssi + ' dBm');

    if (feedState.mode === 'walk' && feedState.routeDistanceMeters) {
      const pct = Math.max(1, Math.min(100, (feedState.progressMeters / feedState.routeDistanceMeters) * 100));
      const fill = document.getElementById('map-progress-fill');
      if (fill) fill.style.width = pct.toFixed(1) + '%';
      setText('map-progress-label', Math.round(feedState.progressMeters) + ' m / ' + (feedState.routeDistanceMeters / 1000).toFixed(2) + ' km');
    }

    updateMapChrome(feedState);
  }

  function updateActiveLive(feedState) {
    updateMapTelemetry(feedState);

    if (store.currentPet().id !== feedState.petId) return;

    setText('hero-live-place', feedState.place);
    const heroTime = document.getElementById('hero-live-updated');
    if (heroTime && feedState.updatedAt) {
      heroTime.setAttribute('data-relative', feedState.updatedAt);
      heroTime.textContent = 'Actualizado ' + util.timeAgo(feedState.updatedAt);
    }
  }

  function petMarkerIcon(petId, active) {
    const pet = store.getState().pets.find(function (item) { return item.id === petId; });
    const emoji = pet ? pet.emoji : petId === 'misha' ? '🐱' : '🐶';
    let html;

    if (petId === 'misha') {
      html = '<div class="pet-pin pet-pin-home ' + (active ? 'is-active' : '') + '">' +
        '<span class="pet-pin-bubble">' + emoji + '</span>' +
        '<span class="pet-pin-home-badge">🏠</span>' +
      '</div>';
    } else {
      html = '<div class="pet-pin pet-pin-walk ' + (active ? 'is-active' : '') + '">' +
        '<span class="pet-pin-ring"></span>' +
        '<span class="pet-pin-ring is-second"></span>' +
        '<span class="pet-pin-bubble">' + emoji + '</span>' +
      '</div>';
    }

    return window.L.divIcon({
      className: 'pet-map-div-icon',
      html: html,
      iconSize: [48, 48],
      iconAnchor: [24, 24]
    });
  }

  function selectMapPet(petId) {
    const state = store.getState();
    const pet = state.pets.find(function (item) { return item.id === petId; });
    if (!pet) return;

    if (petId !== state.activePetId) {
      mapAutoFit = true;
      store.setPet(petId);
      ui.toast('Ahora ves el perfil de ' + pet.name + '.', 'success');
      return;
    }

    const marker = mapMarkers[petId];
    if (leafletMap && marker) {
      const latlng = marker.getLatLng();
      mapView = { lat: latlng.lat, lng: latlng.lng, zoom: 17 };
      leafletMap.setView(latlng, 17, { animate: true });
    }
  }

  function cleanupPetMap() {
    mapFeedUnsubs.forEach(function (unsubscribe) {
      try { unsubscribe(); } catch (error) { /* noop */ }
    });
    mapFeedUnsubs = [];

    if (leafletMap) {
      try {
        const center = leafletMap.getCenter();
        mapView = { lat: center.lat, lng: center.lng, zoom: leafletMap.getZoom() };
      } catch (error) { /* noop */ }
      leafletMap.remove();
      leafletMap = null;
    }

    mapMarkers = {};
    mapTrailLine = null;
  }

  function setupPetMap(activeMapId) {
    const mapElement = document.getElementById('pet-leaflet-map');
    if (!mapElement) return;

    cleanupPetMap();

    const state = store.getState();
    const nubePet = state.pets.find(function (pet) { return pet.id === 'nube'; }) || { name: 'Nube', emoji: '🐶' };
    const mishaPet = state.pets.find(function (pet) { return pet.id === 'misha'; }) || { name: 'Misha', emoji: '🐱' };
    const nubeFeed = PT.realtime.getFeed('nube');
    const mishaFeed = PT.realtime.getFeed('misha');
    const nubeState = nubeFeed.getState();
    const mishaState = mishaFeed.getState();
    const activeFeed = activeMapId === 'misha' ? mishaFeed : nubeFeed;

    if (!window.L) {
      mapElement.innerHTML =
        '<div class="map-fallback">' +
          '<p class="text-3xl">🗺️</p>' +
          '<p class="mt-2 font-display text-base font-semibold text-ink">No se pudo cargar el mapa real</p>' +
          '<p class="mt-1 max-w-xs text-xs font-semibold text-ink/55">Revisa la conexión a Internet y recarga la página. La telemetría del collar seguirá actualizándose.</p>' +
        '</div>';
    } else {
      const map = window.L.map(mapElement, {
        zoomControl: false,
        scrollWheelZoom: false,
        minZoom: 13,
        maxZoom: 19,
        zoomSnap: 0.25
      });

      const tiles = window.L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
      }).addTo(map);

      tiles.on('tileerror', function () {
        const warning = document.getElementById('map-tile-warning');
        if (warning) warning.classList.remove('hidden');
      });

      window.L.control.zoom({ position: 'bottomright' }).addTo(map);
      window.L.control.scale({ position: 'bottomleft', imperial: false }).addTo(map);

      const route = PT.realtime.NUBE_ROUTE;
      const bounds = window.L.latLngBounds(route.concat([[PT.realtime.HOME.lat, PT.realtime.HOME.lng]]));

      window.L.polyline(route, {
        color: '#2f7355',
        weight: 4,
        opacity: 0.26,
        dashArray: '1 8',
        lineCap: 'round'
      }).addTo(map);

      mapTrailLine = window.L.polyline(PT.realtime.routeTrail(nubeState.progressMeters), {
        color: '#2f7355',
        weight: 5,
        opacity: 0.85,
        lineCap: 'round'
      }).addTo(map);

      mapMarkers.misha = window.L.marker([mishaState.position.lat, mishaState.position.lng], {
        icon: petMarkerIcon('misha', activeMapId === 'misha'),
        zIndexOffset: 300,
        title: mishaPet.name + ' · en casa'
      }).addTo(map);

      mapMarkers.misha.bindTooltip(mishaPet.name + ' · en casa', {
        permanent: true,
        direction: 'top',
        offset: [0, -22],
        className: 'pet-map-tooltip'
      });

      mapMarkers.nube = window.L.marker([nubeState.position.lat, nubeState.position.lng], {
        icon: petMarkerIcon('nube', activeMapId === 'nube'),
        zIndexOffset: 600,
        title: nubePet.name + ' · paseando'
      }).addTo(map);

      mapMarkers.nube.bindTooltip(nubePet.name + ' · paseando', {
        permanent: true,
        direction: 'top',
        offset: [0, -22],
        className: 'pet-map-tooltip'
      });

      mapMarkers.misha.on('click', function () { selectMapPet('misha'); });
      mapMarkers.nube.on('click', function () { selectMapPet('nube'); });

      if (mapAutoFit || !mapView) {
        map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
        mapAutoFit = false;
      } else {
        map.setView([mapView.lat, mapView.lng], mapView.zoom);
      }

      map.on('moveend zoomend', function () {
        const center = map.getCenter();
        mapView = { lat: center.lat, lng: center.lng, zoom: map.getZoom() };
      });

      const fitButton = document.querySelector('[data-map-fit]');
      if (fitButton) {
        fitButton.addEventListener('click', function () {
          mapView = null;
          map.fitBounds(bounds, { padding: [28, 28], maxZoom: 16 });
        });
      }

      leafletMap = map;

      window.setTimeout(function () {
        if (leafletMap === map) map.invalidateSize();
      }, 120);
    }

    mapFeedUnsubs = [
      nubeFeed.subscribe(function (feedState) {
        updateMapMarker(feedState);
        updateMapPetCard(feedState);
        if (feedState.petId === activeMapId) updateActiveLive(feedState);
      }),
      mishaFeed.subscribe(function (feedState) {
        updateMapMarker(feedState);
        updateMapPetCard(feedState);
        if (feedState.petId === activeMapId) updateActiveLive(feedState);
      })
    ];

    updateMapChrome(activeFeed.getState());
  }

  function eventRow(event) {
    const t = ui.tone(event.tone);
    const day = util.fmtDate(event.date, { day: '2-digit' });
    const month = util.fmtDate(event.date, { month: 'short' }).replace('.', '').toUpperCase();
    return (
      '<div class="flex items-center gap-3 rounded-2xl border border-ink/[0.06] bg-white px-3 py-2.5">' +
        '<div class="grid w-10 flex-none place-items-center rounded-xl ' + t.ico + ' py-1">' +
          '<span class="text-[0.55rem] font-extrabold uppercase leading-none tracking-wide">' + util.esc(month) + '</span>' +
          '<span class="font-display text-base font-semibold leading-tight">' + util.esc(day) + '</span>' +
        '</div>' +
        '<div class="min-w-0 flex-1">' +
          '<p class="truncate text-[0.8rem] font-extrabold text-ink">' + util.esc(event.title) + '</p>' +
          '<p class="line-clamp-2 text-[0.68rem] font-semibold leading-snug text-ink/60">' + util.esc(event.meta) + '</p>' +
        '</div>' +
        '<span class="chip-soft flex-none ' + t.chip + '">' + util.esc(util.relativeDays(event.date)) + '</span>' +
      '</div>'
    );
  }

  function reportRow(report, pet) {
    return (
      '<div class="rounded-2xl border border-amber-200/70 bg-amber-50/60 p-3">' +
        '<div class="flex items-start gap-2.5">' +
          ui.avatar(report.by, 'sm') +
          '<div class="min-w-0 flex-1">' +
            '<p class="text-xs font-extrabold text-ink">' + util.esc(report.by) + ' <span class="font-semibold text-ink/60">· ' + util.timeAgo(report.at) + '</span></p>' +
            '<p class="mt-0.5 text-xs font-semibold leading-snug text-ink/65">' + util.esc(report.note) + '</p>' +
            '<div class="mt-1.5 flex flex-wrap items-center gap-1.5">' +
              ui.badge(PT.meta.zone(report.zone).name, 'sky') +
              '<span class="text-[0.65rem] font-bold text-ink/55">' + util.esc(pet.emoji + ' ' + pet.name) + '</span>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="mt-2.5 flex gap-2">' +
          '<button type="button" class="btn btn-sm btn-primary flex-1" data-approve="' + util.esc(report.id) + '">' + ui.icon('check', 'h-3.5 w-3.5') + ' Aprobar</button>' +
          '<button type="button" class="btn btn-sm btn-secondary flex-1" data-reject="' + util.esc(report.id) + '">' + ui.icon('x', 'h-3.5 w-3.5') + ' Rechazar</button>' +
        '</div>' +
      '</div>'
    );
  }

  /* ------------------------------------------------------------------------
     Modales de acciones
     ------------------------------------------------------------------------ */
  function openStatusModal() {
    if (!store.can('status')) {
      ui.toast('Solo cuidadores y administradores pueden cambiar el estado.', 'error');
      return;
    }
    const state = store.getState();
    const pet = store.currentPet();
    const statusOptions = Object.keys(data.STATUSES).map(function (key) {
      const item = data.STATUSES[key];
      const t = ui.tone(item.tone);
      const checked = pet.status.key === key;
      return (
        '<label class="choice-card relative block">' +
          '<input type="radio" name="status" value="' + key + '" ' + (checked ? 'checked' : '') + '>' +
          '<span class="w-full">' +
            '<span class="grid h-8 w-8 flex-none place-items-center rounded-lg ' + t.ico + '">' + ui.icon(item.icon, 'h-4 w-4') + '</span>' +
            '<span class="min-w-0 flex-1"><span class="block text-sm font-extrabold">' + item.label + '</span>' +
            '<span class="block text-[0.65rem] font-semibold leading-tight text-ink/60">' + item.desc + '</span></span>' +
          '</span>' +
        '</label>'
      );
    }).join('');

    const zoneOptions = data.ZONES.map(function (zone) {
      return '<option value="' + zone.id + '" ' + (pet.status.zone === zone.id ? 'selected' : '') + '>' + zone.name + '</option>';
    }).join('');

    ui.openModal({
      title: 'Actualizar estado de ' + pet.name,
      subtitle: 'El cambio se muestra a toda la comunidad al instante',
      icon: 'radio',
      content:
        '<form id="status-form" class="space-y-4">' +
          '<div>' +
            '<span class="field-label">¿Qué está haciendo?</span>' +
            '<div class="grid grid-cols-2 gap-2">' + statusOptions + '</div>' +
          '</div>' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="status-zone">Ubicación</label>' +
              '<select class="field" id="status-zone" name="zone">' + zoneOptions + '</select>' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="status-by">Reportado por</label>' +
              '<input class="field" id="status-by" value="' + util.esc(state.profile.name) + '" disabled>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="field-label" for="status-note">Nota breve (opcional)</label>' +
            '<input class="field" id="status-note" name="note" maxlength="120" placeholder="Ej. Paseando con 11°A, muy feliz">' +
          '</div>' +
        '</form>',
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="status-form" class="btn btn-primary">' + ui.icon('check', 'h-4 w-4') + ' Actualizar estado</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#status-form');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const fd = new FormData(form);
          const key = (fd.get('status') || pet.status.key).toString();
          const zone = (fd.get('zone') || pet.status.zone).toString();
          const note = (fd.get('note') || '').toString().trim();
          if (!data.STATUSES[key] || !data.ZONES.some(function (z) { return z.id === zone; })) return;

          const meta = PT.meta.status(key);
          const zoneMeta = PT.meta.zone(zone);
          ui.closeModal();
          const now = new Date().toISOString();
          store.update(function (draft) {
            const target = draft.pets.find(function (p) { return p.id === pet.id; });
            target.status = {
              key: key,
              zone: zone,
              by: state.profile.name,
              at: now,
              note: note || (key === 'paseo' ? 'Paseo con el equipo de cuidado' : '')
            };
            draft.timeline.unshift({
              id: util.uid('entry'),
              petId: pet.id,
              type: 'estado',
              title: 'Estado: ' + meta.label,
              note: zoneMeta.name + (note ? ' · ' + note : ''),
              by: state.profile.name,
              role: state.profile.role,
              at: now,
              photo: null
            });
          });
          ui.toast('Estado actualizado: ' + meta.label + ' en ' + zoneMeta.name, 'success');
        });
      }
    });
  }

  function openFeedModal() {
    if (!store.can('care')) {
      ui.toast('Solo cuidadores y administradores registran la alimentación.', 'error');
      return;
    }
    const pet = store.currentPet();
    const state = store.getState();
    const hour = new Date().getHours();
    const defaultMeal = hour < 11 ? 'Desayuno' : hour < 15 ? 'Almuerzo' : hour < 18 ? 'Snack' : 'Cena';

    ui.openModal({
      title: 'Alimentar a ' + pet.name,
      subtitle: 'Registra la comida y deja constancia en la bitácora',
      icon: 'utensils',
      content:
        '<form id="feed-form" class="space-y-4">' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="feed-meal">Momento del día</label>' +
              '<select class="field" id="feed-meal" name="meal">' +
                ['Desayuno', 'Almuerzo', 'Cena', 'Snack'].map(function (meal) {
                  return '<option ' + (meal === defaultMeal ? 'selected' : '') + '>' + meal + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="feed-portion">Porción</label>' +
              '<input class="field" id="feed-portion" name="portion" maxlength="80" placeholder="Ej. 1 taza de concentrado">' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="field-label" for="feed-note">Observaciones (opcional)</label>' +
            '<textarea class="field" id="feed-note" name="note" maxlength="220" placeholder="¿Comió bien? ¿Dejó algo? ¿Se comportó distinto?"></textarea>' +
          '</div>' +
          '<label class="flex cursor-pointer items-center gap-3 rounded-xl border border-ink/10 bg-white px-3 py-3">' +
            '<input type="checkbox" name="water" checked class="h-5 w-5 accent-brand-600">' +
            '<span class="flex items-center gap-2 text-sm font-bold text-ink/70">' + ui.icon('droplets', 'h-4 w-4 text-sky-500') + ' También renové el agua</span>' +
          '</label>' +
          '<p class="rounded-xl bg-brand-50 px-3 py-2 text-[0.72rem] font-semibold text-brand-800">Al guardar, el estado de ' + util.esc(pet.name) + ' cambiará a <strong>Comiendo</strong> en casa.</p>' +
        '</form>',
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="feed-form" class="btn btn-primary">' + ui.icon('check', 'h-4 w-4') + ' Registrar alimentación</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#feed-form');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const fd = new FormData(form);
          const meal = (fd.get('meal') || defaultMeal).toString();
          const portion = (fd.get('portion') || '').toString().trim();
          const note = (fd.get('note') || '').toString().trim();
          const water = fd.get('water') === 'on';
          const detail = [portion, note].filter(Boolean).join(' · ') || 'Comida registrada por el equipo de cuidado.';
          const profile = state.profile;

          ui.closeModal();
          const now = new Date().toISOString();
          store.update(function (draft) {
            const target = draft.pets.find(function (p) { return p.id === pet.id; });
            target.status = {
              key: 'comiendo',
              zone: 'casa',
              by: profile.name,
              at: now,
              note: meal + ' servido por ' + profile.name
            };
            draft.timeline.unshift({
              id: util.uid('entry'),
              petId: pet.id,
              type: 'alimentacion',
              title: meal + ' servido',
              note: detail,
              by: profile.name,
              role: profile.role,
              at: now,
              photo: null
            });
            if (water) {
              draft.timeline.unshift({
                id: util.uid('entry'),
                petId: pet.id,
                type: 'agua',
                title: 'Agua fresca',
                note: 'Se renovó el agua del bebedero durante la alimentación.',
                by: profile.name,
                role: profile.role,
                at: new Date(Date.now() - 1000).toISOString(),
                photo: null
              });
            }
          });
          ui.toast('Alimentación registrada para ' + pet.name, 'success', {
            detail: water ? 'También se registró el cambio de agua.' : 'La bitácora ya tiene la nueva entrada.'
          });
        });
      }
    });
  }

  function openReportModal(prefillZone) {
    const pet = store.currentPet();
    const selectedZoneId = data.ZONES.some(function (zone) { return zone.id === prefillZone; })
      ? prefillZone
      : pet.status.zone;
    const zoneOptions = data.ZONES.map(function (zone) {
      return '<option value="' + zone.id + '" ' + (selectedZoneId === zone.id ? 'selected' : '') + '>' + zone.name + '</option>';
    }).join('');

    ui.openModal({
      title: 'Reportar avistamiento',
      subtitle: 'Ayuda a mantener la ubicación de ' + pet.name + ' al día',
      icon: 'map-pin',
      content:
        '<form id="report-form" class="space-y-4">' +
          '<div class="flex items-center gap-3 rounded-2xl bg-brand-50 p-3">' +
            '<span class="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white text-2xl">' + pet.emoji + '</span>' +
            '<p class="text-xs font-semibold leading-snug text-brand-900/70">Tu reporte será revisado por un administrador antes de actualizar el estado oficial.</p>' +
          '</div>' +
          '<div>' +
            '<label class="field-label" for="report-zone">¿Dónde la viste?</label>' +
            '<select class="field" id="report-zone" name="zone">' + zoneOptions + '</select>' +
          '</div>' +
          '<div>' +
            '<label class="field-label" for="report-note">¿Qué estaba haciendo?</label>' +
            '<textarea class="field" id="report-note" name="note" maxlength="240" required placeholder="Ej. Está en la cancha con el grupo de décimo, se ve tranquila y tiene agua."></textarea>' +
          '</div>' +
        '</form>',
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="report-form" class="btn btn-primary">' + ui.icon('send', 'h-4 w-4') + ' Enviar reporte</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#report-form');
        const noteInput = panel.querySelector('#report-note');
        noteInput.focus();
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const fd = new FormData(form);
          const zone = (fd.get('zone') || pet.status.zone).toString();
          const note = (fd.get('note') || '').toString().trim();
          if (!note) {
            ui.toast('Cuéntanos qué viste para poder revisarlo.', 'error');
            noteInput.focus();
            return;
          }
          const profile = store.getState().profile;
          ui.closeModal();
          store.update(function (draft) {
            draft.reports.unshift({
              id: util.uid('report'),
              petId: pet.id,
              zone: zone,
              note: note,
              by: profile.name,
              role: profile.role,
              at: new Date().toISOString(),
              status: 'pendiente'
            });
          });
          ui.toast('Reporte enviado para revisión.', 'success', {
            detail: 'Un administrador lo aprobará y actualizará la ubicación.'
          });
        });
      }
    });
  }

  function registerWater() {
    if (!store.can('care')) {
      ui.toast('Solo cuidadores y administradores registran el agua.', 'error');
      return;
    }
    const pet = store.currentPet();
    const profile = store.getState().profile;
    const now = new Date().toISOString();
    store.update(function (draft) {
      draft.timeline.unshift({
        id: util.uid('entry'),
        petId: pet.id,
        type: 'agua',
        title: 'Agua fresca',
        note: 'Se limpió el bebedero y se renovó el agua.',
        by: profile.name,
        role: profile.role,
        at: now,
        photo: null
      });
    });
    ui.toast('Agua renovada para ' + pet.name + '.', 'success');
  }

  function reviewReport(reportId, approved) {
    if (!store.can('approve')) {
      ui.toast('Solo administradores pueden revisar reportes.', 'error');
      return;
    }
    const state = store.getState();
    const report = state.reports.find(function (r) { return r.id === reportId; });
    if (!report || report.status !== 'pendiente') return;
    const pet = state.pets.find(function (p) { return p.id === report.petId; });
    const zone = PT.meta.zone(report.zone);
    const profile = state.profile;
    const now = new Date().toISOString();

    store.update(function (draft) {
      const target = draft.reports.find(function (r) { return r.id === reportId; });
      target.status = approved ? 'aprobado' : 'rechazado';
      target.reviewedBy = profile.name;
      target.reviewedAt = now;
      if (approved && pet) {
        const targetPet = draft.pets.find(function (p) { return p.id === pet.id; });
        targetPet.status.zone = report.zone;
        targetPet.status.at = now;
        targetPet.status.by = report.by;
        targetPet.status.note = 'Ubicación confirmada por reporte comunitario';
        draft.timeline.unshift({
          id: util.uid('entry'),
          petId: pet.id,
          type: 'reporte',
          title: 'Avistamiento confirmado',
          note: report.by + ' reportó: "' + report.note + '" · Ubicación: ' + zone.name,
          by: profile.name,
          role: profile.role,
          at: now,
          photo: null
        });
      }
    });

    ui.toast(
      approved ? 'Reporte aprobado. Ubicación actualizada.' : 'Reporte rechazado.',
      approved ? 'success' : 'info'
    );
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  PT.views = PT.views || {};

  PT.views.dashboard = function (root) {
    const state = store.getState();
    const pet = store.currentPet();
    const health = store.currentHealth();
    const status = PT.meta.status(pet.status.key);
    const zone = PT.meta.zone(pet.status.zone);
    const statusTone = ui.tone(status.tone);
    const canStatus = store.can('status');

    cleanupPetMap();

    const feedNube = PT.realtime.getFeed('nube');
    const feedMisha = PT.realtime.getFeed('misha');
    const nubeFeedState = feedNube.getState();
    const mishaFeedState = feedMisha.getState();
    const activeMapId = pet.id === 'misha' ? 'misha' : 'nube';
    const activeMapFeed = activeMapId === 'misha' ? feedMisha : feedNube;
    const activeMapFeedState = activeMapFeed.getState();
    const mapNubePet = state.pets.find(function (item) { return item.id === 'nube'; }) || pet;
    const mapMishaPet = state.pets.find(function (item) { return item.id === 'misha'; }) || pet;

    const entries = currentEntries(state, pet.id);
    const todayEntries = entries.filter(function (entry) { return util.isToday(entry.at); });
    const mealsToday = todayEntries.filter(function (entry) { return entry.type === 'alimentacion'; }).length;
    const walksToday = todayEntries.filter(function (entry) { return entry.type === 'paseo'; }).length;
    const today = util.todayKey();
    const todayShifts = state.shifts
      .filter(function (shift) { return shift.petId === pet.id && shift.date === today; })
      .sort(function (a, b) { return a.time.localeCompare(b.time); });
    const shiftCapacity = todayShifts.reduce(function (sum, s) { return sum + s.capacity; }, 0);
    const shiftFilled = todayShifts.reduce(function (sum, s) { return sum + s.signups.length; }, 0);
    const healthInfo = healthSnapshot(health);
    const events = gatherEvents(state, pet, health);
    const pendingForPet = state.reports.filter(function (report) {
      return report.petId === pet.id && report.status === 'pendiente';
    });
    const recent = entries.slice(0, 4);
    const shiftType = data.SHIFT_TYPES;

    let heroActions = '';
    if (canStatus) {
      heroActions =
        '<button type="button" class="btn btn-on-dark" data-action="status">' + ui.icon('radio', 'h-4 w-4') + ' Actualizar estado</button>' +
        '<button type="button" class="btn bg-amber-300 text-amber-950 hover:bg-amber-200" data-action="feed">' + ui.icon('utensils', 'h-4 w-4') + ' Alimentar</button>' +
        '<button type="button" class="btn btn-dark-ghost" data-action="water">' + ui.icon('droplets', 'h-4 w-4') + ' Agua</button>' +
        '<button type="button" class="btn btn-dark-ghost" data-action="report">' + ui.icon('map-pin', 'h-4 w-4') + ' Reportar</button>';
    } else {
      heroActions =
        '<button type="button" class="btn btn-on-dark" data-action="report">' + ui.icon('map-pin', 'h-4 w-4') + ' Reportar avistamiento</button>' +
        '<a href="#/bitacora" class="btn btn-dark-ghost">' + ui.icon('notebook-pen', 'h-4 w-4') + ' Ver bitácora</a>';
    }

    const recentHtml = recent.length
      ? recent.map(function (entry) {
          const meta = PT.meta.entry(entry.type);
          const author = entry.by || 'Comunidad';
          return (
            '<div class="group flex items-start gap-3 rounded-xl px-1.5 py-2.5 transition hover:bg-stone-50/80">' +
              ui.entryIcon(entry.type) +
              '<div class="min-w-0 flex-1">' +
                '<div class="flex items-start justify-between gap-2">' +
                  '<p class="text-[0.82rem] font-extrabold leading-snug text-ink">' + util.esc(entry.title) + '</p>' +
                  '<span class="flex-none text-[0.62rem] font-bold text-ink/55">' + util.timeAgo(entry.at) + '</span>' +
                '</div>' +
                '<p class="mt-0.5 line-clamp-2 text-[0.72rem] font-semibold leading-snug text-ink/60">' + util.esc(entry.note) + '</p>' +
                '<p class="mt-1 flex items-center gap-1 text-[0.62rem] font-bold text-ink/55">' + ui.icon('user-round', 'h-3 w-3') + util.esc(author) + '</p>' +
              '</div>' +
              (entry.photo
                ? '<button type="button" class="photo-thumb h-12 w-12 flex-none" data-photo="' + util.esc(entry.photo) + '" data-photo-alt="' + util.esc(entry.title) + '" aria-label="Ampliar foto: ' + util.esc(entry.title) + '">' +
                    '<img src="' + util.esc(entry.photo) + '" alt="' + util.esc(entry.title) + '" loading="lazy">' +
                  '</button>'
                : '') +
            '</div>'
          );
        }).join('')
      : ui.emptyState({
          icon: 'notebook-pen',
          title: 'La bitácora está tranquila',
          text: 'Sé la primera persona en registrar un momento de hoy.',
          action: '<a href="#/bitacora" class="btn btn-sm btn-secondary mt-3">Abrir bitácora</a>'
        });

    const eventsHtml = events.length
      ? events.map(eventRow).join('')
      : ui.emptyState({
          icon: 'calendar-check',
          title: 'Sin eventos próximos',
          text: 'Cuando haya vacunas o turnos programados aparecerán aquí.'
        });

    const shiftsHtml = todayShifts.length
      ? todayShifts.map(function (shift) {
          const type = shiftType[shift.type] || shiftType.paseo;
          const t = ui.tone(type.tone);
          const full = shift.signups.length >= shift.capacity;
          const pct = shift.capacity ? Math.round((shift.signups.length / shift.capacity) * 100) : 0;
          return (
            '<div class="rounded-2xl border border-ink/[0.07] bg-white p-3">' +
              '<div class="flex items-center gap-2.5">' +
                '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl ' + t.ico + '">' + ui.icon(type.icon, 'h-4 w-4') + '</span>' +
                '<div class="min-w-0 flex-1">' +
                  '<p class="text-xs font-extrabold text-ink">' + util.esc(type.label) + ' · ' + util.esc(shift.time) + '</p>' +
                  '<p class="text-[0.65rem] font-bold text-ink/55">' + (full ? 'Turno completo' : (shift.capacity - shift.signups.length) + ' cupo(s) disponible(s)') + '</p>' +
                '</div>' +
                '<div class="flex -space-x-1.5">' +
                  shift.signups.slice(0, 3).map(function (person) { return ui.avatar(person.name, 'xs'); }).join('') +
                  (shift.signups.length > 3 ? '<span class="grid h-6 w-6 place-items-center rounded-full bg-stone-200 text-[0.55rem] font-extrabold text-ink/55">+' + (shift.signups.length - 3) + '</span>' : '') +
                '</div>' +
              '</div>' +
              '<div class="capacity-bar mt-2.5 ' + (full ? 'is-full' : '') + '"><span style="width:' + pct + '%"></span></div>' +
            '</div>'
          );
        }).join('')
      : ui.emptyState({
          icon: 'calendar-days',
          title: 'Hoy no hay turnos',
          text: 'La agenda está libre. Puedes revisar la semana completa.',
          action: '<a href="#/turnos" class="btn btn-sm btn-secondary mt-3">Ver calendario</a>'
        });

    const mapWsInfo = connectionMeta(activeMapFeedState);
    const mapWsTone = ui.tone(mapWsInfo.tone);
    const mapCard =
      '<section class="card reveal overflow-hidden" id="pet-map-card">' +
        '<div class="px-5 pb-3 pt-5">' +
          '<div class="flex flex-wrap items-start justify-between gap-3">' +
            '<div class="min-w-0">' +
              '<div class="flex flex-wrap items-center gap-2">' +
                '<h2 class="font-display text-lg font-semibold text-ink">Pedregal en vivo</h2>' +
                '<span class="chip-soft bg-white text-brand-700 ring-1 ring-brand-100">' + ui.icon('map-pin', 'h-3.5 w-3.5') + ' Medellín</span>' +
              '</div>' +
              '<p class="mt-0.5 text-xs font-semibold text-ink/60">Nube pasea por el barrio · Misha descansa en casa</p>' +
            '</div>' +
            '<div class="flex flex-none items-center gap-1.5">' +
              '<span id="map-ws-status" data-state="" class="chip-soft ' + mapWsTone.chip + '" role="status" aria-live="polite" title="Canal WebSocket simulado">' +
                '<span class="h-1.5 w-1.5 rounded-full ' + mapWsInfo.dot + '"></span>' + util.esc(mapWsInfo.label) +
              '</span>' +
              '<button type="button" class="btn-icon-sm btn-secondary" data-map-pause data-paused="' + activeMapFeedState.paused + '" aria-label="' + (activeMapFeedState.paused ? 'Reanudar seguimiento GPS' : 'Pausar seguimiento GPS') + '" title="' + (activeMapFeedState.paused ? 'Reanudar seguimiento GPS' : 'Pausar seguimiento GPS') + '">' +
                ui.icon(activeMapFeedState.paused ? 'play' : 'pause', 'h-4 w-4') +
              '</button>' +
            '</div>' +
          '</div>' +
        '</div>' +
        '<div class="px-4 sm:px-5">' +
          '<div class="relative">' +
            '<div id="pet-leaflet-map" class="pet-map" role="application" aria-label="Mapa real de Pedregal, Medellín. Misha está en casa y Nube pasea por el barrio."></div>' +
            '<div class="map-context-chip">' + ui.icon('map-pin', 'h-3.5 w-3.5') + ' Pedregal, Medellín</div>' +
            '<button type="button" class="map-fit-button" data-map-fit aria-label="Centrar mapa en Pedregal">' + ui.icon('maximize-2', 'h-3.5 w-3.5') + ' Centrar</button>' +
            '<div id="map-tile-warning" class="map-tile-warning hidden">' + ui.icon('wifi-off', 'h-3.5 w-3.5') + ' No se pudieron cargar las calles. Revisa la conexión.</div>' +
          '</div>' +
        '</div>' +
        '<div class="mt-3 grid gap-2 px-4 sm:grid-cols-2 sm:px-5">' +
          mapPetCard('misha', mapMishaPet, mishaFeedState, activeMapId === 'misha') +
          mapPetCard('nube', mapNubePet, nubeFeedState, activeMapId === 'nube') +
        '</div>' +
        '<div class="mt-3 border-t border-ink/[0.06] px-5 py-4">' + mapTelemetryMarkup(activeMapFeedState, activeMapId === 'misha' ? mapMishaPet : mapNubePet) + '</div>' +
      '</section>';

    const approvalsHtml = pendingForPet.length
      ? '<section class="card reveal p-5">' +
          '<div class="mb-3 flex items-center justify-between gap-2">' +
            '<div>' +
              '<h2 class="flex items-center gap-2 font-display text-lg font-semibold text-ink">' + ui.icon('shield-check', 'h-4 w-4 text-amber-500') + ' Reportes por aprobar</h2>' +
              '<p class="text-xs font-semibold text-ink/60">' + pendingForPet.length + ' esperando tu revisión</p>' +
            '</div>' +
            '<a href="#/admin" class="text-xs font-extrabold text-brand-700 hover:underline">Ver todos</a>' +
          '</div>' +
          '<div class="space-y-2.5">' + pendingForPet.slice(0, 2).map(function (report) { return reportRow(report, pet); }).join('') + '</div>' +
        '</section>'
      : '';

    root.innerHTML =
      '<div class="space-y-5">' +
        '<section class="pet-hero reveal rounded-[2rem] p-5 text-white shadow-soft sm:p-7">' +
          '<div class="relative z-10 flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">' +
            '<div class="flex items-start gap-4">' +
              '<div class="pet-avatar">' + pet.emoji + '</div>' +
              '<div class="min-w-0">' +
                '<div class="flex flex-wrap items-center gap-2">' +
                  '<h2 class="font-display text-3xl font-semibold leading-none tracking-tight sm:text-4xl">' + util.esc(pet.name) + '</h2>' +
                  '<span class="chip-soft bg-white/15 text-white ring-1 ring-white/25"><span class="h-1.5 w-1.5 rounded-full ' + statusTone.dot + '"></span>' + util.esc(status.label) + '</span>' +
                  '<span class="hidden items-center gap-1.5 text-[0.65rem] font-extrabold uppercase tracking-wide text-white/70 sm:flex"><span class="live-dot"></span> En vivo</span>' +
                '</div>' +
                '<p class="mt-1.5 text-[0.8rem] font-bold text-white/80">' + util.esc(pet.breed) + ' · ' + util.esc(pet.age) + ' · ' + util.esc(pet.sex) + '</p>' +
                '<div class="mt-3 flex flex-wrap items-center gap-1.5">' +
                  '<span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.7rem] font-extrabold ring-1 ring-inset ring-white/15">' + ui.icon('map-pin', 'h-3.5 w-3.5 text-white/70') + '<span id="hero-live-place">' + util.esc(zone.name) + '</span></span>' +
                  '<span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.7rem] font-bold ring-1 ring-inset ring-white/15">' + ui.icon('clock-3', 'h-3.5 w-3.5 text-white/70') + '<span id="hero-live-updated" data-relative="' + pet.status.at + '" data-relative-prefix="Actualizado">' + util.timeAgo(pet.status.at) + '</span></span>' +
                  '<span class="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-2.5 py-1 text-[0.7rem] font-bold ring-1 ring-inset ring-white/15">' + ui.icon('user-round', 'h-3.5 w-3.5 text-white/70') + util.esc(pet.status.by) + '</span>' +
                '</div>' +
                (pet.status.note ? '<p class="mt-2.5 max-w-xl text-[0.78rem] font-semibold leading-snug text-white/75">“' + util.esc(pet.status.note) + '”</p>' : '') +
              '</div>' +
            '</div>' +
            '<div class="hero-actions xl:max-w-[22rem] xl:justify-end">' + heroActions + '</div>' +
          '</div>' +
        '</section>' +

        '<div class="grid grid-cols-2 gap-3 sm:grid-cols-4">' +
          statCard('utensils', 'amber', String(mealsToday), 'Comidas hoy', mealsToday ? mealsToday + ' registrada(s)' : 'Sin registro') +
          statCard('footprints', 'sky', String(walksToday), 'Paseos hoy', walksToday ? 'Al aire libre' : 'Sin paseos') +
          statCard('hand-heart', 'violet', todayShifts.length ? shiftFilled + '/' + shiftCapacity : '—', 'Turnos hoy', todayShifts.length + ' programado(s)', 'text-xl') +
          statCard('heart-pulse', healthInfo.tone, healthInfo.label, 'Bienestar', healthInfo.meta, 'text-base leading-tight') +
        '</div>' +

        '<div class="grid gap-5 xl:grid-cols-3">' +
          '<div class="space-y-5 xl:col-span-2">' +
            mapCard +

            '<section class="card reveal p-5">' +
              '<div class="mb-2 flex items-center justify-between gap-2">' +
                '<div>' +
                  '<h2 class="font-display text-lg font-semibold text-ink">Actividad reciente</h2>' +
                  '<p class="text-xs font-semibold text-ink/60">Lo último de la bitácora de ' + util.esc(pet.name) + '</p>' +
                '</div>' +
                '<a href="#/bitacora" class="btn btn-sm btn-ghost">Ver toda ' + ui.icon('arrow-right', 'h-3.5 w-3.5') + '</a>' +
              '</div>' +
              '<div class="-mx-1.5 divide-y divide-ink/[0.05]">' + recentHtml + '</div>' +
            '</section>' +
          '</div>' +

          '<div class="space-y-5">' +
            '<section class="card reveal p-5">' +
              '<div class="mb-3 flex items-center justify-between gap-2">' +
                '<div>' +
                  '<h2 class="font-display text-lg font-semibold text-ink">Próximos eventos</h2>' +
                  '<p class="text-xs font-semibold text-ink/60">Salud y agenda de hoy en adelante</p>' +
                '</div>' +
                ui.icon('calendar-clock', 'h-5 w-5 text-brand-500/60') +
              '</div>' +
              '<div class="space-y-2">' + eventsHtml + '</div>' +
            '</section>' +

            '<section class="card reveal p-5">' +
              '<div class="mb-3 flex items-center justify-between gap-2">' +
                '<div>' +
                  '<h2 class="font-display text-lg font-semibold text-ink">Turnos de hoy</h2>' +
                  '<p class="text-xs font-semibold text-ink/60">' + util.fmtLongDate(new Date()) + '</p>' +
                '</div>' +
                '<a href="#/turnos" class="text-xs font-extrabold text-brand-700 hover:underline">Ver semana</a>' +
              '</div>' +
              '<div class="space-y-2.5">' + shiftsHtml + '</div>' +
            '</section>' +

            approvalsHtml +
          '</div>' +
        '</div>' +
      '</div>';

    root.addEventListener('click', function (event) {
      const action = event.target.closest('[data-action]');
      if (action) {
        const name = action.getAttribute('data-action');
        if (name === 'status') openStatusModal();
        if (name === 'feed') openFeedModal();
        if (name === 'water') registerWater();
        if (name === 'report') openReportModal();
        return;
      }

      const petCard = event.target.closest('[data-map-pet]');
      if (petCard) {
        selectMapPet(petCard.getAttribute('data-map-pet'));
        return;
      }

      const mapPause = event.target.closest('[data-map-pause]');
      if (mapPause) {
        activeMapFeed.setPaused(!activeMapFeed.getState().paused);
        ui.toast(activeMapFeed.getState().paused ? 'Seguimiento GPS pausado.' : 'Señal GPS reanudada.', 'info');
        return;
      }

      const mapReconnect = event.target.closest('[data-map-reconnect]');
      if (mapReconnect) {
        activeMapFeed.reconnect();
        ui.toast('Reconectando el collar GPS…', 'info');
        return;
      }

      const photo = event.target.closest('[data-photo]');
      if (photo) {
        ui.openPhoto(photo.getAttribute('data-photo'), photo.getAttribute('data-photo-alt'));
        return;
      }

      const approve = event.target.closest('[data-approve]');
      if (approve) {
        reviewReport(approve.getAttribute('data-approve'), true);
        return;
      }

      const reject = event.target.closest('[data-reject]');
      if (reject) {
        reviewReport(reject.getAttribute('data-reject'), false);
      }
    });

    PT.viewCleanup = cleanupPetMap;
    setupPetMap(activeMapId);
  };
})();
