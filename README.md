# Game Manager

Application web pour gérer une collection de jeux vidéo : consoles, progression, file à jouer priorisée, liste d’achats. Interface responsive (PC et mobile), authentification Supabase, hébergement gratuit sur Vercel.

## Fonctionnalités

- **Collection** : jeux par console, format (physique / dématérialisé), progression (à faire, en cours, terminé, abandonné)
- **À jouer** : file priorisée avec réordonnancement
- **À acheter** : console, format, prix, total estimé
- **Import / Export Excel** : feuilles `Games` et `To Buy` de `Games.xlsx`
- **PWA** : installation sur l’écran d’accueil du téléphone

## Prérequis

1. Compte [Supabase](https://supabase.com) (région EU recommandée)
2. Compte [Vercel](https://vercel.com) pour le déploiement

## Configuration Supabase

1. Créez un projet Supabase.
2. Dans **SQL Editor**, exécutez les migrations dans l’ordre :
   - [`supabase/migrations/001_initial.sql`](supabase/migrations/001_initial.sql)
   - [`supabase/migrations/002_buy_list_priority.sql`](supabase/migrations/002_buy_list_priority.sql) (priorité sur la liste à acheter)
   - [`supabase/migrations/003_game_notes.sql`](supabase/migrations/003_game_notes.sql) (notes par jeu)
   - [`supabase/migrations/004_tags.sql`](supabase/migrations/004_tags.sql) (tags / genres)
3. **Authentication** → activez Email et (optionnel) Google.
4. Pour Google : configurez OAuth dans Supabase et ajoutez l’URL de redirection (`https://votre-app.vercel.app` et `http://localhost:5173`).
5. Récupérez les clés dans **Settings → API Keys** :
   - **Project URL** → `VITE_SUPABASE_URL`
   - **Publishable key** (`sb_publishable_…`) → `VITE_SUPABASE_ANON_KEY`  
     (remplace l’ancienne clé `anon` ; si vous ne voyez que la publishable key, c’est la bonne)

## Développement local

```bash
cp .env.example .env
```

Éditez `.env` :

- `VITE_SUPABASE_URL` → `https://abcdefgh.supabase.co`
- `VITE_SUPABASE_ANON_KEY` → **Publishable key** `sb_publishable_…` (ou ancienne clé `anon` JWT `eyJ…`)

```bash
npm install
npm run dev
```

### Problème de connexion ?

| Symptôme | Solution |
|----------|----------|
| Message sur les valeurs d’exemple | Remplacer `.env` par les clés API Supabase, puis `npm run dev` |
| « Email not confirmed » | Cliquer le lien dans l’email d’inscription, ou désactiver « Confirm email » dans Supabase → Authentication → Providers → Email |
| Identifiants invalides | Créer un compte via « S’inscrire », ou réinitialiser le mot de passe dans Supabase |
| Google ne marche pas | Activer le provider Google + ajouter `http://localhost:5173` dans URL de redirection |

Ouvrez http://localhost:5173, créez un compte, puis importez `Games.xlsx` depuis **Paramètres**.

## Déploiement Vercel

1. Poussez le dépôt sur GitHub.
2. Importez le projet dans Vercel.
3. Variables d’environnement :
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
4. Déployez. Ajoutez l’URL Vercel dans les redirect URLs Supabase (Auth).

## Structure

```
src/
  components/   # Layout, UI
  contexts/     # Auth
  hooks/        # useConsoles
  lib/          # supabase, import-xlsx
  pages/        # Écrans
  types/
supabase/migrations/
```

## Fichier Excel

Le fichier [`Games.xlsx`](Games.xlsx) sert de référence pour la migration initiale. Colonnes mappées :

| Excel | Application |
|-------|-------------|
| TODO / IN_PROGRESS / DONE | todo / in_progress / done |
| Demat | is_digital |
| To Buy | buy_list |
