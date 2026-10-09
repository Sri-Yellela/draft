// ⭐ D86: a host's consent link sends a signed-out person to /login?next=/oauth/authorize?…. After sign-in
// they go BACK to that consent screen (a server page, so a full navigation). Only that one path is
// honoured — `next` is never a general redirect, and a backslash (which some browsers read as a slash)
// is refused outright.
export function oauthNext(search) {
  const next = new URLSearchParams(search || "").get("next") || "";
  return /^\/oauth\/authorize\?[^\\]*$/.test(next) ? next : null;
}
