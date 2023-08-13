// @ts-check
/*
 * Copyright 2012 Priit Kallas <kallaspriit@gmail.com>
 *
 * Permission is hereby granted, free of charge, to any person obtaining
 * a copy of this software and associated documentation files (the
 * "Software"), to deal in the Software without restriction, including
 * without limitation the rights to use, copy, modify, merge, publish,
 * distribute, sublicense, and/or sell copies of the Software, and to
 * permit persons to whom the Software is furnished to do so, subject to
 * the following conditions:
 *
 * The above copyright notice and this permission notice shall be
 * included in all copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND,
 * EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND
 * NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE
 * LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION
 * OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION
 * WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */

/**
 * A null function - does nothing, returns nothing
 */
let nullFunction = function () {};

/**
 * The null platform, which doesn't support anything
 */
let nullPlatform = {
	getType: function () {
		return "null";
	},
	isSupported: function () {
		return false;
	},
	update: nullFunction,
};

/**
 * This strategy uses a timer function to call an update function.
 * The timer (re)start function can be provided or the strategy reverts to
 * one of the window.*requestAnimationFrame letiants.
 * @module Gamepad
 */
class AnimFrameUpdateStrategy {
	update: () => void;
	requestAnimationFrame: (callback: FrameRequestCallback) => number;
	/** @param requestAnimationFrame function to use for timer creation */
	constructor(requestAnimationFrame?: (callback: FrameRequestCallback) => number) {
		let win = window;

		this.update = nullFunction;

		this.requestAnimationFrame =
			requestAnimationFrame ||
			win.requestAnimationFrame ||
			// @ts-ignore
			win.webkitRequestAnimationFrame ||
			// @ts-ignore
			win.mozRequestAnimationFrame;
	}

	/**
	 * This method calls the (user) update and restarts itself
	 */
	tickFunction() {
		this.update();
		this.startTicker();
	}

	/**
	 * (Re)Starts the ticker
	 */
	startTicker() {
		this.requestAnimationFrame.bind(window)(() => this.tickFunction.bind(this));
	}

	/**
	 * Starts the update strategy using the given function
	 * @param updateFunction the function to call at each update
	 */
	start(updateFunction: () => void) {
		this.update = updateFunction || nullFunction;
		this.startTicker();
	}
}

/**
 * This strategy gives the user the ability to call the library internal
 * update function on request. Use this strategy if you already have a
 * timer function running by requestAnimationFrame and you need fine control
 * over when the gamepads are updated.
 * @module Gamepad
 */
class ManualUpdateStrategy {
	/**
	 * Calls the update function in the started state. Does nothing otherwise.
	 */
	update: () => void;

	constructor() {
		this.update = nullFunction;
	}

	/**
	 * Starts the update strategy using the given function
	 * @param updateFunction the function to call at each update
	 */
	start(updateFunction: (() => void) | undefined) {
		this.update = updateFunction || nullFunction;
	}
}

/**
 * This platform is for webkit based environments that need to be polled
 * for updates.
 * @module Gamepad
 */
class WebKitPlatform {
	listener: {
		_connect: (gamepad: globalThis.Gamepad) => void;
		_disconnect: (gamepad: globalThis.Gamepad) => void;
	};
	gamepadGetter: () => globalThis.Gamepad[];
	knownGamepads: globalThis.Gamepad[];
	/**
	 * @param listener the listener to provide _connect and _disconnect callbacks
	 * @param gamepadGetter the poll function to return an array of connected gamepads
	 */
	constructor(listener: WebKitPlatform["listener"], gamepadGetter: () => globalThis.Gamepad[]) {
		this.listener = listener;
		this.gamepadGetter = gamepadGetter;
		this.knownGamepads = [];
	}
	/**
	 * Provides a platform object that returns true for isSupported() if valid.
	 * @param listener the listener to use
	 * @return a platform object
	 */
	static factory(listener: WebKitPlatform["listener"]): typeof nullPlatform | WebKitPlatform {
		/** @type {typeof nullPlatform | WebKitPlatform} */
		let platform: typeof nullPlatform | WebKitPlatform = nullPlatform;
		let navigator = window && window.navigator;

		if (navigator) {
			if (typeof navigator.getGamepads !== "undefined") {
				platform = new WebKitPlatform(listener, function (): globalThis.Gamepad[] {
					let gamepads = navigator.getGamepads();
					let tryit = gamepads.filter((e) => e !== null) as globalThis.Gamepad[];
					return tryit;
				});
				// @ts-expect-error webkit-specific
			} else if (typeof navigator.webkitGamepads !== "undefined") {
				platform = new WebKitPlatform(listener, function () {
					// @ts-expect-error webkit-specific
					return navigator.webkitGamepads();
				});
				// @ts-expect-error webkit-specific
			} else if (typeof navigator.webkitGetGamepads !== "undefined") {
				platform = new WebKitPlatform(listener, function () {
					// @ts-expect-error webkit-specific
					return navigator.webkitGetGamepads();
				});
			}
		}

		return platform;
	}
	static getType(): "WebKit" {
		return "WebKit";
	}
	getType() {
		return WebKitPlatform.getType();
	}
	isSupported(): true {
		return true;
	}
	/**
	 * Queries the currently connected gamepads and reports any changes.
	 */
	update() {
		let that = this,
			gamepads = Array.prototype.slice.call(this.gamepadGetter(), 0),
			gamepad: globalThis.Gamepad,
			i: number;

		for (i = this.knownGamepads.length - 1; i >= 0; i--) {
			gamepad = this.knownGamepads[i];
			if (gamepads.indexOf(gamepad) < 0) {
				this.knownGamepads.splice(i, 1);
				this.listener._disconnect(gamepad);
			}
		}

		for (i = 0; i < gamepads.length; i++) {
			gamepad = gamepads[i];
			if (gamepad && that.knownGamepads.indexOf(gamepad) < 0) {
				that.knownGamepads.push(gamepad);
				that.listener._connect(gamepad);
			}
		}
	}
}

/**
 * This platform is for mozilla based environments that provide gamepad
 * updates via events.
 *
 * @module Gamepad
 */
class FirefoxPlatform {
	listener: {
		_connect: (gamepad: globalThis.Gamepad) => void;
		_disconnect: (gamepad: globalThis.Gamepad) => void;
	};
	constructor(listener: FirefoxPlatform["listener"]) {
		this.listener = listener;

		window.addEventListener("gamepadconnected", function (e) {
			listener._connect(e.gamepad);
		});
		window.addEventListener("gamepaddisconnected", function (e) {
			listener._disconnect(e.gamepad);
		});
	}
	/**
	 * Provides a platform object that returns true for isSupported() if valid.
	 * @param listener the listener to use
	 * @return a platform object
	 */
	static factory(listener: FirefoxPlatform["listener"]) {
		let platform: typeof nullPlatform | FirefoxPlatform = nullPlatform;

		if (window && typeof window.addEventListener !== "undefined") {
			platform = new FirefoxPlatform(listener);
		}

		return platform;
	}
	/** @returns {"Firefox"} */
	static getType(): "Firefox" {
		return "Firefox";
	}
	isSupported() {
		let navigator = window && window.navigator;
		return navigator.userAgent.indexOf("Firefox") !== -1;
	}
	update() {}
	getType() {
		return FirefoxPlatform.getType();
	}
}

/**
 * Triggered when a new controller connects.
 */
type ConnectedEvent = (o: object) => void;
/**
 * Triggered when a controller disconnects.
 */
type DisconnectedEvent = (o: object) => void;
/**
 * Triggered when an unsupported controller connects.
 * @deprecated not used anymore. Any controller is supported.
 */
type UnsupportedEvent = (o: object) => void;
/**
 * Called regularly with the latest controllers info.
 */
type TickEvent = (gamepads: Array<object>) => void;
/**
 * Called when a gamepad button is pressed down.
 */
type ButtonDownEvent = (event: { gamepad: object; control: string }) => void;
/**
 * Called when a gamepad button is released.
 */
type ButtonUpEvent = (event: { gamepad: object; control: string }) => void;
/**
 * Called when gamepad axis value changed.
 */
type AxisChangedEvent = (event: { gamepad: object; axis: string; value: number }) => void;
type GamepadEvents = {
	connected: ConnectedEvent;
	disconnected: DisconnectedEvent;
	/** @deprecated */
	unsupported: UnsupportedEvent;
	tick: TickEvent;
	"button-down": ButtonDownEvent;
	"button-up": ButtonUpEvent;
	"axis-changed": AxisChangedEvent;
};

type GamepadListener<T extends keyof GamepadEvents> = GamepadEvents[T];
type GamepadListeners = {
	[key in keyof GamepadEvents]?: GamepadListener<key>[] | undefined;
};
/**
	 * Provides simple interface and multi-platform support for the gamepad API.
	 *
	 * You can change the deadzone and maximizeThreshold parameters to suit your
	 * taste but the defaults should generally work fine.
	 *

	 * @module Gamepad
	 * @author Priit Kallas <kallaspriit@gmail.com>
	 */
class Gamepad {
	updateStrategy: AnimFrameUpdateStrategy | ManualUpdateStrategy;
	gamepads: (globalThis.Gamepad & {
		state: Record<string, number>;
		lastState: Record<string, number>;
		updater: (() => void)[];
	})[];
	listeners: GamepadListeners;
	platform:
		| WebKitPlatform
		| FirefoxPlatform
		| {
				getType: () => string;
				isSupported: () => boolean;
				update: () => void;
		  };
	deadzone: number;
	maximizeThreshold: number;
	/** @param updateStrategy an update strategy, defaulting to {@link AnimFrameUpdateStrategy} */
	constructor(updateStrategy?: AnimFrameUpdateStrategy | ManualUpdateStrategy) {
		this.updateStrategy = updateStrategy || new AnimFrameUpdateStrategy();
		this.gamepads = [];
		/** @type {Partial<Record<(typeof Gamepad.Event)[keyof typeof Gamepad.Event], (GamepadEvents)[keyof GamepadEvents][]>>} */
		this.listeners = {};
		this.platform = nullPlatform;
		this.deadzone = 0.03;
		this.maximizeThreshold = 0.97;
	}
	/**
	 * @return a platform that does not support anything
	 */
	static getNullPlatform(): { prototype: typeof nullPlatform } {
		return Object.create(nullPlatform);
	}
	/**
	 * Resolves platform.
	 * @param listener the listener to handle _connect() or _disconnect() calls
	 * @return A platform instance
	 */
	static resolvePlatform(listener: {
		_connect: (gamepad: globalThis.Gamepad) => void;
		_disconnect: (gamepad: globalThis.Gamepad) => void;
	}):
		| WebKitPlatform
		| FirefoxPlatform
		| { getType: () => string; isSupported: () => boolean; update: () => void } {
		let platform:
				| {
						getType: () => string;
						isSupported: () => boolean;
						update: () => void;
				  }
				| FirefoxPlatform
				| WebKitPlatform = nullPlatform,
			i: keyof typeof Gamepad.PlatformFactories;

		for (i = 0; !platform.isSupported() && i < Gamepad.PlatformFactories.length; i++) {
			platform = Gamepad.PlatformFactories[i](listener);
		}

		return platform;
	}
	/**
	 * @param filter the filter object describing properties to match
	 * @param env the environment object that is matched against filter
	 * @return true if env is covered by filter
	 */
	static envMatchesFilter<Key extends string | number | symbol>(
		filter: Record<Key, unknown>,
		env: Record<Key, unknown>,
	): boolean {
		let result = true;

		for (let field in filter) {
			if (filter[field] !== env[field]) {
				result = false;
			}
		}

		return result;
	}
	/**
	 * Initializes the gamepad.
	 *
	 * You usually want to bind to the events first and then initialize it.
	 * @return true if a supporting platform was detected, false otherwise.
	 */
	init(): boolean {
		let platform = Gamepad.resolvePlatform(this);
		let that = this;

		this.platform = platform;
		this.updateStrategy.start(function () {
			that._update();
		});

		return platform.isSupported();
	}
	/**
	 * Binds a listener to a gamepad event.
	 * @param event Event to bind to, one of Gamepad.Event..
	 * @param listener Listener to call when given event occurs
	 * @return Self
	 */
	bind<T extends keyof GamepadListeners>(event: T, listener: GamepadListener<T>): this {
		if (typeof this.listeners[event] === "undefined") {
			this.listeners[event] = [];
		}

		this.listeners[event]?.push(listener);

		return this;
	}
	/**
	 * Removes listener of given type.
	 *
	 * If no type is given, all listeners are removed. If no listener is given, all
	 * listeners of given type are removed.
	 * @param type Type of listener to remove
	 * @param listener The listener function to remove
	 * @return Was unbinding the listener successful
	 */
	unbind<T extends keyof GamepadListeners>(type: T, listener: GamepadListener<T>): boolean {
		if (typeof type === "undefined") {
			this.listeners = {};

			return false;
		}

		if (typeof listener === "undefined") {
			this.listeners[type] = [];

			return false;
		}

		if (typeof this.listeners[type] === "undefined") {
			return false;
		}

		for (let i = 0; i < (this.listeners[type]?.length || 0); i++) {
			if (this.listeners[type]?.[i] === listener) {
				this.listeners[type]?.splice(i, 1);

				return true;
			}
		}

		return false;
	}
	/**
	 * Returns the number of connected gamepads.
	 */
	count(): number {
		return this.gamepads.length;
	}
	/**
	 * Fires an internal event with given data.
	 * @param event Event to fire, one of Gamepad.Event..
	 * @param data Data to pass to the listener
	 */
	private _fire<T extends keyof GamepadListeners>(event: T, ...data: Parameters<GamepadListener<T>>) {
		if (typeof this.listeners[event] === "undefined") {
			return;
		}

		for (let i = 0; i < (this.listeners[event]?.length || 0); i++) {
			let func: GamepadEvents[T] = this.listeners[event]?.[i] || function () {};
			// @ts-expect-error stupid thing stop complaining about tuple thingys
			func(...data);
		}
	}
	/**
	 * Registers given gamepad.
	 * @private
	 * @param pad Gamepad to connect to
	 */
	_connect(pad: globalThis.Gamepad) {
		//gamepad.mapping = this._resolveMapping(gamepad);
		// @ts-expect-error creating property
		pad.state = {};
		// @ts-expect-error creating property
		pad.lastState = {};
		// @ts-expect-error creating property
		pad.updater = [];
		let gamepad = pad as globalThis.Gamepad & {
			state: Record<string, number>;
			lastState: Record<string, number>;
			updater: (() => void)[];
		};

		let mapping = this._resolveMapping(gamepad);

		let count: number = mapping.buttons.byButton.length;
		for (let i = 0; i < count; i++) {
			this._addButtonUpdater(gamepad, mapping, i);
		}

		count = mapping.axes.byAxis.length;
		for (let i = 0; i < count; i++) {
			this._addAxisUpdater(gamepad, mapping, i);
		}

		this.gamepads[gamepad.index] = gamepad;

		this._fire(Gamepad.Event.CONNECTED, gamepad);
	}
	/**
	 * Adds an updater for a button control
	 *
	 * @param gamepad the gamepad for which to create the updater
	 * @param mapping the mapping on which to work on
	 * @param index button index
	 */
	_addButtonUpdater(
		gamepad: globalThis.Gamepad & {
			state: Record<string, number>;
			lastState: Record<string, number>;
			updater: (() => void)[];
		},
		mapping: ReturnType<typeof this._resolveMapping>,
		index: number,
	) {
		let updater = nullFunction;
		let controlName = getControlName(Gamepad.StandardButtons, index, "EXTRA_BUTTON_");
		let getter = this._createButtonGetter(gamepad, mapping.buttons, index);
		let that = this;
		let buttonEventData = {
			gamepad: gamepad,
			control: controlName,
		};

		gamepad.state[controlName] = 0;
		gamepad.lastState[controlName] = 0;

		updater = function () {
			let value = getter();
			let lastValue = gamepad.lastState[controlName];
			let isDown = value > 0.5;
			let wasDown = lastValue > 0.5;

			gamepad.state[controlName] = value;

			if (isDown && !wasDown) {
				that._fire(Gamepad.Event.BUTTON_DOWN, Object.create(buttonEventData));
			} else if (!isDown && wasDown) {
				that._fire(Gamepad.Event.BUTTON_UP, Object.create(buttonEventData));
			}

			if (value !== 0 && value !== 1 && value !== lastValue) {
				that._fireAxisChangedEvent(gamepad, controlName, value);
			}

			gamepad.lastState[controlName] = value;
		};

		gamepad.updater.push(updater);
	}
	/**
	 * Adds an updater for an axis control
	 *
	 * @method _addAxisUpdater
	 * @private
	 * @param {Object} gamepad the gamepad for which to create the updater
	 * @param {Object} mapping the mapping on which to work on
	 * @param index axis index
	 */
	_addAxisUpdater(
		gamepad: globalThis.Gamepad & {
			state: Record<string, number>;
			lastState: Record<string, number>;
			updater: (() => void)[];
		},
		mapping: ReturnType<typeof this._resolveMapping>,
		index: number,
	) {
		let updater = nullFunction;
		let controlName = getControlName(Gamepad.StandardAxes, index, "EXTRA_AXIS_");
		let getter = this._createAxisGetter(gamepad, mapping.axes, index);
		let that = this;

		gamepad.state[controlName] = 0;
		gamepad.lastState[controlName] = 0;

		updater = function () {
			let value = getter();
			let lastValue = gamepad.lastState[controlName];

			gamepad.state[controlName] = value;

			if (value !== lastValue) {
				that._fireAxisChangedEvent(gamepad, controlName, value);
			}

			gamepad.lastState[controlName] = value;
		};

		gamepad.updater.push(updater);
	}
	/**
	 * Fires an AXIS_CHANGED event
	 * @method _fireAxisChangedEvent
	 * @private
	 * @param {Object} gamepad the gamepad to notify for
	 * @param {String} controlName name of the control that changes its value
	 * @param value the new value
	 */
	_fireAxisChangedEvent(gamepad: object, controlName: string, value: number) {
		let eventData = {
			gamepad: gamepad,
			axis: controlName,
			value: value,
		};

		this._fire(Gamepad.Event.AXIS_CHANGED, eventData);
	}
	/**
	 * Disconnects from given gamepad.
	 *
	 * @method _disconnect
	 * @param {Object} gamepad Gamepad to disconnect
	 * @private
	 */
	_disconnect(gamepad: globalThis.Gamepad) {
		let newGamepads: typeof this.gamepads = [];

		if (typeof this.gamepads[gamepad.index] !== "undefined") {
			delete this.gamepads[gamepad.index];
		}

		for (let i = 0; i < this.gamepads.length; i++) {
			if (typeof this.gamepads[i] !== "undefined") {
				newGamepads[i] = this.gamepads[i];
			}
		}

		this.gamepads = newGamepads;

		this._fire(Gamepad.Event.DISCONNECTED, gamepad);
	}
	/**
	 * Resolves controller type from its id.
	 *
	 * @param id Controller id
	 * @return Controller type, one of Gamepad.Type
	 */
	private _resolveControllerType(id: string) {
		// Lowercase and strip all extra whitespace.
		id = id
			.toLowerCase()
			.replace(/\s+/g, " ")
			.replace(/^\s+|\s+$/g, "");

		if (id.indexOf("playstation") !== -1) {
			return Gamepad.Type.PLAYSTATION;
		} else if (id.indexOf("logitech") !== -1 || id.indexOf("wireless gamepad") !== -1) {
			return Gamepad.Type.LOGITECH;
		} else if (id.indexOf("xbox") !== -1 || id.indexOf("360") !== -1) {
			return Gamepad.Type.XBOX;
		} else if (
			(id.indexOf("79-6-generic") !== -1 && id.indexOf("joystick") !== -1) ||
			(id.indexOf("vendor: 0079 product: 0006") !== -1 && id.indexOf("generic usb joystick") !== -1)
		) {
			return Gamepad.Type.N64;
		} else {
			return Gamepad.Type.UNKNOWN;
		}
	}
	/**
	 * @param gamepad the gamepad for which to resolve the mapping
	 * @return a mapping object for the given gamepad
	 */
	private _resolveMapping(
		gamepad: globalThis.Gamepad & {
			state: Record<string, number>;
			lastState: Record<string, number>;
		},
	) {
		let mappings = Gamepad.Mappings;
		let mapping: (typeof mappings)[number] | null = null;
		let env = {
			platform: this.platform.getType(),
			type: this._resolveControllerType(gamepad.id),
		};

		for (let i = 0; !mapping && i < mappings.length; i++) {
			let test = mappings[i];
			if (Gamepad.envMatchesFilter(test.env, env)) {
				mapping = test;
			}
		}

		return mapping || Gamepad.StandardMapping;
	}
	/**
	 * Updates the controllers, triggering TICK events.
	 */
	private _update() {
		this.platform.update();

		this.gamepads.forEach(function (gamepad) {
			if (gamepad) {
				gamepad.updater.forEach(function (updater) {
					updater();
				});
			}
		});

		if (this.gamepads.length > 0) {
			this._fire(Gamepad.Event.TICK, this.gamepads);
		}
	}
	/**
	 * Applies deadzone and maximization.
	 *
	 * You can change the thresholds via deadzone and maximizeThreshold members.
	 * @param value Value to modify
	 * @param deadzone Deadzone to apply
	 * @param maximizeThreshold From which value to maximize value
	 */
	private _applyDeadzoneMaximize(value: number, deadzone?: number, maximizeThreshold?: number) {
		deadzone = typeof deadzone !== "undefined" ? deadzone : this.deadzone;
		maximizeThreshold = typeof maximizeThreshold !== "undefined" ? maximizeThreshold : this.maximizeThreshold;

		if (value >= 0) {
			if (value < deadzone) {
				value = 0;
			} else if (value > maximizeThreshold) {
				value = 1;
			}
		} else {
			if (value > -deadzone) {
				value = 0;
			} else if (value < -maximizeThreshold) {
				value = -1;
			}
		}

		return value;
	}
	/**
	 * Creates a getter according to the mapping entry for the specific index.
	 * Currently supported entries:
	 *
	 * axes.byAxis[index]: Number := Index into gamepad.axes; -1 ignored
	 * @param gamepad the gamepad for which to create a getter
	 * @param axes the mappings entry for the axes
	 * @param index the specific axis entry
	 * @return a getter returning the value for the requested axis
	 */
	private _createAxisGetter(
		gamepad: globalThis.Gamepad,
		axes: ReturnType<typeof this._resolveMapping>["axes"],
		index: number,
	) {
		let getter = function () {
			return 0;
		};
		let entry = axes.byAxis[index];
		if (entry !== -1) {
			if (typeof entry === "number" && entry < gamepad.axes.length) {
				getter = function (this: Gamepad) {
					let value = gamepad.axes[entry];

					return this._applyDeadzoneMaximize(value);
				};
			}
		}

		return getter;
	}

	/**
	 * Creates a getter according to the mapping entry for the specific index.
	 * Currently supported entries:
	 *
	 * buttons.byButton[index]: Number := Index into gamepad.buttons; -1 tests byAxis
	 * buttons.byAxis[index]: Array := [Index into gamepad.axes; Zero Value, One Value]
	 * @param {Object} gamepad the gamepad for which to create a getter
	 * @param {Object} buttons the mappings entry for the buttons
	 * @param index the specific button entry
	 * @return {Function} a getter returning the value for the requested button
	 */
	private _createButtonGetter = function (this: Gamepad) {
		function nullGetter() {
			return 0;
		}

		function createRangeGetter(valueGetter: () => number, from: number, to: number) {
			let getter = nullGetter;

			if (from < to) {
				getter = function () {
					let range = to - from;
					let value = valueGetter();

					value = (value - from) / range;

					return value < 0 ? 0 : value;
				};
			} else if (to < from) {
				getter = function () {
					let range = from - to;
					let value = valueGetter();

					value = (value - to) / range;

					return value > 1 ? 0 : 1 - value;
				};
			}

			return getter;
		}

		function isArray<T>(thing: any | T[]): thing is T[] {
			return "isArray" in Array
				? Array.isArray(thing)
				: Object.prototype.toString.call(thing) === "[object Array]";
		}

		let that = this;
		return function (
			gamepad: globalThis.Gamepad,
			buttons: ReturnType<typeof that._resolveMapping>["buttons"],
			index: number,
		) {
			let getter = nullGetter;

			let entry: number | readonly number[] = buttons.byButton[index];
			if (entry !== -1) {
				if (typeof entry === "number" && entry < gamepad.buttons.length) {
					let index = entry;
					getter = function () {
						let value = gamepad.buttons[index];

						if (typeof value === "number") {
							return value;
						}

						if (typeof value.value === "number") {
							return value.value;
						}

						return 0;
					};
				}
			} else if ("byAxis" in buttons && index < buttons.byAxis.length) {
				let entry = buttons.byAxis[index];
				if (isArray<number>(entry) && entry.length == 3 && entry[0] < gamepad.axes.length) {
					let index = entry;
					getter = function () {
						let value = gamepad.axes[index[0]];

						return that._applyDeadzoneMaximize(value);
					};

					getter = createRangeGetter(getter, entry[1], entry[2]);
				}
			}

			return getter;
		};
	}.bind(this)();
	/**
	 * The standard mapping that represents the mapping as per definition.
	 * Each button and axis map to the same index.
	 *
	 * @property StandardMapping
	 */
	static StandardMapping = {
		env: {},
		buttons: {
			byButton: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16],
		},
		axes: {
			byAxis: [0, 1, 2, 3],
		},
	} as const;

	/**
	 * List of supported controller types.
	 */
	static Type = {
		/** Retrolink N64 controller */
		N64: "n64",
		/** Playstation controller */
		PLAYSTATION: "playstation",
		/** Logitech controller */
		LOGITECH: "logitech",
		/** XBOX controller */
		XBOX: "xbox",
		/** Unknown controller */
		UNKNOWN: "unknown",
	} as const;
	/**
	 * Mapping of letious gamepads that differ from the standard mapping on
	 * different platforms too unify their buttons and axes.
	 *
	 * Each mapping should have an 'env' object, which describes the environment
	 * in which the mapping is active. The more entries such an environment has,
	 * the more specific it is.
	 *
	 * Mappings are expressed for both buttons and axes. Buttons might refer to
	 * axes if they are notified as such.
	 *
	 * @property Mappings
	 */
	static Mappings = [
		// Retrolink N64 controller on Firefox
		{
			env: {
				platform: FirefoxPlatform.getType(),
				type: Gamepad.Type.N64,
			},
			buttons: {
				byButton: [
					// TODO: Figure out which buttons to map A and Z buttons to.
					2, // FACE_1 -- C-down button
					1, // FACE_2 -- C-right button
					3, // FACE_3 -- C-left button
					0, // FACE_4 -- C-down button
					4, // LEFT_TOP_SHOULDER -- L button
					5, // RIGHT_TOP_SHOULDER -- R button
					-1, // LEFT_BOTTOM_SHOULDER -- missing on controller
					-1, // RIGHT_BOTTOM_SHOULDER -- missing on controller
					8, // SELECT_BACK -- B button (is this right?)
					9, // START_FORWARD -- START button
					-1, // LEFT_STICK -- missing on controller
					-1, // RIGHT_STICK -- missing on controller
					12, // DPAD_UP -- not supported by API (but may eventually)
					13, // DPAD_DOWN -- not supported by API (but may eventually)
					14, // DPAD_LEFT -- not supported by API (but may eventually)
					15, // DPAD_RIGHT -- not supported by API (but may eventually)
					-1, // HOME -- missing on controller (could be START/B?)
				],
			},
			axes: {
				byAxis: [
					1, // LEFT_STICK_X
					2, // LEFT_STICK_Y
					-1, // RIGHT_STICK_X
					-1, // RIGHT_STICK_Y
				],
			},
		},
		// Retrolink N64 controller on WebKit
		{
			env: {
				platform: WebKitPlatform.getType(),
				type: Gamepad.Type.N64,
			},
			buttons: {
				byButton: [
					// TODO: Figure out which buttons to map A and Z buttons to.
					2, // FACE_1 -- C-down button
					1, // FACE_2 -- C-right button
					3, // FACE_3 -- C-left button
					0, // FACE_4 -- C-down button
					4, // LEFT_TOP_SHOULDER -- L button
					5, // RIGHT_TOP_SHOULDER -- R button
					-1, // LEFT_BOTTOM_SHOULDER -- missing on controller
					-1, // RIGHT_BOTTOM_SHOULDER -- missing on controller
					8, // SELECT_BACK -- B button (is this right?)
					9, // START_FORWARD -- START button
					-1, // LEFT_STICK -- missing on controller
					-1, // RIGHT_STICK -- missing on controller
					12, // DPAD_UP -- D-Pad-up button
					13, // DPAD_DOWN -- D-Pad-down button
					14, // DPAD_LEFT -- D-Pad-left button
					15, // DPAD_RIGHT -- D-Pad-right button
					-1, // HOME -- missing on controller (could be START/B?)
				],
			},
			axes: {
				byAxis: [
					0, // LEFT_STICK_X
					1, // LEFT_STICK_Y
					-1, // RIGHT_STICK_X
					-1, // RIGHT_STICK_Y
				],
			},
		},
		// XBOX360 controller on Firefox
		{
			env: {
				platform: FirefoxPlatform.getType(),
				type: Gamepad.Type.XBOX,
			},
			buttons: {
				byButton: [0, 1, 2, 3, 4, 5, 15, 16, 9, 8, 6, 7, 11, 12, 13, 14, 10],
			},
			axes: {
				byAxis: [0, 1, 2, 3],
			},
		},
		// PS3 controller on Firefox
		{
			env: {
				platform: FirefoxPlatform.getType(),
				type: Gamepad.Type.PLAYSTATION,
			},
			buttons: {
				byButton: [14, 13, 15, 12, 10, 11, 8, 9, 0, 3, 1, 2, 4, 6, 7, 5, 16],
			},
			axes: {
				byAxis: [0, 1, 2, 3],
			},
		},
		// Logitech gamepad on WebKit
		{
			env: {
				platform: WebKitPlatform.getType(),
				type: Gamepad.Type.LOGITECH,
			},
			buttons: {
				// TODO: This can't be right - LEFT/RIGHT_STICK have same mappings as HOME/DPAD_UP
				byButton: [1, 2, 0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 11, 12, 13, 14, 10],
			},
			axes: {
				byAxis: [0, 1, 2, 3],
			},
		},
		// Logitech gamepad on Firefox
		{
			env: {
				platform: FirefoxPlatform.getType(),
				type: Gamepad.Type.LOGITECH,
			},
			buttons: {
				byButton: [0, 1, 2, 3, 4, 5, -1, -1, 6, 7, 8, 9, 11, 12, 13, 14, 10],
				byAxis: [-1, -1, -1, -1, -1, -1, [2, 0, 1], [2, 0, -1]],
			},
			axes: {
				byAxis: [0, 1, 3, 4],
			},
		},
	] as const;

	/**
	 * The available update strategies
	 * @property UpdateStrategies
	 */
	static UpdateStrategies = {
		AnimFrameUpdateStrategy: AnimFrameUpdateStrategy,
		ManualUpdateStrategy: ManualUpdateStrategy,
	} as const;

	/**
	 * List of factories of supported platforms. Currently available platforms:
	 *
	 * - {@link WebKitPlatform},
	 *
	 * - {@link FirefoxPlatform}
	 */
	static PlatformFactories = [FirefoxPlatform.factory, WebKitPlatform.factory] as const;

	/**
	 * List of events you can expect from the library.
	 *
	 * CONNECTED, DISCONNECTED and UNSUPPORTED events include the gamepad in
	 * question and tick provides the list of all connected gamepads.
	 *
	 * BUTTON_DOWN and BUTTON_UP events provide an alternative to polling button states at each tick.
	 *
	 * AXIS_CHANGED is called if a value of some specific axis changes.
	 */
	static Event = {
		/**
		 * Triggered when a new controller connects.
		 * @event connected
		 */
		CONNECTED: "connected",

		/**
		 * Called when an unsupported controller connects.
		 * @event unsupported
		 * @deprecated not used anymore. Any controller is supported.
		 */
		UNSUPPORTED: "unsupported",

		/**
		 * Triggered when a controller disconnects.
		 * @event disconnected
		 */
		DISCONNECTED: "disconnected",

		/**
		 * Called regularly with the latest controllers info.
		 * @event tick
		 */
		TICK: "tick",

		/**
		 * Called when a gamepad button is pressed down.
		 * @event button-down
		 */
		BUTTON_DOWN: "button-down",

		/**
		 * Called when a gamepad button is released.
		 * @event button-up
		 */
		BUTTON_UP: "button-up",

		/**
		 * Called when gamepad axis value changed.
		 * @event axis-changed
		 */
		AXIS_CHANGED: "axis-changed",
	} as const;

	/**
	 * List of standard button names. The index is the according standard button
	 * index as per standard.
	 */
	static StandardButtons = [
		"FACE_1",
		"FACE_2",
		"FACE_3",
		"FACE_4",
		"LEFT_TOP_SHOULDER",
		"RIGHT_TOP_SHOULDER",
		"LEFT_BOTTOM_SHOULDER",
		"RIGHT_BOTTOM_SHOULDER",
		"SELECT_BACK",
		"START_FORWARD",
		"LEFT_STICK",
		"RIGHT_STICK",
		"DPAD_UP",
		"DPAD_DOWN",
		"DPAD_LEFT",
		"DPAD_RIGHT",
		"HOME",
	] as const;

	/**
	 * List of standard axis names. The index is the according standard axis
	 * index as per standard.
	 */
	static StandardAxes = ["LEFT_STICK_X", "LEFT_STICK_Y", "RIGHT_STICK_X", "RIGHT_STICK_Y"] as const;
}

function getControlName(
	names: typeof Gamepad.StandardAxes | typeof Gamepad.StandardButtons,
	index: number,
	extraPrefix: string,
) {
	return index < names.length ? names[index] : extraPrefix + (index - names.length + 1);
}

export { Gamepad };

