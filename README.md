<h1 align="center">🖥️ iframe-edge</h1>

<p align="center">
  <b>All-in-one HTML/CSS/JS widgets in a single file for Productivity, Streaming, DevOps, and more.</b></br>
  <i>Specially designed to be 100% responsive for Corsair Xeneon Edge & iCUE.</i>
</p>

---

## ✨ Features

- **No external dependencies:** Pure HTML, CSS, and vanilla JavaScript bundled in single files.
- **Fully Responsive:** Automatically scales to fit any container size (`M`, `L`, `XL`).
- **Plug & Play:** Just copy the code and paste it.
- **Dark OLED / Light Mode** with a toggle on each widget.
- **EN / FR** bilingual support on all widgets.

---

## 🗂️ Available Widgets

| Widget | GitHub Pages URL |
|---|---|
| 💧 Hydration | `https://stealthylabshq.github.io/iframe-edge/productivity/hydration/` |
| 🍅 Pomodoro | `https://stealthylabshq.github.io/iframe-edge/productivity/pomodoro/` |
| 📝 Quick Notes | `https://stealthylabshq.github.io/iframe-edge/productivity/notes/` |
| 🎯 Daily Focus | `https://stealthylabshq.github.io/iframe-edge/productivity/daily-focus/` |
| ✅ Habit Tracker | `https://stealthylabshq.github.io/iframe-edge/productivity/habit-tracker/` |
| 🧘 Posture & Blink | `https://stealthylabshq.github.io/iframe-edge/productivity/posture-reminder/` |
| 📋 Quick Clipboard | `https://stealthylabshq.github.io/iframe-edge/productivity/quick-clipboard/` |
| 🎵 Spotify Visualizer | `https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/` |


---

## 🇬🇧 English Documentation

### 📋 Prerequisites

To use these widgets on your Corsair setup, you will need:

- A **Corsair Xeneon Edge** display.
- The **[Corsair iCUE](https://www.corsair.com/icue)** software installed and up to date.

### 🚀 iFrame

1. Open **iCUE** and go to your screen/dashboard configuration.
2. In the **Widgets** list (left column), click on the **`</> iFrame`** icon.
3. Choose your desired size: **`M`**, **`L`**, or **`XL`**.
4. In the iFrame settings, look for the **HTML code** text area.
5. Choose a URL from the table above and wrap it in an `<iframe>` tag like this, then **paste it** into the text area:
   ```html
   <iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>
   ```

> **🎉 Done!** The widget will load live from GitHub Pages.

---

## 🇫🇷 Documentation en Français

### 📋 Prérequis

Pour utiliser ces widgets sur votre installation Corsair, vous aurez besoin de :

- Un écran **Corsair Xeneon Edge**.
- Le logiciel **[Corsair iCUE](https://www.corsair.com/icue)** installé et à jour sur votre machine.

### 🚀 iFrame Direct

1. Ouvrez **iCUE** et allez dans la configuration de votre écran.
2. Dans la liste des **Widgets** (colonne gauche), cliquez sur l'icône **`</> iFrame`**.
3. Choisissez la taille souhaitée : **`M`**, **`L`**, ou **`XL`**.
4. Dans les réglages de l'iFrame, cherchez le champ de texte principal **code HTML**.
5. Prenez l'URL de votre choix dans le tableau ci-dessus et insérez-la dans une balise `<iframe>` comme ceci, puis **collez** le tout dans la zone HTML de iCUE :
   ```html
   <iframe src="https://stealthylabshq.github.io/iframe-edge/productivity/hydration/"></iframe>
   ```

> **🎉 Et voilà !** Le widget se chargera directement depuis GitHub Pages.

---

## 🎵 Spotify Visualizer — Setup Guide

> ⚠️ **Internet connection required.** The widget communicates with the Spotify API and the LRCLIB lyrics service.
>
> 🔒 **Privacy first.** Your Client ID and Refresh Token are stored only in your browser's `localStorage`. Nothing is sent to any third-party server.

### 🇬🇧 English

#### Step 1 — Create a Spotify App

1. Go to the [Spotify Developer Dashboard](https://developer.spotify.com/dashboard) and log in.
2. Click **Create App**.
3. Fill in any **App name** and **App description** (e.g. "iCUE Widget").
4. In the **Redirect URIs** field, add exactly:
   ```
   https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/auth/callback.html
   ```
5. Under **Which API/SDKs are you planning to use?**, select **Web API**.
6. Click **Save**.
7. Click **Settings** on your new app page and copy your **Client ID**.

#### Step 2 — Configure the Widget

1. Open iCUE → add the **Spotify Visualizer** widget (URL or copy-paste method).
2. Click **⚙️** (settings icon) in the top-right corner of the widget.
3. Paste your **Client ID** into the *Spotify Client ID* field.
4. Click **🔑 Authorize & get Refresh Token** — a browser tab will open.
5. Log in to Spotify and grant the requested permissions.
6. The callback page will display your **Refresh Token** — click **Copy**.
7. Go back to the widget settings, paste the token into *Refresh Token*, and click **Save**.

> 🎉 The widget will immediately start showing the currently playing track!

---

### 🇫🇷 Français

#### Étape 1 — Créer une application Spotify

1. Rendez-vous sur le [Tableau de bord Spotify Developer](https://developer.spotify.com/dashboard) et connectez-vous.
2. Cliquez sur **Create App**.
3. Remplissez un **nom d'application** et une **description** quelconques (ex. : "iCUE Widget").
4. Dans le champ **Redirect URIs**, ajoutez exactement :
   ```
   https://stealthylabshq.github.io/iframe-edge/productivity/spotify-visualizer/auth/callback.html
   ```
5. Sous **Which API/SDKs are you planning to use?**, cochez **Web API**.
6. Cliquez sur **Save**.
7. Sur la page de votre application, cliquez sur **Settings** et copiez votre **Client ID**.

#### Étape 2 — Configurer le widget

1. Ouvrez iCUE → ajoutez le widget **Spotify Visualizer** (par URL ou copier-coller).
2. Cliquez sur **⚙️** (icône paramètres) en haut à droite du widget.
3. Collez votre **Client ID** dans le champ *Spotify Client ID*.
4. Cliquez sur **🔑 Autoriser & obtenir le Refresh Token** — un onglet s'ouvre.
5. Connectez-vous à Spotify et accordez les permissions demandées.
6. La page callback affiche votre **Refresh Token** — cliquez sur **Copier**.
7. Retournez dans les paramètres du widget, collez le token dans *Refresh Token* puis cliquez sur **Enregistrer**.

> 🎉 Le widget affiche immédiatement la musique en cours de lecture !

---
