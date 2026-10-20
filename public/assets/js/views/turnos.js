/* ==========================================================================
   Vista · Turnos y cuidado
   ========================================================================== */
(function () {
  'use strict';

  const PT = window.PT;
  const store = PT.store;
  const ui = PT.ui;
  const util = PT.util;
  const data = PT.data;

  let weekOffset = 0;
  let selectedDate = null;

  const SHIFT_HINTS = {
    paseo: 'Paseo acompañado por calles seguras de Pedregal.',
    alimentacion: 'Servir la porción indicada y revisar el agua.',
    limpieza: 'Cambiar el agua, lavar el bebedero y asear su descanso.'
  };

  function prettyTime(time) {
    if (!time) return '—';
    const parts = time.split(':');
    const d = new Date();
    d.setHours(Number(parts[0] || 0), Number(parts[1] || 0), 0, 0);
    return new Intl.DateTimeFormat('es', { hour: 'numeric', minute: '2-digit' }).format(d);
  }

  function openShiftModal(prefillDate) {
    if (!store.can('manage')) {
      ui.toast('Solo administradores pueden programar turnos.', 'error');
      return;
    }
    const pet = store.currentPet();
    const today = util.todayKey();
    const date = prefillDate && prefillDate >= today ? prefillDate : today;

    ui.openModal({
      title: 'Programar turno',
      subtitle: 'Nuevo espacio de cuidado para ' + pet.name,
      icon: 'calendar-plus',
      content:
        '<form id="shift-form" class="space-y-4">' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="shift-date">Fecha</label>' +
              '<input class="field" id="shift-date" name="date" type="date" required min="' + today + '" value="' + date + '">' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="shift-time">Hora</label>' +
              '<input class="field" id="shift-time" name="time" type="time" required value="16:00">' +
            '</div>' +
          '</div>' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="shift-type">Tipo de cuidado</label>' +
              '<select class="field" id="shift-type" name="type">' +
                Object.keys(data.SHIFT_TYPES).map(function (key) {
                  return '<option value="' + key + '">' + data.SHIFT_TYPES[key].label + '</option>';
                }).join('') +
              '</select>' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="shift-capacity">Cupos</label>' +
              '<input class="field" id="shift-capacity" name="capacity" type="number" min="1" max="8" value="2" required>' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="field-label" for="shift-note">Indicaciones (opcional)</label>' +
            '<input class="field" id="shift-note" name="note" maxlength="120" placeholder="Ej. Llevar la pelota azul y agua">' +
          '</div>' +
          '<p class="rounded-xl bg-brand-50 px-3 py-2 text-[0.72rem] font-semibold text-brand-800">Los estudiantes podrán inscribirse hasta completar los cupos.</p>' +
        '</form>',
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="shift-form" class="btn btn-primary">' + ui.icon('calendar-plus', 'h-4 w-4') + ' Crear turno</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#shift-form');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const fd = new FormData(form);
          const dateValue = (fd.get('date') || '').toString();
          const time = (fd.get('time') || '').toString();
          const type = (fd.get('type') || 'paseo').toString();
          const capacity = parseInt((fd.get('capacity') || '2').toString(), 10);
          const note = (fd.get('note') || '').toString().trim();
          if (!dateValue || !time || !data.SHIFT_TYPES[type] || !capacity || capacity < 1) {
            ui.toast('Completa la fecha, la hora y los cupos.', 'error');
            return;
          }
          if (dateValue < util.todayKey()) {
            ui.toast('No puedes programar turnos en fechas pasadas.', 'error');
            return;
          }
          selectedDate = dateValue;
          weekOffset = Math.round((util.startOfWeek(dateValue) - util.startOfWeek()) / (7 * 86400000));
          ui.closeModal();
          store.update(function (draft) {
            draft.shifts.push({
              id: util.uid('shift'),
              petId: pet.id,
              date: dateValue,
              time: time,
              type: type,
              capacity: capacity,
              signups: [],
              note: note
            });
          });
          ui.toast('Turno programado para el ' + util.fmtDate(dateValue) + ' a las ' + prettyTime(time) + '.', 'success');
        });
      }
    });
  }

  function joinShift(shiftId) {
    const state = store.getState();
    const shift = state.shifts.find(function (item) { return item.id === shiftId; });
    if (!shift) return;
    const now = new Date();
    const currentTime = util.pad(now.getHours()) + ':' + util.pad(now.getMinutes());
    if (shift.date < util.todayKey() || (shift.date === util.todayKey() && shift.time < currentTime)) {
      ui.toast('Este turno ya pasó.', 'info');
      return;
    }
    const profile = state.profile;
    if (shift.signups.some(function (person) { return person.name === profile.name; })) {
      ui.toast('Ya estás inscrito en este turno.', 'info');
      return;
    }
    if (shift.signups.length >= shift.capacity) {
      ui.toast('Este turno ya está completo.', 'error');
      return;
    }
    store.update(function (draft) {
      const target = draft.shifts.find(function (item) { return item.id === shiftId; });
      target.signups.push({ name: profile.name, role: profile.role });
    });
    const pet = state.pets.find(function (p) { return p.id === shift.petId; });
    ui.toast('¡Inscripción confirmada!', 'success', {
      detail: (data.SHIFT_TYPES[shift.type] || data.SHIFT_TYPES.paseo).label + ' · ' + util.fmtDate(shift.date) + ' · ' + prettyTime(shift.time) + ' con ' + (pet ? pet.name : 'la mascota') + '.'
    });
  }

  function leaveShift(shiftId) {
    const state = store.getState();
    const shift = state.shifts.find(function (item) { return item.id === shiftId; });
    if (!shift) return;
    const profile = state.profile;
    if (!shift.signups.some(function (person) { return person.name === profile.name; })) return;
    ui.confirm({
      title: 'Cancelar inscripción',
      message: 'Liberarás tu cupo en el turno de ' + (data.SHIFT_TYPES[shift.type] || data.SHIFT_TYPES.paseo).label.toLowerCase() + ' del ' + util.fmtDate(shift.date) + '.',
      confirmLabel: 'Cancelar turno',
      icon: 'calendar-x'
    }).then(function (confirmed) {
      if (!confirmed) return;
      store.update(function (draft) {
        const target = draft.shifts.find(function (item) { return item.id === shiftId; });
        target.signups = target.signups.filter(function (person) { return person.name !== profile.name; });
      });
      ui.toast('Tu cupo quedó libre.', 'info');
    });
  }

  function removeParticipant(shiftId, index) {
    if (!store.can('manage')) return;
    const state = store.getState();
    const shift = state.shifts.find(function (item) { return item.id === shiftId; });
    if (!shift) return;
    const person = shift.signups[index];
    if (!person) return;
    ui.confirm({
      title: 'Quitar del turno',
      message: 'Se quitará a ' + person.name + ' del turno seleccionado.',
      confirmLabel: 'Quitar',
      icon: 'user-minus'
    }).then(function (confirmed) {
      if (!confirmed) return;
      store.update(function (draft) {
        const target = draft.shifts.find(function (item) { return item.id === shiftId; });
        target.signups.splice(index, 1);
      });
      ui.toast(person.name + ' fue retirado del turno.', 'info');
    });
  }

  function deleteShift(shiftId) {
    if (!store.can('manage')) {
      ui.toast('Solo administradores pueden eliminar turnos.', 'error');
      return;
    }
    const state = store.getState();
    const shift = state.shifts.find(function (item) { return item.id === shiftId; });
    if (!shift) return;
    ui.confirm({
      title: 'Eliminar turno',
      message: 'Se eliminará el turno de ' + (data.SHIFT_TYPES[shift.type] || data.SHIFT_TYPES.paseo).label.toLowerCase() + ' del ' + util.fmtDate(shift.date) + ' a las ' + prettyTime(shift.time) + ', junto con sus inscripciones.',
      confirmLabel: 'Eliminar turno',
      icon: 'trash-2'
    }).then(function (confirmed) {
      if (!confirmed) return;
      store.update(function (draft) {
        draft.shifts = draft.shifts.filter(function (item) { return item.id !== shiftId; });
      });
      ui.toast('Turno eliminado.', 'info');
    });
  }

  PT.views = PT.views || {};

  PT.views.turnos = function (root) {
    const state = store.getState();
    const pet = store.currentPet();
    const profile = state.profile;
    const today = util.todayKey();
    const currentWeekStart = util.startOfWeek();
    const weekStart = util.addDays(currentWeekStart, weekOffset * 7);
    const weekStartKey = util.dateKey(weekStart);
    const weekDates = util.weekDates(weekStart).map(function (date) { return util.dateKey(date); });
    const weekEndKey = weekDates[weekDates.length - 1];

    if (!selectedDate || weekDates.indexOf(selectedDate) === -1) {
      selectedDate = weekOffset === 0 ? today : weekStartKey;
    }

    const petShifts = state.shifts.filter(function (shift) { return shift.petId === pet.id; });
    const weekShifts = petShifts.filter(function (shift) {
      return shift.date >= weekStartKey && shift.date <= weekEndKey;
    });
    const dayShifts = weekShifts
      .filter(function (shift) { return shift.date === selectedDate; })
      .sort(function (a, b) { return a.time.localeCompare(b.time); });
    const myWeekShifts = weekShifts.filter(function (shift) {
      return shift.signups.some(function (person) { return person.name === profile.name; });
    }).sort(function (a, b) {
      return (a.date + a.time).localeCompare(b.date + b.time);
    });
    const freeSlots = weekShifts.reduce(function (sum, shift) {
      return sum + Math.max(0, shift.capacity - shift.signups.length);
    }, 0);
    const canManage = store.can('manage');
    const isPastDay = selectedDate < today;
    const now = new Date();
    const currentTime = util.pad(now.getHours()) + ':' + util.pad(now.getMinutes());
    const rangeLabel = util.fmtDate(weekStartKey, { day: 'numeric', month: 'short' }) + ' – ' +
      util.fmtDate(weekEndKey, { day: 'numeric', month: 'short', year: 'numeric' });

    const weekStrip = weekDates.map(function (dateKey) {
      const count = weekShifts.filter(function (shift) { return shift.date === dateKey; }).length;
      const isSelected = dateKey === selectedDate;
      const isToday = dateKey === today;
      const dayNumber = util.fmtDate(dateKey, { day: 'numeric' });
      return (
        '<button type="button" class="week-day ' + (isSelected ? 'is-selected' : '') + ' ' + (isToday ? 'is-today' : '') + '" data-day="' + dateKey + '" aria-pressed="' + isSelected + '" aria-label="' + util.esc(util.fmtLongDate(dateKey) + ', ' + count + ' turnos') + '">' +
          '<span class="text-[0.55rem] font-extrabold uppercase leading-none tracking-wide opacity-70">' + util.esc(util.weekdayShort(dateKey)) + '</span>' +
          '<span class="week-num">' + dayNumber + '</span>' +
          '<span class="h-1 w-1 rounded-full ' + (count ? (isSelected ? 'bg-white/80' : 'bg-brand-500') : 'bg-transparent') + '"></span>' +
        '</button>'
      );
    }).join('');

    const shiftCards = dayShifts.length
      ? dayShifts.map(function (shift) {
          const type = data.SHIFT_TYPES[shift.type] || data.SHIFT_TYPES.paseo;
          const t = ui.tone(type.tone);
          const isFull = shift.signups.length >= shift.capacity;
          const isMine = shift.signups.some(function (person) { return person.name === profile.name; });
          const pct = shift.capacity ? Math.round((shift.signups.length / shift.capacity) * 100) : 0;
          const past = shift.date < today || (shift.date === today && shift.time < currentTime);

          const people = shift.signups.length
            ? shift.signups.map(function (person, index) {
                return (
                  '<span class="inline-flex items-center gap-1 rounded-full bg-stone-100 py-1 pl-1 pr-2 text-[0.65rem] font-bold text-ink/60">' +
                    ui.avatar(person.name, 'xs') +
                    util.esc(person.name) +
                    (canManage
                      ? '<button type="button" class="ml-0.5 grid h-4 w-4 place-items-center rounded-full text-ink/30 transition hover:bg-rose-100 hover:text-rose-600" data-remove-person="' + index + '" data-shift="' + util.esc(shift.id) + '" aria-label="Quitar a ' + util.esc(person.name) + '">' + ui.icon('x', 'h-3 w-3') + '</button>'
                      : '') +
                  '</span>'
                );
              }).join('')
            : '<span class="text-[0.68rem] font-semibold text-ink/55">Aún no hay inscritos. ¡Sé la primera persona!</span>';

          let action = '';
          if (past) {
            action = '<span class="chip-soft bg-stone-100 text-stone-500">Turno finalizado</span>';
          } else if (isMine) {
            action = '<button type="button" class="btn btn-sm btn-secondary" data-leave="' + util.esc(shift.id) + '">' + ui.icon('calendar-x', 'h-3.5 w-3.5') + ' Cancelar mi turno</button>';
          } else if (isFull) {
            action = '<button type="button" class="btn btn-sm btn-secondary" disabled>Turno completo</button>';
          } else {
            action = '<button type="button" class="btn btn-sm btn-primary" data-join="' + util.esc(shift.id) + '">' + ui.icon('hand-heart', 'h-3.5 w-3.5') + ' Inscribirme</button>';
          }

          return (
            '<article class="rounded-2xl border ' + (isMine ? 'border-brand-200 bg-brand-50/40' : 'border-ink/[0.07] bg-white') + ' p-4">' +
              '<div class="flex items-start gap-3">' +
                '<span class="grid h-10 w-10 flex-none place-items-center rounded-xl ' + t.ico + '">' + ui.icon(type.icon, 'h-5 w-5') + '</span>' +
                '<div class="min-w-0 flex-1">' +
                  '<div class="flex flex-wrap items-center gap-1.5">' +
                    '<h3 class="text-sm font-extrabold text-ink">' + util.esc(type.label) + '</h3>' +
                    '<span class="chip-soft ' + t.chip + '">' + ui.icon('clock-3', 'h-3 w-3') + prettyTime(shift.time) + '</span>' +
                    (isMine ? ui.badge('Estás inscrito', 'brand') : '') +
                    (isFull ? ui.badge('Completo', 'amber') : '') +
                  '</div>' +
                  '<p class="mt-1 text-[0.7rem] font-semibold leading-snug text-ink/60">' + util.esc(shift.note || SHIFT_HINTS[shift.type] || '') + '</p>' +
                '</div>' +
                (canManage
                  ? '<button type="button" class="btn-icon-sm btn-ghost flex-none text-ink/25 hover:text-rose-600" data-delete-shift="' + util.esc(shift.id) + '" aria-label="Eliminar turno">' + ui.icon('trash-2', 'h-4 w-4') + '</button>'
                  : '') +
              '</div>' +
              '<div class="mt-3">' +
                '<div class="flex items-center justify-between gap-2 text-[0.65rem] font-bold text-ink/55">' +
                  '<span>' + shift.signups.length + ' de ' + shift.capacity + ' cupos ocupados</span>' +
                  '<span>' + (isFull ? 'Sin cupos' : (shift.capacity - shift.signups.length) + ' libre(s)') + '</span>' +
                '</div>' +
                '<div class="capacity-bar mt-1.5 ' + (isFull ? 'is-full' : '') + '"><span style="width:' + pct + '%"></span></div>' +
              '</div>' +
              '<div class="mt-3 flex flex-wrap items-center gap-1.5">' + people + '</div>' +
              '<div class="mt-3 flex justify-end">' + action + '</div>' +
            '</article>'
          );
        }).join('')
      : ui.emptyState({
          icon: 'calendar-days',
          title: isPastDay ? 'Este día ya pasó' : 'Día libre de turnos',
          text: isPastDay ? 'Revisa los próximos días de la semana.' : 'No hay turnos programados para esta fecha.',
          action: canManage && !isPastDay
            ? '<button type="button" class="btn btn-sm btn-primary mt-3" data-add-shift="' + selectedDate + '">' + ui.icon('plus', 'h-4 w-4') + ' Programar turno</button>'
            : ''
        });

    const myWeekHtml = myWeekShifts.length
      ? '<div class="space-y-2">' + myWeekShifts.map(function (shift) {
          const type = data.SHIFT_TYPES[shift.type] || data.SHIFT_TYPES.paseo;
          const t = ui.tone(type.tone);
          return (
            '<div class="flex items-center gap-2.5 rounded-xl border border-ink/[0.06] bg-white px-2.5 py-2">' +
              '<span class="grid h-8 w-8 flex-none place-items-center rounded-lg ' + t.ico + '">' + ui.icon(type.icon, 'h-3.5 w-3.5') + '</span>' +
              '<div class="min-w-0 flex-1">' +
                '<p class="text-[0.72rem] font-extrabold text-ink">' + util.esc(type.label) + ' · ' + prettyTime(shift.time) + '</p>' +
                '<p class="text-[0.62rem] font-semibold text-ink/55">' + util.esc(util.fmtDate(shift.date, { weekday: 'long', day: 'numeric', month: 'short' })) + '</p>' +
              '</div>' +
              '<span class="text-[0.6rem] font-extrabold uppercase text-brand-600">' + util.esc(util.relativeDays(shift.date)) + '</span>' +
            '</div>'
          );
        }).join('') + '</div>'
      : ui.emptyState({
          icon: 'hand-heart',
          title: 'Aún no tienes turnos',
          text: 'Elige un espacio de la semana y suma tu ayuda.',
          action: '<button type="button" class="btn btn-sm btn-secondary mt-3" data-jump-today>Ver turnos de hoy</button>'
        });

    root.innerHTML =
      '<div class="space-y-5">' +
        '<div class="grid gap-5 xl:grid-cols-3">' +
          '<div class="space-y-5 xl:col-span-2">' +
            '<section class="card-tinted reveal p-4 sm:p-5">' +
              '<div class="flex flex-wrap items-start justify-between gap-3">' +
                '<div class="flex items-start gap-3">' +
                  '<span class="grid h-11 w-11 flex-none place-items-center rounded-2xl bg-white text-2xl shadow-sm">' + pet.emoji + '</span>' +
                  '<div>' +
                    '<p class="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-brand-600/70">Agenda de cuidado</p>' +
                    '<h2 class="font-display text-xl font-semibold leading-tight text-ink">Turnos de ' + util.esc(pet.name) + '</h2>' +
                    '<p class="mt-0.5 text-[0.72rem] font-bold text-ink/60">' + util.esc(rangeLabel) + (weekOffset === 0 ? ' · Semana actual' : '') + '</p>' +
                  '</div>' +
                '</div>' +
                '<div class="flex items-center gap-1 rounded-full border border-ink/10 bg-white/70 p-1">' +
                  '<button type="button" class="btn-icon-sm btn-ghost" data-week-nav="-1" aria-label="Semana anterior">' + ui.icon('chevron-left', 'h-4 w-4') + '</button>' +
                  '<button type="button" class="btn btn-sm btn-ghost" data-week-today>Hoy</button>' +
                  '<button type="button" class="btn-icon-sm btn-ghost" data-week-nav="1" aria-label="Semana siguiente">' + ui.icon('chevron-right', 'h-4 w-4') + '</button>' +
                '</div>' +
              '</div>' +
              '<div class="mt-4 grid grid-cols-7 gap-1 rounded-2xl border border-ink/[0.06] bg-white/70 p-1.5 sm:gap-1.5">' + weekStrip + '</div>' +
              '<div class="mt-3 grid grid-cols-3 gap-2">' +
                '<div class="rounded-xl bg-white/80 px-2.5 py-2 ring-1 ring-ink/[0.04]"><p class="font-display text-lg font-semibold leading-none text-ink">' + weekShifts.length + '</p><p class="mt-1 text-[0.58rem] font-extrabold uppercase tracking-wide text-ink/55">Turnos</p></div>' +
                '<div class="rounded-xl bg-white/80 px-2.5 py-2 ring-1 ring-ink/[0.04]"><p class="font-display text-lg font-semibold leading-none text-ink">' + freeSlots + '</p><p class="mt-1 text-[0.58rem] font-extrabold uppercase tracking-wide text-ink/55">Cupos libres</p></div>' +
                '<div class="rounded-xl bg-white/80 px-2.5 py-2 ring-1 ring-ink/[0.04]"><p class="font-display text-lg font-semibold leading-none text-brand-700">' + myWeekShifts.length + '</p><p class="mt-1 text-[0.58rem] font-extrabold uppercase tracking-wide text-ink/55">Mis turnos</p></div>' +
              '</div>' +
            '</section>' +

            '<section class="card reveal p-5">' +
              '<div class="mb-4 flex flex-wrap items-start justify-between gap-2">' +
                '<div>' +
                  '<h2 class="font-display text-lg font-semibold text-ink">' + util.esc(util.fmtLongDate(selectedDate)) + '</h2>' +
                  '<p class="text-xs font-semibold text-ink/60">' + dayShifts.length + ' turno(s) programado(s)' + (isPastDay ? ' · este día ya pasó' : '') + '</p>' +
                '</div>' +
                (canManage && !isPastDay
                  ? '<button type="button" class="btn btn-sm btn-primary" data-add-shift="' + selectedDate + '">' + ui.icon('plus', 'h-4 w-4') + ' Añadir turno</button>'
                  : '') +
              '</div>' +
              (isPastDay
                ? '<div class="mb-3 flex items-center gap-2 rounded-xl bg-stone-100 px-3 py-2 text-[0.7rem] font-semibold text-ink/60">' + ui.icon('history', 'h-4 w-4') + ' Los turnos de días anteriores quedan solo como registro.</div>'
                : '') +
              '<div class="space-y-3">' + shiftCards + '</div>' +
            '</section>' +
          '</div>' +

          '<div class="space-y-5">' +
            '<section class="card reveal p-5">' +
              '<div class="mb-3 flex items-center justify-between gap-2">' +
                '<div>' +
                  '<h2 class="font-display text-lg font-semibold text-ink">Mi semana</h2>' +
                  '<p class="text-xs font-semibold text-ink/60">Los turnos en los que participas</p>' +
                '</div>' +
                ui.icon('hand-heart', 'h-5 w-5 text-brand-500/60') +
              '</div>' +
              myWeekHtml +
            '</section>' +

            '<section class="card reveal p-5">' +
              '<h2 class="font-display text-lg font-semibold text-ink">Cómo funciona</h2>' +
              '<div class="mt-3 space-y-3">' +
                '<div class="flex items-start gap-2.5">' +
                  '<span class="grid h-8 w-8 flex-none place-items-center rounded-lg bg-brand-50 text-brand-700">' + ui.icon('mouse-pointer-2', 'h-4 w-4') + '</span>' +
                  '<div><p class="text-xs font-extrabold text-ink">Elige un turno con cupo</p><p class="text-[0.68rem] font-semibold leading-snug text-ink/60">Inscríbete con un toque. Puedes cancelar si algo cambia.</p></div>' +
                '</div>' +
                '<div class="flex items-start gap-2.5">' +
                  '<span class="grid h-8 w-8 flex-none place-items-center rounded-lg bg-amber-50 text-amber-700">' + ui.icon('clock-3', 'h-4 w-4') + '</span>' +
                  '<div><p class="text-xs font-extrabold text-ink">Llega a tiempo</p><p class="text-[0.68rem] font-semibold leading-snug text-ink/60">Preséntate en la zona indicada y avisa al cuidador líder.</p></div>' +
                '</div>' +
                '<div class="flex items-start gap-2.5">' +
                  '<span class="grid h-8 w-8 flex-none place-items-center rounded-lg bg-sky-50 text-sky-700">' + ui.icon('notebook-pen', 'h-4 w-4') + '</span>' +
                  '<div><p class="text-xs font-extrabold text-ink">Registra el cuidado</p><p class="text-[0.68rem] font-semibold leading-snug text-ink/60">Añade una entrada a la bitácora para que quede constancia.</p></div>' +
                '</div>' +
              '</div>' +
              '<div class="mt-4 rounded-xl bg-stone-50 px-3 py-2.5 text-[0.68rem] font-semibold leading-relaxed text-ink/60">' +
                ui.icon('info', 'mr-1 inline h-3.5 w-3.5') +
                (canManage
                  ? 'Como administrador puedes crear turnos, quitar participantes y ajustar cupos.'
                  : 'Los cupos son limitados para que el cuidado sea seguro y acompañado.') +
              '</div>' +
            '</section>' +
          '</div>' +
        '</div>' +
      '</div>';

    root.addEventListener('click', function (event) {
      const day = event.target.closest('[data-day]');
      if (day) {
        selectedDate = day.getAttribute('data-day');
        PT.app.render();
        return;
      }

      const nav = event.target.closest('[data-week-nav]');
      if (nav) {
        const direction = parseInt(nav.getAttribute('data-week-nav'), 10) || 1;
        weekOffset += direction;
        const nextStart = util.addDays(currentWeekStart, weekOffset * 7);
        selectedDate = util.dateKey(nextStart);
        PT.app.render();
        return;
      }

      const todayButton = event.target.closest('[data-week-today], [data-jump-today]');
      if (todayButton) {
        weekOffset = 0;
        selectedDate = util.todayKey();
        PT.app.render();
        return;
      }

      const add = event.target.closest('[data-add-shift]');
      if (add) {
        openShiftModal(add.getAttribute('data-add-shift'));
        return;
      }

      const join = event.target.closest('[data-join]');
      if (join) {
        joinShift(join.getAttribute('data-join'));
        return;
      }

      const leave = event.target.closest('[data-leave]');
      if (leave) {
        leaveShift(leave.getAttribute('data-leave'));
        return;
      }

      const remove = event.target.closest('[data-remove-person]');
      if (remove) {
        removeParticipant(remove.getAttribute('data-shift'), parseInt(remove.getAttribute('data-remove-person'), 10));
        return;
      }

      const removeShift = event.target.closest('[data-delete-shift]');
      if (removeShift) {
        deleteShift(removeShift.getAttribute('data-delete-shift'));
      }
    });
  };
})();
