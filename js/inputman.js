//Using http://kallaspriit.github.io/HTML5-JavaScript-Gamepad-Controller-Library/

var inputStepPause = 7;

var inputStep = 0;
var gamepad = new Gamepad();
var holdLeft = false;
var holdRight = false;
var holdDown = false;
var holdL = false;
var holdR = false;

gamepad.bind(Gamepad.Event.CONNECTED, function (device) {
    dbt.innerHTML = "Gamepad Detected";
    if (!running) {
        playerReset();
        updateScore();
        update();
        running = true;
    }
});

gamepad.bind(Gamepad.Event.BUTTON_DOWN, function (e) {
    dbt.innerHTML = "" + e.control;
    switch (e.control) {
        case "DPAD_LEFT":
            holdLeft = true;
            break;
        case "RIGHT_BOTTOM_SHOULDER":
            location.reload();
            break;
        case "DPAD_RIGHT":
            holdRight = true;
            break;
        case "DPAD_DOWN":
            holdDown = true;
            break;
        case "LEFT_TOP_SHOULDER":
            holdL = true;
            break;
        case "RIGHT_TOP_SHOULDER":
            holdR = true;
            break;
        case "START_FORWARD":
            togglePause();
            break;
        case "SELECT_BACK":
            togglePause();
            break;
        case "FACE_3":
            switchMode();
            break;
    }

});

gamepad.bind(Gamepad.Event.BUTTON_UP, function (e) {
    switch (e.control) {
        case "DPAD_LEFT":
            holdLeft = false;
            break;
        case "DPAD_RIGHT":
            holdRight = false;
            break;
        case "DPAD_DOWN":
            holdDown = false;
            break;
        case "LEFT_TOP_SHOULDER":
            holdL = false;
            break;
        case "RIGHT_TOP_SHOULDER":
            holdR = false;
            break;
    }

});

gamepad.bind(Gamepad.Event.TICK, function (gamepads) {
    if (inputStep >= inputStepPause) {
        if (holdLeft) {
            move("x", -1);
        }
        if (holdRight) {
            move("x", 1);
        }
        if (holdDown) {
            move("y", 1);
        }
        if (holdL) {
            move("z", 0);
        }
        if (holdR) {
            move("z", 1);
        }
        inputStep = 0;
    } else {
        inputStep++;
    }
});

gamepad.bind(Gamepad.Event.AXIS_CHANGED, function (e) {
    dbt.innerHTML = "" + e.value + " | " + e.axis;
    switch (e.axis) {
        case "LEFT_STICK_X":
            if (e.value < -0.5) {
                holdLeft = true;
                holdRight = false;
            } else if (e.value > 0.5) {
                holdRight = true;
                holdLeft = false;
            } else if (e.value < 0.5 || e.value > -0.5) {
                holdLeft = false;
                holdRight = false;
            }
            break;
        case "LEFT_STICK_Y":
            if (e.value > 0.5) {
                holdDown = true;
            } else if (e.value < 0.5) {
                holdDown = false;
            }
            break;
    }
});

if (!gamepad.init()) {
    dbt.innerHTML = "ERROR";
}
