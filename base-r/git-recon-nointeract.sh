#!/usr/bin/env bash
# git-recon — run a quick audit of any git repo before reading its code
# Usage: git-recon [path]   (defaults to current directory)
#
# https://piechowski.io/post/git-commands-before-reading-code/
#
# Source: https://gist.github.com/gadenbuie/463ff1e9f3b0f48cddc44db2224d286b

set -eu

dir="${1:-.}"

if ! git -C "$dir" rev-parse --git-dir &>/dev/null; then
  echo "error: '$dir' is not a git repository" >&2
  exit 1
fi

# Colors via tput (degrades gracefully in dumb terminals)
bold=$(tput bold 2>/dev/null || true)
reset=$(tput sgr0 2>/dev/null || true)
cyan=$(tput setaf 6 2>/dev/null || true)
yellow=$(tput setaf 3 2>/dev/null || true)
magenta=$(tput setaf 5 2>/dev/null || true)
green=$(tput setaf 2 2>/dev/null || true)
red=$(tput setaf 1 2>/dev/null || true)

heading() {
  local color="$1" title="$2" desc="$3"
  echo
  echo "${bold}${color}══════════════════════════════════════════════${reset}"
  echo "${bold}${color}  $title${reset}"
  echo "${color}  $desc${reset}"
  echo "${bold}${color}══════════════════════════════════════════════${reset}"
  echo
}

run() {
  git -C "$dir" "$@"
}

pause() {
  echo
  printf "${bold}${cyan}  Next up: $1. Press Enter to continue...${reset}"
}

showcmd() {
  echo "${bold}  \$ $*${reset}"
  echo
}

# Reads "count label" lines from stdin, draws a proportional bar chart.
# Usage: some_pipeline | barchart COLOR [LABEL_FMT]
barchart() {
  local color="$1" label_fmt="${2:-%s}"
  awk -v c="$color" -v r="$reset" -v lfmt="$label_fmt" '
    { counts[NR]=$1; labels[NR]=$2; if($1>max) max=$1 }
    END {
      for(i=1;i<=NR;i++) {
        n = (max > 0) ? int(counts[i]/max*30+0.5) : 0
        bar = ""; for(j=0;j<n;j++) bar = bar "█"
        fmt = "  " lfmt "  %5d  %s%s%s\n"
        printf fmt, labels[i], counts[i], c, bar, r
      }
    }'
}

# ── 0. Repo overview ────────────────────────────────────────────────────────
repo_name=$(basename "$(run rev-parse --show-toplevel)")
repo_path=$(run rev-parse --show-toplevel)
origin=$(run remote get-url origin 2>/dev/null || echo "(no remote)")
repo_age=$(run log --reverse --format='%ar' | head -1)
first_commit=$(run log --reverse --format='%ad  %an: %s' --date=format:'%Y-%m-%d' | head -1)

echo
echo "  Repo:     ${bold}${repo_name}${reset}"
echo "  Path:     $repo_path"
echo "  Remote:   $origin"
echo "  Created:  $repo_age ($first_commit)"

# ── 1. Bus factor ────────────────────────────────────────────────────────────
heading "$yellow" "1. Bus Factor (all time)" \
  "Contributor commit counts — who built this?"
echo "  Look for: one person at 60%+ of commits. Then check the recent window below."
echo
showcmd "git shortlog -sn --no-merges"
run shortlog -sn --no-merges

echo
echo "${bold}${yellow}  ↳ Recent (last 6 months):${reset}"
echo
showcmd "git shortlog -sn --no-merges --since=\"6 months ago\""
run shortlog -sn --no-merges --since="6 months ago"

pause "tag cadence"

# ── 2. Tag cadence ───────────────────────────────────────────────────────────
heading "$green" "2. Tag Cadence" \
  "Release history — how often does the team ship?"
echo "  Look for: regular tags = disciplined releases. No tags = pre-release or"
echo "  no public versioning. Large gaps often signal abandonment or a rewrite."
echo
showcmd "git tag --sort=creatordate --format='%(creatordate:short)  %(refname:short)' | tail -20"
tags=$(run tag --sort=creatordate --format='%(creatordate:short)  %(refname:short)' 2>/dev/null | tail -20)
if [[ -z "$tags" ]]; then
  echo "  (no tags found)"
else
  echo "$tags"
fi

pause "velocity trend"

# ── 3. Velocity trend ────────────────────────────────────────────────────────
heading "$green" "3. Velocity Trend" \
  "Commits per month across the full project history"
echo "  Look for: steady rhythm = healthy. Sudden drop = someone left. Slow decline"
echo "  over 6-12 months = losing momentum. Spikes + quiet = batch releases."
echo
showcmd "git log --format='%ad' --date=format:'%Y-%m' | sort | uniq -c"
run log --format='%ad' --date=format:'%Y-%m' \
  | sort | uniq -c \
  | awk '{ actual[$2]=$1; if(!min || $2<min) min=$2; if($2>max) max=$2 }
    END {
      split(min, s, "-"); y=s[1]; m=s[2]+0
      split(max, e, "-"); ey=e[1]; em=e[2]+0
      while(y<ey || (y==ey && m<=em)) {
        label = sprintf("%04d-%02d", y, m)
        printf "%6d %s\n", (label in actual ? actual[label] : 0), label
        if(++m > 12) { m=1; y++ }
      }
    }' \
  | barchart "$green"

pause "commit timing"

# ── 4. Commit timing ─────────────────────────────────────────────────────────
heading "$cyan" "4. Commit Timing" \
  "When does this team actually ship?"
echo "  Look for: late-night or weekend spikes suggest crunch culture; spread across"
echo "  hours/days suggests a healthy or distributed team."
echo
echo "  ${bold}By hour (00–23):${reset}"
echo
showcmd "git log --format='%ad' --date=format:'%H' | sort | uniq -c"
run log --format='%ad' --date=format:'%H' | sort | uniq -c \
  | awk '{ actual[$2]=$1 }
    END {
      for(i=0;i<24;i++) {
        label = sprintf("%02d", i)
        printf "%6d %s\n", (label in actual ? actual[label] : 0), label
      }
    }' \
  | barchart "$cyan"
echo
echo "  ${bold}By day of week:${reset}"
echo
showcmd "git log --format='%ad' --date=format:'%a' | sort | uniq -c"
run log --format='%ad' --date=format:'%u %a' | sort | uniq -c \
  | awk '{ actual[$3]=$1 }
    END {
      split("Mon Tue Wed Thu Fri Sat Sun", days, " ")
      for(i=1;i<=7;i++)
        printf "%6d %s\n", (days[i] in actual ? actual[days[i]] : 0), days[i]
    }' \
  | barchart "$cyan" "%-3s"

pause "crisis patterns"

# ── 5. Crisis patterns ───────────────────────────────────────────────────────
heading "$red" "5. Crisis Patterns" \
  "Reverts, hotfixes, and emergency rollbacks in the past year"
echo "  Look for: a handful/year = normal. Every few weeks = team doesn't trust deploys."
echo "  Zero results = either stable, or poor commit discipline."
echo
showcmd "git log --oneline --since=\"1 year ago\" | grep -iE 'revert|hotfix|emergency|rollback'"
run log --oneline --since="1 year ago" \
  | grep -iE 'revert|hotfix|emergency|rollback' || echo "  (none found)"

pause "TODO/FIXME debt"

# ── 6. TODO/FIXME debt ───────────────────────────────────────────────────────
heading "$yellow" "6. TODO/FIXME Debt" \
  "Acknowledged technical debt in the current codebase"
echo "  Look for: a high count signals known problems kept getting deferred."
echo "  Files at the top are the most 'aspirationally unfinished'."
echo
showcmd "git grep -c -E 'TODO|FIXME|HACK|XXX' | sort -t: -k2 -nr | head -20"
debt=$(run grep -c -E 'TODO|FIXME|HACK|XXX' 2>/dev/null || true)
if [[ -z "$debt" ]]; then
  echo "  (none found)"
else
  total=$(echo "$debt" | awk -F: '{sum += $2} END {print sum}')
  echo "  Total: ${bold}${total}${reset} instances"
  echo
  echo "$debt" | sort -t: -k2 -nr | head -20 \
    | awk -F: '{printf "  %5d  %s\n", $2, $1}'
fi

pause "churn hotspots"

# ── 7. Churn hotspots ────────────────────────────────────────────────────────
heading "$cyan" "7. Churn Hotspots" \
  "Files changed most often in the past year"
echo "  Look for: the file everyone's afraid to touch. High churn + bugs = codebase drag."
echo
showcmd "git log --format=format: --name-only --since=\"1 year ago\" | sort | uniq -c | sort -nr | head -20"
churn_output=$(run log --format=format: --name-only --since="1 year ago" \
  | sort | uniq -c | sort -nr | head -20)
churn_files=$(echo "$churn_output" | awk '{print $2}')
echo "$churn_output"

pause "bug hotspots"

# ── 8. Bug hotspots ──────────────────────────────────────────────────────────
heading "$magenta" "8. Bug Hotspots" \
  "Files most touched by fix/bug commits"
echo "  Look for: files on BOTH this list and the churn list — they keep breaking and"
echo "  keep getting patched, but never properly fixed."
echo
showcmd "git log -i -E --grep=\"fix|bug|broken\" --name-only --format='' | sort | uniq -c | sort -nr | head -20"
run log -i -E --grep="fix|bug|broken" --name-only --format='' \
  | sort | uniq -c | sort -nr | head -20 \
  | while IFS= read -r line; do
      filename=$(awk '{print $2}' <<< "$line")
      if [[ -n "$filename" ]] && grep -qxF "$filename" <<< "$churn_files" 2>/dev/null; then
        printf "%s\n" "${line/$filename/${bold}${magenta}${filename}${reset}}"
      else
        printf "%s\n" "$line"
      fi
    done

echo
echo "${bold}${cyan}══════════════════════════════════════════════${reset}"
echo "${bold}  Done.${reset} Repo: $repo_path"
echo "${bold}${cyan}══════════════════════════════════════════════${reset}"
echo
