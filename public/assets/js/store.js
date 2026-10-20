/* ==========================================================================
   PetTracker Escolar · estado, datos de ejemplo y persistencia
   ========================================================================== */
(function () {
  'use strict';

  const PT = (window.PT = window.PT || {});
  const STORAGE_KEY = 'pettracker-escolar:v1';
  const SCHEMA = 2;

  /* ------------------------------------------------------------------------
     Constantes de dominio
     ------------------------------------------------------------------------ */
  const STATUSES = {
    libre: {
      label: 'Libre', icon: 'sun', tone: 'emerald',
      desc: 'Paseando sin correa por una zona segura'
    },
    comiendo: {
      label: 'Comiendo', icon: 'utensils', tone: 'amber',
      desc: 'En su horario de alimentación'
    },
    durmiendo: {
      label: 'Durmiendo', icon: 'moon', tone: 'indigo',
      desc: 'Descansando, por favor no molestar'
    },
    paseo: {
      label: 'En paseo', icon: 'footprints', tone: 'sky',
      desc: 'Acompañada por un cuidador'
    },
    cita: {
      label: 'En cita médica', icon: 'stethoscope', tone: 'rose',
      desc: 'En control con la veterinaria'
    }
  };

  const ZONES = [
    { id: 'casa', name: 'Casa de Misha', icon: 'home', emoji: '🏠', hint: 'Calle 101C · Pedregal' },
    { id: 'pedregal', name: 'Barrio Pedregal', icon: 'map', emoji: '🏘️', hint: 'Medellín, Antioquia' },
    { id: 'parque', name: 'Parque del barrio', icon: 'trees', emoji: '🌳', hint: 'Zona verde de Pedregal' },
    { id: 'colegio', name: 'Colegio del barrio', icon: 'graduation-cap', emoji: '🏫', hint: 'Institución educativa' },
    { id: 'cancha', name: 'Cancha del barrio', icon: 'trophy', emoji: '⚽', hint: 'Cancha de Pedregal' },
    { id: 'tienda', name: 'Tienda de la esquina', icon: 'shopping-bag', emoji: '🏪', hint: 'Comercio del barrio' },
    { id: 'veterinaria', name: 'Veterinaria', icon: 'cross', emoji: '🩺', hint: 'Atención veterinaria' }
  ];

  const SHIFT_TYPES = {
    paseo: { label: 'Paseo', icon: 'footprints', tone: 'sky' },
    alimentacion: { label: 'Alimentación', icon: 'utensils', tone: 'amber' },
    limpieza: { label: 'Limpieza', icon: 'sparkles', tone: 'violet' }
  };

  const ENTRY_TYPES = {
    alimentacion: { label: 'Alimentación', short: 'Comida', icon: 'utensils', tone: 'amber' },
    agua: { label: 'Agua', short: 'Agua', icon: 'droplets', tone: 'sky' },
    paseo: { label: 'Paseo', short: 'Paseo', icon: 'footprints', tone: 'emerald' },
    salud: { label: 'Salud', short: 'Salud', icon: 'stethoscope', tone: 'rose' },
    limpieza: { label: 'Limpieza', short: 'Limpieza', icon: 'sparkles', tone: 'violet' },
    juego: { label: 'Juego', short: 'Juego', icon: 'party-popper', tone: 'orange' },
    nota: { label: 'Nota', short: 'Nota', icon: 'message-square', tone: 'slate' },
    foto: { label: 'Foto', short: 'Foto', icon: 'camera', tone: 'brand' },
    estado: { label: 'Estado', short: 'Estado', icon: 'radio', tone: 'emerald' },
    reporte: { label: 'Reporte', short: 'Reporte', icon: 'map-pin', tone: 'sky' }
  };

  const TONES = {
    emerald: {
      chip: 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200',
      ico: 'bg-emerald-100 text-emerald-700',
      solid: 'bg-emerald-500',
      text: 'text-emerald-700',
      dot: 'bg-emerald-500'
    },
    amber: {
      chip: 'bg-amber-50 text-amber-800 ring-1 ring-amber-200',
      ico: 'bg-amber-100 text-amber-700',
      solid: 'bg-amber-500',
      text: 'text-amber-700',
      dot: 'bg-amber-500'
    },
    sky: {
      chip: 'bg-sky-50 text-sky-700 ring-1 ring-sky-200',
      ico: 'bg-sky-100 text-sky-700',
      solid: 'bg-sky-500',
      text: 'text-sky-700',
      dot: 'bg-sky-500'
    },
    indigo: {
      chip: 'bg-indigo-50 text-indigo-700 ring-1 ring-indigo-200',
      ico: 'bg-indigo-100 text-indigo-700',
      solid: 'bg-indigo-500',
      text: 'text-indigo-700',
      dot: 'bg-indigo-500'
    },
    rose: {
      chip: 'bg-rose-50 text-rose-700 ring-1 ring-rose-200',
      ico: 'bg-rose-100 text-rose-700',
      solid: 'bg-rose-500',
      text: 'text-rose-700',
      dot: 'bg-rose-500'
    },
    violet: {
      chip: 'bg-violet-50 text-violet-700 ring-1 ring-violet-200',
      ico: 'bg-violet-100 text-violet-700',
      solid: 'bg-violet-500',
      text: 'text-violet-700',
      dot: 'bg-violet-500'
    },
    orange: {
      chip: 'bg-orange-50 text-orange-700 ring-1 ring-orange-200',
      ico: 'bg-orange-100 text-orange-700',
      solid: 'bg-orange-500',
      text: 'text-orange-700',
      dot: 'bg-orange-500'
    },
    slate: {
      chip: 'bg-stone-100 text-stone-700 ring-1 ring-stone-200',
      ico: 'bg-stone-100 text-stone-600',
      solid: 'bg-stone-500',
      text: 'text-stone-600',
      dot: 'bg-stone-500'
    },
    brand: {
      chip: 'bg-brand-50 text-brand-700 ring-1 ring-brand-200',
      ico: 'bg-brand-100 text-brand-700',
      solid: 'bg-brand-600',
      text: 'text-brand-700',
      dot: 'bg-brand-600'
    }
  };

  const ROLES = {
    estudiante: {
      id: 'estudiante',
      label: 'Estudiante',
      title: 'Estudiante / Visitante',
      defaultName: 'Ana Torres',
      detail: '10°B · Comunidad escolar',
      icon: 'graduation-cap',
      desc: 'Consulta el estado, participa en la bitácora y postúlate a turnos.',
      permissions: ['entry', 'report', 'shift']
    },
    cuidador: {
      id: 'cuidador',
      label: 'Cuidador',
      title: 'Cuidador / Líder',
      defaultName: 'Juan Pérez',
      detail: '11°A · Equipo de cuidado',
      icon: 'hand-heart',
      desc: 'Actualiza el estado en vivo, registra comidas, agua y fotos.',
      permissions: ['entry', 'report', 'shift', 'status', 'care']
    },
    admin: {
      id: 'admin',
      label: 'Administrador',
      title: 'Administrador / Docente',
      defaultName: 'Dra. Elena Ríos',
      detail: 'Veterinaria · Bienestar escolar',
      icon: 'shield-check',
      desc: 'Control total: salud, reportes y programación de turnos.',
      permissions: ['entry', 'report', 'shift', 'status', 'care', 'health', 'approve', 'manage']
    }
  };

  /* ------------------------------------------------------------------------
     Utilidades
     ------------------------------------------------------------------------ */
  const util = {
    uid(prefix) {
      const base = prefix || 'id';
      if (window.crypto && typeof window.crypto.randomUUID === 'function') {
        return base + '-' + window.crypto.randomUUID().slice(0, 8);
      }
      return base + '-' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
    },

    pad(n) {
      return String(n).padStart(2, '0');
    },

    dateKey(value) {
      const d = value instanceof Date ? value : new Date(value);
      return d.getFullYear() + '-' + util.pad(d.getMonth() + 1) + '-' + util.pad(d.getDate());
    },

    todayKey() {
      return util.dateKey(new Date());
    },

    addDays(value, amount) {
      const d = value instanceof Date ? new Date(value) : new Date(value);
      d.setDate(d.getDate() + amount);
      return d;
    },

    dateOnly(offset) {
      return util.dateKey(util.addDays(new Date(), offset || 0));
    },

    minutesAgo(minutes) {
      return new Date(Date.now() - minutes * 60000).toISOString();
    },

    startOfWeek(value) {
      const d = value ? util.asDate(value) : new Date();
      d.setHours(0, 0, 0, 0);
      const day = d.getDay();
      const diff = day === 0 ? -6 : 1 - day;
      d.setDate(d.getDate() + diff);
      return d;
    },

    weekDates(start) {
      const base = start || util.startOfWeek();
      return Array.from({ length: 7 }, function (_, i) {
        return util.addDays(base, i);
      });
    },

    asDate(value) {
      if (!value) return null;
      if (value.length === 10) return new Date(value + 'T12:00:00');
      return new Date(value);
    },

    daysUntil(value) {
      if (!value) return 9999;
      const target = util.asDate(value);
      target.setHours(0, 0, 0, 0);
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      return Math.round((target - today) / 86400000);
    },

    isToday(value) {
      if (!value) return false;
      return util.dateKey(value) === util.todayKey();
    },

    sameDay(value, dayKey) {
      if (!value) return false;
      return util.dateKey(value) === dayKey;
    },

    isFuture(value) {
      return value && new Date(value).getTime() > Date.now();
    },

    fmtDate(value, options) {
      const d = util.asDate(value);
      if (!d || Number.isNaN(d.getTime())) return '—';
      const opts = options || { day: 'numeric', month: 'short' };
      return new Intl.DateTimeFormat('es', opts).format(d);
    },

    fmtLongDate(value) {
      const label = util.fmtDate(value, { weekday: 'long', day: 'numeric', month: 'long' });
      return label ? label.charAt(0).toUpperCase() + label.slice(1) : label;
    },

    fmtTime(value) {
      const d = util.asDate(value);
      if (!d || Number.isNaN(d.getTime())) return '—';
      return new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' }).format(d);
    },

    weekdayShort(value) {
      return util.fmtDate(value, { weekday: 'short' }).replace('.', '');
    },

    timeAgo(value) {
      if (!value) return '—';
      const diff = (Date.now() - new Date(value).getTime()) / 60000;
      if (diff < -1) return util.relativeDays(util.dateKey(value));
      if (diff < 1) return 'ahora mismo';
      if (diff < 60) return 'hace ' + Math.round(diff) + ' min';
      if (diff < 1440) return 'hace ' + Math.round(diff / 60) + ' h';
      const days = Math.floor(diff / 1440);
      if (days === 1) return 'ayer';
      if (days < 7) return 'hace ' + days + ' días';
      return util.fmtDate(value);
    },

    relativeDays(value) {
      const days = util.daysUntil(value);
      if (days < -1) return 'Vencida hace ' + Math.abs(days) + ' días';
      if (days === -1) return 'Venció ayer';
      if (days === 0) return 'Es hoy';
      if (days === 1) return 'Mañana';
      if (days <= 7) return 'En ' + days + ' días';
      return util.fmtDate(value);
    },

    initials(name) {
      if (!name) return '?';
      return name
        .replace(/^(Dra?\.|Prof\.|Profe)\s+/i, '')
        .split(/\s+/)
        .filter(Boolean)
        .slice(0, 2)
        .map(function (part) { return part.charAt(0).toUpperCase(); })
        .join('');
    },

    esc(value) {
      return String(value == null ? '' : value)
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
    },

    clamp(n, min, max) {
      return Math.min(Math.max(n, min), max);
    }
  };

  function statusMeta(key) {
    return STATUSES[key] || STATUSES.libre;
  }

  function zoneMeta(id) {
    return ZONES.find(function (z) { return z.id === id; }) || ZONES[0];
  }

  function entryMeta(type) {
    return ENTRY_TYPES[type] || ENTRY_TYPES.nota;
  }

  function tone(name) {
    return TONES[name] || TONES.slate;
  }

  /* ------------------------------------------------------------------------
     Semilla de demostración
     ------------------------------------------------------------------------ */
  function seed() {
    const now = new Date();
    const monday = util.startOfWeek(now);
    const todayIdx = (now.getDay() + 6) % 7;

    function shift(petId, dayOffset, time, type, capacity, signups, note) {
      return {
        id: util.uid('shift'),
        petId: petId,
        date: util.dateKey(util.addDays(monday, dayOffset)),
        time: time,
        type: type,
        capacity: capacity,
        signups: signups || [],
        note: note || ''
      };
    }

    function entry(petId, type, title, note, by, role, minutes, photo) {
      return {
        id: util.uid('entry'),
        petId: petId,
        type: type,
        title: title,
        note: note,
        by: by,
        role: role,
        at: util.minutesAgo(minutes),
        photo: photo || null
      };
    }

    const ana = { name: 'Ana Torres', role: 'estudiante' };
    const juan = { name: 'Juan Pérez', role: 'cuidador' };
    const sofia = { name: 'Sofía Ramírez', role: 'estudiante' };
    const mateo = { name: 'Mateo Guzmán', role: 'estudiante' };

    const dogPhoto1 = 'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1000&q=72';
    const dogPhoto2 = 'https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1000&q=72';
    const catPhoto1 = 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1000&q=72';
    const catPhoto2 = 'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?auto=format&fit=crop&w=1000&q=72';

    return {
      schema: SCHEMA,
      createdAt: now.toISOString(),
      profile: {
        role: 'estudiante',
        name: ROLES.estudiante.defaultName
      },
      activePetId: 'nube',
      pets: [
        {
          id: 'nube',
          name: 'Nube',
          emoji: '🐶',
          species: 'perro',
          breed: 'Mestiza rescatada',
          age: '3 años',
          sex: 'Hembra',
          bio: 'Rescatada en 2023 cerca del colegio. Hoy es la compañera oficial de Pedregal y sale a caminar con el grado 11°.',
          status: {
            key: 'paseo',
            zone: 'pedregal',
            by: 'Juan Pérez',
            at: util.minutesAgo(18),
            note: 'Paseando por las calles de Pedregal con el grupo de 11°A'
          }
        },
        {
          id: 'misha',
          name: 'Misha',
          emoji: '🐱',
          species: 'gato',
          breed: 'Criolla de pelo corto',
          age: '2 años',
          sex: 'Hembra',
          bio: 'Adoptada por una familia de Pedregal. Es la guardiana de la casa en la Calle 101C y experta en siestas de tarde.',
          status: {
            key: 'durmiendo',
            zone: 'casa',
            by: 'Sofía Ramírez',
            at: util.minutesAgo(34),
            note: 'Descansando en casa, junto a la ventana de la Calle 101C'
          }
        }
      ],
      timeline: [
        entry('nube', 'paseo', 'Paseo de la tarde', 'Caminamos por la Calle 102 y la Carrera 74. Nube se encontró con el grupo de décimo y quedó feliz.', 'Juan Pérez', 'cuidador', 18, dogPhoto1),
        entry('misha', 'nota', 'Siesta en casa', 'Se acomodó en su cojín de siempre, junto a la ventana de la Calle 101C. Por favor, no hacer ruido.', 'Sofía Ramírez', 'estudiante', 34),
        entry('nube', 'agua', 'Agua fresca', 'Se cambió el agua del bebedero y se lavó el plato. Todo limpio.', 'Sofía Ramírez', 'estudiante', 95),
        entry('misha', 'alimentacion', 'Almuerzo felino', 'Media lata de atún en agua + croquetas. Comió con calma y dejó agua limpia.', 'Ana Torres', 'estudiante', 150),
        entry('nube', 'alimentacion', 'Almuerzo servido', 'Concentrado (1 taza) + pollo cocido sin hueso. Comió con buen apetito.', 'Juan Pérez', 'cuidador', 190),
        entry('nube', 'nota', 'Siesta en casa', 'Después del almuerzo se recostó bajo el árbol del patio de la casa. Muy tranquila.', 'Dra. Elena Ríos', 'admin', 260),
        entry('misha', 'agua', 'Agua renovada', 'Se limpió el bebedero y se rellenó con agua fresca.', 'Mateo Guzmán', 'estudiante', 300),
        entry('nube', 'foto', 'Tarde de juego', 'Unos minutos de juego con la pelota antes de clases. Energía al 100%.', 'Mateo Guzmán', 'estudiante', 1400, dogPhoto2),
        entry('misha', 'foto', 'Rincón favorito', 'Hoy eligió la ventana de la casa para observar la calle.', 'Sofía Ramírez', 'estudiante', 1500, catPhoto1),
        entry('nube', 'alimentacion', 'Desayuno', 'Croquetas y agua limpia. Todo bien.', 'Ana Torres', 'estudiante', 1560),
        entry('misha', 'juego', 'Juego con pluma', 'Veinte minutos de juego antes de la cena. Muy activa.', 'Ana Torres', 'estudiante', 1700, catPhoto2),
        entry('nube', 'salud', 'Control de peso', 'Control mensual: 13.1 kg. La veterinaria confirma que está en rango saludable.', 'Dra. Elena Ríos', 'admin', 2880),
        entry('misha', 'nota', 'Muy sociable hoy', 'Recibió a las visitas de la cuadra sin esconderse. Gran avance en su socialización.', 'Profe Camila', 'admin', 2900)
      ],
      health: {
        nube: {
          weights: [
            { id: util.uid('weight'), date: util.dateOnly(-150), kg: 12.4 },
            { id: util.uid('weight'), date: util.dateOnly(-120), kg: 12.6 },
            { id: util.uid('weight'), date: util.dateOnly(-90), kg: 12.7 },
            { id: util.uid('weight'), date: util.dateOnly(-60), kg: 12.9 },
            { id: util.uid('weight'), date: util.dateOnly(-30), kg: 13.0 },
            { id: util.uid('weight'), date: util.dateOnly(-2), kg: 13.1 }
          ],
          vaccines: [
            { id: util.uid('vac'), name: 'Antirrábica', last: util.dateOnly(-362), next: util.dateOnly(3), notes: 'Refuerzo anual obligatorio.' },
            { id: util.uid('vac'), name: 'Parvovirus + Distemper', last: util.dateOnly(-180), next: util.dateOnly(185), notes: '' },
            { id: util.uid('vac'), name: 'Bordetella', last: util.dateOnly(-300), next: util.dateOnly(65), notes: 'Tos de las perreras.' }
          ],
          dewormings: [
            { id: util.uid('dew'), name: 'Desparasitación interna', last: util.dateOnly(-85), next: util.dateOnly(5), notes: 'Peso actualizado antes de la dosis.' },
            { id: util.uid('dew'), name: 'Antipulgas y garrapatas', last: util.dateOnly(-70), next: util.dateOnly(20), notes: 'Bravecto masticable.' }
          ],
          meds: [
            { id: util.uid('med'), name: 'Bravecto', dose: '1 tableta masticable', frequency: 'Cada 12 semanas', start: util.dateOnly(-70), end: util.dateOnly(20), active: true, notes: 'Administrar con alimento.' },
            { id: util.uid('med'), name: 'Omega 3', dose: '1 cápsula', frequency: 'Diaria', start: util.dateOnly(-20), end: util.dateOnly(40), active: true, notes: 'Apoyo para piel y pelaje.' }
          ],
          allergies: 'Alergia a la picadura de pulga. Evitar snacks con colorantes artificiales.',
          vet: 'Dra. Elena Ríos · Veterinaria del barrio'
        },
        misha: {
          weights: [
            { id: util.uid('weight'), date: util.dateOnly(-150), kg: 4.1 },
            { id: util.uid('weight'), date: util.dateOnly(-120), kg: 4.2 },
            { id: util.uid('weight'), date: util.dateOnly(-90), kg: 4.35 },
            { id: util.uid('weight'), date: util.dateOnly(-60), kg: 4.4 },
            { id: util.uid('weight'), date: util.dateOnly(-30), kg: 4.52 },
            { id: util.uid('weight'), date: util.dateOnly(-3), kg: 4.6 }
          ],
          vaccines: [
            { id: util.uid('vac'), name: 'Triple felina', last: util.dateOnly(-345), next: util.dateOnly(20), notes: 'Refuerzo anual.' },
            { id: util.uid('vac'), name: 'Leucemia felina', last: util.dateOnly(-370), next: util.dateOnly(-5), notes: 'Requiere refuerzo.' },
            { id: util.uid('vac'), name: 'Antirrábica', last: util.dateOnly(-160), next: util.dateOnly(205), notes: '' }
          ],
          dewormings: [
            { id: util.uid('dew'), name: 'Desparasitación interna', last: util.dateOnly(-78), next: util.dateOnly(12), notes: '' },
            { id: util.uid('dew'), name: 'Protección contra pulgas', last: util.dateOnly(-92), next: util.dateOnly(-2), notes: 'Aplicar pipeta.' }
          ],
          meds: [
            { id: util.uid('med'), name: 'Suplemento renal', dose: '0.5 ml', frequency: 'Cada 24 horas', start: util.dateOnly(-10), end: util.dateOnly(50), active: true, notes: 'Mezclar con el alimento húmedo.' }
          ],
          allergies: 'Sensible a la lactosa. No dar leche de vaca ni derivados.',
          vet: 'Dra. Elena Ríos · Veterinaria del barrio'
        }
      },
      shifts: [
        shift('nube', 0, '07:30', 'alimentacion', 2, [ana, mateo], 'Desayuno y agua fresca.'),
        shift('nube', 0, '16:00', 'paseo', 2, [juan, sofia], 'Paseo por la Calle 102 y la Carrera 74.'),
        shift('nube', 1, '12:30', 'alimentacion', 2, [sofia], ''),
        shift('nube', 2, '16:00', 'paseo', 2, [mateo, ana], ''),
        shift('nube', 3, '07:30', 'alimentacion', 1, [juan], ''),
        shift('nube', 4, '16:00', 'paseo', 2, [sofia], 'Llevar la pelota azul.'),
        shift('nube', 5, '09:00', 'limpieza', 3, [ana, mateo], 'Lavar el bebedero y la cama.'),
        shift('nube', 6, '10:00', 'paseo', 2, [juan, sofia], 'Paseo corto de domingo.'),
        shift('nube', 6, '17:30', 'alimentacion', 2, [ana], 'Cena y revisión del plato de agua.'),
        shift('misha', 0, '08:00', 'alimentacion', 2, [sofia], ''),
        shift('misha', 1, '15:00', 'paseo', 2, [ana], 'Paseo corto con arnés por la cuadra.'),
        shift('misha', 2, '08:00', 'alimentacion', 2, [mateo], ''),
        shift('misha', 3, '15:00', 'limpieza', 2, [sofia, juan], 'Limpiar el arenero y la zona de descanso.'),
        shift('misha', 4, '08:00', 'alimentacion', 2, [ana], ''),
        shift('misha', 5, '15:00', 'paseo', 2, [mateo], ''),
        shift('misha', 6, '09:00', 'alimentacion', 2, [sofia], ''),
        shift('misha', 6, '18:00', 'alimentacion', 2, [], 'Cena ligera.')
      ],
      reports: [
        {
          id: util.uid('report'),
          petId: 'nube',
          zone: 'parque',
          note: 'Nube va caminando por el parque del barrio con los chicos de décimo. Se ve tranquila y con agua.',
          by: 'Ana Torres',
          role: 'estudiante',
          at: util.minutesAgo(25),
          status: 'pendiente'
        },
        {
          id: util.uid('report'),
          petId: 'misha',
          zone: 'casa',
          note: 'Misha está dormida en el techo de la casa de la Calle 101C. No la molesten, por favor.',
          by: 'Sofía Ramírez',
          role: 'estudiante',
          at: util.minutesAgo(58),
          status: 'pendiente'
        },
        {
          id: util.uid('report'),
          petId: 'nube',
          zone: 'cancha',
          note: 'La vi jugando cerca de la cancha del barrio con la pelota azul.',
          by: 'Mateo Guzmán',
          role: 'estudiante',
          at: util.minutesAgo(140),
          status: 'pendiente'
        },
        {
          id: util.uid('report'),
          petId: 'nube',
          zone: 'tienda',
          note: 'Se acercó a la tienda de la esquina cuando sonó el timbre del almuerzo.',
          by: 'Juan Pérez',
          role: 'cuidador',
          at: util.minutesAgo(1500),
          status: 'aprobado',
          reviewedBy: 'Dra. Elena Ríos',
          reviewedAt: util.minutesAgo(1480)
        }
      ]
    };
  }

  /* ------------------------------------------------------------------------
     Persistencia
     ------------------------------------------------------------------------ */
  let saveErrorHandler = null;
  let state = loadState();
  const listeners = [];

  function persist(candidate) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(candidate || state));
      return true;
    } catch (error) {
      if (typeof saveErrorHandler === 'function') saveErrorHandler(error);
      return false;
    }
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed && parsed.schema === SCHEMA && Array.isArray(parsed.pets) && parsed.pets.length) {
          return parsed;
        }
      }
    } catch (error) {
      /* Si el almacenamiento está lleno o corrupto, arrancamos con la semilla. */
    }
    const fresh = seed();
    persist(fresh);
    return fresh;
  }

  function emit() {
    listeners.forEach(function (listener) {
      try {
        listener(state);
      } catch (error) {
        console.error('PetTracker: error en un listener', error);
      }
    });
  }

  function clone(value) {
    if (typeof structuredClone === 'function') {
      return structuredClone(value);
    }
    return JSON.parse(JSON.stringify(value));
  }

  const store = {
    getState() {
      return state;
    },

    subscribe(listener) {
      listeners.push(listener);
      return function () {
        const index = listeners.indexOf(listener);
        if (index >= 0) listeners.splice(index, 1);
      };
    },

    update(mutator) {
      try {
        const draft = clone(state);
        const result = mutator(draft);
        if (result === false) return false;
        state = draft;
        persist(state);
        emit();
        return true;
      } catch (error) {
        console.error('PetTracker: no se pudo actualizar el estado', error);
        return false;
      }
    },

    currentPet() {
      return state.pets.find(function (p) { return p.id === state.activePetId; }) || state.pets[0];
    },

    currentHealth() {
      const pet = store.currentPet();
      return state.health[pet.id] || { weights: [], vaccines: [], dewormings: [], meds: [], allergies: '', vet: '' };
    },

    can(action) {
      const role = state.profile.role;
      const info = ROLES[role];
      return Boolean(info && info.permissions.indexOf(action) >= 0);
    },

    setProfile(role, name) {
      if (!ROLES[role]) return false;
      store.update(function (draft) {
        draft.profile.role = role;
        draft.profile.name = (name || ROLES[role].defaultName).trim() || ROLES[role].defaultName;
      });
      return true;
    },

    setPet(petId) {
      if (!state.pets.some(function (p) { return p.id === petId; })) return false;
      store.update(function (draft) {
        draft.activePetId = petId;
      });
      return true;
    },

    reset() {
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch (error) {
        /* noop */
      }
      state = seed();
      persist(state);
      emit();
    },

    reload() {
      state = loadState();
      emit();
    },

    onSaveError(handler) {
      saveErrorHandler = handler;
    },

    roleInfo() {
      return ROLES[state.profile.role] || ROLES.estudiante;
    },

    pendingReports() {
      return state.reports.filter(function (r) { return r.status === 'pendiente'; });
    },

    pendingReportsFor(petId) {
      return store.pendingReports().filter(function (r) { return r.petId === petId; });
    }
  };

  PT.store = store;
  PT.data = {
    STATUSES: STATUSES,
    ZONES: ZONES,
    SHIFT_TYPES: SHIFT_TYPES,
    ENTRY_TYPES: ENTRY_TYPES,
    TONES: TONES,
    ROLES: ROLES
  };
  PT.util = util;
  PT.meta = {
    status: statusMeta,
    zone: zoneMeta,
    entry: entryMeta,
    tone: tone
  };
})();
