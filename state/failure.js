class Failure {

	constructor(delay, handle) {
		this.status = false;
		this.delay = delay;
		this.handle = handle;
	}

	set(status) {
		if (this.status === status) return;
		this.status = status;
		'function' === typeof this.handle && this.handle(status, this.context);
	}

	get() {
		return this.status;
	}

	watch(context) {
		if (!this.delay) return;
		this.timer = setTimeout(() => this.set(true), this.delay);
		this.context = context;
	}

	clear() {
		if (this.timer) {
			clearTimeout(this.timer);
			this.timer = undefined;
			this.context = undefined;
		}

		this.set(false);
	}

}

module.exports = { Failure };
