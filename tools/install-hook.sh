#!/bin/sh
# Install draw's pre-push gate — GR1 / B21.
#
# Why this is a script and not a one-line `> .git/hooks/pre-push` in package.json:
#
# 1. GIT DOES NOT NECESSARILY RUN .git/hooks. A `core.hooksPath` setting — global on the machine
#    this was found on — silently redirects hook lookup somewhere else. The previous gate:install
#    hardcoded `.git/hooks/pre-push`, so it wrote a file git never executed: the gate had NEVER run
#    on push, while the file's presence made the repo look gated. A hook that looks like
#    enforcement and is not is worse than no hook at all.
#
# 2. WE MUST NOT WRITE INTO A GLOBAL HOOKS DIRECTORY. It is shared by every repository on the
#    machine, and a pre-push running `npm run gate` would fail every push from any repo without
#    that script. (Verified the hard way: the sibling mission-kit repo has no package.json.)
#
# So: resolve where git will ACTUALLY look; if that is outside this repository, pin a repo-local
# hooksPath first and install into that. The blast radius is exactly this repository, and the hook
# lands where git will really find it.
set -e

root=$(git rev-parse --show-toplevel)
hook=$(cd "$root" && git rev-parse --git-path hooks/pre-push)
case "$hook" in
	/*) abs="$hook" ;;
	*)  abs="$root/$hook" ;;
esac

case "$abs" in
	"$root"/*)
		;;                                    # git already looks inside this repo
	*)
		git -C "$root" config --local core.hooksPath .git/hooks
		abs="$root/.git/hooks/pre-push"
		echo "note: core.hooksPath pointed outside this repo ($hook) — pinned a local one so the"
		echo "      gate cannot be installed into a directory shared with your other repositories."
		;;
esac

mkdir -p "$(dirname "$abs")"
printf '#!/bin/sh\nnpm run gate\n' > "$abs"
chmod +x "$abs"
echo "pre-push hook installed at $abs"
