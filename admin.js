const adminAlert = document.querySelector("#admin-alert");
const pageTitle = document.querySelector("#page-title");
const views = [...document.querySelectorAll(".admin-view")];
const navLinks = [...document.querySelectorAll(".admin-nav-link[data-view]")];
const listingRows = document.querySelector("#listing-rows");
const memberRows = document.querySelector("#member-rows");
const conversationRows = document.querySelector("#conversation-rows");
const listingHead = document.querySelector("#listing-head");
const listingSearch = document.querySelector("#listing-search");
const memberSearch = document.querySelector("#member-search");
const conversationSearch = document.querySelector("#conversation-search");
const messageDialog = document.querySelector("#message-dialog");
const messageList = document.querySelector("#message-list");
const collectionState = {
  cars: { page: 1, pages: 0, total: 0, request: 0 },
  parts: { page: 1, pages: 0, total: 0, request: 0 },
  users: { page: 1, pages: 0, total: 0, request: 0 },
  conversations: { page: 1, pages: 0, total: 0, request: 0 }
};
const pageSize = 25;
const messageState = { conversationId: "", page: 1, pages: 0, request: 0 };
let activeListingType = "cars";
let searchTimer;

function showAdminError(message, linkUrl, linkLabel) {
  adminAlert.replaceChildren(document.createTextNode(`${message} `));
  if (linkUrl && linkLabel) {
    const link = document.createElement("a");
    link.href = linkUrl;
    link.textContent = linkLabel;
    link.className = "admin-alert-link";
    adminAlert.append(link);
  }
  adminAlert.hidden = false;
}

function showAdminAccessError(status) {
  if (status === 503) {
    showAdminError(
      "Admin access is not configured. Add ADMIN_EMAIL=your-account-email to .env, restart the app, and sign in with that account."
    );
    return true;
  }
  if (status === 403) {
    showAdminError(
      "This account is not an administrator. Set ADMIN_EMAIL in .env to the email used by your account, restart the app, then sign in again."
    );
    return true;
  }
  return false;
}

function formatPrice(value) {
  return new Intl.NumberFormat("en-KE", {
    style: "currency",
    currency: "KES",
    maximumFractionDigits: 0
  }).format(value);
}

function formatDate(value) {
  return value ? new Intl.DateTimeFormat("en-KE", { dateStyle: "medium" }).format(new Date(value)) : "—";
}

function formatDateTime(value) {
  return value ? new Intl.DateTimeFormat("en-KE", { dateStyle: "medium", timeStyle: "short" }).format(new Date(value)) : "—";
}

function initials(value = "") {
  return value.trim().split(/\s+/).slice(0, 2).map(part => part[0] || "").join("").toUpperCase() || "G";
}

function textCell(value) {
  const cell = document.createElement("td");
  cell.textContent = value || "—";
  return cell;
}

function appendMessageRow(tableBody, message, columns) {
  const row = document.createElement("tr");
  const cell = document.createElement("td");
  cell.className = "table-message";
  cell.colSpan = columns;
  cell.textContent = message;
  row.append(cell);
  tableBody.replaceChildren(row);
}

function updatePagination(element, state, onPageChange, noun) {
  element.replaceChildren();
  const summary = document.createElement("span");
  summary.className = "pagination-summary";
  const first = state.total ? (state.page - 1) * pageSize + 1 : 0;
  const last = Math.min(state.page * pageSize, state.total);
  summary.textContent = `Showing ${first}–${last} of ${state.total.toLocaleString()} ${noun}`;

  const buttons = document.createElement("div");
  buttons.className = "pagination-buttons";
  for (const [label, page, disabled] of [
    ["Previous", state.page - 1, state.page <= 1],
    ["Next", state.page + 1, state.page >= state.pages]
  ]) {
    const button = document.createElement("button");
    button.className = "page-button";
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", () => onPageChange(page));
    buttons.append(button);
  }
  element.append(summary, buttons);
}

function makeRecentCar(car) {
  const row = document.createElement("div");
  row.className = "recent-row";
  if (car.photoUrl) {
    const image = document.createElement("img");
    image.className = "recent-thumb";
    image.src = car.photoUrl;
    image.alt = "";
    image.loading = "lazy";
    row.append(image);
  }
  const copy = document.createElement("div");
  copy.className = "recent-copy";
  const title = document.createElement("strong");
  title.textContent = `${car.year} ${car.make} ${car.model}`;
  const seller = document.createElement("span");
  seller.textContent = car.seller?.name || "GariSafi seller";
  copy.append(title, seller);
  const price = document.createElement("span");
  price.className = "recent-price";
  price.textContent = formatPrice(car.price);
  row.append(copy, price);
  return row;
}

function makeListingCell(titleText, subtitle, imageUrl, type = "part") {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  wrapper.className = `listing-cell listing-cell-${type}`;
  if (imageUrl) {
    const image = document.createElement("img");
    image.className = `listing-thumb listing-thumb-${type}`;
    image.src = imageUrl;
    image.alt = "";
    image.loading = "lazy";
    wrapper.append(image);
  }
  const copy = document.createElement("div");
  const title = document.createElement("div");
  title.className = "listing-title";
  title.textContent = titleText;
  const detail = document.createElement("div");
  detail.className = "listing-subtitle";
  detail.textContent = subtitle;
  copy.append(title, detail);
  wrapper.append(copy);
  cell.append(wrapper);
  return cell;
}

function makeMemberCell(user) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  wrapper.className = "member-cell";
  const avatar = document.createElement("span");
  avatar.className = "member-avatar";
  avatar.textContent = initials(user.name);
  const name = document.createElement("strong");
  name.textContent = user.name;
  wrapper.append(avatar, name);
  cell.append(wrapper);
  return cell;
}

function makeActionCell(kind, item) {
  const cell = document.createElement("td");
  const button = document.createElement("button");
  button.className = "row-action";
  button.type = "button";
  button.textContent = "Remove";
  button.setAttribute("aria-label", `Remove ${kind === "cars" ? "car" : "spare-part"} listing`);
  button.addEventListener("click", () => removeListing(kind, item));
  cell.append(button);
  return cell;
}

function makeViewMessagesCell(conversation) {
  const cell = document.createElement("td");
  const button = document.createElement("button");
  button.className = "row-action message-action";
  button.type = "button";
  button.textContent = "View messages";
  button.addEventListener("click", () => openConversation(conversation));
  cell.append(button);
  return cell;
}

function updateListingHeader() {
  const headerRow = document.createElement("tr");
  for (const heading of ["LISTING", "SELLER", "PRICE", "DATE ADDED", ""]) {
    const header = document.createElement("th");
    header.textContent = heading;
    headerRow.append(header);
  }
  listingHead.replaceChildren(headerRow);
}

function renderListings(items) {
  const isCar = activeListingType === "cars";
  if (!items.length) {
    appendMessageRow(listingRows, collectionState[activeListingType].total ? "No listings match your search." : "No listings to show yet.", 5);
    return;
  }
  const rows = items.map(item => {
    const row = document.createElement("tr");
    if (isCar) {
      row.className = "car-listing-row";
      row.append(
        makeListingCell(`${item.year} ${item.make} ${item.model}`, `${item.body} · ${item.mileage.toLocaleString()} km`, item.photoUrl, "car"),
        textCell(item.seller?.name),
        textCell(formatPrice(item.price)),
        textCell(formatDate(item.createdAt)),
        makeActionCell("cars", item)
      );
    } else {
      row.append(
        makeListingCell(item.title, `${item.category} · ${item.condition}`, item.photoUrl),
        textCell(item.sellerName),
        textCell(formatPrice(item.price)),
        textCell(formatDate(item.createdAt)),
        makeActionCell("parts", item)
      );
    }
    return row;
  });
  listingRows.replaceChildren(...rows);
}

function renderMembers(items) {
  if (!items.length) {
    appendMessageRow(memberRows, collectionState.users.total ? "No members match your search." : "No members to show yet.", 5);
    return;
  }
  const rows = items.map(user => {
    const row = document.createElement("tr");
    row.append(makeMemberCell(user), textCell(user.email), textCell(formatDate(user.createdAt)));
    const status = document.createElement("td");
    const pill = document.createElement("span");
    pill.className = user.isBlocked ? "status-pill status-pill-blocked" : "status-pill";
    pill.textContent = user.isBlocked ? "Blocked" : "Active";
    status.append(pill);
    row.append(status);
    const actions = document.createElement("td");
    const blockButton = document.createElement("button");
    blockButton.className = user.isBlocked ? "row-action user-action user-action-unblock" : "row-action user-action";
    blockButton.type = "button";
    blockButton.textContent = user.isBlocked ? "Unblock" : "Block";
    blockButton.setAttribute("aria-label", `${user.isBlocked ? "Unblock" : "Block"} ${user.name}`);
    blockButton.addEventListener("click", () => updateMemberBlock(user));
    const removeButton = document.createElement("button");
    removeButton.className = "row-action user-action user-action-remove";
    removeButton.type = "button";
    removeButton.textContent = "Remove";
    removeButton.setAttribute("aria-label", `Remove ${user.name}`);
    removeButton.addEventListener("click", () => removeMember(user));
    actions.append(blockButton, removeButton);
    row.append(actions);
    return row;
  });
  memberRows.replaceChildren(...rows);
}

function renderConversations(items) {
  if (!items.length) {
    appendMessageRow(conversationRows, collectionState.conversations.total ? "No conversations match your search." : "No conversations to show yet.", 6);
    return;
  }
  const rows = items.map(conversation => {
    const row = document.createElement("tr");
    row.append(
      textCell(conversation.car),
      textCell(conversation.buyer ? `${conversation.buyer.name} · ${conversation.buyer.email}` : "Account unavailable"),
      textCell(conversation.seller ? `${conversation.seller.name} · ${conversation.seller.email}` : "Account unavailable"),
      textCell(conversation.messageCount.toLocaleString()),
      textCell(formatDateTime(conversation.lastMessageAt)),
      makeViewMessagesCell(conversation)
    );
    return row;
  });
  conversationRows.replaceChildren(...rows);
}

function renderCollection(collection, result) {
  const state = collectionState[collection];
  if ((result.pagination.pages && result.pagination.page > result.pagination.pages)
    || (!result.pagination.pages && result.pagination.page > 1)) {
    loadCollection(collection, result.pagination.pages || 1);
    return;
  }
  state.page = result.pagination.page;
  state.pages = result.pagination.pages;
  state.total = result.pagination.total;

  if (collection === "cars" || collection === "parts") {
    renderListings(result.items);
    updatePagination(document.querySelector("#listing-pagination"), state, page => loadCollection(collection, page), "listings");
  } else if (collection === "users") {
    renderMembers(result.items);
    updatePagination(document.querySelector("#member-pagination"), state, page => loadCollection(collection, page), "members");
  } else {
    renderConversations(result.items);
    updatePagination(document.querySelector("#conversation-pagination"), state, page => loadCollection(collection, page), "conversations");
  }
}

async function loadCollection(collection, page = collectionState[collection].page) {
  const state = collectionState[collection];
  const requestId = ++state.request;
  const search = collection === "cars" || collection === "parts"
    ? listingSearch.value.trim()
    : collection === "users" ? memberSearch.value.trim() : conversationSearch.value.trim();
  const rows = collection === "cars" || collection === "parts"
    ? listingRows
    : collection === "users" ? memberRows : conversationRows;
  const columns = collection === "cars" || collection === "parts" ? 5 : collection === "users" ? 5 : 6;
  appendMessageRow(rows, "Loading records from the database…", columns);
  const url = new URL(`/api/admin/data/${collection}`, window.location.origin);
  url.searchParams.set("page", String(page));
  if (search) url.searchParams.set("search", search);
  try {
    const response = await fetch(url);
    const result = await response.json().catch(() => ({}));
    if (requestId !== state.request) return;
    if (response.status === 401) {
      window.location.assign("login.html?returnTo=admin.html");
      return;
    }
    if (showAdminAccessError(response.status)) {
      appendMessageRow(rows, result.error || "Admin access is unavailable.", columns);
      return;
    }
    if (!response.ok) throw new Error(result.error || "Could not load database records.");
    adminAlert.hidden = true;
    renderCollection(collection, result);
  } catch (error) {
    if (requestId !== state.request) return;
    appendMessageRow(rows, error.message || "Could not load database records.", columns);
    showAdminError(error.message || "Could not load database records.");
  }
}

function setView(name) {
  for (const view of views) view.hidden = view.dataset.panel !== name;
  for (const link of navLinks) {
    const active = link.dataset.view === name;
    link.classList.toggle("is-active", active);
    if (active) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  }
  pageTitle.textContent = name === "overview" ? "Overview"
    : name === "listings" ? "Listings"
      : name === "members" ? "Members" : "Conversations";
  adminAlert.hidden = true;
  if (name === "listings") loadCollection(activeListingType);
  if (name === "members") loadCollection("users");
  if (name === "conversations") loadCollection("conversations");
}

function setListingType(type) {
  activeListingType = type;
  for (const button of document.querySelectorAll("[data-listing-type]")) {
    const active = button.dataset.listingType === type;
    button.classList.toggle("is-active", active);
    button.setAttribute("aria-pressed", String(active));
  }
  collectionState[type].page = 1;
  updateListingHeader();
  loadCollection(type, 1);
}

function renderDashboard(data) {
  document.querySelector("#admin-name").textContent = data.admin.name;
  document.querySelector("#admin-email").textContent = data.admin.email;
  document.querySelector("#admin-avatar").textContent = initials(data.admin.name);
  document.querySelector("#welcome-name").textContent = data.admin.name.split(/\s+/)[0];
  document.querySelector("#stat-users").textContent = data.stats.users.toLocaleString();
  document.querySelector("#stat-cars").textContent = data.stats.cars.toLocaleString();
  document.querySelector("#stat-parts").textContent = data.stats.parts.toLocaleString();
  document.querySelector("#stat-conversations").textContent = data.stats.conversations.toLocaleString();
  document.querySelector("#stat-messages").textContent = data.stats.messages.toLocaleString();
  document.querySelector("#snapshot-cars").textContent = data.stats.cars.toLocaleString();
  document.querySelector("#snapshot-parts").textContent = data.stats.parts.toLocaleString();
  document.querySelector("#car-tab-count").textContent = data.stats.cars.toLocaleString();
  document.querySelector("#part-tab-count").textContent = data.stats.parts.toLocaleString();
  const recentCars = document.querySelector("#recent-cars");
  if (data.cars.length) recentCars.replaceChildren(...data.cars.map(makeRecentCar));
  else {
    const empty = document.createElement("p");
    empty.className = "table-message";
    empty.textContent = "No car listings yet.";
    recentCars.replaceChildren(empty);
  }
}

function renderSearchRankings(element, searches, market) {
  if (!searches.length) {
    const empty = document.createElement("p");
    empty.className = "analytics-empty";
    empty.textContent = "No searches recorded for this period yet.";
    element.replaceChildren(empty);
    return;
  }
  const maximum = searches[0].count;
  const rows = searches.map((search, index) => {
    const row = document.createElement("article");
    row.className = "ranking-row";
    const rank = document.createElement("span");
    rank.className = "ranking-position";
    rank.textContent = String(index + 1).padStart(2, "0");
    const details = document.createElement("div");
    details.className = "ranking-details";
    const heading = document.createElement("div");
    heading.className = "ranking-title-row";
    const term = document.createElement("strong");
    term.textContent = search.query || search.category || (market === "cars" ? "All cars" : "All spare parts");
    const count = document.createElement("span");
    count.className = "ranking-count";
    count.textContent = `${search.count.toLocaleString()} ${search.count === 1 ? "search" : "searches"}`;
    heading.append(term, count);
    const filters = [search.category, search.priceRange ? formatPriceRange(search.priceRange) : ""].filter(Boolean);
    if (filters.length) {
      const subtitle = document.createElement("span");
      subtitle.className = "ranking-subtitle";
      subtitle.textContent = filters.join(" · ");
      details.append(heading, subtitle);
    } else {
      details.append(heading);
    }
    const track = document.createElement("div");
    track.className = "ranking-track";
    const fill = document.createElement("span");
    fill.className = market === "cars" ? "ranking-fill ranking-fill-car" : "ranking-fill ranking-fill-part";
    fill.style.width = `${Math.max(7, search.count / maximum * 100)}%`;
    track.append(fill);
    details.append(track);
    row.append(rank, details);
    return row;
  });
  element.replaceChildren(...rows);
}

function formatPriceRange(value) {
  const labels = {
    "under-3000000": "Under KSh 3M",
    "3000000-7000000": "KSh 3M–7M",
    "7000000-10000000": "KSh 7M–10M",
    "over-10000000": "Over KSh 10M"
  };
  return labels[value] || "";
}

async function loadSearchAnalytics(days = document.querySelector("#analytics-period").value) {
  const carRankings = document.querySelector("#car-search-rankings");
  const partRankings = document.querySelector("#part-search-rankings");
  const requestId = (loadSearchAnalytics.requestId || 0) + 1;
  loadSearchAnalytics.requestId = requestId;
  for (const element of [carRankings, partRankings]) {
    const loading = document.createElement("p");
    loading.className = "table-message";
    loading.textContent = "Loading search insights…";
    element.replaceChildren(loading);
  }
  try {
    const response = await fetch(`/api/admin/analytics?days=${encodeURIComponent(days)}`);
    const result = await response.json().catch(() => ({}));
    if (requestId !== loadSearchAnalytics.requestId) return;
    if (response.status === 401) {
      window.location.assign("login.html?returnTo=admin.html");
      return;
    }
    if (showAdminAccessError(response.status)) return;
    if (!response.ok) throw new Error(result.error || "Could not load search analytics.");
    document.querySelector("#analytics-total").textContent = result.total.toLocaleString();
    renderSearchRankings(carRankings, result.searches.cars, "cars");
    renderSearchRankings(partRankings, result.searches.parts, "parts");
  } catch (error) {
    if (requestId !== loadSearchAnalytics.requestId) return;
    for (const element of [carRankings, partRankings]) {
      const failure = document.createElement("p");
      failure.className = "analytics-empty";
      failure.textContent = error.message || "Could not load search insights.";
      element.replaceChildren(failure);
    }
    showAdminError(error.message || "Could not load search analytics.");
  }
}

async function loadDashboard() {
  if (window.location.protocol === "file:") {
    showAdminError(
      "This file preview cannot connect to MongoDB. Start the GariSafi app, then open the admin dashboard through its local server.",
      "http://localhost:3000/admin.html",
      "Open the local admin site"
    );
    return;
  }
  try {
    const response = await fetch("/api/admin/dashboard");
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) {
      window.location.assign("login.html?returnTo=admin.html");
      return;
    }
    if (showAdminAccessError(response.status)) return;
    if (!response.ok) throw new Error(result.error || "Could not load the admin dashboard.");
    renderDashboard(result);
    loadSearchAnalytics();
  } catch (error) {
    showAdminError(
      "Could not reach the GariSafi server. Start it with npm.cmd start, then reopen the admin dashboard.",
      "http://localhost:3000/admin.html",
      "Retry the local admin site"
    );
  }
}

async function removeListing(kind, item) {
  const title = kind === "cars" ? `${item.year} ${item.make} ${item.model}` : item.title;
  if (!window.confirm(`Remove "${title}" from the marketplace? This cannot be undone.`)) return;
  try {
    const response = await fetch(`/api/admin/${kind}/${encodeURIComponent(item.id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not remove this listing.");
    window.showToast("Listing removed from the marketplace.", "success");
    await Promise.all([loadDashboard(), loadCollection(kind)]);
  } catch (error) {
    window.showToast(error.message || "Could not remove this listing.", "error");
  }
}

async function updateMemberBlock(user) {
  const isBlocked = !user.isBlocked;
  const action = isBlocked ? "Block" : "Unblock";
  if (!window.confirm(`${action} ${user.name}'s account? ${isBlocked ? "They will be unable to access any pages or account features while blocked." : "They will be able to access the site and their account again."}`)) return;
  try {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ isBlocked })
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || `Could not ${action.toLowerCase()} this account.`);
    window.showToast(`${user.name}'s account has been ${isBlocked ? "blocked" : "unblocked"}.`, "success");
    await loadCollection("users");
  } catch (error) {
    window.showToast(error.message || `Could not ${action.toLowerCase()} this account.`, "error");
  }
}

async function removeMember(user) {
  const confirmed = window.confirm(
    `Permanently remove ${user.name} (${user.email})? Their listings and conversation history will stay on the site, but seller/buyer/sender account references will be detached. This cannot be undone.`
  );
  if (!confirmed) return;
  try {
    const response = await fetch(`/api/admin/users/${encodeURIComponent(user.id)}`, { method: "DELETE" });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || "Could not remove this account.");
    window.showToast(`${user.name}'s account was removed. Related listings and conversation history were kept.`, "success");
    await Promise.all([loadDashboard(), loadCollection("users")]);
  } catch (error) {
    window.showToast(error.message || "Could not remove this account.", "error");
  }
}

function renderMessages(messages) {
  if (!messages.length) {
    const empty = document.createElement("p");
    empty.className = "message-empty";
    empty.textContent = "This conversation has no messages.";
    messageList.replaceChildren(empty);
    return;
  }
  const entries = messages.map(message => {
    const article = document.createElement("article");
    article.className = "message-entry";
    const heading = document.createElement("div");
    heading.className = "message-entry-heading";
    const sender = document.createElement("strong");
    sender.textContent = message.senderName || "Account unavailable";
    const time = document.createElement("time");
    time.dateTime = message.createdAt;
    time.textContent = formatDateTime(message.createdAt);
    heading.append(sender, time);
    const body = document.createElement("p");
    body.textContent = message.body;
    article.append(heading, body);
    return article;
  });
  messageList.replaceChildren(...entries);
}

function updateMessagePagination(pagination) {
  const element = document.querySelector("#message-pagination");
  element.replaceChildren();
  const summary = document.createElement("span");
  summary.className = "pagination-summary";
  const first = pagination.total ? (pagination.page - 1) * pagination.pageSize + 1 : 0;
  const last = Math.min(pagination.page * pagination.pageSize, pagination.total);
  summary.textContent = `Showing ${first}–${last} of ${pagination.total.toLocaleString()} messages`;
  const buttons = document.createElement("div");
  buttons.className = "pagination-buttons";
  for (const [label, page, disabled] of [
    ["Previous", pagination.page - 1, pagination.page <= 1],
    ["Next", pagination.page + 1, pagination.page >= pagination.pages]
  ]) {
    const button = document.createElement("button");
    button.className = "page-button";
    button.type = "button";
    button.textContent = label;
    button.disabled = disabled;
    button.addEventListener("click", () => loadConversationMessages(page));
    buttons.append(button);
  }
  element.append(summary, buttons);
}

async function loadConversationMessages(page = messageState.page) {
  const requestId = ++messageState.request;
  messageState.page = page;
  messageList.replaceChildren();
  const loading = document.createElement("p");
  loading.className = "message-empty";
  loading.textContent = "Loading messages…";
  messageList.append(loading);
  try {
    const response = await fetch(`/api/admin/conversations/${encodeURIComponent(messageState.conversationId)}/messages?page=${page}`);
    const result = await response.json().catch(() => ({}));
    if (requestId !== messageState.request) return;
    if (response.status === 401) {
      window.location.assign("login.html?returnTo=admin.html");
      return;
    }
    if (!response.ok) throw new Error(result.error || "Could not load conversation messages.");
    renderMessages(result.messages);
    updateMessagePagination(result.pagination);
  } catch (error) {
    if (requestId !== messageState.request) return;
    const message = document.createElement("p");
    message.className = "message-empty";
    message.textContent = error.message || "Could not load conversation messages.";
    messageList.replaceChildren(message);
  }
}

function openConversation(conversation) {
  messageState.conversationId = conversation.id;
  messageState.page = 1;
  document.querySelector("#message-dialog-title").textContent = conversation.car;
  document.querySelector("#message-dialog-meta").textContent =
    `${conversation.buyer?.name || "Buyer"} ↔ ${conversation.seller?.name || "Seller"}`;
  messageDialog.showModal();
  loadConversationMessages(1);
}

function scheduleSearch(collection) {
  window.clearTimeout(searchTimer);
  searchTimer = window.setTimeout(() => {
    collectionState[collection].page = 1;
    loadCollection(collection, 1);
  }, 250);
}

for (const link of navLinks) link.addEventListener("click", () => setView(link.dataset.view));
for (const button of document.querySelectorAll("[data-open-view]")) {
  button.addEventListener("click", () => setView(button.dataset.openView));
}
for (const button of document.querySelectorAll("[data-listing-type]")) {
  button.addEventListener("click", () => setListingType(button.dataset.listingType));
}
listingSearch.addEventListener("input", () => scheduleSearch(activeListingType));
memberSearch.addEventListener("input", () => scheduleSearch("users"));
conversationSearch.addEventListener("input", () => scheduleSearch("conversations"));
document.querySelector("#message-dialog-close").addEventListener("click", () => messageDialog.close());
document.querySelector("#analytics-period").addEventListener("change", event => loadSearchAnalytics(event.currentTarget.value));
messageDialog.addEventListener("click", event => {
  if (event.target === messageDialog) messageDialog.close();
});
document.querySelector("#logout-button").addEventListener("click", async event => {
  const button = event.currentTarget;
  button.disabled = true;
  try {
    const response = await fetch("/api/auth/logout", { method: "POST" });
    if (!response.ok) throw new Error("Could not sign out. Please try again.");
    window.location.assign("index.html");
  } catch (error) {
    button.disabled = false;
    window.showToast(error.message, "error");
  }
});

updateListingHeader();
loadDashboard();
