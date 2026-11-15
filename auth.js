const loginForm = document.querySelector("#login-form");
const registerForm = document.querySelector("#register-form");
const loginMessage = document.querySelector("#login-message");
const registerMessage = document.querySelector("#register-message");
const returnTo = new URLSearchParams(window.location.search).get("returnTo");
const carReturnMatch = /^car\.html\?id=([a-f\d]{24})$/i.exec(returnTo || "");
const partReturnMatch = /^part\.html\?id=([a-f\d]{24})$/i.exec(returnTo || "");
const supportedReturnTo = ["sell.html", "parts.html", "sell-part.html", "inbox.html", "admin.html"].includes(returnTo) || carReturnMatch || partReturnMatch;
const redirectAfterAuth = carReturnMatch ? `car.html?id=${carReturnMatch[1]}#chat`
  : partReturnMatch ? `part.html?id=${partReturnMatch[1]}#chat`
  : returnTo === "parts.html" ? "parts.html#parts-listings"
    : returnTo === "sell-part.html" ? "sell-part.html"
    : returnTo === "sell.html" || returnTo === "inbox.html" || returnTo === "admin.html" ? returnTo
      : "index.html";

if (supportedReturnTo) {
  const destination = `?returnTo=${encodeURIComponent(returnTo)}`;
  document.querySelectorAll("[data-auth-link]").forEach(link => {
    link.href = `${link.dataset.authLink}.html${destination}`;
  });
}

function showMessage(element, message, success = false) {
  element.textContent = message;
  element.classList.toggle("success", success);
  if (message) window.showToast(message, success ? "success" : "error");
}

async function submitAuth(url, values) {
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(values)
  });
  const result = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(result.error || "The request could not be completed.");
  try {
    sessionStorage.setItem("garisafi.toast", JSON.stringify({
      message: url.endsWith("/login") ? "Login successful. Welcome back!" : "Account created successfully. Welcome to GariSafi!",
      type: "success"
    }));
  } catch (error) {
    console.error("Could not save the sign-in notification:", error);
  }
  window.location.assign(redirectAfterAuth);
}

if (registerForm) {
  registerForm.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage(registerMessage, "");
    try {
      await submitAuth("/api/auth/register", {
        name: registerForm.elements.name.value.trim(),
        email: registerForm.elements.email.value.trim(),
        phone: registerForm.elements.phone.value.trim(),
        password: registerForm.elements.password.value
      });
    } catch (error) {
      showMessage(registerMessage, error.message || "Could not create your account. Please try again.");
    }
  });
}

if (loginForm) {
  loginForm.addEventListener("submit", async event => {
    event.preventDefault();
    showMessage(loginMessage, "");
    try {
      await submitAuth("/api/auth/login", {
        email: loginForm.elements.email.value.trim(),
        password: loginForm.elements.password.value
      });
    } catch (error) {
      showMessage(loginMessage, error.message || "Could not sign in. Please try again.");
    }
  });
}
