#!/bin/sh
# Tags the session title with the project for the terminal and VS Code, through
# the UserPromptSubmit and SessionStart hooks' `sessionTitle`. The desktop app
# ignores hook titles, so there the hooks module renames through the app instead.
# Keep PALETTE, the hash and the tag format in step with hooks/register.ts.

[ "$CLAUDE_CODE_ENTRYPOINT" = "claude-desktop" ] && exit 0

input=$(cat)

# Reads one top-level JSON string field, still JSON-escaped.
field() {
  printf '%s' "$input" | sed -n -E "s/.*\"$1\" *: *\"(([^\"\\\\]|\\\\.)*)\".*/\\1/p" | head -n 1
}

event=$(field hook_event_name)
title=$(field session_title)
cwd=$(field cwd)

# `session_title` carries a custom title only; an AI-named session keeps its
# name in the transcript, its latest `ai-title` entry.
if [ -z "$title" ]; then
  transcript=$(field transcript_path | sed -e 's/\\\\/\//g')
  [ -f "$transcript" ] && title=$(grep -E -o '"type":"ai-title","aiTitle":"([^"\\]|\\.)*"' "$transcript" | tail -n 1 | sed -E 's/.*"aiTitle":"(([^"\\]|\\.)*)"$/\1/')
fi
[ -n "$title" ] && [ -n "$cwd" ] || exit 0

# The project is the folder, or the repository above a worktree.
folder=$(printf '%s' "$cwd" | sed -e 's/\\\\/\//g' -e 's/\/*$//' -e 's/\/\.claude\/worktrees\/.*//' -e 's/\/\.worktrees\/.*//')
project=${folder##*/}
[ -n "$project" ] || exit 0
lower=$(printf '%s' "$project" | tr '[:upper:]' '[:lower:]')

PALETTE="purple:🟣 blue:🔵 green:🟢 yellow:🟡 orange:🟠 red:🔴 brown:🟤 black:⚫ white:⚪"

marker=
old_ifs=$IFS
IFS=,
for pair in $CLAUDE_PLUGIN_OPTION_COLORS; do
  key=$(printf '%s' "${pair%%=*}" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
  color=$(printf '%s' "${pair#*=}" | tr -d ' ' | tr '[:upper:]' '[:lower:]')
  [ "$key" = "$lower" ] || continue
  for entry in $(printf '%s' "$PALETTE" | tr ' ' ','); do
    [ "${entry%%:*}" = "$color" ] && marker=${entry#*:}
  done
done
IFS=$old_ifs

if [ -z "$marker" ]; then
  hash=0
  for byte in $(printf '%s' "$lower" | od -An -v -tu1); do
    hash=$(( (hash * 31 + byte) % 4294967296 ))
  done
  index=$(( hash % 9 ))
  for entry in $PALETTE; do
    [ "$index" -eq 0 ] && marker=${entry#*:} && break
    index=$(( index - 1 ))
  done
fi

sep='·'
name=$(printf '%s' "$project" | sed -e 's/\\/\\\\/g' -e 's/"/\\"/g')
tag="$marker $name $sep "

case $title in
  "$tag"*) exit 0 ;;
esac

# Drop an older tag for this project: bracketed, or with another colour.
rest=$title
for entry in $PALETTE; do
  m=${entry#*:}
  for prefix in "$m $name $sep " "$m [$name] $sep " "$m [$name] " "$m $name "; do
    case $rest in
      "$prefix"*) rest=${rest#"$prefix"} ;;
    esac
  done
done
for prefix in "[$name] $sep " "[$name] "; do
  case $rest in
    "$prefix"*) rest=${rest#"$prefix"} ;;
  esac
done

printf '{"hookSpecificOutput":{"hookEventName":"%s","sessionTitle":"%s%s"}}\n' "$event" "$tag" "$rest"
