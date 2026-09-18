#!/usr/bin/env node
/**
 * One-command phone setup: provisions a Twilio Elastic SIP trunk (termination URI + credential list,
 * number attached) and a matching LiveKit outbound SIP trunk, then prints the LIVEKIT_SIP_TRUNK_ID
 * to add to .env. Idempotent: re-running reuses trunks with the same names.
 *
 *   node scripts/phone-setup.mjs
 *
 * Reads from .env (repo root): TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_PHONE_NUMBER (E.164),
 * LIVEKIT_URL, LIVEKIT_API_KEY, LIVEKIT_API_SECRET. Optional: SIP_TRUNK_NAME (default "tacit").
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync, appendFileSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve } from "node:path";

const root = resolve(new URL("..", import.meta.url).pathname);
const envPath = resolve(root, ".env");
if (existsSync(envPath)) process.loadEnvFile?.(envPath);
const need = (k) => {
  const v = (process.env[k] ?? "").trim();
  if (!v) {
    console.error(`missing ${k} in .env`);
    process.exit(1);
  }
  return v;
};
const SID = need("TWILIO_ACCOUNT_SID");
const TOKEN = need("TWILIO_AUTH_TOKEN");
const NUMBER = need("TWILIO_PHONE_NUMBER");
const LK_URL = need("LIVEKIT_URL");
const LK_KEY = need("LIVEKIT_API_KEY");
const LK_SECRET = need("LIVEKIT_API_SECRET");
const NAME = (process.env.SIP_TRUNK_NAME ?? "tacit").replace(/[^a-z0-9-]/gi, "").toLowerCase();

const auth = "Basic " + Buffer.from(`${SID}:${TOKEN}`).toString("base64");
const tw = async (path, params, method = "POST", base = "https://trunking.twilio.com/v1") => {
  const res = await fetch(`${base}${path}`, {
    method,
    headers: { authorization: auth, "content-type": "application/x-www-form-urlencoded" },
    body: params ? new URLSearchParams(params) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Twilio ${method} ${path} → ${res.status}: ${json.message ?? JSON.stringify(json).slice(0, 200)}`);
  return json;
};

// 1. Twilio: trunk with a termination URI
const trunks = await tw("/Trunks", null, "GET");
let trunk = (trunks.trunks ?? []).find((t) => t.friendly_name === `${NAME}-livekit`);
const domainName = `${NAME}-${SID.slice(-6).toLowerCase()}`;
if (!trunk) {
  trunk = await tw("/Trunks", { FriendlyName: `${NAME}-livekit`, DomainName: `${domainName}.pstn.twilio.com` });
  console.log("created Twilio trunk", trunk.sid);
} else console.log("reusing Twilio trunk", trunk.sid);
const termination = trunk.domain_name ?? `${domainName}.pstn.twilio.com`;

// 2. Twilio: credential list + credential, attached to the trunk
const lists = await tw("/CredentialLists", null, "GET", "https://api.twilio.com/2010-04-01/Accounts/" + SID + "/SIP");
let list = (lists.credential_lists ?? []).find((l) => l.friendly_name === `${NAME}-livekit`);
const username = `${NAME}lk`;
let password = process.env.SIP_PASSWORD;
if (!list) {
  password ??= randomBytes(12).toString("base64url") + "Aa1";
  list = await tw(`/CredentialLists`, { FriendlyName: `${NAME}-livekit` }, "POST", "https://api.twilio.com/2010-04-01/Accounts/" + SID + "/SIP");
  await tw(`/CredentialLists/${list.sid}/Credentials`, { Username: username, Password: password }, "POST", "https://api.twilio.com/2010-04-01/Accounts/" + SID + "/SIP");
  console.log("created credential list", list.sid, "username", username);
  console.log("SIP password (also needed by LiveKit, keep it):", password);
} else if (!password) {
  console.error("Credential list already exists; set SIP_PASSWORD in .env to the password you created before, or delete the list in Twilio and re-run.");
  process.exit(1);
}
const attached = await tw(`/Trunks/${trunk.sid}/CredentialLists`, null, "GET");
if (!(attached.credential_lists ?? []).some((l) => l.sid === list.sid)) {
  await tw(`/Trunks/${trunk.sid}/CredentialLists`, { CredentialListSid: list.sid });
  console.log("attached credential list to trunk");
}

// 3. Twilio: attach the phone number to the trunk
const nums = await tw(`/IncomingPhoneNumbers?PhoneNumber=${encodeURIComponent(NUMBER)}`, null, "GET", "https://api.twilio.com/2010-04-01/Accounts/" + SID);
const num = (nums.incoming_phone_numbers ?? [])[0];
if (!num) throw new Error(`${NUMBER} is not on this Twilio account`);
const onTrunk = await tw(`/Trunks/${trunk.sid}/PhoneNumbers`, null, "GET");
if (!(onTrunk.phone_numbers ?? []).some((p) => p.sid === num.sid)) {
  await tw(`/Trunks/${trunk.sid}/PhoneNumbers`, { PhoneNumberSid: num.sid });
  console.log("attached", NUMBER, "to trunk");
}

// 4. LiveKit: outbound trunk pointing at Twilio
const require = createRequire(resolve(root, "apps/api/package.json"));
const { SipClient } = require("livekit-server-sdk");
const sip = new SipClient(LK_URL.replace(/^wss:/, "https:").replace(/^ws:/, "http:"), LK_KEY, LK_SECRET);
const existing = await sip.listSipOutboundTrunk();
let out = existing.find((t) => t.name === `${NAME}-twilio`);
if (!out) {
  out = await sip.createSipOutboundTrunk(`${NAME}-twilio`, termination, [NUMBER], { authUsername: username, authPassword: password });
  console.log("created LiveKit outbound trunk", out.sipTrunkId);
} else console.log("reusing LiveKit outbound trunk", out.sipTrunkId);

if (!(process.env.LIVEKIT_SIP_TRUNK_ID ?? "").trim()) {
  appendFileSync(envPath, `\nLIVEKIT_SIP_TRUNK_ID=${out.sipTrunkId}\n`);
  console.log("wrote LIVEKIT_SIP_TRUNK_ID to .env");
}
console.log("\nDone. Restart the API (pnpm dev) and start the worker:\n  cd services/phone-agent && source .venv/bin/activate && python agent.py dev");
