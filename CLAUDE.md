# Mini Games Platform — CLAUDE.md

## Projet

Plateforme web de mini-jeux indépendants. Chaque jeu est un module autonome accessible depuis une page d'accueil centrale. Les jeux sont ajoutés progressivement au fil des sessions.

## Vision produit

- Page d'accueil listant tous les jeux disponibles avec navigation vers chacun
- Chaque jeu fonctionne de manière totalement indépendante (pas de couplage entre jeux)
- Architecture modulaire : ajouter un jeu ne doit pas toucher aux autres

## Décisions en attente (non tranchées)

- Stack technique (vanilla JS, React/Vite, Vue, autre)
- Architecture exacte des modules (dossiers isolés, monorepo, shared lib)
- Style visuel (rétro/arcade, moderne, cartoon)
- Liste des jeux de la première phase

Ces décisions seront prises et documentées ici au moment où elles seront arrêtées. **Ne pas les anticiper ni les improviser.**

## Principes directeurs

- **Autonomie des jeux** : chaque jeu doit pouvoir être développé, modifié et supprimé sans impacter les autres
- **Modularité** : la page d'accueil doit découvrir les jeux dynamiquement, pas via une liste hard-codée si possible
- **Pas de sur-ingénierie** : commencer simple, complexifier seulement quand le besoin est prouvé

## Processus d'ajout d'un nouveau jeu

À définir une fois le stack décidé. Le processus devra couvrir :
1. Créer le module/dossier du jeu
2. Implémenter le jeu de façon isolée
3. L'enregistrer dans la page d'accueil
4. Documenter le jeu dans ce fichier

## Conventions (à compléter)

À renseigner une fois le stack et l'architecture choisis.

## Sessions passées

| Session | Date | Travail effectué |
|---------|------|-----------------|
| 1 | 2026-06-10 | Setup initial du projet, rédaction CLAUDE.md |
