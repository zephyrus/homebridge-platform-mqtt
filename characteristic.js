const { EventEmitter } = require('events');

const format = require('./format');

const normalize = (f) => {
	if (typeof f === 'string' && format[f]) return format[f];

	if (typeof f === 'object') {
		if (typeof f.encode !== 'function') {
			return format.default;
		}

		if (typeof f.decode !== 'function') {
			return format.default;
		}

		return f;
	}

	return format.default;
};

class Characteristic extends EventEmitter {

	constructor(service, config) {
		super();

		this.config = config;
		this.service = service;

		this.platform = this.service.platform;

		this.value = config.value;
		this.type = this.platform.characteristicTypes[
			config.type.toLowerCase().replace(/[\s_]+/g, '')
		];

		this.format = normalize(config.format);

		if (!this.type) {
			return;
		}

		this.name = config.name || this.type.name;

		this.characteristic = this.service.service.getCharacteristic(this.type);

		if (config.props) {
			this.characteristic.setProps(config.props);
		}

		this.characteristic.on('get', (callback) => {
			// value was not set yet
			if (this.value === undefined) {
				this.init = callback;
				return;
			}

			callback(undefined, this.encode(this.value));
		});

		this.characteristic.on('set', (value, callback, context) => {
			if (context === this) return callback();

			const decoded = this.decode(value);

			if (this.value === decoded) return callback();

			this.value = decoded;

			if (config.debounce) {
				if (this.timeout) clearTimeout(this.timeout);

				this.timeout = setTimeout(() => {
					this.emit('change', this.value);
				}, config.debounce);

				return callback();
			}

			callback();

			return this.emit('change', this.value);
		});
	}

	state() {
		return {
			[this.name]: this.value,
		};
	}

	set(value) {
		// if object is passed, use only expected key
		if (typeof value === 'object') {
			// no expected key in data
			if (!(this.name in value)) return;

			value = value[this.name];
		}

		if (value === this.value) return;

		this.value = value;

		// first set of value
		if (this.init) {
			this.init(undefined, this.encode(this.value));
			delete this.init;

			return;
		}

		// skip if platform is not ready
		if (!this.platform.ready) return;

		this.characteristic.setValue(this.encode(value), undefined, this);
	}

	valid() {
		return !!this.characteristic;
	}

	encode(value) {
		if (typeof this.format.encode === 'function') {
			return this.format.encode(value);
		}

		return value;
	}

	decode(value) {
		if (typeof this.format.decode === 'function') {
			return this.format.decode(value);
		}

		return value;
	}

}

module.exports = { Characteristic };
