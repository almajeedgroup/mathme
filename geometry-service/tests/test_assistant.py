from types import SimpleNamespace

from fastapi.testclient import TestClient

from app import assistant
from app.main import app

client = TestClient(app)


def test_health_reports_the_assistant(monkeypatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    assert client.get("/health").json()["assistant"] is False


def test_assist_without_a_key_is_unavailable(monkeypatch) -> None:
    monkeypatch.delenv("ANTHROPIC_API_KEY", raising=False)
    response = client.post("/assist", json={"message": "a spiral of cubes"})
    assert response.status_code == 503


def test_tool_answer_is_cleaned_up() -> None:
    block = SimpleNamespace(
        type="tool_use",
        name="build_scene",
        input={
            "reply": "I made a rainbow spiral.",
            "commands": ["100 cubes → spiral → rainbow", "  ", *["1 cube"] * 20],
            "idea": "not-an-idea",
            "name": "A very long project name that keeps on going and going",
        },
    )
    answer = assistant.parse_tool_answer([block], ["dna", "spec"])
    assert answer.reply == "I made a rainbow spiral."
    assert answer.commands[0] == "100 cubes → spiral → rainbow"
    assert len(answer.commands) == assistant.MAX_COMMANDS
    assert answer.idea is None
    assert len(answer.name) <= 40


def test_assist_uses_the_model(monkeypatch) -> None:
    monkeypatch.setenv("ANTHROPIC_API_KEY", "test-key")
    calls = {}

    class FakeMessages:
        def create(self, **kwargs):
            calls.update(kwargs)
            return SimpleNamespace(
                content=[
                    SimpleNamespace(
                        type="tool_use",
                        name="build_scene",
                        input={"reply": "Here is DNA!", "commands": [], "idea": "dna", "name": "DNA"},
                    )
                ]
            )

    monkeypatch.setattr(assistant, "_client", lambda: SimpleNamespace(messages=FakeMessages()))
    if assistant.anthropic is None:
        monkeypatch.setattr(assistant, "anthropic", object())
    response = client.post("/assist", json={"message": "show me dna", "ideas": ["dna"]})
    assert response.status_code == 200
    assert response.json()["idea"] == "dna"
    assert calls["tool_choice"] == {"type": "tool", "name": "build_scene"}
    assert calls["model"] == assistant.MODEL
