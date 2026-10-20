/* ==========================================================================
   PetTracker Escolar · utilidades de interfaz (toasts, modales, avatares)
   ========================================================================== */
(function () {
  'use strict';

  const PT = (window.PT = window.PT || {});
  const util = PT.util;
  const data = PT.data;

  let activeOverlay = null;
  let lastFocused = null;

  function icons() {
    if (window.lucide && typeof window.lucide.createIcons === 'function') {
      try {
        window.lucide.createIcons({
          attrs: { 'stroke-width': 2, 'aria-hidden': 'true' }
        });
      } catch (error) {
        /* Si el CDN de iconos no está disponible, la app sigue funcionando. */
      }
    }
  }

  function icon(name, className) {
    return '<i data-lucide="' + util.esc(name) + '" class="' + (className || 'h-5 w-5') + '"></i>';
  }

  /* ------------------------------------------------------------------------
     Toasts
     ------------------------------------------------------------------------ */
  function toast(message, type, options) {
    const root = document.getElementById('toast-root');
    if (!root) return;
    const opts = options || {};
    const kinds = {
      success: { icon: 'check-circle-2', wrap: 'bg-emerald-100 text-emerald-700' },
      error: { icon: 'alert-triangle', wrap: 'bg-rose-100 text-rose-700' },
      info: { icon: 'info', wrap: 'bg-sky-100 text-sky-700' }
    };
    const kind = kinds[type] || kinds.success;

    const el = document.createElement('div');
    el.className = 'toast';
    el.setAttribute('role', type === 'error' ? 'alert' : 'status');
    el.innerHTML =
      '<span class="grid h-8 w-8 flex-none place-items-center rounded-full ' + kind.wrap + '">' +
        icon(kind.icon, 'h-4 w-4') +
      '</span>' +
      '<div class="min-w-0 flex-1 pt-0.5">' +
        '<p class="leading-snug text-ink">' + util.esc(message) + '</p>' +
        (opts.detail ? '<p class="mt-0.5 text-xs font-medium text-ink/55">' + util.esc(opts.detail) + '</p>' : '') +
      '</div>' +
      '<button type="button" class="btn-icon-sm btn-ghost -mr-1 flex-none" data-toast-close aria-label="Cerrar notificación">' +
        icon('x', 'h-4 w-4') +
      '</button>';

    root.appendChild(el);
    icons();

    let removed = false;
    function remove() {
      if (removed) return;
      removed = true;
      el.classList.add('is-leaving');
      window.setTimeout(function () { el.remove(); }, 220);
    }

    el.querySelector('[data-toast-close]').addEventListener('click', remove);
    window.setTimeout(remove, opts.duration || 4200);
  }

  /* ------------------------------------------------------------------------
     Modales con focus trap
     ------------------------------------------------------------------------ */
  function closeModal(silent) {
    if (!activeOverlay) return;
    const overlay = activeOverlay;
    const callback = overlay.__onClose;
    activeOverlay = null;
    overlay.remove();
    document.body.classList.remove('overflow-hidden');
    document.body.style.overflow = '';
    if (!silent && lastFocused && document.contains(lastFocused)) {
      try { lastFocused.focus({ preventScroll: true }); } catch (error) { /* noop */ }
    }
    lastFocused = null;
    if (typeof callback === 'function') callback();
  }

  function openModal(options) {
    const opts = options || {};
    if (activeOverlay) closeModal(true);

    const root = document.getElementById('modal-root');
    if (!root) return function () {};

    lastFocused = document.activeElement;
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.setAttribute('data-modal-overlay', '');
    overlay.__onClose = opts.onClose;

    const sizeClass = opts.size === 'lg' ? 'modal-lg' : opts.size === 'sm' ? 'modal-sm' : '';

    overlay.innerHTML =
      '<div class="modal-panel ' + sizeClass + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="glass sticky top-0 z-10 flex items-start gap-3 border-b border-ink/5 px-5 py-4">' +
          '<span class="grid h-10 w-10 flex-none place-items-center rounded-xl bg-brand-50 text-brand-700">' +
            icon(opts.icon || 'sparkles', 'h-5 w-5') +
          '</span>' +
          '<div class="min-w-0 flex-1">' +
            '<h2 id="modal-title" class="font-display text-lg font-semibold leading-tight text-ink">' + util.esc(opts.title || '') + '</h2>' +
            (opts.subtitle ? '<p class="mt-0.5 text-xs font-semibold text-ink/55">' + util.esc(opts.subtitle) + '</p>' : '') +
          '</div>' +
          '<button type="button" class="btn-icon-sm btn-ghost -mr-1 flex-none" data-modal-close aria-label="Cerrar ventana">' +
            icon('x', 'h-5 w-5') +
          '</button>' +
        '</div>' +
        '<div class="px-5 py-5">' + (opts.content || '') + '</div>' +
        (opts.footer
          ? '<div class="sticky bottom-0 border-t border-ink/5 bg-white/95 px-5 py-4 backdrop-blur">' + opts.footer + '</div>'
          : '') +
      '</div>';

    overlay.addEventListener('click', function (event) {
      if (event.target === overlay) {
        closeModal();
        return;
      }
      const closer = event.target.closest('[data-modal-close]');
      if (closer) {
        event.preventDefault();
        closeModal();
      }
    });

    overlay.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        event.preventDefault();
        closeModal();
        return;
      }
      if (event.key !== 'Tab') return;
      const panel = overlay.querySelector('.modal-panel');
      if (!panel) return;
      const focusables = Array.prototype.slice.call(
        panel.querySelectorAll(
          'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
        )
      ).filter(function (el) {
        return el.offsetParent !== null || el === document.activeElement;
      });
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    root.appendChild(overlay);
    activeOverlay = overlay;
    document.body.classList.add('overflow-hidden');
    document.body.style.overflow = 'hidden';
    icons();

    window.requestAnimationFrame(function () {
      const autofocus = overlay.querySelector('[data-autofocus]');
      const firstField = overlay.querySelector('input:not([type="hidden"]):not([disabled]), select:not([disabled]), textarea:not([disabled])');
      const firstButton = overlay.querySelector('.modal-panel button:not([disabled])');
      (autofocus || firstField || firstButton || overlay.querySelector('.modal-panel')).focus();
    });

    if (typeof opts.onOpen === 'function') {
      try {
        opts.onOpen(overlay.querySelector('.modal-panel'), closeModal);
      } catch (error) {
        console.error('PetTracker: error al abrir el modal', error);
      }
    }

    icons();
    return closeModal;
  }

  function confirm(options) {
    const opts = options || {};
    return new Promise(function (resolve) {
      let settled = false;
      openModal({
        title: opts.title || '¿Estás seguro?',
        subtitle: opts.subtitle,
        icon: opts.icon || 'alert-triangle',
        size: 'sm',
        content: '<p class="text-sm font-semibold leading-relaxed text-ink/75">' + util.esc(opts.message || '') + '</p>',
        footer:
          '<div class="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">' +
            '<button type="button" class="btn btn-secondary" data-modal-close>Cancelar</button>' +
            '<button type="button" class="btn ' + (opts.danger === false ? 'btn-primary' : 'btn-danger') + '" data-confirm>' +
              util.esc(opts.confirmLabel || 'Confirmar') +
            '</button>' +
          '</div>',
        onOpen: function (panel, close) {
          const button = panel.querySelector('[data-confirm]');
          if (button) {
            button.addEventListener('click', function () {
              settled = true;
              close();
              resolve(true);
            });
          }
        },
        onClose: function () {
          if (!settled) resolve(false);
        }
      });
    });
  }

  function openPhoto(src, alt) {
    if (!src) return;
    openModal({
      title: alt || 'Foto de la bitácora',
      icon: 'camera',
      size: 'lg',
      content: '<div class="overflow-hidden rounded-2xl bg-stone-100"><img src="' + util.esc(src) + '" alt="' + util.esc(alt || 'Foto de la mascota') + '" class="max-h-[65vh] w-full object-contain"></div>',
      footer: '<div class="flex justify-end"><button type="button" class="btn btn-secondary" data-modal-close>Cerrar</button></div>'
    });
  }

  /* ------------------------------------------------------------------------
     Helpers visuales
     ------------------------------------------------------------------------ */
  function toneOf(name) {
    return PT.meta.tone(name);
  }

  function statusBadge(statusKey) {
    const meta = PT.meta.status(statusKey);
    const t = toneOf(meta.tone);
    return (
      '<span class="chip-soft ' + t.chip + '">' +
        '<span class="h-1.5 w-1.5 rounded-full ' + t.dot + '" aria-hidden="true"></span>' +
        util.esc(meta.label) +
      '</span>'
    );
  }

  function badge(label, toneName) {
    const t = toneOf(toneName || 'slate');
    return '<span class="chip-soft ' + t.chip + '">' + util.esc(label) + '</span>';
  }

  function entryIcon(type, extraClass) {
    const meta = PT.meta.entry(type);
    const t = toneOf(meta.tone);
    return (
      '<span class="entry-ico ' + t.ico + ' ' + (extraClass || '') + '">' +
        icon(meta.icon, 'h-5 w-5') +
      '</span>'
    );
  }

  const AVATAR_TONES = [
    'bg-emerald-600', 'bg-sky-600', 'bg-amber-600', 'bg-violet-600',
    'bg-rose-500', 'bg-teal-600', 'bg-orange-500', 'bg-indigo-500'
  ];

  function avatar(name, size) {
    const clean = name || '?';
    let hash = 0;
    for (let i = 0; i < clean.length; i += 1) {
      hash = (hash * 31 + clean.charCodeAt(i)) % 997;
    }
    const sizes = {
      xs: 'h-6 w-6 text-[0.58rem]',
      sm: 'h-8 w-8 text-[0.65rem]',
      md: 'h-10 w-10 text-xs',
      lg: 'h-12 w-12 text-sm'
    };
    return (
      '<span class="avatar-initials ' + (sizes[size] || sizes.sm) + ' ' + AVATAR_TONES[hash % AVATAR_TONES.length] + '" title="' + util.esc(clean) + '" aria-hidden="true">' +
        util.esc(util.initials(clean)) +
      '</span>'
    );
  }

  function emptyState(options) {
    const opts = options || {};
    return (
      '<div class="flex flex-col items-center justify-center rounded-2xl border border-dashed border-ink/15 bg-white/60 px-5 py-9 text-center">' +
        '<span class="grid h-12 w-12 place-items-center rounded-2xl bg-brand-50 text-brand-600">' +
          icon(opts.icon || 'paw-print', 'h-6 w-6') +
        '</span>' +
        '<p class="mt-3 font-display text-base font-semibold text-ink">' + util.esc(opts.title || 'Nada por aquí todavía') + '</p>' +
        (opts.text ? '<p class="mt-1 max-w-xs text-sm font-medium text-ink/55">' + util.esc(opts.text) + '</p>' : '') +
        (opts.action || '') +
      '</div>'
    );
  }

  function refreshTimes() {
    document.querySelectorAll('[data-relative]').forEach(function (el) {
      const value = el.getAttribute('data-relative');
      if (!value) return;
      el.textContent = el.getAttribute('data-relative-prefix')
        ? el.getAttribute('data-relative-prefix') + ' ' + util.timeAgo(value)
        : util.timeAgo(value);
    });
  }

  function setLoading(button, loading, label) {
    if (!button) return;
    if (loading) {
      button.dataset.originalHtml = button.innerHTML;
      button.disabled = true;
      button.innerHTML = '<span class="inline-block h-4 w-4 animate-spin rounded-full border-2 border-current border-r-transparent"></span>' + (label || 'Guardando…');
    } else {
      button.disabled = false;
      if (button.dataset.originalHtml) button.innerHTML = button.dataset.originalHtml;
    }
  }

  function readImage(file, maxSize) {
    return new Promise(function (resolve, reject) {
      if (!file) return resolve(null);
      if (!file.type || file.type.indexOf('image/') !== 0) {
        return reject(new Error('Selecciona un archivo de imagen (JPG, PNG o WebP).'));
      }
      if (file.size > 8 * 1024 * 1024) {
        return reject(new Error('La imagen supera los 8 MB. Elige una más liviana.'));
      }
      const reader = new FileReader();
      reader.onerror = function () { reject(new Error('No se pudo leer la imagen.')); };
      reader.onload = function () {
        const img = new Image();
        img.onerror = function () { reject(new Error('La imagen no es válida.')); };
        img.onload = function () {
          const limit = maxSize || 1000;
          const scale = Math.min(1, limit / Math.max(img.width, img.height));
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(img.width * scale));
          canvas.height = Math.max(1, Math.round(img.height * scale));
          const ctx = canvas.getContext('2d');
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.72));
        };
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function scrollToId(id) {
    const el = document.getElementById(id);
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  PT.ui = {
    icon: icon,
    icons: icons,
    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    confirm: confirm,
    openPhoto: openPhoto,
    statusBadge: statusBadge,
    badge: badge,
    entryIcon: entryIcon,
    avatar: avatar,
    emptyState: emptyState,
    refreshTimes: refreshTimes,
    setLoading: setLoading,
    readImage: readImage,
    scrollToId: scrollToId,
    tone: toneOf
  };
})();
