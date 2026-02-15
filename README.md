# 🔴 Puissance 4 🟡

Jeu de stratégie à 2 joueurs avec scores persistants sur D1.

## 🎮 Jouer

https://connect4-game.clawdgtko-2a7.workers.dev

## ✨ Fonctionnalités

- Jeu stratégique Puissance 4 (Connect 4)
- 2 joueurs en local
- Scores de session
- Sauvegarde des scores en D1 (persistant)
- Leaderboard global
- Animations fluides
- Design responsive

## 🛠️ Tech Stack

- Cloudflare Workers
- D1 Database (SQLite)
- Vanilla JavaScript
- GitHub Actions (CI/CD)

## 🗄️ Database Schema (D1)

```sql
CREATE TABLE connect4_scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    player1_wins INTEGER DEFAULT 0,
    player2_wins INTEGER DEFAULT 0,
    draws INTEGER DEFAULT 0,
    played_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
```

## 🚀 Déploiement

Le déploiement est automatique sur chaque push via GitHub Actions.

## 🔧 Développement local

```bash
npm install -g wrangler
wrangler dev
```
