const button = document.getElementById("muffinButton");
const muffinArea = document.getElementById("muffinArea");
const muffinSound = new Audio("muffin-button.mp3");

muffinSound.volume = 1.0;

function playMuffinSound() {
    muffinSound.currentTime = 0;
    muffinSound.play().catch(error => {
        console.warn("Could not play muffin sound:", error);
    });
}

// ============================================================
// URL SETTINGS
// ============================================================

const params = new URLSearchParams(window.location.search);

function getNumber(name, defaultValue) {
    const value = parseFloat(params.get(name));

    return Number.isFinite(value)
        ? value
        : defaultValue;
}

function getString(name, defaultValue) {
    const value = params.get(name);

    return value !== null && value.trim() !== ""
        ? value.trim()
        : defaultValue;
}


let minMuffins = Math.max(
    1,
    Math.floor(getNumber("min", 1))
);

let maxMuffins = Math.max(
    minMuffins,
    Math.floor(getNumber("max", 3))
);


const SETTINGS = {
    channel: getString("channel", ""),
    showButton: getBoolean("button", true),

    gravity: getNumber("gravity", 900),
    bounce: getNumber("bounce", 0.45),
    friction: getNumber("friction", 0.995),
    spin: getNumber("spin", 5),
    rotationFriction: getNumber("rotationFriction", 0.97),
    rotationStopSpeed: getNumber("rotationStopSpeed", 3),
    lifetime: getNumber("lifetime", 10),
    maxMuffins: Math.max(1, Math.floor(getNumber("maxMuffins", 50))),
    baseSize: getNumber("size", 100),
    collisionSize: getNumber("collisionSize", 0.5),
    collisionBounce: getNumber("collisionBounce", 0.35)
};

if (!SETTINGS.showButton) {
    button.style.display = "none";
}

function getBoolean(name, defaultValue) {
    const value = new URLSearchParams(window.location.search).get(name);

    if (value === null)
        return defaultValue;

    return value.toLowerCase() === "true";
}

// ============================================================
// STATE
// ============================================================

const muffins = [];


// ============================================================
// RANDOM
// ============================================================

function randomInt(min, max) {
    return Math.floor(
        Math.random() *
        (max - min + 1)
    ) + min;
}


// ============================================================
// SPAWN
// ============================================================

function spawnMuffins(amount) {

    amount = Math.max(
        0,
        Math.floor(amount)
    );

    if (amount <= 0)
        return;

    playMuffinSound();

    for (let i = 0; i < amount; i++) {
        spawnMuffin();
    }
}


function spawnMuffin() {

    // Keep muffin count under control

    while (
        muffins.length >=
        SETTINGS.maxMuffins
    ) {
        removeMuffin(muffins[0]);
    }


    const element =
        document.createElement("img");


    // Your actual muffin image

    element.src =
        "muffin.webp";

    element.className =
        "muffin";

    element.draggable =
        false;


    const size =
        SETTINGS.baseSize *
        (
            0.75 +
            Math.random() * 0.5
        );


    const muffin = {

        element,

        width: size,
        height: size,

        x:
            Math.random() *
            Math.max(
                1,
                window.innerWidth -
                size
            ),

        // Start above the screen

        y: -size,

        velocityX:
            (
                Math.random() -
                0.5
            ) * 250,

        velocityY:
            50 +
            Math.random() * 100,

        rotation:
            Math.random() * 360,

        rotationSpeed:
            (
                Math.random() -
                0.5
            ) *
            SETTINGS.spin *
            100,

        age: 0
    };


    element.style.width =
        `${size}px`;

    element.style.height =
        `${size}px`;

    element.style.left =
        `${muffin.x}px`;

    element.style.top =
        `${muffin.y}px`;

    element.style.transform =
        `rotate(${muffin.rotation}deg)`;


    muffinArea.appendChild(
        element
    );

    muffins.push(
        muffin
    );
}


// ============================================================
// MANUAL BUTTON
// ============================================================

button.addEventListener(
    "click",
    () => {

        const amount =
            randomInt(
                minMuffins,
                maxMuffins
            );


        console.log(
            `Manual spawn: ${amount} muffins`
        );


        spawnMuffins(
            amount
        );
    }
);


// ============================================================
// TWITCH
// ============================================================

function connectToTwitch() {

    if (!SETTINGS.channel) {

        console.log(
            "Muffin overlay: no Twitch channel configured."
        );

        return;
    }


    if (
        typeof ComfyJS ===
        "undefined"
    ) {

        console.error(
            "Muffin overlay: ComfyJS was not loaded."
        );

        return;
    }


    console.log(
        `Muffin overlay: connecting to ${SETTINGS.channel}`
    );


    ComfyJS.onChat = function (
        user,
        message,
        flags,
        self,
        extra
    ) {

        if (self)
            return;


if (!/!muffin\b/i.test(message)) {
    return;
}


        const amount =
            randomInt(
                minMuffins,
                maxMuffins
            );


        console.log(
            `${user} said muffin! Spawning ${amount} muffins.`
        );


        spawnMuffins(
            amount
        );
    };


    ComfyJS.Init(
        SETTINGS.channel
    );
}


connectToTwitch();


// ============================================================
// MUFFIN COLLISIONS
// ============================================================

function resolveMuffinCollisions() {

    for (
        let i = 0;
        i < muffins.length;
        i++
    ) {

        const a =
            muffins[i];


        for (
            let j = i + 1;
            j < muffins.length;
            j++
        ) {

            const b =
                muffins[j];


            // ----------------------------------------------
            // Centers
            // ----------------------------------------------

            const aCenterX =
                a.x +
                a.width / 2;

            const aCenterY =
                a.y +
                a.height / 2;


            const bCenterX =
                b.x +
                b.width / 2;

            const bCenterY =
                b.y +
                b.height / 2;


            const dx =
                bCenterX -
                aCenterX;

            const dy =
                bCenterY -
                aCenterY;


            // ----------------------------------------------
            // Smaller collision boxes
            // ----------------------------------------------

            const aCollisionWidth =
                a.width *
                SETTINGS.collisionSize;

            const aCollisionHeight =
                a.height *
                SETTINGS.collisionSize;


            const bCollisionWidth =
                b.width *
                SETTINGS.collisionSize;

            const bCollisionHeight =
                b.height *
                SETTINGS.collisionSize;


            // ----------------------------------------------
            // Check overlap
            // ----------------------------------------------

            const overlapX =
                (
                    aCollisionWidth +
                    bCollisionWidth
                ) / 2 -
                Math.abs(dx);


            const overlapY =
                (
                    aCollisionHeight +
                    bCollisionHeight
                ) / 2 -
                Math.abs(dy);


            if (
                overlapX <= 0 ||
                overlapY <= 0
            ) {
                continue;
            }


            // ----------------------------------------------
            // Horizontal collision
            // ----------------------------------------------

            if (
                overlapX <
                overlapY
            ) {

                const direction =
                    dx < 0
                        ? -1
                        : 1;


                const push =
                    overlapX / 2;


                a.x -=
                    direction *
                    push;

                b.x +=
                    direction *
                    push;


                const velocityA =
                    a.velocityX;

                const velocityB =
                    b.velocityX;


                a.velocityX =
                    velocityB *
                    SETTINGS.collisionBounce;

                b.velocityX =
                    velocityA *
                    SETTINGS.collisionBounce;


                // Transfer a tiny amount of spin

                const spinTransfer =
                    (
                        velocityA -
                        velocityB
                    ) * 0.02;


                a.rotationSpeed +=
                    spinTransfer;

                b.rotationSpeed -=
                    spinTransfer;
            }


            // ----------------------------------------------
            // Vertical collision
            // ----------------------------------------------

            else {

                const direction =
                    dy < 0
                        ? -1
                        : 1;


                const push =
                    overlapY / 2;


                a.y -=
                    direction *
                    push;

                b.y +=
                    direction *
                    push;


                const relativeVelocity =
                    b.velocityY -
                    a.velocityY;


                if (
                    relativeVelocity *
                    direction <
                    0
                ) {

                    const velocityA =
                        a.velocityY;

                    const velocityB =
                        b.velocityY;


                    a.velocityY =
                        velocityB *
                        SETTINGS.collisionBounce;

                    b.velocityY =
                        velocityA *
                        SETTINGS.collisionBounce;
                }


                // Transfer some horizontal velocity

                const horizontalA =
                    a.velocityX;

                const horizontalB =
                    b.velocityX;


                a.velocityX =
                    horizontalB * 0.15 +
                    horizontalA * 0.85;


                b.velocityX =
                    horizontalA * 0.15 +
                    horizontalB * 0.85;


                // Small rotational transfer

                const spinTransfer =
                    (
                        horizontalA -
                        horizontalB
                    ) * 0.01;


                a.rotationSpeed +=
                    spinTransfer;

                b.rotationSpeed -=
                    spinTransfer;
            }
        }
    }
}


// ============================================================
// PHYSICS
// ============================================================

let lastTime =
    performance.now();


function update(
    currentTime
) {

    const deltaTime =
        Math.min(
            (
                currentTime -
                lastTime
            ) / 1000,
            0.05
        );


    lastTime =
        currentTime;


    // ========================================================
    // INDIVIDUAL PHYSICS
    // ========================================================

    for (
        let i =
            muffins.length - 1;

        i >= 0;

        i--
    ) {

        const muffin =
            muffins[i];


        muffin.age +=
            deltaTime;


        // ----------------------------------------------------
        // Gravity
        // ----------------------------------------------------

        muffin.velocityY +=
            SETTINGS.gravity *
            deltaTime;


        // ----------------------------------------------------
        // Air friction
        // ----------------------------------------------------

        const friction =
            Math.pow(
                SETTINGS.friction,
                deltaTime * 60
            );


        muffin.velocityX *=
            friction;

        muffin.velocityY *=
            friction;


        // ----------------------------------------------------
        // Rotation friction
        // ----------------------------------------------------

        muffin.rotationSpeed *=
            Math.pow(
                SETTINGS.rotationFriction,
                deltaTime * 60
            );


        // Stop tiny rotations

        if (
            Math.abs(
                muffin.rotationSpeed
            ) <
            SETTINGS.rotationStopSpeed
        ) {

            muffin.rotationSpeed =
                0;
        }


        // ----------------------------------------------------
        // Movement
        // ----------------------------------------------------

        muffin.x +=
            muffin.velocityX *
            deltaTime;

        muffin.y +=
            muffin.velocityY *
            deltaTime;


        // ----------------------------------------------------
        // Rotation
        // ----------------------------------------------------

        muffin.rotation +=
            muffin.rotationSpeed *
            deltaTime;


        // ====================================================
        // LEFT WALL
        // ====================================================

        if (
            muffin.x < 0
        ) {

            muffin.x =
                0;


            muffin.velocityX =
                Math.abs(
                    muffin.velocityX
                ) *
                SETTINGS.bounce;


            muffin.rotationSpeed *=
                0.85;
        }


        // ====================================================
        // RIGHT WALL
        // ====================================================

        if (
            muffin.x +
            muffin.width >
            window.innerWidth
        ) {

            muffin.x =
                window.innerWidth -
                muffin.width;


            muffin.velocityX =
                -Math.abs(
                    muffin.velocityX
                ) *
                SETTINGS.bounce;


            muffin.rotationSpeed *=
                0.85;
        }


        // ====================================================
        // FLOOR
        // ====================================================

        if (
            muffin.y +
            muffin.height >
            window.innerHeight
        ) {

            muffin.y =
                window.innerHeight -
                muffin.height;


            muffin.velocityY =
                -Math.abs(
                    muffin.velocityY
                ) *
                SETTINGS.bounce;


            muffin.velocityX *=
                0.92;


            // Landing kills some spin

            muffin.rotationSpeed *=
                0.75;
        }
    }


    // ========================================================
    // MUFFIN VS MUFFIN
    // ========================================================

    resolveMuffinCollisions();


    // ========================================================
    // RENDER + LIFETIME
    // ========================================================

    for (
        let i =
            muffins.length - 1;

        i >= 0;

        i--
    ) {

        const muffin =
            muffins[i];


        muffin.element.style.left =
            `${muffin.x}px`;


        muffin.element.style.top =
            `${muffin.y}px`;


        muffin.element.style.transform =
            `rotate(${muffin.rotation}deg)`;


        // Lifetime

        if (
            muffin.age >=
            SETTINGS.lifetime
        ) {

            removeMuffin(
                muffin
            );
        }
    }


    requestAnimationFrame(
        update
    );
}


requestAnimationFrame(
    update
);


// ============================================================
// REMOVE MUFFIN
// ============================================================

function removeMuffin(
    muffin
) {

    const index =
        muffins.indexOf(
            muffin
        );


    if (
        index === -1
    ) {
        return;
    }


    muffins.splice(
        index,
        1
    );


    muffin.element.remove();
}


// ============================================================
// RESIZE
// ============================================================

window.addEventListener(
    "resize",
    () => {

        for (
            const muffin of muffins
        ) {

            muffin.x =
                Math.max(
                    0,
                    Math.min(
                        muffin.x,
                        window.innerWidth -
                        muffin.width
                    )
                );


            muffin.y =
                Math.min(
                    muffin.y,
                    window.innerHeight -
                    muffin.height
                );
        }
    }
);
