/**
 * Phone interviews: Tacit calls the expert through Twilio (SIP trunk) into a
 * LiveKit room where the Higgs Realtime interviewer agent is waiting.
 *
 * Flow: POST /api/phone/call → create explicit agent dispatch with metadata
 * {captureId, sessionId, phone} → the Python worker (services/phone-agent)
 * joins the room, dials the expert via LiveKit SIP, and streams transcripts
 * back to this API so extraction runs exactly as in the browser.
 */
import { AgentDispatchClient, RoomServiceClient, SipClient } from "livekit-server-sdk";
import { env } from "./env.js";

export interface PhoneConfig {
  url: string;
  apiKey: string;
  apiSecret: string;
  trunkId: string;
  agentName: string;
}

export function phoneConfig(): PhoneConfig | null {
  const url = env("LIVEKIT_URL");
  const apiKey = env("LIVEKIT_API_KEY");
  const apiSecret = env("LIVEKIT_API_SECRET");
  const trunkId = env("LIVEKIT_SIP_TRUNK_ID");
  if (!url || !apiKey || !apiSecret || !trunkId) return null;
  return { url, apiKey, apiSecret, trunkId, agentName: env("LIVEKIT_AGENT_NAME", "tacit-interviewer") };
}

function httpUrl(wsUrl: string): string {
  return wsUrl.replace(/^wss:/, "https:").replace(/^ws:/, "http:");
}

export async function startPhoneInterview(cfg: PhoneConfig, opts: { captureId: string; sessionId: string; phone: string; expertName: string; apiUrl: string }) {
  const roomName = `tacit-${opts.sessionId}`;
  const rooms = new RoomServiceClient(httpUrl(cfg.url), cfg.apiKey, cfg.apiSecret);
  await rooms.createRoom({ name: roomName, emptyTimeout: 120, maxParticipants: 4 });
  const dispatch = new AgentDispatchClient(httpUrl(cfg.url), cfg.apiKey, cfg.apiSecret);
  await dispatch.createDispatch(roomName, cfg.agentName, {
    metadata: JSON.stringify({ captureId: opts.captureId, sessionId: opts.sessionId, phone: opts.phone, expertName: opts.expertName, apiUrl: opts.apiUrl, trunkId: cfg.trunkId }),
  });
  return { roomName };
}

/** Optional server-side dial (the worker normally dials so it can wait for the answer). */
export async function dialExpert(cfg: PhoneConfig, roomName: string, phone: string, identity = "expert") {
  const sip = new SipClient(httpUrl(cfg.url), cfg.apiKey, cfg.apiSecret);
  return sip.createSipParticipant(cfg.trunkId, phone, roomName, { participantIdentity: identity, participantName: "Expert", waitUntilAnswered: true });
}
