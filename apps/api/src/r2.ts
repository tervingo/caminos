import { DeleteObjectsCommand, HeadObjectCommand, PutObjectCommand, S3Client } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import type { Config } from './config.js';

export interface R2 {
  bucket: string;
  firmarSubida(key: string, contentType: string, segundos?: number): Promise<string>;
  /** Tamaño y tipo de un objeto, o null si no existe */
  cabecera(key: string): Promise<{ tamano: number; contentType: string | null } | null>;
  borrar(keys: string[]): Promise<void>;
}

export function createR2(config: Config): R2 | undefined {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET } = config;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET) return undefined;

  const client = new S3Client({
    region: 'auto',
    endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY },
  });

  return {
    bucket: R2_BUCKET,
    firmarSubida: (key, contentType, segundos = 300) =>
      getSignedUrl(client, new PutObjectCommand({ Bucket: R2_BUCKET, Key: key, ContentType: contentType }), {
        expiresIn: segundos,
      }),

    async cabecera(key) {
      try {
        const res = await client.send(new HeadObjectCommand({ Bucket: R2_BUCKET, Key: key }));
        return { tamano: res.ContentLength ?? 0, contentType: res.ContentType ?? null };
      } catch (err) {
        if ((err as { name?: string }).name === 'NotFound') return null;
        throw err;
      }
    },

    async borrar(keys) {
      if (keys.length === 0) return;
      await client.send(
        new DeleteObjectsCommand({ Bucket: R2_BUCKET, Delete: { Objects: keys.map((Key) => ({ Key })), Quiet: true } }),
      );
    },
  };
}
