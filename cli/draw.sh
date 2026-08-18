#!/bin/bash
# DRAW CLI: sovereign terminal consumer of the read-only REST API (prism lineage).
# Speaks only HTTP — no imports from client/ or server/. Read-only by design:
# model mutations stay with the browser (single-writer rule); the one action
# is the Slides push, which projects, never mutates.

APIHOST="${DRAW_HOST:-http://localhost:8080}"
# resolve symlinked installs: templates and context live beside the REAL script
SELF="$(readlink -f "${BASH_SOURCE[0]}" 2>/dev/null || echo "$0")"
CONTEXT_FILE="${DRAW_CONTEXT:-$(dirname "$SELF")/.draw_context}"
TPL_DIR="$(dirname "$SELF")/tpl"

# --- COLORS ---
CYAN='\033[0;36m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color
# colors are for humans: pipes/redirects (agents, scripts) get clean text
if [[ -n "${NO_COLOR:-}" || ! -t 1 ]]; then
    CYAN=''; GREEN=''; YELLOW=''; RED=''; NC=''
fi

# --- PREFLIGHT ---
for DEP in curl jq column; do
    if ! command -v "$DEP" >/dev/null 2>&1; then
        echo -e "${RED}[ ERROR ]${NC} missing dependency: ${DEP}" >&2
        exit 1
    fi
done

# --- CORE LOGIC ---

function api() {
    local OUT
    OUT=$(curl -s --max-time 5 "$@") || true
    if [[ -z "$OUT" ]]; then
        echo -e "${RED}[ ERROR ]${NC} server unreachable at ${APIHOST}" >&2
        return 1
    fi
    # a proxy error page must never read as success
    if ! echo "$OUT" | jq -e . >/dev/null 2>&1; then
        echo -e "${RED}[ ERROR ]${NC} invalid (non-JSON) response from ${APIHOST}" >&2
        return 1
    fi
    printf '%s' "$OUT"
}

function api_error() {
    local ERROR
    ERROR=$(echo "$1" | jq -r '.error // empty' 2>/dev/null)
    if [[ -n "$ERROR" && "$ERROR" != "null" ]]; then
        echo -e "${RED}[ ERROR ]${NC} $ERROR" >&2
        return 0
    fi
    return 1
}

function get_context() {
    if [[ -f "$CONTEXT_FILE" ]]; then
        cat "$CONTEXT_FILE"
    fi
}

function set_context() {
    if ! echo "$1" > "$CONTEXT_FILE" 2>/dev/null; then
        echo -e "${RED}[ ERROR ]${NC} cannot write context file: ${CONTEXT_FILE}" >&2
        exit 1
    fi
    echo -e "${GREEN}[ CONTEXT ]${NC} Target diagram set to: ${CYAN}$1${NC}"
}

# id prefix or exact name -> diagram id; empty -> the server's first diagram.
# Fails (return 1) on no match: an unresolved query must never reach a URL
function resolve_diagram() {
    local Q=$1
    local LIST
    LIST=$(api "${APIHOST}/api/v1/diagrams") || return 1
    if [[ -z "$Q" ]]; then
        echo "$LIST" | jq -r '.[0].id // empty'
        return
    fi
    local MATCH
    MATCH=$(echo "$LIST" | jq -r --arg q "$Q" \
        '[.[] | select((.id | startswith($q)) or (.name == $q))] | first | .id // empty')
    if [[ -z "$MATCH" ]]; then
        echo -e "${RED}[ ERROR ]${NC} no diagram matches: ${Q}" >&2
        return 1
    fi
    echo "$MATCH"
}

function buildTable() {
    local INPUT="${1}"
    if [[ -z "$INPUT" || "$INPUT" == "[]" || "$INPUT" == "null" ]]; then return; fi

    read -r -d '' JQTABLE <<-CONFIG
        if type == "array" and (.[0]?) then
            [(
                [.[0] | to_entries[] | .key | ascii_upcase]
            ),(
                .[] | [to_entries[] | .value]
            )]
        elif type == "object" then
            [[ "KEY", "VALUE" ], (. | to_entries[] | [ .key, .value ])]
        else . end
CONFIG

    local HEADER="1"
    echo "$INPUT" | jq -r "$JQTABLE | .[] | @tsv" 2>/dev/null | column -t -s $'\t' | while read -r LINE; do
        if [[ -n $HEADER ]]; then
            echo -e "${CYAN}${LINE}${NC}"
            HEADER=""
        else
            echo "$LINE"
        fi
    done
}

function usage() {
    echo -e "${CYAN}Usage:${NC} draw <command> [args] [--diagram <id|name>] [--json] [--host <url>]"
    echo ""
    echo "Discovery & Context:"
    echo "  diagrams        List all diagrams on the server"
    echo "  context [id]    View or set the default target diagram"
    echo ""
    echo "The Query Engine:"
    echo "  get <entity> [id|name]   Interrogate entities (nodes, links, zones, groups)"
    echo "  show                     Full diagram view: status + every entity table"
    echo "  status                   Summary of the active diagram"
    echo ""
    echo "Projection:"
    echo "  push            Push the active diagram to its bound Google Slides deck"
    echo ""
    echo "Verification:"
    echo "  health          Server heartbeat"
    exit 1
}

function get_usage() {
    echo -e "${YELLOW}[ USAGE ]${NC} Entities: ${CYAN}nodes, links, zones, groups${NC}"
    echo ""
    echo "  Coordinates are center-origin model px ([0,0] = canvas/slide center)."
    echo "  Filter by id prefix or exact name: draw get nodes web-1"
    echo ""
    echo "  Example: draw get nodes"
    exit 0
}

# --- ARGUMENT PARSING ---
RAW_ARGS=()
TARGET_DIAGRAM=$(get_context)
OUTPUT_JSON=""

while [[ $# -gt 0 ]]; do
    case $1 in
        --diagram|--host)
            if [[ $# -lt 2 ]]; then
                echo -e "${RED}[ ERROR ]${NC} $1 requires a value" >&2
                exit 1
            fi
            if [[ "$1" == "--diagram" ]]; then TARGET_DIAGRAM="$2"; else APIHOST="$2"; fi
            shift 2 ;;
        --json) OUTPUT_JSON="1"; shift ;;
        *) RAW_ARGS+=("$1"); shift ;;
    esac
done

CMD=${RAW_ARGS[0]:-}
if [[ -z "$CMD" ]]; then usage; fi

# --- COMMAND EXECUTION ---

case $CMD in
    diagrams)
        DATA=$(api "${APIHOST}/api/v1/diagrams") || exit 1
        if [[ -n "$OUTPUT_JSON" ]]; then echo "$DATA" | jq .; else
            buildTable "$(echo "$DATA" | jq -f "${TPL_DIR}/diagrams.jq")"
        fi
        ;;

    context)
        NEW_ID=${RAW_ARGS[1]:-}
        if [[ -z "$NEW_ID" ]]; then
            CUR=$(get_context)
            if [[ -z "$CUR" ]]; then
                CUR=$(resolve_diagram "") || exit 1
                echo -e "${GREEN}[ CONTEXT ]${NC} No context set; defaulting to first diagram: ${CYAN}${CUR:-none}${NC}"
            else
                echo -e "${GREEN}[ CONTEXT ]${NC} Current target: ${CYAN}$CUR${NC}"
            fi
        else
            # resolve BEFORE writing: a typo or a dead server must never clobber
            # a valid saved context
            NEW=$(resolve_diagram "$NEW_ID") || exit 1
            set_context "$NEW"
        fi
        ;;

    get)
        ENT=${RAW_ARGS[1]:-}
        EID=${RAW_ARGS[2]:-}
        if [[ -z "$ENT" ]]; then get_usage; fi
        case $ENT in
            node|nodes)   ENT="nodes" ;;
            link|links)   ENT="links" ;;
            zone|zones)   ENT="zones" ;;
            group|groups) ENT="groups" ;;
            *) get_usage ;;
        esac

        ID=$(resolve_diagram "$TARGET_DIAGRAM") || exit 1
        DOC=$(api "${APIHOST}/api/v1/diagrams/${ID}") || exit 1
        api_error "$DOC" && exit 1

        if [[ -n "$OUTPUT_JSON" ]]; then
            if [[ "$ENT" == "links" ]]; then
                # same filter semantics as the table: match by endpoint NAMES too
                echo "$DOC" | jq --arg q "${EID}" '.nodes as $nodes | [.links[] | . as $l
                    | (([$nodes[] | select(.id == $l.src) | .name] | first) // $l.src) as $sn
                    | (([$nodes[] | select(.id == $l.dst) | .name] | first) // $l.dst) as $dn
                    | select(($q == "") or ($l.id | startswith($q)) or ($sn == $q) or ($dn == $q))
                    | $l]'
            else
                echo "$DOC" | jq --arg coll "$ENT" --arg q "${EID}" \
                    '.[$coll] | map(select(($q == "") or (.id | startswith($q)) or ((.name // "") == $q)))'
            fi
        else
            buildTable "$(echo "$DOC" | jq --arg q "${EID}" -f "${TPL_DIR}/${ENT}.jq")"
        fi
        ;;

    show)
        # one call = full situational awareness (built for agentic interrogation)
        ID=$(resolve_diagram "$TARGET_DIAGRAM") || exit 1
        DOC=$(api "${APIHOST}/api/v1/diagrams/${ID}") || exit 1
        api_error "$DOC" && exit 1
        if [[ -n "$OUTPUT_JSON" ]]; then echo "$DOC" | jq .; exit 0; fi

        echo -e "${CYAN}--- DRAW SHOW: $ID ---${NC}"
        echo -e "Name:    $(echo "$DOC" | jq -r .meta.name)"
        echo -e "Rev:     $(echo "$DOC" | jq -r .meta.rev)"
        SLIDES=$(echo "$DOC" | jq -r '.meta.slides.presentationId // empty')
        echo -e "Slides:  ${SLIDES:-unbound}"
        for SECTION in nodes links zones groups; do
            COUNT=$(echo "$DOC" | jq --arg c "$SECTION" '.[$c] | length')
            [[ "$COUNT" == "0" ]] && continue
            echo -e "--- ${SECTION} (${COUNT}) ---"
            buildTable "$(echo "$DOC" | jq --arg q "" -f "${TPL_DIR}/${SECTION}.jq")"
        done
        ;;

    status)
        ID=$(resolve_diagram "$TARGET_DIAGRAM") || exit 1
        DOC=$(api "${APIHOST}/api/v1/diagrams/${ID}") || exit 1
        api_error "$DOC" && exit 1
        if [[ -n "$OUTPUT_JSON" ]]; then echo "$DOC" | jq .meta; exit 0; fi

        echo -e "${CYAN}--- DRAW STATUS: $ID ---${NC}"
        echo -e "Name:    $(echo "$DOC" | jq -r .meta.name)"
        echo -e "Rev:     $(echo "$DOC" | jq -r .meta.rev)"
        echo -e "Grid:    $(echo "$DOC" | jq -r '.meta.grid // "legacy"') (60px pitch, [0,0] at center)"
        FF=$(curl -sf "$APIHOST/health" | jq -r '.flushFailures // 0')
        [ "${FF:-0}" != "0" ] && echo -e "Flush:   ${FF} FAILED — writes are not landing (see docs/BACKLOG.md B4)"
        SLIDES=$(echo "$DOC" | jq -r '.meta.slides.presentationId // empty')
        echo -e "Slides:  ${SLIDES:-unbound}"
        echo "---"
        buildTable "$(echo "$DOC" | jq -f "${TPL_DIR}/status.jq")"
        echo "---"
        ;;

    push)
        ID=$(resolve_diagram "$TARGET_DIAGRAM") || exit 1
        printf "[SYSTEM] Pushing %s to Slides... " "$ID"
        RESPONSE=$(curl -s --max-time 120 -X POST "${APIHOST}/api/v1/diagrams/${ID}/sync/slides") || true
        if [[ -z "$RESPONSE" ]]; then
            echo -e "${RED}FAILED${NC} (server unreachable at ${APIHOST})"
            exit 1
        fi
        # a proxy error page must never read as a successful push
        if ! echo "$RESPONSE" | jq -e . >/dev/null 2>&1; then
            echo -e "${RED}FAILED${NC} (invalid non-JSON response from ${APIHOST})"
            exit 1
        fi
        ERROR=$(echo "$RESPONSE" | jq -r '.error // empty')
        if [[ -n "$ERROR" ]]; then
            AUTH_URL=$(echo "$RESPONSE" | jq -r '.authUrl // empty')
            if [[ -n "$AUTH_URL" ]]; then
                echo -e "${YELLOW}AUTH REQUIRED${NC}"
                echo -e "  authorize at: ${CYAN}${AUTH_URL}${NC}"
            else
                echo -e "${RED}FAILED${NC}"
                echo -e "  ${RED}$ERROR${NC}"
                HELP=$(echo "$RESPONSE" | jq -r '.help // empty')
                [[ -n "$HELP" ]] && echo "  $HELP"
                PARTIAL=$(echo "$RESPONSE" | jq -r '.partial.deleted // empty')
                [[ -n "$PARTIAL" ]] && echo -e "  ${YELLOW}partial: ${PARTIAL} previously-pushed objects were already wiped${NC}"
            fi
            exit 1
        fi
        echo -e "DONE"
        OBJECTS=$(echo "$RESPONSE" | jq -r .objects)
        ENTITIES=$(echo "$RESPONSE" | jq -r .entities)
        DELETED=$(echo "$RESPONSE" | jq -r .deleted)
        STALE=$(echo "$RESPONSE" | jq -r '.staleDeleted // 0')
        echo -e "  objects  ${GREEN}${OBJECTS} created${NC} (${ENTITIES} entities)"
        echo -e "  wiped    ${DELETED} on target slide, ${STALE} stale elsewhere"
        if [[ $(echo "$RESPONSE" | jq -r .linksConnected) == "true" ]]; then
            echo -e "  links    ${GREEN}connected${NC}"
        else
            echo -e "  links    ${YELLOW}NOT connected (degraded)${NC}"
        fi
        if [[ $(echo "$RESPONSE" | jq -r .nodesGrouped) == "true" ]]; then
            echo -e "  groups   ${GREEN}grouped${NC}"
        else
            echo -e "  groups   ${YELLOW}NOT grouped (degraded)${NC}"
        fi
        echo -e "  deck     ${CYAN}$(echo "$RESPONSE" | jq -r .url)${NC}"
        ;;

    health)
        DATA=$(api "${APIHOST}/health") || exit 1
        echo -e "${CYAN}--- DRAW HEALTH ---${NC}"
        echo "$DATA" | jq --tab .
        ;;

    *)
        usage
        ;;
esac
