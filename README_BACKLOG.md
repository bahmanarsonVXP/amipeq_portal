# AMIPEQ — Système de Backlog + Lanceur Claude Code

## Installation

```bash
# 1. Copier les fichiers dans ton répertoire de projet
cp backlog.sh BACKLOG.md /chemin/vers/projet-amipeq/

# 2. Rendre le script exécutable
chmod +x backlog.sh

# 3. Placer PROMPT_CLAUDE_CODE_AMIPEQ.md dans le même répertoire
# (le script le cherche là par défaut comme contexte)

# 4. Lancer le menu
./backlog.sh
```

---

## Usage

### Menu interactif
```bash
./backlog.sh
```

### Commandes directes (sans menu)
```bash
# Lancer Claude Code sur une US directement
./backlog.sh run US-001

# Changer le statut d'une US
./backlog.sh status US-001 Done
./backlog.sh status US-003 "In Progress"

# Lister toutes les US (affichage texte)
./backlog.sh list

# Afficher l'arborescence des dépendances
./backlog.sh tree
```

---

## Format BACKLOG.md

Chaque US est un bloc délimité par des commentaires HTML :

```markdown
<!--US:START id="US-001"-->
---
id: "US-001"
title: "Titre de la US"
status: "Todo"              # Todo | In Progress | Done | Failed
mode: "headless"            # interactive | headless
priority: "high"            # high | medium | low
created_at: "2026-04-11"
updated_at: "2026-04-11"
depends_on:                 # US qui doivent être Done avant celle-ci
  - "US-002"
blocks:                     # US débloquées par celle-ci
  - "US-003"
context_files:              # Fichiers injectés comme contexte Claude Code
  - "PROMPT_CLAUDE_CODE_AMIPEQ.md"
tags: ["schema", "twenty"]
---

### En tant que
...

### Je veux
...

### Afin de
...

### Acceptance Criteria
- [ ] Critère 1

### Requirements techniques
- Détail 1
<!--US:END-->
```

---

## Arborescence des dépendances AMIPEQ

```
US-001 (Schéma Company)
└── US-002 (Schéma Opportunity)
    └── US-003 (Import Companies)
        └── US-004 (Import Persons)
            └── US-005 (Import Opportunities)
                └── US-006 (Import Notes)
```

---

## Comment Claude Code reçoit le contexte

Quand tu lances une US depuis le menu (option 6) :

1. Le script lit les `context_files` dans le frontmatter de l'US
2. Il construit un prompt complet : **résumé US + body markdown**
3. Il passe le tout à `claude` :
   - **Mode headless** : `claude -p "<prompt>" --file PROMPT_CLAUDE_CODE_AMIPEQ.md`
   - **Mode interactif** : `claude` s'ouvre, le prompt est préparé dans un fichier tmp

> **Tip** : en mode interactif, Claude Code s'ouvre normalement. Le prompt généré
> est affiché dans le terminal — tu peux le copier-coller ou démarrer par `/init`.

---

## Modifier une US

Soit via le menu (option 7 → éditeur), soit directement dans BACKLOG.md.
Le format est du YAML standard — respecter l'indentation à 2 espaces pour les listes.

## Ajouter une nouvelle US

Via le menu option 4 — le script attribue automatiquement le prochain ID
et crée le bloc dans BACKLOG.md. Tu peux ensuite compléter le body dans l'éditeur.
