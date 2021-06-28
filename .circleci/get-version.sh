#!/bin/sh

set -e

MYDIR="$(dirname "$0")"
MYDIR="$(cd "$MYDIR"; pwd)"

JQ="$(command -v jq 2>/dev/null || which jq 2>/dev/null || :)"
GIT_CLI="$(command -v git 2>/dev/null || which git 2>/dev/null || :)"
VERSION="0"

if [ -n "$JQ" ] && [ -x "$JQ" ]; then
  VERSION="$(jq --raw-output .info.version "${MYDIR}/../src/plugin.json")"
elif [ -e "${MYDIR}/../version.tag" ]; then
  VERSION="$(cat "${MYDIR}/../version.tag")"
else
  echo "unable to parse plugin.json or version.tag -- bailing"
fi

SNAPSHOT_RELEASE="SNAPSHOT"

if [ -n "${CIRCLE_BUILD_NUM}" ]; then
  SNAPSHOT_RELEASE="${CIRCLE_BUILD_NUM}.${SNAPSHOT_RELEASE}"
elif [ -n "$GIT_CLI" ] && [ -x "$GIT_CLI" ] && [ -d .git ]; then
  SNAPSHOT_RELEASE="$(git log '--pretty=format:%cd' --date=short -1 | sed -e s,-,,g).${SNAPSHOT_RELEASE}"
fi

echo "$VERSION" | sed -e "s,-SNAPSHOT,-${SNAPSHOT_RELEASE},"
