import * as https from 'https';
import { ExpoPushMessage, ExpoPushTicket } from './types';

export function sendExpoNotifications(messages: ExpoPushMessage[]): Promise<ExpoPushTicket[]> {
  const body = JSON.stringify(messages);
  console.log('[Expo] Sending to Expo Push API:', body);

  return new Promise((resolve, reject) => {
    const options = {
      hostname: 'exp.host',
      path: '/--/api/v2/push/send',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        'Accept-Encoding': 'gzip, deflate',
        'Content-Length': Buffer.byteLength(body),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      console.log('[Expo] Response status:', res.statusCode);
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        console.log('[Expo] Raw response body:', data);
        try {
          const parsed = JSON.parse(data);
          console.log('[Expo] Parsed tickets:', JSON.stringify(parsed.data));
          resolve(parsed.data ?? []);
        } catch (e) {
          console.error('[Expo] Failed to parse response:', e);
          reject(new Error('Failed to parse Expo push response'));
        }
      });
    });

    req.on('error', (e) => {
      console.error('[Expo] HTTPS request error:', e);
      reject(e);
    });

    req.write(body);
    req.end();
  });
}
