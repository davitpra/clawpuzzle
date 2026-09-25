# Storage Module

Internal service for managing file persistence using **Cloudinary**. Handles uploads and deletions for pet photos and generated assets. Exposed as a global NestJS module so any other module can inject `StorageService`.

## Files Structure

- `storage/storage.service.ts`: Core service wrapping the Cloudinary SDK v2.
- `storage/storage.module.ts`: Global module — no need to import in other modules.

## API (StorageService methods)

This module has no HTTP endpoints. It is consumed internally by other modules (e.g. `PetsController`, `StylesService`).

| Method         | Signature                                              | Returns          | Description                                                   |
| :------------- | :----------------------------------------------------- | :--------------- | :------------------------------------------------------------ |
| `upload`       | `(key, buffer, contentType) => Promise<string>`        | `secure_url`     | Uploads a buffer to Cloudinary using `key` as `public_id`.    |
| `delete`       | `(key) => Promise<void>`                               | —                | Destroys a resource in Cloudinary by `public_id`.             |
| `getPublicUrl` | `(key) => string`                                      | URL string       | Builds a Cloudinary delivery URL from a `public_id`.          |

## Features

- **Provider**: Cloudinary (SDK v2 — `cloudinary` package).
- **Resource Type Detection**: Automatically uses `resource_type: 'video'` for video content types and `'image'` for everything else.
- **Key as public_id**: The `key` parameter (e.g. `pets/{userId}/{petId}/{uuid}`) becomes the Cloudinary `public_id`, and everything before the last `/` is sent as `asset_folder`, so the Media Library shows the same folder tree (required in dynamic folder mode, where slashes in the `public_id` no longer create folders).
- **Overwrite**: Uploads use `overwrite: true` — re-uploading the same key replaces the file.
- **Configuration**: Reads `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, and `CLOUDINARY_API_SECRET` from environment variables.
