const menuToggle = document.querySelector(".menu-toggle");
const siteMenu = document.querySelector("#site-menu");
const menuAccountLink = document.querySelector(".menu-account");

function closeMenu() {
  if (!menuToggle || !siteMenu) return;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Open menu");
  siteMenu.hidden = true;
  siteMenu.classList.remove("is-open");
}

function showMenuError(message) {
  const error = document.querySelector("#menu-message");
  if (error) {
    error.textContent = message;
    error.hidden = false;
  }
  window.showToast(message, "error");
}

function setSignedIn(user) {
  if (!menuAccountLink) return;
  menuAccountLink.textContent = user ? `Hi, ${user.name.split(" ")[0]} · Sign out` : "Sign in";
  menuAccountLink.href = user ? "#sign-out" : "login.html";
  if (user) menuAccountLink.dataset.menuSignOut = "";
  else delete menuAccountLink.dataset.menuSignOut;
  const registerLink = document.querySelector(".menu-register");
  if (registerLink) registerLink.hidden = Boolean(user);
  const messagesLink = document.querySelector(".menu-messages");
  if (messagesLink) messagesLink.hidden = !user;
}

if (menuToggle && siteMenu) {
  menuToggle.addEventListener("click", () => {
    const opening = menuToggle.getAttribute("aria-expanded") !== "true";
    menuToggle.setAttribute("aria-expanded", String(opening));
    menuToggle.setAttribute("aria-label", opening ? "Close menu" : "Open menu");
    siteMenu.hidden = !opening;
    siteMenu.classList.toggle("is-open", opening);
    const error = document.querySelector("#menu-message");
    if (error) {
      error.textContent = "";
      error.hidden = true;
    }
  });

  document.addEventListener("click", event => {
    if (!siteMenu.hidden && !event.target.closest(".site-header")) closeMenu();
    const link = event.target.closest("[data-menu-sign-out]");
    if (link) {
      event.preventDefault();
      fetch("/api/auth/logout", { method: "POST" })
        .then(response => {
          if (!response.ok) throw new Error("Could not sign out. Please try again.");
          setSignedIn(null);
          closeMenu();
          window.showToast("You have been signed out.", "success");
        })
        .catch(error => showMenuError(error.message));
    } else if (event.target.closest("#site-menu a")) {
      closeMenu();
    }
  });

  document.addEventListener("keydown", event => {
    if (event.key === "Escape") closeMenu();
  });

  fetch("/api/auth/me")
    .then(async response => {
      if (response.status === 401) return null;
      if (!response.ok) throw new Error("Could not check your sign-in status.");
      const { user } = await response.json();
      return user;
    })
    .then(setSignedIn)
    .catch(error => {
      console.error(error.message);
      showMenuError(error.message);
    });
}
