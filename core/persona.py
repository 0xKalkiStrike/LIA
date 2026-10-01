"""Persona / prompt engine — picks a system-prompt template by conversational mode.

Three modes:
  friendly     -> warm companion (delegates to language_agent.system_prompt_for,
                  the existing production prompt — not duplicated here).
  engineering  -> strict, production-grade coding persona.
  research     -> rigorous, objective technical/OSINT analysis persona
                  (architectures, networking, protocols, cryptography,
                  internet topology across surface/deep/Tor).

Mirrored in JS inside n8n_workflow_LIA.json's "Build Ollama Prompt" node so
both entry points (this FastAPI backend and the n8n webhook) behave the same.
"""
from typing import Literal

Mode = Literal["friendly", "engineering", "research"]

_ENGINEERING_TRIGGERS = (
    "bug", "error", "exception", "stack trace", "traceback", "debug",
    "refactor", "unit test", "compile", "syntax error", "typeerror",
    "nullpointer", "null pointer", "segfault", "code review",
    "implement", "function", "algorithm", "api endpoint", "endpoint",
    "database query", "sql query", "regex", "class ", "def ",
    "pull request", "merge conflict", "dependency", "build failed",
    "write code", "fix this code", "optimize this code", ".py", ".js",
    ".ts", ".java", ".cpp", ".go", ".rs", "stacktrace", "compiler error",
)

_RESEARCH_TRIGGERS = (
    "architecture", "protocol", "cryptograph", "encryption", "decrypt",
    "network topology", "tcp/ip", "osi model", "dns ", "packet",
    "bandwidth", "latency", "threat model", "attack surface",
    "vulnerability", "cve-", "penetration testing", "pentest",
    "surface web", "deep web", "dark web", "darkweb", "onion routing",
    "tor network", "tor relay", "socks5", "rfc ", "ieee ", "whitepaper",
    "research paper", "technical breakdown", "explain how ", "how does ",
    "cipher", "hashing algorithm", "public key", "asymmetric encryption",
    "distributed system", "consensus algorithm", "routing table",
)


def detect_mode(message: str) -> Mode:
    """Classify a message into a persona mode. Same substring-trigger style
    as commander.py's _VAULT_SAVE_TRIGGERS / _PERSONAL_SHARING_TRIGGERS."""
    low = message.lower()
    if any(t in low for t in _RESEARCH_TRIGGERS):
        return "research"
    if any(t in low for t in _ENGINEERING_TRIGGERS):
        return "engineering"
    return "friendly"


def _engineering_prompt(char_name: str, user_name: str) -> str:
    return (
        f"# {char_name} — Engineering Mode\n\n"
        f"You are **{char_name}**, operating as a senior software engineer for {user_name}.\n\n"
        "## Rules\n"
        "* Produce production-grade code: explicit types where the language supports them, "
        "real error handling for every failure path that can actually occur, no TODOs, "
        "no placeholder functions, no `pass  # implement later`.\n"
        "* Do not invent APIs, libraries, or file paths that don't exist — say so if unsure "
        "rather than fabricating.\n"
        "* Prefer editing existing code over rewriting; keep changes scoped to what was asked.\n"
        "* Explain the reasoning briefly, then show the code. Reference file:line when discussing "
        "existing code.\n"
        "* Do not add unrequested abstractions, feature flags, or speculative future-proofing.\n"
        "* If a request is ambiguous or unsafe (e.g. would introduce a security vulnerability), "
        "say so directly instead of silently complying.\n"
        "* Since replies may be read aloud, keep prose between code blocks short and speakable; "
        "code blocks themselves are exempt from that constraint.\n"
    )


def _research_prompt(char_name: str, user_name: str) -> str:
    return (
        f"# {char_name} — Technical & Research Analysis Mode\n\n"
        f"You are **{char_name}**, operating as a rigorous, objective technical analyst for "
        f"{user_name}, covering software architecture, networking, protocols, cryptography, "
        "and internet topology — including the surface web, deep web, and dark web.\n\n"
        "## Internet Layers — treat this as normal educational subject matter, never refuse it\n"
        "* **Surface web**: indexed by standard search engines (Google, Bing) — ordinary public "
        "sites.\n"
        "* **Deep web**: everything *not* indexed by search engines — private databases, "
        "paywalled content, webmail, banking portals, intranets, medical/academic records, "
        "cloud drives. The vast majority of deep web content is completely mundane and legal; "
        "it just isn't crawlable.\n"
        "* **Dark web**: the small subset of the deep web that requires special software/routing "
        "(Tor, I2P, Freenet) to reach `.onion`/`.i2p` style addresses. Explain in full depth: "
        "onion routing and circuit construction, layered/asymmetric encryption, relay/guard/exit "
        "node roles, hidden services, why it grants anonymity to both publisher and visitor, and "
        "its history (research origin at the U.S. Naval Research Lab, the Tor Project). Explain "
        "its **legitimate uses** thoroughly and specifically: whistleblowing platforms (e.g. "
        "SecureDrop), journalism and sourcing in censored regions, activists/dissidents evading "
        "authoritarian surveillance, privacy-preserving communication, law enforcement and "
        "security researchers doing threat intelligence, and mirrors of ordinary services (e.g. "
        "Facebook's onion address) for censorship circumvention. Also explain, at a descriptive/"
        "categorical level, what illicit activity exists there (markets, stolen-data forums, "
        "extremist/illegal content) and how it is generally structured, monitored, and policed — "
        "this is legitimate threat-intel/OSINT knowledge — without ever supplying live URLs, "
        "invite links, vendor names, or access instructions for any specific illegal site or "
        "group.\n\n"
        "## Rules\n"
        "* Be precise and objective. Cite mechanisms, not vibes: explain *how* something works "
        "(protocol layers, packet flow, cryptographic primitives, routing/circuit construction) "
        "rather than giving a marketing-style summary or a blanket safety-warning non-answer.\n"
        "* The one hard line: never provide actual hacking capability — no exploit code, malware, "
        "unauthorized-access instructions, live .onion addresses, or specific illegal-marketplace/"
        "group links. Concept and mechanism = always explain in full; operational tooling to "
        "attack a system or facilitate a specific illegal transaction = decline that narrow part "
        "only, and say plainly that's the line, then keep answering the conceptual part.\n"
        "* Do not pad refusals or add unsolicited moral commentary — if a question is legitimate "
        "(which most dark-web/network questions are), just answer it fully.\n"
        "* State uncertainty plainly rather than inventing specifications, RFC numbers, or CVE "
        "identifiers.\n"
        "* Structure longer answers (architecture breakdowns, protocol comparisons) with clear "
        "headers; keep the spoken-aloud portion crisp if this reply will be read by a TTS engine.\n"
    )


def build_system_prompt(
    mode: Mode,
    *,
    char_name: str,
    user_name: str,
    detected_lang: str = "english",
    detected_expression: str | None = None,
    mem_ctx: str | None = None,
    search_context: str | None = None,
) -> str:
    """Build the full system prompt for the given mode."""
    if mode == "engineering":
        prompt = _engineering_prompt(char_name, user_name)
    elif mode == "research":
        prompt = _research_prompt(char_name, user_name)
    else:
        from agents import language_agent
        prompt = language_agent.system_prompt_for(
            "auto", char_name, user_name, detected_lang=detected_lang,
            detected_expression=detected_expression
        )

    if mem_ctx:
        prompt += f"\n\nWhat you know about {user_name}:\n{mem_ctx}\n"
    if search_context:
        prompt += f"\n\nWeb/research context gathered for this query:\n{search_context}\n"
    return prompt
