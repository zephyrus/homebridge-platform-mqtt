const path = require('path');
const mqtt = require('mqtt');

const { EventEmitter } = require('events');
const { Accessory } = require('./accessory');

class Platform extends EventEmitter {

	constructor(log, config, api) {
		super();

		this.log = log;
		this.config = config;
		this.api = api;

		this.ready = false;
		this.subscriptions = [];

		this.setMaxListeners(256);

		// homekit
		this.serviceTypes = Object.keys(this.api.hap.Service)
			.reduce((types, name) => {
				types[name.toLowerCase()] = this.api.hap.Service[name];
				return types;
			}, {});

		this.characteristicTypes = Object.keys(this.api.hap.Characteristic)
			.reduce((types, name) => {
				types[name.toLowerCase()] = this.api.hap.Characteristic[name];
				return types;
			}, {});

		// mqtt
		this.mqtt = mqtt.connect(config.host, {
			username: config.username,
			password: config.password,
		});

		this.mqtt.on('connect', () => {
			this.log.info(`connected to mqtt (${config.host})`);

			// platform is connected to mqtt
			this.emit('connected');

			if (this.ready) return;

			// wait for retain messages
			setTimeout(() => this.emit('synced'), 100);
		});

		this.mqtt.on('error', (e) => {
			this.log.error('mqtt error:');
			this.log.error(e);
		});

		this.mqtt.on('message', (...args) => this.receive(...args));
	}

	receive(topic, data) {
		// convert from buffer
		if (Buffer.isBuffer(data)) {
			data = data.toString();
		}

		// try to parse JSON message
		try {
			data = JSON.parse(data);
		} catch (e) {}

		// pass to subscribers
		this.subscriptions
			.filter((subscription) => subscription.topic === topic)
			.forEach((subscription) => subscription.handler(topic, data));
	}

	accessory(config) {
		return new Accessory(this, config);
	}

	accessories(callback) {
		const accessories = typeof this.config.accessories === 'string'
			? require(path.join(this.api.user.storagePath(), this.config.accessories))
			: this.config.accessories;

		const result = accessories.map((accessory) => this.accessory(accessory));

		if (!this.config.wait) {
			this.ready = true;
			callback(result);
			this.emit('ready', result);
		} else {
			// if required, wait for initialization event
			this.on(this.config.wait, () => {
				// ignore if we already gave accessory infotmation to homebridge
				if (this.ready) return;

				this.ready = true;
				callback(result);
				this.emit('ready', result);
			});
		}
	}

	subscribe(topic, handler) {
		const subscribed = this.subscriptions
			.find((subscription) => subscription.topic === topic);

		if (!subscribed) {
			this.mqtt.subscribe(topic);
		}

		this.subscriptions.push({ topic, handler });
	}

	publish(topic, message, { qos, retain } = {}) {
		if (typeof message === 'object') {
			message = JSON.stringify(message);
		}

		if (this.config.log) {
			this.log.info(`publish [${topic}] ${message}`);
		}

		this.mqtt.publish(topic, message, {
			qos,
			retain,
		});
	}

}

module.exports = (homebridge) => {
	homebridge.registerPlatform('homebridge-platform-mqtt', 'mqtt', Platform);
};
