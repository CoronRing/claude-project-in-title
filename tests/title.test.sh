#!/bin/sh
# Checks hooks/title.sh against sample hook inputs: sh tests/title.test.sh
# The colour picks are the ones hooks/register.test.ts expects, so both agree.

cd "$(dirname "$0")/.." || exit 1
failed=0

check() {
  got=$(printf '%s' "$1" | env -u CLAUDE_CODE_ENTRYPOINT CLAUDE_PLUGIN_OPTION_COLORS="$2" sh hooks/title.sh)
  if [ "$got" = "$3" ]; then
    echo "pass: $4"
  else
    echo "FAIL: $4"
    echo "  expected: $3"
    echo "  got:      $got"
    failed=1
  fi
}

out() {
  printf '{"hookSpecificOutput":{"hookEventName":"%s","sessionTitle":"%s"}}' "$1" "$2"
}

check '{"hook_event_name":"UserPromptSubmit","session_title":"Fix \"quoted\" bug","cwd":"C:\\Users\\me\\code\\my-app"}' '' \
  "$(out UserPromptSubmit '🟢 my-app · Fix \"quoted\" bug')" 'windows path, escaped quotes, picked colour'
check '{"hook_event_name":"UserPromptSubmit","session_title":"x","cwd":"/home/me/rc2"}' '' \
  "$(out UserPromptSubmit '🟢 rc2 · x')" 'picked colour for rc2'
check '{"hook_event_name":"UserPromptSubmit","session_title":"x","cwd":"/home/me/DATE"}' '' \
  "$(out UserPromptSubmit '🟡 DATE · x')" 'picked colour for DATE'
check '{"hook_event_name":"SessionStart","session_title":"[rc2] Old","cwd":"/home/me/rc2/.claude/worktrees/feat"}' 'rc2=green' \
  "$(out SessionStart '🟢 rc2 · Old')" 'bracket tag, worktree, chosen colour'
check '{"hook_event_name":"UserPromptSubmit","session_title":"🔵 rc2 · Old","cwd":"C:\\code\\rc2\\.worktrees\\x"}' ' RC2 = Green , other=red' \
  "$(out UserPromptSubmit '🟢 rc2 · Old')" 'recolour, windows worktree, spaced option'
check '{"hook_event_name":"UserPromptSubmit","session_title":"🟢 rc2 · Old","cwd":"/home/me/rc2"}' 'rc2=green' \
  '' 'already tagged'
check '{"hook_event_name":"UserPromptSubmit","prompt":"hi","cwd":"/home/me/rc2"}' '' \
  '' 'no title yet'
check '{"hook_event_name": "UserPromptSubmit", "session_title": "spaced", "cwd": "/home/me/rc2"}' '' \
  "$(out UserPromptSubmit '🟢 rc2 · spaced')" 'spaces in the JSON'
transcript=$(mktemp)
printf '%s\n' '{"type":"ai-title","aiTitle":"First name","sessionId":"s"}' '{"type":"user"}' '{"type":"ai-title","aiTitle":"Say \"hi\"","sessionId":"s"}' > "$transcript"
check "{\"hook_event_name\":\"UserPromptSubmit\",\"transcript_path\":\"$transcript\",\"cwd\":\"/home/me/rc2\"}" '' \
  "$(out UserPromptSubmit '🟢 rc2 · Say \"hi\"')" 'AI title read from the transcript'
rm -f "$transcript"

got=$(printf '%s' '{"session_title":"x","cwd":"/home/me/rc2"}' | CLAUDE_CODE_ENTRYPOINT=claude-desktop sh hooks/title.sh)
if [ -z "$got" ]; then echo 'pass: desktop is left to the hooks module'; else echo 'FAIL: desktop'; failed=1; fi

exit $failed
