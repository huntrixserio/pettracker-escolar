/* ==========================================================================
   Vista · Bitácora y línea de tiempo
   ========================================================================== */
(function () {
  'use strict';

  const PT = window.PT;
  const store = PT.store;
  const ui = PT.ui;
  const util = PT.util;
  const data = PT.data;

  let dateFilter = 'today';
  let typeFilter = 'all';

  const DATE_FILTERS = [
    { id: 'today', label: 'Hoy' },
    { id: 'yesterday', label: 'Ayer' },
    { id: 'week', label: 'Últimos 7 días' },
    { id: 'all', label: 'Todo' }
  ];

  const TYPE_FILTERS = [
    { id: 'all', label: 'Todo', icon: 'list-filter' },
    { id: 'alimentacion', label: 'Comida', icon: 'utensils' },
    { id: 'agua', label: 'Agua', icon: 'droplets' },
    { id: 'paseo', label: 'Paseo', icon: 'footprints' },
    { id: 'salud', label: 'Salud', icon: 'stethoscope' },
    { id: 'nota', label: 'Notas', icon: 'message-square' },
    { id: 'foto', label: 'Fotos', icon: 'camera' }
  ];

  function composerTypes() {
    if (store.can('manage')) {
      return ['alimentacion', 'agua', 'paseo', 'juego', 'limpieza', 'salud', 'nota', 'foto'];
    }
    if (store.can('care')) {
      return ['alimentacion', 'agua', 'paseo', 'juego', 'limpieza', 'nota', 'foto'];
    }
    return ['nota', 'foto'];
  }

  function entriesForPet(state, petId) {
    return state.timeline
      .filter(function (entry) { return entry.petId === petId; })
      .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
  }

  function matchesDate(entry) {
    if (dateFilter === 'all') return true;
    const key = util.dateKey(entry.at);
    if (dateFilter === 'today') return key === util.todayKey();
    if (dateFilter === 'yesterday') return key === util.dateOnly(-1);
    if (dateFilter === 'week') return new Date(entry.at) >= util.startOfWeek();
    return true;
  }

  function matchesType(entry) {
    return typeFilter === 'all' || entry.type === typeFilter;
  }

  function titleForType(type) {
    const titles = {
      alimentacion: 'Alimentación registrada',
      agua: 'Agua renovada',
      paseo: 'Paseo registrado',
      salud: 'Observación de salud',
      limpieza: 'Limpieza registrada',
      juego: 'Tiempo de juego',
      nota: 'Nota de la comunidad',
      foto: 'Foto del día'
    };
    return titles[type] || 'Nueva entrada';
  }

  function displayDay(key) {
    if (key === util.todayKey()) return 'Hoy';
    if (key === util.dateOnly(-1)) return 'Ayer';
    const label = util.fmtDate(key, { weekday: 'long', day: 'numeric', month: 'long' });
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function roleLabel(roleId) {
    const role = data.ROLES[roleId];
    return role ? role.label : 'Comunidad';
  }

  function entryCard(entry, profile) {
    const meta = PT.meta.entry(entry.type);
    const canDelete = store.can('manage') || entry.by === profile.name;
    const role = roleLabel(entry.role);
    const typeChipTone = meta.tone;

    return (
      '<article class="group relative flex gap-3 rounded-2xl border border-ink/[0.06] bg-white p-3.5 transition hover:border-brand-200/70 hover:shadow-card sm:p-4">' +
        ui.entryIcon(entry.type) +
        '<div class="min-w-0 flex-1">' +
          '<div class="flex flex-wrap items-start justify-between gap-2">' +
            '<div class="min-w-0">' +
              '<div class="flex flex-wrap items-center gap-1.5">' +
                '<h3 class="text-[0.88rem] font-extrabold leading-snug text-ink">' + util.esc(entry.title) + '</h3>' +
                ui.badge(meta.short, typeChipTone) +
              '</div>' +
              '<p class="mt-1.5 whitespace-pre-line text-[0.8rem] font-semibold leading-relaxed text-ink/60">' + util.esc(entry.note) + '</p>' +
            '</div>' +
            '<div class="flex flex-none items-center gap-1">' +
              '<time class="text-[0.62rem] font-bold text-ink/55" datetime="' + util.esc(entry.at) + '" data-relative="' + util.esc(entry.at) + '">' + util.timeAgo(entry.at) + '</time>' +
              (canDelete
                ? '<button type="button" class="btn-icon-sm btn-ghost text-ink/25 opacity-100 hover:text-rose-600 sm:opacity-0 sm:group-hover:opacity-100" data-delete-entry="' + util.esc(entry.id) + '" aria-label="Eliminar entrada: ' + util.esc(entry.title) + '">' + ui.icon('trash-2', 'h-3.5 w-3.5') + '</button>'
                : '') +
            '</div>' +
          '</div>' +
          (entry.photo
            ? '<button type="button" class="photo-thumb mt-3 block max-h-64 w-full max-w-md" data-photo="' + util.esc(entry.photo) + '" data-photo-alt="' + util.esc(entry.title) + '" aria-label="Ampliar foto: ' + util.esc(entry.title) + '">' +
                '<img src="' + util.esc(entry.photo) + '" alt="' + util.esc(entry.title) + '" loading="lazy" class="max-h-64 w-full object-cover">' +
              '</button>'
            : '') +
          '<div class="mt-3 flex items-center gap-2">' +
            ui.avatar(entry.by, 'xs') +
            '<span class="text-[0.68rem] font-extrabold text-ink/55">' + util.esc(entry.by) + '</span>' +
            '<span class="text-[0.62rem] font-bold text-ink/30">· ' + util.esc(role) + '</span>' +
          '</div>' +
        '</div>' +
      '</article>'
    );
  }

  function groupEntries(entries) {
    const groups = [];
    const index = {};
    entries.forEach(function (entry) {
      const key = util.dateKey(entry.at);
      if (!index[key]) {
        index[key] = { key: key, entries: [] };
        groups.push(index[key]);
      }
      index[key].entries.push(entry);
    });
    return groups;
  }

  PT.views = PT.views || {};

  PT.views.bitacora = function (root) {
    const state = store.getState();
    const pet = store.currentPet();
    const profile = state.profile;
    const allEntries = entriesForPet(state, pet.id);
    const todayEntries = allEntries.filter(function (entry) { return util.isToday(entry.at); });
    const photosTotal = allEntries.filter(function (entry) { return entry.photo; }).length;
    const filtered = allEntries.filter(function (entry) {
      return matchesDate(entry) && matchesType(entry);
    });
    const groups = groupEntries(filtered);
    const types = composerTypes();
    const defaultType = types.indexOf('nota') >= 0 ? 'nota' : types[0];
    const allowedTypes = types.map(function (typeId) {
      const meta = PT.meta.entry(typeId);
      return (
        '<label class="type-option relative">' +
          '<input type="radio" name="type" value="' + typeId + '" ' + (typeId === defaultType ? 'checked' : '') + '>' +
          '<span>' + ui.icon(meta.icon, 'h-3.5 w-3.5') + util.esc(meta.short) + '</span>' +
        '</label>'
      );
    }).join('');

    const composerCopy = store.can('care')
      ? 'Registra un cuidado, comparte una foto o deja una nota.'
      : 'Comparte lo que observaste de ' + pet.name + ' hoy.';

    const dateChips = DATE_FILTERS.map(function (filter) {
      return '<button type="button" class="chip ' + (dateFilter === filter.id ? 'is-active' : '') + '" data-filter-date="' + filter.id + '" aria-pressed="' + (dateFilter === filter.id) + '">' + filter.label + '</button>';
    }).join('');

    const typeChips = TYPE_FILTERS.map(function (filter) {
      return '<button type="button" class="chip ' + (typeFilter === filter.id ? 'is-active' : '') + '" data-filter-type="' + filter.id + '" aria-pressed="' + (typeFilter === filter.id) + '">' + ui.icon(filter.icon, 'h-3.5 w-3.5') + filter.label + '</button>';
    }).join('');

    const feedHtml = groups.length
      ? groups.map(function (group) {
          return (
            '<section>' +
              '<div class="mb-2.5 flex items-center gap-2 px-1">' +
                '<h2 class="font-display text-base font-semibold text-ink">' + util.esc(displayDay(group.key)) + '</h2>' +
                '<span class="h-px flex-1 bg-ink/[0.06]"></span>' +
                '<span class="text-[0.65rem] font-extrabold uppercase tracking-wide text-ink/30">' + group.entries.length + ' entrada(s)</span>' +
              '</div>' +
              '<div class="space-y-2.5">' + group.entries.map(function (entry) { return entryCard(entry, profile); }).join('') + '</div>' +
            '</section>'
          );
        }).join('')
      : ui.emptyState({
          icon: 'search-x',
          title: 'No hay entradas con estos filtros',
          text: 'Prueba con otro rango de fechas o vuelve a ver toda la bitácora.',
          action: '<button type="button" class="btn btn-sm btn-secondary mt-3" data-clear-filters>Limpiar filtros</button>'
        });

    root.innerHTML =
      '<div class="space-y-5">' +
        '<section class="card-tinted reveal relative overflow-hidden p-5 sm:p-6">' +
          '<div class="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">' +
            '<div class="flex items-start gap-3.5">' +
              '<span class="grid h-14 w-14 flex-none place-items-center rounded-2xl bg-white text-3xl shadow-sm">' + pet.emoji + '</span>' +
              '<div>' +
                '<p class="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-brand-600/70">La historia de ' + util.esc(pet.name) + '</p>' +
                '<h2 class="mt-0.5 font-display text-2xl font-semibold leading-tight text-ink">Cuidado escrito entre todos</h2>' +
                '<p class="mt-1 max-w-lg text-xs font-semibold leading-relaxed text-ink/60">Cada registro deja huella. La bitácora es pública para toda la comunidad escolar.</p>' +
              '</div>' +
            '</div>' +
            '<div class="flex flex-wrap gap-2">' +
              '<span class="rounded-xl bg-white/80 px-3 py-2 text-center ring-1 ring-ink/[0.06]"><span class="block font-display text-lg font-semibold leading-none text-ink">' + todayEntries.length + '</span><span class="mt-1 block text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Hoy</span></span>' +
              '<span class="rounded-xl bg-white/80 px-3 py-2 text-center ring-1 ring-ink/[0.06]"><span class="block font-display text-lg font-semibold leading-none text-ink">' + photosTotal + '</span><span class="mt-1 block text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Fotos</span></span>' +
              '<span class="rounded-xl bg-white/80 px-3 py-2 text-center ring-1 ring-ink/[0.06]"><span class="block font-display text-lg font-semibold leading-none text-ink">' + allEntries.length + '</span><span class="mt-1 block text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Total</span></span>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<section class="card reveal p-4 sm:p-5" aria-labelledby="composer-title">' +
          '<div class="flex items-start gap-3">' +
            ui.avatar(profile.name, 'md') +
            '<div class="min-w-0 flex-1">' +
              '<h2 id="composer-title" class="font-display text-base font-semibold text-ink">¿Qué está pasando con ' + util.esc(pet.name) + '?</h2>' +
              '<p class="text-[0.7rem] font-semibold text-ink/60">' + util.esc(composerCopy) + '</p>' +
            '</div>' +
          '</div>' +
          '<form id="entry-form" class="mt-4 space-y-3" novalidate>' +
            '<div class="segmented" role="radiogroup" aria-label="Tipo de entrada">' + allowedTypes + '</div>' +
            '<div>' +
              '<label class="sr-only" for="entry-note">Mensaje de la bitácora</label>' +
              '<textarea class="field" id="entry-note" name="note" maxlength="280" rows="3" placeholder="Escribe una nota corta, una observación o cuéntanos qué hizo ' + util.esc(pet.name) + '…"></textarea>' +
              '<div class="mt-1 flex items-center justify-between text-[0.65rem] font-bold text-ink/55">' +
                '<span>Máximo 280 caracteres</span>' +
                '<span id="note-count">0/280</span>' +
              '</div>' +
            '</div>' +
            '<div class="flex flex-wrap items-center gap-2">' +
              '<input type="file" id="entry-photo" class="sr-only" accept="image/*">' +
              '<label for="entry-photo" class="btn btn-sm btn-secondary cursor-pointer">' + ui.icon('camera', 'h-4 w-4') + ' Añadir foto</label>' +
              '<span class="text-[0.65rem] font-semibold text-ink/55">JPG, PNG o WebP · máx. 8 MB</span>' +
              '<button type="submit" class="btn btn-sm btn-primary ml-auto">' + ui.icon('send', 'h-3.5 w-3.5') + ' Publicar</button>' +
            '</div>' +
            '<div id="photo-preview" class="hidden items-center gap-2 rounded-xl border border-ink/10 bg-stone-50 p-2">' +
              '<img id="photo-preview-img" alt="Vista previa de la foto" class="h-14 w-14 rounded-lg object-cover">' +
              '<div class="min-w-0 flex-1"><p id="photo-name" class="truncate text-xs font-extrabold text-ink/70">Foto lista</p><p class="text-[0.65rem] font-semibold text-ink/55">Se comprimirá al publicar</p></div>' +
              '<button type="button" class="btn-icon-sm btn-ghost" id="remove-photo" aria-label="Quitar foto">' + ui.icon('x', 'h-4 w-4') + '</button>' +
            '</div>' +
          '</form>' +
        '</section>' +

        '<section class="reveal" aria-labelledby="feed-title">' +
          '<div class="mb-3 flex flex-wrap items-center justify-between gap-2">' +
            '<h2 id="feed-title" class="font-display text-lg font-semibold text-ink">Línea de tiempo</h2>' +
            '<span class="text-[0.68rem] font-bold text-ink/55">' + filtered.length + ' resultado(s)</span>' +
          '</div>' +
          '<div class="space-y-2.5">' +
            '<div class="segmented" aria-label="Filtrar por fecha">' + dateChips + '</div>' +
            '<div class="segmented" aria-label="Filtrar por tipo">' + typeChips + '</div>' +
          '</div>' +
          '<div class="mt-4 space-y-5">' + feedHtml + '</div>' +
        '</section>' +
      '</div>';

    const form = root.querySelector('#entry-form');
    const textarea = root.querySelector('#entry-note');
    const count = root.querySelector('#note-count');
    const photoInput = root.querySelector('#entry-photo');
    const preview = root.querySelector('#photo-preview');
    const previewImg = root.querySelector('#photo-preview-img');
    const photoName = root.querySelector('#photo-name');
    let selectedFile = null;
    let previewUrl = null;

    function clearPhoto() {
      selectedFile = null;
      photoInput.value = '';
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = null;
      preview.classList.add('hidden');
      preview.classList.remove('flex');
      previewImg.removeAttribute('src');
    }

    textarea.addEventListener('input', function () {
      count.textContent = textarea.value.length + '/280';
    });

    photoInput.addEventListener('change', function () {
      const file = photoInput.files && photoInput.files[0];
      if (!file) return;
      if (!file.type.startsWith('image/')) {
        ui.toast('Selecciona un archivo de imagen válido.', 'error');
        photoInput.value = '';
        return;
      }
      if (file.size > 8 * 1024 * 1024) {
        ui.toast('La imagen supera los 8 MB. Elige una más liviana.', 'error');
        photoInput.value = '';
        return;
      }
      selectedFile = file;
      if (previewUrl) URL.revokeObjectURL(previewUrl);
      previewUrl = URL.createObjectURL(file);
      previewImg.src = previewUrl;
      photoName.textContent = file.name;
      preview.classList.remove('hidden');
      preview.classList.add('flex');
    });

    root.querySelector('#remove-photo').addEventListener('click', clearPhoto);

    form.addEventListener('submit', async function (event) {
      event.preventDefault();
      const button = form.querySelector('button[type="submit"]');
      const fd = new FormData(form);
      const type = (fd.get('type') || defaultType).toString();
      const note = (fd.get('note') || '').toString().trim();

      if (!note && !selectedFile) {
        ui.toast('Escribe una nota o añade una foto para publicar.', 'error');
        textarea.focus();
        return;
      }

      ui.setLoading(button, true, 'Publicando…');
      try {
        const photo = selectedFile ? await ui.readImage(selectedFile) : null;
        if (previewUrl) {
          URL.revokeObjectURL(previewUrl);
          previewUrl = null;
        }
        const currentProfile = store.getState().profile;
        const now = new Date().toISOString();
        const finalNote = note || 'Una imagen para recordar este momento de ' + pet.name + '.';
        store.update(function (draft) {
          draft.timeline.unshift({
            id: util.uid('entry'),
            petId: pet.id,
            type: type,
            title: titleForType(type),
            note: finalNote,
            by: currentProfile.name,
            role: currentProfile.role,
            at: now,
            photo: photo
          });
        });
        ui.toast('Entrada publicada en la bitácora.', 'success', {
          detail: photo ? 'La foto se guardó en este dispositivo.' : 'La comunidad ya puede verla.'
        });
      } catch (error) {
        ui.toast(error.message || 'No se pudo procesar la imagen.', 'error');
        ui.setLoading(button, false);
      }
    });

    root.addEventListener('click', function (event) {
      const dateButton = event.target.closest('[data-filter-date]');
      if (dateButton) {
        dateFilter = dateButton.getAttribute('data-filter-date');
        PT.app.render();
        return;
      }

      const typeButton = event.target.closest('[data-filter-type]');
      if (typeButton) {
        typeFilter = typeButton.getAttribute('data-filter-type');
        PT.app.render();
        return;
      }

      const clear = event.target.closest('[data-clear-filters]');
      if (clear) {
        dateFilter = 'all';
        typeFilter = 'all';
        PT.app.render();
        return;
      }

      const photo = event.target.closest('[data-photo]');
      if (photo) {
        ui.openPhoto(photo.getAttribute('data-photo'), photo.getAttribute('data-photo-alt'));
        return;
      }

      const deleteButton = event.target.closest('[data-delete-entry]');
      if (deleteButton) {
        const entryId = deleteButton.getAttribute('data-delete-entry');
        const entry = store.getState().timeline.find(function (item) { return item.id === entryId; });
        if (!entry) return;
        ui.confirm({
          title: 'Eliminar entrada',
          message: 'Se quitará “' + entry.title + '” de la bitácora. Esta acción no se puede deshacer.',
          confirmLabel: 'Sí, eliminar',
          icon: 'trash-2'
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.update(function (draft) {
            draft.timeline = draft.timeline.filter(function (item) { return item.id !== entryId; });
          });
          ui.toast('Entrada eliminada de la bitácora.', 'info');
        });
      }
    });
  };
})();
