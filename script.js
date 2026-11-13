/*************************************************
 SHRIOM'S DIWALI SURPRISE
 FRONTEND JAVASCRIPT — BACKEND COMPATIBLE
*************************************************/

const $ = id => document.getElementById(id);

let currentUser = null;
let sessionToken = sessionStorage.getItem(APP_CONFIG.SESSION_KEY) || "";
let profile = {};
let latestWishText = "";

const USER_DOMAIN = "users.example.com";

// -------------------------------------------------
// 1. STATUS MESSAGE
// -------------------------------------------------

function setStatus(id, message) {
  const node = $(id);
  if (node) node.textContent = message;
}

function authError(error) {
  return error?.message || "Something went wrong. Please try again.";
}

// -------------------------------------------------
// 2. API CONNECTION
// Worker request format: { method, args }
// -------------------------------------------------

async function serverCall(method, ...args) {
  if (!APP_CONFIG.API_URL ||
      APP_CONFIG.API_URL.includes("PASTE_")) {
    throw new Error("API URL is missing in config.js.");
  }

  let response;

  try {
    response = await fetch(APP_CONFIG.API_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        method: method,
        args: args
      })
    });
  } catch (error) {
    throw new Error(
      "Could not reach the API. Check your internet and Cloudflare Worker."
    );
  }

  let result;

  try {
    result = await response.json();
  } catch (error) {
    throw new Error("The API returned an invalid response.");
  }

  if (!response.ok || result.success === false) {
    throw new Error(result.message || "API request failed.");
  }

  return result;
}

// -------------------------------------------------
// 3. USER INFORMATION
// -------------------------------------------------

function formatUser(user) {
  if (!user) {
    throw new Error("User information was not returned by the server.");
  }

  return {
    userId: user.user_id,
    displayName: user.full_name,
    email: user.email,
    username: user.email ? user.email.split("@")[0] : ""
  };
}

function showSignedIn(user) {
  currentUser = user;

  $("authScreen").classList.add("hidden");
  $("giftScreen").classList.remove("hidden");
  $("appScreen").classList.add("hidden");

  $("yourName").value = user.displayName || "";
  $("senderName").value = user.displayName || "";
}

function showSignedOut() {
  currentUser = null;
  sessionToken = "";
  profile = {};

  sessionStorage.removeItem(APP_CONFIG.SESSION_KEY);

  $("authScreen").classList.remove("hidden");
  $("giftScreen").classList.add("hidden");
  $("appScreen").classList.add("hidden");
}

// -------------------------------------------------
// 4. LOGIN / SIGNUP TAB SWITCH
// -------------------------------------------------

function switchAuth(signup) {
  $("signupForm").classList.toggle("hidden", !signup);
  $("loginForm").classList.toggle("hidden", signup);

  $("showSignup").classList.toggle("active", signup);
  $("showLogin").classList.toggle("active", !signup);

  setStatus("authStatus", "");
}

$("showSignup").addEventListener("click", () => {
  switchAuth(true);
});

$("showLogin").addEventListener("click", () => {
  switchAuth(false);
});

// -------------------------------------------------
// 5. USERNAME CONVERSION
// Existing backend expects an email field.
// This creates an internal username identifier.
// It does not send an email to the user.
// -------------------------------------------------

function usernameToEmail(username) {
  const cleanUsername = String(username || "")
    .trim()
    .toLowerCase();

  if (!/^[a-z0-9_]{4,24}$/.test(cleanUsername)) {
    throw new Error(
      "Username must be 4-24 characters using letters, numbers or underscore."
    );
  }

  return cleanUsername + "@" + USER_DOMAIN;
}

// -------------------------------------------------
// 6. CREATE ACCOUNT
// Backend function:
// registerAccount(fullName, email, password)
// -------------------------------------------------

$("signupForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!$("privacyConsent").checked) {
    setStatus("authStatus", "Please accept the data notice.");
    return;
  }

  const username = $("signupUsername").value.trim();
  const fullName = $("signupName").value.trim();
  const password = $("signupPassword").value;

  if (!fullName) {
    setStatus("authStatus", "Please enter your display name.");
    return;
  }

  if (password.length < 10) {
    setStatus(
      "authStatus",
      "Password must contain at least 10 characters."
    );
    return;
  }

  let email;

  try {
    email = usernameToEmail(username);
  } catch (error) {
    setStatus("authStatus", authError(error));
    return;
  }

  try {
    setStatus("authStatus", "Creating your account...");

    // IMPORTANT:
    // Backend ko teen separate arguments bhejne hain.
    const registration = await serverCall(
      "registerAccount",
      fullName,
      email,
      password
    );

    if (!registration.success) {
      throw new Error(
        registration.message || "Account creation failed."
      );
    }

    setStatus("authStatus", "Account created. Signing you in...");

    // Registration ke baad login request.
    const loginResult = await serverCall(
      "loginAccount",
      email,
      password
    );

    if (!loginResult.token) {
      throw new Error(
        "Account created, but login token was not returned."
      );
    }

    sessionToken = loginResult.token;

    sessionStorage.setItem(
      APP_CONFIG.SESSION_KEY,
      sessionToken
    );

    showSignedIn(formatUser(loginResult.user));

    setStatus("authStatus", "");

  } catch (error) {
    setStatus("authStatus", authError(error));

  } finally {
    $("signupPassword").value = "";
  }
});

// -------------------------------------------------
// 7. LOGIN
// Backend function:
// loginAccount(email, password)
// -------------------------------------------------

$("loginForm").addEventListener("submit", async event => {
  event.preventDefault();

  const username = $("loginUsername").value.trim();
  const password = $("loginPassword").value;

  let email;

  try {
    email = usernameToEmail(username);
  } catch (error) {
    setStatus("authStatus", authError(error));
    return;
  }

  try {
    setStatus("authStatus", "Checking your account...");

    const result = await serverCall(
      "loginAccount",
      email,
      password
    );

    if (!result.token) {
      throw new Error("Login token was not returned.");
    }

    sessionToken = result.token;

    sessionStorage.setItem(
      APP_CONFIG.SESSION_KEY,
      sessionToken
    );

    showSignedIn(formatUser(result.user));

    setStatus("authStatus", "");

  } catch (error) {
    setStatus("authStatus", authError(error));

  } finally {
    $("loginPassword").value = "";
  }
});

// -------------------------------------------------
// 8. RESTORE LOGIN SESSION
// Backend function:
// getSessionUser(sessionToken)
// -------------------------------------------------

async function restoreSession() {
  if (!sessionToken) {
    showSignedOut();
    return;
  }

  try {
    const result = await serverCall(
      "getSessionUser",
      sessionToken
    );

    showSignedIn(formatUser(result.user));

  } catch (error) {
    showSignedOut();
  }
}

// -------------------------------------------------
// 9. LOGOUT
// Backend function:
// logoutAccount(sessionToken)
// -------------------------------------------------

async function logout() {
  try {
    if (sessionToken) {
      await serverCall(
        "logoutAccount",
        sessionToken
      );
    }
  } catch (error) {
    console.warn("Logout request:", error);
  }

  showSignedOut();
  switchAuth(false);
}

$("logoutBtn").addEventListener("click", logout);
$("logoutFromGift").addEventListener("click", logout);

// -------------------------------------------------
// 10. OPEN GIFT
// -------------------------------------------------

$("openGift").addEventListener("click", () => {
  $("giftScreen").classList.add("hidden");
  $("appScreen").classList.remove("hidden");

  $("unwrap").scrollIntoView({
    behavior: "smooth"
  });

  playPop();
  launchFireworks(5);
});

// -------------------------------------------------
// 11. PERSONALIZED DIWALI GREETINGS
// -------------------------------------------------

const specialGreetings = {

  brother: name =>
    `Dear ${name}, may your courage stay strong, your dreams keep growing and your life be filled with success. Thank you for the fun, support and unforgettable memories. Happy Diwali, brother!`,

  sister: name =>
    `Dear ${name}, may your smile shine brighter than every diya and may every dream find its way to you. Keep spreading your warmth and beautiful energy. Wishing you love, laughter and a sparkling Diwali, sister!`,

  girlfriend: name =>
    `My dearest ${name}, may this Diwali fill your world with the same warmth and happiness you bring into mine. May every light remind you how special you are. Keep smiling, keep shining and may all your dreams come true. Happy Diwali!`,

  boyfriend: name =>
    `Dear ${name}, may your path always be bright, your heart peaceful and your dreams within reach. Wishing you a Diwali full of happiness, success and beautiful memories.`,

  friend: name =>
    `Dear ${name}, life feels brighter with good friends around. May this Diwali bring you exciting opportunities, laughter, good health and memories that stay forever. Happy Diwali!`,

  default: name =>
    `Dear ${name}, may the light of Diwali remove every worry and fill your days with peace, prosperity and new beginnings. Wishing you and your loved ones a beautiful festival.`
};

function greetingFor(relation, name) {
  const key = String(relation || "")
    .trim()
    .toLowerCase();

  return (
    specialGreetings[key] ||
    specialGreetings.default
  )(name);
}

// -------------------------------------------------
// 12. SAVE DATA TO GOOGLE SHEETS
// Backend function:
// saveDiwaliData(sessionToken, data)
// -------------------------------------------------

async function saveUserData(data) {
  if (!sessionToken) {
    throw new Error(
      "Your session has expired. Please log in again."
    );
  }

  const result = await serverCall(
    "saveDiwaliData",
    sessionToken,
    data
  );

  if (!result.success) {
    throw new Error(
      result.message || "Could not save your details."
    );
  }

  return result;
}

// -------------------------------------------------
// 13. USER PROFILE
// NOTE:
// Existing Google Sheet schema does not have DOB
// and gender columns. They are not saved.
// -------------------------------------------------

$("profileForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!$("profileConsent").checked) {
    setStatus(
      "profileStatus",
      "Please confirm your consent."
    );
    return;
  }

  profile = {
    name: $("yourName").value.trim(),
    gender: $("yourGender").value,
    dob: $("yourDob").value,
    relationship: $("yourRelation").value
  };

  if (!profile.name || !profile.relationship) {
    setStatus(
      "profileStatus",
      "Please enter your name and relationship."
    );
    return;
  }

  const greeting = greetingFor(
    profile.relationship,
    profile.name
  );

  try {
    setStatus(
      "profileStatus",
      "Saving your Diwali details..."
    );

    await saveUserData({
      recipient_name: profile.name,
      relationship: profile.relationship,
      greeting_message: greeting,
      secret_note: ""
    });

    $("greetingName").textContent = profile.name;

    $("relationTitle").textContent =
      `A special Diwali wish for ${profile.name}`;

    $("personalMessage").textContent = greeting;

    $("personalGreeting").classList.remove("hidden");

    setStatus(
      "profileStatus",
      "Your Diwali details have been saved."
    );

    $("personalGreeting").scrollIntoView({
      behavior: "smooth"
    });

    playPop();
    launchFireworks(7);

  } catch (error) {
    setStatus("profileStatus", authError(error));
  }
});

// -------------------------------------------------
// 14. FIREWORKS ANIMATION
// -------------------------------------------------

function launchFireworks(bursts = 6) {
  const canvas = $("fireworks");
  const ctx = canvas.getContext("2d");

  const dpr = Math.min(
    window.devicePixelRatio || 1,
    2
  );

  canvas.width = innerWidth * dpr;
  canvas.height = innerHeight * dpr;

  canvas.style.width = innerWidth + "px";
  canvas.style.height = innerHeight + "px";

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  const particles = [];

  for (let b = 0; b < bursts; b++) {
    const x = Math.random() * innerWidth;
    const y = Math.random() * innerHeight * 0.55 + 25;
    const hue = Math.random() * 360;

    for (let i = 0; i < 46; i++) {
      const angle = Math.PI * 2 * i / 46;
      const speed = 1.1 + Math.random() * 3.2;

      particles.push({
        x: x,
        y: y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 65,
        hue: hue
      });
    }
  }

  let frame = 0;

  function draw() {
    ctx.clearRect(
      0,
      0,
      innerWidth,
      innerHeight
    );

    particles.forEach(p => {
      p.x += p.vx;
      p.y += p.vy;
      p.vy += 0.025;
      p.life--;

      ctx.beginPath();

      ctx.arc(
        p.x,
        p.y,
        2,
        0,
        Math.PI * 2
      );

      ctx.fillStyle =
        `hsla(${p.hue},100%,70%,${Math.max(0, p.life / 65)})`;

      ctx.fill();
    });

    if (
      ++frame < 90 &&
      particles.some(p => p.life > 0)
    ) {
      requestAnimationFrame(draw);
    } else {
      ctx.clearRect(
        0,
        0,
        innerWidth,
        innerHeight
      );
    }
  }

  draw();
}

// -------------------------------------------------
// 15. POP SOUND
// -------------------------------------------------

function playPop() {
  try {
    const AudioCtx =
      window.AudioContext ||
      window.webkitAudioContext;

    if (!AudioCtx) return;

    const audio = new AudioCtx();

    const oscillator = audio.createOscillator();
    const gain = audio.createGain();

    oscillator.type = "triangle";

    oscillator.frequency.setValueAtTime(
      520,
      audio.currentTime
    );

    oscillator.frequency.exponentialRampToValueAtTime(
      85,
      audio.currentTime + 0.13
    );

    gain.gain.setValueAtTime(
      0.16,
      audio.currentTime
    );

    gain.gain.exponentialRampToValueAtTime(
      0.001,
      audio.currentTime + 0.15
    );

    oscillator.connect(gain);
    gain.connect(audio.destination);

    oscillator.start();
    oscillator.stop(audio.currentTime + 0.16);

    oscillator.onended = () => audio.close();

  } catch (error) {
    console.warn(error);
  }
}

// -------------------------------------------------
// 16. DIYA LIGHTING
// -------------------------------------------------

$("lightDiya").addEventListener("click", () => {
  $("diya").classList.add("lit");

  setStatus(
    "diyaStatus",
    "Your diya is glowing. May your year be bright! 🪔"
  );

  playPop();
  launchFireworks(7);
});

// -------------------------------------------------
// 17. MORE FIREWORKS BUTTON
// -------------------------------------------------

$("moreFireworks").addEventListener("click", () => {
  playPop();
  launchFireworks(10);
});

// -------------------------------------------------
// 18. CREATE PERSONALIZED WISH
// -------------------------------------------------

$("wishForm").addEventListener("submit", async event => {
  event.preventDefault();

  const recipient =
    $("recipientName").value.trim();

  const relation =
    $("recipientRelation").value;

  const sender =
    $("senderName").value.trim();

  const ownMessage =
    $("senderMessage").value.trim();

  if (!recipient || !relation) {
    setStatus(
      "wishStatus",
      "Please enter recipient name and relationship."
    );
    return;
  }

  latestWishText =
    `🪔 Happy Diwali, ${recipient}!\n\n` +
    `${greetingFor(relation, recipient)}\n\n` +
    `${ownMessage ? ownMessage + "\n\n" : ""}` +
    `With love,\n${sender}`;

  $("wishTitle").textContent =
    `Happy Diwali, ${recipient}! 🪔`;

  $("wishText").textContent = latestWishText;

  $("wishResult").classList.remove("hidden");

  try {
    setStatus(
      "wishStatus",
      "Saving your greeting..."
    );

    await saveUserData({
      recipient_name: recipient,
      relationship: relation,
      greeting_message: latestWishText,
      secret_note: ""
    });

    setStatus(
      "wishStatus",
      "Your greeting has been saved."
    );

  } catch (error) {
    setStatus("wishStatus", authError(error));
  }
});

// -------------------------------------------------
// 19. SHARE WISH
// -------------------------------------------------

$("shareWish").addEventListener("click", async () => {
  if (!latestWishText) return;

  if (navigator.share) {
    try {
      await navigator.share({
        title: "A Diwali wish",
        text: latestWishText
      });
    } catch (error) {
      // User cancelled the share window.
    }

  } else {
    window.open(
      "https://wa.me/?text=" +
      encodeURIComponent(latestWishText),
      "_blank",
      "noopener"
    );
  }
});

// -------------------------------------------------
// 20. COPY WISH
// -------------------------------------------------

$("copyWish").addEventListener("click", async () => {
  if (!latestWishText) return;

  try {
    await navigator.clipboard.writeText(
      latestWishText
    );

    setStatus(
      "wishStatus",
      "Greeting copied successfully."
    );

  } catch (error) {
    setStatus(
      "wishStatus",
      "Clipboard unavailable. Please use Share greeting."
    );
  }
});

// -------------------------------------------------
// 21. SAVE SECRET NOTE
// -------------------------------------------------

$("noteForm").addEventListener("submit", async event => {
  event.preventDefault();

  if (!$("noteConsent").checked) {
    setStatus(
      "noteStatus",
      "Please confirm your consent."
    );
    return;
  }

  const note = $("secretNote").value.trim();

  if (!note) {
    setStatus(
      "noteStatus",
      "Please write your note first."
    );
    return;
  }

  const recipientName =
    profile.name ||
    (currentUser && currentUser.displayName) ||
    "My Diwali note";

  const relationship =
    profile.relationship || "Other";

  try {
    setStatus(
      "noteStatus",
      "Saving your note..."
    );

    await saveUserData({
      recipient_name: recipientName,
      relationship: relationship,
      greeting_message: "",
      secret_note: note
    });

    $("secretNote").value = "";

    setStatus(
      "noteStatus",
      "Your secret note has been saved. 💗"
    );

  } catch (error) {
    setStatus("noteStatus", authError(error));
  }
});

// -------------------------------------------------
// 22. RESTORE SESSION WHEN WEBSITE LOADS
// -------------------------------------------------

restoreSession();

/*************************************************
 END OF SHRIOM'S DIWALI SURPRISE
*************************************************/
