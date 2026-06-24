# MarchésPublics AI

Outil de recherche intelligente dans les marchés publics français et européens.

## Sources couvertes
- **BOAMP** — Bulletin Officiel des Annonces de Marchés Publics (France)
- **PLACE** — Plateforme des Achats de l'État (France)
- **TED Europa** — Tenders Electronic Daily (UE)
- **Maximilien** — Plateforme Île-de-France
- **AchatPublic.com** — Agrégateur français
- **Mégalis Bretagne** — Plateforme régionale

## Providers IA supportés
| Provider | Endpoint par défaut |
|---|---|
| **persoIA** ✨ (connexion simple) | chat.persoia.com/v1 |
| **Claude (Anthropic)** | api.anthropic.com |
| **OpenAI** (GPT-4o, etc.) | api.openai.com |
| **Mistral AI** | api.mistral.ai |
| **Ollama** (local) | localhost:11434 |
| **Custom** | Votre endpoint OpenAI-compatible |

### persoIA — connexion partagée
Sélectionnez **persoIA** puis cliquez sur « Se connecter » : vous vous identifiez
**une seule fois** dans le navigateur (aucune clé à copier-coller). La clé est
stockée dans un emplacement commun à tous vos outils persoIA
(`%APPDATA%\persoia\config.env`) et relue automatiquement. Authentification portée
depuis [persoia-auth](https://github.com/FishMoiLaPaix/persoia-auth).

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
1. Sélectionner le provider (Claude, OpenAI, Mistral, Ollama, Custom)
2. Entrer la clé API
3. Cliquer "Tester la connexion" pour vérifier
4. La config est sauvegardée localement

## Utilisation
1. Saisir votre recherche (ex: "développement d'une application mobile", "travaux de rénovation")
2. Sélectionner les sources à explorer
3. Activer/désactiver l'analyse IA
4. Cliquer Rechercher
5. Les résultats sont classés par pertinence avec score et explication IA
