import "server-only";

import { getAdminSupabaseClient } from "@/lib/supabase/admin";
import { decrypt, encrypt, GOOGLE_DRIVE_TOKEN_ENCRYPTION_ALGORITHM } from "@/lib/google-drive/crypto";
import { getGoogleDriveEnv, isGoogleDriveConfigured } from "@/lib/google-drive/env";
import type { ActiveAuthMember } from "@/lib/auth/types";

const CONNECTIONS_TABLE = "google_drive_connections";
const FOLDERS_TABLE = "google_drive_folders";
const DRIVE_FILE_SCOPE = "https://www.googleapis.com/auth/drive.file";
const PRIME_CREATIVE_FOLDER_NAME = "Prime Creative";
const PIXEL_FOLDER_NAME = "Pixel";
const PIXEL_EXPORTS_FOLDER_NAME = "Exportações";
const PRODUCT_KEY = "pixel";
const PIXEL_ROOT_FOLDER_KEY = "root";
const PIXEL_EXPORTS_FOLDER_KEY = "exports";

type ConnectionRow = {
  team_member_id: string;
  workspace_id: string;
  refresh_token_ciphertext: string;
  refresh_token_iv: string;
  refresh_token_auth_tag: string | null;
  refresh_token_key_version: string | null;
  refresh_token_encryption: string | null;
  prime_creative_folder_id: string | null;
};

type SecureConnectionRow = ConnectionRow & {
  refresh_token_auth_tag: string;
  refresh_token_key_version: string;
  refresh_token_encryption: string;
  prime_creative_folder_id: string;
};

type FolderRow = {
  team_member_id: string;
  workspace_id: string;
  product_key: string;
  folder_key: string;
  google_drive_folder_id: string;
  parent_google_drive_folder_id: string | null;
};

type GoogleTokenResponse = { access_token?: string; refresh_token?: string; expires_in?: number; error?: string; error_description?: string };
type DriveFileResponse = { id?: string; name?: string; webViewLink?: string; error?: { message?: string } };

function cleanFileName(name: string) {
  return name.replace(/[^a-zA-Z0-9._-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 180) || "pixel-export";
}

async function connectionFor(member: ActiveAuthMember) {
  const { data, error } = await getAdminSupabaseClient()
    .from(CONNECTIONS_TABLE)
    .select("team_member_id, workspace_id, refresh_token_ciphertext, refresh_token_iv, refresh_token_auth_tag, refresh_token_key_version, refresh_token_encryption, prime_creative_folder_id")
    .eq("team_member_id", member.id)
    .eq("workspace_id", member.workspaceId)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar a conexão com o Google Drive.");
  return data as ConnectionRow | null;
}

function usableConnection(connection: ConnectionRow | null): connection is SecureConnectionRow {
  return Boolean(
    connection
    && connection.prime_creative_folder_id
    && connection.refresh_token_auth_tag
    && connection.refresh_token_key_version
    && connection.refresh_token_encryption === GOOGLE_DRIVE_TOKEN_ENCRYPTION_ALGORITHM,
  );
}

async function folderFor(member: ActiveAuthMember, folderKey: string) {
  const { data, error } = await getAdminSupabaseClient()
    .from(FOLDERS_TABLE)
    .select("team_member_id, workspace_id, product_key, folder_key, google_drive_folder_id, parent_google_drive_folder_id")
    .eq("team_member_id", member.id)
    .eq("workspace_id", member.workspaceId)
    .eq("product_key", PRODUCT_KEY)
    .eq("folder_key", folderKey)
    .maybeSingle();
  if (error) throw new Error("Não foi possível consultar a pasta do Pixel no Google Drive.");
  return data as FolderRow | null;
}

async function requestAccessToken(refreshToken: string) {
  const env = getGoogleDriveEnv();
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: env.GOOGLE_DRIVE_CLIENT_ID, client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET, refresh_token: refreshToken, grant_type: "refresh_token" }),
  });
  const body = await response.json() as GoogleTokenResponse;
  if (!response.ok || !body.access_token) throw new Error("A autorização do Google Drive expirou ou foi revogada. Conecte a conta novamente.");
  return body.access_token;
}

async function createFolder(accessToken: string, name: string, parentFolderId?: string, folderKey?: string, productKey = PRODUCT_KEY) {
  const response = await fetch("https://www.googleapis.com/drive/v3/files?fields=id,name", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mimeType: "application/vnd.google-apps.folder",
      ...(parentFolderId ? { parents: [parentFolderId] } : {}),
      appProperties: { "prime-product": productKey, "prime-folder-key": folderKey || "root" },
    }),
  });
  const body = await response.json() as DriveFileResponse;
  if (!response.ok || !body.id) throw new Error(body.error?.message || `Não foi possível criar a pasta ${name} no Google Drive.`);
  return body.id;
}

async function saveFolder(member: ActiveAuthMember, folderKey: string, folderId: string, parentFolderId: string | null) {
  const { error } = await getAdminSupabaseClient().from(FOLDERS_TABLE).upsert({
    team_member_id: member.id,
    workspace_id: member.workspaceId,
    product_key: PRODUCT_KEY,
    folder_key: folderKey,
    google_drive_folder_id: folderId,
    parent_google_drive_folder_id: parentFolderId,
  }, { onConflict: "team_member_id,product_key,folder_key" });
  if (error) throw new Error("Não foi possível registrar a pasta do Pixel no Google Drive.");
}

async function ensurePixelExportFolder(member: ActiveAuthMember, accessToken: string, primeCreativeFolderId: string) {
  const pixelRoot = await folderFor(member, PIXEL_ROOT_FOLDER_KEY);
  const pixelRootId = pixelRoot?.google_drive_folder_id
    ?? await createFolder(accessToken, PIXEL_FOLDER_NAME, primeCreativeFolderId, PIXEL_ROOT_FOLDER_KEY);
  if (!pixelRoot) await saveFolder(member, PIXEL_ROOT_FOLDER_KEY, pixelRootId, primeCreativeFolderId);

  const exportsFolder = await folderFor(member, PIXEL_EXPORTS_FOLDER_KEY);
  const exportsFolderId = exportsFolder?.google_drive_folder_id
    ?? await createFolder(accessToken, PIXEL_EXPORTS_FOLDER_NAME, pixelRootId, PIXEL_EXPORTS_FOLDER_KEY);
  if (!exportsFolder) await saveFolder(member, PIXEL_EXPORTS_FOLDER_KEY, exportsFolderId, pixelRootId);
  return exportsFolderId;
}

async function uploadFile(accessToken: string, folderId: string, file: File) {
  const boundary = `pixel-${crypto.randomUUID()}`;
  const metadata = JSON.stringify({ name: cleanFileName(file.name), mimeType: file.type || "application/octet-stream", parents: [folderId] });
  const body = Buffer.concat([
    Buffer.from(`--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${metadata}\r\n--${boundary}\r\nContent-Type: ${file.type || "application/octet-stream"}\r\n\r\n`),
    Buffer.from(await file.arrayBuffer()),
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  const response = await fetch("https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink", {
    method: "POST",
    headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": `multipart/related; boundary=${boundary}` },
    body,
  });
  const payload = await response.json() as DriveFileResponse;
  if (!response.ok || !payload.id || !payload.name) throw new Error(payload.error?.message || `Não foi possível enviar ${file.name} ao Google Drive.`);
  return { id: payload.id, name: payload.name, webViewLink: payload.webViewLink };
}

export function googleDriveConfiguration() {
  return { configured: isGoogleDriveConfigured() };
}

export async function googleDriveStatus(member: ActiveAuthMember) {
  if (!isGoogleDriveConfigured()) return { configured: false, connected: false };
  return { configured: true, connected: usableConnection(await connectionFor(member)) };
}

export function googleDriveAuthorizationUrl(state: string) {
  const env = getGoogleDriveEnv();
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({ client_id: env.GOOGLE_DRIVE_CLIENT_ID, redirect_uri: env.GOOGLE_DRIVE_REDIRECT_URI, response_type: "code", scope: DRIVE_FILE_SCOPE, access_type: "offline", prompt: "consent", include_granted_scopes: "true", state }).toString();
  return url;
}

export async function completeGoogleDriveAuthorization(member: ActiveAuthMember, code: string) {
  const env = getGoogleDriveEnv();
  const existingConnection = await connectionFor(member);
  const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ code, client_id: env.GOOGLE_DRIVE_CLIENT_ID, client_secret: env.GOOGLE_DRIVE_CLIENT_SECRET, redirect_uri: env.GOOGLE_DRIVE_REDIRECT_URI, grant_type: "authorization_code" }),
  });
  const tokens = await tokenResponse.json() as GoogleTokenResponse;
  if (!tokenResponse.ok || !tokens.access_token || !tokens.refresh_token) throw new Error("O Google não forneceu uma autorização persistente. Tente conectar novamente.");
  const primeCreativeFolderId = existingConnection?.prime_creative_folder_id
    ?? await createFolder(tokens.access_token, PRIME_CREATIVE_FOLDER_NAME, undefined, "root", "prime-creative");
  const encrypted = encrypt(tokens.refresh_token, env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY, env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY_VERSION);
  const { error } = await getAdminSupabaseClient().from(CONNECTIONS_TABLE).upsert({
    team_member_id: member.id,
    workspace_id: member.workspaceId,
    refresh_token_ciphertext: encrypted.ciphertext,
    refresh_token_iv: encrypted.iv,
    refresh_token_auth_tag: encrypted.authTag,
    refresh_token_key_version: encrypted.keyVersion,
    refresh_token_encryption: GOOGLE_DRIVE_TOKEN_ENCRYPTION_ALGORITHM,
    prime_creative_folder_id: primeCreativeFolderId,
  }, { onConflict: "team_member_id" });
  if (error) throw new Error("O Google Drive foi autorizado, mas não foi possível guardar a conexão com segurança.");
  await ensurePixelExportFolder(member, tokens.access_token, primeCreativeFolderId);
}

export async function uploadPixelExports(member: ActiveAuthMember, files: File[]) {
  const connection = await connectionFor(member);
  if (!usableConnection(connection)) throw new Error("Reconecte o Google Drive para concluir a atualização de segurança.");
  const env = getGoogleDriveEnv();
  if (connection.refresh_token_key_version !== env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY_VERSION) throw new Error("A chave de segurança foi rotacionada. Reconecte o Google Drive.");
  const refreshToken = decrypt({ ciphertext: connection.refresh_token_ciphertext, iv: connection.refresh_token_iv, authTag: connection.refresh_token_auth_tag, keyVersion: connection.refresh_token_key_version }, env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY);
  const accessToken = await requestAccessToken(refreshToken);
  const exportsFolderId = await ensurePixelExportFolder(member, accessToken, connection.prime_creative_folder_id);
  return Promise.all(files.map((file) => uploadFile(accessToken, exportsFolderId, file)));
}

export async function disconnectGoogleDrive(member: ActiveAuthMember) {
  const connection = await connectionFor(member);
  if (!connection) return { revoked: true };
  let revoked = false;
  if (usableConnection(connection)) {
    try {
      const env = getGoogleDriveEnv();
      if (connection.refresh_token_key_version === env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY_VERSION) {
        const refreshToken = decrypt({ ciphertext: connection.refresh_token_ciphertext, iv: connection.refresh_token_iv, authTag: connection.refresh_token_auth_tag, keyVersion: connection.refresh_token_key_version }, env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY);
        const response = await fetch("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "Content-Type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: refreshToken }) });
        revoked = response.ok;
      }
    } catch {
      revoked = false;
    }
  }
  const { error } = await getAdminSupabaseClient().from(CONNECTIONS_TABLE).delete().eq("team_member_id", member.id).eq("workspace_id", member.workspaceId);
  if (error) throw new Error("Não foi possível remover a conexão local com o Google Drive.");
  return { revoked };
}
