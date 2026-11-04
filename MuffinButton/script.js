const muffinButton = document.getElementById("muffinButton");
const cookieButton = document.getElementById("cookieButton");
const senzuButton = document.getElementById("senzuButton");
const muffinArea = document.getElementById("muffinArea");
const muffinSound = new Audio("muffin-button.mp3");
const cookieSound = new Audio("cookie-button.mp3");
const senzuSound = new Audio("senzu-button.mp3");
senzuSound.preload = "auto";

muffinSound.volume = 1.0;

// ============================================================
// SOUND
// ============================================================

function playSound(type) {
    var soundSource = type === "muffin" ? muffinSound : cookieSound;
    soundSource.currentTime = 0;
    soundSource.play().catch(error => console.warn("Could not play sound:", error));
}

// ============================================================
// URL SETTINGS
// ============================================================

const params = new URLSearchParams(window.location.search);

function getNumber(name, defaultValue) {
    const value = parseFloat(params.get(name));
    return Number.isFinite(value) ? value : defaultValue;
}

function getString(name, defaultValue) {
    const value = params.get(name);
    return value !== null && value.trim() !== "" ? value.trim() : defaultValue;
}

function getBoolean(name, defaultValue) {
    const value = params.get(name);
    if (value === null) return defaultValue;
    return value.toLowerCase() === "true";
}

let minMuffins = Math.max(1, Math.floor(getNumber("min", 1)));
let maxMuffins = Math.max(minMuffins, Math.floor(getNumber("max", 3)));

const SETTINGS = {
    channel: getString("channel", ""),
    gravity: getNumber("gravity", 900),
    bounce: getNumber("bounce", 0.45),
    friction: getNumber("friction", 0.995),
    spin: getNumber("spin", 5),
    rotationFriction: getNumber("rotationFriction", 0.998),
    rotationStopSpeed: getNumber("rotationStopSpeed", 0.5),
    restingRotationFriction: getNumber("restingRotationFriction", 0.85),
    lifetime: getNumber("lifetime", 10),
    maxMuffins: Math.max(1, Math.floor(getNumber("maxMuffins", 50))),
    baseSize: getNumber("size", 100),
    collisionSize: getNumber("collisionSize", 0.5),
    collisionBounce: getNumber("collisionBounce", 0.35)
};

const buttonContainer = document.getElementById("buttonContainer");
let controlsVisible = false;

const commandStorageKey = "enabledChatCommands";
const enabledCommands = { muffin: true, cookie: true, senzu: true };
try {
    const saved = JSON.parse(localStorage.getItem(commandStorageKey));
    for (const command of Object.keys(enabledCommands)) {
        if (saved && typeof saved[command] === "boolean") enabledCommands[command] = saved[command];
    }
} catch (error) { /* Use defaults when storage is unavailable or invalid. */ }

for (const command of Object.keys(enabledCommands)) {
    const toggle = document.getElementById(`${command}CommandEnabled`);
    toggle.checked = enabledCommands[command];
    toggle.addEventListener("change", () => {
        enabledCommands[command] = toggle.checked;
        try {
            localStorage.setItem(commandStorageKey, JSON.stringify(enabledCommands));
        } catch (error) {
            console.warn("Chat command settings could not be saved; they apply until this page closes.", error);
        }
    });
}

const targetPicker = document.getElementById("targetPicker");
const targetMarker = document.getElementById("targetMarker");
const targetSettings = document.getElementById("targetSettings");
const targetButton = document.getElementById("targetButton");
const targetUrl = document.getElementById("targetUrl");
const targetStorageKey = "senzuTarget";
const clampUnit = value => Math.max(0, Math.min(1, value));
let senzuTarget = null;
try {
    const saved = JSON.parse(localStorage.getItem(targetStorageKey));
    if (saved && Number.isFinite(saved.x) && Number.isFinite(saved.y)) {
        senzuTarget = { x: clampUnit(saved.x), y: clampUnit(saved.y) };
    }
} catch (error) { /* Storage may be unavailable in an OBS browser source. */ }
if (params.has("senzuX") && params.has("senzuY")) {
    senzuTarget = { x: clampUnit(getNumber("senzuX", 0.5)), y: clampUnit(getNumber("senzuY", 0.5)) };
}

function showTargetSettings() {
    targetSettings.hidden = !controlsVisible || !senzuTarget;
    targetMarker.hidden = !controlsVisible || !senzuTarget;
    if (!senzuTarget) return;
    targetMarker.style.left = `${senzuTarget.x * 100}%`;
    targetMarker.style.top = `${senzuTarget.y * 100}%`;
    const url = new URL(window.location.href);
    url.searchParams.set("senzuX", senzuTarget.x.toFixed(6));
    url.searchParams.set("senzuY", senzuTarget.y.toFixed(6));
    url.searchParams.set("button", "false");
    targetUrl.value = url.href;
}

function closeTargetPicker() {
    targetPicker.hidden = true;
    targetButton.setAttribute("aria-pressed", "false");
}

function setControlsVisible(visible) {
    controlsVisible = visible;
    buttonContainer.hidden = !visible;
    if (!visible) {
        closeTargetPicker();
        // Release focus so a hidden button cannot keep receiving keyboard input.
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur();
    }
    showTargetSettings();
}

// Pointer/touch clicks and keyboard input reveal the controls; chat events do not.
document.addEventListener("click", () => setControlsVisible(true));
document.getElementById("hideControlsButton").addEventListener("click", event => {
    event.stopPropagation();
    setControlsVisible(false);
});
targetButton.addEventListener("click", () => {
    targetPicker.hidden = false;
    targetButton.setAttribute("aria-pressed", "true");
});
targetPicker.addEventListener("click", event => {
    senzuTarget = { x: clampUnit(event.clientX / window.innerWidth), y: clampUnit(event.clientY / window.innerHeight) };
    try { localStorage.setItem(targetStorageKey, JSON.stringify(senzuTarget)); } catch (error) { /* URL still works. */ }
    closeTargetPicker();
    showTargetSettings();
});
document.addEventListener("keydown", event => {
    if (event.key === "Escape") {
        setControlsVisible(false);
    } else if (!event.repeat && !["Shift", "Control", "Alt", "Meta"].includes(event.key)) {
        setControlsVisible(true);
    }
});
document.getElementById("resetTargetButton").addEventListener("click", () => {
    senzuTarget = null;
    try { localStorage.removeItem(targetStorageKey); } catch (error) { /* Storage is optional. */ }
    const url = new URL(window.location.href);
    url.searchParams.delete("senzuX");
    url.searchParams.delete("senzuY");
    window.history.replaceState(null, "", url.href);
    closeTargetPicker();
    showTargetSettings();
});
targetUrl.addEventListener("click", () => targetUrl.select());
showTargetSettings();

// ============================================================
// STATE
// ============================================================

const muffins = [];
const beans = [];

// Follow the audio clock so loading delays and dropped frames cannot shift impact.
function throwSenzu() {
    // Keep an in-flight throw aimed at the target selected when it was triggered.
    const target = senzuTarget ? { ...senzuTarget } : null;
    const sound = senzuSound.cloneNode();
    sound.play().then(() => {
        const element = document.createElement("img");
        const size = Math.max(1, Math.min(SETTINGS.baseSize, window.innerWidth, window.innerHeight));
        element.src = "senzu.png";
        element.className = "muffin";
        element.alt = "Senzu bean";
        element.draggable = false;
        element.style.width = `${size}px`;
        element.style.height = `${size}px`;
        element.style.objectFit = "contain";
        const fromLeft = !target || target.x >= 0.5;
        const startX = fromLeft ? -size : window.innerWidth;
        element.style.left = `${startX}px`;
        element.style.top = `${Math.max(0, (window.innerHeight - size) * 0.4)}px`;
        while (beans.length >= SETTINGS.maxMuffins) removeBean(beans[0]);
        muffinArea.appendChild(element);
        beans.push({ element, sound, size, target, fromLeft, x: startX, y: 0, rotation: 0,
            impacted: false, fallTime: 0, velocityX: 0, velocityY: 0 });
    }).catch(error => console.warn("Could not play senzu sound:", error));
}

function removeBean(bean) {
    beans.splice(beans.indexOf(bean), 1);
    bean.sound.pause();
    bean.element.remove();
}

function updateBeans(deltaTime) {
    for (let i = beans.length - 1; i >= 0; i--) {
        const bean = beans[i];
        const wallX = Math.max(0, window.innerWidth - bean.size);
        if (!bean.impacted) {
            // Hit 120 ms before the clip finishes, using its actual metadata.
            if (!Number.isFinite(bean.sound.duration) || bean.sound.duration <= 0) continue;
            const impactTime = Math.max(0.01, bean.sound.duration - 0.12);
            const progress = Math.min(1, bean.sound.currentTime / impactTime);
            const targetX = bean.target ? Math.max(0, Math.min(wallX, bean.target.x * window.innerWidth - bean.size / 2)) : wallX;
            const targetY = bean.target ? Math.max(0, Math.min(window.innerHeight - bean.size, bean.target.y * window.innerHeight - bean.size / 2)) : Math.max(0, (window.innerHeight - bean.size) * 0.4);
            const startX = bean.fromLeft ? -bean.size : window.innerWidth;
            const direction = bean.fromLeft ? 1 : -1;
            bean.x = startX + (targetX - startX) * progress;
            // A shallow arc lands exactly on the chosen point at impactTime.
            const arc = bean.target ? Math.min(120, targetY) : 0;
            bean.y = targetY - 4 * arc * progress * (1 - progress);
            bean.rotation = direction * progress * 720;
            if (progress >= 1 || bean.sound.ended) {
                bean.x = targetX;
                bean.y = targetY;
                bean.impacted = true;
                bean.velocityX = -direction * Math.min(500, Math.max(120, Math.abs(targetX - startX) / impactTime * 0.45));
                bean.velocityY = 80;
            }
        } else {
            bean.fallTime += deltaTime;
            bean.velocityY += Math.max(100, SETTINGS.gravity) * deltaTime;
            bean.x += bean.velocityX * deltaTime;
            bean.y += bean.velocityY * deltaTime;
            bean.rotation -= (bean.fromLeft ? 1 : -1) * 360 * deltaTime;
        }
        bean.element.style.left = `${bean.x}px`;
        bean.element.style.top = `${bean.y}px`;
        bean.element.style.transform = `rotate(${bean.rotation}deg)`;
        if (bean.impacted && (bean.y > window.innerHeight || bean.fallTime > 10)) removeBean(bean);
    }
}

// ============================================================
// RANDOM
// ============================================================

function randomInt(min, max) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

// ============================================================
// SPAWN
// ============================================================

function spawnObjects(type, amount) {
    amount = Math.max(0, Math.floor(amount));
    if (amount <= 0) return;

    playSound(type);

    for (let i = 0; i < amount; i++) {
        spawnObject(type);
    }
}

function spawnObject(type) {
    while (muffins.length >= SETTINGS.maxMuffins) {
        removeMuffin(muffins[0]);
    }

    const element = document.createElement("img");
    element.src = type === "muffin" ? "muffin.webp" : "cookie.png";
    element.className = "muffin";
    element.draggable = false;

    const size = SETTINGS.baseSize * (0.75 + Math.random() * 0.5);

    const muffin = {
        element,
        width: size,
        height: size,
        x: Math.random() * Math.max(1, window.innerWidth - size),
        y: -size,
        velocityX: (Math.random() - 0.5) * 250,
        velocityY: 50 + Math.random() * 100,
        rotation: Math.random() * 360,
        rotationSpeed: (Math.random() - 0.5) * SETTINGS.spin * 100,
        age: 0
    };

    element.style.width = `${size}px`;
    element.style.height = `${size}px`;
    element.style.left = `${muffin.x}px`;
    element.style.top = `${muffin.y}px`;
    element.style.transform = `rotate(${muffin.rotation}deg)`;

    muffinArea.appendChild(element);
    muffins.push(muffin);
}

// ============================================================
// MANUAL BUTTON
// ============================================================

muffinButton.addEventListener("click", () => {
    const amount = randomInt(minMuffins, maxMuffins);
    console.log(`Manual spawn: ${amount} muffins`);
    spawnObjects("muffin", amount);
});

cookieButton.addEventListener("click", () => {
    const amount = randomInt(minMuffins, maxMuffins);
    console.log(`Manual spawn: ${amount} cookies`);
    spawnObjects("cookie", amount);
});

senzuButton.addEventListener("click", throwSenzu);

// ============================================================
// TWITCH / COMFYJS
// ============================================================

function connectToTwitch() {
    if (!SETTINGS.channel) {
        console.log("Muffin overlay: no Twitch channel configured.");
        return;
    }

    if (typeof ComfyJS === "undefined") {
        console.error("Muffin overlay: ComfyJS was not loaded.");
        return;
    }

    console.log(`Muffin overlay: connecting to ${SETTINGS.channel}`);

    ComfyJS.onCommand = function(user, command, message, flags, extra) {
        command = command.toLowerCase();
        if (!Object.hasOwn(enabledCommands, command) || !enabledCommands[command]) return;
        if (command === "senzu") {
            throwSenzu();
            return;
        }
        if (command !== "muffin" && command !== "cookie") return;

        const amount = randomInt(minMuffins, maxMuffins);
        console.log(`${user} used !${command}! Spawning ${amount} ${command}s.`);
        spawnObjects(command, amount);
    };

    ComfyJS.Init(SETTINGS.channel);
}

connectToTwitch();

// ============================================================
// MUFFIN COLLISIONS
// ============================================================

function resolveMuffinCollisions() {
    for (let i = 0; i < muffins.length; i++) {
        const a = muffins[i];

        for (let j = i + 1; j < muffins.length; j++) {
            const b = muffins[j];

            const aCenterX = a.x + a.width / 2;
            const aCenterY = a.y + a.height / 2;
            const bCenterX = b.x + b.width / 2;
            const bCenterY = b.y + b.height / 2;

            const dx = bCenterX - aCenterX;
            const dy = bCenterY - aCenterY;

            const aCollisionWidth = a.width * SETTINGS.collisionSize;
            const aCollisionHeight = a.height * SETTINGS.collisionSize;
            const bCollisionWidth = b.width * SETTINGS.collisionSize;
            const bCollisionHeight = b.height * SETTINGS.collisionSize;

            const overlapX = (aCollisionWidth + bCollisionWidth) / 2 - Math.abs(dx);
            const overlapY = (aCollisionHeight + bCollisionHeight) / 2 - Math.abs(dy);

            if (overlapX <= 0 || overlapY <= 0) continue;

            // Horizontal collision

            if (overlapX < overlapY) {
                const direction = dx < 0 ? -1 : 1;
                const push = overlapX / 2;

                a.x -= direction * push;
                b.x += direction * push;

                const velocityA = a.velocityX;
                const velocityB = b.velocityX;

                a.velocityX = velocityB * SETTINGS.collisionBounce;
                b.velocityX = velocityA * SETTINGS.collisionBounce;

                const spinTransfer = (velocityA - velocityB) * 0.02;

                a.rotationSpeed += spinTransfer;
                b.rotationSpeed -= spinTransfer;
            }

            // Vertical collision

            else {
                const direction = dy < 0 ? -1 : 1;
                const push = overlapY / 2;

                a.y -= direction * push;
                b.y += direction * push;

                const relativeVelocity = b.velocityY - a.velocityY;

                if (relativeVelocity * direction < 0) {
                    const velocityA = a.velocityY;
                    const velocityB = b.velocityY;

                    a.velocityY = velocityB * SETTINGS.collisionBounce;
                    b.velocityY = velocityA * SETTINGS.collisionBounce;
                }

                const horizontalA = a.velocityX;
                const horizontalB = b.velocityX;

                a.velocityX = horizontalB * 0.15 + horizontalA * 0.85;
                b.velocityX = horizontalA * 0.15 + horizontalB * 0.85;

                const spinTransfer = (horizontalA - horizontalB) * 0.01;

                a.rotationSpeed += spinTransfer;
                b.rotationSpeed -= spinTransfer;

                // Dampen rotation when objects are resting against each other

                if (Math.abs(relativeVelocity) < 30) {
                    a.rotationSpeed *= SETTINGS.restingRotationFriction;
                    b.rotationSpeed *= SETTINGS.restingRotationFriction;
                }
            }
        }
    }
}

// ============================================================
// PHYSICS
// ============================================================

let lastTime = performance.now();

function update(currentTime) {
    const deltaTime = Math.min((currentTime - lastTime) / 1000, 0.05);
    lastTime = currentTime;
    updateBeans(deltaTime);

    // Individual physics

    for (let i = muffins.length - 1; i >= 0; i--) {
        const muffin = muffins[i];

        muffin.age += deltaTime;

        // Gravity

        muffin.velocityY += SETTINGS.gravity * deltaTime;

        // Air friction

        const friction = Math.pow(SETTINGS.friction, deltaTime * 60);
        muffin.velocityX *= friction;
        muffin.velocityY *= friction;

        // Rotation friction

        muffin.rotationSpeed *= Math.pow(SETTINGS.rotationFriction, deltaTime * 60);

        if (Math.abs(muffin.rotationSpeed) < SETTINGS.rotationStopSpeed) {
            muffin.rotationSpeed = 0;
        }

        // Movement

        muffin.x += muffin.velocityX * deltaTime;
        muffin.y += muffin.velocityY * deltaTime;

        // Rotation

        muffin.rotation += muffin.rotationSpeed * deltaTime;

        // Left wall

        if (muffin.x < 0) {
            muffin.x = 0;
            muffin.velocityX = Math.abs(muffin.velocityX) * SETTINGS.bounce;
            muffin.rotationSpeed *= 0.85;
        }

        // Right wall

        if (muffin.x + muffin.width > window.innerWidth) {
            muffin.x = window.innerWidth - muffin.width;
            muffin.velocityX = -Math.abs(muffin.velocityX) * SETTINGS.bounce;
            muffin.rotationSpeed *= 0.85;
        }

        // Floor

        if (muffin.y + muffin.height > window.innerHeight) {
            muffin.y = window.innerHeight - muffin.height;
            muffin.velocityY = -Math.abs(muffin.velocityY) * SETTINGS.bounce;
            muffin.velocityX *= 0.92;

            muffin.rotationSpeed += muffin.velocityX * 0.2;
            muffin.rotationSpeed *= 0.85;
        }
    }

    // Muffin collisions

    resolveMuffinCollisions();

    // Render and lifetime

    for (let i = muffins.length - 1; i >= 0; i--) {
        const muffin = muffins[i];

        muffin.element.style.left = `${muffin.x}px`;
        muffin.element.style.top = `${muffin.y}px`;
        muffin.element.style.transform = `rotate(${muffin.rotation}deg)`;

        if (muffin.age >= SETTINGS.lifetime) {
            removeMuffin(muffin);
        }
    }

    requestAnimationFrame(update);
}

requestAnimationFrame(update);

// ============================================================
// REMOVE MUFFIN
// ============================================================

function removeMuffin(muffin) {
    const index = muffins.indexOf(muffin);
    if (index === -1) return;

    muffins.splice(index, 1);
    muffin.element.remove();
}

// ============================================================
// RESIZE
// ============================================================

window.addEventListener("resize", () => {
    for (const muffin of muffins) {
        muffin.x = Math.max(0, Math.min(muffin.x, window.innerWidth - muffin.width));
        muffin.y = Math.min(muffin.y, window.innerHeight - muffin.height);
    }
});
