#!/usr/bin/env bash
# PreToolUse hook — refuses, in a headless ralph session, every route to a code
# review.
#
# The prompts have always said "run no code review in this session". Saying it
# is not enforcing it: on 16 Aug 2026 a session took the native `/code-review`
# anyway, which launches background agents and returns findings through a
# notification nobody was there to deliver. The work was finished and green,
# uncommitted, the issue open, and the run stopped (#51). This hook is the part
# the prompt cannot be: a `deny` the model receives as a tool result and cannot
# talk its way past.
#
# It reads the PreToolUse payload on stdin and answers on stdout. A `deny`
# carries a reason, and the reason is written for the model — it says what to do
# instead, because a session that stops dead is no better than one that reviews.
#
# Three routes, and the third is why this is a script rather than a tool ban:
#
#   Skill          — the review skills by name, whatever plugin they came from.
#   SlashCommand   — the same names typed as a command.
#   Agent / Task   — a sub-agent given a reviewer's brief. Banning sub-agents
#                    outright would cost the implementer Explore, which is worth
#                    keeping, so the ban is on the brief, not on the tool. In
#                    the review step (RALPH_STEP=review) sub-agents ARE the job,
#                    so that rule lifts and only the named skills stay blocked.
#
# What it deliberately does NOT block: reading the diff, running the test suite,
# `gh pr diff`, or a sub-agent asked to find where something lives. Verifying
# your own work is the job; convening a second opinion on it is the other
# session's.
#
# Env, all optional — ralph.sh sets them:
#   RALPH_STEP      implement | review | fix   (default: implement)
#   RALPH_HOOK_LOG  file every refusal is appended to, for the run's record.

set -uo pipefail

payload="$(cat)"
step="${RALPH_STEP:-implement}"

tool="$(jq -r '.tool_name // ""' <<< "$payload" 2>/dev/null)" || tool=""

# The names of the reviewing skills, with or without a `plugin:` prefix. `git`
# is not here and neither is `test`: this is a list of skills whose whole job is
# to judge finished work.
REVIEW_SKILLS='^(.*:)?(code-review|security-review|ultrareview|simplify)$'

# A sub-agent brief that reads as "go and review this". Deliberately narrow —
# the word "review" alone is not enough, or "review the docs before you start"
# would trip it.
REVIEW_BRIEF='(code[ -]review|security review|review (the |this |these |that )?(diff|change|changes|commit|implementation|work|code|branch|pr|patch)|(diff|changes|commit|implementation) for (bugs|issues|problems|correctness)|adversarial(ly)? (review|verify)|critique (the|this) (code|diff|change))'

decision=""
reason=""

case "$tool" in
  Skill)
    name="$(jq -r '.tool_input.skill // ""' <<< "$payload")"
    if [[ "$name" =~ $REVIEW_SKILLS ]]; then
      decision="deny"
      reason="Ralph blocks the '$name' skill in this session. Step 2 of this run is a separate, isolated session that reviews this commit with the whole diff in front of it — running a review here duplicates it, and its results arrive through a notification nobody is here to deliver. Carry on with your own work instead: finish the acceptance criteria, run the checklist in AGENTS.md, commit, and close the issue."
    fi
    ;;
  SlashCommand)
    cmd="$(jq -r '.tool_input.command // ""' <<< "$payload")"
    if [[ "$cmd" =~ /(code-review|security-review|ultrareview|simplify) ]]; then
      decision="deny"
      reason="Ralph blocks '$cmd' in this session — the review is step 2, a separate session, and it has not run yet. Carry on with your own work: finish the acceptance criteria, run the checklist in AGENTS.md, commit, and close the issue."
    fi
    ;;
  Agent|Task)
    # The review step spawns sub-agents on purpose — that is its whole method.
    if [[ "$step" != "review" ]]; then
      brief="$(jq -r '[.tool_input.prompt, .tool_input.description, .tool_input.subagent_type] | map(select(. != null)) | join(" ")' <<< "$payload")"
      shopt -s nocasematch
      if [[ "$brief" =~ $REVIEW_BRIEF ]]; then
        decision="deny"
        reason="Ralph blocks sub-agent code review in this session: the brief reads as a review, and a review under another name is still the review that step 2 does. Sub-agents are otherwise fine here — use them to FIND things (where a helper lives, which tests cover an area), not to judge what you built. Verify your own work against the issue's acceptance criteria yourself."
      fi
      shopt -u nocasematch
    fi
    ;;
esac

if [[ -n "${RALPH_HOOK_LOG:-}" && -n "$decision" ]]; then
  printf '%s\t%s\t%s\tDENY\n' "$(date -u +%H:%M:%SZ)" "$step" "$tool" >> "$RALPH_HOOK_LOG" 2>/dev/null || true
fi

if [[ "$decision" == "deny" ]]; then
  jq -nc --arg r "$reason" \
    '{hookSpecificOutput:{hookEventName:"PreToolUse",permissionDecision:"deny",permissionDecisionReason:$r}}'
  exit 0
fi

# Silence is consent: no output, exit 0, and the tool call proceeds to whatever
# the permission mode would have decided on its own.
exit 0
