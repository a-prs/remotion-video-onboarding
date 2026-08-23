#!/usr/bin/env python3
"""Install this Claude skill for Codex, and keep AGENTS.md in sync with it.

Codex (OpenAI) reads the same SKILL.md format as Claude Code (shared standard
since ~Dec 2025), but discovers skills from a different location and doesn't
read Claude's own CLAUDE.md. Rather than hand-maintain a parallel copy of the
instructions (which drifts), this script:

1. Copies this skill's folder to ~/.codex/skills/<name>/ (also tries
   .agents/skills/<name>/ in the current project, since newer Codex versions
   look there first — installs to both, harmless if one path is unused).
2. Parses SKILL.md's frontmatter (name/description) and writes/refreshes a
   short block in the project's AGENTS.md, delimited by BEGIN/END markers so
   re-running this script never clobbers whatever the user wrote by hand
   above or below that block.

Pattern lifted from digitalsamba/claude-code-video-toolkit's
migrate_to_codex.py, which solves the exact same problem.

Usage:
    python3 scripts/migrate_to_codex.py [--reset]

--reset removes the installed copies and the AGENTS.md block instead of
installing them.
"""
import re
import shutil
import sys
from pathlib import Path

SKILL_DIR = Path(__file__).resolve().parent.parent
SKILL_MD = SKILL_DIR / "SKILL.md"
MARKER_BEGIN = "<!-- BEGIN GENERATED: remotion-video-onboarding -->"
MARKER_END = "<!-- END GENERATED: remotion-video-onboarding -->"


def parse_frontmatter(text: str) -> dict:
    """Handles both `key: value` on one line and YAML folded-block values
    (`key: >-` followed by indented continuation lines), which is what
    SKILL.md's multi-paragraph `description` field uses."""
    if not text.startswith("---"):
        return {}
    end = text.find("\n---", 3)
    head = text[3:end]
    fm = {}
    key = None
    for line in head.splitlines():
        m = re.match(r'^([a-zA-Z_]+):\s*(.*)$', line)
        if m and not line.startswith((" ", "\t")):
            key, rest = m.group(1), m.group(2).strip()
            if rest and rest not in (">-", ">", "|-", "|"):
                fm[key] = rest
                key = None
            else:
                fm[key] = ""
            continue
        if key and line.startswith((" ", "\t")):
            fm[key] += line.strip() + " "
    return {k: v.strip() for k, v in fm.items()}


def install_copy(dest: Path) -> None:
    if dest.exists():
        shutil.rmtree(dest)
    dest.parent.mkdir(parents=True, exist_ok=True)
    shutil.copytree(SKILL_DIR, dest, ignore=shutil.ignore_patterns("__pycache__", "*.pyc"))
    print(f"installed -> {dest}")


def update_agents_md(project_root: Path, name: str, description: str) -> None:
    agents_md = project_root / "AGENTS.md"
    existing = agents_md.read_text(encoding="utf-8") if agents_md.exists() else ""

    block = (
        f"{MARKER_BEGIN}\n"
        f"## {name}\n\n"
        f"{description.strip()}\n\n"
        f"Full instructions: `~/.codex/skills/{name}/SKILL.md` "
        f"(also see `references/` and `scripts/` in that folder).\n"
        f"{MARKER_END}\n"
    )

    if MARKER_BEGIN in existing and MARKER_END in existing:
        pattern = re.compile(re.escape(MARKER_BEGIN) + r".*?" + re.escape(MARKER_END) + r"\n?", re.DOTALL)
        updated = pattern.sub(block, existing)
    elif existing:
        updated = existing.rstrip("\n") + "\n\n" + block
    else:
        updated = block

    agents_md.write_text(updated, encoding="utf-8")
    print(f"updated -> {agents_md}")


def reset(project_root: Path, name: str) -> None:
    for dest in [Path.home() / ".codex" / "skills" / name, project_root / ".agents" / "skills" / name]:
        if dest.exists():
            shutil.rmtree(dest)
            print(f"removed {dest}")
    agents_md = project_root / "AGENTS.md"
    if agents_md.exists():
        text = agents_md.read_text(encoding="utf-8")
        pattern = re.compile(re.escape(MARKER_BEGIN) + r".*?" + re.escape(MARKER_END) + r"\n?", re.DOTALL)
        new_text = pattern.sub("", text)
        if new_text != text:
            agents_md.write_text(new_text, encoding="utf-8")
            print(f"cleaned block from {agents_md}")


def main() -> int:
    text = SKILL_MD.read_text(encoding="utf-8")
    fm = parse_frontmatter(text)
    name = fm.get("name", "remotion-video-onboarding")
    description = fm.get("description", "")
    project_root = Path.cwd()

    if "--reset" in sys.argv:
        reset(project_root, name)
        return 0

    install_copy(Path.home() / ".codex" / "skills" / name)
    install_copy(project_root / ".agents" / "skills" / name)
    update_agents_md(project_root, name, description)
    print("\nDone. Codex should pick this up on its next run — check both "
          "~/.codex/skills/ and .agents/skills/ discovery paths since this "
          "varies by Codex version.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
