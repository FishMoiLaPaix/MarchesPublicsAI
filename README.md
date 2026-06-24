# MarchésPublics AI

Outil de recherche intelligente dans les marchés publics français et européens.

## Sources couvertes
- **BOAMP** — Bulletin Officiel des Annonces de Marchés Publics (France)
- **PLACE** — Plateforme des Achats de l'État (France)
- **TED Europa** — Tenders Electronic Daily (UE)
- **Maximilien** — Plateforme Île-de-France
- **AchatPublic.com** — Agrégateur français
- **Mégalis Bretagne** — Plateforme régionale

## Intelligence Artificielle — persoIA
L'application utilise **persoIA** comme unique fournisseur d'IA
(`chat.persoia.com/v1`). Aucune clé à copier-coller : vous vous identifiez **une
seule fois** dans le navigateur. La clé est stockée dans un emplacement commun à
tous vos outils persoIA (`%APPDATA%\persoia\config.env`) et relue automatiquement.

Au **premier lancement**, si aucune configuration persoIA n'existe encore,
l'application ouvre directement le login navigateur pour la créer. Vous pouvez
ensuite vous reconnecter / déconnecter depuis le panneau latéral. Authentification
portée depuis [persoia-auth](https://github.com/FishMoiLaPaix/persoia-auth).

## Installation Windows

### Prérequis
- Node.js 18+ : https://nodejs.org

### Première utilisation
1. Extraire le ZIP dans un dossier
2. Double-clic sur `INSTALLER.ps1` (clic droit → Exécuter avec PowerShell)
3. Un raccourci est créé sur le Bureau pour les lancements suivants

### Lancement rapide (si déjà installé)
```powershell
cd C:\Users\<vous>\AppData\Local\MarchesPublicsAI
npx electron .
```

## Configuration IA
1. Au premier lancement, identifiez-vous dans le navigateur (login persoIA) — la
   configuration est créée automatiquement
2. Cliquer "Tester la connexion" pour vérifier
3. La connexion est partagée avec vos autres outils persoIA

## Utilisation
1. Saisir votre recherche (ex: "développement d'une application mobile", "travaux de rénovation")
2. Sélectionner les sources à explorer
3. Activer/désactiver l'analyse IA
4. Cliquer Rechercher
5. Les résultats sont classés par pertinence avec score et explication IA
