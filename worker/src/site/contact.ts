/**
 * The contact page.
 *
 * A form rather than a mailto link, because the address it would expose is the one the
 * catalogue's own corrections come to, and a published address on a site crawlers read
 * eagerly is an address that stops being useful.
 */

import type { SiteContext } from './context';
import { page, crumbs } from './layout';
import { esc } from './util';
import { icon } from './icons';

export interface ContactState {
  /** Shown above the form when a submission was rejected. */
  problem?: string;
  /** Shown instead of the form when a submission went through. */
  sent?: boolean;
  /** True when the copy to the inbox failed and only the stored one exists. */
  storedOnly?: boolean;
  values?: { name?: string; email?: string; message?: string };
}

export function renderContact(ctx: SiteContext, state: ContactState = {}): string {
  const v = state.values ?? {};
  const body = `
${crumbs([{ href: '/', label: 'ngano' }, { label: 'Contact' }])}
<h1 class="title">Get in touch</h1>
<p class="lede">A correction to a record, a dataset the catalogue has missed, a question about the API, or anything else. Corrections are the most useful thing you can send: ${esc(String(ctx.stats.datasets))} records is a lot of surface for mistakes to hide in.</p>

${
  state.sent
    ? `<section class="block">
  <div class="callout">
    <strong>Message received.</strong>
    It is saved and will be read. A reply comes from a person, not an autoresponder, so
    it may take a few days.${
      state.storedOnly
        ? ' The copy to the inbox did not go out, so it may take longer than usual.'
        : ''
    }
  </div>
  <div class="btnrow" style="margin-top:18px">
    <a class="btn" href="/">${icon('arrow', 15)} Back to the catalogue</a>
    <a class="btn" href="/contact">Send another</a>
  </div>
</section>`
    : `${
        state.problem
          ? `<section class="block"><div class="callout"><strong>${esc(state.problem)}</strong></div></section>`
          : ''
      }
<section class="block" style="max-width:620px">
  <form class="form" method="post" action="/contact">
    <input type="hidden" name="started" value="${Date.now()}">
    <div class="field">
      <label for="c-name">Your name</label>
      <input id="c-name" name="name" type="text" required maxlength="120" autocomplete="name" value="${esc(v.name ?? '')}">
    </div>
    <div class="field">
      <label for="c-email">Your email</label>
      <input id="c-email" name="email" type="email" required maxlength="200" autocomplete="email" value="${esc(v.email ?? '')}">
      <p class="note" style="margin:0">Used to reply to you. Nothing else, ever.</p>
    </div>
    <div class="field">
      <label for="c-message">Message</label>
      <textarea id="c-message" name="message" required rows="8" maxlength="5000">${esc(v.message ?? '')}</textarea>
    </div>
    <div class="hp" aria-hidden="true">
      <label for="c-website">Leave this empty</label>
      <input id="c-website" name="website" type="text" tabindex="-1" autocomplete="off">
    </div>
    <div class="btnrow" style="margin-top:6px">
      <button class="btn pri" type="submit">${icon('mail', 15)} Send</button>
    </div>
  </form>
</section>

<section class="block">
  <div class="callout">
    <strong>Some things are faster elsewhere.</strong>
    A correction to a single record, or a dataset to add, is best as an issue on
    <a href="https://github.com/thisisisheanesu/ngano/issues/new/choose" rel="noopener external">GitHub</a>, where it stays visible and anyone can weigh in. Use this form for anything that is not a good fit for a public thread.
  </div>
</section>`
}
`;

  return page(
    ctx,
    {
      title: 'Contact',
      description:
        'Send a correction, a dataset the catalogue has missed, or a question about the ngano API. Messages go straight to the person who maintains the catalogue.',
      path: '/contact',
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'ContactPage',
        name: 'Contact',
        url: `${ctx.baseUrl}/contact`,
      },
    },
    body,
  );
}
