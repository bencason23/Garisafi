const maximumPhotoSize = 5 * 1024 * 1024;
const maximumPhotoCount = 10;
const minimumPhotoCount = 5;
const maximumPhotoTotal = 12 * 1024 * 1024;
const allowedPhotoTypes = ["image/jpeg", "image/png", "image/webp"];

const sellForm = document.querySelector("#sell-form");
const sellMessage = document.querySelector("#sell-message");
const photoInput = document.querySelector("#car-photos");
const photoPreview = document.querySelector("#upload-preview");
const listingSuccessLink = document.querySelector("#listing-success-link");
const carGrid = document.querySelector(".car-grid");
const carCount = document.querySelector("#car-count");
const inventoryMessage = document.querySelector("#inventory-message");
let previewUrls = [];

function clearPhotoPreviews() {
  for (const url of previewUrls) URL.revokeObjectURL(url);
  previewUrls = [];
  photoPreview.replaceChildren();
}

function showMessage(element, message, success = false) {
  if (!element) return;
  element.textContent = message;
  element.classList.toggle("success", success);
  if (message) window.showToast(message, success ? "success" : "error");
}

async function readApiResponse(response) {
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  return result;
}

function createCarCard(car) {
  const card = document.createElement("a");
  card.className = "car-card";
  card.href = `car.html?id=${encodeURIComponent(car.id)}`;
  card.setAttribute("aria-label", `View details for ${car.year} ${car.make} ${car.model}`);
  card.dataset.search = `${car.year} ${car.make} ${car.model} ${car.body} ${car.description || ""}`.toLowerCase();
  card.dataset.body = car.body;
  card.dataset.price = String(car.price);

  const imageLink = document.createElement("div");
  imageLink.className = "car-image";
  const image = document.createElement("img");
  image.src = car.photoUrl;
  image.alt = `${car.year} ${car.make} ${car.model}`;
  image.loading = "lazy";
  const tag = document.createElement("span");
  tag.className = "car-tag";
  tag.textContent = "GARISAFI LISTING";
  imageLink.append(image, tag);

  const details = document.createElement("div");
  details.className = "car-details";
  const titleRow = document.createElement("div");
  titleRow.className = "car-title-row";
  const title = document.createElement("div");
  const make = document.createElement("p");
  make.className = "car-make";
  make.textContent = car.make.toUpperCase();
  const model = document.createElement("h3");
  model.textContent = car.model;
  title.append(make, model);
  const price = document.createElement("p");
  price.className = "car-price";
  price.textContent = `KSh ${new Intl.NumberFormat("en-KE").format(car.price)}`;
  titleRow.append(title, price);

  const specs = document.createElement("p");
  specs.className = "car-specs";
  specs.textContent = `${car.year} · ${new Intl.NumberFormat("en-KE").format(car.mileage)} km · ${car.body}`;
  const footer = document.createElement("div");
  footer.className = "car-footer";
  footer.innerHTML = '<span><i class="status-dot"></i> Available now</span><span>GariSafi listing</span>';
  details.append(titleRow, specs, footer);
  card.append(imageLink, details);
  return card;
}

function filterCars() {
  if (!carGrid) return;
  const searchTerms = document.querySelector("#car-search").value.trim().toLowerCase().split(/\s+/).filter(Boolean);
  const bodyStyle = document.querySelector('select[aria-label="Vehicle type"]').value;
  const priceRange = document.querySelector('select[aria-label="Price range"]').value;
  let visible = 0;
  for (const card of carGrid.querySelectorAll(".car-card")) {
    const price = Number(card.dataset.price);
    const matchesSearch = searchTerms.every(term => card.dataset.search.includes(term));
    const matchesBody = !bodyStyle || card.dataset.body === bodyStyle;
    const matchesPrice = priceRange === "any"
      || (priceRange === "under-3000000" && price < 3000000)
      || (priceRange === "3000000-7000000" && price >= 3000000 && price <= 7000000)
      || (priceRange === "7000000-10000000" && price > 7000000 && price <= 10000000)
      || (priceRange === "over-10000000" && price > 10000000);
    card.hidden = !(matchesSearch && matchesBody && matchesPrice);
    if (!card.hidden) visible += 1;
  }
  carCount.textContent = `${visible} ${visible === 1 ? "car" : "cars"} ${visible ? "ready to go" : "found"}`;
}

async function loadCars() {
  try {
    const { cars } = await readApiResponse(await fetch("/api/cars"));
    if (!Array.isArray(cars)) throw new Error("The marketplace returned an invalid car list.");
    carGrid.replaceChildren(...cars.map(createCarCard));
    showMessage(inventoryMessage, cars.length ? "" : "No cars are listed yet. Check back soon.");
    filterCars();
  } catch (error) {
    carCount.textContent = "Cars unavailable";
    showMessage(inventoryMessage, `${error.message} Please check that the GariSafi server is running.`);
  }
}

if (carGrid) {
  const searchInput = document.querySelector("#car-search");
  const bodyFilter = document.querySelector('select[aria-label="Vehicle type"]');
  const priceFilter = document.querySelector('select[aria-label="Price range"]');
  const trackCarSearch = () => window.trackMarketplaceSearch("cars", {
    query: searchInput.value,
    category: bodyFilter.value,
    priceRange: priceFilter.value
  });
  document.querySelector(".filter-button").addEventListener("click", () => {
    filterCars();
    trackCarSearch();
  });
  searchInput.addEventListener("input", filterCars);
  searchInput.addEventListener("keydown", event => {
    if (event.key === "Enter") trackCarSearch();
  });
  bodyFilter.addEventListener("change", () => {
    filterCars();
    trackCarSearch();
  });
  priceFilter.addEventListener("change", () => {
    filterCars();
    trackCarSearch();
  });
  loadCars();
}

if (sellForm) {
  photoInput.addEventListener("change", () => {
    showMessage(sellMessage, "");
    listingSuccessLink.hidden = true;
    const files = [...photoInput.files];
    if (files.some(file => !allowedPhotoTypes.includes(file.type) || file.size > maximumPhotoSize)) {
      photoInput.value = "";
      clearPhotoPreviews();
      showMessage(sellMessage, "Use JPG, PNG or WebP photos, each smaller than 5 MB.");
      return;
    }
    if (files.length > maximumPhotoCount) {
      photoInput.value = "";
      clearPhotoPreviews();
      showMessage(sellMessage, `Choose no more than ${maximumPhotoCount} car photos.`);
      return;
    }
    if (files.reduce((total, file) => total + file.size, 0) > maximumPhotoTotal) {
      photoInput.value = "";
      clearPhotoPreviews();
      showMessage(sellMessage, "All car photos combined must be 12 MB or smaller.");
      return;
    }
    clearPhotoPreviews();
    for (const [index, file] of files.entries()) {
      const url = URL.createObjectURL(file);
      previewUrls.push(url);
      const image = document.createElement("img");
      image.src = url;
      image.alt = `Preview of car photo ${index + 1}`;
      photoPreview.append(image);
    }
    if (files.length && files.length < minimumPhotoCount) {
      showMessage(sellMessage, `Select at least ${minimumPhotoCount} photos (${files.length} selected so far).`);
    }
  });

  sellForm.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage(sellMessage, "");
    listingSuccessLink.hidden = true;
    const photos = [...photoInput.files];
    if (photos.length < minimumPhotoCount || photos.length > maximumPhotoCount) {
      showMessage(sellMessage, `Choose between ${minimumPhotoCount} and ${maximumPhotoCount} car photos.`);
      return;
    }
    if (photos.some(photo => !allowedPhotoTypes.includes(photo.type) || photo.size > maximumPhotoSize)) {
      showMessage(sellMessage, "Use JPG, PNG or WebP photos, each smaller than 5 MB.");
      return;
    }
    if (photos.reduce((total, photo) => total + photo.size, 0) > maximumPhotoTotal) {
      showMessage(sellMessage, "All car photos combined must be 12 MB or smaller.");
      return;
    }
    const year = Number(sellForm.elements.year.value);
    const price = Number(sellForm.elements.price.value);
    const mileage = Number(sellForm.elements.mileage.value);
    const phone = sellForm.elements.sellerPhone.value.replace(/[\s()-]/g, "");
    if (year < 1950 || year > new Date().getFullYear() || price < 1000 || mileage < 0
      || !/^\+[1-9]\d{7,14}$/.test(phone) || !sellForm.elements.description.value.trim()) {
      showMessage(sellMessage, "Check the year, mileage, price, description, and international phone number.");
      return;
    }

    try {
      const response = await fetch("/api/cars", {
        method: "POST",
        body: new FormData(sellForm)
      });
      if (response.status === 401) {
        window.location.assign("login.html?returnTo=sell.html");
        return;
      }
      const { car } = await readApiResponse(response);
      sellForm.reset();
      clearPhotoPreviews();
      showMessage(sellMessage, "Your car has been added to the GariSafi marketplace.", true);
      listingSuccessLink.href = `car.html?id=${encodeURIComponent(car.id)}`;
      listingSuccessLink.textContent = "View your car listing →";
      listingSuccessLink.hidden = false;
    } catch (error) {
      showMessage(sellMessage, error.message || "Could not save your car listing.");
    }
  });
}
