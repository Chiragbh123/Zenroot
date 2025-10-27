/* zenroot.js - Updated with CNN Backend Integration */

(function(){
  'use strict';

  // CNN Backend Configuration
  const CNN_BACKEND_URL = 'http://localhost:5000';  // Change this to your server URL

  /* ==============================
     🌙 THEME HANDLING
  ============================== */
  const THEME_KEY = 'zenroot_theme';
  const rootEl = document.documentElement;

  function getStoredTheme(){
    const stored = localStorage.getItem(THEME_KEY);
    if(stored === 'dark' || stored === 'light') return stored;
    if(window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) return 'dark';
    return 'light';
  }

  function applyTheme(theme){
    const icon = document.getElementById('themeIcon');
    const label = document.getElementById('themeLabel');
    if(theme === 'dark'){
      rootEl.setAttribute('data-theme','dark');
      if(icon) icon.textContent = '🌙';
      if(label) label.textContent = 'Dark';
    } else {
      rootEl.removeAttribute('data-theme');
      if(icon) icon.textContent = '☀️';
      if(label) label.textContent = 'Light';
    }
  }

  function toggleTheme(){
    const next = (localStorage.getItem(THEME_KEY) === 'dark') ? 'light' : 'dark';
    localStorage.setItem(THEME_KEY, next);
    applyTheme(next);
    const btn = document.getElementById('themeToggle');
    if(btn) btn.setAttribute('aria-pressed', next === 'dark' ? 'true' : 'false');
  }

  /* ==============================
     🧩 UTILITIES
  ============================== */
  const $ = (s)=>document.querySelector(s);
  const $$ = (s)=>Array.from(document.querySelectorAll(s));
  
  function toast(msg, type='success'){
    const t=document.createElement('div');
    t.textContent=msg;
    t.style.position='fixed';
    t.style.bottom='20px';
    t.style.left='50%';
    t.style.transform='translateX(-50%)';
    t.style.background= type === 'error' ? '#dc2626' : '#0ea37a';
    t.style.color='white';
    t.style.padding='10px 14px';
    t.style.borderRadius='10px';
    t.style.fontWeight='600';
    t.style.boxShadow='0 8px 25px rgba(0,0,0,0.2)';
    t.style.zIndex='10000';
    document.body.appendChild(t);
    setTimeout(()=>t.remove(), type === 'error' ? 3000 : 2000);
  }

  /* ==============================
     🌦️ WEATHER
  ============================== */
  const weatherApiKey = "b48469ccc0f440e69c590213251710";
  const weatherBox = $('#weatherBox');
  const resultBox = $('#resultBox');
  const cityInput = $('#cityInput');
  const cityDropdown = $('#cityDropdown');

  async function getWeather(city){
    if(!city){ toast("Enter a city first.", 'error'); return; }
    weatherBox.textContent="⏳ Loading weather...";
    try{
      const r = await fetch(`https://api.weatherapi.com/v1/current.json?key=${weatherApiKey}&q=${encodeURIComponent(city)}`);
      const data = await r.json();
      const w = data.current;
      weatherBox.innerHTML = `
        📍 <b>${data.location.name}</b><br>
        🌡️ ${w.temp_c}°C | 💧${w.humidity}% | 🌬️${w.wind_kph}kph<br>
        ${w.condition.text}
      `;
      suggestPlants(w.temp_c, w.humidity);
    }catch(e){ 
      weatherBox.textContent="❌ Unable to fetch weather.";
      toast("Failed to fetch weather data", 'error');
    }
  }

  function suggestPlants(temp,hum){
    const res = $('#resultBox');
    let plants=[];
    if(temp>30 && hum>60) plants=["🌿 Peace Lily","🌿 Spider Plant"];
    else if(temp<20 && hum>60) plants=["🌿 English Ivy","🌿 Bamboo Palm"];
    else if(hum<40) plants=["🌿 Snake Plant","🌿 Aloe Vera"];
    else plants=["🌿 ZZ Plant","🌿 Rubber Plant"];
    res.innerHTML=`<h3>🌱 Suggested Plants</h3><ul>${plants.map(p=>`<li>${p}</li>`).join('')}</ul>`;
    res.style.display="block";
  }

  /* ==============================
     📸 CAMERA
  ============================== */
  const openCameraBtn=$('#openCameraBtn');
  const captureBtn=$('#captureBtn');
  const closeCameraBtn=$('#closeCameraBtn');
  const cameraArea=$('#cameraArea');
  const cameraVideo=$('#cameraVideo');
  const cameraCanvas=$('#cameraCanvas');
  let cameraStream=null;

  async function startCamera(){
    try{
      cameraStream = await navigator.mediaDevices.getUserMedia({video:true});
      cameraVideo.srcObject = cameraStream;
      cameraArea.classList.remove('camera-hidden');
      cameraVideo.classList.remove('camera-hidden');
      await cameraVideo.play();
      toast("Camera started");
    }catch(err){ 
      toast('Camera access denied.', 'error');
      console.error('Camera error:', err);
    }
  }

  function stopCamera(){
    if(cameraStream){ 
      cameraStream.getTracks().forEach(t=>t.stop()); 
      cameraStream=null; 
    }
    cameraVideo.pause();
    cameraArea.classList.add('camera-hidden');
    cameraVideo.classList.add('camera-hidden');
  }

  function captureFromCamera(){
    if(!cameraVideo || !cameraVideo.videoWidth){ 
      toast("Camera not ready.", 'error'); 
      return; 
    }
    const ctx=cameraCanvas.getContext('2d');
    cameraCanvas.width=cameraVideo.videoWidth;
    cameraCanvas.height=cameraVideo.videoHeight;
    ctx.drawImage(cameraVideo,0,0);
    cameraCanvas.toBlob(blob=>{
      const f=new File([blob],"camera_photo.jpg",{type:"image/jpeg"});
      const dt=new DataTransfer();
      dt.items.add(f);
      const plantImageInput = $('#plantImageInput');
      const fileChosen = $('#fileChosen');
      plantImageInput.files = dt.files;
      if(fileChosen) fileChosen.textContent="camera_photo.jpg";
      stopCamera();
      toast("Photo captured!");
    });
  }

  /* ==============================
     🌿 CNN INTEGRATION
  ============================== */
  const plantImageInput=$('#plantImageInput');
  const fileChosen=$('#fileChosen');
  const submitBtn=$('#submitBtn');

  // Check backend health
  async function checkBackendHealth(){
    try{
      const response = await fetch(`${CNN_BACKEND_URL}/health`);
      const data = await response.json();
      console.log('Backend health:', data);
      return data.model_loaded;
    }catch(err){
      console.error('Backend not reachable:', err);
      return false;
    }
  }

  // Basic image validation
  async function analyzeImage(file){
    return new Promise(resolve=>{
      const img=new Image();
      img.src=URL.createObjectURL(file);
      img.onload=()=>{
        const size=128, cvs=document.createElement('canvas');
        cvs.width=size;cvs.height=size;
        const ctx=cvs.getContext('2d',{willReadFrequently:true});
        ctx.drawImage(img,0,0,size,size);
        const d=ctx.getImageData(0,0,size,size).data;
        let green=0,skin=0,bright=0;
        for(let i=0;i<d.length;i+=4){
          const r=d[i],g=d[i+1],b=d[i+2];
          const br=(r+g+b)/3;
          if(br>240||br<20) bright++;
          if(g>r+20&&g>b+20&&g>60) green++;
          if(r>90&&g>40&&b<110&&r>g&&g>b) skin++;
        }
        URL.revokeObjectURL(img.src);
        resolve({
          greenRatio:green/(d.length/4),
          skinRatio:skin/(d.length/4),
          brightRatio:bright/(d.length/4)
        });
      };
      img.onerror=()=>resolve({greenRatio:0,skinRatio:0,brightRatio:1});
    });
  }

  async function isValidLeaf(file){
    const {greenRatio,skinRatio,brightRatio}=await analyzeImage(file);
    if(skinRatio>0.15) return {ok:false,msg:"❌ Human detected. Upload a clear leaf photo."};
    if(greenRatio<0.08) return {ok:false,msg:"❌ Not enough green detected. Use a leaf close-up."};
    if(brightRatio>0.45) return {ok:false,msg:"❌ Image too bright or dark. Use better lighting."};
    return {ok:true};
  }

  function showError(msg){
    activateTab('results');
    $('#analyzingState').style.display='none';
    $('#resultsContent').style.display='none';
    
    // Remove any existing error message
    const existing = document.querySelector('#results .error-message');
    if(existing) existing.remove();
    
    const err=document.createElement('div');
    err.className='error-message';
    err.style.background='rgba(227,74,59,0.1)';
    err.style.color='#b91c1c';
    err.style.padding='20px';
    err.style.borderRadius='12px';
    err.style.fontWeight='700';
    err.style.margin='20px';
    err.style.textAlign='center';
    err.innerHTML=`<h3>${msg}</h3><button onclick="window.location.reload()" style="margin-top:10px;padding:10px 20px;background:#b91c1c;color:white;border:none;border-radius:8px;cursor:pointer;">Try Again</button>`;
    $('#results').appendChild(err);
  }

  // Main CNN prediction function
  async function predictWithCNN(file){
    try{
      // Create FormData to send image
      const formData = new FormData();
      formData.append('image', file);

      // Send to backend
      const response = await fetch(`${CNN_BACKEND_URL}/predict`, {
        method: 'POST',
        body: formData
      });

      if(!response.ok){
        const errorData = await response.json();
        throw new Error(errorData.message || 'Prediction failed');
      }

      const data = await response.json();
      return data;

    }catch(err){
      console.error('CNN prediction error:', err);
      throw err;
    }
  }

  async function handleSubmit(){
    const file=plantImageInput.files[0];
    if(!file){ 
      toast("Select an image first.", 'error'); 
      return; 
    }

    // Validate image
    const valid=await isValidLeaf(file);
    if(!valid.ok){ 
      showError(valid.msg); 
      return; 
    }

    // Check backend availability
    const backendAvailable = await checkBackendHealth();
    if(!backendAvailable){
      showError('⚠️ CNN Backend is not available. Please ensure the Flask server is running at ' + CNN_BACKEND_URL);
      return;
    }

    // Show analyzing state
    activateTab('results');
    $('#analyzingState').style.display='block';
    $('#resultsContent').style.display='none';

    // Read image for preview
    const reader=new FileReader();
    reader.onload=async ()=>{
      try{
        // Call CNN backend
        const prediction = await predictWithCNN(file);

        if(prediction.success){
          // Display results
          $('#resultsTitle').innerHTML=`<b>${prediction.disease_info.title} 🍃</b>`;
          $('#uploadedImagePreview').src=reader.result;
          $('#descriptionText').innerHTML = `
            <strong>Confidence:</strong> ${prediction.prediction.confidence_percent}<br><br>
            ${prediction.disease_info.description}
          `;
          $('#preventionText').textContent=prediction.disease_info.prevention;
          
          $('#analyzingState').style.display='none';
          $('#resultsContent').style.display='block';
          
          toast(`Detected: ${prediction.prediction.display_name}`);
        }else{
          throw new Error('Prediction unsuccessful');
        }

      }catch(err){
        console.error('Error:', err);
        showError(`❌ Analysis failed: ${err.message}. Please try again or check your backend server.`);
      }
    };
    reader.readAsDataURL(file);
  }

  /* ==============================
     📋 COPY EMAIL BUTTONS
  ============================== */
  function wireCopyButtons(){
    $$('.copy-email-btn').forEach(btn=>{
      btn.addEventListener('click',async()=>{
        const email=btn.dataset.email;
        try{
          await navigator.clipboard.writeText(email);
          toast("📋 Email copied!");
        }catch{
          toast("Copy failed.", 'error');
        }
      });
    });
  }

  /* ==============================
     🪄 TAB SWITCHING
  ============================== */
  function activateTab(id){
    $$('.tab').forEach(t=>{
      const match = t.dataset.tab === id;
      t.setAttribute('aria-selected', match ? 'true' : 'false');
      t.classList.toggle('active', match);
    });
    ['home','aiengine','results','abstract','contact'].forEach(sec=>{
      const el=$(`#${sec}`);
      if(el){
        const visible = sec === id;
        el.classList.toggle('active', visible);
        el.setAttribute('aria-hidden', visible ? 'false' : 'true');
      }
    });
  }

  /* ==============================
     ⚙️ INIT
  ============================== */
  document.addEventListener('DOMContentLoaded',async ()=>{
    applyTheme(getStoredTheme());
    const themeToggleButton = $('#themeToggle');
    if(themeToggleButton) {
      themeToggleButton.onclick = toggleTheme;
      themeToggleButton.setAttribute('aria-pressed', localStorage.getItem(THEME_KEY) === 'dark' ? 'true' : 'false');
    }

    $('#getWeatherBtn').onclick=()=>getWeather(cityInput.value||cityDropdown.value);
    $('#gpsBtn').onclick=()=>{ 
      navigator.geolocation.getCurrentPosition(
        pos=>{ getWeather(`${pos.coords.latitude},${pos.coords.longitude}`); },
        ()=>toast("Location unavailable.", 'error')
      ); 
    };

    if(openCameraBtn) openCameraBtn.onclick=startCamera;
    if(captureBtn) captureBtn.onclick=captureFromCamera;
    if(closeCameraBtn) closeCameraBtn.onclick=stopCamera;
    if(submitBtn) submitBtn.onclick=handleSubmit;

    if(plantImageInput){
      plantImageInput.addEventListener('change', ()=>{
        const f = plantImageInput.files[0];
        if(f && fileChosen) fileChosen.textContent = f.name;
      });
    }

    // Add back to upload button handler
    const backBtn = $('#backToUpload');
    if(backBtn){
      backBtn.onclick = ()=>{
        activateTab('aiengine');
        // Reset file input
        if(plantImageInput) plantImageInput.value = '';
        if(fileChosen) fileChosen.textContent = 'No file chosen';
      };
    }

    wireCopyButtons();
    
    $$('.tab').forEach(t=>{
      t.addEventListener('click', ()=> activateTab(t.dataset.tab));
    });

    activateTab('home');

    // Check backend on load
    const isHealthy = await checkBackendHealth();
    if(!isHealthy){
      console.warn('⚠️ CNN Backend not available. Disease detection will not work.');
    }else{
      console.log('✓ CNN Backend connected successfully');
    }
  });
})();
