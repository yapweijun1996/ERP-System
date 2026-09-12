import type { DocumentStorageBackend, DocumentStorageProvider } from './storage';
import { DocumentStorageError } from './storageError';

export class DocumentStorageRegistry {
  private readonly providers = new Map<DocumentStorageBackend, DocumentStorageProvider>();

  constructor(providers: DocumentStorageProvider[]) {
    for (const provider of providers) this.providers.set(provider.backend, provider);
    if (!this.providers.has('database')) {
      throw new DocumentStorageError(
        'document_database_provider_required',
        'The database document provider must always be configured.',
        500,
      );
    }
  }

  get(backend: DocumentStorageBackend): DocumentStorageProvider {
    const provider = this.providers.get(backend);
    if (!provider) {
      throw new DocumentStorageError(
        'document_storage_backend_unavailable',
        `Document storage backend '${backend}' is not configured on this server.`,
        503,
      );
    }
    return provider;
  }
}
