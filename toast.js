const toastKey = "garisafi.toast";

function showToast(message, type = "success") {
  if (!message) return;
  let container = document.querySelector("#toast-container");
  if (!container) {
    container = document.createElement("div");
    container.id = "toast-container";
    container.className = "toast-container";
    container.setAttribute("role", "region");
    container.setAttribute("aria-label", "Notifications");
    container.setAttribute("aria-live", "polite");
    document.body.append(container);
  }
  const duplicate = [...container.children].find(item => item.dataset.message === message && item.dataset.type === type);
  if (duplicate) return;

  const toast = document.createElement("div");
  toast.className = `toast toast-${type}`;
  toast.dataset.message = message;
  toast.dataset.type = type;
  toast.setAttribute("role", type === "error" ? "alert" : "status");
  const icon = document.createElement("span");
  icon.className = "toast-icon";
  icon.setAttribute("aria-hidden", "true");
  icon.textContent = type === "error" ? "!" : "✓";
  const text = document.createElement("span");
  text.className = "toast-text";
  text.textContent = message;
  const close = document.createElement("button");
  close.className = "toast-close";
  close.type = "button";
  close.setAttribute("aria-label", "Dismiss notification");
  close.textContent = "×";
  close.addEventListener("click", () => dismissToast(toast));
  toast.append(icon, text, close);
  container.append(toast);
  while (container.children.length > 4) dismissToast(container.firstElementChild);
  window.setTimeout(() => toast.classList.add("is-visible"), 20);
  window.setTimeout(() => dismissToast(toast), 4500);
}

function dismissToast(toast) {
  toast.classList.remove("is-visible");
  window.setTimeout(() => toast.remove(), 220);
}

window.showToast = showToast;

try {
  const notification = sessionStorage.getItem(toastKey);
  if (notification) {
    sessionStorage.removeItem(toastKey);
    const { message, type } = JSON.parse(notification);
    showToast(message, type);
  }
} catch (error) {
  console.error("Could not display the saved notification:", error);
}
