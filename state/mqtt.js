const isEqual = require('lodash.isequal');
const { syncState } = require('./sync');
const { Failure } = require('./failure');

class mqttState extends syncState {

	constructor(platform, config, configure) {
		super();

		this.childs = {};
		this.config = config;
		this.platform = platform;

		configure || this.configure(config);
	}

	subscribe(topic, handler) {
		this.debug(`subscribe [${topic}]`);

		return this.platform.subscribe(topic, async (t, data, ...args) => {
			this.debug(`received [${t}] ${JSON.stringify(data)}`);

			return handler(t, data, ...args);
		});
	}

	publish(topic, data, opts) {
		if (undefined === data) return;

		// avoid publish before platform is ready
		if (!this.platform.ready) return;

		this.debug(`publish [${topic}] ${JSON.stringify(data)}`);

		return this.platform.publish(topic, data, opts);
	}

	update(data) {
		if (!this.config.confirm) return this.set(data);

		// split child data from update
		Object.keys(this.childs).forEach((key) => {
			this.childs[key].update(data[key]);
			delete data[key];
		});

		if (isEqual(this.data, data)) return;

		this.emit('update', data, this.get());
	}

	debug(...args) {
		if (!this.platform.log) return;

		const config = this.platform.config || {};

		if (config.debug || this.config.debug) {
			this.platform.log.info(...args);
		}
	}

	get failed() {
		return !!this.failure;
	}

	instance() {
		return new this.constructor(this.platform, this.config, this);
	}

	configure(config) {
		if (!config) return;

		if (!Array.isArray(config.topics)) return;

		const event = this.config.confirm
			? 'update'
			: 'change';

		let failure;

		if (typeof this.config.confirm === 'number') {
			failure = new Failure(this.config.confirm, (status, context) => {
				this.emit('status', status);
				this.failure = status;

				if (status) {
					this.platform.log.warn(`timeout [${JSON.stringify(context)}]`);
				}
			});
		}

		config.topics.forEach((t) => {
			const state = t.key
				? this.child(t.key)
				: this;

			const parse = async (data, prev) => {
				if (typeof t.handle === 'function') {
					return t.handle(data, prev);
				}

				return data;
			};

			if (t.subscribe) {
				this.subscribe(t.subscribe, async (topic, data) => {
					state.set(await parse(data, state.get()));
					failure && failure.clear();
				});
			}

			if (t.publish) {
				state.on(event, async (data, prev) => {
					this.publish(t.publish, await parse(data, prev), t);
					failure && failure.watch(t);
				});
			}
		});
	}

}

module.exports = { mqttState };
