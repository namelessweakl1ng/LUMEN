import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

export const SESSION_COOKIE = "lumen-search-session";
const lifetime = 30 * 24 * 60 * 60;
function sign(secret: string, value: string) {
  return createHmac("sha256", secret).update(value).digest("hex");
}
export function sessionIdentity(cookie: string | undefined, secret: string, now = Math.floor(Date.now() / 1000)) {
  let id = "";
  let expires = 0;
  if (cookie && cookie.length < 200) {
    const parts = cookie.split(".");
    if (parts.length === 3 && /^[a-f0-9]{32}$/.test(parts[0]) && /^\d{1,12}$/.test(parts[1]) && /^[a-f0-9]{64}$/.test(parts[2])) {
      const expected = sign(secret, `session:${parts[0]}:${parts[1]}`);
      if (Number(parts[1]) > now && Number(parts[1]) <= now + lifetime && timingSafeEqual(Buffer.from(expected), Buffer.from(parts[2]))) {
        id = parts[0];
        expires = Number(parts[1]);
      }
    }
  }
  const fresh = !id;
  if (fresh) {
    id = randomBytes(16).toString("hex");
    expires = now + lifetime;
  }
  const value = `${id}.${expires}.${sign(secret, `session:${id}:${expires}`)}`;
  const header = `${id}.${now}.${sign(secret, `request:${id}:${now}`)}`;
  return { value, header, fresh, maxAge: expires - now };
}
