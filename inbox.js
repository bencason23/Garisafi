const conversationList = document.querySelector("#conversation-list");
const inboxMessages = document.querySelector("#inbox-messages");
const inboxError = document.querySelector("#inbox-error");
const replyForm = document.querySelector("#inbox-reply-form");
const replyInput = document.querySelector("#inbox-reply");
const replyButton = replyForm.querySelector("button");
let conversations = [];
let selectedConversationId = new URLSearchParams(window.location.search).get("id");
let currentUserId = "";
let messageSignature = "";
let refreshTimer;

function showError(message) {
  inboxError.textContent = message;
  if (message) window.showToast(message, "error");
}

async function readApiResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function formatTime(value) {
  return new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value));
}

function renderConversations() {
  conversationList.replaceChildren();
  for (const conversation of conversations) {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "conversation-item";
    button.classList.toggle("is-selected", conversation.id === selectedConversationId);
    button.addEventListener("click", () => selectConversation(conversation.id));

    const name = document.createElement("strong");
    name.textContent = conversation.counterpart.name;
    const listingTitle = document.createElement("span");
    listingTitle.className = "conversation-car";
    listingTitle.textContent = conversation.listing?.title || conversation.car?.title || conversation.part?.title || "Listing unavailable";
    const preview = document.createElement("span");
    preview.className = "conversation-preview";
    preview.textContent = conversation.lastMessage || "Conversation started";
    const time = document.createElement("time");
    time.dateTime = conversation.lastMessageAt;
    time.textContent = formatTime(conversation.lastMessageAt);
    button.append(name, listingTitle, preview, time);
    conversationList.append(button);
  }
  if (!conversations.length) {
    const empty = document.createElement("p");
    empty.className = "inbox-empty";
    empty.textContent = "No conversations yet. Open a car or spare-part listing and choose “Chat with seller” to start a chat.";
    conversationList.append(empty);
  }
}

function renderMessages(messages) {
  const signature = messages.map(message => message.id).join(",");
  if (signature === messageSignature) return;
  const wasAtBottom = inboxMessages.scrollHeight - inboxMessages.scrollTop - inboxMessages.clientHeight < 60;
  messageSignature = signature;
  inboxMessages.replaceChildren();
  for (const message of messages) {
    const bubble = document.createElement("article");
    bubble.className = "chat-bubble";
    bubble.classList.toggle("is-mine", message.senderId === currentUserId);
    const sender = document.createElement("strong");
    sender.textContent = message.senderId === currentUserId ? "You" : message.senderName;
    const text = document.createElement("p");
    text.textContent = message.body;
    const time = document.createElement("time");
    time.dateTime = message.createdAt;
    time.textContent = formatTime(message.createdAt);
    bubble.append(sender, text, time);
    inboxMessages.append(bubble);
  }
  if (wasAtBottom || messages.length <= 1) inboxMessages.scrollTop = inboxMessages.scrollHeight;
}

async function loadMessages() {
  if (!selectedConversationId) return;
  const { messages } = await readApiResponse(await fetch(`/api/conversations/${encodeURIComponent(selectedConversationId)}/messages`));
  renderMessages(messages);
}

async function selectConversation(id) {
  selectedConversationId = id;
  messageSignature = "";
  const conversation = conversations.find(item => item.id === id);
  if (!conversation) return;
  const listing = conversation.listing || conversation.car || conversation.part;
  const title = document.querySelector("#thread-title");
  title.textContent = `${conversation.counterpart.name} · ${listing?.title || "Listing unavailable"}`;
  const carLink = document.querySelector("#thread-car-link");
  if (listing) {
    carLink.href = `${listing.type === "part" || conversation.part ? "part" : "car"}.html?id=${encodeURIComponent(listing.id)}`;
  }
  carLink.hidden = !listing;
  replyInput.disabled = false;
  replyButton.disabled = false;
  history.replaceState(null, "", `inbox.html?id=${encodeURIComponent(id)}`);
  renderConversations();
  inboxMessages.replaceChildren();
  try {
    await loadMessages();
    showError("");
  } catch (error) {
    showError(error.message);
  }
}

async function loadInbox() {
  try {
    const [meResponse, inboxResponse] = await Promise.all([fetch("/api/auth/me"), fetch("/api/conversations")]);
    if (meResponse.status === 401 || inboxResponse.status === 401) {
      window.location.assign("login.html?returnTo=inbox.html");
      return;
    }
    const [{ user }, { conversations: loadedConversations }] = await Promise.all([
      readApiResponse(meResponse),
      readApiResponse(inboxResponse)
    ]);
    currentUserId = user.id;
    conversations = loadedConversations;
    renderConversations();
    if (selectedConversationId && conversations.some(item => item.id === selectedConversationId)) {
      await selectConversation(selectedConversationId);
    } else if (conversations.length) {
      await selectConversation(conversations[0].id);
    }
    refreshTimer = window.setInterval(async () => {
      try {
        const { conversations: updated } = await readApiResponse(await fetch("/api/conversations"));
        conversations = updated;
        renderConversations();
        if (selectedConversationId && conversations.some(item => item.id === selectedConversationId)) await loadMessages();
      } catch (error) {
        showError(error.message);
      }
    }, 5000);
  } catch (error) {
    showError(error.message || "Could not load your conversations.");
  }
}

replyForm.addEventListener("submit", async event => {
  event.preventDefault();
  const body = replyInput.value.trim();
  if (!selectedConversationId || !body) return;
  replyButton.disabled = true;
  showError("");
  try {
    await readApiResponse(await fetch(`/api/conversations/${encodeURIComponent(selectedConversationId)}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ body })
    }));
    replyInput.value = "";
    messageSignature = "";
    await loadMessages();
    window.showToast("Reply sent.", "success");
    const { conversations: updated } = await readApiResponse(await fetch("/api/conversations"));
    conversations = updated;
    renderConversations();
  } catch (error) {
    showError(error.message || "Could not send your message.");
  } finally {
    replyButton.disabled = !selectedConversationId;
  }
});

window.addEventListener("pagehide", () => window.clearInterval(refreshTimer));
loadInbox();
