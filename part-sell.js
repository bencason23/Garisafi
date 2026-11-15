const maximumPhotoSize = 5 * 1024 * 1024;
const maximumPhotoCount = 10;
const maximumPhotoTotal = 12 * 1024 * 1024;
const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];
const partForm = document.querySelector("#part-form");
const partFormMessage = document.querySelector("#part-form-message");
const partPhotos = document.querySelector("#part-photos");
const partPreview = document.querySelector("#part-preview");
const partSuccessLink = document.querySelector("#part-success-link");
let previewUrls = [];

function showMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
  if (message) window.showToast(message, success ? "success" : "error");
}

function clearPartPreviews() {
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];
  partPreview.replaceChildren();
}

partPhotos.addEventListener("change", () => {
  showMessage(partFormMessage, "");
  partSuccessLink.hidden = true;
  const files = [...partPhotos.files];
  if (files.length > maximumPhotoCount) {
    partPhotos.value = "";
    clearPartPreviews();
    showMessage(partFormMessage, `Choose no more than ${maximumPhotoCount} spare part photos.`);
    return;
  }
  if (files.some(file => !allowedPhotoTypes.includes(file.type) || file.size > maximumPhotoSize)) {
    partPhotos.value = "";
    clearPartPreviews();
    showMessage(partFormMessage, "Use JPG, PNG or WebP photos, each smaller than 5 MB.");
    return;
  }
  if (files.reduce((total, file) => total + file.size, 0) > maximumPhotoTotal) {
    partPhotos.value = "";
    clearPartPreviews();
    showMessage(partFormMessage, "All spare part photos combined must be 12 MB or smaller.");
    return;
  }
  clearPartPreviews();
  for (const [index, file] of files.entries()) {
    const url = URL.createObjectURL(file);
    previewUrls.push(url);
    const image = document.createElement("img");
    image.src = url;
    image.alt = `Preview of spare part photo ${index + 1}`;
    partPreview.append(image);
  }
});

partForm.addEventListener("submit", async event => {
  event.preventDefault();
  showMessage(partFormMessage, "");
  partSuccessLink.hidden = true;
  const photos = [...partPhotos.files];
  if (!photos.length || photos.length > maximumPhotoCount) {
    showMessage(partFormMessage, `Choose between 1 and ${maximumPhotoCount} spare part photos.`);
    return;
  }
  if (photos.some(photo => !allowedPhotoTypes.includes(photo.type) || photo.size > maximumPhotoSize)) {
    showMessage(partFormMessage, "Use JPG, PNG or WebP photos, each smaller than 5 MB.");
    return;
  }
  if (photos.reduce((total, photo) => total + photo.size, 0) > maximumPhotoTotal) {
    showMessage(partFormMessage, "All spare part photos combined must be 12 MB or smaller.");
    return;
  }
  const price = Number(partForm.elements.price.value);
  const phone = partForm.elements.sellerPhone.value.replace(/[\s()-]/g, "");
  if (!Number.isSafeInteger(price) || price < 1 || !/^\+[1-9]\d{7,14}$/.test(phone)) {
    showMessage(partFormMessage, "Enter a valid asking price and international phone number.");
    return;
  }

  try {
    const response = await fetch("/api/parts", { method: "POST", body: new FormData(partForm) });
    if (response.status === 401) {
      window.location.assign("login.html?returnTo=sell-part.html");
      return;
    }
    await response.json().then(result => {
      if (!response.ok) throw new Error(result.error || "The request could not be completed.");
      return result;
    });
    partForm.reset();
    clearPartPreviews();
    showMessage(partFormMessage, "Your spare part has been added to the GariSafi marketplace.", true);
    partSuccessLink.hidden = false;
  } catch (error) {
    showMessage(partFormMessage, error.message || "Could not save your spare part listing.");
  }
});

window.addEventListener("pagehide", clearPartPreviews);
