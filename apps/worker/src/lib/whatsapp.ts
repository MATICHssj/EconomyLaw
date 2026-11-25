import type { Env } from '../env';

/**
 * Cliente mínimo de WhatsApp Cloud API (Meta). Solo mensajes de servicio
 * (respuestas dentro de 24 h de que el usuario escribió) → costo $0.
 */
export interface Button {
  id: string;
  title: string; // máx. 20 caracteres
}

export interface ListRow {
  id: string;
  title: string; // máx. 24
  description?: string; // máx. 72
}

export interface Messenger {
  text(to: string, body: string): Promise<void>;
  buttons(to: string, body: string, buttons: Button[]): Promise<void>;
  list(to: string, body: string, buttonLabel: string, rows: ListRow[]): Promise<void>;
  downloadMedia(mediaId: string): Promise<{ bytes: Uint8Array; mime: string }>;
  markRead(messageId: string): Promise<void>;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export class WhatsAppClient implements Messenger {
  private base: string;
  constructor(
    private env: Env,
    private fetcher: typeof fetch = fetch,
  ) {
    this.base = `https://graph.facebook.com/${env.WHATSAPP_API_VERSION ?? 'v21.0'}`;
  }

  private async send(payload: object) {
    const res = await this.fetcher(`${this.base}/${this.env.WHATSAPP_PHONE_NUMBER_ID}/messages`, {
      method: 'POST',
      headers: { authorization: `Bearer ${this.env.WHATSAPP_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify({ messaging_product: 'whatsapp', recipient_type: 'individual', ...payload }),
    });
    if (!res.ok) console.error('WhatsApp send failed', res.status, await res.text().catch(() => ''));
  }

  text(to: string, body: string) {
    return this.send({ to, type: 'text', text: { body: clip(body, 4000), preview_url: false } });
  }

  buttons(to: string, body: string, buttons: Button[]) {
    return this.send({
      to,
      type: 'interactive',
      interactive: { type: 'button', body: { text: clip(body, 1000) }, action: { buttons: buttons.slice(0, 3).map((b) => ({ type: 'reply', reply: { id: b.id.slice(0, 256), title: clip(b.title, 20) } })) } },
    });
  }

  list(to: string, body: string, buttonLabel: string, rows: ListRow[]) {
    return this.send({
      to,
      type: 'interactive',
      interactive: {
        type: 'list',
        body: { text: clip(body, 1000) },
        action: { button: clip(buttonLabel, 20), sections: [{ title: 'Opciones', rows: rows.slice(0, 10).map((r) => ({ id: r.id.slice(0, 200), title: clip(r.title, 24), description: r.description ? clip(r.description, 72) : undefined })) }] },
      },
    });
  }

  async downloadMedia(mediaId: string) {
    const meta = await this.fetcher(`${this.base}/${mediaId}`, { headers: { authorization: `Bearer ${this.env.WHATSAPP_TOKEN}` } });
    if (!meta.ok) throw new Error(`media meta ${meta.status}`);
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    const file = await this.fetcher(url, { headers: { authorization: `Bearer ${this.env.WHATSAPP_TOKEN}` } });
    if (!file.ok) throw new Error(`media ${file.status}`);
    return { bytes: new Uint8Array(await file.arrayBuffer()), mime: mime_type };
  }

  async markRead(messageId: string) {
    await this.send({ status: 'read', message_id: messageId });
  }
}

/** Mensaje entrante ya normalizado. */
export interface Incoming {
  id: string;
  from: string;
  type: 'text' | 'button' | 'audio' | 'image' | 'other';
  text?: string;
  buttonId?: string;
  mediaId?: string;
  caption?: string;
}

interface WebhookBody {
  entry?: Array<{ changes?: Array<{ value?: { messages?: Array<Record<string, unknown>> } }> }>;
}

export function extractMessages(body: WebhookBody): Incoming[] {
  const out: Incoming[] = [];
  for (const e of body.entry ?? [])
    for (const c of e.changes ?? [])
      for (const m of c.value?.messages ?? []) {
        const id = String(m.id ?? '');
        const from = String(m.from ?? '');
        const type = String(m.type ?? '');
        if (!id || !from) continue;
        if (type === 'text') out.push({ id, from, type: 'text', text: (m.text as { body?: string })?.body ?? '' });
        else if (type === 'interactive') {
          const i = m.interactive as { button_reply?: { id: string; title: string }; list_reply?: { id: string; title: string } };
          const r = i.button_reply ?? i.list_reply;
          if (r) out.push({ id, from, type: 'button', buttonId: r.id, text: r.title });
        } else if (type === 'button') out.push({ id, from, type: 'button', buttonId: String((m.button as { payload?: string })?.payload ?? ''), text: String((m.button as { text?: string })?.text ?? '') });
        else if (type === 'audio') out.push({ id, from, type: 'audio', mediaId: (m.audio as { id: string }).id });
        else if (type === 'image') out.push({ id, from, type: 'image', mediaId: (m.image as { id: string }).id, caption: (m.image as { caption?: string }).caption });
        else out.push({ id, from, type: 'other' });
      }
  return out;
}
