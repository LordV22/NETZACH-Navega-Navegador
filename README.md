# 🛡️ NETZACH Navega

> **Navegador PWA de segurança elevada** — cookie de sessão criptografado com cifra autenticada de nível militar e ofuscação multi-camada, com autenticação obrigatória via conta Google.

NETZACH Navega é um navegador Progressive Web App (PWA) construído com foco total em **privacidade e segurança**. Diferente de navegadores convencionais, ele não apenas ofusca dados: ele aplica **criptografia real e verificada** sobre cada cookie de sessão antes de qualquer persistência local, e exige **login com conta Google** como porta de entrada.

---

## ✨ Funcionalidades

### 🛡️ Criptografia de verdade (não é só encoding)
- **Cifra autenticada AES-256-GCM** via WebCrypto (nativo, roda no hardware do dispositivo);
- **Tag de autenticação de 128 bits** — qualquer adulteração do dado, IV, salt ou contexto é detectada e rejeitada na decifragem;
- **Derivação de chave robusta**: `PBKDF2 (150.000 iterações / SHA-256) → HKDF (SHA-256)`;
- **IV criptograficamente aleatório** e único por operação;
- **Dados autenticados adicionais (AAD)** vinculados ao domínio e ao nome do cookie.

### 🌀 Ofuscação multi-camada (camuflagem sobre o ciphertext)
Após a cifragem, o `ciphertext` ainda passa por **5 camadas de ofuscação** para dificultar análise estática:
`XOR → reverse → byte-shift → base64 → reverse²`, com **guardas de integridade** (hash) intercaladas.

### 🔐 Autenticação com Google (obrigatória)
- Login via **Google Identity Services (GIS)** com botão *"Entrar com Google"*;
- **Validação do ID Token (JWT)** no cliente (expiração, audiência);
- Sessão persistida **criptografada** no aparelho;
- Navegador fica **bloqueado** até o login ser concluído.

### 📱 Interface e experiência
- Visual **futurista**: glassmorphism, acentos neon, fundo animado;
- **Instalável como app nativo** (PWA) e **offline-first** via Service Worker;
- **Modo Incógnito** — nada é persistido;
- **Cofre de cookies** com visualização do blob ofuscado e das camadas aplicadas;
- **Log de segurança** em tempo real;
- **Score de privacidade** dinâmico;
- Interface em **🇧🇷 Português / 🇺🇸 English / 🇪🇸 Español**.

---

## 🧱 Arquitetura

```
netzach-pwa/
├── index.html            # UI futurista (glassmorphism + neon)
├── manifest.json         # PWA instalável / offline
├── sw.js                 # Service Worker (cache offline-first)
├── server.js             # Servidor estático Node (Railway / PORT env)
├── package.json          # Script "start" → node server.js
└── js/
    ├── app.js            # Lógica do navegador + integração com auth
    ├── auth.js           # Google Sign-In + validação JWT + sessão
    ├── config.js         # ⚙️ Configuração (GOOGLE_CLIENT_ID)
    ├── crypto-worker.js  # AES-256-GCM autenticado + ofuscação multi-camada
    ├── vault.js          # Cofre IndexedDB (armazena apenas o blob ofuscado)
    └── i18n.js           # Internacionalização (pt / en / es)
```

---

## ⚙️ Configuração — Login com Google

O login com Gmail exige um **Client ID OAuth** (gratuito). O navegador fica bloqueado até você configurar.

1. Acesse o [Google Cloud Console](https://console.cloud.google.com);
2. Crie um projeto → **APIs & Services** → **Credentials** → **Create Credentials** → **OAuth Client ID**;
3. Tipo: **Web application**;
4. Em **Authorized JavaScript origins**, adicione cada origem onde o app rodará:
   - `https://SEU-APP.up.railway.app` (produção)
   - `http://localhost:3000` (desenvolvimento local)
5. Copie o **Client ID** e cole em `js/config.js`:

```js
export const GOOGLE_CLIENT_ID = "SEU_CLIENT_ID_AQUI";
```

> ⚠️ Cada origem diferente deve estar autorizada no Google Cloud, caso contrário o botão de login não renderiza.

---

## 🚀 Deploy na Railway

1. Publique (ou faça *fork*) deste repositório no GitHub;
2. No **Railway**: *New Project → Deploy from GitHub repo*;
3. A Railway detecta o **Node.js** automaticamente pelo `package.json` (script `start`);
4. Defina a variável de ambiente se necessário (`PORT` é usada automaticamente);
5. Configure o `GOOGLE_CLIENT_ID` com a origem HTTPS gerada pela Railway;
6. Abra a URL no celular → **Adicionar à tela inicial** para instalar como app.

---

## 🛡️ Notas de segurança

- O **valor original do cookie nunca é gravado em disco** — apenas o `ciphertext` ofuscado, reconstituído em memória mediante decifragem **verificada** (AES-GCM rejeita dados adulterados);
- O login com Google é **obrigatório**; sem autenticação, o navegador não é liberado;
- A chave é derivada por sessão (salt exclusivo), dificultando ataques offline ao cofre;
- Headers de segurança são enviados pelo servidor e o app usa `Referrer-Policy: no-referrer`.

---

## 📄 Licença

Este projeto é distribuído sob a licença **MIT**.

---

Feito com rigor par quem leva segurança a sério. 🛡️
