import crypto from "node:crypto";
import { cookies } from "next/headers";
const cookieName = "gradtrack_workspace";
const secret = () => process.env.WORKSPACE_TOKEN_SECRET || "development-only-change-me";
export const hashToken = (token: string) => crypto.createHash("sha256").update(token).digest("hex");
export const sign = (token: string) => crypto.createHmac("sha256", secret()).update(token).digest("base64url");
export const newToken = () => crypto.randomBytes(32).toString("base64url");
export const seal = (token: string) => `${token}.${sign(token)}`;
export const unseal = (value?: string) => { const [token, signature] = value?.split(".") ?? []; return token && signature && crypto.timingSafeEqual(Buffer.from(sign(token)), Buffer.from(signature)) ? token : null; };
export async function currentToken() { return unseal((await cookies()).get(cookieName)?.value); }
export const workspaceCookie = (token: string) => ({ name: cookieName, value: seal(token), httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "lax" as const, path: "/", maxAge: 60 * 60 * 24 * 30 });
