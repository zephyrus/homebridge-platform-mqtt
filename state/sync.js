const { EventEmitter } = require('events');
const merge = require('lodash.merge');
const isEqual = require('lodash.isequal');

class syncState extends EventEmitter {

	constructor(initial = {}) {
		super();

		this.childs = {};
		this.data = initial;
	}

	get() {
		return merge(
			{},
			this.data,
			Object.keys(this.childs).reduce((result, key) => {
				result[key] = this.childs[key].get();
				return result;
			}, {}),
		);
	}

	set(data) {
		if (data === undefined) return;

		if (this.data === data) return;

		// split child data from update
		Object.keys(this.childs).forEach((key) => {
			this.childs[key].set(data[key]);
			delete data[key];
		});

		if (isEqual(this.data, data)) return;

		const prev = this.data;
		this.data = merge({}, data);

		this.emit('change', this.get(), prev);
	}

	merge(data) {
		this.set(merge({}, this.data, data));
	}

	update(data) {
		return this.set(data);
	}

	link(state, convert = (data) => data) {
		const update = (data, prev) => state.update(convert(data, state.get(), prev));

		// set initial state
		update(this.get());

		// link following updates
		this.on('change', update);
	}

	child(key, initial) {
		let child = this.childs[key];

		if (child) {
			if (initial) child.set(initial);
			return child;
		}

		child = this.instance(initial || this.data[key]);
		this.childs[key] = child;
		delete this.data[key];

		child.on('change', (state, prev) => {
			const data = this.get();
			this.emit('change', data, { ...data, [key]: prev });
		});

		return child;
	}

	instance(initial) {
		return new this.constructor(initial);
	}

}

module.exports = { syncState };
