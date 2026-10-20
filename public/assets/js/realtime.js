/* ==========================================================================
   PetTracker Escolar · seguimiento real en Pedregal, Medellín
   --------------------------------------------------------------------------
   Simula el WebSocket del collar GPS. Misha está en casa (posición fija) y
   Nube camina por una ruta real del barrio Pedregal, interpolando posición
   entre puntos para que el marcador se mueva de forma continua.
   ========================================================================== */
(function () {
  'use strict';

  const PT = (window.PT = window.PT || {});

  const AREA = 'Barrio Pedregal, Medellín';
  const HOME = {
    lat: 6.29965,
    lng: -75.57525,
    label: 'Calle 101C · Casa'
  };

  /* Ruta caminable real (OpenStreetMap/OSRM) por Pedregal. [lat, lng] */
  const NUBE_ROUTE = [
    [6.299905, -75.574846], [6.300121, -75.574712], [6.300046, -75.574588],
    [6.300433, -75.574373], [6.300385, -75.574173], [6.300269, -75.573936],
    [6.300166, -75.573723], [6.300137, -75.573659], [6.300165, -75.573598],
    [6.300174, -75.573574], [6.300373, -75.573176], [6.300592, -75.572817],
    [6.300649, -75.572739], [6.300704, -75.572687], [6.300931, -75.572552],
    [6.300704, -75.572687], [6.300649, -75.572739], [6.300393, -75.572242],
    [6.300127, -75.571729], [6.29974, -75.571906], [6.299344, -75.571109],
    [6.299307, -75.571234], [6.2993, -75.571319], [6.299301, -75.571389],
    [6.299311, -75.571439], [6.299435, -75.572084], [6.299448, -75.572183],
    [6.29944, -75.572227], [6.299417, -75.572286], [6.299113, -75.572547],
    [6.298807, -75.572844], [6.29876, -75.572873], [6.298684, -75.572912],
    [6.298639, -75.572925], [6.298577, -75.572906], [6.298356, -75.572798],
    [6.298235, -75.573179], [6.298136, -75.573494], [6.29838, -75.573574],
    [6.298488, -75.573756], [6.298658, -75.574046], [6.299223, -75.575004],
    [6.299488, -75.574829], [6.299535, -75.574776], [6.299578, -75.574716],
    [6.299727, -75.574956], [6.299905, -75.574846]
  ];

  /* Nombres de vías según los tramos reales de la ruta (metros). */
  const STREETS = [
    { from: 0, to: 28, name: 'Carrera 74A' },
    { from: 28, to: 44, name: 'Calle 102' },
    { from: 44, to: 93, name: 'Carrera 74A' },
    { from: 93, to: 179, name: 'Calle 102B' },
    { from: 179, to: 371, name: 'Carrera 74' },
    { from: 371, to: 497, name: 'Calle 103C' },
    { from: 497, to: 544, name: 'Carrera 72' },
    { from: 544, to: 642, name: 'Calle 103' },
    { from: 642, to: 775, name: 'Calle 102B' },
    { from: 775, to: 888, name: 'Carrera 72' },
    { from: 888, to: 1003, name: 'Calle 101B' },
    { from: 1003, to: 1215, name: 'Calle 101B' },
    { from: 1215, to: 1266, name: 'Carrera 74' },
    { from: 1266, to: 1297, name: 'Calle 101C' },
    { from: 1297, to: 100000, name: 'Carrera 74A' }
  ];

  const WALK_SPEED_MPS = 2.8;       // Ritmo visible de paseo (aprox. 10 km/h)
  const WALK_TICK_MS = 650;         // Paquetes GPS frecuentes y suaves
  const HOME_TICK_MS = 5000;        // Latido del collar de Misha (sin moverse)
  const INITIAL_WALK_METERS = 180;  // Nube ya lleva un tramo caminado al abrir

  function toRad(value) {
    return (value * Math.PI) / 180;
  }

  function haversine(a, b) {
    const earth = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
    return 2 * earth * Math.asin(Math.sqrt(h));
  }

  const routePoints = NUBE_ROUTE.map(function (point, index) {
    return {
      index: index,
      lat: point[0],
      lng: point[1]
    };
  });

  const cumulative = [0];
  for (let i = 1; i < routePoints.length; i += 1) {
    cumulative[i] = cumulative[i - 1] + haversine(routePoints[i - 1], routePoints[i]);
  }
  const ROUTE_DISTANCE = cumulative[cumulative.length - 1];

  function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
  }

  function streetFor(distance) {
    const d = ((distance % ROUTE_DISTANCE) + ROUTE_DISTANCE) % ROUTE_DISTANCE;
    for (let i = 0; i < STREETS.length; i += 1) {
      if (d >= STREETS[i].from && d < STREETS[i].to) return STREETS[i].name;
    }
    return STREETS[0].name;
  }

  function positionAt(distance) {
    const d = ((distance % ROUTE_DISTANCE) + ROUTE_DISTANCE) % ROUTE_DISTANCE;
    let segment = 0;
    for (let i = 1; i < cumulative.length; i += 1) {
      if (cumulative[i] >= d) {
        segment = i - 1;
        break;
      }
    }
    const start = routePoints[segment];
    const end = routePoints[segment + 1] || routePoints[0];
    const segmentLength = Math.max(0.0001, cumulative[segment + 1] - cumulative[segment]);
    const ratio = clamp((d - cumulative[segment]) / segmentLength, 0, 1);
    return {
      lat: start.lat + (end.lat - start.lat) * ratio,
      lng: start.lng + (end.lng - start.lng) * ratio,
      place: streetFor(d)
    };
  }

  function routeTrail(distance) {
    const d = clamp(distance, 0, ROUTE_DISTANCE);
    const points = [];
    for (let i = 0; i < routePoints.length; i += 1) {
      if (cumulative[i] <= d) points.push([routePoints[i].lat, routePoints[i].lng]);
      else break;
    }
    const current = positionAt(d);
    points.push([current.lat, current.lng]);
    return points;
  }

  class SimulatedCollarSocket {
    constructor(petId) {
      this.petId = petId;
      this.mode = petId === 'misha' ? 'home' : 'walk';
      this.listeners = new Set();
      this.timer = null;
      this.connectTimer = null;
      this.reconnectTimer = null;
      this.lastTick = Date.now();
      this.progress = this.mode === 'walk' ? INITIAL_WALK_METERS : 0;
      this.battery = this.mode === 'home' ? 93 : 84;

      const position = this.mode === 'walk' ? positionAt(this.progress) : HOME;
      const place = this.mode === 'walk' ? position.place : HOME.label;

      this.state = {
        petId: petId,
        mode: this.mode,
        status: 'connecting',
        paused: false,
        seq: 0,
        position: {
          lat: position.lat,
          lng: position.lng
        },
        place: place,
        area: AREA,
        accuracy: this.mode === 'home' ? 4 : 6,
        battery: this.battery,
        rssi: this.mode === 'home' ? -52 : -63,
        speedMps: this.mode === 'home' ? 0 : WALK_SPEED_MPS,
        speedKmh: this.mode === 'home' ? 0 : WALK_SPEED_MPS * 3.6,
        progressMeters: this.mode === 'walk' ? this.progress : 0,
        routeDistanceMeters: this.mode === 'walk' ? ROUTE_DISTANCE : 0,
        updatedAt: null,
        socketUrl: 'wss://collar.pettracker.demo/medellin/' + petId,
        source: 'collar-GPS'
      };

      this.start();
    }

    getState() {
      return this.state;
    }

    subscribe(listener) {
      this.listeners.add(listener);
      try {
        listener(this.state);
      } catch (error) {
        console.error('PetTracker realtime: error en subscriber', error);
      }
      return () => this.listeners.delete(listener);
    }

    emit() {
      Array.from(this.listeners).forEach((listener) => {
        try {
          listener(this.state);
        } catch (error) {
          console.error('PetTracker realtime: error al emitir', error);
        }
      });
    }

    start() {
      clearTimeout(this.connectTimer);
      this.state.status = 'connecting';
      this.emit();

      this.connectTimer = window.setTimeout(() => {
        this.state.status = 'online';
        this.state.updatedAt = new Date().toISOString();
        this.emit();
        this.startTicker();
      }, 700 + Math.random() * 500);
    }

    startTicker() {
      clearInterval(this.timer);
      this.lastTick = Date.now();

      if (this.mode === 'home') {
        this.timer = window.setInterval(() => this.heartbeat(), HOME_TICK_MS);
      } else {
        this.timer = window.setInterval(() => this.tick(), WALK_TICK_MS);
        window.setTimeout(() => this.tick(), 300);
      }
    }

    tick() {
      if (this.state.status !== 'online' || this.state.paused) return;

      const now = Date.now();
      const deltaSeconds = clamp((now - this.lastTick) / 1000, 0.1, 2.2);
      this.lastTick = now;

      this.progress = (this.progress + WALK_SPEED_MPS * deltaSeconds) % ROUTE_DISTANCE;
      const position = positionAt(this.progress);

      this.state.position = { lat: position.lat, lng: position.lng };
      this.state.place = position.place;
      this.state.progressMeters = this.progress;
      this.state.speedMps = WALK_SPEED_MPS;
      this.state.speedKmh = WALK_SPEED_MPS * 3.6;
      this.state.accuracy = Math.round(3 + Math.random() * 6);
      this.state.rssi = -55 - Math.floor(Math.random() * 18);
      this.state.updatedAt = new Date().toISOString();
      this.state.seq += 1;

      if (this.state.seq % 70 === 0) {
        this.battery = Math.max(15, this.battery - 1);
        this.state.battery = this.battery;
      }

      this.emit();
    }

    heartbeat() {
      if (this.state.status !== 'online' || this.state.paused) return;
      this.state.updatedAt = new Date().toISOString();
      this.state.seq += 1;
      this.state.accuracy = Math.round(3 + Math.random() * 4);
      this.state.rssi = -48 - Math.floor(Math.random() * 10);
      this.emit();
    }

    setPaused(paused) {
      const wasPaused = this.state.paused;
      this.state.paused = Boolean(paused);
      if (wasPaused && !this.state.paused) this.lastTick = Date.now();
      this.emit();
    }

    reconnect() {
      if (this.state.status === 'reconnecting') return;
      clearInterval(this.timer);
      clearTimeout(this.connectTimer);
      this.state.status = 'reconnecting';
      this.emit();

      this.reconnectTimer = window.setTimeout(() => {
        this.state.status = 'online';
        this.state.seq += 1;
        this.state.updatedAt = new Date().toISOString();
        this.state.rssi = -52 - Math.floor(Math.random() * 10);
        this.emit();
        this.startTicker();
      }, 1500);
    }
  }

  const feeds = new Map();

  function getFeed(petId) {
    if (!feeds.has(petId)) {
      feeds.set(petId, new SimulatedCollarSocket(petId));
    }
    return feeds.get(petId);
  }

  function existingFeed(petId) {
    return feeds.get(petId) || null;
  }

  PT.realtime = {
    HOME: HOME,
    AREA: AREA,
    NUBE_ROUTE: routePoints.map(function (point) { return [point.lat, point.lng]; }),
    ROUTE_DISTANCE: ROUTE_DISTANCE,
    getFeed: getFeed,
    existingFeed: existingFeed,
    routeTrail: routeTrail,
    positionAt: positionAt
  };
})();
