import "server-only";

import { z } from "zod";

const googleDriveEnvSchema = z.object({
  GOOGLE_DRIVE_CLIENT_ID: z.string().min(1),
  GOOGLE_DRIVE_CLIENT_SECRET: z.string().min(1),
  GOOGLE_DRIVE_REDIRECT_URI: z.string().url(),
  GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: z.string().min(1),
  GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY_VERSION: z.string().trim().regex(/^[a-zA-Z0-9._-]{1,64}$/).default("v1"),
  GOOGLE_DRIVE_OAUTH_STATE_SECRET: z.string().min(32),
});

export type GoogleDriveEnv = z.infer<typeof googleDriveEnvSchema>;

export function isGoogleDriveConfigured() {
  return Boolean(
    process.env.GOOGLE_DRIVE_CLIENT_ID &&
      process.env.GOOGLE_DRIVE_CLIENT_SECRET &&
      process.env.GOOGLE_DRIVE_REDIRECT_URI &&
      process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY &&
      process.env.GOOGLE_DRIVE_OAUTH_STATE_SECRET,
  );
}

export function getGoogleDriveEnv(): GoogleDriveEnv {
  return googleDriveEnvSchema.parse({
    GOOGLE_DRIVE_CLIENT_ID: process.env.GOOGLE_DRIVE_CLIENT_ID,
    GOOGLE_DRIVE_CLIENT_SECRET: process.env.GOOGLE_DRIVE_CLIENT_SECRET,
    GOOGLE_DRIVE_REDIRECT_URI: process.env.GOOGLE_DRIVE_REDIRECT_URI,
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY: process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY,
    GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY_VERSION: process.env.GOOGLE_DRIVE_TOKEN_ENCRYPTION_KEY_VERSION,
    GOOGLE_DRIVE_OAUTH_STATE_SECRET: process.env.GOOGLE_DRIVE_OAUTH_STATE_SECRET,
  });
}
