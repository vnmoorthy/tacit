"""
Tacit phone interviewer — a LiveKit Agents worker.

Joins a LiveKit room (dispatched by the Tacit API), dials the expert through a
Twilio SIP trunk, runs the interview on Boson AI Higgs Realtime, and streams
both sides of the conversation back to the Tacit API so knowledge atoms are
extracted exactly as they are for browser interviews.

Run:  python agent.py dev        (local)      |  python agent.py start (prod)
Env:  see .env.example
"""
import asyncio
import json
import logging
import os

import httpx
from dotenv import load_dotenv
from livekit import api
from livekit.agents import Agent, AgentSession, JobContext, RoomInputOptions, WorkerOptions, cli
from livekit.plugins import openai

load_dotenv()
log = logging.getLogger("tacit-phone")

BOSON_API_KEY = os.environ["BOSON_API_KEY"]
BOSON_REALTIME_URL = os.getenv("BOSON_REALTIME_URL", "wss://api.boson.ai/v1")
BOSON_VOICE = os.getenv("BOSON_VOICE", "default")
AGENT_NAME = os.getenv("LIVEKIT_AGENT_NAME", "tacit-interviewer")
TACIT_API_URL = os.getenv("TACIT_API_URL", "http://localhost:8787")


class TacitInterviewer(Agent):
    def __init__(self, instructions: str):
        super().__init__(instructions=instructions)


async def entrypoint(ctx: JobContext):
    meta = json.loads(ctx.job.metadata or "{}")
    capture_id = meta["captureId"]
    session_id = meta["sessionId"]
    phone = meta.get("phone")
    api_url = meta.get("apiUrl", TACIT_API_URL).rstrip("/")
    trunk_id = meta.get("trunkId") or os.getenv("LIVEKIT_SIP_TRUNK_ID")

    http = httpx.AsyncClient(base_url=f"{api_url}/api", timeout=60)

    async def instructions() -> str:
        r = await http.get(f"/captures/{capture_id}/instructions")
        r.raise_for_status()
        return r.json()["instructions"]

    session = AgentSession(
        llm=openai.realtime.RealtimeModel(
            model="higgs-realtime",
            base_url=BOSON_REALTIME_URL,
            api_key=BOSON_API_KEY,
            voice=BOSON_VOICE,
        ),
    )
    agent = TacitInterviewer(await instructions())

    async def refresh_agenda():
        try:
            await agent.update_instructions(await instructions())
        except Exception as e:  # noqa: BLE001
            log.warning("could not refresh instructions: %s", e)

    @session.on("conversation_item_added")
    def on_item(ev):
        item = ev.item
        text = (item.text_content or "").strip()
        if not text:
            return
        if item.role == "user":
            async def _expert():
                r = await http.post(f"/sessions/{session_id}/turns", json={"text": text, "generateNext": False})
                if r.is_success:
                    atoms = r.json().get("atoms", [])
                    log.info("expert turn → %d atoms", len(atoms))
                    await refresh_agenda()
            asyncio.create_task(_expert())
        elif item.role == "assistant":
            asyncio.create_task(http.post(f"/sessions/{session_id}/interviewer", json={"text": text}))

    await ctx.connect()
    await session.start(room=ctx.room, agent=agent, room_input_options=RoomInputOptions())

    if phone:
        log.info("dialing %s via trunk %s", phone, trunk_id)
        await ctx.api.sip.create_sip_participant(
            api.CreateSIPParticipantRequest(
                sip_trunk_id=trunk_id,
                sip_call_to=phone,
                room_name=ctx.room.name,
                participant_identity="expert",
                participant_name=meta.get("expertName", "Expert"),
                wait_until_answered=True,
            )
        )

    await session.generate_reply(instructions="Greet the expert warmly in one sentence, say you're Tacit calling to capture what they know, then ask the first question.")

    async def on_shutdown():
        try:
            await http.post(f"/sessions/{session_id}/end")
        finally:
            await http.aclose()

    ctx.add_shutdown_callback(on_shutdown)


if __name__ == "__main__":
    cli.run_app(WorkerOptions(entrypoint_fnc=entrypoint, agent_name=AGENT_NAME))
