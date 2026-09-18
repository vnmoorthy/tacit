# Phone interviews: Twilio → LiveKit → Higgs Realtime

Tacit can **call the expert on their phone**. The call is bridged by a Twilio SIP trunk into a LiveKit room, where a LiveKit Agents worker runs the Tacit interviewer on Boson AI's Higgs Realtime. Every turn streams back to the Tacit API, so knowledge atoms, coverage and the question queue update exactly as they do in the browser.

```
Expert's phone ──PSTN──▶ Twilio number ──SIP trunk──▶ LiveKit SIP ──▶ LiveKit room
                                                                         │
                                          services/phone-agent (Python) ◀┘
                                          │  Higgs Realtime (speech-to-speech)
                                          ▼
                                   Tacit API  /sessions/:id/turns  →  extraction → atoms
```

## 1. Twilio

1. Buy a voice-capable number.
2. Create an **Elastic SIP Trunk** (Twilio Console → Elastic SIP Trunking → Trunks). Note the trunk's termination URI (`yourtrunk.pstn.twilio.com`) and add a credential list (username + password).
3. Associate the number with the trunk.

## 2. LiveKit

1. Create a project at cloud.livekit.io; copy `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`.
2. Install the CLI (`brew install livekit-cli`) and authenticate: `lk cloud auth`.
3. Create the **outbound trunk** pointing at Twilio:

```bash
cat > outbound-trunk.json <<'JSON'
{ "trunk": { "name": "Twilio outbound", "address": "yourtrunk.pstn.twilio.com",
             "numbers": ["+14155551234"], "auth_username": "USER", "auth_password": "PASS" } }
JSON
lk sip outbound create outbound-trunk.json     # → prints ST_xxxx → LIVEKIT_SIP_TRUNK_ID
```

## 3. Run the worker

```bash
cd services/phone-agent
python -m venv .venv && source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env   # fill in LiveKit + Boson values
python agent.py dev
```

The worker registers as agent `tacit-interviewer` and waits for dispatches.

## 4. Configure the Tacit API

Add the same `LIVEKIT_*` values to the repo's `.env`. The `/api/health` endpoint now reports `phone: true`, and the capture overview shows **Call the expert**.

## 5. Make a call

Click **Call the expert**, enter the number in E.164 form (`+14155551234`). The API starts a session, dispatches the agent with `{captureId, sessionId, phone}`, the worker dials the expert, and the interview appears live under the capture.

## Notes

- Boson's first-party LiveKit plugin is announced as "coming soon"; until then the worker uses LiveKit's OpenAI Realtime plugin pointed at Boson's protocol-compatible endpoint (`wss://api.boson.ai/v1`).
- For inbound calls (expert calls Tacit), create an inbound trunk + dispatch rule with `lk sip inbound create` / `lk sip dispatch create`; the same worker serves both.
