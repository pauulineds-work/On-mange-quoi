# OnMangeQuoi? — notice du projet

Ce fichier est la notice de Claude pour ce projet. À relire avant chaque tâche.

## Le projet

Un site Internet pour ranger et organiser toutes mes idées de recettes de cuisine.

## À quoi il sert

- **Usage personnel** : garder toutes mes idées de recettes au même endroit, bien rangées.
- **Usage professionnel** : préparer les recettes que je compte filmer et publier sur un
  compte TikTok dédié à la cuisine.

## Qui l'utilise

Moi uniquement. Le site est **privé** et doit le rester :

- pas de référencement sur les moteurs de recherche ;
- pas de fonctions de partage public, de comptes visiteurs ni de commentaires ;
- ne jamais rendre le site ou son contenu public sans que je le demande explicitement.

## Appareils

Le site doit fonctionner parfaitement sur :

- **iPad** (appareil principal, en portrait et en paysage) ;
- **iPhone**.

Concrètement : affichage adapté au tactile, boutons faciles à toucher au doigt, texte
lisible sans zoomer, aucun défilement horizontal, test dans Safari. L'ordinateur n'est
pas la priorité.

## Style visuel

- **Coloré, esprit pop art** (Andy Warhol) : couleurs franches sur un fond clair.
- **Une couleur par catégorie** (terracotta, havane, bleu azur, rose, jaune…), définie
  dans `app.js` (`CATEGORY_COLORS`).
- **Titre « OnMangeQuoi? » en décalé**, comme une balle qui rebondit sur les mots :
  « On » et « Quoi » plus haut que « Mange », « ? » légèrement décalé.
- **Petit jeu dans le titre** : le « O » de « On » est un cookie avec un croc (une
  bouchée en moins). Pas de pâte papillon.
- **Sous-titre** « Mon carnet de recettes! » en cursive (police Dancing Script, rangée
  dans `fonts/`), le point du « ! » est un petit cœur.
- **Menu « trois traits »** en haut à gauche : il ouvre un panneau qui regroupe les
  parties du site (toutes les recettes, nouvelle recette, catégories, étiquettes,
  mon profil, déconnexion). Pas de bouton « + » en haut de la liste : on ajoute une
  recette par le menu. Chaque titre du menu (Mon carnet, Catégories, Étiquettes) est fermé au
  départ et s'ouvre d'un toucher pour montrer sa liste. Les filtres ne sont plus
  affichés au-dessus de la liste.
- **Personnage du site** (`logo.svg`) : une cuisinière aux longs cheveux bruns et au
  teint hâlé, avec une toque, une fourchette et un couteau. Pas de marmite.
- **Côté professionnel** (sans toucher aux couleurs flash, que j'aime) : cartes de
  recettes avec une ombre légère, sans bordure ; titres des recettes dans une police
  moderne (sans empattements). Le titre du site garde sa police d'origine.
- **Fiche recette** : une grande bannière en haut, avec la photo de la recette derrière
  le titre (ou la couleur de la catégorie tant qu'il n'y a pas de photo). Un bouton
  « Ajouter une photo » / « Changer la photo » sur la bannière permet de choisir une
  photo de l'appareil. Ingrédients et Préparation (les étapes) côte à côte en deux
  colonnes sur iPad, l'une sous l'autre sur iPhone.
- **Ingrédients et étapes** : les ingrédients sont rangés en **groupes que je crée moi-même**
  (Viande, Purée, Sauce…), avec un bouton « + Ajouter un groupe ». Les étapes ont **une case
  chacune** (on peut aller à la ligne dedans) et peuvent être rangées en **parties** (Les
  nouilles, La sauce…) dont le titre n'est pas numéroté ; la numérotation repart à 1 dans
  chaque partie. Gardé sous forme de petit texte structuré (`{"v":2,…}`) dans les mêmes
  colonnes `ingredients` et `steps` ; les anciennes recettes (une ligne = un élément)
  restent lisibles.
- **Étapes sur la fiche** : un trait fin sépare chaque étape ; dans une étape, une ligne qui
  finit par « : » (ex. « Pour le poulet : ») s'affiche en gras.
- **Confirmations** : jamais la fenêtre du navigateur ; une jolie fenêtre aux couleurs du
  site (icône poubelle, boutons « Annuler » et « Retirer » / « Supprimer »), fonction
  `askConfirm` dans `app.js`.
- **Boutons** : ils ont un petit relief et **s'enfoncent au toucher**. Un toucher sur le
  logo ou le titre ramène toujours à la liste de toutes les recettes (filtres effacés).
- **Écran de connexion** : titre « De retour en cuisine! », fond beige `#DAD0C3` avec
  des rangées de toques et de couverts de couleur `#CBBD93` (`fond-couverts.svg`), et une
  bande blanche sur toute la largeur derrière le logo et le titre. Une fois connectée, le
  fond clair habituel revient.
- **Page « Mon profil »** (menu) : photo, prénom, âge, nom d'utilisateur (un simple nom
  affiché, la connexion se fait par e-mail) et changement du mot de passe depuis le site.
  Le profil est gardé dans le compte Supabase. Le changement d'adresse e-mail viendra
  plus tard (il demande de recevoir un e-mail de confirmation).
- **Police lisible** : confortable à lire, y compris de loin quand je cuisine.
- Mise en page simple et aérée : la couleur ne doit pas gêner la lecture.

## Façon de travailler avec moi

- Me parler en **français**, avec des mots simples et sans jargon technique.
- Tout le texte du site est en français.
- Pour me poser une question, **toujours utiliser l'outil AskUserQuestion** (questions
  avec des choix à toucher), jamais une question simplement écrite dans le texte.
- Avant un choix important (organisation du site, nouvelle fonctionnalité, changement de
  style), me proposer l'idée et attendre mon accord.
- Après chaque modification, m'expliquer simplement ce qui a changé.
- Garder le projet simple : ne pas ajouter de fonctions que je n'ai pas demandées.

## Décisions prises

- **Nom du site** : « OnMangeQuoi? ».
- **Fiche recette** : titre, ingrédients, étapes, temps (préparation et cuisson) et
  portions, photo, notes perso, infos TikTok (idées de tournage et lien vers la vidéo
  une fois publiée).
- **Classement** : par catégorie (entrée, plat, dessert…) et par étiquettes libres
  (mots-clés que je choisis). Pas de favoris ni de statut TikTok pour l'instant.

- **Enregistrement** : compte privé en ligne (Supabase), avec connexion par e-mail et
  mot de passe, pour retrouver les mêmes recettes et photos sur l'iPad et l'iPhone.
  Tant que le compte n'est pas branché, le site tourne en « mode essai » (recettes
  gardées dans l'appareil seulement).
- **Adresse du site** : GitHub Pages, qui met en ligne ce qui se trouve dans la version
  principale (`main`) du dépôt public `On-mange-quoi` :
  https://pauulineds-work.github.io/On-mange-quoi/. Le code du site est donc public ; les
  recettes, elles, restent protégées par le mot de passe. L'ancien dépôt
  `Carnet-de-recettes` est privé et n'est plus utilisé (il garde l'e-mail perso dans son
  historique : ne jamais le rendre public).
- **Compte en ligne** : branché (Supabase), inscriptions fermées, un seul utilisateur.
  Après `supabase/schema.sql`, le site ne lit les recettes que si les droits `grant` du
  fichier ont été donnés.

## Comment le site est fait

- Site simple en HTML, CSS et JavaScript, sans étape de fabrication : `index.html`,
  `style.css`, `app.js`.
- `config.js` : adresse et clé publique du compte Supabase (vides = mode essai). Ne
  jamais y mettre de mot de passe ni de clé secrète.
- `supabase/schema.sql` : à lancer une fois dans Supabase pour créer le rangement des
  recettes et des photos, réservé à la propriétaire du compte.
- Pour tester : ouvrir le dossier avec un petit serveur local (`python3 -m http.server`)
  et vérifier en taille iPad et iPhone.

## Encore à décider ensemble

- Rien pour l'instant.

Mettre ce fichier à jour dès qu'une décision est prise.
