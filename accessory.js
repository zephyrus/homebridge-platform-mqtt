const { EventEmitter } = require('events');
const { State } = require('./state');
const { Service } = require('./service');
const { isEqual } = require('lodash');

const dynamic = (state, value, def) => {
	if (!value) return def;

	return typeof value === 'function'
		? value(state)
		: value;
};

class Accessory extends EventEmitter {

	constructor(platform, config) {
		super();

		// hap is requiring name property
		this.name = config.name;

		this.config = config;
		this.platform = platform;

		this.services = config.services
			.map((service) => this.service(service));

		this.mqtt = new State();
		this.homekit = new State(this.state());

		this.homekit.on('change', (state) => {
			this.services
				.filter((service) => service.valid())
				.map((service) => service.set(state));
		});

		// link mqtt and homekit once mqtt synced
		this.platform.on('synced', () => {
			this.mqtt.link(this.homekit, (...args) => this.encode(...args));
			this.homekit.link(this.mqtt, (...args) => this.decode(...args));
		});

		if (this.config.online) this.mqtt.on('change', (data, prev) => {
			this.online = 'function' === typeof this.config.online
				? this.config.online(data, prev)
				: data[this.config.online];
		});

		if (!config.topics) return;

		config.topics.forEach((t) => {
			if (!t.topic) return;

			if (typeof t.parse === 'function') {
				platform.subscribe(t.topic, (topic, data) => {
					if (this.platform.config.log) {
						this.platform.log.info(`received [${topic}] ${JSON.stringify(data)}`);
					}

					this.mqtt.merge(t.parse(data, this.mqtt.get()));
				});
			}

			if (typeof t.sync === 'function') {
				this.mqtt.on('change', (...args) => {
					if (!this.platform.ready) return;

					if ('function' === typeof t.skip){
						if (t.skip(...args, isEqual)) return;
					}

					const state = t.sync(...args, isEqual);

					if (undefined === state) return;

					platform.publish(t.topic, state, t);
				});
			}
		});
	}

	info(info = {}) {
		// accessory information service only being used on accessory
		// provision. any update later will take zero effect
		const { Characteristic } = this.platform.api.hap;
		const service = new this.platform.api.hap.Service.AccessoryInformation();

		const data = this.mqtt.get();

		service.setCharacteristic(Characteristic.Manufacturer, dynamic(data, info.manufacturer, 'unknown'));
		service.setCharacteristic(Characteristic.Model, dynamic(data, info.model, 'unknown'));
		service.setCharacteristic(Characteristic.SerialNumber, dynamic(data, info.serial, 'unknown'));
		service.setCharacteristic(Characteristic.FirmwareRevision, dynamic(data, info.firmware, '0.0.1'));

		return service;
	}

	// encode data to homekit
	encode(...args) {
		if (typeof this.config.encode === 'function') {
			try {
				return this.config.encode(...args);
			} catch(e) {
				this.error(e);
			}
		}

		return args[1];
	}

	// decode data from homekit
	decode(...args) {
		if (typeof this.config.decode === 'function') {
			try {
				return this.config.decode(...args);
			} catch(e) {
				this.error(e);
			}
		}

		return args[1];
	}

	state() {
		return this.services
			.filter((service) => service.valid())
			.reduce((state, service) => ({
				...state,
				...service.state(),
			}), {});
	}

	error(e) {
		this.platform.log.error(e);
	}

	change() {
		this.homekit.set(this.state());
	}

	service(config) {
		const service = new Service(this, config);

		service.on('change', (...args) => this.change(...args));

		return service;
	}

	getServices() {
		return [
			// provision accessory information
			this.info(this.information || this.config),

			// provision defined services
			...this.services
				.filter((service) => service.valid())
				.map((service) => service.export()),
		];
	}

}

module.exports = { Accessory };
