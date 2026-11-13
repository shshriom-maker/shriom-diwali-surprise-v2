/*************************************************
 SHRIOM'S DIWALI SURPRISE
 GITHUB PAGES FRONTEND
 Google Apps Script calls are routed through API_URL
*************************************************/

const $ = id => document.getElementById(id);

let currentUser = null;
let sessionToken = sessionStorage.getItem(APP_CONFIG.SESSION_KEY) || "";
let profile = {};
let latestWishText = "";

function setStatus(id, message) {
  const node = $(id);
  if (node) node.textContent = message;
}

/*
  API contract used by the Cloudflare Worker:
  POST { method: "loginAccount", args: [payload] }
  POST { method: "getSessionUser", args: [sessionToken] }

  The Worker and Apps Script doPost endpoint must be configured
  to accept this contract before Google Sheets features will work.
*/
async function serverCall(method, ...args) {
  if (!APP_CONFIG.API_URL ||
      APP_CONFIG.API_URL.includes("PASTE_CLOUDFLARE_WORKER_URL_HERE")) {
    throw new Error("API setup is not complete yet. Please configure the API URL.");
  }

  let response;
  try {
    response = await fetch(APP_CONFIG.API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ method, args })
    });
  } catch (error) {
    throw new Error("Could not connect to the server. Please check your internet or API URL.");
  }

  let result;
  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The server returned an invalid response.");
  }

  if (!response.ok) {
    throw new Error(result && result.message || `Server error (${response.status}).`);
  }
  return result;
}

function authError(error) {
  return error && error.message
    ? error.message
    : String(error || "Something went wrong.");
}

function showSignedIn(user) {
  currentUser = user;

  $("authScreen").classList.add("hidden");
  $("giftScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");

  $("yourName").value = user.displayName || user.username || "";
  $("senderName").value = user.displayName || user.username || "";
}

function showSignedOut() {
  currentUser = null;
  sessionToken = "";

  sessionStorage.removeItem(APP_CONFIG.SESSION_KEY);

  $("authScreen").classList.remove("hidden");
  $("giftScreen").classList.add("hidden");
  $("appScreen").classList.add("hidden");
}

function switchAuth(signup) {
  $("signupForm").classList.toggle("hidden", !signup);
  $("loginForm").classList.toggle("hidden", signup);

  $("showSignup").classList.toggle("active", signup);
  $("showLogin").classList.toggle("active", !signup);

  setStatus("authStatus", "");
}

$("showSignup").addEventListener("click", () => switchAuth(true));
$("showLogin").addEventListener("click", () => switchAuth(false));

// CREATE ACCOUNT
$("signupForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!$("privacyConsent").checked) {
    return setStatus("authStatus", "Please accept the data notice.");
  }

  const payload = {
    username: $("signupUsername").value.trim(),
    displayName: $("signupName").value.trim(),
    password: $("signupPassword").value,
    consent: true
  };

  try {
    setStatus("authStatus", "Creating your account securely...");

    const result = await serverCall("registerAccount", payload);

    if (!result || !result.ok) {
      throw new Error(result && result.message || "Account creation failed.");
    }

    sessionToken = result.sessionToken;
    sessionStorage.setItem(APP_CONFIG.SESSION_KEY, sessionToken);
    showSignedIn(result.user);

  } catch (error) {
    setStatus("authStatus", authError(error));
  } finally {
    $("signupPassword").value = "";
  }
});

// LOGIN
$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const payload = {
    username: $("loginUsername").value.trim(),
    password: $("loginPassword").value
  };

  try {
    setStatus("authStatus", "Checking your account...");

    const result = await serverCall("loginAccount", payload);

    if (!result || !result.ok) {
      throw new Error(result && result.message || "Login failed.");
    }

    sessionToken = result.sessionToken;
    sessionStorage.setItem(APP_CONFIG.SESSION_KEY, sessionToken);
    showSignedIn(result.user);

  } catch (error) {
    setStatus("authStatus", authError(error));
  } finally {
    $("loginPassword").value = "";
  }
});

// RESTORE SESSION
async function restoreSession() {
  if (!sessionToken) return showSignedOut();

  try {
    const result = await serverCall("getSessionUser", sessionToken);

    if (result && result.ok) {
      showSignedIn(result.user);
    } else {
      showSignedOut();
    }
  } catch (error) {
    showSignedOut();
  }
}

// LOGOUT
async function logout() {
  try {
    if (sessionToken) {
      await serverCall("logoutAccount", sessionToken);
    }
  } catch (error) {
    console.warn(error);
  }

  showSignedOut();
  switchAuth(false);
}

$("logoutBtn").addEventListener("click", logout);
$("logoutFromGift").addEventListener("click", logout);

// OPEN GIFT
$("openGift").addEventListener("click", () => {
  $("giftScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");
  $("unwrap").scrollIntoView({ behavior: "smooth" });
});

// PERSONALIZED GREETINGS
const specialGreetings = {
  brother: n =>
    `Dear ${n}, may your courage stay strong, your dreams keep growing and your life be filled with success. Thank you for the fun, support and unforgettable memories. Happy Diwali, brother!`,

  sister: n =>
    `Dear ${n}, may your smile shine brighter than every diya and may every dream find its way to you. Keep spreading your warmth and beautiful energy. Wishing you love, laughter and a sparkling Diwali, sister!`,

  girlfriend: n =>
    `My dearest ${n}, may this Diwali fill your world with the same warmth and happiness you bring into mine. May every light remind you how special you are. Keep smiling, keep shining and may all your dreams come true. Happy Diwali!`,

  boyfriend: n =>
    `Dear ${n}, may your path always be bright, your heart peaceful and your dreams within reach. Wishing you a Diwali full of happiness, success and beautiful memories.`,

  friend: n =>
    `Dear ${n}, life feels brighter with good friends around. May this Diwali bring you exciting opportunities, laughter, good health and memories that stay forever. Happy Diwali!`,

  default: n =>
    `Dear ${n}, may the light of Diwali remove every worry and fill your days with peace, prosperity and new beginnings. Wishing you and your loved ones a beautiful festival.`
};

function greetingFor(relation, name) {
  return (
    specialGreetings[String(relation || "").trim().toLowerCase()]
    || specialGreetings.default
  )(name);
}

// SAVE DATA THROUGH BACKEND
async function saveUserData(data) {
  if (!sessionToken) {
    throw new Error("Your session has expired. Please log in again.");
  }

  const result = await serverCall("saveDiwaliData", sessionToken, data);

  if (!result || !result.ok) {
    throw new Error(result && result.message || "Could not save your details.");
  }

  return true;
}

// USER PROFILE
$("profileForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!$("profileConsent").checked) {
    return setStatus("profileStatus", "Please confirm your consent.");
  }

  profile = {
    name: $("yourName").value.trim(),
    gender: $("yourGender").value,
    dob: $("yourDob").value,
    relationship: $("yourRelation").value
  };

  try {
    setStatus("profileStatus", "Saving your details...");

    await saveUserData({
      type: "surprise_profile",
      ...profile,
      consent: true
    });

    $("greetingName").textContent = profile.name;

    $("relationTitle").textContent =
      `A ${profile.relationship.toLowerCase()}-special Diwali wish`;

    $("personalMessage").textContent =
      greetingFor(profile.relationship, profile.name);

    $("personalGreeting").classList.remove("hidden");

    setStatus(
      "profileStatus",
      "Your details have been saved in Shriom's Google Sheet."
    );

    $("personalGreeting").scrollIntoView({ behavior: "smooth" });

  } catch (error) {
    setStatus("profileStatus", authError(error));
  }
});

// FIREWORKS
function launchFireworks(bursts = 6) {
  const canvas = $("fireworks");
  const ctx = canvas.getContext("2d");
  const dpr = Math.min(window.devicePixelRatio || 1, 2);

  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;
  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = [];

  for (let b = 0; b < bursts; b++) {
    const x = Math.random() * innerWidth;
    const y = Math.random() * innerHeight * .55 + 25;
    const hue = Math.random() * 360;

    for (let i = 0; i < 46; i++) {
      const angle = Math.PI * 2 * i / 46;
      const speed = 1.1 + Math.random() * 3.2;

      particles.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 65,
        hue
      });
    }
  }

  let frame = 0;

  function draw() {
    ctx.clearRect(0, 0, innerWidth, innerHeight);

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += .025;
      p.life--;

      ctx.beginPath();
      ctx.arc(p.x, p.y, 2, 0, Math.PI * 2);
      ctx.fillStyle =
        `hsla(${p.hue},100%,70%,${Math.max(0, p.life / 65)})`;
      ctx.fill();
    });

    if (++frame < 90 && particles.some(p => p.life > 0)) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(0, 0, innerWidth, innerHeight);
    }
  }

  draw();
}

// POP SOUND
function playPop() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;

    const audio = new AudioCtx();
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "triangle";
    oscillator.frequency.setValueAtTime(520, audio.currentTime);
    oscillator.frequency.exponentialRampToValueAtTime(
      85, audio.currentTime + .13
    );

    gain.gain.setValueAtTime(.16, audio.currentTime);
    gain.gain.exponentialRampToValueAtTime(
      .001, audio.currentTime + .15
    );

    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start();
    oscillator.stop(audio.currentTime + .16);
    oscillator.onended = () => audio.close();

  } catch (error) {
    console.warn(error);
  }
}

// DIYA LIGHTING
$("lightDiya").addEventListener("click", () => {
  $("diya").classList.add("lit");

  setStatus(
    "diyaStatus",
    "Your diya is glowing. May your year be bright! 🪔"
  );

  playPop();
  launchFireworks(7);
});

$("moreFireworks").addEventListener("click", () => {
  playPop();
  launchFireworks(10);
});

// WISH SOMEONE
$("wishForm").addEventListener("submit", async event => {
  event.preventDefault();

  const recipient = $("recipientName").value.trim();
  const relation = $("recipientRelation").value;
  const sender = $("senderName").value.trim();
  const ownMessage = $("senderMessage").value.trim();

  latestWishText =
    `🪔 Happy Diwali, ${recipient}!\n\n` +
    `${greetingFor(relation, recipient)}\n\n` +
    `${ownMessage ? ownMessage + "\n\n" : ""}` +
    `With love,\n${sender}`;

  $("wishTitle").textContent = `Happy Diwali, ${recipient}! 🪔`;
  $("wishText").textContent = latestWishText;
  $("wishResult").classList.remove("hidden");

  try {
    setStatus("wishStatus", "Saving your greeting...");

    await saveUserData({
      type: "personal_wish",
      recipientName: recipient,
      recipientGender: $("recipientGender").value,
      recipientRelation: relation,
      senderName: sender,
      senderMessage: ownMessage,
      generatedGreeting: latestWishText,
      consent: true
    });

    setStatus("wishStatus", "Greeting saved in Shriom's Google Sheet.");

  } catch (error) {
    setStatus("wishStatus", authError(error));
  }
});

// SHARE GREETING
$("shareWish").addEventListener("click", async () => {
  if (!latestWishText) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "A Diwali wish",
        text: latestWishText
      });
    } catch (error) {
      // User may cancel the share sheet.
    }
  } else {
    window.open(
      "https://wa.me/?text=" + encodeURIComponent(latestWishText),
      "_blank",
      "noopener"
    );
  }
});

// COPY GREETING
$("copyWish").addEventListener("click", async () => {
  try {
    await navigator.clipboard.writeText(latestWishText);
    setStatus("wishStatus", "Greeting copied.");
  } catch (error) {
    setStatus(
      "wishStatus",
      "Clipboard unavailable. Use Share greeting."
    );
  }
});

// SECRET NOTE
$("noteForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!$("noteConsent").checked) {
    return setStatus("noteStatus", "Please confirm your consent.");
  }

  try {
    await saveUserData({
      type: "secret_note",
      note: $("secretNote").value.trim(),
      consent: true,
      senderName: profile.name || (currentUser && currentUser.displayName) || ""
    });

    setStatus(
      "noteStatus",
      "Your note has been saved. Thank you for sharing Diwali love. 💗"
    );

    $("secretNote").value = "";

  } catch (error) {
    setStatus("noteStatus", authError(error));
  }
});

// RESTORE LOGIN SESSION
restoreSession();
