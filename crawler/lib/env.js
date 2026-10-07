// crawler/lib/env.js — ⛔ D75 · THE WORKER'S ENVIRONMENT HOLDS ONLY WHAT IT NEEDS.
// No database path, no API key, no user data. The worker refuses to start when anything else that looks
// like a secret is present — so a mis-wired deploy (a shared variable group, a copied .env) fails loudly
// instead of putting a key beside a browser that opens hostile pages.
export const ALLOWED = Object.freeze([
  "CRAWLER_TOKEN",       // the one secret: lease auth + result signing
  "CRAWLER_DRAFT_URL",   // draft's PUBLIC origin — never a private-network name
  "CRAWLER_DRY_RUN",     // "1": log the requests it would make, make none
  "CRAWLER_CHROME_PATH", // the browser binary, when the browser stage is wanted
  "CRAWLER_POLL_SECONDS",
  "PORT",                // /health
]);
// Names that are a platform's own and carry no secret (process, shell, container, Railway metadata).
const PLATFORM = /^(PATH|HOME|HOSTNAME|PWD|SHLVL|TERM|LANG|LC_\w+|TZ|USER|SHELL|NODE_ENV|NODE_VERSION|YARN_VERSION|NPM_\w+|npm_\w+|_|OLDPWD|RAILWAY_(?!.*(TOKEN|SECRET|KEY))\w+|SYSTEMROOT|SystemRoot|WINDIR|windir|COMSPEC|ComSpec|PATHEXT|TEMP|TMP|APPDATA|LOCALAPPDATA|ProgramData|ProgramFiles.*|CommonProgram.*|COMPUTERNAME|USERNAME|USERPROFILE|USERDOMAIN.*|HOMEDRIVE|HOMEPATH|PROCESSOR_\w+|NUMBER_OF_PROCESSORS|OS|PUBLIC|ALLUSERSPROFILE|SESSIONNAME|LOGONSERVER|DriverData|PSModulePath|ChocolateyInstall)$/;
const SECRET_LIKE = /(TOKEN|SECRET|PASSWORD|PASSWD|KEY|CREDENTIAL|DATABASE|DB_|_DB$|DSN|DATA_DIR|SESSION|COOKIE|ANTHROPIC|RESEND|STRIPE|SERPAPI|ADZUNA|GOOGLE|AWS_|AZURE_|GITHUB_)/i;

/** @returns {{ ok: boolean, unexpected: string[] }} — `unexpected` names, never values */
export function auditEnvironment(env = process.env) {
  const unexpected = Object.keys(env).filter(k => !ALLOWED.includes(k) && !PLATFORM.test(k) && SECRET_LIKE.test(k));
  return { ok: unexpected.length === 0, unexpected };
}
