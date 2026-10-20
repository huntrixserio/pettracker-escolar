/* ==========================================================================
   PetTracker Escolar · shell, navegación y arranque de la aplicación
   ========================================================================== */
(function () {
  'use strict';

  const PT = window.PT;
  const store = PT.store;
  const ui = PT.ui;
  const util = PT.util;
  const data = PT.data;

  const ROUTES = {
    dashboard: {
      title: 'Inicio',
      mobileTitle: 'Inicio',
      eyebrow: 'Vista en vivo',
      mobileEyebrow: 'Vista en vivo',
      subtitle: 'Todo lo que pasa con nuestra mascota, al día.'
    },
    bitacora: {
      title: 'Bitácora',
      mobileTitle: 'Bitácora',
      eyebrow: 'Historia diaria',
      mobileEyebrow: 'Historia diaria',
      subtitle: 'Cada cuidado, cada paseo y cada foto de la comunidad.'
    },
    salud: {
      title: 'Salud y bienestar',
      mobileTitle: 'Salud',
      eyebrow: 'Expediente médico',
      mobileEyebrow: 'Bienestar',
      subtitle: 'Peso, vacunas, medicamentos y guía de alimentos.'
    },
    turnos: {
      title: 'Turnos y cuidado',
      mobileTitle: 'Turnos',
      eyebrow: 'Agenda semanal',
      mobileEyebrow: 'Agenda semanal',
      subtitle: 'Organiza los turnos de paseo, alimentación y limpieza.'
    },
    admin: {
      title: 'Administración',
      mobileTitle: 'Admin',
      eyebrow: 'Control total',
      mobileEyebrow: 'Control total',
      subtitle: 'Aprobaciones, mascotas, roles y datos de la app.'
    }
  };

  const installState = { prompt: null };
  let lastRenderedRoute = null;
  let storageWarningShown = false;

  function navItems() {
    const items = [
      { id: 'dashboard', label: 'Inicio', icon: 'layout-dashboard', short: 'Inicio' },
      { id: 'bitacora', label: 'Bitácora', icon: 'notebook-pen', short: 'Bitácora' },
      { id: 'salud', label: 'Salud', icon: 'heart-pulse', short: 'Salud' },
      { id: 'turnos', label: 'Turnos', icon: 'calendar-days', short: 'Turnos' }
    ];
    if (store.can('approve')) {
      items.push({
        id: 'admin',
        label: 'Administración',
        icon: 'shield-check',
        short: 'Admin',
        badge: store.pendingReports().length
      });
    }
    return items;
  }

  function routeFromHash() {
    const raw = (window.location.hash || '').replace(/^#\/?/, '').split('?')[0];
    return Object.prototype.hasOwnProperty.call(ROUTES, raw) ? raw : 'dashboard';
  }

  /* ------------------------------------------------------------------------
     Shell
     ------------------------------------------------------------------------ */
  function logoMark(size) {
    return (
      '<span class="grid ' + (size || 'h-11 w-11') + ' flex-none place-items-center rounded-2xl bg-brand-700 text-white shadow-soft">' +
        ui.icon('paw-print', 'h-6 w-6') +
      '</span>'
    );
  }

  function petChip(pet) {
    const status = PT.meta.status(pet.status.key);
    const zone = PT.meta.zone(pet.status.zone);
    return (
      '<button type="button" data-open-pets class="group flex min-h-11 items-center gap-2 rounded-full border border-ink/10 bg-white/85 py-1 pl-1.5 pr-2.5 text-left transition hover:border-brand-300 hover:bg-white" aria-label="Cambiar mascota activa: ' + util.esc(pet.name) + '">' +
        '<span class="grid h-8 w-8 flex-none place-items-center rounded-full bg-sand text-lg">' + pet.emoji + '</span>' +
        '<span class="hidden min-w-0 sm:block">' +
          '<span class="block truncate text-xs font-extrabold leading-tight text-ink">' + util.esc(pet.name) + '</span>' +
          '<span class="block truncate text-[0.65rem] font-bold leading-tight text-ink/60">' + util.esc(zone.name) + '</span>' +
        '</span>' +
        ui.icon('chevrons-up-down', 'h-4 w-4 flex-none text-ink/55 group-hover:text-brand-600') +
      '</button>'
    );
  }

  function profileChip(profile, role) {
    return (
      '<button type="button" data-open-profile class="flex min-h-11 items-center gap-2 rounded-full border border-ink/10 bg-white/85 py-1 pl-1 pr-2.5 text-left transition hover:border-brand-300 hover:bg-white" aria-label="Perfil y rol: ' + util.esc(role.title) + '">' +
        ui.avatar(profile.name, 'sm') +
        '<span class="hidden min-w-0 xl:block">' +
          '<span class="block max-w-[9rem] truncate text-xs font-extrabold leading-tight text-ink">' + util.esc(profile.name) + '</span>' +
          '<span class="block truncate text-[0.65rem] font-bold leading-tight text-ink/60">' + util.esc(role.label) + '</span>' +
        '</span>' +
        ui.icon('chevron-down', 'hidden h-3.5 w-3.5 flex-none text-ink/55 sm:block') +
      '</button>'
    );
  }

  function sidebar(activeRoute) {
    const state = store.getState();
    const pet = store.currentPet();
    const role = store.roleInfo();
    const items = navItems();
    const status = PT.meta.status(pet.status.key);
    const tone = PT.ui.tone(status.tone);

    return (
      '<aside class="fixed inset-y-0 left-0 z-40 hidden w-72 flex-col overflow-y-auto border-r border-ink/[0.07] bg-[#fbfaf4]/90 px-4 py-5 backdrop-blur lg:flex">' +
        '<a href="#/dashboard" class="flex items-center gap-3 rounded-2xl px-2 py-1" aria-label="PetTracker Escolar, ir al inicio">' +
          logoMark() +
          '<span>' +
            '<span class="block font-display text-xl font-semibold leading-none text-ink">PetTracker</span>' +
            '<span class="mt-1 block text-[0.62rem] font-extrabold uppercase tracking-[0.24em] text-brand-600">Escolar</span>' +
          '</span>' +
        '</a>' +

        '<button type="button" data-open-pets class="mt-6 w-full rounded-2xl border border-brand-100 bg-gradient-to-br from-brand-50 via-white to-white p-3.5 text-left transition hover:border-brand-200 hover:shadow-card">' +
          '<span class="flex items-center gap-2.5">' +
            '<span class="grid h-10 w-10 flex-none place-items-center rounded-xl bg-white text-2xl shadow-sm">' + pet.emoji + '</span>' +
            '<span class="min-w-0 flex-1">' +
              '<span class="block text-[0.6rem] font-extrabold uppercase tracking-[0.15em] text-brand-600/70">Mascota activa</span>' +
              '<span class="block truncate font-display text-base font-semibold text-ink">' + util.esc(pet.name) + '</span>' +
            '</span>' +
            ui.icon('chevrons-up-down', 'h-4 w-4 text-brand-700/40') +
          '</span>' +
          '<span class="mt-2.5 flex items-center gap-1.5 text-[0.7rem] font-bold text-ink/55">' +
            '<span class="h-1.5 w-1.5 rounded-full ' + tone.dot + '"></span>' +
            util.esc(status.label) + ' · ' + util.esc(PT.meta.zone(pet.status.zone).name) +
          '</span>' +
        '</button>' +

        '<nav class="mt-6" aria-label="Navegación principal">' +
          '<p class="mb-2 px-3 text-[0.6rem] font-extrabold uppercase tracking-[0.18em] text-ink/55">Menú</p>' +
          '<div class="space-y-1">' +
            items.map(function (item) {
              const active = item.id === activeRoute;
              return (
                '<a href="#/' + item.id + '" class="nav-link ' + (active ? 'is-active' : '') + '" ' + (active ? 'aria-current="page"' : '') + '>' +
                  '<span class="nav-ico">' + ui.icon(item.icon, 'h-[1.05rem] w-[1.05rem]') + '</span>' +
                  '<span class="flex-1">' + util.esc(item.label) + '</span>' +
                  (item.badge ? '<span class="grid h-5 min-w-5 place-items-center rounded-full bg-amber-400 px-1 text-[0.65rem] font-extrabold text-amber-950">' + item.badge + '</span>' : '') +
                '</a>'
              );
            }).join('') +
          '</div>' +
        '</nav>' +

        '<div class="mt-auto space-y-2.5 pt-5">' +
          '<button type="button" data-install class="flex w-full items-center gap-2.5 rounded-2xl border border-ink/10 bg-white/80 p-3 text-left transition hover:border-brand-200 hover:bg-white">' +
            '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl bg-brand-50 text-brand-700">' + ui.icon('download', 'h-4 w-4') + '</span>' +
            '<span class="min-w-0 flex-1">' +
              '<span class="block text-xs font-extrabold text-ink">Instalar la app</span>' +
              '<span class="block text-[0.65rem] font-semibold text-ink/60">Llévala en tu celular</span>' +
            '</span>' +
            ui.icon('arrow-up-right', 'h-3.5 w-3.5 text-ink/30') +
          '</button>' +

          '<div class="rounded-2xl border border-amber-200/70 bg-amber-50/80 px-3 py-2.5">' +
            '<p class="flex items-center gap-1.5 text-[0.65rem] font-extrabold uppercase tracking-wide text-amber-800">' +
              ui.icon('flask-conical', 'h-3.5 w-3.5') + ' Modo demostración' +
            '</p>' +
            '<p class="mt-1 text-[0.68rem] font-semibold leading-snug text-amber-900/65">Los cambios se guardan solo en este navegador.</p>' +
          '</div>' +

          '<button type="button" data-open-profile class="flex w-full items-center gap-2.5 rounded-2xl p-2 text-left transition hover:bg-white">' +
            ui.avatar(state.profile.name, 'md') +
            '<span class="min-w-0 flex-1">' +
              '<span class="block truncate text-xs font-extrabold text-ink">' + util.esc(state.profile.name) + '</span>' +
              '<span class="block truncate text-[0.65rem] font-bold text-ink/60">' + util.esc(role.title) + '</span>' +
            '</span>' +
            ui.icon('settings-2', 'h-4 w-4 text-ink/30') +
          '</button>' +
        '</div>' +
      '</aside>'
    );
  }

  function mobileHeader(route) {
    const pet = store.currentPet();
    const state = store.getState();
    const role = store.roleInfo();
    return (
      '<header class="glass sticky top-0 z-40 border-b border-ink/[0.07] lg:hidden">' +
        '<div class="flex items-center gap-2 px-3 py-2.5">' +
          '<a href="#/dashboard" class="flex flex-none items-center gap-2" aria-label="PetTracker Escolar, ir al inicio">' +
            '<span class="grid h-9 w-9 place-items-center rounded-xl bg-brand-700 text-white">' + ui.icon('paw-print', 'h-[1.15rem] w-[1.15rem]') + '</span>' +
          '</a>' +
          '<div class="min-w-0 flex-1">' +
            '<p class="truncate text-[0.58rem] font-extrabold uppercase tracking-[0.18em] text-brand-600/70">' + util.esc(route.mobileEyebrow || route.eyebrow) + '</p>' +
            '<h1 class="truncate font-display text-base font-semibold leading-tight text-ink">' + util.esc(route.mobileTitle || route.title) + '</h1>' +
          '</div>' +
          petChip(pet) +
          '<button type="button" data-open-profile class="btn-icon btn-ghost flex-none" aria-label="Perfil y rol: ' + util.esc(role.title) + '">' +
            ui.avatar(state.profile.name, 'sm') +
          '</button>' +
        '</div>' +
      '</header>'
    );
  }

  function desktopHeader(route) {
    const state = store.getState();
    const pet = store.currentPet();
    const role = store.roleInfo();
    return (
      '<header class="mb-6 mt-8 hidden items-end justify-between gap-4 lg:flex">' +
        '<div class="min-w-0">' +
          '<p class="text-[0.65rem] font-extrabold uppercase tracking-[0.22em] text-brand-600/70">' + util.esc(route.eyebrow) + '</p>' +
          '<h1 class="mt-1 font-display text-[2rem] font-semibold leading-none tracking-tight text-ink">' + util.esc(route.title) + '</h1>' +
          '<p class="mt-2 text-sm font-semibold text-ink/60">' + util.esc(route.subtitle) + '</p>' +
        '</div>' +
        '<div class="flex flex-none items-center gap-2">' +
          petChip(pet) +
          profileChip(state.profile, role) +
        '</div>' +
      '</header>'
    );
  }

  function bottomNav(activeRoute) {
    const items = navItems();
    return (
      '<nav class="glass fixed inset-x-0 bottom-0 z-40 border-t border-ink/[0.08] lg:hidden" aria-label="Navegación principal">' +
        '<div class="bottom-nav-safe grid gap-1 px-2 pt-1.5" style="grid-template-columns:repeat(' + items.length + ',minmax(0,1fr))">' +
          items.map(function (item) {
            const active = item.id === activeRoute;
            return (
              '<a href="#/' + item.id + '" class="bottom-link ' + (active ? 'is-active' : '') + '" ' + (active ? 'aria-current="page"' : '') + '>' +
                '<span class="bottom-ico relative">' +
                  ui.icon(item.icon, 'h-5 w-5') +
                  (item.badge ? '<span class="absolute -right-1 -top-1 grid h-4 min-w-4 place-items-center rounded-full bg-amber-400 px-0.5 text-[0.55rem] font-extrabold leading-none text-amber-950">' + item.badge + '</span>' : '') +
                '</span>' +
                '<span>' + util.esc(item.short) + '</span>' +
              '</a>'
            );
          }).join('') +
        '</div>' +
      '</nav>'
    );
  }

  /* ------------------------------------------------------------------------
     Modales del shell
     ------------------------------------------------------------------------ */
  function openPetSwitcher() {
    const state = store.getState();
    const content =
      '<div class="space-y-2.5">' +
        state.pets.map(function (pet) {
          const meta = PT.meta.status(pet.status.key);
          const zone = PT.meta.zone(pet.status.zone);
          const active = pet.id === state.activePetId;
          return (
            '<button type="button" data-pet-option="' + util.esc(pet.id) + '" class="flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ' +
              (active ? 'border-brand-300 bg-brand-50/80' : 'border-ink/10 bg-white hover:border-brand-200 hover:bg-brand-50/40') + '">' +
              '<span class="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white text-3xl shadow-sm">' + pet.emoji + '</span>' +
              '<span class="min-w-0 flex-1">' +
                '<span class="flex flex-wrap items-center gap-1.5">' +
                  '<span class="font-display text-base font-semibold text-ink">' + util.esc(pet.name) + '</span>' +
                  ui.statusBadge(pet.status.key) +
                '</span>' +
                '<span class="mt-0.5 block truncate text-xs font-semibold text-ink/60">' + util.esc(pet.breed) + ' · ' + util.esc(zone.name) + '</span>' +
              '</span>' +
              (active
                ? '<span class="grid h-7 w-7 flex-none place-items-center rounded-full bg-brand-600 text-white">' + ui.icon('check', 'h-4 w-4') + '</span>'
                : ui.icon('chevron-right', 'h-4 w-4 flex-none text-ink/30')) +
            '</button>'
          );
        }).join('') +
      '</div>' +
      (store.can('manage')
        ? '<button type="button" data-manage-pets class="mt-4 flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-ink/15 px-3 py-3 text-xs font-extrabold text-brand-700 transition hover:border-brand-300 hover:bg-brand-50">' +
            ui.icon('paw-print', 'h-4 w-4') + ' Gestionar mascotas' +
          '</button>'
        : '');

    ui.openModal({
      title: 'Mascotas de la institución',
      subtitle: 'Elige de quién quieres ver el estado',
      icon: 'paw-print',
      content: content,
      footer: '<div class="flex justify-end"><button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button></div>',
      onOpen: function (panel) {
        panel.querySelectorAll('[data-pet-option]').forEach(function (button) {
          button.addEventListener('click', function () {
            const petId = button.getAttribute('data-pet-option');
            ui.closeModal();
            if (petId && petId !== store.getState().activePetId) {
              store.setPet(petId);
              ui.toast('Ahora ves el perfil de ' + store.currentPet().name, 'success');
            }
          });
        });
        const manage = panel.querySelector('[data-manage-pets]');
        if (manage) {
          manage.addEventListener('click', function () {
            ui.closeModal();
            window.location.hash = '#/admin';
          });
        }
      }
    });
  }

  function openProfile() {
    const state = store.getState();
    const role = store.roleInfo();
    const roles = Object.keys(data.ROLES).map(function (id) { return data.ROLES[id]; });

    const content =
      '<form id="profile-form" class="space-y-5" novalidate>' +
        '<div>' +
          '<label class="field-label" for="profile-name">Tu nombre visible</label>' +
          '<input class="field" id="profile-name" name="name" maxlength="40" autocomplete="name" required value="' + util.esc(state.profile.name) + '" placeholder="¿Cómo te llamas?">' +
          '<p class="field-hint">Aparecerá en la bitácora y en tus turnos.</p>' +
        '</div>' +
        '<div>' +
          '<span class="field-label">Elige tu rol de demostración</span>' +
          '<div class="space-y-2">' +
            roles.map(function (item) {
              const checked = item.id === state.profile.role;
              const t = PT.ui.tone(item.id === 'admin' ? 'brand' : item.id === 'cuidador' ? 'sky' : 'amber');
              return (
                '<label class="choice-card relative block">' +
                  '<input type="radio" name="role" value="' + item.id + '" ' + (checked ? 'checked' : '') + '>' +
                  '<span class="w-full">' +
                    '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl ' + t.ico + '">' + ui.icon(item.icon, 'h-[1.1rem] w-[1.1rem]') + '</span>' +
                    '<span class="min-w-0 flex-1">' +
                      '<span class="block text-sm font-extrabold text-ink">' + util.esc(item.title) + '</span>' +
                      '<span class="block text-[0.7rem] font-semibold leading-snug text-ink/60">' + util.esc(item.desc) + '</span>' +
                    '</span>' +
                    (checked ? ui.icon('check-circle-2', 'h-5 w-5 flex-none text-brand-600') : '') +
                  '</span>' +
                '</label>'
              );
            }).join('') +
          '</div>' +
        '</div>' +
        '<div class="rounded-2xl bg-stone-50 px-3.5 py-3 text-[0.72rem] font-semibold leading-relaxed text-ink/55">' +
          '<strong class="text-ink/70">Acceso de demostración.</strong> Los roles no reemplazan una autenticación real, pero permiten probar los permisos de la app al instante.' +
        '</div>' +
      '</form>' +
      '<button type="button" data-install-profile class="mt-4 flex w-full items-center gap-2.5 rounded-2xl border border-brand-100 bg-brand-50/60 p-3 text-left transition hover:border-brand-200 hover:bg-brand-50">' +
        '<span class="grid h-9 w-9 flex-none place-items-center rounded-xl bg-white text-brand-700">' + ui.icon('download', 'h-4 w-4') + '</span>' +
        '<span class="min-w-0 flex-1"><span class="block text-xs font-extrabold text-ink">Instalar PetTracker</span><span class="block text-[0.65rem] font-semibold text-ink/60">Llévala en tu pantalla de inicio</span></span>' +
        ui.icon('arrow-up-right', 'h-3.5 w-3.5 text-ink/30') +
      '</button>';

    ui.openModal({
      title: 'Tu perfil',
      subtitle: role.title + ' · ' + role.detail,
      icon: 'user-round',
      content: content,
      footer:
        '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
          '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
          '<button type="submit" form="profile-form" class="btn btn-primary">' + ui.icon('check', 'h-4 w-4') + ' Guardar perfil</button>' +
        '</div>',
      onOpen: function (panel) {
        const form = panel.querySelector('#profile-form');
        const nameInput = panel.querySelector('#profile-name');
        if (nameInput) nameInput.focus();
        if (form) {
          form.addEventListener('submit', function (event) {
            event.preventDefault();
            const name = (new FormData(form).get('name') || '').toString().trim();
            const newRole = (new FormData(form).get('role') || state.profile.role).toString();
            if (!name) {
              ui.toast('Escribe tu nombre para continuar.', 'error');
              nameInput.focus();
              return;
            }
            if (!data.ROLES[newRole]) return;
            ui.closeModal();
            store.setProfile(newRole, name);
            ui.toast('Perfil actualizado: ' + data.ROLES[newRole].title, 'success');
          });
        }
        const installButton = panel.querySelector('[data-install-profile]');
        if (installButton) {
          installButton.addEventListener('click', function () {
            ui.closeModal();
            openInstall();
          });
        }
      }
    });
  }

  function openInstall() {
    const isHttp = /^https?:$/.test(window.location.protocol);
    const content =
      '<div class="space-y-4">' +
        '<div class="flex items-center gap-3 rounded-2xl bg-brand-50 p-4">' +
          '<span class="grid h-12 w-12 flex-none place-items-center rounded-2xl bg-white text-3xl shadow-sm">🐾</span>' +
          '<div>' +
            '<p class="font-display text-base font-semibold text-ink">PetTracker en tu pantalla de inicio</p>' +
            '<p class="text-xs font-semibold text-ink/55">Abre la app más rápido y consulta la bitácora como cualquier otra app.</p>' +
          '</div>' +
        '</div>' +
        (installState.prompt
          ? '<button type="button" data-do-install class="btn btn-primary w-full">' + ui.icon('download', 'h-4 w-4') + ' Instalar ahora</button>'
          : '<ol class="space-y-2.5 text-sm font-semibold text-ink/65">' +
              '<li class="flex gap-2.5"><span class="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-100 text-[0.65rem] font-extrabold text-brand-800">1</span><span>Abre el menú del navegador (⋮ o el botón Compartir).</span></li>' +
              '<li class="flex gap-2.5"><span class="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-100 text-[0.65rem] font-extrabold text-brand-800">2</span><span>Elige <strong>Instalar aplicación</strong> o <strong>Añadir a pantalla de inicio</strong>.</span></li>' +
              '<li class="flex gap-2.5"><span class="grid h-6 w-6 flex-none place-items-center rounded-full bg-brand-100 text-[0.65rem] font-extrabold text-brand-800">3</span><span>Confirma y listo: PetTracker quedará como una app.</span></li>' +
            '</ol>') +
        (isHttp
          ? '<p class="text-[0.7rem] font-semibold text-ink/60">La app funciona sin conexión después de la primera visita gracias al service worker.</p>'
          : '<div class="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-[0.72rem] font-semibold leading-relaxed text-amber-900">' +
              'Estás abriendo el archivo directamente. Para activar la instalación y el modo sin conexión, sirve la carpeta con un servidor local, por ejemplo:<br><code class="mt-1 inline-block rounded bg-white/70 px-1.5 py-0.5 font-mono text-[0.68rem]">python -m http.server 8080</code>' +
            '</div>') +
      '</div>';

    ui.openModal({
      title: 'Instalar PetTracker',
      subtitle: 'PWA · funciona en Android, iPhone y computador',
      icon: 'smartphone',
      content: content,
      footer: '<div class="flex justify-end"><button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button></div>',
      onOpen: function (panel) {
        const button = panel.querySelector('[data-do-install]');
        if (button) {
          button.addEventListener('click', async function () {
            if (!installState.prompt) return;
            const prompt = installState.prompt;
            installState.prompt = null;
            ui.closeModal();
            prompt.prompt();
            try {
              const choice = await prompt.userChoice;
              if (choice && choice.outcome === 'accepted') {
                ui.toast('¡PetTracker instalada! Búscala en tu pantalla de inicio.', 'success');
              }
            } catch (error) {
              /* noop */
            }
          });
        }
      }
    });
  }

  /* ------------------------------------------------------------------------
     Render
     ------------------------------------------------------------------------ */
  function render() {
    const app = document.getElementById('app');
    if (!app) return;

    if (typeof PT.viewCleanup === 'function') {
      try {
        PT.viewCleanup();
      } catch (error) {
        console.warn('PetTracker: error al limpiar la vista anterior', error);
      }
      PT.viewCleanup = null;
    }

    let route = routeFromHash();
    if (route === 'admin' && !store.can('approve')) {
      route = 'dashboard';
      if (window.location.hash !== '#/dashboard') {
        window.history.replaceState(null, '', '#/dashboard');
      }
    }

    const routeInfo = ROUTES[route];
    const mainContent =
      sidebar(route) +
      '<div class="min-h-screen lg:pl-72">' +
        mobileHeader(routeInfo) +
        '<div class="mx-auto w-full max-w-[1240px] px-4 pb-28 pt-5 sm:px-6 lg:px-8 lg:pb-12 lg:pt-0">' +
          desktopHeader(routeInfo) +
          '<main id="view" tabindex="-1" class="outline-none">' +
            '<div class="flex min-h-[50vh] items-center justify-center text-sm font-bold text-ink/55">Cargando…</div>' +
          '</main>' +
          '<footer class="mt-10 hidden border-t border-ink/[0.07] py-5 text-[0.68rem] font-semibold text-ink/55 sm:flex sm:items-center sm:justify-between">' +
            '<span>PetTracker Escolar · Cuidado comunitario, con cariño.</span>' +
            '<span class="flex items-center gap-1.5">' + ui.icon('hard-drive', 'h-3.5 w-3.5') + ' Datos guardados en este dispositivo</span>' +
          '</footer>' +
        '</div>' +
        bottomNav(route) +
      '</div>';

    app.innerHTML = mainContent;
    ui.icons();

    const view = document.getElementById('view');
    const viewFn = PT.views[route];
    if (view && typeof viewFn === 'function') {
      try {
        viewFn(view);
      } catch (error) {
        console.error('PetTracker: error al renderizar la vista', error);
        view.innerHTML =
          '<div class="card p-6 text-center">' +
            '<p class="text-3xl">🙈</p>' +
            '<h2 class="mt-2 font-display text-xl font-semibold">Algo salió mal al mostrar esta vista</h2>' +
            '<p class="mt-1 text-sm font-semibold text-ink/60">Recarga la página o restablece los datos de demostración desde Administración.</p>' +
          '</div>';
      }
    }

    bindShell();
    ui.icons();
    ui.refreshTimes();
    document.title = routeInfo.title + ' · PetTracker Escolar';

    if (route !== lastRenderedRoute) {
      lastRenderedRoute = route;
      window.scrollTo({ top: 0, behavior: 'auto' });
    }
  }

  function bindShell() {
    document.querySelectorAll('[data-open-pets]').forEach(function (button) {
      button.addEventListener('click', openPetSwitcher);
    });
    document.querySelectorAll('[data-open-profile]').forEach(function (button) {
      button.addEventListener('click', openProfile);
    });
    document.querySelectorAll('[data-install]').forEach(function (button) {
      button.addEventListener('click', openInstall);
    });
  }

  /* ------------------------------------------------------------------------
     Eventos globales y arranque
     ------------------------------------------------------------------------ */
  window.addEventListener('hashchange', render);
  store.subscribe(render);

  window.addEventListener('storage', function (event) {
    if (!event.key || event.key.indexOf('pettracker-escolar') !== 0) return;
    store.reload();
    if (!storageWarningShown) {
      storageWarningShown = true;
      window.setTimeout(function () { storageWarningShown = false; }, 5000);
      ui.toast('Datos sincronizados desde otra pestaña.', 'info');
    }
  });

  store.onSaveError(function () {
    ui.toast(
      'No se pudo guardar en el navegador.',
      'error',
      { detail: 'El almacenamiento local está lleno. Intenta con una foto más liviana o restablece la demo.' }
    );
  });

  window.addEventListener('beforeinstallprompt', function (event) {
    event.preventDefault();
    installState.prompt = event;
  });

  window.addEventListener('appinstalled', function () {
    installState.prompt = null;
    ui.toast('PetTracker se instaló correctamente.', 'success');
  });

  window.addEventListener('online', function () {
    ui.toast('Conexión restablecida. Todo sincronizado.', 'success');
  });

  window.addEventListener('offline', function () {
    ui.toast('Estás sin conexión. La app sigue funcionando con los datos guardados.', 'info');
  });

  window.setInterval(function () {
    ui.refreshTimes();
  }, 30000);

  const skipLink = document.querySelector('[data-skip-link]');
  if (skipLink) {
    skipLink.addEventListener('click', function (event) {
      event.preventDefault();
      const view = document.getElementById('view');
      if (view) {
        view.focus({ preventScroll: true });
        view.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    });
  }

  const isViteDev = Array.prototype.some.call(document.scripts, function (script) {
    return (script.getAttribute('src') || '').indexOf('@vite/client') !== -1;
  });

  if (isViteDev && 'serviceWorker' in navigator) {
    navigator.serviceWorker.getRegistrations().then(function (registrations) {
      registrations.forEach(function (registration) { registration.unregister(); });
    }).catch(function () { /* noop */ });
  }

  if ('serviceWorker' in navigator && /^https?:$/.test(window.location.protocol) && !isViteDev) {
    window.addEventListener('load', function () {
      navigator.serviceWorker.register('sw.js').catch(function (error) {
        console.warn('PetTracker: no se pudo registrar el service worker', error);
      });
    });
  }

  PT.app = {
    render: render,
    openPetSwitcher: openPetSwitcher,
    openProfile: openProfile,
    openInstall: openInstall
  };

  render();
})();
