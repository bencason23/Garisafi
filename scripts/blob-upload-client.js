import { upload } from "@vercel/blob/client";

const maximumImageSize = 5 * 1024 * 1024;
const allowedContentTypes = ["image/jpeg", "image/png", "image/webp"];

function fileExtension(file) {
  if (file.type === "image/jpeg") return "jpg";
  if (file.type === "image/png") return "png";
  if (file.type === "image/webp") return "webp";
  throw new Error("Use JPG, PNG or WebP listing photos.");
}

async function readJson(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    const error = new Error(result.error || "The request could not be completed.");
    error.status = response.status;
    throw error;
  }
  return result;
}

async function deleteUploadedPhotos(photoUploads) {
  if (!photoUploads.length) return;
  const response = await fetch("/api/uploads", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ photoUploads })
  });
  if (!response.ok) {
    const result = await response.json().catch(() => ({}));
    throw new Error(result.error || "Could not remove incomplete photo uploads.");
  }
}

window.uploadMarketplacePhotos = async (files, market) => {
  const health = await readJson(await fetch("/api/health"));
  if (!health.blobUploadsEnabled) {
    if (health.onVercel) {
      throw new Error("Vercel Blob is not configured. Connect a Blob store to this Vercel project and redeploy.");
    }
    return null;
  }

  const meResponse = await fetch("/api/auth/me");
  if (meResponse.status === 401) {
    const error = new Error("Sign in before uploading listing photos.");
    error.status = 401;
    throw error;
  }
  const { user } = await readJson(meResponse);
  const uploaded = [];

  try {
    for (const [index, file] of files.entries()) {
      if (!allowedContentTypes.includes(file.type) || file.size > maximumImageSize) {
        throw new Error("Use JPG, PNG or WebP photos, each smaller than 5 MB.");
      }
      const pathname = `marketplace/${market}/${user.id}/${crypto.randomUUID()}-${index + 1}.${fileExtension(file)}`;
      const blob = await upload(pathname, file, {
        access: "public",
        handleUploadUrl: `/api/uploads?type=${encodeURIComponent(market)}`
      });
      uploaded.push({
        url: blob.url,
        pathname: blob.pathname,
        contentType: blob.contentType,
        size: blob.size
      });
    }
    return uploaded;
  } catch (error) {
    try {
      await deleteUploadedPhotos(uploaded);
    } catch (cleanupError) {
      console.error("Could not clean up incomplete photo uploads:", cleanupError);
    }
    throw error;
  }
};

window.deleteMarketplacePhotos = deleteUploadedPhotos;
