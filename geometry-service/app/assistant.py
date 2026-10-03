"""The chat box behind MathMe's home page and recipe bar.

It asks a Claude model to turn a student's request into MathMe recipes, the same little language
students can type themselves ("100 spheres → spiral → radius 20 → rainbow"). The browser checks
every recipe with its own reader before using it, so the model can only ever build what a student
could build by hand.

Needs the `anthropic` package and an ANTHROPIC_API_KEY. Without them /assist answers 503 and the
web app uses its own recipe reader instead.
"""

from __future__ import annotations

import os
from typing import Any

from pydantic import BaseModel, Field

try:  # optional dependency: pip install -e .[ai]
    import anthropic
except ImportError:  # pragma: no cover - depends on the install
    anthropic = None

MODEL = os.environ.get("ANTHROPIC_MODEL", "claude-opus-5-5")
MAX_COMMANDS = 8

SYSTEM_PROMPT = """You are the helper inside MathMe 3D Studio, a maths and 3D art tool for school students \
(about 15 years old). Students describe what they want to make; you build it by writing recipes.

A recipe is one line: a count, a shape, a pattern, then settings, separated by arrows or commas. Examples:
- 100 spheres → spiral → radius 20 → rotation 30° → size 0.5–2
- 500 spheres → sunflower → radius 14 → size 0.3–0.6 → colour brown to yellow
- 200 cones → sphere → radius 10 → rainbow
- 20x20 grid of cubes → spacing 1.5 → random sizes → size 0.3–1.5
- 400 cubes → ripples → wave height 2 → rainbow
- 12 stars → circle → radius 8 → spin 30
- 40 balls → helix → radius 4 → rise 0.4 → colour blue to pink
- 150 donuts → scatter → wobble 180 → random colours

Shapes: cube, sphere/ball, cylinder, cone, torus/donut, sheet, pyramid, prism, capsule, tetrahedron, \
octahedron, dodecahedron, icosahedron, knot, star, heart, vase.
Patterns: spiral, helix, sunflower, grid, circle/ring, wave, ripples, rings/target, sphere/globe, dome, \
scatter/cloud.
Settings: radius, rotation (degrees per object), spacing, rise, wave height, size A–B, random sizes, \
colour X to Y, a single colour name, rainbow, random colours, spin, wobble, mirror, kaleidoscope N.
Colours: red, orange, yellow, gold, green, lime, teal, cyan, blue, navy, indigo, purple, pink, magenta, \
brown, white, black, grey, silver.

Ready-made ideas you can start from instead (use its id): {ideas}. "heart" is a real human heart model \
for anatomy lessons.

Rules:
- Always answer by calling build_scene exactly once.
- Use one recipe per separate part of the artwork (at most {max_commands}).
- If the student asks to change the current scene, write recipes that add to it or describe the change.
- If the request is not something MathMe can build, return no recipes and say kindly what it can do.
- Reply in one or two short, friendly sentences a 15-year-old understands.
- Mention one maths idea when it fits."""

BUILD_TOOL: dict[str, Any] = {
    "name": "build_scene",
    "description": "Build or change the student's 3D scene with MathMe recipes.",
    "input_schema": {
        "type": "object",
        "properties": {
            "reply": {"type": "string", "description": "What you made, for the student."},
            "commands": {
                "type": "array",
                "items": {"type": "string"},
                "description": "Recipes, one per part of the artwork.",
            },
            "idea": {
                "type": ["string", "null"],
                "description": "Id of a ready-made idea to start from, or null.",
            },
            "name": {
                "type": ["string", "null"],
                "description": "A short project name (max 40 characters), or null.",
            },
        },
        "required": ["reply", "commands", "idea", "name"],
    },
}


class AssistRequest(BaseModel):
    message: str = Field(min_length=1, max_length=2000)
    scene: str = Field(default="", max_length=4000)
    ideas: list[str] = Field(default_factory=list, max_length=40)


class AssistResponse(BaseModel):
    reply: str
    commands: list[str]
    idea: str | None
    name: str | None


class AssistantUnavailable(Exception):
    pass


def available() -> bool:
    return anthropic is not None and bool(os.environ.get("ANTHROPIC_API_KEY"))


def _client() -> Any:
    if not available():
        raise AssistantUnavailable(
            "The chat helper needs an AI key on the geometry service (ANTHROPIC_API_KEY)."
        )
    return anthropic.Anthropic()


def parse_tool_answer(content: list[Any], ideas: list[str]) -> AssistResponse:
    """Pull the build_scene call out of the model's answer and keep only sensible values."""
    for block in content:
        if getattr(block, "type", None) == "tool_use" and block.name == "build_scene":
            data = block.input if isinstance(block.input, dict) else {}
            commands = [str(c)[:300] for c in data.get("commands") or [] if str(c).strip()]
            idea = data.get("idea")
            name = data.get("name")
            return AssistResponse(
                reply=str(data.get("reply") or "Here you go!")[:600],
                commands=commands[:MAX_COMMANDS],
                idea=idea if isinstance(idea, str) and idea in ideas else None,
                name=str(name)[:40] if isinstance(name, str) and name.strip() else None,
            )
    text = " ".join(getattr(b, "text", "") for b in content).strip()
    reply = text[:600] or "Sorry, I could not build that."
    return AssistResponse(reply=reply, commands=[], idea=None, name=None)


def ask(request: AssistRequest) -> AssistResponse:
    client = _client()
    system = SYSTEM_PROMPT.format(ideas=", ".join(request.ideas) or "none", max_commands=MAX_COMMANDS)
    message = client.messages.create(
        model=MODEL,
        max_tokens=1024,
        system=system,
        tools=[BUILD_TOOL],
        tool_choice={"type": "tool", "name": "build_scene"},
        messages=[
            {
                "role": "user",
                "content": f"Current scene: {request.scene or 'empty'}\n\nStudent: {request.message}",
            }
        ],
    )
    return parse_tool_answer(message.content, request.ideas)
