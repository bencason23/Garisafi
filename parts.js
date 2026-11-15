const partGrid = document.querySelector("#parts-grid");
const partCount = document.querySelector("#part-count");
const partsMessage = document.querySelector("#parts-message");
let listedParts = [];
let currentUserId = "";

function showMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
  if (message) window.showToast(message, success ? "success" : "error");
}

async function readApiResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function createPartCard(part) {
  const card = document.createElement("article");
  card.className = "part-card";
  card.dataset.search = `${part.title} ${part.category} ${part.compatibleVehicles || ""} ${part.sellerName}`.toLowerCase();
  card.dataset.category = part.category;

  const openDetails = document.createElement("a");
  openDetails.className = "part-card-open";
  openDetails.href = `part.html?id=${encodeURIComponent(part.id)}`;
  openDetails.setAttribute("aria-label", `View full details for ${part.title}`);
  const image = document.createElement("img");
  image.className = "part-image";
  image.src = part.photoUrl;
  image.alt = part.title;
  image.loading = "lazy";

  const content = document.createElement("div");
  content.className = "part-card-content";
  const label = document.createElement("div");
  label.className = "part-label-row";
  const category = document.createElement("span");
  category.className = "part-category";
  category.textContent = part.category;
  const condition = document.createElement("span");
  condition.className = "part-condition";
  condition.textContent = part.condition;
  label.append(category, condition);

  const title = document.createElement("h3");
  title.textContent = part.title;
  const compatibility = document.createElement("p");
  compatibility.className = "part-compatibility";
  compatibility.textContent = part.compatibleVehicles ? `Fits: ${part.compatibleVehicles}` : "Vehicle compatibility not specified";
  const description = document.createElement("p");
  description.className = "part-description";
  description.textContent = part.description;
  const price = document.createElement("p");
  price.className = "part-price";
  price.textContent = `KSh ${new Intl.NumberFormat("en-KE").format(part.price)}`;
  const detailsHint = document.createElement("p");
  detailsHint.className = "part-details-hint";
  detailsHint.textContent = "Click to view full details →";
  const footer = document.createElement("div");
  footer.className = "part-card-footer";
  const seller = document.createElement("span");
  seller.textContent = `Seller: ${part.sellerName}`;
  footer.append(seller);
  if (part.sellerId && part.sellerId === currentUserId) {
    const ownListing = document.createElement("span");
    ownListing.className = "part-own-listing";
    ownListing.textContent = "Your listing";
    footer.append(ownListing);
  } else {
    const contact = document.createElement("a");
    contact.className = "button button-dark part-contact";
    contact.href = `part.html?id=${encodeURIComponent(part.id)}#contact`;
    contact.textContent = "Contact seller";
    footer.append(contact);
  }
  content.append(label, title, compatibility, description, price, detailsHint);
  openDetails.append(image, content);
  card.append(openDetails, footer);
  return card;
}

function renderParts() {
  const search = document.querySelector("#part-search").value.trim().toLowerCase();
  const selectedCategory = document.querySelector("#part-category").value;
  const visibleParts = listedParts.filter(part => {
    const matchesText = `${part.title} ${part.category} ${part.compatibleVehicles || ""} ${part.sellerName}`.toLowerCase().includes(search);
    return matchesText && (!selectedCategory || selectedCategory === part.category);
  });
  partGrid.replaceChildren(...visibleParts.map(createPartCard));
  partCount.textContent = `${visibleParts.length} ${visibleParts.length === 1 ? "part" : "parts"} ${visibleParts.length ? "available" : "found"}`;
  showMessage(partsMessage, listedParts.length && !visibleParts.length ? "No parts match your search. Try another term or category." : "");
}

async function loadParts() {
  try {
    const [partsResult, meResponse] = await Promise.all([fetch("/api/parts"), fetch("/api/auth/me")]);
    const { parts } = await readApiResponse(partsResult);
    if (!Array.isArray(parts)) throw new Error("The marketplace returned an invalid parts list.");
    if (meResponse.ok) {
      const { user } = await readApiResponse(meResponse);
      currentUserId = user.id;
    } else if (meResponse.status !== 401) {
      await readApiResponse(meResponse);
    }
    listedParts = parts;
    renderParts();
  } catch (error) {
    partCount.textContent = "Parts unavailable";
    showMessage(partsMessage, `${error.message} Please check that the GariSafi server is running.`);
  }
}

const partSearchInput = document.querySelector("#part-search");
const partCategoryFilter = document.querySelector("#part-category");
const trackPartSearch = () => window.trackMarketplaceSearch("parts", {
  query: partSearchInput.value,
  category: partCategoryFilter.value,
  priceRange: ""
});

document.querySelector("#part-search-button").addEventListener("click", () => {
  renderParts();
  trackPartSearch();
});
partSearchInput.addEventListener("input", renderParts);
partSearchInput.addEventListener("keydown", event => {
  if (event.key === "Enter") trackPartSearch();
});
partCategoryFilter.addEventListener("change", () => {
  renderParts();
  trackPartSearch();
});
loadParts();
