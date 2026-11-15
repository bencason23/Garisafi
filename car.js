const detailMessage = document.querySelector("#car-detail-message");
const detailLayout = document.querySelector("#car-detail");
const mainPhoto = document.querySelector("#car-main-photo");
const thumbnails = document.querySelector("#car-thumbnails");
const photoCount = document.querySelector("#car-photo-count");
const siteChatButton = document.querySelector("#site-chat-button");
const siteChatPanel = document.querySelector("#site-chat-panel");
const siteChatMessages = document.querySelector("#site-chat-messages");
const siteChatError = document.querySelector("#site-chat-error");
const siteChatForm = document.querySelector("#site-chat-form");
const siteChatInput = document.querySelector("#site-chat-input");
let activeConversationId = "";
let signedInUserId = "";
let chatRefreshTimer;
let renderedMessageSignature = "";

function showDetailError(message) {
  detailMessage.textContent = message;
  detailMessage.classList.remove("success");
  window.showToast(message, "error");
}

function selectPhoto(photoUrls, index) {
  mainPhoto.src = photoUrls[index];
  mainPhoto.alt = `Car photo ${index + 1} of ${photoUrls.length}`;
  photoCount.textContent = `${index + 1} / ${photoUrls.length}`;
  for (const [thumbnailIndex, button] of [...thumbnails.children].entries()) {
    button.setAttribute("aria-current", String(thumbnailIndex === index));
  }
}

function addSpec(label, value) {
  const item = document.createElement("div");
  item.className = "car-spec-item";
  const name = document.createElement("span");
  name.textContent = label;
  const detail = document.createElement("strong");
  detail.textContent = value;
  item.append(name, detail);
  return item;
}

function formatChatTime(value) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "short", timeStyle: "short" }).format(new Date(value));
}

function renderChatMessages(messages) {
  const signature = messages.map(message => message.id).join(",");
  if (signature === renderedMessageSignature) return;
  renderedMessageSignature = signature;
  siteChatMessages.replaceChildren();
  for (const message of messages) {
    const bubble = document.createElement("article");
    bubble.className = "chat-bubble";
    bubble.classList.toggle("is-mine", message.senderId === signedInUserId);
    const sender = document.createElement("strong");
    sender.textContent = message.senderId === signedInUserId ? "You" : message.senderName;
    const text = document.createElement("p");
    text.textContent = message.body;
    const time = document.createElement("time");
    time.dateTime = message.createdAt;
    time.textContent = formatChatTime(message.createdAt);
    bubble.append(sender, text, time);
    siteChatMessages.append(bubble);
  }
  siteChatMessages.scrollTop = siteChatMessages.scrollHeight;
}

async function loadChatMessages() {
  if (!activeConversationId) return;
  const response = await fetch(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`);
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "Could not load messages.");
  renderChatMessages(result.messages);
}

async function openSiteChat() {
  const carId = new URLSearchParams(window.location.search).get("id");
  siteChatError.textContent = "";
  siteChatPanel.hidden = false;
  siteChatButton.disabled = true;
  try {
    const response = await fetch(`/api/cars/${encodeURIComponent(carId)}/conversations`, { method: "POST" });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      const returnTo = `car.html?id=${encodeURIComponent(carId)}`;
      window.location.assign(`login.html?returnTo=${encodeURIComponent(returnTo)}`);
      return;
    }
    if (!response.ok) throw new Error(result.error || "Could not start this chat.");
    activeConversationId = result.conversationId;
    renderedMessageSignature = "";
    document.querySelector("#site-chat-title").textContent = `Chat about ${document.querySelector("#car-detail-title").textContent}`;
    await loadChatMessages();
    window.showToast("Chat with the seller is ready.", "success");
    window.clearInterval(chatRefreshTimer);
    chatRefreshTimer = window.setInterval(() => {
      loadChatMessages().catch(error => { siteChatError.textContent = error.message; });
    }, 5000);
    siteChatInput.focus();
    siteChatPanel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  } catch (error) {
    siteChatError.textContent = error.message || "Could not open this chat.";
    window.showToast(siteChatError.textContent, "error");
  } finally {
    siteChatButton.disabled = false;
  }
}

siteChatButton.addEventListener("click", openSiteChat);

siteChatForm.addEventListener("submit", async event => {
  event.preventDefault();
  const body = siteChatInput.value.trim();
  if (!activeConversationId || !body) return;
  const sendButton = siteChatForm.querySelector("button");
  sendButton.disabled = true;
  siteChatError.textContent = "";
  try {
    const response = await fetch(`/api/conversations/${encodeURIComponent(activeConversationId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not send your message.");
    siteChatInput.value = "";
    renderedMessageSignature = "";
    await loadChatMessages();
    window.showToast("Message sent.", "success");
  } catch (error) {
    siteChatError.textContent = error.message;
    window.showToast(error.message, "error");
  } finally {
    sendButton.disabled = false;
  }
});

async function loadCar() {
  const id = new URLSearchParams(window.location.search).get("id");
  if (!id) {
    showDetailError("This car listing link is incomplete. Return to the marketplace and choose a car.");
    return;
  }

  try {
    const response = await fetch(`/api/cars/${encodeURIComponent(id)}`);
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not load this car listing.");
    const { car } = result;
    if (!Array.isArray(car.photoUrls) || car.photoUrls.length === 0) throw new Error("This listing has no available car photos.");

    document.title = `${car.year} ${car.make} ${car.model} — GariSafi.com`;
    document.querySelector("#car-detail-make").textContent = car.make.toUpperCase();
    document.querySelector("#car-detail-title").textContent = `${car.year} ${car.make} ${car.model}`;
    document.querySelector("#car-detail-price").textContent = `KSh ${new Intl.NumberFormat("en-KE").format(car.price)}`;
    document.querySelector("#car-description").textContent = car.description || "The seller has not added a description.";
    document.querySelector("#car-specs").replaceChildren(
      addSpec("Year", String(car.year)),
      addSpec("Mileage", `${new Intl.NumberFormat("en-KE").format(car.mileage)} km`),
      addSpec("Body style", car.body)
    );

    const sellerName = car.seller?.name || "GariSafi seller";
    const meResponse = await fetch("/api/auth/me");
    if (meResponse.ok) {
      const { user } = await meResponse.json();
      signedInUserId = user.id;
    }
    siteChatButton.hidden = !car.seller?.id || car.seller.id === signedInUserId;
    document.querySelector("#seller-name").textContent = sellerName;
    const sellerEmail = document.querySelector("#seller-email");
    if (car.seller?.email) {
      sellerEmail.href = `mailto:${car.seller.email}`;
      sellerEmail.textContent = car.seller.email;
    } else {
      sellerEmail.hidden = true;
    }

    const sellerPhone = car.seller?.phone || "";
    const sellerActions = document.querySelector("#seller-actions");
    if (sellerPhone) {
      const internationalPhone = sellerPhone.replace(/[^\d+]/g, "");
      const whatsappNumber = internationalPhone.replace(/\D/g, "");
      document.querySelector("#seller-call").href = `tel:${internationalPhone}`;
      document.querySelector("#seller-chat").href = `https://wa.me/${whatsappNumber}?text=${encodeURIComponent(`Hi ${sellerName}, I'm interested in your ${car.year} ${car.make} ${car.model} listed on GariSafi.com. Is it still available?`)}`;
    } else {
      sellerActions.hidden = true;
      document.querySelector("#seller-hint").textContent = car.seller?.email
        ? "Contact the seller by email to ask questions or arrange a viewing."
        : "Seller contact details are not available for this listing.";
    }

    thumbnails.replaceChildren(...car.photoUrls.map((url, index) => {
      const button = document.createElement("button");
      button.className = "car-thumbnail";
      button.type = "button";
      button.setAttribute("aria-label", `Show car photo ${index + 1}`);
      button.addEventListener("click", () => selectPhoto(car.photoUrls, index));
      const image = document.createElement("img");
      image.src = url;
      image.alt = "";
      image.loading = "lazy";
      button.append(image);
      return button;
    }));
    selectPhoto(car.photoUrls, 0);
    detailLayout.hidden = false;
    if (window.location.hash === "#chat" && !siteChatButton.hidden) await openSiteChat();
  } catch (error) {
    showDetailError(`${error.message} Please return to the marketplace and try again.`);
  }
}

window.addEventListener("pagehide", () => window.clearInterval(chatRefreshTimer));
loadCar();
