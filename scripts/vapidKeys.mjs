// node scripts/vapidKeys.mjs — ⭐ D112 item 8: a fresh VAPID key pair for Web Push, in the encoding services/webPush.js
// reads. Prints the two lines to paste into Railway (the draft service's variables), then set
// VAPID_SUBJECT=mailto:support@jobsviadraft.com. Generate ONCE: a new pair invalidates every browser's subscription.
// Nothing is written to disk; keep the private key out of the repository.
import { generateVapidKeys } from "../services/webPush.js";

const { publicKey, privateKey } = generateVapidKeys();
console.log(`VAPID_PUBLIC_KEY=${publicKey}`);
console.log(`VAPID_PRIVATE_KEY=${privateKey}`);
console.log("VAPID_SUBJECT=mailto:support@jobsviadraft.com");
