/**
 * NETZACH Navega — Configuração do Login com Google (OAuth 2.0)
 *
 * COMO OBTER SEU CLIENT ID (gratuito):
 * 1. Acesse https://console.cloud.google.com
 * 2. Crie um projeto
 * 3. Menu ☰ → APIs & Services → Credentials → Create Credentials → OAuth Client ID
 * 4. Escolha tipo "Web application"
 * 5. Em "Authorized JavaScript origins" adicione:
 *    - https://SEU-APP.up.railway.app  (URL da Railway)
 *    - http://localhost:3000          (se quiser testar local)
 * 6. Copie o "Client ID" e cole abaixo.
 *
 * IMPORTANTE: cada origem onde o app rodar precisa estar autorizada
 * no Google Cloud, senão o botão "Entrar com Google" falha.
 */
export const GOOGLE_CLIENT_ID = "COLE_SEU_GOOGLE_CLIENT_ID_AQUI";
