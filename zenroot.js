// ===== DOM HOOKS =====
const $ = (q) => document.querySelector(q);
const $$ = (q) => Array.from(document.querySelectorAll(q));

const loginForm = $('#loginForm');
const signUpForm = $('#signUpForm');
const plantForm = $('#plantForm');

const resultBox = $('#resultBox');
const weatherBox = $('#weatherBox');

const cityInput = $('#cityInput');
const cityDropdown = $('#cityDropdown');
const getWeatherBtn = $('#getWeatherBtn');
const gpsBtn = $('#gpsBtn');
const logoutBtn = $('#logoutBtn');

const resetPasswordBtn = $('#resetPasswordBtn');
const resetDialog = $('#resetDialog');
const resetEmail = $('#resetEmail');
const resetNewPass = $('#resetNewPass');

const historyList = $('#historyList');
const clearHistoryBtn = $('#clearHistory');

const tabs = $$('.tab');

// ===== STATE =====
const weatherApiKey = "3e53efbde704401986192444250610"; // <- replace!
let currentCity = localStorage.getItem('lastCity') || "Mumbai";

// Fun facts for PlantFlash
const facts = [
  "Snake plant converts CO₂ to O₂ even at night.",
  "Aloe vera stores water in its leaves—great for beginners.",
  "Peace lily droops when thirsty—an easy watering cue.",
  "Most houseplants like bright, indirect light, not harsh sun.",
  "Overwatering causes more plant deaths than underwatering."
];
let factIndex = 0;

// ===== UTIL =====
const hash = async (text) => {
  const enc = new TextEncoder().encode(text);
  const buf = await crypto.subtle.digest('SHA-256', enc);
  return Array.from(new Uint8Array(buf)).map(b => b.toString(16).padStart(2,'0')).join('');
};

const getUsers = () => JSON.parse(localStorage.getItem("zenUsers") || "{}");
const setUsers = (obj) => localStorage.setItem("zenUsers", JSON.stringify(obj));

async function saveUserData(email, password) {
  const users = getUsers();
  users[email] = await hash(password);
  setUsers(users);
}
function getUser() { return localStorage.getItem('zenrootUser'); }
function saveUser(email, name=""){ localStorage.setItem('zenrootUser', email); if(name) localStorage.setItem('zenrootName', name); }
function removeUser(){ localStorage.removeItem('zenrootUser'); }

async function checkPassword(email, password){
  const users = getUsers();
  if(!users[email]) return false;
  const h = await hash(password);
  return h === users[email];
}
async function updatePassword(email, newPassword){
  const users = getUsers();
  if(!users[email]) return false;
  users[email] = await hash(newPassword);
  setUsers(users);
  return true;
}

function showForm(formToShow){
  [loginForm, signUpForm, plantForm].forEach(f => f.classList.remove('active'));
  formToShow.classList.add('active');
  resultBox.style.display = 'none';
  activateTab('home'); // keep Home visible
}

function toast(msg){ alert(msg); }

// ===== WEATHER =====
async function getWeather(q){
  weatherBox.textContent = "⏳ Loading weather...";
  try{
    const r = await fetch(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${encodeURIComponent(q)}`);
    if(!r.ok) throw new Error(`HTTP ${r.status}`);
    const data = await r.json();
    if(!data || !data.current) throw new Error("No data");
    const w = data.current;
    weatherBox.innerHTML = `
      📍 <b>${data.location.name}, ${data.location.region || data.location.country}</b><br/>
      🌡️ Temp: ${w.temp_c} °C<br/>
      💧 Humidity: ${w.humidity}%<br/>
      🌬️ Wind: ${w.wind_kph} kph<br/>
      🌥️ ${w.condition.text}<br/>
      <img src="${w.condition.icon}" alt="${w.condition.text} icon"/>
    `;
    currentCity = data.location.name;
    localStorage.setItem("lastCity", currentCity);
    if(Number.isFinite(w.temp_c) && Number.isFinite(w.humidity)){
      suggestPlants(w.temp_c, w.humidity);
    }
  }catch(e){
    console.error(e);
    weatherBox.textContent = "❌ Could not fetch weather data. Check your API key or network.";
  }
}

function getWeatherFromInput(){
  const city = cityInput.value.trim() || cityDropdown.value.trim();
  if(!city){ toast("Please select or enter a city."); return; }
  getWeather(city);
}

// Geolocation
gpsBtn?.addEventListener('click', () => {
  if(!navigator.geolocation){ toast("Geolocation unavailable on this device."); return; }
  navigator.geolocation.getCurrentPosition(async pos=>{
    const {latitude:lat, longitude:lon} = pos.coords;
    try{
      const r = await fetch(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${lat},${lon}`);
      const data = await r.json();
      await getWeather(data.location.name);
    }catch{
      getWeather("Mumbai");
    }
  }, ()=> getWeather("Mumbai"), {enableHighAccuracy:false, timeout:8000});
});

// Suggestions
function suggestPlants(temp, humidity){
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

  resultBox.innerHTML = `<h3>🌱 Suggested Plants</h3><ul>${suggestions.map(p=>`<li class="plant-item">${p}</li>`).join('')}</ul>`;
  resultBox.style.display = "block";

  const history = JSON.parse(localStorage.getItem("plantHistory") || "[]");
  history.push({ city: currentCity, date: new Date().toLocaleString(), temp, humidity, plants: suggestions });
  localStorage.setItem("plantHistory", JSON.stringify(history));
  renderHistory();
}

// ===== AUTH =====
loginForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const email = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  const ok = await checkPassword(email, password);
  if(ok){
    saveUser(email);
    toast(`✅ Logged in as ${email}`);
    loginForm.reset();
    showForm(plantForm);
    getWeather(currentCity);
  }else{
    toast('❌ Invalid email or password.');
  }
});

signUpForm.addEventListener('submit', async (e)=>{
  e.preventDefault();
  const name = $('#signUpName').value.trim();
  const email = $('#signUpEmail').value.trim();
  const password = $('#signUpPassword').value;
  if(!name || !email || !password){ toast("Please fill all fields."); return; }
  if(password.length < 6){ toast("Password must be at least 6 characters."); return; }
  await saveUserData(email, password);
  saveUser(email, name);
  toast(`✅ Account created for ${name}`);
  signUpForm.reset();
  showForm(loginForm);
});

resetPasswordBtn?.addEventListener('click', ()=>{
  resetEmail.value = "";
  resetNewPass.value = "";
  resetDialog.showModal();
});
$('#resetConfirm')?.addEventListener('click', async ()=>{
  const email = resetEmail.value.trim();
  const newPass = resetNewPass.value;
  if(!email){ toast("Enter email."); return; }
  if(!newPass || newPass.length < 6){ toast("Password must be at least 6 characters."); return; }
  const ok = await updatePassword(email, newPass);
  if(!ok){ toast("Email not found."); return; }
  toast("✅ Password updated!");
});

// Nav between forms
$('#toSignUp')?.addEventListener('click', ()=> showForm(signUpForm));
$('#toLogin')?.addEventListener('click', ()=> showForm(loginForm));
logoutBtn?.addEventListener('click', ()=>{
  removeUser();
  toast('Logged out.');
  showForm(loginForm);
});

// ===== TABS / SECTIONS =====
function activateTab(id){
  // button states
  tabs.forEach(t=>{
    const isActive = t.dataset.tab === id;
    t.classList.toggle('active', isActive);
    t.setAttribute('aria-selected', isActive ? 'true' : 'false');
  });
  // section states
  ['plantForm','abstract','growguide','plantflash','history']
    .forEach(sec => $('#'+sec).classList.remove('active'));
  if(id === 'home'){ $('#plantForm').classList.add('active'); }
  else { $('#'+id).classList.add('active'); }
}

tabs.forEach(btn=>{
  btn.addEventListener('click', ()=> activateTab(btn.dataset.tab));
});

// ===== HISTORY RENDER =====
function renderHistory(){
  const history = JSON.parse(localStorage.getItem("plantHistory") || "[]").slice().reverse();
  if(history.length === 0){ historyList.innerHTML = "<p>No history yet.</p>"; return; }
  historyList.innerHTML = history.map(h=>`
    <div class="history-item">
      <b>${h.city}</b> — ${h.date}<br/>
      Temp: ${h.temp} °C, Humidity: ${h.humidity}%<br/>
      ${h.plants.join(", ")}
    </div>
  `).join('');
}
clearHistoryBtn?.addEventListener('click', ()=>{
  if(confirm("Clear all history?")){
    localStorage.removeItem("plantHistory");
    renderHistory();
  }
});

// ===== PLANTFLASH =====
function renderFact(){ $('#flashText').textContent = facts[factIndex]; }
$('#flashNext')?.addEventListener('click', ()=>{ factIndex = (factIndex+1)%facts.length; renderFact(); });
$('#flashPrev')?.addEventListener('click', ()=>{ factIndex = (factIndex-1+facts.length)%facts.length; renderFact(); });

// ===== INIT =====
window.addEventListener('load', ()=>{
  const user = getUser();
  if (user) {
    showForm(plantForm);
    getWeather(currentCity);
  } else {
    showForm(loginForm);
  }
  activateTab('home');
  renderFact();
  renderHistory();

  // Button for manual fetch
  getWeatherBtn?.addEventListener('click', getWeatherFromInput);
});

