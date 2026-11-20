/* ORGANIZERS — the donut factory's quality control. Approve, hide or delete messages. */
import { h, append, timeAgo } from '../lib/dom';
import { config } from '../config';
import { app } from '../state';
import { renderCard } from '../components/card';
import { donutSVG } from '../components/art';
import { icon } from '../components/icons';
import type { Message } from '../data/types';

export async function mountAdmin() {
  document.documentElement.classList.add('view-admin');
  document.querySelector('.prepaint')?.remove();
  document.title = `Organizers · ${config.streamer.community}`;
  const root = h('div', { class: 'admin' });
  document.body.appendChild(root);
  await app.init();
  const store = app.store;
  const live = store.mode === 'supabase';

  const header = h(
    'header',
    { class: 'admin__head' },
    h('span', { html: donutSVG('HeyDani', { flavor: 'strawberry', size: 48 }) }),
    h('div', null, h('p', { class: 'hud-label' }, 'Organizers only'), h('h1', null, 'Donut quality control')),
    h('a', { class: 'btn btn--ghost btn--sm', href: '#' }, 'Back to the site'),
  );

  if (live && !(await store.admin.isSignedIn())) {
    const email = h('input', { type: 'email', placeholder: 'organizer@email.com', required: true, autocomplete: 'username' });
    const pass = h('input', { type: 'password', placeholder: 'Password', required: true, autocomplete: 'current-password' });
    const err = h('p', { class: 'form-error', role: 'alert' });
    const form = h(
      'form',
      { class: 'admin__login glass' },
      h('p', { class: 'hud-label' }, 'Sign in'),
      h('p', { class: 'admin__note' }, 'Use the organizer account you created in Supabase → Authentication, and make sure its email is in the organizers table (see README).'),
      email,
      pass,
      err,
      h('button', { class: 'btn btn--primary', type: 'submit' }, 'Sign in'),
    );
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      err.textContent = '';
      try {
        await store.admin.signIn(email.value.trim(), pass.value);
        location.reload();
      } catch (ex) {
        err.textContent = (ex as Error).message || 'Could not sign in';
      }
    });
    root.append(header, form);
    return;
  }

  let tab: 'pending' | 'approved' | 'all' = live ? 'pending' : 'all';
  let all: Message[] = [];
  const list = h('div', { class: 'admin__list' });
  const tabs = h('div', { class: 'seg' });
  const stats = h('p', { class: 'admin__stats' });
  const approveAll = h('button', { class: 'btn btn--primary btn--sm', type: 'button', hidden: !live }, 'Approve all pending');

  const load = async () => {
    try {
      all = await store.admin.listAll();
    } catch (e) {
      list.replaceChildren(h('p', { class: 'form-error' }, `Could not load messages: ${(e as Error).message}. Is your email in the organizers table?`));
      return;
    }
    render();
  };

  const render = () => {
    const pending = all.filter((m) => !m.approved);
    const approved = all.filter((m) => m.approved);
    stats.textContent = `${approved.length} on the wall · ${pending.length} waiting · ${all.length} total`;
    const tabsDef: [typeof tab, string][] = live
      ? [
          ['pending', `Waiting (${pending.length})`],
          ['approved', `On the wall (${approved.length})`],
          ['all', 'All'],
        ]
      : [['all', `All (${all.length})`]];
    tabs.replaceChildren(
      ...tabsDef.map(([id, label]) =>
        h('button', { class: `seg__btn${tab === id ? ' is-on' : ''}`, type: 'button', onclick: () => ((tab = id), render()) }, label),
      ),
    );
    approveAll.hidden = !live || !pending.length;
    const shown = tab === 'pending' ? pending : tab === 'approved' ? approved : all;
    if (!shown.length) {
      list.replaceChildren(h('p', { class: 'admin__empty' }, tab === 'pending' ? 'Nothing waiting. The oven is clear ✨' : 'No messages yet.'));
      return;
    }
    list.replaceChildren(
      ...shown.map((m) => {
        const actions = h('div', { class: 'admin__actions' });
        if (live) {
          actions.append(
            m.approved
              ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', html: `${icon('eyeOff', 16)} Hide`, onclick: () => act(() => store.admin.setApproved(m.id, false)) })
              : h('button', { class: 'btn btn--primary btn--sm', type: 'button', html: `${icon('check', 16)} Approve`, onclick: () => act(() => store.admin.setApproved(m.id, true)) }),
          );
        }
        actions.append(
          h('button', {
            class: 'btn btn--danger btn--sm',
            type: 'button',
            html: `${icon('trash', 16)} Delete`,
            onclick: () => {
              if (confirm(`Delete the message from ${m.name}? This can’t be undone.`)) void act(() => store.admin.remove(m.id));
            },
          }),
        );
        return h(
          'div',
          { class: `admin__row${m.approved ? '' : ' is-pending'}` },
          h('div', { class: 'admin__card' }, renderCard({ ...m, pending: false }, 'mini')),
          h('div', { class: 'admin__side' }, h('p', { class: 'admin__when' }, timeAgo(m.createdAt)), h('p', { class: `admin__state ${m.approved ? 'is-ok' : 'is-wait'}` }, m.approved ? 'On the wall' : 'Waiting for approval'), actions),
        );
      }),
    );
  };

  const act = async (fn: () => Promise<void>) => {
    try {
      await fn();
      await load();
    } catch (e) {
      alert((e as Error).message);
    }
  };
  approveAll.addEventListener('click', () =>
    act(async () => {
      for (const m of all.filter((x) => !x.approved)) await store.admin.setApproved(m.id, true);
    }),
  );

  append(root, [
    header,
    h(
      'div',
      { class: 'admin__bar glass' },
      tabs,
      stats,
      approveAll,
      h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: () => void load() }, 'Refresh'),
      live ? h('button', { class: 'btn btn--ghost btn--sm', type: 'button', onclick: async () => { await store.admin.signOut(); location.reload(); } }, 'Sign out') : null,
    ),
    live ? null : h('p', { class: 'admin__note glass' }, 'Preview Mode: messages live only in this browser. Deleting a sample hides all samples. Connect Supabase (see README) to get a shared, moderated wall.'),
    list,
  ]);
  await load();
  if (live) setInterval(load, 30_000);
}
