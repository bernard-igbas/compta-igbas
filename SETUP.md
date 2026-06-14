# Compta IGBas — Synchronisation Cloudflare KV

## Contenu du ZIP
- `index.html` : l'app comptabilite (front), avec ecran de login par code
- `functions/api/data.js` : la fonction Cloudflare Pages qui lit/ecrit dans KV

## Etapes de mise en place (une seule fois)

### 1. Creer le namespace KV
Dans le dashboard Cloudflare :
- Workers & Pages > KV > Create namespace
- Nom : `compta-igbas` (ou autre nom de ton choix)

### 2. Deployer le ZIP
- Va sur le projet Pages existant (compta-igbas.pages.dev)
- Onglet "Deployments" > glisser le nouveau ZIP (ou re-builder depuis le dossier)
- IMPORTANT : deployer en gardant la structure :
  ```
  /index.html
  /functions/api/data.js
  ```

### 3. Lier le namespace KV au projet
- Projet Pages > Settings > Functions > KV namespace bindings
- Add binding :
  - Variable name : `COMPTA_KV`
  - KV namespace  : `compta-igbas`
- Sauvegarder (cela redeploie automatiquement)

### 4. Definir le code partage
- Projet Pages > Settings > Environment variables
- Ajouter pour Production (et Preview si besoin) :
  - Nom : `COMPTA_CODE`
  - Valeur : ton code a 4-6 chiffres (ex: 308217)
- Sauvegarder et redeployer si necessaire

### 5. Premier acces
- Ouvre compta-igbas.pages.dev (ou ml-igbas.pages.dev > Comptabilite)
- Un ecran demande le code -> entrer le code choisi
- A la premiere connexion, si KV est vide, l'app pousse automatiquement
  les donnees actuellement en localStorage vers KV (donnees "seed")

### 6. Importer les 41 operations a jour (si besoin)
Si l'appareil qui se connecte en premier n'a pas les bonnes donnees :
- Sur l'appareil/navigateur ayant les donnees a jour (solde -44.93 EUR) :
  Parametres > Donnees > Exporter JSON
- Une fois connecte avec le code sur cet appareil, les donnees sont
  automatiquement poussees vers KV au bout de ~1-2 secondes
- Les autres appareils recevront ces donnees a leur prochaine ouverture

## Fonctionnement

- Chaque modification (saisie, suppression, edition...) declenche `save()`
  -> ecriture locale immediate (localStorage, cache hors-ligne)
  -> puis envoi vers `/api/data` (KV) apres 1.2s de debounce
- Au chargement de la page, l'app recupere les donnees depuis KV en priorite
- Indicateur en haut de la barre laterale :
  - "Synchronise a HH:MM" = tout est a jour cote serveur
  - "Synchronisation..." = envoi en cours
  - "Mode local (hors-ligne)" = pas connecte / pas de reseau, donnees gardees localement
- Cliquer sur l'indicateur permet de changer de code (deconnexion)

## Limites connues
- Le code est un secret partage simple (pas de compte individuel).
  Toute personne qui le connait peut lire/modifier les donnees.
- En cas de modification simultanee sur deux appareils dans la meme
  fenetre de 1-2 secondes, la derniere sauvegarde "gagne" (pas de fusion
  intelligente). Dans l'usage normal (un appareil a la fois), ce n'est
  pas un probleme.
