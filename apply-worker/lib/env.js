// apply-worker/lib/env.js — ⛔ D100 · d100WorkerHasNoDbCredentials: the worker's environment holds only what it needs.
// No database path, no model key, no draft session secret. It refuses to start when anything else that looks like a
// secret is present — a shared variable group or a copied .env fails loudly instead of putting draft's keys beside a
// browser that holds users' portal sessions. (The crawler's rule, crawler/lib/env.js, with this worker's names.)
export const ALLOWED = Object.freeze([
  "APPLY_WORKER_TOKEN",       // lease auth + report signing, shared with draft
  "APPLY_WORKER_DRAFT_URL",   // draft's PUBLIC origin
  "APPLY_WORKER_MASTER_KEY",  // wraps the key store (D100 P1's stand-in for a KMS key) — never on draft's service
  "APPLY_WORKER_KEY_DIR",     // the worker's own volume for the key store
  "APPLY_WORKER_ID",          // names this worker in leases
  "APPLY_WORKER_POLL_SECONDS",
  "APPLY_NO_SCREENSHOTS",     // always "1" here: no screenshot of a signed-in page (services/applyAutomation.js)
  "PUPPETEER_EXECUTABLE_PATH", // the browser binary services/browserLauncher.js reads
  "BROWSER_EXECUTABLE_PATH",
  "PORT",
]);
const PLATFORM = /^(PATH|HOME|HOSTNAME|PWD|SHLVL|TERM|LANG|LC_\w+|TZ|USER|SHELL|NODE_ENV|NODE_VERSION|YARN_VERSION|NPM_\w+|npm_\w+|_|OLDPWD|RAILWAY_(?!.*(TOKEN|SECRET|KEY))\w+|SYSTEMROOT|SystemRoot|WINDIR|windir|COMSPEC|ComSpec|PATHEXT|TEMP|TMP|APPDATA|LOCALAPPDATA|ProgramData|ProgramFiles.*|CommonProgram.*|COMPUTERNAME|USERNAME|USERPROFILE|USERDOMAIN.*|HOMEDRIVE|HOMEPATH|PROCESSOR_\w+|NUMBER_OF_PROCESSORS|OS|PUBLIC|ALLUSERSPROFILE|SESSIONNAME|LOGONSERVER|DriverData|PSModulePath|ChocolateyInstall)$/;
const SECRET_LIKE = /(TOKEN|SECRET|PASSWORD|PASSWD|KEY|CREDENTIAL|DATABASE|DB_|_DB$|DSN|DATA_DIR|SESSION|COOKIE|ANTHROPIC|RESEND|STRIPE|SERPAPI|ADZUNA|GOOGLE|AWS_|AZURE_|GITHUB_|SQLITE)/i;

/** @returns {{ ok: boolean, unexpected: string[] }} — names only, never values */
export function auditEnvironment(env = process.env) {
  const unexpected = Object.keys(env).filter(k => !ALLOWED.includes(k) && !PLATFORM.test(k) && SECRET_LIKE.test(k));
  return { ok: unexpected.length === 0, unexpected };
}
