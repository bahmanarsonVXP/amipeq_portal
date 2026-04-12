#!/usr/bin/env bash
# =============================================================================
# backlog.sh — Gestionnaire de Backlog AMIPEQ + Lanceur Claude Code
# Usage : ./backlog.sh
# Dépendances : bash 4+, awk, sed, grep (macOS : brew install gawk gnu-sed)
# =============================================================================

set -euo pipefail

# ─── CONFIG ──────────────────────────────────────────────────────────────────
BACKLOG_FILE="$(dirname "$0")/BACKLOG.md"
CLAUDE_CMD="claude"
EDITOR="${EDITOR:-nano}"

# Couleurs
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
CYAN='\033[0;36m'
BOLD='\033[1m'
DIM='\033[2m'
RESET='\033[0m'

# Statuts → couleurs
status_color() {
  case "$1" in
    "Done")       echo -e "${GREEN}✓ Done${RESET}" ;;
    "In Progress") echo -e "${YELLOW}⟳ In Progress${RESET}" ;;
    "Todo")       echo -e "${BLUE}○ Todo${RESET}" ;;
    "Failed")     echo -e "${RED}✗ Failed${RESET}" ;;
    *)            echo -e "${DIM}? $1${RESET}" ;;
  esac
}

priority_badge() {
  case "$1" in
    "high")   echo -e "${RED}[HIGH]${RESET}" ;;
    "medium") echo -e "${YELLOW}[MED]${RESET}" ;;
    "low")    echo -e "${DIM}[LOW]${RESET}" ;;
    *)        echo "" ;;
  esac
}

# ─── PARSEURS BACKLOG ─────────────────────────────────────────────────────────

# Extrait la liste des IDs dans l'ordre du fichier
get_all_ids() {
  sed -n 's/.*<!--US:START id="\([^"]*\)".*/\1/p' "$BACKLOG_FILE" 2>/dev/null || true
}

# Extrait un champ YAML du bloc d'une US donnée
get_field() {
  local id="$1" field="$2"
  awk -v id="$id" -v field="$field" '
    /<!--US:START id="/ { in_block = ($0 ~ ("id=\"" id "\"")) }
    /<!--US:END-->/ { in_block = 0 }
    in_block && $0 ~ "^" field ":" {
      sub("^" field ": *", "")
      gsub(/^"|"$/, "")
      print
      exit
    }
  ' "$BACKLOG_FILE"
}

# Extrait un champ liste YAML (depends_on, blocks, context_files)
get_list_field() {
  local id="$1" field="$2"
  awk -v id="$id" -v field="$field" '
    /<!--US:START id="/ { in_block = ($0 ~ ("id=\"" id "\"")) }
    /<!--US:END-->/ { in_block = 0 }
    in_block {
      if ($0 ~ "^" field ":") { in_list = 1; next }
      if (in_list && /^  - /) {
        val = $0; gsub(/^  - "|"$/, "", val); gsub(/^  - /, "", val)
        print val
        next
      }
      if (in_list && /^[^ ]/) { in_list = 0 }
    }
  ' "$BACKLOG_FILE"
}

# Extrait le body markdown (tout après le second ---)
get_body() {
  local id="$1"
  awk -v id="$id" '
    /<!--US:START id="/ { in_block = ($0 ~ ("id=\"" id "\"")) ; dash_count = 0 }
    /<!--US:END-->/ { in_block = 0 }
    in_block {
      if (/^---$/) { dash_count++; next }
      if (dash_count >= 2) print
    }
  ' "$BACKLOG_FILE"
}

# Met à jour un champ simple dans le bloc d'une US
update_field() {
  local id="$1" field="$2" value="$3"
  local tmp=$(mktemp)
  awk -v id="$id" -v field="$field" -v value="$value" '
    /<!--US:START id="/ { in_block = ($0 ~ ("id=\"" id "\"")) }
    /<!--US:END-->/ { in_block = 0 }
    in_block && $0 ~ "^" field ": " {
      print field ": \"" value "\""
      next
    }
    { print }
  ' "$BACKLOG_FILE" > "$tmp" && mv "$tmp" "$BACKLOG_FILE"
}

# Met à jour updated_at à aujourd'hui
touch_us() {
  local id="$1"
  local today=$(date +%Y-%m-%d)
  update_field "$id" "updated_at" "$today"
}

# ─── AFFICHAGES ───────────────────────────────────────────────────────────────

print_header() {
  clear || true
  echo -e "${BOLD}${CYAN}"
  echo "  ╔═══════════════════════════════════════════════╗"
  echo "  ║        AMIPEQ — Backlog Manager v1.0          ║"
  echo "  ╚═══════════════════════════════════════════════╝"
  echo -e "${RESET}"
}

print_us_line() {
  local id="$1"
  local title=$(get_field "$id" "title")
  local status=$(get_field "$id" "status")
  local priority=$(get_field "$id" "priority")
  local mode=$(get_field "$id" "mode")
  local depends=""
  local dep_ids=$(get_list_field "$id" "depends_on")
  [[ -n "$dep_ids" ]] && depends=" ${DIM}← $(echo "$dep_ids" | tr '\n' ',' | sed 's/,$//')${RESET}"

  printf "  ${BOLD}%-8s${RESET} $(status_color "$status") $(priority_badge "$priority") ${DIM}[%s]${RESET} %s%s\n" \
    "$id" "$mode" "$title" "$depends"
}

# ─── ARBORESCENCE ─────────────────────────────────────────────────────────────

print_tree() {
  echo -e "\n  ${BOLD}Arborescence des dépendances${RESET}\n"
  local all_ids=$(get_all_ids)
  
  # Trouver les racines (pas de depends_on)
  for id in $all_ids; do
    local deps=$(get_list_field "$id" "depends_on")
    if [[ -z "$deps" ]]; then
      _print_tree_node "$id" "" "" "$all_ids"
    fi
  done
  echo ""
}

_print_tree_node() {
  local id="$1"
  local prefix="$2"
  local is_last="$3"
  local all_ids="$4"

  local title=$(get_field "$id" "title")
  local status=$(get_field "$id" "status")
  local connector="├─"
  [[ "$is_last" == "true" ]] && connector="└─"
  [[ -z "$prefix" ]] && connector=""

  local sc=$(status_color "$status")
  echo -e "  ${prefix}${connector}${BOLD}$id${RESET} $sc ${DIM}$title${RESET}"

  # Enfants : US qui dépendent de cet id
  local children=()
  for child in $all_ids; do
    local cdeps=$(get_list_field "$child" "depends_on")
    if echo "$cdeps" | grep -q "^${id}$"; then
      children+=("$child")
    fi
  done

  local child_prefix="${prefix}"
  [[ -z "$prefix" ]] && child_prefix="  " || {
    [[ "$is_last" == "true" ]] && child_prefix="${prefix}   " || child_prefix="${prefix}│  "
  }

  local total=${#children[@]}
  for i in "${!children[@]}"; do
    local last="false"
    [[ $((i + 1)) -eq $total ]] && last="true"
    _print_tree_node "${children[$i]}" "$child_prefix" "$last" "$all_ids"
  done
}

# ─── LISTER LES US ───────────────────────────────────────────────────────────

list_us() {
  print_header
  echo -e "  ${BOLD}Toutes les User Stories${RESET}\n"
  local all_ids=$(get_all_ids)
  if [[ -z "$all_ids" ]]; then
    echo -e "  ${DIM}Aucune user story trouvée.${RESET}"
  else
    for id in $all_ids; do
      print_us_line "$id"
    done
  fi
  echo ""
}

# ─── VOIR UNE US ─────────────────────────────────────────────────────────────

view_us() {
  local id="$1"
  print_header
  local title=$(get_field "$id" "title")
  local status=$(get_field "$id" "status")
  local mode=$(get_field "$id" "mode")
  local priority=$(get_field "$id" "priority")
  local created=$(get_field "$id" "created_at")
  local updated=$(get_field "$id" "updated_at")

  echo -e "  ${BOLD}${id}${RESET} — ${BOLD}${title}${RESET}\n"
  echo -e "  Statut   : $(status_color "$status")"
  echo -e "  Mode     : ${CYAN}${mode}${RESET}"
  echo -e "  Priorité : $(priority_badge "$priority")"
  echo -e "  Créé     : ${DIM}${created}${RESET}  Modifié : ${DIM}${updated}${RESET}"

  local deps=$(get_list_field "$id" "depends_on")
  [[ -n "$deps" ]] && echo -e "  Dépend de: ${YELLOW}$(echo "$deps" | tr '\n' ' ')${RESET}"

  local blocks=$(get_list_field "$id" "blocks")
  [[ -n "$blocks" ]] && echo -e "  Débloque : ${GREEN}$(echo "$blocks" | tr '\n' ' ')${RESET}"

  local ctx=$(get_list_field "$id" "context_files")
  [[ -n "$ctx" ]] && echo -e "  Contexte : ${DIM}$(echo "$ctx" | tr '\n' ' ')${RESET}"

  echo -e "\n  ${DIM}$(printf '─%.0s' {1..55})${RESET}"
  get_body "$id" | sed 's/^/  /'
  echo ""
}

# ─── CRÉER UNE US ─────────────────────────────────────────────────────────────

create_us() {
  print_header
  echo -e "  ${BOLD}Nouvelle User Story${RESET}\n"

  # Calculer le prochain ID
  local last_id=$(get_all_ids | tail -1)
  local next_num=1
  if [[ -n "$last_id" ]]; then
    next_num=$(echo "$last_id" | grep -Eo '[0-9]+' | awk '{print $1 + 1}')
  fi
  local new_id=$(printf "US-%03d" "$next_num")

  echo -e "  ID attribué : ${BOLD}${new_id}${RESET}\n"

  read -r -p "  Titre : " title
  echo ""
  echo -e "  Priorité : ${RED}high${RESET} / ${YELLOW}medium${RESET} / ${DIM}low${RESET}"
  read -r -p "  Priorité [high] : " priority
  priority="${priority:-high}"

  echo -e "\n  Mode d'exécution : ${CYAN}interactive${RESET} / ${CYAN}headless${RESET}"
  read -r -p "  Mode [interactive] : " mode
  mode="${mode:-interactive}"

  echo -e "\n  Dépend de (IDs séparés par espace, ou vide) :"
  read -r -p "  depends_on : " deps_raw

  echo -e "\n  Débloque (IDs séparés par espace, ou vide) :"
  read -r -p "  blocks : " blocks_raw

  echo -e "\n  Fichiers de contexte (noms séparés par espace) :"
  read -r -p "  [PROMPT_CLAUDE_CODE_AMIPEQ.md] : " ctx_raw
  ctx_raw="${ctx_raw:-PROMPT_CLAUDE_CODE_AMIPEQ.md}"

  # Formatter les listes YAML
  local deps_yaml=""
  if [[ -n "$deps_raw" ]]; then
    for d in $deps_raw; do deps_yaml+="  - \"$d\"\n"; done
  fi

  local blocks_yaml=""
  if [[ -n "$blocks_raw" ]]; then
    for b in $blocks_raw; do blocks_yaml+="  - \"$b\"\n"; done
  fi

  local ctx_yaml=""
  for c in $ctx_raw; do ctx_yaml+="  - \"$c\"\n"; done

  local today=$(date +%Y-%m-%d)

  # Template de la nouvelle US
  local us_block="
<!--US:START id=\"${new_id}\"-->
---
id: \"${new_id}\"
title: \"${title}\"
status: \"Todo\"
mode: \"${mode}\"
priority: \"${priority}\"
created_at: \"${today}\"
updated_at: \"${today}\"
depends_on:
$(echo -e "$deps_yaml")blocks:
$(echo -e "$blocks_yaml")context_files:
$(echo -e "$ctx_yaml")tags: []
---

### En tant que
Développeur AMIPEQ (Bahman)

### Je veux
<!-- Décrire l'action attendue -->

### Afin de
<!-- Décrire l'objectif métier -->

### Acceptance Criteria
- [ ] Critère 1

### Requirements techniques
- Détail technique 1
<!--US:END-->
"

  echo "$us_block" >> "$BACKLOG_FILE"

  echo -e "\n  ${GREEN}✓ User Story ${new_id} créée dans BACKLOG.md${RESET}"
  echo -e "  ${DIM}Ouvre le fichier pour compléter le corps de l'US.${RESET}\n"

  read -r -p "  Ouvrir dans l'éditeur maintenant ? [o/N] : " open_editor
  if [[ "$open_editor" =~ ^[oOyY]$ ]]; then
    "$EDITOR" "$BACKLOG_FILE"
  fi
}

# ─── CHANGER LE STATUT ────────────────────────────────────────────────────────

change_status() {
  local id="$1"
  print_header
  local title=$(get_field "$id" "title")
  local current=$(get_field "$id" "status")

  echo -e "  ${BOLD}${id}${RESET} — ${title}"
  echo -e "  Statut actuel : $(status_color "$current")\n"
  echo "  Choisir le nouveau statut :"
  echo "  1) Todo"
  echo "  2) In Progress"
  echo "  3) Done"
  echo "  4) Failed"
  echo ""
  read -r -p "  Choix [1-4] : " choice

  local new_status
  case "$choice" in
    1) new_status="Todo" ;;
    2) new_status="In Progress" ;;
    3) new_status="Done" ;;
    4) new_status="Failed" ;;
    *) echo -e "  ${RED}Choix invalide${RESET}"; return ;;
  esac

  update_field "$id" "status" "$new_status"
  touch_us "$id"
  echo -e "\n  ${GREEN}✓ Statut mis à jour : $(status_color "$new_status")${RESET}\n"
}

# ─── LANCER CLAUDE CODE ───────────────────────────────────────────────────────

run_claude() {
  local id="$1"
  print_header

  local title=$(get_field "$id" "title")
  local mode=$(get_field "$id" "mode")
  local status=$(get_field "$id" "status")
  local ctx_files=$(get_list_field "$id" "context_files")
  local deps=$(get_list_field "$id" "depends_on")

  echo -e "  ${BOLD}Lancer Claude Code pour ${id}${RESET}"
  echo -e "  ${title}\n"

  # Vérifier dépendances
  if [[ -n "$deps" ]]; then
    local blocked=false
    for dep in $deps; do
      local dep_status=$(get_field "$dep" "status")
      if [[ "$dep_status" != "Done" ]]; then
        echo -e "  ${YELLOW}⚠  Attention : ${dep} n'est pas Done (statut: ${dep_status})${RESET}"
        blocked=true
      fi
    done
    if [[ "$blocked" == "true" ]]; then
      echo ""
      read -r -p "  Continuer quand même ? [o/N] : " force
      [[ ! "$force" =~ ^[oOyY]$ ]] && return
    fi
  fi

  # Construire le prompt pour Claude Code
  local script_dir="$(dirname "$0")"
  local prompt_parts=""

  # Ajouter les fichiers de contexte
  local file_args=""
  for ctx in $ctx_files; do
    local ctx_path="${script_dir}/${ctx}"
    if [[ -f "$ctx_path" ]]; then
      file_args+=" --file \"${ctx_path}\""
      echo -e "  ${DIM}Contexte : ${ctx}${RESET}"
    else
      echo -e "  ${YELLOW}⚠  Fichier contexte introuvable : ${ctx}${RESET}"
    fi
  done

  # Prompt combiné : résumé de l'US + body
  local us_body=$(get_body "$id")
  local full_prompt="# USER STORY ${id} — ${title}

## Mode d'exécution : ${mode}

${us_body}

---
Exécute cette user story. Commence par lire les fichiers de contexte fournis.
Travaille de manière autonome. Crée les fichiers nécessaires dans le répertoire courant.
À la fin, affiche un résumé de ce qui a été accompli."

  # Sauvegarder le prompt dans un fichier temporaire
  local tmp_prompt=$(mktemp /tmp/amipeq-us.XXXXXX)
  echo "$full_prompt" > "$tmp_prompt"

  echo -e "\n  ${BOLD}Mode : ${CYAN}${mode}${RESET}\n"

  # Choix du mode (peut être overridé)
  local run_mode="$mode"
  echo "  Exécuter en :"
  echo "  1) Mode interactif (claude ouvre un REPL)"
  echo "  2) Mode headless   (claude -p, non-interactif)"
  echo "  3) Afficher le prompt uniquement (dry run)"
  echo ""
  read -r -p "  Choix [défaut: ${mode}] : " mode_choice

  case "$mode_choice" in
    1|"interactive") run_mode="interactive" ;;
    2|"headless")    run_mode="headless" ;;
    3)
      echo -e "\n  ${DIM}── Prompt généré ──────────────────────────────${RESET}"
      cat "$tmp_prompt"
      echo -e "  ${DIM}── Fichiers de contexte : ${ctx_files} ──${RESET}"
      rm -f "$tmp_prompt"
      echo ""
      read -r -p "  Appuyer sur Entrée pour continuer..."
      return
      ;;
    "") : ;; # garder le mode par défaut
  esac

  # Mettre à jour le statut
  update_field "$id" "status" "In Progress"
  touch_us "$id"
  echo -e "\n  ${YELLOW}⟳ Statut mis à jour → In Progress${RESET}"

  # Construire la commande
  local base_dir="$(pwd)"
  local claude_cmd=""

  if [[ "$run_mode" == "headless" ]]; then
    echo -e "  ${CYAN}Lancement en mode headless...${RESET}\n"
    # Construire la commande avec fichiers de contexte
    claude_cmd="${CLAUDE_CMD} -p \"$(cat "$tmp_prompt" | sed 's/"/\\"/g')\""
    for ctx in $ctx_files; do
      local ctx_path="${script_dir}/${ctx}"
      [[ -f "$ctx_path" ]] && claude_cmd+=" --file \"${ctx_path}\""
    done
    eval "$claude_cmd"
  else
    echo -e "  ${CYAN}Lancement en mode interactif...${RESET}"
    echo -e "  ${DIM}Le prompt US a été sauvegardé dans : ${tmp_prompt}${RESET}"
    echo -e "  ${DIM}Vous pouvez le coller dans Claude Code avec : /paste ou en argument${RESET}\n"

    # En interactif : ouvrir Claude Code avec le prompt en argument initial
    if [[ -n "$file_args" ]]; then
      eval "${CLAUDE_CMD} ${file_args} \"$(cat "$tmp_prompt" | head -1)\""
    else
      ${CLAUDE_CMD}
    fi
  fi

  rm -f "$tmp_prompt"

  # Demander le résultat
  echo ""
  echo -e "  ${BOLD}L'exécution est terminée. Quel est le résultat ?${RESET}"
  echo "  1) Done    — US complétée avec succès"
  echo "  2) Failed  — Erreur, à relancer"
  echo "  3) Todo    — Laisser en Todo (non commencé)"
  echo "  4) Ne pas changer le statut"
  echo ""
  read -r -p "  Choix [1-4] : " result

  case "$result" in
    1) update_field "$id" "status" "Done"        ; touch_us "$id" ; echo -e "  ${GREEN}✓ Marqué Done${RESET}" ;;
    2) update_field "$id" "status" "Failed"      ; touch_us "$id" ; echo -e "  ${RED}✗ Marqué Failed${RESET}" ;;
    3) update_field "$id" "status" "Todo"        ; touch_us "$id" ;;
    *) echo -e "  ${DIM}Statut inchangé (In Progress)${RESET}" ;;
  esac
  echo ""
}

# ─── SÉLECTEUR D'US ───────────────────────────────────────────────────────────

select_us() {
  local prompt_text="$1"
  local all_ids=$(get_all_ids)
  if [[ -z "$all_ids" ]]; then
    echo -e "  ${RED}Aucune user story dans le backlog.${RESET}" >&2
    return 1
  fi

  echo -e "  ${BOLD}${prompt_text}${RESET}\n" >&2
  local i=1
  local id_array=()
  for id in $all_ids; do
    local title=$(get_field "$id" "title")
    local status=$(get_field "$id" "status")
    printf "  ${BOLD}%2d)${RESET} " "$i" >&2
    print_us_line "$id" >&2
    id_array+=("$id")
    ((i++))
  done
  echo "" >&2
  read -r -p "  Choix [1-$((i-1))] : " sel
  if [[ "$sel" =~ ^[0-9]+$ ]] && [[ "$sel" -ge 1 ]] && [[ "$sel" -lt "$i" ]]; then
    echo "${id_array[$((sel-1))]}"
  else
    echo ""
  fi
}

# ─── MENU PRINCIPAL ───────────────────────────────────────────────────────────

main_menu() {
  while true; do
    print_header

    # Stats rapides
    local all_ids=$(get_all_ids)
    local total=0 done_n=0 progress_n=0 failed_n=0 todo_n=0
    for id in $all_ids; do
      ((total++)) || true
      local s=$(get_field "$id" "status")
      case "$s" in
        "Done")        ((done_n++)) || true ;;
        "In Progress") ((progress_n++)) || true ;;
        "Failed")      ((failed_n++)) || true ;;
        "Todo")        ((todo_n++)) || true ;;
      esac
    done

    echo -e "  ${DIM}Total: ${total} US  |  ${GREEN}✓ ${done_n} Done${RESET} ${DIM}|${RESET} ${YELLOW}⟳ ${progress_n} In Progress${RESET} ${DIM}|${RESET} ${BLUE}○ ${todo_n} Todo${RESET} ${DIM}|${RESET} ${RED}✗ ${failed_n} Failed${RESET}\n"

    echo -e "  ${BOLD}Menu principal${RESET}\n"
    echo "  1)  Lister toutes les User Stories"
    echo "  2)  Voir l'arborescence des dépendances"
    echo "  3)  Voir le détail d'une US"
    echo "  4)  Créer une nouvelle US"
    echo "  5)  Changer le statut d'une US"
    echo "  6)  🚀 Lancer Claude Code sur une US"
    echo "  7)  Ouvrir BACKLOG.md dans l'éditeur"
    echo "  8)  Quitter"
    echo ""
    read -r -p "  Choix [1-8] : " choice
    echo ""

    case "$choice" in
      1)
        list_us
        read -r -p "  Appuyer sur Entrée pour continuer..." dummy
        ;;
      2)
        print_header
        print_tree
        read -r -p "  Appuyer sur Entrée pour continuer..." dummy
        ;;
      3)
        local id=$(select_us "Quelle US afficher ?")
        if [[ -n "$id" ]]; then
          view_us "$id"
          read -r -p "  Appuyer sur Entrée pour continuer..." dummy
        fi
        ;;
      4)
        create_us
        read -r -p "  Appuyer sur Entrée pour continuer..." dummy
        ;;
      5)
        local id=$(select_us "Quelle US modifier ?")
        if [[ -n "$id" ]]; then
          change_status "$id"
          read -r -p "  Appuyer sur Entrée pour continuer..." dummy
        fi
        ;;
      6)
        local id=$(select_us "Quelle US lancer ?")
        if [[ -n "$id" ]]; then
          run_claude "$id"
          read -r -p "  Appuyer sur Entrée pour continuer..." dummy
        fi
        ;;
      7)
        "$EDITOR" "$BACKLOG_FILE"
        ;;
      8)
        echo -e "  ${DIM}Au revoir.${RESET}\n"
        exit 0
        ;;
      *)
        echo -e "  ${RED}Choix invalide${RESET}"
        sleep 1
        ;;
    esac
  done
}

# ─── POINT D'ENTRÉE ───────────────────────────────────────────────────────────

# Vérifications
if [[ ! -f "$BACKLOG_FILE" ]]; then
  echo -e "${RED}Erreur : BACKLOG.md introuvable à : ${BACKLOG_FILE}${RESET}"
  exit 1
fi

if ! command -v "$CLAUDE_CMD" &>/dev/null; then
  echo -e "${YELLOW}⚠  Commande '${CLAUDE_CMD}' introuvable dans le PATH.${RESET}"
  echo -e "${DIM}Le menu fonctionnera mais le lancement d'agents sera désactivé.${RESET}\n"
fi

# Lancement direct par ID (usage non-interactif)
# Usage : ./backlog.sh run US-001
# Usage : ./backlog.sh status US-001 Done
if [[ "${1:-}" == "run" ]] && [[ -n "${2:-}" ]]; then
  run_claude "$2"
  exit 0
elif [[ "${1:-}" == "status" ]] && [[ -n "${2:-}" ]] && [[ -n "${3:-}" ]]; then
  update_field "$2" "status" "$3"
  touch_us "$2"
  echo -e "${GREEN}✓ ${2} → ${3}${RESET}"
  exit 0
elif [[ "${1:-}" == "list" ]]; then
  list_us
  exit 0
elif [[ "${1:-}" == "tree" ]]; then
  print_tree
  exit 0
fi

main_menu
