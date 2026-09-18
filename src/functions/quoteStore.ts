import { BlobServiceClient, ContainerClient } from "@azure/storage-blob";
import { ManagedIdentityCredential } from "@azure/identity";
import { createHash } from "crypto";
import { IdentityScope } from "./salesTypes";

export interface StoredDocument<T> {
  value: T;
  etag?: string;
}

export interface DocumentStore {
  get<T>(path: string): Promise<StoredDocument<T> | null>;
  create<T>(path: string, value: T): Promise<void>;
  replace<T>(path: string, value: T, etag: string): Promise<void>;
}

function createBlobServiceClient(): BlobServiceClient {
  const connectionString = process.env.AzureWebJobsStorage;
  if (connectionString) {
    return BlobServiceClient.fromConnectionString(connectionString);
  }
  const serviceUri = process.env.AzureWebJobsStorage__blobServiceUri;
  if (!serviceUri) {
    throw new Error("Blob storage is not configured.");
  }
  const clientId = process.env.AzureWebJobsStorage__clientId;
  return new BlobServiceClient(serviceUri, new ManagedIdentityCredential(clientId));
}

export class BlobDocumentStore implements DocumentStore {
  private readonly container: ContainerClient;

  constructor() {
    const name = process.env.SALES_QUOTE_CONTAINER || "sales-quotes";
    this.container = createBlobServiceClient().getContainerClient(name);
  }

  async get<T>(path: string): Promise<StoredDocument<T> | null> {
    const blob = this.container.getBlockBlobClient(path);
    try {
      const response = await blob.downloadToBuffer();
      const properties = await blob.getProperties();
      return { value: JSON.parse(response.toString("utf8")) as T, etag: properties.etag };
    } catch (error) {
      if (isStorageStatus(error, 404)) {
        return null;
      }
      throw error;
    }
  }

  async create<T>(path: string, value: T): Promise<void> {
    await this.container.createIfNotExists();
    const body = JSON.stringify(value);
    await this.container.getBlockBlobClient(path).upload(body, Buffer.byteLength(body), {
      blobHTTPHeaders: { blobContentType: "application/json" },
      conditions: { ifNoneMatch: "*" },
    });
  }

  async replace<T>(path: string, value: T, etag: string): Promise<void> {
    const body = JSON.stringify(value);
    await this.container.getBlockBlobClient(path).upload(body, Buffer.byteLength(body), {
      blobHTTPHeaders: { blobContentType: "application/json" },
      conditions: { ifMatch: etag },
    });
  }
}

export function identityPath(identity: IdentityScope, suffix: string): string {
  const hash = createHash("sha256").update(identity.key).digest("hex");
  return `identities/${hash}/${suffix}`;
}

export function isStorageStatus(error: unknown, statusCode: number): boolean {
  return typeof error === "object" && error !== null && "statusCode" in error &&
    (error as { statusCode?: number }).statusCode === statusCode;
}
