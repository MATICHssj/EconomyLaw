import type { Env } from '../env';
import { accessToken } from './google';
import type { Store } from './store';

export interface PushMessage {
  title: string;
  body: string;
  url?: string;
  tag?: string;
}

export interface Pusher {
  send(uid: string, msg: PushMessage): Promise<number>;
}

/** Envía push a todos los dispositivos del usuario (FCM HTTP v1). Borra tokens inválidos. */
export class FcmPusher implements Pusher {
  constructor(
    private env: Env,
    private store: Store,
    private fetcher: typeof fetch = fetch,
  ) {}

  async send(uid: string, msg: PushMessage): Promise<number> {
    const tokens = await this.store.listIds(`users/${uid}/devices`);
    if (!tokens.length) return 0;
    const auth = await accessToken(this.env, this.fetcher);
    let sent = 0;
    for (const token of tokens) {
      const link = `${this.env.APP_URL}${msg.url ?? ''}`;
      const res = await this.fetcher(`https://fcm.googleapis.com/v1/projects/${this.env.FIREBASE_PROJECT_ID}/messages:send`, {
        method: 'POST',
        headers: { authorization: `Bearer ${auth}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token,
            notification: { title: msg.title, body: msg.body },
            data: { url: msg.url ?? '', tag: msg.tag ?? '' },
            webpush: { fcm_options: { link }, notification: { icon: `${this.env.APP_URL}/icons/icon-192.png`, tag: msg.tag } },
            android: { priority: 'high', notification: { tag: msg.tag } },
          },
        }),
      });
      if (res.ok) sent++;
      else if (res.status === 404 || res.status === 400) await this.store.delete(`users/${uid}/devices/${token}`);
    }
    return sent;
  }
}
