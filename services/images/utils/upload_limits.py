class UploadTooLargeError(ValueError):
    pass


async def read_upload_limited(upload, max_bytes: int) -> bytes:
    declared_size = getattr(upload, "size", None)
    if declared_size is not None and declared_size > max_bytes:
        raise UploadTooLargeError

    content = await upload.read(max_bytes + 1)
    if len(content) > max_bytes:
        raise UploadTooLargeError
    return content
