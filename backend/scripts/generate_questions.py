"""
One-off question generator for Kite. Generates ~1000 new kid-friendly trivia
questions via Claude Sonnet through the Emergent LLM key, dedupes against the
existing 820 questions in questions_db.py, and appends the new ones in-place.

Run from /app/backend:  python -m scripts.generate_questions

Difficulty mix (60/30/10) and category weights are tuned for Kite's dreamy,
calming tone — heavier on whimsical/cozy/nature/animals/art/kid_classics,
lighter on history/science.
"""
import asyncio
import json
import os
import random
import re
import sys
from collections import Counter
from pathlib import Path

from dotenv import load_dotenv

# Load env from backend/.env regardless of cwd
BACKEND_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BACKEND_DIR / ".env")
sys.path.insert(0, str(BACKEND_DIR))

from emergentintegrations.llm.chat import LlmChat, UserMessage  # noqa: E402

EMERGENT_LLM_KEY = os.environ["EMERGENT_LLM_KEY"]

# Target total NEW questions (will be deduped, so ask for a bit extra)
TARGET_NEW = 550
BATCH_SIZE = 25  # questions per LLM call

# Rebalanced category weights — heavier on categories that were sparse after
# the first generation pass (geography, history, inventions, movies,
# technology, literature, holidays, sports, travel), lighter on already-heavy
# whimsical/animals/cozy_facts. Still tuned for Kite's calming tone.
CATEGORY_WEIGHTS = {
    "geography2": 10,
    "inventions": 10,
    "literature": 10,
    "movies": 9,
    "technology": 9,
    "travel": 9,
    "sports": 8,
    "holidays": 8,
    "history": 8,
    "language": 7,
    "science": 7,
    "mythology": 6,
    "math_fun": 6,
    "art": 6,
    "riddles": 6,
    "music": 5,
    "food": 5,
    "space": 5,
    "kite_lore": 5,
    "kid_classics": 4,
    "nature": 4,
    "cozy_facts": 3,
    "animals": 3,
    "whimsical": 3,
}

# Difficulty distribution (60% easy / 30% medium / 10% hard)
DIFFICULTY_WEIGHTS = [(1, 60), (2, 30), (3, 10)]
XP_BY_DIFFICULTY = {1: 10, 2: 20, 3: 30}

SYSTEM_PROMPT = """You are writing dreamy, kid-friendly trivia questions for an app called Kite.

Tone: calm, cozy, curious, warm — like a bedtime story. Never scary, competitive, or stressful.
Audience: bright 5th-grader. Easy enough for an 8-year-old to enjoy, but never dumbed down.

You must return ONLY a single valid JSON array. No prose, no markdown, no code fences.

Each question MUST be an object with EXACTLY these keys:
- "question": A friendly question (max ~120 chars). Avoid grim/violent/political/religious content.
- "options": A list of EXACTLY 4 short answer strings (each under 40 chars).
- "correct_answer": Integer index 0-3 pointing at the correct option in "options".

Rules:
- Each question must have a UNIQUE, factually correct answer.
- Distractors must be plausible but clearly wrong to the target reader.
- Avoid anything dated (current events, this-year pop culture). Favor timeless cozy facts.
- No trick questions, no questions about death, war, weapons, alcohol, drugs, gambling, or romantic relationships.
- No repeats of questions you've written before in this session.
"""


def _build_user_prompt(category: str, difficulty: int, count: int, avoid_topics: list[str]) -> str:
    diff_desc = {
        1: "EASY — anything a curious 8-year-old already knows or could guess quickly.",
        2: "MEDIUM — a curious 11-year-old would know with a moment of thought.",
        3: "HARD — an older kid or adult would find this rewarding to recall.",
    }[difficulty]

    avoid_block = ""
    if avoid_topics:
        sampled = random.sample(avoid_topics, min(8, len(avoid_topics)))
        avoid_block = (
            "\nAVOID rewriting these topics already covered (write about DIFFERENT things):\n- "
            + "\n- ".join(sampled)
        )

    return (
        f"Write EXACTLY {count} trivia questions in the '{category}' category.\n"
        f"Difficulty: {diff_desc}\n"
        f"Return a single JSON array of {count} objects, nothing else.{avoid_block}"
    )


def _normalize_for_dedupe(text: str) -> str:
    return re.sub(r"[^a-z0-9]+", "", text.lower())


def _validate_question(raw: dict) -> bool:
    if not isinstance(raw, dict):
        return False
    if not isinstance(raw.get("question"), str) or len(raw["question"]) < 8:
        return False
    opts = raw.get("options")
    if not isinstance(opts, list) or len(opts) != 4:
        return False
    if not all(isinstance(o, str) and 0 < len(o) <= 60 for o in opts):
        return False
    if len({o.strip().lower() for o in opts}) != 4:
        return False  # duplicate options
    ca = raw.get("correct_answer")
    if not isinstance(ca, int) or not 0 <= ca <= 3:
        return False
    return True


def _extract_json_array(text: str) -> list:
    """Pulls the first JSON array out of a response, tolerating stray prose."""
    text = text.strip()
    # Strip code fences if present
    text = re.sub(r"^```(?:json)?\s*", "", text)
    text = re.sub(r"\s*```$", "", text)
    # Find the first [...] block
    start = text.find("[")
    end = text.rfind("]")
    if start == -1 or end == -1 or end <= start:
        raise ValueError("No JSON array found in response")
    return json.loads(text[start : end + 1])


async def _generate_batch(category: str, difficulty: int, count: int, avoid_topics: list[str]) -> list[dict]:
    chat = (
        LlmChat(
            api_key=EMERGENT_LLM_KEY,
            session_id=f"kite-gen-{category}-{difficulty}-{random.randint(0, 99999)}",
            system_message=SYSTEM_PROMPT,
        )
        .with_model("anthropic", "claude-sonnet-4-6")
    )
    msg = UserMessage(text=_build_user_prompt(category, difficulty, count, avoid_topics))
    reply = await chat.send_message(msg)
    if not isinstance(reply, str):
        reply = str(reply)
    return _extract_json_array(reply)


def _plan_batches() -> list[tuple[str, int, int]]:
    """Yield (category, difficulty, count) tuples summing to ~TARGET_NEW."""
    total_weight = sum(CATEGORY_WEIGHTS.values())
    plan: list[tuple[str, int, int]] = []
    for category, w in CATEGORY_WEIGHTS.items():
        cat_total = round(TARGET_NEW * (w / total_weight))
        for diff, share in DIFFICULTY_WEIGHTS:
            sub = round(cat_total * (share / 100))
            while sub > 0:
                take = min(BATCH_SIZE, sub)
                plan.append((category, diff, take))
                sub -= take
    random.shuffle(plan)
    return plan


def _load_existing() -> tuple[list, set, dict]:
    """Return (list_of_existing, set_of_norm_questions, counter_per_category)."""
    questions_path = BACKEND_DIR / "questions_db.py"
    spec = {}
    exec(questions_path.read_text(), spec)  # noqa: S102 — local data file
    existing = spec["QUESTIONS"]
    seen = {_normalize_for_dedupe(q["question"]) for q in existing}
    counts = Counter(q.get("category", "?") for q in existing)
    return existing, seen, counts


def _next_id(category: str, counts: Counter) -> str:
    counts[category] += 1
    # Suffix counter and pass number to avoid collisions with old whim_* /
    # animal_* / prior `_gen_` schemes.
    return f"{category}_gen2_{counts[category]}"


def _append_to_db_file(new_questions: list[dict]) -> None:
    """Append new questions as a Python literal block to questions_db.py."""
    path = BACKEND_DIR / "questions_db.py"
    text = path.read_text()
    # Find the closing ] of the QUESTIONS list. Strategy: rfind the last ']' that
    # closes the top-level list assignment.
    closing = text.rfind("]")
    if closing == -1:
        raise RuntimeError("Could not locate end of QUESTIONS list")
    prefix = text[:closing].rstrip()
    if prefix.endswith(","):
        sep = "\n"
    else:
        sep = ",\n"
    block_lines = []
    for q in new_questions:
        block_lines.append("    " + json.dumps(q, ensure_ascii=False))
    inserted = sep + ",\n".join(block_lines) + ",\n"
    new_text = prefix + inserted + "]\n"
    path.write_text(new_text)


async def main() -> None:
    existing, seen, counts = _load_existing()
    print(f"Loaded {len(existing)} existing questions across {len(set(q['category'] for q in existing))} categories.")

    avoid_by_category: dict[str, list[str]] = {}
    for q in existing:
        avoid_by_category.setdefault(q["category"], []).append(q["question"])

    plan = _plan_batches()
    print(f"Plan: {len(plan)} batches, ~{sum(b[2] for b in plan)} target new questions.")

    new_questions: list[dict] = []
    new_seen = set()

    for idx, (category, diff, count) in enumerate(plan, 1):
        avoid = avoid_by_category.get(category, []) + [q["question"] for q in new_questions if q["category"] == category]
        try:
            batch = await _generate_batch(category, diff, count, avoid)
        except Exception as e:  # noqa: BLE001
            print(f"  [{idx}/{len(plan)}] {category} d={diff} x{count} -> ERROR: {e}")
            continue

        kept = 0
        for raw in batch:
            if not _validate_question(raw):
                continue
            norm = _normalize_for_dedupe(raw["question"])
            if norm in seen or norm in new_seen:
                continue
            new_seen.add(norm)
            q_obj = {
                "question_id": _next_id(category, counts),
                "question": raw["question"].strip(),
                "options": [o.strip() for o in raw["options"]],
                "correct_answer": int(raw["correct_answer"]),
                "category": category,
                "difficulty": diff,
                "xp_reward": XP_BY_DIFFICULTY[diff],
            }
            new_questions.append(q_obj)
            kept += 1

        print(f"  [{idx}/{len(plan)}] {category} d={diff} -> kept {kept}/{len(batch)} (total new: {len(new_questions)})")

        # Mild pacing so we don't hammer the LLM provider
        await asyncio.sleep(0.4)

    if not new_questions:
        print("No new questions kept — nothing to write.")
        return

    _append_to_db_file(new_questions)
    print(f"\nAppended {len(new_questions)} new questions to questions_db.py")
    print(f"New total: {len(existing) + len(new_questions)}")

    summary = Counter((q["category"], q["difficulty"]) for q in new_questions)
    for (cat, diff), n in sorted(summary.items()):
        print(f"  {cat:<14} d={diff} : {n}")


if __name__ == "__main__":
    asyncio.run(main())
