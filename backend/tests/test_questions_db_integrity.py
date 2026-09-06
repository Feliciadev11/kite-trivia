"""
Schema/content validation for backend/questions_db.py — the single source of
truth for trivia content. Runs against the Python data module directly (no
server, no MongoDB) so it catches a bad hand-edit or a bad LLM-generated batch
before it ever reaches the DB or a device. This is the safety net that makes
"add a question by hand" or "add a new category" low-risk per CLAUDE.md.
"""
from questions_db import QUESTIONS

VALID_DIFFICULTIES = {1, 2, 3, 4, 5}


def test_question_ids_are_unique():
    ids = [q["question_id"] for q in QUESTIONS]
    dupes = sorted({i for i in ids if ids.count(i) > 1})
    assert not dupes, f"Duplicate question_id(s), sampling/exclusion logic assumes uniqueness: {dupes}"


def test_every_question_has_a_valid_shape():
    problems = []
    for q in QUESTIONS:
        qid = q.get("question_id", "<missing id>")
        if not isinstance(q.get("question"), str) or not q["question"].strip():
            problems.append(f"{qid}: empty/missing question text")

        options = q.get("options")
        if not isinstance(options, list) or len(options) != 4:
            problems.append(f"{qid}: expected exactly 4 options, got {options!r}")

        correct = q.get("correct_answer")
        if not isinstance(correct, int) or not isinstance(options, list) or not (0 <= correct < len(options)):
            problems.append(f"{qid}: correct_answer {correct!r} is not a valid index into options")

        if not isinstance(q.get("category"), str) or not q["category"].strip():
            problems.append(f"{qid}: missing category")

        if q.get("difficulty") not in VALID_DIFFICULTIES:
            problems.append(f"{qid}: difficulty {q.get('difficulty')!r} must be one of {VALID_DIFFICULTIES}")

        if not isinstance(q.get("xp_reward"), int) or q["xp_reward"] <= 0:
            problems.append(f"{qid}: xp_reward must be a positive int, got {q.get('xp_reward')!r}")

    assert not problems, "\n" + "\n".join(problems)


def test_no_duplicate_question_text_within_a_category():
    seen = {}
    dupes = []
    for q in QUESTIONS:
        key = (q["category"], q["question"].strip().lower())
        if key in seen:
            dupes.append((q["question_id"], "duplicates", seen[key]))
        else:
            seen[key] = q["question_id"]
    assert not dupes, f"Duplicate question text within the same category: {dupes}"


def test_pool_has_enough_questions_at_every_difficulty_for_a_round():
    # get_questions() serves rounds of up to 10; each difficulty bucket needs
    # a reasonable pool or low levels/high levels will starve.
    from collections import Counter

    counts = Counter(q["difficulty"] for q in QUESTIONS)
    thin = {d: n for d, n in counts.items() if n < 10}
    assert not thin, f"Difficulty tier(s) too thin to reliably fill a 10-question round: {thin}"
