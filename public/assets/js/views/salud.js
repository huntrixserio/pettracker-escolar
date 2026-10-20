/* ==========================================================================
   Vista · Salud y bienestar
   ========================================================================== */
(function () {
  'use strict';

  const PT = window.PT;
  const store = PT.store;
  const ui = PT.ui;
  const util = PT.util;

  const FOODS = {
    perro: {
      allowed: [
        { title: 'Pollo cocido', detail: 'Sin hueso, sin sal ni condimentos.' },
        { title: 'Zanahoria y calabaza', detail: 'Cocidas o crudas, en trozos pequeños.' },
        { title: 'Arroz blanco', detail: 'Cocido, como complemento ocasional.' },
        { title: 'Manzana', detail: 'Sin semillas ni corazón.' }
      ],
      forbidden: [
        { title: 'Chocolate y café', detail: 'Tóxicos para el sistema nervioso.' },
        { title: 'Uvas y pasas', detail: 'Pueden causar daño renal.' },
        { title: 'Cebolla y ajo', detail: 'Afectan los glóbulos rojos.' },
        { title: 'Huesos cocidos', detail: 'Se astillan y pueden perforar el intestino.' },
        { title: 'Aguacate', detail: 'La persina es tóxica para los perros.' }
      ]
    },
    gato: {
      allowed: [
        { title: 'Pollo cocido', detail: 'Sin hueso ni condimentos.' },
        { title: 'Atún en agua', detail: 'Solo ocasional, sin aceite ni sal.' },
        { title: 'Calabaza cocida', detail: 'Buena para la digestión.' },
        { title: 'Croquetas específicas', detail: 'La base de su alimentación diaria.' }
      ],
      forbidden: [
        { title: 'Chocolate', detail: 'Altamente tóxico, incluso en poca cantidad.' },
        { title: 'Leche de vaca', detail: 'Suele causar diarrea en gatos adultos.' },
        { title: 'Cebolla y ajo', detail: 'Destruyen sus glóbulos rojos.' },
        { title: 'Uvas y pasas', detail: 'Riesgo de falla renal.' },
        { title: 'Atún con aceite', detail: 'Demasiada grasa y sal para su organismo.' }
      ]
    }
  };

  function preventionInfo(next) {
    const days = util.daysUntil(next);
    if (days < 0) return { label: 'Vencida', tone: 'rose', days: days, text: util.relativeDays(next) };
    if (days <= 7) return { label: 'Próxima', tone: 'amber', days: days, text: util.relativeDays(next) };
    return { label: 'Al día', tone: 'emerald', days: days, text: util.relativeDays(next) };
  }

  function healthDate(value) {
    return util.fmtDate(value, { day: 'numeric', month: 'short', year: '2-digit' });
  }

  function healthOverview(health) {
    const preventions = (health.vaccines || []).concat(health.dewormings || []);
    const overdue = [];
    const soon = [];
    let ok = 0;

    preventions.forEach(function (item) {
      if (!item.next) return;
      const info = preventionInfo(item.next);
      if (info.days < 0) overdue.push({ item: item, info: info });
      else if (info.days <= 7) soon.push({ item: item, info: info });
      else ok += 1;
    });

    const activeMeds = (health.meds || []).filter(function (med) {
      return med.active !== false && util.daysUntil(med.end) >= 0;
    });

    let label = 'Al día';
    let tone = 'emerald';
    if (overdue.length) {
      label = 'Requiere atención';
      tone = 'rose';
    } else if (soon.length) {
      label = 'Revisar pronto';
      tone = 'amber';
    }

    return {
      label: label,
      tone: tone,
      overdue: overdue,
      soon: soon,
      ok: ok,
      total: preventions.length,
      activeMeds: activeMeds,
      all: preventions
    };
  }

  function sortedWeights(health) {
    return (health.weights || []).slice().sort(function (a, b) { return a.date.localeCompare(b.date); });
  }

  function weightChart(records) {
    if (!records.length) {
      return '<div class="rounded-2xl bg-stone-50 p-6 text-center text-sm font-semibold text-ink/60">Aún no hay registros de peso.</div>';
    }
    if (records.length === 1) {
      return (
        '<div class="rounded-2xl bg-brand-50 p-6 text-center">' +
          '<p class="font-display text-3xl font-semibold text-brand-800">' + records[0].kg.toFixed(1) + ' kg</p>' +
          '<p class="mt-1 text-xs font-bold text-brand-700/60">Primer registro · ' + util.fmtDate(records[0].date) + '</p>' +
          '<p class="mt-2 text-[0.7rem] font-semibold text-ink/55">Agrega otro registro para ver la evolución.</p>' +
        '</div>'
      );
    }

    const w = 620;
    const h = 220;
    const left = 48;
    const right = 18;
    const top = 26;
    const bottom = 40;
    const values = records.map(function (r) { return r.kg; });
    let min = Math.min.apply(null, values) - 0.5;
    let max = Math.max.apply(null, values) + 0.5;
    if (max - min < 1) {
      const mid = (max + min) / 2;
      min = mid - 0.5;
      max = mid + 0.5;
    }

    function xAt(index) {
      return left + (index * (w - left - right)) / Math.max(records.length - 1, 1);
    }
    function yAt(kg) {
      return top + ((max - kg) / (max - min)) * (h - top - bottom);
    }

    const points = records.map(function (record, index) {
      return { x: xAt(index), y: yAt(record.kg), kg: record.kg, date: record.date, index: index };
    });

    const line = points.map(function (point, index) {
      return (index ? 'L' : 'M') + point.x.toFixed(1) + ',' + point.y.toFixed(1);
    }).join(' ');
    const area = line + ' L' + points[points.length - 1].x.toFixed(1) + ',' + (h - bottom) +
      ' L' + points[0].x.toFixed(1) + ',' + (h - bottom) + ' Z';

    const grid = [0, 1, 2].map(function (i) {
      const value = max - ((max - min) / 2) * i;
      const y = yAt(value);
      return (
        '<line x1="' + left + '" y1="' + y + '" x2="' + (w - right) + '" y2="' + y + '" stroke="#26332c" stroke-opacity="0.07" stroke-dasharray="4 5"></line>' +
        '<text x="' + (left - 9) + '" y="' + (y + 3.5) + '" text-anchor="end" font-size="10.5" font-weight="700" fill="#26332c" fill-opacity="0.34">' + value.toFixed(1) + '</text>'
      );
    }).join('');

    const xLabels = [0, Math.floor((points.length - 1) / 2), points.length - 1]
      .filter(function (value, index, arr) { return arr.indexOf(value) === index; })
      .map(function (index) {
        const point = points[index];
        return '<text x="' + point.x + '" y="' + (h - 16) + '" text-anchor="middle" font-size="10.5" font-weight="700" fill="#26332c" fill-opacity="0.4">' + util.esc(util.fmtDate(point.date)) + '</text>';
      }).join('');

    const dots = points.map(function (point) {
      const last = point.index === points.length - 1;
      return (
        '<circle cx="' + point.x + '" cy="' + point.y + '" r="' + (last ? 6 : 4.5) + '" class="chart-dot">' +
          '<title>' + util.esc(util.fmtLongDate(point.date) + ': ' + point.kg.toFixed(1) + ' kg') + '</title>' +
        '</circle>' +
        (last
          ? '<g><rect x="' + (point.x - 26) + '" y="' + (point.y - 31) + '" width="52" height="20" rx="7" fill="#245a45"></rect>' +
              '<text x="' + point.x + '" y="' + (point.y - 17) + '" text-anchor="middle" font-size="10.5" font-weight="800" fill="#ffffff">' + point.kg.toFixed(1) + ' kg</text></g>'
          : '')
      );
    }).join('');

    const firstKg = records[0].kg;
    const lastKg = records[records.length - 1].kg;
    const delta = lastKg - firstKg;

    return (
      '<div class="chart-wrap">' +
        '<div aria-hidden="true">' +
          '<svg viewBox="0 0 ' + w + ' ' + h + '" role="img" aria-label="Evolución del peso: desde ' + firstKg.toFixed(1) + ' kilogramos hasta ' + lastKg.toFixed(1) + ' kilogramos">' +
            '<defs><linearGradient id="weightArea" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#51a47c" stop-opacity="0.28"/><stop offset="100%" stop-color="#51a47c" stop-opacity="0.02"/></linearGradient></defs>' +
            grid +
            '<path d="' + area + '" fill="url(#weightArea)"></path>' +
            '<path d="' + line + '" class="chart-line"></path>' +
            dots +
            xLabels +
          '</svg>' +
        '</div>' +
        '<div class="mt-1 flex flex-wrap items-center justify-between gap-2 px-1">' +
          '<span class="text-[0.68rem] font-bold text-ink/55">Últimos ' + records.length + ' registros</span>' +
          '<span class="chip-soft ' + (delta >= 0 ? 'bg-emerald-50 text-emerald-700 ring-1 ring-emerald-200' : 'bg-amber-50 text-amber-800 ring-1 ring-amber-200') + '">' +
            ui.icon(delta >= 0 ? 'trending-up' : 'trending-down', 'h-3.5 w-3.5') +
            (delta >= 0 ? '+' : '') + delta.toFixed(1) + ' kg en el periodo' +
          '</span>' +
        '</div>' +
      '</div>'
    );
  }

  function sectionTitle(iconName, title, subtitle, action) {
    return (
      '<div class="mb-4 flex flex-wrap items-start justify-between gap-2">' +
        '<div class="flex items-start gap-2.5">' +
          '<span class="mt-0.5 grid h-8 w-8 flex-none place-items-center rounded-lg bg-brand-50 text-brand-700">' + ui.icon(iconName, 'h-4 w-4') + '</span>' +
          '<div>' +
            '<h2 class="font-display text-lg font-semibold leading-tight text-ink">' + util.esc(title) + '</h2>' +
            '<p class="text-xs font-semibold text-ink/60">' + util.esc(subtitle) + '</p>' +
          '</div>' +
        '</div>' +
        (action || '') +
      '</div>'
    );
  }

  function adminAction(iconName, label, attrs, extraClass) {
    return '<button type="button" class="btn-icon-sm btn-ghost ' + (extraClass || '') + '" ' + attrs + ' aria-label="' + util.esc(label) + '" title="' + util.esc(label) + '">' + ui.icon(iconName, 'h-3.5 w-3.5') + '</button>';
  }

  /* ------------------------------------------------------------------------
     Modales del expediente
     ------------------------------------------------------------------------ */
  function openWeightModal() {
    if (!store.can('health')) {
      ui.toast('Solo el equipo veterinario puede registrar el peso.', 'error');
      return;
    }
    const pet = store.currentPet();
    ui.openModal({
      title: 'Registrar peso',
      subtitle: 'Nuevo punto en la evolución de ' + pet.name,
      icon: 'scale',
      content:
        '<form id="weight-form" class="space-y-4">' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="weight-date">Fecha</label>' +
              '<input class="field" id="weight-date" name="date" type="date" required value="' + util.todayKey() + '" max="' + util.todayKey() + '">' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="weight-kg">Peso (kg)</label>' +
              '<input class="field" id="weight-kg" name="kg" type="number" min="0.3" max="90" step="0.1" required placeholder="Ej. 13.2" data-autofocus>' +
            '</div>' +
          '</div>' +
          '<p class="rounded-xl bg-brand-50 px-3 py-2 text-[0.72rem] font-semibold text-brand-800">Un registro por fecha. El gráfico se actualiza automáticamente.</p>' +
        '</form>',
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="weight-form" class="btn btn-primary">' + ui.icon('check', 'h-4 w-4') + ' Guardar peso</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#weight-form');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const fd = new FormData(form);
          const date = (fd.get('date') || util.todayKey()).toString();
          const kg = parseFloat((fd.get('kg') || '').toString());
          if (!date || Number.isNaN(kg) || kg <= 0) {
            ui.toast('Ingresa una fecha y un peso válidos.', 'error');
            return;
          }
          ui.closeModal();
          store.update(function (draft) {
            const health = draft.health[pet.id];
            health.weights = health.weights.filter(function (item) { return item.date !== date; });
            health.weights.push({ id: util.uid('weight'), date: date, kg: Math.round(kg * 10) / 10 });
            health.weights.sort(function (a, b) { return a.date.localeCompare(b.date); });
          });
          ui.toast('Peso registrado: ' + kg.toFixed(1) + ' kg.', 'success');
        });
      }
    });
  }

  function openPreventionModal(kind, existing) {
    if (!store.can('health')) {
      ui.toast('Solo el equipo veterinario puede editar el esquema de prevención.', 'error');
      return;
    }
    const pet = store.currentPet();
    const isVaccine = kind === 'vaccine';
    const item = existing || null;
    const title = (isVaccine ? (item ? 'Editar vacuna' : 'Programar vacuna') : (item ? 'Editar desparasitación' : 'Programar desparasitación'));
    const label = isVaccine ? 'vacuna' : 'tratamiento';

    ui.openModal({
      title: title,
      subtitle: item ? item.name : 'Añade un nuevo control al esquema de ' + pet.name,
      icon: isVaccine ? 'syringe' : 'shield-plus',
      content:
        '<form id="prevention-form" class="space-y-4">' +
          '<div>' +
            '<label class="field-label" for="prev-name">Nombre de la ' + label + '</label>' +
            '<input class="field" id="prev-name" name="name" required maxlength="60" value="' + util.esc(item ? item.name : '') + '" placeholder="' + (isVaccine ? 'Ej. Antirrábica' : 'Ej. Desparasitación interna') + '" data-autofocus>' +
          '</div>' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="prev-last">Última aplicación</label>' +
              '<input class="field" id="prev-last" name="last" type="date" required value="' + util.esc(item && item.last ? item.last : util.todayKey()) + '" max="' + util.todayKey() + '">' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="prev-next">Próxima dosis</label>' +
              '<input class="field" id="prev-next" name="next" type="date" required value="' + util.esc(item && item.next ? item.next : util.dateOnly(isVaccine ? 365 : 90)) + '">' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="field-label" for="prev-notes">Notas (opcional)</label>' +
            '<input class="field" id="prev-notes" name="notes" maxlength="120" value="' + util.esc(item && item.notes ? item.notes : '') + '" placeholder="Marca, lote o indicaciones">' +
          '</div>' +
          '<p class="rounded-xl bg-amber-50 px-3 py-2 text-[0.72rem] font-semibold text-amber-900/75">El estado se calcula solo: <strong>Al día</strong>, <strong>Próxima</strong> (7 días antes) o <strong>Vencida</strong>.</p>' +
        '</form>',
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="prevention-form" class="btn btn-primary">' + ui.icon('check', 'h-4 w-4') + ' Guardar</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#prevention-form');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const fd = new FormData(form);
          const name = (fd.get('name') || '').toString().trim();
          const last = (fd.get('last') || '').toString();
          const next = (fd.get('next') || '').toString();
          const notes = (fd.get('notes') || '').toString().trim();
          if (!name || !last || !next) {
            ui.toast('Completa el nombre y ambas fechas.', 'error');
            return;
          }
          if (new Date(next) < new Date(last)) {
            ui.toast('La próxima dosis no puede ser anterior a la última aplicación.', 'error');
            return;
          }
          ui.closeModal();
          store.update(function (draft) {
            const health = draft.health[pet.id];
            const list = isVaccine ? health.vaccines : health.dewormings;
            if (item) {
              const target = list.find(function (record) { return record.id === item.id; });
              if (target) {
                target.name = name;
                target.last = last;
                target.next = next;
                target.notes = notes;
              }
            } else {
              list.push({
                id: util.uid(isVaccine ? 'vac' : 'dew'),
                name: name,
                last: last,
                next: next,
                notes: notes
              });
            }
          });
          ui.toast(isVaccine ? 'Vacuna guardada.' : 'Control guardado.', 'success');
        });
      }
    });
  }

  function openMedModal() {
    if (!store.can('health')) {
      ui.toast('Solo el equipo veterinario puede gestionar medicamentos.', 'error');
      return;
    }
    const pet = store.currentPet();
    ui.openModal({
      title: 'Añadir medicamento',
      subtitle: 'Tratamiento activo para ' + pet.name,
      icon: 'pill',
      content:
        '<form id="med-form" class="space-y-4">' +
          '<div>' +
            '<label class="field-label" for="med-name">Nombre</label>' +
            '<input class="field" id="med-name" name="name" required maxlength="60" placeholder="Ej. Bravecto" data-autofocus>' +
          '</div>' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="med-dose">Dosis</label>' +
              '<input class="field" id="med-dose" name="dose" required maxlength="60" placeholder="Ej. 1 tableta">' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="med-frequency">Frecuencia</label>' +
              '<input class="field" id="med-frequency" name="frequency" required maxlength="60" placeholder="Ej. Cada 24 horas">' +
            '</div>' +
          '</div>' +
          '<div class="grid gap-3 sm:grid-cols-2">' +
            '<div>' +
              '<label class="field-label" for="med-start">Inicio</label>' +
              '<input class="field" id="med-start" name="start" type="date" required value="' + util.todayKey() + '" max="' + util.todayKey() + '">' +
            '</div>' +
            '<div>' +
              '<label class="field-label" for="med-end">Fin</label>' +
              '<input class="field" id="med-end" name="end" type="date" required value="' + util.dateOnly(30) + '">' +
            '</div>' +
          '</div>' +
          '<div>' +
            '<label class="field-label" for="med-notes">Indicaciones (opcional)</label>' +
            '<input class="field" id="med-notes" name="notes" maxlength="120" placeholder="Ej. Administrar con alimento">' +
          '</div>' +
        '</form>',
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="med-form" class="btn btn-primary">' + ui.icon('check', 'h-4 w-4') + ' Guardar medicamento</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#med-form');
        form.addEventListener('submit', function (event) {
          event.preventDefault();
          const fd = new FormData(form);
          const name = (fd.get('name') || '').toString().trim();
          const dose = (fd.get('dose') || '').toString().trim();
          const frequency = (fd.get('frequency') || '').toString().trim();
          const start = (fd.get('start') || '').toString();
          const end = (fd.get('end') || '').toString();
          const notes = (fd.get('notes') || '').toString().trim();
          if (!name || !dose || !frequency || !start || !end) {
            ui.toast('Completa todos los campos obligatorios.', 'error');
            return;
          }
          if (new Date(end) < new Date(start)) {
            ui.toast('La fecha de fin no puede ser anterior al inicio.', 'error');
            return;
          }
          ui.closeModal();
          store.update(function (draft) {
            draft.health[pet.id].meds.push({
              id: util.uid('med'),
              name: name,
              dose: dose,
              frequency: frequency,
              start: start,
              end: end,
              active: true,
              notes: notes
            });
          });
          ui.toast('Medicamento añadido al expediente.', 'success');
        });
      }
    });
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  PT.views = PT.views || {};

  PT.views.salud = function (root) {
    const state = store.getState();
    const pet = store.currentPet();
    const health = store.currentHealth();
    const canEdit = store.can('health');
    const overview = healthOverview(health);
    const weights = sortedWeights(health);
    const latest = weights[weights.length - 1];
    const previous = weights[weights.length - 2];
    const weightDelta = latest && previous ? latest.kg - previous.kg : null;
    const foods = FOODS[pet.species] || FOODS.perro;
    const activeMeds = (health.meds || []).filter(function (med) {
      return med.active !== false && util.daysUntil(med.end) >= 0;
    });
    const overdueOrSoon = overview.overdue.concat(overview.soon);

    const healthTone = ui.tone(overview.tone);

    const alertBanner = overdueOrSoon.length
      ? '<div class="rounded-2xl border border-amber-200 bg-amber-50/80 p-4">' +
          '<div class="flex items-start gap-2.5">' +
            '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl bg-amber-100 text-amber-700">' + ui.icon('bell-ring', 'h-4 w-4') + '</span>' +
            '<div class="min-w-0 flex-1">' +
              '<h3 class="text-sm font-extrabold text-amber-950">' + (overview.overdue.length ? 'Hay controles vencidos' : 'Controles próximos') + '</h3>' +
              '<p class="text-[0.72rem] font-semibold leading-snug text-amber-900/60">Revisa el esquema de prevención de ' + util.esc(pet.name) + '. Un administrador puede actualizar las fechas.</p>' +
              '<div class="mt-2 flex flex-wrap gap-1.5">' +
                overdueOrSoon.map(function (entry) {
                  return '<span class="chip-soft ' + ui.tone(entry.info.tone).chip + '">' + ui.icon('calendar-clock', 'h-3.5 w-3.5') + util.esc(entry.item.name) + ' · ' + util.esc(entry.info.text) + '</span>';
                }).join('') +
              '</div>' +
            '</div>' +
          '</div>' +
        '</div>'
      : '<div class="flex items-center gap-2.5 rounded-2xl border border-emerald-200 bg-emerald-50/70 p-4">' +
          '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl bg-emerald-100 text-emerald-700">' + ui.icon('badge-check', 'h-4 w-4') + '</span>' +
          '<div><p class="text-sm font-extrabold text-emerald-950">Esquema de prevención al día</p>' +
          '<p class="text-[0.72rem] font-semibold text-emerald-900/55">No hay vacunas ni desparasitaciones vencidas o próximas en los siguientes 7 días.</p></div>' +
        '</div>';

    const weightList = weights.length
      ? weights.slice().reverse().map(function (record, index) {
          const isLatest = index === 0;
          return (
            '<div class="weight-item flex items-center gap-2">' +
              '<div class="min-w-0 flex-1">' +
                '<p class="text-xs font-extrabold text-ink">' + record.kg.toFixed(1) + ' kg' + (isLatest ? ' <span class="ml-1 chip-soft bg-brand-50 text-brand-700 ring-1 ring-brand-100">Actual</span>' : '') + '</p>' +
                '<p class="text-[0.65rem] font-semibold text-ink/55">' + util.fmtDate(record.date, { day: 'numeric', month: 'long', year: 'numeric' }) + '</p>' +
              '</div>' +
              (canEdit
                ? adminAction('trash-2', 'Eliminar registro de peso', 'data-delete-weight="' + util.esc(record.id) + '"', 'text-ink/25 hover:text-rose-600')
                : '') +
            '</div>'
          );
        }).join('')
      : '<p class="text-xs font-semibold text-ink/55">Sin registros todavía.</p>';

    function preventionRows(list, kind) {
      if (!list.length) {
        return ui.emptyState({
          icon: kind === 'vaccine' ? 'syringe' : 'shield-plus',
          title: 'Sin registros',
          text: 'Agrega el primer control para activar las alertas.',
          action: canEdit ? '<button type="button" class="btn btn-sm btn-secondary mt-3" data-add-prevention="' + kind + '">Añadir ahora</button>' : ''
        });
      }
      return '<div class="space-y-2.5">' + list.map(function (item) {
        const info = preventionInfo(item.next);
        const t = ui.tone(info.tone);
        return (
          '<div class="rounded-2xl border border-ink/[0.07] bg-white p-3">' +
            '<div class="flex items-start gap-2.5">' +
              '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl ' + t.ico + '">' + ui.icon(kind === 'vaccine' ? 'syringe' : 'shield-plus', 'h-4 w-4') + '</span>' +
              '<div class="min-w-0 flex-1">' +
                '<div class="flex flex-wrap items-center justify-between gap-1.5">' +
                  '<p class="text-[0.82rem] font-extrabold text-ink">' + util.esc(item.name) + '</p>' +
                  ui.badge(info.label, info.tone) +
                '</div>' +
                '<p class="mt-1 text-[0.68rem] font-semibold text-ink/60">' +
                  'Última: ' + healthDate(item.last) + ' · Próxima: ' + healthDate(item.next) +
                '</p>' +
                (item.notes ? '<p class="mt-0.5 text-[0.68rem] font-semibold text-ink/55">' + util.esc(item.notes) + '</p>' : '') +
                '<p class="mt-1 text-[0.64rem] font-extrabold ' + t.text + '">' + util.esc(info.text) + '</p>' +
              '</div>' +
              (canEdit
                ? '<div class="flex flex-none flex-col gap-0.5 sm:flex-row">' +
                    adminAction('pencil', 'Editar ' + item.name, 'data-edit-prevention="' + util.esc(item.id) + '" data-kind="' + kind + '"') +
                    adminAction('trash-2', 'Eliminar ' + item.name, 'data-delete-prevention="' + util.esc(item.id) + '" data-kind="' + kind + '"', 'text-ink/25 hover:text-rose-600') +
                  '</div>'
                : '') +
            '</div>' +
          '</div>'
        );
      }).join('') + '</div>';
    }

    const medsHtml = (health.meds || []).length
      ? '<div class="space-y-2.5">' + (health.meds || []).map(function (med) {
          const daysLeft = util.daysUntil(med.end);
          const active = med.active !== false && daysLeft >= 0;
          return (
            '<div class="rounded-2xl border border-ink/[0.07] bg-white p-3.5">' +
              '<div class="flex items-start gap-2.5">' +
                '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl ' + (active ? 'bg-violet-100 text-violet-700' : 'bg-stone-100 text-stone-500') + '">' + ui.icon('pill', 'h-4 w-4') + '</span>' +
                '<div class="min-w-0 flex-1">' +
                  '<div class="flex flex-wrap items-center justify-between gap-1.5">' +
                    '<p class="text-[0.84rem] font-extrabold text-ink">' + util.esc(med.name) + '</p>' +
                    ui.badge(active ? 'Activo' : 'Finalizado', active ? 'violet' : 'slate') +
                  '</div>' +
                  '<p class="mt-0.5 text-[0.7rem] font-semibold text-ink/60">' + util.esc(med.dose) + ' · ' + util.esc(med.frequency) + '</p>' +
                  '<p class="mt-1 text-[0.65rem] font-semibold text-ink/55">' + util.fmtDate(med.start) + ' → ' + util.fmtDate(med.end) + (active ? ' · ' + util.relativeDays(med.end) : '') + '</p>' +
                  (med.notes ? '<p class="mt-0.5 text-[0.65rem] font-semibold text-ink/55">' + util.esc(med.notes) + '</p>' : '') +
                '</div>' +
                (canEdit
                  ? '<div class="flex flex-none flex-col gap-0.5 sm:flex-row">' +
                      (active ? adminAction('check', 'Finalizar tratamiento', 'data-finish-med="' + util.esc(med.id) + '"') : '') +
                      adminAction('trash-2', 'Eliminar medicamento', 'data-delete-med="' + util.esc(med.id) + '"', 'text-ink/25 hover:text-rose-600') +
                    '</div>'
                  : '') +
              '</div>' +
            '</div>'
          );
        }).join('') + '</div>'
      : ui.emptyState({
          icon: 'pill',
          title: 'Sin medicamentos activos',
          text: 'Cuando se formule un tratamiento aparecerá aquí con su dosis y duración.',
          action: canEdit ? '<button type="button" class="btn btn-sm btn-secondary mt-3" data-add-med>Añadir medicamento</button>' : ''
        });

    function foodList(items, allowed) {
      const style = allowed
        ? 'bg-emerald-50 text-emerald-900'
        : 'bg-rose-50 text-rose-900';
      const iconName = allowed ? 'check-circle-2' : 'x-circle';
      return '<div class="space-y-1.5">' + items.map(function (item) {
        return (
          '<div class="food-chip ' + style + '">' +
            '<span class="mt-0.5 flex-none">' + ui.icon(iconName, 'h-4 w-4 ' + (allowed ? 'text-emerald-600' : 'text-rose-500')) + '</span>' +
            '<span><strong class="block font-extrabold">' + util.esc(item.title) + '</strong><span class="font-semibold opacity-65">' + util.esc(item.detail) + '</span></span>' +
          '</div>'
        );
      }).join('') + '</div>';
    }

    root.innerHTML =
      '<div class="space-y-5">' +
        '<section class="card reveal overflow-hidden">' +
          '<div class="bg-gradient-to-br from-brand-50 via-white to-amber-50/50 p-5 sm:p-6">' +
            '<div class="flex flex-wrap items-start justify-between gap-4">' +
              '<div class="flex items-start gap-3.5">' +
                '<span class="grid h-16 w-16 flex-none place-items-center rounded-2xl bg-white text-4xl shadow-sm">' + pet.emoji + '</span>' +
                '<div>' +
                  '<p class="text-[0.62rem] font-extrabold uppercase tracking-[0.18em] text-brand-600/70">Expediente médico</p>' +
                  '<h2 class="mt-0.5 font-display text-2xl font-semibold leading-tight text-ink">Salud de ' + util.esc(pet.name) + '</h2>' +
                  '<p class="mt-1 text-xs font-semibold text-ink/60">' + util.esc(pet.breed) + ' · ' + util.esc(pet.age) + ' · ' + util.esc(health.vet || 'Sin veterinario asignado') + '</p>' +
                  '<p class="mt-2 flex items-start gap-1.5 text-[0.7rem] font-semibold leading-snug text-ink/60">' + ui.icon('alert-circle', 'mt-0.5 h-3.5 w-3.5 flex-none text-amber-500') + util.esc(health.allergies || 'Sin alergias registradas.') + '</p>' +
                '</div>' +
              '</div>' +
              '<span class="inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs font-extrabold ring-1 ' + healthTone.chip + '">' +
                ui.icon(overview.overdue.length ? 'alert-triangle' : 'heart-pulse', 'h-4 w-4') + overview.label +
              '</span>' +
            '</div>' +
            '<div class="mt-5 grid grid-cols-3 gap-2">' +
              '<div class="min-w-0 rounded-2xl bg-white/80 px-2 py-2.5 ring-1 ring-ink/[0.05] sm:px-3">' +
                '<p class="text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Peso actual</p>' +
                '<p class="mt-0.5 font-display text-xl font-semibold leading-none text-ink">' + (latest ? latest.kg.toFixed(1) + ' <span class="text-xs">kg</span>' : '—') + '</p>' +
                '<p class="mt-1 text-[0.6rem] font-bold ' + (weightDelta && weightDelta > 0 ? 'text-emerald-600' : weightDelta && weightDelta < 0 ? 'text-amber-600' : 'text-ink/55') + '">' +
                  (weightDelta === null ? 'Sin comparación' : (weightDelta >= 0 ? '+' : '') + weightDelta.toFixed(1) + ' kg vs. anterior') +
                '</p>' +
              '</div>' +
              '<div class="min-w-0 rounded-2xl bg-white/80 px-2 py-2.5 ring-1 ring-ink/[0.05] sm:px-3">' +
                '<p class="text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Prevención</p>' +
                '<p class="mt-0.5 font-display text-xl font-semibold leading-none text-ink">' + overview.ok + '/' + overview.total + '</p>' +
                '<p class="mt-1 text-[0.6rem] font-bold text-ink/55">controles al día</p>' +
              '</div>' +
              '<div class="min-w-0 rounded-2xl bg-white/80 px-2 py-2.5 ring-1 ring-ink/[0.05] sm:px-3">' +
                '<p class="text-[0.6rem] font-extrabold uppercase tracking-wide text-ink/55">Medicamentos</p>' +
                '<p class="mt-0.5 font-display text-xl font-semibold leading-none text-ink">' + activeMeds.length + '</p>' +
                '<p class="mt-1 text-[0.6rem] font-bold text-ink/55">activos ahora</p>' +
              '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        alertBanner +

        '<section class="card reveal p-5" id="health-weight">' +
          sectionTitle(
            'scale',
            'Control de peso',
            'Evolución de ' + pet.name + ' en los últimos meses',
            canEdit ? '<button type="button" class="btn btn-sm btn-primary" data-add-weight>' + ui.icon('plus', 'h-4 w-4') + ' Registrar peso</button>' : ''
          ) +
          '<div class="grid gap-4 lg:grid-cols-[1.7fr_1fr]">' +
            '<div>' + weightChart(weights) + '</div>' +
            '<div class="rounded-2xl bg-stone-50/80 p-3.5">' +
              '<p class="mb-2 text-[0.62rem] font-extrabold uppercase tracking-wide text-ink/55">Historial</p>' +
              '<div class="weight-rail">' + weightList + '</div>' +
            '</div>' +
          '</div>' +
        '</section>' +

        '<div class="grid gap-5 xl:grid-cols-2">' +
          '<section class="card reveal p-5" id="health-vaccines">' +
            sectionTitle(
              'syringe',
              'Vacunación',
              'Refuerzos y estado de cada vacuna',
              canEdit ? '<button type="button" class="btn btn-sm btn-secondary" data-add-prevention="vaccine">' + ui.icon('plus', 'h-4 w-4') + ' Añadir</button>' : ''
            ) +
            preventionRows(health.vaccines || [], 'vaccine') +
          '</section>' +

          '<section class="card reveal p-5" id="health-deworming">' +
            sectionTitle(
              'shield-plus',
              'Desparasitación',
              'Protección interna y externa',
              canEdit ? '<button type="button" class="btn btn-sm btn-secondary" data-add-prevention="deworm">' + ui.icon('plus', 'h-4 w-4') + ' Añadir</button>' : ''
            ) +
            preventionRows(health.dewormings || [], 'deworm') +
          '</section>' +
        '</div>' +

        '<section class="card reveal p-5" id="health-meds">' +
          sectionTitle(
            'pill',
            'Medicamentos',
            'Tratamientos formulados por la veterinaria',
            canEdit ? '<button type="button" class="btn btn-sm btn-secondary" data-add-med>' + ui.icon('plus', 'h-4 w-4') + ' Añadir</button>' : ''
          ) +
          medsHtml +
        '</section>' +

        '<section class="card reveal p-5" id="health-foods">' +
          sectionTitle(
            'apple',
            'Guía de alimentos',
            'Qué puede compartir la comunidad con ' + pet.name,
            ''
          ) +
          '<div class="mb-4 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5">' +
            ui.icon('triangle-alert', 'mt-0.5 h-4 w-4 flex-none text-amber-600') +
            '<p class="text-[0.72rem] font-semibold leading-relaxed text-amber-900/75"><strong>Nunca compartas snacks sin preguntar.</strong> Ante cualquier duda, consulta a la veterinaria o al docente encargado.</p>' +
          '</div>' +
          '<div class="grid gap-4 lg:grid-cols-2">' +
            '<div>' +
              '<h3 class="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-emerald-700">' + ui.icon('check-circle-2', 'h-4 w-4') + ' Permitidos (con moderación)</h3>' +
              foodList(foods.allowed, true) +
            '</div>' +
            '<div>' +
              '<h3 class="mb-2 flex items-center gap-1.5 text-xs font-extrabold uppercase tracking-wide text-rose-600">' + ui.icon('x-circle', 'h-4 w-4') + ' Prohibidos</h3>' +
              foodList(foods.forbidden, false) +
            '</div>' +
          '</div>' +
          '<p class="mt-4 text-[0.65rem] font-semibold text-ink/55">Esta guía es informativa y no reemplaza la valoración de un veterinario.</p>' +
        '</section>' +
      '</div>';

    root.addEventListener('click', function (event) {
      const addWeight = event.target.closest('[data-add-weight]');
      if (addWeight) {
        openWeightModal();
        return;
      }

      const addPrevention = event.target.closest('[data-add-prevention]');
      if (addPrevention) {
        openPreventionModal(addPrevention.getAttribute('data-add-prevention'));
        return;
      }

      const editPrevention = event.target.closest('[data-edit-prevention]');
      if (editPrevention) {
        const id = editPrevention.getAttribute('data-edit-prevention');
        const kind = editPrevention.getAttribute('data-kind');
        const list = kind === 'vaccine' ? health.vaccines : health.dewormings;
        const item = (list || []).find(function (record) { return record.id === id; });
        if (item) openPreventionModal(kind, item);
        return;
      }

      const deletePrevention = event.target.closest('[data-delete-prevention]');
      if (deletePrevention) {
        if (!store.can('health')) {
          ui.toast('Solo el equipo veterinario puede eliminar controles.', 'error');
          return;
        }
        const id = deletePrevention.getAttribute('data-delete-prevention');
        const kind = deletePrevention.getAttribute('data-kind');
        const list = kind === 'vaccine' ? health.vaccines : health.dewormings;
        const item = (list || []).find(function (record) { return record.id === id; });
        if (!item) return;
        ui.confirm({
          title: 'Eliminar control',
          message: 'Se eliminará “' + item.name + '” del expediente de ' + pet.name + '.',
          confirmLabel: 'Eliminar',
          icon: 'trash-2'
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.update(function (draft) {
            const targetHealth = draft.health[pet.id];
            if (kind === 'vaccine') {
              targetHealth.vaccines = targetHealth.vaccines.filter(function (record) { return record.id !== id; });
            } else {
              targetHealth.dewormings = targetHealth.dewormings.filter(function (record) { return record.id !== id; });
            }
          });
          ui.toast('Control eliminado.', 'info');
        });
        return;
      }

      const deleteWeight = event.target.closest('[data-delete-weight]');
      if (deleteWeight) {
        if (!store.can('health')) {
          ui.toast('Solo el equipo veterinario puede eliminar registros.', 'error');
          return;
        }
        const id = deleteWeight.getAttribute('data-delete-weight');
        ui.confirm({
          title: 'Eliminar registro de peso',
          message: 'El punto se quitará del historial y del gráfico.',
          confirmLabel: 'Eliminar',
          icon: 'trash-2'
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.update(function (draft) {
            const targetHealth = draft.health[pet.id];
            targetHealth.weights = targetHealth.weights.filter(function (record) { return record.id !== id; });
          });
          ui.toast('Registro eliminado.', 'info');
        });
        return;
      }

      const addMed = event.target.closest('[data-add-med]');
      if (addMed) {
        openMedModal();
        return;
      }

      const finishMed = event.target.closest('[data-finish-med]');
      if (finishMed) {
        if (!store.can('health')) {
          ui.toast('Solo el equipo veterinario puede finalizar tratamientos.', 'error');
          return;
        }
        const id = finishMed.getAttribute('data-finish-med');
        const med = (health.meds || []).find(function (record) { return record.id === id; });
        if (!med) return;
        ui.confirm({
          title: 'Finalizar tratamiento',
          message: '“' + med.name + '” quedará marcado como finalizado hoy.',
          confirmLabel: 'Finalizar',
          danger: false,
          icon: 'check'
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.update(function (draft) {
            const target = draft.health[pet.id].meds.find(function (record) { return record.id === id; });
            if (target) {
              target.active = false;
              target.end = util.todayKey();
            }
          });
          ui.toast('Tratamiento finalizado.', 'success');
        });
        return;
      }

      const deleteMed = event.target.closest('[data-delete-med]');
      if (deleteMed) {
        if (!store.can('health')) {
          ui.toast('Solo el equipo veterinario puede eliminar medicamentos.', 'error');
          return;
        }
        const id = deleteMed.getAttribute('data-delete-med');
        const med = (health.meds || []).find(function (record) { return record.id === id; });
        if (!med) return;
        ui.confirm({
          title: 'Eliminar medicamento',
          message: 'Se eliminará “' + med.name + '” del expediente.',
          confirmLabel: 'Eliminar',
          icon: 'trash-2'
        }).then(function (confirmed) {
          if (!confirmed) return;
          store.update(function (draft) {
            const targetHealth = draft.health[pet.id];
            targetHealth.meds = targetHealth.meds.filter(function (record) { return record.id !== id; });
          });
          ui.toast('Medicamento eliminado.', 'info');
        });
      }
    });
  };
})();
