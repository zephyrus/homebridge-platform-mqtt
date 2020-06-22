const { EventEmitter } = require('events');

const { Characteristic } = require('./characteristic');

class Service extends EventEmitter {

	constructor(accessory, config) {
		super();

		this.config = config;
		this.accessory = accessory;

		this.platform = this.accessory.platform;
		this.log = this.platform.log;

		this.name = config.name || this.accessory.name;

		this.type = this.platform.serviceTypes[
			config.type.toLowerCase().replace(/[\s_]+/g, '')
		];

		if (!this.type) {
			this.log.warn(
				`unknown service type [${config.type}]`,
			);

			return;
		}

		const HAPService = this.type;

		this.service = new HAPService(this.name);

		if (config.hidden) {
			this.service.setHiddenService();
		}

		if (config.primary) {
			this.service.setPrimaryService();
		}

		this.characteristics = config.characteristics
			.map((characteristic) => this.characteristic(characteristic));
	}

	valid() {
		return !!this.service;
	}

	export() {
		return this.service;
	}

	set(state) {
		return this.characteristics
			.filter((characteristic) => characteristic.valid())
			.forEach((characteristic) => characteristic.set(state));
	}

	state() {
		return this.characteristics
			.filter((characteristic) => characteristic.valid())
			.reduce((state, characteristic) => ({
				...state,
				...characteristic.state(),
			}), {});
	}

	characteristic(config) {
		const characteristic = new Characteristic(this, config);

		if (!characteristic.valid()) {
			this.log.warn(
				`unknown characteristic type [${config.type}]`,
			);

			return characteristic;
		}

		characteristic.on('change', (...args) => {
			this.emit('change', this, characteristic, ...args);
		});

		return characteristic;
	}

}

module.exports = { Service };
