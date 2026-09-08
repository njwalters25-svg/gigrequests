const form = document.querySelector("#loginForm");
const password = document.querySelector("#dashboardPassword");
const error = document.querySelector("#loginError");

async function api(path, options) {
  const fetchOptions = options || {};
  fetchOptions.headers = Object.assign({ "Content-Type": "application/json" }, fetchOptions.headers || {});
  const response = await fetch(path, fetchOptions);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || "Something went wrong.");
  return data;
}

form.addEventListener("submit", async event => {
  event.preventDefault();
  error.textContent = "";

  try {
    await api("/api/login", {
      method: "POST",
      body: JSON.stringify({ password: password.value })
    });
    window.location.href = "/dashboard";
  } catch (loginError) {
    error.textContent = loginError.message;
    password.select();
  }
});
