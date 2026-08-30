# 🛡️ NETZACH Navega

> **Navegador PWA de segurança elevada** — cookies de sessão criptografados com cifra autenticada de nível militar + ofuscação multi-camada. Sem contas, sem rastreio, sem servidor próprio: foco total em **privacidade e segurança**.

NETZACH Navega é um navegador **Progressive Web App (PWA)** construído do zero para **privacidade total e segurança de verdade**. Ele não apenas ofusca dados: aplica **criptografia real e verificada (AES-256-GCM)** sobre cada cookie de sessão antes de qualquer persistência local.

---

## ✨ Destaques

### 🏗️ Navegador puro, sem contas
- **Sem login, sem conta Google, sem cadastro** — abre e usa direto;
- Nenhuma telemetria, nenhum rastreio, nenhuma chamada a terceiros para funcionar.

### 🔐 Criptografia de verdade (não é só encoding)
- **Cifra autenticada AES-256-GCM** (WebCrypto nativo, roda no hardware do aparelho);
- **Tag de autenticação de 128 bits** — qualquer adulteração do dado, IV, salt ou contexto é detectada e rejeitada na decifragem;
- **Derivação de chave robusta**: `PBKDF2 (150.000 iterações / SHA-256) → HKDF (SHA-256)`;
- **IV criptograficamente aleatório** e único por operação;
- **Dados autenticados adicionais (AAD)** vinculados ao domínio e nome do cookie.

### 🌀 Ofuscação pesada multi-camada
Após a cifragem, o `ciphertext` ainda passa por **5 camadas de ofuscação** para dificultar análise estática:
`XOR → reverse → byte-shift → base64 → reverse²`, com **guardas de integridade** (hash) intercaladas.

### 📱 Interface e experiência
- Visual **futurista**: glassmorphism, acentos neon, fundo animado;
- **Instalável como app nativo (PWA)** e **offline-first** via Service Worker;
- **Modo Incógnito** — nada é persistido;
- **Cofre de cookies** com visualização do blob ofuscado e das camadas aplicadas;
- **Log de segurança** em tempo real;
- **Score de privacidade** dinâmico;
- Interface em **🇧🇷 Português / 🇺🇸 English / 🇪🇸 Español**.

---

## 🧱 Arquitetura

```
netzach-navega/
├── index.html            # UI futurista (glassmorphism + neon)
├── manifest.json         # PWA instalável / offline
├── sw.js                 # Service Worker (cache offline-first)
├── server.js             # Servidor estático Node (Railway / PORT env)
└── js/
    ├── app.js            # Lógica do navegador
    ├── crypto-worker.js  # Web Worker: AES-256-GCM autenticado + ofuscação multi-camada
    ├── vault.js          # Cofre IndexedDB (armazena apenas o blob ofuscado)
    └── i18n.js           # Internacionalização (pt / en / es)
```

> 💡 A criptografia roda em um **Web Worker dedicado** (thread separada), para não travar a interface — e sempre **no aparelho** do usuário.

---

## 🚀 Deploy na Railway

1. Publica ou faz *fork* deste repositório no GitHub;
2. No **Railway**: *New Project → Deploy from GitHub repo*;
3. A Railway detecta o **Node.js** automaticamente (`package.json`, script `start`);
4. A porta é usada via `process.env.PORT` automaticamente;
5. Abra a URL HTTPS gerada no celular → **Adicionar à tela inicial** para instalar como app.

---

## 🛡️ Notas de segurança

- O **valor original do cookie nunca é gravado em disco** — apenas o `ciphertext` ofuscado, reconstituído em memória mediante decifragem **verificada** (AES-GCM rejeita dados adulterados);
- **Sem autenticação obrigatória** — o acesso é livre, mas todo dado sensível do cofre é criptografado localmente;
- A chave é derivada por sessão (salt exclusivo), dificultando ataques offline ao cofre;
- Headers de segurança são enviados pelo servidor e o app usa `Referrer-Policy: no-referrer`.

---

## 📄 Licença

Distribuído sob a licença **MIT**.

---

Feito com rigor para quem leva segurança a sério. 🛡️
