/* ==========================================================================
   Vista · Administración
   ========================================================================== */
(function () {
  'use strict';

  const PT = window.PT;
  const store = PT.store;
  const ui = PT.ui;
  const util = PT.util;
  const data = PT.data;

  const ROLE_FEATURES = {
    estudiante: [
      'Ver el estado y el mapa en vivo',
      'Leer y comentar en la bitácora',
      'Enviar reportes de avistamiento',
      'Inscribirse en turnos de cuidado'
    ],
    cuidador: [
      'Todo lo del estudiante',
      'Actualizar estado y ubicación',
      'Registrar comida y agua',
      'Subir fotos del día'
    ],
    admin: [
      'Todo lo anterior',
      'Gestionar salud y medicamentos',
      'Aprobar reportes comunitarios',
      'Crear turnos y editar mascotas'
    ]
  };

  function preventionAlerts(health) {
    if (!health) return 0;
    const all = (health.vaccines || []).concat(health.dewormings || []);
    return all.filter(function (item) {
      return item.next && util.daysUntil(item.next) < 0;
    }).length;
  }

  function petReports(state, petId) {
    return state.reports.filter(function (report) { return report.petId === petId; });
  }

  function reportCard(report, pets, showActions) {
    const pet = pets.find(function (p) { return p.id === report.petId; });
    const zone = PT.meta.zone(report.zone);
    const role = data.ROLES[report.role];
    const statusTone = report.status === 'pendiente' ? 'amber' : report.status === 'aprobado' ? 'emerald' : 'slate';
    const statusLabel = report.status === 'pendiente' ? 'Pendiente' : report.status === 'aprobado' ? 'Aprobado' : 'Rechazado';

    return (
      '<div class="rounded-2xl border ' + (report.status === 'pendiente' ? 'border-amber-200 bg-amber-50/40' : 'border-ink/[0.07] bg-white') + ' p-3.5">' +
        '<div class="flex items-start gap-3">' +
          '<span class="grid h-11 w-11 flex-none place-items-center rounded-xl bg-white text-2xl shadow-sm">' + (pet ? pet.emoji : '🐾') + '</span>' +
          '<div class="min-w-0 flex-1">' +
            '<div class="flex flex-wrap items-center gap-1.5">' +
              '<p class="text-xs font-extrabold text-ink">' + util.esc(pet ? pet.name : 'Mascota') + '</p>' +
              ui.badge(statusLabel, statusTone) +
              '<span class="text-[0.62rem] font-bold text-ink/55">' + util.timeAgo(report.at) + '</span>' +
            '</div>' +
            '<p class="mt-1 text-[0.78rem] font-semibold leading-snug text-ink/65">' + util.esc(report.note) + '</p>' +
            '<div class="mt-1.5 flex flex-wrap items-center gap-1.5">' +
              ui.badge(zone.name, 'sky') +
              '<span class="flex items-center gap-1 text-[0.62rem] font-bold text-ink/55">' +
                ui.avatar(report.by, 'xs') + util.esc(report.by) +
                (role ? ' · ' + role.label : '') +
              '</span>' +
            '</div>' +
            (report.reviewedBy
              ? '<p class="mt-1 text-[0.6rem] font-semibold text-ink/55">Revisado por ' + util.esc(report.reviewedBy) + ' · ' + util.timeAgo(report.reviewedAt) + '</p>'
              : '') +
          '</div>' +
        '</div>' +
        (showActions
          ? '<div class="mt-2.5 flex gap-2">' +
              '<button type="button" class="btn btn-sm btn-primary flex-1" data-admin-approve="' + util.esc(report.id) + '">' + ui.icon('check', 'h-3.5 w-3.5') + ' Aprobar y actualizar</button>' +
              '<button type="button" class="btn btn-sm btn-secondary flex-1" data-admin-reject="' + util.esc(report.id) + '">' + ui.icon('x', 'h-3.5 w-3.5') + ' Rechazar</button>' +
            '</div>'
          : '') +
      '</div>'
    );
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

    ui.toast(approved ? 'Reporte aprobado y ubicación actualizada.' : 'Reporte rechazado.', approved ? 'success' : 'info');
  }

  function openPetModal(existing) {
    if (!store.can('manage')) {
      ui.toast('Solo administradores pueden gestionar mascotas.', 'error');
      return;
    }
    const isEdit = Boolean(existing);
    const emojis = ['🐶', '🐱', '🐰', '🐹', '🦜', '🐢', '🐴', '🐾'];
    if (existing && emojis.indexOf(existing.emoji) === -1) emojis.unshift(existing.emoji);

    ui.openModal({
      title: isEdit ? 'Editar ' + existing.name : 'Añadir mascota',
      subtitle: isEdit ? 'Actualiza la ficha que ve la comunidad' : 'Registra una nueva mascota de la institución',
      icon: 'paw-print',
      content:
        '<form id="pet-form" class="space-y-4">' +
          '<div class="grid grid-cols-[5rem_1fr] gap-3">' +
            '<div>' +
              '<label class="field-label" for="pet-emoji">Avatar</label>' +
              '<select class="field text-center text-xl" id="pet-emoji" name="emoji">' +
                emojis.map(function (emoji) {
                  return '<option ' + (existing && existing.emoji === emoji ? 'selected' : '') + '>' + emoji + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="pet-name">Nombre</label>' +
              '<input class="field" id="pet-name" name="name" required maxlength="30" value="' + util.esc(existing ? existing.name : '') + '" placeholder="Ej. Nube" data-autofocus>' +
            '</div>' +
          '</div>' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="pet-species">Especie</label>' +
              '<select class="field" id="pet-species" name="species">' +
                '<option value="perro" ' + (existing && existing.species === 'perro' ? 'selected' : '') + '>Perro</option>' +
                '<option value="gato" ' + (existing && existing.species === 'gato' ? 'selected' : '') + '>Gato</option>' +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="pet-sex">Sexo</label>' +
              '<select class="field" id="pet-sex" name="sex">' +
                ['Hembra', 'Macho'].map(function (sex) {
                  return '<option ' + (existing && existing.sex === sex ? 'selected' : '') + '>' + sex + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
          '</div>' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="pet-breed">Raza o descripción</label>' +
              '<input class="field" id="pet-breed" name="breed" maxlength="50" value="' + util.esc(existing ? existing.breed : '') + '" placeholder="Ej. Mestiza rescatada">' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="pet-age">Edad</label>' +
              '<input class="field" id="pet-age" name="age" maxlength="20" value="' + util.esc(existing ? existing.age : '') + '" placeholder="Ej. 3 años">' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="field-label" for="pet-bio">Historia</label>' +
            '<textarea class="field" id="pet-bio" name="bio" maxlength="240" placeholder="¿Cómo llegó a la institución? ¿Qué la hace especial?">' + util.esc(existing ? existing.bio : '') + '</textarea>' +
          '</div>' +
        '</form>',
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="pet-form" class="btn btn-primary">' + ui.icon('check', 'h-4 w-4') + (isEdit ? ' Guardar cambios' : ' Añadir mascota') + '</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#pet-form');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const fd = new FormData(form);
          const name = (fd.get('name') || '').toString().trim();
          if (!name) {
            ui.toast('Escribe el nombre de la mascota.', 'error');
            return;
          }
          const values = {
            name: name,
            emoji: (fd.get('emoji') || '🐾').toString(),
            species: (fd.get('species') || 'perro').toString(),
            sex: (fd.get('sex') || 'Hembra').toString(),
            breed: (fd.get('breed') || '').toString().trim() || 'Mascota de la institución',
            age: (fd.get('age') || '').toString().trim() || 'Edad por confirmar',
            bio: (fd.get('bio') || '').toString().trim() || 'Una nueva historia de cuidado comunitario.'
          };

          ui.closeModal();
          if (isEdit) {
            store.update(function (draft) {
              const pet = draft.pets.find(function (p) { return p.id === existing.id; });
              Object.assign(pet, values);
            });
            ui.toast('Ficha actualizada.', 'success');
          } else {
            const id = 'pet-' + Date.now().toString(36);
            const profile = store.getState().profile;
            const now = new Date().toISOString();
            store.update(function (draft) {
              draft.pets.push({
                id: id,
                name: values.name,
                emoji: values.emoji,
                species: values.species,
                breed: values.breed,
                age: values.age,
                sex: values.sex,
                bio: values.bio,
                status: {
                  key: 'libre',
                  zone: 'pedregal',
                  by: profile.name,
                  at: now,
                  note: 'Nueva mascota registrada en PetTracker'
                }
              });
              draft.health[id] = {
                weights: [],
                vaccines: [],
                dewormings: [],
                meds: [],
                allergies: '',
                vet: profile.name
              };
              draft.timeline.unshift({
                id: util.uid('entry'),
                petId: id,
                type: 'nota',
                title: '¡Bienvenida a la comunidad!',
                note: values.name + ' se unió oficialmente al programa de cuidado de la institución.',
                by: profile.name,
                role: profile.role,
                at: now,
                photo: null
              });
              draft.activePetId = id;
            });
            ui.toast(values.name + ' ya está en PetTracker.', 'success');
          }
        });
      }
    });
  }

  function exportData() {
    try {
      const payload = JSON.stringify(store.getState(), null, 2);
      const blob = new Blob([payload], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'pettracker-escolar-' + util.todayKey() + '.json';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      ui.toast('Copia de seguridad descargada.', 'success');
    } catch (error) {
      ui.toast('No se pudo generar la copia de seguridad.', 'error');
    }
  }

  function resetDemo() {
    ui.confirm({
      title: 'Restablecer datos de demostración',
      message: 'Se borrarán las entradas, reportes y cambios guardados en este navegador. También volverás al rol de estudiante.',
      confirmLabel: 'Restablecer todo',
      icon: 'rotate-ccw'
    }).then(function (confirmed) {
      if (!confirmed) return;
      store.reset();
      ui.toast('Datos de demostración restablecidos.', 'success');
    });
  }

  PT.views = PT.views || {};

  PT.views.admin = function (root) {
    if (!store.can('approve')) {
      root.innerHTML =
        '<div class="card p-8 text-center">' +
          '<p class="text-3xl">🔒</p>' +
          '<h2 class="mt-2 font-display text-xl font-semibold text-ink">Acceso restringido</h2>' +
          '<p class="mt-1 text-sm font-semibold text-ink/60">Cambia tu rol a administrador desde el perfil para ver este panel.</p>' +
        '</div>';
      return;
    }

    const state = store.getState();
    const pending = state.reports.filter(function (r) { return r.status === 'pendiente'; })
      .sort(function (a, b) { return new Date(b.at) - new Date(a.at); });
    const reviewed = state.reports.filter(function (r) { return r.status !== 'pendiente'; })
      .sort(function (a, b) { return new Date(b.reviewedAt || b.at) - new Date(a.reviewedAt || a.at); });
    const weekStart = util.dateKey(util.startOfWeek());
    const weekEnd = util.dateKey(util.addDays(util.startOfWeek(), 6));
    const weekShifts = state.shifts.filter(function (shift) {
      return shift.date >= weekStart && shift.date <= weekEnd;
    });
    const healthAlerts = state.pets.reduce(function (sum, pet) {
      return sum + preventionAlerts(state.health[pet.id]);
    }, 0);
    let storageKb = 0;
    try {
      storageKb = Math.max(1, Math.round(new Blob([JSON.stringify(state)]).size / 1024));
    } catch (error) {
      storageKb = 0;
    }

    const petCards = state.pets.map(function (pet) {
      const health = state.health[pet.id] || {};
      const alerts = preventionAlerts(health);
      const reports = petReports(state, pet.id).filter(function (r) { return r.status === 'pendiente'; }).length;
      const isActive = pet.id === state.activePetId;
      const weights = (health.weights || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
      const latest = weights[weights.length - 1];
      return (
        '<div class="rounded-2xl border ' + (isActive ? 'border-brand-200 bg-brand-50/30' : 'border-ink/[0.07] bg-white') + ' p-4">' +
          '<div class="flex items-start gap-3">' +
            '<span class="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white text-3xl shadow-sm">' + pet.emoji + '</span>' +
            '<div class="min-w-0 flex-1">' +
              '<div class="flex flex-wrap items-center gap-1.5">' +
                '<h3 class="font-display text-base font-semibold text-ink">' + util.esc(pet.name) + '</h3>' +
                (isActive ? ui.badge('Activa', 'brand') : '') +
              '</div>' +
              '<p class="text-[0.68rem] font-semibold text-ink/60">' + util.esc(pet.breed) + ' · ' + util.esc(pet.age) + '</p>' +
              '<div class="mt-1.5 flex flex-wrap items-center gap-1.5">' +
                ui.statusBadge(pet.status.key) +
                (alerts ? ui.badge(alerts + ' alerta(s)', 'rose') : ui.badge('Salud al día', 'emerald')) +
                (reports ? ui.badge(reports + ' reporte(s)', 'amber') : '') +
              '</div>' +
            '</div>' +
          '</div>' +
          '<div class="mt-3 flex items-center justify-between gap-2 rounded-xl bg-stone-50 px-2.5 py-2">' +
            '<span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-ink/60">' + ui.icon('scale', 'h-3.5 w-3.5') + (latest ? latest.kg.toFixed(1) + ' kg' : 'Sin peso') + '</span>' +
            '<span class="flex items-center gap-1.5 text-[0.65rem] font-bold text-ink/60">' + ui.icon('map-pin', 'h-3.5 w-3.5') + util.esc(PT.meta.zone(pet.status.zone).name) + '</span>' +
          '</div>' +
          '<div class="mt-3 flex gap-2">' +
            '<button type="button" class="btn btn-sm btn-secondary flex-1" data-edit-pet="' + util.esc(pet.id) + '">' + ui.icon('pencil', 'h-3.5 w-3.5') + ' Editar</button>' +
            (isActive
              ? '<a href="#/dashboard" class="btn btn-sm btn-ghost flex-1">Ver perfil ' + ui.icon('arrow-right', 'h-3.5 w-3.5') + '</a>'
              : '<button type="button" class="btn btn-sm btn-primary flex-1" data-activate-pet="' + util.esc(pet.id) + '">Ver perfil</button>') +
          '</div>' +
        '</div>'
      );
    }).join('');

    const roles = Object.keys(data.ROLES).map(function (id) { return data.ROLES[id]; });
    const roleCards = roles.map(function (role) {
      const current = state.profile.role === role.id;
      const t = ui.tone(role.id === 'admin' ? 'brand' : role.id === 'cuidador' ? 'sky' : 'amber');
      return (
        '<div class="rounded-2xl border ' + (current ? 'border-brand-300 bg-brand-50/40 ring-1 ring-brand-200' : 'border-ink/[0.07] bg-white') + ' p-4">' +
          '<div class="flex items-center gap-2.5">' +
            '<span class="grid h-10 w-10 flex-none place-items-center rounded-xl ' + t.ico + '">' + ui.icon(role.icon, 'h-5 w-5') + '</span>' +
            '<div class="min-w-0 flex-1">' +
              '<p class="text-sm font-extrabold text-ink">' + util.esc(role.title) + '</p>' +
              '<p class="text-[0.65rem] font-semibold text-ink/55">' + util.esc(role.detail) + '</p>' +
            '</div>' +
            (current ? ui.badge('Activo', 'brand') : '') +
          '</div>' +
          '<ul class="mt-3 space-y-1.5">' +
            ROLE_FEATURES[role.id].map(function (feature) {
              return '<li class="flex items-start gap-1.5 text-[0.7rem] font-semibold text-ink/55">' + ui.icon('check', 'mt-0.5 h-3.5 w-3.5 flex-none text-brand-500') + util.esc(feature) + '</li>';
            }).join('') +
          '</ul>' +
          '<button type="button" class="btn btn-sm ' + (current ? 'btn-secondary' : 'btn-primary') + ' mt-3 w-full" data-test-role="' + role.id + '" ' + (current ? 'disabled' : '') + '>' +
            (current ? 'Estás usando este rol' : 'Probar este rol') +
          '</button>' +
        '</div>'
      );
    }).join('');

    root.innerHTML =
      '<div class="space-y-5">' +
        '<section class="card-tinted reveal p-5 sm:p-6">' +
          '<div class="flex flex-wrap items-start justify-between gap-4">' +
            '<div class="flex items-start gap-3.5">' +
              '<span class="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-brand-700 text-white shadow-soft">' + ui.icon('shield-check', 'h-6 w-6') + '</span>' +
              '<div>' +
                '<p class="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-brand-600/70">Panel de control</p>' +
                '<h2 class="font-display text-2xl font-semibold leading-tight text-ink">Todo bajo cuidado</h2>' +
                '<p class="mt-1 max-w-lg text-xs font-semibold leading-relaxed text-ink/60">Aprueba reportes, actualiza fichas y prueba los permisos de cada rol. Los cambios se guardan en este navegador.</p>' +
              '</div>' +
            '</div>' +
            '<span class="chip-soft bg-white text-brand-700 ring-1 ring-brand-100">' + ui.icon('cloud-off', 'h-3.5 w-3.5') + ' Datos locales · ' + storageKb + ' KB</span>' +
          '</div>' +
          '<div class="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">' +
            '<div class="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-ink/[0.04]"><p class="font-display text-xl font-semibold leading-none text-amber-600">' + pending.length + '</p><p class="mt-1 text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Reportes pendientes</p></div>' +
            '<div class="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-ink/[0.04]"><p class="font-display text-xl font-semibold leading-none text-ink">' + state.pets.length + '</p><p class="mt-1 text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Mascotas</p></div>' +
            '<div class="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-ink/[0.04]"><p class="font-display text-xl font-semibold leading-none text-sky-600">' + weekShifts.length + '</p><p class="mt-1 text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Turnos esta semana</p></div>' +
            '<div class="rounded-xl bg-white/80 px-3 py-2.5 ring-1 ring-ink/[0.04]"><p class="font-display text-xl font-semibold leading-none ' + (healthAlerts ? 'text-rose-600' : 'text-emerald-600') + '">' + healthAlerts + '</p><p class="mt-1 text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Alertas de salud</p></div>' +
          '</div>' +
        '</section>' +

        '<div class="grid gap-5 xl:grid-cols-2">' +
          '<section class="card reveal p-5">' +
            '<div class="mb-3 flex flex-wrap items-center justify-between gap-2">' +
              '<div>' +
                '<h2 class="font-display text-lg font-semibold text-ink">Aprobaciones de la comunidad</h2>' +
                '<p class="text-xs font-semibold text-ink/60">Reportes de avistamiento pendientes</p>' +
              '</div>' +
              '<span class="chip-soft ' + (pending.length ? 'bg-amber-50 text-amber-800 ring-1 ring-amber-200' : 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200') + '">' + pending.length + ' pendiente(s)</span>' +
            '</div>' +
            (pending.length
              ? '<div class="space-y-2.5">' + pending.map(function (report) { return reportCard(report, state.pets, true); }).join('') + '</div>'
              : ui.emptyState({
                  icon: 'party-popper',
                  title: 'Todo revisado',
                  text: 'No hay reportes pendientes. La comunidad está al día.'
                })) +
            (reviewed.length
              ? '<details class="mt-4 rounded-xl border border-ink/[0.06] bg-stone-50/60 px-3 py-2">' +
                  '<summary class="cursor-pointer text-xs font-extrabold text-ink/55">Historial reciente (' + reviewed.length + ')</summary>' +
                  '<div class="mt-2 space-y-2">' + reviewed.slice(0, 5).map(function (report) { return reportCard(report, state.pets, false); }).join('') + '</div>' +
                '</details>'
              : '') +
          '</section>' +

          '<section class="card reveal p-5">' +
            '<div class="mb-3 flex flex-wrap items-center justify-between gap-2">' +
              '<div>' +
                '<h2 class="font-display text-lg font-semibold text-ink">Mascotas</h2>' +
                '<p class="text-xs font-semibold text-ink/60">Fichas de la institución</p>' +
              '</div>' +
              '<button type="button" class="btn btn-sm btn-primary" data-add-pet>' + ui.icon('plus', 'h-4 w-4') + ' Añadir</button>' +
            '</div>' +
            '<div class="space-y-2.5">' + petCards + '</div>' +
          '</section>' +
        '</div>' +

        '<section class="card reveal p-5">' +
          '<div class="mb-3 flex flex-wrap items-center justify-between gap-2">' +
            '<div>' +
              '<h2 class="font-display text-lg font-semibold text-ink">Roles y permisos</h2>' +
              '<p class="text-xs font-semibold text-ink/60">Prueba cómo cambia la experiencia con cada rol</p>' +
            '</div>' +
            '<button type="button" class="btn btn-sm btn-ghost" data-edit-profile>' + ui.icon('user-round', 'h-3.5 w-3.5') + ' Editar mi perfil</button>' +
          '</div>' +
          '<div class="grid gap-3 md:grid-cols-3">' + roleCards + '</div>' +
        '</section>' +

        '<section class="card reveal p-5">' +
          '<div class="mb-3">' +
            '<h2 class="font-display text-lg font-semibold text-ink">Datos y respaldo</h2>' +
            '<p class="text-xs font-semibold text-ink/60">Todo se guarda en localStorage de este navegador</p>' +
          '</div>' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div class="rounded-2xl border border-ink/[0.07] bg-white p-3.5">' +
              '<p class="flex items-center gap-2 text-xs font-extrabold text-ink">' + ui.icon('hard-drive-download', 'h-4 w-4 text-brand-600') + ' Copia de seguridad</p>' +
              '<p class="mt-1 text-[0.68rem] font-semibold leading-snug text-ink/60">Descarga un archivo JSON con la bitácora, el expediente y los turnos actuales.</p>' +
              '<button type="button" class="btn btn-sm btn-secondary mt-2.5 w-full" data-export>' + ui.icon('download', 'h-3.5 w-3.5') + ' Descargar datos</button>' +
            '</div>' +
            '<div class="rounded-2xl border border-rose-200 bg-rose-50/50 p-3.5">' +
              '<p class="flex items-center gap-2 text-xs font-extrabold text-rose-900">' + ui.icon('rotate-ccw', 'h-4 w-4 text-rose-600') + ' Restablecer demostración</p>' +
              '<p class="mt-1 text-[0.68rem] font-semibold leading-snug text-rose-900/55">Vuelve a los datos iniciales. Se perderán los cambios guardados en este dispositivo.</p>' +
              '<button type="button" class="btn btn-sm btn-danger mt-2.5 w-full" data-reset-demo>' + ui.icon('trash-2', 'h-3.5 w-3.5') + ' Restablecer datos</button>' +
            '</div>' +
          '</div>' +
        '</section>' +
      '</div>';

    root.addEventListener('click', function (event) {
      const approve = event.target.closest('[data-admin-approve]');
      if (approve) {
        reviewReport(approve.getAttribute('data-admin-approve'), true);
        return;
      }

      const reject = event.target.closest('[data-admin-reject]');
      if (reject) {
        reviewReport(reject.getAttribute('data-admin-reject'), false);
        return;
      }

      const addPet = event.target.closest('[data-add-pet]');
      if (addPet) {
        openPetModal(null);
        return;
      }

      const editPet = event.target.closest('[data-edit-pet]');
      if (editPet) {
        const pet = state.pets.find(function (p) { return p.id === editPet.getAttribute('data-edit-pet'); });
        if (pet) openPetModal(pet);
        return;
      }

      const activate = event.target.closest('[data-activate-pet]');
      if (activate) {
        const petId = activate.getAttribute('data-activate-pet');
        const pet = state.pets.find(function (p) { return p.id === petId; });
        if (pet) {
          store.setPet(petId);
          ui.toast('Ahora ves el perfil de ' + pet.name + '.', 'success');
          window.location.hash = '#/dashboard';
        }
        return;
      }

      const roleButton = event.target.closest('[data-test-role]');
      if (roleButton) {
        const roleId = roleButton.getAttribute('data-test-role');
        const role = data.ROLES[roleId];
        if (!role) return;
        store.setProfile(roleId, role.defaultName);
        ui.toast('Ahora navegas como ' + role.title + '.', 'success');
        return;
      }

      const editProfile = event.target.closest('[data-edit-profile]');
      if (editProfile) {
        PT.app.openProfile();
        return;
      }

      const exportButton = event.target.closest('[data-export]');
      if (exportButton) {
        exportData();
        return;
      }

      const resetButton = event.target.closest('[data-reset-demo]');
      if (resetButton) {
        resetDemo();
      }
    });
  };
})();
