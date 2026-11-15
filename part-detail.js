const detailMessage = document.querySelector("#part-detail-message");
const detailLayout = document.querySelector("#part-detail");
const partChatButton = document.querySelector("#part-chat-button");
let signedInUserId = "";

function showPartDetailError(message) {
  detailMessage.textContent = message;
  detailMessage.classList.remove("success");
  window.showToast(message, "error");
}

async function loadPart() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    showPartDetailError("This spare part link is incomplete. Return to the marketplace and choose a part.");
    return;
  }

  try {
    const response = await fetch(`/api/parts/${encodeURIComponent(id)}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not load this spare part listing.");
    const { part } = result;
    const photoUrls = Array.isArray(part.photoUrls) && part.photoUrls.length ? part.photoUrls : [part.photoUrl].filter(Boolean);
    if (!photoUrls.length) throw new Error("This listing has no available spare part photos.");

    document.title = `${part.title} — Spare parts on GariSafi.com`;
    const mainPhoto = document.querySelector("#part-detail-photo");
    const thumbnails = document.querySelector("#part-detail-thumbnails");
    mainPhoto.src = photoUrls[0];
    mainPhoto.alt = `${part.title}, photo 1 of ${photoUrls.length}`;
    thumbnails.replaceChildren(...photoUrls.map((url, index) => {
      const button = document.createElement("button");
      button.className = "part-detail-thumbnail";
      button.type = "button";
      button.setAttribute("aria-label", `Show spare part photo ${index + 1}`);
      button.setAttribute("aria-current", String(index === 0));
      button.addEventListener("click", () => {
        mainPhoto.src = url;
        mainPhoto.alt = `${part.title}, photo ${index + 1} of ${photoUrls.length}`;
        for (const [thumbnailIndex, thumbnail] of [...thumbnails.children].entries()) {
          thumbnail.setAttribute("aria-current", String(thumbnailIndex === index));
        }
      });
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.loading = "lazy";
      button.append(image);
      return button;
    }));
    document.querySelector("#part-detail-category").textContent = part.category;
    document.querySelector("#part-detail-condition").textContent = part.condition;
    document.querySelector("#part-detail-title").textContent = part.title;
    document.querySelector("#part-detail-price").textContent = `KSh ${new Intl.NumberFormat("en-KE").format(part.price)}`;
    document.querySelector("#part-detail-compatibility").textContent = part.compatibleVehicles || "The seller has not specified vehicle compatibility.";
    document.querySelector("#part-detail-description").textContent = part.description || "The seller has not added a description.";
    document.querySelector("#part-detail-seller").textContent = part.sellerName || "GariSafi seller";

    const emailLink = document.querySelector("#part-detail-email");
    if (part.sellerEmail) {
      emailLink.href = `mailto:${encodeURIComponent(part.sellerEmail)}?subject=${encodeURIComponent(`Interested in ${part.title}`)}&body=${encodeURIComponent(`Hi ${part.sellerName}, I'm interested in your ${part.title} listing on GariSafi.com. Is it still available?`)}`;
      emailLink.hidden = false;
    }

    const showPhoneButton = document.querySelector("#part-detail-contact");
    const sellerPhone = document.querySelector("#part-detail-phone");
    const sellerHint = document.querySelector("#part-detail-seller-hint");
    showPhoneButton.addEventListener("click", async () => {
      showPhoneButton.disabled = true;
      sellerHint.textContent = "";
      try {
        const contactResponse = await fetch(`/api/parts/${encodeURIComponent(part.id)}/contact`);
        const contactResult = await contactResponse.json().catch(() => ({}));
        if (!contactResponse.ok) throw new Error(contactResult.error || "Could not load seller contact details.");
        if (!contactResult.sellerPhone) {
          showPhoneButton.hidden = true;
          sellerHint.textContent = "The seller has not provided a phone number for this listing.";
          return;
        }
        const internationalPhone = contactResult.sellerPhone.replace(/[^\d+]/g, "");
        sellerPhone.href = `tel:${internationalPhone}`;
        sellerPhone.textContent = contactResult.sellerPhone;
        sellerPhone.hidden = false;
        showPhoneButton.hidden = true;
        sellerPhone.focus();
      } catch (error) {
        sellerHint.textContent = error.message || "Could not load seller contact details.";
      } finally {
        showPhoneButton.disabled = false;
      }
    });

    const meResponse = await fetch("/api/auth/me");
    if (meResponse.ok) {
      const { user } = await meResponse.json();
      signedInUserId = user.id;
    } else if (meResponse.status !== 401) {
      const meResult = await meResponse.json().catch(() => ({}));
      throw new Error(meResult.error || "Could not verify your account.");
    }
    const isOwnListing = Boolean(signedInUserId && part.sellerId === signedInUserId);
    if (isOwnListing) {
      showPhoneButton.hidden = true;
      emailLink.hidden = true;
      partChatButton.hidden = true;
      sellerHint.textContent = "This is your listing. Buyer contact options are unavailable for your own part.";
    } else {
      partChatButton.hidden = !part.sellerId;
      if (window.location.hash === "#contact") showPhoneButton.click();
    }
    detailLayout.hidden = false;
    if (window.location.hash === "#chat" && !partChatButton.hidden) await openPartChat(part.id);
  } catch (error) {
    showPartDetailError(`${error.message} Please return to the marketplace and try again.`);
  }
}

async function openPartChat(partId = new URLSearchParams(window.location.search).get("id")) {
  partChatButton.disabled = true;
  try {
    const response = await fetch(`/api/parts/${encodeURIComponent(partId)}/conversations`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      const returnTo = `part.html?id=${encodeURIComponent(partId)}`;
      window.location.assign(`login.html?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (!response.ok) throw new Error(result.error || "Could not start this chat.");
    window.location.assign(`inbox.html?id=${encodeURIComponent(result.conversationId)}`);
  } catch (error) {
    showPartDetailError(error.message || "Could not open this chat.");
  } finally {
    partChatButton.disabled = false;
  }
}

partChatButton.addEventListener("click", () => openPartChat());
loadPart();
