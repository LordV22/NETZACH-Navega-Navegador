# 🛡️ NETZACH Navega

Navegador PWA focado em **privacidade e segurança de verdade**. Cookies de sessão criptografados com **AES-256-GCM autenticado** + **ofuscação multi-camada**, e **login obrigatório com conta Google**.

> Em cibersegurança não se brinca com criptografia. Este projeto usa cifra autenticada real (WebCrypto), não apenas encoding.

---

## ✨ Destaques

- 🔐 **Criptografia real — AES-256-GCM** (WebCrypto nativo, roda no aparelho)
  - Tag de autenticação de 128 bits → detecta **qualquer adulteração**
  - Derivação de chave via **PBKDF2 (150.000 iterações) → HKDF (SHA-256)**
  - IV criptograficamente aleatório por operação
  - Dados autenticados extras (AAD) por domínio/nome
- 🌀 **Ofuscação multi-camada** sobre o ciphertext (XOR → reverse → byte-shift → base64 → reverse2 + guardas de integridade)
- 🔁 **Rotação de chave por sessão** com salt único
- 🔒 **Login obrigatório com Google** (Google Identity Services) — só entra autenticado
- 👁️ Modo Incógnito (não persiste nada)
- 📜 Log de segurança em tempo real
- 📊 Score de privacidade dinâmico
- 🌐 Interface em 🇧🇷 🇺🇸 🇪🇸
- 📱 Instalável como aplicativo nativo (PWA) / offline

---

## ⚙️ Configuração obrigatória (Login com Google)

Para o login com Gmail funcionar, você precisa de um **Client ID OAuth** do Google:

1. Acesse [console.cloud.google.com](https://console.cloud.google.com)
2. Crie um projeto → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth Client ID**
3. Tipo: **Web application**
4. Em **Authorized JavaScript origins**, adicione sua origem:
   - `https://SEU-APP.up.railway.app` (produção)
   - `http://localhost:3000` (teste local)
5. Copie o **Client ID** e cole em `js/config.js`:

```js
export const GOOGLE_CLIENT_ID = "SEU_CLIENT_ID_AQUI";
```

> ⚠️ Cada origem onde o app rodar deve estar autorizada no Google Cloud, senão o botão "Entrar com Google" não renderiza.

---

## 🚀 Deploy na Railway

1. Suba este repositório (ou fork) no GitHub
2. No Railway: **New Project → Deploy from GitHub repo**
3. A Railway detecta o **Node.js** automaticamente (`package.json` com `start`)
4. Configure o `GOOGLE_CLIENT_ID` (veja acima) na origem HTTPS gerada
5. Abra a URL no celular → **instale como app** (Adicionar à tela inicial)

O servidor (`server.js`) roda na porta via `process.env.PORT`.

---

## 🧱 Estrutura

```
├── index.html            → UI futurista (glassmorphism / neon)
├── manifest.json         → PWA instalável/offline
├── sw.js                 → Service Worker (cache offline-first)
├── server.js             → servidor estático Node (Railway)
├── package.json
└── js/
    ├── app.js            → lógica do navegador + auth
    ├── auth.js           → Google Sign-In + verificação JWT
    ├── config.js         → ⚙️ GOOGLE_CLIENT_ID
    ├── crypto-worker.js  → AES-256-GCM autenticado + ofuscação multi-camada
    ├── vault.js          → cofre IndexedDB (armazena só o blob ofuscado)
    └── i18n.js           → pt / en / es
```

---

## 🔒 Nota de segurança

- O **valor original do cookie nunca é gravado** em disco: apenas o blob ofuscado do ciphertext AES-GCM, reconstituído em memória mediante decifragem verificada (AES-GCM rejeita dados adulterados).
- O login Google é necessário para usar o navegador; a sessão é criptografada no aparelho.

---

Feito para quem leva segurança a sério. 🛡️
