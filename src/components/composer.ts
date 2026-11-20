/* "Bake a Message" — the composer, with a live holo preview of your card. */
import { h, clamp } from '../lib/dom';
import { FLAVORS, STICKERS, donutSVG, stickerSVG, type FlavorId, type StickerId } from './art';
import { renderCard, attachTilt, safeMediaUrl } from './card';
import { openModal, type ModalHandle } from './modal';
import { icon } from './icons';
import type { Message, NewMessage } from '../data/types';
import { app } from '../state';
import { progress } from '../lib/progress';
import { sound } from '../lib/sound';
import { burstFrom, rain } from './confetti';
import { load, save, remove } from '../lib/storage';
import { downloadCard } from './cardExport';
import { config } from '../config';

const MAX_BODY = 1000;
const PROMPTS = [
  'My favorite stream memory is ',
  'You make chat feel like ',
  'Thank you for ',
  'Happy birthday! I hope this year ',
  'The first time I found your stream ',
];

interface Draft {
  name: string;
  handle: string;
  since: string;
  body: string;
  flavor: FlavorId;
  sticker: StickerId;
  font: 'clean' | 'hand';
  mediaUrl: string;
}

async function prepareImage(file: File, maxSide: number): Promise<{ blob: Blob; ext: string }> {
  if (file.type === 'image/gif' && file.size < 4.5 * 1024 * 1024) return { blob: file, ext: 'gif' };
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/webp', 0.86));
  if (blob && blob.type === 'image/webp') return { blob, ext: 'webp' };
  const jpg = await new Promise<Blob | null>((r) => canvas.toBlob(r, 'image/jpeg', 0.86));
  if (!jpg) throw new Error('Could not process that image');
  return { blob: jpg, ext: 'jpg' };
}

let current: ModalHandle | null = null;

export function openComposer() {
  if (current) return;
  sound.click();
  const saved = load<Partial<Draft>>('draft', {});
  const draft: Draft = {
    name: saved.name ?? progress.data.name ?? '',
    handle: saved.handle ?? progress.data.handle ?? '',
    since: saved.since ?? '',
    body: saved.body ?? '',
    flavor: (saved.flavor as FlavorId) ?? 'strawberry',
    sticker: (saved.sticker as StickerId) ?? 'donut',
    font: saved.font ?? 'clean',
    mediaUrl: saved.mediaUrl ?? '',
  };
  let uploading = false;

  /* ── Fields ── */
  const nameIn = h('input', { id: 'c-name', type: 'text', maxlength: '40', required: true, autocomplete: 'nickname', placeholder: 'What should Dani call you?', value: draft.name });
  const handleIn = h('input', { id: 'c-handle', type: 'text', maxlength: '25', autocomplete: 'off', spellcheck: 'false', placeholder: 'yourtwitchname', value: draft.handle });
  const years: number[] = [];
  for (let y = new Date().getFullYear(); y >= 2016; y--) years.push(y);
  const sinceSel = h(
    'select',
    { id: 'c-since' },
    h('option', { value: '' }, '—'),
    years.map((y) => h('option', { value: String(y), selected: draft.since === String(y) }, String(y))),
  );
  const bodyIn = h('textarea', {
    id: 'c-body',
    maxlength: String(MAX_BODY),
    required: true,
    rows: '6',
    placeholder: `Tell ${config.streamer.name} what she means to you…`,
  });
  bodyIn.value = draft.body;
  const counter = h('span', { class: 'field__count' });
  const prompts = h(
    'div',
    { class: 'chips' },
    PROMPTS.map((p) =>
      h(
        'button',
        {
          type: 'button',
          class: 'chip',
          onclick: () => {
            bodyIn.value = (bodyIn.value ? bodyIn.value.trimEnd() + ' ' : '') + p;
            bodyIn.focus();
            bodyIn.setSelectionRange(bodyIn.value.length, bodyIn.value.length);
            sync();
          },
        },
        p.replace(/ $/, '…'),
      ),
    ),
  );
  const handToggle = h('input', { type: 'checkbox', id: 'c-hand', checked: draft.font === 'hand' });

  const flavorGroup = h(
    'div',
    { class: 'swatches', role: 'radiogroup', 'aria-label': 'Frosting flavor' },
    FLAVORS.map((f) =>
      h(
        'label',
        { class: 'swatch', title: f.name },
        h('input', { type: 'radio', name: 'flavor', value: f.id, checked: draft.flavor === f.id }),
        h('span', { class: 'swatch__donut', html: donutSVG('flavor-' + f.id, { flavor: f.id, size: 52 }) }),
        h('span', { class: 'swatch__name' }, f.name),
      ),
    ),
  );
  const stickerGroup = h(
    'div',
    { class: 'stickers', role: 'radiogroup', 'aria-label': 'Sticker' },
    STICKERS.map((s) =>
      h(
        'label',
        { class: 'sticker-opt', title: s.label },
        h('input', { type: 'radio', name: 'sticker', value: s.id, checked: draft.sticker === s.id }),
        h('span', { html: stickerSVG(s.id, 46) }),
        h('span', { class: 'sr-only' }, s.label),
      ),
    ),
  );

  const urlIn = h('input', { id: 'c-media', type: 'url', placeholder: 'https://media.giphy.com/…gif', value: draft.mediaUrl.startsWith('data:') ? '' : draft.mediaUrl });
  const fileIn = h('input', { type: 'file', accept: 'image/png,image/jpeg,image/webp,image/gif', class: 'sr-only', id: 'c-file' });
  const mediaStatus = h('span', { class: 'media__status' });
  const clearMedia = h('button', { type: 'button', class: 'link-btn', hidden: !draft.mediaUrl }, 'Remove');

  const error = h('p', { class: 'form-error', role: 'alert' });
  const submit = h('button', { type: 'submit', class: 'btn btn--primary btn--xl', html: `<span>Bake it</span> ${donutSVG('bake-btn', { flavor: 'vanilla', size: 28 })}` });

  const field = (label: string, forId: string, input: Node, hint?: string | Node, extra?: Node) =>
    h('div', { class: 'field' }, h('label', { for: forId, class: 'field__label' }, label, extra ?? null), input, hint ? h('p', { class: 'field__hint' }, hint) : null);

  const form = h(
    'form',
    { class: 'composer__form', novalidate: true },
    h(
      'div',
      { class: 'composer__row' },
      field('Your name', 'c-name', nameIn),
      field('Twitch username', 'c-handle', h('div', { class: 'input-prefix' }, h('span', null, '@'), handleIn), 'Optional'),
      field('Donut since', 'c-since', sinceSel),
    ),
    h(
      'div',
      { class: 'field' },
      h('label', { for: 'c-body', class: 'field__label' }, 'Your message', counter),
      bodyIn,
      prompts,
      h('label', { class: 'toggle' }, handToggle, h('span', { class: 'toggle__ui' }), h('span', null, 'Write it in handwriting')),
    ),
    h('fieldset', { class: 'field' }, h('legend', { class: 'field__label' }, 'Pick a frosting'), flavorGroup),
    h('fieldset', { class: 'field' }, h('legend', { class: 'field__label' }, 'Slap on a sticker'), stickerGroup),
    h(
      'fieldset',
      { class: 'field media' },
      h('legend', { class: 'field__label' }, 'Add a GIF or photo ', h('em', null, '(optional)')),
      h(
        'div',
        { class: 'media__row' },
        h('label', { for: 'c-file', class: 'btn btn--ghost', html: `${icon('image', 18)} Upload a photo` }),
        fileIn,
        h('span', { class: 'media__or' }, 'or'),
        urlIn,
      ),
      h('div', { class: 'media__meta' }, mediaStatus, clearMedia),
    ),
    error,
    h(
      'div',
      { class: 'composer__submit' },
      submit,
      h(
        'p',
        { class: 'field__hint' },
        app.store?.mode === 'supabase' && !app.store.autoApprove
          ? 'Messages are checked by the organizers before they go up. Keep it kind 💗'
          : 'Keep it kind — this is for Dani 💗',
      ),
    ),
  );

  /* ── Preview ── */
  const previewSlot = h('div', { class: 'composer__card' });
  const avatarSlot = h('div', { class: 'composer__avatar' });
  const preview = h(
    'aside',
    { class: 'composer__preview', 'aria-label': 'Live preview' },
    h('p', { class: 'hud-label' }, 'Live preview'),
    previewSlot,
    h('div', { class: 'composer__you' }, avatarSlot, h('p', null, h('strong', null, 'This is your donut.'), ' It’s generated from your name — nobody else has one quite like it.')),
  );

  const panel = h(
    'div',
    { class: 'composer' },
    h(
      'header',
      { class: 'composer__head' },
      h('p', { class: 'hud-label' }, 'New message'),
      h('h2', { class: 'composer__title' }, 'Bake a message for ', h('span', { class: 'holo-text' }, config.streamer.name)),
    ),
    h('div', { class: 'composer__grid' }, form, preview),
  );

  const readDraft = (): Draft => ({
    name: nameIn.value.trim(),
    handle: handleIn.value.replace(/[^a-zA-Z0-9_]/g, '').slice(0, 25),
    since: sinceSel.value,
    body: bodyIn.value,
    flavor: ((form.querySelector('input[name=flavor]:checked') as HTMLInputElement)?.value as FlavorId) ?? 'strawberry',
    sticker: ((form.querySelector('input[name=sticker]:checked') as HTMLInputElement)?.value as StickerId) ?? 'donut',
    font: handToggle.checked ? 'hand' : 'clean',
    mediaUrl: draft.mediaUrl,
  });

  let tiltCleanup = () => {};
  const sync = () => {
    const d = readDraft();
    Object.assign(draft, d);
    if (handleIn.value !== d.handle) handleIn.value = d.handle;
    counter.textContent = `${d.body.length} / ${MAX_BODY}`;
    counter.classList.toggle('is-near', d.body.length > MAX_BODY * 0.9);
    const msg: Message = {
      id: 'preview',
      createdAt: new Date().toISOString(),
      name: d.name || 'Your name',
      handle: d.handle || null,
      body: d.body.trim() || `Your message to ${config.streamer.name} shows up right here, on a one-of-a-kind holographic card…`,
      flavor: d.flavor,
      sticker: d.sticker,
      since: d.since ? Number(d.since) : null,
      mediaUrl: d.mediaUrl || null,
      font: d.font,
      hearts: 0,
    };
    tiltCleanup();
    const card = renderCard(msg, 'preview');
    previewSlot.replaceChildren(card);
    tiltCleanup = attachTilt(card, 12);
    avatarSlot.innerHTML = donutSVG(d.handle || d.name || 'you', { flavor: d.flavor, size: 64 });
    save('draft', d);
  };

  form.addEventListener('input', sync);
  form.addEventListener('change', (e) => {
    const t = e.target as HTMLInputElement;
    if (t.name === 'flavor' || t.name === 'sticker') sound.pop();
    sync();
  });

  urlIn.addEventListener('change', () => {
    const url = urlIn.value.trim();
    if (!url) {
      draft.mediaUrl = '';
    } else if (safeMediaUrl(url)) {
      draft.mediaUrl = url;
      mediaStatus.textContent = 'Link added ✓';
    } else {
      mediaStatus.textContent = 'That link needs to start with https://';
      return;
    }
    clearMedia.hidden = !draft.mediaUrl;
    sync();
  });
  clearMedia.addEventListener('click', () => {
    draft.mediaUrl = '';
    urlIn.value = '';
    fileIn.value = '';
    mediaStatus.textContent = '';
    clearMedia.hidden = true;
    sync();
  });
  fileIn.addEventListener('change', async () => {
    const file = fileIn.files?.[0];
    if (!file) return;
    if (file.size > 20 * 1024 * 1024) {
      mediaStatus.textContent = 'That file is a bit big — try one under 20 MB.';
      return;
    }
    uploading = true;
    submit.setAttribute('disabled', '');
    mediaStatus.textContent = 'Frosting your photo…';
    try {
      const local = app.store.mode === 'local';
      const { blob, ext } = await prepareImage(file, local ? 640 : 1600);
      draft.mediaUrl = await app.store.uploadMedia(blob, ext);
      urlIn.value = '';
      mediaStatus.textContent = 'Photo added ✓';
      clearMedia.hidden = false;
      sync();
    } catch (err) {
      console.error(err);
      mediaStatus.textContent = 'Upload failed — you can paste an image link instead.';
    } finally {
      uploading = false;
      submit.removeAttribute('disabled');
    }
  });

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (uploading) return;
    const d = readDraft();
    error.textContent = '';
    if (!d.name) {
      error.textContent = 'Add your name so Dani knows who baked this!';
      nameIn.focus();
      sound.error();
      return;
    }
    if (d.body.trim().length < 2) {
      error.textContent = 'Your message is looking a little empty 🍩';
      bodyIn.focus();
      sound.error();
      return;
    }
    const last = load<number>('last-post', 0);
    if (Date.now() - last < 20_000) {
      error.textContent = 'Whoa, fresh out of the oven! Give it a few seconds before baking another.';
      return;
    }
    submit.setAttribute('disabled', '');
    submit.classList.add('is-loading');
    const input: NewMessage = {
      name: d.name.slice(0, 40),
      handle: d.handle || null,
      body: d.body.trim().slice(0, MAX_BODY),
      flavor: d.flavor,
      sticker: d.sticker,
      since: d.since ? Number(d.since) : null,
      mediaUrl: d.mediaUrl || null,
      font: d.font,
    };
    try {
      const { message, pending } = await app.store.add(input);
      app.addOwn(message, pending);
      save('last-post', Date.now());
      progress.setIdentity(d.name, d.handle);
      remove('draft');
      success(message, pending);
    } catch (err) {
      console.error(err);
      error.textContent = 'The oven hiccupped — please try again in a moment.';
      sound.error();
      submit.removeAttribute('disabled');
      submit.classList.remove('is-loading');
    }
  });

  const success = (message: Message, pending: boolean) => {
    tiltCleanup();
    const card = renderCard(message, 'preview');
    const box = h('div', { class: 'baked__card' }, card);
    const actions = h(
      'div',
      { class: 'baked__actions' },
      h(
        'button',
        {
          class: 'btn btn--primary',
          type: 'button',
          onclick: () => {
            current?.close();
            document.getElementById('wall')?.scrollIntoView({ behavior: 'smooth' });
          },
        },
        pending ? 'Back to the wall' : 'See it on the wall',
      ),
      h(
        'button',
        {
          class: 'btn btn--ghost',
          type: 'button',
          html: `${icon('download', 18)} Save your card`,
          onclick: () => void downloadCard(message),
        },
      ),
    );
    const done = h(
      'div',
      { class: 'baked' },
      h('p', { class: 'hud-label' }, pending ? 'Status: in the oven' : 'Status: on the wall'),
      h('h2', { class: 'baked__title' }, pending ? 'Your donut is in the oven!' : 'Fresh out of the oven!'),
      h(
        'p',
        { class: 'baked__sub' },
        pending
          ? 'The organizers will pop it onto the wall shortly. You can already see it on your screen, marked “in the oven”.'
          : `It’s on the wall for ${config.streamer.name} and everyone to see. Thank you for being a Donut 💗`,
      ),
      box,
      actions,
    );
    panel.replaceChildren(done);
    sound.success();
    requestAnimationFrame(() => {
      burstFrom(card, { count: 140, power: 14 });
      rain(2.5);
    });
    progress.unlock('baker');
  };

  sync();
  counter.textContent = `${clamp(bodyIn.value.length, 0, MAX_BODY)} / ${MAX_BODY}`;
  current = openModal(panel, {
    label: 'Bake a message',
    className: 'modal--composer',
    onClose: () => {
      tiltCleanup();
      current = null;
    },
  });
  setTimeout(() => (draft.name ? bodyIn : nameIn).focus({ preventScroll: true }), 80);
}
