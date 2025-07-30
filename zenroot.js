const loginForm = document.getElementById('loginForm');
const signUpForm = document.getElementById('signUpForm');
const plantForm = document.getElementById('plantForm');
const toSignUp = document.getElementById('toSignUp');
const toLogin = document.getElementById('toLogin');
const resultBox = document.getElementById('resultBox');
const logoutBtn = document.getElementById('logoutBtn');
const resetPasswordBtn = document.getElementById('resetPasswordBtn');
const weatherBox = document.getElementById('weatherBox');
const cityInput = document.getElementById("cityInput");
const cityDropdown = document.getElementById("cityDropdown");
const gpsBtn = document.getElementById("gpsBtn");

const weatherApiKey = "9ee4aa1c5af442ddb41161211253007"; // Replace with your actual key
let currentCity = localStorage.getItem('lastCity') || "Mumbai";

// USER ACCOUNT FUNCTIONS
function saveUserData(email, password) {
  const users = JSON.parse(localStorage.getItem("zenUsers") || "{}");
  users[email] = password;
  localStorage.setItem("zenUsers", JSON.stringify(users));
}
function getUserData(email) {
  const users = JSON.parse(localStorage.getItem("zenUsers") || "{}");
  return users[email];
}
function updatePassword(email, newPassword) {
  const users = JSON.parse(localStorage.getItem("zenUsers") || "{}");
  users[email] = newPassword;
  localStorage.setItem("zenUsers", JSON.stringify(users));
}
function saveUser(email) {
  localStorage.setItem('zenrootUser', email);
}
function getUser() {
  return localStorage.getItem('zenrootUser');
}
function removeUser() {
  localStorage.removeItem('zenrootUser');
}

// FORM DISPLAY LOGIC
function showForm(formToShow) {
  [loginForm, signUpForm, plantForm].forEach(form => {
    if (form === formToShow) form.classList.add('active');
    else form.classList.remove('active');
  });
  resultBox.style.display = 'none';
}

// WEATHER API FETCHING
function getWeather(city) {
  fetch(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${city}`)
    .then(res => res.json())
    .then(data => {
      const w = data.current;
      weatherBox.innerHTML = `
        📍 <b>${data.location.name}, ${data.location.region}</b><br>
        🌡️ Temp: ${w.temp_c} °C<br>
        💧 Humidity: ${w.humidity}%<br>
        🌬️ Wind: ${w.wind_kph} kph<br>
        🌥️ ${w.condition.text}<br>
        <img src="${w.condition.icon}" />
      `;
      currentCity = data.location.name;
      localStorage.setItem("lastCity", currentCity);
      if (w.temp_c !== undefined && w.humidity !== undefined) {
        suggestPlants(w.temp_c, w.humidity);
      }
    })
    .catch((e) => {
      console.error(e);
      weatherBox.innerText = "❌ Could not fetch weather data.";
    });
}

function getWeatherFromInput() {
  const city = cityInput.value || cityDropdown.value;
  if (!city) return alert("Please select or enter a city.");
  getWeather(city);
}

// GPS LOCATION
gpsBtn.onclick = () => {
  navigator.geolocation?.getCurrentPosition(pos => {
    const lat = pos.coords.latitude;
    const lon = pos.coords.longitude;
    fetch(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${lat},${lon}`)
      .then(res => res.json())
      .then(data => getWeather(data.location.name))
      .catch(() => getWeather("Mumbai"));
  }, () => getWeather("Mumbai"));
};

// PLANT SUGGESTIONS
function suggestPlants(temp, humidity) {
  let suggestions = [];

  if (temp >= 30 && humidity >= 60) {
    suggestions = ["🌿 Peace Lily", "🌿 Boston Fern", "🌿 Spider Plant"];
  } else if (temp <= 20 && humidity >= 60) {
    suggestions = ["🌿 English Ivy", "🌿 Bamboo Palm", "🌿 Areca Palm"];
  } else if (humidity < 40) {
    suggestions = ["🌿 Snake Plant", "🌿 Aloe Vera", "🌿 Jade Plant"];
  } else {
    suggestions = ["🌿 Rubber Plant", "🌿 ZZ Plant"];
  }

  if (suggestions.length > 0) {
    resultBox.innerHTML = `<h3>🌱 Suggested Plants:</h3><ul>${suggestions.map(p => `<li class='plant-item'>${p}</li>`).join('')}</ul>`;
    resultBox.style.display = "block";
  } else {
    resultBox.innerHTML = `<p>No suggestions available for this climate.</p>`;
    resultBox.style.display = "block";
  }

  // Save to history
  const history = JSON.parse(localStorage.getItem("plantHistory") || "[]");
  history.push({ city: currentCity, date: new Date().toLocaleString(), plants: suggestions });
  localStorage.setItem("plantHistory", JSON.stringify(history));
}

// LOGIN
loginForm.onsubmit = e => {
  e.preventDefault();
  const email = document.getElementById('loginEmail').value.trim();
  const password = document.getElementById('loginPassword').value.trim();
  const savedPassword = getUserData(email);
  if (savedPassword && savedPassword === password) {
    saveUser(email);
    alert(`✅ Logged in as ${email}`);
    loginForm.reset();
    showForm(plantForm);
    getWeather(currentCity);
  } else {
    alert('❌ Invalid email or password.');
  }
};

// RESET PASSWORD
resetPasswordBtn.onclick = () => {
  const email = prompt("Enter your registered email:");
  if (!email || email.trim() === "") return alert("Please enter a valid email.");
  const exists = getUserData(email.trim());
  if (!exists) return alert("Email not found.");
  const newPass = prompt("Enter new password:");
  if (!newPass || newPass.length < 4) return alert("Password must be at least 4 characters.");
  updatePassword(email.trim(), newPass.trim());
  alert("✅ Password updated successfully!");
};

// SIGNUP
signUpForm.onsubmit = e => {
  e.preventDefault();
  const name = document.getElementById('signUpName').value.trim();
  const email = document.getElementById('signUpEmail').value.trim();
  const password = document.getElementById('signUpPassword').value.trim();
  if (name && email && password) {
    saveUserData(email, password);
    alert(`✅ Account created for ${name}`);
    signUpForm.reset();
    showForm(loginForm);
  } else {
    alert('Please fill all fields.');
  }
};

// FORM NAVIGATION
toSignUp.onclick = () => showForm(signUpForm);
toLogin.onclick = () => showForm(loginForm);
logoutBtn.onclick = () => {
  removeUser();
  alert('Logged out.');
  showForm(loginForm);
};

// INIT ON LOAD
window.onload = () => {
  const user = getUser();
  if (user) {
    showForm(plantForm);
    getWeather(currentCity);
  } else {
    showForm(loginForm);
  }
};
